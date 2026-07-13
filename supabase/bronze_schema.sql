create schema if not exists bronze;

create table if not exists bronze.cbs_catalog_tables (
  identifier text primary key,
  title text not null,
  short_title text,
  short_description text,
  language text,
  catalog text,
  period text,
  updated_at timestamptz,
  raw jsonb not null,
  ingested_at timestamptz not null default now()
);

create table if not exists bronze.cbs_data_properties (
  dataset_id text not null references bronze.cbs_catalog_tables(identifier) on delete cascade,
  property_id integer not null,
  key text,
  title text,
  type text,
  parent_id integer,
  position integer,
  raw jsonb not null,
  ingested_at timestamptz not null default now(),
  primary key (dataset_id, property_id)
);

create table if not exists bronze.cbs_dimension_values (
  dataset_id text not null references bronze.cbs_catalog_tables(identifier) on delete cascade,
  dimension_key text not null,
  key text not null,
  title text,
  description text,
  raw jsonb not null,
  ingested_at timestamptz not null default now(),
  primary key (dataset_id, dimension_key, key)
);

create table if not exists bronze.cbs_themes (
  id integer primary key,
  parent_id integer,
  number text,
  title text,
  language text,
  catalog text,
  raw jsonb not null,
  ingested_at timestamptz not null default now()
);

create table if not exists bronze.cbs_table_themes (
  id integer primary key,
  table_id integer not null,
  table_identifier text not null,
  theme_id integer not null,
  theme_number text,
  raw jsonb not null,
  ingested_at timestamptz not null default now()
);

create table if not exists bronze.cbs_featured (
  id integer primary key,
  number text,
  title text,
  description text,
  language text,
  catalog text,
  raw jsonb not null,
  ingested_at timestamptz not null default now()
);

create table if not exists bronze.cbs_table_featured (
  id integer primary key,
  table_id integer not null,
  table_identifier text,
  featured_id integer not null,
  raw jsonb not null,
  ingested_at timestamptz not null default now()
);

create table if not exists bronze.cbs_typed_dataset_rows (
  dataset_id text not null references bronze.cbs_catalog_tables(identifier) on delete cascade,
  row_id text not null,
  row_index bigint,
  ingestion_run_id uuid,
  source_version text,
  raw jsonb not null,
  ingested_at timestamptz not null default now(),
  primary key (dataset_id, row_id)
);

create table if not exists bronze.cbs_typed_dataset_rows_stage (
  load_id uuid not null,
  dataset_id text not null,
  row_id text not null,
  row_index bigint,
  ingestion_run_id uuid,
  source_version text,
  raw jsonb not null,
  ingested_at timestamptz not null default now()
);

create table if not exists bronze.cbs_raw_endpoint_payloads (
  dataset_id text not null,
  endpoint text not null,
  source_url text not null,
  payload jsonb not null,
  ingested_at timestamptz not null default now(),
  primary key (dataset_id, endpoint)
);

create table if not exists bronze.cbs_ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  dataset_id text not null,
  status text not null,
  source_version text,
  expected_rows bigint,
  rows_ingested bigint not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists bronze.cbs_dataset_ingestion_status (
  dataset_id text primary key,
  title text,
  last_cbs_updated_at timestamptz,
  last_ingested_at timestamptz,
  record_count bigint,
  loaded_row_count bigint not null default 0,
  load_percentage numeric,
  source_version text,
  schema_hash text,
  last_run_id uuid,
  metadata_completeness_pct numeric,
  dimension_completeness_pct numeric,
  row_completeness_pct numeric,
  quality_status text,
  quality_checks jsonb not null default '{}'::jsonb,
  status text not null,
  error_message text
);

create table if not exists bronze.cbs_schema_snapshots (
  dataset_id text not null,
  source_version text not null,
  schema_hash text not null,
  properties jsonb not null,
  captured_at timestamptz not null default now(),
  primary key (dataset_id, source_version, schema_hash)
);

