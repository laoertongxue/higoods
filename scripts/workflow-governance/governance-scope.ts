import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { lstatSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { isAbsolute, relative, resolve } from 'node:path'

export type GovernanceScopeKind = 'staged' | 'worktree' | 'branch'
export interface GovernanceScope {
  kind: GovernanceScopeKind
  paths: string[]
  excludedPaths: string[]
  baseRef: string
  readText: (path: string) => string | null
  readBaseText: (path: string) => string | null
}

export function isPrototypePath(path: string): boolean {
  return path.startsWith('src/') || path === 'index.html'
}

export function isReviewRecordPath(path: string): boolean {
  return path.startsWith('docs/prototype-review-records/') && path.endsWith('.md')
}

function safePath(value: string): string {
  assert(value && !isAbsolute(value) && !value.includes('\\') && !value.includes('\0'), '范围路径须为仓库相对路径')
  const path = value.replace(/^\.\//, '')
  assert(!path.split('/').some((part) => part === '..' || part === '.' || !part), '范围路径不能越界或含空路径段')
  return path
}

export function resolveGovernanceScope(args: string[], cwd = process.cwd(), environment: NodeJS.ProcessEnv = process.env): GovernanceScope {
  const root = realpathSync(cwd)
  const git = (...argv: string[]): string => execFileSync('git', argv, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  const options = new Map<string, string>()
  let legacyAll = false
  for (let i = 0; i < args.length; i++) {
    const flag = args[i]
    if (flag === '--all') {
      assert(!legacyAll, '--all 不能重复')
      legacyAll = true
      continue
    }
    assert(['--scope', '--paths', '--base'].includes(flag), '未知治理参数：' + flag)
    assert(!options.has(flag), '治理参数不能重复：' + flag)
    const value = args[++i]
    assert(value && !value.startsWith('--'), '治理参数缺少值：' + flag)
    options.set(flag, value)
  }
  assert(!(legacyAll && options.has('--scope')), '--all 与 --scope 不能同时使用')
  const kind = (legacyAll ? 'worktree' : options.get('--scope') || 'staged') as GovernanceScopeKind
  assert(['staged', 'worktree', 'branch'].includes(kind), '--scope 必须为 staged、worktree 或 branch')
  const baseOption = options.get('--base') || (kind === 'worktree' ? environment.GOVERNANCE_BASE_SHA : undefined)
  assert(kind !== 'branch' || baseOption, 'branch 范围必须提供 --base')
  assert(kind !== 'staged' || !baseOption, 'staged 范围不接受 --base')
  const head = git('rev-parse', '--verify', 'HEAD').trim()
  const baseRef = baseOption
    ? git('merge-base', git('rev-parse', '--verify', '--end-of-options', baseOption + '^{commit}').trim(), head).trim()
    : head
  const split = (source: string): string[] => source.split('\0').filter(Boolean)
  const tree = (ref: string): Map<string, string> => new Map(split(git('ls-tree', '-rz', ref)).map((record) => {
    const tab = record.indexOf('\t')
    const [mode, , oid] = record.slice(0, tab).split(' ')
    return [record.slice(tab + 1), mode + ':' + oid]
  }))
  // Keep object identities pinned; staged paths and content must both come from the index.
  const baseTree = tree(baseRef)
  let targetTree: Map<string, string> | null = null
  let changed: string[]
  if (kind === 'staged') {
    targetTree = new Map(split(git('ls-files', '--stage', '-z')).map((record) => {
      const tab = record.indexOf('\t')
      const [mode, oid, stage] = record.slice(0, tab).split(' ')
      assert(stage === '0', '暂存区存在未解决冲突：' + record.slice(tab + 1))
      return [record.slice(tab + 1), mode + ':' + oid]
    }))
    changed = [...new Set([...baseTree.keys(), ...targetTree.keys()])].filter((path) => baseTree.get(path) !== targetTree?.get(path))
  } else if (kind === 'branch') {
    targetTree = tree(head)
    changed = [...new Set([...baseTree.keys(), ...targetTree.keys()])].filter((path) => baseTree.get(path) !== targetTree?.get(path))
  } else {
    changed = split(git('diff', '--name-only', '--no-renames', '-z', baseRef, '--'))
    changed.push(...split(git('ls-files', '--others', '--exclude-standard', '-z')))
  }
  changed = [...new Set(changed)].sort()
  let paths = changed
  if (options.has('--paths')) {
    const requested = options.get('--paths')!.split(',').map((path) => safePath(path.trim()))
    assert.equal(new Set(requested).size, requested.length, '--paths 不能重复')
    for (const path of requested) assert(changed.includes(path), '指定路径不属于所选版本的变更：' + path)
    paths = requested.sort()
  }
  const readBlob = (map: Map<string, string>, value: string): string | null => {
    const entry = map.get(safePath(value))
    if (!entry) return null
    const [mode, oid] = entry.split(':')
    assert(mode === '100644' || mode === '100755', '治理读取对象不能为符号链接或子模块：' + value)
    return git('cat-file', 'blob', oid)
  }
  const readText = (value: string): string | null => {
    const path = safePath(value)
    if (targetTree) return readBlob(targetTree, path)
    const absolute = resolve(root, path)
    let current = root
    for (const segment of path.split('/')) {
      current = resolve(current, segment)
      let info
      try { info = lstatSync(current) } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
        throw error
      }
      assert(!info.isSymbolicLink(), '工作区路径不能为符号链接：' + path)
    }
    const actual = realpathSync(absolute)
    assert(actual === absolute && !relative(root, actual).startsWith('..'), '工作区路径不能通过符号链接越界：' + path)
    assert(statSync(actual).isFile(), '检查对象必须为文件：' + path)
    return readFileSync(actual, 'utf8')
  }
  return { kind, paths, excludedPaths: changed.filter((path) => !paths.includes(path)), baseRef, readText, readBaseText: (path) => readBlob(baseTree, path) }
}

export function reportGovernanceScope(scope: GovernanceScope): void {
  console.log(JSON.stringify({ scope: scope.kind, base: scope.baseRef, checkedPaths: scope.paths, excludedPaths: scope.excludedPaths }))
}
