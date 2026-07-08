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

create table if not exists public.source_layer_summary (
  provider text not null,
  layer text not null,
  status text not null default 'pending',
  datasets_total bigint not null default 0,
  datasets_complete bigint not null default 0,
  datasets_partial bigint not null default 0,
  datasets_failed bigint not null default 0,
  records_expected bigint not null default 0,
  records_loaded bigint not null default 0,
  completeness_pct numeric,
  rejected_rows bigint not null default 0,
  last_loaded_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (provider, layer)
);

create table if not exists public.dataset_quality_checks (
  dataset_id text not null references public.dataset_catalog(id) on delete cascade,
  layer text not null,
  check_name text not null,
  status text not null,
  expected_value text,
  actual_value text,
  message text,
  checked_at timestamptz not null default now(),
  primary key (dataset_id, layer, check_name)
);

create index if not exists silver_dataset_catalog_loaded_idx
  on public.silver_dataset_catalog (silver_loaded_at desc);

create index if not exists silver_dataset_catalog_status_idx
  on public.silver_dataset_catalog (load_status);

create index if not exists source_layer_summary_status_idx
  on public.source_layer_summary (status);

create index if not exists dataset_quality_checks_layer_status_idx
  on public.dataset_quality_checks (layer, status);

alter table public.dataset_catalog enable row level security;
alter table public.dataset_dimensions enable row level security;
alter table public.dataset_preview_rows enable row level security;
alter table public.silver_dataset_catalog enable row level security;
alter table public.source_layer_summary enable row level security;
alter table public.dataset_quality_checks enable row level security;

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

drop policy if exists "source_layer_summary_read_public" on public.source_layer_summary;
create policy "source_layer_summary_read_public"
  on public.source_layer_summary for select
  using (true);

drop policy if exists "dataset_quality_checks_read_public" on public.dataset_quality_checks;
create policy "dataset_quality_checks_read_public"
  on public.dataset_quality_checks for select
  using (true);

create or replace view public.v_dataset_inventory as
select
  dc.id as dataset_id,
  dc.provider,
  dc.title,
  dc.record_count as public_record_count,
  dc.year_start,
  dc.year_end,
  dc.years,
  dc.geographic_levels,
  dc.spatial_coverage,
  dc.qualification_confidence,
  dc.ingested_at as public_ingested_at,
  sdc.load_status as silver_status,
  sdc.observations_loaded as silver_observations_loaded,
  sdc.rejected_rows as silver_rejected_rows,
  sdc.silver_loaded_at,
  case when sdc.dataset_id is null then false else true end as available_in_silver
from public.dataset_catalog dc
left join public.silver_dataset_catalog sdc
  on sdc.dataset_id = dc.id;

create or replace view public.v_source_layer_summary as
select *
from public.source_layer_summary;

create or replace view public.v_silver_coverage as
select
  sdc.dataset_id,
  sdc.title,
  sdc.load_status,
  dc.record_count as expected_records,
  sdc.observations_loaded as loaded_records,
  case
    when coalesce(dc.record_count, 0) > 0
      then round((coalesce(sdc.observations_loaded, 0)::numeric / dc.record_count::numeric) * 100, 2)
    else null
  end as completeness_pct,
  sdc.rejected_rows,
  sdc.silver_loaded_at
from public.silver_dataset_catalog sdc
left join public.dataset_catalog dc
  on dc.id = sdc.dataset_id;

create or replace view public.v_bronze_coverage as
select
  dc.id as dataset_id,
  dc.title,
  dc.record_count as expected_records,
  count(dpr.row_id) as preview_rows,
  dc.ingested_at
from public.dataset_catalog dc
left join public.dataset_preview_rows dpr
  on dpr.dataset_id = dc.id
group by dc.id, dc.title, dc.record_count, dc.ingested_at;

-- Keep writes server-side by default. Add authenticated/service-role ingestion later.
