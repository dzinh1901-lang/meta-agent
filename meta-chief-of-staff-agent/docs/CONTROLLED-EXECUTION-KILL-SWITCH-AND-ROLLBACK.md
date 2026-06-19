# Controlled Execution Kill Switch And Rollback

## Kill-Switch Requirements

- engaged by default
- independent of task approval
- checked before any future write
- checked between future execution phases
- cannot be disabled by the executing agent
- owner-controlled
- fails closed if unreadable or ambiguous
- emits audit evidence for every check

## Rollback Requirements

- only pilot-generated artifacts may be removed
- source files may not be modified and therefore require no source rollback
- rollback manifest lists every generated file
- file hashes recorded before acceptance
- partial output is treated as failure
- rollback result is audited
- rollback cannot affect files outside the pilot output directory

## Future Pilot Behavior

preflight -> owner approval verification -> kill-switch verification -> isolated local write -> output validation -> audit packaging -> owner review -> accept or rollback.

No part of this flow is implemented or executed in this milestone.

