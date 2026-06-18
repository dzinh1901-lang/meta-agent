'use strict';

const { loadRegistry, findRepository } = require('../repository-registry');
const { RepositoryOrchestratorAdapter } = require('./repository-orchestrator-adapter');

function profileFromRepository(repo) {
  if (!repo) return null;
  return {
    repository: repo.repository_full_name,
    orchestratorPath: repo.orchestrator ? repo.orchestrator.path : null,
    known: Boolean(repo.orchestrator && repo.orchestrator.known),
    approvalPolicyKnown: Boolean(repo.orchestrator && repo.orchestrator.approval_policy_known),
    restricted: Boolean(repo.oversight_status && repo.oversight_status.includes('restricted')),
    domain: repo.domain_guess || 'unknown',
    defaultBranch: repo.default_branch || 'main',
    discoveryTargets: repo.required_next_discovery || []
  };
}

function createUnknownProfile(repository) {
  return {
    repository,
    orchestratorPath: null,
    known: false,
    approvalPolicyKnown: false,
    restricted: false,
    domain: 'unknown',
    defaultBranch: 'main',
    discoveryTargets: [
      'README.md',
      'package.json',
      '.claude/agents/registry.json',
      '.codex/agents.registry.json',
      'docs/agents/SUBAGENTS.md',
      'ROADMAP.md',
      'PRD.md',
      'TASKS.md'
    ]
  };
}

function createOrchestratorAdapter(repository, registry = loadRegistry()) {
  const repo = findRepository(registry, repository);
  return new RepositoryOrchestratorAdapter(profileFromRepository(repo) || createUnknownProfile(repository));
}

function listOrchestratorCompatibility(registry = loadRegistry()) {
  return registry.repositories.map((repo) => createOrchestratorAdapter(repo.repository_full_name, registry).getProfile());
}

module.exports = { profileFromRepository, createUnknownProfile, createOrchestratorAdapter, listOrchestratorCompatibility };
