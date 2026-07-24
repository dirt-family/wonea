"use client";

import Link from "next/link";
import { useState } from "react";
import {
  GerelateerdeRekenhulpen,
  RekenModule,
  RekenmoduleSamenvatting,
  UitkomstMoment,
  type SamenvattingRij,
  type StapDefinitie,
} from "@/components/rekenmodule";
import { inputClass, LeadCta, UitklapUitleg, VoortgangsBalk } from "@/components/ui";
import { formatEuro } from "@/lib/format";
import {
  berekenOverbod,
  klemOverbodPct,
  klemVraagprijs,
  OVERBOD_PCT_DEFAULT,
  OVERBOD_PCT_MAX,
  OVERBOD_PCT_MIN,
  OVERBOD_PCT_STAP,
  VRAAGPRIJS_DEFAULT,
  VRAAGPRIJS_MAX,
  VRAAGPRIJS_MIN,
  VRAAGPRIJS_STAP,
} from "@/app/overbieden/berekening";

/**
 * Overbieden-rekenhulp op het rekenmodule-framework (components/rekenmodule/).
 * Deze laag levert alleen de twee vraagstappen (vraagprijs en bod; de
 * taxatie-inschatting als apart, optioneel veld) plus de uitkomst-view; het
 * frame regelt StappenBalk, navigatie, ?stap= in de URL, focus en
 * sessie-persistentie. Rekent volledig client-side met pure functies
 * (berekening.ts); er wordt niets opgeslagen of verstuurd buiten de browser.
 * Bewust geen aanname over hoe de taxatie zich tot de vraagprijs verhoudt.
 */

