import type { Express } from "express";
import { ENV } from "./env";

// Every image/PDF on the site went through this proxy on every single
// request: browser -> our server -> a fresh presign call to Forge -> 307 to
// the signed URL. With `Cache-Control: no-store` the browser couldn't even
// cache the redirect, so a page with a dozen images meant a dozen cold
// server round-trips (each with its own external Forge call) on every
// visit. The signed URLs Forge hands back are valid for ~1h (confirmed via
// their `Expires` param), so:
//  1. cache the signed URL server-side for a while, so a warm instance
//     serving several images doesn't re-presign the same key repeatedly;
//  2. tell the browser it can cache the redirect itself, so repeat loads
//     skip this server entirely.
// Both TTLs stay safely under the underlying 1h signature expiry.
const PRESIGN_CACHE_TTL_MS = 45 * 60 * 1000;
const BROWSER_CACHE_MAX_AGE_S = 25 * 60;

const presignCache = new Map<string, { url: string; expiresAt: number }>();

async function getSignedUrl(key: string): Promise<string> {
  const cached = presignCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.url;

  const forgeUrl = new URL(
    "v1/storage/presign/get",
    ENV.forgeApiUrl.replace(/\/+$/, "") + "/",
  );
  forgeUrl.searchParams.set("path", key);

  const forgeResp = await fetch(forgeUrl, {
    headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
  });

  if (!forgeResp.ok) {
    const body = await forgeResp.text().catch(() => "");
    throw new Error(`Storage backend error (${forgeResp.status}): ${body}`);
  }

  const { url } = (await forgeResp.json()) as { url: string };
  if (!url) throw new Error("Empty signed URL from backend");

  presignCache.set(key, { url, expiresAt: Date.now() + PRESIGN_CACHE_TTL_MS });
  return url;
}

export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }

    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }

    try {
      const url = await getSignedUrl(key);
      res.set("Cache-Control", `public, max-age=${BROWSER_CACHE_MAX_AGE_S}`);
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}
