# Governance Validation

Run these local checks from the Meta-Agent package:

```bash
node scripts/validate-portfolio-registry.js
node scripts/validate-agent-contracts.js
node scripts/validate-approval-gates.js
node scripts/validate-doc-links.js
```

These validators are intentionally local and non-secret. They parse the registry, contract schemas, approval docs, and markdown links without contacting production systems.
