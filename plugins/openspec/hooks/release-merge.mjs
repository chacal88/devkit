#!/usr/bin/env node
// release-merge: merge origin/<base> into the current branch and resolve the release-file conflicts
// by rule; commit the merge, never push (conduct-rounds design D11, release-merge-conflict D-1).
// With --merge <rev> it joins a change's head into a delivery train's branch with the roles swapped: the
// change's release is renumbered above the train's (delivery-train D-6). With --assign it is the delivery step of a change that
// states its release in openspec/changes/<id>/release.md: it merges origin/<base> when the branch is behind it and writes the
// release lines and the ADR numbers above it; a joined head with a note is numbered the same way above the train (release-at-merge
// D-4, D-6, D-7). No dependencies.
//
//   node release-merge.mjs --base <base> [--roadmap-ticks] [--json]
//   node release-merge.mjs --assign --base <base> [--json]
//   node release-merge.mjs --merge <rev> [--json]
//
// Exit 0 resolved (the merge or the release is committed) or nothing to do, 2 not resolvable (the merge is undone and
// the branch is at its old head), 3 setup or usage error.

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { RELEASE_FILE, pinsIn, setPins, ReleaseError, bumpKind, applyBump, resolveManifest, withoutVersions, PIN_FILE, PIN_PACK, PIN_PACK_NAME, ADR_DIRS, RELEASE_NOTE, ShipConfigError, parseReleaseNote, repoReader, computeRelease, changeAdrs, releaseStateAt, releaseTagOf, withReleaseVersion, CITATION_PATHSPEC, adrFileRe, maskCitations, stepRecord } from './deliver-check.mjs';
// The pin definition (ADR 0027) and the helpers every consumer CI needs live in deliver-check.mjs, which it downloads alone (release-at-merge D-3a);
// each name stays importable from here as the same object.
export { pinsIn, setPins, ReleaseError, bumpKind, applyBump, resolveManifest, PIN_FILE, PIN_PACK, PIN_PACK_NAME };

// ---------------------------------------------------------------- versions

// `mergeBase`: the version where the branch forked; `change`: the branch's own; `base`: origin/<base>'s.
export function resolveVersion({ mergeBase, change, base }) {
  return applyBump(base, bumpKind(mergeBase, change));
}

// ---------------------------------------------------------------- manifests

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

// ---------------------------------------------------------------- the CI pin

const MASK = '0.0.0';

