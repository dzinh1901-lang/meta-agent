'use strict';

const ACTIONS = {
  read_repository_metadata: { risk: 'low', approvals: [] },
  create_internal_plan: { risk: 'low', approvals: [] },
  create_internal_task_packet: { risk: 'medium', approvals: [] },
  create_github_issue: { risk: 'medium', approvals: ['engineering_approver'] },
  create_pull_request_draft: { risk: 'high', approvals: ['engineering_approver'] },
  mutate_code: { risk: 'high', approvals: ['engineering_approver'] },
  modify_auth_tenant_security: { risk: 'critical', approvals: ['security_approver', 'engineering_approver'] },
  activate_live_billing: { risk: 'critical', approvals: ['principal_approver', 'finance_approver', 'security_approver'] },
  deploy_production: { risk: 'critical', approvals: ['principal_approver', 'engineering_approver', 'security_approver'] },
  send_external_message: { risk: 'high', approvals: ['marketing_approver', 'principal_approver'] },
  publish_public_marketing: { risk: 'critical', approvals: ['marketing_approver', 'principal_approver'] },
  commit_paid_marketing_spend: { risk: 'critical', approvals: ['marketing_approver', 'finance_approver', 'principal_approver'] },
  procurement_vendor_research: { risk: 'medium', approvals: [] },
  procurement_vendor_award: { risk: 'critical', approvals: ['procurement_approver', 'finance_approver', 'principal_approver'] },
  contract_or_legal_commitment: { risk: 'critical', approvals: ['legal_compliance_approver', 'principal_approver'] },
  export_customer_or_supplier_data: { risk: 'critical', approvals: ['security_approver', 'legal_compliance_approver', 'principal_approver'] },
  regulated_domain_action: { risk: 'critical', approvals: ['legal_compliance_approver', 'security_approver', 'principal_approver'], defaultBlock: true }
};

function classifyAction(actionType, context = {}) {
  const action = ACTIONS[actionType];
  if (!action) {
    return {
      actionType,
      risk: 'critical',
      approvals: ['principal_approver', 'security_approver'],
      allowed: false,
      requiresHumanApproval: true,
      reason: 'Unknown action type. Policy fails closed.'
    };
  }

  const reasons = [];
  let allowed = true;

  if (context.selfApprovalAttempt) {
    allowed = false;
    reasons.push('Self-approval is blocked.');
  }
  if (context.bypassRepositoryOrchestrator) {
    allowed = false;
    reasons.push('Bypassing repository orchestrator is blocked.');
  }
  if (context.requestsSecrets) {
    allowed = false;
    reasons.push('Secret access is blocked by default.');
  }
  if (context.regulatedDomain && actionType.includes('procurement')) {
    allowed = false;
    reasons.push('Regulated-domain procurement is blocked without explicit legal/compliance authorization.');
  }
  if (action.defaultBlock) {
    allowed = false;
    reasons.push('Action is default-blocked until explicit human authorization.');
  }

  const requiresHumanApproval = action.risk === 'high' || action.risk === 'critical' || action.approvals.length > 0;

  return {
    actionType,
    risk: action.risk,
    approvals: action.approvals,
    allowed: allowed && !requiresHumanApproval,
    requiresHumanApproval,
    reason: reasons.length ? reasons.join(' ') : 'Classified by action risk policy.'
  };
}

module.exports = { ACTIONS, classifyAction };
