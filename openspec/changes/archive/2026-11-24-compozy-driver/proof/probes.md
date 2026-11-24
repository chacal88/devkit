# Probes of CompozyOS (phase 1)

Change: `compozy-driver` · Task 1.1 · Date: 2026-11-23 · Run by the conducting session.

Environment: CompozyOS 0.6.2 (`compozy --version`), daemon running (`compozy status -o json`:
`"status": "running"`, socket `~/.compozy/daemon.sock`), macOS. Scratch git repository outside
this one, under the session's scratch folder, registered with
`compozy workspace add <scratch> --name devkit-probe` (workspace `ws_154d8ca4c64906ab`). Throwaway
loops were written as workspace files `.compozy/loops/<name>/loop.yaml` and a fake
`.compozy/bin/devkit-kit` that appends its arguments to `kit-calls.log` (`fail` exits 1). Each probe
below gives the command, the output that decides it, and the result. Syntax facts the probes found
are collected at the end, for the implementer.

Summary: twelve probes pass; P-10 fails, and its row names a design amendment (made in `design.md`,
section "Probe amendments (phase 1)"). No probe's row says "stop".

## P-1

What: a seat's Bash env. Loop `probe-p12`, one `run-agent` node with a workspace agent
`seat-probe` (`provider: claude`, `permissions: approve-all`) told to run
`echo "SID=$COMPOZY_SESSION_ID"`.

```
compozy loop run --name probe-p12 -o json   # run looprun-a4635d67f556e236, status done
compozy session outline <seat session>
- sid: `sess_6a09179f68855cab2cff32437ca618b5`
```

The variable holds the seat's own CompozyOS session id. Result: pass.

## P-2

What: a seat hands work on. Same node: one Agent call with
`subagent_type "devkit-core:codebase-researcher"` asking for the first line of `README.md`.

First run (looprun-e533179ffbb9c786): the call failed, "the agent type does not exist in this
session". A second probe listed the seat's agent types and skills: the user-scope plugins were
loaded, `devkit-core` was not. On this machine `devkit-core@devkit` is installed with
`scope: project`, recorded per project path in `~/.claude/plugins/installed_plugins.json`; the
scratch repository had none. After
`claude plugin install devkit-core@devkit --scope project` in the scratch repository:

```
compozy loop run --name probe-p12 -o json   # run looprun-a4635d67f556e236, status done
Both steps ran.
- sid: `sess_6a09179f68855cab2cff32437ca618b5`
- answer: `# probe`
- agent_error: none
```

Result: pass, with a precondition: a seat sees the devkit agents only when the devkit packs are
installed for the workspace's own path, as every devkit project has them. The local proof (D-18)
installs them in each scratch project, and the kit's setup check names the pack when it is missing
(see the design's probe amendments).

## P-3

What: `stop_when` and `iteration_cap: 0`. Loop `probe-p3b`: a `run-agent` node `read` that
increments a counter file and returns `kind` `archived` once it reaches 3, else `open`; a `gate`
`confirm`; `iteration_cap: 0`; `stop_when: 'nodes.read.output.kind == "archived" &&
nodes.confirm.status == "succeeded"'`.

```
compozy loop run --name probe-p3b -o json   # looprun-18c24488bcf1c05c
compozy loop status --run-id looprun-18c24488bcf1c05c -o json   # "status": "done", "generation": 3
cat count   # 3
```

Generations went on while the condition was false and the run ended `done` in the generation where
it turned true. Also seen (loop `probe-rm`, only `gate` and `wait` nodes, `iteration_cap: 0`,
`no_progress: { window: 0 }`, `stop_when: 'nodes.state_end.status == "succeeded"'`): three rounds,
then `done` (looprun-1b23195dce5c07ea, "DONE ... after 3 rounds"). Result: pass.

## P-4

What: `fan-out`, `item`, `collect`. Loop `probe-p4`: `list` returns
`jobs = [{agent: general, x: a}, {agent: seat-probe, x: b}]` and `none = []`; fan-out `lanes` over
`jobs` with body `lane` (`agent: "{{ .item.agent }}"`, prompt `Reply with name = {{ .item.x }}.`),
then `collect` `done` and a gate `after_full`; a second fan-out `empty` over `none`, then `collect`
`empty_done` and a gate `after_empty`.

```
compozy loop nodes --run looprun-... --all -o json
  lane 0 succeeded sess_e4998097... 10:45:36.389429Z 10:45:44.482341Z
  lane 1 succeeded sess_e2c19737... 10:45:36.389429Z 10:45:44.564795Z
  done 0 succeeded / after_full 0 succeeded
  empty 0 succeeded / empty_lane 0 pending / empty_done 0 succeeded / after_empty 0 succeeded
compozy session history <lane 0> | grep agent_name   # "agent_name": "general"
compozy session history <lane 1> | grep agent_name   # "agent_name": "seat-probe"
kit-calls.log: after-full, then after-empty
```

