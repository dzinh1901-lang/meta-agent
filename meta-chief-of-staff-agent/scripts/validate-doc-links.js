const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const docs = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    if (entry.isFile() && entry.name.endsWith(".md")) docs.push(full);
  }
}

walk(root);

const missing = [];
const linkPattern = /\]\(([^)]+)\)/g;
for (const file of docs) {
  const text = fs.readFileSync(file, "utf8");
  for (const match of text.matchAll(linkPattern)) {
    const target = match[1];
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    const clean = target.split("#")[0];
    if (!clean) continue;
    const resolved = path.resolve(path.dirname(file), clean);
    if (!fs.existsSync(resolved)) missing.push(`${path.relative(root, file)} -> ${target}`);
  }
}

if (missing.length) throw new Error(`Missing doc links:\n${missing.join("\n")}`);
console.log(`Validated links across ${docs.length} markdown files.`);
