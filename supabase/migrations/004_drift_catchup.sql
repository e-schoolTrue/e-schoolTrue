-- ============================================================
-- E-School: Migration 004 — Drift catch-up (idempotent)
-- Fonction public.apply_drift(p_schema) bouclée sur schools_registry
-- avec EXCEPTION WHEN OTHERS -> WARNING (pattern 002).
-- Couvre la dérive frontend/backend vs 001+002 :
--   schedule_configs, professor.color/hourly_rate/payment_mode,
--   payment.receipt_number/idempotency_key/currency,
--   professor_payment(hours_total/hourly_rate/salary_slip_id/currency/idempotency_key),
--   cash_movements + receipt_counters (créés si absents),
--   élargissement monétaire numeric(14,2) USING,
--   UNIQUE partiels WHERE NOT NULL,
--   ledger public.migration_ledger.
-- Ré-exécutable sans erreur (replay-safe).
-- ============================================================

-- =========================
-- 0. LEDGER global des migrations par schema
-- =========================

CREATE TABLE IF NOT EXISTS public.migration_ledger (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    migration_name text NOT NULL,
    schema_name text NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now(),
    status text NOT NULL DEFAULT 'applied' CHECK (status IN ('applied', 'failed', 'skipped')),
    error_message text,
    UNIQUE (migration_name, schema_name)
);

ALTER TABLE public.migration_ledger ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'migration_ledger'
          AND policyname = 'Service role full access migration_ledger'
    ) THEN
        CREATE POLICY "Service role full access migration_ledger"
            ON public.migration_ledger FOR ALL
            TO service_role
            USING (true) WITH CHECK (true);
    END IF;
END
$$;

-- =========================
-- 1. FONCTION DE RATTRAPAGE
-- =========================

