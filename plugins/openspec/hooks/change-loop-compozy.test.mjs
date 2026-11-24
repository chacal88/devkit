// node scripts/test-suite.mjs plugins/openspec/hooks/change-loop-compozy.test.mjs
// change-coordinator, part 2 of 3 (suite-speed D-11; the others are change-loop.test.mjs and change-loop-remote.test.mjs): the command and the wiring, the skill and the documents, the field-fixes, stage-roles, the compozy driver's view and record steps, and the triage as flow version 2. What the three parts share is in change-loop-fixtures.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, symlinkSync, writeFileSync, readFileSync, existsSync, readdirSync, rmSync, utimesSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { tmpFolder, tmpRoot } from './test-tmp.mjs';
import { spawnSync, spawn } from 'node:child_process';
import {
  gitRepo, put, commitAll, git, openspecStub, sandbox, readCounter, roundRepo, pm, writeRetro, retroMd, proposal, fakeCompozy,
  cleanEnvLoop as cleanEnv, FLOWS, nextOf, endOf, reportOf, rowOf, run, head, planChange, actionOf, typedLine, toolResultLine, runLine, assistantLine,
  transcriptOf,
} from './test-fixtures.mjs';
import { approvalState } from './deliver-check.mjs';
import { pinsIn } from './release-merge.mjs';
import * as guardModule from './guard.mjs';
import * as changeLoopModule from './change-loop.mjs';
import {
  readDevkitSettings, MESSAGES, render, exitCodeOf, ROW_STEPS, main, HOOKS_DIR, LoopUsageError, waitLoop, PACKS, withLockFile, openChange,
} from './change-loop.mjs';
import {
  HERE, LOOP, TDD, PLANNER, read, configRepo, shape, says, build, next, parsed, check, deliveredChange, startRun, body, snapshot, addChange,
  devkitRepo, freshProject, WAIT, runOf, plainLine, skillBodyLine, runTranscript, hook, subInput, PLAN_UP_TO_TASKS, editInput, bashInput, liteChange,
  approvedChange, agentInput, REPO_ROOT, readRepo, SKILL_FILE, skillText, LANG_FLAG, section, IDENT,
} from './change-loop-fixtures.mjs';

// The same git identity the whole file had when it was one file (see IDENT in change-loop-fixtures.mjs).
for (const [k, v] of Object.entries(IDENT)) process.env[k] ??= v;

// ---------------------------------------------------------------- the command, the wiring (phase 4: D-3, D-9, D-10)
const frontmatterOf = (text) => text.split('\n').slice(1, text.split('\n').indexOf('---', 1));

// The `skills:` list of an agent file's frontmatter, with any `<plugin>:` prefix removed.
function agentSkills(text) {
  const lines = frontmatterOf(text);
  const at = lines.findIndex((l) => l === 'skills:');
  if (at < 0) return [];
  const out = [];
  for (const l of lines.slice(at + 1)) {
    const m = /^\s+-\s+(\S+)\s*$/.exec(l);
    if (!m) break;
    out.push(m[1].replace(/^[\w-]+:/, ''));
  }
  return out.sort();
}

test('change-loop skills: every shipped stage agent declares its stage\'s skills', () => {
  const agentFile = new Map();
  for (const plugin of readdirSync(join(REPO_ROOT, 'plugins'))) {
    const dir = join(REPO_ROOT, 'plugins', plugin, 'agents');
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) if (f.endsWith('.md')) agentFile.set(f.slice(0, -3), join(dir, f));
  }
  const want = new Map(); // role -> sorted skills, equal in every script that has the role
  const unshipped = new Set();
  for (const [script, flow] of Object.entries(FLOWS)) {
    const perRole = new Map();
    for (const st of flow.stages) {
      if (st.shipped === false) { unshipped.add(st.role); continue; }
      perRole.set(st.role, new Set([...(perRole.get(st.role) ?? []), ...st.skills]));
    }
    for (const [role, set] of perRole) {
      const skills = [...set].sort();
      if (want.has(role)) assert.deepEqual(want.get(role), skills, `the two scripts agree on the skills of ${role} (${script})`);
      want.set(role, skills);
    }
  }
  for (const role of unshipped) assert.ok(!agentFile.has(role), `${role} is marked shipped: false but has an agent file: flip shipped and wire its skills`);
  const bare = [...want.keys()].filter((r) => !agentFile.has(r)).sort();
  assert.deepEqual(bare, ['owner', 'review-bench']);
  for (const [role, skills] of want) {
    if (!agentFile.has(role)) continue;
    assert.deepEqual(agentSkills(readFileSync(agentFile.get(role), 'utf8')), skills, `${role} declares the skills of its stage`);
  }
  assert.deepEqual(want.get('tdd-implementer'), ['systematic-debugging', 'test-driven-development']);
  assert.deepEqual(want.get('change-planner'), []);
});

test('change-loop settings: devkit-openspec has the language user setting', () => {
  const plugin = JSON.parse(readRepo('plugins', 'openspec', '.claude-plugin', 'plugin.json'));
  const lang = plugin.userConfig?.language;
  assert.ok(lang, 'userConfig.language exists');
  assert.equal(lang.type, 'string');
  assert.equal(lang.default, 'pt-BR');
  assert.ok(!('options' in lang), 'no options key (it needs Claude Code v2.1.271+)');
  assert.equal(typeof lang.title, 'string');
  assert.match(lang.description, /pt-BR or en/);
  const panel = JSON.parse(readRepo('plugins', 'panel', '.claude-plugin', 'plugin.json')).userConfig.language;
  assert.equal(lang.type, panel.type);
  assert.equal(lang.default, panel.default);
});

test('change-loop skill: the frontmatter', () => {
  const md = skillText();
  const fm = frontmatterOf(md);
  assert.ok(fm.includes('name: devkit'));
  assert.ok(fm.includes('disable-model-invocation: true'));
  assert.ok(fm.some((l) => l.startsWith('argument-hint: ') && l.includes('change')));
  const desc = fm.find((l) => l.startsWith('description:'));
  assert.match(desc, /\bUse when\b/);
  assert.match(desc, /\/devkit change/);
});

test('change-loop skill: every change-loop command and the readout carry the person\'s language', () => {
  const md = skillText();
  const calls = md.split('\n').filter((l) => /change-loop\.mjs (start|open|script|flow|wait|next|reply)\b/.test(l));
  for (const sub of ['start', 'open', 'script', 'flow', 'wait', 'next', 'reply']) {
    assert.ok(calls.some((l) => l.includes(`change-loop.mjs ${sub}`)), `the body runs ${sub}`);
  }
  for (const l of calls) assert.ok(l.includes(LANG_FLAG), `--lang on: ${l}`);
  const readouts = md.split('\n').filter((l) => /flow-check\.mjs/.test(l));
  assert.ok(readouts.length >= 1, 'the readout when the owner asks where the change stands');
  for (const l of readouts) assert.ok(l.includes(LANG_FLAG), `--lang on: ${l}`);
  assert.doesNotMatch(md, /--lang (pt-BR|en)\b/);
});

