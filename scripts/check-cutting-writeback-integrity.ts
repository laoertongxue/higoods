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

function assertFileExists(rel: string): void {
  assert(fs.existsSync(abs(rel)), `${rel} 缺失，正式写回链不完整`)
}

function assertNoPatterns(rel: string, patterns: string[], label: string): void {
  const source = read(rel)
  patterns.forEach((pattern) => {
    assert(!source.includes(pattern), `${rel} 仍残留 ${label}：${pattern}`)
  })
}

function assertIncludes(rel: string, pattern: string, label: string): void {
  const source = read(rel)
  assert(source.includes(pattern), `${rel} 缺少 ${label}：${pattern}`)
}

function main(): void {
  const pdaPages = [
    { file: 'src/pages/pda-cutting-pickup.ts', bridge: 'writePdaPickupToFcs(' },
    { file: 'src/pages/pda-cutting-spreading.ts', bridge: 'writePdaSpreadingToFcs(' },
    { file: 'src/pages/pda-cutting-inbound.ts', bridge: 'writePdaInboundToFcs(' },
    { file: 'src/pages/pda-cutting-handover.ts', bridge: 'writePdaHandoverToFcs(' },
    { file: 'src/pages/pda-cutting-replenishment-feedback.ts', bridge: 'writePdaReplenishmentFeedbackToFcs(' },
  ]

  const cutPiecePage = 'src/pages/process-factory/cutting/cut-piece-warehouse.ts'
  const samplePage = 'src/pages/process-factory/cutting/sample-warehouse.ts'
  const pdaBridge = 'src/domain/cutting-pda-writeback/bridge.ts'
  const warehouseBridge = 'src/domain/cutting-warehouse-writeback/bridge.ts'

  assertFileExists(pdaBridge)
  assertFileExists(warehouseBridge)
  assertFileExists('src/data/fcs/cutting/warehouse-writeback-ledger.ts')
  assertFileExists('src/data/fcs/cutting/warehouse-writeback-inputs.ts')

  assertNoPatterns(cutPiecePage, ['updateSourceRecord(', 'record.zoneCode =', 'record.locationLabel =', 'record.inboundStatus =', 'record.handoverStatus ='], '页面本地 mutation')
  assertNoPatterns(samplePage, [
    'updateSampleRecord(',
    'record.flowHistory.push(',
    'record.currentLocationStage =',
    'record.currentHolder =',
    'record.currentStatus =',
    'record.nextSuggestedAction =',
    'record.latestActionAt =',
    'record.latestActionBy =',
  ], '页面本地 mutation / 本地时间线追加')

  assertIncludes(cutPiecePage, 'submitCutPieceWarehouseWriteback(', '正式裁片仓 bridge 调用')
  assertIncludes(samplePage, 'submitSampleWarehouseWriteback(', '正式样衣仓 bridge 调用')

  pdaPages.forEach(({ file, bridge }) => {
    assertNoPatterns(file, ['Date.now(', 'pda-execution-writeback-ledger', 'appendPda'], '绕过 bridge 的业务写回逻辑')
    assertIncludes(file, bridge, '正式 PDA bridge 调用')
    assertIncludes(file, 'buildPdaCuttingWritebackSource(', '统一 writeback source')
  })

  const warehouseInputs = read('src/data/fcs/cutting/warehouse-writeback-inputs.ts')
  ;[
    'warehouseRecordId',
    'sampleRecordId',
    'originalCutOrderId',
    'productionOrderId',
    'materialSku',
    'operatorAccountId',
    'operatorFactoryId',
  ].forEach((key) => {
    assert(warehouseInputs.includes(key), `warehouse-writeback-inputs.ts 缺少正式写回 identity 字段：${key}`)
  })
  assert(!warehouseInputs.includes('仓务原型操作'), '正式仓务写回链仍写死原型操作人文案')

  console.log(
    JSON.stringify(
      {
        仓务页面本地mutation退场: '通过',
        PDA页面未绕过正式bridge: '通过',
        写回桥唯一化: '通过',
        写回payload身份完整: '通过',
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
