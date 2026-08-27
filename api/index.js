// server/_core/vercel.ts
import "dotenv/config";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";
var OAUTH_STATE_COOKIE = "__Host-oauth_state";
var decodeOAuthState = (state) => {
  let decoded;
  try {
    decoded = atob(state);
  } catch {
    return { redirectUri: "" };
  }
  try {
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed.redirectUri === "string") return parsed;
  } catch {
  }
  return { redirectUri: decoded };
};

// server/_core/oauth.ts
import { parse as parseCookieHeader2 } from "cookie";

// server/db.ts
import { and, asc, desc, eq, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";

// drizzle/schema.ts
import { boolean, index, int, mysqlEnum, mysqlTable, primaryKey, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";
var users = mysqlTable("users", {
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
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
});
var categories = mysqlTable("categories", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 80 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  description: text("description"),
  kind: mysqlEnum("kind", ["tipo", "marca"]).default("tipo").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var articles = mysqlTable("articles", {
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
}, (table) => [
  index("articles_status_published_idx").on(table.status, table.publishedAt),
  index("articles_author_idx").on(table.authorId)
]);
var articleSections = mysqlTable("articleSections", {
  id: int("id").autoincrement().primaryKey(),
  articleId: int("articleId").notNull().references(() => articles.id, { onDelete: "cascade" }),
  type: mysqlEnum("type", ["paragraph", "chapter", "quote"]).notNull(),
  heading: varchar("heading", { length: 220 }),
  body: text("body"),
  caption: text("caption"),
  position: int("position").notNull()
}, (table) => [index("article_sections_position_idx").on(table.articleId, table.position)]);
var articleImages = mysqlTable("articleImages", {
  id: int("id").autoincrement().primaryKey(),
  articleId: int("articleId").notNull().references(() => articles.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  storageKey: varchar("storageKey", { length: 600 }),
  altText: varchar("altText", { length: 250 }),
  caption: text("caption"),
  position: int("position").notNull()
}, (table) => [index("article_images_position_idx").on(table.articleId, table.position)]);
var siteGalleryImages = mysqlTable("siteGalleryImages", {
  id: int("id").autoincrement().primaryKey(),
  url: text("url").notNull(),
  storageKey: varchar("storageKey", { length: 600 }),
  altText: varchar("altText", { length: 250 }),
  caption: text("caption"),
  position: int("position").notNull()
}, (table) => [index("site_gallery_position_idx").on(table.position)]);
var articleCategories = mysqlTable("articleCategories", {
  articleId: int("articleId").notNull().references(() => articles.id, { onDelete: "cascade" }),
  categoryId: int("categoryId").notNull().references(() => categories.id, { onDelete: "cascade" })
}, (table) => [
  primaryKey({ columns: [table.articleId, table.categoryId] }),
  uniqueIndex("article_category_unique").on(table.articleId, table.categoryId)
]);

// server/_core/env.ts
var ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  adminAccessToken: process.env.ADMIN_ACCESS_TOKEN ?? ""
};

// server/db.ts
var _db = null;
async function getDb() {
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
async function upsertUser(user) {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values = {
      openId: user.openId
    };
    const updateSet = {};
    const textFields = ["name", "email", "loginMethod"];
    const assignNullable = (field) => {
      const value = user[field];
      if (value === void 0) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== void 0) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== void 0) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) {
      values.lastSignedIn = /* @__PURE__ */ new Date();
    }
    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = /* @__PURE__ */ new Date();
    }
    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return void 0;
  }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("A base de dados editorial n\xE3o est\xE1 dispon\xEDvel.");
  return db;
}
async function listCategories() {
  const db = await requireDb();
  return db.select().from(categories).orderBy(asc(categories.name));
}
async function createCategory(input) {
  const db = await requireDb();
  await db.insert(categories).values(input);
  const [created] = await db.select().from(categories).where(eq(categories.slug, input.slug)).limit(1);
  return created;
}
async function findArticleById(id) {
  const db = await requireDb();
  const [article] = await db.select().from(articles).where(eq(articles.id, id)).limit(1);
  return article;
}
async function findArticleBySlug(slug) {
  const db = await requireDb();
  const [article] = await db.select().from(articles).where(eq(articles.slug, slug)).limit(1);
  return article;
}
async function findArticleByTitle(title, ignoreId) {
  const db = await requireDb();
  const conditions = [sql`LOWER(TRIM(${articles.title})) = LOWER(TRIM(${title.trim()}))`];
  if (ignoreId !== void 0) conditions.push(sql`${articles.id} <> ${ignoreId}`);
  const [article] = await db.select().from(articles).where(and(...conditions)).limit(1);
  return article;
}
async function getArticleWithContent(id) {
  const db = await requireDb();
  const article = await findArticleById(id);
  if (!article) return null;
  const [sectionRows, imageRows, categoryRows] = await Promise.all([
    db.select().from(articleSections).where(eq(articleSections.articleId, id)).orderBy(asc(articleSections.position)),
    db.select().from(articleImages).where(eq(articleImages.articleId, id)).orderBy(asc(articleImages.position)),
    db.select({ id: categories.id, name: categories.name, slug: categories.slug, description: categories.description, kind: categories.kind }).from(articleCategories).innerJoin(categories, eq(articleCategories.categoryId, categories.id)).where(eq(articleCategories.articleId, id)).orderBy(sql`CASE WHEN ${categories.kind} = 'marca' THEN 0 ELSE 1 END`, asc(categories.name))
  ]);
  return { ...article, sections: sectionRows, images: imageRows, categories: categoryRows };
}
async function hydrateArticles(ids) {
  const hydrated = await Promise.all(ids.map((id) => getArticleWithContent(id)));
  return hydrated.filter((article) => article !== null);
}
async function listLatestArticles(limit) {
  const db = await requireDb();
  const rows = await db.select().from(articles).where(eq(articles.status, "published")).orderBy(desc(articles.publishedAt), desc(articles.createdAt)).limit(limit);
  return hydrateArticles(rows.map((article) => article.id));
}
async function listFeaturedArticles() {
  const db = await requireDb();
  const rows = await db.select().from(articles).where(and(eq(articles.status, "published"), eq(articles.isFeatured, true))).orderBy(desc(articles.publishedAt)).limit(3);
  return hydrateArticles(rows.map((article) => article.id));
}
async function getPublishedArticleBySlug(slug) {
  const article = await findArticleBySlug(slug);
  if (!article || article.status !== "published") return null;
  return getArticleWithContent(article.id);
}
async function listArticlesInCategory(slug) {
  const db = await requireDb();
  const rows = await db.select({ id: articles.id }).from(articles).innerJoin(articleCategories, eq(articles.id, articleCategories.articleId)).innerJoin(categories, eq(articleCategories.categoryId, categories.id)).where(and(eq(categories.slug, slug), eq(articles.status, "published"))).orderBy(desc(articles.publishedAt));
  return hydrateArticles(rows.map((article) => article.id));
}
async function searchPublishedArticles(query) {
  const db = await requireDb();
  const phrase = query.trim();
  if (phrase.length < 2) return [];
  const pattern = `%${phrase}%`;
  const rows = await db.select({ id: articles.id }).from(articles).leftJoin(articleCategories, eq(articles.id, articleCategories.articleId)).leftJoin(categories, eq(articleCategories.categoryId, categories.id)).where(and(
    eq(articles.status, "published"),
    or(
      like(articles.title, pattern),
      like(articles.deck, pattern),
      like(articles.authorName, pattern),
      like(categories.name, pattern)
    )
  )).orderBy(desc(articles.publishedAt), desc(articles.createdAt));
  return hydrateArticles(Array.from(new Set(rows.map((article) => article.id))).slice(0, 24));
}
async function listArticlesForManager(userId, isAdmin) {
  const db = await requireDb();
  const rows = isAdmin ? await db.select().from(articles).orderBy(desc(articles.updatedAt)) : await db.select().from(articles).where(eq(articles.authorId, userId)).orderBy(desc(articles.updatedAt));
  return hydrateArticles(rows.map((article) => article.id));
}
async function createArticle(input) {
  const db = await requireDb();
  await db.insert(articles).values(input);
  const [created] = await db.select().from(articles).where(eq(articles.slug, input.slug)).limit(1);
  return created ? getArticleWithContent(created.id) : null;
}
async function updateArticleMetadata(input) {
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
    isFeatured: input.isFeatured
  }).where(eq(articles.id, input.id));
}
async function replaceArticleSections(articleId, sectionRows) {
  const db = await requireDb();
  await db.delete(articleSections).where(eq(articleSections.articleId, articleId));
  if (sectionRows.length) {
    await db.insert(articleSections).values(sectionRows.map((section) => ({
      articleId,
      type: section.type,
      heading: section.heading ?? null,
      body: section.body ?? null,
      caption: section.caption ?? null,
      position: section.position
    })));
  }
}
async function replaceArticleImages(articleId, imageRows) {
  const db = await requireDb();
  await db.delete(articleImages).where(eq(articleImages.articleId, articleId));
  if (imageRows.length) {
    await db.insert(articleImages).values(imageRows.map((image) => ({
      articleId,
      url: image.url,
      storageKey: image.storageKey ?? null,
      altText: image.altText ?? null,
      caption: image.caption ?? null,
      position: image.position
    })));
  }
}
async function setArticleCategories(articleId, categoryIds) {
  const db = await requireDb();
  await db.delete(articleCategories).where(eq(articleCategories.articleId, articleId));
  if (categoryIds.length) {
    await db.insert(articleCategories).values(categoryIds.map((categoryId) => ({ articleId, categoryId })));
  }
}
async function setArticleStatus(articleId, status) {
  const db = await requireDb();
  await db.update(articles).set({
    status,
    publishedAt: status === "published" ? /* @__PURE__ */ new Date() : null
  }).where(eq(articles.id, articleId));
}
async function deleteArticle(articleId) {
  const db = await requireDb();
  await db.delete(articles).where(eq(articles.id, articleId));
}
async function listSiteGalleryImages() {
  const db = await requireDb();
  return db.select().from(siteGalleryImages).orderBy(asc(siteGalleryImages.position));
}
async function replaceSiteGalleryImages(imageRows) {
  const db = await requireDb();
  await db.delete(siteGalleryImages);
  if (imageRows.length) {
    await db.insert(siteGalleryImages).values(imageRows.map((image) => ({
      url: image.url,
      storageKey: image.storageKey ?? null,
      altText: image.altText ?? null,
      caption: image.caption ?? null,
      position: image.position
    })));
  }
}

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  const secure = isSecureRequest(req);
  return {
    httpOnly: true,
    path: "/",
    sameSite: secure ? "none" : "lax",
    secure
  };
}

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }
  decodeState(state) {
    return decodeOAuthState(state).redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    let sessionToken = cookies.get(COOKIE_NAME);
    if (!sessionToken) {
      const authHeader = req.headers.authorization;
      if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        sessionToken = authHeader.slice(7);
      }
    }
    const session = await this.verifySession(sessionToken);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    if (session.openId.startsWith(CRON_OPEN_ID_PREFIX)) {
      const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
      const taskUid = userInfo.taskUid ?? null;
      if (!taskUid) {
        throw ForbiddenError("Cron session missing task_uid");
      }
      return buildCronUser(userInfo);
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUserByOpenId(sessionUserId);
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
        await upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user = await getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt
    });
    return user;
  }
};
var CRON_OPEN_ID_PREFIX = "cron_";
function buildCronUser(userInfo) {
  const now = /* @__PURE__ */ new Date();
  return {
    id: -1,
    openId: userInfo.openId,
    name: userInfo.name || "Manus Scheduled Task",
    email: null,
    loginMethod: null,
    role: "user",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
    taskUid: userInfo.taskUid ?? void 0,
    isCron: true
  };
}
var sdk = new SDKServer();

