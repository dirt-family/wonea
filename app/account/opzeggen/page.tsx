import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, destroySession } from "@/lib/auth";
import { KnopPrimair, SectieLabel } from "@/components/ui";
import { Blok } from "@/components/dossier/blok";
import { zegAccountOp } from "@/app/account/logic";

export const metadata: Metadata = { title: "Account opzeggen", robots: { index: false, follow: false } };

// Stap 2 van 2: pas na de expliciete bevestiging op deze pagina gebeurt er
// iets. De sessie wordt in de action opnieuw gecheckt.
async function bevestigOpzegging() {
  "use server";
  const user = await currentUser();
  if (!user) redirect("/claim");
  await zegAccountOp(user.id);
  // Alle sessierijen zijn al verwijderd; dit ruimt alleen de cookie nog op.
  await destroySession();
  redirect("/account/opzeggen?klaar=1");
}

export default async function OpzeggenPagina({ searchParams }: { searchParams: Promise<{ klaar?: string }> }) {
  const sp = await searchParams;

  if (sp.klaar === "1") {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16">
        <h1 className="text-3xl font-semibold">Je account is opgezegd</h1>
        <p className="mt-4 leading-relaxed text-inkt-zacht">
          Je claims, hypotheekgegevens, sessies en account zijn verwijderd. Je toestemmingen zijn ingetrokken en eerdere
          aanvragen zijn geanonimiseerd. Ter bevestiging staat er nog een laatste mail voor je klaar.
        </p>
        <p className="mt-4 leading-relaxed text-inkt-zacht">
          De publieke woningpagina van een adres staat los van een account. Wil je die ook weg, dan kan dat altijd, in twee
          stappen en zonder account, via de{" "}
          <Link href="/verwijderen" className="font-semibold text-merk underline underline-offset-4">
            verwijderpagina
          </Link>
          .
        </p>
        <p className="mt-4 leading-relaxed text-inkt-zacht">
          Bedankt dat je Wonea probeerde. Terugkomen kan altijd: je logt gewoon opnieuw in met je e-mailadres.
        </p>
      </div>
    );
  }

  const user = await currentUser();
  if (!user) redirect("/claim");

  return (
    <div className="max-w-2xl py-2">
      <h1 className="text-3xl font-semibold">Account opzeggen</h1>
      <p className="mt-4 leading-relaxed text-inkt-zacht">
        Dit is stap twee van twee, voor het account <strong>{user.email}</strong>. Na je bevestiging gebeurt dit, direct en
        definitief:
      </p>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-inkt-zacht">
        <li>je claims vervallen, inclusief de hypotheekgegevens die je invulde;</li>
        <li>je waarde-alerts stoppen en gedeelde rapport-links werken niet meer;</li>
        <li>al je toestemmingen worden ingetrokken; het toestemmingsregister bewaren we als bewijs van geven en intrekken;</li>
        <li>al je sessies en je account worden verwijderd;</li>
        <li>
          eerdere aanvragen (bijvoorbeeld een hypotheek- of verkoopvraag) worden geanonimiseerd: je e-mailadres gaat eruit,
          zodat onze statistieken kloppen zonder iets over jou te bewaren.
        </li>
      </ul>
      <Blok className="mt-8">
        <SectieLabel>Goed om te weten</SectieLabel>
        <p className="mt-2 text-sm leading-relaxed text-inkt-zacht">
          De publieke woningpagina van je adres staat los van je account en blijft bestaan; die toont alleen openbare data.
          Wil je die pagina ook weg, dan regel je dat los hiervan via de{" "}
          <Link href="/verwijderen" className="font-semibold text-merk underline underline-offset-4">
            verwijderpagina
          </Link>
          : twee stappen, geen account nodig.
        </p>
        <form action={bevestigOpzegging} className="mt-5">
          <KnopPrimair type="submit">Ja, zeg mijn account op</KnopPrimair>
        </form>
        <p className="mt-4 text-sm text-gedempt">
          Toch niet?{" "}
          <Link href="/account" className="font-semibold text-merk underline underline-offset-4">
            Terug naar je account
          </Link>
          ; zonder bevestiging verandert er niets.
        </p>
      </Blok>
    </div>
  );
}
