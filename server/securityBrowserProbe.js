// Browser-only observation fixture; never loaded by the production application.
window.__w08XssMarker = false;
window.__w08CspMarker = false;
const violations = [];
document.addEventListener('securitypolicyviolation', event => {
  violations.push({ directive: event.effectiveDirective, blockedURI: event.blockedURI }); observe();
});
let previous = '';
function observe() {
  const coach = document.querySelector('.decision-coach');
  const invalid = Boolean(document.querySelector('#order-error'));
  const footer = document.querySelector('.footer-line')?.textContent || '';
  const week = Number(/Week (\d+) of 10/.exec(footer)?.[1] || 0);
  const usage = [...document.querySelectorAll('body *')].some(node => node.children.length === 0 && node.textContent.includes('Provider requests:'));
  const data = { stage: location.pathname === '/control.html' ? 'control' : invalid ? 'invalid' : coach ? 'coach' : week > 1 ? 'advanced' : 'initial',
    week, coach: Boolean(coach), usage, invalid, xssExecuted: window.__w08XssMarker === true,
    cspExecuted: window.__w08CspMarker === true, violations: [...violations],
    payloadVisible: Boolean(coach?.textContent.includes('<img src=')),
    normalTextVisible: Boolean(coach?.textContent.includes('Đorđe kaže: a < b.')),
    labelPayloadPresent: Boolean(document.querySelector('#participant-label')?.value.includes('<img')),
    unsafePageDOM: document.querySelectorAll('#root img,#root script,#root iframe,#root object,#root [onerror],#root [onclick],#root a[href^="javascript:"]').length,
    unsafeCoachDOM: coach ? coach.querySelectorAll('img,script,iframe,object,[onerror],[onclick],a[href^="javascript:"]').length : 0,
    recommendationControl: Boolean(document.querySelector('.decision-coach button')) };
  const serialized = JSON.stringify(data); if (serialized === previous) return; previous = serialized;
  fetch('/__security_observation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: serialized });
}
new MutationObserver(observe).observe(document.documentElement, { subtree: true, childList: true, characterData: true });
document.addEventListener('input', observe);
const script = document.createElement('script'); script.id = 'w08-csp-probe'; script.textContent = 'window.__w08CspMarker=true'; document.head.append(script);
setTimeout(observe, 50);
