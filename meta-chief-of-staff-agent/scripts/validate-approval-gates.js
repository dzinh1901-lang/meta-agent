const fs = require("fs");
const path = require("path");

const docs = [
  path.join(__dirname, "..", "docs", "AUTHORITY-MODEL.md"),
  path.join(__dirname, "..", "docs", "APPROVAL-GATES.md"),
  path.join(__dirname, "..", "docs", "HUMAN-IN-THE-LOOP.md")
];

const requiredTerms = ["deploy", "secrets", "billing", "database", "external communication"];
const combined = docs.map((file) => fs.readFileSync(file, "utf8").toLowerCase()).join("\n");

for (const term of requiredTerms) {
  if (!combined.includes(term)) throw new Error(`Approval docs missing required term: ${term}`);
}

console.log("Validated approval gate coverage.");
