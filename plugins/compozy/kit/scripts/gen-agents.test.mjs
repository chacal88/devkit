// node --test plugins/compozy/kit/scripts/gen-agents.test.mjs
//
// Pins compozy-driver D-8 (AC-7): `gen-agents.mjs` renders one CompozyOS agent per role of `PACKS`
// from the Claude agent file of that role, and `--check` says when a source and its agent differ.
// The tests that change files work on a copy of `plugins/` made by `tmpFolder` of test-tmp.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpFolder } from '../../skills/test-tmp.mjs';
import { renderAgent } from './gen-agents.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const REPO = join(here, '..', '..', '..', '..');
const GEN = join(here, 'gen-agents.mjs');
const AGENTS_AT = ['plugins', 'compozy', 'kit', 'templates', 'agents'];
const SOURCE_DIR = { 'devkit-core': 'core', 'devkit-openspec': 'openspec' };

const { PACKS } = await import(pathToFileURL(join(REPO, 'plugins', 'openspec', 'hooks', 'change-loop.mjs')).href);
const ROLES = Object.keys(PACKS).sort();
const REVIEW_ICON = ['code-quality-reviewer', 'test-coverage-reviewer', 'architecture-reviewer', 'security-reviewer', 'spec-reviewer',
  'adr-reviewer', 'finding-verifier', 'plan-reality-auditor', 'plan-readiness-reviewer', 'openspec-validator'];

const sourcePath = (root, role) => join(root, 'plugins', SOURCE_DIR[PACKS[role]], 'agents', `${role}.md`);
const agentPath = (root, role) => join(root, ...AGENTS_AT, role, 'AGENT.md');
const read = (p) => readFileSync(p, 'utf8');
const frontmatterOf = (text) => text.split('\n').slice(1, text.split('\n').indexOf('---', 1));
// CompozyOS (0.6.2) refuses an agent whose description holds more than 280 characters.
const LIMIT = 280;
const chars = (text) => Array.from(text).length;
// The value of a `description:` frontmatter line, read as the YAML scalar it is (plain, or double-quoted as JSON is).
const descriptionValue = (line) => {
  const raw = line.slice('description:'.length).trim();
  return raw.startsWith('"') ? JSON.parse(raw) : raw;
};
const descriptionOf = (text) => descriptionValue(frontmatterOf(text).find((l) => l.startsWith('description:')));
const bodyOf = (text) => text.slice(text.indexOf('\n---', 3) + 4).replace(/^\n+/, '');

