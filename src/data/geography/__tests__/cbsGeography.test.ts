import { describe, expect, it } from "vitest";
import { levelFromCbsCode, qualifyCbsRecord, summarizeGeographicLevels } from "../cbsGeography";

describe("CBS geography qualification", () => {
  it("classifies CBS administrative region codes", () => {
    expect(levelFromCbsCode("GM0363")).toBe("municipality");
    expect(levelFromCbsCode("PV27  ")).toBe("province");
    expect(levelFromCbsCode("NL01  ")).toBe("country");
    expect(levelFromCbsCode("NL00")).toBe("country");
    expect(levelFromCbsCode("WK036300")).toBe("other");
  });

  it("uses CBS row metadata when the code alone is not enough", () => {
    expect(qualifyCbsRecord({ WijkenEnBuurten: "NL00", SoortRegio_2: "Land" }).level).toBe("country");
    expect(qualifyCbsRecord({ WijkenEnBuurten: "GM0344", SoortRegio_2: "Gemeente" }).level).toBe("municipality");
    expect(qualifyCbsRecord({ WijkenEnBuurten: "BU03440101", SoortRegio_2: "Buurt" }).level).toBe("other");
  });

  it("summarizes supported levels for display", () => {
    expect(
      summarizeGeographicLevels([
        { level: "country", label: "Country" },
        { level: "province", label: "Province" },
        { level: "municipality", label: "Municipality" },
        { level: "municipality", label: "Municipality" },
        { level: "other", label: "Other geography" },
      ])
    ).toEqual({ country: 1, province: 1, municipality: 2, other: 1 });
  });
});
