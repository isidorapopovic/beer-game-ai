// Verifies observations produced inside real Chrome after the documented UI run.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { createHash } from 'node:crypto';

let report;
const requireAutomation = process.argv.includes('--require-automation');
const until = Date.now() + 30_000;
do {
  report = await fetch('http://127.0.0.1:5179/__security_report').then(response => response.json());
  if (!requireAutomation || report.automation.events.some(x => x.stage === 'complete' || x.status === 'FAIL')) break;
  await new Promise(resolve => setTimeout(resolve, 100));
} while (Date.now() < until);
if (requireAutomation) {
  assert.deepEqual(report.automation.events.map(x => [x.stage, x.status]), [
    ['orders.started', 'PASS'], ['coach.safe', 'PASS'], ['invalid.preserved', 'PASS'], ['advanced.cleared', 'PASS'],
    ['label.started', 'PASS'], ['label.safe', 'PASS'], ['control.started', 'PASS'], ['complete', 'PASS'],
  ], 'A fresh, complete real-browser input run is required.');
}
const observations = report.observations;
assert.ok(observations.length > 0);
assert.ok(observations.every(x => !x.xssExecuted && (x.unsafePageDOM ?? 0) === 0 && (x.unsafeCoachDOM ?? 0) === 0), 'No observed phase may execute XSS or contain unsafe application DOM.');
assert.ok(observations.some(x => x.stage === 'coach' && x.payloadVisible && x.normalTextVisible && x.unsafeCoachDOM === 0 && !x.xssExecuted));
assert.ok(observations.some(x => x.stage === 'invalid' && x.week === 1 && x.coach && x.usage));
assert.ok(observations.some(x => x.stage === 'advanced' && x.week === 2 && !x.coach && !x.usage && !x.recommendationControl));
assert.ok(observations.some(x => x.labelPayloadPresent && x.unsafePageDOM === 0 && !x.xssExecuted));
assert.ok(observations.some(x => x.violations.some(v => v.directive === 'script-src-elem' && v.blockedURI === 'inline') && !x.cspExecuted));
assert.ok(observations.some(x => x.stage === 'control' && x.cspExecuted));
assert.equal(report.sentinelInSecurityLog, false); assert.equal(report.sentinelInActivityLog, false);
assert.equal(report.providerRequests.decision_coach, 8); assert.equal(report.activityEvents, 38); assert.equal(report.liveProviderCalls, 0);
for (const [name, count] of Object.entries(report.providerRequests)) if (name !== 'decision_coach') assert.equal(count, 0);
const directory = resolve(report.runtimeDirectory);
assert.ok(relative(resolve('.local'), directory).startsWith('spec004-browser-'));
const hashes = {};
for (const name of readdirSync('dist/assets')) {
  const actual = readFileSync(join('dist/assets', name));
  assert.deepEqual(readFileSync(join(directory, 'dist/assets', name)), actual, 'Browser-tested asset must equal final production asset.');
  assert.equal(actual.includes(Buffer.from('W08_SERVER_SECRET_DO_NOT_EXPOSE')), false);
  hashes[name] = createHash('sha256').update(actual).digest('hex');
}
const page = await fetch('http://127.0.0.1:5179/');
report.headers = Object.fromEntries(['content-security-policy', 'x-content-type-options', 'referrer-policy'].map(key => [key, page.headers.get(key)]));
assert.equal(report.headers['x-content-type-options'], 'nosniff');
assert.equal(report.headers['referrer-policy'], 'no-referrer');
assert.ok(report.headers['content-security-policy']?.includes("script-src 'self'"));
assert.ok(!report.headers['content-security-policy'].includes("'unsafe-inline'"));
report.at = new Date().toISOString(); report.status = 'PASS'; report.assetSha256 = hashes;
report.finalBuildAssetsIdentical = true; report.viteVersion = JSON.parse(readFileSync('node_modules/vite/package.json', 'utf8')).version;
report.automatedInput = requireAutomation;
if (requireAutomation) report.automation.driverSha256 = createHash('sha256').update(readFileSync('server/securityBrowserDriver.js')).digest('hex');
writeFileSync('specs/004-secure-game/browser-results.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: 'PASS', browser: 'Chrome', observations: observations.length, cspPositiveAndNegativeControls: true,
  staleAdviceInteraction: true, finalBuildAssetsIdentical: true, viteVersion: report.viteVersion, actualLiveProviderCalls: 0 }));
