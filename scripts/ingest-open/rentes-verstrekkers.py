"""Hypotheekrentes per geldverstrekker (10/20 jaar vast) -> lib/bronnen/rentes-verstrekkers-snapshot.json

VERVERSEN (herdraaibaar, maandelijks, vanaf de repo-root):
    cd scripts/ingest-open
    python3 -m venv .venv && .venv/bin/pip install -r requirements.txt   # eenmalig
    .venv/bin/python -m playwright install chromium                       # eenmalig (of: crawl4ai-setup)
    .venv/bin/python rentes-verstrekkers.py

JURIDISCHE LIJN (niet onderhandelbaar, zie ook docs/RENTES-CRAWLER.md):
    - We crawlen UITSLUITEND de eigen websites van geldverstrekkers. Rentetarieven
      zijn feiten die de bank zelf publiceert. NOOIT aggregators of vergelijkers
      (Independer, hypotheekrente.nl e.d.): daar rust databankenrecht op.
    - robots.txt wordt per site opgehaald en gerespecteerd (token: WoneaRentesCrawler,
      valt vrijwel overal in de *-groep). Verbiedt robots.txt de pagina, dan slaan
      we de bank over.
    - 1 verzoek per pagina (plus 1 voor robots.txt), nette pauze ertussen. Geen
      omwegen achter logins of botmuren: blokkeert een site (zoals ING met een
      anti-bot-muur), dan ontbreekt die bank eerlijk in de snapshot.
    - We verzinnen NOOIT tarieven. Bij parse-twijfel of onwaarschijnlijke
      percentages (buiten 1-8%) wordt de hele bank overgeslagen, met reden.

HOE DIT WERKT:
    Elke bank publiceert de actuele tarieven op een eigen rentepagina, meestal als
    HTML-tabel per tariefklasse (NHG / loan-to-value-klassen). We laden de pagina
    in een echte headless browser (crawl4ai/Playwright, zelfde aanpak als
    dnb-rentes.py) omdat een deel van de banken de tabel client-side rendert.
    Per bank parsen we uit de gerenderde pagina de rijen 10 en 20 jaar vast:
    het NHG-tarief en het tarief in de hoogste reguliere tariefklasse zonder NHG
    (de klasse die een financiering rond 100% van de marktwaarde dekt). De exacte
    klasse en productcondities staan per rij in de opmerking.
    ABN AMRO rendert de tabel in een iframe op het eigen subdomein
    hypotheken.abnamro.nl; we laden dat iframe-adres direct (zelfde uitgever),
    de bronUrl voor bezoekers blijft de publiekspagina.

BEWUST OVERGESLAGEN (stand 2026-07-23):
    - ING: anti-bot-muur; kale én browser-requests krijgen een lege shell.
    - SNS: opgegaan in ASN Bank (snsbank.nl toont de ASN-rentetool).
    - ASN Bank: publiceert tarieven alleen als PDF-download + interactieve tool,
      geen parseerbare HTML-tabel.
    - Florius' hoofdproduct (Compleet Hypotheek) staat alleen in PDF-rentebladen;
      de Verduurzaam Hypotheek staat wel als HTML en nemen we mee, duidelijk
      gelabeld als apart product.

UITVOER:
    ../../lib/bronnen/rentes-verstrekkers-snapshot.json. Elke rij: verstrekker,
    product, rentevastJaren (10/20), nhg (ja/nee/onbekend), rentePct, bronUrl,
    peildatum (vandaag), opmerking. Mislukte banken staan onder "overgeslagen"
    met reden. Slaagt geen enkele bank, dan blijft de bestaande snapshot staan
    en eindigt het script met exit 1.
"""

from __future__ import annotations

import asyncio
import datetime as dt
import json
import re
import sys
import urllib.robotparser
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

from crawl4ai import AsyncWebCrawler, BrowserConfig, CacheMode, CrawlerRunConfig

