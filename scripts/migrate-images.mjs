// Moves every /manus-storage/<key> file referenced in the database to the public
// Vercel Blob store, keeping the same pathname.
//
//   node scripts/migrate-images.mjs             copy + verify only (adds blobs, never touches the DB)
//   node scripts/migrate-images.mjs --apply-db  also rewrites the DB URLs to the blob URLs
//
// Safe to re-run: already-copied files are re-verified and skipped, and the DB
// rewrite only touches URLs that still point at /manus-storage/.
import "dotenv/config";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";
import { put } from "@vercel/blob";

const APPLY_DB = process.argv.includes("--apply-db");
const MAP_FILE = path.resolve("..", "backups-db", "image-migration-map.json");
const TARGETS = [
  ["articleImages", "url"],
  ["articleSections", "body"],
  ["articles", "coverImageUrl"],
  ["articles", "socialImageUrl"],
  ["siteGalleryImages", "url"],
  ["magazineIssues", "pdfUrl"],
  ["magazineIssues", "coverImageUrl"],
];
const KEY_PATTERN = /\/manus-storage\/([^\s"'<>)]+)/g;

const forgeBase = process.env.BUILT_IN_FORGE_API_URL?.replace(/\/+$/, "");
const forgeKey = process.env.BUILT_IN_FORGE_API_KEY;
const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
if (!forgeBase || !forgeKey || !blobToken || !process.env.DATABASE_URL) {
  console.error("Faltam variáveis no .env (BUILT_IN_FORGE_API_URL/KEY, BLOB_READ_WRITE_TOKEN, DATABASE_URL).");
  process.exit(1);
}

const sha = (buf) => crypto.createHash("sha256").update(buf).digest("hex");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function withRetry(label, fn) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= 4) throw new Error(`${label}: ${error.message}`);
      await sleep(1000 * attempt);
    }
  }
}

const db = await mysql.createConnection(process.env.DATABASE_URL);

async function collectKeys() {
  const keys = new Set();
  for (const [table, column] of TARGETS) {
    const [rows] = await db.query(`SELECT \`${column}\` AS v FROM \`${table}\` WHERE \`${column}\` LIKE '%/manus-storage/%'`);
    for (const { v } of rows) for (const m of String(v).matchAll(KEY_PATTERN)) keys.add(m[1]);
  }
  return [...keys].sort();
}

