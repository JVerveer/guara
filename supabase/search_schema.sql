create extension if not exists vector;
create extension if not exists pgcrypto;

create schema if not exists search;

create table if not exists search.search_document (
  search_document_id uuid primary key default gen_random_uuid(),
  object_type text not null,
  object_id text not null,
  investigation_id uuid,
  workspace_id uuid,
  search_scope_key text not null default 'global',
  object_code text,
  primary_name text,
  title text not null,
  subtitle text,
  description text,
  synonyms_text text,
  labels_text text,
  examples_text text,
  extended_metadata_text text,
  searchable_text text not null,
  language_code text not null default 'nl',
  source_name text,
  dataset_key bigint,
  dataset_code text,
  unit_code text,
  topic text,
  geography_type text,
  year_start integer,
  year_end integer,
  metadata jsonb not null default '{}'::jsonb,
  search_vector tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(subtitle, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(searchable_text, '')), 'D')
  ) stored,
  embedding vector(64),
  embedding_model text,
  embedding_version text,
  source_quality text not null default 'unknown',
  popularity_score numeric not null default 0,
  updated_at timestamptz not null default now(),
  indexed_at timestamptz not null default now(),
  unique (object_type, object_id, search_scope_key)
);

alter table search.search_document add column if not exists search_scope_key text not null default 'global';
alter table search.search_document add column if not exists object_code text;
alter table search.search_document add column if not exists primary_name text;
alter table search.search_document add column if not exists synonyms_text text;
alter table search.search_document add column if not exists labels_text text;
alter table search.search_document add column if not exists examples_text text;
alter table search.search_document add column if not exists extended_metadata_text text;
alter table search.search_document add column if not exists dataset_key bigint;
alter table search.search_document add column if not exists unit_code text;
alter table search.search_document add column if not exists topic text;
alter table search.search_document add column if not exists geography_type text;
alter table search.search_document add column if not exists year_start integer;
alter table search.search_document add column if not exists year_end integer;

create unique index if not exists search_document_object_scope_uidx
  on search.search_document(object_type, object_id, search_scope_key);

create table if not exists search.index_runs (
  index_run_id uuid primary key default gen_random_uuid(),
  status text not null default 'pending',
  mode text not null default 'incremental',
  object_type text,
  dataset_code text,
  investigation_id uuid,
  embedding_model text,
  embedding_version text,
  indexed_count bigint not null default 0,
  removed_count bigint not null default 0,
  failure_count bigint not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  message text
);

create index if not exists search_document_search_vector_idx
  on search.search_document using gin (search_vector);

create index if not exists search_document_embedding_idx
  on search.search_document using ivfflat (embedding vector_cosine_ops)
  with (lists = 64);

create index if not exists search_document_type_idx
  on search.search_document(object_type);

create index if not exists search_document_dataset_idx
  on search.search_document(dataset_code);

create index if not exists search_document_dataset_key_idx
  on search.search_document(dataset_key);

create index if not exists search_document_code_idx
  on search.search_document(lower(object_code));

create index if not exists search_document_language_idx
  on search.search_document(language_code);

create index if not exists search_document_filter_idx
  on search.search_document(source_name, unit_code, geography_type, topic);

create index if not exists search_document_year_idx
  on search.search_document(year_start, year_end);

create index if not exists search_document_investigation_idx
  on search.search_document(investigation_id);

create index if not exists search_document_embedding_version_idx
  on search.search_document(embedding_model, embedding_version);

alter table search.search_document enable row level security;
alter table search.index_runs enable row level security;

drop policy if exists "search_document_global_read_public" on search.search_document;
create policy "search_document_global_read_public"
  on search.search_document for select
  using (
    investigation_id is null
    or exists (
      select 1
      from answer.investigation_access access
      where access.investigation_id = search_document.investigation_id
        and access.user_id = auth.uid()
    )
  );

drop policy if exists "search_index_runs_read_public" on search.index_runs;
create policy "search_index_runs_read_public"
  on search.index_runs for select
  using (true);

create table if not exists search.ranking_config (
  config_key text primary key,
  config_value numeric not null,
  updated_at timestamptz not null default now()
);

insert into search.ranking_config (config_key, config_value) values
  ('exact_identifier_weight', 1.25),
  ('full_text_weight', 0.65),
  ('vector_weight', 0.30),
  ('object_type_weight', 0.08),
  ('investigation_context_weight', 0.12),
  ('recency_weight', 0.03),
  ('source_quality_weight', 0.05),
  ('popularity_weight', 0.01)
on conflict (config_key) do update set
  config_value = excluded.config_value,
  updated_at = now();

alter table search.ranking_config enable row level security;

drop policy if exists "search_ranking_config_read_public" on search.ranking_config;
create policy "search_ranking_config_read_public"
  on search.ranking_config for select
  using (true);

