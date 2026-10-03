import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * DriftCatchup2175000000000 — rattrapage idempotent du drift vs entities
 * (train unique : schoolyear + backup + hardening).
 *
 * Couvre les tables absentes des vieilles bases `synchronize` :
 * payment_annual_config, mensuality_tranch, inscription_fee, grading_config,
 * evaluation_category, grade_entry, calculated_grade, audit_log,
 * document_content, schedules, teaching_grades (+ schoolYear/remote_id
 * manquants sur les tables existantes).
 *
 * RÈGLES SANS BREAK (strict, cf. ADR NULLABLE/DEFAULT) :
 * - CREATE TABLE IF NOT EXISTS uniquement.
 * - ALTER TABLE ... ADD COLUMN uniquement si la colonne manque (hasColumn).
 * - Jamais de DROP TABLE / DROP COLUMN.
 * - Jamais de NOT NULL sans DEFAULT (colonnes ajoutées NULLABLE ou DEFAULT ;
 *   seules les PK auto-générées portent NOT NULL).
 * - Aucun index UNIQUE ici (les uniques NULL-safe partiels vivent en 171) ;
 *   seuls des INDEX simples IF NOT EXISTS.
 * - down() no-op (append-only).
 * - COUNT/SUM loggés par table (traçabilité, zéro assert bloquant).
 */
