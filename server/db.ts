import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { articleCategories, articleImages, articles, articleSections, categories, InsertUser, loginAttempts, magazineIssues, siteGalleryImages, siteSettings, users } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByUsername(username: string) {
  const db = await requireDb();
  const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
  return user ?? null;
}

export async function setUserPassword(userId: number, input: { passwordHash: string; mustChangePassword: boolean; passwordChangedAt: Date }) {
  const db = await requireDb();
  await db.update(users).set({
    passwordHash: input.passwordHash,
    mustChangePassword: input.mustChangePassword,
    passwordChangedAt: input.passwordChangedAt,
  }).where(eq(users.id, userId));
}

export async function recordLogin(userId: number, ip: string) {
  const db = await requireDb();
  await db.update(users).set({ lastSignedIn: new Date(), lastLoginIp: ip }).where(eq(users.id, userId));
}

export async function getLoginAttempts(bucketKey: string) {
  const db = await requireDb();
  const [record] = await db.select().from(loginAttempts).where(eq(loginAttempts.bucketKey, bucketKey)).limit(1);
  return record ?? null;
}

export async function setLoginAttempts(bucketKey: string, input: { failures: number; firstFailureAt: Date; blockedUntil: Date | null }) {
  const db = await requireDb();
  await db.insert(loginAttempts).values({ bucketKey, ...input })
    .onDuplicateKeyUpdate({ set: input });
}

export async function deleteLoginAttempts(bucketKey: string) {
  const db = await requireDb();
  await db.delete(loginAttempts).where(eq(loginAttempts.bucketKey, bucketKey));
}

type SectionInput = {
  type: "paragraph" | "chapter" | "quote" | "suggested" | "image";
  heading?: string | null;
  body?: string | null;
  caption?: string | null;
  position: number;
};

type ImageInput = {
  url: string;
  storageKey?: string | null;
  altText?: string | null;
  caption?: string | null;
  position: number;
};

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("A base de dados editorial não está disponível.");
  return db;
}

export async function listCategories() {
  const db = await requireDb();
  return db.select().from(categories).orderBy(asc(categories.name));
}

export async function createCategory(input: { name: string; slug: string; description: string | null; kind: "tipo" | "marca" }) {
  const db = await requireDb();
  await db.insert(categories).values(input);
  const [created] = await db.select().from(categories).where(eq(categories.slug, input.slug)).limit(1);
  return created;
}

export async function findArticleById(id: number) {
  const db = await requireDb();
  const [article] = await db.select().from(articles).where(eq(articles.id, id)).limit(1);
  return article;
}

export async function findArticleBySlug(slug: string) {
  const db = await requireDb();
  const [article] = await db.select().from(articles).where(eq(articles.slug, slug)).limit(1);
  return article;
}

export async function findArticleByTitle(title: string, ignoreId?: number) {
  const db = await requireDb();
  const conditions = [sql`LOWER(TRIM(${articles.title})) = LOWER(TRIM(${title.trim()}))`];
  if (ignoreId !== undefined) conditions.push(sql`${articles.id} <> ${ignoreId}`);
  const [article] = await db.select().from(articles).where(and(...conditions)).limit(1);
  return article;
}

// Card-shaped summaries for "suggested" sections — only published articles,
// in the editor's chosen order. Not the full getArticleWithContent() payload
// (no sections/images), since this only needs to render an ArticleCard.
async function getArticleCardSummaries(ids: number[]) {
  if (!ids.length) return [];
  const db = await requireDb();

  const rows = await db.select({
    id: articles.id,
    title: articles.title,
    slug: articles.slug,
    deck: articles.deck,
    coverImageUrl: articles.coverImageUrl,
    authorName: articles.authorName,
    publishedAt: articles.publishedAt,
    createdAt: articles.createdAt,
  }).from(articles).where(and(inArray(articles.id, ids), eq(articles.status, "published")));

  const categoryRows = await db.select({
    articleId: articleCategories.articleId,
    id: categories.id,
    name: categories.name,
    slug: categories.slug,
    kind: categories.kind,
  }).from(articleCategories)
    .innerJoin(categories, eq(articleCategories.categoryId, categories.id))
    .where(inArray(articleCategories.articleId, ids))
    .orderBy(sql`CASE WHEN ${categories.kind} = 'marca' THEN 0 ELSE 1 END`, asc(categories.name));

  const byId = new Map(rows.map((row) => [row.id, {
    ...row,
    categories: categoryRows.filter((category) => category.articleId === row.id).map(({ id: categoryId, name, slug }) => ({ id: categoryId, name, slug })),
  }]));

  return ids.map((articleId) => byId.get(articleId)).filter((row): row is NonNullable<typeof row> => Boolean(row));
}

function parseSuggestedArticleIds(body: string | null): number[] {
  return (body ?? "").split(",").map((value) => Number(value.trim())).filter((value) => Number.isInteger(value) && value > 0);
}

