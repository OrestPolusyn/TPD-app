import { getTranslations } from "next-intl/server";
import type { SuggestionField } from "@/lib/validation/suggestionSchema";

/** Human names for suggestion fields — shared by the form, /me and the moderator notice. */
export async function getSuggestionFieldLabels(): Promise<Record<SuggestionField, string>> {
  const t = await getTranslations("suggestForm");
  return {
    address: t("fieldAddress"),
    postal_code: t("fieldPostalCode"),
    phone: t("fieldPhone"),
    email: t("fieldEmail"),
    appointment_method: t("fieldAppointmentMethod"),
    appointment_url: t("fieldAppointmentUrl"),
    other: t("fieldOther"),
  };
}
