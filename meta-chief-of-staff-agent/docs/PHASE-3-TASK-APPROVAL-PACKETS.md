# Phase 3: Task Packet and Approval Packet Generation

## Status

Phase 3 adds deterministic packet builders and run-state helpers for the Meta Chief of Staff Agent scaffold.

## Runtime modules

- `src/packet-utils.js` provides stable IDs, stable JSON hashing, array normalization, and required-field checks.
- `src/task-packet-builder.js` creates task packets for repository-level orchestrators.
- `src/approval-packet-builder.js` creates approval packets with evidence hashes, risk reason, requested authority, expiry, and decision options.
- `src/run-state.js` creates agent run records, pending approval queue items, approval decisions, and pause/resume state transitions.
- `src/packet-workflow.js` composes policy decisions, task packets, approval packets, pending approvals, and agent run state.
- `scripts/run-phase3-demo.js` prints a full gated workflow example.
- `tests/phase3-packets.test.js` verifies task, approval, queue, run-state, and workflow behavior.

## Commands

```bash
cd meta-chief-of-staff-agent
npm run packet:demo
npm run test:phase3
npm run phase3
```

## Workflow

```txt
portfolio request
  -> classify action risk
  -> build task packet
  -> build approval packet when needed
  -> create pending approval queue item when needed
  -> pause agent run when approval is needed
  -> resume or block run from decision
```

Low-risk actions create a task packet and complete the dry-run workflow without an approval packet.

Gated actions generate a task packet, approval packet, pending approval item, and paused agent run. The task packet links to the approval packet by `approval_id`.

## Approval packet additions

Approval packets now include `status`, `created_at`, `evidence_hash`, `requested_authority`, `risk_reason`, `block_reasons`, and `audit_correlation_id`.

## Phase 4 handoff

Phase 4 should use this packet workflow for orchestrator routing and repository-specific task handoff while keeping external side effects approval-gated.
