"use client";

import { useFormStatus } from "react-dom";

import { Loader } from "@/components/Loader";

type FormSubmitButtonProps = {
  label: string;
  loadingLabel?: string;
  className?: string;
};

export function FormSubmitButton({ label, loadingLabel = "Submitting…", className }: FormSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={className || "ui-btn-primary inline-flex items-center justify-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-70 disabled:cursor-not-allowed"}
    >
      {pending ? (
        <>
          <Loader variant="inline" />
          <span>{loadingLabel}</span>
        </>
      ) : (
        label
      )}
    </button>
  );
}
