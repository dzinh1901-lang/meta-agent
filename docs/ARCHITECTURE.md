# Architecture

Portfolio-level supervisory agent that routes work through repository orchestrators and prepares governed approval packets.

<!-- portfolio-maintenance-20260717:architecture:start -->
## Repository Map

- No implementation directories are tracked at this baseline.

## Runtime and Tooling Evidence

- Detected root frameworks: none
- Tracked manifests: meta-chief-of-staff-agent/package.json
- Root validation scripts: none

## System Boundary

The agent may recommend, route, rank, hold, and escalate; it must not self-approve high-risk actions.

The repository tree and executable manifests are authoritative when they differ from roadmap or concept documents. External providers, credentials, infrastructure, and approvals are not assumed to exist from configuration files alone.
<!-- portfolio-maintenance-20260717:architecture:end -->
