import { cbsStatLineClient } from "@/data/bronze/clients/cbsStatLineClient";
import type { CbsKerncijfersRecord, CbsRegionalCoreRecord } from "../schema/cbs";
import type { BronzeEnvelope, IBronzeConnector } from "../types";

const CBS_REGIONAL_TABLE_ID = "70072NED";
const YEARS = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] as const;
const SELECT_FIELDS = [
  "ID",
  "Perioden",
  "RegioS",
  "TotaleBevolking_1",
  "Mannen_2",
  "Vrouwen_3",
  "JongerDan5Jaar_4",
  "k_5Tot10Jaar_5",
  "k_10Tot15Jaar_6",
  "k_15Tot20Jaar_7",
  "k_20Tot25Jaar_8",
  "k_25Tot45Jaar_9",
  "k_45Tot65Jaar_10",
  "k_65Tot80Jaar_11",
  "k_80JaarOfOuder_12",
  "GemiddeldeWOZWaardeVanWoningen_98",
  "Bevolkingsdichtheid_57",
] as const;

function sumNullable(...values: Array<number | null | undefined>): number | null {
  const known = values.filter((value): value is number => typeof value === "number");
  return known.length === 0 ? null : known.reduce((sum, value) => sum + value, 0);
}

function mapRegionalRecord(record: CbsRegionalCoreRecord): CbsKerncijfersRecord {
  const under15 = sumNullable(record.JongerDan5Jaar_4, record.k_5Tot10Jaar_5, record.k_10Tot15Jaar_6);
  const age15To25 = sumNullable(record.k_15Tot20Jaar_7, record.k_20Tot25Jaar_8);
  const age65Plus = sumNullable(record.k_65Tot80Jaar_11, record.k_80JaarOfOuder_12);

  return {
    ID: record.ID,
    Perioden: record.Perioden,
    RegioS: record.RegioS,
    BevolkingAantalInwoners_1: record.TotaleBevolking_1,
    Mannen_2: record.Mannen_2 ?? null,
    Vrouwen_3: record.Vrouwen_3 ?? null,
    k_0Tot15Jaar_8: under15,
    k_15Tot25Jaar_9: age15To25,
    k_25Tot45Jaar_10: record.k_25Tot45Jaar_9 ?? null,
    k_45Tot65Jaar_11: record.k_45Tot65Jaar_10 ?? null,
    k_65JaarOfOuder_12: age65Plus,
    GemiddeldinkomenperpersoonEuro_66: null,
    GemiddeldeWOZwaardewoning_85: record.GemiddeldeWOZWaardeVanWoningen_98 ?? null,
    AantalWoningen_86: null,
    Bevolkingsdichtheid_33: record.Bevolkingsdichtheid_57 ?? null,
  };
}

export const cbsBronzeConnector: IBronzeConnector<CbsKerncijfersRecord> = {
  sourceId: "cbs",
  datasetId: CBS_REGIONAL_TABLE_ID,
  apiEndpoint: cbsStatLineClient.getTypedDataSetUrl(CBS_REGIONAL_TABLE_ID),

  async fetch(params: Record<string, string> = {}): Promise<BronzeEnvelope<CbsKerncijfersRecord>> {
    const periodFilter = YEARS.map((year) => `Perioden eq '${year}JJ00'`).join(" or ");
    const queryParams = {
      $select: SELECT_FIELDS.join(","),
      $filter: `(${periodFilter}) and substringof('GM',RegioS)`,
      ...params,
    };
    const response = await cbsStatLineClient.getTypedDataSet<CbsRegionalCoreRecord>(CBS_REGIONAL_TABLE_ID, {
      $select: queryParams.$select,
      $filter: queryParams.$filter,
    });

    return {
      provenance: {
        sourceId: this.sourceId,
        datasetId: this.datasetId,
        apiEndpoint: this.apiEndpoint,
        queryParams,
        retrievedAt: new Date().toISOString(),
        responseStatus: 200,
        sourceVersion: response["odata.metadata"],
      },
      records: response.value.map(mapRegionalRecord),
      recordCount: response.value.length,
    };
  },
};
