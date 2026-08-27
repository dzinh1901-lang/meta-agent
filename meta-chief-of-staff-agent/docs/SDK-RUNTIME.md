# COSMOS Agents SDK Runtime

## Purpose

The TypeScript runtime turns the deterministic Chief of Staff design into an executable manager-agent workflow while preserving the existing policy engine as the authorization boundary.

The language model may inspect, synthesize, decompose, route, and prepare approval artifacts. It cannot record a human approval. Approval decisions enter through the trusted runtime, are checked against server-configured roles, and are bound to the exact pending SDK tool invocation.

## Runtime components

| Component | Responsibility |
|---|---|
| `src/sdk/metaChiefOfStaff.ts` | Root manager agent and structured executive output. |
| `src/sdk/specialists.ts` | Cross-repository, procurement, marketing, finance, security, and audit agents exposed as manager tools. |
| `src/sdk/runtime.ts` | Run, interruption persistence, exact-action approvals, authenticated resume, and single-use consumption. |
| `src/sdk/actionBinding.ts` | Canonical JSON normalization and SHA-256 action binding. |
| `src/sdk/discoveryTools.ts` | Sanitized, read-only GitHub discovery tool. |
| `src/state/JsonFileStateStore.ts` | Local durable state with atomic 0600 writes. |
| `src/state/PostgresStateStore.ts` | Postgres/Supabase-ready durable state adapter. |
| `src/discovery/*` | GET-only GitHub reader and discovery evidence normalizer. |

## Trust boundaries

1. **Model boundary** — model output and tool arguments are untrusted proposals.
2. **Policy boundary** — `policy-engine.js` deterministically classifies every proposed action and fails closed on unknown actions.
3. **Approval boundary** — only the trusted runtime may apply decisions to `RunState`; the manager does not receive `recordDecisionTool`.
4. **Identity boundary** — `COSMOS_APPROVER_ROLES` is supplied by the hosting service, not by model arguments. A CLI `--role` value only selects a role already present in that allowlist.
5. **Exact-action boundary** — approval packets contain the normalized tool arguments and a SHA-256 digest. Changed tool, agent, repository, environment, or arguments invalidate the approval.
6. **Secret boundary** — secret-bearing fields and common credential value patterns are rejected before action arguments are persisted. GitHub tokens stay inside the server-side reader and are never returned by the discovery tool.
7. **Repository boundary** — tool access is restricted to repositories in both the portfolio registry and the trusted authorization allowlist.
8. **Evidence boundary** — repository text is not returned verbatim by discovery. Only file identity, hashes, size, and schema-derived metadata are exposed to the model.

## Run lifecycle

```text
objective
  -> manager agent
  -> deterministic registry/policy/discovery tools
  -> specialist agent-as-tool routing
  -> approval interruption, if required
  -> exact action packet + durable RunState
  -> trusted human decision
  -> role, expiry, scope and digest validation
  -> SDK state approve/reject
  -> resumed manager run
  -> approval consumed after the exact invocation leaves the interruption set
  -> executive synthesis + audit events
```

An approval queue can require several roles. The SDK run remains paused until every current interruption reaches a final queue state. Partial approvals persist without making another model request.

## Local durable mode

```bash
npm install
npm run check

OPENAI_API_KEY=... \
COSMOS_OPERATOR_ID=principal-1 \
COSMOS_APPROVER_ROLES=engineering_approver,principal_approver,security_approver \
npm run agent:run -- --objective "Prepare launch-readiness reports for AURELEAN and DesignOS"
```

The command prints the public run snapshot and stores the serialized SDK state in `.data/cosmos-state.json`. It deliberately omits `sdk_state` from terminal output.

Review pending approvals:

```bash
npm run agent:approvals
```

Record a scoped decision:

```bash
COSMOS_OPERATOR_ID=principal-1 \
COSMOS_APPROVER_ROLES=engineering_approver \
npm run agent:decide -- \
  --run-id sdk_run_... \
  --approval-id appr_... \
  --decision approve_once \
  --role engineering_approver \
  --constraints '{"allowed_repository":"dzinh1901-lang/aurelean-app"}'
```

The approver identity and role should normally come from authenticated server middleware. Environment variables and the CLI are an operator-mode adapter, not a substitute for production identity verification.

## Postgres/Supabase mode

Apply the state tables described by the architecture, then run commands with `--postgres`:

```bash
DATABASE_URL=... \
COSMOS_DATABASE_TABLE_PREFIX=cosmos_ \
npm run agent:status -- --postgres --run-id sdk_run_...
```

The adapter supports the same `StateStore` interface as local JSON state.

## Read-only GitHub discovery

`discover_repository` performs only GitHub `GET` requests. Public repositories can be inspected without a token subject to rate limits. Private repositories require a server-side token:

```bash
GITHUB_READ_TOKEN=... npm run agent:run -- --objective "Inventory repository evidence"
```

The discovery result contains:

- default branch and repository status;
- requested artifact presence;
- content SHA and size;
- package script names or structural Markdown/JSON metadata;
- evidence status and confidence;
- a durable source digest.

It does not return raw repository content, execute repository instructions, write GitHub state, or expose the token.

## Required production controls

Before deploying beyond operator mode:

- authenticate operators and map identity claims to roles server-side;
- use a KMS-backed secret manager rather than dotenv files;
- use Postgres with append-only audit/evidence controls and restricted service roles;
- place the runtime behind a request boundary that validates tenant and portfolio scope;
- configure tracing export, retention, and sensitive-data policy;
- add idempotency and postcondition checks to any future real write adapters;
- require a new exact-action approval whenever arguments, branch, target, amount, recipient, or policy version changes;
- never expose `recordDecisionTool` to a model-managed tool list.
