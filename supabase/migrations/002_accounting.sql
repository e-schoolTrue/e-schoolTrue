-- ============================================================
-- E-School: Migration 002 — Module comptabilité (GNF decimal 12,0)
-- Expense, CashRegister (Unique date+registre), CashMovement append-only,
-- CashClosure, BankAccount, BankTransaction, TeacherHourLog (Index prof+month),
-- SalarySlip (Unique prof+month), ReceiptCounter (year PK), FeeItem
-- + colonnes Payment.receiptNumber, Professor.hourlyRate/paymentMode,
--   ProfessorPayment.hoursTotal/hourlyRate/salarySlipId
-- + index created_at, school_year, student_id
-- ============================================================

-- Fonction template : crée les tables comptables dans un schema d'école.
CREATE OR REPLACE FUNCTION public.create_accounting_tables(p_schema text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.expenses (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            label varchar(255) NOT NULL,
            category varchar(100),
            amount numeric(12,0) NOT NULL DEFAULT 0,
            expense_date date,
            payment_method varchar(50) NOT NULL DEFAULT ''cash'',
            status varchar(50) NOT NULL DEFAULT ''pending'',
            receipt_number varchar(20),
            student_id varchar,
            school_year varchar,
            comment varchar,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
            deleted_at timestamptz
        )', p_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON %I.expenses (created_at)', p_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_expenses_school_year ON %I.expenses (school_year)', p_schema);

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
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_cash_movements_created_at ON %I.cash_movements (created_at)', p_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_cash_movements_school_year ON %I.cash_movements (school_year)', p_schema);
    -- Append-only : aucun UPDATE/DELETE accordé aux rôles applicatifs (révoqué si existant).
    EXECUTE format('REVOKE UPDATE, DELETE ON %I.cash_movements FROM authenticated, anon', p_schema);

    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.cash_closures (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            register_id uuid NOT NULL REFERENCES %I.cash_registers(id) ON DELETE CASCADE,
            closure_date date NOT NULL,
            expected_amount numeric(12,0) NOT NULL DEFAULT 0,
            counted_amount numeric(12,0) NOT NULL DEFAULT 0,
            gap numeric(12,0) NOT NULL DEFAULT 0,
            validated_by varchar(100),
            comment varchar,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
        )', p_schema, p_schema);

    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.bank_accounts (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            bank_name varchar(150) NOT NULL,
            account_number varchar(64) NOT NULL UNIQUE,
            iban varchar(64),
            balance numeric(12,0) NOT NULL DEFAULT 0,
            currency varchar(10) NOT NULL DEFAULT ''GNF'',
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
            deleted_at timestamptz
        )', p_schema);

    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.bank_transactions (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            account_id uuid NOT NULL REFERENCES %I.bank_accounts(id) ON DELETE CASCADE,
            direction varchar(10) NOT NULL CHECK (direction IN (''IN'', ''OUT'')),
            amount numeric(12,0) NOT NULL,
            transaction_date date,
            reference varchar(64),
            label varchar(255),
            school_year varchar,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
            deleted_at timestamptz
        )', p_schema, p_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_bank_tx_created_at ON %I.bank_transactions (created_at)', p_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_bank_tx_school_year ON %I.bank_transactions (school_year)', p_schema);

    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.teacher_hour_logs (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            professor_id uuid NOT NULL REFERENCES %I.professor(id) ON DELETE CASCADE,
            month varchar(7) NOT NULL,
            hours numeric(7,2) NOT NULL DEFAULT 0,
            hourly_rate numeric(12,0) NOT NULL DEFAULT 0,
            subject varchar(100),
            class_id uuid,
            validated boolean NOT NULL DEFAULT false,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
            deleted_at timestamptz
        )', p_schema, p_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_hourlog_prof_month ON %I.teacher_hour_logs (professor_id, month)', p_schema);

    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.salary_slips (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            professor_id uuid NOT NULL REFERENCES %I.professor(id) ON DELETE CASCADE,
            month varchar(7) NOT NULL,
            hours_total numeric(7,2) NOT NULL DEFAULT 0,
            hourly_rate numeric(12,0) NOT NULL DEFAULT 0,
            gross_amount numeric(12,0) NOT NULL DEFAULT 0,
            net_amount numeric(12,0) NOT NULL DEFAULT 0,
            deductions jsonb,
            additions jsonb,
            status varchar(20) NOT NULL DEFAULT ''pending'',
            payment_id uuid,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
            deleted_at timestamptz,
            UNIQUE (professor_id, month)
        )', p_schema, p_schema);

    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.receipt_counters (
            year integer PRIMARY KEY,
            last_number integer NOT NULL DEFAULT 0,
            updated_at timestamptz NOT NULL DEFAULT now()
        )', p_schema);

    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.fee_items (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            name varchar(150) NOT NULL,
            category varchar(100),
            amount numeric(12,0) NOT NULL DEFAULT 0,
            grade_id uuid REFERENCES %I.grade(id) ON DELETE SET NULL,
            school_year varchar,
            is_active boolean NOT NULL DEFAULT true,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
            deleted_at timestamptz
        )', p_schema, p_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_fee_items_school_year ON %I.fee_items (school_year)', p_schema);

    -- Colonnes additionnelles sur tables existantes (idempotent).
    EXECUTE format('ALTER TABLE %I.payment ADD COLUMN IF NOT EXISTS receipt_number varchar(20)', p_schema);
    EXECUTE format('DO $d$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = ''uq_payment_receipt_number'') THEN
            ALTER TABLE %I.payment ADD CONSTRAINT uq_payment_receipt_number UNIQUE (receipt_number);
        END IF;
    END $d$;', p_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_payment_created_at ON %I.payment (created_at)', p_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_payment_school_year ON %I.payment (school_year)', p_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_payment_student_id ON %I.payment (student_id)', p_schema);

    EXECUTE format('ALTER TABLE %I.professor ADD COLUMN IF NOT EXISTS hourly_rate numeric(12,0) NOT NULL DEFAULT 0', p_schema);
    EXECUTE format('ALTER TABLE %I.professor ADD COLUMN IF NOT EXISTS payment_mode varchar(20) NOT NULL DEFAULT ''monthly''', p_schema);

    EXECUTE format('ALTER TABLE %I.professor_payment ADD COLUMN IF NOT EXISTS hours_total numeric(7,2) NOT NULL DEFAULT 0', p_schema);
    EXECUTE format('ALTER TABLE %I.professor_payment ADD COLUMN IF NOT EXISTS hourly_rate numeric(12,0) NOT NULL DEFAULT 0', p_schema);
    EXECUTE format('ALTER TABLE %I.professor_payment ADD COLUMN IF NOT EXISTS salary_slip_id uuid', p_schema);

    EXECUTE format('GRANT USAGE ON SCHEMA %I TO service_role, authenticated, anon', p_schema);
    EXECUTE format('GRANT ALL ON ALL TABLES IN SCHEMA %I TO service_role, authenticated', p_schema);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT ALL ON TABLES TO service_role, authenticated', p_schema);
    -- Ré-applique append-only après le GRANT global.
    EXECUTE format('REVOKE UPDATE, DELETE ON %I.cash_movements FROM authenticated, anon', p_schema);
    EXECUTE format('GRANT SELECT, INSERT ON %I.cash_movements TO authenticated', p_schema);
END;
$$;

-- Applique à tous les schemas d'école existants.
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN SELECT schema_name FROM public.schools_registry LOOP
        BEGIN
            PERFORM public.create_accounting_tables(r.schema_name);
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Migration 002: échec pour schema %: %', r.schema_name, SQLERRM;
        END;
    END LOOP;
END
$$;

-- Les futurs schemas provisionnés incluent la comptabilité.
CREATE OR REPLACE FUNCTION public.provision_school(p_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
    v_school_uuid uuid;
    v_schema_name text;
    v_owner_id uuid;
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

    INSERT INTO public.schools_registry (id, owner_id, name, schema_name)
    VALUES (v_school_uuid, v_owner_id, p_name, v_schema_name);

    DECLARE
        v_current_schemas text;
    BEGIN
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
    END;

    NOTIFY pgrst, 'reload config';

    RETURN jsonb_build_object(
        'school_id', v_school_uuid,
        'schema_name', v_schema_name,
        'name', p_name
    );
END;
$func$;

GRANT EXECUTE ON FUNCTION public.provision_school(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_accounting_tables(text) TO authenticated;
