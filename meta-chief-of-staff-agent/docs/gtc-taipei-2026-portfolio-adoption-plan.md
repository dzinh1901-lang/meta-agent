# NVIDIA GTC Taipei 2026 — Portfolio Adoption and Cost Plan

**Decision date:** 2026-06-24  
**Owner:** Meta Chief of Staff  
**Scope:** All 29 currently accessible repositories, including five open pull requests  
**Status:** Proposed implementation plan; no production activation or hardware procurement is authorized by this document

## Executive decision

Adopt the keynote's software architecture now, but do not buy an AI factory or make NVIDIA a hard platform dependency.

The portfolio should implement four shared capabilities first:

1. **Governed agent execution** — sandboxed tools, explicit network policies, approvals, audit, and failure containment. NemoClaw/OpenShell is a candidate execution adapter beneath AgentOps, not a new strategic control plane.
2. **Provider-neutral model routing and evaluation** — add NVIDIA Nemotron/NIM-compatible endpoints behind the same contracts used for current OpenAI, Anthropic, Gemini, and other providers.
3. **Cost-attributed job execution** — one shared contract for AI and GPU jobs with per-job cost, retries, dead-letter handling, provenance, budget caps, and cancellation.
4. **Evidence-gated physical-AI pilots** — use Cosmos 3, Isaac, and related tooling only in simulation/synthetic-data evaluations until data quality, safety, and commercial demand are demonstrated.

Do **not** authorize Vera Rubin, Vera CPU, DSX/AI-factory racks, DRIVE/Alpamayo vehicle deployments, humanoid hardware, or self-hosting Nemotron 3 Ultra in the current portfolio phase. These are scale-stage options, while much of the portfolio is still catalogue, prototype, mock-data, or credential-ready software.

## Keynote applicability

| Keynote platform | Portfolio applicability | Decision |
| --- | --- | --- |
| NVIDIA Agent Toolkit / enterprise agents | High across AgentOps, Meta Agent, DesignOS, AURELEAN, market intelligence, assistants | Implement via common adapter, evaluation, approval, and telemetry contracts |
| NemoClaw + OpenShell | High for sandboxed agent workers | Pilot inside `agentops-runtime`; preserve provider neutrality and read-only defaults |
| Nemotron 3 Nano / Super | High for inexpensive subagents, tool calling, extraction, synthesis | Benchmark against current providers on portfolio tasks before adoption |
| Nemotron 3 Ultra | Low near-term because of model size and serving cost | Hosted evaluation only; do not self-host |
| CUDA-X libraries | High for real CFD, physics, rendering, and batch analytics | Profile only after real solver/job backends exist; rent GPU capacity first |
| Cosmos 3 | High research relevance for robotics, autonomy, maritime digital twins, synthetic sensor data | Controlled simulation pilots with dataset provenance and human validation |
| Isaac GR00T / humanoid stack | Research relevance only | Defer hardware; retain as a future simulation benchmark |
| Alpamayo / DRIVE Hyperion | Narrow relevance to autonomy research | Do not implement in product; monitor licensing, safety, and target-market demand |
| RTX Spark Windows PCs | Potential local creative/agent workstation | Hold procurement until OEM availability, price, software compatibility, and benchmark evidence are public |
| DGX Spark | Potential single-node local/private model and rendering pilot | Conditional only; cloud-rent first and use the procurement gate below |
| Vera CPU / Vera Rubin / DSX AI Factory | Not proportionate to current demand | Defer; enterprise quote and capacity study only after sustained utilization |

## Cost policy

All budgets below are planning ceilings in USD and exclude normal product engineering salaries. Engineering effort is shown separately so the portfolio does not hide labor behind low infrastructure prices.

| Stage | External cash ceiling | Engineering effort | Permitted work | Exit evidence |
| --- | ---: | ---: | --- | --- |
| Stage 0 — controls | $0–$1,000 | 2–5 engineering days | Registry, interfaces, telemetry schema, security policy, benchmark set | Contracts merged; no provider-specific product coupling |
| Stage 1 — hosted pilot | $1,000–$5,000 total | 1–3 engineering weeks | Hosted model/API and rented GPU tests, 50–200 representative tasks | Quality, latency, cost/task, failure rate, and operator review recorded |
| Stage 2 — shared worker | $5,000–$20,000 total | 3–8 engineering weeks | Durable queue, GPU worker, object storage, observability, synthetic-data pilot | Repeatable workload and at least one product workflow using it |
| Stage 3 — local appliance | Budget $6,000–$8,000 all-in for one unit | 1–3 engineering weeks setup | One local/private workstation or DGX Spark-class pilot | Procurement gate passed; benchmark proves lower TCO or required privacy/latency |
| Stage 4 — AI factory | No authorization | Dedicated platform team | Rack-scale systems, networking, power/cooling, support, fleet operations | Separate business case, vendor quote, capacity forecast, security and facilities review |

