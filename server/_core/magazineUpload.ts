import type { Express, Request, Response } from "express";
import express from "express";
import { createMagazineIssue } from "../db";
import { storageFetchBytes, storagePut } from "../storage";
import { toEditorialSlug } from "../../shared/editorial";
import { sdk } from "./sdk";

async function requireAdmin(req: Request, res: Response): Promise<boolean> {
  try {
    const user = await sdk.authenticateRequest(req);
    if (user.role !== "admin") {
      res.status(403).json({ error: "Apenas administradores podem publicar edições." });
      return false;
    }
    return true;
  } catch {
    res.status(401).json({ error: "Sessão inválida." });
    return false;
  }
}

// Magazine PDFs (tens of MB) can't travel through tRPC's JSON body (base64
// adds ~33% overhead), can't be uploaded straight from the browser to S3
// (the Forge-managed bucket's CORS policy rejects cross-origin PUTs from
// this app — confirmed by testing), and can't be sent to our own server in
// one shot either once deployed to Vercel: serverless functions there
// reject any request body over ~4.5MB with a 413, a platform limit our own
// Express body-size config can't override.
//
// So the browser splits the file into small chunks (client-side, see
// MagazineEditor.tsx), POSTs each one to /upload-chunk — small enough to
// clear Vercel's limit — and this server relays each chunk straight to a
// temporary S3 key (server-to-server, so CORS doesn't apply and size isn't
// an issue for a few MB). Once every chunk has landed, /finalize fetches
// them all back (parallel, since each is an independent GET), concatenates
// them in memory, and does a single PUT of the complete file to its real
// destination key.
export function registerMagazineUploadRoute(app: Express) {
  app.post(
    "/api/magazine/upload-chunk",
    express.raw({ type: "application/octet-stream", limit: "10mb" }),
    async (req: Request, res: Response) => {
      if (!(await requireAdmin(req, res))) return;

      const body = req.body as Buffer;
      const uploadId = typeof req.query.uploadId === "string" ? req.query.uploadId : "";
      const index = Number(req.query.index);
      if (!uploadId || !Number.isInteger(index) || index < 0) {
        res.status(400).json({ error: "Parâmetros de upload em falta." });
        return;
      }
      if (!Buffer.isBuffer(body) || body.length === 0) {
        res.status(400).json({ error: "Parte do ficheiro em falta ou vazia." });
        return;
      }

      try {
        // storagePut appends a random hash to whatever key we ask for (it's
        // meant for one-off named uploads), so the chunk's real key can't be
        // guessed back from uploadId+index alone — hand it back to the client
        // instead, which passes the exact list on to /finalize.
        const safeId = uploadId.replace(/[^a-zA-Z0-9-]/g, "");
        const asset = await storagePut(`magazine/_chunks/${safeId}/${String(index).padStart(5, "0")}.part`, body, "application/octet-stream");
        res.json({ key: asset.key });
      } catch (error) {
        console.error("[Magazine upload] Chunk failed", error);
        res.status(500).json({ error: error instanceof Error ? error.message : "Falha ao enviar parte do ficheiro." });
      }
    },
  );

  app.post("/api/magazine/finalize", express.json(), async (req: Request, res: Response) => {
    if (!(await requireAdmin(req, res))) return;

    const body = req.body as { chunkKeys?: unknown; title?: unknown; description?: unknown; fileName?: unknown; coverImageUrl?: unknown; coverImageStorageKey?: unknown };
    const chunkKeys = Array.isArray(body.chunkKeys) ? body.chunkKeys.filter((key): key is string => typeof key === "string") : [];
    const title = typeof body.title === "string" ? body.title : "";
    const fileName = typeof body.fileName === "string" ? body.fileName : "revista.pdf";
    if (!chunkKeys.length) {
      res.status(400).json({ error: "Partes do ficheiro em falta." });
      return;
    }
    if (!title.trim()) {
      res.status(400).json({ error: "Título em falta." });
      return;
    }

    const description = typeof body.description === "string" ? body.description : "";
    const coverImageUrl = typeof body.coverImageUrl === "string" ? body.coverImageUrl : null;
    const coverImageStorageKey = typeof body.coverImageStorageKey === "string" ? body.coverImageStorageKey : null;

    try {
      const chunks = await Promise.all(chunkKeys.map((key) => storageFetchBytes(key)));
      const fullFile = Buffer.concat(chunks);

      const safeName = toEditorialSlug(fileName.replace(/\.pdf$/i, "")) || "revista";
      const asset = await storagePut(`magazine/${Date.now()}-${safeName}.pdf`, fullFile, "application/pdf");
      const issue = await createMagazineIssue({
        title: title.trim(),
        description: description.trim() || null,
        pdfUrl: asset.url,
        pdfStorageKey: asset.key,
        coverImageUrl,
        coverImageStorageKey,
      });
      res.json(issue);
    } catch (error) {
      console.error("[Magazine upload] Finalize failed", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Falha ao publicar a edição." });
    }
  });
}
