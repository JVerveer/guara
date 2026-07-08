#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
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
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--dataset") options.dataset = argv[++i] ?? "";
    else if (arg === "--limit") options.limit = Number(argv[++i] ?? options.limit);
    else if (arg === "--batch-size") options.batchSize = Number(argv[++i] ?? options.batchSize);
    else if (arg === "--rows-only") options.rowsOnly = true;
    else if (arg === "--metadata-only") options.metadataOnly = true;
    else if (arg === "--force") options.force = true;
    else if (arg === "--failed-only") options.failedOnly = true;
    else if (arg === "--no-skip-unchanged") options.skipUnchanged = false;
    else if (arg === "--help") {
      console.log(`Usage:
  npm run load:cbs:silver -- --dataset 86205NED
  npm run load:cbs:silver -- --limit 100
  npm run load:cbs:silver -- --dataset 86205NED --force
  npm run load:cbs:silver -- --failed-only
  npm run load:cbs:silver -- --metadata-only
  npm run load:cbs:silver -- --rows-only
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

        console.log(
          `Silver complete ${datasetId}: ${result.observations} observations, ${result.dimensionLinks} dimension links, ${result.measures} measures, ${result.rejected} rejected`
        );
      } catch (error) {
        await finishRun(supabase, runId, "failed", {}, error.message);
        await updateDatasetStatus(supabase, datasetId, sourceVersion, "failed", {}, error.message);
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