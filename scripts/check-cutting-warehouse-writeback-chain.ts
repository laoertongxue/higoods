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
    assert(!source.includes(pattern), `${file} 仍残留页面本地 mutation 逻辑：${pattern}`)
  })
}

function main(): void {
  const cutPiecePage = 'src/pages/process-factory/cutting/cut-piece-warehouse.ts'
  const samplePage = 'src/pages/process-factory/cutting/sample-warehouse.ts'
  const bridgeFile = 'src/domain/cutting-warehouse-writeback/bridge.ts'
  const ledgerFile = 'src/data/fcs/cutting/warehouse-writeback-ledger.ts'
  const inputsFile = 'src/data/fcs/cutting/warehouse-writeback-inputs.ts'

  assertFileExists(bridgeFile)
  assertFileExists(ledgerFile)
  assertFileExists(inputsFile)

  assertNoForbiddenPatterns(cutPiecePage, [
    'updateSourceRecord(',
    'record.zoneCode =',
    'record.locationLabel =',
    'record.inboundStatus =',
    'record.handoverStatus =',
    'cutPieceWarehouseRecords',
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

  const cutPieceSource = read(cutPiecePage)
  const sampleSource = read(samplePage)
  assert(cutPieceSource.includes('submitCutPieceWarehouseWriteback('), `${cutPiecePage} 未接正式裁片仓 writeback bridge`)
  assert(sampleSource.includes('submitSampleWarehouseWriteback('), `${samplePage} 未接正式样衣仓 writeback bridge`)

  const inputsSource = read(inputsFile)
  ;[
    'warehouseRecordId',
    'sampleRecordId',
    'originalCutOrderId',
    'productionOrderId',
    'operatorAccountId',
    'operatorRole',
    'operatorFactoryId',
  ].forEach((key) => {
    assert(inputsSource.includes(key), `${inputsFile} 缺少正式写回关键字段：${key}`)
  })

  const bridgeSource = read(bridgeFile)
  assert(bridgeSource.includes('appendCutPieceWarehouseWritebackRecord('), `${bridgeFile} 未落账裁片仓 writeback ledger`)
  assert(bridgeSource.includes('appendSampleWarehouseWritebackRecord('), `${bridgeFile} 未落账样衣仓 writeback ledger`)

  console.log(
    JSON.stringify(
      {
        页面本地mutation退场: '通过',
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
