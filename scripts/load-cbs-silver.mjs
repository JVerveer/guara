#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

function loadLocalEnv() {
  for (const file of [".env.local", ".env"]) {
    const path = resolve(process.cwd(), file);
    if (!existsSync(path)) continue;

    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
    }
  }
}

function parseArgs(argv) {
  const options = {
    dataset: "",
    limit: 100,
    batchSize: 1000,
    rowsOnly: false,
    metadataOnly: false,
    force: false,
    failedOnly: false,
    skipUnchanged: true,
    overview: false,
    query: "",
    withBronzeCounts: true,
    withSilverCounts: true,
    concurrency: 4,
    output: "table",
    writeJson: false,
    jsonPath: "",
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "overview" || arg === "--overview") options.overview = true;
    else if (arg === "--dataset") options.dataset = argv[++i] ?? "";
    else if (arg === "--query") {
      options.query = argv[++i] ?? "";
      options.overview = true;
    }
    else if (arg === "--limit") options.limit = Number(argv[++i] ?? options.limit);
    else if (arg === "--batch-size") options.batchSize = Number(argv[++i] ?? options.batchSize);
    else if (arg === "--rows-only") options.rowsOnly = true;
    else if (arg === "--metadata-only") options.metadataOnly = true;
    else if (arg === "--force") options.force = true;
    else if (arg === "--failed-only") options.failedOnly = true;
    else if (arg === "--no-skip-unchanged") options.skipUnchanged = false;
    else if (arg === "--skip-bronze-counts") {
      options.withBronzeCounts = false;
      options.overview = true;
    }
    else if (arg === "--skip-silver-counts") {
      options.withSilverCounts = false;
      options.overview = true;
    }
    else if (arg === "--concurrency") {
      options.concurrency = Number(argv[++i] ?? options.concurrency);
      options.overview = true;
    }
    else if (arg === "--output") {
      options.output = argv[++i] ?? options.output;
      options.overview = true;
    }
    else if (arg === "--write-json") {
      options.writeJson = true;
      options.overview = true;
    }
    else if (arg === "--json-path") {
      options.jsonPath = argv[++i] ?? "";
      options.overview = true;
    }
    else if (arg === "--help") {
      console.log(`Usage:
  npm run load:cbs:silver -- --dataset 86205NED
  npm run load:cbs:silver -- --limit 100
  npm run load:cbs:silver -- --dataset 86205NED --force
  npm run load:cbs:silver -- --failed-only
  npm run load:cbs:silver -- --metadata-only
  npm run load:cbs:silver -- --rows-only
  npm run load:cbs:silver -- overview --limit 100
  npm run overview:cbs:silver -- --query wijken --limit 50
  npm run overview:cbs:silver -- --dataset 85039NED

Overview options:
  --query term             Filter by dataset id/title/description/period/catalog.
  --skip-bronze-counts     Use stored Bronze loaded_row_count only.
  --skip-silver-counts     Use stored Silver observations_loaded only.
  --concurrency 4          Parallel count requests.
  --output table|json      Console output format.
  --write-json             Write a timestamped JSON report to reports/.
`);
      process.exit(0);
    }
  }

  return options;
}

function isDimensionProperty(property) {
  return (
    property?.Key &&
    (
      property?.Type?.includes("Dimension") ||
      property?.Type?.includes("Geo") ||
      property?.Type === "TimeDimension"
    )
  );
}

function propertyId(property) {
  return String(property.ID ?? property.Key);
}

function valueType(value) {
  if (value === null || value === undefined || value === "") return "null";
  if (typeof value === "boolean") return "boolean";
  if (Number.isFinite(Number(value))) return "numeric";
  return "text";
}

function numericOrNull(value) {
  if (valueType(value) !== "numeric") return null;
  return Number(value);
}

function booleanOrNull(value) {
  return typeof value === "boolean" ? value : null;
}

function textOrNull(value) {
  if (value === null || value === undefined) return null;
  return String(value);
}

function parseDimensionKey(endpoint) {
  return endpoint.replace(/^dimension:/, "").split(":skip=")[0];
}

function dimensionPayloadRows(payloads) {
  return payloads.filter((row) => row.endpoint.startsWith("dimension:"));
}

function payloadByEndpoint(payloads, endpoint) {
  return payloads.find((row) => row.endpoint === endpoint)?.payload ?? null;
}

async function upsertOrThrow(supabase, schema, table, rows, options = {}) {
  if (!rows.length) return;

  const { error } = await supabase
    .schema(schema)
    .from(table)
    .upsert(rows, options);

  if (error) throw error;
}

async function deleteSilverDatasetRows(supabase, datasetId) {
  const tables = [
    "cbs_rejected_rows",
    "cbs_observation_measures",
    "cbs_observation_dimensions",
    "cbs_observations",
    "cbs_dimension_values",
    "cbs_dimensions",
    "cbs_measures",
    "cbs_properties",
    "cbs_datasets",
  ];

  for (const table of tables) {
    const { error } = await supabase
      .schema("silver")
      .from(table)
      .delete()
      .eq("dataset_id", datasetId);

    if (error) throw error;
  }
}

