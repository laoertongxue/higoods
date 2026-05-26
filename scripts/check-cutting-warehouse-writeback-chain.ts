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
  assert(fs.existsSync(abs(rel)), `${rel} 缺失，仓务正式写回链不完整`)
}

function assertNoForbiddenPatterns(file: string, patterns: string[]): void {
  const source = read(file)
  patterns.forEach((pattern) => {
    if (pattern.endsWith(' =')) {
      const target = pattern.slice(0, -2).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const assignmentPattern = new RegExp(`${target}\\s*=(?!=)`)
      assert(!assignmentPattern.test(source), `${file} 仍残留页面本地 mutation 逻辑：${pattern}`)
      return
    }
    assert(!source.includes(pattern), `${file} 仍残留页面本地 mutation 逻辑：${pattern}`)
  })
}

function main(): void {
  const cutPieceModel = 'src/pages/process-factory/cutting/cut-piece-warehouse-model.ts'
  const cutPieceProjection = 'src/pages/process-factory/cutting/cut-piece-warehouse-projection.ts'
  const warehouseHubPage = 'src/pages/process-factory/cutting/warehouse-hub.ts'
  const samplePage = 'src/pages/process-factory/cutting/sample-warehouse.ts'
  const bridgeFile = 'src/domain/cutting-warehouse-writeback/bridge.ts'
  const ledgerFile = 'src/data/fcs/cutting/warehouse-writeback-ledger.ts'
  const inputsFile = 'src/data/fcs/cutting/warehouse-writeback-inputs.ts'

  assertFileExists(cutPieceModel)
  assertFileExists(cutPieceProjection)
  assertFileExists(warehouseHubPage)
  assertFileExists(samplePage)
  assertFileExists(bridgeFile)
  assertFileExists(ledgerFile)
  assertFileExists(inputsFile)

  assertNoForbiddenPatterns(cutPieceModel, [
    'updateSourceRecord(',
    'record.zoneCode =',
    'record.locationLabel =',
    'record.inboundStatus =',
    'record.handoverStatus =',
  ])

  assertNoForbiddenPatterns(warehouseHubPage, [
    'updateSourceRecord(',
    'record.zoneCode =',
    'record.locationLabel =',
    'record.inboundStatus =',
    'record.handoverStatus =',
  ])

  assertNoForbiddenPatterns(samplePage, [
    'updateSampleRecord(',
    'record.flowHistory.push(',
    'record.currentLocationStage =',
    'record.currentHolder =',
    'record.currentStatus =',
    'record.nextSuggestedAction =',
    'record.latestActionAt =',
    'record.latestActionBy =',
    'sampleWarehouseRecords',
    '仓务原型操作',
  ])

  const cutPieceSource = read(cutPieceModel)
  const warehouseHubSource = read(warehouseHubPage)
  const sampleSource = read(samplePage)
  assert(cutPieceSource.includes('listCutPieceWarehouseWritebacks('), `${cutPieceModel} 未读取正式裁片仓 writeback ledger`)
  assert(warehouseHubSource.includes('appendCuttingRuntimeEvent('), `${warehouseHubPage} 未写入待加工仓 runtime event ledger`)
  ;[
    '中转仓领料',
    '待加工仓扫码入仓',
    '待加工仓加工领料',
    '待加工仓回收入仓',
  ].forEach((eventType) => {
    assert(warehouseHubSource.includes(eventType), `${warehouseHubPage} 缺少待加工仓事件写入：${eventType}`)
  })
  assert(sampleSource.includes('submitSampleWarehouseWriteback('), `${samplePage} 未接正式样衣仓 writeback bridge`)

  const inputsSource = read(inputsFile)
  ;[
    'warehouseRecordId',
    'sampleRecordId',
    'cutOrderId',
    'productionOrderId',
    'operatorAccountId',
    'operatorRole',
    'operatorFactoryId',
  ].forEach((key) => {
    assert(inputsSource.includes(key), `${inputsFile} 缺少正式写回关键字段：${key}`)
  })

  const bridgeSource = read(bridgeFile)
  assert(bridgeSource.includes('submitCutPieceWarehouseWriteback('), `${bridgeFile} 缺少裁片仓 writeback bridge 兼容入口`)
  assert(bridgeSource.includes('appendCutPieceWarehouseWritebackRecord('), `${bridgeFile} 未落账裁片仓 writeback ledger`)
  assert(bridgeSource.includes('appendSampleWarehouseWritebackRecord('), `${bridgeFile} 未落账样衣仓 writeback ledger`)

  console.log(
    JSON.stringify(
      {
        当前仓务页面本地mutation退场: '通过',
        待加工仓runtimeEvent写入存在: '通过',
        裁片仓projection读取writebackLedger存在: '通过',
        正式仓务writebackBridge存在: '通过',
        正式仓务writebackLedger存在: '通过',
        正式写回payload主键完整: '通过',
        操作人正规化退场旧文案: '通过',
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
