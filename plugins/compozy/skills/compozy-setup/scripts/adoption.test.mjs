// node --test plugins/compozy/skills/compozy-setup/scripts/adoption.test.mjs
//
// Pins AC-9 (repo-adopts, proposal.md): this repository's own `.compozy/` is nothing but the
// kit's templates plus this repository's substitution values. Each assertion below builds the
// expected text by rendering a template against the values this repository actually has — read
// from `templates/substitutions.json`'s defaults, the same file `compozy-setup` reads to install
// the templates, with the one value this repository overrides (`__TIMEZONE__`) — then compares it
// to the installed file byte for byte. A render-then-compare, never a line-by-line heuristic: a
// hand-edit of the installed copy that drifts from the template in any way, placeholder or not,
// fails this test. The kit is the twenty-one agents, the three loops, `config.toml`, `README.md` and
// `bin/devkit-kit` (compozy-driver D-10); none of the five files of the old kit is installed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(here, '..', 'templates');
const SUBSTITUTIONS_PATH = join(TEMPLATES_DIR, 'substitutions.json');
// here = plugins/compozy/skills/compozy-setup/scripts; five levels up is the repository root.
const REPO_ROOT = join(here, '..', '..', '..', '..', '..');
const COMPOZY_DIR = join(REPO_ROOT, '.compozy');

// The agents are the folders of templates/agents, the loops the folders of templates/loops: what
// the installer lists at run time. gen-agents.test.mjs owns the set of agents itself.
const AGENTS = readdirSync(join(TEMPLATES_DIR, 'agents')).sort();
const LOOPS = readdirSync(join(TEMPLATES_DIR, 'loops')).sort();
const RETIRED = ['agents/tech-lead/AGENT.md', 'agents/dev/AGENT.md', 'agents/qa/AGENT.md', 'agents/design/AGENT.md', 'loops/openspec-change/loop.yaml'];

// The one source both compozy-setup and this test read, so neither can drift from the other.
const substitutions = JSON.parse(readFileSync(SUBSTITUTIONS_PATH, 'utf8'));
const defaults = Object.fromEntries(
  Object.entries(substitutions.placeholders).map(([token, spec]) => [token, spec.default]),
);

// This repository's values for the placeholders it overrides. Every other placeholder keeps the
// default `substitutions.json` names (`__SCREEN_MAP__` and `__MOCKUP__` stay empty: this
// repository has no browser surface and no `design:` block).
const REPO_VALUES = {
  ...defaults,
  __TIMEZONE__: 'America/Sao_Paulo',
};

function render(template, values) {
  return template.replace(/__[A-Z_]+__/g, (token) => {
    if (!(token in values)) {
      throw new Error(`adoption.test.mjs: no substitution value for ${token}`);
    }
    return values[token];
  });
}

const readTemplate = (...segments) => readFileSync(join(TEMPLATES_DIR, ...segments), 'utf8');
const readInstalled = (...segments) => readFileSync(join(COMPOZY_DIR, ...segments), 'utf8');

// The files that carry a placeholder or may: template path segments relative to templates/,
// installed path segments relative to .compozy/.
const RENDERED_FILES = [
  ...LOOPS.map((name) => ({ label: `loops/${name}/loop.yaml`, template: ['loops', name, 'loop.yaml'], installed: ['loops', name, 'loop.yaml'] })),
  { label: 'config.toml', template: ['config.toml'], installed: ['config.toml'] },
  { label: 'README.md', template: ['README.md'], installed: ['README.md'] },
];

for (const file of RENDERED_FILES) {
  test(`AC-9 repo-adopts: the rendered template equals the installed ${file.label}, byte for byte`, () => {
    const templateText = readTemplate(...file.template);
    const expected = render(templateText, REPO_VALUES);
    const actual = readInstalled(...file.installed);
    assert.equal(actual, expected);
  });
}

test('AC-9 repo-adopts: the kit holds the three loops and twenty-one agents, and the loops are the ones of D-5, D-6 and D-7', () => {
  assert.deepEqual(LOOPS, ['devkit-change', 'devkit-review', 'devkit-roadmap']);
  assert.equal(AGENTS.length, 21);
  assert.deepEqual(readdirSync(join(COMPOZY_DIR, 'loops')).sort(), LOOPS, 'only the three loops are installed');
});

for (const role of AGENTS) {
  test(`AC-9 repo-adopts: the ${role} agent is the shipped template, byte for byte`, () => {
    const templateText = readTemplate('agents', role, 'AGENT.md');
    const expected = render(templateText, REPO_VALUES);
    const actual = readInstalled('agents', role, 'AGENT.md');
    assert.equal(actual, expected);
  });
}

test('AC-9 repo-adopts: the installed agents are exactly the shipped ones, and no file of the old kit is installed', () => {
  assert.deepEqual(readdirSync(join(COMPOZY_DIR, 'agents')).sort(), AGENTS);
  for (const file of RETIRED) assert.equal(existsSync(join(COMPOZY_DIR, file)), false, `${file} is not installed`);
  for (const folder of ['agents/tech-lead', 'agents/dev', 'agents/qa', 'agents/design', 'loops/openspec-change']) {
    assert.equal(existsSync(join(COMPOZY_DIR, folder)), false, `${folder} is gone`);
  }
});

test('AC-9 repo-adopts: the manifest records this repository\'s three inputs and a digest for every kit file, and none for a retired one', () => {
  const manifest = JSON.parse(readInstalled('kit-manifest.json'));
  assert.equal(manifest.version, 1);
  assert.deepEqual(Object.keys(manifest.inputs).sort(), Object.keys(REPO_VALUES).sort());
  for (const [token, value] of Object.entries(REPO_VALUES)) assert.equal(manifest.inputs[token], value, token);
  const kit = ['README.md', 'bin/devkit-kit', 'config.toml', ...AGENTS.map((r) => `agents/${r}/AGENT.md`), ...LOOPS.map((n) => `loops/${n}/loop.yaml`)];
  assert.deepEqual(Object.keys(manifest.files).sort(), kit.sort());
  for (const file of RETIRED) assert.equal(file in manifest.files, false, `${file} has no digest`);
});

test('AC-9 repo-adopts: .compozy/bin/devkit-kit is the shipped resolver, verbatim (no placeholder)', () => {
  const templateText = readTemplate('bin', 'devkit-kit');
  const actual = readInstalled('bin', 'devkit-kit');
  assert.equal(actual, templateText);
});

test('AC-9 repo-adopts: .compozy/bin/devkit-kit is executable', () => {
  const mode = statSync(join(COMPOZY_DIR, 'bin', 'devkit-kit')).mode;
  assert.ok((mode & 0o111) !== 0, 'devkit-kit must be executable');
});

test('AC-9 repo-adopts: the installed default agent is change-coordinator, an agent of the kit', () => {
  assert.match(readInstalled('config.toml'), /^agent = "change-coordinator"$/m);
  assert.ok(AGENTS.includes('change-coordinator'));
});
