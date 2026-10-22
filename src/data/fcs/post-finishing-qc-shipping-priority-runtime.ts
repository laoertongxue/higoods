import {finishedInventoryRealtimeRows} from '../wls/finished-inventory-quality.ts'
import {ensureFinishedInventoryRecords} from '../wls/finished-inventory-records.ts'
import { loadFinishedOutboundOrders, FINISHED_OUTBOUND_SEED, type FinishedOutboundOrder } from '../wls/finished-outbound-orders.ts'
import { stockRealtimeSeed } from '../wls/seed/stock-seed.ts'
import { warehouseSeed } from '../wls/seed/shared-seed.ts'
import type { StockRealtimeItem } from '../wls/types.ts'
import { calculateQcShippingPriority, parseQcShippingDeadlineMillis, type PriorityDemand, type PriorityStock, type PriorityPostSupply } from './post-finishing-qc-shipping-priority.ts'
import { projectQcShippingSupply } from './post-finishing-qc-shipping-supply.ts'
import { ensurePostFinishingExecutionRecordState, ensurePreparedPostFinishingRecordState, getPostFinishingStorageFailure, assertPostFinishingReadVersion } from './post-finishing-records.ts'
import { listPostFinishingQcShippingFacts, listPostFinishingFullFlowPostTasks, listPostFinishingFullFlowRecheckOrders, listPostFinishingFullFlowOutboundOrders, listPostFinishingWarehouseReceipts, getPostFinishingFullFlowQcTask, type PostFinishingQcTask, type PostFinishingAcceptanceSku } from './post-finishing-full-flow.ts'
import { readQcShippingPriorityRules, readQcShippingDestination as readDestinationFact, saveQcShippingPriorityRules, saveQcShippingDestinationFact } from './post-finishing-qc-shipping-facts.ts'
import { QC_SHIPPING_WAREHOUSES, QC_SHIPPING_STOCK_SEEDS } from './post-finishing-qc-shipping-seeds.ts'
import { readGarmentReplacementSnapshotForPriority, normalize, type GarmentReplacementStoreSnapshot } from './garment-spu-replacement-records.ts'
import { POST_FINISHING_PRODUCTION_SOURCE_FIXTURES } from './post-finishing-production-source-fixtures.ts'

export { readQcShippingPriorityRules, saveQcShippingPriorityRules }
export interface QcShippingPriorityDocument {
  ready: boolean; issues: string[]; asOf: string; ruleVersion: number; stars: number; label: string
  rows: Array<{ sku: string; warehouseName: string; overdue: number; today: number; tomorrow: number; todayOverdue: number }>
  todayTotal: number; tomorrowTotal: number; overdueTotal: number
}
let orders: FinishedOutboundOrder[] = []
let prepared = false
let failure = ''
let asOf = Date.now()
let inventoryIssues: string[] = []
let replacementRead: GarmentReplacementStoreSnapshot | undefined

export function listQcShippingWarehouses(): Array<{ id: string; name: string }> {
  return [...QC_SHIPPING_WAREHOUSES, ...warehouseSeed.filter(row => row.enabled && row.businessType === 'FINISHED').map(row => ({ id: row.code, name: row.name }))]
}
function warehouseId(nameOrId: string): string | undefined { return listQcShippingWarehouses().find(row => row.id === nameOrId || row.name === nameOrId)?.id }
function warehouseName(id: string): string { return listQcShippingWarehouses().find(row => row.id === id)?.name || id }
export function readQcShippingDestination(sourceId: string) {
  const own = readDestinationFact(sourceId)
  if (own) return own
  const qc = getPostFinishingFullFlowQcTask(sourceId)
  const parent = qc && readDestinationFact(qc.productionOrderNo)
  return parent ? { ...parent, sourceId, version: 0 } : undefined
}
export async function saveQcShippingDestination(input: { sourceId: string; warehouseId: string; expectedVersion: number; operator: string; reason: string }): Promise<void> {
  const qc = getPostFinishingFullFlowQcTask(input.sourceId)
  if (!qc || !warehouseId(input.warehouseId)) throw new Error('质检批次或目标成衣仓无效，请重新读取。')
  if (listPostFinishingFullFlowOutboundOrders().some(row => row.qcTaskId === qc.qcTaskId && !row.targetWarehouseId)) throw new Error('已有出货子单缺少冻结去向，请先核对子单目标仓，再维护尚未出货部分。')
  await saveQcShippingDestinationFact(input)
}
function versions(rows: FinishedOutboundOrder[]): string { return JSON.stringify(rows.map(row => [row.id, row.version]).sort()) }
export async function preparePostFinishingQcShippingPriority(): Promise<void> {
  prepared = false; failure = ''
  try {
    // The prepared execution view retains all physical QC consumers; do not
    // reload unrelated archived inspection standard trees for an urgency label.
    if(typeof window!=='undefined' && window.location?.pathname==='/wls/finished/stock/realtime')await ensurePostFinishingExecutionRecordState(window.location.pathname+window.location.search)
    else await ensurePreparedPostFinishingRecordState()
    if (getPostFinishingStorageFailure()) throw new Error(getPostFinishingStorageFailure())
    await ensureFinishedInventoryRecords()
    const identity = readGarmentReplacementSnapshotForPriority()
    const first = typeof window === 'undefined' ? structuredClone(FINISHED_OUTBOUND_SEED) : await loadFinishedOutboundOrders()
    // Independent databases cannot share a transaction. Reject a changed read set.
    const second = typeof window === 'undefined' ? first : await loadFinishedOutboundOrders()
    if (versions(first) !== versions(second)) throw new Error('读取期间出库需求已变化，请重新查看。')
    await assertPostFinishingReadVersion()
    if (JSON.stringify(identity) !== JSON.stringify(readGarmentReplacementSnapshotForPriority())) throw new Error('读取期间成衣换码身份已变化，请重新查看。')
    replacementRead = identity
    orders = second; asOf = Date.now(); prepared = true
  } catch (error) { failure = error instanceof Error ? error.message : String(error) }
}