// server/_core/oauth.ts
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function registerOAuthRoutes(app2) {
  app2.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    const { nonce } = decodeOAuthState(state);
    const expectedNonce = parseCookieHeader2(req.headers.cookie ?? "")[OAUTH_STATE_COOKIE];
    if (!nonce || nonce !== expectedNonce) {
      res.status(403).json({ error: "invalid oauth state" });
      return;
    }
    res.clearCookie(OAUTH_STATE_COOKIE, { path: "/", secure: true, sameSite: "none" });
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      await upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
  if (!ENV.isProduction) {
    app2.get("/api/dev/login", async (req, res) => {
      if (!ENV.ownerOpenId) {
        res.status(500).json({ error: "OWNER_OPEN_ID not configured" });
        return;
      }
      try {
        await upsertUser({
          openId: ENV.ownerOpenId,
          name: "Pedro F\xE9lix",
          lastSignedIn: /* @__PURE__ */ new Date()
        });
        const sessionToken = await sdk.createSessionToken(ENV.ownerOpenId, {
          name: "Pedro F\xE9lix",
          expiresInMs: ONE_YEAR_MS
        });
        const cookieOptions = getSessionCookieOptions(req);
        res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
        res.redirect(302, "/redacao");
      } catch (error) {
        console.error("[Dev login] Failed", error);
        res.status(500).json({ error: "Dev login failed" });
      }
    });
  }
  app2.get("/api/admin-login", async (req, res) => {
    const token = getQueryParam(req, "token");
    if (!ENV.adminAccessToken || !token || token !== ENV.adminAccessToken) {
      res.status(403).send("Forbidden");
      return;
    }
    if (!ENV.ownerOpenId) {
      res.status(500).json({ error: "OWNER_OPEN_ID not configured" });
      return;
    }
    try {
      await upsertUser({
        openId: ENV.ownerOpenId,
        name: "Pedro F\xE9lix",
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(ENV.ownerOpenId, {
        name: "Pedro F\xE9lix",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/redacao");
    } catch (error) {
      console.error("[Admin login] Failed", error);
      res.status(500).json({ error: "Admin login failed" });
    }
  });
}

// server/_core/storageProxy.ts
function registerStorageProxy(app2) {
  app2.get("/manus-storage/*", async (req, res) => {
    const key = req.params[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }
    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }
    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/"
      );
      forgeUrl.searchParams.set("path", key);
      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` }
      });
      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }
      const { url } = await forgeResp.json();
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }
      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
import { TRPCError } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString2(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString2(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/routers/editorial.ts
import { TRPCError as TRPCError3 } from "@trpc/server";
import { z as z2 } from "zod";

// server/storage.ts
function getForgeConfig() {
  const forgeUrl = ENV.forgeApiUrl;
  const forgeKey = ENV.forgeApiKey;
  if (!forgeUrl || !forgeKey) {
    throw new Error(
      "Storage config missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY"
    );
  }
  return { forgeUrl: forgeUrl.replace(/\/+$/, ""), forgeKey };
}
function normalizeKey(relKey) {
  return relKey.replace(/^\/+/, "");
}
function appendHashSuffix(relKey) {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}
async function storagePut(relKey, data, contentType = "application/octet-stream") {
  const { forgeUrl, forgeKey } = getForgeConfig();
  const key = appendHashSuffix(normalizeKey(relKey));
  const presignUrl = new URL("v1/storage/presign/put", forgeUrl + "/");
  presignUrl.searchParams.set("path", key);
  const presignResp = await fetch(presignUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` }
  });
  if (!presignResp.ok) {
    const msg = await presignResp.text().catch(() => presignResp.statusText);
    throw new Error(`Storage presign failed (${presignResp.status}): ${msg}`);
  }
  const { url: s3Url } = await presignResp.json();
  if (!s3Url) throw new Error("Forge returned empty presign URL");
  const blob = typeof data === "string" ? new Blob([data], { type: contentType }) : new Blob([data], { type: contentType });
  const uploadResp = await fetch(s3Url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob
  });
  if (!uploadResp.ok) {
    throw new Error(`Storage upload to S3 failed (${uploadResp.status})`);
  }
  return { key, url: `/manus-storage/${key}` };
}

