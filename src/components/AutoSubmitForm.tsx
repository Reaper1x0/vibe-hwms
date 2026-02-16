"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useRef, useEffect } from "react";

/**
 * A form that updates the URL (and thus the table) via client-side navigation
 * when any select changes or form is submitted (e.g. Enter in search).
 * No full page reload — only the table data is re-fetched by the server.
 */
export function AutoSubmitForm({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  const syncToUrl = useCallback(() => {
    const form = formRef.current;
    if (!form) return;

    const data = new FormData(form);
    const params = new URLSearchParams();
    data.forEach((value, key) => {
      const s = String(value);
      if (s !== "") params.set(key, s);
    });
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }, [pathname, router]);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;

    function handleChange() {
      syncToUrl();
    }

    const selects = form.querySelectorAll("select");
    selects.forEach((el) => el.addEventListener("change", handleChange));

    return () => {
      selects.forEach((el) => el.removeEventListener("change", handleChange));
    };
  }, [syncToUrl]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    syncToUrl();
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className={className}
    >
      {children}
    </form>
  );
}
