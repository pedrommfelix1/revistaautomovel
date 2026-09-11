import type { Express, Request, Response } from "express";
import { listPublishedSlugsForSitemap } from "../db";

function isoDate(value: Date | string): string {
  return new Date(value).toISOString().slice(0, 10);
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function registerSitemapRoute(app: Express) {
  app.get("/sitemap.xml", async (req: Request, res: Response) => {
    try {
      const proto = (req.headers["x-forwarded-proto"] as string | undefined) ?? req.protocol;
      const baseUrl = `${proto}://${req.headers.host}`;
      const today = isoDate(new Date());

      const staticEntries = [
        { loc: "/", lastmod: today },
        { loc: "/noticias", lastmod: today },
        { loc: "/sobre", lastmod: today },
      ];

      const articles = await listPublishedSlugsForSitemap();
      const articleEntries = articles.map((article) => ({
        loc: `/artigo/${article.slug}`,
        lastmod: isoDate(article.updatedAt),
      }));

      const urls = [...staticEntries, ...articleEntries]
        .map((entry) => `  <url>\n    <loc>${escapeXml(baseUrl + entry.loc)}</loc>\n    <lastmod>${entry.lastmod}</lastmod>\n  </url>`)
        .join("\n");

      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

      res.set("Content-Type", "application/xml; charset=utf-8");
      res.set("Cache-Control", "public, max-age=3600");
      res.send(xml);
    } catch (error) {
      console.error("[sitemap] failed to generate", error);
      res.status(500).send("Internal error");
    }
  });
}
