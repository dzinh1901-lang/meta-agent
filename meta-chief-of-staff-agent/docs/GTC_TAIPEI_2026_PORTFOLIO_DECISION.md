# GTC Taipei 2026 Portfolio Decision

Date: 2026-06-24  
Decision owner: Portfolio Owner  
Prepared by: Meta Chief of Staff control plane

## Decision

Adopt NVIDIA GTC Taipei 2026 as an **architecture and control-plane signal**, not as a mandate to standardize the portfolio on NVIDIA hardware or a single model.

The connected portfolio already has the correct three-layer direction:

1. **Meta-Agent** supervises portfolio priorities, evidence, routing, and human approval packets.
2. **AgentOps Runtime** owns the governed agent harness, tools, skills, secure execution boundary, policy, audit, and evaluation plane.
3. **Repository-level agents and application adapters** execute bounded domain workflows without inheriting portfolio-wide authority.

The keynote strengthens this separation. Model choice, agent harness, domain skills, and secure runtime must remain independently replaceable. Consequential actions must remain bound to human approval, exact task evidence, credential policy, and a constrained execution environment.

## Current Connected Scope

The GitHub connection used for this review exposes four repositories:

| Project | Repository | Portfolio role |
| --- | --- | --- |
| Meta-Agent | `dzinh1901-lang/meta-agent` | Portfolio control plane and supervisory routing |
| AgentOps Runtime | `dzinh1901-lang/agentops-runtime` | Governed agent runtime and execution infrastructure |
| AURELEAN | `dzinh1901-lang/aurelean-app` | Textile intelligence, sourcing, RFQ, and procurement product |
| Meridian Yacht Atelier | `dzinh1901-lang/meridian-yacht-atelier` | Client portal, design workflow, and cinematic connector product |

VDS DesignOS and Monsieur remain historical registry entries, but they were not available through the current GitHub connection. Their status must be treated as unverified until direct repository evidence is available.

## Announcement-to-Portfolio Decisions

| GTC announcement | Portfolio decision | Owner repository |
| --- | --- | --- |
| NVIDIA Agent Toolkit | Implement the architecture now | Meta-Agent + AgentOps Runtime |
| OpenShell secure runtime | Implement the runtime contract now; integrate only after staging proof | AgentOps Runtime |
| NemoClaw | Continue as a governed worker layer, never the portfolio strategy agent | AgentOps Runtime |
| Nemotron 3 Ultra | Benchmark behind a provider-neutral model adapter | AgentOps Runtime |
| CUDA-X agent skills | Evaluate selectively by domain and measurable workload | AgentOps Runtime + application repos |
| `cuOpt` | Candidate for sourcing, allocation, scheduling, and routing experiments | AURELEAN first |
| `cuDF` | Candidate only when structured-data scale justifies GPU acceleration | AURELEAN / analytics workloads |
| AI-Q and NeMo | Candidate for routing, evaluation, governance, and enterprise agent workflows | AgentOps Runtime |
| RTX Spark | Optional local development/evaluation target; never a required client dependency | AgentOps Runtime / Meridian evaluation |
| Cosmos 3 | Future world-model or spatial-continuity adapter candidate | Meridian |
| DSX and Vera Rubin | Defer until measured AI-factory demand and economics exist | Portfolio infrastructure decision |
| Alpamayo and Isaac GR00T | Out of current connected portfolio scope | None |

## What Must Be Implemented Now

### 1. Governed execution envelope in AgentOps Runtime

Every worker task must normalize into an explicit execution contract:

- named sandbox profile;
- deny-by-default network policy with exact host allowlists;
- brokered credential references rather than raw credentials;
- typed action and capability allowlists;
- runtime, action-count, and paid-compute budgets;
- immutable policy version and deterministic task digest;
- resource metering, decision audit, and trace correlation;
- human approval receipt bound to the exact digest before consequential dispatch.

The current GTC implementation branch begins this work at the contract and policy layer. It does not activate a live OpenShell or NemoClaw worker.

### 2. Current-state discovery in Meta-Agent

The portfolio control plane must stop relying on stale local-path and old pull-request statements. Read-only discovery should refresh:

- repository accessibility;
- default branch and current head;
- open issue and pull-request counts;
- current milestone and documented blockers;
- evidence age and confidence;
- which actions are executable versus owner-blocked.

Unknown or inaccessible projects must be marked unverified rather than inferred.

### 3. Provider-neutral application seams

AURELEAN and Meridian should consume AgentOps capabilities through stable domain contracts rather than importing NVIDIA-specific assumptions.

