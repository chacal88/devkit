// node --test plugins/core/skills/review-change/scripts/review-round.test.mjs
// Imported by plugins/openspec/hooks/guard.test.mjs, as the openspec-setup script tests are.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  loadRules, validateArgs, validateStage1, needsVerification, isRefutation, decide, oneLine, findingLine,
  outcomeOf, consensusOf, reviewerPrompt, verifierPrompt, writerPrompt, consolidate,
  VERIFIERS, verifyJobs, groupVotes, writeMismatch,
  STAGE1_SCHEMA, VOTE_SCHEMA, WRITE_SCHEMA,
} from './review-round.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(here, 'review-round.workflow.js');
const CLI = join(here, 'review-round.mjs');
const SHA = 'a'.repeat(40);
const SHA2 = 'b'.repeat(40);

const bench = (...names) => names.map((reviewer) => ({ reviewer, previous: null, range: null }));
const baseArgs = (over = {}) => ({
  change: 'demo', changeDir: 'openspec/changes/demo', round: 1, path: 'workflow', range: 'origin/main..HEAD',
  structural: 'PASS', preamble: '', bench: bench('code-quality-reviewer'), ...over,
});
const finding = (over = {}) => ({ id: 'F1', severity: 'important', location: 'a.mjs:1', text: 'a thing is wrong', disposition: null, ...over });
const stage1Of = (reviewer, findings, over = {}) => ({
  declined: false, commit: SHA, uncommitted: false, heading: `## ${reviewer} - demo`, findings, sections: 'Some section.', ...over,
});
const refute = (evidence = 'a.mjs:1 shows it is fine') => ({ refuted: true, evidence });
const keep = () => ({ refuted: false, evidence: '' });

// ---- rules -------------------------------------------------------------

test('review round: the rules section loads and exports every name', () => {
  const rules = loadRules();
  for (const name of ['STAGE1_SCHEMA', 'VOTE_SCHEMA', 'WRITE_SCHEMA', 'validateArgs', 'validateStage1', 'needsVerification', 'isRefutation', 'decide', 'oneLine', 'findingLine', 'outcomeOf', 'consensusOf', 'reviewerPrompt', 'verifierPrompt', 'writerPrompt', 'consolidate']) {
    assert.ok(rules[name] !== undefined, name);
  }
  assert.ok(STAGE1_SCHEMA.required.includes('findings'));
  assert.ok(VOTE_SCHEMA.required.includes('evidence') && WRITE_SCHEMA.required.includes('verdict'));
});

test('review round: loadRules names the file when a marker or a name is missing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'review-round-'));
  const noMarker = join(dir, 'a.js');
  writeFileSync(noMarker, 'const x = 1;\n');
  assert.throws(() => loadRules(noMarker), (e) => e.message === `review usage: rules section not found in ${noMarker}`);
  const noName = join(dir, 'b.js');
  writeFileSync(noName, '// ---- rules: begin\nconst x = 1;\n// ---- rules: end\n');
  assert.throws(() => loadRules(noName), /^Error: review usage: rules section not found in /);
});

test('review round: needsVerification holds for blocking and important findings without a disposition only', () => {
  for (const [severity, want] of [['blocking', true], ['important', true], ['nit', false], ['praise', false]]) {
    assert.equal(needsVerification(finding({ severity })), want, severity);
    assert.equal(needsVerification(finding({ severity, disposition: 'fixed in abc1234' })), false, `${severity} fixed`);
    assert.equal(needsVerification(finding({ severity, disposition: 'refuted: x' })), false, `${severity} refuted`);
  }
});

test('review round: decide refutes at 2 of 3 with evidence, never at 1 or 0', () => {
  assert.deepEqual(decide([refute('e1'), refute('e2'), refute('e3')]), { refuted: true, refutations: 3, evidence: 'e1 / e2 / e3' });
  assert.deepEqual(decide([refute('e1'), keep(), refute('e3')]), { refuted: true, refutations: 2, evidence: 'e1 / e3' });
  assert.equal(decide([refute('e1'), keep(), keep()]).refuted, false);
  assert.deepEqual(decide([keep(), keep(), keep()]), { refuted: false, refutations: 0, evidence: '' });
});

test('review round: decide counts a refutation with blank evidence and a null vote as not refuted', () => {
  const blank = decide([refute('e1'), { refuted: true, evidence: '   ' }, keep()]);
  assert.equal(blank.refuted, false);
  assert.equal(blank.refutations, 1);
  assert.equal(decide([refute('e1'), null, null]).refuted, false);
  assert.equal(decide([refute('e1'), refute('e2'), null]).refuted, true);
  assert.equal(isRefutation(null), false);
  assert.equal(isRefutation({ refuted: true }), false);
});

test('review round: oneLine joins lines, turns the middle dot into a dash and caps the length', () => {
  assert.equal(oneLine('a\n b\r\n\tc'), 'a b c');
  assert.equal(oneLine('x · fixed in abcdef1'), 'x - fixed in abcdef1');
  const long = oneLine('y'.repeat(500));
  assert.equal(long.length, 400);
  assert.ok(long.endsWith('…'));
  assert.equal(oneLine('abcdef', 4), 'abc…');
  assert.equal(oneLine(null), '');
});

test('review round: findingLine gives the line deliver-check reads, with and without a disposition', () => {
  assert.equal(findingLine(finding()), '- [important] a.mjs:1 — a thing is wrong');
  assert.equal(findingLine(finding({ disposition: 'refuted: e' })), '- [important] a.mjs:1 — a thing is wrong · refuted: e');
  assert.equal(findingLine(finding({ disposition: 'fixed in abc1234' })), '- [important] a.mjs:1 — a thing is wrong · fixed in abc1234');
  assert.equal(findingLine(finding({ location: '' })), '- [important] a thing is wrong');
});

test('review round: outcomeOf approves when only nits and praise are listed', () => {
  const s = validateStage1('code-quality-reviewer', stage1Of('code-quality-reviewer', [finding({ severity: 'nit' }), finding({ id: 'F2', severity: 'praise' })]));
  const o = outcomeOf(baseArgs(), s, {});
  assert.equal(o.verdict, 'approved');
  assert.deepEqual([o.verified, o.refuted], [0, 0]);
  assert.equal(o.lines.length, 2);
});

