// node --test plugins/compozy/skills/compozy-setup/scripts/devkit-kit.test.mjs
//
// Pins design D9: devkit-kit resolves the devkit checkers in this order — $DEVKIT_HOOKS, a
// repository checkout, then the installed devkit-openspec with the highest plugin.json
// "version" — and resolves screens-check the same way, but inside devkit-compozy and without
// $DEVKIT_HOOKS (AC-8 portable-hooks).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const KIT = join(here, '..', 'templates', 'bin', 'devkit-kit');

function tmp(prefix) {
  return mkdtempSync(join(tmpdir(), prefix));
}

// A fresh copy of devkit-kit, executable, at its own temp location (so no test shares state
// through the real template file).
function kitCopy() {
  const dir = tmp('devkit-kit-bin-');
  const path = join(dir, 'devkit-kit');
  cpSync(KIT, path);
  chmodSync(path, 0o755);
  return path;
}

function write(path, body) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body);
}

// A Node stub standing in for deliver-check.mjs / conduct-check.mjs / screens-check.mjs: prints
// a marker and the forwarded arguments, then exits with the given code.
function stub(path, marker, exitCode = 0) {
  write(
    path,
    `console.log('MARKER:${marker}');\nconsole.log('ARGS:' + process.argv.slice(2).join(','));\nprocess.exit(${exitCode});\n`,
  );
}

// An installed devkit-openspec copy under <configDir>/plugins/cache/<marketplace>/<dirName>/<version>/,
// the shape $CLAUDE_CONFIG_DIR/plugins resolves to on a real machine.
function installOpenspec(configDir, { dirName, version, marker, exitCode = 0 }) {
  const root = join(configDir, 'plugins', 'cache', 'devkit', dirName, version);
  write(
    join(root, '.claude-plugin', 'plugin.json'),
    JSON.stringify({ name: 'devkit-openspec', version }, null, 2),
  );
  stub(join(root, 'hooks', 'deliver-check.mjs'), marker, exitCode);
  stub(join(root, 'hooks', 'conduct-check.mjs'), marker, exitCode);
  return root;
}

// An installed devkit-compozy copy, same shape, with screens-check under its own skill path.
function installCompozy(configDir, { dirName, version, marker, exitCode = 0 }) {
  const root = join(configDir, 'plugins', 'cache', 'devkit', dirName, version);
  write(
    join(root, '.claude-plugin', 'plugin.json'),
    JSON.stringify({ name: 'devkit-compozy', version }, null, 2),
  );
  stub(join(root, 'skills', 'screen-design', 'scripts', 'screens-check.mjs'), marker, exitCode);
  return root;
}

// A repository checkout: plugins/openspec/hooks/ (or plugins/compozy/.../scripts/) under a
// fresh root, returning that root's deepest leaf so the resolver has to walk up to find it.
function checkoutOpenspec(marker, exitCode = 0) {
  const root = tmp('devkit-kit-checkout-');
  stub(join(root, 'plugins', 'openspec', 'hooks', 'deliver-check.mjs'), marker, exitCode);
  stub(join(root, 'plugins', 'openspec', 'hooks', 'conduct-check.mjs'), marker, exitCode);
  const leaf = join(root, 'a', 'b', 'c');
  mkdirSync(leaf, { recursive: true });
  return leaf;
}

function checkoutCompozy(marker, exitCode = 0) {
  const root = tmp('devkit-kit-checkout-');
  stub(join(root, 'plugins', 'compozy', 'skills', 'screen-design', 'scripts', 'screens-check.mjs'), marker, exitCode);
  const leaf = join(root, 'a', 'b', 'c');
  mkdirSync(leaf, { recursive: true });
  return leaf;
}

// Runs a fresh devkit-kit copy. `cwd` is the caller's directory the resolver walks up from;
// `claudeConfigDir` is always set (to an isolated temp dir by default) so a run never leaks the
// host's own ~/.claude/plugins.
function run(args, { cwd, devkitHooks, claudeConfigDir } = {}) {
  const kit = kitCopy();
  const env = { ...process.env, PATH: process.env.PATH };
  delete env.DEVKIT_HOOKS;
  if (devkitHooks !== undefined) env.DEVKIT_HOOKS = devkitHooks;
  env.CLAUDE_CONFIG_DIR = claudeConfigDir ?? tmp('devkit-kit-empty-config-');
  return spawnSync(kit, args, { cwd: cwd ?? tmp('devkit-kit-cwd-'), env, encoding: 'utf8' });
}

test('AC-8 portable-hooks: $DEVKIT_HOOKS wins over a repository checkout and an installed devkit-openspec', () => {
  const cwd = checkoutOpenspec('checkout', 9);
  const hooksDir = tmp('devkit-kit-hooks-');
  stub(join(hooksDir, 'deliver-check.mjs'), 'devkit-hooks', 7);
  const configDir = tmp('devkit-kit-config-');
  installOpenspec(configDir, { dirName: 'devkit-openspec', version: '9.9.9', marker: 'installed', exitCode: 5 });

  const r = run(['deliver-check', '--change', 'x'], { cwd, devkitHooks: hooksDir, claudeConfigDir: configDir });
  assert.match(r.stdout, /MARKER:devkit-hooks/);
  assert.match(r.stdout, /ARGS:--change,x/);
  assert.equal(r.status, 7);
});

test('AC-8 portable-hooks: a repository checkout wins over an installed devkit-openspec when $DEVKIT_HOOKS is unset', () => {
  const cwd = checkoutOpenspec('checkout', 3);
  const configDir = tmp('devkit-kit-config-');
  installOpenspec(configDir, { dirName: 'devkit-openspec', version: '9.9.9', marker: 'installed', exitCode: 5 });

  const r = run(['conduct-check', 'arg1'], { cwd, claudeConfigDir: configDir });
  assert.match(r.stdout, /MARKER:checkout/);
  assert.match(r.stdout, /ARGS:arg1/);
  assert.equal(r.status, 3);
});

