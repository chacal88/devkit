// node --test plugins/compozy/skills/compozy-setup/scripts/loop-template.test.mjs
//
// Pins design D2 (the graph: seventeen nodes, eighteen edges), D3 (the design branch and the
// skip edges that make it free), D7 (waiting is a monitor, never a shell) and D8 (the loop ends
// at archived, and the cleanup can fail without failing the run) against the shipped loop
// template. No YAML library is vendored here (none exists elsewhere in this repository), so the
// template's own stable indentation is the parser: every assertion below is a regex anchored on
// the exact indent level `templates/loops/openspec-change/loop.yaml` uses, not a loose scan of
// the raw bytes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = join(here, '..', 'templates', 'loops', 'openspec-change', 'loop.yaml');
const text = readFileSync(TEMPLATE, 'utf8');

// The node ids and order design D2 fixes.
const EXPECTED_NODE_IDS = [
  'propose',
  'approve_plan',
  'touches_screens',
  'design',
  'screens_ok',
  'implement',
  'review',
  'verify',
  'has_demo',
  'demo',
  'deliver',
  'ci_fix',
  'checks_green',
  'await_merge',
  'merged',
  'archive',
  'cleanup',
];

// The eighteen edges of design D2, including the two skip edges (approve_plan -> implement,
// verify -> deliver) that let the design and demo stages stay optional.
const EXPECTED_EDGES = [
  ['propose', 'approve_plan'],
  ['approve_plan', 'touches_screens'],
  ['approve_plan', 'implement'],
  ['touches_screens', 'design'],
  ['design', 'screens_ok'],
  ['screens_ok', 'implement'],
  ['implement', 'review'],
  ['review', 'verify'],
  ['verify', 'has_demo'],
  ['verify', 'deliver'],
  ['has_demo', 'demo'],
  ['demo', 'deliver'],
  ['deliver', 'ci_fix'],
  ['ci_fix', 'checks_green'],
  ['checks_green', 'await_merge'],
  ['await_merge', 'merged'],
  ['merged', 'archive'],
  ['archive', 'cleanup'],
];

function graphSection() {
  const start = text.indexOf('\ngraph:\n');
  const end = text.indexOf('\nstart:\n');
  assert.ok(start >= 0 && end > start, 'graph: ... start: markers must both be present');
  return text.slice(start, end);
}

function nodesSection() {
  const graph = graphSection();
  const start = graph.indexOf('  nodes:\n');
  const end = graph.indexOf('\n  edges:\n');
  assert.ok(start >= 0 && end > start, '  nodes: ...   edges: markers must both be present');
  return graph.slice(start, end);
}

function edgesSection() {
  const graph = graphSection();
  const start = graph.indexOf('\n  edges:\n');
  assert.ok(start >= 0, '  edges: marker must be present');
  return graph.slice(start);
}

function nodeIds() {
  return [...nodesSection().matchAll(/^    - id: (\S+)$/gm)].map((m) => m[1]);
}

function edges() {
  return [...edgesSection().matchAll(/\{\s*from:\s*(\w+),\s*to:\s*(\w+)\s*\}/g)].map((m) => [m[1], m[2]]);
}

// The exact text of one node's block, from its `    - id: <id>` line up to (not including) the
// next node's `    - id:` line, or the end of the nodes section for the last node.
function nodeBlock(id) {
  const nodes = nodesSection();
  const starts = [...nodes.matchAll(/^    - id: (\S+)$/gm)];
  const i = starts.findIndex((m) => m[1] === id);
  assert.ok(i >= 0, `node ${id} not found`);
  const from = starts[i].index;
  const to = i + 1 < starts.length ? starts[i + 1].index : nodes.length;
  return nodes.slice(from, to);
}

function fieldValue(block, field, indent = 6) {
  const re = new RegExp(`^${' '.repeat(indent)}${field}: (\\S.*)$`, 'm');
  const m = block.match(re);
  return m ? m[1].trim() : undefined;
}

