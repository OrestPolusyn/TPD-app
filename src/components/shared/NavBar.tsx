import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { DetailsAutoClose } from "@/components/shared/DetailsAutoClose";
import { NewReportsBell } from "@/components/shared/NewReportsBell";

const linkClassName = "whitespace-nowrap text-[var(--muted)] no-underline transition-colors hover:text-[var(--foreground)]";
const ctaClassName =
  "whitespace-nowrap rounded-full border border-[var(--accent)] px-3.5 py-1.5 text-center font-medium text-[var(--accent)] no-underline transition-colors hover:bg-[var(--accent)] hover:text-[var(--accent-contrast)]";

/** The channel's logo (branding/logo-a-pin.svg): a pin with a check — "a place the community has checked". */
function LogoMark() {
  return (
    <svg viewBox="0 0 640 640" width="30" height="30" aria-hidden="true" className="shrink-0 rounded-full">
      <rect width="640" height="640" fill="#1462cf" />
      <path fill="#FFD400" d="M320 512 C 262 432 172 360 172 262 A148 148 0 1 1 468 262 C 468 360 378 432 320 512 Z" />
      <path d="M250 262 L 300 312 L 392 216" fill="none" stroke="#0B4DB8" strokeWidth="40" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export async function NavBar() {
  const t = await getTranslations("nav");
  const links = [
    { href: "/locations", label: t("locations") },
    { href: "/changes", label: t("changes") },
    { href: "/guide/dovidka", label: t("guide") },
    { href: "/faq", label: t("faq") },
    { href: "/me", label: t("me") },
  ];

  return (
    // z-[1100] clears Leaflet's own ladder (panes 200-700, controls 800,
    // .leaflet-top/.leaflet-bottom 1000). The map wrapper on "/" also isolates
    // that ladder, but the header should not depend on every future map-like
    // widget remembering to do so — it used to render *under* the map tiles.
    <header className="sticky top-0 z-[1100] border-b border-[var(--border)] bg-[var(--background)]/95 px-4 py-3 backdrop-blur sm:px-6">
      {/* As wide as the widest page (the home page's map + search), so the
          link row has room; it used to sit in a 672px column where five links
          and the button wrapped into each other. */}
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4">
        <Link href="/" className="flex shrink-0 items-center gap-2 no-underline">
          <LogoMark />
          <span className="whitespace-nowrap text-lg font-bold tracking-tight">TP Spain</span>
        </Link>

        <div className="flex items-center gap-1 sm:gap-3">
          <NewReportsBell label={t("newReports")} />

          {/* Wide screens: one-line link row, no client JS. Below lg the same
              links live in the menu — five links and a button do not fit a
              tablet width without wrapping. */}
          <nav aria-label={t("home")} className="hidden items-center gap-x-5 text-[15px] lg:flex">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className={linkClassName}>
                {link.label}
              </Link>
            ))}
            <Link href="/locations/new" className={ctaClassName}>
              {t("suggestCta")}
            </Link>
          </nav>

          {/* Phone and tablet: native <details> disclosure — zero added client JS. */}
          <details id="nav-menu" className="relative lg:hidden">
            <summary
              aria-label={t("home")}
              className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-md border border-[var(--border)] text-lg [&::-webkit-details-marker]:hidden"
            >
              ☰
            </summary>
            <nav
              aria-label={t("home")}
              className="absolute right-0 z-20 mt-2 flex w-60 flex-col gap-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-3 text-sm shadow-[var(--shadow-lg)]"
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
      </div>
    </header>
  );
}
