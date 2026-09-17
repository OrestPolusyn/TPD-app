import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { config } from "@/lib/config";
import { TelegramLoginWidget } from "@/components/auth/TelegramLoginWidget";

export const dynamic = "force-dynamic";

export default async function MePage() {
  const t = await getTranslations("auth");
  const tMe = await getTranslations("me");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const botUsername = config.telegramBotUsername();
    const devLoginEnabled = config.devLoginEnabled();

    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 p-4">
        <h1 className="text-xl font-semibold">{t("loginTitle")}</h1>
        <p className="text-sm text-[var(--muted)]">{t("loginHint")}</p>
        {botUsername ? (
          <TelegramLoginWidget botUsername={botUsername} labels={{ failed: t("loginFailed") }} />
        ) : null}
        {devLoginEnabled ? (
          <div className="flex flex-col gap-2 border-t border-[var(--border)] pt-4 text-sm">
            <a href="/api/auth/dev?user=1" className="underline">
              {t("devLoginUser1")}
            </a>
            <a href="/api/auth/dev?user=2" className="underline">
              {t("devLoginUser2")}
            </a>
          </div>
        ) : null}
      </main>
    );
  }

  // Full reports/comments/suggestions lists + delete-account flow: Milestone 5.
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold">{tMe("title")}</h1>
      <p className="text-sm text-[var(--muted)]">{tMe("noItems")}</p>
    </main>
  );
}
