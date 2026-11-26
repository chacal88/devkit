// The conducting session's part of the release-at-merge proof (design D-16 and D-36, S-1 to S-13; tasks 7.1 to 7.7, 9.15 and 11.11): this worktree's real agents,
// each run with `claude --plugin-dir <worktree>/plugins/core --plugin-dir <worktree>/plugins/openspec -p` on the brief this worktree's
// `change-loop.mjs next` gives, in the scratch projects K, K0 and N, each change opened with this worktree's `change-loop.mjs open`.
// Each case writes its commands, the files it seeded and the real outputs to one fragment; `assemble` joins them into agents-run.md.
//
//   TMPDIR=/var/tmp/devkit-release-at-merge node openspec/changes/release-at-merge/proof/agents.mjs seed       # K, K0 and N
//   TMPDIR=/var/tmp/devkit-release-at-merge node openspec/changes/release-at-merge/proof/agents.mjs S-1 S-2    # cases, in that order
//   TMPDIR=/var/tmp/devkit-release-at-merge node openspec/changes/release-at-merge/proof/agents.mjs assemble   # proof/agents-run.md
//   TMPDIR=/var/tmp/devkit-release-at-merge node openspec/changes/release-at-merge/proof/agents.mjs append=S-12 # one case added to its end
//   TMPDIR=/var/tmp/devkit-release-at-merge node openspec/changes/release-at-merge/proof/agents.mjs seed S-13 append=S-13
//
// A case whose done-condition does not hold records it and exits 1. Remove $TMPDIR/devkit-proof-release-at-merge after the run.

import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PROOF, CASES, WT, DEV, Record, sh, git, put, read, commitAll, seedProject, consumerFiles, hash12, node, short, BLANK,
  openChange, openLoopChange, drive,
} from './seed.mjs';

const RECORDS = join(CASES, 'records');
const RUNS = join(CASES, 'runs');
const HOOK_TMP = join(CASES, 'tmp');
const OUT = join(PROOF, 'agents-run.md');
for (const d of [RECORDS, RUNS, HOOK_TMP]) mkdirSync(d, { recursive: true });

const SHIP = 'ship:\n  devkit: merge\n  devkit-lite: merge\n';
const CONFIG_K = `schema: devkit\n${SHIP}devkit:\n  release_tag: package.json\n`;
const CONFIG_N = `schema: devkit\n${SHIP}`;

// ---------------------------------------------------------------- projects

// A project seedProject built in an earlier call, found again by its name.
function attach(name) {
  const dir = join(CASES, name);
  if (!existsSync(dir)) throw new Error(`project ${name} does not exist: run "seed" first`);
  const stateFile = join(dir, 'gh', 'state.json');
  const base = { ...process.env, ...BLANK, TMPDIR: HOOK_TMP };
  const env = {
    ...base, PATH: `${join(dir, 'gh', 'bin')}:${process.env.PATH}`, DEVKIT_PROOF_GH: stateFile,
    GIT_AUTHOR_NAME: 'devkit proof', GIT_AUTHOR_EMAIL: 'proof@devkit.invalid', GIT_COMMITTER_NAME: 'devkit proof', GIT_COMMITTER_EMAIL: 'proof@devkit.invalid',
    GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null', GIT_EDITOR: 'true',
  };
  return { name, dir, origin: join(dir, 'origin.git'), main: join(dir, 'main'), env };
}

function seed() {
  const rec = new Record(join(RECORDS, '0-seed.md'));
  rec.text('## How the projects are built');
  rec.text('`proof/seed.mjs` (`seedProject`, phase 6) builds each project: a bare `origin.git`, a main checkout `main` with this worktree\'s '
    + 'schemas copied to `openspec/schemas`, one commit pushed to `origin/main`, and the `gh` stub of `seed.mjs` first on `PATH` (it never '
    + 'calls GitHub; the merge-mode setup reads its ruleset answer). The files are `consumerFiles` of `seed.mjs`: an app whose release file '
    + 'is `package.json` (1.4.0), a root `CHANGELOG.md`, `src/app.ts` and, unless left out, `docs/adr/0001-start.md`. K names '
    + '`devkit.release_tag: package.json` and has `docs/adr/0001-start.md`; K0 is K without `docs/adr/`; N is K without `devkit.release_tag`. '
    + 'All three deliver in `merge` mode, so the loop hands the implementation once the plan is approved.');
  for (const [name, config, files] of [['K', CONFIG_K, consumerFiles()], ['K0', CONFIG_K, consumerFiles({ adr: false })], ['N', CONFIG_N, consumerFiles()]]) {
    const p = seedProject(name, { config, files });
    rec.text(`### Project ${name}`);
    sh(p.main, ['cat', 'openspec/config.yaml'], { rec });
    sh(p.main, ['git', 'ls-files', '--', '.', ':(exclude)openspec/schemas'], { rec });
  }
  rec.flush();
}

// ---------------------------------------------------------------- the pieces of a case

// The record of the case running now: `begin` opens it with the case's heading; a failure flushes it with the error.
let current = null;
function begin(file, heading) {
  current = new Record(join(RECORDS, `${file}.md`));
  current.text(heading);
  return current;
}

const head = (stage, commit, result = 'passed', attempt = 1) => `<!-- devkit-stage ${stage} result=${result} attempt=${attempt} commit=${commit} -->\n`;
const dirOf = (c) => `openspec/changes/${c.id}`;

// Opens change `id` with this worktree's `change-loop.mjs open` (the request on standard input), as the coordinator does.
function open(p, id, why, request, rec) {
  const r = sh(p.main, node('change-loop.mjs', 'open', id, '--script', 'devkit', '--why', why, '--lang', 'en'), { env: p.env, rec, input: request, label: `node $DEV/change-loop.mjs open ${id} --script devkit --why ${why} --lang en <<< ${JSON.stringify(request)}` });
  const out = JSON.parse(r.out.slice(r.out.indexOf('{')));
  return { id, wt: out.worktree };
}

// Writes `files` (paths under the change folder unless they start with a slash-free top folder named in `root`) and records each one.
function seedFiles(c, files, rec, what = 'Seeded') {
  put(c.wt, files);
  rec.text(`${what} in \`${short(c.wt)}\`:`);
  for (const f of Object.keys(files)) sh(c.wt, ['cat', f], { rec });
}

// The loop's `next` for the change, recorded; returns its action.
function next(p, c, rec) {
  const r = sh(c.wt, node('change-loop.mjs', 'next', '--change', c.id, '--lang', 'en'), { env: p.env, rec, expect: null });
  return { out: r.out, action: JSON.parse(r.out.slice(r.out.indexOf('{'))) };
}

const REQUEST = 'Persist each user\'s preferences. The app has no storage today.';
const requirements = (commit, request = REQUEST) => `${head('requirements', commit)}# Requirements

## Request

> ${request}

## Assumptions

- The app is a Node.js service; its code lives in \`src/\` and it has no database today.
- The owner chose SQLite: one file \`data/app.db\` read through the \`better-sqlite3\` package, not JSON files. Every later
  feature reads preferences through this store, so moving off it later means migrating every user's data.

## Acceptance criteria

- AC-1: \`src/prefs.ts\` exports \`getPref(user, key)\` and \`setPref(user, key, value)\`, backed by a \`prefs\` table in \`data/app.db\`.
- AC-2: a preference written by \`setPref\` is read back by \`getPref\` after the process restarts.
- AC-3: \`getPref\` of a key never written returns \`null\`.

## Out of scope

- Sharing preferences between users.
`;

// The claude -p call of one hand-off: the conducting session makes exactly one Agent call with the action's agent, model and brief.
const PROMPT = (a) => `This session is the conducting session of the devkit change \`${a.change}\` in a scratch project. It hands one stage to its agent, as the \`devkit\` skill's Loop does for an \`agent\` action; the loop's \`next\` gave this action: stage \`${a.stage}\`, agent \`${a.agent}\`${a.model ? `, model \`${a.model}\`` : ''}.

Make exactly one Agent call: subagent_type \`${a.agent}\`${a.model ? `, model \`${a.model}\`` : ''}, and as its prompt this brief, verbatim:

${a.brief}

Do nothing else: run no command, read or write no file yourself, and make no other Agent call. When the agent returns, reply with its final message, verbatim.
`;

// What the stream-json output of run `label` shows: the init event's plugins, the Agent call, the agent's model and tools, its final
// message and the result line. The conducting session runs the agent as a background agent, so the Agent call's own tool result is
// the launch notice: the agent's final message is its last text (or, with none, the summary of the task notification).
function describeRun(label, action) {
  const events = readFileSync(join(RUNS, `${label}.jsonl`), 'utf8').split('\n').filter(Boolean)
    .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const init = events.find((e) => e.type === 'system' && e.subtype === 'init') ?? {};
  const result = events.filter((e) => e.type === 'result').pop() ?? {};
  const top = events.filter((e) => e.type === 'assistant' && !e.parent_tool_use_id).flatMap((e) => e.message?.content ?? []);
  const calls = top.filter((b) => b.type === 'tool_use' && (b.name === 'Agent' || b.name === 'Task'));
  const call = calls[0];
  const own = events.filter((e) => e.type === 'assistant' && call && e.parent_tool_use_id === call.id);
  const texts = own.flatMap((e) => e.message?.content ?? []).filter((b) => b.type === 'text').map((b) => b.text);
  const notice = events.filter((e) => e.type === 'system' && e.subtype === 'task_notification').pop();
  const final = texts.pop() ?? notice?.summary ?? '';
  const inner = own.flatMap((e) => e.message?.content ?? []).filter((b) => b.type === 'tool_use')
    .map((b) => short(`${b.name} ${b.input?.file_path ?? b.input?.command ?? b.input?.pattern ?? b.input?.path ?? ''}`).replace(/\s+/g, ' ').slice(0, 220));
  const models = [...new Set(own.map((e) => e.message?.model).filter(Boolean))];
  const stats = [
    `session: ${init.session_id ?? '?'}; conducting model: ${init.model ?? '?'}; permission mode: ${init.permissionMode ?? '?'}`,
    ...((init.plugins ?? []).filter((pl) => /^devkit-(core|openspec)$/.test(pl.name)).map((pl) => `plugin ${pl.name} ${pl.version ?? ''} from ${pl.path}`)),
    `Agent calls of the conducting session: ${calls.length}`,
    ...(call ? [`Agent call: subagent_type=${call.input?.subagent_type} model=${call.input?.model ?? '(frontmatter)'} prompt-is-the-brief=${call.input?.prompt?.includes(action?.brief ?? '\u0000') ? 'yes' : 'no'}`] : []),
    `the agent's model: ${models.join(', ') || '?'}`,
    `the agent's task: ${notice ? `${notice.status} (task notification)` : 'no task notification'}`,
    `last result: ${result.subtype ?? '?'} is_error=${result.is_error ?? '?'} turns=${result.num_turns ?? '?'} cost_usd=${result.total_cost_usd ?? '?'}`,
  ].join('\n');
  return { init, calls, final, inner, stats };
}