test('review round: outcomeOf rejects while an important or blocking finding survives', () => {
  const s = validateStage1('code-quality-reviewer', stage1Of('code-quality-reviewer', [finding(), finding({ id: 'F2', severity: 'blocking' })]));
  const o = outcomeOf(baseArgs(), s, { F1: [refute(), refute(), keep()], F2: [refute(), keep(), keep()] });
  assert.equal(o.verdict, 'rejected');
  assert.deepEqual(o.findings.map((f) => f.status), ['refuted', 'open']);
  assert.equal(o.lines[0], '- [important] a.mjs:1 — a thing is wrong · refuted: a.mjs:1 shows it is fine / a.mjs:1 shows it is fine');
  assert.equal(o.lines[1], '- [blocking] a.mjs:1 — a thing is wrong');
  assert.deepEqual([o.verified, o.refuted], [2, 1]);
});

test('review round: outcomeOf approves when every finding is refuted and keeps the refuted line visible', () => {
  const s = validateStage1('code-quality-reviewer', stage1Of('code-quality-reviewer', [finding()]));
  const o = outcomeOf(baseArgs(), s, { F1: [refute('e1'), refute('e2'), refute('e3')] });
  assert.equal(o.verdict, 'approved');
  assert.match(o.lines[0], / · refuted: e1 \/ e2 \/ e3$/);
  assert.equal(o.findings[0].refutations, 3);
});

test('review round: outcomeOf leaves a disposed previous finding neither open nor verified', () => {
  const s = validateStage1('code-quality-reviewer', stage1Of('code-quality-reviewer', [
    finding({ disposition: 'fixed in abc1234' }), finding({ id: 'F2', severity: 'blocking', disposition: 'refuted: earlier evidence' }),
  ]));
  const o = outcomeOf(baseArgs({ round: 2 }), s, {});
  assert.deepEqual(o.findings.map((f) => f.status), ['disposed', 'disposed']);
  assert.deepEqual([o.verified, o.refuted, o.verdict], [0, 0, 'approved']);
  assert.equal(o.lines[0], '- [important] a.mjs:1 — a thing is wrong · fixed in abc1234');
});

test('review round: outcomeOf keeps declined and counts the verifiers that did not answer', () => {
  const s = validateStage1('security-reviewer', stage1Of('security-reviewer', [], { declined: true }));
  assert.equal(outcomeOf(baseArgs({ bench: bench('security-reviewer') }), s, {}).verdict, 'declined');
  const t = validateStage1('code-quality-reviewer', stage1Of('code-quality-reviewer', [finding()]));
  assert.equal(outcomeOf(baseArgs(), t, { F1: [refute(), null, null] }).voteFailures, 2);
  assert.equal(outcomeOf(baseArgs(), t, {}).voteFailures, 3);
});

test('review round: consensusOf is PASS only when every outcome is approved or declined and nothing failed', () => {
  const o = (verdict) => ({ verdict });
  assert.equal(consensusOf([o('approved'), o('declined')], []), 'PASS');
  assert.equal(consensusOf([o('approved'), o('rejected')], []), 'FAIL');
  assert.equal(consensusOf([o('approved')], [{ reviewer: 'x', stage: 'write', error: 'e' }]), 'FAIL');
  assert.equal(consensusOf([o('approved')]), 'PASS');
});

test('review round: validateArgs accepts the contract and rejects with the review input invalid prefix', () => {
  const ok = baseArgs();
  assert.equal(validateArgs(ok), ok);
  const bad = [
    null, [], { ...ok, change: '' }, { ...ok, round: 3 }, { ...ok, path: 'x' }, { ...ok, structural: 'FAIL' }, { ...ok, preamble: 1 },
    { ...ok, bench: [] }, { ...ok, bench: bench('nobody-reviewer') },
    { ...ok, bench: bench('code-quality-reviewer', 'code-quality-reviewer') },
    { ...ok, bench: [{ reviewer: 'code-quality-reviewer', previous: 3, range: null }] },
    { ...ok, bench: bench('code-quality-reviewer', 'test-coverage-reviewer', 'architecture-reviewer', 'security-reviewer', 'adr-reviewer', 'spec-reviewer', 'code-quality-reviewer') },
  ];
  for (const a of bad) assert.throws(() => validateArgs(a), /^Error: review input invalid: /, JSON.stringify(a));
  assert.equal(validateArgs({ ...ok, bench: bench('code-quality-reviewer', 'test-coverage-reviewer', 'architecture-reviewer', 'security-reviewer', 'adr-reviewer', 'spec-reviewer') }).bench.length, 6);
});

test('review round: validateStage1 gives ids F1.. to findings without one and makes text one line', () => {
  const s = validateStage1('adr-reviewer', stage1Of('adr-reviewer', [
    { severity: 'blocking', location: 'x', text: 'one\ntwo · three' },
    { severity: 'nit', location: 'y', text: 'n', id: 'F9' },
    { severity: 'praise', text: 'p' },
  ]));
  assert.deepEqual(s.findings.map((f) => f.id), ['F1', 'F9', 'F3']);
  assert.equal(s.findings[0].text, 'one two - three');
  assert.equal(s.findings[0].disposition, null);
  assert.equal(s.reviewer, 'adr-reviewer');
});

test('review round: validateStage1 rejects a malformed return with the review input invalid prefix', () => {
  const good = stage1Of('adr-reviewer', [finding()]);
  const bad = [
    null, 'text', [], { ...good, declined: 'no' }, { ...good, commit: 'abc' }, { ...good, uncommitted: 1 }, { ...good, heading: '' },
    { ...good, findings: 'x' }, { ...good, sections: null }, { ...good, findings: [finding({ severity: 'huge' })] },
    { ...good, findings: [finding({ text: '  ' })] }, { ...good, findings: [finding(), finding()] },
    { ...good, findings: [finding({ disposition: 'maybe later' })] },
  ];
  for (const v of bad) assert.throws(() => validateStage1('adr-reviewer', v), /^Error: review input invalid: /, JSON.stringify(v));
  assert.throws(() => validateStage1('nobody-reviewer', good), /^Error: review input invalid: /);
});

