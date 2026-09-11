import type { Express, Request, Response } from "express";
import { listPublishedArticlesForFeed } from "../db";

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function registerRssRoute(app: Express) {
  app.get("/rss.xml", async (req: Request, res: Response) => {
    try {
      const proto = (req.headers["x-forwarded-proto"] as string | undefined) ?? req.protocol;
      const baseUrl = `${proto}://${req.headers.host}`;

      const articles = await listPublishedArticlesForFeed(30);

      const items = articles.map((article) => {
        const link = `${baseUrl}/artigo/${article.slug}`;
        const title = article.articleTitle || article.title;
        const pubDate = new Date(article.publishedAt ?? article.createdAt).toUTCString();
        return [
          "  <item>",
          `    <title>${escapeXml(title)}</title>`,
          `    <link>${escapeXml(link)}</link>`,
          `    <guid>${escapeXml(link)}</guid>`,
          `    <pubDate>${pubDate}</pubDate>`,
          `    <author>${escapeXml(article.authorName)}</author>`,
          article.deck ? `    <description>${escapeXml(article.deck)}</description>` : null,
          "  </item>",
        ].filter(Boolean).join("\n");
      });

      const xml = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
        "<channel>",
        "  <title>Auto Turbo</title>",
        `  <link>${escapeXml(baseUrl)}/</link>`,
        "  <description>Ensaios, cultura e design automóvel com uma leitura editorial cuidada.</description>",
        "  <language>pt-pt</language>",
        `  <atom:link href="${escapeXml(baseUrl)}/rss.xml" rel="self" type="application/rss+xml" />`,
        ...items,
        "</channel>",
        "</rss>",
        "",
      ].join("\n");

      res.set("Content-Type", "application/rss+xml; charset=utf-8");
      res.set("Cache-Control", "public, max-age=3600");
      res.send(xml);
    } catch (error) {
      console.error("[rss] failed to generate", error);
      res.status(500).send("Internal error");
    }
  });
}
