import Link from "next/link";
import { BronLabel, inputClass, Kaart, KnopSecundair, LegeStaat, SectieLabel, Veld } from "@/components/ui";
import { formatEuro } from "@/lib/format";
import { bewaarWoz } from "@/app/dashboard/actions";
import { WOZ_PEILJAAR_MIN, wozPeiljaarMax, wozVerschilPct, type JaarSchatting, type WozRij } from "@/components/dossier/data";

/**
 * Sectie 2 van het woningdossier: het WOZ-dossier van de eigen woning.
 * De eigenaar vult per peiljaar de WOZ-waarde van de eigen beschikking in
 * (bron "eigenaar", alleen mogelijk op de eigen claim); per jaar vergelijken
 * we met onze marktschatting van dat jaar. Plus de eerlijke bezwaar-uitleg:
 * bezwaar is gratis via de gemeente, Wonea verdient er niets aan.
 */

export function WozSectie({
  claimId,
  adresQuery,
  wozRijen,
  jaarSchattingen,
}: {
  claimId: number;
  adresQuery: string;
  wozRijen: WozRij[];
  jaarSchattingen: JaarSchatting[];
}) {
  const maxJaar = wozPeiljaarMax();
  const jaren: number[] = [];
  for (let j = maxJaar; j >= WOZ_PEILJAAR_MIN; j--) jaren.push(j);
  const schattingPerJaar = new Map(jaarSchattingen.map((s) => [s.jaar, s]));

  return (
    <section id="woz" aria-label="WOZ-dossier" className="scroll-mt-6">
      <h2 className="text-2xl font-semibold">WOZ-dossier</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-inkt-zacht">
        Leg hier per peiljaar de WOZ-waarde van je eigen beschikking vast. Dat kan alleen voor je eigen geclaimde woning;
        we vergelijken elk jaar met onze marktschatting van dat jaar. Je officiële WOZ vind je op je beschikking of via
        wozwaardeloket.nl.
      </p>

      <Kaart className="mt-4">
        <SectieLabel>WOZ per peiljaar</SectieLabel>
        {wozRijen.length > 0 ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-lijn text-left text-xs uppercase tracking-wide text-gedempt">
                  <th className="py-2 pr-4 font-medium">Peiljaar</th>
                  <th className="py-2 pr-4 font-medium">WOZ-waarde</th>
                  <th className="py-2 pr-4 font-medium">Marktschatting dat jaar</th>
                  <th className="py-2 font-medium">Verschil</th>
                </tr>
              </thead>
              <tbody>
                {[...wozRijen].reverse().map((rij) => {
                  const schatting = schattingPerJaar.get(rij.peiljaar);
                  const verschil = schatting ? wozVerschilPct(rij.waarde, schatting.waarde) : null;
                  return (
                    <tr key={rij.peiljaar} className="border-b border-lijn last:border-0">
                      <td className="py-2.5 pr-4">{rij.peiljaar}</td>
                      <td className="py-2.5 pr-4 font-medium">
                        {formatEuro(rij.waarde)}
                        {rij.bron === "seed" ? (
                          <span className="mt-1 block">
                            <BronLabel>voorbeeldwaarde, niet je echte WOZ</BronLabel>
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2.5 pr-4">
                        {schatting ? (
                          <>
                            {formatEuro(schatting.waarde)}
                            <span className="block text-xs text-gedempt">
                              bandbreedte {formatEuro(schatting.intervalLaag)} tot {formatEuro(schatting.intervalHoog)}
                            </span>
                          </>
                        ) : (
                          <span className="text-gedempt">geen schatting voor dit jaar</span>
                        )}
                      </td>
                      <td className="py-2.5">
                        {verschil != null && schatting ? (
                          <span
                            className={
                              rij.waarde > schatting.intervalHoog
                                ? "font-medium text-negatief"
                                : rij.waarde < schatting.intervalLaag
                                  ? "font-medium text-positief"
                                  : "font-medium"
                            }
                          >
                            {verschil > 0 ? "+" : ""}
                            {verschil.toLocaleString("nl-NL", { maximumFractionDigits: 1 })}%
                          </span>
                        ) : (
                          <span className="text-gedempt">n.v.t.</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-gedempt">
              Verschil = jouw WOZ ten opzichte van onze marktschatting van dat jaar. Rood: WOZ boven de bandbreedte van de
              schatting; groen: eronder. De schatting is modelmatig, geen taxatie.
            </p>
          </div>
        ) : (
          <div className="mt-3">
            <LegeStaat
              titel="Nog geen WOZ-waarden vastgelegd"
              tekst="Vul hieronder de WOZ-waarde van je beschikking in. Wij tonen nooit een WOZ zonder bron; jouw invoer is de bron voor jouw dossier."
            />
          </div>
        )}
      </Kaart>

      <Kaart className="mt-5">
        <SectieLabel>WOZ-waarde toevoegen of bijwerken</SectieLabel>
        <p className="mt-2 text-sm leading-relaxed text-inkt-zacht">
          Neem het peiljaar en de waarde over van je WOZ-beschikking. Vul je een jaar in dat er al staat, dan werken we die
          waarde bij.
        </p>
        <form action={bewaarWoz} className="mt-4 grid gap-4 sm:grid-cols-[auto_1fr_auto] sm:items-end">
          <input type="hidden" name="claimId" value={claimId} />
          <Veld label="Peiljaar">
            <select name="peiljaar" defaultValue={String(maxJaar)} className={inputClass}>
              {jaren.map((j) => (
                <option key={j} value={j}>
                  {j}
                </option>
              ))}
            </select>
          </Veld>
          <Veld label="WOZ-waarde (euro)" hint="Zoals op je beschikking, in hele euro's.">
            <input name="waarde" inputMode="numeric" required placeholder="385000" className={inputClass} />
          </Veld>
          <div className="pb-6 sm:pb-0">
            <KnopSecundair type="submit">Bewaar WOZ-waarde</KnopSecundair>
          </div>
        </form>
      </Kaart>

      <Kaart className="mt-5 bg-merk-wash">
        <SectieLabel>Bezwaar maken?</SectieLabel>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-inkt-zacht">
          Ligt je WOZ duidelijk boven de bandbreedte van onze schatting, dan kan bezwaar zinvol zijn. Doe dat binnen zes
          weken na de beschikking, gratis en rechtstreeks via de site van je gemeente. Bureaus die het &quot;gratis&quot;
          voor je doen heb je niet nodig; Wonea verdient hier niets aan. Eerlijk is ook: een hogere WOZ kan in je voordeel
          werken, bijvoorbeeld voor de rente-opslag op je hypotheek.
        </p>
        <Link
          href={`/woz-check?${adresQuery}`}
          className="mt-3 inline-block text-sm font-semibold text-merk underline underline-offset-4"
        >
          Naar de volledige WOZ-check
        </Link>
      </Kaart>
    </section>
  );
}