test('review round: every prompt starts with the worktree preamble and stage 1 says to write no file', () => {
  const args = baseArgs({ preamble: 'WORKTREE PREAMBLE' });
  const entry = args.bench[0];
  const s = validateStage1(entry.reviewer, stage1Of(entry.reviewer, [finding()]));
  const o = outcomeOf(args, s, {});
  for (const p of [reviewerPrompt(args, entry), verifierPrompt(args, entry, s.findings[0]), writerPrompt(args, o)]) {
    assert.ok(p.startsWith('WORKTREE PREAMBLE\n\n'), p.slice(0, 60));
  }
  const r = reviewerPrompt(baseArgs(), entry);
  assert.match(r, /stage 1/);
  assert.match(r, /write no file/);
  assert.match(r, /origin\/main\.\.HEAD/);
  assert.ok(r.startsWith('This is stage 1'));
});

test('review round: reviewerPrompt names the previous verdict file and the reviewer own range', () => {
  const entry = { reviewer: 'code-quality-reviewer', previous: 'openspec/changes/demo/reviews/code-quality-reviewer.md', range: `${SHA}..HEAD` };
  const p = reviewerPrompt(baseArgs({ round: 2, bench: [entry] }), entry);
  assert.match(p, /reviews\/code-quality-reviewer\.md/);
  assert.match(p, new RegExp(`${SHA}\\.\\.HEAD`));
});

test('review round: verifierPrompt holds only its finding, the range and the word refute', () => {
  const args = baseArgs({ bench: bench('code-quality-reviewer') });
  const entry = args.bench[0];
  const s = validateStage1(entry.reviewer, stage1Of(entry.reviewer, [finding(), finding({ id: 'F2', text: 'another distinct problem' })]));
  const p = verifierPrompt(args, entry, s.findings[0]);
  assert.ok(p.includes(findingLine(s.findings[0])));
  assert.ok(!p.includes('another distinct problem'));
  assert.match(p, /refute/i);
  assert.ok(p.includes('origin/main..HEAD'));
  assert.ok(!/Verdict:/.test(p));
});

test('review round: writerPrompt holds every line verbatim and the commit line', () => {
  const args = baseArgs();
  const s = validateStage1('code-quality-reviewer', stage1Of('code-quality-reviewer', [finding(), finding({ id: 'F2', severity: 'nit', text: 'a nit' })], { uncommitted: true }));
  const o = outcomeOf(args, s, { F1: [refute('e1'), refute('e2'), keep()] });
  const p = writerPrompt(args, o);
  for (const line of o.lines) assert.ok(p.includes(line), line);
  assert.ok(p.includes(`Commit: ${SHA} (uncommitted changes)`));
  assert.ok(p.includes('openspec/changes/demo/reviews/code-quality-reviewer.md'));
});

test('review round: writerPrompt names the verdict the round computed on line 1', () => {
  const args = baseArgs();
  const line1 = (p) => p.split('\n').find((l) => l.startsWith('line 1:'));
  const open = outcomeOf(args, validateStage1('code-quality-reviewer', stage1Of('code-quality-reviewer', [finding()])), { F1: [keep(), keep(), keep()] });
  assert.equal(open.verdict, 'rejected');
  assert.match(line1(writerPrompt(args, open)), /^line 1: exactly Verdict: rejected\b/);
  const clean = outcomeOf(args, validateStage1('code-quality-reviewer', stage1Of('code-quality-reviewer', [finding({ severity: 'nit', text: 'a nit' })])), {});
  assert.equal(clean.verdict, 'approved');
  assert.match(line1(writerPrompt(args, clean)), /^line 1: exactly Verdict: approved\b/);
});

test('review round: consolidate writes the table, the counts, the consensus line and the path', () => {
  const args = baseArgs({ round: 2, path: 'agents', bench: bench('code-quality-reviewer', 'test-coverage-reviewer') });
  const a = outcomeOf(args, validateStage1('code-quality-reviewer', stage1Of('code-quality-reviewer', [finding()])), { F1: [refute('e1'), refute('e2'), keep()] });
  const b = outcomeOf(args, validateStage1('test-coverage-reviewer', stage1Of('test-coverage-reviewer', [finding({ text: 'survives' })], { commit: SHA2 })), { F1: [keep(), keep(), keep()] });
  const { consensus, text } = consolidate({ args, outcomes: [a, b], failed: [], notes: ['verifiers failed: 1'] });
  assert.equal(consensus, 'FAIL');
  assert.match(text, /^# Review: demo, round 2$/m);
  assert.match(text, /^Path: agents · range `origin\/main\.\.HEAD` · structural: PASS$/m);
  assert.match(text, /^\| code-quality-reviewer \| approved \| 0 \| 0 \| 1 \| 1 \| aaaaaaa \|$/m);
  assert.match(text, /^\| test-coverage-reviewer \| rejected \| 0 \| 1 \| 1 \| 0 \| bbbbbbb \|$/m);
  assert.match(text, /^Consensus: FAIL \(round 2\/2\)$/m);
  assert.match(text, /^- test-coverage-reviewer — \[important\] a\.mjs:1 — survives$/m);
  assert.match(text, /^- code-quality-reviewer — \[important\] .* · refuted: e1 \/ e2 \(2 of 3\)$/m);
  assert.match(text, /^- verifiers failed: 1$/m);
  assert.match(text, /Consensus deadlock after round 2/);
  const pass = consolidate({ args: baseArgs(), outcomes: [outcomeOf(baseArgs(), validateStage1('code-quality-reviewer', stage1Of('code-quality-reviewer', [])), {})], failed: [], notes: [] });
  assert.match(pass.text, /^Consensus: PASS \(round 1\/2\)$/m);
  assert.match(pass.text, /^Ready to ship\.$/m);
  assert.match(pass.text, /^Path: workflow /m);
  const failedRound1 = consolidate({ args: baseArgs(), outcomes: [], failed: [{ reviewer: 'code-quality-reviewer', stage: 'write', error: 'e' }], notes: [] });
  assert.match(failedRound1.text, /round 2\)\.$/m);
  assert.match(failedRound1.text, /failed \(write\)/);
});

// ---- static ------------------------------------------------------------

