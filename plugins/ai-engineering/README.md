# devkit-ai-engineering

For projects that build with LLMs: evaluating outputs, designing multi-agent systems and the tools agents call, keeping context small, and vetting third-party skills before adopting them.

```bash
claude plugin install devkit-ai-engineering@devkit --scope project
```

Run at the project root, or add the pack to the project's `.claude/settings.json` (see [getting-started](../../docs/getting-started.md#1-opt-the-project-in)).

Most of these skills are adapted from public, permissively licensed sources. See [THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md).

## Assets

<!-- catalog:begin -->
**Skills** (invoke with `/<name>` or let Claude pick them by description)

| Skill | What it does / when to use |
|---|---|
| [`agent-friendly-cli`](skills/agent-friendly-cli/SKILL.md) | Design spec (98 rules, three certification levels) for CLI tools that AI agents can use safely - structured JSON output, error handling, input contracts, safety guardrails, exit codes and self-description. Use when building or modifying a CLI that agents will call, or when the user asks to make a CLI agent-friendly or machine-readable. |
| [`agent-tool-design`](skills/agent-tool-design/SKILL.md) | Designs tools that agents use effectively - clear descriptions and schemas, consolidation and architectural reduction, error messages agents can act on. Use when creating tools or MCP servers for an agent system, debugging tool misuse or tool-related failures, or trimming an existing tool set. |
| [`context-compression`](skills/context-compression/SKILL.md) | Strategies for compressing long agent context - anchored iterative summarization, opaque compression, regenerative summaries - optimized for tokens per task rather than tokens per request, plus probe-based evaluation of compression quality. Use when agent sessions exceed the context window, designing conversation summarization, or debugging agents that forget files or decisions after compaction. |
| [`llm-evaluation`](skills/llm-evaluation/SKILL.md) | Builds LLM evaluation - LLM-as-judge with direct scoring and pairwise comparison, rubrics, and mitigation of position, length and authority bias in evaluation pipelines. Use when the user asks to implement LLM-as-judge, compare model outputs, create evaluation rubrics, mitigate evaluation bias, or automate quality assessment of LLM output. |
| [`multi-agent-patterns`](skills/multi-agent-patterns/SKILL.md) | Patterns for multi-agent systems - supervisor/orchestrator, peer-to-peer swarm, hierarchical - with context isolation, handoffs, sub-agents and parallel execution, and their failure modes. Use when the user asks to design a multi-agent system, implement a supervisor or swarm, coordinate multiple agents, or split work across sub-agents. |
| [`skill-scanner`](skills/skill-scanner/SKILL.md) | Scans an agent skill for security issues before adoption - prompt injection, malicious code, excessive permissions, secret exposure and supply-chain risk - with a manual review checklist. Use when evaluating a third-party skill or plugin before installing it, or when the user asks whether a skill is safe to trust. |
<!-- catalog:end -->
