// node --test plugins/compozy/skills/compozy-setup/scripts/loop-templates.test.mjs
//
// Pins compozy-driver D-5, D-6 and D-7 (AC-2, AC-3, AC-4, AC-5, AC-9) against the three loops the kit ships:
// `devkit-change`, `devkit-review` and `devkit-roadmap`. No YAML library is vendored here (none exists elsewhere
// in this repository), so the templates' own stable indentation is the parser: every assertion is a regex anchored
// on the indent level the templates use, never a loose scan of the raw bytes. The node forms are the ones that ran
// live in `openspec/changes/compozy-driver/proof/probes.md` ("Syntax facts for the implementer"): `compozy loop
// validate` accepts an unknown key without a word, so a form is checked here, not taken from the validator's silence.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const LOOPS_DIR = join(here, '..', 'templates', 'loops');
const loopPath = (name) => join(LOOPS_DIR, name, 'loop.yaml');
const textOf = (name) => readFileSync(loopPath(name), 'utf8');

const KIT = '.compozy/bin/devkit-kit';
const KINDS = ['agent', 'coordinator', 'review', 'gate', 'command', 'open', 'grill', 'mockup', 'approval', 'retro-answers', 'owner', 'github', 'blocked', 'archived'];

// The node ids and the edges D-5, D-6 and D-7 fix, in the order the templates write them.
const SHAPE = {
  'devkit-change': {
    ids: ['read', 'confirm', 'by_kind', 'run_role', 'after_role', 'ask_grill', 'record_grill', 'ask_mockup', 'record_mockup', 'ask_approval', 'approval_route',
      'record_approval', 'record_notes', 'ask_retro', 'record_retro', 'ask_owner', 'ask_blocked', 'blocked_route', 'stop_run', 'retry', 'run_review', 'phase_gate',
      'run_step', 'wait_github', 'turn_end'],
    edges: [
      ['read', 'confirm'], ['confirm', 'by_kind'],
      ['by_kind', 'run_role'], ['by_kind', 'run_review'], ['by_kind', 'phase_gate'], ['by_kind', 'run_step'], ['by_kind', 'ask_mockup'], ['by_kind', 'ask_approval'],
      ['by_kind', 'ask_retro'], ['by_kind', 'ask_owner'], ['by_kind', 'ask_blocked'], ['by_kind', 'wait_github'], ['by_kind', 'turn_end'],
      ['run_role', 'after_role'], ['run_role', 'ask_blocked'], ['after_role', 'ask_grill'], ['after_role', 'turn_end'],
      ['ask_grill', 'record_grill'], ['record_grill', 'turn_end'],
      ['ask_mockup', 'record_mockup'], ['record_mockup', 'turn_end'],
      ['ask_approval', 'approval_route'], ['approval_route', 'record_approval'], ['approval_route', 'record_notes'], ['record_approval', 'turn_end'], ['record_notes', 'turn_end'],
      ['ask_retro', 'record_retro'], ['record_retro', 'turn_end'],
      ['ask_owner', 'turn_end'],
      ['ask_blocked', 'blocked_route'], ['blocked_route', 'stop_run'], ['blocked_route', 'retry'], ['retry', 'turn_end'],
      ['run_review', 'turn_end'], ['run_review', 'ask_blocked'],
      ['phase_gate', 'ask_blocked'], ['phase_gate', 'turn_end'],
      ['run_step', 'turn_end'], ['wait_github', 'turn_end'],
    ],
  },
  'devkit-review': {
    ids: ['bench', 'reviewers', 'review_lane', 'reviewed', 'verify_plan', 'verifiers', 'verify_lane', 'verified', 'outcomes', 'writers', 'write_lane', 'written', 'consolidate'],
    edges: [
      ['bench', 'reviewers'], ['reviewers', 'review_lane'], ['review_lane', 'reviewed'], ['reviewed', 'verify_plan'], ['verify_plan', 'verifiers'],
      ['verifiers', 'verify_lane'], ['verify_lane', 'verified'], ['verified', 'outcomes'], ['outcomes', 'writers'], ['writers', 'write_lane'],
      ['write_lane', 'written'], ['written', 'consolidate'],
    ],
  },
  'devkit-roadmap': {
    ids: ['tick', 'pause', 'state_all', 'state_stuck', 'ended'],
    edges: [['tick', 'pause'], ['pause', 'state_all'], ['state_all', 'state_stuck'], ['state_all', 'ended'], ['state_stuck', 'ended']],
  },
};
const NAMES = Object.keys(SHAPE);