test('review round: the script holds no module loading, clock, randomness, process or fs use, and a literal meta', () => {
  const src = readFileSync(SCRIPT, 'utf8');
  assert.ok(src.startsWith('export const meta = {'));
  for (const bad of [/\bimport\s/, /require\(/, /Date\.now/, /Math\.random/, /\bprocess\./, /\bfs\./]) assert.ok(!bad.test(src), String(bad));
  const meta = src.slice(0, src.indexOf('\n')).replace(/^export const meta = /, '');
  assert.ok(!meta.includes('('), 'meta holds only literals');
  assert.match(meta, /phases: \['review', 'verify', 'write'\]/);
});

// ---- the script under a harness ---------------------------------------

const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;

// Runs the script body as the Workflow tool is assumed to: the leading `export ` removed, an async
// function body with the tool globals as parameters, recording stubs and a parallel that never rejects.
function harness({ respond, hold = false }) {
  const calls = [];
  const phases = [];
  const logs = [];
  const held = [];
  const agent = (prompt, opts) => {
    const call = { prompt, ...opts, order: calls.length };
    calls.push(call);
    if (hold && opts.phase === 'review') return new Promise((resolve, reject) => held.push(() => { try { resolve(respond(call)); } catch (e) { reject(e); } }));
    return Promise.resolve().then(() => respond(call));
  };
  const parallel = (thunks) => Promise.all(thunks.map(async (t) => { try { return await t(); } catch { return null; } }));
  const pipeline = () => { throw new Error('the script does not use pipeline'); };
  const body = readFileSync(SCRIPT, 'utf8').replace(/^export /, '');
  const fn = new AsyncFunction('agent', 'parallel', 'pipeline', 'phase', 'log', 'args', body);
  const run = (args) => fn(agent, parallel, pipeline, (name) => phases.push(name), (m) => logs.push(m), args);
  return { calls, phases, logs, held, run };
}

// stage1: { reviewer: object | null }, votes: { 'reviewer F1': [vote x3] }
function responder({ stage1, votes = {}, writes = {} }) {
  return (call) => {
    if (call.phase === 'review') return stage1[call.label];
    if (call.phase === 'verify') {
      const m = call.label.match(/^(\S+) (F\d+) v(\d)$/);
      return (votes[`${m[1]} ${m[2]}`] || [])[Number(m[3]) - 1] ?? null;
    }
    const w = writes[call.label.replace(/ write$/, '')];
    if (w !== undefined) return w;
    // an honest writer: the commit on line 2 of the file it is told to write, and a verdict from the open lines
    const commit = call.prompt.match(/^line 2: Commit: ([0-9a-f]{40})/m)[1];
    const open = /^- \[(blocking|important)\](?!.* · (fixed in|refuted:))/m.test(call.prompt);
    return { written: true, verdict: open ? 'rejected' : 'approved', commit };
  };
}

const cq = 'code-quality-reviewer';
const tc = 'test-coverage-reviewer';
const ar = 'architecture-reviewer';
const mixed = () => [
  finding({ id: 'F1', severity: 'blocking', text: 'blocking one' }),
  finding({ id: 'F2', severity: 'important', text: 'important two' }),
  finding({ id: 'F3', severity: 'nit', text: 'nit three' }),
  finding({ id: 'F4', severity: 'praise', text: 'praise four' }),
  finding({ id: 'F5', severity: 'important', text: 'old five', disposition: 'fixed in abc1234' }),
];

test('review round: workflow starts every reviewer of the bench before any returns (AC-1)', async () => {
  const names = [cq, tc, ar];
  const h = harness({ hold: true, respond: responder({ stage1: Object.fromEntries(names.map((n) => [n, stage1Of(n, [])])) }) });
  const done = h.run(baseArgs({ bench: bench(...names) }));
  await new Promise((r) => setImmediate(r));
  assert.equal(h.calls.length, 3, 'all three started while none has returned');
  assert.deepEqual(h.calls.map((c) => c.agentType), names.map((n) => `devkit-core:${n}`));
  for (const c of h.calls) {
    assert.equal(c.phase, 'review');
    assert.equal(typeof c.schema, 'object');
    assert.equal(c.label, c.agentType.replace('devkit-core:', ''));
  }
  h.held.forEach((release) => release());
  const result = await done;
  assert.equal(result.consensus, 'PASS');
  assert.deepEqual(h.phases, ['review', 'verify', 'write']);
});

test('review round: workflow sends exactly 6 verifier calls for a blocking and an important finding and none for the rest (AC-2)', async () => {
  const h = harness({ respond: responder({ stage1: { [cq]: stage1Of(cq, mixed()) } }) });
  await h.run(baseArgs());
  const verifiers = h.calls.filter((c) => c.phase === 'verify');
  assert.equal(verifiers.length, 6);
  assert.ok(verifiers.every((c) => c.agentType === 'devkit-core:finding-verifier' && typeof c.schema === 'object'));
  assert.deepEqual(verifiers.map((c) => c.label), ['F1 v1', 'F1 v2', 'F1 v3', 'F2 v1', 'F2 v2', 'F2 v3'].map((l) => `${cq} ${l}`));
  const prompts = verifiers.map((c) => c.prompt).join('\n');
  assert.ok(!prompts.includes('nit three') && !prompts.includes('praise four') && !prompts.includes('old five'));
});

test('review round: workflow votes decide each finding: two refutations, a blank one, a null (AC-2)', async () => {
  const votes = {
    [`${cq} F1`]: [refute('e1'), refute('e2'), keep()],
    [`${cq} F2`]: [refute('e1'), { refuted: true, evidence: ' ' }, keep()],
  };
  const h = harness({ respond: responder({ stage1: { [cq]: stage1Of(cq, mixed()) }, votes }) });
  const r = await h.run(baseArgs());
  const o = r.outcomes[0];
  assert.deepEqual(o.findings.map((f) => f.status), ['refuted', 'open', 'open', 'open', 'disposed']);
  assert.equal(o.verdict, 'rejected');
  assert.deepEqual([o.verified, o.refuted], [2, 1]);

  const h2 = harness({ respond: responder({ stage1: { [cq]: stage1Of(cq, mixed()) }, votes: { [`${cq} F1`]: [refute('e1'), refute('e2'), null], [`${cq} F2`]: [refute('e1'), null, null] } }) });
  const r2 = await h2.run(baseArgs());
  assert.deepEqual(r2.outcomes[0].findings.map((f) => f.status).slice(0, 2), ['refuted', 'open']);
  assert.equal(r2.verifiersFailed, 3);
  assert.match(r2.reviewMd, /^- verifiers failed: 3$/m);
});

test('review round: workflow writes one prompt per reviewer with its own agent type, the lines and the commit (AC-3)', async () => {
  const votes = { [`${cq} F1`]: [refute('e1'), refute('e2'), keep()] };
  const h = harness({ respond: responder({ stage1: { [cq]: stage1Of(cq, [finding({ id: 'F1', text: 'one' }), finding({ id: 'F2', severity: 'nit', text: 'two' })]), [tc]: stage1Of(tc, [], { commit: SHA2 }) }, votes }) });
  const r = await h.run(baseArgs({ bench: bench(cq, tc) }));
  const writers = h.calls.filter((c) => c.phase === 'write');
  assert.deepEqual(writers.map((c) => c.agentType), [`devkit-core:${cq}`, `devkit-core:${tc}`]);
  assert.ok(writers.every((c) => typeof c.schema === 'object'));
  assert.ok(writers[0].prompt.includes('- [important] a.mjs:1 — one · refuted: e1 / e2'));
  assert.ok(writers[0].prompt.includes('- [nit] a.mjs:1 — two\n'));
  assert.ok(writers[0].prompt.includes(`Commit: ${SHA}`));
  assert.ok(writers[1].prompt.includes(`Commit: ${SHA2}`));
  assert.ok(writers.every((c) => c.prompt.includes('line 1: exactly Verdict: approved')));
  assert.equal(r.outcomes[0].verdict, 'approved', 'all refuted');
});

test('review round: workflow outcome verdict is rejected while an important stays open (AC-3)', async () => {
  const h = harness({ respond: responder({ stage1: { [cq]: stage1Of(cq, [finding()]) }, votes: { [`${cq} F1`]: [keep(), keep(), refute()] } }) });
  const r = await h.run(baseArgs());
  assert.equal(r.outcomes[0].verdict, 'rejected');
  assert.equal(r.consensus, 'FAIL');
});

test('review round: workflow reviewMd holds the verdicts, the counts, the consensus with its round and the path (AC-4)', async () => {
  const votes = { [`${cq} F1`]: [refute('e1'), refute('e2'), keep()] };
  const h = harness({ respond: responder({ stage1: { [cq]: stage1Of(cq, [finding()]), [tc]: stage1Of(tc, [finding({ text: 'stays' })]) }, votes: { ...votes, [`${tc} F1`]: [keep(), keep(), keep()] } }) });
  const r = await h.run(baseArgs({ round: 2, bench: bench(cq, tc) }));
  assert.match(r.reviewMd, /^\| code-quality-reviewer \| approved \| 0 \| 0 \| 1 \| 1 \|/m);
  assert.match(r.reviewMd, /^\| test-coverage-reviewer \| rejected \| 0 \| 1 \| 1 \| 0 \|/m);
  assert.match(r.reviewMd, /^Consensus: FAIL \(round 2\/2\)$/m);
  assert.match(r.reviewMd, /^Path: workflow /m);
});

test('review round: workflow resolves to the result object the skill checks', async () => {
  const h = harness({ respond: responder({ stage1: { [cq]: stage1Of(cq, []) } }) });
  const r = await h.run(baseArgs({ change: 'other', round: 2, path: 'agents' }));
  assert.equal(r.version, 1);
  assert.equal(r.path, 'workflow', 'the script is the workflow path whatever args.path says');
  assert.equal(r.change, 'other');
  assert.equal(r.round, 2);
  assert.ok(Array.isArray(r.outcomes) && Array.isArray(r.failed));
  assert.equal(typeof r.reviewMd, 'string');
  assert.match(r.reviewMd, /^Path: workflow /m);
  assert.deepEqual(r.failed, []);
});

test('review round: workflow reports a failed stage 1 and leaves that reviewer out of the later stages', async () => {
  const h = harness({ respond: responder({ stage1: { [cq]: null, [tc]: stage1Of(tc, []) } }) });
  const r = await h.run(baseArgs({ bench: bench(cq, tc) }));
  assert.deepEqual(r.failed, [{ reviewer: cq, stage: 'review', error: `review stage failed: ${cq} review` }]);
  assert.equal(r.reviewMd, null);
  assert.equal(r.consensus, 'FAIL');
  assert.deepEqual(r.outcomes.map((o) => o.reviewer), [tc]);
  assert.ok(h.calls.every((c) => c.phase === 'review' || c.label.startsWith(tc)));
});

test('review round: workflow treats a malformed stage 1 return as a failed stage', async () => {
  const h = harness({ respond: responder({ stage1: { [cq]: { declined: false } } }) });
  const r = await h.run(baseArgs());
  assert.equal(r.failed[0].error, `review stage failed: ${cq} review`);
  assert.equal(h.calls.length, 1);
});

test('review round: workflow reports a writer that returned null or wrote nothing', async () => {
  const h = harness({ respond: responder({ stage1: { [cq]: stage1Of(cq, []), [tc]: stage1Of(tc, []) }, writes: { [cq]: null, [tc]: { written: false, verdict: 'approved', commit: SHA } } }) });
  const r = await h.run(baseArgs({ bench: bench(cq, tc) }));
  assert.deepEqual(r.failed.map((f) => f.error), [`review stage failed: ${cq} write`, `review stage failed: ${tc} write`]);
  assert.ok(r.failed.every((f) => f.stage === 'write'));
  assert.equal(r.reviewMd, null);
  assert.equal(r.outcomes.length, 2, 'the outcomes stay, so the session can rerun stage 3');
});

test('review round: workflow fails a writer whose returned verdict or commit differs from the outcome', async () => {
  const stage1 = { [cq]: stage1Of(cq, [finding()]), [tc]: stage1Of(tc, [finding()]), [ar]: stage1Of(ar, []) };
  const votes = { [`${cq} F1`]: [keep(), keep(), keep()], [`${tc} F1`]: [keep(), keep(), keep()] };
  const writes = {
    [cq]: { written: true, verdict: 'approved', commit: SHA },
    [tc]: { written: true, verdict: 'rejected', commit: SHA2 },
    [ar]: { written: true, verdict: 'approved', commit: SHA },
  };
  const h = harness({ respond: responder({ stage1, votes, writes }) });
  const r = await h.run(baseArgs({ bench: bench(cq, tc, ar) }));
  assert.deepEqual(r.failed.map((f) => [f.reviewer, f.stage, f.error]), [
    [cq, 'write', `review stage failed: ${cq} write`],
    [tc, 'write', `review stage failed: ${tc} write`],
  ]);
  assert.match(r.failed[0].reason, /verdict/);
  assert.match(r.failed[1].reason, /commit/);
  assert.equal(r.reviewMd, null);
  assert.equal(r.consensus, 'FAIL');
});

test('review round: writeMismatch accepts the outcome as written and names a wrong verdict or commit', () => {
  const o = { reviewer: cq, verdict: 'rejected', commit: SHA };
  assert.equal(writeMismatch(o, { written: true, verdict: 'rejected', commit: SHA }), null);
  assert.match(writeMismatch(o, { written: true, verdict: 'approved', commit: SHA }), /verdict/);
  assert.match(writeMismatch(o, { written: true, verdict: 'rejected', commit: SHA2 }), /commit/);
});

test('review round: VERIFIERS lives once in the rules section: verifyJobs, groupVotes, decide and the wording follow it', async () => {
  assert.equal(VERIFIERS, 3);
  const args = baseArgs();
  const passed = [{ entry: args.bench[0], stage1: validateStage1(cq, stage1Of(cq, [finding(), finding({ id: 'F2', severity: 'nit' })])) }];
  const jobs = verifyJobs(args, passed);
  assert.deepEqual(jobs.map((j) => `${j.reviewer} ${j.id} ${j.k}`), [1, 2, 3].map((k) => `${cq} F1 ${k}`));
  assert.deepEqual(groupVotes(jobs, ['a', 'b', 'c']), { [cq]: { F1: ['a', 'b', 'c'] } });

  const source = readFileSync(SCRIPT, 'utf8');
  const five = join(mkdtempSync(join(tmpdir(), 'review-round-five-')), 'five.js');
  writeFileSync(five, source.replace('const VERIFIERS = 3;', 'const VERIFIERS = 5;'));
  const rules = loadRules(five);
  assert.equal(rules.VERIFIERS, 5);
  assert.equal(rules.verifyJobs(args, passed).length, 5);
  const votes = (n) => Array.from({ length: 5 }, (_, i) => (i < n ? refute(`e${i}`) : keep()));
  assert.equal(rules.decide(votes(2)).refuted, false);
  assert.equal(rules.decide(votes(3)).refuted, true);
  const outcome = rules.outcomeOf(args, passed[0].stage1, { F1: votes(3) });
  assert.equal(outcome.voteFailures, 0);
  const text = rules.consolidate({ args, outcomes: [outcome], failed: [], notes: [] }).text;
  assert.match(text, /\(3 of 5\)/);

  // nothing outside the rules section holds the count, the job loop or the majority
  const outside = (text) => text.replace(/\/\/ ---- rules: begin[\s\S]*\/\/ ---- rules: end/, '');
  for (const file of [SCRIPT, CLI]) {
    const rest = outside(readFileSync(file, 'utf8'));
    assert.ok(!/<=\s*3\b|>=\s*2\b|\bof 3\b/.test(rest), `${file} holds the verifier count outside the rules section`);
  }
});

test('review round: workflow rejects invalid args with the review input invalid prefix before any agent runs', async () => {
  const h = harness({ respond: responder({ stage1: {} }) });
  await assert.rejects(h.run(baseArgs({ structural: 'FAIL' })), /^Error: review input invalid: /);
  await assert.rejects(h.run(undefined), /^Error: review input invalid: /);
  assert.equal(h.calls.length, 0);
});

// ---- the CLI of the agents path ---------------------------------------

const scratch = mkdtempSync(join(tmpdir(), 'review-round-cli-'));
let seq = 0;
function cli(sub, input, { raw = false } = {}) {
  const file = join(scratch, `in-${seq += 1}.json`);
  writeFileSync(file, raw ? input : JSON.stringify(input));
  const r = spawnSync(process.execPath, [CLI, sub, '--input', file], { encoding: 'utf8' });
  let json = null;
  try { json = JSON.parse(r.stdout); } catch { /* not JSON */ }
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, json };
}
const fenced = (value, prose = 'Reviewed.') => `${prose}\n\n\`\`\`json\n${JSON.stringify(value)}\n\`\`\`\n`;

