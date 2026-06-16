# Roadmap

## Stage 0: Design Package and Guardrails

**Goal:** Establish the project folder, PRD, architecture, policies, schemas, and deterministic scaffold.

**Milestones:**

- M0.1: Folder scaffold complete.
- M0.2: Repository seed registry complete.
- M0.3: Risk policy and authorization matrix defined.
- M0.4: Dry-run approval packet generation working.
- M0.5: Validation script passes.

**Exit criteria:**

- `npm run validate` succeeds.
- `npm run dry-run` produces an approval packet.
- No file grants self-approval authority.

## Stage 1: Read-Only Portfolio Discovery

**Goal:** Turn the seed registry into an evidence-backed inventory.

**Work:**

- Discover README, package scripts, roadmap, PRD, agent registry, validation scripts, and launch gates for every repository.
- Classify each repo by stage: prototype, MVP, production-ready, live, paused, unknown.
- Identify repository-level orchestrator path and sub-agent registry where present.
- Produce first `project-health` object per repo.

**Exit criteria:**

- 100% of visible repositories have health records.
- Known orchestrators have authority profiles.
- Unknown repos are flagged without invented claims.

## Stage 2: Orchestrator Compatibility Layer

**Goal:** Standardize communication with repository-level orchestrators.

**Work:**

- Define task packet schema.
- Define orchestrator response schema.
- Map AURELEAN and DesignOS orchestrator contracts.
- Add adapters for other repos as they are discovered.

**Exit criteria:**

- The Meta Agent can generate a task packet for any repo.
- The packet identifies whether the repo has a known orchestrator or needs discovery.
- High-risk task packets generate approval packets before routing.

## Stage 3: Human Authorization Queue

**Goal:** Implement approvals as first-class workflow objects.

**Work:**

- Approval packet builder.
- Approval decision records.
- Expiry, constraints, approver roles, and evidence hashes.
- Escalation lanes: product, engineering, security, finance/procurement, marketing, legal/compliance.

**Exit criteria:**

- High/critical actions pause.
- Approval packet has all mandatory fields.
- Rejected actions stop or return for revision.
- Approval does not persist beyond expiry/scope.

## Stage 4: Procurement Oversight Pilot

**Goal:** Supervise procurement workflows without autonomous spend or vendor award.

**Work:**

- Vendor request intake.
- Budget threshold policy.
- Alternative/vendor comparison packet.
- Contract/legal review gate.
- Regulated-domain restriction gate.

**Exit criteria:**

- Every procurement action is classified.
- Vendor awards require human approval.
- Regulated or controlled-domain procurement is blocked unless legal/compliance-approved for permitted administrative work.

## Stage 5: Marketing Oversight Pilot

**Goal:** Coordinate marketing plans while preventing unapproved public claims or spend.

**Work:**

- Campaign brief generation.
- Attribution readiness check.
- UTM and event taxonomy validation.
- Claims and privacy guardrails.
- Public send/spend approval packet.

**Exit criteria:**

- Marketing plans can be drafted.
- No public publication or paid spend can execute without approval.
- Claims are linked to evidence or flagged.

## Stage 6: Controlled GitHub Write Pilot

**Goal:** Allow limited approved writes such as issues or PR drafts.

**Work:**

- GitHub issue creation adapter.
- PR branch/commit adapter.
- CI status ingestion.
- Evidence link to commit SHA.
- Human approval before writes.

**Exit criteria:**

- Low-risk documentation issues may be created under explicit policy.
- PRs require approval packets for high-risk scopes.
- Production-impacting PRs remain gated.

## Stage 7: Portfolio Dashboard

**Goal:** Visualize health, blockers, approvals, milestones, and evidence.

**Work:**

- Project cards.
- Approval queue.
- Risk heatmap.
- Procurement queue.
- Marketing launch queue.
- Milestone timeline.
- Audit ledger.

**Exit criteria:**

- A principal can review all projects from one dashboard.
- All displayed facts link to evidence.

## Stage 8: Production Supervision Readiness

**Goal:** Operate as an always-on control plane.

**Work:**

- Background scanner.
- Scheduled status reports.
- Multi-approver controls.
- External alerting.
- Monitoring and rollback workflows.

**Exit criteria:**

- System can run scheduled read-only scans.
- Production-related actions remain approval-gated.
- Audit trail is complete and reviewable.
