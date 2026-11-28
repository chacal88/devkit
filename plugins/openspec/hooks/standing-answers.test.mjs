// node scripts/test-suite.mjs plugins/openspec/hooks/standing-answers.test.mjs
// helper-conductor D-8: the parser of `openspec/standing-answers.md`, the owner's standing answers and delegations. It reads the
// file and writes nothing; every fixture is a folder of the test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpFolder } from './test-tmp.mjs';
import { readStandingAnswers } from './standing-answers.mjs';

function projectWith(text) {
  const root = tmpFolder('devkit-standing-');
  mkdirSync(join(root, 'openspec'), { recursive: true });
  if (text !== null) writeFileSync(join(root, 'openspec', 'standing-answers.md'), text);
  return root;
}

const NONE = { answers: [], delegations: {} };

test('standing AC-6 no file: no answers and no delegations', () => {
  assert.deepEqual(readStandingAnswers(projectWith(null)), NONE);
});

test('standing AC-6 empty file: no answers and no delegations', () => {
  assert.deepEqual(readStandingAnswers(projectWith('')), NONE);
});

test('standing AC-6 an unreadable file (a folder in its place): no answers and no delegations', () => {
  const root = projectWith(null);
  mkdirSync(join(root, 'openspec', 'standing-answers.md'));
  assert.deepEqual(readStandingAnswers(root), NONE);
});

test('standing AC-6 two sections: answers under Answers, delegations under Delegations, each with its line number', () => {
  const root = projectWith([
    '# Standing answers', // 1
    '', // 2
    '## Answers', // 3
    '- tests: run them with the repo command', // 4
    '- naming: kebab-case ids', // 5
    '', // 6
    '## Delegations', // 7
    '- approval: delegated to the coordinator: "approve plans of add-only changes"', // 8
    '- retro: delegated to the coordinator: "answer retros with the proposals as written"', // 9
    '',
  ].join('\n'));
  assert.deepEqual(readStandingAnswers(root), {
    answers: [
      { line: 4, topic: 'tests', text: 'run them with the repo command' },
      { line: 5, topic: 'naming', text: 'kebab-case ids' },
    ],
    delegations: {
      approval: { line: 8, who: 'the coordinator', quote: 'approve plans of add-only changes' },
      retro: { line: 9, who: 'the coordinator', quote: 'answer retros with the proposals as written' },
    },
  });
});

test('standing AC-6 a heading other than the two ends a section: its lines are no answers', () => {
  const root = projectWith('## Answers\n- a: one\n## Notes\n- b: two\n## Delegations\n- grill: delegated to the owner: "ok"\n');
  const read = readStandingAnswers(root);
  assert.deepEqual(read.answers, [{ line: 2, topic: 'a', text: 'one' }]);
  assert.deepEqual(Object.keys(read.delegations), ['grill']);
});

test('standing AC-8 an unknown gate is ignored', () => {
  const root = projectWith('## Delegations\n- coffee: delegated to the owner: "yes"\n- merge: delegated to the owner: "ok"\n');
  assert.deepEqual(Object.keys(readStandingAnswers(root).delegations), ['merge']);
});

test('standing AC-8 a delegation with no quote is ignored', () => {
  const root = projectWith('## Delegations\n- approval: delegated to the owner\n- retro: delegated to the owner: ""\n- merge: delegated to the owner: noquotes\n');
  assert.deepEqual(readStandingAnswers(root).delegations, {});
});

test('standing AC-6 a line inside a closed fence is ignored, and the lines after it count', () => {
  const root = projectWith('## Answers\n- a: one\n```\n- b: two\n```\n- c: three\n~~~\n- d: four\n~~~\n');
  assert.deepEqual(readStandingAnswers(root).answers.map((a) => a.topic), ['a', 'c']);
});

test('standing AC-6 an unclosed fence ignores every line after it', () => {
  const root = projectWith('## Answers\n- a: one\n```\n- b: two\n## Delegations\n- grill: delegated to the owner: "ok"\n');
  const read = readStandingAnswers(root);
  assert.deepEqual(read.answers.map((a) => a.topic), ['a']);
  assert.deepEqual(read.delegations, {});
});

test('standing AC-8 a delegation under Answers is no delegation, and an answer under Delegations is no answer', () => {
  const root = projectWith('## Answers\n- grill: delegated to the owner: "ok"\n## Delegations\n- topic: plain text\n');
  const read = readStandingAnswers(root);
  assert.deepEqual(read.delegations, {});
  assert.deepEqual(read.answers, [{ line: 2, topic: 'grill', text: 'delegated to the owner: "ok"' }]);
});

test('standing AC-8 two delegations of one gate: the first one stands', () => {
  const root = projectWith('## Delegations\n- merge: delegated to a: "first"\n- merge: delegated to b: "second"\n');
  assert.deepEqual(readStandingAnswers(root).delegations, { merge: { line: 2, who: 'a', quote: 'first' } });
});