- AURELEAN: sourcing intelligence, supplier comparison, RFQ analysis, and future optimization should use provider-neutral agent/model/optimizer interfaces. A `cuOpt` experiment is valid only after objective functions, constraints, benchmark data, and human award controls are defined.
- Meridian: complete Cinematic Connector Phase 1 with provider-neutral ports, registry-driven routing, deterministic fake connectors, typed proposals, and no provider HTTP calls. Cosmos 3 can later be evaluated as one adapter for spatial continuity or physical-AI media generation.

### 4. Truthful capability and readiness claims

Product documentation must distinguish:

- implemented local/staging behavior;
- provider-disabled integration scaffolds;
- evaluation candidates;
- owner-blocked production activation;
- hardware or services that are not deployed.

No repository should claim RTX Spark, OpenShell, NemoClaw, Nemotron, Cosmos, DSX, Vera Rubin, or any other provider is live without runtime evidence.

## What Should Be Evaluated, Not Adopted by Default

### Nemotron 3 Ultra

Run portfolio-specific evaluations against current candidates. Measure task quality, structured-output validity, long-horizon completion, tool selection, policy adherence, latency, throughput, reliability, and unit cost. Model selection remains a routing decision, not an architecture decision.

### CUDA-X skills

Register each candidate as a versioned capability with an owner, input/output contract, environment policy, approval class, deterministic fixtures, and fallback. Do not expose a library merely because it is available as an agent skill.

### RTX Spark

Evaluate only for private local inference, low-latency prototyping, offline demonstrations, or graphics/AI workflows where it produces a measured advantage. Cloud and CPU-compatible paths must remain available unless an explicit product decision changes that requirement.

### Cosmos 3

Limit evaluation to Meridian use cases with clear acceptance criteria: design fidelity, spatial continuity, source-asset provenance, controllability, reviewability, latency, cost, and safe publication controls.

## What Should Be Deferred

DSX, Vera Rubin, and AI-factory infrastructure should not enter implementation planning until the portfolio has measured sustained workload volume, concurrency, latency/privacy constraints, expected utilization, staffing, operations, failure recovery, and a buy-versus-cloud business case.

Alpamayo and GR00T should remain outside the connected portfolio roadmap until an autonomous-vehicle or humanoid-robotics product requirement exists.

## Cross-Repository Implementation Order

### P0 — Current branches

1. AgentOps Runtime: land the normalized runtime-control contract and tests.
2. Meta-Agent: refresh the portfolio registry, project matrix, and current backlog from direct repository evidence.
3. Meridian: correct capability claims and align the GTC decision with open Issue #5.
4. AURELEAN: document the provider-neutral adoption path and keep AI/NVIDIA integrations staged.

### P1 — Enforcement and domain boundaries

1. Bind AgentOps approvals to task digest, policy version, expiry, actor, and action set.
2. Add a staging-only secure-runtime adapter with fail-closed translation of network, filesystem, process, credential, and delegation policy.
3. Complete Meridian Issue #5 using deterministic fake adapters before any live provider work.
4. Keep AURELEAN production priorities—deployment, identity/RBAC, durable database, tenant ownership, and observability—ahead of model activation.

### P2 — Evaluation harness

1. Add provider-neutral model and skill registries.
2. Build reproducible portfolio workload fixtures.
3. Compare Nemotron and CUDA-X candidates with existing baselines.
4. Record quality, latency, reliability, privacy, safety, and cost evidence.

### P3 — Optional hardware and infrastructure

Make RTX Spark, DSX, and Vera Rubin decisions only through a separately approved capacity and economics review.

## Non-Authorization Statement

This decision does not authorize production deployment, paid compute, hardware purchase, external communication, supplier award, customer delivery, credential access, or activation of an NVIDIA service. Those remain subject to the portfolio authority model and explicit owner approval.

## Primary Sources

- NVIDIA GTC Taipei 2026: https://www.nvidia.com/en-tw/gtc/taipei/
- NVIDIA Agent Toolkit announcement: https://nvidianews.nvidia.com/news/enterprise-software-leaders-build-ai-agents-with-nvidia
- NVIDIA OpenShell: https://build.nvidia.com/openshell
- NVIDIA NemoClaw: https://github.com/NVIDIA/NemoClaw
- NVIDIA DSX: https://nvidianews.nvidia.com/news/dsx-infrastructure-ai-factory
- NVIDIA Cosmos 3: https://nvidianews.nvidia.com/news/nvidia-launches-cosmos-3-the-open-frontier-foundation-model-for-physical-ai
