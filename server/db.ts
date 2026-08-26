import { and, asc, desc, eq, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { articleCategories, articleImages, articles, articleSections, categories, InsertUser, users } from "../drizzle/schema";
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

type SectionInput = {
  type: "paragraph" | "chapter" | "quote";
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

export async function createCategory(input: { name: string; slug: string; description: string | null }) {
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

export async function getArticleWithContent(id: number) {
  const db = await requireDb();
  const article = await findArticleById(id);
  if (!article) return null;

  const [sectionRows, imageRows, categoryRows] = await Promise.all([
    db.select().from(articleSections).where(eq(articleSections.articleId, id)).orderBy(asc(articleSections.position)),
    db.select().from(articleImages).where(eq(articleImages.articleId, id)).orderBy(asc(articleImages.position)),
    db.select({ id: categories.id, name: categories.name, slug: categories.slug, description: categories.description })
      .from(articleCategories)
      .innerJoin(categories, eq(articleCategories.categoryId, categories.id))
      .where(eq(articleCategories.articleId, id))
      .orderBy(asc(categories.name)),
  ]);

  return { ...article, sections: sectionRows, images: imageRows, categories: categoryRows };
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
  const pattern = `%${phrase}%`;
  const rows = await db.select({ id: articles.id })
    .from(articles)
    .leftJoin(articleCategories, eq(articles.id, articleCategories.articleId))
    .leftJoin(categories, eq(articleCategories.categoryId, categories.id))
    .where(and(
      eq(articles.status, "published"),
      or(
        like(articles.title, pattern),
        like(articles.deck, pattern),
        like(articles.authorName, pattern),
        like(categories.name, pattern),
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

export async function updateArticleMetadata(input: { id: number; title: string; slug: string; deck: string | null; authorName: string; coverImageUrl: string | null; coverImageCaption: string | null; seoTitle: string | null; seoDescription: string | null; socialImageUrl: string | null; isFeatured: boolean }) {
  const db = await requireDb();
  await db.update(articles).set({
    title: input.title,
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