// design.md Risks, "A skipped node's output": a skipped node settles with a skip marker rather
// than a filled schema, and the compiler's Go templates raise `nil pointer evaluating %s.%s` when
// a field is dotted on a nil output. So every reader of `.nodes.design.output` must either be the
// bare parent guard itself (`{{ if .nodes.design.output }}`) or sit inside the body of such a
// guard, never dot a field (`.worktree_path`, `.screens`, `.mockup`, `.mockup_version`, ...)
// outside one. `{{ if }}`/`{{ end }}` pairs never nest in this template, so a sequential
// open/close scan is enough: the only token that opens the guard is the exact bare condition, and
// the next `{{ end }}` after it always closes that same guard.
//
// One exemption, named by the line it sits on rather than by node id so both this file and
// adoption.test.mjs can share the same check text: `screens_ok`'s `check:` dots
// `.worktree_path` with no guard at all, and that is correct, not an oversight - `screens_ok` is
// reachable only by the edge `design -> screens_ok`, so its output is always filled when that
// gate's criterion runs.
function designOutputViolations(text) {
  const EXEMPT_LINE = '.compozy/bin/devkit-kit screens-check';
  const tokenRe = /(\{\{\s*if\s+\.nodes\.design\.output\s*\}\})|(\{\{\s*end\s*\}\})|(\.nodes\.design\.output(?:\.\w+)?)/g;
  let insideGuard = false;
  const violations = [];
  let m;
  while ((m = tokenRe.exec(text))) {
    const [, guardOpen, end, field] = m;
    if (guardOpen) {
      insideGuard = true;
      continue;
    }
    if (end) {
      insideGuard = false;
      continue;
    }
    if (field === '.nodes.design.output' || insideGuard) continue;
    const lineStart = text.lastIndexOf('\n', m.index) + 1;
    const lineEndIdx = text.indexOf('\n', m.index);
    const line = text.slice(lineStart, lineEndIdx === -1 ? text.length : lineEndIdx);
    if (line.includes(EXEMPT_LINE)) continue;
    violations.push(`${field} at offset ${m.index}: ${line.trim()}`);
  }
  return violations;
}

// The `{{ if .nodes.demo.output }}` ... `{{ end }}` block of a node's prompt, as
// { condition, body }, or null when the node carries no such guard. The condition is captured
// rather than matched so the caller can tell "no guard at all" from "a guard on a field dotted on
// the output", which design Risks, "A skipped node's output", forbids for the same reason it
// forbids it for `.nodes.design.output`: the demo node is skipped whenever the change declares no
// screen. The body is matched loosely on purpose - what AC-6 fixes is the link, not the prose
// around it.
function guardedDemoBlock(block) {
  const m = block.match(/\{\{\s*if\s+(\.nodes\.demo\.output(?:\.\w+)*)\s*\}\}([\s\S]*?)\{\{\s*end\s*\}\}/);
  return m ? { condition: m[1], body: m[2] } : null;
}

test('AC-2 loop-shape: the node ids are exactly design D2\'s seventeen, in order', () => {
  assert.deepEqual(nodeIds(), EXPECTED_NODE_IDS);
});

test('AC-2 loop-shape: the edges are exactly design D2\'s eighteen, no more, no fewer', () => {
  const got = edges();
  assert.equal(got.length, 18);
  assert.equal(EXPECTED_EDGES.length, 18);
  const key = (e) => `${e[0]}->${e[1]}`;
  assert.deepEqual(new Set(got.map(key)), new Set(EXPECTED_EDGES.map(key)));
  // No duplicate edge either.
  assert.equal(new Set(got.map(key)).size, got.length);
});

test('AC-2 loop-shape: every gate node has class control, kind gate, and every one of its criteria is type command', () => {
  const gateIds = ['approve_plan', 'screens_ok', 'verify', 'checks_green', 'merged'];
  for (const id of gateIds) {
    const block = nodeBlock(id);
    assert.equal(fieldValue(block, 'class'), 'control', `${id} must be class: control`);
    assert.equal(fieldValue(block, 'kind'), 'gate', `${id} must be kind: gate`);
    const criteriaStart = block.indexOf('criteria:');
    assert.ok(criteriaStart >= 0, `${id} must declare criteria`);
    const criteriaBlock = block.slice(criteriaStart);
    const types = [...criteriaBlock.matchAll(/^          type: (\S+)$/gm)].map((m) => m[1]);
    assert.ok(types.length >= 1, `${id} must have at least one criterion`);
    for (const t of types) {
      assert.equal(t, 'command', `${id}'s criterion type must be command, got ${t}`);
    }
  }
});

