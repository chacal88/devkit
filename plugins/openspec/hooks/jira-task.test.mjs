// node --test plugins/openspec/hooks/jira-task.test.mjs
// jira-entry: the pure tests of `jira-task.mjs` (design D-1) and the no-network source check (AC-9).
// Run by `node scripts/test-suite.mjs`, in a process of its own. Every Jira answer here is a fake object.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as JT from './jira-task.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const LINK = 'https://acme.atlassian.net/browse/PROJ-482';
const TASK = { key: 'PROJ-482', url: LINK, title: 'Login times out after 30 seconds', description: 'Line one\nLine two', acceptanceCriteria: 'It answers in 5 seconds' };

test('jira-entry AC-1 parseTaskRef reads a key typed alone', () => {
  assert.deepEqual(JT.parseTaskRef('PROJ-482'), { key: 'PROJ-482', link: null });
  assert.deepEqual(JT.parseTaskRef('  MY_APP-7 \n'), { key: 'MY_APP-7', link: null });
});

test('jira-entry AC-2 parseTaskRef reads a browse link and a board link, and the path wins', () => {
  assert.deepEqual(JT.parseTaskRef(LINK), { key: 'PROJ-482', link: LINK });
  assert.deepEqual(JT.parseTaskRef(`${LINK}/`), { key: 'PROJ-482', link: `${LINK}/` });
  const board = 'https://acme.atlassian.net/jira/software/projects/PROJ/boards/3?selectedIssue=PROJ-9';
  assert.deepEqual(JT.parseTaskRef(board), { key: 'PROJ-9', link: board });
  const both = 'https://acme.atlassian.net/browse/PROJ-1?selectedIssue=PROJ-2';
  assert.equal(JT.parseTaskRef(both).key, 'PROJ-1');
});

test('jira-entry AC-8 parseTaskRef leaves free text, a lower-case word, more words, a keyless link, blank text and a bad link', () => {
  for (const text of ['add a login page', 'proj-482', 'PROJ-482 fix the login', 'https://acme.atlassian.net/jira/your-work', 'ftp://acme.atlassian.net/browse/PROJ-1', '', '   ', undefined, null, 'https://', 'http://exa mple.com/browse/PROJ-1', 'PROJ-']) {
    assert.equal(JT.parseTaskRef(text), null, String(text));
  }
  assert.equal(JT.parseTaskRef('https://[bad/browse/PROJ-1'), null);
});

test('jira-entry AC-1 taskIdPrefix lower-cases the key and turns underscores into dashes', () => {
  assert.equal(JT.taskIdPrefix('PROJ-482'), 'proj-482');
  assert.equal(JT.taskIdPrefix('MY_APP-7'), 'my-app-7');
  assert.equal(JT.taskIdPrefix('A__B-1'), 'a-b-1');
});

test('jira-entry-followups AC-11 taskIdPrefix lower case: the key in lower case', () => {
  assert.equal(JT.taskIdPrefix('PROJ-482'), 'proj-482');
});

test('jira-entry-followups AC-11 taskIdPrefix underscores: each underscore becomes a dash', () => {
  assert.equal(JT.taskIdPrefix('PROJ_X-12'), 'proj-x-12');
});

test('jira-entry-followups AC-11 taskIdPrefix runs collapsed: a run of dashes becomes one dash', () => {
  assert.equal(JT.taskIdPrefix('PROJ_-12'), 'proj-12');
  assert.equal(JT.taskIdPrefix('A__B-1'), 'a-b-1');
});

test('jira-entry-followups AC-11 taskIdPrefix a trailing dash removed: a text ending in an underscore has no dash at its end', () => {
  assert.equal(JT.taskIdPrefix('PROJ_'), 'proj');
});

test('jira-entry AC-1 taskFromJson keeps the five fields only', () => {
  const raw = JSON.stringify({ ...TASK, comments: ['secret'], subtasks: [1], issuelinks: [2], description: 'a\r\nb' });
  const r = JT.taskFromJson(raw, 'PROJ-482');
  assert.deepEqual(r, { task: { key: 'PROJ-482', url: LINK, title: TASK.title, description: 'a\nb', acceptanceCriteria: TASK.acceptanceCriteria } });
  const lean = JT.taskFromJson(JSON.stringify({ key: 'PROJ-482', title: 'T' }), 'PROJ-482');
  assert.deepEqual(lean, { task: { key: 'PROJ-482', url: null, title: 'T', description: '', acceptanceCriteria: null } });
  const nulls = JT.taskFromJson(JSON.stringify({ key: 'PROJ-482', title: 'T', description: null, acceptanceCriteria: '  ', url: null }), 'PROJ-482');
  assert.deepEqual(nulls.task.acceptanceCriteria, null);
  assert.equal(nulls.task.description, '');
});

