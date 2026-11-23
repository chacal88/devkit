#!/usr/bin/env node
// Writes the kit's CompozyOS agents from the devkit's Claude agent files (compozy-driver D-8, AC-7).
//
//   node gen-agents.mjs [--check] [--root <repo>]
//
// `PACKS` in `plugins/openspec/hooks/change-loop.mjs` is the one table of agents: every key is a role,
// its value the pack that ships the Claude agent `plugins/<core|openspec>/agents/<role>.md`. Each role
// becomes `templates/agents/<role>/AGENT.md`, a seat that hands its work, unchanged, to that Claude
// agent. `--check` writes nothing and exits 1 naming each agent that differs, is missing or is extra;
// else 0. Exit 2 when a source cannot be read (no opening or closing `---` line, empty, no `name` or
// `description`), naming the file and writing nothing. Exports `renderAgent` and `expectedAgents`.
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(here, '..', '..', '..', '..', '..');
const AGENTS_AT = ['plugins', 'compozy', 'skills', 'compozy-setup', 'templates', 'agents'];
const CHANGE_LOOP_AT = ['plugins', 'openspec', 'hooks', 'change-loop.mjs'];
const SELF = 'plugins/compozy/skills/compozy-setup/scripts/gen-agents.mjs';
const CHECKING_ROLES = new Set(['code-quality-reviewer', 'test-coverage-reviewer', 'architecture-reviewer', 'security-reviewer',
  'spec-reviewer', 'adr-reviewer', 'finding-verifier', 'plan-reality-auditor', 'plan-readiness-reviewer', 'openspec-validator']);
const OUTCOMES_THAT_ARE_DONE = ['success', 'planned', 'escalated', 'shipped', 'refused', 'verified', 'defect-found', 'green', 'red', 'proposed <n>',
  'none-needed', 'drawn'];

export class AgentSourceError extends Error {
  constructor(file, why) {
    super(`${file}: ${why}`);
    this.name = 'AgentSourceError';
    this.file = file;
  }
}

class UsageError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UsageError';
  }
}

// The seat paragraph: one constant, with the Claude agent's type where it is named.
export const SEAT = [
  'You are a seat: a CompozyOS session that hands its work to the devkit and reports what came back. A CompozyOS session is a main session to the devkit hooks, so doing the stage yourself would be refused every gate file and, on the `devkit` script, product code.',
  '',
  '- Hand the brief you were given, unchanged, to the Claude agent `__AGENT__` with the Agent tool, and return that agent\'s report in the shape the node asks. A brief that asks for a dispatch sentence gets the one it names (a `ship-change` row, or a `devkit` skill Loop bullet).',
  '- `Outcome: failure` returns `failure`.',
  `- Every other outcome word returns \`done\`: ${OUTCOMES_THAT_ARE_DONE.map((w) => `\`${w}\``).join(', ')}. Put the agent's Outcome line in \`summary\`. A red test run, a refused push or an escalated plan is a stage result the checker judges from the files on the next turn, never a failure of the seat.`,
  '- A report with no Outcome line returns `failure`.',
  '- One exception: a prompt that starts with `Read only:` names one command. Run it yourself, return its output unchanged and hand nothing on.',
].join('\n');

export const seatFor = (role, pack) => SEAT.replace('__AGENT__', `${pack}:${role}`);

// Splits a Claude agent file into its frontmatter lines and its body.
function parseSource(file, text) {
  if (!text.trim()) throw new AgentSourceError(file, 'the file is empty');
  const lines = text.split('\n');
  if (lines[0].trimEnd() !== '---') throw new AgentSourceError(file, 'the file does not start with a --- line');
  const close = lines.findIndex((l, i) => i > 0 && l.trimEnd() === '---');
  if (close < 0) throw new AgentSourceError(file, 'the frontmatter has no closing --- line');
  const front = lines.slice(1, close);
  const key = (name) => front.find((l) => l.startsWith(`${name}:`) && l.slice(name.length + 1).trim() !== '');
  const name = key('name');
  const description = key('description');
  if (!name) throw new AgentSourceError(file, 'the frontmatter has no name');
  if (!description) throw new AgentSourceError(file, 'the frontmatter has no description');
  return { description, body: lines.slice(close + 1).join('\n').replace(/^\n+/, '') };
}

