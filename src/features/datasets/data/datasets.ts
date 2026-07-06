import type { Dataset, DatasetPreviewRow, DatasetVariable, SuggestedJoin } from "../types";

export const allDatasets: Dataset[] = [
  {
    id: "cbs-wijken",
    title: "Kerncijfers wijken en buurten 2023",
    provider: "CBS",
    description:
      "Key figures for all Dutch neighborhoods and districts including population density, income distribution, and housing statistics.",
    tags: ["Population", "Housing", "Economy"],
    updated: "Jan 15, 2024",
    records: "87,432",
    topics: 24,
  },
  {
    id: "cbs-regio",
    title: "Regionale kerncijfers Nederland",
    provider: "CBS",
    description:
      "Regional statistics for all 342 Dutch municipalities covering demographics, economy, health and environmental indicators.",
    tags: ["Demographics", "Economy", "Health"],
    updated: "Feb 1, 2024",
    records: "145,678",
    topics: 38,
  },
  {
    id: "kadaster-woz",
    title: "WOZ-waarden per woning",
    provider: "Kadaster",
    description:
      "Municipal property valuation (WOZ) data for all registered properties in the Netherlands since 2010.",
    tags: ["Housing", "Prices", "Real Estate"],
    updated: "Mar 1, 2024",
    records: "8.2M",
    topics: 12,
  },
  {
    id: "knmi-climate",
    title: "Historische klimaatdata KNMI",
    provider: "KNMI",
    description:
      "Historical climate measurements from 51 weather stations across the Netherlands from 1950 to present.",
    tags: ["Climate", "Weather", "Environment"],
    updated: "Daily",
    records: "2.4M",
    topics: 18,
  },
  {
    id: "rivm-health",
    title: "Volksgezondheid en Zorg Kompas",
    provider: "RIVM",
    description:
      "Public health indicators at municipal level including life expectancy, chronic diseases, and healthcare utilization rates.",
    tags: ["Health", "Demographics"],
    updated: "Dec 12, 2023",
    records: "342,000",
    topics: 56,
  },
  {
    id: "eurostat-nl",
    title: "Netherlands — Eurostat Regional Data",
    provider: "Eurostat",
    description:
      "Comparable regional statistics for Dutch NUTS2 regions in the European context across economy, society and environment.",
    tags: ["Economy", "Comparative", "EU"],
    updated: "Nov 30, 2023",
    records: "48,900",
    topics: 31,
  },
];

// Used by DatasetDetail — static for this dataset
export const datasetDetailPreviewRows: DatasetPreviewRow[] = [
  { muni: "Amsterdam", year: 2023, pop: 921402, income: 38400, woz: 502000 },
  { muni: "Rotterdam", year: 2023, pop: 655468, income: 32100, woz: 348000 },
  { muni: "Utrecht", year: 2023, pop: 368024, income: 41200, woz: 508000 },
  { muni: "Den Haag", year: 2023, pop: 549842, income: 35600, woz: 412000 },
  { muni: "Eindhoven", year: 2023, pop: 237726, income: 37800, woz: 382000 },
];

export const datasetDetailVariables: DatasetVariable[] = [
  { name: "BevolkingAantalInwoners", type: "Integer", descKey: "varDesc.totalResidents" },
  { name: "GeslachtMannen", type: "Integer", descKey: "varDesc.maleResidents" },
  { name: "GeslachtVrouwen", type: "Integer", descKey: "varDesc.femaleResidents" },
  { name: "GemiddeldinkomenperpersoonEuro", type: "Float", descKey: "varDesc.avgIncome" },
  { name: "GemiddeldeWOZwaardewoning", type: "Float", descKey: "varDesc.avgWoz" },
  { name: "OppervlakteTotaalHectare", type: "Float", descKey: "varDesc.totalArea" },
  { name: "Bevolkingsdichtheid", type: "Float", descKey: "varDesc.popDensity" },
  { name: "RegioS", type: "String", descKey: "varDesc.regionCode" },
];

export const datasetDetailSuggestedJoins: SuggestedJoin[] = [
  { name: "WOZ-waarden per woning", provider: "Kadaster", join: "via RegioS → gemeente" },
  { name: "Regionale arbeidsmarkt", provider: "CBS", join: "via RegioS → NUTS3" },
  { name: "Woningwaarde-index", provider: "CBS", join: "via RegioS → gemeente" },
];

// Technical field descriptions — dataset-specific, not translated
export const variableDescriptions: Record<string, string> = {
  "varDesc.totalResidents": "Total number of residents",
  "varDesc.maleResidents": "Number of male residents",
  "varDesc.femaleResidents": "Number of female residents",
  "varDesc.avgIncome": "Average income per person (€)",
  "varDesc.avgWoz": "Average WOZ property value (€1000s)",
  "varDesc.totalArea": "Total area in hectares",
  "varDesc.popDensity": "Population density (per km²)",
  "varDesc.regionCode": "Region code (CBS municipality/wijk/buurt ID)",
};
