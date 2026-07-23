import { NHG_GRENS_2026, NHG_GRENS_EBV_2026, NHG_PROVISIE_PCT } from "@/lib/normen/leennormen-2026";
import { berekenLeestijdMinuten, type GidsArtikel, type GidsSectie } from "@/lib/gids/model";
import { euroKort, euroTekst, pctTekst } from "@/lib/gids/tekst";

/**
 * Artikel: NHG in 2026. De drie cijfers (kostengrens, EBV-grens, provisie)
 * komen uit lib/normen/leennormen-2026.ts en worden hier geinterpoleerd; de
 * afgeleiden (extra ruimte, provisievoorbeeld) worden berekend, niet
 * overgetikt. Het normbedragen-blok wordt bewaakt in tests/gids.test.ts.
 */

const PEILDATUM = "2026-07-23";

const EXTRA_RUIMTE_EBV = NHG_GRENS_EBV_2026 - NHG_GRENS_2026;
const PROVISIE_VOORBEELD = Math.round((NHG_GRENS_2026 * NHG_PROVISIE_PCT) / 100);

const SECTIES: GidsSectie[] = [
  {
    kop: "Wat NHG is",
    paragrafen: [
      "De Nationale Hypotheek Garantie is een vangnet onder je hypotheek. Sluit je een hypotheek met NHG af, dan staat een landelijk waarborgfonds garant. Moet je je huis ooit gedwongen verkopen, bijvoorbeeld na baanverlies, een scheiding of arbeidsongeschiktheid, en blijft er een restschuld over, dan kan het fonds die onder voorwaarden kwijtschelden. De precieze voorwaarden staan op nhg.nl.",
      "Je vraagt NHG niet los aan: de garantie loopt mee bij het afsluiten van je hypotheek. Je geldverstrekker toetst of de aankoop binnen de voorwaarden valt en regelt de garantie; jij betaalt daarvoor de eenmalige provisie.",
      "NHG is niet voor elke woning en niet gratis: er geldt een kostengrens en je betaalt eenmalig een provisie. Voor 2026 zien die cijfers er zo uit.",
    ],
    cijfers: [
      { label: "Kostengrens 2026", waarde: euroKort(NHG_GRENS_2026) },
      { label: "Kostengrens met energiebesparende voorzieningen", waarde: euroKort(NHG_GRENS_EBV_2026) },
      { label: "Eenmalige borgtochtprovisie", waarde: `${NHG_PROVISIE_PCT.toLocaleString("nl-NL")}% van het hypotheekbedrag` },
    ],
  },
  {
    kop: "De kostengrens in 2026",
    paragrafen: [
      `De kostengrens voor 2026 is ${euroTekst(NHG_GRENS_2026)}. Kost je woning meer, dan is een hypotheek met NHG niet mogelijk. De grens wordt elk jaar opnieuw vastgesteld en beweegt mee met de huizenprijzen.`,
      "Onze budgetberekenaar toont deze grens naast je uitkomst, zodat je meteen ziet of NHG bij jouw zoekbudget in beeld is.",
    ],
  },
  {
    kop: "Kostengrens en maximale hypotheek zijn twee verschillende grenzen",
    paragrafen: [
      "De kostengrens zegt alleen of NHG mogelijk is. Hoeveel je maximaal kunt lenen is een andere vraag: dat volgt uit de wettelijke leennormen en je inkomen. Je kunt dus een woning onder de kostengrens op het oog hebben en toch minder kunnen lenen, of juist meer mogen lenen dan de grens en dan zonder NHG kopen.",
      "Verwar de twee niet bij het bepalen van je zoekbudget. In de budgetberekenaar staan ze daarom naast elkaar: je indicatieve maximum volgens de leennormen, met de NHG-kostengrens ernaast. Hoe die leennormen zelf werken, leggen we uit in het artikel over de maximale hypotheek in 2026.",
    ],
  },
  {
    kop: "Hogere grens bij energiebesparende voorzieningen",
    paragrafen: [
      `Financier je energiebesparende voorzieningen mee, zoals isolatie of een warmtepomp, dan ligt de grens op ${euroTekst(NHG_GRENS_EBV_2026)}. Dat is ${euroTekst(EXTRA_RUIMTE_EBV)} meer, precies zes procent boven de gewone grens. Die extra ruimte is bedoeld voor de energiebesparende maatregelen zelf.`,
    ],
  },
  {
    kop: "De eenmalige provisie",
    paragrafen: [
      `Voor NHG betaal je bij het afsluiten een borgtochtprovisie van ${pctTekst(NHG_PROVISIE_PCT, 1)} van het hypotheekbedrag. Een gelabeld voorbeeld: bij een hypotheek van ${euroTekst(NHG_GRENS_2026)}, precies op de grens, is dat ${euroTekst(PROVISIE_VOORBEELD)}. Je betaalt dit een keer, daarna niet meer.`,
      "De provisie is dus een eenmalig bedrag, terwijl een eventueel rentevoordeel elk jaar van de looptijd doorwerkt. Daarom kan NHG per saldo gunstig uitpakken, maar dat hangt af van het tarief dat jouw geldverstrekker rekent.",
    ],
  },
  {
    kop: "Wat je eraan hebt",
    paragrafen: [
      "Het belangrijkste is het vangnet: de kans dat je na een gedwongen verkoop met een restschuld blijft zitten, wordt kleiner. Daarnaast rekenen veel geldverstrekkers een lagere rente op hypotheken met NHG, omdat hun risico kleiner is. Hoeveel lager verschilt per verstrekker; die tarieven zijn niet openbaar, dus daar noemen we geen cijfer.",
      "Vergelijk je hypotheekvoorstellen, let dan op twee dingen tegelijk: het rentetarief met en zonder NHG, en de eenmalige provisie. Zo zie je wat de garantie je in jouw geval kost en wat die oplevert.",
      "Of NHG voor jou zinvol is, hangt af van je situatie en van de woning. Dit artikel is informatie, geen advies: een hypotheekadviseur kan de afweging voor jouw geval maken.",
    ],
    faq: [
      {
        vraag: "Kan ik NHG krijgen als mijn woning duurder is dan de kostengrens?",
        antwoord: `Nee. Boven de kostengrens van ${euroTekst(NHG_GRENS_2026)}, of ${euroTekst(NHG_GRENS_EBV_2026)} met energiebesparende voorzieningen, is een hypotheek met NHG niet mogelijk.`,
      },
      {
        vraag: "Betaal ik de borgtochtprovisie elk jaar?",
        antwoord: `Nee. De provisie van ${pctTekst(NHG_PROVISIE_PCT, 1)} betaal je een keer, bij het afsluiten van de hypotheek.`,
      },
      {
        vraag: "Waar vind ik de volledige voorwaarden?",
        antwoord:
          "Op nhg.nl. Daar staan de voorwaarden voor kwijtschelding van een restschuld en de situaties die onder de garantie vallen. Dit artikel behandelt alleen de bedragen voor 2026.",
      },
    ],
  },
];

