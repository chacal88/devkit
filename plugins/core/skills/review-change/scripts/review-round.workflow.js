export const meta = { name: 'review-round', description: 'Runs the review-change round in three stages: reviewers in parallel, three refuting verifiers per open blocking or important finding, then each reviewer writes its own verdict file.', phases: ['review', 'verify', 'write'] }

// ---- rules: begin   (pure: no tool globals, no module loading, no clock, no randomness)
const REVIEWERS = ['code-quality-reviewer', 'test-coverage-reviewer', 'architecture-reviewer', 'security-reviewer', 'adr-reviewer', 'spec-reviewer'];
const VERIFIERS = 3;
const MAJORITY = Math.floor(VERIFIERS / 2) + 1;
const SEVERITIES = ['blocking', 'important', 'nit', 'praise'];

const STAGE1_SCHEMA = {
  type: 'object',
  required: ['declined', 'commit', 'heading', 'read', 'notRead', 'findings', 'sections'],
  properties: {
    declined: { type: 'boolean' },
    commit: { type: 'string', description: 'the full 40 hex sha git rev-parse HEAD prints' },
    heading: { type: 'string', description: 'the "## ..." title line of your review' },
    read: { type: 'array', items: { type: 'string' }, description: 'every repo-relative path you opened' },
    notRead: { type: 'array', items: { type: 'string' }, description: 'every path of your remit you did not open; empty when you opened them all' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['severity', 'location', 'text'],
        properties: {
          id: { type: 'string', description: 'F1, F2, ... in order' },
          severity: { enum: ['blocking', 'important', 'nit', 'praise'] },
          location: { type: 'string', description: 'file:line or section' },
          text: { type: 'string', description: 'one line' },
          disposition: { type: ['string', 'null'], description: 'null, "fixed in <one sha>" or "refuted: <evidence>"' },
        },
      },
    },
    sections: { type: 'string', description: 'the rest of your output as Markdown, without the findings list and without a Verdict: or Commit: line' },
  },
};

const VOTE_SCHEMA = {
  type: 'object',
  required: ['refuted', 'evidence'],
  properties: {
    refuted: { type: 'boolean' },
    evidence: { type: 'string', description: 'code at file:line, a test and its output, or a command and its output' },
  },
};

const WRITE_SCHEMA = {
  type: 'object',
  required: ['written', 'verdict', 'commit'],
  properties: {
    written: { type: 'boolean' },
    verdict: { enum: ['approved', 'rejected', 'declined'] },
    commit: { type: 'string' },
  },
};

function invalid(what) {
  throw new Error('review input invalid: ' + what);
}

function oneLine(text, max = 400) {
  const s = String(text === null || text === undefined ? '' : text).replace(/\s+/g, ' ').replace(/·/g, '-').trim();
  return s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s;
}

function validateArgs(args) {
  if (!args || typeof args !== 'object' || Array.isArray(args)) invalid('args must be an object');
  for (const k of ['change', 'changeDir', 'range']) {
    if (typeof args[k] !== 'string' || !args[k].trim()) invalid('args.' + k + ' must be a non-empty string');
  }
  if (typeof args.head !== 'string' || !/^[0-9a-f]{40}$/.test(args.head)) invalid('args.head must be the full 40 hex sha git rev-parse HEAD prints');
  if (!isPathList(args.dirty)) invalid('args.dirty must be a list of paths');
  if (args.round !== 1 && args.round !== 2) invalid('args.round must be 1 or 2');
  if (args.path !== 'workflow' && args.path !== 'agents') invalid("args.path must be 'workflow' or 'agents'");
  if (args.structural !== 'PASS') invalid("args.structural must be 'PASS'");
  if (typeof args.preamble !== 'string') invalid('args.preamble must be a string');
  if (args.verdictDir !== undefined && (typeof args.verdictDir !== 'string' || !args.verdictDir.trim())) invalid('args.verdictDir must be a non-empty string');
  if (!Array.isArray(args.bench) || args.bench.length < 1 || args.bench.length > 6) invalid('args.bench must hold 1 to 6 entries');
  const seen = [];
  args.bench.forEach((e, i) => {
    if (!e || typeof e !== 'object' || !REVIEWERS.includes(e.reviewer)) invalid('args.bench[' + i + '].reviewer must be one of the six reviewers');
    if (seen.includes(e.reviewer)) invalid('args.bench lists ' + e.reviewer + ' twice');
    seen.push(e.reviewer);
    for (const k of ['previous', 'range']) {
      if (e[k] !== null && e[k] !== undefined && typeof e[k] !== 'string') invalid('args.bench[' + i + '].' + k + ' must be null or a string');
    }
  });
  return args;
}

