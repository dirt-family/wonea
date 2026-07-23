import {
  AFM_TOETSRENTE_KORTER_DAN_10JR,
  ENERGIELABEL_BEDRAG_BUITEN_BESCHOUWING,
  VERDUURZAMING_BEDRAG_BUITEN_BESCHOUWING,
  vindFinancieringslastPct,
} from "@/lib/normen/leennormen-2026";
import { berekenLeestijdMinuten, type GidsArtikel, type GidsSectie } from "@/lib/gids/model";
import { euroKort, euroTekst, pctTekst } from "@/lib/gids/tekst";

/**
 * Artikel: de leennormen 2026. Elk cijfer komt uit lib/normen/leennormen-2026.ts
 * en wordt hier geinterpoleerd, niet overgetikt; het normbedragen-blok onderaan
 * bevat de letterlijke waarden en wordt bewaakt in tests/gids.test.ts.
 */

const PEILDATUM = "2026-07-23";

// Gelabeld rekenvoorbeeld, rechtstreeks uit de normtabel opgezocht.
const VOORBEELD_INKOMEN = 60000;
const VOORBEELD_RENTE = 4.0;
const VOORBEELD_PCT = vindFinancieringslastPct("totAow", VOORBEELD_INKOMEN, VOORBEELD_RENTE);

const E = ENERGIELABEL_BEDRAG_BUITEN_BESCHOUWING;
const V = VERDUURZAMING_BEDRAG_BUITEN_BESCHOUWING;

const SECTIES: GidsSectie[] = [
  {
    kop: "Waar het maximum vandaan komt",
    paragrafen: [
      "Hoeveel hypotheek je maximaal kunt krijgen, bepaalt niet de bank maar de wet. De overheid stelt de leennormen elk jaar vast in de Tijdelijke regeling hypothecair krediet. De normen voor 2026 zijn op 31 oktober 2025 gepubliceerd in de Staatscourant en gelden vanaf 1 januari 2026.",
      "De kern van de regeling is het financieringslastpercentage: het deel van je bruto jaarinkomen dat aan hypotheeklasten mag opgaan. Dat percentage staat in tabellen, per inkomen en per rentestand. Hoe hoger je inkomen, hoe groter het deel dat je aan woonlasten mag besteden. En hoe hoger de rente, hoe hoger het percentage, omdat dezelfde lening dan zwaardere lasten geeft.",
    ],
  },
  {
    kop: "De tabellen werken met stappen",
    paragrafen: [
      "De regeling kent vier tabellen: een voor mensen die de AOW-leeftijd nog niet hebben bereikt, een voor mensen die die leeftijd al hebben, en twee varianten voor leningdelen waarvan de rente niet fiscaal aftrekbaar is. Elke tabel heeft rijen per inkomen en twaalf kolommen voor de rentestand.",
      `De tabel werkt trapsgewijs: je valt in de onderste rij die bij je toetsinkomen past, er wordt niet tussen rijen gerekend. De regeling schrijft namelijk geen interpolatie voor. Een toetsinkomen van 60.900 euro rekent dus met de rij van ${euroTekst(60000)}.`,
      `Een gelabeld voorbeeld uit tabel 1 (nog geen AOW-leeftijd): bij een toetsinkomen van ${euroTekst(VOORBEELD_INKOMEN)} en een toetsrente van ${pctTekst(VOORBEELD_RENTE, 1)} is het financieringslastpercentage ${pctTekst(VOORBEELD_PCT)}. Dat deel van het bruto inkomen mag dan naar de hypotheeklasten; daaruit volgt het maximale leenbedrag.`,
    ],
  },
  {
    kop: "De toetsrente: het rentecijfer waarmee wordt gerekend",
    paragrafen: [
      `Zet je de rente tien jaar of langer vast, dan rekent de geldverstrekker met de rente die je echt gaat betalen. Kies je een kortere rentevaste periode, dan geldt een toetsrente die de AFM elk kwartaal publiceert, met een wettelijke ondergrens van vijf procent. Op de peildatum van dit artikel staat die toetsrente op ${pctTekst(AFM_TOETSRENTE_KORTER_DAN_10JR, 1)}. Is je geoffreerde rente hoger, dan telt die.`,
      "Zo voorkomt de regeling dat je maximaal leent op een tijdelijk lage korte rente die daarna kan stijgen.",
    ],
  },
  {
    kop: "Je energielabel telt mee",
    paragrafen: [
      "Een geldverstrekker mag bij het vaststellen van de financieringslast een vast bedrag buiten beschouwing laten, afhankelijk van het energielabel van de woning (een kan-bepaling, geen verplichting). Praktisch betekent dat: hoe zuiniger het huis, hoe meer je vaak kunt lenen. Dit zijn de bedragen per label:",
    ],
    cijfers: [
      { label: "Label E, F of G", waarde: euroKort(E.EFG) },
      { label: "Label C of D", waarde: euroKort(E.CD) },
      { label: "Label A of B", waarde: euroKort(E.AB) },
      { label: "Label A+ of A++", waarde: euroKort(E.APlus_APlusPlus) },
      { label: "Label A+++", waarde: euroKort(E.A3Plus) },
      { label: "Label A++++", waarde: euroKort(E.A4Plus) },
      { label: "Label A++++ met energieprestatiegarantie (minstens 10 jaar)", waarde: euroKort(E.A4PlusGarantie) },
    ],
  },
  {
    kop: "Extra ruimte voor verduurzaming",
    paragrafen: [
      `Leen je extra om een bestaande woning energiezuiniger te maken, dan kan daarbovenop een bedrag buiten beschouwing blijven: ${euroTekst(V.EFG)} bij label E, F of G, ${euroTekst(V.CD)} bij C of D, en ${euroTekst(V.AB)} bij A of B tot en met A++. Vanaf label A+++ is dat ${euroTekst(V.A3PlusEnBeter)}: die woning is al zuinig.`,
      "De gedachte achter beide regelingen is dezelfde: een zuinig huis heeft lagere energielasten, dus is er ruimte voor iets hogere hypotheeklasten.",
    ],
  },
  {
    kop: "Een maximum is geen advies",
    paragrafen: [
      "De leennormen zijn een wettelijke bovengrens, geen aanbeveling. Wat verstandig is om te lenen hangt af van je vaste lasten, je plannen en de buffer die je wilt overhouden. Gebruik het maximum als grens, niet als doel.",
    ],
    faq: [
      {
        vraag: "Waarom werken de tabellen met stappen en niet met een glijdende schaal?",
        antwoord:
          "De regeling schrijft voor dat de financieringslast wordt vastgesteld met het toepasselijke percentage uit de tabel. Een voorschrift om tussen rijen te rekenen staat er niet in, dus geldt de onderste rij die bij je toetsinkomen past.",
      },
      {
        vraag: "Gelden er andere normen na de AOW-leeftijd?",
        antwoord: "Ja. Voor mensen die de AOW-leeftijd hebben bereikt heeft de regeling een aparte tabel met eigen percentages.",
      },
    ],
  },
];

