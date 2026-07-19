# Guara dbt Semantic Profiles

This dbt project generates semantic dataset profiles from the Guara Gold layer.

The goal is to make Guara select the right measure, dimension, filters and grain for natural-language questions without hardcoding every dataset in TypeScript.

## Install

Use a local Python environment:

```bash
cd /Users/jordy/Guara
python3 -m venv .venv-dbt
source .venv-dbt/bin/activate
pip install dbt-postgres
```

## Configure Supabase

Guara's npm wrappers read `.env.local` and parse `SUPABASE_DB_URL` automatically.
If your `.env.local` already contains the Supabase Session pooler URI, you can run the npm commands directly.

dbt itself expects separate connection fields. If you want to call dbt manually instead of using the npm wrappers, use the Supabase Session pooler values:

```bash
export SUPABASE_DB_HOST="aws-0-<region>.pooler.supabase.com"
export SUPABASE_DB_PORT="5432"
export SUPABASE_DB_USER="postgres.kmwmbmpnipwygkvnqeai"
export SUPABASE_DB_PASSWORD="<your database password>"
export SUPABASE_DB_NAME="postgres"
export DBT_PROFILES_DIR="/Users/jordy/Guara/dbt"
```

Then create your local profile:

```bash
cp /Users/jordy/Guara/dbt/profiles.example.yml /Users/jordy/Guara/dbt/profiles.yml
```

Do not commit `profiles.yml`.

## Run

```bash
cd /Users/jordy/Guara/dbt
dbt debug
dbt run --select semantic
dbt test --select semantic
```

Or from the repo root with Guara's wrapper:

```bash
cd /Users/jordy/Guara
npm run dbt:debug
npm run dbt:semantic:build
```

For safe iteration, start with one dataset:

```bash
node scripts/run-dbt.mjs build --select semantic --vars '{semantic_dataset_code: 85035NED}'
```

For very large datasets, skip the fact scan first and generate a metadata-only contract:

```bash
node scripts/run-dbt.mjs build --select semantic --vars '{semantic_dataset_code: 85980NED, semantic_profile_facts: false}'
```

Then run the full domain when you are comfortable with the runtime:

```bash
npm run dbt:semantic:build
```

For a focused first check:

```bash
dbt run --select semantic_dataset_contract semantic_metric_dimension_compatibility
dbt test --select assert_85035_woningtype_contract
```

## Output Tables

dbt will build generated semantic tables in Supabase:

- `semantic.semantic_dataset_profile`
- `semantic.semantic_measure_profile`
- `semantic.semantic_dimension_profile`
- `semantic.semantic_category_profile`
- `semantic.semantic_grain_profile`
- `semantic.semantic_dataset_contract`
- `semantic.semantic_metric_dimension_compatibility`

These are generated profiles. Curated metadata should still live in the existing `semantic.metric_preference`, `semantic.metric_alias`, and future curated override tables.

## How Guara Should Use This

Runtime resolution should prefer:

1. curated metadata
2. dbt-generated semantic contracts
3. fuzzy search fallback

For example, `85035NED` should produce:

- default measure: `Beginstand woningvoorraad`
- breakdown dimension: `Woningtype`
- default qualifier: `Woningkenmerk = Totaal woningen`
- supported query shape: `category_breakdown`
