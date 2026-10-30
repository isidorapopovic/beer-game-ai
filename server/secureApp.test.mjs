import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createProductionServer } from './secureApp.mjs';
import { createAgentServer } from './index.mjs';
import { createGameState } from '../src/game/gameEngine.ts';
import { testEnvironment, fakeGemini, withCoachContext } from './testFixtures.mjs';

test('E03 production transport enforces headers, serves real assets and isolates filesystem/API', async t => {
  const env = testEnvironment(t); const root = join(dirname(env.AI_USAGE_LEDGER_PATH), 'dist'); mkdirSync(root);
  writeFileSync(join(root, 'index.html'), '<!doctype html><script src="/app.js"></script><p>Đorđe</p>');
  writeFileSync(join(root, 'app.js'), 'window.testAsset=true;'); writeFileSync(join(dirname(root), 'private.txt'), 'PRIVATE_OUTSIDE');
  const fake = fakeGemini('decision_coach'); const server = createProductionServer({ distPath: root, apiServer: createAgentServer({ env, fetchImpl: fake.fetchImpl }) });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`; const page = await fetch(base);
  assert.equal(page.status, 200); const csp = page.headers.get('content-security-policy');
  for (const directive of ["script-src 'self'", "connect-src 'self'", "object-src 'none'", "base-uri 'none'", "frame-ancestors 'none'"]) assert.ok(csp.includes(directive));
  assert.equal(csp.includes('unsafe-inline'), false); assert.equal(csp.includes('unsafe-eval'), false);
  assert.equal(page.headers.get('content-security-policy-report-only'), null); assert.equal(page.headers.get('x-content-type-options'), 'nosniff'); assert.equal(page.headers.get('referrer-policy'), 'no-referrer');
  assert.match(await page.text(), /Đorđe/); assert.equal((await fetch(base + '/app.js')).status, 200);
  for (const path of ['/../private.txt', '/%2e%2e%2fprivate.txt', '/%5c..%5cprivate.txt', '/.env', '/missing.js', '/%00.js']) {
    const response = await fetch(base + path); assert.equal(response.status, 404); assert.equal((await response.text()).includes('PRIVATE_OUTSIDE'), false);
  }
  const url = base + '/api/agent/run'; const value = await withCoachContext(url, { workflow: 'decision_coach', goal: 'Help.', state: createGameState() });
  const result = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
  assert.equal((await result.json()).status, 'completed'); assert.equal(fake.requests.length, 4); assert.ok(result.headers.get('content-security-policy'));
  const denied = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://attacker.invalid' }, body: JSON.stringify(value) });
  assert.equal(denied.status, 403); assert.equal(fake.requests.length, 4);
});