test('jira-entry AC-3 taskFromJson refuses broken input with a named reason', () => {
  const err = (text) => JT.taskFromJson(text, 'PROJ-482').error;
  assert.equal(err(''), 'the task on standard input is empty');
  assert.equal(err('  \n'), 'the task on standard input is empty');
  assert.equal(err('{"key":"PROJ-482","title":'), 'the task on standard input is not JSON');
  assert.equal(err('[1]'), 'the task on standard input is not an object');
  assert.equal(err('"x"'), 'the task on standard input is not an object');
  assert.equal(err('null'), 'the task on standard input is not an object');
  assert.equal(err('{"key":"OTHER-1","title":"T"}'), 'the task names OTHER-1, not PROJ-482');
  assert.equal(err('{"key":"PROJ-482"}'), 'the task has no title');
  assert.equal(err('{"key":"PROJ-482","title":"  "}'), 'the task has no title');
  assert.equal(err('{"key":"PROJ-482","title":7}'), 'the task has no title');
  assert.equal(err('{"key":"PROJ-482","title":"T","description":5}'), "the task's description is not text");
  assert.equal(err('{"key":"PROJ-482","title":"T","acceptanceCriteria":{}}'), "the task's acceptance criteria are not text");
  assert.equal(err('{"key":"PROJ-482","title":"T","url":"ftp://x"}'), "the task's link is not an http(s) link");
  assert.equal(err('{"key":"PROJ-482","title":"T","url":3}'), "the task's link is not an http(s) link");
});

test('jira-entry AC-1 quoteLines quotes each line and a blank line as a bare marker', () => {
  assert.equal(JT.quoteLines('a  \n\n  b'), '> a\n>\n>   b');
});

test('jira-entry AC-1 taskRequest writes the key line and quotes each part', () => {
  const body = JT.taskRequest(TASK);
  assert.equal(body, [
    `Jira: PROJ-482 ${LINK}`, '', 'Title:', '', '> Login times out after 30 seconds', '',
    'Description:', '', '> Line one', '> Line two', '', 'Acceptance criteria field:', '', '> It answers in 5 seconds',
  ].join('\n'));
});

test('jira-entry AC-1 taskRequest leaves out an empty description, an absent field and an absent link', () => {
  const body = JT.taskRequest({ ...TASK, url: null, description: '', acceptanceCriteria: null });
  assert.equal(body, 'Jira: PROJ-482\n\nTitle:\n\n> Login times out after 30 seconds');
});

test('jira-entry AC-1 taskRequest quotes a description line that starts with a heading or a key line', () => {
  const body = JT.taskRequest({ ...TASK, description: '## Not a heading\nJira: OTHER-1' });
  assert.ok(body.includes('> ## Not a heading\n> Jira: OTHER-1'));
  assert.equal(JT.recordedTask(`## Request\n\n${body}\n\n## Next\n`).key, 'PROJ-482');
});

test('jira-entry AC-5 recordedTask reads the first line of the request section', () => {
  const text = `# R\n\n## Request\n\n${JT.taskRequest(TASK)}\n\n## Assumptions\n\n- x\n`;
  assert.deepEqual(JT.recordedTask(text), { key: 'PROJ-482', link: LINK });
  assert.deepEqual(JT.recordedTask('## Request  \r\n\r\nJira: PROJ-482\r\n'), { key: 'PROJ-482', link: null });
});

test('jira-entry AC-5 recordedTask returns null where no key line is recorded', () => {
  assert.equal(JT.recordedTask(''), null);
  assert.equal(JT.recordedTask(undefined), null);
  assert.equal(JT.recordedTask('# R\n\n## Other\n\nJira: PROJ-1\n'), null);
  assert.equal(JT.recordedTask('## Request\n\n## Next\n\nJira: PROJ-1\n'), null);
  assert.equal(JT.recordedTask('## Request\n\n> Jira: PROJ-1\n'), null);
  assert.equal(JT.recordedTask('## Request\n\n> some text\n\nJira: PROJ-1\n'), null);
  assert.equal(JT.recordedTask('## Request\n\n'), null);
  assert.equal(JT.recordedTask('## Request\n\nadd a login page\n'), null);
});

