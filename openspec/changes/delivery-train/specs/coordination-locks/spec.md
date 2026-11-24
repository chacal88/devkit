<!-- devkit-stage specs result=passed attempt=1 commit=19c0196ddbe3084153ae8b3f169b9203fc586058 -->
# Spec Delta

## ADDED Requirements

### Requirement: A typed train request leaves a roadmap run as it is
In the session of a roadmap run, a typed `/devkit train` (bare or plugin-scoped) SHALL neither start
nor end the roadmap run for any lock of this capability, as a typed `/devkit status` does not. It SHALL
end a `/devkit change` run, as any other typed slash command does.

#### Scenario: The owner departs the train during a roadmap run
- **WHEN** the newest typed slash commands of the session are `/devkit roadmap 3`, its `devkit-roadmap: 3` line, then `/devkit train`
- **THEN** the session is still in the roadmap run, and its stop lock and hand-off lock act as they did before `/devkit train` was typed

#### Scenario: During a change run
- **WHEN** the newest typed slash commands of the session are `/devkit change alpha`, its `devkit-run: alpha` line, then `/devkit train`
- **THEN** the session is no longer in the change run of `alpha`
