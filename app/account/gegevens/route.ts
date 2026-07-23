import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { bouwGegevensExport } from "@/app/account/logic";
import { todayIso } from "@/lib/util";

/**
 * AVG-inzage als self-service download: een JSON-bestand met alles wat Wonea
 * aan dit account of e-mailadres koppelt. Alleen voor de ingelogde gebruiker,
 * nooit gecachet, nooit geindexeerd.
 */
export async function GET(): Promise<Response> {
  const user = await currentUser();
  if (!user) redirect("/claim");

  const gegevens = await bouwGegevensExport(user.id);
  if (!gegevens) redirect("/claim");

  return new Response(JSON.stringify(gegevens, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="wonea-gegevens-${todayIso()}.json"`,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
