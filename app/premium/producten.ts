import { PREMIUM_PRIJZEN, type PremiumProduct } from "@/lib/premium";

/**
 * Productteksten voor de premium-verdieping (Fase 4.5). Prijzen komen uit
 * lib/premium.ts (PREMIUM_PRIJZEN); hier staat alleen copy en volgorde.
 *
 * Beide producten zijn EENMALIG: geen abonnement, geen automatische
 * verlenging. Dat is een bewuste keuze en staat letterlijk op de pagina's.
 * Net zo hard: de gratis basis blijft gratis. De letterlijke zin
 * "Basis-biedcontext en basis-marktsignalen blijven altijd gratis." staat
 * op de overzichtspagina en per product staat wat er gratis blijft.
 */

export type ProductInfo = {
  product: PremiumProduct;
  naam: string;
  prijs: number;
  kern: string;
  krijgt: string[];
  gratisBlijft: string;
};

export const PRODUCTEN: Record<PremiumProduct, ProductInfo> = {
  biedadvies: {
    product: "biedadvies",
    naam: "Biedadvies-verdieping",
    prijs: PREMIUM_PRIJZEN.biedadvies,
    kern: "Voor als je serieus gaat bieden en wilt weten wat winnende biedingen in de buurt deden.",
    krijgt: [
      "Winnende-bod-analyse: wat vergelijkbare woningen in de buurt boven of onder de vraagprijs opleverden",
      "Een biedbandbreedte per scenario (voorzichtig, realistisch, scherp), met de afwegingen erbij",
      "Doorloop-vergelijking: hoe snel vergelijkbare woningen verkochten en wat dat zegt over je onderhandelingsruimte",
    ],
    gratisBlijft: "De basis-biedcontext blijft altijd gratis: de biedrange, de onderbouwing en de prijsontwikkeling van de buurt.",
  },
  marktanalyse: {
    product: "marktanalyse",
    naam: "Marktanalyse-verdieping",
    prijs: PREMIUM_PRIJZEN.marktanalyse,
    kern: "Voor als je de buurtmarkt echt wilt doorgronden voordat je beslist.",
    krijgt: [
      "Momentum-detail: versnelt of koelt de buurt af, per maand uitgesplitst",
      "Doorloop-vergelijking tussen buurten: waar gaat het snel en waar heb je tijd",
      "Overbiedings-detail per woningtype, zodat je cijfers ziet die bij jouw situatie horen",
    ],
    gratisBlijft: "De basis-marktsignalen blijven altijd gratis: prijsontwikkeling, doorlooptijd en overbieding op buurtniveau.",
  },
};

export const PRODUCT_VOLGORDE: readonly PremiumProduct[] = ["biedadvies", "marktanalyse"];

/** Valideert een product-searchParam. Alles behalve de twee bekende producten wordt null. */
export function parseProduct(input: string | null | undefined): PremiumProduct | null {
  return input === "biedadvies" || input === "marktanalyse" ? input : null;
}
