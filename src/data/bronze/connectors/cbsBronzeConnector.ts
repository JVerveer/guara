/**
 * CBS Bronze Connector
 *
 * Returns raw CBS OData responses exactly as the API would provide them.
 * Mock data uses REAL CBS field names, REAL municipality codes, and
 * REAL CBS period format codes so Silver mappers can be tested end-to-end.
 *
 * TODO (API integration): Replace the mock return with:
 * ```
 * const res = await fetch(`${CBS_ODATA_BASE}/${this.datasetId}/TypedDataSet?${qs}`);
 * const json: CbsODataResponse<CbsKerncijfersRecord> = await res.json();
 * return {
 *   provenance: { ...this.baseProvenance(), queryParams: params, responseStatus: res.status },
 *   records: json.value,
 *   recordCount: json.value.length,
 * };
 * ```
 */

import type { BronzeEnvelope, IBronzeConnector } from "../types";
import type { CbsKerncijfersRecord } from "../schema/cbs";

const CBS_ODATA_BASE = "https://opendata.cbs.nl/ODataApi/odata";

// ── Mock raw records — field names are EXACTLY what CBS returns ───────────────
// Municipality codes: GM0363=Amsterdam, GM0344=Utrecht, GM0599=Rotterdam,
//                    GM0518=Den Haag, GM0772=Eindhoven
// Period format: "YYYYJJ00" = annual year

