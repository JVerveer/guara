#!/usr/bin/env node
import { createPostgresClient, explainPostgresConnectionError, loadLocalEnv, normalizeKey } from "./lib/runtime.mjs";

const PROMPT_VERSION = "ai_semantic_reviewer_v1";
const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_OLLAMA_URL = "http://localhost:11434";

function parseArgs(argv) {
  const options = {
    domain: "",
    dataset: "",
    status: "",
    risk: "",
    limit: 25,
    missingOnly: true,
    provider: process.env.SEMANTIC_REVIEW_PROVIDER || "auto",
    model: process.env.OPENAI_SEMANTIC_REVIEW_MODEL || process.env.OPENAI_MODEL || DEFAULT_MODEL,
    ollamaUrl: process.env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_URL,
    statementTimeoutMs: 600000,
    noLocalFallback: false,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--domain") options.domain = argv[++index] ?? "";
    else if (arg === "--dataset") options.dataset = String(argv[++index] ?? "").toUpperCase();
    else if (arg === "--status") options.status = argv[++index] ?? "";
    else if (arg === "--risk") options.risk = argv[++index] ?? "";
    else if (arg === "--limit") options.limit = Number(argv[++index] ?? options.limit);
    else if (arg === "--provider") options.provider = normalizeKey(argv[++index] ?? options.provider);
    else if (arg === "--model") options.model = argv[++index] ?? options.model;
    else if (arg === "--ollama-url") options.ollamaUrl = argv[++index] ?? options.ollamaUrl;
    else if (arg === "--all") options.missingOnly = false;
    else if (arg === "--no-local-fallback") options.noLocalFallback = true;
    else if (arg === "--statement-timeout-ms") options.statementTimeoutMs = Number(argv[++index] ?? options.statementTimeoutMs);
    else if (arg === "--help") {
      console.log(`Usage:
  npm run review:semantic:ai
  npm run review:semantic:ai -- --provider ollama --model llama3.1 --limit 25
  npm run review:semantic:ai -- --domain bouwen-en-wonen --limit 50
  npm run review:semantic:ai -- --status needs_fix --risk high --all

Options:
  --domain <domain_id>             Limit reviews to one Gold domain.
  --dataset <CBS code>             Limit reviews to one dataset.
  --status <review_status>         Limit by semantic.metric_contract_review.review_status.
  --risk <risk_level>              Limit by risk level.
  --limit 25                       Number of contracts to review.
  --all                            Re-review rows that already have an AI review.
  --provider auto                  auto, openai, ollama, or local_rules.
  --model <model>                  OpenAI model. Defaults to OPENAI_SEMANTIC_REVIEW_MODEL, OPENAI_MODEL, then ${DEFAULT_MODEL}.
  --ollama-url <url>               Ollama base URL. Defaults to ${DEFAULT_OLLAMA_URL}.
  --no-local-fallback              Fail if OPENAI_API_KEY is missing instead of writing local_rules reviews.
  --statement-timeout-ms 600000    Postgres statement timeout.
`);
      process.exit(0);
    }
  }

  return options;
}

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean).map(String) : [];
}

function enumValue(value, allowed, fallback) {
  const normalized = normalizeKey(value).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return allowed.includes(normalized) ? normalized : fallback;
}

function normalizeConfidence(value, fallback) {
  const raw = typeof value === "string" ? Number(value.replace("%", "").trim()) : Number(value);
  if (Number.isFinite(raw)) {
    if (raw === 0) return fallback;
    if (raw > 1 && raw <= 100) return Math.max(0, Math.min(1, raw / 100));
    if (raw >= 0 && raw <= 1) return raw;
  }
  return fallback;
}

function normalizeAggregation(value) {
  const normalized = normalizeKey(value);
  if (["sum", "average", "avg", "median", "min", "max", "count", "none"].includes(normalized)) {
    return normalized === "avg" ? "average" : normalized;
  }
  return "unknown";
}

