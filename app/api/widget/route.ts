import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { addresses, consents, widgetCaptures } from "@/db/schema";
import { isSuppressed } from "@/lib/suppression";
import { clientIp, rateLimited } from "@/lib/ratelimit";
import { normalizePostcode, nowIso, randomToken } from "@/lib/util";
import { stuurWidgetDoubleOptin } from "@/emails/widget";
import { WIDGET_CONSENT_TEKST } from "@/app/widget/consent";

/**
 * E-mailcapture van de embed-widget (double opt-in).
 * - Logt de toestemming als consents-rij met de LETTERLIJKE checkbox-tekst
 *   (tekstversie) en bron "widget:{domein}".
 * - Slaat een widget_captures-rij op met bevestigToken; bevestigdAt blijft
 *   null tot de klik op de mail. Onbevestigd wordt na 30 dagen gepurged.
 * - Formulier-posts (uit het iframe) krijgen een 303 terug naar /widget;
 *   JSON-clients krijgen JSON.
 */

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  postcode: z.string().trim().min(6).max(8),
  nummer: z.string().trim().min(1).max(12),
});

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** Houdt van het opgegeven bron-domein alleen hostname-tekens over. */
function schoonDomein(v: unknown): string {
  const s = str(v).toLowerCase().replace(/[^a-z0-9.-]/g, "").slice(0, 253);
  return s || "onbekend";
}

type Echo = { postcode: string; nummer: string; bron: string };

function antwoord(isJson: boolean, request: Request, echo: Echo, uitkomst: { ok: true } | { fout: string }) {
  if (isJson) {
    if ("fout" in uitkomst) {
      return NextResponse.json({ ok: false, fout: uitkomst.fout }, { status: uitkomst.fout === "te-vaak" ? 429 : 400 });
    }
    return NextResponse.json({ ok: true });
  }
  const url = new URL("/widget", request.url);
  if (echo.postcode) url.searchParams.set("postcode", echo.postcode);
  if (echo.nummer) url.searchParams.set("nummer", echo.nummer);
  if (echo.bron && echo.bron !== "onbekend") url.searchParams.set("bron", echo.bron);
  if ("fout" in uitkomst) url.searchParams.set("fout", uitkomst.fout);
  else url.searchParams.set("verzonden", "1");
  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");

  let raw: Record<string, unknown> = {};
  try {
    if (isJson) {
      raw = (await request.json()) as Record<string, unknown>;
    } else {
      const fd = await request.formData();
      raw = Object.fromEntries(fd.entries());
    }
  } catch {
    return antwoord(isJson, request, { postcode: "", nummer: "", bron: "onbekend" }, { fout: "ongeldig" });
  }

  const echo: Echo = { postcode: str(raw.postcode).slice(0, 8), nummer: str(raw.nummer).slice(0, 12), bron: schoonDomein(raw.bron) };

  const ip = clientIp(request.headers);
  if (rateLimited(`widget:${ip}`)) return antwoord(isJson, request, echo, { fout: "te-vaak" });

  // Honeypot: mensen zien dit veld niet en laten het leeg. Gevuld = bot;
  // stil "succes" terug zodat de bot niets leert, niets opslaan.
  if (str(raw.bedrijfsnaam) !== "") return antwoord(isJson, request, echo, { ok: true });

  // Consent is een aparte, expliciete check: geen aangevinkte checkbox,
  // geen opslag. De checkbox staat nooit vooraf aangevinkt.
  if (str(raw.consent) !== "1") return antwoord(isJson, request, echo, { fout: "consent" });

  const parsed = bodySchema.safeParse({ email: raw.email ?? "", postcode: raw.postcode ?? "", nummer: raw.nummer ?? "" });
  if (!parsed.success) return antwoord(isJson, request, echo, { fout: "ongeldig" });

  const postcode = normalizePostcode(parsed.data.postcode);
  if (!postcode) return antwoord(isJson, request, echo, { fout: "ongeldig" });
  const nummerslug = parsed.data.nummer.toLowerCase().replace(/\s+/g, "");

  // Adres koppelen mag alleen als het echt toonbaar is; bij suppressie of
  // opt-out slaan we de capture zonder adres-koppeling op.
  const adres = (await db
    .select()
    .from(addresses)
    .where(and(eq(addresses.postcode, postcode), eq(addresses.nummerslug, nummerslug)))
    .limit(1))[0];
  const bruikbaar = adres && adres.status === "actief" && !(await isSuppressed(postcode, nummerslug)) ? adres : null;

  const now = nowIso();
  const consent = (await db
    .insert(consents)
    .values({
      email: parsed.data.email,
      doel: "widget",
      tekstversie: WIDGET_CONSENT_TEKST,
      bron: `widget:${echo.bron}`,
      consentedAt: now,
    })
    .returning({ id: consents.id }))[0];

  const token = randomToken(24);
  await db.insert(widgetCaptures)
    .values({
      email: parsed.data.email,
      adresId: bruikbaar?.id ?? null,
      bronDomein: echo.bron,
      consentId: consent.id,
      bevestigToken: token,
      createdAt: now,
    });

  const adresNaam = bruikbaar ? `${bruikbaar.straat} ${bruikbaar.huisnummer}${bruikbaar.toevoeging ? ` ${bruikbaar.toevoeging}` : ""}, ${bruikbaar.plaats}` : null;
  await stuurWidgetDoubleOptin(parsed.data.email, adresNaam, token, echo.bron);

  return antwoord(isJson, request, echo, { ok: true });
}
