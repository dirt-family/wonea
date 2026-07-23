"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Woningtype } from "@/db/schema";
import {
  GerelateerdeRekenhulpen,
  RekenModule,
  RekenmoduleSamenvatting,
  type SamenvattingRij,
  type StapDefinitie,
} from "@/components/rekenmodule";
import {
  BronLabel,
  EnergieLabelBadge,
  FeitenLijst,
  inputClass,
  LeadCta,
  SectieLabel,
  StatTegel,
  UitklapUitleg,
  UitkomstKaart,
  Veld,
} from "@/components/ui";
import { formatDatumNl, formatEuro } from "@/lib/format";
import { BESPARING_DISCLAIMER, BESPARING_PEILDATUM } from "@/lib/normen/besparing";
import { VERDUURZAMING_BEDRAG_BUITEN_BESCHOUWING } from "@/lib/normen/leennormen-2026";
import { ISDE_PEILDATUM, ISDE_VERDUBBELING_UITLEG } from "@/lib/normen/isde-2026";
import {
  ADVIES_GROEPEN,
  extraLeenruimteBijLabel,
  formatEuroBereik,
  formatTerugverdientijd,
  LEENNORMEN_BRON,
  LEENNORMEN_PEILDATUM,
  maakMaatregelAdviezen,
  type Bron,
  type MaatregelAdvies,
  type MaatregelKey,
} from "@/app/verduurzamen/advies/advies";
import { maakTotaalplan, type Totaalplan } from "@/app/verduurzamen/berekening";
import { PARTIJ_TYPE, VERTICALEN, type Verticaal } from "@/app/verduurzamen/verticalen";

/**
 * Verduurzamings-totaalplan op het rekenmodule-framework. Drie invoerstappen
 * (jouw woning, huidige situatie, maatregelen kiezen) en een uitkomst met
 * besparing per jaar, ISDE-subsidie, netto-investering, terugverdientijd en
 * de extra leenruimte uit de leennormen. Deze laag is een UI-schil: alle
 * cijfers komen uit lib/normen/* via advies.ts, de optelling uit
 * app/verduurzamen/berekening.ts.
 *
 * Het adres-pad (echt energielabel via EP-Online, woningtype en bouwjaar uit
 * de adresdata) loopt via de serverpagina; zonder adres kiest de bezoeker
 * zelf woningtype en bouwjaar. Er wordt niets verstuurd: de funnel-aanvraag
 * is een aparte, bestaande flow (/verduurzamen/[verticaal]).
 */

export type AdresContext = {
  naam: string;
  postcode: string;
  nummerslug: string;
  woningtype: Woningtype;
  bouwjaar: number;
  /** Huidig energielabel, bv. "C" of "A++"; null als er niets bekend is. */
  label: string | null;
  /** true = geregistreerd label (EP-Online/RVO), false = bouwjaar-indicatie. */
  labelEcht: boolean;
  /** Bronomschrijving voor bij het label, klaar voor weergave. */
  labelBron: string;
};

const WONINGTYPEN: { waarde: Woningtype; label: string }[] = [
  { waarde: "appartement", label: "Appartement" },
  { waarde: "tussenwoning", label: "Tussenwoning" },
  { waarde: "hoekwoning", label: "Hoekwoning" },
  { waarde: "twee-onder-een-kap", label: "Twee-onder-een-kapwoning" },
  { waarde: "vrijstaand", label: "Vrijstaande woning" },
];

const LABEL_LETTERS = ["A", "B", "C", "D", "E", "F", "G"] as const;

// Dezelfde vragen en antwoordopties als de bestaande funnel-stepper
// (app/verduurzamen/verticalen.ts), zodat beide flows exact gelijk vragen.
const VERWARMING_VRAAG = VERTICALEN.warmtepomp.vragen.find((v) => v.naam === "huidigeVerwarming")!;
const ISOLATIEGRAAD_VRAAG = VERTICALEN.warmtepomp.vragen.find((v) => v.naam === "isolatiegraad")!;

const radioCls = "flex cursor-pointer items-center gap-3 rounded-lg border border-lijn bg-paneel px-4 py-3 text-sm text-inkt transition-colors hover:border-merk";
const chipCls = "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors";
// Zelfde token-klassen als KnopSecundair; ui.tsx kent geen onClick-variant
// (zelfde precedent als de budget-stepper en het frame zelf).
const knopSecundairCls =
  "inline-flex items-center justify-center rounded-full border border-lijn bg-paneel px-6 py-3 text-sm font-semibold text-merk transition-colors hover:border-merk focus:outline-2 focus:outline-offset-2 focus:outline-merk";