export function resolveQcShippingIdentity(qc: PostFinishingQcTask, sku: PostFinishingAcceptanceSku, stage: 'reference' | 'post' | 'warehouse', issues: string[], snapshot: GarmentReplacementStoreSnapshot = readGarmentReplacementSnapshotForPriority()): string {
  const replacement = snapshot.records.find(row => (row.productionOrderId === qc.productionOrderId || row.productionOrderNo === qc.productionOrderNo) && normalize(row.sourceColor) === normalize(sku.colorName))
  const line = replacement?.lines.find(row => normalize(row.size) === normalize(sku.sizeName) && [row.source.skuCode, row.target.skuCode].includes(sku.skuCode))
  if (!replacement || !line) return sku.skuCode
  if (stage === 'reference') return line.target.skuCode
  if (stage === 'warehouse') {
    // These warehouse segments are NEW post-finishing receipts, not the old
    // warehouse batches frozen when the replacement was created.
    if (sku.skuCode === line.target.skuCode || (line.postFactoryQty > 0 && line.postRelabeledQty >= line.postFactoryQty)) return line.target.skuCode
    const batches = snapshot.inventoryBatches.filter(row => row.replacementId === replacement.replacementId && row.size === line.size)
    if (batches.length && batches.every(row => row.relabeled && row.currentIdentity.skuCode === line.target.skuCode)) return line.target.skuCode
    issues.push(`${qc.qcTaskNo} ${sku.skuCode} 成衣换码尚未完成，库存身份需核对。`)
    return line.target.skuCode
  }
  if (line.postRelabeledQty >= line.postFactoryQty) return line.target.skuCode
  issues.push(`${qc.qcTaskNo} ${sku.skuCode} 后道换码分量尚未明确，不能抵扣原SKU需求。`)
  return line.target.skuCode
}

