import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center px-6 py-12">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">404 - Page not found</h1>
        <p className="mt-2 text-sm text-zinc-600">The page you&apos;re looking for doesn&apos;t exist or has been moved.</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/dashboard"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Go to dashboard
          </Link>
          <Link
            href="/login"
            className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