// A line that only lines 1 and 2 of a verdict file may hold: it begins, after optional spaces, with `Verdict:` or `Commit:`.
const HEADER_LINE = /^\s*(?:Verdict|Commit):/;

function isHeaderLine(line) {
  return HEADER_LINE.test(String(line));
}

function withoutHeaderLines(text) {
  return String(text).split('\n').filter((l) => !isHeaderLine(l)).join('\n');
}

function isPathList(list) {
  return Array.isArray(list) && list.every((p) => typeof p === 'string' && p.trim() !== '');
}

function validateStage1(reviewer, value, head) {
  if (!REVIEWERS.includes(reviewer)) invalid('unknown reviewer ' + reviewer);
  if (typeof head !== 'string' || !/^[0-9a-f]{40}$/.test(head)) invalid('head must be a full 40 hex sha');
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(reviewer + ': the stage 1 return must be an object');
  if (typeof value.declined !== 'boolean') invalid(reviewer + ': declined must be a boolean');
  if (typeof value.commit !== 'string' || !/^[0-9a-f]{40}$/.test(value.commit)) invalid(reviewer + ': commit must be a full 40 hex sha');
  if (typeof value.heading !== 'string' || !value.heading.trim()) invalid(reviewer + ': heading must be a non-empty string');
  if (!Array.isArray(value.findings)) invalid(reviewer + ': findings must be a list');
  if (typeof value.sections !== 'string') invalid(reviewer + ': sections must be a string');
  if (value.commit !== head) invalid(reviewer + ': commit ' + value.commit + ' is not HEAD ' + head);
  if (!isPathList(value.read)) invalid(reviewer + ': read must be a list of paths');
  if (!isPathList(value.notRead)) invalid(reviewer + ': notRead must be a list of paths');
  if (value.notRead.length > 0) invalid(reviewer + ': partial review: not read ' + value.notRead.slice(0, 3).join(', '));
  if (value.declined === false && value.read.length === 0) invalid(reviewer + ': partial review: nothing read');
  const ids = [];
  const findings = value.findings.map((f, i) => {
    if (!f || typeof f !== 'object') invalid(reviewer + ': finding ' + (i + 1) + ' must be an object');
    if (!SEVERITIES.includes(f.severity)) invalid(reviewer + ': finding ' + (i + 1) + ' has an unknown severity');
    if (typeof f.text !== 'string' || !f.text.trim()) invalid(reviewer + ': finding ' + (i + 1) + ' has no text');
    if (f.location !== undefined && typeof f.location !== 'string') invalid(reviewer + ': finding ' + (i + 1) + ' location must be a string');
    const id = typeof f.id === 'string' && /^F\d+$/.test(f.id) ? f.id : 'F' + (i + 1);
    if (ids.includes(id)) invalid(reviewer + ': finding id ' + id + ' is used twice');
    ids.push(id);
    let disposition = null;
    if (f.disposition !== null && f.disposition !== undefined) {
      disposition = oneLine(f.disposition, 400);
      if (!/^(fixed in [0-9a-f]{7,40}|refuted:\s*\S.*)$/i.test(disposition)) invalid(reviewer + ': finding ' + id + ' has a disposition that is neither "fixed in <sha>" nor "refuted: <evidence>"');
    }
    return { id, severity: f.severity, location: oneLine(f.location, 200), text: oneLine(f.text, 2000), disposition };
  });
  return {
    reviewer,
    declined: value.declined,
    commit: value.commit,
    heading: oneLine(value.heading, 300),
    findings,
    sections: withoutHeaderLines(value.sections),
  };
}

function needsVerification(finding) {
  return !!finding && (finding.severity === 'blocking' || finding.severity === 'important') && (finding.disposition === null || finding.disposition === undefined);
}

function isRefutation(vote) {
  return !!vote && typeof vote === 'object' && vote.refuted === true && typeof vote.evidence === 'string' && vote.evidence.trim() !== '';
}

