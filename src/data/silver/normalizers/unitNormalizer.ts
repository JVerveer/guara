/**
 * Unit Normalizer — Silver Layer
 *
 * Pure functions for unit conversions applied during Bronze → Silver mapping.
 * All functions document their input and output units in JSDoc.
 */

/**
 * Convert CBS WOZ value from thousands-of-euros to euros.
 * CBS dataset 85039NED field `GemiddeldeWOZwaardewoning_85` is in €1000.
 * @param thousandsEur - value in €1000 (as stored by CBS)
 * @returns value in full EUR, or null if input is null
 */
export function cbsWozToEur(thousandsEur: number | null): number | null {
  if (thousandsEur === null) return null;
  return thousandsEur * 1_000;
}

/**
 * Convert KNMI temperature from tenths-of-a-degree to Celsius.
 * KNMI stores temperature × 10 to avoid floating point in their legacy format.
 * @param tenthsCelsius - temperature in 0.1°C
 * @returns temperature in °C rounded to 1 decimal, or null if input is null/-1
 */
export function knmiTempToCelsius(tenthsCelsius: number | null): number | null {
  if (tenthsCelsius === null || tenthsCelsius === -1) return null;
  return Math.round(tenthsCelsius) / 10;
}

/**
 * Convert KNMI precipitation from tenths-of-a-millimetre to millimetres.
 * A value of -1 means "trace precipitation" (< 0.05mm) — treated as 0.
 * @param tenthsMm - precipitation in 0.1mm
 * @returns precipitation in mm rounded to 1 decimal, or null if missing
 */
export function knmiPrecipToMm(tenthsMm: number | null): number | null {
  if (tenthsMm === null) return null;
  if (tenthsMm === -1) return 0;
  return Math.round(tenthsMm) / 10;
}

/**
 * Compute the percentage of a subgroup within a total population.
 * Returns null if either input is null or total is 0.
 */
export function computeSharePct(
  subgroup: number | null,
  total: number | null
): number | null {
  if (subgroup === null || total === null || total === 0) return null;
  return Math.round((subgroup / total) * 10_000) / 100; // 2 decimal places
}

/**
 * Convert a full EUR value to thousands-of-EUR for display in charts.
 * @param eur - value in EUR
 * @returns value in €000s rounded to 0 decimals
 */
export function eurToThousands(eur: number | null): number | null {
  if (eur === null) return null;
  return Math.round(eur / 1_000);
}