const displayName = (role) => role.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
const sourceFolder = (pack) => pack.replace(/^devkit-/, '');

// The text of `templates/agents/<role>/AGENT.md` for a role, its pack and the source file's text.
export function renderAgent(role, pack, sourceText, file = `${role}.md`) {
  const { description, body } = parseSource(file, sourceText);
  const icon = CHECKING_ROLES.has(role) ? 'shield-check' : 'list-checks';
  return [
    '---',
    `name: ${role}`,
    `display_name: ${displayName(role)}`,
    description,
    'provider: claude',
    'permissions: approve-all',
    'category_path: [Project, Devkit]',
    'appearance:',
    '  version: 1',
    '  avatar: icon',
    `  icon: ${icon}`,
    '  color: "#5B5BD6"',
    '  background: none',
    '---',
    '',
    `<!-- Generated by ${SELF} from plugins/${sourceFolder(pack)}/agents/${role}.md: do not edit it, edit the source and run the generator. -->`,
    '',
    seatFor(role, pack),
    '',
    "## The role's instructions",
    '',
    `${body.trimEnd()}`,
    '',
  ].join('\n');
}

async function packsOf(root) {
  const file = join(root, ...CHANGE_LOOP_AT);
  if (!existsSync(file)) throw new UsageError(`${file}: not found (is --root a devkit repository?)`);
  const mod = await import(pathToFileURL(file).href);
  return mod.PACKS;
}

// Every agent the kit must hold: a Map of role to the text of its AGENT.md. Throws AgentSourceError for an unreadable source.
export async function expectedAgents(root = DEFAULT_ROOT) {
  const packs = await packsOf(root);
  const out = new Map();
  for (const role of Object.keys(packs).sort()) {
    const file = join('plugins', sourceFolder(packs[role]), 'agents', `${role}.md`);
    const path = join(root, file);
    if (!existsSync(path)) throw new AgentSourceError(file, 'the source file does not exist');
    out.set(role, renderAgent(role, packs[role], readFileSync(path, 'utf8'), file));
  }
  return out;
}

const agentsDir = (root) => join(root, ...AGENTS_AT);

function present(root) {
  const dir = agentsDir(root);
  return existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort() : [];
}

export async function main(argv, out = process.stdout, err = process.stderr) {
  let root = DEFAULT_ROOT;
  let check = false;
  try {
    for (let i = 0; i < argv.length; i += 1) {
      if (argv[i] === '--check') check = true;
      else if (argv[i] === '--root') {
        if (!argv[i + 1]) throw new UsageError('--root needs a folder');
        root = resolve(argv[i + 1]);
        i += 1;
      } else throw new UsageError(`unknown argument ${argv[i]}`);
    }
    const want = await expectedAgents(root);
    const have = present(root);
    const problems = [];
    for (const [role, text] of want) {
      const file = join(agentsDir(root), role, 'AGENT.md');
      if (!existsSync(file)) problems.push(`${role}: missing`);
      else if (readFileSync(file, 'utf8') !== text) problems.push(`${role}: differs from its source`);
    }
    for (const role of have) if (!want.has(role)) problems.push(`${role}: extra, no role of PACKS names it`);
    if (check) {
      if (problems.length === 0) { out.write(`${want.size} CompozyOS agents are up to date\n`); return 0; }
      err.write(`run: node ${SELF}\n`);
      out.write(`${problems.join('\n')}\n`);
      return 1;
    }
    for (const [role, text] of want) {
      mkdirSync(join(agentsDir(root), role), { recursive: true });
      writeFileSync(join(agentsDir(root), role, 'AGENT.md'), text);
    }
    for (const role of have) if (!want.has(role)) rmSync(join(agentsDir(root), role), { recursive: true });
    out.write(`${want.size} CompozyOS agents written\n`);
    return 0;
  } catch (e) {
    if (e instanceof AgentSourceError || e instanceof UsageError) { err.write(`gen-agents: ${e.message}\n`); return 2; }
    throw e;
  }
}

function isMain() {
  try { return realpathSync(process.argv[1]) === fileURLToPath(import.meta.url); } catch { return false; }
}

if (isMain()) main(process.argv.slice(2)).then((code) => { process.exitCode = code; });
