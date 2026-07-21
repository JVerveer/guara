import { describe, expect, it } from "vitest";
import type { SemanticSearchResult } from "../../types";
import { enrichSemanticAnswer } from "../answerEnrichmentService";
import { resolveGeographyMention } from "../geographyResolver";
import { buildContractQueryPlan } from "../semanticContractPlanner";
import { buildSemanticQueryPlan, classifySemanticIntent } from "../queryPlanner";
import { attachSemanticDiagnostics, validateSemanticQueryPlan, withExplicitGrain } from "../queryPlanValidationService";
import { buildRegistryQueryPlan } from "../semanticRegistry";
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

function metricWithUnit(title: string, measureKey: string, datasetCode: string, unitCode: string, subtitle = datasetCode): SemanticSearchResult {
  return {
    ...metric(title, measureKey, datasetCode),
    subtitle,
    unit_code: unitCode,
    metadata: {
      measure_key: measureKey,
      has_fact_data: true,
      domain_id: "bouwen-en-wonen",
      unit_code: unitCode,
    },
  };
}

function metricWithUnitAndYears(title: string, measureKey: string, datasetCode: string, unitCode: string, minYear: number, maxYear: number, subtitle = datasetCode): SemanticSearchResult {
  return {
    ...metricWithUnit(title, measureKey, datasetCode, unitCode, subtitle),
    metadata: {
      measure_key: measureKey,
      has_fact_data: true,
      domain_id: "bouwen-en-wonen",
      unit_code: unitCode,
      min_year: minYear,
      max_year: maxYear,
    },
  };
}

function explicitMetric(title: string, measureKey: string, datasetCode: string, extra: Record<string, unknown> = {}): SemanticSearchResult {
  return {
    ...metricWithUnit(title, measureKey, datasetCode, "COUNT"),
    lexical_score: 1,
    vector_score: 0,
    metadata: {
      measure_key: measureKey,
      has_fact_data: true,
      domain_id: "bouwen-en-wonen",
      explicit_metric_contract: true,
      metadata_origin: "curated",
      metric_code: normalizeForTest(title),
      aggregation: "sum",
      valid_grains: ["municipality_year", "province_year", "country_year"],
      default_grain: "municipality_year",
      ...extra,
    },
  };
}

function normalizeForTest(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}


