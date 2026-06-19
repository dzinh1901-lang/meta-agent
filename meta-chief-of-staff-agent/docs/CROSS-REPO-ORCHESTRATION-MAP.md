# Cross-Repo Orchestration Map

## Control Plane

Meta-Agent owns portfolio status, task routing, approval routing, evidence aggregation, and weekly reports.

## Execution Plane

AgentOps Runtime receives validated tasks, selects agents and skills, enforces approval gates, executes safe local work, and returns evidence.

## Repository Ownership

| Repository | Orchestrator | Status path |
| --- | --- | --- |
| `dzinh1901-lang/meta-agent` | Chief of Staff Meta-Agent | `docs/IMPLEMENTATION-SUMMARY.md` |
| `dzinh1901-lang/agentops-runtime` | Runtime Architect Agent | `docs/SUBAGENT-IMPLEMENTATION-STATUS.md` |
| `microsoft-lang1901/vds-designos` | Launch Readiness Agent | `docs/VDS-PRODUCTION-READINESS-REVIEW.md` |
| `dzinh1901-lang/aurelean-app` | Launch Readiness Agent | `docs/AURELEAN-LAUNCH-CLOSER.md` |
| `dzinh1901-lang/meridian-yacht-atelier` | Product Architect Agent | `docs/MERIDIAN-YACHT-ATELIER-PRD.md` |
| `dzinh1901-lang/monsieur-app` | Product Architect Agent | `docs/MONSIEUR-APP-PRD.md` |
