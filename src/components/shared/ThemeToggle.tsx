"use client";

import { useEffect, useRef, useState } from "react";

export const THEME_STORAGE_KEY = "theme";

type Theme = "light" | "dark";

/**
 * Light/dark choice, remembered per browser.
 *
 * The app is light by default — it used to follow the operating system, which
 * meant a phone in dark mode got a dark app whether or not that was wanted,
 * with nothing on the page to say otherwise. This is that "otherwise".
 *
 * The stored choice is applied by an inline script in the layout, before the
 * first paint; this component only draws the control and keeps it in sync.
 */
export function ThemeToggle({ labels }: { labels: { label: string; light: string; dark: string } }) {
  const [theme, setTheme] = useState<Theme>("light");
  /** Nothing is written until someone actually picks: an untouched toggle must
   * not persist "light" as if it had been chosen. */
  const picked = useRef(false);

  useEffect(() => {
    // On a timer, not inline: the server rendered "light", and correcting that
    // during the effect body would cascade a render on every mount.
    const timer = setTimeout(() => {
      setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!picked.current) return;
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Private mode or blocked storage: the choice still applies to this page.
    }
  }, [theme]);

  function choose(next: Theme) {
    picked.current = true;
    setTheme(next);
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-[var(--muted)]">{labels.label}</span>
      <div
        role="group"
        aria-label={labels.label}
        className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface)] p-0.5"
      >
        {(["light", "dark"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => choose(option)}
            aria-pressed={theme === option}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
              theme === option
                ? "bg-[var(--accent)] text-[var(--accent-contrast)]"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {option === "light" ? labels.light : labels.dark}
          </button>
        ))}
      </div>
    </div>
  );
}
