import type {
  CbsCatalogTable,
  CbsDataProperty,
  CbsODataResponse,
  CbsRegionalCoreRecord,
  CbsWijkBuurtRecord,
} from "@/data/bronze/schema/cbs";

const CBS_ODATA_BASE = "https://opendata.cbs.nl/ODataApi/odata";
const CBS_CATALOG_BASE = "https://opendata.cbs.nl/ODataCatalog";
const PDOK_WFS_BASE = "https://service.pdok.nl/cbs/gebiedsindelingen";

type ODataPrimitive = string | number | boolean;

export interface ODataQuery {
  $select?: string | string[];
  $filter?: string;
  $top?: number;
  $skip?: number;
  $orderby?: string;
  $format?: "json";
}

export interface CbsClientOptions {
  odataBaseUrl?: string;
  catalogBaseUrl?: string;
  pdokWfsBaseUrl?: string;
  fetcher?: typeof fetch;
}

export interface MunicipalityFactOptions {
  municipalityCodes?: string[];
  select?: string[];
  top?: number;
}

export interface RegionalPopulationOptions {
  year: number;
  municipalityOnly?: boolean;
  select?: string[];
  top?: number;
}

export interface MunicipalityGeoJsonOptions {
  year: number;
  generalized?: boolean;
  srsName?: string;
}

function normalizeTableId(tableId: string): string {
  return tableId.trim();
}

function asODataValue(value: ODataPrimitive): string {
  if (typeof value === "string") return `'${value.replace(/'/g, "''")}'`;
  return String(value);
}

function buildQuery(query: ODataQuery = {}): string {
  const params = new URLSearchParams();
  params.set("$format", query.$format ?? "json");

  Object.entries(query).forEach(([key, rawValue]) => {
    if (rawValue === undefined || key === "$format") return;
    const value = Array.isArray(rawValue) ? rawValue.join(",") : String(rawValue);
    params.set(key, value);
  });

  return params.toString();
}

function municipalityCodeForWijkBuurt(code: string): string {
  const trimmed = code.trim();
  return trimmed.startsWith("GM") ? trimmed.padEnd(10, " ") : `GM${trimmed}`.padEnd(10, " ");
}

function municipalityCodeForRegion(code: string): string {
  const trimmed = code.trim();
  return trimmed.startsWith("GM") ? trimmed : `GM${trimmed}`;
}

async function parseODataResponse<TRecord>(response: Response, endpoint: string): Promise<CbsODataResponse<TRecord>> {
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`CBS StatLine API error ${response.status} for ${endpoint}${body ? `: ${body}` : ""}`);
  }

  return response.json() as Promise<CbsODataResponse<TRecord>>;
}

export class CbsStatLineClient {
  private readonly odataBaseUrl: string;
  private readonly catalogBaseUrl: string;
  private readonly pdokWfsBaseUrl: string;
  private readonly fetcher: typeof fetch;

  constructor(options: CbsClientOptions = {}) {
    this.odataBaseUrl = options.odataBaseUrl ?? CBS_ODATA_BASE;
    this.catalogBaseUrl = options.catalogBaseUrl ?? CBS_CATALOG_BASE;
    this.pdokWfsBaseUrl = options.pdokWfsBaseUrl ?? PDOK_WFS_BASE;
    this.fetcher = options.fetcher ?? ((input, init) => fetch(input, init));
  }

  getTypedDataSetUrl(tableId: string, query: ODataQuery = {}): string {
    return `${this.odataBaseUrl}/${normalizeTableId(tableId)}/TypedDataSet?${buildQuery(query)}`;
  }

  getUntypedDataSetUrl(tableId: string, query: ODataQuery = {}): string {
    return `${this.odataBaseUrl}/${normalizeTableId(tableId)}/UntypedDataSet?${buildQuery(query)}`;
  }

  getDataPropertiesUrl(tableId: string, query: ODataQuery = {}): string {
    return `${this.odataBaseUrl}/${normalizeTableId(tableId)}/DataProperties?${buildQuery(query)}`;
  }

  getTablesUrl(query: ODataQuery = {}): string {
    return `${this.catalogBaseUrl}/Tables?${buildQuery(query)}`;
  }

