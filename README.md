# Meta Chief of Staff Agent

Portfolio-level supervisory agent that routes work through repository orchestrators and prepares governed approval packets.

## Current Status

Implementation is contained in the meta-chief-of-staff-agent subdirectory with policies, registries, scripts, tests, and validation.

## Repository Documentation

- [Project status](docs/PROJECT_STATUS.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Setup](docs/SETUP.md)
- [Operations](docs/OPERATIONS.md)
- [Asset manifest](docs/ASSET_MANIFEST.md)
- [Changelog](CHANGELOG.md)

## Boundary

The agent may recommend, route, rank, hold, and escalate; it must not self-approve high-risk actions.
