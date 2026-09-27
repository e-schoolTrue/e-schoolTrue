/**
 * Baseline1700000000000 — snapshot initial du schéma (transition synchronize ON).
 *
 * Contexte : la base historique a été créée par `synchronize:true` (aucune
 * table `migrations`). Cette baseline est le point d'ancrage :
 *  - fresh install  → up() crée le schéma de référence (additif uniquement) ;
 *  - base existante → `ensureBaseline()` la marque applied SANS rejouer up(),
 *    puis synchronize (encore ON pendant la transition) converge les colonnes.
 *
 * up() réexécutable : ne joue que des CREATE normalisés en
 * `IF NOT EXISTS`, générés depuis les entityMetadatas courantes
 * (donc "complet basé sur les entities actuelles" par construction,
 * sans snapshot SQL figé qui dériverait). Les ALTER/DROP éventuels du
 * SchemaBuilder sont ignorés ici : les évolutions vont dans des
 * migrations dédiées, jamais dans la baseline.
 * down() volontairement vide : on ne détruit jamais une baseline.
 *
 * Pour figer un snapshot SQL statique (audit) : `npm run db:schema:log`.
 */
import type { MigrationInterface, QueryRunner } from "typeorm";

function toIfNotExists(sql: string): string {
  let out = sql.trim();
  if (/^CREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS)/i.test(out)) {
    out = out.replace(/^CREATE\s+TABLE\s+/i, "CREATE TABLE IF NOT EXISTS ");
  } else if (/^CREATE\s+UNIQUE\s+INDEX\s+(?!IF\s+NOT\s+EXISTS)/i.test(out)) {
    out = out.replace(/^CREATE\s+UNIQUE\s+INDEX\s+/i, "CREATE UNIQUE INDEX IF NOT EXISTS ");
  } else if (/^CREATE\s+INDEX\s+(?!IF\s+NOT\s+EXISTS)/i.test(out)) {
    out = out.replace(/^CREATE\s+INDEX\s+/i, "CREATE INDEX IF NOT EXISTS ");
  }
  return out;
}

export class Baseline1700000000000 implements MigrationInterface {
  public readonly name = "Baseline1700000000000";
  public readonly timestamp = 1700000000000;

  public async up(queryRunner: QueryRunner): Promise<void> {
    const builder = queryRunner.connection.driver.createSchemaBuilder();
    const { upQueries } = await builder.log();
    for (const q of upQueries) {
      const raw = String((q as { query?: unknown }).query ?? q).trim();
      if (!/^CREATE\s+/i.test(raw)) continue; // additif uniquement
      const safe = toIfNotExists(raw);
      // eslint-disable-next-line no-await-in-loop
      await queryRunner.query(safe);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function
  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Baseline indestructible : down vide par design.
  }
}