test('AC-8 portable-hooks: an installed devkit-openspec wins when neither $DEVKIT_HOOKS nor a repository checkout exist', () => {
  const configDir = tmp('devkit-kit-config-');
  installOpenspec(configDir, { dirName: 'devkit-openspec', version: '1.0.0', marker: 'installed', exitCode: 4 });

  const r = run(['deliver-check', '--json'], { claudeConfigDir: configDir });
  assert.match(r.stdout, /MARKER:installed/);
  assert.match(r.stdout, /ARGS:--json/);
  assert.equal(r.status, 4);
});

test('AC-8 portable-hooks: screens-check resolves inside devkit-compozy, not devkit-openspec, and ignores $DEVKIT_HOOKS', () => {
  const cwd = checkoutCompozy('checkout-screens', 2);
  const hooksDir = tmp('devkit-kit-hooks-'); // would win for deliver-check, must not apply here
  stub(join(hooksDir, 'screens-check.mjs'), 'devkit-hooks-screens', 1);
  const configDir = tmp('devkit-kit-config-');
  installOpenspec(configDir, { dirName: 'devkit-openspec', version: '9.9.9', marker: 'openspec-should-not-win', exitCode: 6 });

  const r = run(['screens-check', '--change', 'y'], { cwd, devkitHooks: hooksDir, claudeConfigDir: configDir });
  assert.match(r.stdout, /MARKER:checkout-screens/);
  assert.match(r.stdout, /ARGS:--change,y/);
  assert.equal(r.status, 2);
});

test('AC-8 portable-hooks: an installed devkit-compozy resolves screens-check when there is no repository checkout', () => {
  const configDir = tmp('devkit-kit-config-');
  installCompozy(configDir, { dirName: 'devkit-compozy', version: '1.0.0', marker: 'installed-screens', exitCode: 1 });

  const r = run(['screens-check'], { claudeConfigDir: configDir });
  assert.match(r.stdout, /MARKER:installed-screens/);
  assert.equal(r.status, 1);
});

test('AC-8 portable-hooks: exit 3 naming the paths it tried when nothing resolves deliver-check', () => {
  const configDir = tmp('devkit-kit-config-'); // empty: no installed devkit-openspec
  const r = run(['deliver-check'], { claudeConfigDir: configDir });
  assert.equal(r.status, 3);
  assert.match(r.stderr, /DEVKIT_HOOKS/);
  assert.match(r.stderr, /repository checkout/);
  assert.match(r.stderr, /installed devkit-openspec/);
});

test('AC-8 portable-hooks: exit 3 naming the paths it tried when nothing resolves screens-check, with no mention of $DEVKIT_HOOKS', () => {
  const configDir = tmp('devkit-kit-config-'); // empty: no installed devkit-compozy
  const r = run(['screens-check'], { claudeConfigDir: configDir });
  assert.equal(r.status, 3);
  assert.doesNotMatch(r.stderr, /DEVKIT_HOOKS/);
  assert.match(r.stderr, /repository checkout/);
  assert.match(r.stderr, /installed devkit-compozy/);
});

test('AC-8 portable-hooks: exit 3 on an unknown subcommand', () => {
  const r = run(['frobnicate-check']);
  assert.equal(r.status, 3);
  assert.match(r.stderr, /unknown subcommand/);
});

test('AC-8 portable-hooks: exit 3 with no subcommand at all', () => {
  const r = run([]);
  assert.equal(r.status, 3);
});

// ---------------------------------------------------------------- tie-break (D9)

test('AC-8 portable-hooks: the higher version wins even when it is the older directory and the alphabetically earlier name', () => {
  const configDir = tmp('devkit-kit-config-');
  const older = installOpenspec(configDir, { dirName: 'aaa-older-higher', version: '2.0.0', marker: 'higher-version', exitCode: 1 });
  // Force a later mtime on the alphabetically-later, lower-version copy, so neither mtime nor
  // directory order can make it win by accident.
  installOpenspec(configDir, { dirName: 'zzz-newer-lower', version: '1.0.0', marker: 'lower-version', exitCode: 2 });

  const r = run(['deliver-check'], { claudeConfigDir: configDir });
  assert.match(r.stdout, /MARKER:higher-version/);
  assert.equal(r.status, 1);
  assert.ok(older); // sanity: the fixture was actually built
});

test('AC-8 portable-hooks: 0.13.0 beats 0.9.0 (compared as integers, not as strings)', () => {
  const configDir = tmp('devkit-kit-config-');
  installOpenspec(configDir, { dirName: 'copy-a', version: '0.9.0', marker: 'v0-9-0', exitCode: 2 });
  installOpenspec(configDir, { dirName: 'copy-b', version: '0.13.0', marker: 'v0-13-0', exitCode: 1 });

  const r = run(['deliver-check'], { claudeConfigDir: configDir });
  assert.match(r.stdout, /MARKER:v0-13-0/);
  assert.equal(r.status, 1);
});

test('AC-8 portable-hooks: at the same version, the lexicographically last path wins', () => {
  const configDir = tmp('devkit-kit-config-');
  installOpenspec(configDir, { dirName: 'aaa-copy', version: '1.0.0', marker: 'aaa', exitCode: 2 });
  installOpenspec(configDir, { dirName: 'zzz-copy', version: '1.0.0', marker: 'zzz', exitCode: 1 });

  const r = run(['deliver-check'], { claudeConfigDir: configDir });
  assert.match(r.stdout, /MARKER:zzz/);
  assert.equal(r.status, 1);
});
