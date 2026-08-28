import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createArticle,
  createCategory,
  deleteArticle,
  findArticleById,
  findArticleBySlug,
  findArticleByTitle,
  getArticleWithContent,
  getPublishedArticleBySlug,
  listArticlesForManager,
  listArticlesInCategory,
  listCategories,
  listFeaturedArticles,
  listLatestArticles,
  searchPublishedArticles,
  replaceArticleImages,
  replaceArticleSections,
  setArticleCategories,
  setArticleStatus,
  updateArticleMetadata,
} from "../db";
import { storagePut } from "../storage";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { canManageEditorialArticle, toEditorialSlug } from "../../shared/editorial";

const sectionInput = z.object({
  type: z.enum(["paragraph", "chapter", "quote", "suggested"]),
  heading: z.string().max(220).nullable().optional(),
  body: z.string().max(20000).nullable().optional(),
  caption: z.string().max(500).nullable().optional(),
  position: z.number().int().min(0),
});

const imageInput = z.object({
  url: z.string().min(1).max(2000),
  storageKey: z.string().max(600).nullable().optional(),
  altText: z.string().max(250).nullable().optional(),
  caption: z.string().max(600).nullable().optional(),
  position: z.number().int().min(0).max(9),
});

const metadataInput = z.object({
  id: z.number().int().positive(),
  title: z.string().min(3).max(220),
  articleTitle: z.string().max(220).nullable(),
  slug: z.string().min(3).max(180),
  deck: z.string().max(700).nullable(),
  authorName: z.string().min(2).max(120),
  coverImageUrl: z.string().max(2000).nullable(),
  coverImageCaption: z.string().max(600).nullable(),
  seoTitle: z.string().max(70).nullable(),
  seoDescription: z.string().max(200).nullable(),
  socialImageUrl: z.string().max(2000).nullable(),
  isFeatured: z.boolean(),
});

type EditorContext = { user: { id: number; role: "admin" | "user" } };

async function assertCanManageArticle(ctx: EditorContext, articleId: number) {
  const article = await findArticleById(articleId);
  if (!article) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Artigo não encontrado." });
  }
  if (!canManageEditorialArticle(ctx.user, article.authorId)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Não tem permissão para editar este artigo." });
  }
  return article;
}

async function uniqueArticleSlug(value: string, ignoreId?: number) {
  const base = toEditorialSlug(value) || "artigo";
  let candidate = base;
  let attempt = 2;

  while (true) {
    const existing = await findArticleBySlug(candidate);
    if (!existing || existing.id === ignoreId) return candidate;
    candidate = `${base}-${attempt}`.slice(0, 180);
    attempt += 1;
  }
}

export const editorialRouter = router({
  categories: publicProcedure.query(() => listCategories()),
  featured: publicProcedure.query(() => listFeaturedArticles()),
  latest: publicProcedure.input(z.object({ limit: z.number().int().min(1).max(24).default(9) }).optional()).query(({ input }) => listLatestArticles(input?.limit ?? 9)),
  all: publicProcedure.query(() => listLatestArticles(500)),
  bySlug: publicProcedure.input(z.object({ slug: z.string().min(1).max(180) })).query(({ input }) => getPublishedArticleBySlug(input.slug)),
  byCategory: publicProcedure.input(z.object({ slug: z.string().min(1).max(100) })).query(({ input }) => listArticlesInCategory(input.slug)),
  search: publicProcedure.input(z.object({ query: z.string().min(2).max(100) })).query(({ input }) => searchPublishedArticles(input.query)),

  manage: router({
    list: protectedProcedure.query(({ ctx }) => listArticlesForManager(ctx.user.id, ctx.user.role === "admin")),
    detail: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ ctx, input }) => {
      await assertCanManageArticle(ctx, input.id);
      return getArticleWithContent(input.id);
    }),
    create: protectedProcedure.input(z.object({ title: z.string().min(3).max(220) })).mutation(async ({ ctx, input }) => {
      const duplicate = await findArticleByTitle(input.title);
      if (duplicate) {
        throw new TRPCError({ code: "CONFLICT", message: "Já existe um artigo com este título. Escolha outro nome." });
      }
      const slug = await uniqueArticleSlug(input.title);
      return createArticle({ title: input.title, slug, authorId: ctx.user.id, authorName: ctx.user.name ?? "Autor Motor de Linha" });
    }),
    saveMetadata: protectedProcedure.input(metadataInput).mutation(async ({ ctx, input }) => {
      await assertCanManageArticle(ctx, input.id);
      const duplicate = await findArticleByTitle(input.title, input.id);
      if (duplicate) {
        throw new TRPCError({ code: "CONFLICT", message: "Já existe um artigo com este título. Escolha outro nome." });
      }
      const slug = await uniqueArticleSlug(input.slug || input.title, input.id);
      await updateArticleMetadata({ ...input, slug });
      return getArticleWithContent(input.id);
    }),
    saveSections: protectedProcedure.input(z.object({ id: z.number().int().positive(), sections: z.array(sectionInput).max(60) })).mutation(async ({ ctx, input }) => {
      await assertCanManageArticle(ctx, input.id);
      await replaceArticleSections(input.id, input.sections);
      return getArticleWithContent(input.id);
    }),
    saveImages: protectedProcedure.input(z.object({ id: z.number().int().positive(), images: z.array(imageInput).max(10) })).mutation(async ({ ctx, input }) => {
      await assertCanManageArticle(ctx, input.id);
      await replaceArticleImages(input.id, input.images);
      return getArticleWithContent(input.id);
    }),
    saveCategories: protectedProcedure.input(z.object({ id: z.number().int().positive(), categoryIds: z.array(z.number().int().positive()).max(6) })).mutation(async ({ ctx, input }) => {
      await assertCanManageArticle(ctx, input.id);
      await setArticleCategories(input.id, input.categoryIds);
      return getArticleWithContent(input.id);
    }),
    publish: protectedProcedure.input(z.object({ id: z.number().int().positive(), published: z.boolean() })).mutation(async ({ ctx, input }) => {
      await assertCanManageArticle(ctx, input.id);
      await setArticleStatus(input.id, input.published ? "published" : "draft");
      return getArticleWithContent(input.id);
    }),
    deleteDraft: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const article = await assertCanManageArticle(ctx, input.id);
      if (article.status !== "draft") {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Só é possível apagar rascunhos." });
      }
      await deleteArticle(input.id);
      return { success: true as const, id: input.id };
    }),
    createCategory: protectedProcedure.input(z.object({ name: z.string().min(2).max(80), description: z.string().max(240).nullable().optional(), kind: z.enum(["tipo", "marca"]) })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Apenas administradores podem criar categorias." });
      }
      const slug = toEditorialSlug(input.name);
      return createCategory({ name: input.name, slug, description: input.description ?? null, kind: input.kind });
    }),
    uploadImage: protectedProcedure.input(z.object({ id: z.number().int().positive(), dataUrl: z.string().min(32).max(8_000_000), fileName: z.string().min(1).max(180) })).mutation(async ({ ctx, input }) => {
      await assertCanManageArticle(ctx, input.id);
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
      const asset = await storagePut(`editorial/${ctx.user.id}/${input.id}-${Date.now()}-${toEditorialSlug(input.fileName) || "imagem"}.${ext}`, bytes, contentType);
      return asset;
    }),
  }),
});
