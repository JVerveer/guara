/**
 * Period Normalizer — Silver Layer
 *
 * Converts CBS period codes into standardized StandardPeriod objects.
 *
 * CBS Period code format:
 *   "{YYYY}JJ00"     → annual (JJ = jaar / year)
 *   "{YYYY}KW{0N}"   → quarterly (KW = kwartaal / quarter, N = 1–4)
 *   "{YYYY}MM{NN}"   → monthly (MM = maand / month, NN = 01–12)
 *
 * Examples:
 *   "2023JJ00" → year 2023
 *   "2022KW04" → Q4 2022
 *   "2023MM01" → January 2023
 */

import type { StandardPeriod } from "../types";

/** Parse a CBS period code string into a StandardPeriod */
export function normalizeCbsPeriod(cbsPeriodCode: string): StandardPeriod {
  const year = parseInt(cbsPeriodCode.slice(0, 4), 10);
  const typeCode = cbsPeriodCode.slice(4, 6).toUpperCase();
  const subCode = cbsPeriodCode.slice(6);

  if (typeCode === "JJ") {
    return {
      sourceCode: cbsPeriodCode,
      year,
      granularity: "annual",
      isoStart: `${year}-01-01`,
      isoEnd: `${year}-12-31`,
    };
  }

  if (typeCode === "KW") {
    const quarter = parseInt(subCode, 10);
    const startMonth = (quarter - 1) * 3 + 1;
    const endMonth = quarter * 3;
    const endDay = endMonth === 3 || endMonth === 12 ? 31 : endMonth === 6 ? 30 : 30;
    return {
      sourceCode: cbsPeriodCode,
      year,
      quarter,
      granularity: "quarterly",
      isoStart: `${year}-${String(startMonth).padStart(2, "0")}-01`,
      isoEnd: `${year}-${String(endMonth).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`,
    };
  }

  if (typeCode === "MM") {
    const month = parseInt(subCode, 10);
    const daysInMonth = new Date(year, month, 0).getDate();
    return {
      sourceCode: cbsPeriodCode,
      year,
      month,
      granularity: "monthly",
      isoStart: `${year}-${String(month).padStart(2, "0")}-01`,
      isoEnd: `${year}-${String(month).padStart(2, "0")}-${daysInMonth}`,
    };
  }

  // Unknown format — return best-effort annual
  return {
    sourceCode: cbsPeriodCode,
    year,
    granularity: "annual",
    isoStart: `${year}-01-01`,
    isoEnd: `${year}-12-31`,
  };
}

/**
 * Parse a Kadaster peildatum string (ISO 8601: "YYYY-MM-DD") to a StandardPeriod.
 * Kadaster WOZ assessments are always annual with a fixed reference date of Jan 1.
 */
export function normalizeKadasterDate(isoDate: string): StandardPeriod {
  const year = parseInt(isoDate.slice(0, 4), 10);
  return {
    sourceCode: isoDate,
    year,
    granularity: "annual",
    isoStart: `${year}-01-01`,
    isoEnd: `${year}-12-31`,
  };
}

/**
 * Parse a KNMI compact date integer (YYYYMMDD) into a StandardPeriod.
 * KNMI records are daily.
 */
export function normalizeKnmiDate(yyyymmdd: number): StandardPeriod {
  const s = String(yyyymmdd);
  const year = parseInt(s.slice(0, 4), 10);
  const month = parseInt(s.slice(4, 6), 10);
  const day = parseInt(s.slice(6, 8), 10);
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return {
    sourceCode: String(yyyymmdd),
    year,
    month,
    granularity: "daily",
    isoStart: iso,
    isoEnd: iso,
  };
}
