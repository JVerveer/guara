import pg from "pg";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const { Client } = pg;

export function loadLocalEnv() {
  for (const file of [".env.local", ".env"]) {
    const path = resolve(process.cwd(), file);
    if (!existsSync(path)) continue;

    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
    }
  }
}

export function normalizeKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function createPostgresClient({
  applicationName = "guara-script",
  statementTimeoutMs = 0,
  queryTimeoutMs = 0,
} = {}) {
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) throw new Error("Missing SUPABASE_DB_URL in .env.local.");

  const url = new URL(connectionString);
  ["sslmode", "sslcert", "sslkey", "sslrootcert", "uselibpqcompat"].forEach((key) => {
    url.searchParams.delete(key);
  });
  url.searchParams.set("application_name", applicationName);

  const client = new Client({
    connectionString: url.toString(),
    ssl: process.env.SUPABASE_DB_SSL_DISABLE === "true" ? false : { rejectUnauthorized: false },
    statement_timeout: statementTimeoutMs,
    query_timeout: queryTimeoutMs,
  });

  client.on("error", (error) => {
    const message = error?.message ?? String(error);
    console.error(`[${applicationName}] Postgres connection error: ${message}`);
  });

  return client;
}

export function explainPostgresConnectionError(error) {
  if (error?.code === "ENOTFOUND" && String(error.hostname ?? "").startsWith("db.")) {
    return [
      error.message,
      "",
      "The direct Supabase database hostname could not be resolved by DNS.",
      "Use the Session pooler connection string from Supabase instead:",
      "  Supabase project -> Connect -> Session pooler -> URI",
      "",
      "It usually looks like:",
      "  postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require",
      "",
      "Put that URI in .env.local as SUPABASE_DB_URL.",
    ].join("\n");
  }

  if (error?.code === "ENETUNREACH" || error?.code === "EHOSTUNREACH") {
    return [
      error.message,
      "",
      "The direct Supabase database endpoint is probably not reachable from this network.",
      "Use the Session pooler connection string from Supabase Connect instead of the direct db.<project-ref>.supabase.co host.",
    ].join("\n");
  }

  if (error?.code === "28P01" || String(error?.message ?? "").includes("password authentication failed")) {
    return [
      error.message,
      "",
      "Postgres rejected the credentials in SUPABASE_DB_URL.",
      "For Supabase Session pooler, the username usually includes the project ref:",
      "  postgres.<project-ref>",
      "",
      "For this project that should look like:",
      "  postgres.kmwmbmpnipwygkvnqeai",
      "",
      "Also check that the database password is correct and URL-encoded if it contains special characters like @, #, %, /, :, ?, &, +, or spaces.",
    ].join("\n");
  }

  if (String(error?.message ?? "").includes("self-signed certificate")) {
    return [
      error.message,
      "",
      "The database accepted the connection details, but local TLS verification rejected the certificate chain.",
      "Guara scripts strip sslmode from SUPABASE_DB_URL and apply rejectUnauthorized=false for Supabase pooler compatibility.",
      "Retry the command. If this persists, remove sslmode=require from SUPABASE_DB_URL or set SUPABASE_DB_SSL_DISABLE=true only for a local connectivity test.",
    ].join("\n");
  }

  return error?.message ?? String(error);
}
