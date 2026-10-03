import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * ParentTable1790000000000 — Option B Table Parent (Expand seulement).
 *
 * Crée `T_parent` + `T_student.parentId` (FK nullable) et backfill les foyers
 * depuis les colonnes à-plat existantes. Idempotente : ré-exécutable sans
 * doublon (IF NOT EXISTS / OR IGNORE / NOT EXISTS + skip `parentId` déjà liés).
 *
 * Partition (sur-création > sur-fusion en doute) :
 * - P1 : `normalizedPhone` non NULL → GROUP BY téléphone normalisé (1 foyer/tél).
 * - P2 : tél NULL + quadruplet (père/mère, normalisé) non vide → GROUP BY
 *   quadruplet exact. Recomposés/homonymes jamais fusionnés au-delà du
 *   quadruplet exact.
 * - P3 : tél NULL + quadruplet vide (`"|||"`) → 1 foyer PAR ÉLÈVE avec
 *   `suspect='no-key'`, jamais fusionné.
 *
 * Règles strictes :
 * - `normalizedPhone` = E.164 ou NULL, JAMAIS `''` (fail-fast si `''` trouvé).
 * - `down()` = détacher (`parentId` NULL) SANS DROP (append-only).
 * - Colonnes à-plat `T_student` conservées (`famillyPhone` typo 2L intacte).
 * - Règles de normalisation FIGÉES ici (snapshot) : identiques à
 *   `electron/backend/utils/normalize.ts` mais dupliquées pour que la
 *   migration reste stable si l'util évolue.
 */
export class ParentTable1790000000000 implements MigrationInterface {
  name = "ParentTable1790000000000";
  public readonly timestamp = 1790000000000;

  // ---------- Snapshot normalisation (figé) ----------
  private normPhone(raw: unknown): string | null {
    if (raw == null) return null;
    const text = String(raw).trim();
    if (text === "") return null;
    const stripped = text.replace(/[\s\-./()]/g, "");
    if (stripped === "" || stripped === "+") return null;
    const plus = stripped.startsWith("00") ? `+${stripped.slice(2)}` : stripped;
    const digits = plus.startsWith("+") ? plus.slice(1) : plus;
    if (digits === "" || /^0+$/.test(digits)) return null; // faux Excel '000000000'
    if (plus.startsWith("+")) {
      if (!/^\+[0-9]+$/.test(plus)) return null;
      return /^\+[1-9]\d{7,14}$/.test(plus) ? plus : null;
    }
    if (!/^[0-9]+$/.test(plus)) return null;
    if (/^[0-9]{8}$/.test(plus)) return `+223${plus}`; // Mali
    if (plus.length >= 8 && plus.length <= 15) {
      const cand = `+${plus}`;
      return /^\+[1-9]\d{7,14}$/.test(cand) ? cand : null;
    }
    return null;
  }

  private normName(raw: unknown): string {
    if (raw == null) return "";
    return String(raw)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .trim()
      .replace(/\s+/g, " ");
  }

  private quadKey(s: {
    fatherFirstname?: unknown;
    fatherLastname?: unknown;
    motherFirstname?: unknown;
    motherLastname?: unknown;
  }): string {
    return [
      this.normName(s.fatherFirstname),
      this.normName(s.fatherLastname),
      this.normName(s.motherFirstname),
      this.normName(s.motherLastname),
    ].join("|");
  }

  // ---------- DDL helpers ----------
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

  private async count(q: QueryRunner, sql: string, params: unknown[] = []): Promise<number> {
    const rows = (await q.query(sql, params as never[])) as Array<{ n: number }>;
    return Number(rows?.[0]?.n ?? -1);
  }

  private async report(
    q: QueryRunner,
    status: string,
    details: Record<string, unknown>,
  ): Promise<void> {
    try {
      await q.query(
        `CREATE TABLE IF NOT EXISTS "_migration_report" (` +
          `"id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, ` +
          `"migration" VARCHAR NOT NULL, ` +
          `"status" VARCHAR NOT NULL, ` +
          `"details" TEXT NULL, ` +
          `"createdAt" DATETIME DEFAULT (CURRENT_TIMESTAMP))`,
      );
      await q.query(`INSERT INTO "_migration_report" ("migration", "status", "details") VALUES (?, ?, ?)`, [
        this.name,
        status,
        JSON.stringify(details),
      ] as never[]);
    } catch {
      /* rapport best-effort */
    }
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    const startedHere = !queryRunner.isTransactionActive;
    if (startedHere) await queryRunner.startTransaction();
    try {
      await this.upInner(queryRunner);
      if (startedHere) await queryRunner.commitTransaction();
    } catch (e) {
      if (startedHere && queryRunner.isTransactionActive) {
        try {
          await queryRunner.rollbackTransaction();
        } catch {
          /* ignore */
        }
      }
      throw e;
    }
  }

