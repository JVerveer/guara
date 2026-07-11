# Supabase Ingestion

Run `schema.sql` first for the app-facing public cache tables, source summaries, and public quality checks.

Run `bronze_schema.sql` next for raw CBS bronze tables:

```sql
-- Supabase SQL editor
-- paste supabase/bronze_schema.sql
```

Run `silver_schema.sql` after your Silver base tables exist. This migration adds lineage, quality checks, expected row counts, schema snapshots, source-normalized period/region metadata, indicator candidates, domain mappings, dataset grain, and Gold readiness without recreating loaded Silver data:

```sql
-- Supabase SQL editor
-- paste supabase/silver_schema.sql
```

For larger Bronze loads, also run `bronze_performance.sql`. It removes a redundant raw-row index, adds a faster resume index, tunes autovacuum for the large JSONB row table, and includes an optional cleanup for duplicated TypedDataSet batch payloads from older runs:

```sql
-- Supabase SQL editor
-- paste supabase/bronze_performance.sql
```

In Supabase project settings, make sure the `bronze` schema is exposed to the API before running the ingestion job. Keep RLS enabled and do not add public policies to bronze tables; the job uses the service-role key.

The ingestion job writes:

- `bronze.cbs_catalog_tables`
- `bronze.cbs_data_properties`
- `bronze.cbs_dimension_values`
- `bronze.cbs_themes`
- `bronze.cbs_table_themes`
- `bronze.cbs_theme_hierarchy`
- `bronze.cbs_dataset_theme_hierarchy`
- `bronze.cbs_featured`
- `bronze.cbs_table_featured`
- `bronze.cbs_typed_dataset_rows` when using the all-data job
- `bronze.cbs_raw_endpoint_payloads`
- `bronze.cbs_ingestion_runs`
- `bronze.cbs_dataset_ingestion_status`
- `bronze.cbs_schema_snapshots`
- `public.dataset_catalog`
- `public.dataset_dimensions`
- `public.dataset_preview_rows` with a capped 25-row app preview
- `public.silver_dataset_catalog` with app-safe metadata for datasets that have been loaded into Silver
- `public.source_layer_summary` for Source Browser Bronze/Silver tiles
- `public.dataset_quality_checks` for inspectable ingestion quality checks