function metricTypeFromText(row) {
  const text = normalizeKey(`${row.label} ${row.suggested_contract?.description ?? ""} ${row.suggested_contract?.unit_code ?? ""}`);
  if (text.includes("%") || text.includes("percentage") || text.includes("procent") || text.includes("aandeel")) return "percentage";
  if (text.includes("ratio") || text.includes("verhouding") || text.includes("per inwoner") || text.includes("per persoon")) return "ratio";
  if (text.includes("gemiddeld") || text.includes("average") || text.includes("median") || text.includes("mediaan")) return "average_or_median";
  if (text.includes("index") || text.includes("vertrouwen") || text.includes("saldo")) return "index";
  if (text.includes("waarde") || text.includes("inkomen") || text.includes("bedrag") || text.includes("kosten") || text.includes("uitgaven") || text.includes("bestedingen")) return "amount";
  if (text.includes("aantal") || text.includes("woningen") || text.includes("personen") || text.includes("huishoudens") || text.includes("achterstanden")) return "count";
  return "unknown";
}

function classifyAggregation(row) {
  const contract = row.suggested_contract ?? {};
  const aggregation = normalizeAggregation(contract.aggregation);
  const metricType = metricTypeFromText(row);
  if (["percentage", "ratio", "average_or_median", "index"].includes(metricType)) {
    return {
      aggregation_classification: "non_additive",
      recommended_aggregation: aggregation === "median" ? "median" : "average",
      is_additive: false,
    };
  }
  if (aggregation === "sum" || contract.is_additive === true) {
    return { aggregation_classification: "additive", recommended_aggregation: "sum", is_additive: true };
  }
  if (aggregation && aggregation !== "unknown" && aggregation !== "none") {
    return {
      aggregation_classification: aggregation === "sum" ? "additive" : "non_additive",
      recommended_aggregation: aggregation,
      is_additive: aggregation === "sum",
    };
  }
  return { aggregation_classification: "unknown", recommended_aggregation: "unknown", is_additive: null };
}

function unitQuality(contract) {
  const unit = String(contract.unit_code || contract.unit_name || "").trim();
  if (!unit || unit === "UNKNOWN") return "missing";
  if (["COUNT", "EUR", "EUR_THOUSANDS", "PERCENT", "INDEX", "UNKNOWN"].includes(unit)) return unit === "UNKNOWN" ? "missing" : "standard";
  return "source_specific";
}

function grainSummary(validGrains) {
  return {
    municipality_year: validGrains.includes("municipality_year"),
    province_year: validGrains.includes("province_year"),
    region_year: validGrains.includes("region_year"),
    national_year: validGrains.includes("national_year"),
  };
}

function labelLooksLikeDimensionValue(row) {
  const label = normalizeKey(row.label);
  const code = normalizeKey(row.measure_code);
  const value = `${label} ${code}`.trim();
  const exact = new Set([
    "totaal",
    "overig",
    "weet niet",
    "weetniet",
    "ja",
    "nee",
    "waarschijnlijk",
    "onwaarschijnlijk",
    "zeer waarschijnlijk",
    "zeer onwaarschijnlijk",
    "gunstige tijd",
    "ongunstige tijd",
    "een goed moment",
    "een slecht moment",
  ]);
  if (exact.has(label)) return true;
  return [
    "veel beter",
    "veel slechter",
    "een beetje beter",
    "een beetje slechter",
    "hetzelfde gebleven",
    "hetzelfde blijven",
    "gelijk blijven",
    "sterk stijgen",
    "sterk dalen",
    "matig gestegen",
    "zwak gestegen",
    "precies rondkomen",
    "schulden maken",
    "spaartegoeden aanspreken",
    "veel geld overhouden",
    "beetje geld overhouden",
    "kleding en schoenen",
    "auto en vervoer",
    "horeca sport cultuur",
    "op alles op niets",
  ].some((needle) => value.includes(needle));
}

function sourceYears(capability) {
  const years = asArray(capability?.available_years).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  return {
    min_year: capability?.min_year ?? years[0] ?? null,
    max_year: capability?.max_year ?? years[years.length - 1] ?? null,
    available_year_count: years.length,
    sample_years: years.length > 12 ? [...years.slice(0, 6), "...", ...years.slice(-6)] : years,
  };
}

