"use client";

import Link from "next/link";
import { useState } from "react";
import {
  BandbreedteInvaart,
  GerelateerdeRekenhulpen,
  KeuzeKaart,
  RekenModule,
  RekenmoduleSamenvatting,
  UitkomstMoment,
  type SamenvattingRij,
  type StapDefinitie,
} from "@/components/rekenmodule";
import {
  EnergieLabelBadge,
  inputClass,
  Kaart,
  LeadCta,
  SectieLabel,
  UitklapUitleg,
  Veld,
  VergelijkTabel,
  VoortgangsBalk,
} from "@/components/ui";
import { formatEuro } from "@/lib/format";
import type { EnergielabelKlasse } from "@/lib/hypotheek";
import { NHG_GRENS_2026 } from "@/lib/normen/leennormen-2026";
import {
  OVB_PEILDATUM,
  STARTERS_LEEFTIJD_TOT,
  STARTERS_WONINGWAARDEGRENS,
} from "@/lib/normen/overdrachtsbelasting-2026";
import type { VerstrekkersRentes } from "@/lib/bronnen/rentes-verstrekkers";
import { berekenKostenKoper, INDICATIE_KOSTEN, INDICATIE_KOSTEN_PEILDATUM } from "@/app/kosten-koper/berekening";
import {
  berekenMaandlastKoopsom,
  berekenMaxHypotheek,
  berekenSpreiding,
  eigenInbrengBovenMax,
  ENERGIELABEL_OPTIES,
  gezamenlijkeStartersStatus,
  INDICATIE_MARGE_PCT,
  nhgBinnenGrens,
  parseBedrag,
  startersStatus,
  TOETS_RENTEVAST_JAREN,
  valideerGeboortejaar,
  valideerInkomen,
  valideerInkomenTweedeKoper,
  valideerKoopsom,
  type StartersStatus,
} from "@/app/hypotheek-berekenen/berekening";

/**
 * Hypotheekberekenaar op het rekenmodule-framework. Deze laag levert alleen de
 * drie vraagstappen, hun validaties en de uitkomst-view; het frame regelt
 * StappenBalk, navigatie, ?stap= in de URL, focus en sessie-persistentie.
 * Alle rekenregels zitten in lib/hypotheek.ts, lib/normen en
 * app/kosten-koper/berekening.ts; app/hypotheek-berekenen/berekening.ts is de
 * pure mapping-laag. Er wordt niets verstuurd of opgeslagen buiten de browser;
 * de DNB-rente en de verstrekkerstarieven komen als props van de serverpagina.
 */

export type RenteContext = {
  /** DNB-gemiddelde rente in procenten voor het rentevast-uitgangspunt van de tool. */
  pct: number;
  /** Maand waarop het DNB-cijfer slaat, bv. "mei 2026". */
  peilmaand: string;
  /** Datum waarop de snapshot is opgehaald, "YYYY-MM-DD". */
  opgehaaldOp: string;
  /** Letterlijke DNB-bronvermelding voor de methode-uitleg. */
  bron: string;
};

/** 3.74 -> "3,74" voor lopende tekst. */
function renteTekst(pct: number): string {
  return String(pct).replace(".", ",");
}

