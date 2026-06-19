# Agent Contract Standard

Agent contracts are the bridge between the Meta-Agent control plane and AgentOps Runtime execution. The human-readable standard is `contracts/AGENT-CONTRACT.md`; machine-readable shapes live in JSON schema files in `contracts/`.

## Required Validation

- JSON schemas must parse.
- Example payloads must validate by inspection before runtime adoption.
- Approval gates must classify actions as recommend-only, draft-only, executable, or blocked.

## Evidence Standard

Evidence must identify source repository, file path or command, timestamp, result, and limitations.
