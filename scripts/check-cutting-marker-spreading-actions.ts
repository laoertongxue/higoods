#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const repoRoot = process.cwd()

function abs(rel: string): string {
  return path.join(repoRoot, rel)
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function read(rel: string): string {
  return fs.readFileSync(abs(rel), 'utf8')
}

function assertFileExists(rel: string): void {
  assert(fs.existsSync(abs(rel)), `${rel} 缺失`)
}

function main(): void {
  const pageFile = 'src/pages/process-factory/cutting/marker-spreading.ts'
  const draftActionsFile = 'src/pages/process-factory/cutting/marker-spreading-draft-actions.ts'
  const submitActionsFile = 'src/pages/process-factory/cutting/marker-spreading-submit-actions.ts'
  const testFile = 'tests/cutting-marker-spreading-editor-actions.spec.ts'
  const source = read(pageFile)

  assertFileExists(draftActionsFile)
  assertFileExists(submitActionsFile)
  assertFileExists(testFile)

  assert(
    !/export function isCraftCuttingMarkerSpreadingDialogOpen\(\): boolean \{\s*return false\s*\}/m.test(source),
    `${pageFile} 仍把弹层状态硬编码为 false`,
  )

  ;[
    'data-cutting-marker-action="guide-marker-import"',
    'show-marker-import-status',
    '换一功能占位',
  ].forEach((token) => {
    assert(!source.includes(token), `${pageFile} 仍残留可见占位动作或占位文案：${token}`)
  })

  assert(source.includes("action === 'close-overlay'"), `${pageFile} 未处理统一 close-overlay 关闭动作`)
  assert(source.includes("from './marker-spreading-draft-actions'"), `${pageFile} 未接入 draft actions 拆分文件`)
  assert(source.includes('handleMarkerSpreadingSubmitAction('), `${pageFile} 未接入 submit actions 分发`)

  const combinedSource = [source, read(draftActionsFile), read(submitActionsFile)].join('\n')
  ;[
    'add-allocation-line',
    'remove-allocation-line',
    'add-size-row',
    'remove-size-row',
    'add-line-item',
    'remove-line-item',
    'add-roll',
    'remove-roll',
    'add-operator-for-roll',
    'remove-operator',
    'save-marker',
    'save-marker-and-view',
    'save-spreading',
    'save-spreading-and-view',
    'set-spreading-status',
    'complete-spreading',
  ].forEach((action) => {
    assert(combinedSource.includes(action), `唛架铺布关键动作缺少明确处理：${action}`)
  })

  console.log(
    JSON.stringify(
      {
        弹层状态收口: '通过',
        占位按钮退场: '通过',
        draftActions分发: '通过',
        submitActions分发: '通过',
        Playwright覆盖存在: '通过',
      },
      null,
      2,
    ),
  )
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