create table if not exists bronze.cbs_dataset_retention_policy (
  dataset_id text primary key,
  root_theme_title text,
  retention_tier text not null,
  keep_raw_rows boolean not null default false,
  storage_provider text,
  storage_location text,
  reason text,
  updated_at timestamptz not null default now()
);

alter table bronze.cbs_dataset_ingestion_status
  add column if not exists loaded_row_count bigint not null default 0;

alter table bronze.cbs_dataset_ingestion_status
  add column if not exists load_percentage numeric;

alter table bronze.cbs_dataset_ingestion_status
  add column if not exists source_version text;

alter table bronze.cbs_dataset_ingestion_status
  add column if not exists schema_hash text;

alter table bronze.cbs_dataset_ingestion_status
  add column if not exists last_run_id uuid;

alter table bronze.cbs_dataset_ingestion_status
  add column if not exists metadata_completeness_pct numeric;

alter table bronze.cbs_dataset_ingestion_status
  add column if not exists dimension_completeness_pct numeric;

alter table bronze.cbs_dataset_ingestion_status
  add column if not exists row_completeness_pct numeric;

alter table bronze.cbs_dataset_ingestion_status
  add column if not exists quality_status text;

alter table bronze.cbs_dataset_ingestion_status
  add column if not exists quality_checks jsonb not null default '{}'::jsonb;

alter table bronze.cbs_typed_dataset_rows
  add column if not exists ingestion_run_id uuid;

alter table bronze.cbs_typed_dataset_rows
  add column if not exists source_version text;

alter table bronze.cbs_ingestion_runs
  add column if not exists source_version text;

alter table bronze.cbs_ingestion_runs
  add column if not exists expected_rows bigint;

alter table bronze.cbs_ingestion_runs
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table bronze.cbs_table_themes
  add column if not exists table_identifier text;

alter table bronze.cbs_table_featured
  add column if not exists table_identifier text;

create index if not exists cbs_catalog_tables_updated_at_idx
  on bronze.cbs_catalog_tables (updated_at desc);

create index if not exists cbs_data_properties_dataset_key_idx
  on bronze.cbs_data_properties (dataset_id, key);

create index if not exists cbs_dimension_values_dataset_dimension_idx
  on bronze.cbs_dimension_values (dataset_id, dimension_key);

create index if not exists cbs_themes_language_catalog_idx
  on bronze.cbs_themes (language, catalog);

create index if not exists cbs_themes_parent_idx
  on bronze.cbs_themes (parent_id);

create index if not exists cbs_table_themes_table_identifier_idx
  on bronze.cbs_table_themes (table_identifier);

create index if not exists cbs_table_themes_theme_idx
  on bronze.cbs_table_themes (theme_id);

create index if not exists cbs_featured_language_catalog_idx
  on bronze.cbs_featured (language, catalog);

create index if not exists cbs_table_featured_table_identifier_idx
  on bronze.cbs_table_featured (table_identifier);

create index if not exists cbs_table_featured_featured_idx
  on bronze.cbs_table_featured (featured_id);

create index if not exists cbs_typed_dataset_rows_row_index_idx
  on bronze.cbs_typed_dataset_rows (dataset_id, row_index);

create index if not exists cbs_typed_dataset_rows_dataset_row_index_desc_idx
  on bronze.cbs_typed_dataset_rows (dataset_id, row_index desc);

create index if not exists cbs_typed_dataset_rows_stage_load_idx
  on bronze.cbs_typed_dataset_rows_stage (load_id);

create index if not exists cbs_typed_dataset_rows_stage_dataset_idx
  on bronze.cbs_typed_dataset_rows_stage (dataset_id);

create index if not exists cbs_raw_endpoint_payloads_dataset_idx
  on bronze.cbs_raw_endpoint_payloads (dataset_id);

create index if not exists cbs_ingestion_runs_dataset_idx
  on bronze.cbs_ingestion_runs (dataset_id, started_at desc);

create index if not exists cbs_dataset_ingestion_status_status_idx
  on bronze.cbs_dataset_ingestion_status (status);

create index if not exists cbs_dataset_ingestion_status_quality_idx
  on bronze.cbs_dataset_ingestion_status (quality_status);