test('AC-2 loop-shape: no criterion is agent-judge and no node is a goal', () => {
  assert.doesNotMatch(text, /agent-judge/);
  assert.doesNotMatch(text, /kind:\s*goal\b/);
});

test('AC-2 loop-shape: implement and deliver each carry a review block with responders: { agents: deny }', () => {
  for (const id of ['implement', 'deliver']) {
    const block = nodeBlock(id);
    const reviewStart = block.indexOf('\n      review:\n');
    assert.ok(reviewStart >= 0, `${id} must have a review: block`);
    const reviewBlock = block.slice(reviewStart);
    assert.match(reviewBlock, /responders:\s*\n\s+agents:\s*deny/, `${id}'s review block must deny agent responders`);
  }
  // And nowhere else: exactly two review blocks, exactly two "agents: deny" lines.
  assert.equal([...text.matchAll(/^      review:$/gm)].length, 2);
  assert.equal([...text.matchAll(/agents:\s*deny/g)].length, 2);
});

test('AC-3 design-gate: touches_screens branches on the plan\'s own screens list', () => {
  const block = nodeBlock('touches_screens');
  assert.equal(fieldValue(block, 'class'), 'control');
  assert.equal(fieldValue(block, 'kind'), 'branch');
  const condition = fieldValue(block, 'condition').replace(/^"|"$/g, '');
  assert.equal(condition, 'size(nodes.propose.output.screens) > 0');
});

test('AC-3 design-gate: has_demo branches on the same list and a non-empty demo_command', () => {
  const block = nodeBlock('has_demo');
  assert.equal(fieldValue(block, 'class'), 'control');
  assert.equal(fieldValue(block, 'kind'), 'branch');
  const condition = fieldValue(block, 'condition').replace(/^"|"$/g, '');
  assert.equal(condition, 'size(nodes.propose.output.screens) > 0 && size(inputs.demo_command) > 0');
});

test('AC-3 design-gate: implement has a second incoming edge from approve_plan that skips the design stage', () => {
  const incoming = edges().filter(([, to]) => to === 'implement').map(([from]) => from);
  assert.deepEqual(new Set(incoming), new Set(['screens_ok', 'approve_plan']));
});

test('AC-3 design-gate: deliver has a second incoming edge from verify that skips the demo stage', () => {
  const incoming = edges().filter(([, to]) => to === 'deliver').map(([from]) => from);
  assert.deepEqual(new Set(incoming), new Set(['demo', 'verify']));
});

test('AC-5 ci-green: the ci_fix prompt names a CompozyOS pull-request monitor', () => {
  const block = nodeBlock('ci_fix');
  assert.match(block, /CompozyOS pull-request monitor/);
});

test('AC-5 ci-green: the await_merge prompt names the same monitor and never merges by hand', () => {
  const block = nodeBlock('await_merge');
  assert.match(block, /CompozyOS pull-request monitor/);
  assert.match(block, /never merge it yourself/);
});

// The other half of the scan below: the two waiting prompts must forbid each form by name, so
// the agent that reads them cannot reach for one. This is why the scan that follows reads
// `check:` commands and not raw prompt text - here the forms appear as prohibitions.
test('AC-5 ci-green: both waiting prompts forbid sleep, --watch, gh run watch and a polling loop by name', () => {
  for (const id of ['ci_fix', 'await_merge']) {
    const block = nodeBlock(id);
    assert.match(block, /Never wait\s+with `sleep`/, `${id} must forbid sleep by name`);
    assert.match(block, /`gh pr checks --watch`/, `${id} must forbid gh pr checks --watch by name`);
    assert.match(block, /`gh run watch`/, `${id} must forbid gh run watch by name`);
    assert.match(block, /a\s+polling loop/, `${id} must forbid a polling loop by name`);
  }
});

