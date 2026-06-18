import { handoff, type RunContext } from '@openai/agents';
import { z } from 'zod';
import type { MetaAgentContext } from './context.js';
import {
  auditEvidenceAgent,
  crossRepositoryAgent,
  financeOpsAgent,
  marketingOversightAgent,
  procurementOversightAgent,
  securityComplianceAgent,
} from './specialists.js';
import { requireAuthorizedRepositories } from './runtime-helpers.js';

const { stableId } = require('../packet-utils.js') as {
  stableId: (prefix: string, payload: unknown) => string;
};

export const SpecialistHandoffInput = z.object({
  reason: z.string().min(1),
  objective: z.string().min(1),
  repositories: z.array(z.string().min(1)).default([]),
  actionType: z.string().min(1).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  evidenceRefs: z.array(z.string()).default([]),
});

export type SpecialistHandoffInput = z.infer<typeof SpecialistHandoffInput>;

function handoffAuditHandler(specialist: string) {
  return async (runContext: RunContext<MetaAgentContext>, input?: SpecialistHandoffInput): Promise<void> => {
    if (!input) throw new Error('Structured handoff input is required.');
    const context = runContext.context;
    requireAuthorizedRepositories(context, input.repositories);
    const event = {
      handoff_event_id: stableId('handoff', {
        specialist,
        operator_id: context.operatorId,
        reason: input.reason,
        objective: input.objective,
        repositories: input.repositories,
        action_type: input.actionType ?? null,
        priority: input.priority,
      }),
      event_type: 'specialist_handoff',
      specialist,
      operator_id: context.operatorId,
      operator_roles: context.operatorRoles,
      reason: input.reason,
      objective: input.objective,
      repositories: input.repositories,
      action_type: input.actionType ?? null,
      priority: input.priority,
      evidence_refs: input.evidenceRefs,
      environment: context.environment,
      external_side_effect_executed: false,
      recorded_at: new Date().toISOString(),
    };
    await context.stateStore.put('handoffEvents', event.handoff_event_id, event);
    await context.stateStore.put('auditEvents', event.handoff_event_id, event);
  };
}

export const crossRepositoryHandoff = handoff(crossRepositoryAgent, {
  toolNameOverride: 'handoff_to_cross_repository_orchestrator',
  toolDescriptionOverride: 'Transfer control for multi-repository discovery, orchestrator compatibility, routing plans, and response normalization.',
  inputType: SpecialistHandoffInput,
  onHandoff: handoffAuditHandler('cross-repository-orchestrator'),
});

export const procurementHandoff = handoff(procurementOversightAgent, {
  toolNameOverride: 'handoff_to_procurement_oversight',
  toolDescriptionOverride: 'Transfer control for vendor comparison, procurement readiness, budget gates, and procurement approval artifacts.',
  inputType: SpecialistHandoffInput,
  onHandoff: handoffAuditHandler('procurement-oversight-agent'),
});

export const marketingHandoff = handoff(marketingOversightAgent, {
  toolNameOverride: 'handoff_to_marketing_oversight',
  toolDescriptionOverride: 'Transfer control for campaign briefs, claim evidence, attribution readiness, privacy review, and publication or spend approvals.',
  inputType: SpecialistHandoffInput,
  onHandoff: handoffAuditHandler('marketing-oversight-agent'),
});

export const financeHandoff = handoff(financeOpsAgent, {
  toolNameOverride: 'handoff_to_finance_ops',
  toolDescriptionOverride: 'Transfer control for budget review, spend thresholds, billing readiness, and finance approval requirements.',
  inputType: SpecialistHandoffInput,
  onHandoff: handoffAuditHandler('finance-ops-agent'),
});

export const securityHandoff = handoff(securityComplianceAgent, {
  toolNameOverride: 'handoff_to_security_compliance',
  toolDescriptionOverride: 'Transfer control for security, privacy, authentication, tenant, production, secret, and regulated-domain review.',
  inputType: SpecialistHandoffInput,
  onHandoff: handoffAuditHandler('security-compliance-agent'),
});

export const auditHandoff = handoff(auditEvidenceAgent, {
  toolNameOverride: 'handoff_to_audit_evidence',
  toolDescriptionOverride: 'Transfer control for evidence-only summaries, approval status, correlated IDs, missing evidence, and audit synthesis.',
  inputType: SpecialistHandoffInput,
  onHandoff: handoffAuditHandler('audit-evidence-agent'),
});

export const specialistHandoffs = [
  crossRepositoryHandoff,
  procurementHandoff,
  marketingHandoff,
  financeHandoff,
  securityHandoff,
  auditHandoff,
];

export const SPECIALIST_HANDOFF_TOOL_NAMES = [
  'handoff_to_cross_repository_orchestrator',
  'handoff_to_procurement_oversight',
  'handoff_to_marketing_oversight',
  'handoff_to_finance_ops',
  'handoff_to_security_compliance',
  'handoff_to_audit_evidence',
] as const;