function contractMetric(title: string, measureKey: string, datasetCode: string, isDefault: boolean): SemanticSearchResult {
  return {
    ...metric(title, measureKey, datasetCode),
    rank_score: isDefault ? 25 : 10,
    metadata: {
      measure_key: measureKey,
      has_fact_data: true,
      domain_id: "bouwen-en-wonen",
      profile_depth: "sample_profiled",
      contract_status: "complete",
      is_contract_default_measure: isDefault,
      default_breakdown_dimension: "Woningtype",
      default_filter_dimension: "Woningkenmerk",
      default_filter_value: "Totaal woningen",
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
    expect(answer.bullets[0]).toContain("Interpretation:");
    expect(answer.bullets[1]).toContain("€1,100,000");
    expect(answer.bullets[1]).toContain("2,300");
    expect(answer.bullets.some((bullet) => /primary_value|secondary_value/.test(bullet))).toBe(false);
  });

  it("formats least-value rankings as lowest results and suggests other geography levels", () => {
    const plan = buildSemanticQueryPlan(
      "waar staan de minste woningen in Nederland?",
      "rank_geographies",
      [
        metricWithUnit("Woningen", "woz-woningen", "37610", "EUR_MILLIONS", "Waarde onroerende zaken 1997-2020"),
        metricWithUnit("Beginstand woningvoorraad", "woningvoorraad", "82550NED", "COUNT", "Woningen; m², type, bouwjaar, regio"),
      ],
      {
        metricGrains: [
          {
            measure_key: "woningvoorraad",
            geography_type: "municipality",
            min_year: 2012,
            max_year: 2026,
            is_supported: true,
          },
        ],
      }
    );
    const answer = answerText(
      "waar staan de minste woningen in Nederland?",
      plan,
      {
        rows: [
          { value: 942, unit_code: "COUNT", unit_name: "Count", calendar_year: 2026, geography_name: "Schiermonnikoog", geography_type: "municipality" },
          { value: 1120, unit_code: "COUNT", unit_name: "Count", calendar_year: 2026, geography_name: "Vlieland", geography_type: "municipality" },
        ],
      },
      []
    );

    expect(answer.title).toContain("lowest");
    expect(answer.summary).toContain("lowest value found was 942");
    expect(answer.bullets.join(" ")).toContain("province or regional level");
  });

  it("asks for municipality names when a trend question refers to unresolved selected municipalities", () => {
    const question = "Show the trend for Beginstand woningvoorraad in these municipalities since 2021.";
    const plan = buildSemanticQueryPlan(
      question,
      classifySemanticIntent(question),
      [metricWithUnit("Beginstand woningvoorraad", "woningvoorraad", "82550NED", "COUNT")],
      {
        metricGrains: [
          {
            measure_key: "woningvoorraad",
            geography_type: "municipality",
            min_year: 2012,
            max_year: 2026,
            is_supported: true,
          },
        ],
      }
    );
    const answer = answerText(question, plan, { rows: [] }, []);

    expect(plan.intent).toBe("trend");
    expect(plan.year_start).toBe(2021);
    expect(plan.geography_names).toEqual([]);
    expect(plan.requires_clarification).toBe("geography");
    expect(answer.title).toContain("Which municipalities");
    expect(answer.summary).toContain("these municipalities");
    expect(answer.summary).not.toContain("does not include a year");
  });

  it("generates trend follow-ups with actual result municipalities instead of vague references", () => {
    const plan = buildSemanticQueryPlan(
      "waar staan de minste woningen in Nederland?",
      "rank_geographies",
      [metricWithUnit("Beginstand woningvoorraad", "woningvoorraad", "82550NED", "COUNT")]
    );
    const enrichment = enrichSemanticAnswer(
      "waar staan de minste woningen in Nederland?",
      plan,
      {
        rows: [
          { geography_name: "Schiermonnikoog", value: 617, calendar_year: 2026 },
          { geography_name: "Vlieland", value: 650, calendar_year: 2026 },
          { geography_name: "Rozendaal", value: 710, calendar_year: 2026 },
        ],
      },
      []
    );

    expect(enrichment.follow_up_questions[0]?.question).toContain("Schiermonnikoog, Vlieland, Rozendaal");
    expect(enrichment.follow_up_questions[0]?.question).not.toContain("these municipalities");
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

  it("plans Dutch wat-is metric questions as Gold comparisons instead of catalogue searches", () => {
    const question = "Wat is de gemiddelde woz waarde van woningen in Alkmaar?";
    const intent = classifySemanticIntent(question);
    const plan = buildSemanticQueryPlan(question, intent, catalogue, {
      metricGrains: [
        {
          measure_key: "woz",
          geography_type: "municipality",
          min_year: 2019,
          max_year: 2026,
          is_supported: true,
        },
      ],
    });

    expect(intent).toBe("compare_geographies");
    expect(plan.source).toBe("gold_bouwen_wonen");
    expect(plan.intent).toBe("compare_geographies");
    expect(plan.measure_label).toBe("Gemiddelde WOZ-waarde van woningen");
    expect(plan.geography_names).toEqual(["Alkmaar"]);
    expect(plan.geography_type).toBe("municipality");
    expect(plan.year).toBe(2026);
  });

  it("prefers the current WOZ metric for woningwaarde questions when no year is supplied", () => {
    const question = "Wat is de gemiddelde woningwaarde in Alkmaar";
    const intent = classifySemanticIntent(question);
    const plan = buildSemanticQueryPlan(
      question,
      intent,
      [
        metricWithUnitAndYears("Gemiddelde woningwaarde", "old-woningwaarde", "37610", "EUR_THOUSANDS", 1997, 2020, "Waarde onroerende zaken 1997-2020"),
        metricWithUnitAndYears("Gemiddelde WOZ-waarde van woningen", "woz", "85036NED", "EUR_THOUSANDS", 2019, 2026, "Gemiddelde WOZ-waarde van woningen;regio"),
      ],
      {
        metricGrains: [
          {
            measure_key: "old-woningwaarde",
            geography_type: "municipality",
            min_year: 1997,
            max_year: 2020,
            is_supported: true,
          },
          {
            measure_key: "woz",
            geography_type: "municipality",
            min_year: 2019,
            max_year: 2026,
            is_supported: true,
          },
        ],
      }
    );

    expect(intent).toBe("compare_geographies");
    expect(plan.measure_label).toBe("Gemiddelde WOZ-waarde van woningen");
    expect(plan.measure_key).toBe("woz");
    expect(plan.dataset_code).toBe("85036NED");
    expect(plan.year).toBe(2026);
  });

  it("plans woontevredenheid questions against satisfaction datasets with total filters", () => {
    const question = "waar zijn mensen het meest tevreden over hun woning?";
    const intent = classifySemanticIntent(question);
    const plan = buildSemanticQueryPlan(
      question,
      intent,
      [
        metricWithUnitAndYears("Beginstand woningvoorraad", "woningvoorraad", "82550NED", "COUNT", 2012, 2026),
        metricWithUnitAndYears("Tevredenheid met de huidige woning", "tevreden-woning-84570", "84570NED", "PERCENT", 2002, 2024),
        metricWithUnitAndYears("Tevredenheid met de huidige woning", "tevreden-woning-84571", "84571NED", "PERCENT", 2002, 2024),
        metricWithUnitAndYears("Tevredenheid met de huidige woonomgeving", "tevreden-omgeving", "84571NED", "PERCENT", 2002, 2024),
      ],
      {
        metricGrains: [
          {
            measure_key: "tevreden-woning-84571",
            geography_type: "municipality",
            min_year: 2002,
            max_year: 2024,
            is_supported: true,
          },
        ],
      }
    );

    expect(intent).toBe("rank_geographies");
    expect(plan.measure_label).toBe("Tevredenheid met de huidige woning");
    expect(plan.measure_key).toBe("tevreden-woning-84571");
    expect(plan.dataset_code).toBe("84571NED");
    expect(plan.geography_type).toBe("municipality");
    expect(plan.year).toBe(2024);
    expect(plan.category_filters).toEqual({
      EigenaarOfHuurder: "Totaal",
      Marges: "Waarde",
      Woningkenmerken: "Totaal woningen",
    });
  });

  it("plans generic huurverhoging questions as municipality rankings on the regional rent-increase dataset", () => {
    const question = "waar is er de meeste huurverhoging geweest in 2024?";
    const intent = classifySemanticIntent(question);
    const plan = buildSemanticQueryPlan(
      question,
      intent,
      [
        metricWithUnitAndYears("Huurverhoging", "old-huurverhoging", "70675ned", "PERCENT", 1970, 2025),
        metricWithUnitAndYears("Huurverhoging inclusief huurharmonisatie", "huurverhoging-inclusief", "83162NED", "PERCENT", 2015, 2025),
        metricWithUnitAndYears("Huurverhoging exclusief huurharmonisatie", "huurverhoging-exclusief", "83162NED", "PERCENT", 2015, 2025),
      ],
      {
        metricGrains: [
          {
            measure_key: "huurverhoging-inclusief",
            geography_type: "municipality",
            min_year: 2015,
            max_year: 2025,
            is_supported: true,
          },
        ],
      }
    );

    expect(intent).toBe("rank_geographies");
    expect(plan.measure_label).toBe("Huurverhoging inclusief huurharmonisatie");
    expect(plan.measure_key).toBe("huurverhoging-inclusief");
    expect(plan.dataset_code).toBe("83162NED");
    expect(plan.geography_type).toBe("municipality");
    expect(plan.sort_direction).toBe("desc");
    expect(plan.year).toBe(2024);
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

  it("plans Dutch least-houses-in-Netherlands questions as municipality housing-stock rankings", () => {
    const question = "waar staan de minste woningen in Nederland?";
    const intent = classifySemanticIntent(question);
    const plan = buildSemanticQueryPlan(
      question,
      intent,
      [
        metricWithUnit("Woningen", "woz-woningen", "37610", "EUR_MILLIONS", "Waarde onroerende zaken 1997-2020"),
        metricWithUnit("Beginstand woningvoorraad", "woningvoorraad", "82550NED", "COUNT", "Woningen; m², type, bouwjaar, regio"),
      ],
      {
        metricGrains: [
          {
            measure_key: "woningvoorraad",
            geography_type: "municipality",
            min_year: 2012,
            max_year: 2026,
            is_supported: true,
          },
        ],
      }
    );

    expect(intent).toBe("rank_geographies");
    expect(plan.measure_label).toBe("Beginstand woningvoorraad");
    expect(plan.measure_key).toBe("woningvoorraad");
    expect(plan.geography_type).toBe("municipality");
    expect(plan.geography_names).toEqual([]);
    expect(plan.sort_direction).toBe("asc");
    expect(plan.year).toBe(2026);
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

  it("uses the generated dataset contract default measure for category breakdowns", () => {
    const question = "woningtypes per regio in 2023";
    const intent = classifySemanticIntent(question);
    const plan = buildSemanticQueryPlan(
      question,
      intent,
      [
        contractMetric("Gemiddelde oppervlakte", "oppervlakte-85035", "85035NED", false),
        contractMetric("Beginstand woningvoorraad", "woningvoorraad-85035", "85035NED", true),
      ],
      {
        datasetContracts: [
          {
            dataset_code: "85035NED",
            dataset_title: "Woningtype; regio",
            domain_id: "bouwen-en-wonen",
            data_availability_status: "loaded",
            profile_depth: "sample_profiled",
            default_measure_key: "woningvoorraad-85035",
            default_measure_name: "Beginstand woningvoorraad",
            default_unit_code: "COUNT",
            default_breakdown_dimension: "Woningtype",
            default_filter_dimension: "Woningkenmerk",
            default_filter_value: "Totaal woningen",
            geography_types: ["municipality"],
            period_types: ["year"],
            dimension_codes: ["Woningtype", "Woningkenmerk"],
            min_year: 2021,
            max_year: 2026,
            supported_query_shapes: ["category_breakdown"],
            contract_status: "complete",
          },
        ],
      }
    );

    expect(plan.measure_label).toBe("Beginstand woningvoorraad");
    expect(plan.measure_key).toBe("woningvoorraad-85035");
    expect(plan.category_dimension_code).toBe("Woningtype");
  });

  it("applies curated preferences when multiple generated contracts can answer a category breakdown", () => {
    const question = "woningtypes per regio in 2023";
    const intent = classifySemanticIntent(question);
    const plan = buildSemanticQueryPlan(
      question,
      intent,
      [
        contractMetric("Beginstand woningvoorraad", "woningvoorraad-82550", "82550NED", true),
        contractMetric("Beginstand woningvoorraad", "woningvoorraad-85035", "85035NED", true),
      ],
      {
        metricPreferences: [
          {
            normalized_metric_label: "beginstand woningvoorraad",
            geography_type: "municipality",
            calculation_code: "category_breakdown",
            preferred_measure_key: "woningvoorraad-85035",
            preferred_dataset_code: "85035NED",
            priority: 10,
            reason: "Use housing stock count for Woningtype category breakdowns by region.",
          },
        ],
        datasetContracts: [
          {
            dataset_code: "82550NED",
            dataset_title: "Woningen; m², type, bouwjaar, regio",
            domain_id: "bouwen-en-wonen",
            data_availability_status: "loaded",
            profile_depth: "sample_profiled",
            default_measure_key: "woningvoorraad-82550",
            default_measure_name: "Beginstand woningvoorraad",
            default_unit_code: "COUNT",
            default_breakdown_dimension: "Woningtype",
            default_filter_dimension: "Bouwjaarklasse",
            default_filter_value: "Totaal",
            geography_types: ["country", "municipality", "province", "region"],
            period_types: ["year"],
            dimension_codes: ["Woningtype", "Bouwjaarklasse"],
            min_year: 2012,
            max_year: 2026,
            supported_query_shapes: ["category_breakdown"],
            contract_status: "complete",
          },
          {
            dataset_code: "85035NED",
            dataset_title: "Woningtype; regio",
            domain_id: "bouwen-en-wonen",
            data_availability_status: "loaded",
            profile_depth: "sample_profiled",
            default_measure_key: "woningvoorraad-85035",
            default_measure_name: "Beginstand woningvoorraad",
            default_unit_code: "COUNT",
            default_breakdown_dimension: "Woningtype",
            default_filter_dimension: "Woningkenmerk",
            default_filter_value: "Totaal woningen",
            geography_types: ["country", "province", "region"],
            period_types: ["year"],
            dimension_codes: ["Woningtype", "Woningkenmerk"],
            min_year: 2021,
            max_year: 2026,
            supported_query_shapes: ["category_breakdown"],
            contract_status: "complete",
          },
        ],
      }
    );

    expect(plan.measure_key).toBe("woningvoorraad-85035");
    expect(plan.dataset_code).toBe("85035NED");
    expect(plan.category_dimension_code).toBe("Woningtype");
    expect(plan.category_filter_dimension_code).toBe("Woningkenmerk");
    expect(plan.category_filter_value).toBe("Totaal woningen");
    expect(plan.geography_type).toBe("region");
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

  it("adds an explicit grain contract to executable plans", () => {
    const question = "Which municipalities have the highest Totaal huurwoningen in 2023?";
    const catalogue = [explicitMetric("Totaal huurwoningen", "huur-totaal", "82900NED")];
    const plan = withExplicitGrain(buildSemanticQueryPlan(question, classifySemanticIntent(question), catalogue));
    const validation = validateSemanticQueryPlan(plan, catalogue);

    expect(plan.measure_key).toBe("huur-totaal");
    expect(plan.dataset_code).toBe("82900NED");
    expect(plan.grain).toEqual({
      geography_type: "municipality",
      period_type: "year",
      display_grain: "municipality_year",
    });
    expect(validation.ok).toBe(true);
    expect(validation.checks.resolution_method).toBe("curated_contract");
  });

  it("uses semantic concepts ahead of literal-but-wrong generated metric labels", () => {
    const question = "waar zijn de meeste nieuwbouwwoningen gebouwd in 2025?";
    const wrongLiteral = explicitMetric("Nieuwbouwwoningen", "index-nieuwbouw", "83547NED", {
      metadata_origin: "generated",
      unit_code: "INDEX",
      aggregation: "average",
      valid_grains: ["unknown_year"],
      default_grain: "unknown_year",
    });
    const conceptBound = explicitMetric("Newly built dwellings", "nieuwbouw-count", "86054NED", {
      metric_code: "new_construction",
      unit_code: "COUNT",
      aggregation: "sum",
      resolution_layer: "semantic_concept",
      concept_match_score: 320,
      semantic_concept_code: "new_construction_dwellings",
      semantic_concept_label: "Newly built dwellings",
      concept_required_unit_code: "COUNT",
      concept_default_grain: "municipality_year",
      concept_valid_grains: ["municipality_year", "province_year", "region_year", "national_year"],
    });
    const plan = withExplicitGrain(buildSemanticQueryPlan(question, classifySemanticIntent(question), [wrongLiteral, conceptBound]));
    const validation = validateSemanticQueryPlan(plan, [wrongLiteral, conceptBound]);

    expect(plan.measure_key).toBe("nieuwbouw-count");
    expect(plan.dataset_code).toBe("86054NED");
    expect(plan.metric_code).toBe("new_construction");
    expect(plan.semantic_concept_code).toBe("new_construction_dwellings");
    expect(plan.resolution_method).toBe("semantic_concept");
    expect(plan.grain?.display_grain).toBe("municipality_year");
    expect(validation.ok).toBe(true);
  });

  it("resolves single-family-home questions as category-filtered housing stock", () => {
    const question = "waar in nederland staan de meeste eensgezinswoningen?";
    const newConstruction = explicitMetric("Newly built dwellings", "nieuwbouw-count", "86054NED", {
      metric_code: "new_construction",
      unit_code: "COUNT",
      aggregation: "sum",
      resolution_layer: "semantic_concept",
      concept_match_score: 0,
      semantic_concept_code: "new_construction_dwellings",
      semantic_concept_label: "Newly built dwellings",
      concept_valid_grains: ["municipality_year", "province_year", "region_year", "national_year"],
    });
    const singleFamilyHomes = explicitMetric("Single-family homes", "woningvoorraad", "82550NED", {
      metric_code: "housing_stock_start",
      unit_code: "COUNT",
      aggregation: "sum",
      resolution_layer: "semantic_concept",
      concept_match_score: 320,
      semantic_concept_code: "single_family_homes",
      semantic_concept_label: "Single-family homes",
      concept_valid_grains: ["municipality_year", "province_year", "region_year", "national_year"],
      category_filters: {
        Woningtype: "Eengezinswoning",
        Bouwjaarklasse: "Totaal",
      },
    });
    const plan = withExplicitGrain(buildSemanticQueryPlan(question, classifySemanticIntent(question), [newConstruction, singleFamilyHomes]));
    const validation = validateSemanticQueryPlan(plan, [newConstruction, singleFamilyHomes]);

    expect(plan.measure_key).toBe("woningvoorraad");
    expect(plan.dataset_code).toBe("82550NED");
    expect(plan.semantic_concept_code).toBe("single_family_homes");
    expect(plan.category_filters).toEqual({
      Woningtype: "Eengezinswoning",
      Bouwjaarklasse: "Totaal",
    });
    expect(plan.grain?.display_grain).toBe("municipality_year");
    expect(validation.ok).toBe(true);
  });

  it("resolves construction-year questions as category-filtered housing stock", () => {
    const question = "waar staan de meeste woningen met bouwjaar 2010";
    const housingStock = explicitMetric("Beginstand woningvoorraad", "woningvoorraad", "82550NED", {
      metric_code: "housing_stock_start",
      unit_code: "COUNT",
      aggregation: "sum",
      valid_grains: ["municipality_year", "province_year", "region_year", "national_year"],
      max_year: 2026,
    });
    const plan = withExplicitGrain(buildRegistryQueryPlan(question, classifySemanticIntent(question), [housingStock], {
      metricGrains: [
        {
          measure_key: "woningvoorraad",
          geography_type: "municipality",
          period_type: "year",
          min_year: 2012,
          max_year: 2026,
          is_supported: true,
        },
      ],
    })!);
    const validation = validateSemanticQueryPlan(plan, [housingStock]);

    expect(plan).toBeDefined();
    expect(plan.measure_key).toBe("woningvoorraad");
    expect(plan.dataset_code).toBe("82550NED");
    expect(plan.semantic_concept_code).toBe("housing_by_construction_year");
    expect(plan.year).toBe(2026);
    expect(plan.category_filters).toEqual({
      Bouwjaarklasse: "2005 tot 2015",
      Woningtype: "Totaal",
    });
    expect(plan.grain?.display_grain).toBe("municipality_year");
    expect(validation.ok).toBe(true);
  });

  it("resolves core Bouwen en wonen registry templates deterministically", () => {
    const metrics = [
      explicitMetric("Totaal huurwoningen", "huur-totaal", "82900NED", {
        metric_code: "total_rental_homes",
        max_year: 2024,
      }),
      explicitMetric("Gemiddelde WOZ-waarde van woningen", "woz", "85036NED", {
        metric_code: "average_woz_home_value",
        unit_code: "EUR_THOUSANDS",
        aggregation: "average",
        max_year: 2026,
      }),
      explicitMetric("Huurverhoging inclusief huurharmonisatie", "huurverhoging", "83162NED", {
        metric_code: "rent_increase_including_harmonisation",
        unit_code: "PERCENT",
        aggregation: "average",
        max_year: 2025,
      }),
      explicitMetric("Gemiddelde verkoopprijs", "verkoopprijs", "83625NED", {
        metric_code: "average_sale_price",
        unit_code: "EUR",
        aggregation: "average",
        max_year: 2024,
      }),
      explicitMetric("Nieuwbouw", "nieuwbouw", "86054NED", {
        metric_code: "new_construction",
        max_year: 2024,
      }),
    ];
    const curation = {
      metricGrains: metrics.map((item) => ({
        measure_key: String(item.metadata.measure_key),
        geography_type: "municipality",
        period_type: "year",
        min_year: 2020,
        max_year: Number(item.metadata.max_year),
        is_supported: true,
      })),
    };

    const cases = [
      ["waar zijn de meeste huurwoningen?", "huur-totaal", "82900NED", 2024, "desc"],
      ["waar is de gemiddelde woz waarde het hoogst in 2023?", "woz", "85036NED", 2023, "desc"],
      ["waar is er de meeste huurverhoging geweest in 2024?", "huurverhoging", "83162NED", 2024, "desc"],
      ["waar zijn koopwoningen het duurst?", "verkoopprijs", "83625NED", 2024, "desc"],
      ["waar zijn de meeste nieuwbouwwoningen gebouwd in 2024?", "nieuwbouw", "86054NED", 2024, "desc"],
    ] as const;

    for (const [question, measureKey, datasetCode, year, sortDirection] of cases) {
      const plan = withExplicitGrain(buildRegistryQueryPlan(question, classifySemanticIntent(question), metrics, curation)!);
      const validation = validateSemanticQueryPlan(plan, metrics);

      expect(plan.measure_key).toBe(measureKey);
      expect(plan.dataset_code).toBe(datasetCode);
      expect(plan.geography_type).toBe("municipality");
      expect(plan.year).toBe(year);
      expect(plan.sort_direction).toBe(sortDirection);
      expect(validation.ok).toBe(true);
    }
  });

  it("keeps municipality filters in registry fallback for terse metric-place questions", () => {
    const nieuwbouw = explicitMetric("Nieuwbouw", "nieuwbouw", "86054NED", {
      metric_code: "new_construction",
      max_year: 2024,
    });
    const plan = withExplicitGrain(buildRegistryQueryPlan("nieuwbouwwoningen in Apeldoorn", classifySemanticIntent("nieuwbouwwoningen in Apeldoorn"), [nieuwbouw], {
      metricGrains: [
        {
          measure_key: "nieuwbouw",
          geography_type: "municipality",
          period_type: "year",
          min_year: 2020,
          max_year: 2024,
          is_supported: true,
        },
      ],
    })!);

    expect(plan.intent).toBe("compare_geographies");
    expect(plan.measure_key).toBe("nieuwbouw");
    expect(plan.dataset_code).toBe("86054NED");
    expect(plan.geography_names).toEqual(["Apeldoorn"]);
    expect(plan.geography_type).toBe("municipality");
    expect(plan.year).toBe(2024);
  });

  it("resolves satisfaction and stock-flow registry templates with explicit filters", () => {
    const metrics = [
      explicitMetric("Tevredenheid met de huidige woning", "tevreden-woning", "84571NED", {
        metric_code: "current_home_satisfaction",
        unit_code: "PERCENT",
        aggregation: "average",
        max_year: 2024,
      }),
      explicitMetric("Sloop", "sloop", "86054NED", {
        metric_code: "sloop__86054ned__57489549721626937",
        max_year: 2024,
      }),
      explicitMetric("Transformatie", "transformatie", "86054NED", {
        metric_code: "transformatie__86054ned__68568907449508083",
        max_year: 2024,
      }),
      explicitMetric("Vergunde tijdelijke woningen", "tijdelijke-woningen", "86318NED", {
        metric_code: "vergunde_tijdelijke_woningen__86318ned__308677585097141194",
        max_year: 2024,
      }),
    ];
    const curation = {
      metricGrains: metrics.map((item) => ({
        measure_key: String(item.metadata.measure_key),
        geography_type: "municipality",
        period_type: "year",
        min_year: 2020,
        max_year: Number(item.metadata.max_year),
        is_supported: true,
      })),
    };

    const satisfaction = withExplicitGrain(buildRegistryQueryPlan("waar zijn mensen het meest tevreden over hun woning?", "rank_geographies", metrics, curation)!);
    expect(satisfaction.measure_key).toBe("tevreden-woning");
    expect(satisfaction.category_filters).toEqual({
      EigenaarOfHuurder: "Totaal",
      Marges: "Waarde",
      Woningkenmerken: "Totaal woningen",
    });
    expect(validateSemanticQueryPlan(satisfaction, metrics).ok).toBe(true);

    const stockFlowCases = [
      ["waar zijn de meeste gesloopte woningen in 2024?", "sloop"],
      ["waar zijn de meeste woningtransformaties in 2024?", "transformatie"],
      ["waar zijn de meeste vergunde tijdelijke woningen in 2024?", "tijdelijke-woningen"],
    ] as const;

    for (const [question, measureKey] of stockFlowCases) {
      const plan = withExplicitGrain(buildRegistryQueryPlan(question, "rank_geographies", metrics, curation)!);
      expect(plan.measure_key).toBe(measureKey);
      expect(plan.year).toBe(2024);
      expect(validateSemanticQueryPlan(plan, metrics).ok).toBe(true);
    }
  });

  it("builds Gold plans from executable semantic contracts before fuzzy planner fallback", () => {
    const context = {
      contracts: [],
      metricContracts: [
        {
          metric_code: "total_rental_homes",
          label: "Total rental homes",
          description: "Total number of rental homes.",
          domain_id: "bouwen-en-wonen",
          measure_key: "123",
          dataset_codes: ["82900NED"],
          unit_code: "COUNT",
          aggregation: "sum",
          valid_grains: ["municipality_year", "province_year", "national_year"],
          default_grain: "municipality_year",
          synonyms: { nl: ["huurwoningen", "totaal huurwoningen"], en: ["rental homes"] },
          exclusions: ["huurverhoging"],
          supports: { ranking: true, comparison: true, trend: true },
          category_filters: {},
          selection_priority: 10,
          metadata_origin: "curated",
          contract_status: "curated",
          execution_status: "enabled",
          semantic_quality_status: "curated",
          availability_status: "available",
        },
      ],
      concepts: [],
      conceptMetricBindings: [],
      results: [],
      metricGrains: [
        {
          measure_key: "123",
          geography_type: "municipality",
          period_type: "year",
          min_year: 2020,
          max_year: 2024,
          is_supported: true,
        },
      ],
      metricPreferences: [],
    };

    const { plan, match } = buildContractQueryPlan("waar zijn de meeste huurwoningen?", "rank_geographies", context);

    expect(match?.metadata.resolution_layer).toBe("semantic_contract_engine");
    expect(plan?.resolution_method).toBe("semantic_contract_engine");
    expect(plan?.measure_key).toBe("123");
    expect(plan?.metric_code).toBe("total_rental_homes");
    expect(plan?.dataset_code).toBe("82900NED");
    expect(plan?.grain?.display_grain).toBe("municipality_year");
    expect(plan?.year).toBe(2024);
  });

  it("does not execute generated semantic contracts until they are reviewed or curated", () => {
    const context = {
      contracts: [],
      metricContracts: [
        {
          metric_code: "generated_housing_metric",
          label: "Generated housing metric",
          description: "Generated profile candidate.",
          domain_id: "bouwen-en-wonen",
          measure_key: "999",
          dataset_codes: ["99999NED"],
          unit_code: "COUNT",
          aggregation: "sum",
          valid_grains: ["municipality_year"],
          default_grain: "municipality_year",
          synonyms: { nl: ["huurwoningen"], en: [] },
          exclusions: [],
          supports: { ranking: true },
          category_filters: {},
          selection_priority: 10,
          metadata_origin: "generated",
          contract_status: "generated",
          execution_status: "disabled",
          semantic_quality_status: "profiled",
          availability_status: "available",
        },
      ],
      concepts: [],
      conceptMetricBindings: [],
      results: [],
      metricGrains: [],
      metricPreferences: [],
    };

    expect(buildContractQueryPlan("waar zijn de meeste huurwoningen?", "rank_geographies", context).plan).toBeUndefined();
  });

  it("resolves generic woonlasten questions to the curated housing-costs dataset", () => {
    const context = {
      contracts: [],
      metricContracts: [
        {
          metric_code: "average_total_housing_costs",
          label: "Average total housing costs",
          description: "Average total housing costs for households.",
          domain_id: "bouwen-en-wonen",
          measure_key: "795966179713435140",
          dataset_codes: ["85949NED"],
          unit_code: "EUR",
          aggregation: "average",
          valid_grains: ["municipality_year", "province_year", "region_year", "national_year"],
          default_grain: "municipality_year",
          synonyms: { nl: ["woonlasten", "totale woonlasten", "gemiddelde woonlasten"], en: ["housing costs"] },
          exclusions: ["mediaan", "woonquote"],
          supports: { ranking: true, comparison: true, trend: true, percentage_change: true },
          category_filters: {
            EigenaarHuurder: "Totaal",
            Huishoudenskenmerken: "Totaal",
            Woningkenmerken: "Totaal ",
          },
          selection_priority: 10,
          metadata_origin: "curated",
          contract_status: "curated",
          execution_status: "enabled",
          semantic_quality_status: "curated",
          availability_status: "available",
        },
      ],
      concepts: [
        {
          concept_code: "housing_costs",
          label: "Housing costs",
          description: "Total housing costs for households.",
          domain_id: "bouwen-en-wonen",
          language_code: "nl",
          synonyms: { nl: ["woonlasten", "totale woonlasten"], en: ["housing costs"] },
          exclusions: ["woonquote"],
          required_unit_code: "EUR",
          default_grain: "municipality_year",
          valid_grains: ["municipality_year", "province_year", "region_year", "national_year"],
          supported_operations: ["ranking", "comparison", "trend"],
          ambiguity_policy: "ask",
          metadata_origin: "curated",
        },
      ],
      conceptMetricBindings: [
        {
          concept_code: "housing_costs",
          metric_code: "average_total_housing_costs",
          measure_key: "795966179713435140",
          dataset_code: "85949NED",
          binding_role: "primary",
          priority: 10,
          required_unit_code: "EUR",
          allowed_grains: ["municipality_year", "province_year", "region_year", "national_year"],
          category_filters: {},
          union_rule_code: null,
          selection_reason: "Use average total housing costs as the default interpretation for generic woonlasten questions.",
          metadata_origin: "curated",
        },
      ],
      dimensionContracts: [],
      results: [],
      metricGrains: [
        {
          measure_key: "795966179713435140",
          geography_type: "municipality",
          period_type: "year",
          min_year: 2015,
          max_year: 2024,
          is_supported: true,
        },
      ],
      metricPreferences: [],
    };

    const question = "wat waren de woonlasten voor mensen in alkmaar";
    const { plan } = buildContractQueryPlan(question, classifySemanticIntent(question), context);

    expect(classifySemanticIntent(question)).toBe("compare_geographies");
    expect(plan?.resolution_method).toBe("semantic_contract_engine");
    expect(plan?.metric_code).toBe("average_total_housing_costs");
    expect(plan?.dataset_code).toBe("85949NED");
    expect(plan?.measure_key).toBe("795966179713435140");
    expect(plan?.geography_names).toEqual(["alkmaar"]);
    expect(plan?.year).toBe(2024);
    expect(plan?.category_filters).toEqual({
      EigenaarHuurder: "Totaal",
      Huishoudenskenmerken: "Totaal",
      Woningkenmerken: "Totaal ",
    });
  });

  it("resolves hoekwoningen as a category-filtered housing stock concept at region grain", () => {
    const context = {
      contracts: [],
      metricContracts: [
        {
          metric_code: "corner_homes",
          label: "Corner homes",
          description: "Number of homes in the housing stock filtered to corner homes.",
          domain_id: "bouwen-en-wonen",
          measure_key: "595126183123467095",
          dataset_codes: ["85035NED"],
          unit_code: "COUNT",
          aggregation: "sum",
          valid_grains: ["region_year", "province_year", "national_year"],
          default_grain: "region_year",
          synonyms: { nl: ["hoekwoningen", "hoekwoning", "meeste hoekwoningen"], en: ["corner homes"] },
          exclusions: ["nieuwbouw", "woz", "verkoopprijs"],
          supports: { ranking: true, comparison: true, trend: true, percentage_change: true },
          category_filters: {
            Woningtype: "Hoekwoning",
            Woningkenmerk: "Totaal woningen",
          },
          selection_priority: 10,
          metadata_origin: "curated",
          contract_status: "curated",
          execution_status: "enabled",
          semantic_quality_status: "curated",
          availability_status: "available",
        },
      ],
      concepts: [
        {
          concept_code: "corner_homes",
          label: "Corner homes",
          description: "Housing stock filtered to corner homes.",
          domain_id: "bouwen-en-wonen",
          language_code: "nl",
          synonyms: { nl: ["hoekwoningen", "hoekwoning"], en: ["corner homes"] },
          exclusions: ["nieuwbouw"],
          required_unit_code: "COUNT",
          default_grain: "region_year",
          valid_grains: ["region_year", "province_year", "national_year"],
          supported_operations: ["ranking", "comparison", "trend"],
          ambiguity_policy: "ask",
          metadata_origin: "curated",
        },
      ],
      conceptMetricBindings: [
        {
          concept_code: "corner_homes",
          metric_code: "corner_homes",
          measure_key: "595126183123467095",
          dataset_code: "85035NED",
          binding_role: "primary",
          priority: 10,
          required_unit_code: "COUNT",
          allowed_grains: ["region_year", "province_year", "national_year"],
          category_filters: {
            Woningtype: "Hoekwoning",
            Woningkenmerk: "Totaal woningen",
          },
          union_rule_code: null,
          selection_reason: "Use dataset 85035NED housing stock filtered to corner homes.",
          metadata_origin: "curated",
        },
      ],
      dimensionContracts: [],
      results: [],
      metricGrains: [
        {
          measure_key: "595126183123467095",
          geography_type: "region",
          period_type: "year",
          min_year: 2021,
          max_year: 2026,
          is_supported: true,
        },
      ],
      metricPreferences: [],
    };

    const question = "waar staan de meeste hoekwoningen in Nederland?";
    const { plan } = buildContractQueryPlan(question, classifySemanticIntent(question), context);

    expect(plan?.resolution_method).toBe("semantic_contract_engine");
    expect(plan?.metric_code).toBe("corner_homes");
    expect(plan?.dataset_code).toBe("85035NED");
    expect(plan?.measure_key).toBe("595126183123467095");
    expect(plan?.geography_names).toEqual([]);
    expect(plan?.geography_type).toBe("region");
    expect(plan?.grain?.display_grain).toBe("region_year");
    expect(plan?.year).toBe(2026);
    expect(plan?.category_filters).toEqual({
      Woningtype: "Hoekwoning",
      Woningkenmerk: "Totaal woningen",
    });
  });

  it("resolves generated woningtype category values as executable filters without one-off metric templates", () => {
    const context = {
      contracts: [],
      metricContracts: [
        {
          metric_code: "housing_stock",
          label: "Housing stock",
          description: "Total housing stock.",
          domain_id: "bouwen-en-wonen",
          measure_key: "broad-housing-stock",
          dataset_codes: ["82550NED"],
          unit_code: "COUNT",
          aggregation: "sum",
          valid_grains: ["municipality_year"],
          default_grain: "municipality_year",
          synonyms: { nl: ["woningen", "woningvoorraad"], en: ["housing stock"] },
          exclusions: [],
          supports: { ranking: true, comparison: true, trend: true },
          category_filters: {},
          selection_priority: 10,
          metadata_origin: "curated",
          contract_status: "curated",
          execution_status: "enabled",
          semantic_quality_status: "curated",
          availability_status: "available",
        },
      ],
      concepts: [],
      conceptMetricBindings: [],
      dimensionContracts: [],
      categoryValueContracts: [
        {
          contract_code: "category_85035ned_woningtype_tussenwoning",
          domain_id: "bouwen-en-wonen",
          dataset_code: "85035NED",
          metric_code: "category_85035ned_woningtype_tussenwoning",
          measure_key: "595126183123467095",
          measure_name: "Beginstand woningvoorraad",
          unit_code: "COUNT",
          aggregation: "sum",
          dimension_code: "Woningtype",
          category_code: "tussenwoning",
          category_name: "Tussenwoning",
          label: "Tussenwoning",
          description: "Generated category value contract.",
          synonyms: { nl: ["tussenwoning", "tussenwoningen"], en: [] },
          category_filters: {
            Woningtype: "Tussenwoning",
            Woningkenmerk: "Totaal woningen",
          },
          valid_grains: ["region_year", "province_year", "national_year"],
          default_grain: "region_year",
          supports: { ranking: true, comparison: true, trend: true, percentage_change: true },
          is_total: false,
          is_unknown: false,
          selection_priority: 60,
          metadata_origin: "generated",
          contract_status: "profiled",
          execution_status: "enabled",
          semantic_quality_status: "category_value_profiled",
          availability_status: "available",
          availability_checked_at: null,
        },
        {
          contract_code: "category_85035ned_woningtype_vrijstaande_woning",
          domain_id: "bouwen-en-wonen",
          dataset_code: "85035NED",
          metric_code: "category_85035ned_woningtype_vrijstaande_woning",
          measure_key: "595126183123467095",
          measure_name: "Beginstand woningvoorraad",
          unit_code: "COUNT",
          aggregation: "sum",
          dimension_code: "Woningtype",
          category_code: "vrijstaande_woning",
          category_name: "Vrijstaande woning",
          label: "Vrijstaande woning",
          description: "Generated category value contract.",
          synonyms: { nl: ["vrijstaande woning", "vrijstaande woningen"], en: [] },
          category_filters: {
            Woningtype: "Vrijstaande woning",
            Woningkenmerk: "Totaal woningen",
          },
          valid_grains: ["region_year", "province_year", "national_year"],
          default_grain: "region_year",
          supports: { ranking: true, comparison: true, trend: true, percentage_change: true },
          is_total: false,
          is_unknown: false,
          selection_priority: 60,
          metadata_origin: "generated",
          contract_status: "profiled",
          execution_status: "enabled",
          semantic_quality_status: "category_value_profiled",
          availability_status: "available",
          availability_checked_at: null,
        },
        {
          contract_code: "category_82550ned_bouwjaarklasse_2010_tot_2015",
          domain_id: "bouwen-en-wonen",
          dataset_code: "82550NED",
          metric_code: "category_82550ned_bouwjaarklasse_2010_tot_2015",
          measure_key: "housing-stock-by-build-year",
          measure_name: "Beginstand woningvoorraad",
          unit_code: "COUNT",
          aggregation: "sum",
          dimension_code: "Bouwjaarklasse",
          category_code: "2010_2015",
          category_name: "2010 tot 2015",
          label: "2010 tot 2015",
          description: "Generated category value contract.",
          synonyms: { nl: ["2010 tot 2015", "bouwjaar 2010"], en: [] },
          category_filters: {
            Bouwjaarklasse: "2010 tot 2015",
            Woningtype: "Totaal woningen",
          },
          valid_grains: ["municipality_year", "region_year", "province_year", "national_year"],
          default_grain: "municipality_year",
          supports: { ranking: true, comparison: true, trend: true, percentage_change: true },
          is_total: false,
          is_unknown: false,
          selection_priority: 60,
          metadata_origin: "generated",
          contract_status: "profiled",
          execution_status: "enabled",
          semantic_quality_status: "category_value_profiled",
          availability_status: "available",
          availability_checked_at: null,
        },
      ],
      results: [],
      metricGrains: [
        {
          measure_key: "595126183123467095",
          geography_type: "region",
          period_type: "year",
          min_year: 2021,
          max_year: 2026,
          is_supported: true,
        },
        {
          measure_key: "housing-stock-by-build-year",
          geography_type: "municipality",
          period_type: "year",
          min_year: 2012,
          max_year: 2026,
          is_supported: true,
        },
      ],
      metricPreferences: [],
    };

    const tussenwoningen = buildContractQueryPlan("waar staan de meeste tussenwoningen in Nederland?", "rank_geographies", context).plan;
    const vrijstaand = buildContractQueryPlan("waar staan de meeste vrijstaande woningen?", "rank_geographies", context).plan;
    const bouwjaar = buildContractQueryPlan("waar staan de meeste woningen met bouwjaar 2010?", "rank_geographies", context).plan;

    expect(tussenwoningen?.metric_code).toBe("category_85035ned_woningtype_tussenwoning");
    expect(tussenwoningen?.dataset_code).toBe("85035NED");
    expect(tussenwoningen?.measure_key).toBe("595126183123467095");
    expect(tussenwoningen?.geography_type).toBe("region");
    expect(tussenwoningen?.year).toBe(2026);
    expect(tussenwoningen?.category_filters).toEqual({
      Woningtype: "Tussenwoning",
      Woningkenmerk: "Totaal woningen",
    });

    expect(vrijstaand?.metric_code).toBe("category_85035ned_woningtype_vrijstaande_woning");
    expect(vrijstaand?.category_filters).toEqual({
      Woningtype: "Vrijstaande woning",
      Woningkenmerk: "Totaal woningen",
    });

    expect(bouwjaar?.metric_code).toBe("category_82550ned_bouwjaarklasse_2010_tot_2015");
    expect(bouwjaar?.dataset_code).toBe("82550NED");
    expect(bouwjaar?.geography_type).toBe("municipality");
    expect(bouwjaar?.category_filters).toEqual({
      Bouwjaarklasse: "2010 tot 2015",
      Woningtype: "Totaal woningen",
    });
  });

  it("blocks vector-only metric resolution", () => {
    const question = "waar is er iets met wonen?";
    const vectorOnly = {
      ...metricWithUnit("Beginstand woningvoorraad", "woningvoorraad", "85035NED", "COUNT"),
      lexical_score: 0,
      vector_score: 0.91,
    };
    const plan = withExplicitGrain(buildSemanticQueryPlan(question, "rank_geographies", [vectorOnly]));
    const validation = validateSemanticQueryPlan(plan, [vectorOnly]);

    expect(validation.ok).toBe(false);
    expect(validation.errors.some((error) => error.includes("vector similarity alone"))).toBe(true);
  });

  it("blocks unsupported requested metric grain", () => {
    const question = "Show Totaal huurwoningen for province Utrecht in 2023.";
    const catalogue = [explicitMetric("Totaal huurwoningen", "huur-totaal", "82900NED", {
      valid_grains: ["municipality_year"],
    })];
    const plan = withExplicitGrain(buildSemanticQueryPlan(question, classifySemanticIntent(question), catalogue));
    const validation = validateSemanticQueryPlan(plan, catalogue);

    expect(plan.grain?.display_grain).toBe("province_year");
    expect(validation.ok).toBe(false);
    expect(validation.errors.some((error) => error.includes("does not declare support"))).toBe(true);
  });

  it("shows semantic diagnostics instead of executing invalid Gold plans", () => {
    const plan = attachSemanticDiagnostics(
      {
        intent: "rank_geographies",
        source: "gold_bouwen_wonen",
        measure_label: "Possible metric",
        geography_type: "municipality",
        explanation: [],
      },
      {
        ok: false,
        confidence: 0.42,
        status: "low_confidence",
        errors: ["Exactly one metric is required before Guara can execute a Gold query."],
        warnings: [],
        checks: {},
      }
    );
    const text = answerText("test question", plan, { rows: [] }, []);

    expect(text.title).toContain("needs a safer interpretation");
    expect(text.bullets[0]).toContain("Possible metric");
    expect(text.confidence).toBe(42);
  });
});