const MOCK_RECORDS: CbsKerncijfersRecord[] = [
  // Amsterdam 2015–2024
  { ID: 1,  Perioden: "2015JJ00", RegioS: "GM0363", BevolkingAantalInwoners_1: 841282,  Mannen_2: 419000, Vrouwen_3: 422282, k_0Tot15Jaar_8: 126000, k_15Tot25Jaar_9: 118000, k_25Tot45Jaar_10: 261000, k_45Tot65Jaar_11: 202000, k_65JaarOfOuder_12: 134282, GemiddeldinkomenperpersoonEuro_66: 30200, GemiddeldeWOZwaardewoning_85: 285,  AantalWoningen_86: 411000, Bevolkingsdichtheid_33: 4908 },
  { ID: 2,  Perioden: "2016JJ00", RegioS: "GM0363", BevolkingAantalInwoners_1: 851003,  Mannen_2: 423000, Vrouwen_3: 428003, k_0Tot15Jaar_8: 128000, k_15Tot25Jaar_9: 119000, k_25Tot45Jaar_10: 264000, k_45Tot65Jaar_11: 204000, k_65JaarOfOuder_12: 136003, GemiddeldinkomenperpersoonEuro_66: 31100, GemiddeldeWOZwaardewoning_85: 307,  AantalWoningen_86: 415000, Bevolkingsdichtheid_33: 4961 },
  { ID: 3,  Perioden: "2017JJ00", RegioS: "GM0363", BevolkingAantalInwoners_1: 862965,  Mannen_2: 429000, Vrouwen_3: 433965, k_0Tot15Jaar_8: 130000, k_15Tot25Jaar_9: 120000, k_25Tot45Jaar_10: 268000, k_45Tot65Jaar_11: 207000, k_65JaarOfOuder_12: 137965, GemiddeldinkomenperpersoonEuro_66: 32400, GemiddeldeWOZwaardewoning_85: 342,  AantalWoningen_86: 419000, Bevolkingsdichtheid_33: 5029 },
  { ID: 4,  Perioden: "2018JJ00", RegioS: "GM0363", BevolkingAantalInwoners_1: 873338,  Mannen_2: 435000, Vrouwen_3: 438338, k_0Tot15Jaar_8: 132000, k_15Tot25Jaar_9: 121000, k_25Tot45Jaar_10: 271000, k_45Tot65Jaar_11: 210000, k_65JaarOfOuder_12: 139338, GemiddeldinkomenperpersoonEuro_66: 33800, GemiddeldeWOZwaardewoning_85: 388,  AantalWoningen_86: 423000, Bevolkingsdichtheid_33: 5089 },
  { ID: 5,  Perioden: "2019JJ00", RegioS: "GM0363", BevolkingAantalInwoners_1: 883402,  Mannen_2: 440000, Vrouwen_3: 443402, k_0Tot15Jaar_8: 134000, k_15Tot25Jaar_9: 122000, k_25Tot45Jaar_10: 274000, k_45Tot65Jaar_11: 213000, k_65JaarOfOuder_12: 140402, GemiddeldinkomenperpersoonEuro_66: 34900, GemiddeldeWOZwaardewoning_85: 406,  AantalWoningen_86: 427000, Bevolkingsdichtheid_33: 5148 },
  { ID: 6,  Perioden: "2020JJ00", RegioS: "GM0363", BevolkingAantalInwoners_1: 893041,  Mannen_2: 445000, Vrouwen_3: 448041, k_0Tot15Jaar_8: 136000, k_15Tot25Jaar_9: 123000, k_25Tot45Jaar_10: 277000, k_45Tot65Jaar_11: 216000, k_65JaarOfOuder_12: 141041, GemiddeldinkomenperpersoonEuro_66: 36200, GemiddeldeWOZwaardewoning_85: 438,  AantalWoningen_86: 431000, Bevolkingsdichtheid_33: 5200 },
  { ID: 7,  Perioden: "2021JJ00", RegioS: "GM0363", BevolkingAantalInwoners_1: 905234,  Mannen_2: 450000, Vrouwen_3: 455234, k_0Tot15Jaar_8: 138000, k_15Tot25Jaar_9: 124000, k_25Tot45Jaar_10: 281000, k_45Tot65Jaar_11: 219000, k_65JaarOfOuder_12: 143234, GemiddeldinkomenperpersoonEuro_66: 37600, GemiddeldeWOZwaardewoning_85: 502,  AantalWoningen_86: 435000, Bevolkingsdichtheid_33: 5272 },
  { ID: 8,  Perioden: "2022JJ00", RegioS: "GM0363", BevolkingAantalInwoners_1: 914802,  Mannen_2: 455000, Vrouwen_3: 459802, k_0Tot15Jaar_8: 140000, k_15Tot25Jaar_9: 125000, k_25Tot45Jaar_10: 284000, k_45Tot65Jaar_11: 221000, k_65JaarOfOuder_12: 144802, GemiddeldinkomenperpersoonEuro_66: 38100, GemiddeldeWOZwaardewoning_85: 548,  AantalWoningen_86: 439000, Bevolkingsdichtheid_33: 5325 },
  { ID: 9,  Perioden: "2023JJ00", RegioS: "GM0363", BevolkingAantalInwoners_1: 921402,  Mannen_2: 458000, Vrouwen_3: 463402, k_0Tot15Jaar_8: 141000, k_15Tot25Jaar_9: 126000, k_25Tot45Jaar_10: 286000, k_45Tot65Jaar_11: 222000, k_65JaarOfOuder_12: 146402, GemiddeldinkomenperpersoonEuro_66: 38400, GemiddeldeWOZwaardewoning_85: 524,  AantalWoningen_86: 442000, Bevolkingsdichtheid_33: 5364 },
  { ID: 10, Perioden: "2024JJ00", RegioS: "GM0363", BevolkingAantalInwoners_1: 928100,  Mannen_2: 462000, Vrouwen_3: 466100, k_0Tot15Jaar_8: 142000, k_15Tot25Jaar_9: 127000, k_25Tot45Jaar_10: 288000, k_45Tot65Jaar_11: 224000, k_65JaarOfOuder_12: 147100, GemiddeldinkomenperpersoonEuro_66: 39100, GemiddeldeWOZwaardewoning_85: 558,  AantalWoningen_86: 445000, Bevolkingsdichtheid_33: 5403 },
  // Utrecht 2015–2024
  { ID: 11, Perioden: "2015JJ00", RegioS: "GM0344", BevolkingAantalInwoners_1: 334176,  Mannen_2: 165000, Vrouwen_3: 169176, k_0Tot15Jaar_8: 56000,  k_15Tot25Jaar_9: 68000,  k_25Tot45Jaar_10: 107000, k_45Tot65Jaar_11: 72000,  k_65JaarOfOuder_12: 31176,  GemiddeldinkomenperpersoonEuro_66: 30100, GemiddeldeWOZwaardewoning_85: 220,  AantalWoningen_86: 146000, Bevolkingsdichtheid_33: 3306 },
  { ID: 12, Perioden: "2016JJ00", RegioS: "GM0344", BevolkingAantalInwoners_1: 338042,  Mannen_2: 167000, Vrouwen_3: 171042, k_0Tot15Jaar_8: 57000,  k_15Tot25Jaar_9: 69000,  k_25Tot45Jaar_10: 108000, k_45Tot65Jaar_11: 72500,  k_65JaarOfOuder_12: 31542,  GemiddeldinkomenperpersoonEuro_66: 31200, GemiddeldeWOZwaardewoning_85: 248,  AantalWoningen_86: 147500, Bevolkingsdichtheid_33: 3344 },
  { ID: 13, Perioden: "2017JJ00", RegioS: "GM0344", BevolkingAantalInwoners_1: 342165,  Mannen_2: 169000, Vrouwen_3: 173165, k_0Tot15Jaar_8: 58000,  k_15Tot25Jaar_9: 70000,  k_25Tot45Jaar_10: 109000, k_45Tot65Jaar_11: 73000,  k_65JaarOfOuder_12: 32165,  GemiddeldinkomenperpersoonEuro_66: 32600, GemiddeldeWOZwaardewoning_85: 286,  AantalWoningen_86: 149000, Bevolkingsdichtheid_33: 3383 },
  { ID: 14, Perioden: "2018JJ00", RegioS: "GM0344", BevolkingAantalInwoners_1: 347483,  Mannen_2: 172000, Vrouwen_3: 175483, k_0Tot15Jaar_8: 59000,  k_15Tot25Jaar_9: 71000,  k_25Tot45Jaar_10: 111000, k_45Tot65Jaar_11: 73500,  k_65JaarOfOuder_12: 32983,  GemiddeldinkomenperpersoonEuro_66: 34200, GemiddeldeWOZwaardewoning_85: 326,  AantalWoningen_86: 150500, Bevolkingsdichtheid_33: 3436 },
  { ID: 15, Perioden: "2019JJ00", RegioS: "GM0344", BevolkingAantalInwoners_1: 352342,  Mannen_2: 174000, Vrouwen_3: 178342, k_0Tot15Jaar_8: 60000,  k_15Tot25Jaar_9: 72000,  k_25Tot45Jaar_10: 112000, k_45Tot65Jaar_11: 74000,  k_65JaarOfOuder_12: 34342,  GemiddeldinkomenperpersoonEuro_66: 36000, GemiddeldeWOZwaardewoning_85: 365,  AantalWoningen_86: 152000, Bevolkingsdichtheid_33: 3484 },
  { ID: 16, Perioden: "2020JJ00", RegioS: "GM0344", BevolkingAantalInwoners_1: 357834,  Mannen_2: 177000, Vrouwen_3: 180834, k_0Tot15Jaar_8: 61000,  k_15Tot25Jaar_9: 73000,  k_25Tot45Jaar_10: 114000, k_45Tot65Jaar_11: 74500,  k_65JaarOfOuder_12: 35334,  GemiddeldinkomenperpersoonEuro_66: 37800, GemiddeldeWOZwaardewoning_85: 404,  AantalWoningen_86: 153500, Bevolkingsdichtheid_33: 3540 },
  { ID: 17, Perioden: "2021JJ00", RegioS: "GM0344", BevolkingAantalInwoners_1: 361924,  Mannen_2: 179000, Vrouwen_3: 182924, k_0Tot15Jaar_8: 62000,  k_15Tot25Jaar_9: 74000,  k_25Tot45Jaar_10: 115000, k_45Tot65Jaar_11: 75000,  k_65JaarOfOuder_12: 35924,  GemiddeldinkomenperpersoonEuro_66: 39400, GemiddeldeWOZwaardewoning_85: 462,  AantalWoningen_86: 155000, Bevolkingsdichtheid_33: 3578 },
  { ID: 18, Perioden: "2022JJ00", RegioS: "GM0344", BevolkingAantalInwoners_1: 365128,  Mannen_2: 181000, Vrouwen_3: 184128, k_0Tot15Jaar_8: 63000,  k_15Tot25Jaar_9: 75000,  k_25Tot45Jaar_10: 116000, k_45Tot65Jaar_11: 75500,  k_65JaarOfOuder_12: 35628,  GemiddeldinkomenperpersoonEuro_66: 40600, GemiddeldeWOZwaardewoning_85: 498,  AantalWoningen_86: 156500, Bevolkingsdichtheid_33: 3611 },
  { ID: 19, Perioden: "2023JJ00", RegioS: "GM0344", BevolkingAantalInwoners_1: 368024,  Mannen_2: 182000, Vrouwen_3: 186024, k_0Tot15Jaar_8: 64000,  k_15Tot25Jaar_9: 76000,  k_25Tot45Jaar_10: 117000, k_45Tot65Jaar_11: 76000,  k_65JaarOfOuder_12: 35024,  GemiddeldinkomenperpersoonEuro_66: 41200, GemiddeldeWOZwaardewoning_85: 481,  AantalWoningen_86: 158000, Bevolkingsdichtheid_33: 3641 },
  { ID: 20, Perioden: "2024JJ00", RegioS: "GM0344", BevolkingAantalInwoners_1: 371500,  Mannen_2: 184000, Vrouwen_3: 187500, k_0Tot15Jaar_8: 65000,  k_15Tot25Jaar_9: 77000,  k_25Tot45Jaar_10: 118000, k_45Tot65Jaar_11: 76500,  k_65JaarOfOuder_12: 35000,  GemiddeldinkomenperpersoonEuro_66: 42100, GemiddeldeWOZwaardewoning_85: 508,  AantalWoningen_86: 159500, Bevolkingsdichtheid_33: 3677 },
  // Rotterdam 2015–2024
  { ID: 21, Perioden: "2015JJ00", RegioS: "GM0599", BevolkingAantalInwoners_1: 623652,  Mannen_2: 310000, Vrouwen_3: 313652, k_0Tot15Jaar_8: 100000, k_15Tot25Jaar_9: 90000,  k_25Tot45Jaar_10: 192000, k_45Tot65Jaar_11: 158000, k_65JaarOfOuder_12: 83652,  GemiddeldinkomenperpersoonEuro_66: 27400, GemiddeldeWOZwaardewoning_85: 198,  AantalWoningen_86: 300000, Bevolkingsdichtheid_33: 3004 },
  { ID: 22, Perioden: "2016JJ00", RegioS: "GM0599", BevolkingAantalInwoners_1: 630000,  Mannen_2: 313000, Vrouwen_3: 317000, k_0Tot15Jaar_8: 101000, k_15Tot25Jaar_9: 91000,  k_25Tot45Jaar_10: 194000, k_45Tot65Jaar_11: 159000, k_65JaarOfOuder_12: 85000,  GemiddeldinkomenperpersoonEuro_66: 28100, GemiddeldeWOZwaardewoning_85: 214,  AantalWoningen_86: 303000, Bevolkingsdichtheid_33: 3035 },
  { ID: 23, Perioden: "2017JJ00", RegioS: "GM0599", BevolkingAantalInwoners_1: 636978,  Mannen_2: 317000, Vrouwen_3: 319978, k_0Tot15Jaar_8: 102000, k_15Tot25Jaar_9: 92000,  k_25Tot45Jaar_10: 196000, k_45Tot65Jaar_11: 160000, k_65JaarOfOuder_12: 86978,  GemiddeldinkomenperpersoonEuro_66: 29200, GemiddeldeWOZwaardewoning_85: 236,  AantalWoningen_86: 306000, Bevolkingsdichtheid_33: 3069 },
  { ID: 24, Perioden: "2018JJ00", RegioS: "GM0599", BevolkingAantalInwoners_1: 643312,  Mannen_2: 320000, Vrouwen_3: 323312, k_0Tot15Jaar_8: 103000, k_15Tot25Jaar_9: 93000,  k_25Tot45Jaar_10: 198000, k_45Tot65Jaar_11: 161000, k_65JaarOfOuder_12: 88312,  GemiddeldinkomenperpersoonEuro_66: 30100, GemiddeldeWOZwaardewoning_85: 264,  AantalWoningen_86: 309000, Bevolkingsdichtheid_33: 3101 },
  { ID: 25, Perioden: "2019JJ00", RegioS: "GM0599", BevolkingAantalInwoners_1: 650488,  Mannen_2: 323000, Vrouwen_3: 327488, k_0Tot15Jaar_8: 104000, k_15Tot25Jaar_9: 94000,  k_25Tot45Jaar_10: 200000, k_45Tot65Jaar_11: 162000, k_65JaarOfOuder_12: 90488,  GemiddeldinkomenperpersoonEuro_66: 30900, GemiddeldeWOZwaardewoning_85: 285,  AantalWoningen_86: 312000, Bevolkingsdichtheid_33: 3136 },
  { ID: 26, Perioden: "2020JJ00", RegioS: "GM0599", BevolkingAantalInwoners_1: 651157,  Mannen_2: 324000, Vrouwen_3: 327157, k_0Tot15Jaar_8: 104500, k_15Tot25Jaar_9: 94500,  k_25Tot45Jaar_10: 200500, k_45Tot65Jaar_11: 163000, k_65JaarOfOuder_12: 88657,  GemiddeldinkomenperpersoonEuro_66: 31500, GemiddeldeWOZwaardewoning_85: 312,  AantalWoningen_86: 315000, Bevolkingsdichtheid_33: 3139 },
  { ID: 27, Perioden: "2021JJ00", RegioS: "GM0599", BevolkingAantalInwoners_1: 652912,  Mannen_2: 325000, Vrouwen_3: 327912, k_0Tot15Jaar_8: 105000, k_15Tot25Jaar_9: 95000,  k_25Tot45Jaar_10: 201000, k_45Tot65Jaar_11: 163500, k_65JaarOfOuder_12: 88412,  GemiddeldinkomenperpersoonEuro_66: 32100, GemiddeldeWOZwaardewoning_85: 368,  AantalWoningen_86: 318000, Bevolkingsdichtheid_33: 3148 },
  { ID: 28, Perioden: "2022JJ00", RegioS: "GM0599", BevolkingAantalInwoners_1: 655000,  Mannen_2: 326000, Vrouwen_3: 329000, k_0Tot15Jaar_8: 105500, k_15Tot25Jaar_9: 95500,  k_25Tot45Jaar_10: 202000, k_45Tot65Jaar_11: 164000, k_65JaarOfOuder_12: 88000,  GemiddeldinkomenperpersoonEuro_66: 31800, GemiddeldeWOZwaardewoning_85: 402,  AantalWoningen_86: 321000, Bevolkingsdichtheid_33: 3158 },
  { ID: 29, Perioden: "2023JJ00", RegioS: "GM0599", BevolkingAantalInwoners_1: 655468,  Mannen_2: 326500, Vrouwen_3: 328968, k_0Tot15Jaar_8: 106000, k_15Tot25Jaar_9: 96000,  k_25Tot45Jaar_10: 202500, k_45Tot65Jaar_11: 164500, k_65JaarOfOuder_12: 86468,  GemiddeldinkomenperpersoonEuro_66: 32100, GemiddeldeWOZwaardewoning_85: 388,  AantalWoningen_86: 324000, Bevolkingsdichtheid_33: 3160 },
  { ID: 30, Perioden: "2024JJ00", RegioS: "GM0599", BevolkingAantalInwoners_1: 658200,  Mannen_2: 328000, Vrouwen_3: 330200, k_0Tot15Jaar_8: 107000, k_15Tot25Jaar_9: 97000,  k_25Tot45Jaar_10: 203000, k_45Tot65Jaar_11: 165000, k_65JaarOfOuder_12: 86200,  GemiddeldinkomenperpersoonEuro_66: 32800, GemiddeldeWOZwaardewoning_85: 412,  AantalWoningen_86: 327000, Bevolkingsdichtheid_33: 3173 },
  // Aging municipalities (single year, 2023)
  { ID: 31, Perioden: "2023JJ00", RegioS: "GM0302", BevolkingAantalInwoners_1: 1605,   Mannen_2: 780,  Vrouwen_3: 825,  k_0Tot15Jaar_8: 152,  k_15Tot25Jaar_9: 134,  k_25Tot45Jaar_10: 284,  k_45Tot65Jaar_11: 636,  k_65JaarOfOuder_12: 398,  GemiddeldinkomenperpersoonEuro_66: 44200, GemiddeldeWOZwaardewoning_85: 498,  AantalWoningen_86: 890,  Bevolkingsdichtheid_33: 192 },
  { ID: 32, Perioden: "2023JJ00", RegioS: "GM0376", BevolkingAantalInwoners_1: 10420,  Mannen_2: 5100, Vrouwen_3: 5320, k_0Tot15Jaar_8: 1200, k_15Tot25Jaar_9: 1000, k_25Tot45Jaar_10: 2600, k_45Tot65Jaar_11: 3200, k_65JaarOfOuder_12: 2420, GemiddeldinkomenperpersoonEuro_66: 52000, GemiddeldeWOZwaardewoning_85: 542,  AantalWoningen_86: 4600, Bevolkingsdichtheid_33: 410 },
  { ID: 33, Perioden: "2023JJ00", RegioS: "GM0629", BevolkingAantalInwoners_1: 25800,  Mannen_2: 12500, Vrouwen_3: 13300, k_0Tot15Jaar_8: 3000, k_15Tot25Jaar_9: 2600, k_25Tot45Jaar_10: 6400, k_45Tot65Jaar_11: 8000, k_65JaarOfOuder_12: 5782, GemiddeldinkomenperpersoonEuro_66: 47800, GemiddeldeWOZwaardewoning_85: 512,  AantalWoningen_86: 11200, Bevolkingsdichtheid_33: 680 },
  { ID: 34, Perioden: "2023JJ00", RegioS: "GM0385", BevolkingAantalInwoners_1: 21600,  Mannen_2: 10400, Vrouwen_3: 11200, k_0Tot15Jaar_8: 2600, k_15Tot25Jaar_9: 2100, k_25Tot45Jaar_10: 5200, k_45Tot65Jaar_11: 6900, k_65JaarOfOuder_12: 4710, GemiddeldinkomenperpersoonEuro_66: 46500, GemiddeldeWOZwaardewoning_85: 488,  AantalWoningen_86: 9800, Bevolkingsdichtheid_33: 540 },
  { ID: 35, Perioden: "2023JJ00", RegioS: "GM0090", BevolkingAantalInwoners_1: 940,    Mannen_2: 450,  Vrouwen_3: 490,  k_0Tot15Jaar_8: 80,   k_15Tot25Jaar_9: 74,   k_25Tot45Jaar_10: 165,  k_45Tot65Jaar_11: 418,  k_65JaarOfOuder_12: 202,  GemiddeldinkomenperpersoonEuro_66: 41200, GemiddeldeWOZwaardewoning_85: 445,  AantalWoningen_86: 520,  Bevolkingsdichtheid_33: 64 },
  { ID: 36, Perioden: "2023JJ00", RegioS: "GM0296", BevolkingAantalInwoners_1: 42800,  Mannen_2: 20800, Vrouwen_3: 22000, k_0Tot15Jaar_8: 5200, k_15Tot25Jaar_9: 4400, k_25Tot45Jaar_10: 10600, k_45Tot65Jaar_11: 13400, k_65JaarOfOuder_12: 9083, GemiddeldinkomenperpersoonEuro_66: 42100, GemiddeldeWOZwaardewoning_85: 420,  AantalWoningen_86: 19200, Bevolkingsdichtheid_33: 878 },
];

