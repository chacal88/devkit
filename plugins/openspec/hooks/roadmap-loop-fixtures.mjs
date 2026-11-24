// What the three parts of roadmap-loop.test.mjs share (suite-speed D-11): paths, builders and helpers more than one part uses. No test lives here and nothing is made when the module is
// imported: a folder, a spawn or a git call happens only when one of its functions runs. A test file never imports another test file; what two test files share is moved to a module like this one.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpFolder } from './test-tmp.mjs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  put, commitAll, git, FLOWS, SET_LOOP as SET, cleanEnvLoop as cleanEnv, base, agentAct, endAct, world, OFFLINE, FLAGS, roadmapText, projectWith, cmd,
  jsonOf, runFileOf, putRun,
} from './test-fixtures.mjs';
import * as guardModule from './guard.mjs';
import { render } from './change-loop.mjs';
import { approvalState } from './deliver-check.mjs';
import * as loopModule from './roadmap-loop.mjs';

export const HERE = dirname(fileURLToPath(import.meta.url));

export const sessionAct = (id, step = 'review', over = {}) => ({
  ...base(id), kind: 'session', stage: 'review', stageTitle: 'Code review', role: 'change-coordinator', skills: [], step, progressKey: `review/${step}@abc123`, ...over,
});
export const githubAct = (id, what = 'merge') => endAct(id, 'waiting-on-github', 'waiting-github', { what }, { stage: 'delivery', stageTitle: 'Delivery' });
export const blockedAct = (id, why, params = {}) => endAct(id, 'blocked', why, { why, ...params });
export const archivedAct = (id) => endAct(id, 'archived', 'archived');
export const FLYING = { kind: 'agent', stage: 'proposal', agentType: 'change-planner', at: '2026-11-21T10:00:00.000Z' };

export const say = (key, params, lang = 'en') => `▸ ${render(lang, key, params)}`;
export const changesOf = (r) => r.actions.map((a) => [a.change, a.kind]);

export const rowAt = (width) => (id, text) => `  ${id.padEnd(width)}${text}`;

export const LOOP_FILE = join(HERE, 'roadmap-loop.mjs');
export const inFlight = (stage = 'proposal') => ({ kind: 'agent', stage, agentType: 'change-planner', at: '2026-11-21T10:00:00.000Z' });
export const picture = (cwd) => [git(cwd, 'status', '--porcelain'), git(cwd, 'branch', '--list', '--all'), git(cwd, 'worktree', 'list'), git(cwd, 'rev-list', '--count', '--all')].join('\n--\n');

export const GUARD = join(HERE, 'guard.mjs');
export const LK_SESSION = 'session-roadmap-0001';
export const lkSandbox = () => tmpFolder('devkit-roadmap-loop-lock-');

// Transcript lines and hook inputs in the stored forms the probe of this change recorded (Claude Code 2.1.326, ids replaced).
export const LK_BASE = { parentUuid: null, isSidechain: false, userType: 'external', entrypoint: 'claude-desktop', cwd: '/scratch/project', sessionId: LK_SESSION, version: '2.1.326', gitBranch: 'main' };
export const lkStored = (extra) => JSON.stringify({ ...LK_BASE, uuid: 'uuid-0001', timestamp: '2026-11-21T10:00:00.000Z', ...extra });
export const lkCommandText = (name, args) => `<command-message>${name.replace(/^.*:|^\//g, '')}</command-message>\n<command-name>${name}</command-name>\n<command-args>${args}</command-args>`;
export const lkTyped = (args, name = '/devkit') => lkStored({ type: 'user', message: { role: 'user', content: lkCommandText(name, args) } });
export const lkPlain = (text) => lkStored({ type: 'user', message: { role: 'user', content: text } });
export const lkSkillBody = (args = 'roadmap') => lkStored({ type: 'user', isMeta: true, message: { role: 'user', content: [{ type: 'text', text: `Base directory for this skill: /plugin/skills/devkit\n\nA line devkit-roadmap: 2 is printed by the loop.\n\nARGUMENTS: ${args}` }] } });
export const lkAssistant = () => lkStored({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'working' }] } });
// The tool result of a command that printed `text`, in one of the three stored forms: `both`, `stdout` (only in toolUseResult) and `blocks`.
export const lkResult = (text, form = 'both') => lkStored({
  type: 'user',
  message: { role: 'user', content: [{ tool_use_id: 'toolu-0001', type: 'tool_result', content: form === 'blocks' ? [{ type: 'text', text: 'first block' }, { type: 'text', text }] : form === 'stdout' ? 'ok' : text, is_error: false }] },
  ...(form === 'blocks' ? {} : { toolUseResult: { stdout: text, stderr: '', interrupted: false, isImage: false, noOutputExpected: false } }),
});
export const lkMarker = (places = 2, form = 'both') => lkResult(`devkit-roadmap: ${places}\n{"version":1}`, form);
export const lkChangeMarker = (id) => lkResult(`devkit-run: ${id}\n{"version":1}`);
export const lkTranscript = (lines) => {
  const file = join(lkSandbox(), `${LK_SESSION}.jsonl`);
  writeFileSync(file, `${lines.join('\n')}\n`);
  return file;
};
export const lkRun = (places = 2) => lkTranscript([lkTyped('roadmap'), lkSkillBody(), lkAssistant(), lkMarker(places)]);

