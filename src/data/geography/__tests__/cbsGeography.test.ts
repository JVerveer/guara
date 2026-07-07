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

  it("prefers CBS dimension values over code fallback", () => {
    const qualification = qualifyCbsRecord(
      { RegioS: "PV27  " },
      [{ ID: 0, Position: 0, ParentID: null, Type: "GeoDimension", Key: "RegioS", Title: "Regio's", Description: null }],
      {
        PV27: {
          Key: "PV27  ",
          Title: "Noord-Holland (PV)",
          Description: "PV = Provincie\r\n\r\nBestuurlijke onderverdeling van het Nederlands grondgebied.",
          CategoryGroupID: null,
        },
      }
    );

    expect(qualification.level).toBe("province");
    expect(qualification.name).toBe("Noord-Holland (PV)");
    expect(qualification.source).toBe("cbs-dimension");
  });

  it("summarizes supported levels for display", () => {
    expect(
      summarizeGeographicLevels([
        { level: "country", label: "Country", source: "cbs-dimension" },
        { level: "province", label: "Province", source: "cbs-dimension" },
        { level: "municipality", label: "Municipality", source: "cbs-dimension" },
        { level: "municipality", label: "Municipality", source: "cbs-dimension" },
        { level: "other", label: "Other geography", source: "cbs-dimension" },
      ])
    ).toEqual({ country: 1, province: 1, municipality: 2, other: 1 });
  });
});
