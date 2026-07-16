#!/usr/bin/env node
import { spawnSync } from "node:child_process";

function parseArgs(argv) {
  const options = {
    limit: 100000,
    batchSize: 1000,
    ensureSchema: false,
    full: false,
  };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--limit") options.limit = Number(argv[++index] ?? options.limit);
    else if (arg === "--batch-size") options.batchSize = Number(argv[++index] ?? options.batchSize);
    else if (arg === "--ensure-schema") options.ensureSchema = true;
    else if (arg === "--full") options.full = true;
    else if (arg === "--help") {
      console.log(`Usage:
  npm run prepare:search:bouwen-en-wonen -- --ensure-schema --full
  npm run prepare:search:bouwen-en-wonen -- --limit 50000

This loads Bouwen en wonen semantic metadata and refreshes the search index for
domain datasets, metrics, dimensions, sources, geographies and categories.
`);
      process.exit(0);
    }
  }
  return options;
}

function run(command, args) {
  console.log(`\n> ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, { stdio: "inherit", env: process.env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const options = parseArgs(process.argv);

run("node", [
  "scripts/load-semantic-catalogue.mjs",
  ...(options.ensureSchema ? ["--ensure-schema"] : []),
  "--domain",
  "bouwen-en-wonen",
  "--limit",
  String(options.limit),
]);

run("node", [
  "scripts/index-search.mjs",
  ...(options.full ? ["--full"] : []),
  "--limit",
  String(options.limit),
  "--batch-size",
  String(options.batchSize),
]);

console.log("\nBouwen en wonen search catalogue prepared.");