function decide(votes) {
  const refuting = (votes || []).filter(isRefutation);
  return {
    refuted: refuting.length >= MAJORITY,
    refutations: refuting.length,
    evidence: refuting.map((v) => oneLine(v.evidence, 400)).join(' / '),
  };
}

// One job per verifier per finding that needs verification, for each reviewer that passed stage 1.
function verifyJobs(args, passed) {
  const jobs = [];
  for (const p of passed) {
    for (const finding of p.stage1.findings.filter(needsVerification)) {
      for (let k = 1; k <= VERIFIERS; k += 1) {
        jobs.push({
          entry: p.entry, reviewer: p.entry.reviewer, finding, id: finding.id, k,
          label: p.entry.reviewer + ' ' + finding.id + ' v' + k,
          prompt: verifierPrompt(args, p.entry, finding),
        });
      }
    }
  }
  return jobs;
}

// One writer job per outcome, in the order of the outcomes: both paths send exactly these.
function writeJobs(args, outcomes) {
  return outcomes.map((o) => ({ reviewer: o.reviewer, agentType: 'devkit-core:' + o.reviewer, prompt: writerPrompt(args, o) }));
}

// The votes in the order of the jobs, as { reviewer: { findingId: [vote ...] } }.
function groupVotes(jobs, votes) {
  const by = {};
  jobs.forEach((j, i) => {
    if (!by[j.reviewer]) by[j.reviewer] = {};
    if (!by[j.reviewer][j.id]) by[j.reviewer][j.id] = [];
    by[j.reviewer][j.id].push(votes[i]);
  });
  return by;
}

// null when the writer returned what the outcome says; else the reason it did not.
function writeMismatch(outcome, returned) {
  if (!returned || returned.written !== true) return 'the writer wrote nothing';
  if (returned.verdict !== outcome.verdict) return 'the writer returned verdict ' + returned.verdict + ', expected ' + outcome.verdict;
  if (returned.commit !== outcome.commit) return 'the writer returned commit ' + returned.commit + ', expected ' + outcome.commit;
  return null;
}

function findingLine(finding) {
  const where = finding.location ? finding.location + ' — ' : '';
  const tail = finding.disposition ? ' · ' + finding.disposition : '';
  return '- [' + finding.severity + '] ' + where + finding.text + tail;
}

function outcomeOf(args, stage1, votesById) {
  const byId = votesById || {};
  let verified = 0;
  let refuted = 0;
  let voteFailures = 0;
  const findings = stage1.findings.map((f) => {
    if (f.disposition) return { ...f, status: 'disposed', disposition: f.disposition };
    if (!needsVerification(f)) return { ...f, status: 'open', disposition: null };
    verified += 1;
    const votes = byId[f.id] || [];
    voteFailures += Math.max(0, VERIFIERS - votes.filter((v) => v && typeof v === 'object').length);
    const d = decide(votes);
    if (!d.refuted) return { ...f, status: 'open', disposition: null, refutations: d.refutations };
    refuted += 1;
    return { ...f, status: 'refuted', disposition: 'refuted: ' + d.evidence, refutations: d.refutations };
  });
  const surviving = findings.some((f) => f.status === 'open' && needsVerification({ ...f, disposition: null }));
  return {
    reviewer: stage1.reviewer,
    declined: stage1.declined,
    commit: stage1.commit,
    uncommitted: Array.isArray(args.dirty) && args.dirty.length > 0,
    heading: stage1.heading,
    sections: stage1.sections,
    findings,
    lines: findings.map(findingLine),
    verified,
    refuted,
    voteFailures,
    verdict: stage1.declined ? 'declined' : surviving ? 'rejected' : 'approved',
  };
}

function consensusOf(outcomes, failed) {
  const clean = !failed || failed.length === 0;
  return clean && outcomes.every((o) => o.verdict === 'approved' || o.verdict === 'declined') ? 'PASS' : 'FAIL';
}

function lead(args) {
  return args.preamble ? args.preamble + '\n\n' : '';
}

function commitLine(outcome) {
  return 'Commit: ' + outcome.commit + (outcome.uncommitted ? ' (uncommitted changes)' : '');
}

