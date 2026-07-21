import { describe, expect, it } from "vitest";
import {
  categoryCombinationHash,
  classifyMissing,
  geographyTypeFromCode,
  inferAggregation,
  inferValueType,
  normalizeUnit,
  numericValue,
  stableBigInt,
  stableHash,
} from "../lib/cbs-gold-utils.mjs";

describe("CBS Gold loader helpers", () => {
  it("creates deterministic hashes from stable parts", () => {
    expect(stableHash(["85039NED", "GM0363", 2024])).toBe(stableHash(["85039NED", "GM0363", 2024]));
    expect(stableHash(["85039NED", "GM0363", 2024])).not.toBe(stableHash(["85039NED", "GM0363", 2023]));
    expect(stableBigInt(["date", "2024JJ00", "year"])).toMatch(/^\d+$/);
  });

  it("keeps category combination hashes independent of source order", () => {
    const left = categoryCombinationHash([
      { dimensionCode: "Geslacht", categoryCode: "Mannen" },
      { dimensionCode: "Leeftijd", categoryCode: "T001" },
    ]);
    const right = categoryCombinationHash([
      { dimensionCode: "Leeftijd", categoryCode: "T001" },
      { dimensionCode: "Geslacht", categoryCode: "Mannen" },
    ]);

    expect(left).toBe(right);
  });

  it("normalizes common CBS units", () => {
    expect(normalizeUnit("%")).toBe("PERCENT");
    expect(normalizeUnit("procentpunt")).toBe("PERCENTAGE_POINTS");
    expect(normalizeUnit("1 000 euro")).toBe("EUR_THOUSANDS");
    expect(normalizeUnit("mln euro")).toBe("EUR_MILLIONS");
    expect(normalizeUnit("x 1 000")).toBe("THOUSANDS");
    expect(normalizeUnit("aantal personen")).toBe("PERSONS");
    expect(normalizeUnit("2021=100")).toBe("INDEX");
    expect(normalizeUnit("m²")).toBe("SQUARE_METERS");
    expect(normalizeUnit("1 000 m3")).toBe("CUBIC_METERS");
    expect(normalizeUnit("uren")).toBe("HOURS");
  });

  it("marks percentages and indexes as non-sum analytical values", () => {
    expect(inferAggregation("%")).toBe("average");
    expect(inferAggregation("Index")).toBe("average");
    expect(inferValueType("euro")).toBe("currency");
    expect(inferValueType("aantal woningen")).toBe("count");
  });

  it("classifies CBS geography codes without relying on names", () => {
    expect(geographyTypeFromCode("NL01")).toBe("country");
    expect(geographyTypeFromCode("PV22")).toBe("province");
    expect(geographyTypeFromCode("GM0363")).toBe("municipality");
    expect(geographyTypeFromCode("CR11")).toBe("region");
    expect(geographyTypeFromCode("BU03630001", "neighborhood")).toBe("region");
  });

  it("preserves numeric values and classifies missing or suppressed facts", () => {
    expect(numericValue({ value_numeric: 42 })).toBe(42);
    expect(classifyMissing({ value_numeric: 42, value_text: "42" })).toEqual({
      isMissing: false,
      isSuppressed: false,
      statusCode: "reported",
    });
    expect(classifyMissing({ value_numeric: null, value_text: "." })).toEqual({
      isMissing: true,
      isSuppressed: false,
      statusCode: "missing",
    });
    expect(classifyMissing({ value_numeric: null, value_text: "x" })).toEqual({
      isMissing: true,
      isSuppressed: true,
      statusCode: "suppressed",
    });
  });
});
