import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * YearStatusSchoolYear1730000000000 — plan V3 (idempotent, sans break).
 * - year_repartition : status active/closed (default active) + closedAt nullable.
 * - grade : order + nextGradeId (réinscription).
 * - payment_configs / payment_annual_config / grading_config : schoolYear nullable + INDEX.
 * - Normalisation : valeurs civiles "2026" -> scolaire via règle mois>=9 (mois courant
 *   au moment de la migration). Les valeurs déjà canoniques sont inchangées.
 * Règles : ADD COLUMN si manquante, jamais de DROP, jamais de NOT NULL sans DEFAULT.
 */
export class YearStatusSchoolYear1730000000000 implements MigrationInterface {
  name = "YearStatusSchoolYear1730000000000";
  public readonly timestamp = 1730000000000;

  private async addColumnIfMissing(q: QueryRunner, table: string, column: string, definition: string): Promise<void> {
    if (!(await q.hasColumn(table, column))) {
      await q.query(`ALTER TABLE "${table}" ADD COLUMN ${definition}`);
    }
  }

  private async backfillStatus(q: QueryRunner): Promise<void> {
    const hasStatus = await q.hasColumn("year_repartition", "status");
    const hasClosedAt = await q.hasColumn("year_repartition", "closedAt");
    if (hasStatus) {
      await q.query(`UPDATE "year_repartition" SET "status" = 'active' WHERE "status" IS NULL OR "status" NOT IN ('active','closed')`);
    }
    void hasClosedAt;
  }

  private async normalizeTable(q: QueryRunner, table: string, column: string, refDate: Date): Promise<void> {
    try {
      const has: boolean = await q.hasColumn(table, column);
      if (!has) return;
      const rows: Array<{ id: number; v: string | null }> = await q.query(`SELECT "id", "${column}" AS "v" FROM "${table}" WHERE "${column}" IS NOT NULL AND TRIM("${column}") != ''`);
      const mo = refDate.getMonth();
      for (const r of rows) {
        const s = String(r.v ?? "").trim();
        if (!s) continue;
        if (/^\d{4}-\d{4}$/.test(s)) continue; // déjà canonique (validation stricte côté service)
        const civil = /^(\d{4})$/.exec(s);
        if (civil) {
          const y = Number(civil[1]);
          const canon = mo >= 8 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
          await q.query(`UPDATE "${table}" SET "${column}" = ? WHERE "id" = ?`, [canon, r.id]);
        }
      }
    } catch { /* best-effort */ }
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.addColumnIfMissing(queryRunner, "year_repartition", "status", `"status" VARCHAR(10) DEFAULT ('active')`);
    await this.addColumnIfMissing(queryRunner, "year_repartition", "closedAt", `"closedAt" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "grade", "order", `"order" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "grade", "nextGradeId", `"nextGradeId" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "payment_configs", "schoolYear", `"schoolYear" VARCHAR NULL`);
    await this.addColumnIfMissing(queryRunner, "payment_annual_config", "schoolYear", `"schoolYear" VARCHAR NULL`);
    await this.addColumnIfMissing(queryRunner, "grading_config", "schoolYear", `"schoolYear" VARCHAR NULL`);

    await this.backfillStatus(queryRunner);

    const now = new Date();
    for (const t of ["year_repartition", "payment_configs", "payment_annual_config", "grading_config", "payments", "expenses", "cash_movements", "bank_transactions", "fee_items", "T_student"]) {
      try {
        await this.normalizeTable(queryRunner, t, "schoolYear", now);
      } catch { /* table absente ? ignore */ }
    }
    // year_repartition utilise schoolYear aussi (même colonne) — déjà couverte ci-dessus.
    try {
      await this.normalizeTable(queryRunner, "scholarship", "schoolYear", now);
    } catch { /* ignore */ }

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_payment_configs_schoolYear" ON "payment_configs" ("schoolYear")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_payment_annual_config_schoolYear" ON "payment_annual_config" ("schoolYear")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_grading_config_schoolYear" ON "grading_config" ("schoolYear")`);
  }

  public async down(): Promise<void> {
    // Append-only : pas de rollback destructif.
  }
}