export function HypotheekBerekenenStepper({
  rente,
  verstrekkers,
}: {
  /** null als de DNB-snapshot geen bucket voor het uitgangspunt heeft (dan zeggen we dat eerlijk). */
  rente: RenteContext | null;
  verstrekkers: VerstrekkersRentes;
}) {
  const [wie, setWie] = useState<"alleen" | "samen" | null>(null);
  const [geboortejaar1, setGeboortejaar1] = useState("");
  const [geboortejaar2, setGeboortejaar2] = useState("");
  const [nietEerderGebruikt, setNietEerderGebruikt] = useState(false);
  const [inkomen1, setInkomen1] = useState("");
  const [inkomen2, setInkomen2] = useState("");
  const [koopsom, setKoopsom] = useState("");
  const [label, setLabel] = useState<EnergielabelKlasse | "">("");

  const huidigJaar = new Date().getFullYear();
  const samen = wie === "samen";

  /** Starters-indicatie uit de ingevulde geboortejaren; "nee" zolang ze niet geldig zijn. */
  function huidigeStartersStatus(): StartersStatus {
    const jaren = [geboortejaar1, ...(samen ? [geboortejaar2] : [])];
    if (jaren.some((j) => valideerGeboortejaar(j, huidigJaar) !== null)) return "nee";
    return gezamenlijkeStartersStatus(jaren.map((j) => startersStatus(Number(j.trim()), huidigJaar)));
  }

  function valideerSituatie(): string | null {
    if (wie == null) return "Kies of je alleen of samen koopt.";
    const g1 = valideerGeboortejaar(geboortejaar1, huidigJaar);
    if (g1) return g1;
    if (samen) {
      const g2 = valideerGeboortejaar(geboortejaar2, huidigJaar);
      if (g2) return `Tweede koper: ${g2.charAt(0).toLowerCase()}${g2.slice(1)}`;
    }
    return null;
  }

  function valideerInkomenStap(): string | null {
    const m1 = valideerInkomen(inkomen1);
    if (m1) return m1;
    if (samen) return valideerInkomenTweedeKoper(inkomen2);
    return null;
  }

  function valideerWoning(): string | null {
    return valideerKoopsom(koopsom);
  }

  /** Herstel uit sessionStorage: elk veld eerst op type en waarde controleren. */
  function herstel(data: Record<string, unknown>) {
    if (data.wie === "alleen" || data.wie === "samen") setWie(data.wie);
    if (typeof data.geboortejaar1 === "string") setGeboortejaar1(data.geboortejaar1);
    if (typeof data.geboortejaar2 === "string") setGeboortejaar2(data.geboortejaar2);
    if (typeof data.nietEerderGebruikt === "boolean") setNietEerderGebruikt(data.nietEerderGebruikt);
    if (typeof data.inkomen1 === "string") setInkomen1(data.inkomen1);
    if (typeof data.inkomen2 === "string") setInkomen2(data.inkomen2);
    if (typeof data.koopsom === "string") setKoopsom(data.koopsom);
    if (data.label === "" || ENERGIELABEL_OPTIES.some((o) => o.klasse === data.label)) {
      setLabel(data.label as EnergielabelKlasse | "");
    }
  }

  const status = huidigeStartersStatus();
  const koopsomGetal = parseBedrag(koopsom);

  const stappen: StapDefinitie[] = [
    {
      id: "situatie",
      titel: "Situatie",
      vraag: "Hoe ga je kopen?",
      valideer: valideerSituatie,
      inhoud: (
        <>
          <fieldset>
            <legend className="mb-2 block text-sm font-medium text-inkt">Koop je alleen of samen?</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              <KeuzeKaart
                naam="wie_keuze"
                waarde="alleen"
                checked={wie === "alleen"}
                onKies={() => setWie("alleen")}
                titel="Ik koop alleen"
              />
              <KeuzeKaart
                naam="wie_keuze"
                waarde="samen"
                checked={wie === "samen"}
                onKies={() => setWie("samen")}
                titel="We kopen samen"
              />
            </div>
          </fieldset>
          <Veld
            label={samen ? "Geboortejaar eerste koper" : "Geboortejaar"}
            hint="We vragen dit alleen voor de overdrachtsbelasting: tot 35 jaar kan de eenmalige startersvrijstelling gelden. Er wordt niets opgeslagen of verstuurd."
          >
            <input
              type="text"
              inputMode="numeric"
              placeholder="1994"
              value={geboortejaar1}
              onChange={(e) => setGeboortejaar1(e.target.value)}
              className={inputClass}
            />
          </Veld>
          {samen ? (
            <Veld label="Geboortejaar tweede koper">
              <input
                type="text"
                inputMode="numeric"
                placeholder="1996"
                value={geboortejaar2}
                onChange={(e) => setGeboortejaar2(e.target.value)}
                className={inputClass}
              />
            </Veld>
          ) : null}
          {status === "mogelijk" ? (
            <label className="flex items-start gap-3 text-sm leading-relaxed text-inkt">
              <input
                type="checkbox"
                checked={nietEerderGebruikt}
                onChange={(e) => setNietEerderGebruikt(e.target.checked)}
                className="mt-0.5 accent-merk"
              />
              <span>
                {samen
                  ? "Wij hebben de startersvrijstelling geen van beiden eerder gebruikt"
                  : "Ik heb de startersvrijstelling nog niet eerder gebruikt"}
                <span className="mt-1 block text-xs text-gedempt">
                  De vrijstelling is eenmalig en geldt in 2026 tot een woningwaarde van{" "}
                  {formatEuro(STARTERS_WONINGWAARDEGRENS)}.
                </span>
              </span>
            </label>
          ) : null}
        </>
      ),
    },
    {
      id: "inkomen",
      titel: "Inkomen",
      vraag: samen ? "Wat verdienen jullie?" : "Wat verdien je?",
      valideer: valideerInkomenStap,
      inhoud: (
        <>
          <Veld
            label={samen ? "Bruto jaarinkomen eerste koper" : "Bruto jaarinkomen"}
            hint="Je bruto inkomen per jaar, inclusief vakantiegeld en vaste toeslagen. Afronden mag."
          >
            <input
              type="text"
              inputMode="numeric"
              placeholder="48000"
              value={inkomen1}
              onChange={(e) => setInkomen1(e.target.value)}
              className={inputClass}
            />
          </Veld>
          {samen ? (
            <Veld
              label="Bruto jaarinkomen tweede koper"
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
          <p className="text-xs leading-relaxed text-gedempt">
            Studieschuld of andere lopende leningen vragen we hier niet, maar die verlagen je echte maximum wel. Wil je
            maandelijkse verplichtingen meerekenen, gebruik dan de{" "}
            <Link href="/budget" className="underline underline-offset-2 hover:text-merk">
              budgetberekenaar
            </Link>
            .
          </p>
        </>
      ),
    },
    {
      id: "woning",
      titel: "Woning",
      vraag: "Welke woning heb je op het oog?",
      valideer: valideerWoning,
      inhoud: (
        <>
          <Veld label="Verwachte koopsom" hint="In hele euro's. Ook een ruwe schatting is een goed startpunt.">
            <input
              type="text"
              inputMode="numeric"
              placeholder="350000"
              value={koopsom}
              onChange={(e) => setKoopsom(e.target.value)}
              className={inputClass}
            />
          </Veld>
          {koopsomGetal != null && koopsomGetal >= 1 ? (
            <p className="rounded-lg bg-merk-wash p-4 text-sm leading-relaxed text-inkt-zacht">
              {nhgBinnenGrens(koopsomGetal)
                ? `NHG is bij deze koopsom mogelijk: de koopsom valt binnen de NHG-kostengrens 2026 van ${formatEuro(NHG_GRENS_2026)}. Daarom hoef je er hier niets over in te vullen.`
                : `NHG is bij deze koopsom niet mogelijk: de koopsom ligt boven de NHG-kostengrens 2026 van ${formatEuro(NHG_GRENS_2026)}.`}{" "}
              Bron: nhg.nl, geraadpleegd 23 juli 2026.
            </p>
          ) : null}
          <fieldset>
            <legend className="mb-2 block text-sm font-medium text-inkt">Energielabel van de woning</legend>
            <p className="mb-3 text-sm leading-relaxed text-inkt-zacht">
              Optioneel. Een beter energielabel geeft meer leenruimte: de wet laat per label een vast bedrag buiten
              beschouwing, bovenop wat je op basis van je inkomen kunt lenen.
            </p>
            <div className="space-y-2">
              <KeuzeKaart
                naam="label_keuze"
                waarde=""
                checked={label === ""}
                onKies={() => setLabel("")}
                titel="Weet ik niet of nog geen woning op het oog"
                meta="geen labelbedrag"
              />
              {ENERGIELABEL_OPTIES.map((o) => (
                <KeuzeKaart
                  key={o.klasse}
                  naam="label_keuze"
                  waarde={o.klasse}
                  checked={label === o.klasse}
                  onKies={() => setLabel(o.klasse)}
                  voor={o.badges.map((b) => (
                    <EnergieLabelBadge key={b} label={b} klein />
                  ))}
                  titel={o.label}
                  meta={o.bedrag > 0 ? `+ ${formatEuro(o.bedrag)}` : "geen extra bedrag"}
                />
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
      moduleId="hypotheek-berekenen"
      stappen={stappen}
      uitkomstTitel="Uitkomst"
      uitkomstKnopTekst="Bekijk je uitkomst"
      sessie={{
        snapshot: () => ({ wie, geboortejaar1, geboortejaar2, nietEerderGebruikt, inkomen1, inkomen2, koopsom, label }),
        herstel,
      }}
      uitkomst={(api) => (
        <Uitkomst
          rente={rente}
          verstrekkers={verstrekkers}
          samen={samen}
          geboortejaar1={geboortejaar1}
          geboortejaar2={geboortejaar2}
          nietEerderGebruikt={nietEerderGebruikt}
          inkomen1={parseBedrag(inkomen1) ?? 0}
          inkomen2={samen ? (parseBedrag(inkomen2) ?? 0) : undefined}
          koopsom={parseBedrag(koopsom) ?? 0}
          labelKlasse={label === "" ? undefined : label}
          gaNaarStap={api.gaNaarStap}
        />
      )}
    />
  );
}

/** Vervolgblok onder de uitkomst: verder rekenen en lezen. */
const GERELATEERD = [
  { titel: "Kosten koper", zin: "De overdrachtsbelasting en bijkomende kosten, per post uitgelegd.", href: "/kosten-koper" },
  { titel: "Budgetberekenaar", zin: "Rekent ook AOW, maandelijkse verplichtingen en je eigen rente mee.", href: "/budget" },
  { titel: "Woongids", zin: "Stap voor stap door het koopproces, van zoeken tot sleutel.", href: "/gids" },
];

function Uitkomst({
  rente,
  verstrekkers,
  samen,
  geboortejaar1,
  geboortejaar2,
  nietEerderGebruikt,
  inkomen1,
  inkomen2,
  koopsom,
  labelKlasse,
  gaNaarStap,
}: {
  rente: RenteContext | null;
  verstrekkers: VerstrekkersRentes;
  samen: boolean;
  geboortejaar1: string;
  geboortejaar2: string;
  nietEerderGebruikt: boolean;
  inkomen1: number;
  inkomen2?: number;
  koopsom: number;
  labelKlasse?: EnergielabelKlasse;
  gaNaarStap: (stapIndex: number) => void;
}) {
  const huidigJaar = new Date().getFullYear();
  const jaren = [geboortejaar1, ...(samen ? [geboortejaar2] : [])].map((j) => Number(j.trim()));
  const statussen = jaren.map((j) => startersStatus(j, huidigJaar));
  const status = gezamenlijkeStartersStatus(statussen);
  const starter = status === "mogelijk" && nietEerderGebruikt;

  const max = rente ? berekenMaxHypotheek({ inkomen1, inkomen2, energielabelKlasse: labelKlasse, rentePct: rente.pct }) : null;
  const maandlast = rente ? berekenMaandlastKoopsom(koopsom, rente.pct) : null;
  const spreiding = berekenSpreiding(koopsom, verstrekkers);
  const eigenGeld = berekenKostenKoper({ koopsom, starter });
  const tekort = max ? eigenInbrengBovenMax(koopsom, max.maximaal) : 0;
  const nhgKan = nhgBinnenGrens(koopsom);
  const labelOptie = ENERGIELABEL_OPTIES.find((o) => o.klasse === labelKlasse);

  const samenvatting: SamenvattingRij[] = [
    { label: "Kopers", waarde: samen ? "samen" : "alleen", stapIndex: 0 },
    { label: samen ? "Geboortejaren" : "Geboortejaar", waarde: samen ? `${geboortejaar1} en ${geboortejaar2}` : geboortejaar1, stapIndex: 0 },
    { label: "Bruto jaarinkomen", waarde: formatEuro(inkomen1), stapIndex: 1 },
    ...(inkomen2 !== undefined ? [{ label: "Inkomen tweede koper", waarde: formatEuro(inkomen2), stapIndex: 1 }] : []),
    { label: "Verwachte koopsom", waarde: formatEuro(koopsom), stapIndex: 2 },
    { label: "Energielabel", waarde: labelOptie ? labelOptie.label : "niet opgegeven", stapIndex: 2 },
  ];

  return (
    <div className="space-y-5">
      {/* Kaart 1: maximale hypotheek */}
      {rente && max ? (
        <UitkomstMoment label="Maximale hypotheek (indicatie)" waarde={formatEuro(max.maximaal)}>
          {max.maximaal > 0 ? (
            <>
              <BandbreedteInvaart laag={max.laag} waarde={max.maximaal} hoog={max.hoog} />
              <p className="mt-4 text-sm leading-relaxed text-inkt-zacht">
                Gerekend met {TOETS_RENTEVAST_JAREN} jaar rentevast op de gemiddelde bancaire rente van{" "}
                {renteTekst(rente.pct)}%; vanaf tien jaar rentevast is dat meteen de toetsrente ({renteTekst(max.toetsrente)}
                %).{" "}
                {labelKlasse
                  ? max.labelExtra > 0
                    ? `Daarvan is ${formatEuro(max.labelExtra)} extra leenruimte door het energielabel.`
                    : "Bij label E, F of G hoort geen extra leenruimtebedrag."
                  : "Zonder energielabel rekenen we geen extra leenruimtebedrag mee."}{" "}
                De bandbreedte is een indicatiemarge van {INDICATIE_MARGE_PCT}% omlaag en omhoog van deze tool.
              </p>
            </>
          ) : (
            <p className="mt-4 text-sm leading-relaxed text-inkt-zacht">
              Op basis van dit inkomen is er volgens de wettelijke tabellen nu geen leenruimte. Dat is de eerlijke
              uitkomst van de norm; een adviseur kan meekijken of er in jouw situatie toch mogelijkheden zijn.
            </p>
          )}
          <p className="mt-3 text-xs text-gedempt">
            Bron: wettelijke leennormen 2026 (Staatscourant 2025, 36471, geldend vanaf 1 januari 2026; nagelezen 23 juli
            2026) en DNB-rentegemiddelden, peilmaand {rente.peilmaand}, opgehaald {rente.opgehaaldOp}. Een indicatie,
            geen offerte en geen advies.
          </p>
        </UitkomstMoment>
      ) : (
        <Kaart>
          <SectieLabel>Maximale hypotheek</SectieLabel>
          <p className="mt-2 text-sm leading-relaxed text-inkt-zacht">
            De actuele DNB-rente is nu niet beschikbaar, dus we kunnen je maximale hypotheek niet eerlijk berekenen.
            Probeer het later opnieuw, of gebruik de{" "}
            <Link href="/budget" className="underline underline-offset-2 hover:text-merk">
              budgetberekenaar
            </Link>{" "}
            met je eigen rente.
          </p>
        </Kaart>
      )}

      {/* Kaart 2: maandlasten bij de actuele rente, met spreiding over verstrekkers */}
      <Kaart>
        <SectieLabel>Maandlasten voor deze koopsom</SectieLabel>
        {rente && maandlast != null ? (
          <>
            <p className="mt-3 font-display text-3xl font-semibold tabular-nums text-merk">
              {formatEuro(maandlast)} <span className="text-base font-normal text-inkt-zacht">per maand</span>
            </p>
            <p className="mt-2 text-sm leading-relaxed text-inkt-zacht">
              Bruto, bij de gemiddelde bancaire rente van {renteTekst(rente.pct)}% (DNB, peilmaand {rente.peilmaand}),
              30 jaar annuitair, als je de volledige koopsom van {formatEuro(koopsom)} leent. Je eigen rente en
              aflossingsvorm bepalen de echte maandlast; belastingteruggave is niet meegerekend.
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm leading-relaxed text-inkt-zacht">
            Zonder de actuele DNB-rente kunnen we de maandlast bij het gemiddelde niet tonen. Hieronder zie je wel de
            tarieven per geldverstrekker, als die beschikbaar zijn.
          </p>
        )}
        {tekort > 0 ? (
          <p className="mt-3 rounded-lg bg-merk-wash p-4 text-sm leading-relaxed text-inkt-zacht">
            Let op: deze koopsom ligt {formatEuro(tekort)} boven je maximale hypotheek. Dat deel kun je niet lenen; het
            komt boven op het eigen geld hieronder.
          </p>
        ) : null}
        <div className="mt-4">
          {spreiding.length > 0 ? (
            <>
              <p className="mb-2 text-sm font-semibold text-inkt">Spreiding over geldverstrekkers ({TOETS_RENTEVAST_JAREN} jaar rentevast)</p>
              <VergelijkTabel
                koppen={["Geldverstrekker", "NHG", "Rente", "Maandlast"]}
                rijen={spreiding.map((r) => [
                  <span key="v">
                    <a href={r.bronUrl} target="_blank" rel="noreferrer" className="font-medium underline underline-offset-2 hover:text-merk">
                      {r.verstrekker}
                    </a>
                    <span className="block text-xs text-gedempt">{r.product}</span>
                  </span>,
                  r.nhg === "ja" ? "met NHG" : r.nhg === "nee" ? "zonder NHG" : "onbekend",
                  <span key="r" className="tabular-nums">{renteTekst(r.rentePct)}%</span>,
                  <span key="m" className="tabular-nums">{formatEuro(r.maandlast)} p/m</span>,
                ])}
                bron={`${verstrekkers.bron}, peildatum ${verstrekkers.peildatum}. Alfabetisch, geen volgorde van goed naar slecht; tarieven gelden onder voorwaarden van de bank zelf.`}
              />
              {!nhgKan ? (
                <p className="mt-2 text-xs text-gedempt">
                  Bij deze koopsom is NHG niet mogelijk (boven de kostengrens 2026 van {formatEuro(NHG_GRENS_2026)});
                  tarieven met NHG gelden dan niet voor jou.
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-sm leading-relaxed text-gedempt">
              Actuele tarieven per geldverstrekker zijn nu niet beschikbaar. Verouderde tarieven tonen zou misleiden,
              dus dan tonen we liever niets.
            </p>
          )}
        </div>
        <p className="mt-3 text-xs text-gedempt">
          Bron maandlast: DNB-rentegemiddelden{rente ? `, peilmaand ${rente.peilmaand}, opgehaald ${rente.opgehaaldOp}` : ""}.
          NHG-kostengrens 2026: nhg.nl, geraadpleegd 23 juli 2026.
        </p>
      </Kaart>

      {/* Kaart 3: benodigd eigen geld */}
      <Kaart>
        <SectieLabel>Benodigd eigen geld (indicatie)</SectieLabel>
        <p className="mt-3 font-display text-3xl font-semibold tabular-nums text-merk">{formatEuro(eigenGeld.eigenGeldMinimaal)}</p>
        <p className="mt-2 text-sm leading-relaxed text-inkt-zacht">
          Sinds 2018 kun je maximaal 100% van de woningwaarde lenen; de kosten koper betaal je uit eigen zak.
        </p>
        {/* Flux-echo: samenstellings-grafiekje van het eigen geld, met
            lavendel als tweede reeks (zelfde balk als bij /kosten-koper);
            de legenda met kleurdots is meteen de postenlijst. */}
        <VoortgangsBalk
          className="mt-4"
          formatteer={formatEuro}
          segmenten={[
            {
              label: eigenGeld.ovb.vrijstellingToegepast
                ? "Overdrachtsbelasting (startersvrijstelling, 0%)"
                : `Overdrachtsbelasting (${renteTekst(eigenGeld.ovb.tariefPct)}%)`,
              waarde: eigenGeld.ovb.belasting,
              kleur: "merk",
            },
            ...INDICATIE_KOSTEN.map((k, i) => ({
              label: `${k.label} (indicatie)`,
              waarde: k.bedrag,
              kleur: (["lavendel", "amber", "neutraal"] as const)[i % 3],
            })),
          ]}
        />
        {eigenGeld.ovb.vrijstellingVervallenDoorWaardegrens ? (
          <p className="mt-3 rounded-lg bg-merk-wash p-4 text-sm leading-relaxed text-inkt-zacht">
            Je voldoet aan de leeftijdsvoorwaarde, maar boven de {formatEuro(STARTERS_WONINGWAARDEGRENS)} vervalt de
            startersvrijstelling helemaal: er geldt dan 2% over de hele koopsom.
          </p>
        ) : null}
        {status === "grensjaar" ? (
          <p className="mt-3 rounded-lg bg-merk-wash p-4 text-sm leading-relaxed text-inkt-zacht">
            {samen ? "Een van jullie wordt" : "Je wordt"} dit jaar {STARTERS_LEEFTIJD_TOT}: de startersvrijstelling geldt
            dan alleen als de overdracht voor de verjaardag valt. We rekenen hier zonder vrijstelling; de notaris bepaalt
            het precies.
          </p>
        ) : null}
        {status === "nee" && statussen.includes("mogelijk") ? (
          <p className="mt-3 rounded-lg bg-merk-wash p-4 text-sm leading-relaxed text-inkt-zacht">
            Een van jullie voldoet mogelijk wel aan de leeftijdsvoorwaarde voor de startersvrijstelling. Over dat deel
            van de woning kan dan toch vrijstelling gelden; de notaris rekent dat per persoon uit. Wij rekenen hier
            zonder vrijstelling.
          </p>
        ) : null}
        {tekort > 0 ? (
          <p className="mt-3 text-sm leading-relaxed text-inkt-zacht">
            Daar komt bij deze koopsom nog {formatEuro(tekort)} bij: het deel boven je maximale hypotheek.
          </p>
        ) : null}
        <p className="mt-3 text-xs text-gedempt">
          Bron overdrachtsbelasting: Wet op belastingen van rechtsverkeer, artikel 14 en 15 (wetten.overheid.nl, geldend
          vanaf 1 januari 2026; nagelezen {OVB_PEILDATUM}). Notaris, advies en taxatie zijn afgeronde middenbedragen,
          peildatum {INDICATIE_KOSTEN_PEILDATUM}; de echte bedragen verschillen per aanbieder.
        </p>
      </Kaart>

      <RekenmoduleSamenvatting rijen={samenvatting} gaNaarStap={gaNaarStap} />

      <UitklapUitleg titel="Zo rekenen we">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Maximale hypotheek: de wettelijke leennormen 2026 (Wijzigingsregeling hypothecair krediet 2026,
            Staatscourant 2025, 36471, geldend vanaf 1 januari 2026; door ons nagelezen op 23 juli 2026).
            {max
              ? ` Voor jouw invoer is het financieringslastpercentage ${renteTekst(max.gebruiktPct)}% bij een toetsinkomen van ${formatEuro(max.toetsinkomen)} en een toetsrente van ${renteTekst(max.toetsrente)}%.`
              : ""}{" "}
            De ruimte per maand rekenen we terug naar een hoofdsom over 30 jaar annuitair (360 maandtermijnen), zoals de
            regeling voorschrijft. Een tweede inkomen telt in 2026 volledig mee (artikel 3, zesde lid).
          </li>
          <li>
            Rente: we rekenen met {TOETS_RENTEVAST_JAREN} jaar rentevast op het DNB-maandgemiddelde voor die periode
            {rente ? ` (${renteTekst(rente.pct)}%, peilmaand ${rente.peilmaand}, opgehaald ${rente.opgehaaldOp}; ${rente.bron})` : ""}.
            Dat zijn gemiddelden over banken, geen tarieven per geldverstrekker. Vanaf tien jaar rentevast toetst de wet
            op de werkelijke rente, dus dit gemiddelde is ook de toetsrente.
          </li>
          <li>
            Energielabel: per label blijft een vast bedrag buiten beschouwing (artikel 4, derde lid); dat bedrag telt op
            bij het inkomensdeel en staat in de eerste kaart apart benoemd.
          </li>
          <li>
            Maandlasten: bruto maandbedragen over de volledige koopsom, 30 jaar annuitair. De tarieven per
            geldverstrekker komen maandelijks van de websites van de banken zelf
            {verstrekkers.beschikbaar ? ` (peildatum ${verstrekkers.peildatum})` : ""} en staan alfabetisch; wij zetten er
            geen volgorde of oordeel in.
          </li>
          <li>
            Eigen geld: overdrachtsbelasting volgens de Wet op belastingen van rechtsverkeer (2%, 0% met
            startersvrijstelling tot {formatEuro(STARTERS_WONINGWAARDEGRENS)}; nagelezen {OVB_PEILDATUM}), plus
            afgeronde middenbedragen voor notaris, advies en taxatie (peildatum {INDICATIE_KOSTEN_PEILDATUM}). We
            gebruiken de koopsom als benadering van de woningwaarde.
          </li>
          <li>
            Startersvrijstelling: we kennen alleen je geboortejaar, niet je geboortedatum. Leeftijden rekenen we per
            kalenderjaar; dat is een indicatie, de notaris toetst de echte voorwaarden op de overdrachtsdatum.
          </li>
          <li>NHG: de kostengrens 2026 komt van nhg.nl (geraadpleegd 23 juli 2026); NHG toetst op de koopsom.</li>
          <li>
            Vereenvoudigingen: we rekenen met de tabellen voor wie de AOW-leeftijd nog niet heeft bereikt, zonder
            bestaande maandelijkse verplichtingen en zonder studieschuld. Die verlagen je echte maximum; de{" "}
            <Link href="/budget" className="underline underline-offset-2 hover:text-merk">
              budgetberekenaar
            </Link>{" "}
            vraagt er wel naar. De bandbreedte van {INDICATIE_MARGE_PCT}% is een indicatiemarge van deze tool, geen
            onderdeel van de norm.
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
        tekst="Deze uitkomst is informatie op basis van de wettelijke normen en actuele gemiddelden, geen advies. Een onafhankelijke hypotheekadviseur kijkt naar je volledige situatie en rekent je echte leenruimte en maandlasten door."
        knopTekst="Stel je vraag aan een adviseur"
        href="/hypotheek"
        ontvanger="een onafhankelijke hypotheekadviseur"
      />
    </div>
  );
}
