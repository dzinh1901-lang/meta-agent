# Portfolio Registry

Purpose: define the canonical portfolio that the Meta-Agent supervises.

Status: active draft.  
Status date: 2026-06-24.

Source of truth: `config/portfolio.registry.json`.

## Operating Rule

The Meta-Agent may plan, review, route, draft, prepare, validate, and report. It may not deploy, spend money, alter secrets, send external communications, modify production systems, or approve production-risk changes without explicit owner approval.

Repository state must come from current direct evidence. When a repository is inaccessible, the registry must mark it unverified instead of preserving an old inferred status.

## Connected Active Projects

| Project | Repository | Product role | Current status | Next milestone |
| --- | --- | --- | --- | --- |
| AgentOps Runtime | `dzinh1901-lang/agentops-runtime` | Governed execution infrastructure | Active local/staging prototype | Land GTC runtime-control contracts; bind approvals and staging dispatch to exact policy evidence |
| Meta-Agent | `dzinh1901-lang/meta-agent` | Portfolio control plane | Active local package | Add current read-only GitHub discovery and evidence freshness reporting |
| AURELEAN | `dzinh1901-lang/aurelean-app` | Textile sourcing and RFQ platform | Active MVP/prototype | Complete deployment, identity/RBAC, database, ownership, and observability gates before live AI activation |
| Meridian Yacht Atelier | `dzinh1901-lang/meridian-yacht-atelier` | Client portal, design workflow, and cinematic connector | Active; Issue #5 open | Complete provider-neutral Cinematic Connector Phase 1 with deterministic fake adapters |

## Historical or Unverified Entries

| Project | Repository | Status rule |
| --- | --- | --- |
| VDS DesignOS | `microsoft-lang1901/vds-designos` | Not available in the current GitHub connection; do not route work or claim current readiness without new evidence |
| Monsieur App | `dzinh1901-lang/monsieur-app` | Not available in the current GitHub connection; canonical repository and implementation state remain unverified |

## Governance Fields

Every registry entry must include `id`, `name`, `repository`, `localPath`, `role`, `status`, `currentMilestone`, `owner`, `riskLevel`, `productionReadiness`, `dependencies`, and `blockers`.

## Update Rules

- Record blockers instead of guessing.
- Keep owner-only actions separate from executable agent work.
- Treat any production, billing, external communication, migration, provider activation, hardware purchase, or secret-bearing task as approval-gated.
- Distinguish local/staging implementation, provider-disabled scaffolding, evaluation candidates, and production-proven capabilities.
- Store evidence date and source confidence whenever project status is refreshed.
- Apply the GTC Taipei 2026 decision in `docs/GTC_TAIPEI_2026_PORTFOLIO_DECISION.md` when routing agent-runtime, model, skill, hardware, or physical-AI work.