  async getTables(query: ODataQuery = {}): Promise<CbsCatalogTable[]> {
    const endpoint = this.getTablesUrl(query);
    const response = await this.fetcher(endpoint);
    const json = await parseODataResponse<CbsCatalogTable>(response, endpoint);
    return json.value;
  }

  async getDataProperties(tableId: string, query: ODataQuery = {}): Promise<CbsDataProperty[]> {
    const endpoint = this.getDataPropertiesUrl(tableId, query);
    const response = await this.fetcher(endpoint);
    const json = await parseODataResponse<CbsDataProperty>(response, endpoint);
    return json.value;
  }

  async getTypedDataSet<TRecord>(tableId: string, query: ODataQuery = {}): Promise<CbsODataResponse<TRecord>> {
    const endpoint = this.getTypedDataSetUrl(tableId, query);
    const response = await this.fetcher(endpoint);
    return parseODataResponse<TRecord>(response, endpoint);
  }

  async getUntypedDataSet<TRecord>(tableId: string, query: ODataQuery = {}): Promise<CbsODataResponse<TRecord>> {
    const endpoint = this.getUntypedDataSetUrl(tableId, query);
    const response = await this.fetcher(endpoint);
    return parseODataResponse<TRecord>(response, endpoint);
  }

  async getWijkBuurtMunicipalityFacts(options: MunicipalityFactOptions = {}): Promise<CbsWijkBuurtRecord[]> {
    const select = options.select ?? [
      "ID",
      "WijkenEnBuurten",
      "Gemeentenaam_1",
      "AantalInwoners_5",
      "k_65JaarOfOuder_12",
      "GemiddeldeWOZWaardeVanWoningen_35",
      "GemiddeldInkomenPerInwoner_72",
    ];
    const municipalityCodes = options.municipalityCodes?.map(municipalityCodeForWijkBuurt);
    const filters = municipalityCodes?.map((code) => `WijkenEnBuurten eq ${asODataValue(code)}`);
    const query: ODataQuery = {
      $select: select,
      $top: options.top,
      $filter: filters?.length ? filters.join(" or ") : "substringof('GM',WijkenEnBuurten)",
    };

    const json = await this.getTypedDataSet<CbsWijkBuurtRecord>("85039NED", query);
    return json.value;
  }

  async getRegionalPopulationByMunicipality(options: RegionalPopulationOptions): Promise<CbsRegionalCoreRecord[]> {
    const select = options.select ?? ["ID", "Perioden", "RegioS", "TotaleBevolking_1"];
    const period = `${options.year}JJ00`;
    const regionFilter = options.municipalityOnly ?? true ? " and substringof('GM',RegioS)" : "";
    const json = await this.getTypedDataSet<CbsRegionalCoreRecord>("70072NED", {
      $select: select,
      $top: options.top,
      $filter: `Perioden eq ${asODataValue(period)}${regionFilter}`,
    });

    return json.value.map((record) => ({
      ...record,
      RegioS: municipalityCodeForRegion(record.RegioS),
    }));
  }

  getMunicipalityGeoJsonUrl(options: MunicipalityGeoJsonOptions): string {
    const params = new URLSearchParams({
      service: "WFS",
      version: "2.0.0",
      request: "GetFeature",
      typeNames: options.generalized ?? true
        ? "gebiedsindelingen:gemeente_gegeneraliseerd"
        : "gebiedsindelingen:gemeente_niet_gegeneraliseerd",
      outputFormat: "application/json",
      srsName: options.srsName ?? "EPSG:4326",
    });

    return `${this.pdokWfsBaseUrl}/${options.year}/wfs/v1_0?${params.toString()}`;
  }

  async getMunicipalityGeoJson(options: MunicipalityGeoJsonOptions): Promise<unknown> {
    const endpoint = this.getMunicipalityGeoJsonUrl(options);
    const response = await this.fetcher(endpoint);

    if (!response.ok) {
      throw new Error(`PDOK municipality GeoJSON error ${response.status} for ${endpoint}`);
    }

    return response.json() as Promise<unknown>;
  }
}

export const cbsStatLineClient = new CbsStatLineClient();
