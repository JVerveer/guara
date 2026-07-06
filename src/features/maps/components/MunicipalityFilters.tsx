import { RotateCcw } from "lucide-react";
import { mapDatasets, mapIndicators, mapYears } from "@/features/maps/data/municipalityMapData";
import type { ActiveFilters } from "@/features/maps/types";

interface MunicipalityFiltersProps {
  filters: ActiveFilters;
  onFiltersChange: (filters: ActiveFilters) => void;
  onReset: () => void;
}

export function MunicipalityFilters({ filters, onFiltersChange, onReset }: MunicipalityFiltersProps) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <select
        aria-label="Dataset selector"
        value={filters.datasetId}
        onChange={(event) => onFiltersChange({ ...filters, datasetId: event.target.value })}
        className="h-9 rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/15"
      >
        {mapDatasets.map((dataset) => (
          <option key={dataset.id} value={dataset.id}>
            {dataset.label}
          </option>
        ))}
      </select>
      <select
        aria-label="Year selector"
        value={filters.year}
        onChange={(event) => onFiltersChange({ ...filters, year: Number(event.target.value) })}
        className="h-9 rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/15"
      >
        {mapYears.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>
      <select
        aria-label="Indicator selector"
        value={filters.indicator}
        onChange={(event) => onFiltersChange({ ...filters, indicator: event.target.value })}
        className="h-9 rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/15"
      >
        {mapIndicators.map((indicator) => (
          <option key={indicator.id} value={indicator.id}>
            {indicator.label}
          </option>
        ))}
      </select>
      <label className="flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm text-foreground">
        <input
          type="checkbox"
          checked={filters.compareMode}
          onChange={(event) => onFiltersChange({ ...filters, compareMode: event.target.checked })}
          className="h-4 w-4 accent-primary"
        />
        Compare
      </label>
      <button
        type="button"
        onClick={onReset}
        className="flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <RotateCcw size={14} aria-hidden="true" />
        <span>Reset</span>
      </button>
    </div>
  );
}
