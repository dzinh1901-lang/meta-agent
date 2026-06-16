# Key Milestones

| Milestone | Stage | Owner | Deliverable | Acceptance Criteria |
|---|---|---|---|---|
| M0 Design Package | Stage 0 | Meta Chief Agent project | This folder | Docs, policies, schemas, JS scaffold, validation pass |
| M1 Repository Inventory | Stage 1 | Cross-Repository Orchestrator | Full repo health registry | Every visible repo has a health record and status confidence |
| M2 Orchestrator Map | Stage 2 | Cross-Repository Orchestrator | Orchestrator compatibility table | AURELEAN and DesignOS mapped; unknown repos flagged |
| M3 Approval Queue | Stage 3 | Security Compliance + Audit Evidence | Approval packet lifecycle | High/critical actions pause and require human decision |
| M4 Procurement Oversight | Stage 4 | Procurement + Finance Ops | Procurement risk/approval flow | Vendor awards and spend blocked without approval |
| M5 Marketing Oversight | Stage 5 | Marketing Oversight | Campaign plan + claims/spend gates | No unapproved public claims, sends, or paid spend |
| M6 GitHub Routing Pilot | Stage 6 | Cross-Repository Orchestrator | Approved issue/PR routing | Only approved writes occur; every write links evidence |
| M7 Dashboard MVP | Stage 7 | Product/Frontend | Portfolio command center | Health cards, blockers, approvals, risks, milestones visible |
| M8 Production Supervision | Stage 8 | Security/Operations | Operational control plane | Scheduled scans, audit ledger, approvals, rollback evidence |

## Milestone Detail

### M0: Design Package

- Create project folder.
- Define detailed PRD.
- Define architecture and data flow.
- Define staged roadmap.
- Define governance matrix.
- Add deterministic scaffold.

### M1: Repository Inventory

- Read-only repository discovery.
- Extract docs, scripts, agent definitions, project status, validation commands.
- Produce one project-health JSON object per repository.
- Assign confidence level to each status claim.

### M2: Orchestrator Map

- Confirm local orchestrators.
- Identify each orchestrator's authority fields.
- Identify approval-required actions.
- Record local sub-agent role registry.
- Build cross-repo handoff map.

### M3: Approval Queue

- Implement approval packet builder.
- Add decision records.
- Add expiry and constraint fields.
- Add multi-role approval for critical actions.

### M4: Procurement Oversight

- Define procurement request schema.
- Define spend thresholds.
- Define vendor award constraints.
- Define regulated-domain hard stop.
- Add finance/procurement/legal approver routing.

### M5: Marketing Oversight

- Define campaign packet schema.
- Validate claim evidence.
- Validate attribution/UTM readiness.
- Require approval for public publishing and spend.

### M6: GitHub Routing Pilot

- Create issue draft packets.
- Create PR draft packets.
- Attach evidence and approval packet IDs.
- Validate policy before write.

### M7: Dashboard MVP

- Build project health cards.
- Approval queue view.
- Timeline and blockers.
- Procurement and marketing queues.
- Audit feed.

### M8: Production Supervision

- Scheduled scans.
- Alerting.
- Immutable evidence ledger.
- Multi-approver paths.
- Operational runbooks.
