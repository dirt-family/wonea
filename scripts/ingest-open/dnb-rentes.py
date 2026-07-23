"""DNB gemiddelde hypotheekrentes per rentevast-bucket -> lib/bronnen/rentes-snapshot.json

VERVERSEN (herdraaibaar, vanaf de repo-root):
    cd scripts/ingest-open
    python3 -m venv .venv && .venv/bin/pip install -r requirements.txt   # eenmalig
    .venv/bin/python -m playwright install chromium                       # eenmalig (of: crawl4ai-setup)
    .venv/bin/python dnb-rentes.py

HOE DIT WERKT (en waarom via een browser):
    Het DNB-dashboard "Hypotheekrentes banken"
    (https://www.dnb.nl/statistieken/dashboards/woninghypotheken/hypotheekrentes-banken/)
    tekent zijn grafiek uit DNB Tabel 5.2.7.1: "Deposito's en leningen van MFI's aan
    huishoudens, rentepercentages, gecorrigeerd voor breuken (Maand)". Die tabel is als
    JSON-resource beschikbaar op api.dnb.nl (statpub-intapi-prd), maar dat endpoint eist
    een Ocp-Apim-subscription-key; de sleutel die de site zelf gebruikt zit in de
    frontend-bundel en kan roteren. Kale requests naar www.dnb.nl worden bovendien door
    Akamai geblokkeerd (Access Denied, geverifieerd 2026-07-23).
    Daarom laadt dit script het dashboard in een echte headless browser (crawl4ai /
    Playwright) en vangt het de netwerk-responses af die de pagina ZELF ophaalt,
    inclusief de JSON van tabel 5.2.7.1. Geen key in deze code, geen workaround: we
    lezen mee met wat elke bezoeker van de pagina binnenkrijgt.

WAT ERUIT KOMT:
    De meest recente maand met de gemiddelde bancaire rente op zuiver nieuw afgesloten
    woninghypotheken, per rentevaste periode (de vier DNB-buckets) plus het totaal.
    Weggeschreven naar ../../lib/bronnen/rentes-snapshot.json. Bij elke fout blijft de
    bestaande snapshot onaangeroerd en eindigt het script met exit-code 1 en een
    duidelijke melding.

BRON (voor de UI-bronvermelding):
    DNB Tabel 5.2.7.1, dataset efba2d4e-fb53-49a8-a1fe-d5ee3263e14c,
    resource 8d3ccc86-8396-43b8-a18b-5ba293f01c1d. Cijfers zijn maandgemiddelden over
    banken (MFI's), niet per geldverstrekker en niet NHG-gesplitst (zie
    docs/DATABRONNEN.md punt 5).
"""

from __future__ import annotations

import asyncio
import datetime as dt
import json
import sys
from pathlib import Path

from crawl4ai import AsyncWebCrawler, BrowserConfig, CacheMode, CrawlerRunConfig

DASHBOARD_URL = "https://www.dnb.nl/statistieken/dashboards/woninghypotheken/hypotheekrentes-banken/"
BRON_NAAM = (
    "DNB Tabel 5.2.7.1: Deposito's en leningen van MFI's aan huishoudens, "
    "rentepercentages, gecorrigeerd voor breuken (maand)"
)
BRON_URL = (
    "https://www.dnb.nl/statistieken/data-zoeken/#/details/"
    "deposito-s-en-leningen-van-mfi-s-aan-huishoudens-rentepercentages-"
    "gecorrigeerd-voor-breuken-maand/dataset/efba2d4e-fb53-49a8-a1fe-d5ee3263e14c/"
    "resource/8d3ccc86-8396-43b8-a18b-5ba293f01c1d"
)

SNAPSHOT_PAD = Path(__file__).resolve().parents[2] / "lib" / "bronnen" / "rentes-snapshot.json"

# DNB-reeksnaam (kolom RenteVastPeriode, gestript) -> onze stabiele bucket-key + UI-label.
BUCKETS = {
    "Variabel en <= 1 jaar *": ("variabel_tot_1", "Variabel en tot en met 1 jaar rentevast"),
    "> 1 jaar en <= 5 jaar *": ("1_tot_5", "1 tot en met 5 jaar rentevast"),
    "> 5 jaar en <= 10 jaar *": ("5_tot_10", "5 tot en met 10 jaar rentevast"),
    "> 10 jaar *": ("vanaf_10", "Langer dan 10 jaar rentevast"),
}
TOTAAL_REEKS = "Totaal *"

# Rijfilter binnen tabel 5.2.7.1 (kolommen: Balanszijde, Instrument, Stroomtype,
# LooptijdOorspronkelijk, RenteVastPeriode, Periode, waarde).
INSTRUMENT = "Woninghypotheken - Zuiver nieuwe leningen"
STROOMTYPE = "Nieuwe contracten"
LOOPTIJD = "Totaal"


