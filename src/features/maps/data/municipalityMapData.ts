import type { DatasetValue, Legend, Municipality, MunicipalityMetadata } from "@/features/maps/types";

export const mapDatasets = [
  { id: "cbs-population", label: "CBS population", provider: "CBS" },
  { id: "kadaster-housing", label: "Kadaster housing", provider: "Kadaster" },
  { id: "cbs-income", label: "CBS income", provider: "CBS" },
  { id: "knmi-climate", label: "KNMI climate exposure", provider: "KNMI" },
] as const;

export const mapIndicators = [
  { id: "population", label: "Population", unit: "residents" },
  { id: "income", label: "Median income", unit: "EUR" },
  { id: "housing", label: "House price", unit: "EUR" },
  { id: "evidence", label: "Evidence density", unit: "datasets" },
] as const;

export const mapYears = [2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015] as const;

export const demoMunicipalities: Municipality[] = [
  {
    id: "gm0363",
    cbsCode: "0363",
    name: "Amsterdam",
    province: "Noord-Holland",
    centroid: [180, 178],
    geometry: {
      type: "svg-path",
      path: "M142 130 L196 118 L232 150 L222 196 L174 214 L132 184 Z",
    },
  },
  {
    id: "gm0599",
    cbsCode: "0599",
    name: "Rotterdam",
    province: "Zuid-Holland",
    centroid: [166, 322],
    geometry: {
      type: "svg-path",
      path: "M112 284 L176 258 L230 292 L220 354 L154 380 L104 342 Z",
    },
  },
  {
    id: "gm0344",
    cbsCode: "0344",
    name: "Utrecht",
    province: "Utrecht",
    centroid: [232, 276],
    geometry: {
      type: "svg-path",
      path: "M206 222 L270 220 L300 268 L280 322 L216 336 L188 286 Z",
    },
  },
  {
    id: "gm0518",
    cbsCode: "0518",
    name: "Den Haag",
    province: "Zuid-Holland",
    centroid: [98, 278],
    geometry: {
      type: "svg-path",
      path: "M58 244 L116 226 L158 264 L140 318 L82 326 L46 288 Z",
    },
  },
  {
    id: "gm0014",
    cbsCode: "0014",
    name: "Groningen",
    province: "Groningen",
    centroid: [282, 66],
    geometry: {
      type: "svg-path",
      path: "M232 32 L306 20 L360 58 L340 112 L270 118 L220 78 Z",
    },
  },
  {
    id: "gm0141",
    cbsCode: "0141",
    name: "Almelo",
    province: "Overijssel",
    centroid: [324, 254],
    geometry: {
      type: "svg-path",
      path: "M300 198 L360 216 L382 274 L344 326 L288 302 L276 242 Z",
    },
  },
  {
    id: "gm0772",
    cbsCode: "0772",
    name: "Eindhoven",
    province: "Noord-Brabant",
    centroid: [256, 428],
    geometry: {
      type: "svg-path",
      path: "M214 386 L272 360 L324 398 L312 462 L244 486 L202 438 Z",
    },
  },
  {
    id: "gm0796",
    cbsCode: "0796",
    name: "Breda",
    province: "Noord-Brabant",
    centroid: [148, 430],
    geometry: {
      type: "svg-path",
      path: "M96 392 L160 366 L210 402 L198 462 L132 486 L84 442 Z",
    },
  },
  {
    id: "gm0935",
    cbsCode: "0935",
    name: "Maastricht",
    province: "Limburg",
    centroid: [286, 548],
    geometry: {
      type: "svg-path",
      path: "M242 508 L300 488 L344 528 L330 590 L266 604 L230 558 Z",
    },
  },
  {
    id: "gm0268",
    cbsCode: "0268",
    name: "Nijmegen",
    province: "Gelderland",
    centroid: [304, 354],
    geometry: {
      type: "svg-path",
      path: "M274 320 L328 304 L372 342 L358 394 L298 410 L262 370 Z",
    },
  },
  {
    id: "gm0080",
    cbsCode: "0080",
    name: "Leeuwarden",
    province: "Fryslan",
    centroid: [196, 84],
    geometry: {
      type: "svg-path",
      path: "M154 40 L220 30 L260 72 L238 126 L172 130 L132 84 Z",
    },
  },
  {
    id: "gm0392",
    cbsCode: "0392",
    name: "Haarlemmermeer",
    province: "Noord-Holland",
    centroid: [112, 188],
    disabled: true,
    geometry: {
      type: "svg-path",
      path: "M76 146 L132 126 L170 162 L154 218 L94 234 L60 190 Z",
    },
  },
];

