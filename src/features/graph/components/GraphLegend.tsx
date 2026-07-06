import { useTranslation } from "react-i18next";
import { graphTokens } from "@/theme/tokens";
import { useTheme } from "@/app/providers/ThemeProvider";

export function GraphLegend() {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const g = isDark ? graphTokens.dark : graphTokens.light;

  const NODE_TYPES = [
    { fill: g.nodeActiveFill, stroke: g.nodeActiveStroke, key: "graph.nodeActive" },
    { fill: g.nodeFill, stroke: g.nodeStroke, key: "graph.nodeDefault" },
  ] as const;

  return (
    <div className="absolute bottom-5 left-5 bg-card border border-border rounded-xl p-4 shadow-sm space-y-2">
      <p className="text-[11px] font-semibold text-foreground">{t("graph.nodeTypes")}</p>
      <div className="space-y-1.5">
        {NODE_TYPES.map(({ fill, stroke, key }) => (
          <div key={key} className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span
              className="w-3.5 h-3.5 rounded-full border flex-shrink-0"
              style={{ background: fill, borderColor: stroke }}
            />
            {t(key)}
          </div>
        ))}
      </div>
    </div>
  );
}

export function GraphHint() {
  const { t } = useTranslation();
  return (
    <div className="absolute bottom-5 right-5 bg-card border border-border rounded-xl px-3.5 py-2.5 shadow-sm">
      <p className="text-[11px] text-muted-foreground">{t("graph.hoverHint")}</p>
    </div>
  );
}
