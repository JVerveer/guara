import { datasetService } from "@/features/datasets/services/datasetService";
import type {
  DetectedConcept,
  DetectedEntity,
  EvidenceItem,
  PlannedDataset,
  ResearchPlan,
} from "@/features/investigation/types";

const MUNICIPALITIES = [
  "Amsterdam",
  "Rotterdam",
  "Utrecht",
  "Groningen",
  "Eindhoven",
  "Den Haag",
  "Maastricht",
  "Nijmegen",
  "Leeuwarden",
  "Breda",
] as const;

const CONCEPT_RULES = [
  { id: "population", label: "Population", terms: ["population", "bevolking", "young", "jongeren", "aging", "vergrijzing", "leaving"] },
  { id: "housing", label: "Housing", terms: ["housing", "woning", "woz", "affordability", "huur", "koop"] },
  { id: "income", label: "Income", terms: ["income", "inkomen", "poverty", "armoede", "wealth"] },
  { id: "education", label: "Education", terms: ["education", "onderwijs", "student", "school"] },
  { id: "migration", label: "Migration", terms: ["migration", "migratie", "leaving", "verhuizen", "immigration"] },
  { id: "elections", label: "Elections", terms: ["election", "votes", "pvv", "party", "verkiezing", "stemmen"] },
  { id: "healthcare", label: "Healthcare", terms: ["health", "zorg", "healthcare", "gezondheid"] },
  { id: "energy", label: "Energy", terms: ["energy", "energie", "gas", "electricity"] },
] as const;

function tokenize(question: string): string[] {
  return question
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.replace(/[^\p{L}\p{N}-]/gu, ""))
    .filter(Boolean);
}

function detectEntities(question: string): DetectedEntity[] {
  const lower = question.toLowerCase();
  const municipalities = MUNICIPALITIES.filter((name) => lower.includes(name.toLowerCase())).map((name) => ({
    id: name.toLowerCase().replace(/\s+/g, "-"),
    label: name,
    type: "municipality" as const,
  }));
  const parties = lower.includes("pvv")
    ? [{ id: "pvv", label: "PVV", type: "political-party" as const }]
    : [];

  return [...municipalities, ...parties];
}

function detectConcepts(question: string): DetectedConcept[] {
  const tokens = tokenize(question);
  const concepts = CONCEPT_RULES.map((rule) => ({
    id: rule.id,
    label: rule.label,
    matchedTerms: rule.terms.filter((term) => tokens.some((token) => token.includes(term) || term.includes(token))),
  })).filter((concept) => concept.matchedTerms.length > 0);

  if (concepts.length > 0) return concepts;
  return [{ id: "public-data", label: "Public data", matchedTerms: tokens.slice(0, 4) }];
}

function buildSearchQuery(question: string, concepts: DetectedConcept[]): string {
  const conceptTerms = concepts.flatMap((concept) => concept.matchedTerms).slice(0, 4);
  return [question, ...conceptTerms].join(" ");
}

function explainDataset(datasetTitle: string, concepts: DetectedConcept[], question: string): string {
  const conceptLabels = concepts.map((concept) => concept.label).join(", ");
  return `Selected from Guara's Supabase silver catalog because "${datasetTitle}" matches "${question}" and the detected concept set: ${conceptLabels}.`;
}

export async function createResearchPlan(question: string): Promise<ResearchPlan> {
  const entities = detectEntities(question);
  const concepts = detectConcepts(question);
  const searchQuery = buildSearchQuery(question, concepts);
  const datasets = await datasetService.searchDatasets(searchQuery, []);
  const plannedDatasets: PlannedDataset[] = datasets.slice(0, 5).map((dataset) => ({
    dataset,
    reason: explainDataset(dataset.title, concepts, question),
    selectedVariables: dataset.tags,
  }));

  const expectedConfidence = Math.min(95, Math.max(35, plannedDatasets.length * 18));

  return {
    question,
    entities,
    concepts,
    hypotheses: concepts.slice(0, 4).map((concept) => `${concept.label} may help explain observable municipal differences in the loaded silver data.`),
    datasets: plannedDatasets,
    expectedConfidence,
    strategy: [
      "Start with Supabase silver catalog evidence and inspect selected datasets before drawing conclusions.",
      "Use qualified municipality, province, and country coverage from the loaded silver metadata.",
      "Track every statement back to dataset, variables, Supabase table, update date and license.",
      "Treat unsupported sources, such as election results, as gaps until an official API is connected.",
    ],
  };
}

export function buildEvidenceFromPlan(plan: ResearchPlan): EvidenceItem[] {
  return plan.datasets.map(({ dataset, reason, selectedVariables }) => ({
    id: dataset.id,
    statement: reason,
    source: "CBS StatLine",
    dataset: `${dataset.id} ${dataset.title}`,
    variables: selectedVariables,
    transformation: "Catalog match and concept tagging; no statistical transformation applied yet.",
    confidence: plan.expectedConfidence,
    api: `Supabase public.silver_dataset_catalog / public.dataset_preview_rows (${dataset.id})`,
    lastUpdated: dataset.updated,
    license: "Creative Commons Attribution 4.0",
    provenance: `CBS source ingestion -> Bronze -> Silver -> public Supabase projection -> Guara research plan -> Investigation Workspace`,
  }));
}