### Procurement gate

A local NVIDIA system may be considered only when all of the following are true:

- Equivalent cloud/API spend has exceeded **$1,000 per month for three consecutive months**, or a documented privacy/latency requirement prevents hosted execution.
- The target models and workflows fit the proposed memory and software stack.
- Expected productive utilization is at least **40%** during working periods.
- A named owner accepts patching, monitoring, backups, capacity planning, and incident response.
- A benchmark demonstrates at least one of: **30% lower cost per accepted output**, **2× lower latency**, or a material privacy/compliance benefit.

Rack-scale procurement requires a separate gate: sustained GPU spend above **$20,000 per month**, more than **60% utilization**, multiple production tenants, a staffed platform function, and documented power/cooling/network capacity.

## Shared implementation work packages

### WP-01 — Complete the portfolio registry

**Repositories:** `meta-agent`, `agentops-runtime`  
**Priority:** P0  
**Cash:** $0  
**Effort:** 2–3 days

- Replace the three-repository runtime registry with all 29 repositories.
- Add maturity (`empty`, `prototype`, `credential-ready`, `production-gated`), domain, data sensitivity, regulatory posture, AI/GPU workload class, and owner fields.
- Treat unknown repositories as blocked, not low risk.
- Mark `naval-defence-catalogue` restricted pending legal/compliance review.

**Acceptance:** every repository has a recorded disposition and no automated agent can act on an unclassified target.

### WP-02 — Introduce AI/GPU cost telemetry

**Repositories:** `agentops-runtime` first; adapters consumed by AI-enabled projects  
**Priority:** P0  
**Cash:** $0–$1,000  
**Effort:** 3–5 days

Record for every task/job:

- provider, model, endpoint class, prompt/input units, output units;
- GPU type and GPU-seconds when applicable;
- retries, cache hits, moderation/guardrail actions;
- accepted/rejected outcome and human-review result;
- estimated and invoiced cost;
- project, workspace, user, purpose, data classification, and artifact provenance.

Add per-workspace and per-job hard caps. Fail closed when a cost cannot be estimated for an external provider.

### WP-03 — Add a provider-neutral model router and evaluation harness

**Repositories:** `agentops-runtime`, `global-market-intelligence`, `designOS-App`, `designos-orchestrator-v2`, `aurelean-app`  
**Priority:** P0/P1  
**Cash:** $1,000–$3,000 pilot  
**Effort:** 1–2 weeks

- Support OpenAI-compatible endpoints, NVIDIA-hosted/NIM endpoints, Anthropic, Gemini, and existing providers behind one typed interface.
- Route simple extraction and classification to small models; tool-heavy workflows to mid-tier models; reserve frontier reasoning for high-value escalations.
- Add deterministic benchmark fixtures from actual portfolio tasks.
- Measure task success, groundedness, policy violations, latency, and cost per accepted result.
- Keep model choice server-side and configurable; do not encode NVIDIA model names in product UI or business logic.

### WP-04 — Pilot NemoClaw as a governed worker

**Repository:** `agentops-runtime`  
**Priority:** P1  
**Cash:** $0–$2,000  
**Effort:** 1–2 weeks

- Implement NemoClaw/OpenShell as an optional worker adapter under existing AgentOps policy.
- Default to read-only filesystem and deny-by-default network policy.
- Require capability grants and approval receipts for writes, external communication, deployments, billing, or production mutation.
- Preserve existing sandbox/runtime implementations as alternatives.
- Test prompt injection, secret access, network egress, tool abuse, runaway retries, and budget exhaustion.

### WP-05 — Build one shared compute-job contract

**Repositories:** `designOSweb`, `cfd-engineering-studio`, `faraday`, `ionforge`, `materials-intelligence`, `naval-defence-catalogue`  
**Priority:** P1  
**Cash:** $2,000–$10,000 pilot  
**Effort:** 2–5 weeks

Use the queue/provider pattern already proposed in DesignOSweb PR #3, but standardize it as a portfolio contract:

- immutable input manifest and content hashes;
- provider/solver adapter;
- estimated cost and enforced budget before enqueue;
- queue priority, cancellation, retry/backoff, timeout, and dead-letter behavior;
- progress events and artifact provenance;
- output validation and human acceptance;
- no UI claim of an active GPU/HPC cluster unless backed by real telemetry.

Start with rented GPU capacity. CUDA-X profiling begins only after the worker runs a real solver or render workload.

### WP-06 — Cosmos 3 physical-AI evaluation