const metadataSeed: Record<string, MunicipalityMetadata> = {
  gm0363: {
    population: 934927,
    medianAge: 37.5,
    income: 36500,
    housePrice: 598000,
    dataAvailable: 44,
    relatedDatasets: ["CBS Kerncijfers wijken en buurten", "Kadaster woningtransacties", "Election results"],
    evidence: ["Longitudinal CBS coverage from 2015", "Housing values indexed against Kadaster transfers"],
    recentResearch: ["Tourism pressure and rental supply", "Migration flows after 2020"],
    suggestedQuestions: ["How has Amsterdam changed since 2015?", "Compare with Rotterdam", "Show migration", "Show housing prices"],
  },
  gm0599: {
    population: 672960,
    medianAge: 39.8,
    income: 34900,
    housePrice: 428000,
    dataAvailable: 38,
    relatedDatasets: ["CBS population", "Kadaster housing", "Healthcare access"],
    evidence: ["Dense municipal coverage across demographics", "Port labor indicators linked to income"],
    recentResearch: ["Housing affordability in Zuid-Holland", "Migration and household composition"],
    suggestedQuestions: ["How has Rotterdam changed since 2015?", "Compare with Amsterdam", "Show migration", "Show housing prices"],
  },
};

export const municipalityMetadata = demoMunicipalities.reduce<Record<string, MunicipalityMetadata>>(
  (acc, municipality, index) => {
    acc[municipality.id] =
      metadataSeed[municipality.id] ?? {
        population: 118000 + index * 52700,
        medianAge: 38.2 + (index % 5) * 1.1,
        income: 31800 + index * 820,
        housePrice: 342000 + index * 18500,
        dataAvailable: 24 + index,
        relatedDatasets: ["CBS population", "Municipal economy", "Housing register"],
        evidence: ["CBS municipal time series", "Spatial key prepared for GeoJSON joins"],
        recentResearch: ["Population change since 2015", "Housing pressure signals"],
        suggestedQuestions: [
          `How has ${municipality.name} changed since 2015?`,
          "Compare with Amsterdam",
          "Show migration",
          "Show housing prices",
        ],
      };
    return acc;
  },
  {}
);

const indicatorDatasetIds: Record<string, string> = {
  population: "cbs-population",
  income: "cbs-income",
  housing: "kadaster-housing",
  evidence: "knmi-climate",
};

const indicatorUnits: Record<string, string> = {
  population: "residents",
  income: "EUR",
  housing: "EUR",
  evidence: "datasets",
};

export const datasetValues: DatasetValue[] = demoMunicipalities.flatMap((municipality, index) => {
  const metadata = municipalityMetadata[municipality.id] ?? {
    population: 0,
    medianAge: 0,
    income: 0,
    housePrice: 0,
    dataAvailable: 0,
    relatedDatasets: [],
    evidence: [],
    recentResearch: [],
    suggestedQuestions: [],
  };

  return mapYears.flatMap((year) =>
    mapIndicators.map((indicator) => {
      const yearOffset = 2024 - year;
      const baseValue =
        indicator.id === "population"
          ? metadata.population - yearOffset * (1200 + index * 180)
          : indicator.id === "income"
            ? metadata.income - yearOffset * (240 + index * 12)
            : indicator.id === "housing"
              ? metadata.housePrice - yearOffset * (7200 + index * 320)
              : metadata.dataAvailable - Math.min(yearOffset, 7);

      return {
        municipalityId: municipality.id,
        datasetId: indicatorDatasetIds[indicator.id] ?? "cbs-population",
        indicator: indicator.id,
        year,
        value: Math.max(baseValue, 0),
        unit: indicatorUnits[indicator.id] ?? indicator.unit,
        source: {
          provider: indicator.id === "housing" ? "Kadaster" : indicator.id === "evidence" ? "Atlas demo layer" : "CBS",
          lastUpdated: "2026-06-12",
          confidence: municipality.disabled ? 0.42 : 0.86 + (index % 4) * 0.03,
        },
      };
    })
  );
});

export const populationLegend: Legend = {
  title: "Population density signal",
  mode: "quantiles",
  items: [
    { label: "Very low", color: "#EAF2EA" },
    { label: "Low", color: "#CFE2D3" },
    { label: "Medium", color: "#9FC8B0" },
    { label: "High", color: "#5C9E87" },
    { label: "Very high", color: "#1D6F63" },
  ],
};
