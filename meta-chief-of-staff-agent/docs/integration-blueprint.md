# Integration Blueprint

## Initial Integration Mode

Start with no external writes. The first integration should be a read-only scanner that builds project health records.

## GitHub Integration

### Read-Only

- List repositories.
- Fetch standard files.
- Search for orchestrators and sub-agent registries.
- Read package scripts and validation commands.
- Read issues/PRs only after permission review.

### Approval-Gated Writes

Only after Stage 6:

- Create issue from task packet.
- Create branch and PR draft.
- Add PR comment with approval packet ID.
- Update project board/status.

### Blocked Without Approval

- Merge PR.
- Deploy production.
- Modify secrets.
- Push production config.
- Remove validation/approval gates.

## Agent Runtime Integration

The runtime should model:

- Chief agent as root manager.
- Oversight agents as tools or handoff targets.
- Repository orchestrators as handoff/tool targets.
- Tool guardrails around every mutation-capable action.
- Human-in-the-loop interruption for approvals.
- Trace recording for model calls, tool calls, handoffs, guardrails, and custom events.

## Evidence Storage

Recommended tables:

```sql
repositories
project_health_snapshots
task_packets
agent_runs
approval_packets
approval_decisions
evidence_events
policy_versions
```

## Dashboard Integration

Dashboard pages:

- Portfolio Overview
- Repository Health
- Approval Queue
- Procurement Queue
- Marketing Queue
- Risks and Blockers
- Milestones
- Audit Ledger

## Provider Integration Rules

- OpenAI/Anthropic model calls must be server-side.
- Trace exports must avoid secrets and sensitive payloads.
- Supabase service-role credentials must remain server-only.
- Stripe/live billing must be human-approved.
- Marketing platforms must not send unless approval exists.
- Procurement/finance systems must not award/spend unless approval exists.
