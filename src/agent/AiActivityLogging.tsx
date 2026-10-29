import type { ActivityLoggingStatus } from './agentClient';

export function AiActivityLogging({ logging }: { logging: ActivityLoggingStatus }) {
  const reason = ({ storage_full: 'local storage limit reached', truncated_tail: 'the local record has an incomplete final line',
    write_failed: 'local records could not be written', invalid_configuration: 'local logging configuration is invalid',
    payload_omitted: 'an oversized or unsupported payload was omitted', logging_failed: 'some events could not be recorded' } as Record<string, string>)[logging.reason ?? ''];
  return <section className="scenario-panel" aria-live="polite">
    <p>{logging.reason === 'disabled' ? 'AI activity recording is off.'
      : `AI activity record: ${logging.status}${reason ? ` — ${reason}` : ''}.`}</p>
    <p>Request reference: <code>{logging.requestId}</code></p>
    {logging.enabled && logging.status !== 'recorded' && <p>The AI result is separate from logging availability. Some activity may be missing.</p>}
  </section>;
}
