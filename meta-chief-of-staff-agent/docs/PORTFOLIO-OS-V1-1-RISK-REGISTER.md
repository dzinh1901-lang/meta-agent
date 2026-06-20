# Portfolio OS V1.1 Risk Register

## Architecture Risks

| Risk | Description | Impact | Probability | Mitigation | Status |
| --- | --- | --- | --- | --- | --- |
| Runtime drift | Runtime behavior may drift from certification docs. | High | Medium | Validate docs and runtime evidence before every certification update. | Open |
| Cross-repository dependency risk | Certification depends on evidence across multiple repos. | Medium | Medium | Keep inventory and routing docs explicit. | Open |

## Governance Risks

| Risk | Description | Impact | Probability | Mitigation | Status |
| --- | --- | --- | --- | --- | --- |
| Documentation drift | Docs may lag local runtime and pilot state. | Medium | Medium | Run doc link and certification validators. | Open |
| Approval bypass | Operators may treat dry-run certification as live approval. | Critical | Low | Repeat NO-GO boundaries in certifications and reports. | Mitigated |

## Execution Risks

| Risk | Description | Impact | Probability | Mitigation | Status |
| --- | --- | --- | --- | --- | --- |
| Live execution risk | Future work could enable execution without full readiness. | Critical | Low | Require controlled-execution readiness milestone and owner approval. | Blocked |
| Autonomous approvals | Agent could be asked to approve itself. | Critical | Low | Self-approval remains prohibited by policy. | Blocked |

## Security Risks

| Risk | Description | Impact | Probability | Mitigation | Status |
| --- | --- | --- | --- | --- | --- |
| Secret exposure | Evidence packages could accidentally include secrets. | Critical | Low | Do not edit secrets; require owner-managed secret setup. | Open |

## Operational Risks

| Risk | Description | Impact | Probability | Mitigation | Status |
| --- | --- | --- | --- | --- | --- |
| Certification drift | Certifications may not be updated after pilots. | Medium | Medium | Add V1.1 final report as source of truth. | Open |
| Pilot inconsistency | VDS and Aurelean pilots may use different evidence shapes. | Medium | Medium | Align audit packages and status reports. | Open |

## Commercial Risks

| Risk | Description | Impact | Probability | Mitigation | Status |
| --- | --- | --- | --- | --- | --- |
| Supplier or vendor commitment risk | RFQ reviews could be confused with awards. | High | Medium | Keep awards and outreach blocked. | Open |
| Billing risk | Future controlled execution may touch paid services. | High | Low | Billing remains NO-GO without owner approval. | Blocked |

## Portfolio Risks

| Risk | Description | Impact | Probability | Mitigation | Status |
| --- | --- | --- | --- | --- | --- |
| Meridian mapping gap | Meridian is not yet mapped into V1.1 runtime routing. | Medium | Medium | Run `codex/meridian-runtime-mapping`. | Open |

## Controlled Execution Readiness Addendum

| Risk | Status | Required Action |
| --- | --- | --- |
| Path escape or symlink write outside sandbox | Open | Implement realpath containment and symlink rejection before pilot execution. |
| Approval replay | Open | Add nonce, expiry, task digest binding, and replay rejection tests. |
| Kill switch not enforced by adapter | Open | Implement fail-closed kill switch checks before any controlled execution. |
| Audit and rollback integrity | Open | Add deterministic digests and rollback manifest verification. |
| Unbounded local output | Open | Add output size, file count, and duration limits. |

Execution authorization remains `NOT_AUTHORIZED`.
## Weekly Brief Foundation Update

The controlled weekly brief foundation addresses the readiness gaps at the design and local-validation layer, but execution remains unauthorized until owner approval and one-run authorization are completed in a separate gate.

Execution authorization remains `NOT_AUTHORIZED`.