// design D7: a prompt telling the agent "never wait with `sleep`, ..." must, to say so, quote the
// very forms it forbids - that quoting lives in natural-language prose, not in anything the loop
// engine itself executes. What the engine executes is a gate criterion's `check:` command (and
// the top-level contract.verification command); those are the only node text that could actually
// block or poll this runtime, so that is what this test scans.
test('AC-5 ci-green: no gate criterion or contract.verification command waits with sleep, --watch, gh run watch or a polling loop', () => {
  const checks = [...text.matchAll(/^\s+check: "(.*)"$/gm)].map((m) => m[1]);
  assert.ok(checks.length >= 5, 'expected at least five command checks (the five gates plus the contract verification)');
  const forbidden = ['sleep ', '--watch', 'gh run watch', 'until '];
  for (const check of checks) {
    for (const pattern of forbidden) {
      assert.ok(!check.includes(pattern), `check command must not contain ${JSON.stringify(pattern)}: ${check}`);
    }
  }
});

test('AC-5 ci-green: checks_green and merged fail to escalate, never to next_generation', () => {
  for (const id of ['checks_green', 'merged']) {
    const block = nodeBlock(id);
    assert.match(block, /on_result:\s*\n\s+fail:\s*escalate/);
  }
});

test('AC-7 archive-cleanup: cleanup is an action node of kind compozy__worktree_remove with allow_fail', () => {
  const block = nodeBlock('cleanup');
  assert.equal(fieldValue(block, 'class'), 'action');
  assert.equal(fieldValue(block, 'kind'), 'compozy__worktree_remove');
  assert.match(block, /on_error:\s*\n\s+allow_fail:\s*true/);
  assert.match(block, /path:\s*"\{\{\s*\.nodes\.archive\.output\.worktree_path\s*\}\}"/);
});

test('AC-7 archive-cleanup: cleanup runs only after merged settles into archive', () => {
  assert.deepEqual(
    edges().filter(([, to]) => to === 'cleanup'),
    [['archive', 'cleanup']],
  );
  assert.deepEqual(
    edges().filter(([, to]) => to === 'archive'),
    [['merged', 'archive']],
  );
});

test('AC-7 archive-cleanup: definition_of_done keeps the deferred-task sentence and ends at the archived change', () => {
  const start = text.indexOf('definition_of_done: >');
  const end = text.indexOf('\n  constraints:');
  assert.ok(start >= 0 && end > start);
  const dod = text.slice(start, end);
  assert.match(dod, /except\s*\n?\s*tasks the operator deferred by a dated decision recorded in tasks\.md/);
  assert.match(dod, /reads archived/);
  assert.match(dod, /its worktree is removed/);
});

test('AC-7 archive-cleanup: contract.verification checks the archived folder on origin/HEAD over inputs only', () => {
  const start = text.indexOf('  verification:');
  const end = text.indexOf('\n  terminal_states:');
  assert.ok(start >= 0 && end > start);
  const verification = text.slice(start, end);
  assert.match(verification, /type: command/);
  assert.doesNotMatch(verification, /\.nodes\./);
  assert.match(verification, /origin\/HEAD/);
  assert.match(verification, /openspec\/changes\/archive/);
});

test('AC-2 loop-shape: every .nodes.design.output read is the parent guard itself or sits inside one (design Risks, "A skipped node\'s output")', () => {
  assert.deepEqual(designOutputViolations(text), []);
});

// AC-3 design-gate, round 2 nit: 2.7 already proves the screens list drives both branch
// conditions, but neither branch reads output_schema itself, so a schema that silently dropped
// screens from required (or stopped typing its items) would still turn the loop the right way
// while leaving the contract propose actually returns unpinned. This states the schema's own
// shape directly.
test('AC-3 design-gate: propose\'s output_schema declares screens as a required array of strings', () => {
  const block = nodeBlock('propose');
  const osStart = block.indexOf('output_schema:');
  assert.ok(osStart >= 0, 'propose must declare output_schema');
  const outputSchema = block.slice(osStart);
  const required = outputSchema.match(/required:\s*\[([^\]]*)\]/);
  assert.ok(required, 'output_schema must declare required');
  assert.ok(
    required[1].split(',').map((s) => s.trim()).includes('screens'),
    'required must list screens',
  );
  assert.match(
    outputSchema,
    /screens:\s*\n\s*type:\s*array\s*\n(?:\s*description:.*\n)?\s*items:\s*\{\s*type:\s*string,[^}]*\}/,
    'screens must be typed as an array of strings',
  );
});

