// Image/PDF storage on a public Vercel Blob store. A key is the blob's pathname,
// a URL is the absolute CDN address that <img> tags use directly.

import { put } from "@vercel/blob";
import { ENV } from "./_core/env";

function getToken(): string {
  if (!ENV.blobToken) {
    throw new Error("Storage config missing: set BLOB_READ_WRITE_TOKEN");
  }
  return ENV.blobToken;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

// Public blobs live at https://<storeId>.public.blob.vercel-storage.com/<pathname>;
// the storeId is the 4th segment of the token (vercel_blob_rw_<storeId>_<secret>).
function blobUrlForKey(key: string): string {
  const [, , , storeId] = getToken().split("_");
  return `https://${storeId.toLowerCase()}.public.blob.vercel-storage.com/${normalizeKey(key)}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const blob = await put(normalizeKey(relKey), typeof data === "string" ? data : Buffer.from(data), {
    access: "public",
    contentType,
    addRandomSuffix: true,
    token: getToken(),
  });
  return { key: blob.pathname, url: blob.url };
}

export async function storageFetchBytes(relKey: string): Promise<Buffer> {
  const resp = await fetch(blobUrlForKey(relKey));
  if (!resp.ok) throw new Error(`Storage fetch failed (${resp.status})`);
  return Buffer.from(await resp.arrayBuffer());
}
