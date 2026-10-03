import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * DriftCatchup3177000000000 — garant post-install "zéro colonne manquante".
 *
 * Contexte (bug réel vu en clôture : "no such column: status") :
 * - synchronize est OFF depuis 1.1.31 : plus aucune convergence implicite.
 * - ensureBaseline() marque la baseline applied sur les bases legacy SANS
 *   rejouer son up() (SchemaBuilder) → les bases legacy ne reçoivent QUE
 *   les CREATE/ADD COLUMN explicites des migrations 171→176.
 * - Or 171/175 ne couvrent en ADD COLUMN qu'un sous-ensemble (ex. payments
 *   += receiptNumber/idempotencyKey/currency/studentId/remote_id/user_id
 *   mais PAS scholarshipId/baseAmount/adjustedAmount/… ; expenses pré-existante
 *   += currency/idempotencyKey/studentId/remote_id/user_id mais PAS
 *   status/schoolYear/expenseDate/… ; user.role n'est jamais ADD COLUMN —
 *   la 176 fait UPDATE seulement si la colonne existe, sinon no-op).
 * - Résultat : toute colonne d'entité ajoutée après le cutoff synchronize
 *   d'une base legacy manque → "no such column" au premier SELECT/INSERT
 *   (clôture → year_repartition.status, caisse → expenses/cash.status, …).
 *
 * Cette migration rend le schéma convergent par construction :
 * - CREATE TABLE IF NOT EXISTS pour les tables sans CREATE dédié
 *   (accounting_vault + jointures, repeat-safe).
 * - ADD COLUMN IF MISSING (guard hasColumn + hasTable) pour CHAQUE colonne
 *   non-PK de CHAQUE entité enregistrée (noms DB réels, `name:` inclus).
 * - Convergence des index 171/173/174/175 (uniques partiels + métier) :
 *   les migrations antérieures sautent la pose si une colonne manque
 *   (warn, jamais de crash boot) ; ici tout existe → pose garantie.
 *
 * RÈGLES SANS BREAK (strict, cf. ADR NULLABLE/DEFAULT, pattern 171/175) :
 * - CREATE TABLE IF NOT EXISTS uniquement.
 * - ALTER TABLE ... ADD COLUMN uniquement si la colonne manque.
 * - Jamais de DROP TABLE / DROP COLUMN.
 * - Jamais de NOT NULL sans DEFAULT (NULLABLE ou DEFAULT ; les PK
 *   auto-générées, seules NOT NULL, sont exclues des ADD COLUMN).
 * - down() no-op (append-only).
 * - COUNT loggé par table (traçabilité, zéro assert bloquant).
 */