// Runs the agent of `action` for real and records the command, its exit code, what `describeRun` reads from its output and the live
// hook decisions. Returns { code, final, sessionId, calls }.
function runAgent(c, action, rec, label) {
  const jsonl = join(RUNS, `${label}.jsonl`);
  const hookLog = join(RUNS, `${label}.hooks.jsonl`);
  const env = { ...process.env, TMPDIR: HOOK_TMP, DEVKIT_HOOK_LOG: hookLog };
  for (const k of ['CLAUDECODE', 'CLAUDE_CODE_ENTRYPOINT', 'CLAUDE_CODE_SESSION_ID']) delete env[k];
  const argv = ['claude', '-p', '--model', 'sonnet', '--permission-mode', 'bypassPermissions', '--plugin-dir', join(WT, 'plugins', 'core'),
    '--plugin-dir', join(WT, 'plugins', 'openspec'), '--output-format', 'stream-json', '--verbose'];
  const prompt = PROMPT(action);
  const t0 = Date.now();
  const r = spawnSync(argv[0], argv.slice(1), { cwd: c.wt, env, input: prompt, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, timeout: 60 * 60 * 1000 });
  const minutes = ((Date.now() - t0) / 60000).toFixed(1);
  writeFileSync(jsonl, r.stdout ?? '');
  writeFileSync(join(RUNS, `${label}.action.json`), JSON.stringify(action));
  const d = describeRun(label, action);
  const hooks = existsSync(hookLog) ? readFileSync(hookLog, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
  const tally = {};
  for (const h of hooks) { const k = `${h.mode} ${h.agentType ?? 'session'} ${h.decision} (${h.why})`; tally[k] = (tally[k] ?? 0) + 1; }

  rec.text(`The real agent, run in \`${short(c.wt)}\` (the prompt on standard input; ${minutes} min):`);
  rec.block(`(in ${c.wt})\n$ TMPDIR=$CASES/tmp DEVKIT_HOOK_LOG=$CASES/runs/${label}.hooks.jsonl ${argv.map((a) => (/\s/.test(a) ? `'${a}'` : a)).join(' ')} < prompt.txt\n[exit ${r.status}]`);
  rec.text('The prompt (`prompt.txt`), the brief being the `brief` field of the `next` above, verbatim:');
  rec.block(prompt);
  rec.text(STATS_LEAD);
  rec.block(d.stats);
  rec.text('The tools the agent called, in order:');
  rec.block(d.inner.join('\n') || '(none)');
  rec.text(FINAL_LEAD);
  rec.block(d.final || '(none)');
  rec.text('The live hook decisions of the run (`DEVKIT_HOOK_LOG` of the worktree\'s `guard.mjs`; mode, agent, decision, why, count). The run\'s '
    + 'transcript holds no typed `/devkit change` command, so the stop and hand-off locks read no run (`no-run`); the planner\'s stop '
    + 'is judged by the `guard.mjs subagent-stop` calls of the case, with the run transcript they name:');
  rec.block(Object.entries(tally).map(([k, n]) => `${k} x${n}`).join('\n') || '(no decision logged)');
  if (r.status !== 0) rec.block(`stderr:\n${r.stderr ?? ''}${r.error ? `\n${r.error.message}` : ''}`);
  return { code: r.status, final: d.final, sessionId: d.init.session_id ?? null, calls: d.calls.length };
}

const STATS_LEAD = 'From the run\'s stream-json output (kept in the scratch folder while the proof ran):';
const FINAL_LEAD = 'The agent\'s final message (its last text; the conducting session ran it as a background agent):';

// Rewrites the run summaries of a fragment recorded before describeRun read the background agent's final message: for each run of
// the fragment, in order, its stats block and its final-message block are read again from the run's saved output.
function refix(name) {
  const file = join(RECORDS, `${name}.md`);
  const parts = readFileSync(file, 'utf8').split(/(?=The real agent, run in )/);
  for (let i = 1; i < parts.length; i++) {
    const label = /DEVKIT_HOOK_LOG=\$CASES\/runs\/(S-[\w-]+)\.hooks\.jsonl/.exec(parts[i])[1];
    const actionFile = join(RUNS, `${label}.action.json`);
    const brief = /verbatim:\n\n([^\n]+)\n\nDo nothing else/.exec(parts[i])?.[1];
    const action = existsSync(actionFile) ? JSON.parse(readFileSync(actionFile, 'utf8')) : { brief: brief?.split('$CASES').join(CASES) };
    const d = describeRun(label, action);
    const fence = (body) => { const t = short(body).replace(/\n+$/, ''); const f = '`'.repeat(Math.max(3, ...[...t.matchAll(/`{3,}/g)].map((m) => m[0].length + 1))); return `${f}text\n${t}\n${f}`; };
    parts[i] = parts[i]
      .replace(/From the run's stream-json output[^\n]*\n\n(`{3,})text\n[\s\S]*?\n\1/, () => `${STATS_LEAD}\n\n${fence(d.stats)}`)
      .replace(/The agent's final message[^\n]*\n\n(`{3,})text\n[\s\S]*?\n\1/, () => `${FINAL_LEAD}\n\n${fence(d.final || '(none)')}`);
  }
  writeFileSync(file, parts.join(''));
}

// A change run's transcript as the guard reads it: the typed `/devkit-openspec:devkit change <id>` and the tool result of the loop's
// `next` (its real output, `devkit-run: <id>` first), in the stored line forms of Claude Code (test-fixtures.mjs).
function runTranscript(c, nextOut, label) {
  const base = { parentUuid: null, isSidechain: false, userType: 'external', entrypoint: 'sdk-cli', cwd: c.wt, sessionId: `proof-${label}`, version: '2.1.329', gitBranch: c.id };
  const typed = { ...base, uuid: 'uuid-1', timestamp: '2026-11-24T15:00:00.000Z', type: 'user', message: { role: 'user', content: `<command-message>devkit</command-message>\n<command-name>/devkit-openspec:devkit</command-name>\n<command-args>change ${c.id}</command-args>` } };
  const result = { ...base, uuid: 'uuid-2', timestamp: '2026-11-24T15:00:05.000Z', type: 'user', message: { role: 'user', content: [{ tool_use_id: 'toolu-1', type: 'tool_result', content: nextOut, is_error: false }] }, toolUseResult: { stdout: nextOut, stderr: '', interrupted: false, isImage: false, noOutputExpected: false } };
  const file = join(RUNS, `${label}.transcript.jsonl`);
  writeFileSync(file, `${JSON.stringify(typed)}\n${JSON.stringify(result)}\n`);
  return file;
}

// `guard.mjs subagent-stop` with the planner's input (what Claude Code passes the SubagentStop hook), recorded with its log line.
function plannerStop(p, c, rec, transcript, session) {
  const input = { session_id: session, transcript_path: transcript, cwd: c.wt, hook_event_name: 'SubagentStop', stop_hook_active: false,
    agent_type: 'devkit-core:change-planner', agent_id: `${session}-planner`, background_tasks: [] };
  const log = join(RUNS, `${session}.guard.jsonl`);
  const before = existsSync(log) ? readFileSync(log, 'utf8').split('\n').filter(Boolean).length : 0;
  const r = sh(c.wt, node('guard.mjs', 'subagent-stop'), { env: { ...p.env, DEVKIT_HOOK_LOG: log }, input: JSON.stringify(input), rec, expect: null,
    label: `echo '${JSON.stringify(input)}' | DEVKIT_HOOK_LOG=$CASES/runs/${session}.guard.jsonl node $DEV/guard.mjs subagent-stop` });
  const line = readFileSync(log, 'utf8').split('\n').filter(Boolean)[before] ?? '(no log line)';
  rec.block(`$CASES/runs/${session}.guard.jsonl, its new line:\n${line}`);
  return { code: r.code, err: r.err, log: JSON.parse(line) };
}

// The note read by `parseReleaseNote` of this worktree's deliver-check.mjs, recorded.
function parseNote(c, rec) {
  const code = `import('${join(DEV, 'deliver-check.mjs')}').then((m) => console.log(JSON.stringify(m.parseReleaseNote(require('node:fs').readFileSync('${dirOf(c)}/release.md', 'utf8')), null, 2)))`;
  const r = sh(c.wt, ['node', '-e', code], { rec, label: `node -e "import('$DEV/deliver-check.mjs').then((m) => console.log(JSON.stringify(m.parseReleaseNote(fs.readFileSync('${dirOf(c)}/release.md', 'utf8')), null, 2)))"` });
  return JSON.parse(r.out);
}

// The release state the delivery computes from the note (releaseStateAt of this worktree's deliver-check.mjs) once the plan is committed,
// as the session commits it before the delivery: the working tree is snapshot into a commit through a temporary index (no ref, file
// or index of the worktree moves), and that commit is measured against origin/main. `unassigned` when the note can be released,
// `error` with computeRelease's message when it cannot (row N1).
function releaseStateOf(p, c, rec) {
  const index = join(HOOK_TMP, `index-${c.id}`);
  const env = { ...p.env, GIT_INDEX_FILE: index };
  sh(c.wt, ['git', 'read-tree', 'HEAD'], { env });
  const changed = sh(c.wt, ['git', 'ls-files', '-m', '-o', '--exclude-standard'], { env }).out.split('\n').filter(Boolean);
  sh(c.wt, ['git', 'add', '--', ...changed], { env });
  const tree = sh(c.wt, ['git', 'write-tree'], { env }).out.trim();
  const snap = sh(c.wt, ['git', 'commit-tree', tree, '-p', 'HEAD', '-m', 'the plan as committed'], { env: p.env }).out.trim();
  rmSync(index, { force: true });
  rec.text(`The plan snapshot (\`git read-tree HEAD\`, \`git add\` of the files \`git ls-files -m -o --exclude-standard\` lists, and \`git write-tree\` with \`GIT_INDEX_FILE=$CASES/tmp/index-${c.id}\`, then \`git commit-tree <tree> -p HEAD\`): ${snap.slice(0, 12)}.`);
  const code = `import('${join(DEV, 'deliver-check.mjs')}').then((m) => { const g = (a) => require('node:child_process').execFileSync('git', a, { encoding: 'utf8' }).trim(); `
    + `const s = m.releaseStateAt(process.cwd(), { head: '${snap}', tip: g(['rev-parse', 'origin/main']), base: 'main', note: m.parseReleaseNote(require('node:fs').readFileSync('${dirOf(c)}/release.md', 'utf8')), file: 'package.json', adrs: m.changeAdrs(process.cwd(), null, '${c.id}') }); `
    + `console.log(JSON.stringify({ kind: s.kind, error: s.error ?? null, paths: s.paths, adrs: s.adrs })); })`;
  const r = sh(c.wt, ['node', '-e', code], { rec, label: `node -e "<releaseStateAt of $DEV/deliver-check.mjs: the snapshot ${snap.slice(0, 12)} against origin/main, the note of ${dirOf(c)}/release.md, file package.json, the records changeAdrs lists>"` });
  return JSON.parse(r.out);
}

// The checker's JSON `next` and `approval`, recorded.
function deliverCheck(p, c, rec) {
  const r = sh(c.wt, node('deliver-check.mjs', c.id, '--json'), { env: p.env, expect: null });
  const j = JSON.parse(r.out);
  rec.block(`(in ${c.wt})\n$ node $DEV/deliver-check.mjs ${c.id} --json   (its "next" and "approval")\n${JSON.stringify({ next: j.next, approval: j.approval }, null, 2)}\n[exit ${r.code}]`);
  return j;
}
// D-8's rows N1 to N7 as `next` shows them.
const nRow = (n) => n.step === 'assign-release' || (n.step === 'blocked' && /^(release\.md:|no release:|release lines edited by hand:|ADR \[)/.test(n.reason ?? ''))
  || /origin\/\S+ (does not exist|is missing)/.test(n.reason ?? '');

class Checks {
  constructor(rec) { this.rec = rec; this.failed = []; this.lines = []; }
  that(ok, what) { this.lines.push(`${ok ? 'holds' : 'FAILS'}: ${what}`); if (!ok) this.failed.push(what); return ok; }
  done(label) {
    this.rec.text(`Done-condition of ${label}:`);
    this.rec.block(this.lines.join('\n'));
    this.rec.flush();
    if (this.failed.length) throw new Error(`${label}: ${this.failed.join('; ')}`);
  }
}

const adrFiles = (c) => (existsSync(join(c.wt, 'docs', 'adr')) ? readdirSync(join(c.wt, 'docs', 'adr')).filter((f) => f.endsWith('.md')).sort() : []);
const listed = (c) => [...read(c.wt, `${dirOf(c)}/decisions.md`).matchAll(/^- ADR: `([^`]+)`/gm)].map((m) => m[1]);

// ---------------------------------------------------------------- the adr-author cases (S-1, S-4, S-5)

// Opens the change, seeds requirements.md as the grill leaves it, and runs the adr-author on the decisions stage `next` hands.
function adrAuthor(p, id, rec, label) {
  const c = open(p, id, 'architecture', REQUEST, rec);
  seedFiles(c, { [`${dirOf(c)}/requirements.md`]: requirements(git(c.wt, 'rev-parse', 'HEAD')) }, rec, 'Seeded (the requirements stage as the grill leaves it, passed)');
  sh(c.wt, ['ls', '-1', 'docs/adr'], { rec, expect: null });
  const { action } = next(p, c, rec);
  if (action.kind !== 'agent' || action.agent !== 'devkit-core:adr-author') throw new Error(`${label}: next is not the adr-author: ${action.kind} ${action.agent}`);
  const run = runAgent(c, action, rec, label);
  sh(c.wt, ['ls', '-1', 'docs/adr'], { rec, expect: null });
  sh(c.wt, ['cat', `${dirOf(c)}/decisions.md`], { rec });
  for (const f of adrFiles(c).filter((f) => f !== '0001-start.md')) sh(c.wt, ['head', '-12', `docs/adr/${f}`], { rec });
  sh(c.wt, ['git', 'status', '--short'], { rec });
  return { c, run };
}

function s1() {
  const rec = begin('S-1', '## S-1 K: the adr-author on the decisions stage drafts an unnumbered record (task 7.1; AC-5, AC-6)');
  const p = attach('K');
  const { c, run } = adrAuthor(p, 'prefs', rec, 'S-1');
  const k = new Checks(rec);
  const mine = adrFiles(c).filter((f) => f !== '0001-start.md');
  k.that(run.code === 0 && run.calls === 1, 'the claude -p run exited 0 with one Agent call');
  k.that(mine.length >= 1 && mine.every((f) => /^prefs(-[a-z0-9-]+)?\.md$/.test(f)), `the new records are docs/adr/<slug>.md with the change id as slug: ${mine.join(', ') || 'none'}`);
  k.that(mine.every((f) => new RegExp(`^# ADR \\[${f.replace(/\.md$/, '')}\\]`).test(read(c.wt, `docs/adr/${f}`).split('\n').find((l) => l.trim()) ?? '')), 'each is titled # ADR [<slug>]');
  k.that(mine.length > 0 && mine.every((f) => listed(c).includes(`docs/adr/${f}`)), `decisions.md lists each: ${listed(c).join(', ')}`);
  k.that(!adrFiles(c).some((f) => /^\d{4}-/.test(f) && f !== '0001-start.md'), 'no new numbered record');
  k.that(/^<!-- devkit-stage decisions result=passed /.test(read(c.wt, `${dirOf(c)}/decisions.md`)), 'decisions.md is passed');
  k.done('S-1 (task 7.1)');
}

function s4() {
  const rec = begin('S-4', '## S-4 K0: the adr-author creates docs/adr/ with the unnumbered record (task 7.4; AC-5, AC-9)');
  const p = attach('K0');
  const { c, run } = adrAuthor(p, 'prefs', rec, 'S-4');
  const k = new Checks(rec);
  const mine = adrFiles(c);
  k.that(run.code === 0 && run.calls === 1, 'the claude -p run exited 0 with one Agent call');
  k.that(existsSync(join(c.wt, 'docs', 'adr')) && !git(c.wt, 'ls-files', 'docs/adr'), 'docs/adr/ is new (the base has none)');
  k.that(mine.length >= 1 && mine.every((f) => /^prefs(-[a-z0-9-]+)?\.md$/.test(f)), `the records are unnumbered docs/adr/<slug>.md: ${mine.join(', ') || 'none'}`);
  k.that(mine.length > 0 && mine.every((f) => listed(c).includes(`docs/adr/${f}`)), `decisions.md lists each: ${listed(c).join(', ')}`);
  k.done('S-4 (task 7.4)');
}

function s5() {
  const rec = begin('S-5', '## S-5 N: the adr-author numbers the record as before this change (task 7.4; AC-9, AC-10)');
  const p = attach('N');
  const { c, run } = adrAuthor(p, 'feat', rec, 'S-5');
  const k = new Checks(rec);
  const mine = adrFiles(c).filter((f) => f !== '0001-start.md');
  k.that(run.code === 0 && run.calls === 1, 'the claude -p run exited 0 with one Agent call');
  k.that(mine.length >= 1 && mine[0].startsWith('0002-'), `the record is docs/adr/0002-<slug>.md: ${mine.join(', ') || 'none'}`);
  k.that(mine.every((f) => /^\d{4}-/.test(f)), 'no record is unnumbered');
  k.that(mine.length > 0 && mine.every((f) => listed(c).includes(`docs/adr/${f}`)), `decisions.md lists each: ${listed(c).join(', ')}`);
  k.done('S-5 (task 7.4)');
}

// ---------------------------------------------------------------- the planner cases (S-2, S-3, S-6, S-7)

const attachChange = (p, id) => ({ id, wt: join(p.main, '.claude', 'worktrees', id) });

// Runs the planner while `next` hands it (one hand-off writes every plan file; at most `runs`).
function planner(p, c, rec, label, { runs = 3 } = {}) {
  let last = null;
  for (let i = 1; i <= runs; i++) {
    const { action } = next(p, c, rec);
    if (action.kind !== 'agent' || action.agent !== 'devkit-core:change-planner') { last = action; break; }
    const run = runAgent(c, action, rec, `${label}${i > 1 ? `-${i}` : ''}`);
    if (run.code !== 0) throw new Error(`${label}: claude -p exited ${run.code}`);
  }
  if (!last) last = next(p, c, rec).action;
  sh(c.wt, ['ls', '-1R', dirOf(c)], { rec });
  for (const f of ['tasks.md']) sh(c.wt, ['cat', `${dirOf(c)}/${f}`], { rec, expect: null });
  sh(c.wt, ['git', 'status', '--short'], { rec });
  return last;
}

function s2() {
  const rec = begin('S-2', '## S-2 K: the change-planner writes the plan and a release note (task 7.2; AC-1)');
  const p = attach('K');
  const c = attachChange(p, 'prefs');
  rec.text(`The change \`prefs\` of S-1, with the decisions stage the adr-author passed there.`);
  const after = planner(p, c, rec, 'S-2');
  const k = new Checks(rec);
  const noteFile = join(c.wt, dirOf(c), 'release.md');
  k.that(existsSync(noteFile), 'release.md exists');
  if (existsSync(noteFile)) {
    sh(c.wt, ['cat', `${dirOf(c)}/release.md`], { rec });
    const parsed = parseNote(c, rec);
    k.that(!parsed.error && Array.isArray(parsed.packs), 'parseReleaseNote reads it');
    const state = releaseStateOf(p, c, rec);
    k.that(state.kind === 'unassigned', `the delivery can release it: the state computeRelease gives is ${state.kind}${state.error ? ` (${state.error})` : ''}`);
  }
  const { out } = next(p, c, rec);
  const transcript = runTranscript(c, out, 'S-2');
  rec.text(`The run transcript the guard calls name (\`$CASES/runs/S-2.transcript.jsonl\`): the typed \`/devkit-openspec:devkit change prefs\` and the tool result of the \`next\` just above.`);
  const stop = plannerStop(p, c, rec, transcript, 'S-2');
  k.that(stop.code === 0 && stop.log.decision === 'allow' && stop.log.why === 'delivered', `guard.mjs subagent-stop with the planner's input lets the stop through (${stop.log.decision} ${stop.log.why})`);
  k.that(after.agent === 'devkit-core:plan-readiness-reviewer', `the loop then hands the readiness review (${after.agent ?? after.kind})`);
  k.done('S-2 (task 7.2)');
}

function s3() {
  const rec = begin('S-3', '## S-3 K: the planner\'s failure path, the release note missing (task 7.3; AC-1)');
  const p = attach('K');
  const c = attachChange(p, 'prefs');
  rec.text('The files S-2\'s planner left, with `release.md` moved out of the change folder (kept as `$CASES/runs/S-3.release.md`):');
  const kept = join(RUNS, 'S-3.release.md');
  sh(c.wt, ['mv', `${dirOf(c)}/release.md`, kept], { rec });
  sh(c.wt, ['ls', '-1R', dirOf(c)], { rec });
  const { out } = next(p, c, rec);
  const transcript = runTranscript(c, out, 'S-3');
  const k = new Checks(rec);
  const first = plannerStop(p, c, rec, transcript, 'S-3');
  k.that(first.code === 2 && /openspec\/changes\/prefs\/release\.md does not exist: write the release note/.test(first.err) && first.log.why === 'no-release-note', 'the first stop is refused naming the file');
  const second = plannerStop(p, c, rec, transcript, 'S-3');
  k.that(second.code === 0 && second.log.why === 'same-state', `the second stop goes through (${second.log.why})`);
  rec.text('The refusal record the guard wrote (`$CASES/tmp/devkit-stop/S-3-S-3-planner.json`):');
  sh(c.wt, ['cat', join(HOOK_TMP, 'devkit-stop', 'S-3-S-3-planner.json')], { rec });
  rec.text('`release.md` restored:');
  sh(c.wt, ['mv', kept, `${dirOf(c)}/release.md`], { rec });
  const restored = plannerStop(p, c, rec, transcript, 'S-3');
  k.that(restored.code === 0 && restored.log.why === 'delivered', `the restored note's stop goes through (${restored.log.why})`);
  k.done('S-3 (task 7.3)');
}

function s6() {
  const rec = begin('S-6', '## S-6 K: a malformed note, refused once, then revised by the real planner (task 7.5; AC-1)');
  const p = attach('K');
  const c = attachChange(p, 'prefs');
  const good = read(c.wt, `${dirOf(c)}/release.md`);
  rec.text('The files S-2\'s planner left (restored by S-3), with `release.md` seeded so that its bump is `big`: the planner\'s own note, its `release:` (or, with none, an added `release:`) line set to `big`.');
  const bad = /^release: \S+$/m.test(good) ? good.replace(/^release: \S+$/m, 'release: big') : good.replace(/^(packs:[^\n]*\n(?:- [^\n]*\n)*)/m, '$1release: big\n');
  seedFiles(c, { [`${dirOf(c)}/release.md`]: bad }, rec);
  const { out } = next(p, c, rec);
  const transcript = runTranscript(c, out, 'S-6');
  const k = new Checks(rec);
  const first = plannerStop(p, c, rec, transcript, 'S-6');
  k.that(first.code === 2 && /release\.md cannot be read: release\.md: release: /.test(first.err) && /big/.test(first.err), 'the first stop is refused with release.md: and the field');
  const second = plannerStop(p, c, rec, transcript, 'S-6');
  k.that(second.code === 0 && second.log.why === 'same-state', `the second stop goes through (${second.log.why})`);
  // The revision brief: the readiness review failed on the note, as the plan-readiness-review skill says it does.
  const reason = /cannot be read: (.*)$/m.exec(first.err)?.[1] ?? 'release.md cannot be read';
  seedFiles(c, {
    [`${dirOf(c)}/readiness.md`]: `${head('readiness', git(c.wt, 'rev-parse', 'HEAD'), 'failed')}# Readiness review: prefs\n\n## 1. Decision\n- Status: NEEDS-REVISION\n- Confidence: high\n- Ready to implement: no\n\n## 9. Mandatory fixes before implementation\n- [ ] Mandatory before implementation — openspec/changes/prefs/release.md — the release note cannot be read (\`${reason}\`), so the delivery cannot assign the release — state the bump as patch, minor or major\n`,
  }, rec, 'Seeded (the readiness review that failed on the note, the revision brief\'s source)');
  const after = planner(p, c, rec, 'S-6', { runs: 1 });
  sh(c.wt, ['cat', `${dirOf(c)}/release.md`], { rec });
  const parsed = parseNote(c, rec);
  k.that(!parsed.error && Array.isArray(parsed.packs), 'the revised release.md reads');
  const state = releaseStateOf(p, c, rec);
  k.that(state.kind === 'unassigned', `the delivery can release it: the state computeRelease gives is ${state.kind}${state.error ? ` (${state.error})` : ''}`);
  const { out: out2 } = next(p, c, rec);
  const t2 = runTranscript(c, out2, 'S-6-revised');
  const revised = plannerStop(p, c, rec, t2, 'S-6-revised');
  k.that(revised.code === 0 && revised.log.decision === 'allow' && !/release-note/.test(revised.log.why), `the revised plan's stop goes through (${revised.log.decision} ${revised.log.why})`);
  rec.text(`What the loop hands after the revision: ${after.agent ?? after.kind}${after.brief ? ` ("${short(after.brief).split('. Work only')[0]}")` : ''}. `
    + 'The revision changed only `release.md`, which is not one of the readiness stage\'s `staleAfter` files (mockup, decisions, proposal, '
    + 'specs, design, tasks), so flow-check does not read the failed review as answered and hands the planner the same revision brief '
    + 'again; the readiness review does not run until a stage file changes. Reported to the owner as a design gap (D-9 says flow-check '
    + 'needs no other change).');
  k.done('S-6 (task 7.5)');
}

function s7() {
  const rec = begin('S-7', '## S-7 N: the change-planner with no devkit.release_tag writes no note (task 7.5; AC-1, AC-9)');
  const p = attach('N');
  const c = attachChange(p, 'feat');
  rec.text('The change `feat` of S-5, with the decisions stage the adr-author passed there.');
  const after = planner(p, c, rec, 'S-7');
  const k = new Checks(rec);
  k.that(!existsSync(join(c.wt, dirOf(c), 'release.md')), 'no release.md is written');
  const { out } = next(p, c, rec);
  const transcript = runTranscript(c, out, 'S-7');
  const stop = plannerStop(p, c, rec, transcript, 'S-7');
  k.that(stop.code === 0 && stop.log.why === 'delivered', `the stop goes through with no refusal (${stop.log.decision} ${stop.log.why})`);
  k.that(!existsSync(join(HOOK_TMP, 'devkit-stop', 'S-7-S-7-planner.json')), 'no refusal record was written');
  const j = deliverCheck(p, c, rec);
  k.that(!nRow(j.next), `deliver-check feat --json shows no row N1 to N7 (next: ${j.next.step})`);
  k.that(!('release' in (j.approval ?? {})) && !('recordedRelease' in (j.approval ?? {})), 'the approval object has no release keys (D-9)');
  k.that(after.agent === 'devkit-core:plan-readiness-reviewer', `the loop then hands the readiness review (${after.agent ?? after.kind})`);
  k.done('S-7 (task 7.5)');
}

// ---------------------------------------------------------------- the readiness cases (S-8 to S-10) and the implementer (S-11)

const NOTE = 'packs: []\nrelease: minor\n\n## Greetings\n\n- `greet(name)` returns a greeting for a name.\n';
const PROPOSAL = (commit) => `${head('proposal', commit)}# Proposal

## Why

The app answers no greeting today; the owner wants \`greet(name)\` for the welcome screen.

## What Changes

- New \`src/greet.ts\` exporting \`greet(name: string): string\`, returning \`Hello, <name>!\`.
- An empty or blank name returns \`Hello, friend!\`.

## Acceptance criteria

- AC-1: \`greet('Ana')\` returns \`Hello, Ana!\`.
- AC-2: \`greet('')\` and \`greet('  ')\` return \`Hello, friend!\`.

## Capabilities

### New Capabilities
- \`greeting\`: the greeting the app gives a named user.

### Modified Capabilities

## Impact

- \`src/greet.ts\` (new), \`src/greet.test.ts\` (new). No dependency is added.
`;
const SPEC = (commit) => `${head('specs', commit)}## ADDED Requirements

### Requirement: The app greets a user by name
The app SHALL return \`Hello, <name>!\` from \`greet(name)\` for a non-blank name, and \`Hello, friend!\` for an empty or blank one.

#### Scenario: a named user
- **WHEN** \`greet('Ana')\` is called
- **THEN** it returns \`Hello, Ana!\`

#### Scenario: a blank name
- **WHEN** \`greet('  ')\` is called
- **THEN** it returns \`Hello, friend!\`
`;
const DESIGN = (commit, adr = null) => `${head('design', commit)}# Design

## Context

\`src/app.ts\` exports one function per endpoint; there is no greeting.${adr ? ` The greeting rule is recorded in \`${adr}\`.` : ''}

## Decisions

- \`src/greet.ts\` exports \`greet(name: string): string\`: \`name.trim()\` empty gives \`Hello, friend!\`, else \`Hello, \${name.trim()}!\`.
- Tests in \`src/greet.test.ts\` with \`node --test\` (no new dependency).

## Risks

- None beyond a wrong trim; the tests cover blank names.
`;
const TASKS = (commit, extra = '', gate = '1.2') => `${head('tasks', commit)}# Tasks

## 1. Greeting

- [ ] 1.1 Write \`src/greet.test.ts\` (AC-1, AC-2: a name, an empty name, a blank name), see it fail, then write \`src/greet.ts\`. Done when \`node --test src/\` passes.
${extra}- [ ] ${gate} Gate: \`node -e 0\` green
`;
const REQS = (commit) => `${head('requirements', commit)}# Requirements

## Request

> Greet a user by name.

## Assumptions

- The app is a Node.js service; its code lives in \`src/\`.

## Acceptance criteria

- AC-1: \`greet('Ana')\` returns \`Hello, Ana!\`.
- AC-2: \`greet('')\` and \`greet('  ')\` return \`Hello, friend!\`.

## Out of scope

- Translations.
`;
const NO_DECISION = (commit) => `${head('decisions', commit, 'not-applicable')}# Decisions and ADRs\n\nNo record: a pure function with no boundary, contract or technology choice.\n`;

// A seeded plan of change `id` in K: every stage up to the tasks passed, as the plan stages leave it.
function seededPlan(p, id, rec, { note = NOTE, decisions = null, adr = null, extraTask = '', gate = '1.2' } = {}) {
  const c = open(p, id, 'capability', 'Greet a user by name.', rec);
  const h = git(c.wt, 'rev-parse', 'HEAD');
  const d = dirOf(c);
  const files = {
    [`${d}/requirements.md`]: REQS(h),
    [`${d}/decisions.md`]: decisions ? decisions(h) : NO_DECISION(h),
    ...(adr ? { [adr.path]: adr.text } : {}),
    [`${d}/proposal.md`]: PROPOSAL(h),
    [`${d}/specs/greeting/spec.md`]: SPEC(h),
    [`${d}/design.md`]: DESIGN(h, adr?.path ?? null),
    [`${d}/tasks.md`]: TASKS(h, extraTask, gate),
    ...(note ? { [`${d}/release.md`]: note } : {}),
  };
  seedFiles(c, files, rec, 'Seeded (the plan stages, each passed)');
  return c;
}

function reviewer(p, c, rec, label) {
  const { action } = next(p, c, rec);
  if (action.agent !== 'devkit-core:plan-readiness-reviewer') throw new Error(`${label}: next is not the readiness review: ${action.kind} ${action.agent}`);
  const run = runAgent(c, action, rec, label);
  sh(c.wt, ['cat', `${dirOf(c)}/readiness.md`], { rec, expect: null });
  sh(c.wt, ['git', 'status', '--short'], { rec });
  const text = existsSync(join(c.wt, dirOf(c), 'readiness.md')) ? read(c.wt, `${dirOf(c)}/readiness.md`) : '';
  return { run, text };
}
// The findings part of readiness.md: from section 9 (Mandatory fixes) on, and any line that names a severity.
const findingsOf = (text) => text.split('\n').filter((l) => /mandatory|finding|blocker|must|\bF-?\d/i.test(l)).join('\n');

function s8() {
  const rec = begin('S-8', '## S-8 K: the plan-readiness-reviewer on a plan with no release.md (task 7.6; AC-1, AC-14)');
  const p = attach('K');
  const c = seededPlan(p, 'plan-a', rec, { note: null });
  const { run, text } = reviewer(p, c, rec, 'S-8');
  const k = new Checks(rec);
  k.that(run.code === 0 && run.calls === 1, 'the claude -p run exited 0 with one Agent call');
  k.that(/^<!-- devkit-stage readiness result=failed /.test(text), 'readiness.md has result=failed');
  k.that(/release\.md/.test(findingsOf(text)), 'a finding names release.md');
  k.done('S-8 (task 7.6)');
}

function s9() {
  const rec = begin('S-9', '## S-9 K: the plan-readiness-reviewer on a noted plan whose decisions.md lists a numbered ADR (task 7.6; AC-5, AC-14)');
  const p = attach('K');
  const path = 'docs/adr/0002-plan-b.md';
  const c = seededPlan(p, 'plan-b', rec, {
    decisions: (h) => `${head('decisions', h)}# Decisions and ADRs\n\n- ADR: \`${path}\` — ADR 0002: a blank name is greeted as a friend\n`,
    adr: { path, text: '# ADR 0002: a blank name is greeted as a friend\n\n- Status: proposed\n- Change: `plan-b`\n\n## Context\n\nThe greeting needs a rule for a blank name.\n\n## Decision\n\nA blank name is greeted as `friend`.\n\n## Consequences\n\nNo error path for a blank name.\n\n## Alternatives\n\n- Throw on a blank name: rejected, the welcome screen has no error state.\n' },
  });
  const { run, text } = reviewer(p, c, rec, 'S-9');
  const k = new Checks(rec);
  k.that(run.code === 0 && run.calls === 1, 'the claude -p run exited 0 with one Agent call');
  k.that(/^<!-- devkit-stage readiness result=failed /.test(text), 'readiness.md has result=failed');
  k.that(/0002-plan-b\.md/.test(findingsOf(text)), 'a finding names the numbered ADR path');
  k.done('S-9 (task 7.6)');
}

const VERSION_TASK = '- [ ] 1.2 Set the `version` of `package.json` to 1.5.0, the release of this change. Done when `node -p "require(\'./package.json\').version"` prints 1.5.0.\n';

function s10() {
  const rec = begin('S-10', '## S-10 K: the plan-readiness-reviewer on a noted plan with a task that sets package.json\'s version (task 7.6; AC-2, AC-14)');
  const p = attach('K');
  const c = seededPlan(p, 'plan-c', rec, { extraTask: VERSION_TASK, gate: '1.3' });
  const { run, text } = reviewer(p, c, rec, 'S-10');
  const k = new Checks(rec);
  k.that(run.code === 0 && run.calls === 1, 'the claude -p run exited 0 with one Agent call');
  k.that(/^<!-- devkit-stage readiness result=failed /.test(text), 'readiness.md has result=failed');
  k.that(/1\.2/.test(findingsOf(text)) && /version/i.test(findingsOf(text)), 'a finding names the task (1.2, the version)');
  k.done('S-10 (task 7.6)');
}

function s11() {
  const rec = begin('S-11', '## S-11 K: the tdd-implementer asked for a release line in a noted change (task 7.7; AC-2)');
  const p = attach('K');
  const c = open(p, 'feat', 'capability', 'Greet a user by name.', rec);
  const h = git(c.wt, 'rev-parse', 'HEAD');
  const d = dirOf(c);
  const tasks = `${head('tasks', h)}# Tasks\n\n## 1. Release\n\n- [ ] 1.1 Set the \`version\` of \`package.json\` to 1.5.0, the release of this change. Done when \`node -p "require('./package.json').version"\` prints 1.5.0.\n- [ ] 1.2 Gate: \`node -e 0\` green\n\n## 2. Greeting\n\n- [ ] 2.1 Write \`src/greet.test.ts\`, see it fail, then write \`src/greet.ts\` (AC-1, AC-2). Done when \`node --test src/\` passes.\n- [ ] 2.2 Gate: \`node -e 0\` green\n`;
  const files = {
    [`${d}/requirements.md`]: REQS(h), [`${d}/decisions.md`]: NO_DECISION(h), [`${d}/proposal.md`]: PROPOSAL(h),
    [`${d}/specs/greeting/spec.md`]: SPEC(h), [`${d}/design.md`]: DESIGN(h), [`${d}/tasks.md`]: tasks, [`${d}/release.md`]: NOTE,
    [`${d}/readiness.md`]: `${head('readiness', h)}# Readiness review: feat\n\n## 1. Decision\n- Status: APPROVED\n- Confidence: high\n- Ready to implement: yes\n`,
  };
  seedFiles(c, files, rec, 'Seeded (the plan stages passed, the readiness review APPROVED)');
  const approval = [`<!-- devkit-stage approval result=passed attempt=1 commit=${h} -->`, '# Plan approval: feat', '', '- Status: APPROVED',
    `- Readiness: ${hash12(join(c.wt, d, 'readiness.md'))}`, `- Release note: ${hash12(join(c.wt, d, 'release.md'))}`, '- Date: 2026-11-24', '- Owner\'s words: "`Aprovo`"', ''].join('\n');
  seedFiles(c, { [`${d}/approval.md`]: approval }, rec, 'Seeded (the owner\'s approval, as the `ship-change` `stop-plan-approval` row writes it, with the note\'s hash)');
  rec.text('The plan committed, as the coordinating session leaves it before the implementation:');
  commitAll(c.wt, 'docs(feat): the plan of feat');
  sh(c.wt, ['git', 'log', '--oneline', '-3'], { rec });
  const { action } = next(p, c, rec);
  if (action.agent !== 'devkit-core:tdd-implementer') throw new Error(`S-11: next is not the implementer: ${action.kind} ${action.agent} ${action.reply ?? ''}`);
  const run = runAgent(c, action, rec, 'S-11');
  sh(c.wt, ['git', 'diff', '--', 'package.json'], { rec });
  sh(c.wt, ['git', 'status', '--short'], { rec });
  sh(c.wt, ['cat', 'package.json'], { rec });
  sh(c.wt, ['cat', `${d}/tasks.md`], { rec });
  const j = deliverCheck(p, c, rec);
  const k = new Checks(rec);
  const outcome = run.final.split('\n').reverse().find((l) => /Outcome:/.test(l)) ?? '';
  k.that(run.code === 0 && run.calls === 1, 'the claude -p run exited 0 with one Agent call');
  k.that(/Outcome:\s*\**\s*failure/i.test(outcome), `it returns Outcome: failure (${outcome.trim()})`);
  k.that(/version|package\.json|release/i.test(outcome) || /release line|release note|release\.md/i.test(run.final), 'it names the release line');
  k.that(git(c.wt, 'diff', '--', 'package.json') === '' && JSON.parse(read(c.wt, 'package.json')).version === '1.4.0', 'git diff shows package.json unchanged');
  k.that(!(j.next.step === 'blocked' && /^release lines edited by hand/.test(j.next.reason ?? '')), `deliver-check feat --json shows no row N3 (next: ${j.next.step} ${j.next.reason ?? ''})`);
  k.done('S-11 (task 7.7)');
}

// ---------------------------------------------------------------- a note-only revision (S-12, task 9.15; D-21)

// The flow checker's `next` and its readiness stage for the change, recorded (`flow-check.mjs <id> --json`, the report the loop reads).
function flowOf(p, c, rec) {
  const r = sh(c.wt, node('flow-check.mjs', c.id, '--json'), { env: p.env, expect: null });
  const j = JSON.parse(r.out);
  const readiness = (j.stages ?? []).find((s) => s.id === 'readiness') ?? null;
  const pick = (s) => s && Object.fromEntries(['id', 'state', 'reasonCode', 'params', 'result', 'attempt'].filter((k) => k in s).map((k) => [k, s[k]]));
  rec.block(`(in ${c.wt})\n$ node $DEV/flow-check.mjs ${c.id} --json   (its "next", "end" and readiness stage)\n${JSON.stringify({ next: j.next ?? null, end: j.end ?? null, readiness: pick(readiness) }, null, 2)}\n[exit ${r.code}]`);
  return { next: j.next ?? null, end: j.end ?? null, readiness };
}

// Each file of the change folder with its modification time and the first 12 hex of its sha256, recorded.
function planFiles(c, rec, what) {
  const root = join(c.wt, dirOf(c));
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
  const rows = walk(root).sort().map((f) => ({ path: f.slice(c.wt.length + 1), mtime: statSync(f).mtime.toISOString(), hash: hash12(f) }));
  rec.text(what);
  rec.block(rows.map((r) => `${r.mtime}  ${r.hash}  ${r.path}`).join('\n'));
  return new Map(rows.map((r) => [r.path, r]));
}

// release.md written with a modification time at least 5 s after readiness.md's (the flow's tolerance for "newer" is 2 s), recorded.
function noteAfterReadiness(c, rec, note = NOTE) {
  const file = join(c.wt, dirOf(c), 'release.md');
  put(c.wt, { [`${dirOf(c)}/release.md`]: note });
  const at = Math.max(Date.now(), statSync(join(c.wt, dirOf(c), 'readiness.md')).mtimeMs + 5000) / 1000;
  utimesSync(file, at, at);
  sh(c.wt, ['cat', `${dirOf(c)}/release.md`], { rec });
  sh(c.wt, ['stat', '-c', '%y %n', `${dirOf(c)}/readiness.md`, `${dirOf(c)}/release.md`], { rec, label: `stat -c '%y %n' ${dirOf(c)}/readiness.md ${dirOf(c)}/release.md   # the note is newer than the review` });
}

// A copy of project `p` as `name` (cp -a keeps every modification time), its origin, worktrees and gh stub pointed at the copy.
function copyProject(p, name, rec) {
  const dir = join(CASES, name);
  sh(CASES, ['cp', '-a', p.dir, dir], { rec });
  const q = attach(name);
  sh(q.main, ['git', 'remote', 'set-url', 'origin', q.origin], { env: q.env, rec });
  const wts = readdirSync(join(q.main, '.claude', 'worktrees')).map((w) => join(q.main, '.claude', 'worktrees', w));
  sh(q.main, ['git', 'worktree', 'repair', ...wts], { env: q.env, rec });
  const stateFile = join(dir, 'gh', 'state.json');
  writeFileSync(stateFile, JSON.stringify({ ...JSON.parse(readFileSync(stateFile, 'utf8')), origin: q.origin }, null, 2) + '\n');
  sh(q.main, ['git', 'worktree', 'list'], { env: q.env, rec });
  return q;
}

const PASSED_READINESS = (h, id) => `${head('readiness', h)}# Readiness review: ${id}\n\n## 1. Decision\n- Status: APPROVED\n- Confidence: high\n- Ready to implement: yes\n`;

function s12() {
  const rec = begin('S-12', '## S-12 K: a revision that writes only release.md sends the plan back to the readiness review; N keeps it passed (task 9.15; AC-16, AC-1)');
  rec.text('Run after review round 1 (D-21; adr-reviewer F2, spec-reviewer F3, code-quality F3, test-coverage F5, architecture F1), on projects K and N built anew by `seed`. The failure path first, then the success path.');
  const p = attach('K');
  const k = new Checks(rec);
  rec.text('### K: the real readiness review fails a plan with no release.md\n\nS-8\'s seed: the plan stages of `plan-d`, each passed, with no `release.md`.');
  const c = seededPlan(p, 'plan-d', rec, { note: null });
  const first = reviewer(p, c, rec, 'S-12-review-1');
  k.that(first.run.code === 0 && first.run.calls === 1, 'the first review: the claude -p run exited 0 with one Agent call');
  k.that(/^<!-- devkit-stage readiness result=failed /.test(first.text), 'the first review: readiness.md has result=failed');
  k.that(/release\.md/.test(findingsOf(first.text)), 'the first review: a finding names release.md');
  rec.text('The loop hands the planner the revision:');
  const { action: revision } = next(p, c, rec);
  k.that(revision.kind === 'agent' && revision.agent === 'devkit-core:change-planner' && /readiness failed at attempt 1/.test(revision.brief ?? ''), `the loop hands the planner the revision (${revision.agent ?? revision.kind}: ${short(revision.brief ?? '').split('. Work only')[0]})`);

  rec.text('### A copy of that state: only release.md written\n\nProject `K` copied to `K-copy` (`cp -a`, every modification time kept), where the case writes only `release.md`, newer than `readiness.md`; no other file changes.');
  const q = copyProject(p, 'K-copy', rec);
  const cq = attachChange(q, c.id);
  noteAfterReadiness(cq, rec);
  sh(cq.wt, ['git', 'status', '--short'], { rec, label: 'git status --short   # the plan of the seed (uncommitted, as the plan stages leave it) and the review; release.md the only file the copy adds' });
  const flowCopy = flowOf(q, cq, rec);
  const { action: copyNext } = next(q, cq, rec);
  k.that(flowCopy.readiness?.reasonCode === 'header-failed' && flowCopy.next?.stage === 'readiness' && flowCopy.next?.reasonCode === 'rerun-after-fix', `on the copy flow-check hands the readiness review again (next: ${flowCopy.next?.stage} ${flowCopy.next?.reasonCode})`);
  k.that(copyNext.kind === 'agent' && copyNext.agent === 'devkit-core:plan-readiness-reviewer', `on the copy change-loop next hands the readiness review, not the same revision (${copyNext.agent ?? copyNext.kind})`);

  rec.text('### K: the real planner revises the plan, the real reviewer passes it');
  const before = planFiles(c, rec, 'The change folder before the planner (modification time, sha256 prefix, path):');
  const plan = runAgent(c, revision, rec, 'S-12-planner');
  const after = planFiles(c, rec, 'The change folder after the planner:');
  const changed = [...after.keys()].filter((f) => before.get(f)?.hash !== after.get(f).hash);
  const removed = [...before.keys()].filter((f) => !after.has(f));
  rec.text(`The plan files the planner changed or added: ${changed.map((f) => `\`${f}\``).join(', ') || 'none'}${removed.length ? `; removed: ${removed.map((f) => `\`${f}\``).join(', ')}` : ''}.`);
  k.that(plan.code === 0 && plan.calls === 1, 'the planner: the claude -p run exited 0 with one Agent call');
  k.that(after.has(`${dirOf(c)}/release.md`), 'the planner wrote release.md');
  if (after.has(`${dirOf(c)}/release.md`)) {
    sh(c.wt, ['cat', `${dirOf(c)}/release.md`], { rec });
    const parsed = parseNote(c, rec);
    k.that(!parsed.error && Array.isArray(parsed.packs), 'parseReleaseNote reads it');
  }
  const flowK = flowOf(p, c, rec);
  k.that(flowK.next?.stage === 'readiness' && flowK.next?.reasonCode === 'rerun-after-fix', `after the planner flow-check hands the readiness review (next: ${flowK.next?.stage} ${flowK.next?.reasonCode})`);
  const second = reviewer(p, c, rec, 'S-12-review-2');
  k.that(second.run.code === 0 && second.run.calls === 1, 'the second review: the claude -p run exited 0 with one Agent call');
  k.that(/^<!-- devkit-stage readiness result=passed /.test(second.text), 'the second review: readiness.md has result=passed');
  const { action: done } = next(p, c, rec);
  k.that(done.kind !== 'agent' || !['devkit-core:change-planner', 'devkit-core:plan-readiness-reviewer'].includes(done.agent), `the loop then leaves the plan stages (${done.kind} ${done.agent ?? done.reply ?? done.reason ?? ''})`.replace(/\s+\)/, ')'));

  rec.text('### N: release.md touched after readiness.md keeps the readiness passed\n\nThe same seed in N (no `devkit.release_tag`), with its readiness review seeded passed, then `release.md` written after it.');
  const n = attach('N');
  const cn = seededPlan(n, 'plan-d', rec, { note: null });
  seedFiles(cn, { [`${dirOf(cn)}/readiness.md`]: PASSED_READINESS(git(cn.wt, 'rev-parse', 'HEAD'), cn.id) }, rec, 'Seeded (the readiness review, passed)');
  noteAfterReadiness(cn, rec);
  const flowN = flowOf(n, cn, rec);
  const { action: nNext } = next(n, cn, rec);
  k.that(flowN.readiness?.state === 'passed', `in N the readiness stage stays passed (${flowN.readiness?.state} ${flowN.readiness?.reasonCode})`);
  k.that(!(nNext.kind === 'agent' && ['devkit-core:change-planner', 'devkit-core:plan-readiness-reviewer'].includes(nNext.agent)), `in N change-loop next hands no plan stage (${nNext.kind} ${nNext.agent ?? nNext.reply ?? ''})`.replace(/\s+\)/, ')'));
  k.done('S-12 (task 9.15)');
}

