"""Besparingskentallen (Milieu Centraal) -> besparing-raw.json

VERVERSEN (herdraaibaar, vanaf de repo-root):
    cd scripts/ingest-open
    python3 -m venv .venv && .venv/bin/pip install -r requirements.txt   # eenmalig
    .venv/bin/python milieucentraal-besparing.py
    # vergelijk daarna de uitvoer met lib/normen/besparing.ts en werk die bij
    # als kentallen zijn veranderd (de TS is de bron voor de app; dit script
    # is het meetinstrument).

HOE DIT WERKT:
    Milieu Centraal publiceert per maatregel indicatieve jaarlijkse besparingen
    voor gemiddelde woningen (per woningtype), gerekend met een langetermijn-
    gasprijs. Die staan als HTML-tabellen op de maatregelpagina's; een deel zit
    in de client-side data (Next.js) en wordt hier eerst ge-unescaped. Gewone
    requests volstaan (geen browser nodig; geverifieerd 2026-07-23).
    Per pagina parsen we de relevante besparingstabel(len) plus de datum
    "Laatst gewijzigd". Uitvoer: scripts/ingest-open/besparing-raw.json
    (gecommit als data-bestand). Bij elke fout blijft de bestaande uitvoer
    onaangeroerd (exit 1).

LET OP (eerlijkheid):
    Dit zijn INDICATIES voor een gemiddelde woning bij gemiddeld stookgedrag,
    gerekend met de langetermijn-gasprijs die Milieu Centraal hanteert
    (EUR 1,37 per m3, verwachting 2026-2040). De echte besparing hangt af van
    de woning, het gedrag en de actuele energieprijzen. De UI moet dat erbij
    zeggen (lib/normen/besparing.ts doet dat).
"""

from __future__ import annotations

import datetime as dt
import html as html_mod
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

BASIS = "https://www.milieucentraal.nl"
PAGINAS = {
    "spouwmuurisolatie": "/energie-besparen/isoleren-en-besparen/spouwmuurisolatie/",
    "dakisolatie": "/energie-besparen/isoleren-en-besparen/dakisolatie/",
    "vloerisolatie": "/energie-besparen/isoleren-en-besparen/vloerisolatie/",
    "glasisolatie": "/energie-besparen/isoleren-en-besparen/dubbel-glas-hr-glas-en-triple-glas/",
    "hybride_warmtepomp": "/energie-besparen/duurzaam-verwarmen-en-koelen/hybride-warmtepomp/",
    "volledige_warmtepomp": "/energie-besparen/duurzaam-verwarmen-en-koelen/volledig-elektrische-warmtepomp/",
    "zonneboiler": "/energie-besparen/duurzaam-warm-water/zonneboiler/",
    "zonnepanelen": "/energie-besparen/zonnepanelen/kosten-en-opbrengst-zonnepanelen/",
}
UIT_PAD = Path(__file__).resolve().parent / "besparing-raw.json"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0 Safari/537.36"
DELAY_S = 1.0  # nette burger


def fetch(url: str) -> str:
    verzoek = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html"})
    with urllib.request.urlopen(verzoek, timeout=30) as antwoord:
        return antwoord.read().decode("utf-8", errors="replace")


def flatten(raw: str) -> str:
    """Decodeert de escaped Next.js-data zodat ook client-side tabellen als <table> zichtbaar worden."""
    return raw.replace("\\u003c", "<").replace("\\u003e", ">").replace("\\u20ac", "€").replace('\\"', '"')


def parse_tabellen(flat: str) -> list[dict]:
    """Alle tabellen als {titel, cellen, positie}; titel = dichtstbijzijnde CMS-titel ervoor. Gededuped."""
    tabellen: list[dict] = []
    gezien: set[str] = set()
    for m in re.finditer(r"<table.*?</table>", flat, re.S):
        cellen = [
            re.sub(r"\s+", " ", html_mod.unescape(re.sub(r"<[^>]+>", " ", c))).replace("\xa0", " ").strip()
            for c in re.findall(r"<t[hd][^>]*>.*?</t[hd]>", m.group(0), re.S)
        ]
        sleutel = "|".join(cellen)
        if not cellen or sleutel in gezien:
            continue
        gezien.add(sleutel)
        context = flat[max(0, m.start() - 6000) : m.start()]
        titels = re.findall(r'"title":"([^"]{5,90})"', context)
        # de dichtstbijzijnde accordeon-titel die over besparing gaat, anders de laatste titel
        besparingstitels = [t for t in titels if t.lower().startswith("bespar")]
        titel = besparingstitels[-1] if besparingstitels else (titels[-1] if titels else None)
        tabellen.append({"titel": titel, "cellen": cellen, "positie": m.start()})
    return tabellen


