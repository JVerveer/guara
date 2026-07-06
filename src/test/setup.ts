/**
 * Global Vitest setup — runs before every test file.
 *
 * - Extends expect() with @testing-library/jest-dom matchers
 *   (toBeInTheDocument, toHaveClass, etc.)
 * - Configures the i18n singleton to return keys as-is so tests
 *   are not coupled to translation copy.
 */

import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock i18next globally so every test gets predictable key→key translation.
// Individual test files can override this with vi.mock() if needed.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      // For array returns (returnObjects), provide an empty array fallback
      if (opts?.returnObjects === true) return [];
      return key;
    },
    i18n: {
      language: "en",
      changeLanguage: vi.fn().mockResolvedValue(undefined),
    },
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
  I18nextProvider: ({ children }: { children: React.ReactNode }) => children,
  initReactI18next: { type: "3rdParty", init: vi.fn() },
}));

// Silence console.warn during tests (i18n missing-key warnings etc.)
// Remove this if you need to debug test output.
vi.spyOn(console, "warn").mockImplementation(() => undefined);