**Repositories:** `robotics-intelligence`, `oatip`, `seastates`, `naval-defence-catalogue`; optional `harborgrid`  
**Priority:** P2  
**Cash:** $3,000–$15,000  
**Effort:** 3–6 weeks

- Select one non-safety-critical scenario, such as synthetic maritime sensor sequences or warehouse navigation perception.
- Define real-data baseline, synthetic-data ratio, provenance, license, and retention policy.
- Train/evaluate no production control policy without human review and independent validation.
- Measure domain gap, rare-event coverage, downstream task accuracy, and cost per useful training sequence.
- Keep defence work isolated and restricted.

## Portfolio-by-portfolio disposition

| Repository | Current character | Applicable keynote capability | Required action | Spend posture |
| --- | --- | --- | --- | --- |
| `agentops-runtime` | Governed agent runtime; prototype with known production blockers | NemoClaw, Nemotron, model routing, evaluation | Implement WP-01 to WP-04; remain read-only by default | P0/P1 software pilot |
| `meta-agent` | Chief-of-staff governance and portfolio inventory | Agent governance and workload routing | Own registry, prioritization, evidence, and cross-project receipts | P0, no infrastructure spend |
| `designOS-App` | Production-gated BIM/digital-twin app with assistant and render jobs | Agent toolkit, model router, local/private rendering | Add provider router and cost attribution after live-readiness gates | P0/P1 hosted only |
| `designos-orchestrator-v2` | Earlier/parallel DesignOS implementation | Same as DesignOS App | Declare canonical repository; avoid duplicate NVIDIA integration | No new spend until consolidation |
| `designOSweb` | Cinematic generation backend plus four stacked open PRs | GPU queue, provider adapters, RTX/DGX local pilot | Consolidate PR stack; retain PR #3 architecture; add cost/provenance contracts | P0 cleanup, then P1 pilot |
| `global-market-intelligence` | Multi-model market decision support and scheduled agents | Small/mid-tier Nemotron evaluation, agent cost routing | Replace fixed model assumptions with router/evals; maintain non-trading boundary | $1,000–$3,000 API pilot |
| `aurelean-app` | Textile sourcing MVP with staged AI/NVIDIA integration boundaries | Agent assistant, vision/material classification, optional SimReady | Finish production blockers first; benchmark small models; no 3D/GPU spend yet | P0 software only |
| `materials-intelligence` | Data/analytics jobs platform | CUDA-X batch analytics and materials models | Merge security workflow after validation; instrument actual jobs before GPU pilot | P1 after real datasets |
| `cfd-engineering-studio` | CFD mission-control UI with apparent mock simulations | CUDA-X, shared GPU worker | Replace mock job state with WP-05 contract; benchmark one solver | P1 rented GPU |
| `faraday` | Computational-physics UI with mock simulations/cluster metrics | CUDA-X, GPU worker | Remove unsupported cluster claims; connect one real solver and telemetry | P1 rented GPU |
| `ionforge` | Propulsion/EM/mission simulator surface | CUDA-X physics acceleration | Establish validated solver backend first, then profile GPU path | P1/P2, no hardware |
| `vectora` | Engineering systems atlas with AI-guided explanations | RAG, model router, optional simulation tools | Add grounded retrieval/evaluation; call shared solvers rather than own cluster | Low-cost hosted AI |
| `vectormaris` | Maritime engineering intelligence and vessel analysis | RAG and CFD integration | Ground assistant in verified vessel data; delegate compute to shared worker | Software first |
| `naval-defence-catalogue` | Production-oriented naval digital twin and simulation orchestration | Cosmos, CUDA-X, simulation agents | Restricted simulation-only pilot after legal/compliance review | Isolated P2 budget only |
| `robotics-intelligence` | Mostly scaffold/example page | Cosmos 3, Isaac/GR00T research | Build domain MVP, data model, and simulator contract before any model/hardware | No spend now |
| `oatip` | Structured autonomy/robotics knowledge platform | Cosmos, Isaac, agent assistant | Add source-grounded evaluation and one simulation dataset pilot | P1/P2 research budget |
| `seastates` | Ocean-condition UI using mock real-time data | Forecasting, synthetic maritime data | Connect authoritative data first; add provenance and uncertainty | No GPU until real data |
| `harborgrid` | Port/logistics atlas and assistant | Agent/RAG; possible route optimization | Ground data and evaluate CPU optimization first; consider GPU only at scale | Low-cost hosted AI |
| `pelagia` | Yacht catalogue/intelligence app | RAG/search and creative media | Add retrieval and source provenance; use existing hosted image/video APIs | No hardware |
| `meridian-yacht-atelier` | Backend explicitly targeting RTX Spark rendering and video providers | RTX Spark/DGX Spark, render adapters | Correct product naming, keep mock/cloud fallback, benchmark before procurement | Hold hardware; P1 cloud test |
| `illustre-studio` | Subscription creative app with art/render modes | Provider routing, local/private image inference | Add per-generation cost/provenance; evaluate local privacy path only at volume | P1 hosted, conditional local |
| `illustre` | Photo-to-illustration app with secure/ephemeral processing claim | Local/private image inference | Verify deletion/privacy contract; add provider abstraction and accepted-output cost | Low-cost hosted first |
| `stem-study-platform` | Local study planner with AI Tutor/Solve surfaces | Small-model tutor and routing | Ground answers, add child/student safety and cost caps; no GPU | Hosted small-model only |
| `auren-studio` | Repository currently contains a health companion | Small-model assistant; privacy-sensitive local inference | Resolve repository naming/product ownership; complete clinical/privacy boundary before AI expansion | No GPU; security/privacy first |
| `monsieur-app` | Private-client web experience | Optional concierge assistant | No autonomous actions; add only grounded, approval-gated service if demanded | No GPU |
| `IO` | Static Three.js galaxy visualization | RTX graphics only, not an AI workload | Improve rendering only if product traction warrants it | No AI/GPU infrastructure |
| `IO-landing-page` | Tested landing/waitlist app | None materially | Keep lean; do not add AI for positioning alone | $0 |
| `vireo` | Empty repository | None yet | Archive or define product brief before implementation | $0 |
| `Meridianstudio` | Empty repository | None yet | Consolidate with `meridian-yacht-atelier` or archive | $0 |

