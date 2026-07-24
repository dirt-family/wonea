"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icoon } from "@/components/iconen";

type Suggestie = { label: string; url: string };

export function Zoekbalk({ placeholder = "Zoek op straat, huisnummer of postcode" }: { placeholder?: string }) {
  const [q, setQ] = useState("");
  const [suggesties, setSuggesties] = useState<Suggestie[]>([]);
  const [open, setOpen] = useState(false);
  const [actief, setActief] = useState(-1);
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) {
      setSuggesties([]);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
        const data = (await res.json()) as { resultaten: Suggestie[] };
        setSuggesties(data.resultaten);
        setOpen(data.resultaten.length > 0);
        setActief(-1);
      } catch {
        setSuggesties([]);
      }
    }, 250);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q]);

  useEffect(() => {
    function onKlikBuiten(e: MouseEvent) {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onKlikBuiten);
    return () => document.removeEventListener("mousedown", onKlikBuiten);
  }, []);

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || suggesties.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActief((a) => Math.min(a + 1, suggesties.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActief((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const doel = suggesties[actief >= 0 ? actief : 0];
      if (doel) router.push(doel.url);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={wrap} className="relative w-full max-w-xl">
      {/* Zwevende zoekbalk (huisstijl v3): gelaagde schaduw, zoekicoon in
          merk-navy, focus-ring in de merkkleur. Input-radius blijft 8px. */}
      <span aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-merk">
        <Icoon naam="zoek" maat="m" />
      </span>
      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => suggesties.length > 0 && setOpen(true)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-lijn bg-paneel py-4 pl-12 pr-4 text-base text-inkt shadow-zweef-md transition-shadow placeholder:text-gedempt focus:border-merk focus:shadow-zweef-lg focus:outline-none focus:ring-4 focus:ring-merk-200/60"
        role="combobox"
        aria-expanded={open}
        aria-controls="zoek-suggesties"
        aria-autocomplete="list"
        aria-label="Zoek je adres"
      />
      {open ? (
        <ul
          id="zoek-suggesties"
          role="listbox"
          className="absolute z-20 mt-2 w-full overflow-hidden rounded-[14px] border border-lijn bg-paneel shadow-zweef-lg"
        >
          {suggesties.map((s, i) => (
            <li key={s.url} role="option" aria-selected={i === actief}>
              <button
                type="button"
                onMouseEnter={() => setActief(i)}
                onClick={() => router.push(s.url)}
                className={`block w-full px-4 py-3 text-left text-sm transition-colors ${i === actief ? "bg-merk-wash text-merk" : "text-inkt"}`}
              >
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
