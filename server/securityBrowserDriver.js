// Test-fixture-only browser input automation. No React internals or CSP overrides.
// Runs in actual Chrome at /?security-auto=1; production never loads this file.
(async () => {
  if (new URLSearchParams(location.search).get('security-auto') !== '1') return;
  const phase = new URLSearchParams(location.search).get('phase') || 'orders';
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const wait = async (predicate, label) => {
    const until = performance.now() + 15_000;
    while (performance.now() < until) {
      const value = predicate(); if (value) return value;
      await new Promise(resolve => setTimeout(resolve, 40));
    }
    throw new Error(`Browser driver timed out: ${label}`);
  };
  const report = async (stage, status = 'PASS', error) => {
    const response = await fetch('/__security_driver', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage, status, ...(error ? { error: String(error).slice(0, 300) } : {}) }) });
    assert(response.ok, 'Cannot record browser automation progress');
  };
  const observation = async predicate => {
    const until = performance.now() + 15_000;
    while (performance.now() < until) {
      const value = await fetch('/__security_report').then(response => response.json());
      if (predicate(value)) return value;
      await new Promise(resolve => setTimeout(resolve, 40));
    }
    throw new Error('Browser driver timed out awaiting real DOM observation');
  };
  const fill = async (selector, value) => {
    const field = await wait(() => document.querySelector(selector), selector);
    assert(!field.disabled, `${selector} disabled`);
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(field, value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 60));
  };
  const click = async predicate => {
    const button = await wait(() => [...document.querySelectorAll('button')].find(predicate), 'enabled public button');
    assert(!button.disabled, 'Public button is disabled'); button.click();
  };
  try {
    await report(phase + '.started');
    if (phase === 'control') {
      await observation(value => value.observations.some(x => x.stage === 'control' && x.cspExecuted));
      await report('complete'); return;
    }
    await wait(() => document.querySelector('#order-quantity'), 'React game mounted');
    if (phase === 'label') {
      await fill('#participant-label', '<img src=x onerror=window.__w08XssMarker=true>');
    } else assert(phase === 'orders', 'Unknown automation phase');
    await click(button => button.textContent === 'AI Decision Coach');
    await observation(value => value.providerRequests.decision_coach === (phase === 'label' ? 8 : 4)
      && value.observations.some(x => x.stage === 'coach' && x.payloadVisible && x.normalTextVisible
        && (phase !== 'label' || x.labelPayloadPresent) && !x.xssExecuted && x.unsafeCoachDOM === 0));
    if (phase === 'label') {
      await observation(value => value.observations.some(x => x.labelPayloadPresent && x.unsafePageDOM === 0 && !x.xssExecuted));
      await report('label.safe'); location.href = '/control.html?security-auto=1&phase=control'; return;
    }
    await report('coach.safe');
    await fill('#order-quantity', '');
    await click(button => button.type === 'submit');
    await observation(value => value.observations.some(x => x.stage === 'invalid' && x.week === 1 && x.coach && x.usage));
    await report('invalid.preserved');
    await fill('#order-quantity', '4');
    await click(button => button.type === 'submit');
    await observation(value => value.observations.some(x => x.stage === 'advanced' && x.week === 2 && !x.coach && !x.usage && !x.recommendationControl));
    await report('advanced.cleared'); location.href = '/?security-auto=1&phase=label';
  } catch (error) {
    await report(phase + '.failed', 'FAIL', error.message).catch(() => {});
    console.error('W08 browser automation failed:', error);
  }
})();
