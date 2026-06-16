'use strict';

const fs = require('node:fs');
const path = require('node:path');

function loadRegistry(registryPath = path.join(__dirname, '..', 'registries', 'repositories.seed.json')) {
  const raw = fs.readFileSync(registryPath, 'utf8');
  const registry = JSON.parse(raw);
  if (!Array.isArray(registry.repositories)) {
    throw new Error('Repository registry is missing repositories array.');
  }
  return registry;
}

function findRepository(registry, fullName) {
  return registry.repositories.find((repo) => repo.repository_full_name === fullName);
}

function knownOrchestrators(registry) {
  return registry.repositories.filter((repo) => repo.orchestrator && repo.orchestrator.known);
}

module.exports = { loadRegistry, findRepository, knownOrchestrators };