function makeBusinessDefinition(row, contract, metricType, aggregation) {
  const capability = row.source_capability ?? {};
  const years = sourceYears(capability);
  const grains = asArray(contract.valid_grains);
  const unit = contract.unit_code || capability.unit_code || capability.unit_name || "source unit";
  const datasetTitle = capability.dataset_title || capability.dataset_code || row.dataset_code;
  const base = contract.description && !contract.description.startsWith("Generated semantic contract candidate")
    ? contract.description
    : `${row.label} is a CBS-backed measure from ${datasetTitle}.`;
  const yearText = years.min_year && years.max_year ? ` It is available in Gold for ${years.min_year}-${years.max_year}.` : "";
  const grainText = grains.length ? ` Supported grains: ${grains.join(", ")}.` : " No reliable analytical grain has been profiled yet.";
  return `${base} Metric type: ${metricType}. Recommended aggregation: ${aggregation.recommended_aggregation}. Unit: ${unit}.${yearText}${grainText}`;
}

function enrichSynonyms(row, contract) {
  const label = String(row.label ?? "").trim();
  const measureCode = String(row.measure_code ?? "").trim();
  const existing = contract.synonyms ?? {};
  const nl = new Set(asArray(existing.nl));
  const en = new Set(asArray(existing.en));
  for (const value of [label, measureCode]) {
    if (value) nl.add(value);
  }
  const normalized = normalizeKey(label);
  if (normalized.includes("woz")) {
    nl.add("woningwaarde");
    nl.add("woz waarde");
    en.add("home value");
  }
  if (normalized.includes("huur")) {
    nl.add("huurwoningen");
    nl.add("huur");
    en.add("rental homes");
  }
  if (normalized.includes("nieuwbouw")) {
    nl.add("nieuwbouwwoningen");
    nl.add("gebouwde woningen");
    en.add("newly built dwellings");
  }
  if (normalized.includes("betalingsachterstand")) {
    nl.add("betalingsachterstanden");
    nl.add("zorgpremie achterstand");
    en.add("payment arrears");
  }
  if (normalized.includes("consumentenvertrouwen")) {
    nl.add("consumenten vertrouwen");
    en.add("consumer confidence");
  }
  if (normalized.includes("inkomen")) {
    nl.add("inkomen");
    en.add("income");
  }
  return { nl: Array.from(nl).filter(Boolean), en: Array.from(en).filter(Boolean) };
}

