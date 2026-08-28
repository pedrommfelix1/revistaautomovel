import type { Express, Request, Response } from "express";
import * as db from "../db";
import { checkLimit, clearFailures, recordFailure } from "./rateLimit";
import { isSameOrigin } from "./csrf";
import { hashPassword, validatePassword, verifyPassword } from "./password";
import { mintSessionCookie } from "./oauth";
import { sdk } from "./sdk";

// Time floor on failed logins: without this, "account locked" (instant) and
// "wrong password" (~100ms of scrypt) would be distinguishable purely by
// response time, telling an attacker whether an account exists/is locked.
const FAILURE_FLOOR_MS = 400;

function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) return forwarded.split(",")[0].trim();
  return req.socket.remoteAddress ?? "unknown";
}

async function atLeast(startedAt: number, ms: number): Promise<void> {
  const remaining = ms - (Date.now() - startedAt);
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
}

function rateLimitResponse(res: Response, seconds: number) {
  res.set("Retry-After", String(seconds));
  res.status(429).json({ error: "Demasiadas tentativas. Tente novamente mais tarde.", retryAfter: seconds });
}

export function registerPasswordAuthRoutes(app: Express) {
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    if (!isSameOrigin(req)) { res.status(403).json({ error: "origem inválida" }); return; }

    const startedAt = Date.now();
    const ip = getClientIp(req);

    const ipLimit = await checkLimit("ip", ip);
    if (ipLimit.blocked) { rateLimitResponse(res, ipLimit.seconds); return; }

    const username = String((req.body as Record<string, unknown>)?.username ?? "").trim().toLowerCase();
    const password = String((req.body as Record<string, unknown>)?.password ?? "");
    if (!username || !password) { res.status(400).json({ error: "pedido inválido" }); return; }

    const user = await db.getUserByUsername(username);
    // Unknown usernames bucket separately from real accounts — otherwise
    // guessing random usernames would lock the real admin out of their own
    // account (the real account's bucket never even gets touched here).
    const accountBucket = user ? `user:${user.id}` : `unknown:${username}`;

    const accountLimit = await checkLimit("account", accountBucket);
    if (accountLimit.blocked) {
      await atLeast(startedAt, FAILURE_FLOOR_MS);
      rateLimitResponse(res, accountLimit.seconds);
      return;
    }

    // Always run verifyPassword, even with no user / no stored hash, so the
    // response time doesn't reveal whether the username exists.
    const passwordOk = await verifyPassword(password, user?.passwordHash ?? null);
    if (!user || !passwordOk) {
      await Promise.all([recordFailure("ip", ip), recordFailure("account", accountBucket)]);
      await atLeast(startedAt, FAILURE_FLOOR_MS);
      res.status(401).json({ error: "Credenciais inválidas." });
      return;
    }

    await Promise.all([clearFailures("ip", ip), clearFailures("account", accountBucket)]);
    await mintSessionCookie(req, res, user.openId, user.name ?? user.username ?? "");
    await db.recordLogin(user.id, ip);

    res.json({ ok: true, mustChangePassword: user.mustChangePassword });
  });

  app.post("/api/auth/password", async (req: Request, res: Response) => {
    if (!isSameOrigin(req)) { res.status(403).json({ error: "origem inválida" }); return; }

    let authUser;
    try {
      authUser = await sdk.authenticateRequest(req);
    } catch {
      res.status(401).json({ error: "sessão inválida" });
      return;
    }

    const current = String((req.body as Record<string, unknown>)?.current ?? "");
    const next = String((req.body as Record<string, unknown>)?.next ?? "");

    const accountBucket = `user:${authUser.id}`;
    const limit = await checkLimit("account", accountBucket);
    if (limit.blocked) { rateLimitResponse(res, limit.seconds); return; }

    if (!(await verifyPassword(current, authUser.passwordHash))) {
      await recordFailure("account", accountBucket);
      res.status(401).json({ error: "A palavra-passe atual está errada." });
      return;
    }

    const problem = validatePassword(next, { username: authUser.username, displayName: authUser.name });
    if (problem) { res.status(400).json({ error: problem }); return; }
    if (await verifyPassword(next, authUser.passwordHash)) {
      res.status(400).json({ error: "A nova palavra-passe tem de ser diferente da atual." });
      return;
    }

    await clearFailures("account", accountBucket);
    const passwordChangedAt = new Date();
    const passwordHash = await hashPassword(next);
    await db.setUserPassword(authUser.id, { passwordHash, mustChangePassword: false, passwordChangedAt });

    // Mints a fresh cookie carrying the new pwv so this request's own
    // session survives — every other session (other browser/device) now
    // fails the pwv check in sdk.authenticateRequest and has to log in again.
    await mintSessionCookie(req, res, authUser.openId, authUser.name ?? authUser.username ?? "");

    res.json({ ok: true });
  });
}
