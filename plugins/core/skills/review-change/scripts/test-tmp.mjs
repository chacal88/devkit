// test-fixture-cleanup: the one way a test makes a temporary folder.
// `tmpFolder(prefix)` makes it and records it with the test under way; the folder is removed when that test
// ends, passed or failed. What is still recorded when the run ends (module-level folders, a test that never
// ended, a removal that failed) is swept on exit, on SIGINT and on SIGTERM. `tmpRoot()` reads the temporary
// root at call time. The same bytes live in three packs; test-tmp.test.mjs refuses a copy that differs.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, afterEach } from 'node:test';

const PREFIX = /^devkit-[a-z0-9]+(?:-[a-z0-9]+)*-$/;
const NO_TEST = Symbol('no test under way');

const underWay = []; // the tests under way, innermost last
const recorded = new Map(); // test (or NO_TEST) -> Set of folders made while it was under way

export function tmpFolder(prefix) {
  if (typeof prefix !== 'string' || !PREFIX.test(prefix)) {
    throw new Error(`test-tmp: a prefix starts with devkit- and ends with -: ${prefix}`);
  }
  const path = mkdtempSync(join(tmpdir(), prefix));
  const owner = underWay.length ? underWay[underWay.length - 1] : NO_TEST;
  if (!recorded.has(owner)) recorded.set(owner, new Set());
  recorded.get(owner).add(path);
  return path;
}

export function tmpRoot() {
  return tmpdir();
}

function remove(path) {
  rmSync(path, { recursive: true, force: true, maxRetries: 3 });
}

beforeEach((t) => {
  underWay.push(t);
});

afterEach((t) => {
  const at = underWay.lastIndexOf(t);
  if (at !== -1) underWay.splice(at, 1);
  const folders = recorded.get(t);
  if (!folders) return;
  let failure = null;
  for (const path of [...folders]) {
    try {
      remove(path);
      folders.delete(path);
    } catch (error) {
      failure ??= new Error(`test-tmp: could not remove ${path}: ${error.message}`);
    }
  }
  if (folders.size === 0) recorded.delete(t);
  if (failure) throw failure;
});

function sweep() {
  for (const [owner, folders] of recorded) {
    for (const path of [...folders]) {
      try {
        remove(path);
        folders.delete(path);
      } catch (error) {
        process.stderr.write(`test-tmp: left ${path}: ${error.message}\n`);
      }
    }
    if (folders.size === 0) recorded.delete(owner);
  }
}

process.on('exit', sweep);
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.once(sig, () => {
    sweep();
    if (process.listenerCount(sig) === 0) process.kill(process.pid, sig);
  });
}
