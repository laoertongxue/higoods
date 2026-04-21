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
  const pdaPageFile = 'src/pages/pda-cutting-spreading.ts'
  const spreadingListTest = 'tests/cutting-marker-spreading-list.spec.ts'
  const spreadingListTabsTest = 'tests/cutting-marker-spreading-list-tabs.spec.ts'
  const spreadingCrossModuleTest = 'tests/cutting-marker-spreading-cross-module-navigation.spec.ts'
  const spreadingDetailEditTest = 'tests/cutting-marker-spreading-detail-edit.spec.ts'
  const spreadingEditorActionsTest = 'tests/cutting-marker-spreading-editor-actions.spec.ts'
  const pdaTest = 'tests/cutting-pda-spreading.spec.ts'

  const pageSource = read(pageFile)
  const submitSource = read(submitActionsFile)
  const pdaSource = read(pdaPageFile)

  assertFileExists(draftActionsFile)
  assertFileExists(submitActionsFile)
  assertFileExists(spreadingListTest)
  assertFileExists(spreadingListTabsTest)
  assertFileExists(spreadingCrossModuleTest)
  assertFileExists(spreadingDetailEditTest)
  assertFileExists(spreadingEditorActionsTest)
  assertFileExists(pdaTest)

  ;[
    'renderCuttingPageHeader(',
    'renderStickyFilterShell(',
    'renderWorkbenchStateBar(',
    'renderCompactKpiCard(',
    'renderStickyTableScroller(',
    "data-cutting-marker-action=\"create-spreading\"",
    "data-cutting-marker-action=\"open-spreading-detail\"",
    "data-cutting-marker-action=\"open-spreading-edit\"",
    "data-cutting-marker-action=\"go-spreading-replenishment\"",
  ].forEach((token) => {
    assert(pageSource.includes(token), `${pageFile} 缺少关键铺布页面能力：${token}`)
  })

  ;[
    '唛架记录',
    'data-cutting-marker-action="open-marker-detail"',
    'data-cutting-marker-action="open-marker-edit"',
    'data-cutting-marker-action="create-marker"',
    'data-cutting-marker-action="create-marker-from-context"',
    'data-cutting-marker-action="create-spreading-from-marker"',
    'data-cutting-marker-action="confirm-marker-import-new"',
    'data-cutting-marker-action="confirm-marker-import-sync"',
    'data-cutting-marker-action="cancel-marker-import"',
  ].forEach((token) => {
    assert(!pageSource.includes(token), `${pageFile} 仍残留旧 mixed 唛架入口或再次导入动作：${token}`)
  })

  const editStatusSelectMatch = pageSource.match(/renderSelect\('状态', draft\.status,[\s\S]*?\]\)/)
  if (editStatusSelectMatch) {
    assert(!editStatusSelectMatch[0].includes("value: 'DONE'"), `${pageFile} 的铺布编辑页状态下拉不应直接提供 DONE`)
  }
  assert(!pageSource.includes('data-cutting-spreading-draft-field="colorSummary"'), `${pageFile} 的颜色概览不应继续作为可编辑输入`)
  assert(!pageSource.includes('data-cutting-spreading-draft-field="theoreticalSpreadTotalLength"'), `${pageFile} 的理论铺布总长度不应继续作为可编辑输入`)
  assert(!pageSource.includes('data-cutting-spreading-draft-field="theoreticalActualCutPieceQty"'), `${pageFile} 的理论裁剪成衣件数不应继续作为可编辑输入`)
  ;[
    'deriveSpreadingColorSummary(',
    'buildTheoreticalActualCutQtyFormula(',
    'buildSpreadingImportedLengthFormula(',
  ].forEach((token) => {
    assert(pageSource.includes(token), `${pageFile} 缺少只读理论字段的公式或汇总展示：${token}`)
  })
  const createActionBlockMatch = pageSource.match(/if \(action === 'create-spreading'\) \{[\s\S]*?return true\s+\}/)
  assert(createActionBlockMatch, `${pageFile} 缺少新建铺布动作分发`)
  assert(!createActionBlockMatch[0].includes("exceptionEntry: '1'"), `${pageFile} 的普通新建铺布不应默认走异常补录`)

  ;[
    'save-spreading',
    'save-spreading-and-view',
    'complete-spreading',
    'set-spreading-status',
  ].forEach((action) => {
    assert(submitSource.includes(action), `${submitActionsFile} 缺少铺布提交动作：${action}`)
  })
  ;['save-marker', 'save-marker-and-view'].forEach((action) => {
    assert(!submitSource.includes(action), `${submitActionsFile} 仍残留旧唛架保存动作：${action}`)
  })
  assert(!pageSource.includes("if (nextStatus === 'DONE') return completeCurrentSpreading()"), `${pageFile} 不应允许通过普通状态流转直接完成铺布`)

  ;[
    'operatorActionType',
    'handoverFlag',
    'handoverNote',
    'recordType',
    'data-pda-cut-spreading-field="recordType"',
    'data-pda-cut-spreading-field="spreadingMode"',
  ].forEach((token) => {
    assert(pdaSource.includes(token), `${pdaPageFile} 缺少 PDA 铺布录入闭环字段：${token}`)
  })

  console.log(
    JSON.stringify(
      {
        铺布页唯一入口检查: '通过',
        旧唛架混合入口退场: '通过',
        铺布提交动作分发: '通过',
        PDA交接写回字段: '通过',
        铺布编辑页危险字段已收只读: '通过',
        铺布编辑页状态流转已收口: '通过',
        FocusedPlaywright覆盖文件: '通过',
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
