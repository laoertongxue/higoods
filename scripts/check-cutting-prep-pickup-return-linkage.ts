#!/usr/bin/env node

import {
  appendPickupSessionFromNode,
  createProductionMaterialPrepSeedStore,
  getMaterialPrepOrderProjection,
  listActivePickupNodes,
  listMaterialPrepOrderProjections,
  PRODUCTION_MATERIAL_PREP_STORAGE_KEY,
  serializeProductionMaterialPrepStore,
} from '../src/data/fcs/cutting/production-material-prep.ts'
import { renderFcsCuttingPrepPage } from '../src/pages/fcs/material-prep/cutting.ts'
import {
  renderCraftCuttingPickupManagementDetailPage,
  renderCraftCuttingPickupManagementPage,
} from '../src/pages/process-factory/cutting/pickup-management.ts'

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
storage.setItem(PRODUCTION_MATERIAL_PREP_STORAGE_KEY, serializeProductionMaterialPrepStore(createProductionMaterialPrepSeedStore()))

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
  assert(
    projection.unitSummaries.some((summary) => summary.returnedQty > 0),
    `配料单必须按单位统计已退数量：${row.order.prepOrderNo}`,
  )
  for (const returnRecord of row.pickupReturnRecords) {
    const pickupRecord = row.pickupRecords.find((record) => record.pickupRecordId === returnRecord.pickupRecordId)
    assert(pickupRecord, `退回记录必须能找到对应领料记录：${returnRecord.returnRecordId}`)
    assert(returnRecord.prepRecordId === pickupRecord.prepRecordId, `退回记录配料记录归属必须一致：${returnRecord.returnRecordId}`)
    assert(returnRecord.prepLineId === pickupRecord.prepLineId, `退回记录物料行归属必须一致：${returnRecord.returnRecordId}`)
    assert(returnRecord.prepOrderId === pickupRecord.prepOrderId, `退回记录配料单归属必须一致：${returnRecord.returnRecordId}`)
    assert(returnRecord.productionOrderId === pickupRecord.productionOrderId, `退回记录生产单归属必须一致：${returnRecord.returnRecordId}`)
  }
  const latestReturnRecord = projection.pickupReturnRecords.find((record) => record.returnedAt === projection.latestOperatedAt)
  if (latestReturnRecord) {
    assert(
      projection.latestOperatorName === latestReturnRecord.returnedBy,
      `退回是最近操作时必须取到退回人：${row.order.prepOrderNo}`,
    )
  } else {
    assert(projection.order.isClosed, `退回后仅允许关闭配料单成为更晚操作：${row.order.prepOrderNo}`)
  }
}

const originalWindow = (globalThis as typeof globalThis & { window?: unknown }).window

function mockWindow(pathname: string, search: string): void {
  ;(globalThis as typeof globalThis & { window: unknown }).window = {
    location: { pathname, search },
    history: { pushState() {}, replaceState() {} },
    addEventListener() {},
    removeEventListener() {},
  }
}

function restoreWindow(): void {
  if (originalWindow === undefined) {
    delete (globalThis as typeof globalThis & { window?: unknown }).window
  } else {
    ;(globalThis as typeof globalThis & { window: unknown }).window = originalWindow
  }
}

function renderCuttingPrepPage(search: string): string {
  mockWindow('/fcs/material-prep/cutting', search)
  return renderFcsCuttingPrepPage()
}

function renderPickupManagementDetailPage(search: string): string {
  mockWindow('/fcs/craft/cutting/pickup-management-detail', search)
  return renderCraftCuttingPickupManagementDetailPage()
}

function renderPickupManagementPage(search: string): string {
  mockWindow('/fcs/craft/cutting/pickup-management', search)
  return renderCraftCuttingPickupManagementPage()
}

