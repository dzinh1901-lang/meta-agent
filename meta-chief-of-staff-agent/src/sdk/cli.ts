import fs from 'node:fs/promises';
import { createInterface, type Interface } from 'node:readline/promises';
import process from 'node:process';
import { MemorySession, Runner, RunState } from '@openai/agents';
import { createMetaAgentContext } from './context.js';
import { metaChiefOfStaffAgent } from './meta-chief-of-staff.js';

const runner = new Runner();
const session = new MemorySession({
  sessionId: process.env.META_AGENT_SESSION_ID ?? `meta-chief-${Date.now()}`,
});
const context = createMetaAgentContext();
const stateFile = process.env.META_AGENT_RUN_STATE_FILE ?? '.meta-agent-run-state.json';

function outputText(value: unknown): string {
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

async function saveRunState(state: { toString(): string }): Promise<void> {
  await fs.writeFile(stateFile, state.toString(), 'utf8');
}

async function removeRunState(): Promise<void> {
  if (await fileExists(stateFile)) await fs.unlink(stateFile);
}

async function resolveInterruptions(result: any, rl: Interface): Promise<any> {
  let current = result;
  while (current.interruptions?.length) {
    await saveRunState(current.state);
    console.log(`\n${current.interruptions.length} approval request(s) require a human decision.`);

    for (const interruption of current.interruptions) {
      console.log('\n--- Approval request ---');
      console.log(`Agent: ${interruption.agent?.name ?? 'unknown'}`);
      console.log(`Tool: ${interruption.name}`);
      console.log(`Arguments: ${typeof interruption.arguments === 'string' ? interruption.arguments : JSON.stringify(interruption.arguments, null, 2)}`);
      console.log(`Operator: ${context.operatorId}`);
      console.log(`Roles: ${context.operatorRoles.join(', ') || 'none'}`);

      const answer = (await rl.question('Approve this exact tool call? [y/N]: ')).trim().toLowerCase();
      if (answer === 'y' || answer === 'yes') {
        current.state.approve(interruption);
      } else {
        const reason = await rl.question('Rejection reason (optional): ');
        current.state.reject(interruption, { message: reason || 'Rejected by human operator.' });
      }
    }

    await saveRunState(current.state);
    current = await runner.run(metaChiefOfStaffAgent, current.state, { context, session });
  }

  await removeRunState();
  return current;
}

async function runTurn(input: string, rl: Interface): Promise<void> {
  let result = await runner.run(metaChiefOfStaffAgent, input, { context, session });
  result = await resolveInterruptions(result, rl);
  console.log(`\nChief of Staff:\n${outputText(result.finalOutput)}\n`);
}

async function resumeSavedRun(rl: Interface): Promise<void> {
  if (!(await fileExists(stateFile))) throw new Error(`No saved RunState exists at ${stateFile}.`);
  const serialized = await fs.readFile(stateFile, 'utf8');
  const state = await RunState.fromString(metaChiefOfStaffAgent, serialized);
  let result = await runner.run(metaChiefOfStaffAgent, state, { context, session });
  result = await resolveInterruptions(result, rl);
  console.log(`\nChief of Staff:\n${outputText(result.finalOutput)}\n`);
}

async function main(): Promise<void> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required for the interactive Agents SDK runtime.');
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    if (process.argv.includes('--resume')) {
      await resumeSavedRun(rl);
      return;
    }

    const onceIndex = process.argv.indexOf('--once');
    if (onceIndex >= 0) {
      const prompt = process.argv.slice(onceIndex + 1).join(' ').trim();
      if (!prompt) throw new Error('--once requires a prompt.');
      await runTurn(prompt, rl);
      return;
    }

    console.log('Meta Chief of Staff Agent');
    console.log(`Mode: ${context.mode}; environment: ${context.environment}`);
    console.log(`Authorized repositories: ${context.authorizedRepositories.length}`);
    console.log('Commands: /exit, /quit, /resume');

    while (true) {
      const input = (await rl.question('\nYou: ')).trim();
      if (!input) continue;
      if (input === '/exit' || input === '/quit') break;
      if (input === '/resume') {
        await resumeSavedRun(rl);
        continue;
      }
      await runTurn(input, rl);
    }
  } finally {
    rl.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
