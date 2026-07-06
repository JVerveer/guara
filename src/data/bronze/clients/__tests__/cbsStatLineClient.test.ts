import { describe, expect, it, vi } from "vitest";
import { CbsStatLineClient } from "../cbsStatLineClient";
import type { CbsODataResponse, CbsWijkBuurtRecord } from "@/data/bronze/schema/cbs";

function response<TRecord>(value: TRecord[]): Response {
  return new Response(
    JSON.stringify({
      "odata.metadata": "https://opendata.cbs.nl/ODataApi/OData/test/$metadata",
      value,
    } satisfies CbsODataResponse<TRecord>),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

describe("CbsStatLineClient", () => {
  it("builds CBS Open Data v3 TypedDataSet URLs with OData query params", () => {
    const client = new CbsStatLineClient();
    const url = client.getTypedDataSetUrl("70072NED", {
      $select: ["ID", "Perioden", "RegioS", "TotaleBevolking_1"],
      $filter: "Perioden eq '2024JJ00' and substringof('GM',RegioS)",
      $top: 10,
    });

    expect(url).toContain("https://opendata.cbs.nl/ODataApi/odata/70072NED/TypedDataSet?");
    expect(url).toContain("%24format=json");
    expect(url).toContain("%24select=ID%2CPerioden%2CRegioS%2CTotaleBevolking_1");
    expect(url).toContain("%24filter=Perioden+eq+%272024JJ00%27+and+substringof%28%27GM%27%2CRegioS%29");
    expect(url).toContain("%24top=10");
  });

  it("pads 85039NED municipality codes and parses municipality facts", async () => {
    const fetcher = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>().mockResolvedValue(
      response<CbsWijkBuurtRecord>([
        {
          ID: 936,
          WijkenEnBuurten: "GM0363    ",
          Gemeentenaam_1: "Amsterdam                               ",
          AantalInwoners_5: 873338,
          k_65JaarOfOuder_12: 139338,
          GemiddeldeWOZWaardeVanWoningen_35: 423,
          GemiddeldInkomenPerInwoner_72: 30.2,
        },
      ])
    );
    const client = new CbsStatLineClient({ fetcher });

    const facts = await client.getWijkBuurtMunicipalityFacts({ municipalityCodes: ["0363"] });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]?.[0]).toContain("WijkenEnBuurten+eq+%27GM0363++++%27");
    expect(facts[0]?.Gemeentenaam_1.trim()).toBe("Amsterdam");
  });

  it("builds PDOK municipality GeoJSON WFS URLs", () => {
    const client = new CbsStatLineClient();

    expect(client.getMunicipalityGeoJsonUrl({ year: 2024, generalized: true })).toBe(
      "https://service.pdok.nl/cbs/gebiedsindelingen/2024/wfs/v1_0?service=WFS&version=2.0.0&request=GetFeature&typeNames=gebiedsindelingen%3Agemeente_gegeneraliseerd&outputFormat=application%2Fjson&srsName=EPSG%3A4326"
    );
  });
});
