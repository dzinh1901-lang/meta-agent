# Repository Inventory Snapshot

Date: 2026-06-15
Owner: `dzinh1901-lang`

This is the initial seed inventory for the Meta Chief of Staff Agent. Detailed source inspection is confirmed for `aurelean-app` and `designOS-App`. Other repositories are present in the visible repository list and should be treated as `pending_discovery` until their files are inspected.

## Visible Repositories

| Repository | Domain Guess | Oversight Status |
|---|---|---|
| dzinh1901-lang/auren-studio | studio/product surface | pending_discovery |
| dzinh1901-lang/materials-intelligence | materials intelligence | pending_discovery |
| dzinh1901-lang/robotics-intelligence | robotics intelligence | pending_discovery |
| dzinh1901-lang/oatip | project/application | pending_discovery |
| dzinh1901-lang/naval-defence-catalogue | regulated/defense catalogue | restricted_pending_legal_compliance_review |
| dzinh1901-lang/pelagia | marine/project | pending_discovery |
| dzinh1901-lang/cfd-engineering-studio | engineering simulation/studio | pending_discovery |
| dzinh1901-lang/vectora | project/application | pending_discovery |
| dzinh1901-lang/seastates | marine/weather/ocean intelligence | pending_discovery |
| dzinh1901-lang/vectormaris | marine/vector intelligence | pending_discovery |
| dzinh1901-lang/faraday | engineering/energy project | pending_discovery |
| dzinh1901-lang/stem-study-platform | education platform | pending_discovery |
| dzinh1901-lang/ionforge | engineering/materials project | pending_discovery |
| dzinh1901-lang/harborgrid | marine/logistics project | pending_discovery |
| dzinh1901-lang/designOSweb | DesignOS web surface | pending_discovery |
| dzinh1901-lang/illustre-studio | creative/studio project | pending_discovery |
| dzinh1901-lang/illustre | creative project | pending_discovery |
| dzinh1901-lang/IO | platform/project | pending_discovery |
| dzinh1901-lang/global-market-intelligence | market intelligence | pending_discovery |
| dzinh1901-lang/IO-landing-page | landing page | pending_discovery |
| dzinh1901-lang/vireo | project/application | pending_discovery |
| dzinh1901-lang/Meridianstudio | studio/project | pending_discovery |
| dzinh1901-lang/designOS-App | production DesignOS app | known_project_orchestrator |
| dzinh1901-lang/aurelean-app | B2B textile sourcing/RFQ/procurement platform | known_project_orchestrator |
| dzinh1901-lang/monsieur-app | commerce/app project | pending_discovery |
| dzinh1901-lang/meridian-yacht-atelier | marine/yacht atelier | pending_discovery |
| dzinh1901-lang/designos-orchestrator-v2 | orchestration/runtime project | pending_discovery |
| dzinh1901-lang/agentops-runtime | agent operations runtime | pending_discovery |

## Discovery File Targets

For every repository, inspect:

- README.md
- package.json
- PRD.md
- ROADMAP.md
- TASKS.md
- docs/agents/SUBAGENTS.md
- .claude/agents/*.md
- .claude/agents/registry.json
- .codex/agents.registry.json
- CI/workflow files
- launch/readiness/evidence docs

## Known Orchestrators

| Repository | Orchestrator | Path | Notes |
|---|---|---|---|
| dzinh1901-lang/aurelean-app | AURELEAN Orchestrator | `.claude/agents/aurelean-orchestrator.md` | Approval required; routes to project sub-agents; cannot self-approve |
| dzinh1901-lang/aurelean-app | Codex Orchestrator | `.codex/agents/codex-orchestrator.md` | Critical risk; can plan/edit/validate/prepare PR; cannot self-approve or mutate production |
| dzinh1901-lang/designOS-App | VDS / DesignOS Orchestrator | `.claude/agents/vds-orchestrator.md` | Approval required; routes work across DesignOS project sub-agents |

## Inventory Rules

- Unknown means unknown, not low-risk.
- Regulated-domain repositories must remain restricted until reviewed.
- Repository status claims require evidence.
- Repository-level policies are authoritative for project behavior.
