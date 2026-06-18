# Comprehensive Audit — Meta Chief of Staff Agent

Date: 2026-06-18  
Scope: `meta-chief-of-staff-agent/`  
Audit branch: `audit/phase4-agents-sdk-2026-06-18`

## Executive finding

The repository has progressed beyond a design-only scaffold. It now contains a deterministic governance core, repository-orchestrator adapters, task and approval packet workflows, multi-role approval queues, procurement oversight, typed state interfaces, specialist Agents SDK agents, a root manager agent, and an interactive human-in-the-loop CLI.

The implementation is suitable for local development, deterministic policy testing, and approval-gated demonstrations. It is not yet suitable for autonomous production operation. Production deployment remains blocked by incomplete live repository discovery, non-durable identity and state, absence of hardened external adapters, and lack of production observability and authorization infrastructure.

## Scope reviewed

- Product requirements, architecture, roadmap, milestones, governance, and risk register
- Repository and orchestrator registries
- Risk classification, approval policy, and tool guardrails
- Task, approval, project-health, agent-run, and procurement schemas
- Task/approval packet generation and run-state transitions
- Repository-orchestrator compatibility and portfolio routing
- Procurement readiness and vendor-risk workflows
- State-store abstraction and in-memory implementation
- OpenAI Agents SDK tools, specialist agents, and manager pattern
- Human-in-the-loop interruption and resume flow
- Package scripts, TypeScript configuration, deterministic tests, and CI

## Stage status

| Stage | Status | Audit conclusion |
|---|---|---|
| Stage 0 — Design package and guardrails | Complete | Design artifacts, deterministic scaffold, policies, schemas, validation, and dry run exist. |
| Stage 1 — Read-only portfolio discovery | Partial | Seed registry exists, but the runtime does not yet fetch and evidence standard files from every repository. |
| Stage 2 — Orchestrator compatibility | Substantially complete | Known orchestrators are normalized through adapters; unknown repositories produce discovery-required routes. |
| Stage 3 — Human authorization queue | Substantially complete for local use | Task packets, approval packets, multi-role queue records, run pause/resume, and SDK interruptions exist. Durable production identity and state remain absent. |
| Stage 4 — Procurement oversight pilot | Implemented on audit branch | Research, shortlist, award, contract, and payment intents are classified; incomplete commitments and restricted requests fail closed; approval packets are repository, budget, intent, and vendor scoped. |
| Stage 5 — Marketing oversight pilot | Not implemented | Specialist prompt exists, but deterministic campaign, claims, attribution, privacy, and send/spend packet workflows do not. |
| Stage 6 — Controlled GitHub writes | Not implemented by design | No issue, pull request, merge, deployment, billing, or production mutation adapter executes an external side effect. |
| Stage 7 — Portfolio dashboard | Not implemented | State interfaces can support it, but no dashboard/API is included here. |
| Stage 8 — Production supervision | Not ready | Scheduled scans, durable audit storage, production authentication, alerting, and operational runbooks remain open. |

## Findings by severity

### Critical — none introduced by the audited branch

The branch preserves the intended hard stops: no secret access, self-approval, pull-request merge, deployment trigger, production mutation, autonomous vendor award, autonomous spend, or regulated/controlled-goods procurement execution.

### High

#### H1. Live repository discovery is not evidence-complete

The portfolio registry is seed-based. The runtime can list configured repositories and route deterministic packets, but it cannot yet fetch README, package scripts, PRDs, roadmaps, agent registries, workflows, CI status, or launch evidence from every repository. Stage 1 exit criteria are therefore not met.

**Required remediation:** add an authenticated, read-only GitHub adapter with path allowlists, content-size limits, binary rejection, secret-pattern suppression, evidence hashes, and confidence scoring.

#### H2. Approval identity is local configuration, not production authentication

The interactive CLI derives operator identity and approver roles from environment variables. This is appropriate for local demonstrations, but it is not an identity provider, RBAC service, or multi-party signature system.

**Required remediation:** bind approvals to authenticated user identities and immutable role assignments. Critical actions should require distinct approvers where policy requires separation of duties.

#### H3. State and audit storage are not durable or append-only

`InMemoryStateStore` is process-local and allows replacement/deletion. Approval packets, queue records, agent runs, and audit events can be lost on restart and are not immutable.

**Required remediation:** implement a Postgres/Supabase adapter, append-only audit events, optimistic concurrency, retention policy, encryption, and migration/version controls.

#### H4. No hardened external execution adapters exist

This is currently a safety feature, not a defect: `queue_controlled_action` records authorization intent and explicitly reports that no external side effect executed. However, the product cannot yet create a GitHub issue or draft pull request after approval.

**Required remediation:** implement one narrowly scoped GitHub App adapter in Stage 6. Validate approval packet ID, action, repository, environment, expiry, approver roles, and exact payload immediately before execution. Maintain idempotency and rollback evidence.