// ---------------------------------------------------------------- the parser: the templates' own indentation

function nodesSection(text) {
  const start = text.indexOf('\n  nodes:\n');
  const end = text.indexOf('\n  edges:\n');
  assert.ok(start >= 0 && end > start, 'the `nodes:` and `edges:` markers must both be present');
  return text.slice(start, end);
}
const nodeIds = (text) => [...nodesSection(text).matchAll(/^    - id: (\S+)$/gm)].map((m) => m[1]);
function edgesOf(text) {
  const start = text.indexOf('\n  edges:\n');
  const end = text.indexOf('\nstart:\n');
  assert.ok(start >= 0 && end > start, 'the `edges:` and `start:` markers must both be present');
  return [...text.slice(start, end).matchAll(/\{\s*from:\s*(\w+),\s*to:\s*(\w+)\s*\}/g)].map((m) => [m[1], m[2]]);
}
// The block of one node, from its `    - id: <id>` line up to the next node's.
function block(text, id) {
  const nodes = nodesSection(text);
  const starts = [...nodes.matchAll(/^    - id: (\S+)$/gm)];
  const i = starts.findIndex((m) => m[1] === id);
  assert.ok(i >= 0, `node ${id} not found`);
  return nodes.slice(starts[i].index, i + 1 < starts.length ? starts[i + 1].index : nodes.length);
}
const field = (b, name, indent = 6) => b.match(new RegExp(`^${' '.repeat(indent)}${name}: (\\S.*)$`, 'm'))?.[1].trim();
const unquote = (v) => v?.replace(/^(["'])(.*)\1$/, '$2');
const classOf = (b) => field(b, 'class');
const kindOf = (b) => field(b, 'kind');
const idsOfKind = (text, kind) => nodeIds(text).filter((id) => kindOf(block(text, id)) === kind);
// The `check:` values of a gate, one per criterion.
const checksOf = (b) => [...b.matchAll(/^ {10}check: (.*)$/gm)].map((m) => unquote(m[1].trim()));
// `on_result` and `on_error` entries of a node: { pass: '{ route: x }', fail: 'next_generation', ... }.
const onResult = (b) => {
  const at = b.indexOf('\n      on_result:\n');
  if (at < 0) return {};
  return Object.fromEntries([...b.slice(at + 1).matchAll(/^ {8}(\w+): (.+)$/gm)].map((m) => [m[1], m[2].trim()]));
};
const routeOf = (value) => /^\{\s*route:\s*(\w+)\s*\}$/.exec(value ?? '')?.[1] ?? null;
const onErrorRoute = (b) => b.match(/^ {6}on_error:\n {8}route: (\w+)$/m)?.[1] ?? null;
// The `routes:` of a route node: [{ when, to }] and its default.
function routesOf(b) {
  const list = [...b.matchAll(/^ {8}- when: (.+)\n {10}to: (\w+)$/gm)].map((m) => ({ when: unquote(m[1].trim()), to: m[2] }));
  return { list, default: field(b, 'default') };
}

// ---------------------------------------------------------------- the three files

test('compozy-loops files: the kit ships exactly the three loops, and the old one is gone', () => {
  for (const name of NAMES) assert.ok(existsSync(loopPath(name)), `${name} has a loop.yaml`);
  assert.equal(existsSync(loopPath('openspec-change')), false, 'the old loop is deleted');
  for (const name of NAMES) {
    const text = textOf(name);
    assert.match(text, /^apiVersion: compozy\.loop\/v1\nkind: Loop\n/m, `${name} is a Loop`);
    assert.match(text, new RegExp(`^meta:\\n  name: ${name}\\n`, 'm'), `${name} is named like its folder`);
    assert.doesNotMatch(text, /\t/, `${name} has no tab`);
  }
});

for (const name of NAMES) {
  test(`compozy-loops ${name}: the node ids and the edges are the ones of the design, in order`, () => {
    const text = textOf(name);
    assert.deepEqual(nodeIds(text), SHAPE[name].ids);
    assert.deepEqual(edgesOf(text), SHAPE[name].edges);
    const ids = new Set(SHAPE[name].ids);
    for (const [from, to] of edgesOf(text)) assert.ok(ids.has(from) && ids.has(to), `edge ${from} -> ${to} names two nodes`);
  });

  test(`compozy-loops ${name}: \`start\` holds cli and uds, and every node has a class that fits its kind`, () => {
    const text = textOf(name);
    assert.match(text, /\nstart:\n {2}- kind: cli\n {2}- kind: uds\n/, 'start: cli and uds');
    for (const id of nodeIds(text)) {
      const b = block(text, id);
      const kind = kindOf(b);
      const action = ['run-agent', 'run-loop', 'transform'].includes(kind);
      const control = ['gate', 'route', 'fan-out', 'collect', 'wait', 'ask'].includes(kind);
      assert.ok(action || control, `${id}: kind ${kind} is one the probes ran`);
      assert.equal(classOf(b), action ? 'action' : 'control', `${id}: class of ${kind}`);
    }
  });
}

// ---------------------------------------------------------------- the gates and their commands (D-5 and D-7)

test('compozy-loops gates: every criterion is a command that calls the kit, but the two that end a run', () => {
  const OWN = { stop_run: 'exit 1', ended: 'true' };
  for (const name of NAMES) {
    const text = textOf(name);
    for (const id of idsOfKind(text, 'gate')) {
      const b = block(text, id);
      assert.ok([...b.matchAll(/^ {10}type: (\w+)$/gm)].every((m) => m[1] === 'command'), `${name}/${id}: type command`);
      assert.ok([...b.matchAll(/^ {10}expect: (\w+)$/gm)].every((m) => m[1] === 'exit_zero'), `${name}/${id}: expect exit_zero`);
      const checks = checksOf(b);
      assert.ok(checks.length > 0, `${name}/${id} has a criterion`);
      for (const check of checks) {
        if (id in OWN) assert.equal(check, OWN[id], `${name}/${id} is the one that ends the run`);
        else assert.ok(check.startsWith(`${KIT} `), `${name}/${id} calls the kit: ${check}`);
      }
    }
  }
  assert.deepEqual(NAMES.flatMap((name) => idsOfKind(textOf(name), 'gate').filter((id) => id in OWN)).sort(), ['ended', 'stop_run']);
});

test('compozy-loops gates: every runtime value inside a check ends with | shellQuote, and no check sleeps, watches or polls', () => {
  let seen = 0;
  for (const name of NAMES) {
    const text = textOf(name);
    for (const id of idsOfKind(text, 'gate')) {
      for (const check of checksOf(block(text, id))) {
        for (const m of check.matchAll(/\{\{([^}]*)\}\}/g)) {
          seen += 1;
          assert.match(m[1], /\|\s*shellQuote\s*$/, `${name}/${id}: ${m[0]} ends with | shellQuote`);
        }
        assert.doesNotMatch(check, /\b(sleep|watch|poll|until|while)\b|--watch|--interval/, `${name}/${id} waits for nothing in a shell: ${check}`);
      }
    }
  }
  assert.ok(seen >= 20, `the loops pass many runtime values through the shell (${seen})`);
});

test('compozy-loops gates: a gate whose failure routes somewhere names its pass route too (a pass follows every forward edge otherwise)', () => {
  const routed = [];
  for (const name of NAMES) {
    const text = textOf(name);
    for (const id of idsOfKind(text, 'gate')) {
      const result = onResult(block(text, id));
      if (routeOf(result.fail) === null) continue;
      routed.push(`${name}/${id}`);
      assert.ok(routeOf(result.pass) !== null, `${name}/${id} names on_result.pass.route`);
      const targets = edgesOf(text).filter(([from]) => from === id).map(([, to]) => to);
      assert.ok(targets.includes(routeOf(result.fail)) && targets.includes(routeOf(result.pass)), `${name}/${id}: both routes are forward edges`);
    }
  }
  assert.deepEqual(routed.sort(), ['devkit-change/phase_gate', 'devkit-roadmap/state_all']);
});

// ---------------------------------------------------------------- devkit-change (D-5)

const change = () => textOf('devkit-change');

test('compozy-loops devkit-change: the contract ends the run at archived, with no cap, no stall window and three inputs', () => {
  const text = change();
  assert.match(text, /^ {2}iteration_cap: 0$/m);
  assert.match(text, /^ {2}no_progress: \{ window: 0 \}$/m);
  assert.match(text, /^ {2}stop_when: 'nodes\.read\.output\.kind == "archived" && nodes\.confirm\.status == "succeeded"'$/m);
  assert.match(text, /^concurrency: allow$/m);
  const inputs = text.slice(text.indexOf('\ninputs:\n'), text.indexOf('\ncontract:\n'));
  assert.deepEqual([...inputs.matchAll(/^ {2}(\w+):$/gm)].map((m) => m[1]), ['change_id', 'request', 'lang']);
  assert.match(inputs, /change_id:\n {4}type: string\n {4}required: true/);
  assert.match(inputs, /request:\n {4}type: string\n {4}default: ""/);
  assert.match(inputs, /lang:\n {4}type: string\n {4}enum: \[en, pt-BR\]\n {4}default: pt-BR/);
});

test('compozy-loops devkit-change: read runs the checker through the coordinator, returns the twelve fields, and confirm hands the whole object back', () => {
  const text = change();
  const read = block(text, 'read');
  assert.equal(kindOf(read), 'run-agent');
  assert.match(read, /^ {8}agent: change-coordinator$/m);
  const prompt = read.slice(read.indexOf('        prompt: |'), read.indexOf('        output_schema:'));
  assert.match(prompt, /^ {10}Read only:/m, 'the prompt starts with Read only:');
  assert.ok(prompt.includes(`${KIT} change-loop next --view compozy --change {{ .inputs.change_id }} --lang {{ .inputs.lang }}`), prompt);
  const schema = read.slice(read.indexOf('        output_schema:'));
  assert.match(schema, /additionalProperties: false/);
  const required = /required: \[([^\]]+)\]/.exec(schema)[1].split(',').map((s) => s.trim());
  assert.deepEqual(required, ['version', 'kind', 'change', 'root', 'stage', 'stage_title', 'agent', 'step', 'brief', 'progress_key', 'question', 'reply']);
  assert.match(schema, new RegExp(`kind: \\{ type: string, enum: \\[${KINDS.join(', ')}\\] \\}`), 'kind is an enum of the fourteen kinds');
  assert.match(read, /^ {6}retry:\n {8}max_attempts: 2$/m);
  const confirm = block(text, 'confirm');
  assert.deepEqual(checksOf(confirm).length, 1);
  assert.equal(checksOf(confirm)[0], `${KIT} change-loop confirm --change {{ .inputs.change_id | shellQuote }} --lang {{ .inputs.lang | shellQuote }} --view {{ toJson .nodes.read.output | shellQuote }}`);
  assert.equal(onResult(confirm).fail, 'next_generation');
});

test('compozy-loops devkit-change: by_kind routes each of the fourteen kinds as the design lists them', () => {
  const b = block(change(), 'by_kind');
  const { list, default: fallback } = routesOf(b);
  const TARGET = {
    agent: 'run_role', coordinator: 'run_role', grill: 'run_role', open: 'run_role', review: 'run_review', gate: 'phase_gate', command: 'run_step', mockup: 'ask_mockup',
    approval: 'ask_approval', 'retro-answers': 'ask_retro', owner: 'ask_owner', blocked: 'ask_blocked', github: 'wait_github',
  };
  for (const [kind, to] of Object.entries(TARGET)) {
    const hits = list.filter((r) => r.when.includes(`"${kind}"`));
    assert.equal(hits.length, 1, `${kind} is in one route`);
    assert.equal(hits[0].to, to, `${kind} goes to ${to}`);
  }
  assert.equal(list.length, 10, 'ten routes, with the four role kinds in one');
  assert.ok(list.every((r) => r.when.startsWith('nodes.read.output.kind')), 'every condition reads the kind of the checker');
  assert.ok(!list.some((r) => r.when.includes('"archived"')), 'archived has no route');
  assert.equal(fallback, 'turn_end', 'archived, and anything else, ends the turn');
  assert.equal(KINDS.length, 14);
});

test('compozy-loops devkit-change: run_role runs the agent the view names, in the checkout the view names, and an error asks the owner', () => {
  const b = block(change(), 'run_role');
  assert.equal(kindOf(b), 'run-agent');
  assert.match(b, /^ {8}agent: "\{\{ \.nodes\.read\.output\.agent \}\}"$/m, 'the agent is the one the checker names');
  assert.match(b, /^ {8}environment:\n {10}mode: directory\n {10}directory: "\{\{ \.nodes\.read\.output\.root \}\}"$/m);
  const prompt = b.slice(b.indexOf('        prompt: |'), b.indexOf('        output_schema:'));
  assert.ok(prompt.includes('{{ .nodes.read.output.brief }}'), 'the prompt is the brief');
  assert.ok(prompt.includes('{{ .inputs.lang }}') || prompt.includes('.inputs.lang'), 'and the person\'s language');
  assert.match(prompt, /\{\{ if \.inputs\.request \}\}[\s\S]*\{\{ \.inputs\.request \}\}[\s\S]*\{\{ end \}\}/, 'and the request when there is one');
  const schema = b.slice(b.indexOf('        output_schema:'));
  assert.match(schema, /outcome: \{ type: string, enum: \[done, failure\] \}/);
  assert.match(schema, /required: \[outcome, question, summary\]/);
  assert.match(b, /^ {6}retry:\n {8}max_attempts: 1$/m);
  assert.equal(onErrorRoute(b), 'ask_blocked');
  const after = routesOf(block(change(), 'after_role'));
  assert.deepEqual(after.list, [{ when: 'nodes.read.output.kind == "grill" && nodes.run_role.output.question != ""', to: 'ask_grill' }]);
  assert.equal(after.default, 'turn_end');
});

test('compozy-loops devkit-change: the loop names no agent of the old kit', () => {
  for (const name of NAMES) {
    const text = textOf(name);
    assert.doesNotMatch(text, /tech-lead/, `${name} names no tech-lead`);
    assert.doesNotMatch(text, /^ *(agent|planner|implementer|reviewer|designer): "?(tech-lead|dev|qa|design)"?$/m, `${name} names no agent of the old kit`);
    assert.doesNotMatch(text, /^ {8}agent: (?!change-coordinator$|finding-verifier$|"\{\{ \.(nodes\.read\.output\.agent|item\.reviewer) \}\}"$)/m, `${name}: every agent is a role of PACKS or an expression`);
  }
});

test('compozy-loops devkit-change: every ask has a prompt and an expect under params, a human answers it, and the answers are recorded', () => {
  const text = change();
  const asks = idsOfKind(text, 'ask');
  assert.deepEqual(asks, ['ask_grill', 'ask_mockup', 'ask_approval', 'ask_retro', 'ask_owner', 'ask_blocked']);
  for (const id of asks) {
    const b = block(text, id);
    assert.match(b, /^ {6}params:\n/m, `${id} has params`);
    assert.match(b, /^ {8}prompt: /m, `${id}: params.prompt`);
    assert.match(b, /^ {8}expect:\n {10}type: object$/m, `${id}: params.expect is a schema`);
    assert.doesNotMatch(b, /^ {6}(prompt|expect):/m, `${id}: neither sits on the node`);
    assert.doesNotMatch(b, /responders|agents: allow/, `${id}: only a human answers (the default)`);
  }
  assert.doesNotMatch(text, /responders|agents: allow/);
  const expects = (id) => block(text, id).slice(block(text, id).indexOf('        expect:'));
  assert.match(expects('ask_grill'), /answer: \{ type: string \}/);
  for (const id of ['ask_mockup', 'ask_approval']) {
    assert.match(expects(id), /decision: \{ type: string, enum: \[approve, changes\] \}/, id);
    assert.match(expects(id), /words: \{ type: string \}/, id);
  }
  assert.match(expects('ask_retro'), /answers: \{ type: string \}/);
  assert.match(expects('ask_owner'), /note: \{ type: string \}/);
  assert.match(expects('ask_blocked'), /decision: \{ type: string, enum: \[retry, stop\] \}/);
  assert.match(expects('ask_blocked'), /note: \{ type: string \}/);
  assert.match(block(text, 'ask_mockup'), /prompt: "\{\{ \.nodes\.read\.output\.question \}\}"/);
  assert.match(block(text, 'ask_grill'), /prompt: "\{\{ \.nodes\.run_role\.output\.question \}\}"/);
});

test('compozy-loops devkit-change: each answer goes through its record step, with every value quoted', () => {
  const text = change();
  const check = (id) => checksOf(block(text, id))[0];
  const L = '--lang {{ .inputs.lang | shellQuote }}';
  const C = '--change {{ .inputs.change_id | shellQuote }}';
  assert.equal(check('record_grill'), `${KIT} change-loop record-answer ${C} --gate grill --question {{ .nodes.run_role.output.question | shellQuote }} --answer {{ .nodes.ask_grill.output.answer | shellQuote }} ${L}`);
  assert.equal(check('record_mockup'), `${KIT} change-loop record-mockup ${C} --decision {{ .nodes.ask_mockup.output.decision | shellQuote }} --words {{ .nodes.ask_mockup.output.words | shellQuote }} ${L}`);
  assert.equal(check('record_approval'), `${KIT} change-loop record-approval ${C} --words {{ .nodes.ask_approval.output.words | shellQuote }} ${L}`);
  assert.equal(check('record_notes'), `${KIT} change-loop record-answer ${C} --gate approval --answer {{ .nodes.ask_approval.output.words | shellQuote }} ${L}`);
  assert.equal(check('record_retro'), `${KIT} change-loop record-answer ${C} --gate retro --answer {{ .nodes.ask_retro.output.answers | shellQuote }} ${L}`);
  const approval = routesOf(block(text, 'approval_route'));
  assert.deepEqual(approval.list, [{ when: 'nodes.ask_approval.output.decision == "approve"', to: 'record_approval' }]);
  assert.equal(approval.default, 'record_notes');
  for (const id of ['record_grill', 'record_mockup', 'record_approval', 'record_notes', 'record_retro']) {
    assert.equal(onResult(block(text, id)).fail, 'next_generation', `${id}: a refused record starts the next turn, which reads the state again`);
  }
});

test('compozy-loops devkit-change: the errors of run_role and run_review and the failed result of phase_gate ask the owner, and a failed run_step goes to the next turn', () => {
  const text = change();
  assert.equal(onErrorRoute(block(text, 'run_role')), 'ask_blocked');
  const review = block(text, 'run_review');
  assert.equal(onErrorRoute(review), 'ask_blocked');
  assert.equal(kindOf(review), 'run-loop');
  assert.match(review, /^ {8}loop: devkit-review$/m);
  assert.match(review, /^ {8}await: true$/m, 'the form the probes ran');
  assert.doesNotMatch(review, /mode: await/, 'not the form the probes did not run');
  assert.match(review, /^ {8}inputs:\n {10}change_id: "\{\{ \.inputs\.change_id \}\}"\n {10}lang: "\{\{ \.inputs\.lang \}\}"\n {10}root: "\{\{ \.nodes\.read\.output\.root \}\}"$/m);
  assert.match(review, /^ {6}retry:\n {8}max_attempts: 1$/m, 'a run-loop needs an explicit retry');
  const gate = block(text, 'phase_gate');
  assert.deepEqual(onResult(gate), { pass: '{ route: turn_end }', fail: '{ route: ask_blocked }' });
  assert.equal(field(gate, 'timeout'), '3h');
  assert.equal(checksOf(gate)[0], `${KIT} change-loop run-gate --change {{ .inputs.change_id | shellQuote }} --lang {{ .inputs.lang | shellQuote }}`);
  const step = block(text, 'run_step');
  assert.equal(onResult(step).fail, 'next_generation');
  assert.equal(field(step, 'timeout'), '10m');
  assert.equal(checksOf(step)[0], `${KIT} change-loop run-step --change {{ .inputs.change_id | shellQuote }} --lang {{ .inputs.lang | shellQuote }}`);
});

test('compozy-loops devkit-change: blocked_route sends stop to stop_run, which fails and halts, and retry to the compozy-retry gate', () => {
  const text = change();
  const route = routesOf(block(text, 'blocked_route'));
  assert.deepEqual(route.list, [{ when: 'nodes.ask_blocked.output.decision == "stop"', to: 'stop_run' }]);
  assert.equal(route.default, 'retry');
  const stop = block(text, 'stop_run');
  assert.deepEqual(checksOf(stop), ['exit 1']);
  assert.equal(onResult(stop).fail, 'halt');
  const retry = block(text, 'retry');
  assert.equal(checksOf(retry)[0], `${KIT} change-loop compozy-retry --change {{ .inputs.change_id | shellQuote }}`);
  const ask = block(text, 'ask_blocked');
  assert.match(ask, /retry/);
  assert.match(ask, /stop/);
});

test('compozy-loops devkit-change: the wait on GitHub is a wait node, and the end of a turn is a transform', () => {
  const text = change();
  const wait = block(text, 'wait_github');
  assert.equal(kindOf(wait), 'wait');
  assert.match(wait, /^ {6}params:\n {8}for: 5m$/m);
  const end = block(text, 'turn_end');
  assert.equal(kindOf(end), 'transform');
  assert.match(end, /^ {6}params:\n {8}map:\n {10}done: \{ value: true \}$/m);
  assert.match(end, /^ {6}produces:\n {8}done: boolean$/m);
  for (const name of NAMES) assert.doesNotMatch(textOf(name), /^ *(?:watch|sleep)\b/m);
});

// ---------------------------------------------------------------- devkit-review (D-6)

const review = () => textOf('devkit-review');

test('compozy-loops devkit-review: one round, with the three inputs and the stop the design gives', () => {
  const text = review();
  assert.match(text, /^ {2}iteration_cap: 1$/m);
  assert.match(text, /^ {2}stop_when: "generation >= 1"$/m);
  const inputs = text.slice(text.indexOf('\ninputs:\n'), text.indexOf('\ncontract:\n'));
  assert.deepEqual([...inputs.matchAll(/^ {2}(\w+):$/gm)].map((m) => m[1]), ['change_id', 'lang', 'root']);
});

test('compozy-loops devkit-review: the fan-outs carry their bounds on the node, and each lane takes its agent from the item or is the verifier', () => {
  const text = review();
  const BOUNDS = { reviewers: [6, 6, 'bench'], verifiers: [90, 9, 'verify_plan'], writers: [6, 6, 'outcomes'] };
  for (const [id, [max, parallel, source]] of Object.entries(BOUNDS)) {
    const b = block(text, id);
    assert.equal(kindOf(b), 'fan-out', id);
    assert.equal(field(b, 'collection'), `"{{ .nodes.${source}.output.jobs }}"`, `${id} fans out over the jobs of ${source}`);
    assert.equal(field(b, 'max_fan_out'), String(max), id);
    assert.equal(field(b, 'max_parallel'), String(parallel), id);
    assert.doesNotMatch(b, /^ {8}(collection|max_fan_out|max_parallel):/m, `${id}: none of them under params`);
  }
  for (const id of ['review_lane', 'write_lane']) {
    assert.equal(kindOf(block(text, id)), 'run-agent', id);
    assert.match(block(text, id), /^ {8}agent: "\{\{ \.item\.reviewer \}\}"$/m, `${id} takes the reviewer from the item`);
  }
  assert.match(block(text, 'verify_lane'), /^ {8}agent: finding-verifier$/m);
  for (const id of ['reviewed', 'verified', 'written']) assert.equal(kindOf(block(text, id)), 'collect', id);
});

test('compozy-loops devkit-review: the bench, the plan, the outcomes and the consolidation are the coordinator in the checkout, and the lanes read the prompt files', () => {
  const text = review();
  for (const id of ['bench', 'verify_plan', 'outcomes', 'consolidate']) {
    const b = block(text, id);
    assert.equal(kindOf(b), 'run-agent', id);
    assert.match(b, /^ {8}agent: change-coordinator$/m, id);
    assert.match(b, /^ {8}environment:\n {10}mode: directory\n {10}directory: "\{\{ \.inputs\.root \}\}"$/m, `${id} runs in the task worktree`);
    assert.match(b, /^ {6}retry:\n {8}max_attempts: 1$/m, id);
  }
  const bench = block(text, 'bench');
  assert.match(bench, /review-round stage1/);
  assert.match(bench, /args\.json/);
  assert.match(bench, /prompts\//);
  assert.match(bench, /`path` to `agents`/, 'the call names the agents path');
  assert.match(bench, /structural: \{ type: string, enum: \[PASS, FAIL\] \}/);
  assert.match(bench, /prompt_file/);
  assert.match(bench, /save_to/);
  assert.match(block(text, 'verify_plan'), /review-round verify/);
  assert.match(block(text, 'outcomes'), /review-round outcomes/);
  const consolidate = block(text, 'consolidate');
  assert.match(consolidate, /review-round check-file/);
  assert.match(consolidate, /review-round consolidate/);
  assert.match(consolidate, /review\.md/);
  for (const id of ['review_lane', 'verify_lane', 'write_lane']) {
    assert.match(block(text, id), /\{\{ \.item\.prompt_file \}\}/, `${id} reads its prompt file`);
    assert.match(block(text, id), /\{\{ \.item\.save_to \}\}/, `${id} writes where the job says`);
  }
  assert.match(text, /\/devkit-review\//, 'the exchange folder is under the system temp directory');
});

// ---------------------------------------------------------------- devkit-roadmap (D-7 and the probe amendment)

const roadmap = () => textOf('devkit-roadmap');

test('compozy-loops devkit-roadmap: the inputs, the stop, and the nodes that stand for the end states', () => {
  const text = roadmap();
  const inputs = text.slice(text.indexOf('\ninputs:\n'), text.indexOf('\ncontract:\n'));
  assert.deepEqual([...inputs.matchAll(/^ {2}(\w+):$/gm)].map((m) => m[1]), ['places', 'load_limit', 'lang']);
  assert.match(inputs, /places:\n {4}type: number\n {4}required: true/);
  assert.match(inputs, /load_limit:\n {4}type: number\n {4}default: 80/);
  assert.match(text, /^ {2}iteration_cap: 0$/m);
  assert.match(text, /^ {2}no_progress: \{ window: 0 \}$/m);
  assert.match(text, /^ {2}stop_when: 'nodes\.ended\.status == "succeeded"'$/m);
  assert.doesNotMatch(nodesSection(text), /compozy__terminal_exec|terminal/, 'a registry terminal tool cannot run as a node (probe P-10)');
  const tick = block(text, 'tick');
  assert.equal(checksOf(tick)[0], `${KIT} roadmap-loop compozy-tick --places {{ .inputs.places | shellQuote }} --load-limit {{ .inputs.load_limit | shellQuote }} --lang {{ .inputs.lang | shellQuote }}`);
  assert.equal(onResult(tick).fail, 'escalate');
  const pause = block(text, 'pause');
  assert.equal(kindOf(pause), 'wait');
  assert.match(pause, /^ {6}params:\n {8}for: 1m$/m);
  const state = (code) => `${KIT} roadmap-loop compozy-state --lang {{ .inputs.lang | shellQuote }}; test $? -eq ${code}`;
  const all = block(text, 'state_all');
  assert.equal(checksOf(all)[0], state(10));
  assert.deepEqual(onResult(all), { pass: '{ route: ended }', fail: '{ route: state_stuck }' });
  const stuck = block(text, 'state_stuck');
  assert.equal(checksOf(stuck)[0], state(11));
  assert.deepEqual(onResult(stuck), { pass: '{ route: ended }', fail: 'next_generation' });
  assert.deepEqual(checksOf(block(text, 'ended')), ['true']);
});

// ---------------------------------------------------------------- the daemon's own validator

// The strongest proof of a template, but it needs a running CompozyOS daemon. It also exits 0 on an invalid definition
// (`valid: false` in its JSON), so it is skipped, never a failure, when the CLI or the daemon cannot be reached; when it
// answers, it must say the definition is valid. It does not read unknown keys, which the tests above are for.
for (const name of NAMES) {
  test(`compozy-loops ${name}: compozy loop validate accepts the raw template (skipped without a reachable daemon)`, (t) => {
    const result = spawnSync('compozy', ['loop', 'validate', '--file', loopPath(name), '-o', 'json'], { encoding: 'utf8', cwd: join(here, '..', '..', '..', '..', '..') });
    if (result.error || result.status === null) return t.skip('compozy is not on PATH');
    let parsed;
    try { parsed = JSON.parse(result.stdout); } catch { return t.skip(`compozy did not answer with JSON (daemon unreachable?): ${result.stdout}${result.stderr}`); }
    if (typeof parsed.valid !== 'boolean') return t.skip(`compozy loop validate did not report a verdict (daemon unreachable?): ${JSON.stringify(parsed)}`);
    assert.equal(parsed.valid, true, `compozy loop validate rejected ${name}: ${JSON.stringify(parsed)}`);
  });
}
