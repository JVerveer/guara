import { useTranslation } from "react-i18next";
import {
  formatNumber,
  formatPercent,
  formatCurrency,
  formatDate,
  formatCompact,
} from "@/lib/formatters";
import type { SupportedLanguage } from "@/i18n";

const LOCALE_MAP: Record<SupportedLanguage, string> = {
  en: "en-GB",
  nl: "nl-NL",
};

function resolveLocale(lang: string): string {
  const base = lang.split("-")[0] as SupportedLanguage;
  return LOCALE_MAP[base] ?? LOCALE_MAP.en;
}

/**
 * Binds the active i18next language to the pure formatters in lib/formatters.ts.
 * Use this hook in React components; use the raw formatters directly in services/tests.
 */
export function useLocale() {
  const { i18n } = useTranslation();
  const locale = resolveLocale(i18n.language);

  return {
    locale,
    formatNumber: (value: number, options?: Intl.NumberFormatOptions) =>
      formatNumber(value, locale, options),
    formatPercent: (value: number) => formatPercent(value, locale),
    formatCurrency: (value: number, currency?: string) =>
      formatCurrency(value, locale, currency),
    formatDate: (
      date: Date | string | number,
      options?: Intl.DateTimeFormatOptions
    ) => formatDate(date, locale, options),
    formatCompact: (value: number) => formatCompact(value, locale),
  };
}
