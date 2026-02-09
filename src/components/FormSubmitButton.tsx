"use client";

import { useFormStatus } from "react-dom";

type FormSubmitButtonProps = {
  label: string;
  loadingLabel?: string;
  className?: string;
};

export function FormSubmitButton({ label, loadingLabel = "Submitting…", className }: FormSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} className={className || "rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-70"}>
      {pending ? loadingLabel : label}
    </button>
  );
}
