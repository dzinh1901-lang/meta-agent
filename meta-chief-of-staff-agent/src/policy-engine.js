'use strict';

const RISK_LEVELS = ['low', 'medium', 'high', 'critical'];

const APPROVER_ROLES = {
  principal_approver: 'Portfolio priorities, production gates, major roadmap changes.',
  engineering_approver: 'Code, architecture, validation, release readiness.',
  security_approver: 'Secrets, auth, tenant isolation, data access, live services.',
  finance_approver: 'Budget, spend, vendor payment, billing activation.',
  procurement_approver: 'Vendor selection, supplier process, procurement review.',
  marketing_approver: 'Public claims, publication, outreach, paid media.',
  legal_compliance_approver: 'Contracts, privacy, regulated domains, export-control-sensitive decisions.'
};

const ACTIONS = {
  read_repository_metadata: { risk: 'low', approvals: [], category: 'discovery', effect: 'read' },
  read_repository_file: { risk: 'low', approvals: [], category: 'discovery', effect: 'read' },
  search_repository: { risk: 'low', approvals: [], category: 'discovery', effect: 'read' },
  inspect_project_docs: { risk: 'low', approvals: [], category: 'discovery', effect: 'read' },
  compute_project_health: { risk: 'low', approvals: [], category: 'planning', effect: 'derive' },
  create_internal_plan: { risk: 'low', approvals: [], category: 'planning', effect: 'derive' },
  create_internal_task_packet: { risk: 'medium', approvals: [], category: 'routing', effect: 'derive' },
  route_to_orchestrator_dry_run: { risk: 'medium', approvals: [], category: 'routing', effect: 'derive' },
  create_github_issue: { risk: 'medium', approvals: ['engineering_approver'], category: 'github', effect: 'external_write' },
  create_pull_request_draft: { risk: 'high', approvals: ['engineering_approver'], category: 'github', effect: 'external_write' },
  write_repository_file: { risk: 'high', approvals: ['engineering_approver'], category: 'github', effect: 'external_write' },
  mutate_code: { risk: 'high', approvals: ['engineering_approver'], category: 'github', effect: 'external_write' },
  merge_pull_request: { risk: 'critical', approvals: ['principal_approver', 'engineering_approver'], category: 'github', effect: 'production_path', prohibitedInV1: true },
  modify_auth_tenant_security: { risk: 'critical', approvals: ['security_approver', 'engineering_approver'], category: 'security', effect: 'production_path' },
  activate_live_billing: { risk: 'critical', approvals: ['principal_approver', 'finance_approver', 'security_approver'], category: 'billing', effect: 'production_path' },
  deploy_production: { risk: 'critical', approvals: ['principal_approver', 'engineering_approver', 'security_approver'], category: 'deployment', effect: 'production_path' },
  trigger_deployment: { risk: 'critical', approvals: ['principal_approver', 'engineering_approver', 'security_approver'], category: 'deployment', effect: 'production_path', prohibitedInV1: true },
  send_external_message: { risk: 'high', approvals: ['marketing_approver', 'principal_approver'], category: 'communications', effect: 'external_send' },
  publish_public_marketing: { risk: 'critical', approvals: ['marketing_approver', 'principal_approver'], category: 'marketing', effect: 'external_send' },
  commit_paid_marketing_spend: { risk: 'critical', approvals: ['marketing_approver', 'finance_approver', 'principal_approver'], category: 'marketing', effect: 'spend' },
  procurement_vendor_research: { risk: 'medium', approvals: [], category: 'procurement', effect: 'derive' },
  approve_vendor_shortlist: { risk: 'high', approvals: ['procurement_approver'], category: 'procurement', effect: 'decision' },
  procurement_vendor_award: { risk: 'critical', approvals: ['procurement_approver', 'finance_approver', 'principal_approver'], category: 'procurement', effect: 'commitment' },
  approve_procurement_action: { risk: 'critical', approvals: ['procurement_approver', 'finance_approver', 'principal_approver'], category: 'procurement', effect: 'commitment' },
  approve_budget_change: { risk: 'critical', approvals: ['finance_approver', 'principal_approver'], category: 'finance', effect: 'commitment' },
  contract_or_legal_commitment: { risk: 'critical', approvals: ['legal_compliance_approver', 'principal_approver'], category: 'legal', effect: 'commitment' },
  export_customer_or_supplier_data: { risk: 'critical', approvals: ['security_approver', 'legal_compliance_approver', 'principal_approver'], category: 'data', effect: 'sensitive_export' },
  request_secret_access: { risk: 'critical', approvals: ['security_approver', 'principal_approver'], category: 'security', effect: 'secret_access', defaultBlock: true, prohibitedInV1: true },
  regulated_domain_action: { risk: 'critical', approvals: ['legal_compliance_approver', 'security_approver', 'principal_approver'], category: 'compliance', effect: 'regulated', defaultBlock: true }
};