export const ARTIKEL_NHG: GidsArtikel = {
  slug: "nhg-2026",
  titel: "NHG in 2026: kostengrens, provisie en nut",
  beschrijving:
    "De NHG-kostengrens ligt in 2026 op 470.000 euro, met extra ruimte voor energiebesparende voorzieningen. Zo werkt de garantie, de grens en de eenmalige provisie.",
  categorie: "hypotheek",
  leestijdMinuten: berekenLeestijdMinuten(SECTIES),
  gepubliceerd: "2026-07-23",
  bijgewerkt: "2026-07-23",
  bronnen: [
    {
      naam: "Nationale Hypotheek Garantie (nhg.nl), kostengrens en provisie 2026",
      url: "https://www.nhg.nl",
      peildatum: PEILDATUM,
    },
  ],
  rekenhulp: {
    href: "/budget",
    label: "Bereken je budget",
    zin: "De budgetberekenaar toont naast je maximale hypotheek ook de NHG-kostengrens, zodat je ziet of NHG voor jou in beeld is.",
  },
  secties: SECTIES,
  // Letterlijke waarden; tests/gids.test.ts vergelijkt ze met lib/normen.
  normbedragen: {
    kostengrens: 470000,
    kostengrensEbv: 498200,
    provisiePct: 0.4,
    extraRuimteEbv: 28200,
    provisieVoorbeeldBijGrens: 1880,
  },
};
