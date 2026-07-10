#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const IMPORTANT_TERMS = [
  "bevolking",
  "migratie",
  "verhuiz",
  "wonen",
  "woning",
  "huizen",
  "inkomen",
  "arbeid",
  "werkloos",
  "onderwijs",
  "gezondheid",
  "zorg",
  "veiligheid",
  "criminaliteit",
  "energie",
  "milieu",
  "regionaal",
  "gemeente",
  "wijken",
  "buurten",
  "kerncijfers",
];

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
    query: "",
    limit: 100,
    minScore: 0,
    recommendation: "",
    output: "table",
    writeJson: false,
    jsonPath: "",
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dataset") options.dataset = argv[++i] ?? "";
    else if (arg === "--query") options.query = argv[++i] ?? "";
    else if (arg === "--limit") options.limit = Number(argv[++i] ?? options.limit);
    else if (arg === "--min-score") options.minScore = Number(argv[++i] ?? options.minScore);
    else if (arg === "--recommendation") options.recommendation = argv[++i] ?? "";
    else if (arg === "--output") options.output = argv[++i] ?? options.output;
    else if (arg === "--write-json") options.writeJson = true;
    else if (arg === "--json-path") options.jsonPath = argv[++i] ?? "";
    else if (arg === "--help") {
      console.log(`Usage:
  npm run plan:cbs:silver -- --limit 100
  npm run plan:cbs:silver -- --query wijken --limit 50
  npm run plan:cbs:silver -- --recommendation recommended --limit 100
  npm run plan:cbs:silver -- --min-score 70 --write-json

Options:
  --dataset 85039NED              Score one dataset.
  --query wijken                  Filter by title, description, theme, featured group, or status.
  --limit 100                     Maximum rows printed after scoring.
  --min-score 70                  Only include datasets at or above this score.
  --recommendation recommended    Filter recommendation.
  --output table|json             Console output.
  --write-json                    Write full report to reports/.
`);
      process.exit(0);
    }
  }

  return options;
}