export const RUNNING = [{ id: 'agent-0001', type: 'subagent', status: 'running', description: 'Change a stage proposal', agent_type: 'devkit-core:change-planner' }];
export const lkBase = (root, transcript, extra = {}) => ({ session_id: LK_SESSION, transcript_path: transcript, cwd: root, permission_mode: 'bypassPermissions', ...extra });
export const lkStopInput = (root, transcript, extra = {}) => lkBase(root, transcript, { hook_event_name: 'Stop', stop_hook_active: false, last_assistant_message: 'Launched.', background_tasks: RUNNING, session_crons: [], ...extra });
export const lkAgentInput = (root, transcript, subagentType, prompt, extra = {}) => lkBase(root, transcript, {
  hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_use_id: 'toolu-0002',
  tool_input: { description: 'a stage', ...(prompt === undefined ? {} : { prompt }), ...(subagentType === undefined ? {} : { subagent_type: subagentType }), run_in_background: true }, ...extra,
});
export const BRIEF = (id, stage = 'proposal', script = 'devkit') => `Change ${id} (${script} script), stage ${stage}: write it. Work only in /somewhere on branch ${id}.`;
export const PLANNER_TYPE = 'devkit-core:change-planner';

// Invariant (T-9, roadmap lock, roadmap-loop.test.mjs): a fixture change opened at the grill stands right before its proposal,
// so the planner is its next role.
export const LK_PLAN = { requirements: 'requirements.md', decisions: 'decisions.md', proposal: 'proposal.md', specs: 'specs/s/spec.md', design: 'design.md', tasks: 'tasks.md', readiness: 'readiness.md' };
export const UP_TO_TASKS = ['requirements', 'proposal', 'specs', 'design', 'tasks'];
export const UP_TO_READINESS = [...UP_TO_TASKS, 'readiness'];
// A project whose roadmap holds `lines`, with the open changes of `changes` ({ id: { have, script } }) committed in its main checkout.
export function lkProject(lines, changes = {}, { config = 'schema: devkit\n' } = {}) {
  const root = projectWith(lines === null ? null : roadmapText(...lines), { config });
  const c0 = git(root, 'rev-parse', 'HEAD');
  const files = {};
  for (const [id, { have = ['requirements', 'decisions'], script = 'devkit' } = {}] of Object.entries(changes)) {
    files[`openspec/changes/${id}/.openspec.yaml`] = `schema: ${script}\n`;
    for (const stage of have) {
      const body = stage === 'readiness' ? '# Readiness\n\n- Status: APPROVED\n' : stage === 'tasks' ? '# Tasks\n\n- [ ] 1.1 a\n' : `# ${stage}\n`;
      files[`openspec/changes/${id}/${LK_PLAN[stage]}`] = `<!-- devkit-stage ${stage} result=passed attempt=1 commit=${c0} -->\n${body}`;
    }
  }
  put(root, files);
  commitAll(root, 'open changes');
  return root;
}
export const LK_ENV = { ...cleanEnv, CLAUDE_PLUGIN_OPTION_LANGUAGE: 'en' };
export const lkOpts = (over = {}) => ({ env: LK_ENV, gh: OFFLINE, load: () => 10, ...over });
// Runs `work(tmp)` with a fresh temporary folder, where the refusal records are written (os.tmpdir reads TMPDIR at each call).
export function withTmp(work) {
  const saved = process.env.TMPDIR;
  const tmp = lkSandbox();
  process.env.TMPDIR = tmp;
  try { return work(tmp); } finally { if (saved === undefined) delete process.env.TMPDIR; else process.env.TMPDIR = saved; }
}
export const recordOf = (tmp, name = `${LK_SESSION}.json`) => JSON.parse(readFileSync(join(tmp, 'devkit-stop', name), 'utf8'));
export const nothingRecorded = (tmp) => assert.equal(existsSync(join(tmp, 'devkit-stop')), false, 'nothing was refused, nothing recorded');

