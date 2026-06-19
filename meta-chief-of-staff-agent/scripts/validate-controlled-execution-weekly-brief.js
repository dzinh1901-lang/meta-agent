const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const errors = [];

function readJson(rel) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));
  } catch (error) {
    errors.push(`${rel}: ${error.message}`);
    return null;
  }
}

for (const rel of [
  "contracts/controlled-execution-weekly-brief-input.schema.json",
  "contracts/controlled-execution-weekly-brief-output.schema.json",
  "contracts/controlled-execution-weekly-brief-request.schema.json",
  "config/controlled-execution-weekly-brief-policy.json",
  "templates/CONTROLLED-EXECUTION-WEEKLY-BRIEF-APPROVAL.json"
]) readJson(rel);

const policy = readJson("config/controlled-execution-weekly-brief-policy.json");
if (policy?.execution_authorization !== "NOT_AUTHORIZED") errors.push("policy execution_authorization must be NOT_AUTHORIZED");
if (policy?.live_execution_enabled !== false) errors.push("policy live_execution_enabled must be false");
for (const action of ["network", "subprocesses", "shell", "secret reads", "database access", "deployments", "billing", "external communications", "production writes"]) {
  if (!policy?.prohibited_actions?.includes(action)) errors.push(`policy missing prohibited action: ${action}`);
  if (policy?.allowed_actions?.includes(action)) errors.push(`prohibited action appears in allowlist: ${action}`);
}

const requiredDocs = [
  "docs/CONTROLLED-EXECUTION-WEEKLY-BRIEF-IMPLEMENTATION-PLAN.md",
  "docs/CONTROLLED-EXECUTION-WEEKLY-BRIEF-PILOT.md",
  "docs/CONTROLLED-EXECUTION-WEEKLY-BRIEF-DATA-BOUNDARY.md",
  "docs/CONTROLLED-EXECUTION-WEEKLY-BRIEF-ACCEPTANCE-CRITERIA.md"
];
for (const rel of requiredDocs) {
  const body = fs.readFileSync(path.join(root, rel), "utf8");
  if (!body.includes("NOT_AUTHORIZED")) errors.push(`${rel}: must record NOT_AUTHORIZED`);
}

if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, execution_authorization: "NOT_AUTHORIZED", live_execution: "NO-GO" }, null, 2));
