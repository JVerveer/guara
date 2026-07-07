import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import en from "./locales/en.json";
import nl from "./locales/nl.json";

export const SUPPORTED_LANGUAGES = ["en", "nl"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    // Supported locales — add more here as Guara expands
    supportedLngs: SUPPORTED_LANGUAGES,
    fallbackLng: "en",

    // Detection order: localStorage first, then browser navigator
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "guara-language",
    },

    resources: {
      en: { translation: en },
      nl: { translation: nl },
    },

    interpolation: {
      // React already escapes values
      escapeValue: false,
    },

    // Return keys when translation is missing (easier to spot during development)
    missingKeyHandler: (lngs, ns, key) => {
      if (import.meta.env.DEV) {
        console.warn(`[i18n] Missing translation: ${key} (${lngs.join(", ")})`);
      }
    },
  });

export default i18n;
