// Tests for gh-version.mjs (gh-version-check, H-6). Imported by hooks/guard.test.mjs so that
// `node --test plugins/openspec/hooks/guard.test.mjs` runs this file too.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { fakeGh } from '../../../hooks/test-fixtures.mjs';
import { tmpFolder } from '../../../hooks/test-tmp.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, 'gh-version.mjs');
const skill = join(here, '..', 'SKILL.md');
const BLANKS = { DEVKIT_BYPASS: '', DEVKIT_BRANCH: '', DEVKIT_CHANGE: '', GITHUB_HEAD_REF: '', GITHUB_BASE_REF: '', GITHUB_EVENT_PATH: '' };

const run = (env, ...args) => {
  const r = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', env: { ...env, ...BLANKS } });
  return { code: r.status, out: r.stdout, err: r.stderr };
};
const withVersion = (answer) => {
  const gh = fakeGh();
  gh.set('version', answer);
  return run(gh.env);
};

test('gh-version 17: ghVersionLine gives the four lines of H-6 exactly', async () => {
  const { ghVersionLine } = await import('./gh-version.mjs');
  assert.equal(ghVersionLine({ installed: '2.50.0', missing: false, why: null }), 'gh: ok 2.50.0');
  assert.equal(ghVersionLine({ installed: '2.105.0', missing: false, why: null }), 'gh: ok 2.105.0');
  assert.equal(
    ghVersionLine({ installed: '2.46.0', missing: false, why: null }),
    'gh: warning: the installed gh is 2.46.0, older than 2.50.0; the pr and merge ship modes read pull request checks with gh pr checks --json, which needs 2.50.0 or newer: update gh',
  );
  assert.equal(
    ghVersionLine({ installed: null, missing: true, why: 'gh is not installed or not on PATH' }),
    'gh: warning: gh is not installed; the pr and merge ship modes need gh 2.50.0 or newer',
  );
  assert.equal(
    ghVersionLine({ installed: null, missing: false, why: 'gh exited 1' }),
    'gh: warning: the gh version cannot be read (gh exited 1); the pr and merge ship modes need gh 2.50.0 or newer',
  );
});

test('gh-version 18: the script prints one line, exits 0, and exits 2 on an argument (AC-7)', () => {
  const old = withVersion({ stdout: 'gh version 2.46.0 (2024-03-18)\n' });
  assert.equal(old.code, 0);
  assert.match(old.out, /^gh: warning: the installed gh is 2\.46\.0, older than 2\.50\.0;/);
  assert.equal(old.out.trim().split('\n').length, 1);

  const min = withVersion({ stdout: 'gh version 2.50.0 (2024-05-01)\n' });
  assert.equal(min.code, 0);
  assert.equal(min.out, 'gh: ok 2.50.0\n');

  const newer = withVersion({ stdout: 'gh version 2.105.0 (2026-11-17)\n' });
  assert.equal(newer.code, 0);
  assert.equal(newer.out, 'gh: ok 2.105.0\n');

  const failing = withVersion({ exit: 1, stderr: 'boom\n' });
  assert.equal(failing.code, 0);
  assert.equal(failing.out, 'gh: warning: the gh version cannot be read (boom); the pr and merge ship modes need gh 2.50.0 or newer\n');

  const empty = tmpFolder('devkit-gh-version-empty-');
  const missing = run({ ...process.env, PATH: empty });
  assert.equal(missing.code, 0);
  assert.equal(missing.out, 'gh: warning: gh is not installed; the pr and merge ship modes need gh 2.50.0 or newer\n');

  const usage = run(process.env, 'extra');
  assert.equal(usage.code, 2);
  assert.match(usage.err, /usage: gh-version\.mjs/);
  assert.equal(usage.out, '');
});

test('gh-version 19: step 1 of SKILL.md names the script and 2.50.0 and says the setup goes on (AC-7)', () => {
  const text = readFileSync(skill, 'utf8');
  const step = text.slice(text.indexOf('1. **Check the CLI.**'), text.indexOf('2. **Opt the project in.**'));
  assert.ok(step.length > 0, 'step 1 found');
  assert.match(step, /scripts\/gh-version\.mjs/);
  assert.match(step, /2\.50\.0/);
  assert.match(step, /never stops the setup/);
});
