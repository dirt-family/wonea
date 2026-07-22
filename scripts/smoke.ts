/**
 * Smoke-test: draait tegen een lopende server (BASE_URL, default :3000).
 * Checkt kernroutes op status + kenmerkende inhoud. Waves breiden ROUTES uit.
 * De opt-out-cascade wordt apart bewezen in tests/suppression.test.ts;
 * hier checken we het HTTP-gedrag van een opted-out adres zodra die flow er is.
 */

type Check = { pad: string; verwachtStatus: number; bevat?: string };

const ROUTES: Check[] = [
  { pad: "/", verwachtStatus: 200, bevat: "Wonea" },
  { pad: "/methode", verwachtStatus: 200, bevat: "methode" },
  { pad: "/over-ons", verwachtStatus: 200 },
  { pad: "/privacy", verwachtStatus: 200 },
  { pad: "/woz-check", verwachtStatus: 200 },
  { pad: "/verwijderen", verwachtStatus: 200, bevat: "twee stappen" },
  { pad: "/api/search?q=kleine+berg", verwachtStatus: 200, bevat: "resultaten" },
  // Fase 2+: /claim /dashboard /buurt; Fase 3: /biedadvies; Fase 4: funnels + /admin
];

async function main() {
  const base = process.env.BASE_URL ?? "http://localhost:4123";
  let fouten = 0;
  for (const check of ROUTES) {
    try {
      const res = await fetch(base + check.pad, { redirect: "manual" });
      const body = await res.text();
      const statusOk = res.status === check.verwachtStatus;
      const inhoudOk = !check.bevat || body.toLowerCase().includes(check.bevat.toLowerCase());
      if (statusOk && inhoudOk) {
        console.log(`OK   ${check.pad}`);
      } else {
        fouten++;
        console.error(`FOUT ${check.pad}: status ${res.status} (verwacht ${check.verwachtStatus}), inhoud ${inhoudOk ? "ok" : `mist "${check.bevat}"`}`);
      }
    } catch (e) {
      fouten++;
      console.error(`FOUT ${check.pad}: ${(e as Error).message}`);
    }
  }
  if (fouten > 0) {
    console.error(`Smoke: ${fouten} fouten.`);
    process.exit(1);
  }
  console.log("Smoke: alles groen.");
}

main();
