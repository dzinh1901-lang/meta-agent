const fs = require("fs");
const path = require("path");

const registryPath = path.join(__dirname, "..", "config", "portfolio.registry.json");
const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
const required = ["id", "name", "repository", "localPath", "role", "status", "currentMilestone", "owner", "riskLevel", "productionReadiness", "dependencies", "blockers"];

if (!Array.isArray(registry.projects) || registry.projects.length === 0) {
  throw new Error("portfolio.registry.json must contain at least one project.");
}

const ids = new Set();
for (const project of registry.projects) {
  for (const field of required) {
    if (!(field in project)) throw new Error(`${project.id || "unknown"} missing ${field}`);
  }
  if (ids.has(project.id)) throw new Error(`Duplicate project id: ${project.id}`);
  ids.add(project.id);
  if (!Array.isArray(project.dependencies)) throw new Error(`${project.id} dependencies must be an array`);
  if (!Array.isArray(project.blockers)) throw new Error(`${project.id} blockers must be an array`);
}

console.log(`Validated ${registry.projects.length} portfolio registry entries.`);
