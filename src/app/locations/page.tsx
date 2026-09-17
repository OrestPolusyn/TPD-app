import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProvinces, getPublishedLocationsGroupedByProvince } from "@/lib/data/locations";

export const dynamic = "force-dynamic";

interface LocationsPageProps {
  searchParams: Promise<{ province?: string; office?: string }>;
}

export default async function LocationsPage({ searchParams }: LocationsPageProps) {
  const params = await searchParams;
  const t = await getTranslations("locations");
  const supabase = await createClient();

  if (params.office) {
    redirect(`/locations/${params.office}`);
  }

  const provinceSlug = params.province ?? "";

  if (!provinceSlug) {
    const provinces = await getProvinces(supabase);
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-4 sm:p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">{t("intro")}</p>
        </div>

        <form method="get" action="/locations" className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="province" className="mb-1 block text-sm font-medium">
              {t("provinceLabel")}
            </label>
            <select
              id="province"
              name="province"
              required
              defaultValue=""
              className="w-full rounded-md border border-[var(--border)] bg-transparent p-2"
            >
              <option value="" disabled>
                {t("provincePlaceholder")}
              </option>
              {provinces.map((p) => (
                <option key={p.province_slug} value={p.province_slug}>
                  {p.province}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="rounded-md bg-[var(--accent)] px-4 py-2 font-medium text-[var(--accent-contrast)]"
          >
            {t("provinceGoButton")}
          </button>
        </form>
      </main>
    );
  }

  const [provinces, grouped] = await Promise.all([
    getProvinces(supabase),
    getPublishedLocationsGroupedByProvince(supabase),
  ]);
  const province = provinces.find((p) => p.province_slug === provinceSlug);
  const offices = grouped.get(province?.province ?? "") ?? [];

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{province?.province ?? provinceSlug}</h1>
        <Link href="/locations" className="mt-1 inline-block text-sm underline">
          {t("changeProvinceLink")}
        </Link>
      </div>

      <form method="get" action="/locations" className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <input type="hidden" name="province" value={provinceSlug} />
        <div className="flex-1">
          <label htmlFor="office" className="mb-1 block text-sm font-medium">
            {t("officeLabel")}
          </label>
          <select
            id="office"
            name="office"
            required
            defaultValue=""
            className="w-full rounded-md border border-[var(--border)] bg-transparent p-2"
          >
            <option value="" disabled>
              {t("officePlaceholder")}
            </option>
            {offices.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} — {o.city}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-md bg-[var(--accent)] px-4 py-2 font-medium text-[var(--accent-contrast)]"
        >
          {t("officeGoButton")}
        </button>
      </form>
    </main>
  );
}
