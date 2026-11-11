// The loader of the review round's rules, and the CLI of the `agents` path.
// The rules live once, in review-round.workflow.js (between the rules markers);
// this module reads that section and exports what it defines.
import { readFileSync, existsSync, realpathSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const SCRIPT_FILE = join(here, 'review-round.workflow.js');

const NAMES = [
  'STAGE1_SCHEMA', 'VOTE_SCHEMA', 'WRITE_SCHEMA', 'validateArgs', 'validateStage1', 'needsVerification', 'isRefutation',
  'decide', 'oneLine', 'findingLine', 'outcomeOf', 'consensusOf', 'reviewerPrompt', 'verifierPrompt', 'writerPrompt', 'consolidate',
];
const BEGIN = /^\/\/ ---- rules: begin.*$/m;
const END = /^\/\/ ---- rules: end.*$/m;

export function loadRules(file = SCRIPT_FILE) {
  const notFound = () => new Error(`review usage: rules section not found in ${file}`);
  const text = readFileSync(file, 'utf8');
  const begin = BEGIN.exec(text);
  const end = END.exec(text);
  if (!begin || !end || end.index < begin.index) throw notFound();
  const section = text.slice(begin.index + begin[0].length, end.index);
  let rules;
  try {
    rules = new Function(`${section}\nreturn { ${NAMES.join(', ')} };`)();
  } catch {
    throw notFound();
  }
  if (NAMES.some((n) => rules[n] === undefined)) throw notFound();
  return rules;
}

export const {
  STAGE1_SCHEMA, VOTE_SCHEMA, WRITE_SCHEMA, validateArgs, validateStage1, needsVerification, isRefutation,
  decide, oneLine, findingLine, outcomeOf, consensusOf, reviewerPrompt, verifierPrompt, writerPrompt, consolidate,
} = loadRules();

// ---- the CLI --------------------------------------------------------------
// node review-round.mjs <stage1|verify|outcomes|consolidate|check-file> --input <json file>
// JSON on stdout; exit 0 ok, 2 check-file mismatch, 3 usage or input error.

const SUBCOMMANDS = ['stage1', 'verify', 'outcomes', 'consolidate', 'check-file'];
const VERIFIER = 'devkit-core:finding-verifier';

const usage = (what) => new Error(`review usage: ${what}`);
const invalid = (what) => new Error(`review input invalid: ${what}`);
const mismatch = (file, what) => new Error(`review file mismatch: ${file}: ${what}`);
const plain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// The last fenced json block of a reply, parsed; null when there is none or it does not parse.
function lastJsonBlock(text) {
  const last = [...text.matchAll(/```json[^\n]*\n([\s\S]*?)```/g)].at(-1);
  if (!last) return null;
  try { return JSON.parse(last[1]); } catch { return null; }
}

// An object, a text holding a fenced json block, or null: anything else is a bad call.
function valueOf(raw, what) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'string') return lastJsonBlock(raw);
  if (plain(raw)) return raw;
  throw invalid(`${what} must be an object, a text or null`);
}

const failedReview = (reviewer) => ({ reviewer, stage: 'review', error: `review stage failed: ${reviewer} review` });

// Splits the bench into the reviewers whose stage 1 is usable and the ones that failed.
function readStage1(args, stage1) {
  if (!plain(stage1)) throw invalid('stage1 must be an object keyed by reviewer');
  const passed = [];
  const failed = [];
  for (const entry of args.bench) {
    const value = valueOf(stage1[entry.reviewer], `stage1.${entry.reviewer}`);
    let normalized = null;
    if (value) {
      try { normalized = validateStage1(entry.reviewer, value); } catch { normalized = null; }
    }
    if (normalized) passed.push({ entry, stage1: normalized });
    else failed.push(failedReview(entry.reviewer));
  }
  return { passed, failed };
}

function stage1Command({ args }) {
  const a = validateArgs(args);
  return { jobs: a.bench.map((entry) => ({ reviewer: entry.reviewer, agentType: `devkit-core:${entry.reviewer}`, prompt: reviewerPrompt(a, entry) })) };
}

function verifyCommand({ args, stage1 }) {
  const a = validateArgs(args);
  const { passed, failed } = readStage1(a, stage1);
  const jobs = [];
  for (const p of passed) {
    for (const finding of p.stage1.findings.filter(needsVerification)) {
      for (let k = 1; k <= 3; k += 1) {
        jobs.push({ reviewer: p.entry.reviewer, id: finding.id, k, agentType: VERIFIER, prompt: verifierPrompt(a, p.entry, finding) });
      }
    }
  }
  return { jobs, failed };
}

