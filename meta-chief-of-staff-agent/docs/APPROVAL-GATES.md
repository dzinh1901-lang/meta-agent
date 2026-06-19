# Approval Gates

| Gate | Trigger | Required evidence | Allowed agent action before approval |
| --- | --- | --- | --- |
| Production deploy | Any live deploy | Tests, rollback, owner target environment | Draft release checklist |
| Secret change | Env/token/credential update | Secret name only, no value, target platform | Draft env matrix |
| Billing/payment | Stripe, procurement, paid tools | Cost/risk summary | Draft setup plan |
| Database migration | Production schema/data mutation | Migration plan, backup/rollback | Dry-run plan |
| External communication | Customer/vendor/supplier message | Draft copy and recipient class | Draft message only |
| Client/private data | Sensitive client material | Data classification | Recommend handling |
