import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { getChangedPaths } from '../../scripts/workflow-governance/changed-paths.ts'

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()
}

test('基线到当前 HEAD 的已提交变更仍进入检查路由', () => {
  const root = mkdtempSync(join(tmpdir(), 'higoods-changed-paths-'))
  git(root, 'init')
  git(root, 'config', 'user.name', 'Workflow Test')
  git(root, 'config', 'user.email', 'workflow-test@example.invalid')
  writeFileSync(join(root, 'tracked.ts'), 'export const value = 1\n')
  git(root, 'add', 'tracked.ts')
  git(root, 'commit', '-m', 'baseline')
  const base = git(root, 'rev-parse', 'HEAD')

  writeFileSync(join(root, 'tracked.ts'), 'export const value = 2\n')
  writeFileSync(join(root, 'committed.ts'), 'export const committed = true\n')
  git(root, 'add', 'tracked.ts', 'committed.ts')
  git(root, 'commit', '-m', 'committed change')
  writeFileSync(join(root, 'working.ts'), 'export const working = true\n')

  assert.deepEqual(getChangedPaths({ cwd: root, base }), [
    'committed.ts',
    'tracked.ts',
    'working.ts',
  ])
})