test('review round: cli stage1 gives one job per bench entry with its agent type and prompt', () => {
  const args = baseArgs({ preamble: 'PRE', bench: bench(cq, tc, ar) });
  const r = cli('stage1', { args });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(r.json.jobs.map((j) => [j.reviewer, j.agentType]), [cq, tc, ar].map((n) => [n, `devkit-core:${n}`]));
  assert.ok(r.json.jobs.every((j) => j.prompt.startsWith('PRE\n\n') && /write no file/.test(j.prompt)));
});

test('review round: cli verify makes three jobs per finding to verify and reports a reviewer without a usable block', () => {
  const args = baseArgs({ bench: bench(cq, tc, ar) });
  const r = cli('verify', { args, stage1: { [cq]: stage1Of(cq, mixed()), [tc]: fenced(stage1Of(tc, [finding()])), [ar]: 'I reviewed it and found nothing to say.' } });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(r.json.jobs.map((j) => `${j.reviewer} ${j.id} ${j.k}`), [
    ...['F1', 'F2'].flatMap((id) => [1, 2, 3].map((k) => `${cq} ${id} ${k}`)),
    ...[1, 2, 3].map((k) => `${tc} F1 ${k}`),
  ]);
  assert.ok(r.json.jobs.every((j) => j.agentType === 'devkit-core:finding-verifier' && /refute/i.test(j.prompt)));
  assert.deepEqual(r.json.failed, [{ reviewer: ar, stage: 'review', error: `review stage failed: ${ar} review` }]);
});