async function downloadFromManus(key) {
  const presign = new URL("v1/storage/presign/get", `${forgeBase}/`);
  presign.searchParams.set("path", key);
  const p = await fetch(presign, { headers: { Authorization: `Bearer ${forgeKey}` } });
  if (!p.ok) throw new Error(`presign ${p.status}`);
  const { url } = await p.json();
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download ${r.status}`);
  return { bytes: Buffer.from(await r.arrayBuffer()), contentType: r.headers.get("content-type") || "application/octet-stream" };
}

const map = fs.existsSync(MAP_FILE) ? JSON.parse(fs.readFileSync(MAP_FILE, "utf8")) : {};
const saveMap = () => fs.writeFileSync(MAP_FILE, JSON.stringify(map, null, 1));

const keys = await collectKeys();
console.log(`Ficheiros referenciados na base de dados: ${keys.length}`);

let copied = 0;
let skipped = 0;
const failures = [];
let cursor = 0;
async function worker() {
  while (cursor < keys.length) {
    const key = keys[cursor++];
    try {
      const source = await withRetry(`${key} (origem)`, () => downloadFromManus(key));
      const sourceHash = sha(source.bytes);

      const existing = map[key];
      if (existing?.sha256 === sourceHash) {
        const check = await fetch(existing.url);
        if (check.ok && sha(Buffer.from(await check.arrayBuffer())) === sourceHash) {
          skipped++;
          continue;
        }
      }

      const blob = await withRetry(`${key} (upload)`, () =>
        put(key, source.bytes, {
          access: "public",
          contentType: source.contentType,
          addRandomSuffix: false,
          allowOverwrite: true,
          cacheControlMaxAge: 31536000,
          multipart: source.bytes.length > 20 * 1024 * 1024,
          token: blobToken,
        }),
      );
      const back = await withRetry(`${key} (verificação)`, async () => {
        const r = await fetch(blob.url);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return Buffer.from(await r.arrayBuffer());
      });
      if (sha(back) !== sourceHash) throw new Error("conteúdo diferente depois do upload");

      map[key] = { url: blob.url, bytes: source.bytes.length, sha256: sourceHash };
      copied++;
      if ((copied + skipped) % 25 === 0) {
        saveMap();
        console.log(`  ... ${copied + skipped}/${keys.length}`);
      }
    } catch (error) {
      failures.push(`${key}: ${error.message}`);
    }
  }
}
await Promise.all(Array.from({ length: 4 }, worker));
saveMap();

const totalMb = Object.values(map).reduce((s, e) => s + e.bytes, 0) / 1048576;
console.log(`\nCópia: ${copied} novos, ${skipped} já estavam certos, ${failures.length} falhas. Total no mapa: ${Object.keys(map).length} ficheiros, ${totalMb.toFixed(1)} MB (verificados por SHA-256).`);
if (failures.length) {
  console.log("Falhas:\n  " + failures.slice(0, 10).join("\n  "));
  await db.end();
  process.exit(1);
}

if (!APPLY_DB) {
  console.log("\nNada foi alterado na base de dados. Para trocar os endereços: node scripts/migrate-images.mjs --apply-db");
  await db.end();
  process.exit(0);
}

const [[{ n: tableCount }]] = await db.query("SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()");
console.log(`\nA atualizar a base de dados (${tableCount} tabelas)...`);
let rewritten = 0;
const unmapped = [];
for (const [table, column] of TARGETS) {
  const [[hasUpdatedAt]] = await db.query(
    "SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'updatedAt'",
    [table],
  );
  const keepUpdatedAt = hasUpdatedAt.n > 0 ? ", `updatedAt` = `updatedAt`" : "";
  const [rows] = await db.query(`SELECT id, \`${column}\` AS v FROM \`${table}\` WHERE \`${column}\` LIKE '%/manus-storage/%'`);
  await db.beginTransaction();
  try {
    for (const { id, v } of rows) {
      const next = String(v).replace(KEY_PATTERN, (whole, key) => {
        if (!map[key]) {
          unmapped.push(`${table}.${column} id=${id}: ${key}`);
          return whole;
        }
        return map[key].url;
      });
      if (next === v) continue;
      await db.query(`UPDATE \`${table}\` SET \`${column}\` = ?${keepUpdatedAt} WHERE id = ?`, [next, id]);
      rewritten++;
    }
    await db.commit();
  } catch (error) {
    await db.rollback();
    throw error;
  }
  console.log(`  ${table}.${column}: ${rows.length} linhas analisadas`);
}
console.log(`Linhas atualizadas: ${rewritten}`);
if (unmapped.length) console.log("SEM MAPEAMENTO (não alterados):\n  " + unmapped.join("\n  "));

const [textColumns] = await db.query(
  "SELECT TABLE_NAME t, COLUMN_NAME c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND DATA_TYPE IN ('varchar','text','mediumtext','longtext')",
);
let remaining = 0;
for (const { t, c } of textColumns) {
  const [[{ n }]] = await db.query(`SELECT COUNT(*) AS n FROM \`${t}\` WHERE \`${c}\` LIKE '%/manus-storage/%'`);
  if (n) {
    remaining += n;
    console.log(`  ainda há ${n} em ${t}.${c}`);
  }
}
console.log(remaining ? `\nATENÇÃO: ainda restam ${remaining} referências a /manus-storage/.` : "\nNenhuma referência a /manus-storage/ resta na base de dados.");
await db.end();
process.exit(remaining || unmapped.length ? 1 : 0);
