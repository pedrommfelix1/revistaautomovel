import type { Express, Request, Response } from "express";
import { recordAnalyticsEvent } from "../db";

// Plain endpoint (not tRPC) so the client can fire it with
// navigator.sendBeacon — works mid-navigation and on page unload, which a
// fetch tied to a React Query mutation hook does not handle as reliably.
export function registerAnalyticsTrackingRoute(app: Express) {
  app.post("/api/track", async (req: Request, res: Response) => {
    try {
      const body = req.body as Record<string, unknown>;
      const type = body?.type === "click" ? "click" : body?.type === "pageview" ? "pageview" : null;
      const path = typeof body?.path === "string" ? body.path : null;
      if (!type || !path || !path.startsWith("/") || path.length > 300) {
        res.status(400).json({ error: "invalid payload" });
        return;
      }
      const label = typeof body?.label === "string" ? body.label : null;
      const referrer = typeof body?.referrer === "string" ? body.referrer : null;
      await recordAnalyticsEvent({ type, path, label, referrer });
      res.status(204).end();
    } catch (error) {
      console.error("[analytics] failed to record event", error);
      res.status(204).end();
    }
  });
}
