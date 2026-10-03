import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * ThreeLevels1780000000000 — migration 3 niveaux (idempotente, append-only).
 *
 * Contexte : passage 2 régimes → 3 niveaux
 *   PRESCOLAIRE | PRIMAIRE | SECONDAIRE (choix validés : préscolaire = copie
 *   des dates primaire ; orphelines payment_configs en quarantaine, jamais de
 *   delete silencieux ; préscolaire sans grades auto-créés — UI de création).
 *
 * Legacy visé (2025-2026) :
 * - id=1 Semestres isCurrent=1 → SECONDAIRE courante
 *   S1 06/10/2025-15/02/2026, S2 16/02/2026-30/06/2026 (inchangés).
 * - id=2 Trimestres isCurrent=0 → PRIMAIRE
 *   T1 06/10/2025-31/12/2025, T2 01/01/2026-18/04/2026, T3 19/04/2026-30/06/2026.
 * - PRESCOLAIRE : copie des dates PRIMAIRE, isCurrent=0, status='active'.
 *
 * Contenu :
 * §A year_repartition.level TEXT DEFAULT ('PRIMAIRE') + backfill + ligne
 *     PRESCOLAIRE + UNIQUE (schoolYear, level) + index.
 * §B grade.level (PRIMARY→PRIMAIRE, SECONDARY→SECONDAIRE, noms
 *     Petite/Moyenne/Grande → PRESCOLAIRE) + order 1..N + nextGradeId chaîné.
 *     Pas de création auto de grades préscolaire (vide + UI création).
 * §C grading_config : schoolYear NULL→'2025-2026', level via classId→grade,
 *     AVRIL→AVR.
 * §D payment_configs : schoolYear NULL→'2025-2026', level même mapping,
 *     className depuis grade.name, orphelines → payment_configs_orphans
 *     (quarantaine, AUCUN DELETE sur la source).
 *
 * RÈGLES SANS BREAK (strict, pattern 171/175/177) :
 * - CREATE TABLE IF NOT EXISTS uniquement.
 * - ALTER TABLE ... ADD COLUMN uniquement si la colonne manque.
 * - Jamais de DROP TABLE / DROP COLUMN.
 * - Jamais de NOT NULL sans DEFAULT.
 * - down() no-op (append-only).
 * - COUNT loggés par table (traçabilité, zéro assert bloquant).
 */
export class ThreeLevels1780000000000 implements MigrationInterface {
  name = "ThreeLevels1780000000000";
  public readonly timestamp = 1780000000000;

  private static readonly LEVELS = ["PRESCOLAIRE", "PRIMAIRE", "SECONDAIRE"] as const;
  private static readonly CANON_YEAR = "2025-2026";

  private static readonly SEMESTRES = [
    { name: "Semestre 1", start: "2025-10-06", end: "2026-02-15" },
    { name: "Semestre 2", start: "2026-02-16", end: "2026-06-30" },
  ];

  private static readonly TRIMESTRES = [
    { name: "Trimestre 1", start: "2025-10-06", end: "2025-12-31" },
    { name: "Trimestre 2", start: "2026-01-01", end: "2026-04-18" },
    { name: "Trimestre 3", start: "2026-04-19", end: "2026-06-30" },
  ];

  /** Ordre canonique 1..23 (présco 1-3, primaire 4-9, secondaire 10-23). */
  private static readonly GRADE_ORDER = [
    "petite section", "moyenne section", "grande section",
    "ci", "cp", "ce1", "ce2", "cm1", "cm2",
    "6e", "6ème", "5e", "5ème", "4e", "4ème", "3e", "3ème",
    "seconde", "2nde", "première", "premiere", "1ère", "terminale",
  ];

  private async addColumnIfMissing(
    q: QueryRunner,
    table: string,
    column: string,
    definition: string,
  ): Promise<void> {
    if (!(await q.hasTable(table))) return;
    if (!(await q.hasColumn(table, column))) {
      await q.query(`ALTER TABLE "${table}" ADD COLUMN ${definition}`);
    }
  }