  private async upInner(q: QueryRunner): Promise<void> {
    // 1) CREATE TABLE (idempotent).
    await q.query(
      `CREATE TABLE IF NOT EXISTS "T_parent" (` +
        `"id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, ` +
        `"fatherFirstname" TEXT NOT NULL DEFAULT (''), ` +
        `"fatherLastname" TEXT NOT NULL DEFAULT (''), ` +
        `"motherFirstname" TEXT NOT NULL DEFAULT (''), ` +
        `"motherLastname" TEXT NOT NULL DEFAULT (''), ` +
        `"famillyPhone" TEXT NULL, ` +
        `"normalizedPhone" VARCHAR(20) NULL, ` +
        `"address" TEXT NULL, ` +
        `"suspect" VARCHAR(16) NULL, ` +
        `"remote_id" VARCHAR(36) NULL, ` +
        `"user_id" VARCHAR(36) NULL, ` +
        `"createdAt" DATETIME DEFAULT (CURRENT_TIMESTAMP), ` +
        `"updatedAt" DATETIME DEFAULT (CURRENT_TIMESTAMP))`,
    );
    await q.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_parent_normalizedPhone" ON "T_parent" ("normalizedPhone")`,
    );
    await q.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_parent_remote_id" ON "T_parent" ("remote_id")`,
    );
    await q.query(
      `CREATE INDEX IF NOT EXISTS "IDX_parent_names" ON "T_parent" ("fatherLastname", "fatherFirstname", "motherLastname", "motherFirstname")`,
    );

    // 2) ALTER T_student ADD parentId (idempotent). FK non recréée si la
    // colonne existe déjà (SQLite : ADD COLUMN sans contrainte, SET NULL
    // applicatif via l'entité `onDelete: SET NULL`).
    await this.addColumnIfMissing(q, "T_student", "parentId", `"parentId" INTEGER NULL`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_student_parentId" ON "T_student" ("parentId")`);

    if (!(await q.hasTable("T_student"))) {
      await this.report(q, "SKIPPED_NO_STUDENT_TABLE", { parents: 0 });
      return;
    }

    // 3) Backfill (idempotent : ne traite que `parentId IS NULL`).
    type SRow = {
      id: number;
      fatherFirstname: string | null;
      fatherLastname: string | null;
      motherFirstname: string | null;
      motherLastname: string | null;
      famillyPhone: string | null;
      address: string | null;
    };
    const rows: SRow[] = await q.query(
      `SELECT "id", "fatherFirstname", "fatherLastname", "motherFirstname", "motherLastname", "famillyPhone", "address" FROM "T_student" WHERE "parentId" IS NULL`,
    );
    console.log(`[migration-179] élèves sans parentId: ${(rows ?? []).length}`);

    // Parents P2 existants (tél NULL, non suspects) pour réutilisation idempotente.
    type PRow = {
      id: number;
      fatherFirstname: string | null;
      fatherLastname: string | null;
      motherFirstname: string | null;
      motherLastname: string | null;
    };
    let existingP2: PRow[] = [];
    try {
      existingP2 =
        (await q.query(
          `SELECT "id", "fatherFirstname", "fatherLastname", "motherFirstname", "motherLastname" FROM "T_parent" WHERE "normalizedPhone" IS NULL AND ("suspect" IS NULL OR "suspect" != 'no-key')`,
        )) ?? [];
    } catch {
      existingP2 = [];
    }
    const p2KeyToId = new Map<string, number>();
    for (const p of existingP2) p2KeyToId.set(this.quadKey(p), Number(p.id));

    const p1Groups = new Map<string, SRow[]>();
    const p2Groups = new Map<string, SRow[]>();
    const p3Rows: SRow[] = [];
    for (const r of rows ?? []) {
      const np = this.normPhone(r.famillyPhone);
      if (np != null) {
        const g = p1Groups.get(np) ?? [];
        g.push(r);
        p1Groups.set(np, g);
      } else {
        const key = this.quadKey(r);
        if (key === "|||") p3Rows.push(r);
        else {
          const g = p2Groups.get(key) ?? [];
          g.push(r);
          p2Groups.set(key, g);
        }
      }
    }
    console.log(`[migration-179] P1(tél)=${p1Groups.size} groupes, P2(noms)=${p2Groups.size} groupes, P3(orphelins)=${p3Rows.length}`);

    const findParentByPhone = async (np: string): Promise<number | null> => {
      const hit = (await q.query(`SELECT "id" FROM "T_parent" WHERE "normalizedPhone" = ? LIMIT 1`, [
        np,
      ] as never[])) as Array<{ id: number }>;
      return hit?.[0] != null ? Number(hit[0].id) : null;
    };
    const insertParent = async (v: {
      ff: string;
      fl: string;
      mf: string;
      ml: string;
      phone: string | null;
      np: string | null;
      address: string | null;
      suspect: string | null;
    }): Promise<number> => {
      if (v.np != null) {
        await q.query(
          `INSERT OR IGNORE INTO "T_parent" ("fatherFirstname", "fatherLastname", "motherFirstname", "motherLastname", "famillyPhone", "normalizedPhone", "address", "suspect", "remote_id") VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
          [v.ff, v.fl, v.mf, v.ml, v.phone, v.np, v.address, v.suspect] as never[],
        );
        const id = await findParentByPhone(v.np);
        if (id == null) throw new Error(`[migration-179] parent P1 introuvable après INSERT OR IGNORE (${v.np})`);
        return id;
      }
      const res = (await q.query(
        `INSERT INTO "T_parent" ("fatherFirstname", "fatherLastname", "motherFirstname", "motherLastname", "famillyPhone", "normalizedPhone", "address", "suspect", "remote_id") VALUES (?, ?, ?, ?, ?, NULL, ?, ?, NULL)`,
        [v.ff, v.fl, v.mf, v.ml, v.phone, v.address, v.suspect] as never[],
      )) as unknown;
      // better-sqlite3 ne retourne pas l'id via TypeORM : relire par rowid.
      const last = (await q.query(`SELECT last_insert_rowid() AS "id"`)) as Array<{ id: number }>;
      void res;
      return Number(last?.[0]?.id);
    };

    const map = new Map<number, number>(); // studentId -> parentId
    let created = 0;

    // P1 : 1 foyer par téléphone normalisé.
    for (const [np, group] of p1Groups) {
      const first = group[0];
      let pid = await findParentByPhone(np);
      if (pid == null) {
        pid = await insertParent({
          ff: String(first.fatherFirstname ?? ""),
          fl: String(first.fatherLastname ?? ""),
          mf: String(first.motherFirstname ?? ""),
          ml: String(first.motherLastname ?? ""),
          phone: first.famillyPhone ?? null,
          np,
          address: first.address ?? null,
          suspect: null,
        });
        created++;
      }
      for (const s of group) map.set(Number(s.id), pid);
    }

    // P2 : 1 foyer par quadruplet exact (tél NULL).
    for (const [key, group] of p2Groups) {
      const first = group[0];
      let pid = p2KeyToId.get(key) ?? null;
      if (pid == null) {
        const hit = (await q.query(
          `SELECT "id" FROM "T_parent" WHERE "normalizedPhone" IS NULL AND ("suspect" IS NULL OR "suspect" != 'no-key') AND COALESCE("fatherFirstname",'') = ? AND COALESCE("fatherLastname",'') = ? AND COALESCE("motherFirstname",'') = ? AND COALESCE("motherLastname",'') = ? LIMIT 1`,
          [
            String(first.fatherFirstname ?? ""),
            String(first.fatherLastname ?? ""),
            String(first.motherFirstname ?? ""),
            String(first.motherLastname ?? ""),
          ] as never[],
        )) as Array<{ id: number }>;
        pid = hit?.[0] != null ? Number(hit[0].id) : null;
      }
      if (pid == null) {
        pid = await insertParent({
          ff: String(first.fatherFirstname ?? ""),
          fl: String(first.fatherLastname ?? ""),
          mf: String(first.motherFirstname ?? ""),
          ml: String(first.motherLastname ?? ""),
          phone: first.famillyPhone ?? null, // brut conservé, np reste NULL
          np: null,
          address: first.address ?? null,
          suspect: null,
        });
        created++;
        p2KeyToId.set(key, pid);
      }
      for (const s of group) map.set(Number(s.id), pid);
    }

    // P3 : 1 foyer PAR ÉLÈVE, suspect='no-key', jamais fusionné.
    for (const s of p3Rows) {
      const pid = await insertParent({
        ff: String(s.fatherFirstname ?? ""),
        fl: String(s.fatherLastname ?? ""),
        mf: String(s.motherFirstname ?? ""),
        ml: String(s.motherLastname ?? ""),
        phone: s.famillyPhone ?? null,
        np: null,
        address: s.address ?? null,
        suspect: "no-key",
      });
      created++;
      map.set(Number(s.id), pid);
    }

    // 4) UPDATE via table temp _parent_map (idempotent : NOT EXISTS déjà garanti
    // par le WHERE parentId IS NULL du SELECT, mais on re-vérifie à l'UPDATE).
    if (map.size > 0) {
      await q.query(`DROP TABLE IF EXISTS "_parent_map"`);
      await q.query(
        `CREATE TEMPORARY TABLE "_parent_map" ("studentId" INTEGER PRIMARY KEY NOT NULL, "parentId" INTEGER NOT NULL)`,
      );
      const entries = [...map.entries()];
      const CHUNK = 250;
      for (let i = 0; i < entries.length; i += CHUNK) {
        const slice = entries.slice(i, i + CHUNK);
        const placeholders = slice.map(() => `(?, ?)`).join(", ");
        const params: number[] = [];
        for (const [sid, pid] of slice) params.push(sid, pid);
        await q.query(`INSERT INTO "_parent_map" ("studentId", "parentId") VALUES ${placeholders}`, params as never[]);
      }
      await q.query(
        `UPDATE "T_student" SET "parentId" = (SELECT "_parent_map"."parentId" FROM "_parent_map" WHERE "_parent_map"."studentId" = "T_student"."id") WHERE "id" IN (SELECT "studentId" FROM "_parent_map") AND "parentId" IS NULL`,
      );
      await q.query(`DROP TABLE IF EXISTS "_parent_map"`);
    }
    console.log(`[migration-179] foyers créés=${created}, élèves liés=${map.size}`);

    // 5) Vérifications fail-fast.
    // (a) tél valide sans parentId = 0 (recalcul JS : tout P1 doit être lié).
    const stillNull = await this.count(
      q,
      `SELECT COUNT(*) AS "n" FROM "T_student" WHERE "id" IN (${[...map.keys()].map(() => "?").join(", ") || "NULL"}) AND "parentId" IS NULL`,
      [...map.keys()],
    );
    // (b) jamais de '' dans normalizedPhone.
    const emptyNp = await this.count(q, `SELECT COUNT(*) AS "n" FROM "T_parent" WHERE "normalizedPhone" = ''`);
    // (c) FK orphelines = 0.
    const orphanFk = await this.count(
      q,
      `SELECT COUNT(*) AS "n" FROM "T_student" "s" LEFT JOIN "T_parent" "p" ON "p"."id" = "s"."parentId" WHERE "s"."parentId" IS NOT NULL AND "p"."id" IS NULL`,
    );
    const parentCount = await this.count(q, `SELECT COUNT(*) AS "n" FROM "T_parent"`);
    const linkedCount = await this.count(q, `SELECT COUNT(*) AS "n" FROM "T_student" WHERE "parentId" IS NOT NULL`);
    console.log(
      `[migration-179] vérifs: non-liés-du-lot=${stillNull} emptyNp=${emptyNp} fkOrphelines=${orphanFk} parents=${parentCount} élèvesLiés=${linkedCount}`,
    );
    await this.report(q, "SUCCESS", {
      elevesSansParentAvant: rows.length,
      p1Groupes: p1Groups.size,
      p2Groupes: p2Groups.size,
      p3Orphelins: p3Rows.length,
      foyersCrees: created,
      elevesLies: map.size,
      nonLiesDuLot: stillNull,
      emptyNp,
      fkOrphelines: orphanFk,
      parentsTotal: parentCount,
      elevesLiesTotal: linkedCount,
    });
    if (stillNull !== 0) throw new Error(`[migration-179] FAIL: ${stillNull} élève(s) du lot sans parentId`);
    if (emptyNp !== 0) throw new Error(`[migration-179] FAIL: ${emptyNp} normalizedPhone = '' (attendu NULL)`);
    if (orphanFk !== 0) throw new Error(`[migration-179] FAIL: ${orphanFk} FK parentId orpheline(s)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Append-only : détacher sans DROP (les foyers restent pour audit).
    try {
      if (await queryRunner.hasTable("T_student")) {
        if (await queryRunner.hasColumn("T_student", "parentId")) {
          await queryRunner.query(`UPDATE "T_student" SET "parentId" = NULL WHERE "parentId" IS NOT NULL`);
        }
      }
      await this.report(queryRunner, "DOWN_DETACH", { detached: true });
    } catch {
      /* best-effort */
    }
  }
}
