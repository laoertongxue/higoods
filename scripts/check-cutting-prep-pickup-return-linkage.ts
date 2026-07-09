#!/usr/bin/env node

import {
  createProductionMaterialPrepSeedStore,
  getMaterialPrepOrderProjection,
  listMaterialPrepOrderProjections,
  PRODUCTION_MATERIAL_PREP_STORAGE_KEY,
} from '../src/data/fcs/cutting/production-material-prep.ts'
import { renderFcsCuttingPrepPage } from '../src/pages/fcs/material-prep/cutting.ts'
import { renderCraftCuttingPickupManagementDetailPage } from '../src/pages/process-factory/cutting/pickup-management.ts'

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

  removeItem(key: string): void {
    this.values.delete(key)
  }
}

const storage = new MemoryStorage()
storage.setItem(PRODUCTION_MATERIAL_PREP_STORAGE_KEY, JSON.stringify(createProductionMaterialPrepSeedStore()))

const rows = listMaterialPrepOrderProjections(storage)
assert(rows.length >= 12, `mock 配料单至少 12 条，当前 ${rows.length} 条`)

const returnedRows = rows.filter((row) => row.returnedLineCount > 0)
assert(returnedRows.length >= 3, '至少需要 3 条有退回事实的 mock 配料单')

const partialReturn = rows.find((row) => row.pickupRecords.some((record) => record.returnStatus === '部分退回'))
assert(partialReturn, '必须覆盖部分退回场景')

const fullReturn = rows.find((row) => row.pickupRecords.some((record) => record.returnStatus === '全部退回'))
assert(fullReturn, '必须覆盖全部退回场景')

const multiReturn = rows.find((row) =>
  row.pickupRecords.some((pickup) =>
    row.pickupReturnRecords.filter((record) => record.pickupRecordId === pickup.pickupRecordId).length >= 2,
  ),
)
assert(multiReturn, '必须覆盖同一领料记录多次部分退回场景')

for (const row of returnedRows) {
  const projection = getMaterialPrepOrderProjection(row.order.prepOrderId, storage)
  assert(projection, `配料单投影必须可按 ID 读取：${row.order.prepOrderId}`)
  assert(projection.returnedLineCount > 0, `配料单必须统计已退回物料行：${row.order.prepOrderNo}`)
  assert(projection.totalReturnedQty > 0, `配料单必须统计已退数量：${row.order.prepOrderNo}`)
  for (const returnRecord of row.pickupReturnRecords) {
    const pickupRecord = row.pickupRecords.find((record) => record.pickupRecordId === returnRecord.pickupRecordId)
    assert(pickupRecord, `退回记录必须能找到对应领料记录：${returnRecord.returnRecordId}`)
    assert(returnRecord.prepRecordId === pickupRecord.prepRecordId, `退回记录配料记录归属必须一致：${returnRecord.returnRecordId}`)
    assert(returnRecord.prepLineId === pickupRecord.prepLineId, `退回记录物料行归属必须一致：${returnRecord.returnRecordId}`)
    assert(returnRecord.prepOrderId === pickupRecord.prepOrderId, `退回记录配料单归属必须一致：${returnRecord.returnRecordId}`)
    assert(returnRecord.productionOrderId === pickupRecord.productionOrderId, `退回记录生产单归属必须一致：${returnRecord.returnRecordId}`)
  }
  const latestReturnRecord = projection.pickupReturnRecords.find((record) => record.returnedAt === projection.latestOperatedAt)
  assert(
    latestReturnRecord,
    `最近操作必须能取到退回时间：${row.order.prepOrderNo}`,
  )
  assert(
    projection.latestOperatorName === latestReturnRecord.returnedBy,
    `最近操作人必须取到退回人：${row.order.prepOrderNo}`,
  )
}

const originalWindow = (globalThis as typeof globalThis & { window?: unknown }).window

