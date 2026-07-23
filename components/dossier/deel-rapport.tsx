"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Deel-je-rapport: praat met /api/rapport (contract: POST {claimId} geeft
 * {token}; DELETE met {token} trekt in). Alleen dit blok is een client
 * component; de lijst met bestaande links komt server-side binnen.
 */

async function foutUit(res: Response, standaard: string): Promise<string> {
  try {
    const data = (await res.json()) as { fout?: string };
    return data.fout ?? standaard;
  } catch {
    return standaard;
  }
}
export function DeelRapport({ claimId, links }: { claimId: number; links: { token: string; createdAt: string }[] }) {
  const router = useRouter();
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [gekopieerd, setGekopieerd] = useState<string | null>(null);

  async function maakLink() {
    setBezig(true);
    setFout(null);
    try {
      const res = await fetch("/api/rapport", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claimId }),
      });
      if (!res.ok) {
        setFout(await foutUit(res, "Link maken lukte niet. Probeer het later opnieuw."));
        return;
      }
      router.refresh();
    } catch {
      setFout("Link maken lukte niet. Probeer het later opnieuw.");
    } finally {
      setBezig(false);
    }
  }

  async function trekIn(token: string) {
    setBezig(true);
    setFout(null);
    try {
      const res = await fetch("/api/rapport", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        setFout(await foutUit(res, "Intrekken lukte niet. Probeer het later opnieuw."));
        return;
      }
      router.refresh();
    } catch {
      setFout("Intrekken lukte niet. Probeer het later opnieuw.");
    } finally {
      setBezig(false);
    }
  }

  async function kopieer(token: string) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/rapport/${token}`);
      setGekopieerd(token);
      setTimeout(() => setGekopieerd(null), 2000);
    } catch {
      setFout("Kopiëren lukte niet. Kopieer de link handmatig.");
    }
  }

  return (
    <div>
      {links.length > 0 ? (
        <ul className="mb-4 space-y-2">
          {links.map((l) => (
            <li key={l.token} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <a href={`/rapport/${l.token}`} className="font-medium text-merk underline underline-offset-4 break-all">
                /rapport/{l.token}
              </a>
              <button
                type="button"
                onClick={() => kopieer(l.token)}
                className="text-xs font-semibold text-inkt-zacht underline underline-offset-2 hover:text-merk"
              >
                {gekopieerd === l.token ? "gekopieerd" : "kopieer"}
              </button>
              <button
                type="button"
                onClick={() => trekIn(l.token)}
                disabled={bezig}
                className="text-xs font-semibold text-negatief underline underline-offset-2 disabled:opacity-50"
              >
                trek in
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-4 text-sm text-gedempt">Nog geen deelbare links.</p>
      )}
      <button
        type="button"
        onClick={maakLink}
        disabled={bezig}
        className="inline-flex items-center justify-center rounded-full border border-lijn bg-paneel px-5 py-2 text-sm font-semibold text-merk transition-colors hover:border-merk disabled:opacity-50"
      >
        {bezig ? "Bezig..." : "Maak deelbare link"}
      </button>
      {fout ? <p className="mt-2 text-xs text-negatief">{fout}</p> : null}
    </div>
  );
}
