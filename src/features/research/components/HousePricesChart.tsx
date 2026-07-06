import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/app/providers/ThemeProvider";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { chartColors } from "@/theme/tokens";
import { LoadingState } from "@/components/ui/LoadingState";
import { researchService } from "../services/researchService";
import type { HousePriceDataPoint } from "../types";

const LEGEND = [
  { name: "Amsterdam", color: chartColors.amsterdam },
  { name: "Utrecht", color: chartColors.utrecht },
  { name: "Rotterdam", color: chartColors.rotterdam },
] as const;

export function HousePricesChart() {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const [data, setData] = useState<HousePriceDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    researchService
      .getHousePriceData()
      .then(setData)
      .finally(() => setIsLoading(false));
  }, []);

  const tickColor = isDark ? "#8B949E" : "#9CA3AF";
  const gridColor = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)";

  if (isLoading) return <LoadingState className="h-48" />;

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-[13px] font-semibold text-foreground">
            {t("research.charts.housePrices.title")}
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {t("research.charts.housePrices.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {LEGEND.map(({ name, color }) => (
            <span key={name} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: color }} />
              {name}
            </span>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="gradAms" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={chartColors.amsterdam} stopOpacity={0.12} />
              <stop offset="95%" stopColor={chartColors.amsterdam} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradUtr" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={chartColors.utrecht} stopOpacity={0.1} />
              <stop offset="95%" stopColor={chartColors.utrecht} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradRot" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={chartColors.rotterdam} stopOpacity={0.1} />
              <stop offset="95%" stopColor={chartColors.rotterdam} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis dataKey="year" tick={{ fontSize: 11, fill: tickColor }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: tickColor }} axisLine={false} tickLine={false} />
          <Tooltip content={<ChartTooltip />} />
          <Area type="monotone" dataKey="Amsterdam" stroke={chartColors.amsterdam} strokeWidth={1.5} fill="url(#gradAms)" dot={false} />
          <Area type="monotone" dataKey="Utrecht" stroke={chartColors.utrecht} strokeWidth={1.5} fill="url(#gradUtr)" dot={false} />
          <Area type="monotone" dataKey="Rotterdam" stroke={chartColors.rotterdam} strokeWidth={1.5} fill="url(#gradRot)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