// ---------------------------------------------------------------- the implementer on a noted change's conflict (S-13, task 11.11; D-31, D-36)

// The dispatch sentence of the `ship-change` row of `step` (this worktree's skill), which the conducting session appends to the brief of
// a delivery step (the `devkit` skill's Loop): the row's text after "Dispatch `<agent>`: ".
function dispatchOf(step) {
  const row = read(WT, 'plugins/openspec/skills/ship-change/SKILL.md').split('\n').find((l) => l.startsWith(`| \`${step}\` |`));
  const m = row && /Dispatch `[^`]+`: (.*?) \|\s*$/.exec(row);
  if (!m) throw new Error(`no dispatch sentence for ${step} in ship-change`);
  return m[1];
}
const PROMPT_WITH = (a, sentence) => PROMPT({ ...a, brief: `${a.brief}\n\n${sentence}` });
const K_NOTE = (id, kind) => `packs: []\nrelease: ${kind}\n\n## ${id} lands\n\n- ${id} does its part\n`;
const kList = (entries) => `  ADRs: docs/adr/ (0001 start${entries})\n`;
// The session's part of `assign-release` (the ship-change row): fetch the base, run the command, push plainly on exit 0.
function assignRow(p, c, d, rec, expect = [0]) {
  sh(c.wt, ['git', 'fetch', 'origin', d.base], { env: p.env, rec });
  const r = sh(c.wt, d.command, { env: p.env, rec, expect });
  if (r.code === 0) sh(c.wt, ['git', 'push', 'origin', d.branch], { env: p.env, rec });
  return { code: r.code, out: JSON.parse(r.out) };
}
// The tokens of ADR numbers in a text: `ADR <NNNN>` and `<NNNN>-<slug>.md`.
const numbersIn = (text) => new Set([...(text ?? '').matchAll(/\bADR (\d{4})\b|\b(\d{4})-[a-z0-9-]+\.md\b/g)].map((m) => m[1] ?? m[2]));
const fileAt = (c, rev, f) => { const r = sh(c.wt, ['git', 'show', `${rev}:${f}`], { expect: null }); return r.code === 0 ? r.out : null; };

