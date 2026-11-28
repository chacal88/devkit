// The owner's standing answers (helper-conductor D-8): `openspec/standing-answers.md`, read from the main checkout and never
// written by the conductor. `## Answers` holds lines `- <topic>: <text>`; `## Delegations` holds lines
// `- <gate>: delegated to <who>: "<quote>"`. Any other heading ends a section; a fenced block is ignored, and so is every
// line after an unclosed fence. Runs nothing when imported.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// The gate ids of the owner's lines (D-2 `ownerWaits[id].gate`): the only gates a delegation may name.
export const GATE_IDS = ['grill', 'mockup', 'approval', 'retro', 'review-round', 'pr-decision', 'merge', 'decision', 'budget', 'task-left'];

const ANSWER = /^-\s+([^:]+?)\s*:\s*(\S.*?)\s*$/;
const DELEGATION = /^-\s+([\w-]+)\s*:\s+delegated to\s+(\S.*?)\s*:\s+"([^"]+)"\s*$/;

// → { answers: [{ line, topic, text }], delegations: { <gate>: { line, who, quote } } }; `line` counts from 1.
export function readStandingAnswers(root) {
  const result = { answers: [], delegations: {} };
  let text;
  try { text = readFileSync(join(root, 'openspec', 'standing-answers.md'), 'utf8'); } catch { return result; }
  let section = null;
  let fence = null;
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const mark = line.trim().match(/^(`{3,}|~{3,})/)?.[1];
    if (fence) {
      if (mark && mark[0] === fence[0] && mark.length >= fence.length) fence = null;
      continue;
    }
    if (mark) { fence = mark; continue; }
    const heading = line.match(/^#{1,6}\s+(.*?)\s*$/);
    if (heading) {
      section = heading[1] === 'Answers' ? 'answers' : heading[1] === 'Delegations' ? 'delegations' : null;
      continue;
    }
    if (section === 'answers') {
      const m = line.match(ANSWER);
      if (m) result.answers.push({ line: i + 1, topic: m[1], text: m[2] });
    } else if (section === 'delegations') {
      const m = line.match(DELEGATION);
      if (m && GATE_IDS.includes(m[1]) && !(m[1] in result.delegations)) result.delegations[m[1]] = { line: i + 1, who: m[2], quote: m[3] };
    }
  }
  return result;
}