// shared/editorial.ts
function toEditorialSlug(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 170);
}
function canManageEditorialArticle(user, authorId) {
  return user.role === "admin" || user.id === authorId;
}

// server/routers/editorial.ts
var sectionInput = z2.object({
  type: z2.enum(["paragraph", "chapter", "quote"]),
  heading: z2.string().max(220).nullable().optional(),
  body: z2.string().max(2e4).nullable().optional(),
  caption: z2.string().max(500).nullable().optional(),
  position: z2.number().int().min(0)
});
var imageInput = z2.object({
  url: z2.string().min(1).max(2e3),
  storageKey: z2.string().max(600).nullable().optional(),
  altText: z2.string().max(250).nullable().optional(),
  caption: z2.string().max(600).nullable().optional(),
  position: z2.number().int().min(0).max(9)
});
var metadataInput = z2.object({
  id: z2.number().int().positive(),
  title: z2.string().min(3).max(220),
  slug: z2.string().min(3).max(180),
  deck: z2.string().max(700).nullable(),
  authorName: z2.string().min(2).max(120),
  coverImageUrl: z2.string().max(2e3).nullable(),
  coverImageCaption: z2.string().max(600).nullable(),
  seoTitle: z2.string().max(70).nullable(),
  seoDescription: z2.string().max(200).nullable(),
  socialImageUrl: z2.string().max(2e3).nullable(),
  isFeatured: z2.boolean()
});
async function assertCanManageArticle(ctx, articleId) {
  const article = await findArticleById(articleId);
  if (!article) {
    throw new TRPCError3({ code: "NOT_FOUND", message: "Artigo n\xE3o encontrado." });
  }
  if (!canManageEditorialArticle(ctx.user, article.authorId)) {
    throw new TRPCError3({ code: "FORBIDDEN", message: "N\xE3o tem permiss\xE3o para editar este artigo." });
  }
  return article;
}
async function uniqueArticleSlug(value, ignoreId) {
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
var editorialRouter = router({
  categories: publicProcedure.query(() => listCategories()),
  featured: publicProcedure.query(() => listFeaturedArticles()),
  latest: publicProcedure.input(z2.object({ limit: z2.number().int().min(1).max(24).default(9) }).optional()).query(({ input }) => listLatestArticles(input?.limit ?? 9)),
  all: publicProcedure.query(() => listLatestArticles(500)),
  bySlug: publicProcedure.input(z2.object({ slug: z2.string().min(1).max(180) })).query(({ input }) => getPublishedArticleBySlug(input.slug)),
  byCategory: publicProcedure.input(z2.object({ slug: z2.string().min(1).max(100) })).query(({ input }) => listArticlesInCategory(input.slug)),
  search: publicProcedure.input(z2.object({ query: z2.string().min(2).max(100) })).query(({ input }) => searchPublishedArticles(input.query)),
  manage: router({
    list: protectedProcedure.query(({ ctx }) => listArticlesForManager(ctx.user.id, ctx.user.role === "admin")),
    detail: protectedProcedure.input(z2.object({ id: z2.number().int().positive() })).query(async ({ ctx, input }) => {
      await assertCanManageArticle(ctx, input.id);
      return getArticleWithContent(input.id);
    }),
    create: protectedProcedure.input(z2.object({ title: z2.string().min(3).max(220) })).mutation(async ({ ctx, input }) => {
      const duplicate = await findArticleByTitle(input.title);
      if (duplicate) {
        throw new TRPCError3({ code: "CONFLICT", message: "J\xE1 existe um artigo com este t\xEDtulo. Escolha outro nome." });
      }
      const slug = await uniqueArticleSlug(input.title);
      return createArticle({ title: input.title, slug, authorId: ctx.user.id, authorName: ctx.user.name ?? "Autor Motor de Linha" });
    }),
    saveMetadata: protectedProcedure.input(metadataInput).mutation(async ({ ctx, input }) => {
      await assertCanManageArticle(ctx, input.id);
      const duplicate = await findArticleByTitle(input.title, input.id);
      if (duplicate) {
        throw new TRPCError3({ code: "CONFLICT", message: "J\xE1 existe um artigo com este t\xEDtulo. Escolha outro nome." });
      }
      const slug = await uniqueArticleSlug(input.slug || input.title, input.id);
      await updateArticleMetadata({ ...input, slug });
      return getArticleWithContent(input.id);
    }),
    saveSections: protectedProcedure.input(z2.object({ id: z2.number().int().positive(), sections: z2.array(sectionInput).max(60) })).mutation(async ({ ctx, input }) => {
      await assertCanManageArticle(ctx, input.id);
      await replaceArticleSections(input.id, input.sections);
      return getArticleWithContent(input.id);
    }),
    saveImages: protectedProcedure.input(z2.object({ id: z2.number().int().positive(), images: z2.array(imageInput).max(10) })).mutation(async ({ ctx, input }) => {
      await assertCanManageArticle(ctx, input.id);
      await replaceArticleImages(input.id, input.images);
      return getArticleWithContent(input.id);
    }),
    saveCategories: protectedProcedure.input(z2.object({ id: z2.number().int().positive(), categoryIds: z2.array(z2.number().int().positive()).max(6) })).mutation(async ({ ctx, input }) => {
      await assertCanManageArticle(ctx, input.id);
      await setArticleCategories(input.id, input.categoryIds);
      return getArticleWithContent(input.id);
    }),
    publish: protectedProcedure.input(z2.object({ id: z2.number().int().positive(), published: z2.boolean() })).mutation(async ({ ctx, input }) => {
      await assertCanManageArticle(ctx, input.id);
      await setArticleStatus(input.id, input.published ? "published" : "draft");
      return getArticleWithContent(input.id);
    }),
    deleteDraft: protectedProcedure.input(z2.object({ id: z2.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const article = await assertCanManageArticle(ctx, input.id);
      if (article.status !== "draft") {
        throw new TRPCError3({ code: "PRECONDITION_FAILED", message: "S\xF3 \xE9 poss\xEDvel apagar rascunhos." });
      }
      await deleteArticle(input.id);
      return { success: true, id: input.id };
    }),
    createCategory: protectedProcedure.input(z2.object({ name: z2.string().min(2).max(80), description: z2.string().max(240).nullable().optional(), kind: z2.enum(["tipo", "marca"]) })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError3({ code: "FORBIDDEN", message: "Apenas administradores podem criar categorias." });
      }
      const slug = toEditorialSlug(input.name);
      return createCategory({ name: input.name, slug, description: input.description ?? null, kind: input.kind });
    }),
    uploadImage: protectedProcedure.input(z2.object({ id: z2.number().int().positive(), dataUrl: z2.string().min(32).max(8e6), fileName: z2.string().min(1).max(180) })).mutation(async ({ ctx, input }) => {
      await assertCanManageArticle(ctx, input.id);
      const match = input.dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
      if (!match) {
        throw new TRPCError3({ code: "BAD_REQUEST", message: "Use uma imagem JPEG, PNG ou WebP v\xE1lida." });
      }
      const contentType = match[1];
      const bytes = Buffer.from(match[2], "base64");
      if (bytes.byteLength > 5e6) {
        throw new TRPCError3({ code: "PAYLOAD_TOO_LARGE", message: "Cada imagem deve ter no m\xE1ximo 5 MB ap\xF3s otimiza\xE7\xE3o." });
      }
      const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
      const asset = await storagePut(`editorial/${ctx.user.id}/${input.id}-${Date.now()}-${toEditorialSlug(input.fileName) || "imagem"}.${ext}`, bytes, contentType);
      return asset;
    })
  })
});

