#!/usr/bin/env node

/**
 * AI Code Review Evaluation Script
 * Tests configured AI provider against five known code defects:
 * 1. Off-by-one loop boundary
 * 2. Null dereference
 * 3. SQL string concatenation (injection)
 * 4. Unclosed file resource
 * 5. Unused local variable
 *
 * Usage:
 *   node backend/scripts/ai-eval.js
 */

import "../config/env.js";
import { reviewCode, getAiConfig } from "../services/ai/index.js";

const SAMPLES = [
  {
    name: "Off-by-one loop bound",
    language: "javascript",
    expectedLine: 2,
    expectedCategory: "bug",
    code: `function printItems(items) {
  for (let i = 0; i <= items.length; i++) {
    console.log(items[i]);
  }
}`,
  },
  {
    name: "Null dereference",
    language: "javascript",
    expectedLine: 2,
    expectedCategory: "bug",
    code: `function getUserDisplayName(user) {
  const name = user.profile.name;
  return name.toUpperCase();
}`,
  },
  {
    name: "SQL concatenation (Injection)",
    language: "javascript",
    expectedLine: 2,
    expectedCategory: "security",
    code: `async function findUser(db, userId) {
  const query = "SELECT * FROM users WHERE id = '" + userId + "'";
  return db.query(query);
}`,
  },
  {
    name: "Unclosed file descriptor resource",
    language: "javascript",
    expectedLine: 3,
    expectedCategory: "performance",
    code: `import fs from "fs";
function readFileHeader(filepath) {
  const fd = fs.openSync(filepath, "r");
  const buffer = Buffer.alloc(16);
  fs.readSync(fd, buffer, 0, 16, 0);
  return buffer;
}`,
  },
  {
    name: "Unused local variable",
    language: "javascript",
    expectedLine: 2,
    expectedCategory: "style",
    code: `function calculateTotal(price, taxRate) {
  const discount = 0.15;
  const total = price + price * taxRate;
  return total;
}`,
  },
];

async function runEvaluation() {
  const config = getAiConfig();
  console.log("=================================================");
  console.log(" DevCollab AI Code Review Evaluation Suite");
  console.log("=================================================");
  console.log(`Configured Provider: ${config.provider || "None"}`);
  console.log(`Configured Model:    ${config.model || "None"}`);
  console.log("-------------------------------------------------");

  if (!config.configured) {
    console.warn("⚠️  AI provider is not configured. Set AI_PROVIDER, AI_MODEL, and AI_API_KEY in backend/.env to run against a real LLM.");
    process.exit(0);
  }

  let totalHits = 0;
  let totalMisses = 0;
  let totalHallucinations = 0;

  for (let i = 0; i < SAMPLES.length; i++) {
    const sample = SAMPLES[i];
    console.log(`\n[${i + 1}/${SAMPLES.length}] Testing: ${sample.name}...`);

    try {
      const result = await reviewCode({
        language: sample.language,
        code: sample.code,
        focus: "all",
      });

      if (result.status !== "ok") {
        console.error(`  ❌ Review execution failed: ${result.summary || result.error}`);
        totalMisses++;
        continue;
      }

      console.log(`  Summary: ${result.summary}`);
      console.log(`  Reported findings: ${result.findings.length}`);

      // Check if any finding caught the target line (within +/- 1 line tolerance)
      const hit = result.findings.find(
        (f) => Math.abs(f.line - sample.expectedLine) <= 1
      );

      if (hit) {
        console.log(`  ✅ HIT on line ${hit.line} [${hit.category.toUpperCase()} / ${hit.severity.toUpperCase()}]: ${hit.message}`);
        totalHits++;
      } else {
        console.log(`  ⚠️  MISSED: Expected defect around line ${sample.expectedLine} (${sample.expectedCategory})`);
        totalMisses++;
      }

      // Check for extraneous / spurious findings
      const extraFindings = result.findings.filter(
        (f) => Math.abs(f.line - sample.expectedLine) > 1
      );
      if (extraFindings.length > 0) {
        console.log(`  ℹ️  ${extraFindings.length} additional finding(s):`);
        for (const extra of extraFindings) {
          console.log(`     - Line ${extra.line} [${extra.category}]: ${extra.message}`);
        }
        totalHallucinations += extraFindings.length;
      }
    } catch (err) {
      console.error(`  ❌ Error reviewing ${sample.name}: ${err.message}`);
      totalMisses++;
    }
  }

  console.log("\n=================================================");
  console.log(" Evaluation Summary");
  console.log("=================================================");
  console.log(`Known Defect Hits:         ${totalHits} / ${SAMPLES.length} (${Math.round((totalHits / SAMPLES.length) * 100)}%)`);
  console.log(`Missed Defect Detections:  ${totalMisses} / ${SAMPLES.length}`);
  console.log(`Additional/Other Findings: ${totalHallucinations}`);
  console.log("=================================================\n");
}

runEvaluation().catch((err) => {
  console.error("Evaluation script crashed:", err);
  process.exit(1);
});
