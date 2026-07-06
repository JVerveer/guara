/**
 * Bronze Schema — CBS (Centraal Bureau voor de Statistiek)
 *
 * These types reflect the EXACT field names and types returned by the
 * CBS OData v4 API. Do not rename or restructure — that is Silver's job.
 *
 * CBS OData documentation: https://www.cbs.nl/nl-nl/onze-diensten/open-data/statline-als-open-data
 * Dataset reference: https://opendata.cbs.nl/ODataCatalog/Tables
 */

// ── Dataset 85039NED — Kerncijfers wijken en buurten ──────────────────────────

/**
 * Raw record from CBS dataset 85039NED (Kerncijfers wijken en buurten).
 * Field names match the CBS OData API exactly, including the numeric suffixes
 * that CBS appends to disambiguate topic codes (e.g. _1, _66, _85).
 */
export interface CbsKerncijfersRecord {
  /** Unique record identifier within the CBS response */
  ID: number;
  /**
   * CBS period code.
   * Format: "{YYYY}JJ00" for annual, "{YYYY}MM{MM}" for monthly.
   * Example: "2023JJ00" = year 2023, "2023MM01" = January 2023.
   */
  Perioden: string;
  /**
   * CBS region code.
   * Format: "GM{4-digit-code}" for municipalities.
   * Example: "GM0363" = Amsterdam, "GM0344" = Utrecht.
   */
  RegioS: string;
  /** Total resident population count (absolute number) */
  BevolkingAantalInwoners_1: number | null;
  /** Male population count */
  Mannen_2: number | null;
  /** Female population count */
  Vrouwen_3: number | null;
  /** Population under 15 years (absolute) */
  k_0Tot15Jaar_8: number | null;
  /** Population 15–24 years */
  k_15Tot25Jaar_9: number | null;
  /** Population 25–44 years */
  k_25Tot45Jaar_10: number | null;
  /** Population 45–64 years */
  k_45Tot65Jaar_11: number | null;
  /** Population 65 years and older */
  k_65JaarOfOuder_12: number | null;
  /** Average disposable income per person (EUR) */
  GemiddeldinkomenperpersoonEuro_66: number | null;
  /**
   * Average WOZ property value of dwellings (EUR × 1000).
   * CBS reports this in thousands of euros.
   */
  GemiddeldeWOZwaardewoning_85: number | null;
  /** Total number of dwellings */
  AantalWoningen_86: number | null;
  /** Population density (inhabitants per km²) */
  Bevolkingsdichtheid_33: number | null;
}

/** OData metadata envelope wrapping CBS response arrays */
export interface CbsODataResponse<TRecord> {
  "odata.metadata"?: string;
  value: TRecord[];
}

// ── CBS Open Data v3 catalog and metadata tables ─────────────────────────────

export interface CbsCatalogTable {
  ID: number;
  Identifier: string;
  Title: string;
  ShortTitle: string;
  ShortDescription: string;
  Summary?: string;
  Modified?: string;
  Updated?: string;
  ReasonDelivery?: string;
  ExplanatoryText?: string;
  Language: string;
  Catalog: string;
  Frequency?: string;
  Period?: string;
}

export interface CbsDataProperty {
  "odata.type"?: string;
  ID: number;
  Position: number | null;
  ParentID: number | null;
  Type:
    | "Dimension"
    | "GeoDimension"
    | "GeoDetail"
    | "TimeDimension"
    | "Topic"
    | "TopicGroup"
    | string;
  Key: string;
  Title: string;
  Description: string | null;
  Datatype?: string;
  Unit?: string;
  Decimals?: number;
  Default?: string;
  PresentationType?: string;
  MapYear?: number | null;
  ReleasePolicy?: boolean;
}

/**
 * Dataset 85039NED as CBS returns it today: one record per 2021 municipality,
 * wijk, or buurt. This shape intentionally preserves the source field names.
 */
export interface CbsWijkBuurtRecord {
  ID: number;
  WijkenEnBuurten: string;
  Gemeentenaam_1: string;
  SoortRegio_2?: string;
  Codering_3?: string;
  AantalInwoners_5: number | null;
  k_0Tot15Jaar_8?: number | null;
  k_15Tot25Jaar_9?: number | null;
  k_25Tot45Jaar_10?: number | null;
  k_45Tot65Jaar_11?: number | null;
  k_65JaarOfOuder_12?: number | null;
  GemiddeldeWOZWaardeVanWoningen_35: number | null;
  GemiddeldInkomenPerInwoner_72?: number | null;
}

/**
 * Minimal regional core record from 70072NED. The StatLine v3 JavaScript
 * examples use this table for period/region filtering and thematic maps.
 */
export interface CbsRegionalCoreRecord {
  ID: number;
  Perioden: string;
  RegioS: string;
  TotaleBevolking_1: number | null;
  Mannen_2?: number | null;
  Vrouwen_3?: number | null;
  JongerDan5Jaar_4?: number | null;
  k_5Tot10Jaar_5?: number | null;
  k_10Tot15Jaar_6?: number | null;
  k_15Tot20Jaar_7?: number | null;
  k_20Tot25Jaar_8?: number | null;
  k_25Tot45Jaar_9?: number | null;
  k_45Tot65Jaar_10?: number | null;
  k_65Tot80Jaar_11?: number | null;
  k_80JaarOfOuder_12?: number | null;
  GemiddeldeWOZWaardeVanWoningen_98?: number | null;
  Bevolkingsdichtheid_57?: number | null;
  VoertuigenMetBromfietskenteken_208?: number | null;
}

// ── Dataset 70072NED — Regionale kerncijfers ─────────────────────────────────

/**
 * Raw record from CBS dataset 70072NED (Regionale kerncijfers Nederland).
 * Coarser than 85039NED — covers province and NUTS3 level aggregations.
 */
export interface CbsRegionaalRecord {
  ID: number;
  Perioden: string;
  RegioS: string;
  /** Unemployment rate (%) */
  Werkloosheidspercentage_1: number | null;
  /** Net labour participation rate (%) */
  NettArbeidparticipatie_2: number | null;
  /** Average income per household (EUR) */
  GemiddeldinkomenperhoudhoudenEuro_14: number | null;
}
