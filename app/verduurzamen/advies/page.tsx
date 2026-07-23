import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { adresNaam, vindVerduurzaamAdres } from "@/app/verduurzamen/logic";
import { PARTIJ_TYPE, type Verticaal } from "@/app/verduurzamen/verticalen";
import { getEnergielabel } from "@/lib/bronnen/energielabel";
import { formatDatumNl, formatEuro } from "@/lib/util";
import { BronLabel, Kaart, LeadCta, SectieLabel, StatTegel, UitklapUitleg } from "@/components/ui";
import {
  ADVIES_GROEPEN,
  extraLeenruimteBijLabel,
  formatEuroBereik,
  formatTerugverdientijd,
  LEENNORMEN_BRON,
  LEENNORMEN_PEILDATUM,
  maakMaatregelAdviezen,
  type MaatregelAdvies,
} from "./advies";

/**
 * Adviesweergave van de verduurzamingscheck: per maatregel de indicatieve
 * kosten, het ISDE-bedrag 2026, de indicatieve jaarbesparing en een simpele
 * terugverdientijd, plus de extra leenruimte uit de leennormen bij het
 * huidige energielabel. Alles gelabeld als indicatie, met bron en peildatum
 * in de uitklap-uitleg per maatregel. Eindigt per groep in de bestaande
 * verticaal-funnels (/verduurzamen/[verticaal]).
 *
 * Het energielabel komt echt van EP-Online als er een API-key is (of al
 * gecachet); anders tonen we de bouwjaar-indicatie, eerlijk gelabeld.
 * Suppressie loopt via vindVerduurzaamAdres (opt-out is leidend).
 */

export const metadata: Metadata = {
  title: "Verduurzamingsadvies: kosten, subsidie en besparing per maatregel",
  robots: { index: false, follow: false },
};

type Zoek = { postcode?: string; nummer?: string };

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

function MaatregelBlok({ advies }: { advies: MaatregelAdvies }) {
  return (
    <section aria-label={advies.titel}>
      <h3 className="text-lg font-semibold">{advies.titel}</h3>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTegel
          label="Kosten (indicatie)"
          waarde={advies.kosten ? formatEuroBereik(advies.kosten.bereik) : "onbekend"}
          delta={advies.kosten ? advies.kosten.toelichting : "geen betrouwbare ordegrootte in onze bronnen"}
        />
        <StatTegel
          label="ISDE-subsidie 2026"
          waarde={advies.subsidie ? formatEuro(advies.subsidie.bedrag) : "geen ISDE"}
          delta={advies.subsidie ? advies.subsidie.toelichting : advies.subsidieGeenReden}
        />
        <StatTegel
          label="Besparing per jaar"
          waarde={advies.besparing ? formatEuroBereik(advies.besparing.bereik) : "geen kental"}
          delta={advies.besparing ? advies.besparing.toelichting : advies.besparingGeenReden}
        />
        <StatTegel
          label="Terugverdientijd"
          waarde={advies.terugverdientijd ? formatTerugverdientijd(advies.terugverdientijd) : "niet te berekenen"}
          delta={
            advies.terugverdientijd
              ? "indicatie: (kosten min subsidie) gedeeld door jaarbesparing"
              : advies.kosten === null
                ? "zonder kosten-ordegrootte geen terugverdientijd"
                : "zonder besparingskental geen terugverdientijd"
          }
        />
      </div>
      <div className="mt-4">
        <UitklapUitleg titel={`Zo komen we aan deze cijfers (${advies.titel.toLowerCase()})`}>
          <div className="space-y-3">
            {advies.uitleg.map((alinea, i) => (
              <p key={i}>{alinea}</p>
            ))}
            <p>
              Bronnen:{" "}
              {advies.bronnen.map((bron, i) => (
                <span key={bron.url}>
                  {i > 0 ? " · " : null}
                  <a href={bron.url} rel="noopener noreferrer" className="underline underline-offset-2 hover:text-merk">
                    {bron.label}
                  </a>
                </span>
              ))}
            </p>
          </div>
        </UitklapUitleg>
      </div>
    </section>
  );
}

