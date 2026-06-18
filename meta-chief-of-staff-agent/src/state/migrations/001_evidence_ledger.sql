create extension if not exists pgcrypto;

create table if not exists repositories (
  id text primary key,
  value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists project_health_snapshots (
  id text primary key,
  repository_id text,
  value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists task_packets (
  id text primary key,
  task_id text generated always as (value->>'task_id') stored,
  value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists approval_packets (
  id text primary key,
  approval_id text generated always as (value->>'approval_id') stored,
  value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists approval_queues (
  id text primary key,
  approval_id text not null,
  run_id text,
  value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists approval_decisions (
  id text primary key,
  approval_id text not null,
  queue_id text,
  run_id text,
  value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists evidence_events (
  id text primary key,
  value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists agent_runs (
  id text primary key,
  run_id text not null,
  value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists routing_plans (
  id text primary key,
  routing_plan_id text generated always as (value->>'routing_plan_id') stored,
  value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists procurement_workflows (
  id text primary key,
  value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists backup_plans (
  id text primary key,
  backup_plan_id text generated always as (value->>'backup_plan_id') stored,
  value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists audit_events (
  id text primary key,
  value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists policy_versions (
  id text primary key,
  value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_task_packets_task_id on task_packets (task_id);
create index if not exists idx_approval_packets_approval_id on approval_packets (approval_id);
create index if not exists idx_approval_queues_approval_id on approval_queues (approval_id);
create index if not exists idx_approval_decisions_approval_id on approval_decisions (approval_id);
create index if not exists idx_approval_decisions_queue_id on approval_decisions (queue_id);
create index if not exists idx_agent_runs_run_id on agent_runs (run_id);
create index if not exists idx_backup_plans_backup_plan_id on backup_plans (backup_plan_id);
