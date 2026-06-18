'use strict';

const { stableId, normalizeArray, requireNonEmptyString, assertRequiredFields } = require('./packet-utils');

const AGENT_RUN_REQUIRED_FIELDS = ['run_id', 'agent', 'status', 'input_summary', 'outputs', 'audit_correlation_id'];
const VALID_APPROVAL_DECISIONS = ['approve_once', 'approve_with_limits', 'reject', 'request_changes', 'always_reject'];

function createAgentRun({ agent = 'meta-chief-of-staff-agent', inputSummary, auditCorrelationId, outputs = [], approvalIds = [], status = 'planned', createdAt }) {
  const summary = requireNonEmptyString(inputSummary, 'inputSummary');
  const corr = requireNonEmptyString(auditCorrelationId, 'auditCorrelationId');
  const base = {
    agent,
    status,
    input_summary: summary,
    outputs: normalizeArray(outputs),
    approval_ids: normalizeArray(approvalIds),
    audit_correlation_id: corr,
    created_at: createdAt || new Date().toISOString()
  };
  const run = { run_id: stableId('run', { agent, input_summary: summary, audit_correlation_id: corr }), ...base };
  return assertRequiredFields(run, AGENT_RUN_REQUIRED_FIELDS, 'AgentRun');
}

function createPendingApproval({ approvalPacket, taskPacket = null, run = null, createdAt }) {
  if (!approvalPacket || !approvalPacket.approval_id) throw new Error('approvalPacket with approval_id is required.');
  const base = {
    approval_id: approvalPacket.approval_id,
    task_id: taskPacket ? taskPacket.task_id : null,
    run_id: run ? run.run_id : null,
    action_type: approvalPacket.action_type,
    risk_level: approvalPacket.risk_level,
    required_approver_roles: approvalPacket.required_approver_roles,
    status: 'pending',
    expires_at: approvalPacket.expires_at,
    created_at: createdAt || new Date().toISOString()
  };
  return { queue_id: stableId('queue', base), ...base };
}

function pauseRunForApproval(run, approvalPacket, taskPacket = null) {
  const approvalIds = Array.from(new Set([...(run.approval_ids || []), approvalPacket.approval_id]));
  return {
    ...run,
    status: 'paused_for_approval',
    approval_ids: approvalIds,
    outputs: [
      ...(run.outputs || []),
      {
        type: 'pending_approval',
        approval_id: approvalPacket.approval_id,
        task_id: taskPacket ? taskPacket.task_id : null,
        action_type: approvalPacket.action_type,
        risk_level: approvalPacket.risk_level
      }
    ]
  };
}

function recordApprovalDecision({ pendingApproval, decisionType, approverRole, decidedAt, constraints = {}, notes = '' }) {
  if (!pendingApproval || !pendingApproval.approval_id) throw new Error('pendingApproval with approval_id is required.');
  if (!VALID_APPROVAL_DECISIONS.includes(decisionType)) throw new Error(`Invalid approval decision: ${decisionType}`);
  const role = requireNonEmptyString(approverRole, 'approverRole');
  const base = {
    approval_id: pendingApproval.approval_id,
    queue_id: pendingApproval.queue_id || null,
    decision_type: decisionType,
    approver_role: role,
    decided_at: decidedAt || new Date().toISOString(),
    constraints,
    notes
  };
  return { decision_id: stableId('decision', base), ...base };
}

function resumeRunFromApprovalDecision(run, decisionRecord) {
  if (!decisionRecord || !decisionRecord.decision_type) throw new Error('decisionRecord is required.');
  const approved = decisionRecord.decision_type === 'approve_once' || decisionRecord.decision_type === 'approve_with_limits';
  const status = approved ? 'running' : 'blocked';
  return {
    ...run,
    status,
    approval_decision_ids: Array.from(new Set([...(run.approval_decision_ids || []), decisionRecord.decision_id])),
    outputs: [
      ...(run.outputs || []),
      {
        type: 'approval_decision',
        approval_id: decisionRecord.approval_id,
        decision_id: decisionRecord.decision_id,
        decision_type: decisionRecord.decision_type,
        next_status: status
      }
    ]
  };
}

module.exports = { AGENT_RUN_REQUIRED_FIELDS, VALID_APPROVAL_DECISIONS, createAgentRun, createPendingApproval, pauseRunForApproval, recordApprovalDecision, resumeRunFromApprovalDecision };