Required local environment:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
```

Do not expose the service-role key in frontend code.

The Guara frontend reads from the public tables only. It does not call the CBS APIs during exploration and it does not expose raw Bronze or relational Silver tables to the browser. Re-run `schema.sql` after pulling changes so `public.dataset_preview_rows`, `public.silver_dataset_catalog`, `public.source_layer_summary`, and `public.dataset_quality_checks` exist before expecting previews, Source Browser metadata, or Silver-only dataset listings in the app.

Example commands:

```bash
npm run ingest:cbs:bronze -- --dry-run --limit 5
npm run ingest:cbs:bronze -- --dataset 85039NED
npm run ingest:cbs:bronze -- --query 2007 --limit 25
npm run ingest:cbs:bronze -- --limit 100
```

Full bronze row ingestion:

```bash
npm run ingest:cbs:bronze:all -- --dry-run --dataset 85039NED
npm run ingest:cbs:bronze:all -- --dataset 85039NED --max-rows-per-dataset 5000
npm run ingest:cbs:bronze:all -- --dataset 85039NED --metadata-only
npm run ingest:cbs:bronze:all -- --all --metadata-only
npm run ingest:cbs:bronze:all -- --all --classification-only
npm run ingest:cbs:bronze:all -- --query 2007 --limit 10 --max-rows-per-dataset 10000
npm run ingest:cbs:bronze:all -- --limit 25 --batch-size 2000
npm run ingest:cbs:bronze:all -- --dataset 85322NED --batch-size 2000 --upsert-batch-size 100
```

Fast direct-Postgres Bronze row ingestion:

```bash
npm run ingest:cbs:bronze:fast -- --dry-run --dataset 85039NED
npm run ingest:cbs:bronze:fast -- --dataset 85039NED --max-rows-per-dataset 100000
npm run ingest:cbs:bronze:fast -- --failed-only --limit 25 --batch-size 5000
```

The fast path requires `SUPABASE_DB_URL` in `.env.local`. It uses the CBS ODataFeed endpoint for `TypedDataSet` rows, then writes batches through a direct Postgres connection into `bronze.cbs_typed_dataset_rows` using `bronze.cbs_typed_dataset_rows_stage` and a SQL merge. Use the normal `ingest:cbs:bronze:all -- --metadata-only` flow first for catalog metadata, properties, dimensions, themes, featured metadata, and public previews; use `ingest:cbs:bronze:fast` when the bottleneck is raw row loading.

Bronze coverage overview:

```bash
npm run overview:cbs:bronze
npm run overview:cbs:bronze -- --query wijken --limit 50
npm run overview:cbs:bronze -- --dataset 85039NED
npm run overview:cbs:bronze -- --all --write-json
npm run overview:cbs:bronze -- --all --skip-api-counts
```

The overview scans CBS StatLine catalog metadata, compares it with Bronze ingestion status, and reports API record count, Bronze rows loaded, percentage loaded, partial/completed state, and ingestion errors where available.

Silver coverage overview:

```bash
npm run overview:cbs:silver
npm run overview:cbs:silver -- --query wijken --limit 50
npm run overview:cbs:silver -- --dataset 85039NED
npm run overview:cbs:silver -- --domain bouwen-en-wonen --limit 50
npm run overview:cbs:silver -- --root-theme "Bouwen en wonen" --limit 50
npm run overview:cbs:silver -- --limit 500 --write-json
```

The Silver overview scans datasets currently available in Bronze, compares them with Silver load status, and reports Bronze API record count, Bronze raw rows loaded, Silver observations loaded, percentage loaded from Bronze to Silver, partial/completed state, rejected rows, and Silver load errors where available.
Both Silver loading and Silver coverage overview are handled by `scripts/load-cbs-silver.mjs`; `overview:cbs:silver` is a convenience wrapper that runs that script in overview mode.

Silver loading by CBS root theme:

```bash
npm run plan:cbs:silver -- --domain bouwen-en-wonen --limit 100
npm run load:cbs:silver -- --domain bouwen-en-wonen --limit 25
npm run plan:cbs:silver -- --query "Bouwen en wonen" --limit 100
npm run load:cbs:silver -- --root-theme "Bouwen en wonen" --limit 25
npm run load:cbs:silver -- --root-theme "Bouwen en wonen" --limit 25 --metadata-only
```

Silver metadata enrichment:

- `silver.cbs_period_values` parses CBS `Perioden` dimension keys into year, period type, and approximate date bounds.
- `silver.cbs_region_values` classifies recognizable CBS geography values as country, province, municipality, neighborhood, or other.
- `silver.cbs_dataset_grain` stores the dataset grain: year coverage, period types, spatial levels, spatial coverage, and classification confidence.
- `silver.cbs_indicator_candidates` stores source-specific candidate indicators from CBS DataProperties.
- `silver.cbs_domains` and `silver.cbs_dataset_domains` persist Guara/CBS domain mappings from CBS root themes.
- `silver.cbs_gold_readiness` scores Silver datasets as Gold modelling candidates.

To backfill these enrichment tables for already-loaded datasets without loading observation rows again:

```bash
npm run load:cbs:silver -- --dataset 85039NED --metadata-only --no-skip-unchanged
npm run load:cbs:silver -- --domain bouwen-en-wonen --limit 100 --metadata-only --no-skip-unchanged
npm run load:cbs:silver -- --root-theme "Nederland regionaal" --limit 100 --metadata-only --no-skip-unchanged
```

Canonical Guara domains are defined in `config/cbs-domains.json`. They use CBS root themes as the domain backbone, so `--domain bouwen-en-wonen` resolves to `--root-theme "Bouwen en wonen"`. `--root-theme` uses `bronze.cbs_dataset_theme_hierarchy.top_theme_title`, so run the latest `supabase/bronze_schema.sql` before relying on theme-based Silver loads.

CBS catalog paging is explicit and deterministic: Dutch catalog tables are requested with `Language eq 'nl'` and `$orderby=ID asc`. This makes `--table-offset` stable across resumed batches unless CBS changes catalog contents.

CBS theme hierarchy:

- `bronze.cbs_theme_hierarchy` resolves CBS parent/child theme paths from `bronze.cbs_themes`.
- `bronze.cbs_dataset_theme_hierarchy` links each dataset to its assigned theme, top-level theme, and full theme path.
- `npm run plan:cbs:silver` uses this hierarchy when scoring and filtering Silver load candidates. If the view has not been applied yet, the planner falls back to building the hierarchy in memory from `bronze.cbs_themes` and `bronze.cbs_table_themes`.

Useful theme query:

```sql
select
  top_theme_title,
  assigned_theme_title,
  count(distinct dataset_id) as datasets
from bronze.cbs_dataset_theme_hierarchy
group by top_theme_title, assigned_theme_title
order by top_theme_title, datasets desc;
```

Options:

- `--limit 25`: number of CBS catalog tables to ingest.
- `--query "2007"`: CBS catalog search term. Searches title, description and catalog period.
- `--dataset 85039NED`: ingest one exact CBS table.
- `--dimensions-per-table 250`: cap dimension values stored per dimension.
- `--dry-run`: fetch and qualify without writing to Supabase.
- `--metadata-only`: with `ingest:cbs:bronze:all`, skip `TypedDataSet` rows while refreshing catalog metadata, DataProperties, dimensions, CBS Themes, CBS Tables_Themes links, Featured groups, and Table_Featured links.
- `--classification-only`: with `ingest:cbs:bronze:all`, only refresh CBS Themes, CBS Tables_Themes links, Featured groups, and Table_Featured links. Use this to backfill classification metadata over already-ingested datasets without refetching DataProperties, dimensions, counts, or rows.
- `--max-rows-per-dataset 5000`: with `ingest:cbs:bronze:all`, cap raw data rows per dataset. `0` means all rows.
- `--batch-size 2000`: with `ingest:cbs:bronze:all`, row page size for CBS and Supabase upserts.
- `--upsert-batch-size 100`: with `ingest:cbs:bronze:all`, Supabase write chunk size. Lower this for very wide CBS datasets with hundreds of properties.
- `--table-offset 100`: with `ingest:cbs:bronze:all`, skip catalog tables for resumable multi-run ingestion.
- `--store-typed-batch-payloads`: with `ingest:cbs:bronze:all`, also store full CBS TypedDataSet batch responses in `bronze.cbs_raw_endpoint_payloads`. This is off by default for performance because rows are already stored in `bronze.cbs_typed_dataset_rows`.
- `--exact-counts`: with Bronze overview mode, count raw rows directly. This is slower on large Bronze tables; stored status counts are used by default.