The lanes started at the same instant, each as the agent its item named, with the item's value in
the prompt (an earlier run's lane prompts read `Reply with name = a.` and `... = b.`); the node
after `collect` ran once after both; the empty collection settled with no lane and the next node
ran. Result: pass.

## P-5

What: gate commands. Loop `probe-p3` (first form): gate `g` with
`check: "./.compozy/bin/devkit-kit ok {{ toJson .nodes.r.output | shellQuote }}"` and
`timeout: 3h`; gate `g_fail` (`devkit-kit fail gen`) with `on_result: { fail: { route: routed } }`.

```
compozy loop validate --file .compozy/loops/probe-p3/loop.yaml -o json   # "valid": true
kit-calls.log:
devkit-kit called with: ok {"kind":"x","note":"it's \"quoted\""}
devkit-kit called with: fail gen
devkit-kit called with: routed after-fail
```

The relative path `./.compozy/bin/devkit-kit` resolved from the criterion's cwd (the workspace
root); `toJson ... | shellQuote` passed the whole object, quotes included, as one argument; the
failed gate routed to `routed`; `timeout: 3h` validated. Result: pass, with a routing fact found on
the way (end of this file: a gate that passes follows every forward edge unless
`on_result.pass.route` names one).

## P-6

What: workspace loops. Every probe loop above was a file `.compozy/loops/<name>/loop.yaml` in the
workspace, never passed to `loop create`.

```
compozy loop list -o json   # ['probe-p3', 'probe-p4', 'probe-t1', 'probe-t2', 'probe-t3']
compozy loop run --name probe-child --input word=via-cli -o json
  keys: ['resolution_source', 'run', 'web_url']
  web_url: http://localhost:2123/loop-runs/looprun-c02c517e833f496f
```

A new file is listed and runnable by name a few seconds after it is written (a `run` in the same
second answered `loop definition not found`); `web_url` is a top-level field of the reply, next to
`run`. Result: pass.

## P-7

What: `wait` and `run-loop`. Loop `probe-p7`: gate `before`, `wait` `pause` (`params: { for: 1m }`),
`run-loop` `child` (`class: action`, `params: { loop: probe-child, await: true, inputs: { word:
"hello world" } }`), gate `after`. Loop `probe-p7b`: the same `run-loop` on a child that waits 30 s.

```
compozy loop events looprun-3e2d4c7b631a98a1 --view all -o jsonl
  10:41:26.271 node_wait_started pause
  10:42:32.058 node_wait_resumed pause
  10:42:32.119 node_running child / 10:42:32.235 gate_verdict after
kit-calls.log: before-wait, child hello world, after-child
compozy loop runs --loop probe-child -o json   # inputs {'word': 'hello world'}, parent_loop_run_id looprun-3e2d4c7b631a98a1
probe-p7b at +18 s: [('child', 'awaiting_child'), ('after', 'pending')]; 'after' ran at 10:48:02, after the child's wait
```

`for: 1m` resumed after about a minute; the awaited child received its input and the parent node
stayed `awaiting_child` until the child ended. Result: pass.

## P-8

What: `ask`. Loop `probe-p8`: `run-agent` `q` returns `question = What colour?`; `ask` `ask`
(`class: control`, `params: { prompt: "{{ .nodes.q.output.question }}", expect: { answer: string
} }`); gate `use` runs `devkit-kit answer {{ .nodes.ask.output.answer | shellQuote }}`.

```
compozy loop requests --run-id looprun-8624af39ac8b73a7 -o json
  {"node_id": "ask", "kind": "ask", "state": "pending", "prompt": "What colour?", "decisions": ["respond"], "agents": "deny", ...}
compozy loop respond --run-id looprun-8624af39ac8b73a7 --node ask --generation 1 --decision respond --payload '{"answer":"verde-azul"}' -o json
  "state": "answered"
compozy loop status ...   # done 1
kit-calls.log: devkit-kit called with: answer verde-azul
```

The prompt rendered an earlier node's output, the answer moved the run, and a later node of the
same generation read it. Result: pass.

## P-9

What: the daemon socket.

```
node -e 'require("net").connect(process.env.HOME+"/.compozy/daemon.sock").on("connect",...)'
connected
exit=0
```

`COMPOZY_HOME` is unset here, so the socket is `~/.compozy/daemon.sock`, the path
`compozy status -o json` reports. Result: pass.

## P-10

What: `compozy__terminal_exec` as a loop node. Loop `probe-p3` (first form), node `tick`
(`kind: compozy__terminal_exec`, `params: { command: sh, args: ["-c", "pwd; echo gen; exit 3"] }`),
and three variants of its parameters (`visible`/`yield_ms`, `input:`, `params.input`).

```
compozy loop nodes --run looprun-6a109aaa82787336 --all -o json
  "state": "quarantined", "attempts": [{"state": "failed", "failure_class": "authoring", "disposition": "escalated"}]
~/.compozy/logs/compozy.log:
  "error":"action_dependency_missing: loop: action dependency missing: terminal tools require an active session run and cannot execute as loop actions (dependency=session_run_identity)"
```

Result: fail. Row decision: "the state node becomes a `gate` per end state; design amended". The
amendment is in `design.md`, section "Probe amendments (phase 1)": D-7's `state` node becomes the
gates `state_all` and `state_stuck`, one per end state. The shape was probed live with loop
`probe-rm` (P-3: a control-only loop with `iteration_cap: 0` and `no_progress: { window: 0 }` runs
until its `stop_when` turns true).