def euro(tekst: str) -> int | None:
    m = re.search(r"€\s*([\d.]+)", tekst)
    return int(m.group(1).replace(".", "")) if m else None


def m3(tekst: str) -> int | None:
    m = re.search(r"([\d.]+)\s*m3", tekst)
    return int(m.group(1).replace(".", "")) if m else None


def rijen_per_type(cellen: list[str], kolommen: int = 3) -> list[dict]:
    """['Soort woning', kop2, kop3, 'Tussenwoning', '180 m3', '€ 240', ...] -> rijen."""
    rijen = []
    for i in range(kolommen, len(cellen) - kolommen + 1, kolommen):
        naam = cellen[i]
        rijen.append({"woningtype": naam, "gasM3PerJaar": m3(cellen[i + 1]), "eurPerJaar": euro(cellen[i + 2])})
    return rijen


def besparingstabel(tabellen: list[dict]) -> list[dict] | None:
    for t in tabellen:
        if t["cellen"][0] == "Soort woning" and "Besparing gas per jaar" in " ".join(t["cellen"][:3]):
            return rijen_per_type(t["cellen"])
    return None


def laatst_gewijzigd(flat: str) -> str | None:
    tekst = re.sub(r"\s+", " ", html_mod.unescape(re.sub(r"<[^>]+>", " ", flat)))
    m = re.search(r"Laatst gewijzigd: (\d{1,2} \w+ \d{4})", tekst)
    return m.group(1) if m else None


