import type { AgentEvidence } from './agentClient';

export function AiUsageEvidence({ evidence }: { evidence: AgentEvidence }) {
  return (
<section aria-live="polite" className="scenario-panel">
          <p>AI status: {evidence.status} · {evidence.stopReason}</p>
          <p>Provider: {evidence.provider} · Model calls: {evidence.modelCalls} · Tool calls: {evidence.toolCallCount} · Steps: {evidence.stepCount}</p>
          <p>Model: {evidence.model} · Token-count requests: {evidence.countTokenCalls} · Provider requests: {evidence.providerHttpCalls}</p>
          <p>Tokens ({evidence.usageStatus}): input {evidence.usage.promptTokenCount ?? "unknown"}, response {evidence.usage.candidatesTokenCount ?? "unknown"}, thinking {evidence.usage.thoughtsTokenCount ?? "unknown"}, total {evidence.usage.totalTokenCount ?? "unknown"}.</p>
          <p>Estimated cost: {evidence.estimatedUsd === null ? "unknown" : `$${evidence.estimatedUsd.toFixed(6)}`} (USD; prices {evidence.priceDate}).
            {evidence.estimatedUsd === null && evidence.knownEstimatedUsd !== null ? ` Known portion: $${evidence.knownEstimatedUsd.toFixed(6)}; remaining usage unknown.` : ""}</p>
          {evidence.accounting && (
            <p>Budget record: {evidence.accounting.reservationStatus}
              {evidence.accounting.chargedEstimateUsd !== undefined ? ` · $${evidence.accounting.chargedEstimateUsd.toFixed(6)} charged/reserved against the local daily estimate allowance` : ""}.
              {evidence.accounting.ledgerStatus === "unavailable" ? " Usage records are unavailable; the reservation was retained." : ""}
            </p>
          )}
        </section>
  );
}
