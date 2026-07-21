#!/usr/bin/env node
import { createPostgresClient, explainPostgresConnectionError, loadLocalEnv } from "./lib/runtime.mjs";

function argValue(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

async function loadDimensionContracts(client, { domain, dataset }) {
  const params = [domain, dataset];
  const { rowCount } = await client.query(`
    with source_dimensions as (
      select
        dp.dataset_code,
        coalesce(dc.domain_id, $1) as domain_id,
        dp.dimension_code,
        initcap(replace(dp.dimension_code, '_', ' ')) as label,
        dp.dimension_role,
        dp.has_total_category,
        dp.total_category_names,
        coalesce(
          jsonb_agg(
            jsonb_build_object(
              'category_code', cp.category_code,
              'category_name', cp.category_name,
              'is_total', cp.is_total,
              'is_unknown', cp.is_unknown,
              'default_filter_priority', cp.default_filter_priority
            )
            order by cp.default_filter_priority desc, cp.category_name
          ) filter (where cp.category_key is not null),
          '[]'::jsonb
        ) as valid_values
      from semantic.semantic_dimension_profile dp
      left join semantic.semantic_category_profile cp
        on cp.dataset_code = dp.dataset_code
       and cp.dimension_code = dp.dimension_code
      left join semantic.semantic_dataset_contract dc
        on dc.dataset_code = dp.dataset_code
      where ($1::text is null or coalesce(dc.domain_id, $1) = $1)
        and ($2::text is null or dp.dataset_code = $2)
      group by
        dp.dataset_code,
        coalesce(dc.domain_id, $1),
        dp.dimension_code,
        dp.dimension_role,
        dp.has_total_category,
        dp.total_category_names
    )
    insert into semantic.dimension_contract (
      dimension_code,
      dataset_code,
      domain_id,
      label,
      description,
      dimension_role,
      canonical_total_value,
      valid_values,
      value_synonyms,
      resolution_rules,
      supports_grouping,
      supports_filtering,
      metadata_origin,
      contract_status,
      is_active,
      updated_at
    )
    select
      dimension_code,
      dataset_code,
      domain_id,
      label,
      'Generated dimension contract from semantic dimension/category profiles.',
      dimension_role,
      total_category_names[1],
      valid_values,
      '{}'::jsonb,
      jsonb_build_object(
        'total_value', total_category_names[1],
        'has_total_category', has_total_category,
        'category_count', jsonb_array_length(valid_values)
      ),
      dimension_role <> 'time',
      dimension_role <> 'time',
      'generated',
      case when dimension_role in ('category', 'geography') then 'profiled' else 'generated' end,
      true,
      now()
    from source_dimensions
    on conflict (domain_id, dataset_code, dimension_code) do update set
      label = case when semantic.dimension_contract.metadata_origin = 'curated' then semantic.dimension_contract.label else excluded.label end,
      description = case when semantic.dimension_contract.metadata_origin = 'curated' then semantic.dimension_contract.description else excluded.description end,
      dimension_role = case when semantic.dimension_contract.metadata_origin = 'curated' then semantic.dimension_contract.dimension_role else excluded.dimension_role end,
      canonical_total_value = case when semantic.dimension_contract.metadata_origin = 'curated' then semantic.dimension_contract.canonical_total_value else excluded.canonical_total_value end,
      valid_values = case when semantic.dimension_contract.metadata_origin = 'curated' then semantic.dimension_contract.valid_values else excluded.valid_values end,
      resolution_rules = case when semantic.dimension_contract.metadata_origin = 'curated' then semantic.dimension_contract.resolution_rules else excluded.resolution_rules end,
      supports_grouping = case when semantic.dimension_contract.metadata_origin = 'curated' then semantic.dimension_contract.supports_grouping else excluded.supports_grouping end,
      supports_filtering = case when semantic.dimension_contract.metadata_origin = 'curated' then semantic.dimension_contract.supports_filtering else excluded.supports_filtering end,
      contract_status = case when semantic.dimension_contract.metadata_origin = 'curated' then semantic.dimension_contract.contract_status else excluded.contract_status end,
      is_active = true,
      updated_at = now()
  `, params);
  return rowCount ?? 0;
}

async function main() {
  loadLocalEnv();
  const client = createPostgresClient({
    applicationName: "guara-semantic-dimension-contract-loader",
    statementTimeoutMs: 600000,
    queryTimeoutMs: 600000,
  });
  await client.connect();
  try {
    const domain = argValue("domain", "bouwen-en-wonen");
    const dataset = argValue("dataset", null);
    const count = await loadDimensionContracts(client, { domain, dataset });
    await client.query("notify pgrst, 'reload schema'");
    console.log(`Loaded semantic dimension contracts: ${count} upserted${dataset ? ` for ${dataset}` : ""}.`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(explainPostgresConnectionError(error));
  process.exitCode = 1;
});
