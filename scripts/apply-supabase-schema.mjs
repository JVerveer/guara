#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createPostgresClient, explainPostgresConnectionError, loadLocalEnv } from "./lib/runtime.mjs";

function parseArgs(argv) {
  const options = {
    files: [],
    statementTimeoutMs: 900000,
    skipIndexes: false,
    dryRun: false,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--file") options.files.push(argv[++index]);
    else if (arg === "--statement-timeout-ms") options.statementTimeoutMs = Number(argv[++index] ?? options.statementTimeoutMs);
    else if (arg === "--skip-indexes") options.skipIndexes = true;
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--help") {
      console.log(`Usage:
  npm run apply:schema -- --file supabase/gold_schema.sql
  npm run apply:schema -- --file supabase/gold_schema.sql --skip-indexes
  npm run apply:schema -- --file supabase/gold_schema.sql --file supabase/semantic_catalogue_schema.sql

Options:
  --file <path>                    SQL file to apply. Can be passed more than once.
  --statement-timeout-ms 900000     Per-statement timeout for direct Postgres execution.
  --skip-indexes                    Skip CREATE INDEX statements. Useful when facts are large/busy.
  --dry-run                         Print statements that would run without executing them.
`);
      process.exit(0);
    }
  }

  if (!options.files.length) throw new Error("Pass at least one --file path.");
  return options;
}

function splitSqlStatements(sql) {
  const statements = [];
  let current = "";
  let dollarQuote = "";

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    current += char;

    if (dollarQuote) {
      if (sql.startsWith(dollarQuote, index)) {
        current += sql.slice(index + 1, index + dollarQuote.length);
        index += dollarQuote.length - 1;
        dollarQuote = "";
      }
      continue;
    }

    if (char === "$") {
      const match = sql.slice(index).match(/^\$[A-Za-z0-9_]*\$/);
      if (match) {
        dollarQuote = match[0];
        current += sql.slice(index + 1, index + dollarQuote.length);
        index += dollarQuote.length - 1;
      }
      continue;
    }

    if (!dollarQuote && char === ";") {
      const statement = current.trim();
      if (statement) statements.push(statement);
      current = "";
    }
  }

  const trailing = current.trim();
  if (trailing) statements.push(trailing);
  return statements;
}

function shouldSkipStatement(statement, options) {
  if (!options.skipIndexes) return false;
  return /^\s*create\s+(unique\s+)?index\b/i.test(statement);
}

async function applyFile(client, file, options) {
  const absolutePath = resolve(process.cwd(), file);
  const sql = readFileSync(absolutePath, "utf8");
  const statements = splitSqlStatements(sql);
  let applied = 0;
  let skipped = 0;

  console.log(`Applying ${file}: ${statements.length} statement(s)`);

  for (let index = 0; index < statements.length; index += 1) {
    const statement = statements[index];
    const preview = statement.replace(/\s+/g, " ").slice(0, 180);

    if (shouldSkipStatement(statement, options)) {
      skipped += 1;
      console.log(`  skipped index ${index + 1}/${statements.length}: ${preview}`);
      continue;
    }

    if (options.dryRun) {
      console.log(`  would apply ${index + 1}/${statements.length}: ${preview}`);
      continue;
    }

    try {
      await client.query(statement);
      applied += 1;
      console.log(`  applied ${index + 1}/${statements.length}: ${preview}`);
    } catch (error) {
      error.message = `Failed statement ${index + 1}/${statements.length} from ${file}: ${preview}\n${error.message}`;
      throw error;
    }
  }

  console.log(`Done ${file}: ${applied} applied, ${skipped} skipped.`);
}

async function main() {
  loadLocalEnv();
  const options = parseArgs(process.argv);
  const client = createPostgresClient({
    applicationName: "guara-schema-applier",
    statementTimeoutMs: Math.max(1, options.statementTimeoutMs),
    queryTimeoutMs: Math.max(1, options.statementTimeoutMs),
  });

  try {
    await client.connect();
  } catch (error) {
    throw new Error(explainPostgresConnectionError(error));
  }

  try {
    for (const file of options.files) {
      await applyFile(client, file, options);
    }
  } finally {
    await client.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(explainPostgresConnectionError(error));
    process.exit(1);
  });
}