// One variant: `feat` noted (release `minor`) and assigned once, `sib` noted (release `patch`) landing on the base after it; `next` hands
// resolve-base-conflict, the real implementer runs on its brief and the row's sentence; then the session's rows to the step.
function s13Variant(p, rec, v, { feat, sib, list }) {
  const k = new Checks(rec);
  rec.text(`### (${v}) ${list ? 'A conflict on the one-line list holding the change\'s own citation, and in the release files' : 'A conflict in `src/a.ts` and in the release files'}`);
  const c = openLoopChange(p, feat.id, { note: K_NOTE(feat.id, 'minor'), adrs: [feat.id], files: feat.files });
  rec.text(`\`${feat.id}\` (\`devkit-lite\`, its plan carrying the stage headers) notes \`release: minor\` and names \`docs/adr/${feat.id}.md\`; it is driven to its release step and takes its release:`);
  const r1 = drive(p, c, rec);
  if (r1.next.step !== 'assign-release') throw new Error(`S-13 (${v}): ${feat.id} before its release: ${r1.next.step}`);
  const first = assignRow(p, c, r1.next, rec);
  rec.text(`The sibling \`${sib.id}\` notes \`release: patch\`, names \`docs/adr/${sib.id}.md\` and lands on the same base:`);
  const s = openChange(p, sib.id, { note: K_NOTE(sib.id, 'patch'), adrs: [sib.id], files: sib.files });
  const s1 = drive(p, s, rec);
  if (s1.next.step !== 'assign-release') throw new Error(`S-13 (${v}): ${sib.id} before its release: ${s1.next.step}`);
  assignRow(p, s, s1.next, rec);
  const s2 = JSON.parse(sh(s.wt, node('deliver-check.mjs', s.id, '--json'), { env: p.env, expect: null }).out).next;
  sh(s.wt, ['gh', 'pr', 'merge', String(s2.number), '--auto', `--${s2.method}`, '--match-head-commit', s2.head], { env: p.env, rec });
  sh(p.main, ['gh', '__merge', String(s2.number)], { env: p.env, rec, label: `gh __merge ${s2.number}   # the stub: GitHub merges the pull request once its rules pass` });
  sh(p.main, ['git', 'fetch', '-q', 'origin'], { env: p.env });
  sh(p.main, ['git', 'log', '--oneline', '--graph', '-4', 'origin/main'], { rec });
  rec.text(`\`${feat.id}\`'s loop:`);
  const { action } = next(p, c, rec);
  if (action.kind !== 'agent' || action.step !== 'resolve-base-conflict' || action.agent !== 'devkit-core:tdd-implementer') throw new Error(`S-13 (${v}): next is not resolve-base-conflict for the implementer: ${action.kind} ${action.step} ${action.agent}`);
  const old = git(c.wt, 'rev-parse', 'HEAD');
  const base = git(c.wt, 'rev-parse', 'origin/main');
  const pushed0 = git(p.origin, 'rev-parse', `refs/heads/${c.id}`);
  const sentence = dispatchOf('resolve-base-conflict');
  rec.text('Conductor: the conducting session\'s part. As the `devkit` skill\'s Loop says for a delivery step, it appends to the brief the dispatch sentence of the `resolve-base-conflict` row of this worktree\'s `ship-change` skill, read from the file:');
  rec.block(sentence);
  const run = runAgent(c, { ...action, brief: `${action.brief}\n\n${sentence}` }, rec, `S-13-${v}`);
  rec.text('What the agent left:');
  sh(c.wt, ['git', 'log', '--oneline', '--graph', '-5'], { rec });
  sh(c.wt, ['git', 'show', '--stat', '--format=%h %s%nparents: %P', 'HEAD'], { rec });
  sh(c.wt, ['git', 'status', '--short'], { rec });
  const paths = action.detail.paths ?? [];
  for (const f of paths) sh(c.wt, ['git', 'diff', 'origin/main', 'HEAD', '--', f], { rec, label: `git diff origin/main HEAD -- ${f}   # against the base` });
  sh(c.wt, ['cat', ...paths.filter((f) => existsSync(join(c.wt, f)))], { rec });
  sh(c.wt, ['ls', 'docs/adr'], { rec });

  const merges = git(c.wt, 'rev-list', '--merges', `${old}..HEAD`).split('\n').filter(Boolean);
  const merge = merges.find((m) => git(c.wt, 'rev-list', '--parents', '-n', '1', m).split(' ').slice(1).join(' ') === `${old} ${base}`) ?? null;
  const outcome = run.final.split('\n').reverse().find((l) => /Outcome:/.test(l)) ?? '';
  const releaseFiles = paths.filter((f) => ['package.json', 'CHANGELOG.md'].includes(f));
  const changed = git(c.wt, 'diff', '--name-only', old, 'HEAD').split('\n').filter(Boolean);
  const own = changed.filter((f) => existsSync(join(c.wt, f)) && [...numbersIn(read(c.wt, f))].some((n) => !numbersIn(fileAt(c, old, f)).has(n) && !numbersIn(fileAt(c, base, f)).has(n)));
  const adrs = (rev) => new Set(git(c.wt, 'ls-tree', '--name-only', rev, 'docs/adr/').split('\n').filter(Boolean));
  const newAdr = [...adrs('HEAD')].filter((f) => !adrs(old).has(f) && !adrs(base).has(f));
  k.that(run.code === 0 && run.calls === 1, `(${v}) the claude -p run exited 0 with one Agent call`);
  k.that(/Outcome:\s*\**\s*success/i.test(outcome), `(${v}) it returns Outcome: success (${outcome.trim()})`);
  k.that(merge !== null, `(${v}) a merge commit whose parents are the old head ${old.slice(0, 7)} and origin/main ${base.slice(0, 7)} (${merge?.slice(0, 7) ?? 'none'})`);
  k.that(sh(c.wt, ['git', 'grep', '-n', '-E', '^(<<<<<<<|>>>>>>>)( |$)', 'HEAD'], { expect: [0, 1] }).out === '', `(${v}) no conflict marker at HEAD`);
  k.that(releaseFiles.length > 0 && releaseFiles.every((f) => fileAt(c, 'HEAD', f) === fileAt(c, base, f)), `(${v}) the base's side of every release line in conflict: ${releaseFiles.join(', ')} as origin/main has them`);
  k.that(JSON.parse(read(c.wt, 'package.json')).version === JSON.parse(fileAt(c, base, 'package.json')).version, `(${v}) no version the agent wrote (package.json ${JSON.parse(read(c.wt, 'package.json')).version})`);
  k.that(own.length === 0 && newAdr.length === 0, `(${v}) no ADR number the agent wrote (files with a number in neither parent: ${own.join(', ') || 'none'}; new records: ${newAdr.join(', ') || 'none'})`);
  if (list) {
    const line = read(c.wt, 'docs/context.yaml');
    const mine = /ADR \d{4} the rule/.exec(fileAt(c, old, 'docs/context.yaml'))?.[0];
    const theirs = /ADR \d{4} other/.exec(fileAt(c, base, 'docs/context.yaml'))?.[0];
    k.that(Boolean(mine && theirs && line.includes(mine) && line.includes(theirs)) && line.split('\n').filter(Boolean).length === 1, `(${v}) the list's line holds the base's entry (${theirs}) and the change's entry as the branch held it (${mine}): ${line.trim()}`);
  }
  k.that(git(p.origin, 'rev-parse', `refs/heads/${c.id}`) === pushed0, `(${v}) nothing pushed by the agent (origin's ${c.id} is still ${pushed0.slice(0, 7)})`);
  rec.text('The session\'s rows after the agent: the records the merge staled written again (the scripted session part), then the loop:');
  drive(p, c, rec, { until: ['assign-release', 'enable-auto-merge', 'push', 'blocked'] });
  let { action: push } = next(p, c, rec);
  if (push.kind === 'session' && push.step === 'merge-check') {
    rec.text('The loop checks the merge of the base first (`merge-check`, post-merge-validate), run as handed:');
    sh(c.wt, push.detail.command, { env: p.env, rec });
    ({ action: push } = next(p, c, rec));
  }
  // The push is commit-and-pr's (conduct-check's actorOf); the session's scripted part runs its command, a plain push.
  const pushOk = push.step === 'push' && JSON.stringify(push.detail?.command) === JSON.stringify(['git', 'push', 'origin', c.id]);
  k.that(pushOk, `(${v}) then next hands push (${push.kind} ${push.agent ?? ''} ${push.step ?? push.end?.why ?? ''})`);
  if (pushOk) sh(c.wt, push.detail.command, { env: p.env, rec });
  const { action: assign } = next(p, c, rec);
  let stepOk = false;
  if (assign.kind === 'session' && assign.step === 'assign-release') {
    const r = assignRow(p, c, assign.detail, rec, null);
    sh(c.wt, ['git', 'log', '-1', '--format=%B'], { rec });
    sh(c.wt, ['ls', 'docs/adr'], { rec });
    const number = String(Number(/(\d{4})-/.exec(first.out.adrs[0].to)[1]) + 1).padStart(4, '0');
    stepOk = r.code === 0;
    if (list) {
      sh(c.wt, ['cat', 'docs/context.yaml'], { rec });
      const line = read(c.wt, 'docs/context.yaml');
      stepOk = stepOk && existsSync(join(c.wt, `docs/adr/${number}-${c.id}.md`)) && line.includes(`ADR ${number} the rule`) && /ADR \d{4} other/.test(line);
    }
  }
  k.that(stepOk, `(${v}) then assign-release, whose step exits 0${list ? ', the record numbered above the base\'s and the line holding both entries' : ''} (${assign.kind} ${assign.step ?? assign.end?.why ?? ''})`);
  k.done(`S-13 (${v}) (task 11.11)`);
}