## Outstanding pull-request disposition

### `designOSweb`

The four open PRs are a stacked change set rather than four independent main-branch changes.

1. **PR #1 — marine/real-estate cinematic engine:** validate secrets, auth, storage, queue, and provider calls; merge first only after a clean build/test/security run.
2. **PR #2 — Next.js scaffold:** rebase onto the canonical post-#1 branch or replace with the corresponding implementation in `designOS-App`; do not create a second ungoverned frontend architecture.
3. **PR #3 — queue, workers, retry/DLQ, provider adapters:** preserve this design. Add cost estimate, hard budget cap, provenance, cancellation, and NVIDIA-compatible provider interfaces before merge.
4. **PR #4 — chibi routes/contracts:** currently non-mergeable and inconsistent with the marine/real-estate direction. Re-scope, rebase, or close as superseded after product-owner review.

Do not add NVIDIA-specific production code to these PRs until the stack is consolidated and its existing tests can run.

### `materials-intelligence`

**PR #12 — CodeQL workflow:** merge after confirming workflow syntax, supported languages, permissions, and successful checks. This is a security improvement and should precede new AI/GPU integrations.

## 90-day sequence

### Days 0–30

- Complete the registry and canonical-repository decisions.
- Merge or re-scope outstanding PRs using the disposition above.
- Add the cost/provenance event schema to AgentOps.
- Build a 50–200 case evaluation set from real portfolio tasks.
- Add a provider-neutral endpoint contract and budget caps.

**Ceiling:** $1,000 external cash; 2–3 engineering weeks across the portfolio.

### Days 31–60

- Run Nemotron Nano/Super and current-provider comparisons.
- Run a NemoClaw/OpenShell sandbox security pilot.
- Connect one real render or solver workload to the shared job contract.
- Publish cost/task, acceptance rate, p95 latency, and failure/retry results.

**Ceiling:** additional $4,000 external cash; 3–6 engineering weeks.

### Days 61–90

- Run one Cosmos 3 synthetic-data evaluation in a non-safety-critical scenario.
- Decide whether a single local NVIDIA system passes the procurement gate.
- Promote only integrations that beat an existing baseline and have an operational owner.

**Ceiling:** additional $15,000 for approved pilots; hardware remains separately gated.

## Portfolio success metrics

- 100% of AI/GPU tasks emit cost and provenance events.
- 0 production writes by agents without an approval receipt.
- At least 30% reduction in cost per accepted routine task through routing/caching, without a quality regression.
- At least one real compute workload uses the shared job contract.
- No product UI displays fake cluster, GPU, real-time, or simulation state.
- No hardware is purchased without a recorded benchmark and procurement decision.
- All restricted-domain pilots have legal/compliance approval and isolated data/credentials.

## Source basis

This plan was prepared from the June 1, 2026 NVIDIA GTC Taipei keynote and official NVIDIA material for NemoClaw/OpenShell, Nemotron 3, NeMo evaluation/guardrails, Cosmos 3, CUDA-X, DGX Spark, and the GTC Taipei hands-on program. Product specifications, availability, and pricing remain subject to vendor and OEM change; obtain current written quotes before procurement.
