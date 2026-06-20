# Aurelean Pilot Routing

## Required Route

RFQ Review Request -> Meta-Agent -> AgentOps Runtime -> Aurelean RFQ Agent

## Runtime Mapping

- Portfolio routing key: `aurelean.rfq_review`
- AgentOps Runtime agent ID: `aurelean-rfq`
- Runtime mode: dry-run/no-op
- Live execution: disabled

## Routing Behavior

Meta-Agent records the request as an Aurelean RFQ Review Workflow and routes it to AgentOps Runtime. AgentOps Runtime selects `aurelean-rfq`, selects compatible dry-run skills, builds a dry-run plan, simulates sandbox boundaries, validates live execution remains blocked, and generates local audit evidence.

## Blocked Capabilities

- Live execution
- Deployments
- Secrets
- Billing
- Database writes
- External communications
- Production modifications
- Supplier outreach
- Vendor awards
- Spend commitments
- Autonomous execution

## Validation

Routing config `config/aurelean-pilot-routing.json` includes `portfolioRoutingKey: aurelean.rfq_review` and `runtimeAgentId: aurelean-rfq`.

