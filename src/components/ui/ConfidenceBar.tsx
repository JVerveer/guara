import { confidenceColor } from "@/theme/tokens";

interface ConfidenceBarProps {
  value: number;
}

export function ConfidenceBar({ value }: ConfidenceBarProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${value}%`, backgroundColor: confidenceColor(value) }}
        />
      </div>
      <span className="text-xs font-medium text-foreground tabular-nums">{value}%</span>
    </div>
  );
}
