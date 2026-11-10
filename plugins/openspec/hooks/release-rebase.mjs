#!/usr/bin/env node
// release-rebase: rebase the current branch on origin/<base> and resolve the release-file conflicts
// (conduct-rounds design D11). Never pushes, never commits after the rebase; the renumbering stays
// in the working tree for the caller to test and commit. No dependencies.
//
//   node release-rebase.mjs --base <base> [--json]
//
// Exit 0 resolved, 2 not resolvable (the branch is back at its old head), 3 setup or usage error.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { RELEASE_FILE } from './deliver-check.mjs';

export class ReleaseError extends Error {
  constructor(message) { super(message); this.name = 'ReleaseError'; }
}

// ---------------------------------------------------------------- versions

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;
function parseSemver(v) {
  const m = SEMVER.exec(String(v));
  if (!m) throw new ReleaseError(`not a semver version: ${JSON.stringify(v)}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

export function bumpKind(from, to) {
  const a = parseSemver(from);
  const b = parseSemver(to);
  const i = a.findIndex((n, k) => n !== b[k]);
  return i < 0 ? 'none' : ['major', 'minor', 'patch'][i];
}

export function applyBump(version, kind) {
  const [major, minor, patch] = parseSemver(version);
  if (kind === 'major') return `${major + 1}.0.0`;
  if (kind === 'minor') return `${major}.${minor + 1}.0`;
  if (kind === 'patch') return `${major}.${minor}.${patch + 1}`;
  return version;
}

// `mergeBase`: the version where the branch forked; `change`: the branch's own; `base`: origin/<base>'s.
export function resolveVersion({ mergeBase, change, base }) {
  return applyBump(base, bumpKind(mergeBase, change));
}

// ---------------------------------------------------------------- manifests

// versions: { packs: { <plugin name>: version }, metadata?: version }
export function resolveManifest(baseText, versions) {
  const obj = JSON.parse(baseText);
  const packs = versions.packs ?? {};
  if (typeof obj.name === 'string' && typeof obj.version === 'string' && obj.name in packs) obj.version = packs[obj.name];
  if (obj.metadata && versions.metadata !== undefined) obj.metadata.version = versions.metadata;
  if (Array.isArray(obj.plugins)) for (const p of obj.plugins) if (p && p.name in packs) p.version = packs[p.name];
  return JSON.stringify(obj, null, 2) + (baseText.endsWith('\n') ? '\n' : '');
}

function withoutVersions(obj) {
  const c = JSON.parse(JSON.stringify(obj));
  delete c.version;
  if (c.metadata) delete c.metadata.version;
  if (Array.isArray(c.plugins)) for (const p of c.plugins) delete p.version;
  return c;
}

function diffPaths(a, b, path, out) {
  const named = (x) => Array.isArray(x) && x.every((e) => e && typeof e === 'object' && typeof e.name === 'string');
  if (named(a) && named(b)) {
    const names = new Set([...a, ...b].map((e) => e.name));
    for (const n of names) diffPaths(a.find((e) => e.name === n), b.find((e) => e.name === n), `${path}[${n}]`, out);
  } else if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) diffPaths(a[k], b[k], path ? `${path}.${k}` : k, out);
  } else if (JSON.stringify(a) !== JSON.stringify(b)) {
    out.push(path || '(root)');
  }
}

// The JSON paths the change edited other than the version fields.
export function manifestEditsBeyondVersion(mergeBaseText, changeText) {
  const out = [];
  diffPaths(withoutVersions(JSON.parse(mergeBaseText ?? '{}')), withoutVersions(JSON.parse(changeText)), '', out);
  return out;
}

// ---------------------------------------------------------------- CHANGELOG

const ENTRY_HEADING = /^## (\d+\.\d+\.\d+) — (.*)$/;

function parseChangelog(text) {
  const lines = text.split('\n');
  const starts = lines.flatMap((l, i) => (ENTRY_HEADING.test(l) ? [i] : []));
  const entries = starts.map((s, k) => {
    const raw = lines.slice(s, starts[k + 1] ?? lines.length).join('\n');
    const m = ENTRY_HEADING.exec(lines[s]);
    return { heading: lines[s], version: m[1], title: m[2], raw, body: raw.trimEnd() };
  });
  const preamble = starts.length ? lines.slice(0, starts[0]).join('\n') + (starts[0] ? '\n' : '') : text;
  return { preamble, entries };
}

export function resolveChangelog({ mergeBase, change, base, version }) {
  const fail = (why) => new ReleaseError(`cannot place the CHANGELOG entry: ${why}`);
  const mb = parseChangelog(mergeBase ?? '');
  const ch = parseChangelog(change);
  const bs = parseChangelog(base);
  const known = new Map(mb.entries.map((e) => [e.heading, e]));
  const fresh = ch.entries.filter((e) => !known.has(e.heading));
  for (const e of ch.entries) if (known.has(e.heading) && known.get(e.heading).body !== e.body) throw fail(`the older entry "${e.heading}" was edited`);
  if (fresh.length !== 1) throw fail(`expected one new entry, found ${fresh.length}`);
  const mine = `## ${version} — ${fresh[0].title}${fresh[0].body.slice(fresh[0].heading.length)}\n\n`;
  if (!bs.entries.length) return `${bs.preamble.replace(/\n*$/, '\n\n')}${mine.trimEnd()}\n`;
  // Insert above the base's newest entry and leave every other byte of the base as it was.
  const at = base.indexOf(bs.entries[0].raw, bs.preamble.length);
  return base.slice(0, at) + mine + base.slice(at);
}

// ---------------------------------------------------------------- the CLI

const MANIFEST = /(^|\/)(plugin\.json|marketplace\.json)$/;

function sh(root, args, opts = {}) {
  const r = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8', env: { ...process.env, GIT_EDITOR: 'true' }, maxBuffer: 64 * 1024 * 1024, ...opts });
  return { ok: r.status === 0, out: (r.stdout ?? '').trim(), err: (r.stderr ?? '').trim() };
}
function gitOut(root, args) {
  const r = sh(root, args);
  if (!r.ok) throw new ReleaseError(`git ${args.join(' ')} failed: ${r.err}`);
  return r.out;
}
// File text at a revision, or null when the file is not there.
function show(root, rev, path) {
  const r = spawnSync('git', ['-C', root, 'show', `${rev}:${path}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 });
  return r.status === 0 ? r.stdout : null;
}
function rebaseInProgress(root) {
  return ['rebase-merge', 'rebase-apply'].some((d) => existsSync(resolve(root, gitOut(root, ['rev-parse', '--git-path', d]))));
}
const listPaths = (root, args) => gitOut(root, args).split('\n').filter(Boolean);

function parseArgs(argv) {
  const opts = { base: null, json: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--base' && argv[i + 1]) opts.base = argv[++i];
    else if (argv[i] === '--json') opts.json = true;
    else throw new ReleaseError(`unknown option ${argv[i]} (usage: release-rebase.mjs --base <base> [--json])`);
  }
  if (!opts.base) throw new ReleaseError('usage: release-rebase.mjs --base <base> [--json]');
  return opts;
}

// The new versions of every pack the change bumped, and of the marketplace metadata.
function resolveVersions(root, { mergeBase, oldHead, ref }) {
  const changed = listPaths(root, ['diff', '--name-only', mergeBase, oldHead]).filter((p) => RELEASE_FILE.test(p) && MANIFEST.test(p));
  const versions = { packs: {} };
  const beyond = [];
  const pick = (path, pluck) => {
    const [m, c, b] = [mergeBase, oldHead, ref].map((rev) => { const t = show(root, rev, path); return t === null ? null : pluck(JSON.parse(t)); });
    if (c == null) return null;
    return m == null || b == null ? c : resolveVersion({ mergeBase: m, change: c, base: b });
  };
  for (const path of changed) {
    const mbText = show(root, mergeBase, path);
    const edits = manifestEditsBeyondVersion(mbText, show(root, oldHead, path));
    if (edits.length) beyond.push(`${path} (${edits.join(', ')})`);
    if (path.endsWith('/plugin.json')) {
      const name = JSON.parse(show(root, oldHead, path)).name;
      const v = pick(path, (o) => o.version);
      if (v) versions.packs[name] = v;
    } else {
      const names = JSON.parse(show(root, oldHead, path)).plugins?.map((p) => p.name) ?? [];
      for (const name of names) {
        const entryVersion = (rev) => { const t = show(root, rev, path); return t === null ? null : JSON.parse(t).plugins?.find((p) => p.name === name)?.version ?? null; };
        if (name in versions.packs || entryVersion(mergeBase) === entryVersion(oldHead)) continue;
        const v = pick(path, (o) => o.plugins?.find((p) => p.name === name)?.version);
        if (v) versions.packs[name] = v;
      }
      const md = pick(path, (o) => o.metadata?.version);
      if (md) versions.metadata = md;
    }
  }
  return { changed, versions, beyond };
}

// Back to the pre-rebase state. `written` are the files this run rewrote after the rebase; they are
// put back first because `reset --keep` refuses to overwrite local edits.
function restore(root, oldHead, written = []) {
  if (rebaseInProgress(root)) { sh(root, ['rebase', '--abort']); return; }
  if (written.length) sh(root, ['checkout', 'HEAD', '--', ...written]);
  sh(root, ['reset', '--keep', oldHead]);
}

export function main(argv, { cwd = process.cwd(), stdout = (s) => process.stdout.write(s), stderr = (s) => process.stderr.write(s) } = {}) {
  let opts;
  let root;
  try {
    opts = parseArgs(argv);
    root = gitOut(cwd, ['rev-parse', '--show-toplevel']);
  } catch (e) { stderr(`release-rebase: ${e.message}\n`); return 3; }
  const ref = `origin/${opts.base}`;
  const report = (code, obj, text) => { stdout(opts.json ? `${JSON.stringify(obj, null, 2)}\n` : `${text}\n`); return code; };
  if (!sh(root, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]).ok) { stderr(`release-rebase: ${ref} is missing; run: git fetch origin ${opts.base}\n`); return 3; }

  if (rebaseInProgress(root)) sh(root, ['rebase', '--abort']);
  const oldHead = gitOut(root, ['rev-parse', 'HEAD']);
  const mergeBase = gitOut(root, ['merge-base', oldHead, ref]);
  if (sh(root, ['merge-base', '--is-ancestor', ref, oldHead]).ok) {
    return report(0, { resolved: true, oldHead, newHead: oldHead, versions: { packs: {} }, files: [] }, `already on ${ref}: nothing to do`);
  }
  const written = [];
  const unresolved = (extra) => { restore(root, oldHead, written); return report(2, { resolved: false, oldHead, ...extra }, `not resolved: ${extra.error ?? `conflicts in ${extra.conflicts.join(', ')}`}`); };

  const hasGen = existsSync(join(root, 'scripts', 'gen-catalog.py'));
  let catalogConflict = false;
  const first = sh(root, ['rebase', ref]);
  if (!first.ok && !rebaseInProgress(root)) { stderr(`release-rebase: git rebase failed: ${first.err}\n`); return 3; }
  for (let stops = 0; rebaseInProgress(root); stops++) {
    if (stops > 200) return unresolved({ conflicts: [], error: 'the rebase did not converge' });
    const conflicts = listPaths(root, ['diff', '--name-only', '--diff-filter=U']);
    const others = conflicts.filter((p) => !RELEASE_FILE.test(p));
    if (others.length || (conflicts.includes('docs/catalog.md') && !hasGen)) return unresolved({ conflicts });
    if (conflicts.includes('docs/catalog.md')) catalogConflict = true;
    // During a rebase --ours is the base being rebased onto; the change's side is read from oldHead below.
    for (const p of conflicts) {
      if (!sh(root, ['checkout', '--ours', '--', p]).ok || !sh(root, ['add', '--', p]).ok) return unresolved({ conflicts, error: `cannot keep the base's side of ${p}` });
    }
    if (!sh(root, ['rebase', '--continue']).ok && !rebaseInProgress(root)) return unresolved({ conflicts, error: 'git rebase --continue failed' });
  }

  try {
    const { changed, versions, beyond } = resolveVersions(root, { mergeBase, oldHead, ref });
    if (beyond.length) return unresolved({ conflicts: changed, error: `a manifest was edited beyond its version: ${beyond.join('; ')}` });
    const files = written;
    for (const path of changed) {
      const baseText = show(root, ref, path);
      if (baseText === null) continue;
      writeFileSync(join(root, path), resolveManifest(baseText, versions));
      files.push(path);
    }
    const clChange = show(root, oldHead, 'CHANGELOG.md');
    const clMerge = show(root, mergeBase, 'CHANGELOG.md');
    if (clChange !== null && clChange !== clMerge) {
      const version = versions.metadata ?? JSON.parse(show(root, ref, '.claude-plugin/marketplace.json') ?? '{}').metadata?.version;
      if (!version) throw new ReleaseError('cannot place the CHANGELOG entry: no metadata.version to number it with');
      writeFileSync(join(root, 'CHANGELOG.md'), resolveChangelog({ mergeBase: clMerge, change: clChange, base: show(root, ref, 'CHANGELOG.md') ?? '', version }));
      files.push('CHANGELOG.md');
    }
    if (hasGen && (catalogConflict || files.some((f) => MANIFEST.test(f)))) {
      const g = spawnSync('python3', ['scripts/gen-catalog.py'], { cwd: root, encoding: 'utf8' });
      if (g.status !== 0) throw new ReleaseError(`scripts/gen-catalog.py failed: ${(g.stderr || g.stdout).trim()}`);
      files.push('docs/catalog.md');
    }
    const newHead = gitOut(root, ['rev-parse', 'HEAD']);
    return report(0, { resolved: true, oldHead, newHead, versions, files }, `resolved: ${files.join(', ') || 'no release file changed'} (uncommitted, ${Object.entries(versions.packs).map(([n, v]) => `${n} ${v}`).join(', ')})`);
  } catch (e) {
    // Any failure after the replay (a malformed manifest, a write error) must leave the tree as it was found.
    return unresolved({ conflicts: [], error: e instanceof Error ? e.message : String(e) });
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) process.exit(main(process.argv.slice(2)));
