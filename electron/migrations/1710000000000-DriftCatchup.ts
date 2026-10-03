import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * DriftCatchup1710000000000 — rattrapage idempotent du drift vs schema 1.1.14.
 *
 * Source de verite : entities TypeORM actuelles
 * (professor, payment, professorPayment, accounting, scheduleConfig,
 *  course/grade) + supabase/migrations/002_accounting.sql (reference idempotente).
 *
 * REGLES SANS BREAK (strict) :
 * - CREATE TABLE IF NOT EXISTS uniquement (jamais de CREATE sans IF NOT EXISTS).
 * - ALTER TABLE ... ADD COLUMN uniquement si la colonne manque (hasColumn guard).
 * - Jamais de DROP COLUMN / DROP TABLE.
 * - Jamais de NOT NULL sans DEFAULT (SQLite refuse ADD COLUMN NOT NULL sans default
 *   sur table peuplee ; on ajoute NULLABLE ou DEFAULT puis resserrement metier).
 * - Uniques sur colonnes NULLABLE via index partiels :
 *   CREATE UNIQUE INDEX IF NOT EXISTS ... WHERE col IS NOT NULL.
 * - course.gradeId (deprecated ManyToOne) est CONSERVE — aucun DROP.
 *
 * Decimaux : DECIMAL(14,2) partout (snapshot currency par ecriture).
 * Supabase 002 utilisait NUMERIC(12,0) : SQLite etant a typage dynamique,
 * on ne reecrit pas les colonnes existantes (rebuild destructif interdit) ;
 * les CREATE TABLE des tables neuves portent deja le 14,2.
 */
export class DriftCatchup1710000000000 implements MigrationInterface {
  name = "DriftCatchup1710000000000";
  public readonly timestamp = 1710000000000;

  private async addColumnIfMissing(
    q: QueryRunner,
    table: string,
    column: string,
    definition: string,
  ): Promise<void> {
    const has = await q.hasColumn(table, column);
    if (!has) {
      await q.query(`ALTER TABLE "${table}" ADD COLUMN ${definition}`);
    }
  }

  private async uniqueWhereNotNull(
    q: QueryRunner,
    index: string,
    table: string,
    columns: string,
  ): Promise<void> {
    const clean = columns
      .split(",")
      .map((c) => c.trim().replace(/^"+|"+$/g, ""));
    // Filet 177 : sur table pré-existante partielle, la colonne peut manquer
    // (le CREATE IF NOT EXISTS est alors no-op et aucun ADD COLUMN ne l'a
    // ajoutée ici). Créer l'index planterait ("no such column") à chaque boot
    // → on saute (warn), la 177 converge colonnes PUIS index.
    for (const c of clean) {
      if (!(await q.hasColumn(table, c))) {
        console.warn(`[migration-171] skip ${index} : ${table}.${c} absente (filet 177)`);
        return;
      }
    }
    const cols = clean.map((c) => `"${c}" IS NOT NULL`).join(" AND ");
    const colList = clean.map((c) => `"${c}"`).join(", ");
    await q.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "${index}" ON "${table}" (${colList}) WHERE ${cols}`,
    );
  }

  private async indexIfMissing(q: QueryRunner, index: string, ddl: string): Promise<void> {
    await q.query(ddl.replace("__INDEX__", `"${index}"`));
  }

  /**
   * indexOnExistingColumns — comme indexIfMissing mais saute (warn) si une
   * colonne requise manque sur une table pré-existante partielle (filet 177).
   */
  private async indexOnExistingColumns(
    q: QueryRunner,
    index: string,
    table: string,
    columns: string[],
    ddl: string,
  ): Promise<void> {
    for (const c of columns) {
      if (!(await q.hasColumn(table, c))) {
        console.warn(`[migration-171] skip ${index} : ${table}.${c} absente (filet 177)`);
        return;
      }
    }
    await this.indexIfMissing(q, index, ddl);
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ------------------------------------------------ 1. schedule_configs (NEUVE)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "schedule_configs" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "class_id" INTEGER NULL,
        "start_hour" INTEGER DEFAULT (8),
        "end_hour" INTEGER DEFAULT (18),
        "slot_duration" INTEGER DEFAULT (60),
        "lunch_start" INTEGER DEFAULT (12),
        "lunch_end" INTEGER DEFAULT (14),
        "start_minutes" INTEGER DEFAULT (0),
        "end_minutes" INTEGER DEFAULT (0),
        "lunch_start_minutes" INTEGER DEFAULT (0),
        "lunch_end_minutes" INTEGER DEFAULT (0),
        "created_at" DATETIME DEFAULT (CURRENT_TIMESTAMP),
        "updated_at" DATETIME DEFAULT (CURRENT_TIMESTAMP)
      )`);

