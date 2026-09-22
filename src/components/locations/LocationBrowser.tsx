"use client";

import Link from "next/link";
import { useState } from "react";
import { Card } from "@/components/shared/Card";
import type { ProvinceGroup } from "@/lib/data/locations";
import { matchesQuery } from "@/lib/searchText";

export interface BrowserProvince extends ProvinceGroup {
  /** Pre-formatted on the server: ICU plurals need next-intl, which has no client provider here. */
  officeCountLabel: string;
}

export interface LocationBrowserLabels {
  searchLabel: string;
  searchPlaceholder: string;
  noMatches: string;
  addressUnknown: string;
  typeCreade: string;
  typePoliceStation: string;
}

/**
 * Every province and every office on one screen.
 *
 * Replaces a two-step searchParams wizard (province -> "Далі" -> office select
 * -> "Перейти") whose second step was just another dropdown, so choosing a
 * province appeared to lead to an empty page. Provinces are collapsed by
 * default and the filter searches province, region, office name, city and
 * address at once, which is what a two-step picker was standing in for.
 */
export function LocationBrowser({
  provinces,
  initialProvinceSlug,
  labels,
}: {
  provinces: BrowserProvince[];
  initialProvinceSlug?: string;
  labels: LocationBrowserLabels;
}) {
  const [query, setQuery] = useState("");
  const filtering = query.trim().length > 0;

  const visible = provinces
    .map((p) => {
      if (!filtering) return p;
      // A hit on the province or region keeps all of its offices; otherwise
      // narrow to the offices that match, so a search for a city shows that
      // city rather than its whole province.
      if (matchesQuery(query, p.province, p.region)) return p;
      const offices = p.offices.filter((o) => matchesQuery(query, o.name, o.city, o.address));
      return offices.length > 0 ? { ...p, offices } : null;
    })
    .filter((p): p is BrowserProvince => p !== null);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label htmlFor="location-search" className="mb-1 block text-sm font-medium">
          {labels.searchLabel}
        </label>
        <input
          id="location-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={labels.searchPlaceholder}
          className="w-full rounded-md border border-[var(--border-strong)] bg-[var(--surface)] p-2"
        />
      </div>

      {visible.length === 0 ? (
        <Card className="text-sm text-[var(--muted)]">{labels.noMatches}</Card>
      ) : (
        <div className="flex flex-col gap-2">
          {visible.map((p) => (
            // Keyed on the open-by-default decision so filtering reveals the
            // matches and clearing the filter collapses the list again.
            <details
              key={`${p.provinceSlug}|${filtering}`}
              open={filtering || p.provinceSlug === initialProvinceSlug}
              className="group rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3 [&::-webkit-details-marker]:hidden">
                <span className="flex flex-col">
                  <span className="font-medium">{p.province}</span>
                  <span className="text-xs text-[var(--muted)]">
                    {p.region} · {p.officeCountLabel}
                  </span>
                </span>
                <span aria-hidden="true" className="shrink-0 text-[var(--muted)] transition-transform group-open:rotate-180">
                  ▾
                </span>
              </summary>
              <ul className="flex flex-col border-t border-[var(--border)]">
                {p.offices.map((office) => (
                  <li key={office.id} className="border-b border-[var(--border)] last:border-b-0">
                    <Link
                      href={`/locations/${office.id}`}
                      className="flex flex-col gap-0.5 px-3 py-2.5 text-sm no-underline hover:bg-[var(--background)]"
                    >
                      <span className="font-medium">
                        {office.name}
                        <span className="ml-2 rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] font-normal uppercase tracking-wide text-[var(--muted)]">
                          {office.type === "creade" ? labels.typeCreade : labels.typePoliceStation}
                        </span>
                      </span>
                      <span className="text-xs text-[var(--muted)]">
                        {office.city}
                        {office.address ? ` · ${office.address}` : ` · ${labels.addressUnknown}`}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
