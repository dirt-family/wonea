"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Tellend cijfer voor de statistieken-band. Geinspireerd op React Bits
 * "CountUp" (reactbits.dev), maar zonder animatiebibliotheek herbouwd:
 * IntersectionObserver + requestAnimationFrame met onze ease-out-curve.
 * Server-side en zonder JavaScript staat de eindwaarde er gewoon;
 * prefers-reduced-motion slaat de animatie volledig over (BRAND.md).
 */
export function Telcijfer({ waarde, duurMs = 900 }: { waarde: number; duurMs?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [getal, setGetal] = useState(waarde);

  useEffect(() => {
    const el = ref.current;
    if (!el || waarde <= 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer.disconnect();
        const start = performance.now();
        const stap = (nu: number) => {
          const t = Math.min((nu - start) / duurMs, 1);
          const eased = 1 - Math.pow(1 - t, 3); // zelfde karakter als --ease-uit
          setGetal(Math.round(waarde * eased));
          if (t < 1) raf = requestAnimationFrame(stap);
        };
        setGetal(0);
        raf = requestAnimationFrame(stap);
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [waarde, duurMs]);

  return (
    <span ref={ref} className="tabular-nums">
      {getal.toLocaleString("nl-NL")}
    </span>
  );
}
