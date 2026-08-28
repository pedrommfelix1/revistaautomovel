import type { Request } from "express";

/**
 * CSRF guard for state-changing requests: the browser always attaches
 * Origin (and, when that's absent, Referer) to cross-site requests, and
 * neither can be forged by script running on another site. If it doesn't
 * match this request's own Host, the request didn't originate from this
 * app — reject it. There is currently no such check anywhere else in this
 * app; every route that mutates data should call this.
 */
export function isSameOrigin(req: Request): boolean {
  const host = req.headers.host;
  const source = req.headers.origin || req.headers.referer;
  if (!host || !source) return false;
  try {
    return new URL(source).host === host;
  } catch {
    return false;
  }
}
