"use client";

import Link from "next/link";
import { useState } from "react";
import {
  GerelateerdeRekenhulpen,
  RekenModule,
  RekenmoduleSamenvatting,
  type SamenvattingRij,
  type StapDefinitie,
} from "@/components/rekenmodule";
import {
  Bandbreedte,
  inputClass,
  LeadCta,
  SectieLabel,
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
 * Budgetberekenaar op het rekenmodule-framework (referentie-implementatie,
 * zie components/rekenmodule/). Deze laag levert alleen de drie vraagstappen,
 * hun validaties en de uitkomst-view; het frame regelt StappenBalk, navigatie,
 * ?stap= in de URL, focus en sessie-persistentie. Er wordt niets verstuurd of
 * opgeslagen buiten de browser; de rekenkern (lib/hypotheek.ts via
 * app/budget/berekening.ts) is puur en draait client-side. De
 * DNB-rente-voorinvulling komt als prop van de serverpagina.
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

  function valideerInkomen(): string | null {
    const i1 = parseBedrag(inkomen1);
    if (i1 == null || i1 < 1) return "Vul je bruto jaarinkomen in, in hele euro's. Afronden mag.";
    if (samen) {
      const i2 = parseBedrag(inkomen2);
      if (i2 == null || i2 < 0) return "Vul ook het bruto jaarinkomen van de tweede aanvrager in, of zet het vinkje uit.";
    }
    return null;
  }

  function valideerSituatie(): string | null {
    if (rentevast == null) return "Kies een rentevaste periode.";
    const r = parseRente(rente);
    if (r == null || r < 0.1 || r > 15) return "Vul de rente in procenten in, bijvoorbeeld 3,74.";
    if (verplichtingen.trim()) {
      const v = parseBedrag(verplichtingen);
      if (v == null || v < 0) return "Vul je maandelijkse verplichtingen in euro in, of laat het veld leeg.";
    }
    if (aow == null) return "Geef aan of je de AOW-leeftijd hebt bereikt.";
    return null;
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

  /** Herstel uit sessionStorage: elk veld eerst op type en waarde controleren. */
  function herstel(data: Record<string, unknown>) {
    if (typeof data.inkomen1 === "string") setInkomen1(data.inkomen1);
    if (typeof data.samen === "boolean") setSamen(data.samen);
    if (typeof data.inkomen2 === "string") setInkomen2(data.inkomen2);
    if (typeof data.rentevast === "number" && (RENTEVAST_KEUZES as readonly number[]).includes(data.rentevast)) {
      setRentevast(data.rentevast as RentevastKeuze);
    }
    if (typeof data.rente === "string") setRente(data.rente);
    if (typeof data.verplichtingen === "string") setVerplichtingen(data.verplichtingen);
    if (data.aow === "ja" || data.aow === "nee") setAow(data.aow);
    if (data.label === "" || ENERGIELABEL_OPTIES.some((o) => o.klasse === data.label)) {
      setLabel(data.label as EnergielabelKlasse | "");
    }
  }

  const dnbGekozen = rentevast != null ? voorinvulling.perKeuze[rentevast] : undefined;

  const stappen: StapDefinitie[] = [
    {
      id: "inkomen",
      titel: "Inkomen",
      vraag: "Wat verdien je?",
      valideer: valideerInkomen,
      inhoud: (
        <>
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
        </>
      ),
    },
    {
      id: "situatie",
      titel: "Situatie",
      vraag: "Wat is jouw situatie?",
      valideer: valideerSituatie,
      inhoud: (
        <>
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
        </>
      ),
    },
    {
      id: "energielabel",
      titel: "Energielabel",
      vraag: "Energielabel van de woning",
      // Optionele stap: geen validatie.
      inhoud: (
        <>
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
        </>
      ),
    },
  ];

  return (
    <RekenModule
      moduleId="budget"
      stappen={stappen}
      uitkomstTitel="Uitkomst"
      uitkomstKnopTekst="Bekijk je uitkomst"
      sessie={{
        snapshot: () => ({ inkomen1, samen, inkomen2, rentevast, rente, verplichtingen, aow, label }),
        herstel,
      }}
      uitkomst={(api) => <Uitkomst invoer={invoer()} voorinvulling={voorinvulling} gaNaarStap={api.gaNaarStap} />}
    />
  );
}

/** Vervolgblok onder de uitkomst: verwante rekenhulpen voor de volgende vraag. */
const GERELATEERD = [
  { titel: "Kosten koper", zin: "Hoeveel eigen geld je nodig hebt bovenop je hypotheek.", href: "/kosten-koper" },
  { titel: "Actuele hypotheekrentes", zin: "De gemiddelde rente per rentevaste periode, met peilmaand.", href: "/hypotheek-rentes" },
  { titel: "Overbieden", zin: "Wat een bod boven de vraagprijs betekent voor je eigen geld.", href: "/overbieden" },
];

function Uitkomst({
  invoer,
  voorinvulling,
  gaNaarStap,
}: {
  invoer: BudgetInvoer;
  voorinvulling: RenteVoorinvulling;
  gaNaarStap: (stapIndex: number) => void;
}) {
  const u = berekenBudget(invoer);
  const labelGekozen = invoer.energielabelKlasse !== undefined;
  const provisieLabel = `${renteTekst(u.nhgProvisiePct)}%`;
  const labelOptie = ENERGIELABEL_OPTIES.find((o) => o.klasse === invoer.energielabelKlasse);

  const samenvatting: SamenvattingRij[] = [
    { label: "Bruto jaarinkomen", waarde: formatEuro(invoer.inkomen1), stapIndex: 0 },
    ...(invoer.inkomen2 !== undefined
      ? [{ label: "Inkomen tweede aanvrager", waarde: formatEuro(invoer.inkomen2), stapIndex: 0 }]
      : []),
    { label: "Rentevast", waarde: `${invoer.rentevastJaren} jaar, ${renteTekst(invoer.rentePct)}%`, stapIndex: 1 },
    {
      label: "Verplichtingen per maand",
      waarde: invoer.verplichtingenPerMaand ? formatEuro(invoer.verplichtingenPerMaand) : "geen",
      stapIndex: 1,
    },
    { label: "AOW-leeftijd bereikt", waarde: invoer.aowLeeftijdBereikt ? "ja" : "nee", stapIndex: 1 },
    { label: "Energielabel", waarde: labelOptie ? labelOptie.label : "niet opgegeven", stapIndex: 2 },
  ];

  return (
    <div className="space-y-5">
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

      <RekenmoduleSamenvatting rijen={samenvatting} gaNaarStap={gaNaarStap} />

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

      <GerelateerdeRekenhulpen items={GERELATEERD} />

      <LeadCta
        titel="Van indicatie naar echt advies"
        tekst="Deze uitkomst is een indicatie op basis van de wettelijke normen. Een onafhankelijke hypotheekadviseur kijkt naar je volledige situatie en rekent je echte leenruimte en maandlasten door."
        knopTekst="Stel je vraag aan een adviseur"
        href="/hypotheek"
        ontvanger="een onafhankelijke hypotheekadviseur"
      />
    </div>
  );
}
