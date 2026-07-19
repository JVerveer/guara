import { describe, expect, it } from "vitest";
import type { SemanticSearchResult } from "../../types";
import { resolveGeographyMention } from "../geographyResolver";
import { buildSemanticQueryPlan, classifySemanticIntent } from "../queryPlanner";
import { answerText } from "../semanticSearchService";

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

const ambiguousNewbuildCatalogue = [
  metric("Nieuwbouw", "unknown-grain-newbuild", "82235NED"),
  metric("Nieuwbouw", "municipality-newbuild", "86054NED"),
];

const woningtypeCatalogue = [
  metric("Gemiddelde oppervlakte", "oppervlakte-85035", "85035NED"),
  metric("Beginstand woningvoorraad", "woningvoorraad-85035", "85035NED"),
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

describe("semantic answer formatting", () => {
  it("formats single-row Gold answers for business users", () => {
    const plan = buildSemanticQueryPlan("Show Totaal huurwoningen for Rotterdam in 2023.", "compare_geographies", catalogue);
    const answer = answerText(
      "Show Totaal huurwoningen for Rotterdam in 2023.",
      plan,
      {
        rows: [
          {
            value: 210828,
            raw_value: 210828,
            unit_code: "COUNT",
            unit_name: "Count",
            measure_name: "Totaal huurwoningen",
            calendar_year: 2023,
            geography_name: "Rotterdam",
            geography_type: "municipality",
          },
        ],
      },
      catalogue
    );

    expect(answer.title).toBe("Rotterdam had 210,828 rental homes in 2023");
    expect(answer.summary).toContain("Totaal huurwoningen was 210,828");
    expect(answer.bullets.some((bullet) => bullet.includes("raw_value"))).toBe(false);
  });

  it("explains missing period/results in plain language", () => {
    const plan = buildSemanticQueryPlan("totaal huurwoningen rotterdam", "compare_geographies", catalogue);
    const answer = answerText("totaal huurwoningen rotterdam", plan, { rows: [] }, catalogue);

    expect(answer.title).toContain("Which year should Guara use");
    expect(answer.summary).toContain("does not include a year");
    expect(answer.bullets.some((bullet) => /allowlisted|Gold metric|grain/i.test(bullet))).toBe(false);
  });

  it("formats share-of-total answers as a percentage with numerator and denominator", () => {
    const question = "What share of Totaal huurwoningen in Rotterdam were Eigendom woningcorporatie in 2023?";
    const plan = buildSemanticQueryPlan(question, classifySemanticIntent(question), catalogue);
    const answer = answerText(
      question,
      plan,
      {
        rows: [
          {
            geography_name: "Rotterdam",
            geography_type: "municipality",
            calendar_year: 2023,
            numerator_value: 84_331,
            denominator_value: 210_828,
            share_percent: 40,
          },
        ],
      },
      catalogue
    );

    expect(answer.title).toContain("40%");
    expect(answer.summary).toContain("84,331 out of 210,828");
    expect(answer.bullets).toContain("Share: 40%");
  });

  it("formats national-average comparisons in plain language", () => {
    const question = "Compare Rotterdam with the national average for Totaal huurwoningen in 2023.";
    const plan = buildSemanticQueryPlan(question, classifySemanticIntent(question), catalogue);
    const answer = answerText(
      question,
      plan,
      {
        rows: [
          {
            geography_name: "Rotterdam",
            calendar_year: 2023,
            value: 210_828,
            average_value: 18_500,
            difference_from_average: 192_328,
            ratio_to_average: 11.3961,
            unit_code: "COUNT",
          },
        ],
      },
      catalogue
    );

    expect(answer.title).toContain("Rotterdam was above");
    expect(answer.summary).toContain("average across comparable geographies");
    expect(answer.bullets.some((bullet) => bullet.includes("11.4x"))).toBe(true);
  });

  it("formats change rankings with start, end and change", () => {
    const question = "Which municipalities had the biggest increase in Gemiddelde WOZ-waarde van woningen between 2020 and 2023?";
    const plan = buildSemanticQueryPlan(question, classifySemanticIntent(question), catalogue);
    const answer = answerText(
      question,
      plan,
      {
        rows: [
          {
            geography_name: "Bloemendaal",
            geography_type: "municipality",
            start_year: 2020,
            end_year: 2023,
            start_value: 831_000,
            end_value: 1_100_000,
            absolute_change: 269_000,
            percentage_change: 32.37,
          },
        ],
      },
      catalogue
    );

    expect(answer.title).toContain("Bloemendaal had the biggest increase");
    expect(answer.summary).toContain("€831,000");
    expect(answer.summary).toContain("+€269,000");
  });

  it("formats high-low multi-metric rankings without exposing database columns", () => {
    const question = "Which municipalities have high Gemiddelde WOZ-waarde van woningen but low Totaal huurwoningen in 2023?";
    const plan = buildSemanticQueryPlan(question, classifySemanticIntent(question), catalogue);
    const answer = answerText(
      question,
      plan,
      {
        rows: [
          {
            geography_name: "Bloemendaal",
            calendar_year: 2023,
            primary_value: 1_100_000,
            secondary_value: 2_300,
            primary_rank: 1,
            secondary_rank: 18,
            combined_rank_score: 19,
          },
        ],
      },
      catalogue
    );

    expect(answer.title).toContain("high average WOZ home value and low rental homes");
    expect(answer.bullets[0]).toContain("€1,100,000");
    expect(answer.bullets[0]).toContain("2,300");
    expect(answer.bullets.some((bullet) => /primary_value|secondary_value/.test(bullet))).toBe(false);
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

  it("treats terse metric and place input as a data question", () => {
    const question = "totaal huurwoningen rotterdam";
    const intent = classifySemanticIntent(question);
    const plan = buildSemanticQueryPlan(question, intent, catalogue);

    expect(intent).toBe("compare_geographies");
    expect(plan.source).toBe("gold_bouwen_wonen");
    expect(plan.measure_label).toBe("Totaal huurwoningen");
    expect(plan.geography_names).toContain("Rotterdam");
  });

  it("extracts non-hardcoded municipality names from ordinary place phrasing", () => {
    const question = "how many huurwoningen in alkmaar in 2023";
    const intent = classifySemanticIntent(question);
    const plan = buildSemanticQueryPlan(question, intent, catalogue);

    expect(intent).toBe("compare_geographies");
    expect(plan.source).toBe("gold_bouwen_wonen");
    expect(plan.measure_label).toBe("Totaal huurwoningen");
    expect(plan.geography_names).toEqual(["alkmaar"]);
    expect(plan.geography_type).toBe("municipality");
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

  it("does not infer a secondary measure from words inside a single metric ranking", () => {
    const question = "Which municipalities have the highest Gemiddelde WOZ-waarde van woningen in 2023?";
    const intent = classifySemanticIntent(question);
    const plan = buildSemanticQueryPlan(question, intent, [
      ...catalogue,
      metric("Woningen", "woningen", "85035NED"),
    ]);

    expect(plan.intent).toBe("rank_geographies");
    expect(plan.calculation_code).toBe("ranking");
    expect(plan.measure_label).toBe("Gemiddelde WOZ-waarde van woningen");
    expect(plan.secondary_measure_key).toBeUndefined();
    expect(plan.secondary_measure_label).toBeUndefined();
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

  it("uses the municipality-capable Nieuwbouw metric for municipality comparisons", () => {
    const question = "Compare Nieuwbouw in Rotterdam and Utrecht between 2021 and 2023.";
    const intent = classifySemanticIntent(question);
    const plan = buildSemanticQueryPlan(question, intent, ambiguousNewbuildCatalogue, {
      metricPreferences: [
        {
          normalized_metric_label: "nieuwbouw",
          geography_type: "municipality",
          calculation_code: "comparison",
          preferred_measure_key: "municipality-newbuild",
          preferred_dataset_code: "86054NED",
          priority: 10,
          reason: "Prefer municipality-capable new-build dataset.",
        },
      ],
    });

    expect(plan.measure_key).toBe("municipality-newbuild");
    expect(plan.geography_names).toEqual(["Rotterdam", "Utrecht (gemeente)"]);
    expect(plan.year_start).toBe(2021);
    expect(plan.year_end).toBe(2023);
  });

  it("plans woningtypes per regio as a category breakdown from 85035NED", () => {
    const question = "woningtypes per regio in 2023";
    const intent = classifySemanticIntent(question);
    const plan = buildSemanticQueryPlan(question, intent, woningtypeCatalogue, {
      metricPreferences: [
        {
          normalized_metric_label: "beginstand woningvoorraad",
          geography_type: "municipality",
          calculation_code: "category_breakdown",
          preferred_measure_key: "woningvoorraad-85035",
          preferred_dataset_code: "85035NED",
          priority: 10,
          reason: "Use housing stock count for Woningtype breakdowns.",
        },
      ],
    });

    expect(intent).toBe("compare_geographies");
    expect(plan.calculation_code).toBe("category_breakdown");
    expect(plan.measure_key).toBe("woningvoorraad-85035");
    expect(plan.dataset_code).toBe("85035NED");
    expect(plan.category_dimension_code).toBe("Woningtype");
    expect(plan.category_filter_dimension_code).toBe("Woningkenmerk");
    expect(plan.category_filter_value).toBe("Totaal woningen");
    expect(plan.geography_type).toBe("municipality");
    expect(plan.year).toBe(2023);
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
