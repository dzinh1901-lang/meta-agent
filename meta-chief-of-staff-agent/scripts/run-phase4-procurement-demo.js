#!/usr/bin/env node
'use strict';

const { buildProcurementWorkflow } = require('../src/procurement/procurement-workflow');

const workflow = buildProcurementWorkflow({
  repository: 'dzinh1901-lang/aurelean-app',
  summary: 'Compare SaaS vendors for read-only project analytics.',
  intent: 'shortlist',
  category: 'software_service',
  estimated_cost: 12000,
  currency: 'USD',
  budget_owner: 'portfolio_principal',
  contract_required: true,
  legal_compliance_review_id: 'legal-review-demo-001',
  security_review_id: 'security-review-demo-001',
  data_access: true,
  system_access: false,
  cross_border: false,
  vendors: [
    {
      vendor_id: 'vendor_alpha',
      vendor_name: 'Vendor Alpha',
      data_access: true,
      security_review_status: 'pending',
      legal_review_status: 'pending',
      evidence_refs: ['vendor-alpha-security-questionnaire']
    },
    {
      vendor_id: 'vendor_beta',
      vendor_name: 'Vendor Beta',
      data_access: false,
      security_review_status: 'approved',
      legal_review_status: 'pending',
      evidence_refs: ['vendor-beta-security-review']
    }
  ],
  evidence_refs: ['internal-software-requirements'],
  expiresAt: '2999-01-01T00:00:00Z',
  createdAt: '2026-06-18T00:00:00Z'
});

console.log(JSON.stringify(workflow, null, 2));
