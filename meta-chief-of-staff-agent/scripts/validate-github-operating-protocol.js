const fs = require("fs");
const path = require("path");

const protocolPath = path.join(__dirname, "..", "config", "github.operating-protocol.json");
const protocol = JSON.parse(fs.readFileSync(protocolPath, "utf8"));

const requiredTopLevel = [
  "schemaVersion",
  "status",
  "sourceOfTruthRepository",
  "runtimeImplementationRepository",
  "defaultProtocol",
  "standardSteps",
  "repositoryRoles",
  "blockedByDefault",
  "requiredEvidence"
];

for (const field of requiredTopLevel) {
  if (!(field in protocol)) throw new Error(`github.operating-protocol.json missing ${field}`);
}

if (protocol.sourceOfTruthRepository !== "dzinh1901-lang/meta-agent") {
  throw new Error("sourceOfTruthRepository must be dzinh1901-lang/meta-agent");
}

if (protocol.runtimeImplementationRepository !== "dzinh1901-lang/agentops-runtime") {
  throw new Error("runtimeImplementationRepository must be dzinh1901-lang/agentops-runtime");
}

for (const listName of ["standardSteps", "repositoryRoles", "blockedByDefault", "requiredEvidence"]) {
  if (!Array.isArray(protocol[listName]) || protocol[listName].length === 0) {
    throw new Error(`${listName} must be a non-empty array`);
  }
}

const requiredPolicies = [
  "pushPolicy",
  "deploymentPolicy",
  "secretsPolicy",
  "productionPolicy",
  "migrationPolicy",
  "externalApiPolicy"
];

for (const policy of requiredPolicies) {
  if (!protocol.defaultProtocol[policy]) throw new Error(`defaultProtocol missing ${policy}`);
}

console.log("Validated GitHub operating protocol.");
