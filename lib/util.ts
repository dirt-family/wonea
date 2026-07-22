import { createHash, randomBytes } from "node:crypto";

// Pure helpers staan in lib/format.ts (client-veilig) en worden hier
// her-geexporteerd voor server-code. Client components importeren @/lib/format.
export * from "@/lib/format";

export function sha256Hex(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export function randomToken(bytes = 24): string {
  return randomBytes(bytes).toString("base64url");
}

export function baseUrl(): string {
  return process.env.WONEA_BASE_URL ?? "http://localhost:4123";
}
