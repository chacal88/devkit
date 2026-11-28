#!/usr/bin/env node
// Probe 3 of helper-conductor (task 3.6, run headless on avel on 2026-11-28): sets up the scratch project of the blocked-tick measurement.
// Usage: node probe-3-setup.mjs <devkit clone> [block|ready]
//   block (default): the run file records a task and one item under a live claim: nothing is ready, so the hook blocks.
//   ready: the same run file with no claim: the item is ready, so the hook lets the firing through with its note.
// It writes only under /var/tmp/devkit-hc-tick; it prints the task id and the prompt to create the task with.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const [clone, mode = 'block'] = process.argv.slice(2);
if (!clone || !['block', 'ready'].includes(mode)) { console.error('usage: node probe-3-setup.mjs <devkit clone> [block|ready]'); process.exit(3); }
const base = '/var/tmp/devkit-hc-tick';
const root = join(base, 'project');
mkdirSync(join(base, 'log'), { recursive: true });
if (!existsSync(root)) execFileSync('git', ['clone', '--quiet', '--branch', 'helper-conductor', clone, root], { stdio: 'inherit' });

// The raw payload logger (observation g) runs first; then the real hook of this branch.
writeFileSync(join(base, 'raw-log.mjs'), `import { appendFileSync, readFileSync } from 'node:fs';
let raw = ''; try { raw = readFileSync(0, 'utf8'); } catch {}
try { appendFileSync('${base}/log/prompt.jsonl', JSON.stringify({ at: new Date().toISOString(), raw }) + '\\n'); } catch {}
`);
mkdirSync(join(root, '.claude'), { recursive: true });
writeFileSync(join(root, '.claude', 'settings.local.json'), `${JSON.stringify({
  env: { DEVKIT_HOOK_LOG: `${base}/log/hook.jsonl`, DEVKIT_CLAIM_STALE_MS: '86400000' },
  hooks: { UserPromptSubmit: [{ hooks: [
    { type: 'command', command: `node ${base}/raw-log.mjs`, timeout: 10 },
    { type: 'command', command: `node ${root}/plugins/openspec/hooks/tick-gate.mjs`, timeout: 10 },
  ] }] },
}, null, 2)}\n`);

const slug = basename(root).toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 24);
const taskId = `devkit-roadmap-tick-${slug}-${createHash('sha256').update(root).digest('hex').slice(0, 8)}`;
const now = new Date().toISOString();
const run = { task: { id: taskId, cron: '*/5 * * * *', at: now }, queue: ['probe-item'], claims: {}, holds: {}, places: 1, stopping: false };
if (mode === 'block') run.claims['probe-item'] = { session: 'probe-3', at: now, heartbeat: now };
mkdirSync(join(root, '.git', 'devkit'), { recursive: true });
writeFileSync(join(root, '.git', 'devkit', 'roadmap-run.json'), `${JSON.stringify(run, null, 2)}\n`);

console.log(`mode: ${mode}`);
console.log(`working folder: ${root}`);
console.log(`taskId: ${taskId}`);
console.log('prompt (two lines):');
console.log(`devkit-roadmap-tick: ${root}`);
console.log('Run the devkit roadmap tick as the devkit tick note of this prompt says, and follow its output. With no note, change nothing and end the turn.');