def haal_pagina(sleutel: str, pad: str) -> dict:
    flat = flatten(fetch(BASIS + pad))
    tabellen = parse_tabellen(flat)
    uit: dict = {"url": BASIS + pad, "laatstGewijzigd": laatst_gewijzigd(flat)}

    if sleutel in ("spouwmuurisolatie", "dakisolatie", "vloerisolatie"):
        uit["besparingPerWoningtype"] = besparingstabel(tabellen)
        if not uit["besparingPerWoningtype"]:
            raise RuntimeError(f"{sleutel}: besparingstabel niet gevonden")

    elif sleutel == "glasisolatie":
        # De pagina heeft 2 secties (hr++-glas, daarna tripleglas), elk met een
        # kostentabel en 2 hele-huis-besparingstabellen (vanaf dubbelglas en
        # vanaf enkelglas). De accordeon-titels staan in de CMS-data niet
        # betrouwbaar direct voor hun tabel; daarom duiden we structureel:
        # sectiegrens = de 2e kostentabel, en binnen een sectie bespaart de
        # enkelglas-variant per definitie meer dan de dubbelglas-variant.
        kosten_posities = [
            t["positie"] for t in tabellen if t["cellen"][0] == "Soort woning" and "Kosten" in " ".join(t["cellen"][:4])
        ]
        besparing = [
            t for t in tabellen if t["cellen"][0] == "Soort woning" and "Besparing gas per jaar" in " ".join(t["cellen"][:3])
        ]
        if len(kosten_posities) != 2 or len(besparing) != 4:
            raise RuntimeError(
                f"glasisolatie: verwachtte 2 kostentabellen en 4 besparingstabellen, vond {len(kosten_posities)} en {len(besparing)}; paginastructuur veranderd?"
            )
        grens = kosten_posities[1]
        varianten = []
        for naar, sectie in (("hr++-glas", [t for t in besparing if t["positie"] < grens]), ("tripleglas in nieuwe kozijnen", [t for t in besparing if t["positie"] >= grens])):
            if len(sectie) != 2:
                raise RuntimeError(f"glasisolatie: sectie '{naar}' heeft {len(sectie)} tabellen i.p.v. 2")
            klein, groot = sorted(sectie, key=lambda t: rijen_per_type(t["cellen"])[0]["gasM3PerJaar"] or 0)
            varianten.append({"duiding": f"heel huis van dubbelglas naar {naar}", "titelIndicatie": klein["titel"], "besparingPerWoningtype": rijen_per_type(klein["cellen"])})
            varianten.append({"duiding": f"heel huis van enkelglas naar {naar}", "titelIndicatie": groot["titel"], "besparingPerWoningtype": rijen_per_type(groot["cellen"])})
        uit["varianten"] = varianten
        # Per-m2-kental t.o.v. enkelglas (staat als tekst-tabel in de CMS-data).
        m = re.findall(
            r"(Vacuümglas|Tripleglas|Hr\+\+-glas|Dubbelglas)[^<]{0,80}?(\d+)\s*m3",
            re.sub(r"\s+", " ", html_mod.unescape(re.sub(r"<[^>]+>", " ", flat)).replace("\xa0", " ")),
        )
        uit["besparingPerM2RaamTovEnkelglas"] = [{"glassoort": g, "gasM3PerM2PerJaar": int(v)} for g, v in dict(m).items()]
        if not varianten:
            raise RuntimeError("glasisolatie: geen besparingstabellen gevonden")

    elif sleutel in ("hybride_warmtepomp", "volledige_warmtepomp"):
        for t in tabellen:
            for i, cel in enumerate(t["cellen"]):
                if cel.startswith("Besparing per jaar met"):
                    bedrag = next((euro(c) for c in t["cellen"][i + 1 :] if euro(c)), None)
                    uit["besparingEurPerJaar"] = bedrag
                    uit["vergelijking"] = t["cellen"]
        if "besparingEurPerJaar" not in uit or not uit["besparingEurPerJaar"]:
            raise RuntimeError(f"{sleutel}: besparingsregel niet gevonden")

    elif sleutel == "zonneboiler":
        for t in tabellen:
            if t["cellen"][0] == "Aantal personen" and "Besparing" in " ".join(t["cellen"][:3]):
                uit["besparingPerHuishouden"] = [
                    {"personen": int(t["cellen"][i]), "gasM3PerJaar": m3(t["cellen"][i + 1]), "eurPerJaar": euro(t["cellen"][i + 2])}
                    for i in range(3, len(t["cellen"]) - 2, 3)
                    if t["cellen"][i].isdigit()
                ]
        if not uit.get("besparingPerHuishouden"):
            raise RuntimeError("zonneboiler: besparingstabel niet gevonden")

    elif sleutel == "zonnepanelen":
        for t in tabellen:
            if t["cellen"][0] == "Aantal panelen" and "Besparing per jaar" in " ".join(t["cellen"][:4]):
                uit["besparingPerAantalPanelen"] = [
                    {
                        "panelen": int(t["cellen"][i]),
                        "aanschafEur": euro(t["cellen"][i + 1]),
                        "eurPerJaar2026": euro(t["cellen"][i + 2]),
                        "eurPerJaarVanaf2027": euro(t["cellen"][i + 3]),
                    }
                    for i in range(4, len(t["cellen"]) - 3, 4)
                    if t["cellen"][i].isdigit()
                ]
        if not uit.get("besparingPerAantalPanelen"):
            raise RuntimeError("zonnepanelen: besparingstabel niet gevonden")

    return uit


def main() -> int:
    try:
        paginas = {}
        for sleutel, pad in PAGINAS.items():
            paginas[sleutel] = haal_pagina(sleutel, pad)
            print(f"{sleutel}: ok ({paginas[sleutel].get('laatstGewijzigd')})")
            time.sleep(DELAY_S)
        uitvoer = {
            "opgehaaldOp": f"{dt.date.today():%Y-%m-%d}",
            "bron": "Milieu Centraal",
            "gasprijsBasis": "€ 1,37 per m3 (verwachte gemiddelde gasprijs 2026-2040, Milieu Centraal)",
            "paginas": paginas,
        }
    except Exception as fout:  # bewust breed: elke fout = uitvoer ongemoeid laten
        print(f"FOUT: {fout}", file=sys.stderr)
        print(f"Bestaande uitvoer blijft staan: {UIT_PAD}", file=sys.stderr)
        return 1

    UIT_PAD.write_text(json.dumps(uitvoer, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Geschreven: {UIT_PAD}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
