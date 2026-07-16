create extension if not exists pgcrypto;

create schema if not exists answer;

create table if not exists answer.investigation_access (
  investigation_id uuid not null,
  user_id uuid not null,
  access_level text not null default 'member',
  created_at timestamptz not null default now(),
  primary key (investigation_id, user_id)
);

create table if not exists answer.query_request (
  query_request_id uuid primary key default gen_random_uuid(),
  user_id uuid,
  investigation_id uuid,
  original_question text not null,
  normalized_question text,
  detected_language text,
  classified_intent text,
  classification_confidence numeric,
  permission_scope text not null default 'global',
  created_at timestamptz not null default now()
);

create table if not exists answer.query_resolution (
  query_resolution_id uuid primary key default gen_random_uuid(),
  query_request_id uuid not null references answer.query_request(query_request_id) on delete cascade,
  resolved_metric_id text,
  resolved_dimensions jsonb not null default '[]'::jsonb,
  resolved_filters jsonb not null default '[]'::jsonb,
  ambiguities jsonb not null default '[]'::jsonb,
  semantic_candidates jsonb not null default '[]'::jsonb,
  resolution_status text not null default 'resolved',
  created_at timestamptz not null default now()
);

create table if not exists answer.query_execution (
  query_execution_id uuid primary key default gen_random_uuid(),
  query_request_id uuid not null references answer.query_request(query_request_id) on delete cascade,
  query_plan_version text not null,
  query_plan jsonb not null,
  query_plan_hash text not null,
  compiled_sql text not null,
  compiled_sql_fingerprint text not null,
  compiled_parameters_redacted jsonb not null default '[]'::jsonb,
  execution_duration_ms integer,
  result_row_count integer,
  execution_status text not null,
  warnings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists answer.generated_answer (
  answer_id uuid primary key default gen_random_uuid(),
  query_request_id uuid not null references answer.query_request(query_request_id) on delete cascade,
  query_execution_id uuid references answer.query_execution(query_execution_id) on delete set null,
  answer_text text not null,
  answer_payload jsonb not null default '{}'::jsonb,
  result_snapshot jsonb not null default '{}'::jsonb,
  result_snapshot_status text not null default 'bounded_snapshot',
  warnings jsonb not null default '[]'::jsonb,
  model_provider text,
  model_name text,
  prompt_version text,
  created_at timestamptz not null default now()
);

create table if not exists answer.answer_source (
  answer_source_id uuid primary key default gen_random_uuid(),
  answer_id uuid not null references answer.generated_answer(answer_id) on delete cascade,
  dataset_key bigint,
  dataset_code text,
  dataset_version text,
  source_key bigint,
  source_name text,
  metric_id text,
  measure_key bigint,
  record_count bigint,
  source_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists answer.answer_feedback (
  feedback_id uuid primary key default gen_random_uuid(),
  answer_id uuid not null references answer.generated_answer(answer_id) on delete cascade,
  user_id uuid,
  rating text,
  feedback_type text not null,
  comment text,
  corrected_interpretation jsonb,
  created_at timestamptz not null default now(),
  constraint answer_feedback_type_chk check (
    feedback_type in (
      'helpful',
      'not_helpful',
      'wrong_metric',
      'wrong_filter',
      'wrong_period',
      'wrong_entity',
      'wrong_calculation',
      'missing_context',
      'other'
    )
  )
);

create table if not exists answer.saved_analysis (
  saved_analysis_id uuid primary key default gen_random_uuid(),
  investigation_id uuid,
  created_by uuid,
  answer_id uuid references answer.generated_answer(answer_id) on delete set null,
  title text not null,
  description text,
  original_question text not null,
  query_plan jsonb not null default '{}'::jsonb,
  display_configuration jsonb not null default '{}'::jsonb,
  result_snapshot jsonb not null default '{}'::jsonb,
  source_versions jsonb not null default '[]'::jsonb,
  version_status text not null default 'current',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists answer.saved_analysis_link (
  saved_analysis_link_id uuid primary key default gen_random_uuid(),
  saved_analysis_id uuid not null references answer.saved_analysis(saved_analysis_id) on delete cascade,
  link_type text not null,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint saved_analysis_link_type_chk check (
    link_type in ('hypothesis', 'claim', 'chart', 'evidence', 'story_section', 'task')
  )
);

create table if not exists answer.answer_cache (
  cache_key text primary key,
  normalized_question text not null,
  query_plan_hash text not null,
  dataset_versions jsonb not null default '[]'::jsonb,
  permission_scope text not null,
  answer_id uuid not null references answer.generated_answer(answer_id) on delete cascade,
  is_historical boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create table if not exists answer.search_telemetry (
  search_telemetry_id uuid primary key default gen_random_uuid(),
  user_id uuid,
  investigation_id uuid,
  workspace_id uuid,
  normalized_query text not null,
  query_language text,
  classified_intent text,
  selected_result_id text,
  clicked_result_id text,
  search_duration_ms integer,
  zero_result boolean not null default false,
  filters jsonb not null default '{}'::jsonb,
  resolved_metric_id text,
  answer_status text,
  answer_success boolean,
  user_correction jsonb,
  created_at timestamptz not null default now()
);

create index if not exists answer_query_request_user_idx
  on answer.query_request(user_id, created_at desc);

create index if not exists answer_query_request_investigation_idx
  on answer.query_request(investigation_id, created_at desc);

create index if not exists answer_query_request_normalized_idx
  on answer.query_request(normalized_question);

create index if not exists answer_query_resolution_request_idx
  on answer.query_resolution(query_request_id);

create index if not exists answer_query_execution_request_idx
  on answer.query_execution(query_request_id, created_at desc);

create index if not exists answer_query_execution_plan_hash_idx
  on answer.query_execution(query_plan_hash);

create index if not exists answer_generated_answer_request_idx
  on answer.generated_answer(query_request_id, created_at desc);

create index if not exists answer_answer_source_answer_idx
  on answer.answer_source(answer_id);

create index if not exists answer_answer_source_dataset_idx
  on answer.answer_source(dataset_code);

create index if not exists answer_saved_analysis_investigation_idx
  on answer.saved_analysis(investigation_id, updated_at desc);

create index if not exists answer_saved_analysis_created_by_idx
  on answer.saved_analysis(created_by, updated_at desc);

create index if not exists answer_search_telemetry_query_idx
  on answer.search_telemetry(normalized_query, created_at desc);

create index if not exists answer_search_telemetry_intent_idx
  on answer.search_telemetry(classified_intent, created_at desc);

alter table answer.investigation_access enable row level security;
alter table answer.query_request enable row level security;
alter table answer.query_resolution enable row level security;
alter table answer.query_execution enable row level security;
alter table answer.generated_answer enable row level security;
alter table answer.answer_source enable row level security;
alter table answer.answer_feedback enable row level security;
alter table answer.saved_analysis enable row level security;
alter table answer.saved_analysis_link enable row level security;
alter table answer.answer_cache enable row level security;
alter table answer.search_telemetry enable row level security;

drop policy if exists "answer_investigation_access_read_own" on answer.investigation_access;
create policy "answer_investigation_access_read_own"
  on answer.investigation_access for select
  using (user_id = auth.uid());

drop policy if exists "answer_investigation_access_write_own" on answer.investigation_access;
create policy "answer_investigation_access_write_own"
  on answer.investigation_access for insert
  with check (user_id = auth.uid());

drop policy if exists "answer_query_request_read_permitted" on answer.query_request;
create policy "answer_query_request_read_permitted"
  on answer.query_request for select
  using (
    user_id is null
    or user_id = auth.uid()
    or (
      investigation_id is not null
      and exists (
        select 1
        from answer.investigation_access access
        where access.investigation_id = query_request.investigation_id
          and access.user_id = auth.uid()
      )
    )
  );

drop policy if exists "answer_query_request_insert_own" on answer.query_request;
create policy "answer_query_request_insert_own"
  on answer.query_request for insert
  with check (user_id is null or user_id = auth.uid());

drop policy if exists "answer_query_resolution_read_permitted" on answer.query_resolution;
create policy "answer_query_resolution_read_permitted"
  on answer.query_resolution for select
  using (
    exists (
      select 1
      from answer.query_request request
      where request.query_request_id = query_resolution.query_request_id
    )
  );

drop policy if exists "answer_query_resolution_insert_permitted" on answer.query_resolution;
create policy "answer_query_resolution_insert_permitted"
  on answer.query_resolution for insert
  with check (
    exists (
      select 1
      from answer.query_request request
      where request.query_request_id = query_resolution.query_request_id
    )
  );

drop policy if exists "answer_query_execution_read_permitted" on answer.query_execution;
create policy "answer_query_execution_read_permitted"
  on answer.query_execution for select
  using (
    exists (
      select 1
      from answer.query_request request
      where request.query_request_id = query_execution.query_request_id
    )
  );

drop policy if exists "answer_query_execution_insert_permitted" on answer.query_execution;
create policy "answer_query_execution_insert_permitted"
  on answer.query_execution for insert
  with check (
    exists (
      select 1
      from answer.query_request request
      where request.query_request_id = query_execution.query_request_id
    )
  );

drop policy if exists "answer_generated_answer_read_permitted" on answer.generated_answer;
create policy "answer_generated_answer_read_permitted"
  on answer.generated_answer for select
  using (
    exists (
      select 1
      from answer.query_request request
      where request.query_request_id = generated_answer.query_request_id
    )
  );

drop policy if exists "answer_generated_answer_insert_permitted" on answer.generated_answer;
create policy "answer_generated_answer_insert_permitted"
  on answer.generated_answer for insert
  with check (
    exists (
      select 1
      from answer.query_request request
      where request.query_request_id = generated_answer.query_request_id
    )
  );

drop policy if exists "answer_source_read_permitted" on answer.answer_source;
create policy "answer_source_read_permitted"
  on answer.answer_source for select
  using (
    exists (
      select 1
      from answer.generated_answer generated
      where generated.answer_id = answer_source.answer_id
    )
  );

drop policy if exists "answer_source_insert_permitted" on answer.answer_source;
create policy "answer_source_insert_permitted"
  on answer.answer_source for insert
  with check (
    exists (
      select 1
      from answer.generated_answer generated
      where generated.answer_id = answer_source.answer_id
    )
  );

drop policy if exists "answer_feedback_read_own" on answer.answer_feedback;
create policy "answer_feedback_read_own"
  on answer.answer_feedback for select
  using (user_id is null or user_id = auth.uid());

drop policy if exists "answer_feedback_insert_own" on answer.answer_feedback;
create policy "answer_feedback_insert_own"
  on answer.answer_feedback for insert
  with check (user_id is null or user_id = auth.uid());

drop policy if exists "answer_saved_analysis_read_permitted" on answer.saved_analysis;
create policy "answer_saved_analysis_read_permitted"
  on answer.saved_analysis for select
  using (
    created_by is null
    or created_by = auth.uid()
    or (
      investigation_id is not null
      and exists (
        select 1
        from answer.investigation_access access
        where access.investigation_id = saved_analysis.investigation_id
          and access.user_id = auth.uid()
      )
    )
  );

drop policy if exists "answer_saved_analysis_write_own" on answer.saved_analysis;
create policy "answer_saved_analysis_write_own"
  on answer.saved_analysis for all
  using (created_by is null or created_by = auth.uid())
  with check (created_by is null or created_by = auth.uid());

drop policy if exists "answer_saved_analysis_link_read_permitted" on answer.saved_analysis_link;
create policy "answer_saved_analysis_link_read_permitted"
  on answer.saved_analysis_link for select
  using (
    exists (
      select 1
      from answer.saved_analysis analysis
      where analysis.saved_analysis_id = saved_analysis_link.saved_analysis_id
    )
  );

drop policy if exists "answer_saved_analysis_link_write_permitted" on answer.saved_analysis_link;
create policy "answer_saved_analysis_link_write_permitted"
  on answer.saved_analysis_link for all
  using (
    exists (
      select 1
      from answer.saved_analysis analysis
      where analysis.saved_analysis_id = saved_analysis_link.saved_analysis_id
    )
  )
  with check (
    exists (
      select 1
      from answer.saved_analysis analysis
      where analysis.saved_analysis_id = saved_analysis_link.saved_analysis_id
    )
  );

drop policy if exists "answer_cache_read_public" on answer.answer_cache;
create policy "answer_cache_read_public"
  on answer.answer_cache for select
  using (true);

drop policy if exists "answer_search_telemetry_insert" on answer.search_telemetry;
create policy "answer_search_telemetry_insert"
  on answer.search_telemetry for insert
  with check (user_id is null or user_id = auth.uid());

drop policy if exists "answer_search_telemetry_read_own" on answer.search_telemetry;
create policy "answer_search_telemetry_read_own"
  on answer.search_telemetry for select
  using (user_id is null or user_id = auth.uid());

drop function if exists public.guara_record_search_telemetry(text, text, text, integer, boolean, jsonb, uuid, uuid, uuid, boolean);
create or replace function public.guara_record_search_telemetry(
  normalized_query text,
  query_language text default null,
  classified_intent text default null,
  search_duration_ms integer default null,
  zero_result boolean default false,
  filters jsonb default '{}'::jsonb,
  investigation_id uuid default null,
  workspace_id uuid default null,
  selected_result_id text default null,
  answer_success boolean default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, answer
as $$
declare
  next_id uuid;
begin
  insert into answer.search_telemetry (
    user_id,
    investigation_id,
    workspace_id,
    normalized_query,
    query_language,
    classified_intent,
    selected_result_id,
    search_duration_ms,
    zero_result,
    filters,
    answer_success
  )
  values (
    auth.uid(),
    investigation_id,
    workspace_id,
    normalized_query,
    query_language,
    classified_intent,
    selected_result_id,
    search_duration_ms,
    coalesce(zero_result, false),
    coalesce(filters, '{}'::jsonb),
    answer_success
  )
  returning search_telemetry_id into next_id;

  return next_id;
end;
$$;

drop function if exists public.guara_save_answer_analysis(uuid, text, text, jsonb);
create or replace function public.guara_save_answer_analysis(
  answer_id uuid,
  title text default null,
  description text default null,
  display_configuration jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, answer
as $$
declare
  next_id uuid;
begin
  insert into answer.saved_analysis (
    investigation_id,
    created_by,
    answer_id,
    title,
    description,
    original_question,
    query_plan,
    display_configuration,
    result_snapshot,
    source_versions
  )
  select
    request.investigation_id,
    auth.uid(),
    generated.answer_id,
    coalesce(nullif(title, ''), left(request.original_question, 120)),
    description,
    request.original_question,
    coalesce(execution.query_plan, '{}'::jsonb),
    coalesce(display_configuration, '{}'::jsonb),
    generated.result_snapshot,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'dataset_key', source.dataset_key,
            'dataset_code', source.dataset_code,
            'dataset_version', source.dataset_version,
            'source_key', source.source_key,
            'source_name', source.source_name,
            'metric_id', source.metric_id,
            'measure_key', source.measure_key,
            'record_count', source.record_count
          )
        )
        from answer.answer_source source
        where source.answer_id = generated.answer_id
      ),
      '[]'::jsonb
    )
  from answer.generated_answer generated
  join answer.query_request request on request.query_request_id = generated.query_request_id
  left join answer.query_execution execution on execution.query_execution_id = generated.query_execution_id
  where generated.answer_id = guara_save_answer_analysis.answer_id
  returning saved_analysis_id into next_id;

  return next_id;
end;
$$;

drop function if exists public.guara_record_answer_feedback(uuid, text, text, text, jsonb);
create or replace function public.guara_record_answer_feedback(
  answer_id uuid,
  rating text,
  feedback_type text,
  comment text default null,
  corrected_interpretation jsonb default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, answer
as $$
declare
  next_id uuid;
begin
  insert into answer.answer_feedback (
    answer_id,
    user_id,
    rating,
    feedback_type,
    comment,
    corrected_interpretation
  )
  values (
    answer_id,
    auth.uid(),
    rating,
    feedback_type,
    comment,
    corrected_interpretation
  )
  returning feedback_id into next_id;

  return next_id;
end;
$$;

drop function if exists public.guara_convert_saved_analysis_to_evidence(uuid, text, jsonb);
create or replace function public.guara_convert_saved_analysis_to_evidence(
  saved_analysis_id uuid,
  target_id text default null,
  metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, answer
as $$
declare
  next_id uuid;
begin
  insert into answer.saved_analysis_link (
    saved_analysis_id,
    link_type,
    target_id,
    metadata
  )
  values (
    saved_analysis_id,
    'evidence',
    target_id,
    coalesce(metadata, '{}'::jsonb)
  )
  returning saved_analysis_link_id into next_id;

  return next_id;
end;
$$;
