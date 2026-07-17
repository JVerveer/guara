import { describe, expect, it } from "vitest";
import type { SemanticSearchResult } from "../../types";
import { resolveGeographyMention } from "../geographyResolver";
import { buildSemanticQueryPlan, classifySemanticIntent } from "../queryPlanner";

function metric(title: string, measureKey: string, datasetCode: string): SemanticSearchResult {
  return {
    catalogue_item_id: `${datasetCode}:${measureKey}`,
    object_type: "metric",
    object_id: measureKey,
    title,
    subtitle: datasetCode,
    description: null,
    dataset_code: datasetCode,
    measure_code: null,
    geography_code: null,
    unit_code: null,
    domain_id: "bouwen-en-wonen",
    provider: "CBS",
    rank_score: 1,
    lexical_score: 1,
    vector_score: 1,
    metadata: {
      measure_key: measureKey,
      has_fact_data: true,
      domain_id: "bouwen-en-wonen",
    },
  };
}

const catalogue = [
  metric("Gemiddelde WOZ-waarde van woningen", "woz", "85036NED"),
  metric("Totaal huurwoningen", "huur-totaal", "82900NED"),
  metric("Eigendom woningcorporatie", "corporatie", "82900NED"),
  metric("Gemiddelde verkoopprijs", "verkoopprijs", "83625NED"),
];

const ambiguousPriceCatalogue = [
  metric("Gemiddelde verkoopprijs", "corop-price", "85819NED"),
  metric("Gemiddelde verkoopprijs", "municipality-price", "83625NED"),
];

describe("semantic geography resolver", () => {
  it("distinguishes Utrecht municipality from province using context", () => {
    expect(resolveGeographyMention("Utrecht", "Show WOZ for Utrecht municipality")?.resolved_name).toBe("Utrecht (gemeente)");
    expect(resolveGeographyMention("Utrecht", "Show WOZ for province Utrecht")?.resolved_name).toBe("Utrecht (PV)");
  });

  it("normalizes Dutch country aliases", () => {
    const resolution = resolveGeographyMention("Nederland", "Show Nieuwbouw for Nederland");
    expect(resolution).toMatchObject({ resolved_name: "Nederland", geography_type: "country" });
  });
});

describe("semantic golden question planning", () => {
  it("plans a housing-corporation share calculation", () => {
    const question = "What share of Totaal huurwoningen in Rotterdam were Eigendom woningcorporatie in 2023?";
    const intent = classifySemanticIntent(question);
    const plan = buildSemanticQueryPlan(question, intent, catalogue);

    expect(plan.calculation_code).toBe("share_of_total");
    expect(plan.measure_label).toBe("Eigendom woningcorporatie");
    expect(plan.secondary_measure_label).toBe("Totaal huurwoningen");
    expect(plan.geography_names).toContain("Rotterdam");
    expect(plan.year).toBe(2023);
  });

  it("plans a high-low multi-metric ranking", () => {
    const question = "Which municipalities have high Gemiddelde WOZ-waarde van woningen but low Totaal huurwoningen in 2023?";
    const intent = classifySemanticIntent(question);
    const plan = buildSemanticQueryPlan(question, intent, catalogue);

    expect(plan.intent).toBe("rank_geographies");
    expect(plan.calculation_code).toBe("multi_metric_rank");
    expect(plan.measure_label).toBe("Gemiddelde WOZ-waarde van woningen");
    expect(plan.secondary_measure_label).toBe("Totaal huurwoningen");
    expect(plan.geography_type).toBe("municipality");
  });

  it("plans biggest-increase rankings as change_rank", () => {
    const question = "Which municipalities had the biggest increase in Gemiddelde WOZ-waarde van woningen between 2020 and 2023?";
    const intent = classifySemanticIntent(question);
    const plan = buildSemanticQueryPlan(question, intent, catalogue);

    expect(plan.calculation_code).toBe("change_rank");
    expect(plan.year_start).toBe(2020);
    expect(plan.year_end).toBe(2023);
  });

  it("plans province-level questions with province geography", () => {
    const question = "Show Gemiddelde WOZ-waarde van woningen for province Utrecht in 2023.";
    const intent = classifySemanticIntent(question);
    const plan = buildSemanticQueryPlan(question, intent, catalogue);

    expect(plan.calculation_code).toBe("comparison");
    expect(plan.geography_type).toBe("province");
    expect(plan.geography_names).toEqual(["Utrecht (PV)"]);
  });

  it("plans national-average comparisons", () => {
    const question = "Compare Rotterdam with the national average for Totaal huurwoningen in 2023.";
    const intent = classifySemanticIntent(question);
    const plan = buildSemanticQueryPlan(question, intent, catalogue);

    expect(plan.calculation_code).toBe("compare_to_average");
    expect(plan.geography_names).toContain("Rotterdam");
    expect(plan.year).toBe(2023);
  });

  it("uses curated metric preferences before same-label fallback", () => {
    const question = "Which municipalities have the highest Gemiddelde verkoopprijs in 2023?";
    const intent = classifySemanticIntent(question);
    const plan = buildSemanticQueryPlan(question, intent, ambiguousPriceCatalogue, {
      metricPreferences: [
        {
          normalized_metric_label: "gemiddelde verkoopprijs",
          geography_type: "municipality",
          calculation_code: "ranking",
          preferred_measure_key: "municipality-price",
          preferred_dataset_code: "83625NED",
          priority: 10,
          reason: "Prefer municipality-capable regional price dataset.",
        },
      ],
    });

    expect(plan.measure_key).toBe("municipality-price");
    expect(plan.warnings?.some((warning) => warning.includes("Applied curated metric preference"))).toBe(true);
  });

  it("warns when generated metric grain metadata does not support the requested grain", () => {
    const question = "Show Gemiddelde verkoopprijs for province Utrecht in 2023.";
    const intent = classifySemanticIntent(question);
    const plan = buildSemanticQueryPlan(question, intent, ambiguousPriceCatalogue, {
      metricGrains: [
        {
          measure_key: "corop-price",
          geography_type: "municipality",
          min_year: 2020,
          max_year: 2024,
          is_supported: true,
        },
      ],
    });

    expect(plan.geography_type).toBe("province");
    expect(plan.warnings?.some((warning) => warning.includes("No generated grain metadata found") || warning.includes("missing"))).toBe(true);
  });
});
