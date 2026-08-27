import { COOKIE_NAME, ONE_YEAR_MS, OAUTH_STATE_COOKIE, decodeOAuthState } from "../../shared/const";
import { parse as parseCookieHeader } from "cookie";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";
import { sdk } from "./sdk";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    // CSRF guard: the nonce in `state` must match the one-time cookie that
    // startLogin set in the browser that began this login. An attacker can
    // forge `state`, but cannot plant this cookie in the victim's browser.
    const { nonce } = decodeOAuthState(state);
    const expectedNonce = parseCookieHeader(req.headers.cookie ?? "")[OAUTH_STATE_COOKIE];
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

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });

  // Local-dev-only shortcut: the real Manus OAuth flow can't complete against
  // http://localhost (redirect URI isn't registered there). Never reachable
  // once NODE_ENV=production, so it can't leak into a real deployment.
  if (!ENV.isProduction) {
    app.get("/api/dev/login", async (req: Request, res: Response) => {
      if (!ENV.ownerOpenId) {
        res.status(500).json({ error: "OWNER_OPEN_ID not configured" });
        return;
      }

      try {
        await db.upsertUser({
          openId: ENV.ownerOpenId,
          name: "Pedro Félix",
          lastSignedIn: new Date(),
        });

        const sessionToken = await sdk.createSessionToken(ENV.ownerOpenId, {
          name: "Pedro Félix",
          expiresInMs: ONE_YEAR_MS,
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

  // Manual admin entry point for deployments (e.g. Vercel) where the real
  // Manus OAuth redirect URI isn't registered. Only works when ADMIN_ACCESS_TOKEN
  // is set and the caller supplies the exact same value as ?token= — without
  // that env var configured, this route always rejects, so it's inert unless
  // the owner deliberately opts in.
  app.get("/api/admin-login", async (req: Request, res: Response) => {
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
      await db.upsertUser({
        openId: ENV.ownerOpenId,
        name: "Pedro Félix",
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(ENV.ownerOpenId, {
        name: "Pedro Félix",
        expiresInMs: ONE_YEAR_MS,
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
