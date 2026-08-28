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

/**
 * Mints a session cookie for openId and sets it on the response. Looks up
 * the account's current passwordChangedAt to embed as the session's "pwv"
 * claim — every session, however it was created, has to carry the account's
 * current password version once one is set (see sdk.authenticateRequest).
 */
export async function mintSessionCookie(req: Request, res: Response, openId: string, name: string) {
  const user = await db.getUserByOpenId(openId);
  const sessionToken = await sdk.createSessionToken(openId, {
    name,
    expiresInMs: ONE_YEAR_MS,
    pwv: user?.passwordChangedAt?.getTime(),
  });
  const cookieOptions = getSessionCookieOptions(req);
  res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
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

      await mintSessionCookie(req, res, userInfo.openId, userInfo.name || "");
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });

  // Local-dev-only shortcut: the real Manus OAuth flow can't complete against
  // http://localhost (redirect URI isn't registered there). Never reachable
  // once NODE_ENV=production, so it can't leak into a real deployment.
  //
  // ?role=user logs in as a synthetic non-admin account instead of the site
  // owner — used by the Playwright suite to verify admin-only guards actually
  // reject a real authenticated-but-not-admin session, not just "no session".
  if (!ENV.isProduction) {
    app.get("/api/dev/login", async (req: Request, res: Response) => {
      const asTestUser = req.query.role === "user";
      const openId = asTestUser ? "dev-test-user" : ENV.ownerOpenId;
      const name = asTestUser ? "Utilizador de Teste" : "Pedro Félix";

      if (!openId) {
        res.status(500).json({ error: "OWNER_OPEN_ID not configured" });
        return;
      }

      try {
        await db.upsertUser({ openId, name, lastSignedIn: new Date() });
        await mintSessionCookie(req, res, openId, name);
        res.redirect(302, asTestUser ? "/" : "/redacao");
      } catch (error) {
        console.error("[Dev login] Failed", error);
        res.status(500).json({ error: "Dev login failed" });
      }
    });
  }
}
