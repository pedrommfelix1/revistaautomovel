import "dotenv/config";
import express, { type NextFunction, type Request, type Response } from "express";
import type { IncomingMessage, ServerResponse } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "../server/_core/oauth";
import { registerStorageProxy } from "../server/_core/storageProxy";
import { appRouter } from "../server/routers";
import { createContext } from "../server/_core/context";

// Vercel serverless entry point: same Express app as the traditional server
// (server/_core/index.ts), minus the Vite dev middleware / static file serving
// and the .listen() call, since Vercel invokes this handler per-request and
// serves the built client separately via its static output.
const app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, hasDatabaseUrl: Boolean(process.env.DATABASE_URL), nodeEnv: process.env.NODE_ENV ?? null });
});

registerStorageProxy(app);
registerOAuthRoutes(app);
app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));

// Surface unexpected errors as JSON instead of letting the function crash silently.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[api] unhandled error:", err);
  res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
});

// Export a plain (req, res) handler — the pattern Vercel's Node runtime always
// recognizes, rather than relying on it to detect a raw Express app export.
export default function handler(req: IncomingMessage, res: ServerResponse) {
  app(req, res);
}
