# Portfolio Risk Register

Certification version: Portfolio OS V1

## Architecture Risks

| Risk | Description | Impact | Probability | Mitigation | Current Status |
| --- | --- | --- | --- | --- | --- |
| Runtime drift risk | Runtime behavior may drift from Meta-Agent governance documents. | High | Medium | Keep certification, runtime docs, and validators synchronized before pilots. | Open |
| Integration maintenance risk | Cross-repo status can become stale as branches and PRs move. | Medium | Medium | Re-run inventory and certification validators before each milestone. | Open |

## Governance Risks

| Risk | Description | Impact | Probability | Mitigation | Current Status |
| --- | --- | --- | --- | --- | --- |
| Documentation drift risk | Certification docs may lag implementation changes. | Medium | Medium | Use doc-link and certification validators in each governance PR. | Open |
| Approval bypass risk | Operators may attempt to treat dry-run readiness as live approval. | Critical | Low | Fail closed, state NO-GO boundaries in every certification artifact. | Mitigated by policy |

## Execution Risks

| Risk | Description | Impact | Probability | Mitigation | Current Status |
| --- | --- | --- | --- | --- | --- |
| Live execution risk | A future runtime slice could accidentally invoke skills or tools. | Critical | Low | Keep execution disabled by default, require kill switch and owner approvals. | Blocked |
| Autonomous execution risk | Agents may be asked to run without owner review. | Critical | Low | Approval gates and readiness validators block autonomous execution. | Blocked |

## Security Risks

| Risk | Description | Impact | Probability | Mitigation | Current Status |
| --- | --- | --- | --- | --- | --- |
| Secret exposure risk | Certification or runtime evidence could accidentally include secrets. | Critical | Low | Do not edit secrets, do not request secrets, require owner-managed secret setup. | Open |
| Production credential misuse | Future controlled execution could use wrong credentials. | Critical | Low | Require allowlists, environment flags, audit logs, and kill switch before live execution. | Blocked |

## Integration Risks

| Risk | Description | Impact | Probability | Mitigation | Current Status |
| --- | --- | --- | --- | --- | --- |
| Repository branch mismatch | Certification branches may be created from stale defaults. | Medium | Low | Record default branch and latest commit in certification inventory. | Mitigated |
| Supporting repo gap | Monsieur App lacks canonical Git checkout. | Medium | High | Record as blocked until canonical repository exists. | Blocked |

## Commercial Risks

| Risk | Description | Impact | Probability | Mitigation | Current Status |
| --- | --- | --- | --- | --- | --- |
| Billing action risk | Runtime could be asked to change paid services. | High | Low | Billing actions are NO-GO and require owner approval in future designs. | Blocked |
| Vendor commitment risk | Procurement or RFQ pilots could be confused with vendor awards. | High | Medium | Dry-run pilots only compare and review; awards remain blocked. | Open |

## Operational Risks

| Risk | Description | Impact | Probability | Mitigation | Current Status |
| --- | --- | --- | --- | --- | --- |
| Pilot scope creep | Dry-run pilots could expand into production workflows. | High | Medium | Use explicit pilot charters, blockers, and certification verdicts. | Open |
| Validation coverage gap | Some validators may not exist in every repo. | Medium | Medium | Record unavailable validators and run available safe checks. | Open |