// ── Connector implementation ──────────────────────────────────────────────────

export const cbsBronzeConnector: IBronzeConnector<CbsKerncijfersRecord> = {
  sourceId: "cbs",
  datasetId: "85039NED",
  apiEndpoint: `${CBS_ODATA_BASE}/85039NED/TypedDataSet`,

  async fetch(params: Record<string, string> = {}): Promise<BronzeEnvelope<CbsKerncijfersRecord>> {
    // TODO (API integration): Replace with:
    // const qs = new URLSearchParams({ $format: "json", ...params }).toString();
    // const res = await fetch(`${this.apiEndpoint}?${qs}`);
    // if (!res.ok) throw new Error(`CBS API error: ${res.status}`);
    // const json: CbsODataResponse<CbsKerncijfersRecord> = await res.json();
    // return {
    //   provenance: {
    //     sourceId: this.sourceId, datasetId: this.datasetId,
    //     apiEndpoint: this.apiEndpoint, queryParams: params,
    //     retrievedAt: new Date().toISOString(), responseStatus: res.status,
    //     sourceVersion: res.headers.get("CBS-Version") ?? undefined,
    //   },
    //   records: json.value,
    //   recordCount: json.value.length,
    // };

    return {
      provenance: {
        sourceId: this.sourceId,
        datasetId: this.datasetId,
        apiEndpoint: this.apiEndpoint,
        queryParams: { $format: "json", $select: "ID,Perioden,RegioS,BevolkingAantalInwoners_1,k_65JaarOfOuder_12,GemiddeldinkomenperpersoonEuro_66,GemiddeldeWOZwaardewoning_85,AantalWoningen_86", ...params },
        retrievedAt: "2024-03-01T00:00:00.000Z",
        responseStatus: 200,
        sourceVersion: "2024-Q1",
      },
      records: MOCK_RECORDS,
      recordCount: MOCK_RECORDS.length,
    };
  },
};
