import type { WorkflowId } from './boundedAgent';
import type { GameState } from '../game/gameEngine';
import { validateGoal } from './aiLimits';

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
  model: string;
  priceDate: string;
  generationCalls: number;
  countTokenCalls: number;
  providerHttpCalls: number;
  usageStatus: 'complete' | 'partial' | 'unknown';
  usage: { promptTokenCount: number | null; candidatesTokenCount: number | null;
    thoughtsTokenCount: number | null; totalTokenCount: number | null };
  estimatedUsd: number | null;
  knownEstimatedUsd: number | null;
  accounting?: { reservationStatus: string; chargedEstimateUsd?: number;
    dailyAllowanceUsd?: number; reconciliationVerified?: boolean; ledgerStatus?: string };
};

export async function requestAgent<T>(workflow: WorkflowId, state: GameState, goal: string): Promise<{
  status: string; stopReason: string; error?: string; finalOutput?: T; evidence: AgentEvidence;
}> {
  const validGoal = validateGoal(goal);
  const response = await fetch('/api/agent/run', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workflow, state, goal: validGoal }), signal: AbortSignal.timeout(25_000),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'The AI service is unavailable.');
  return result;
}
