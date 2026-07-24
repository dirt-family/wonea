"use client";

import Link from "next/link";
import { useState } from "react";
import {
  GerelateerdeRekenhulpen,
  KeuzeKaart,
  RekenModule,
  RekenmoduleSamenvatting,
  UitkomstMoment,
  type SamenvattingRij,
  type StapDefinitie,
} from "@/components/rekenmodule";
import { inputClass, LeadCta, UitklapUitleg, VoortgangsBalk } from "@/components/ui";
import { formatEuro } from "@/lib/format";
import {
  OVB_PEILDATUM,
  OVB_TARIEF_HOOFDVERBLIJF_PCT,
  OVB_TARIEF_WONING_OVERIG_PCT,
  STARTERS_LEEFTIJD_TOT,
  STARTERS_LEEFTIJD_VANAF,
  STARTERS_WONINGWAARDEGRENS,
} from "@/lib/normen/overdrachtsbelasting-2026";
import {
  berekenKostenKoper,
  INDICATIE_KOSTEN,
  klemKoopsom,
  KOOPSOM_DEFAULT,
  KOOPSOM_MAX,
  KOOPSOM_MIN,
  KOOPSOM_STAP,
  type KostenKoperUitkomst,
} from "@/app/kosten-koper/berekening";

/**
 * Kosten-koper-rekenhulp op het rekenmodule-framework (components/rekenmodule/).
 * Deze laag levert alleen de twee vraagstappen (koopsom; jouw situatie met
 * hoofdverblijf ja/nee en de starterscheckbox) plus de uitkomst-view; het
 * frame regelt StappenBalk, navigatie, ?stap= in de URL, focus en
 * sessie-persistentie. Rekent volledig client-side met pure functies
 * (lib/normen/overdrachtsbelasting-2026.ts via berekening.ts); er wordt
 * niets opgeslagen of verstuurd buiten de browser.
 */

