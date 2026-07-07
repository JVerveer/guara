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

alter table public.dataset_catalog enable row level security;
alter table public.dataset_dimensions enable row level security;

drop policy if exists "dataset_catalog_read_public" on public.dataset_catalog;
create policy "dataset_catalog_read_public"
  on public.dataset_catalog for select
  using (true);

drop policy if exists "dataset_dimensions_read_public" on public.dataset_dimensions;
create policy "dataset_dimensions_read_public"
  on public.dataset_dimensions for select
  using (true);

-- Keep writes server-side by default. Add authenticated/service-role ingestion later.
