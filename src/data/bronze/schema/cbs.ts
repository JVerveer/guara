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
