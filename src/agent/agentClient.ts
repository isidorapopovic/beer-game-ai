import type { WorkflowId } from './boundedAgent';
import type { GameState } from '../game/gameEngine';
import { validateGoal } from './aiLimits.ts';
import { getParticipantContext } from './participantContext.ts';

export type ActivityLoggingStatus = {
  enabled: boolean;
  status: 'recorded' | 'partial' | 'unavailable';
  reason?: string;
  requestId: string;
  sessionId: string;
  eventsRecorded: number;
  eventsMissing: number;
};

export class AgentRequestError extends Error {
  logging?: ActivityLoggingStatus;
  constructor(message: string, logging?: ActivityLoggingStatus) { super(message); this.name = 'AgentRequestError'; this.logging = logging; }
}

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
  logging?: ActivityLoggingStatus;
};

export async function requestAgent<T>(workflow: WorkflowId, state: GameState, goal: string, participantLabel?: string): Promise<{
  status: string; stopReason: string; error?: string; finalOutput?: T; evidence: AgentEvidence; logging?: ActivityLoggingStatus;
}> {
  const validGoal = validateGoal(goal);
  const response = await fetch('/api/agent/run', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workflow, state, goal: validGoal, participant: getParticipantContext(participantLabel) }), signal: AbortSignal.timeout(25_000),
  });
  const result = await response.json();
  if (!response.ok) throw new AgentRequestError(result.error || 'The AI service is unavailable.', result.logging);
  return result;
}