export function KostenKoperStepper() {
  const [koopsomInvoer, setKoopsomInvoer] = useState(String(KOOPSOM_DEFAULT));
  const [hoofdverblijf, setHoofdverblijf] = useState<"ja" | "nee" | null>(null);
  const [starter, setStarter] = useState(false);

  const koopsom = klemKoopsom(Number(koopsomInvoer.replace(/[^\d]/g, "")));
  const zelfWonen = hoofdverblijf !== "nee";
  // Zonder zelfbewoning bestaat er geen startersvrijstelling; het vinkje telt dan niet mee.
  const u = berekenKostenKoper({ koopsom, starter: zelfWonen && starter, hoofdverblijf: zelfWonen });

  function valideerKoopsom(): string | null {
    if (!koopsomInvoer.replace(/[^\d]/g, "")) return "Vul de koopsom in hele euro's in, of gebruik de schuif.";
    return null;
  }

  function valideerSituatie(): string | null {
    if (hoofdverblijf == null) return "Geef aan of je zelf in de woning gaat wonen.";
    return null;
  }

  /** Herstel uit sessionStorage: elk veld eerst op type en waarde controleren. */
  function herstel(data: Record<string, unknown>) {
    if (typeof data.koopsom === "string") setKoopsomInvoer(data.koopsom);
    if (data.hoofdverblijf === "ja" || data.hoofdverblijf === "nee") setHoofdverblijf(data.hoofdverblijf);
    if (typeof data.starter === "boolean") setStarter(data.starter);
  }

  const stappen: StapDefinitie[] = [
    {
      id: "koopsom",
      titel: "Koopsom",
      vraag: "Wat is de koopsom?",
      valideer: valideerKoopsom,
      inhoud: (
        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-inkt">Koopsom</span>
            <input
              type="range"
              min={KOOPSOM_MIN}
              max={KOOPSOM_MAX}
              step={KOOPSOM_STAP}
              value={koopsom}
              onChange={(e) => setKoopsomInvoer(e.target.value)}
              className="w-full accent-merk"
              aria-label="Koopsom instellen"
            />
            <span className="mt-1 flex justify-between text-xs tabular-nums text-gedempt">
              <span>{formatEuro(KOOPSOM_MIN)}</span>
              <span>{formatEuro(KOOPSOM_MAX)}</span>
            </span>
          </label>
          <label className="block sm:w-44">
            <span className="mb-1 block text-sm font-medium text-inkt">Of typ een bedrag</span>
            <input
              inputMode="numeric"
              placeholder={`bv. ${KOOPSOM_DEFAULT}`}
              value={koopsomInvoer}
              onChange={(e) => setKoopsomInvoer(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>
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
            <legend className="mb-2 block text-sm font-medium text-inkt">
              Ga je zelf in de woning wonen, als hoofdverblijf?
            </legend>
            <div className="space-y-2">
              <KeuzeKaart
                naam="hoofdverblijf_keuze"
                waarde="ja"
                checked={hoofdverblijf === "ja"}
                onKies={() => setHoofdverblijf("ja")}
                titel="Ja, ik ga er zelf wonen"
                meta={`${OVB_TARIEF_HOOFDVERBLIJF_PCT}% of 0% belasting`}
              />
              <KeuzeKaart
                naam="hoofdverblijf_keuze"
                waarde="nee"
                checked={hoofdverblijf === "nee"}
                onKies={() => setHoofdverblijf("nee")}
                titel="Nee, bijvoorbeeld verhuur of een tweede woning"
                meta={`${String(OVB_TARIEF_WONING_OVERIG_PCT).replace(".", ",")}% belasting`}
              />
            </div>
          </fieldset>

          {hoofdverblijf === "ja" ? (
            <KeuzeKaart
              soort="checkbox"
              checked={starter}
              onKies={() => setStarter(!starter)}
              titel="Ik kom in aanmerking voor de startersvrijstelling"
            >
              <ul className="mt-1 list-disc space-y-1 pl-4 text-xs leading-relaxed text-gedempt">
                <li>
                  Je bent {STARTERS_LEEFTIJD_VANAF} tot {STARTERS_LEEFTIJD_TOT} jaar op het moment van de overdracht bij
                  de notaris.
                </li>
                <li>Je gaat zelf in de woning wonen, als hoofdverblijf.</li>
                <li>Je hebt de vrijstelling niet eerder gebruikt; het kan maar een keer.</li>
                <li>
                  De woningwaarde is niet hoger dan {formatEuro(STARTERS_WONINGWAARDEGRENS)} (grens 2026); dat toetst
                  deze rekenhulp zelf op de koopsom.
                </li>
              </ul>
            </KeuzeKaart>
          ) : null}

          {hoofdverblijf === "nee" ? (
            <p className="rounded-lg bg-merk-wash p-4 text-sm leading-relaxed text-inkt-zacht">
              Koop je niet om er zelf te wonen, dan geldt sinds 2026 een tarief van{" "}
              {String(OVB_TARIEF_WONING_OVERIG_PCT).replace(".", ",")}% overdrachtsbelasting. De startersvrijstelling is
              dan niet mogelijk: die vereist dat je er zelf gaat wonen.
            </p>
          ) : null}

          {hoofdverblijf === "ja" && starter && u.ovb.vrijstellingVervallenDoorWaardegrens ? (
            <p className="rounded-lg bg-merk-wash p-4 text-sm leading-relaxed text-inkt-zacht">
              Boven de {formatEuro(STARTERS_WONINGWAARDEGRENS)} vervalt de startersvrijstelling helemaal, er is geen
              gedeeltelijke vrijstelling. Je betaalt dan {OVB_TARIEF_HOOFDVERBLIJF_PCT}% over de hele koopsom.
            </p>
          ) : null}
        </>
      ),
    },
  ];

  return (
    <RekenModule
      moduleId="kosten-koper"
      stappen={stappen}
      uitkomstTitel="Uitkomst"
      uitkomstKnopTekst="Bekijk je uitkomst"
      sessie={{
        snapshot: () => ({ koopsom: koopsomInvoer, hoofdverblijf, starter }),
        herstel,
      }}
      uitkomst={(api) => (
        <Uitkomst
          u={u}
          koopsom={koopsom}
          zelfWonen={zelfWonen}
          starter={zelfWonen && starter}
          gaNaarStap={api.gaNaarStap}
        />
      )}
    />
  );
}

/** Vervolgblok onder de uitkomst: verwante rekenhulpen voor de volgende vraag. */
const GERELATEERD = [
  { titel: "Hoeveel kan ik lenen?", zin: "Je maximale hypotheek en bruto maandlast volgens de leennormen 2026.", href: "/budget" },
  { titel: "Actuele hypotheekrentes", zin: "De gemiddelde rente per rentevaste periode, met peilmaand.", href: "/hypotheek-rentes" },
];

function Uitkomst({
  u,
  koopsom,
  zelfWonen,
  starter,
  gaNaarStap,
}: {
  u: KostenKoperUitkomst;
  koopsom: number;
  zelfWonen: boolean;
  starter: boolean;
  gaNaarStap: (stapIndex: number) => void;
}) {
  const belastingLabel = u.ovb.vrijstellingToegepast
    ? "Overdrachtsbelasting (startersvrijstelling, 0%)"
    : `Overdrachtsbelasting (${String(u.ovb.tariefPct).replace(".", ",")}%)`;

  const samenvatting: SamenvattingRij[] = [
    { label: "Koopsom", waarde: formatEuro(koopsom), stapIndex: 0 },
    { label: "Zelf wonen (hoofdverblijf)", waarde: zelfWonen ? "ja" : "nee", stapIndex: 1 },
    ...(zelfWonen ? [{ label: "Startersvrijstelling", waarde: starter ? "ja" : "nee", stapIndex: 1 }] : []),
  ];

  return (
    <div className="space-y-5">
      {u.ovb.vrijstellingVervallenDoorWaardegrens ? (
        <p className="rounded-lg bg-merk-wash p-4 text-sm leading-relaxed text-inkt-zacht">
          Boven de {formatEuro(STARTERS_WONINGWAARDEGRENS)} vervalt de startersvrijstelling helemaal, er is geen
          gedeeltelijke vrijstelling. Je betaalt dan {OVB_TARIEF_HOOFDVERBLIJF_PCT}% over de hele koopsom.
        </p>
      ) : null}

      <UitkomstMoment label="Minimaal eigen geld (indicatie)" waarde={formatEuro(u.eigenGeldMinimaal)}>
        {/* Flux-echo: het uitkomst-grafiekje. De gestapelde balk laat zien
            waar het eigen geld heen gaat, met lavendel als tweede reeks; de
            legenda (kleurdot + label + bedrag) is meteen de postenlijst.
            Belasting 0 (startersvrijstelling) valt eerlijk uit de balk maar
            blijft met 0 in de legenda staan. */}
        <VoortgangsBalk
          className="mt-5"
          formatteer={formatEuro}
          segmenten={[
            { label: belastingLabel, waarde: u.ovb.belasting, kleur: "merk" },
            ...INDICATIE_KOSTEN.map((k, i) => ({
              label: `${k.label} (indicatie)`,
              waarde: k.bedrag,
              kleur: (["lavendel", "amber", "neutraal"] as const)[i % 3],
            })),
          ]}
        />
        {zelfWonen ? (
          <p className="mt-4 text-sm leading-relaxed text-inkt-zacht">
            Dit is wat je bij deze koopsom minimaal zelf meebrengt: je kunt maximaal 100% van de woningwaarde lenen, dus
            deze kosten passen niet in de hypotheek. Bied je boven de getaxeerde waarde, dan komt dat verschil er nog
            bij; reken dat na met de{" "}
            <Link href="/overbieden" className="underline underline-offset-2 hover:text-merk">
              overbieden-rekenhulp
            </Link>
            .
          </p>
        ) : (
          <p className="mt-4 text-sm leading-relaxed text-inkt-zacht">
            Dit zijn de overdrachtsbelasting en de vaste kosten die je bij deze koopsom zelf betaalt. Hoeveel een bank
            financiert bij verhuur of een tweede woning verschilt per situatie; daar doet deze rekenhulp geen uitspraak
            over.
          </p>
        )}
        <p className="mt-3 text-xs text-gedempt">Bedoeld om je een gevoel te geven, niet om op te baseren.</p>
      </UitkomstMoment>

      <RekenmoduleSamenvatting rijen={samenvatting} gaNaarStap={gaNaarStap} />

      <UitklapUitleg titel="Zo rekenen we">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Overdrachtsbelasting: {OVB_TARIEF_HOOFDVERBLIJF_PCT}% van de koopsom voor een woning waarin je zelf gaat
            wonen, of 0% met de startersvrijstelling. Bron: Wet op belastingen van rechtsverkeer, artikel 14 en
            artikel 15, geldend vanaf 1 januari 2026 (wetten.overheid.nl, door ons nagelezen op {OVB_PEILDATUM}).
          </li>
          <li>
            De startersvrijstelling geldt tot en met een woningwaarde van {formatEuro(STARTERS_WONINGWAARDEGRENS)}{" "}
            (grens 2026). Daarboven vervalt de vrijstelling volledig. De wet toetst op de woningwaarde inclusief
            bijvoorbeeld tuin of garage; wij rekenen hier met de koopsom als benadering.
          </li>
          <li>
            Koop je niet om er zelf te wonen (bijvoorbeeld voor verhuur of als tweede woning), dan geldt sinds 2026 een
            tarief van {String(OVB_TARIEF_WONING_OVERIG_PCT).replace(".", ",")}%. Kies je bij jouw situatie voor nee,
            dan rekenen we met dat tarief.
          </li>
          <li>
            Notaris, hypotheekadvies en taxatie zijn ruwe indicaties, afgeronde middenbedragen van wat aanbieders in de
            praktijk rekenen. De echte bedragen hangen af van wie je kiest en verschillen honderden euro's:
          </li>
        </ul>
        <ul className="mt-2 list-disc space-y-1 pl-10">
          {INDICATIE_KOSTEN.map((k) => (
            <li key={k.key}>
              {k.label}, ongeveer {formatEuro(k.bedrag)}: {k.toelichting}
            </li>
          ))}
        </ul>
        <p className="mt-3">
          Niet meegerekend: eventuele bankgarantie, bouwkundige keuring, aankoopmakelaar en verhuiskosten. Meer over
          onze werkwijze staat op de{" "}
          <Link href="/methode" className="underline underline-offset-2 hover:text-merk">
            methodepagina
          </Link>
          .
        </p>
      </UitklapUitleg>

      <GerelateerdeRekenhulpen items={GERELATEERD} />

      <LeadCta
        titel="Van indicatie naar echt advies"
        tekst="De bedragen voor notaris, hypotheekadvies en taxatie zijn indicaties. Een onafhankelijke hypotheekadviseur maakt ze concreet voor jouw situatie en rekent alle kosten van je aankoop door."
        knopTekst="Stel je vraag aan een adviseur"
        href="/hypotheek"
        ontvanger="een onafhankelijke hypotheekadviseur"
      />
    </div>
  );
}