## P-11

What: `route`. Loop `probe-p3`: `run-agent` `r` returns `kind = x`; `route` `by_kind`
(`class: control`, `routes: [ { when: 'nodes.r.output.kind == "x"', to: g } ]`, `default: other`).
Loop `probe-g3`: `routes: [ { when: "1 == 2", to: b } ]`, `default: c`.

```
probe-p3 nodes: by_kind succeeded, g succeeded (the `when` branch)
probe-g3 nodes: s succeeded, b not_taken, c succeeded; kit-calls.log: g3-c only
```

The `when` over a `run-agent` output took its branch, and `default` took the other when no `when`
held, running only that node. Result: pass.

## P-12

What: runs.

```
compozy loop runs --loop probe-child -o json   # status 'done', inputs {'word': 'hello world'}, run_id, parent_loop_run_id
compozy loop pause --run-id <probe-p7 run>      # ok; status running, pause_requested true while its wait runs
  07:44:37 paused pause_requested=False          # at the next node boundary
compozy loop resume --run-id <run>               # ok; the run went on to done
compozy loop cancel --run-id looprun-646de8a585243250   # "status": "canceled"
```

The listing carries each run's `status` and its `inputs` (absent when the loop has none) under
`run_id`; pause, resume and cancel act by run id; a pause lands at the next node boundary.
Result: pass.

## P-13

What: the readiness reads.

```
cd <scratch, not yet registered> && compozy workspace info -o json
  {"error":"cli: workspace resolution failed ... is not registered"}
  exit=1
compozy loop inspect --name no-such-loop-xyz -o json
  {"error":"loop definition not found: loop definition \"no-such-loop-xyz\" not found"}
  exit=69
```

Both exit non-zero. Result: pass.

## Syntax facts for the implementer

Found while running the probes; `compozy loop validate` accepts unknown keys silently, so each form
below is the one that ran, not only one that validated.

- Node classes: `action` for `run-agent`, `run-loop` and registry tools; `control` for `gate`,
  `route`, `fan-out`, `collect`, `wait` and `ask`.
- `fan-out`: `collection`, `max_fan_out` and `max_parallel` sit on the node itself, not under
  `params`; the lane is the node its forward edge reaches, and the lane's edge reaches the `collect`.
- `ask`: `params.prompt` and `params.expect`; the request's only decision is `respond`, answered by
  `compozy loop respond --run-id <id> --node <node> --generation <n> --decision respond --payload
  '<json>'`; `"agents": "deny"` is the default.
- `wait`: `params.for` (`10s`, `1m`). `run-loop`: `params.loop`, `params.await: true`,
  `params.inputs`.
- `route`: `routes: [ { when, to } ]` and `default` on the node.
- `gate`: `criteria`, `timeout` and `on_result` on the node. A gate that passes follows every one
  of its forward edges, the `on_result.fail.route` target included (probe `g1`: b and c both ran),
  unless `on_result.pass: { route: <node> }` names one (probe `g4`: only b ran). A failing gate
  with `fail: { route: x }` runs only `x`, and its node state reads `succeeded`. A failing gate
  with `fail: next_generation` reads `failed` and starts the next generation, running nothing after
  it. The `fail.route` target must be a declared forward edge of the gate.
- `stop_when` read over node outputs and statuses behaved as written in every probe. A control-only
  loop that sets `stop_when: "generation >= 2"` ended after one round (probe `g4`); conditions on
  `generation` are not used by the design.
- `no_progress`: a control-only loop whose rounds start nothing stalled after three rounds with the
  default window (probe `g5`: `stalled`); with `no_progress: { window: 0 }` it ran until
  `stop_when` (probe `probe-rm`).
- A provider `claude` seat loads the user-scope plugins and the plugins installed for the
  workspace's own path, not those of another project.

## Clean-up

The throwaway loops were removed with their files, the scratch repository's project-scope install
of `devkit-core@devkit` was removed with `claude plugin uninstall devkit-core@devkit --scope
project`, and the workspace with `compozy workspace remove devkit-probe`; the check below is the
output of `compozy workspace list` after it.

```
compozy workspace remove devkit-probe -o json   # {"id": "ws_154d8ca4c64906ab", ..., "name": "devkit-probe", ...}
compozy workspace list
ID                   Name               Root                                            Add Dirs  Default Agent  Updated
ws_0c346c94199c8e00  devkit             /Users/kauesantos/Documents/devkit              0         tech-lead      2026-11-14T13:54:30Z
ws_d66fb5f988665f6c  psim-kernel        /Users/kauesantos/Documents/winker/psim-kernel  0         --             2026-11-18T22:05:53Z
ws_ddcca7ab340c2219  whatsapp-platform  /Users/kauesantos/Documents/whatsapp-plataform  0         implementer    2026-11-13T18:19:16Z
```

`devkit-probe` is no longer listed. Also seen there: the `devkit` workspace names `tech-lead` as its
default agent, an agent the kit's re-run removes (A-6); see the design's probe amendments.
