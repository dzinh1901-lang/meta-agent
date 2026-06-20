# VDS Project Review Routing

## Required Route

Project Review Request -> Meta-Agent -> AgentOps Runtime -> VDS Project Review Agent

## Runtime Mapping

- Portfolio routing key: `vds.project_review`
- AgentOps Runtime agent ID: `vds-project-review`
- Runtime mode: dry-run/no-op
- Live execution: disabled

## Routing Behavior

Meta-Agent records the request as a VDS Project Review Workflow and routes it to AgentOps Runtime. AgentOps Runtime selects `vds-project-review`, selects compatible dry-run skills, builds a dry-run plan, simulates sandbox boundaries, validates live execution remains blocked, and generates local audit evidence.

## Blocked Capabilities

- Live execution
- Deployments
- Secrets
- Billing
- Database writes
- External communications
- Production modifications

## Validation

Routing config `config/vds-pilot-routing.json` includes `portfolioRoutingKey: vds.project_review` and `runtimeAgentId: vds-project-review`.

