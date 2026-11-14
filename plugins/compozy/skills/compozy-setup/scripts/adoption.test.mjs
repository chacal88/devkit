// node --test plugins/compozy/skills/compozy-setup/scripts/adoption.test.mjs
//
// Pins AC-9 (repo-adopts, proposal.md): this repository's own `.compozy/` is nothing but the
// kit's templates plus this repository's substitution values. Each assertion below builds the
// expected text by rendering a template against the values this repository actually has — read
// from `templates/substitutions.json`'s defaults, the same file `compozy-setup` reads to install
// the templates, with the two values this repository overrides (`__VERIFY_COMMAND__` and
// `__TIMEZONE__`) — then compares it to the installed file byte for byte. A render-then-compare,
// never a line-by-line heuristic: a hand-edit of the installed copy that drifts from the template
// in any way, placeholder or not, fails this test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(here, '..', 'templates');
const SUBSTITUTIONS_PATH = join(TEMPLATES_DIR, 'substitutions.json');
// here = plugins/compozy/skills/compozy-setup/scripts; five levels up is the repository root.
const REPO_ROOT = join(here, '..', '..', '..', '..', '..');
const COMPOZY_DIR = join(REPO_ROOT, '.compozy');

const ROLES = ['tech-lead', 'dev', 'qa', 'design'];

// The one source both compozy-setup and this test read, so neither can drift from the other
// (design D13, task 1.3).
const substitutions = JSON.parse(readFileSync(SUBSTITUTIONS_PATH, 'utf8'));
const defaults = Object.fromEntries(
  Object.entries(substitutions.placeholders).map(([token, spec]) => [token, spec.default]),
);

// This repository's values for the placeholders it overrides (D13, task 6.1-6.3). Every other
// placeholder keeps the default `substitutions.json` names (the four agent ids already match
// this repository's role names; `__DEMO_COMMAND__`, `__DEMO_URL__`, `__SCREEN_MAP__` and
// `__MOCKUP__` stay empty: this repository has no browser surface and no `design:` block).
const REPO_VALUES = {
  ...defaults,
  __VERIFY_COMMAND__: 'python3 scripts/gen-catalog.py --check && python3 scripts/check.py',
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

function readTemplate(...segments) {
  return readFileSync(join(TEMPLATES_DIR, ...segments), 'utf8');
}

function readInstalled(...segments) {
  return readFileSync(join(COMPOZY_DIR, ...segments), 'utf8');
}

// The non-role files: template path segments relative to templates/, installed path segments
// relative to .compozy/.
const RENDERED_FILES = [
  { label: 'loops/openspec-change/loop.yaml', template: ['loops', 'openspec-change', 'loop.yaml'], installed: ['loops', 'openspec-change', 'loop.yaml'] },
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

for (const role of ROLES) {
  test(`AC-9 repo-adopts: the ${role} shell is the shipped template, byte for byte`, () => {
    const templateText = readTemplate('agents', role, 'AGENT.md');
    const expected = render(templateText, REPO_VALUES);
    const actual = readInstalled('agents', role, 'AGENT.md');
    assert.equal(actual, expected);
  });
}

test('AC-9 repo-adopts: the four role shells are the shipped ones, installed for every role', () => {
  for (const role of ROLES) {
    const templateText = readTemplate('agents', role, 'AGENT.md');
    const actual = readInstalled('agents', role, 'AGENT.md');
    assert.equal(actual, render(templateText, REPO_VALUES), `agents/${role}/AGENT.md must be the shipped shell`);
  }
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