function localRulesReview(row) {
  const contract = row.suggested_contract ?? {};
  const diagnostic = row.diagnostic_summary ?? {};
  const capability = row.source_capability ?? {};
  const aggregation = classifyAggregation(row);
  const metricType = metricTypeFromText(row);
  const validGrains = asArray(contract.valid_grains);
  const unitStatus = unitQuality(contract);
  const years = sourceYears(capability);
  const warnings = [];
  if (unitStatus === "missing") warnings.push("missing_unit");
  if (unitStatus === "source_specific") warnings.push("source_specific_unit");
  if (!validGrains.length) warnings.push("missing_grain");
  if (Number(diagnostic.blocking_count ?? 0) > 0) warnings.push("blocking_diagnostics");
  if (aggregation.recommended_aggregation === "unknown") warnings.push("unclear_aggregation");
  if (Number(capability.populated_fact_rows ?? 0) <= 0) warnings.push("no_populated_gold_facts");
  if (!years.min_year || !years.max_year) warnings.push("missing_year_coverage");
  if (!validGrains.includes(contract.default_grain)) warnings.push("default_grain_not_in_valid_grains");
  if (metricType === "unknown") warnings.push("unclear_metric_type");
  if (metricType !== "count" && aggregation.recommended_aggregation === "sum") warnings.push("unsafe_sum_for_non_count_metric");
  if (!validGrains.includes("municipality_year")) warnings.push("not_municipality_ready");
  if (labelLooksLikeDimensionValue(row)) warnings.push("dimension_value_like_metric_label");

  const blockingWarnings = new Set([
    "missing_unit",
    "missing_grain",
    "blocking_diagnostics",
    "unclear_aggregation",
    "no_populated_gold_facts",
    "default_grain_not_in_valid_grains",
    "unsafe_sum_for_non_count_metric",
  ]);
  const hasBlocking = warnings.some((warning) => blockingWarnings.has(warning));

  const confidence = Math.max(
    0.35,
    Math.min(
      0.94,
      0.76
        + (row.risk_level === "low" ? 0.1 : 0)
        + (validGrains.length ? 0.04 : 0)
        + (years.min_year && years.max_year ? 0.04 : 0)
        + (unitStatus === "standard" ? 0.04 : 0)
        - (row.risk_level === "high" ? 0.18 : 0)
        - warnings.filter((warning) => blockingWarnings.has(warning)).length * 0.08
        - warnings.filter((warning) => !blockingWarnings.has(warning)).length * 0.025
    )
  );

  const recommendedAction =
    hasBlocking
      ? "needs_metadata_fix"
      : warnings.includes("dimension_value_like_metric_label")
        ? "needs_human_review"
      : row.review_status === "review_candidate" && confidence >= 0.78
        ? "approve_candidate"
        : "needs_human_review";

  return {
    review_status: "generated",
    confidence,
    business_label: row.label,
    plain_definition: makeBusinessDefinition(row, contract, metricType, aggregation),
    metric_type: metricType,
    ...aggregation,
    synonyms: enrichSynonyms(row, contract),
    exclusions: asArray(contract.exclusions),
    caveats: [
      ...warnings.map((warning) => warning.replace(/_/g, " ")),
      "Generated by local deterministic rules because no OpenAI API key was configured.",
    ],
    dimension_notes: {
      valid_grains: validGrains,
      default_grain: contract.default_grain ?? null,
      grain_support: grainSummary(validGrains),
      year_coverage: years,
      unit_quality: unitStatus,
      category_filters: contract.category_filters ?? {},
      source_dimension_count: Object.keys(contract.category_filters ?? {}).length,
      populated_fact_rows: Number(capability.populated_fact_rows ?? 0),
      loaded_fact_rows: Number(capability.loaded_fact_rows ?? 0),
    },
    risk_flags: warnings,
    recommended_action: recommendedAction,
    rationale: hasBlocking
      ? "The metric is visible in Gold, but at least one hard execution requirement is incomplete. It should be fixed before promotion."
      : "The metric has enough deterministic metadata to be a promotion candidate. Final promotion is still separate from AI review.",
  };
}

