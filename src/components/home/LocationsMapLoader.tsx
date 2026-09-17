"use client";

import dynamic from "next/dynamic";

// `ssr: false` is only allowed inside a Client Component boundary — this
// tiny wrapper is that boundary, so the Server Component home page can just
// import and render `LocationsMapLoader` like any other component.
export const LocationsMapLoader = dynamic(() => import("./LocationsMap").then((m) => m.LocationsMap), {
  ssr: false,
  loading: () => <div className="h-full min-h-[320px] w-full animate-pulse rounded-xl bg-[var(--surface)]" />,
});
