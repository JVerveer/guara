create schema if not exists silver;

alter table if exists silver.cbs_datasets
  add column if not exists schema_hash text;

alter table if exists silver.cbs_observations
  add column if not exists bronze_ingestion_run_id uuid,
  add column if not exists bronze_source_version text;

alter table if exists silver.cbs_dataset_load_status
  add column if not exists expected_observations bigint,
  add column if not exists quality_status text,
  add column if not exists quality_checks jsonb not null default '{}',
  add column if not exists metadata_completeness_pct numeric,
  add column if not exists dimension_completeness_pct numeric,
  add column if not exists row_completeness_pct numeric,
  add column if not exists source_schema_hash text;

alter table if exists silver.cbs_load_runs
  add column if not exists expected_observations bigint,
  add column if not exists metadata jsonb not null default '{}';

create table if not exists silver.cbs_themes (
  theme_id integer primary key,
  parent_theme_id integer,
  theme_number text,
  title text,
  language text,
  catalog text,
  source_version text,
  silver_loaded_at timestamptz not null default now()
);

create table if not exists silver.cbs_dataset_themes (
  dataset_id text not null,
  theme_id integer not null,
  theme_number text,
  source_version text,
  silver_loaded_at timestamptz not null default now(),
  primary key (dataset_id, theme_id)
);

create table if not exists silver.cbs_featured (
  featured_id integer primary key,
  number text,
  title text,
  description text,
  language text,
  catalog text,
  source_version text,
  silver_loaded_at timestamptz not null default now()
);

create table if not exists silver.cbs_dataset_featured (
  dataset_id text not null,
  featured_id integer not null,
  source_version text,
  silver_loaded_at timestamptz not null default now(),
  primary key (dataset_id, featured_id)
);

create table if not exists silver.cbs_schema_snapshots (
  dataset_id text not null,
  source_version text,
  schema_hash text not null,
  properties jsonb not null,
  captured_at timestamptz not null default now(),
  primary key (dataset_id, source_version, schema_hash)
);

create index if not exists cbs_dataset_load_status_quality_idx
  on silver.cbs_dataset_load_status (quality_status);

create index if not exists cbs_dataset_load_status_row_completeness_idx
  on silver.cbs_dataset_load_status (row_completeness_pct);

create index if not exists cbs_schema_snapshots_dataset_idx
  on silver.cbs_schema_snapshots (dataset_id, captured_at desc);

create index if not exists cbs_observations_bronze_run_idx
  on silver.cbs_observations (bronze_ingestion_run_id);

create index if not exists cbs_dataset_themes_dataset_idx
  on silver.cbs_dataset_themes (dataset_id);

create index if not exists cbs_dataset_themes_theme_idx
  on silver.cbs_dataset_themes (theme_id);

create index if not exists cbs_themes_parent_idx
  on silver.cbs_themes (parent_theme_id);

create index if not exists cbs_dataset_featured_dataset_idx
  on silver.cbs_dataset_featured (dataset_id);

create index if not exists cbs_dataset_featured_featured_idx
  on silver.cbs_dataset_featured (featured_id);

alter table silver.cbs_themes enable row level security;
alter table silver.cbs_dataset_themes enable row level security;
alter table silver.cbs_featured enable row level security;
alter table silver.cbs_dataset_featured enable row level security;
alter table silver.cbs_schema_snapshots enable row level security;

drop policy if exists "silver_themes_read_public" on silver.cbs_themes;
create policy "silver_themes_read_public"
  on silver.cbs_themes for select
  using (true);

drop policy if exists "silver_dataset_themes_read_public" on silver.cbs_dataset_themes;
create policy "silver_dataset_themes_read_public"
  on silver.cbs_dataset_themes for select
  using (true);

drop policy if exists "silver_featured_read_public" on silver.cbs_featured;
create policy "silver_featured_read_public"
  on silver.cbs_featured for select
  using (true);

drop policy if exists "silver_dataset_featured_read_public" on silver.cbs_dataset_featured;
create policy "silver_dataset_featured_read_public"
  on silver.cbs_dataset_featured for select
  using (true);

drop policy if exists "silver_schema_snapshots_read_public" on silver.cbs_schema_snapshots;
create policy "silver_schema_snapshots_read_public"
  on silver.cbs_schema_snapshots for select
  using (true);
