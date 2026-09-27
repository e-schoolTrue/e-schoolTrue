import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * BackfillCounters1720000000000 — amorce non-destructive des compteurs.
 *
 * - Lit MAX(receiptNumber) au format R-YYYY-NNNN dans payments.
 * - INSERT OR IGNORE dans receipt_counters(year, lastNumber).
 * - UPDATE uniquement croissant (jamais de baisse) : WHERE lastNumber < max.
 * - Idempotent et rejouable : aucun DELETE, aucun reset.
 * - Bonus symetrique : professor_payment_counters depuis
 *   professor_payments.reference LIKE 'PAY-ENS-YYYY-NNNN' (meme regle).
 */
export class BackfillCounters1720000000000 implements MigrationInterface {
  name = "BackfillCounters1720000000000";
  public readonly timestamp = 1720000000000;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "receipt_counters" (
        "year" INTEGER PRIMARY KEY NOT NULL,
        "lastNumber" INTEGER DEFAULT (0),
        "updated_at" DATETIME NULL
      )`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "professor_payment_counters" (
        "year" INTEGER PRIMARY KEY NOT NULL,
        "lastNumber" INTEGER DEFAULT (0),
        "updated_at" DATETIME NULL
      )`);

    const hasPayments = await queryRunner.hasTable("payments");
    if (hasPayments) {
      const rows: Array<{ year: number; maxNum: number }> = await queryRunner.query(`
        SELECT CAST(substr("receiptNumber", 3, 4) AS INTEGER) AS "year",
               MAX(CAST(substr("receiptNumber", 8) AS INTEGER)) AS "maxNum"
        FROM "payments"
        WHERE "receiptNumber" LIKE 'R-____-%'
          AND length("receiptNumber") >= 8
        GROUP BY CAST(substr("receiptNumber", 3, 4) AS INTEGER)
      `);
      for (const r of rows) {
        const year = Number(r.year);
        const maxNum = Number(r.maxNum);
        if (!Number.isFinite(year) || !Number.isFinite(maxNum)) continue;
        await queryRunner.query(
          `INSERT OR IGNORE INTO "receipt_counters" ("year", "lastNumber") VALUES (?, ?)`,
          [year, maxNum],
        );
        await queryRunner.query(
          `UPDATE "receipt_counters" SET "lastNumber" = ? WHERE "year" = ? AND "lastNumber" < ?`,
          [maxNum, year, maxNum],
        );
      }
    }

    const hasProfPayments = await queryRunner.hasTable("professor_payments");
    if (hasProfPayments) {
      const hasRef = await queryRunner.hasColumn("professor_payments", "reference");
      if (hasRef) {
        const rows: Array<{ year: number; maxNum: number }> = await queryRunner.query(`
          SELECT CAST(substr("reference", 9, 4) AS INTEGER) AS "year",
                 MAX(CAST(substr("reference", 14) AS INTEGER)) AS "maxNum"
          FROM "professor_payments"
          WHERE "reference" LIKE 'PAY-ENS-____-%'
            AND length("reference") >= 14
          GROUP BY CAST(substr("reference", 9, 4) AS INTEGER)
        `);
        for (const r of rows) {
          const year = Number(r.year);
          const maxNum = Number(r.maxNum);
          if (!Number.isFinite(year) || !Number.isFinite(maxNum)) continue;
          await queryRunner.query(
            `INSERT OR IGNORE INTO "professor_payment_counters" ("year", "lastNumber") VALUES (?, ?)`,
            [year, maxNum],
          );
          await queryRunner.query(
            `UPDATE "professor_payment_counters" SET "lastNumber" = ? WHERE "year" = ? AND "lastNumber" < ?`,
            [maxNum, year, maxNum],
          );
        }
      }
    }
  }

  public async down(): Promise<void> {
    // Pas de rollback destructif des compteurs.
  }
}
