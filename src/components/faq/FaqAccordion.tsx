"use client";

import { useState } from "react";
import { Card } from "@/components/shared/Card";
import { matchesQuery } from "@/lib/searchText";

export interface FaqItem {
  q: string;
  a: string;
}

export interface FaqAccordionLabels {
  searchLabel: string;
  searchPlaceholder: string;
  noMatches: string;
}

/**
 * Collapsed-by-default Q&A list with a client-side filter.
 *
 * Native <details> for the disclosure (same pattern as NavBar's mobile menu and
 * CommunityBlock's flagged reports), so the only client JS here is the filter
 * itself. The layout mounts no NextIntlClientProvider, so every string arrives
 * pre-translated as a prop.
 */
export function FaqAccordion({ items, labels }: { items: FaqItem[]; labels: FaqAccordionLabels }) {
  const [query, setQuery] = useState("");
  const filtering = query.trim().length > 0;
  const visible = filtering ? items.filter((item) => matchesQuery(query, item.q, item.a)) : items;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label htmlFor="faq-search" className="mb-1 block text-sm font-medium">
          {labels.searchLabel}
        </label>
        <input
          id="faq-search"
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
        <div className="flex flex-col gap-3">
          {visible.map((item) => (
            // Keyed on `filtering` so searching opens the matches (the answer is
            // the point of a search) and clearing collapses everything again;
            // manual toggles within one filtering state are left alone.
            <details
              key={`${item.q}|${filtering}`}
              open={filtering}
              className="group rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 font-medium [&::-webkit-details-marker]:hidden">
                <span>{item.q}</span>
                <span aria-hidden="true" className="shrink-0 text-[var(--muted)] transition-transform group-open:rotate-180">
                  ▾
                </span>
              </summary>
              <p className="border-t border-[var(--border)] p-4 text-sm text-[var(--muted)]">{item.a}</p>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
