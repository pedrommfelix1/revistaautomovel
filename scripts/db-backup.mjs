// Exact logical dump: every table's rows as JSON plus its CREATE TABLE statement.
// Timestamps are read as raw UTC strings (never JS Dates), so a dump restores
// byte-for-byte regardless of the machine's time zone.
//
//   npm run db:backup                 -> ../backups-db/backup-YYYY-MM-DD (outside the repo)
//   npm run db:backup -- <folder>     -> custom folder
// Source is DATABASE_URL, or SOURCE_DATABASE_URL if set.
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";

const url = process.env.SOURCE_DATABASE_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL não definido.");
  process.exit(1);
}

const dir = path.resolve(process.argv[2] || path.join("..", "backups-db", `backup-${new Date().toISOString().slice(0, 10)}`));
fs.mkdirSync(dir, { recursive: true });

const conn = await mysql.createConnection({ uri: url, dateStrings: true, supportBigNumbers: true, bigNumberStrings: true });
await conn.query("SET time_zone = '+00:00'");

const [tables] = await conn.query("SHOW TABLES");
let schema = "";
const counts = {};
for (const row of tables) {
  const name = Object.values(row)[0];
  const [rows] = await conn.query(`SELECT * FROM \`${name}\``);
  fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(rows, null, 1));
  const [[create]] = await conn.query(`SHOW CREATE TABLE \`${name}\``);
  schema += `${create["Create Table"]};\n\n`;
  counts[name] = rows.length;
}
fs.writeFileSync(path.join(dir, "_schema.sql"), schema);
fs.writeFileSync(path.join(dir, "_meta.json"), JSON.stringify({ createdAt: new Date().toISOString(), counts }, null, 1));
await conn.end();

console.log(`Cópia exata guardada em: ${dir}`);
console.log(Object.entries(counts).map(([t, n]) => `${t}: ${n}`).join(" | "));
