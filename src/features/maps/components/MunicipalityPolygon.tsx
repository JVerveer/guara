import { cn } from "@/lib/utils";
import type { Municipality } from "@/features/maps/types";

interface MunicipalityPolygonProps {
  municipality: Municipality;
  color: string;
  isHovered: boolean;
  isSelected: boolean;
  isCompared: boolean;
  isDisabled: boolean;
  isLoading?: boolean;
  onHover: (municipality: Municipality | null, event?: React.PointerEvent<SVGPathElement>) => void;
  onSelect: (municipality: Municipality) => void;
}

export function MunicipalityPolygon({
  municipality,
  color,
  isHovered,
  isSelected,
  isCompared,
  isDisabled,
  isLoading = false,
  onHover,
  onSelect,
}: MunicipalityPolygonProps) {
  if (municipality.geometry.type !== "svg-path") return null;

  return (
    <path
      d={municipality.geometry.path}
      role="button"
      tabIndex={isDisabled ? -1 : 0}
      aria-label={municipality.name}
      aria-pressed={isSelected || isCompared}
      className={cn(
        "cursor-pointer transition-all duration-300 ease-out outline-none",
        "focus-visible:stroke-primary focus-visible:stroke-[3]",
        isDisabled && "cursor-not-allowed opacity-40",
        isLoading && "animate-pulse"
      )}
      fill={isDisabled ? "#EEF0F2" : color}
      stroke={isSelected ? "#111827" : isCompared ? "#155E75" : isHovered ? "#1C3D8F" : "#FFFFFF"}
      strokeWidth={isSelected ? 3.8 : isCompared ? 3 : isHovered ? 2.5 : 1.4}
      vectorEffect="non-scaling-stroke"
      opacity={isDisabled ? 0.45 : 1}
      onPointerMove={(event) => {
        if (!isDisabled) onHover(municipality, event);
      }}
      onPointerLeave={() => onHover(null)}
      onClick={() => {
        if (!isDisabled) onSelect(municipality);
      }}
      onKeyDown={(event) => {
        if ((event.key === "Enter" || event.key === " ") && !isDisabled) {
          event.preventDefault();
          onSelect(municipality);
        }
      }}
    />
  );
}
