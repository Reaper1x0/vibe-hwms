import { headers } from "next/headers";

export function getRequestOrigin() {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";

  if (!host) {
    return null;
  }

  return `${proto}://${host}`;
}

export async function apiFetch(path: string, init?: RequestInit) {
  const origin = getRequestOrigin();
  if (!origin) {
    throw new Error("Request origin is not available");
  }

  const cookie = headers().get("cookie");
  const mergedHeaders = new Headers(init?.headers);
  if (cookie && !mergedHeaders.has("cookie")) {
    mergedHeaders.set("cookie", cookie);
  }

  return fetch(new URL(path, origin), {
    ...init,
    headers: mergedHeaders,
  });
}
