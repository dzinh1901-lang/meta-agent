'use strict';

const { stableId, normalizeArray, requireNonEmptyString } = require('../packet-utils');

const VALID_ORCHESTRATOR_RESPONSE_STATUSES = ['accepted', 'planned', 'running', 'completed', 'blocked', 'failed'];

class RepositoryOrchestratorAdapter {
  constructor(profile) {
    this.repository = requireNonEmptyString(profile.repository, 'profile.repository');
    this.orchestratorPath = profile.orchestratorPath || null;
    this.known = Boolean(profile.known && this.orchestratorPath);
    this.approvalPolicyKnown = Boolean(profile.approvalPolicyKnown);
    this.restricted = Boolean(profile.restricted);
    this.domain = profile.domain || 'unknown';
    this.defaultBranch = profile.defaultBranch || 'main';
    this.discoveryTargets = normalizeArray(profile.discoveryTargets);
    this.mode = 'dry_run';
  }

  getProfile() {
    return {
      repository: this.repository,
      orchestrator_path: this.orchestratorPath,
      known: this.known,
      approval_policy_known: this.approvalPolicyKnown,
      restricted: this.restricted,
      domain: this.domain,
      default_branch: this.defaultBranch,
      mode: this.mode
    };
  }

  prepareDispatch(taskPacket) {
    if (!taskPacket || taskPacket.repository !== this.repository) {
      throw new Error(`Task packet repository does not match adapter: ${this.repository}`);
    }

    let status = 'prepared';
    const reasons = [];

    if (taskPacket.blocked || taskPacket.execution_disposition === 'blocked') {
      status = 'blocked';
      reasons.push(...normalizeArray(taskPacket.block_reasons));
    } else if (this.restricted) {
      status = 'blocked';
      reasons.push('Repository is restricted pending legal/compliance review.');
    } else if (!this.known) {
      status = 'discovery_required';
      reasons.push('No repository orchestrator is confirmed.');
    } else if (!this.approvalPolicyKnown) {
      status = 'discovery_required';
      reasons.push('Repository approval policy is not confirmed.');
    } else if (taskPacket.requires_human_approval && taskPacket.approval_status !== 'approved') {
      status = taskPacket.approval_id ? 'approval_pending' : 'approval_required';
      reasons.push('Scoped human approval is required before routing this task for execution.');
    }

    const base = {
      mode: this.mode,
      status,
      repository: this.repository,
      target_orchestrator: this.orchestratorPath,
      task_id: taskPacket.task_id,
      approval_id: taskPacket.approval_id || null,
      action_type: taskPacket.action_type,
      audit_correlation_id: taskPacket.audit_correlation_id,
      requested_outputs: taskPacket.requested_outputs,
      validation_requirements: taskPacket.validation_requirements,
      reasons,
      external_side_effect_executed: false,
      discovery_targets: status === 'discovery_required' ? this.discoveryTargets : []
    };

    return { dispatch_id: stableId('dispatch', base), ...base };
  }

  normalizeResponse(response, taskPacket) {
    if (!response || typeof response !== 'object') throw new Error('Orchestrator response must be an object.');
    if (!VALID_ORCHESTRATOR_RESPONSE_STATUSES.includes(response.status)) {
      throw new Error(`Invalid orchestrator response status: ${response.status}`);
    }
    const correlationId = response.audit_correlation_id || taskPacket.audit_correlation_id;
    if (correlationId !== taskPacket.audit_correlation_id) {
      throw new Error('Orchestrator response correlation ID does not match task packet.');
    }
    return {
      response_id: response.response_id || stableId('response', {
        repository: this.repository,
        task_id: taskPacket.task_id,
        status: response.status,
        outputs: response.outputs || []
      }),
      repository: this.repository,
      task_id: taskPacket.task_id,
      orchestrator_path: this.orchestratorPath,
      status: response.status,
      outputs: normalizeArray(response.outputs),
      validation_evidence: normalizeArray(response.validation_evidence),
      blockers: normalizeArray(response.blockers),
      next_actions: normalizeArray(response.next_actions),
      audit_correlation_id: correlationId,
      received_at: response.received_at || new Date().toISOString()
    };
  }
}

module.exports = { VALID_ORCHESTRATOR_RESPONSE_STATUSES, RepositoryOrchestratorAdapter };
