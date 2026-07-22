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
export function createMagicToken(email: string): string {
  const token = randomToken(24);
  db.insert(magicTokens)
    .values({
      email: email.toLowerCase().trim(),
      tokenHash: sha256Hex(token),
      expiresAt: new Date(Date.now() + MAGIC_TTL_MS).toISOString(),
      createdAt: nowIso(),
    })
    .run();
  return token;
}

/** Verzilvert een magic token: eenmalig, binnen TTL. Geeft userId of null. */
export function consumeMagicToken(token: string): number | null {
  const row = db
    .select()
    .from(magicTokens)
    .where(and(eq(magicTokens.tokenHash, sha256Hex(token)), isNull(magicTokens.usedAt), gt(magicTokens.expiresAt, nowIso())))
    .get();
  if (!row) return null;

  db.update(magicTokens).set({ usedAt: nowIso() }).where(eq(magicTokens.id, row.id)).run();

  const bestaand = db.select().from(users).where(eq(users.email, row.email)).get();
  if (bestaand) {
    if (!bestaand.verifiedAt) db.update(users).set({ verifiedAt: nowIso() }).where(eq(users.id, bestaand.id)).run();
    return bestaand.id;
  }
  const inserted = db.insert(users).values({ email: row.email, verifiedAt: nowIso(), createdAt: nowIso() }).returning({ id: users.id }).get();
  return inserted.id;
}

export async function createSession(userId: number): Promise<void> {
  const id = randomToken(32);
  db.insert(sessions).values({ id, userId, expiresAt: isoDaysFromNow(30), createdAt: nowIso() }).run();
  const jar = await cookies();
  jar.set(SESSION_COOKIE, id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 30 * 24 * 3600 });
}

export async function currentUser(): Promise<{ id: number; email: string } | null> {
  const jar = await cookies();
  const sid = jar.get(SESSION_COOKIE)?.value;
  if (!sid) return null;
  const row = db
    .select({ id: users.id, email: users.email, expiresAt: sessions.expiresAt })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, sid))
    .get();
  if (!row || row.expiresAt < nowIso()) return null;
  return { id: row.id, email: row.email };
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const sid = jar.get(SESSION_COOKIE)?.value;
  if (sid) db.delete(sessions).where(eq(sessions.id, sid)).run();
  jar.delete(SESSION_COOKIE);
}
