// node --test --test-name-pattern="^openspec-type-flag" plugins/openspec/hooks/validate-type.test.mjs
// openspec-type-flag: every validation of one change the packs' texts name is typed (`--type change`), and
// the repository's check keeps it so. Run by `node scripts/test-suite.mjs`, in a process of its own; alone:
// `node scripts/test-suite.mjs plugins/openspec/hooks/validate-type.test.mjs`.
// Invariant: the packs' texts and this repository's check keep every validation of one change typed.
// Layer: the shipped Markdown and YAML texts, and the real `openspec` CLI. Suite: validate-type.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { tmpFolder } from './test-tmp.mjs';
import { put } from './test-fixtures.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
// The tested command and the shipped text share these constants, so they cannot drift apart.
const TYPED = 'openspec validate <id> --type change --strict';
const TYPED_NI = `${TYPED} --no-interactive`;
const forChange = (cmd) => cmd.replace('<id>', '<change-id>');

const read = (rel) => readFileSync(join(REPO, rel), 'utf8');
const linesOf = (rel) => read(rel).split('\n');

test('openspec-type-flag AC-1 each file in scope names the typed command on its line and keeps no fallback', () => {
  const files = {
    reviewer: 'plugins/core/agents/plan-readiness-reviewer.md',
    planner: 'plugins/core/agents/change-planner.md',
    validator: 'plugins/openspec/agents/openspec-validator.md',
    readiness: 'plugins/core/skills/plan-readiness-review/SKILL.md',
    review: 'plugins/core/skills/review-change/SKILL.md',
    full: 'plugins/openspec/schemas/devkit/schema.yaml',
    lite: 'plugins/openspec/schemas/devkit-lite/schema.yaml',
  };
  const wholeLines = [
    [files.reviewer, `3. Run \`${TYPED}\` when the project uses OpenSpec, and count its errors as findings.`],
    [files.validator, `1. **CLI validation.** Run \`${forChange(TYPED)}\` and report the result verbatim. Its verdict is final — never override it.`],
    [files.validator, `- ${forChange(TYPED)}: PASS | FAIL`],
    [files.readiness, `OpenSpec: validate first with \`${TYPED_NI}\`. Otherwise, do the structural checks by hand.`],
    [files.review, `- OpenSpec repo with a change id: \`${TYPED_NI}\`.`],
  ];
  for (const [rel, line] of wholeLines) {
    assert.ok(linesOf(rel).includes(line), `${rel} holds the line: ${line}`);
  }
  const planner = linesOf(files.planner);
  const fragments = [
    `setting \`result=passed\` once \`${TYPED}\` passes.`,
    `in OpenSpec mode also \`${forChange(TYPED)}\`)`,
  ];
  for (const fragment of fragments) {
    assert.ok(planner.some((l) => l.endsWith(fragment) || l.includes(fragment)), `${files.planner} holds: ${fragment}`);
  }
  const gate = `      Gate: \`${TYPED}\` passes.`;
  assert.equal(linesOf(files.full).filter((l) => l === gate).length, 4, 'devkit schema: four typed Gate lines');
  assert.equal(linesOf(files.lite).filter((l) => l === gate).length, 3, 'devkit-lite schema: three typed Gate lines');
  const banned = ['lacks those flags', 'when the CLI supports them', '`openspec validate <id> --strict`', '`openspec validate <change-id> --strict`', '`openspec validate <change-id>`'];
  for (const rel of Object.values(files)) {
    const text = read(rel);
    for (const b of banned) assert.ok(!text.includes(b), `${rel} no longer holds: ${b}`);
  }
});

const MD = (...lines) => `${lines.join('\n')}\n`;

