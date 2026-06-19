# Controlled Execution Pilot Candidates

Scores use 1-5. For value, determinism, reversibility, auditability, and rollback simplicity, higher is better. For sensitivity, blast radius, approval complexity, dependency count, secret exposure, production interaction, and external communication risk, lower is better.

| Candidate | Portfolio Value | Operational Value | Data Sensitivity | Blast Radius | Determinism | Reversibility | Approval Complexity | Auditability | Dependency Count | Secret Exposure Risk | Production Interaction Risk | External Communication Risk | Rollback Simplicity | Result |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Chief of Staff Weekly Executive Brief | 5 | 5 | 2 | 1 | 5 | 5 | 2 | 5 | 2 | 1 | 1 | 1 | 5 | Selected future candidate |
| Repository Review Report Generation | 4 | 4 | 3 | 2 | 4 | 4 | 3 | 5 | 3 | 2 | 1 | 1 | 4 | Acceptable backup |
| Portfolio Status Snapshot Generation | 4 | 3 | 2 | 2 | 5 | 5 | 2 | 5 | 2 | 1 | 1 | 1 | 5 | Acceptable backup |

## Selected Future Pilot

Chief of Staff Weekly Executive Brief.

Selection is conditional: the future pilot must read only allowlisted portfolio documentation/configuration and write one deterministic local Markdown/JSON package to an ignored output directory. It must not update tracked dashboard files, source files, Git state, or remote systems.

