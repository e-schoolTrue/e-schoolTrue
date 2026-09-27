import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Garde-fou : toute migration dans electron/migrations/*.ts DOIT être
 * importée explicitement dans electron/data-source.ts.
 * (Le main tourne depuis dist-electron/ : un glob ne résout rien là-bas,
 * les migrations oubliées ne s'exécuteraient jamais, en silence.)
 */
describe("migration-registration : toutes les migrations sont branchées", () => {
  const migrationsDir = path.join(__dirname, "..", "..", "migrations");
  const dataSourceSrc = fs.readFileSync(
    path.join(__dirname, "..", "..", "data-source.ts"),
    "utf8"
  );

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => /^\d+-.*\.ts$/.test(f))
    .sort();

  it("au moins la baseline existe", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    it(`${file} est importée dans data-source.ts`, () => {
      const base = file.replace(/\.ts$/, "");
      expect(dataSourceSrc).toContain(`./migrations/${base}`);
    });

    it(`${file} exporte une classe avec timestamp`, () => {
      const src = fs.readFileSync(path.join(migrationsDir, file), "utf8");
      expect(src).toMatch(/export\s+class\s+\w+/);
      expect(src).toMatch(/timestamp\s*=\s*\d{13}/);
    });
  }

  it("l'option migrations n'utilise pas de glob (accepte shorthand `migrations,`)", () => {
    // Fix 1.1.31 : data-source.ts utilise le shorthand `migrations,` (référence
    // au tableau `const migrations = [...]`), pas `migrations: [...]` inline.
    // L'ancien regex /migrations\s*:/ ne matchait pas le shorthand → opt="".
    const inlineOpt =
      dataSourceSrc.match(/migrations\s*:\s*(\[.*?\]|migrations\b.*)/s)?.[0] ?? "";
    const usesShorthand = /(?<!\.)\bmigrations\s*,/.test(dataSourceSrc);
    const opt = inlineOpt || (usesShorthand ? "migrations," : "");
    expect(opt, "data-source.ts doit brancher `migrations` (shorthand ou explicite)").not.toBe("");
    expect(opt).not.toMatch(/\*\.\{ts,js\}|\bglob\b/i);
    expect(`${opt},`).toContain("migrations,");
    // Le tableau `const migrations = [...]` doit lister les 5 migrations.
    const arr = dataSourceSrc.match(/const\s+migrations\s*=\s*\[(.*?)\]/s)?.[1] ?? "";
    for (const cls of [
      "Baseline1700000000000",
      "DriftCatchup1710000000000",
      "BackfillCounters1720000000000",
      "YearStatusSchoolYear1730000000000",
      "TranchConfigPrecision1740000000000",
    ]) {
      expect(arr, `const migrations doit contenir ${cls}`).toContain(cls);
    }
  });

  // --- Fix 1.1.31 : migration 174 assertions ciblées -----------------------
  it("migration 174 est importée explicitement (fix 1.1.31)", () => {
    expect(dataSourceSrc).toContain("./migrations/1740000000000-TranchConfigPrecision");
    expect(dataSourceSrc).toContain("TranchConfigPrecision1740000000000");
  });

  it("migration 174 déclare timestamp=1740000000000", () => {
    const src = fs.readFileSync(
      path.join(migrationsDir, "1740000000000-TranchConfigPrecision.ts"),
      "utf8"
    );
    expect(src).toMatch(/timestamp\s*=\s*1740000000000/);
    expect(src).toMatch(/export\s+class\s+TranchConfigPrecision1740000000000/);
  });

  it("migration 174 est idempotente (guards + IF NOT EXISTS, down no-op)", () => {
    const src = fs.readFileSync(
      path.join(migrationsDir, "1740000000000-TranchConfigPrecision.ts"),
      "utf8"
    );
    // Guards hasTable/hasColumn partout, jamais de CREATE sans IF NOT EXISTS.
    expect(src).toMatch(/hasTable/);
    expect(src).toMatch(/IF NOT EXISTS/);
    expect(src).toMatch(/DROP TABLE IF EXISTS/);
    // down() append-only no-op : aucun DROP COLUMN exécuté (hors commentaires).
    const codeOnly = src
      .split("\n")
      .filter((l) => !l.trim().startsWith("*") && !l.trim().startsWith("//"))
      .join("\n");
    expect(codeOnly).not.toMatch(/\.query\(.*DROP COLUMN/i);
    expect(src).toMatch(/public async down/);
  });
});