SNAPSHOT_PAD = Path(__file__).resolve().parents[2] / "lib" / "bronnen" / "rentes-verstrekkers-snapshot.json"
ROBOTS_TOKEN = "WoneaRentesCrawler"
PAUZE_S = 2.0  # nette pauze tussen banken
MIN_PCT, MAX_PCT = 1.0, 8.0  # plausibiliteitsband; erbuiten = bank overslaan


class Overslaan(Exception):
    """Bank overslaan met een eerlijke reden (parse-twijfel, robots, botmuur)."""


@dataclass
class Rij:
    rentevastJaren: int
    nhg: str  # "ja" | "nee" | "onbekend"
    rentePct: float
    opmerking: str = ""


@dataclass
class Bank:
    naam: str
    fetch_url: str | None  # None = bewust niet ophalen (vaste reden)
    bron_url: str  # publiekspagina voor de bronvermelding in de UI
    parser: Callable[[str, str], tuple[str, list[Rij]]] | None = None  # (md, html) -> (product, rijen)
    vaste_reden: str = ""
    extra_delay_s: float = 8.0  # client-side tabellen hebben laadtijd nodig


# ---------------------------------------------------------------------------
# Parse-hulpjes
# ---------------------------------------------------------------------------

def pct(tekst: str) -> float | None:
    """'3,83%' of '3,88' -> 3.83 / 3.88; None als er geen percentage in staat."""
    m = re.search(r"(\d+),(\d+)\s*%?", tekst)
    return float(f"{m.group(1)}.{m.group(2)}") if m else None


def md_tabellen(md: str) -> list[list[list[str]]]:
    """Alle markdown-pijptabellen als lijst van rijen met gestripte cellen."""
    tabellen: list[list[list[str]]] = []
    huidige: list[list[str]] = []
    for regel in md.splitlines():
        r = regel.strip()
        if r.startswith("|") and "|" in r[1:]:
            cellen = [c.strip() for c in r.strip("|").split("|")]
            if all(set(c) <= set("-: ") for c in cellen):  # scheidingsregel |---|---|
                continue
            huidige.append(cellen)
        elif huidige:
            tabellen.append(huidige)
            huidige = []
    if huidige:
        tabellen.append(huidige)
    return tabellen


def vind_tabel(tabellen: list[list[list[str]]], kop_eisen: list[str]) -> list[list[str]]:
    """De eerste tabel waarvan de kopregel alle geeiste teksten bevat."""
    for tabel in tabellen:
        kop = " | ".join(tabel[0])
        if all(eis in kop for eis in kop_eisen):
            return tabel
    raise Overslaan(f"verwachte tabel met kop {kop_eisen} niet gevonden; paginastructuur veranderd?")


def rij_met_label(tabel: list[list[str]], label: str) -> list[str]:
    for rij in tabel[1:]:
        if rij and rij[0].strip().rstrip("*").strip() == label:
            return rij
    raise Overslaan(f"rij '{label}' niet gevonden in de rentetabel")


def kolom_index(tabel: list[list[str]], bevat: str) -> int:
    for i, cel in enumerate(tabel[0]):
        if bevat in cel:
            return i
    raise Overslaan(f"kolom met '{bevat}' niet gevonden in de tabelkop")


def matrix_rijen(
    tabel: list[list[str]],
    rijlabels: dict[int, str],
    zonder_nhg_kolom: str,
    opmerking_nhg: str,
    opmerking_zonder: str,
) -> list[Rij]:
    """Standaardpatroon: tabel met NHG-kolom + tariefklasse-kolommen, rijen per rentevaste periode."""
    idx_nhg = kolom_index(tabel, "NHG")
    idx_zonder = kolom_index(tabel, zonder_nhg_kolom)
    rijen: list[Rij] = []
    for jaren, label in rijlabels.items():
        cellen = rij_met_label(tabel, label)
        p_nhg, p_zonder = pct(cellen[idx_nhg]), pct(cellen[idx_zonder])
        if p_nhg is None or p_zonder is None:
            raise Overslaan(f"geen percentage in rij '{label}'")
        rijen.append(Rij(jaren, "ja", p_nhg, opmerking_nhg))
        rijen.append(Rij(jaren, "nee", p_zonder, opmerking_zonder))
    return rijen