export const stopOf = (root, transcript, { opts, extra } = {}) => withTmp((tmp) => ({ tmp, d: loopModule.roadmapStopDecision(lkStopInput(root, transcript, extra), lkOpts(opts)) }));

export const agentOf = (input, opts) => loopModule.roadmapAgentDecision(input, lkOpts(opts));

export function lkHook(mode, input, env = {}) {
  const r = spawnSync(process.execPath, [GUARD, mode], { input: JSON.stringify(input), encoding: 'utf8', env: { ...process.env, ...SET, ...env } });
  return { code: r.status, err: r.stderr, out: r.stdout };
}
export const lkEdit = (root, file, transcript, role) => ({
  cwd: root, tool_name: 'Write', tool_input: { file_path: join(root, file) }, transcript_path: transcript,
  ...(role ? { agent_type: `devkit-core:${role}`, agent_id: 'agent-0001' } : {}),
});
export const lkBash = (root, command, transcript, role) => ({
  cwd: root, tool_name: 'Bash', tool_input: { command }, transcript_path: transcript,
  ...(role ? { agent_type: `devkit-core:${role}`, agent_id: 'agent-0001' } : {}),
});

export const SKILL_PATH = join(HERE, '..', 'skills', 'devkit', 'SKILL.md');
export const skillMd = () => readFileSync(SKILL_PATH, 'utf8');
export const SESSION_SKILL_PATH = join(HERE, '..', 'skills', 'devkit-session', 'SKILL.md');
export const sessionSkillMd = () => readFileSync(SESSION_SKILL_PATH, 'utf8');
export const sectionOf = (md, from, to) => {
  const a = md.indexOf(from);
  assert.ok(a >= 0, `section ${from}`);
  const b = md.indexOf(to, a + from.length);
  return md.slice(a, b < 0 ? md.length : b);
};
// A process that has ended: its pid names no live process.
export const deadPid = () => spawnSync(process.execPath, ['-e', '']).pid;
export const lockFileOf = (root) => join(dirname(runFileOf(root)), 'roadmap-run.lock');

export const AT = '2026-11-21T10:00:00.000Z';
export const START_FIELDS = ['background', 'context', 'cwd', 'initiation', 'model', 'name', 'prompt', 'title', 'use_worktree'];
// The facts of a run with a session per change (design D-3): the coordinating session `S-main`, the turn named by the caller.
export const sessionWorld = (over = {}) => world({ changeSessions: true, coordinator: 'S-main', turn: 'typed', startedSessions: {}, ...over });

export const UP_SESSION = 'session-upfront-0001';
export const UP_TICKET = '0123456789abcdef';
export const SKILL_INPUT = { skill: 'devkit-openspec:devkit-session' };