// server/routers/gallery.ts
import { TRPCError as TRPCError4 } from "@trpc/server";
import { z as z3 } from "zod";
var galleryImageInput = z3.object({
  url: z3.string().min(1).max(2e3),
  storageKey: z3.string().max(600).nullable().optional(),
  altText: z3.string().max(250).nullable().optional(),
  caption: z3.string().max(600).nullable().optional(),
  position: z3.number().int().min(0).max(99)
});
function assertCanManageGallery(ctx) {
  if (ctx.user.role !== "admin") {
    throw new TRPCError4({ code: "FORBIDDEN", message: "Apenas administradores podem gerir a galeria do site." });
  }
}
var galleryRouter = router({
  list: publicProcedure.query(() => listSiteGalleryImages()),
  manage: router({
    save: protectedProcedure.input(z3.object({ images: z3.array(galleryImageInput).max(100) })).mutation(async ({ ctx, input }) => {
      assertCanManageGallery(ctx);
      await replaceSiteGalleryImages(input.images);
      return listSiteGalleryImages();
    }),
    uploadImage: protectedProcedure.input(z3.object({ dataUrl: z3.string().min(32).max(8e6), fileName: z3.string().min(1).max(180) })).mutation(async ({ ctx, input }) => {
      assertCanManageGallery(ctx);
      const match = input.dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
      if (!match) {
        throw new TRPCError4({ code: "BAD_REQUEST", message: "Use uma imagem JPEG, PNG ou WebP v\xE1lida." });
      }
      const contentType = match[1];
      const bytes = Buffer.from(match[2], "base64");
      if (bytes.byteLength > 5e6) {
        throw new TRPCError4({ code: "PAYLOAD_TOO_LARGE", message: "Cada imagem deve ter no m\xE1ximo 5 MB ap\xF3s otimiza\xE7\xE3o." });
      }
      const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
      const asset = await storagePut(`gallery/${ctx.user.id}-${Date.now()}-${toEditorialSlug(input.fileName) || "imagem"}.${ext}`, bytes, contentType);
      return asset;
    })
  })
});

// server/routers.ts
var appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true
      };
    })
  }),
  editorial: editorialRouter,
  gallery: galleryRouter
});

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/_core/vercel.ts
var app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, hasDatabaseUrl: Boolean(process.env.DATABASE_URL), nodeEnv: process.env.NODE_ENV ?? null });
});
registerStorageProxy(app);
registerOAuthRoutes(app);
app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
app.use((err, _req, res, _next) => {
  console.error("[api] unhandled error:", err);
  res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
});
function handler(req, res) {
  app(req, res);
}
export {
  handler as default
};
