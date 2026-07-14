# Guara

**Investigation workspace for exploring official Dutch public data.**

Guara is a desktop-first research platform for journalists, researchers, consultants, policy analysts, and data teams. The app is built around an investigation lifecycle and is backed by Supabase Bronze/Silver data layers for CBS StatLine ingestion and exploration.

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS 4 + CSS custom properties |
| Data app state | Local React state |
| Database | Supabase Postgres |
| Charts | Recharts |
| Icons | Lucide React |
| Testing | Vitest + React Testing Library |
| Lint/format | ESLint + Prettier |

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Fill `.env.local` with your Supabase project URL, anon key, service role key, and pooler Postgres URL before running ingestion scripts.

## Environment

| Variable | Description |
|---|---|
| `VITE_APP_NAME` | Display name, normally `Guara` |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Public anon key used by the frontend |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side key used by ingestion scripts where needed |
| `SUPABASE_DB_URL` | Supabase Postgres session pooler URI for fast ingestion |
| `SUPABASE_DB_SSL_DISABLE` | Optional local connectivity escape hatch; leave unset normally |

## App Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Build the frontend |
| `npm run typecheck` | Run TypeScript checks |
| `npm run lint` | Run ESLint across `src/` |
| `npm run test` | Run tests once |

## CBS Data Scripts

| Script | Description |
|---|---|
| `npm run ingest:cbs:bronze:all` | API/Supabase Bronze metadata and row ingestion path |
| `npm run ingest:cbs:bronze:fast` | Direct Postgres fast Bronze row ingestion path |
| `npm run overview:cbs:bronze` | Bronze overview from the API ingestion script |
| `npm run plan:cbs:silver` | Plan Silver load candidates from Bronze metadata |
| `npm run load:cbs:silver` | Load CBS datasets from Bronze into Silver |
| `npm run overview:cbs:silver` | Silver overview mode |
| `npm run purge:cbs:bronze:archief` | Remove Archief hot raw rows while retaining metadata |

Common fast Bronze examples:

```bash
npm run ingest:cbs:bronze:fast -- --root-theme "Bevolking" --limit 100 --max-rows-per-dataset 1000000
npm run ingest:cbs:bronze:fast -- --failed-only --limit 400000 --max-rows-per-dataset 10000000 --huge-chunks
npm run purge:cbs:bronze:archief -- --dry-run --limit-datasets 25
```

By default, the fast Bronze script skips CBS `Archief` datasets. Use `--include-archive` only when you explicitly want archive rows in hot Supabase storage.

## Supabase SQL

Run schema files in this order:

1. `supabase/schema.sql`
2. `supabase/bronze_schema.sql`
3. `supabase/bronze_performance.sql`
4. `supabase/silver_schema.sql`

See `supabase/README.md` for database-specific notes.

## Project Structure

| Path | Purpose |
|---|---|
| `src/app` | App shell, route switch, providers |
| `src/pages` | Route-level screens |
| `src/features` | Feature-owned components, services, hooks, and types |
| `src/data` | Bronze/Silver/Gold data contracts and models |
| `scripts` | CBS ingestion, planning, loading, and maintenance scripts |
| `scripts/lib` | Shared script runtime helpers |
| `supabase` | SQL schema and performance files |
| `config` | CBS domain configuration |

## Notes

- Keep `.env.local`, generated reports, and `dist/` out of git.
- Use the fast Bronze script for large row loads once metadata is available.
- Treat Silver as the curated source-specific layer and Gold as the future dimensional/domain layer.
