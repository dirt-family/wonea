"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { verstuurAanvraag, type FunnelFormState } from "@/app/verduurzamen/actions";
import { CONSENT_TEKST, PARTIJ_TYPE, VERTICALEN, type Verticaal, type Vraag } from "@/app/verduurzamen/verticalen";
import { inputClass, Kaart, Veld } from "@/components/ui";

/**
 * Stepper met client state: eerst de kwalificatievragen (1 per stap), als
 * laatste stap e-mail plus consent. De antwoorden reizen als hidden inputs
 * mee in het uiteindelijke formulier; versturen loopt via de server action.
 * Knoppen met onClick kunnen niet uit components/ui.tsx komen (die kent geen
 * onClick), dus die zijn hier met dezelfde token-klassen nagebouwd.
 */

const knopPrimairCls =
  "inline-flex items-center justify-center rounded-full bg-merk px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-merk-licht focus:outline-2 focus:outline-offset-2 focus:outline-merk disabled:cursor-not-allowed disabled:opacity-50";
const knopSecundairCls =
  "inline-flex items-center justify-center rounded-full border border-lijn bg-paneel px-6 py-3 text-sm font-semibold text-merk transition-colors hover:border-merk focus:outline-2 focus:outline-offset-2 focus:outline-merk";

type Antwoorden = Record<string, string | string[]>;

function isBeantwoord(vraag: Vraag, antwoorden: Antwoorden): boolean {
  const w = antwoorden[vraag.naam];
  if (vraag.soort === "checkbox") return Array.isArray(w) && w.length > 0;
  if (vraag.soort === "bouwjaar") {
    const n = Number(w);
    return typeof w === "string" && /^\d{4}$/.test(w) && n >= 1500 && n <= new Date().getFullYear() + 1;
  }
  return typeof w === "string" && w !== "";
}

