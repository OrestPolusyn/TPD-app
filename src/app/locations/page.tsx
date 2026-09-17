import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getPublishedLocationsGroupedByProvince } from "@/lib/data/locations";

export const dynamic = "force-dynamic";

export default async function LocationsPage() {
  const t = await getTranslations("locations");
  const supabase = await createClient();
  const grouped = await getPublishedLocationsGroupedByProvince(supabase);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-4">
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      {[...grouped.entries()].map(([province, locations]) => (
        <section key={province}>
          <h2 className="mb-2 font-medium">{t("provinceGroupTitle", { province })}</h2>
          <ul className="flex flex-col gap-2">
            {locations.map((loc) => (
              <li key={loc.id}>
                <Link href={`/locations/${loc.id}`} className="underline">
                  {loc.name}
                </Link>
                <span className="text-sm text-[var(--muted)]"> — {loc.city}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