// The first message of a session the run started, in the host's form: the background line, a paragraph, `Task:`, the task and its start line.
export const upStarted = (id, over = {}) => [
  over.first ?? guardModule.STARTED_BY_SESSION, 'This session runs the devkit change for a roadmap run. Work only in its worktree.', '', 'Task:',
  over.task ?? `/devkit-openspec:devkit change ${id}`, ...(over.start === null ? [] : [over.start ?? `devkit-start: ${id} ${over.ticket ?? UP_TICKET}`]),
  '', 'Notes: say who started this session before your first question.',
].join('\n');
export const upTickets = (id = 'a', over = {}) => ({ [id]: { ticket: UP_TICKET, at: AT, claimedBy: null, ...over } });
// A project whose run file records `tickets`, and the transcript of a session whose first message is `first` (or the given lines).
export function upEntry({ first = upStarted('a'), tickets = upTickets(), lines } = {}) {
  const root = projectWith(roadmapText('[ ] a'));
  if (tickets !== null) putRun(root, { tickets });
  return { root, transcript: lkTranscript(lines ?? [lkPlain(first), lkAssistant()]) };
}
export const upInput = (root, transcript, { tool_input = SKILL_INPUT, session = UP_SESSION } = {}) => ({ session_id: session, transcript_path: transcript, cwd: root, tool_name: 'Skill', tool_input });
export const entryOf = (e, over) => loopModule.entryDecision(upInput(e.root, e.transcript, over), { env: cleanEnv });
export const labelOf = (d) => [d.decision, d.why];

