#!/usr/bin/env node
'use strict';

const { buildTaskApprovalWorkflow } = require('../src/packet-workflow');

const workflow = buildTaskApprovalWorkflow({
  objective: 'Create a draft PR task packet for read-only project health reporting across AURELEAN and DesignOS.',
  repository: 'dzinh1901-lang/aurelean-app',
  affectedRepositories: ['dzinh1901-lang/aurelean-app', 'dzinh1901-lang/designOS-App'],
  action: {
    type: 'create_pull_request_draft',
    summary: 'Create a draft PR for read-only project health reporting across AURELEAN and DesignOS.'
  },
  actionType: 'create_pull_request_draft',
  requestedOutputs: ['task_packet', 'approval_packet', 'validation_plan', 'audit_summary'],
  validationRequirements: ['npm run validate', 'npm run test:phase2', 'human approval before PR creation'],
  evidenceBundle: {
    policy_version: '0.2.0',
    evidence_refs: ['PRD.md', 'ARCHITECTURE.md', 'policies/authorization-matrix.yaml']
  },
  expectedOutcome: 'Draft PR packet only. No merge, deploy, billing, spend, external message, or secret access.',
  rollbackPlan: 'Reject the approval packet and do not create the PR.',
  constraints: {
    forbidden_actions: ['merge_pull_request', 'trigger_deployment', 'request_secret_access', 'publish_public_marketing', 'procurement_vendor_award']
  },
  expiresAt: '2999-01-01T00:00:00Z',
  createdAt: '2026-06-18T00:00:00Z'
});

console.log(JSON.stringify(workflow, null, 2));