def bank_tariefdatum(md: str, patroon: str) -> str:
    """Zoekt de tariefdatum die de bank zelf noemt; lege string als die er niet staat."""
    m = re.search(patroon, md)
    return m.group(1) if m else ""


# ---------------------------------------------------------------------------
# Parsers per bank: (markdown, html) -> (productnaam, rijen)
# ---------------------------------------------------------------------------

def parse_rabobank(md: str, html: str) -> tuple[str, list[Rij]]:
    tabel = vind_tabel(md_tabellen(md), ["Rentevaste periode", "NHG", "> 90,0%"])
    basis = "annuïteitenhypotheek, basisvoorwaarden, zonder betaalpakket- en duurzaamheidskorting"
    rijen = matrix_rijen(
        tabel,
        {10: "10 jaar", 20: "20 jaar"},
        zonder_nhg_kolom="> 90,0%",
        opmerking_nhg=basis,
        opmerking_zonder=f"tariefklasse boven 90% van de marktwaarde; {basis}",
    )
    datum = bank_tariefdatum(md, r"renteverlengingen vanaf (\d{1,2} \w+ \d{4})")
    if datum:
        for rij in rijen:
            rij.opmerking += f"; tarieven volgens de bank geldig vanaf {datum}"
    return "Annuïteitenhypotheek (basisvoorwaarden)", rijen


def parse_abn_amro(md: str, html: str) -> tuple[str, list[Rij]]:
    # De iframe-app toont standaard de Annuiteiten Budget Hypotheek MET huisbankkorting;
    # dat moet expliciet in de tekst staan, anders weten we niet wat de tabel toont.
    if not re.search(r"Annuïteiten Budget hypotheek\s+met huisbankkorting", md):
        raise Overslaan("standaardweergave (Annuïteiten Budget Hypotheek met huisbankkorting) niet bevestigd op de pagina")
    tabel = vind_tabel(md_tabellen(md), ["Rentevaste periode", "NHG", "> 90%"])
    korting = "Budget Hypotheek, annuïteiten; inclusief huisbankkorting van 0,20%, alleen met ABN AMRO-betaalrekening"
    rijen = matrix_rijen(
        tabel,
        {10: "10 jaar", 20: "20 jaar"},
        zonder_nhg_kolom="> 90%",
        opmerking_nhg=korting,
        opmerking_zonder=f"tariefklasse boven 90% van de marktwaarde; {korting}",
    )
    return "Budget Hypotheek, annuïteiten", rijen


def parse_obvion(md: str, html: str) -> tuple[str, list[Rij]]:
    if "Rentetarieven Woon Hypotheek" not in md:
        raise Overslaan("kop 'Rentetarieven Woon Hypotheek' niet gevonden")
    tabel = vind_tabel(md_tabellen(md), ["NHG", "Zonder NHG t/m 106% MW"])
    basis = "Woon Hypotheek, annuïtair, zonder duurzaamheidskorting"
    return "Woon Hypotheek, annuïtair", matrix_rijen(
        tabel,
        {10: "10 jaar", 20: "20 jaar"},
        zonder_nhg_kolom="Zonder NHG t/m 106% MW",
        opmerking_nhg=basis,
        opmerking_zonder=f"tariefklasse tot en met 106% van de marktwaarde; {basis}",
    )


