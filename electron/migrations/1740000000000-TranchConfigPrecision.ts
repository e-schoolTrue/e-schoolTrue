import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * TranchConfigPrecision1740000000000 — fix 1.1.31 (idempotent, sans break).
 *
 * Contexte : passage TranchConfig.amount decimal 10,2 -> 14,2. Avec
 * synchronize:true AVANT runMigrations, TypeORM lançait son copy-swap
 * (CREATE TABLE temporary_tranch_config SANS IF NOT EXISTS). Après une
 * interruption, la table fantôme restait et chaque boot échouait en boucle
 * "already exists" AVANT même le backup.
 *
 * Cette migration remplace le swap implicite par un swap explicite :
 * - guards hasTable/hasColumn partout, jamais de CREATE sans IF NOT EXISTS.
 * - CREATE TABLE IF NOT EXISTS "tranch_config_new" en 14,2.
 * - INSERT OR IGNORE SELECT depuis "tranch_config" (colonnes intersectées).
 * - DROP old + RENAME new -> old (transaction each fournie par le runner).
 * - ADD COLUMN IF MISSING schoolYear (nullable, additif) + INDEX IF NOT EXISTS.
 * - Nettoyage des fantômes temporary_tranch_config / tranch_config_new.
 *
 * Règles : jamais de DROP COLUMN, jamais de NOT NULL sans DEFAULT,
 * down() no-op (append-only). Suit le pattern 171/172/173.
 */
export class TranchConfigPrecision1740000000000 implements MigrationInterface {
  name = "TranchConfigPrecision1740000000000";
  public readonly timestamp = 1740000000000;

  private async addColumnIfMissing(
    q: QueryRunner,
    table: string,
    column: string,
    definition: string,
  ): Promise<void> {
    const hasTable: boolean = await q.hasTable(table);
    if (!hasTable) return;
    if (!(await q.hasColumn(table, column))) {
      await q.query(`ALTER TABLE "${table}" ADD COLUMN ${definition}`);
    }
  }