    // --------------------------------------- 2. Tables comptables (NEUVES, 14,2)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "expenses" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "remote_id" VARCHAR(36) NULL,
        "user_id" VARCHAR(36) NULL,
        "label" VARCHAR(255) NULL,
        "category" VARCHAR(100) NULL,
        "amount" DECIMAL(14,2) DEFAULT (0),
        "currency" VARCHAR(10) NULL,
        "expenseDate" DATE NULL,
        "paymentMethod" VARCHAR(50) DEFAULT ('cash'),
        "status" VARCHAR(20) DEFAULT ('pending'),
        "receiptNumber" VARCHAR(20) NULL,
        "idempotencyKey" VARCHAR(64) NULL,
        "studentId" VARCHAR(20) NULL,
        "schoolYear" VARCHAR NULL,
        "comment" VARCHAR NULL,
        "created_at" DATETIME DEFAULT (CURRENT_TIMESTAMP),
        "updated_at" DATETIME NULL,
        "deleted_at" DATETIME NULL
      )`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cash_registers" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "remote_id" VARCHAR(36) NULL,
        "user_id" VARCHAR(36) NULL,
        "name" VARCHAR(100) NULL,
        "registerDate" DATE NULL,
        "openingBalance" DECIMAL(14,2) DEFAULT (0),
        "closingBalance" DECIMAL(14,2) DEFAULT (0),
        "currency" VARCHAR(10) NULL,
        "status" VARCHAR(20) DEFAULT ('open'),
        "created_at" DATETIME DEFAULT (CURRENT_TIMESTAMP),
        "updated_at" DATETIME NULL,
        "deleted_at" DATETIME NULL
      )`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cash_movements" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "remote_id" VARCHAR(36) NULL,
        "user_id" VARCHAR(36) NULL,
        "registerId" INTEGER NULL,
        "direction" VARCHAR(10) NULL,
        "amount" DECIMAL(14,2) DEFAULT (0),
        "currency" VARCHAR(10) NULL,
        "motive" VARCHAR(255) NULL,
        "reference" VARCHAR(20) NULL,
        "idempotencyKey" VARCHAR(64) NULL,
        "paymentId" INTEGER NULL,
        "expenseId" INTEGER NULL,
        "movementDate" DATE NULL,
        "schoolYear" VARCHAR NULL,
        "created_at" DATETIME DEFAULT (CURRENT_TIMESTAMP)
      )`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cash_closures" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "remote_id" VARCHAR(36) NULL,
        "user_id" VARCHAR(36) NULL,
        "registerId" INTEGER NULL,
        "closureDate" DATE NULL,
        "expectedAmount" DECIMAL(14,2) DEFAULT (0),
        "countedAmount" DECIMAL(14,2) DEFAULT (0),
        "gap" DECIMAL(14,2) DEFAULT (0),
        "currency" VARCHAR(10) NULL,
        "validatedBy" VARCHAR(100) NULL,
        "comment" VARCHAR NULL,
        "created_at" DATETIME DEFAULT (CURRENT_TIMESTAMP),
        "updated_at" DATETIME NULL
      )`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "bank_accounts" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "remote_id" VARCHAR(36) NULL,
        "user_id" VARCHAR(36) NULL,
        "bankName" VARCHAR(150) NULL,
        "accountNumber" VARCHAR(64) NULL,
        "iban" VARCHAR(64) NULL,
        "balance" DECIMAL(14,2) DEFAULT (0),
        "currency" VARCHAR(10) DEFAULT ('GNF'),
        "created_at" DATETIME DEFAULT (CURRENT_TIMESTAMP),
        "updated_at" DATETIME NULL,
        "deleted_at" DATETIME NULL
      )`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "bank_transactions" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "remote_id" VARCHAR(36) NULL,
        "user_id" VARCHAR(36) NULL,
        "accountId" INTEGER NULL,
        "direction" VARCHAR(10) NULL,
        "amount" DECIMAL(14,2) DEFAULT (0),
        "currency" VARCHAR(10) NULL,
        "idempotencyKey" VARCHAR(64) NULL,
        "transactionDate" DATE NULL,
        "reference" VARCHAR(64) NULL,
        "label" VARCHAR(255) NULL,
        "schoolYear" VARCHAR NULL,
        "created_at" DATETIME DEFAULT (CURRENT_TIMESTAMP),
        "updated_at" DATETIME NULL,
        "deleted_at" DATETIME NULL
      )`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "teacher_hour_logs" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "remote_id" VARCHAR(36) NULL,
        "user_id" VARCHAR(36) NULL,
        "professorId" INTEGER NULL,
        "month" VARCHAR(7) NULL,
        "hours" DECIMAL(7,2) DEFAULT (0),
        "hourlyRate" DECIMAL(14,2) DEFAULT (0),
        "subject" VARCHAR(100) NULL,
        "classId" INTEGER NULL,
        "validated" INTEGER DEFAULT (0),
        "created_at" DATETIME DEFAULT (CURRENT_TIMESTAMP),
        "updated_at" DATETIME NULL,
        "deleted_at" DATETIME NULL
      )`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "salary_slips" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "remote_id" VARCHAR(36) NULL,
        "user_id" VARCHAR(36) NULL,
        "professorId" INTEGER NULL,
        "month" VARCHAR(7) NULL,
        "hoursTotal" DECIMAL(7,2) DEFAULT (0),
        "hourlyRate" DECIMAL(14,2) DEFAULT (0),
        "grossAmount" DECIMAL(14,2) DEFAULT (0),
        "netAmount" DECIMAL(14,2) DEFAULT (0),
        "currency" VARCHAR(10) NULL,
        "deductions" TEXT NULL,
        "additions" TEXT NULL,
        "status" VARCHAR(20) DEFAULT ('brouillon'),
        "paymentId" INTEGER NULL,
        "created_at" DATETIME DEFAULT (CURRENT_TIMESTAMP),
        "updated_at" DATETIME NULL,
        "deleted_at" DATETIME NULL
      )`);

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

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "fee_items" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "remote_id" VARCHAR(36) NULL,
        "user_id" VARCHAR(36) NULL,
        "name" VARCHAR(150) NULL,
        "category" VARCHAR(100) NULL,
        "amount" DECIMAL(14,2) DEFAULT (0),
        "currency" VARCHAR(10) NULL,
        "gradeId" INTEGER NULL,
        "schoolYear" VARCHAR NULL,
        "isActive" INTEGER DEFAULT (1),
        "created_at" DATETIME DEFAULT (CURRENT_TIMESTAMP),
        "updated_at" DATETIME NULL,
        "deleted_at" DATETIME NULL
      )`);

    // --------------------------------------- 3. Jointure course_grades (NEUVE)
    // ManyToMany Course <-> Grade. Ne touche PAS a course.gradeId (deprecated).
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "course_grades" (
        "courseId" INTEGER NOT NULL,
        "gradeId" INTEGER NOT NULL,
        PRIMARY KEY ("courseId", "gradeId")
      )`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_course_grades_course" ON "course_grades" ("courseId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_course_grades_grade" ON "course_grades" ("gradeId")`,
    );

    // --------------------------------------- 4. Drift colonnes professors
    await this.addColumnIfMissing(queryRunner, "professors", "color", `"color" VARCHAR(9) DEFAULT ('#409EFF')`);
    await this.addColumnIfMissing(queryRunner, "professors", "hourlyRate", `"hourlyRate" DECIMAL(14,2) DEFAULT (0)`);
    await this.addColumnIfMissing(queryRunner, "professors", "paymentMode", `"paymentMode" VARCHAR(20) DEFAULT ('monthly')`);
    await this.addColumnIfMissing(queryRunner, "professors", "remote_id", `"remote_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "professors", "user_id", `"user_id" VARCHAR(36) NULL`);

    // --------------------------------------- 5. Drift colonnes payments
    await this.addColumnIfMissing(queryRunner, "payments", "receiptNumber", `"receiptNumber" VARCHAR(20) NULL`);
    await this.addColumnIfMissing(queryRunner, "payments", "idempotencyKey", `"idempotencyKey" VARCHAR(64) NULL`);
    await this.addColumnIfMissing(queryRunner, "payments", "currency", `"currency" VARCHAR(10) NULL`);
    await this.addColumnIfMissing(queryRunner, "payments", "studentId", `"studentId" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "payments", "remote_id", `"remote_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "payments", "user_id", `"user_id" VARCHAR(36) NULL`);

    // --------------------------------------- 6. Drift colonnes professor_payments
    await this.addColumnIfMissing(queryRunner, "professor_payments", "reference", `"reference" VARCHAR(32) NULL`);
    await this.addColumnIfMissing(queryRunner, "professor_payments", "hoursTotal", `"hoursTotal" DECIMAL(7,2) DEFAULT (0)`);
    await this.addColumnIfMissing(queryRunner, "professor_payments", "hourlyRate", `"hourlyRate" DECIMAL(14,2) DEFAULT (0)`);
    await this.addColumnIfMissing(queryRunner, "professor_payments", "salarySlipId", `"salarySlipId" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "professor_payments", "currency", `"currency" VARCHAR(10) NULL`);
    await this.addColumnIfMissing(queryRunner, "professor_payments", "idempotencyKey", `"idempotencyKey" VARCHAR(64) NULL`);
    await this.addColumnIfMissing(queryRunner, "professor_payments", "remote_id", `"remote_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "professor_payments", "user_id", `"user_id" VARCHAR(36) NULL`);

    // --------------------------------------- 7. Drift colonnes accounting (sync remote + snapshot devise)
    await this.addColumnIfMissing(queryRunner, "expenses", "currency", `"currency" VARCHAR(10) NULL`);
    await this.addColumnIfMissing(queryRunner, "expenses", "idempotencyKey", `"idempotencyKey" VARCHAR(64) NULL`);
    await this.addColumnIfMissing(queryRunner, "expenses", "studentId", `"studentId" VARCHAR(20) NULL`);
    await this.addColumnIfMissing(queryRunner, "expenses", "remote_id", `"remote_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "expenses", "user_id", `"user_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "cash_registers", "currency", `"currency" VARCHAR(10) NULL`);
    await this.addColumnIfMissing(queryRunner, "cash_registers", "remote_id", `"remote_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "cash_registers", "user_id", `"user_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "cash_movements", "reference", `"reference" VARCHAR(20) NULL`);
    await this.addColumnIfMissing(queryRunner, "cash_movements", "currency", `"currency" VARCHAR(10) NULL`);
    await this.addColumnIfMissing(queryRunner, "cash_movements", "idempotencyKey", `"idempotencyKey" VARCHAR(64) NULL`);
    await this.addColumnIfMissing(queryRunner, "cash_movements", "remote_id", `"remote_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "cash_movements", "user_id", `"user_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "cash_closures", "currency", `"currency" VARCHAR(10) NULL`);
    await this.addColumnIfMissing(queryRunner, "cash_closures", "remote_id", `"remote_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "cash_closures", "user_id", `"user_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "bank_accounts", "remote_id", `"remote_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "bank_accounts", "user_id", `"user_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "bank_transactions", "currency", `"currency" VARCHAR(10) NULL`);
    await this.addColumnIfMissing(queryRunner, "bank_transactions", "idempotencyKey", `"idempotencyKey" VARCHAR(64) NULL`);
    await this.addColumnIfMissing(queryRunner, "bank_transactions", "remote_id", `"remote_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "bank_transactions", "user_id", `"user_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "teacher_hour_logs", "remote_id", `"remote_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "teacher_hour_logs", "user_id", `"user_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "salary_slips", "currency", `"currency" VARCHAR(10) NULL`);
    await this.addColumnIfMissing(queryRunner, "salary_slips", "remote_id", `"remote_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "salary_slips", "user_id", `"user_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "fee_items", "currency", `"currency" VARCHAR(10) NULL`);
    await this.addColumnIfMissing(queryRunner, "fee_items", "remote_id", `"remote_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "fee_items", "user_id", `"user_id" VARCHAR(36) NULL`);

    // NOTE : course.gradeId (deprecated) volontairement inchange — pas de DROP.

    // --------------------------------------- 8. Index uniques partiels (NULL-safe)
    await this.uniqueWhereNotNull(queryRunner, "UQ_professors_remote_id", "professors", `"remote_id"`);
    await this.uniqueWhereNotNull(queryRunner, "UQ_payments_receiptNumber", "payments", `"receiptNumber"`);
    await this.uniqueWhereNotNull(queryRunner, "UQ_payments_idempotencyKey", "payments", `"idempotencyKey"`);
    await this.uniqueWhereNotNull(queryRunner, "UQ_payments_remote_id", "payments", `"remote_id"`);
    await this.uniqueWhereNotNull(queryRunner, "UQ_prof_payments_reference", "professor_payments", `"reference"`);
    await this.uniqueWhereNotNull(queryRunner, "UQ_prof_payments_idempotencyKey", "professor_payments", `"idempotencyKey"`);
    await this.uniqueWhereNotNull(queryRunner, "UQ_prof_payments_remote_id", "professor_payments", `"remote_id"`);
    await this.uniqueWhereNotNull(queryRunner, "UQ_expenses_idempotencyKey", "expenses", `"idempotencyKey"`);
    await this.uniqueWhereNotNull(queryRunner, "UQ_expenses_remote_id", "expenses", `"remote_id"`);
    await this.uniqueWhereNotNull(queryRunner, "UQ_cash_movements_idempotencyKey", "cash_movements", `"idempotencyKey"`);
    await this.uniqueWhereNotNull(queryRunner, "UQ_cash_movements_remote_id", "cash_movements", `"remote_id"`);
    await this.uniqueWhereNotNull(queryRunner, "UQ_bank_tx_idempotencyKey", "bank_transactions", `"idempotencyKey"`);
    await this.uniqueWhereNotNull(queryRunner, "UQ_bank_tx_remote_id", "bank_transactions", `"remote_id"`);
    await this.uniqueWhereNotNull(queryRunner, "UQ_bank_accounts_accountNumber", "bank_accounts", `"accountNumber"`);
    await this.uniqueWhereNotNull(queryRunner, "UQ_bank_accounts_remote_id", "bank_accounts", `"remote_id"`);
    await this.uniqueWhereNotNull(queryRunner, "UQ_cash_registers_remote_id", "cash_registers", `"remote_id"`);
    await this.uniqueWhereNotNull(queryRunner, "UQ_cash_closures_remote_id", "cash_closures", `"remote_id"`);
    await this.uniqueWhereNotNull(queryRunner, "UQ_hourlogs_remote_id", "teacher_hour_logs", `"remote_id"`);
    await this.uniqueWhereNotNull(queryRunner, "UQ_salary_slips_remote_id", "salary_slips", `"remote_id"`);
    await this.uniqueWhereNotNull(queryRunner, "UQ_fee_items_remote_id", "fee_items", `"remote_id"`);

    // --------------------------------------- 9. Index metier (IF NOT EXISTS,
    // guardé colonnes : no-op warn sur table partielle, filet 177)
    await this.indexOnExistingColumns(queryRunner, "IDX_payment_receiptNumber", "payments", ["receiptNumber"], `CREATE INDEX IF NOT EXISTS __INDEX__ ON "payments" ("receiptNumber")`);
    await this.indexOnExistingColumns(queryRunner, "IDX_expense_studentId", "expenses", ["studentId"], `CREATE INDEX IF NOT EXISTS __INDEX__ ON "expenses" ("studentId")`);
    await this.indexOnExistingColumns(queryRunner, "UQ_cash_register_name_date", "cash_registers", ["name", "registerDate"], `CREATE UNIQUE INDEX IF NOT EXISTS __INDEX__ ON "cash_registers" ("name", "registerDate")`);
    await this.indexOnExistingColumns(queryRunner, "UQ_salary_slip_prof_month", "salary_slips", ["professorId", "month"], `CREATE UNIQUE INDEX IF NOT EXISTS __INDEX__ ON "salary_slips" ("professorId", "month")`);
    await this.indexOnExistingColumns(queryRunner, "IDX_hourlog_prof_month", "teacher_hour_logs", ["professorId", "month"], `CREATE INDEX IF NOT EXISTS __INDEX__ ON "teacher_hour_logs" ("professorId", "month")`);
    await this.indexOnExistingColumns(queryRunner, "IDX_feeitem_schoolYear", "fee_items", ["schoolYear"], `CREATE INDEX IF NOT EXISTS __INDEX__ ON "fee_items" ("schoolYear")`);
  }

  public async down(): Promise<void> {
    // Append-only : pas de rollback destructif (tables/colonnes conservees).
  }
}
