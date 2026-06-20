# VDS Pilot Routing

## Route

Project Review Request -> Meta-Agent -> AgentOps Runtime -> VDS Project Review Agent -> Dry-Run Plan -> Audit Package -> Portfolio Dashboard

## Routing Contract

Meta-Agent receives the VDS Project Review Request and records it as a governed Portfolio OS V1 dry-run workflow. AgentOps Runtime validates the task, selects the governed review path, performs skill selection without invocation, builds a dry-run plan, and packages audit evidence. Meta-Agent then records portfolio dashboard status.

## Config

Routing configuration is recorded in `config/vds-pilot-routing.json`.

## Safety Boundary

The route is dry-run only. Live execution, deployments, secrets, billing, database writes, external communications, and production modifications are blocked.

## Validation

Routing config is valid JSON and includes the full required route from Project Review Request to Portfolio Dashboard.

