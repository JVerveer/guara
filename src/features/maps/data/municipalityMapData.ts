import type { Legend } from "@/features/maps/types";

export const mapDatasets = [
  { id: "cbs-silver", label: "Supabase silver municipality preview", provider: "Supabase" },
] as const;

export const mapIndicators = [
  { id: "population", label: "Population", unit: "residents" },
  { id: "housing", label: "Average WOZ value", unit: "EUR" },
  { id: "density", label: "Population density", unit: "residents/km2" },
] as const;

export const mapYears = [2024] as const;

export const populationLegend: Legend = {
  title: "Silver indicator scale",
  mode: "quantiles",
  items: [
    { label: "Very low", color: "#EAF2EA" },
    { label: "Low", color: "#CFE2D3" },
    { label: "Medium", color: "#9FC8B0" },
    { label: "High", color: "#5C9E87" },
    { label: "Very high", color: "#1D6F63" },
  ],
};
