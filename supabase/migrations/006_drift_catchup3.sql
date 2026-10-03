-- ============================================================
-- E-School: Migration 006 — Drift catch-up 3 (idempotent, replay-safe)
-- Miroir cloud du filet SQLite 177 (zéro colonne manquante) :
--   - professor_payment_counters (pendant de receipt_counters, absent de 004)
--   - school_year là où 002/004 ne l'ajoutent qu'au CREATE (tables
--     pré-existantes sans la colonne : expenses, cash_registers,
--     cash_movements, bank_transactions, fee_items)
--   - ledger public.migration_ledger (pattern 004 §2).
-- Ne touche jamais à 001/002 (règle 003). Ré-exécutable sans erreur.
-- ============================================================

-- ---- 0. Fonction de rattrapage par schema (idempotente) ----
CREATE OR REPLACE FUNCTION public.apply_drift3(p_schema text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $drift3$
BEGIN
    -- Compteur séquences reçus profs PAY-ENS-YYYY-XXXX (pendant receipt_counters).
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.professor_payment_counters (
            year integer PRIMARY KEY,
            last_number integer NOT NULL DEFAULT 0,
            updated_at timestamptz NOT NULL DEFAULT now()
        )', p_schema);

    -- school_year sur tables comptables pré-existantes (CREATE seul en 002).
    EXECUTE format('ALTER TABLE %I.expenses ADD COLUMN IF NOT EXISTS school_year varchar', p_schema);
    EXECUTE format('ALTER TABLE %I.cash_registers ADD COLUMN IF NOT EXISTS school_year varchar', p_schema);
    EXECUTE format('ALTER TABLE %I.cash_movements ADD COLUMN IF NOT EXISTS school_year varchar', p_schema);
    EXECUTE format('ALTER TABLE %I.bank_transactions ADD COLUMN IF NOT EXISTS school_year varchar', p_schema);
    EXECUTE format('ALTER TABLE %I.fee_items ADD COLUMN IF NOT EXISTS school_year varchar', p_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_expenses_school_year ON %I.expenses (school_year)', p_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_cash_movements_school_year ON %I.cash_movements (school_year)', p_schema);

    -- Statuts legacy : colonnes déjà NOT NULL DEFAULT en 002, filet si type
    -- historique divergent (jamais de DROP, jamais de NOT NULL ajouté).
    EXECUTE format('ALTER TABLE %I.expenses ADD COLUMN IF NOT EXISTS status varchar(50) NOT NULL DEFAULT ''pending''', p_schema);
    EXECUTE format('ALTER TABLE %I.cash_registers ADD COLUMN IF NOT EXISTS status varchar(20) NOT NULL DEFAULT ''open''', p_schema);

    EXECUTE format('GRANT ALL ON ALL TABLES IN SCHEMA %I TO service_role, authenticated', p_schema);
END;
$drift3$;

GRANT EXECUTE ON FUNCTION public.apply_drift3(text) TO authenticated;

-- ---- 1. Boucle sur les schemas existants (pattern 004 §2) ----
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN SELECT schema_name FROM public.schools_registry LOOP
        BEGIN
            PERFORM public.apply_drift3(r.schema_name);
            INSERT INTO public.migration_ledger (migration_name, schema_name, status)
            VALUES ('006_drift_catchup3', r.schema_name, 'applied')
            ON CONFLICT (migration_name, schema_name)
            DO UPDATE SET applied_at = now(), status = 'applied', error_message = NULL;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Migration 006: échec pour schema %: %', r.schema_name, SQLERRM;
            BEGIN
                INSERT INTO public.migration_ledger (migration_name, schema_name, status, error_message)
                VALUES ('006_drift_catchup3', r.schema_name, 'failed', SQLERRM)
                ON CONFLICT (migration_name, schema_name)
                DO UPDATE SET applied_at = now(), status = 'failed', error_message = EXCLUDED.error_message;
            EXCEPTION WHEN OTHERS THEN
                RAISE WARNING 'Migration 006: ledger write failed for %: %', r.schema_name, SQLERRM;
            END;
        END;
    END LOOP;
END
$$;

-- ---- 2. Futurs schemas : chaîner drift3 après drift (provision) ----
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
GRANT EXECUTE ON FUNCTION public.apply_drift3(text) TO authenticated;