function normalizeReview(row, rawReview, provider) {
  const fallback = localRulesReview(row);
  const review = rawReview && typeof rawReview === "object" ? rawReview : {};
  const caveats = new Set([...asArray(fallback.caveats), ...asArray(review.caveats)]);
  const riskFlags = new Set([...asArray(fallback.risk_flags), ...asArray(review.risk_flags)]);
  const confidence = normalizeConfidence(review.confidence, fallback.confidence);

  if (review.confidence === undefined || review.confidence === null || Number.isNaN(Number(review.confidence)) || Number(review.confidence) === 0) {
    caveats.add(`${provider} confidence missing or invalid; deterministic fallback confidence used.`);
    riskFlags.add("llm_confidence_missing");
  }

  const recommendedAction = enumValue(review.recommended_action, ["approve_candidate", "needs_human_review", "keep_disabled", "needs_metadata_fix"], fallback.recommended_action);
  const metricType = enumValue(review.metric_type, ["count", "amount", "percentage", "ratio", "average_or_median", "index", "category", "unknown"], fallback.metric_type);
  const aggregationClassification = enumValue(
    review.aggregation_classification,
    ["additive", "semi_additive", "non_additive", "unknown"],
    fallback.aggregation_classification
  );
  const recommendedAggregation = enumValue(
    review.recommended_aggregation,
    ["sum", "average", "median", "min", "max", "count", "none", "unknown"],
    fallback.recommended_aggregation
  );

  if (recommendedAction !== review.recommended_action) {
    caveats.add(`${provider} recommended_action was missing or invalid; deterministic fallback action used.`);
    riskFlags.add("llm_action_invalid");
  }

  return {
    review_status: enumValue(review.review_status, ["generated", "reviewed", "failed"], "generated"),
    confidence,
    business_label: typeof review.business_label === "string" && review.business_label.trim() ? review.business_label.trim() : fallback.business_label,
    plain_definition: typeof review.plain_definition === "string" && review.plain_definition.trim() ? review.plain_definition.trim() : fallback.plain_definition,
    metric_type: metricType,
    aggregation_classification: aggregationClassification,
    recommended_aggregation: recommendedAggregation,
    is_additive: typeof review.is_additive === "boolean" ? review.is_additive : fallback.is_additive,
    synonyms: {
      nl: Array.from(new Set([...asArray(fallback.synonyms?.nl), ...asArray(review.synonyms?.nl)])),
      en: Array.from(new Set([...asArray(fallback.synonyms?.en), ...asArray(review.synonyms?.en)])),
    },
    exclusions: Array.from(new Set([...asArray(fallback.exclusions), ...asArray(review.exclusions)])),
    caveats: Array.from(caveats),
    dimension_notes: {
      ...fallback.dimension_notes,
      ...(review.dimension_notes && typeof review.dimension_notes === "object" ? review.dimension_notes : {}),
      normalized_review_provider: provider,
    },
    risk_flags: Array.from(riskFlags),
    recommended_action: recommendedAction,
    rationale: typeof review.rationale === "string" && review.rationale.trim() ? review.rationale.trim() : fallback.rationale,
    raw_llm_response: review,
  };
}

function reviewSchemaInstruction() {
  return `Return only valid JSON with these keys:
business_label string,
plain_definition string,
metric_type one of count, amount, percentage, ratio, average_or_median, index, category, unknown,
aggregation_classification one of additive, semi_additive, non_additive, unknown,
recommended_aggregation one of sum, average, median, min, max, count, none, unknown,
is_additive boolean or null,
confidence number 0..1,
synonyms object with nl string[] and en string[],
exclusions string[],
caveats string[],
dimension_notes object,
risk_flags string[],
recommended_action one of approve_candidate, needs_human_review, keep_disabled, needs_metadata_fix,
rationale string.

Be conservative. Do not approve metrics when aggregation, unit, grain, or dimension behavior is ambiguous.
Do not invent facts. Use only the provided metadata. Curated metadata must be respected.`;
}

async function openAiReview(row, options, apiKey) {
  const payload = {
    metric_code: row.metric_code,
    label: row.label,
    domain_id: row.domain_id,
    dataset_code: row.dataset_code,
    measure_key: row.measure_key,
    measure_code: row.measure_code,
    current_review_status: row.review_status,
    risk_level: row.risk_level,
    diagnostic_summary: row.diagnostic_summary,
    suggested_contract: row.suggested_contract,
    source_capability: row.source_capability,
    diagnostics: row.diagnostics ?? [],
  };

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: options.model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are Guara's AI Semantic Reviewer. You help classify public-data metrics for an auditable semantic layer. ${reviewSchemaInstruction()}`,
        },
        {
          role: "user",
          content: JSON.stringify(payload),
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI review failed for ${row.metric_code}: HTTP ${response.status} ${body.slice(0, 500)}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error(`OpenAI review returned no content for ${row.metric_code}.`);
  return JSON.parse(content);
}

function extractJsonObject(value) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error("Reviewer returned empty content.");
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error(`Reviewer did not return JSON: ${text.slice(0, 300)}`);
    return JSON.parse(match[0]);
  }
}

