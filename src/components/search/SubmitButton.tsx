"use client";

import { useFormStatus } from "react-dom";
import { Spinner } from "@/components/shared/Spinner";

/**
 * Submit button that reports its own pending state.
 *
 * Only meaningful inside next/form's <Form>, which turns a GET submit into a
 * client-side navigation — a plain <form method="get"> hands off to the browser
 * and this component would never see `pending`.
 *
 * Setting `disabled` while pending is also what MainButtonBridge watches, so
 * inside Telegram the native MainButton shows its progress spinner for free.
 */
export function SubmitButton({
  label,
  pendingLabel,
  className,
}: {
  label: string;
  pendingLabel: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`flex items-center justify-center gap-2 disabled:opacity-70 ${className ?? ""}`}
    >
      {pending ? <Spinner /> : null}
      {pending ? pendingLabel : label}
    </button>
  );
}