async function getRows(queryFactory, pageSize = 1000) {
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await queryFactory().range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

function includesAny(text, terms) {
  const normalized = String(text ?? "").toLowerCase();
  return terms.filter((term) => normalized.includes(term));
}

function geographicScore(levels = []) {
  const set = new Set(levels);
  if (set.has("neighborhood")) return { score: 25, reason: "neighborhood coverage" };
  if (set.has("municipality")) return { score: 23, reason: "municipality coverage" };
  if (set.has("province")) return { score: 12, reason: "province coverage" };
  if (set.has("country")) return { score: 5, reason: "country coverage" };
  return { score: -10, reason: "no recognized geography" };
}

function yearScore(row) {
  const yearCount = Array.isArray(row.years) ? row.years.length : 0;
  if (yearCount >= 10) return { score: 15, reason: `${yearCount} years` };
  if (yearCount >= 3) return { score: 10, reason: `${yearCount} years` };
  if (yearCount >= 1) return { score: 4, reason: `${yearCount} year` };
  return { score: -5, reason: "unknown years" };
}

function sizeScore(row) {
  const rows = row.loaded_row_count ?? row.record_count ?? 0;
  const dimensions = row.dimension_count ?? 0;
  const measures = Math.max(0, (row.property_count ?? 0) - dimensions);
  const estimatedSilverRows = rows * Math.max(1, dimensions + measures);

  if (rows === 0) return { score: -25, reason: "no Bronze rows loaded", estimatedSilverRows };
  if (rows <= 100_000 && measures <= 80) return { score: 18, reason: "manageable row and measure count", estimatedSilverRows };
  if (rows <= 500_000 && measures <= 120) return { score: 8, reason: "medium load cost", estimatedSilverRows };
  if (rows > 2_000_000 || measures > 250) return { score: -25, reason: "large Silver expansion risk", estimatedSilverRows };
  return { score: -5, reason: "high load cost", estimatedSilverRows };
}

function completenessScore(row) {
  if (["complete", "complete_with_warnings", "completed", "completed_with_rejections"].includes(row.status)) {
    return { score: 20, reason: "Bronze complete" };
  }
  if (row.loaded_row_count > 0) return { score: 5, reason: "Bronze partially loaded" };
  return { score: -20, reason: "Bronze metadata only or failed" };
}

function scoreDataset(row) {
  const reasons = [];
  let score = 0;

  const geo = geographicScore(row.geographic_levels);
  score += geo.score;
  reasons.push(geo.reason);

  const years = yearScore(row);
  score += years.score;
  reasons.push(years.reason);

  const completeness = completenessScore(row);
  score += completeness.score;
  reasons.push(completeness.reason);

  const size = sizeScore(row);
  score += size.score;
  reasons.push(size.reason);

  const searchableText = [
    row.title,
    row.description,
    row.spatial_coverage,
    row.theme_titles?.join(" "),
    row.featured_titles?.join(" "),
  ].join(" ");
  const matchedTerms = includesAny(searchableText, IMPORTANT_TERMS);
  if (matchedTerms.length > 0) {
    score += Math.min(20, matchedTerms.length * 4);
    reasons.push(`research terms: ${matchedTerms.slice(0, 5).join(", ")}`);
  }

  if ((row.featured_titles ?? []).length > 0) {
    score += 8;
    reasons.push("CBS featured");
  }

  let recommendation = "metadata_only";
  if (score >= 75 && size.estimatedSilverRows < 50_000_000) recommendation = "recommended";
  else if (score >= 55 && size.estimatedSilverRows < 150_000_000) recommendation = "load_later";
  else if (size.estimatedSilverRows >= 150_000_000 || (row.property_count ?? 0) > 300) recommendation = "needs_review";
  else if ((row.loaded_row_count ?? 0) === 0) recommendation = "metadata_only";
  else recommendation = "skip_for_now";

  return {
    ...row,
    priority_score: Math.max(0, Math.min(100, Math.round(score))),
    recommendation,
    estimated_silver_rows: size.estimatedSilverRows,
    reasons,
  };
}

function matchesQuery(row, query) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return [
    row.dataset_id,
    row.title,
    row.description,
    row.status,
    row.spatial_coverage,
    row.theme_titles?.join(" "),
    row.featured_titles?.join(" "),
  ].some((value) => String(value ?? "").toLowerCase().includes(normalized));
}

function compactRows(rows) {
  return rows.map((row) => ({
    id: row.dataset_id,
    score: row.priority_score,
    recommendation: row.recommendation,
    bronzeRows: row.loaded_row_count ?? 0,
    properties: row.property_count ?? 0,
    levels: (row.geographic_levels ?? []).join(","),
    years: row.year_start && row.year_end ? `${row.year_start}-${row.year_end}` : "",
    title: String(row.title ?? "").slice(0, 58),
    reason: row.reasons.slice(0, 3).join("; "),
  }));
}

