#!/usr/bin/env node
'use strict';

const { buildPortfolioRoutingPlan } = require('../src/orchestrators/portfolio-router');

const plan = buildPortfolioRoutingPlan({
  objective: 'Prepare read-only project-health reports for AURELEAN, DesignOS, and a repository still awaiting orchestrator discovery.',
  repositories: [
    'dzinh1901-lang/aurelean-app',
    'dzinh1901-lang/designOS-App',
    'dzinh1901-lang/agentops-runtime'
  ],
  action: {
    type: 'read_repository_metadata',
    summary: 'Read repository metadata and prepare project-health reports.'
  },
  actionType: 'read_repository_metadata',
  requestedOutputs: ['project_health', 'orchestrator_status', 'validation_commands'],
  validationRequirements: ['read-only evidence only', 'unknown repository facts remain unknown'],
  createdAt: '2026-06-18T00:00:00Z'
});

console.log(JSON.stringify(plan, null, 2));
