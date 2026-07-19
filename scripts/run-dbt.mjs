#!/usr/bin/env node
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { loadLocalEnv } from "./lib/runtime.mjs";

function dbtBinary() {
  const local = resolve(process.cwd(), ".venv-dbt/bin/dbt");
  return existsSync(local) ? local : "dbt";
}

function hydrateSupabaseDboEnv(env) {
  if (env.SUPABASE_DB_HOST && env.SUPABASE_DB_USER && env.SUPABASE_DB_PASSWORD) return env;
  if (!env.SUPABASE_DB_URL) return env;

  const url = new URL(env.SUPABASE_DB_URL);
  env.SUPABASE_DB_HOST ||= url.hostname;
  env.SUPABASE_DB_PORT ||= url.port || "5432";
  env.SUPABASE_DB_USER ||= decodeURIComponent(url.username);
  env.SUPABASE_DB_PASSWORD ||= decodeURIComponent(url.password);
  env.SUPABASE_DB_NAME ||= url.pathname.replace(/^\//, "") || "postgres";
  return env;
}

function main() {
  loadLocalEnv();
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes("--help")) {
    console.log(`Usage:
  node scripts/run-dbt.mjs debug
  node scripts/run-dbt.mjs run --select semantic
  node scripts/run-dbt.mjs test --select semantic

The wrapper reads .env.local, parses SUPABASE_DB_URL when present, and runs dbt
with --project-dir dbt --profiles-dir dbt.
`);
    process.exit(0);
  }

  const env = hydrateSupabaseDboEnv({ ...process.env });
  env.DBT_PROFILES_DIR ||= resolve(process.cwd(), "dbt");

  const result = spawnSync(
    dbtBinary(),
    [...args, "--project-dir", "dbt", "--profiles-dir", "dbt"],
    {
      cwd: process.cwd(),
      env,
      stdio: "inherit",
    }
  );

  process.exit(result.status ?? 1);
}

main();
