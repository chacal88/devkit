// Tests for kit-installer.mjs, the finder of devkit-compozy's kit installer for `/devkit setup` (project-setup D-4). Run by
// `node scripts/test-suite.mjs`, in a process of its own; alone:
// `node scripts/test-suite.mjs plugins/openspec/skills/devkit/scripts/kit-installer.test.mjs`.
// Every test spawns the script (a copy of it in a sandbox, or the real one beside this repository's compozy pack), so each one fails
// on its own while the script is missing. HOME and CLAUDE_CONFIG_DIR are temporary folders in every spawn.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync, copyFileSync, realpathSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpFolder } from '../../../hooks/test-tmp.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(here, 'kit-installer.mjs');
const REPO_COMPOZY = join(here, '..', '..', '..', '..', 'compozy');
const BLANKS = { DEVKIT_BYPASS: '', DEVKIT_BRANCH: '', DEVKIT_CHANGE: '', GITHUB_HEAD_REF: '', GITHUB_BASE_REF: '', GITHUB_EVENT_PATH: '' };
const ENV = { ...process.env, ...BLANKS };
const INSTALLER = join('kit', 'scripts', 'install-kit.mjs');

function write(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

// A copy of the script at the depth it has in the repository, with no compozy pack beside it, an empty plugins folder under
// CLAUDE_CONFIG_DIR and an empty HOME.
function sandbox() {
  const base = realpathSync(tmpFolder('devkit-kit-installer-'));
  const scripts = join(base, 'repo', 'plugins', 'openspec', 'skills', 'devkit', 'scripts');
  mkdirSync(scripts, { recursive: true });
  if (existsSync(SCRIPT)) copyFileSync(SCRIPT, join(scripts, 'kit-installer.mjs'));
  const config = join(base, 'config');
  const home = join(base, 'home');
  mkdirSync(join(config, 'plugins'), { recursive: true });
  mkdirSync(home);
  return { base, script: join(scripts, 'kit-installer.mjs'), sibling: join(base, 'repo', 'plugins', 'compozy'), plugins: join(config, 'plugins'), config, home };
}

// A pack folder: its plugin.json and, unless `installer` is null, an installer stub at that path under the pack.
function pack(dir, { name = 'devkit-compozy', version, installer = INSTALLER, body = '' }) {
  write(join(dir, '.claude-plugin', 'plugin.json'), `${JSON.stringify({ name, version }, null, 2)}\n`);
  if (installer) write(join(dir, installer), body);
  return dir;
}

function run(script, args, env = {}) {
  const r = spawnSync('node', [script, ...args], { encoding: 'utf8', env: { ...ENV, ...env } });
  return { code: r.status, out: r.stdout, err: r.stderr };
}
const envOf = (s) => ({ HOME: s.home, CLAUDE_CONFIG_DIR: s.config });
function where(s, env = envOf(s)) {
  const r = run(s.script, ['--where'], env);
  assert.equal(r.code, 0, r.err);
  return JSON.parse(r.out);
}

// Invariant: in a checkout, and in a --plugin-dir run from one, the compozy pack beside devkit-openspec is the one used.
// Layer: kit-installer search. Suite: kit-installer.
test('setup AC-6 kit: the sibling compozy pack is found', () => {
  const s = sandbox();
  pack(s.sibling, { version: '0.5.0' });
  pack(join(s.plugins, 'cache', 'devkit', 'devkit-compozy', '9.9.9'), { version: '9.9.9' });
  assert.deepEqual(where(s), { installer: join(s.sibling, INSTALLER), version: '0.5.0' }, 'the sibling wins over a higher installed version');

  const other = sandbox();
  pack(other.sibling, { name: 'devkit-design', version: '0.5.0' });
  const installed = pack(join(other.plugins, 'cache', 'devkit', 'devkit-compozy', '0.6.0'), { version: '0.6.0' });
  assert.deepEqual(where(other), { installer: join(installed, INSTALLER), version: '0.6.0' }, 'a sibling of another pack is not taken');

  const empty = sandbox();
  const repo = where({ script: SCRIPT }, envOf(empty));
  assert.equal(repo.installer, join(realpathSync(REPO_COMPOZY), INSTALLER), 'this repository: plugins/compozy');
  assert.equal(repo.version, JSON.parse(readFileSync(join(REPO_COMPOZY, '.claude-plugin', 'plugin.json'), 'utf8')).version);
});

// Invariant: among installed packs the highest version wins, compared field by field as integers, and a tie goes to the
// lexicographically last path (the rule of the kit's resolver). Layer: kit-installer search. Suite: kit-installer.
test('setup AC-6 kit: the highest installed version wins and a tie goes to the last path', () => {
  const s = sandbox();
  pack(join(s.plugins, 'cache', 'a', 'devkit-compozy', '0.9.0'), { version: '0.9.0' });
  pack(join(s.plugins, 'cache', 'a', 'devkit-compozy', '0.10.0'), { version: '0.10.0' });
  const last = pack(join(s.plugins, 'cache', 'b', 'devkit-compozy', '0.10.0'), { version: '0.10.0' });
  pack(join(s.plugins, 'cache', 'c', 'devkit-core', '9.0.0'), { name: 'devkit-core', version: '9.0.0' });
  assert.deepEqual(where(s), { installer: join(last, INSTALLER), version: '0.10.0' });

  const home = sandbox();
  const inHome = pack(join(home.home, '.claude', 'plugins', 'cache', 'devkit', 'devkit-compozy', '0.5.0'), { version: '0.5.0' });
  assert.deepEqual(where(home, { HOME: home.home, CLAUDE_CONFIG_DIR: '' }), { installer: join(inHome, INSTALLER), version: '0.5.0' },
    'no CLAUDE_CONFIG_DIR: HOME/.claude/plugins');
});

// Invariant: when no devkit-compozy is found the step stops with one line that names the pack and every place it looked, and runs
// nothing. Layer: kit-installer search. Suite: kit-installer.
test('setup AC-6 kit: no devkit-compozy exits 3 naming the pack and every location tried', () => {
  const s = sandbox();
  const root = join(s.base, 'project');
  mkdirSync(root);
  for (const args of [['--where'], [root, '--json']]) {
    const r = run(s.script, args, envOf(s));
    assert.equal(r.code, 3, r.out + r.err);
    assert.equal(r.out, '');
    assert.equal(r.err.trim().split('\n').length, 1, r.err);
    assert.match(r.err, /devkit-compozy/);
    assert.ok(r.err.includes(s.sibling), `the sibling is named: ${r.err}`);
    assert.ok(r.err.includes(s.plugins), `the plugins folder is named: ${r.err}`);
  }
  assert.deepEqual(readdirSync(root), [], 'nothing written in the project');
});

// Invariant: a devkit-compozy that still keeps its installer under the old skill folder is never run; the reply says to update it.
// Layer: kit-installer search. Suite: kit-installer. The old folder's name is built from pieces, so no line here names it (D-9).
test('setup AC-6 kit: a devkit-compozy with the installer under skills/' + 'compozy' + '-setup is not taken', () => {
  const s = sandbox();
  const old = join('skills', 'compozy' + '-setup', 'scripts', 'install-kit.mjs');
  pack(s.sibling, { version: '0.4.0', installer: old });
  pack(join(s.plugins, 'cache', 'devkit', 'devkit-compozy', '0.4.0'), { version: '0.4.0', installer: old });
  const r = run(s.script, ['--where'], envOf(s));
  assert.equal(r.code, 3, r.out + r.err);
  assert.match(r.err, /update devkit-compozy/);
});

// Invariant: the installer found is run with the arguments given, its output passed through and its exit code returned, and it
// writes only under .compozy. Layer: kit-installer run. Suite: kit-installer.
test('setup AC-6 kit: the installer runs with the arguments passed and its exit code returned, and writes only under .compozy', () => {
  const s = sandbox();
  pack(s.sibling, { version: '0.5.0', body: 'process.stdout.write(JSON.stringify(process.argv.slice(2)) + "\\n");\nprocess.exit(5);\n' });
  const stub = run(s.script, ['/some/root', '--set', '__TIMEZONE__=UTC', '--accept', 'config.toml'], envOf(s));
  assert.equal(stub.code, 5, stub.err);
  assert.deepEqual(JSON.parse(stub.out), ['/some/root', '--set', '__TIMEZONE__=UTC', '--accept', 'config.toml']);

  const empty = sandbox();
  const root = join(empty.base, 'project');
  mkdirSync(root);
  const r = run(SCRIPT, [root, '--set', '__TIMEZONE__=UTC', '--json'], envOf(empty));
  assert.equal(r.code, 0, r.err);
  assert.ok(Array.isArray(JSON.parse(r.out).files), 'the installer\'s own JSON report is passed through');
  assert.deepEqual(readdirSync(root), ['.compozy']);
  assert.equal(existsSync(join(root, '.compozy', 'kit-manifest.json')), true);
  const usage = run(SCRIPT, [root, '--no-such-option'], envOf(empty));
  assert.equal(usage.code, 2, 'the installer\'s usage error comes back as its exit code');
  assert.match(usage.err, /install-kit: unknown option --no-such-option/);
});
