/**
 * Kadaster Bronze Connector
 *
 * Returns raw Kadaster WOZ API responses with original field names.
 * Mock records use real municipality codes (without "GM" prefix, as Kadaster returns them)
 * and realistic BAG identifiers.
 *
 * TODO (API integration): Replace mock with:
 * ```
 * const res = await fetch(`${KADASTER_BASE}/woz-waarden?gemeenteCode=${params.gemeenteCode}`);
 * const json: KadasterApiResponse<KadasterWozRecord> = await res.json();
 * return { provenance: ..., records: json._embedded.results, recordCount: json.page.totalElements };
 * ```
 */

import type { BronzeEnvelope, IBronzeConnector } from "../types";
import type { KadasterWozRecord } from "../schema/kadaster";

const KADASTER_BASE = "https://api.kadaster.nl/lvwoz/wozwaarden/v1";

const MOCK_RECORDS: KadasterWozRecord[] = [
  // Amsterdam (gemeenteCode 0363) — sample WOZ records
  { identificatienummer: "0363010000000001", vastgoedtype: "woning", wozWaarde: 524000, peildatum: "2023-01-01", gemeenteCode: "0363", gemeenteNaam: "Amsterdam", postcode: "1012AB", openbareRuimteNaam: "Kalverstraat", bouwjaar: 1890, oppervlakte: 72 },
  { identificatienummer: "0363010000000002", vastgoedtype: "woning", wozWaarde: 498000, peildatum: "2023-01-01", gemeenteCode: "0363", gemeenteNaam: "Amsterdam", postcode: "1013BV", openbareRuimteNaam: "Haarlemmerdijk", bouwjaar: 1910, oppervlakte: 68 },
  { identificatienummer: "0363010000000003", vastgoedtype: "woning", wozWaarde: 612000, peildatum: "2023-01-01", gemeenteCode: "0363", gemeenteNaam: "Amsterdam", postcode: "1016EG", openbareRuimteNaam: "Keizersgracht", bouwjaar: 1880, oppervlakte: 88 },
  // Utrecht (gemeenteCode 0344) — sample WOZ records
  { identificatienummer: "0344010000000001", vastgoedtype: "woning", wozWaarde: 481000, peildatum: "2023-01-01", gemeenteCode: "0344", gemeenteNaam: "Utrecht", postcode: "3511BT", openbareRuimteNaam: "Oudegracht", bouwjaar: 1905, oppervlakte: 75 },
  { identificatienummer: "0344010000000002", vastgoedtype: "woning", wozWaarde: 456000, peildatum: "2023-01-01", gemeenteCode: "0344", gemeenteNaam: "Utrecht", postcode: "3521AA", openbareRuimteNaam: "Biltstraat", bouwjaar: 1935, oppervlakte: 82 },
  // Rotterdam (gemeenteCode 0599)
  { identificatienummer: "0599010000000001", vastgoedtype: "woning", wozWaarde: 388000, peildatum: "2023-01-01", gemeenteCode: "0599", gemeenteNaam: "Rotterdam", postcode: "3011AA", openbareRuimteNaam: "Meent", bouwjaar: 1960, oppervlakte: 78 },
  { identificatienummer: "0599010000000002", vastgoedtype: "woning", wozWaarde: 362000, peildatum: "2023-01-01", gemeenteCode: "0599", gemeenteNaam: "Rotterdam", postcode: "3014DC", openbareRuimteNaam: "Witte de Withstraat", bouwjaar: 1955, oppervlakte: 71 },
];

export const kadasterBronzeConnector: IBronzeConnector<KadasterWozRecord> = {
  sourceId: "kadaster",
  datasetId: "WOZ-WAARDEN-2023",
  apiEndpoint: `${KADASTER_BASE}/woz-waarden`,

  async fetch(params: Record<string, string> = {}): Promise<BronzeEnvelope<KadasterWozRecord>> {
    return {
      provenance: {
        sourceId: this.sourceId,
        datasetId: this.datasetId,
        apiEndpoint: this.apiEndpoint,
        queryParams: { peildatum: "2023-01-01", vastgoedtype: "woning", ...params },
        retrievedAt: "2024-03-01T00:00:00.000Z",
        responseStatus: 200,
        sourceVersion: "2024-01",
      },
      records: MOCK_RECORDS,
      recordCount: MOCK_RECORDS.length,
    };
  },
};
