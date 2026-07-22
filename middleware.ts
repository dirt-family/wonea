import { NextResponse, type NextRequest } from "next/server";

/**
 * Basic-auth op /admin (lokaal niveau; echte admin-auth is een livegang-TODO).
 * Gebruiker: admin, wachtwoord: env WONEA_ADMIN_PASSWORD.
 */
export function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/admin")) return NextResponse.next();

  const verwacht = process.env.WONEA_ADMIN_PASSWORD ?? "";
  const header = request.headers.get("authorization") ?? "";
  if (verwacht && header.startsWith("Basic ")) {
    try {
      const [user, pass] = atob(header.slice(6)).split(":");
      if (user === "admin" && pass === verwacht) return NextResponse.next();
    } catch {
      // ongeldig base64: val door naar 401
    }
  }
  return new NextResponse("Inloggen vereist", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Wonea admin"' },
  });
}

export const config = { matcher: ["/admin/:path*"] };
