import { ArrowRight } from "lucide-react";
import type { Municipality, MunicipalityMetadata } from "@/features/maps/types";

interface MunicipalityTooltipProps {
  municipality: Municipality | null;
  metadata?: MunicipalityMetadata;
  position: { x: number; y: number } | null;
  formatNumber: (value: number) => string;
  formatCurrency: (value: number) => string;
  onExplore: (municipality: Municipality) => void;
}

export function MunicipalityTooltip({
  municipality,
  metadata,
  position,
  formatNumber,
  formatCurrency,
  onExplore,
}: MunicipalityTooltipProps) {
  if (!municipality || !metadata || !position) return null;

  return (
    <div
      className="pointer-events-auto absolute z-30 w-64 rounded-lg border border-border bg-card/95 p-4 shadow-[0_18px_50px_rgba(17,24,39,0.16)] backdrop-blur-xl transition-transform duration-150"
      style={{
        left: Math.min(position.x + 18, window.innerWidth - 320),
        top: Math.max(position.y - 28, 64),
      }}
    >
      <div className="mb-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{municipality.province}</p>
        <h2 className="text-base font-semibold text-foreground">{municipality.name}</h2>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <dt className="text-muted-foreground">Population</dt>
        <dd className="text-right font-medium text-foreground">{formatNumber(metadata.population)}</dd>
        <dt className="text-muted-foreground">Median age</dt>
        <dd className="text-right font-medium text-foreground">{metadata.medianAge.toFixed(1)}</dd>
        <dt className="text-muted-foreground">Income</dt>
        <dd className="text-right font-medium text-foreground">{formatCurrency(metadata.income)}</dd>
        <dt className="text-muted-foreground">House price</dt>
        <dd className="text-right font-medium text-foreground">{formatCurrency(metadata.housePrice)}</dd>
        <dt className="text-muted-foreground">Data available</dt>
        <dd className="text-right font-medium text-foreground">{metadata.dataAvailable} datasets</dd>
      </dl>
      <button
        type="button"
        onClick={() => onExplore(municipality)}
        className="mt-4 flex w-full items-center justify-between rounded-md bg-foreground px-3 py-2 text-xs font-medium text-background transition-colors hover:bg-foreground/90"
      >
        <span>Explore municipality</span>
        <ArrowRight size={13} aria-hidden="true" />
      </button>
    </div>
  );
}