create table if not exists search.query_synonym (
  query_synonym_id bigint generated by default as identity primary key,
  source_phrase text not null,
  target_phrase text not null,
  language_code text not null default 'nl',
  metadata_origin text not null default 'curated',
  created_at timestamptz not null default now(),
  unique (source_phrase, target_phrase, language_code)
);

insert into search.query_synonym (source_phrase, target_phrase, language_code, metadata_origin) values
  ('externe inhuur', 'external consultancy consultancy inhuur', 'nl', 'curated'),
  ('external consultancy', 'externe inhuur consultancy', 'en', 'curated'),
  ('municipal spending', 'gemeentelijke uitgaven gemeente uitgaven', 'en', 'curated'),
  ('jeugdzorg uitgaven', 'jeugdzorg jeugd zorg uitgaven spending', 'nl', 'curated'),
  ('bouwen en wonen', 'woningvoorraad nieuwbouw huizenprijs huur koopwoning bouwvergunning housing construction dwellings homes', 'nl', 'curated'),
  ('housing', 'bouwen wonen woningvoorraad nieuwbouw woningen huizenprijs huur koopwoning', 'en', 'curated'),
  ('woningvoorraad', 'housing stock dwellings homes voorraad woningen', 'nl', 'curated'),
  ('housing stock', 'woningvoorraad woningen dwellings homes', 'en', 'curated'),
  ('nieuwbouw', 'new construction newly built dwellings building completions woningen gebouwd', 'nl', 'curated'),
  ('new construction', 'nieuwbouw newly built dwellings woningen gebouwd', 'en', 'curated'),
  ('bouwvergunning', 'building permit construction permit vergunning omgevingsvergunning', 'nl', 'curated'),
  ('building permits', 'bouwvergunning vergunningen construction permits omgevingsvergunning', 'en', 'curated'),
  ('huizenprijzen', 'house prices woningprijzen koopprijzen woningwaarde woz vastgoedwaarde', 'nl', 'curated'),
  ('house prices', 'huizenprijzen woningprijzen koopprijzen woningwaarde property value', 'en', 'curated'),
  ('huurwoningen', 'rental housing huur huurprijs rent rental dwellings', 'nl', 'curated'),
  ('rental housing', 'huurwoningen huur huurprijs rent rental dwellings', 'en', 'curated')
on conflict (source_phrase, target_phrase, language_code) do update set
  metadata_origin = excluded.metadata_origin;

alter table search.query_synonym enable row level security;

drop policy if exists "search_query_synonym_read_public" on search.query_synonym;
create policy "search_query_synonym_read_public"
  on search.query_synonym for select
  using (true);