def parse_asr(md: str, html: str) -> tuple[str, list[Rij]]:
    # De pagina heeft per hypotheekvorm een matrix met identieke kop; de eerste
    # hoort bij "ASR hypotheek: annuitair en lineair" (controleer die volgorde).
    posities = [md.find("ASR hypotheek: annuïtair en lineair"), md.find("| Rentevaste duur")]
    if -1 in posities or posities[0] > posities[1]:
        raise Overslaan("volgorde hypotheekvorm-tabs veranderd; eerste matrix is mogelijk niet de ASR hypotheek annuitair/lineair")
    tabel = vind_tabel(md_tabellen(md), ["Rentevaste duur", "NHG", ">95% MW"])
    rijen = matrix_rijen(
        tabel,
        {10: "≤ 10 jaar", 20: "≤ 20 jaar"},
        zonder_nhg_kolom=">95% MW",
        opmerking_nhg="ASR hypotheek, annuïtair en lineair",
        opmerking_zonder="tariefklasse boven 95% van de marktwaarde; ASR hypotheek, annuïtair en lineair",
    )
    datum = bank_tariefdatum(md, r"nieuwe hypotheken van a\.s\.r\. per (\d{1,2} \w+ \d{4})")
    if datum:
        for rij in rijen:
            rij.opmerking += f"; tarieven volgens de bank per {datum}"
    return "ASR hypotheek, annuïtair en lineair", rijen


def parse_munt(md: str, html: str) -> tuple[str, list[Rij]]:
    # Twee matrices met dezelfde kop (annuitair/lineair en aflossingsvrij); de
    # eerste hoort bij de sectie "## Annuitair / Lineair".
    posities = [md.find("## Annuïtair / Lineair"), md.find("| Periode")]
    if -1 in posities or posities[0] > posities[1]:
        raise Overslaan("sectievolgorde veranderd; eerste matrix is mogelijk niet annuitair/lineair")
    tabel = vind_tabel(md_tabellen(md), ["Periode", "NHG", ">90% MW"])
    basis = "annuïtair/lineair, offerterente (dagrente is 0,15% hoger)"
    rijen = matrix_rijen(
        tabel,
        {10: "10 jaar", 20: "20 jaar"},
        zonder_nhg_kolom=">90% MW",
        opmerking_nhg=basis,
        opmerking_zonder=f"tariefklasse boven 90% van de marktwaarde; {basis}",
    )
    datum = bank_tariefdatum(md, r"Tarieven per (\d{1,2} \w+ \d{4})")
    if datum:
        for rij in rijen:
            rij.opmerking += f"; tarieven volgens de bank per {datum}"
    return "MUNT Hypotheek, annuïtair/lineair", rijen


def parse_nn(md: str, html: str) -> tuple[str, list[Rij]]:
    # NN rendert de tabel client-side zonder <table>; in de markdown staan de
    # cellen als losse regels: kop (NHG, < 40%, < 70%, < 100%) en daarna per
    # rentevaste periode een label + 4 percentages. De standaard-hypotheekvorm
    # is "Annuiteiten / Lineaire Hypotheek" (default van de keuzelijst); dat
    # controleren we in de HTML, anders weten we niet welk product de tabel toont.
    if "Annuïteiten / Lineaire Hypotheek" not in html:
        raise Overslaan("standaard-hypotheekvorm (Annuïteiten / Lineaire Hypotheek) niet bevestigd in de pagina")
    regels = [r.strip() for r in md.splitlines() if r.strip()]
    try:
        start = regels.index("Rentevaste periode")
    except ValueError:
        raise Overslaan("tabelkop 'Rentevaste periode' niet gevonden") from None
    kop = regels[start + 1 : start + 5]
    if kop != ["NHG", "< 40%", "< 70%", "< 100%"]:
        raise Overslaan(f"onverwachte tariefklasse-kop {kop}; standaardweergave veranderd?")
    cellen = regels[start + 5 :]
    waardes: dict[str, list[float]] = {}
    i = 0
    while i + 4 < len(cellen) and not cellen[i].startswith("Toon alle"):
        label, vier = cellen[i], cellen[i + 1 : i + 5]
        percentages = [pct(v) for v in vier]
        if any(p is None for p in percentages):
            break  # einde van de tabel
        waardes[label] = [p for p in percentages if p is not None]
        i += 5
    rijen: list[Rij] = []
    for jaren, label in ((10, "10 jaar"), (20, "20 jaar")):
        if label not in waardes:
            raise Overslaan(f"rij '{label}' niet gevonden in de NN-tabel")
        nhg_pct, top_pct = waardes[label][0], waardes[label][3]
        rijen.append(Rij(jaren, "ja", nhg_pct, "Annuïteiten / Lineaire Hypotheek, bestaande bouw"))
        rijen.append(Rij(jaren, "nee", top_pct, "tariefklasse tot 100% van de marktwaarde; Annuïteiten / Lineaire Hypotheek, bestaande bouw"))
    return "Annuïteiten / Lineaire Hypotheek", rijen