  private async logCount(q: QueryRunner, table: string): Promise<void> {
    try {
      const rows: Array<{ count: number }> = await q.query(
        `SELECT COUNT(*) AS "count" FROM "${table}"`,
      );
      console.log(`[migration-178] ${table}: COUNT=${Number(rows?.[0]?.count ?? -1)}`);
    } catch {
      /* table absente ? best-effort */
    }
  }

  private normName(v: unknown): string {
    return String(v ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  // ---------------- §A year_repartition ----------------
  private async backfillYearRepartition(q: QueryRunner): Promise<void> {
    if (!(await q.hasTable("year_repartition"))) return;
    const hasLevel = await q.hasColumn("year_repartition", "level");
    if (!hasLevel) return;
    const hasPeriods = await q.hasColumn("year_repartition", "periodConfigurations");
    const hasCurrent = await q.hasColumn("year_repartition", "isCurrent");
    const hasStatus = await q.hasColumn("year_repartition", "status");
    const hasYear = await q.hasColumn("year_repartition", "schoolYear");
    if (!hasPeriods || !hasCurrent || !hasStatus || !hasYear) return;

    // Normalise les niveaux invalides → PRIMAIRE (jamais de NULL bloquant).
    try {
      await q.query(
        `UPDATE "year_repartition" SET "level" = 'PRIMAIRE' WHERE "level" IS NULL OR TRIM("level") = '' OR UPPER(TRIM("level")) NOT IN ('PRESCOLAIRE','PRIMAIRE','SECONDAIRE')`,
      );
    } catch { /* best-effort */ }

    const semJson = JSON.stringify(ThreeLevels1780000000000.SEMESTRES);
    const triJson = JSON.stringify(ThreeLevels1780000000000.TRIMESTRES);
    const Y = ThreeLevels1780000000000.CANON_YEAR;

    // Backfill ciblé id=1 (SECONDAIRE) / id=2 (PRIMAIRE) si présents.
    try {
      const byId: Array<{ id: number }> = await q.query(
        `SELECT "id" FROM "year_repartition" WHERE "id" IN (1, 2)`,
      );
      const ids = new Set((byId ?? []).map((r) => Number((r as { id: number }).id)));
      if (ids.has(1)) {
        await q.query(
          `UPDATE "year_repartition" SET "schoolYear" = ?, "level" = 'SECONDAIRE', "periodConfigurations" = ?, "isCurrent" = 1, "status" = 'active' WHERE "id" = 1`,
          [Y, semJson],
        );
        console.log(`[migration-178] year_repartition id=1 → SECONDAIRE ${Y} (isCurrent=1)`);
      }
      if (ids.has(2)) {
        await q.query(
          `UPDATE "year_repartition" SET "schoolYear" = ?, "level" = 'PRIMAIRE', "periodConfigurations" = ?, "isCurrent" = 0, "status" = 'active' WHERE "id" = 2`,
          [Y, triJson],
        );
        console.log(`[migration-178] year_repartition id=2 → PRIMAIRE ${Y} (isCurrent=0)`);
      }
      // Fallback sans ids legacy : 2 périodes+isCurrent → SECONDAIRE,
      // 3 périodes → PRIMAIRE (uniquement si le niveau est encore défaut).
      if (!ids.has(1) && !ids.has(2)) {
        const rows: Array<{ id: number; periodConfigurations: string | null; isCurrent: unknown }> =
          await q.query(`SELECT "id", "periodConfigurations", "isCurrent" FROM "year_repartition" WHERE "schoolYear" = ?`, [Y]);
        for (const r of rows ?? []) {
          let n = -1;
          try { n = (JSON.parse(String(r.periodConfigurations ?? "[]")) as unknown[]).length; } catch { n = -1; }
          const cur = r.isCurrent === 1 || r.isCurrent === true;
          if (n === 2 && cur) {
            await q.query(`UPDATE "year_repartition" SET "level" = 'SECONDAIRE', "periodConfigurations" = ?, "status" = 'active' WHERE "id" = ?`, [semJson, r.id]);
          } else if (n === 3) {
            await q.query(`UPDATE "year_repartition" SET "level" = 'PRIMAIRE', "periodConfigurations" = ?, "status" = 'active' WHERE "id" = ?`, [triJson, r.id]);
          }
        }
      }
    } catch { /* best-effort */ }

    // Ligne PRESCOLAIRE : copie des dates PRIMAIRE, vide (aucune config
    // clonée par cette migration), non-courante, active. Idempotent.
    try {
      const prim: Array<{ periodConfigurations: string | null }> = await q.query(
        `SELECT "periodConfigurations" FROM "year_repartition" WHERE "schoolYear" = ? AND UPPER("level") = 'PRIMAIRE' LIMIT 1`,
        [Y],
      );
      const primJson = prim?.[0]?.periodConfigurations ?? triJson;
      const exists: Array<{ count: number }> = await q.query(
        `SELECT COUNT(*) AS "count" FROM "year_repartition" WHERE "schoolYear" = ? AND UPPER("level") = 'PRESCOLAIRE'`,
        [Y],
      );
      if (Number(exists?.[0]?.count ?? 0) === 0) {
        await q.query(
          `INSERT INTO "year_repartition" ("schoolYear", "periodConfigurations", "isCurrent", "status", "level") VALUES (?, ?, 0, 'active', 'PRESCOLAIRE')`,
          [Y, primJson],
        );
        console.log(`[migration-178] year_repartition PRESCOLAIRE ${Y} créée (copie dates PRIMAIRE, vide, non-courante)`);
      }
    } catch { /* best-effort */ }

    // Unicité (schoolYear, level) + index niveau. Partiels NULL-safe.
    try {
      await q.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_year_repartition_schoolYear_level" ON "year_repartition" ("schoolYear", "level") WHERE "schoolYear" IS NOT NULL AND "level" IS NOT NULL`,
      );
    } catch { /* index déjà sous un autre nom ? best-effort */ }
    try {
      await q.query(`CREATE INDEX IF NOT EXISTS "IDX_year_repartition_level" ON "year_repartition" ("level")`);
    } catch { /* best-effort */ }
    await this.logCount(q, "year_repartition");
  }

  // ---------------- §B grade ----------------
  private async backfillGrade(q: QueryRunner): Promise<void> {
    if (!(await q.hasTable("grade"))) return;
    const hasLevel = await q.hasColumn("grade", "level");
    const hasType = await q.hasColumn("grade", "type");
    const hasOrder = await q.hasColumn("grade", "order");
    const hasNext = await q.hasColumn("grade", "nextGradeId");
    const hasName = await q.hasColumn("grade", "name");
    if (!hasLevel || !hasName) return;

    // level depuis type + noms préscolaire, idempotent (WHERE level IS NULL).
    try {
      if (hasType) {
        await q.query(
          `UPDATE "grade" SET "level" = CASE WHEN UPPER(TRIM("type")) = 'SECONDARY' THEN 'SECONDAIRE' ELSE 'PRIMAIRE' END WHERE "level" IS NULL OR TRIM("level") = ''`,
        );
      } else {
        await q.query(`UPDATE "grade" SET "level" = 'PRIMAIRE' WHERE "level" IS NULL OR TRIM("level") = ''`);
      }
      // Noms préscolaire (insensible accents/casse) → PRESCOLAIRE.
      const rows: Array<{ id: number; name: string | null }> = await q.query(`SELECT "id", "name" FROM "grade"`);
      for (const r of rows ?? []) {
        const n = this.normName(r.name);
        if (/(petite|moyenne|grande)\s*(section)?/.test(n) || n === "ps" || n === "ms" || n === "gs") {
          // eslint-disable-next-line no-await-in-loop
          await q.query(`UPDATE "grade" SET "level" = 'PRESCOLAIRE' WHERE "id" = ?`, [r.id]);
        }
      }
      await q.query(`UPDATE "grade" SET "level" = 'PRIMAIRE' WHERE UPPER(TRIM("level")) NOT IN ('PRESCOLAIRE','PRIMAIRE','SECONDAIRE')`);
    } catch { /* best-effort */ }

    // order 1..N (canonique si nom reconnu, sinon id) — remplit les NULL seuls.
    // nextGradeId chaîné par order croissant — remplit les NULL seuls.
    try {
      if (hasOrder && hasNext) {
        const all: Array<{ id: number; name: string | null; order: number | null; nextGradeId: number | null }> =
          await q.query(`SELECT "id", "name", "order", "nextGradeId" FROM "grade"`);
        if ((all ?? []).length > 0) {
          const canonIdx = (name: string | null): number => {
            const raw = this.normName(name).replace(/\s+/g, " ");
            // Alias usuels : "6eme"/"6ème" → "6e" (idem 5e/4e/3e), "2nde"→seconde…
            const n = raw
              .replace(/^([6543])\s*emes?\b/, "$1e")
              .replace(/^([6543])\s*eme\b/, "$1e")
              .replace(/^secondes?\b/, "seconde")
              .replace(/^terminales?\b/, "terminale");
            const list = ThreeLevels1780000000000.GRADE_ORDER;
            const exact = list.indexOf(n);
            if (exact >= 0) return exact;
            // Préfixe ("6e a", "cm2 b"…) → rang du canonique préfixé.
            for (let i = 0; i < list.length; i++) {
              if (n === list[i] || n.startsWith(`${list[i]} `)) return i;
            }
            // Replis génériques.
            if (/^ci\b/.test(n)) return 3;
            if (/^cp\b/.test(n)) return 4;
            return 999;
          };
          const sorted = [...all].sort((a, b) => {
            const ca = canonIdx(a.name);
            const cb = canonIdx(b.name);
            if (ca !== cb) return ca - cb;
            return Number(a.id) - Number(b.id);
          });
          let rank = 1;
          for (const g of sorted) {
            if (g.order == null) {
              // eslint-disable-next-line no-await-in-loop
              await q.query(`UPDATE "grade" SET "order" = ? WHERE "id" = ?`, [rank, g.id]);
              g.order = rank;
            }
            rank = Math.max(rank + 1, Number(g.order) + 1);
          }
          const byOrder = [...sorted].sort((a, b) => Number(a.order) - Number(b.order));
          for (let i = 0; i < byOrder.length; i++) {
            const cur = byOrder[i];
            const nxt = byOrder[i + 1]?.id ?? null;
            if (cur.nextGradeId == null && nxt != null) {
              // eslint-disable-next-line no-await-in-loop
              await q.query(`UPDATE "grade" SET "nextGradeId" = ? WHERE "id" = ?`, [nxt, cur.id]);
            }
          }
          console.log(`[migration-178] grade order/nextGradeId chaînés (${sorted.length} niveaux)`);
        }
      }
    } catch { /* best-effort */ }

    // Choix validé : préscolaire laissé VIDE si l'école n'en a pas
    // (aucune création auto Petite/Moyenne/Grande Section — UI de création).
    try {
      const pre: Array<{ count: number }> = await q.query(
        `SELECT COUNT(*) AS "count" FROM "grade" WHERE UPPER("level") = 'PRESCOLAIRE'`,
      );
      console.log(`[migration-178] grade PRESCOLAIRE existants: COUNT=${Number(pre?.[0]?.count ?? 0)} (0 attendu si école sans préscolaire — création via UI)`);
    } catch { /* best-effort */ }
    try {
      await q.query(`CREATE INDEX IF NOT EXISTS "IDX_grade_level" ON "grade" ("level")`);
    } catch { /* best-effort */ }
    await this.logCount(q, "grade");
  }

  // ---------------- §C grading_config ----------------
  private async backfillGradingConfig(q: QueryRunner): Promise<void> {
    if (!(await q.hasTable("grading_config"))) return;
    const Y = ThreeLevels1780000000000.CANON_YEAR;
    try {
      if (await q.hasColumn("grading_config", "schoolYear")) {
        await q.query(`UPDATE "grading_config" SET "schoolYear" = ? WHERE "schoolYear" IS NULL OR TRIM("schoolYear") = ''`, [Y]);
      }
    } catch { /* best-effort */ }
    try {
      if (await q.hasColumn("grading_config", "period")) {
        await q.query(`UPDATE "grading_config" SET "period" = 'AVR' WHERE "period" = 'AVRIL'`);
      }
    } catch { /* best-effort */ }
    try {
      const hasLevel = await q.hasColumn("grading_config", "level");
      const hasClass = await q.hasColumn("grading_config", "classId");
      const gradeHasLevel = (await q.hasTable("grade")) && (await q.hasColumn("grade", "level"));
      if (hasLevel && hasClass && gradeHasLevel) {
        await q.query(
          `UPDATE "grading_config" SET "level" = (SELECT g."level" FROM "grade" g WHERE g."id" = "grading_config"."classId") WHERE ("level" IS NULL OR TRIM("level") = '') AND "classId" IS NOT NULL`,
        );
        await q.query(`UPDATE "grading_config" SET "level" = NULL WHERE "level" IS NOT NULL AND UPPER(TRIM("level")) NOT IN ('PRESCOLAIRE','PRIMAIRE','SECONDAIRE')`);
      }
      if (hasLevel) {
        await q.query(`CREATE INDEX IF NOT EXISTS "IDX_grading_config_level" ON "grading_config" ("level")`);
      }
    } catch { /* best-effort */ }
    await this.logCount(q, "grading_config");
  }

  // ---------------- §D payment_configs + quarantaine ----------------
  private async backfillPaymentConfigs(q: QueryRunner): Promise<void> {
    if (!(await q.hasTable("payment_configs"))) return;
    const Y = ThreeLevels1780000000000.CANON_YEAR;
    try {
      if (await q.hasColumn("payment_configs", "schoolYear")) {
        await q.query(`UPDATE "payment_configs" SET "schoolYear" = ? WHERE "schoolYear" IS NULL OR TRIM("schoolYear") = ''`, [Y]);
      }
    } catch { /* best-effort */ }
    try {
      const hasLevel = await q.hasColumn("payment_configs", "level");
      const hasClass = await q.hasColumn("payment_configs", "classId");
      const gradeHasLevel = (await q.hasTable("grade")) && (await q.hasColumn("grade", "level"));
      if (hasLevel && hasClass && gradeHasLevel) {
        await q.query(
          `UPDATE "payment_configs" SET "level" = (SELECT g."level" FROM "grade" g WHERE CAST(g."id" AS TEXT) = TRIM(CAST("payment_configs"."classId" AS TEXT))) WHERE ("level" IS NULL OR TRIM("level") = '') AND "classId" IS NOT NULL AND TRIM(CAST("classId" AS TEXT)) != ''`,
        );
        await q.query(`UPDATE "payment_configs" SET "level" = NULL WHERE "level" IS NOT NULL AND UPPER(TRIM("level")) NOT IN ('PRESCOLAIRE','PRIMAIRE','SECONDAIRE')`);
      }
    } catch { /* best-effort */ }
    try {
      const hasName = await q.hasColumn("payment_configs", "className");
      const hasClass = await q.hasColumn("payment_configs", "classId");
      if (hasName && hasClass && (await q.hasTable("grade"))) {
        await q.query(
          `UPDATE "payment_configs" SET "className" = (SELECT g."name" FROM "grade" g WHERE CAST(g."id" AS TEXT) = TRIM(CAST("payment_configs"."classId" AS TEXT))) WHERE ("className" IS NULL OR TRIM("className") = '') AND "classId" IS NOT NULL`,
        );
      }
    } catch { /* best-effort */ }

    // Quarantaine orphelines (classId sans grade correspondant, ex. 1-4 sur
    // base où grade.id ne matche plus) : copie SANS delete source.
    try {
      const hasClass = await q.hasColumn("payment_configs", "classId");
      if (hasClass) {
        await q.query(`
          CREATE TABLE IF NOT EXISTS "payment_configs_orphans" (
            "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
            "sourceId" INTEGER NULL,
            "classId" VARCHAR NULL,
            "className" VARCHAR NULL,
            "annualAmount" DECIMAL(14,2) DEFAULT (0),
            "inscriptionFee" DECIMAL(14,2) DEFAULT (0),
            "reInscriptionFee" DECIMAL(14,2) DEFAULT (0),
            "schoolYear" VARCHAR NULL,
            "level" TEXT NULL,
            "reason" TEXT NULL,
            "payload" TEXT NULL,
            "quarantinedAt" DATETIME DEFAULT (CURRENT_TIMESTAMP)
          )`);
        const orphans: Array<{ id: number; classId: string | null }> = await q.query(
          `SELECT pc."id", pc."classId" FROM "payment_configs" pc LEFT JOIN "grade" g ON CAST(g."id" AS TEXT) = TRIM(CAST(pc."classId" AS TEXT)) WHERE pc."classId" IS NOT NULL AND TRIM(CAST(pc."classId" AS TEXT)) != '' AND g."id" IS NULL`,
        );
        let quarantined = 0;
        // Robustesse tables legacy partielles (ex. sans inscriptionFee /
        // annualAmount / className / schoolYear / level) : on ne sélectionne
        // que les colonnes existantes, littéraux sinon (jamais de crash boot).
        const selOr = async (col: string, fallback: string): Promise<string> =>
          (await q.hasColumn("payment_configs", col)) ? `"${col}"` : fallback;
        const sClassName = await selOr("className", "NULL");
        const sAnnual = await selOr("annualAmount", "0");
        const sSchoolYear = await selOr("schoolYear", `'${ThreeLevels1780000000000.CANON_YEAR}'`);
        const sLevel = await selOr("level", "NULL");
        for (const o of orphans ?? []) {
          // Idempotent : même sourceId + classId déjà en quarantaine → skip.
          // eslint-disable-next-line no-await-in-loop
          const seen: Array<{ count: number }> = await q.query(
            `SELECT COUNT(*) AS "count" FROM "payment_configs_orphans" WHERE "sourceId" = ?`,
            [o.id],
          );
          if (Number(seen?.[0]?.count ?? 0) > 0) continue;
          // eslint-disable-next-line no-await-in-loop
          await q.query(
            `INSERT INTO "payment_configs_orphans" ("sourceId", "classId", "className", "annualAmount", "schoolYear", "level", "reason", "payload") SELECT "id", "classId", ${sClassName}, ${sAnnual}, ${sSchoolYear}, ${sLevel}, 'ORPHAN_CLASS_ID', NULL FROM "payment_configs" WHERE "id" = ?`,
            [o.id],
          );
          quarantined++;
        }
        if (quarantined > 0 || (orphans ?? []).length > 0) {
          console.log(`[migration-178] payment_configs orphelines: détectées=${(orphans ?? []).length} mises-en-quarantaine=${quarantined} (source conservée, AUCUN delete)`);
        }
      }
      if (await q.hasColumn("payment_configs", "level")) {
        await q.query(`CREATE INDEX IF NOT EXISTS "IDX_payment_configs_level" ON "payment_configs" ("level")`);
      }
    } catch { /* best-effort */ }
    await this.logCount(q, "payment_configs");
    await this.logCount(q, "payment_configs_orphans");
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    // §A year_repartition.level
    await this.addColumnIfMissing(queryRunner, "year_repartition", "level", `"level" TEXT DEFAULT ('PRIMAIRE')`);
    await this.backfillYearRepartition(queryRunner);

    // §B grade.level + order/nextGradeId (colonnes 173 déjà convergées par 177)
    await this.addColumnIfMissing(queryRunner, "grade", "level", `"level" TEXT NULL`);
    await this.backfillGrade(queryRunner);

    // §C grading_config.level
    await this.addColumnIfMissing(queryRunner, "grading_config", "level", `"level" TEXT NULL`);
    await this.backfillGradingConfig(queryRunner);

    // §D payment_configs.level + quarantaine
    await this.addColumnIfMissing(queryRunner, "payment_configs", "level", `"level" TEXT NULL`);
    await this.backfillPaymentConfigs(queryRunner);
  }

  public async down(): Promise<void> {
    // Append-only : pas de rollback destructif.
  }
}
