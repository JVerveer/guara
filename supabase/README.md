# Supabase Ingestion

Run `schema.sql` first for the app-facing public cache tables.

Run `bronze_schema.sql` next for raw CBS bronze tables:

```sql
-- Supabase SQL editor
-- paste supabase/bronze_schema.sql
```

In Supabase project settings, make sure the `bronze` schema is exposed to the API before running the ingestion job. Keep RLS enabled and do not add public policies to bronze tables; the job uses the service-role key.

The ingestion job writes:

- `bronze.cbs_catalog_tables`
- `bronze.cbs_data_properties`
- `bronze.cbs_dimension_values`
- `bronze.cbs_typed_dataset_rows` when using the all-data job
- `public.dataset_catalog`
- `public.dataset_dimensions`

Required local environment:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
```

Do not expose the service-role key in frontend code.

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
npm run ingest:cbs:bronze:all -- --query 2007 --limit 10 --max-rows-per-dataset 10000
npm run ingest:cbs:bronze:all -- --limit 25 --batch-size 1000
```

Options:

- `--limit 25`: number of CBS catalog tables to ingest.
- `--query "2007"`: CBS catalog search term. Searches title, description and catalog period.
- `--dataset 85039NED`: ingest one exact CBS table.
- `--dimensions-per-table 250`: cap dimension values stored per dimension.
- `--dry-run`: fetch and qualify without writing to Supabase.
- `--metadata-only`: with `ingest:cbs:bronze:all`, skip `TypedDataSet` rows.
- `--max-rows-per-dataset 5000`: with `ingest:cbs:bronze:all`, cap raw data rows per dataset. `0` means all rows.
- `--batch-size 1000`: with `ingest:cbs:bronze:all`, row page size for CBS and Supabase upserts.
- `--table-offset 100`: with `ingest:cbs:bronze:all`, skip catalog tables for resumable multi-run ingestion.
