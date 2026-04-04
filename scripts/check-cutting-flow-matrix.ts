#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const repoRoot = process.cwd()

function abs(rel: string): string {
  return path.join(repoRoot, rel)
}

function read(rel: string): string {
  return fs.readFileSync(abs(rel), 'utf8')
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function assertIncludes(rel: string, token: string, message: string): void {
  assert(read(rel).includes(token), `${rel} ${message}`)
}

function main(): void {
  const releaseAcceptance = 'tests/cutting-release-acceptance.spec.ts'
  const spreadingCrossModule = 'tests/cutting-marker-spreading-mock-cross-module.spec.ts'
  const pdaWritebackSpec = 'tests/cutting-pda-spreading-writeback.spec.ts'

  ;[
    'prototypeSpreadingRows.length).toBeGreaterThanOrEqual(18)',
    'WAITING_REPLENISHMENT || 0).toBeGreaterThanOrEqual(2)',
    'WAITING_FEI_TICKET || 0).toBeGreaterThanOrEqual(2)',
    'WAITING_BAGGING || 0).toBeGreaterThanOrEqual(2)',
    'WAITING_WAREHOUSE || 0).toBeGreaterThanOrEqual(2)',
    'DONE || 0).toBeGreaterThanOrEqual(3)',
    "modeCount.normal || 0).toBeGreaterThanOrEqual(2)",
    "modeCount.high_low || 0).toBeGreaterThanOrEqual(2)",
    "modeCount.fold_normal || 0).toBeGreaterThanOrEqual(2)",
    "modeCount.fold_high_low || 0).toBeGreaterThanOrEqual(2)",
    "row.contextType === 'merge-batch'",
    'sourceWritebackId',
    'bag-first',
  ].forEach((token) => {
    assertIncludes(releaseAcceptance, token, `缺少流程矩阵 acceptance 断言：${token}`)
  })

  ;[
    'WAITING_REPLENISHMENT',
    'WAITING_FEI_TICKET',
    'WAITING_WAREHOUSE',
    'sourceWritebackId',
    'buildGeneratedFeiTicketTraceMatrix',
  ].forEach((token) => {
    assertIncludes(spreadingCrossModule, token, `缺少跨模块矩阵断言：${token}`)
  })

  ;[
    'toBeGreaterThanOrEqual(3)',
    'planUnitId',
    'rollWritebackItemId',
    'sourceWritebackId',
    'PDA回写',
  ].forEach((token) => {
    assertIncludes(pdaWritebackSpec, token, `缺少 PDA 链矩阵断言：${token}`)
  })

  ;[
    ['src/data/fcs/cutting/generated-fei-tickets.ts', 'sourceSpreadingSessionId'],
    ['src/data/fcs/cutting/generated-fei-tickets.ts', 'sourceWritebackId'],
    ['src/data/fcs/cutting/storage/replenishment-storage.ts', 'sourceSpreadingSessionId'],
    ['src/data/fcs/cutting/storage/replenishment-storage.ts', 'shortageGarmentQty'],
    ['src/data/fcs/cutting/storage/fei-tickets-storage.ts', 'sourceSpreadingSessionId'],
    ['src/data/fcs/cutting/storage/transfer-bags-storage.ts', 'buildTransferBagRuntimeTraceMatrix'],
    ['src/data/fcs/cutting/pda-spreading-writeback.ts', 'planUnitId'],
    ['src/data/fcs/cutting/pda-spreading-writeback.ts', 'sourceWritebackId'],
    ['src/data/fcs/pda-cutting-execution-source.ts', 'FOLD_NORMAL'],
    ['src/data/fcs/pda-cutting-execution-source.ts', 'FOLD_HIGH_LOW'],
  ].forEach(([rel, token]) => {
    assertIncludes(rel, token, `缺少流程矩阵 trace 锚点：${token}`)
  })

  console.log(
    JSON.stringify(
      {
        releaseAcceptance流程矩阵覆盖: '通过',
        crossModule流程矩阵覆盖: '通过',
        PDA写回流程矩阵覆盖: '通过',
        数据主锚点trace字段存在: '通过',
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
