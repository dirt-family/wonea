import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  async headers() {
    return [
      {
        // Embed-script: wordt door externe sites bij elke paginaweergave
        // opgehaald; zonder header serveert Next public/-bestanden met
        // max-age=0. 24u browser-cache + 7 dagen stale-while-revalidate houdt
        // het licht en laat een nieuwe versie binnen een dag doorstromen.
        // Wijzig je widget.js breaking, versioneer dan de bestandsnaam
        // (zie docs/PERFORMANCE.md).
        source: "/widget.js",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
      },
    ];
  },
};

export default nextConfig;
