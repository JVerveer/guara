import type { Legend } from "@/features/maps/types";

interface MunicipalityLegendProps {
  legend: Legend;
}

export function MunicipalityLegend({ legend }: MunicipalityLegendProps) {
  return (
    <aside className="absolute bottom-6 left-6 z-20 w-60 rounded-lg border border-border bg-card/92 p-4 shadow-sm backdrop-blur-xl">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">{legend.title}</h2>
        <span className="rounded-md bg-muted px-2 py-1 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          {legend.mode}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="flex h-full">
          {legend.items.map((item) => (
            <span key={item.label} className="flex-1" style={{ backgroundColor: item.color }} />
          ))}
        </div>
      </div>
      <div className="mt-2 flex justify-between gap-2 text-[11px] text-muted-foreground">
        <span>{legend.items[0]?.label}</span>
        <span>{legend.items[legend.items.length - 1]?.label}</span>
      </div>
    </aside>
  );
}
