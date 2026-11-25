// node --test plugins/compozy/kit/scripts/install-kit.test.mjs
//
// Pins AC-11 (coordinator-field-fixes, design D-8): `install-kit.mjs` installs the kit's files with a
// manifest of digests, and a re-run updates what the project did not edit, leaves what it edited
// (printing the difference) until the owner accepts that file, and treats a file with no record as
// edited. It also pins compozy-driver D-10 (AC-8): the files of the old kit are retired (removed when
// unedited, kept and named when edited), and the inputs the new kit no longer has are dropped.
// Each test copies the kit folder (scripts and templates) to a temporary directory, so a
// template can change without touching the repository and the script reads its sibling templates.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpFolder } from '../../skills/test-tmp.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const SETUP_DIR = join(here, '..');

// The agents are the folders of templates/agents, sorted (the installer lists them at run time too); the set itself is
// pinned by gen-agents.test.mjs, here only that no shell of the old kit is among them.
const AGENTS = readdirSync(join(SETUP_DIR, 'templates', 'agents')).sort();
const LOOPS = ['devkit-change', 'devkit-review', 'devkit-roadmap'];
const KIT_FILES = [
  'config.toml',
  'README.md',
  ...AGENTS.map((role) => `agents/${role}/AGENT.md`),
  ...LOOPS.map((name) => `loops/${name}/loop.yaml`),
  'bin/devkit-kit',
];
const LOOP = 'loops/devkit-change/loop.yaml';
const RETIRED_AGENTS = ['tech-lead', 'dev', 'qa', 'design'];
const RETIRED = [...RETIRED_AGENTS.map((role) => `agents/${role}/AGENT.md`), 'loops/openspec-change/loop.yaml'];
const OLD_INPUTS = ['__PLANNER__', '__IMPLEMENTER__', '__REVIEWER__', '__DESIGNER__', '__VERIFY_COMMAND__', '__DEMO_COMMAND__', '__DEMO_URL__'];
const KEPT_SENTENCE = (file) => `edited by the project, left in place: delete it or run again with --accept .compozy/${file}`;

const sha256 = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

