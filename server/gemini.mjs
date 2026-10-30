// Server only: never import this module into the browser.
import { AiPolicyError, DEFAULT_MODEL, MODEL_PROFILES, PROPOSAL_BUDGET, WORKFLOW_BUDGETS,
  PROVIDER_BODY_BYTES, JSON_TEXT_BYTES, PROVIDER_TIMEOUT_MS, estimateCost } from './aiPolicy.mjs';

const usageKeys = ['promptTokenCount', 'candidatesTokenCount', 'thoughtsTokenCount', 'totalTokenCount'];
const integer = value => Number.isSafeInteger(value) && value >= 0;

export async function readBoundedJson(response, signal) {
  if (!response.body) throw new Error('Empty response.');
  const reader = response.body.getReader();
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', cancel, { once: true });
  let size = 0; const chunks = [];
  try {
    while (true) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      signal.throwIfAborted();
      if (done) break;
      size += value.byteLength;
      if (size > PROVIDER_BODY_BYTES) { cancel(); throw new Error('Response too large.'); }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } finally { signal.removeEventListener('abort', cancel); reader.releaseLock(); }
}

export function createGeminiModel({ apiKey, model = DEFAULT_MODEL, fetchImpl = fetch, now = Date.now, onEvent, abortSignal, requestTimeoutMs = PROVIDER_TIMEOUT_MS }) {
  if (!apiKey || !Object.hasOwn(MODEL_PROFILES, model)) {
    throw new AiPolicyError('CONFIGURATION', 'Configure a Gemini API key and the supported gemini-3.1-flash-lite model.');
  }
  const profile = MODEL_PROFILES[model];
  const emit = (type, payload) => {
    try { const result = onEvent?.(type, payload); if (result) void Promise.resolve(result).catch(() => {}); } catch { /* Observability cannot alter a provider call. */ }
  };
  const pending = new Set();
  const bounded = (operation, signal) => {
    const task = Promise.resolve().then(operation).then(async value => {
      if (signal.aborted && value instanceof Response) await value.body?.cancel();
      return value;
    });
    pending.add(task);
    task.then(() => pending.delete(task), () => pending.delete(task));
    return new Promise((resolve, reject) => {
      const aborted = () => reject(signal.reason);
      signal.addEventListener('abort', aborted, { once: true });
      task.then(value => { signal.removeEventListener('abort', aborted); signal.aborted ? reject(signal.reason) : resolve(value); },
        error => { signal.removeEventListener('abort', aborted); reject(error); });
      if (signal.aborted) aborted();
    });
  };
  const calls = [];
  let countTokenCalls = 0; let generationCalls = 0; let busy = false; let failureCode;
  const step = async ({ instructions, input, deadlineAt, workflow = 'decision_coach', stage = 'proposal' }) => {
    const budget = stage === 'proposal' ? PROPOSAL_BUDGET : WORKFLOW_BUDGETS[workflow];
    if (!budget || !['proposal', 'final'].includes(stage) || busy || generationCalls >= 2 || countTokenCalls >= 2) {
      failureCode = 'request_limit';
      throw new AiPolicyError(failureCode, 'AI request limit reached.');
    }
    busy = true;
    const record = { stage, inputTokenLimit: budget.input, outputTokenLimit: budget.output,
      countedInputTokens: null, generated: false, status: 'started', modelVersion: null,
      usage: Object.fromEntries(usageKeys.map(key => [key, null])), complete: false, estimatedUsd: null };
    calls.push(record);
    const remaining = Date.parse(deadlineAt) - now();
    if (!Number.isFinite(remaining) || remaining <= 0) {
      busy = false; failureCode = 'deadline'; record.status = 'failed';
      throw new AiPolicyError('deadline', 'AI run deadline reached.');
    }
    const timeoutSignal = AbortSignal.timeout(Math.ceil(remaining));
    const runSignal = abortSignal ? AbortSignal.any([timeoutSignal, abortSignal]) : timeoutSignal;
    const body = {
      systemInstruction: { parts: [{ text: instructions }] },
      contents: [{ role: 'user', parts: [{ text: JSON.stringify(input) }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.2,
        candidateCount: 1, maxOutputTokens: budget.output,
        thinkingConfig: { thinkingLevel: profile.thinkingLevel, includeThoughts: false } },
    };
    const request = async (method, payload) => {
      const callTimeout = AbortSignal.timeout(Math.min(PROVIDER_TIMEOUT_MS, Math.max(1, requestTimeoutMs)));
      const signal = AbortSignal.any([runSignal, callTimeout]);
      signal.throwIfAborted();
      const prefix = method === 'countTokens' ? 'count_tokens_request' : 'model_request';
      const started = performance.now();
      emit(prefix + '_started', { model, stage, inputTokenLimit: budget.input, outputTokenLimit: budget.output,
        ...(method === 'generateContent' ? { systemInstructions: instructions, input } : {}) });
      let response;
      try {
      try {
        response = await bounded(() => fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${model}:${method}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          signal, body: JSON.stringify(payload),
        }), signal);
      } catch { throw new AiPolicyError('provider_unavailable', 'Gemini connection is unavailable. No retry was made.'); }
      (record.httpStatuses ??= []).push({ method, status: response.status });
      if (!response.ok) {
        void response.body?.cancel().catch(() => {});
        throw new AiPolicyError('provider_failed', 'Gemini could not complete the request. Check model access and configuration; no retry was made.');
      }
      const data = await bounded(() => readBoundedJson(response, signal), signal);
      emit(prefix + '_completed', { model, stage, elapsedMs: Math.round(performance.now() - started),
        httpStatus: response.status,
        ...(method === 'countTokens' ? { countedInputTokens: integer(data.totalTokens) ? data.totalTokens : null }
          : { actualModel: typeof data.modelVersion === 'string' && /^[\w.-]{1,120}$/.test(data.modelVersion) ? data.modelVersion : null,
            usage: Object.fromEntries(usageKeys.map(key => [key, integer(data.usageMetadata?.[key]) ? data.usageMetadata[key] : null])) }) });
      return data;
      } catch (error) {
        emit(prefix + '_failed', { model, stage, elapsedMs: Math.round(performance.now() - started),
          httpStatus: response?.status ?? null,
          reason: signal.aborted ? (abortSignal?.aborted ? 'cancelled' : runSignal.aborted ? 'deadline' : 'provider_timeout')
            : error instanceof AiPolicyError ? error.code : 'invalid_provider_response' });
        if (signal.aborted) throw new AiPolicyError(abortSignal?.aborted ? 'cancelled' : runSignal.aborted ? 'deadline' : 'provider_timeout', 'Provider request timed out or was cancelled.');
        throw error;
      }
    };
    let receivedBody = false;
    try {
      countTokenCalls++;
      const counted = await request('countTokens', { generateContentRequest: { model: `models/${model}`, ...body } });
      if (!integer(counted.totalTokens)) throw new Error('Invalid token count.');
      record.countedInputTokens = counted.totalTokens;
      if (counted.totalTokens > budget.input) {
        throw new AiPolicyError('input_token_limit', 'AI prompt exceeds its token budget. Shorten the request.');
      }
      runSignal.throwIfAborted();
      generationCalls++; record.generated = true;
      const data = await request('generateContent', body);
      receivedBody = true;
      // Keep usage even when final content or finish reason is rejected.
      for (const key of usageKeys) {
        if (integer(data.usageMetadata?.[key])) record.usage[key] = data.usageMetadata[key];
      }
      if (typeof data.modelVersion === 'string' && /^[a-zA-Z0-9._-]{1,120}$/.test(data.modelVersion)) record.modelVersion = data.modelVersion;
      const u = record.usage;
      record.complete = usageKeys.every(key => u[key] !== null)
        && u.totalTokenCount === u.promptTokenCount + u.candidatesTokenCount + u.thoughtsTokenCount
        && (data.usageMetadata?.cachedContentTokenCount ?? 0) === 0
        && (data.usageMetadata?.toolUsePromptTokenCount ?? 0) === 0;
      if (record.complete) record.estimatedUsd = estimateCost(profile, u.promptTokenCount, u.candidatesTokenCount, u.thoughtsTokenCount);
      const totalOutput = u.totalTokenCount !== null && u.promptTokenCount !== null
        ? u.totalTokenCount - u.promptTokenCount : null;
      if (u.promptTokenCount > budget.input || (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0) > budget.output
        || (totalOutput !== null && (totalOutput < 0 || totalOutput > budget.output))) {
        throw new AiPolicyError('provider_budget_mismatch', 'Gemini usage exceeded the configured token budget.');
      }
      const candidate = data.candidates?.[0];
      if (candidate?.finishReason !== 'STOP' || data.candidates.length !== 1) {
        throw new AiPolicyError(candidate?.finishReason === 'MAX_TOKENS' ? 'output_token_limit' : 'incomplete_output', 'Gemini could not finish a valid short response. No retry was made.');
      }
      const text = candidate.content?.parts?.filter(part => !part.thought && typeof part.text === 'string').map(part => part.text).join('');
      if (!text || Buffer.byteLength(text) > JSON_TEXT_BYTES) throw new Error('Invalid output size.');
      const result = JSON.parse(text);
      emit('model_output_validated', { model, stage, scope: 'json_only', workflowFinalValidated: false });
      record.status = 'completed'; return result;
    } catch (error) {
      record.status = 'failed';
      failureCode = runSignal.aborted ? (abortSignal?.aborted ? 'cancelled' : 'deadline') : error instanceof AiPolicyError ? error.code : 'invalid_provider_response';
      if (receivedBody) emit('model_output_rejected', { model, stage, scope: 'json_only', reason: failureCode });
      throw new AiPolicyError(failureCode, failureCode === 'cancelled' ? 'AI request was cancelled.' : runSignal.aborted ? 'AI run deadline reached.'
        : error instanceof AiPolicyError ? error.message : 'Gemini did not return a valid bounded response.');
    } finally { busy = false; }
  };
  step.hasPending = () => pending.size > 0;
  step.whenSettled = async () => { while (pending.size) await Promise.allSettled([...pending]); };
  step.getEvidence = () => {
    const generated = calls.filter(call => call.generated);
    const known = key => {
      const values = generated.map(call => call.usage[key]).filter(value => value !== null);
      return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
    };
    const complete = generated.length > 0 && generated.every(call => call.complete);
    return { model, priceDate: profile.priceDate, generationCalls, countTokenCalls,
      providerHttpCalls: generationCalls + countTokenCalls, failureCode,
      usage: Object.fromEntries(usageKeys.map(key => [key, known(key)])),
      usageStatus: complete ? 'complete' : generated.some(call => usageKeys.some(key => call.usage[key] !== null)) ? 'partial' : 'unknown',
      estimatedUsd: complete ? generated.reduce((sum, call) => sum + call.estimatedUsd, 0) : null,
      // A lower bound from known components, not an assumption that missing use is zero.
      knownEstimatedUsd: generated.some(call => usageKeys.slice(0, 3).some(key => call.usage[key] !== null))
        ? generated.reduce((sum, call) => sum + estimateCost(profile, call.usage.promptTokenCount ?? 0,
          call.usage.candidatesTokenCount ?? 0, call.usage.thoughtsTokenCount ?? 0), 0) : null,
      calls: structuredClone(calls) };
  };
  return step;
}
