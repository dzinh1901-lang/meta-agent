#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { loadRegistry, findRepository } = require('../src/repository-registry');
const { buildTaskPacket } = require('../src/task-packet-builder');
const { createOrchestratorAdapter, listOrchestratorCompatibility } = require('../src/orchestrators/orchestrator-registry');
const { buildPortfolioRoutingPlan } = require('../src/orchestrators/portfolio-router');
const { selectOversightAgent, listOversightAgents } = require('../src/oversight/oversight-registry');
const { classifyAction } = require('../src/policy-engine');
const { classifyProcurementRequest, buildVendorRiskMatrix } = require('../src/procurement/procurement-policy');
const { buildProcurementWorkflow } = require('../src/procurement/procurement-workflow');
const { recordApprovalDecision, applyApprovalDecision, resumeRunFromApprovalQueue } = require('../src/run-state');

const registry = loadRegistry();
const compatibility = listOrchestratorCompatibility(registry);
assert.equal(compatibility.length, registry.repositories.length);

const aureleanRepo = findRepository(registry, 'dzinh1901-lang/aurelean-app');
const aureleanAdapter = createOrchestratorAdapter('dzinh1901-lang/aurelean-app', registry);
assert.equal(aureleanAdapter.getProfile().known, true);
assert.equal(aureleanAdapter.getProfile().orchestrator_path, aureleanRepo.orchestrator.path);

const unknownAdapter = createOrchestratorAdapter('dzinh1901-lang/agentops-runtime', registry);
assert.equal(unknownAdapter.getProfile().known, false);
const unknownTask = buildTaskPacket({
  registry,
  objective: 'Inspect agentops runtime metadata.',
  repository: 'dzinh1901-lang/agentops-runtime',
  actionType: 'read_repository_metadata',
  auditCorrelationId: 'corr_unknown'
});
assert.equal(unknownAdapter.prepareDispatch(unknownTask).status, 'discovery_required');

const restrictedAdapter = createOrchestratorAdapter('dzinh1901-lang/naval-defence-catalogue', registry);
const restrictedTask = buildTaskPacket({
  registry,
  objective: 'Inspect restricted repository metadata.',
  repository: 'dzinh1901-lang/naval-defence-catalogue',
  actionType: 'read_repository_metadata',
  auditCorrelationId: 'corr_restricted'
});
assert.equal(restrictedAdapter.prepareDispatch(restrictedTask).status, 'blocked');

const routingPlan = buildPortfolioRoutingPlan({
  registry,
  objective: 'Prepare read-only health summaries.',
  repositories: ['dzinh1901-lang/aurelean-app', 'dzinh1901-lang/designOS-App', 'dzinh1901-lang/agentops-runtime'],
  action: { type: 'read_repository_metadata', summary: 'Prepare read-only health summaries.' },
  actionType: 'read_repository_metadata',
  createdAt: '2026-06-18T00:00:00Z'
});
assert.equal(routingPlan.routes.length, 3);
assert.equal(routingPlan.status_summary.prepared, 2);
assert.equal(routingPlan.status_summary.discovery_required, 1);
assert.equal(routingPlan.external_side_effects_executed, false);
assert.equal(new Set(routingPlan.routes.map((route) => route.workflow.task_packet.task_id)).size, 3);
assert.ok(routingPlan.routes.every((route) => route.oversight_agent === 'cross-repository-orchestrator'));

const gatedRouting = buildPortfolioRoutingPlan({
  registry,
  objective: 'Prepare draft pull requests.',
  repositories: ['dzinh1901-lang/aurelean-app', 'dzinh1901-lang/designOS-App'],
  action: { type: 'create_pull_request_draft', summary: 'Prepare draft pull requests.' },
  actionType: 'create_pull_request_draft',
  expiresAt: '2999-01-01T00:00:00Z',
  createdAt: '2026-06-18T00:00:00Z'
});
assert.equal(gatedRouting.status_summary.approval_pending, 2);
assert.ok(gatedRouting.routes.every((route) => route.workflow.approval_packet));
assert.ok(gatedRouting.routes.every((route) => route.workflow.agent_run.status === 'paused_for_approval'));

const blockedRouting = buildPortfolioRoutingPlan({
  registry,
  objective: 'Attempt secret access.',
  repositories: ['dzinh1901-lang/aurelean-app'],
  action: { type: 'request_secret_access', summary: 'Attempt secret access.' },
  actionType: 'request_secret_access',
  createdAt: '2026-06-18T00:00:00Z'
});
assert.equal(blockedRouting.status_summary.blocked, 1);
assert.equal(blockedRouting.routes[0].workflow.approval_packet, null);
assert.equal(blockedRouting.routes[0].workflow.blocked_action.approval_can_override, false);

const response = aureleanAdapter.normalizeResponse({
  status: 'completed',
  outputs: ['project_health'],
  validation_evidence: ['npm run verify: passed'],
  audit_correlation_id: routingPlan.routes[0].workflow.task_packet.audit_correlation_id,
  received_at: '2026-06-18T02:00:00Z'
}, routingPlan.routes[0].workflow.task_packet);
assert.equal(response.status, 'completed');
assert.equal(response.validation_evidence.length, 1);
assert.throws(() => aureleanAdapter.normalizeResponse({ status: 'invalid' }, routingPlan.routes[0].workflow.task_packet));

