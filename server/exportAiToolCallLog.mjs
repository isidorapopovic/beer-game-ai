import { readFileSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { EVENT_LIMIT_BYTES, STORAGE_LIMIT_BYTES, isPrivateLocalPath } from './aiToolCallLog.mjs';
import { validateActivityEvent, summarizeActivity } from './activitySummary.mjs';

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
      if (Buffer.byteLength(line) + 1 > EVENT_LIMIT_BYTES) throw new Error('Oversized line.');
      const event = validateActivityEvent(JSON.parse(line));
      events.push(event);
    } catch { warnings.push(`Line ${index + 1} is invalid/truncated and was not exported. Earlier valid records are preserved.`); }
  }
  return { events, warnings };
}

const cell = value => String(value ?? 'not captured').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/[\r\n\u0000-\u001f\u007f]/g, ' ').replace(/[\\`|*_\[\]()#!]/g, '\\$&');
const code = value => JSON.stringify(value ?? null, null, 2).split('\n').map(line => '    ' + line).join('\n');

export function renderToolCallMarkdown(record) {
  const summary = summarizeActivity(record);
  const warnings = summary.warnings;
  const rows = []; const details = [];
  for (const request of summary.requests) {
    const { requestId: id, records, context, runId, terminal: final, complete, status } = request;
    const first = records[0]; const last = records.at(-1);
    const participant = context.participant;
    const ordered = records.every((event, i) => event.sequence === i + 1);
    const proposed = records.filter(event => event.type === 'tool_proposed').map(event => event.payload.data?.name ?? 'name omitted');
    const executed = records.filter(event => event.type === 'tool_execution_started').map(event => event.payload.data?.name ?? 'name omitted');
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
      `| Observed generation/count/tool outcomes (completed / failed) | ${request.model.completed} / ${request.model.failed}; ${request.countTokens.completed} / ${request.countTokens.failed}; ${request.tool.completed} / ${request.tool.failed} |\n` +
      `| Protocol valid / quota admitted / dispatched | ${request.protocolValid} / ${request.admitted} / ${request.dispatched} |\n` +
      `| Prompt/candidate/thinking/total tokens | ${cell(request.usage?.promptTokenCount)} / ${cell(request.usage?.candidatesTokenCount)} / ${cell(request.usage?.thoughtsTokenCount)} / ${cell(request.usage?.totalTokenCount)} |\n` +
      `| Usage completeness / estimated USD | ${cell(request.usageStatus)} / ${cell(request.estimatedUsd)} |\n` +
      `| Known USD portion / price date | ${cell(request.knownEstimatedUsd)} / ${cell(evidence?.priceDate)} |\n` +
      `| Status / record completeness | ${cell(status)} / ${complete ? 'observed stages recorded' : 'partial or incomplete'} |\n\n` +
      `Issues: ${cell(request.issues.join('; ') || 'none observed')}. Observed terminal status: ${cell(request.observedStatus)}.\n\n` +
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
    '\n\n## Observed grouped totals\n\n' + cell(summary.coverage) + '. Accepted means protocol-valid; it does not prove quota admission. Older logs without request_admitted retain unknown admission.\n\n' +
    [['Workflow/task', summary.byWorkflow], ['Anonymous session (unverified)', summary.bySession]].map(([label, totals]) =>
      `### ${label}\n\n| Group | Requests | Received | Protocol valid | Admitted observed | Admission unknown | Dispatched | Completed | Rejected | Incomplete | Generation/count/tool starts | Known USD lower bound | Unknown/partial usage |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|\n` +
      totals.map(row => `| ${cell(row.key)} | ${row.observedRequests} | ${row.received} | ${row.protocolValid} | ${row.admittedObserved} | ${row.admissionUnknown} | ${row.dispatched} | ${row.completed} | ${row.rejected} | ${row.incomplete} | ${row.modelStarts}/${row.countStarts}/${row.toolStarts} | ${row.knownEstimatedUsd} | ${row.unknownUsageRequests} |`).join('\n')).join('\n\n') +
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
