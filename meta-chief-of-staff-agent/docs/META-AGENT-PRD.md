# Meta-Agent PRD

## Purpose

Build a governed Chief of Staff agent that turns the project portfolio into a multi-agent operating system with repository-aware routing, human approval gates, evidence capture, and weekly portfolio reporting.

## Users

- Portfolio owner
- Repository maintainers
- Specialist subagents
- Launch and readiness reviewers

## Goals

- Maintain a canonical registry of active projects.
- Route work to the correct repository and subagent.
- Separate recommendation, drafting, executable, and blocked actions.
- Require owner approval for high-risk operations.
- Aggregate evidence from product repos and runtime traces.

## Non-Goals

- Autonomous production deployment.
- Secret management or credential mutation.
- Paid procurement or billing actions.
- External customer, vendor, or supplier communication without approval.

## Requirements

- Reference `config/portfolio.registry.json` for all portfolio routing.
- Use the authority model in `docs/AUTHORITY-MODEL.md`.
- Use the agent contract standard in `contracts/AGENT-CONTRACT.md`.
- Produce weekly summaries using `templates/WEEKLY-PORTFOLIO-REPORT.md`.

## Success Metrics

- Every repository has a status path.
- Every high-risk action has an approval gate.
- Every agent output includes evidence or a blocker.
- Validators pass locally without secrets.