def parse_florius(md: str, html: str) -> tuple[str, list[Rij]]:
    # Florius publiceert de hoofdproduct-tarieven alleen als PDF-rentebladen; de
    # enige HTML-tarieven zijn die van de Verduurzaam Hypotheek (zelfde rente met
    # en zonder NHG). Die nemen we mee, duidelijk gelabeld als apart product.
    sectie = re.search(r"Florius Verduurzaam Hypotheek(.{0,900}?)Dit zijn de rentes per (\w+ \d{1,2} \w+ \d{4})", md, re.S)
    if not sectie:
        raise Overslaan("sectie Verduurzaam Hypotheek met rentelijst niet gevonden")
    rijen: list[Rij] = []
    opmerking = (
        "Verduurzaam Hypotheek, alleen voor verduurzaming van de woning; "
        "rente is gelijk met en zonder NHG; "
        f"tarieven volgens de bank per {sectie.group(2)}"
    )
    for jaren in (10, 20):
        m = re.search(rf"Rentevastperiode {jaren} jaar:\s*([\d,]+)\s*%", sectie.group(1))
        if not m:
            raise Overslaan(f"rentevastperiode {jaren} jaar niet gevonden in de Verduurzaam-lijst")
        p = pct(m.group(1) + "%")
        if p is None:
            raise Overslaan(f"percentage onleesbaar voor {jaren} jaar")
        rijen.append(Rij(jaren, "ja", p, opmerking))
        rijen.append(Rij(jaren, "nee", p, opmerking))
    return "Verduurzaam Hypotheek", rijen


# ---------------------------------------------------------------------------
# Banken (kandidatenlijst; uitbreiden = entry toevoegen + parser schrijven)
# ---------------------------------------------------------------------------

BANKEN: list[Bank] = [
    Bank(
        naam="Rabobank",
        fetch_url="https://www.rabobank.nl/particulieren/hypotheek/hypotheekrente",
        bron_url="https://www.rabobank.nl/particulieren/hypotheek/hypotheekrente",
        parser=parse_rabobank,
    ),
    Bank(
        naam="ABN AMRO",
        # De publiekspagina rendert de tabel in een iframe op het eigen subdomein;
        # we laden dat iframe-adres direct (zelfde uitgever, zelfde inhoud).
        fetch_url="https://hypotheken.abnamro.nl/interest-rates/app/?lang=nl",
        bron_url="https://www.abnamro.nl/nl/prive/hypotheken/actuele-hypotheekrente/index.html",
        parser=parse_abn_amro,
    ),
    Bank(
        naam="Obvion",
        fetch_url="https://www.obvion.nl/rente",
        bron_url="https://www.obvion.nl/rente",
        parser=parse_obvion,
    ),
    Bank(
        naam="a.s.r.",
        fetch_url="https://www.asr.nl/hypotheek/hypotheekrente",
        bron_url="https://www.asr.nl/hypotheek/hypotheekrente",
        parser=parse_asr,
    ),
    Bank(
        naam="MUNT Hypotheken",
        fetch_url="https://www.munthypotheken.nl/rente/",
        bron_url="https://www.munthypotheken.nl/rente/",
        parser=parse_munt,
    ),
    Bank(
        naam="Nationale-Nederlanden",
        fetch_url="https://www.nn.nl/Particulier/Hypotheken/Hypotheekrente.htm",
        bron_url="https://www.nn.nl/Particulier/Hypotheken/Hypotheekrente.htm",
        parser=parse_nn,
        extra_delay_s=12.0,  # de NN-widget laadt traag
    ),
    Bank(
        naam="Florius",
        fetch_url="https://www.florius.nl/hypotheekrente",
        bron_url="https://www.florius.nl/hypotheekrente",
        parser=parse_florius,
    ),
    Bank(
        naam="ING",
        # Bewust geen fetch: de site levert ook aan een gewone (headless) browser een
        # lege shell (geverifieerd 2026-07-23). Een omweg om de botmuur bouwen we niet.
        fetch_url=None,
        bron_url="https://www.ing.nl/particulier/hypotheken/actuele-hypotheekrentes",
        vaste_reden="anti-bot-muur: de site levert ook aan een gewone browser een lege shell; geen omweg gebouwd",
    ),
    Bank(
        naam="SNS",
        fetch_url=None,
        bron_url="https://www.snsbank.nl/particulier/hypotheken/hypotheekrente.html",
        vaste_reden="SNS is opgegaan in ASN Bank; snsbank.nl toont alleen de interactieve ASN-rentetool, geen tabel",
    ),
    Bank(
        naam="ASN Bank",
        fetch_url=None,
        bron_url="https://www.asnbank.nl/hypotheek/hypotheekrentes/hypotheekrentes.html",
        vaste_reden="publiceert tarieven alleen als PDF-download en interactieve tool, geen parseerbare HTML-tabel",
    ),
]


