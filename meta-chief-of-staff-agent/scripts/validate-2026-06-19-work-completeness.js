const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const errors = [];
const requiredFiles = [
  "docs/audits/2026-06-19-PORTFOLIO-WORK-COMPLETENESS-AUDIT.md",
  "config/audits/2026-06-19-portfolio-work-completeness.json",
  "docs/audits/2026-06-19-WORK-DECISION-LOG.md",
  "docs/audits/2026-06-19-NEXT-ACTIONS.md"
];

for (const rel of requiredFiles) {
  if (!fs.existsSync(path.join(root, rel))) errors.push(`missing required file: ${rel}`);
}

const manifestPath = path.join(root, "config/audits/2026-06-19-portfolio-work-completeness.json");
let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
} catch (error) {
  errors.push(`manifest JSON invalid: ${error.message}`);
}

const knownMilestones = [
  "VDS Runtime Pilot",
  "VDS Project Review Agent",
  "Aurelean Runtime Pilot",
  "Portfolio OS V1.1 Certification",
  "Controlled Execution Readiness",
  "Controlled Weekly Brief Foundation"
];

if (manifest) {
  for (const key of ["audit_id", "audit_date", "timezone", "repositories", "milestones", "commits", "pull_requests", "validations", "safety_invariants", "generated_artifact_checks", "gaps", "owner_actions", "final_verdict"]) {
    if (!(key in manifest)) errors.push(`manifest missing ${key}`);
  }
  for (const milestone of knownMilestones) {
    if (!manifest.milestones?.some((item) => item.milestone === milestone)) errors.push(`missing milestone: ${milestone}`);
  }
  for (const commit of manifest.commits ?? []) {
    if (!/^[0-9a-f]{40}$/.test(commit)) errors.push(`commit is not full SHA: ${commit}`);
  }
  for (const item of manifest.milestones ?? []) {
    if (!item.work_product_completeness) errors.push(`missing completeness for ${item.milestone}`);
    if (!item.publication_completeness) errors.push(`missing publication status for ${item.milestone}`);
  }
  if (manifest.safety_invariants?.execution_authorization !== "NOT_AUTHORIZED") errors.push("execution authorization must be NOT_AUTHORIZED");
  if (manifest.safety_invariants?.live_execution !== "NO-GO") errors.push("live execution must be NO-GO");
  for (const validation of manifest.validations ?? []) {
    if (!validation.command || !validation.result) errors.push("validation entry missing command or result");
  }
}

if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, execution_authorization: "NOT_AUTHORIZED", live_execution: "NO-GO" }, null, 2));
