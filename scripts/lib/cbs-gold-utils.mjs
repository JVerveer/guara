import { createHash } from "node:crypto";

export function stableHash(parts) {
  return createHash("sha256")
    .update(parts.map((part) => String(part ?? "")).join("|"))
    .digest("hex");
}

export function stableBigInt(parts) {
  return BigInt(`0x${stableHash(parts).slice(0, 15)}`).toString();
}

export function categoryCombinationHash(categories) {
  if (!categories.length) return stableHash(["NO_CATEGORIES"]);
  return stableHash(
    categories
      .map((category) => `${category.dimensionCode}=${category.categoryCode}`)
      .sort()
  );
}

export function normalizeUnit(rawUnit, measureName = "") {
  const text = `${rawUnit ?? ""} ${measureName ?? ""}`.toLowerCase();
  const clean = String(rawUnit ?? "").trim();

  if (!clean) return "UNKNOWN";
  if (text.includes("procentpunt") || text.includes("percentage point")) return "PERCENTAGE_POINTS";
  if (text.includes("%") || text.includes("percentage") || text.includes("procent")) return "PERCENT";
  if (text.includes("mln euro") || text.includes("million euro")) return "EUR_MILLIONS";
  if (text.includes("1 000 euro") || text.includes("1000 euro") || text.includes("eur1000") || text.includes("x 1 000 euro")) return "EUR_THOUSANDS";
  if (text.includes("euro") || text.includes("eur")) return "EUR";
  if (text.includes("index") || /\b\d{4}\s*=\s*100\b/.test(text)) return "INDEX";
  if (text.includes("m²") || text.includes("m2")) return "SQUARE_METERS";
  if (text.includes("m³") || text.includes("m3")) return "CUBIC_METERS";
  if (text.includes("uren") || text.includes("hours")) return "HOURS";
  if (text.includes("x 1 000") || text.includes("1 000")) return "THOUSANDS";
  if (text.includes("personen") || text.includes("people") || text.includes("inwoners")) return "PERSONS";
  if (text.includes("huishoudens")) return "HOUSEHOLDS";
  if (/aantal|count|number|woningen|bedrijven|objecten/.test(text)) return "COUNT";
  return "UNKNOWN";
}

export function inferValueType(rawUnit, measureName = "") {
  const unit = normalizeUnit(rawUnit, measureName);
  if (unit === "PERCENT") return "percentage";
  if (["EUR", "EUR_THOUSANDS", "EUR_MILLIONS"].includes(unit)) return "currency";
  if (unit === "INDEX") return "index";
  if (["COUNT", "PERSONS", "HOUSEHOLDS"].includes(unit)) return "count";
  return "decimal";
}

export function inferAggregation(rawUnit, measureName = "") {
  const unit = normalizeUnit(rawUnit, measureName);
  if (["PERCENT", "PERCENTAGE_POINTS", "INDEX"].includes(unit)) return "average";
  if (/gemiddeld|average|mediaan|index/.test(String(measureName ?? "").toLowerCase())) return "average";
  if (["COUNT", "PERSONS", "HOUSEHOLDS", "EUR", "EUR_THOUSANDS", "EUR_MILLIONS", "THOUSANDS"].includes(unit)) return "sum";
  return "none";
}

export function geographyTypeFromCode(code, fallback = "unknown") {
  const normalized = String(code ?? "").trim().toUpperCase();
  if (!normalized || ["UNKNOWN", "TOTAAL", "TOTAL"].includes(normalized)) return "country";
  if (["NL", "NL00", "NL01"].includes(normalized)) return "country";
  if (normalized.startsWith("PV")) return "province";
  if (normalized.startsWith("GM")) return "municipality";
  if (normalized.startsWith("WK") || normalized.startsWith("BU")) return "neighborhood";
  if (normalized.startsWith("CR") || normalized.startsWith("COROP")) return "corop";
  if (normalized.startsWith("LD")) return "landsdeel";
  if (fallback === "country" || fallback === "national" || fallback === "unknown") return "country";
  if (fallback === "other" || fallback === "neighborhood" || fallback === "region") return "region";
  return fallback || "country";
}

export function geographyLevelOrder(geographyType) {
  const type = String(geographyType ?? "").trim().toLowerCase();
  if (type === "municipality") return 1;
  if (type === "corop") return 2;
  if (type === "province") return 3;
  if (type === "landsdeel") return 4;
  if (type === "country" || type === "national" || type === "totaal") return 5;
  return null;
}

export function geographyLevelLabel(geographyType) {
  const type = String(geographyType ?? "").trim().toLowerCase();
  if (type === "municipality") return "Gemeente";
  if (type === "corop") return "COROP-gebied";
  if (type === "province") return "Provincie";
  if (type === "landsdeel") return "Landsdeel";
  if (type === "country" || type === "national" || type === "totaal" || type === "unknown") return "Totaal (Nederland)";
  return type || "Totaal (Nederland)";
}

export function safeIsoDate(value) {
  const text = String(value ?? "");
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : null;
}

export function safeIsoTimestamp(value) {
  const text = String(value ?? "");
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text : null;
}

export function numericValue(measure) {
  if (measure.value_numeric !== null && measure.value_numeric !== undefined) return measure.value_numeric;
  return null;
}

export function classifyMissing(measure) {
  const text = String(measure.value_text ?? "").trim().toLowerCase();
  const isMissing = measure.value_numeric === null || measure.value_numeric === undefined || text === "" || text === ".";
  const isSuppressed = ["x", "geheim", "suppressed"].includes(text);
  return {
    isMissing: isMissing || isSuppressed,
    isSuppressed,
    statusCode: isSuppressed ? "suppressed" : isMissing ? "missing" : "reported",
  };
}
