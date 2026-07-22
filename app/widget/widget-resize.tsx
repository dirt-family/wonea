"use client";

import { useEffect } from "react";

/**
 * Meldt de eigen documenthoogte aan de hostpagina zodat public/widget.js het
 * iframe kan meegroeien. targetOrigin is "*" omdat de embed-site vooraf
 * onbekend is; de boodschap bevat alleen een hoogte, niets gevoeligs.
 * widget.js controleert aan de ontvangende kant wel streng op herkomst.
 */
export function WidgetResize() {
  useEffect(() => {
    if (window.parent === window) return; // niet in een iframe: niets doen

    let laatste = 0;
    const meld = () => {
      const hoogte = Math.ceil(document.documentElement.scrollHeight);
      if (hoogte === laatste) return;
      laatste = hoogte;
      window.parent.postMessage({ type: "wonea:resize", height: hoogte }, "*");
    };

    meld();
    const observer = new ResizeObserver(meld);
    observer.observe(document.documentElement);
    observer.observe(document.body);
    return () => observer.disconnect();
  }, []);

  return null;
}
