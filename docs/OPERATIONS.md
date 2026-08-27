# Operations

Operational notes for maintaining Meta Chief of Staff Agent without assuming live service access.

<!-- portfolio-maintenance-20260717:operations:start -->
## Routine Validation

- No root automated validation command is declared.

For documentation-only changes, always run `git diff --check`, validate relative Markdown links, and scan the changed tree for secrets. Runtime tests require the repository dependencies and should not be installed solely for a documentation edit when storage is constrained.

## Controlled Commands

No deployment, release, migration, billing, or production script names were detected at the root.

## Data and Secrets

- Treat local environment files, credentials, customer data, supplier data, and generated browser profiles as non-source artifacts.
- Keep reproducible outputs such as `node_modules/`, `.next/`, `dist/`, build caches, and virtual environments out of preservation commits unless a repository explicitly tracks a release artifact.
- Back up source and evidence before removing duplicate worktrees.

## Recovery

The baseline for this documentation branch is `592b93c557838c1498190afb21923d02d3ef8f33` on `main`. Restore runtime state from Git history and repository-managed migrations or seed procedures; do not treat local caches as backups.
<!-- portfolio-maintenance-20260717:operations:end -->
