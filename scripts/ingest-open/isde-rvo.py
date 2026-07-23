"""ISDE 2026 (RVO): apparaat-subsidies en isolatiebedragen -> isde-raw.json

VERVERSEN (herdraaibaar, vanaf de repo-root):
    cd scripts/ingest-open
    python3 -m venv .venv && .venv/bin/pip install -r requirements.txt   # eenmalig
    .venv/bin/python isde-rvo.py
    # vergelijk daarna de uitvoer met lib/normen/isde-2026.ts en werk die
    # bij als bedragen zijn veranderd (de TS is de bron voor de app; dit
    # script is het meetinstrument).

HOE DIT WERKT:
    1. Warmtepompen en zonneboilers: RVO publiceert per goedgekeurd apparaat het
       exacte subsidiebedrag in de openbare meldcodelijsten. Die lijsten draaien
       op een publieke JSON-API (geen key, geen browser nodig):
           https://www.rvo.nl/api/rvo/v1/search-products/21   (warmtepompen, ~3.2k)
           https://www.rvo.nl/api/rvo/v1/search-products/23   (zonneboilers, ~525)
       Dit script haalt ALLE pagina's op en berekent per categorie n, minimum,
       maximum, gemiddelde en mediaan. Dat zijn de "indicatief gemiddelde"
       bedragen: het echte bedrag hangt af van het gekozen apparaat.
    2. Isolatie: de bedragen per m2 (uitvoering 2025 of later) staan als tekst op
       https://www.rvo.nl/subsidies-financiering/isde/woningeigenaren/isolatiemaatregelen
       en worden hier met een strakke regex geparst (bedrag per m2, minimaal en
       maximaal aantal m2, biobased-bonus).
    Uitvoer: scripts/ingest-open/isde-raw.json (gecommit als data-bestand).
    Bij elke fout blijft de bestaande uitvoer onaangeroerd (exit 1).

BRONNEN:
    - meldcodelijst warmtepompen: https://www.rvo.nl/subsidies-financiering/isde/meldcodelijsten/warmtepompen
    - meldcodelijst zonneboilers: https://www.rvo.nl/subsidies-financiering/isde/meldcodelijsten/zonneboilers
    - isolatiebedragen: https://www.rvo.nl/subsidies-financiering/isde/woningeigenaren/isolatiemaatregelen
"""

from __future__ import annotations

import datetime as dt
import html as html_mod
import json
import re
import statistics
import sys
import time
import urllib.request
from pathlib import Path

API = "https://www.rvo.nl/api/rvo/v1/search-products/{lijst}?page={pagina}"
ISOLATIE_URL = "https://www.rvo.nl/subsidies-financiering/isde/woningeigenaren/isolatiemaatregelen"
UIT_PAD = Path(__file__).resolve().parent / "isde-raw.json"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0 Safari/537.36"
DELAY_S = 0.3  # nette burger: niet hameren op de RVO-API


def fetch(url: str) -> bytes:
    verzoek = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json,text/html"})
    with urllib.request.urlopen(verzoek, timeout=30) as antwoord:
        return antwoord.read()


def parse_bedrag(tekst: str) -> int | None:
    """'€3.700' of '€ 2.050' -> 3700 (hele euro's)."""
    m = re.search(r"€\s*([\d.]+)", tekst)
    return int(m.group(1).replace(".", "")) if m else None


def haal_meldcodelijst(lijst_id: int, naam: str) -> list[dict]:
    """Alle pagina's van een meldcodelijst; geeft [{categorie, bedrag}, ...]."""
    apparaten: list[dict] = []
    pagina = 0
    totaal_paginas = 1
    while pagina < totaal_paginas:
        data = json.loads(fetch(API.format(lijst=lijst_id, pagina=pagina)))
        pager = data.get("pager") or {}
        totaal_paginas = int(pager.get("pages") or 0)
        for r in data.get("searchResults") or []:
            samenvatting = html_mod.unescape(r.get("summary") or "")
            cat = re.search(r"Categorie:\s*</b>\s*([^<]+)", samenvatting)
            bedrag = parse_bedrag(samenvatting)
            if cat and bedrag:
                apparaten.append({"categorie": cat.group(1).strip(), "bedrag": bedrag})
        pagina += 1
        time.sleep(DELAY_S)
    if not apparaten:
        raise RuntimeError(f"meldcodelijst {naam} (id {lijst_id}) leverde 0 apparaten; API veranderd?")
    print(f"{naam}: {len(apparaten)} apparaten opgehaald ({totaal_paginas} pagina's)")
    return apparaten


def per_categorie(apparaten: list[dict]) -> dict:
    groepen: dict[str, list[int]] = {}
    for a in apparaten:
        groepen.setdefault(a["categorie"], []).append(a["bedrag"])
    return {
        cat: {
            "n": len(bedragen),
            "minEur": min(bedragen),
            "maxEur": max(bedragen),
            "gemiddeldEur": round(statistics.mean(bedragen)),
            "mediaanEur": round(statistics.median(bedragen)),
        }
        for cat, bedragen in sorted(groepen.items())
    }