/** One physical baseline plus uniquely identified receipts; never a second writable stock ledger. */
function readSupplies(skus?: Set<string>, identity: GarmentReplacementStoreSnapshot = readGarmentReplacementSnapshotForPriority(), warehouseRows=finishedInventoryRealtimeRows()) {
  const issues: string[] = []
  const qcs = listPostFinishingQcShippingFacts().filter(row=>row.sourceKind!=='WAREHOUSE_STOCK' && Array.isArray(row.lines))
  const wantedQcs = skus ? qcs.filter(qc => qc.lines.some(line => skus.has(resolveQcShippingIdentity(qc, line.sku, 'reference', issues, identity)) || skus.has(line.sku.skuCode))) : qcs
  const ids = new Set(wantedQcs.map(row => row.qcTaskId))
  const postTasks = listPostFinishingFullFlowPostTasks().filter(row => ids.has(row.qcTaskId))
  const rechecks = listPostFinishingFullFlowRecheckOrders().filter(row => ids.has(row.qcTaskId))
  const outbounds = listPostFinishingFullFlowOutboundOrders().filter(row => ids.has(row.qcTaskId))
  const outboundIds = new Set(outbounds.map(row => row.outboundOrderId))
  const receipts = listPostFinishingWarehouseReceipts().filter(row => outboundIds.has(row.outboundOrderId))
  const projection = projectQcShippingSupply({ qcs: wantedQcs, postTasks, rechecks, outbounds, receipts })
  issues.push(...projection.issues.map(row => row.message))
  const stocks: PriorityStock[] = structuredClone(QC_SHIPPING_STOCK_SEEDS).filter(row => !skus || skus.has(row.sku))
  for (const row of warehouseRows) {
    if (skus && !skus.has(row.sku)) continue
    if (!warehouseSeed.some(warehouse => warehouse.name === row.warehouseName && warehouse.businessType === 'FINISHED' && warehouse.enabled)) continue
    const id = warehouseId(row.warehouseId || row.warehouseName)
    if (!id) { issues.push(`${row.warehouseName} 仓库身份尚未对应。`); continue }
    const occupied = row.preSaleOrderOccupiedQuantity + row.spotOrderOccupiedQuantity
    if (occupied) issues.push(`${row.warehouseName} ${row.sku} 仅有占用汇总，需核对对应订单。`)
    stocks.push({ id: row.id, warehouseId: id, sku: row.sku, quantity: row.spotStock, reservations: [] })
  }
  const postSupplies: PriorityPostSupply[] = []
  for (const part of projection.segments) {
    if (!part.quantity) continue
    const qc = wantedQcs.find(row => row.qcTaskId === part.qcTaskId)!
    const sku = resolveQcShippingIdentity(qc, part.sku, part.position === 'warehouse' ? 'warehouse' : 'post', issues, identity)
    if (skus && !skus.has(sku)) continue
    const outbound = part.outboundOrderId && outbounds.find(row => row.outboundOrderId === part.outboundOrderId)
    const receipt = part.receiptId && receipts.find(row => row.receiptId === part.receiptId)
    const destination = (receipt && receipt.warehouseId) || (outbound && outbound.targetWarehouseId) || readQcShippingDestination(qc.qcTaskId)?.warehouseId
    if (!destination || !warehouseId(destination)) { issues.push(`${qc.qcTaskNo} ${sku} 供货去向需核对。`); continue }
    if (part.position === 'post') postSupplies.push({ id: part.id, sku, warehouseId: destination, quantity: part.quantity })
    else stocks.push({ id: `receipt-stock:${part.id}`, sku, warehouseId: destination, quantity: part.quantity, reservations: [] })
  }
  return { stocks, postSupplies, issues }
}

function buildDocument(qcs: PostFinishingQcTask[]): QcShippingPriorityDocument | undefined {
  const pending = qcs.filter(row => row.status === '待质检' && row.sourceKind!=='WAREHOUSE_STOCK')
  if (!pending.length) return undefined
  const issues = [failure, !prepared ? '发货需求资料尚未读取完成，请重新查看。' : ''].filter(Boolean)
  try {
    const identity = replacementRead || readGarmentReplacementSnapshotForPriority()
    if (JSON.stringify(identity) !== JSON.stringify(readGarmentReplacementSnapshotForPriority())) issues.push('换码身份已变化，请重新查看。')
    const skus = new Set(pending.flatMap(qc => qc.lines.filter(line => line.expectedQty > 0).map(line => resolveQcShippingIdentity(qc, line.sku, 'reference', issues, identity))))
    const { stocks, postSupplies, issues: supplyIssues } = readSupplies(skus, identity)
    issues.push(...supplyIssues)
    const demands: PriorityDemand[] = []
    for (const order of orders) {
      if (parseQcShippingDeadlineMillis(order.deadline, order.deadlineTimeZone || 'Asia/Jakarta') === undefined) issues.push(`${order.outboundOrderNo} 揽收时效无效，需依据来源核对。`)
      if (!['待处理', '待拣货', '拣货完成', '已打单'].includes(order.status)) continue
      for (const [index, line] of order.products.entries()) {
        if (!skus.has(line.sku)) continue
        const wh = warehouseId(order.warehouse)
        if (!wh) { issues.push(`${order.outboundOrderNo} 出库仓库未对应。`); continue }
        if (!order.deadlineTimeZone) { issues.push(`${order.outboundOrderNo} 揽收时效来源时区需核对。`); continue }
        if (!stocks.some(row => row.sku === line.sku && row.warehouseId === wh)) issues.push(`${order.warehouse} ${line.sku} 合格库存来源未覆盖，不能当作零。`)
        demands.push({ id: line.lineId || `${order.id}:${line.sku}:${index}`, orderId: order.id, sku: line.sku, warehouseId: wh, quantity: line.quantity, deadline: order.deadline, deadlineTimeZone: order.deadlineTimeZone })
      }
    }
    const activeIds = new Set(demands.map(row => row.id))
    // A released demand does not silently release its physical reservation.
    for (const stock of stocks) for (const reservation of stock.reservations) if (reservation.orderLineId && !activeIds.has(reservation.orderLineId)) {
      const known = orders.some(order => order.products.some(line => line.lineId === reservation.orderLineId))
      if (known) delete reservation.orderLineId
    }
    const result = calculateQcShippingPriority({ demands, stocks, postSupplies, rules: readQcShippingPriorityRules(), nowMs: asOf, issues })
    const rows = result.rows.filter(row => skus.has(row.sku)).map(row => ({ sku: row.sku, warehouseName: warehouseName(row.warehouseId), overdue: row.overdue, today: row.today, tomorrow: row.tomorrow, todayOverdue: row.todayOverdue }))
    const stars = Math.max(0, ...result.rows.map(row => row.stars))
    const overdueTotal = rows.reduce((s, row) => s + row.overdue, 0)
    return { ready: result.ready, issues: result.issues, asOf: result.asOf, ruleVersion: result.ruleVersion, stars,
      label: overdueTotal > 0 ? readQcShippingPriorityRules().overdueLabel : result.rows.find(row => row.stars === stars)?.label || '正常处理', rows,
      todayTotal: rows.reduce((s, row) => s + row.today, 0), tomorrowTotal: rows.reduce((s, row) => s + row.tomorrow, 0), overdueTotal }
  } catch (error) {
    return { ready: false, issues: [...issues, error instanceof Error ? error.message : String(error)], asOf: new Date(asOf).toISOString(), ruleVersion: readQcShippingPriorityRules().version, stars: 0, label: '需求需核对', rows: [], todayTotal: 0, tomorrowTotal: 0, overdueTotal: 0 }
  }
}
export function getQcShippingPriorityForQc(qc: string | PostFinishingQcTask): QcShippingPriorityDocument | undefined {
  const task = typeof qc === 'string' ? getPostFinishingFullFlowQcTask(qc) : qc
  return task && buildDocument([task])
}
export function getQcShippingPriorityForProduction(no: string): QcShippingPriorityDocument | undefined { return buildDocument(listPostFinishingQcShippingFacts().filter(row=>row.productionOrderNo===no)) }