test('openspec-type-flag AC-2 a change and a spec with one id: the bare form is ambiguous, the typed forms validate the change', () => {
  const root = tmpFolder('devkit-validate-same-');
  put(root, {
    'openspec/config.yaml': 'schema: spec-driven\n',
    'openspec/changes/same/.openspec.yaml': 'schema: spec-driven\n',
    'openspec/changes/same/proposal.md': MD('# Proposal', '', '## Why', '', 'The thing needs to work in a new way, which this sentence explains at enough length.', '', '## What Changes', '', '- The thing works differently.'),
    'openspec/changes/same/specs/cap/spec.md': MD('## ADDED Requirements', '', '### Requirement: Thing works', 'The system SHALL make the thing work.', '', '#### Scenario: It works', '- **WHEN** the thing runs', '- **THEN** it works'),
    'openspec/specs/same/spec.md': MD('# same Specification', '', '## Purpose', 'The same capability exists so that the ambiguity of one id can be shown by the test.', '', '## Requirements', '', '### Requirement: Thing exists', 'The system SHALL have the thing.', '', '#### Scenario: It exists', '- **WHEN** the thing is asked for', '- **THEN** it exists'),
  });
  const run = (args) => spawnSync('openspec', args, { cwd: root, env: process.env, encoding: 'utf8' });
  const bare = run(['validate', 'same', '--strict', '--json']);
  assert.equal(bare.status, 1, bare.stdout + bare.stderr);
  assert.equal(JSON.parse(bare.stdout).status[0].code, 'ambiguous_item');
  for (const typed of [TYPED, TYPED_NI]) {
    const args = typed.replace('<id>', 'same').split(' ').slice(1);
    const r = run(args);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.ok(r.stdout.includes("Change 'same' is valid"), r.stdout);
  }
});

const CHECK_PY = join(REPO, 'scripts', 'check.py');

// Writes `files` into a new scratch root and runs the repository check on it, as `guard.test.mjs` does.
function lint(files) {
  const root = tmpFolder('devkit-validate-type-');
  put(root, files);
  const r = spawnSync('python3', [CHECK_PY, '--root', root], { encoding: 'utf8' });
  return { code: r.status, out: r.stdout + r.stderr };
}

// A frontmatter of four lines, so `check_assets` reports nothing and body line k is file line 4 + k.
const frontmatter = (name) => ['---', `name: ${name}`, 'description: Checks the fixture. Use when testing.', '---'];
const agent = (name, ...body) => `${[...frontmatter(name), ...body].join('\n')}\n`;
const skill = agent;

// The sorted `path:line` of each refused command in the check's output.
const refused = (out) =>
  out
    .split('\n')
    .map((l) => l.match(/^(\S+):(\d+): openspec validate names an id without --type change/))
    .filter(Boolean)
    .map((m) => `${m[1]}:${m[2]}`)
    .sort();

const BARE = 'openspec validate <id> --strict';
const FENCE = '```';
const SCHEMA = (line) => `${['artifacts:', '  - id: p', '    instruction: |', line].join('\n')}\n`;

test('openspec-type-flag AC-3 the bare form in a backtick span of an agent is refused, naming the file and the line', () => {
  const r = lint({
    'plugins/demo/agents/a.md': agent('a', 'text', `3. Run \`${BARE}\` when the project uses OpenSpec.`),
  });
  assert.equal(r.code, 1, r.out);
  assert.deepEqual(refused(r.out), ['plugins/demo/agents/a.md:6']);
});

test('openspec-type-flag AC-3 a bare line inside a fenced block is refused, and an unclosed fence runs to the end of the file', () => {
  const r = lint({
    'plugins/demo/agents/a.md': agent('a', FENCE, '- openspec validate <change-id> --strict: PASS | FAIL', FENCE),
    'plugins/demo/agents/b.md': agent('b', FENCE, 'x', BARE),
  });
  assert.equal(r.code, 1, r.out);
  assert.deepEqual(refused(r.out), ['plugins/demo/agents/a.md:6', 'plugins/demo/agents/b.md:7']);
});