test('review round: cli reads the last fenced json block of a text value', () => {
  const first = stage1Of(cq, [finding({ text: 'FIRST' })]);
  const last = stage1Of(cq, [finding({ text: 'LAST' })]);
  const text = `${fenced(first, 'draft')}\nmore prose\n${fenced(last, 'final')}`;
  const r = cli('outcomes', { args: baseArgs(), stage1: { [cq]: text }, votes: {} });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.json.outcomes[0].lines[0], /LAST/);
});

test('review round: cli outcomes decides from objects, text and null votes and counts the verifiers that failed', () => {
  const args = baseArgs();
  const r = cli('outcomes', { args, stage1: { [cq]: stage1Of(cq, [finding(), finding({ id: 'F2', text: 'two' })]) }, votes: {
    [`${cq}#F1`]: [refute('e1'), fenced(refute('e2')), null],
    [`${cq}#F2`]: [null, 'no block here', keep()],
  } });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(r.json.outcomes[0].findings.map((f) => f.status), ['refuted', 'open']);
  assert.equal(r.json.outcomes[0].verdict, 'rejected');
  assert.equal(r.json.verifiersFailed, 3);
  assert.deepEqual(r.json.failed, []);
});

test('review round: cli outcomes lists a reviewer whose stage 1 is unusable as failed', () => {
  const r = cli('outcomes', { args: baseArgs({ bench: bench(cq, tc) }), stage1: { [cq]: null, [tc]: stage1Of(tc, []) }, votes: {} });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(r.json.failed.map((f) => f.error), [`review stage failed: ${cq} review`]);
  assert.deepEqual(r.json.outcomes.map((o) => o.reviewer), [tc]);
});

