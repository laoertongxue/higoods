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

function assertNoIncludes(rel: string, pattern: string, description: string): void {
  const source = read(rel)
  assert(!source.includes(pattern), `${rel} 仍通过旧来源污染正式 provenance：${description}`)
}

function assertNoRegex(rel: string, pattern: RegExp, description: string): void {
  const source = read(rel)
  assert(!pattern.test(source), `${rel} 仍命中旧 provenance/锚点模式：${description}`)
}

function main(): void {
  const runtimeFile = 'src/data/fcs/cutting/runtime-inputs.ts'
  const platformFiles = [
    'src/domain/cutting-platform/overview.adapter.ts',
    'src/domain/cutting-platform/detail.adapter.ts',
    'src/domain/cutting-platform/overview-prep-projection.ts',
  ]

  assertNoIncludes(runtimeFile, 'warehouse-management', 'runtime-inputs 仍引旧仓务源')
  assertNoIncludes(runtimeFile, 'cut-piece-orders', 'runtime-inputs 仍引旧裁片单源')
  assertNoRegex(runtimeFile, /pages\/process-factory\/cutting\/.+-model(\.ts)?/, 'runtime-inputs 仍借 pages model 做 schema/deserialize')

  platformFiles.forEach((file) => {
    assertNoIncludes(file, 'domain/pickup/page-adapters/cutting-shared', '平台总览链仍引旧 pickup adapter')
    assertNoIncludes(file, 'buildCuttingSummaryPickupView', '平台总览链仍调旧 pickup summary builder')
    assertNoIncludes(file, 'listCuttingPickupViewsByProductionOrder', '平台总览链仍调旧 pickup view 列表')
  })

  assertNoRegex(
    'src/domain/cutting-platform/overview-prep-projection.ts',
    /from ['"][^'"]*(material-prep|cut-piece-orders|cutting-shared)[^'"]*['"]/,
    '正式平台 prep projection 仍依赖旧 page-adapter 或旧 data',
  )

  assertNoRegex(
    'src/data/fcs/cutting/generated-fei-tickets.ts',
    /pages\/process-factory\/cutting\/fei-tickets-model/,
    '正式菲票 source 仍借页面 model / page seed',
  )
  assertNoRegex(
    'src/data/fcs/cutting/transfer-bag-runtime.ts',
    /pages\/process-factory\/cutting\/transfer-bags-model/,
    '正式载具 runtime 仍借页面 model',
  )
  assertNoIncludes(
    'src/data/fcs/pda-cutting-execution-source.ts',
    'pda-cutting-special',
    '正式 PDA execution source 仍吃旧 PDA 平行主源',
  )

  ;[
    'src/data/fcs/cutting/runtime-inputs.ts',
    'src/pages/process-factory/cutting/runtime-projections.ts',
    'src/pages/process-factory/cutting/fabric-warehouse-model.ts',
    'src/pages/process-factory/cutting/cut-piece-warehouse-model.ts',
    'src/pages/process-factory/cutting/sample-warehouse-model.ts',
    'src/domain/cutting-platform/overview-prep-projection.ts',
  ].forEach((file) => {
    assertNoIncludes(file, 'materialLineId', 'legacy materialLineId 仍在正式主锚点链路里出现')
    assertNoIncludes(file, 'bagRowKey', 'legacy bag row key 仍在正式主锚点链路里出现')
    assertNoIncludes(file, 'qrText', 'legacy qr text 仍在正式主锚点链路里出现')
    assertNoIncludes(file, 'rowIndex', 'legacy row index 仍在正式主锚点链路里出现')
  })

  console.log(
    JSON.stringify(
      {
        runtime正式来源纯净: '通过',
        平台总览正式来源纯净: '通过',
        旧平行source退场: '通过',
        legacy主锚点未在正式读链里蔓延: '通过',
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
