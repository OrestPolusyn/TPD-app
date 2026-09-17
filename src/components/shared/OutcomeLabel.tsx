import { useTranslations } from "next-intl";
import type { ReportOutcome } from "@/lib/matching/types";

const ICON: Record<ReportOutcome, string> = {
  protection_granted: "✓",
  application_accepted_pending: "…",
  turned_away: "✕",
  could_not_get_appointment: "✕",
};

/** Icon + text (never color alone) — WCAG 2.2 AA requirement in docs/SPEC.md. */
export function OutcomeLabel({ outcome }: { outcome: ReportOutcome }) {
  const t = useTranslations("outcomes");
  return (
    <span className="inline-flex items-center gap-1 text-sm font-medium">
      <span aria-hidden="true">{ICON[outcome]}</span>
      <span>{t(outcome)}</span>
    </span>
  );
}
