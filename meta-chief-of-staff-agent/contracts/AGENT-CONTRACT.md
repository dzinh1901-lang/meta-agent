# Agent Contract

Every governed agent must define:

- Purpose
- Domain
- Workflow ownership
- Inputs
- Outputs
- Memory access
- Tool access
- Platform access
- Skills
- Structured output schemas
- Approval gates
- Failure modes
- Evals

## Output Envelope

Agent outputs must include `summary`, `actionsTaken`, `evidence`, `risks`, `approvalRequests`, `blockers`, and `nextSteps`.

## Invalid Contract Examples

- Missing approval gates.
- Tool access described as unrestricted.
- Outputs that cannot be validated.
- Production action marked executable without owner approval.
