/**
 * Price Trend Indicator — Gold Layer
 *
 * Computes house price trend indicators from Silver municipality records.
 *
 * Derived indicators:
 * - Growth since base year (%)
 * - Price index (base year = 100)
 * - Rank among comparison cities by absolute growth %
 *
 * Silver inputs: SilverMunicipalityRecord.avgWozValueEur, .period, .region
 */

import type { SilverMunicipalityRecord, SilverRecord } from "../../silver/types";
import type { CalculationLog, HousePriceDataPoint, Indicator } from "../types";
import { eurToThousands } from "../../silver/normalizers/unitNormalizer";

const BASE_YEAR = 2015;

// Region codes for the three cities we chart
const CITY_CODES: Record<string, keyof HousePriceDataPoint> = {
  "0363": "Amsterdam",
  "0344": "Utrecht",
  "0599": "Rotterdam",
};

type ChartCity = keyof Omit<HousePriceDataPoint, "year">;

/** Builds the chart data array from filtered Silver records */
export function buildHousePriceChartData(
  silverRecords: SilverRecord<SilverMunicipalityRecord>[]
): HousePriceDataPoint[] {
  // Group by year × city
  const grouped = new Map<string, Partial<Record<ChartCity, number>>>();

  for (const record of silverRecords) {
    const cityKey = CITY_CODES[record.data.region.code];
    if (!cityKey) continue;
    if (record.data.avgWozValueEur === null) continue;

    const year = String(record.data.period.year);
    if (!grouped.has(year)) grouped.set(year, {});
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    grouped.get(year)![cityKey] = eurToThousands(record.data.avgWozValueEur) ?? undefined;
  }

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, cities]) => ({
      year,
      Amsterdam: cities.Amsterdam ?? 0,
      Utrecht: cities.Utrecht ?? 0,
      Rotterdam: cities.Rotterdam ?? 0,
    }));
}

/** Computes growth-since-base-year indicator for a named city */
export function computeGrowthIndicator(
  chartData: HousePriceDataPoint[],
  city: ChartCity
): Indicator {
  const baseRecord = chartData.find((d) => d.year === String(BASE_YEAR));
  const latestRecord = chartData.at(-1);

  const baseValue = baseRecord?.[city] ?? 0;
  const latestValue = latestRecord?.[city] ?? 0;
  const growthPct =
    baseValue > 0 ? Math.round(((latestValue - baseValue) / baseValue) * 10_000) / 100 : 0;

  const calculation: CalculationLog = {
    field: `${city}.growthSinceBaseYearPct`,
    formula: `((latestAvgWozValueEur - baseYearAvgWozValueEur) / baseYearAvgWozValueEur) × 100`,
    silverInputs: ["SilverMunicipalityRecord.avgWozValueEur", "SilverMunicipalityRecord.period.year"],
  };

  return {
    label: `${city} house price growth since ${BASE_YEAR}`,
    value: growthPct,
    unit: "%",
    calculation,
  };
}
