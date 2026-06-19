# Portfolio Blockers

## Cross-Portfolio

- Confirm whether `dzinh1901-lang/monsieur-app` exists and whether `C:/Users/dzinh/Downloads/Monsieur App` is the intended working tree.
- Confirm owner approvals before any deployment, billing, database migration, secret update, production environment change, or external message.

## VDS DesignOS

- Supabase readiness needs non-secret evidence.
- Stripe readiness needs live-mode owner confirmation.
- Vercel production settings and rollback path need owner confirmation.
- OpenAI live-mode usage needs owner confirmation.

## Aurelean

- Admin token and session secret requirements must be owner-provided in deployment secret stores.
- Demo mode must be explicitly disabled for production.
- Render deployment evidence must be collected without exposing secrets.

## Runtime

- Meta-Agent task contract adoption must be validated against existing registry tests before executable workflows are enabled.
