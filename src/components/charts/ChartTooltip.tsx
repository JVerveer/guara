interface TooltipPayloadEntry {
  color: string;
  name: string;
  value: number;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
  unit?: string;
}

export function ChartTooltip({ active, payload, label, unit = "k" }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2.5 text-sm shadow-lg">
      <p className="text-muted-foreground text-xs font-medium mb-1.5">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="font-medium" style={{ color: p.color }}>
          {p.name}:{" "}
          <span className="tabular-nums">
            €{p.value}
            {unit}
          </span>
        </p>
      ))}
    </div>
  );
}

export function AgingTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2.5 text-sm shadow-lg">
      <p className="font-medium text-foreground">{label}</p>
      <p className="text-muted-foreground text-xs mt-0.5">
        65+ population:{" "}
        <span className="font-semibold text-foreground tabular-nums">{payload[0]?.value}%</span>
      </p>
    </div>
  );
}
