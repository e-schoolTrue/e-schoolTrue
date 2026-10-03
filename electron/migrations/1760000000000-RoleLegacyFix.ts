import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * RoleLegacyFix1760000000000 — legacy `user.role` NULL/invalide → 'admin'.
 *
 * Contexte (train unique, backup Admin seul) : de vieilles bases portent des
 * lignes `user` sans rôle (NULL, '', valeur hors enum). Le RBAC deny-by-default
 * + `AuthService.init` forceraient alors purge + re-login, voire lock-out du
 * premier administrateur. Cette migration force 'admin' (idempotente) :
 * - garde hasTable (table `user` absente en fresh = no-op, la baseline crée
 *   le schéma avec default admin) ;
 * - COUNT avant/après loggés (traçabilité, zéro assert bloquant) ;
 * - UPDATE ciblé uniquement sur les lignes hors enum
 *   (admin, professor, student, comptable) ;
 * - down() no-op (append-only).
 *
 * RÈGLES SANS BREAK : aucun DROP, aucun ALTER, aucun NOT NULL.
 */
const VALID_ROLES = ["admin", "professor", "student", "comptable"];

export class RoleLegacyFix1760000000000 implements MigrationInterface {
  name = "RoleLegacyFix1760000000000";
  public readonly timestamp = 1760000000000;

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable("user"))) return;
    const hasRole = await queryRunner.hasColumn("user", "role");
    if (!hasRole) return;

    let before = -1;
    try {
      const rows: Array<{ count: number }> = await queryRunner.query(
        `SELECT COUNT(*) AS "count" FROM "user" WHERE "role" IS NULL OR TRIM("role") = '' OR "role" NOT IN ('admin','professor','student','comptable')`,
      );
      before = Number(rows?.[0]?.count ?? -1);
    } catch {
      /* best-effort */
    }
    console.log(`[migration-176] user.role legacy à réparer : COUNT=${before}`);

    await queryRunner.query(
      `UPDATE "user" SET "role" = 'admin' WHERE "role" IS NULL OR TRIM("role") = '' OR "role" NOT IN ('admin','professor','student','comptable')`,
    );

    try {
      const total: Array<{ count: number }> = await queryRunner.query(
        `SELECT COUNT(*) AS "count" FROM "user"`,
      );
      const admins: Array<{ count: number }> = await queryRunner.query(
        `SELECT COUNT(*) AS "count" FROM "user" WHERE "role" = 'admin'`,
      );
      console.log(
        `[migration-176] après fix : users=${Number(total?.[0]?.count ?? -1)} admins=${Number(admins?.[0]?.count ?? -1)} (réparés=${before})`,
      );
    } catch {
      /* best-effort */
    }
    void VALID_ROLES;
  }

  public async down(): Promise<void> {
    // Append-only : pas de rollback destructif.
  }
}