async function ollamaReview(row, options) {
  const payload = {
    metric_code: row.metric_code,
    label: row.label,
    domain_id: row.domain_id,
    dataset_code: row.dataset_code,
    measure_key: row.measure_key,
    measure_code: row.measure_code,
    current_review_status: row.review_status,
    risk_level: row.risk_level,
    diagnostic_summary: row.diagnostic_summary,
    suggested_contract: row.suggested_contract,
    source_capability: row.source_capability,
    diagnostics: row.diagnostics ?? [],
  };

  let response;
  try {
    response = await fetch(`${options.ollamaUrl.replace(/\/+$/, "")}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: options.model,
        stream: false,
        format: "json",
        options: {
          temperature: 0,
          num_ctx: 8192,
        },
        messages: [
          {
            role: "system",
            content: `You are Guara's AI Semantic Reviewer. You help classify public-data metrics for an auditable semantic layer. ${reviewSchemaInstruction()}`,
          },
          {
            role: "user",
            content: JSON.stringify(payload),
          },
        ],
      }),
    });
  } catch (error) {
    throw new Error(
      `Could not reach Ollama at ${options.ollamaUrl}. Start Ollama and pull the model first: ollama serve; ollama pull ${options.model}. ${error.message}`
    );
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Ollama review failed for ${row.metric_code}: HTTP ${response.status} ${body.slice(0, 500)}`);
  }

  const data = await response.json();
  return extractJsonObject(data?.message?.content);
}

function resolveProvider(options, apiKey) {
  const provider = normalizeKey(options.provider || "auto");
  if (provider === "ollama") return "ollama";
  if (provider === "openai") return "openai";
  if (provider === "local" || provider === "local_rules") return "local_rules";
  return apiKey ? "openai" : "local_rules";
}

async function loadReviewRows(client, options) {
  const params = [options.domain, options.dataset, options.status, options.risk, options.limit];
  const where = [
    "($1::text = '' or r.domain_id = $1)",
    "($2::text = '' or upper(r.dataset_code) = upper($2))",
    "($3::text = '' or r.review_status = $3)",
    "($4::text = '' or r.risk_level = $4)",
  ];
  if (options.missingOnly) {
    params.push(PROMPT_VERSION);
    params.push(options.resolvedProvider);
    where.push(`not exists (
      select 1
      from semantic.metric_ai_review ar
      where ar.metric_code = r.metric_code
        and ar.prompt_version = $6
        and ar.model_provider = $7
    )`);
  }

  const { rows } = await client.query(
    `
      select
        r.*,
        coalesce((
          select jsonb_agg(to_jsonb(d) order by d.is_blocking desc, d.severity, d.diagnostic_code)
          from semantic.metric_contract_diagnostic d
          where d.metric_code = r.metric_code
        ), '[]'::jsonb) as diagnostics
      from semantic.metric_contract_review r
      where ${where.join("\n        and ")}
      order by
        case r.review_status when 'needs_fix' then 0 when 'review_candidate' then 1 else 2 end,
        case r.risk_level when 'high' then 0 when 'medium' then 1 when 'low' then 2 else 3 end,
        r.priority_score asc,
        r.updated_at desc
      limit least(greatest($5::integer, 1), 10000)
    `,
    params
  );
  return rows;
}

async function upsertAiReview(client, row, review, context) {
  await client.query(
    `
      insert into semantic.metric_ai_review (
        metric_code, domain_id, dataset_code, measure_key, model_provider, model_name, prompt_version,
        review_status, confidence, business_label, plain_definition, metric_type,
        aggregation_classification, recommended_aggregation, is_additive, synonyms, exclusions,
        caveats, dimension_notes, risk_flags, recommended_action, rationale, raw_response,
        metadata, updated_at
      )
      values (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12,
        $13, $14, $15, $16::jsonb, $17::text[],
        $18::text[], $19::jsonb, $20::text[], $21, $22, $23::jsonb,
        $24::jsonb, now()
      )
      on conflict (metric_code, prompt_version) do update set
        domain_id = excluded.domain_id,
        dataset_code = excluded.dataset_code,
        measure_key = excluded.measure_key,
        model_provider = excluded.model_provider,
        model_name = excluded.model_name,
        review_status = excluded.review_status,
        confidence = excluded.confidence,
        business_label = excluded.business_label,
        plain_definition = excluded.plain_definition,
        metric_type = excluded.metric_type,
        aggregation_classification = excluded.aggregation_classification,
        recommended_aggregation = excluded.recommended_aggregation,
        is_additive = excluded.is_additive,
        synonyms = excluded.synonyms,
        exclusions = excluded.exclusions,
        caveats = excluded.caveats,
        dimension_notes = excluded.dimension_notes,
        risk_flags = excluded.risk_flags,
        recommended_action = excluded.recommended_action,
        rationale = excluded.rationale,
        raw_response = excluded.raw_response,
        metadata = excluded.metadata,
        updated_at = now()
    `,
    [
      row.metric_code,
      row.domain_id,
      row.dataset_code,
      row.measure_key,
      context.provider,
      context.model,
      PROMPT_VERSION,
      review.review_status ?? "generated",
      review.confidence ?? null,
      review.business_label ?? row.label,
      review.plain_definition ?? null,
      review.metric_type ?? "unknown",
      review.aggregation_classification ?? "unknown",
      review.recommended_aggregation ?? "unknown",
      typeof review.is_additive === "boolean" ? review.is_additive : null,
      JSON.stringify(review.synonyms ?? {}),
      asArray(review.exclusions),
      asArray(review.caveats),
      JSON.stringify(review.dimension_notes ?? {}),
      asArray(review.risk_flags),
      review.recommended_action ?? "needs_human_review",
      review.rationale ?? null,
      JSON.stringify(review),
      JSON.stringify({
        source: "semantic.metric_contract_review",
        prompt_version: PROMPT_VERSION,
        generated_at: new Date().toISOString(),
      }),
    ]
  );
}

async function main() {
  loadLocalEnv();
  const options = parseArgs(process.argv);
  const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || "";
  options.resolvedProvider = resolveProvider(options, apiKey);
  if (options.resolvedProvider === "openai" && !apiKey) {
    throw new Error("Missing OPENAI_API_KEY. Add it to .env.local or use --provider ollama/local_rules.");
  }
  if (options.resolvedProvider === "local_rules" && options.noLocalFallback) {
    throw new Error("Missing OPENAI_API_KEY. Add it to .env.local or omit --no-local-fallback to write local_rules reviews.");
  }

  const client = createPostgresClient({
    applicationName: "guara-ai-semantic-reviewer",
    statementTimeoutMs: options.statementTimeoutMs,
    queryTimeoutMs: options.statementTimeoutMs,
  });

  await client.connect();
  try {
    const rows = await loadReviewRows(client, options);
    const provider = options.resolvedProvider;
    const model = provider === "local_rules" ? "deterministic_semantic_reviewer_v1" : options.model;
    console.log(`Selected ${rows.length} semantic contract(s) for ${provider} review.`);

    let written = 0;
    const failures = [];
    for (const row of rows) {
      try {
        const review =
          provider === "openai"
            ? await openAiReview(row, options, apiKey)
            : provider === "ollama"
              ? await ollamaReview(row, options)
              : localRulesReview(row);
        const normalizedReview = normalizeReview(row, review, provider);
        await upsertAiReview(client, row, normalizedReview, { provider, model });
        written += 1;
        console.log(`Reviewed ${row.metric_code}: ${normalizedReview.recommended_action} (${Math.round(Number(normalizedReview.confidence ?? 0) * 100)}%)`);
      } catch (error) {
        failures.push({ metric_code: row.metric_code, error: error.message });
        console.error(`Failed ${row.metric_code}: ${error.message}`);
      }
    }

    const { rows: summaryRows } = await client.query(`
      select model_provider, recommended_action, count(*)::bigint as reviews
      from semantic.metric_ai_review
      group by model_provider, recommended_action
      order by model_provider, recommended_action
    `);
    console.table(summaryRows);
    console.log(`AI semantic review complete: ${written}/${rows.length} review(s) written.`);
    if (failures.length) {
      console.table(failures.slice(0, 20));
      process.exitCode = 1;
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(explainPostgresConnectionError(error));
  process.exitCode = 1;
});
