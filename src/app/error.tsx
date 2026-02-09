"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to monitoring service in production
    console.error("Application error:", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center px-6 py-12">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Something went wrong</h1>
        <p className="mt-2 text-sm text-zinc-600">
          An unexpected error occurred. Please try again or contact support if the problem persists.
        </p>
        {process.env.NODE_ENV === "development" && error.message && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-4 text-left">
            <p className="text-xs font-mono text-red-900">{error.message}</p>
          </div>
        )}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={reset}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
