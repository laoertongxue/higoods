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
    'src/pages/pda-cutting-task-detail.ts',
    'src/pages/pda-warehouse-wait-process.ts',
    'src/pages/pda-cutting-spreading.ts',
    'src/pages/pda-cutting-inbound.ts',
    'src/pages/pda-cutting-handover.ts',
  ]

  const cutPiecePage = 'src/pages/process-factory/cutting/warehouse-hub.ts'
  const samplePage = 'src/pages/process-factory/cutting/sample-warehouse.ts'
  const warehouseBridge = 'src/domain/cutting-warehouse-writeback/bridge.ts'

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

  assertIncludes(cutPiecePage, 'cutting-runtime-event-ledger', '正式裁片仓统一事件账模块')
  assertIncludes(cutPiecePage, 'appendCuttingRuntimeEvent', '正式裁片仓统一事件账写入')
  assertIncludes(samplePage, 'submitSampleWarehouseWriteback(', '正式样衣仓 bridge 调用')

  pdaPages.forEach((file) => {
    assertNoPatterns(file, ['Date.now(', 'pda-execution-writeback-ledger', 'appendPda'], '旧 PDA 写回逻辑')
    if (file === 'src/pages/pda-cutting-inbound.ts' || file === 'src/pages/pda-cutting-handover.ts') {
      assertIncludes(file, 'wait-handover-runtime', '待交出仓 runtime 统一事件账适配')
    } else {
      assertIncludes(file, 'cutting-runtime-event-ledger', '统一裁床事件账模块')
      assertIncludes(file, 'appendCuttingRuntimeEvent', '统一裁床事件账写入')
    }
  })

  const warehouseInputs = read('src/data/fcs/cutting/warehouse-writeback-inputs.ts')
  ;[
    'warehouseRecordId',
    'sampleRecordId',
    'cutOrderId',
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
