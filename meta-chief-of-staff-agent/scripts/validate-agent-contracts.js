const fs = require("fs");
const path = require("path");

const contractsDir = path.join(__dirname, "..", "contracts");
const schemaFiles = fs.readdirSync(contractsDir).filter((file) => file.endsWith(".schema.json"));

for (const file of schemaFiles) {
  const fullPath = path.join(contractsDir, file);
  const parsed = JSON.parse(fs.readFileSync(fullPath, "utf8"));
  if (!parsed.title || parsed.type !== "object") {
    throw new Error(`${file} must define an object schema with a title.`);
  }
}

const examples = JSON.parse(fs.readFileSync(path.join(contractsDir, "examples.valid.json"), "utf8"));
if (!examples.agent || !examples.task) {
  throw new Error("examples.valid.json must include agent and task examples.");
}

console.log(`Validated ${schemaFiles.length} contract schemas and example payloads.`);
