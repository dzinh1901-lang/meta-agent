# Approval Routing Model

| Risk | Router action | Owner decision needed |
| --- | --- | --- |
| Documentation only | Execute locally | No |
| Schema/validator only | Execute locally | No |
| Draft external message | Draft only | Before send |
| Production deploy | Block and request approval | Yes |
| Secret update | Block and request approval | Yes |
| Billing/payment | Block and request approval | Yes |
| Database migration | Block and request approval | Yes |
