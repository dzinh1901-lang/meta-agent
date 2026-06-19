const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const errors = [];

function readJson(rel) {
  const full = path.join(root, rel);
  try {
    return JSON.parse(fs.readFileSync(full, "utf8"));
  } catch (error) {
    errors.push(`${rel}: ${error.message}`);
    return null;
  }
}

for (const rel of [
  "contracts/controlled-execution-pilot-policy.schema.json",
  "contracts/controlled-execution-owner-approval.schema.json",
  "contracts/controlled-execution-readiness-decision.schema.json",
  "config/controlled-execution-pilot-policy.json",
  "templates/CONTROLLED-EXECUTION-OWNER-APPROVAL.json"
]) readJson(rel);

const policy = readJson("config/controlled-execution-pilot-policy.json");
const denied = new Set(policy?.deniedCapabilities ?? []);
for (const capability of ["network", "shell", "subprocesses", "Git push", "secret reads", "database access", "billing", "deployments", "external communications", "production writes", "self-approval"]) {
  if (!denied.has(capability)) errors.push(`policy missing denied capability: ${capability}`);
}
if (policy?.safetyDefaults?.executionDisabledByDefault !== true) errors.push("executionDisabledByDefault must be true");
if (policy?.safetyDefaults?.killSwitchEngagedByDefault !== true) errors.push("killSwitchEngagedByDefault must be true");

const decisionDoc = fs.readFileSync(path.join(root, "docs/CONTROLLED-EXECUTION-READINESS-DECISION.md"), "utf8");
if (!decisionDoc.includes("CONDITIONALLY_READY")) errors.push("decision must record CONDITIONALLY_READY");
if (!decisionDoc.includes("NOT_AUTHORIZED")) errors.push("decision must record NOT_AUTHORIZED");

if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, execution_authorization: "NOT_AUTHORIZED" }, null, 2));

