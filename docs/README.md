# Project documentation

Keep game rules, tool contracts, evidence, and the context manifest here. Implementation instructions and task plans belong in [specs](../specs/README.md).

## Core references

- [Game specification](GAME_SPEC.md)
- [AI tool contract](TOOL_CONTRACT.md)
- [Context manifest](CONTEXT_MANIFEST.md)
- [Feature 003 workflow boundary evidence](EVIDENCE_003.md)
- [Feature 001 low-cost AI evidence](../specs/001-low-cost-ai/evidence.md)
- [Feature 002 logging evidence](../specs/002-ai-tool-call-logging/evidence.md)
- [Week 4 evidence](EVIDENCE_004.md)
- [Week 5 evidence](EVIDENCE_005.md)

These documents describe their original scope and verification dates. Consult the newer feature specifications and integration guide for later work; old evidence is not proof of current live-provider acceptance.

## Supporting records

- [Guides: Gemini integration and local setup](guides/WEEK5_GEMINI_INTEGRATION.md)
- [Guides: low-cost AI configuration and limits](guides/LOW_COST_AI.md)
- [Guides: local AI tool-call logging and Markdown export](guides/AI_TOOL_CALL_LOGGING.md)
- [Logs: AI development usage](logs/AI_USAGE_LOG.md)
- [Reports: Week 3](reports/WEEK_3_REPORT.md)
- [Reports: low-cost AI specification and commit history](reports/LOW_COST_AI_SPEC_REPORT.md)
- [Reports: documentation reorganization](reports/DOCUMENTATION_REORGANIZATION_REPORT.md)

The [AI tool-call record template](../specs/002-ai-tool-call-logging/log-template.md) belongs to feature 002. Configured capture writes ignored local JSONL; the export command produces Markdown without modifying this tracked template.

Older build prompts, evaluation plans, and workflow tasks are in [specs/done-previously](../specs/done-previously/README.md).
