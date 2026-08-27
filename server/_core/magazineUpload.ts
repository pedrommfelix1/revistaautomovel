import type { Express, Request, Response } from "express";
import express from "express";
import { createMagazineIssue } from "../db";
import { storagePut } from "../storage";
import { toEditorialSlug } from "../../shared/editorial";
import { sdk } from "./sdk";

// Magazine PDFs (tens of MB) can't travel through tRPC's JSON body (base64
// adds ~33% overhead) nor be uploaded straight from the browser to S3 (the
// Forge-managed bucket's CORS policy doesn't allow cross-origin PUTs from
// this app — confirmed by testing, not just theory). So this is a plain
// Express route that takes the raw PDF bytes and does the S3 PUT itself
// (server-to-server, no CORS involved), the same way storagePut already
// works for every other upload in this app.
export function registerMagazineUploadRoute(app: Express) {
  app.post(
    "/api/magazine/upload",
    express.raw({ type: "application/pdf", limit: "300mb" }),
    async (req: Request, res: Response) => {
      try {
        const user = await sdk.authenticateRequest(req);
        if (user.role !== "admin") {
          res.status(403).json({ error: "Apenas administradores podem publicar edições." });
          return;
        }
      } catch {
        res.status(401).json({ error: "Sessão inválida." });
        return;
      }

      const body = req.body as Buffer;
      if (!Buffer.isBuffer(body) || body.length === 0) {
        res.status(400).json({ error: "Ficheiro PDF em falta ou vazio." });
        return;
      }

      const title = typeof req.query.title === "string" ? req.query.title : "";
      const fileName = typeof req.query.fileName === "string" ? req.query.fileName : "revista.pdf";
      if (!title.trim()) {
        res.status(400).json({ error: "Título em falta." });
        return;
      }

      const description = typeof req.query.description === "string" ? req.query.description : "";
      const coverImageUrl = typeof req.query.coverImageUrl === "string" ? req.query.coverImageUrl : null;
      const coverImageStorageKey = typeof req.query.coverImageStorageKey === "string" ? req.query.coverImageStorageKey : null;

      try {
        const safeName = toEditorialSlug(fileName.replace(/\.pdf$/i, "")) || "revista";
        const asset = await storagePut(`magazine/${Date.now()}-${safeName}.pdf`, body, "application/pdf");
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
        console.error("[Magazine upload] Failed", error);
        res.status(500).json({ error: error instanceof Error ? error.message : "Falha ao publicar a edição." });
      }
    },
  );
}