function writeJson(report, options) {
  const directory = resolve(process.cwd(), "reports");
  mkdirSync(directory, { recursive: true });
  const filename =
    options.jsonPath ||
    resolve(directory, `cbs-silver-plan-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(filename, `${JSON.stringify(report, null, 2)}\n`);
  return filename;
}

async function main() {
  loadLocalEnv();
  const options = parseArgs(process.argv);
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl) throw new Error("Missing SUPABASE_URL or VITE_SUPABASE_URL.");
  if (!serviceRoleKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let statusQuery = supabase
    .schema("bronze")
    .from("cbs_dataset_ingestion_status")
    .select("dataset_id,title,record_count,loaded_row_count,status,last_ingested_at,error_message");
  if (options.dataset) statusQuery = statusQuery.eq("dataset_id", options.dataset);

  const [statuses, catalogRows, dimensions, tableThemes, themes, tableFeatured, featured] = await Promise.all([
    getRows(() => statusQuery.order("dataset_id", { ascending: true })),
    getRows(() => supabase.from("dataset_catalog").select("*")),
    getRows(() => supabase.from("dataset_dimensions").select("dataset_id,key,type,values_count")),
    getRows(() => supabase.schema("bronze").from("cbs_table_themes").select("table_identifier,theme_id")),
    getRows(() => supabase.schema("bronze").from("cbs_themes").select("id,title,number")),
    getRows(() => supabase.schema("bronze").from("cbs_table_featured").select("table_identifier,featured_id")),
    getRows(() => supabase.schema("bronze").from("cbs_featured").select("id,title,number")),
  ]);

  const catalogById = new Map(catalogRows.map((row) => [row.id, row]));
  const dimensionsByDataset = new Map();
  for (const dimension of dimensions) {
    const rows = dimensionsByDataset.get(dimension.dataset_id) ?? [];
    rows.push(dimension);
    dimensionsByDataset.set(dimension.dataset_id, rows);
  }

  const themeById = new Map(themes.map((theme) => [theme.id, theme]));
  const featuredById = new Map(featured.map((item) => [item.id, item]));
  const themeTitlesByDataset = new Map();
  for (const link of tableThemes) {
    const theme = themeById.get(link.theme_id);
    if (!theme) continue;
    const titles = themeTitlesByDataset.get(link.table_identifier) ?? [];
    titles.push(theme.title);
    themeTitlesByDataset.set(link.table_identifier, titles);
  }
  const featuredTitlesByDataset = new Map();
  for (const link of tableFeatured) {
    const item = featuredById.get(link.featured_id);
    if (!item) continue;
    const titles = featuredTitlesByDataset.get(link.table_identifier) ?? [];
    titles.push(item.title);
    featuredTitlesByDataset.set(link.table_identifier, titles);
  }

  const scored = statuses
    .map((status) => {
      const catalog = catalogById.get(status.dataset_id) ?? {};
      const datasetDimensions = dimensionsByDataset.get(status.dataset_id) ?? [];
      return scoreDataset({
        ...status,
        ...catalog,
        title: catalog.title ?? status.title,
        description: catalog.description ?? null,
        record_count: status.record_count ?? catalog.record_count ?? null,
        property_count: datasetDimensions.length,
        dimension_count: datasetDimensions.filter((dimension) => String(dimension.type ?? "").includes("Dimension") || String(dimension.type ?? "").includes("Geo")).length,
        theme_titles: themeTitlesByDataset.get(status.dataset_id) ?? [],
        featured_titles: featuredTitlesByDataset.get(status.dataset_id) ?? [],
      });
    })
    .filter((row) => matchesQuery(row, options.query))
    .filter((row) => row.priority_score >= options.minScore)
    .filter((row) => !options.recommendation || row.recommendation === options.recommendation)
    .sort((a, b) => b.priority_score - a.priority_score || (b.loaded_row_count ?? 0) - (a.loaded_row_count ?? 0));

  const rows = scored.slice(0, Math.max(1, options.limit));
  const summary = scored.reduce((acc, row) => {
    acc[row.recommendation] = (acc[row.recommendation] ?? 0) + 1;
    return acc;
  }, {});
  const report = {
    generatedAt: new Date().toISOString(),
    scope: {
      dataset: options.dataset || null,
      query: options.query || null,
      minScore: options.minScore,
      recommendation: options.recommendation || null,
      limit: options.limit,
    },
    summary,
    rows,
  };

  if (options.output === "json") console.log(JSON.stringify(report, null, 2));
  else {
    console.log("\nCBS Silver load plan");
    console.log(JSON.stringify(summary, null, 2));
    console.table(compactRows(rows));
  }

  if (options.writeJson) {
    const path = writeJson(report, options);
    console.log(`Wrote JSON report: ${path}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
