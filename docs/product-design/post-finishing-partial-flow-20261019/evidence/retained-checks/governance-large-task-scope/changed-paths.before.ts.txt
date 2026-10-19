import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'

export function normalizeChangedPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '').trim()
}

function nullRecords(output: Buffer): string[] {
  return output.toString('utf8').split('\0').filter(Boolean)
}

function porcelainPaths(output: Buffer): string[] {
  const records = nullRecords(output)
  const paths: string[] = []
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index]
    const status = record.slice(0, 2)
    paths.push(normalizeChangedPath(record.slice(3)))
    if (/[RC]/.test(status)) index += 1
  }
  return paths.filter(Boolean)
}

export function getWorkingTreeChangedPaths(): string[] {
  return getChangedPaths()
}

export function getStagedChangedPaths(
  options: { cwd?: string } = {},
): string[] {
  const output = execFileSync(
    'git',
    ['diff', '--cached', '--name-only', '--no-renames', '-z', '--diff-filter=ACMRDTUXB'],
    { cwd: options.cwd ?? process.cwd() },
  )
  return [...new Set(nullRecords(output).map(normalizeChangedPath).filter(Boolean))].sort()
}

export function getChangedPaths(
  options: { cwd?: string; base?: string } = {},
): string[] {
  const cwd = options.cwd ?? process.cwd()
  // Receipt and child gates both inspect the final worktree against one base.
  // Disable rename collapsing so deleted source paths receive their own coverage.
  let head: string
  try { head = execFileSync('git', ['rev-parse', '--verify', 'HEAD'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim() }
  catch {
    assert(!options.base, '尚无 HEAD 的仓库不能使用 --base')
    return [...new Set(porcelainPaths(execFileSync('git', ['status', '--porcelain=v1', '--no-renames', '-z', '--untracked-files=all'], { cwd })))].sort()
  }
  const base = options.base
    ? execFileSync('git', ['merge-base', options.base, head], { cwd, encoding: 'utf8' }).trim()
    : head
  const paths = nullRecords(execFileSync('git', ['diff', '--name-only', '--no-renames', '-z', base, '--'], { cwd }))
  paths.push(...nullRecords(execFileSync('git', ['ls-files', '--others', '--exclude-standard', '-z'], { cwd })))
  return [...new Set(paths)].sort()
}

export function resolveVerificationPaths(options: {
  cwd?: string
  base?: string
  explicitPaths?: string[] | null
} = {}): string[] {
  const actualPaths = getChangedPaths({ cwd: options.cwd, base: options.base })
  if (!options.explicitPaths) return actualPaths

  const explicitPaths = [...new Set(
    options.explicitPaths.map(normalizeChangedPath).filter(Boolean),
  )].sort()
  assert.deepEqual(
    explicitPaths,
    actualPaths,
    '--paths 必须完整覆盖实际变更，不能遗漏或额外声明文件',
  )
  return actualPaths
}
