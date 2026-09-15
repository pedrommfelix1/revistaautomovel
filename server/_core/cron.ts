import type { Express, Request, Response } from "express";
import { publishDueScheduledArticles } from "../db";
import { ENV } from "./env";

// Vercel invokes this once a day (see the "crons" entry in vercel.json — the
// Hobby plan's minimum interval), sending Authorization: Bearer $CRON_SECRET
// automatically when CRON_SECRET is set as a project env var. That's the
// only thing standing between "scheduled" and "published" for an article,
// so this must reject anything else, or anyone could force early publication
// by hitting the URL directly.
export function registerCronRoute(app: Express) {
  app.get("/api/cron/publish-scheduled", async (req: Request, res: Response) => {
    if (ENV.isProduction) {
      const expected = `Bearer ${ENV.cronSecret}`;
      if (!ENV.cronSecret || req.headers.authorization !== expected) {
        res.status(401).json({ error: "unauthorized" });
        return;
      }
    }
    try {
      const published = await publishDueScheduledArticles();
      res.json({ ok: true, published });
    } catch (error) {
      console.error("[cron] failed to publish scheduled articles", error);
      res.status(500).json({ ok: false });
    }
  });
}
