import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { DetailsAutoClose } from "@/components/shared/DetailsAutoClose";

const linkClassName = "text-[var(--muted)] no-underline transition-colors hover:text-[var(--foreground)]";
const ctaClassName =
  "rounded-full border border-[var(--accent)] px-3 py-1.5 text-center font-medium text-[var(--accent)] no-underline transition-colors hover:bg-[var(--accent)] hover:text-[var(--accent-contrast)]";

export async function NavBar() {
  const t = await getTranslations("nav");
  const links = [
    { href: "/locations", label: t("locations") },
    { href: "/faq", label: t("faq") },
    { href: "/me", label: t("me") },
  ];

  return (
    // z-[1100] clears Leaflet's own ladder (panes 200-700, controls 800,
    // .leaflet-top/.leaflet-bottom 1000). The map wrapper on "/" also isolates
    // that ladder, but the header should not depend on every future map-like
    // widget remembering to do so — it used to render *under* the map tiles.
    <header className="sticky top-0 z-[1100] border-b border-[var(--border)] bg-[var(--background)]/95 px-4 py-3 backdrop-blur sm:px-6">
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between">
        <Link href="/" className="text-base font-semibold tracking-tight no-underline">
          TP Spain
        </Link>

        {/* Desktop / tablet: horizontal link row, no client JS. */}
        <nav aria-label={t("home")} className="hidden items-center gap-x-5 gap-y-2 text-sm sm:flex">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className={linkClassName}>
              {link.label}
            </Link>
          ))}
          <Link href="/locations/new" className={ctaClassName}>
            {t("suggestCta")}
          </Link>
        </nav>

        {/* Mobile: native <details> disclosure — zero added client JS. */}
        <details id="nav-menu" className="relative sm:hidden">
          <summary
            aria-label={t("home")}
            className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-md border border-[var(--border)] text-lg [&::-webkit-details-marker]:hidden"
          >
            ☰
          </summary>
          <nav
            aria-label={t("home")}
            className="absolute right-0 z-20 mt-2 flex w-56 flex-col gap-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-3 text-sm shadow-[var(--shadow-lg)]"
          >
            {links.map((link) => (
              <Link key={link.href} href={link.href} className={`${linkClassName} rounded-md px-2 py-1.5`}>
                {link.label}
              </Link>
            ))}
            <Link href="/locations/new" className={`${ctaClassName} mt-1`}>
              {t("suggestCta")}
            </Link>
          </nav>
        </details>
        <DetailsAutoClose id="nav-menu" />
      </div>
    </header>
  );
}