function s13() {
  const rec = begin('S-13', '## S-13 K: the real tdd-implementer on resolve-base-conflict for a noted change, a code conflict and a one-line list (task 11.11; AC-4, AC-15)');
  rec.text('Run after review round 3 (D-31, D-36), on project K built anew by `seed`. The base first gains `src/a.ts` and the one-line list of records `docs/context.yaml` (the shape of `openspec/config.yaml`\'s `ADRs:` line). In each variant this worktree\'s `change-loop.mjs next` hands `resolve-base-conflict` with `noted: true`; the real `devkit-core:tdd-implementer` runs on the brief `next` gives and the row\'s dispatch sentence; then the session runs the rows the loop hands after it.');
  rec.text('The first run of this case found one defect in an agent text, fixed test-first before both variants below were run again from a new K: '
    + 'in (a) the real implementer merged and committed as the row says (every other part of the done-condition held) but returned prose with no '
    + '`Outcome:` line, since its Returns section spoke only of a phase and `resolve-base-conflict` has none. The section now says a hand-off of the '
    + 'delivery with no phase returns the same block, its `Outcome:` line last (test "release-note AC-14 texts: a delivery hand-off with no phase '
    + 'returns the implementer\'s block with its Outcome line last" in `release-note.test.mjs`; the CompozyOS copy regenerated). The same first run '
    + 'passed (b) whole. The merges of the base here are the loop\'s `merge-check` first, then the plain `push`, which the loop hands to '
    + '`devkit-core:commit-and-pr` and the session runs as its command.');
  const p = attach('K');
  put(p.main, { 'src/a.ts': 'export const a = 0;\n', 'docs/context.yaml': kList('') });
  commitAll(p.main, 'chore: src/a.ts and the list of records');
  sh(p.main, ['git', 'push', '-q', 'origin', 'main'], { env: p.env, rec });
  sh(p.main, ['git', 'show', '--stat', '--format=%h %s', 'HEAD'], { rec });
  s13Variant(p, rec, 'a', {
    feat: { id: 'code-a', files: { 'src/a.ts': 'export const a = 1; // code-a\n', 'docs/code-a.md': '# code-a\n\nThe rule is ADR [code-a].\n' } },
    sib: { id: 'sib-a', files: { 'src/a.ts': 'export const a = 2; // sib-a\n' } },
  });
  s13Variant(p, rec, 'b', {
    feat: { id: 'list-b', files: { 'docs/context.yaml': kList('; ADR [list-b] the rule') } },
    sib: { id: 'sib-b', files: { 'docs/context.yaml': kList('; ADR [sib-b] other') } },
    list: true,
  });
}

