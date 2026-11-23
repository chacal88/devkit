// node --test plugins/compozy/skills/compozy-setup/scripts/role-shells.test.mjs
//
// Pins the four CompozyOS role shells (design.md D10, tasks.md phase 3): the frontmatter keys the
// CompozyOS daemon reads, the AC-5 no-polling rule on the `dev` shell, the AC-7 deferred-task rule
// on the `qa` shell and the archive steps on the `dev` shell, and that no shell holds a path
// specific to this repository.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const AGENTS_DIR = join(here, '..', 'templates', 'agents');

const ROLES = ['tech-lead', 'dev', 'qa', 'design'];

function shellPath(role) {
  return join(AGENTS_DIR, role, 'AGENT.md');
}

function shellText(role) {
  return readFileSync(shellPath(role), 'utf8');
}

function frontmatter(text) {
  const m = text.match(/^---\n(.*?)\n---\n(.*)$/s);
  assert.ok(m, 'AGENT.md must open with a --- frontmatter block');
  return { fm: m[1], body: m[2] };
}

// The frontmatter keys the daemon reads, taken from the pilot's shells (design.md phase 3).
const FRONTMATTER_KEYS = [
  'name',
  'display_name',
  'description',
  'provider',
  'permissions',
  'category_path',
  'accepts',
  'appearance',
];
const APPEARANCE_KEYS = ['version', 'avatar', 'icon', 'color', 'background'];

// Paths and commands that exist in only this repository: a shipped template must name none of
// them. `plugins/` on its own is also forbidden, since every shell is a CompozyOS role, not a
// Claude Code agent under a pack.
const REPO_SPECIFIC = [
  'plugins/openspec/hooks/',
  'scripts/check.py',
  'docs/openspec-flow.md',
  'docs/conventions.md',
  'docs/adr/',
  'plugins/',
];

for (const role of ROLES) {
  test(`AC-9 repo-adopts: the ${role} shell has every frontmatter key the daemon reads, and a body`, () => {
    const { fm, body } = frontmatter(shellText(role));
    for (const key of FRONTMATTER_KEYS) {
      assert.match(fm, new RegExp(`^${key}:`, 'm'), `frontmatter must declare ${key}`);
    }
    const appearanceStart = fm.indexOf('appearance:');
    assert.ok(appearanceStart >= 0, 'frontmatter must declare appearance');
    const appearanceBlock = fm.slice(appearanceStart);
    for (const key of APPEARANCE_KEYS) {
      assert.match(
        appearanceBlock,
        new RegExp(`^\\s+${key}:`, 'm'),
        `appearance must declare ${key}`,
      );
    }
    assert.equal(fm.match(/^name:\s*(\S+)$/m)[1], role, `name must be the role ${role}`);
    assert.ok(body.trim().length > 0, 'the shell must have a body');
  });
}

test('AC-9 repo-adopts: the design shell has its own icon and the same color as the other three', () => {
  const colors = ROLES.map((role) => frontmatter(shellText(role)).fm.match(/^\s*color:\s*"(#[0-9A-Fa-f]+)"$/m)[1]);
  assert.equal(new Set(colors).size, 1, 'every shell must share one color');
  const icons = ROLES.map((role) => frontmatter(shellText(role)).fm.match(/^\s*icon:\s*(\S+)$/m)[1]);
  assert.equal(new Set(icons).size, icons.length, 'every shell must have its own icon');
});

test('AC-5 ci-green: the dev shell names a CompozyOS pull-request monitor', () => {
  const text = shellText('dev');
  assert.match(text, /CompozyOS pull-request monitor/);
});

test('AC-5 ci-green: the dev shell forbids sleep, gh pr checks --watch, gh run watch and a polling loop by name', () => {
  const text = shellText('dev');
  assert.match(text, /Never wait\s+with `sleep`/);
  assert.match(text, /`gh pr checks --watch`/);
  assert.match(text, /`gh run watch`/);
  assert.match(text, /a\s+polling loop/);
});

test('AC-7 archive-cleanup: the qa shell keeps the deferred-task rule', () => {
  const text = shellText('qa');
  assert.match(
    text,
    /task the operator deferred by a dated decision recorded in `tasks\.md` is not a finding/,
  );
});

