import assert from 'node:assert/strict'
import { chmodSync, mkdtempSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { revisionForPaths } from '../../scripts/workflow-governance/git-revision.ts'

test('文件执行位变化会改变任务版本指纹', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'workflow-git-revision-mode-'))
  const path = join(cwd, 'script.sh')
  writeFileSync(path, '#!/bin/sh\nexit 0\n', { mode: 0o644 })
  const before = revisionForPaths(['script.sh'], { cwd, head: 'abc123' })
  chmodSync(path, 0o755)
  const after = revisionForPaths(['script.sh'], { cwd, head: 'abc123' })

  assert.notEqual(before.diffHash, after.diffHash)
})

test('符号链接目标变化会改变任务版本指纹', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'workflow-git-revision-link-'))
  writeFileSync(join(cwd, 'target-a.txt'), 'same\n')
  writeFileSync(join(cwd, 'target-b.txt'), 'same\n')
  const path = join(cwd, 'current.txt')
  symlinkSync('target-a.txt', path)
  const before = revisionForPaths(['current.txt'], { cwd, head: 'abc123' })
  unlinkSync(path)
  symlinkSync('target-b.txt', path)
  const after = revisionForPaths(['current.txt'], { cwd, head: 'abc123' })

  assert.notEqual(before.diffHash, after.diffHash)
})

test('失效符号链接目标变化仍会改变任务版本指纹', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'workflow-git-revision-dangling-link-'))
  const path = join(cwd, 'current.txt')
  symlinkSync('missing-a.txt', path)
  const before = revisionForPaths(['current.txt'], { cwd, head: 'abc123' })
  unlinkSync(path)
  symlinkSync('missing-b.txt', path)
  const after = revisionForPaths(['current.txt'], { cwd, head: 'abc123' })

  assert.notEqual(before.diffHash, after.diffHash)
})
