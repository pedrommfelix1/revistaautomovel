import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { listSiteGalleryImages, replaceSiteGalleryImages } from "../db";
import { storagePut } from "../storage";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { toEditorialSlug } from "../../shared/editorial";

const galleryImageInput = z.object({
  url: z.string().min(1).max(2000),
  storageKey: z.string().max(600).nullable().optional(),
  altText: z.string().max(250).nullable().optional(),
  caption: z.string().max(600).nullable().optional(),
  position: z.number().int().min(0).max(99),
});

type GalleryContext = { user: { role: "admin" | "user" } };

function assertCanManageGallery(ctx: GalleryContext) {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Apenas administradores podem gerir a galeria do site." });
  }
}

export const galleryRouter = router({
  list: publicProcedure.query(() => listSiteGalleryImages()),

  manage: router({
    save: protectedProcedure.input(z.object({ images: z.array(galleryImageInput).max(100) })).mutation(async ({ ctx, input }) => {
      assertCanManageGallery(ctx);
      await replaceSiteGalleryImages(input.images);
      return listSiteGalleryImages();
    }),
    uploadImage: protectedProcedure.input(z.object({ dataUrl: z.string().min(32).max(8_000_000), fileName: z.string().min(1).max(180) })).mutation(async ({ ctx, input }) => {
      assertCanManageGallery(ctx);
      const match = input.dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
      if (!match) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Use uma imagem JPEG, PNG ou WebP válida." });
      }
      const contentType = match[1];
      const bytes = Buffer.from(match[2], "base64");
      if (bytes.byteLength > 5_000_000) {
        throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Cada imagem deve ter no máximo 5 MB após otimização." });
      }
      const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
      const asset = await storagePut(`gallery/${ctx.user.id}-${Date.now()}-${toEditorialSlug(input.fileName) || "imagem"}.${ext}`, bytes, contentType);
      return asset;
    }),
  }),
});
