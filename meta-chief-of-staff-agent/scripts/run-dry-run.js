#!/usr/bin/env node
'use strict';

const { planAction } = require('../src/meta-chief-agent');

const plan = planAction({
  action: {
    type: 'create_pull_request_draft',
    summary: 'Create a draft PR for read-only project health reporting across AURELEAN and DesignOS.'
  },
  repositories: ['dzinh1901-lang/aurelean-app', 'dzinh1901-lang/designOS-App'],
  context: {
    selfApprovalAttempt: false,
    bypassRepositoryOrchestrator: false,
    requestsSecrets: false,
    regulatedDomain: false
  },
  expectedOutcome: 'Draft PR only. No merge, deploy, credential, billing, procurement, or external messaging action.',
  rollbackPlan: 'Close draft PR and delete branch if human reviewer rejects scope.',
  constraints: {
    allowed_actions: ['create_draft_pr', 'attach_docs', 'run_validation'],
    forbidden_actions: ['merge', 'deploy', 'access_secrets', 'send_external_message', 'commit_spend']
  }
});

console.log(JSON.stringify(plan, null, 2));
