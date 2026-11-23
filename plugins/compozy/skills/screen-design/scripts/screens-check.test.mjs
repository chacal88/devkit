// node --test plugins/compozy/skills/screen-design/scripts/screens-check.test.mjs
//
// Pins the mechanical half of the design gate (design D5, AC-3 design-gate, AC-4 screens-check):
// exit 0 when every screen a change declares is a row of the project's screen map and the map
// carries a valid Mockup: line, or when there is nothing to check (no screens, no design: block);
// exit 1 naming what is missing; exit 3 on a setup error.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, chmodSync, symlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpFolder } from '../../test-tmp.mjs';
import { main, parseDesign, parseScreens, mapIds, mockupLine, isVersionOrDate } from './screens-check.mjs';

const here = dirname(fileURLToPath(import.meta.url));

function tmp() {
  return tmpFolder('devkit-screens-check-');
}

function write(root, rel, body) {
  const path = join(root, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body);
  return path;
}

// A real-project-shaped map (design D5: the pilot project's own format): a short intro, a table
// whose first cell is the screen id, and a "Mockup:" line with a version.
const REAL_MAP = `# Screen map

Every screen this project ships, with the mockup that currently describes it.

Mockup: v3

| Id | Screen | Shows & allows | Stage | Mockup detail |
|---|---|---|---|---|
| chat-list | Chat list | The open conversations, unread counts, opens a thread | implemented | high-fidelity |
| chat-thread | Chat thread | Messages, the composer, sends and receives | implemented | high-fidelity |
| settings | Settings | Profile, notifications, sign-out | mocked | wireframe |
`;

function project(root, { screens = ['chat-list', 'chat-thread'], map = REAL_MAP, designBlock = true, change = 'demo-change' } = {}) {
  const screensSection = screens.length
    ? `## Screens\n\n${screens.map((s) => `- \`${s}\` — ${s} screen`).join('\n')}\n`
    : `## Screens\n\nNone. This project has no browser surface in scope for this change.\n`;
  write(root, `openspec/changes/${change}/proposal.md`, `# Proposal\n\n${screensSection}`);
  const config = designBlock
    ? `schema: devkit-lite\n\ndesign:\n  screen_map: docs/design/screen-map.md\n  mockup: Figma\n`
    : `schema: devkit-lite\n`;
  write(root, 'openspec/config.yaml', config);
  if (map !== null) write(root, 'docs/design/screen-map.md', map);
  return root;
}

function run(root, args) {
  return main(args, process.env, root);
}

// ---------------------------------------------------------------- parsing helpers

test('AC-4 screens-check: parseDesign reads screen_map and mockup from the design: block', () => {
  const design = parseDesign('schema: devkit-lite\n\ndesign:\n  screen_map: docs/design/screen-map.md\n  mockup: Figma\n');
  assert.deepEqual(design, { screen_map: 'docs/design/screen-map.md', mockup: 'Figma' });
});

test('AC-4 screens-check: parseDesign returns null with no design: block', () => {
  assert.equal(parseDesign('schema: devkit-lite\nship:\n  devkit-lite: merge\n'), null);
});

test('AC-4 screens-check: parseDesign reads screen_map alone, mockup stays null', () => {
  const design = parseDesign('design:\n  screen_map: docs/design/screen-map.md\n');
  assert.deepEqual(design, { screen_map: 'docs/design/screen-map.md', mockup: null });
});

test('AC-4 screens-check: parseScreens reads list items, strips backticks and the em-dash description', () => {
  const text = '## Screens\n\n- `chat-list` — the conversation list\n- chat-thread\n* `settings` — profile and sign-out\n';
  assert.deepEqual(parseScreens(text), ['chat-list', 'chat-thread', 'settings']);
});

test('AC-4 screens-check: parseScreens returns no ids for prose under ## Screens', () => {
  const text = '## Screens\n\nNone. This repository has no browser surface in scope.\n';
  assert.deepEqual(parseScreens(text), []);
});

test('AC-4 screens-check: parseScreens returns no ids with no ## Screens section at all', () => {
  assert.deepEqual(parseScreens('# Proposal\n\n## What changes\n\nSomething.\n'), []);
});

test('AC-4 screens-check: parseScreens stops at the next ## section', () => {
  const text = '## Screens\n\n- chat-list\n\n## Open questions\n\n- not-a-screen\n';
  assert.deepEqual(parseScreens(text), ['chat-list']);
});

test('AC-4 screens-check: mapIds reads the first cell of every row, skipping the separator row', () => {
  const ids = mapIds(REAL_MAP);
  assert.ok(ids.has('chat-list'));
  assert.ok(ids.has('chat-thread'));
  assert.ok(ids.has('settings'));
  assert.ok(!ids.has('---'));
});

test('AC-4 screens-check: mockupLine finds a "Mockup:" line and isVersionOrDate validates it', () => {
  assert.equal(mockupLine(REAL_MAP), 'v3');
  assert.ok(isVersionOrDate('v3'));
  assert.ok(isVersionOrDate('1.2.0'));
  assert.ok(isVersionOrDate('2026-11-14'));
  assert.ok(!isVersionOrDate('Figma'));
});

