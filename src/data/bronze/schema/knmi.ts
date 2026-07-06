/**
 * Bronze Schema — KNMI (Koninklijk Nederlands Meteorologisch Instituut)
 *
 * Reflects the exact field names and units from the KNMI Climate Data API.
 * KNMI uses numeric codes for weather stations and compact field names
 * inherited from legacy FORTRAN data formats.
 *
 * KNMI data documentation: https://www.knmi.nl/kennis-en-datacentrum/achtergrond/data-ophalen-vanuit-knmi-data-platform
 * Climate Explorer: https://climexp.knmi.nl
 */

// ── Daily climate measurements ────────────────────────────────────────────────

/**
 * Raw daily climate record from KNMI station data.
 * All temperature values are in 0.1°C (divide by 10 for Celsius).
 * All precipitation values are in 0.1mm (divide by 10 for mm).
 * Missing values are represented as -1 or null.
 */
export interface KnmiDailyRecord {
  /** KNMI weather station number (260 = De Bilt, 240 = Schiphol, etc.) */
  STN: number;
  /**
   * Date as compact integer: YYYYMMDD.
   * Example: 20230115 = January 15, 2023.
   */
  YYYYMMDD: number;
  /** Daily mean temperature (0.1°C). Divide by 10 for °C. */
  TG: number | null;
  /** Daily maximum temperature (0.1°C) */
  TX: number | null;
  /** Daily minimum temperature (0.1°C) */
  TN: number | null;
  /** Daily precipitation duration (0.1 hr) */
  DR: number | null;
  /** Daily precipitation amount (0.1mm). -1 means < 0.05mm. */
  RH: number | null;
  /** Mean wind speed (0.1 m/s) */
  FG: number | null;
  /** Global radiation (J/cm²) */
  Q: number | null;
}

/** KNMI station metadata */
export interface KnmiStation {
  /** Station number */
  STN: number;
  /** Station name */
  NAME: string;
  /** Latitude (decimal degrees) */
  LAT: number;
  /** Longitude (decimal degrees) */
  LON: number;
  /** Altitude (m above NAP) */
  ALT: number;
}

/** KNMI API response envelope */
export interface KnmiApiResponse {
  /** Station metadata, keyed by station number */
  stations: Record<string, KnmiStation>;
  /** Raw daily records */
  result: KnmiDailyRecord[];
}
