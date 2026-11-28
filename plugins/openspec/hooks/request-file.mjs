// The request files of a conducted roadmap run (helper-conductor D-17, D-19): `openspec/changes/<id>/requests/<n>-<slug>.md`
// written by a helper through `roadmap-loop.mjs request`, and the answer beside it, `<n>-<slug>.answer.md`, written through
// `roadmap-loop.mjs answer` only. `<n>` counts from 1 in the folder and `<slug>` is the gate id. Runs nothing when imported;
// the CLI verbs that call it are a later task's.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { GATE_IDS } from './standing-answers.mjs';

export const SUMMARY_LINES = 12;
export const APPROVAL_WORDS_MAX = 200;

// A refusal of the request or the answer verb: `code` names it, `exit` is the CLI's exit status (3, usage), `heading` and `count`
// carry what the code names (the heading a request lacks, the lines of a summary that is too long).
export class RequestError extends Error {
  constructor(code, message, extra = {}) {
    super(message);
    this.name = 'RequestError';
    this.code = code;
    this.exit = 3;
    Object.assign(this, extra);
  }
}

const REQUEST_HEADER = /^<!-- devkit-request gate=([\w-]+) at=(\S+) -->$/;
const ANSWER_HEADER = /^<!-- devkit-answer by=(owner|delegated) line=(\d+|none) at=(\S+) -->$/;
const TITLE = /^# Request(?: \d+)?:\s*(\S.*?)\s*$/;
const REQUEST_FILE = /^(\d+)-([\w-]+)\.md$/;
const ANSWER_FILE = /^(\d+)-([\w-]+)\.answer\.md$/;

