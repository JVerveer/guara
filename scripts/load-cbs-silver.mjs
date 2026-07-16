#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const STATUS = {
  PENDING: "pending",
  METADATA_LOADED: "metadata_loaded",
  PARTIAL: "partial",
  COMPLETE: "complete",
  COMPLETE_WITH_WARNINGS: "complete_with_warnings",
  FAILED: "failed",
  SKIPPED: "skipped",
  STALE: "stale",
};

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
    domain: "",
    limit: 100,
    rootTheme: "",
    batchSize: 1000,
    rowsOnly: false,
    metadataOnly: false,
    force: false,
    failedOnly: false,
    skipUnchanged: true,
    overview: false,
    query: "",
    withBronzeCounts: false,
    withSilverCounts: false,
    concurrency: 4,
    loadConcurrency: 1,
    skipPublicRefresh: false,
    output: "table",
    writeJson: false,
    jsonPath: "",
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "overview" || arg === "--overview") options.overview = true;
    else if (arg === "--dataset") options.dataset = argv[++i] ?? "";
    else if (arg === "--domain") options.domain = argv[++i] ?? "";
    else if (arg === "--root-theme") options.rootTheme = argv[++i] ?? "";
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
    else if (arg === "--exact-bronze-counts") {
      options.withBronzeCounts = true;
      options.overview = true;
    }
    else if (arg === "--exact-silver-counts") {
      options.withSilverCounts = true;
      options.overview = true;
    }
    else if (arg === "--concurrency") {
      options.concurrency = Number(argv[++i] ?? options.concurrency);
      options.overview = true;
    }
    else if (arg === "--load-concurrency") options.loadConcurrency = Number(argv[++i] ?? options.loadConcurrency);
    else if (arg === "--skip-public-refresh") options.skipPublicRefresh = true;
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
  npm run load:cbs:silver -- --domain bouwen-en-wonen --limit 25
  npm run load:cbs:silver -- --root-theme "Bouwen en wonen" --limit 25
  npm run load:cbs:silver -- --limit 100
  npm run load:cbs:silver -- --dataset 86205NED --force
  npm run load:cbs:silver -- --failed-only
  npm run load:cbs:silver -- --metadata-only
  npm run load:cbs:silver -- --rows-only
  npm run load:cbs:silver -- overview --limit 100
  npm run overview:cbs:silver -- --query wijken --limit 50
  npm run overview:cbs:silver -- --dataset 85039NED

Selection options:
  --domain bouwen-en-wonen         Load or overview datasets linked to a canonical Guara/CBS domain.
  --root-theme "Bouwen en wonen"  Load or overview datasets linked to a CBS top-level root theme.
  --load-concurrency 1            Number of datasets to load in parallel.
  --skip-public-refresh           Skip app-facing public catalog/summary refresh during the load.

Overview options:
  --query term             Filter by dataset id/title/description/period/catalog.
  --exact-bronze-counts    Count Bronze raw rows directly. Slower on large tables.
  --exact-silver-counts    Count Silver observations directly. Slower on large tables.
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

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function schemaHash(properties) {
  const schema = properties
    .map((property) => ({
      id: property.ID,
      key: property.Key,
      title: property.Title,
      type: property.Type,
      datatype: property.Datatype,
      unit: property.Unit,
      position: property.Position,
      parentId: property.ParentID,
    }))
    .sort((a, b) => String(a.key ?? a.id).localeCompare(String(b.key ?? b.id)));

  return createHash("sha256").update(stableJson(schema)).digest("hex");
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
    "cbs_gold_readiness",
    "cbs_dataset_domains",
    "cbs_indicator_candidates",
    "cbs_dataset_grain",
    "cbs_region_values",
    "cbs_period_values",
    "cbs_dataset_featured",
    "cbs_dataset_themes",
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
  if (options.rootTheme) {
    const themeDatasetIds = await getDatasetIdsForRootTheme(supabase, options.rootTheme);
    const datasetIds = options.dataset
      ? themeDatasetIds.filter((id) => id === options.dataset)
      : themeDatasetIds;

    return getCatalogRowsForDatasetIds(supabase, datasetIds.slice(0, Math.max(1, options.limit)));
  }

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
    return ![
      STATUS.FAILED,
      STATUS.PARTIAL,
      STATUS.METADATA_LOADED,
      "rows_partial",
      "metadata_completed",
    ].includes(status?.status);
  }

  if (!options.skipUnchanged) return false;

  return [STATUS.COMPLETE, STATUS.COMPLETE_WITH_WARNINGS, "completed", "completed_with_rejections"].includes(status?.status) && status?.source_version === sourceVersion;
}

async function startRun(supabase, datasetId, sourceVersion, expectedObservations = null) {
  const { data, error } = await supabase
    .schema("silver")
    .from("cbs_load_runs")
    .insert({
      dataset_id: datasetId,
      status: STATUS.PENDING,
      source_version: sourceVersion,
      expected_observations: expectedObservations,
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
      expected_observations: result.expectedObservations ?? null,
      metadata: result.metadata ?? {},
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
        expected_observations: result.expectedObservations ?? null,
        quality_status: result.quality?.qualityStatus ?? null,
        quality_checks: result.quality?.checks ?? {},
        metadata_completeness_pct: result.quality?.metadataCompletenessPct ?? null,
        dimension_completeness_pct: result.quality?.dimensionCompletenessPct ?? null,
        row_completeness_pct: result.quality?.rowCompletenessPct ?? null,
        source_schema_hash: result.schemaHash ?? null,
        error_message: errorMessage,
      },
      { onConflict: "dataset_id" }
    );

  if (error) throw error;
}