export class DriftCatchup2175000000000 implements MigrationInterface {
  name = "DriftCatchup2175000000000";
  public readonly timestamp = 1750000000000;

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
      console.log(`[migration-175] ${table}: COUNT=${Number(rows?.[0]?.count ?? -1)}`);
    } catch {
      /* table absente ? best-effort */
    }
  }

  /**
   * indexIfColumnsExist — CREATE INDEX IF NOT EXISTS guardé colonnes.
   * Filet 177 : sur table pré-existante partielle (CREATE no-op + ADD COLUMN
   * partiel), l'index planterait ("no such column") à chaque boot → on saute
   * (warn), la 177 converge colonnes PUIS index.
   */
  private async indexIfColumnsExist(
    q: QueryRunner,
    table: string,
    columns: string[],
    ddl: string,
  ): Promise<void> {
    for (const c of columns) {
      if (!(await q.hasColumn(table, c))) {
        console.warn(`[migration-175] skip index : ${table}.${c} absente (filet 177)`);
        return;
      }
    }
    await q.query(ddl);
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --------------------------------------- 1. payment_annual_config
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payment_annual_config" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "remote_id" VARCHAR(36) NULL,
        "trancheCount" NUMERIC NULL,
        "schoolYear" VARCHAR NULL,
        "gradeId" INTEGER NULL
      )`);
    await this.addColumnIfMissing(queryRunner, "payment_annual_config", "remote_id", `"remote_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "payment_annual_config", "trancheCount", `"trancheCount" NUMERIC NULL`);
    await this.addColumnIfMissing(queryRunner, "payment_annual_config", "schoolYear", `"schoolYear" VARCHAR NULL`);
    await this.addColumnIfMissing(queryRunner, "payment_annual_config", "gradeId", `"gradeId" INTEGER NULL`);
    await this.indexIfColumnsExist(queryRunner, "payment_annual_config", ["schoolYear"], `CREATE INDEX IF NOT EXISTS "IDX_payment_annual_config_schoolYear" ON "payment_annual_config" ("schoolYear")`);
    await this.logCount(queryRunner, "payment_annual_config");

    // --------------------------------------- 2. mensuality_tranch (TrancheEntry)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "mensuality_tranch" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "remote_id" VARCHAR(36) NULL,
        "startDate" DATE NULL,
        "endDate" DATE NULL,
        "tranchConfigId" INTEGER NULL
      )`);
    await this.addColumnIfMissing(queryRunner, "mensuality_tranch", "remote_id", `"remote_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "mensuality_tranch", "startDate", `"startDate" DATE NULL`);
    await this.addColumnIfMissing(queryRunner, "mensuality_tranch", "endDate", `"endDate" DATE NULL`);
    await this.addColumnIfMissing(queryRunner, "mensuality_tranch", "tranchConfigId", `"tranchConfigId" INTEGER NULL`);
    await this.logCount(queryRunner, "mensuality_tranch");

    // --------------------------------------- 3. inscription_fee
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "inscription_fee" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "remote_id" VARCHAR(36) NULL,
        "inscriptionFeeAmount" DECIMAL(14,2) NULL,
        "gradeId" INTEGER NULL
      )`);
    await this.addColumnIfMissing(queryRunner, "inscription_fee", "remote_id", `"remote_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "inscription_fee", "inscriptionFeeAmount", `"inscriptionFeeAmount" DECIMAL(14,2) NULL`);
    await this.addColumnIfMissing(queryRunner, "inscription_fee", "gradeId", `"gradeId" INTEGER NULL`);
    await this.logCount(queryRunner, "inscription_fee");

    // --------------------------------------- 4. grading_config
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "grading_config" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "remote_id" VARCHAR(36) NULL,
        "schoolId" INTEGER NULL,
        "classId" INTEGER NULL,
        "subjectId" INTEGER NULL,
        "period" VARCHAR(100) NULL,
        "finalGradeBase" FLOAT DEFAULT (20),
        "calculationStrategy" VARCHAR DEFAULT ('WEIGHTED'),
        "normalizeScores" BOOLEAN DEFAULT (1),
        "description" VARCHAR NULL,
        "schoolYear" VARCHAR NULL,
        "createdAt" DATETIME NULL,
        "updatedAt" DATETIME NULL
      )`);
    await this.addColumnIfMissing(queryRunner, "grading_config", "remote_id", `"remote_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "grading_config", "schoolYear", `"schoolYear" VARCHAR NULL`);
    await this.addColumnIfMissing(queryRunner, "grading_config", "description", `"description" VARCHAR NULL`);
    await this.indexIfColumnsExist(queryRunner, "grading_config", ["schoolYear"], `CREATE INDEX IF NOT EXISTS "IDX_grading_config_schoolYear" ON "grading_config" ("schoolYear")`);
    await this.logCount(queryRunner, "grading_config");

    // --------------------------------------- 5. evaluation_category
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "evaluation_category" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "remote_id" VARCHAR(36) NULL,
        "name" VARCHAR(100) NULL,
        "code" VARCHAR(10) NULL,
        "weight" FLOAT DEFAULT (1),
        "defaultMaxScore" FLOAT DEFAULT (20),
        "minEntries" INTEGER NULL,
        "maxEntries" INTEGER NULL,
        "color" VARCHAR(7) DEFAULT ('#3498db'),
        "displayOrder" INTEGER DEFAULT (0),
        "isExam" BOOLEAN DEFAULT (0),
        "configId" INTEGER NULL
      )`);
    await this.addColumnIfMissing(queryRunner, "evaluation_category", "remote_id", `"remote_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "evaluation_category", "configId", `"configId" INTEGER NULL`);
    await this.logCount(queryRunner, "evaluation_category");

    // --------------------------------------- 6. grade_entry
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "grade_entry" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "remote_id" VARCHAR(36) NULL,
        "studentId" INTEGER NULL,
        "courseId" INTEGER NULL,
        "categoryId" INTEGER NULL,
        "period" VARCHAR(100) NULL,
        "score" FLOAT NULL,
        "maxScore" FLOAT NULL,
        "label" VARCHAR(200) NULL,
        "evaluationDate" DATE NULL,
        "comment" TEXT NULL,
        "createdAt" DATETIME NULL,
        "updatedAt" DATETIME NULL
      )`);
    await this.addColumnIfMissing(queryRunner, "grade_entry", "remote_id", `"remote_id" VARCHAR(36) NULL`);
    await this.indexIfColumnsExist(queryRunner, "grade_entry", ["studentId", "courseId", "period"], `CREATE INDEX IF NOT EXISTS "IDX_grade_entry_student_course_period" ON "grade_entry" ("studentId", "courseId", "period")`);
    await this.logCount(queryRunner, "grade_entry");

    // --------------------------------------- 7. calculated_grade
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "calculated_grade" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "remote_id" VARCHAR(36) NULL,
        "studentId" INTEGER NULL,
        "courseId" INTEGER NULL,
        "period" VARCHAR(100) NULL,
        "finalAverage" FLOAT NULL,
        "configId" INTEGER NULL,
        "categoryBreakdown" TEXT NULL,
        "appreciation" TEXT NULL,
        "createdAt" DATETIME NULL,
        "updatedAt" DATETIME NULL
      )`);
    await this.addColumnIfMissing(queryRunner, "calculated_grade", "remote_id", `"remote_id" VARCHAR(36) NULL`);
    await this.indexIfColumnsExist(queryRunner, "calculated_grade", ["studentId", "courseId", "period"], `CREATE INDEX IF NOT EXISTS "IDX_calculated_grade_student_course_period" ON "calculated_grade" ("studentId", "courseId", "period")`);
    await this.logCount(queryRunner, "calculated_grade");

    // --------------------------------------- 8. audit_log
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "audit_log" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "actorId" INTEGER NULL,
        "actorUsername" VARCHAR NULL,
        "actorRole" VARCHAR NULL,
        "action" VARCHAR NULL,
        "targetEntity" VARCHAR NULL,
        "targetId" VARCHAR NULL,
        "summary" VARCHAR(500) NULL,
        "diff" TEXT NULL,
        "metadata" TEXT NULL,
        "createdAt" DATETIME DEFAULT (CURRENT_TIMESTAMP)
      )`);
    await this.logCount(queryRunner, "audit_log");

    // --------------------------------------- 9. document_content
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "document_content" (
        "id" VARCHAR PRIMARY KEY NOT NULL,
        "remote_id" VARCHAR(36) NULL,
        "inscription" TEXT NULL,
        "scolarite" TEXT NULL,
        "created_at" DATETIME NULL,
        "updated_at" DATETIME NULL
      )`);
    await this.logCount(queryRunner, "document_content");

    // --------------------------------------- 10. schedules
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "schedules" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "remote_id" VARCHAR(36) NULL,
        "professor_id" INTEGER NULL,
        "course_id" INTEGER NULL,
        "class_id" INTEGER NULL,
        "day" VARCHAR(20) NULL,
        "time_slot" VARCHAR(20) NULL,
        "created_at" DATETIME NULL,
        "updated_at" DATETIME NULL
      )`);
    await this.addColumnIfMissing(queryRunner, "schedules", "remote_id", `"remote_id" VARCHAR(36) NULL`);
    await this.indexIfColumnsExist(queryRunner, "schedules", ["professor_id", "day", "time_slot"], `CREATE INDEX IF NOT EXISTS "IDX_schedules_prof_day_slot" ON "schedules" ("professor_id", "day", "time_slot")`);
    await this.logCount(queryRunner, "schedules");

    // --------------------------------------- 11. teaching_grades (jointure)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "teaching_grades" (
        "teaching_id" INTEGER NOT NULL,
        "grade_id" INTEGER NOT NULL,
        PRIMARY KEY ("teaching_id", "grade_id")
      )`);
    await this.indexIfColumnsExist(queryRunner, "teaching_grades", ["teaching_id"], `CREATE INDEX IF NOT EXISTS "IDX_teaching_grades_teaching" ON "teaching_grades" ("teaching_id")`);
    await this.indexIfColumnsExist(queryRunner, "teaching_grades", ["grade_id"], `CREATE INDEX IF NOT EXISTS "IDX_teaching_grades_grade" ON "teaching_grades" ("grade_id")`);
    await this.logCount(queryRunner, "teaching_grades");
  }

  public async down(): Promise<void> {
    // Append-only : pas de rollback destructif.
  }
}
