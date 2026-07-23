import type { mortgageInfo, valuations } from "@/db/schema";
import { getActueleRentes, peilmaandLabel } from "@/lib/bronnen/rentes";
import { maandlastenOverzicht } from "@/lib/hypotheek";
import { formatDatumNl, formatEuro } from "@/lib/util";
import { Bandbreedte, inputClass, Kaart, KnopSecundair, LeadCta, LegeStaat, SectieLabel, Veld, VergelijkTabel } from "@/components/ui";
import { bewaarHypotheek } from "@/app/dashboard/actions";
import { bepaalOversluitSignaal, berekenOverwaarde } from "@/components/dossier/data";

/**
 * Sectie 4 van het woningdossier: hypotheekgegevens (eigen invoer, alleen
 * zichtbaar voor de eigenaar), de overwaarde-indicatie met dezelfde
 * bandbreedte als de waardeschatting, het oversluit-signaal als de
 * rentevaste periode binnen 12 maanden afloopt, en maandlasten-context op
 * de actuele DNB-gemiddelden (altijd met peilmaand en bron).
 */

type Hypotheek = typeof mortgageInfo.$inferSelect;
type Valuation = typeof valuations.$inferSelect;

export function HypotheekSectie({
  claimId,
  hypotheek,
  valuation,
  adresQuery,
}: {
  claimId: number;
  hypotheek: Hypotheek | null;
  valuation: Valuation | null;
  adresQuery: string;
}) {
  const overwaarde = berekenOverwaarde(valuation, hypotheek?.restantEur ?? null);
  const oversluit = bepaalOversluitSignaal(hypotheek?.rentevastTot ?? null);
  const rentes = getActueleRentes();
  const maandlasten = hypotheek
    ? maandlastenOverzicht(
        hypotheek.restantEur,
        rentes.buckets.map((b) => ({ label: b.label, pct: b.rentePct })),
      )
    : [];

  return (
    <section id="hypotheek" aria-label="Hypotheek en overwaarde" className="scroll-mt-6">
      <h2 className="text-2xl font-semibold">Hypotheek en overwaarde</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-inkt-zacht">
        Waarom we dit vragen: met je hypotheekrestant zie je je overwaarde en of oversluiten interessant wordt. Alleen jij
        ziet deze gegevens; ze staan niet op de publieke woningpagina.
      </p>

      <div className="mt-4 grid gap-5 lg:grid-cols-2">
        <Kaart>
          <SectieLabel>Overwaarde-indicatie</SectieLabel>
          {overwaarde ? (
            <>
              <p className={`mt-3 font-display text-4xl font-semibold ${overwaarde.midden >= 0 ? "text-merk" : "text-negatief"}`}>
                {formatEuro(overwaarde.midden)}
              </p>
              <Bandbreedte laag={overwaarde.laag} waarde={overwaarde.midden} hoog={overwaarde.hoog} />
              <p className="mt-3 text-xs text-gedempt">
                Geschatte woningwaarde min je hypotheekrestant van {formatEuro(hypotheek!.restantEur)}. De bandbreedte is
                die van de waardeschatting zelf: die onzekerheid verdwijnt niet door er een restant vanaf te trekken. Geen
                taxatie; een geldverstrekker rekent met een taxatierapport.
              </p>
            </>
          ) : (
            <div className="mt-3">
              <LegeStaat
                titel={valuation ? "Nog geen restant ingevuld" : "Nog geen waardeschatting"}
                tekst={
                  valuation
                    ? "Vul hiernaast je hypotheekrestant in; dan rekenen we de overwaarde-indicatie direct uit."
                    : "Zonder eerlijke waardeschatting is er geen eerlijke overwaarde-indicatie. Zodra er genoeg verkoopdata is, verschijnt hier het bedrag."
                }
              />
            </div>
          )}
          {oversluit ? (
            <div className="mt-4 rounded-lg bg-accent-wash p-4">
              <p className="text-sm font-semibold text-accent">
                {oversluit.status === "verlopen"
                  ? "Je rentevaste periode is verlopen"
                  : oversluit.maandenResterend <= 1
                    ? "Je rentevaste periode loopt binnen een maand af"
                    : `Je rentevaste periode loopt over ongeveer ${oversluit.maandenResterend} maanden af`}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-inkt-zacht">
                Dit is het moment om je rente te vergelijken: bekijk de actuele gemiddelden hieronder en vraag op tijd
                voorstellen op. Op basis van de einddatum die je zelf invulde
                {hypotheek?.rentevastTot ? ` (${formatDatumNl(hypotheek.rentevastTot)})` : ""}.
              </p>
            </div>
          ) : null}
        </Kaart>

        <Kaart>
          <SectieLabel>Je hypotheekgegevens</SectieLabel>
          <form action={bewaarHypotheek} className="mt-3 space-y-3">
            <input type="hidden" name="claimId" value={claimId} />
            <Veld label="Hypotheekrestant (euro)">
              <input
                name="restant"
                inputMode="numeric"
                required
                placeholder="250000"
                defaultValue={hypotheek ? String(hypotheek.restantEur) : ""}
                className={inputClass}
              />
            </Veld>
            <div className="grid gap-3 sm:grid-cols-2">
              <Veld label="Rente (%, optioneel)">
                <input
                  name="rente"
                  inputMode="decimal"
                  placeholder="3,4"
                  defaultValue={hypotheek?.rentePct != null ? String(hypotheek.rentePct).replace(".", ",") : ""}
                  className={inputClass}
                />
              </Veld>
              <Veld label="Rentevast tot (optioneel)">
                <input name="rentevastTot" type="date" defaultValue={hypotheek?.rentevastTot ?? ""} className={inputClass} />
              </Veld>
            </div>
            <KnopSecundair type="submit">Bewaar hypotheekgegevens</KnopSecundair>
          </form>
        </Kaart>
      </div>

      {hypotheek ? (
        <Kaart className="mt-5">
          <SectieLabel>Maandlasten-context bij de actuele rentes</SectieLabel>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-inkt-zacht">
            Wat je restant van {formatEuro(hypotheek.restantEur)} per maand zou kosten bij de actuele gemiddelde
            hypotheekrentes, gerekend als nieuwe 30-jarige annuïteit.
            {hypotheek.rentePct != null ? ` Je eigen rente is ${String(hypotheek.rentePct).replace(".", ",")}%.` : ""} Een
            indicatie om te vergelijken, geen offerte: je echte looptijd, hypotheekvorm en persoonlijke rente wijken af.
          </p>
          <div className="mt-4">
            <VergelijkTabel
              koppen={["Rentevaste periode", "Gemiddelde rente", "Maandlast (indicatie)"]}
              rijen={maandlasten.map((regel) => [
                regel.label,
                `${regel.pct.toLocaleString("nl-NL", { maximumFractionDigits: 2 })}%`,
                <span key={regel.label} className="font-medium">{formatEuro(regel.maandlast)}</span>,
              ])}
              bron={`Bron: ${rentes.bron}, maandgemiddelden over banken, peilmaand ${peilmaandLabel(rentes.peildatum)}, opgehaald ${formatDatumNl(rentes.opgehaaldOp)}. Geen tarieven per geldverstrekker en geen NHG-splitsing.`}
            />
          </div>
        </Kaart>
      ) : null}

      <div className="mt-5">
        <LeadCta
          titel="Overwaarde benutten of oversluiten?"
          tekst="Een onafhankelijke hypotheekadviseur rekent met jouw echte cijfers door wat verstandig is: overwaarde opnemen, oversluiten of gewoon laten staan. Vrijblijvend, en je beslist zelf."
          knopTekst="Stel je hypotheekvraag"
          href={`/hypotheek?${adresQuery}`}
          ontvanger="een onafhankelijke hypotheekadviseur"
        />
      </div>
    </section>
  );
}
