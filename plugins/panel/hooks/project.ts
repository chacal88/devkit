// Where the panel is on and which checker runs (design D3, D4), and the change
// folders (design D5). The readers take the slice of `$` they use, so a test
// hands them a disk in memory.

import type { EngineInterface } from 'claude-code'

import { isChangeId } from './grammar'

/** The part of `$.fs` the panel reads (never writes). */
export type PanelFs = Pick<EngineInterface['fs'], 'exists' | 'read' | 'list'>

/** The part of `$` the checker location reads: the disk and `HOME`. */
export type PanelHost = { fs: PanelFs; env: Pick<EngineInterface['env'], 'get'> }

/** Where the checkers are: the repository's own hooks, or an installed devkit-openspec. */
export type CheckerLocation = { dir: string; label: string }

const OPENSPEC = 'devkit-openspec'
const INSTALLED_KEY = `${OPENSPEC}@devkit`

// guard.mjs's own opt-in (ADR 0004): the first top-level `schema:` of openspec/config.yaml.
const SCHEMA_RE = /^schema:\s*["']?([\w.-]+)/m
const DEVKIT_SCHEMAS: readonly string[] = ['devkit', 'devkit-lite']

/** Whether a project's `openspec/config.yaml` text selects a devkit schema. */
export const isDevkitProject = (configText: string): boolean => {
  const schema = SCHEMA_RE.exec(configText)?.[1]
  return schema !== undefined && DEVKIT_SCHEMAS.includes(schema)
}

type Json = Record<string, unknown>

const asObject = (value: unknown): Json | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Json) : undefined

/** The file's JSON object, or undefined when missing, unreadable or not an object. */
async function readJson($: PanelHost, path: string): Promise<Json | undefined> {
  try {
    if (!(await $.fs.exists(path))) return undefined
    return asObject(JSON.parse(await $.fs.read(path)))
  } catch {
    return undefined
  }
}

/** The project a `.claude/worktrees/<name>` checkout belongs to; the root itself otherwise. */
export const projectAbove = (root: string): string => root.replace(/\/\.claude\/worktrees\/[^/]+\/?$/, '')

type Installed = { scope: string; projectPath?: string; installPath: string; version: string }

const installedEntries = (json: Json | undefined): Installed[] => {
  const plugins = asObject(json?.plugins)
  const list = plugins?.[INSTALLED_KEY]
  if (!Array.isArray(list)) return []
  return list.flatMap((raw): Installed[] => {
    const e = asObject(raw)
    if (e === undefined || typeof e.scope !== 'string' || typeof e.installPath !== 'string') return []
    return [
      {
        scope: e.scope,
        installPath: e.installPath,
        version: typeof e.version === 'string' ? e.version : '',
        ...(typeof e.projectPath === 'string' ? { projectPath: e.projectPath } : {}),
      },
    ]
  })
}

/** The `installed_plugins.json` entry for this root: project scope matching the root or its project, else user scope. */
export const installedChecker = (json: Json | undefined, root: string): CheckerLocation | undefined => {
  const entries = installedEntries(json)
  const projects = [root, projectAbove(root)]
  const entry =
    entries.find(e => e.scope === 'project' && e.projectPath !== undefined && projects.includes(e.projectPath)) ??
    entries.find(e => e.scope === 'user')
  if (entry === undefined) return undefined
  return { dir: `${entry.installPath}/hooks`, label: `${OPENSPEC} ${entry.version}`.trim() }
}

/**
 * Which checker runs for `root` (design D4): the repository's own `plugins/openspec/hooks` when its
 * marketplace names devkit-openspec, else the installed pack, else undefined (`no-checker`).
 */
export async function locateChecker($: PanelHost, root: string): Promise<CheckerLocation | undefined> {
  const market = await readJson($, `${root}/.claude-plugin/marketplace.json`)
  const plugins = Array.isArray(market?.plugins) ? market.plugins.map(asObject) : []
  if (plugins.some(p => p?.name === OPENSPEC)) return { dir: `${root}/plugins/openspec/hooks`, label: 'repo' }
  const home = await $.env.get('HOME')
  if (home === undefined || home === '') return undefined
  return installedChecker(await readJson($, `${home}/.claude/plugins/installed_plugins.json`), root)
}

