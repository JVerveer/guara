import { Search } from "lucide-react";
import type { Municipality } from "@/features/maps/types";

interface MunicipalitySearchProps {
  municipalities: Municipality[];
  query: string;
  onQueryChange: (query: string) => void;
  onSelect: (municipality: Municipality) => void;
}

export function MunicipalitySearch({ municipalities, query, onQueryChange, onSelect }: MunicipalitySearchProps) {
  const matches =
    query.trim().length > 1
      ? municipalities
          .filter((municipality) => municipality.name.toLowerCase().includes(query.trim().toLowerCase()))
          .slice(0, 5)
      : [];

  return (
    <div className="relative w-64">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <label htmlFor="municipality-search" className="sr-only">
        Search municipality
      </label>
      <input
        id="municipality-search"
        type="search"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Search municipality"
        className="h-9 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
      />
      {matches.length > 0 && (
        <div className="absolute left-0 right-0 top-11 z-40 overflow-hidden rounded-lg border border-border bg-card shadow-lg">
          {matches.map((municipality) => (
            <button
              key={municipality.id}
              type="button"
              onClick={() => onSelect(municipality)}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
            >
              <span className="font-medium text-foreground">{municipality.name}</span>
              <span className="text-xs text-muted-foreground">{municipality.province}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
