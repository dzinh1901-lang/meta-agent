# Agent Model

## Runtime hierarchy

```txt
Human operator / approvers
└── Meta Chief of Staff Agent
    ├── handoff -> Cross-Repository Orchestrator
    ├── handoff -> Procurement Oversight Agent
    ├── handoff -> Marketing Oversight Agent
    ├── handoff -> Finance Ops Agent
    ├── handoff -> Security Compliance Agent
    └── handoff -> Audit Evidence Agent

Cross-Repository Orchestrator
└── repository-level orchestrator adapter
    ├── AURELEAN Orchestrator / Codex Orchestrator
    ├── VDS / DesignOS Orchestrator
    └── future discovered project orchestrators

Repository orchestrator
└── project-owned specialist agents
```

The top-level agent registers six OpenAI Agents SDK handoffs. A handoff transfers conversation ownership to one specialist for the remainder of the run. The root still exposes deterministic portfolio tools for intake, policy lookup, task workflows, routing plans, procurement workflows, control-plane status, and human approval interruption.

## Meta Chief of Staff contract

### Purpose

Oversee the GitHub project portfolio, maintain project-state visibility, route work through repository orchestrators, delegate domain review, and enforce human authorization boundaries.

### Inputs

- human portfolio goal
- authorized repository list
- repository and orchestrator registries
- project health and validation evidence
- risk and authorization policy
- task, approval, run, routing, and audit records
- procurement, marketing, finance, and security requests

### Outputs

- portfolio execution plan
- repository task and routing packets
- approval packets and pending approval records
- project health synthesis
- domain oversight briefs
- blocker and risk reports
- audit/evidence summaries

### Authority

```yaml
can_inspect_repository_metadata: true
can_plan_cross_repository_work: true
can_route_task_packets: true
can_delegate_by_handoff: true
can_request_orchestrator_status: true
can_pause_or_flag_unsafe_work: true
can_create_approval_packets: true
can_rank_project_priority: true
can_self_approve: false
can_bypass_repository_orchestrator: false
can_mutate_production: false
can_send_external_messages: false
can_award_procurement: false
can_commit_spend: false
can_access_secrets: false
```

## Handoff contract

Each handoff requires a Zod-validated payload:

```txt
reason
objective
repositories[]
actionType?
priority
evidenceRefs[]
```

The handoff callback must:

1. verify all repositories are authorized in `MetaAgentContext`;
2. record specialist, operator, reason, scope, priority, and evidence references;
3. persist the record to `handoffEvents` and `auditEvents`;
4. report that no external side effect executed.

## Specialist contracts

### Cross-Repository Orchestrator

Owns repository inventory, orchestrator compatibility, dry-run routing, and response normalization. Unknown orchestrator authority becomes `discovery_required`.

### Procurement Oversight Agent

Owns procurement classification, vendor comparison, readiness gates, and approval artifacts. It cannot select, contact, award, contract, or pay a vendor.

### Marketing Oversight Agent

Owns claim evidence, attribution, privacy, campaign briefs, and publication/outreach/spend approval artifacts. It cannot publish, send, upload audiences, or commit spend.

### Finance Ops Agent

Owns budget utilization, variance, exception, and billing-readiness review. It cannot activate billing or commit payment.

### Security Compliance Agent

Owns hard-block, secret, privacy, auth, tenant, production, data-export, and regulated-domain review. It cannot retrieve secrets or disable approval gates.

### Audit Evidence Agent

Owns evidence-only synthesis from StateStore records. It cannot modify approvals or infer unrecorded execution.

## Approval gates

Human approval is required for:

- production deployment or rollback
- billing or payment activation
- credential or secret operations
- sensitive data export
- customer, supplier, or public communication
- marketing publication or paid spend
- vendor award or contract commitment
- legal/compliance decisions
- regulated-domain work
- policy changes
- project shutdown or major roadmap reprioritization

Hard-blocked actions do not receive a normal execution approval packet.

## Routing rule

```txt
portfolio request
  -> Meta Chief of Staff Agent
  -> deterministic policy/context check
  -> specialist handoff when domain ownership is needed
  -> repository orchestrator adapter when repository execution is involved
  -> project sub-agent
  -> validation/evidence return
  -> final specialist or portfolio synthesis
```

A repository without a confirmed orchestrator produces a discovery task rather than invented authority.