export function OverbiedenStepper() {
  const [vraagprijsInvoer, setVraagprijsInvoer] = useState(String(VRAAGPRIJS_DEFAULT));
  const [pctInvoer, setPctInvoer] = useState(String(OVERBOD_PCT_DEFAULT));
  const [taxatieInvoer, setTaxatieInvoer] = useState("");

  const vraagprijs = klemVraagprijs(Number(vraagprijsInvoer.replace(/[^\d]/g, "")));
  const overbodPct = klemOverbodPct(Number(pctInvoer.replace(/[^\d]/g, "")));
  const taxatieGetal = Number(taxatieInvoer.replace(/[^\d]/g, ""));
  const taxatiewaarde = taxatieInvoer.trim() && Number.isFinite(taxatieGetal) && taxatieGetal > 0 ? taxatieGetal : null;

  const u = berekenOverbod({ vraagprijs, overbodPct, taxatiewaarde });

  function valideerBod(): string | null {
    if (!vraagprijsInvoer.replace(/[^\d]/g, "")) return "Vul de vraagprijs in hele euro's in, of gebruik de schuif.";
    return null;
  }

  function valideerTaxatie(): string | null {
    if (!taxatieInvoer.trim()) return null; // Leeg laten mag: dan doen we geen uitspraak over eigen geld.
    if (!Number.isFinite(taxatieGetal) || taxatieGetal <= 0) {
      return "Vul de getaxeerde waarde in hele euro's in, of laat het veld leeg als je nog geen taxatie hebt.";
    }
    return null;
  }

  /** Herstel uit sessionStorage: elk veld eerst op type controleren. */
  function herstel(data: Record<string, unknown>) {
    if (typeof data.vraagprijs === "string") setVraagprijsInvoer(data.vraagprijs);
    if (typeof data.pct === "string") setPctInvoer(data.pct);
    if (typeof data.taxatie === "string") setTaxatieInvoer(data.taxatie);
  }

  const stappen: StapDefinitie[] = [
    {
      id: "bod",
      titel: "Vraagprijs en bod",
      vraag: "Wat wil je bieden?",
      valideer: valideerBod,
      inhoud: (
        <>
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-inkt">Vraagprijs</span>
              <input
                type="range"
                min={VRAAGPRIJS_MIN}
                max={VRAAGPRIJS_MAX}
                step={VRAAGPRIJS_STAP}
                value={vraagprijs}
                onChange={(e) => setVraagprijsInvoer(e.target.value)}
                className="w-full accent-merk"
                aria-label="Vraagprijs instellen"
              />
              <span className="mt-1 flex justify-between text-xs tabular-nums text-gedempt">
                <span>{formatEuro(VRAAGPRIJS_MIN)}</span>
                <span>{formatEuro(VRAAGPRIJS_MAX)}</span>
              </span>
            </label>
            <label className="block sm:w-44">
              <span className="mb-1 block text-sm font-medium text-inkt">Of typ een bedrag</span>
              <input
                inputMode="numeric"
                placeholder={`bv. ${VRAAGPRIJS_DEFAULT}`}
                value={vraagprijsInvoer}
                onChange={(e) => setVraagprijsInvoer(e.target.value)}
                className={inputClass}
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 flex items-baseline justify-between text-sm font-medium text-inkt">
              <span>Overbod</span>
              <span className="tabular-nums text-inkt-zacht">{overbodPct}% boven de vraagprijs</span>
            </span>
            <input
              type="range"
              min={OVERBOD_PCT_MIN}
              max={OVERBOD_PCT_MAX}
              step={OVERBOD_PCT_STAP}
              value={overbodPct}
              onChange={(e) => setPctInvoer(e.target.value)}
              className="w-full accent-merk"
              aria-label="Overbod-percentage instellen"
            />
            <span className="mt-1 flex justify-between text-xs tabular-nums text-gedempt">
              <span>{OVERBOD_PCT_MIN}%</span>
              <span>{OVERBOD_PCT_MAX}%</span>
            </span>
          </label>

          <p className="text-sm leading-relaxed text-inkt-zacht">
            Bij {overbodPct}% boven de vraagprijs is je bod {formatEuro(u.bod)}. Zet de schuif op {OVERBOD_PCT_MIN}% om
            precies de vraagprijs te bieden.
          </p>
        </>
      ),
    },
    {
      id: "taxatie",
      titel: "Taxatie",
      vraag: "Wat is de getaxeerde waarde?",
      valideer: valideerTaxatie,
      inhoud: (
        <>
          <p className="text-sm leading-relaxed text-inkt-zacht">
            Banken financieren tot de getaxeerde marktwaarde van de woning, niet tot je bod. Daarom vragen we de taxatie
            apart: alleen daarmee kunnen we laten zien welk deel van je bod uit eigen zak komt.
          </p>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-inkt">Getaxeerde waarde</span>
            <input
              inputMode="numeric"
              placeholder="bv. 360000"
              value={taxatieInvoer}
              onChange={(e) => setTaxatieInvoer(e.target.value)}
              className={inputClass}
            />
            <span className="mt-1 block text-xs leading-relaxed text-gedempt">
              Uit een taxatierapport of gevalideerde waardebepaling. De taxatie kan boven of onder de vraagprijs liggen;
              we doen daar geen aanname over. Nog geen taxatie? Laat het veld leeg.
            </span>
          </label>
        </>
      ),
    },
  ];

  return (
    <RekenModule
      moduleId="overbieden"
      stappen={stappen}
      uitkomstTitel="Uitkomst"
      uitkomstKnopTekst="Bekijk je uitkomst"
      sessie={{
        snapshot: () => ({ vraagprijs: vraagprijsInvoer, pct: pctInvoer, taxatie: taxatieInvoer }),
        herstel,
      }}
      uitkomst={(api) => {
        const samenvatting: SamenvattingRij[] = [
          { label: "Vraagprijs", waarde: formatEuro(vraagprijs), stapIndex: 0 },
          { label: "Overbod", waarde: `${overbodPct}%`, stapIndex: 0 },
          { label: "Getaxeerde waarde", waarde: taxatiewaarde != null ? formatEuro(taxatiewaarde) : "niet ingevuld", stapIndex: 1 },
        ];
        return (
          <div className="space-y-5">
            <UitkomstMoment label="Jouw bod" waarde={formatEuro(u.bod)}>
              {u.uitEigenZak != null && u.gefinancierdDeel != null ? (
                <>
                  {/* Flux-echo: uitkomst-grafiekje. De balk splitst het bod
                      in wat de bank financiert (navy) en wat uit eigen zak
                      komt (amber, het aandachtspunt); eigen zak 0 valt
                      eerlijk uit de balk maar blijft in de legenda staan. */}
                  <VoortgangsBalk
                    className="mt-5"
                    formatteer={formatEuro}
                    segmenten={[
                      { label: "Bank financiert (tot de getaxeerde waarde)", waarde: u.gefinancierdDeel, kleur: "merk" },
                      { label: "Uit eigen zak (boven de taxatie)", waarde: u.uitEigenZak, kleur: "amber" },
                    ]}
                  />
                  <p className="mt-4 text-sm leading-relaxed text-inkt-zacht">
                    {u.uitEigenZak > 0
                      ? `Een bank financiert maximaal tot de getaxeerde waarde. De ${formatEuro(u.uitEigenZak)} boven de taxatie betaal je dus uit eigen geld, bovenop de kosten koper.`
                      : "Dit bod ligt niet boven de getaxeerde waarde, dus dit deel van je bod kan een bank volledig financieren. De kosten koper betaal je wel altijd zelf."}
                  </p>
                </>
              ) : (
                <p className="mt-4 text-sm leading-relaxed text-inkt-zacht">
                  Vul de getaxeerde waarde in om te zien welk deel van dit bod je uit eigen zak betaalt. Banken
                  financieren maximaal tot de getaxeerde waarde; alles daarboven komt uit eigen geld. Zonder taxatie
                  kunnen we daar eerlijk gezegd niets over zeggen.
                </p>
              )}
              <p className="mt-3 text-xs text-gedempt">Bedoeld om je een gevoel te geven, niet om op te baseren.</p>
            </UitkomstMoment>

            <RekenmoduleSamenvatting rijen={samenvatting} gaNaarStap={api.gaNaarStap} />

            <UitklapUitleg titel="Zo rekenen we">
              <ul className="list-disc space-y-2 pl-5">
                <li>Jouw bod is de vraagprijs plus het gekozen percentage, afgerond op hele euro's.</li>
                <li>
                  Een bank financiert maximaal 100% van de getaxeerde marktwaarde van de woning, niet van je bod. Bied
                  je meer dan de taxatie, dan is dat verschil eigen geld.
                </li>
                <li>
                  De getaxeerde waarde vul je zelf in. We nemen bewust geen aanname over hoe de taxatie zich tot de
                  vraagprijs verhoudt: dat verschilt per woning en per markt.
                </li>
                <li>
                  Naast het deel boven de taxatie betaal je altijd de kosten koper uit eigen geld; die reken je na met
                  de{" "}
                  <Link href="/kosten-koper" className="underline underline-offset-2 hover:text-merk">
                    kosten-koper-rekenhulp
                  </Link>
                  .
                </li>
              </ul>
              <p className="mt-3">
                Meer over onze werkwijze staat op de{" "}
                <Link href="/methode" className="underline underline-offset-2 hover:text-merk">
                  methodepagina
                </Link>
                .
              </p>
            </UitklapUitleg>

            <GerelateerdeRekenhulpen
              items={[
                { titel: "Kosten koper", zin: "Hoeveel eigen geld je nodig hebt bovenop je hypotheek.", href: "/kosten-koper" },
                { titel: "Biedadvies", zin: "Een realistische biedrange bij een specifieke woning; je vindt het op de woningpagina.", href: "/tools#biedadvies" },
              ]}
            />

            <LeadCta
              titel="Van indicatie naar echt advies"
              tekst="Hoeveel je verantwoord kunt bieden hangt af van je leenruimte en je eigen geld. Een onafhankelijke hypotheekadviseur rekent dat voor jouw situatie door."
              knopTekst="Stel je vraag aan een adviseur"
              href="/hypotheek"
              ontvanger="een onafhankelijke hypotheekadviseur"
            />
          </div>
        );
      }}
    />
  );
}
