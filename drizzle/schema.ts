import { boolean, index, int, mysqlEnum, mysqlTable, primaryKey, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const categories = mysqlTable("categories", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 80 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const articles = mysqlTable("articles", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 220 }).notNull(),
  slug: varchar("slug", { length: 180 }).notNull().unique(),
  deck: text("deck"),
  status: mysqlEnum("status", ["draft", "published"]).default("draft").notNull(),
  authorId: int("authorId").references(() => users.id, { onDelete: "set null" }),
  authorName: varchar("authorName", { length: 120 }).notNull(),
  coverImageUrl: text("coverImageUrl"),
  coverImageCaption: text("coverImageCaption"),
  seoTitle: varchar("seoTitle", { length: 70 }),
  seoDescription: varchar("seoDescription", { length: 200 }),
  socialImageUrl: text("socialImageUrl"),
  isFeatured: boolean("isFeatured").default(false).notNull(),
  publishedAt: timestamp("publishedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("articles_status_published_idx").on(table.status, table.publishedAt),
  index("articles_author_idx").on(table.authorId),
]);

export const articleSections = mysqlTable("articleSections", {
  id: int("id").autoincrement().primaryKey(),
  articleId: int("articleId").notNull().references(() => articles.id, { onDelete: "cascade" }),
  type: mysqlEnum("type", ["paragraph", "chapter", "quote"]).notNull(),
  heading: varchar("heading", { length: 220 }),
  body: text("body"),
  caption: text("caption"),
  position: int("position").notNull(),
}, (table) => [index("article_sections_position_idx").on(table.articleId, table.position)]);

export const articleImages = mysqlTable("articleImages", {
  id: int("id").autoincrement().primaryKey(),
  articleId: int("articleId").notNull().references(() => articles.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  storageKey: varchar("storageKey", { length: 600 }),
  altText: varchar("altText", { length: 250 }),
  caption: text("caption"),
  position: int("position").notNull(),
}, (table) => [index("article_images_position_idx").on(table.articleId, table.position)]);

export const siteGalleryImages = mysqlTable("siteGalleryImages", {
  id: int("id").autoincrement().primaryKey(),
  url: text("url").notNull(),
  storageKey: varchar("storageKey", { length: 600 }),
  altText: varchar("altText", { length: 250 }),
  caption: text("caption"),
  position: int("position").notNull(),
}, (table) => [index("site_gallery_position_idx").on(table.position)]);

export const articleCategories = mysqlTable("articleCategories", {
  articleId: int("articleId").notNull().references(() => articles.id, { onDelete: "cascade" }),
  categoryId: int("categoryId").notNull().references(() => categories.id, { onDelete: "cascade" }),
}, (table) => [
  primaryKey({ columns: [table.articleId, table.categoryId] }),
  uniqueIndex("article_category_unique").on(table.articleId, table.categoryId),
]);

export type Category = typeof categories.$inferSelect;
export type Article = typeof articles.$inferSelect;