// ---------------------------------------------------------------- assemble

const HEADER = `# Real-run proof: the conducting session's part, the real agents on every variant (tasks 7.1 to 7.7)

Every case below ran for real, on 2026-11-24: this worktree's own agents (\`$WT/plugins/core\`) and hooks (\`$WT/plugins/openspec\`,
\`$DEV\` being its \`hooks/\` folder), never the installed plugin, in the scratch projects K, K0 and N of design D-16 under a private
\`TMPDIR\` (\`$TMPDIR\` is \`/var/tmp/devkit-release-at-merge\`, \`$CASES\` is \`$TMPDIR/devkit-proof-release-at-merge\`, removed after
the run). Each change was opened with this worktree's \`change-loop.mjs open\`; each agent was run by a \`claude -p\` conducting session
(\`--plugin-dir $WT/plugins/core --plugin-dir $WT/plugins/openspec\`, its init event naming both folders) that made exactly one Agent
call, with the agent, the model and the brief of the \`next\` recorded just before it. Each block is one command as it ran, the folder
it ran in, its whole output and its exit code; the files a case seeded are shown with \`cat\` right after they were written. The
\`claude -p\` runs used \`--permission-mode bypassPermissions\`, in the scratch folder only, as the stage-models proof did. The script
is kept beside this file (\`proof/agents.mjs\`, on top of \`proof/seed.mjs\`), so the proof can be run again:

    TMPDIR=/var/tmp/devkit-release-at-merge node openspec/changes/release-at-merge/proof/agents.mjs seed
    TMPDIR=/var/tmp/devkit-release-at-merge node openspec/changes/release-at-merge/proof/agents.mjs S-1 S-2 S-3 S-6
    TMPDIR=/var/tmp/devkit-release-at-merge node openspec/changes/release-at-merge/proof/agents.mjs S-4
    TMPDIR=/var/tmp/devkit-release-at-merge node openspec/changes/release-at-merge/proof/agents.mjs S-5 S-7
    TMPDIR=/var/tmp/devkit-release-at-merge node openspec/changes/release-at-merge/proof/agents.mjs S-8 S-9 S-10 S-11
    TMPDIR=/var/tmp/devkit-release-at-merge node openspec/changes/release-at-merge/proof/agents.mjs assemble

The first run of the cases found one defect in an agent text, fixed test-first (a failing test, then the fix) before every
case below was run again from new projects: in K, whose release file is \`package.json\`, the real \`change-planner\` wrote
\`packs:\` / \`- app: minor\`. \`parseReleaseNote\` reads that note, so the stop hook let it through, but \`computeRelease\` refuses
it at the delivery (\`release.md: packs: app is not a pack of this project\`, row N1): the planner's text never said what a pack is.
Its release-note bullet now says a pack is a \`plugins/<dir>/.claude-plugin/plugin.json\` of the project, that a project with no
such pack writes \`packs: []\`, and that the bump of the file \`devkit.release_tag\` names goes under \`release:\` (test "release-note
AC-1 texts: the planner says a pack is a plugin manifest of the project ..." in \`release-note.test.mjs\`; the CompozyOS copy
regenerated). S-2 and S-6 now also record the state \`computeRelease\` gives the planner's note, measured on a snapshot commit of the plan (K was
built once more for the planner's cases after that measurement first read the uncommitted plan from \`HEAD\`). The same first run showed, in S-6,
that a revision which changes only \`release.md\` does not send the plan back to the readiness review (see S-6); that one needs a
design decision and is reported, not changed here.

The planner's stop (S-2, S-3, S-6, S-7) is judged by \`guard.mjs subagent-stop\`, the hook Claude Code calls when a subagent stops,
run with the planner's input: \`agent_type\` \`devkit-core:change-planner\`, the change's worktree as \`cwd\`, and a run transcript holding
the typed \`/devkit-openspec:devkit change <id>\` and the tool result of the loop's \`next\` (its real output), which is how the hook knows
the session is in that change's run (\`runOf\`). The \`claude -p\` runs themselves hand one stage from a plain prompt, so their own
transcripts hold no typed command and the live hook let every stop through as \`no-run\` (each run's hook log says so).
`;

