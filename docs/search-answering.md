# Guara Search and Analytical Answering

Guara search has two modes.

Discovery search helps users find datasets, metrics, dimensions, geographies, sources, notes, claims and saved analyses. It must keep working when an LLM provider is unavailable. Keyword search must keep working when embeddings are unavailable.

Analytical answering turns a natural-language question into a controlled structured query plan, validates it, compiles deterministic SQL against approved Gold tables, executes it, validates the result and stores provenance.

## Architecture

The core flow is:

1. Normalize text.
2. Classify intent.
3. Retrieve semantic catalogue candidates.
4. Resolve metrics, dimensions, filters and calculation.
5. Produce a structured query plan.
6. Validate metric, dimension, unit, time and aggregation safety.
7. Compile SQL deterministically.
8. Execute with row and timeout limits.
9. Validate result shape.
10. Generate an evidence-backed answer.
11. Store request, resolution, execution, answer, sources and feedback.

The application must never send unrestricted model-written SQL to the database.

## Database Schemas

Search documents live in `search.search_document`.

Answer provenance lives in:

- `answer.query_request`
- `answer.query_resolution`
- `answer.query_execution`
- `answer.generated_answer`
- `answer.answer_source`
- `answer.answer_feedback`
- `answer.saved_analysis`
- `answer.saved_analysis_link`
- `answer.answer_cache`
- `answer.search_telemetry`

Semantic metadata lives in `semantic.*`, including metrics, dimensions, synonyms, caveats, calculation definitions and examples.

## Search Document Types

Supported object types include:

- `dataset`
- `metric`
- `dimension`
- `dimension_value`
- `geography`
- `category`
- `source`
- `entity`
- `document`
- `evidence`
- `claim`
- `hypothesis`
- `note`
- `timeline_event`
- `saved_analysis`
- `monitoring_alert`
- `story_section`
- `task`

## Full-Text, Embeddings and Hybrid Ranking

Full-text search uses PostgreSQL `tsvector` with weighted fields:

- title and code: high weight
- subtitle and synonyms: medium weight
- descriptions and metadata: lower weight

Embeddings use pgvector through `search.search_document.embedding`.

Hybrid ranking combines:

- exact identifier matches
- full-text score
- vector similarity
- object-type boosts
- investigation context
- recency
- source quality
- popularity

If embedding search is unavailable, discovery search retries as keyword search.

## Semantic Resolution

Semantic resolution maps user language to:

- metric
- dimensions
- filters
- time period
- calculation
- row limit

The semantic layer must mark incomplete generated metadata clearly. Curated metadata takes precedence over generated metadata.

## Query Plan Shape

Example:

```json
{
  "version": "1",
  "intent": "ranking",
  "metricId": "housing_stock_total",
  "groupBy": [{ "dimensionId": "geography" }],
  "filters": [{ "dimensionId": "time", "operator": "eq", "values": [2024] }],
  "limit": 25,
  "includeMissing": false
}
```

Logical IDs are validated. Table names, SQL operators and arbitrary SQL are not accepted from user input.

## Validation

Validation checks:

- plan schema
- metric existence and enabled status
- metric aggregation safety
- unit availability
- allowed dimensions
- allowed filters
- enabled calculation
- time range validity
- row limits
- result column shape
- empty results

## Failure Behavior

Structured error codes include:

- `SEARCH_NO_RESULTS`
- `METRIC_NOT_FOUND`
- `AMBIGUOUS_METRIC`
- `DIMENSION_NOT_ALLOWED`
- `INVALID_TIME_RANGE`
- `UNSUPPORTED_CALCULATION`
- `QUERY_TOO_EXPENSIVE`
- `QUERY_TIMEOUT`
- `EMPTY_RESULT`
- `INCOMPARABLE_PERIODS`
- `LLM_PROVIDER_UNAVAILABLE`
- `EMBEDDING_PROVIDER_UNAVAILABLE`

Example ambiguity response:

```json
{
  "status": "needs_resolution",
  "validation": {
    "status": "needs_resolution",
    "errors": [],
    "warnings": [],
    "ambiguities": [
      {
        "field": "metric",
        "question": "Which metric should be used?",
        "options": [{ "id": "housing_stock_total", "label": "Woningvoorraad totaal" }]
      }
    ]
  }
}
```

Example analytical answer response:

```json
{
  "status": "answered",
  "answer": {
    "title": "Result for \"Which municipalities have the most housing stock?\"",
    "summary": "Guara executed a validated ranking query and returned 25 row(s).",
    "bullets": ["geography_name: Amsterdam · value: 488000"],
    "warnings": []
  }
}
```

## Provenance

Every answer stores:

- original question
- detected language
- classified intent
- semantic candidates
- resolved metric
- resolved dimensions and filters
- query plan
- compiled SQL
- redacted parameter types
- result row count
- bounded result snapshot
- source datasets and source versions
- warnings
- feedback

Answers are not automatically evidence. Users must explicitly convert a saved analysis to evidence.

## Permissions

Global catalogue objects have no investigation restriction.

Investigation objects require access through `answer.investigation_access`.

Private objects must match the author. Shared objects require investigation membership. Permission filters are applied in SQL and RLS, not after loading objects into application memory.

## Logging

Structured logs include:

- request ID
- investigation ID
- intent
- resolved metric
- query-plan version
- search duration
- LLM duration
- SQL execution duration
- result row count
- warning count
- failure category

Logs must not include API keys, database credentials, unredacted secret parameters or private note bodies.

## Commands

Apply schemas:

```bash
npm run apply:schema -- --file supabase/semantic_catalogue_schema.sql --file supabase/search_schema.sql --file supabase/answer_schema.sql --statement-timeout-ms 900000
```

Load semantic metadata:

```bash
npm run load:semantic
```

Reindex search:

```bash
npm run index:search -- --full
npm run index:search -- --type metric
npm run index:search -- --dataset 85455NED
```

Run tests:

```bash
npm run test -- src/features/search/services/__tests__/searchQuality.test.ts
```

Run evaluation:

```bash
npm run evaluate:search
```

Prepare and test the Bouwen en Wonen search surface:

```bash
npm run prepare:search:bouwen-en-wonen -- --ensure-schema
npm run test:search:bouwen-en-wonen
npm run test:search:bouwen-en-wonen -- --query "woningvoorraad Amsterdam"
```

The Bouwen en Wonen smoke test reads mart dimensions, semantic metrics and search documents. It deliberately avoids full scans of `gold_bouwen_wonen.fact_housing_observation`, because that table can be large while ingestion is still running.

## Strict Gold-Only Investigation Mode

Investigation answering should use strict Gold-only mode by default.

In this mode, search requests include:

```json
{
  "strict_gold_only": true,
  "domain_id": "bouwen-en-wonen"
}
```

The search RPC then excludes raw Bronze and Silver search documents. It only allows documents marked with:

- `trusted_layer = gold`
- `trusted_layer = semantic`
- or `source_layer = gold`

Gold-derived documents still expose lineage metadata, for example:

```json
{
  "trusted_layer": "gold",
  "source_layer": "gold",
  "source_provider": "CBS",
  "source_dataset_code": "82211NED",
  "source_dataset_version": "2026-06-15",
  "source_last_updated_at": "2026-06-15T00:00:00Z",
  "gold_loaded_at": "2026-07-16T10:20:00Z",
  "silver_status": "complete",
  "silver_loaded_at": "2026-07-16T09:58:00Z",
  "lineage": {
    "primary_layer": "gold",
    "derived_from_layers": ["cbs_api", "bronze", "silver", "gold"],
    "gold_table": "gold.dim_measure",
    "upstream_tables": [
      "bronze.cbs_catalog_tables",
      "bronze.cbs_typed_dataset_rows",
      "silver.cbs_datasets",
      "silver.cbs_observations"
    ]
  }
}
```

This means the investigation result is based on Gold, while the user can still inspect where the Gold object came from and when the source was last updated.

## Adding Metadata

To add a metric:

1. Load or create the Gold measure.
2. Add a `semantic.metric` row.
3. Set aggregation behavior.
4. Link valid dimensions in `semantic.metric_dimension`.
5. Add synonyms in `semantic.synonym`.
6. Reindex search.

To add a synonym:

1. Insert into `semantic.synonym` or `search.query_synonym`.
2. Mark `metadata_origin` as `source`, `generated` or `curated`.
3. Reindex search if the synonym should be embedded.

To add a calculation:

1. Insert into `semantic.calculation`.
2. Add deterministic compiler support.
3. Add validation rules.
4. Add tests and evaluation cases.

To change embedding models:

1. Update the indexer embedding provider.
2. Bump `embedding_version`.
3. Run `npm run index:search -- --full --embedding-version <version>`.