export default async function VerduurzaamAdviesPagina({ searchParams }: { searchParams: Promise<Zoek> }) {
  const sp = await searchParams;
  const adres = sp.postcode && sp.nummer ? await vindVerduurzaamAdres(sp.postcode, sp.nummer) : null;
  if (!adres) {
    const qs = new URLSearchParams();
    if (sp.postcode) qs.set("postcode", sp.postcode);
    if (sp.nummer) qs.set("nummer", sp.nummer);
    const query = qs.toString();
    redirect(query ? `/verduurzamen?${query}` : "/verduurzamen");
  }

  // Echt label via EP-Online als dat kan (key of cache); anders de
  // bouwjaar-indicatie uit de adresdata, eerlijk gelabeld.
  const ep = await getEnergielabel(adres.postcode, adres.huisnummer, adres.toevoeging);
  const label = (ep?.label ?? adres.energielabel)?.toUpperCase() ?? null;
  const labelEcht = Boolean(ep) || adres.energielabelBron === "echt";

  const naam = adresNaam(adres);
  const adresQuery = `postcode=${adres.postcode}&nummer=${encodeURIComponent(adres.nummerslug)}`;
  const adviezen = maakMaatregelAdviezen(adres.woningtype);
  const leenruimte = extraLeenruimteBijLabel(label);

  const labelBronTekst = labelEcht
    ? `geregistreerd label (EP-Online/RVO${ep?.registratiedatum ? `, geregistreerd op ${formatDatumNl(ep.registratiedatum)}` : ""})`
    : label
      ? `indicatie op basis van bouwjaar ${adres.bouwjaar}, geen gemeten label`
      : "geen label bekend";

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <nav className="text-sm text-gedempt" aria-label="Kruimelpad">
        <Link href="/" className="hover:text-merk">Wonea</Link> /{" "}
        <Link href={`/verduurzamen?${adresQuery}`} className="hover:text-merk">Verduurzamen</Link> / Advies
      </nav>
      <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Verduurzamingsadvies voor {naam}</h1>
      <p className="mt-4 max-w-2xl leading-relaxed text-inkt-zacht">
        Per maatregel: wat het ruwweg kost, welke ISDE-subsidie er in 2026 is, wat het per jaar scheelt en hoe snel het
        zich terugverdient. Alles is een indicatie op basis van openbare bronnen; de bronnen en peildata staan per
        maatregel onder de cijfers.
      </p>

      <div className="mt-8 grid gap-5 lg:grid-cols-3">
        <Kaart className="lg:col-span-2">
          <SectieLabel>Huidig energielabel</SectieLabel>
          <div className="mt-3 flex items-center gap-4">
            <span className="flex h-14 min-w-14 items-center justify-center rounded-lg bg-merk px-2 font-display text-3xl font-semibold text-white">
              {label ?? "?"}
            </span>
            <div>
              <BronLabel>{labelBronTekst}</BronLabel>
              <p className="mt-2 text-sm leading-relaxed text-inkt-zacht">
                {label
                  ? "Het label bepaalt ook de extra leenruimte voor verduurzaming hiernaast."
                  : "Zonder bekend label kunnen we de extra leenruimte niet bepalen; de maatregel-cijfers hieronder gelden wel."}
              </p>
            </div>
          </div>
        </Kaart>
        <StatTegel
          label="Extra leenruimte verduurzaming"
          waarde={leenruimte ? formatEuro(leenruimte.bedrag) : "onbekend"}
          delta={
            leenruimte
              ? leenruimte.bedrag === 0
                ? `bij label ${label}: het huis is al zeer zuinig`
                : `maximum bij label ${label} (groep ${leenruimte.labelGroep})`
              : "geen herkenbaar energielabel"
          }
        />
      </div>

      <Kaart className="mt-5">
        <SectieLabel>Wat is die extra leenruimte?</SectieLabel>
        <p className="mt-3 text-sm leading-relaxed text-inkt-zacht">
          Leen je extra voor energiebesparende voorzieningen, dan mag een geldverstrekker dat deel van de hypotheek tot
          een maximumbedrag buiten de normale inkomenstoets laten. Dat maximum hangt af van je huidige energielabel:
          E, F of G {formatEuro(20000)} · C of D {formatEuro(15000)} · A, B, A+ of A++ {formatEuro(10000)} · A+++ of
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
      </Kaart>

      {ADVIES_GROEPEN.map((groep) => {
        const cta = CTA_PER_VERTICAAL[groep.verticaal];
        const groepAdviezen = groep.keys
          .map((key) => adviezen.find((a) => a.key === key))
          .filter((a): a is MaatregelAdvies => Boolean(a));
        return (
          <section key={groep.titel} className="mt-12">
            <h2 className="text-2xl font-semibold">{groep.titel}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-inkt-zacht">{groep.intro}</p>
            <div className="mt-6 space-y-8">
              {groepAdviezen.map((advies) => (
                <MaatregelBlok key={advies.key} advies={advies} />
              ))}
            </div>
            <div className="mt-6">
              <LeadCta
                titel={cta.titel}
                tekst={cta.tekst}
                knopTekst={cta.knopTekst}
                href={`/verduurzamen/${groep.verticaal}?${adresQuery}`}
                ontvanger={PARTIJ_TYPE}
              />
            </div>
          </section>
        );
      })}

      <p className="mt-10 max-w-2xl text-xs leading-relaxed text-gedempt">
        Alle bedragen op deze pagina zijn indicaties op basis van openbare bronnen (RVO, Milieu Centraal en de
        Staatscourant); geen offerte en geen financieel advies. Subsidie vraag je zelf aan bij de RVO. Liever eerst de
        losse funnels bekijken?{" "}
        <Link href={`/verduurzamen?${adresQuery}`} className="underline underline-offset-2 hover:text-merk">
          Terug naar het overzicht
        </Link>
        .
      </p>
    </div>
  );
}