export const UP_GIT = { GIT_AUTHOR_NAME: 'devkit test', GIT_AUTHOR_EMAIL: 'test@devkit.invalid', GIT_COMMITTER_NAME: 'devkit test', GIT_COMMITTER_EMAIL: 'test@devkit.invalid', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' };
export const upGitEnv = { ...cleanEnv, ...UP_GIT };
export const PLAN_FILES = { requirements: 'requirements.md', decisions: 'decisions.md', proposal: 'proposal.md', specs: 'specs/s/spec.md', design: 'design.md', tasks: 'tasks.md', readiness: 'readiness.md' };
export const partOf = (stage) => FLOWS.devkit.stages.find((s) => s.id === stage)?.part ?? null;
// The facts of one `sessionDecide`: the action, the part of its stage, what the roadmap and the tree say, and the run's places.
export const sdFacts = (action, over = {}) => ({
  id: action.change ?? 'a', action, part: partOf(action.stage), waitsFor: null, notInHead: false, hasProposal: false,
  places: 1, occupied: {}, queued: {}, anyway: [], load: 10, limit: 80, now: AT, lang: 'en', ...over,
});
export const sd = (action, over) => loopModule.sessionDecide(sdFacts(action, over));
export const implAct = (id = 'a', over = {}) => agentAct(id, 'implementation', { stageTitle: 'Implementation', role: 'tdd-implementer', agent: 'devkit-core:tdd-implementer', ...over });

// A change `a` (or the `id` given) of the default script on its own branch of a scratch project, its plan written up to the readiness review, in a run with a session per change.
export function upChange({ roadmap = ['[ ] a', '[ ] b'], run = {}, files = {}, id = 'a' } = {}) {
  const root = projectWith(roadmapText(...roadmap), { config: 'schema: devkit\nship:\n  devkit: pr\n' });
  git(root, 'checkout', '-q', '-b', id);
  const c0 = git(root, 'rev-parse', 'HEAD');
  const dir = `openspec/changes/${id}`;
  const planned = { [`${dir}/.openspec.yaml`]: 'schema: devkit\n' };
  for (const [stage, file] of Object.entries(PLAN_FILES)) {
    const body = stage === 'readiness' ? '# Readiness\n\n- Status: APPROVED\n' : stage === 'tasks' ? '# Tasks\n\n- [ ] 1.1 a\n' : `# ${stage}\n`;
    planned[`${dir}/${file}`] = `<!-- devkit-stage ${stage} result=passed attempt=1 commit=${c0} -->\n${body}`;
  }
  put(root, { ...planned, ...files });
  commitAll(root, `plan ${id}`);
  putRun(root, { changeSessions: true, places: 1, tickets: upTickets(id, { claimedBy: `S-${id}` }), ...run });
  return root;
}
export const approve = (root, id = 'a') => {
  const dir = join(root, 'openspec', 'changes', id);
  put(root, { [`openspec/changes/${id}/approval.md`]: `<!-- devkit-stage approval result=passed attempt=1 commit=none -->\n# Plan approval: ${id}\n\n- Status: APPROVED\n- Readiness: ${approvalState(dir).readiness}\n` });
  commitAll(root, `approve ${id}`);
};
export const doSessionNext = (cwd, extra = [], opts = {}) => cmd(cwd, ['session-next', '--change', 'a', ...FLAGS, ...extra], opts);

// A clone with an origin. Change `b` (line `after: a`) works in its own worktree on branch b, which has its own commit; `a` is archived on
// the default branch (and pushed) only when asked; `conflict` makes both sides change the same file.
export function upBase({ archive = true, conflict = false } = {}) {
  const origin = tmpFolder('devkit-upfront-origin-');
  git(origin, 'init', '-q', '--bare', '-b', 'main');
  const root = projectWith(roadmapText('[x] a', '[ ] b (after: a)'));
  git(root, 'remote', 'add', 'origin', origin);
  put(root, { 'notes.txt': 'base\n' });
  commitAll(root, 'notes');
  git(root, 'push', '-q', '-u', 'origin', 'main');
  const wt = join(tmpFolder('devkit-upfront-wt-'), 'b');
  git(root, 'worktree', 'add', '-q', '-b', 'b', wt);
  const c0 = git(wt, 'rev-parse', 'HEAD');
  const dir = 'openspec/changes/b';
  put(wt, {
    [`${dir}/.openspec.yaml`]: 'schema: devkit\n',
    [`${dir}/requirements.md`]: `<!-- devkit-stage requirements result=passed attempt=1 commit=${c0} -->\n# requirements\n`,
    [`${dir}/decisions.md`]: `<!-- devkit-stage decisions result=passed attempt=1 commit=${c0} -->\n# decisions\n`,
    ...(conflict ? { 'notes.txt': 'b side\n' } : {}),
  });
  commitAll(wt, 'open b');
  if (archive) {
    put(root, { 'openspec/changes/archive/2026-11-01-a/proposal.md': 'archived\n', ...(conflict ? { 'notes.txt': 'main side\n' } : {}) });
    commitAll(root, 'archive a');
    git(root, 'push', '-q', 'origin', 'main');
  }
  putRun(root, { changeSessions: true, places: 2, tickets: upTickets('b', { claimedBy: 'S-b' }) });
  return { root, wt };
}
export const sessionNextOf = (cwd, id, opts = {}) => jsonOf(cmd(cwd, ['session-next', '--change', id, ...FLAGS], opts).stdout);

// The change session of `a`, held at its stop: the transcript of a started session that ran session-next, and the hook's input.
export const upStopInput = (root, { session = LK_SESSION } = {}) => ({
  session_id: session, cwd: root, permission_mode: 'bypassPermissions', hook_event_name: 'Stop', stop_hook_active: false, last_assistant_message: 'Waiting.', background_tasks: [], session_crons: [],
  transcript_path: lkTranscript([lkPlain(upStarted('a')), lkAssistant(), lkChangeMarker('a')]),
});

export const AT2 = '2026-11-21T11:00:00.000Z';
export const JOB = { id: 'job-1', at: AT };
export const gateLine = (id, gate, others = false) => say(others ? 'roadmap-gate-others' : 'roadmap-gate', { id, gate });

// A change `a` on its own branch with its grill and plan committed, an `origin` that has only main (or no repository at that address), a run that claimed its ticket.
export function upPushed({ remote = 'ok' } = {}) {
  const root = upChange({ roadmap: ['[ ] a'] });
  const origin = tmpFolder('devkit-upfront-push-');
  if (remote === 'ok') {
    git(origin, 'init', '-q', '--bare', '-b', 'main');
    git(root, 'remote', 'add', 'origin', origin);
    git(root, 'push', '-q', 'origin', 'main');
  } else git(root, 'remote', 'add', 'origin', join(origin, 'nowhere'));
  return { root, origin };
}
export const pushesOf = (r) => jsonOf(r.stdout).actions.filter((a) => a.kind === 'push');
export const PUSH_OPTS = { env: upGitEnv };
