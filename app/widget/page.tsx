import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { addresses } from "@/db/schema";
import { isSuppressed } from "@/lib/suppression";
import { getOrCreateValuation } from "@/lib/valuation";
import { formatEuro, normalizePostcode } from "@/lib/util";
import { inputClass, KnopPrimair, SectieLabel } from "@/components/ui";
import { WIDGET_CONSENT_CHECKBOX } from "./consent";
import { WidgetResize } from "./widget-resize";

/**
 * Stateless iframe-doel voor public/widget.js. Deze route draait in een
 * extern iframe: geen cookies, geen sessies, en niets dat framing blokkeert.
 * De site-header en -footer uit de rootlayout worden hier via CSS verborgen;
 * de widget is een compacte, zelfstandige kaart.
 */

export const metadata: Metadata = { title: "Wat is dit huis waard?", robots: { index: false, follow: false } };

type Zoek = { postcode?: string; nummer?: string; bron?: string; verzonden?: string; fout?: string };

const FOUTEN: Record<string, string> = {
  "te-vaak": "Te veel verzoeken achter elkaar. Probeer het over een minuut opnieuw.",
  ongeldig: "Controleer je invoer en probeer het opnieuw.",
  consent: "Zonder aangevinkte checkbox sturen we niets. Vink de checkbox aan als je updates wilt.",
};

const ZEKERHEID: Record<string, string> = {
  hoog: "een relatief zekere schatting",
  middel: "voldoende voor een richting, niet voor zekerheid",
  laag: "weinig verkopen, dus een bewust brede marge",
};

function vindAdres(postcodeInput: string, nummerInput: string) {
  const postcode = normalizePostcode(postcodeInput);
  if (!postcode) return { status: "postcode-ongeldig" as const };
  const nummerslug = nummerInput.toLowerCase().replace(/\s+/g, "");
  const adres = db
    .select()
    .from(addresses)
    .where(and(eq(addresses.postcode, postcode), eq(addresses.nummerslug, nummerslug)))
    .get();
  if (!adres || adres.status === "opted_out" || isSuppressed(adres.postcode, adres.nummerslug)) {
    return { status: "geen-gegevens" as const };
  }
  return { status: "gevonden" as const, adres };
}

