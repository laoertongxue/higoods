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

function assertNoImport(rel: string, target: string): void {
  const source = read(rel)
  assert(!source.includes(target), `${rel} 仍直接依赖旧源：${target}`)
}

function assertNoPattern(rel: string, pattern: string, description: string): void {
  const source = read(rel)
  assert(!source.includes(pattern), `${rel} 仍保留 legacy 正式绑定逻辑：${description}`)
}

function main(): void {
  const formalWarehouseSource = 'src/data/fcs/cutting/warehouse-runtime.ts'
  const targetFiles = [
    'src/data/fcs/cutting/runtime-inputs.ts',
    'src/pages/process-factory/cutting/fabric-warehouse-model.ts',
    'src/pages/process-factory/cutting/cut-piece-warehouse-model.ts',
    'src/pages/process-factory/cutting/sample-warehouse-model.ts',
    'src/data/fcs/cutting/cutting-summary.ts',
  ]

  assertFileExists(formalWarehouseSource)
  targetFiles.forEach(assertFileExists)

  targetFiles.forEach((file) => {
    assertNoImport(file, 'warehouse-management')
    assertNoImport(file, 'cut-piece-orders')
  })

  assertNoPattern(
    'src/pages/process-factory/cutting/fabric-warehouse-model.ts',
    'sourceOriginalCutOrderNo: record.cutPieceOrderNo',
    'fabric warehouse 仍用 cutPieceOrderNo 绑定正式原始裁片单',
  )
  assertNoPattern(
    'src/pages/process-factory/cutting/fabric-warehouse-model.ts',
    'row?.productionOrderNo || record.productionOrderNo',
    'fabric warehouse 仍用 legacy productionOrderNo fallback',
  )
  assertNoPattern(
    'src/pages/process-factory/cutting/cut-piece-warehouse-model.ts',
    'new Map(records.map((record) => [record.cutPieceOrderNo',
    'cut-piece warehouse 仍用 cutPieceOrderNo 建正式 runtime map',
  )
  assertNoPattern(
    'src/pages/process-factory/cutting/cut-piece-warehouse-model.ts',
    'row?.originalCutOrderNo || record.cutPieceOrderNo',
    'cut-piece warehouse 仍用 cutPieceOrderNo fallback 原始裁片单',
  )
  assertNoPattern(
    'src/pages/process-factory/cutting/cut-piece-warehouse-model.ts',
    'row.productionOrderNo === record.productionOrderNo',
    'cut-piece warehouse 仍用 productionOrderNo 旧值反查正式对象',
  )
  assertNoPattern(
    'src/pages/process-factory/cutting/sample-warehouse-model.ts',
    'rowByOrderNo[record.relatedCutPieceOrderNo]',
    'sample warehouse 仍用 relatedCutPieceOrderNo 绑定正式对象',
  )
  assertNoPattern(
    'src/pages/process-factory/cutting/sample-warehouse-model.ts',
    'row.productionOrderNo === record.relatedProductionOrderNo',
    'sample warehouse 仍用 relatedProductionOrderNo 绑定正式对象',
  )
  assertNoPattern(
    'src/pages/process-factory/cutting/sample-warehouse-model.ts',
    'row?.originalCutOrderNo || record.relatedCutPieceOrderNo',
    'sample warehouse 仍用 relatedCutPieceOrderNo fallback 原始裁片单',
  )

  ;[
    'PO-202603-018',
    'PO-202603-024',
    'PO-202603-031',
    'PO-202603-027',
  ].forEach((legacyProductionOrderNo) => {
    assertNoPattern(
      'src/data/fcs/cutting/cutting-summary.ts',
      legacyProductionOrderNo,
      `cutting-summary 仍保留旧宇宙生产单号 ${legacyProductionOrderNo}`,
    )
  })

  console.log(
    JSON.stringify(
      {
        正式仓务读源存在: '通过',
        正式runtime不再引旧仓务和旧裁片单源: '通过',
        三个仓务model已移除legacy正式绑定fallback: '通过',
        cuttingSummary已脱离旧仓务和旧裁片单宇宙: '通过',
        旧宇宙PO编号已退场: '通过',
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
