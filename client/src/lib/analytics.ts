// Fire-and-forget tracking beacons for the backoffice metrics page
// (server/_core/analytics.ts + server/routers/analytics.ts). Uses
// navigator.sendBeacon so a click that immediately navigates away (e.g. a
// share link opening in a new tab) still gets recorded.

const VISITOR_ID_KEY = "autoturbo-visitor-id";
const SESSION_ID_KEY = "autoturbo-session-id";

function randomId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// A random, non-identifying ID persisted across visits (localStorage) so
// "reach" can count distinct visitors instead of just total pageviews. Falls
// back to a fresh one-off ID if storage is unavailable (private browsing).
function getVisitorId(): string | undefined {
  try {
    let id = localStorage.getItem(VISITOR_ID_KEY);
    if (!id) {
      id = randomId();
      localStorage.setItem(VISITOR_ID_KEY, id);
    }
    return id;
  } catch {
    return undefined;
  }
}

// A random ID scoped to sessionStorage — cleared when the tab closes, so it
// approximates "one visit" for bounce-rate / articles-per-visit purposes.
function getSessionId(): string | undefined {
  try {
    let id = sessionStorage.getItem(SESSION_ID_KEY);
    if (!id) {
      id = randomId();
      sessionStorage.setItem(SESSION_ID_KEY, id);
    }
    return id;
  } catch {
    return undefined;
  }
}

function send(payload: { type: "pageview" | "click" | "timing"; path: string; label?: string; referrer?: string; durationMs?: number }) {
  if (import.meta.env.DEV) return; // keep local testing out of real visitor stats
  const body = JSON.stringify({ ...payload, visitorId: getVisitorId(), sessionId: getSessionId() });
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
      return;
    }
  } catch {
    // fall through to fetch
  }
  fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
}

export function trackPageview(path: string) {
  send({ type: "pageview", path, referrer: document.referrer || undefined });
}

export function trackClick(label: string, path?: string) {
  send({ type: "click", path: path ?? window.location.pathname, label });
}

// Fired when leaving a page, with how long it was open — used for "tempo
// médio no artigo" in the backoffice metrics.
export function trackTiming(path: string, durationMs: number) {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return;
  send({ type: "timing", path, durationMs });
}
