"use client";

import Link from "next/link";
import { useState } from "react";
import { inputClass, KnopPrimair, SectieLabel, Veld } from "@/components/ui";
import { formatEuro } from "@/lib/format";
import { verstuurHypotheekLead } from "@/app/hypotheek/actions";
import { HYPOTHEEK_CONSENT_TEKST, HYPOTHEEK_PARTIJ_TYPE } from "@/app/hypotheek/consent-tekst";
import {
  AANKOOP_BUDGET_LABELS,
  AANKOOP_BUDGETTEN,
  AANKOOP_FASE_LABELS,
  AANKOOP_FASES,
  OVERWAARDE_DOEL_LABELS,
  OVERWAARDE_DOELEN,
  type HypotheekSubtype,
} from "@/app/hypotheek/schema";

/**
 * Stepper van de hypotheekfunnel: 2 korte vraagstappen + 1 verzendstap,
 * client state; alleen de laatste stap verstuurt (server action). De eerdere
 * antwoorden reizen mee als hidden fields, de server valideert alles met Zod.
 */

export type StepperAdres = { naam: string; postcode: string; nummerslug: string };
export type StepperWaarde = { waarde: number; laag: number; hoog: number };

type Props = {
  subtype: HypotheekSubtype;
  adres: StepperAdres | null;
  waarde: StepperWaarde | null;
};

const STAP_TITELS: Record<HypotheekSubtype, [string, string, string]> = {
  overwaarde: ["Je woning en hypotheek", "Je doel", "Aanvraag versturen"],
  oversluiten: ["Je rentevaste periode", "Je restschuld", "Aanvraag versturen"],
  aankoop: ["Waar sta je nu?", "Je budget", "Aanvraag versturen"],
};

// Zelfde stijl als KnopPrimair/KnopSecundair (ui.tsx heeft geen onClick-variant).
const knopPrimairCls =
  "inline-flex items-center justify-center rounded-full bg-merk px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-merk-licht focus:outline-2 focus:outline-offset-2 focus:outline-merk";
const knopSecundairCls =
  "inline-flex items-center justify-center rounded-full border border-lijn bg-paneel px-6 py-3 text-sm font-semibold text-merk transition-colors hover:border-merk focus:outline-2 focus:outline-offset-2 focus:outline-merk";

function parseBedrag(s: string | undefined): number | null {
  if (!s) return null;
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n) : null;
}

function maandLabel(maand: string): string {
  return new Intl.DateTimeFormat("nl-NL", { month: "long", year: "numeric" }).format(new Date(`${maand}-01`));
}

function label<K extends string>(map: Record<K, string>, key: string | undefined): string {
  return key && key in map ? map[key as K] : (key ?? "");
}

