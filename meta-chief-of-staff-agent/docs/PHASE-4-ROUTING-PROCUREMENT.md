# Phase 4: Orchestrator Routing and Procurement Pilot

## Status

Implemented for deterministic dry-run and local Agents SDK use.

## Orchestrator routing

The portfolio router builds one bounded workflow per repository. Known repositories resolve their registered local orchestrator. Unknown orchestrators return `discovery_required`; restricted repositories return `blocked`. Routing plans never create issues, pull requests, commits, deployments, messages, or production changes.

## Procurement intents

Supported intents:

- `research`
- `shortlist`
- `award`
- `contract`
- `payment`

Research can proceed internally without approval when no hard block applies. Shortlist, award, contract, and payment requests are checked for budget, vendor, legal/compliance, security, and payment readiness before an approval packet may be created.

## Readiness gates

- Positive estimated cost and budget owner for procurement decisions
- At least two vendors for a non-sole-source shortlist
- Selected vendor for award, contract, or payment
- Legal/compliance review for contracts, cross-border requests, and regulated-domain administrative review
- Security review for vendor data or system access
- Contract or purchase-order reference before payment

Incomplete decision or commitment requests are blocked for revision and do not receive an execution approval packet.

## Hard blocks

The workflow does not operationally support controlled goods, weapons-related procurement, defense-related procurement, or non-administrative regulated-domain procurement. A normal action approval cannot override these blocks.

## Approval scope

Procurement approval packets are constrained by:

- repository
- exact action type
- procurement intent
- maximum budget
- currency
- allowed vendor IDs
- selected vendor ID
- forbidden execution actions

The workflow sets autonomous spend, autonomous vendor award, and external side effects to `false`.

## Commands

```bash
npm run procurement:demo
npm run test:phase4
npm run phase4
```

## Exit criteria

- Every procurement request is classified.
- Incomplete commitments fail closed before approval.
- Vendor award, contract, payment, and spend remain human-gated.
- Restricted procurement remains blocked.
- All generated approval packets are repository, budget, intent, and vendor scoped.
- No external side effect executes.
