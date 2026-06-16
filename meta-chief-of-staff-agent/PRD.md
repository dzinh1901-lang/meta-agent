# Product Requirements Document: Meta Chief of Staff Agent

## 1. Product Name

**Meta Chief of Staff Agent**

Working codename: **COSMOS** — Cross-Orchestrator Supervisory Meta Operating System.

## 2. Product Summary

The Meta Chief of Staff Agent is a portfolio-level AI operations system for supervising all current GitHub-hosted projects. It maintains a live registry of repositories, project stages, repository-level orchestrators, sub-agent roles, approval gates, procurement and marketing workflows, launch readiness, risks, blockers, and milestone progress.

The system must operate with explicit human-in-the-loop authorization. It can inspect, plan, route, propose, summarize, and escalate. It must not unilaterally approve high-risk decisions, spend money, mutate production systems, publish external communications, award vendors, bypass repository-specific agents, or override security/compliance gates.

## 3. Background and Current State

The current portfolio already shows the beginnings of project-level AI operations:

- AURELEAN has a project-level orchestrator and a detailed sub-agent system for intake, verification, procurement intelligence, RFQ lifecycle, supplier risk, quote analysis, approval governance, communications, billing, audit/evidence, and frontend implementation.
- AURELEAN also contains a Codex-oriented registry with additional product, security, live-services, QA, and documentation agents.
- DesignOS has its own VDS / DesignOS orchestrator and project-level sub-agent architecture spanning product architecture, frontend dashboard, design system, studio brain, memory governance, visualization, BIM/CAD, material intelligence, client presentation, agent runtime, Supabase persistence, billing, security, live services, QA, and documentation.
- The portfolio includes many other repositories that are visible but not yet inventoried in detail. They require a read-only discovery pass before the Meta Agent can make reliable stage, risk, and ownership claims.

The next logical layer is not another domain agent. It is a **portfolio control plane** that sees all projects, understands each project's local agent contract, and coordinates cross-project priorities without destroying project-level ownership.

## 4. Problem Statement

Current projects can each define their own orchestrators and sub-agents, but there is no single supervised operating layer that can:

1. Maintain a normalized inventory of all repositories and project states.
2. Identify which projects have orchestrators, sub-agents, release gates, PRDs, roadmaps, tests, and production blockers.
3. Route project work to the correct repository orchestrator rather than acting as a general-purpose agent.
4. Coordinate cross-cutting functions such as procurement, marketing, billing, security, launch readiness, and evidence collection.
5. Produce human-readable approval packets for sensitive decisions.
6. Preserve traceability across project-level agent runs, validation outputs, PRs, issues, and human approvals.
7. Prevent authority creep where an agent bypasses local policies, self-approves, spends money, publishes externally, or mutates production without approval.

## 5. Target Users

### Primary Human Users

- Founder / principal operator
- Product owner
- Engineering lead
- GTM / marketing lead
- Procurement / finance approver
- Security / compliance reviewer
- Repository maintainer

### AI/System Users

- Repository-level orchestrator agents
- Specialist sub-agents inside each project
- CI/validation agents
- Audit/evidence agents
- Procurement, marketing, and billing agents

## 6. Product Goals

### G1. Portfolio Oversight

Provide a unified view of every repository, project stage, current blockers, known orchestrator, known sub-agent registry, validation status, launch readiness, and high-risk pending actions.

### G2. Cross-Orchestrator Authority

Allow the Meta Chief of Staff Agent to supervise and coordinate all repository-level orchestrators while respecting their boundaries. It may create task packets, request execution plans, ask for status reports, pause or flag unsafe work, and compile final synthesis. It may not self-approve sensitive actions.

### G3. Human Authorization System

Convert every high-risk or critical action into a structured approval packet containing action type, affected repositories, proposed owner, risk, cost, customer/supplier impact, data impact, rollback plan, validation evidence, and decision options.

