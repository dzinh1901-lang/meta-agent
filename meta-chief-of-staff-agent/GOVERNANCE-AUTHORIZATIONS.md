# Governance and Authorizations

## 1. Governance Principle

The Chief of Staff Agent is authorized to supervise and coordinate. It is not authorized to self-approve, spend, publish, deploy, award, expose secrets, or override repository-specific product policies.

The language model may propose an action and trigger an approval interruption. Only the trusted runtime may record a human decision or apply it to serialized SDK run state.

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

Approver roles must be supplied by authenticated hosting middleware. In operator-mode CLI use, `COSMOS_APPROVER_ROLES` is the trusted allowlist; a model-provided or command-line role cannot grant itself authority outside that allowlist.

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

Every approval packet requires:

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

For an OpenAI Agents SDK tool interruption, the packet must additionally include:

- `exact_action`
- `binding_version`
- `action_digest`
- `sdk_run_id`
- `sdk_interruption_index`

`exact_action` binds the approval to the tool name, requesting agent, deterministic action type, repository, environment, normalized arguments, and SHA-256 digest. Any material change requires a new packet.

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

Actions marked as prohibited or default-blocked by deterministic policy cannot be made executable merely by creating a normal approval packet.

## 6. Approval Expiry

Approvals must expire. Default recommended TTL:

- Low: no formal approval required.
- Medium: 7 days if approval is needed.
- High: 72 hours.
- Critical: 24 hours or one deployment window.

Expired, rejected, changes-requested, or consumed approvals are not executable.

## 7. Approval Constraints

Approvals must be scoped to the exact proposed action. Example:

```json
{
  "allowed_repository": "dzinh1901-lang/aurelean-app",
  "target_environment": "non-production",
  "action_digest": "<sha256-of-normalized-exact-action>",
  "forbidden_actions": [
    "merge_pull_request",
    "trigger_deployment",
    "request_secret_access"
  ]
}
```

Multi-approver constraints are monotonic. A later approver may add restrictions but cannot replace an existing fixed constraint with a conflicting value.

## 8. Single-Use Approval

An approved SDK interruption is single-use. After the exact interruption executes or leaves the pending interruption set, its packet and queue transition to `consumed`. Replaying a consumed packet or applying it to a different run or digest is blocked.

## 9. Audit Requirement

Every approval and rejection must link to:

- task packet or SDK run ID;
- policy version;
- evidence hash;
- exact-action digest when applicable;
- approver identity and role;
- decision timestamp;
- queue state transition;
- final outcome or consumption record.
