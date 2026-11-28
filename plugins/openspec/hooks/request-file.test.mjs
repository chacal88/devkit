// node scripts/test-suite.mjs plugins/openspec/hooks/request-file.test.mjs
// helper-conductor D-17 and D-19: the request files a helper writes in a change's folder (`requests/<n>-<slug>.md`) and the answers
// beside them (`requests/<n>-<slug>.answer.md`): their shape, the refusals, the 12-line summary, the 200-character cut of an
// approval's words. Every fixture is a folder of the test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpFolder } from './test-tmp.mjs';
import {
  RequestError, SUMMARY_LINES, APPROVAL_WORDS_MAX, parseRequest, writeRequest, writeAnswer, readAnswer, listRequests, cutApprovalWords,
} from './request-file.mjs';

const AT = new Date('2026-11-28T16:00:00.000Z');

const draft = ({ title = 'Which base?', question = 'Rebase or merge?', facts = 'The base moved.', recommendation = 'Merge.', section = 'Facts' } = {}) =>
  `# Request: ${title}\n\n## Question\n${question}\n\n## ${section}\n${facts}\n\n## Recommendation\n${recommendation}\n`;

function fixture() {
  const dir = tmpFolder('devkit-request-');
  const change = join(dir, 'openspec', 'changes', 'feat');
  mkdirSync(change, { recursive: true });
  const scratch = join(dir, 'scratch');
  mkdirSync(scratch);
  let k = 0;
  const put = (text) => { const file = join(scratch, `draft-${k++}.md`); writeFileSync(file, text); return file; };
  return { change, put, requests: join(change, 'requests') };
}

const refusal = (fn) => { try { fn(); } catch (e) { return e; } assert.fail('expected a refusal'); };

