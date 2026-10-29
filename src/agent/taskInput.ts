import type { WorkflowId } from './boundedAgent';
import type { ScenarioType, ScenarioDifficulty } from './scenarioGenerator';

export type CandidateTaskInput = { orderQuantity: number };
export type ScenarioTaskInput = { scenario: ScenarioType; difficulty: ScenarioDifficulty };
export type TaskInput = CandidateTaskInput | ScenarioTaskInput | Record<string, never>;

// Selection comes from controls, never from parsing or decoding goal prose.
export function validateTaskInput(workflow: WorkflowId, value: unknown): TaskInput {
  if (value === undefined && workflow !== 'candidate_order_simulation' && workflow !== 'scenario_generator') return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid taskInput.');
  const input = value as Record<string, unknown>;
  const keys = Object.keys(input);
  if (workflow === 'candidate_order_simulation') {
    if (keys.length !== 1 || !Object.hasOwn(input, 'orderQuantity') || typeof input.orderQuantity !== 'number'
      || !Number.isInteger(input.orderQuantity) || input.orderQuantity < 0 || input.orderQuantity > 50) {
      throw new Error('taskInput requires orderQuantity: an integer from 0 to 50.');
    }
    return { orderQuantity: input.orderQuantity };
  }
  if (workflow === 'scenario_generator') {
    if (keys.length !== 2 || !Object.hasOwn(input, 'scenario') || !Object.hasOwn(input, 'difficulty')
      || !['stable', 'growth', 'seasonal', 'volatile'].includes(input.scenario as string)
      || !['easy', 'medium', 'hard'].includes(input.difficulty as string)) {
      throw new Error('taskInput requires an approved scenario and difficulty.');
    }
    return { scenario: input.scenario as ScenarioType, difficulty: input.difficulty as ScenarioDifficulty };
  }
  if (keys.length) throw new Error('This workflow accepts only empty taskInput.');
  return {};
}
