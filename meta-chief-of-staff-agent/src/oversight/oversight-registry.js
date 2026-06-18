'use strict';

const OVERSIGHT_AGENTS = {
  cross_repository_orchestrator: {
    name: 'cross-repository-orchestrator',
    categories: ['discovery', 'routing', 'github', 'planning', 'unknown'],
    outputs: ['repository_inventory', 'orchestrator_map', 'project_health_records', 'task_packets'],
    prohibited: ['repository_write', 'self_approval', 'production_mutation']
  },
  procurement_oversight_agent: {
    name: 'procurement-oversight-agent',
    categories: ['procurement'],
    outputs: ['procurement_brief', 'vendor_risk_matrix', 'approval_packet'],
    prohibited: ['vendor_award', 'spend_commitment', 'controlled_goods_procurement', 'self_approval']
  },
  marketing_oversight_agent: {
    name: 'marketing-oversight-agent',
    categories: ['marketing', 'communications'],
    outputs: ['campaign_brief', 'claims_review', 'measurement_plan', 'approval_packet'],
    prohibited: ['public_send', 'customer_supplier_send', 'paid_spend', 'self_approval']
  },
  finance_ops_agent: {
    name: 'finance-ops-agent',
    categories: ['finance', 'billing'],
    outputs: ['budget_review', 'spend_approval_packet', 'billing_readiness_report'],
    prohibited: ['payment_commitment', 'billing_activation', 'self_approval']
  },
  security_compliance_agent: {
    name: 'security-compliance-agent',
    categories: ['security', 'deployment', 'data', 'compliance', 'legal'],
    outputs: ['security_review', 'compliance_review', 'blocked_action_report', 'approval_requirements'],
    prohibited: ['secret_access', 'approval_gate_removal', 'self_approval']
  },
  audit_evidence_agent: {
    name: 'audit-evidence-agent',
    categories: ['audit', 'evidence'],
    outputs: ['evidence_event', 'evidence_bundle_hash', 'audit_summary'],
    prohibited: ['approval_decision_mutation', 'self_approval']
  }
};

function selectOversightAgent(policyDecision, objective = '') {
  const category = policyDecision && policyDecision.category ? policyDecision.category : 'unknown';
  const objectiveText = String(objective).toLowerCase();

  if (objectiveText.includes('audit') || objectiveText.includes('evidence')) return OVERSIGHT_AGENTS.audit_evidence_agent;
  for (const agent of Object.values(OVERSIGHT_AGENTS)) {
    if (agent.categories.includes(category)) return agent;
  }
  return OVERSIGHT_AGENTS.cross_repository_orchestrator;
}

function listOversightAgents() {
  return Object.values(OVERSIGHT_AGENTS).map((agent) => ({ ...agent }));
}

module.exports = { OVERSIGHT_AGENTS, selectOversightAgent, listOversightAgents };