# ---------------------------------------------------------------------------
# robots.txt en crawlen
# ---------------------------------------------------------------------------

@dataclass
class Uitkomst:
    gelukt: list[dict] = field(default_factory=list)
    overgeslagen: list[dict] = field(default_factory=list)


def tekst_uit_html(html: str) -> str:
    """Browserweergave van text/plain zit in <pre>; strip alle tags naar tekst."""
    pre = re.search(r"<pre[^>]*>(.*?)</pre>", html, re.S)
    kern = pre.group(1) if pre else html
    import html as html_mod

    return html_mod.unescape(re.sub(r"<[^>]+>", "\n", kern))


async def robots_staat_toe(crawler: AsyncWebCrawler, run: CrawlerRunConfig, url: str, cache: dict) -> tuple[bool, str]:
    """Haalt robots.txt van het domein (1x, gecachet) en toetst de pagina-URL."""
    from urllib.parse import urlparse

    domein = urlparse(url).netloc
    if domein not in cache:
        robots_url = f"https://{domein}/robots.txt"
        parser = urllib.robotparser.RobotFileParser()
        try:
            resultaat = await crawler.arun(url=robots_url, config=run)
            inhoud = tekst_uit_html(resultaat.html or "") if resultaat.success else ""
        except Exception:
            inhoud = ""
        if "user-agent" in inhoud.lower():
            parser.parse(inhoud.splitlines())
        else:
            parser.allow_all = True  # geen (leesbare) robots.txt = geen beperkingen
        cache[domein] = parser
    toegestaan = cache[domein].can_fetch(ROBOTS_TOKEN, url)
    return toegestaan, f"robots.txt van {urlparse(url).netloc} verbiedt deze pagina" if not toegestaan else ""


def valideer(bank: Bank, rijen: list[Rij]) -> None:
    if not rijen:
        raise Overslaan("parser leverde geen rijen op")
    for rij in rijen:
        if not MIN_PCT <= rij.rentePct <= MAX_PCT:
            raise Overslaan(f"onwaarschijnlijk percentage {rij.rentePct} voor {rij.rentevastJaren} jaar (buiten {MIN_PCT}-{MAX_PCT}%)")
    for jaren in (10, 20):
        if not any(r.rentevastJaren == jaren for r in rijen):
            raise Overslaan(f"rij voor {jaren} jaar ontbreekt")


