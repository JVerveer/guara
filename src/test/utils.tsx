/**
 * Test utilities — wrappers and helpers shared across test files.
 *
 * Usage:
 *   import { render, screen } from '@/test/utils';
 *   render(<MyComponent />);  // automatically wrapped with providers
 */

import { type ReactElement } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Re-export everything from @testing-library/react so tests import from one place
export * from "@testing-library/react";
export { userEvent };

/**
 * Render a component wrapped in the minimal set of providers
 * needed for Atlas components (theme, i18n).
 *
 * i18next is mocked in setup.ts — no real provider is needed.
 * ThemeProvider is omitted because the CSS variables it toggles
 * are not relevant to unit tests.
 */
function AllProviders({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function customRender(ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) {
  return render(ui, { wrapper: AllProviders, ...options });
}

export { customRender as render };

/** Create a typed no-op function for setScreen / navigation props. */
export function mockSetScreen() {
  return vi.fn() as (s: string) => void;
}
