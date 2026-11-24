// What the two halves of the third part of change-loop.test.mjs (change-loop-remote.test.mjs and change-loop-remote-state.test.mjs) share (suite-speed D-11, second round): builders and helpers both use. No test lives here and nothing is made when the module is
// imported: a folder, a spawn or a git call happens only when one of its functions runs. A test file never imports another test file; what two test files share is moved to a module like this one.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { cleanEnvLoop as cleanEnv, stored, assistantLine } from './test-fixtures.mjs';

export const TASK_LINK = 'https://acme.atlassian.net/browse/PROJ-482';

export const TASK_REQUIREMENTS = `# Requirements\n\n## Request\n\nJira: PROJ-482 ${TASK_LINK}\n\nTitle:\n\n> Login times out after 30 seconds\n\n## Assumptions\n\n- \n`;
export const recordFile = (t, id = 'feat') => join(t.main, '.git', 'devkit', 'write-back', `${id}.json`);
export const asked = (t, over = {}, id = 'feat') => {
  mkdirSync(dirname(recordFile(t, id)), { recursive: true });
  writeFileSync(recordFile(t, id), JSON.stringify({ version: 1, change: id, key: 'PROJ-482', number: 12, url: 'https://github.com/o/r/pull/12', askedAt: '2026-11-22T00:00:00Z', transitions: [], answer: null, ...over }));
};

// A model message line with a usage object; `sidechain` marks a subagent's own line.
export const usageLine = ({ id = null, input = 0, output = 0, cacheWrite = 0, cacheRead = 0, at = '2026-11-20T10:00:00.000Z', sidechain = false } = {}) => stored({
  type: 'assistant',
  timestamp: at,
  isSidechain: sidechain,
  message: { role: 'assistant', ...(id ? { id } : {}), content: [{ type: 'text', text: 'working' }], usage: { input_tokens: input, output_tokens: output, cache_creation_input_tokens: cacheWrite, cache_read_input_tokens: cacheRead } },
});
// The env of a test that reads a transcript: a config folder with `projects/p/<id>.jsonl` written.
export const budgetEnv = (dir, id, lines = [assistantLine()]) => {
  mkdirSync(join(dir, 'projects', 'p'), { recursive: true });
  writeFileSync(join(dir, 'projects', 'p', `${id}.jsonl`), `${lines.join('\n')}\n`);
  return { ...cleanEnv, CLAUDE_CONFIG_DIR: dir, CLAUDE_CODE_SESSION_ID: id };
};