// AC-6 demo-contract, AC-9 repo-adopts, round 2 important: AC-6 requires deliver to link the
// change's evidence folder from the pull-request body when the demo ran, and nothing read that
// text before this, so deleting the sentence (or loosening the guard to a nested field, which
// design Risks "A skipped node's output" forbids the same way it forbids it for .nodes.design.output)
// left every suite green. One assertion that bites both mutations: the link's guard must be the
// bare parent condition, not a field dotted on it.
test('AC-6 demo-contract: deliver links the change\'s evidence/ folder from the pull-request body, guarded on the demo node\'s parent output', () => {
  const guarded = guardedDemoBlock(nodeBlock('deliver'));
  assert.ok(guarded, 'deliver must carry a {{ if .nodes.demo.output }} ... {{ end }} block');
  assert.equal(guarded.condition, '.nodes.demo.output', 'the guard must be the bare parent output, not a field dotted on it');
  assert.match(
    guarded.body,
    /openspec\/changes\/\{\{\s*\.inputs\.change_id\s*\}\}\/evidence\//,
    'the guarded sentence must link openspec/changes/<id>/evidence/',
  );
});

// The strongest proof of the template, but it needs a running CompozyOS daemon (design.md
// Risks). It also exits 0 on an invalid definition (valid: false in its JSON), so this is never a
// gate on its own - skipped entirely when the CLI or the daemon is unreachable.
test('AC-2 loop-shape: compozy loop validate accepts the raw template (skipped without a reachable daemon)', (t) => {
  let result;
  try {
    result = spawnSync('compozy', ['loop', 'validate', '--file', TEMPLATE, '-o', 'json'], { encoding: 'utf8' });
  } catch {
    t.skip('compozy is not on PATH');
    return;
  }
  if (result.error || result.status === null) {
    t.skip('compozy is not on PATH');
    return;
  }
  let parsed;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    t.skip(`compozy did not answer with JSON (daemon unreachable?): ${result.stdout}${result.stderr}`);
    return;
  }
  if (typeof parsed.valid !== 'boolean') {
    t.skip(`compozy loop validate did not report a verdict (daemon unreachable?): ${JSON.stringify(parsed)}`);
    return;
  }
  assert.equal(parsed.valid, true, `compozy loop validate rejected the template: ${JSON.stringify(parsed)}`);
});

// stage-roles D-8 (spec compozy-kit-setup): the prompts name the new stage agents and files.
test('stage-roles kit: the design node prompt names the screen-designer and mockup.md', () => {
  const block = nodeBlock('design').replace(/\s+/g, ' ');
  assert.match(block, /devkit-core:screen-designer/);
  assert.match(block, /mockup\.md/);
  assert.match(block, /mock\//);
});

test('stage-roles kit: the review node prompt names the two test agents and the two blocking ids', () => {
  const block = nodeBlock('review').replace(/\s+/g, ' ');
  assert.match(block, /devkit-core:test-runner/);
  assert.match(block, /devkit-core:e2e-tester/);
  assert.match(block, /unit_tests_red/);
  assert.match(block, /e2e_tests_red/);
});

test('stage-roles kit: the implement node review prompt lists decisions among the files and asks for the records to be approved with the plan', () => {
  const flat = readFileSync(TEMPLATE, 'utf8').replace(/\s+/g, ' ');
  assert.match(flat, /\(requirements and its open questions, proposal, tasks, and design, decisions and readiness on the devkit schema\)/);
  assert.match(flat, /together with the (?:ADRs|records) (?:it|`decisions\.md`) lists/);
});
