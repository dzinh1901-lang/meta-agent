#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const {
  classifyAction,
  approvalCoversAction,
  summarizePolicy
} = require('../src/policy-engine');
const { evaluateToolGuardrail } = require('../src/guardrails');
const { validateApprovalDecision } = require('../src/approval-policy');

function futureApproval(actionType, roles) {
  return {
    status: 'approved',
    approved_actions: [actionType],
    approver_roles: roles,
    expires_at: '2999-01-01T00:00:00Z'
  };
}

function expiredApproval(actionType, roles) {
  return {
    status: 'approved',
    approved_actions: [actionType],
    approver_roles: roles,
    expires_at: '2000-01-01T00:00:00Z'
  };
}

const summary = summarizePolicy();
assert.equal(summary.default_mode, 'read_only_until_authorized');
assert.equal(summary.self_approval_allowed, false);
assert.ok(summary.action_count >= 20);

const readOnly = classifyAction('read_repository_metadata');
assert.equal(readOnly.risk, 'low');
assert.equal(readOnly.allowed, true);
assert.equal(readOnly.requiresHumanApproval, false);
assert.equal(readOnly.blocked, false);
assert.equal(evaluateToolGuardrail({ actionType: 'read_repository_metadata' }).allowed, true);
assert.equal(validateApprovalDecision({ actionType: 'read_repository_metadata' }).executable, true);

const issue = classifyAction('create_github_issue');
assert.equal(issue.risk, 'medium');
assert.equal(issue.allowed, false);
assert.equal(issue.requiresHumanApproval, true);
assert.equal(issue.blocked, false);
assert.equal(evaluateToolGuardrail({ actionType: 'create_github_issue' }).allowed, false);

const issueApproval = futureApproval('create_github_issue', ['engineering_approver']);
assert.equal(approvalCoversAction(issue, issueApproval), true);
assert.equal(evaluateToolGuardrail({ actionType: 'create_github_issue', approval: issueApproval }).allowed, true);
assert.equal(validateApprovalDecision({ actionType: 'create_github_issue', approval: issueApproval }).executable, true);

const missingRoleApproval = futureApproval('create_github_issue', []);
assert.equal(approvalCoversAction(issue, missingRoleApproval), false);
assert.equal(evaluateToolGuardrail({ actionType: 'create_github_issue', approval: missingRoleApproval }).allowed, false);
assert.ok(validateApprovalDecision({ actionType: 'create_github_issue', approval: missingRoleApproval }).errors.includes('Missing required approver role: engineering_approver'));

const expiredIssueApproval = expiredApproval('create_github_issue', ['engineering_approver']);
assert.equal(approvalCoversAction(issue, expiredIssueApproval), false);
assert.ok(validateApprovalDecision({ actionType: 'create_github_issue', approval: expiredIssueApproval }).errors.includes('Approval has expired.'));

const unknown = classifyAction('unknown_action');
assert.equal(unknown.risk, 'critical');
assert.equal(unknown.allowed, false);
assert.equal(unknown.blocked, true);
assert.equal(evaluateToolGuardrail({ actionType: 'unknown_action' }).allowed, false);

const secret = classifyAction('request_secret_access');
assert.equal(secret.risk, 'critical');
assert.equal(secret.blocked, true);
assert.equal(secret.allowed, false);
const secretApproval = futureApproval('request_secret_access', ['security_approver', 'principal_approver']);
assert.equal(evaluateToolGuardrail({ actionType: 'request_secret_access', approval: secretApproval }).allowed, false);
assert.equal(validateApprovalDecision({ actionType: 'request_secret_access', approval: secretApproval }).executable, false);

const merge = classifyAction('merge_pull_request');
assert.equal(merge.blocked, true);
assert.ok(merge.reason.includes('prohibited in v1'));

const regulatedProcurement = classifyAction('procurement_vendor_award', { regulatedDomain: true });
assert.equal(regulatedProcurement.blocked, true);
assert.ok(regulatedProcurement.reason.includes('Regulated-domain'));

const selfApproval = classifyAction('deploy_production', { selfApprovalAttempt: true });
assert.equal(selfApproval.blocked, true);
assert.ok(selfApproval.reason.includes('Self-approval is blocked'));

console.log(JSON.stringify({ ok: true, suite: 'phase2-policy', assertions: 37 }, null, 2));
