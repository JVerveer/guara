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

create table if not exists silver.cbs_period_values (
  dataset_id text not null,
  period_key text not null,
  year integer,
  period_type text,
  period_start_date date,
  period_end_date date,
  label text,
  source_value text,
  source_version text,
  silver_loaded_at timestamptz not null default now(),
  primary key (dataset_id, period_key)
);

create table if not exists silver.cbs_region_values (
  dataset_id text not null,
  dimension_key text not null,
  region_code text not null,
  region_name text,
  region_level text,
  province_code text,
  municipality_code text,
  valid_from date,
  valid_to date,
  source_value text,
  source_version text,
  silver_loaded_at timestamptz not null default now(),
  primary key (dataset_id, dimension_key, region_code)
);

create table if not exists silver.cbs_dataset_grain (
  dataset_id text primary key,
  has_country_level boolean not null default false,
  has_province_level boolean not null default false,
  has_municipality_level boolean not null default false,
  has_neighborhood_level boolean not null default false,
  has_other_region_level boolean not null default false,
  has_year boolean not null default false,
  min_year integer,
  max_year integer,
  years integer[] not null default '{}',
  period_types text[] not null default '{}',
  spatial_dimension_keys text[] not null default '{}',
  period_dimension_key text,
  spatial_coverage text,
  confidence text not null default 'unqualified',
  classification_notes text[] not null default '{}',
  source_version text,
  silver_loaded_at timestamptz not null default now()
);

create table if not exists silver.cbs_indicator_candidates (
  dataset_id text not null,
  measure_key text not null,
  indicator_title text,
  unit text,
  decimals integer,
  parent_measure_key text,
  topic_path text,
  is_additive boolean,
  is_percentage boolean not null default false,
  is_count boolean not null default false,
  is_index boolean not null default false,
  confidence text not null default 'source-metadata',
  source_version text,
  silver_loaded_at timestamptz not null default now(),
  primary key (dataset_id, measure_key)
);

create table if not exists silver.cbs_domains (
  domain_id text primary key,
  canonical_name text not null,
  cbs_root_theme_title text not null,
  aliases jsonb not null default '[]',
  source_version text,
  silver_loaded_at timestamptz not null default now()
);

create table if not exists silver.cbs_dataset_domains (
  dataset_id text not null,
  domain_id text not null,
  root_theme_title text not null default '',
  assigned_theme_title text not null default '',
  theme_path text not null default '',
  confidence text not null default 'theme-root-match',
  assignment_reason text,
  source_version text,
  silver_loaded_at timestamptz not null default now(),
  primary key (dataset_id, domain_id, root_theme_title, assigned_theme_title, theme_path)
);

create table if not exists silver.cbs_gold_readiness (
  dataset_id text primary key,
  domain_ids text[] not null default '{}',
  priority_score integer not null default 0,
  record_count bigint,
  observation_count bigint,
  year_coverage integer,
  min_year integer,
  max_year integer,
  spatial_levels text[] not null default '{}',
  measure_count integer,
  dimension_count integer,
  quality_status text,
  suggested_gold_model text,
  recommended_action text,
  reason text,
  source_version text,
  silver_loaded_at timestamptz not null default now()
);

create index if not exists cbs_dataset_load_status_quality_idx
  on silver.cbs_dataset_load_status (quality_status);

create index if not exists cbs_dataset_load_status_row_completeness_idx
  on silver.cbs_dataset_load_status (row_completeness_pct);

create index if not exists cbs_schema_snapshots_dataset_idx
  on silver.cbs_schema_snapshots (dataset_id, captured_at desc);

create index if not exists cbs_observations_bronze_run_idx
  on silver.cbs_observations (bronze_ingestion_run_id);

create index if not exists cbs_observations_dataset_row_index_idx
  on silver.cbs_observations (dataset_id, row_index);

create index if not exists cbs_observation_dimensions_dataset_dimension_value_idx
  on silver.cbs_observation_dimensions (dataset_id, dimension_key, value_key);

create index if not exists cbs_observation_measures_dataset_measure_idx
  on silver.cbs_observation_measures (dataset_id, measure_key);

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

create index if not exists cbs_period_values_year_idx
  on silver.cbs_period_values (year);

create index if not exists cbs_region_values_level_idx
  on silver.cbs_region_values (region_level);

create index if not exists cbs_dataset_grain_year_idx
  on silver.cbs_dataset_grain (min_year, max_year);

create index if not exists cbs_dataset_grain_levels_idx
  on silver.cbs_dataset_grain (has_country_level, has_province_level, has_municipality_level, has_neighborhood_level);

create index if not exists cbs_indicator_candidates_dataset_idx
  on silver.cbs_indicator_candidates (dataset_id);

create index if not exists cbs_dataset_domains_domain_idx
  on silver.cbs_dataset_domains (domain_id);

create index if not exists cbs_gold_readiness_priority_idx
  on silver.cbs_gold_readiness (priority_score desc);

alter table silver.cbs_themes enable row level security;
alter table silver.cbs_dataset_themes enable row level security;
alter table silver.cbs_featured enable row level security;
alter table silver.cbs_dataset_featured enable row level security;
alter table silver.cbs_schema_snapshots enable row level security;
alter table silver.cbs_period_values enable row level security;
alter table silver.cbs_region_values enable row level security;
alter table silver.cbs_dataset_grain enable row level security;
alter table silver.cbs_indicator_candidates enable row level security;
alter table silver.cbs_domains enable row level security;
alter table silver.cbs_dataset_domains enable row level security;
alter table silver.cbs_gold_readiness enable row level security;

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

drop policy if exists "silver_period_values_read_public" on silver.cbs_period_values;
create policy "silver_period_values_read_public"
  on silver.cbs_period_values for select
  using (true);

drop policy if exists "silver_region_values_read_public" on silver.cbs_region_values;
create policy "silver_region_values_read_public"
  on silver.cbs_region_values for select
  using (true);

drop policy if exists "silver_dataset_grain_read_public" on silver.cbs_dataset_grain;
create policy "silver_dataset_grain_read_public"
  on silver.cbs_dataset_grain for select
  using (true);

drop policy if exists "silver_indicator_candidates_read_public" on silver.cbs_indicator_candidates;
create policy "silver_indicator_candidates_read_public"
  on silver.cbs_indicator_candidates for select
  using (true);

drop policy if exists "silver_domains_read_public" on silver.cbs_domains;
create policy "silver_domains_read_public"
  on silver.cbs_domains for select
  using (true);

drop policy if exists "silver_dataset_domains_read_public" on silver.cbs_dataset_domains;
create policy "silver_dataset_domains_read_public"
  on silver.cbs_dataset_domains for select
  using (true);

drop policy if exists "silver_gold_readiness_read_public" on silver.cbs_gold_readiness;
create policy "silver_gold_readiness_read_public"
  on silver.cbs_gold_readiness for select
  using (true);
