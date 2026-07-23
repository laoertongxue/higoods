#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import {
  createProductionMaterialPrepSeedStore,
  listMaterialPrepOrderProjections,
  PRODUCTION_MATERIAL_PREP_STORAGE_KEY,
  serializeProductionMaterialPrepStore,
} from '../src/data/fcs/cutting/production-material-prep.ts'
import { renderFcsMaterialPrepListPage } from '../src/pages/fcs/material-prep/list.ts'
import { renderFcsCuttingPrepPage } from '../src/pages/fcs/material-prep/cutting.ts'
import { renderFcsSewingPrepPage } from '../src/pages/fcs/material-prep/sewing.ts'
import { renderFcsOtherPrepPage } from '../src/pages/fcs/material-prep/other.ts'
import { renderFcsDyeingPrepPage } from '../src/pages/fcs/material-prep/dyeing.ts'
import { renderFcsPrintingPrepPage } from '../src/pages/fcs/material-prep/printing.ts'
import { buildProductionOrderOverviewRows } from '../src/pages/process-factory/cutting/production-order-overview-projection.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

class MemoryStorage {
  private readonly values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

const storage = new MemoryStorage()
storage.setItem(
  PRODUCTION_MATERIAL_PREP_STORAGE_KEY,
  serializeProductionMaterialPrepStore(createProductionMaterialPrepSeedStore()),
)
const originalWindow = (globalThis as typeof globalThis & { window?: unknown }).window
const originalStorage = (globalThis as typeof globalThis & { localStorage?: unknown }).localStorage
;(globalThis as typeof globalThis & { localStorage: unknown }).localStorage = storage
;(globalThis as typeof globalThis & { window: unknown }).window = {
  location: { pathname: '/fcs/material-prep', search: '' },
  localStorage: storage,
  history: { pushState() {}, replaceState() {} },
  addEventListener() {},
  removeEventListener() {},
}

try {
  const projections = listMaterialPrepOrderProjections(storage)
  const overviewRows = buildProductionOrderOverviewRows()
  const multiUnitReady = projections.find((projection) =>
    projection.order.overallPrepStatus === 'READY' && projection.unitSummaries.length > 1
      && overviewRows.some((row) => row.productionOrderId === projection.order.productionOrderId)
  )
  assert(multiUnitReady, '必须存在多单位且已配齐生产单')
  const overviewRow = overviewRows.find((row) =>
    row.productionOrderId === multiUnitReady.order.productionOrderId
  )
  assert(overviewRow?.materialPrepStatus === '配料完成', '多单位已配齐生产单不得因 nullable totals 被判成未配料')

  const pageHtml = [
    renderFcsMaterialPrepListPage(),
    renderFcsCuttingPrepPage(),
    renderFcsSewingPrepPage(),
    renderFcsOtherPrepPage(),
    renderFcsDyeingPrepPage(),
    renderFcsPrintingPrepPage(),
  ].join('\n')
  assert(!pageHtml.includes('>null<') && !pageHtml.includes(' null '), '配料页面不得输出 null')
  assert(pageHtml.includes('yard') && pageHtml.includes('条'), '多单位数量必须按单位展示')

  const warehouseHubSource = fs.readFileSync(
    path.join(process.cwd(), 'src/pages/process-factory/cutting/warehouse-hub.ts'),
    'utf8',
  )
  assert(!warehouseHubSource.includes('String(prepContext.totalAvailableToPickupQty)'), '待加工仓不得继续直接展示 nullable 可领总数')
  ;[
    'src/pages/fcs/material-prep/list.ts',
    'src/pages/fcs/material-prep/cutting.ts',
    'src/pages/fcs/material-prep/sewing.ts',
    'src/pages/fcs/material-prep/other.ts',
    'src/pages/fcs/material-prep/dyeing.ts',
    'src/pages/fcs/material-prep/printing.ts',
    'src/data/fcs/production-object-overview.ts',
  ].forEach((relativePath) => {
    const source = fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')
    assert(
      !/formatQty\([^)]*total(?:Required|ConfirmedPrep|Picked|AvailableToPickup|Shortage)Qty/.test(source),
      `${relativePath} 仍直接格式化 nullable 无量纲总数`,
    )
  })
} finally {
  if (originalWindow === undefined) delete (globalThis as typeof globalThis & { window?: unknown }).window
  else (globalThis as typeof globalThis & { window: unknown }).window = originalWindow
  if (originalStorage === undefined) delete (globalThis as typeof globalThis & { localStorage?: unknown }).localStorage
  else (globalThis as typeof globalThis & { localStorage: unknown }).localStorage = originalStorage
}

console.log('配料按单位汇总下游消费者检查通过')