test('AC-4 screens-check: mockupLine returns null with no "Mockup:" line', () => {
  assert.equal(mockupLine('| Id | Screen |\n|---|---|\n| chat-list | Chat list |\n'), null);
});

// ---------------------------------------------------------------- the CLI, over fixtures

test('AC-4 screens-check: every declared id mapped with a valid Mockup: line exits 0', () => {
  const root = project(tmp());
  const r = run(root, ['--change', 'demo-change']);
  assert.equal(r.code, 0);
  assert.match(r.stdout, /pass/);
});

test('AC-4 screens-check: one declared id missing from the map exits 1, naming it', () => {
  const root = project(tmp(), { screens: ['chat-list', 'not-mapped'] });
  const r = run(root, ['--change', 'demo-change']);
  assert.equal(r.code, 1);
  assert.match(r.stdout, /not-mapped/);
});

test('AC-4 screens-check: a map with no valid Mockup: version exits 1', () => {
  const badMap = REAL_MAP.replace('Mockup: v3\n', '');
  const root = project(tmp(), { map: badMap });
  const r = run(root, ['--change', 'demo-change']);
  assert.equal(r.code, 1);
  assert.match(r.stdout, /Mockup/);
});

test('AC-4 screens-check: a Mockup: line that is neither a version nor a date exits 1', () => {
  const badMap = REAL_MAP.replace('Mockup: v3\n', 'Mockup: Figma\n');
  const root = project(tmp(), { map: badMap });
  const r = run(root, ['--change', 'demo-change']);
  assert.equal(r.code, 1);
  assert.match(r.stdout, /Mockup/);
});

test('AC-4 screens-check: no ## Screens section (prose only) exits 0, a no-op', () => {
  const root = project(tmp(), { screens: [] });
  const r = run(root, ['--change', 'demo-change']);
  assert.equal(r.code, 0);
  const json = run(root, ['--change', 'demo-change', '--json']);
  assert.equal(JSON.parse(json.stdout).noop, true);
});

test('AC-4 screens-check: no design: block exits 0, a no-op, even with declared screens', () => {
  const root = project(tmp(), { designBlock: false, map: null });
  const r = run(root, ['--change', 'demo-change']);
  assert.equal(r.code, 0);
  const json = run(root, ['--change', 'demo-change', '--json']);
  assert.equal(JSON.parse(json.stdout).noop, true);
  assert.equal(JSON.parse(json.stdout).designConfigured, false);
});

test('AC-4 screens-check: a design: block with no screen_map key exits 3', () => {
  const root = tmp();
  write(root, 'openspec/changes/demo-change/proposal.md', '# Proposal\n\n## Screens\n\n- chat-list\n');
  write(root, 'openspec/config.yaml', 'design:\n  mockup: Figma\n');
  const r = run(root, ['--change', 'demo-change']);
  assert.equal(r.code, 3);
});

test('AC-4 screens-check: a design: block naming a path that does not exist exits 3 (pointing nowhere)', () => {
  const root = tmp();
  write(root, 'openspec/changes/demo-change/proposal.md', '# Proposal\n\n## Screens\n\n- chat-list\n');
  write(root, 'openspec/config.yaml', 'design:\n  screen_map: docs/design/nowhere.md\n');
  const r = run(root, ['--change', 'demo-change']);
  assert.equal(r.code, 3);
  assert.match(r.stderr, /nowhere\.md/);
});

test('AC-4 screens-check: an unreadable map (a directory at the screen_map path) exits 3', () => {
  const root = project(tmp(), { map: null });
  mkdirSync(join(root, 'docs', 'design', 'screen-map.md'), { recursive: true });
  const r = run(root, ['--change', 'demo-change']);
  assert.equal(r.code, 3);
});

test('AC-4 screens-check: an unreadable map (no read permission) exits 3', { skip: process.platform === 'win32' || process.getuid?.() === 0 }, () => {
  const root = project(tmp());
  chmodSync(join(root, 'docs', 'design', 'screen-map.md'), 0o000);
  try {
    const r = run(root, ['--change', 'demo-change']);
    assert.equal(r.code, 3);
  } finally {
    chmodSync(join(root, 'docs', 'design', 'screen-map.md'), 0o644);
  }
});

test('AC-4 screens-check: an unknown change exits 3', () => {
  const root = project(tmp());
  const r = run(root, ['--change', 'no-such-change']);
  assert.equal(r.code, 3);
  assert.match(r.stderr, /no-such-change/);
});

test('AC-4 screens-check: --json prints the verdict shape', () => {
  const root = project(tmp());
  const r = run(root, ['--change', 'demo-change', '--json']);
  const body = JSON.parse(r.stdout);
  assert.deepEqual(body, {
    version: 1,
    change: 'demo-change',
    screens: ['chat-list', 'chat-thread'],
    designConfigured: true,
    screenMap: 'docs/design/screen-map.md',
    mockupTool: 'Figma',
    mapped: ['chat-list', 'chat-thread'],
    missing: [],
    mapMockup: 'v3',
    mapMockupOk: true,
    noop: false,
    pass: true,
  });
});

