import { getTranslations } from "next-intl/server";
import Link from "next/link";

export default async function NotFound() {
  const t = await getTranslations("errors");
  const tCommon = await getTranslations("common");

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-start gap-3 p-4">
      <p className="text-sm">{t("notFound")}</p>
      <Link href="/" className="underline text-sm">
        {tCommon("back")}
      </Link>
    </main>
  );
}