function renderCuttingPrepPage(search: string): string {
  ;(globalThis as typeof globalThis & { window: unknown }).window = {
    location: { pathname: '/fcs/material-prep/cutting', search },
    history: { pushState() {}, replaceState() {} },
    addEventListener() {},
    removeEventListener() {},
  }
  return renderFcsCuttingPrepPage()
}

function renderPickupManagementDetailPage(search: string): string {
  ;(globalThis as typeof globalThis & { window: unknown }).window = {
    location: { pathname: '/fcs/craft/cutting/pickup-management-detail', search },
    history: { pushState() {}, replaceState() {} },
    addEventListener() {},
    removeEventListener() {},
  }
  return renderCraftCuttingPickupManagementDetailPage()
}

try {
  const listHtml = renderCuttingPrepPage('?hasReturn=1')
  assert(listHtml.includes('已退回'), '裁片配料列表必须展示已退回物料行统计')
  assert(listHtml.includes('只看有退回'), '裁片配料列表必须展示只看有退回筛选')
  const mainTabButtons = Array.from(listHtml.matchAll(/<button[^>]*data-nav="[^"]*(?:\\?|&amp;)tab=[^"]*"[^>]*>([\s\S]*?)<\/button>/g))
    .map((match) => match[1].replace(/<[^>]*>/g, '').trim())
  assert(mainTabButtons.length > 0, '裁片配料列表必须渲染主状态 Tab')
  assert(
    mainTabButtons.every((text) => !/^已退回(?:\s|$)/.test(text)),
    `裁片配料主状态 Tab 不能新增已退回：${mainTabButtons.join(' / ')}`,
  )
  const contextHtml = renderCuttingPrepPage('?hasReturn=1&keyword=PO-202603')
  const firstDetailHref = contextHtml.match(/data-nav="([^"]*prepOrderId=[^"]*)"/)?.[1] || ''
  assert(firstDetailHref.includes('hasReturn=1'), '从退回筛选列表进入详情必须保留 hasReturn=1')
  assert(firstDetailHref.includes('keyword=PO-202603'), '从关键词筛选列表进入详情必须保留 keyword')

  const returnedOrder = returnedRows[0]
  const detailHtml = renderCuttingPrepPage(`?prepOrderId=${encodeURIComponent(returnedOrder.order.prepOrderId)}&detailTab=pickup&hasReturn=1&keyword=PO-202603`)
  const backHref = detailHtml.match(/data-nav="([^"]*)">返回配料列表/)?.[1] || ''
  assert(backHref.includes('hasReturn=1'), '从详情返回列表必须保留 hasReturn=1')
  assert(backHref.includes('keyword=PO-202603'), '从详情返回列表必须保留 keyword')
  assert(detailHtml.includes('领料 / 退回记录'), '裁片配料详情 pickup Tab 必须展示领料 / 退回记录')
  assert(detailHtml.includes('已退'), '裁片配料详情领料记录必须展示已退数量')
  assert(detailHtml.includes('已退回待中转仓处理'), '裁片配料详情退回明细必须展示退回状态')

  const pickupDetailHtml = renderPickupManagementDetailPage(`?prepOrderId=${encodeURIComponent(returnedOrder.order.prepOrderId)}&detailTab=returns`)
  assert(pickupDetailHtml.includes('查看裁片配料'), '领料详情退回记录必须提供查看裁片配料入口')
  assert(pickupDetailHtml.includes(returnedOrder.order.prepOrderNo), '领料详情退回记录必须展示配料单号')
  assert(
    pickupDetailHtml.includes(returnedOrder.pickupReturnRecords[0].prepRecordId),
    '领料详情退回记录必须展示配料记录 ID',
  )
  assert(
    pickupDetailHtml.includes(returnedOrder.pickupReturnRecords[0].pickupRecordId),
    '领料详情退回记录必须展示领料记录 ID',
  )
} finally {
  if (originalWindow === undefined) {
    delete (globalThis as typeof globalThis & { window?: unknown }).window
  } else {
    ;(globalThis as typeof globalThis & { window: unknown }).window = originalWindow
  }
}

console.log('裁片配料与领料退回联动数据检查通过')
