import { X } from "lucide-react";
import type { Municipality, MunicipalityMetadata } from "@/features/maps/types";

interface ComparisonPanelProps {
  municipalities: Municipality[];
  metadataById: Record<string, MunicipalityMetadata>;
  formatNumber: (value: number) => string;
  formatCurrency: (value: number) => string;
  onRemove: (municipalityId: string) => void;
}

const compareRows = ["Population", "Income", "Housing", "Education", "Crime", "Healthcare"] as const;

export function ComparisonPanel({
  municipalities,
  metadataById,
  formatNumber,
  formatCurrency,
  onRemove,
}: ComparisonPanelProps) {
  if (municipalities.length === 0) return null;

  const valueFor = (row: (typeof compareRows)[number], municipality: Municipality) => {
    const metadata = metadataById[municipality.id];
    if (!metadata) return "Pending";

    if (row === "Population") return formatNumber(metadata.population);
    if (row === "Income") return formatCurrency(metadata.income);
    if (row === "Housing") return formatCurrency(metadata.housePrice);
    if (row === "Education") return `${Math.round(metadata.dataAvailable * 1.7)} indicators`;
    if (row === "Crime") return `${Math.max(8, Math.round(metadata.dataAvailable * 0.8))} indicators`;
    return `${Math.max(12, Math.round(metadata.dataAvailable * 1.1))} indicators`;
  };

  return (
    <section className="absolute bottom-6 right-6 z-20 w-[520px] rounded-lg border border-border bg-card/95 p-4 shadow-[0_18px_50px_rgba(17,24,39,0.14)] backdrop-blur-xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Compare municipalities</h2>
          <p className="text-xs text-muted-foreground">Population, income, housing, education, crime, healthcare</p>
        </div>
        <button type="button" className="rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background">
          Compare
        </button>
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        {municipalities.map((municipality) => (
          <span key={municipality.id} className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-medium text-foreground">
            {municipality.name}
            <button type="button" onClick={() => onRemove(municipality.id)} aria-label={`Remove ${municipality.name}`}>
              <X size={12} aria-hidden="true" />
            </button>
          </span>
        ))}
      </div>
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-left text-xs">
          <tbody>
            {compareRows.map((row) => (
              <tr key={row} className="border-b border-border last:border-b-0">
                <th className="w-28 bg-muted px-3 py-2 font-medium text-muted-foreground">{row}</th>
                {municipalities.map((municipality) => (
                  <td key={municipality.id} className="px-3 py-2 font-medium text-foreground">
                    {valueFor(row, municipality)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
