# Governance and Authorizations

## 1. Governance Principle

The Chief of Staff Agent is authorized to supervise and coordinate. It is not authorized to self-approve, spend, publish, deploy, award, expose secrets, or override repository-specific product policies.

## 2. Approval Roles

| Role | Scope |
|---|---|
| Principal Approver | Portfolio priorities, production gates, major roadmap changes |
| Engineering Approver | Code changes, architecture, CI/validation, release readiness |
| Security Approver | Secrets, auth, tenant isolation, data access, live services |
| Finance Approver | Budget, spend, vendor payment, contract economics |
| Procurement Approver | Vendor shortlisting, supplier selection, procurement process |
| Marketing Approver | Campaign claims, public launch, customer/supplier outreach, paid media |
| Legal/Compliance Approver | Contracts, regulated domains, privacy, export-control-sensitive areas |

## 3. Risk Classes

### Low

Read-only status, internal summaries, non-sensitive documentation drafts.

Default: allowed in dry-run/read-only mode.

### Medium

Internal task creation, non-production documentation changes, non-sensitive planning, internal campaign briefs.

Default: can proceed only if repository policy permits; otherwise request approval.

### High

Code changes, data access beyond public/internal metadata, client/supplier drafts, procurement recommendations, billing configuration, credential configuration, security policy updates.

Default: approval required.

### Critical

Production deployment, live billing, external publication, paid spend, vendor award, legal commitment, production data export, regulated-domain actions, tenant/auth/security changes with live impact.

Default: approval required, often multi-approver.

## 4. Approval Packet Required Fields

- `approval_id`
- `requested_action`
- `action_type`
- `risk_level`
- `affected_repositories`
- `requesting_agent`
- `required_approver_roles`
- `evidence_bundle`
- `expected_outcome`
- `rollback_plan`
- `constraints`
- `expires_at`
- `decision_options`

## 5. Always-Blocked Without Explicit Human Authorization

- Production deployment or live service mutation.
- Billing/checkout enablement.
- Secret or credential access.
- Customer/supplier/public messaging.
- Public marketing publication.
- Paid media spend.
- Procurement award, vendor payment, or contract commitment.
- Legal or compliance representations.
- Regulated/defense/controlled-goods procurement.
- Export of customer/supplier data.
- Removing approval gates.
- Agent self-approval.

## 6. Approval Expiry

Approvals must expire. Default recommended TTL:

- Low: no formal approval required.
- Medium: 7 days if approval is needed.
- High: 72 hours.
- Critical: 24 hours or one deployment window.

## 7. Approval Constraints

Approvals must be scoped. Example:

```json
{
  "allowed_repository": "dzinh1901-lang/aurelean-app",
  "allowed_action": "create_pull_request_draft",
  "forbidden_actions": ["merge", "deploy", "send_external_message"],
  "expires_at": "2026-06-18T00:00:00Z"
}
```

## 8. Audit Requirement

Every approval and rejection must link to:

- task packet ID
- policy version
- evidence hash
- approver identity/role
- decision timestamp
- final outcome
