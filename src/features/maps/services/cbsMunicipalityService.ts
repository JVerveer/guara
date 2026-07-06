import { cbsStatLineClient } from "@/data/bronze/clients/cbsStatLineClient";
import type { CbsRegionalCoreRecord } from "@/data/bronze/schema/cbs";
import type { DatasetValue, Municipality, MunicipalityMetadata } from "@/features/maps/types";

interface GeoJsonFeature {
  type: "Feature";
  properties: {
    statcode: string;
    statnaam: string;
    rubriek: string;
    id: number;
  };
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  };
}

interface GeoJsonFeatureCollection {
  type: "FeatureCollection";
  features: GeoJsonFeature[];
}

export interface CbsMunicipalityMapSnapshot {
  municipalities: Municipality[];
  metadataById: Record<string, MunicipalityMetadata>;
  datasetValues: DatasetValue[];
}

const CBS_MAP_YEAR = 2024;
const SELECT_FIELDS = [
  "ID",
  "Perioden",
  "RegioS",
  "TotaleBevolking_1",
  "k_65Tot80Jaar_11",
  "k_80JaarOfOuder_12",
  "k_65Tot80Jaar_20",
  "k_80JaarOfOuder_21",
  "GemiddeldeWOZWaardeVanWoningen_98",
  "Bevolkingsdichtheid_57",
] as const;

function isFeatureCollection(value: unknown): value is GeoJsonFeatureCollection {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as GeoJsonFeatureCollection).type === "FeatureCollection" &&
    Array.isArray((value as GeoJsonFeatureCollection).features)
  );
}

function centroidFromGeometry(geometry: GeoJsonFeature["geometry"]): [number, number] {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  let totalX = 0;
  let totalY = 0;
  let count = 0;

  polygons.forEach((polygon) => {
    polygon[0]?.forEach(([x, y]) => {
      totalX += x;
      totalY += y;
      count += 1;
    });
  });

  return count === 0 ? [0, 0] : [totalX / count, totalY / count];
}

function positionsFromGeometry(geometry: GeoJsonFeature["geometry"]): number[][] {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polygons.flatMap((polygon) => polygon.flatMap((ring) => ring));
}

function pathFromGeometry(
  geometry: GeoJsonFeature["geometry"],
  project: (position: number[]) => [number, number]
): string {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;

  return polygons
    .map((polygon) =>
      polygon
        .map((ring) =>
          ring
            .map((position, index) => {
              const [x, y] = project(position);
              return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
            })
            .join(" ")
        )
        .join(" Z ")
    )
    .join(" Z ");
}

function metadataFor(record: CbsRegionalCoreRecord | undefined, municipalityName: string): MunicipalityMetadata {
  const population65Plus = (record?.k_65Tot80Jaar_11 ?? 0) + (record?.k_80JaarOfOuder_12 ?? 0);
  const pct65Plus = (record?.k_65Tot80Jaar_20 ?? 0) + (record?.k_80JaarOfOuder_21 ?? 0);

  return {
    population: Math.round(record?.TotaleBevolking_1 ?? 0),
    medianAge: pct65Plus,
    income: 0,
    housePrice: Math.round((record?.GemiddeldeWOZWaardeVanWoningen_98 ?? 0) * 1000),
    dataAvailable: SELECT_FIELDS.length,
    relatedDatasets: ["CBS 70072NED Regionale kerncijfers Nederland", "PDOK CBS Gebiedsindelingen 2024"],
    evidence: [
      `Population 65+: ${Math.round(population65Plus).toLocaleString("en-US")}`,
      `Population density: ${Math.round(record?.Bevolkingsdichtheid_57 ?? 0).toLocaleString("en-US")} residents/km2`,
    ],
    recentResearch: [],
    suggestedQuestions: [
      `Show ${municipalityName} population`,
      `Compare ${municipalityName} with another municipality`,
      `Show ${municipalityName} housing value`,
    ],
  };
}

export async function getCbsMunicipalityMapSnapshot(): Promise<CbsMunicipalityMapSnapshot> {
  const [geoJson, regionalRecords] = await Promise.all([
    cbsStatLineClient.getMunicipalityGeoJson({
      year: CBS_MAP_YEAR,
      generalized: true,
    }),
    cbsStatLineClient.getRegionalPopulationByMunicipality({
      year: CBS_MAP_YEAR,
      select: SELECT_FIELDS.join(",").split(","),
    }),
  ]);

  if (!isFeatureCollection(geoJson)) {
    throw new Error("PDOK returned an unexpected municipality GeoJSON response.");
  }

  const allPositions = geoJson.features.flatMap((feature) => positionsFromGeometry(feature.geometry));
  const xs = allPositions.map(([x]) => x);
  const ys = allPositions.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const padding = 18;
  const width = 420 - padding * 2;
  const height = 640 - padding * 2;
  const scale = Math.min(width / (maxX - minX), height / (maxY - minY));
  const projectedWidth = (maxX - minX) * scale;
  const projectedHeight = (maxY - minY) * scale;
  const offsetX = (420 - projectedWidth) / 2;
  const offsetY = (640 - projectedHeight) / 2;
  const project = ([x, y]: number[]): [number, number] => [
    offsetX + (x - minX) * scale,
    offsetY + (maxY - y) * scale,
  ];

  const recordsByCode = new Map(regionalRecords.map((record) => [record.RegioS, record]));
  const municipalities: Municipality[] = geoJson.features
    .filter((feature) => feature.properties.rubriek === "gemeente")
    .map((feature) => ({
      id: feature.properties.statcode,
      cbsCode: feature.properties.statcode.replace(/^GM/, ""),
      name: feature.properties.statnaam,
      province: "CBS municipality",
      centroid: project(centroidFromGeometry(feature.geometry)),
      geometry: {
        type: "svg-path",
        path: pathFromGeometry(feature.geometry, project),
      },
      disabled: !recordsByCode.has(feature.properties.statcode),
    }));

  const metadataById = municipalities.reduce<Record<string, MunicipalityMetadata>>((acc, municipality) => {
    acc[municipality.id] = metadataFor(recordsByCode.get(municipality.id), municipality.name);
    return acc;
  }, {});

  const datasetValues: DatasetValue[] = regionalRecords.flatMap((record) => [
    {
      municipalityId: record.RegioS,
      datasetId: "cbs-70072ned",
      indicator: "population",
      year: CBS_MAP_YEAR,
      value: record.TotaleBevolking_1 ?? 0,
      unit: "residents",
      source: { provider: "CBS", lastUpdated: new Date().toISOString(), confidence: 1 },
    },
    {
      municipalityId: record.RegioS,
      datasetId: "cbs-70072ned",
      indicator: "housing",
      year: CBS_MAP_YEAR,
      value: (record.GemiddeldeWOZWaardeVanWoningen_98 ?? 0) * 1000,
      unit: "EUR",
      source: { provider: "CBS", lastUpdated: new Date().toISOString(), confidence: 1 },
    },
    {
      municipalityId: record.RegioS,
      datasetId: "cbs-70072ned",
      indicator: "density",
      year: CBS_MAP_YEAR,
      value: record.Bevolkingsdichtheid_57 ?? 0,
      unit: "residents/km2",
      source: { provider: "CBS", lastUpdated: new Date().toISOString(), confidence: 1 },
    },
  ]);

  return { municipalities, metadataById, datasetValues };
}
