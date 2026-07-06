import { Minus, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { MunicipalityLegend } from "@/features/maps/components/MunicipalityLegend";
import { MunicipalityPolygon } from "@/features/maps/components/MunicipalityPolygon";
import { MunicipalityTooltip } from "@/features/maps/components/MunicipalityTooltip";
import type { ActiveFilters, DatasetValue, Legend, Municipality, MunicipalityMetadata } from "@/features/maps/types";

interface MunicipalityMapProps {
  municipalities: Municipality[];
  metadataById: Record<string, MunicipalityMetadata>;
  datasetValues: DatasetValue[];
  selectedMunicipalityId: string | null;
  comparedMunicipalityIds: string[];
  colorScale: (value: number | undefined, municipality: Municipality) => string;
  legend: Legend;
  activeFilters: ActiveFilters;
  loadingMunicipalityIds?: string[];
  onSelectMunicipality: (municipality: Municipality) => void;
}

export function MunicipalityMap({
  municipalities,
  metadataById,
  datasetValues,
  selectedMunicipalityId,
  comparedMunicipalityIds,
  colorScale,
  legend,
  activeFilters,
  loadingMunicipalityIds = [],
  onSelectMunicipality,
}: MunicipalityMapProps) {
  const [hoveredMunicipality, setHoveredMunicipality] = useState<Municipality | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const [zoom, setZoom] = useState(1);

  const valueByMunicipality = useMemo(() => {
    return datasetValues.reduce<Record<string, DatasetValue>>((acc, value) => {
      if (
        value.datasetId === activeFilters.datasetId &&
        value.indicator === activeFilters.indicator &&
        value.year === activeFilters.year
      ) {
        acc[value.municipalityId] = value;
      }
      return acc;
    }, {});
  }, [activeFilters.datasetId, activeFilters.indicator, activeFilters.year, datasetValues]);

  const formatNumber = (value: number) => new Intl.NumberFormat("en-US").format(value);
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("nl-NL", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(value);

  return (
    <div className="relative h-full flex-1 overflow-hidden bg-[#F7F7F4]">
      <div className="absolute left-6 top-6 z-20 flex items-center overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => setZoom((current) => Math.min(current + 0.12, 1.5))}
          className="flex h-9 w-9 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Plus size={15} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => setZoom((current) => Math.max(current - 0.12, 0.82))}
          className="flex h-9 w-9 items-center justify-center border-l border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Minus size={15} aria-hidden="true" />
        </button>
      </div>

      <svg
        viewBox="0 0 420 640"
        aria-label="Interactive municipality map of the Netherlands"
        className="h-full w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <filter id="map-selection-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#111827" floodOpacity="0.12" />
          </filter>
        </defs>
        <g
          style={{
            transform: `translate(210px, 320px) scale(${zoom}) translate(-210px, -320px)`,
            transformOrigin: "center",
            transition: "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          <path
            d="M138 24 L300 8 L374 70 L366 150 L394 216 L374 316 L344 394 L358 512 L326 626 L254 618 L218 506 L128 500 L54 452 L38 330 L72 222 L94 118 Z"
            fill="#ECEEEA"
            stroke="#D8DDD6"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
          {municipalities.map((municipality) => {
            const value = valueByMunicipality[municipality.id]?.value;
            const isSelected = selectedMunicipalityId === municipality.id;
            const isCompared = comparedMunicipalityIds.includes(municipality.id);

            return (
              <g key={municipality.id} filter={isSelected ? "url(#map-selection-shadow)" : undefined}>
                <MunicipalityPolygon
                  municipality={municipality}
                  color={colorScale(value, municipality)}
                  isHovered={hoveredMunicipality?.id === municipality.id}
                  isSelected={isSelected}
                  isCompared={isCompared}
                  isDisabled={Boolean(municipality.disabled)}
                  isLoading={loadingMunicipalityIds.includes(municipality.id)}
                  onHover={(nextMunicipality, event) => {
                    setHoveredMunicipality(nextMunicipality);
                    if (event) setTooltipPosition({ x: event.clientX, y: event.clientY });
                  }}
                  onSelect={(nextMunicipality) => {
                    setHoveredMunicipality(null);
                    onSelectMunicipality(nextMunicipality);
                  }}
                />
              </g>
            );
          })}
        </g>
      </svg>

      <MunicipalityLegend legend={legend} />
      <MunicipalityTooltip
        municipality={hoveredMunicipality}
        metadata={hoveredMunicipality ? metadataById[hoveredMunicipality.id] : undefined}
        position={tooltipPosition}
        formatNumber={formatNumber}
        formatCurrency={formatCurrency}
        onExplore={onSelectMunicipality}
      />
    </div>
  );
}
