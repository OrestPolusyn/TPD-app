"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Counts a page view per route change (see /api/visit). sendBeacon rather
 * than fetch: it survives the page being closed and never delays navigation.
 * Crawlers mostly do not run JavaScript, which keeps them out for free.
 */
export function VisitBeacon() {
  const pathname = usePathname();

  useEffect(() => {
    try {
      navigator.sendBeacon?.("/api/visit", JSON.stringify({ path: pathname }));
    } catch {
      // Counting is never worth an error.
    }
  }, [pathname]);

  return null;
}