test('review round: cli consolidate returns the consensus and the review.md section', () => {
  const args = baseArgs({ path: 'agents' });
  const outcome = outcomeOf(args, validateStage1(cq, stage1Of(cq, [])), {});
  const r = cli('consolidate', { args, outcomes: [outcome], failed: [], notes: ['completed with the Agent tool: x'] });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.json.consensus, 'PASS');
  assert.match(r.json.text, /^Path: agents /m);
  assert.match(r.json.text, /^- completed with the Agent tool: x$/m);
});

test('review round: cli usage errors exit 3 with the review usage prefix', () => {
  const unknown = spawnSync(process.execPath, [CLI, 'explode', '--input', 'x.json'], { encoding: 'utf8' });
  assert.equal(unknown.status, 3);
  assert.match(unknown.stderr, /^review usage: /);
  const none = spawnSync(process.execPath, [CLI], { encoding: 'utf8' });
  assert.equal(none.status, 3);
  assert.match(none.stderr, /^review usage: /);
  const noInput = spawnSync(process.execPath, [CLI, 'stage1'], { encoding: 'utf8' });
  assert.equal(noInput.status, 3);
  assert.match(noInput.stderr, /^review usage: .*--input/);
  const missing = spawnSync(process.execPath, [CLI, 'stage1', '--input', join(scratch, 'nope.json')], { encoding: 'utf8' });
  assert.equal(missing.status, 3);
  assert.match(missing.stderr, /^review usage: /);
});

test('review round: cli input errors exit 3 with the review input invalid prefix', () => {
  for (const [sub, input] of [
    ['stage1', { args: baseArgs({ round: 9 }) }],
    ['verify', { args: baseArgs({ bench: [] }), stage1: {} }],
    ['outcomes', { args: baseArgs(), stage1: { [cq]: stage1Of(cq, [finding()]) }, votes: { [`${cq}#F1`]: [7, 8, 9] } }],
    ['consolidate', { args: baseArgs({ structural: 'FAIL' }), outcomes: [], failed: [], notes: [] }],
    ['stage1', {}],
  ]) {
    const r = cli(sub, input);
    assert.equal(r.status, 3, `${sub}: ${r.stderr}`);
    assert.match(r.stderr, /^review input invalid: /, sub);
  }
  const bad = cli('stage1', '{ not json', { raw: true });
  assert.equal(bad.status, 3);
  assert.match(bad.stderr, /^review input invalid: /);
});

test('review round: cli check-file exits 0 for a file written from the outcome', () => {
  const o = fileOutcome();
  const file = writeVerdictFile(o);
  const r = cli('check-file', { file, outcome: o });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(r.json, { ok: true });
});

function fileOutcome() {
  const args = baseArgs();
  return outcomeOf(args, validateStage1(cq, stage1Of(cq, [finding(), finding({ id: 'F2', severity: 'blocking', text: 'two' }), finding({ id: 'F3', severity: 'nit', text: 'n' })])), { F1: [refute('e1'), refute('e2'), keep()], F2: [keep(), keep(), keep()] });
}
function writeVerdictFile(o, { verdict = o.verdict, commit = `Commit: ${o.commit}`, lines = o.lines } = {}) {
  const file = join(scratch, `verdict-${seq += 1}.md`);
  writeFileSync(file, `Verdict: ${verdict}\n${commit}\n\n${o.heading}\n\n### Findings\n${lines.join('\n')}\n\n${o.sections}\n`);
  return file;
}

test('review round: cli check-file exits 2 with the mismatch prefix for a missing file, line 1, line 2 and a missing refuted line', () => {
  const o = fileOutcome();
  assert.equal(o.verdict, 'rejected');
  const cases = {
    missing: join(scratch, 'does-not-exist.md'),
    'line 1': writeVerdictFile(o, { verdict: 'approved' }),
    'line 2': writeVerdictFile(o, { commit: `Commit: ${SHA2}` }),
    'uncommitted marker': writeVerdictFile(o, { commit: `Commit: ${SHA} (uncommitted changes)` }),
    'refuted line': writeVerdictFile(o, { lines: o.lines.filter((l) => !/refuted:/.test(l)) }),
    'reworded blocking line': writeVerdictFile(o, { lines: o.lines.map((l) => l.replace('two', 'TWO')) }),
  };
  for (const [what, file] of Object.entries(cases)) {
    const r = cli('check-file', { file, outcome: o });
    assert.equal(r.status, 2, `${what}: ${r.stderr}`);
    assert.match(r.stderr, new RegExp(`^review file mismatch: ${file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}: `), what);
  }
  const nit = writeVerdictFile(o, { lines: o.lines.filter((l) => !l.startsWith('- [nit]')) });
  assert.equal(cli('check-file', { file: nit, outcome: o }).status, 0, 'a nit is not checked');
});

