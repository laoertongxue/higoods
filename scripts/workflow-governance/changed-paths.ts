import { execFileSync } from 'node:child_process'

export function normalizeChangedPath(path: string): string {
  const renameTarget = path.includes(' -> ') ? path.split(' -> ').at(-1) ?? path : path
  return renameTarget.replace(/\\/g, '/').replace(/^\.\//, '').trim()
}

export function getWorkingTreeChangedPaths(): string[] {
  const output = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' })
  return [...new Set(
    output
      .split('\n')
      .filter(Boolean)
      .map((line) => normalizeChangedPath(line.slice(3)))
      .filter(Boolean),
  )].sort()
}
