#!/usr/bin/env node
// Checks the installed `gh` against the version the `pr` and `merge` ship modes need (gh-version-check, H-6).
//   node gh-version.mjs
// Prints one line on standard output: `gh: ok <version>` or a `gh: warning: ...` line. A warning never stops the
// setup (the `plan` ship mode needs no gh), so the exit is 0 in every case but a usage error (2).

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeGh, ghVersion, versionOlder, GH_MIN_VERSION } from '../../../hooks/merge-setup.mjs';

const USAGE = 'usage: gh-version.mjs';
const NEEDS = `the pr and merge ship modes need gh ${GH_MIN_VERSION} or newer`;

// The one line for a ghVersion() answer.
export function ghVersionLine(v) {
  if (v.installed) {
    if (!versionOlder(v.installed, GH_MIN_VERSION)) return `gh: ok ${v.installed}`;
    return `gh: warning: the installed gh is ${v.installed}, older than ${GH_MIN_VERSION}; the pr and merge ship modes read pull request checks with gh pr checks --json, which needs ${GH_MIN_VERSION} or newer: update gh`;
  }
  if (v.missing) return `gh: warning: gh is not installed; ${NEEDS}`;
  return `gh: warning: the gh version cannot be read (${v.why}); ${NEEDS}`;
}

export function main(argv, { out = process.stdout, err = process.stderr } = {}) {
  if (argv.length > 0) { err.write(`${USAGE}\n`); return 2; }
  out.write(`${ghVersionLine(ghVersion(makeGh(process.cwd())))}\n`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