test('openspec-type-flag AC-3 a line with the typed form and a fallback is refused once, and so is a bare command after a typed one', () => {
  const r = lint({
    'plugins/demo/skills/s/SKILL.md': skill(
      's',
      `validate with \`${TYPED}\` (or \`${BARE}\` if old)`,
      FENCE,
      'openspec validate a --type change --strict && openspec validate b --strict',
      FENCE,
    ),
  });
  assert.equal(r.code, 1, r.out);
  assert.deepEqual(refused(r.out), ['plugins/demo/skills/s/SKILL.md:5', 'plugins/demo/skills/s/SKILL.md:7']);
});

test("openspec-type-flag AC-3 every kind of file is read: a pack schema and its template, the openspec/schemas copy, the kit's agent template and the .compozy copy", () => {
  const span = `\`${BARE}\``;
  const files = {
    'plugins/demo/schemas/x/schema.yaml': SCHEMA(`      Gate: ${span} passes.`),
    'plugins/demo/schemas/x/templates/proposal.md': `# P\n\nRun ${span} first.\n`,
    'openspec/schemas/x/schema.yaml': SCHEMA(`      Gate: ${span} passes.`),
    'plugins/compozy/kit/templates/agents/r/AGENT.md': agent('r', 'one', 'two', `Run ${span}.`),
    '.compozy/agents/r/AGENT.md': agent('r', `Run ${span}.`),
  };
  const r = lint(files);
  assert.equal(r.code, 1, r.out);
  assert.deepEqual(refused(r.out), [
    '.compozy/agents/r/AGENT.md:5',
    'openspec/schemas/x/schema.yaml:4',
    'plugins/compozy/kit/templates/agents/r/AGENT.md:7',
    'plugins/demo/schemas/x/schema.yaml:4',
    'plugins/demo/schemas/x/templates/proposal.md:3',
  ]);
});

test('openspec-type-flag AC-3 the typed form passes, its flags in any order, in a span and in a fence', () => {
  const flagsFirst = 'openspec validate <id> --strict --type change --json';
  const spans = [TYPED, TYPED_NI, flagsFirst].map((c) => `Run \`${c}\`.`);
  const r = lint({
    'plugins/demo/agents/a.md': agent('a', ...spans, FENCE, flagsFirst, TYPED, FENCE),
    'plugins/demo/skills/s/SKILL.md': skill('s', ...spans, FENCE, TYPED_NI, FENCE),
    'plugins/demo/schemas/x/schema.yaml': SCHEMA(`      Gate: \`${TYPED}\` passes.`),
  });
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /all checks passed/);
});

test('openspec-type-flag AC-3 a command that names no id passes: --all, the bare name, a flag first', () => {
  const lines = ['`openspec validate --all --strict`', '`openspec validate` rejects a change', '`openspec validate --strict` fails'];
  const r = lint({
    'plugins/demo/agents/a.md': agent('a', ...lines),
    'plugins/demo/schemas/x/schema.yaml': SCHEMA(`      Gate: ${lines[0]} passes.`),
  });
  assert.equal(r.code, 0, r.out);
});

test('openspec-type-flag AC-3 prose outside code passes, so do a lone backtick and an empty file', () => {
  const r = lint({
    'plugins/demo/agents/a.md': agent('a', `${BARE} is old`, `a lone \` then ${BARE}`),
    'plugins/demo/schemas/x/templates/empty.md': '',
  });
  assert.equal(r.code, 0, r.out);
});

test('openspec-type-flag AC-3 files of other kinds pass: docs, the READMEs, a change folder and a fixtures path', () => {
  const body = `Run \`${BARE}\`.\n`;
  const r = lint({
    'docs/roles.md': body,
    'README.md': body,
    'plugins/demo/README.md': body,
    'openspec/changes/x/tasks.md': body,
    'openspec/changes/archive/2026-01-01-x/proposal.md': body,
    'plugins/demo/skills/s/scripts/fixtures/schemas-0.13.0/devkit/templates/proposal.md': body,
  });
  assert.equal(r.code, 0, r.out);
});

test("openspec-type-flag AC-3 the repository's own files pass the check", () => {
  const r = spawnSync('python3', [CHECK_PY], { cwd: REPO, encoding: 'utf8' });
  assert.deepEqual(refused(r.stdout + r.stderr), []);
});
