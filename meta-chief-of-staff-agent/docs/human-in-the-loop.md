# Human-in-the-Loop Authorization Design

## Purpose

The Meta Chief of Staff Agent must pause for human authorization before high-risk or critical tool calls. This mirrors approval-based agent runtime patterns where a tool call can be interrupted, reviewed, approved or rejected, and then resumed from the same run state.

## Approval Lifecycle

```txt
Action proposed
  -> policy engine classifies risk
  -> low/medium read-only action may continue
  -> high/critical action pauses
  -> approval packet generated
  -> human approves/rejects with constraints
  -> run resumes or stops
  -> decision written to evidence ledger
```

## Approval Packet Review UI Requirements

A future UI must show:

- action summary
- affected repositories
- risk level and explanation
- requested authority
- required approver role(s)
- evidence links
- cost/spend estimate when relevant
- data/customer/supplier impact
- rollback plan
- expiry
- approve/reject/request-changes buttons

## Decision Types

```txt
approve_once        Approve one scoped action.
approve_with_limits Approve but narrow scope, budget, repo, time, or tool.
reject              Reject action and stop run.
request_changes     Send packet back for revision.
always_reject       Reject same tool/action class for current run.
```

## Approval Constraints

Every approval should be constrained by:

- repository
- action type
- time window
- maximum budget if procurement/marketing spend
- target environment
- allowed tools
- forbidden tools
- rollback requirements

## Required Human Gates by Domain

### Procurement

Human approval required for vendor selection, paid contract, purchase order, supplier award, or material commitment.

### Marketing

Human approval required for public publication, paid spend, customer outreach, supplier outreach, product claims, or campaign launch.

### Engineering / Production

Human approval required for production deploy, live credentials, billing activation, auth/tenant/security changes, and data migrations.

### Legal / Compliance / Regulated Domains

Human approval required for legal claims, contract terms, privacy-sensitive data, export-control-sensitive work, defense/regulated domain decisions, and controlled-goods procurement. The default action is block.

## Evidence Requirements

An approval is invalid unless the packet includes:

- policy version
- action type
- risk level
- approver role
- evidence bundle
- rollback plan
- expiry
- decision timestamp