export async function getArticleWithContent(id: number) {
  const db = await requireDb();
  const article = await findArticleById(id);
  if (!article) return null;

  const [sectionRows, imageRows, categoryRows] = await Promise.all([
    db.select().from(articleSections).where(eq(articleSections.articleId, id)).orderBy(asc(articleSections.position)),
    db.select().from(articleImages).where(eq(articleImages.articleId, id)).orderBy(asc(articleImages.position)),
    db.select({ id: categories.id, name: categories.name, slug: categories.slug, description: categories.description, kind: categories.kind })
      .from(articleCategories)
      .innerJoin(categories, eq(articleCategories.categoryId, categories.id))
      .where(eq(articleCategories.articleId, id))
      .orderBy(sql`CASE WHEN ${categories.kind} = 'marca' THEN 0 ELSE 1 END`, asc(categories.name)),
  ]);

  const sections = await Promise.all(sectionRows.map(async (section) => {
    if (section.type !== "suggested") return { ...section, suggestedArticles: null };
    const suggestedArticles = await getArticleCardSummaries(parseSuggestedArticleIds(section.body));
    return { ...section, suggestedArticles };
  }));

  return { ...article, sections, images: imageRows, categories: categoryRows };
}

async function hydrateArticles(ids: number[]) {
  const hydrated = await Promise.all(ids.map((id) => getArticleWithContent(id)));
  return hydrated.filter((article): article is NonNullable<typeof article> => article !== null);
}

export async function listLatestArticles(limit: number) {
  const db = await requireDb();
  const rows = await db.select().from(articles).where(eq(articles.status, "published")).orderBy(desc(articles.publishedAt), desc(articles.createdAt)).limit(limit);
  return hydrateArticles(rows.map((article) => article.id));
}

export async function listFeaturedArticles() {
  const db = await requireDb();
  const rows = await db.select().from(articles).where(and(eq(articles.status, "published"), eq(articles.isFeatured, true))).orderBy(desc(articles.publishedAt)).limit(3);
  return hydrateArticles(rows.map((article) => article.id));
}

export async function getPublishedArticleBySlug(slug: string) {
  const article = await findArticleBySlug(slug);
  if (!article || article.status !== "published") return null;
  return getArticleWithContent(article.id);
}

export async function listArticlesInCategory(slug: string) {
  const db = await requireDb();
  const rows = await db.select({ id: articles.id })
    .from(articles)
    .innerJoin(articleCategories, eq(articles.id, articleCategories.articleId))
    .innerJoin(categories, eq(articleCategories.categoryId, categories.id))
    .where(and(eq(categories.slug, slug), eq(articles.status, "published")))
    .orderBy(desc(articles.publishedAt));
  return hydrateArticles(rows.map((article) => article.id));
}

export async function searchPublishedArticles(query: string) {
  const db = await requireDb();
  const phrase = query.trim();
  if (phrase.length < 2) return [];
  // Text columns use utf8mb4_bin (case-sensitive) collation, so a plain LIKE
  // would only match "Passat" and never "passat". Lowering both sides makes
  // the match case-insensitive regardless of column collation.
  const pattern = `%${phrase.toLowerCase()}%`;
  const rows = await db.select({ id: articles.id })
    .from(articles)
    .leftJoin(articleCategories, eq(articles.id, articleCategories.articleId))
    .leftJoin(categories, eq(articleCategories.categoryId, categories.id))
    .where(and(
      eq(articles.status, "published"),
      or(
        sql`LOWER(${articles.title}) LIKE ${pattern}`,
        sql`LOWER(${articles.deck}) LIKE ${pattern}`,
        sql`LOWER(${articles.authorName}) LIKE ${pattern}`,
        sql`LOWER(${categories.name}) LIKE ${pattern}`,
      ),
    ))
    .orderBy(desc(articles.publishedAt), desc(articles.createdAt));
  return hydrateArticles(Array.from(new Set(rows.map((article) => article.id))).slice(0, 24));
}

export async function listArticlesForManager(userId: number, isAdmin: boolean) {
  const db = await requireDb();
  const rows = isAdmin
    ? await db.select().from(articles).orderBy(desc(articles.updatedAt))
    : await db.select().from(articles).where(eq(articles.authorId, userId)).orderBy(desc(articles.updatedAt));
  return hydrateArticles(rows.map((article) => article.id));
}

export async function createArticle(input: { title: string; slug: string; authorId: number; authorName: string }) {
  const db = await requireDb();
  await db.insert(articles).values(input);
  const [created] = await db.select().from(articles).where(eq(articles.slug, input.slug)).limit(1);
  return created ? getArticleWithContent(created.id) : null;
}

