/**
 * db-backup — snapshot fichier de la DB (VACUUM INTO si ouvrable, sinon copyFile).
 * Usage : npm run db:backup -- [--db /chemin/database.db] [--out /chemin/backup.db]
 */
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import { createCliDataSource } from "./cli-datasource";

function stamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(
    d.getMinutes()
  )}${p(d.getSeconds())}`;
}

async function main(): Promise<void> {
  const dbIdx = process.argv.indexOf("--db");
  const outIdx = process.argv.indexOf("--out");
  const dbPath = dbIdx >= 0 ? process.argv[dbIdx + 1] : process.env.E_SCHOOL_DB;
  if (!dbPath || !fs.existsSync(dbPath)) {
    console.error("Usage: db:backup -- --db /chemin/database.db [--out /chemin/backup.db]");
    console.error("Astuce dev : copiez d'abord %APPDATA%/Eschool/database.db vers /tmp puis passez --db /tmp/database.db");
    process.exit(2);
  }
  const outPath =
    outIdx >= 0 && process.argv[outIdx + 1]
      ? process.argv[outIdx + 1]
      : `${dbPath}.backup-${stamp()}.db`;
  const ds = createCliDataSource(dbPath);
  try {
    await ds.initialize();
    const literal = `'${outPath.replace(/'/g, "''")}'`;
    await ds.query(`VACUUM INTO ${literal}`);
    console.log(`[db:backup] VACUUM INTO OK → ${outPath}`);
  } catch (e) {
    console.warn(`[db:backup] VACUUM INTO impossible (${(e as Error)?.message}), fallback copyFile…`);
    await fsp.mkdir(path.dirname(outPath), { recursive: true });
    await fsp.copyFile(dbPath, outPath);
    console.log(`[db:backup] copyFile OK → ${outPath}`);
  } finally {
    await ds.destroy().catch(() => undefined);
  }
}

main().catch((e) => {
  console.error("[db:backup] FAILED:", e?.message ?? e);
  process.exit(1);
});
