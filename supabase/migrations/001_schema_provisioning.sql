-- ============================================================
-- E-School: Schema-per-school multi-tenancy
-- Migration 001 - Public tables + school schema provisioning
-- ============================================================

-- =========================
-- 1. PUBLIC SCHEMA TABLES
-- =========================

CREATE TABLE IF NOT EXISTS public.schools_registry (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name text NOT NULL,
    schema_name text UNIQUE NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.schools_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own schools"
    ON public.schools_registry FOR SELECT
    USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert own schools"
    ON public.schools_registry FOR INSERT
    WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update own schools"
    ON public.schools_registry FOR UPDATE
    USING (auth.uid() = owner_id);

CREATE TABLE IF NOT EXISTS public.sync_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    school_id uuid REFERENCES public.schools_registry(id) ON DELETE SET NULL,
    sync_started_at timestamptz NOT NULL DEFAULT now(),
    sync_ended_at timestamptz,
    direction text NOT NULL CHECK (direction IN ('local_to_cloud', 'cloud_to_local', 'bidirectional')),
    status text NOT NULL CHECK (status IN ('success', 'partial_success', 'failed', 'in_progress', 'skipped')),
    records_synced_up integer DEFAULT 0,
    records_synced_down integer DEFAULT 0,
    tables_processed text[] DEFAULT '{}',
    error_message text,
    conflict_count integer DEFAULT 0
);

ALTER TABLE public.sync_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own sync history"
    ON public.sync_history FOR ALL
    USING (auth.uid() = user_id);

-- =========================
-- 2. SCHOOL SCHEMA TEMPLATE
-- =========================

