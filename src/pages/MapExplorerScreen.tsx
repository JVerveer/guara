import { useEffect, useMemo, useState } from "react";
import { ComparisonPanel } from "@/features/maps/components/ComparisonPanel";
import { MapToolbar } from "@/features/maps/components/MapToolbar";
import { MunicipalityMap } from "@/features/maps/components/MunicipalityMap";
import { MunicipalitySidebar } from "@/features/maps/components/MunicipalitySidebar";
import { populationLegend } from "@/features/maps/data/municipalityMapData";
import { getCbsMunicipalityMapSnapshot } from "@/features/maps/services/cbsMunicipalityService";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import type { ActiveFilters, DatasetValue, Municipality, MunicipalityMetadata } from "@/features/maps/types";

const defaultFilters: ActiveFilters = {
  datasetId: "cbs-70072ned",
  year: 2024,
  indicator: "population",
  compareMode: false,
  query: "",
};

export function MapExplorerScreen() {
  const [filters, setFilters] = useState<ActiveFilters>(defaultFilters);
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [metadataById, setMetadataById] = useState<Record<string, MunicipalityMetadata>>({});
  const [datasetValues, setDatasetValues] = useState<DatasetValue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [selectedMunicipalityId, setSelectedMunicipalityId] = useState<string | null>(null);
  const [comparedMunicipalityIds, setComparedMunicipalityIds] = useState<string[]>([]);
  const [fetchKey, setFetchKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    getCbsMunicipalityMapSnapshot()
      .then((snapshot) => {
        if (cancelled) return;
        setMunicipalities(snapshot.municipalities);
        setMetadataById(snapshot.metadataById);
        setDatasetValues(snapshot.datasetValues);
        setSelectedMunicipalityId(snapshot.municipalities[0]?.id ?? null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fetchKey]);

  const selectedMunicipality = useMemo(
    () => municipalities.find((municipality) => municipality.id === selectedMunicipalityId) ?? null,
    [municipalities, selectedMunicipalityId]
  );

  const comparedMunicipalities = comparedMunicipalityIds
    .map((id) => municipalities.find((municipality) => municipality.id === id))
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

  if (isLoading) return <LoadingState message="Loading CBS and PDOK municipality data..." className="flex-1" />;
  if (error) {
    return (
      <ErrorState
        message={error.message}
        onRetry={() => setFetchKey((current) => current + 1)}
        retryLabel="Retry"
        className="flex-1"
      />
    );
  }

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden bg-background">
      <MapToolbar
        municipalities={municipalities}
        filters={filters}
        onFiltersChange={setFilters}
        onReset={handleReset}
        onSelectMunicipality={handleSelectMunicipality}
      />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="relative flex min-w-0 flex-1">
          <MunicipalityMap
            municipalities={municipalities}
            metadataById={metadataById}
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
              metadataById={metadataById}
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
          metadata={selectedMunicipality ? metadataById[selectedMunicipality.id] : undefined}
          formatNumber={formatNumber}
          formatCurrency={formatCurrency}
        />
      </div>
    </div>
  );
}