export default async function WidgetPagina({ searchParams }: { searchParams: Promise<Zoek> }) {
  const sp = await searchParams;
  const bron = (sp.bron ?? "").toLowerCase().replace(/[^a-z0-9.-]/g, "").slice(0, 253);
  const heeftZoekopdracht = !!(sp.postcode && sp.nummer);
  const resultaat = heeftZoekopdracht ? vindAdres(sp.postcode!, sp.nummer!) : null;
  const adres = resultaat?.status === "gevonden" ? resultaat.adres : null;
  const view = adres ? getOrCreateValuation(adres) : null;
  const naam = adres ? `${adres.straat} ${adres.huisnummer}${adres.toevoeging ? ` ${adres.toevoeging}` : ""}, ${adres.plaats}` : null;

  return (
    <div className="p-5">
      {/* Verbergt de sitebrede header/footer en de min-hoogte van de rootlayout:
          in het iframe telt alleen de widget zelf. Alleen op deze route. */}
      <style>{`body { min-height: 0 !important; } body > header, body > footer { display: none !important; } body > main { margin: 0; }`}</style>
      <WidgetResize />

      <h1 className="text-xl font-semibold">Wat is dit huis waard?</h1>
      <p className="mt-1 text-sm text-inkt-zacht">Vul postcode en huisnummer in voor een schatting met eerlijke bandbreedte.</p>

      <form method="get" action="/widget" className="mt-4 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <input name="postcode" defaultValue={sp.postcode ?? ""} placeholder="1234 AB" required aria-label="Postcode" className={inputClass} />
          <input name="nummer" defaultValue={sp.nummer ?? ""} placeholder="Nr, bv. 12a" required aria-label="Huisnummer" className={inputClass} />
        </div>
        {bron ? <input type="hidden" name="bron" value={bron} /> : null}
        <KnopPrimair type="submit">Toon de waarde</KnopPrimair>
      </form>

      {sp.fout ? (
        <p className="mt-4 rounded-lg border border-negatief/30 bg-negatief/5 px-4 py-3 text-sm text-negatief">
          {FOUTEN[sp.fout] ?? "Er ging iets mis. Probeer het opnieuw."}
        </p>
      ) : null}

      {resultaat?.status === "postcode-ongeldig" ? (
        <p className="mt-4 text-sm text-inkt-zacht">Die postcode herkennen we niet. Gebruik het formaat 1234 AB.</p>
      ) : null}

      {resultaat?.status === "geen-gegevens" ? (
        <p className="mt-4 text-sm text-inkt-zacht">Geen gegevens voor dit adres.</p>
      ) : null}

      {adres && view ? (
        <div className="mt-4 rounded-[14px] border border-lijn bg-paneel p-4">
          <SectieLabel>{naam}</SectieLabel>
          {view.valuation ? (
            <>
              <p className="mt-2 font-display text-3xl font-semibold text-merk">{formatEuro(view.valuation.waarde)}</p>
              <p className="mt-1 text-sm text-inkt-zacht">
                Bandbreedte {formatEuro(view.valuation.intervalLaag)} tot {formatEuro(view.valuation.intervalHoog)}
              </p>
              <p className="mt-1 text-xs text-inkt-zacht">
                Zekerheid {view.valuation.confidence}: op basis van {view.valuation.nComparables} recente verkopen, {ZEKERHEID[view.valuation.confidence]}.
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm leading-relaxed text-inkt-zacht">
              Voor dit adres kunnen we nog geen eerlijke schatting maken: te weinig recente verkopen in de buurt. Liever geen
              getal dan een verzonnen getal.
            </p>
          )}
          <p className="mt-2 text-xs text-gedempt">Schatting: Wonea, met bandbreedte, geen taxatie.</p>
          <a
            href={`/woning/${adres.postcode}/${adres.nummerslug}`}
            target="_top"
            className="mt-2 inline-block text-sm font-semibold text-merk underline underline-offset-4"
          >
            Bekijk de volledige woningpagina
          </a>
        </div>
      ) : null}

      {adres && sp.verzonden === "1" ? (
        <div className="mt-4 rounded-[14px] border border-lijn bg-merk-wash p-4">
          <p className="text-sm font-semibold text-merk">Check je mail om te bevestigen</p>
          <p className="mt-1 text-sm leading-relaxed text-inkt-zacht">
            We hebben je een bevestigingslink gestuurd. Pas na jouw klik daarop sturen we updates; zonder die klik gebeurt er
            niets en verwijderen we je aanmelding na 30 dagen vanzelf.
          </p>
        </div>
      ) : null}

      {adres && sp.verzonden !== "1" ? (
        <form method="post" action="/api/widget" className="mt-4 rounded-[14px] border border-lijn bg-paneel p-4">
          <p className="text-sm font-semibold text-inkt">Waarde volgen per mail?</p>
          <input type="hidden" name="postcode" value={adres.postcode} />
          <input type="hidden" name="nummer" value={adres.nummerslug} />
          <input type="hidden" name="bron" value={bron} />
          <input type="text" name="bedrijfsnaam" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
          <div className="mt-3">
            <input name="email" type="email" required placeholder="jij@voorbeeld.nl" aria-label="E-mailadres" className={inputClass} />
          </div>
          <label className="mt-3 flex items-start gap-2 text-sm leading-relaxed text-inkt">
            <input type="checkbox" name="consent" value="1" required className="mt-1" />
            <span>{WIDGET_CONSENT_CHECKBOX}</span>
          </label>
          <p className="mt-2 text-xs leading-relaxed text-gedempt">
            Wonea is een onafhankelijk platform dat woningwaarde toont met eerlijke bandbreedte en bronnen; je e-mailadres
            gebruiken we alleen hiervoor.{" "}
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-merk">
              Privacyverklaring
            </a>
          </p>
          <div className="mt-3">
            <KnopPrimair type="submit">Houd me op de hoogte</KnopPrimair>
          </div>
        </form>
      ) : null}

      <p className="mt-4 text-xs text-gedempt">
        Een dienst van{" "}
        <a href="/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-merk">
          Wonea
        </a>
        : eerlijk inzicht in woningwaarde.
      </p>
    </div>
  );
}
