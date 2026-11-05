#!/usr/bin/env node

/**
 * Copies Monaco Editor release assets from node_modules into public/monaco/vs
 * for self-hosted, CDN-independent production deployments.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, "..");

const srcDir = path.join(frontendDir, "node_modules", "monaco-editor", "min", "vs");
const destDir = path.join(frontendDir, "public", "monaco", "vs");

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

if (!fs.existsSync(srcDir)) {
  console.warn(`[copy-monaco] Source directory not found: ${srcDir}. Skipping copy.`);
  process.exit(0);
}

try {
  console.log(`[copy-monaco] Copying Monaco Editor assets to ${destDir}...`);
  copyDirRecursive(srcDir, destDir);
  console.log(`[copy-monaco] Successfully copied Monaco Editor assets.`);
} catch (err) {
  console.error(`[copy-monaco] Failed to copy Monaco Editor assets:`, err);
  process.exit(1);
}

