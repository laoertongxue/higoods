import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import {
  getChangedPaths,
  getStagedChangedPaths,
  resolveVerificationPaths,
} from '../../scripts/workflow-governance/changed-paths.ts'

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

test('已提交和暂存删除都进入变更路径', () => {
  const root = mkdtempSync(join(tmpdir(), 'higoods-deleted-paths-'))
  git(root, 'init')
  git(root, 'config', 'user.name', 'Workflow Test')
  git(root, 'config', 'user.email', 'workflow-test@example.invalid')
  writeFileSync(join(root, 'deleted.ts'), 'export const removed = true\n')
  writeFileSync(join(root, 'staged-delete.ts'), 'export const staged = true\n')
  git(root, 'add', 'deleted.ts', 'staged-delete.ts')
  git(root, 'commit', '-m', 'baseline')
  const base = git(root, 'rev-parse', 'HEAD')

  rmSync(join(root, 'deleted.ts'))
  git(root, 'add', 'deleted.ts')
  git(root, 'commit', '-m', 'committed delete')
  rmSync(join(root, 'staged-delete.ts'))
  git(root, 'add', 'staged-delete.ts')

  assert(getChangedPaths({ cwd: root, base }).includes('deleted.ts'))
  assert.deepEqual(getStagedChangedPaths({ cwd: root }), ['staged-delete.ts'])
})

test('显式验证路径不能遗漏实际变更', () => {
  const root = mkdtempSync(join(tmpdir(), 'higoods-verification-paths-'))
  git(root, 'init')
  git(root, 'config', 'user.name', 'Workflow Test')
  git(root, 'config', 'user.email', 'workflow-test@example.invalid')
  writeFileSync(join(root, 'one.ts'), 'export const one = 1\n')
  writeFileSync(join(root, 'two.ts'), 'export const two = 2\n')

  assert.throws(
    () => resolveVerificationPaths({
      cwd: root,
      explicitPaths: ['one.ts'],
    }),
    /必须完整覆盖实际变更/,
  )
  assert.deepEqual(resolveVerificationPaths({
    cwd: root,
    explicitPaths: ['two.ts', 'one.ts'],
  }), ['one.ts', 'two.ts'])
})

test('Git 开启路径转义时仍保留中文受管路径', () => {
  const root = mkdtempSync(join(tmpdir(), 'higoods-unicode-paths-'))
  git(root, 'init')
  git(root, 'config', 'user.name', 'Workflow Test')
  git(root, 'config', 'user.email', 'workflow-test@example.invalid')
  git(root, 'config', 'core.quotePath', 'true')
  writeFileSync(join(root, 'README.md'), '# baseline\n')
  git(root, 'add', 'README.md')
  git(root, 'commit', '-m', 'baseline')
  const base = git(root, 'rev-parse', 'HEAD')
  mkdirSync(join(root, 'src/pages'), { recursive: true })
  writeFileSync(join(root, 'src/pages/中文页面.ts'), 'export const 页面 = true\n')

  assert.deepEqual(getChangedPaths({ cwd: root, base }), ['src/pages/中文页面.ts'])
})
