# Risk Register

| ID | Risk | Severity | Mitigation | Owner |
|---|---|---:|---|---|
| R1 | Meta Agent bypasses repository orchestrator | Critical | Enforce routing through repo orchestrator; block direct specialist execution | Security Compliance |
| R2 | Agent self-approves high-risk action | Critical | Hard-coded policy: self-approval false; validation checks | Security Compliance |
| R3 | Production deployment without human approval | Critical | Production action type requires approval packet and principal/security approval | Principal + Security |
| R4 | Procurement spend or vendor award without authorization | Critical | Finance/procurement approval required; no autonomous awards | Finance Ops |
| R5 | Regulated or defense-related procurement misuse | Critical | Fail closed; legal/compliance gate; no controlled-goods procurement support | Legal/Compliance |
| R6 | Public marketing makes unverified claims | High | Claims evidence check; marketing approval required | Marketing Oversight |
| R7 | Secrets or credentials exposed | Critical | No secret access; metadata-only discovery; security approval for credential operations | Security Compliance |
| R8 | Repo inventory contains hallucinated facts | High | Evidence-linked claims; unknown status allowed; confidence scoring | Audit Evidence |
| R9 | Approval persists beyond intended scope | High | Expiry and scoped constraints required | Audit Evidence |
| R10 | Task packet lacks validation/rollback | High | Schema requires expected outputs and rollback for high/critical actions | Cross-Repository Orchestrator |
| R11 | Marketing spend before attribution readiness | High | Paid spend action requires budget + measurement approval | Marketing + Finance |
| R12 | Data export violates privacy constraints | Critical | Data export classified critical; privacy/security/legal approval required | Security + Legal |
