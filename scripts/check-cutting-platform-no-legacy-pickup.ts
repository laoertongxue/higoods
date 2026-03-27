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

function assertNoIncludes(rel: string, text: string, message: string): void {
  const source = read(rel)
  assert(!source.includes(text), `${rel} ${message}`)
}

function assertIncludes(rel: string, text: string, message: string): void {
  const source = read(rel)
  assert(source.includes(text), `${rel} ${message}`)
}

function main(): void {
  const overviewFile = 'src/domain/cutting-platform/overview.adapter.ts'
  const detailFile = 'src/domain/cutting-platform/detail.adapter.ts'
  const prepProjectionFile = 'src/domain/cutting-platform/overview-prep-projection.ts'

  ;[overviewFile, detailFile, prepProjectionFile].forEach(assertFileExists)

  ;[
    'domain/pickup/page-adapters/cutting-shared',
    'buildCuttingSummaryPickupView',
    'listCuttingPickupViewsByProductionOrder',
    'buildPlatformCuttingPickupSummary',
    'buildEmptyPlatformCuttingPickupSummary',
  ].forEach((legacyToken) => {
    assertNoIncludes(overviewFile, legacyToken, `仍引用旧 pickup/prep adapter：${legacyToken}`)
    assertNoIncludes(detailFile, legacyToken, `仍引用旧 pickup/prep adapter：${legacyToken}`)
  })

  ;[
    'material-prep',
    'cut-piece-orders',
    'domain/pickup/page-adapters/cutting-shared',
  ].forEach((legacyToken) => {
    assertNoIncludes(prepProjectionFile, legacyToken, `仍间接依赖旧 data/adapter：${legacyToken}`)
  })

  assertIncludes(prepProjectionFile, 'buildPlatformCuttingPrepProjection', '缺少正式 pickup/prep projection builder')
  assertIncludes(prepProjectionFile, 'productionOrderId', '未体现正式生产单主键输出')
  assertIncludes(prepProjectionFile, 'productionOrderNo', '未体现正式生产单主编号输出')

  assertIncludes(overviewFile, 'productionOrderId:', '平台总览行已不再显式输出 productionOrderId')
  assertIncludes(overviewFile, 'productionOrderNo:', '平台总览行已不再显式输出 productionOrderNo')
  assertIncludes(overviewFile, 'buildPlatformCuttingPrepProjection', 'overview.adapter.ts 尚未切到正式 pickup/prep projection')

  console.log(
    JSON.stringify(
      {
        平台总览已脱离旧pickupAdapter: '通过',
        平台总览链已脱离旧materialPrep和cutPieceOrders数据: '通过',
        正式platformPickupPrepProjection存在: '通过',
        平台总览仍以正式生产单为主对象: '通过',
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