function reviewerPrompt(args, entry) {
  const range = entry.range || args.range;
  const previous = entry.previous
    ? 'Your previous verdict file is ' + entry.previous + '. Re-list each of its findings with its disposition (fixed in <one sha>, the commit that holds the fix, or refuted: <evidence>) when it was dealt with; list the others as they stand.\n'
    : '';
  return lead(args)
    + 'This is stage 1 of a staged review round for change ' + args.change + ' (round ' + args.round + ' of 2).\n'
    + 'Change folder: ' + args.changeDir + '\n'
    + 'Review range: ' + range + '\n'
    + previous
    + 'Review as your own instructions say, but write no file: a later stage writes your verdict file. Run every test in the foreground and give your answer when it ends: start no background command and leave none running.\n'
    + 'Run git rev-parse HEAD in the worktree and put the full sha it prints in commit; the round refuses any other value, a short sha padded with zeros included.\n'
    + 'The round writes your Commit line itself, from git: it adds (uncommitted changes) only when a path outside openspec/ is uncommitted (an untracked path under .claude/ does not count); report nothing about it.\n'
    + 'List in read every repo-relative path you opened, and in notRead every path of your remit you did not open (an empty list when you opened them all); the round refuses an answer with a path in notRead, or with an empty read unless you declined.\n'
    + 'A disposition is either fixed in <sha>, naming exactly one sha, the commit that holds the fix, or refuted: <evidence>; never name two shas.\n'
    + 'sections holds neither a Verdict: line nor a Commit: line: stage 3 writes both.\n'
    + 'End your reply with one fenced json block holding one object: '
    + '{ declined: boolean, commit: "<the full sha git rev-parse HEAD printed>", heading: "<your ## title line>", '
    + 'read: ["<repo-relative path you opened>"], notRead: ["<path of your remit you did not open>"], '
    + 'findings: [ { id: "F1", severity: "blocking|important|nit|praise", location: "<file:line or section>", text: "<one line>", disposition: null or "fixed in <one sha>" or "refuted: <evidence>" } ], '
    + 'sections: "<the rest of your output as Markdown, without the findings list and without a Verdict: or Commit: line>" }.\n'
    + 'Finding ids are F1, F2, ... in order, one per finding, praise included. The commit is the output of git rev-parse HEAD, never a short or padded sha.\n';
}

function verifierPrompt(args, entry, finding) {
  const range = entry.range || args.range;
  return lead(args)
    + 'You are a finding verifier for change ' + args.change + '. Try to refute exactly one finding from the code, the tests and the plan.\n'
    + 'Change folder: ' + args.changeDir + '\n'
    + 'Range: ' + range + '\n'
    + 'Reviewer: ' + entry.reviewer + '\n'
    + 'Finding: ' + findingLine(finding) + '\n'
    + 'Refute it only with evidence: code at file:line, a test and its output, or a command and its output. If you cannot refute it, say so.\n'
    + 'Write no file. End your reply with one fenced json block: { refuted: boolean, evidence: "<one line>" }.\n';
}

function writerPrompt(args, outcome) {
  return lead(args)
    + 'This is stage 3 of a staged review round for change ' + args.change + ' (round ' + args.round + ' of 2). Do not review again.\n'
    + 'Write your verdict file ' + args.changeDir + '/' + (args.verdictDir || 'reviews') + '/' + outcome.reviewer + '.md, overwriting it, and write nothing else.\n'
    + 'Do not change, add or drop a finding, and do not reword a line. The file is, in this order:\n'
    + 'line 1: exactly Verdict: ' + outcome.verdict + ' (the round computed it: approved only when no blocking or important finding is left open)\n'
    + 'line 2: ' + commitLine(outcome) + '\n'
    + 'a blank line, then this heading line:\n'
    + outcome.heading + '\n'
    + 'a blank line, then the line: ### Findings\n'
    + 'then these lines, verbatim:\n'
    + outcome.lines.join('\n') + '\n'
    + 'then a blank line, then this text, verbatim:\n'
    + outcome.sections + '\n'
    + 'End your reply with one fenced json block: { written: boolean, verdict: "<the verdict you wrote>", commit: "<the sha on line 2>" }.\n';
}