export const ARTIKEL_MAXIMALE_HYPOTHEEK: GidsArtikel = {
  slug: "maximale-hypotheek-2026",
  titel: "Maximale hypotheek in 2026: zo werken de leennormen",
  beschrijving:
    "De wettelijke leennormen bepalen hoeveel hypotheek je maximaal krijgt. Zo werken de tabellen, de toetsrente en de energielabel-bedragen in 2026.",
  categorie: "hypotheek",
  leestijdMinuten: berekenLeestijdMinuten(SECTIES),
  gepubliceerd: "2026-07-23",
  bijgewerkt: "2026-07-23",
  bronnen: [
    {
      naam: "Wijzigingsregeling hypothecair krediet 2026, Staatscourant 2025, 36471",
      url: "https://zoek.officielebekendmakingen.nl/stcrt-2025-36471.html",
      peildatum: PEILDATUM,
    },
    {
      naam: "Tijdelijke regeling hypothecair krediet, geconsolideerde versie geldend vanaf 1 januari 2026",
      url: "https://wetten.overheid.nl/BWBR0032503/2026-01-01",
      peildatum: PEILDATUM,
    },
  ],
  rekenhulp: {
    href: "/budget",
    label: "Bereken je budget",
    zin: "De budgetberekenaar past deze leennormen toe op jouw inkomen en geeft een indicatie van je maximale hypotheek.",
  },
  secties: SECTIES,
  // Letterlijke waarden; tests/gids.test.ts vergelijkt ze met lib/normen.
  normbedragen: {
    buitenBeschouwingEFG: 0,
    buitenBeschouwingCD: 5000,
    buitenBeschouwingAB: 10000,
    buitenBeschouwingAPlusAPlusPlus: 20000,
    buitenBeschouwingA3Plus: 25000,
    buitenBeschouwingA4Plus: 30000,
    buitenBeschouwingA4PlusGarantie: 40000,
    verduurzamingEFG: 20000,
    verduurzamingCD: 15000,
    verduurzamingAB: 10000,
    verduurzamingAPlusAPlusPlus: 10000,
    verduurzamingA3PlusEnBeter: 0,
    afmToetsrentePct: 5.0,
    voorbeeldPctInkomen60000Rente4: 22.6,
  },
};
