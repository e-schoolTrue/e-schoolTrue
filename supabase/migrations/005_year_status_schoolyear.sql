-- 005_year_status_schoolyear.sql — plan V3 (idempotent).
-- year_repartition : status active/closed + closed_at ; configs : school_year ; grade : order/next.

alter table if exists public.year_repartition
  add column if not exists status text not null default 'active',
  add column if not exists closed_at timestamptz null;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'year_repartition_status_chk') then
    alter table public.year_repartition add constraint year_repartition_status_chk check (status in ('active','closed'));
  end if;
end $$;
update public.year_repartition set status = 'active' where status is null or status not in ('active','closed');

alter table if exists public.grade
  add column if not exists "order" integer null,
  add column if not exists next_grade_id integer null;

alter table if exists public.payment_config add column if not exists school_year text null;
alter table if exists public.payment_annual_config add column if not exists school_year text null;
alter table if exists public.grading_config add column if not exists school_year text null;

create index if not exists idx_payment_config_school_year on public.payment_config (school_year);
create index if not exists idx_payment_annual_config_school_year on public.payment_annual_config (school_year);
create index if not exists idx_grading_config_school_year on public.grading_config (school_year);

-- Normalisation civile "2026" -> scolaire (mois courant >= 9 => N-N+1 sinon N-1-N).
do $$ declare m int := extract(month from now()); begin
  update public.year_repartition set school_year =
    case when m >= 9 then school_year || '-' || (school_year::int + 1)::text
         else (school_year::int - 1)::text || '-' || school_year end
    where school_year ~ '^[0-9]{4}$';
  update public.payment_config set school_year =
    case when m >= 9 then school_year || '-' || (school_year::int + 1)::text
         else (school_year::int - 1)::text || '-' || school_year end
    where school_year ~ '^[0-9]{4}$';
  update public.payment_annual_config set school_year =
    case when m >= 9 then school_year || '-' || (school_year::int + 1)::text
         else (school_year::int - 1)::text || '-' || school_year end
    where school_year ~ '^[0-9]{4}$';
  update public.grading_config set school_year =
    case when m >= 9 then school_year || '-' || (school_year::int + 1)::text
         else (school_year::int - 1)::text || '-' || school_year end
    where school_year ~ '^[0-9]{4}$';
end $$;
