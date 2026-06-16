# Implementation Plan

## Guiding Rule

Implement from **read-only visibility** to **approval-gated routing** to **controlled writes**. Never start with autonomous production actions.

## Phase 0: Project Scaffold

- [x] Create standalone project folder.
- [x] Add PRD, architecture, roadmap, milestones, governance, risk register.
- [x] Add agent definitions with front matter.
- [x] Add policy files.
- [x] Add JSON schemas.
- [x] Add deterministic scaffold code.
- [x] Add validation and dry-run scripts.

## Phase 1: Read-Only Repo Discovery

### Tasks

1. Load `registries/repositories.seed.json`.
2. For each repo, query standard files.
3. Parse repository-level agent definitions.
4. Parse package scripts and validation commands.
5. Record evidence sources and confidence level.
6. Produce project health snapshots.

### Outputs

- `project_health[]`
- `orchestrator_inventory[]`
- `validation_command_inventory[]`
- `missing_docs_report[]`

### Human Gate

No approval required for read-only metadata discovery unless confidential content access is requested.

## Phase 2: Authority and Policy Enforcement

### Tasks

1. Normalize action taxonomy.
2. Map action types to risk levels.
3. Map risk levels to approver roles.
4. Make unknown action type fail closed.
5. Make regulated-domain procurement fail closed.
6. Build approval packet for every high/critical request.

### Outputs

- policy decision
- approval packet
- blocked action report

### Human Gate

Policy changes require principal + security/compliance approval.

## Phase 3: Orchestrator Task Packet Routing

### Tasks

1. Generate task packets.
2. Attach target repository and known orchestrator path.
3. Attach expected outputs and validation commands.
4. Attach approval decision if risk requires it.
5. Route to local orchestrator through future GitHub issue/PR/tool adapter.

### Outputs

- task packet
- orchestrator response
- validation report
- final synthesis

### Human Gate

Routing that creates a GitHub issue may be medium-risk. Routing that changes code, production config, billing, security, procurement, or external communications is high/critical and requires approval.

## Phase 4: Procurement Oversight

### Tasks

1. Intake procurement request.
2. Classify domain and risk.
3. Check budget threshold.
4. Require finance/procurement approver.
5. Require legal/compliance for regulated or contract-heavy domains.
6. Require security review for vendors with data/system access.
7. Produce vendor comparison and award packet.

### Outputs

- procurement brief
- vendor risk matrix
- approval packet
- award decision record

### Hard Stops

- No autonomous spend.
- No autonomous vendor award.
- No regulated/controlled goods procurement.
- No defense-related procurement without explicit legal/compliance-approved permitted scope.

## Phase 5: Marketing Oversight

### Tasks

1. Generate campaign plan.
2. Verify claims against evidence.
3. Confirm attribution/UTM readiness.
4. Confirm privacy guardrails.
5. Confirm budget approval for paid spend.
6. Generate public-send approval packet.

### Outputs

- campaign brief
- claims review
- measurement plan
- public-send approval packet

### Hard Stops

- No unapproved public publishing.
- No unapproved customer/supplier outreach.
- No paid media spend before budget and attribution approval.

## Phase 6: Evidence Ledger

### Tasks

1. Define append-only event model.
2. Hash evidence bundle.
3. Attach correlation ID to task packets.
4. Persist approvals/rejections.
5. Link to commits, PRs, issues, CI, docs, and validation output.

### Outputs

- evidence events
- approval decisions
- trace summaries
- executive status report

## Phase 7: Dashboard and Control Plane

### Tasks

1. Design dashboard cards.
2. Build API endpoints.
3. Add filters by repo, risk, stage, owner, blocker, approval role.
4. Add approval queue UI.
5. Add evidence trace viewer.

### Outputs

- portfolio command center
- approval review console
- project timeline

## Phase 8: Production Operations

### Tasks

1. Schedule scans.
2. Monitor CI/validation status.
3. Produce weekly operating report.
4. Alert on high-risk blockers.
5. Rotate policy review.
6. Run incident/rollback drills.

### Outputs

- weekly project report
- approval aging report
- launch readiness matrix
- risk register update