test('review round: cli equals the workflow for the same fixtures, except the path (AC-5)', async () => {
  const stage1 = { [cq]: stage1Of(cq, mixed()), [tc]: stage1Of(tc, [finding({ text: 'tc finding' }), finding({ id: 'F2', severity: 'nit', text: 'tc nit' })], { commit: SHA2 }) };
  const votes = {
    [`${cq} F1`]: [refute('e1'), refute('e2'), keep()],
    [`${cq} F2`]: [refute('e1'), { refuted: true, evidence: '' }, null],
    [`${tc} F1`]: [null, null, null],
  };
  const h = harness({ respond: responder({ stage1, votes }) });
  const viaWorkflow = await h.run(baseArgs({ bench: bench(cq, tc) }));

  const args = baseArgs({ bench: bench(cq, tc), path: 'agents' });
  assert.equal(cli('stage1', { args }).status, 0);
  const verify = cli('verify', { args, stage1 });
  assert.equal(verify.status, 0, verify.stderr);
  assert.equal(verify.json.jobs.length, h.calls.filter((c) => c.phase === 'verify').length);
  const asVotes = {};
  for (const [key, list] of Object.entries(votes)) asVotes[key.replace(' ', '#')] = list;
  const outcomes = cli('outcomes', { args, stage1, votes: asVotes });
  assert.equal(outcomes.status, 0, outcomes.stderr);
  assert.deepEqual(outcomes.json.outcomes, JSON.parse(JSON.stringify(viaWorkflow.outcomes)));
  assert.equal(outcomes.json.verifiersFailed, viaWorkflow.verifiersFailed);
  const notes = outcomes.json.verifiersFailed ? [`verifiers failed: ${outcomes.json.verifiersFailed}`] : [];
  const consolidated = cli('consolidate', { args, outcomes: outcomes.json.outcomes, failed: outcomes.json.failed, notes });
  assert.equal(consolidated.status, 0, consolidated.stderr);
  assert.match(consolidated.json.text, /^Path: agents /m);
  assert.equal(consolidated.json.text.replace('Path: agents', 'Path: workflow'), viaWorkflow.reviewMd);
  assert.equal(consolidated.json.consensus, viaWorkflow.consensus);
});

// ---- text (agents, skills, docs) ---------------------------------------

const ROOT = join(here, '..', '..', '..', '..', '..');
const readRoot = (p) => readFileSync(join(ROOT, p), 'utf8');
const REVIEWERS = ['code-quality', 'test-coverage', 'architecture', 'security', 'adr', 'spec'];

test('review round: text all six reviewer agents have the Staged round paragraph', () => {
  for (const r of REVIEWERS) {
    const body = readRoot(`plugins/core/agents/${r}-reviewer.md`);
    assert.match(body, /^### Staged round$/m, r);
    assert.ok(body.indexOf('### Staged round') < body.indexOf('\n## Output'), `${r}: inside the Verdict file section`);
  }
});

test('review round: text finding-verifier exists and its tools hold neither Write nor Edit', () => {
  const body = readRoot('plugins/core/agents/finding-verifier.md');
  const tools = /^tools:\s*(.*)$/m.exec(body)?.[1] ?? '';
  assert.match(body, /^name: finding-verifier$/m);
  assert.match(body, /^description: .*Use when/m);
  assert.match(body, /^model: sonnet$/m);
  assert.ok(tools.length > 0);
  assert.doesNotMatch(tools, /\bWrite\b|\bEdit\b/);
});

test('review round: text review-change names the script, the two paths and check-file', () => {
  const s = readRoot('plugins/core/skills/review-change/SKILL.md');
  assert.match(s, /scripts\/review-round\.workflow\.js/);
  assert.match(s, /scriptPath/);
  assert.match(s, /`agents` path/);
  assert.match(s, /subagent_type: devkit-core:<reviewer>/);
  assert.match(s, /one message per stage/);
  assert.match(s, /check-file/);
  for (const sub of ['stage1', 'verify', 'outcomes', 'consolidate']) assert.ok(s.includes(`review-round.mjs ${sub}`), sub);
  const desc = /^description: (.*)$/m.exec(s)[1];
  assert.ok(desc.length < 520, `description is ${desc.length} characters`);
  assert.match(desc, /Use after/);
  assert.match(desc, /verif/);
  assert.doesNotMatch(s, /ADR 000\d|adr\/000\d/);
});

test('review round: text review-change holds the result-check row and runs the whole round on the agents path', () => {
  const s = readRoot('plugins/core/skills/review-change/SKILL.md');
  const i = s.indexOf('Workflow result invalid');
  assert.ok(i > 0);
  assert.match(s.slice(i - 600, i + 600), /whole round[^.]*`agents` path|`agents` path[^.]*whole round/);
});

test('review round: text review-change holds the lost-round row and drops the busy mark', () => {
  const s = readRoot('plugins/core/skills/review-change/SKILL.md');
  const i = s.indexOf('Workflow lost: no completion notice');
  assert.ok(i > 0);
  assert.match(s.slice(i - 900, i + 600), /busy mark/);
  assert.match(s.slice(i - 900, i + 600), /drop/);
});

test('review round: text the ship-change review row and conduct Delivery item 5 name the Workflow tool, the agents path and the lost round', () => {
  const ship = readRoot('plugins/openspec/skills/ship-change/SKILL.md');
  const row = ship.split('\n').find((l) => l.startsWith('| `review` |'));
  assert.ok(row);
  assert.match(row, /Workflow tool/);
  assert.match(row, /`agents` path/);
  assert.match(row, /declares the round lost/);
  const fixRow = ship.split('\n').find((l) => l.startsWith('| `fix-review`'));
  assert.match(fixRow, /approved review/);
  const conduct = readRoot('plugins/openspec/skills/conduct/SKILL.md');
  const item = conduct.split('\n').find((l) => l.startsWith('5. `review`'));
  assert.ok(item);
  assert.match(item, /Workflow tool/);
  assert.match(item, /`agents` path/);
  assert.match(item, /--busy/);
  assert.match(item, /declared lost/);
});

test('review round: text docs/openspec-flow.md has the review round section and links ADR 0008', () => {
  const d = readRoot('docs/openspec-flow.md');
  assert.match(d, /^## The review round$/m);
  assert.ok(d.indexOf('## The review round') < d.indexOf('## The delivery contract'));
  assert.ok(d.includes('adr/0008-reviews-as-a-workflow.md'));
  assert.match(d.split('\n').find((l) => l.startsWith('| One writer per gate file')), /finding-verifier/);
  assert.match(d, /`Path: agents` on a typed turn|Path: agents.*typed turn/);
  assert.match(readRoot('plugins/core/README.md').split('\n').find((l) => l.startsWith('| Review |')), /verif/);
});