drop function if exists public.guara_search_documents(text, text, integer, text[], uuid);
drop function if exists public.guara_search_documents(text, text, integer, text[], uuid, jsonb, boolean);
create or replace function public.guara_search_documents(
  search_query text,
  query_embedding text default null,
  match_count integer default 10,
  object_types text[] default null,
  investigation uuid default null,
  filters jsonb default '{}'::jsonb,
  development_mode boolean default false
)
returns table (
  search_document_id uuid,
  object_type text,
  object_id text,
  title text,
  subtitle text,
  description text,
  source_name text,
  dataset_code text,
  rank_score numeric,
  lexical_score numeric,
  vector_score numeric,
  exact_match_score numeric,
  object_type_boost numeric,
  investigation_context_boost numeric,
  recency_boost numeric,
  result_reason text,
  matched_terms text[],
  available_actions jsonb,
  score_explanation jsonb,
  source_quality text,
  popularity_score numeric,
  metadata jsonb
)
language sql
stable
security definer
set search_path = public, search
as $$
  with weights as (
    select
      coalesce(max(config_value) filter (where config_key = 'exact_identifier_weight'), 1.25) as exact_identifier_weight,
      coalesce(max(config_value) filter (where config_key = 'full_text_weight'), 0.65) as full_text_weight,
      coalesce(max(config_value) filter (where config_key = 'vector_weight'), 0.30) as vector_weight,
      coalesce(max(config_value) filter (where config_key = 'popularity_weight'), 0.01) as popularity_weight
    from search.ranking_config
  ),
  q as (
    select
      websearch_to_tsquery('simple', concat_ws(' ', coalesce(search_query, ''), (
        select string_agg(target_phrase, ' ')
        from search.query_synonym
        where lower(coalesce(search_query, '')) like '%' || lower(source_phrase) || '%'
      ))) as tsq,
      array(
        select token
        from regexp_split_to_table(lower(concat_ws(' ', coalesce(search_query, ''), (
          select string_agg(target_phrase, ' ')
          from search.query_synonym
          where lower(coalesce(search_query, '')) like '%' || lower(source_phrase) || '%'
        ))), '[^[:alnum:]]+') as token
        where length(token) >= 3
      ) as tokens,
      array(
        select token
        from regexp_split_to_table(lower(coalesce(search_query, '')), '[^[:alnum:]]+') as token
        where length(token) >= 3
      ) as original_tokens,
      lower(trim(coalesce(search_query, ''))) as normalized_query,
      case
        when nullif(query_embedding, '') is null then null
        else query_embedding::vector(64)
      end as embedding
  ),
  scored as (
    select
      d.search_document_id,
      d.object_type,
      d.object_id,
      d.title,
      d.subtitle,
      d.description,
      d.source_name,
      d.dataset_code,
      d.source_quality,
      d.popularity_score,
      d.metadata,
      case
        when lower(coalesce(d.object_code, '')) = q.normalized_query then 1
        when lower(coalesce(d.dataset_code, '')) = q.normalized_query then 1
        when lower(coalesce(d.object_id, '')) = q.normalized_query then 0.9
        else 0
      end as exact_match_score,
      (
        case when q.tsq @@ (
          setweight(to_tsvector('simple', concat_ws(' ', d.object_code, d.primary_name, d.title)), 'A') ||
          setweight(to_tsvector('simple', concat_ws(' ', d.synonyms_text, d.labels_text, d.subtitle)), 'B') ||
          setweight(to_tsvector('simple', coalesce(d.description, '')), 'C') ||
          setweight(to_tsvector('simple', concat_ws(' ', d.searchable_text, d.extended_metadata_text, d.examples_text)), 'D')
        ) then ts_rank_cd(
          setweight(to_tsvector('simple', concat_ws(' ', d.object_code, d.primary_name, d.title)), 'A') ||
          setweight(to_tsvector('simple', concat_ws(' ', d.synonyms_text, d.labels_text, d.subtitle)), 'B') ||
          setweight(to_tsvector('simple', coalesce(d.description, '')), 'C') ||
          setweight(to_tsvector('simple', concat_ws(' ', d.searchable_text, d.extended_metadata_text, d.examples_text)), 'D'),
          q.tsq
        ) else 0 end
        +
        case
          when exists (
            select 1 from unnest(q.tokens) token
            where lower(concat_ws(' ', d.searchable_text, d.title, d.object_code, d.dataset_code, d.synonyms_text)) like '%' || token || '%'
          ) then 0.05
          else 0
        end
        +
        case
          when exists (
            select 1 from unnest(q.original_tokens) token
            where lower(concat_ws(' ', d.object_code, d.dataset_code, d.primary_name, d.title)) like '%' || token || '%'
          ) then 0.20
          else 0
        end
        +
        coalesce((
          select (count(*)::numeric / greatest(array_length(q.original_tokens, 1), 1)) * 0.45
          from unnest(q.original_tokens) token
          where lower(concat_ws(' ', d.primary_name, d.title, d.synonyms_text)) like '%' || token || '%'
        ), 0)
      ) as lexical_score,
      case
        when q.embedding is not null and d.embedding is not null then 1 - (d.embedding <=> q.embedding)
        else 0
      end as vector_score,
      case d.object_type
        when 'metric' then 0.08
        when 'dataset' then 0.07
        when 'geography' then 0.06
        when 'saved_analysis' then 0.05
        else 0.02
      end as object_type_boost,
      case when investigation is not null and d.investigation_id = investigation then 0.12 else 0 end as investigation_context_boost,
      case
        when d.updated_at > now() - interval '30 days' then 0.03
        when d.updated_at > now() - interval '180 days' then 0.01
        else 0
      end as recency_boost,
      array(
        select token
        from unnest(q.tokens) token
        where lower(concat_ws(' ', d.title, d.subtitle, d.description, d.searchable_text, d.object_code, d.dataset_code, d.synonyms_text)) like '%' || token || '%'
      ) as matched_terms
    from search.search_document d
    cross join q
    where (object_types is null or d.object_type = any(object_types))
      and (
        d.investigation_id is null
        or (
          d.investigation_id = investigation
          and exists (
            select 1
            from answer.investigation_access access
            where access.investigation_id = d.investigation_id
              and access.user_id = auth.uid()
          )
        )
      )
      and (
        coalesce(d.metadata->>'visibility', 'global') not in ('private', 'shared')
        or (
          d.metadata->>'visibility' = 'private'
          and coalesce(d.metadata->>'author_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          and nullif(d.metadata->>'author_id', '')::uuid = auth.uid()
        )
        or (
          d.metadata->>'visibility' = 'shared'
          and d.investigation_id is not null
          and exists (
            select 1
            from answer.investigation_access access
            where access.investigation_id = d.investigation_id
              and access.user_id = auth.uid()
          )
        )
      )
      and (filters->>'dataset_code' is null or d.dataset_code = filters->>'dataset_code')
      and (filters->>'dataset_key' is null or d.dataset_key = (filters->>'dataset_key')::bigint)
      and (filters->>'source' is null or lower(coalesce(d.source_name, '')) = lower(filters->>'source'))
      and (filters->>'domain_id' is null or d.metadata->>'domain_id' = filters->>'domain_id')
      and (filters->>'searchable_domain' is null or d.metadata->>'searchable_domain' = filters->>'searchable_domain')
      and (filters->>'has_fact_data' is null or coalesce((d.metadata->>'has_fact_data')::boolean, false) = (filters->>'has_fact_data')::boolean)
      and (filters->>'source_layer' is null or d.metadata->>'source_layer' = filters->>'source_layer')
      and (filters->>'trusted_layer' is null or d.metadata->>'trusted_layer' = filters->>'trusted_layer')
      and (
        coalesce((filters->>'strict_gold_only')::boolean, false) = false
        or d.metadata->>'trusted_layer' in ('gold', 'semantic')
        or d.metadata->>'source_layer' = 'gold'
      )
      and (filters->>'language' is null or d.language_code = filters->>'language')
      and (filters->>'geography_type' is null or d.geography_type = filters->>'geography_type')
      and (filters->>'topic' is null or lower(coalesce(d.topic, '')) = lower(filters->>'topic'))
      and (filters->>'unit' is null or d.unit_code = filters->>'unit')
      and (filters->>'updated_after' is null or d.updated_at >= (filters->>'updated_after')::timestamptz)
      and (
        filters->>'year' is null
        or (d.year_start is not null and d.year_end is not null and (filters->>'year')::integer between d.year_start and d.year_end)
      )
      and (
        q.tsq @@ d.search_vector
        or q.embedding is not null
        or lower(coalesce(d.object_code, '')) = q.normalized_query
        or lower(coalesce(d.dataset_code, '')) = q.normalized_query
        or exists (
          select 1 from unnest(q.tokens) token
          where lower(concat_ws(' ', d.searchable_text, d.title, d.object_code, d.dataset_code, d.synonyms_text)) like '%' || token || '%'
        )
      )
  )
  select
    scored.search_document_id,
    scored.object_type,
    scored.object_id,
    scored.title,
    scored.subtitle,
    scored.description,
    scored.source_name,
    scored.dataset_code,
    round((
      (scored.exact_match_score * weights.exact_identifier_weight) +
      (scored.lexical_score * weights.full_text_weight) +
      (scored.vector_score * weights.vector_weight) +
      scored.object_type_boost +
      scored.investigation_context_boost +
      scored.recency_boost +
      (case scored.source_quality when 'curated' then 0.05 when 'source' then 0.04 when 'generated' then 0.02 else 0 end) +
      ((least(scored.popularity_score, 100) / 100) * weights.popularity_weight)
    )::numeric, 6) as rank_score,
    round(scored.lexical_score::numeric, 6) as lexical_score,
    round(scored.vector_score::numeric, 6) as vector_score,
    round(scored.exact_match_score::numeric, 6) as exact_match_score,
    round(scored.object_type_boost::numeric, 6) as object_type_boost,
    round(scored.investigation_context_boost::numeric, 6) as investigation_context_boost,
    round(scored.recency_boost::numeric, 6) as recency_boost,
    case
      when scored.exact_match_score >= 1 then 'Exact identifier match'
      when array_length(scored.matched_terms, 1) > 0 then 'Matched keyword: ' || scored.matched_terms[1]
      when scored.vector_score > 0 then 'Semantically similar metadata'
      when scored.investigation_context_boost > 0 then 'Used in the current investigation'
      else 'Ranked catalogue result'
    end as result_reason,
    scored.matched_terms,
    jsonb_build_array(
      case scored.object_type when 'dataset' then 'open_dataset' when 'metric' then 'inspect_metric' when 'geography' then 'open_entity' else 'open' end,
      'save_to_investigation'
    ) as available_actions,
    case when development_mode then jsonb_build_object(
      'exact_match_score', scored.exact_match_score,
      'lexical_score', scored.lexical_score,
      'vector_score', scored.vector_score,
      'object_type_boost', scored.object_type_boost,
      'investigation_context_boost', scored.investigation_context_boost,
      'recency_boost', scored.recency_boost,
      'popularity_score', scored.popularity_score
    ) else '{}'::jsonb end as score_explanation,
    scored.source_quality,
    scored.popularity_score,
    scored.metadata
  from scored
  cross join weights
  order by rank_score desc, scored.title asc
  limit greatest(1, least(coalesce(match_count, 10), 50));
$$;
