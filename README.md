# Atlas

**AI-powered research platform for exploring official Dutch public data.**

Atlas is a desktop-first SaaS frontend built for journalists, researchers, policy advisors and analysts. It lets users ask natural language questions about Dutch government data and receive structured, evidence-backed answers enriched with interactive charts and a semantic knowledge graph.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | React 18 + TypeScript (strict) |
| Build | Vite 6 |
| Styling | Tailwind CSS 4 + CSS custom properties |
| i18n | i18next + react-i18next + browser language detector |
| Charts | Recharts |
| Icons | Lucide React |
| Testing | Vitest + React Testing Library |
| Lint | ESLint (typescript-eslint + jsx-a11y + react-hooks) |
| Format | Prettier |

---

## Installation

```bash
# 1. Clone
git clone https://github.com/your-org/atlas.git
cd atlas

# 2. Install dependencies (uses pnpm)
pnpm install

# 3. Set up environment
cp .env.example .env.local
# Edit .env.local — see Environment variables section below

# 4. Start the dev server
pnpm dev
```

---

## Available scripts

| Script | Description |
|---|---|
| `pnpm dev` | Start Vite dev server |
| `pnpm build` | Type-check and build for production |
| `pnpm preview` | Preview the production build locally |
| `pnpm typecheck` | Run `tsc --noEmit` without building |
| `pnpm lint` | Run ESLint across `src/` |
| `pnpm lint:fix` | Run ESLint and auto-fix fixable issues |
| `pnpm format` | Format all files in `src/` with Prettier |
| `pnpm format:check` | Check formatting without writing |
| `pnpm test` | Run the test suite once |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm test:ui` | Open the Vitest browser UI |

---

## Environment variables

All env variables are read through `src/config/env.ts`. Never use `import.meta.env` directly in components.

| Variable | Default | Description |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:8000/api/v1` | Atlas backend base URL |
| `VITE_APP_NAME` | `Atlas` | Application display name |
| `VITE_APP_VERSION` | `0.1.0` | Semantic version |
| `VITE_DEFAULT_LOCALE` | `en` | Fallback locale (`en` or `nl`) |
| `VITE_USE_REAL_API` | `false` | Enable real API calls instead of mock data |

Copy `.env.example` to `.env.local` and fill in the values for local development.

---

## Folder structure

```
src/
├── app/                         # App shell — providers, routing
│   ├── App.tsx                  # Root component: wraps providers + Shell
│   ├── routes.tsx               # renderRoute() — screen-to-component mapping
│   └── providers/
│       ├── ThemeProvider.tsx    # Theme context (light/dark) + useTheme hook
│       └── I18nProvider.tsx     # i18n initialisation + Suspense boundary
│
├── config/
│   └── env.ts                   # Typed, validated environment config
│
├── features/                    # Business domains — each fully self-contained
│   ├── research/
│   │   ├── types.ts             # ResearchQuery, EvidenceSource, chart types
│   │   ├── data/                # Static/mock data (temporary)
│   │   ├── services/            # researchService — async API contract
│   │   ├── hooks/               # useResearchQuery — loading/error/data states
│   │   └── components/          # QuestionHeader, AnswerBlock, EvidenceCard…
│   ├── datasets/
│   │   ├── types.ts             # Dataset, DatasetVariable…
│   │   ├── data/                # Static/mock data
│   │   ├── services/            # datasetService — async API contract
│   │   ├── hooks/               # useDatasets — search + filter + async state
│   │   └── components/          # DatasetCard, DatasetDetail
│   ├── sources/
│   │   ├── types.ts             # Connector
│   │   ├── data/                # Static/mock connector registry
│   │   ├── services/            # connectorService — async API contract
│   │   ├── hooks/               # useConnectors
│   │   └── components/          # ConnectorCard
│   └── graph/
│       ├── types.ts             # SemanticConcept, ResearchGraph, ConceptEdge
│       ├── data/                # Static/mock graph data
│       ├── services/            # graphService — async API contract
│       ├── hooks/               # useResearchGraph
│       └── components/          # KnowledgeGraph, MiniGraph, GraphToolbar…
│
├── components/                  # Shared, domain-agnostic components
│   ├── ui/
│   │   ├── LoadingState.tsx     # Spinner with aria-live
│   │   ├── EmptyState.tsx       # Empty list/result placeholder
│   │   ├── ErrorState.tsx       # Error with optional retry action
│   │   ├── ConfidenceBar.tsx
│   │   ├── ProviderBadge.tsx
│   │   └── Tag.tsx
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── TopNav.tsx
│   │   └── LanguageSwitcher.tsx
│   └── charts/
│       └── ChartTooltip.tsx
│
├── pages/                       # Thin route-level shells — compose features
│   ├── HomeScreen.tsx
│   ├── ResultScreen.tsx
│   ├── DatasetExplorerScreen.tsx
│   ├── SourceBrowserScreen.tsx
│   ├── GraphScreen.tsx
│   └── DatasetDetailScreen.tsx
│
├── i18n/
│   ├── index.ts                 # i18next configuration + SUPPORTED_LANGUAGES
│   ├── hooks/useLocale.ts       # Locale-aware Intl formatters (React hook)
│   └── locales/
│       ├── en.json              # English translations (source of truth)
│       └── nl.json              # Dutch translations
│
├── lib/
│   ├── utils.ts                 # cn() and other generic utilities
│   └── formatters.ts            # Pure Intl formatters (no React dependency)
│
├── theme/
│   └── tokens.ts                # Design tokens: colors, fonts, graph palette
│
├── types/
│   └── index.ts                 # Cross-cutting types (Screen)
│
└── test/
    ├── setup.ts                 # Vitest global setup (jest-dom + i18n mock)
    └── utils.tsx                # Shared render helpers and re-exports
```

