# ADR — Règle NULLABLE/DEFAULT + fail-open audit (train unique)

## Statut
Accepté — train unique (schoolyear `year:getCurrent` + backup Admin seul + drift 175/176).

## Contexte
- Les bases legacy (créées par `synchronize:true`) divergent des entities :
  tables/colonnes manquantes (`payment_annual_config`, `grade_entry`, …),
  `user.role` NULL, `tranch_config.schoolYear` absent.
- SQLite refuse `ALTER TABLE … ADD COLUMN … NOT NULL` sans défaut sur table
  peuplée ; un UNIQUE sur colonne peuplée peut échouer (doublons legacy).
- L'audit (`audit_log`) ne doit jamais bloquer le métier (fail-open) :
  `protectedHandle` enregistre en best-effort (`console.warn` en échec).

## Décision — Règle NULLABLE/DEFAULT
1. Toute colonne ajoutée par migration est **NULLABLE** ou porte un **DEFAULT**
   (`VARCHAR NULL`, `INTEGER DEFAULT (0)`, `DATETIME DEFAULT (CURRENT_TIMESTAMP)`…).
2. Jamais de `NOT NULL` sans `DEFAULT` (seules les PK auto-générées portent
   `NOT NULL`, fourni par SQLite lui-même).
3. Jamais de `DROP TABLE` / `DROP COLUMN` en migration (`down()` no-op,
   append-only) ; jamais d'index `UNIQUE` sur données legacy non dédupliquées
   (uniques NULL-safe partiels uniquement sur colonnes neuves contrôlées).
4. `user.role` legacy (NULL, '', hors enum) → `'admin'` (migration 176,
   idempotente, COUNT avant/après loggés) ; `AuthService.init` force `admin`
   pour la session legacy du premier utilisateur, purge + re-login sinon.
5. Audit fail-open partout : `try/catch` autour de chaque
   `auditLogService.record` (security.ts, yearService clone, events.ts) —
   l'échec d'audit est loggé, jamais propagé.

## Conséquences
- (+) Migrations rejouables sans perte (idempotentes, vérifiées par
  `migration-registration.spec.ts` + `migration-upgrade.spec.ts`).
- (+) Aucun lock-out admin sur bases legacy (backup reste accessible).
- (−) Les colonnes legacy restent NULL jusqu'au backfill métier explicite
  (lecture : `NULL` = fallback, jamais de valeur inventée).
- (−) Les uniques métier doivent être posés par une migration dédiée avec
  déduplication préalable, pas dans le drift catch-up.

## Migrations du train
- `1750000000000-DriftCatchup2` : CREATE IF NOT EXISTS + ADD COLUMN IF
  MISSING (11 tables, index simples seuls, COUNT loggés).
- `1760000000000-RoleLegacyFix` : `UPDATE user SET role='admin'` ciblé.
- `migration-runner` : CORE_TABLES 12 (vérif seule) + contrôle
  `year_repartition(status, closedAt)`.