### G4. Procurement Oversight

Track procurement requests, vendor research, supplier selection, procurement budgets, contract status, risk flags, and human approval requirements. Procurement in regulated domains must remain restricted and legal/compliance-gated.

### G5. Marketing Oversight

Coordinate campaign planning, lead lifecycle strategy, launch readiness, content reviews, claims guardrails, attribution readiness, and public communication approvals across projects.

### G6. Evidence and Audit

Persist an evidence ledger for agent runs, task routing, approvals, denials, validation outputs, PR links, issue links, release decisions, procurement decisions, and campaign approvals.

### G7. Staged Adoption

Start read-only and deterministic. Add write/routing behavior only after registry completeness, policy validation, and human approval workflows exist.

## 7. Non-Goals

The Meta Chief of Staff Agent must not:

- Replace repository-level orchestrators.
- Perform specialist product/engineering work when a project sub-agent owns the domain.
- Directly deploy production changes.
- Approve its own actions.
- Spend money, award vendors, or initiate procurement without approval.
- Send customer, supplier, investor, partner, or public marketing messages without approval.
- Make legal, financial, HR, regulated-domain, or export-control decisions autonomously.
- Access secrets or service-role credentials.
- Generate or assist with weapons procurement, controlled goods procurement, or operational defense instructions.
- Claim validation, approvals, or evidence exists when it has not been recorded.

## 8. Personas and Use Cases

### Persona A: Founder / Principal Operator

Needs a single command view showing all active projects, blockers, milestones, risks, and approval requests.

Use cases:

- “What projects are blocked this week?”
- “Which repos are ready for launch?”
- “Prepare the approval packets I need to review today.”
- “Rank projects by readiness and commercial value.”

### Persona B: Repository Maintainer

Needs the Meta Agent to respect repository boundaries and route work to the local orchestrator.

Use cases:

- “Send DesignOS launch-readiness work to the VDS orchestrator.”
- “Ask AURELEAN for a procurement/RFQ readiness report.”
- “Do not let portfolio-level changes override repo policy.”

### Persona C: Marketing Lead

Needs campaign planning and review, but no unsupervised public publishing.

Use cases:

- “Create campaign briefs across DesignOS and AURELEAN.”
- “Check if attribution and UTM governance are ready before paid scale.”
- “Flag unverified product claims.”

### Persona D: Procurement / Finance Approver

Needs visibility into vendor requests, contracts, spend, and approvals.

Use cases:

- “Show all vendor decisions requiring approval.”
- “Block procurement over threshold until budget owner signs.”
- “Generate a supplier/vendor risk brief.”

## 9. Functional Requirements

### FR1. Repository Registry

The system shall maintain a `repositories.seed.json` registry with one record per known GitHub repository. Each record must include repository full name, default branch, domain guess, oversight status, known orchestrator path, known approval policy, and required next discovery files.

### FR2. Discovery Pass

The system shall support a read-only discovery pass that attempts to locate:

- `README.md`
- `package.json`
- `PRD.md`
- `ROADMAP.md`
- `TASKS.md`
- `.claude/agents/*.md`
- `.claude/agents/registry.json`
- `.codex/agents.registry.json`
- `docs/agents/SUBAGENTS.md`
- validation scripts
- release or launch readiness documents

### FR3. Project Health Records

The system shall produce a normalized project-health object for each repository with:

- stage
- active blockers
- next milestone
- risk level
- orchestrator coverage
- validation commands
- security/tenant/billing/production gates
- marketing readiness
- procurement readiness
- evidence status

### FR4. Task Packet Routing

The system shall create task packets for repository-level orchestrators. A task packet must include objective, repository, target orchestrator, risk, requested outputs, approval requirements, validation requirements, due date, and audit correlation ID.

### FR5. Orchestrator Registry

The system shall distinguish:

- portfolio-level chief agent
- repository-level orchestrator agents
- repository-level specialist sub-agents
- global/operator-only drafting agents

