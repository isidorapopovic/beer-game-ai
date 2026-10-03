// Server-only Gemini adapter. Never import this module into the browser.
export function createGeminiModel({ apiKey, model, fetchImpl = fetch }) {
  if (!apiKey || !model || !/^[a-zA-Z0-9._-]+$/.test(model)) {
    throw new Error('Gemini is not configured. Set GEMINI_API_KEY and GEMINI_MODEL on the server.');
  }
  return async ({ instructions, input, deadlineAt }) => {
    const remaining = Date.parse(deadlineAt) - Date.now();
    if (!Number.isFinite(remaining) || remaining <= 0) throw new Error('Provider deadline exceeded.');
    try {
      const response = await fetchImpl(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          signal: AbortSignal.timeout(remaining),
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: instructions }] },
            contents: [{ role: 'user', parts: [{ text: JSON.stringify(input) }] }],
            generationConfig: { responseMimeType: 'application/json', temperature: 0.2, maxOutputTokens: 4096 },
          }),
        },
      );
      if (!response.ok) throw new Error('Provider request failed.');
      const data = await response.json();
      const candidate = data.candidates?.[0];
      if (candidate?.finishReason !== 'STOP') throw new Error('Provider response incomplete.');
      const text = candidate.content?.parts?.filter(part => !part.thought && typeof part.text === 'string')
        .map(part => part.text).join('');
      if (!text || Buffer.byteLength(text) > 50_000) throw new Error('Invalid provider response.');
      return JSON.parse(text);
    } catch {
      // Do not propagate provider bodies, credentials, or internal diagnostics.
      throw new Error('Gemini could not return a valid response within the run deadline.');
    }
  };
}