// `git merge-file` of three texts in a temporary folder named `prefix`, always removed: the merged text, or null when the merge
// conflicts or errors.
function mergeTexts(base, ours, theirs, prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  try {
    const paths = { base: join(dir, 'base'), ours: join(dir, 'ours'), theirs: join(dir, 'theirs') };
    writeFileSync(paths.base, base);
    writeFileSync(paths.ours, ours);
    writeFileSync(paths.theirs, theirs);
    const r = spawnSync('git', ['merge-file', '-p', paths.ours, paths.base, paths.theirs], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    return r.status === 0 ? r.stdout : null;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// The three sides merged with their pins masked: the merged text (pins at v0.0.0), or null when the
// merge conflicts, errors, or a side is missing. The temporary folder is always removed.
export function mergePins({ base, ours, theirs }) {
  if (base === null || ours === null || theirs === null) return null;
  return mergeTexts(setPins(base, MASK), setPins(ours, MASK), setPins(theirs, MASK), 'devkit-pin-');
}

// ---------------------------------------------------------------- the roadmap ticks

export const ROADMAP_FILE = 'openspec/roadmap.md';
const UNTICKED = /^(\s*)- \[ \](.*)$/;

// The roadmap text `base` writes once the change's ticks are in (delivery-train D-6): every line that differs between
// `mergeBase` and `change` differs only by `- [ ]` becoming `- [x]` with the same rest of the line, and each such line
// exists unticked or ticked in `base`. Anything else (a line added, removed, reworded or unticked, a text that is missing,
// a tick `base` lacks) throws ReleaseError. The texts are split on \n, so a missing final newline stays as `base` has it.
export function resolveRoadmapTicks({ mergeBase, change, base }) {
  const fail = (why) => new ReleaseError(`cannot merge the roadmap ticks: ${why}`);
  if ([mergeBase, change, base].some((t) => typeof t !== 'string')) throw fail('a side of the roadmap is missing');
  const before = mergeBase.split('\n');
  const after = change.split('\n');
  if (before.length !== after.length) throw fail('a line was added or removed');
  const merged = base.split('\n');
  before.forEach((line, i) => {
    if (line === after[i]) return;
    const m = UNTICKED.exec(line);
    if (!m || after[i] !== `${m[1]}- [x]${m[2]}`) throw fail(`line ${i + 1} changed by more than a tick: ${JSON.stringify(line)}`);
    const unticked = merged.indexOf(line);
    if (unticked !== -1) merged[unticked] = after[i];
    else if (!merged.includes(after[i])) throw fail(`line ${i + 1} is not in the base: ${JSON.stringify(line)}`);
  });
  return merged.join('\n');
}

// Which conflicted paths stop the caller. `stagesOf(path)` gives { base, ours, theirs } (a missing blob is null), `ours`
// being the side numbered above and `theirs` the side whose release and ticks are kept; it is called at most once, and only
// for PIN_FILE and, with a `{ roadmap }` resolver, ROADMAP_FILE. `roadmapMerged` is the text the resolver wrote for
// ROADMAP_FILE, or null (a path it refused stays blocking); it is not enumerable while it is null, so a caller that
// compares the result without a resolver sees `{ blocking, pinMerged }` as before.
export function classifyConflict(paths, stagesOf, { roadmap = null } = {}) {
  let pinMerged = null;
  let roadmapMerged = null;
  const blocking = paths.filter((p) => {
    if (RELEASE_FILE.test(p)) return false;
    if (p === ROADMAP_FILE && roadmap) {
      const stages = stagesOf(p);
      try { roadmapMerged = roadmap({ mergeBase: stages.base, change: stages.theirs, base: stages.ours }); } catch (e) {
        if (!(e instanceof ReleaseError)) throw e;
        return true;
      }
      return false;
    }
    if (p !== PIN_FILE) return true;
    pinMerged = mergePins(stagesOf(p));
    return pinMerged === null;
  });
  const result = { blocking, pinMerged };
  Object.defineProperty(result, 'roadmapMerged', { value: roadmapMerged, enumerable: roadmapMerged !== null });
  return result;
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
// The index stages of a conflicted path during a merge: :1 the common base, :2 the branch (HEAD), :3 the merged revision.
// `ours` is the side numbered above, the orientation conduct-check's threeVersions gives: origin/<base> (:3) in --base mode,
// the train's HEAD (:2) in --merge mode, where the roles are swapped.
const mergeStages = (root, merging = false) => (path) => (merging
  ? { base: show(root, ':1', path), ours: show(root, ':2', path), theirs: show(root, ':3', path) }
  : { base: show(root, ':1', path), ours: show(root, ':3', path), theirs: show(root, ':2', path) });
const mergeInProgress = (root) => sh(root, ['rev-parse', '-q', '--verify', 'MERGE_HEAD']).ok;
// Tracked files outside openspec/ with uncommitted changes (porcelain -z; a rename names two paths).
function dirtyOutsideOpenspec(root) {
  const r = spawnSync('git', ['-C', root, 'status', '--porcelain', '-z', '--untracked-files=no'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const parts = (r.stdout ?? '').split('\0').filter(Boolean);
  const paths = [];
  for (let i = 0; i < parts.length; i++) {
    paths.push(parts[i].slice(3));
    if (/[RC]/.test(parts[i].slice(0, 2))) paths.push(parts[++i]);
  }
  return paths.filter((p) => !p.startsWith('openspec/'));
}
// Write a file and stage it, recording it in `touched` so an abort can put it back.
function writeStaged(root, touched, path, text) {
  touched.push(path);
  writeFileSync(join(root, path), text);
  const r = sh(root, ['add', '--', path]);
  if (!r.ok) throw new ReleaseError(`git add ${path} failed: ${r.err}`);
}
function rebaseInProgress(root) {
  return ['rebase-merge', 'rebase-apply'].some((d) => existsSync(resolve(root, gitOut(root, ['rev-parse', '--git-path', d]))));
}
const listPaths = (root, args) => gitOut(root, args).split('\n').filter(Boolean);

const USAGE = 'release-merge.mjs --base <base> [--roadmap-ticks] [--json] | --assign --base <base> [--json] | --merge <rev> [--json]';

function parseArgs(argv) {
  const opts = { base: null, merge: null, assign: false, roadmapTicks: false, json: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--base' && argv[i + 1]) opts.base = argv[++i];
    else if (argv[i] === '--merge' && argv[i + 1]) opts.merge = argv[++i];
    else if (argv[i] === '--assign') opts.assign = true;
    else if (argv[i] === '--roadmap-ticks') opts.roadmapTicks = true;
    else if (argv[i] === '--json') opts.json = true;
    else throw new ReleaseError(`unknown option ${argv[i]} (usage: ${USAGE})`);
  }
  if (!opts.base === !opts.merge || (opts.assign && (!opts.base || opts.roadmapTicks))) throw new ReleaseError(`usage: ${USAGE}`);
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

// Undo the run: abort the merge (which resets what it staged), then put back every touched path that still
// differs from HEAD (a write whose `git add` never ran), and take out a touched path HEAD does not hold (the new name of a
// renamed ADR). Step 4 of main guarantees those held no edit of the person's.
function restore(root, touched = []) {
  if (mergeInProgress(root)) sh(root, ['merge', '--abort']);
  for (const path of new Set(touched)) {
    if (sh(root, ['cat-file', '-e', `HEAD:${path}`]).ok) {
      if (!sh(root, ['diff', '--quiet', 'HEAD', '--', path]).ok) sh(root, ['checkout', 'HEAD', '--', path]);
    } else {
      sh(root, ['rm', '-q', '--cached', '--ignore-unmatch', '--', path]);
      rmSync(join(root, path), { force: true });
    }
  }
}

// ---------------------------------------------------------------- the release note: the step and the join (release-at-merge D-4, D-6, D-7)

const escapeRe = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const CHANGELOG = 'CHANGELOG.md';
const CATALOG = 'docs/catalog.md';

// The two citation forms of the ADR `slug` once it is numbered `number`, in the text of the file `path` (D-4, D-19): `ADR [<slug>]` becomes
// `ADR <number>`, and `<slug>.md` becomes `<number>-<slug>.md` only where it names a file of an ADR folder (adrFileRe).
export function rewriteCitations(text, slug, number, path = '') {
  return text.split(`ADR [${slug}]`).join(`ADR ${number}`)
    .replace(adrFileRe(slug, path), (_, dir = '') => `${dir}${number}-${slug}.md`);
}

const NOTE_PATH = new RegExp(`^openspec/changes/([^/]+)/${escapeRe(RELEASE_NOTE)}$`);

// The noted change of `side` (D-6 step 1): the one folder under openspec/changes/ (not archive/) whose release note `side` added or
// changed since `mergeBase`: { id }, { none: true } when there is none, or { error } when there are two or more.
function notedChangeOf(root, mergeBase, side) {
  const ids = listPaths(root, ['diff', '--name-only', '--no-renames', '--diff-filter=AM', mergeBase, side, '--', 'openspec/changes'])
    .map((p) => NOTE_PATH.exec(p)?.[1]).filter((id) => id && id !== 'archive');
  if (ids.length === 1) return { id: ids[0] };
  if (ids.length === 0) return { none: true, error: `no change under openspec/changes/ adds a ${RELEASE_NOTE} since its merge base with the base` };
  return { error: `more than one change adds a ${RELEASE_NOTE}: ${ids.join(', ')}` };
}

// The devkit-openspec version at `rev` when the pack the CI pins follow is there, else null (the pins are then left as they are).
function pinPackVersion(root, rev) {
  try {
    const obj = JSON.parse(show(root, rev, PIN_PACK) ?? 'null');
    return obj?.name === PIN_PACK_NAME && typeof obj.version === 'string' ? obj.version : null;
  } catch { return null; }
}

// The number of the ADR `slug` in the folders of ADR_DIRS at `rev`, or null.
function landedNumber(reader, rev, slug) {
  for (const dir of ADR_DIRS) {
    const found = reader.dir(rev, dir).map((n) => new RegExp(`^(\\d{4})-${escapeRe(slug)}\\.md$`).exec(n)?.[1]).find(Boolean);
    if (found) return found;
  }
  return null;
}

// The numbering core of the step and the join (D-6, D-7). With `merging` (the join) HEAD is `target`, the train's tip, and `side` the head
// joined into it; otherwise HEAD is `side` and `target` is origin/<base>, merged when the branch is behind it. `id` is the noted change,
// `file` the release file the project names, `label` how a message names the target. The release lines keep no number the side wrote: the
// release files take the target's side, a text the side numbered is merged with its numbers masked, and its ADRs get their unnumbered
// names back; then the lines `computeRelease` gives above `target` are written on the merged text, each ADR is renamed to its number and
// every citation outside openspec/changes/ is rewritten. With no merge to make, what the step's own record wrote is given back first (D-20).
// The step's commit ends with its record, the join's with none. Returns { code, out, text }; a refusal or a failure leaves the tree as it was.
export function numberRelease(root, { side, target, id, file, merging = false, label }) {
  const oldHead = gitOut(root, ['rev-parse', 'HEAD']);
  const notePath = `openspec/changes/${id}/${RELEASE_NOTE}`;
  const noteText = merging ? show(root, side, notePath) : (existsSync(join(root, notePath)) ? readFileSync(join(root, notePath), 'utf8') : null);
  const touched = [];
  const refuse = (extra) => {
    restore(root, touched);
    return { code: 2, out: { resolved: false, oldHead, change: id, conflicts: [], ...extra }, text: `not resolved: ${extra.error ?? `conflicts in ${extra.conflicts.join(', ')}`}` };
  };
  const note = parseReleaseNote(noteText ?? '');
  if (note.error) return refuse({ error: note.error });
  const adrs = changeAdrs(root, merging ? side : null, id);
  const state = releaseStateAt(root, { head: side, tip: target, base: label, note, file, adrs, id });
  if (state.kind === 'error') return refuse({ error: state.error });
  if (state.kind === 'hand') return refuse({ error: `release lines edited by hand: ${state.paths.join(', ')}` });
  if (state.citations.unlanded.length) return refuse({ error: state.citations.unlanded.map((x) => `ADR [${x}] is cited but has not landed on ${label}; it lands with its own change`).join('; ') });
  const nothing = { resolved: true, oldHead, newHead: oldHead, versions: { packs: {} }, files: [], change: id, adrs: [], citations: [] };
  if (!merging && state.current) return { code: 0, out: nothing, text: `the release of ${id} is current on ${label}: nothing to do` };

  const reader = repoReader(root);
  const mergeBase = gitOut(root, ['merge-base', side, target]);
  const needsMerge = merging || !sh(root, ['merge-base', '--is-ancestor', target, oldHead]).ok;
  const hasGen = existsSync(join(root, 'scripts', 'gen-catalog.py'));
  const targetPin = pinPackVersion(root, target);
  let conflicts = [];
  if (needsMerge) {
    const started = sh(root, ['-c', 'rerere.enabled=false', 'merge', '--no-ff', '--no-commit', merging ? side : target]);
    if (!started.ok && !mergeInProgress(root)) return { code: 3, error: `git merge failed: ${started.err}` };
    conflicts = listPaths(root, ['diff', '--name-only', '--diff-filter=U']);
  }
  try {
    // Step 2: what the side numbered is given back. Its own numbered records, and the texts that hold their numbers, are merged unnumbered.
    const own = state.adrs.flatMap((a) => {
      const numbered = reader.dir(side, a.folder).filter((n) => new RegExp(`^\\d{4}-${escapeRe(a.slug)}\\.md$`).test(n));
      return numbered.length === 1 ? [{ ...a, number: numbered[0].slice(0, 4), path: `${a.folder}/${numbered[0]}` }] : [];
    });
    // The ADR part of D-5's mask on the real path (D-18): the side's ADR numbers back to their citations, nothing else, and only in a file
    // that holds citations: the step never numbered a test literal or a binary file, so it does not give one back.
    const unassign = (path, text) => maskCitations(text, path, own);
    const masked = new Map();
    const blocking = [];
    if (needsMerge) {
      const ownPaths = new Set(own.map((a) => a.path));
      const pinMask = (path, text) => (path === PIN_FILE && targetPin !== null ? setPins(text, MASK) : text);
      for (const path of listPaths(root, ['diff', '--name-only', '--no-renames', mergeBase, side])) {
        if (path.startsWith('openspec/changes/') || RELEASE_FILE.test(path) || path === file || ownPaths.has(path)) continue;
        const mine = show(root, side, path);
        if (mine === null || (unassign(path, mine) === mine && !(path === PIN_FILE && targetPin !== null && conflicts.includes(path)))) continue;
        const merged = mergeTexts(pinMask(path, show(root, mergeBase, path) ?? ''), pinMask(path, unassign(path, mine)), pinMask(path, show(root, target, path) ?? ''), 'devkit-release-');
        if (merged === null) blocking.push(path);
        else masked.set(path, merged);
      }
      const keepTarget = [];
      let roadmapMerged = null;
      for (const path of conflicts) {
        if (masked.has(path) || blocking.includes(path)) continue;
        if (RELEASE_FILE.test(path)) {
          // A release file keeps the target's side; a manifest the side also edited beyond its versions is a conflict of other lines.
          if (path === CATALOG && !hasGen) blocking.push(path);
          else if (MANIFEST.test(path) && manifestEditsBeyondVersion(show(root, mergeBase, path), show(root, side, path) ?? '{}').length) blocking.push(path);
          else keepTarget.push(path);
        } else if (path === file) {
          const theirs = show(root, target, path);
          const version = JSON.parse(theirs ?? '{}').version;
          const merged = typeof version === 'string' && show(root, mergeBase, path) !== null
            ? mergeTexts(withReleaseVersion(show(root, mergeBase, path), version), withReleaseVersion(show(root, side, path), version), theirs, 'devkit-release-')
            : null;
          if (merged === null) blocking.push(path);
          else masked.set(path, merged);
        } else if (path === ROADMAP_FILE && merging) {
          try { roadmapMerged = resolveRoadmapTicks({ mergeBase: show(root, mergeBase, path), change: show(root, side, path), base: show(root, target, path) }); } catch (e) {
            if (!(e instanceof ReleaseError)) throw e;
            blocking.push(path);
          }
        } else blocking.push(path);
      }
      if (blocking.length) return refuse({ conflicts: [...new Set([...conflicts, ...blocking])] });
      const keep = merging ? '--ours' : '--theirs';
      for (const path of keepTarget) {
        touched.push(path);
        if (!sh(root, ['checkout', keep, '--', path]).ok || !sh(root, ['add', '--', path]).ok) return refuse({ conflicts, error: `cannot keep the base's side of ${path}` });
      }
      for (const [path, text] of masked) writeStaged(root, touched, path, text);
      if (roadmapMerged !== null) writeStaged(root, touched, ROADMAP_FILE, roadmapMerged);
      for (const a of own) {
        const text = unassign(a.path, readFileSync(join(root, a.path), 'utf8'));
        touched.push(a.path, a.from);
        gitOut(root, ['mv', '-f', a.path, a.from]);
        writeStaged(root, touched, a.from, text);
      }
    }
    // D-20: with no merge to make (a person merged the base by hand), what the step's own record wrote is given back: each renamed record
    // whose key is in `reassign`, and the record's citation paths that hold its number, each through `git merge-file` of the path's text at
    // the record's commit, the working text and that commit's text with the record's numbers masked. Only the tokens the step wrote go back,
    // so a citation the base brought with the same number stays; a line edited where the step wrote a number conflicts and is refused. A
    // release line in `reassign` is left to step 3, which writes every release line.
    if (!needsMerge && state.reassign.length) {
      const record = stepRecord(root, { head: oldHead, tip: target, id });
      const back = (record?.adrs ?? []).filter((a) => state.reassign.includes(a.from));
      const nameOf = (path) => path.slice(path.lastIndexOf('/') + 1);
      const numbers = back.map((a) => ({ number: nameOf(a.to).slice(0, 4), slug: nameOf(a.from).replace(/\.md$/, '') }));
      const givenBack = (path, working) => {
        const recorded = show(root, record.commit, path) ?? '';
        const theirs = maskCitations(recorded, path, numbers);
        return theirs === recorded ? working : mergeTexts(recorded, working, theirs, 'devkit-release-');
      };
      const cannot = (path) => refuse({ error: `cannot give back the numbers the step wrote in ${path}` });
      for (const a of back) {
        const text = givenBack(a.to, readFileSync(join(root, a.to), 'utf8'));
        if (text === null) return cannot(a.to);
        touched.push(a.to, a.from);
        gitOut(root, ['mv', '-f', a.to, a.from]);
        writeStaged(root, touched, a.from, text);
      }
      for (const path of back.length ? record.citations : []) {
        if (!existsSync(join(root, path))) continue;
        const working = readFileSync(join(root, path), 'utf8');
        const text = givenBack(path, working);
        if (text === null) return cannot(path);
        if (text !== working) writeStaged(root, touched, path, text);
      }
    }
    // A slug another record of the ADR folders already has (D-4).
    const listed = listPaths(root, ['ls-files', '--', ...ADR_DIRS]);
    for (const a of state.adrs) {
      const others = listed.filter((p) => p !== a.from && ADR_DIRS.includes(p.slice(0, p.lastIndexOf('/'))) && new RegExp(`^(\\d{4}-)?${escapeRe(a.slug)}\\.md$`).test(p.slice(p.lastIndexOf('/') + 1)));
      if (others.length) return refuse({ error: `a second ADR with the slug ${a.slug}: ${[a.from, ...others].join(', ')}` });
    }

    // Step 3: the release lines computed above the target, set on the merged text so the side's other edits stay.
    const computed = computeRelease(reader, target, note, file, adrs);
    const { versions } = computed;
    const current = (path) => (existsSync(join(root, path)) ? readFileSync(join(root, path), 'utf8') : null);
    const files = [];
    const writeLine = (path, text) => {
      if (text === current(path)) return;
      writeStaged(root, touched, path, text);
      files.push(path);
    };
    for (const path of Object.keys(computed.files)) {
      if (path === PIN_FILE) continue;
      if (path === CHANGELOG) writeLine(path, computed.files[path]);
      else if (path === file && versions.release !== undefined) writeLine(path, withReleaseVersion(current(path), versions.release));
      else writeLine(path, resolveManifest(current(path), { packs: versions.packs, ...(versions.metadata === undefined ? {} : { metadata: versions.metadata }) }));
    }
    if (targetPin !== null && current(PIN_FILE) !== null) writeLine(PIN_FILE, setPins(current(PIN_FILE), versions.packs[PIN_PACK_NAME] ?? targetPin));
    if (hasGen && (conflicts.includes(CATALOG) || files.some((f) => MANIFEST.test(f)))) {
      touched.push(CATALOG);
      const g = spawnSync('python3', ['scripts/gen-catalog.py'], { cwd: root, encoding: 'utf8' });
      if (g.status !== 0) throw new ReleaseError(`scripts/gen-catalog.py failed: ${(g.stderr || g.stdout).trim()}`);
      if (!sh(root, ['add', '--', CATALOG]).ok) throw new ReleaseError(`git add ${CATALOG} failed`);
      files.push(CATALOG);
    }
    for (const a of computed.adrs) {
      touched.push(a.from, a.to);
      gitOut(root, ['mv', a.from, a.to]);
      writeStaged(root, touched, a.to, rewriteCitations(readFileSync(join(root, a.to), 'utf8'), a.slug, a.number, a.to));
    }
    // The citations, in every tracked file that holds citations (CITATION_PATHSPEC): the change's own ADRs and those it cites that the target
    // numbered.
    const numbers = new Map(computed.adrs.map((a) => [a.slug, a.number]));
    for (const slug of state.citations.cited) {
      const n = landedNumber(reader, target, slug);
      if (n) numbers.set(slug, n);
    }
    const citations = [];
    if (numbers.size) {
      const patterns = [...numbers.keys()].flatMap((slug) => ['-e', `ADR [${slug}]`, '-e', `${slug}.md`]);
      const hits = spawnSync('git', ['-C', root, 'grep', '-I', '-l', '-z', '-F', ...patterns, '--', ...CITATION_PATHSPEC], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
      if (hits.status !== 0 && hits.status !== 1) throw new ReleaseError(`git grep failed: ${(hits.stderr ?? '').trim()}`);
      const renamed = new Set(computed.adrs.map((a) => a.to));
      for (const path of (hits.stdout ?? '').split('\0').filter(Boolean)) {
        const text = readFileSync(join(root, path), 'utf8');
        let out = text;
        for (const [slug, number] of numbers) out = rewriteCitations(out, slug, number, path);
        if (out === text) continue;
        writeStaged(root, touched, path, out);
        if (!renamed.has(path)) citations.push(path);
      }
    }

    // Step 4: one commit, never a push.
    const left = listPaths(root, ['diff', '--name-only', '--diff-filter=U']);
    if (left.length) return refuse({ conflicts: left });
    const adrsOut = computed.adrs.map(({ from, to }) => ({ from, to }));
    if (!needsMerge && sh(root, ['diff', '--cached', '--quiet']).ok) return { code: 0, out: nothing, text: `the release of ${id} writes nothing: nothing to do` };
    const message = merging
      ? `chore(train): join ${side.slice(0, 7)} and renumber its release above the train`
      : needsMerge ? `chore(release): merge origin/${label} and assign the release of ${id}` : `chore(release): assign the release of ${id}`;
    // The step's record (D-20): one trailer per thing the commit wrote, the release lines in the order they are written.
    const lineOrder = [...Object.keys(computed.files).filter((p) => p !== PIN_FILE), PIN_FILE];
    const trailers = [
      `Release-change: ${id}`,
      ...lineOrder.filter((p) => files.includes(p)).map((p) => `Release-line: ${p}`),
      ...adrsOut.map((a) => `Release-adr: ${a.from} -> ${a.to}`),
      ...citations.map((p) => `Release-citation: ${p}`),
    ].join('\n');
    const committed = sh(root, ['commit', '-q', '-m', message, ...(merging ? [] : ['-m', trailers])]);
    if (!committed.ok) return refuse({ error: `git commit failed: ${committed.err}` });
    const newHead = gitOut(root, ['rev-parse', 'HEAD']);
    return {
      code: 0,
      out: { resolved: true, oldHead, newHead, versions, files, ...(merging ? { conflicts } : {}), change: id, adrs: adrsOut, citations },
      text: `resolved: ${merging ? `joined ${side.slice(0, 7)}` : `assigned the release of ${id}`} at ${newHead.slice(0, 7)} (${Object.entries(versions.packs).map(([n, v]) => `${n} ${v}`).join(', ') || 'no pack'}${adrsOut.length ? `; ${adrsOut.map((a) => a.to).join(', ')}` : ''})`,
    };
  } catch (e) {
    // Any failure after the merge started (a malformed manifest, a write error) leaves the tree as it was found.
    return refuse({ error: e instanceof Error ? e.message : String(e) });
  }
}

export function main(argv, { cwd = process.cwd(), stdout = (s) => process.stdout.write(s), stderr = (s) => process.stderr.write(s) } = {}) {
  let opts;
  let root;
  try {
    opts = parseArgs(argv);
    root = gitOut(cwd, ['rev-parse', '--show-toplevel']);
  } catch (e) { stderr(`release-merge: ${e.message}\n`); return 3; }
  const merging = opts.merge !== null;
  // `ref` is what is merged into HEAD: origin/<base>, or in --merge mode the revision joined into the train (as a sha).
  let ref = merging ? opts.merge : `origin/${opts.base}`;
  const tag = merging ? { mode: 'merge' } : opts.assign ? { mode: 'assign' } : {};
  const report = (code, obj, text) => { stdout(opts.json ? `${JSON.stringify({ ...obj, ...tag }, null, 2)}\n` : `${text}\n`); return code; };
  const found = sh(root, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
  if (!found.ok) { stderr(merging ? `release-merge: ${ref} is not a commit of this repository\n` : `release-merge: ${ref} is missing; run: git fetch origin ${opts.base}\n`); return 3; }
  if (merging || opts.assign) ref = found.out;

  if (mergeInProgress(root)) sh(root, ['merge', '--abort']);
  if (rebaseInProgress(root)) { stderr(`release-merge: a rebase is in progress in ${root}; finish or abort it first\n`); return 3; }
  const dirty = dirtyOutsideOpenspec(root);
  if (dirty.length) { stderr(`release-merge: uncommitted changes outside openspec/: ${dirty.join(', ')}; commit them first\n`); return 3; }
  const oldHead = gitOut(root, ['rev-parse', 'HEAD']);
  const mergeBase = gitOut(root, ['merge-base', oldHead, ref]);
  // The release note (release-at-merge D-6, D-7): the step of a noted change, and the join of a noted head.
  const numbered = (r) => {
    if (r.code === 3) { stderr(`release-merge: ${r.error}\n`); return 3; }
    if (r.code === 2 && opts.assign && r.out.error) stderr(`release-merge: ${r.out.error}\n`);
    return report(r.code, r.out, r.text);
  };
  // The release file the project names; read only by the step and the join, so --base is as it was. A setting the reader refuses is a
  // setup error of the step; the join then takes every head by the old rule.
  let file = null;
  if (opts.assign || merging) {
    try { file = releaseTagOf(root); } catch (e) {
      if (!(e instanceof ShipConfigError)) throw e;
      if (opts.assign) { stderr(`release-merge: ${e.message}\n`); return 3; }
    }
  }
  if (opts.assign) {
    if (file === null) return report(2, { resolved: false, oldHead, conflicts: [], error: 'openspec/config.yaml names no devkit.release_tag: this project has no release to assign' }, 'not resolved: no devkit.release_tag');
    const noted = notedChangeOf(root, mergeBase, oldHead);
    if (noted.error) return report(2, { resolved: false, oldHead, conflicts: [], error: noted.error }, `not resolved: ${noted.error}`);
    return numbered(numberRelease(root, { side: oldHead, target: ref, id: noted.id, file, label: opts.base }));
  }
  if (sh(root, ['merge-base', '--is-ancestor', ref, oldHead]).ok) {
    return report(0, { resolved: true, oldHead, newHead: oldHead, versions: { packs: {} }, files: [], ...(merging ? { conflicts: [] } : {}) }, merging ? `${ref.slice(0, 7)} is already in the train: nothing to do` : `already on ${ref}: nothing to do`);
  }
  if (merging && file !== null) {
    // A head with no note joins by the old rule below (AC-10).
    const noted = notedChangeOf(root, mergeBase, ref);
    if (!noted.none) {
      if (noted.error) return report(2, { resolved: false, oldHead, conflicts: [], error: noted.error }, `not resolved: ${noted.error}`);
      return numbered(numberRelease(root, { side: ref, target: oldHead, id: noted.id, file, merging: true, label: 'the train' }));
    }
  }
  // The two sides of the release computation: `change`'s bumps are kept by kind and numbered above `base`'s numbers. --base
  // keeps the branch's and numbers above origin/<base>; --merge swaps them (the train's tip is the side numbered above).
  const side = merging ? { change: ref, base: oldHead } : { change: oldHead, base: ref };
  const touched = [];
  const unresolved = (extra) => { restore(root, touched); return report(2, { resolved: false, oldHead, ...extra }, `not resolved: ${extra.error ?? `conflicts in ${extra.conflicts.join(', ')}`}`); };

  const packAtBase = (() => { try { return JSON.parse(show(root, side.base, PIN_PACK) ?? 'null'); } catch { return null; } })();
  const baseVersion = packAtBase?.name === PIN_PACK_NAME && typeof packAtBase.version === 'string' ? packAtBase.version : null;
  const hasGen = existsSync(join(root, 'scripts', 'gen-catalog.py'));
  const started = sh(root, ['-c', 'rerere.enabled=false', 'merge', '--no-ff', '--no-commit', ref]);
  if (!started.ok && !mergeInProgress(root)) { stderr(`release-merge: git merge failed: ${started.err}\n`); return 3; }

  const conflicts = listPaths(root, ['diff', '--name-only', '--diff-filter=U']);
  const ticks = merging || opts.roadmapTicks;
  const { blocking, pinMerged, roadmapMerged } = classifyConflict(conflicts, mergeStages(root, merging), ticks ? { roadmap: resolveRoadmapTicks } : {});
  if (blocking.length || (conflicts.includes('docs/catalog.md') && !hasGen)) return unresolved({ conflicts });
  // During a merge the base's side is --theirs (origin/<base>) in --base mode and --ours (the train) in --merge mode; the
  // change's side is read from `side.change` below.
  const keep = merging ? '--ours' : '--theirs';
  for (const p of conflicts.filter((c) => c !== PIN_FILE && c !== ROADMAP_FILE)) {
    touched.push(p);
    if (!sh(root, ['checkout', keep, '--', p]).ok || !sh(root, ['add', '--', p]).ok) return unresolved({ conflicts, error: `cannot keep the base's side of ${p}` });
  }

  try {
    if (roadmapMerged !== null) writeStaged(root, touched, ROADMAP_FILE, roadmapMerged);
    if (conflicts.includes(PIN_FILE)) {
      if (baseVersion === null) return unresolved({ conflicts, error: `cannot set the pin: ${ref} has no ${PIN_PACK_NAME} version in ${PIN_PACK}` });
      writeStaged(root, touched, PIN_FILE, setPins(pinMerged, baseVersion));
    }
    const { changed, versions, beyond } = resolveVersions(root, { mergeBase, oldHead: side.change, ref: side.base });
    if (beyond.length) return unresolved({ conflicts: changed, error: `a manifest was edited beyond its version: ${beyond.join('; ')}` });
    const files = [];
    for (const path of changed) {
      const baseText = show(root, side.base, path);
      if (baseText === null) continue;
      writeStaged(root, touched, path, resolveManifest(baseText, versions));
      files.push(path);
    }
    const clChange = show(root, side.change, 'CHANGELOG.md');
    const clMerge = show(root, mergeBase, 'CHANGELOG.md');
    if (clChange !== null && clChange !== clMerge) {
      const version = versions.metadata ?? JSON.parse(show(root, side.base, '.claude-plugin/marketplace.json') ?? '{}').metadata?.version;
      if (!version) throw new ReleaseError('cannot place the CHANGELOG entry: no metadata.version to number it with');
      writeStaged(root, touched, 'CHANGELOG.md', resolveChangelog({ mergeBase: clMerge, change: clChange, base: show(root, side.base, 'CHANGELOG.md') ?? '', version }));
      files.push('CHANGELOG.md');
    }
    const pinVersion = versions.packs[PIN_PACK_NAME] ?? baseVersion;
    if (pinVersion && existsSync(join(root, PIN_FILE))) {
      writeStaged(root, touched, PIN_FILE, setPins(readFileSync(join(root, PIN_FILE), 'utf8'), pinVersion));
      files.push(PIN_FILE);
    }
    if (hasGen && (conflicts.includes('docs/catalog.md') || files.some((f) => MANIFEST.test(f)))) {
      touched.push('docs/catalog.md');
      const g = spawnSync('python3', ['scripts/gen-catalog.py'], { cwd: root, encoding: 'utf8' });
      if (g.status !== 0) throw new ReleaseError(`scripts/gen-catalog.py failed: ${(g.stderr || g.stdout).trim()}`);
      if (!sh(root, ['add', '--', 'docs/catalog.md']).ok) throw new ReleaseError('git add docs/catalog.md failed');
      files.push('docs/catalog.md');
    }
    const left = listPaths(root, ['diff', '--name-only', '--diff-filter=U']);
    if (left.length) return unresolved({ conflicts: left });
    const message = merging ? `chore(train): join ${ref.slice(0, 7)} and renumber its release above the train` : `chore(release): merge ${ref} and renumber the release above it`;
    const committed = sh(root, ['commit', '-q', '-m', message]);
    if (!committed.ok) return unresolved({ conflicts: [], error: `git commit failed: ${committed.err}` });
    const newHead = gitOut(root, ['rev-parse', 'HEAD']);
    return report(0, { resolved: true, oldHead, newHead, versions, files, ...(merging ? { conflicts } : {}) }, `resolved: merged ${ref} at ${newHead.slice(0, 7)}; ${files.length ? `renumbered ${files.join(', ')} (${Object.entries(versions.packs).map(([n, v]) => `${n} ${v}`).join(', ')})` : 'no release file changed'}`);
  } catch (e) {
    // Any failure after the merge started (a malformed manifest, a write error) must leave the tree as it was found.
    return unresolved({ conflicts: [], error: e instanceof Error ? e.message : String(e) });
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) process.exit(main(process.argv.slice(2)));