function consolidate(input) {
  const args = input.args;
  const outcomes = input.outcomes || [];
  const failed = input.failed || [];
  const notes = input.notes || [];
  const consensus = consensusOf(outcomes, failed);
  const count = (o, sev) => o.findings.filter((f) => f.status === 'open' && f.severity === sev).length;
  const rows = outcomes.map((o) => '| ' + [o.reviewer, o.verdict, count(o, 'blocking'), count(o, 'important'), o.verified, o.refuted, o.commit.slice(0, 7)].join(' | ') + ' |');
  for (const f of failed) rows.push('| ' + [f.reviewer, 'failed (' + f.stage + ')', '-', '-', '-', '-', '-'].join(' | ') + ' |');
  const open = [];
  const refuted = [];
  for (const o of outcomes) {
    for (const f of o.findings) {
      const head = '- ' + o.reviewer + ' — [' + f.severity + '] ' + (f.location ? f.location + ' — ' : '') + f.text;
      if (f.status === 'open' && (f.severity === 'blocking' || f.severity === 'important')) open.push(head);
      if (f.status === 'refuted') refuted.push(head + ' · ' + f.disposition + ' (' + f.refutations + ' of ' + VERIFIERS + ')');
    }
  }
  const next = consensus === 'PASS'
    ? 'Ready to ship.'
    : args.round >= 2
      ? 'Consensus deadlock after round 2: the owner decides.'
      : 'Fix the open findings, then run review-change again (round ' + (args.round + 1) + ').';
  const text = [
    '# Review: ' + args.change + ', round ' + args.round,
    '',
    'Path: ' + args.path + ' · range `' + args.range + '` · structural: PASS',
    '',
    '| Reviewer | Verdict | Blocking open | Important open | Verified | Refuted | Commit |',
    '|---|---|---|---|---|---|---|',
    ...rows,
    '',
    'Consensus: ' + consensus + ' (round ' + args.round + '/2)',
    '',
    '## Open findings',
    ...(open.length ? open : ['None.']),
    '',
    '## Refuted by verification',
    ...(refuted.length ? refuted : ['None.']),
    '',
    '## Notes',
    ...(notes.length ? notes.map((n) => '- ' + n) : ['None.']),
    '',
    '## Next',
    next,
    '',
  ].join('\n');
  return { consensus, text };
}
// ---- rules: end

const checked = validateArgs(args);
const run = { ...checked, path: 'workflow' };
const failed = [];

phase('review');
const reviewed = await parallel(run.bench.map((e) => () => agent(reviewerPrompt(run, e), {
  agentType: 'devkit-core:' + e.reviewer, schema: STAGE1_SCHEMA, label: e.reviewer, phase: 'review',
})));
const passed = [];
run.bench.forEach((e, i) => {
  try {
    passed.push({ entry: e, stage1: validateStage1(e.reviewer, reviewed[i], run.head) });
  } catch (error) {
    failed.push({ reviewer: e.reviewer, stage: 'review', error: 'review stage failed: ' + e.reviewer + ' review' });
    log('review stage failed for ' + e.reviewer + ': ' + String(error && error.message));
  }
});

phase('verify');
const jobs = verifyJobs(run, passed);
const voted = await parallel(jobs.map((j) => () => agent(j.prompt, {
  agentType: 'devkit-core:finding-verifier', schema: VOTE_SCHEMA, label: j.label, phase: 'verify',
})));
const votesBy = groupVotes(jobs, voted);
const outcomes = passed.map((p) => outcomeOf(run, p.stage1, votesBy[p.entry.reviewer] || {}));

phase('write');
const written = await parallel(writeJobs(run, outcomes).map((j) => () => agent(j.prompt, {
  agentType: j.agentType, schema: WRITE_SCHEMA, label: j.reviewer + ' write', phase: 'write',
})));
outcomes.forEach((o, i) => {
  const reason = writeMismatch(o, written[i]);
  if (reason) {
    failed.push({ reviewer: o.reviewer, stage: 'write', error: 'review stage failed: ' + o.reviewer + ' write', reason });
  }
});

const verifiersFailed = outcomes.reduce((sum, o) => sum + o.voteFailures, 0);
const notes = verifiersFailed ? ['verifiers failed: ' + verifiersFailed] : [];
return {
  version: 1,
  path: 'workflow',
  change: run.change,
  round: run.round,
  outcomes,
  failed,
  verifiersFailed,
  consensus: consensusOf(outcomes, failed),
  reviewMd: failed.length ? null : consolidate({ args: run, outcomes, failed, notes }).text,
};
