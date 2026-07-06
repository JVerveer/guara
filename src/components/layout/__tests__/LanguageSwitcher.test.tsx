/**
 * Tests for the LanguageSwitcher component.
 *
 * Verifies that:
 * - Both language buttons are rendered
 * - The active language is visually highlighted
 * - Clicking a language calls i18n.changeLanguage
 * - Buttons have accessible aria-label attributes
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, userEvent } from "@/test/utils";
import { LanguageSwitcher } from "../LanguageSwitcher";

const mockChangeLanguage = vi.fn();

// Override the global i18n mock for this test file to control language state
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      language: "en",
      changeLanguage: mockChangeLanguage,
    },
  }),
}));

describe("LanguageSwitcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders an EN button", () => {
    render(<LanguageSwitcher />);
    expect(screen.getByRole("button", { name: /switch to english/i })).toBeInTheDocument();
  });

  it("renders an NL button", () => {
    render(<LanguageSwitcher />);
    expect(screen.getByRole("button", { name: /switch to dutch/i })).toBeInTheDocument();
  });

  it("highlights the active language with aria-pressed", () => {
    render(<LanguageSwitcher />);
    const enButton = screen.getByRole("button", { name: /switch to english/i });
    expect(enButton).toHaveAttribute("aria-pressed", "true");
  });

  it("marks the inactive language as not pressed", () => {
    render(<LanguageSwitcher />);
    const nlButton = screen.getByRole("button", { name: /switch to dutch/i });
    expect(nlButton).toHaveAttribute("aria-pressed", "false");
  });

  it("calls changeLanguage with 'nl' when NL is clicked", async () => {
    const user = userEvent.setup();
    render(<LanguageSwitcher />);
    await user.click(screen.getByRole("button", { name: /switch to dutch/i }));
    expect(mockChangeLanguage).toHaveBeenCalledWith("nl");
    expect(mockChangeLanguage).toHaveBeenCalledTimes(1);
  });

  it("calls changeLanguage with 'en' when EN is clicked", async () => {
    const user = userEvent.setup();
    render(<LanguageSwitcher />);
    await user.click(screen.getByRole("button", { name: /switch to english/i }));
    expect(mockChangeLanguage).toHaveBeenCalledWith("en");
  });
});