function outcomesCommand({ args, stage1, votes }) {
  const a = validateArgs(args);
  const { passed, failed } = readStage1(a, stage1);
  if (votes !== undefined && !plain(votes)) throw invalid("votes must be an object keyed '<reviewer>#<id>'");
  const outcomes = passed.map((p) => {
    const byId = {};
    for (const finding of p.stage1.findings.filter(needsVerification)) {
      const key = `${p.entry.reviewer}#${finding.id}`;
      const list = (votes || {})[key];
      if (list !== undefined && !Array.isArray(list)) throw invalid(`votes['${key}'] must be a list`);
      byId[finding.id] = (list || []).map((v) => valueOf(v, `votes['${key}'] entry`));
    }
    return outcomeOf(a, p.stage1, byId);
  });
  return { outcomes, failed, verifiersFailed: outcomes.reduce((sum, o) => sum + o.voteFailures, 0) };
}

function consolidateCommand({ args, outcomes, failed, notes }) {
  const a = validateArgs(args);
  if (!Array.isArray(outcomes)) throw invalid('outcomes must be a list');
  if (failed !== undefined && !Array.isArray(failed)) throw invalid('failed must be a list');
  if (notes !== undefined && !Array.isArray(notes)) throw invalid('notes must be a list');
  return consolidate({ args: a, outcomes, failed: failed || [], notes: notes || [] });
}

// Line 1, line 2 and every blocking or important line of the outcome, as the writer was asked to write them.
function checkFileCommand({ file, outcome }) {
  if (typeof file !== 'string' || !file) throw invalid('file must be a path');
  if (!plain(outcome) || typeof outcome.verdict !== 'string' || typeof outcome.commit !== 'string' || !Array.isArray(outcome.lines)) {
    throw invalid('outcome must hold verdict, commit and lines');
  }
  if (!existsSync(file)) throw mismatch(file, 'the file does not exist');
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  const verdict = `Verdict: ${outcome.verdict}`;
  if (lines[0] !== verdict) throw mismatch(file, `line 1 is "${lines[0] ?? ''}", expected "${verdict}"`);
  const commit = `Commit: ${outcome.commit}${outcome.uncommitted ? ' (uncommitted changes)' : ''}`;
  if (lines[1] !== commit) throw mismatch(file, `line 2 is "${lines[1] ?? ''}", expected "${commit}"`);
  const have = new Set(lines.map((l) => l.trimEnd()));
  for (const line of outcome.lines.filter((l) => /^- \[(?:blocking|important)\]/.test(l))) {
    if (!have.has(line)) throw mismatch(file, `missing the line "${line.slice(0, 120)}"`);
  }
  return { ok: true };
}

const COMMANDS = {
  stage1: stage1Command, verify: verifyCommand, outcomes: outcomesCommand,
  consolidate: consolidateCommand, 'check-file': checkFileCommand,
};

function readInput(file) {
  let text;
  try { text = readFileSync(file, 'utf8'); } catch (e) { throw usage(`cannot read ${file}: ${e.code ?? e.message}`); }
  let input;
  try { input = JSON.parse(text); } catch { throw invalid(`${file} is not JSON`); }
  if (!plain(input)) throw invalid(`${file} must hold a JSON object`);
  return input;
}

export function main(argv) {
  const [sub, flag, file] = argv;
  if (!SUBCOMMANDS.includes(sub)) throw usage(`expected one of ${SUBCOMMANDS.join(', ')}, got ${sub ?? 'nothing'}`);
  if (flag !== '--input' || !file) throw usage(`${sub} needs --input <json file>`);
  return COMMANDS[sub](readInput(file));
}

function runCli() {
  try {
    process.stdout.write(`${JSON.stringify(main(process.argv.slice(2)))}\n`);
  } catch (e) {
    const message = String(e?.message ?? e);
    if (/^review file mismatch:/.test(message)) { process.stderr.write(`${message}\n`); process.exit(2); }
    if (/^review (usage|input invalid):/.test(message)) { process.stderr.write(`${message}\n`); process.exit(3); }
    throw e;
  }
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) runCli();
