# Roadmap proof (AC-9, task 5.3)

Change: `compozy-driver` · Date: 2026-11-23 · Run by the conducting session.

Setup: the scratch project `devkit-proof` of task 5.1 (a git repository with no remote, the branch's
three packs installed at project scope from a temporary marketplace, `devkit.driver: compozy`, the kit
installed and the folder registered as the CompozyOS workspace `devkit-proof`). Its
`openspec/roadmap.md` holds three independent lines, `add-sub`, `add-mul` and `add-div`, none with an
`after:`.

## `/devkit roadmap 2`

The call the `devkit` skill makes on this driver, from the project's root:

```
node <devkit-openspec>/hooks/roadmap-loop.mjs compozy-start --lang pt-BR --load-limit 80 <<'DEVKIT_ARGS'
roadmap 2
DEVKIT_ARGS
O roadmap roda no CompozyOS com até 2 changes ao mesmo tempo: http://localhost:2123/loop-runs/looprun-bb4bb2344d55c70a.
```

One minute later, `compozy loop runs --workspace devkit-proof -o json`:

```
devkit-change  running  gen 2  add-mul  started 2026-11-23T15:13:46.19Z  looprun-a4bc9068808707a9
devkit-change  running  gen 2  add-sub  started 2026-11-23T15:13:46.07Z  looprun-c526e3d99d8a34ad
devkit-roadmap running  gen 2  {'lang': 'pt-BR', 'load_limit': 80, 'places': 2}  looprun-bb4bb2344d55c70a
```

Two change runs were started at once, one per ready line, and `add-div` was not started: the two
places were full. Each change run's inputs carried the roadmap line's text as the request. In each
run the first generation ran `read` (agent `change-coordinator`), `confirm`, `by_kind` and `run_role`
(agent `change-coordinator`): the change was opened (`git worktree list` in the project shows the
worktrees `.claude/worktrees/add-mul` and `.claude/worktrees/add-sub`, branches `add-mul` and
`add-sub`), and the second generation reached `ask_grill`, a CompozyOS human request, for each:

```
compozy loop requests --workspace devkit-proof -o json
looprun-a4bc9068808707a9 ask_grill pending  Quando `mul(a, b)` receber algo que não seja número ... 
looprun-c526e3d99d8a34ad ask_grill pending  Qual deve ser o comportamento de `sub(a, b)`? ...
```

(An earlier attempt started the same two runs and failed at `read`: CompozyOS refused 19 of the 20
generated agents because their description exceeded 280 characters. Task 4.9 fixed the generator;
the three runs of that attempt, `looprun-50115add7f995b0e`, `looprun-cdb087a5abe11eb5` and the
roadmap run `looprun-8980246d2e3c68b4`, were cancelled.)

## A start held by the load

With two places taken and `add-div` ready, the tick was called with a load limit of 1% and a third
place, the way the roadmap run's `tick` gate calls it:

```
node <devkit-openspec>/hooks/roadmap-loop.mjs compozy-tick --places 3 --load-limit 1 --lang pt-BR
add-div está pronta para começar, mas a máquina está carregada (processador em 38%, limite 1%): seguro o começo até aliviar. Se quiser começar mesmo assim, é só dizer.
```

No run was started for `add-div` (`compozy loop runs` unchanged). The held line is the one of the
Claude driver (`roadmap-held`). Result: pass; the check of task 5.3 shows two change runs started
for `/devkit roadmap 2` and the held line under a load limit of 1.
