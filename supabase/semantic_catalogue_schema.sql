create extension if not exists vector;
create extension if not exists pgcrypto;

create schema if not exists semantic;

create table if not exists semantic.catalogue_item (
  catalogue_item_id uuid primary key default gen_random_uuid(),
  object_type text not null,
  object_id text not null,
  source_schema text,
  source_table text,
  source_pk text,
  title text not null,
  subtitle text,
  description text,
  search_text text not null,
  language_code text not null default 'nl',
  provider text,
  dataset_code text,
  measure_code text,
  geography_code text,
  unit_code text,
  domain_id text,
  tags text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  search_vector tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(subtitle, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(search_text, '')), 'D')
  ) stored,
  embedding vector(64),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (object_type, object_id)
);

create table if not exists semantic.search_telemetry (
  search_id uuid primary key default gen_random_uuid(),
  query_text text not null,
  classified_intent text,
  resolved_plan jsonb,
  result_count integer,
  latency_ms integer,
  created_at timestamptz not null default now()
);

create table if not exists semantic.answer_provenance (
  answer_id uuid primary key default gen_random_uuid(),
  question text not null,
  intent text not null,
  query_plan jsonb not null,
  compiled_sql_fingerprint text,
  result_summary jsonb not null default '{}'::jsonb,
  sources jsonb not null default '[]'::jsonb,
  confidence numeric,
  created_at timestamptz not null default now()
);

