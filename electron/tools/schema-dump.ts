/**
 * schema-dump — log le DDL attendu par TypeORM (CREATE TABLE/INDEX) sans toucher une vraie DB.
 *
 * Stratégie : DataSource :memory: + synchronize:false, initialize(),
 * puis driver.createSchemaBuilder().log() → { upQueries }.
 * Chaque upQuery.query est normalisé en IF NOT EXISTS pour servir de
 * référence (db:schema:log) et pour régénérer la Baseline si les entities évoluent.
 *
 * Usage : npm run db:schema:log [-- --out /tmp/schema.sql]
 */
import "reflect-metadata";
import * as fs from "node:fs";
import { createCliDataSource } from "./cli-datasource";

function toIfNotExists(sql: string): string {
  let out = sql.trim();
  // CREATE TABLE "x" → CREATE TABLE IF NOT EXISTS "x"
  out = out.replace(/^CREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS)/i, "CREATE TABLE IF NOT EXISTS ");
  // CREATE INDEX "x" → CREATE INDEX IF NOT EXISTS "x" (hors UNIQUE géré ci-dessous)
  out = out.replace(/^CREATE\s+INDEX\s+(?!IF\s+NOT\s+EXISTS)/i, "CREATE INDEX IF NOT EXISTS ");
  out = out.replace(/^CREATE\s+UNIQUE\s+INDEX\s+(?!IF\s+NOT\s+EXISTS)/i, "CREATE UNIQUE INDEX IF NOT EXISTS ");
  return out;
}

async function main(): Promise<void> {
  const outIdx = process.argv.indexOf("--out");
  const outPath = outIdx >= 0 ? process.argv[outIdx + 1] : undefined;

  const ds = createCliDataSource(":memory:");
  await ds.initialize();
  try {
    const builder = ds.driver.createSchemaBuilder();
    const { upQueries } = await builder.log();
    const lines: string[] = [];
    lines.push(`-- e-school schema dump (${new Date().toISOString()})`);
    lines.push(`-- ${upQueries.length} statements (normalized IF NOT EXISTS)`);
    lines.push("");
    for (const q of upQueries) {
      const sql = toIfNotExists(String((q as { query: string }).query).trim());
      lines.push(`${sql.replace(/;?\s*$/, ";")}`);
    }
    lines.push("");
    const text = lines.join("\n");
    if (outPath) {
      fs.writeFileSync(outPath, text, "utf8");
      console.log(`[schema-dump] ${upQueries.length} statements → ${outPath}`);
    } else {
      process.stdout.write(text + "\n");
    }
  } finally {
    await ds.destroy().catch(() => undefined);
  }
}

main().catch((e) => {
  console.error("[schema-dump] FAILED:", e?.message ?? e);
  process.exit(1);
});