try {
  const listHtml = renderCuttingPrepPage('?hasReturn=1')
  assert(listHtml.includes('已退回'), '裁片配料列表必须展示已退回物料行统计')
  assert(listHtml.includes('只看有退回'), '裁片配料列表必须展示只看有退回筛选')

  const contextHtml = renderCuttingPrepPage('?hasReturn=1&keyword=PO-202603')
  const firstDetailHref = contextHtml.match(/data-nav="([^"]*prepOrderId=[^"]*)"/)?.[1] || ''
  assert(firstDetailHref.includes('hasReturn=1'), '从退回筛选列表进入详情必须保留 hasReturn=1')

  const returnedOrder = returnedRows[0]
  const detailHtml = renderCuttingPrepPage(`?prepOrderId=${encodeURIComponent(returnedOrder.order.prepOrderId)}&detailTab=pickup&hasReturn=1&keyword=PO-202603`)
  assert(detailHtml.includes('领料 / 退回记录'), '裁片配料详情 pickup Tab 必须展示领料 / 退回记录')
  assert(detailHtml.includes('已退'), '裁片配料详情领料记录必须展示已退数量')
  assert(detailHtml.includes('已退回待中转仓处理'), '裁片配料详情退回明细必须展示退回状态')

  const khakiReturnRow = rows.find((row) => row.pickupReturnRecords.some((record) => record.prepLineId === 'prep-line-po-0102-khaki'))
  assert(khakiReturnRow, '必须存在裁片 Khaki 主面料退回场景')
  const khakiDetailHtml = renderCuttingPrepPage(`?prepOrderId=${encodeURIComponent(khakiReturnRow.order.prepOrderId)}&detailTab=pickup`)
  assert(khakiDetailHtml.includes('已退：5 卷 / 1,386 yard'), '裁片配料详情必须展示 Khaki 退回卷数和 yard')
  assert(!khakiDetailHtml.includes('已退：0 yard'), '裁片配料详情不应展示无退回物料行的已退 0 yard')

  const pageStorage = new MemoryStorage()
  pageStorage.setItem(PRODUCTION_MATERIAL_PREP_STORAGE_KEY, storage.getItem(PRODUCTION_MATERIAL_PREP_STORAGE_KEY) || '')
  ;(globalThis as any).localStorage = pageStorage

  const allNodes = listActivePickupNodes(storage)
  assert(allNodes.length > 0, '必须存在活动节点')

  const pickupListHtml = renderPickupManagementPage('')
  assert(pickupListHtml.includes('未配齐清单'), '领料管理列表必须展示未配齐清单节点')
  assert(pickupListHtml.includes('已配齐待领'), '领料管理列表必须展示已配齐待领节点')
  assert(pickupListHtml.includes('历史有效已领'), '领料管理列表必须展示历史有效已领列')
  assert(pickupListHtml.includes('办理领料入库'), '领料管理列表必须提供办理领料入库按钮')

  const detailPickupNode = allNodes.find((n) => n.nodeType === 'READY_TO_PICKUP')
  assert(detailPickupNode, '必须存在已配齐待领节点用于详情验证')
  const detailSearch = `?pickupNodeId=${encodeURIComponent(detailPickupNode.nodeId)}`
  const pickupDetailHtml = renderPickupManagementDetailPage(detailSearch)
  assert(pickupDetailHtml.includes('当前节点全部物料'), '领料详情必须展示节点全部物料')
  assert(pickupDetailHtml.includes('物料明细'), '领料详情必须展示物料明细')
  assert(pickupDetailHtml.includes('本轮全部领取'), '领料详情必须提供本轮全部领取按钮')

  const pickupSession = appendPickupSessionFromNode({
    pickupNodeId: detailPickupNode.nodeId,
    pickupNodeVersion: detailPickupNode.version,
    receiverName: '裁床 李明',
    warehouseArea: '待加工仓 A 区',
    locationCode: 'FAB-A-09',
    waitProcessLedgerEventId: 'check-linkage-pickup',
  }, storage)
  assert(pickupSession.pickupRecordIds.length > 0, '必须生成领料明细')

  const pickupProjection = listMaterialPrepOrderProjections(storage).find((p) => p.order.prepOrderId === detailPickupNode.prepOrderId)
  assert(pickupProjection?.pickupSessions.length, '确认后配料单投影必须包含领料主记录')
  assert(pickupProjection.pickupSessions[0].status === '本轮已领完', '主记录状态必须是本轮已领完')
  assert(pickupProjection.pickupRecords.some((r) => r.pickupSessionId === pickupSession.pickupSessionId), '领料明细必须关联到主记录')

} finally {
  restoreWindow()
}

console.log('裁片配料与领料退回联动数据检查通过')