  private async getDeclaredSql(q: QueryRunner, table: string): Promise<string> {
    try {
      const rows: Array<{ sql: string | null }> = await q.query(
        `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?`,
        [table],
      );
      return String(rows?.[0]?.sql ?? "");
    } catch {
      return "";
    }
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 0. Nettoyage fantômes d'un run interrompu (synchronize ou migration).
    if (await queryRunner.hasTable("temporary_tranch_config")) {
      const hasReal = await queryRunner.hasTable("tranch_config");
      if (hasReal) {
        await queryRunner.query(`DROP TABLE IF EXISTS "temporary_tranch_config"`);
      }
      // Si !hasReal, on laisse : cas historique où le RENAME n'a jamais eu
      // lieu — géré ci-dessous via tranch_config_new.
    }
    // 0b. Fresh : purge aussi tranch_config_new résiduel (rename interrompu
    // sans old). Sans ça, le chemin fresh ci-dessous sortirait tôt en
    // laissant un fantôme _new qui fausse le 2e run.
    const hasOld0 = await queryRunner.hasTable("tranch_config");
    const hasNew0 = await queryRunner.hasTable("tranch_config_new");
    if (!hasOld0 && hasNew0) {
      // Finalisation anticipée traitée en §2 — rien à purger ici.
    } else if (!hasOld0 && !hasNew0) {
      await queryRunner.query(`DROP TABLE IF EXISTS "temporary_tranch_config"`);
    }

    const hasOld = await queryRunner.hasTable("tranch_config");
    const hasNew = await queryRunner.hasTable("tranch_config_new");

    // 1. Fresh install : pas de tranch_config → création directe en 14,2.
    if (!hasOld && !hasNew) {
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "tranch_config" (
          "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
          "remote_id" VARCHAR(36) NULL,
          "tranchName" VARCHAR NOT NULL,
          "amount" DECIMAL(14,2) NOT NULL DEFAULT (0),
          "tranchMonthCount" INTEGER NULL,
          "paymentAnnualConfigId" INTEGER NULL,
          "schoolYear" VARCHAR NULL,
          CONSTRAINT "FK_tranch_config_annual" FOREIGN KEY ("paymentAnnualConfigId") REFERENCES "payment_annual_config" ("id") ON DELETE CASCADE
        )`);
      await queryRunner.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_tranch_config_remote_id" ON "tranch_config" ("remote_id") WHERE "remote_id" IS NOT NULL`,
      );
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS "IDX_tranch_config_schoolYear" ON "tranch_config" ("schoolYear")`,
      );
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS "IDX_tranch_config_annual" ON "tranch_config" ("paymentAnnualConfigId")`,
      );
      return;
    }

    // 2. Ancien absent mais new présent (rename interrompu) → finaliser.
    if (!hasOld && hasNew) {
      await queryRunner.query(`ALTER TABLE "tranch_config_new" RENAME TO "tranch_config"`);
      await this.addColumnIfMissing(queryRunner, "tranch_config", "schoolYear", `"schoolYear" VARCHAR NULL`);
      await queryRunner.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_tranch_config_remote_id" ON "tranch_config" ("remote_id") WHERE "remote_id" IS NOT NULL`,
      );
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS "IDX_tranch_config_schoolYear" ON "tranch_config" ("schoolYear")`,
      );
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS "IDX_tranch_config_annual" ON "tranch_config" ("paymentAnnualConfigId")`,
      );
      return;
    }

    // 3. Les deux existent : new = résidu stale → drop pour rebuild propre.
    if (hasOld && hasNew) {
      await queryRunner.query(`DROP TABLE IF EXISTS "tranch_config_new"`);
    }

    // 4. Déjà en 14,2 ? SQLite garde le DDL déclaré → si "14,2" présent,
    // pas de copy-swap, juste colonnes + index manquants.
    const declared = await this.getDeclaredSql(queryRunner, "tranch_config");
    const already142 = /DECIMAL\s*\(\s*14\s*,\s*2\s*\)/i.test(declared);
    // Cas legacy 10,2 explicite ou DDL sans précision (synchronize ancien).
    if (already142) {
      await this.addColumnIfMissing(queryRunner, "tranch_config", "schoolYear", `"schoolYear" VARCHAR NULL`);
      // paymentAnnualConfigId peut manquer sur de très vieilles bases sync.
      await this.addColumnIfMissing(
        queryRunner,
        "tranch_config",
        "paymentAnnualConfigId",
        `"paymentAnnualConfigId" INTEGER NULL`,
      );
      await queryRunner.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_tranch_config_remote_id" ON "tranch_config" ("remote_id") WHERE "remote_id" IS NOT NULL`,
      );
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS "IDX_tranch_config_schoolYear" ON "tranch_config" ("schoolYear")`,
      );
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS "IDX_tranch_config_annual" ON "tranch_config" ("paymentAnnualConfigId")`,
      );
      return;
    }

    // 5. Copy-swap explicite 10,2 (ou sans précision) -> 14,2.
    // Note FK (SEV-3) : `PRAGMA foreign_keys = OFF` est inopérant À
    // L'INTÉRIEUR d'une transaction SQLite (no-op silencieux) — or le runner
    // joue chaque migration dans sa propre transaction (`transaction: "each"`).
    // On tente `PRAGMA defer_foreign_keys = ON` (best-effort, reporté à la
    // fin de transaction pour les FK DEFERRABLE) ; les FK TypeORM étant
    // IMMEDIATE par défaut, la sécurité réelle vient de l'ordre
    // INSERT(new) → DROP(old) → RENAME, pas du PRAGMA.
    try {
      await queryRunner.query(`PRAGMA defer_foreign_keys = ON`);
    } catch {
      /* best-effort : pragma absent des vieux SQLite */
    }
    try {
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "tranch_config_new" (
          "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
          "remote_id" VARCHAR(36) NULL,
          "tranchName" VARCHAR NOT NULL,
          "amount" DECIMAL(14,2) NOT NULL DEFAULT (0),
          "tranchMonthCount" INTEGER NULL,
          "paymentAnnualConfigId" INTEGER NULL,
          "schoolYear" VARCHAR NULL,
          CONSTRAINT "FK_tranch_config_annual" FOREIGN KEY ("paymentAnnualConfigId") REFERENCES "payment_annual_config" ("id") ON DELETE CASCADE
        )`);

      // Colonnes réellement présentes dans l'ancienne table (intersection sûre).
      const cols: Array<{ name: string }> = await queryRunner.query(`PRAGMA table_info("tranch_config")`);
      const existing = new Set((cols ?? []).map((c) => String(c.name)));
      const wanted = ["id", "remote_id", "tranchName", "amount", "tranchMonthCount", "paymentAnnualConfigId", "schoolYear"];
      const copyCols = wanted.filter((c) => existing.has(c));
      // Snapshot avant copie pour détecter une perte silencieuse
      // (INSERT OR IGNORE ignore les doublons remote_id via l'index UNIQUE).
      let beforeCount = -1;
      let beforeTotal = -1;
      try {
        const before: Array<{ count: number; total: number }> = await queryRunner.query(
          `SELECT COUNT(*) AS "count", COALESCE(SUM("amount"), 0) AS "total" FROM "tranch_config"`
        );
        beforeCount = Number(before?.[0]?.count ?? -1);
        beforeTotal = Number(before?.[0]?.total ?? -1);
      } catch {
        /* best-effort */
      }
      if (copyCols.length > 0) {
        const list = copyCols.map((c) => `"${c}"`).join(", ");
        await queryRunner.query(
          `INSERT OR IGNORE INTO "tranch_config_new" (${list}) SELECT ${list} FROM "tranch_config"`,
        );
        // Assert COUNT/SUM (SEV-3) : warn si perte silencieuse (doublon remote_id).
        try {
          const after: Array<{ count: number }> = await queryRunner.query(
            `SELECT COUNT(*) AS "count" FROM "tranch_config_new"`
          );
          const afterCount = Number(after?.[0]?.count ?? -1);
          if (beforeCount >= 0 && afterCount >= 0 && afterCount !== beforeCount) {
            console.warn(
              `[migration-174] Perte silencieuse ? tranch_config avant=${beforeCount} (SUM=${beforeTotal}) après=${afterCount} (INSERT OR IGNORE, doublon remote_id probable).`
            );
          }
        } catch {
          /* best-effort */
        }
      }

      await queryRunner.query(`DROP TABLE "tranch_config"`);
      await queryRunner.query(`ALTER TABLE "tranch_config_new" RENAME TO "tranch_config"`);

      await queryRunner.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_tranch_config_remote_id" ON "tranch_config" ("remote_id") WHERE "remote_id" IS NOT NULL`,
      );
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS "IDX_tranch_config_schoolYear" ON "tranch_config" ("schoolYear")`,
      );
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS "IDX_tranch_config_annual" ON "tranch_config" ("paymentAnnualConfigId")`,
      );
    } finally {
      try {
        await queryRunner.query(`PRAGMA defer_foreign_keys = OFF`);
      } catch {
        /* best-effort */
      }
    }
  }

  public async down(): Promise<void> {
    // Append-only : pas de rollback destructif.
  }
}