test('AC-7 archive-cleanup: the qa shell keeps the blocking-issue list', () => {
  const text = shellText('qa');
  assert.match(text, /Blocking issues:/);
  assert.match(text, /a task from `tasks\.md` not implemented/);
  assert.match(text, /a spec delta not honoured/);
  assert.match(text, /destructive Git/);
});

test('AC-7 archive-cleanup: the dev shell runs the ship-change archive steps and never merges by hand', () => {
  const text = shellText('dev');
  assert.match(text, /ship-change/);
  assert.match(text, /retro/);
  assert.match(text, /openspec archive/);
  assert.match(text, /roadmap\s+tick/);
  assert.match(text, /archive pull request/);
  assert.match(text, /reads\s+`archived`/);
  assert.match(text, /[Nn]ever merge(?:s)? (?:it|anything) (?:yourself|by hand)/);
});

// The one rule task 3.1 adds to the pilot's tech-lead shell, and the branch condition of the
// whole design gate depends on it: the plan declares the screens, and the structured result
// mirrors them (design D6).
test('AC-3 design-gate: the tech-lead shell declares the screens in proposal.md and mirrors them in its result', () => {
  const text = shellText('tech-lead');
  assert.match(text, /`## Screens`/);
  assert.match(text, /[Nn]ever a guess/);
  assert.match(text, /empty\s+array when the change touches no screen/);
});

// The rules task 3.4 gives the new design shell (design D5, D10).
test('AC-3 design-gate: the design shell reads the design: block, proposes rows with a mockup version and approves nothing', () => {
  const text = shellText('design');
  assert.match(text, /`design:` block/);
  assert.match(text, /mockup version/);
  assert.match(text, /screen-design/);
  assert.match(text, /screen-demo/);
  assert.match(text, /[Nn]ever approve your own proposal/);
  assert.match(text, /[Nn]o\s+product code, no test, no spec/);
});

for (const role of ROLES) {
  test(`AC-9 repo-adopts: the ${role} shell holds no path specific to one repository`, () => {
    const text = shellText(role);
    for (const needle of REPO_SPECIFIC) {
      assert.ok(!text.includes(needle), `${role}/AGENT.md must not contain ${JSON.stringify(needle)}`);
    }
  });
}

// stage-roles D-8 (spec compozy-kit-setup): each shell dispatches the devkit agent of its stage.
test('stage-roles kit: the tech-lead shell has the adr-author write decisions.md before the proposal', () => {
  const text = shellText('tech-lead').replace(/\s+/g, ' ');
  assert.match(text, /`devkit-core:adr-author`/);
  assert.match(text, /before the proposal/);
  assert.match(text, /`decisions\.md`/);
  assert.match(text, /`conduct-check` lists it among the missing plan files/);
});

test('stage-roles kit: the design shell has the screen-designer draw each screen under mock/ and write mockup.md', () => {
  const text = shellText('design').replace(/\s+/g, ' ');
  assert.match(text, /`devkit-core:screen-designer`/);
  assert.match(text, /`openspec\/changes\/<id>\/mock\/`/);
  assert.match(text, /`mockup\.md`/);
  assert.match(text, /`screen-mockup` skill/);
});

test('stage-roles kit: the qa shell has the test agents write the unit and E2E files and names the two blocking ids', () => {
  const text = shellText('qa').replace(/\s+/g, ' ');
  assert.match(text, /`devkit\.tests\.unit`/);
  assert.match(text, /`devkit-core:test-runner`/);
  assert.match(text, /`unit-tests\.md`/);
  assert.match(text, /`devkit\.tests\.e2e`/);
  assert.match(text, /`devkit-core:e2e-tester`/);
  assert.match(text, /`e2e-tests\.md`/);
  assert.match(text, /`unit_tests_red`/);
  assert.match(text, /`e2e_tests_red`/);
});

test('stage-roles kit: the dev shell has the tdd-implementer accept the records and the mock-up before the first phase', () => {
  const text = shellText('dev').replace(/\s+/g, ' ');
  assert.match(text, /`devkit-core:tdd-implementer`/);
  assert.match(text, /`decisions\.md` lists to accepted/);
  assert.match(text, /`Accepted by:`/);
  assert.match(text, /`mockup\.md`'s header to `result=passed`/);
});

test('stage-roles kit: the kit still ships exactly four shells', () => {
  const dirs = readdirSync(AGENTS_DIR).sort();
  assert.deepEqual(dirs, [...ROLES].sort());
});
