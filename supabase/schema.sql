create table if not exists public.dataset_catalog (
  id text primary key,
  provider text not null,
  title text not null,
  description text,
  updated_at timestamptz,
  record_count bigint,
  year_start integer,
  year_end integer,
  years integer[] not null default '{}',
  geographic_levels text[] not null default '{}',
  spatial_coverage text,
  period_source text,
  qualification_confidence text not null default 'unqualified',
  qualification_evidence text[] not null default '{}',
  source_url text,
  ingested_at timestamptz not null default now()
);

create index if not exists dataset_catalog_years_idx
  on public.dataset_catalog using gin (years);

create index if not exists dataset_catalog_geographic_levels_idx
  on public.dataset_catalog using gin (geographic_levels);

create index if not exists dataset_catalog_updated_at_idx
  on public.dataset_catalog (updated_at desc);

create index if not exists dataset_catalog_record_count_idx
  on public.dataset_catalog (record_count);

create table if not exists public.dataset_dimensions (
  id uuid primary key default gen_random_uuid(),
  dataset_id text not null references public.dataset_catalog(id) on delete cascade,
  key text not null,
  title text not null,
  type text not null,
  values_count bigint,
  ingested_at timestamptz not null default now(),
  unique (dataset_id, key)
);

create table if not exists public.dataset_preview_rows (
  dataset_id text not null references public.dataset_catalog(id) on delete cascade,
  row_id text not null,
  row_index bigint,
  raw jsonb not null,
  ingested_at timestamptz not null default now(),
  primary key (dataset_id, row_id)
);

create index if not exists dataset_preview_rows_dataset_idx
  on public.dataset_preview_rows (dataset_id, row_index);

create table if not exists public.silver_dataset_catalog (
  dataset_id text primary key references public.dataset_catalog(id) on delete cascade,
  provider text not null default 'CBS',
  title text not null,
  short_title text,
  description text,
  language text,
  catalog text,
  period text,
  cbs_updated_at timestamptz,
  source_version text,
  source_url text,
  bronze_ingested_at timestamptz,
  silver_loaded_at timestamptz,
  load_status text,
  observations_loaded bigint,
  dimensions_loaded bigint,
  measures_loaded bigint,
  rejected_rows bigint,
  published_at timestamptz not null default now()
);

create index if not exists silver_dataset_catalog_loaded_idx
  on public.silver_dataset_catalog (silver_loaded_at desc);

create index if not exists silver_dataset_catalog_status_idx
  on public.silver_dataset_catalog (load_status);

alter table public.dataset_catalog enable row level security;
alter table public.dataset_dimensions enable row level security;
alter table public.dataset_preview_rows enable row level security;
alter table public.silver_dataset_catalog enable row level security;

drop policy if exists "dataset_catalog_read_public" on public.dataset_catalog;
create policy "dataset_catalog_read_public"
  on public.dataset_catalog for select
  using (true);

drop policy if exists "dataset_dimensions_read_public" on public.dataset_dimensions;
create policy "dataset_dimensions_read_public"
  on public.dataset_dimensions for select
  using (true);

drop policy if exists "dataset_preview_rows_read_public" on public.dataset_preview_rows;
create policy "dataset_preview_rows_read_public"
  on public.dataset_preview_rows for select
  using (true);

drop policy if exists "silver_dataset_catalog_read_public" on public.silver_dataset_catalog;
create policy "silver_dataset_catalog_read_public"
  on public.silver_dataset_catalog for select
  using (true);

-- Keep writes server-side by default. Add authenticated/service-role ingestion later.
