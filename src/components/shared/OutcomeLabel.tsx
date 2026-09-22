import { useTranslations } from "next-intl";
import type { ReportOutcome } from "@/lib/matching/types";

const ICON: Record<ReportOutcome, string> = {
  protection_granted: "✓",
  application_accepted_pending: "…",
  turned_away: "✕",
  could_not_get_appointment: "✕",
};

/** var(--success|warning|danger) triads — icon + color + text, never color
 * alone (WCAG 2.2 AA requirement in docs/SPEC.md). */
const TONE: Record<ReportOutcome, string> = {
  protection_granted: "text-[var(--success)] bg-[var(--success-bg)] border-[var(--success-border)]",
  application_accepted_pending: "text-[var(--warning)] bg-[var(--warning-bg)] border-[var(--warning-border)]",
  turned_away: "text-[var(--danger)] bg-[var(--danger-bg)] border-[var(--danger-border)]",
  could_not_get_appointment: "text-[var(--danger)] bg-[var(--danger-bg)] border-[var(--danger-border)]",
};

export function OutcomeLabel({ outcome }: { outcome: ReportOutcome }) {
  const t = useTranslations("outcomes");
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-sm font-medium ${TONE[outcome]}`}
    >
      <span aria-hidden="true">{ICON[outcome]}</span>
      <span>{t(outcome)}</span>
    </span>
  );
}