/** The directory names under `path`, or none when it cannot be listed. */
async function dirNames($: Pick<PanelHost, 'fs'>, path: string): Promise<string[]> {
  try {
    return (await $.fs.list(path)).filter(e => e.kind === 'dir').map(e => e.name)
  } catch {
    return []
  }
}

/** One checkout of `git worktree list --porcelain`: its path, and its branch unless the head is detached or bare. */
export type Worktree = { path: string; branch?: string }

/** `git worktree list --porcelain` (design D4): one block per worktree, the first being the main checkout. */
export const parseWorktrees = (porcelain: string): Worktree[] =>
  porcelain
    .split(/\n\s*\n/)
    .flatMap((block): Worktree[] => {
      const lines = block.split('\n').map(l => l.trim())
      const path = lines.find(l => l.startsWith('worktree '))?.slice('worktree '.length)
      if (path === undefined || path === '') return []
      const ref = lines.find(l => l.startsWith('branch '))?.slice('branch '.length)
      const branch = ref?.replace(/^refs\/heads\//, '')
      return [{ path, ...(branch !== undefined && branch !== '' ? { branch } : {}) }]
    })

/** A change the panel asks the checker about: where its id came from (design D4, D7). */
export type Candidate = { id: string; source: 'folder' | 'branch' }


/**
 * The open change ids, the way the conduct skill's no-argument form lists them (design D4): the folders under
 * `openspec/changes` of every worktree path (the root when git listed none), minus `archive`, plus the branches
 * of every worktree but the first that are change ids; de-duplicated, a folder winning over the same branch.
 */
export async function candidates($: Pick<PanelHost, 'fs'>, root: string, worktrees: readonly Worktree[]): Promise<Candidate[]> {
  const paths = [...new Set([...worktrees.map(w => w.path), root])]
  const found: Candidate[] = []
  const archived = new Map<string, Set<string>>()
  const archivedIn = async (path: string): Promise<Set<string>> => {
    const known = archived.get(path)
    if (known !== undefined) return known
    const ids = new Set<string>()
    for (const name of await dirNames($, `${path}/openspec/changes/archive`)) {
      const match = /^\d{4}-\d{2}-\d{2}-(.+)$/.exec(name)
      if (match?.[1] !== undefined) ids.add(match[1])
    }
    archived.set(path, ids)
    return ids
  }
  /** An id with an archived folder in the root or in its own checkout is not open (AC-6). */
  const add = async (candidate: Candidate, own: string): Promise<void> => {
    if (found.some(c => c.id === candidate.id)) return
    if ((await archivedIn(root)).has(candidate.id) || (await archivedIn(own)).has(candidate.id)) return
    found.push(candidate)
  }
  for (const path of paths) {
    for (const name of await dirNames($, `${path}/openspec/changes`)) if (name !== 'archive') await add({ id: name, source: 'folder' }, path)
  }
  for (const w of worktrees.slice(1)) {
    if (w.branch !== undefined && isChangeId(w.branch)) await add({ id: w.branch, source: 'branch' }, w.path)
  }
  return found
}

/** The first checker version that has `--change` (devkit-openspec 0.10.0, ADR 0007). */
const MIN_CHECKER = [0, 10, 0] as const

/**
 * Whether the checker named by `label` has `conduct-check --change` (design D6): `repo` and an unreadable label
 * are `ok` (the first `--change` run's error line then shows the real reason), below 0.10.0 is `old-checker`.
 */
export const checkerVersionOk = (label: string): 'ok' | 'old-checker' => {
  const match = /(\d+)\.(\d+)\.(\d+)/.exec(label)
  if (match === null) return 'ok'
  const version = [Number(match[1]), Number(match[2]), Number(match[3])]
  for (let i = 0; i < MIN_CHECKER.length; i++) {
    const have = version[i] ?? 0
    const need = MIN_CHECKER[i] ?? 0
    if (have !== need) return have > need ? 'ok' : 'old-checker'
  }
  return 'ok'
}
