"use client";

import { useFormStatus } from "react-dom";

export function LoginFormContent({
  nextPath,
  errorMessage,
}: {
  nextPath: string;
  errorMessage: string | null;
}) {
  const { pending } = useFormStatus();

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">HWMS</h1>
      <p className="mt-1 text-sm text-zinc-600">Hospital Workforce Management</p>
      <p className="mt-1 text-xs text-zinc-500">Sign in to continue.</p>

      {errorMessage ? (
        <div className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">
          {errorMessage}
        </div>
      ) : null}

      <div className="mt-8 space-y-4">
        <input type="hidden" name="next" value={nextPath} />
        <label className="block">
          <span className="text-sm font-medium text-zinc-900">Email</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-zinc-900">Password</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="ui-btn-primary w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </div>
      <p className="mt-4 text-center text-xs text-zinc-500">
        <a href="/forgot-password" className="underline hover:text-zinc-700">
          Forgot password?
        </a>
      </p>
    </>
  );
}
