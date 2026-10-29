import { readFileSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { EVENT_TYPES, STORAGE_LIMIT_BYTES, isPrivateLocalPath } from './aiToolCallLog.mjs';

export function budapestTimestamp(utc) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Budapest', year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZoneName: 'longOffset' })
    .formatToParts(new Date(utc));
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}${values.timeZoneName.replace('GMT', '') || '+00:00'}`;
}

export function readEventLog(path, { maxBytes = STORAGE_LIMIT_BYTES } = {}) {
  if (statSync(path).size > maxBytes) throw new Error('Log exceeds export size limit.');
  const text = readFileSync(path, 'utf8');
  const lines = text.split('\n'); const events = []; const warnings = [];
  if (text && !text.endsWith('\n')) warnings.push('The final line is unterminated; it may be crash-truncated. No completion is inferred.');
  for (const [index, line] of lines.entries()) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line);
      if (event.schemaVersion !== 1 || !/^req_[a-zA-Z0-9_-]{1,100}$/.test(event.requestId)
        || !Number.isSafeInteger(event.sequence) || event.sequence < 1 || !EVENT_TYPES.has(event.type)
        || typeof event.at !== 'string' || !Number.isFinite(Date.parse(event.at))
        || !['live', 'mock-test', 'development'].includes(event.mode)
        || !['exact', 'redacted', 'omitted'].includes(event.payload?.representation)) throw new Error('Invalid event.');
      events.push(event);
    } catch { warnings.push(`Line ${index + 1} is invalid/truncated and was not exported. Earlier valid records are preserved.`); }
  }
  return { events, warnings };
}

const cell = value => String(value ?? 'not captured').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/[\r\n\u0000-\u001f\u007f]/g, ' ').replace(/[\\`|*_\[\]()#!]/g, '\\$&');
const code = value => JSON.stringify(value ?? null, null, 2).split('\n').map(line => '    ' + line).join('\n');

