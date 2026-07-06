/**
 * Region Normalizer — Silver Layer
 *
 * Resolves CBS municipality codes (format: "GM{4-digit}") and
 * Kadaster codes (format: "{4-digit}" without prefix) into
 * standardized StandardRegion objects with resolved names.
 *
 * In production this registry would be maintained separately and
 * updated when the CBS gemeente-indeling changes (typically annually).
 * Source: CBS gemeentecodes — https://www.cbs.nl/nl-nl/onze-diensten/methoden/classificaties/overig/gemeentelijke-indelingen-per-jaar
 */

import type { StandardRegion } from "../types";

/**
 * Internal municipality registry.
 * Key: 4-digit numeric code (without "GM" prefix).
 * Value: resolved metadata.
 */
const MUNICIPALITY_REGISTRY: Record<
  string,
  Omit<StandardRegion, "sourceCode" | "code">
> = {
  "0363": { name: "Amsterdam",  province: "Noord-Holland", nuts3: "NL321" },
  "0344": { name: "Utrecht",    province: "Utrecht",       nuts3: "NL310" },
  "0599": { name: "Rotterdam",  province: "Zuid-Holland",  nuts3: "NL333" },
  "0518": { name: "Den Haag",   province: "Zuid-Holland",  nuts3: "NL332" },
  "0772": { name: "Eindhoven",  province: "Noord-Brabant", nuts3: "NL413" },
  "0014": { name: "Groningen",  province: "Groningen",     nuts3: "NL111" },
  "0358": { name: "Almere",     province: "Flevoland",     nuts3: "NL230" },
  "0392": { name: "Tilburg",    province: "Noord-Brabant", nuts3: "NL412" },
  "0153": { name: "Enschede",   province: "Overijssel",    nuts3: "NL213" },
  "0384": { name: "Breda",      province: "Noord-Brabant", nuts3: "NL412" },
  // Aging municipalities from CBS bronze data
  "0302": { name: "Rozendaal",         province: "Gelderland",    nuts3: "NL221" },
  "0376": { name: "Blaricum",          province: "Noord-Holland",  nuts3: "NL327" },
  "0629": { name: "Wassenaar",         province: "Zuid-Holland",   nuts3: "NL332" },
  "0385": { name: "Bloemendaal",       province: "Noord-Holland",  nuts3: "NL326" },
  "0090": { name: "Schiermonnikoog",   province: "Groningen",      nuts3: "NL112" },
  "0296": { name: "Wijchen",           province: "Gelderland",     nuts3: "NL226" },
};

/**
 * Resolves a CBS region code (e.g. "GM0363") into a StandardRegion.
 * Returns a fallback with the raw code as the name if the code is unknown.
 */
export function normalizeCbsRegion(cbsCode: string): StandardRegion {
  // CBS codes start with "GM" for municipalities; strip it for lookup
  const numericCode = cbsCode.startsWith("GM") ? cbsCode.slice(2) : cbsCode;
  const resolved = MUNICIPALITY_REGISTRY[numericCode];

  return {
    sourceCode: cbsCode,
    code: numericCode,
    name: resolved?.name ?? `Unknown region (${numericCode})`,
    province: resolved?.province,
    nuts3: resolved?.nuts3,
  };
}

/**
 * Resolves a Kadaster municipality code (4-digit, no "GM" prefix).
 * Kadaster uses the same numeric codes as CBS, just without the prefix.
 */
export function normalizeKadasterRegion(kadasterCode: string): StandardRegion {
  const resolved = MUNICIPALITY_REGISTRY[kadasterCode];
  return {
    sourceCode: kadasterCode,
    code: kadasterCode,
    name: resolved?.name ?? `Unknown municipality (${kadasterCode})`,
    province: resolved?.province,
    nuts3: resolved?.nuts3,
  };
}
