const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

const requiredDocs = [
  {
    file: "docs/CERTIFICATION-INVENTORY.md",
    sections: [
      "Repository",
      "Branch",
      "Latest Commit",
      "Open PRs",
      "Validation Status",
      "Integration Status",
      "Blockers",
      "Risk Level"
    ]
  },
  {
    file: "docs/PORTFOLIO-OS-V1-CERTIFICATION.md",
    sections: [
      "Executive Summary",
      "Scope",
      "Participating Repositories",
      "Integrated Systems",
      "Runtime Architecture Summary",
      "Governance Architecture Summary",
      "Approval Architecture Summary",
      "Audit Architecture Summary",
      "Portfolio Dashboard Summary",
      "Current Operational Capabilities",
      "Dry-Run Capabilities",
      "Prohibited Capabilities",
      "Owner Approval Requirements",
      "Known Blockers",
      "Certification Verdict"
    ]
  },
  {
    file: "docs/PORTFOLIO-READINESS-MATRIX.md",
    sections: [
      "Meta-Agent",
      "AgentOps Runtime",
      "VDS DesignOS",
      "Aurelean",
      "Meridian Yacht Atelier",
      "Monsieur App",
      "NOT_STARTED",
      "IN_PROGRESS",
      "READY",
      "BLOCKED"
    ]
  },
  {
    file: "docs/PORTFOLIO-RISK-REGISTER.md",
    sections: [
      "Architecture Risks",
      "Governance Risks",
      "Execution Risks",
      "Security Risks",
      "Integration Risks",
      "Commercial Risks",
      "Operational Risks",
      "Runtime drift risk",
      "Documentation drift risk",
      "Approval bypass risk",
      "Secret exposure risk",
      "Live execution risk",
      "Integration maintenance risk"
    ]
  },
  {
    file: "docs/PORTFOLIO-ROADMAP-V2.md",
    sections: [
      "Milestone 01",
      "Milestone 02",
      "Milestone 03",
      "Milestone 04",
      "Milestone 05",
      "Milestone 06",
      "Milestone 07",
      "Milestone 08",
      "Milestone 09",
      "Milestone 10",
      "Objective",
      "Deliverables",
      "Dependencies",
      "Exit Criteria"
    ]
  },
  {
    file: "docs/PORTFOLIO-OS-V1-FINAL-REPORT.md",
    sections: [
      "Executive Summary",
      "Repositories Reviewed",
      "Validation Performed",
      "Certification Artifacts",
      "Integrated Systems",
      "Open Risks",
      "Blocked Areas",
      "Owner Approval Areas",
      "Recommended Next Milestone",
      "codex/vds-runtime-pilot",
      "Portfolio OS V1 is certified for governed dry-run operation and integration testing.",
      "Portfolio OS V1 is not certified for live execution."
    ]
  }
];

const errors = [];

for (const doc of requiredDocs) {
  const fullPath = path.join(root, doc.file);
  if (!fs.existsSync(fullPath)) {
    errors.push(`${doc.file} is missing`);
    continue;
  }

  const content = fs.readFileSync(fullPath, "utf8");
  for (const section of doc.sections) {
    if (!content.includes(section)) {
      errors.push(`${doc.file} missing required content: ${section}`);
    }
  }
}

const certification = fs.existsSync(path.join(root, "docs/PORTFOLIO-OS-V1-CERTIFICATION.md"))
  ? fs.readFileSync(path.join(root, "docs/PORTFOLIO-OS-V1-CERTIFICATION.md"), "utf8")
  : "";

for (const phrase of [
  "GO:",
  "NO-GO:",
  "Dry-run planning",
  "Live tool execution",
  "Certification Version: Portfolio OS V1"
]) {
  if (!certification.includes(phrase)) {
    errors.push(`certification verdict missing: ${phrase}`);
  }
}

if (errors.length > 0) {
  console.error(JSON.stringify({ ok: false, errors }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  certification: "Portfolio OS V1",
  documentsValidated: requiredDocs.map((doc) => doc.file)
}, null, 2));