test('AC-4 screens-check: --json on a setup error prints {version, error} and still exits 3', () => {
  const root = project(tmp());
  const r = run(root, ['--change', 'no-such-change', '--json']);
  assert.equal(r.code, 3);
  const body = JSON.parse(r.stdout);
  assert.equal(body.version, 1);
  assert.match(body.error, /no-such-change/);
});

// ---------------------------------------------------------------- AC-4 screens-check: parseArgs's negative half

// parseArgs's negative half (round 2, important): an unknown option, a --change with no value,
// and the ., .. and archive exclusions that keep the checker inside one change folder - none of
// it had a test, so loosening the regex or dropping the exclusion list stayed green. Every
// fixture below is an empty project (no openspec/ at all, or in the archive case a fixture that
// would read as pass if the exclusion were missing); the asserted stderr text is parseArgs's own
// message, which is reachable only before compute() ever looks at a file, so a different message
// (an "unknown change" error, for instance) would mean the bad argument slipped through and
// something under openspec/ outside the change folder got read.

test('AC-4 screens-check: an unknown option exits 3, naming it', () => {
  const root = tmp();
  const r = run(root, ['--bogus', '--change', 'demo-change']);
  assert.equal(r.code, 3);
  assert.match(r.stderr, /unknown option --bogus/);
});

test('AC-4 screens-check: --change with no value following exits 3', () => {
  const root = tmp();
  const r = run(root, ['--change']);
  assert.equal(r.code, 3);
  assert.match(r.stderr, /--change expects a change id, not ""/);
});

test('AC-4 screens-check: --change= with an empty value exits 3', () => {
  const root = tmp();
  const r = run(root, ['--change=']);
  assert.equal(r.code, 3);
  assert.match(r.stderr, /--change expects a change id, not ""/);
});

test('AC-4 screens-check: no --change at all exits 3 with the usage message', () => {
  const root = tmp();
  const r = run(root, []);
  assert.equal(r.code, 3);
  assert.match(r.stderr, /usage: screens-check --change <id> \[--json\]/);
});

test('AC-4 screens-check: --change . exits 3, naming it, not a path lookup', () => {
  const root = tmp();
  const r = run(root, ['--change', '.']);
  assert.equal(r.code, 3);
  assert.match(r.stderr, /--change expects a change id, not "\."/);
});

test('AC-4 screens-check: --change .. exits 3, naming it, not a path lookup', () => {
  const root = tmp();
  const r = run(root, ['--change', '..']);
  assert.equal(r.code, 3);
  assert.match(r.stderr, /--change expects a change id, not "\.\."/);
});

// The regex itself, not just the exclusion list: a change id starts with a letter or a digit and
// holds no path separator, so neither a traversal nor a dotfile name can reach compute() and send
// it reading outside openspec/changes/<id>/. Dropping the leading-character class leaves the three
// exclusions above green, so these two cases are what pins it.
test('AC-4 screens-check: --change with a path separator exits 3, never a traversal', () => {
  const root = tmp();
  const r = run(root, ['--change', '../other-change']);
  assert.equal(r.code, 3);
  assert.match(r.stderr, /--change expects a change id, not "\.\.\/other-change"/);
});

test('AC-4 screens-check: --change not starting with a letter or a digit exits 3', () => {
  const root = tmp();
  for (const bad of ['.hidden', '-x', '_tmp']) {
    const r = run(root, ['--change', bad]);
    assert.equal(r.code, 3, `${bad} must be refused`);
    assert.match(r.stderr, /--change expects a change id/);
  }
});

test('AC-4 screens-check: --change archive exits 3, even when openspec/changes/archive/ holds a real proposal.md', () => {
  const root = tmp();
  // Shaped like the real OpenSpec archive folder: if the exclusion were dropped, compute() would
  // happily treat this as a change named "archive" and read this very file.
  write(root, 'openspec/changes/archive/proposal.md', '# Proposal\n\n## Screens\n\n- chat-list\n');
  const r = run(root, ['--change', 'archive']);
  assert.equal(r.code, 3);
  assert.match(r.stderr, /--change expects a change id, not "archive"/);
});

// ---------------------------------------------------------------- AC-3 design-gate: the format the gate requires

test('AC-3 design-gate: a map shaped like a real project\'s screen map (a table + a Mockup: line) is exactly what the gate reads', () => {
  const root = project(tmp());
  const r = run(root, ['--change', 'demo-change', '--json']);
  const body = JSON.parse(r.stdout);
  assert.equal(body.pass, true);
  assert.deepEqual(body.mapped, ['chat-list', 'chat-thread']);
  assert.equal(body.mapMockup, 'v3');
});

test('AC-3 design-gate: adding a screen to ## Screens without a matching row fails the same gate the loop runs', () => {
  const root = project(tmp(), { screens: ['chat-list', 'chat-thread', 'new-screen'] });
  const r = run(root, ['--change', 'demo-change']);
  assert.equal(r.code, 1);
  assert.match(r.stdout, /new-screen/);
});
