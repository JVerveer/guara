import { Layers, Sparkles } from "lucide-react";
import { MunicipalityFilters } from "@/features/maps/components/MunicipalityFilters";
import { MunicipalitySearch } from "@/features/maps/components/MunicipalitySearch";
import type { ActiveFilters, Municipality } from "@/features/maps/types";

interface MapToolbarProps {
  municipalities: Municipality[];
  filters: ActiveFilters;
  onFiltersChange: (filters: ActiveFilters) => void;
  onReset: () => void;
  onSelectMunicipality: (municipality: Municipality) => void;
}

export function MapToolbar({
  municipalities,
  filters,
  onFiltersChange,
  onReset,
  onSelectMunicipality,
}: MapToolbarProps) {
  return (
    <header className="flex h-16 flex-shrink-0 items-center gap-3 border-b border-border bg-background/95 px-5 backdrop-blur">
      <div className="flex items-center gap-2 pr-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-foreground text-background">
          <Layers size={16} aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-sm font-semibold text-foreground">Municipality map</h1>
          <p className="text-[11px] text-muted-foreground">Municipality evidence layer</p>
        </div>
      </div>
      <MunicipalityFilters filters={filters} onFiltersChange={onFiltersChange} onReset={onReset} />
      <MunicipalitySearch
        municipalities={municipalities}
        query={filters.query}
        onQueryChange={(query) => onFiltersChange({ ...filters, query })}
        onSelect={onSelectMunicipality}
      />
      <button
        type="button"
        className="flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        <Sparkles size={14} aria-hidden="true" />
        <span>Ask AI</span>
      </button>
    </header>
  );
}
