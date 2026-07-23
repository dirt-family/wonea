import { and, eq, gt, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { magicTokens, sessions, users } from "@/db/schema";
import { isoDaysFromNow, nowIso, randomToken, sha256Hex } from "@/lib/util";

const SESSION_COOKIE = "wonea_session";
const MAGIC_TTL_MS = 15 * 60 * 1000;

// Simpele in-memory rate limit per e-mailadres (dev-schaal).
const magicRequests = new Map<string, number[]>();
const MAGIC_MAX_PER_UUR = 5;

export function magicLinkRateLimited(email: string): boolean {
  const now = Date.now();
  const recent = (magicRequests.get(email) ?? []).filter((t) => now - t < 60 * 60 * 1000);
  if (recent.length >= MAGIC_MAX_PER_UUR) return true;
  recent.push(now);
  magicRequests.set(email, recent);
  return false;
}

/** Maakt een magic-link token aan (gehasht opgeslagen) en geeft de klare token terug. */
export async function createMagicToken(email: string): Promise<string> {
  const token = randomToken(24);
  await db.insert(magicTokens).values({
    email: email.toLowerCase().trim(),
    tokenHash: sha256Hex(token),
    expiresAt: new Date(Date.now() + MAGIC_TTL_MS).toISOString(),
    createdAt: nowIso(),
  });
  return token;
}

/** Verzilvert een magic token: eenmalig, binnen TTL. Geeft userId of null. */
export async function consumeMagicToken(token: string): Promise<number | null> {
  const rows = await db
    .select()
    .from(magicTokens)
    .where(and(eq(magicTokens.tokenHash, sha256Hex(token)), isNull(magicTokens.usedAt), gt(magicTokens.expiresAt, nowIso())))
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  await db.update(magicTokens).set({ usedAt: nowIso() }).where(eq(magicTokens.id, row.id));

  const bestaandRows = await db.select().from(users).where(eq(users.email, row.email)).limit(1);
  const bestaand = bestaandRows[0];
  if (bestaand) {
    if (!bestaand.verifiedAt) await db.update(users).set({ verifiedAt: nowIso() }).where(eq(users.id, bestaand.id));
    return bestaand.id;
  }
  const inserted = await db.insert(users).values({ email: row.email, verifiedAt: nowIso(), createdAt: nowIso() }).returning({ id: users.id });
  return inserted[0].id;
}

export async function createSession(userId: number): Promise<void> {
  const id = randomToken(32);
  await db.insert(sessions).values({ id, userId, expiresAt: isoDaysFromNow(30), createdAt: nowIso() });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 30 * 24 * 3600 });
}

export async function currentUser(): Promise<{ id: number; email: string } | null> {
  const jar = await cookies();
  const sid = jar.get(SESSION_COOKIE)?.value;
  if (!sid) return null;
  const rows = await db
    .select({ id: users.id, email: users.email, expiresAt: sessions.expiresAt })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, sid))
    .limit(1);
  const row = rows[0];
  if (!row || row.expiresAt < nowIso()) return null;
  return { id: row.id, email: row.email };
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const sid = jar.get(SESSION_COOKIE)?.value;
  if (sid) await db.delete(sessions).where(eq(sessions.id, sid));
  jar.delete(SESSION_COOKIE);
}
