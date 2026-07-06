import { Suspense } from "react";

// i18next is initialized synchronously on import via the side-effect below.
// The Suspense boundary is a react-i18next best practice for future async
// namespace loading (e.g. lazy-loaded locale chunks in a real backend).
import "@/i18n";

export function I18nProvider({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}