test('change-loop skill: start and open read the request through a quoted heredoc with the terminator rule', () => {
  const md = skillText();
  const lines = md.split('\n');
  const start = lines.findIndex((l) => l.includes('change-loop.mjs start'));
  assert.ok(lines[start].endsWith("<<'DEVKIT_ARGS'"), 'start opens a quoted heredoc');
  assert.equal(lines[start + 1], '$ARGUMENTS');
  assert.equal(lines[start + 2], 'DEVKIT_ARGS');
  const open = lines.findIndex((l) => l.includes('change-loop.mjs open'));
  assert.ok(lines[open].endsWith("<<'DEVKIT_ARGS'"), 'open opens a quoted heredoc');
  assert.equal(lines[open + 2], 'DEVKIT_ARGS');
  assert.doesNotMatch(md, /<<\s*[A-Z_]+\b(?!')/, 'no unquoted heredoc');
  assert.match(md, /line of the request equals `DEVKIT_ARGS`/);
  assert.match(md, /`DEVKIT_ARGS_` followed by digits that no line of the request holds/);
});

test('change-loop skill: the release-conflict sentence', () => {
  const md = skillText();
  assert.ok(md.includes('`resolve-release-conflict`'));
  assert.ok(md.includes('Run `detail.command` in the worktree, then the project\'s test command; report the JSON and the result; change nothing else.'));
  assert.match(md, /`Outcome: failure` goes back to `next`, as for any agent/);
});

test('change-loop skill: the script rule and its correction', () => {
  const md = skillText();
  assert.ok(md.includes('`devkit-lite` only for a small change that is easy to undo and touches no screen, no boundary between parts of the project and no contract other parts rely on; `devkit` otherwise and whenever in doubt'));
  for (const code of ['small', 'doubt', 'architecture', 'contract', 'ui', 'capability', 'risk']) assert.ok(md.includes(`\`${code}\``), code);
  assert.match(md, /does not ask/);
  assert.match(md, /change-loop\.mjs script <id> <devkit\|devkit-lite> --why <code>/);
  assert.match(md, /`name-taken`/);
});

test('change-loop skill: the approval and the retro answers are written only from the owner\'s own message', () => {
  const md = skillText();
  assert.match(md, /Plan approval and retro answers are written only from the owner's own message/);
  const never = md.slice(md.indexOf('## Never'));
  assert.match(never, /Write `approval\.md` or a retro answer except from the owner's own message/);
  assert.match(never, /Write `readiness\.md`, `evidence\.md` or `reviews\/`/);
});

test('change-loop skill: one stage per hand-off, in the foreground, never a subagent for a whole change, never choosing the order', () => {
  const md = skillText();
  const loop = section(md, '## Loop', '## Owner gates');
  assert.match(loop, /one Agent call/);
  assert.match(loop, /in the foreground/);
  assert.match(loop, /the call's `subagent_type` set to the action's `agent` field/);
  assert.match(loop, /`--after`/);
  const never = md.slice(md.indexOf('## Never'));
  assert.match(never, /Dispatch a subagent for a whole change/);
  assert.match(never, /Choose the order of the stages or run two stages at once/);
  assert.match(never, /Edit product code in this session/);
  assert.match(never, /Bypass a hook or a gate/);
});

test('change-loop skill: an end the session declares goes through reply, and the marker lines are never shown (F1)', () => {
  const md = skillText();
  const loop = section(md, '## Loop', '## Owner gates');
  assert.match(loop, /a second line `devkit-end: <id> <state>` follows/);
  assert.match(loop, /never show one to the owner/);
  assert.match(loop, /An end the session declares itself \(a red gate, a pull-request decision left to the owner\) goes through `reply`/);
  assert.match(loop, /only the lines after it are shown to the owner/);
  for (const key of ['reply blocked --param id=<id> --param why=tests-red', 'reply waiting-pr-decision --param id=<id>']) assert.ok(loop.includes(key), key);
  assert.ok(!loop.includes('why=role-failed'), 'a failed agent is the loop\'s end, not the session\'s');
  assert.doesNotMatch(loop, /\bsay `node/, 'the declared ends are run, not said');
});

test('change-loop skill: the review sentence points at the ship-change review row, and verify comes before review', () => {
  const loop = section(skillText(), '## Loop', '## Owner gates');
  const review = loop.split('\n').find((l) => l.startsWith('- `review`'));
  assert.ok(review, 'a review item');
  assert.match(review, /`ship-change` `review` row/);
  assert.match(review, /Workflow tool/);
  assert.match(review, /`agents` path/);
  assert.match(review, /declared lost/);
  const order = loop.split('\n').find((l) => l.includes('`verify`') && l.includes('`review`'));
  assert.ok(order && order.indexOf('`verify`') < order.indexOf('`review`'), 'verify before review');
});

test('change-loop skill: the wait is started in the background on a GitHub wait', () => {
  const md = skillText();
  const wait = section(md, '## Waiting on GitHub', '## Never');
  assert.match(wait, /Bash tool's background option/);
  assert.ok(wait.includes(`change-loop.mjs wait --change <id> ${LANG_FLAG}`));
  assert.match(wait, /no time limit/);
  assert.match(wait, /`waiting-github`|waiting on GitHub/);
  assert.match(wait, /then runs `next`/);
});

test('change-loop skill: the grill paragraph names the stage header and requirements', () => {
  const grill = skillText().split('\n').find((l) => l.startsWith('- `grill`'));
  assert.ok(grill, 'a grill item');
  assert.ok(grill.includes('<!-- devkit-stage'));
  assert.ok(grill.includes('requirements'));
  assert.match(grill, /requirements-grill/);
  assert.match(grill, /result=passed/);
});

test('change-loop skill: the sections of D-3 to D-9 and the modes of start', () => {
  const md = skillText();
  const heads = md.split('\n').filter((l) => l.startsWith('## '));
  assert.deepEqual(heads, ['## Settings', '## Start', '## On the CompozyOS driver', '## A new change', '## Loop', '## Owner gates', '## Waiting on GitHub', '## Train', '## Roadmap', '## Status', '## Project', '## Never']);
  for (const mode of ['not-built', 'unknown-verb', 'not-set-up', 'setting-unknown', 'driver-not-built', 'driver-no-project', 'nothing', 'choose', 'ask-unfinished', 'resume', 'new', 'roadmap', 'status', 'project', 'is-slice', 'train', 'train-args']) {
    assert.ok(md.includes(`\`${mode}\``), `mode ${mode}`);
  }
  assert.match(md, /AskUserQuestion/);
  // Invariant: the change part of the skill names no retired machinery and no schedule. Layer: skill text. Suite: change-loop.
  // The session-start tool is named by the Roadmap section now (ADR 0014), and so is the roadmap run's one periodic check (ADR 0021); ADR 0006's wake-up stays retired.
  const roadmapAt = md.indexOf('## Roadmap');
  assert.doesNotMatch(md.slice(0, roadmapAt), /conduct-check|CronCreate|wake_when_done/);
  assert.doesNotMatch(md.slice(roadmapAt), /conduct-check|wake_when_done/);
});

test('change-loop skill: the CompozyOS section starts runs and asks nothing', () => {
  const md = skillText();
  const sec = section(md, '## On the CompozyOS driver', '\n## ');
  assert.ok(md.indexOf('## On the CompozyOS driver') > md.indexOf('\n## Start') && md.indexOf('## On the CompozyOS driver') < md.indexOf('\n## A new change'), 'after Start');
  assert.match(sec, /settings\.driver: compozy/);
  // Invariant: the section names `compozy-start` for new, resume and roadmap, through the quoted heredoc. Layer: skill text. Suite: guard.
  assert.match(sec, /change-loop\.mjs compozy-start <id> --lang \$\{user_config\.language\} <<'DEVKIT_ARGS'/);
  assert.match(sec, /roadmap-loop\.mjs compozy-start --lang \$\{user_config\.language\} --load-limit \$\{user_config\.load_limit\} <<'DEVKIT_ARGS'/);
  assert.doesNotMatch(sec, /<<\s*[A-Z_]+\b(?!')/, 'no unquoted heredoc');
  for (const word of ['`new`', '`resume`', '`choose`', '`ask-unfinished`', '`roadmap`', '`status`', '`name-taken`', '`driver-no-project`']) assert.ok(sec.includes(word), `the section names ${word}`);
  assert.match(sec, /say `reply` and end the turn/);
  assert.match(sec, /runs no loop/);
  assert.match(sec, /hands no stage/);
  assert.match(sec, /asks nothing of the change/);
});

test('change-loop skill: every reply not yet shown ends the turn, in order, before anything else (AC-1)', () => {
  const md = skillText();
  const settings = section(md, '## Settings', '## Start');
  assert.match(settings, /Only the last message of a turn reaches the owner/);
  assert.match(settings, /every `reply` the script printed in this turn that the owner has not been shown is part of the message that ends the turn, in order, before anything else/);
  assert.match(settings, /opens a change ends with the opening reply and then the grill's first question/);
  assert.match(settings, /`resume` reply and a `switch-script` reply likewise/);
  assert.doesNotMatch(md, /say `reply`, then enter the Loop/i);
  const resume = md.split('\n').find((l) => l.startsWith('- `resume`'));
  assert.ok(resume && /keep `reply` for the message that ends the turn/.test(resume), 'resume keeps its reply');
  const fresh = section(md, '## A new change', '## Loop');
  assert.match(fresh, /Keep `reply` for the message that ends the turn, then enter the Loop with the id/);
  const sw = md.split('\n').find((l) => l.startsWith('- `session`'));
  assert.ok(sw && /keeps `reply` for the message that ends the turn/.test(sw), 'switch-script keeps its reply');
});

test('change-loop skill: what the session writes itself follows the message table\'s rule (AC-11)', () => {
  const md = skillText();
  const never = md.slice(md.indexOf('## Never'));
  assert.match(never, /Show the owner an internal term/);
  for (const term of ['progress key', 'agent or role id', 'reason code', 'step name of a checker']) assert.ok(never.includes(term), term);
  assert.match(never, /`stageTitle`/);
  assert.match(never, /call `\/devkit change` again/);
  assert.match(never, /file name the owner needs in order to act/);
});

// ---------------------------------------------------------------- /conduct retired, the documents and ADR 0011 (phase 6: D-11, D-13, D-16)

function repoFiles() {
  const out = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  assert.equal(out.status, 0, out.stderr);
  return out.stdout.split('\0').filter((f) => f && existsSync(join(REPO_ROOT, f)));
}

test('change-loop retire: /conduct is not shipped and nothing points at it', () => {
  assert.equal(existsSync(join(REPO_ROOT, 'plugins', 'openspec', 'skills', 'conduct')), false, 'the conduct skill folder is gone');
  assert.ok(existsSync(SKILL_FILE), 'the devkit skill exists');
  for (const f of ['docs/catalog.md', 'plugins/openspec/README.md']) assert.doesNotMatch(readRepo(f), /skills\/conduct\//, `${f} links no skills/conduct/`);
  const guard = readRepo('plugins', 'openspec', 'hooks', 'guard.mjs');
  const sessionText = guard.split('\n').filter((l) => l.includes('/devkit change') || /\/conduct\b(?!-)/.test(l));
  assert.ok(sessionText.some((l) => l.includes('/devkit change') && l.includes('runs a change from your request to its archive')), 'the session text names /devkit change');
  assert.ok(!sessionText.some((l) => /\/conduct\b(?!-)/.test(l) && !l.includes('/devkit change')), 'the session text does not name /conduct');
  const records = [/^CHANGELOG\.md$/, /^openspec\/changes\//, /^openspec\/roadmap\.md$/, /^docs\/adr\//, /^docs\/coordination-design\.md$/,
    /^plugins\/panel\/hooks\/fixtures\//, /^plugins\/panel\/hooks\/[\w.-]+\.test\.tsx?$/, /^plugins\/openspec\/hooks\/change-loop-compozy\.test\.mjs$/];
  const stray = [];
  for (const f of repoFiles()) {
    if (records.some((r) => r.test(f))) continue;
    let text;
    try { text = readFileSync(join(REPO_ROOT, f), 'utf8'); } catch { continue; }
    if (text.includes('\0')) continue;
    text.split('\n').forEach((line, i) => {
      if (/\/(?:[\w-]+:)?conduct\b(?!-check)/.test(line) && !line.includes('/devkit change')) stray.push(`${f}:${i + 1}: ${line.trim().slice(0, 100)}`);
    });
  }
  assert.deepEqual(stray, [], 'every line naming /conduct names /devkit change as well');
});

// Every pin of `text` that is not `v<version>`.
const pinMismatches = (text, version) => pinsIn(text).filter((p) => p !== `v${version}`);

test('release-merge-conflict 15: the CI-pin check names the pin that differs from the manifest', () => {
  const version = JSON.parse(readRepo('plugins', 'openspec', '.claude-plugin', 'plugin.json')).version;
  const flow = readRepo('docs', 'openspec-flow.md');
  const changed = flow.replace(/<commit sha of v[0-9.]+>/, '<commit sha of v9.9.9>');
  assert.notEqual(changed, flow, 'the doc has a pin to change');
  assert.deepEqual(pinMismatches(changed, version), ['v9.9.9']);
  assert.deepEqual(pinMismatches('', version), []);
  assert.deepEqual(pinsIn(''), []);
});

test('release-merge-conflict 16: the flow doc and the skill describe the release step as a merge and a plain push', () => {
  const flow = readRepo('docs', 'openspec-flow.md');
  for (const text of ['**Release-file conflicts: `release-merge.mjs`.**', 'git merge --no-ff --no-commit origin/<base>', 'git push origin <branch>']) assert.ok(flow.includes(text), text);
  for (const re of [/push-rebased/, /release-rebase\.mjs/, /force-with-lease/]) assert.doesNotMatch(flow, re);
  const skill = skillText();
  assert.ok(skill.includes('The command merges `origin/<base>` into the branch and commits the merge with the release renumbered above the base\'s; then the loop hands `verify`, `review` and a plain `push` (`open-archive-pr` on an archive branch) with `detail.command` `git push origin <branch>`, never a force push.'));
  for (const re of [/push-rebased/, /rebase/, /--force/]) assert.doesNotMatch(skill, re);
  assert.ok(readRepo('plugins', 'openspec', 'README.md').includes('(hooks/release-merge.mjs)'));
});

test('change-loop docs: the design records the answers', () => {
  const design = readRepo('docs', 'coordination-design.md');
  const part = (from, to) => { const a = design.indexOf(from); assert.ok(a >= 0, from); const b = design.indexOf(to, a + from.length); return design.slice(a, b < 0 ? design.length : b); };
  const open = part('## Open points', '## What stays shipped');
  for (const gone of [/Which rules of ADR 0007/, /The configuration's field names/, /How the change coordinator waits on GitHub/, /How the two roles called `tech-lead`/]) {
    assert.doesNotMatch(open, gone, `${gone} left Open points`);
  }
  assert.match(open, /Whether the review stage keeps the Workflow path/, 'the Workflow point stays');
  const two = part('## 2. Two coordinators', '## 3. ');
  assert.match(two, /Decided by the owner on 2026-11-20 \(round 15 grill, question 2\)/);
  assert.match(two, /Decided on 2026-11-20 \(A-7\)/);
  assert.match(part('## 8. ', '## 9. '), /Decided by `change-coordinator` on 2026-11-20 \(A-8\)/);
  assert.match(part('## 10. ', '## 11. '), /Decided by the owner on 2026-11-20 \(round 15 grill, question 1\)/);

  const adr = readRepo('docs', 'adr', '0011-the-change-coordinator-is-the-owners-session.md');
  assert.match(adr, /^- Status: (proposed|accepted)$/m);
  assert.match(adr, /^- Amends: ADR 0010 /m);
  for (const h of ['## Context', '## Decision', '## Consequences', '### Review trigger', '## Alternatives considered']) {
    assert.ok(adr.split('\n').includes(h), `ADR 0011 has ${h}`);
  }
  const adr10 = readRepo('docs', 'adr', '0010-openspec-as-the-harness.md');
  const ctx10 = adr10.slice(adr10.indexOf('## Context'), adr10.indexOf('ADR 0001 let devkit coordinate'));
  assert.match(ctx10, /Note \(change-coordinator, \d{4}-\d{2}-\d{2}\)[\s\S]*ADR 0011/);
  for (const f of ['0005-parallel-steps-and-a-session-wake-up.md', '0006-phases-as-child-sessions.md', '0007-one-change-on-request.md', '0008-reviews-as-a-workflow.md', '0009-compozy-loop-as-a-second-driver.md']) {
    assert.match(readRepo('docs', 'adr', f), /Note \(change-coordinator, \d{4}-\d{2}-\d{2}\):[^\n]*(\n[^\n]+)*?\/devkit change/, `${f} names /devkit change`);
  }
  const adr8 = readRepo('docs', 'adr', '0008-reviews-as-a-workflow.md');
  const ctx8 = adr8.slice(adr8.indexOf('## Context'), adr8.indexOf('Note (ADR 0010'));
  assert.match(ctx8, /Note \(change-coordinator, \d{4}-\d{2}-\d{2}\): `\/conduct` was retired in round 15; one change now runs with `\/devkit change` \(ADR 0010\), whose review step is the `ship-change` `review` row, unchanged\./, 'ADR 0008 has the dated Note before its existing one');
  assert.match(adr8, /^- Status: accepted$/m, 'its status does not change');
  const adrs = readRepo('openspec', 'config.yaml').split('\n').find((l) => l.trim().startsWith('ADRs:'));
  assert.match(adrs, /0011/, 'the ADRs line names 0011');
  const flow = readRepo('docs', 'openspec-flow.md');
  assert.ok(flow.split('\n').includes('## The change coordinator: `/devkit change`'), 'the flow doc has the section');
  // Invariant: the CI snippet pins the current release (docs, change-loop.test.mjs); own-pr-archive-paths moves it to 0.38.1 (release 0.42.1), above suite-speed's 0.38.0 (release 0.42.0), above the 0.37.0 of the change before it (release 0.41.0), which moved it above compozy-driver's 0.36.0 (release 0.40.0), which moved it above stage-models' 0.35.0 (release 0.39.0), which moved it above delivery-train's 0.34.0 (release 0.38.0), which moved it above roadmap-sessions-upfront's 0.33.0 (release 0.37.0); 0.33.0 went to roadmap-sessions-upfront, 0.32.0 to remote-worker (release 0.36.0); 0.31.0 went to change-version-pin (release 0.35.0), 0.30.1 went to the retro of release-tags (release 0.34.1), 0.30.0 to release-tags (release 0.34.0), 0.29.0 went to release-merge-conflict (release 0.33.0), 0.28.2 to change-state-retro-fixes (release 0.32.2), 0.28.1 to the retro of change-budget, 0.28.0 to delivery-models, 0.27.1 to the earlier retro fixes, 0.27.0 to gh-version-check, 0.26.1 to review-openspec-fix, 0.26.0 to jira-entry, 0.25.0 to change-budget, 0.24.0 to change-state, 0.23.0 to commit-attribution, 0.22.1 to test-fixture-cleanup and 0.22.0 to stage-roles.
  assert.match(flow, /v0\.38\.1/, 'the CI snippet pins the current release (own-pr-archive-paths: 0.38.1)');
  assert.doesNotMatch(flow, /v0\.38\.0/, 'no pin left on main\'s release before it (suite-speed)');
  assert.doesNotMatch(flow, /v0\.36\.0/, 'no pin left on the release before that (compozy-driver)');
  assert.doesNotMatch(flow, /v0\.35\.0/, 'no pin left on main\'s release before it (stage-models)');
  assert.doesNotMatch(flow, /v0\.34\.0/, 'no pin left on the release before that (delivery-train)');
  assert.doesNotMatch(flow, /v0\.33\.0/, 'no pin left on the release before that (roadmap-sessions-upfront)');
  assert.doesNotMatch(flow, /v0\.32\.0/, 'no pin left on the release before that (remote-worker)');
  assert.doesNotMatch(flow, /v0\.31\.0/, 'no pin left on the release before that (change-version-pin)');
  assert.doesNotMatch(flow, /v0\.30\.1/, 'no pin left on main\'s release before it (retro of release-tags)');
  assert.doesNotMatch(flow, /v0\.30\.0/, 'no pin left on the release before that (release-tags)');
  assert.doesNotMatch(flow, /v0\.29\.0/, 'no pin left on main\'s release before it (release-merge-conflict)');
  assert.doesNotMatch(flow, /v0\.28\.2/, 'no pin left on main\'s release before it (change-state-retro-fixes)');
  assert.doesNotMatch(flow, /v0\.28\.1/, 'no pin left on the release before that (retro of change-budget)');
  assert.doesNotMatch(flow, /v0\.28\.0/, 'no pin left on the release before that (delivery-models)');
  assert.doesNotMatch(flow, /v0\.27\.1/, 'no pin left on the release before that (earlier retro fixes)');
  assert.doesNotMatch(flow, /v0\.27\.0/, 'no pin left on the previous release (gh-version-check)');
  assert.doesNotMatch(flow, /v0\.26\.1/, 'no pin left on the previous release (review-openspec-fix)');
  assert.doesNotMatch(flow, /v0\.26\.0/, 'no pin left on the previous release (jira-entry)');
  assert.doesNotMatch(flow, /v0\.25\.0/, 'no pin left on the previous release (change-budget)');
  assert.doesNotMatch(flow, /v0\.24\.0/, 'no pin left on the previous release (change-state)');
  assert.doesNotMatch(flow, /v0\.23\.0/, 'no pin left on the previous release (commit-attribution)');
  assert.doesNotMatch(flow, /v0\.22\.1/, 'no pin left on the previous release (test-fixture-cleanup)');
  assert.doesNotMatch(flow, /v0\.22\.0/, 'no pin left on the previous release');
  assert.doesNotMatch(flow, /v0\.21\.2/, 'no pin left on the previous release');
  assert.doesNotMatch(flow, /v0\.21\.1/, 'no pin left on the previous release');
  assert.doesNotMatch(flow, /v0\.21\.0/, 'no pin left on the previous release');
  const staleV20 = flow.split('\n').filter((l) => /v0\.20\.0/.test(l) && !/v0\.20\.0` or later/.test(l));
  assert.deepEqual(staleV20, [], 'no pin left on the previous release; only the slice-merge floor ("v0.20.0 or later") names it');
  assert.match(flow, /moves this pin to `v0\.20\.0` or later first/, 'the slice-merge floor (project-phases) is kept');
  const version = JSON.parse(readRepo('plugins', 'openspec', '.claude-plugin', 'plugin.json')).version;
  assert.ok(pinsIn(flow).length >= 3, 'the CI snippet holds its pins');
  assert.deepEqual(pinMismatches(flow, version), [], 'every CI pin names the devkit-openspec version of its manifest');
  assert.match(flow, /prints `devkit-run: <id>`, then `devkit-end: <id> <state>` when the action is an end/, 'the loop paragraph names the end marker');
  assert.match(flow, /an end the run already recorded/, 'the stop lock reads a recorded end');
  assert.match(flow, /refuses a hand-off with no agent type, to a general-purpose agent, to another plugin's agent even when it is named like a role/, 'the hand-off rule');
  assert.match(flow, /a usage error included[^\n]*keeps its raw message in the JSON's `error` field/, 'the usage-error reply');
  const road = readRepo('openspec', 'roadmap.md').split('\n').find((l) => /^- \[[ x]\] review-writer-prompt/.test(l));
  assert.match(road, /touches only tests/);
  assert.match(road, /fenced example/);
});

// ---- field-fixes 6: the project's OpenSpec CLI (D-1)

function pinnedLoop(version) {
  const root = planChange({ have: ['requirements', 'decisions'] });
  const marker = join(tmpFolder('devkit-change-loop-marker-'), `seen-${Date.now()}-${Math.random().toString(36).slice(2)}.log`);
  const pathDir = openspecStub(tmpFolder('devkit-loop-pathcli-'), { version: '2.1.0', label: 'path', marker });
  openspecStub(join(root, 'node_modules', '.bin'), { version, label: 'pinned', marker });
  const env = { ...cleanEnv, PATH: `${pathDir}:${process.env.PATH}` };
  return { root, marker, env };
}
const seenBy = (marker) => (existsSync(marker) ? readFileSync(marker, 'utf8') : '');

test('field-fixes 6 change-loop: next with a pinned 1.16.0 exits 3 with the message in error, and the PATH CLI never runs', () => {
  const w = pinnedLoop('1.16.0');
  const r = next(w.root, [], w.env);
  assert.equal(r.code, 3, r.stderr);
  const body = JSON.parse(r.stdout);
  assert.match(body.error, /1\.16\.0/);
  assert.match(body.error, /2\.x/);
  assert.ok(body.error.includes(join(w.root, 'node_modules', '.bin', 'openspec')), body.error);
  assert.equal(seenBy(w.marker), '');
});

test('field-fixes 6 change-loop: next with a pinned 2.x is answered by the pinned CLI', () => {
  const w = pinnedLoop('2.0.0');
  next(w.root, [], w.env);
  assert.match(seenBy(w.marker), /^pinned status --change feat/m);
  assert.doesNotMatch(seenBy(w.marker), /^path /m);
});

// ---- field-fixes 1: a change archived on the default branch is not unfinished (D-3)

// A gh that lists `names` as the archived folders of the default branch, or fails (`fail`), and nothing else.
const archiveGh = (names, { fail = false } = {}) => (args) => (
  !fail && args[0] === 'api' && /contents\/openspec\/changes\/archive\?ref=/.test(args[1])
    ? { status: 0, stdout: JSON.stringify(names.map((name) => ({ name }))), stderr: '', missing: false, timedOut: false }
    : { status: 1, stdout: '', stderr: 'gh: not reachable', missing: false, timedOut: false });
const listedBy = (cwd, gh) => body(main(['start', '--lang', 'en'], { cwd, env: cleanEnv, stdin: 'change add a thing', gh })).unfinished.map((u) => u.id);
const archivedFolder = (date, id, flow = null) => ({ [`openspec/changes/archive/${date}-${id}/.openspec.yaml`]: `schema: devkit\n${flow === null ? '' : `x-devkit-flow: ${flow}\n`}` });

// The default branch on origin gains the archived folder of `id` while the main checkout stays where it was.
function archiveOnOrigin(t, id) {
  const pusher = t.addWt('pusher');
  put(pusher, archivedFolder('2026-11-20', id));
  commitAll(pusher, `archive ${id}`);
  git(pusher, 'push', '-q', 'origin', 'HEAD:main');
  git(t.main, 'fetch', '-q', 'origin');
}

test('field-fixes 1 archived: an old worktree on another branch that holds the active folder does not list the change', () => {
  const t = roundRepo({ roadmap: '# Roadmap\n', config: 'schema: devkit\n' });
  addChange(t.addWt('old-wt'), 'foo', ['requirements'], { commit: false });
  assert.deepEqual(listedBy(t.main, archiveGh([])), ['foo'], 'listed while GitHub does not show it archived');
  assert.deepEqual(listedBy(t.main, archiveGh(['2026-11-20-foo'])), []);
});

test('field-fixes 1 archived: an old worktree on the change\'s own branch does not list the change', () => {
  const t = roundRepo({ roadmap: '# Roadmap\n', config: 'schema: devkit\n' });
  addChange(t.addWt('bar'), 'bar', ['requirements'], { commit: false });
  assert.deepEqual(listedBy(t.main, archiveGh([])), ['bar']);
  assert.deepEqual(listedBy(t.main, archiveGh(['2026-11-20-bar'])), []);
});

// An active folder whose `.openspec.yaml` records the day it was created, as `openspec new change` writes it.
const withCreated = (wt, id, created) => put(wt, { [`openspec/changes/${id}/.openspec.yaml`]: `schema: devkit\ncreated: ${created}\n` });

test('field-fixes 1 archived: a new change that reuses an archived id, created after the archive, stays listed', () => {
  const t = roundRepo({ roadmap: '# Roadmap\n', config: 'schema: devkit\n' });
  const own = t.addWt('foo');
  addChange(own, 'foo', ['requirements'], { commit: false });
  withCreated(own, 'foo', '2026-11-21');
  assert.deepEqual(listedBy(t.main, archiveGh(['2026-11-20-foo'])), ['foo'], 'created the day after the archive: a new change');
  withCreated(own, 'foo', '2026-11-10');
  assert.deepEqual(listedBy(t.main, archiveGh(['2026-11-20-foo'])), [], 'created before the archive: the stale copy');
  withCreated(own, 'foo', '2026-11-20');
  assert.deepEqual(listedBy(t.main, archiveGh(['2026-11-20-foo'])), [], 'created the day of the archive: the stale copy');
});

test('field-fixes 1 archived: an archive branch whose pull request merged does not list the change', () => {
  const t = roundRepo({ roadmap: '# Roadmap\n', config: 'schema: devkit\n' });
  put(t.addWt('foo', { branch: 'chore/archive-foo' }), archivedFolder('2026-11-20', 'foo'));
  assert.deepEqual(listedBy(t.main, archiveGh([])), ['foo']);
  assert.deepEqual(listedBy(t.main, archiveGh(['2026-11-20-foo'])), []);
});

test('field-fixes 1 archived: an archive pull request not merged yet stays listed as being archived', () => {
  const t = roundRepo({ roadmap: '# Roadmap\n', config: 'schema: devkit\n' });
  put(t.addWt('baz', { branch: 'chore/archive-baz' }), archivedFolder('2026-11-20', 'baz'));
  const b = body(main(['start', '--lang', 'en'], { cwd: t.main, env: cleanEnv, stdin: 'change add a thing', gh: archiveGh(['2026-11-20-other']) }));
  assert.deepEqual(b.unfinished.map((u) => [u.id, u.where]), [['baz', render('en', 'where.archiving')]]);
});

test('field-fixes 1 archived: a main checkout whose default branch is behind still sees the remote one archive the change', () => {
  const t = roundRepo({ roadmap: '# Roadmap\n', config: 'schema: devkit\n' });
  addChange(t.addWt('old-wt'), 'foo', ['requirements'], { commit: false });
  archiveOnOrigin(t, 'foo');
  assert.equal(existsSync(join(t.main, 'openspec', 'changes', 'archive', '2026-11-20-foo')), false, 'the main checkout is behind');
  assert.deepEqual(listedBy(t.main, archiveGh([])), []);
});

test('field-fixes 1 archived: a failing gh falls back to the remote-tracking default branch', () => {
  const t = roundRepo({ roadmap: '# Roadmap\n', config: 'schema: devkit\n' });
  addChange(t.addWt('old-wt'), 'foo', ['requirements'], { commit: false });
  archiveOnOrigin(t, 'foo');
  assert.deepEqual(listedBy(t.main, archiveGh([], { fail: true })), []);
});

// Invariant (T-24, D-13): resuming an archived change by its id ends archived; layer: startMode (the resume); suite: change-loop. The archived change records
// flow 2, as one opened with this release does (with no pin its reply gains the newer-flow line).
test('field-fixes 1 archived: resuming an archived change by its id still ends archived', () => {
  const t = roundRepo({ roadmap: '# Roadmap\n', config: 'schema: devkit\n' });
  addChange(t.addWt('old-wt'), 'foo', ['requirements'], { commit: false, flow: 2 });
  put(t.main, archivedFolder('2026-11-20', 'foo', 2));
  commitAll(t.main, 'archive foo');
  const b = body(main(['start', '--lang', 'en'], { cwd: t.main, env: cleanEnv, stdin: 'change foo', gh: archiveGh(['2026-11-20-foo']) }));
  assert.deepEqual([b.mode, b.change], ['resume', 'foo']);
  assert.equal(b.reply, render('en', 'resumed', { id: 'foo', where: render('en', 'where.archived') }));
  assert.deepEqual(b.unfinished, []);
});

// ---- field-fixes 2: a change begun under the previous script ends blocked, never at the grill (D-2)

test('field-fixes 2 change-loop: next on a headerless plan with a later headed evidence.md ends blocked, previous-script', () => {
  const root = planChange({ have: ['proposal', 'design', 'tasks'], headerless: true });
  put(root, { 'openspec/changes/feat/evidence.md': `${head('evidence', git(root, 'rev-parse', 'HEAD'))}# Evidence\n` });
  commitAll(root, 'evidence');
  const r = next(root);
  assert.equal(r.code, 2, r.stderr);
  const { action } = parsed(r);
  assert.deepEqual([action.end.state, action.end.why], ['blocked', 'previous-script']);
  assert.notEqual(action.kind, 'grill');
});

test('field-fixes 2 change-loop: next on the old devkit-lite form with no requirements.md ends blocked, previous-script', () => {
  const root = gitRepo({ config: 'schema: devkit-lite\n' });
  put(root, {
    'openspec/changes/feat/.openspec.yaml': 'schema: devkit-lite\n',
    'openspec/changes/feat/proposal.md': '# Proposal\n',
    'openspec/changes/feat/tasks.md': '# Tasks\n\n- [ ] 1.1 a\n',
    'openspec/changes/feat/evidence.md': `${head('evidence', 'none')}# Evidence\n`,
  });
  commitAll(root, 'old lite form');
  const r = next(root);
  assert.equal(r.code, 2, r.stderr);
  const { action } = parsed(r);
  assert.deepEqual([action.end.state, action.end.why], ['blocked', 'previous-script']);
  assert.notEqual(action.kind, 'grill');
});

// roadmap-coordinator: the request is read even when the writer of the pipe is slow (the read of an empty pipe waits, it does not give up).
const lateChild = (script, args, cwd, text, delayMs) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [script, ...args], { cwd, env: cleanEnv, stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '';
  child.stdout.on('data', (d) => { stdout += d; });
  child.on('error', reject);
  child.on('exit', (code) => resolve({ code, stdout }));
  setTimeout(() => child.stdin.end(text), delayMs);
});

test('change-loop start: a request written to the pipe after a delay is still read', async () => {
  const root = devkitRepo();
  const late = await lateChild(LOOP, ['start', '--lang', 'en'], root, 'change add a thing', 400);
  assert.equal(late.code, 0, late.stdout);
  assert.deepEqual(JSON.parse(late.stdout), JSON.parse(startRun(root, 'change add a thing').stdout), 'the same answer as for a request there from the start');
});

const lockDir = () => tmpFolder('devkit-lockfile-');

test('change-loop withLockFile: holds the lock while the work runs, stores the holder text, removes the lock after', () => {
  const lock = join(lockDir(), 'x.lock');
  const seen = withLockFile({ lock, stepMs: 1, waitMs: 5, staleMs: 1000, holder: 'me\n', timeout: () => new Error('late'), sleep: () => {} }, () => readFileSync(lock, 'utf8'));
  assert.equal(seen, 'me\n');
  assert.equal(existsSync(lock), false);
});

test('change-loop withLockFile: a held lock is waited for with the injected sleep, then the caller\'s error is thrown', () => {
  const lock = join(lockDir(), 'x.lock');
  writeFileSync(lock, 'other');
  const sleeps = [];
  class Late extends Error {}
  assert.throws(() => withLockFile({ lock, stepMs: 10, waitMs: 30, staleMs: 60_000, timeout: () => new Late('late'), sleep: (ms) => sleeps.push(ms) }, () => 'never'), Late);
  assert.deepEqual(sleeps, [10, 10, 10]);
  assert.equal(readFileSync(lock, 'utf8'), 'other', 'the other holder\'s lock is left alone');
});

test('change-loop withLockFile: a lock older than staleMs is taken over', () => {
  const lock = join(lockDir(), 'x.lock');
  writeFileSync(lock, 'old');
  const past = new Date(Date.now() - 5000);
  utimesSync(lock, past, past);
  assert.equal(withLockFile({ lock, stepMs: 1, waitMs: 5, staleMs: 1000, timeout: () => new Error('late'), sleep: () => {} }, () => 'ran'), 'ran');
  assert.equal(existsSync(lock), false);
});

// ---------------------------------------------------------------- stage-roles: the four agents, the skills, the verifier and the roles page

// { name, description, model, tools: [..], skills: [..], body } of an agent or skill file.
function assetOf(rel) {
  const text = readRepo(...rel.split('/'));
  const lines = frontmatterOf(text);
  const field = (k) => lines.find((l) => l.startsWith(`${k}:`))?.slice(k.length + 1).trim();
  return { name: field('name'), description: field('description'), model: field('model'), tools: (field('tools') ?? '').split(',').map((x) => x.trim()).filter(Boolean), skills: agentSkills(text), text, body: text.split('\n').slice(lines.length + 2).join('\n') };
}
const neverOf = (text) => (text.split('\n## Never\n')[1] ?? '').split('\n## ')[0];

const NEW_AGENTS = {
  'screen-designer': { model: 'sonnet', tools: ['Read', 'Glob', 'Grep', 'Bash', 'Write', 'Edit'], skills: ['screen-mockup'], outcome: 'Outcome: drawn | failure — <summary>', stage: 'mockup',
    never: [/product code/i, /image/i, /result=passed/] },
  'adr-author': { model: 'opus', tools: ['Read', 'Glob', 'Grep', 'Bash', 'Write', 'Edit'], skills: ['adr-authoring'], outcome: 'Outcome: proposed <n> | none-needed | failure — <summary>', stage: 'decisions',
    never: [/accepted record/i, /outside the ADR folder/i, /accepted/i] },
  'test-runner': { model: 'sonnet', tools: ['Read', 'Glob', 'Grep', 'Bash', 'Write'], skills: ['systematic-debugging', 'test-and-coverage'], outcome: 'Outcome: green | red | failure — <summary>', stage: 'unit-tests',
    never: [/unit-tests\.md/, /\| tail/, /\|\| true/] },
  'e2e-tester': { model: 'sonnet', tools: ['Read', 'Glob', 'Grep', 'Bash', 'Write', 'Edit'], skills: ['e2e-testing'], outcome: 'Outcome: green | red | failure — <summary>', stage: 'e2e-tests',
    never: [/product file/i, /test files of the change's diff/i, /weaken/i] },
};

for (const [role, want] of Object.entries(NEW_AGENTS)) {
  test(`stage-roles roles agent ${role}: frontmatter names its model, tools and skills`, () => {
    const a = assetOf(`plugins/core/agents/${role}.md`);
    assert.equal(a.name, role);
    assert.equal(a.model, want.model);
    assert.deepEqual(a.tools, want.tools);
    assert.deepEqual(a.skills, want.skills);
    assert.match(a.description, /\bUse when\b/);
  });

  test(`stage-roles roles agent ${role}: it returns its Outcome line and starts from the stage header rule`, () => {
    const a = assetOf(`plugins/core/agents/${role}.md`);
    assert.ok(a.text.includes(want.outcome), `${role} returns "${want.outcome}"`);
    assert.match(a.text, new RegExp(`<!-- devkit-stage ${want.stage} result=`));
    for (const h of ['## Receives', '## Method', '## Delivers', '## Returns', '## Never']) assert.ok(a.text.includes(h), `${role} has ${h}`);
  });

  test(`stage-roles roles agent ${role}: its Never list holds its limits`, () => {
    const never = neverOf(assetOf(`plugins/core/agents/${role}.md`).text);
    assert.ok(never.length > 0, `${role} has a Never list`);
    for (const re of want.never) assert.match(never, re, `${role} never: ${re}`);
  });
}

test('stage-roles roles agent: the test runner and the screen designer reserve failure for a job they could not do', () => {
  for (const role of ['test-runner', 'e2e-tester']) assert.match(assetOf(`plugins/core/agents/${role}.md`).text, /could not do the job|cannot start|missing input/i, role);
  assert.match(assetOf('plugins/core/agents/e2e-tester.md').text, /result=failed/, 'a red run is carried by the header');
});

test('stage-roles roles agent: the ADR author says what it does when the project\'s folder is not one it may write', () => {
  for (const f of ['plugins/core/agents/adr-author.md', 'plugins/core/skills/adr-authoring/SKILL.md']) {
    const text = assetOf(f).text;
    assert.match(text, /adr, adrs or decisions|`adr`, `adrs` or `decisions`/, `${f} names the three folders`);
    assert.match(text, /Outcome: failure/, `${f} fails naming the folder`);
    assert.match(text, /docs\/adr\//, `${f} creates docs/adr/ when the project has none`);
  }
});

const NEW_SKILLS = {
  'screen-mockup': [/mock\//, /lorem ipsum/i, /real example/i, /owner's notes/i, /self-contained/i],
  'adr-authoring': [/hard to reverse/i, /Status: proposed|status line/i, /Context, Decision, Consequences/, /amend|supersed/i, /not-applicable/],
  'e2e-testing': [/acceptance criteri/i, /declared command|declared E2E command/i, /criterion id/i, /not the diff's tests|without reading/i],
};
for (const [skill, pins] of Object.entries(NEW_SKILLS)) {
  test(`stage-roles roles skill ${skill}: its description says when to use it and its body holds the method`, () => {
    const a = assetOf(`plugins/core/skills/${skill}/SKILL.md`);
    assert.equal(a.name, skill);
    assert.match(a.description, /\bUse when\b/);
    for (const re of pins) assert.match(a.body, re, `${skill}: ${re}`);
  });
}

test('stage-roles roles verifier: pr-verifier records text, takes no screenshot and posts no pull-request comment', () => {
  const a = assetOf('plugins/core/agents/pr-verifier.md');
  assert.doesNotMatch(a.text.replace('Take a screenshot, keep an image or post a pull-request comment', ''), /screenshot/i, 'only the Never line names it');
  assert.doesNotMatch(a.description, /screenshot|comment on the PR/i);
  assert.doesNotMatch(a.text, /gh pr comment/);
  assert.match(a.text, /exercise each changed screen locally \(or on the PR's preview\) and record in text what it showed: the visible text, the state, the console errors/);
  assert.match(a.text, /Take a screenshot, keep an image or post a pull-request comment/);
  assert.doesNotMatch(a.body.split('## Returns')[1] ?? '', /PR comment/);
  assert.match(a.text, /what was done and what was observed/);
});

test('stage-roles roles planner: change-planner leaves the records to the ADR author', () => {
  assert.ok(assetOf('plugins/core/agents/change-planner.md').text.includes('On a script with a `decisions` stage, the records are the adr-author\'s: cite `decisions.md`; a decision found while planning that needs a record `decisions.md` lacks is an escalation, not a draft.'));
});

test('stage-roles roles reviewer: code-quality-reviewer asks for observed screen text, not a screenshot', () => {
  const text = assetOf('plugins/core/agents/code-quality-reviewer.md').text;
  assert.match(text, /observed screen text/);
  assert.doesNotMatch(text, /screenshot/i);
});

// The "## <role>" section of docs/roles.md as { Does, Delivers, Never, Stages, 'Played today by' }.
function roleSection(role) {
  const lines = readRepo('docs', 'roles.md').split('\n');
  const from = lines.indexOf(`## ${role}`);
  assert.ok(from >= 0, `docs/roles.md has "## ${role}"`);
  const out = {};
  for (const l of lines.slice(from + 1)) {
    if (l.startsWith('## ')) break;
    const m = /^- ([\w ]+): (.*)$/.exec(l);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

test('stage-roles roles page: the four roles are played by their agents', () => {
  for (const role of Object.keys(NEW_AGENTS)) assert.equal(roleSection(role)['Played today by'], `The agent \`devkit-core:${role}\`.`, role);
});

test('stage-roles roles page: the screen designer works only when the grill flags ui, delivers the mock/ files and the stage is devkit only', () => {
  const s = roleSection('screen-designer');
  assert.match(s.Does, /only when the grill flags `ui`/);
  assert.match(s.Delivers, /mock\//);
  assert.match(s.Stages, /`mockup`.*`devkit` only/);
});

test('stage-roles roles page: the test runner and the E2E tester do the work the design says', () => {
  assert.match(roleSection('test-runner').Does, /^Runs the whole unit suite and the coverage command the project declares and records the result/);
  assert.match(roleSection('e2e-tester').Does, /^Writes the E2E tests from the acceptance criteria, apart from the implementer, runs them and records the result/);
});

test('stage-roles roles page: the verifier delivers its evidence as text, with no image', () => {
  assert.match(roleSection('pr-verifier').Delivers, /as text, with no image/);
});

// ---------------------------------------------------------------- stage-roles: the loop (design D-4, D-5; tasks 2.1 to 2.4)

const SCREEN = 'devkit-core:screen-designer';
const ADR_AUTHOR = 'devkit-core:adr-author';
const TEST_RUNNER = 'devkit-core:test-runner';
const E2E_TESTER = 'devkit-core:e2e-tester';
const TESTS = { unit: 'npm test', e2e: 'npm run e2e', coverage: { command: 'npm run cov', target: 80 } };
const planNext = (stage, reasonCode, params = {}) => ({ rep: { next: nextOf(FLOWS.devkit, stage, reasonCode, params), stages: { [stage]: { state: 'pending', reasonCode } } } });

test('stage-roles loop: the mock-up and the decisions are handed to their own roles, each naming its instructions', () => {
  for (const [stage, agent, role] of [['mockup', SCREEN, 'screen-designer'], ['decisions', ADR_AUTHOR, 'adr-author']]) {
    const a = run(planNext(stage, 'no-file'));
    assert.deepEqual([a.kind, a.agent, a.stage, a.role, exitCodeOf(a)], ['agent', agent, stage, role, 0], stage);
    assert.ok(a.brief.includes(`openspec instructions ${stage} --change feat`), a.brief);
    assert.doesNotMatch(a.brief, /write the plan files the script still lacks/, 'the planner text is the planner\'s alone');
    assert.equal(a.progressKey, `${stage}/${stage}@abc123`);
  }
});

test('stage-roles loop: a stale mock-up or decisions file is brought up to date by its own role', () => {
  for (const [stage, agent] of [['mockup', SCREEN], ['decisions', ADR_AUTHOR]]) {
    for (const reason of ['stale-plan', 'rerun-after-fix']) {
      const a = run(planNext(stage, reason, { by: 'requirements', stage }));
      assert.equal(a.agent, agent, `${stage} ${reason}`);
      assert.match(a.brief, new RegExp(`${stage} is out of date: bring it up to date`));
    }
  }
});

test('stage-roles loop: the planner and the readiness reviewer keep their own texts', () => {
  assert.match(run(planNext('proposal', 'no-file')).brief, /write the plan files the script still lacks, from proposal on/);
  assert.match(run(planNext('readiness', 'no-file')).brief, /review the plan/);
});

test('stage-roles loop: waiting-mockup the drawn mock-up ends waiting for the owner, naming its folder and file', () => {
  const a = run({ rep: { end: endOf('waiting-for-owner', 'mockup', 'owner-pending'), stages: { mockup: { state: 'pending', reasonCode: 'not-judged' } } } });
  assert.deepEqual(shape(a), ['end', 'waiting-for-owner', 'waiting-mockup', 1]);
  assert.equal(a.reply, says('waiting-mockup'));
  assert.deepEqual([a.stage, a.role], ['mockup', 'screen-designer']);
  assert.deepEqual(a.detail, { file: 'openspec/changes/feat/mockup.md', folder: 'openspec/changes/feat/mock/' });
  assert.ok(a.reply.includes('feat'), 'it names the change');
});

test('stage-roles loop: waiting-mockup is said in both languages without an internal term', () => {
  for (const lang of ['en', 'pt-BR']) {
    for (const key of ['waiting-mockup', 'gate.mockup', 'blocked-why.cannot-accept', 'setting.coverage-target']) {
      assert.ok(MESSAGES[lang][key], `${lang} has ${key}`);
    }
    const text = render(lang, 'waiting-mockup', { id: 'feat' });
    assert.ok(text.includes('feat') && !/mockup|\.md|screen-designer/.test(text), text);
  }
  assert.equal(render('en', 'gate.mockup'), 'your approval of the mock-up');
  assert.equal(render('pt-BR', 'gate.mockup'), 'a sua aprovação do mock-up');
  assert.match(render('en', 'blocked', { id: 'feat', why: 'cannot-accept', error: 'no approval' }), /decision records could not be marked accepted \(no approval\)/);
  assert.match(render('pt-BR', 'blocked', { id: 'feat', why: 'cannot-accept', error: 'sem aprovação' }), /registros de decisão como aceitos \(sem aprovação\)/);
  assert.equal(render('en', 'setting-unknown', { setting: 'coverage-target', value: '80%', accepted: 'x' }).includes('coverage target'), true);
  assert.equal(render('pt-BR', 'setting-unknown', { setting: 'coverage-target', value: '80%', accepted: 'x' }).includes('meta de cobertura'), true);
});

test('stage-roles loop: owner-changes the owner asked for changes, the mock-up goes back to its designer naming the next attempt', () => {
  const a = run({ rep: { next: nextOf(FLOWS.devkit, 'mockup', 'owner-changes', { stage: 'mockup', attempt: 1 }), stages: { mockup: { state: 'failed', reasonCode: 'changes-asked' } } } });
  assert.deepEqual([a.kind, a.agent, a.stage, exitCodeOf(a)], ['agent', SCREEN, 'mockup', 0]);
  assert.match(a.brief, /the owner asked for changes at attempt 1: redraw from the owner's notes in mockup\.md as attempt 2/);
  const third = run({ rep: { next: nextOf(FLOWS.devkit, 'mockup', 'owner-changes', { stage: 'mockup', attempt: 3 }), stages: { mockup: { state: 'failed', reasonCode: 'changes-asked' } } } });
  assert.match(third.brief, /attempt 3: redraw .* as attempt 4/);
});

test('stage-roles loop: the unit tests are handed to the test runner whatever step the delivery checker would give, with the declared commands', () => {
  for (const reason of ['no-file', 'stale-code', 'rerun-after-fix', 'not-judged']) {
    for (const step of ['commit', 'implement', 'verify', 'wait-checks']) {
      const a = run({ rep: { next: nextOf(FLOWS.devkit, 'unit-tests', reason, { stage: 'unit-tests' }) }, facts: { row: rowOf(step), tests: TESTS } });
      assert.deepEqual([a.kind, a.agent, a.step, a.stage, a.role], ['agent', TEST_RUNNER, 'unit-tests', 'unit-tests', 'test-runner'], `${reason} ${step}`);
      assert.deepEqual(a.detail, { unit: 'npm test', coverage: { command: 'npm run cov', target: 80 } });
      if (['no-file', 'not-judged'].includes(reason)) assert.ok(a.brief.includes('openspec instructions unit-tests --change feat'), a.brief);
      assert.equal(a.progressKey, 'unit-tests/unit-tests@abc123');
    }
  }
  const stale = run({ rep: { next: nextOf(FLOWS.devkit, 'unit-tests', 'stale-code', { why: 'x' }) }, facts: { row: rowOf('commit'), tests: TESTS } });
  assert.match(stale.brief, /the work changed since the last run: run it again/);
  const none = run({ rep: { next: nextOf(FLOWS.devkit, 'unit-tests', 'no-file') }, facts: { row: null, tests: { ...TESTS, coverage: { command: null, target: null } } } });
  assert.deepEqual(none.detail, { unit: 'npm test', coverage: { command: null, target: null } }, 'no row is read for a test stage, and no coverage is declared');
});

test('stage-roles loop: the E2E tests are handed to the E2E tester with the declared command', () => {
  const a = run({ rep: { next: nextOf(FLOWS.devkit, 'e2e-tests', 'no-file') }, facts: { row: rowOf('commit'), tests: TESTS } });
  assert.deepEqual([a.kind, a.agent, a.step, a.stage, a.role], ['agent', E2E_TESTER, 'e2e-tests', 'e2e-tests', 'e2e-tester']);
  assert.deepEqual(a.detail, { e2e: 'npm run e2e' });
  assert.ok(a.brief.includes('openspec instructions e2e-tests --change feat'));
});

test('stage-roles loop: fix-tests a red test stage goes back to the implementer, naming the failed stage and its file', () => {
  for (const [failed, file] of [['unit-tests', 'unit-tests.md'], ['e2e-tests', 'e2e-tests.md']]) {
    const a = run({ rep: { next: nextOf(FLOWS.devkit, 'implementation', 'fix-after-failure', { failed, attempt: 2, ceiling: 3 }) }, facts: { row: rowOf('commit'), tests: TESTS } });
    assert.deepEqual([a.kind, a.agent, a.step, a.stage, a.role, exitCodeOf(a)], ['agent', TDD, 'fix-tests', 'implementation', 'tdd-implementer', 0], failed);
    assert.deepEqual(a.detail, { failed, file });
    assert.match(a.brief, new RegExp(`${failed} failed at attempt 2 of 3: fix the code from ${file}, test first, within the approved tasks`));
    assert.equal(a.progressKey, 'implementation/fix-tests@abc123');
  }
});

test('stage-roles loop: fix-tests is not the step for an evidence or a review failure, which follow the delivery checker\'s row', () => {
  for (const failed of ['evidence', 'review']) {
    const a = run({ rep: { next: nextOf(FLOWS.devkit, 'implementation', 'fix-after-failure', { failed, attempt: 1, ceiling: 3 }) }, facts: { row: rowOf('fix-review'), tests: TESTS } });
    assert.equal(a.step, 'fix-review', failed);
  }
  const rows = ROW_STEPS;
  assert.ok(!rows.includes('fix-tests') && !rows.includes('unit-tests') && !rows.includes('e2e-tests'), 'neither step is a row of the delivery checker');
});

test('stage-roles loop: the loop\'s own hand-offs of the test stages carry a role the packs know', () => {
  for (const role of ['screen-designer', 'adr-author', 'test-runner', 'e2e-tester']) assert.equal(PACKS[role], 'devkit-core', role);
});

// The plan of change `feat` approved (a current approval.md), with the records `adrs` written in the repository.
const ADR_FOLDER = 'docs/adr';
const adrRecord = (status, extra = '') => `# ADR 9: x\n\n${status}\n\n## Context\n\nc\n${extra}`;
function adrChange({ approval = 'current', records = {}, listed = Object.keys(records), extra = {}, date = '2026-11-22' } = {}) {
  const root = gitRepo({ config: 'schema: devkit\n' });
  const dir = 'openspec/changes/feat';
  const files = {
    [`${dir}/.openspec.yaml`]: 'schema: devkit\n',
    [`${dir}/readiness.md`]: '# Readiness\n\n- Status: APPROVED\n',
    [`${dir}/decisions.md`]: `<!-- devkit-stage decisions result=passed attempt=1 commit=none -->\n# Decisions\n\n${listed.map((p) => `- ADR: \`${p}\` — a record`).join('\n')}\n`,
    ...Object.fromEntries(Object.entries(records).map(([p, body]) => [p, body])),
    ...extra,
  };
  put(root, files);
  if (approval !== 'none') {
    const hash = approval === 'current' ? approvalState(join(root, dir)).readiness : 'sha256:000000000000';
    put(root, { [`${dir}/approval.md`]: `<!-- devkit-stage approval result=passed attempt=1 commit=none -->\n# Plan approval: feat\n\n- Status: APPROVED\n- Readiness: ${hash}\n- Date: ${date}\n- Owner's words: "go"\n` });
  }
  return root;
}
const accept = (root, extra = []) => main(['accept-decisions', 'feat', '--lang', 'en', ...extra], { cwd: root, env: cleanEnv });
const treeOf = (root) => {
  const out = {};
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.name === '.git') continue;
      if (e.isDirectory()) walk(join(d, e.name)); else out[join(d, e.name).slice(root.length)] = readFileSync(join(d, e.name), 'utf8');
    }
  };
  walk(root);
  return JSON.stringify(out);
};
const refused = (root, why) => {
  const before = treeOf(root);
  const r = accept(root);
  assert.equal(r.code, 3, `${why}: ${r.stdout}`);
  const b = JSON.parse(r.stdout);
  assert.equal(b.version, 1);
  assert.equal(b.reply, render('en', 'blocked', { id: 'feat', why: 'cannot-accept', error: b.error }), why);
  assert.equal(treeOf(root), before, `${why}: a refusal changes no file`);
  return b;
};

test('stage-roles loop: accept-decisions sets every proposed record accepted with the approval\'s date, and says what it did', () => {
  const root = adrChange({ records: { [`${ADR_FOLDER}/0001-a.md`]: adrRecord('Status: proposed'), [`${ADR_FOLDER}/0002-b.md`]: adrRecord('- Status: Proposed') } });
  const r = accept(root);
  assert.equal(r.code, 0, r.stdout);
  assert.deepEqual(JSON.parse(r.stdout), { version: 1, change: 'feat', accepted: [`${ADR_FOLDER}/0001-a.md`, `${ADR_FOLDER}/0002-b.md`], already: [] });
  const by = 'Accepted by: the owner, on 2026-11-22, in the approval of the plan of change feat (openspec/changes/feat/approval.md)';
  assert.match(readFileSync(join(root, ADR_FOLDER, '0001-a.md'), 'utf8'), new RegExp(`\\nStatus: accepted\\nStatus: ${by.replace(/[()/.]/g, '\\$&')}\\n`));
  assert.match(readFileSync(join(root, ADR_FOLDER, '0002-b.md'), 'utf8'), new RegExp(`\\n- Status: Accepted\\n- ${by.replace(/[()/.]/g, '\\$&')}\\n`));
});

test('stage-roles loop: accept-decisions keeps the letter case and the prefix of the status line', () => {
  const root = adrChange({ records: {
    [`${ADR_FOLDER}/a.md`]: adrRecord('Status: PROPOSED'),
    [`${ADR_FOLDER}/b.md`]: adrRecord('  * **Status:** Proposed — pending'),
    [`${ADR_FOLDER}/c.md`]: adrRecord('  - Status: PROPOSED'),
    [`${ADR_FOLDER}/d.md`]: adrRecord('* Status: proposed'),
  } });
  assert.equal(accept(root).code, 0);
  const a = readFileSync(join(root, ADR_FOLDER, 'a.md'), 'utf8');
  assert.match(a, /\nStatus: ACCEPTED\nStatus: Accepted by: the owner, on 2026-11-22/);
  const b = readFileSync(join(root, ADR_FOLDER, 'b.md'), 'utf8');
  assert.match(b, /\n {2}\* \*\*Status:\*\* Accepted — pending\n {2}\* \*\*Status:\*\* Accepted by: the owner, on 2026-11-22/);
  const c = readFileSync(join(root, ADR_FOLDER, 'c.md'), 'utf8');
  assert.match(c, /\n {2}- Status: ACCEPTED\n {2}- Accepted by: the owner, on 2026-11-22/, 'a bulleted Status line gets a bulleted Accepted by line, not a second Status label');
  assert.doesNotMatch(c, /Status: Accepted by/);
  const d = readFileSync(join(root, ADR_FOLDER, 'd.md'), 'utf8');
  assert.match(d, /\n\* Status: accepted\n\* Accepted by: the owner, on 2026-11-22/);
});

test('stage-roles loop: accept-decisions leaves an accepted record alone and lists it as already accepted', () => {
  const root = adrChange({ records: { [`${ADR_FOLDER}/a.md`]: adrRecord('Status: accepted'), [`${ADR_FOLDER}/b.md`]: adrRecord('Status: proposed') } });
  const before = readFileSync(join(root, ADR_FOLDER, 'a.md'), 'utf8');
  const r = accept(root);
  assert.equal(r.code, 0, r.stdout);
  assert.deepEqual(JSON.parse(r.stdout), { version: 1, change: 'feat', accepted: [`${ADR_FOLDER}/b.md`], already: [`${ADR_FOLDER}/a.md`] });
  assert.equal(readFileSync(join(root, ADR_FOLDER, 'a.md'), 'utf8'), before);
  const again = accept(root);
  assert.deepEqual(JSON.parse(again.stdout).accepted, [], 'a second run has nothing left');
  assert.equal(readFileSync(join(root, ADR_FOLDER, 'b.md'), 'utf8').match(/Accepted by/g).length, 1, 'the line is written once');
});

test('stage-roles loop: accept-decisions with no listed record succeeds and writes nothing', () => {
  const root = adrChange({ records: {}, listed: [] });
  const before = treeOf(root);
  const r = accept(root);
  assert.equal(r.code, 0, r.stdout);
  assert.deepEqual(JSON.parse(r.stdout), { version: 1, change: 'feat', accepted: [], already: [] });
  assert.equal(treeOf(root), before);
});

test('stage-roles loop: accept-decisions refuses while the approval is missing, naming it, and changes nothing', () => {
  const root = adrChange({ approval: 'none', records: { [`${ADR_FOLDER}/a.md`]: adrRecord('Status: proposed') } });
  assert.match(refused(root, 'no approval').error, /approval/);
  assert.match(readFileSync(join(root, ADR_FOLDER, 'a.md'), 'utf8'), /Status: proposed/);
});

test('stage-roles loop: accept-decisions refuses an approval of an earlier readiness', () => {
  const root = adrChange({ approval: 'earlier', records: { [`${ADR_FOLDER}/a.md`]: adrRecord('Status: proposed') } });
  assert.match(refused(root, 'earlier approval').error, /approval/);
});

test('stage-roles loop: accept-decisions refuses a path outside the repository, an absolute one and a file that does not exist', () => {
  const rec = { [`${ADR_FOLDER}/a.md`]: adrRecord('Status: proposed') };
  assert.match(refused(adrChange({ records: rec, listed: [`${ADR_FOLDER}/a.md`, '../outside/adr/x.md'] }), 'outside').error, /outside\/adr\/x\.md/);
  assert.match(refused(adrChange({ records: rec, listed: [`${ADR_FOLDER}/a.md`, '/etc/adr/x.md'] }), 'absolute').error, /\/etc\/adr\/x\.md/);
  assert.match(refused(adrChange({ records: rec, listed: [`${ADR_FOLDER}/a.md`, `${ADR_FOLDER}/missing.md`] }), 'missing').error, /missing\.md/);
});

test('stage-roles loop: accept-decisions refuses a listed record that is a symlink to a file outside the repository, and leaves the target alone', () => {
  const outside = tmpFolder('devkit-adr-outside-');
  const target = join(outside, 'x.md');
  writeFileSync(target, adrRecord('Status: proposed'));
  const root = adrChange({ records: {}, listed: [`${ADR_FOLDER}/x.md`] });
  mkdirSync(join(root, ADR_FOLDER), { recursive: true });
  symlinkSync(target, join(root, ADR_FOLDER, 'x.md'));
  const before = readFileSync(target, 'utf8');
  const r = accept(root);
  assert.equal(r.code, 3, r.stdout);
  assert.match(JSON.parse(r.stdout).error, /docs\/adr\/x\.md/);
  assert.equal(readFileSync(target, 'utf8'), before, 'the file outside the repository is not rewritten');
  rmSync(outside, { recursive: true, force: true });
});

test('stage-roles loop: accept-decisions refuses a file that is not Markdown and a folder that is not an ADR folder', () => {
  assert.match(refused(adrChange({ records: { [`${ADR_FOLDER}/a.txt`]: adrRecord('Status: proposed') } }), 'not md').error, /a\.txt/);
  assert.match(refused(adrChange({ records: { 'src/a.md': adrRecord('Status: proposed') } }), 'no adr folder').error, /src\/a\.md/);
  for (const folder of ['adrs', 'decisions', 'ADR']) {
    const root = adrChange({ records: { [`docs/${folder}/a.md`]: adrRecord('Status: proposed') } });
    assert.equal(accept(root).code, 0, folder);
  }
});

test('stage-roles loop: accept-decisions refuses a record with no status line or a status that is neither proposed nor accepted', () => {
  assert.match(refused(adrChange({ records: { [`${ADR_FOLDER}/a.md`]: '# ADR\n\nno status here\n' } }), 'no status').error, /a\.md/);
  assert.match(refused(adrChange({ records: { [`${ADR_FOLDER}/a.md`]: adrRecord('Status: superseded') } }), 'superseded').error, /a\.md/);
});

test('stage-roles loop: accept-decisions with a good record and a bad one changes neither (every check runs before a write)', () => {
  const root = adrChange({ records: { [`${ADR_FOLDER}/a.md`]: adrRecord('Status: proposed'), [`${ADR_FOLDER}/b.md`]: adrRecord('Status: superseded') } });
  refused(root, 'mixed good and bad');
  assert.match(readFileSync(join(root, ADR_FOLDER, 'a.md'), 'utf8'), /Status: proposed\n/);
});

test('stage-roles loop: accept-decisions names itself in the usage line and needs a change id', () => {
  const r = main(['accept-decisions', '--lang', 'en'], { cwd: tmpFolder('devkit-loop-nocwd-'), env: cleanEnv });
  assert.equal(r.code, 3);
  assert.match(JSON.parse(r.stdout).error, /accept-decisions <id>/);
  assert.match(read('change-loop.mjs'), /accept-decisions <id> --lang/);
});

const APPROVED = { status: 'APPROVED', recorded: 'sha256:abcdef012345', readiness: 'sha256:abcdef012345', ok: true };
const DEC = (over = {}) => ({ listed: [`${ADR_FOLDER}/a.md`], proposed: [`${ADR_FOLDER}/a.md`], unreadable: [], ...over });
const afterApproval = (facts) => run({ rep: { next: nextOf(FLOWS.devkit, 'implementation', 'tasks-pending', { count: 1, ids: ['1.1'] }) }, facts: { row: rowOf('implement'), approval: APPROVED, decisions: DEC(), ...facts } });

test('stage-roles loop: the accept-decisions step comes with a current approval and a proposed record, carrying its command', () => {
  const a = afterApproval({});
  assert.deepEqual([a.kind, a.step, a.stage, exitCodeOf(a)], ['session', 'accept-decisions', 'approval', 0]);
  assert.deepEqual(a.detail.command, ['node', join(HOOKS_DIR, 'change-loop.mjs'), 'accept-decisions', 'feat', '--lang', 'en']);
  assert.deepEqual(a.detail.records, [`${ADR_FOLDER}/a.md`]);
  assert.equal(a.progressKey, 'approval/accept-decisions@abc123');
});

test('stage-roles loop: the accept-decisions step is also taken for a record the loop could not read, so the command can refuse it by name', () => {
  const a = afterApproval({ decisions: DEC({ proposed: [], unreadable: [{ path: `${ADR_FOLDER}/b.md`, why: 'no status line' }] }) });
  assert.equal(a.step, 'accept-decisions');
  assert.deepEqual(a.detail.records, [`${ADR_FOLDER}/b.md`]);
});

test('stage-roles loop: no accept-decisions step while the approval is not current, with nothing proposed, or with no records', () => {
  for (const [label, facts] of [
    ['no approval', { approval: { ...APPROVED, ok: false, status: null, recorded: null } }],
    ['an earlier approval', { approval: { ...APPROVED, ok: false, recorded: 'sha256:111111111111' } }],
    ['every record accepted', { decisions: DEC({ proposed: [] }) }],
    ['no record listed', { decisions: DEC({ listed: [], proposed: [] }) }],
    ['no facts of the records', { decisions: undefined }],
  ]) {
    assert.equal(afterApproval(facts).step, 'implement', label);
  }
});

test('stage-roles loop: no accept-decisions step on the archive branch, even with a current approval and a proposed record', () => {
  const a = afterApproval({ archiving: true });
  assert.notEqual(a.step, 'accept-decisions');
  assert.equal(a.detail?.command, undefined);
});

test('stage-roles loop: after accept-decisions the next call offers the implementation (a record accepted is no longer proposed)', () => {
  const root = adrChange({ records: { [`${ADR_FOLDER}/a.md`]: adrRecord('Status: proposed') } });
  const before = next(root);
  const a1 = actionOf(before.stdout);
  assert.equal(a1.step, 'accept-decisions', before.stdout);
  assert.equal(accept(root).code, 0);
  const a2 = actionOf(next(root).stdout);
  assert.notEqual(a2.step, 'accept-decisions');
});

test('stage-roles loop: setting-unknown a coverage target that is not a whole number from 0 to 100 stops the command like any unknown setting', () => {
  for (const target of ['80%', '101', 'high', '-1']) {
    const root = devkitRepo(`schema: devkit\ndevkit:\n  tests:\n    unit: "npm test"\n    coverage:\n      command: "npm run cov"\n      target: ${target}\n`);
    const s = readDevkitSettings(root);
    assert.deepEqual(s.unknown.map((u) => [u.setting, u.value]), [['coverage-target', target]], target);
    const b = body(startRun(root, 'change add an export'));
    assert.equal(b.mode, 'setting-unknown', target);
    assert.equal(b.reply, render('en', 'setting-unknown', { setting: 'coverage-target', value: target, accepted: 'a whole number from 0 to 100' }));
    assert.ok(b.reply.includes('coverage target'));
  }
  const good = devkitRepo('schema: devkit\ndevkit:\n  tests:\n    coverage:\n      target: 80\n  driver: claude\n');
  assert.deepEqual(readDevkitSettings(good), { driver: 'claude', language: 'en', unknown: [] });
});

test('stage-roles loop: the nested test keys do not disturb the driver and the language', () => {
  const s = readDevkitSettings(configRepo('devkit:\n  language: pt-BR\n  tests:\n    unit: "npm test"\n    e2e: "npm run e2e"\n  driver: claude\n'));
  assert.deepEqual(s, { driver: 'claude', language: 'pt-BR', unknown: [] });
});

test('stage-roles loop: a screen designer that stops before redrawing is refused once, like any stage agent that has not delivered', () => {
  const root = planChange({ have: ['requirements', 'decisions'] });
  const c0 = git(root, 'rev-parse', 'HEAD');
  put(root, {
    'openspec/changes/feat/requirements.md': `${head('requirements', c0)}# requirements\n\nClassification: devkit; flags=[ui]\n`,
    'openspec/changes/feat/mockup.md': `${head('mockup', c0, 'failed', 1)}# Mock-up\n`,
  });
  commitAll(root, 'the owner asked for changes');
  const tmp = sandbox();
  const first = hook('subagent-stop', subInput(root, runTranscript(), 'screen-designer'), { TMPDIR: tmp });
  assert.equal(first.code, 2, first.err);
  assert.match(first.err, /mockup\.md/);
  assert.equal(hook('subagent-stop', subInput(root, runTranscript(), 'screen-designer'), { TMPDIR: tmp }).code, 0, 'the same state a second time is let through');
});

test('stage-roles loop: the loop hands a mock-up of a change with a screen to its designer, read from the files', () => {
  const root = planChange({ have: ['requirements'] });
  const c0 = git(root, 'rev-parse', 'HEAD');
  put(root, { 'openspec/changes/feat/requirements.md': `${head('requirements', c0)}# requirements\n\nClassification: devkit; flags=[ui]\n` });
  commitAll(root, 'a screen');
  const a = actionOf(next(root).stdout);
  assert.deepEqual([a.kind, a.agent, a.stage], ['agent', SCREEN, 'mockup']);
  const plain = planChange({ have: ['requirements'] });
  const b = actionOf(next(plain).stdout);
  assert.deepEqual([b.kind, b.agent, b.stage], ['agent', ADR_AUTHOR, 'decisions'], 'no ui flag: no mock-up, the decisions come first');
});

// ---------------------------------------------------------------- stage-roles docs (phase 4: D-9, D-12)

test('stage-roles docs: the design page marks stages 3, 4, 9, 10 and 11 of its table built in round 16', () => {
  const rows = readRepo('docs', 'coordination-design.md').split('\n');
  for (const n of [3, 4, 9, 10, 11]) {
    const row = rows.find((l) => l.startsWith(`| ${n} | `));
    assert.ok(row, `row ${n} of the stage table exists`);
    assert.match(row, /\(built, round 16\)/, `row ${n} says built, round 16`);
    assert.doesNotMatch(row, /\(new\)/, `row ${n} no longer says new`);
  }
  assert.match(rows.find((l) => l.startsWith('| 8 | ')), /`tdd-implementer`/, 'the other rows are untouched');
});

test('stage-roles docs: the design page records the test settings among the configuration field names', () => {
  const design = readRepo('docs', 'coordination-design.md');
  const a = design.indexOf("**The configuration's field names.");
  const b = design.indexOf('**The header', a);
  const part = design.slice(a, b).replace(/\s+/g, ' ');
  assert.match(part, /Decided by `stage-roles` on 2026-11-21: `devkit\.tests\.unit`, `devkit\.tests\.coverage\.command`, `devkit\.tests\.coverage\.target`, `devkit\.tests\.e2e`/);
  assert.match(design, /coverage:\s*\n\s+command:/, 'the example configuration gains the coverage lines');
  assert.match(design, /screen-designer[^\n]*\bdraws\b|\bdraws\b[^\n]*screen-designer/, 'the mock-up paragraph says the screen designer draws it');
  assert.match(design.slice(design.indexOf('Tense:'), design.indexOf('Tense:') + 2400), /stage-roles/, 'the Tense paragraph lists what exists since stage-roles');
});

test('stage-roles docs: ADR 0016 has its headings, its status and the owner\'s approval of the plan', () => {
  const adr = readRepo('docs', 'adr', '0016-stage-roles-write-their-own-files.md');
  assert.equal(adr.split('\n')[0], '# ADR 0016: Stage roles write their own files, and a stage that does not apply may leave none');
  for (const h of ['## Context', '## Decision', '## Consequences', '### Review trigger', '## Alternatives considered']) {
    assert.ok(adr.split('\n').includes(h), `ADR 0016 has ${h}`);
  }
  assert.match(adr, /^- Status: accepted$/m);
  assert.match(adr, /^- Change: stage-roles$/m);
  assert.match(adr, /^- Amends: ADR 0010 \(0010-openspec-as-the-harness\.md\)[^\n]*ADR 0011 \(0011-the-change-coordinator-is-the-owners-session\.md\), decision 3$/m);
  // The change folder moves to openspec/changes/archive/<date>-stage-roles/ when the change is archived.
  const changesDir = join(REPO_ROOT, 'openspec', 'changes');
  const archived = existsSync(join(changesDir, 'archive')) ? readdirSync(join(changesDir, 'archive')).filter((d) => /^\d{4}-\d{2}-\d{2}-stage-roles$/.test(d)).sort() : [];
  const approvalPath = existsSync(join(changesDir, 'stage-roles', 'approval.md')) ? join(changesDir, 'stage-roles', 'approval.md') : join(changesDir, 'archive', archived[archived.length - 1] ?? '', 'approval.md');
  const approval = readFileSync(approvalPath, 'utf8');
  const date = approval.match(/^- Date: (\d{4}-\d{2}-\d{2})$/m)?.[1];
  const words = approval.match(/^- Owner's words: "(.+)"$/m)?.[1];
  assert.ok(date && words, 'approval.md has its date and the owner\'s words');
  assert.match(adr, new RegExp(`^- Accepted by: the owner, on ${date}, in the message that approved the plan of the change: \`${words}\`; recorded in \`openspec/changes/stage-roles/approval\\.md\`$`, 'm'));
});

test('stage-roles docs: ADR 0010 and ADR 0011 name ADR 0016 in a header line and a dated Note', () => {
  const line = '- Amended by ADR 0016 (0016-stage-roles-write-their-own-files.md)';
  for (const f of ['0010-openspec-as-the-harness.md', '0011-the-change-coordinator-is-the-owners-session.md']) {
    const adr = readRepo('docs', 'adr', f);
    assert.ok(adr.split('\n').slice(0, 8).includes(line), `${f} has the Amended by line in its header`);
    assert.match(adr, /^- Status: accepted$/m, `${f} stays accepted`);
    assert.match(adr, /Note \(stage-roles, 2026-11-21\):[^\n]*(\n[^\n]+)*?\[ADR 0016\]\(0016-stage-roles-write-their-own-files\.md\)/, `${f} has the dated Note linking ADR 0016`);
  }
  const flat10 = readRepo('docs', 'adr', '0010-openspec-as-the-harness.md').replace(/\s+/g, ' ');
  assert.match(flat10, /Note \(stage-roles, 2026-11-21\): the roles of D-4 stages 3, 4, 9 and 10 ship and stage 11 is recorded as text\./);
  assert.match(flat10, /\(decision 1, round 16\)\. Decisions 1 to 8 are otherwise unchanged\./);
  assert.match(readRepo('docs', 'adr', '0011-the-change-coordinator-is-the-owners-session.md'), /decision 2's refusal of the session's product edits is unchanged/);
  const adrs = readRepo('openspec', 'config.yaml').split('\n').find((l) => l.trim().startsWith('ADRs:'));
  assert.match(adrs, /0016 stage roles write their own files, amends 0010 and 0011/, 'the ADRs line of config.yaml names 0016');
});

// The roadmap line of stage-roles as commit 2300f84 had it, before the carried items moved. It is a
// literal, not a `git show`, because CI checks out with depth 1 and the history is not there.
const STAGE_ROLES_LINE_AT_2300F84 = "- [ ] stage-roles (after: change-coordinator) — the ADR author, the unit-test suite, the E2E tester, the screen designer and the demonstration recorded as text in the change (D-4 stages 3, 4, 9, 10, 11) Carried from the change-coordinator retro for its grill, as the first real use of /devkit change: a declared end for a pause the owner asks for and for a decision outside the script's gates; the end marker's id compared with the run's change; the skill's resolve-release-conflict item naming the declared end; the loop's fallback agent map tied to the pack table; a dated Note on ADR 0011 for the stop lock after a recorded end; the person's language checked with the installed plugin when it was never set; the unlimited wait on GitHub proved in real use; whether a change that creates the project's first spec may run on the short script; and whether the short script gains the owner's plan approval. Carried from the coordinator-field-fixes retro: a declared step for a review round the owner authorizes after the limit (the round script accepts a third round and the loop leaves `blocked` without a header set by hand); a plan file revised after the implementation started makes the readiness review and the approval stale; and the review's open nits of that change (the archive sources worded as a fallback chain in the change-coordination spec while the code takes their union, exit 1 of `github-setup` for a blocked state stated in a scenario, a test for an unreadable `.openspec.yaml`). Carried from the roadmap-coordinator retro, the first whole change run with /devkit change: a declared step for a small fix after a red gate, in place of a run that ends blocked; a way for a task to say that the conducting session does it, so the loop does not hand it to the implementer; how the wait on GitHub lives with a host that has its own pull-request monitor and forbids polling, so that the session still goes on alone when the checks pass; and the verifier allowed to write its runs' output under the change's `proof/` folder.";

test('stage-roles docs: the roadmap line of stage-roles keeps its text, and every carried item moved to coordinator-loop-fixes', () => {
  const itemOf = (rounds, id) => rounds.flatMap((r) => r.items).find((i) => i.id === id);
  const before = itemOf(guardModule.parseRoadmap(`## Round 16: the new stage roles\n${STAGE_ROLES_LINE_AT_2300F84}\n`), 'stage-roles');
  const rounds = guardModule.parseRoadmap(readRepo('openspec', 'roadmap.md'));
  const stage = itemOf(rounds, 'stage-roles');
  const fixes = itemOf(rounds, 'coordinator-loop-fixes');
  assert.ok(before && stage && fixes, 'both lines exist');
  const cut = before.text.indexOf(' Carried from');
  assert.ok(cut > 0, 'the line as it was at 2300f84 holds the carried text');
  const carried = before.text.slice(cut).trim();
  assert.equal(stage.text, before.text.slice(0, cut), 'the stage-roles line keeps the text before the carried items');
  assert.doesNotMatch(stage.text + stage.notes, /Carried from/, 'the stage-roles line holds none of them');
  assert.deepEqual(stage.after, ['change-coordinator']);
  assert.deepEqual(fixes.after, ['stage-roles']);
  const sentences = carried.split(/(?<=\.)\s+(?=[A-Z])/).map((s) => s.trim());
  assert.ok(sentences.length >= 3, 'the carried text has its sentences');
  for (const s of sentences) assert.ok(fixes.text.includes(s), `coordinator-loop-fixes holds: ${s.slice(0, 60)}`);
  assert.ok(fixes.text.includes(carried), 'the carried text is copied verbatim');
  const round = rounds.find((r) => r.items.includes(fixes));
  assert.equal(round.title, 'Round 16b: the coordinator loop fixes');
  assert.equal(rounds[rounds.indexOf(round) - 1].items.includes(stage), true, 'round 16b follows the round of stage-roles');
});

// ================================================================ roadmap-coordinator-followups: phase 1 (the lock of open, the single read)

test('followups AC-10 open lock: open on a held open lock fails with its own message and creates nothing', () => {
  const t = freshProject();
  const lock = join(t.main, '.git', 'devkit-open.lock');
  writeFileSync(lock, `${JSON.stringify({ pid: 1, at: new Date().toISOString() })}\n`);
  const before = snapshot(t.main);
  const sleeps = [];
  assert.throws(
    () => openChange(t.main, 'held-open', { script: 'devkit', why: 'doubt', request: 'Add a thing', lang: 'en', env: cleanEnv, lockSleep: (ms) => { sleeps.push(ms); } }),
    (e) => e instanceof LoopUsageError && /another open call holds the lock for too long/.test(e.message),
  );
  assert.ok(sleeps.length > 0, 'the wait went through the injected sleep');
  assert.equal(sleeps.reduce((a, b) => a + b, 0), 60_000, 'the whole wait of the open lock, without sleeping for real');
  assert.equal(existsSync(lock), true, 'the other holder\'s lock is untouched');
  rmSync(lock);
  assert.deepEqual(snapshot(t.main), before, 'nothing was created');
});

test('followups AC-10 guard: an edit and a shell write in a change run read the transcript once', () => {
  const root = planChange({ have: ['requirements', 'decisions'] });
  for (const [mode, input] of [
    ['edit', (t) => editInput(root, 'src/a.ts', t)],
    ['bash', (t) => bashInput(root, 'echo x > src/a.ts', t)],
  ]) {
    const transcript = runTranscript();
    const spy = readCounter();
    const r = hook(mode, input(transcript), { TMPDIR: sandbox(), ...spy.env(transcript) });
    assert.equal(r.code, 2, `${mode}: ${r.err}`);
    assert.equal(spy.reads(), 1, `${mode}: the transcript is read once`);
  }
});

// ================================================================ roadmap-coordinator-followups, phase 3: a started session, the stage icon

// The first message of a session another session started, in the app's form (this change's own first message, in generic words):
// the background line, a background paragraph, `Task:`, the task, and a notes line.
const STARTED_LINE = 'Background (from the session that started this one):';
const startedMessage = (id, over = {}) => [
  over.first ?? STARTED_LINE, 'This session runs the devkit change for a roadmap run. Work only in its worktree.', '', 'Task:', over.task ?? `/devkit-openspec:devkit change ${id}`, '', 'Notes: say who started this session before your first question.',
].join('\n');

test('followups F-4 guard: the task of a session started by another session makes a change run', () => {
  assert.equal(guardModule.STARTED_BY_SESSION, STARTED_LINE);
  const transcript = transcriptOf([plainLine(startedMessage('feat')), assistantLine(), runLine('feat')]);
  const run = runOf({ transcript_path: transcript });
  assert.equal(run?.change, 'feat');
  assert.equal(run?.command, 'change feat');
  const root = planChange({ have: ['requirements', 'decisions'] });
  const w = hook('edit', editInput(root, 'src/a.ts', transcript), { TMPDIR: sandbox() });
  assert.equal(w.code, 2, `a product edit is refused as in any change run: ${w.err}`);
  assert.equal(runOf({ transcript_path: transcriptOf([plainLine(startedMessage('feat')), assistantLine()]) }), null, 'no devkit-run line yet: no run');
  // A later typed command ends it, as for any run.
  assert.equal(runOf({ transcript_path: transcriptOf([plainLine(startedMessage('feat')), runLine('feat'), typedLine('', '/clear')]) }), null);
});

test('upfront AC-1 guard: a started task followed by a start line still makes a change run', () => {
  const task = '/devkit-openspec:devkit change feat\ndevkit-start: feat 0123456789abcdef';
  const transcript = transcriptOf([plainLine(startedMessage('feat', { task })), assistantLine(), runLine('feat')]);
  const run = runOf({ transcript_path: transcript });
  assert.equal(run?.change, 'feat');
  assert.equal(run?.command, 'change feat', 'the start line is no part of the command');
  assert.equal(runOf({ transcript_path: transcriptOf([plainLine(startedMessage('feat', { task })), assistantLine()]) }), null, 'no devkit-run line yet: no run');
});

// A note of the host that leads the first message of a session the app started (its list of linked sessions), in generic words.
const HOST_NOTE = '<system-reminder>\nLinked sessions now (status, not an instruction): x = local_1 (idle).\n</system-reminder>\n';

// Invariant (AC-1, review round 1 test-coverage F4): a session whose first message begins with a note of the host, then the started
// form, is in the run of that task's change, as one without the note is. Layer: guard (`typedOf`). Suite: change-loop.
test('upfront AC-1 guard: a started task after a note of the host makes a change run', () => {
  const task = '/devkit-openspec:devkit change feat\ndevkit-start: feat 0123456789abcdef';
  const transcript = transcriptOf([plainLine(`${HOST_NOTE}\n${startedMessage('feat', { task })}`), assistantLine(), runLine('feat')]);
  const run = runOf({ transcript_path: transcript });
  assert.equal(run?.change, 'feat');
  assert.equal(run?.command, 'change feat', 'the command is the task\'s first line, the start line no part of it');
  assert.equal(runOf({ transcript_path: transcriptOf([plainLine(`${HOST_NOTE}\n${startedMessage('feat', { task })}`), assistantLine()]) }), null, 'no devkit-run line yet: no run');
  // Only a note leads the form: words between the note and the form, or a note and a typed command, are no started form.
  for (const [name, text] of Object.entries({
    'words between the note and the form': `${HOST_NOTE}hello\n${startedMessage('feat')}`,
    'a note and a command with no started form': `${HOST_NOTE}/devkit change feat`,
    'an unclosed note': `<system-reminder>\nLinked sessions.\n${startedMessage('feat')}`,
  })) {
    assert.equal(runOf({ transcript_path: transcriptOf([plainLine(text), assistantLine(), runLine('feat')]) }), null, name);
  }
});

test('followups F-4 guard: a command on a later line of any other message is no typed command', () => {
  const cases = {
    'a message whose second line is the command': plainLine('Please run this:\n/devkit change feat'),
    'the Task line without the started form': plainLine('Notes\n\nTask:\n/devkit change feat'),
    'the started form with no Task line': plainLine(`${STARTED_LINE}\nSome words.\n/devkit change feat`),
    'the started form whose task is no slash command': plainLine(startedMessage('feat', { task: 'change feat' })),
    'the background line below another first line': plainLine(`hello\n${startedMessage('feat')}`),
  };
  // The boundary: the started form's own task counts, nothing else on a later line does.
  assert.equal(runOf({ transcript_path: transcriptOf([plainLine(startedMessage('feat')), assistantLine(), runLine('feat')]) })?.change, 'feat', 'the started form');
  for (const [name, line] of Object.entries(cases)) {
    assert.equal(runOf({ transcript_path: transcriptOf([line, assistantLine(), runLine('feat')]) }), null, name);
  }
});

const STAGE_ICONS = {
  open: '❓', requirements: '❓', mockup: '📝', decisions: '📝', proposal: '📝', specs: '📝', design: '📝', tasks: '📝', readiness: '📝', approval: '📝',
  implementation: '🛠️', 'unit-tests': '🛠️', 'e2e-tests': '🛠️', evidence: '🔍', review: '🔍', delivery: '🚀', retro: '📦',
};

test('followups AC-14 icon: every stage of both scripts has its icon, and an archived end is the archive\'s', () => {
  for (const [script, flow] of Object.entries(FLOWS)) {
    for (const stage of flow.stages) {
      assert.ok(STAGE_ICONS[stage.id], `${script}: the table names ${stage.id}`);
      assert.equal(changeLoopModule.stageIcon({ stage: stage.id }), STAGE_ICONS[stage.id], `${script}: ${stage.id}`);
    }
  }
  assert.deepEqual([...new Set(Object.values(STAGE_ICONS))].sort(), ['❓', '📝', '📦', '🔍', '🚀', '🛠️'].sort(), 'the six icons');
  assert.equal(changeLoopModule.stageIcon({ kind: 'end', stage: 'delivery', end: { state: 'archived', why: 'archived' } }), '📦');
  assert.equal(changeLoopModule.stageIcon({ kind: 'end', stage: 'delivery', end: { state: 'waiting-on-github', why: 'waiting-github' } }), '🚀');
  for (const unknown of [{ stage: 'nope' }, { stage: null }, {}, undefined]) assert.equal(changeLoopModule.stageIcon(unknown), null, JSON.stringify(unknown));
});

test('followups AC-14 next: every action of change-loop next carries the icon of its stage and its session title', () => {
  const seen = [];
  const wanted = ['🙋 ❓ feat', '📝 feat', '📝 feat', '📝 feat', '🙋 📝 feat'];
  for (const [i, have] of [[], ['requirements'], ['requirements', 'proposal'], PLAN_UP_TO_TASKS, [...PLAN_UP_TO_TASKS, 'readiness']].entries()) {
    const { action } = parsed(next(planChange({ have })));
    seen.push(action);
    assert.equal(action.icon, changeLoopModule.stageIcon(action), `${action.stage}: the icon`);
    assert.equal(action.icon, STAGE_ICONS[action.stage], `${action.stage}: the table's icon`);
    assert.equal(action.sessionTitle, action.state.title, `${action.stage}: the title is the state's`);
    assert.equal(action.sessionTitle, wanted[i], `${action.stage}: the title`);
  }
  assert.ok(seen.some((a) => a.icon === '❓') && seen.some((a) => a.icon === '📝'), 'the grill and the plan stages');
  const archived = gitRepo({ config: 'schema: devkit\n', changes: { 'archive/2026-11-19-feat': { '.openspec.yaml': 'schema: devkit\n' } } });
  const done = parsed(next(archived, [], cleanEnv, { openspec: () => ({ status: 1, stdout: '', stderr: '' }), gh: () => ({ status: 1, stdout: '', stderr: '' }) })).action;
  assert.deepEqual([done.icon, done.sessionTitle], ['📦', '📦 feat'], 'an archived end');
  // An action with no stage has no icon; its title is the state's alone.
  const previous = parsed(next(planChange({ have: ['requirements', 'proposal'], headerless: true }))).action;
  assert.equal(previous.icon, null);
  assert.equal(previous.sessionTitle, '⛔ feat');
});

test('followups AC-14 title: sessionTitle is the icon and the id, cut under 60 code points', () => {
  assert.equal(changeLoopModule.sessionTitle('📝', 'a'), '📝 a');
  const long = changeLoopModule.sessionTitle('🛠️', 'x'.repeat(70));
  assert.equal([...long].length, 59, 'a 70-character id is cut to 59 code points');
  assert.ok(long.startsWith('🛠️ xxx'));
  const exact = changeLoopModule.sessionTitle('📝', 'x'.repeat(57));
  assert.equal([...exact].length, 59);
  assert.equal(exact, `📝 ${'x'.repeat(57)}`, 'under 60 stays whole');
  assert.equal([...changeLoopModule.sessionTitle('📝', 'x'.repeat(58))].length, 59, 'at 60 it is cut');
});

// ================================================================ compozy-driver: the entry, the view and the record steps (D-1, D-3, D-4)

const COMPOZY_CONFIG = 'schema: devkit\ndevkit:\n  driver: compozy\n';
const READY_REPLIES = {
  'workspace info': { stdout: { workspace: { name: 'devkit' } } },
  'loop inspect': { stdout: { name: 'devkit-change' } },
  'loop runs': { stdout: { items: [] } },
  'loop run': { stdout: { run: { run_id: 'looprun-1' }, web_url: 'http://localhost:2123/loop-runs/looprun-1' } },
};
// A project on the compozy driver, the fake `compozy` answering as a ready CompozyOS, and the daemon's socket listening.
async function compozyProject(t, { replies = {}, daemon = true, config = COMPOZY_CONFIG, setup, repo } = {}) {
  const root = repo ?? devkitRepo(config);
  setup?.(root);
  const k = fakeCompozy({ ...READY_REPLIES, ...replies });
  if (daemon) await k.daemon(t);
  return { root, k, env: { ...cleanEnv, ...k.env } };
}
const cstart = (p, id, request = '', lang = 'en') => main(['compozy-start', id, '--lang', lang], { cwd: p.root, env: p.env, stdin: request });
const startedRuns = (k) => k.argvs().filter((a) => a[0] === 'loop' && a[1] === 'run');
const inputsOf = (argv) => Object.fromEntries(argv.flatMap((a, i) => (argv[i - 1] === '--input' ? [[a.slice(0, a.indexOf('=')), a.slice(a.indexOf('=') + 1)]] : [])));
const startShape = (r) => { const b = body(r); return [b.version, b.mode, b.change, b.runId, b.url]; };

test('change-loop compozy start: projectGate answers per driver and verb', () => {
  const root = devkitRepo();
  const settings = (driver) => ({ driver, language: 'en', unknown: [] });
  const gate = (driver, verb) => changeLoopModule.projectGate(root, settings(driver), verb);
  for (const verb of ['change', 'roadmap', 'status']) assert.equal(gate('compozy', verb), null, `compozy ${verb}`);
  assert.deepEqual(gate('compozy', 'project'), { mode: 'driver-no-project', key: 'driver-no-project', params: {} });
  for (const verb of ['change', 'roadmap', 'status', 'project']) {
    assert.deepEqual(gate('script', verb), { mode: 'driver-not-built', key: 'driver-not-built', params: { driver: 'script', round: 22 } }, `script ${verb}`);
    assert.equal(gate('claude', verb), null, `claude ${verb}`);
  }
});

test('change-loop compozy start: startMode on compozy answers new and resume with settings.driver compozy', () => {
  const root = devkitRepo(COMPOZY_CONFIG);
  const fresh = body(startRun(root, 'change add an export'));
  assert.deepEqual([fresh.mode, fresh.settings.driver], ['new', 'compozy']);
  addChange(root, 'feat');
  const resumed = body(startRun(root, 'change feat'));
  assert.deepEqual([resumed.mode, resumed.change, resumed.settings.driver], ['resume', 'feat', 'compozy']);
  assert.equal(body(startRun(root, 'project billing')).mode, 'driver-no-project');
  assert.equal(body(startRun(root, 'roadmap')).mode, 'roadmap');
  assert.equal(body(startRun(root, 'status')).mode, 'status');
});

test('change-loop compozy start: C1 a name that cannot be a change name stops before CompozyOS is asked', async (t) => {
  const p = await compozyProject(t);
  for (const id of ['Bad Name', 'archive', 'a']) {
    const r = cstart(p, id, 'add a thing');
    assert.equal(r.code, 3, id);
    assert.deepEqual(startShape(r), [1, 'name-invalid', id, null, null]);
    assert.equal(body(r).reply, render('en', 'name-invalid', { id }));
    assert.equal(r.stdout.startsWith('devkit-run:'), false);
  }
  assert.deepEqual(p.k.calls(), [], 'CompozyOS was not asked');
});

test('change-loop compozy start: C2 the project gate stops it, for a project not set up and for an unknown setting', async (t) => {
  for (const [config, mode] of [['devkit:\n  driver: compozy\n', 'not-set-up'], ['schema: devkit\ndevkit:\n  driver: compozy\n  language: "no tag"\n', 'setting-unknown']]) {
    const p = await compozyProject(t, { config });
    const before = snapshot(p.root);
    const r = cstart(p, 'new-thing', 'add a thing');
    assert.equal(r.code, 3, mode);
    assert.deepEqual(startShape(r), [1, mode, 'new-thing', null, null]);
    assert.equal(body(r).reply, body(startRun(p.root, 'change add a thing')).reply, 'the reply is the one the typed command gives');
    assert.deepEqual(p.k.calls(), [], 'nothing was asked or started');
    assert.equal(snapshot(p.root), before);
  }
});

test('change-loop compozy start: C3 each failing readiness row stops it with its own reply and starts nothing', async (t) => {
  const cases = {
    'not-installed': { key: 'compozy-not-installed', fix: 'brew install compozy/compozy/compozy', arrange: (p) => { p.env.COMPOZY_BIN = join(p.k.dir, 'missing'); } },
    'daemon-stopped': { key: 'compozy-stopped', fix: 'compozy daemon start', daemon: false },
    'workspace-unknown': { key: 'compozy-workspace', fix: 'compozy workspace add ', replies: { 'workspace info': { code: 1, stderr: 'not registered' } } },
    'kit-missing': { key: 'compozy-kit-missing', replies: { 'loop inspect': { code: 69, stderr: 'not found' } } },
  };
  for (const [reason, c] of Object.entries(cases)) {
    const p = await compozyProject(t, { replies: c.replies, daemon: c.daemon !== false });
    c.arrange?.(p);
    const before = snapshot(p.root);
    const r = cstart(p, 'new-thing', 'add a thing');
    assert.equal(r.code, 3, reason);
    assert.deepEqual(startShape(r), [1, 'compozy-unavailable', 'new-thing', null, null], reason);
    const reply = body(r).reply;
    assert.equal(reply, render('en', c.key, { fix: reply.includes('compozy workspace add') ? reply.slice(reply.indexOf('compozy workspace add')).replace(/ .*$/, '') : c.fix }).length ? reply : '', reason);
    assert.ok(reply.startsWith(render('en', c.key, { fix: 'FIX' }).split('FIX')[0]), `${reason}: ${reply}`);
    if (c.fix) assert.ok(reply.includes(c.fix), `${reason} names its fixing command`);
    assert.equal(startedRuns(p.k).length, 0, reason);
    assert.equal(snapshot(p.root), before, reason);
  }
});

test('change-loop compozy start: C4 a live run of the change answers with it and starts no second run', async (t) => {
  const live = { 'loop runs': { stdout: { items: [{ run_id: 'looprun-9', status: 'running', inputs: { change_id: 'feat' } }] } } };
  const p = await compozyProject(t, { replies: live, setup: (root) => addChange(root, 'feat') });
  const r = cstart(p, 'feat');
  assert.equal(r.code, 0, r.stdout);
  assert.deepEqual(startShape(r), [1, 'compozy-running', 'feat', 'looprun-9', null]);
  assert.equal(body(r).reply, render('en', 'compozy-running', { id: 'feat', run: 'looprun-9' }));
  assert.equal(startedRuns(p.k).length, 0);
  assert.equal(r.stdout.startsWith('devkit-run:'), false);
  // The negative: a live run of another change, or a finished run of this one, does not hold it.
  const other = { 'loop runs': { stdout: { items: [{ run_id: 'looprun-8', status: 'running', inputs: { change_id: 'other' } }, { run_id: 'looprun-7', status: 'done', inputs: { change_id: 'feat' } }] } } };
  const q = await compozyProject(t, { replies: other, setup: (root) => addChange(root, 'feat') });
  assert.equal(body(cstart(q, 'feat')).mode, 'compozy-started');
});

test('change-loop compozy start: C5 a known change starts a run with its id, the language and an empty request', async (t) => {
  const p = await compozyProject(t, { setup: (root) => addChange(root, 'feat') });
  const before = snapshot(p.root);
  const r = cstart(p, 'feat', '', 'pt-BR');
  assert.equal(r.code, 0, r.stdout);
  assert.deepEqual(startShape(r), [1, 'compozy-started', 'feat', 'looprun-1', 'http://localhost:2123/loop-runs/looprun-1']);
  assert.equal(body(r).reply, render('pt-BR', 'compozy-started', { id: 'feat', url: 'http://localhost:2123/loop-runs/looprun-1' }));
  const runs = startedRuns(p.k);
  assert.equal(runs.length, 1);
  assert.deepEqual(inputsOf(runs[0]), { change_id: 'feat', request: '', lang: 'pt-BR' });
  assert.equal(runs[0][runs[0].indexOf('--name') + 1], 'devkit-change');
  assert.equal(r.stdout.startsWith('devkit-run:'), false, 'the stop lock never holds the turn');
  assert.equal(snapshot(p.root), before, 'the run opens the change, never the session');
});

test('change-loop compozy start: C6 a new change with no request is a usage error and starts nothing', async (t) => {
  const p = await compozyProject(t);
  for (const request of ['', '  \n ']) {
    const r = cstart(p, 'brand-new', request);
    assert.equal(r.code, 3);
    assert.ok(body(r).error.length > 0);
    assert.equal(body(r).reply, render('en', 'request-unreadable'));
  }
  assert.equal(startedRuns(p.k).length, 0);
});

test('change-loop compozy start: C7 a new change whose name is taken answers name-taken and starts nothing', async (t) => {
  const p = await compozyProject(t, { setup: (root) => git(root, 'branch', 'taken-x') });
  const before = snapshot(p.root);
  const r = cstart(p, 'taken-x', 'add a thing');
  assert.equal(r.code, 3);
  assert.deepEqual(startShape(r), [1, 'name-taken', 'taken-x', null, null]);
  assert.equal(body(r).reply, render('en', 'name-taken', { id: 'taken-x' }));
  assert.equal(startedRuns(p.k).length, 0);
  assert.equal(snapshot(p.root), before);
});

test('change-loop compozy start: C8 a new change starts a run with its id, its request and the language', async (t) => {
  const p = await compozyProject(t);
  const before = snapshot(p.root);
  const request = 'Add a CSV export\nwith "two" lines and $HOME';
  const r = cstart(p, 'new-thing', request);
  assert.equal(r.code, 0, r.stdout);
  assert.deepEqual(startShape(r), [1, 'compozy-started', 'new-thing', 'looprun-1', 'http://localhost:2123/loop-runs/looprun-1']);
  assert.deepEqual(inputsOf(startedRuns(p.k)[0]), { change_id: 'new-thing', request, lang: 'en' });
  assert.equal(snapshot(p.root), before);
});

// A project on the compozy driver with a bare origin (the main checkout of `roundRepo`) and the delivery block of `delivery`.
const TWO_PRS_BLOCK = 'devkit:\n  driver: compozy\n  delivery:\n    model: two-prs\n    base: main\n    test_branch: develop\n';
const twoPrsRepo = ({ testBranch = true, block = TWO_PRS_BLOCK } = {}) => {
  const r = roundRepo({ roadmap: '# Roadmap\n', config: `schema: devkit\n${block}` });
  if (testBranch) git(r.main, 'push', '-q', 'origin', 'HEAD:refs/heads/develop');
  return r.main;
};

test('change-loop compozy start: the refusals open makes before it creates anything stop a new change before the run, with their own reply', async (t) => {
  const cases = [
    ['test-branch-missing', { testBranch: false }, 'add-export', { branch: 'develop' }],
    ['base-not-default', { block: 'devkit:\n  driver: compozy\n  delivery:\n    model: two-prs\n    base: master\n    test_branch: develop\n' }, 'add-export', { base: 'master', default: 'main' }],
    ['name-test-suffix', {}, 'add-export-develop', { id: 'add-export-develop', branch: 'develop' }],
  ];
  for (const [key, repoOptions, id, params] of cases) {
    const p = await compozyProject(t, { repo: twoPrsRepo(repoOptions) });
    const before = snapshot(p.root);
    const r = cstart(p, id, 'add a thing');
    assert.equal(r.code, 3, key);
    assert.deepEqual(startShape(r), [1, key, id, null, null], key);
    assert.equal(body(r).reply, render('en', key, params), key);
    assert.equal(startedRuns(p.k).length, 0, `${key} started no run`);
    assert.equal(snapshot(p.root), before, `${key} changed nothing`);
  }
});

test('change-loop compozy start: a two-prs project that passes those checks starts, and a known change is never checked', async (t) => {
  const p = await compozyProject(t, { repo: twoPrsRepo() });
  const r = cstart(p, 'add-export', 'add a thing');
  assert.deepEqual(startShape(r).slice(0, 3), [1, 'compozy-started', 'add-export']);
  assert.equal(startedRuns(p.k).length, 1);
  // A change some checkout already holds opens nothing in its run, so a missing test branch does not stop it, and neither does its name.
  const known = await compozyProject(t, { repo: twoPrsRepo({ testBranch: false }), setup: (root) => addChange(root, 'feat-develop') });
  const k = cstart(known, 'feat-develop');
  assert.deepEqual(startShape(k).slice(0, 3), [1, 'compozy-started', 'feat-develop']);
  // A project on the trunk model is not checked at all, and neither is one with no remote.
  const trunk = await compozyProject(t, { repo: twoPrsRepo({ testBranch: false, block: 'devkit:\n  driver: compozy\n  delivery:\n    model: trunk\n' }) });
  assert.equal(startShape(cstart(trunk, 'add-export-develop', 'add a thing'))[1], 'compozy-started');
  const bare = await compozyProject(t);
  assert.equal(startShape(cstart(bare, 'add-export-develop', 'add a thing'))[1], 'compozy-started');
});

test('change-loop compozy start: a reply with no url names the run, and a failed start is a usage error', async (t) => {
  const p = await compozyProject(t, { replies: { 'loop run': { stdout: { run: { run_id: 'looprun-3' } } } } });
  const r = cstart(p, 'new-thing', 'add a thing');
  assert.deepEqual(startShape(r), [1, 'compozy-started', 'new-thing', 'looprun-3', null]);
  assert.equal(body(r).reply, render('en', 'compozy-started-no-url', { id: 'new-thing', run: 'looprun-3' }));
  const q = await compozyProject(t, { replies: { 'loop run': { code: 1, stderr: 'daemon refused\n' } } });
  const failed = cstart(q, 'new-thing', 'add a thing');
  assert.equal(failed.code, 3);
  assert.equal(body(failed).error, 'daemon refused');
});

test('change-loop compozy start: after it printed its JSON the stop lock lets the turn end', async (t) => {
  const p = await compozyProject(t);
  const r = cstart(p, 'new-thing', 'add a thing');
  assert.equal(r.code, 0);
  const file = transcriptOf([typedLine('change add a thing'), skillBodyLine('change add a thing'), assistantLine(), toolResultLine(r.stdout)]);
  assert.equal(runOf({ transcript_path: file }), null, 'no devkit-run line: the session is in no run');
  const decision = guardModule.runOf({ transcript_path: file });
  assert.equal(decision, null);
});

// ---------------------------------------------------------------- the view (D-3), pure

const emptyRec = () => ({ version: 1, handed: null, failed: null, answers: { grill: [], approvalNotes: null, retro: null, mockup: null } });
const rec = (over = {}) => ({ ...emptyRec(), ...over, answers: { ...emptyRec().answers, ...(over.answers ?? {}) } });
const cview = (action, record = rec()) => changeLoopModule.compozyView(action, record, { lang: 'en' });
const VIEW_FIELDS = ['version', 'kind', 'change', 'root', 'stage', 'stage_title', 'agent', 'step', 'brief', 'progress_key', 'question', 'reply'];
const endAction = (why, over = {}) => ({
  version: 1, change: 'feat', script: 'devkit', root: '/w/feat', branch: 'feat', filesLanguage: 'en', kind: 'end', stage: over.stage ?? null,
  stageTitle: over.stageTitle ?? null, end: { state: over.state ?? 'waiting-for-owner', why }, params: { id: 'feat' }, reply: `reply of ${why}`, ...(over.detail ? { detail: over.detail } : {}),
});

test('change-loop compozy view: every field is present, in the order of the design, for every kind of action', () => {
  const actions = [run(planNext('proposal', 'no-file')), build(rowOf('review')), build(rowOf('gate', { phase: 1, task: '1.2', command: 'true' })), endAction('waiting-merge'), run({ rep: { end: endOf('archived', null, 'archived') } })];
  for (const action of actions) {
    const v = cview(action);
    assert.deepEqual(Object.keys(v), VIEW_FIELDS);
    for (const f of VIEW_FIELDS.slice(1)) assert.equal(typeof v[f], 'string', `${action.kind} ${f}`);
    assert.deepEqual([v.version, v.change, v.root], [1, 'feat', '/w/feat']);
  }
});

test('change-loop compozy view: an agent action keeps its brief and names its role without the pack', () => {
  const a = run(planNext('proposal', 'no-file'));
  const v = cview(a);
  assert.deepEqual([v.kind, v.agent, v.stage, v.step, v.progress_key], ['agent', 'change-planner', 'proposal', '', a.progressKey]);
  assert.equal(v.brief, a.brief, 'a plan stage adds no dispatch line');
  assert.equal(v.question, '');
});

test('change-loop compozy view: the dispatch line of a step is its ship-change row, the devkit skill\'s Loop bullet, or nothing', () => {
  for (const step of ['implement', 'fix-review', 'fix-defect', 'fix-checks', 'apply-proposals', 'commit', 'open-pr', 'push', 'open-archive-pr', 'verify']) {
    const a = build(rowOf(step, { phase: 2 }));
    const v = cview(a);
    assert.equal(v.kind, 'agent', step);
    assert.ok(v.brief.startsWith(a.brief), step);
    assert.ok(v.brief.includes(`add the dispatch sentence of the \`ship-change\` row of step \`${step}\``), `${step}: ${v.brief}`);
  }
  for (const step of ['resolve-release-conflict', 'renumber-adr']) { // main's release-merge removed `push-rebased`: only a step of ROW_STEPS can carry a dispatch line; `renumber-adr` (roadmap-sessions-upfront) has its sentence in the skill's Loop, no ship-change row
    assert.ok(ROW_STEPS.includes(step), `${step} is a step of the delivery rows`);
    const v = cview(build(rowOf(step, {})));
    assert.ok(v.brief.includes(`add the dispatch sentence of the \`devkit\` skill's Loop bullet \`${step}\``), `${step}: ${v.brief}`);
    assert.ok(!v.brief.includes('`ship-change` row'), step);
  }
  const fix = run({ rep: { next: nextOf(FLOWS.devkit, 'implementation', 'fix-after-failure', { failed: 'unit-tests', attempt: 1, ceiling: 3 }) }, facts: { tests: TESTS } });
  assert.equal(fix.step, 'fix-tests');
  assert.equal(cview(fix).brief, fix.brief, 'fix-tests adds no line');
  const unit = run({ rep: { next: nextOf(FLOWS.devkit, 'unit-tests', 'no-file') }, facts: { tests: TESTS } });
  assert.equal(cview(unit).brief, unit.brief, 'a test stage adds no line');
});

test('change-loop compozy view: the review step, the gate step and the session steps map as the table says', () => {
  const review = build(rowOf('review', { round: 1 }));
  const rv = cview(review);
  assert.deepEqual([rv.kind, rv.agent, rv.step, rv.brief], ['review', '', 'review', '']);
  assert.equal(rv.question, render('en', 'blocked', { id: 'feat', why: 'role-failed', stage: review.stageTitle }));
  const gate = build(rowOf('gate', { phase: 2, task: '2.3', command: 'node --test x' }));
  const gv = cview(gate);
  assert.deepEqual([gv.kind, gv.step, gv.agent], ['gate', 'gate', '']);
  assert.equal(gv.question, render('en', 'blocked', { id: 'feat', why: 'tests-red', phase: 2 }));
  const other = build(rowOf('enable-auto-merge', { number: 12 }));
  const ov = cview(other);
  assert.deepEqual([ov.kind, ov.agent, ov.step], ['coordinator', 'change-coordinator', 'enable-auto-merge']);
  assert.ok(ov.brief.includes('carry out step enable-auto-merge as the `ship-change` row of that name says, with this `next` object: '));
  assert.ok(ov.brief.includes(JSON.stringify(other.detail)));
  assert.ok(ov.brief.startsWith(`Change feat (devkit script), stage ${other.stage}: `), 'in the action\'s brief frame');
  assert.ok(ov.brief.includes('Work only in /w/feat on branch feat; every file path is absolute under it'));
});

// ---- 4.0: the view follows what main added at 72b51d3 (design.md, "Main-merge amendments (after 72b51d3)")

const SUPPORT = { root: '/w/feat-develop', branch: 'feat-develop' };

test('change-loop compozy view: a support-branch hand-off runs in the support worktree, a task one in the task worktree', () => {
  const conflict = build(rowOf('resolve-support-conflict', { ...SUPPORT, paths: ['a.txt'] }));
  const hv = cview(conflict);
  assert.deepEqual([hv.kind, hv.agent, hv.root], ['agent', 'tdd-implementer', SUPPORT.root], 'the agent runs in the detail\'s worktree');
  assert.ok(hv.brief.includes(`Work only in ${SUPPORT.root} on branch ${SUPPORT.branch};`), hv.brief);
  const merge = build(rowOf('merge-into-support', { ...SUPPORT, from: 'feat' }));
  const mv = cview(merge);
  assert.deepEqual([mv.kind, mv.root], ['coordinator', SUPPORT.root], 'a coordinator step takes the detail\'s root too');
  assert.ok(mv.brief.includes(`Work only in ${SUPPORT.root} on branch ${SUPPORT.branch};`), mv.brief);
  assert.ok(!mv.brief.includes('Work only in /w/feat '), 'and names no other checkout');
  // The negatives: no detail root, a detail with only one of the two, and an ordinary step all stay in the task worktree.
  for (const [what, a] of [
    ['no detail', build(rowOf('enable-auto-merge', { number: 12 }))],
    ['root alone', build(rowOf('merge-into-support', { root: SUPPORT.root, from: 'feat' }))],
    ['branch alone', build(rowOf('merge-into-support', { branch: SUPPORT.branch, from: 'feat' }))],
  ]) {
    const v = cview(a);
    assert.equal(v.root, '/w/feat', what);
    assert.ok(v.brief.includes('Work only in /w/feat on branch feat;'), `${what}: ${v.brief}`);
  }
});

test('change-loop compozy view: every hand-off step of the delivery rows carries its dispatch sentence, from the table the loop itself reads', () => {
  // A step whose end reply needs a parameter this row does not give is an end step, not a hand-off; nothing else is skipped.
  const kindOfStep = (step) => { try { return build(rowOf(step, { phase: 2 })).kind; } catch (e) { if (e instanceof LoopUsageError) return 'end'; throw e; } };
  const handOffs = ROW_STEPS.filter((step) => kindOfStep(step) === 'agent');
  const expected = ['implement', 'fix-review', 'fix-defect', 'fix-checks', 'apply-proposals', 'resolve-release-conflict', 'commit', 'open-pr', 'push', 'open-archive-pr', 'verify',
    'open-prs', 'open-test-pr', 'push-support', 'move-test-pr', 'open-test-archive-pr', 'resolve-support-conflict', 'fix-resolution', 'renumber-adr', 'rejoin-train'];
  assert.deepEqual([...handOffs].sort(), [...expected].sort(), 'the table\'s hand-offs are the old ones, the seven new delivery steps, renumber-adr and rejoin-train');
  for (const step of handOffs) {
    const v = cview(build(rowOf(step, { phase: 2 })));
    const bullet = `add the dispatch sentence of the \`devkit\` skill's Loop bullet \`${step}\``;
    const row = `add the dispatch sentence of the \`ship-change\` row of step \`${step}\``;
    assert.ok(['resolve-release-conflict', 'renumber-adr'].includes(step) ? v.brief.includes(bullet) : v.brief.includes(row), `${step}: ${v.brief}`);
    assert.equal(v.brief.includes(bullet) && v.brief.includes(row), false, `${step} names one source only`);
  }
  // Every dispatch sentence names a row that exists: a `ship-change` table row for the step.
  const rows = readFileSync(join(HERE, '..', 'skills', 'ship-change', 'SKILL.md'), 'utf8').split('\n').filter((l) => l.startsWith('| `'));
  for (const step of handOffs.filter((s) => !['resolve-release-conflict', 'renumber-adr'].includes(s))) {
    assert.ok(rows.some((l) => l.slice(0, l.indexOf('|', 2)).includes(`\`${step}\``)), `${step} has a ship-change row`);
  }
});

test('change-loop compozy view: review-resolution is a review like review, and the other new session steps are coordinator steps', () => {
  const resolution = build(rowOf('review-resolution', { root: '/w/feat', support: 'feat-develop', commit: 'abc1234', round: 1 }));
  const rv = cview(resolution);
  assert.deepEqual([rv.kind, rv.agent, rv.step, rv.brief], ['review', '', 'review-resolution', '']);
  assert.equal(rv.question, render('en', 'blocked', { id: 'feat', why: 'role-failed', stage: resolution.stageTitle }));
  for (const step of ['rerun-checks', 'checkout-support', 'merge-into-support']) {
    const a = build(rowOf(step, { runs: [7], path: '/w/feat-develop', branch: 'feat-develop', root: '/w/feat-develop', from: 'feat' }));
    const v = cview(a);
    assert.deepEqual([v.kind, v.agent, v.step], ['coordinator', 'change-coordinator', step], step);
    assert.ok(v.brief.includes(`carry out step ${step} as the \`ship-change\` row of that name says, with this \`next\` object: `), `${step}: ${v.brief}`);
    assert.ok(v.brief.includes(JSON.stringify(a.detail)), step);
  }
});

test('change-loop compozy view: take-place is a command no agent runs, with the checker\'s own argv', () => {
  const a = build(rowOf('implement'), { place: { taken: false, held: 0, places: 2, machine: 'avel' } });
  assert.equal(a.step, 'take-place');
  const v = cview(a);
  assert.deepEqual([v.kind, v.agent, v.brief, v.question, v.step, v.progress_key], ['command', '', '', '', 'take-place', a.progressKey]);
  assert.deepEqual(a.detail.command.slice(2), ['place', 'feat', '--lang', 'en'], 'the command the run-step runs is the checker\'s');
});

test('change-loop compozy view: a session step outside the command list is still a coordinator step', () => {
  const a = build(rowOf('rerun-checks', { runs: [7] }));
  assert.equal(a.step, 'rerun-checks');
  const v = cview(a);
  assert.deepEqual([v.kind, v.agent], ['coordinator', 'change-coordinator']);
});

test('change-loop compozy view: switch-script and accept-decisions are commands no agent runs', () => {
  const lite = FLOWS['devkit-lite'];
  const rep = { flow: lite, ctx: { script: 'devkit-lite' }, rep: { schema: 'devkit-lite', next: nextOf(lite, 'proposal', 'no-file') } };
  const sw = run({ ...rep, flow: lite, report: reportOf(lite, rep.rep), facts: { flags: ['ui'], hasProposal: false } });
  const accept = run({ ...planNext('proposal', 'no-file'), facts: { approval: { ok: true, status: 'APPROVED', recorded: 'sha256:aaaaaaaaaaaa', readiness: 'sha256:aaaaaaaaaaaa' }, decisions: { listed: ['docs/adr/1.md'], proposed: ['docs/adr/1.md'], unreadable: [] } } });
  for (const [a, step] of [[sw, 'switch-script'], [accept, 'accept-decisions']]) {
    assert.equal(a.step, step);
    const v = cview(a);
    assert.deepEqual([v.kind, v.agent, v.brief, v.question, v.step, v.progress_key], ['command', '', '', '', step, a.progressKey], step);
  }
});

test('change-loop compozy view: the grill hands the coordinator every answer the record holds', () => {
  const a = run({ rep: { next: nextOf(FLOWS.devkit, 'requirements', 'no-file') } });
  const none = cview(a);
  assert.deepEqual([none.kind, none.agent, none.stage, none.progress_key], ['grill', 'change-coordinator', 'requirements', a.progressKey]);
  const some = cview(a, rec({ answers: { grill: [{ question: 'Who uses it?', answer: 'The admins', at: 't' }, { question: '', answer: 'Weekly', at: 't' }] } }));
  assert.ok(some.brief.includes('Who uses it?') && some.brief.includes('The admins') && some.brief.includes('Weekly'), some.brief);
  assert.notEqual(some.brief, none.brief);
});

test('change-loop compozy view: waiting-mockup is the mockup kind, never owner, naming mockup.md and the mock folder under the root', () => {
  const a = run({ rep: { end: endOf('waiting-for-owner', 'mockup', 'owner-pending'), stages: { mockup: { state: 'pending', reasonCode: 'not-judged' } } } });
  const v = cview(a);
  assert.deepEqual([v.kind, v.agent, v.progress_key], ['mockup', '', 'end/waiting-for-owner/waiting-mockup/mockup']);
  assert.ok(v.question.startsWith(a.reply));
  assert.ok(v.question.includes('/w/feat/openspec/changes/feat/mockup.md') && v.question.includes('/w/feat/openspec/changes/feat/mock/'), v.question);
  assert.notEqual(cview(endAction('waiting-merge')).kind, 'mockup');
});

test('change-loop compozy view: the plan approval is asked, and the owner\'s notes make the planner revise', () => {
  for (const why of ['waiting-approval', 'waiting-approval-again']) {
    const a = endAction(why, { stage: 'approval' });
    const v = cview(a);
    assert.deepEqual([v.kind, v.agent, v.progress_key], ['approval', '', `end/waiting-for-owner/${why}/approval`], why);
    assert.ok(v.question.startsWith(a.reply) && v.question.includes('/w/feat/openspec/changes/feat/'), v.question);
    const notes = cview(a, rec({ answers: { approvalNotes: 'drop the export' } }));
    assert.deepEqual([notes.kind, notes.agent], ['agent', 'change-planner'], why);
    assert.ok(notes.brief.includes('the owner did not approve the plan and asked: `drop the export`; revise the plan'), notes.brief);
  }
});

test('change-loop compozy view: the retro answers are asked, and recorded answers go to the coordinator', () => {
  const a = endAction('waiting-retro', { stage: 'retro' });
  const v = cview(a);
  assert.deepEqual([v.kind, v.agent, v.progress_key], ['retro-answers', '', 'end/waiting-for-owner/waiting-retro/retro']);
  assert.ok(v.question.startsWith(a.reply) && v.question.includes('retro.md'), v.question);
  const answered = cview(a, rec({ answers: { retro: '1: approve; 2: reject' } }));
  assert.deepEqual([answered.kind, answered.agent], ['coordinator', 'change-coordinator']);
  assert.ok(answered.brief.includes('record these answers of the owner as the `ship-change` `stop-retro-answers` row says: `1: approve; 2: reject`'), answered.brief);
});

test('change-loop compozy view: every other wait for the owner is the owner kind with the reply as its question', () => {
  for (const why of ['waiting-merge', 'waiting-archive-merge', 'waiting-review-dispute', 'waiting-by-hand', 'waiting-unrun-stage', 'waiting-pr-decision']) {
    const a = endAction(why, { stage: 'delivery' });
    const v = cview(a);
    assert.deepEqual([v.kind, v.agent, v.question, v.progress_key], ['owner', '', a.reply, `end/waiting-for-owner/${why}/delivery`], why);
  }
});

test('change-loop compozy view: GitHub, blocked and archived ends have their own kinds', () => {
  const gh = cview(endAction('waiting-github', { state: 'waiting-on-github', stage: 'delivery' }));
  assert.deepEqual([gh.kind, gh.question, gh.brief, gh.progress_key], ['github', '', '', 'end/waiting-on-github/waiting-github/delivery']);
  const blocked = endAction('ceiling', { state: 'blocked', stage: 'review' });
  const bv = cview(blocked);
  assert.deepEqual([bv.kind, bv.question, bv.progress_key], ['blocked', blocked.reply, 'end/blocked/ceiling/review']);
  const done = cview(endAction('archived', { state: 'archived' }));
  assert.deepEqual([done.kind, done.question, done.progress_key], ['archived', '', 'end/archived/archived/']);
});

test('change-loop compozy view: an unknown change opens, and after an open turn that left it unknown the owner is asked', () => {
  const open = { version: 1, kind: 'open', change: 'feat', script: null, root: '/w/main', branch: 'main', filesLanguage: 'en', stage: 'open', stageTitle: '', progressKey: 'open/feat' };
  const fresh = cview(open);
  assert.deepEqual([fresh.kind, fresh.agent, fresh.progress_key], ['open', 'change-coordinator', 'open/feat']);
  assert.ok(fresh.brief.includes('run `change-loop open` with the request') && fresh.brief.includes('return `failure`'), fresh.brief);
  for (const handed of [null, { key: 'other/key', at: 't' }]) assert.equal(cview(open, rec({ handed })).kind, 'open', 'no handed key, or another');
  const failed = cview(open, rec({ handed: { key: 'open/feat', at: 't' } }));
  assert.deepEqual([failed.kind, failed.progress_key], ['blocked', 'end/blocked/open-failed/open']);
  assert.equal(failed.question, render('en', 'blocked', { id: 'feat', why: 'open-failed' }));
});

test('change-loop compozy view: a recorded failure whose key is the handed key or the action\'s own gives the blocked kind', () => {
  const a = run(planNext('proposal', 'no-file'));
  const failed = (key) => rec({ handed: { key: 'handed/key', at: 't' }, failed: { key, reply: 'the command said no', at: 't' } });
  for (const key of ['handed/key', a.progressKey]) {
    const v = cview(a, failed(key));
    assert.deepEqual([v.kind, v.question, v.progress_key], ['blocked', 'the command said no', 'end/blocked/step-failed/proposal'], key);
  }
  assert.equal(cview(a, failed('another/key')).kind, 'agent', 'a failure of another key leaves the action\'s own view');
});

test('change-loop compozy view: the words of an approved mock-up hand the facts to the coordinator before anything else', () => {
  const a = run(planNext('proposal', 'no-file'));
  const v = cview(a, rec({ answers: { mockup: 'looks right, keep the filters' } }));
  assert.deepEqual([v.kind, v.agent, v.progress_key], ['coordinator', 'change-coordinator', 'mockup-facts/feat']);
  assert.ok(v.brief.includes('the owner approved the mock-up (`looks right, keep the filters`)'), v.brief);
  assert.ok(v.brief.includes('under `## What the mock-up revealed`') && v.brief.includes('stop-mockup-approval') && v.brief.includes('change nothing else'), v.brief);
  assert.equal(cview(a, rec({ answers: { mockup: null } })).kind, 'agent', 'no words, no row');
  const both = cview(a, rec({ handed: { key: a.progressKey, at: 't' }, failed: { key: a.progressKey, reply: 'no', at: 't' }, answers: { mockup: 'ok' } }));
  assert.equal(both.kind, 'blocked', 'a recorded failure comes first');
});

// ---------------------------------------------------------------- the run record and the view command (D-3), real files

const recFile = (root, id = 'feat') => join(root, '.git', 'devkit-compozy', `${id}.json`);
const viewOf = (cwd, { id = 'feat', env = cleanEnv, ...opts } = {}) => main(['next', '--change', id, '--lang', 'en', '--view', 'compozy'], { cwd, env, ...opts });
const readRec = (root) => JSON.parse(readFileSync(recFile(root), 'utf8'));
const approvalPlan = () => planChange({ have: ['requirements', 'proposal', 'specs', 'design', 'tasks', 'readiness'] });

test('change-loop compozy view: next --view compozy prints the view alone, and next without it prints what it printed before', () => {
  const root = approvalPlan();
  const r = viewOf(root);
  assert.equal(r.code, 0, r.stdout + r.stderr);
  const v = JSON.parse(r.stdout);
  assert.deepEqual(Object.keys(v), VIEW_FIELDS);
  assert.deepEqual([v.kind, v.stage, v.change], ['approval', 'approval', 'feat']);
  assert.ok(v.question.includes(render('en', 'waiting-approval', { id: 'feat' })));
  const plain = next(root);
  assert.equal(plain.code, 1);
  assert.equal(plain.stdout.startsWith('devkit-run: feat\n'), true);
  assert.equal(existsSync(recFile(root)), false, 'reading the view writes no record');
  assert.equal(viewOf(root, { args: undefined }).stdout, r.stdout, 'the same files give the same view');
});

test('change-loop compozy view: an unknown option value of --view is a usage error', () => {
  const root = approvalPlan();
  const r = main(['next', '--change', 'feat', '--lang', 'en', '--view', 'claude'], { cwd: root, env: cleanEnv });
  assert.equal(r.code, 3);
});

test('change-loop compozy view: the handed key of the record is passed as --after, so a stage that did not move blocks with no-progress', () => {
  const root = planChange({ have: ['requirements'] });
  const first = JSON.parse(viewOf(root).stdout);
  assert.equal(first.kind, 'agent');
  put(root, { '.git/devkit-compozy/feat.json': JSON.stringify({ ...emptyRec(), handed: { key: first.progress_key, at: 't' } }) });
  const again = JSON.parse(viewOf(root).stdout);
  assert.deepEqual([again.kind, again.progress_key], ['blocked', `end/blocked/no-progress/${first.stage}`]);
  assert.equal(again.question, render('en', 'blocked', { id: 'feat', why: 'no-progress', stage: again.stage_title }));
});

test('change-loop compozy view: a change known in no checkout opens, and the open-failed row asks after an open turn that left it unknown', () => {
  const root = devkitRepo(COMPOZY_CONFIG);
  const fresh = JSON.parse(viewOf(root).stdout);
  assert.deepEqual([fresh.kind, fresh.agent, fresh.progress_key, fresh.stage], ['open', 'change-coordinator', 'open/feat', 'open']);
  put(root, { '.git/devkit-compozy/feat.json': JSON.stringify({ ...emptyRec(), handed: { key: 'open/feat', at: 't' } }) });
  const failed = JSON.parse(viewOf(root).stdout);
  assert.deepEqual([failed.kind, failed.progress_key], ['blocked', 'end/blocked/open-failed/open']);
  put(root, { '.git/devkit-compozy/feat.json': JSON.stringify({ ...emptyRec(), handed: { key: 'something/else', at: 't' } }) });
  assert.equal(JSON.parse(viewOf(root).stdout).kind, 'open');
});

test('change-loop compozy view: an empty, cut short or non-JSON record reads as an empty record', () => {
  const root = approvalPlan();
  for (const text of ['', '{"version":1,"handed":{"key":', 'not json', '[]', 'null']) {
    put(root, { '.git/devkit-compozy/feat.json': text });
    const v = JSON.parse(viewOf(root).stdout);
    assert.equal(v.kind, 'approval', JSON.stringify(text));
  }
});

// ---------------------------------------------------------------- confirm (D-3)

const confirmRun = (cwd, view, { id = 'feat', env = cleanEnv } = {}) => main(['confirm', '--change', id, '--lang', 'en', '--view', typeof view === 'string' ? view : JSON.stringify(view)], { cwd, env });

test('change-loop compozy confirm: the view of the checker confirms with exit 0, and a differing field exits 1 printing the current view', () => {
  const root = planChange({ have: ['requirements'] });
  const v = JSON.parse(viewOf(root).stdout);
  for (const field of VIEW_FIELDS) {
    const before = existsSync(recFile(root)) ? readFileSync(recFile(root), 'utf8') : null;
    const bad = confirmRun(root, { ...v, [field]: field === 'version' ? 2 : `${v[field]} changed` });
    assert.equal(bad.code, 1, field);
    assert.deepEqual(JSON.parse(bad.stdout), v, `${field}: the current view is printed`);
    assert.equal(existsSync(recFile(root)) ? readFileSync(recFile(root), 'utf8') : null, before, `${field}: the record is left unchanged`);
  }
  assert.equal(confirmRun(root, { ...v, extra: 'x' }).code, 1, 'an extra field differs');
  const { kind, ...missing } = v; // eslint-disable-line no-unused-vars
  assert.equal(confirmRun(root, missing).code, 1, 'a missing field differs');
  assert.equal(existsSync(recFile(root)), false, 'no differing view recorded anything');
  const ok = confirmRun(root, v);
  assert.equal(ok.code, 0, ok.stdout + ok.stderr);
  assert.deepEqual(JSON.parse(ok.stdout), v);
});

test('change-loop compozy confirm: an unparsable or non-object --view exits 1, as a differing view does', () => {
  const root = planChange({ have: ['requirements'] });
  for (const text of ['not json', '[]', '"x"', 'null', '']) {
    const r = confirmRun(root, text);
    assert.equal(r.code, 1, JSON.stringify(text));
    assert.equal(JSON.parse(r.stdout).kind, 'agent');
  }
});

test('change-loop compozy confirm: it records the progress key as handed, and the next view then sees it', () => {
  const root = planChange({ have: ['requirements'] });
  const v = JSON.parse(viewOf(root).stdout);
  assert.equal(confirmRun(root, v).code, 0);
  const record = readRec(root);
  assert.equal(record.handed.key, v.progress_key);
  assert.equal(typeof record.handed.at, 'string');
  assert.equal(JSON.parse(viewOf(root).stdout).kind, 'blocked', 'the stage did not move: no-progress');
});

test('change-loop compozy confirm: the kinds it records and the kinds it clears the handed key for', () => {
  const view = (kind) => ({ kind, progress_key: `key/${kind}` });
  const recorded = ['agent', 'coordinator', 'review', 'gate', 'command', 'open'];
  const cleared = ['grill', 'mockup', 'approval', 'retro-answers', 'owner', 'blocked', 'github', 'archived'];
  assert.deepEqual(changeLoopModule.HANDED_KINDS, recorded);
  for (const kind of [...recorded, ...cleared]) {
    const after = changeLoopModule.afterConfirm(rec({ handed: { key: 'old', at: 't' } }), { view: view(kind), uses: null }, { kind: 'agent', stage: 'proposal' }, 'now');
    assert.deepEqual(after.handed, recorded.includes(kind) ? { key: `key/${kind}`, at: 'now' } : null, kind);
  }
});

test('change-loop compozy confirm: each recorded answer is cleared once the view built from it is confirmed, and no other', () => {
  const full = () => rec({ failed: { key: 'k', reply: 'r', at: 't' }, answers: { grill: [{ question: 'q', answer: 'a', at: 't' }], approvalNotes: 'notes', retro: 'retro', mockup: 'words' } });
  const confirm = (uses, action = { kind: 'grill', stage: 'requirements' }) => changeLoopModule.afterConfirm(full(), { view: { kind: 'agent', progress_key: 'k2' }, uses }, action, 'now');
  const keep = confirm(null);
  assert.deepEqual([keep.answers.approvalNotes, keep.answers.retro, keep.answers.mockup], ['notes', 'retro', 'words'], 'a view not built from them leaves them');
  assert.equal(keep.failed, null, 'a recorded failure goes once a view not built from it is confirmed');
  assert.equal(keep.answers.grill.length, 1, 'the grill answers stay while the grill is on');
  assert.equal(confirm('notes').answers.approvalNotes, null);
  assert.deepEqual([confirm('notes').answers.retro, confirm('notes').answers.mockup], ['retro', 'words']);
  assert.equal(confirm('retro').answers.retro, null);
  assert.equal(confirm('retro').answers.approvalNotes, 'notes');
  assert.equal(confirm('mockup').answers.mockup, null);
  assert.equal(confirm('mockup').answers.retro, 'retro');
  assert.deepEqual(confirm('failure').failed, { key: 'k', reply: 'r', at: 't' }, 'the failure view keeps its failure');
  assert.deepEqual(confirm(null, { kind: 'agent', stage: 'proposal' }).answers.grill, [], 'the grill answers go once the requirements stage has passed');
  assert.equal(confirm(null, { kind: 'open', stage: 'open' }).answers.grill.length, 1, 'an open turn is before the grill');
});

// ---------------------------------------------------------------- the record steps (D-4)

const step = (cwd, argv, { env = cleanEnv, stdin = '' } = {}) => main([...argv, '--lang', 'en'], { cwd, env, stdin });
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const changeFile = (root, f) => join(root, 'openspec', 'changes', 'feat', f);

test('change-loop compozy record-approval: it writes approval.md in the form of the ship-change row, and approvalState reads it back as ok', () => {
  const root = approvalPlan();
  const r = step(root, ['record-approval', '--change', 'feat', '--words', 'Looks good, go ahead']);
  assert.equal(r.code, 0, r.stdout + r.stderr);
  const text = readFileSync(changeFile(root, 'approval.md'), 'utf8');
  const sha = git(root, 'rev-parse', 'HEAD').trim();
  const readiness = approvalState(join(root, 'openspec', 'changes', 'feat')).readiness;
  assert.equal(text, `<!-- devkit-stage approval result=passed attempt=1 commit=${sha} -->\n# Plan approval: feat\n\n- Status: APPROVED\n- Readiness: ${readiness}\n- Date: ${today()}\n- Owner's words: "\`Looks good, go ahead\`"\n`);
  assert.equal(approvalState(join(root, 'openspec', 'changes', 'feat')).ok, true);
  assert.deepEqual(['view', 'approval'].length, 2);
});

test('change-loop compozy record-approval: words over 200 characters are cut, and a replaced approval raises the attempt', () => {
  const root = approvalPlan();
  put(root, { 'openspec/changes/feat/approval.md': '<!-- devkit-stage approval result=passed attempt=2 commit=none -->\n# Plan approval: feat\n\n- Status: APPROVED\n- Readiness: sha256:000000000000\n- Date: 2026-01-01\n- Owner\'s words: "`old`"\n' });
  utimesSync(changeFile(root, 'approval.md'), 1, 1); // older than readiness.md: the checker finds it stale and asks again
  const r = step(root, ['record-approval', '--change', 'feat', '--words', `${'x'.repeat(250)}`]);
  assert.equal(r.code, 0, r.stdout + r.stderr);
  const text = readFileSync(changeFile(root, 'approval.md'), 'utf8');
  assert.match(text.split('\n')[0], /attempt=3 /, 'one more than the replaced header');
  assert.ok(text.includes(`"\`${'x'.repeat(200)}\`"`) && !text.includes('x'.repeat(201)), 'cut to 200 characters');
});

test('change-loop compozy record-approval: refused while the readiness review is due, with approval.md absent or unchanged', () => {
  const due = planChange({ have: ['requirements', 'proposal', 'specs', 'design', 'tasks'] });
  const r = step(due, ['record-approval', '--change', 'feat', '--words', 'go']);
  assert.equal(r.code, 3, r.stdout);
  assert.equal(existsSync(changeFile(due, 'approval.md')), false, 'no approval.md');
  const stale = planChange({ have: ['requirements', 'proposal', 'specs', 'design', 'tasks'] });
  const old = '<!-- devkit-stage approval result=passed attempt=1 commit=none -->\n# Plan approval: feat\n\n- Status: APPROVED\n- Readiness: sha256:000000000000\n- Date: 2026-01-01\n- Owner\'s words: "`old`"\n';
  put(stale, { 'openspec/changes/feat/approval.md': old });
  assert.equal(step(stale, ['record-approval', '--change', 'feat', '--words', 'go']).code, 3);
  assert.equal(readFileSync(changeFile(stale, 'approval.md'), 'utf8'), old, 'byte for byte');
});

test('change-loop compozy record-answer: a grill answer is appended while the grill is on, refused for another gate, and the record is kept', () => {
  const root = planChange({ have: [] });
  assert.equal(JSON.parse(viewOf(root).stdout).kind, 'grill');
  const one = step(root, ['record-answer', '--change', 'feat', '--gate', 'grill', '--answer', 'The admins', '--question', 'Who uses it?']);
  assert.equal(one.code, 0, one.stdout + one.stderr);
  const two = step(root, ['record-answer', '--change', 'feat', '--gate', 'grill', '--answer', 'Weekly']);
  assert.equal(two.code, 0);
  assert.deepEqual(readRec(root).answers.grill.map((a) => [a.question, a.answer]), [['Who uses it?', 'The admins'], ['', 'Weekly']]);
  const before = readFileSync(recFile(root), 'utf8');
  for (const gate of ['approval', 'retro']) {
    assert.equal(step(root, ['record-answer', '--change', 'feat', '--gate', gate, '--answer', 'x']).code, 3, gate);
  }
  assert.equal(step(root, ['record-answer', '--change', 'feat', '--gate', 'nonsense', '--answer', 'x']).code, 3);
  assert.equal(readFileSync(recFile(root), 'utf8'), before, 'the record is unchanged');
});

test('change-loop compozy record-answer: a grill answer is refused while the view is the plan approval, and the notes of the approval are set', () => {
  const root = approvalPlan();
  const refused = step(root, ['record-answer', '--change', 'feat', '--gate', 'grill', '--answer', 'x']);
  assert.equal(refused.code, 3);
  assert.equal(existsSync(recFile(root)), false, 'nothing was recorded');
  assert.equal(step(root, ['record-answer', '--change', 'feat', '--gate', 'approval', '--answer', 'drop the export']).code, 0);
  assert.equal(readRec(root).answers.approvalNotes, 'drop the export');
  const view = JSON.parse(viewOf(root).stdout);
  assert.deepEqual([view.kind, view.agent], ['agent', 'change-planner']);
  assert.equal(step(root, ['record-answer', '--change', 'feat', '--gate', 'approval', '--answer', 'again']).code, 3, 'the planner revises now: no second answer');
});

test('change-loop compozy record-answer: the retro answer is set by applyAnswer, as the other two gates are', () => {
  const apply = changeLoopModule.applyAnswer;
  const base = rec();
  assert.equal(apply(base, 'retro', { answer: '1: approve', at: 'now' }).answers.retro, '1: approve');
  assert.equal(apply(base, 'approval', { answer: 'notes', at: 'now' }).answers.approvalNotes, 'notes');
  assert.deepEqual(apply(base, 'grill', { answer: 'a', question: 'q', at: 'now' }).answers.grill, [{ question: 'q', answer: 'a', at: 'now' }]);
  assert.deepEqual(base, emptyRec(), 'the given record is not changed');
});

// A change at the mock-up: the grill flagged a screen, the mock-up is drawn and waits for the owner.
function mockupChange() {
  const root = gitRepo({ config: 'schema: devkit\n' });
  const c0 = git(root, 'rev-parse', 'HEAD').trim();
  put(root, {
    'openspec/changes/feat/.openspec.yaml': 'schema: devkit\n',
    'openspec/changes/feat/requirements.md': `${head('requirements', c0)}# Requirements\n\n- Classification: script=devkit flags=[ui]\n`,
    'openspec/changes/feat/mockup.md': `${head('mockup', c0, 'pending')}# Mock-up\n\n- mock/screen.html\n`,
  });
  commitAll(root, 'a drawn mock-up');
  return root;
}

test('change-loop compozy record-mockup: approve writes the passed header, the approval section, and the record keeps the words', () => {
  const root = mockupChange();
  assert.equal(JSON.parse(viewOf(root).stdout).kind, 'mockup');
  const r = step(root, ['record-mockup', '--change', 'feat', '--decision', 'approve', '--words', 'looks right, keep the filters']);
  assert.equal(r.code, 0, r.stdout + r.stderr);
  const sha = git(root, 'rev-parse', 'HEAD').trim();
  const text = readFileSync(changeFile(root, 'mockup.md'), 'utf8');
  assert.equal(text.split('\n')[0], `<!-- devkit-stage mockup result=passed attempt=1 commit=${sha} -->`);
  assert.ok(text.endsWith(`\n## Owner's approval\n\n- Date: ${today()}\n- Owner's words: "looks right, keep the filters"\n`), text);
  assert.ok(text.includes('# Mock-up') && text.includes('mock/screen.html'), 'the rest of the file is kept');
  assert.equal(readRec(root).answers.mockup, 'looks right, keep the filters');
  const flow = spawnSync(process.execPath, [join(HERE, 'flow-check.mjs'), 'feat', '--json'], { cwd: root, env: cleanEnv, encoding: 'utf8' });
  const mock = JSON.parse(flow.stdout).stages.find((x) => x.id === 'mockup');
  assert.equal(mock.state, 'passed', flow.stdout + flow.stderr);
  const view = JSON.parse(viewOf(root).stdout);
  assert.deepEqual([view.kind, view.agent, view.progress_key], ['coordinator', 'change-coordinator', 'mockup-facts/feat'], 'the facts go to the coordinator next');
});

test('change-loop compozy record-mockup: changes writes the failed header and the notes, the record keeps nothing, and the designer is handed the notes', () => {
  const root = mockupChange();
  const r = step(root, ['record-mockup', '--change', 'feat', '--decision', 'changes', '--words', 'make the table wider']);
  assert.equal(r.code, 0, r.stdout + r.stderr);
  const text = readFileSync(changeFile(root, 'mockup.md'), 'utf8');
  assert.match(text.split('\n')[0], /^<!-- devkit-stage mockup result=failed attempt=1 commit=[0-9a-f]{40} -->$/);
  assert.ok(text.endsWith('\n## Owner\'s notes (attempt 1)\n\nmake the table wider\n'), text);
  assert.equal(existsSync(recFile(root)) ? readRec(root).answers.mockup : null, null, 'no words recorded');
  const view = JSON.parse(viewOf(root).stdout);
  assert.deepEqual([view.kind, view.agent], ['agent', 'screen-designer']);
  assert.ok(view.brief.includes('the owner asked for changes at attempt 1'), view.brief);
});

test('change-loop compozy record-mockup: words over 200 characters are cut, and an unknown decision is refused', () => {
  const root = mockupChange();
  const bad = step(root, ['record-mockup', '--change', 'feat', '--decision', 'maybe', '--words', 'x']);
  assert.equal(bad.code, 3);
  assert.match(readFileSync(changeFile(root, 'mockup.md'), 'utf8'), /result=pending/, 'unchanged');
  assert.equal(step(root, ['record-mockup', '--change', 'feat', '--decision', 'approve', '--words', 'y'.repeat(250)]).code, 0);
  const text = readFileSync(changeFile(root, 'mockup.md'), 'utf8');
  assert.ok(text.includes(`"${'y'.repeat(200)}"`) && !text.includes('y'.repeat(201)));
});

test('change-loop compozy record-mockup: refused while the view is the plan approval, and when mockup.md has no valid header', () => {
  const approval = approvalPlan();
  put(approval, { 'openspec/changes/feat/mockup.md': '# Mock-up\n' });
  const before = readFileSync(changeFile(approval, 'mockup.md'), 'utf8');
  assert.equal(step(approval, ['record-mockup', '--change', 'feat', '--decision', 'approve', '--words', 'ok']).code, 3);
  assert.equal(readFileSync(changeFile(approval, 'mockup.md'), 'utf8'), before, 'byte for byte');
  const root = mockupChange();
  for (const first of ['# Mock-up\n', '<!-- devkit-stage mockup result=maybe attempt=1 commit=none -->\n# Mock-up\n', '<!-- devkit-stage design result=passed attempt=1 commit=none -->\n# Mock-up\n']) {
    put(root, { 'openspec/changes/feat/mockup.md': first });
    const r = step(root, ['record-mockup', '--change', 'feat', '--decision', 'approve', '--words', 'ok']);
    assert.equal(r.code, 3, first);
    assert.equal(readFileSync(changeFile(root, 'mockup.md'), 'utf8'), first, `unchanged: ${first}`);
  }
});

// A change on the short script at the plan, right after the owner's approval of a plan that lists decision records.
const proposedRecords = () => adrChange({ records: { [`${ADR_FOLDER}/0001-a.md`]: adrRecord('Status: proposed') } });
const stuckRecords = () => adrChange({ records: { [`${ADR_FOLDER}/0001-a.md`]: adrRecord('Status: proposed') }, listed: [`${ADR_FOLDER}/0001-a.md`, `${ADR_FOLDER}/0002-none.md`] });

test('change-loop compozy run-step: a command step runs the checker\'s argv in the root, and a success clears a recorded failure', () => {
  const root = proposedRecords();
  const view = JSON.parse(viewOf(root).stdout);
  assert.deepEqual([view.kind, view.step], ['command', 'accept-decisions'], JSON.stringify(view));
  put(root, { '.git/devkit-compozy/feat.json': JSON.stringify({ ...emptyRec(), failed: { key: 'old/key', reply: 'earlier', at: 't' } }) });
  const r = step(root, ['run-step', '--change', 'feat']);
  assert.equal(r.code, 0, r.stdout + r.stderr);
  assert.match(readFileSync(join(root, ADR_FOLDER, '0001-a.md'), 'utf8'), /Status: accepted/i);
  assert.equal(readRec(root).failed, null);
});

test('change-loop compozy run-step: a refused command changes no file, records its own reply as the failure and exits 1', () => {
  const root = stuckRecords();
  const before = treeOf(root);
  const view = JSON.parse(viewOf(root).stdout);
  assert.equal(view.kind, 'command');
  const r = step(root, ['run-step', '--change', 'feat']);
  assert.equal(r.code, 1, r.stdout + r.stderr);
  assert.equal(treeOf(root).replace(/"[^"]*devkit-compozy[^"]*":"[^"]*",?/g, ''), before.replace(/"[^"]*devkit-compozy[^"]*":"[^"]*",?/g, ''), 'no listed file changed');
  const failed = readRec(root).failed;
  assert.equal(failed.key, view.progress_key);
  assert.match(failed.reply, /decision records could not be marked accepted/);
  assert.match(failed.reply, /0002-none\.md/, 'it names the file');
  const next1 = JSON.parse(viewOf(root).stdout);
  assert.deepEqual([next1.kind, next1.question], ['blocked', failed.reply], 'the next turn asks the owner with the command\'s own reply');
  assert.equal(step(root, ['compozy-retry', '--change', 'feat']).code, 0);
  assert.deepEqual(readRec(root).failed, null);
  assert.equal(readRec(root).handed, null);
  assert.equal(JSON.parse(viewOf(root).stdout).kind, 'command', 'retry hands the command again');
});

test('change-loop compozy run-step: refused while the view is not a command, running nothing', () => {
  const root = planChange({ have: ['requirements'] });
  const r = step(root, ['run-step', '--change', 'feat']);
  assert.equal(r.code, 3);
  assert.equal(existsSync(recFile(root)), false);
});

test('change-loop compozy run-step: a command with no JSON on a non-zero exit records the role-failed reply', () => {
  const out = changeLoopModule.runViewCommand(['node', '-e', 'process.stderr.write("boom"); process.exit(4)'], { cwd: tmpRoot(), lang: 'en', id: 'feat', stageTitle: 'Proposal' });
  assert.equal(out.ok, false);
  assert.equal(out.reply, render('en', 'blocked', { id: 'feat', why: 'role-failed', stage: 'Proposal' }));
  const json = changeLoopModule.runViewCommand(['node', '-e', 'console.log(JSON.stringify({reply:"its own words"})); process.exit(3)'], { cwd: tmpRoot(), lang: 'en', id: 'feat', stageTitle: 'Proposal' });
  assert.deepEqual([json.ok, json.reply], [false, 'its own words']);
  assert.equal(changeLoopModule.runViewCommand(['node', '-e', '0'], { cwd: tmpRoot(), lang: 'en', id: 'feat', stageTitle: 'x' }).ok, true);
});

test('change-loop compozy run-step: switch-script runs the script subcommand and exits 0', () => {
  const root = gitRepo({ config: 'schema: devkit\n' });
  const c0 = git(root, 'rev-parse', 'HEAD').trim();
  put(root, {
    'openspec/changes/feat/.openspec.yaml': 'schema: devkit-lite\n',
    'openspec/changes/feat/requirements.md': `${head('requirements', c0)}# Requirements\n\n- Classification: script=devkit-lite flags=[architecture]\n`,
  });
  commitAll(root, 'a flagged short change');
  const view = JSON.parse(viewOf(root).stdout);
  assert.deepEqual([view.kind, view.step], ['command', 'switch-script'], JSON.stringify(view));
  const r = step(root, ['run-step', '--change', 'feat']);
  assert.equal(r.code, 0, r.stdout + r.stderr);
  assert.match(readFileSync(changeFile(root, '.openspec.yaml'), 'utf8'), /^schema: devkit$/m);
});

// A change whose delivery checker hands the gate: a short-script change with its code done and its gate task open.
function gateChange(command) {
  const { t, wt, env } = deliveredChange({ checks: [check('build', 'pass')], mergeable: 'MERGEABLE' });
  const sha = git(wt, 'rev-parse', 'HEAD').trim();
  put(wt, { 'openspec/changes/feat/tasks.md': `${head('tasks', sha)}# Tasks\n\n## 1. First\n- [x] 1.1 code\n- [ ] 1.2 Gate: \`${command}\` green\n` });
  commitAll(wt, 'an open gate');
  return { t, wt, env };
}

test('change-loop compozy run-gate: the gate runs part by part in the root and a green one ticks its task', () => {
  const { wt, env } = gateChange('true && true');
  const view = JSON.parse(viewOf(wt, { env }).stdout);
  assert.deepEqual([view.kind, view.step], ['gate', 'gate'], JSON.stringify(view));
  const r = step(wt, ['run-gate', '--change', 'feat'], { env });
  assert.equal(r.code, 0, r.stdout + r.stderr);
  assert.match(readFileSync(join(wt, 'openspec', 'changes', 'feat', 'tasks.md'), 'utf8'), /- \[x\] 1\.2 Gate:/);
});

test('change-loop compozy run-gate: a red part exits 1 and ticks nothing, and it refuses when the view is not the gate', () => {
  const { t, wt, env } = gateChange('true && false && true');
  const before = readFileSync(join(wt, 'openspec', 'changes', 'feat', 'tasks.md'), 'utf8');
  const red = step(wt, ['run-gate', '--change', 'feat'], { env });
  assert.equal(red.code, 1, red.stdout);
  assert.equal(readFileSync(join(wt, 'openspec', 'changes', 'feat', 'tasks.md'), 'utf8'), before);
  const elsewhere = planChange({ have: ['requirements'] });
  assert.equal(step(elsewhere, ['run-gate', '--change', 'feat']).code, 3);
  assert.ok(t);
});

// ---------------------------------------------------------------- the record steps under a handed key (task 4.11)

// `confirm` records the key of the step just handed, and the record step then runs with nothing changed yet: the record holds the
// key of the very step under test. The record steps must compute the step they check without that key as `--after`.
const handedAs = (cwd, view, over = {}) => {
  const file = changeLoopModule.runRecordPath(cwd, 'feat');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(rec({ handed: { key: view.progress_key, at: 't' }, ...over })));
  return file;
};
const tasksOf = (root) => readFileSync(join(root, 'openspec', 'changes', 'feat', 'tasks.md'), 'utf8');

test('change-loop compozy handed key: run-gate runs the gate and ticks its task when the record holds the key of the gate', () => {
  const { wt, env } = gateChange('true && true');
  const view = JSON.parse(viewOf(wt, { env }).stdout);
  assert.equal(view.kind, 'gate');
  handedAs(wt, view);
  const r = step(wt, ['run-gate', '--change', 'feat'], { env });
  assert.equal(r.code, 0, r.stdout + r.stderr);
  assert.equal(JSON.parse(r.stdout).green, true);
  assert.match(tasksOf(wt), /- \[x\] 1\.2 Gate:/);
});

test('change-loop compozy handed key: a red run-gate still exits 1 with the part that failed and the output tail, and ticks nothing', () => {
  const { wt, env } = gateChange('true && echo tail-line; false');
  const view = JSON.parse(viewOf(wt, { env }).stdout);
  assert.equal(view.kind, 'gate');
  handedAs(wt, view);
  const before = tasksOf(wt);
  const r = step(wt, ['run-gate', '--change', 'feat'], { env });
  assert.equal(r.code, 1, r.stdout + r.stderr);
  const body = JSON.parse(r.stdout);
  assert.deepEqual([body.green, body.task, body.failed, body.output], [false, '1.2', 'echo tail-line; false', 'tail-line']);
  assert.equal(tasksOf(wt), before, 'nothing ticked');
});

test('change-loop compozy handed key: confirm records the gate as handed, and run-gate then runs it, as the live run does', () => {
  const { wt, env } = gateChange('true');
  const view = JSON.parse(viewOf(wt, { env }).stdout);
  const ok = confirmRun(wt, view, { env });
  assert.equal(ok.code, 0, ok.stdout + ok.stderr);
  const file = changeLoopModule.runRecordPath(wt, 'feat');
  assert.equal(JSON.parse(readFileSync(file, 'utf8')).handed.key, view.progress_key);
  const r = step(wt, ['run-gate', '--change', 'feat'], { env });
  assert.equal(r.code, 0, r.stdout + r.stderr);
  assert.match(tasksOf(wt), /- \[x\] 1\.2 Gate:/);
});

test('change-loop compozy handed key: run-step runs the command of the step the record holds the key of', () => {
  const root = proposedRecords();
  const view = JSON.parse(viewOf(root).stdout);
  assert.deepEqual([view.kind, view.step], ['command', 'accept-decisions']);
  handedAs(root, view);
  const r = step(root, ['run-step', '--change', 'feat']);
  assert.equal(r.code, 0, r.stdout + r.stderr);
  assert.match(readFileSync(join(root, ADR_FOLDER, '0001-a.md'), 'utf8'), /Status: accepted/i);
});

test('change-loop compozy handed key: record-approval writes approval.md when the record holds the key of the approval', () => {
  const root = approvalPlan();
  const view = JSON.parse(viewOf(root).stdout);
  assert.equal(view.kind, 'approval');
  handedAs(root, view);
  const r = step(root, ['record-approval', '--change', 'feat', '--words', 'go ahead']);
  assert.equal(r.code, 0, r.stdout + r.stderr);
  assert.equal(approvalState(join(root, 'openspec', 'changes', 'feat')).ok, true);
});

test('change-loop compozy handed key: record-mockup writes mockup.md when the record holds the key of the mock-up', () => {
  const root = mockupChange();
  const view = JSON.parse(viewOf(root).stdout);
  assert.equal(view.kind, 'mockup');
  handedAs(root, view);
  const r = step(root, ['record-mockup', '--change', 'feat', '--decision', 'approve', '--words', 'looks right']);
  assert.equal(r.code, 0, r.stdout + r.stderr);
  assert.match(readFileSync(changeFile(root, 'mockup.md'), 'utf8'), /result=passed/);
});

test('change-loop compozy handed key: record-answer writes a grill answer when the record holds the key of the grill', () => {
  const root = planChange({ have: [] });
  const view = JSON.parse(viewOf(root).stdout);
  assert.equal(view.kind, 'grill');
  handedAs(root, view);
  const r = step(root, ['record-answer', '--change', 'feat', '--gate', 'grill', '--answer', 'The admins', '--question', 'Who uses it?']);
  assert.equal(r.code, 0, r.stdout + r.stderr);
  assert.deepEqual(readRec(root).answers.grill.map((a) => [a.question, a.answer]), [['Who uses it?', 'The admins']]);
});

test('change-loop compozy handed key: record-answer writes the retro answers when the record holds the key of the retro', () => {
  const t = pm();
  const at = (f) => join(t.root, 'openspec', 'changes', 'feat', f);
  const staged = (stage, body) => `<!-- devkit-stage ${stage} result=passed attempt=1 commit=none -->\n${body}`;
  put(t.root, { // a change of the current script, every stage passed: the merged change waits for its retro answers
    'openspec/changes/feat/requirements.md': staged('requirements', '# Requirements\n'),
    'openspec/changes/feat/proposal.md': staged('proposal', readFileSync(at('proposal.md'), 'utf8')),
    'openspec/changes/feat/specs/s/spec.md': staged('specs', '# Spec\n'),
    'openspec/changes/feat/tasks.md': staged('tasks', readFileSync(at('tasks.md'), 'utf8')),
    'openspec/changes/feat/review.md': staged('review', 'Consensus: PASS (round 1/2)\n\n# Review\n'),
    'openspec/changes/feat/evidence.md': staged('evidence', 'Commit: none\n\n# Evidence\n'),
  });
  commitAll(t.root, 'a staged change');
  writeRetro(t, retroMd(proposal(['CONTRIBUTING.md'])));
  const view = JSON.parse(viewOf(t.root, { env: t.env }).stdout);
  assert.equal(view.kind, 'retro-answers', JSON.stringify(view));
  handedAs(t.root, view);
  const r = step(t.root, ['record-answer', '--change', 'feat', '--gate', 'retro', '--answer', '1: approve'], { env: t.env });
  assert.equal(r.code, 0, r.stdout + r.stderr);
  assert.equal(JSON.parse(readFileSync(changeLoopModule.runRecordPath(t.root, 'feat'), 'utf8')).answers.retro, '1: approve');
});

test('change-loop compozy handed key: next --view compozy with the key of the gate and nothing changed is still blocked with no-progress', () => {
  const { wt, env } = gateChange('true');
  const view = JSON.parse(viewOf(wt, { env }).stdout);
  handedAs(wt, view);
  const again = JSON.parse(viewOf(wt, { env }).stdout);
  assert.deepEqual([again.kind, again.progress_key], ['blocked', `end/blocked/no-progress/${view.stage}`]);
});

test('change-loop compozy handed key: confirm still refuses a view that differs from the guarded one, and records nothing', () => {
  const { wt, env } = gateChange('true');
  const view = JSON.parse(viewOf(wt, { env }).stdout);
  const file = handedAs(wt, view);
  const before = readFileSync(file, 'utf8');
  const r = confirmRun(wt, view, { env });
  assert.equal(r.code, 1, 'the gate view is not the current view: the checker says no-progress');
  assert.deepEqual([JSON.parse(r.stdout).kind, JSON.parse(r.stdout).progress_key], ['blocked', `end/blocked/no-progress/${view.stage}`]);
  assert.equal(readFileSync(file, 'utf8'), before, 'the record is left as it was');
});

test('change-loop compozy retry: it clears the handed key and a recorded failure, and only those', () => {
  const root = planChange({ have: ['requirements'] });
  put(root, { '.git/devkit-compozy/feat.json': JSON.stringify({ ...emptyRec(), handed: { key: 'k', at: 't' }, failed: { key: 'k', reply: 'r', at: 't' }, answers: { grill: [{ question: 'q', answer: 'a', at: 't' }], approvalNotes: 'n', retro: null, mockup: null } }) });
  assert.equal(step(root, ['compozy-retry', '--change', 'feat']).code, 0);
  const record = readRec(root);
  assert.deepEqual([record.handed, record.failed, record.answers.approvalNotes, record.answers.grill.length], [null, null, 'n', 1]);
});

test('change-loop compozy record steps: a change name that is not one, and a missing option, are usage errors that touch nothing', () => {
  const root = planChange({ have: ['requirements'] });
  for (const argv of [['record-approval', '--change', '../x', '--words', 'y'], ['record-approval', '--change', 'feat'], ['record-answer', '--change', 'feat', '--gate', 'grill'], ['confirm', '--change', 'feat'], ['compozy-retry'], ['run-step', '--bogus', 'x']]) {
    const r = step(root, argv);
    assert.equal(r.code, 3, argv.join(' '));
  }
  assert.equal(existsSync(join(root, '.git', 'devkit-compozy')), false);
});

test('change-loop compozy usage: the usage line names every new subcommand', () => {
  const r = main(['teleport', '--lang', 'en'], { cwd: tmpRoot(), env: cleanEnv });
  for (const name of ['compozy-start', 'confirm', 'record-approval', 'record-mockup', 'record-answer', 'run-gate', 'run-step', 'compozy-retry', '--view']) {
    assert.ok(JSON.parse(r.stdout).error.includes(name) || r.stderr.includes(name), name);
  }
});

// ================================================================ roadmap-sessions-upfront, phase 2: the wait loop of a change session (design D-6)

test('upfront AC-9 waitLoop: a given predicate keeps waiting while it holds and failWhy names the end', async () => {
  const held = (why, reply) => ({ version: 1, change: 'feat', script: 'devkit', root: '/w', branch: 'feat', filesLanguage: 'en', kind: 'held', held: { why }, stage: 'implementation', reply, progressKey: `held/${why}` });
  const done = { version: 1, change: 'feat', kind: 'agent', stage: 'implementation', progressKey: 'implementation/implement@abc' };
  const waiting = (a) => a.kind === 'held';
  // A held decision that only changes its words (the load moves every poll) keeps the wait; a new reason or a new action ends it.
  const sleeps = [];
  let polls = 0;
  const script = [held('load', 'load 91%'), held('load', 'load 88%'), held('load', 'load 85%'), done];
  const kept = await waitLoop({ poll: async () => script[polls++], sleep: async (s) => { sleeps.push(s); }, interval: 60, id: 'feat', lang: 'en', waiting });
  assert.deepEqual(kept, done);
  assert.equal(polls, 4);
  assert.deepEqual(sleeps, [60, 60, 60]);
  const changed = [held('place', 'a'), held('place', 'b'), held('load', 'c')];
  let n = 0;
  const reason = await waitLoop({ poll: async () => changed[n++], sleep: async () => {}, interval: 60, id: 'feat', lang: 'en', waiting });
  assert.equal(reason.held.why, 'load', 'a new reason to wait ends the wait');
  // A first decision that is not a wait comes back at once.
  assert.deepEqual(await waitLoop({ poll: async () => done, sleep: async () => { throw new Error('slept'); }, interval: 60, id: 'feat', lang: 'en', waiting }), done);
  // Three failed polls in a row end it blocked with the reason the caller names; the default stays the GitHub one.
  const failing = async () => { throw new Error('boom'); };
  const calls = [];
  const first = async () => { calls.push('first'); return held('place', 'a'); };
  let k = 0;
  const poll = async () => (k++ === 0 ? first() : failing());
  const blocked = await waitLoop({ poll, sleep: async () => {}, interval: 60, id: 'feat', lang: 'en', waiting, failWhy: 'unreadable' });
  assert.deepEqual([blocked.kind, blocked.end.state, blocked.end.why], ['end', 'blocked', 'unreadable']);
  assert.match(blocked.reply, /boom/);
  let j = 0;
  const gh = await waitLoop({ poll: async () => (j++ === 0 ? WAIT : failing()), sleep: async () => {}, interval: 60, id: 'feat', lang: 'en' });
  assert.equal(gh.end.why, 'github-unreadable', 'the default end is the GitHub one');
});

// ================================================================ roadmap-sessions-upfront, phase 3: a lone change schedules nothing (design D-9, AC-16)

test('upfront AC-16 next: no action of a change run asks for a schedule', () => {
  const actions = [
    run({ rep: { next: nextOf(FLOWS.devkit, 'requirements', 'no-file') } }),
    run({ rep: { next: nextOf(FLOWS.devkit, 'proposal', 'no-file'), stages: { proposal: { state: 'pending', reasonCode: 'no-file' } } } }),
    run({ rep: { end: endOf('waiting-for-owner', 'requirements', 'owner-pending') } }),
    build(rowOf('implement', { phase: 1 })),
    build(rowOf('review', { reviewers: ['code-quality-reviewer'], round: 1 })),
    build(rowOf('retro')),
    build(rowOf('wait-checks', { pending: ['build'] })),
    build(rowOf('wait-merge', { number: 12 })),
    run({ report: { ...reportOf(FLOWS.devkit, { end: endOf('archived', null, 'archived') }), stages: [] } }),
    run({ rep: { end: endOf('blocked', 'delivery', 'pr-closed', { number: 12 }) }, facts: { row: rowOf('implement', { phase: 1 }) } }),
  ];
  assert.ok(new Set(actions.map((a) => a.kind)).size >= 4, 'the fixtures cover every kind of action');
  for (const a of actions) {
    assert.ok(!['schedule-check', 'delete-check', 'push', 'triage', 'archive-session', 'stop-own-tasks'].includes(a.kind), a.kind);
    assert.doesNotMatch(JSON.stringify(a), /schedule-check|CronCreate|CronDelete|wake_when_done|"cron"|"recurring"/, a.kind);
  }
});

// ================================================================ roadmap-sessions-upfront, phase 4: the triage and the drift (design D-4, D-10, AC-5, AC-6, AC-11)

const triageUnsourced = (text) => changeLoopModule.triageUnsourced(text);
const TRIAGE_HEAD = '### Answered by triage';
const SRC = '(source: `docs/adr/0013-x.md:12`)';

// Invariant (AC-6, change-loop, change-loop): the requirements stage passed with a triage answer that names no source goes
// back to its grill, which names the question; a file whose triage answers all name theirs leaves the plan going.
test('upfront AC-6 triage: an answer under the triage heading with no source sends the change back to its grill naming it', () => {
  const root = planChange({ have: ['requirements', 'decisions'] });
  const file = join(root, 'openspec', 'changes', 'feat', 'requirements.md');
  const header = readFileSync(file, 'utf8').split('\n')[0];
  const write = (body) => { put(root, { 'openspec/changes/feat/requirements.md': `${header}\n# requirements\n\n${body}\n` }); commitAll(root, 'triage answers'); };
  write(`${TRIAGE_HEAD}\n\n1. [scope] May it use a cron? → yes\n2. [edges] Is it atomic? → yes ${SRC}\n`);
  const r = next(root);
  assert.equal(r.code, 0, r.stderr);
  const { action } = parsed(r);
  assert.deepEqual([action.kind, action.stage, action.role], ['grill', 'requirements', 'change-coordinator']);
  assert.deepEqual(action.detail, { unsourced: ['[scope] May it use a cron? → yes'] }, 'only the question with no source, named');
  write(`${TRIAGE_HEAD}\n\n1. [edges] Is it atomic? → yes ${SRC}\n`);
  const sourced = parsed(next(root)).action;
  assert.deepEqual([sourced.kind, sourced.agent], ['agent', PLANNER], 'every answer names its source: the plan goes on');
});

test('upfront AC-6 triage: decide gives the grill only in the plan part, only when the requirements stage passed and only for a non-empty list', () => {
  const rep = { next: nextOf(FLOWS.devkit, 'proposal', 'no-file'), stages: { proposal: { state: 'pending', reasonCode: 'no-file' } } };
  const grill = run({ rep, facts: { unsourced: ['q'] } });
  assert.deepEqual([grill.kind, grill.stage, grill.detail, exitCodeOf(grill)], ['grill', 'requirements', { unsourced: ['q'] }, 0]);
  assert.equal(grill.progressKey, `requirements/requirements@abc123`);
  assert.equal(run({ rep, facts: { unsourced: [] } }).kind, 'agent', 'an empty list');
  assert.equal(run({ rep, facts: {} }).kind, 'agent', 'no list');
  const inBuild = build(rowOf('implement', { phase: 1 }), { unsourced: ['q'] });
  assert.deepEqual([inBuild.kind, inBuild.step], ['agent', 'implement'], 'from the implementation on the list is not read');
  const notPassed = run({ rep: { next: nextOf(FLOWS.devkit, 'requirements', 'no-file'), stages: { requirements: { state: 'pending', reasonCode: 'no-file' } } }, facts: { unsourced: ['q'] } });
  assert.deepEqual([notPassed.kind, notPassed.detail], ['grill', undefined], 'a grill that was already due carries no list');
});

test('upfront AC-6 triage: the heading\'s end, an unclosed fence, an item over indented lines, no heading and an empty section', () => {
  // the section runs to the next heading of level 1 to 3, or to the end of the file
  assert.deepEqual(triageUnsourced(`# R\n\n${TRIAGE_HEAD}\n\n1. a\n2. b ${SRC}\n\n## Next\n\n3. c\n`), ['a'], 'a level 2 heading ends it');
  assert.deepEqual(triageUnsourced(`${TRIAGE_HEAD}\n\n- a\n\n# Top\n- b\n`), ['a'], 'a level 1 heading ends it');
  assert.deepEqual(triageUnsourced(`${TRIAGE_HEAD}\n\n- a\n\n### Other\n- b\n`), ['a'], 'a level 3 heading ends it');
  assert.deepEqual(triageUnsourced(`${TRIAGE_HEAD}\n\n- a\n\n#### Detail\n- b\n`), ['a', 'b'], 'a level 4 heading does not');
  assert.deepEqual(triageUnsourced(`## Before\n- x\n\n${TRIAGE_HEAD}\n- a`), ['a'], 'the heading last in the file, with no newline: read to the end; items before it are not read');
  // bullets and numbers both are items
  assert.deepEqual(triageUnsourced(`${TRIAGE_HEAD}\n* a\n+ b\n3) c\n4. d\n`), ['a', 'b', 'c', 'd']);
  // fenced lines are not answers, with backticks or tildes, three or more
  assert.deepEqual(triageUnsourced(`${TRIAGE_HEAD}\n\`\`\`\n1. in fence\n\`\`\`\n2. out\n`), ['out']);
  assert.deepEqual(triageUnsourced(`${TRIAGE_HEAD}\n~~~~\n1. in fence\n~~~~\n2. out\n`), ['out']);
  // an unclosed fence skips to the end
  assert.deepEqual(triageUnsourced(`${TRIAGE_HEAD}\n1. before\n\`\`\`\n2. in fence\n## Next\n3. still in fence\n`), ['before']);
  // an item continues over its indented lines: a source there counts, and the item is named whole
  assert.deepEqual(triageUnsourced(`${TRIAGE_HEAD}\n1. a question\n   answered here ${SRC}\n2. other\n   and more\n3. last ${SRC}\n`), ['other and more']);
  assert.deepEqual(triageUnsourced(`${TRIAGE_HEAD}\n1. a\n\n   after a blank line\n`), ['a'], 'a blank line ends the item');
  // text that is no item is no answer
  assert.deepEqual(triageUnsourced(`${TRIAGE_HEAD}\nplain prose with no marker\n`), []);
  // no heading, another heading, a heading of another level, an empty section
  assert.deepEqual(triageUnsourced('# R\n\n1. a\n- b\n'), [], 'no heading');
  assert.deepEqual(triageUnsourced('### Answered by the owner\n\n1. a\n'), [], 'another heading');
  assert.deepEqual(triageUnsourced('## Answered by triage\n\n1. a\n'), [], 'the heading is level 3');
  assert.deepEqual(triageUnsourced(`${TRIAGE_HEAD}\n\n## Next\n1. a\n`), [], 'an empty section');
  assert.deepEqual(triageUnsourced(''), []);
  assert.deepEqual(triageUnsourced(`    ${TRIAGE_HEAD}\n1. a\n`), [], 'an indented heading is no heading');
});

// Invariant (AC-6, review round 1 architecture F2): one reader decides whether a requirements file holds the triage section and what its items are,
// for the loop and for the periodic check alike. Layer: triageSection and hasTriageSection. Suite: change-loop.
test('upfront AC-6 triage: triageSection and hasTriageSection read the one section, a fenced or suffixed heading being none', () => {
  const { triageSection, hasTriageSection } = changeLoopModule;
  assert.deepEqual(triageSection(`# R\n\n${TRIAGE_HEAD}\n\n1. a\n2. b ${SRC}\n\n## Next\n\n3. c\n`), ['a', `b ${SRC}`], 'every item of the section, sourced or not');
  assert.deepEqual(triageSection(`${TRIAGE_HEAD}\n\n## Next\n1. a\n`), [], 'an empty section is a section');
  assert.deepEqual(triageSection(`${TRIAGE_HEAD}\n1. a question\n   answered ${SRC}\n`), [`a question answered ${SRC}`], 'an item over its indented lines');
  assert.deepEqual(triageSection(`\`\`\`\nfenced\n\`\`\`\n${TRIAGE_HEAD}\n1. a\n`), ['a'], 'a heading after a closed fence is found');
  for (const [name, text] of Object.entries({
    'no heading': '# R\n\n1. a\n',
    'a heading inside a backtick fence': `\`\`\`md\n${TRIAGE_HEAD}\n1. a ${SRC}\n\`\`\`\n`,
    'a heading inside a tilde fence': `~~~\n${TRIAGE_HEAD}\n1. a\n~~~\n`,
    'a heading inside an unclosed fence': `\`\`\`\n${TRIAGE_HEAD}\n1. a\n`,
    'a heading with words after it': `${TRIAGE_HEAD} (draft)\n\n1. a ${SRC}\n`,
    'a heading of level 2': '## Answered by triage\n\n1. a\n',
    'an indented heading': `    ${TRIAGE_HEAD}\n1. a\n`,
    'another heading': '### Answered by the owner\n\n1. a\n',
    'an empty file': '',
  })) {
    assert.equal(triageSection(text), null, name);
    assert.equal(hasTriageSection(text), false, name);
    assert.deepEqual(triageUnsourced(text), [], `${name}: nothing unsourced either`);
  }
  assert.equal(hasTriageSection(`${TRIAGE_HEAD}\n`), true, 'the plain heading alone');
  assert.equal(hasTriageSection(`${TRIAGE_HEAD}  \t\n`), true, 'trailing blanks are allowed');
  const text = `${TRIAGE_HEAD}\n1. a\n2. b ${SRC}\n`;
  assert.deepEqual(triageUnsourced(text), triageSection(text).filter((item) => !item.includes('(source: ')), 'the loop\'s list is the section\'s items with no source');
});

test('upfront AC-5 triage: the agent file has the name, a description that says when, the tools Read, Glob and Grep only, and the Never rules', () => {
  const a = assetOf('plugins/core/agents/requirements-triage.md');
  assert.equal(a.name, 'requirements-triage');
  assert.match(a.description, /\bUse when\b/);
  assert.match(a.description, /requirements-grill/);
  assert.deepEqual(a.tools, ['Read', 'Glob', 'Grep']);
  assert.equal(a.model, 'sonnet');
  for (const h of ['## Receives', '## Method', '## Returns', '## Never']) assert.ok(a.text.includes(h), h);
  assert.ok(a.text.includes('answered: <answer> (source: `<path>[:<line>]`)'), 'the answered form');
  assert.ok(a.text.includes('owner: <why nothing written settles it>'), 'the owner form');
  const never = neverOf(a.text);
  for (const re of [/write or edit any file/i, /own judgement/i, /plan approval/i, /retro answer/i]) assert.match(never, re, String(re));
});

test('upfront AC-5 triage: requirements-triage is a helper of the requirements stage of both scripts, in both schema copies, and PACKS ships it in devkit-core', () => {
  for (const dir of ['plugins/openspec/schemas', 'openspec/schemas']) {
    for (const script of ['devkit', 'devkit-lite']) {
      const flow = JSON.parse(readRepo(...dir.split('/'), script, 'flow.json'));
      const stage = flow.stages.find((s) => s.id === 'requirements');
      assert.deepEqual(stage.helpers, ['codebase-researcher', 'requirements-triage'], `${dir}/${script}`);
    }
  }
  for (const script of ['devkit', 'devkit-lite']) assert.ok(scriptAgentsOf(FLOWS[script]).includes('requirements-triage'), script);
  assert.equal(PACKS['requirements-triage'], 'devkit-core');
  assert.match(readRepo('docs', 'roles.md'), /## requirements-triage\n[\s\S]*?- Played today by: The agent `devkit-core:requirements-triage`/);
});
const scriptAgentsOf = (flow) => changeLoopModule.scriptAgents(flow);

// The change `feat` of `root` records `x-devkit-flow: <pin>` (none for null), as a change opened with that flow does; committed.
function pinFeat(root, pin) {
  const file = join(root, 'openspec', 'changes', 'feat', '.openspec.yaml');
  put(root, { 'openspec/changes/feat/.openspec.yaml': `${readFileSync(file, 'utf8')}${pin === null ? '' : `x-devkit-flow: ${pin}\n`}` });
  commitAll(root, `feat follows flow ${pin}`);
  return root;
}

// Invariant (T-18, D-13: a change run may hand the triage to a change whose flow lists it, with no prefix or devkit-core's). Layer: the `agent` lock, H3.
// Suite: change-loop. Its scratch changes record flow 2, as an open with this release does; with no pin they follow flow 1, which does not list the triage (D-17).
test('upfront AC-5 triage: a change run may hand devkit-core:requirements-triage', () => {
  const transcript = runTranscript();
  for (const root of [pinFeat(liteChange(), 2), pinFeat(approvedChange(), 2)]) {
    for (const type of ['devkit-core:requirements-triage', 'requirements-triage']) {
      const r = hook('agent', agentInput(root, transcript, type));
      assert.equal(r.code, 0, `${type}: ${r.err}`);
    }
    assert.equal(hook('agent', agentInput(root, transcript, 'devkit-openspec:requirements-triage')).code, 2, 'another pack\'s prefix is refused');
  }
});

// ---- phase 8: the triage ships as flow version 2 of devkit and devkit-lite (design D-17, AC-5)

const FLOW_DIRS = [['plugins', 'openspec', 'schemas'], ['openspec', 'schemas']];
const TRIAGE_SCRIPTS = ['devkit', 'devkit-lite'];
const digestOfFile = (...p) => `sha256:${createHash('sha256').update(readFileSync(join(REPO_ROOT, ...p))).digest('hex')}`;
const helpersOf = (flow) => flow.stages.find((s) => s.id === 'requirements').helpers;

// Invariant (AC-5, D-17): the triage is a helper of the grill from flow version 2 of both scripts, in both schema copies, and the kept
// flows/2.json is the installed flow.json byte for byte. Layer: the flow files. Suite: change-loop.
test('upfront AC-5 flow: version 2 of devkit and devkit-lite names requirements-triage among the grill\'s helpers in both copies, and flows/2.json is flow.json', () => {
  for (const dir of FLOW_DIRS) {
    for (const script of TRIAGE_SCRIPTS) {
      const where = `${dir[0]}/${script}`;
      const text = readRepo(...dir, script, 'flow.json');
      const flow = JSON.parse(text);
      assert.equal(flow.version, 2, `${where}: flow.json is version 2`);
      assert.deepEqual(helpersOf(flow), ['codebase-researcher', 'requirements-triage'], `${where}: the grill's helpers`);
      assert.ok(existsSync(join(REPO_ROOT, ...dir, script, 'flows', '2.json')), `${where}: flows/2.json exists`);
      assert.equal(readRepo(...dir, script, 'flows', '2.json'), text, `${where}: flows/2.json is flow.json`);
    }
  }
});

// Invariant (AC-5, D-17 x change-version-pin D-2): a released version never changes: flows/1.json of both scripts is version 1 as released,
// with no triage, and devkit-project, whose content did not change, stays at version 1. Layer: the flow files and the released digests. Suite: change-loop.
test('upfront AC-5 flow: flows/1.json of devkit and devkit-lite is released version 1, without requirements-triage, and devkit-project stays at version 1', () => {
  const released = JSON.parse(readRepo('scripts', 'released-flows.json'));
  for (const dir of FLOW_DIRS) {
    for (const script of TRIAGE_SCRIPTS) {
      const where = `${dir[0]}/${script}`;
      const one = JSON.parse(readRepo(...dir, script, 'flows', '1.json'));
      assert.equal(one.version, 1, `${where}: flows/1.json is version 1`);
      assert.deepEqual(helpersOf(one), ['codebase-researcher'], `${where}: version 1 has no triage`);
      assert.equal(digestOfFile(...dir, script, 'flows', '1.json'), released[script]['1'], `${where}: the digest of version 1 is the released one`);
    }
    const project = JSON.parse(readRepo(...dir, 'devkit-project', 'flow.json'));
    assert.equal(project.version, 1, `${dir[0]}/devkit-project: flow.json stays at version 1`);
    assert.equal(existsSync(join(REPO_ROOT, ...dir, 'devkit-project', 'flows', '2.json')), false, `${dir[0]}/devkit-project: no flows/2.json`);
  }
  assert.deepEqual(Object.keys(released['devkit-project']), ['1'], 'devkit-project records version 1 only');
});

// Invariant (AC-5, D-17 x change-version-pin D-8): scripts/released-flows.json records the digest of each released version, the one
// scripts/check.py#flow_digest computes. Layer: the released digests. Suite: change-loop.
test('upfront AC-5 flow: released-flows.json records the digest of flows/2.json of devkit and devkit-lite', () => {
  const released = JSON.parse(readRepo('scripts', 'released-flows.json'));
  for (const script of TRIAGE_SCRIPTS) {
    assert.ok(existsSync(join(REPO_ROOT, 'plugins', 'openspec', 'schemas', script, 'flows', '2.json')), `${script}: flows/2.json exists`);
    const digest = digestOfFile('plugins', 'openspec', 'schemas', script, 'flows', '2.json');
    assert.match(digest, /^sha256:[0-9a-f]{64}$/);
    assert.equal(released[script]['2'], digest, `${script}: the recorded digest of version 2`);
    assert.equal(digestOfFile('openspec', 'schemas', script, 'flows', '2.json'), digest, `${script}: the openspec/schemas copy is the same bytes`);
  }
});

// A project with the tree's schemas and one `devkit` change per pin of `pins` ({ id: flow | null }); `files` of `(id, c0)` are written
// into each change's folder before the one commit. Returns the root.
function pinnedProject(pins, files = () => ({})) {
  const root = gitRepo({ config: 'schema: devkit\n' });
  const c0 = git(root, 'rev-parse', 'HEAD');
  for (const [id, pin] of Object.entries(pins)) {
    put(root, {
      [`openspec/changes/${id}/.openspec.yaml`]: `schema: devkit\n${pin === null ? '' : `x-devkit-flow: ${pin}\n`}`,
      ...Object.fromEntries(Object.entries(files(id, c0)).map(([f, b]) => [`openspec/changes/${id}/${f}`, b])),
    });
  }
  commitAll(root, 'changes');
  return root;
}
const actionOfChange = (root, id) => {
  const r = main(['next', '--change', id, '--lang', 'en'], { cwd: root, env: cleanEnv });
  assert.equal(r.code, 0, `${id}: ${r.stdout}${r.stderr}`);
  return actionOf(r.stdout);
};
const PINS = { none: null, one: 1, two: 2 };
const WITH_TRIAGE = ['codebase-researcher', 'requirements-triage'];
const WITHOUT_TRIAGE = ['codebase-researcher'];

// Invariant (AC-5, D-17): the grill action names the helpers of the requirements stage of the flow the change follows, so the triage is
// offered to a change on flow 2 only: none with no pin or on flow 1, until `flow <id>` moves it. The grill sent back by an unsourced triage
// answer says the same, and no other action carries `helpers`. Layer: decide (planPart) through next. Suite: change-loop.
test('upfront AC-5 triage: the grill of a change on flow 1 names no triage helper and that of a change on flow 2 names it', () => {
  const root = pinnedProject(PINS);
  for (const [id, expected] of [['none', WITHOUT_TRIAGE], ['one', WITHOUT_TRIAGE], ['two', WITH_TRIAGE]]) {
    const action = actionOfChange(root, id);
    assert.deepEqual([action.kind, action.stage], ['grill', 'requirements'], id);
    assert.deepEqual(action.helpers, expected, `${id}: the helpers of its flow's grill`);
  }
  // a change on flow 1 moved by the owner's command follows flow 2 and gets the triage
  const moved = main(['flow', 'one', '--lang', 'en'], { cwd: root, env: cleanEnv });
  assert.equal(moved.code, 0, moved.stdout + moved.stderr);
  assert.deepEqual(actionOfChange(root, 'one').helpers, WITH_TRIAGE, 'the moved change');
  assert.deepEqual(actionOfChange(root, 'none').helpers, WITHOUT_TRIAGE, 'a change nobody moved');
  // the grill sent back by a triage answer with no source carries the helpers of its flow too, and only grill actions carry them
  const unsourced = pinnedProject(PINS, (id, c0) => ({
    'requirements.md': `${head('requirements', c0)}# Requirements\n\n${TRIAGE_HEAD}\n\n1. [scope] May it use a cron? → yes\n`,
  }));
  for (const [id, expected] of [['none', WITHOUT_TRIAGE], ['one', WITHOUT_TRIAGE], ['two', WITH_TRIAGE]]) {
    const action = actionOfChange(unsourced, id);
    assert.deepEqual([action.kind, action.detail], ['grill', { unsourced: ['[scope] May it use a cron? → yes'] }], id);
    assert.deepEqual(action.helpers, expected, `${id}: the grill sent back`);
  }
  const sourced = pinnedProject({ two: 2 }, (id, c0) => ({ 'requirements.md': `${head('requirements', c0)}# Requirements\n` }));
  const agentAction = actionOfChange(sourced, 'two');
  assert.deepEqual([agentAction.kind, 'helpers' in agentAction], ['agent', false], 'an agent action has no helpers key');
});

// Invariant (AC-5, D-17): the change run's hand-off lock reads the roles of the flow the change follows: the triage is a role of a change on
// flow 2 and not of one on flow 1 (or with no pin), which gets the label not-a-role; the grill's other helper stays one. Layer: the agent lock, H3,
// through a real guard.mjs agent process. Suite: change-loop.
test('upfront AC-5 lock agent: a change run on flow 1 refuses devkit-core:requirements-triage as not-a-role, and one on flow 2 allows it', () => {
  const transcript = runTranscript();
  const tmp = sandbox();
  const log = join(sandbox(), 'hooks.jsonl');
  const call = (root, type) => hook('agent', agentInput(root, transcript, type), { TMPDIR: tmp, DEVKIT_HOOK_LOG: log });
  for (const make of [liteChange, approvedChange]) {
    for (const pin of [null, 1]) {
      const root = pinFeat(make(), pin);
      for (const type of ['devkit-core:requirements-triage', 'requirements-triage']) {
        const r = call(root, type);
        assert.equal(r.code, 2, `${type} on flow ${pin ?? 'none'}: ${r.err}`);
        assert.match(r.err, /is not one of them/);
        assert.doesNotMatch(r.err.split(';')[0], /requirements-triage/, 'the roles the refusal lists do not include the triage');
      }
      assert.equal(call(root, 'devkit-core:codebase-researcher').code, 0, `the grill's other helper stays allowed on flow ${pin ?? 'none'}`);
    }
    const two = pinFeat(make(), 2);
    for (const type of ['devkit-core:requirements-triage', 'requirements-triage']) {
      const r = call(two, type);
      assert.equal(r.code, 0, `${type} on flow 2: ${r.err}`);
    }
  }
  const records = readFileSync(log, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  assert.deepEqual([...new Set(records.filter((r) => r.decision === 'refuse').map((r) => r.why))], ['not-a-role'], 'every refusal is labelled not-a-role');
  assert.equal(records.filter((r) => r.decision === 'refuse').length, 8);
});

// Invariant (AC-5, D-17): the skills hand the drafted questions to the triage only when the loop's grill action names it in `helpers`, each
// naming where it reads the permission, and ask the owner every question otherwise. Layer: skill text. Suite: change-loop.
test('upfront AC-5 skill: the grill skill and the devkit skill hand the triage only when the grill action\'s helpers name it', () => {
  const grill = readRepo('plugins', 'core', 'skills', 'requirements-grill', 'SKILL.md');
  const step = grill.slice(grill.indexOf('### 2b. Triage first'), grill.indexOf('### 3. Grill on the four axes')).replace(/\s+/g, ' ');
  const devkit = readRepo('plugins', 'openspec', 'skills', 'devkit', 'SKILL.md');
  const item = devkit.split('\n').find((l) => l.startsWith('- `grill`:')).replace(/\s+/g, ' ');
  const triageItem = devkit.split('\n').find((l) => l.startsWith('- `triage`:')).replace(/\s+/g, ' ');
  for (const [name, text] of [['step 2b of the grill skill', step], ['the grill item of the devkit skill', item]]) {
    assert.match(text, /`helpers`[^.]*`requirements-triage`/, `${name}: the helpers name the triage`);
    assert.ok(text.includes('every question goes to the owner, one at a time'), `${name}: with no permission the owner is asked every question`);
    assert.ok(text.includes('`ask.action`'), `${name}: the coordinating session reads ask.action`);
    assert.match(text, /`next` \(or `session-next`\)/, `${name}: the action a lone change or a change session reads`);
  }
  assert.match(step, /`triage` action[^.]*only for a grill whose `helpers` name/, 'step 2b: the check\'s triage action carries no helpers and is given only for a grill that names them');
  assert.match(triageItem, /`helpers`/, 'the triage item says the check gives it only for a grill whose helpers name the triage');
});

test('upfront AC-11 next: a requirements file set back to pending after the proposal gives the grill', () => {
  const root = planChange({ have: ['requirements', 'decisions', 'proposal'], results: { requirements: 'pending' }, attempts: { requirements: 2 } });
  const r = next(root);
  assert.equal(r.code, 0, r.stderr);
  const { action } = parsed(r);
  assert.deepEqual([action.kind, action.stage, action.role], ['grill', 'requirements', 'change-coordinator']);
});

test('upfront AC-11 delivery: renumber-adr is a hand-off of the implementer, with the files in its detail', () => {
  assert.ok(ROW_STEPS.includes('renumber-adr'));
  const files = [{ from: 'docs/adr/0016-a.md', to: 'docs/adr/0018-a.md', number: '0018' }];
  const a = build(rowOf('renumber-adr', { files, agent: TDD }));
  assert.deepEqual([a.kind, a.agent, a.step, a.stage, a.role, exitCodeOf(a)], ['agent', TDD, 'renumber-adr', 'implementation', 'tdd-implementer', 0]);
  assert.deepEqual(a.detail.files, files);
  assert.equal(a.progressKey, 'implementation/renumber-adr@abc123');
});
