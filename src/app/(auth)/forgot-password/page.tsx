import Link from "next/link";

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Reset password</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Contact your hospital administrator or IT support to reset your password. If your organization uses
        self-service reset, they will provide a link.
      </p>
      <Link
        href="/login"
        className="mt-6 inline-flex w-full justify-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
      >
        Back to sign in
      </Link>
    </main>
  );
}
