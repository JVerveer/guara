import type {
  SemanticAnswerEnrichment,
  SemanticCaveat,
  SemanticFollowUpQuestion,
  SemanticQueryPlan,
  SemanticRelatedDataset,
  SemanticSearchResult,
} from "../types";

function uniqueBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const value = key(item);
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function domainFromPlan(plan: SemanticQueryPlan): string[] {
  const labels = [plan.measure_label, plan.secondary_measure_label].join(" ").toLowerCase();
  const domains = ["Housing"];
  if (/woz|verkoopprijs|woningwaarde|huur|woning/.test(labels)) domains.push("Income", "Population");
  if (/nieuwbouw|bouwvergunning/.test(labels)) domains.push("Construction", "Migration");
  return uniqueBy(domains, (domain) => domain);
}

function resultRows(result: Record<string, unknown>): Array<Record<string, unknown>> {
  return Array.isArray(result.rows) ? result.rows as Array<Record<string, unknown>> : [];
}

function relatedDatasets(matches: SemanticSearchResult[], plan: SemanticQueryPlan): SemanticRelatedDataset[] {
  const sourceCodes = new Set([plan.metric_code, plan.measure_key, plan.secondary_measure_key].filter(Boolean).map(String));
  const fromMatches = matches
    .filter((match) => match.dataset_code)
    .map((match): SemanticRelatedDataset => ({
      dataset_code: String(match.dataset_code),
      title: match.title,
      provider: match.provider,
      relationship: sourceCodes.has(String(match.metadata?.measure_key)) ? "source" : "same_domain",
      reason: sourceCodes.has(String(match.metadata?.measure_key))
        ? "Used directly or resolved as part of the answer plan."
        : "Retrieved from the same semantic catalogue context and may support adjacent investigation steps.",
    }));

  const planned: SemanticRelatedDataset[] = [];
  const metricText = [plan.measure_label, plan.secondary_measure_label].join(" ").toLowerCase();
  if (/woz|verkoopprijs|woningwaarde/.test(metricText)) {
    planned.push(
      { dataset_code: "82900NED", title: "Totaal huurwoningen", provider: "CBS", relationship: "next_investigation_step", reason: "Helps compare housing values with rental stock and ownership structure." },
      { dataset_code: "83625NED", title: "Gemiddelde verkoopprijs", provider: "CBS", relationship: "same_metric_family", reason: "Market transaction prices can validate or contrast WOZ values." },
      { dataset_code: "85036NED", title: "Gemiddelde WOZ-waarde van woningen", provider: "CBS", relationship: "same_metric_family", reason: "Official assessed housing values are part of the same housing-value family." }
    );
  }
  if (/huur|woningcorporatie/.test(metricText)) {
    planned.push(
      { dataset_code: "82900NED", title: "Woningvoorraad naar eigendom", provider: "CBS", relationship: "same_metric_family", reason: "Breaks rental stock into ownership categories." },
      { dataset_code: "83162NED", title: "Huurverhoging inclusief huurharmonisatie", provider: "CBS", relationship: "next_investigation_step", reason: "Useful for investigating pressure on renters after stock composition is known." }
    );
  }
  if (/nieuwbouw|bouwvergunning/.test(metricText)) {
    planned.push(
      { dataset_code: "82235NED", title: "Nieuwbouw", provider: "CBS", relationship: "same_metric_family", reason: "Shows realized new construction." },
      { dataset_code: "83672NED", title: "Bouwvergunningen totaal", provider: "CBS", relationship: "next_investigation_step", reason: "Permits can indicate future construction pipeline." }
    );
  }

  return uniqueBy([...fromMatches, ...planned], (item) => item.dataset_code).slice(0, 8);
}

