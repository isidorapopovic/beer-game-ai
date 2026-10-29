export type AgentEvent = { type: string; runId: string; payload: Record<string, unknown> };
export type AgentObserver = (event: AgentEvent) => void | Promise<void>;

// Observability must never retry a tool or replace the workflow's result.
export function notifyAgent(observer: AgentObserver | undefined, event: AgentEvent): void {
  try { const result = observer?.(event); if (result) void Promise.resolve(result).catch(() => {}); }
  catch { /* The logger reports its own availability separately. */ }
}
