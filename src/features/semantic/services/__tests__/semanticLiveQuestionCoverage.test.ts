import { describe, expect, it } from "vitest";
import { semanticSearchService } from "../semanticSearchService";

const LIVE_QUESTION_CASES = [
  {
    question: "Welke gemeenten hebben veel woningsamenvoegingen en veel betalingsachterstanden zorgpremie in 2024?",
    source: "cross_domain_gold",
    calculation: "cross_domain_comparison",
    metrics: ["housing_mergers", "health_insurance_payment_arrears_share"],
  },
  {
    question: "Waar valt veel nieuwbouw samen met veel betalingsachterstanden zorgpremie in 2024?",
    source: "cross_domain_gold",
    calculation: "cross_domain_comparison",
    metrics: ["new_construction", "health_insurance_payment_arrears_share"],
  },
  {
    question: "Vergelijk huurwoningen met consumentenvertrouwen per provincie in 2024.",
    source: "cross_domain_gold",
    calculation: "cross_domain_comparison",
    metrics: ["total_rental_homes", "consumer_confidence"],
    geographyType: "province",
  },
  {
    question: "Welke gemeenten combineren hoge WOZ-waarde met veel betalingsachterstanden zorgpremie in 2024?",
    source: "cross_domain_gold",
    calculation: "cross_domain_comparison",
    metrics: ["average_woz_home_value", "health_insurance_payment_arrears_share"],
  },
  {
    question: "Waar zijn huurverhogingen hoog en betalingsachterstanden zorgpremie ook hoog in 2024?",
    source: "cross_domain_gold",
    calculation: "cross_domain_comparison",
    metrics: ["rent_increase_including_harmonisation", "health_insurance_payment_arrears_share"],
  },
  {
    question: "Welke gemeenten hadden de meeste nieuwbouwwoningen in 2024?",
    source: "gold_bouwen_wonen",
    metric: "new_construction",
  },
  {
    question: "Waar staan de meeste hoekwoningen?",
    source: "gold_bouwen_wonen",
    metric: "corner_homes",
  },
  {
    question: "Welke gemeenten hebben de meeste gesloopte woningen in 2024?",
    source: "gold_bouwen_wonen",
    metric: "demolished_dwellings",
  },
  {
    question: "Welke provincies hadden het hoogste consumentenvertrouwen in 2025?",
    source: "gold_inkomen_bestedingen",
    metric: "consumer_confidence",
    geographyType: "province",
  },
  {
    question: "Waar zijn de meeste betalingsachterstanden zorgpremie in 2024?",
    source: "gold_inkomen_bestedingen",
    metric: "health_insurance_payment_arrears_share",
  },
  {
    question: "Vergelijk de WOZ-waarde van Alkmaar, Rotterdam en Utrecht in 2023.",
    source: "gold_bouwen_wonen",
    metric: "average_woz_home_value",
  },
  {
    question: "Vergelijk huurwoningen tussen Amsterdam en Rotterdam in 2024.",
    source: "gold_bouwen_wonen",
    metric: "total_rental_homes",
  },
  {
    question: "Vergelijk woningvoorraad met betalingsachterstanden zorgpremie per gemeente in 2024.",
    source: "cross_domain_gold",
    calculation: "cross_domain_comparison",
    metrics: ["housing_stock_start", "health_insurance_payment_arrears_share"],
  },
  {
    question: "Vergelijk gesloopte woningen met consumentenvertrouwen per provincie in 2024.",
    source: "cross_domain_gold",
    calculation: "cross_domain_comparison",
    metrics: ["demolished_dwellings", "consumer_confidence"],
    geographyType: "province",
  },
  {
    question: "Hoe ontwikkelde de woningvoorraad in Alkmaar sinds 2020?",
    source: "gold_bouwen_wonen",
    metric: "housing_stock_start",
    calculation: "trend",
  },
  {
    question: "Toon de trend van nieuwbouwwoningen in Apeldoorn sinds 2021.",
    source: "gold_bouwen_wonen",
    metric: "new_construction",
    calculation: "trend",
  },
  {
    question: "Hoe veranderde de gemiddelde WOZ-waarde in Utrecht tussen 2020 en 2023?",
    source: "gold_bouwen_wonen",
    metric: "average_woz_home_value",
    calculation: "trend",
  },
  {
    question: "Hoe ontwikkelden betalingsachterstanden zorgpremie per gemeente sinds 2021?",
    source: "gold_inkomen_bestedingen",
    metric: "health_insurance_payment_arrears_share",
    calculation: "trend",
  },
  {
    question: "Welke gemeenten hadden de grootste stijging in WOZ-waarde tussen 2020 en 2023?",
    source: "gold_bouwen_wonen",
    metric: "average_woz_home_value",
    calculation: "change_rank",
  },
  {
    question: "Waar nam het aantal huurwoningen het sterkst toe sinds 2021?",
    source: "gold_bouwen_wonen",
    metric: "total_rental_homes",
    calculation: "change_rank",
  },
  {
    question: "Welke gemeenten hadden de grootste daling in woningvoorraad?",
    source: "gold_bouwen_wonen",
    metric: "housing_stock_start",
    calculation: "change_rank",
    sortDirection: "asc",
  },
  {
    question: "Waar stegen betalingsachterstanden zorgpremie het hardst?",
    source: "gold_inkomen_bestedingen",
    metric: "health_insurance_payment_arrears_share",
    calculation: "change_rank",
  },
  {
    question: "Waar staan de meeste eengezinswoningen?",
    source: "gold_bouwen_wonen",
    metric: "housing_stock_start",
    categoryFilters: { Woningtype: "Eengezinswoning" },
  },
  {
    question: "Waar staan de meeste hoekwoningen?",
    source: "gold_bouwen_wonen",
    metric: "corner_homes",
  },
  {
    question: "Waar staan de meeste woningen met bouwjaar 2010?",
    source: "gold_bouwen_wonen",
    metric: "housing_stock_start",
    categoryFilters: { Bouwjaarklasse: "2005 tot 2015" },
  },
  {
    question: "Welke gemeenten hebben veel woningen gebouwd tussen 2000 en 2010?",
    source: "gold_bouwen_wonen",
    metric: "housing_stock_start",
    categoryFilters: { Bouwjaarklasse: "2005 tot 2015" },
  },
  {
    question: "Is er een verband tussen nieuwbouw en betalingsachterstanden zorgpremie?",
    source: "cross_domain_gold",
    calculation: "cross_domain_comparison",
    metrics: ["new_construction", "health_insurance_payment_arrears_share"],
  },
  {
    question: "Hangt hoge WOZ-waarde samen met lagere betalingsachterstanden zorgpremie?",
    source: "cross_domain_gold",
    calculation: "cross_domain_comparison",
    metrics: ["average_woz_home_value", "health_insurance_payment_arrears_share"],
  },
  {
    question: "Zijn gemeenten met veel huurwoningen gevoeliger voor betalingsachterstanden?",
    source: "cross_domain_gold",
    calculation: "cross_domain_comparison",
    metrics: ["total_rental_homes", "health_insurance_payment_arrears_share"],
  },
  {
    question: "Is woontevredenheid lager in gemeenten met meer betalingsachterstanden zorgpremie?",
    source: "cross_domain_gold",
    calculation: "cross_domain_comparison",
    metrics: ["current_home_satisfaction", "health_insurance_payment_arrears_share"],
  },
];