test('request AC-14 write: a draft becomes requests/1-<gate>.md with the header, the numbered title and its three sections', () => {
  const { change, put, requests } = fixture();
  const done = writeRequest({ change, gate: 'merge', file: put(draft()), now: AT });
  assert.deepEqual({ n: done.n, file: done.file }, { n: 1, file: join(requests, '1-merge.md') });
  const text = readFileSync(done.file, 'utf8');
  assert.match(text, /^<!-- devkit-request gate=merge at=2026-11-28T16:00:00\.000Z -->\n# Request 1: Which base\?\n/);
  const parsed = parseRequest(text);
  assert.equal(parsed.ok, true);
  assert.deepEqual(
    { gate: parsed.gate, at: parsed.at, title: parsed.title, question: parsed.question, facts: parsed.facts, recommendation: parsed.recommendation },
    { gate: 'merge', at: '2026-11-28T16:00:00.000Z', title: 'Which base?', question: 'Rebase or merge?', facts: 'The base moved.', recommendation: 'Merge.' },
  );
});

test('request AC-14 write: a draft that already holds a header and a numbered title is stamped once, not twice', () => {
  const { change, put } = fixture();
  const own = `<!-- devkit-request gate=grill at=2020-01-01T00:00:00.000Z -->\n# Request 9: Old\n${draft().split('\n').slice(1).join('\n')}`;
  const done = writeRequest({ change, gate: 'decision', file: put(own), now: AT });
  const text = readFileSync(done.file, 'utf8');
  assert.equal(text.match(/devkit-request/g).length, 1);
  assert.match(text, /^<!-- devkit-request gate=decision at=2026-11-28T16:00:00\.000Z -->\n# Request 1: Old\n/);
});

test('request AC-14 write: n counts from 1 in the folder and the slug is the gate id', () => {
  const { change, put, requests } = fixture();
  writeRequest({ change, gate: 'grill', file: put(draft()), now: AT });
  writeRequest({ change, gate: 'decision', file: put(draft()), now: AT });
  assert.deepEqual(readdirSync(requests).sort(), ['1-grill.md', '2-decision.md']);
});

test('request AC-14 write: a missing heading is refused with exit 3 and the heading it lacks, and nothing is written', () => {
  const { change, put, requests } = fixture();
  for (const heading of ['Question', 'Facts', 'Recommendation']) {
    const e = refusal(() => writeRequest({ change, gate: 'merge', file: put(draft().replace(`## ${heading}`, `## Other`)), now: AT }));
    assert.ok(e instanceof RequestError);
    assert.deepEqual({ code: e.code, exit: e.exit, heading: e.heading }, { code: 'missing-heading', exit: 3, heading: heading });
  }
  assert.equal(existsSync(requests), false);
});

test('request AC-14 write: a heading inside a fenced block does not count', () => {
  const { change, put } = fixture();
  const text = draft().replace('## Facts\nThe base moved.', '## Facts\n```\n## Recommendation\n```\nThe base moved.').replace('\n## Recommendation\nMerge.\n', '\n');
  const e = refusal(() => writeRequest({ change, gate: 'merge', file: put(text), now: AT }));
  assert.equal(e.heading, 'Recommendation');
});

test('request AC-14 write: an unclosed fence is refused', () => {
  const { change, put } = fixture();
  const e = refusal(() => writeRequest({ change, gate: 'merge', file: put(`${draft()}\n\`\`\`\nopen\n`), now: AT }));
  assert.deepEqual({ code: e.code, exit: e.exit }, { code: 'unclosed-fence', exit: 3 });
});

test('request AC-14 write: an unknown gate, a missing draft and a draft with no title are refused, with exit 3', () => {
  const { change, put } = fixture();
  assert.equal(refusal(() => writeRequest({ change, gate: 'coffee', file: put(draft()), now: AT })).code, 'unknown-gate');
  assert.equal(refusal(() => writeRequest({ change, gate: 'merge', file: join(change, 'nope.md'), now: AT })).code, 'no-draft');
  const e = refusal(() => writeRequest({ change, gate: 'merge', file: put(draft().replace(/^# Request: .*\n/, '')), now: AT }));
  assert.deepEqual({ code: e.code, heading: e.heading, exit: e.exit }, { code: 'missing-heading', heading: '# Request', exit: 3 });
});

test('request AC-16 summary: an approval request holds a Summary in place of Facts, at most 12 non-blank lines', () => {
  const { change, put } = fixture();
  assert.equal(SUMMARY_LINES, 12);
  const twelve = Array.from({ length: 12 }, (_, i) => `line ${i + 1}`).join('\n\n');
  const done = writeRequest({ change, gate: 'approval', file: put(draft({ section: 'Summary', facts: twelve })), now: AT });
  assert.equal(parseRequest(readFileSync(done.file, 'utf8')).summary, twelve);
});

test('request AC-16 summary: 13 non-blank lines are refused with summary-too-long and the count, exit 3', () => {
  const { change, put, requests } = fixture();
  const thirteen = Array.from({ length: 13 }, (_, i) => `line ${i + 1}`).join('\n');
  const e = refusal(() => writeRequest({ change, gate: 'approval', file: put(draft({ section: 'Summary', facts: thirteen })), now: AT }));
  assert.deepEqual({ code: e.code, exit: e.exit, count: e.count }, { code: 'summary-too-long', exit: 3, count: 13 });
  assert.equal(existsSync(requests), false);
});

test('request AC-16 summary: an approval request with Facts and no Summary lacks the Summary heading', () => {
  const { change, put } = fixture();
  assert.equal(refusal(() => writeRequest({ change, gate: 'approval', file: put(draft()), now: AT })).heading, 'Summary');
});

test('request AC-14 parse: a text with no header or a gate that is not one reads as not ok', () => {
  assert.equal(parseRequest('# Request 1: x\n').ok, false);
  assert.equal(parseRequest('<!-- devkit-request gate=coffee at=2026-11-28T16:00:00.000Z -->\n# Request 1: x\n').ok, false);
});

test('request AC-14 answer: writes requests/<n>-<slug>.answer.md with its header and words, and readAnswer reads it back', () => {
  const { change, put, requests } = fixture();
  writeRequest({ change, gate: 'merge', file: put(draft()), now: AT });
  const done = writeAnswer({ change, n: 1, by: 'delegated', line: 7, words: 'Merge the base.', now: AT });
  assert.equal(done.file, join(requests, '1-merge.answer.md'));
  assert.equal(readFileSync(done.file, 'utf8'), '<!-- devkit-answer by=delegated line=7 at=2026-11-28T16:00:00.000Z -->\n## Answer\nMerge the base.\n');
  assert.deepEqual(readAnswer({ change, n: 1 }), { by: 'delegated', line: 7, at: '2026-11-28T16:00:00.000Z', words: 'Merge the base.' });
});

test('request AC-14 answer: an owner answer with no line records line=none and reads back with a null line', () => {
  const { change, put } = fixture();
  writeRequest({ change, gate: 'merge', file: put(draft()), now: AT });
  writeAnswer({ change, n: 1, by: 'owner', words: 'Go.', now: AT });
  assert.match(readFileSync(join(change, 'requests', '1-merge.answer.md'), 'utf8'), /^<!-- devkit-answer by=owner line=none at=/);
  assert.equal(readAnswer({ change, n: 1 }).line, null);
});

test('request AC-14 answer: no request, a second answer, another author and a line that is no number are refused with exit 3', () => {
  const { change, put } = fixture();
  assert.equal(refusal(() => writeAnswer({ change, n: 1, by: 'owner', words: 'x', now: AT })).code, 'no-request');
  writeRequest({ change, gate: 'merge', file: put(draft()), now: AT });
  assert.equal(refusal(() => writeAnswer({ change, n: 1, by: 'tick', words: 'x', now: AT })).code, 'bad-author');
  assert.equal(refusal(() => writeAnswer({ change, n: 1, by: 'owner', line: 'x', words: 'x', now: AT })).code, 'bad-line');
  assert.equal(refusal(() => writeAnswer({ change, n: 1, by: 'owner', words: '  ', now: AT })).code, 'no-words');
  writeAnswer({ change, n: 1, by: 'owner', words: 'x', now: AT });
  const e = refusal(() => writeAnswer({ change, n: 1, by: 'owner', words: 'y', now: AT }));
  assert.deepEqual({ code: e.code, exit: e.exit }, { code: 'already-answered', exit: 3 });
});

test('request AC-14 answer: a file that does not parse reads as no answer', () => {
  const { change, put, requests } = fixture();
  writeRequest({ change, gate: 'merge', file: put(draft()), now: AT });
  assert.equal(readAnswer({ change, n: 1 }), null);
  const file = join(requests, '1-merge.answer.md');
  for (const text of ['', 'words only\n', '<!-- devkit-answer by=tick line=none at=x -->\n## Answer\nx\n', '<!-- devkit-answer by=owner line=none at=x -->\nno heading\n', '<!-- devkit-answer by=owner line=none at=x -->\n## Answer\n\n']) {
    writeFileSync(file, text);
    assert.equal(readAnswer({ change, n: 1 }), null, JSON.stringify(text));
  }
});

test('request AC-16 words: an approval answer is cut at 200 characters and another gate keeps its words', () => {
  const { change, put } = fixture();
  assert.equal(APPROVAL_WORDS_MAX, 200);
  assert.equal(cutApprovalWords('x'.repeat(250)).length, 200);
  assert.equal(cutApprovalWords('short'), 'short');
  writeRequest({ change, gate: 'approval', file: put(draft({ section: 'Summary' })), now: AT });
  writeRequest({ change, gate: 'merge', file: put(draft()), now: AT });
  writeAnswer({ change, n: 1, by: 'owner', words: 'a'.repeat(250), now: AT });
  writeAnswer({ change, n: 2, by: 'owner', words: 'b'.repeat(250), now: AT });
  assert.equal(readAnswer({ change, n: 1 }).words.length, 200);
  assert.equal(readAnswer({ change, n: 2 }).words.length, 250);
});

test('request AC-14 list: the requests in order, each with its gate and whether its answer exists', () => {
  const { change, put } = fixture();
  assert.deepEqual(listRequests(change), []);
  writeRequest({ change, gate: 'grill', file: put(draft()), now: AT });
  writeRequest({ change, gate: 'decision', file: put(draft()), now: AT });
  writeAnswer({ change, n: 2, by: 'owner', words: 'x', now: AT });
  assert.deepEqual(listRequests(change).map(({ n, gate, answered }) => ({ n, gate, answered })), [
    { n: 1, gate: 'grill', answered: false },
    { n: 2, gate: 'decision', answered: true },
  ]);
});