export function readUnifiedQcShippingStockRows(): StockRealtimeItem[] {
  if (failure) throw new Error(failure)
  const identity = readGarmentReplacementSnapshotForPriority()
  const baseline=finishedInventoryRealtimeRows()
  const source = readSupplies(undefined, identity,baseline)
  inventoryIssues = source.issues
  const existing = new Map<string, StockRealtimeItem>(baseline.map(row => {
    const warehouse = warehouseSeed.find(item => item.name === row.warehouseName)
    return [`${row.warehouseId || warehouse?.code || row.warehouseName}|${row.sku}`, { ...structuredClone(row), warehouse_id:row.warehouseId, warehouse_type: warehouse?.businessType || row.warehouse_type }] as const
  }))
  const sourceSkus = [...POST_FINISHING_PRODUCTION_SOURCE_FIXTURES.flatMap(row => row.skus), ...listPostFinishingQcShippingFacts().flatMap(row => (row.lines||[]).map(line => line.sku))]
  const replacementSkus = identity.records.flatMap(row => row.lines.map(line => line.target))
  for (const stock of source.stocks) {
    const key = `${stock.warehouseId}|${stock.sku}`
    if (baseline.some(row => row.id === stock.id)) continue
    const row = existing.get(key)
    if (row) {
      row.spotStock += stock.quantity
      if ('physicalQuantity' in row && typeof row.physicalQuantity === 'number') row.physicalQuantity += stock.quantity
    }
    else {
      const sku = replacementSkus.find(row => row.skuCode === stock.sku) || sourceSkus.find(row => row.skuCode === stock.sku)
      existing.set(key, { id: stock.id, sku: stock.sku, spu: sku?.spuCode || stock.sku, productName: sku?.spuName || stock.sku, image: sku?.imageUrl || '', warehouse_id: stock.warehouseId, warehouseName: warehouseName(stock.warehouseId), warehouse_type: 'FINISHED', spotStock: stock.quantity, transitStock: 0, pendingShipmentQuantity: 0, preSaleOrderOccupiedQuantity: 0, spotOrderOccupiedQuantity: stock.reservations.reduce((s, r) => s + r.quantity, 0), pendingReturnQualityQuantity: 0, defectiveStock: 0, damagedStock: 0 })
    }
  }
  return [...existing.values()]
}
export function getQcShippingInventoryWarning(): string { return inventoryIssues.length ? `以下显示已核实库存；部分后道去向或数量关系需核对：${[...new Set(inventoryIssues)].slice(0, 3).join('；')}` : '' }
