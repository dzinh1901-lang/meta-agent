# Cross-Repo Correlation Map

## Shared Concepts

| Concept | Meta-Agent | AgentOps Runtime | VDS | Aurelean | Meridian | Monsieur |
| --- | --- | --- | --- | --- | --- | --- |
| Portfolio registry | Owns | Consumes for routing | Reports status | Reports status | Reports status | Blocked/status only |
| Approval gates | Defines policy | Enforces during execution | Requires for launch | Requires for launch | Requires for future backend | Requires for checkout |
| Agent contracts | Defines standard | Implements and validates | Adopts for readiness agent | Adopts for launch closer | Adopts for product architect | Adopts for commerce architect |
| Evidence | Aggregates | Produces traces and evidence | Readiness evidence | Launch evidence | Scope evidence | Repo availability evidence |
| Weekly report | Owns template | Supplies execution logs | Supplies production status | Supplies launch status | Supplies product scope status | Supplies blocked status |

## Routing Rule

Meta-Agent is the planner and authority router. AgentOps Runtime is the executor. Product repositories remain owners of domain truth and must not be modified in production-risk ways without owner approval.
