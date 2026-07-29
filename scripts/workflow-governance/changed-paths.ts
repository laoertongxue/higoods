import { execFileSync } from 'node:child_process'

export function normalizeChangedPath(path: string): string {
  const renameTarget = path.includes(' -> ') ? path.split(' -> ').at(-1) ?? path : path
  return renameTarget.replace(/\\/g, '/').replace(/^\.\//, '').trim()
}

export function getWorkingTreeChangedPaths(): string[] {
  return getChangedPaths()
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
      ['diff', '--name-only', '--diff-filter=ACMRTUXB', `${options.base}...HEAD`],
      { cwd, encoding: 'utf8' },
    )
    paths.push(...committedOutput.split('\n').map(normalizeChangedPath).filter(Boolean))
  }

  return [...new Set(paths)].sort()
}
