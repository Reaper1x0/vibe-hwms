"use client";

import { useState } from "react";

type CreateFormToggleProps = {
  title: string;
  buttonLabel: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
};

export function CreateFormToggle({ title, buttonLabel, children, defaultOpen = false }: CreateFormToggleProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="rounded-lg border bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-6 py-4 text-left text-sm font-semibold text-zinc-900 transition-colors hover:bg-zinc-50 active:bg-zinc-100"
        aria-expanded={open}
      >
        <span>{title}</span>
        <span
          className="ui-btn-secondary inline-flex shrink-0 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700"
        >
          {open ? "Hide" : buttonLabel}
        </span>
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="border-t p-6">{children}</div>
        </div>
      </div>
    </section>
  );
}