export function renderToolCallMarkdown({ events, warnings = [] }) {
  const groups = new Map();
  for (const event of events) { if (!groups.has(event.requestId)) groups.set(event.requestId, []); groups.get(event.requestId).push(event); }
  const rows = []; const details = [];
  for (const [id, unsorted] of groups) {
    const records = [...unsorted].sort((a, b) => a.sequence - b.sequence);
    const first = records[0]; const last = records.at(-1);
    const context = records.find(event => event.type === 'request_accepted') ?? first;
    const participant = context.participant;
    const runId = records.find(event => event.runId)?.runId;
    const final = [...records].reverse().find(event => ['action_completed', 'action_failed', 'action_cancelled'].includes(event.type));
    const ordered = records.every((event, i) => event.sequence === i + 1);
    const complete = Boolean(final) && ordered && !records.some(event => event.payload.representation === 'omitted');
    const proposed = records.filter(event => event.type === 'tool_proposed').map(event => event.payload.data?.name ?? 'name omitted');
    const executed = records.filter(event => event.type === 'tool_execution_started').map(event => event.payload.data?.name ?? 'name omitted');
    const status = final?.payload.data?.status ?? final?.type ?? 'incomplete';
    const evidence = final?.payload.data?.evidence;
    const actualModel = [...records].reverse().find(event => event.type === 'model_request_completed' && event.payload.data?.actualModel)?.payload.data.actualModel
      ?? records.find(event => event.type === 'model_request_started')?.payload.data?.model;
    const observedModels = records.filter(event => event.type === 'model_request_started').length;
    const observedCounts = records.filter(event => event.type === 'count_tokens_request_started').length;
    rows.push(`| ${cell(id)} | ${cell(budapestTimestamp(first.at))} | ${cell(participant?.label ?? participant?.sessionId ?? 'unknown')} | ${cell(context.context)} / ${cell(context.mode)} | ${cell(runId)} | ${cell(context.workflow)} | ${cell(proposed.join(', ') || 'none observed')} | ${cell(executed.join(', ') || 'not executed')} | ${cell(status)} |`);
    const accepted = records.find(event => event.type === 'request_accepted');
    details.push(`### Record ${cell(id)}\n\n| Field | Observed value |\n|---|---|\n` +
      `| Context / evidence mode | ${cell(first.context)} / ${cell(first.mode)} |\n` +
      `| Participant and source | ${cell(participant?.label ?? 'unknown')} / ${cell(participant?.labelSource)} |\n` +
      `| Anonymous session and source | ${cell(participant?.sessionId)} / ${cell(participant?.sessionSource)} |\n` +
      `| Identity representation | ${cell(context.participantRepresentation ?? 'exact')} |\n` +
      `| Request / run ID | ${cell(id)} / ${cell(runId)} |\n` +
      `| Workflow / week / phase | ${cell(context.workflow)} / ${cell(context.gameWeek)} / ${cell(context.gamePhase)} |\n` +
      `| Started at (Europe/Budapest) | ${cell(budapestTimestamp(first.at))} |\n` +
      `| Last observed at (Europe/Budapest) | ${cell(budapestTimestamp(last.at))} |\n` +
      `| Elapsed milliseconds | ${cell(final?.elapsedMs ?? last.elapsedMs)} |\n` +
      `| Actual/configured model | ${cell(actualModel)} |\n` +
      `| Observed generation/count/tool starts | ${observedModels} / ${observedCounts} / ${executed.length} |\n` +
      `| Prompt/candidate/thinking/total tokens | ${cell(evidence?.usage?.promptTokenCount)} / ${cell(evidence?.usage?.candidatesTokenCount)} / ${cell(evidence?.usage?.thoughtsTokenCount)} / ${cell(evidence?.usage?.totalTokenCount)} |\n` +
      `| Usage completeness / estimated USD | ${cell(evidence?.usageStatus)} / ${cell(evidence?.estimatedUsd)} |\n` +
      `| Known USD portion / price date | ${cell(evidence?.knownEstimatedUsd)} / ${cell(evidence?.priceDate)} |\n` +
      `| Status / record completeness | ${cell(status)} / ${complete ? 'observed stages recorded' : 'partial or incomplete'} |\n\n` +
      `**User input — ${cell(accepted?.payload.representation ?? 'not captured')}**\n\n${code(accepted?.payload.data?.goal)}\n\n` +
      `**Model requests and tool events**\n\n` + records.filter(event => !['request_accepted'].includes(event.type)).map(event =>
        `Event ${event.sequence}: **${cell(event.type)}** · ${cell(budapestTimestamp(event.at))} · ${cell(event.payload.representation)}` +
        `${event.payload.reason ? ' · ' + cell(event.payload.reason) : ''}\n\n${code(event.payload)}\n`).join('\n') +
      `\n**Final AI response / safe error — ${cell(final?.payload.representation ?? 'no final output')}**\n\n${code(final?.payload.data?.finalOutput ?? final?.payload.data?.error ?? null)}\n\n` +
      `**Evidence source and follow-up**\n\n- Source: observed local JSONL events; no missing history reconstructed.\n` +
      `- Game-state mutation: not verified by the logger. Player application of advice: not captured.\n` +
      `- Missing sequence numbers: ${ordered ? 'none observed' : 'yes; record incomplete'}. Review all redaction/omission labels above.\n`);
  }
  return '# AI tool-call log — local export\n\nReporting timezone: Europe/Budapest; source timestamps remain UTC in the JSONL record.\n\n' +
    'Anonymous sessions and supplied participant labels are unverified. A recommendation does not prove a player submitted an order. Payloads are indented JSON data, never executable Markdown/HTML.\n\n' +
    '## Export warnings\n\n' + (warnings.length ? warnings.map(warning => '- ' + cell(warning)).join('\n') : 'None observed.') +
    '\n\n## Call index\n\n| Record ID | Started at (with offset) | Participant ID | Context / live or mock | Run ID | Workflow | Requested tool(s) | Executed tool(s) | Status |\n|---|---|---|---|---|---|---|---|---|\n' +
    rows.join('\n') + '\n\n## Observed records\n\n' + (details.join('\n') || 'No observed records.') + '\n';
}

export function exportToolCallLog(input, output) {
  const source = resolve(input); const target = resolve(output);
  if (!target.toLowerCase().endsWith('.md') || source.toLowerCase() === target.toLowerCase() || !isPrivateLocalPath(target)) {
    throw new Error('Choose a new .md file in .local/ or outside the repository; tracked sources/templates are protected.');
  }
  const record = readEventLog(source);
  const markdown = renderToolCallMarkdown(record);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, markdown, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  return { requests: new Set(record.events.map(event => event.requestId)).size, events: record.events.length, warnings: record.warnings.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const options = process.argv.slice(2);
  if (options.length !== 4 || options[0] !== '--input' || options[2] !== '--output') {
    console.error('Usage: node server/exportAiToolCallLog.mjs --input .local/ai-tool-calls.jsonl --output .local/exports/new-report.md'); process.exitCode = 1;
  } else {
    try { console.log(JSON.stringify({ status: 'exported', ...exportToolCallLog(options[1], options[3]) })); }
    catch { console.error('Export failed. Check the local input, a new private .md destination, size limits, and permissions. Existing files are never overwritten.'); process.exitCode = 1; }
  }
}
