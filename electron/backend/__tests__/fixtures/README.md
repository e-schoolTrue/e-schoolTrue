# Fixture 1.1.14 anonymisée

## Fichier

- `anonymized-1.1.14.db` — fixture physique legacy (générée, **non commitée** par défaut).
- `generate-1.1.14-fixture.ts` — script de génération déterministe (source de vérité).

## Régénération

```bash
npx tsx electron/backend/__tests__/fixtures/generate-1.1.14-fixture.ts [outPath]
# défaut : electron/backend/__tests__/fixtures/anonymized-1.1.14.db
```

## Contenu garanti

- 100 % synthétique : `ELEVE-001/002 / ANONYMIZED`, montants `50 000 + 75 000 + 125 000 = 250 000 GNF`, `COUNT = 3`.
- Aucune donnée personnelle, aucun secret/token/hash réel.
- Schéma legacy : **sans** `schedule_configs`, **sans** tables `accounting*` (`expenses`, `cash_*`, `bank_*`, `teacher_hour_logs`, `salary_slips`, `receipt_counters`, `professor_payment_counters`, `fee_items`, `accounting_vault`), `payments` **sans** colonne `receiptNumber`.

## Usage dans les tests

`../migration-upgrade.spec.ts` reconstruit ce même legacy en tmpdir via `createLegacy114Db()` (pas de dépendance au fichier `.db`). La fixture physique sert uniquement au debug manuel (`sqlite3`, DB Browser) et à la revue du schéma 1.1.14.
