-- ============================================================
-- E-School: Migration 007 — Three levels (idempotent, replay-safe)
-- Miroir cloud de la migration SQLite 178 (3 niveaux) :
--   PRESCOLAIRE | PRIMAIRE | SECONDAIRE.
-- - year_repartition.level + backfill 2025-2026 (SECONDAIRE semestres
--   courante, PRIMAIRE trimestres, PRESCOLAIRE copie dates primaire,
--   vide, non-courante, active) + UNIQUE (school_year, level).
-- - grade.level (PRIMARY→PRIMAIRE, SECONDARY→SECONDAIRE, noms
--   Petite/Moyenne/Grande → PRESCOLAIRE) + order/next + index.
--   Aucune création auto de grades préscolaire (vide + UI création).
-- - grading_config : school_year NULL→2025-2026, level via class_id→grade,
--   AVRIL→AVR (si colonne period présente).
-- - payment_config : school_year NULL→2025-2026, level même mapping,
--   class_name depuis grade.name, orphelines → payment_config_orphans
--   (quarantaine, AUCUN delete source).
-- Ne touche jamais à 001/002 (règle 003). Ré-exécutable sans erreur.
-- ============================================================

-- ---- 0. Fonction de migration par schema (idempotente) ----
CREATE OR REPLACE FUNCTION public.apply_three_levels(p_schema text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $lvl$
BEGIN
    -- §A year_repartition.level
    EXECUTE format('ALTER TABLE %I.year_repartition ADD COLUMN IF NOT EXISTS level text NOT NULL DEFAULT ''PRIMAIRE''', p_schema);
    EXECUTE format('UPDATE %I.year_repartition SET level = ''PRIMAIRE'' WHERE level IS NULL OR btrim(level) = '''' OR upper(btrim(level)) NOT IN (''PRESCOLAIRE'',''PRIMAIRE'',''SECONDAIRE'')', p_schema);
    -- Backfill legacy 2025-2026 : 2 périodes+courante → SECONDAIRE (semestres),
    -- 3 périodes → PRIMAIRE (trimestres). Idempotent (WHERE level déjà défaut).
    EXECUTE format($q$
        UPDATE %I.year_repartition SET
            school_year = '2025-2026',
            level = 'SECONDAIRE',
            period_configurations = '[{"name":"Semestre 1","start":"2025-10-06","end":"2026-02-15"},{"name":"Semestre 2","start":"2026-02-16","end":"2026-06-30"}]'::jsonb,
            is_current = true
        WHERE school_year = '2025-2026'
          AND jsonb_array_length(period_configurations) = 2
          AND is_current = true
          AND upper(level) = 'PRIMAIRE'
    $q$, p_schema);
    EXECUTE format($q$
        UPDATE %I.year_repartition SET
            school_year = '2025-2026',
            level = 'PRIMAIRE',
            period_configurations = '[{"name":"Trimestre 1","start":"2025-10-06","end":"2025-12-31"},{"name":"Trimestre 2","start":"2026-01-01","end":"2026-04-18"},{"name":"Trimestre 3","start":"2026-04-19","end":"2026-06-30"}]'::jsonb
        WHERE school_year = '2025-2026'
          AND jsonb_array_length(period_configurations) = 3
          AND upper(level) = 'PRIMAIRE'
          AND NOT (is_current = true AND jsonb_array_length(period_configurations) = 2)
    $q$, p_schema);
    -- Ligne PRESCOLAIRE : copie dates PRIMAIRE, non-courante, active si dispo.
    EXECUTE format($q$
        INSERT INTO %I.year_repartition (school_year, period_configurations, is_current, level)
        SELECT '2025-2026', y.period_configurations, false, 'PRESCOLAIRE'
        FROM %I.year_repartition y
        WHERE y.school_year = '2025-2026' AND upper(y.level) = 'PRIMAIRE'
        ORDER BY y.created_at NULLS LAST LIMIT 1
        ON CONFLICT DO NOTHING
        -- garde anti-doublon : skip si PRESCOLAIRE déjà présent pour 2025-2026
        -- (ON CONFLICT sans contrainte exacte = no-op ; le WHERE suivant verrouille)
    $q$, p_schema, p_schema);
    EXECUTE format($q$
        DELETE FROM %I.year_repartition a USING %I.year_repartition b
        WHERE a.school_year = '2025-2026' AND upper(a.level) = 'PRESCOLAIRE'
          AND b.school_year = '2025-2026' AND upper(b.level) = 'PRESCOLAIRE'
          AND a.id > b.id
    $q$, p_schema, p_schema);
    EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS uq_year_repartition_school_year_level ON %I.year_repartition (school_year, level)', p_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_year_repartition_level ON %I.year_repartition (level)', p_schema);

    -- §B grade.level + order/next
    EXECUTE format('ALTER TABLE %I.grade ADD COLUMN IF NOT EXISTS level text', p_schema);
    EXECUTE format('ALTER TABLE %I.grade ADD COLUMN IF NOT EXISTS "order" integer', p_schema);
    EXECUTE format('ALTER TABLE %I.grade ADD COLUMN IF NOT EXISTS next_grade_id uuid', p_schema);
    EXECUTE format($q$
        UPDATE %I.grade SET level = CASE WHEN upper(btrim(type)) = 'SECONDARY' THEN 'SECONDAIRE' ELSE 'PRIMAIRE' END
        WHERE level IS NULL OR btrim(level) = ''
    $q$, p_schema);
    EXECUTE format($q$
        UPDATE %I.grade SET level = 'PRESCOLAIRE'
        WHERE unaccent(lower(name)) LIKE '%%petite%%' OR unaccent(lower(name)) LIKE '%%moyenne%%'
           OR unaccent(lower(name)) LIKE '%%grande%% section%%' OR unaccent(lower(name)) LIKE '%%grande section%%'
    $q$, p_schema);
    -- (unaccent peut manquer : repli LIKE simple, best-effort)
    BEGIN
        EXECUTE format($q$
            UPDATE %I.grade SET level = 'PRESCOLAIRE'
            WHERE lower(name) LIKE '%%petite%%' OR lower(name) LIKE '%%moyenne%%' OR lower(name) LIKE '%%grande%%'
        $q$, p_schema);
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Migration 007: repli prescolaire LIKE: %', SQLERRM;
    END;
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_grade_level ON %I.grade (level)', p_schema);

    -- §C grading_config
    EXECUTE format('ALTER TABLE %I.grading_config ADD COLUMN IF NOT EXISTS school_year text', p_schema);
    EXECUTE format('ALTER TABLE %I.grading_config ADD COLUMN IF NOT EXISTS level text', p_schema);
    EXECUTE format('ALTER TABLE %I.grading_config ADD COLUMN IF NOT EXISTS period varchar(100)', p_schema);
    EXECUTE format('UPDATE %I.grading_config SET school_year = ''2025-2026'' WHERE school_year IS NULL OR btrim(school_year) = ''''', p_schema);
    EXECUTE format('UPDATE %I.grading_config SET period = ''AVR'' WHERE period = ''AVRIL''', p_schema);
    -- level via class_id → grade (join text-safe : class_id integer côté cloud)
    BEGIN
        EXECUTE format($q$
            UPDATE %I.grading_config gc SET level = g.level
            FROM %I.grade g WHERE g.id = gc.class_id
              AND (gc.level IS NULL OR btrim(gc.level) = '')
        $q$, p_schema, p_schema);
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Migration 007: grading_config.level join: %', SQLERRM;
    END;
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_grading_config_level ON %I.grading_config (level)', p_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_grading_config_school_year ON %I.grading_config (school_year)', p_schema);

    -- §D payment_config (+ quarantaine, jamais de delete source)
    EXECUTE format('ALTER TABLE %I.payment_config ADD COLUMN IF NOT EXISTS school_year text', p_schema);
    EXECUTE format('ALTER TABLE %I.payment_config ADD COLUMN IF NOT EXISTS level text', p_schema);
    EXECUTE format('UPDATE %I.payment_config SET school_year = ''2025-2026'' WHERE school_year IS NULL OR btrim(school_year) = ''''', p_schema);
    BEGIN
        EXECUTE format($q$
            UPDATE %I.payment_config pc SET level = g.level
            FROM %I.grade g WHERE g.id::text = btrim(pc.class_id)
              AND (pc.level IS NULL OR btrim(pc.level) = '')
        $q$, p_schema, p_schema);
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Migration 007: payment_config.level join: %', SQLERRM;
    END;
    BEGIN
        EXECUTE format($q$
            UPDATE %I.payment_config pc SET class_name = g.name
            FROM %I.grade g WHERE g.id::text = btrim(pc.class_id)
              AND (pc.class_name IS NULL OR btrim(pc.class_name) = '')
        $q$, p_schema, p_schema);
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Migration 007: payment_config.class_name join: %', SQLERRM;
    END;
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.payment_config_orphans (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            source_id uuid NULL,
            class_id text NULL,
            class_name text NULL,
            school_year text NULL,
            level text NULL,
            reason text NULL DEFAULT ''ORPHAN_CLASS_ID'',
            quarantined_at timestamptz NOT NULL DEFAULT now()
        )', p_schema);
    -- Copie idempotente (anti-doublon source_id), source conservée.
    BEGIN
        EXECUTE format($q$
            INSERT INTO %I.payment_config_orphans (source_id, class_id, class_name, school_year, level, reason)
            SELECT pc.id, pc.class_id, pc.class_name, pc.school_year, pc.level, 'ORPHAN_CLASS_ID'
            FROM %I.payment_config pc LEFT JOIN %I.grade g ON g.id::text = btrim(pc.class_id)
            WHERE pc.class_id IS NOT NULL AND btrim(pc.class_id) <> '' AND g.id IS NULL
              AND NOT EXISTS (SELECT 1 FROM %I.payment_config_orphans q WHERE q.source_id = pc.id)
        $q$, p_schema, p_schema, p_schema, p_schema);
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Migration 007: quarantine orphans: %', SQLERRM;
    END;
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_payment_config_level ON %I.payment_config (level)', p_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_payment_config_school_year ON %I.payment_config (school_year)', p_schema);

    EXECUTE format('GRANT ALL ON ALL TABLES IN SCHEMA %I TO service_role, authenticated', p_schema);
END;
$lvl$;

GRANT EXECUTE ON FUNCTION public.apply_three_levels(text) TO authenticated;

-- ---- 1. Boucle sur les schemas existants (pattern 004 §2 / 006 §1) ----
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN SELECT schema_name FROM public.schools_registry LOOP
        BEGIN
            PERFORM public.apply_three_levels(r.schema_name);
            INSERT INTO public.migration_ledger (migration_name, schema_name, status)
            VALUES ('007_three_levels', r.schema_name, 'applied')
            ON CONFLICT (migration_name, schema_name)
            DO UPDATE SET applied_at = now(), status = 'applied', error_message = NULL;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Migration 007: échec pour schema %: %', r.schema_name, SQLERRM;
            BEGIN
                INSERT INTO public.migration_ledger (migration_name, schema_name, status, error_message)
                VALUES ('007_three_levels', r.schema_name, 'failed', SQLERRM)
                ON CONFLICT (migration_name, schema_name)
                DO UPDATE SET applied_at = now(), status = 'failed', error_message = EXCLUDED.error_message;
            EXCEPTION WHEN OTHERS THEN
                RAISE WARNING 'Migration 007: ledger write failed for %: %', r.schema_name, SQLERRM;
            END;
        END;
    END LOOP;
END
$$;

-- ---- 2. Futurs schemas : chaîner three_levels après drift3 (provision) ----
CREATE OR REPLACE FUNCTION public.provision_school(p_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
    v_school_uuid uuid;
    v_schema_name text;
    v_owner_id uuid;
    v_current_schemas text;
BEGIN
    v_owner_id := auth.uid();
    IF v_owner_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    v_school_uuid := gen_random_uuid();
    v_schema_name := 'school_' || replace(v_school_uuid::text, '-', '_');

    EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', v_schema_name);

    PERFORM public.create_school_tables(v_schema_name);
    PERFORM public.create_accounting_tables(v_schema_name);
    PERFORM public.apply_drift(v_schema_name);
    PERFORM public.apply_drift3(v_schema_name);
    PERFORM public.apply_three_levels(v_schema_name);

    INSERT INTO public.schools_registry (id, owner_id, name, schema_name)
    VALUES (v_school_uuid, v_owner_id, p_name, v_schema_name);

    v_current_schemas := coalesce(
        current_setting('pgrst.db_schemas', true), 'public'
    );
    IF position(v_schema_name in v_current_schemas) = 0 THEN
        v_current_schemas := v_current_schemas || ', ' || v_schema_name;
    END IF;
    EXECUTE format(
        'ALTER ROLE authenticator SET pgrst.db_schemas = %L',
        v_current_schemas
    );

    NOTIFY pgrst, 'reload config';

    RETURN jsonb_build_object(
        'school_id', v_school_uuid,
        'schema_name', v_schema_name,
        'name', p_name
    );
END
$func$;

GRANT EXECUTE ON FUNCTION public.provision_school(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_three_levels(text) TO authenticated;
