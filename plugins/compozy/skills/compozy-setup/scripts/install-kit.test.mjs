// node --test plugins/compozy/skills/compozy-setup/scripts/install-kit.test.mjs
//
// Pins AC-11 (coordinator-field-fixes, design D-8): `install-kit.mjs` installs the kit's eight files
// with a manifest of digests, and a re-run updates what the project did not edit, leaves what it
// edited (printing the difference) until the owner accepts that file, and treats a file with no
// record as edited. It also pins the grill sentences of the loop template and the planner shell.
// Each test copies the compozy-setup folder (scripts and templates) to a temporary directory, so a
// template can change without touching the repository and the script reads its sibling templates.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SETUP_DIR = join(here, '..');

const ROLES = ['tech-lead', 'dev', 'qa', 'design'];
const KIT_FILES = [
  'config.toml',
  'README.md',
  ...ROLES.map((role) => `agents/${role}/AGENT.md`),
  'loops/openspec-change/loop.yaml',
  'bin/devkit-kit',
];
const LOOP = 'loops/openspec-change/loop.yaml';

const sha256 = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

// A project root and its own copy of compozy-setup, removed at the end of the test.
function sandbox(t) {
  const dir = mkdtempSync(join(tmpdir(), 'install-kit-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const setup = join(dir, 'kit', 'compozy-setup');
  cpSync(SETUP_DIR, setup, { recursive: true, filter: (src) => !src.endsWith('.test.mjs') });
  const root = join(dir, 'project');
  mkdirSync(root);
  const script = join(setup, 'scripts', 'install-kit.mjs');
  const run = (...args) => {
    const r = spawnSync('node', [script, ...args], { encoding: 'utf8' });
    return { status: r.status, out: r.stdout, err: r.stderr };
  };
  return { dir, setup, root, run, compozy: (...p) => join(root, '.compozy', ...p) };
}

function manifestOf(sb) {
  return JSON.parse(readFileSync(sb.compozy('kit-manifest.json'), 'utf8'));
}

// The state printed for `.compozy/<file>` in the one-line-per-file report.
function stateOf(out, file) {
  const line = out.split('\n').find((l) => l.endsWith(` .compozy/${file}`));
  assert.ok(line, `no report line for .compozy/${file} in:\n${out}`);
  return line.slice(0, 9).trim();
}

test('field-fixes 8 kit: a first install writes the eight files and a manifest with the digests and the inputs', (t) => {
  const sb = sandbox(t);
  const r = sb.run(sb.root, '--set', '__TIMEZONE__=America/Sao_Paulo');
  assert.equal(r.status, 0, r.err);
  for (const file of KIT_FILES) {
    assert.ok(existsSync(sb.compozy(file)), `${file} must be written`);
    assert.equal(stateOf(r.out, file), 'create');
  }
  assert.ok((statSync(sb.compozy('bin/devkit-kit')).mode & 0o777) === 0o755, 'devkit-kit must be mode 755');
  assert.match(readFileSync(sb.compozy('config.toml'), 'utf8'), /timezone = "America\/Sao_Paulo"/);
  const manifest = manifestOf(sb);
  assert.equal(manifest.version, 1);
  assert.equal(manifest.inputs.__TIMEZONE__, 'America/Sao_Paulo');
  assert.equal(manifest.inputs.__PLANNER__, 'tech-lead');
  assert.deepEqual(Object.keys(manifest.files).sort(), [...KIT_FILES].sort());
  for (const file of KIT_FILES) {
    assert.equal(manifest.files[file], sha256(readFileSync(sb.compozy(file))), `digest of ${file}`);
  }
});

test('field-fixes 8 kit: a re-run with a changed template updates an unedited file with the recorded inputs', (t) => {
  const sb = sandbox(t);
  assert.equal(sb.run(sb.root, '--set', '__TIMEZONE__=Europe/Lisbon').status, 0);
  const template = join(sb.setup, 'templates', 'README.md');
  writeFileSync(template, `${readFileSync(template, 'utf8')}\nA new sentence of the template.\n`);
  const r = sb.run(sb.root);
  assert.equal(r.status, 0, r.err);
  assert.equal(stateOf(r.out, 'README.md'), 'update');
  assert.match(readFileSync(sb.compozy('README.md'), 'utf8'), /A new sentence of the template\./);
  assert.equal(stateOf(r.out, 'config.toml'), 'same');
  assert.match(readFileSync(sb.compozy('config.toml'), 'utf8'), /timezone = "Europe\/Lisbon"/, 'the recorded input is reused');
  assert.equal(manifestOf(sb).files['README.md'], sha256(readFileSync(sb.compozy('README.md'))));
});

test('field-fixes 8 kit: a file already equal to its rendering is reported same, not written, and its digest recorded', (t) => {
  const sb = sandbox(t);
  assert.equal(sb.run(sb.root).status, 0);
  rmSync(sb.compozy('kit-manifest.json'));
  const old = new Date('2020-01-01T00:00:00Z');
  utimesSync(sb.compozy('config.toml'), old, old);
  const r = sb.run(sb.root);
  assert.equal(r.status, 0, r.err);
  assert.equal(stateOf(r.out, 'config.toml'), 'same');
  assert.equal(statSync(sb.compozy('config.toml')).mtimeMs, old.getTime(), 'a same file is not written');
  assert.equal(manifestOf(sb).files['config.toml'], sha256(readFileSync(sb.compozy('config.toml'))));
});

test('field-fixes 8 kit: an edited loop.yaml is left in place with its difference printed while the others update', (t) => {
  const sb = sandbox(t);
  assert.equal(sb.run(sb.root).status, 0);
  const before = manifestOf(sb).files[LOOP];
  const edited = `${readFileSync(sb.compozy(LOOP), 'utf8')}# the project's own line\n`;
  writeFileSync(sb.compozy(LOOP), edited);
  const template = join(sb.setup, 'templates', 'README.md');
  writeFileSync(template, `${readFileSync(template, 'utf8')}\nAnother template sentence.\n`);
  const r = sb.run(sb.root);
  assert.equal(r.status, 0, r.err);
  assert.equal(stateOf(r.out, LOOP), 'edited');
  assert.equal(stateOf(r.out, 'README.md'), 'update');
  assert.equal(readFileSync(sb.compozy(LOOP), 'utf8'), edited, 'the edited file is left as the project wrote it');
  assert.match(r.out, /-# the project's own line/, 'the difference from the rendering is printed');
  assert.equal(manifestOf(sb).files[LOOP], before, 'an edited file keeps its old digest');
});

test('field-fixes 8 kit: --accept writes an edited file and records its digest', (t) => {
  const sb = sandbox(t);
  assert.equal(sb.run(sb.root).status, 0);
  const rendered = readFileSync(sb.compozy(LOOP), 'utf8');
  writeFileSync(sb.compozy(LOOP), `${rendered}# edited\n`);
  const r = sb.run(sb.root, '--accept', `.compozy/${LOOP}`);
  assert.equal(r.status, 0, r.err);
  assert.equal(stateOf(r.out, LOOP), 'accepted');
  assert.equal(readFileSync(sb.compozy(LOOP), 'utf8'), rendered);
  assert.equal(manifestOf(sb).files[LOOP], sha256(rendered));
});

test('field-fixes 8 kit: an install with no manifest treats a differing config.toml as edited', (t) => {
  const sb = sandbox(t);
  assert.equal(sb.run(sb.root).status, 0);
  rmSync(sb.compozy('kit-manifest.json'));
  const old = `${readFileSync(sb.compozy('config.toml'), 'utf8')}# an install from before the record\n`;
  writeFileSync(sb.compozy('config.toml'), old);
  const r = sb.run(sb.root);
  assert.equal(r.status, 0, r.err);
  assert.equal(stateOf(r.out, 'config.toml'), 'edited');
  assert.equal(readFileSync(sb.compozy('config.toml'), 'utf8'), old);
  assert.equal('config.toml' in manifestOf(sb).files, false, 'an edited file with no entry gets none');
});

test('field-fixes 8 kit: --json lists each file with its state, and a missing project root is a usage error', (t) => {
  const sb = sandbox(t);
  const r = sb.run(sb.root, '--json');
  assert.equal(r.status, 0, r.err);
  const report = JSON.parse(r.out);
  assert.deepEqual(report.files.map((f) => f.path).sort(), KIT_FILES.map((f) => `.compozy/${f}`).sort());
  assert.ok(report.files.every((f) => f.state === 'create'));
  const usage = sb.run();
  assert.equal(usage.status, 2);
  assert.equal(existsSync(join(sb.dir, '.compozy')), false);
});

test('field-fixes 8 grill: the loop template and the tech-lead shell say not to answer the grill and to return its questions in open_questions', () => {
  // Whitespace is flattened: the sentences wrap across lines in both files.
  const flatten = (text) => text.replace(/\s+/g, ' ');
  const loop = flatten(readFileSync(join(SETUP_DIR, 'templates', LOOP), 'utf8'));
  const shell = flatten(readFileSync(join(SETUP_DIR, 'templates', 'agents', 'tech-lead', 'AGENT.md'), 'utf8'));
  for (const [name, text] of [['loop.yaml', loop], ['tech-lead AGENT.md', shell]]) {
    assert.match(text, /never answer/i, `${name} must say never to answer the grill`);
    assert.match(text, /open_questions|open questions?/, `${name} must return the grill's questions as open questions`);
  }
  assert.match(loop, /`open_questions`/, 'the propose prompt names the output field');
  assert.match(loop, /strict-assumed/, 'the propose prompt marks assumptions strict-assumed');
  assert.match(shell, /strict-assumed/, 'the shell marks assumptions strict-assumed');
  assert.doesNotMatch(shell, /run the grill when the schema has a/, 'the old sentence is gone');
  assert.doesNotMatch(loop, /the grill when the schema has a `requirements` artifact/, 'the old comment is gone');
});

test('field-fixes 8 grill: the review prompt names the requirements and its open questions, and the approval node shows the plan\'s open questions', () => {
  const loop = readFileSync(join(SETUP_DIR, 'templates', LOOP), 'utf8');
  const flat = loop.replace(/\s+/g, ' ');
  assert.match(flat, /\(requirements and its open questions, proposal, tasks, and design and readiness on the devkit schema\)/);
  assert.doesNotMatch(flat, /\(proposal, design, tasks, readiness\)/);
  assert.match(loop, /Open questions: \{\{ toJson \.nodes\.propose\.output\.open_questions \}\}/);
});
