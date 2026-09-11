// Fire-and-forget tracking beacons for the backoffice metrics page
// (server/_core/analytics.ts + server/routers/analytics.ts). Uses
// navigator.sendBeacon so a click that immediately navigates away (e.g. a
// share link opening in a new tab) still gets recorded.
function send(payload: { type: "pageview" | "click"; path: string; label?: string; referrer?: string }) {
  if (import.meta.env.DEV) return; // keep local testing out of real visitor stats
  const body = JSON.stringify(payload);
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
