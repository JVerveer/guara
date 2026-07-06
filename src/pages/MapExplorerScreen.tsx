import { useMemo, useState } from "react";
import { ComparisonPanel } from "@/features/maps/components/ComparisonPanel";
import { MapToolbar } from "@/features/maps/components/MapToolbar";
import { MunicipalityMap } from "@/features/maps/components/MunicipalityMap";
import { MunicipalitySidebar } from "@/features/maps/components/MunicipalitySidebar";
import {
  datasetValues,
  demoMunicipalities,
  municipalityMetadata,
  populationLegend,
} from "@/features/maps/data/municipalityMapData";
import type { ActiveFilters, Municipality } from "@/features/maps/types";

const defaultFilters: ActiveFilters = {
  datasetId: "cbs-population",
  year: 2024,
  indicator: "population",
  compareMode: false,
  query: "",
};

export function MapExplorerScreen() {
  const [filters, setFilters] = useState<ActiveFilters>(defaultFilters);
  const [selectedMunicipalityId, setSelectedMunicipalityId] = useState<string | null>("gm0599");
  const [comparedMunicipalityIds, setComparedMunicipalityIds] = useState<string[]>([]);

  const selectedMunicipality = useMemo(
    () => demoMunicipalities.find((municipality) => municipality.id === selectedMunicipalityId) ?? null,
    [selectedMunicipalityId]
  );

  const comparedMunicipalities = comparedMunicipalityIds
    .map((id) => demoMunicipalities.find((municipality) => municipality.id === id))
    .filter((municipality): municipality is Municipality => Boolean(municipality));

  const activeDatasetValues = datasetValues.filter(
    (value) =>
      value.datasetId === filters.datasetId && value.indicator === filters.indicator && value.year === filters.year
  );
  const values = activeDatasetValues.map((value) => value.value);
  const min = Math.min(...values);
  const max = Math.max(...values);

  const colorScale = (value: number | undefined, municipality: Municipality) => {
    if (municipality.disabled) return "#EEF0F2";
    if (value === undefined || max === min) return "#DCE7DD";

    const colors = ["#EAF2EA", "#CFE2D3", "#9FC8B0", "#5C9E87", "#1D6F63"];
    const step = Math.min(colors.length - 1, Math.floor(((value - min) / (max - min)) * colors.length));
    return colors[step] ?? "#DCE7DD";
  };

  const formatNumber = (value: number) => new Intl.NumberFormat("en-US").format(value);
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("nl-NL", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(value);

  const handleSelectMunicipality = (municipality: Municipality) => {
    setSelectedMunicipalityId(municipality.id);

    if (filters.compareMode) {
      setComparedMunicipalityIds((current) =>
        current.includes(municipality.id)
          ? current.filter((id) => id !== municipality.id)
          : [...current, municipality.id].slice(-4)
      );
    }
  };

  const handleReset = () => {
    setFilters(defaultFilters);
    setSelectedMunicipalityId(null);
    setComparedMunicipalityIds([]);
  };

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden bg-background">
      <MapToolbar
        municipalities={demoMunicipalities}
        filters={filters}
        onFiltersChange={setFilters}
        onReset={handleReset}
        onSelectMunicipality={handleSelectMunicipality}
      />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="relative flex min-w-0 flex-1">
          <MunicipalityMap
            municipalities={demoMunicipalities}
            metadataById={municipalityMetadata}
            datasetValues={datasetValues}
            selectedMunicipalityId={selectedMunicipalityId}
            comparedMunicipalityIds={comparedMunicipalityIds}
            colorScale={colorScale}
            legend={populationLegend}
            activeFilters={filters}
            loadingMunicipalityIds={["gm0392"]}
            onSelectMunicipality={handleSelectMunicipality}
          />
          {filters.compareMode && (
            <ComparisonPanel
              municipalities={comparedMunicipalities}
              metadataById={municipalityMetadata}
              formatNumber={formatNumber}
              formatCurrency={formatCurrency}
              onRemove={(municipalityId) =>
                setComparedMunicipalityIds((current) => current.filter((id) => id !== municipalityId))
              }
            />
          )}
        </div>
        <MunicipalitySidebar
          municipality={selectedMunicipality}
          metadata={selectedMunicipality ? municipalityMetadata[selectedMunicipality.id] : undefined}
          formatNumber={formatNumber}
          formatCurrency={formatCurrency}
        />
      </div>
    </div>
  );
}
