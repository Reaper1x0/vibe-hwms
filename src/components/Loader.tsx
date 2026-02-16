"use client";

type LoaderProps = {
  /** "page" = centered full-page spinner, "inline" = small spinner for buttons/tables */
  variant?: "page" | "inline" | "dots";
  className?: string;
};

/**
 * Animated loader. Use variant="page" for route loading, "inline" for buttons/tables.
 */
export function Loader({ variant = "page", className = "" }: LoaderProps) {
  if (variant === "dots") {
    return (
      <div className={`flex items-center justify-center gap-1.5 ${className}`} role="status" aria-label="Loading">
        <span
          className="h-2 w-2 rounded-full bg-zinc-500"
          style={{ animation: "loader-bounce 0.6s ease-in-out infinite both" }}
        />
        <span
          className="h-2 w-2 rounded-full bg-zinc-500"
          style={{ animation: "loader-bounce 0.6s ease-in-out 0.15s infinite both" }}
        />
        <span
          className="h-2 w-2 rounded-full bg-zinc-500"
          style={{ animation: "loader-bounce 0.6s ease-in-out 0.3s infinite both" }}
        />
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <span className={`inline-block h-4 w-4 shrink-0 rounded-full border-2 border-zinc-300 border-t-zinc-600 animate-spin ${className}`} role="status" aria-label="Loading" />
    );
  }

  return (
    <div className={`flex min-h-[12rem] flex-col items-center justify-center gap-4 ${className}`} role="status" aria-label="Loading">
      <span className="h-10 w-10 rounded-full border-2 border-zinc-200 border-t-zinc-600 animate-spin" />
      <span className="text-sm text-zinc-500">Loading…</span>
    </div>
  );
}