CREATE OR REPLACE FUNCTION public.apply_drift(p_schema text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $drift$
BEGIN
    -- ---- 1a. schedule_configs (PaymentScheduleConfig TS) ----
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.schedule_configs (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            grade_id uuid REFERENCES %I.grade(id) ON DELETE CASCADE,
            payment_mode varchar(20) NOT NULL DEFAULT ''monthly'' CHECK (payment_mode IN (''monthly'', ''installments'', ''custom'')),
            schedules jsonb NOT NULL DEFAULT ''[]'',
            total_amount numeric(14,2) NOT NULL DEFAULT 0,
            is_active boolean NOT NULL DEFAULT true,
            school_year varchar,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
            deleted_at timestamptz
        )', p_schema, p_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_schedule_configs_grade ON %I.schedule_configs (grade_id)', p_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_schedule_configs_school_year ON %I.schedule_configs (school_year)', p_schema);

    -- ---- 1b. professor : color / hourly_rate / payment_mode ----
    -- color utilisé par PlanningConfigView / StudentPlanningView / NewProfView (#409EFF défaut).
    EXECUTE format('ALTER TABLE %I.professor ADD COLUMN IF NOT EXISTS color varchar(7) NOT NULL DEFAULT ''#409EFF''', p_schema);
    EXECUTE format('ALTER TABLE %I.professor ADD COLUMN IF NOT EXISTS hourly_rate numeric(12,0) NOT NULL DEFAULT 0', p_schema);
    EXECUTE format('ALTER TABLE %I.professor ADD COLUMN IF NOT EXISTS payment_mode varchar(20) NOT NULL DEFAULT ''monthly''', p_schema);

    -- ---- 1c. payment : receipt_number / idempotency_key / currency ----
    EXECUTE format('ALTER TABLE %I.payment ADD COLUMN IF NOT EXISTS receipt_number varchar(20)', p_schema);
    EXECUTE format('ALTER TABLE %I.payment ADD COLUMN IF NOT EXISTS idempotency_key varchar(64)', p_schema);
    EXECUTE format('ALTER TABLE %I.payment ADD COLUMN IF NOT EXISTS currency varchar(10) NOT NULL DEFAULT ''GNF''', p_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_payment_created_at ON %I.payment (created_at)', p_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_payment_school_year ON %I.payment (school_year)', p_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_payment_student_id ON %I.payment (student_id)', p_schema);
    -- Contrainte historique 002 (UNIQUE totale, NULLs multiples autorisés) conservée si présente ;
    -- on ajoute des UNIQUE partiels WHERE NOT NULL (re-réparables, sans bloquer les NULLs).
    EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_receipt_number_not_null ON %I.payment (receipt_number) WHERE receipt_number IS NOT NULL', p_schema);
    EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_idempotency_not_null ON %I.payment (idempotency_key) WHERE idempotency_key IS NOT NULL', p_schema);

    -- ---- 1d. professor_payment : heures / taux / bulletin / idempotence / devise ----
    EXECUTE format('ALTER TABLE %I.professor_payment ADD COLUMN IF NOT EXISTS hours_total numeric(7,2) NOT NULL DEFAULT 0', p_schema);
    EXECUTE format('ALTER TABLE %I.professor_payment ADD COLUMN IF NOT EXISTS hourly_rate numeric(12,0) NOT NULL DEFAULT 0', p_schema);
    EXECUTE format('ALTER TABLE %I.professor_payment ADD COLUMN IF NOT EXISTS salary_slip_id uuid', p_schema);
    EXECUTE format('ALTER TABLE %I.professor_payment ADD COLUMN IF NOT EXISTS currency varchar(10) NOT NULL DEFAULT ''GNF''', p_schema);
    EXECUTE format('ALTER TABLE %I.professor_payment ADD COLUMN IF NOT EXISTS idempotency_key varchar(64)', p_schema);
    EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS uq_prof_pay_idempotency_not_null ON %I.professor_payment (idempotency_key) WHERE idempotency_key IS NOT NULL', p_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_prof_pay_month ON %I.professor_payment (month)', p_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_prof_pay_prof_month ON %I.professor_payment (professor_id, month)', p_schema);

    -- ---- 1e. cash_movements / receipt_counters (schemas pré-002) ----
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.cash_registers (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            name varchar(100) NOT NULL,
            register_date date NOT NULL,
            opening_balance numeric(12,0) NOT NULL DEFAULT 0,
            closing_balance numeric(12,0) NOT NULL DEFAULT 0,
            status varchar(20) NOT NULL DEFAULT ''open'',
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
            deleted_at timestamptz,
            UNIQUE (name, register_date)
        )', p_schema);
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.cash_movements (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            register_id uuid REFERENCES %I.cash_registers(id) ON DELETE CASCADE,
            direction varchar(10) NOT NULL CHECK (direction IN (''IN'', ''OUT'')),
            amount numeric(12,0) NOT NULL,
            motive varchar(255),
            reference varchar(20),
            payment_id uuid,
            expense_id uuid,
            movement_date date,
            school_year varchar,
            created_at timestamptz NOT NULL DEFAULT now()
        )', p_schema, p_schema);
    EXECUTE format('ALTER TABLE %I.cash_movements ADD COLUMN IF NOT EXISTS idempotency_key varchar(64)', p_schema);
    EXECUTE format('ALTER TABLE %I.cash_movements ADD COLUMN IF NOT EXISTS currency varchar(10) NOT NULL DEFAULT ''GNF''', p_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_cash_movements_created_at ON %I.cash_movements (created_at)', p_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_cash_movements_school_year ON %I.cash_movements (school_year)', p_schema);
    EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS uq_cash_mov_idempotency_not_null ON %I.cash_movements (idempotency_key) WHERE idempotency_key IS NOT NULL', p_schema);

    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.receipt_counters (
            year integer PRIMARY KEY,
            last_number integer NOT NULL DEFAULT 0,
            updated_at timestamptz NOT NULL DEFAULT now()
        )', p_schema);

    -- ---- 1f. Élargissement monétaire numeric(14,2) USING ----
    -- Idempotent : re-appliquer le même TYPE est un no-op.
    EXECUTE format('ALTER TABLE %I.payment ALTER COLUMN amount TYPE numeric(14,2) USING amount::numeric(14,2)', p_schema);
    EXECUTE format('ALTER TABLE %I.professor_payment ALTER COLUMN amount TYPE numeric(14,2) USING amount::numeric(14,2)', p_schema);
    EXECUTE format('ALTER TABLE %I.professor_payment ALTER COLUMN gross_amount TYPE numeric(14,2) USING gross_amount::numeric(14,2)', p_schema);
    EXECUTE format('ALTER TABLE %I.professor_payment ALTER COLUMN net_amount TYPE numeric(14,2) USING net_amount::numeric(14,2)', p_schema);
    EXECUTE format('ALTER TABLE %I.professor_payment ALTER COLUMN hourly_rate TYPE numeric(14,2) USING hourly_rate::numeric(14,2)', p_schema);
    EXECUTE format('ALTER TABLE %I.payment_config ALTER COLUMN annual_amount TYPE numeric(14,2) USING annual_amount::numeric(14,2)', p_schema);
    EXECUTE format('ALTER TABLE %I.payment_config ALTER COLUMN inscription_fee TYPE numeric(14,2) USING inscription_fee::numeric(14,2)', p_schema);
    EXECUTE format('ALTER TABLE %I.payment_config ALTER COLUMN re_inscription_fee TYPE numeric(14,2) USING re_inscription_fee::numeric(14,2)', p_schema);
    EXECUTE format('ALTER TABLE %I.inscription_fee ALTER COLUMN inscription_fee_amount TYPE numeric(14,2) USING inscription_fee_amount::numeric(14,2)', p_schema);
    EXECUTE format('ALTER TABLE %I.tranch_config ALTER COLUMN amount TYPE numeric(14,2) USING amount::numeric(14,2)', p_schema);
    EXECUTE format('ALTER TABLE %I.schedule_configs ALTER COLUMN total_amount TYPE numeric(14,2) USING total_amount::numeric(14,2)', p_schema);
    EXECUTE format('ALTER TABLE %I.professor ALTER COLUMN hourly_rate TYPE numeric(14,2) USING hourly_rate::numeric(14,2)', p_schema);
    EXECUTE format('ALTER TABLE %I.expenses ALTER COLUMN amount TYPE numeric(14,2) USING amount::numeric(14,2)', p_schema);
    EXECUTE format('ALTER TABLE %I.cash_registers ALTER COLUMN opening_balance TYPE numeric(14,2) USING opening_balance::numeric(14,2)', p_schema);
    EXECUTE format('ALTER TABLE %I.cash_registers ALTER COLUMN closing_balance TYPE numeric(14,2) USING closing_balance::numeric(14,2)', p_schema);
    EXECUTE format('ALTER TABLE %I.cash_movements ALTER COLUMN amount TYPE numeric(14,2) USING amount::numeric(14,2)', p_schema);
    EXECUTE format('ALTER TABLE %I.cash_closures ALTER COLUMN expected_amount TYPE numeric(14,2) USING expected_amount::numeric(14,2)', p_schema);
    EXECUTE format('ALTER TABLE %I.cash_closures ALTER COLUMN counted_amount TYPE numeric(14,2) USING counted_amount::numeric(14,2)', p_schema);
    EXECUTE format('ALTER TABLE %I.cash_closures ALTER COLUMN gap TYPE numeric(14,2) USING gap::numeric(14,2)', p_schema);
    EXECUTE format('ALTER TABLE %I.bank_accounts ALTER COLUMN balance TYPE numeric(14,2) USING balance::numeric(14,2)', p_schema);
    EXECUTE format('ALTER TABLE %I.bank_transactions ALTER COLUMN amount TYPE numeric(14,2) USING amount::numeric(14,2)', p_schema);
    EXECUTE format('ALTER TABLE %I.teacher_hour_logs ALTER COLUMN hourly_rate TYPE numeric(14,2) USING hourly_rate::numeric(14,2)', p_schema);
    EXECUTE format('ALTER TABLE %I.salary_slips ALTER COLUMN hourly_rate TYPE numeric(14,2) USING hourly_rate::numeric(14,2)', p_schema);
    EXECUTE format('ALTER TABLE %I.salary_slips ALTER COLUMN gross_amount TYPE numeric(14,2) USING gross_amount::numeric(14,2)', p_schema);
    EXECUTE format('ALTER TABLE %I.salary_slips ALTER COLUMN net_amount TYPE numeric(14,2) USING net_amount::numeric(14,2)', p_schema);
    EXECUTE format('ALTER TABLE %I.fee_items ALTER COLUMN amount TYPE numeric(14,2) USING amount::numeric(14,2)', p_schema);

    -- ---- 1g. Grants + append-only cash_movements (pattern 002) ----
    EXECUTE format('GRANT USAGE ON SCHEMA %I TO service_role, authenticated, anon', p_schema);
    EXECUTE format('GRANT ALL ON ALL TABLES IN SCHEMA %I TO service_role, authenticated', p_schema);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT ALL ON TABLES TO service_role, authenticated', p_schema);
    EXECUTE format('REVOKE UPDATE, DELETE ON %I.cash_movements FROM authenticated, anon', p_schema);
    EXECUTE format('GRANT SELECT, INSERT ON %I.cash_movements TO authenticated', p_schema);
END;
$drift$;

GRANT EXECUTE ON FUNCTION public.apply_drift(text) TO authenticated;

-- =========================
-- 2. BOUCLE SUR LES SCHEMAS EXISTANTS (pattern 002)
-- =========================

DO $$
DECLARE
    r record;
BEGIN
    FOR r IN SELECT schema_name FROM public.schools_registry LOOP
        BEGIN
            PERFORM public.apply_drift(r.schema_name);
            INSERT INTO public.migration_ledger (migration_name, schema_name, status)
            VALUES ('004_drift_catchup', r.schema_name, 'applied')
            ON CONFLICT (migration_name, schema_name)
            DO UPDATE SET applied_at = now(), status = 'applied', error_message = NULL;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Migration 004: échec pour schema %: %', r.schema_name, SQLERRM;
            BEGIN
                INSERT INTO public.migration_ledger (migration_name, schema_name, status, error_message)
                VALUES ('004_drift_catchup', r.schema_name, 'failed', SQLERRM)
                ON CONFLICT (migration_name, schema_name)
                DO UPDATE SET applied_at = now(), status = 'failed', error_message = EXCLUDED.error_message;
            EXCEPTION WHEN OTHERS THEN
                RAISE WARNING 'Migration 004: ledger write failed for %: %', r.schema_name, SQLERRM;
            END;
        END;
    END LOOP;
END
$$;

-- =========================
-- 3. FUTURS SCHEMAS : provision_school chaine 001(idempotent) + 002 + drift
-- =========================

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
END;
$func$;

GRANT EXECUTE ON FUNCTION public.provision_school(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_drift(text) TO authenticated;
