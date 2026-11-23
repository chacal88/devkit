// jira-task: everything Jira-shaped that `/devkit change` needs, as pure functions (design jira-entry D-1).
//
// It recognises a Jira key or link, validates the task the session reads through its own connector, writes and reads
// the `## Request` section of `requirements.md`, and builds the write-back comment and choices. It does no I/O, opens
// no network connection, keeps no token and runs nothing when imported. The session makes every connector call; the
// script only sees the small JSON object the session maps the task to. No dependencies.

export const TASK_KEY = /^[A-Z][A-Z0-9_]+-[0-9]+$/;
const KEY_IN_PATH = /\/browse\/([A-Z][A-Z0-9_]+-[0-9]+)(?:\/|$)/;
const KEY_LINE = /^Jira: ([A-Z][A-Z0-9_]+-[0-9]+)(?:[ \t]+(https?:\/\/\S+))?[ \t]*$/;
const HTTP_LINK = /^https?:\/\/\S+$/;

// A key typed alone, or a browse or board link that names one: { key, link } (link null for a bare key), else null.
export function parseTaskRef(text) {
  const t = String(text ?? '').trim();
  if (TASK_KEY.test(t)) return { key: t, link: null };
  if (!/^https?:\/\/\S+$/i.test(t)) return null;
  let url;
  try { url = new URL(t); } catch { return null; }
  const fromPath = KEY_IN_PATH.exec(url.pathname);
  if (fromPath) return { key: fromPath[1], link: t };
  const selected = url.searchParams.get('selectedIssue');
  return selected !== null && TASK_KEY.test(selected) ? { key: selected, link: t } : null;
}

// The id prefix of a change opened from the task: `PROJ-482` gives `proj-482`, `MY_APP-7` gives `my-app-7`.
export function taskIdPrefix(key) {
  return String(key).toLowerCase().replace(/_/g, '-').replace(/-+/g, '-').replace(/-+$/, '');
}

const lf = (s) => s.replace(/\r\n?/g, '\n');

// The JSON the session pipes to `open --task`: { task } with the five fields, or { error }. Every other field is ignored.
export function taskFromJson(text, key) {
  const raw = String(text ?? '');
  if (raw.trim() === '') return { error: 'the task on standard input is empty' };
  let value;
  try { value = JSON.parse(raw); } catch { return { error: 'the task on standard input is not JSON' }; }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return { error: 'the task on standard input is not an object' };
  if (value.key !== key) return { error: `the task names ${value.key}, not ${key}` };
  if (typeof value.title !== 'string' || value.title.trim() === '') return { error: 'the task has no title' };
  const { description, acceptanceCriteria, url } = value;
  if (description != null && typeof description !== 'string') return { error: "the task's description is not text" };
  if (acceptanceCriteria != null && typeof acceptanceCriteria !== 'string') return { error: "the task's acceptance criteria are not text" };
  if (url != null && !(typeof url === 'string' && HTTP_LINK.test(url))) return { error: "the task's link is not an http(s) link" };
  const criteria = acceptanceCriteria == null || acceptanceCriteria.trim() === '' ? null : lf(acceptanceCriteria);
  return { task: { key, url: url ?? null, title: lf(value.title), description: description == null ? '' : lf(description), acceptanceCriteria: criteria } };
}

// Each line as a Markdown quote; a blank line as a bare marker.
export function quoteLines(text) {
  return text.split('\n').map((line) => (line.trim() === '' ? '>' : `> ${line.replace(/\s+$/, '')}`)).join('\n');
}

// The body of `## Request` for a task: the key line first, then each part quoted.
export function taskRequest(task) {
  const parts = [`Jira: ${task.key}${task.url ? ` ${task.url}` : ''}`, `Title:\n\n${quoteLines(task.title)}`];
  if (task.description.trim() !== '') parts.push(`Description:\n\n${quoteLines(task.description)}`);
  if (task.acceptanceCriteria !== null) parts.push(`Acceptance criteria field:\n\n${quoteLines(task.acceptanceCriteria)}`);
  return parts.join('\n\n');
}

// The task a `requirements.md` records: the first non-blank line of its `## Request` section, when it is a key line.
// Only that line is read, so a key line inside the quoted task can never be taken as the record.
export function recordedTask(text) {
  const lines = lf(String(text ?? '')).split('\n');
  const at = lines.findIndex((l) => l.replace(/\s+$/, '') === '## Request');
  if (at < 0) return null;
  for (let i = at + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) return null;
    if (lines[i].trim() === '') continue;
    const m = KEY_LINE.exec(lines[i]);
    return m ? { key: m[1], link: m[2] ?? null } : null;
  }
  return null;
}

const COMMENTS = {
  en: ({ url, id }) => `devkit opened the pull request ${url} for this task (change ${id}).`,
  'pt-BR': ({ url, id }) => `o devkit abriu o pull request ${url} para esta tarefa (change ${id}).`,
};

// The comment written on the task, in the language of the project's files (English for any other tag).
export function commentText(filesLanguage, ref) {
  return (COMMENTS[filesLanguage] ?? COMMENTS.en)(ref);
}

// The JSON the session pipes to `write-back ask`: { number, url, transitions } or { error } naming the field.
export function writeBackInput(text) {
  const raw = String(text ?? '');
  if (raw.trim() === '') return { error: 'the write-back input is empty' };
  let v;
  try { v = JSON.parse(raw); } catch { return { error: 'the write-back input is not JSON' }; }
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return { error: 'the write-back input is not an object' };
  if (!Number.isInteger(v.number) || v.number < 1) return { error: 'the write-back number is not a positive integer' };
  if (typeof v.url !== 'string' || !HTTP_LINK.test(v.url)) return { error: 'the write-back url is not an http(s) link' };
  const list = v.transitions === undefined ? [] : v.transitions;
  if (!Array.isArray(list)) return { error: 'the write-back transitions are not a list' };
  const transitions = [];
  for (const t of list) {
    const idOk = typeof t?.id === 'number' || (typeof t?.id === 'string' && t.id !== '');
    if (t === null || typeof t !== 'object' || !idOk || typeof t.name !== 'string' || t.name.trim() === '') {
      return { error: 'a write-back transitions entry needs an id and a name' };
    }
    const id = String(t.id);
    if (!transitions.some((x) => x.id === id)) transitions.push({ id, name: t.name });
  }
  return { number: v.number, url: v.url, transitions };
}

// The choices the developer is offered: each transition, then only a comment, then no.
export function writeBackChoices(transitions) {
  return [
    ...transitions.map((t) => ({ choice: `transition:${t.id}`, kind: 'transition', name: t.name })),
    { choice: 'comment', kind: 'comment' },
    { choice: 'no', kind: 'no' },
  ];
}
