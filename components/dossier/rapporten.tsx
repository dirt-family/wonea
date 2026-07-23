import Link from "next/link";
import { Kaart, KnopSecundair, SectieLabel } from "@/components/ui";
import { CONSENT_TEKST_ALERTS } from "@/app/claim/consent-teksten";
import { zetAlerts, zegClaimOp } from "@/app/dashboard/actions";
import { DeelRapport } from "@/components/dossier/deel-rapport";

/**
 * Sectie 5 van het woningdossier: waarde-alerts (consent nooit
 * vooraangevinkt), deelbare rapporten (alleen publieke data, intrekbaar)
 * en de beheerkant: claim opzeggen en de woningpagina van Wonea laten
 * verwijderen. Die laatste twee horen zichtbaar te zijn, geen kleine
 * lettertjes: verwijderen kan altijd.
 */

export function RapportenSectie({
  claimId,
  alertsActief,
  heeftAlertsConsent,
  deelLinks,
  adresQuery,
}: {
  claimId: number;
  alertsActief: boolean;
  heeftAlertsConsent: boolean;
  deelLinks: { token: string; createdAt: string }[];
  adresQuery: string;
}) {
  return (
    <section id="rapporten" aria-label="Rapporten en alerts" className="scroll-mt-6">
      <h2 className="text-2xl font-semibold">Rapporten en alerts</h2>

      <div className="mt-4 grid gap-5 lg:grid-cols-2">
        <Kaart>
          <SectieLabel>Waarde-alerts</SectieLabel>
          {alertsActief ? (
            <>
              <p className="mt-2 text-sm leading-relaxed text-inkt-zacht">
                Staan aan: je krijgt maandelijks de waardeontwikkeling per mail. Uitzetten kan altijd.
              </p>
              <form action={zetAlerts} className="mt-3">
                <input type="hidden" name="claimId" value={claimId} />
                <input type="hidden" name="actie" value="uit" />
                <KnopSecundair type="submit">Zet alerts uit</KnopSecundair>
              </form>
            </>
          ) : (
            <form action={zetAlerts} className="mt-2 space-y-3">
              <input type="hidden" name="claimId" value={claimId} />
              <input type="hidden" name="actie" value="aan" />
              {heeftAlertsConsent ? (
                <p className="text-sm leading-relaxed text-inkt-zacht">
                  Staan uit. Je toestemming voor alerts is al vastgelegd, dus aanzetten is één klik.
                </p>
              ) : (
                <label className="flex items-start gap-3 text-sm text-inkt">
                  <input type="checkbox" name="consent" value="1" className="mt-0.5 accent-merk" />
                  <span>{CONSENT_TEKST_ALERTS}</span>
                </label>
              )}
              <KnopSecundair type="submit">Zet alerts aan</KnopSecundair>
            </form>
          )}
        </Kaart>

        <Kaart>
          <SectieLabel>Deel je rapport</SectieLabel>
          <p className="mt-2 mb-3 text-sm leading-relaxed text-inkt-zacht">
            Een deelbare link toont alleen gegevens die ook op de publieke woningpagina staan, niets uit dit dossier.
            Intrekken kan altijd.
          </p>
          <DeelRapport claimId={claimId} links={deelLinks} />
        </Kaart>
      </div>

      <Kaart className="mt-5">
        <SectieLabel>Beheer</SectieLabel>
        <div className="mt-3 space-y-4 text-sm leading-relaxed text-inkt-zacht">
          <div>
            <p>
              Claim opzeggen stopt je alerts en trekt deelbare links in. De publieke woningpagina blijft dan gewoon
              bestaan.
            </p>
            <form action={zegClaimOp} className="mt-2">
              <input type="hidden" name="claimId" value={claimId} />
              <button type="submit" className="text-sm font-semibold text-negatief underline underline-offset-4">
                Zeg deze claim op
              </button>
            </form>
          </div>
          <div className="border-t border-lijn pt-4">
            <p>
              Wil je deze woningpagina helemaal van Wonea af? Dat kan altijd, in twee stappen met e-mailbevestiging. Na
              verwijdering komt het adres ook bij nieuwe data-imports niet terug.
            </p>
            <Link
              href={`/verwijderen?${adresQuery}`}
              className="mt-2 inline-block text-sm font-semibold text-merk underline underline-offset-4"
            >
              Verwijder deze woningpagina van Wonea
            </Link>
          </div>
        </div>
      </Kaart>
    </section>
  );
}