// The sections of a request text: `{ sections: { <heading>: <text> }, headings, open }`, where `open` says whether a fence is left
// unclosed. A line inside a fenced block (``` or ~~~) is no heading.
function sectionsOf(lines) {
  const sections = {};
  let current = null;
  let fence = null;
  for (const line of lines) {
    const mark = line.trim().match(/^(`{3,}|~{3,})/)?.[1];
    if (fence) {
      if (mark && mark[0] === fence[0] && mark.length >= fence.length) fence = null;
    } else if (mark) {
      fence = mark;
    } else {
      const heading = line.match(/^## (\S.*?)\s*$/);
      if (heading) { current = heading[1]; sections[current] = []; continue; }
    }
    if (current !== null) sections[current].push(line);
  }
  return { sections: Object.fromEntries(Object.entries(sections).map(([k, v]) => [k, v.join('\n').trim()])), open: fence !== null };
}

// The sections an approval request holds instead of `Facts` (D-19).
const middleOf = (gate) => (gate === 'approval' ? 'Summary' : 'Facts');

// Reads a request text (header included): `{ ok: true, gate, at, title, question, facts | summary, recommendation }`, or
// `{ ok: false, code, heading? , count? }` naming what is wrong. It does not read the file's name.
export function parseRequest(text) {
  const lines = String(text).split(/\r?\n/);
  const header = lines[0]?.match(REQUEST_HEADER);
  if (!header) return { ok: false, code: 'no-header' };
  const [, gate, at] = header;
  if (!GATE_IDS.includes(gate)) return { ok: false, code: 'unknown-gate' };
  const title = lines[1]?.match(TITLE);
  if (!title) return { ok: false, code: 'missing-heading', heading: '# Request' };
  return shapeOf(lines.slice(2), { gate, at, title: title[1] });
}

function shapeOf(body, base) {
  const { sections, open } = sectionsOf(body);
  if (open) return { ok: false, code: 'unclosed-fence' };
  const middle = middleOf(base.gate);
  for (const heading of ['Question', middle, 'Recommendation']) {
    if (!(heading in sections)) return { ok: false, code: 'missing-heading', heading };
  }
  const count = sections[middle].split('\n').filter((l) => l.trim() !== '').length;
  if (middle === 'Summary' && count > SUMMARY_LINES) return { ok: false, code: 'summary-too-long', count };
  return { ok: true, ...base, question: sections.Question, [middle.toLowerCase()]: sections[middle], recommendation: sections.Recommendation };
}

const requestsDir = (change) => join(change, 'requests');

function entriesOf(change) {
  try { return readdirSync(requestsDir(change)); } catch { return []; }
}

// The requests of a change folder in order: `[{ n, gate, file, answerFile, answered }]`; `answered` tells that the answer file
// reads as an answer.
export function listRequests(change) {
  const found = [];
  for (const name of entriesOf(change)) {
    const m = name.match(REQUEST_FILE);
    if (!m || ANSWER_FILE.test(name)) continue;
    const n = Number(m[1]);
    found.push({ n, gate: m[2], file: join(requestsDir(change), name), answerFile: join(requestsDir(change), `${m[1]}-${m[2]}.answer.md`) });
  }
  return found.sort((a, b) => a.n - b.n).map((r) => ({ ...r, answered: readAnswerFile(r.answerFile) !== null }));
}

// Copies the draft at `file` into `requests/<n>-<gate>.md`, stamping its header and its number, after checking its shape; nothing is
// written when it is refused. → `{ n, file }`.
export function writeRequest({ change, gate, file, now = new Date() }) {
  if (!GATE_IDS.includes(gate)) throw new RequestError('unknown-gate', `${gate} is not a gate id (${GATE_IDS.join(', ')})`);
  let text;
  try { text = readFileSync(file, 'utf8'); } catch { throw new RequestError('no-draft', `cannot read the draft ${file}`); }
  const lines = text.split(/\r?\n/);
  if (REQUEST_HEADER.test(lines[0] ?? '')) lines.shift();
  while (lines.length && lines[0].trim() === '') lines.shift();
  const title = lines[0]?.match(TITLE);
  if (!title) throw new RequestError('missing-heading', 'the draft lacks its title line, `# Request: <one line>`', { heading: '# Request' });
  const shaped = shapeOf(lines.slice(1), { gate, at: now.toISOString(), title: title[1] });
  if (!shaped.ok) throw refusalOf(shaped);
  const n = 1 + Math.max(0, ...entriesOf(change).map((name) => Number(name.match(/^(\d+)-/)?.[1] ?? 0)));
  const out = join(requestsDir(change), `${n}-${gate}.md`);
  mkdirSync(requestsDir(change), { recursive: true });
  writeFileSync(out, `<!-- devkit-request gate=${gate} at=${shaped.at} -->\n# Request ${n}: ${shaped.title}\n${lines.slice(1).join('\n').replace(/\s+$/, '')}\n`);
  return { n, file: out };
}

function refusalOf(shaped) {
  if (shaped.code === 'missing-heading') return new RequestError(shaped.code, `the request lacks its \`## ${shaped.heading}\` heading`, { heading: shaped.heading });
  if (shaped.code === 'summary-too-long') return new RequestError(shaped.code, `the summary holds ${shaped.count} lines, at most ${SUMMARY_LINES}`, { count: shaped.count });
  return new RequestError(shaped.code, 'the request has a fenced block that is never closed');
}

// An approval's words are cut at 200 characters (D-19), as the `ship-change` row says.
export function cutApprovalWords(words) {
  return Array.from(String(words)).slice(0, APPROVAL_WORDS_MAX).join('');
}

// Writes the answer of request `n`. `by` is `owner` or `delegated`, `line` the standing answer's line (a delegated answer) or
// null. An approval's words are cut at 200 characters. → `{ file }`.
export function writeAnswer({ change, n, by, line = null, words, now = new Date() }) {
  const request = listRequests(change).find((r) => r.n === Number(n));
  if (!request) throw new RequestError('no-request', `the change has no request ${n}`);
  if (by !== 'owner' && by !== 'delegated') throw new RequestError('bad-author', `an answer is by owner or delegated, not ${by}`);
  if (line !== null && !(Number.isInteger(Number(line)) && Number(line) >= 1 && /^\d+$/.test(String(line)))) throw new RequestError('bad-line', `the line is a number, not ${line}`);
  const text = String(words ?? '').trim();
  if (text === '') throw new RequestError('no-words', 'an answer has words');
  if (existsSync(request.answerFile)) throw new RequestError('already-answered', `request ${n} has its answer already`);
  const kept = request.gate === 'approval' ? cutApprovalWords(text) : text;
  writeFileSync(request.answerFile, `<!-- devkit-answer by=${by} line=${line === null ? 'none' : Number(line)} at=${now.toISOString()} -->\n## Answer\n${kept}\n`);
  return { file: request.answerFile };
}

function readAnswerFile(file) {
  let text;
  try { text = readFileSync(file, 'utf8'); } catch { return null; }
  const lines = text.split(/\r?\n/);
  const header = lines[0]?.match(ANSWER_HEADER);
  if (!header || lines[1] !== '## Answer') return null;
  const words = lines.slice(2).join('\n').trim();
  if (words === '') return null;
  return { by: header[1], line: header[2] === 'none' ? null : Number(header[2]), at: header[3], words };
}

// The answer of request `n`, or null when there is none or the file does not parse.
export function readAnswer({ change, n }) {
  const request = listRequests(change).find((r) => r.n === Number(n));
  return request ? readAnswerFile(request.answerFile) : null;
}
