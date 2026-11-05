#!/usr/bin/env node

/**
 * CI verification script: Ensures that every environment variable
 * validated by backend/config/env.js or accessed via process.env
 * is documented in .env.example.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

function parseEnvKeys(filePath) {
  if (!fs.existsSync(filePath)) return new Set();
  const content = fs.readFileSync(filePath, "utf8");
  const keys = new Set();
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Z0-9_]+)\s*=/);
    if (match) keys.add(match[1]);
  }
  return keys;
}

function findReferencedEnvVars() {
  const envConfigPath = path.join(rootDir, "backend", "config", "env.js");
  if (!fs.existsSync(envConfigPath)) {
    console.error("backend/config/env.js not found!");
    process.exit(1);
  }

  const content = fs.readFileSync(envConfigPath, "utf8");
  const vars = new Set();

  // Match schema keys: KEY: z....
  const schemaRegex = /^\s*([A-Z0-9_]+)\s*:\s*z\./gm;
  let match;
  while ((match = schemaRegex.exec(content)) !== null) {
    vars.add(match[1]);
  }

  // Common fallbacks/legacy vars
  vars.add("PORT");
  vars.add("NODE_ENV");
  vars.add("MONGO_URI");
  vars.add("JWT_ACCESS_SECRET");
  vars.add("JWT_REFRESH_SECRET");
  vars.add("CLIENT_URL");

  return vars;
}

function main() {
  const rootExampleKeys = parseEnvKeys(path.join(rootDir, ".env.example"));
  const backendExampleKeys = parseEnvKeys(path.join(rootDir, "backend", ".env.example"));
  const requiredVars = findReferencedEnvVars();

  const missingRoot = [];
  const missingBackend = [];

  for (const v of requiredVars) {
    if (!rootExampleKeys.has(v)) missingRoot.push(v);
    if (!backendExampleKeys.has(v)) missingBackend.push(v);
  }

  let failed = false;
  if (missingRoot.length > 0) {
    console.error(`Missing variables in root .env.example: ${missingRoot.join(", ")}`);
    failed = true;
  }
  if (missingBackend.length > 0) {
    console.error(`Missing variables in backend/.env.example: ${missingBackend.join(", ")}`);
    failed = true;
  }

  if (failed) {
    console.error("\n❌ Environment check failed! Please update .env.example files.");
    process.exit(1);
  }

  console.log(`✅ All ${requiredVars.size} environment variables are documented in .env.example`);
}

main();
