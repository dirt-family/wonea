"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Bandbreedte,
  inputClass,
  LeadCta,
  SectieLabel,
  StappenBalk,
  StatTegel,
  UitklapUitleg,
  UitkomstKaart,
  Veld,
} from "@/components/ui";
import { formatEuro } from "@/lib/format";
import {
  berekenBudget,
  ENERGIELABEL_OPTIES,
  INDICATIE_MARGE_PCT,
  RENTEVAST_KEUZES,
  type BudgetInvoer,
  type RentevastKeuze,
} from "@/app/budget/berekening";
import type { EnergielabelKlasse } from "@/lib/hypotheek";

/**
 * Stepper van de budgetberekenaar: drie korte vraagstappen en een uitkomst,
 * volledig client-side. Er wordt niets verstuurd of opgeslagen; de rekenkern
 * (lib/hypotheek.ts via app/budget/berekening.ts) is puur en draait in de
 * browser. De DNB-rente-voorinvulling komt als prop van de serverpagina.
 */

export type RenteVoorinvulling = {
  /** DNB-gemiddelde per rentevast-keuze, procenten; kan per keuze ontbreken. */
  perKeuze: Partial<Record<RentevastKeuze, number>>;
  /** Maand waarop de DNB-cijfers slaan, bv. "mei 2026". */
  peilmaand: string;
  /** Datum waarop de snapshot is opgehaald, "YYYY-MM-DD". */
  opgehaaldOp: string;
  /** Letterlijke DNB-bronvermelding voor de methode-uitleg. */
  bron: string;
};

const STAPPEN = ["Inkomen", "Situatie", "Energielabel", "Uitkomst"];

// Zelfde stijl als KnopPrimair/KnopSecundair (ui.tsx heeft geen onClick-variant).
const knopPrimairCls =
  "inline-flex items-center justify-center rounded-full bg-merk px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-merk-licht focus:outline-2 focus:outline-offset-2 focus:outline-merk";
const knopSecundairCls =
  "inline-flex items-center justify-center rounded-full border border-lijn bg-paneel px-6 py-3 text-sm font-semibold text-merk transition-colors hover:border-merk focus:outline-2 focus:outline-offset-2 focus:outline-merk";
const radioCls = "flex items-center gap-3 rounded-lg border border-lijn px-4 py-3 text-sm text-inkt";

function parseBedrag(s: string): number | null {
  if (!s.trim()) return null;
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n) : null;
}

