"use client";

export function ConfirmActionButton({
  action,
  label,
  confirmMessage,
  className = "rounded-md border bg-white px-3 py-1 text-xs font-medium",
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
    <button type="button" onClick={handleClick} className={className}>
      {label}
    </button>
  );
}
