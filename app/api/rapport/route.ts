import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { addresses, claims, sharedReports } from "@/db/schema";
import { currentUser } from "@/lib/auth";
import { clientIp, rateLimited } from "@/lib/ratelimit";
import { isAddressIdSuppressed, isSuppressed } from "@/lib/suppression";
import { nowIso, randomToken } from "@/lib/util";

/**
 * Deel-je-rapport API. POST maakt een deelbaar token voor een eigen, actieve
 * claim; DELETE trekt een eigen token in. Een opt-out van het adres wint
 * altijd: gesupprimeerde adressen zijn niet deelbaar en applyOptoutCascade
 * revoceert bestaande rapporten.
 */

const postSchema = z.object({ claimId: z.number().int().positive() });
const deleteSchema = z.object({ token: z.string().min(16).max(128) });

function requestIp(request: Request): string {
  return clientIp(request.headers);
}

async function parseJson(request: Request): Promise<unknown | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  if (rateLimited(`rapport:${requestIp(request)}`, 10)) {
    return NextResponse.json({ fout: "Te veel verzoeken achter elkaar. Probeer het over een minuut opnieuw." }, { status: 429 });
  }

  const user = await currentUser();
  if (!user) return NextResponse.json({ fout: "Log eerst in om een rapport te delen." }, { status: 401 });

  const parsed = postSchema.safeParse(await parseJson(request));
  if (!parsed.success) return NextResponse.json({ fout: "Ongeldige invoer." }, { status: 400 });

  const claim = (await db.select().from(claims).where(eq(claims.id, parsed.data.claimId)).limit(1))[0];
  // Claim van iemand anders behandelen we hetzelfde als niet-bestaand: geen
  // informatielek over wat er wel of niet in de database staat.
  if (!claim || claim.userId !== user.id) {
    return NextResponse.json({ fout: "Claim niet gevonden." }, { status: 404 });
  }
  if (claim.endedAt) {
    return NextResponse.json({ fout: "Deze claim is beeindigd; er valt niets meer te delen." }, { status: 409 });
  }

  const adres = (await db.select().from(addresses).where(eq(addresses.id, claim.adresId)).limit(1))[0];
  if (!adres || adres.status === "opted_out" || (await isAddressIdSuppressed(adres.id)) || (await isSuppressed(adres.postcode, adres.nummerslug))) {
    return NextResponse.json({ fout: "Dit adres is van Wonea verwijderd en kan niet gedeeld worden." }, { status: 409 });
  }

  const token = randomToken(24);
  await db.insert(sharedReports).values({ token, claimId: claim.id, adresId: adres.id, createdAt: nowIso() });

  return NextResponse.json({ token });
}

export async function DELETE(request: Request) {
  if (rateLimited(`rapport:${requestIp(request)}`, 10)) {
    return NextResponse.json({ fout: "Te veel verzoeken achter elkaar. Probeer het over een minuut opnieuw." }, { status: 429 });
  }

  const user = await currentUser();
  if (!user) return NextResponse.json({ fout: "Log eerst in om een rapport in te trekken." }, { status: 401 });

  const parsed = deleteSchema.safeParse(await parseJson(request));
  if (!parsed.success) return NextResponse.json({ fout: "Ongeldige invoer." }, { status: 400 });

  const rij = (await db
    .select({ rapport: sharedReports, eigenaarId: claims.userId })
    .from(sharedReports)
    .innerJoin(claims, eq(claims.id, sharedReports.claimId))
    .where(eq(sharedReports.token, parsed.data.token))
    .limit(1))[0];
  if (!rij || rij.eigenaarId !== user.id) {
    return NextResponse.json({ fout: "Rapport niet gevonden." }, { status: 404 });
  }

  if (!rij.rapport.revokedAt) {
    await db.update(sharedReports).set({ revokedAt: nowIso() }).where(eq(sharedReports.id, rij.rapport.id));
  }

  return NextResponse.json({ ok: true });
}