# Regex over de platgeslagen paginatekst. Vorm (sectie "2025 of later"):
#   "Voor <maatregel> kunt u € 5,25 per m 2 ontvangen. U isoleert hiervoor
#    minimaal 10 m 2 ... maximaal 170 m 2 subsidie. ... bonus ... is € 1,50."
MAATREGEL_RE = re.compile(
    r"Voor ([a-zë\- ]+isolatie) kunt u € ([\d,.]+) per m 2\s+ontvangen\."
    r".{0,200}?minimaal (\d+) m 2.{0,200}?maximaal (\d+) m 2\s+subsidie\."
    r"(?:.{0,140}?bonus[^€]{0,80}€ ([\d,.]+)\.)?",
    re.IGNORECASE,
)
GLAS_RE = re.compile(r"Voor ([^€]{5,120}?) ontvangt u € ([\d,.]+) per m 2")


def eur(tekst: str) -> float:
    return float(tekst.replace(".", "").replace(",", "."))


def haal_isolatie() -> dict:
    raw = fetch(ISOLATIE_URL).decode("utf-8", errors="replace")
    tekst = re.sub(r"<script.*?</script>", " ", raw, flags=re.S)
    tekst = re.sub(r"<[^>]+>", " ", tekst)
    tekst = re.sub(r"\s+", " ", html_mod.unescape(tekst).replace("\xa0", " "))

    controle = re.search(r"gecontroleerd op (\d{1,2} \w+ \d{4})", tekst)

    # Alleen de sectie "uitvoering in 2025 of later" telt voor 2026.
    try:
        vanaf_2025 = tekst.split("Subsidiebedrag voor uitvoering in 2025 of later", 1)[1]
    except IndexError:
        raise RuntimeError("sectie 'uitvoering in 2025 of later' niet gevonden; paginastructuur veranderd?")
    maatregelen = {}
    for m in MAATREGEL_RE.finditer(vanaf_2025):
        naam = m.group(1).strip().lower()
        maatregelen[naam] = {
            "eurPerM2": eur(m.group(2)),
            "minM2": int(m.group(3)),
            "maxM2": int(m.group(4)),
            "biobasedBonusEurPerM2": eur(m.group(5)) if m.group(5) else None,
        }
    verwacht = {"spouwmuurisolatie", "gevelisolatie", "bodemisolatie", "vloerisolatie", "dakisolatie"}
    if not verwacht.issubset(maatregelen):
        raise RuntimeError(f"isolatiemaatregelen incompleet geparst: {sorted(maatregelen)}")

    # Glas: sectie "Voor maatregelen uitgevoerd vanaf 1-1-2025 gelden de volgende subsidiebedragen".
    try:
        glas_sectie = tekst.split("vanaf 1-1-2025 gelden de volgende subsidiebedragen", 1)[1]
    except IndexError:
        raise RuntimeError("glas-sectie 'vanaf 1-1-2025' niet gevonden; paginastructuur veranderd?")
    glas = [
        {"omschrijving": re.sub(r"\s+", " ", m.group(1)).strip(), "eurPerM2": eur(m.group(2))}
        for m in GLAS_RE.finditer(glas_sectie[:4000])
    ]
    if len(glas) < 4:
        raise RuntimeError(f"glasbedragen incompleet geparst: {glas}")

    return {
        "paginaGecontroleerdOp": controle.group(1) if controle else None,
        "maatregelenVanaf2025": maatregelen,
        "glasVanaf2025": glas,
        "glasMinM2": 3,
        "glasMaxM2": 45,
        "verdubbeling": "subsidiebedrag verdubbelt bij meer dan 1 maatregel (biobased-bonus niet)",
    }


def main() -> int:
    try:
        uitvoer = {
            "opgehaaldOp": f"{dt.date.today():%Y-%m-%d}",
            "bronnen": {
                "warmtepompen": "https://www.rvo.nl/subsidies-financiering/isde/meldcodelijsten/warmtepompen",
                "zonneboilers": "https://www.rvo.nl/subsidies-financiering/isde/meldcodelijsten/zonneboilers",
                "isolatie": ISOLATIE_URL,
            },
            "warmtepompenPerCategorie": per_categorie(haal_meldcodelijst(21, "warmtepompen")),
            "zonneboilersPerCategorie": per_categorie(haal_meldcodelijst(23, "zonneboilers")),
            "isolatie": haal_isolatie(),
        }
    except Exception as fout:  # bewust breed: elke fout = uitvoer ongemoeid laten
        print(f"FOUT: {fout}", file=sys.stderr)
        print(f"Bestaande uitvoer blijft staan: {UIT_PAD}", file=sys.stderr)
        return 1

    UIT_PAD.write_text(json.dumps(uitvoer, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Geschreven: {UIT_PAD}")
    print(json.dumps({k: uitvoer[k] for k in ("warmtepompenPerCategorie", "zonneboilersPerCategorie")}, ensure_ascii=False, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
