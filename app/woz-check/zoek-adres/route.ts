import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, rateLimited } from "@/lib/ratelimit";
import { zoekWozAdres } from "../zoek";

/**
 * GET /woz-check/zoek-adres?postcode=1234AB&nummer=12
 * Zoekstap van de WOZ-check-stepper. Geeft alleen openbare adres- en
 * schattingsdata terug; de WOZ-invoer van de bezoeker komt hier nooit langs.
 * Suppressie en statuscontrole zitten in zoekWozAdres.
 */

const invoerSchema = z.object({
  postcode: z.string().trim().min(1).max(12),
  nummer: z.string().trim().min(1).max(12),
});

export async function GET(request: Request) {
  const ip = clientIp(request.headers);
  if (rateLimited(`woz-zoek:${ip}`, 20)) {
    return NextResponse.json({ gevonden: false, fout: "te-vaak" }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = invoerSchema.safeParse({
    postcode: searchParams.get("postcode") ?? "",
    nummer: searchParams.get("nummer") ?? "",
  });
  if (!parsed.success) return NextResponse.json({ gevonden: false });

  const resultaat = await zoekWozAdres(parsed.data.postcode, parsed.data.nummer);
  return NextResponse.json(resultaat ? { gevonden: true, resultaat } : { gevonden: false });
}
