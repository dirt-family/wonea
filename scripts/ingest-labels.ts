/**
 * Ingest: echte energielabels (EP-Online, RVO) voor het testgebied.
 * Werkt per adres de kolommen energielabel + energielabel_bron bij zodra
 * EP-Online een geregistreerd label kent. Adressen zonder geregistreerd label
 * houden hun bouwjaar-indicatie (bron blijft "indicatie" en de UI blijft dat
 * eerlijk labelen).
 *
 * Draaien:  npx tsx --env-file=.env scripts/ingest-labels.ts
 * Env:      EPONLINE_API_KEY      verplicht; zonder key doet dit script niets
 *                                 (gratis aanvragen op apikey.ep-online.nl)
 *           WONEA_MAX_LABELS      cap op API-calls per run (default 500)
 *           WONEA_LABEL_DELAY_MS  pauze tussen calls in ms (default 300)
 *           WONEA_POSTCODE4       kommalijst, beperkt de run tot die gebieden
 *           EPONLINE_API_URL      basis-URL-override (tests)
 *
 * HARDE REGELS:
 * - suppressielijst wint altijd: opted-out adressen worden niet bevraagd en
 *   niet bijgewerkt (status-filter plus isSuppressed per adres);
 * - alleen adressen zonder echt label worden bevraagd (bron != "echt"), dus
 *   2x draaien kost geen dubbele calls voor al opgehaalde labels; adressen
 *   waarvoor EP-Online (nog) geen label kent worden een volgende run opnieuw
 *   geprobeerd, want labels worden doorlopend geregistreerd;
 * - rate-vriendelijk: sequentieel, met pauze tussen calls en een cap per run;
 * - fail-safe: 401 (ongeldige key) stopt direct, 5 fouten op rij ook.
 */
import { and, eq, ne } from "drizzle-orm";
import { addresses } from "../db/schema";
import { db, sql } from "../lib/db";
import { EpOnlineFout, fetchEnergielabel, heeftEpOnlineKey, splitsToevoeging } from "../lib/bronnen/energielabel";
import { slaap } from "../lib/ingest/http";
import { isSuppressed } from "../lib/suppression";

async function main() {
  if (!heeftEpOnlineKey()) {
    console.log(
      "EPONLINE_API_KEY ontbreekt: geen labels opgehaald.\n" +
        "Vraag de key gratis aan op https://apikey.ep-online.nl (persoonsgebonden, activatielink binnen 24 uur aanklikken)\n" +
        "en zet hem in .env als EPONLINE_API_KEY=... Daarna: npx tsx --env-file=.env scripts/ingest-labels.ts\n" +
        "Tot die tijd blijven de adrespagina's de bouwjaar-indicatie tonen (eerlijk gelabeld). Niets gewijzigd.",
    );
    return;
  }

  const max = Math.max(1, Number(process.env.WONEA_MAX_LABELS ?? 500));
  const delayMs = Math.max(0, Number(process.env.WONEA_LABEL_DELAY_MS ?? 300));
  const postcode4 = (process.env.WONEA_POSTCODE4 ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[1-9][0-9]{3}$/.test(s));

  // Alleen actieve adressen zonder echt label; opted-out valt hier al af en
  // wordt hieronder per adres nogmaals via de suppressielijst gecheckt.
  const alleKandidaten = await db
    .select({
      id: addresses.id,
      postcode: addresses.postcode,
      nummerslug: addresses.nummerslug,
      huisnummer: addresses.huisnummer,
      toevoeging: addresses.toevoeging,
    })
    .from(addresses)
    .where(and(ne(addresses.energielabelBron, "echt"), eq(addresses.status, "actief")))
    .orderBy(addresses.id);

  const gefilterd = postcode4.length > 0 ? alleKandidaten.filter((a) => postcode4.includes(a.postcode.slice(0, 4))) : alleKandidaten;
  const kandidaten = gefilterd.slice(0, max);
  console.log(
    `EP-Online: ${gefilterd.length} adressen zonder echt label` +
      (postcode4.length > 0 ? ` (postcode4-filter ${postcode4.join(",")})` : "") +
      `; deze run bevraagt er maximaal ${kandidaten.length} (cap ${max}, pauze ${delayMs} ms).`,
  );

  const telling = { bevraagd: 0, bijgewerkt: 0, geenLabel: 0, onderdrukt: 0, nietRepresenteerbaar: 0, fouten: 0 };
  let foutenOpRij = 0;

  for (const adres of kandidaten) {
    // Suppressielijst wint altijd, ook boven het status-filter hierboven.
    if (await isSuppressed(adres.postcode, adres.nummerslug)) {
      telling.onderdrukt++;
      continue;
    }
    const splitsing = splitsToevoeging(adres.toevoeging);
    if (splitsing === null) {
      // Toevoeging past niet in de EP-Online-parameters: liever geen label
      // dan het label van een verkeerd adres.
      telling.nietRepresenteerbaar++;
      continue;
    }

    try {
      telling.bevraagd++;
      const resultaat = await fetchEnergielabel({ postcode: adres.postcode, huisnummer: adres.huisnummer, ...splitsing });
      if (resultaat) {
        await db.update(addresses).set({ energielabel: resultaat.label, energielabelBron: "echt" }).where(eq(addresses.id, adres.id));
        telling.bijgewerkt++;
      } else {
        telling.geenLabel++;
      }
      foutenOpRij = 0;
    } catch (e) {
      telling.fouten++;
      foutenOpRij++;
      if (e instanceof EpOnlineFout && e.status === 401) {
        console.error("EP-Online weigert de API-key (HTTP 401). Check EPONLINE_API_KEY; run gestopt.");
        break;
      }
      console.warn(`  fout bij ${adres.postcode} ${adres.nummerslug}: ${(e as Error).message}`);
      if (foutenOpRij >= 5) {
        console.error("5 fouten op rij (netwerk of API-storing); run gestopt. Opnieuw draaien is veilig.");
        break;
      }
    }

    if (delayMs > 0) await slaap(delayMs);
  }

  console.log(
    `Labels-ingest klaar: ${telling.bevraagd} bevraagd, ${telling.bijgewerkt} labels bijgewerkt (bron "echt"), ` +
      `${telling.geenLabel} zonder geregistreerd label (indicatie blijft staan), ${telling.onderdrukt} onderdrukt (suppressielijst), ` +
      `${telling.nietRepresenteerbaar} met niet-representeerbare toevoeging, ${telling.fouten} fouten.`,
  );
}

main()
  .catch((e) => {
    console.error("Labels-ingest onverwacht mislukt:", e);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
