# ADR — synchronize OFF par défaut (fix 1.1.31)

## Statut
Accepté — version 1.1.31.

## Contexte
- `AppDataSource.initialize()` tournait avec `synchronize:true` (défaut) AVANT `runMigrationsSafely`.
- Le changement `TranchConfig.amount` decimal 10,2→14,2 a déclenché le copy-swap implicite de TypeORM : `CREATE TABLE temporary_tranch_config` **sans** `IF NOT EXISTS`.
- Interruption pendant le swap → table fantôme persistée → chaque boot suivant échouait sur `already exists` **avant** tout backup, en boucle.

## Décision
- `synchronize = (E_SCHOOL_SYNC === "1")`, défaut **false**. `migrationsRun` reste `false` (le runner orchestre).
- Schéma évolue uniquement via migrations idempotentes (`CREATE ... IF NOT EXISTS`, guards `hasTable`/`hasColumn`, jamais de `NOT NULL` sans `DEFAULT`).
- Ajout étape `[1.5/4]` pré-boot à froid : copie `.pre-boot-<stamp>.db` + fsync (rétention 5), `DROP temporary_*`, `integrity_check` bloquant avant `initialize()`.
- Migration `1740000000000-TranchConfigPrecision` : swap explicite 14,2 + purge fantômes + `schoolYear` + index.
- `tableExists()` ignore `temporary_*` ; `tranch_config` ajoutée aux tables cœur post-vérifiées.

## Conséquences
- (+) Plus de DDL implicite au boot : démarrages déterministes, p99 boot < 2 s (VACUUM + checks en O(n) pages).
- (+) Fantômes auto-réparés (boot + CLI `repair:db --apply`, `--dry-run` par défaut).
- (−) Toute évolution schéma exige une migration enregistrée dans `data-source.ts` (garde `migration-registration.spec.ts`).
- Debug ciblé : `E_SCHOOL_SYNC=1` réactive synchronize explicitement (jamais en prod).

## Alternatives rejetées
- `synchronize:true` après migrations : même course (swap implicite) + divergence baseline.
- `DROP temporary_*` uniquement dans le runner (post-initialize) : trop tard, `initialize()` échoue avant.
