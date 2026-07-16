import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { SEARCH_FIXTURE } from "../../__fixtures__/searchFixture";
import { extractConcepts } from "../conceptExtraction";
import { scoreHybridResult } from "../hybridRanking";
import { classifySearchRequest } from "../intentClassifier";
import { validateAnalyticalQueryPlan } from "../queryPlanValidation";
import { executeCompiledQuery } from "../queryExecutor";
import { validateQueryResult } from "../resultValidation";
import { compileAnalyticalQuery } from "../sqlCompiler";
import { isExactCodeMatch, normalizeSearchText } from "../textNormalization";

describe("search quality fixtures", () => {
  it("normalizes accents, casing and whitespace", () => {
    expect(normalizeSearchText("  WóningVoorraad   Totaal ")).toBe("woningvoorraad totaal");
  });

  it("detects exact CBS dataset codes", () => {
    expect(isExactCodeMatch("85455NED", { datasetCode: SEARCH_FIXTURE.datasets[0].datasetCode })).toBe(true);
  });

  it("scores exact-code matches above synonym-only matches", () => {
    const exact = scoreHybridResult("82211NED", {
      objectType: "dataset",
      objectId: "82211NED",
      datasetCode: "82211NED",
      title: SEARCH_FIXTURE.datasets[1].title,
      searchableText: SEARCH_FIXTURE.datasets[1].descriptionNl,
    });
    const synonym = scoreHybridResult("housing stock", {
      objectType: "metric",
      objectId: "housing_stock_total",
      title: SEARCH_FIXTURE.metrics[0].title,
      synonymsText: SEARCH_FIXTURE.metrics[0].synonyms.join(" "),
    });
    expect(exact.exactMatchScore).toBe(1);
    expect(exact.rankScore).toBeGreaterThan(synonym.rankScore);
  });

  it("combines lexical and vector scores for hybrid ranking", () => {
    const score = scoreHybridResult("housing stock Amsterdam", {
      objectType: "metric",
      objectId: "housing_stock_total",
      title: "Woningvoorraad totaal",
      synonymsText: "housing stock woningen",
      vectorScore: 0.72,
      popularityScore: 40,
    });
    expect(score.lexicalScore).toBeGreaterThan(0);
    expect(score.vectorScore).toBe(0.72);
    expect(score.rankScore).toBeGreaterThan(score.lexicalScore);
  });

  it("classifies Dutch and English analytical questions", () => {
    expect(classifySearchRequest("Welke gemeenten hebben de meeste woningen in 2023?").intent).toBe("analytical_ranking");
    expect(classifySearchRequest("Compare housing construction in Rotterdam and Utrecht").intent).toBe("analytical_comparison");
  });

  it("extracts concepts for municipalities, years and calculations", () => {
    const concepts = extractConcepts("Compare housing prices in Rotterdam and Utrecht between 2020 and 2024");
    expect(concepts.geography).toEqual(["Rotterdam", "Utrecht"]);
    expect(concepts.timeExpression).toEqual({ type: "between", value: [2020, 2024] });
    expect(concepts.calculation).toBe("comparison");
  });

  it("rejects unsafe query plans and invalid time ranges", () => {
    const plan = validateAnalyticalQueryPlan({
      version: "1",
      intent: "ranking",
      metricId: "housing_stock_total",
      groupBy: [{ dimensionId: "geography; drop table gold.dim_dataset" }],
      filters: [],
      timeRange: { startPeriod: "2024", endPeriod: "2020" },
      limit: 10,
    });
    expect(plan.ok).toBe(false);
    expect(plan.errors.join(" ")).toMatch(/logical field|startPeriod/);
  });

  it("compiles parameterized SQL against approved Gold mart objects only", () => {
    const compiled = compileAnalyticalQuery({
      version: "1",
      intent: "ranking",
      metricId: "123",
      groupBy: [{ dimensionId: "geography" }],
      filters: [{ dimensionId: "geography", operator: "eq", values: ["Amsterdam' or true --"] }],
      timeRange: { periods: ["2023"] },
      limit: 25,
      includeMissing: false,
    });
    expect(compiled.sql).toContain("gold_bouwen_wonen.fact_housing_observation");
    expect(compiled.sql).not.toContain("Amsterdam' or true");
    expect(compiled.parameters).toContainEqual(["amsterdam' or true --"]);
    expect(compiled.maxRows).toBeLessThanOrEqual(100);
  });

  it("maps empty result sets to a structured EMPTY_RESULT failure", () => {
    const compiled = compileAnalyticalQuery({
      version: "1",
      intent: "lookup",
      metricId: "123",
      groupBy: [],
      filters: [],
      limit: 10,
      includeMissing: false,
    });
    const result = validateQueryResult(compiled, { rows: [], rowCount: 0, durationMs: 5, warnings: [] });
    expect(result.status).toBe("invalid");
    expect(result.errors[0]?.code).toBe("EMPTY_RESULT");
  });

  it("returns QUERY_TIMEOUT when the runner times out", async () => {
    const compiled = compileAnalyticalQuery({
      version: "1",
      intent: "lookup",
      metricId: "123",
      groupBy: [],
      filters: [],
      limit: 10,
      includeMissing: false,
    });
    const result = await executeCompiledQuery(compiled, {
      run: async () => {
        throw new Error("statement timeout");
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("QUERY_TIMEOUT");
  });

  it("keeps investigation permission checks in the search RPC", () => {
    const schema = readFileSync(resolve(process.cwd(), "supabase/search_schema.sql"), "utf8");
    expect(schema).toContain("answer.investigation_access");
    expect(schema).toContain("visibility' = 'private'");
    expect(schema).toContain("auth.uid()");
  });

  it("supports strict Gold-only search filters", () => {
    const schema = readFileSync(resolve(process.cwd(), "supabase/search_schema.sql"), "utf8");
    const loader = readFileSync(resolve(process.cwd(), "scripts/load-semantic-catalogue.mjs"), "utf8");
    expect(schema).toContain("strict_gold_only");
    expect(schema).toContain("trusted_layer");
    expect(loader).toContain("derived_from_layers");
    expect(loader).toContain("source_last_updated_at");
  });
});