Portfolio-level policy must not be confused with project product behavior unless committed to the target repository and reviewed.

### FR6. Human Authorization Packets

The system shall create approval packets for actions classified as high or critical, including production deployment, live billing, credential activation, procurement commitment, paid marketing spend, external communication, supplier/client message, legal/compliance-sensitive decision, data export, or regulated-domain work.

### FR7. Approval Decision Ledger

The system shall record approvals and rejections with decision ID, approver role, timestamp, action scope, expiration, constraints, and evidence bundle hash.

### FR8. Procurement Oversight

The system shall track vendor/supplier requests, budget owner, estimated cost, domain risk, alternative options, contract status, legal review status, and award recommendation. Any procurement award must require human approval. Regulated, controlled, or defense-related procurement must be blocked unless legal/compliance review explicitly authorizes a permitted administrative workflow.

### FR9. Marketing Oversight

The system shall generate marketing campaign plans, but all external/public sends must require approval. The system must flag unverified claims, missing attribution, missing UTM taxonomy, privacy risks, and spend before measurement readiness.

### FR10. Cross-Project Milestone Planning

The system shall maintain milestone plans across projects, including portfolio-wide stage gates:

- discovery complete
- orchestrator inventory complete
- read-only dashboard complete
- approval packet workflow complete
- procurement/marketing oversight complete
- controlled write/routing pilot complete
- production supervision readiness complete

### FR11. Risk Policy Engine

The system shall classify every proposed action as low, medium, high, or critical and map it to required approval roles.

### FR12. Audit and Traceability

Every meta-agent action shall produce an audit event. Every delegated task shall preserve a correlation ID across task packet, repository orchestrator response, validation evidence, approval packet, and final synthesis.

### FR13. Dry-Run Mode

All actions shall default to dry-run/read-only until explicit authorization enables limited write/routing behavior.

### FR14. Failure Handling

The system shall fail closed when repository policy is missing, risk cannot be classified, requested authority is unclear, a secret is requested, an approval is missing, or a regulated-domain request appears.

## 10. Non-Functional Requirements

### NFR1. Security

- No secret access by default.
- No service-role key exposure.
- No production mutation without approval.
- No agent self-approval.
- Role-based approval routing.
- Immutable audit events or append-only log design.

### NFR2. Reliability

- Deterministic policy engine for approval gating.
- Idempotent task packet generation.
- Retry-safe discovery.
- Evidence hash for approval packets.

### NFR3. Observability

- Trace every agent run, handoff, guardrail result, approval interruption, and output packet.
- Maintain dashboard-ready project health summaries.

### NFR4. Maintainability

- Repository registry stored as JSON.
- Approval and task packet schemas stored as JSON Schema.
- Policy matrix stored in YAML or equivalent typed config.
- Agents defined as Markdown with front matter to match existing project-level conventions.

### NFR5. Compliance

- Procurement, billing, contract, legal, regulated, and public-claim decisions require human review.
- Marketing claims must be evidence-backed.
- Supplier/client communications require approval.
- Data export and customer/supplier PII use require explicit authorization.

## 11. System Roles

### Meta Chief of Staff Agent

Owns portfolio intake, planning, prioritization, routing, approvals queue, milestone synthesis, and escalation.

### Cross-Repository Orchestrator

Owns repository discovery, task packet routing, repo health status normalization, and local-orchestrator compatibility.

### Procurement Oversight Agent

Owns vendor/supplier intake, procurement risk, budget approval packet drafting, and procurement evidence tracking.

### Marketing Oversight Agent

Owns campaign strategy, attribution readiness, lifecycle planning, claims checks, and handoff to project marketing agents.

### Finance Ops Agent

Owns budget thresholds, spend approvals, vendor payment readiness, and finance evidence packets.

### Security Compliance Agent

Owns secrets policy, tenant/auth/billing gates, production go-live gating, regulated-domain restrictions, and privacy controls.

