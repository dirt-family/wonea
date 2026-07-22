/**
 * Plausible-analytics: privacyvriendelijk, cookieloos, EU-gehost.
 *
 * Staat UIT zolang NEXT_PUBLIC_PLAUSIBLE_DOMAIN leeg is (nu het geval): het
 * component rendert dan helemaal niets, er wordt geen byte naar plausible.io
 * gestuurd. Aanzetten kan pas als Mitch een Plausible-account heeft en het
 * domein (bv. "wonea.nl") als NEXT_PUBLIC_PLAUSIBLE_DOMAIN zet; stappen in
 * docs/DEPLOYMENT.md, het account zelf staat op docs/TODO.md.
 *
 * NEXT_PUBLIC_-variabelen worden bij `next build` ingebakken: na het zetten of
 * wijzigen van het domein is een nieuwe build/deploy nodig.
 *
 * Server component (geen "use client"): het is een kaal script-tag zonder
 * interactie. Importeert bewust niets uit lib/util (server-only crypto) of
 * lib/format; dit bestand moet overal veilig te renderen zijn.
 */
export function Analytics() {
  const domein = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  if (!domein) return null;

  return <script defer data-domain={domein} src="https://plausible.io/js/script.js" />;
}