function run(args, cwd = REPO) {
  const r = spawnSync('node', [GEN, ...args], { cwd, encoding: 'utf8' });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

// A copy of plugins/ in a folder removed with the test, and the generator run against it.
function copyOfPlugins() {
  const root = tmpFolder('devkit-gen-agents-');
  cpSync(join(REPO, 'plugins'), join(root, 'plugins'), { recursive: true, filter: (src) => !src.endsWith('.test.mjs') && !src.includes('node_modules') });
  const gen = join(root, 'plugins', 'compozy', 'kit', 'scripts', 'gen-agents.mjs');
  return { root, gen: (...args) => { const r = spawnSync('node', [gen, ...args], { encoding: 'utf8' }); return { code: r.status, out: r.stdout, err: r.stderr }; } };
}

test('compozy-agents set: the agents are the keys of PACKS and no shell of the old kit', () => {
  assert.equal(ROLES.length, 21, 'PACKS holds 21 roles');
  const dirs = readdirSync(join(REPO, ...AGENTS_AT)).sort();
  assert.deepEqual(dirs, ROLES);
  for (const old of ['tech-lead', 'dev', 'qa', 'design']) assert.ok(!dirs.includes(old), `${old} left the kit`);
  for (const role of ROLES) assert.ok(existsSync(agentPath(REPO, role)), `${role} has an AGENT.md`);
});

test('compozy-agents frontmatter: every key the daemon reads, and the source body', () => {
  for (const role of ROLES) {
    const text = read(agentPath(REPO, role));
    const src = read(sourcePath(REPO, role));
    const fm = frontmatterOf(text);
    for (const key of ['name', 'display_name', 'description', 'provider', 'permissions', 'category_path', 'appearance']) {
      assert.ok(fm.some((l) => l.startsWith(`${key}:`)), `${role} has ${key}`);
    }
    assert.ok(fm.includes(`name: ${role}`), `${role} is named like its role`);
    assert.ok(fm.includes('provider: claude') && fm.includes('permissions: approve-all'), `${role} runs a Claude seat`);
    assert.ok(fm.includes('category_path: [Project, Devkit]'), `${role} is filed under Devkit`);
    assert.ok(fm.includes('  color: "#5B5BD6"'), `${role} has the kit's color`);
    const want = descriptionValue(frontmatterOf(src).find((l) => l.startsWith('description:')));
    const got = descriptionOf(text);
    assert.ok(chars(got) <= LIMIT, `${role} has a description of at most ${LIMIT} characters`);
    assert.ok(want.startsWith(got.replace(/…$/, '')), `${role}'s description is the start of the source's`);
    if (chars(want) <= LIMIT) assert.equal(got, want, `${role} keeps a short description whole`);
    assert.ok(text.includes(bodyOf(src).trimEnd()), `${role} holds the source body unchanged`);
    assert.match(text, /## The role's instructions/, `${role} names where the instructions start`);
    assert.match(text, /<!-- Generated by [^\n]*gen-agents\.mjs from plugins\/[a-z]+\/agents\/[\w-]+\.md/, `${role} names its source`);
  }
  const display = frontmatterOf(read(agentPath(REPO, 'plan-readiness-reviewer'))).find((l) => l.startsWith('display_name:'));
  assert.equal(display, 'display_name: Plan Readiness Reviewer');
});

test('compozy-agents icon: shield-check for the checking roles, list-checks for the other eleven', () => {
  const icon = (role) => frontmatterOf(read(agentPath(REPO, role))).find((l) => l.startsWith('  icon:'));
  assert.equal(REVIEW_ICON.length, 10);
  for (const role of REVIEW_ICON) assert.equal(icon(role), '  icon: shield-check', role);
  const rest = ROLES.filter((r) => !REVIEW_ICON.includes(r));
  assert.equal(rest.length, 11);
  for (const role of rest) assert.equal(icon(role), '  icon: list-checks', role);
  for (const role of ['screen-designer', 'adr-author', 'test-runner', 'e2e-tester', 'requirements-triage']) assert.ok(rest.includes(role), `${role} takes list-checks`);
});

test('compozy-agents seat: every agent hands its work to the Claude agent and maps the outcome words', () => {
  for (const role of ROLES) {
    const text = read(agentPath(REPO, role));
    assert.match(text, new RegExp(`Claude agent \`${PACKS[role]}:${role}\``), `${role} names the Claude agent it hands work to`);
    assert.match(text, /Agent tool/, `${role} hands work with the Agent tool`);
    assert.match(text, /`Read only:`/, `${role} runs a Read only prompt itself`);
  }
  const seat = read(agentPath(REPO, 'tdd-implementer'));
  assert.match(seat, /`Outcome: failure` returns `failure`/, 'a failure outcome returns failure');
  const done = seat.split('\n').find((l) => /returns `done`/.test(l));
  assert.ok(done, 'one line names the outcome words that return done');
  for (const word of ['success', 'planned', 'escalated', 'shipped', 'refused', 'verified', 'defect-found', 'green', 'red', 'proposed <n>', 'none-needed', 'drawn']) {
    assert.ok(done.includes(`\`${word}\``), `the outcome word ${word} returns done`);
  }
  assert.match(seat, /no Outcome line returns `failure`/, 'a report with no Outcome line returns failure');
});

test('compozy-agents check: the repository is up to date', () => {
  const r = run(['--check']);
  assert.equal(r.code, 0, r.out + r.err);
});

test('compozy-agents check: a changed source line makes it exit 1 naming that role, and generating again makes it 0 (AC-7)', () => {
  const { root, gen } = copyOfPlugins();
  assert.equal(gen('--check').code, 0, 'the copy starts up to date');
  const src = sourcePath(root, 'spec-reviewer');
  writeFileSync(src, `${read(src).trimEnd()}\n\nOne more line the owner added to the source.\n`);
  const stale = gen('--check');
  assert.equal(stale.code, 1);
  assert.match(stale.out + stale.err, /spec-reviewer/);
  assert.doesNotMatch(stale.out + stale.err, /code-quality-reviewer/, 'only the changed role is named');
  const before = read(agentPath(root, 'spec-reviewer'));
  assert.equal(gen('--check').code, 1, '--check wrote nothing');
  assert.equal(read(agentPath(root, 'spec-reviewer')), before);
  assert.equal(gen().code, 0);
  assert.match(read(agentPath(root, 'spec-reviewer')), /One more line the owner added to the source\./);
  assert.equal(gen('--check').code, 0);
});

test('compozy-agents check: --root reads another repository', () => {
  const { root } = copyOfPlugins();
  const r = run(['--check', '--root', root]);
  assert.equal(r.code, 0, r.out + r.err);
  writeFileSync(sourcePath(root, 'adr-author'), `${read(sourcePath(root, 'adr-author'))}\nchanged\n`);
  const stale = run(['--check', '--root', root]);
  assert.equal(stale.code, 1);
  assert.match(stale.out, /adr-author/);
});

test('compozy-agents check: a missing agent and an extra agent each exit 1 naming the role', () => {
  const { root, gen } = copyOfPlugins();
  rmSync(join(root, ...AGENTS_AT, 'test-runner'), { recursive: true });
  const missing = gen('--check');
  assert.equal(missing.code, 1);
  assert.match(missing.out + missing.err, /test-runner/);
  assert.equal(gen().code, 0, 'generating writes the missing agent again');
  assert.ok(existsSync(agentPath(root, 'test-runner')));
  mkdirSync(join(root, ...AGENTS_AT, 'tech-lead'));
  writeFileSync(join(root, ...AGENTS_AT, 'tech-lead', 'AGENT.md'), '---\nname: tech-lead\n---\n');
  const extra = gen('--check');
  assert.equal(extra.code, 1);
  assert.match(extra.out + extra.err, /tech-lead/);
  assert.equal(gen().code, 0);
  assert.ok(!existsSync(join(root, ...AGENTS_AT, 'tech-lead')), 'generating removes an agent no role names');
  assert.equal(gen('--check').code, 0);
});

test('compozy-agents sources: each of the four unreadable sources exits 2 naming the file and writes nothing', () => {
  const cases = {
    'no opening line': (text) => text.replace(/^---\n/, ''),
    'no closing line': (text) => text.slice(0, text.indexOf('\n---', 3)),
    'empty': () => '',
    'no name': (text) => text.replace(/^name:.*\n/m, ''),
    'no description': (text) => text.replace(/^description:.*\n/m, ''),
  };
  for (const [label, damage] of Object.entries(cases)) {
    const { root, gen } = copyOfPlugins();
    const src = sourcePath(root, 'finding-verifier');
    const target = agentPath(root, 'finding-verifier');
    writeFileSync(src, damage(read(src)));
    rmSync(target);
    const r = gen();
    assert.equal(r.code, 2, `${label}: ${r.out}${r.err}`);
    assert.match(r.err, /finding-verifier\.md/, `${label}: names the file`);
    assert.ok(!existsSync(target), `${label}: writes nothing`);
    assert.equal(gen('--check').code, 2, `${label}: --check exits 2 too`);
  }
});

// A Claude agent file with the given description line value and a one-line body.
const sourceWith = (description, body = 'Do the work.') => `---\nname: probe\ndescription: ${description}\ntools: Read\n---\n\n${body}\n`;
const renderedDescription = (description) => descriptionOf(renderAgent('probe', 'devkit-core', sourceWith(description)));
// Words of 5 letters and a space, as many as make `n` characters with a final period.
const sentenceOf = (n) => `${'word '.repeat(Math.ceil(n / 5)).slice(0, n - 1).trimEnd().padEnd(n - 1, 'x')}.`;

test('compozy-agents description: one of 100 characters stays whole', () => {
  const text = sentenceOf(100);
  assert.equal(chars(text), 100);
  assert.equal(renderedDescription(text), text);
});

test('compozy-agents description: one of exactly 280 characters stays whole', () => {
  const text = `${sentenceOf(100)} ${sentenceOf(179)}`;
  assert.equal(chars(text), LIMIT);
  assert.equal(renderedDescription(text), text);
});

test('compozy-agents description: 281 characters in two sentences keep the first sentence only', () => {
  const first = sentenceOf(100);
  const text = `${first} ${sentenceOf(180)}`;
  assert.equal(chars(text), LIMIT + 1);
  assert.equal(renderedDescription(text), first);
});

test('compozy-agents description: whole sentences are kept while they fit, the first that does not fit is dropped with the rest', () => {
  const [a, b, c] = [sentenceOf(120), sentenceOf(100), sentenceOf(90)];
  assert.equal(renderedDescription(`${a} ${b} ${c}`), `${a} ${b}`);
});

test('compozy-agents description: one 400-character sentence is cut at a word boundary and ends with an ellipsis', () => {
  const text = sentenceOf(400);
  assert.equal(chars(text), 400);
  const got = renderedDescription(text);
  assert.ok(chars(got) <= LIMIT, `${chars(got)} characters`);
  assert.ok(got.endsWith('…'));
  const kept = got.slice(0, -1);
  assert.ok(text.startsWith(kept), 'the cut text is the start of the source');
  assert.ok(text[kept.length] === ' ', 'the cut falls on a word boundary');
  assert.ok(!/\s$/.test(kept), 'no space before the ellipsis');
  assert.ok(chars(got) >= LIMIT - 5, 'it keeps as many whole words as fit');
});

test('compozy-agents description: a first sentence of 279 characters and a space after it takes the cut, never an ellipsis past the limit', () => {
  const text = `${sentenceOf(279)} ${sentenceOf(50)}`;
  assert.equal(renderedDescription(text), sentenceOf(279));
  const long = `${sentenceOf(281)} ${sentenceOf(50)}`;
  const got = renderedDescription(long);
  assert.ok(chars(got) <= LIMIT && got.endsWith('…'));
});

test('compozy-agents description: a word longer than the limit is cut at the limit with an ellipsis', () => {
  const got = renderedDescription('x'.repeat(400));
  assert.equal(chars(got), LIMIT);
  assert.equal(got, `${'x'.repeat(LIMIT - 1)}…`);
});

test('compozy-agents description: characters are counted, not bytes, and a dash and backticks survive', () => {
  const text = `Plans — and \`reviews\` them — with care ${'éééé '.repeat(80).trimEnd()}. Second sentence.`;
  const got = renderedDescription(text);
  assert.ok(chars(got) <= LIMIT, `${chars(got)} characters`);
  assert.ok(Buffer.byteLength(got) > LIMIT, 'the test text holds more bytes than characters');
  assert.ok(got.startsWith('Plans — and `reviews` them — with care '));
  assert.ok(got.endsWith('…'));
  const short = 'Plans — and `reviews` them. Then — `ships` them.';
  assert.equal(renderedDescription(short), short);
});

test('compozy-agents description: a quoted source is read as its value, and a value with a colon or a hash is written quoted', () => {
  const quoted = 'Reviews "the design": not its style # a note. Second sentence follows here.';
  const text = renderAgent('probe', 'devkit-core', sourceWith(JSON.stringify(quoted)));
  assert.equal(descriptionOf(text), quoted);
  assert.match(frontmatterOf(text).find((l) => l.startsWith('description:')), /^description: "/);
  const colon = descriptionOf(renderAgent('probe', 'devkit-core', sourceWith('Use it when: a plan is ready.')));
  assert.equal(colon, 'Use it when: a plan is ready.');
  const special = renderAgent('probe', 'devkit-core', sourceWith("'`Plan` first, don''t skip it'"));
  assert.equal(descriptionOf(special), "`Plan` first, don't skip it");
  assert.match(frontmatterOf(special).find((l) => l.startsWith('description:')), /^description: "/, 'a leading backtick is quoted');
});

test('compozy-agents description: a block scalar in a source is refused naming the file', () => {
  assert.throws(() => renderAgent('probe', 'devkit-core', sourceWith('>'), 'plugins/core/agents/probe.md'), /plugins\/core\/agents\/probe\.md/);
});

test('compozy-agents description: the instructions body and the header comment', () => {
  const body = 'Line one.\n\n- keep this: exactly\n- and this # too\n';
  const text = renderAgent('probe', 'devkit-core', sourceWith(`${sentenceOf(200)} ${sentenceOf(200)}`, body));
  assert.ok(text.endsWith(`${body.trimEnd()}\n`), 'the body is the exact source text');
  assert.match(text, /<!-- Generated by [^\n]*gen-agents\.mjs from plugins\/core\/agents\/probe\.md[^\n]*description[^\n]*shortened to[^\n]*280-character limit[^\n]*-->/);
});

test('compozy-agents check: an agent holding the full long description exits 1 naming the role, generating fixes it', () => {
  const { root, gen } = copyOfPlugins();
  const role = 'spec-reviewer';
  const full = frontmatterOf(read(sourcePath(root, role))).find((l) => l.startsWith('description:'));
  assert.ok(chars(descriptionValue(full)) > LIMIT, 'the source is longer than the limit');
  const target = agentPath(root, role);
  const short = frontmatterOf(read(target)).find((l) => l.startsWith('description:'));
  writeFileSync(target, read(target).replace(short, full));
  const stale = gen('--check');
  assert.equal(stale.code, 1);
  assert.match(stale.out, /spec-reviewer/);
  assert.doesNotMatch(stale.out, /code-quality-reviewer/);
  assert.equal(gen().code, 0);
  assert.ok(chars(descriptionOf(read(target))) <= LIMIT);
  assert.equal(gen('--check').code, 0);
});

test('compozy-agents check: changing the first words of a source description exits 1 until generating again (AC-7)', () => {
  const { root, gen } = copyOfPlugins();
  const role = 'code-quality-reviewer';
  const src = sourcePath(root, role);
  const line = frontmatterOf(read(src)).find((l) => l.startsWith('description:'));
  assert.ok(/^description: "?Reviews /.test(line), 'the source description starts with Reviews');
  writeFileSync(src, read(src).replace(line, line.replace(/Reviews /, 'Examines ')));
  const stale = gen('--check');
  assert.equal(stale.code, 1);
  assert.match(stale.out, /code-quality-reviewer/);
  assert.equal(gen().code, 0);
  assert.match(descriptionOf(read(agentPath(root, role))), /^Examines /);
  assert.equal(gen('--check').code, 0);
});

test('compozy-agents limit: every generated agent file of the kit holds a description of at most 280 characters (the CompozyOS rule)', () => {
  for (const role of ROLES) {
    const got = descriptionOf(read(agentPath(REPO, role)));
    assert.ok(chars(got) > 0, `${role} has a description`);
    assert.ok(chars(got) <= LIMIT, `${role}: ${chars(got)} characters`);
  }
});