async function getBronzeStatus(supabase, datasetId) {
  const { data, error } = await supabase
    .schema("bronze")
    .from("cbs_dataset_ingestion_status")
    .select("dataset_id,record_count,loaded_row_count,last_run_id,source_version,schema_hash")
    .eq("dataset_id", datasetId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

function silverQualityChecks({ metadataResult, expectedObservations, observationsLoaded, rejected, status }) {
  const checks = {
    metadata_present: {
      status: metadataResult && (metadataResult.dimensions > 0 || metadataResult.measures > 0) ? "pass" : "fail",
      actual: metadataResult ? `${metadataResult.dimensions} dimensions, ${metadataResult.measures} measures` : "none",
    },
    rows_match_bronze: {
      status: expectedObservations === null || expectedObservations === undefined
        ? "warn"
        : observationsLoaded + rejected >= expectedObservations
          ? "pass"
          : observationsLoaded > 0
            ? "warn"
            : "fail",
      expected: expectedObservations,
      actual: observationsLoaded + rejected,
    },
    rejected_rows: {
      status: rejected > 0 ? "warn" : "pass",
      expected: 0,
      actual: rejected,
    },
    status_terminal: {
      status: [STATUS.COMPLETE, STATUS.COMPLETE_WITH_WARNINGS, STATUS.PARTIAL, STATUS.METADATA_LOADED].includes(status) ? "pass" : "warn",
      actual: status,
    },
  };
  const failed = Object.values(checks).some((check) => check.status === "fail");
  const warned = Object.values(checks).some((check) => check.status === "warn");

  return {
    checks,
    qualityStatus: failed ? "failed" : warned ? "warning" : "passed",
    metadataCompletenessPct: metadataResult && metadataResult.measures > 0 ? 100 : 0,
    dimensionCompletenessPct: metadataResult && metadataResult.dimensions > 0 ? 100 : 0,
    rowCompletenessPct: percentage(observationsLoaded + rejected, expectedObservations),
  };
}

function isMissingPublicTableError(error) {
  return (
    error?.code === "PGRST205" ||
    error?.code === "42P01" ||
    error?.message?.includes("Could not find the table")
  );
}

async function publishPublicQualityChecks(supabase, datasetId, layer, quality) {
  const rows = Object.entries(quality.checks).map(([checkName, check]) => ({
    dataset_id: datasetId,
    layer,
    check_name: checkName,
    status: check.status,
    expected_value: check.expected === undefined ? null : String(check.expected),
    actual_value: check.actual === undefined ? null : String(check.actual),
    message: null,
    checked_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("dataset_quality_checks")
    .upsert(rows, { onConflict: "dataset_id,layer,check_name" });

  if (error) {
    if (isMissingPublicTableError(error)) return;
    console.warn(`Skipped public quality checks for ${datasetId}: ${error.message}`);
  }
}

async function publishSourceLayerSummary(supabase, layer = "silver") {
  const { data, error } = await supabase
    .schema("silver")
    .from("cbs_dataset_load_status")
    .select("dataset_id,status,last_loaded_at,observations_loaded,expected_observations,rejected_rows,quality_status");

  if (error) throw error;

  const rows = data ?? [];
  const recordsExpected = rows.reduce((sum, row) => sum + (row.expected_observations ?? 0), 0);
  const recordsLoaded = rows.reduce((sum, row) => sum + (row.observations_loaded ?? 0), 0);
  const rejectedRows = rows.reduce((sum, row) => sum + (row.rejected_rows ?? 0), 0);
  const failed = rows.filter((row) => row.status === STATUS.FAILED).length;
  const partial = rows.filter((row) => row.status === STATUS.PARTIAL).length;
  const complete = rows.filter((row) => [STATUS.COMPLETE, STATUS.COMPLETE_WITH_WARNINGS, "completed", "completed_with_rejections"].includes(row.status)).length;
  const lastLoadedAt = rows.map((row) => row.last_loaded_at).filter(Boolean).sort().at(-1) ?? null;
  const summaryStatus = failed > 0 || rejectedRows > 0
    ? STATUS.COMPLETE_WITH_WARNINGS
    : partial > 0
      ? STATUS.PARTIAL
      : complete > 0
        ? STATUS.COMPLETE
        : STATUS.PENDING;

  const { error: summaryError } = await supabase
    .from("source_layer_summary")
    .upsert(
      {
        provider: "CBS",
        layer,
        status: summaryStatus,
        datasets_total: rows.length,
        datasets_complete: complete,
        datasets_partial: partial,
        datasets_failed: failed,
        records_expected: recordsExpected,
        records_loaded: recordsLoaded,
        completeness_pct: percentage(recordsLoaded + rejectedRows, recordsExpected),
        rejected_rows: rejectedRows,
        last_loaded_at: lastLoadedAt,
        metadata: {
          quality_statuses: rows.reduce((acc, row) => {
            const key = row.quality_status ?? "unknown";
            acc[key] = (acc[key] ?? 0) + 1;
            return acc;
          }, {}),
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "provider,layer" }
    );

  if (summaryError && !isMissingPublicTableError(summaryError)) {
    console.warn(`Skipped source layer summary for ${layer}: ${summaryError.message}`);
  }
}

async function publishSilverSchemaSnapshot(supabase, datasetId, sourceVersion, properties) {
  if (!sourceVersion || properties.length === 0) return null;
  const hash = schemaHash(properties);
  const { error } = await supabase
    .schema("silver")
    .from("cbs_schema_snapshots")
    .upsert(
      {
        dataset_id: datasetId,
        source_version: sourceVersion,
        schema_hash: hash,
        properties,
        captured_at: new Date().toISOString(),
      },
      { onConflict: "dataset_id,source_version,schema_hash" }
    );

  if (error) throw error;
  return hash;
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

function periodTypeFromKey(periodKey) {
  const key = String(periodKey ?? "").trim().toUpperCase();
  if (/^\d{4}JJ/.test(key) || /^\d{4}$/.test(key)) return "year";
  if (/^\d{4}KW\d{2}/.test(key)) return "quarter";
  if (/^\d{4}MM\d{2}/.test(key)) return "month";
  if (/^\d{4}HJ\d{2}/.test(key)) return "half-year";
  return "other";
}

function periodDateBounds(periodKey) {
  const key = String(periodKey ?? "").trim().toUpperCase();
  const year = Number(key.slice(0, 4));
  if (!Number.isInteger(year) || year < 1970 || year > 2026) {
    return { year: null, start: null, end: null };
  }

  const monthMatch = key.match(/MM(\d{2})/);
  if (monthMatch) {
    const month = Number(monthMatch[1]);
    if (month >= 1 && month <= 12) {
      const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
      return {
        year,
        start: `${year}-${String(month).padStart(2, "0")}-01`,
        end: `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
      };
    }
  }

  const quarterMatch = key.match(/KW(\d{2})/);
  if (quarterMatch) {
    const quarter = Number(quarterMatch[1]);
    if (quarter >= 1 && quarter <= 4) {
      const startMonth = (quarter - 1) * 3 + 1;
      const endMonth = startMonth + 2;
      const lastDay = new Date(Date.UTC(year, endMonth, 0)).getUTCDate();
      return {
        year,
        start: `${year}-${String(startMonth).padStart(2, "0")}-01`,
        end: `${year}-${String(endMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
      };
    }
  }

  const halfYearMatch = key.match(/HJ(\d{2})/);
  if (halfYearMatch) {
    const halfYear = Number(halfYearMatch[1]);
    if (halfYear === 1 || halfYear === 2) {
      const startMonth = halfYear === 1 ? 1 : 7;
      const endMonth = halfYear === 1 ? 6 : 12;
      const lastDay = new Date(Date.UTC(year, endMonth, 0)).getUTCDate();
      return {
        year,
        start: `${year}-${String(startMonth).padStart(2, "0")}-01`,
        end: `${year}-${String(endMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
      };
    }
  }

  return { year, start: `${year}-01-01`, end: `${year}-12-31` };
}

function periodRowsFromDimensionValues(datasetId, dimensionValues, sourceVersion) {
  return dimensionValues
    .filter((value) => value.dimension_key === "Perioden")
    .map((value) => {
      const periodKey = String(value.value_key ?? "");
      const bounds = periodDateBounds(periodKey);
      return {
        dataset_id: datasetId,
        period_key: periodKey,
        year: bounds.year,
        period_type: periodTypeFromKey(periodKey),
        period_start_date: bounds.start,
        period_end_date: bounds.end,
        label: value.title ?? null,
        source_value: periodKey,
        source_version: sourceVersion,
        silver_loaded_at: new Date().toISOString(),
      };
    })
    .filter((row) => row.period_key);
}

function isGeographyDimensionKey(key) {
  const normalized = String(key ?? "").toLowerCase();
  return (
    normalized.includes("regio") ||
    normalized.includes("gebieden") ||
    normalized.includes("gemeente") ||
    normalized.includes("wijk") ||
    normalized.includes("buurt")
  );
}

function regionCodeParts(valueKey, regionLevel) {
  const key = String(valueKey ?? "").trim().toUpperCase();
  if (regionLevel === "province" && key.startsWith("PV")) return { provinceCode: key, municipalityCode: null };
  if (regionLevel === "municipality" && key.startsWith("GM")) return { provinceCode: null, municipalityCode: key };
  if (regionLevel === "neighborhood" && (key.startsWith("WK") || key.startsWith("BU"))) {
    return { provinceCode: null, municipalityCode: key.slice(0, 6) || null };
  }
  return { provinceCode: null, municipalityCode: null };
}

function regionRowsFromDimensionValues(datasetId, dimensionValues, sourceVersion) {
  return dimensionValues
    .filter((value) => isGeographyDimensionKey(value.dimension_key) || levelFromCbsGeoValue(value))
    .map((value) => {
      const regionLevel = levelFromCbsGeoValue(value) ?? "other";
      const parts = regionCodeParts(value.value_key, regionLevel);
      return {
        dataset_id: datasetId,
        dimension_key: value.dimension_key,
        region_code: String(value.value_key ?? ""),
        region_name: value.title ?? null,
        region_level: regionLevel,
        province_code: parts.provinceCode,
        municipality_code: parts.municipalityCode,
        valid_from: null,
        valid_to: null,
        source_value: String(value.value_key ?? ""),
        source_version: sourceVersion,
        silver_loaded_at: new Date().toISOString(),
      };
    })
    .filter((row) => row.region_code);
}

function datasetGrainRow(datasetId, dimensionProperties, dimensionValues, dataset, sourceVersion) {
  const periodRows = periodRowsFromDimensionValues(datasetId, dimensionValues, sourceVersion);
  const years = Array.from(new Set(periodRows.map((row) => row.year).filter(Boolean))).sort((a, b) => a - b);
  const periodTypes = Array.from(new Set(periodRows.map((row) => row.period_type).filter(Boolean))).sort();
  const geographyValues = dimensionValues.filter((value) => isGeographyDimensionKey(value.dimension_key) || levelFromCbsGeoValue(value));
  const geographicLevels = geographyLevelsFromDimensionValues(geographyValues);
  const regionRows = regionRowsFromDimensionValues(datasetId, dimensionValues, sourceVersion);
  const regionLevelSet = new Set(regionRows.map((row) => row.region_level));
  const spatialDimensionKeys = Array.from(new Set(regionRows.map((row) => row.dimension_key).filter(Boolean))).sort();
  const notes = [];

  if (years.length) notes.push("Years classified from Perioden dimension values.");
  else if (dataset?.period) notes.push("No Perioden dimension values available; catalog Period may still describe coverage.");
  if (spatialDimensionKeys.length) notes.push("Spatial grain classified from CBS geography dimension values.");
  else notes.push("No recognizable CBS geography dimension found.");

  const periodDimension = dimensionProperties.find((property) => property.Key === "Perioden" || property.Type === "TimeDimension");

  return {
    dataset_id: datasetId,
    has_country_level: regionLevelSet.has("country"),
    has_province_level: regionLevelSet.has("province"),
    has_municipality_level: regionLevelSet.has("municipality"),
    has_neighborhood_level: regionLevelSet.has("neighborhood"),
    has_other_region_level: regionLevelSet.has("other"),
    has_year: years.length > 0,
    min_year: years.length ? Math.min(...years) : null,
    max_year: years.length ? Math.max(...years) : null,
    years,
    period_types: periodTypes,
    spatial_dimension_keys: spatialDimensionKeys,
    period_dimension_key: periodDimension?.Key ?? null,
    spatial_coverage: spatialCoverageForLevels(geographicLevels),
    confidence: years.length && spatialDimensionKeys.length
      ? "cbs-dimensions"
      : years.length || spatialDimensionKeys.length
        ? "partial-cbs-dimensions"
        : "unqualified",
    classification_notes: notes,
    source_version: sourceVersion,
    silver_loaded_at: new Date().toISOString(),
  };
}

function propertyById(properties) {
  return new Map(properties.map((property) => [String(property.ID ?? property.Key), property]));
}

function topicPathForMeasure(property, propertiesById) {
  const titles = [];
  let cursor = property;
  const seen = new Set();

  while (cursor && !seen.has(String(cursor.ID ?? cursor.Key))) {
    seen.add(String(cursor.ID ?? cursor.Key));
    if (cursor.Title) titles.unshift(cursor.Title);
    const parentId = cursor.ParentID === undefined || cursor.ParentID === null ? null : String(cursor.ParentID);
    cursor = parentId ? propertiesById.get(parentId) : null;
  }

  return titles.join(" > ") || property.Title || property.Key || null;
}

function indicatorCandidateRows(datasetId, measureProperties, properties, sourceVersion) {
  const propertiesById = propertyById(properties);
  return measureProperties.map((property) => {
    const title = property.Title ?? property.Key ?? "";
    const unit = property.Unit ?? "";
    const combined = `${title} ${unit}`.toLowerCase();
    const isPercentage = combined.includes("%") || combined.includes("percentage") || combined.includes("procent");
    const isIndex = combined.includes("index");
    const isCount = /aantal|number|personen|huishoudens|woningen|bedrijven/.test(combined);

    return {
      dataset_id: datasetId,
      measure_key: property.Key,
      indicator_title: property.Title ?? property.Key,
      unit: property.Unit ?? null,
      decimals: property.Decimals ?? null,
      parent_measure_key: property.ParentID === undefined || property.ParentID === null ? null : String(property.ParentID),
      topic_path: topicPathForMeasure(property, propertiesById),
      is_additive: isPercentage || isIndex ? false : isCount ? true : null,
      is_percentage: isPercentage,
      is_count: isCount,
      is_index: isIndex,
      confidence: property.Title || property.Unit ? "source-metadata" : "low",
      source_version: sourceVersion,
      silver_loaded_at: new Date().toISOString(),
    };
  });
}

function cbsDomainRows(sourceVersion) {
  return loadCbsDomains().map((domain) => ({
    domain_id: domain.domain_id,
    canonical_name: domain.canonical_name,
    cbs_root_theme_title: domain.cbs_root_theme_title,
    aliases: domain.aliases ?? [],
    source_version: sourceVersion,
    silver_loaded_at: new Date().toISOString(),
  }));
}

async function datasetDomainRows(supabase, datasetId, sourceVersion) {
  const domains = loadCbsDomains();
  const domainByRootTheme = new Map(domains.map((domain) => [normalizeDomainText(domain.cbs_root_theme_title), domain]));

  const { data, error } = await supabase
    .schema("bronze")
    .from("cbs_dataset_theme_hierarchy")
    .select("dataset_id,top_theme_title,assigned_theme_title,theme_path")
    .eq("dataset_id", datasetId);

  if (error) {
    if (isMissingPublicTableError(error)) {
      console.warn(`Skipped Silver domain mapping for ${datasetId}: run supabase/bronze_schema.sql to create bronze.cbs_dataset_theme_hierarchy.`);
      return [];
    }
    throw error;
  }

  return (data ?? [])
    .map((row) => {
      const domain = domainByRootTheme.get(normalizeDomainText(row.top_theme_title));
      if (!domain) return null;
      return {
        dataset_id: datasetId,
        domain_id: domain.domain_id,
        root_theme_title: row.top_theme_title ?? "",
        assigned_theme_title: row.assigned_theme_title ?? "",
        theme_path: row.theme_path ?? "",
        confidence: "theme-root-match",
        assignment_reason: `CBS top-level theme "${row.top_theme_title}" maps to Guara domain "${domain.domain_id}".`,
        source_version: sourceVersion,
        silver_loaded_at: new Date().toISOString(),
      };
    })
    .filter(Boolean);
}

function goldReadinessRow({
  datasetId,
  domains,
  grain,
  dimensions,
  measures,
  expectedObservations,
  observationsLoaded,
  qualityStatus,
  sourceVersion,
}) {
  const spatialLevels = [
    grain.has_country_level ? "country" : null,
    grain.has_province_level ? "province" : null,
    grain.has_municipality_level ? "municipality" : null,
    grain.has_neighborhood_level ? "neighborhood" : null,
    grain.has_other_region_level ? "other" : null,
  ].filter(Boolean);
  const yearCoverage = grain.min_year && grain.max_year ? grain.max_year - grain.min_year + 1 : 0;
  let priorityScore = 0;
  if (domains.length) priorityScore += 20;
  if (grain.has_year) priorityScore += 20;
  if (grain.has_municipality_level || grain.has_province_level || grain.has_country_level) priorityScore += 20;
  if (measures > 0) priorityScore += 20;
  if (observationsLoaded > 0) priorityScore += 10;
  if (qualityStatus === "passed") priorityScore += 10;
  priorityScore = Math.min(100, priorityScore);

  const suggestedGoldModel = domains.length === 1
    ? `gold.${domains[0].domain_id.replaceAll("-", "_")}_facts`
    : domains.length > 1
      ? "gold.cross_domain_facts"
      : "gold.unclassified_cbs_facts";
  const recommendedAction = priorityScore >= 80
    ? "ready_for_gold_candidate"
    : priorityScore >= 50
      ? "review_before_gold"
      : "keep_in_silver";

  return {
    dataset_id: datasetId,
    domain_ids: domains.map((domain) => domain.domain_id),
    priority_score: priorityScore,
    record_count: expectedObservations ?? null,
    observation_count: observationsLoaded ?? 0,
    year_coverage: yearCoverage || null,
    min_year: grain.min_year,
    max_year: grain.max_year,
    spatial_levels: spatialLevels,
    measure_count: measures,
    dimension_count: dimensions,
    quality_status: qualityStatus ?? null,
    suggested_gold_model: suggestedGoldModel,
    recommended_action: recommendedAction,
    reason: [
      domains.length ? `Mapped to ${domains.length} domain(s).` : "No domain mapping found.",
      grain.has_year ? `Year coverage ${grain.min_year}-${grain.max_year}.` : "No year coverage classified.",
      spatialLevels.length ? `Spatial levels: ${spatialLevels.join(", ")}.` : "No spatial level classified.",
      `${measures} measure(s), ${dimensions} dimension(s).`,
    ].join(" "),
    source_version: sourceVersion,
    silver_loaded_at: new Date().toISOString(),
  };
}

async function upsertGoldReadinessForDataset(supabase, datasetId, sourceVersion, result) {
  let grain = result.metadataResult?.grain ?? null;
  let domainRows = result.metadataResult?.domainRows ?? null;

  if (!grain) {
    const { data, error } = await supabase
      .schema("silver")
      .from("cbs_dataset_grain")
      .select("*")
      .eq("dataset_id", datasetId)
      .maybeSingle();

    if (error) throw error;
    grain = data;
  }

  if (!domainRows) {
    const { data, error } = await supabase
      .schema("silver")
      .from("cbs_dataset_domains")
      .select("domain_id")
      .eq("dataset_id", datasetId);

    if (error) throw error;
    domainRows = data ?? [];
  }

  if (!grain) return;

  const dimensionCount = result.metadataResult?.dimensions ?? result.dimensionCount ?? await getExactDatasetCount(
    supabase,
    "silver",
    "cbs_dimensions",
    "dimension_key",
    datasetId
  );
  const measureCount = result.metadataResult?.measures ?? result.measureCount ?? await getExactDatasetCount(
    supabase,
    "silver",
    "cbs_measures",
    "measure_key",
    datasetId
  );

  const row = goldReadinessRow({
    datasetId,
    domains: domainRows ?? [],
    grain,
    dimensions: dimensionCount,
    measures: measureCount,
    expectedObservations: result.expectedObservations,
    observationsLoaded: result.observations ?? 0,
    qualityStatus: result.quality?.qualityStatus ?? null,
    sourceVersion,
  });

  await upsertOrThrow(
    supabase,
    "silver",
    "cbs_gold_readiness",
    [row],
    { onConflict: "dataset_id" }
  );
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
  const currentSchemaHash = await publishSilverSchemaSnapshot(supabase, datasetId, sourceVersion, properties);

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
      schema_hash: currentSchemaHash,
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

  const periodRows = periodRowsFromDimensionValues(datasetId, dimensionValues, sourceVersion);
  const regionRows = regionRowsFromDimensionValues(datasetId, dimensionValues, sourceVersion);
  const grain = datasetGrainRow(datasetId, dimensionProperties, dimensionValues, catalog, sourceVersion);
  const indicatorRows = indicatorCandidateRows(datasetId, measureProperties, properties, sourceVersion);
  const domainRows = await datasetDomainRows(supabase, datasetId, sourceVersion);

  await upsertOrThrow(
    supabase,
    "silver",
    "cbs_period_values",
    periodRows,
    { onConflict: "dataset_id,period_key" }
  );

  await upsertOrThrow(
    supabase,
    "silver",
    "cbs_region_values",
    regionRows,
    { onConflict: "dataset_id,dimension_key,region_code" }
  );

  await upsertOrThrow(
    supabase,
    "silver",
    "cbs_dataset_grain",
    [grain],
    { onConflict: "dataset_id" }
  );

  await upsertOrThrow(
    supabase,
    "silver",
    "cbs_indicator_candidates",
    indicatorRows,
    { onConflict: "dataset_id,measure_key" }
  );

  await upsertOrThrow(
    supabase,
    "silver",
    "cbs_domains",
    cbsDomainRows(sourceVersion),
    { onConflict: "domain_id" }
  );

  await upsertOrThrow(
    supabase,
    "silver",
    "cbs_dataset_domains",
    domainRows,
    { onConflict: "dataset_id,domain_id,root_theme_title,assigned_theme_title,theme_path" }
  );

  const themesResult = await loadThemesForDataset(supabase, datasetId, sourceVersion);
  const featuredResult = await loadFeaturedForDataset(supabase, datasetId, sourceVersion);

  return {
    dimensions: dimensionProperties.length,
    dimensionValues: dimensionValues.length,
    measures: measureProperties.length,
    periods: periodRows.length,
    regions: regionRows.length,
    indicators: indicatorRows.length,
    domains: domainRows.length,
    grain,
    domainRows,
    themes: themesResult.datasetThemes,
    featured: featuredResult.datasetFeatured,
    schemaHash: currentSchemaHash,
  };
}

async function loadThemesForDataset(supabase, datasetId, sourceVersion) {
  const { data: tableThemes, error: tableThemesError } = await supabase
    .schema("bronze")
    .from("cbs_table_themes")
    .select("table_identifier,theme_id,theme_number")
    .eq("table_identifier", datasetId);

  if (tableThemesError) throw tableThemesError;

  const themeIds = Array.from(new Set((tableThemes ?? []).map((row) => row.theme_id))).filter(Boolean);
  if (themeIds.length === 0) return { themes: 0, datasetThemes: 0 };

  const { data: themes, error: themesError } = await supabase
    .schema("bronze")
    .from("cbs_themes")
    .select("id,parent_id,number,title,language,catalog")
    .in("id", themeIds);

  if (themesError) throw themesError;

  await upsertOrThrow(
    supabase,
    "silver",
    "cbs_themes",
    (themes ?? []).map((theme) => ({
      theme_id: theme.id,
      parent_theme_id: theme.parent_id ?? null,
      theme_number: theme.number ?? null,
      title: theme.title ?? null,
      language: theme.language ?? null,
      catalog: theme.catalog ?? null,
      source_version: sourceVersion,
      silver_loaded_at: new Date().toISOString(),
    })),
    { onConflict: "theme_id" }
  );

  await upsertOrThrow(
    supabase,
    "silver",
    "cbs_dataset_themes",
    (tableThemes ?? []).map((row) => ({
      dataset_id: datasetId,
      theme_id: row.theme_id,
      theme_number: row.theme_number ?? null,
      source_version: sourceVersion,
      silver_loaded_at: new Date().toISOString(),
    })),
    { onConflict: "dataset_id,theme_id" }
  );

  return {
    themes: themes?.length ?? 0,
    datasetThemes: tableThemes?.length ?? 0,
  };
}

async function loadFeaturedForDataset(supabase, datasetId, sourceVersion) {
  const { data: tableFeatured, error: tableFeaturedError } = await supabase
    .schema("bronze")
    .from("cbs_table_featured")
    .select("table_identifier,featured_id")
    .eq("table_identifier", datasetId);

  if (tableFeaturedError) throw tableFeaturedError;

  const featuredIds = Array.from(new Set((tableFeatured ?? []).map((row) => row.featured_id))).filter(Boolean);
  if (featuredIds.length === 0) return { featured: 0, datasetFeatured: 0 };

  const { data: featured, error: featuredError } = await supabase
    .schema("bronze")
    .from("cbs_featured")
    .select("id,number,title,description,language,catalog")
    .in("id", featuredIds);

  if (featuredError) throw featuredError;

  await upsertOrThrow(
    supabase,
    "silver",
    "cbs_featured",
    (featured ?? []).map((item) => ({
      featured_id: item.id,
      number: item.number ?? null,
      title: item.title ?? null,
      description: item.description ?? null,
      language: item.language ?? null,
      catalog: item.catalog ?? null,
      source_version: sourceVersion,
      silver_loaded_at: new Date().toISOString(),
    })),
    { onConflict: "featured_id" }
  );

  await upsertOrThrow(
    supabase,
    "silver",
    "cbs_dataset_featured",
    (tableFeatured ?? []).map((row) => ({
      dataset_id: datasetId,
      featured_id: row.featured_id,
      source_version: sourceVersion,
      silver_loaded_at: new Date().toISOString(),
    })),
    { onConflict: "dataset_id,featured_id" }
  );

  return {
    featured: featured?.length ?? 0,
    datasetFeatured: tableFeatured?.length ?? 0,
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
    bronze_ingestion_run_id: row.ingestion_run_id ?? null,
    bronze_source_version: row.source_version ?? null,
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
      .select("dataset_id,row_id,row_index,raw,ingestion_run_id,source_version")
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

async function getGoldReadinessOverviewRows(supabase) {
  try {
    return await getOverviewRows(() =>
      supabase
        .schema("silver")
        .from("cbs_gold_readiness")
        .select("dataset_id,domain_ids,priority_score,recommended_action,suggested_gold_model,reason")
    );
  } catch (error) {
    if (isMissingPublicTableError(error)) return [];
    throw error;
  }
}

function normalizeText(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeDomainText(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function loadCbsDomains() {
  const path = resolve(process.cwd(), "config/cbs-domains.json");
  return JSON.parse(readFileSync(path, "utf8"));
}

function resolveCbsDomain(value) {
  if (!value) return null;
  const domains = loadCbsDomains();
  const normalized = normalizeDomainText(value);
  const domain = domains.find((item) => {
    const candidates = [
      item.domain_id,
      item.canonical_name,
      item.cbs_root_theme_title,
      ...(item.aliases ?? []),
    ];
    return candidates.some((candidate) => normalizeDomainText(candidate) === normalized);
  });

  if (!domain) {
    const available = domains.map((item) => item.domain_id).join(", ");
    throw new Error(`Unknown CBS domain "${value}". Available domains: ${available}`);
  }

  return domain;
}

async function getDatasetIdsForRootTheme(supabase, rootTheme) {
  const normalizedRootTheme = normalizeText(rootTheme);
  if (!normalizedRootTheme) return [];

  const rows = await getOverviewRows(() =>
    supabase
      .schema("bronze")
      .from("cbs_dataset_theme_hierarchy")
      .select("dataset_id,top_theme_title")
      .order("dataset_id", { ascending: true })
  );

  return Array.from(
    new Set(
      rows
        .filter((row) => normalizeText(row.top_theme_title) === normalizedRootTheme)
        .map((row) => row.dataset_id)
        .filter(Boolean)
    )
  ).sort();
}

async function getThemeRowsForDatasetIds(supabase, datasetIds) {
  if (datasetIds.length === 0) return [];
  const chunks = [];
  for (let index = 0; index < datasetIds.length; index += 200) {
    chunks.push(datasetIds.slice(index, index + 200));
  }

  const rows = [];
  for (const chunk of chunks) {
    const { data, error } = await supabase
      .schema("bronze")
      .from("cbs_dataset_theme_hierarchy")
      .select("dataset_id,top_theme_title,assigned_theme_title,theme_path")
      .in("dataset_id", chunk);

    if (error) throw error;
    rows.push(...(data ?? []));
  }

  return rows;
}

function themeSummaryByDataset(themeRows) {
  const byDataset = new Map();
  for (const row of themeRows) {
    const datasetId = row.dataset_id;
    if (!datasetId) continue;
    const current = byDataset.get(datasetId) ?? {
      topThemeTitles: [],
      assignedThemeTitles: [],
      themePaths: [],
    };
    current.topThemeTitles = Array.from(new Set([...current.topThemeTitles, row.top_theme_title].filter(Boolean)));
    current.assignedThemeTitles = Array.from(new Set([...current.assignedThemeTitles, row.assigned_theme_title].filter(Boolean)));
    current.themePaths = Array.from(new Set([...current.themePaths, row.theme_path].filter(Boolean)));
    byDataset.set(datasetId, current);
  }
  return byDataset;
}

async function getCatalogRowsForDatasetIds(supabase, datasetIds) {
  if (datasetIds.length === 0) return [];

  const rows = [];
  for (let index = 0; index < datasetIds.length; index += 200) {
    const chunk = datasetIds.slice(index, index + 200);
    const { data, error } = await supabase
      .schema("bronze")
      .from("cbs_raw_endpoint_payloads")
      .select("dataset_id,payload,ingested_at")
      .eq("endpoint", "catalog_table")
      .in("dataset_id", chunk)
      .order("dataset_id", { ascending: true });

    if (error) throw error;
    rows.push(...(data ?? []));
  }

  const order = new Map(datasetIds.map((id, index) => [id, index]));
  return rows.sort((a, b) => (order.get(a.dataset_id) ?? 0) - (order.get(b.dataset_id) ?? 0));
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
    row.rootThemes?.join(" "),
    row.assignedThemes?.join(" "),
    row.themePaths?.join(" "),
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
    return row.silverStatus === STATUS.FAILED ? "failed_metadata" : "metadata_only";
  }
  if (row.silverStatus === STATUS.FAILED) return "failed_partial";
  if (row.silverRejectedRows > 0 && [STATUS.COMPLETE_WITH_WARNINGS, "completed_with_rejections"].includes(row.silverStatus)) return "complete_with_warnings";
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
    complete: rows.filter((row) => row.silverClassification === "complete" || row.silverClassification === "complete_with_warnings").length,
    partial: rows.filter((row) => row.silverClassification.includes("partial")).length,
    metadataOnly: rows.filter((row) => row.silverClassification === "metadata_only").length,
    notLoaded: rows.filter((row) => row.silverClassification === "not_loaded").length,
    byStatus,
  };
}

function compactSilverOverviewTable(rows) {
  return rows.map((row) => ({
    id: row.datasetId,
    rootTheme: (row.rootThemes ?? []).slice(0, 1).join(", "),
    title: row.title.slice(0, 52),
    apiRecords: row.bronzeRecordCount ?? "unknown",
    bronzeRows: row.bronzeRowsLoaded,
    silverRows: row.silverObservationsLoaded,
    pctOfBronze: row.silverPercentageOfBronze ?? "unknown",
    status: row.silverClassification,
    bronzeStatus: row.bronzeStatus ?? "",
    silverStatus: row.silverStatus ?? "",
    rejected: row.silverRejectedRows,
    goldScore: row.goldPriorityScore ?? "",
    goldAction: row.goldRecommendedAction ?? "",
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
  const rawCatalogRowsPromise = options.rootTheme
    ? getBronzeDatasets(supabase, options)
    : (async () => {
        let rawCatalogQuery = supabase
          .schema("bronze")
          .from("cbs_raw_endpoint_payloads")
          .select("dataset_id,payload,ingested_at")
          .eq("endpoint", "catalog_table")
          .order("dataset_id", { ascending: true })
          .limit(options.limit);

        if (options.dataset) rawCatalogQuery = rawCatalogQuery.eq("dataset_id", options.dataset);

        const { data, error } = await rawCatalogQuery;
        if (error) throw error;
        return data ?? [];
      })();

  const [rawCatalogRows, bronzeStatusRows, silverStatusRows, silverDatasetRows, goldReadinessRows] =
    await Promise.all([
      rawCatalogRowsPromise,
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
      getGoldReadinessOverviewRows(supabase),
    ]);

  const bronzeStatusById = new Map(bronzeStatusRows.map((row) => [row.dataset_id, row]));
  const silverStatusById = new Map(silverStatusRows.map((row) => [row.dataset_id, row]));
  const silverDatasetById = new Map(silverDatasetRows.map((row) => [row.dataset_id, row]));
  const goldReadinessById = new Map(goldReadinessRows.map((row) => [row.dataset_id, row]));
  const themeByDataset = themeSummaryByDataset(await getThemeRowsForDatasetIds(supabase, rawCatalogRows.map((row) => row.dataset_id)));

  const baseRows = rawCatalogRows
    .map((row) => {
      const payload = row.payload ?? {};
      const bronzeStatus = bronzeStatusById.get(row.dataset_id);
      const silverStatus = silverStatusById.get(row.dataset_id);
      const silverDataset = silverDatasetById.get(row.dataset_id);
      const goldReadiness = goldReadinessById.get(row.dataset_id);
      const theme = themeByDataset.get(row.dataset_id) ?? {};

      return {
        datasetId: row.dataset_id,
        rootThemes: theme.topThemeTitles ?? [],
        assignedThemes: theme.assignedThemeTitles ?? [],
        themePaths: theme.themePaths ?? [],
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
        goldPriorityScore: goldReadiness?.priority_score ?? null,
        goldRecommendedAction: goldReadiness?.recommended_action ?? null,
        goldSuggestedModel: goldReadiness?.suggested_gold_model ?? null,
        goldReadinessReason: goldReadiness?.reason ?? null,
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
      domain: options.domain || null,
      rootTheme: options.rootTheme || null,
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

async function loadSilverDataset(supabase, dataset, options) {
  const datasetId = dataset.dataset_id;
  const sourceVersion = dataset.payload?.Updated ?? null;

  try {
    if (await shouldSkipDataset(supabase, datasetId, sourceVersion, options)) {
      console.log(`Skipped ${datasetId}: already completed for source version ${sourceVersion}.`);
      return { datasetId, status: STATUS.SKIPPED };
    }

    if (options.force) {
      console.log(`Force enabled: deleting Silver rows for ${datasetId}`);
      await deleteSilverDatasetRows(supabase, datasetId);
    }

    const bronzeStatus = await getBronzeStatus(supabase, datasetId);
    const expectedObservations = bronzeStatus?.loaded_row_count ?? bronzeStatus?.record_count ?? null;
    const runId = await startRun(supabase, datasetId, sourceVersion, expectedObservations);

    try {
      console.log(`Loading Silver dataset ${datasetId}`);

      let metadataResult = null;

      if (!options.rowsOnly) {
        metadataResult = await loadMetadataForDataset(supabase, datasetId, sourceVersion);
        const metadataQuality = silverQualityChecks({
          metadataResult,
          expectedObservations,
          observationsLoaded: await getExactDatasetCount(supabase, "silver", "cbs_observations", "row_id", datasetId),
          rejected: 0,
          status: STATUS.METADATA_LOADED,
        });
        await updateDatasetStatus(supabase, datasetId, sourceVersion, STATUS.METADATA_LOADED, {
          expectedObservations,
          schemaHash: metadataResult.schemaHash,
          quality: metadataQuality,
        });
      }

      let result = { observations: 0, dimensionLinks: 0, measures: 0, rejected: 0, expectedObservations };

      if (!options.metadataOnly) {
        result = await loadRowsForDataset(supabase, datasetId, sourceVersion, options);
      }

      const totalObservations = await getExactDatasetCount(supabase, "silver", "cbs_observations", "row_id", datasetId);
      const totalRejected = await getExactDatasetCount(supabase, "silver", "cbs_rejected_rows", "row_id", datasetId);
      const finalStatus = options.metadataOnly
        ? STATUS.METADATA_LOADED
        : expectedObservations !== null && totalObservations + totalRejected < expectedObservations
          ? STATUS.PARTIAL
          : totalRejected > 0
            ? STATUS.COMPLETE_WITH_WARNINGS
            : STATUS.COMPLETE;
      const quality = silverQualityChecks({
        metadataResult,
        expectedObservations,
        observationsLoaded: totalObservations,
        rejected: totalRejected,
        status: finalStatus,
      });
      result = {
        ...result,
        observations: totalObservations,
        rejected: totalRejected,
        expectedObservations,
        schemaHash: metadataResult?.schemaHash ?? bronzeStatus?.schema_hash ?? null,
        quality,
        metadataResult,
      };

      await upsertGoldReadinessForDataset(supabase, datasetId, sourceVersion, result);
      await finishRun(supabase, runId, finalStatus, result);
      await updateDatasetStatus(supabase, datasetId, sourceVersion, finalStatus, result);

      if (!options.skipPublicRefresh) {
        await publishPublicQualityChecks(supabase, datasetId, "silver", quality);
        await publishPublicSilverDataset(supabase, datasetId);
        await publishSourceLayerSummary(supabase, "silver");
      }

      console.log(
        `Silver ${finalStatus} ${datasetId}: ${result.observations}/${expectedObservations ?? "unknown"} observations, ${result.dimensionLinks} dimension links, ${result.measures} measures, ${result.rejected} rejected`
      );

      return { datasetId, status: finalStatus, result };
    } catch (error) {
      await finishRun(supabase, runId, STATUS.FAILED, { expectedObservations }, error.message);
      await updateDatasetStatus(supabase, datasetId, sourceVersion, STATUS.FAILED, { expectedObservations }, error.message);

      if (!options.skipPublicRefresh) {
        await publishPublicSilverDataset(supabase, datasetId).catch((publishError) => {
          console.warn(`Skipped public silver catalog publish for ${datasetId}: ${publishError.message}`);
        });
        await publishSourceLayerSummary(supabase, "silver").catch(() => {});
      }

      throw error;
    }
  } catch (error) {
    console.error(`Failed Silver load for ${datasetId}: ${error.message}`);
    return { datasetId, status: STATUS.FAILED, error: error.message };
  }
}

async function main() {
  loadLocalEnv();
  const options = parseArgs(process.argv);
  const selectedDomain = resolveCbsDomain(options.domain);

  if (selectedDomain) {
    if (options.rootTheme && normalizeDomainText(options.rootTheme) !== normalizeDomainText(selectedDomain.cbs_root_theme_title)) {
      throw new Error(`--domain ${options.domain} maps to root theme "${selectedDomain.cbs_root_theme_title}", but --root-theme was "${options.rootTheme}". Use one selector.`);
    }
    options.rootTheme = selectedDomain.cbs_root_theme_title;
  }

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
  console.log(
    `Found ${datasets.length} Bronze dataset(s) to load into Silver${selectedDomain ? ` for domain "${selectedDomain.domain_id}"` : options.rootTheme ? ` for root theme "${options.rootTheme}"` : ""}.`
  );

  if (options.rootTheme && datasets.length === 0) {
    console.log(`No Bronze datasets matched root theme "${options.rootTheme}". Check bronze.cbs_dataset_theme_hierarchy.`);
  }

  console.log(
    `Silver load settings: batch size ${options.batchSize}, dataset concurrency ${Math.max(1, options.loadConcurrency)}, public refresh ${options.skipPublicRefresh ? "skipped" : "enabled"}.`
  );

  const results = await mapWithConcurrency(datasets, options.loadConcurrency, (dataset) =>
    loadSilverDataset(supabase, dataset, options)
  );

  if (options.skipPublicRefresh) {
    console.log("Refreshing Silver source layer summary once after load...");
    await publishSourceLayerSummary(supabase, "silver").catch((error) => {
      console.warn(`Skipped final source layer summary refresh: ${error.message}`);
    });
  }

  const summary = results.reduce((acc, result) => {
    acc[result.status] = (acc[result.status] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`Silver load summary: ${JSON.stringify(summary)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