export class DriftCatchup3177000000000 implements MigrationInterface {
  name = "DriftCatchup3177000000000";
  public readonly timestamp = 1770000000000;

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
      console.log(`[migration-177] ${table}: COUNT=${Number(rows?.[0]?.count ?? -1)}`);
    } catch {
      /* table absente ? best-effort */
    }
  }

  /**
   * ensureTable — CREATE bare-PK si la table manque (no-op sinon).
   * Les §1→§16 ajoutent ensuite CHAQUE colonne manquante → table complète.
   * Couverture : tables cœur jamais CREATE par 171/175/174 (la baseline joue
   * son up() sur fresh, mais les bases legacy/corrompues peuvent manquer une
   * table — sans ceci, les ADD COLUMN seraient no-op et la parité impossible).
   * Toutes ces tables ont leur PK sur `id` (vérifié vs entités).
   */
  private async ensureTable(q: QueryRunner, table: string): Promise<void> {
    if (await q.hasTable(table)) return;
    await q.query(
      `CREATE TABLE IF NOT EXISTS "${table}" ("id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL)`,
    );
    console.log(`[migration-177] table recréée (bare-PK, colonnes §suivants) : ${table}`);
  }

  /**
   * Convergence des index (filet 171/173/174/175) : les migrations
   * antérieures sautent désormais la pose d'index quand une colonne manque
   * sur table partielle (warn, jamais de crash boot). Ici, TOUTES les
   * colonnes existent déjà (§0→§16 ci-dessus) → on pose chaque index
   * manquant. Réexécutions = no-op (IF NOT EXISTS).
   */
  private async uniqueIfColumnsExist(
    q: QueryRunner,
    index: string,
    table: string,
    columns: string[],
    extraWhere = "",
  ): Promise<void> {
    for (const c of columns) {
      if (!(await q.hasColumn(table, c))) return;
    }
    const list = columns.map((c) => `"${c}"`).join(", ");
    const where = extraWhere || columns.map((c) => `"${c}" IS NOT NULL`).join(" AND ");
    await q.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "${index}" ON "${table}" (${list}) WHERE ${where}`,
    );
  }

  private async indexIfColumnsExist(
    q: QueryRunner,
    index: string,
    table: string,
    columns: string[],
    ddl: string,
  ): Promise<void> {
    for (const c of columns) {
      if (!(await q.hasColumn(table, c))) return;
    }
    await q.query(ddl);
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --------------------------------------- 0. Tables sans CREATE dédié
    // 0a. Tables cœur : bare-PK si absentes (les §1→§16 convergent ensuite
    // chaque colonne). No-op sur bases saines.
    for (const t of [
      "user", "T_student", "course", "observation", "grade", "class_room",
      "branch", "teaching_assignment", "professors", "qualification", "diploma",
      "T_file", "absences", "payment_configs", "scholarships", "payments",
      "school_settings", "school", "year_repartition", "T_report_card",
      "professor_payments", "homework", "vacation", "T_preference",
      "grade_config", "local_license",
    ]) {
      // eslint-disable-next-line no-await-in-loop
      await this.ensureTable(queryRunner, t);
    }
    // 0b. accounting_vault : entité enregistrée (data-source.ts) mais AUCUNE
    // migration 170→176 ne la crée pour les bases legacy (la baseline ne joue
    // pas son up() sur legacy). Schéma plein issu de l'entité (PK id simple).
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "accounting_vault" (
        "id" INTEGER PRIMARY KEY NOT NULL,
        "secretHash" VARCHAR NULL,
        "setAt" DATETIME NULL,
        "updatedBy" INTEGER NULL,
        "failedAttempts" INTEGER DEFAULT (0),
        "lockedUntil" DATETIME NULL
      )`);
    // Jointures (repeat-safe, déjà en 171/175 — convergence si marquage partiel).
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "course_grades" (
        "courseId" INTEGER NOT NULL,
        "gradeId" INTEGER NOT NULL,
        PRIMARY KEY ("courseId", "gradeId")
      )`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_course_grades_course" ON "course_grades" ("courseId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_course_grades_grade" ON "course_grades" ("gradeId")`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "teaching_grades" (
        "teaching_id" INTEGER NOT NULL,
        "grade_id" INTEGER NOT NULL,
        PRIMARY KEY ("teaching_id", "grade_id")
      )`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_teaching_grades_teaching" ON "teaching_grades" ("teaching_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_teaching_grades_grade" ON "teaching_grades" ("grade_id")`);
    await this.logCount(queryRunner, "accounting_vault");

    // --------------------------------------- 1. user (176 = UPDATE seul, jamais ADD)
    await this.addColumnIfMissing(queryRunner, "user", "remote_id", `"remote_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "user", "user_id", `"user_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "user", "username", `"username" VARCHAR NULL`);
    await this.addColumnIfMissing(queryRunner, "user", "password", `"password" VARCHAR NULL`);
    await this.addColumnIfMissing(queryRunner, "user", "role", `"role" VARCHAR DEFAULT ('admin')`);
    await this.addColumnIfMissing(queryRunner, "user", "securityQuestion", `"securityQuestion" VARCHAR NULL`);
    await this.addColumnIfMissing(queryRunner, "user", "securityAnswer", `"securityAnswer" VARCHAR NULL`);
    await this.addColumnIfMissing(queryRunner, "user", "displayName", `"displayName" VARCHAR NULL`);
    await this.addColumnIfMissing(queryRunner, "user", "isActive", `"isActive" BOOLEAN DEFAULT (1)`);
    await this.addColumnIfMissing(queryRunner, "user", "lastLoginAt", `"lastLoginAt" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "user", "createdAt", `"createdAt" DATETIME NULL`);
    // Filet 176-bis : si la 176 a été no-op (colonne absente), les lignes
    // héritent 'admin' via le DEFAULT ci-dessus ; on normalise le reste.
    try {
      if (await queryRunner.hasColumn("user", "role")) {
        await queryRunner.query(
          `UPDATE "user" SET "role" = 'admin' WHERE "role" IS NULL OR TRIM("role") = '' OR "role" NOT IN ('admin','professor','student','comptable')`,
        );
      }
    } catch { /* best-effort */ }
    await this.logCount(queryRunner, "user");

    // --------------------------------------- 2. T_student (+ gradeId relationnel)
    await this.addColumnIfMissing(queryRunner, "T_student", "remote_id", `"remote_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "T_student", "user_id", `"user_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "T_student", "firstname", `"firstname" TEXT NULL`);
    await this.addColumnIfMissing(queryRunner, "T_student", "lastname", `"lastname" TEXT NULL`);
    await this.addColumnIfMissing(queryRunner, "T_student", "matricule", `"matricule" TEXT NULL`);
    await this.addColumnIfMissing(queryRunner, "T_student", "fatherFirstname", `"fatherFirstname" TEXT NULL`);
    await this.addColumnIfMissing(queryRunner, "T_student", "fatherLastname", `"fatherLastname" TEXT NULL`);
    await this.addColumnIfMissing(queryRunner, "T_student", "motherFirstname", `"motherFirstname" TEXT NULL`);
    await this.addColumnIfMissing(queryRunner, "T_student", "motherLastname", `"motherLastname" TEXT NULL`);
    await this.addColumnIfMissing(queryRunner, "T_student", "photoId", `"photoId" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "T_student", "documentId", `"documentId" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "T_student", "birthDay", `"birthDay" DATE NULL`);
    await this.addColumnIfMissing(queryRunner, "T_student", "birthPlace", `"birthPlace" TEXT NULL`);
    await this.addColumnIfMissing(queryRunner, "T_student", "address", `"address" TEXT NULL`);
    await this.addColumnIfMissing(queryRunner, "T_student", "famillyPhone", `"famillyPhone" TEXT NULL`);
    await this.addColumnIfMissing(queryRunner, "T_student", "personalPhone", `"personalPhone" TEXT NULL`);
    await this.addColumnIfMissing(queryRunner, "T_student", "sex", `"sex" TEXT NULL`);
    await this.addColumnIfMissing(queryRunner, "T_student", "schoolYear", `"schoolYear" TEXT NULL`);
    await this.addColumnIfMissing(queryRunner, "T_student", "gradeId", `"gradeId" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "T_student", "isNew", `"isNew" BOOLEAN DEFAULT (1)`);
    await this.addColumnIfMissing(queryRunner, "T_student", "created_at", `"created_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "T_student", "updated_at", `"updated_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "T_student", "deleted_at", `"deleted_at" DATETIME NULL`);
    await this.logCount(queryRunner, "T_student");

    // --------------------------------------- 3. course / observation
    await this.addColumnIfMissing(queryRunner, "course", "remote_id", `"remote_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "course", "user_id", `"user_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "course", "code", `"code" TEXT NULL`);
    await this.addColumnIfMissing(queryRunner, "course", "name", `"name" TEXT NULL`);
    await this.addColumnIfMissing(queryRunner, "course", "coefficient", `"coefficient" NUMERIC NULL`);
    await this.addColumnIfMissing(queryRunner, "course", "isInGroupement", `"isInGroupement" BOOLEAN DEFAULT (0)`);
    await this.addColumnIfMissing(queryRunner, "course", "groupementId", `"groupementId" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "course", "gradeId", `"gradeId" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "course", "created_at", `"created_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "course", "updated_at", `"updated_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "course", "deleted_at", `"deleted_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "observation", "remote_id", `"remote_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "observation", "user_id", `"user_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "observation", "observation", `"observation" TEXT NULL`);
    await this.addColumnIfMissing(queryRunner, "observation", "note", `"note" NUMERIC NULL`);
    await this.addColumnIfMissing(queryRunner, "observation", "courseId", `"courseId" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "observation", "created_at", `"created_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "observation", "updated_at", `"updated_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "observation", "deleted_at", `"deleted_at" DATETIME NULL`);
    await this.logCount(queryRunner, "course");

    // --------------------------------------- 4. grade / class_room / branch
    await this.addColumnIfMissing(queryRunner, "grade", "remote_id", `"remote_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "grade", "user_id", `"user_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "grade", "name", `"name" TEXT NULL`);
    await this.addColumnIfMissing(queryRunner, "grade", "code", `"code" TEXT NULL`);
    await this.addColumnIfMissing(queryRunner, "grade", "type", `"type" VARCHAR DEFAULT ('PRIMARY')`);
    await this.addColumnIfMissing(queryRunner, "grade", "order", `"order" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "grade", "nextGradeId", `"nextGradeId" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "grade", "created_at", `"created_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "grade", "updated_at", `"updated_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "grade", "deleted_at", `"deleted_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "class_room", "remote_id", `"remote_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "class_room", "user_id", `"user_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "class_room", "name", `"name" TEXT NULL`);
    await this.addColumnIfMissing(queryRunner, "class_room", "code", `"code" TEXT NULL`);
    await this.addColumnIfMissing(queryRunner, "class_room", "capacity", `"capacity" NUMERIC NULL`);
    await this.addColumnIfMissing(queryRunner, "class_room", "gradeId", `"gradeId" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "class_room", "branchId", `"branchId" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "class_room", "created_at", `"created_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "class_room", "updated_at", `"updated_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "class_room", "deleted_at", `"deleted_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "branch", "remote_id", `"remote_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "branch", "user_id", `"user_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "branch", "name", `"name" TEXT NULL`);
    await this.addColumnIfMissing(queryRunner, "branch", "code", `"code" TEXT NULL`);
    await this.addColumnIfMissing(queryRunner, "branch", "gradeId", `"gradeId" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "branch", "created_at", `"created_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "branch", "updated_at", `"updated_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "branch", "deleted_at", `"deleted_at" DATETIME NULL`);
    await this.logCount(queryRunner, "grade");

    // --------------------------------------- 5. professors / qualification / diploma
    await this.addColumnIfMissing(queryRunner, "professors", "remote_id", `"remote_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "professors", "user_id", `"user_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "professors", "firstname", `"firstname" TEXT NULL`);
    await this.addColumnIfMissing(queryRunner, "professors", "lastname", `"lastname" TEXT NULL`);
    await this.addColumnIfMissing(queryRunner, "professors", "matricule", `"matricule" TEXT NULL`);
    await this.addColumnIfMissing(queryRunner, "professors", "civility", `"civility" TEXT NULL`);
    await this.addColumnIfMissing(queryRunner, "professors", "nbr_child", `"nbr_child" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "professors", "family_situation", `"family_situation" TEXT NULL`);
    await this.addColumnIfMissing(queryRunner, "professors", "birth_date", `"birth_date" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "professors", "birth_town", `"birth_town" TEXT NULL`);
    await this.addColumnIfMissing(queryRunner, "professors", "address", `"address" TEXT NULL`);
    await this.addColumnIfMissing(queryRunner, "professors", "town", `"town" TEXT NULL`);
    await this.addColumnIfMissing(queryRunner, "professors", "cni_number", `"cni_number" TEXT NULL`);
    await this.addColumnIfMissing(queryRunner, "professors", "color", `"color" VARCHAR(9) DEFAULT ('#409EFF')`);
    await this.addColumnIfMissing(queryRunner, "professors", "hourlyRate", `"hourlyRate" DECIMAL(14,2) DEFAULT (0)`);
    await this.addColumnIfMissing(queryRunner, "professors", "paymentMode", `"paymentMode" VARCHAR(20) DEFAULT ('monthly')`);
    await this.addColumnIfMissing(queryRunner, "professors", "photoId", `"photoId" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "professors", "diplomaId", `"diplomaId" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "professors", "qualificationId", `"qualificationId" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "professors", "created_at", `"created_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "professors", "updated_at", `"updated_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "professors", "deleted_at", `"deleted_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "qualification", "remote_id", `"remote_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "qualification", "user_id", `"user_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "qualification", "name", `"name" VARCHAR(255) NULL`);
    await this.addColumnIfMissing(queryRunner, "qualification", "created_at", `"created_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "qualification", "updated_at", `"updated_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "qualification", "deleted_at", `"deleted_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "diploma", "remote_id", `"remote_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "diploma", "user_id", `"user_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "diploma", "name", `"name" VARCHAR(255) NULL`);
    await this.addColumnIfMissing(queryRunner, "diploma", "created_at", `"created_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "diploma", "updated_at", `"updated_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "diploma", "deleted_at", `"deleted_at" DATETIME NULL`);
    await this.logCount(queryRunner, "professors");

    // --------------------------------------- 6. T_file / absences
    await this.addColumnIfMissing(queryRunner, "T_file", "remote_id", `"remote_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "T_file", "user_id", `"user_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "T_file", "name", `"name" TEXT NULL`);
    await this.addColumnIfMissing(queryRunner, "T_file", "path", `"path" TEXT NULL`);
    await this.addColumnIfMissing(queryRunner, "T_file", "type", `"type" TEXT NULL`);
    await this.addColumnIfMissing(queryRunner, "T_file", "studentId", `"studentId" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "T_file", "professorId", `"professorId" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "T_file", "createdAt", `"createdAt" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "T_file", "created_at", `"created_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "T_file", "updated_at", `"updated_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "T_file", "deleted_at", `"deleted_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "absences", "remote_id", `"remote_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "absences", "user_id", `"user_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "absences", "date", `"date" DATE NULL`);
    await this.addColumnIfMissing(queryRunner, "absences", "reason", `"reason" TEXT NULL`);
    await this.addColumnIfMissing(queryRunner, "absences", "reasonType", `"reasonType" VARCHAR NULL`);
    await this.addColumnIfMissing(queryRunner, "absences", "absenceType", `"absenceType" VARCHAR NULL`);
    await this.addColumnIfMissing(queryRunner, "absences", "justified", `"justified" BOOLEAN DEFAULT (0)`);
    await this.addColumnIfMissing(queryRunner, "absences", "startTime", `"startTime" TIME NULL`);
    await this.addColumnIfMissing(queryRunner, "absences", "endTime", `"endTime" TIME NULL`);
    await this.addColumnIfMissing(queryRunner, "absences", "comments", `"comments" TEXT NULL`);
    await this.addColumnIfMissing(queryRunner, "absences", "studentId", `"studentId" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "absences", "professorId", `"professorId" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "absences", "gradeId", `"gradeId" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "absences", "courseId", `"courseId" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "absences", "documentId", `"documentId" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "absences", "parentNotified", `"parentNotified" BOOLEAN DEFAULT (0)`);
    await this.addColumnIfMissing(queryRunner, "absences", "type", `"type" VARCHAR DEFAULT ('STUDENT')`);
    await this.addColumnIfMissing(queryRunner, "absences", "created_at", `"created_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "absences", "updated_at", `"updated_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "absences", "deleted_at", `"deleted_at" DATETIME NULL`);
    await this.logCount(queryRunner, "absences");

    // --------------------------------------- 7. payments (bourse + statuts)
    await this.addColumnIfMissing(queryRunner, "payments", "remote_id", `"remote_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "payments", "user_id", `"user_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "payments", "amount", `"amount" DECIMAL(14,2) NULL`);
    await this.addColumnIfMissing(queryRunner, "payments", "currency", `"currency" VARCHAR(10) NULL`);
    await this.addColumnIfMissing(queryRunner, "payments", "idempotencyKey", `"idempotencyKey" VARCHAR(64) NULL`);
    await this.addColumnIfMissing(queryRunner, "payments", "paymentType", `"paymentType" VARCHAR NULL`);
    await this.addColumnIfMissing(queryRunner, "payments", "paymentMethod", `"paymentMethod" VARCHAR DEFAULT ('cash')`);
    await this.addColumnIfMissing(queryRunner, "payments", "studentId", `"studentId" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "payments", "receiptNumber", `"receiptNumber" VARCHAR(20) NULL`);
    await this.addColumnIfMissing(queryRunner, "payments", "installmentNumber", `"installmentNumber" INTEGER DEFAULT (1)`);
    await this.addColumnIfMissing(queryRunner, "payments", "schoolYear", `"schoolYear" VARCHAR NULL`);
    await this.addColumnIfMissing(queryRunner, "payments", "comment", `"comment" VARCHAR NULL`);
    await this.addColumnIfMissing(queryRunner, "payments", "scholarshipId", `"scholarshipId" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "payments", "baseAmount", `"baseAmount" DECIMAL(14,2) NULL`);
    await this.addColumnIfMissing(queryRunner, "payments", "scholarshipAmount", `"scholarshipAmount" DECIMAL(14,2) NULL`);
    await this.addColumnIfMissing(queryRunner, "payments", "adjustedAmount", `"adjustedAmount" DECIMAL(14,2) NULL`);
    await this.addColumnIfMissing(queryRunner, "payments", "scholarshipPercentage", `"scholarshipPercentage" DECIMAL(14,2) NULL`);
    await this.addColumnIfMissing(queryRunner, "payments", "created_at", `"created_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "payments", "updated_at", `"updated_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "payments", "deleted_at", `"deleted_at" DATETIME NULL`);
    await this.logCount(queryRunner, "payments");

    // --------------------------------------- 8. payment_configs / scholarships
    await this.addColumnIfMissing(queryRunner, "payment_configs", "remote_id", `"remote_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "payment_configs", "user_id", `"user_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "payment_configs", "classId", `"classId" VARCHAR NULL`);
    await this.addColumnIfMissing(queryRunner, "payment_configs", "className", `"className" VARCHAR NULL`);
    await this.addColumnIfMissing(queryRunner, "payment_configs", "annualAmount", `"annualAmount" DECIMAL(14,2) DEFAULT (0)`);
    await this.addColumnIfMissing(queryRunner, "payment_configs", "inscriptionFee", `"inscriptionFee" DECIMAL(14,2) DEFAULT (0)`);
    await this.addColumnIfMissing(queryRunner, "payment_configs", "reInscriptionFee", `"reInscriptionFee" DECIMAL(14,2) DEFAULT (0)`);
    await this.addColumnIfMissing(queryRunner, "payment_configs", "allowScholarship", `"allowScholarship" BOOLEAN DEFAULT (0)`);
    await this.addColumnIfMissing(queryRunner, "payment_configs", "scholarshipPercentages", `"scholarshipPercentages" TEXT NULL`);
    await this.addColumnIfMissing(queryRunner, "payment_configs", "scholarshipCriteria", `"scholarshipCriteria" TEXT NULL`);
    await this.addColumnIfMissing(queryRunner, "payment_configs", "schoolYear", `"schoolYear" VARCHAR NULL`);
    await this.addColumnIfMissing(queryRunner, "scholarships", "remote_id", `"remote_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "scholarships", "user_id", `"user_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "scholarships", "studentId", `"studentId" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "scholarships", "percentage", `"percentage" FLOAT NULL`);
    await this.addColumnIfMissing(queryRunner, "scholarships", "isActive", `"isActive" BOOLEAN DEFAULT (1)`);
    await this.addColumnIfMissing(queryRunner, "scholarships", "schoolYear", `"schoolYear" VARCHAR NULL`);
    await this.addColumnIfMissing(queryRunner, "scholarships", "reason", `"reason" VARCHAR NULL`);
    await this.addColumnIfMissing(queryRunner, "scholarships", "configId", `"configId" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "scholarships", "created_at", `"created_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "scholarships", "updated_at", `"updated_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "scholarships", "deleted_at", `"deleted_at" DATETIME NULL`);
    await this.logCount(queryRunner, "payment_configs");

    // --------------------------------------- 9. year_repartition (filet 173-bis) + school
    await this.addColumnIfMissing(queryRunner, "year_repartition", "remote_id", `"remote_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "year_repartition", "user_id", `"user_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "year_repartition", "schoolYear", `"schoolYear" TEXT NULL`);
    await this.addColumnIfMissing(queryRunner, "year_repartition", "periodConfigurations", `"periodConfigurations" TEXT NULL`);
    await this.addColumnIfMissing(queryRunner, "year_repartition", "createdAt", `"createdAt" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "year_repartition", "updatedAt", `"updatedAt" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "year_repartition", "isCurrent", `"isCurrent" BOOLEAN DEFAULT (0)`);
    await this.addColumnIfMissing(queryRunner, "year_repartition", "status", `"status" VARCHAR(10) DEFAULT ('active')`);
    await this.addColumnIfMissing(queryRunner, "year_repartition", "closedAt", `"closedAt" DATETIME NULL`);
    try {
      if (await queryRunner.hasColumn("year_repartition", "status")) {
        await queryRunner.query(
          `UPDATE "year_repartition" SET "status" = 'active' WHERE "status" IS NULL OR "status" NOT IN ('active','closed')`,
        );
      }
    } catch { /* best-effort */ }
    await this.addColumnIfMissing(queryRunner, "school", "user_id", `"user_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "school", "name", `"name" VARCHAR(255) NULL`);
    await this.addColumnIfMissing(queryRunner, "school", "address", `"address" VARCHAR(255) NULL`);
    await this.addColumnIfMissing(queryRunner, "school", "town", `"town" VARCHAR(255) NULL`);
    await this.addColumnIfMissing(queryRunner, "school", "country", `"country" VARCHAR(3) DEFAULT ('SEN')`);
    await this.addColumnIfMissing(queryRunner, "school", "logoId", `"logoId" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "school", "phone", `"phone" VARCHAR(20) NULL`);
    await this.addColumnIfMissing(queryRunner, "school", "email", `"email" VARCHAR(255) NULL`);
    await this.addColumnIfMissing(queryRunner, "school", "remote_id", `"remote_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "school", "schema_name", `"schema_name" VARCHAR(100) NULL`);
    await this.addColumnIfMissing(queryRunner, "school", "type", `"type" VARCHAR(10) DEFAULT ('publique')`);
    await this.addColumnIfMissing(queryRunner, "school", "foundationYear", `"foundationYear" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "school", "created_at", `"created_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "school", "updated_at", `"updated_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "school", "deleted_at", `"deleted_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "school_settings", "user_id", `"user_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "school_settings", "schoolCode", `"schoolCode" VARCHAR(50) NULL`);
    await this.addColumnIfMissing(queryRunner, "school_settings", "inspectionZone", `"inspectionZone" VARCHAR(100) NULL`);
    await this.addColumnIfMissing(queryRunner, "school_settings", "departmentCode", `"departmentCode" VARCHAR(50) NULL`);
    await this.addColumnIfMissing(queryRunner, "school_settings", "schoolId", `"schoolId" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "school_settings", "created_at", `"created_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "school_settings", "updated_at", `"updated_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "school_settings", "deleted_at", `"deleted_at" DATETIME NULL`);
    await this.logCount(queryRunner, "year_repartition");

    // --------------------------------------- 10. professor_payments / teaching / report
    await this.addColumnIfMissing(queryRunner, "professor_payments", "remote_id", `"remote_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "professor_payments", "user_id", `"user_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "professor_payments", "amount", `"amount" DECIMAL(14,2) NULL`);
    await this.addColumnIfMissing(queryRunner, "professor_payments", "currency", `"currency" VARCHAR(10) NULL`);
    await this.addColumnIfMissing(queryRunner, "professor_payments", "idempotencyKey", `"idempotencyKey" VARCHAR(64) NULL`);
    await this.addColumnIfMissing(queryRunner, "professor_payments", "type", `"type" VARCHAR NULL`);
    await this.addColumnIfMissing(queryRunner, "professor_payments", "paymentMethod", `"paymentMethod" VARCHAR DEFAULT ('cash')`);
    await this.addColumnIfMissing(queryRunner, "professor_payments", "createdAt", `"createdAt" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "professor_payments", "professorId", `"professorId" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "professor_payments", "month", `"month" VARCHAR NULL`);
    await this.addColumnIfMissing(queryRunner, "professor_payments", "reference", `"reference" VARCHAR(32) NULL`);
    await this.addColumnIfMissing(queryRunner, "professor_payments", "comment", `"comment" VARCHAR NULL`);
    await this.addColumnIfMissing(queryRunner, "professor_payments", "hoursTotal", `"hoursTotal" DECIMAL(7,2) DEFAULT (0)`);
    await this.addColumnIfMissing(queryRunner, "professor_payments", "hourlyRate", `"hourlyRate" DECIMAL(14,2) DEFAULT (0)`);
    await this.addColumnIfMissing(queryRunner, "professor_payments", "salarySlipId", `"salarySlipId" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "professor_payments", "isPaid", `"isPaid" BOOLEAN DEFAULT (0)`);
    await this.addColumnIfMissing(queryRunner, "professor_payments", "grossAmount", `"grossAmount" DECIMAL(14,2) DEFAULT (0)`);
    await this.addColumnIfMissing(queryRunner, "professor_payments", "netAmount", `"netAmount" DECIMAL(14,2) DEFAULT (0)`);
    await this.addColumnIfMissing(queryRunner, "professor_payments", "deductions", `"deductions" TEXT NULL`);
    await this.addColumnIfMissing(queryRunner, "professor_payments", "additions", `"additions" TEXT NULL`);
    await this.addColumnIfMissing(queryRunner, "professor_payments", "created_at", `"created_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "professor_payments", "updated_at", `"updated_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "professor_payments", "deleted_at", `"deleted_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "teaching_assignment", "remote_id", `"remote_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "teaching_assignment", "user_id", `"user_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "teaching_assignment", "professorId", `"professorId" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "teaching_assignment", "teachingType", `"teachingType" VARCHAR NULL`);
    await this.addColumnIfMissing(queryRunner, "teaching_assignment", "schoolType", `"schoolType" VARCHAR NULL`);
    await this.addColumnIfMissing(queryRunner, "teaching_assignment", "classId", `"classId" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "teaching_assignment", "courseId", `"courseId" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "teaching_assignment", "gradeIds", `"gradeIds" TEXT NULL`);
    await this.addColumnIfMissing(queryRunner, "teaching_assignment", "gradeNames", `"gradeNames" VARCHAR NULL`);
    await this.addColumnIfMissing(queryRunner, "teaching_assignment", "created_at", `"created_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "teaching_assignment", "updated_at", `"updated_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "teaching_assignment", "deleted_at", `"deleted_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "T_report_card", "studentId", `"studentId" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "T_report_card", "courseId", `"courseId" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "T_report_card", "period", `"period" VARCHAR NULL`);
    await this.addColumnIfMissing(queryRunner, "T_report_card", "assignmentGrades", `"assignmentGrades" TEXT NULL`);
    await this.addColumnIfMissing(queryRunner, "T_report_card", "examGrade", `"examGrade" FLOAT NULL`);
    await this.addColumnIfMissing(queryRunner, "T_report_card", "finalGrade", `"finalGrade" FLOAT NULL`);
    await this.addColumnIfMissing(queryRunner, "T_report_card", "appreciation", `"appreciation" VARCHAR NULL`);
    await this.addColumnIfMissing(queryRunner, "T_report_card", "createdAt", `"createdAt" DATETIME NULL`);
    await this.logCount(queryRunner, "professor_payments");

    // --------------------------------------- 11. homework / vacation / prefs / grade_config / licence
    await this.addColumnIfMissing(queryRunner, "homework", "remote_id", `"remote_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "homework", "user_id", `"user_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "homework", "description", `"description" TEXT NULL`);
    await this.addColumnIfMissing(queryRunner, "homework", "dueDate", `"dueDate" DATE NULL`);
    await this.addColumnIfMissing(queryRunner, "homework", "courseId", `"courseId" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "homework", "gradeId", `"gradeId" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "homework", "professorId", `"professorId" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "homework", "createdAt", `"createdAt" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "homework", "isCompleted", `"isCompleted" BOOLEAN DEFAULT (0)`);
    await this.addColumnIfMissing(queryRunner, "vacation", "remote_id", `"remote_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "vacation", "user_id", `"user_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "vacation", "startDate", `"startDate" DATE NULL`);
    await this.addColumnIfMissing(queryRunner, "vacation", "endDate", `"endDate" DATE NULL`);
    await this.addColumnIfMissing(queryRunner, "vacation", "reason", `"reason" TEXT NULL`);
    await this.addColumnIfMissing(queryRunner, "vacation", "status", `"status" VARCHAR NULL`);
    await this.addColumnIfMissing(queryRunner, "vacation", "professorId", `"professorId" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "vacation", "studentId", `"studentId" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "vacation", "createdAt", `"createdAt" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "vacation", "comment", `"comment" TEXT NULL`);
    await this.addColumnIfMissing(queryRunner, "vacation", "created_at", `"created_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "vacation", "updated_at", `"updated_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "vacation", "deleted_at", `"deleted_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "T_preference", "key", `"key" VARCHAR NULL`);
    await this.addColumnIfMissing(queryRunner, "T_preference", "value", `"value" TEXT NULL`);
    await this.addColumnIfMissing(queryRunner, "grade_config", "remote_id", `"remote_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "grade_config", "user_id", `"user_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "grade_config", "grade_id", `"grade_id" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "grade_config", "numberOfAssignments", `"numberOfAssignments" INTEGER DEFAULT (2)`);
    await this.addColumnIfMissing(queryRunner, "grade_config", "assignmentWeight", `"assignmentWeight" REAL DEFAULT (0.4)`);
    await this.addColumnIfMissing(queryRunner, "grade_config", "examWeight", `"examWeight" REAL DEFAULT (0.6)`);
    await this.addColumnIfMissing(queryRunner, "grade_config", "formula", `"formula" TEXT NULL`);
    await this.addColumnIfMissing(queryRunner, "local_license", "remote_id", `"remote_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "local_license", "code", `"code" VARCHAR NULL`);
    await this.addColumnIfMissing(queryRunner, "local_license", "type", `"type" VARCHAR NULL`);
    await this.addColumnIfMissing(queryRunner, "local_license", "machine_id", `"machine_id" TEXT NULL`);
    await this.addColumnIfMissing(queryRunner, "local_license", "activated_at", `"activated_at" TEXT NULL`);
    await this.addColumnIfMissing(queryRunner, "local_license", "expires_at", `"expires_at" TEXT NULL`);
    await this.logCount(queryRunner, "vacation");

    // --------------------------------------- 12. payment_annual_config / tranch_config /
    // mensuality_tranch / inscription_fee (filet 174/175-bis si marquage partiel)
    await this.addColumnIfMissing(queryRunner, "payment_annual_config", "remote_id", `"remote_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "payment_annual_config", "trancheCount", `"trancheCount" NUMERIC NULL`);
    await this.addColumnIfMissing(queryRunner, "payment_annual_config", "schoolYear", `"schoolYear" VARCHAR NULL`);
    await this.addColumnIfMissing(queryRunner, "payment_annual_config", "gradeId", `"gradeId" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "tranch_config", "remote_id", `"remote_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "tranch_config", "tranchName", `"tranchName" VARCHAR NULL`);
    await this.addColumnIfMissing(queryRunner, "tranch_config", "schoolYear", `"schoolYear" VARCHAR NULL`);
    await this.addColumnIfMissing(queryRunner, "tranch_config", "amount", `"amount" DECIMAL(14,2) DEFAULT (0)`);
    await this.addColumnIfMissing(queryRunner, "tranch_config", "tranchMonthCount", `"tranchMonthCount" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "tranch_config", "paymentAnnualConfigId", `"paymentAnnualConfigId" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "mensuality_tranch", "remote_id", `"remote_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "mensuality_tranch", "startDate", `"startDate" DATE NULL`);
    await this.addColumnIfMissing(queryRunner, "mensuality_tranch", "endDate", `"endDate" DATE NULL`);
    await this.addColumnIfMissing(queryRunner, "mensuality_tranch", "tranchConfigId", `"tranchConfigId" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "inscription_fee", "remote_id", `"remote_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "inscription_fee", "inscriptionFeeAmount", `"inscriptionFeeAmount" DECIMAL(14,2) NULL`);
    await this.addColumnIfMissing(queryRunner, "inscription_fee", "gradeId", `"gradeId" INTEGER NULL`);
    await this.logCount(queryRunner, "tranch_config");

    // --------------------------------------- 13. grading_config / evaluation_category /
    // grade_entry / calculated_grade / audit_log / document_content / schedules
    await this.addColumnIfMissing(queryRunner, "grading_config", "remote_id", `"remote_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "grading_config", "schoolId", `"schoolId" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "grading_config", "classId", `"classId" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "grading_config", "subjectId", `"subjectId" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "grading_config", "period", `"period" VARCHAR(100) NULL`);
    await this.addColumnIfMissing(queryRunner, "grading_config", "finalGradeBase", `"finalGradeBase" FLOAT DEFAULT (20)`);
    await this.addColumnIfMissing(queryRunner, "grading_config", "calculationStrategy", `"calculationStrategy" VARCHAR DEFAULT ('WEIGHTED')`);
    await this.addColumnIfMissing(queryRunner, "grading_config", "normalizeScores", `"normalizeScores" BOOLEAN DEFAULT (1)`);
    await this.addColumnIfMissing(queryRunner, "grading_config", "description", `"description" VARCHAR NULL`);
    await this.addColumnIfMissing(queryRunner, "grading_config", "schoolYear", `"schoolYear" VARCHAR NULL`);
    await this.addColumnIfMissing(queryRunner, "grading_config", "createdAt", `"createdAt" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "grading_config", "updatedAt", `"updatedAt" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "evaluation_category", "remote_id", `"remote_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "evaluation_category", "name", `"name" VARCHAR(100) NULL`);
    await this.addColumnIfMissing(queryRunner, "evaluation_category", "code", `"code" VARCHAR(10) NULL`);
    await this.addColumnIfMissing(queryRunner, "evaluation_category", "weight", `"weight" FLOAT DEFAULT (1)`);
    await this.addColumnIfMissing(queryRunner, "evaluation_category", "defaultMaxScore", `"defaultMaxScore" FLOAT DEFAULT (20)`);
    await this.addColumnIfMissing(queryRunner, "evaluation_category", "minEntries", `"minEntries" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "evaluation_category", "maxEntries", `"maxEntries" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "evaluation_category", "color", `"color" VARCHAR(7) DEFAULT ('#3498db')`);
    await this.addColumnIfMissing(queryRunner, "evaluation_category", "displayOrder", `"displayOrder" INTEGER DEFAULT (0)`);
    await this.addColumnIfMissing(queryRunner, "evaluation_category", "isExam", `"isExam" BOOLEAN DEFAULT (0)`);
    await this.addColumnIfMissing(queryRunner, "evaluation_category", "configId", `"configId" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "grade_entry", "remote_id", `"remote_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "grade_entry", "studentId", `"studentId" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "grade_entry", "courseId", `"courseId" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "grade_entry", "categoryId", `"categoryId" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "grade_entry", "period", `"period" VARCHAR(100) NULL`);
    await this.addColumnIfMissing(queryRunner, "grade_entry", "score", `"score" FLOAT NULL`);
    await this.addColumnIfMissing(queryRunner, "grade_entry", "maxScore", `"maxScore" FLOAT NULL`);
    await this.addColumnIfMissing(queryRunner, "grade_entry", "label", `"label" VARCHAR(200) NULL`);
    await this.addColumnIfMissing(queryRunner, "grade_entry", "evaluationDate", `"evaluationDate" DATE NULL`);
    await this.addColumnIfMissing(queryRunner, "grade_entry", "comment", `"comment" TEXT NULL`);
    await this.addColumnIfMissing(queryRunner, "grade_entry", "createdAt", `"createdAt" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "grade_entry", "updatedAt", `"updatedAt" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "calculated_grade", "remote_id", `"remote_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "calculated_grade", "studentId", `"studentId" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "calculated_grade", "courseId", `"courseId" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "calculated_grade", "period", `"period" VARCHAR(100) NULL`);
    await this.addColumnIfMissing(queryRunner, "calculated_grade", "finalAverage", `"finalAverage" FLOAT NULL`);
    await this.addColumnIfMissing(queryRunner, "calculated_grade", "configId", `"configId" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "calculated_grade", "categoryBreakdown", `"categoryBreakdown" TEXT NULL`);
    await this.addColumnIfMissing(queryRunner, "calculated_grade", "appreciation", `"appreciation" TEXT NULL`);
    await this.addColumnIfMissing(queryRunner, "calculated_grade", "createdAt", `"createdAt" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "calculated_grade", "updatedAt", `"updatedAt" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "audit_log", "actorId", `"actorId" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "audit_log", "actorUsername", `"actorUsername" VARCHAR NULL`);
    await this.addColumnIfMissing(queryRunner, "audit_log", "actorRole", `"actorRole" VARCHAR NULL`);
    await this.addColumnIfMissing(queryRunner, "audit_log", "action", `"action" VARCHAR NULL`);
    await this.addColumnIfMissing(queryRunner, "audit_log", "targetEntity", `"targetEntity" VARCHAR NULL`);
    await this.addColumnIfMissing(queryRunner, "audit_log", "targetId", `"targetId" VARCHAR NULL`);
    await this.addColumnIfMissing(queryRunner, "audit_log", "summary", `"summary" VARCHAR(500) NULL`);
    await this.addColumnIfMissing(queryRunner, "audit_log", "diff", `"diff" TEXT NULL`);
    await this.addColumnIfMissing(queryRunner, "audit_log", "metadata", `"metadata" TEXT NULL`);
    await this.addColumnIfMissing(queryRunner, "audit_log", "createdAt", `"createdAt" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "document_content", "remote_id", `"remote_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "document_content", "inscription", `"inscription" TEXT NULL`);
    await this.addColumnIfMissing(queryRunner, "document_content", "scolarite", `"scolarite" TEXT NULL`);
    await this.addColumnIfMissing(queryRunner, "document_content", "created_at", `"created_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "document_content", "updated_at", `"updated_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "schedules", "remote_id", `"remote_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "schedules", "professor_id", `"professor_id" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "schedules", "course_id", `"course_id" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "schedules", "class_id", `"class_id" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "schedules", "day", `"day" VARCHAR(20) NULL`);
    await this.addColumnIfMissing(queryRunner, "schedules", "time_slot", `"time_slot" VARCHAR(20) NULL`);
    await this.addColumnIfMissing(queryRunner, "schedules", "created_at", `"created_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "schedules", "updated_at", `"updated_at" DATETIME NULL`);
    await this.logCount(queryRunner, "grading_config");

    // --------------------------------------- 14. schedule_configs (noms DB snake_case)
    await this.addColumnIfMissing(queryRunner, "schedule_configs", "class_id", `"class_id" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "schedule_configs", "start_hour", `"start_hour" INTEGER DEFAULT (8)`);
    await this.addColumnIfMissing(queryRunner, "schedule_configs", "end_hour", `"end_hour" INTEGER DEFAULT (18)`);
    await this.addColumnIfMissing(queryRunner, "schedule_configs", "slot_duration", `"slot_duration" INTEGER DEFAULT (60)`);
    await this.addColumnIfMissing(queryRunner, "schedule_configs", "lunch_start", `"lunch_start" INTEGER DEFAULT (12)`);
    await this.addColumnIfMissing(queryRunner, "schedule_configs", "lunch_end", `"lunch_end" INTEGER DEFAULT (14)`);
    await this.addColumnIfMissing(queryRunner, "schedule_configs", "start_minutes", `"start_minutes" INTEGER DEFAULT (0)`);
    await this.addColumnIfMissing(queryRunner, "schedule_configs", "end_minutes", `"end_minutes" INTEGER DEFAULT (0)`);
    await this.addColumnIfMissing(queryRunner, "schedule_configs", "lunch_start_minutes", `"lunch_start_minutes" INTEGER DEFAULT (0)`);
    await this.addColumnIfMissing(queryRunner, "schedule_configs", "lunch_end_minutes", `"lunch_end_minutes" INTEGER DEFAULT (0)`);
    await this.addColumnIfMissing(queryRunner, "schedule_configs", "created_at", `"created_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "schedule_configs", "updated_at", `"updated_at" DATETIME NULL`);
    await this.logCount(queryRunner, "schedule_configs");

    // --------------------------------------- 15. Comptabilité : filets legacy
    // Les CREATE 171 sont no-op sur tables pré-existantes ; on converge ici
    // chaque colonne d'entité (statuts, schoolYear, dates, montants, …).
    await this.addColumnIfMissing(queryRunner, "expenses", "remote_id", `"remote_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "expenses", "user_id", `"user_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "expenses", "label", `"label" VARCHAR(255) NULL`);
    await this.addColumnIfMissing(queryRunner, "expenses", "category", `"category" VARCHAR(100) NULL`);
    await this.addColumnIfMissing(queryRunner, "expenses", "amount", `"amount" DECIMAL(14,2) DEFAULT (0)`);
    await this.addColumnIfMissing(queryRunner, "expenses", "currency", `"currency" VARCHAR(10) NULL`);
    await this.addColumnIfMissing(queryRunner, "expenses", "expenseDate", `"expenseDate" DATE NULL`);
    await this.addColumnIfMissing(queryRunner, "expenses", "paymentMethod", `"paymentMethod" VARCHAR(50) DEFAULT ('cash')`);
    await this.addColumnIfMissing(queryRunner, "expenses", "status", `"status" VARCHAR(20) DEFAULT ('pending')`);
    await this.addColumnIfMissing(queryRunner, "expenses", "receiptNumber", `"receiptNumber" VARCHAR(20) NULL`);
    await this.addColumnIfMissing(queryRunner, "expenses", "idempotencyKey", `"idempotencyKey" VARCHAR(64) NULL`);
    await this.addColumnIfMissing(queryRunner, "expenses", "studentId", `"studentId" VARCHAR(20) NULL`);
    await this.addColumnIfMissing(queryRunner, "expenses", "schoolYear", `"schoolYear" VARCHAR NULL`);
    await this.addColumnIfMissing(queryRunner, "expenses", "comment", `"comment" VARCHAR NULL`);
    await this.addColumnIfMissing(queryRunner, "expenses", "created_at", `"created_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "expenses", "updated_at", `"updated_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "expenses", "deleted_at", `"deleted_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "cash_registers", "remote_id", `"remote_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "cash_registers", "user_id", `"user_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "cash_registers", "name", `"name" VARCHAR(100) NULL`);
    await this.addColumnIfMissing(queryRunner, "cash_registers", "registerDate", `"registerDate" DATE NULL`);
    await this.addColumnIfMissing(queryRunner, "cash_registers", "openingBalance", `"openingBalance" DECIMAL(14,2) DEFAULT (0)`);
    await this.addColumnIfMissing(queryRunner, "cash_registers", "closingBalance", `"closingBalance" DECIMAL(14,2) DEFAULT (0)`);
    await this.addColumnIfMissing(queryRunner, "cash_registers", "currency", `"currency" VARCHAR(10) NULL`);
    await this.addColumnIfMissing(queryRunner, "cash_registers", "status", `"status" VARCHAR(20) DEFAULT ('open')`);
    await this.addColumnIfMissing(queryRunner, "cash_registers", "created_at", `"created_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "cash_registers", "updated_at", `"updated_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "cash_registers", "deleted_at", `"deleted_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "cash_movements", "remote_id", `"remote_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "cash_movements", "user_id", `"user_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "cash_movements", "registerId", `"registerId" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "cash_movements", "direction", `"direction" VARCHAR(10) NULL`);
    await this.addColumnIfMissing(queryRunner, "cash_movements", "amount", `"amount" DECIMAL(14,2) DEFAULT (0)`);
    await this.addColumnIfMissing(queryRunner, "cash_movements", "currency", `"currency" VARCHAR(10) NULL`);
    await this.addColumnIfMissing(queryRunner, "cash_movements", "motive", `"motive" VARCHAR(255) NULL`);
    await this.addColumnIfMissing(queryRunner, "cash_movements", "reference", `"reference" VARCHAR(20) NULL`);
    await this.addColumnIfMissing(queryRunner, "cash_movements", "idempotencyKey", `"idempotencyKey" VARCHAR(64) NULL`);
    await this.addColumnIfMissing(queryRunner, "cash_movements", "paymentId", `"paymentId" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "cash_movements", "expenseId", `"expenseId" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "cash_movements", "movementDate", `"movementDate" DATE NULL`);
    await this.addColumnIfMissing(queryRunner, "cash_movements", "schoolYear", `"schoolYear" VARCHAR NULL`);
    await this.addColumnIfMissing(queryRunner, "cash_movements", "created_at", `"created_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "cash_closures", "remote_id", `"remote_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "cash_closures", "user_id", `"user_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "cash_closures", "registerId", `"registerId" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "cash_closures", "closureDate", `"closureDate" DATE NULL`);
    await this.addColumnIfMissing(queryRunner, "cash_closures", "expectedAmount", `"expectedAmount" DECIMAL(14,2) DEFAULT (0)`);
    await this.addColumnIfMissing(queryRunner, "cash_closures", "countedAmount", `"countedAmount" DECIMAL(14,2) DEFAULT (0)`);
    await this.addColumnIfMissing(queryRunner, "cash_closures", "gap", `"gap" DECIMAL(14,2) DEFAULT (0)`);
    await this.addColumnIfMissing(queryRunner, "cash_closures", "currency", `"currency" VARCHAR(10) NULL`);
    await this.addColumnIfMissing(queryRunner, "cash_closures", "validatedBy", `"validatedBy" VARCHAR(100) NULL`);
    await this.addColumnIfMissing(queryRunner, "cash_closures", "comment", `"comment" VARCHAR NULL`);
    await this.addColumnIfMissing(queryRunner, "cash_closures", "created_at", `"created_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "cash_closures", "updated_at", `"updated_at" DATETIME NULL`);
    await this.logCount(queryRunner, "expenses");

    // --------------------------------------- 16. Banque / paie / compteurs / frais
    await this.addColumnIfMissing(queryRunner, "bank_accounts", "remote_id", `"remote_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "bank_accounts", "user_id", `"user_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "bank_accounts", "bankName", `"bankName" VARCHAR(150) NULL`);
    await this.addColumnIfMissing(queryRunner, "bank_accounts", "accountNumber", `"accountNumber" VARCHAR(64) NULL`);
    await this.addColumnIfMissing(queryRunner, "bank_accounts", "iban", `"iban" VARCHAR(64) NULL`);
    await this.addColumnIfMissing(queryRunner, "bank_accounts", "balance", `"balance" DECIMAL(14,2) DEFAULT (0)`);
    await this.addColumnIfMissing(queryRunner, "bank_accounts", "currency", `"currency" VARCHAR(10) DEFAULT ('GNF')`);
    await this.addColumnIfMissing(queryRunner, "bank_accounts", "created_at", `"created_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "bank_accounts", "updated_at", `"updated_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "bank_accounts", "deleted_at", `"deleted_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "bank_transactions", "remote_id", `"remote_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "bank_transactions", "user_id", `"user_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "bank_transactions", "accountId", `"accountId" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "bank_transactions", "direction", `"direction" VARCHAR(10) NULL`);
    await this.addColumnIfMissing(queryRunner, "bank_transactions", "amount", `"amount" DECIMAL(14,2) DEFAULT (0)`);
    await this.addColumnIfMissing(queryRunner, "bank_transactions", "currency", `"currency" VARCHAR(10) NULL`);
    await this.addColumnIfMissing(queryRunner, "bank_transactions", "idempotencyKey", `"idempotencyKey" VARCHAR(64) NULL`);
    await this.addColumnIfMissing(queryRunner, "bank_transactions", "transactionDate", `"transactionDate" DATE NULL`);
    await this.addColumnIfMissing(queryRunner, "bank_transactions", "reference", `"reference" VARCHAR(64) NULL`);
    await this.addColumnIfMissing(queryRunner, "bank_transactions", "label", `"label" VARCHAR(255) NULL`);
    await this.addColumnIfMissing(queryRunner, "bank_transactions", "schoolYear", `"schoolYear" VARCHAR NULL`);
    await this.addColumnIfMissing(queryRunner, "bank_transactions", "created_at", `"created_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "bank_transactions", "updated_at", `"updated_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "bank_transactions", "deleted_at", `"deleted_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "teacher_hour_logs", "remote_id", `"remote_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "teacher_hour_logs", "user_id", `"user_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "teacher_hour_logs", "professorId", `"professorId" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "teacher_hour_logs", "month", `"month" VARCHAR(7) NULL`);
    await this.addColumnIfMissing(queryRunner, "teacher_hour_logs", "hours", `"hours" DECIMAL(7,2) DEFAULT (0)`);
    await this.addColumnIfMissing(queryRunner, "teacher_hour_logs", "hourlyRate", `"hourlyRate" DECIMAL(14,2) DEFAULT (0)`);
    await this.addColumnIfMissing(queryRunner, "teacher_hour_logs", "subject", `"subject" VARCHAR(100) NULL`);
    await this.addColumnIfMissing(queryRunner, "teacher_hour_logs", "classId", `"classId" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "teacher_hour_logs", "validated", `"validated" BOOLEAN DEFAULT (0)`);
    await this.addColumnIfMissing(queryRunner, "teacher_hour_logs", "created_at", `"created_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "teacher_hour_logs", "updated_at", `"updated_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "teacher_hour_logs", "deleted_at", `"deleted_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "salary_slips", "remote_id", `"remote_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "salary_slips", "user_id", `"user_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "salary_slips", "professorId", `"professorId" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "salary_slips", "month", `"month" VARCHAR(7) NULL`);
    await this.addColumnIfMissing(queryRunner, "salary_slips", "hoursTotal", `"hoursTotal" DECIMAL(7,2) DEFAULT (0)`);
    await this.addColumnIfMissing(queryRunner, "salary_slips", "hourlyRate", `"hourlyRate" DECIMAL(14,2) DEFAULT (0)`);
    await this.addColumnIfMissing(queryRunner, "salary_slips", "grossAmount", `"grossAmount" DECIMAL(14,2) DEFAULT (0)`);
    await this.addColumnIfMissing(queryRunner, "salary_slips", "netAmount", `"netAmount" DECIMAL(14,2) DEFAULT (0)`);
    await this.addColumnIfMissing(queryRunner, "salary_slips", "currency", `"currency" VARCHAR(10) NULL`);
    await this.addColumnIfMissing(queryRunner, "salary_slips", "deductions", `"deductions" TEXT NULL`);
    await this.addColumnIfMissing(queryRunner, "salary_slips", "additions", `"additions" TEXT NULL`);
    await this.addColumnIfMissing(queryRunner, "salary_slips", "status", `"status" VARCHAR(20) DEFAULT ('brouillon')`);
    await this.addColumnIfMissing(queryRunner, "salary_slips", "paymentId", `"paymentId" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "salary_slips", "created_at", `"created_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "salary_slips", "updated_at", `"updated_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "salary_slips", "deleted_at", `"deleted_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "receipt_counters", "lastNumber", `"lastNumber" INTEGER DEFAULT (0)`);
    await this.addColumnIfMissing(queryRunner, "receipt_counters", "updated_at", `"updated_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "professor_payment_counters", "lastNumber", `"lastNumber" INTEGER DEFAULT (0)`);
    await this.addColumnIfMissing(queryRunner, "professor_payment_counters", "updated_at", `"updated_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "fee_items", "remote_id", `"remote_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "fee_items", "user_id", `"user_id" VARCHAR(36) NULL`);
    await this.addColumnIfMissing(queryRunner, "fee_items", "name", `"name" VARCHAR(150) NULL`);
    await this.addColumnIfMissing(queryRunner, "fee_items", "category", `"category" VARCHAR(100) NULL`);
    await this.addColumnIfMissing(queryRunner, "fee_items", "amount", `"amount" DECIMAL(14,2) DEFAULT (0)`);
    await this.addColumnIfMissing(queryRunner, "fee_items", "currency", `"currency" VARCHAR(10) NULL`);
    await this.addColumnIfMissing(queryRunner, "fee_items", "gradeId", `"gradeId" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "fee_items", "schoolYear", `"schoolYear" VARCHAR NULL`);
    await this.addColumnIfMissing(queryRunner, "fee_items", "isActive", `"isActive" BOOLEAN DEFAULT (1)`);
    await this.addColumnIfMissing(queryRunner, "fee_items", "created_at", `"created_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "fee_items", "updated_at", `"updated_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "fee_items", "deleted_at", `"deleted_at" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "accounting_vault", "secretHash", `"secretHash" VARCHAR NULL`);
    await this.addColumnIfMissing(queryRunner, "accounting_vault", "setAt", `"setAt" DATETIME NULL`);
    await this.addColumnIfMissing(queryRunner, "accounting_vault", "updatedBy", `"updatedBy" INTEGER NULL`);
    await this.addColumnIfMissing(queryRunner, "accounting_vault", "failedAttempts", `"failedAttempts" INTEGER DEFAULT (0)`);
    await this.addColumnIfMissing(queryRunner, "accounting_vault", "lockedUntil", `"lockedUntil" DATETIME NULL`);
    await this.logCount(queryRunner, "bank_accounts");

    // --------------------------------------- 17. Convergence des index
    // Uniques partiels NULL-safe (miroir 171 §8).
    await this.uniqueIfColumnsExist(queryRunner, "UQ_professors_remote_id", "professors", ["remote_id"]);
    await this.uniqueIfColumnsExist(queryRunner, "UQ_payments_receiptNumber", "payments", ["receiptNumber"]);
    await this.uniqueIfColumnsExist(queryRunner, "UQ_payments_idempotencyKey", "payments", ["idempotencyKey"]);
    await this.uniqueIfColumnsExist(queryRunner, "UQ_payments_remote_id", "payments", ["remote_id"]);
    await this.uniqueIfColumnsExist(queryRunner, "UQ_prof_payments_reference", "professor_payments", ["reference"]);
    await this.uniqueIfColumnsExist(queryRunner, "UQ_prof_payments_idempotencyKey", "professor_payments", ["idempotencyKey"]);
    await this.uniqueIfColumnsExist(queryRunner, "UQ_prof_payments_remote_id", "professor_payments", ["remote_id"]);
    await this.uniqueIfColumnsExist(queryRunner, "UQ_expenses_idempotencyKey", "expenses", ["idempotencyKey"]);
    await this.uniqueIfColumnsExist(queryRunner, "UQ_expenses_remote_id", "expenses", ["remote_id"]);
    await this.uniqueIfColumnsExist(queryRunner, "UQ_cash_movements_idempotencyKey", "cash_movements", ["idempotencyKey"]);
    await this.uniqueIfColumnsExist(queryRunner, "UQ_cash_movements_remote_id", "cash_movements", ["remote_id"]);
    await this.uniqueIfColumnsExist(queryRunner, "UQ_bank_tx_idempotencyKey", "bank_transactions", ["idempotencyKey"]);
    await this.uniqueIfColumnsExist(queryRunner, "UQ_bank_tx_remote_id", "bank_transactions", ["remote_id"]);
    await this.uniqueIfColumnsExist(queryRunner, "UQ_bank_accounts_accountNumber", "bank_accounts", ["accountNumber"]);
    await this.uniqueIfColumnsExist(queryRunner, "UQ_bank_accounts_remote_id", "bank_accounts", ["remote_id"]);
    await this.uniqueIfColumnsExist(queryRunner, "UQ_cash_registers_remote_id", "cash_registers", ["remote_id"]);
    await this.uniqueIfColumnsExist(queryRunner, "UQ_cash_closures_remote_id", "cash_closures", ["remote_id"]);
    await this.uniqueIfColumnsExist(queryRunner, "UQ_hourlogs_remote_id", "teacher_hour_logs", ["remote_id"]);
    await this.uniqueIfColumnsExist(queryRunner, "UQ_salary_slips_remote_id", "salary_slips", ["remote_id"]);
    await this.uniqueIfColumnsExist(queryRunner, "UQ_fee_items_remote_id", "fee_items", ["remote_id"]);
    await this.uniqueIfColumnsExist(queryRunner, "UQ_tranch_config_remote_id", "tranch_config", ["remote_id"]);
    // Index métier (miroir 171 §9, 173, 174, 175).
    await this.indexIfColumnsExist(queryRunner, "IDX_payment_receiptNumber", "payments", ["receiptNumber"], `CREATE INDEX IF NOT EXISTS "IDX_payment_receiptNumber" ON "payments" ("receiptNumber")`);
    await this.indexIfColumnsExist(queryRunner, "IDX_expense_studentId", "expenses", ["studentId"], `CREATE INDEX IF NOT EXISTS "IDX_expense_studentId" ON "expenses" ("studentId")`);
    await this.indexIfColumnsExist(queryRunner, "UQ_cash_register_name_date", "cash_registers", ["name", "registerDate"], `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_cash_register_name_date" ON "cash_registers" ("name", "registerDate")`);
    await this.indexIfColumnsExist(queryRunner, "UQ_salary_slip_prof_month", "salary_slips", ["professorId", "month"], `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_salary_slip_prof_month" ON "salary_slips" ("professorId", "month")`);
    await this.indexIfColumnsExist(queryRunner, "IDX_hourlog_prof_month", "teacher_hour_logs", ["professorId", "month"], `CREATE INDEX IF NOT EXISTS "IDX_hourlog_prof_month" ON "teacher_hour_logs" ("professorId", "month")`);
    await this.indexIfColumnsExist(queryRunner, "IDX_feeitem_schoolYear", "fee_items", ["schoolYear"], `CREATE INDEX IF NOT EXISTS "IDX_feeitem_schoolYear" ON "fee_items" ("schoolYear")`);
    await this.indexIfColumnsExist(queryRunner, "IDX_payment_configs_schoolYear", "payment_configs", ["schoolYear"], `CREATE INDEX IF NOT EXISTS "IDX_payment_configs_schoolYear" ON "payment_configs" ("schoolYear")`);
    await this.indexIfColumnsExist(queryRunner, "IDX_payment_annual_config_schoolYear", "payment_annual_config", ["schoolYear"], `CREATE INDEX IF NOT EXISTS "IDX_payment_annual_config_schoolYear" ON "payment_annual_config" ("schoolYear")`);
    await this.indexIfColumnsExist(queryRunner, "IDX_grading_config_schoolYear", "grading_config", ["schoolYear"], `CREATE INDEX IF NOT EXISTS "IDX_grading_config_schoolYear" ON "grading_config" ("schoolYear")`);
    await this.indexIfColumnsExist(queryRunner, "IDX_tranch_config_schoolYear", "tranch_config", ["schoolYear"], `CREATE INDEX IF NOT EXISTS "IDX_tranch_config_schoolYear" ON "tranch_config" ("schoolYear")`);
    await this.indexIfColumnsExist(queryRunner, "IDX_tranch_config_annual", "tranch_config", ["paymentAnnualConfigId"], `CREATE INDEX IF NOT EXISTS "IDX_tranch_config_annual" ON "tranch_config" ("paymentAnnualConfigId")`);
    await this.indexIfColumnsExist(queryRunner, "IDX_grade_entry_student_course_period", "grade_entry", ["studentId", "courseId", "period"], `CREATE INDEX IF NOT EXISTS "IDX_grade_entry_student_course_period" ON "grade_entry" ("studentId", "courseId", "period")`);
    await this.indexIfColumnsExist(queryRunner, "IDX_calculated_grade_student_course_period", "calculated_grade", ["studentId", "courseId", "period"], `CREATE INDEX IF NOT EXISTS "IDX_calculated_grade_student_course_period" ON "calculated_grade" ("studentId", "courseId", "period")`);
    await this.indexIfColumnsExist(queryRunner, "IDX_schedules_prof_day_slot", "schedules", ["professor_id", "day", "time_slot"], `CREATE INDEX IF NOT EXISTS "IDX_schedules_prof_day_slot" ON "schedules" ("professor_id", "day", "time_slot")`);
  }

  public async down(): Promise<void> {
    // Append-only : pas de rollback destructif.
  }
}