assert.equal(selectOversightAgent(classifyAction('procurement_vendor_research')).name, 'procurement-oversight-agent');
assert.equal(selectOversightAgent(classifyAction('publish_public_marketing')).name, 'marketing-oversight-agent');
assert.equal(selectOversightAgent(classifyAction('deploy_production')).name, 'security-compliance-agent');
assert.equal(selectOversightAgent(classifyAction('read_repository_metadata'), 'Create audit evidence').name, 'audit-evidence-agent');
assert.equal(listOversightAgents().length, 6);

const researchDecision = classifyProcurementRequest({ intent: 'research', estimated_cost: 0 });
assert.equal(researchDecision.blocked, false);
assert.equal(researchDecision.allowed, true);
assert.equal(researchDecision.risk, 'medium');

const shortlistDecision = classifyProcurementRequest({
  intent: 'shortlist',
  estimated_cost: 12000,
  data_access: true,
  contract_required: true
});
assert.equal(shortlistDecision.blocked, false);
assert.equal(shortlistDecision.requiresHumanApproval, true);
assert.ok(shortlistDecision.approvals.includes('procurement_approver'));
assert.ok(shortlistDecision.approvals.includes('security_approver'));
assert.ok(shortlistDecision.approvals.includes('legal_compliance_approver'));
assert.ok(shortlistDecision.approvals.includes('finance_approver'));

const controlledDecision = classifyProcurementRequest({ intent: 'award', controlled_goods: true, estimated_cost: 5000 });
assert.equal(controlledDecision.blocked, true);
assert.equal(controlledDecision.requiresHumanApproval, false);
assert.ok(controlledDecision.reason.includes('Controlled-goods'));

const vendorMatrix = buildVendorRiskMatrix([
  { vendor_name: 'High Risk Vendor', data_access: true, system_access: true, security_review_status: 'pending', legal_review_status: 'pending', sole_source: true },
  { vendor_name: 'Reviewed Vendor', security_review_status: 'approved', legal_review_status: 'approved' }
]);
assert.equal(vendorMatrix.length, 2);
assert.equal(vendorMatrix[0].risk_level, 'critical');
assert.equal(vendorMatrix[1].risk_level, 'low');

const procurementWorkflow = buildProcurementWorkflow({
  registry,
  repository: 'dzinh1901-lang/aurelean-app',
  summary: 'Shortlist analytics vendors.',
  intent: 'shortlist',
  estimated_cost: 12000,
  budget_owner: 'portfolio_principal',
  contract_required: true,
  data_access: true,
  vendors: [{ vendor_name: 'Vendor Alpha', data_access: true, security_review_status: 'pending', legal_review_status: 'pending' }],
  expiresAt: '2999-01-01T00:00:00Z',
  createdAt: '2026-06-18T00:00:00Z'
});
assert.equal(procurementWorkflow.mode, 'dry-run');
assert.equal(procurementWorkflow.external_side_effects_executed, false);
assert.equal(procurementWorkflow.procurement_brief.autonomous_spend_allowed, false);
assert.equal(procurementWorkflow.procurement_brief.autonomous_vendor_award_allowed, false);
assert.equal(procurementWorkflow.task_workflow.agent_run.status, 'paused_for_approval');
assert.ok(procurementWorkflow.task_workflow.approval_packet.required_approver_roles.length >= 4);

const blockedProcurement = buildProcurementWorkflow({
  registry,
  repository: 'dzinh1901-lang/aurelean-app',
  summary: 'Blocked controlled-goods request.',
  intent: 'award',
  controlled_goods: true,
  estimated_cost: 5000,
  createdAt: '2026-06-18T00:00:00Z'
});
assert.equal(blockedProcurement.task_workflow.agent_run.status, 'blocked');
assert.equal(blockedProcurement.task_workflow.approval_packet, null);
assert.equal(blockedProcurement.procurement_brief.recommendation, 'stop_and_escalate_to_legal_compliance');

let approvalQueue = procurementWorkflow.task_workflow.pending_approval;
const pausedRun = procurementWorkflow.task_workflow.agent_run;
for (const role of approvalQueue.required_approver_roles.slice(0, -1)) {
  const decision = recordApprovalDecision({
    pendingApproval: approvalQueue,
    decisionType: 'approve_once',
    approverRole: role,
    decidedAt: '2026-06-18T03:00:00Z'
  });
  approvalQueue = applyApprovalDecision(approvalQueue, decision);
  assert.equal(approvalQueue.status, 'pending');
  assert.equal(resumeRunFromApprovalQueue(pausedRun, approvalQueue).status, 'paused_for_approval');
}
const finalRole = approvalQueue.required_approver_roles.at(-1);
const finalDecision = recordApprovalDecision({
  pendingApproval: approvalQueue,
  decisionType: 'approve_once',
  approverRole: finalRole,
  decidedAt: '2026-06-18T03:30:00Z'
});
approvalQueue = applyApprovalDecision(approvalQueue, finalDecision);
assert.equal(approvalQueue.status, 'approved');
assert.equal(resumeRunFromApprovalQueue(pausedRun, approvalQueue).status, 'running');

console.log(JSON.stringify({ ok: true, suite: 'phase4-routing-procurement', assertions: 63 }, null, 2));
