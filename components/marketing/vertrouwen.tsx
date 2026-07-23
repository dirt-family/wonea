import Link from "next/link";
import { KnopSecundair } from "@/components/ui";
import { WoneaLogo } from "@/components/logo";
import { Illustratie } from "@/components/illustraties";

/**
 * Volle-breedte vertrouwenssectie: het differentiator-verhaal. Rustig en
 * feitelijk: verwijderen kan altijd, de methode is openbaar. De grote
 * huisvorm is het ene toegestane achtergrond-motief op deze pagina.
 */
export function Vertrouwen() {
  return (
    <section className="relative overflow-hidden border-y border-lijn bg-paneel">
      <WoneaLogo className="pointer-events-none absolute -bottom-20 -right-12 h-80 w-80 text-merk-50 sm:-right-4" />
      <div className="relative mx-auto flex max-w-5xl items-center gap-12 px-5 py-16">
        <div className="min-w-0 flex-1">
          <h2 className="max-w-xl text-3xl font-semibold">Jouw huis, jouw data</h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-inkt-zacht">
            Wonea toont openbare data over woningen, maar het blijft jouw huis. Wil je niet dat jouw adres hier staat?
            Verwijderen kan altijd, in twee stappen, zonder account. Na verwijdering komt je adres ook bij nieuwe
            data-imports niet terug.
          </p>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-inkt-zacht">
            En hoe we rekenen is geen geheim: de methode staat openbaar op de site, inclusief wat het model niet weet.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-5">
            <KnopSecundair href="/verwijderen">Je woning verwijderen</KnopSecundair>
            <Link href="/methode" className="text-sm font-semibold text-merk underline underline-offset-4">
              Lees hoe we rekenen
            </Link>
          </div>
        </div>
        <Illustratie naam="jouw-data" className="hidden h-auto w-56 shrink-0 md:block lg:w-64" />
      </div>
    </section>
  );
}
