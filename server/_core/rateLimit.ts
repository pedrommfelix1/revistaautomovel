// Brute-force guard for /api/auth/login. Counts failures per bucket (an
// account, or an IP) with an escalating lockout — DB-backed (loginAttempts
// table) so it survives across serverless invocations, unlike an in-memory
// counter.
import { createHash } from "node:crypto";
import * as db from "../db";

const WINDOW_MS = 15 * 60 * 1000;

// [failure count, lockout duration in ms] — most severe first.
const ESCALATION: Record<"account" | "ip", Array<[number, number]>> = {
  account: [
    [20, 24 * 60 * 60 * 1000],
    [10, 60 * 60 * 1000],
    [5, 15 * 60 * 1000],
  ],
  ip: [
    [40, 24 * 60 * 60 * 1000],
    [20, 60 * 60 * 1000],
    [10, 15 * 60 * 1000],
  ],
};

function bucketKey(type: "account" | "ip", id: string): string {
  return `${type}:${createHash("sha256").update(id).digest("base64url")}`;
}

function lockoutFor(type: "account" | "ip", failures: number): number {
  for (const [threshold, duration] of ESCALATION[type]) {
    if (failures >= threshold) return duration;
  }
  return 0;
}

export async function checkLimit(type: "account" | "ip", id: string): Promise<{ blocked: boolean; seconds: number }> {
  const record = await db.getLoginAttempts(bucketKey(type, id));
  if (!record?.blockedUntil) return { blocked: false, seconds: 0 };
  const remaining = record.blockedUntil.getTime() - Date.now();
  if (remaining <= 0) return { blocked: false, seconds: 0 };
  return { blocked: true, seconds: Math.ceil(remaining / 1000) };
}

export async function recordFailure(type: "account" | "ip", id: string): Promise<void> {
  const key = bucketKey(type, id);
  const now = new Date();
  const existing = await db.getLoginAttempts(key);

  let failures = existing?.failures ?? 0;
  let firstFailureAt = existing?.firstFailureAt ?? now;
  const stillBlocked = Boolean(existing?.blockedUntil && existing.blockedUntil.getTime() > now.getTime());

  if (!stillBlocked && now.getTime() - firstFailureAt.getTime() > WINDOW_MS) {
    failures = 0;
    firstFailureAt = now;
  }
  failures += 1;

  const duration = lockoutFor(type, failures);
  const blockedUntil = duration ? new Date(now.getTime() + duration) : null;
  await db.setLoginAttempts(key, { failures, firstFailureAt, blockedUntil });
}

export async function clearFailures(type: "account" | "ip", id: string): Promise<void> {
  await db.deleteLoginAttempts(bucketKey(type, id));
}
