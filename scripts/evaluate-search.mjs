#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";

const evaluationPath = resolve(process.cwd(), "evaluation/search-evaluation.json");
const cases = JSON.parse(readFileSync(evaluationPath, "utf8"));

const METRICS = [
  { id: "new_construction_dwellings", terms: ["nieuwbouw", "new construction", "newly built"] },
  { id: "building_permits", terms: ["bouwvergunning", "building permit", "building permits"] },
  { id: "rental_housing", terms: ["huurwoningen", "rental housing", "huur"] },
  { id: "housing_stock_per_capita", terms: ["per capita", "per inwoner"] },
  { id: "average_house_price", terms: ["house price", "huizenprijs", "woningprijs", "prices"] },
  { id: "housing_stock_total", terms: ["housing stock", "woningen", "woningvoorraad", "voorraad woningen"] },
];

function classify(query) {
  const lower = query.toLowerCase();
  if (/^[0-9]{4,5}[a-z]{3}$/i.test(query.trim())) return "catalogue_search";
  if (/do we have|which dataset|find data|gegevens over|data about/.test(lower)) return "data_availability_question";
  if (/compare|vergelijk/.test(lower)) return "analytical_comparison";
  if (/trend|since|after|before|ontwikkeling|verander|changed|change/.test(lower)) return "analytical_trend";
  if (/share|percentage of total|aandeel/.test(lower)) return "analytical_share";
  if (/highest|lowest|most|least|top|meeste|hoogste|laagste/.test(lower)) return "analytical_ranking";
  if (/amsterdam|rotterdam|utrecht|groningen|den haag|gemeente|municipality/.test(lower)) return "entity_lookup";
  return "catalogue_search";
}

function resolveMetric(query) {
  const lower = query.toLowerCase();
  return METRICS.find((metric) => metric.terms.some((term) => lower.includes(term)))?.id ?? null;
}

function resolveDimensions(query) {
  const lower = query.toLowerCase();
  const municipalityMentions = ["amsterdam", "rotterdam", "utrecht", "groningen", "eindhoven", "den haag"].filter((name) => lower.includes(name));
  return /municipalit|gemeenten|gemeente/.test(lower) || municipalityMentions.length > 1 ? ["geography"] : [];
}

function resolveCalculation(intent) {
  const map = {
    analytical_ranking: "ranking",
    analytical_trend: "trend",
    analytical_comparison: "comparison",
    analytical_share: "share_of_total",
  };
  return map[intent] ?? null;
}

function pct(value, total) {
  return total ? `${Math.round((value / total) * 1000) / 10}%` : "0%";
}

const started = performance.now();
const results = cases.map((testCase) => {
  const itemStarted = performance.now();
  const intent = classify(testCase.question);
  const metric = resolveMetric(testCase.question);
  const dimensions = resolveDimensions(testCase.question);
  const calculation = resolveCalculation(intent);
  return {
    question: testCase.question,
    latencyMs: Math.round(performance.now() - itemStarted),
    intentOk: intent === testCase.expectedIntent,
    metricOk: metric === testCase.expectedMetric,
    dimensionOk: JSON.stringify(dimensions) === JSON.stringify(testCase.expectedDimensions),
    calculationOk: calculation === testCase.expectedCalculation,
    successOk: testCase.expectedSuccessStatus === "catalogue" || Boolean(metric),
    zeroResult: !metric && testCase.expectedMetric,
    actual: { intent, metric, dimensions, calculation },
    expected: testCase,
  };
});

const summary = {
  cases: results.length,
  intentAccuracy: pct(results.filter((result) => result.intentOk).length, results.length),
  metricResolutionAccuracy: pct(results.filter((result) => result.metricOk).length, results.length),
  dimensionResolutionAccuracy: pct(results.filter((result) => result.dimensionOk).length, results.length),
  calculationAccuracy: pct(results.filter((result) => result.calculationOk).length, results.length),
  successfulExecutionRate: pct(results.filter((result) => result.successOk).length, results.length),
  zeroResultRate: pct(results.filter((result) => result.zeroResult).length, results.length),
  averageLatencyMs: Math.round(results.reduce((sum, result) => sum + result.latencyMs, 0) / Math.max(results.length, 1)),
  totalLatencyMs: Math.round(performance.now() - started),
};

console.log("Guara search evaluation");
console.log("This is a tiny development fixture, not a production accuracy claim.");
console.table(summary);
const failures = results.filter((result) => !(result.intentOk && result.metricOk && result.dimensionOk && result.calculationOk));
if (failures.length) {
  console.log("\nFailures");
  for (const failure of failures) {
    console.log(JSON.stringify({
      question: failure.question,
      expected: {
        intent: failure.expected.expectedIntent,
        metric: failure.expected.expectedMetric,
        dimensions: failure.expected.expectedDimensions,
        calculation: failure.expected.expectedCalculation,
      },
      actual: failure.actual,
    }, null, 2));
  }
}
