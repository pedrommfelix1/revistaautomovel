import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { deleteMagazineIssue, getMagazineIssue, listMagazineIssues } from "../db";
import { storagePut } from "../storage";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { toEditorialSlug } from "../../shared/editorial";

type MagazineContext = { user: { role: "admin" | "user" } };

function assertCanManageMagazine(ctx: MagazineContext) {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Apenas administradores podem gerir a revista." });
  }
}

export const magazineRouter = router({
  list: publicProcedure.query(() => listMagazineIssues()),
  byId: publicProcedure.input(z.object({ id: z.number().int().positive() })).query(({ input }) => getMagazineIssue(input.id)),

  manage: router({
    // The PDF itself is uploaded via a plain POST to /api/magazine/upload
    // (see server/_core/magazineUpload.ts), not through tRPC — it can easily
    // be 50MB+, well past what a JSON/base64 body should carry.
    uploadCover: protectedProcedure.input(z.object({ dataUrl: z.string().min(32).max(4_000_000), fileName: z.string().min(1).max(180) })).mutation(async ({ ctx, input }) => {
      assertCanManageMagazine(ctx);
      const match = input.dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
      if (!match) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Capa inválida — tem de ser gerada a partir da primeira página do PDF." });
      }
      const contentType = match[1];
      const bytes = Buffer.from(match[2], "base64");
      if (bytes.byteLength > 3_000_000) {
        throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "A capa gerada excede o tamanho máximo permitido." });
      }
      const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
      return storagePut(`magazine/covers/${Date.now()}-${toEditorialSlug(input.fileName) || "capa"}.${ext}`, bytes, contentType);
    }),
    delete: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      assertCanManageMagazine(ctx);
      await deleteMagazineIssue(input.id);
      return { success: true as const, id: input.id };
    }),
  }),
});
