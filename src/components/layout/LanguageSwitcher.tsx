import { Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { SupportedLanguage } from "@/i18n";

const LANGUAGES: { code: SupportedLanguage; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "nl", label: "NL" },
];

/**
 * Language switcher — cycles between supported locales.
 * Persists the selection to localStorage via i18next-browser-languagedetector.
 */
export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const current = (i18n.language.split("-")[0] ?? "en") as SupportedLanguage;

  return (
    <div className="flex items-center gap-1 px-3 py-1.5" role="group" aria-label="Language">
      <Globe size={13} className="text-muted-foreground opacity-60 flex-shrink-0 mr-1" aria-hidden="true" />
      {LANGUAGES.map(({ code, label }) => (
        <button
          key={code}
          type="button"
          onClick={() => void i18n.changeLanguage(code)}
          aria-pressed={current === code}
          aria-label={`Switch to ${code === "en" ? "English" : "Dutch"}`}
          className={cn(
            "px-2 py-0.5 rounded text-[11px] font-semibold tracking-wide uppercase transition-colors",
            current === code
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
