# Guara Gold Layer

The Gold layer is Guara's analytical source for evidence-backed research. It is not a copy of Silver: Silver remains source-specific and normalized, while Gold exposes stable dimensions, reusable measures, explicit grains, and semantic metadata for investigation workflows.

## Schemas

Run `supabase/gold_schema.sql` to create:

- `gold`: dimensional tables, facts, load runs, and validation results.
- `semantic`: metric definitions, dimensions, synonyms, caveats, and definition versions.

The conformed Gold dimension loader is:

```bash
npm run load:cbs:gold:dimensions -- --ensure-schema --domain bouwen-en-wonen --limit 100
```

It populates shared dimensions from Silver without loading facts. The generic Gold fact loader is:

```bash
npm run load:cbs:gold -- --ensure-schema --domain bouwen-en-wonen --limit 10
```

The first domain-specific mart is `gold_bouwen_wonen`. It loads directly from Silver into shared conformed Gold dimensions and Bouwen en wonen facts:

```bash
npm run load:cbs:gold:bouwen-en-wonen -- --ensure-schema --limit 100
```

For Bouwen en wonen, this direct mart loader is the preferred path. It does not require `gold.fact_observation` to be populated first.

After dimensions and marts are loaded, refresh the semantic catalogue:

```bash
npm run load:semantic:catalogue -- --ensure-schema --domain bouwen-en-wonen
```

The homepage search uses `public.guara_hybrid_search` and `public.guara_execute_query_plan` for controlled natural-language answering. Query plans are structured JSON and are validated by the database RPC before execution.

## Grain

| Table | Grain |
| --- | --- |
| `gold.dim_date` | One row per reporting period code and period type. |
| `gold.dim_geography` | One row per source geography code, geography type, source system, and validity start date. |
| `gold.dim_dataset` | One row per source dataset version. |
| `gold.dim_measure` | One row per dataset-specific analytical measure. |
| `gold.dim_unit` | One row per normalized unit. |
| `gold.dim_category` | One row per non-date, non-geography CBS dimension value within a dataset. |
| `gold.fact_observation` | One row per dataset, measure, date, geography, category combination, and source observation. |
| `gold.bridge_observation_category` | One row per fact observation and category member. |
| `gold_bouwen_wonen.dim_housing_dataset` | One row per Bouwen en wonen dataset version loaded into Gold. |
| `gold_bouwen_wonen.dim_housing_indicator` | One row per Bouwen en wonen measure loaded into Gold. |
| `gold_bouwen_wonen.fact_housing_observation` | One row per Bouwen en wonen Silver observation measure, linked to conformed Gold dimensions and denormalized with period and geography fields for fast investigation queries. |
| `gold_bouwen_wonen.bridge_housing_observation_category` | Category membership for each housing fact observation. |

## Lineage

Generic `gold.fact_observation` stores:

- `source_observation_id`: the Silver/CBS row identifier.
- `silver_observation_id`: a stable pointer back to Silver.
- `bronze_record_id`: the source-aligned Bronze lineage pointer currently derived from the Silver row.
- `ingestion_run_id`: the Bronze ingestion run id where available.
- `record_hash`: a deterministic hash of the analytical grain and source value.

## Loader Behavior

`scripts/load-cbs-gold.mjs` reads only from Silver. It never calls CBS APIs directly.

The loader:

- Filters by `--dataset`, `--domain`, or `--root-theme`.
- Runs one transaction per dataset.
- Skips already completed dataset versions by default.
- Uses `--force` to reload an existing Gold dataset version.
- Uses `--failed-only` to retry failed Gold loads.
- Uses `--validate-only` to run validations without loading facts.
- Continues to the next dataset after a failure.

## Validation

Each load writes `gold.validation_result` checks for:

- Fact grain uniqueness.
- Bridge referential integrity.
- Fact coverage versus Silver source observation count.

Example:

```sql
select dataset_code, check_name, status, expected_value, actual_value, message
from gold.validation_result
order by checked_at desc
limit 100;
```

## Semantic Layer

For each Gold measure, the loader creates a `semantic.metric` row and supporting synonyms. This is the starting point for Guara's natural-language data questions, evidence finder, contradiction checks, and hypothesis workflows.