export function HypotheekStepper({ subtype, adres, waarde }: Props) {
  const [stap, setStap] = useState(0);
  const [a, setA] = useState<Record<string, string>>({});
  const [fout, setFout] = useState<string | null>(null);

  const zet = (naam: string, waarde: string) => setA((huidig) => ({ ...huidig, [naam]: waarde }));

  const basisWaarde = waarde ? waarde.waarde : parseBedrag(a.eigenWaarde);
  const restantNum = parseBedrag(a.restant);

  function valideerStap(): string | null {
    if (stap === 0) {
      if (subtype === "overwaarde") {
        if (!waarde) {
          const w = parseBedrag(a.eigenWaarde);
          if (w == null || w < 10_000) return "Vul een geschatte woningwaarde in, minimaal 10.000 euro.";
        }
        if (restantNum == null || restantNum < 0) return "Vul in hoeveel hypotheek er nog openstaat. Afronden mag.";
      }
      if (subtype === "oversluiten") {
        if (!/^\d{4}-\d{2}$/.test(a.rentevastTot ?? "")) return "Kies de maand waarin je rentevaste periode afloopt.";
        const rente = Number((a.huidigeRente ?? "").replace(",", "."));
        if (!Number.isFinite(rente) || rente < 0.1 || rente > 15) return "Vul je huidige rente in procenten in, bijvoorbeeld 3,8.";
      }
      if (subtype === "aankoop" && !a.fase) return "Kies de fase die het best bij je past.";
    }
    if (stap === 1) {
      if (subtype === "overwaarde" && !a.doel) return "Kies wat je met de overwaarde zou willen doen.";
      if (subtype === "oversluiten") {
        const r = parseBedrag(a.restschuld);
        if (r == null || r < 1_000) return "Vul je geschatte restschuld in. Afronden mag.";
      }
      if (subtype === "aankoop") {
        if (!a.budget) return "Kies een budgetindicatie.";
        if (!a.eigenInbreng) return "Geef aan of je eigen geld inbrengt.";
      }
    }
    return null;
  }

  function volgende() {
    const melding = valideerStap();
    if (melding) {
      setFout(melding);
      return;
    }
    setFout(null);
    setStap((s) => Math.min(s + 1, 2));
  }

  function terug() {
    setFout(null);
    setStap((s) => Math.max(s - 1, 0));
  }

  function samenvatting(): [string, string][] {
    if (subtype === "overwaarde") {
      const rijen: [string, string][] = [];
      if (basisWaarde != null) {
        rijen.push(["Woningwaarde", `${formatEuro(basisWaarde)} (${waarde ? "Wonea-schatting" : "eigen inschatting"})`]);
      }
      if (restantNum != null) rijen.push(["Openstaande hypotheek", formatEuro(restantNum)]);
      if (basisWaarde != null && restantNum != null) rijen.push(["Indicatie overwaarde", formatEuro(basisWaarde - restantNum)]);
      rijen.push(["Doel", label(OVERWAARDE_DOEL_LABELS, a.doel)]);
      return rijen;
    }
    if (subtype === "oversluiten") {
      const restschuld = parseBedrag(a.restschuld);
      return [
        ["Rentevast tot", a.rentevastTot ? maandLabel(a.rentevastTot) : ""],
        ["Huidige rente", `${(a.huidigeRente ?? "").replace(".", ",")}%`],
        ["Geschatte restschuld", restschuld != null ? formatEuro(restschuld) : ""],
      ];
    }
    return [
      ["Fase", label(AANKOOP_FASE_LABELS, a.fase)],
      ["Budgetindicatie", label(AANKOOP_BUDGET_LABELS, a.budget)],
      ["Eigen inbreng", a.eigenInbreng === "ja" ? "Ja" : "Nee"],
    ];
  }

  /** Antwoorden die als hidden fields met de verzendstap meereizen. */
  function verborgenVelden(): [string, string][] {
    if (subtype === "overwaarde") {
      const velden: [string, string][] = [];
      if (!waarde && a.eigenWaarde) velden.push(["eigenWaarde", a.eigenWaarde]);
      velden.push(["restant", a.restant ?? ""], ["doel", a.doel ?? ""]);
      return velden;
    }
    if (subtype === "oversluiten") {
      return [
        ["rentevastTot", a.rentevastTot ?? ""],
        ["huidigeRente", a.huidigeRente ?? ""],
        ["restschuld", a.restschuld ?? ""],
      ];
    }
    return [
      ["fase", a.fase ?? ""],
      ["budget", a.budget ?? ""],
      ["eigenInbreng", a.eigenInbreng ?? ""],
    ];
  }

  const radioCls = "flex items-center gap-3 rounded-lg border border-lijn px-4 py-3 text-sm text-inkt";

  return (
    <div>
      <SectieLabel>Stap {stap + 1} van 3</SectieLabel>
      <h2 className="mt-2 text-xl font-semibold">{STAP_TITELS[subtype][stap]}</h2>

      {fout ? (
        <p className="mt-4 rounded-lg border border-negatief/30 bg-negatief/5 px-4 py-3 text-sm text-negatief">{fout}</p>
      ) : null}

      {/* Stap 1 */}
      {stap === 0 && subtype === "overwaarde" ? (
        <div className="mt-5 space-y-5">
          {waarde ? (
            <div className="rounded-lg bg-merk-wash p-4 text-sm leading-relaxed text-inkt-zacht">
              We rekenen met de Wonea-waarde van je woning: <strong className="text-merk">{formatEuro(waarde.waarde)}</strong>,
              bandbreedte {formatEuro(waarde.laag)} tot {formatEuro(waarde.hoog)}. Een modelmatige indicatie, geen taxatie.
            </div>
          ) : (
            <Veld label="Geschatte waarde van je woning" hint="Je eigen inschatting is goed genoeg voor deze eerste stap.">
              <input
                type="number"
                inputMode="numeric"
                min={10000}
                step={1000}
                placeholder="450000"
                value={a.eigenWaarde ?? ""}
                onChange={(e) => zet("eigenWaarde", e.target.value)}
                className={inputClass}
              />
            </Veld>
          )}
          <Veld label="Openstaande hypotheek" hint="Het bedrag dat nu nog ongeveer openstaat, in euro. Afronden mag.">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              step={1000}
              placeholder="250000"
              value={a.restant ?? ""}
              onChange={(e) => zet("restant", e.target.value)}
              className={inputClass}
            />
          </Veld>
          {basisWaarde != null && restantNum != null ? (
            <div className="rounded-lg bg-merk-wash p-4">
              <SectieLabel>Indicatie van je overwaarde</SectieLabel>
              <p className="mt-2 font-display text-2xl font-semibold text-merk">{formatEuro(basisWaarde - restantNum)}</p>
              {waarde ? (
                <p className="mt-1 text-sm text-inkt-zacht">
                  Bandbreedte {formatEuro(waarde.laag - restantNum)} tot {formatEuro(waarde.hoog - restantNum)}
                </p>
              ) : null}
              <p className="mt-2 text-xs leading-relaxed text-gedempt">
                Indicatie: {waarde ? "de Wonea-schatting" : "je eigen inschatting"} min je openstaande hypotheek. Geen
                taxatie{basisWaarde - restantNum <= 0 ? ". Op basis hiervan lijkt er nu weinig of geen overwaarde te zijn; een adviseur kan meekijken of er toch ruimte is" : ""}.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {stap === 0 && subtype === "oversluiten" ? (
        <div className="mt-5 space-y-5">
          <Veld label="Wanneer loopt je rentevaste periode af?" hint="Staat in je hypotheekoverzicht of jaaropgave.">
            <input type="month" value={a.rentevastTot ?? ""} onChange={(e) => zet("rentevastTot", e.target.value)} className={inputClass} />
          </Veld>
          <Veld label="Huidige rente" hint="In procenten, bijvoorbeeld 3,8.">
            <input
              type="number"
              inputMode="decimal"
              min={0.1}
              max={15}
              step={0.01}
              placeholder="3.8"
              value={a.huidigeRente ?? ""}
              onChange={(e) => zet("huidigeRente", e.target.value)}
              className={inputClass}
            />
          </Veld>
        </div>
      ) : null}

      {stap === 0 && subtype === "aankoop" ? (
        <fieldset className="mt-5">
          <legend className="mb-2 block text-sm font-medium text-inkt">In welke fase zit je?</legend>
          <div className="space-y-2">
            {AANKOOP_FASES.map((fase) => (
              <label key={fase} className={radioCls}>
                <input
                  type="radio"
                  name="fase_keuze"
                  value={fase}
                  checked={a.fase === fase}
                  onChange={() => zet("fase", fase)}
                  className="accent-merk"
                />
                {AANKOOP_FASE_LABELS[fase]}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {/* Stap 2 */}
      {stap === 1 && subtype === "overwaarde" ? (
        <fieldset className="mt-5">
          <legend className="mb-2 block text-sm font-medium text-inkt">Wat zou je met de overwaarde willen doen?</legend>
          <div className="space-y-2">
            {OVERWAARDE_DOELEN.map((doel) => (
              <label key={doel} className={radioCls}>
                <input
                  type="radio"
                  name="doel_keuze"
                  value={doel}
                  checked={a.doel === doel}
                  onChange={() => zet("doel", doel)}
                  className="accent-merk"
                />
                {OVERWAARDE_DOEL_LABELS[doel]}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {stap === 1 && subtype === "oversluiten" ? (
        <div className="mt-5">
          <Veld label="Geschatte restschuld" hint="Het bedrag dat je nog moet aflossen, in euro. Afronden mag.">
            <input
              type="number"
              inputMode="numeric"
              min={1000}
              step={1000}
              placeholder="285000"
              value={a.restschuld ?? ""}
              onChange={(e) => zet("restschuld", e.target.value)}
              className={inputClass}
            />
          </Veld>
        </div>
      ) : null}

      {stap === 1 && subtype === "aankoop" ? (
        <div className="mt-5 space-y-5">
          <Veld label="Budgetindicatie" hint="Een grove indicatie is genoeg; de adviseur rekent het precies door.">
            <select value={a.budget ?? ""} onChange={(e) => zet("budget", e.target.value)} className={inputClass}>
              <option value="" disabled>
                Maak een keuze
              </option>
              {AANKOOP_BUDGETTEN.map((budget) => (
                <option key={budget} value={budget}>
                  {AANKOOP_BUDGET_LABELS[budget]}
                </option>
              ))}
            </select>
          </Veld>
          <fieldset>
            <legend className="mb-2 block text-sm font-medium text-inkt">Breng je eigen geld in, zoals spaargeld of overwaarde?</legend>
            <div className="flex gap-6 text-sm text-inkt">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="inbreng_keuze"
                  value="ja"
                  checked={a.eigenInbreng === "ja"}
                  onChange={() => zet("eigenInbreng", "ja")}
                  className="accent-merk"
                />
                Ja
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="inbreng_keuze"
                  value="nee"
                  checked={a.eigenInbreng === "nee"}
                  onChange={() => zet("eigenInbreng", "nee")}
                  className="accent-merk"
                />
                Nee
              </label>
            </div>
          </fieldset>
        </div>
      ) : null}

      {/* Stap 3: e-mail + consent + versturen */}
      {stap === 2 ? (
        <div className="mt-5">
          <dl className="space-y-2 rounded-lg border border-lijn p-4 text-sm">
            {samenvatting().map(([naam, waardeTekst]) => (
              <div key={naam} className="flex justify-between gap-4">
                <dt className="text-gedempt">{naam}</dt>
                <dd className="text-right font-medium">{waardeTekst}</dd>
              </div>
            ))}
          </dl>

          <form action={verstuurHypotheekLead} className="mt-5 space-y-5">
            <input type="hidden" name="subtype" value={subtype} />
            {adres ? (
              <>
                <input type="hidden" name="postcode" value={adres.postcode} />
                <input type="hidden" name="nummer" value={adres.nummerslug} />
              </>
            ) : null}
            {verborgenVelden().map(([naam, waardeVeld]) => (
              <input key={naam} type="hidden" name={naam} value={waardeVeld} />
            ))}

            <Veld label="E-mailadres" hint="Voor de bevestiging en zodat de adviseur contact met je kan opnemen.">
              <input name="email" type="email" required placeholder="jij@voorbeeld.nl" className={inputClass} />
            </Veld>

            <label className="flex items-start gap-3 text-sm leading-relaxed text-inkt">
              <input type="checkbox" name="consent" value="1" required className="mt-0.5 accent-merk" />
              <span>{HYPOTHEEK_CONSENT_TEKST}</span>
            </label>

            <input type="text" name="bedrijfsnaam" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

            <p className="text-sm leading-relaxed text-inkt-zacht">
              Je aanvraag gaat naar {HYPOTHEEK_PARTIJ_TYPE}: niet naar meerdere partijen en niet naar adverteerders.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={terug} className={knopSecundairCls}>
                Terug
              </button>
              <KnopPrimair type="submit">Aanvraag versturen</KnopPrimair>
            </div>
            <p className="text-xs leading-relaxed text-gedempt">
              We gebruiken je e-mailadres alleen waarvoor je hier tekent. Zie ons{" "}
              <Link href="/privacy" className="underline underline-offset-2 hover:text-merk">
                privacybeleid
              </Link>
              .
            </p>
          </form>
        </div>
      ) : (
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {stap > 0 ? (
            <button type="button" onClick={terug} className={knopSecundairCls}>
              Terug
            </button>
          ) : null}
          <button type="button" onClick={volgende} className={knopPrimairCls}>
            Volgende
          </button>
        </div>
      )}
    </div>
  );
}