async def crawl_alles() -> Uitkomst:
    vandaag = f"{dt.date.today():%Y-%m-%d}"
    uitkomst = Uitkomst()
    browser = BrowserConfig(headless=True, viewport_width=1400, viewport_height=1000)
    robots_cache: dict = {}
    robots_run = CrawlerRunConfig(cache_mode=CacheMode.BYPASS, wait_for_images=False, page_timeout=30000)

    async with AsyncWebCrawler(config=browser) as crawler:
        for bank in BANKEN:
            if bank.fetch_url is None or bank.parser is None:
                reden = bank.vaste_reden or "geen parser"
                uitkomst.overgeslagen.append({"verstrekker": bank.naam, "reden": reden})
                print(f"OVERGESLAGEN {bank.naam}: {reden}")
                continue
            try:
                toegestaan, reden = await robots_staat_toe(crawler, robots_run, bank.fetch_url, robots_cache)
                if not toegestaan:
                    raise Overslaan(reden)
                run = CrawlerRunConfig(
                    cache_mode=CacheMode.BYPASS,
                    wait_for_images=False,
                    page_timeout=90000,
                    delay_before_return_html=bank.extra_delay_s,
                )
                resultaat = await crawler.arun(url=bank.fetch_url, config=run)
                if not resultaat.success:
                    raise Overslaan(f"pagina laden mislukt: {resultaat.error_message}")
                md = resultaat.markdown.raw_markdown if resultaat.markdown else ""
                product, rijen = bank.parser(md, resultaat.html or "")
                valideer(bank, rijen)
                for rij in rijen:
                    uitkomst.gelukt.append(
                        {
                            "verstrekker": bank.naam,
                            "product": product,
                            "rentevastJaren": rij.rentevastJaren,
                            "nhg": rij.nhg,
                            "rentePct": rij.rentePct,
                            "bronUrl": bank.bron_url,
                            "peildatum": vandaag,
                            "opmerking": rij.opmerking,
                        }
                    )
                print(f"GELUKT {bank.naam}: {len(rijen)} rijen ({product})")
            except Overslaan as reden_exc:
                uitkomst.overgeslagen.append({"verstrekker": bank.naam, "reden": str(reden_exc)})
                print(f"OVERGESLAGEN {bank.naam}: {reden_exc}")
            except Exception as fout:  # onverwacht: ook overslaan, nooit halve data schrijven
                uitkomst.overgeslagen.append({"verstrekker": bank.naam, "reden": f"onverwachte fout: {fout}"})
                print(f"OVERGESLAGEN {bank.naam}: onverwachte fout: {fout}")
            await asyncio.sleep(PAUZE_S)
    return uitkomst


def main() -> int:
    uitkomst = asyncio.run(crawl_alles())
    banken_gelukt = sorted({r["verstrekker"] for r in uitkomst.gelukt})
    if not banken_gelukt:
        print("FOUT: geen enkele bank gelukt; bestaande snapshot blijft staan.", file=sys.stderr)
        return 1

    snapshot = {
        "opgehaaldOp": f"{dt.date.today():%Y-%m-%d}",
        "bron": "Rentetarieven zoals gepubliceerd op de eigen websites van de geldverstrekkers",
        "toelichting": (
            "Per verstrekker de actuele rente voor 10 en 20 jaar vast, met en zonder NHG, "
            "in de standaardweergave van de eigen rentepagina van de bank. Tarieven "
            "verschillen per tariefklasse, product en voorwaarden (zie opmerking per rij); "
            "controleer altijd de actuele tarieven bij de bank zelf."
        ),
        "rijen": uitkomst.gelukt,
        "overgeslagen": uitkomst.overgeslagen,
    }
    SNAPSHOT_PAD.parent.mkdir(parents=True, exist_ok=True)
    SNAPSHOT_PAD.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"\nSnapshot geschreven: {SNAPSHOT_PAD}")
    print(f"Gelukt: {', '.join(banken_gelukt)}")
    print(f"Overgeslagen: {len(uitkomst.overgeslagen)} bank(en)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