async function getBronzeDatasets(supabase, options) {
  let query = supabase
    .schema("bronze")
    .from("cbs_raw_endpoint_payloads")
    .select("dataset_id,payload,ingested_at")
    .eq("endpoint", "catalog_table")
    .order("dataset_id", { ascending: true })
    .limit(options.limit);

  if (options.dataset) query = query.eq("dataset_id", options.dataset);

  const { data, error } = await query;
  if (error) throw error;

  return data ?? [];
}

async function getRawPayloadsForDataset(supabase, datasetId) {
  const { data, error } = await supabase
    .schema("bronze")
    .from("cbs_raw_endpoint_payloads")
    .select("endpoint,source_url,payload,ingested_at")
    .eq("dataset_id", datasetId);

  if (error) throw error;
  return data ?? [];
}

async function getLoadStatus(supabase, datasetId) {
  const { data, error } = await supabase
    .schema("silver")
    .from("cbs_dataset_load_status")
    .select("*")
    .eq("dataset_id", datasetId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function shouldSkipDataset(supabase, datasetId, sourceVersion, options) {
  if (options.force) return false;

  const status = await getLoadStatus(supabase, datasetId);

  if (options.failedOnly) {
    return !["failed", "rows_partial", "metadata_completed"].includes(status?.status);
  }

  if (!options.skipUnchanged) return false;

  return status?.status === "completed" && status?.source_version === sourceVersion;
}

async function startRun(supabase, datasetId, sourceVersion) {
  const { data, error } = await supabase
    .schema("silver")
    .from("cbs_load_runs")
    .insert({
      dataset_id: datasetId,
      status: "started",
      source_version: sourceVersion,
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

async function finishRun(supabase, runId, status, result = {}, errorMessage = null) {
  const { error } = await supabase
    .schema("silver")
    .from("cbs_load_runs")
    .update({
      status,
      observations_loaded: result.observations ?? 0,
      dimensions_loaded: result.dimensionLinks ?? 0,
      measures_loaded: result.measures ?? 0,
      rejected_rows: result.rejected ?? 0,
      error_message: errorMessage,
      finished_at: new Date().toISOString(),
    })
    .eq("id", runId);

  if (error) throw error;
}

async function updateDatasetStatus(supabase, datasetId, sourceVersion, status, result = {}, errorMessage = null) {
  const { error } = await supabase
    .schema("silver")
    .from("cbs_dataset_load_status")
    .upsert(
      {
        dataset_id: datasetId,
        status,
        source_version: sourceVersion,
        last_loaded_at: new Date().toISOString(),
        observations_loaded: result.observations ?? 0,
        dimensions_loaded: result.dimensionLinks ?? 0,
        measures_loaded: result.measures ?? 0,
        rejected_rows: result.rejected ?? 0,
        error_message: errorMessage,
      },
      { onConflict: "dataset_id" }
    );

  if (error) throw error;
}

function isMissingPublicTableError(error) {
  return (
    error?.code === "PGRST205" ||
    error?.code === "42P01" ||
    error?.message?.includes("Could not find the table")
  );
}

function extractYearsFromText(value) {
  return Array.from(String(value ?? "").matchAll(/(?:19|20)\d{2}/g))
    .map((match) => Number(match[0]))
    .filter((year) => Number.isInteger(year) && year >= 1970 && year <= 2026);
}

function expandYearRange(years) {
  if (years.length < 2) return years;
  const min = Math.min(...years);
  const max = Math.max(...years);
  if (max - min > 80) return years;
  return Array.from({ length: max - min + 1 }, (_, index) => min + index);
}

function extractPeriodenYears(values) {
  return Array.from(
    new Set(
      values
        .filter((value) => value.dimension_key === "Perioden")
        .map((value) => Number(String(value.value_key ?? "").slice(0, 4)))
        .filter((year) => Number.isInteger(year) && year >= 1970 && year <= 2026)
    )
  ).sort((a, b) => a - b);
}

function levelFromCbsGeoValue(value) {
  const key = String(value?.value_key ?? "").trim().toUpperCase();
  const title = String(value?.title ?? "").trim().toLowerCase();
  const description = String(value?.description ?? "").trim().toLowerCase();

  if (key === "NL00" || key === "NL01" || key === "NL" || title === "nederland") return "country";
  if (key.startsWith("PV") || description.includes("pv = provincie") || title.includes("(pv)")) return "province";
  if (key.startsWith("GM")) return "municipality";
  if (key.startsWith("WK") || key.startsWith("BU")) return "neighborhood";
  return null;
}

function geographyLevelsFromDimensionValues(values) {
  const levels = new Set();

  for (const value of values) {
    const level = levelFromCbsGeoValue(value);
    if (level) levels.add(level);
  }

  return Array.from(levels);
}

function spatialCoverageForLevels(levels) {
  const set = new Set(levels);
  if (set.has("country") && set.has("municipality") && set.has("neighborhood")) {
    return "Netherlands — all municipalities, wijken and buurten";
  }
  if (set.has("country") && set.has("province") && set.has("municipality")) {
    return "Netherlands — country, provinces and municipalities";
  }
  if (set.has("province")) return "Netherlands — provinces";
  if (set.has("municipality")) return "Netherlands — municipalities";
  if (set.has("country")) return "Netherlands — country";
  if (set.has("neighborhood")) return "Netherlands — wijken and buurten";
  return null;
}

function isPublicDimensionValueCandidate(dimension) {
  const key = String(dimension.dimension_key ?? "");
  const type = String(dimension.type ?? "");
  return (
    key === "Perioden" ||
    type.includes("Time") ||
    type.includes("Geo") ||
    key.includes("Regio") ||
    key.includes("Wijken") ||
    key.includes("Gebieden")
  );
}

async function publishPublicDatasetMetadataForSilver(supabase, dataset, status) {
  const datasetId = dataset.dataset_id;
  const { data: dimensions, error: dimensionsError } = await supabase
    .schema("silver")
    .from("cbs_dimensions")
    .select("dataset_id,dimension_key,title,type,values_count")
    .eq("dataset_id", datasetId);

  if (dimensionsError) throw dimensionsError;

  const publicDimensionValueKeys = (dimensions ?? [])
    .filter(isPublicDimensionValueCandidate)
    .map((dimension) => dimension.dimension_key);
  let dimensionValues = [];

  if (publicDimensionValueKeys.length > 0) {
    const { data, error } = await supabase
      .schema("silver")
      .from("cbs_dimension_values")
      .select("dimension_key,value_key,title,description")
      .eq("dataset_id", datasetId)
      .in("dimension_key", publicDimensionValueKeys)
      .limit(10000);

    if (error) throw error;
    dimensionValues = data ?? [];
  }

  const periodenYears = extractPeriodenYears(dimensionValues);
  const catalogPeriodYears = expandYearRange(extractYearsFromText(dataset.period));
  const catalogTextYears = expandYearRange(
    extractYearsFromText(`${dataset.title ?? ""} ${dataset.short_title ?? ""} ${dataset.short_description ?? ""}`)
  );
  const years = periodenYears.length
    ? periodenYears
    : catalogPeriodYears.length
      ? catalogPeriodYears
      : catalogTextYears;
  const geographicLevels = geographyLevelsFromDimensionValues(dimensionValues);
  const spatialCoverage = spatialCoverageForLevels(geographicLevels);
  const periodSource = periodenYears.length
    ? "perioden-dimension"
    : catalogPeriodYears.length
      ? "catalog-period"
      : catalogTextYears.length
        ? "catalog-text"
        : "none";
  const evidence = [
    periodenYears.length ? "Years from Silver Perioden dimension using first four characters of each key" : "No Silver Perioden dimension found",
    periodSource === "catalog-period" ? "Years expanded from CBS catalog Period" : null,
    periodSource === "catalog-text" ? "Years inferred from CBS catalog title/description" : null,
    geographicLevels.length ? "Geographic levels from Silver geography dimension values" : "No Silver geography dimension values identified",
    spatialCoverage ? `Spatial coverage: ${spatialCoverage}` : null,
    status?.observations_loaded !== undefined && status?.observations_loaded !== null
      ? "Record count from Silver observations loaded"
      : "Record count unavailable",
  ].filter(Boolean);

  const catalogResult = await supabase
    .from("dataset_catalog")
    .upsert(
      {
        id: datasetId,
        provider: "CBS",
        title: dataset.short_title || dataset.title || datasetId,
        description: dataset.short_description || dataset.title || datasetId,
        updated_at: dataset.cbs_updated_at ?? null,
        record_count: status?.observations_loaded ?? null,
        year_start: years.length ? Math.min(...years) : null,
        year_end: years.length ? Math.max(...years) : null,
        years,
        geographic_levels: geographicLevels,
        spatial_coverage: spatialCoverage,
        period_source: periodSource,
        qualification_confidence: (dimensions ?? []).length ? "cbs-metadata" : years.length ? "partial-metadata" : "unqualified",
        qualification_evidence: evidence,
        source_url: `https://opendata.cbs.nl/ODataApi/odata/${datasetId}`,
        ingested_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

  if (catalogResult.error) {
    if (isMissingPublicTableError(catalogResult.error)) {
      console.warn(
        `Skipped public dataset catalog publish for ${datasetId}: run supabase/schema.sql to create public.dataset_catalog.`
      );
      return false;
    }

    throw catalogResult.error;
  }

  if ((dimensions ?? []).length > 0) {
    const dimensionsResult = await supabase
      .from("dataset_dimensions")
      .upsert(
        dimensions.map((dimension) => ({
          dataset_id: datasetId,
          key: dimension.dimension_key,
          title: dimension.title || dimension.dimension_key,
          type: dimension.type || "Dimension",
          values_count: dimension.values_count ?? null,
          ingested_at: new Date().toISOString(),
        })),
        { onConflict: "dataset_id,key" }
      );

    if (dimensionsResult.error) {
      if (isMissingPublicTableError(dimensionsResult.error)) {
        console.warn(
          `Skipped public dataset dimensions publish for ${datasetId}: run supabase/schema.sql to create public.dataset_dimensions.`
        );
      } else {
        throw dimensionsResult.error;
      }
    }
  }

  return true;
}

async function publishPublicSilverDataset(supabase, datasetId) {
  const { data: dataset, error: datasetError } = await supabase
    .schema("silver")
    .from("cbs_datasets")
    .select("*")
    .eq("dataset_id", datasetId)
    .maybeSingle();

  if (datasetError) throw datasetError;
  if (!dataset) return;

  const { data: status, error: statusError } = await supabase
    .schema("silver")
    .from("cbs_dataset_load_status")
    .select("*")
    .eq("dataset_id", datasetId)
    .maybeSingle();

  if (statusError) throw statusError;

  const publicParentReady = await publishPublicDatasetMetadataForSilver(supabase, dataset, status);
  if (!publicParentReady) return;

  const { error } = await supabase
    .from("silver_dataset_catalog")
    .upsert(
      {
        dataset_id: datasetId,
        provider: "CBS",
        title: dataset.title ?? dataset.short_title ?? datasetId,
        short_title: dataset.short_title ?? null,
        description: dataset.short_description ?? null,
        language: dataset.language ?? null,
        catalog: dataset.catalog ?? null,
        period: dataset.period ?? null,
        cbs_updated_at: dataset.cbs_updated_at ?? null,
        source_version: dataset.source_version ?? null,
        source_url: `https://opendata.cbs.nl/ODataApi/odata/${datasetId}`,
        bronze_ingested_at: dataset.bronze_ingested_at ?? null,
        silver_loaded_at: dataset.silver_loaded_at ?? null,
        load_status: status?.status ?? null,
        observations_loaded: status?.observations_loaded ?? null,
        dimensions_loaded: status?.dimensions_loaded ?? null,
        measures_loaded: status?.measures_loaded ?? null,
        rejected_rows: status?.rejected_rows ?? null,
        published_at: new Date().toISOString(),
      },
      { onConflict: "dataset_id" }
    );

  if (error) {
    if (isMissingPublicTableError(error)) {
      console.warn(
        `Skipped public silver catalog publish for ${datasetId}: run supabase/schema.sql to create public.silver_dataset_catalog.`
      );
      return;
    }

    throw error;
  }
}

async function loadMetadataForDataset(supabase, datasetId, sourceVersion) {
  const payloads = await getRawPayloadsForDataset(supabase, datasetId);
  const catalog = payloadByEndpoint(payloads, "catalog_table");
  const dataPropertiesPayload = payloadByEndpoint(payloads, "data_properties");
  const properties = dataPropertiesPayload?.value ?? [];

  if (!catalog) throw new Error(`Missing catalog_table payload for ${datasetId}`);

  const now = new Date().toISOString();

  await upsertOrThrow(
    supabase,
    "silver",
    "cbs_datasets",
    [{
      dataset_id: datasetId,
      title: catalog.Title ?? null,
      short_title: catalog.ShortTitle ?? null,
      short_description: catalog.ShortDescription ?? null,
      language: catalog.Language ?? null,
      catalog: catalog.Catalog ?? null,
      period: catalog.Period ?? null,
      cbs_updated_at: catalog.Updated ?? null,
      source_version: sourceVersion,
      bronze_ingested_at: payloads.find((p) => p.endpoint === "catalog_table")?.ingested_at ?? null,
      silver_loaded_at: now,
    }],
    { onConflict: "dataset_id" }
  );

  await upsertOrThrow(
    supabase,
    "silver",
    "cbs_properties",
    properties.map((property) => ({
      dataset_id: datasetId,
      property_id: propertyId(property),
      key: property.Key ?? null,
      title: property.Title ?? null,
      type: property.Type ?? null,
      unit: property.Unit ?? null,
      decimals: property.Decimals ?? null,
      parent_id: property.ParentID === undefined || property.ParentID === null ? null : String(property.ParentID),
      position: property.Position ?? null,
      source_version: sourceVersion,
      silver_loaded_at: now,
    })),
    { onConflict: "dataset_id,property_id" }
  );

  const dimensionProperties = properties.filter(isDimensionProperty);
  const measureProperties = properties.filter((property) => property?.Key && !isDimensionProperty(property));

  const dimensionValueCounts = new Map();
  const dimensionValues = [];

  for (const row of dimensionPayloadRows(payloads)) {
    const dimensionKey = parseDimensionKey(row.endpoint);
    const values = row.payload?.value ?? [];

    dimensionValueCounts.set(dimensionKey, (dimensionValueCounts.get(dimensionKey) ?? 0) + values.length);

    for (const value of values) {
      if (value?.Key === undefined || value?.Key === null) continue;

      dimensionValues.push({
        dataset_id: datasetId,
        dimension_key: dimensionKey,
        value_key: String(value.Key),
        title: value.Title ?? null,
        description: value.Description ?? null,
        category_group_id: value.CategoryGroupID === undefined || value.CategoryGroupID === null ? null : String(value.CategoryGroupID),
        position: value.Position ?? null,
        source_version: sourceVersion,
        silver_loaded_at: now,
      });
    }
  }

  await upsertOrThrow(
    supabase,
    "silver",
    "cbs_dimensions",
    dimensionProperties.map((property) => ({
      dataset_id: datasetId,
      dimension_key: property.Key,
      title: property.Title ?? property.Key,
      type: property.Type ?? null,
      position: property.Position ?? null,
      values_count: dimensionValueCounts.get(property.Key) ?? null,
      source_version: sourceVersion,
      silver_loaded_at: now,
    })),
    { onConflict: "dataset_id,dimension_key" }
  );

  await upsertOrThrow(
    supabase,
    "silver",
    "cbs_dimension_values",
    dimensionValues,
    { onConflict: "dataset_id,dimension_key,value_key" }
  );

  await upsertOrThrow(
    supabase,
    "silver",
    "cbs_measures",
    measureProperties.map((property) => ({
      dataset_id: datasetId,
      measure_key: property.Key,
      title: property.Title ?? property.Key,
      unit: property.Unit ?? null,
      decimals: property.Decimals ?? null,
      parent_id: property.ParentID === undefined || property.ParentID === null ? null : String(property.ParentID),
      position: property.Position ?? null,
      source_version: sourceVersion,
      silver_loaded_at: now,
    })),
    { onConflict: "dataset_id,measure_key" }
  );

  return {
    dimensions: dimensionProperties.length,
    dimensionValues: dimensionValues.length,
    measures: measureProperties.length,
  };
}

async function getSilverKeys(supabase, datasetId, table, column) {
  const { data, error } = await supabase
    .schema("silver")
    .from(table)
    .select(column)
    .eq("dataset_id", datasetId);

  if (error) throw error;
  return new Set((data ?? []).map((row) => row[column]));
}

async function getMaxSilverRowIndex(supabase, datasetId) {
  const { data, error } = await supabase
    .schema("silver")
    .from("cbs_observations")
    .select("row_index")
    .eq("dataset_id", datasetId)
    .order("row_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data?.row_index === undefined || data?.row_index === null ? -1 : Number(data.row_index);
}

async function insertRejectedRow(supabase, row, sourceVersion, reason, errorMessage) {
  const { error } = await supabase
    .schema("silver")
    .from("cbs_rejected_rows")
    .insert({
      dataset_id: row.dataset_id,
      row_id: row.row_id,
      row_index: row.row_index,
      reason,
      error_message: errorMessage,
      source_version: sourceVersion,
    });

  if (error) throw error;
}

function observationToRelationalRows(row, dimensionKeys, measureKeys, sourceVersion) {
  const now = new Date().toISOString();

  const observation = {
    dataset_id: row.dataset_id,
    row_id: row.row_id,
    row_index: row.row_index,
    source_version: sourceVersion,
    silver_loaded_at: now,
  };

  const dimensions = [];
  const measures = [];

  for (const [key, value] of Object.entries(row.raw ?? {})) {
    if (key === "ID") continue;

    if (dimensionKeys.has(key)) {
      if (value !== null && value !== undefined && value !== "") {
        dimensions.push({
          dataset_id: row.dataset_id,
          row_id: row.row_id,
          dimension_key: key,
          value_key: String(value),
          source_version: sourceVersion,
          silver_loaded_at: now,
        });
      }
      continue;
    }

    if (measureKeys.has(key)) {
      const type = valueType(value);

      measures.push({
        dataset_id: row.dataset_id,
        row_id: row.row_id,
        measure_key: key,
        value_type: type,
        value_text: textOrNull(value),
        value_numeric: numericOrNull(value),
        value_boolean: booleanOrNull(value),
        source_version: sourceVersion,
        silver_loaded_at: now,
      });
    }
  }

  if (measures.length === 0) {
    throw new Error("Observation has no measure values.");
  }

  return { observation, dimensions, measures };
}

async function loadRowsForDataset(supabase, datasetId, sourceVersion, options) {
  const dimensionKeys = await getSilverKeys(supabase, datasetId, "cbs_dimensions", "dimension_key");
  const measureKeys = await getSilverKeys(supabase, datasetId, "cbs_measures", "measure_key");

  if (dimensionKeys.size === 0 && measureKeys.size === 0) {
    throw new Error(`No Silver metadata found for ${datasetId}. Run metadata load first.`);
  }

  let from = 0;

  if (!options.force) {
    from = (await getMaxSilverRowIndex(supabase, datasetId)) + 1;
    if (from > 0) console.log(`Silver rows for ${datasetId}: resuming from row_index ${from}`);
  }

  const totals = {
    observations: 0,
    dimensionLinks: 0,
    measures: 0,
    rejected: 0,
  };

  while (true) {
    const { data, error } = await supabase
      .schema("bronze")
      .from("cbs_typed_dataset_rows")
      .select("dataset_id,row_id,row_index,raw")
      .eq("dataset_id", datasetId)
      .gte("row_index", from)
      .order("row_index", { ascending: true })
      .limit(options.batchSize);

    if (error) throw error;
    if (!data || data.length === 0) break;

    const observationRows = [];
    const dimensionRows = [];
    const measureRows = [];

    for (const row of data) {
      try {
        const relational = observationToRelationalRows(row, dimensionKeys, measureKeys, sourceVersion);
        observationRows.push(relational.observation);
        dimensionRows.push(...relational.dimensions);
        measureRows.push(...relational.measures);
      } catch (error) {
        totals.rejected += 1;
        await insertRejectedRow(supabase, row, sourceVersion, "row_parse_failed", error.message);
      }
    }

    await upsertOrThrow(supabase, "silver", "cbs_observations", observationRows, { onConflict: "dataset_id,row_id" });
    await upsertOrThrow(supabase, "silver", "cbs_observation_dimensions", dimensionRows, { onConflict: "dataset_id,row_id,dimension_key" });
    await upsertOrThrow(supabase, "silver", "cbs_observation_measures", measureRows, { onConflict: "dataset_id,row_id,measure_key" });

    totals.observations += observationRows.length;
    totals.dimensionLinks += dimensionRows.length;
    totals.measures += measureRows.length;

    from = data[data.length - 1].row_index + 1;

    console.log(
      `Silver rows ${datasetId}: +${observationRows.length} obs, +${dimensionRows.length} dims, +${measureRows.length} measures, +${totals.rejected} rejected`
    );

    if (data.length < options.batchSize) break;
  }

  return totals;
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));
  return results;
}

async function getOverviewRows(queryFactory, pageSize = 1000) {
  const rows = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await queryFactory().range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }

  return rows;
}

async function getOverviewStatusRows(supabase, schema, table, selectWithCounts, fallbackSelect) {
  try {
    return await getOverviewRows(() => supabase.schema(schema).from(table).select(selectWithCounts));
  } catch (error) {
    if (error?.code !== "42703") throw error;
    return getOverviewRows(() => supabase.schema(schema).from(table).select(fallbackSelect));
  }
}

async function getExactDatasetCount(supabase, schema, table, column, datasetId) {
  const { count, error } = await supabase
    .schema(schema)
    .from(table)
    .select(column, { count: "exact", head: true })
    .eq("dataset_id", datasetId);

  if (error) throw error;
  return count ?? 0;
}

function matchesOverviewQuery(row, query) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return [
    row.datasetId,
    row.title,
    row.description,
    row.period,
    row.catalog,
    row.bronzeStatus,
    row.silverStatus,
  ].some((value) => String(value ?? "").toLowerCase().includes(normalized));
}

function classifySilverOverview(row) {
  if (!row.silverMetadataLoaded && row.silverObservationsLoaded === 0) return "not_loaded";
  if (row.silverMetadataLoaded && row.silverObservationsLoaded === 0) {
    return row.silverStatus === "failed" ? "failed_metadata" : "metadata_only";
  }
  if (row.silverStatus === "failed") return "failed_partial";
  if (row.silverRejectedRows > 0 && row.silverStatus === "completed_with_rejections") return "complete_with_rejections";
  if (row.bronzeRowsLoaded > 0 && row.silverObservationsLoaded >= row.bronzeRowsLoaded) return "complete";
  if (row.bronzeRecordCount > 0 && row.silverObservationsLoaded >= row.bronzeRecordCount) return "complete";
  if (row.silverObservationsLoaded > 0) return "partial";
  return row.silverStatus ?? "unknown";
}

function percentage(part, total) {
  if (!total || total <= 0) return null;
  return Math.min(100, Number(((part / total) * 100).toFixed(2)));
}

function summarizeSilverOverview(rows) {
  const byStatus = rows.reduce((acc, row) => {
    acc[row.silverClassification] = (acc[row.silverClassification] ?? 0) + 1;
    return acc;
  }, {});

  return {
    bronzeDatasetsScanned: rows.length,
    bronzeDatasetsWithRows: rows.filter((row) => row.bronzeRowsLoaded > 0).length,
    silverMetadataLoaded: rows.filter((row) => row.silverMetadataLoaded).length,
    silverRowsLoaded: rows.filter((row) => row.silverObservationsLoaded > 0).length,
    complete: rows.filter((row) => row.silverClassification === "complete" || row.silverClassification === "complete_with_rejections").length,
    partial: rows.filter((row) => row.silverClassification.includes("partial")).length,
    metadataOnly: rows.filter((row) => row.silverClassification === "metadata_only").length,
    notLoaded: rows.filter((row) => row.silverClassification === "not_loaded").length,
    byStatus,
  };
}

function compactSilverOverviewTable(rows) {
  return rows.map((row) => ({
    id: row.datasetId,
    title: row.title.slice(0, 52),
    apiRecords: row.bronzeRecordCount ?? "unknown",
    bronzeRows: row.bronzeRowsLoaded,
    silverRows: row.silverObservationsLoaded,
    pctOfBronze: row.silverPercentageOfBronze ?? "unknown",
    status: row.silverClassification,
    bronzeStatus: row.bronzeStatus ?? "",
    silverStatus: row.silverStatus ?? "",
    rejected: row.silverRejectedRows,
  }));
}

function writeSilverOverviewJson(report, options) {
  const directory = resolve(process.cwd(), "reports");
  mkdirSync(directory, { recursive: true });
  const filename =
    options.jsonPath ||
    resolve(directory, `cbs-silver-overview-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);

  writeFileSync(filename, `${JSON.stringify(report, null, 2)}\n`);
  return filename;
}

async function runSilverOverview(supabase, options) {
  let rawCatalogQuery = supabase
    .schema("bronze")
    .from("cbs_raw_endpoint_payloads")
    .select("dataset_id,payload,ingested_at")
    .eq("endpoint", "catalog_table")
    .order("dataset_id", { ascending: true })
    .limit(options.limit);

  if (options.dataset) rawCatalogQuery = rawCatalogQuery.eq("dataset_id", options.dataset);

  const [{ data: rawCatalogRows, error: rawCatalogError }, bronzeStatusRows, silverStatusRows, silverDatasetRows] =
    await Promise.all([
      rawCatalogQuery,
      getOverviewStatusRows(
        supabase,
        "bronze",
        "cbs_dataset_ingestion_status",
        "dataset_id,title,last_cbs_updated_at,last_ingested_at,record_count,loaded_row_count,load_percentage,status,error_message",
        "dataset_id,title,last_cbs_updated_at,last_ingested_at,record_count,status,error_message"
      ),
      getOverviewStatusRows(
        supabase,
        "silver",
        "cbs_dataset_load_status",
        "dataset_id,status,source_version,last_loaded_at,observations_loaded,dimensions_loaded,measures_loaded,rejected_rows,error_message",
        "dataset_id,status,source_version,last_loaded_at,error_message"
      ),
      getOverviewRows(() =>
        supabase
          .schema("silver")
          .from("cbs_datasets")
          .select("dataset_id,silver_loaded_at")
      ),
    ]);

  if (rawCatalogError) throw rawCatalogError;

  const bronzeStatusById = new Map(bronzeStatusRows.map((row) => [row.dataset_id, row]));
  const silverStatusById = new Map(silverStatusRows.map((row) => [row.dataset_id, row]));
  const silverDatasetById = new Map(silverDatasetRows.map((row) => [row.dataset_id, row]));

  const baseRows = (rawCatalogRows ?? [])
    .map((row) => {
      const payload = row.payload ?? {};
      const bronzeStatus = bronzeStatusById.get(row.dataset_id);
      const silverStatus = silverStatusById.get(row.dataset_id);
      const silverDataset = silverDatasetById.get(row.dataset_id);

      return {
        datasetId: row.dataset_id,
        title: payload.ShortTitle || payload.Title || bronzeStatus?.title || row.dataset_id,
        description: payload.ShortDescription ?? "",
        catalog: payload.Catalog ?? null,
        period: payload.Period ?? null,
        language: payload.Language ?? null,
        cbsUpdatedAt: payload.Updated ?? bronzeStatus?.last_cbs_updated_at ?? null,
        bronzeRecordCount: bronzeStatus?.record_count ?? null,
        bronzeRowsLoaded: bronzeStatus?.loaded_row_count ?? 0,
        bronzeLoadPercentage: bronzeStatus?.load_percentage ?? null,
        bronzeStatus: bronzeStatus?.status ?? null,
        bronzeLastIngestedAt: bronzeStatus?.last_ingested_at ?? row.ingested_at ?? null,
        bronzeError: bronzeStatus?.error_message ?? null,
        silverMetadataLoaded: Boolean(silverStatus || silverDataset),
        silverStatus: silverStatus?.status ?? null,
        silverSourceVersion: silverStatus?.source_version ?? null,
        silverLastLoadedAt: silverStatus?.last_loaded_at ?? silverDataset?.silver_loaded_at ?? null,
        silverObservationsLoaded: silverStatus?.observations_loaded ?? 0,
        silverDimensionsLoaded: silverStatus?.dimensions_loaded ?? 0,
        silverMeasuresLoaded: silverStatus?.measures_loaded ?? 0,
        silverRejectedRows: silverStatus?.rejected_rows ?? 0,
        silverError: silverStatus?.error_message ?? null,
      };
    })
    .filter((row) => matchesOverviewQuery(row, options.query));

  const countedRows = await mapWithConcurrency(baseRows, options.concurrency, async (row) => {
    const bronzeRowsLoaded = options.withBronzeCounts
      ? await getExactDatasetCount(supabase, "bronze", "cbs_typed_dataset_rows", "row_id", row.datasetId)
      : row.bronzeRowsLoaded;
    const silverObservationsLoaded = options.withSilverCounts
      ? await getExactDatasetCount(supabase, "silver", "cbs_observations", "row_id", row.datasetId)
      : row.silverObservationsLoaded;

    return {
      ...row,
      bronzeRowsLoaded,
      silverObservationsLoaded,
    };
  });

  const rows = countedRows.map((row) => {
    const nextRow = {
      ...row,
      silverPercentageOfBronze: percentage(row.silverObservationsLoaded, row.bronzeRowsLoaded),
      silverPercentageOfApiRecords: percentage(row.silverObservationsLoaded, row.bronzeRecordCount),
    };

    return {
      ...nextRow,
      silverClassification: classifySilverOverview(nextRow),
    };
  });

  const report = {
    generatedAt: new Date().toISOString(),
    scope: {
      dataset: options.dataset || null,
      query: options.query || null,
      limit: options.limit,
      withBronzeCounts: options.withBronzeCounts,
      withSilverCounts: options.withSilverCounts,
    },
    summary: summarizeSilverOverview(rows),
    rows,
  };

  if (options.output === "json") {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log("\nSilver CBS overview");
    console.log(JSON.stringify(report.summary, null, 2));
    console.table(compactSilverOverviewTable(rows));
  }

  if (options.writeJson) {
    const path = writeSilverOverviewJson(report, options);
    console.log(`Wrote JSON report: ${path}`);
  }
}

async function main() {
  loadLocalEnv();
  const options = parseArgs(process.argv);

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) throw new Error("Missing SUPABASE_URL or VITE_SUPABASE_URL.");
  if (!serviceRoleKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  if (options.overview) {
    await runSilverOverview(supabase, options);
    return;
  }

  const datasets = await getBronzeDatasets(supabase, options);
  console.log(`Found ${datasets.length} Bronze dataset(s) to load into Silver.`);

  for (const dataset of datasets) {
    const datasetId = dataset.dataset_id;
    const sourceVersion = dataset.payload?.Updated ?? null;

    try {
      if (await shouldSkipDataset(supabase, datasetId, sourceVersion, options)) {
        console.log(`Skipped ${datasetId}: already completed for source version ${sourceVersion}.`);
        continue;
      }

      if (options.force) {
        console.log(`Force enabled: deleting Silver rows for ${datasetId}`);
        await deleteSilverDatasetRows(supabase, datasetId);
      }

      const runId = await startRun(supabase, datasetId, sourceVersion);

      try {
        console.log(`Loading Silver dataset ${datasetId}`);

        if (!options.rowsOnly) {
          await loadMetadataForDataset(supabase, datasetId, sourceVersion);
          await updateDatasetStatus(supabase, datasetId, sourceVersion, "metadata_completed");
        }

        let result = { observations: 0, dimensionLinks: 0, measures: 0, rejected: 0 };

        if (!options.metadataOnly) {
          result = await loadRowsForDataset(supabase, datasetId, sourceVersion, options);
        }

        const finalStatus = result.rejected > 0 ? "completed_with_rejections" : "completed";

        await finishRun(supabase, runId, finalStatus, result);
        await updateDatasetStatus(supabase, datasetId, sourceVersion, finalStatus, result);
        await publishPublicSilverDataset(supabase, datasetId);

        console.log(
          `Silver complete ${datasetId}: ${result.observations} observations, ${result.dimensionLinks} dimension links, ${result.measures} measures, ${result.rejected} rejected`
        );
      } catch (error) {
        await finishRun(supabase, runId, "failed", {}, error.message);
        await updateDatasetStatus(supabase, datasetId, sourceVersion, "failed", {}, error.message);
        await publishPublicSilverDataset(supabase, datasetId).catch((publishError) => {
          console.warn(`Skipped public silver catalog publish for ${datasetId}: ${publishError.message}`);
        });
        throw error;
      }
    } catch (error) {
      console.error(`Failed Silver load for ${datasetId}: ${error.message}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