---

## Architecture principles

1. **Feature-first, not layer-first.** Each domain (research, datasets, sources, graph) owns its types, data, services, hooks and components. Changes to a feature are localised.

2. **Pages are thin shells.** Pages import from features and compose them. No business logic lives in a page file.

3. **Services own the API contract.** Every `*Service` file contains only async methods with descriptive `TODO` comments showing where real API calls go. Swapping mock data for a real backend requires editing only the service, not the components or hooks.

4. **Hooks own async state.** Hooks expose `{ data, isLoading, error, retry }`. Pages and components render `<LoadingState />`, `<ErrorState />`, or `<EmptyState />` declaratively based on those values.

5. **No global state yet.** Local component state stays local. Hooks provide scoped async state. No Redux, Zustand, or similar — add it only when cross-feature state sharing is actually needed.

6. **Design tokens are single-source-of-truth.** All colours that can't use Tailwind tokens (SVG fills, provider brand colours, chart colours) live in `src/theme/tokens.ts`. No colour literals in components.

7. **i18n at the boundary.** No user-facing string literals inside component files. All copy lives in `src/i18n/locales/`. Number, date, and percentage formatting goes through `useLocale()`.

---

## How to add a new data connector

A connector is an external data provider (CBS, Eurostat, KNMI, etc.).

1. **Add the connector record** to `src/features/sources/data/sources.ts`:
   ```ts
   {
     id: "my-source",
     name: "My Source",
     fullName: "Full Official Name",
     abbr: "MS",
     datasets: 0,         // update when known
     lastSync: "—",
     coverage: "Country",
     reliability: 90,
     tags: ["Economy"],
     brandColor: "#003399",
   }
   ```

2. **Add translations** for any new tag keys in `en.json` and `nl.json`:
   ```json
   "datasets": {
     "tags": {
       "MyNewTag": "My New Tag"
     }
   }
   ```

3. **Add a dataset file** in `src/features/datasets/data/datasets.ts` with the connector's datasets.

4. **Wire the API** when the backend is ready — replace `Promise.resolve(...)` in `connectorService.ts` and `datasetService.ts` with real `fetch` / `axios` calls.

---

## How to add translations

1. **Add the key** to `src/i18n/locales/en.json` (English is the source of truth):
   ```json
   {
     "myFeature": {
       "myNewKey": "My new string"
     }
   }
   ```

2. **Add the Dutch translation** to `src/i18n/locales/nl.json`:
   ```json
   {
     "myFeature": {
       "myNewKey": "Mijn nieuwe tekst"
     }
   }
   ```

3. **Use it in a component**:
   ```tsx
   const { t } = useTranslation();
   return <p>{t("myFeature.myNewKey")}</p>;
   ```

4. **For locale-aware formatting** (numbers, dates, currencies), use `useLocale()`:
   ```tsx
   const { formatNumber, formatDate, formatCurrency } = useLocale();
   ```

To add a third locale (e.g. German):
- Add `de` to `SUPPORTED_LANGUAGES` in `src/i18n/index.ts`
- Add `de: "de-DE"` to `LOCALE_MAP` in `src/i18n/hooks/useLocale.ts`
- Create `src/i18n/locales/de.json` with all keys from `en.json`

---

## Running tests

```bash
pnpm test           # single run
pnpm test:watch     # watch mode
pnpm test:ui        # browser UI
```

Test files live next to the code they test, in `__tests__/` sub-folders. The global mock in `src/test/setup.ts` returns i18n keys as-is, keeping tests decoupled from translation copy.

---

## Roadmap (not yet built)

- Real backend API integration (replace mock service responses)
- User accounts and saved research sessions
- Dataset comparison mode
- Export to PDF / Excel
- Embed-ready chart widgets
