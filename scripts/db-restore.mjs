// Loads a dump made by db-backup.mjs into another database, then verifies every
// row matches the dump.
//
//   TARGET_DATABASE_URL=mysql://... node scripts/db-restore.mjs <backup-folder> [--replace]
//
// Refuses to touch a target that already holds rows unless --replace is given
// (which empties every table first) — so pointing it at the wrong database by
// accident does not silently merge or wipe data.
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";

const args = process.argv.slice(2);
const replace = args.includes("--replace");
const dir = args.find((a) => !a.startsWith("--"));
const url = process.env.TARGET_DATABASE_URL;
if (!dir || !url) {
  console.error("Uso: TARGET_DATABASE_URL=mysql://... node scripts/db-restore.mjs <pasta-da-cópia> [--replace]");
  process.exit(1);
}
if (url === process.env.DATABASE_URL && !replace) {
  console.error("TARGET_DATABASE_URL é igual a DATABASE_URL — use --replace se é mesmo isso que quer.");
  process.exit(1);
}

const schemaSql = fs.readFileSync(path.join(dir, "_schema.sql"), "utf8");
const statements = schemaSql.split(/;\s*\n\s*\n/).map((s) => s.trim()).filter(Boolean);
const tableNames = statements.map((s) => s.match(/CREATE TABLE `([^`]+)`/)[1]);

const conn = await mysql.createConnection({ uri: url, dateStrings: true, supportBigNumbers: true, bigNumberStrings: true });
await conn.query("SET time_zone = '+00:00'");
await conn.query("SET FOREIGN_KEY_CHECKS = 0").catch(() => {});

for (const statement of statements) {
  await conn.query(statement.replace(/^CREATE TABLE /, "CREATE TABLE IF NOT EXISTS "));
}

for (const name of tableNames) {
  const [[{ n }]] = await conn.query(`SELECT COUNT(*) AS n FROM \`${name}\``);
  if (n > 0 && !replace) {
    console.error(`A tabela ${name} do destino já tem ${n} linhas. Nada foi alterado nos dados. Use --replace para substituir.`);
    await conn.end();
    process.exit(1);
  }
}

const readRows = (name) => JSON.parse(fs.readFileSync(path.join(dir, `${name}.json`), "utf8"));
for (const name of tableNames) {
  if (replace) await conn.query(`TRUNCATE TABLE \`${name}\``);
  const rows = readRows(name);
  if (!rows.length) continue;
  const cols = Object.keys(rows[0]);
  const colList = cols.map((c) => `\`${c}\``).join(",");
  for (let i = 0; i < rows.length; i += 300) {
    const batch = rows.slice(i, i + 300).map((r) => cols.map((c) => r[c]));
    await conn.query(`INSERT INTO \`${name}\` (${colList}) VALUES ?`, [batch]);
  }
}

const sortKey = (r) => (r.id !== undefined ? BigInt(r.id) : 0n);
const bySortKey = (a, b) => (sortKey(a) < sortKey(b) ? -1 : sortKey(a) > sortKey(b) ? 1 : 0);
let problems = 0;
for (const name of tableNames) {
  const expected = readRows(name).sort(bySortKey);
  const [actualRows] = await conn.query(`SELECT * FROM \`${name}\``);
  const actual = actualRows.sort(bySortKey);
  let ok = expected.length === actual.length;
  if (ok) for (let i = 0; i < expected.length; i++) if (JSON.stringify(expected[i]) !== JSON.stringify(actual[i])) { ok = false; break; }
  if (!ok) problems++;
  console.log(`${ok ? "OK   " : "ERRO "} ${name.padEnd(22)} esperado ${expected.length} | no destino ${actual.length}`);
}
await conn.end();
console.log(problems ? `\n${problems} tabela(s) com diferenças.` : "\nVerificação completa: tudo igual à cópia.");
process.exit(problems ? 1 : 0);