/** CTA-teksten per funnel-verticaal; de ontvanger komt letterlijk uit de funnelconfig. */
const CTA_PER_VERTICAAL: Record<Verticaal, { titel: string; tekst: string; knopTekst: string }> = {
  isolatie: {
    titel: "Isolatie laten uitvoeren?",
    tekst:
      "Een paar korte vragen over je huis en je vraagt vrijblijvend een voorstel aan. In de laatste stap zie je precies wat we doorgeven, en dat gebeurt alleen met jouw toestemming.",
    knopTekst: "Start de isolatie-aanvraag",
  },
  warmtepomp: {
    titel: "Warmtepomp of zonneboiler laten adviseren?",
    tekst:
      "Een paar korte vragen en je vraagt vrijblijvend een voorstel aan; de installateur adviseert ook over een zonneboiler. In de laatste stap zie je precies wat we doorgeven.",
    knopTekst: "Start de warmtepomp-aanvraag",
  },
  zonnepanelen: {
    titel: "Zonnepanelen laten leggen?",
    tekst:
      "Een paar korte vragen over je dak en je vraagt vrijblijvend een voorstel aan. In de laatste stap zie je precies wat we doorgeven, en dat gebeurt alleen met jouw toestemming.",
    knopTekst: "Start de zonnepanelen-aanvraag",
  },
};

/** Korte bronnamen bij een maatregel: "RVO en Milieu Centraal". */
function bronNamen(bronnen: Bron[]): string {
  const namen = [...new Set(bronnen.map((b) => b.label.split(":")[0]!.trim()))];
  return namen.join(" en ");
}

function titelsVan(adviezen: MaatregelAdvies[], keys: MaatregelKey[]): string {
  return adviezen
    .filter((a) => keys.includes(a.key))
    .map((a) => a.titel.toLowerCase())
    .join(", ");
}