function parseRente(s: string): number | null {
  if (!s.trim()) return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** 3.74 -> "3,74" voor invoervelden en lopende tekst. */
function renteTekst(pct: number): string {
  return String(pct).replace(".", ",");
}

export function BudgetStepper({ voorinvulling }: { voorinvulling: RenteVoorinvulling }) {
  const [stap, setStap] = useState(0);
  const [fout, setFout] = useState<string | null>(null);

  const [inkomen1, setInkomen1] = useState("");
  const [samen, setSamen] = useState(false);
  const [inkomen2, setInkomen2] = useState("");
  const [rentevast, setRentevast] = useState<RentevastKeuze | null>(null);
  const [rente, setRente] = useState("");
  const [verplichtingen, setVerplichtingen] = useState("");
  const [aow, setAow] = useState<"ja" | "nee" | null>(null);
  const [label, setLabel] = useState<EnergielabelKlasse | "">("");

  function kiesRentevast(keuze: RentevastKeuze) {
    setRentevast(keuze);
    const dnb = voorinvulling.perKeuze[keuze];
    if (dnb !== undefined) setRente(renteTekst(dnb));
  }

  function valideerStap(huidige: number): string | null {
    if (huidige === 0) {
      const i1 = parseBedrag(inkomen1);
      if (i1 == null || i1 < 1) return "Vul je bruto jaarinkomen in, in hele euro's. Afronden mag.";
      if (samen) {
        const i2 = parseBedrag(inkomen2);
        if (i2 == null || i2 < 0) return "Vul ook het bruto jaarinkomen van de tweede aanvrager in, of zet het vinkje uit.";
      }
    }
    if (huidige === 1) {
      if (rentevast == null) return "Kies een rentevaste periode.";
      const r = parseRente(rente);
      if (r == null || r < 0.1 || r > 15) return "Vul de rente in procenten in, bijvoorbeeld 3,74.";
      if (verplichtingen.trim()) {
        const v = parseBedrag(verplichtingen);
        if (v == null || v < 0) return "Vul je maandelijkse verplichtingen in euro in, of laat het veld leeg.";
      }
      if (aow == null) return "Geef aan of je de AOW-leeftijd hebt bereikt.";
    }
    return null;
  }

  function volgende() {
    const melding = valideerStap(stap);
    if (melding) {
      setFout(melding);
      return;
    }
    setFout(null);
    setStap((s) => Math.min(s + 1, 3));
  }

  function terug() {
    setFout(null);
    setStap((s) => Math.max(s - 1, 0));
  }

  /** Alleen aanroepen op de uitkomststap: alle eerdere stappen zijn dan gevalideerd. */
  function invoer(): BudgetInvoer {
    return {
      inkomen1: parseBedrag(inkomen1) ?? 0,
      inkomen2: samen ? (parseBedrag(inkomen2) ?? 0) : undefined,
      rentevastJaren: rentevast ?? 10,
      rentePct: parseRente(rente) ?? 0,
      verplichtingenPerMaand: verplichtingen.trim() ? (parseBedrag(verplichtingen) ?? 0) : undefined,
      aowLeeftijdBereikt: aow === "ja",
      energielabelKlasse: label === "" ? undefined : label,
    };
  }

  const dnbGekozen = rentevast != null ? voorinvulling.perKeuze[rentevast] : undefined;

  return (
    <div>
      <StappenBalk stappen={STAPPEN} actief={stap} />

      {fout ? (
        <p className="mt-4 rounded-lg border border-negatief/30 bg-negatief/5 px-4 py-3 text-sm text-negatief">{fout}</p>
      ) : null}

      {/* Stap 1: inkomen(s) */}
      {stap === 0 ? (
        <div className="mt-6 space-y-5">
          <h2 className="text-xl font-semibold">Wat verdien je?</h2>
          <Veld label="Bruto jaarinkomen" hint="Je bruto inkomen per jaar, inclusief vakantiegeld en vaste toeslagen. Afronden mag.">
            <input
              type="text"
              inputMode="numeric"
              placeholder="48000"
              value={inkomen1}
              onChange={(e) => setInkomen1(e.target.value)}
              className={inputClass}
            />
          </Veld>
          <label className="flex items-start gap-3 text-sm leading-relaxed text-inkt">
            <input
              type="checkbox"
              checked={samen}
              onChange={(e) => setSamen(e.target.checked)}
              className="mt-0.5 accent-merk"
            />
            <span>Ik vraag samen met iemand anders aan</span>
          </label>
          {samen ? (
            <Veld
              label="Bruto jaarinkomen tweede aanvrager"
              hint="Het tweede inkomen telt in 2026 volledig mee in de berekening."
            >
              <input
                type="text"
                inputMode="numeric"
                placeholder="42000"
                value={inkomen2}
                onChange={(e) => setInkomen2(e.target.value)}
                className={inputClass}
              />
            </Veld>
          ) : null}
        </div>
      ) : null}

      {/* Stap 2: situatie */}
      {stap === 1 ? (
        <div className="mt-6 space-y-5">
          <h2 className="text-xl font-semibold">Je situatie</h2>
          <fieldset>
            <legend className="mb-2 block text-sm font-medium text-inkt">Hoe lang wil je de rente vastzetten?</legend>
            <div className="space-y-2">
              {RENTEVAST_KEUZES.map((keuze) => {
                const dnb = voorinvulling.perKeuze[keuze];
                return (
                  <label key={keuze} className={radioCls}>
                    <input
                      type="radio"
                      name="rentevast_keuze"
                      value={keuze}
                      checked={rentevast === keuze}
                      onChange={() => kiesRentevast(keuze)}
                      className="accent-merk"
                    />
                    <span className="flex-1">{keuze} jaar rentevast</span>
                    {dnb !== undefined ? (
                      <span className="text-xs text-gedempt">gemiddeld {renteTekst(dnb)}%</span>
                    ) : null}
                  </label>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-gedempt">
              De gemiddelden zijn de bancaire rentes op nieuwe woninghypotheken per rentevast-periode (bron: DNB,
              peilmaand {voorinvulling.peilmaand}). Geen tarieven per geldverstrekker.
            </p>
          </fieldset>
          <Veld
            label="Rente"
            hint={
              dnbGekozen !== undefined
                ? `Vooringevuld met het DNB-gemiddelde van ${voorinvulling.peilmaand}. Heb je al een renteaanbod, vul dan die rente in.`
                : "In procenten, bijvoorbeeld 3,74. Heb je al een renteaanbod, vul dan die rente in."
            }
          >
            <input
              type="text"
              inputMode="decimal"
              placeholder="3,74"
              value={rente}
              onChange={(e) => setRente(e.target.value)}
              className={inputClass}
            />
          </Veld>
          {rentevast != null && rentevast < 10 ? (
            <p className="rounded-lg bg-merk-wash p-4 text-sm leading-relaxed text-inkt-zacht">
              Bij een rentevaste periode korter dan 10 jaar toetst de wet op minimaal 5,0% rente (de AFM-toetsrente), ook
              als je eigen rente lager is. Je ziet dat terug in de uitkomst.
            </p>
          ) : null}
          <Veld
            label="Maandelijkse verplichtingen"
            hint="Bijvoorbeeld alimentatie of de maandlast van een lopende lening, in euro per maand. Leeg laten mag."
          >
            <input
              type="text"
              inputMode="numeric"
              placeholder="0"
              value={verplichtingen}
              onChange={(e) => setVerplichtingen(e.target.value)}
              className={inputClass}
            />
          </Veld>
          <fieldset>
            <legend className="mb-2 block text-sm font-medium text-inkt">Heb je de AOW-leeftijd bereikt?</legend>
            <div className="flex gap-6 text-sm text-inkt">
              <label className="flex items-center gap-2">
                <input type="radio" name="aow_keuze" value="nee" checked={aow === "nee"} onChange={() => setAow("nee")} className="accent-merk" />
                Nee
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="aow_keuze" value="ja" checked={aow === "ja"} onChange={() => setAow("ja")} className="accent-merk" />
                Ja
              </label>
            </div>
            <p className="mt-2 text-xs text-gedempt">
              Vanaf de AOW-leeftijd gelden andere financieringslastpercentages. Vraag je samen aan en heeft een van jullie
              de AOW-leeftijd bereikt, kies dan ja.
            </p>
          </fieldset>
        </div>
      ) : null}

      {/* Stap 3: energielabel (optioneel) */}
      {stap === 2 ? (
        <div className="mt-6 space-y-5">
          <h2 className="text-xl font-semibold">Energielabel van de woning</h2>
          <p className="text-sm leading-relaxed text-inkt-zacht">
            Optioneel. Een beter energielabel geeft meer leenruimte: de wet laat per label een vast bedrag buiten
            beschouwing, bovenop wat je op basis van je inkomen kunt lenen. Weet je het label nog niet, sla deze stap dan
            over.
          </p>
          <fieldset>
            <legend className="sr-only">Energielabel</legend>
            <div className="space-y-2">
              <label className={radioCls}>
                <input
                  type="radio"
                  name="label_keuze"
                  value=""
                  checked={label === ""}
                  onChange={() => setLabel("")}
                  className="accent-merk"
                />
                <span className="flex-1">Weet ik niet of nog geen woning op het oog</span>
                <span className="text-xs text-gedempt">geen labelbedrag</span>
              </label>
              {ENERGIELABEL_OPTIES.map((o) => (
                <label key={o.klasse} className={radioCls}>
                  <input
                    type="radio"
                    name="label_keuze"
                    value={o.klasse}
                    checked={label === o.klasse}
                    onChange={() => setLabel(o.klasse)}
                    className="accent-merk"
                  />
                  <span className="flex-1">{o.label}</span>
                  <span className="text-xs text-gedempt">{o.bedrag > 0 ? `+ ${formatEuro(o.bedrag)}` : "geen extra bedrag"}</span>
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-gedempt">
              Bedragen per label uit artikel 4, derde lid, van de Tijdelijke regeling hypothecair krediet (leennormen
              2026).
            </p>
          </fieldset>
        </div>
      ) : null}

      {/* Uitkomst */}
      {stap === 3 ? <Uitkomst invoer={invoer()} voorinvulling={voorinvulling} naarStart={() => setStap(0)} /> : null}

      {stap < 3 ? (
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {stap > 0 ? (
            <button type="button" onClick={terug} className={knopSecundairCls}>
              Terug
            </button>
          ) : null}
          <button type="button" onClick={volgende} className={knopPrimairCls}>
            {stap === 2 ? "Bekijk je uitkomst" : "Volgende"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Uitkomst({
  invoer,
  voorinvulling,
  naarStart,
}: {
  invoer: BudgetInvoer;
  voorinvulling: RenteVoorinvulling;
  naarStart: () => void;
}) {
  const u = berekenBudget(invoer);
  const labelGekozen = invoer.energielabelKlasse !== undefined;
  const provisieLabel = `${renteTekst(u.nhgProvisiePct)}%`;

  return (
    <div className="mt-6 space-y-5">
      <UitkomstKaart label="Maximale hypotheek (indicatie)" bedrag={formatEuro(u.maximaal)}>
        {u.maximaal > 0 ? (
          <>
            <Bandbreedte laag={u.laag} waarde={u.maximaal} hoog={u.hoog} />
            <p className="mt-4 text-sm leading-relaxed text-inkt-zacht">
              De bandbreedte is een indicatiemarge van {INDICATIE_MARGE_PCT}% omlaag en omhoog. Je exacte leenruimte hangt
              af van je volledige situatie en het acceptatiebeleid van de geldverstrekker; een hypotheekadviseur rekent
              dat precies door.
            </p>
          </>
        ) : (
          <p className="mt-4 text-sm leading-relaxed text-inkt-zacht">
            Op basis van deze invoer is er nu geen leenruimte: je maandelijkse verplichtingen zijn hoger dan de ruimte die
            de norm bij dit inkomen toestaat. Dat is de eerlijke uitkomst van de wettelijke tabellen; een adviseur kan
            meekijken of er in jouw situatie toch mogelijkheden zijn.
          </p>
        )}
        <p className="mt-3 text-xs text-gedempt">
          Berekend volgens de wettelijke leennormen 2026 (Staatscourant 2025, 36471, geldend vanaf 1 januari 2026). Een
          indicatie, geen offerte.
        </p>
      </UitkomstKaart>

      {u.maximaal > 0 ? (
        <div className="grid gap-5 sm:grid-cols-2">
          <StatTegel
            label="Bruto maandlast"
            waarde={`${formatEuro(u.maandlast)} p/m`}
            delta={`bij ${renteTekst(u.toetsrente)}% toetsrente, 30 jaar annuitair`}
          />
          <StatTegel
            label="Extra leenruimte door energielabel"
            waarde={formatEuro(u.labelExtra)}
            delta={
              labelGekozen
                ? u.labelExtra > 0
                  ? "vast bedrag per label (art. 4 lid 3)"
                  : "bij label E, F of G hoort geen extra bedrag"
                : "geen energielabel opgegeven"
            }
          />
        </div>
      ) : null}

      {u.maandlastBijEigenRente != null ? (
        <p className="rounded-lg bg-merk-wash p-4 text-sm leading-relaxed text-inkt-zacht">
          Je koos {invoer.rentevastJaren} jaar rentevast; de wet toetst dan op minimaal {renteTekst(u.toetsrente)}% (de
          AFM-toetsrente). Bij je ingevulde rente van {renteTekst(invoer.rentePct)}% is de bruto maandlast ongeveer{" "}
          {formatEuro(u.maandlastBijEigenRente)} per maand.
        </p>
      ) : null}

      {u.maximaal > 0 ? (
        <div className="rounded-[14px] border border-lijn bg-paneel p-5">
          <SectieLabel>NHG-indicatie</SectieLabel>
          {u.nhgMogelijk ? (
            <p className="mt-2 text-sm leading-relaxed text-inkt-zacht">
              Dit bedrag valt binnen de NHG-kostengrens 2026 van {formatEuro(u.nhgGrens)}. Met NHG betaal je eenmalig{" "}
              {provisieLabel} borgtochtprovisie, bij dit bedrag ongeveer{" "}
              {formatEuro(Math.round((u.maximaal * u.nhgProvisiePct) / 100))}.
            </p>
          ) : (
            <p className="mt-2 text-sm leading-relaxed text-inkt-zacht">
              Dit bedrag ligt boven de NHG-kostengrens 2026 van {formatEuro(u.nhgGrens)}; voor het volledige bedrag is
              NHG dan niet mogelijk.
            </p>
          )}
          <p className="mt-2 text-xs text-gedempt">
            Bron: nhg.nl, kostengrens en borgtochtprovisie 2026 (geraadpleegd 2026-07-23). NHG toetst op de koopsom of
            marktwaarde van de woning; die kent deze tool niet, dus dit is een indicatie op het leenbedrag.
          </p>
        </div>
      ) : null}

      <UitklapUitleg titel="Zo rekenen we">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Normbron: Wijzigingsregeling hypothecair krediet 2026, Staatscourant 2025, 36471 (gepubliceerd 31 oktober
            2025, geldend vanaf 1 januari 2026; door ons nagelezen op 23 juli 2026). Daaruit komen de
            financieringslastpercentages; voor jouw invoer is dat {renteTekst(u.gebruiktPct)}% bij een toetsinkomen van{" "}
            {formatEuro(u.toetsinkomen)} en een toetsrente van {renteTekst(u.toetsrente)}%.
          </li>
          <li>
            Maandruimte: toetsinkomen gedeeld door 12, maal dat percentage, min je maandelijkse verplichtingen. Die
            ruimte rekenen we terug naar een hoofdsom over 30 jaar annuitair (360 maandtermijnen), zoals de regeling
            voorschrijft.
          </li>
          <li>Een tweede inkomen telt in 2026 volledig mee (artikel 3, zesde lid).</li>
          <li>
            Rentevast korter dan 10 jaar: toetsing op minimaal de AFM-toetsrente van 5,0% (AFM-publicatie, ongewijzigd
            tot en met Q3 2026, gecontroleerd 23 juli 2026), of je eigen rente als die hoger is.
          </li>
          <li>
            Energielabel: per label blijft een vast bedrag buiten beschouwing (artikel 4, derde lid); dat bedrag telt op
            bij het inkomensdeel en staat hierboven apart benoemd.
          </li>
          <li>
            Rente-voorinvulling: DNB-maandgemiddelden per rentevast-periode, peilmaand {voorinvulling.peilmaand}
            {", "}opgehaald {voorinvulling.opgehaaldOp} ({voorinvulling.bron}). Gemiddelden over banken, geen tarieven
            per geldverstrekker.
          </li>
          <li>NHG-kostengrens en borgtochtprovisie 2026: nhg.nl, geraadpleegd 23 juli 2026.</li>
          <li>
            De bandbreedte van {INDICATIE_MARGE_PCT}% is een indicatiemarge van deze tool, geen onderdeel van de norm: de
            exacte ruimte ligt bij de adviseur en de geldverstrekker.
          </li>
          <li>
            Vereenvoudigingen: we rekenen met de tabellen voor fiscaal aftrekbare rente (de normale situatie bij een
            nieuwe annuiteitenhypotheek) en laten het extra verduurzamingsbudget van artikel 4, vierde lid, hier buiten.
            Een adviseur neemt die details mee.
          </li>
        </ul>
        <p className="mt-3">
          Meer over onze werkwijze staat op de{" "}
          <Link href="/methode" className="underline underline-offset-2 hover:text-merk">
            methodepagina
          </Link>
          .
        </p>
      </UitklapUitleg>

      <LeadCta
        titel="Van indicatie naar echt advies"
        tekst="Deze uitkomst is een indicatie op basis van de wettelijke normen. Een onafhankelijke hypotheekadviseur kijkt naar je volledige situatie en rekent je echte leenruimte en maandlasten door."
        knopTekst="Stel je vraag aan een adviseur"
        href="/hypotheek"
        ontvanger="een onafhankelijke hypotheekadviseur"
      />

      <button type="button" onClick={naarStart} className={knopSecundairCls}>
        Pas je antwoorden aan
      </button>
    </div>
  );
}
