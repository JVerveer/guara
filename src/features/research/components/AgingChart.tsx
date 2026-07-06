import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/app/providers/ThemeProvider";
import { chartColors } from "@/theme/tokens";
import { LoadingState } from "@/components/ui/LoadingState";
import { researchService } from "../services/researchService";
import type { AgingDataPoint } from "../types";

function AgingTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  const { t } = useTranslation();
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2.5 text-sm shadow-lg">
      <p className="font-medium text-foreground">{label}</p>
      <p className="text-muted-foreground text-xs mt-0.5">
        {t("research.charts.agingTooltip")}:{" "}
        <span className="font-semibold text-foreground tabular-nums">{payload[0]?.value}%</span>
      </p>
    </div>
  );
}

export function AgingChart() {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const [data, setData] = useState<AgingDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    researchService
      .getAgingData()
      .then(setData)
      .finally(() => setIsLoading(false));
  }, []);

  const tickColor = isDark ? "#8B949E" : "#9CA3AF";
  const gridColor = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)";

  if (isLoading) return <LoadingState className="h-48" />;

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="mb-5">
        <h3 className="text-[13px] font-semibold text-foreground">
          {t("research.charts.aging.title")}
        </h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {t("research.charts.aging.subtitle")}
        </p>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: tickColor }} axisLine={false} tickLine={false} domain={[18, 26]} />
          <YAxis dataKey="municipality" type="category" width={88} tick={{ fontSize: 11, fill: tickColor }} axisLine={false} tickLine={false} />
          <Tooltip content={<AgingTooltip />} />
          <Bar dataKey="pct" fill={chartColors.barFill} radius={[0, 3, 3, 0]} barSize={12} opacity={0.85} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
