# Project Status Matrix

Status date: 2026-06-24  
Evidence basis: repositories accessible through the current GitHub connection. Projects outside that connection are marked unverified.

| Project | GitHub evidence | Current implementation state | Safe next task | Owner-blocked or production-blocked items |
| --- | --- | --- | --- | --- |
| Meta-Agent | `dzinh1901-lang/meta-agent`; no open issue or PR found before this review; GTC review branch `codex/portfolio-gtc-review` | Supervisory control-plane package with policy, approval packets, portfolio registry, monitoring, and deterministic local workflows | Add current read-only GitHub discovery and keep registry/status evidence fresh | Production side effects, credentials, spending, deployment, external communication, and self-approval remain prohibited |
| AgentOps Runtime | `dzinh1901-lang/agentops-runtime`; main includes merged NemoClaw local/staging integration; no open issue or PR found before this review; GTC branch `codex/gtc-taipei-2026-application` | Local/staging governed runtime with registries, Tool Gateway and Approval Gate concepts, API/dashboard surfaces, deterministic tests, and NemoClaw worker contracts | Land sandbox/network/credential/budget/task-digest controls, then bind approvals and staging dispatch to them | Production identity/RBAC, hardened adapters, durable datastore/audit, immutable approvals, staging proof, live credentials, and paid execution |
| AURELEAN | `dzinh1901-lang/aurelean-app`; no open issue or PR found before this review; GTC branch `codex/gtc-portfolio-review` | Working MVP/prototype for textile sourcing, RFQ, quote, messaging, admin evidence, and provider-disabled integrations | Keep AI provider-neutral; complete hosted deployment evidence, production identity/RBAC, database cutover, tenant ownership, and observability first | Environment secrets, hosted deployment, target-database validation/cutover, confidential production use, supplier awards, external messages, and live AI/provider activation |
| Meridian Yacht Atelier | `dzinh1901-lang/meridian-yacht-atelier`; open Issue #5; no open PR found before this review; GTC branch `codex/gtc-portfolio-review` | Client portal/design studio plus a cinematic vertical slice; current cinematic code still exposes provider-specific contracts and prototype adapters | Complete Issue #5: pure domain core, provider-neutral ports, typed contracts, connector registry, routing policy, deterministic fake agents/connectors, and focused tests | Live provider calls, production credentials, paid generation, RTX Spark or Cosmos dependency, release/publication without existing human gates |
| VDS DesignOS | Not available through the current GitHub connection | Historical registry entry only; current implementation and issue/PR state are unverified | Reconnect or provide direct repository evidence before routing work | All status, deployment, credential, billing, and production claims remain unverified |
| Monsieur App | Not available through the current GitHub connection | Historical registry entry only; canonical repository and current state are unverified | Confirm the canonical repository and connect it before routing work | All implementation, commerce, Stripe, credential, and production actions remain blocked pending evidence |

## Portfolio Status

The connected portfolio supports governed planning, review, deterministic local/staging workflows, and draft repository changes. It does not yet provide a production-grade autonomous execution plane.

The GTC Taipei 2026 review confirms the current separation of responsibilities:

- Meta-Agent supervises and prepares decisions.
- AgentOps Runtime owns secure execution, tools, skills, approvals, traces, and evaluation.
- Application repositories own provider-neutral domain contracts and human-controlled workflows.

OpenShell, NemoClaw, Nemotron, CUDA-X skills, RTX Spark, Cosmos, DSX, and Vera Rubin must remain evidence-backed options rather than implied deployed capabilities.
