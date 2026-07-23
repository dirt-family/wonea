import { notFound } from "next/navigation";
import {
  Bandbreedte,
  BronLabel,
  Kaart,
  KnopPrimair,
  KnopSecundair,
  LeadCta,
  LegeStaat,
  SectieLabel,
  Sparkline,
  StappenBalk,
  StatTegel,
  UitklapUitleg,
  UitkomstKaart,
  VergelijkTabel,
  VoorbeelddataLabel,
} from "@/components/ui";

/** Design-showcase, alleen in development (zelfde guard als /dev/mail). */
export default function DesignShowcase() {
  if (process.env.NODE_ENV !== "development" || process.env.WONEA_DEV_MAIL !== "1") notFound();

  const kleuren = ["achtergrond", "paneel", "lijn", "merk-wash", "merk-100", "merk-300", "merk-500", "merk", "accent", "accent-wash", "positief", "negatief"];

  return (
    <div className="mx-auto max-w-5xl space-y-10 px-5 py-10">
      <h1 className="text-3xl font-semibold">Designsysteem-showcase</h1>

      <section>
        <SectieLabel>Kleuren</SectieLabel>
        <div className="mt-3 flex flex-wrap gap-3">
          {kleuren.map((k) => (
            <div key={k} className="text-center">
              <div className={`h-14 w-20 rounded-lg border border-lijn bg-${k}`} />
              <p className="mt-1 text-xs text-gedempt">{k}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <SectieLabel>Typografie</SectieLabel>
        <h1 className="text-4xl font-semibold">Kop 1: serif, merk</h1>
        <h2 className="text-2xl font-semibold">Kop 2</h2>
        <p className="text-inkt">Lopende tekst in Inter, inkt.</p>
        <p className="text-sm text-inkt-zacht">Secundair, inkt-zacht.</p>
        <p className="text-xs text-gedempt">Bijschrift, gedempt.</p>
      </section>

      <section className="flex flex-wrap items-center gap-3">
        <KnopPrimair href="#">Primaire knop</KnopPrimair>
        <KnopSecundair href="#">Secundaire knop</KnopSecundair>
        <BronLabel>bronlabel</BronLabel>
        <VoorbeelddataLabel />
      </section>

      <section className="grid gap-5 sm:grid-cols-3">
        <StatTegel label="Gemiddelde WOZ" waarde="€ 465.000" delta="+4,2% dit jaar" deltaRichting="positief" />
        <StatTegel label="Doorlooptijd" waarde="23 dagen" delta="6 dagen sneller" deltaRichting="positief" />
        <StatTegel label="Overbieden" waarde="+3,1%" delta="vlak t.o.v. vorige maand" deltaRichting="neutraal" />
      </section>

      <UitkomstKaart label="Maximale hypotheek (voorbeeld)" bedrag="€ 385.000">
        <Bandbreedte laag={355000} waarde={385000} hoog={402000} />
      </UitkomstKaart>

      <section className="space-y-4">
        <StappenBalk stappen={["Inkomen", "Woonsituatie", "Uitkomst"]} actief={1} />
        <div className="flex items-end gap-6">
          <Sparkline waarden={[420, 435, 431, 448, 460, 458, 472]} />
          <span className="text-xs text-gedempt">Sparkline</span>
        </div>
      </section>

      <VergelijkTabel
        koppen={["Geldverstrekker", "10 jaar vast", "20 jaar vast", "NHG"]}
        rijen={[
          ["Voorbeeldbank", "3,4%", "3,8%", "ja"],
          ["Demo Hypotheken", "3,5%", "3,9%", "ja"],
        ]}
        bron="Voorbeelddata voor de showcase."
      />

      <UitklapUitleg titel="Zo rekenen we (uitklap-uitleg)">
        Elke tool krijgt een eigen zo-rekenen-we-blok met de echte formules en bronnen.
      </UitklapUitleg>

      <LegeStaat titel="Geen gegevens voor dit adres" tekst="Eerlijk leeg: we benoemen welke bron ontbreekt in plaats van iets te verzinnen." />

      <LeadCta
        titel="Weten wat dit voor jou betekent?"
        tekst="Een onafhankelijke adviseur rekent het door met je echte situatie."
        knopTekst="Vraag het na"
        href="#"
        ontvanger="een onafhankelijke hypotheekadviseur"
      />
    </div>
  );
}
