/**
 * typeorm-datasource — export DataSource par défaut pour le CLI TypeORM
 * (migration:generate / migration:run / migration:show / migration:revert).
 *
 * DB cible via E_SCHOOL_DB (défaut : ./data/cli-database.db, jamais la prod).
 * synchronize:false, migrationsRun:false — le CLI ne mute que via migrations.
 */
import "reflect-metadata";
import * as path from "node:path";
import { createCliDataSource } from "./cli-datasource";

const dbPath =
  process.env.E_SCHOOL_DB?.trim() ||
  path.resolve(process.cwd(), "data", "cli-database.db");

const ds = createCliDataSource(dbPath);
export default ds;
