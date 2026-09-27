# RUNBOOK repair 1.1.30 — boucle `already exists` (temporary_tranch_config)

## Symptômes
- Au boot : `Failed to execute CREATE TABLE temporary_tranch_config ... already exists` (ou toute `temporary_*`).
- Boucle à chaque lancement, avant tout backup → l'app quitte via `Échec du Démarrage`.
- Cause : `synchronize:true` avant `runMigrations` (changement `TranchConfig.amount` 10,2→14,2 → copy-swap TypeORM sans `IF NOT EXISTS`) + interruption laissant le fantôme.

## Fix embarqué 1.1.31
1. `synchronize=false` par défaut (`E_SCHOOL_SYNC=1` = opt-in debug uniquement).
2. Étape `[1.5/4]` pré-boot à froid : backup `.pre-boot-<stamp>.db` + `DROP temporary_*` + `integrity_check` avant `initialize()`.
3. Migration `1740000000000-TranchConfigPrecision` idempotente (swap explicite 14,2 + nettoyage fantômes).
4. Outil `npm run repair:db` (ci-dessous) pour les bases déjà bloquées.

## Réparation manuelle (base bloquée en 1.1.30)
```bash
# 1. Localiser la DB prod
# Windows : %APPDATA%/Eschool/database.db
# Linux   : ~/.config/Eschool/database.db
# macOS   : ~/Library/Application Support/Eschool/database.db

# 2. Diagnostic sec (aucune mutation — défaut)
npm run repair:db -- --db "/chemin/database.db"

# 3. Purge réelle (backup .pre-repair-*.db + DROP + re-check)
npm run repair:db -- --db "/chemin/database.db" --apply

# 4. Vérification optionnelle sur copie (jamais la prod)
npm run migration:dryrun -- --db "/chemin/database.db"
```

## Vérifications
- `integrity_check` = `ok` avant ET après.
- `SELECT name FROM sqlite_master WHERE name LIKE 'temporary_%'` = vide.
- Boot 1.1.31 : logs `[1.5/4] Pre-boot repair OK`, `[2b/4] Migrations OK (ran=...TranchConfigPrecision...)`.
- Backups conservés : `.pre-boot-*.db` (rétention 5) + `.pre-migration-*.db` + `.pre-repair-*.db` — ne pas supprimer avant démarrage validé.

## Rollback
- Restaurer le backup froid : fermer l'app, copier `.pre-boot-<stamp>.db` (ou `.pre-repair-*.db`) sur `database.db`, relancer en 1.1.31.
- Ne jamais restaurer un `.db` avec `temporary_*` dedans sans repasser par `repair:db --apply`.
