import { createTRPCClient, httpBatchLink, TRPCClientError } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "../server/routers";

export const BASE_URL = "http://localhost:3000";
export const ADMIN_STORAGE_STATE = "tests/.auth/admin.json";

// Tag every piece of data these tests create so it's obvious in the real
// (shared, cloud) database which rows are test fixtures, and so cleanup can
// find them again. This project has no separate test database — local dev
// and production point at the same TiDB Cloud instance — so every test is
// responsible for creating its own data and removing it afterwards rather
// than relying on (or polluting) whatever real content already exists.
export const E2E_PREFIX = "[E2E]";
export function e2eName(label: string) {
  return `${E2E_PREFIX} ${label} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Logs in via the dev-only bypass and returns the raw "name=value" session cookie. */
export async function devLoginCookie(role: "admin" | "user" = "admin"): Promise<string> {
  const resp = await fetch(`${BASE_URL}/api/dev/login${role === "user" ? "?role=user" : ""}`, { redirect: "manual" });
  const setCookie = resp.headers.get("set-cookie");
  if (!setCookie) throw new Error(`/api/dev/login did not set a cookie (status ${resp.status})`);
  return setCookie.split(";")[0];
}

/** Typed tRPC client. Omit `cookie` for an unauthenticated (public) client. */
export function apiClient(cookie?: string) {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${BASE_URL}/api/trpc`,
        transformer: superjson,
        headers: () => (cookie ? { cookie } : {}),
      }),
    ],
  });
}

export function errorCode(error: unknown): string | undefined {
  if (error instanceof TRPCClientError) return error.data?.code;
  return undefined;
}

/** Asserts a tRPC call rejects with the given error code (e.g. "UNAUTHORIZED", "FORBIDDEN"). */
export async function expectErrorCode(promise: Promise<unknown>, code: string): Promise<void> {
  try {
    await promise;
  } catch (error) {
    if (errorCode(error) === code) return;
    throw new Error(`expected error code ${code}, got ${errorCode(error) ?? String(error)}`);
  }
  throw new Error(`expected a rejection with error code ${code}, but the call succeeded`);
}
