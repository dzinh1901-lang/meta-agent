# Portfolio Registry

Purpose: define the canonical portfolio that the Meta-Agent supervises.

Status: active draft.

Source of truth: `config/portfolio.registry.json`.

## Operating Rule

The Meta-Agent may plan, review, route, draft, prepare, validate, and report. It may not deploy, spend money, alter secrets, send external communications, modify production systems, or approve production-risk changes without explicit owner approval.

## Active Projects

| Project | Repository | Product role | Current status | Next milestone |
| --- | --- | --- | --- | --- |
| AgentOps Runtime | `dzinh1901-lang/agentops-runtime` | Execution infrastructure | Active | Runtime compatibility and subagent scaffolds |
| Meta-Agent | `dzinh1901-lang/meta-agent` | Portfolio control plane | Active local package | Registry, authority model, contracts |
| VDS DesignOS | `microsoft-lang1901/vds-designos` | First production candidate | Active | Production readiness review |
| Aurelean Platform | `dzinh1901-lang/aurelean-app` | Launch-closer platform | Active | Evidence checklist and owner actions |
| Meridian Yacht Atelier | `dzinh1901-lang/meridian-yacht-atelier` | Yacht procurement platform | Active | Client portal/backend PRD |
| Monsieur App | `dzinh1901-lang/monsieur-app` | Aelier Groupe commerce layer | Local folder, Git unconfirmed | Scope PRD or blocked record |

## Governance Fields

Every registry entry must include `id`, `name`, `repository`, `localPath`, `role`, `status`, `currentMilestone`, `owner`, `riskLevel`, `productionReadiness`, `dependencies`, and `blockers`.

## Update Rules

- Record blockers instead of guessing.
- Keep owner-only actions separate from executable agent work.
- Treat any production, billing, external communication, migration, or secret-bearing task as approval-gated.
