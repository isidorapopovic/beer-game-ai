import type { WorkflowId } from './boundedAgent';
import type { GameState } from '../game/gameEngine';

export type AgentEvidence = {
  runId: string;
  workflow: WorkflowId;
  status: string;
  provider: string;
  modelCalls: number;
  stepCount: number;
  toolCallCount: number;
  stopReason: string;
  elapsedMs: number;
};

export async function requestAgent<T>(workflow: WorkflowId, state: GameState, goal: string): Promise<{
  status: string; stopReason: string; finalOutput?: T; evidence: AgentEvidence;
}> {
  const response = await fetch('/api/agent/run', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workflow, state, goal }), signal: AbortSignal.timeout(25_000),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'The AI service is unavailable.');
  return result;
}