create index if not exists cbs_schema_snapshots_dataset_idx
  on bronze.cbs_schema_snapshots (dataset_id, captured_at desc);

create index if not exists cbs_dataset_retention_policy_tier_idx
  on bronze.cbs_dataset_retention_policy (retention_tier);

create index if not exists cbs_dataset_retention_policy_root_theme_idx
  on bronze.cbs_dataset_retention_policy (root_theme_title);

create or replace view bronze.cbs_theme_hierarchy as
with recursive theme_tree as (
  select
    theme.id as theme_id,
    theme.parent_id as parent_theme_id,
    theme.id as root_theme_id,
    theme.number as theme_number,
    theme.title as theme_title,
    theme.number as root_theme_number,
    theme.title as root_theme_title,
    theme.language,
    theme.catalog,
    0 as depth,
    array[theme.id] as theme_path_ids,
    array[theme.title] as theme_path_titles
  from bronze.cbs_themes theme
  where theme.parent_id is null

  union all

  select
    child.id as theme_id,
    child.parent_id as parent_theme_id,
    tree.root_theme_id,
    child.number as theme_number,
    child.title as theme_title,
    tree.root_theme_number,
    tree.root_theme_title,
    child.language,
    child.catalog,
    tree.depth + 1 as depth,
    tree.theme_path_ids || child.id as theme_path_ids,
    tree.theme_path_titles || child.title as theme_path_titles
  from bronze.cbs_themes child
  join theme_tree tree
    on tree.theme_id = child.parent_id
),
orphan_themes as (
  select
    theme.id as theme_id,
    theme.parent_id as parent_theme_id,
    theme.id as root_theme_id,
    theme.number as theme_number,
    theme.title as theme_title,
    theme.number as root_theme_number,
    theme.title as root_theme_title,
    theme.language,
    theme.catalog,
    0 as depth,
    array[theme.id] as theme_path_ids,
    array[theme.title] as theme_path_titles
  from bronze.cbs_themes theme
  left join theme_tree tree
    on tree.theme_id = theme.id
  where tree.theme_id is null
)
select * from theme_tree
union all
select * from orphan_themes;

create or replace view bronze.cbs_dataset_theme_hierarchy as
select
  table_theme.table_identifier as dataset_id,
  table_theme.table_id,
  table_theme.theme_id as assigned_theme_id,
  hierarchy.theme_number as assigned_theme_number,
  hierarchy.theme_title as assigned_theme_title,
  hierarchy.parent_theme_id,
  hierarchy.root_theme_id as top_theme_id,
  hierarchy.root_theme_number as top_theme_number,
  hierarchy.root_theme_title as top_theme_title,
  hierarchy.depth,
  hierarchy.theme_path_ids,
  hierarchy.theme_path_titles,
  array_to_string(hierarchy.theme_path_titles, ' > ') as theme_path,
  table_theme.ingested_at
from bronze.cbs_table_themes table_theme
left join bronze.cbs_theme_hierarchy hierarchy
  on hierarchy.theme_id = table_theme.theme_id;

alter table bronze.cbs_catalog_tables enable row level security;
alter table bronze.cbs_data_properties enable row level security;
alter table bronze.cbs_dimension_values enable row level security;
alter table bronze.cbs_themes enable row level security;
alter table bronze.cbs_table_themes enable row level security;
alter table bronze.cbs_featured enable row level security;
alter table bronze.cbs_table_featured enable row level security;
alter table bronze.cbs_typed_dataset_rows enable row level security;
alter table bronze.cbs_typed_dataset_rows_stage enable row level security;
alter table bronze.cbs_raw_endpoint_payloads enable row level security;
alter table bronze.cbs_ingestion_runs enable row level security;
alter table bronze.cbs_dataset_ingestion_status enable row level security;
alter table bronze.cbs_schema_snapshots enable row level security;
alter table bronze.cbs_dataset_retention_policy enable row level security;

-- No public policies on bronze tables. Use the Supabase service-role key for ingestion.
