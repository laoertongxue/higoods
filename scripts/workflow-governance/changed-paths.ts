import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'

export function normalizeChangedPath(path: string): string {
  const renameTarget = path.includes(' -> ') ? path.split(' -> ').at(-1) ?? path : path
  return renameTarget.replace(/\\/g, '/').replace(/^\.\//, '').trim()
}

export function getWorkingTreeChangedPaths(): string[] {
  return getChangedPaths()
}

export function getStagedChangedPaths(
  options: { cwd?: string } = {},
): string[] {
  const output = execFileSync(
    'git',
    ['diff', '--cached', '--name-only', '--diff-filter=ACMRDTUXB'],
    { cwd: options.cwd ?? process.cwd(), encoding: 'utf8' },
  )
  return [...new Set(output.split('\n').map(normalizeChangedPath).filter(Boolean))].sort()
}

export function getChangedPaths(
  options: { cwd?: string; base?: string } = {},
): string[] {
  const cwd = options.cwd ?? process.cwd()
  const statusOutput = execFileSync('git', ['status', '--porcelain'], {
    cwd,
    encoding: 'utf8',
  })
  const paths = statusOutput
    .split('\n')
    .filter(Boolean)
    .map((line) => normalizeChangedPath(line.slice(3)))
    .filter(Boolean)

  if (options.base) {
    const committedOutput = execFileSync(
      'git',
      ['diff', '--name-only', '--diff-filter=ACMRDTUXB', `${options.base}...HEAD`],
      { cwd, encoding: 'utf8' },
    )
    paths.push(...committedOutput.split('\n').map(normalizeChangedPath).filter(Boolean))
  }

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
