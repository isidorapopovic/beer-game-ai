// Rendered-component verification. This is deliberately NOT labelled a browser test.
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const vite = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true }, appType: 'custom' });
try {
  const { default: App } = await vite.ssrLoadModule('/src/App.tsx');
  const { AiUsageEvidence } = await vite.ssrLoadModule('/src/agent/AiUsageEvidence.tsx');
  const html = renderToStaticMarkup(createElement(App));
  assert.match(html, /Beer Distribution Game/); assert.match(html, /AI Decision Coach/);
  assert.match(html, /Submit order/); assert.match(html, /Scenario generator/);
  const base = { status: 'completed', stopReason: 'completed', provider: 'gemini', model: 'gemini-3.1-flash-lite',
    modelCalls: 2, countTokenCalls: 2, providerHttpCalls: 4, toolCallCount: 1, stepCount: 2, priceDate: '2026-10-29',
    usageStatus: 'complete', usage: { promptTokenCount: 100, candidatesTokenCount: 20, thoughtsTokenCount: 0, totalTokenCount: 120 },
    estimatedUsd: 0.000055, knownEstimatedUsd: 0.000055, accounting: { reservationStatus: 'reserved', chargedEstimateUsd: 0.001408 } };
  const known = renderToStaticMarkup(createElement(AiUsageEvidence, { evidence: base }));
  assert.match(known, /\$0\.000055/); assert.match(known, /gemini-3\.1-flash-lite/);
  assert.match(known, /Token-count requests: 2/); assert.match(known, /Provider requests: 4/);
  const partial = renderToStaticMarkup(createElement(AiUsageEvidence, { evidence: { ...base, usageStatus: 'partial',
    usage: { ...base.usage, thoughtsTokenCount: null }, estimatedUsd: null } }));
  assert.match(partial, /thinking unknown/); assert.match(partial, /Estimated cost: unknown/);
  assert.match(partial, /Known portion: \$0\.000055; remaining usage unknown/);
  const unavailable = renderToStaticMarkup(createElement(AiUsageEvidence, { evidence: { ...base,
    accounting: { reservationStatus: 'retained', ledgerStatus: 'unavailable' } } }));
  assert.match(unavailable, /Usage records are unavailable/);
  console.log('RENDERED UI SMOKE PASS: initial game, exact small cost, request counters, partial/unknown usage, retained reservation. Browser interactions not tested.');
} finally { await vite.close(); }
