/**
 * KNMI Bronze Connector
 *
 * Returns raw KNMI climate station data with original compact field names
 * and native units (0.1°C, 0.1mm, YYYYMMDD integer dates).
 *
 * TODO (API integration): Replace mock with KNMI Climate Data API v2:
 * ```
 * const res = await fetch(`${KNMI_BASE}/timeseries/point?`, {
 *   method: 'POST',
 *   body: JSON.stringify({ stationId: params.STN, variables: ['TG','RH'], ... })
 * });
 * const json: KnmiApiResponse = await res.json();
 * return { provenance: ..., records: json.result, recordCount: json.result.length };
 * ```
 */

import type { BronzeEnvelope, IBronzeConnector } from "../types";
import type { KnmiDailyRecord } from "../schema/knmi";

const KNMI_BASE = "https://api.dataplatform.knmi.nl/open-data/v1";

// Station 260 = De Bilt — the KNMI reference station for Netherlands average climate
const MOCK_RECORDS: KnmiDailyRecord[] = [
  { STN: 260, YYYYMMDD: 20230101, TG: 28,  TX: 52,  TN: 12,  DR: 0,   RH: 0,   FG: 38, Q: 0   },
  { STN: 260, YYYYMMDD: 20230401, TG: 102, TX: 148, TN: 62,  DR: 12,  RH: 24,  FG: 42, Q: 1180 },
  { STN: 260, YYYYMMDD: 20230701, TG: 198, TX: 258, TN: 148, DR: 8,   RH: 14,  FG: 28, Q: 2340 },
  { STN: 260, YYYYMMDD: 20231001, TG: 138, TX: 188, TN: 94,  DR: 42,  RH: 68,  FG: 45, Q: 640  },
  { STN: 260, YYYYMMDD: 20240101, TG: 72,  TX: 112, TN: 38,  DR: 28,  RH: 56,  FG: 62, Q: 20  },
  { STN: 260, YYYYMMDD: 20240401, TG: 118, TX: 162, TN: 74,  DR: 6,   RH: 12,  FG: 36, Q: 1420 },
];

export const knmiBronzeConnector: IBronzeConnector<KnmiDailyRecord> = {
  sourceId: "knmi",
  datasetId: "ECA_BLENDED_DAILY",
  apiEndpoint: `${KNMI_BASE}/datasets/Actuele10mindataKNMIstations/versions/2/files`,

  async fetch(params: Record<string, string> = {}): Promise<BronzeEnvelope<KnmiDailyRecord>> {
    return {
      provenance: {
        sourceId: this.sourceId,
        datasetId: this.datasetId,
        apiEndpoint: this.apiEndpoint,
        queryParams: { STN: "260", vars: "TG:TX:TN:DR:RH:FG:Q", ...params },
        retrievedAt: "2024-03-01T00:00:00.000Z",
        responseStatus: 200,
        sourceVersion: "v2",
      },
      records: MOCK_RECORDS,
      recordCount: MOCK_RECORDS.length,
    };
  },
};