export function VerduurzaamStepper({
  verticaal,
  adresNaam,
  postcode,
  nummerslug,
  bouwjaar,
}: {
  verticaal: Verticaal;
  adresNaam: string;
  postcode: string;
  nummerslug: string;
  bouwjaar: number;
}) {
  const config = VERTICALEN[verticaal];
  const vragen = config.vragen;
  const [stap, setStap] = useState(0);
  const [antwoorden, setAntwoorden] = useState<Antwoorden>({ bouwjaar: String(bouwjaar) });
  const [state, formAction, bezig] = useActionState<FunnelFormState, FormData>(verstuurAanvraag, { fout: null });

  const laatsteStap = stap === vragen.length;
  const vraag = laatsteStap ? null : vragen[stap];
  const voortgang = ((stap + 1) / (vragen.length + 1)) * 100;

  function kies(naam: string, waarde: string) {
    setAntwoorden((huidig) => ({ ...huidig, [naam]: waarde }));
  }

  function toggle(naam: string, waarde: string) {
    setAntwoorden((huidig) => {
      const lijst = Array.isArray(huidig[naam]) ? (huidig[naam] as string[]) : [];
      return { ...huidig, [naam]: lijst.includes(waarde) ? lijst.filter((x) => x !== waarde) : [...lijst, waarde] };
    });
  }

  return (
    <Kaart className="mt-8 max-w-2xl">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gedempt">
        {laatsteStap ? "Laatste stap: versturen" : `Vraag ${stap + 1} van ${vragen.length}`}
      </p>
      <div className="mt-2 h-1.5 rounded-full bg-merk-wash" role="presentation">
        <div className="h-1.5 rounded-full bg-merk transition-all" style={{ width: `${voortgang}%` }} />
      </div>

      {vraag ? (
        <div className="mt-6">
          <p className="text-base font-semibold text-inkt">{vraag.label}</p>
          {vraag.hint ? <p className="mt-1 text-xs text-gedempt">{vraag.hint}</p> : null}

          {vraag.soort === "bouwjaar" ? (
            <div className="mt-4 max-w-[12rem]">
              <input
                type="number"
                inputMode="numeric"
                min={1500}
                max={new Date().getFullYear() + 1}
                value={typeof antwoorden[vraag.naam] === "string" ? (antwoorden[vraag.naam] as string) : ""}
                onChange={(e) => kies(vraag.naam, e.target.value)}
                className={inputClass}
                aria-label={vraag.label}
              />
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {(vraag.opties ?? []).map((optie) => {
                const gekozen =
                  vraag.soort === "checkbox"
                    ? Array.isArray(antwoorden[vraag.naam]) && (antwoorden[vraag.naam] as string[]).includes(optie.waarde)
                    : antwoorden[vraag.naam] === optie.waarde;
                return (
                  <label
                    key={optie.waarde}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm transition-colors ${
                      gekozen ? "border-merk bg-merk-wash text-inkt" : "border-lijn bg-paneel text-inkt hover:border-merk"
                    }`}
                  >
                    <input
                      type={vraag.soort === "checkbox" ? "checkbox" : "radio"}
                      name={`ui-${vraag.naam}`}
                      value={optie.waarde}
                      checked={gekozen}
                      onChange={() => (vraag.soort === "checkbox" ? toggle(vraag.naam, optie.waarde) : kies(vraag.naam, optie.waarde))}
                      className="accent-merk"
                    />
                    {optie.label}
                  </label>
                );
              })}
            </div>
          )}

          <div className="mt-6 flex items-center justify-between gap-3">
            {stap > 0 ? (
              <button type="button" onClick={() => setStap(stap - 1)} className={knopSecundairCls}>
                Terug
              </button>
            ) : (
              <span />
            )}
            <button type="button" onClick={() => setStap(stap + 1)} disabled={!isBeantwoord(vraag, antwoorden)} className={knopPrimairCls}>
              Volgende
            </button>
          </div>
        </div>
      ) : (
        <form action={formAction} className="mt-6 space-y-5">
          <input type="hidden" name="verticaal" value={verticaal} />
          <input type="hidden" name="postcode" value={postcode} />
          <input type="hidden" name="nummer" value={nummerslug} />
          {vragen.map((v) => {
            const w = antwoorden[v.naam];
            return Array.isArray(w) ? (
              w.map((x) => <input key={`${v.naam}-${x}`} type="hidden" name={v.naam} value={x} />)
            ) : (
              <input key={v.naam} type="hidden" name={v.naam} value={typeof w === "string" ? w : ""} />
            );
          })}

          <Veld label="E-mailadres" hint="Hierop ontvang je de bevestiging en kunnen bedrijven je bereiken.">
            <input name="email" type="email" required maxLength={200} placeholder="jij@voorbeeld.nl" className={inputClass} />
          </Veld>

          <label className="flex items-start gap-3 border-t border-lijn pt-5 text-sm text-inkt">
            <input type="checkbox" name="consent" value="ja" required className="mt-0.5 accent-merk" />
            <span>{CONSENT_TEKST}</span>
          </label>

          <input type="text" name="bedrijfsnaam" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

          {state.fout ? (
            <p className="rounded-lg border border-negatief/30 bg-negatief/5 px-4 py-3 text-sm text-negatief">{state.fout}</p>
          ) : null}

          <p className="text-sm leading-relaxed text-inkt-zacht">
            Je aanvraag voor {adresNaam} wordt doorgegeven aan {PARTIJ_TYPE}. Niet aan anderen, en alleen voor deze
            aanvraag. In deze testfase wordt er nog niets echt doorgestuurd.
          </p>

          <div className="flex items-center justify-between gap-3">
            <button type="button" onClick={() => setStap(stap - 1)} className={knopSecundairCls}>
              Terug
            </button>
            <button type="submit" disabled={bezig} className={knopPrimairCls}>
              {bezig ? "Versturen..." : "Verstuur aanvraag"}
            </button>
          </div>
          <p className="text-xs leading-relaxed text-gedempt">
            We gebruiken je e-mailadres alleen waarvoor je hier tekent. Zie ons{" "}
            <Link href="/privacy" className="underline underline-offset-2 hover:text-merk">
              privacybeleid
            </Link>
            .
          </p>
        </form>
      )}
    </Kaart>
  );
}
