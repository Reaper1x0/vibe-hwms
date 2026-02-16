"use client";

export function ConfirmActionButton({
  action,
  label,
  confirmMessage,
  className = "ui-btn-secondary rounded-md border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-700",
}: {
  action: () => void | Promise<void>;
  label: string;
  confirmMessage: string;
  className?: string;
}) {
  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    if (!confirm(confirmMessage)) return;
    await action();
  }

  return (
    <button type="button" onClick={handleClick} className={`ui-press ${className}`}>
      {label}
    </button>
  );
}
