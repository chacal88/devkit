// Where the panel is on and which checker runs (design D3, D4), and the change
// folders (design D5). The readers take the slice of `$` they use, so a test
// hands them a disk in memory.

import type { EngineInterface } from 'claude-code'

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

/** The open change folders not in the round, and the archived ones newest first (design D5). No checker runs. */
export async function changeFolders($: Pick<PanelHost, 'fs'>, root: string, roundIds: readonly string[]): Promise<{ others: string[]; archived: string[] }> {
  const changes = `${root}/openspec/changes`
  const others = (await dirNames($, changes)).filter(name => name !== 'archive' && !roundIds.includes(name))
  const archived = (await dirNames($, `${changes}/archive`)).sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
  return { others, archived }
}