function assemble() {
  const order = ['0-seed', ...Array.from({ length: 13 }, (_, i) => `S-${i + 1}`)];
  const parts = order.map((n) => join(RECORDS, `${n}.md`)).filter((f) => existsSync(f)).map((f) => readFileSync(f, 'utf8').replace(/\n+$/, '\n'));
  writeFileSync(OUT, `${HEADER}\n${parts.join('\n')}`);
}

// ---------------------------------------------------------------- main

const CASE_FNS = { 'S-1': s1, 'S-2': s2, 'S-3': s3, 'S-4': s4, 'S-5': s5, 'S-6': s6, 'S-7': s7, 'S-8': s8, 'S-9': s9, 'S-10': s10, 'S-11': s11, 'S-12': s12, 'S-13': s13 };
for (const arg of process.argv.slice(2)) {
  if (arg === 'seed') seed();
  else if (arg === 'assemble') assemble();
  else if (arg.startsWith('append=')) {
    // One case's fragment added to the end of agents-run.md (a case run after the others were assembled and their scratch folder removed).
    const f = join(RECORDS, `${arg.slice('append='.length)}.md`);
    if (!existsSync(f)) throw new Error(`no fragment ${f}: run the case first`);
    appendFileSync(OUT, `\n${readFileSync(f, 'utf8').replace(/\n+$/, '\n')}`);
  }
  else if (arg.startsWith('refix=')) refix(arg.slice('refix='.length));
  else if (arg.startsWith('state=')) {
    // The release state of a change's plan as releaseStateOf measures it, printed (a check of the measurement; nothing recorded).
    const [name, id] = arg.slice('state='.length).split('/');
    const p = attach(name);
    console.log(JSON.stringify(releaseStateOf(p, attachChange(p, id), new Record('/dev/null'))));
  } else if (arg.startsWith('reseed=')) {
    // A project built again from nothing for a rerun of its cases (the seed fragment already shows how it is built).
    const name = arg.slice('reseed='.length);
    rmSync(join(CASES, name), { recursive: true, force: true });
    seedProject(name, { config: name === 'N' ? CONFIG_N : CONFIG_K, files: consumerFiles({ adr: name !== 'K0' }) });
  }
  else if (CASE_FNS[arg]) {
    const f = join(RECORDS, `${arg}.md`);
    if (existsSync(f)) rmSync(f);
    try { CASE_FNS[arg](); console.log(`${arg}: done`); } catch (e) {
      current?.text(`The case stopped: ${short(e.message)}`);
      current?.flush();
      console.error(`${arg}: ${e.message}`);
      process.exitCode = 1;
      break;
    }
  } else throw new Error(`unknown argument ${arg}`);
}