describe.runIf(Boolean(process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY))("live homepage question coverage", () => {
  it.each(LIVE_QUESTION_CASES)("$question", async (testCase) => {
    const answer = await semanticSearchService.answer(testCase.question);
    const rows = Array.isArray(answer.executionResult.rows) ? answer.executionResult.rows : [];
    const componentMetrics = answer.queryPlan.component_measures?.map((component) => component.metric_code).sort() ?? [];

    expect(answer.queryPlan.source).toBe(testCase.source);
    if (testCase.calculation) expect(answer.queryPlan.calculation_code).toBe(testCase.calculation);
    if (testCase.metric) expect(answer.queryPlan.metric_code).toBe(testCase.metric);
    if (testCase.metrics) expect(componentMetrics).toEqual(testCase.metrics.sort());
    if (testCase.geographyType) expect(answer.queryPlan.geography_type).toBe(testCase.geographyType);
    if (testCase.sortDirection) expect(answer.queryPlan.sort_direction).toBe(testCase.sortDirection);
    if (testCase.categoryFilters) expect(answer.queryPlan.category_filters).toMatchObject(testCase.categoryFilters);

    if (process.env.DEBUG_SEMANTIC_LIVE && rows.length === 0) {
      console.log(JSON.stringify({
        question: testCase.question,
        title: answer.title,
        summary: answer.summary,
        queryPlan: answer.queryPlan,
        executionResult: answer.executionResult,
      }, null, 2));
    }

    expect(rows.length).toBeGreaterThan(0);
    expect(answer.title).not.toMatch(/No loaded value found|needs a safer interpretation|Semantic catalogue results/i);
    expect(answer.summary).not.toMatch(/did not execute|no analytical query was executed/i);
  }, 45_000);
});
