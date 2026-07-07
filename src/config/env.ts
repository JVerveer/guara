/**
 * Typed, validated environment configuration.
 *
 * All environment variables are read here — never use `import.meta.env`
 * directly inside components, hooks, or services. That keeps the surface
 * area for env-related changes to one file and makes testing easier.
 */

function required(key: string): string {
  const value = import.meta.env[key] as string | undefined;
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}. ` +
        `Copy .env.example to .env.local and fill in the value.`
    );
  }
  return value;
}

function optional(key: string, fallback: string): string {
  return (import.meta.env[key] as string | undefined) ?? fallback;
}

function optionalEmpty(key: string): string | undefined {
  const value = import.meta.env[key] as string | undefined;
  return value?.trim() || undefined;
}

function flag(key: string, fallback = false): boolean {
  const raw = import.meta.env[key] as string | undefined;
  if (raw === undefined) return fallback;
  return raw === "true";
}

export const config = {
  /** Base URL for the Guara REST API. */
  apiBaseUrl: optional("VITE_API_BASE_URL", "http://localhost:8000/api/v1"),

  /** Display name of the application. */
  appName: optional("VITE_APP_NAME", "Guara"),

  /** Semantic version string, injected at build time. */
  appVersion: optional("VITE_APP_VERSION", "0.1.0"),

  /** Default locale when browser detection is unavailable. */
  defaultLocale: optional("VITE_DEFAULT_LOCALE", "en") as "en" | "nl",

  /** When true, services call the real API instead of returning mock data. */
  useRealApi: flag("VITE_USE_REAL_API", false),

  /** Supabase project URL used for persisted data exploration metadata. */
  supabaseUrl: optionalEmpty("VITE_SUPABASE_URL"),

  /** Supabase anon public key. Safe for browser use when RLS policies are configured. */
  supabaseAnonKey: optionalEmpty("VITE_SUPABASE_ANON_KEY"),

  /** True when running under `vite dev`. */
  isDev: import.meta.env.DEV as boolean,

  /** True when running a production build. */
  isProd: import.meta.env.PROD as boolean,
} as const;
