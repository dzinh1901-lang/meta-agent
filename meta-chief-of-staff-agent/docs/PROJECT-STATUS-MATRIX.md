# Project Status Matrix

| Project | Local path status | Git status | Package manager | Safe next task | Owner-blocked items |
| --- | --- | --- | --- | --- | --- |
| Meta-Agent | Exists | Git checkout on `main` | npm | Keep governance docs and validators current | None |
| AgentOps Runtime | Exists | `main` includes runtime RC stack through `79b9f6d`; status report PR #39 open | pnpm/npm | Use dry-run runtime evidence for portfolio governance | Live execution owner approval and controlled execution implementation |
| VDS DesignOS | Exists | Canonical checkout at `C:/Users/dzinh/Downloads/vds` | npm | Use dedicated `vds-project-review` dry-run agent for Project Review Workflow | Live Supabase, Stripe, Vercel, OpenAI confirmation |
| Aurelean App | Exists | Canonical checkout at `C:/Users/dzinh/Downloads/aurelean/Aurelean-App` | npm | Route launch evidence through dry-run runtime governance | Admin/session secrets and Render envs |
| Meridian Yacht Atelier | Exists | Git checkout on `main` | pnpm/npm | Add platform scope docs | Backend scope approval |
| Monsieur App | Exists | No local Git checkout | npm | Add local scope docs only | Confirm canonical repository |

## Portfolio Status

The portfolio is connected through the AgentOps dry-run runtime RC stack. Production-affecting execution remains blocked until the owner approves the specific action, target repository, environment, rollback plan, and a separate controlled execution implementation.

VDS Project Review now routes through the dedicated AgentOps Runtime agent `vds-project-review` instead of the generic Repository Review Agent fallback.