const HARD_BLOCKS = {
  selfApprovalAttempt: 'Self-approval is blocked.',
  bypassRepositoryOrchestrator: 'Bypassing repository orchestrator is blocked.',
  requestsSecrets: 'Secret access is blocked by default.',
  productionMutationWithoutApproval: 'Production mutation is blocked without scoped human approval.',
  externalMessageWithoutApproval: 'External message delivery is blocked without approval.',
  paidSpendWithoutApproval: 'Paid spend is blocked without finance/principal approval.',
  vendorAwardWithoutApproval: 'Vendor award or procurement commitment is blocked without procurement/finance/principal approval.',
  disableApprovalGates: 'Removing or disabling approval gates is blocked without policy review.',
  regulatedDomain: 'Regulated-domain action is blocked without explicit legal/compliance authorization.'
};

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function approvalRequiredForAction(action) {
  return action.risk === 'high' || action.risk === 'critical' || action.approvals.length > 0;
}

function evaluateHardBlocks(actionType, action, context = {}) {
  const blockReasons = [];
  for (const [key, reason] of Object.entries(HARD_BLOCKS)) {
    if (context[key]) blockReasons.push(reason);
  }
  if (context.regulatedDomain && (actionType.includes('procurement') || action.category === 'compliance')) {
    blockReasons.push('Regulated-domain procurement or compliance action requires legal/compliance approval before routing.');
  }
  if (action.defaultBlock) blockReasons.push('Action is default-blocked until explicit human authorization.');
  if (action.prohibitedInV1) blockReasons.push('Action is prohibited in v1 and must not execute.');
  return unique(blockReasons);
}

function classifyAction(actionType, context = {}) {
  const action = ACTIONS[actionType];
  if (!action) {
    return {
      actionType,
      risk: 'critical',
      approvals: ['principal_approver', 'security_approver'],
      allowed: false,
      blocked: true,
      requiresHumanApproval: true,
      category: 'unknown',
      effect: 'unknown',
      reason: 'Unknown action type. Policy fails closed.',
      blockReasons: ['Unknown action type. Policy fails closed.']
    };
  }

  const blockReasons = evaluateHardBlocks(actionType, action, context);
  const requiresHumanApproval = approvalRequiredForAction(action);
  const blocked = blockReasons.length > 0;
  return {
    actionType,
    risk: action.risk,
    approvals: action.approvals,
    allowed: !blocked && !requiresHumanApproval,
    blocked,
    requiresHumanApproval,
    category: action.category,
    effect: action.effect,
    reason: blockReasons.length ? blockReasons.join(' ') : 'Classified by action risk policy.',
    blockReasons
  };
}

function approvalActions(approval) {
  if (!approval) return [];
  return unique([
    ...(Array.isArray(approval.approved_actions) ? approval.approved_actions : []),
    ...(approval.action_type ? [approval.action_type] : [])
  ]);
}

function approvalRoles(approval) {
  if (!approval || approval.status !== 'approved') return [];
  return unique([
    ...(Array.isArray(approval.approver_roles) ? approval.approver_roles : []),
    ...(Array.isArray(approval.approved_by_roles) ? approval.approved_by_roles : []),
    ...(Array.isArray(approval.required_approver_roles) ? approval.required_approver_roles : [])
  ]);
}

function approvalCoversAction(decision, approval = null, scope = {}) {
  if (!approval || approval.status !== 'approved' || decision.blocked) return false;
  if (typeof approval.expires_at !== 'string') return false;
  const expiryMs = Date.parse(approval.expires_at);
  if (Number.isNaN(expiryMs) || expiryMs <= Date.now()) return false;
  if (!approvalActions(approval).includes(decision.actionType)) return false;
  const required = decision.approvals || [];
  const approvedRoles = approvalRoles(approval);
  if (!required.every((role) => approvedRoles.includes(role))) return false;

  const constraints = approval.constraints || {};
  const allowedRepositories = approval.allowed_repositories || constraints.allowed_repositories || (constraints.allowed_repository ? [constraints.allowed_repository] : null);
  if (scope.repository && Array.isArray(allowedRepositories) && !allowedRepositories.includes(scope.repository)) return false;
  if (scope.environment && constraints.target_environment && constraints.target_environment !== scope.environment) return false;
  const forbiddenActions = constraints.forbidden_actions || [];
  if (forbiddenActions.includes(decision.actionType)) return false;
  return true;
}

function requireApprovalPacket(actionType, context = {}) {
  const decision = classifyAction(actionType, context);
  return !decision.blocked && decision.requiresHumanApproval;
}

function assertAllowed(actionType, context = {}, approval = null, scope = {}) {
  const decision = classifyAction(actionType, context);
  if (decision.allowed) return decision;
  if (approvalCoversAction(decision, approval, scope)) {
    return { ...decision, allowed: true, approvedByPolicy: true };
  }
  const error = new Error(decision.reason);
  error.policyDecision = decision;
  throw error;
}

function summarizePolicy() {
  return {
    risk_levels: RISK_LEVELS,
    approver_roles: APPROVER_ROLES,
    action_count: Object.keys(ACTIONS).length,
    hard_blocks: Object.keys(HARD_BLOCKS),
    default_mode: 'read_only_until_authorized',
    self_approval_allowed: false
  };
}

module.exports = { RISK_LEVELS, APPROVER_ROLES, ACTIONS, HARD_BLOCKS, classifyAction, approvalActions, approvalRoles, approvalCoversAction, requireApprovalPacket, assertAllowed, summarizePolicy };