function followUps(question: string, plan: SemanticQueryPlan, result: Record<string, unknown>): SemanticFollowUpQuestion[] {
  const geographies = plan.geography_names?.length ? plan.geography_names.join(" and ") : "these municipalities";
  const year = plan.year ?? plan.year_end ?? new Date().getFullYear();
  const metric = plan.measure_label ?? "this metric";
  const rows = resultRows(result);
  const hasRows = rows.length > 0;
  const items: SemanticFollowUpQuestion[] = [
    {
      label: "Show change over time",
      question: `Show the trend for ${metric} in ${geographies} since ${Math.max(1970, Number(year) - 5)}.`,
      reason: "Tests whether the observed result is temporary or part of a longer pattern.",
      status: hasRows ? "answerable_now" : "requires_more_data",
      required_domains: ["Housing"],
      confidence: hasRows ? 0.86 : 0.52,
    },
    {
      label: "Compare municipalities",
      question: `Compare ${metric} in Amsterdam, Rotterdam and Utrecht in ${year}.`,
      reason: "Adds urban benchmarks and makes the result easier to interpret.",
      status: "answerable_now",
      required_domains: ["Housing"],
      confidence: 0.82,
    },
  ];

  const text = [question, metric, plan.secondary_measure_label].join(" ").toLowerCase();
  if (/woz|verkoopprijs|woningwaarde/.test(text)) {
    items.push(
      {
        label: "Compare with rental stock",
        question: `Which municipalities have high ${metric} but low Totaal huurwoningen in ${year}?`,
        reason: "Looks for housing-value pressure in places with relatively small rental markets.",
        status: "answerable_now",
        required_domains: ["Housing"],
        confidence: 0.8,
      },
      {
        label: "Test affordability",
        question: `Compare ${metric} with income for ${geographies} in ${year}.`,
        reason: "Housing values alone do not prove affordability; income is needed for interpretation.",
        status: "requires_more_data",
        required_domains: ["Housing", "Income"],
        confidence: 0.64,
      }
    );
  }

  if (/huur|woningcorporatie/.test(text)) {
    items.push({
      label: "Calculate corporation share",
      question: `What share of Totaal huurwoningen in ${geographies} were Eigendom woningcorporatie in ${year}?`,
      reason: "Turns absolute stock counts into a comparable ratio.",
      status: "answerable_now",
      required_domains: ["Housing"],
      confidence: 0.88,
    });
  }

  if (/nieuwbouw|bouwvergunning/.test(text)) {
    items.push({
      label: "Compare permits and delivery",
      question: `Compare Bouwvergunningen totaal and Nieuwbouw in ${geographies} between ${Number(year) - 3} and ${year}.`,
      reason: "Tests whether permitted construction is translating into delivered new homes.",
      status: "answerable_now",
      required_domains: ["Housing", "Construction"],
      confidence: 0.75,
    });
  }

  return uniqueBy(items, (item) => item.question).slice(0, 6);
}

function caveats(plan: SemanticQueryPlan, result: Record<string, unknown>): SemanticCaveat[] {
  const rows = resultRows(result);
  const warnings = (plan.warnings ?? []).filter((warning) => !/generated grain metadata|no generated grain metadata/i.test(warning));
  const caveats: SemanticCaveat[] = warnings.map((warning) => ({ severity: "warning", message: warning }));
  if (rows.length === 0) {
    caveats.push({ severity: "gap", message: plan.year ? "No loaded value was found for that place and year." : "No year was specified, so Guara may need a year to return one clear value." });
  }
  if (plan.calculation_code && ["share_of_total", "multi_metric_rank", "change_rank", "compare_to_average"].includes(plan.calculation_code)) {
    caveats.push({ severity: "info", message: `This answer uses the derived operator ${plan.calculation_code}; inspect component values before drawing causal conclusions.` });
  }
  if (!plan.geography_type) {
    caveats.push({ severity: "info", message: "No explicit geography grain was resolved; Guara used the available source grain in Gold." });
  }
  return uniqueBy(caveats, (item) => `${item.severity}:${item.message}`);
}

function nextOperators(plan: SemanticQueryPlan): string[] {
  const operators = ["trend", "ranking", "comparison"];
  if (plan.secondary_measure_key || plan.calculation_code === "share_of_total") operators.push("share_of_total");
  operators.push("change_rank", "compare_to_average", "multi_metric_rank");
  return uniqueBy(operators, (operator) => operator);
}

export function enrichSemanticAnswer(
  question: string,
  plan: SemanticQueryPlan,
  result: Record<string, unknown>,
  matches: SemanticSearchResult[]
): SemanticAnswerEnrichment {
  return {
    follow_up_questions: followUps(question, plan, result),
    related_datasets: relatedDatasets(matches, plan),
    caveats: caveats(plan, result),
    next_operators: nextOperators(plan),
    workspace_handoff: {
      title: plan.measure_label ? `Investigate ${plan.measure_label}` : "Open investigation workspace",
      question,
      recommended_workspace: resultRows(result).length > 0 ? "evidence" : "gaps",
      context: {
        query_plan: plan,
        result_preview: resultRows(result).slice(0, 5),
        related_dataset_codes: relatedDatasets(matches, plan).map((dataset) => dataset.dataset_code),
      },
    },
  };
}
