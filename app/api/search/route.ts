import { NextResponse } from "next/server";
import { and, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { addresses } from "@/db/schema";
import { isSuppressed } from "@/lib/suppression";
import { normalizePostcode } from "@/lib/util";

const querySchema = z.object({ q: z.string().trim().min(2).max(80) });

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({ q: searchParams.get("q") ?? "" });
  if (!parsed.success) {
    return NextResponse.json({ resultaten: [] });
  }
  const q = parsed.data.q;

  // Drie zoekvormen: postcode-prefix, "straat huisnummer", straat-prefix.
  const alsPostcode = normalizePostcode(q) ?? (/^[1-9][0-9]{3}/.test(q.replace(/\s/g, "")) ? q.replace(/\s/g, "").toUpperCase() : null);
  const straatNummer = q.match(/^(.+?)\s+(\d+[a-z0-9-]*)$/i);

  let rows;
  if (alsPostcode) {
    rows = await db
      .select()
      .from(addresses)
      .where(and(ilike(addresses.postcode, `${alsPostcode}%`), eq(addresses.status, "actief")))
      .limit(24);
  } else if (straatNummer) {
    rows = await db
      .select()
      .from(addresses)
      .where(and(ilike(addresses.straat, `${straatNummer[1]}%`), ilike(addresses.nummerslug, `${straatNummer[2].toLowerCase()}%`), eq(addresses.status, "actief")))
      .limit(24);
  } else {
    rows = await db
      .select()
      .from(addresses)
      .where(and(or(ilike(addresses.straat, `${q}%`), ilike(addresses.plaats, `${q}%`)), eq(addresses.status, "actief")))
      .limit(24);
  }

  const gesupprimeerd = await Promise.all(rows.map((a) => isSuppressed(a.postcode, a.nummerslug)));
  const resultaten = rows
    .filter((_, i) => !gesupprimeerd[i])
    .slice(0, 8)
    .map((a) => ({
      label: `${a.straat} ${a.huisnummer}${a.toevoeging ? ` ${a.toevoeging}` : ""}, ${a.postcode} ${a.plaats}`,
      url: `/woning/${a.postcode}/${a.nummerslug}`,
    }));

  return NextResponse.json({ resultaten });
}