### Audit Evidence Agent

Owns evidence ledger structure, validation artifact indexing, approval packet hashes, and final audit reports.

## 12. Authority Model

| Capability | Meta Chief Agent | Repository Orchestrator | Human Approver |
|---|---:|---:|---:|
| Inspect repository metadata | Yes | Yes | Yes |
| Maintain portfolio registry | Yes | No | Yes |
| Route work packets | Yes | Receives | Yes |
| Call repository sub-agents | Through orchestrator only | Yes | N/A |
| Draft procurement plan | Yes | Project-specific | Yes |
| Approve procurement award | No | No | Yes |
| Draft marketing plan | Yes | Project-specific | Yes |
| Publish external marketing | No | No | Yes |
| Propose production launch | Yes | Yes | Yes |
| Promote production | No | No | Yes |
| Approve own action | No | No | No |
| Access secrets | No | No by default | Authorized humans only |
| Override repo policy | No | No | Only through reviewed PR/policy update |

## 13. Key User Stories

1. As a founder, I want the Chief of Staff Agent to show a unified status board for all repositories so I can decide what to fund, ship, pause, or review.
2. As an engineering lead, I want cross-repo requests routed to local orchestrators so the portfolio layer does not bypass project-specific policies.
3. As a procurement approver, I want every vendor/supplier decision converted into an approval packet so no spend or award happens accidentally.
4. As a marketing lead, I want campaign plans checked for claims, privacy, attribution, and spend controls before public launch.
5. As a security reviewer, I want high-risk actions paused with evidence and rollback plans before execution.
6. As a repository maintainer, I want project policies to travel with the repository, not live only in a personal/global agent environment.

## 14. Success Metrics

### Operational Metrics

- 100% of visible repositories have a registry record.
- 100% of known orchestrators have a mapped authority profile.
- 100% of high/critical actions generate approval packets.
- 0 instances of self-approval.
- 0 public/external messages sent without approval.
- 0 production mutations without approval.

### Quality Metrics

- >= 90% of repository health records pass schema validation.
- >= 95% of task packets contain validation criteria and rollback/exit criteria.
- Every approval packet includes affected repos, risk, approver role, evidence, and decision options.

### Business Metrics

- Reduced project status review time.
- Faster identification of launch blockers.
- Clearer procurement and marketing decision queues.
- More consistent milestone planning across projects.

## 15. MVP Scope

### MVP Included

- Seed repository registry.
- Markdown agent definitions.
- PRD, architecture, roadmap, milestones, and governance documents.
- Approval matrix and risk policy.
- JSON schemas for task packets, approval packets, project health, and agent runs.
- Deterministic Node.js scaffold for risk classification and approval packet generation.
- Dry-run script and validation script.

### MVP Excluded

- Live GitHub write actions.
- Live procurement integrations.
- Live marketing publication.
- Live billing, Stripe, Supabase, or deployment mutation.
- Production dashboard UI.
- Autonomous budget approval.
- Autonomous regulated-domain procurement.

## 16. MVP Acceptance Criteria

- Project folder can be committed as a standalone agentops project.
- `npm run validate` succeeds.
- `npm run dry-run` produces a sample high-risk approval packet.
- Repository registry includes all currently visible repositories.
- Known AURELEAN and DesignOS orchestrators are represented.
- Risk policy defaults to read-only/dry-run.
- High and critical actions require human approval.
- No file grants self-approval authority.

## 17. Future Enhancements

- GitHub App integration for issue/PR creation with approval gates.
- Portfolio dashboard with health cards and approval queue.
- CI-driven project-health ingestion.
- Agent tracing exporter.
- Slack/Email approval notifications.
- Supabase-backed evidence ledger.
- Cross-project dependency graph.
- Budget and vendor system integration.
- Marketing CRM attribution integration.
- Fine-grained approver roles and multi-signature approvals.
