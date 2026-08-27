import "dotenv/config";
import express, { type NextFunction, type Request, type Response } from "express";
import type { IncomingMessage, ServerResponse } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";

// Vercel serverless entry point: same Express app as the traditional server
// (server/_core/index.ts), minus the Vite dev middleware / static file serving
// and the .listen() call, since Vercel invokes this handler per-request and
// serves the built client separately via its static output.
//
// This file is pre-bundled by esbuild into api/index.js ("pnpm build:api",
// also re-run by vercel.json's buildCommand on every deploy) rather than
// deployed as raw TypeScript. Two reasons that has to be a real bundle:
//  1. Vercel's own TS-to-JS compilation for /api files is per-file, not a
//     full bundle, and the output runs under Node's native ESM resolver,
//     which requires explicit file extensions on relative imports and fails
//     on ordinary extensionless TS-style imports like "./oauth".
//  2. Vercel decides which files under api/ become serverless functions by
//     scanning the git-committed source, before any buildCommand runs — so
//     api/index.js must be committed (not gitignored), or Vercel never
//     creates the function at all (404 instead of a crash).
// If you change this file or anything it imports, run `pnpm build:api` and
// commit the resulting api/index.js before pushing.
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