export async function updateArticleMetadata(input: { id: number; title: string; articleTitle: string | null; slug: string; deck: string | null; authorName: string; coverImageUrl: string | null; coverImageCaption: string | null; seoTitle: string | null; seoDescription: string | null; socialImageUrl: string | null; isFeatured: boolean }) {
  const db = await requireDb();
  await db.update(articles).set({
    title: input.title,
    articleTitle: input.articleTitle,
    slug: input.slug,
    deck: input.deck,
    authorName: input.authorName,
    coverImageUrl: input.coverImageUrl,
    coverImageCaption: input.coverImageCaption,
    seoTitle: input.seoTitle,
    seoDescription: input.seoDescription,
    socialImageUrl: input.socialImageUrl,
    isFeatured: input.isFeatured,
  }).where(eq(articles.id, input.id));
}

export async function replaceArticleSections(articleId: number, sectionRows: SectionInput[]) {
  const db = await requireDb();
  await db.delete(articleSections).where(eq(articleSections.articleId, articleId));
  if (sectionRows.length) {
    await db.insert(articleSections).values(sectionRows.map((section) => ({
      articleId,
      type: section.type,
      heading: section.heading ?? null,
      body: section.body ?? null,
      caption: section.caption ?? null,
      position: section.position,
    })));
  }
}

export async function replaceArticleImages(articleId: number, imageRows: ImageInput[]) {
  const db = await requireDb();
  await db.delete(articleImages).where(eq(articleImages.articleId, articleId));
  if (imageRows.length) {
    await db.insert(articleImages).values(imageRows.map((image) => ({
      articleId,
      url: image.url,
      storageKey: image.storageKey ?? null,
      altText: image.altText ?? null,
      caption: image.caption ?? null,
      position: image.position,
    })));
  }
}

export async function setArticleCategories(articleId: number, categoryIds: number[]) {
  const db = await requireDb();
  await db.delete(articleCategories).where(eq(articleCategories.articleId, articleId));
  if (categoryIds.length) {
    await db.insert(articleCategories).values(categoryIds.map((categoryId) => ({ articleId, categoryId })));
  }
}

export async function setArticleStatus(articleId: number, status: "draft" | "published") {
  const db = await requireDb();
  await db.update(articles).set({
    status,
    publishedAt: status === "published" ? new Date() : null,
  }).where(eq(articles.id, articleId));
}

export async function deleteArticle(articleId: number) {
  const db = await requireDb();
  await db.delete(articles).where(eq(articles.id, articleId));
}

export async function listSiteGalleryImages() {
  const db = await requireDb();
  return db.select().from(siteGalleryImages).orderBy(asc(siteGalleryImages.position));
}

export async function replaceSiteGalleryImages(imageRows: ImageInput[]) {
  const db = await requireDb();
  await db.delete(siteGalleryImages);
  if (imageRows.length) {
    await db.insert(siteGalleryImages).values(imageRows.map((image) => ({
      url: image.url,
      storageKey: image.storageKey ?? null,
      altText: image.altText ?? null,
      caption: image.caption ?? null,
      position: image.position,
    })));
  }
}

const DEFAULT_SITE_SETTINGS = {
  homeKicker: "Revista independente / N.º 01",
  homeHeadline: "Automóveis para ler, não apenas medir.",
  homeSubtitle: "Ensaios, cultura e design automóvel com tempo para a imagem, a forma e a ideia.",
};

// Single row (id 1) — falls back to the shipped defaults if it's ever
// missing rather than erroring, so the homepage never renders blank.
export async function getSiteSettings() {
  const db = await requireDb();
  const [row] = await db.select().from(siteSettings).where(eq(siteSettings.id, 1)).limit(1);
  return {
    homeKicker: row?.homeKicker ?? DEFAULT_SITE_SETTINGS.homeKicker,
    homeHeadline: row?.homeHeadline ?? DEFAULT_SITE_SETTINGS.homeHeadline,
    homeSubtitle: row?.homeSubtitle ?? DEFAULT_SITE_SETTINGS.homeSubtitle,
  };
}

export async function updateSiteSettings(input: { homeKicker: string | null; homeHeadline: string | null; homeSubtitle: string | null }) {
  const db = await requireDb();
  await db.insert(siteSettings).values({ id: 1, ...input }).onDuplicateKeyUpdate({ set: input });
  return getSiteSettings();
}

export async function listMagazineIssues() {
  const db = await requireDb();
  return db.select().from(magazineIssues).orderBy(desc(magazineIssues.createdAt));
}

export async function getMagazineIssue(id: number) {
  const db = await requireDb();
  const [issue] = await db.select().from(magazineIssues).where(eq(magazineIssues.id, id)).limit(1);
  return issue ?? null;
}

export async function createMagazineIssue(input: {
  title: string;
  description: string | null;
  pdfUrl: string;
  pdfStorageKey: string | null;
  coverImageUrl: string | null;
  coverImageStorageKey: string | null;
}) {
  const db = await requireDb();
  const [result] = await db.insert(magazineIssues).values(input).$returningId();
  return getMagazineIssue(result.id);
}

export async function deleteMagazineIssue(id: number) {
  const db = await requireDb();
  await db.delete(magazineIssues).where(eq(magazineIssues.id, id));
}
