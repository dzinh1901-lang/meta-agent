#!/usr/bin/env node
'use strict';

const { summarizePolicy, classifyAction } = require('../src/policy-engine');
const { evaluateToolGuardrail } = require('../src/guardrails');
const { validateApprovalDecision } = require('../src/approval-policy');

const futureApproval = {
  status: 'approved',
  approved_actions: ['create_github_issue'],
  approver_roles: ['engineering_approver'],
  expires_at: '2999-01-01T00:00:00Z'
};

const checks = [
  { actionType: 'read_repository_metadata', context: {} },
  { actionType: 'create_pull_request_draft', context: {} },
  { actionType: 'request_secret_access', context: {} },
  { actionType: 'deploy_production', context: { selfApprovalAttempt: true } },
  { actionType: 'procurement_vendor_award', context: { vendorAwardWithoutApproval: true } },
  { actionType: 'create_github_issue', context: {}, approval: futureApproval },
  { actionType: 'unknown_action', context: {} }
];

console.log(JSON.stringify({
  policy: summarizePolicy(),
  decisions: checks.map((check) => ({
    input: check,
    decision: classifyAction(check.actionType, check.context),
    guardrail: evaluateToolGuardrail(check),
    approval_validation: validateApprovalDecision(check)
  }))
}, null, 2));
