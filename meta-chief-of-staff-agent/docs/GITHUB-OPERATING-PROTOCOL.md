# GitHub Operating Protocol

Status: active source-of-truth protocol.

## Purpose

This protocol governs GitHub work for portfolio tasks. `meta-agent` is the source-of-truth control plane. `agentops-runtime` is the active runtime implementation target.

## Control Plane And Runtime Roles

- `dzinh1901-lang/meta-agent`: owns portfolio registry, authority model, GitHub operating protocol, routing rules, approval policy, and evidence requirements.
- `dzinh1901-lang/agentops-runtime`: implements runtime slices that receive governed Meta-Agent tasks, validate them, route them, build approvals, persist traces, and return evidence.

## Standard GitHub Workflow

Every future portfolio GitHub task must follow this sequence:

1. Resolve the canonical Git repository and local checkout.
2. Confirm remote origin and current branch.
3. Inspect worktree status.
4. Separate unrelated dirty files from task-scoped changes.
5. Derive or reference the Meta-Agent task packet.
6. Classify approval requirements and blocked policies.
7. Route implementation work to `agentops-runtime` when runtime behavior is needed.
8. Run repository-appropriate validations.
9. Commit only task-scoped changes locally.
10. Push or open a PR only when explicitly instructed.
11. Return evidence, blockers, untouched changes, and the recommended next task.

## Default Hard Stops

The standard default is conservative. Do not:

- push without explicit instruction,
- deploy,
- edit or expose secrets,
- apply database migrations,
- change billing or payment settings,
- change production settings,
- send external communications,
- call external APIs from runtime slices.

## Branch Discipline

Use the branch that is already active when the task explicitly names it. For new runtime implementation work, prefer a task-scoped branch from `codex/real-agent-execution-runtime` unless the owner gives a different branch.

Direct commits to `main` are allowed only for control-plane documentation or registry updates when the user explicitly requested that repository and local policy permits it.

## Evidence Required In Final Reports

Return:

- repository and branch,
- remote origin,
- files changed,
- validation commands and results,
- commit hash if committed,
- push/PR status if requested,
- unrelated dirty files left untouched,
- blockers,
- recommended next task.

## Runtime Alignment

`agentops-runtime` must keep a runtime-facing mirror of this protocol and validate that runtime work remains aligned with this control-plane source.
