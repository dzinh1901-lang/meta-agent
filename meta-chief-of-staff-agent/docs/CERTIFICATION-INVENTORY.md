# Certification Inventory

Certification version: Portfolio OS V1

Inventory date: 2026-06-20

## Summary

This inventory records the repository state used for Portfolio OS V1 certification. It covers the four primary repositories plus Meridian Yacht Atelier and Monsieur App as supporting portfolio entries.

| Repository | Branch | Latest Commit | Open PRs | Validation Status | Integration Status | Blockers | Risk Level |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `dzinh1901-lang/meta-agent` | `codex/portfolio-os-v1-certification` from `main` | `d5158be` | None | `npm run validate`, doc links, portfolio certification validator planned | Portfolio control plane and certification authority | None for dry-run certification | Medium |
| `dzinh1901-lang/agentops-runtime` | `codex/portfolio-os-v1-certification` from `main` | `b8eb1fa` | None | Typecheck, tests, skills, GitHub protocol, contracts planned | Dry-run runtime, routing, approvals, traces, sandbox, readiness, audit, RC review | Live execution intentionally disabled | Medium |
| `microsoft-lang1901/vds-designos` | `codex/portfolio-os-v1-certification` from clean `origin/main` worktree | `fac16c0` | None | Codex agent validation planned | Governed downstream pilot candidate | Original local checkout has unrelated dirty files; production dependencies require owner evidence | High |
| `dzinh1901-lang/aurelean-app` | `codex/portfolio-os-v1-certification` from `main` | `c9fc545` | #250, #1 | Codex agent and subagent validation planned | Governed downstream RFQ pilot candidate | Unrelated local `scripts/hosted-smoke-test.js` dirty; production env evidence owner-gated | High |
| `dzinh1901-lang/meridian-yacht-atelier` | Supporting repo, no certification branch in this milestone | `d459259` | #1 | Not modified in this milestone | Supporting portfolio project with prior scope docs | Not part of primary V1 certification edits | Medium |
| `monsieur-app` | Blocked, no canonical Git checkout found | Not available | Not available | Not available | Tracked as blocked supporting project | `C:/Users/dzinh/Downloads/Monsieur App` is not a Git checkout | High |

## Active Milestone Branches

- Meta-Agent: `codex/portfolio-os-v1-certification`
- AgentOps Runtime: `codex/portfolio-os-v1-certification`
- VDS DesignOS: `codex/portfolio-os-v1-certification`
- Aurelean: `codex/portfolio-os-v1-certification`

## Validation Commands

Meta-Agent:
- `npm run validate`
- `node scripts/validate-doc-links.js`
- `node scripts/validate-portfolio-health.js` if available
- `node scripts/validate-portfolio-runtime-integration.js` if available
- `node scripts/validate-portfolio-certification.js`

AgentOps Runtime:
- `npm run check`
- `npm test`
- `npm run validate:skills`
- `npm run validate:github-protocol`
- `node tests/contracts/meta-agent-contracts.test.mjs`

VDS DesignOS:
- `npm run validate:codex-agents`
- `npm run validate-vds-agent-map` if available

Aurelean:
- `npm run validate:codex-agents`
- `npm run validate:subagents`

