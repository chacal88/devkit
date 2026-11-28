# P-5: the cost of a tick blocked before the model (machine avel, 2026-11-28)

Headless measurement by the conducting session, as the coordinator decided on 2026-11-28: a
scheduled task cannot be pointed at a scratch project (`create_scheduled_task` takes no working
folder; a task runs in the project of the session that created it) and installing the hook in this
repository's settings is ruled out, so the measurement on a real scheduled firing moves to task 6.1.

## Setup

`node openspec/changes/helper-conductor/proof/probe-3-setup.mjs /home/kaue/repos/devkit block` built
`/var/tmp/devkit-hc-tick/project`: a clone of branch `helper-conductor`, the raw payload logger then
this branch's `plugins/openspec/hooks/tick-gate.mjs` as the project's `UserPromptSubmit` hooks, and a
run file with a task and one item under a live claim. In that folder,
`claude -p "<prompt>" --output-format json` (Claude Code 2.1.329, the machine's real plugin set:
devkit packs 0.50.2, genesi and the others installed) ran the tick's two-line prompt (D-5), bare or
wrapped in the scheduler's envelope of `p2-result.md`. The control run used `ready` mode (no claim)
and `--max-turns 2`, with one line appended asking the session to report the note and stop.

## Results

| Run | turns | API ms | input | cache create | cache read | output | cost USD | models |
|---|---|---|---|---|---|---|---|---|
| blocked 1 (bare stored prompt) | 0 | 0 | 0 | 0 | 0 | 0 | 0 | none |
| blocked 2 (scheduler envelope with the tag) | 0 | 0 | 0 | 0 | 0 | 0 | 0 | none |
| blocked 3 (bare stored prompt) | 0 | 0 | 0 | 0 | 0 | 0 | 0 | none |
| control, item ready (envelope with the tag) | 1 | 5989 | 2 | 44084 | 24161 | 577 | 0.7332721999999999 | claude-fable-5-2 |

Each blocked run exited 0 in about 5 s of wall time (the CLI's start and the plugins' SessionStart
hooks), with `num_turns: 0` and `duration_api_ms: 0`; its `result` read:

```text
UserPromptSubmit operation blocked by hook:
devkit roadmap: nothing is ready (helpers-full)
```

The control run's `result`: `Sim, uma devkit tick note chegou (via hook UserPromptSubmit); primeiros 80 caracteres: `devkit tick note: session b6a7a1e1-6b08-4e40-9fd9-032862ca5881. Run: node "/hook` — nada foi executado.`

Hook log (`DEVKIT_HOOK_LOG`):

```text
{"at":"2026-11-28T17:30:02.884Z","mode":"prompt","session":"d4cf3720-d82c-4724-b92e-cc7c1ce1d301","change":null,"decision":"block","why":"helpers-full"}
{"at":"2026-11-28T17:30:07.669Z","mode":"prompt","session":"e711d54d-dc66-40af-b125-86b74c90c6ba","change":null,"decision":"block","why":"helpers-full"}
{"at":"2026-11-28T17:30:24.424Z","mode":"prompt","session":"9af7f890-5807-4c2b-807e-8127ff8a985f","change":null,"decision":"block","why":"helpers-full"}
{"at":"2026-11-28T17:30:29.278Z","mode":"prompt","session":"b6a7a1e1-6b08-4e40-9fd9-032862ca5881","change":null,"decision":"allow","why":"ready"}
{"at":"2026-11-28T17:30:39.164Z","mode":"stop","session":"b6a7a1e1-6b08-4e40-9fd9-032862ca5881","agentType":null,"change":null,"decision":"allow","why":"no-run"}
```

The raw payload logger saw the `prompt` as given, the bare stored prompt and the scheduler's
envelope, and the hook recognised both.

## What this settles and what it does not

- Settled: a `UserPromptSubmit` block of the tick's prompt, bare or in the scheduler's envelope,
  makes no model call and costs 0 tokens in a headless session with the machine's plugins; a passing
  tick's note reaches the model as context.
- Not settled here: that a real scheduled firing's prompt goes through `UserPromptSubmit` the same
  way, and what the app counts for a blocked firing. Task 6.1 measures it on the owner's Mac.

The scratch folder `/var/tmp/devkit-hc-tick`, created by this session, is removed after.