async def haal_tabel_op() -> dict:
    """Laadt het dashboard en geeft de geparste JSON van tabel 5.2.7.1 terug."""
    browser = BrowserConfig(headless=True, viewport_width=1400, viewport_height=1000)
    run = CrawlerRunConfig(
        cache_mode=CacheMode.BYPASS,
        capture_network_requests=True,
        wait_for_images=False,
        page_timeout=90000,
        delay_before_return_html=15.0,  # de grafieken laden hun (grote) data na de paginaload
    )
    async with AsyncWebCrawler(config=browser) as crawler:
        result = await crawler.arun(url=DASHBOARD_URL, config=run)
    if not result.success:
        raise RuntimeError(f"dashboard laden mislukt: {result.error_message}")

    # Herken de juiste tabel aan de INHOUD (kolomstructuur + instrument), niet aan het
    # roteerbare resource-id of de exacte URL. Let op: het dashboard laadt TWEE tabellen
    # met exact dezelfde structuur: 5.2.7.1 (rentepercentages) en de volumetabel
    # (EUR miljoenen). We kiezen de tabel waarvan de woninghypotheek-waarden eruitzien
    # als percentages (alles onder de 25).
    kandidaten = []
    for record in result.network_requests or []:
        if record.get("event_type") != "response":
            continue
        tekst = (record.get("body") or {}).get("text")
        if not tekst or INSTRUMENT not in tekst:
            continue
        try:
            data = json.loads(tekst)
        except json.JSONDecodeError:
            continue
        rijen = data.get("data") if isinstance(data, dict) else None
        if not isinstance(rijen, list) or not rijen:
            continue
        waarden = [
            float(rij[6])
            for rij in rijen
            if isinstance(rij, list) and len(rij) >= 7 and INSTRUMENT in str(rij[1]) and isinstance(rij[6], (int, float))
        ]
        if waarden:
            kandidaten.append((data, max(waarden)))
    rentetabellen = [data for data, maximum in kandidaten if maximum < 25]
    if len(rentetabellen) == 1:
        return rentetabellen[0]
    raise RuntimeError(
        f"verwachtte precies 1 rentetabel, vond {len(rentetabellen)} "
        f"(kandidaten: {len(kandidaten)}); is de dashboard-opbouw veranderd? Controleer " + DASHBOARD_URL
    )


def extraheer_snapshot(tabel: dict) -> dict:
    rijen = [
        rij
        for rij in tabel["data"]
        if isinstance(rij, list)
        and len(rij) >= 7
        and str(rij[1]).strip() == INSTRUMENT
        and str(rij[2]).strip() == STROOMTYPE
        and str(rij[3]).strip() == LOOPTIJD
        and isinstance(rij[6], (int, float))
    ]
    if not rijen:
        raise RuntimeError("geen woninghypotheek-rijen gevonden in tabel 5.2.7.1")

    laatste_ms = max(rij[5] for rij in rijen)
    peilmaand = dt.datetime.fromtimestamp(laatste_ms / 1000, tz=dt.timezone.utc)
    laatste = {str(rij[4]).strip(): float(rij[6]) for rij in rijen if rij[5] == laatste_ms}

    buckets = []
    for reeks, (key, label) in BUCKETS.items():
        if reeks not in laatste:
            raise RuntimeError(f"bucket '{reeks}' ontbreekt in de laatste maand; DNB-reeksnamen veranderd?")
        buckets.append({"bucket": key, "label": label, "reeksDnb": reeks.rstrip(" *"), "rentePct": laatste[reeks]})

    # Sanity: gemiddelde NL-hypotheekrentes horen ruim binnen 0.5 - 10 procent te liggen.
    for b in buckets:
        if not 0.5 <= b["rentePct"] <= 10:
            raise RuntimeError(f"onwaarschijnlijke rente {b['rentePct']} voor {b['bucket']}; niet weggeschreven")
    # Sanity: de peilmaand mag niet ouder zijn dan ~6 maanden (DNB publiceert met ~2 mnd vertraging).
    if (dt.datetime.now(tz=dt.timezone.utc) - peilmaand).days > 190:
        raise RuntimeError(f"peilmaand {peilmaand:%Y-%m} is verdacht oud; controleer de bron")

    return {
        "peildatum": f"{peilmaand:%Y-%m}",
        "opgehaaldOp": f"{dt.date.today():%Y-%m-%d}",
        "bron": BRON_NAAM,
        "bronUrl": BRON_URL,
        "dashboardUrl": DASHBOARD_URL,
        "toelichting": (
            "Gemiddelde bancaire rente op zuiver nieuw afgesloten woninghypotheken aan "
            "huishoudens, per rentevaste periode. Maandgemiddelde over banken; geen "
            "tarieven per geldverstrekker en geen NHG-splitsing."
        ),
        "totaalRentePct": laatste.get(TOTAAL_REEKS),
        "buckets": buckets,
    }


def main() -> int:
    try:
        tabel = asyncio.run(haal_tabel_op())
        snapshot = extraheer_snapshot(tabel)
    except Exception as fout:  # bewust breed: elke fout = snapshot ongemoeid laten
        print(f"FOUT: {fout}", file=sys.stderr)
        print(f"Bestaande snapshot blijft staan: {SNAPSHOT_PAD}", file=sys.stderr)
        return 1

    SNAPSHOT_PAD.parent.mkdir(parents=True, exist_ok=True)
    SNAPSHOT_PAD.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Snapshot geschreven: {SNAPSHOT_PAD}")
    print(f"Peilmaand {snapshot['peildatum']}: " + ", ".join(f"{b['bucket']}={b['rentePct']}%" for b in snapshot["buckets"]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
