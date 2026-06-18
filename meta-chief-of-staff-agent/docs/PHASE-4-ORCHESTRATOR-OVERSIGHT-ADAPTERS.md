# Phase 4: Orchestrator and Oversight Adapters

## Status

Implemented on `audit/phase4-agents-sdk-2026-06-18` and verified by the repository CI workflow.

## Agent graph

The top-level `metaChiefOfStaffAgent` is created with the OpenAI Agents SDK and registers six explicit handoffs:

1. `handoff_to_cross_repository_orchestrator`
2. `handoff_to_procurement_oversight`
3. `handoff_to_marketing_oversight`
4. `handoff_to_finance_ops`
5. `handoff_to_security_compliance`
6. `handoff_to_audit_evidence`

Each handoff accepts a Zod-validated payload containing:

- reason
- objective
- repositories
- action type when known
- priority
- evidence references

Before control transfers, the handoff callback verifies every repository is in `MetaAgentContext.authorizedRepositories` and persists a handoff record to both `handoffEvents` and `auditEvents`.

## Delegation model

The root agent retains general portfolio intake, prioritization, policy lookup, and approval-queue status. It transfers conversation ownership when a specialist needs to use domain-specific tools. The specialist receives the conversation history and the same application context.

Specialist agents remain available as `agent.asTool()` exports for future manager-controlled consultation, but the root runtime uses handoffs rather than specialist agent tools.

## Cross-Repository Orchestrator

Responsibilities:

- inspect repository and orchestrator compatibility
- identify unknown or restricted repositories
- build one bounded workflow per repository
- prepare dry-run dispatch objects
- normalize repository-orchestrator responses against stored task packets

Narrow tools:

- `get_portfolio_registry`
- `inspect_orchestrator_compatibility`
- `classify_action`
- `build_task_workflow`
- `build_portfolio_routing_plan`
- `normalize_orchestrator_response`

## Procurement Oversight Agent

Responsibilities:

- classify procurement intent and readiness
- compare vendor risk
- identify budget, legal, security, and commitment gates
- prepare procurement briefs and approval artifacts

Narrow tools:

- `classify_procurement_request`
- `compare_vendors`
- `build_procurement_workflow`
- `queue_controlled_action`

No tool awards a vendor, signs a contract, issues a purchase order, contacts a supplier, or commits payment.

## Marketing Oversight Agent

Responsibilities:

- review claim evidence
- validate landing URL, UTM fields, and attribution events
- identify privacy and legal requirements
- prepare campaign briefs and approval artifacts

Narrow tools:

- `review_marketing_claims`
- `validate_attribution_readiness`
- `build_marketing_campaign_brief`
- `queue_controlled_action`

No tool publishes content, sends outreach, uploads an audience, or commits paid media spend.

## Finance Ops Agent

Responsibilities:

- calculate projected utilization and remaining budget
- identify over-budget exceptions
- identify billing security-review requirements
- prepare finance approval requirements

Narrow tools:

- `build_budget_review`
- `classify_action`
- `build_task_workflow`
- `queue_controlled_action`

No tool activates billing or commits payment.

## Security Compliance Agent

Responsibilities:

- enforce secret, authentication, tenant, privacy, production, data-export, and regulated-domain policy
- identify hard blocks and missing evidence
- prepare scoped security approval requirements

Narrow tools:

- `get_policy_summary`
- `classify_action`
- `build_security_review`
- `build_task_workflow`

Hard blocks cannot be overridden by normal action approval.

## Audit Evidence Agent

Responsibilities:

- summarize only records present in the configured StateStore
- report pending approvals and correlated workflow IDs
- identify missing evidence and evidence limitations

Narrow tools:

- `build_audit_summary`
- `get_control_plane_snapshot`
- `get_policy_summary`
- `get_portfolio_registry`

The audit agent cannot mutate approval decisions or infer external execution from missing records.

## Authorization enforcement

The implementation respects the authorization matrix through three layers:

1. Deterministic action classification and hard-block policy
2. Repository authorization checks in SDK tools and handoff callbacks
3. SDK `needsApproval` interruption for controlled-action authorization records

`queue_controlled_action` validates the stored approval packet ID, action type, repository, expiry, constraints, environment, and current operator roles. It records authorization intent only and returns `external_side_effect_executed: false`.

## State collections

Phase 4 adds state collections for:

- orchestrator responses
- marketing workflows
- finance reviews
- security reviews
- handoff events

The current implementation uses `InMemoryStateStore`; durable storage remains a production gate.

## Verification

```bash
npm run test:phase4
npm run test:phase4:specialists
npm run typecheck
npm run sdk:smoke
npm run verify
```

The SDK smoke check verifies:

- six specialist agents
- six handoffs on the root manager
- no specialist agent tools attached directly to the root
- required narrow tool names on each specialist
- no external side effects

## Exit criteria

- Root agent delegates through six explicit handoffs.
- Each handoff is schema-validated, repository-authorized, and audited.
- Every specialist exposes narrow deterministic tools.
- Unknown repository authority fails closed to discovery.
- Sensitive controlled actions interrupt for human approval.
- No external side effect adapter executes.
- Repository CI passes deterministic tests, type checking, and SDK graph smoke checks.