### Medium

#### M1. JavaScript governance core and TypeScript SDK layer duplicate runtime boundaries

The deterministic core is CommonJS JavaScript while the SDK layer is TypeScript using NodeNext interop. The design works, but duplicated type boundaries increase drift risk.

**Remediation:** migrate the deterministic core to typed TypeScript or publish explicit declaration files and shared Zod schemas.

#### M2. Local session memory is not durable conversation memory

The CLI uses `MemorySession`, which is appropriate for demos and tests but resets at process exit. A serialized `RunState` can resume a paused run, but prior completed conversation history is not durable across restarts.

**Remediation:** use a production `Session` implementation backed by durable storage or OpenAI Conversations, with retention and privacy controls.

#### M3. Repeated identical deterministic inputs can reuse IDs

Stable content hashes intentionally make packet creation idempotent. Identical requests with identical correlation inputs can collapse to the same IDs even when the operator intended a separate business event.

**Remediation:** distinguish idempotency key from event ID. Require a request nonce or caller-provided idempotency key for separate events.

#### M4. Dependency lockfile is absent

The package now pins the Agents SDK and development tool versions, but a lockfile is not yet committed.

**Remediation:** generate and commit `package-lock.json`, then use `npm ci --ignore-scripts` in CI.

#### M5. Marketing oversight is prompt-only

A Marketing Oversight Agent exists, but there is no deterministic campaign schema or workflow for claim evidence, attribution readiness, UTM taxonomy, privacy checks, public-send approval, or paid-spend approval.

**Remediation:** implement Stage 5 before exposing marketing integrations.

### Low

#### L1. Readiness documentation was behind implementation

Phase 4 and Agents SDK files existed without package wiring, root manager construction, or complete validation. This branch aligns scripts, manager graph, validation, CI, and audit documentation.

#### L2. In-memory timestamps are not clock-injectable

State-store timestamps use wall-clock time, which makes exact timestamp assertions harder.

**Remediation:** inject a clock into production and test state-store implementations.

## Implementations completed in this audit branch

### Agents SDK control plane

- Added a root `Meta Chief of Staff Agent` using the manager-as-tools pattern.
- Exposed six specialist agents as manager tools: cross-repository, procurement, marketing, finance, security/compliance, and audit/evidence.
- Added a typed context with operator identity, operator roles, environment, authorized repositories, registry, and state store.
- Added read-only control-plane snapshot tooling.
- Hardened `queue_controlled_action` so it loads and validates the referenced internal approval packet before recording authorization intent.
- Added an interactive CLI with `MemorySession`, SDK approval interruptions, explicit approve/reject prompts, serialized `RunState`, and resume support.
- Added a non-network SDK graph smoke test.

### Procurement oversight

- Added procurement completeness gates for shortlists, awards, contracts, and payments.
- Added selected vendor, legal/compliance review, security review, contract, and purchase-order references.
- Distinguished hard policy blocks from readiness blocks.
- Added deterministic vendor IDs and vendor risk scoring.
- Scoped approval packets to repository, action type, intent, maximum budget, currency, allowed vendors, and selected vendor.
- Preserved `external_side_effect_executed: false`, autonomous spend false, and autonomous vendor award false.

### Verification

- Added Stage 4 scripts and tests.
- Expanded validator coverage to Phase 4, the SDK manager graph, approval interruption, approval packet lookup, and resumable run state.
- Added GitHub Actions verification using Node.js 22.
- Pinned `@openai/agents` to the audited SDK version and added TypeScript/Zod tooling.

## Architecture assessment

The manager-as-tools pattern is appropriate because the Chief of Staff must retain control of the user conversation and enforce one governance boundary while invoking specialist agents. Sensitive tool calls use the SDK's approval interruption mechanism; the run pauses before execution and can resume from `RunState` after an explicit human decision.

The deterministic policy engine remains the source of truth for action classification. The LLM may propose or explain actions, but it cannot redefine risk, required roles, hard blocks, or execution scope.

## Release gates

The branch may be merged when:

1. `npm run verify` passes in GitHub Actions.
2. Phase 2, Phase 3, and Phase 4 deterministic tests pass.
3. TypeScript type checking passes.
4. SDK graph smoke test confirms root and specialist tools.
5. No workflow performs an external side effect.
6. Audit findings H1–H4 remain documented as production blockers.

## Recommended next implementation sequence

1. Finish Stage 1 with an authenticated read-only GitHub discovery adapter and evidence-backed project health.
2. Add durable state and authenticated approval identity.
3. Implement Stage 5 deterministic marketing oversight.
4. Add a narrow, approval-gated GitHub issue/draft-PR adapter in Stage 6.
5. Build the dashboard/API only after durable state and authorization are established.
