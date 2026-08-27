import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const editorialDb = vi.hoisted(() => ({
  createArticle: vi.fn(),
  createCategory: vi.fn(),
  deleteArticle: vi.fn(),
  findArticleById: vi.fn(),
  findArticleBySlug: vi.fn(),
  findArticleByTitle: vi.fn(),
  getArticleWithContent: vi.fn(),
  getPublishedArticleBySlug: vi.fn(),
  listArticlesForManager: vi.fn(),
  listArticlesInCategory: vi.fn(),
  listCategories: vi.fn(),
  listFeaturedArticles: vi.fn(),
  listLatestArticles: vi.fn(),
  searchPublishedArticles: vi.fn(),
  replaceArticleImages: vi.fn(),
  replaceArticleSections: vi.fn(),
  setArticleCategories: vi.fn(),
  setArticleStatus: vi.fn(),
  updateArticleMetadata: vi.fn(),
}));

vi.mock("./db", () => editorialDb);

import { appRouter } from "./routers";

function createContext(userId: number, role: "admin" | "user"): TrpcContext {
  return {
    user: {
      id: userId,
      openId: `author-${userId}`,
      name: "Autor de teste",
      email: "autor@example.com",
      loginMethod: "manus",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as TrpcContext["res"],
  };
}

describe("editorial publication router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects an attempt to edit another author's article", async () => {
    editorialDb.findArticleById.mockResolvedValue({ id: 7, authorId: 44 });
    const caller = appRouter.createCaller(createContext(12, "user"));

    await expect(caller.editorial.manage.detail({ id: 7 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(editorialDb.getArticleWithContent).not.toHaveBeenCalled();
  });

  it("allows an author to publish their own article", async () => {
    editorialDb.findArticleById.mockResolvedValue({ id: 7, authorId: 12 });
    editorialDb.getArticleWithContent.mockResolvedValue({ id: 7, status: "published" });
    const caller = appRouter.createCaller(createContext(12, "user"));

    await expect(caller.editorial.manage.publish({ id: 7, published: true })).resolves.toMatchObject({ id: 7, status: "published" });
    expect(editorialDb.setArticleStatus).toHaveBeenCalledWith(7, "published");
  });

  it("allows an administrator to retrieve an article created by another author", async () => {
    editorialDb.findArticleById.mockResolvedValue({ id: 7, authorId: 44 });
    editorialDb.getArticleWithContent.mockResolvedValue({ id: 7, status: "draft" });
    const caller = appRouter.createCaller(createContext(12, "admin"));

    await expect(caller.editorial.manage.detail({ id: 7 })).resolves.toMatchObject({ id: 7, status: "draft" });
  });

  it("does not resolve a draft through the public article route", async () => {
    editorialDb.getPublishedArticleBySlug.mockResolvedValue(null);
    const caller = appRouter.createCaller(createContext(12, "admin"));

    await expect(caller.editorial.bySlug({ slug: "rascunho-interno" })).resolves.toBeNull();
    expect(editorialDb.getPublishedArticleBySlug).toHaveBeenCalledWith("rascunho-interno");
  });

  it("searches the published editorial archive with the submitted term", async () => {
    editorialDb.searchPublishedArticles.mockResolvedValue([{ id: 7, title: "Forma e velocidade" }]);
    const caller = appRouter.createCaller(createContext(12, "user"));

    await expect(caller.editorial.search({ query: "velocidade" })).resolves.toEqual([{ id: 7, title: "Forma e velocidade" }]);
    expect(editorialDb.searchPublishedArticles).toHaveBeenCalledWith("velocidade");
  });

  it("persists SEO metadata supplied by an article author", async () => {
    editorialDb.findArticleById.mockResolvedValue({ id: 7, authorId: 12 });
    editorialDb.findArticleBySlug.mockResolvedValue(undefined);
    editorialDb.getArticleWithContent.mockResolvedValue({ id: 7, seoTitle: "Título SEO", seoDescription: "Descrição para pesquisa", socialImageUrl: "/manus-storage/social.jpg" });
    const caller = appRouter.createCaller(createContext(12, "user"));

    await caller.editorial.manage.saveMetadata({
      id: 7,
      title: "Título editorial",
      articleTitle: null,
      slug: "titulo-editorial",
      deck: "Subtítulo",
      authorName: "Autor de teste",
      coverImageUrl: null,
      coverImageCaption: null,
      seoTitle: "Título SEO",
      seoDescription: "Descrição para pesquisa",
      socialImageUrl: "/manus-storage/social.jpg",
      isFeatured: false,
    });

    expect(editorialDb.updateArticleMetadata).toHaveBeenCalledWith(expect.objectContaining({
      id: 7,
      seoTitle: "Título SEO",
      seoDescription: "Descrição para pesquisa",
      socialImageUrl: "/manus-storage/social.jpg",
    }));
  });

  it("rejects creating an article with a duplicate title", async () => {
    editorialDb.findArticleByTitle.mockResolvedValue({ id: 99, title: "Título existente" });
    const caller = appRouter.createCaller(createContext(12, "user"));

    await expect(caller.editorial.manage.create({ title: "Título existente" })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(editorialDb.createArticle).not.toHaveBeenCalled();
  });

  it("rejects renaming an article to another existing title", async () => {
    editorialDb.findArticleById.mockResolvedValue({ id: 7, authorId: 12, status: "draft" });
    editorialDb.findArticleByTitle.mockResolvedValue({ id: 99, title: "Título ocupado" });
    const caller = appRouter.createCaller(createContext(12, "user"));

    await expect(caller.editorial.manage.saveMetadata({
      id: 7,
      title: "Título ocupado",
      articleTitle: null,
      slug: "titulo-ocupado",
      deck: null,
      authorName: "Autor de teste",
      coverImageUrl: null,
      coverImageCaption: null,
      seoTitle: null,
      seoDescription: null,
      socialImageUrl: null,
      isFeatured: false,
    })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(editorialDb.updateArticleMetadata).not.toHaveBeenCalled();
  });

  it("rejects deleting a draft owned by another author", async () => {
    editorialDb.findArticleById.mockResolvedValue({ id: 7, authorId: 44, status: "draft" });
    const caller = appRouter.createCaller(createContext(12, "user"));

    await expect(caller.editorial.manage.deleteDraft({ id: 7 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(editorialDb.deleteArticle).not.toHaveBeenCalled();
  });

  it("allows an authorised author to delete a draft", async () => {
    editorialDb.findArticleById.mockResolvedValue({ id: 7, authorId: 12, status: "draft" });
    const caller = appRouter.createCaller(createContext(12, "user"));

    await expect(caller.editorial.manage.deleteDraft({ id: 7 })).resolves.toEqual({ success: true, id: 7 });
    expect(editorialDb.deleteArticle).toHaveBeenCalledWith(7);
  });

  it("does not delete a published article through the draft action", async () => {
    editorialDb.findArticleById.mockResolvedValue({ id: 7, authorId: 12, status: "published" });
    const caller = appRouter.createCaller(createContext(12, "user"));

    await expect(caller.editorial.manage.deleteDraft({ id: 7 })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(editorialDb.deleteArticle).not.toHaveBeenCalled();
  });

  it("persists the normalised order of article sections", async () => {
    editorialDb.findArticleById.mockResolvedValue({ id: 7, authorId: 12 });
    editorialDb.getArticleWithContent.mockResolvedValue({ id: 7, sections: [] });
    const caller = appRouter.createCaller(createContext(12, "user"));
    const sections = [
      { type: "chapter" as const, heading: "Segundo", body: "Texto", caption: null, position: 0 },
      { type: "paragraph" as const, heading: null, body: "Introdução", caption: null, position: 1 },
    ];

    await caller.editorial.manage.saveSections({ id: 7, sections });

    expect(editorialDb.replaceArticleSections).toHaveBeenCalledWith(7, sections);
  });

  it("rejects saving more than 10 images in an article's embedded gallery", async () => {
    const caller = appRouter.createCaller(createContext(12, "user"));
    const images = Array.from({ length: 11 }, (_, position) => ({ url: `/manus-storage/${position}.jpg`, position: Math.min(position, 9) }));

    await expect(caller.editorial.manage.saveImages({ id: 7, images })).rejects.toThrow();
    expect(editorialDb.replaceArticleImages).not.toHaveBeenCalled();
  });

  it("saves up to 10 images in an article's embedded gallery", async () => {
    editorialDb.findArticleById.mockResolvedValue({ id: 7, authorId: 12 });
    editorialDb.getArticleWithContent.mockResolvedValue({ id: 7, images: [] });
    const caller = appRouter.createCaller(createContext(12, "user"));
    const images = Array.from({ length: 10 }, (_, position) => ({ url: `/manus-storage/${position}.jpg`, position }));

    await caller.editorial.manage.saveImages({ id: 7, images });

    expect(editorialDb.replaceArticleImages).toHaveBeenCalledWith(7, images);
  });
});