export function PlanStepper({
  adres,
  adresNietGevonden = false,
  initPostcode = "",
  initNummer = "",
}: {
  adres: AdresContext | null;
  /** true als er met postcode en nummer is gezocht maar niets is gevonden. */
  adresNietGevonden?: boolean;
  initPostcode?: string;
  initNummer?: string;
}) {
  // Stap 1: jouw woning (adres uit de serverpagina, of zelf kiezen).
  const [postcodeInput, setPostcodeInput] = useState(initPostcode);
  const [nummerInput, setNummerInput] = useState(initNummer);
  const [zoekFout, setZoekFout] = useState<string | null>(null);
  const [woningtype, setWoningtype] = useState<Woningtype | "">("");
  const [bouwjaar, setBouwjaar] = useState("");

  // Stap 2: huidige situatie.
  const [huidigLabel, setHuidigLabel] = useState<string>(() =>
    adres && !adres.labelEcht && adres.label && /^[A-G]$/.test(adres.label) ? adres.label : "",
  );
  const [verwarming, setVerwarming] = useState("");
  const [isolatiegraad, setIsolatiegraad] = useState("");

  // Stap 3: maatregelen.
  const [gekozen, setGekozen] = useState<MaatregelKey[]>([]);

  const effWoningtype: Woningtype = adres ? adres.woningtype : woningtype || "tussenwoning";
  const adviezen = useMemo(() => maakMaatregelAdviezen(effWoningtype), [effWoningtype]);
  const alleKeys = useMemo(() => adviezen.map((a) => a.key), [adviezen]);

  const maxJaar = new Date().getFullYear() + 1;

  /** Het label waarmee we de extra leenruimte bepalen; null = onbekend. */
  const effLabel: string | null = adres?.labelEcht
    ? adres.label
    : (LABEL_LETTERS as readonly string[]).includes(huidigLabel)
      ? huidigLabel
      : null;

  function haalWoningOp() {
    const pc = postcodeInput.trim();
    const nr = nummerInput.trim();
    if (!pc || !nr) {
      setZoekFout("Vul postcode en huisnummer in om je woning op te halen.");
      return;
    }
    window.location.assign(`/verduurzamen/advies?postcode=${encodeURIComponent(pc)}&nummer=${encodeURIComponent(nr)}`);
  }

  function toggleMaatregel(key: MaatregelKey) {
    setGekozen((huidig) => (huidig.includes(key) ? huidig.filter((k) => k !== key) : [...huidig, key]));
  }

  function valideerWoning(): string | null {
    if (adres) return null;
    if (!woningtype) return "Kies je woningtype, of haal je woning op via je adres.";
    const jaar = Number(bouwjaar.trim());
    if (!/^\d{4}$/.test(bouwjaar.trim()) || jaar < 1500 || jaar > maxJaar) {
      return "Vul het bouwjaar in met 4 cijfers, bijvoorbeeld 1985.";
    }
    return null;
  }

  function valideerSituatie(): string | null {
    if (!adres?.labelEcht && huidigLabel === "") {
      return "Kies het energielabel van je woning. Weet ik niet is ook een antwoord.";
    }
    if (!verwarming) return "Kies hoe je nu verwarmt.";
    if (!isolatiegraad) return "Geef aan hoe goed je huis geïsoleerd is. Weet ik niet is ook een antwoord.";
    return null;
  }

  function valideerMaatregelen(): string | null {
    return gekozen.length > 0 ? null : "Kies minstens 1 maatregel om het totaalplan te berekenen.";
  }

  /** Herstel uit sessionStorage: elk veld eerst op type en waarde controleren. */
  function herstel(data: Record<string, unknown>) {
    if (typeof data.woningtype === "string" && WONINGTYPEN.some((w) => w.waarde === data.woningtype)) {
      setWoningtype(data.woningtype as Woningtype);
    }
    if (typeof data.bouwjaar === "string") setBouwjaar(data.bouwjaar);
    if (
      typeof data.huidigLabel === "string" &&
      (data.huidigLabel === "" || data.huidigLabel === "weet-niet" || (LABEL_LETTERS as readonly string[]).includes(data.huidigLabel))
    ) {
      setHuidigLabel(data.huidigLabel);
    }
    if (typeof data.verwarming === "string" && (VERWARMING_VRAAG.opties ?? []).some((o) => o.waarde === data.verwarming)) {
      setVerwarming(data.verwarming);
    }
    if (typeof data.isolatiegraad === "string" && (ISOLATIEGRAAD_VRAAG.opties ?? []).some((o) => o.waarde === data.isolatiegraad)) {
      setIsolatiegraad(data.isolatiegraad);
    }
    if (Array.isArray(data.gekozen)) {
      const geldig = data.gekozen.filter((k): k is MaatregelKey => typeof k === "string" && (alleKeys as string[]).includes(k));
      setGekozen(geldig);
    }
  }

  const stappen: StapDefinitie[] = [
    {
      id: "woning",
      titel: "Jouw woning",
      vraag: "Over welke woning gaat het?",
      valideer: valideerWoning,
      inhoud: adres ? (
        <>
          <FeitenLijst
            feiten={[
              ["Adres", adres.naam],
              ["Woningtype", WONINGTYPEN.find((w) => w.waarde === adres.woningtype)?.label ?? adres.woningtype],
              ["Bouwjaar", String(adres.bouwjaar)],
            ]}
          />
          <div className="flex flex-wrap items-center gap-3">
            {adres.label ? <EnergieLabelBadge label={adres.label} /> : null}
            <BronLabel>{adres.labelBron}</BronLabel>
          </div>
          <p className="text-sm leading-relaxed text-inkt-zacht">
            Klopt dit niet, of wil je voor een andere woning rekenen?{" "}
            <Link href="/verduurzamen/advies" className="font-semibold text-merk underline underline-offset-2">
              Ander adres kiezen of zonder adres verdergaan
            </Link>
            .
          </p>
        </>
      ) : (
        <>
          {adresNietGevonden ? (
            <p role="alert" className="rounded-lg border border-negatief/30 bg-negatief/5 px-4 py-3 text-sm text-negatief">
              Dit adres staat niet (meer) op Wonea. Controleer de postcode en het huisnummer, of ga verder zonder adres.
            </p>
          ) : null}
          <p className="text-sm leading-relaxed text-inkt-zacht">
            Met je adres halen we het energielabel, het woningtype en het bouwjaar voor je op. Dat mag, maar het hoeft
            niet: kies anders hieronder zelf je woningtype en bouwjaar.
          </p>
          <div className="grid gap-5 sm:grid-cols-2">
            <Veld label="Postcode">
              <input
                value={postcodeInput}
                onChange={(e) => setPostcodeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    haalWoningOp();
                  }
                }}
                placeholder="1234 AB"
                autoComplete="postal-code"
                className={inputClass}
              />
            </Veld>
            <Veld label="Huisnummer" hint="Met toevoeging, bv. 12a of 12-2">
              <input
                value={nummerInput}
                onChange={(e) => setNummerInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    haalWoningOp();
                  }
                }}
                placeholder="12"
                className={inputClass}
              />
            </Veld>
          </div>
          {zoekFout ? (
            <p role="alert" className="text-sm text-negatief">
              {zoekFout}
            </p>
          ) : null}
          <div>
            <button type="button" onClick={haalWoningOp} className={knopSecundairCls}>
              Haal mijn woning op
            </button>
          </div>
          <fieldset className="border-t border-lijn pt-5">
            <legend className="float-left mb-2 block w-full text-sm font-medium text-inkt">
              Liever zonder adres? Kies je woningtype:
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {WONINGTYPEN.map((w) => (
                <label key={w.waarde} className={radioCls}>
                  <input
                    type="radio"
                    name="woningtype_keuze"
                    value={w.waarde}
                    checked={woningtype === w.waarde}
                    onChange={() => setWoningtype(w.waarde)}
                    className="accent-merk"
                  />
                  {w.label}
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-gedempt">
              Voor een appartement geeft Milieu Centraal geen besparingskentallen; je ziet dan eerlijk minder cijfers.
            </p>
          </fieldset>
          <div className="max-w-[12rem]">
            <Veld label="Bouwjaar" hint="4 cijfers, bijvoorbeeld 1985.">
              <input
                type="text"
                inputMode="numeric"
                placeholder="1985"
                value={bouwjaar}
                onChange={(e) => setBouwjaar(e.target.value)}
                className={inputClass}
              />
            </Veld>
          </div>
        </>
      ),
    },
    {
      id: "situatie",
      titel: "Situatie",
      vraag: "Wat is de huidige situatie?",
      valideer: valideerSituatie,
      inhoud: (
        <>
          {adres?.labelEcht ? (
            <div className="flex flex-wrap items-center gap-3">
              {adres.label ? <EnergieLabelBadge label={adres.label} /> : null}
              <div>
                <BronLabel>{adres.labelBron}</BronLabel>
                <p className="mt-1 text-xs text-gedempt">
                  Dit geregistreerde label gebruiken we voor de extra leenruimte in het totaalplan.
                </p>
              </div>
            </div>
          ) : (
            <fieldset>
              <legend className="mb-2 block text-sm font-medium text-inkt">Wat is het energielabel van je woning?</legend>
              <div className="flex flex-wrap gap-2">
                {LABEL_LETTERS.map((letter) => {
                  const actief = huidigLabel === letter;
                  return (
                    <label key={letter} className={`${chipCls} ${actief ? "border-merk bg-merk-wash" : "border-lijn bg-paneel hover:border-merk"}`}>
                      <input
                        type="radio"
                        name="label_keuze"
                        value={letter}
                        checked={actief}
                        onChange={() => setHuidigLabel(letter)}
                        className="accent-merk"
                      />
                      {letter}
                    </label>
                  );
                })}
                <label className={`${chipCls} ${huidigLabel === "weet-niet" ? "border-merk bg-merk-wash" : "border-lijn bg-paneel hover:border-merk"}`}>
                  <input
                    type="radio"
                    name="label_keuze"
                    value="weet-niet"
                    checked={huidigLabel === "weet-niet"}
                    onChange={() => setHuidigLabel("weet-niet")}
                    className="accent-merk"
                  />
                  Weet ik niet
                </label>
              </div>
              <p className="mt-2 text-xs text-gedempt">
                {adres && !adres.labelEcht && adres.label
                  ? `Vooringevuld met de indicatie op basis van bouwjaar ${adres.bouwjaar}; pas aan als je het echte label kent.`
                  : "Het label staat op je energierekening of in het koopcontract; zonder label rekenen we de extra leenruimte niet."}
              </p>
            </fieldset>
          )}
          <fieldset>
            <legend className="mb-2 block text-sm font-medium text-inkt">{VERWARMING_VRAAG.label}</legend>
            <div className="space-y-2">
              {(VERWARMING_VRAAG.opties ?? []).map((o) => (
                <label key={o.waarde} className={radioCls}>
                  <input
                    type="radio"
                    name="verwarming_keuze"
                    value={o.waarde}
                    checked={verwarming === o.waarde}
                    onChange={() => setVerwarming(o.waarde)}
                    className="accent-merk"
                  />
                  {o.label}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 block text-sm font-medium text-inkt">{ISOLATIEGRAAD_VRAAG.label}</legend>
            <div className="space-y-2">
              {(ISOLATIEGRAAD_VRAAG.opties ?? []).map((o) => (
                <label key={o.waarde} className={radioCls}>
                  <input
                    type="radio"
                    name="isolatiegraad_keuze"
                    value={o.waarde}
                    checked={isolatiegraad === o.waarde}
                    onChange={() => setIsolatiegraad(o.waarde)}
                    className="accent-merk"
                  />
                  {o.label}
                </label>
              ))}
            </div>
            {ISOLATIEGRAAD_VRAAG.hint ? <p className="mt-2 text-xs text-gedempt">{ISOLATIEGRAAD_VRAAG.hint}</p> : null}
          </fieldset>
        </>
      ),
    },
    {
      id: "maatregelen",
      titel: "Maatregelen",
      vraag: "Welke maatregelen overweeg je?",
      valideer: valideerMaatregelen,
      inhoud: (
        <>
          <p className="text-sm leading-relaxed text-inkt-zacht">
            Meerdere antwoorden mogelijk. De bedragen zijn indicaties voor een{" "}
            {WONINGTYPEN.find((w) => w.waarde === effWoningtype)?.label.toLowerCase() ?? effWoningtype}, geen offerte.
          </p>
          <div className="space-y-2">
            {adviezen.map((a) => {
              const actief = gekozen.includes(a.key);
              const waarschuwingen: string[] = [];
              if (a.key === "warmtepomp") {
                if (isolatiegraad === "matig" || isolatiegraad === "weet-niet") {
                  waarschuwingen.push("Let op: een warmtepomp werkt pas comfortabel in een redelijk geïsoleerd huis.");
                }
                if (verwarming === "hybride-warmtepomp" || verwarming === "volledig-elektrisch") {
                  waarschuwingen.push("Je verwarmt al (deels) elektrisch; dit kental gaat uit van een woning met hr-ketel.");
                }
              }
              return (
                <label
                  key={a.key}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 transition-colors ${
                    actief ? "border-merk bg-merk-wash" : "border-lijn bg-paneel hover:border-merk"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={actief}
                    onChange={() => toggleMaatregel(a.key)}
                    className="mt-1 accent-merk"
                  />
                  <span className="flex flex-1 flex-col gap-1">
                    <span className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <span className="text-sm font-semibold text-inkt">{a.titel}</span>
                      <span className="text-sm tabular-nums text-inkt-zacht">
                        {a.besparing ? `bespaart ${formatEuroBereik(a.besparing.bereik)} per jaar` : "geen besparingskental"}
                      </span>
                    </span>
                    <span className="text-xs text-gedempt">
                      {a.subsidie ? `ISDE 2026: ${formatEuro(a.subsidie.bedrag)} (indicatie)` : "geen ISDE-subsidie"}
                      {" · bron: "}
                      {bronNamen(a.bronnen)}
                    </span>
                    {waarschuwingen.map((w) => (
                      <span key={w} className="text-xs leading-relaxed text-inkt-zacht">
                        {w}
                      </span>
                    ))}
                  </span>
                </label>
              );
            })}
          </div>
          <p className="text-xs leading-relaxed text-gedempt">
            Kies je 2 of meer maatregelen, dan verdubbelt het ISDE-bedrag per m2 voor dak-, spouwmuur- en vloerisolatie;
            dat zie je terug in het totaalplan. Subsidie: RVO, peildatum {formatDatumNl(ISDE_PEILDATUM)}. Besparing:
            Milieu Centraal, opgehaald {formatDatumNl(BESPARING_PEILDATUM)}.
          </p>
        </>
      ),
    },
  ];

  return (
    <RekenModule
      moduleId="verduurzamen-plan"
      stappen={stappen}
      uitkomstTitel="Totaalplan"
      uitkomstKnopTekst="Bekijk je totaalplan"
      sessie={{
        snapshot: () => ({ woningtype, bouwjaar, huidigLabel, verwarming, isolatiegraad, gekozen }),
        herstel,
      }}
      uitkomst={(api) => (
        <Uitkomst
          plan={maakTotaalplan(adviezen, gekozen)}
          adviezen={adviezen}
          adres={adres}
          effLabel={effLabel}
          woningRegel={
            adres
              ? adres.naam
              : `${WONINGTYPEN.find((w) => w.waarde === woningtype)?.label ?? "woning"}, bouwjaar ${bouwjaar.trim()}`
          }
          labelRegel={
            adres?.labelEcht
              ? `${adres.label ?? "onbekend"} (geregistreerd)`
              : effLabel
                ? effLabel
                : "onbekend"
          }
          verwarmingRegel={(VERWARMING_VRAAG.opties ?? []).find((o) => o.waarde === verwarming)?.label ?? "onbekend"}
          isolatieRegel={(ISOLATIEGRAAD_VRAAG.opties ?? []).find((o) => o.waarde === isolatiegraad)?.label ?? "onbekend"}
          gaNaarStap={api.gaNaarStap}
        />
      )}
    />
  );
}

/* -------------------------------------------------------------------------
 * Uitkomst: het totaalplan.
 * ---------------------------------------------------------------------- */

function Uitkomst({
  plan,
  adviezen,
  adres,
  effLabel,
  woningRegel,
  labelRegel,
  verwarmingRegel,
  isolatieRegel,
  gaNaarStap,
}: {
  plan: Totaalplan;
  adviezen: MaatregelAdvies[];
  adres: AdresContext | null;
  effLabel: string | null;
  woningRegel: string;
  labelRegel: string;
  verwarmingRegel: string;
  isolatieRegel: string;
  gaNaarStap: (stapIndex: number) => void;
}) {
  const leenruimte = extraLeenruimteBijLabel(effLabel);
  const adresQuery = adres ? `postcode=${adres.postcode}&nummer=${encodeURIComponent(adres.nummerslug)}` : null;

  // Vervolg: de funnel van de eerste groep (vaste volgorde: isolatie eerst,
  // dat is meestal de logische eerste stap) waar een gekozen maatregel in valt.
  const gekozenKeys = plan.gekozen.map((a) => a.key);
  const groepen = ADVIES_GROEPEN.filter((g) => g.keys.some((k) => gekozenKeys.includes(k)));
  const primaireGroep = groepen[0] ?? null;
  const cta = primaireGroep ? CTA_PER_VERTICAAL[primaireGroep.verticaal] : null;

  // Bronnen van de gekozen maatregelen, ontdubbeld, plus de leennormen-bron.
  const bronnen: Bron[] = [];
  for (const a of plan.gekozen) {
    for (const b of a.bronnen) if (!bronnen.some((x) => x.url === b.url)) bronnen.push(b);
  }
  if (!bronnen.some((x) => x.url === LEENNORMEN_BRON.url)) bronnen.push(LEENNORMEN_BRON);

  const samenvatting: SamenvattingRij[] = [
    { label: "Woning", waarde: woningRegel, stapIndex: 0 },
    { label: "Energielabel", waarde: labelRegel, stapIndex: 1 },
    { label: "Verwarming", waarde: verwarmingRegel, stapIndex: 1 },
    { label: "Isolatie (eigen inschatting)", waarde: isolatieRegel, stapIndex: 1 },
    { label: "Maatregelen", waarde: titelsVan(adviezen, gekozenKeys), stapIndex: 2 },
  ];

  const zonnepanelenGekozen = gekozenKeys.includes("zonnepanelen");

  return (
    <div className="space-y-5">
      <UitkomstKaart
        label="Besparing per jaar (indicatie)"
        bedrag={plan.besparing ? formatEuroBereik(plan.besparing) : "geen kental"}
      >
        <p className="mt-4 text-sm leading-relaxed text-inkt-zacht">
          {plan.besparing
            ? `De optelsom van de kentallen van Milieu Centraal voor je ${plan.gekozen.length === 1 ? "gekozen maatregel" : `${plan.gekozen.length} gekozen maatregelen`}. De echte besparing hangt af van je woning, de huidige isolatie en je verbruik.`
            : "Voor de gekozen maatregelen geeft Milieu Centraal bij dit woningtype geen besparingskental. Liever geen cijfer dan een verzonnen cijfer; de subsidie hieronder geldt wel."}
          {plan.besparing && plan.zonderKental.length > 0
            ? ` Zonder kental en dus niet meegeteld: ${titelsVan(adviezen, plan.zonderKental)}.`
            : ""}
          {zonnepanelenGekozen && plan.besparing
            ? " Bij zonnepanelen is de lage kant het bedrag vanaf 2027 (salderen stopt), de hoge kant het bedrag in 2026."
            : ""}
        </p>
        <p className="mt-3 text-xs text-gedempt">
          Kentallen: Milieu Centraal, opgehaald {formatDatumNl(BESPARING_PEILDATUM)}. Een indicatie, geen belofte.
        </p>
      </UitkomstKaart>

      <div className="grid gap-5 sm:grid-cols-2">
        <StatTegel
          label="ISDE-subsidie 2026"
          waarde={plan.subsidie > 0 ? formatEuro(plan.subsidie) : "geen ISDE"}
          delta={
            plan.subsidie > 0
              ? plan.isolatieVerdubbeld
                ? "verdubbeld m2-tarief voor isolatie (2 of meer maatregelen), rekenvoorbeeld bij het minimumoppervlak"
                : "rekenvoorbeeld bij het minimumoppervlak; apparaten: mediaan RVO-meldcodelijst"
              : "voor zonnepanelen bestaat geen ISDE-subsidie"
          }
        />
        <StatTegel
          label="Netto-investering"
          waarde={plan.netto ? formatEuroBereik(plan.netto) : "onbekend"}
          delta={
            plan.netto
              ? `kosten min subsidie${plan.zonderKosten.length > 0 ? `, zonder ${titelsVan(adviezen, plan.zonderKosten)} (geen kosten-ordegrootte)` : ""}`
              : "geen betrouwbare kosten-ordegrootte in onze bronnen"
          }
        />
        <StatTegel
          label="Terugverdientijd"
          waarde={plan.terugverdientijd ? formatTerugverdientijd(plan.terugverdientijd) : "niet te berekenen"}
          delta={
            plan.terugverdientijd
              ? `indicatie: (kosten min subsidie) gedeeld door jaarbesparing${plan.buitenTerugverdientijd.length > 0 ? `, zonder ${titelsVan(adviezen, plan.buitenTerugverdientijd)}` : ""}`
              : "daarvoor ontbreekt een kosten-ordegrootte of besparingskental"
          }
        />
        <StatTegel
          label="Extra leenruimte verduurzaming"
          waarde={leenruimte ? formatEuro(leenruimte.bedrag) : "onbekend"}
          delta={
            leenruimte
              ? leenruimte.bedrag === 0
                ? `bij label ${effLabel}: het huis is al zeer zuinig`
                : `maximum bij label ${effLabel} (groep ${leenruimte.labelGroep})`
              : "geen (herkenbaar) energielabel doorgegeven"
          }
        />
      </div>

      <div className="rounded-[14px] border border-lijn bg-paneel p-5">
        <SectieLabel>Wat is die extra leenruimte?</SectieLabel>
        <p className="mt-3 text-sm leading-relaxed text-inkt-zacht">
          Leen je extra voor energiebesparende voorzieningen, dan mag een geldverstrekker dat deel van de hypotheek tot
          een maximumbedrag buiten de normale inkomenstoets laten. Dat maximum hangt af van je huidige energielabel:
          E, F of G {formatEuro(VERDUURZAMING_BEDRAG_BUITEN_BESCHOUWING.EFG)} · C of D {formatEuro(VERDUURZAMING_BEDRAG_BUITEN_BESCHOUWING.CD)} · A, B, A+ of A++ {formatEuro(VERDUURZAMING_BEDRAG_BUITEN_BESCHOUWING.AB)} · A+++ of
          beter {formatEuro(0)}. Het is een maximum, geen recht: de geldverstrekker beoordeelt of het in jouw situatie
          verantwoord is.
        </p>
        <p className="mt-3 text-xs text-gedempt">
          Bron:{" "}
          <a href={LEENNORMEN_BRON.url} rel="noopener noreferrer" className="underline underline-offset-2 hover:text-merk">
            {LEENNORMEN_BRON.label}
          </a>
          , geldig vanaf 1 januari 2026, door ons geverifieerd op {formatDatumNl(LEENNORMEN_PEILDATUM)}.
        </p>
      </div>

      <RekenmoduleSamenvatting rijen={samenvatting} gaNaarStap={gaNaarStap} />

      <UitklapUitleg titel="Zo rekenen we">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Besparing: kentallen van Milieu Centraal per maatregel, opgeteld over je keuze (opgehaald{" "}
            {formatDatumNl(BESPARING_PEILDATUM)}). {BESPARING_DISCLAIMER}
          </li>
          <li>
            ISDE-subsidie 2026: RVO, peildatum {formatDatumNl(ISDE_PEILDATUM)}. Voor isolatie rekenen we een
            rekenvoorbeeld bij het minimumoppervlak; een groter oppervlak geeft meer subsidie. Voor warmtepompen en
            zonneboilers tonen we de mediaan van de openbare RVO-meldcodelijst; het echte bedrag hangt af van het
            apparaat. Subsidie vraag je zelf aan bij de RVO; of en hoeveel jij krijgt hangt af van je situatie.
          </li>
          <li>
            Verdubbelingsregel: {ISDE_VERDUBBELING_UITLEG}{" "}
            {plan.isolatieVerdubbeld
              ? "Die verdubbeling zit in dit totaalplan verwerkt voor dak-, spouwmuur- en vloerisolatie."
              : "In dit totaalplan is die verdubbeling niet van toepassing of niet gerekend."}{" "}
            Voor glas tonen we altijd het basisbedrag; liever te laag dan te hoog.
          </li>
          <li>
            Kosten: ruwe ordegroottes, dezelfde als elders op Wonea: isolatie {formatEuro(1000)} tot {formatEuro(5000)}{" "}
            per maatregel, warmtepomp {formatEuro(4000)} (hybride) tot {formatEuro(15000)} (volledig elektrisch),
            zonnepanelen circa {formatEuro(3200)} voor 8 panelen. Voor zonneboilers hebben onze bronnen geen betrouwbare
            ordegrootte; die laten we dan ook eerlijk buiten de netto-investering.
          </li>
          <li>
            Netto-investering en terugverdientijd: (kosten min subsidie), en dat gedeeld door de jaarbesparing, afgerond
            op hele jaren. Bewust simpel: zonder rente en zonder energieprijsscenario&apos;s. De bandbreedte is breed
            omdat de kosten een ruwe ordegrootte zijn.
          </li>
          <li>
            Extra leenruimte: artikel 4, vierde lid, van de Tijdelijke regeling hypothecair krediet (bedragen per
            labelgroep), door ons geverifieerd op {formatDatumNl(LEENNORMEN_PEILDATUM)}. Je energielabel komt{" "}
            {adres?.labelEcht
              ? "uit de EP-Online-registratie van de RVO."
              : adres
                ? "uit je eigen keuze in stap 2 (vooringevuld met een indicatie op basis van het bouwjaar)."
                : "uit je eigen keuze in stap 2."}
          </li>
          <li>Alles op deze pagina is informatie, geen financieel advies en geen offerte.</li>
        </ul>
        <p className="mt-3">
          Bronnen:{" "}
          {bronnen.map((bron, i) => (
            <span key={bron.url}>
              {i > 0 ? " · " : null}
              <a href={bron.url} rel="noopener noreferrer" className="underline underline-offset-2 hover:text-merk">
                {bron.label}
              </a>
            </span>
          ))}
        </p>
      </UitklapUitleg>

      <GerelateerdeRekenhulpen
        items={[
          { titel: "Wat kan ik lenen?", zin: "Je maximale hypotheek volgens de leennormen 2026, inclusief energielabel-bedrag.", href: "/budget" },
          { titel: "Actuele hypotheekrentes", zin: "De gemiddelde rente per rentevaste periode, met peilmaand.", href: "/hypotheek-rentes" },
        ]}
      />

      {cta && primaireGroep ? (
        <LeadCta
          titel={cta.titel}
          tekst={
            adresQuery
              ? groepen.length > 1
                ? `${cta.tekst} Voor je andere maatregelen vind je de aanvraag op het verduurzamen-overzicht.`
                : cta.tekst
              : "Voor een aanvraag beginnen we bij je adres; daarna volgen een paar korte vragen. In de laatste stap zie je precies wat we doorgeven, en dat gebeurt alleen met jouw toestemming."
          }
          knopTekst={cta.knopTekst}
          href={adresQuery ? `/verduurzamen/${primaireGroep.verticaal}?${adresQuery}` : "/verduurzamen"}
          ontvanger={PARTIJ_TYPE}
        />
      ) : null}
    </div>
  );
}