create table if not exists semantic.saved_analysis (
  analysis_id uuid primary key default gen_random_uuid(),
  answer_id uuid references semantic.answer_provenance(answer_id) on delete set null,
  title text not null,
  question text not null,
  summary text,
  query_plan jsonb not null default '{}'::jsonb,
  sources jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists semantic.evidence_conversion (
  evidence_id uuid primary key default gen_random_uuid(),
  answer_id uuid references semantic.answer_provenance(answer_id) on delete cascade,
  evidence_status text not null default 'candidate',
  title text not null,
  claim text,
  sources jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists semantic.answer_feedback (
  feedback_id uuid primary key default gen_random_uuid(),
  answer_id uuid references semantic.answer_provenance(answer_id) on delete cascade,
  rating text not null,
  comment text,
  created_at timestamptz not null default now()
);

create index if not exists semantic_catalogue_item_search_idx
  on semantic.catalogue_item using gin (search_vector);

create index if not exists semantic_catalogue_item_embedding_idx
  on semantic.catalogue_item using ivfflat (embedding vector_cosine_ops)
  with (lists = 64);

create index if not exists semantic_catalogue_item_type_idx
  on semantic.catalogue_item(object_type);

create index if not exists semantic_catalogue_item_dataset_idx
  on semantic.catalogue_item(dataset_code);

create index if not exists semantic_catalogue_item_domain_idx
  on semantic.catalogue_item(domain_id);

alter table semantic.catalogue_item enable row level security;
alter table semantic.search_telemetry enable row level security;
alter table semantic.answer_provenance enable row level security;
alter table semantic.saved_analysis enable row level security;
alter table semantic.evidence_conversion enable row level security;
alter table semantic.answer_feedback enable row level security;

drop policy if exists "semantic_catalogue_item_read_public" on semantic.catalogue_item;
create policy "semantic_catalogue_item_read_public"
  on semantic.catalogue_item for select
  using (is_active);

drop policy if exists "semantic_answer_provenance_read_public" on semantic.answer_provenance;
create policy "semantic_answer_provenance_read_public"
  on semantic.answer_provenance for select
  using (true);

drop policy if exists "semantic_saved_analysis_read_public" on semantic.saved_analysis;
create policy "semantic_saved_analysis_read_public"
  on semantic.saved_analysis for select
  using (true);

drop function if exists public.guara_hybrid_search(text, text, integer, text[]);
create or replace function public.guara_hybrid_search(
  search_query text,
  query_embedding text default null,
  match_count integer default 10,
  object_types text[] default null
)
returns table (
  catalogue_item_id uuid,
  object_type text,
  object_id text,
  title text,
  subtitle text,
  description text,
  dataset_code text,
  measure_code text,
  geography_code text,
  unit_code text,
  domain_id text,
  provider text,
  rank_score numeric,
  lexical_score numeric,
  vector_score numeric,
  metadata jsonb
)
language sql
stable
security definer
set search_path = public, semantic, gold, gold_bouwen_wonen
as $$
  with q as (
    select
      websearch_to_tsquery('simple', coalesce(search_query, '')) as tsq,
      case
        when nullif(query_embedding, '') is null then null
        else query_embedding::vector(64)
      end as embedding
  ),
  scored as (
    select
      c.catalogue_item_id,
      c.object_type,
      c.object_id,
      c.title,
      c.subtitle,
      c.description,
      c.dataset_code,
      c.measure_code,
      c.geography_code,
      c.unit_code,
      c.domain_id,
      c.provider,
      case when q.tsq @@ c.search_vector then ts_rank_cd(c.search_vector, q.tsq) else 0 end as lexical_score,
      case
        when q.embedding is not null and c.embedding is not null then 1 - (c.embedding <=> q.embedding)
        else 0
      end as vector_score,
      c.metadata
    from semantic.catalogue_item c
    cross join q
    where c.is_active
      and (object_types is null or c.object_type = any(object_types))
      and (
        q.tsq @@ c.search_vector
        or q.embedding is not null
        or c.search_text ilike '%' || coalesce(search_query, '') || '%'
      )
  )
  select
    scored.catalogue_item_id,
    scored.object_type,
    scored.object_id,
    scored.title,
    scored.subtitle,
    scored.description,
    scored.dataset_code,
    scored.measure_code,
    scored.geography_code,
    scored.unit_code,
    scored.domain_id,
    scored.provider,
    round(((scored.lexical_score * 0.65) + (scored.vector_score * 0.35))::numeric, 6) as rank_score,
    round(scored.lexical_score::numeric, 6) as lexical_score,
    round(scored.vector_score::numeric, 6) as vector_score,
    scored.metadata
  from scored
  order by ((scored.lexical_score * 0.65) + (scored.vector_score * 0.35)) desc, scored.title asc
  limit greatest(1, least(coalesce(match_count, 10), 50));
$$;

drop function if exists public.guara_execute_query_plan(jsonb);
create or replace function public.guara_execute_query_plan(plan jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, gold, gold_bouwen_wonen, semantic
as $$
declare
  intent text := coalesce(plan->>'intent', '');
  measure bigint := nullif(plan->>'measure_key', '')::bigint;
  year_value integer := nullif(plan->>'year', '')::integer;
  limit_value integer := greatest(1, least(coalesce(nullif(plan->>'limit', '')::integer, 10), 50));
  result jsonb;
begin
  if intent not in ('rank_geographies', 'compare_geographies', 'trend', 'lookup_measure') then
    raise exception 'Unsupported query intent: %', intent;
  end if;

  if intent = 'lookup_measure' then
    select jsonb_build_object(
      'columns', jsonb_build_array('measure_key', 'measure_code', 'indicator_name', 'unit_code', 'default_aggregation', 'value_type'),
      'rows', coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
    )
    into result
    from (
      select housing_indicator_key as measure_key, measure_code, indicator_name, unit_code, default_aggregation, value_type
      from gold_bouwen_wonen.dim_housing_indicator
      where measure_key = measure
      limit 1
    ) x;
    return result;
  end if;

  if measure is null then
    raise exception 'Missing required measure_key.';
  end if;

  if not exists (select 1 from gold_bouwen_wonen.dim_housing_indicator where measure_key = measure) then
    raise exception 'Measure is not available in the Bouwen en wonen mart.';
  end if;

  if intent = 'rank_geographies' then
    select jsonb_build_object(
      'columns', jsonb_build_array('geography_name', 'geography_code', 'geography_type', 'calendar_year', 'value'),
      'rows', coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
    )
    into result
    from (
      select
        geography_name,
        geography_code,
        geography_type,
        calendar_year,
        observation_value as value
      from gold_bouwen_wonen.fact_housing_observation
      where measure_key = measure
        and observation_value is not null
        and is_missing = false
        and (year_value is null or calendar_year = year_value)
      order by observation_value desc nulls last
      limit limit_value
    ) x;
    return result;
  end if;

  if intent = 'compare_geographies' then
    select jsonb_build_object(
      'columns', jsonb_build_array('geography_name', 'calendar_year', 'value'),
      'rows', coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
    )
    into result
    from (
      select geography_name, calendar_year, observation_value as value
      from gold_bouwen_wonen.fact_housing_observation
      where measure_key = measure
        and observation_value is not null
        and is_missing = false
        and (
          jsonb_array_length(coalesce(plan->'geography_names', '[]'::jsonb)) = 0
          or lower(geography_name) in (
            select lower(jsonb_array_elements_text(plan->'geography_names'))
          )
        )
        and (year_value is null or calendar_year = year_value)
      order by geography_name asc, calendar_year asc
      limit limit_value
    ) x;
    return result;
  end if;

  if intent = 'trend' then
    select jsonb_build_object(
      'columns', jsonb_build_array('calendar_year', 'value'),
      'rows', coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
    )
    into result
    from (
      select calendar_year, avg(observation_value) as value
      from gold_bouwen_wonen.fact_housing_observation
      where measure_key = measure
        and observation_value is not null
        and is_missing = false
        and calendar_year is not null
        and (
          jsonb_array_length(coalesce(plan->'geography_names', '[]'::jsonb)) = 0
          or lower(geography_name) in (
            select lower(jsonb_array_elements_text(plan->'geography_names'))
          )
        )
      group by calendar_year
      order by calendar_year asc
      limit limit_value
    ) x;
    return result;
  end if;

  raise exception 'Unhandled query intent.';
end;
$$;

drop function if exists public.guara_record_answer_provenance(text, text, jsonb, jsonb, jsonb, numeric);
create or replace function public.guara_record_answer_provenance(
  question text,
  intent text,
  query_plan jsonb,
  result_summary jsonb,
  sources jsonb,
  confidence numeric
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, semantic
as $$
declare
  next_id uuid;
begin
  insert into semantic.answer_provenance (
    question, intent, query_plan, compiled_sql_fingerprint, result_summary, sources, confidence
  )
  values (
    question,
    intent,
    query_plan,
    encode(sha256(convert_to(query_plan::text, 'UTF8')), 'hex'),
    coalesce(result_summary, '{}'::jsonb),
    coalesce(sources, '[]'::jsonb),
    confidence
  )
  returning answer_id into next_id;

  return next_id;
end;
$$;

drop function if exists public.guara_save_analysis(uuid, text, text);
create or replace function public.guara_save_analysis(
  answer_id uuid,
  title text,
  summary text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, semantic
as $$
declare
  next_id uuid;
begin
  insert into semantic.saved_analysis (answer_id, title, question, summary, query_plan, sources)
  select
    a.answer_id,
    coalesce(nullif(title, ''), left(a.question, 120)),
    a.question,
    summary,
    a.query_plan,
    a.sources
  from semantic.answer_provenance a
  where a.answer_id = guara_save_analysis.answer_id
  returning analysis_id into next_id;

  return next_id;
end;
$$;

drop function if exists public.guara_convert_answer_to_evidence(uuid, text, text);
create or replace function public.guara_convert_answer_to_evidence(
  answer_id uuid,
  title text,
  claim text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, semantic
as $$
declare
  next_id uuid;
begin
  insert into semantic.evidence_conversion (answer_id, title, claim, sources)
  select
    a.answer_id,
    coalesce(nullif(title, ''), left(a.question, 120)),
    claim,
    a.sources
  from semantic.answer_provenance a
  where a.answer_id = guara_convert_answer_to_evidence.answer_id
  returning evidence_id into next_id;

  return next_id;
end;
$$;
