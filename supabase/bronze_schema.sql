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

create index if not exists cbs_catalog_tables_updated_at_idx
  on bronze.cbs_catalog_tables (updated_at desc);

create index if not exists cbs_data_properties_dataset_key_idx
  on bronze.cbs_data_properties (dataset_id, key);

create index if not exists cbs_dimension_values_dataset_dimension_idx
  on bronze.cbs_dimension_values (dataset_id, dimension_key);

create index if not exists cbs_typed_dataset_rows_row_index_idx
  on bronze.cbs_typed_dataset_rows (dataset_id, row_index);

create index if not exists cbs_typed_dataset_rows_dataset_row_index_desc_idx
  on bronze.cbs_typed_dataset_rows (dataset_id, row_index desc);

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

alter table bronze.cbs_catalog_tables enable row level security;
alter table bronze.cbs_data_properties enable row level security;
alter table bronze.cbs_dimension_values enable row level security;
alter table bronze.cbs_typed_dataset_rows enable row level security;
alter table bronze.cbs_raw_endpoint_payloads enable row level security;
alter table bronze.cbs_ingestion_runs enable row level security;
alter table bronze.cbs_dataset_ingestion_status enable row level security;
alter table bronze.cbs_schema_snapshots enable row level security;

-- No public policies on bronze tables. Use the Supabase service-role key for ingestion.