// A project root and its own copy of the kit folder, removed when the test ends (by test-tmp.mjs).
function sandbox(t) {
  const dir = tmpFolder('devkit-install-kit-');
  const setup = join(dir, 'kit');
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

test('field-fixes 8 kit: a first install writes the files of the kit and a manifest with the digests and the inputs', (t) => {
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
  assert.deepEqual(Object.keys(manifest.inputs).sort(), ['__MOCKUP__', '__SCREEN_MAP__', '__TIMEZONE__'], 'the new kit has three inputs');
  assert.deepEqual(Object.keys(manifest.files).sort(), [...KIT_FILES].sort());
  for (const file of KIT_FILES) {
    assert.equal(manifest.files[file], sha256(readFileSync(sb.compozy(file))), `digest of ${file}`);
  }
  for (const file of RETIRED) assert.ok(!existsSync(sb.compozy(file)), `${file} is not written`);
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

// ---------------------------------------------------------------- compozy-driver D-10 (AC-8): retired files and dropped inputs

// An installed kit with one retired file planted under `.compozy/`; `record` also writes the digest the manifest would hold.
function withRetired(sb, file, content, { record = true } = {}) {
  assert.equal(sb.run(sb.root).status, 0);
  mkdirSync(dirname(sb.compozy(file)), { recursive: true });
  writeFileSync(sb.compozy(file), content);
  if (record) {
    const manifest = manifestOf(sb);
    manifest.files[file] = sha256(content);
    writeFileSync(sb.compozy('kit-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  }
}

test('compozy-kit retired: an unedited retired file is removed with its folder and its digest leaves the manifest', (t) => {
  for (const file of RETIRED) {
    const sb = sandbox(t);
    withRetired(sb, file, `the old ${file}\n`);
    const r = sb.run(sb.root);
    assert.equal(r.status, 0, r.err);
    assert.equal(stateOf(r.out, file), 'remove', file);
    assert.equal(existsSync(sb.compozy(file)), false, `${file} is gone`);
    assert.equal(existsSync(dirname(sb.compozy(file))), false, `its folder is gone`);
    assert.equal(file in manifestOf(sb).files, false, `${file} has no digest left`);
  }
  // A folder that still holds something else stays: the installed agents' own folder is never removed.
  const sb = sandbox(t);
  withRetired(sb, 'agents/qa/AGENT.md', 'the old qa\n');
  writeFileSync(sb.compozy('agents', 'qa', 'notes.md'), 'the project\'s own file\n');
  assert.equal(stateOf(sb.run(sb.root).out, 'agents/qa/AGENT.md'), 'remove');
  assert.ok(existsSync(sb.compozy('agents', 'qa', 'notes.md')), 'a folder with another file stays');
  assert.ok(existsSync(sb.compozy('agents')), 'agents/ stays');
});

test('compozy-kit retired: an edited retired file is kept, and the output names it and how to remove it', (t) => {
  const sb = sandbox(t);
  withRetired(sb, 'agents/qa/AGENT.md', 'the old qa\n');
  writeFileSync(sb.compozy('agents', 'qa', 'AGENT.md'), 'the old qa, edited by the project\n');
  const r = sb.run(sb.root);
  assert.equal(r.status, 0, r.err);
  assert.equal(stateOf(r.out, 'agents/qa/AGENT.md'), 'kept');
  assert.ok(r.out.includes(`.compozy/agents/qa/AGENT.md: ${KEPT_SENTENCE('agents/qa/AGENT.md')}`), r.out);
  assert.equal(readFileSync(sb.compozy('agents', 'qa', 'AGENT.md'), 'utf8'), 'the old qa, edited by the project\n');
  // The next run keeps it again: nothing reads the file's edit as consent.
  assert.equal(stateOf(sb.run(sb.root).out, 'agents/qa/AGENT.md'), 'kept');
});

test('compozy-kit retired: a retired file with no recorded digest is kept, never judged by its content', (t) => {
  const sb = sandbox(t);
  withRetired(sb, 'loops/openspec-change/loop.yaml', 'an old loop\n', { record: false });
  const r = sb.run(sb.root);
  assert.equal(stateOf(r.out, 'loops/openspec-change/loop.yaml'), 'kept');
  assert.ok(r.out.includes(KEPT_SENTENCE('loops/openspec-change/loop.yaml')), r.out);
  assert.ok(existsSync(sb.compozy('loops', 'openspec-change', 'loop.yaml')));
});

test('compozy-kit retired: --accept of a retired path removes an edited file, and only that one', (t) => {
  const sb = sandbox(t);
  withRetired(sb, 'agents/qa/AGENT.md', 'the old qa\n');
  writeFileSync(sb.compozy('agents', 'qa', 'AGENT.md'), 'edited\n');
  mkdirSync(sb.compozy('agents', 'dev'), { recursive: true });
  writeFileSync(sb.compozy('agents', 'dev', 'AGENT.md'), 'edited too\n');
  const r = sb.run(sb.root, '--accept', '.compozy/agents/qa/AGENT.md');
  assert.equal(r.status, 0, r.err);
  assert.equal(stateOf(r.out, 'agents/qa/AGENT.md'), 'remove');
  assert.equal(existsSync(sb.compozy('agents', 'qa')), false);
  assert.equal(stateOf(r.out, 'agents/dev/AGENT.md'), 'kept', 'a retired file not named stays');
  const bare = sb.run(sb.root, '--accept', 'agents/dev/AGENT.md');
  assert.equal(bare.status, 0, bare.err);
  assert.equal(stateOf(bare.out, 'agents/dev/AGENT.md'), 'remove', 'the path is accepted with or without the .compozy/ prefix');
  assert.equal(sb.run(sb.root, '--accept', 'agents/nothing/AGENT.md').status, 2, 'a path that is neither a kit file nor a retired one is a usage error');
});

test('compozy-kit retired: a retired file that is absent prints nothing and creates nothing', (t) => {
  const sb = sandbox(t);
  assert.equal(sb.run(sb.root).status, 0);
  const r = sb.run(sb.root);
  assert.equal(r.status, 0, r.err);
  for (const file of RETIRED) {
    assert.ok(!r.out.includes(file), `${file} is not in the output`);
    assert.equal(existsSync(sb.compozy(file)), false);
  }
  const json = JSON.parse(sb.run(sb.root, '--json').out);
  assert.ok(json.files.every((f) => !RETIRED.some((file) => f.path === `.compozy/${file}`)));
  assert.deepEqual(json.dropped, []);
});

test('compozy-kit inputs: a recorded input with no placeholder is dropped and named, and --set of it is a usage error', (t) => {
  const sb = sandbox(t);
  assert.equal(sb.run(sb.root).status, 0);
  const manifest = manifestOf(sb);
  manifest.inputs.__PLANNER__ = 'tech-lead';
  writeFileSync(sb.compozy('kit-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  const r = sb.run(sb.root);
  assert.equal(r.status, 0, r.err);
  assert.match(r.out, /^dropped\s+__PLANNER__$/m);
  assert.equal('__PLANNER__' in manifestOf(sb).inputs, false);
  const again = sb.run(sb.root);
  assert.doesNotMatch(again.out, /dropped/, 'a dropped input is named once');
  const set = sb.run(sb.root, '--set', '__PLANNER__=x');
  assert.equal(set.status, 2);
  assert.match(set.err, /__PLANNER__ is not a placeholder/);
  assert.equal('__PLANNER__' in manifestOf(sb).inputs, false, 'a refused --set records nothing');
});

// The old kit (the eight files of version 0.3.1) as the test holds it: the five files the new kit retires, as constants, with the
// manifest that recorded their digests and the ten inputs. The installer judges a retired file only by that digest, so no history is read.
const OLD_KIT = {
  'agents/tech-lead/AGENT.md': '---\nname: tech-lead\n---\nThe old planner shell.\n',
  'agents/dev/AGENT.md': '---\nname: dev\n---\nThe old implementer shell.\n',
  'agents/qa/AGENT.md': '---\nname: qa\n---\nThe old reviewer shell.\n',
  'agents/design/AGENT.md': '---\nname: design\n---\nThe old designer shell.\n',
  'loops/openspec-change/loop.yaml': 'apiVersion: compozy.loop/v1\nkind: Loop\nmeta:\n  name: openspec-change\n',
};
const OLD_MANIFEST_INPUTS = {
  __PLANNER__: 'tech-lead', __IMPLEMENTER__: 'dev', __REVIEWER__: 'qa', __DESIGNER__: 'design', __VERIFY_COMMAND__: 'npm test',
  __DEMO_COMMAND__: '', __DEMO_URL__: '', __TIMEZONE__: 'America/Sao_Paulo', __SCREEN_MAP__: '', __MOCKUP__: '',
};

test('compozy-kit AC-8: the installer over a scratch copy of the old kit writes the new files, removes the four unedited ones and names the edited one', (t) => {
  const sb = sandbox(t);
  mkdirSync(sb.compozy(), { recursive: true });
  for (const [file, content] of Object.entries(OLD_KIT)) {
    mkdirSync(dirname(sb.compozy(file)), { recursive: true });
    writeFileSync(sb.compozy(file), content);
  }
  const manifest = { version: 1, pack: '0.3.1', inputs: OLD_MANIFEST_INPUTS, files: Object.fromEntries(Object.entries(OLD_KIT).map(([f, c]) => [f, sha256(c)])) };
  writeFileSync(sb.compozy('kit-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  // One file the project edited by hand.
  const edited = `${OLD_KIT['agents/qa/AGENT.md']}The project's own rule.\n`;
  writeFileSync(sb.compozy('agents', 'qa', 'AGENT.md'), edited);

  const r = sb.run(sb.root);
  assert.equal(r.status, 0, r.err);
  for (const file of KIT_FILES) assert.equal(stateOf(r.out, file), 'create', `${file} is new`);
  for (const file of RETIRED.filter((f) => f !== 'agents/qa/AGENT.md')) {
    assert.equal(stateOf(r.out, file), 'remove', file);
    assert.equal(existsSync(dirname(sb.compozy(file))), false, `${file}'s folder is gone`);
  }
  assert.equal(stateOf(r.out, 'agents/qa/AGENT.md'), 'kept');
  assert.ok(r.out.includes(`.compozy/agents/qa/AGENT.md: ${KEPT_SENTENCE('agents/qa/AGENT.md')}`), r.out);
  assert.equal(readFileSync(sb.compozy('agents', 'qa', 'AGENT.md'), 'utf8'), edited, 'the edited file is as the project wrote it');
  for (const token of OLD_INPUTS) assert.match(r.out, new RegExp(`^dropped\\s+${token}$`, 'm'), `${token} is named as dropped`);
  assert.equal((r.out.match(/^dropped\s/gm) ?? []).length, 7, 'only the seven old inputs are dropped');

  const after = manifestOf(sb);
  assert.deepEqual(Object.keys(after.inputs).sort(), ['__MOCKUP__', '__SCREEN_MAP__', '__TIMEZONE__']);
  assert.equal(after.inputs.__TIMEZONE__, 'America/Sao_Paulo', 'an input the new kit keeps is kept');
  for (const file of RETIRED.filter((f) => f !== 'agents/qa/AGENT.md')) assert.equal(file in after.files, false, `${file} has no digest left`);
  for (const file of KIT_FILES) assert.equal(after.files[file], sha256(readFileSync(sb.compozy(file))), `digest of ${file}`);
  assert.deepEqual(JSON.parse(sb.run(sb.root, '--json').out).dropped, [], 'the second run drops nothing');
});

test('compozy-kit templates: the default agent, the three inputs, the three loops and the README match D-10', () => {
  const read = (...p) => readFileSync(join(SETUP_DIR, 'templates', ...p), 'utf8');
  assert.match(read('config.toml'), /^agent = "change-coordinator"$/m);
  assert.doesNotMatch(read('config.toml').replace('__TIMEZONE__', ''), /__[A-Z_]+__/, 'the config holds no token but the timezone');
  const tokens = Object.keys(JSON.parse(read('substitutions.json')).placeholders);
  assert.deepEqual(tokens.sort(), ['__MOCKUP__', '__SCREEN_MAP__', '__TIMEZONE__']);
  assert.deepEqual(readdirSync(join(SETUP_DIR, 'templates', 'loops')).sort(), LOOPS, 'the three loops, and no openspec-change');
  assert.equal(AGENTS.length, 21);
  for (const old of RETIRED_AGENTS) assert.ok(!AGENTS.includes(old), `${old} is not an agent of the kit`);
  const readme = read('README.md');
  for (const word of [...LOOPS, 'change-coordinator', '/devkit']) assert.ok(readme.includes(word), `the README names ${word}`);
  for (const old of ['tech-lead', 'openspec-change', 'verify_command']) assert.ok(!readme.includes(old), `the README no longer names ${old}`);
});
