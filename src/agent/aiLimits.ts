// Shared browser/server text policy. Only the provider counts tokens exactly.
export const GOAL_CODE_POINTS = 500;

export function validateGoal(goal: unknown): string {
  if (typeof goal !== "string" || !goal.trim() || [...goal.trim()].length > GOAL_CODE_POINTS) {
    throw new Error("Enter a goal between 1 and 500 characters.");
  }
  return goal.trim();
}

export function boundedText(value: unknown, maximum: number, field: string): asserts value is string {
  if (typeof value !== "string" || !value.trim() || [...value].length > maximum) {
    throw new Error(`${field} must contain 1 to ${maximum} characters.`);
  }
}

export function boundedItems(value: unknown, maximum: number, field: string): asserts value is unknown[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > maximum) {
    throw new Error(`${field} must contain 1 to ${maximum} items.`);
  }
}
