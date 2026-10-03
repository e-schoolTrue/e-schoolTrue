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
    // Le tableau `const migrations = [...]` doit lister les 8 migrations
    // (train unique : + DriftCatchup2 175 + RoleLegacyFix 176 + filet 177).
    const arr = dataSourceSrc.match(/const\s+migrations\s*=\s*\[(.*?)\]/s)?.[1] ?? "";
    for (const cls of [
      "Baseline1700000000000",
      "DriftCatchup1710000000000",
      "BackfillCounters1720000000000",
      "YearStatusSchoolYear1730000000000",
      "TranchConfigPrecision1740000000000",
      "DriftCatchup2175000000000",
      "RoleLegacyFix1760000000000",
      "DriftCatchup3177000000000",
      "ThreeLevels1780000000000",
      "ParentTable1790000000000",
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

  // --- Train unique : migrations 175 + 176 --------------------------------
  it("migration 175 déclare timestamp=1750000000000", () => {
    const src = fs.readFileSync(
      path.join(migrationsDir, "1750000000000-DriftCatchup2.ts"),
      "utf8"
    );
    expect(src).toMatch(/timestamp\s*=\s*1750000000000/);
    expect(src).toMatch(/export\s+class\s+DriftCatchup2175000000000/);
  });

  it("migration 175 est idempotente (CREATE IF NOT EXISTS, ADD COLUMN guard, sans DROP/UNIQUE/NOT NULL sans default, down no-op)", () => {
    const src = fs.readFileSync(
      path.join(migrationsDir, "1750000000000-DriftCatchup2.ts"),
      "utf8"
    );
    expect(src).toMatch(/hasTable/);
    expect(src).toMatch(/hasColumn/);
    expect(src).toMatch(/CREATE TABLE IF NOT EXISTS/);
    expect(src).toMatch(/COUNT=/);
    const codeOnly = src
      .split("\n")
      .filter((l) => !l.trim().startsWith("*") && !l.trim().startsWith("//"))
      .join("\n");
    expect(codeOnly).not.toMatch(/DROP TABLE\s+"(?!IF)/i);
    expect(codeOnly).not.toMatch(/\.query\(.*DROP COLUMN/i);
    expect(codeOnly).not.toMatch(/CREATE UNIQUE INDEX/i);
    // Règle NULLABLE/DEFAULT (ADR-002) : aucun ADD COLUMN NOT NULL sans DEFAULT
    // (SQLite refuse sur table peuplée). Les NOT NULL des CREATE TABLE neufs
    // (PK auto-générées, jointure teaching_grades) sont hors périmètre.
    for (const line of codeOnly.split("\n")) {
      if (/ADD COLUMN/i.test(line) && /NOT NULL/i.test(line) && !/DEFAULT/i.test(line)) {
        throw new Error(`migration 175 : ADD COLUMN NOT NULL sans DEFAULT → ${line.trim()}`);
      }
    }
    expect(src).toMatch(/public async down/);
  });

  it("migration 176 déclare timestamp=1760000000000 et force admin idempotent", () => {    const src = fs.readFileSync(
      path.join(migrationsDir, "1760000000000-RoleLegacyFix.ts"),
      "utf8"
    );
    expect(src).toMatch(/timestamp\s*=\s*1760000000000/);
    expect(src).toMatch(/export\s+class\s+RoleLegacyFix1760000000000/);
    expect(src).toMatch(/hasTable/);
    expect(src).toMatch(/SET "role" = 'admin'/);
    expect(src).toMatch(/COUNT=/);
    const codeOnly = src
      .split("\n")
      .filter((l) => !l.trim().startsWith("*") && !l.trim().startsWith("//"))
      .join("\n");
    expect(codeOnly).not.toMatch(/DROP/i);
    expect(src).toMatch(/public async down/);
  });

  it("migration 177 déclare timestamp=1770000000000 (filet zéro-colonne-manquante)", () => {
    const src = fs.readFileSync(
      path.join(migrationsDir, "1770000000000-DriftCatchup3.ts"),
      "utf8"
    );
    expect(src).toMatch(/timestamp\s*=\s*1770000000000/);
    expect(src).toMatch(/export\s+class\s+DriftCatchup3177000000000/);
    expect(dataSourceSrc).toContain("./migrations/1770000000000-DriftCatchup3");
    expect(dataSourceSrc).toContain("DriftCatchup3177000000000");
  });

  it("migration 177 est idempotente (guards + IF NOT EXISTS, down no-op, sans DROP/NOT NULL sans DEFAULT)", () => {
    const src = fs.readFileSync(
      path.join(migrationsDir, "1770000000000-DriftCatchup3.ts"),
      "utf8"
    );
    expect(src).toMatch(/hasTable/);
    expect(src).toMatch(/hasColumn/);
    expect(src).toMatch(/CREATE TABLE IF NOT EXISTS/);
    expect(src).toMatch(/COUNT=/);
    // Couvre les filets critiques : user.role, year_repartition.status/closedAt,
    // payments.receiptNumber/scholarshipId/baseAmount, accounting_vault, statuts comptables.
    for (const needle of [
      '"user", "role"',
      '"year_repartition", "status"',
      '"year_repartition", "closedAt"',
      '"payments", "receiptNumber"',
      '"payments", "scholarshipId"',
      '"accounting_vault"',
      '"expenses", "status"',
      '"cash_registers", "status"',
      '"salary_slips", "status"',
    ]) {
      expect(src, `migration 177 doit couvrir ${needle}`).toContain(needle);
    }
    const codeOnly = src
      .split("\n")
      .filter((l) => !l.trim().startsWith("*") && !l.trim().startsWith("//"))
      .join("\n");
    expect(codeOnly).not.toMatch(/\.query\(.*DROP COLUMN/i);
    for (const line of codeOnly.split("\n")) {
      if (/ADD COLUMN/i.test(line) && /NOT NULL/i.test(line) && !/DEFAULT/i.test(line)) {
        throw new Error(`migration 177 : ADD COLUMN NOT NULL sans DEFAULT → ${line.trim()}`);
      }
    }
    expect(src).toMatch(/public async down/);
  });

  it("KNOWN_MIGRATIONS (migration-runner.ts) est en phase avec data-source.ts", () => {
    const runnerSrc = fs.readFileSync(
      path.join(__dirname, "..", "..", "migration-runner.ts"),
      "utf8"
    );
    for (const ts of [1700000000000, 1710000000000, 1720000000000, 1730000000000, 1740000000000, 1750000000000, 1760000000000, 1770000000000, 1780000000000, 1790000000000]) {
      expect(runnerSrc, `KNOWN_MIGRATIONS doit contenir ${ts}`).toContain(String(ts));
    }
    expect(runnerSrc).toContain("DriftCatchup3177000000000");
    expect(runnerSrc).toContain("ThreeLevels1780000000000");
  });

  it("migration 179 déclare timestamp=1790000000000 (Option B T_parent, idempotente)", () => {
    const src = fs.readFileSync(
      path.join(migrationsDir, "1790000000000-ParentTable.ts"),
      "utf8"
    );
    expect(src).toMatch(/timestamp\s*=\s*1790000000000/);
    expect(src).toMatch(/export\s+class\s+ParentTable1790000000000/);
    expect(dataSourceSrc).toContain("./migrations/1790000000000-ParentTable");
    expect(dataSourceSrc).toContain("ParentTable1790000000000");
    expect(src).toMatch(/CREATE TABLE IF NOT EXISTS "T_parent"/);
    expect(src).toMatch(/INSERT OR IGNORE/);
    expect(src).toMatch(/parentId.*IS NULL/);
    expect(src).toMatch(/suspect.*no-key/);
    expect(src).toMatch(/public async down/);
    const codeOnly179 = src
      .split("\n")
      .filter((l) => !l.trim().startsWith("*") && !l.trim().startsWith("//"))
      .join("\n");
    expect(codeOnly179).not.toMatch(/\.query\(.*DROP COLUMN/i);
    // normalizedPhone jamais '' : fail-fast présent.
    expect(src).toMatch(/normalizedPhone.*''/);
  });

  it("migration 178 déclare timestamp=1780000000000 (3 niveaux, idempotente)", () => {
    const src = fs.readFileSync(
      path.join(migrationsDir, "1780000000000-ThreeLevels.ts"),
      "utf8"
    );
    expect(src).toMatch(/timestamp\s*=\s*1780000000000/);
    expect(src).toMatch(/export\s+class\s+ThreeLevels1780000000000/);
    expect(dataSourceSrc).toContain("./migrations/1780000000000-ThreeLevels");
    expect(dataSourceSrc).toContain("ThreeLevels1780000000000");
    expect(src).toMatch(/hasTable/);
    expect(src).toMatch(/hasColumn/);
    expect(src).toMatch(/CREATE TABLE IF NOT EXISTS/);
    expect(src).toMatch(/payment_configs_orphans/);
    expect(src).toMatch(/PRESCOLAIRE/);
    expect(src).toMatch(/public async down/);
    const codeOnly = src
      .split("\n")
      .filter((l) => !l.trim().startsWith("*") && !l.trim().startsWith("//"))
      .join("\n");
    expect(codeOnly).not.toMatch(/\.query\(.*DROP COLUMN/i);
    for (const line of codeOnly.split("\n")) {
      if (/ADD COLUMN/i.test(line) && /NOT NULL/i.test(line) && !/DEFAULT/i.test(line)) {
        throw new Error(`migration 178 : ADD COLUMN NOT NULL sans DEFAULT → ${line.trim()}`);
      }
    }
  });
});