test('jira-entry AC-5 recordedTask reads a section that runs to the end of the file', () => {
  assert.deepEqual(JT.recordedTask('## Request\n\nJira: PROJ-5 https://x.example/browse/PROJ-5'), { key: 'PROJ-5', link: 'https://x.example/browse/PROJ-5' });
});

test('jira-entry AC-7 commentText names the link and the change in the language of the files', () => {
  const ref = { url: 'https://github.com/o/r/pull/12', id: 'proj-482-login' };
  assert.equal(JT.commentText('en', ref), 'devkit opened the pull request https://github.com/o/r/pull/12 for this task (change proj-482-login).');
  const pt = JT.commentText('pt-BR', ref);
  assert.ok(pt.includes(ref.url) && pt.includes(ref.id));
  assert.notEqual(pt, JT.commentText('en', ref));
  assert.equal(JT.commentText('fr', ref), JT.commentText('en', ref));
});

test('jira-entry AC-6 writeBackInput reads valid input and keeps the first of a repeated id', () => {
  const raw = JSON.stringify({ number: 12, url: 'https://github.com/o/r/pull/12', transitions: [{ id: '31', name: 'In Review' }, { id: 41, name: 'Done' }, { id: '31', name: 'Again' }] });
  assert.deepEqual(JT.writeBackInput(raw), { number: 12, url: 'https://github.com/o/r/pull/12', transitions: [{ id: '31', name: 'In Review' }, { id: '41', name: 'Done' }] });
  assert.deepEqual(JT.writeBackInput('{"number":1,"url":"https://x.example/p/1"}').transitions, []);
});

test('jira-entry AC-6 writeBackInput refuses malformed input with an error naming the field', () => {
  const ok = { number: 12, url: 'https://x.example/p/12', transitions: [] };
  const err = (o) => JT.writeBackInput(typeof o === 'string' ? o : JSON.stringify(o)).error;
  assert.match(err(''), /empty/);
  assert.match(err('{"number":'), /not JSON/);
  assert.match(err('[]'), /not an object/);
  assert.match(err({ ...ok, number: 0 }), /number/);
  assert.match(err({ ...ok, number: 1.5 }), /number/);
  assert.match(err({ ...ok, number: '12' }), /number/);
  assert.match(err({ ...ok, url: 'ftp://x' }), /url/);
  assert.match(err({ ...ok, url: undefined }), /url/);
  assert.match(err({ ...ok, transitions: 'x' }), /transitions/);
  assert.match(err({ ...ok, transitions: [1] }), /transitions/);
  assert.match(err({ ...ok, transitions: [{ id: '', name: 'A' }] }), /transitions/);
  assert.match(err({ ...ok, transitions: [{ id: '1', name: ' ' }] }), /transitions/);
  assert.match(err({ ...ok, transitions: [{ id: {}, name: 'A' }] }), /transitions/);
});

test('jira-entry AC-6 writeBackChoices lists the transitions, then only comment, then no', () => {
  assert.deepEqual(JT.writeBackChoices([{ id: '31', name: 'In Review' }]), [
    { choice: 'transition:31', kind: 'transition', name: 'In Review' },
    { choice: 'comment', kind: 'comment' },
    { choice: 'no', kind: 'no' },
  ]);
  assert.deepEqual(JT.writeBackChoices([]).map((c) => c.choice), ['comment', 'no']);
});

// AC-9: the only files that know Jira open no network connection.
const NETWORK_IMPORT = /(?:from\s+|import\s*\(\s*|require\s*\(\s*)['"](?:node:)?(?:http|https|net|tls|dgram|undici)['"]/;
const FETCH_CALL = /\bfetch\s*\(/;
function opensNetwork(source) {
  return NETWORK_IMPORT.test(source) || FETCH_CALL.test(source);
}

test('jira-entry AC-9 jira-task.mjs and change-loop.mjs open no network connection', () => {
  assert.throws(() => assert.equal(opensNetwork('const r = await fetch("https://x");'), false));
  assert.throws(() => assert.equal(opensNetwork("import https from 'node:https';"), false));
  assert.equal(opensNetwork("import { join } from 'node:path';"), false);
  for (const file of ['jira-task.mjs', 'change-loop.mjs']) {
    assert.equal(opensNetwork(readFileSync(join(HERE, file), 'utf8')), false, file);
  }
});
