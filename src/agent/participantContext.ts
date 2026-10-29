export type ParticipantContext = { sessionId: string; label?: string };
export type ValidatedParticipant = ParticipantContext & { sessionSource: string; labelSource: string };
const sessionPattern = /^session_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const storageKey = "beer-game-ai.session.v1";
let fallbackSession: string | undefined;

export function validateParticipantLabel(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || [...value.trim()].length > 80 || /\p{C}/u.test(value)) {
    throw new Error("Use an optional participant label of at most 80 characters, without control characters.");
  }
  return value.trim() || undefined;
}

export function validateParticipant(value: unknown): ValidatedParticipant {
  if (value === undefined) return { sessionId: `session_${globalThis.crypto.randomUUID()}`,
    sessionSource: "server-generated-anonymous", labelSource: "unknown" };
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid participant context.");
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some(key => !["sessionId", "label"].includes(key))
    || typeof record.sessionId !== "string" || !sessionPattern.test(record.sessionId)) throw new Error("Invalid anonymous session ID.");
  const label = validateParticipantLabel(record.label);
  return { sessionId: record.sessionId, ...(label ? { label } : {}),
    sessionSource: "browser-supplied-unverified", labelSource: label ? "participant-supplied-unverified" : "unknown" };
}

export function getParticipantContext(label?: string, suppliedStorage?: Pick<Storage, "getItem" | "setItem">): ParticipantContext {
  const validLabel = validateParticipantLabel(label);
  let id: string | undefined;
  try {
    const storage = suppliedStorage ?? globalThis.sessionStorage;
    const stored = storage?.getItem(storageKey);
    id = stored && sessionPattern.test(stored) ? stored : undefined;
    if (!id) { id = fallbackSession ?? `session_${globalThis.crypto.randomUUID()}`; storage?.setItem(storageKey, id); }
  } catch { /* Disabled browser storage must not stop gameplay or AI. */ }
  fallbackSession ??= id ?? `session_${globalThis.crypto.randomUUID()}`;
  id ??= fallbackSession;
  return { sessionId: id, ...(validLabel ? { label: validLabel } : {}) };
}
