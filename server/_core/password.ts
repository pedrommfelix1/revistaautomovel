// Password hashing and policy for the backoffice's username/password login.
// scrypt via Node's built-in crypto — no dependency, and expensive enough
// (~100ms) to make offline brute-forcing a stolen hash unattractive while
// staying fast enough for a normal login.
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SCRYPT_PARAMS = { N: 32768, r: 8, p: 1, maxmem: 96 * 1024 * 1024 };
const KEY_LEN = 64;
const SALT_LEN = 16;
const MIN_LENGTH = 10;
const MAX_LENGTH = 200;

const COMMON_PASSWORDS = [
  "motordelinha", "motordelinha2026", "password", "palavrapasse",
  "administrador", "adminadmin", "123456789012", "qwertyuiop12",
  "111111111111", "abcdefghijkl", "passworD123",
];

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function fromB64url(str: string): Buffer {
  return Buffer.from(str, "base64url");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LEN);
  const derived = scryptSync(password.normalize("NFKC"), salt, KEY_LEN, SCRYPT_PARAMS);
  const { N, r, p } = SCRYPT_PARAMS;
  return ["scrypt", N, r, p, b64url(salt), b64url(derived)].join("$");
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, N, r, p, saltB64, hashB64] = parts;
  const params = { N: Number(N), r: Number(r), p: Number(p), maxmem: SCRYPT_PARAMS.maxmem };
  if (!Number.isFinite(params.N) || !Number.isFinite(params.r) || !Number.isFinite(params.p)) return false;
  const expected = fromB64url(hashB64);
  let derived: Buffer;
  try {
    derived = scryptSync(password.normalize("NFKC"), fromB64url(saltB64), expected.length, params);
  } catch {
    return false;
  }
  return safeEqual(b64url(derived), b64url(expected));
}

/** Returns an error message, or null if the password is acceptable. */
export function validatePassword(password: string, context: { username?: string | null; displayName?: string | null }): string | null {
  const pwd = password.normalize("NFKC");
  if (pwd.length < MIN_LENGTH) return `A palavra-passe tem de ter pelo menos ${MIN_LENGTH} caracteres.`;
  if (pwd.length > MAX_LENGTH) return "A palavra-passe é demasiado longa.";
  if (pwd.trim() !== pwd) return "A palavra-passe não pode começar nem acabar com espaços.";

  const lower = pwd.toLowerCase();
  if (COMMON_PASSWORDS.some((p) => lower === p || lower.includes(p))) {
    return "Essa palavra-passe é demasiado previsível. Escolha outra.";
  }
  for (const field of [context.username, context.displayName]) {
    const value = String(field ?? "").trim().toLowerCase();
    if (value.length >= 4 && lower.includes(value)) {
      return "A palavra-passe não pode conter o seu nome de utilizador nem o seu nome.";
    }
  }
  if (/^(.)\1+$/.test(pwd)) return "A palavra-passe é demasiado previsível. Escolha outra.";
  if (new Set(pwd).size < 5) return "A palavra-passe tem pouca variedade de caracteres.";

  return null;
}