CREATE OR REPLACE FUNCTION public.create_school_tables(p_schema text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN

-- ---- Niveau 0 : tables sans FK vers d'autres tables du domaine ----

EXECUTE format('
    CREATE TABLE %I.school (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name varchar(255) NOT NULL DEFAULT '''',
        address varchar(255) NOT NULL DEFAULT '''',
        town varchar(255) DEFAULT '''',
        country varchar(3) NOT NULL DEFAULT ''SEN'',
        phone varchar(20) NOT NULL DEFAULT '''',
        email varchar(255) NOT NULL DEFAULT '''',
        type varchar(10) NOT NULL DEFAULT ''publique'',
        foundation_year integer NOT NULL DEFAULT extract(year from now()),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz
    )', p_schema);

EXECUTE format('
    CREATE TABLE %I.school_settings (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id uuid REFERENCES %I.school(id) ON DELETE CASCADE,
        school_code varchar(50) NOT NULL DEFAULT '''',
        inspection_zone varchar(100) NOT NULL DEFAULT '''',
        department_code varchar(50) NOT NULL DEFAULT '''',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz
    )', p_schema, p_schema);

EXECUTE format('
    CREATE TABLE %I.grade (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        code text NOT NULL,
        type varchar(20) NOT NULL DEFAULT ''PRIMARY'',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz
    )', p_schema);

EXECUTE format('
    CREATE TABLE %I.diploma (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name varchar(255) NOT NULL DEFAULT '''',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz
    )', p_schema);

EXECUTE format('
    CREATE TABLE %I.qualification (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name varchar(255) NOT NULL DEFAULT '''',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz
    )', p_schema);

EXECUTE format('
    CREATE TABLE %I.year_repartition (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        school_year text NOT NULL,
        period_configurations jsonb NOT NULL DEFAULT ''[]'',
        is_current boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
    )', p_schema);

EXECUTE format('
    CREATE TABLE %I.payment_config (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        class_id text NOT NULL,
        class_name text,
        annual_amount numeric(10,2) NOT NULL DEFAULT 0,
        inscription_fee numeric(10,2) NOT NULL DEFAULT 0,
        re_inscription_fee numeric(10,2) NOT NULL DEFAULT 0,
        allow_scholarship boolean NOT NULL DEFAULT false,
        scholarship_percentages jsonb,
        scholarship_criteria text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
    )', p_schema);

EXECUTE format('
    CREATE TABLE %I.grading_config (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id_local integer,
        class_id integer,
        subject_id integer,
        final_grade_base real NOT NULL DEFAULT 20,
        calculation_strategy varchar(20) NOT NULL DEFAULT ''WEIGHTED'',
        normalize_scores boolean NOT NULL DEFAULT true,
        description text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (school_id_local, class_id, subject_id)
    )', p_schema);

EXECUTE format('
    CREATE TABLE %I.document_content (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        inscription text,
        scolarite text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
    )', p_schema);

-- ---- Niveau 1 : FK vers niveau 0 ----

EXECUTE format('
    CREATE TABLE %I.branch (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text,
        code text,
        grade_id uuid REFERENCES %I.grade(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz
    )', p_schema, p_schema);

EXECUTE format('
    CREATE TABLE %I.course (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        code text,
        name text,
        coefficient numeric,
        is_in_groupement boolean NOT NULL DEFAULT false,
        groupement_id uuid,
        grade_id uuid REFERENCES %I.grade(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz,
        CONSTRAINT fk_course_groupement FOREIGN KEY (groupement_id) REFERENCES %I.course(id) ON DELETE CASCADE
    )', p_schema, p_schema, p_schema);

EXECUTE format('
    CREATE TABLE %I.course_grades (
        course_id uuid NOT NULL REFERENCES %I.course(id) ON DELETE CASCADE,
        grade_id uuid NOT NULL REFERENCES %I.grade(id) ON DELETE CASCADE,
        PRIMARY KEY (course_id, grade_id)
    )', p_schema, p_schema, p_schema);

EXECUTE format('
    CREATE TABLE %I.professor (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        firstname text NOT NULL,
        lastname text NOT NULL,
        matricule text UNIQUE,
        civility text NOT NULL,
        nbr_child integer,
        family_situation text NOT NULL,
        birth_date timestamptz,
        birth_town text NOT NULL,
        address text NOT NULL,
        town text NOT NULL,
        cni_number text NOT NULL,
        diploma_id uuid REFERENCES %I.diploma(id) ON DELETE SET NULL,
        qualification_id uuid REFERENCES %I.qualification(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz
    )', p_schema, p_schema, p_schema);

EXECUTE format('
    CREATE TABLE %I.student (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        firstname text NOT NULL,
        lastname text NOT NULL,
        matricule text NOT NULL UNIQUE,
        father_firstname text NOT NULL,
        father_lastname text NOT NULL,
        mother_firstname text NOT NULL,
        mother_lastname text NOT NULL,
        birth_day date NOT NULL,
        birth_place text NOT NULL,
        address text NOT NULL,
        familly_phone text NOT NULL,
        personal_phone text NOT NULL,
        sex text,
        school_year text,
        is_new boolean NOT NULL DEFAULT true,
        grade_id uuid NOT NULL REFERENCES %I.grade(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz,
        UNIQUE (firstname, lastname, birth_day)
    )', p_schema, p_schema);

EXECUTE format('
    CREATE TABLE %I.inscription_fee (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        inscription_fee_amount numeric(10,2),
        grade_id uuid UNIQUE REFERENCES %I.grade(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
    )', p_schema, p_schema);

EXECUTE format('
    CREATE TABLE %I.payment_annual_config (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tranche_count numeric,
        grade_id uuid UNIQUE REFERENCES %I.grade(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
    )', p_schema, p_schema);

EXECUTE format('
    CREATE TABLE %I.grade_config (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        number_of_assignments integer NOT NULL DEFAULT 2,
        assignment_weight real NOT NULL DEFAULT 0.4,
        exam_weight real NOT NULL DEFAULT 0.6,
        formula text,
        grade_id uuid UNIQUE REFERENCES %I.grade(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
    )', p_schema, p_schema);

EXECUTE format('
    CREATE TABLE %I.evaluation_category (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name varchar(100) NOT NULL,
        code varchar(10),
        weight real NOT NULL DEFAULT 1,
        default_max_score real NOT NULL DEFAULT 20,
        min_entries integer,
        max_entries integer,
        color varchar(7) NOT NULL DEFAULT ''#3498db'',
        display_order integer NOT NULL DEFAULT 0,
        is_exam boolean NOT NULL DEFAULT false,
        config_id uuid NOT NULL REFERENCES %I.grading_config(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
    )', p_schema, p_schema);

-- ---- Niveau 2 : FK vers niveau 1 ----

EXECUTE format('
    CREATE TABLE %I.class_room (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text,
        code text,
        capacity numeric,
        grade_id uuid REFERENCES %I.grade(id) ON DELETE CASCADE,
        branch_id uuid UNIQUE REFERENCES %I.branch(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz
    )', p_schema, p_schema, p_schema);

EXECUTE format('
    CREATE TABLE %I.file (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        path text NOT NULL,
        type text NOT NULL,
        student_id uuid REFERENCES %I.student(id) ON DELETE CASCADE,
        professor_id uuid REFERENCES %I.professor(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz
    )', p_schema, p_schema, p_schema);

EXECUTE format('
    CREATE TABLE %I.observation (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        observation text,
        note numeric,
        course_id uuid REFERENCES %I.course(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz
    )', p_schema, p_schema);

EXECUTE format('
    CREATE TABLE %I.teaching_assignment (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        professor_id uuid NOT NULL REFERENCES %I.professor(id) ON DELETE CASCADE,
        course_id uuid REFERENCES %I.course(id) ON DELETE SET NULL,
        class_id uuid REFERENCES %I.grade(id) ON DELETE SET NULL,
        teaching_type varchar NOT NULL,
        school_type varchar NOT NULL,
        grade_ids jsonb,
        grade_names varchar,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz
    )', p_schema, p_schema, p_schema, p_schema);

EXECUTE format('
    CREATE TABLE %I.teaching_grades (
        teaching_id uuid NOT NULL REFERENCES %I.teaching_assignment(id) ON DELETE CASCADE,
        grade_id uuid NOT NULL REFERENCES %I.grade(id) ON DELETE CASCADE,
        PRIMARY KEY (teaching_id, grade_id)
    )', p_schema, p_schema, p_schema);

EXECUTE format('
    CREATE TABLE %I.vacation (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        start_date date NOT NULL,
        end_date date NOT NULL,
        reason text NOT NULL,
        status varchar NOT NULL,
        comment text,
        professor_id uuid REFERENCES %I.professor(id) ON DELETE CASCADE,
        student_id uuid REFERENCES %I.student(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz
    )', p_schema, p_schema, p_schema);

EXECUTE format('
    CREATE TABLE %I.scholarship (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id uuid NOT NULL REFERENCES %I.student(id) ON DELETE CASCADE,
        config_id uuid REFERENCES %I.payment_config(id) ON DELETE SET NULL,
        percentage real NOT NULL,
        is_active boolean NOT NULL DEFAULT true,
        school_year varchar NOT NULL,
        reason varchar,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz
    )', p_schema, p_schema, p_schema);

EXECUTE format('
    CREATE TABLE %I.payment (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id uuid NOT NULL REFERENCES %I.student(id) ON DELETE CASCADE,
        scholarship_id uuid REFERENCES %I.scholarship(id) ON DELETE SET NULL,
        amount numeric(10,2) NOT NULL,
        payment_type varchar NOT NULL,
        payment_method varchar NOT NULL DEFAULT ''cash'',
        installment_number integer NOT NULL DEFAULT 1,
        school_year varchar NOT NULL,
        comment varchar,
        base_amount real,
        scholarship_amount real,
        adjusted_amount real,
        scholarship_percentage real,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz
    )', p_schema, p_schema, p_schema);

EXECUTE format('
    CREATE TABLE %I.professor_payment (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        professor_id uuid NOT NULL REFERENCES %I.professor(id) ON DELETE CASCADE,
        amount numeric(10,2) NOT NULL,
        type varchar NOT NULL,
        payment_method varchar NOT NULL DEFAULT ''cash'',
        month varchar NOT NULL,
        reference varchar,
        comment varchar,
        is_paid boolean NOT NULL DEFAULT false,
        gross_amount numeric(10,2) NOT NULL DEFAULT 0,
        net_amount numeric(10,2) NOT NULL DEFAULT 0,
        deductions jsonb,
        additions jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz
    )', p_schema, p_schema);

EXECUTE format('
    CREATE TABLE %I.absence (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        date date NOT NULL,
        reason text NOT NULL,
        reason_type varchar NOT NULL,
        absence_type varchar NOT NULL,
        justified boolean NOT NULL DEFAULT false,
        start_time time,
        end_time time,
        comments text,
        parent_notified boolean NOT NULL DEFAULT false,
        type varchar NOT NULL DEFAULT ''STUDENT'',
        student_id uuid REFERENCES %I.student(id) ON DELETE CASCADE,
        professor_id uuid REFERENCES %I.professor(id) ON DELETE CASCADE,
        grade_id uuid NOT NULL REFERENCES %I.grade(id) ON DELETE CASCADE,
        course_id uuid REFERENCES %I.course(id) ON DELETE SET NULL,
        document_id uuid REFERENCES %I.file(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz
    )', p_schema, p_schema, p_schema, p_schema, p_schema, p_schema);

EXECUTE format('
    CREATE TABLE %I.homework (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        description text NOT NULL,
        due_date date NOT NULL,
        is_completed boolean NOT NULL DEFAULT false,
        course_id uuid REFERENCES %I.course(id) ON DELETE CASCADE,
        grade_id uuid REFERENCES %I.grade(id) ON DELETE CASCADE,
        professor_id uuid REFERENCES %I.professor(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
    )', p_schema, p_schema, p_schema, p_schema);

EXECUTE format('
    CREATE TABLE %I.schedule (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        professor_id uuid NOT NULL REFERENCES %I.professor(id) ON DELETE CASCADE,
        course_id uuid REFERENCES %I.course(id) ON DELETE CASCADE,
        class_id uuid NOT NULL REFERENCES %I.grade(id) ON DELETE CASCADE,
        day varchar(20) NOT NULL,
        time_slot varchar(20) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (class_id, day, time_slot)
    )', p_schema, p_schema, p_schema, p_schema);

EXECUTE format('
    CREATE INDEX ON %I.schedule (professor_id, day, time_slot)
', p_schema);

EXECUTE format('
    CREATE TABLE %I.grade_entry (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id uuid NOT NULL REFERENCES %I.student(id) ON DELETE CASCADE,
        course_id uuid NOT NULL REFERENCES %I.course(id) ON DELETE CASCADE,
        category_id integer NOT NULL,
        period varchar(100) NOT NULL,
        score real NOT NULL,
        max_score real NOT NULL,
        label varchar(200),
        evaluation_date date,
        comment text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
    )', p_schema, p_schema, p_schema);

EXECUTE format('
    CREATE INDEX ON %I.grade_entry (student_id, course_id, period, category_id)
', p_schema);

EXECUTE format('
    CREATE TABLE %I.calculated_grade (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id uuid NOT NULL REFERENCES %I.student(id) ON DELETE CASCADE,
        course_id uuid NOT NULL REFERENCES %I.course(id) ON DELETE CASCADE,
        period varchar(100) NOT NULL,
        final_average real NOT NULL,
        config_id integer NOT NULL,
        category_breakdown jsonb,
        appreciation text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (student_id, course_id, period)
    )', p_schema, p_schema, p_schema);

EXECUTE format('
    CREATE TABLE %I.tranch_config (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tranch_name varchar,
        amount numeric(10,2) NOT NULL DEFAULT 0,
        tranch_month_count integer,
        payment_annual_config_id uuid REFERENCES %I.payment_annual_config(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
    )', p_schema, p_schema);

EXECUTE format('
    CREATE TABLE %I.mensuality_tranch (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        start_date date,
        end_date date,
        tranch_config_id uuid REFERENCES %I.tranch_config(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
    )', p_schema, p_schema);

-- Grant permissions to Supabase roles
EXECUTE format('GRANT USAGE ON SCHEMA %I TO service_role, authenticated, anon', p_schema);
EXECUTE format('GRANT ALL ON ALL TABLES IN SCHEMA %I TO service_role, authenticated', p_schema);
EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT ALL ON TABLES TO service_role, authenticated', p_schema);

END;
$$;

-- =========================
-- 3. PROVISIONING RPC
-- =========================

CREATE OR REPLACE FUNCTION public.provision_school(p_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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

    INSERT INTO public.schools_registry (id, owner_id, name, schema_name)
    VALUES (v_school_uuid, v_owner_id, p_name, v_schema_name);

    -- Expose the new schema to PostgREST by adding it to db_schemas
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
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.provision_school(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_school_tables(text) TO authenticated;

-- =========================
-- 4. HELPER: get user's schools
-- =========================

CREATE OR REPLACE FUNCTION public.get_my_schools()
RETURNS SETOF public.schools_registry
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT * FROM public.schools_registry WHERE owner_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_my_schools() TO authenticated;

-- =========================
-- 5. HELPER: delete school schema
-- =========================

CREATE OR REPLACE FUNCTION public.delete_school(p_school_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_schema_name text;
    v_owner_id uuid;
BEGIN
    SELECT schema_name, owner_id INTO v_schema_name, v_owner_id
    FROM public.schools_registry WHERE id = p_school_id;

    IF v_schema_name IS NULL THEN
        RAISE EXCEPTION 'School not found';
    END IF;

    IF v_owner_id != auth.uid() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    EXECUTE format('DROP SCHEMA IF EXISTS %I CASCADE', v_schema_name);

    DELETE FROM public.schools_registry WHERE id = p_school_id;

    -- Remove schema from PostgREST db_schemas
    DECLARE
        v_current_schemas text;
        v_new_schemas text;
    BEGIN
        v_current_schemas := coalesce(
            current_setting('pgrst.db_schemas', true), 'public'
        );
        SELECT string_agg(trim(s), ', ')
        INTO v_new_schemas
        FROM unnest(string_to_array(v_current_schemas, ',')) AS s
        WHERE trim(s) != v_schema_name;

        EXECUTE format(
            'ALTER ROLE authenticator SET pgrst.db_schemas = %L',
            coalesce(v_new_schemas, 'public')
        );
    END;

    NOTIFY pgrst, 'reload config';

    RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_school(uuid) TO authenticated;
