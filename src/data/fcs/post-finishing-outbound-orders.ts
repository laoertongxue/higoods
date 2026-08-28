import {
  resolveEffectiveGarmentIdentity,
  type GarmentReplacementIdentity,
} from './garment-spu-replacement.ts'
import type {
  PostFinishingRecheckOrder,
  PostFinishingSkuLine,
} from './post-finishing-domain.ts'

export type PostFinishingOutboundOrderStatus = '待确认' | '已确认'

export interface PostFinishingOutboundOrderLine {
  outboundLineId: string
  skuLineId: string
  itemType: '成品'
  spuCode: string
  spuName: string
  skuId: string
  skuCode: string
  originalSpuCode?: string
  originalSkuCode?: string
  colorName: string
  sizeName: string
  skuImageUrl?: string
  plannedQty: number
  inboundQty: number
  qtyUnit: string
}

export interface PostFinishingOutboundOrder {
  outboundOrderId: string
  outboundOrderNo: string
  status: PostFinishingOutboundOrderStatus
  managedPostFactoryId: string
  managedPostFactoryName: string
  sourceActionLabel: '复检完成 → 后道待交出仓'
  sourceWarehouseName: string
  targetWarehouseName: string
  productionOrderNo: string
  taskNo: string
  postOrderId?: string
  postOrderNo?: string
  qcOrderId: string
  qcOrderNo: string
  recheckOrderId: string
  recheckOrderNo: string
  sourceObjectLabel: string
  outboundQty: number
  inboundQty: number
  qtyUnit: string
  createdAt: string
  updatedAt: string
  operatorName: string
  lines: PostFinishingOutboundOrderLine[]
}

export interface UpsertPostFinishingOutboundOrderOptions {
  status?: PostFinishingOutboundOrderStatus
  inboundAsConfirmed?: boolean
}

const OUTBOUND_STORAGE_KEY = 'higood-fcs-post-finishing-outbound-orders-v1'

function readPersistedOutboundOrders(): PostFinishingOutboundOrder[] {
  try {
    const raw = globalThis.localStorage?.getItem(OUTBOUND_STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is PostFinishingOutboundOrder => Boolean(
      item
      && typeof item === 'object'
      && typeof (item as PostFinishingOutboundOrder).outboundOrderId === 'string'
      && typeof (item as PostFinishingOutboundOrder).recheckOrderId === 'string'
      && Array.isArray((item as PostFinishingOutboundOrder).lines),
    ))
  } catch {
    return []
  }
}

function persistOutboundOrders(): void {
  try {
    globalThis.localStorage?.setItem(OUTBOUND_STORAGE_KEY, JSON.stringify(outboundOrders))
  } catch {
    // 原型环境无 localStorage 时保留当前页内存态。
  }
}

let outboundOrders: PostFinishingOutboundOrder[] = readPersistedOutboundOrders()

function cloneOrder(order: PostFinishingOutboundOrder): PostFinishingOutboundOrder {
  return {
    ...order,
    lines: order.lines.map((line) => ({ ...line })),
  }
}

function factoryKey(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-|-$/g, '') || 'post-factory'
}

function orderNoFromRecheck(recheck: PostFinishingRecheckOrder): string {
  const sequence = Number(recheck.recheckOrderId.match(/(\d+)$/)?.[1] || 0)
  return `FCK${String(9900 + sequence).padStart(4, '0')}`
}

function qualifiedQty(recheck: PostFinishingRecheckOrder, line: PostFinishingSkuLine): number {
  const result = recheck.recheckSkuResults.find((item) => item.skuLineId === line.skuLineId || item.skuId === line.skuId)
  return Math.max(0, Math.min(line.plannedQty, result?.qualifiedQty ?? 0))
}

function buildStoredLine(
  recheck: PostFinishingRecheckOrder,
  line: PostFinishingSkuLine,
  inboundAsConfirmed: boolean,
): PostFinishingOutboundOrderLine | null {
  const plannedQty = qualifiedQty(recheck, line)
  if (plannedQty <= 0) return null
  return {
    outboundLineId: `${recheck.recheckOrderId}-OUT-${line.skuLineId}`,
    skuLineId: line.skuLineId,
    itemType: '成品',
    spuCode: recheck.spuCode,
    spuName: recheck.spuName,
    skuId: line.skuId,
    skuCode: line.skuCode,
    colorName: line.colorName,
    sizeName: line.sizeName,
    skuImageUrl: line.skuImageUrl,
    plannedQty,
    inboundQty: inboundAsConfirmed ? plannedQty : 0,
    qtyUnit: line.qtyUnit,
  }
}

function projectIdentity(
  productionOrderNo: string,
  line: PostFinishingOutboundOrderLine,
): PostFinishingOutboundOrderLine {
  const effective: GarmentReplacementIdentity | null = resolveEffectiveGarmentIdentity({
    productionOrderId: productionOrderNo,
    color: line.colorName,
    size: line.sizeName,
    stage: 'POST_FACTORY',
  })
  if (!effective || effective.skuCode === line.skuCode) return { ...line }
  return {
    ...line,
    originalSpuCode: line.originalSpuCode || line.spuCode,
    originalSkuCode: line.originalSkuCode || line.skuCode,
    spuCode: effective.spuCode,
    spuName: effective.spuName,
    skuId: effective.skuCode,
    skuCode: effective.skuCode,
    colorName: effective.color,
    sizeName: effective.size,
    skuImageUrl: effective.imageUrl,
  }
}

function projectOrder(order: PostFinishingOutboundOrder): PostFinishingOutboundOrder {
  const lines = order.lines.map((line) => projectIdentity(order.productionOrderNo, line))
  return {
    ...order,
    lines,
    outboundQty: lines.reduce((sum, line) => sum + line.plannedQty, 0),
    inboundQty: lines.reduce((sum, line) => sum + line.inboundQty, 0),
  }
}

export function upsertPostFinishingOutboundOrderFromRecheck(
  recheck: PostFinishingRecheckOrder,
  options: UpsertPostFinishingOutboundOrderOptions = {},
): PostFinishingOutboundOrder {
  if (recheck.recheckStatus !== '复检完成') {
    throw new Error(`复检单 ${recheck.recheckOrderNo} 尚未完成，不能生成后道出货单。`)
  }
  const existingIndex = outboundOrders.findIndex((item) => item.recheckOrderId === recheck.recheckOrderId)
  const existing = existingIndex >= 0 ? outboundOrders[existingIndex] : undefined
  const status = existing?.status || options.status || '待确认'
  const inboundAsConfirmed = options.inboundAsConfirmed ?? status === '已确认'
  const lines = recheck.skuLines
    .map((line) => buildStoredLine(recheck, line, inboundAsConfirmed))
    .filter((line): line is PostFinishingOutboundOrderLine => Boolean(line))
  const outboundQty = lines.reduce((sum, line) => sum + line.plannedQty, 0)
  const inboundQty = lines.reduce((sum, line) => sum + line.inboundQty, 0)
  const outboundOrderNo = existing?.outboundOrderNo || orderNoFromRecheck(recheck)
  const order: PostFinishingOutboundOrder = {
    outboundOrderId: existing?.outboundOrderId || `PF-OUT-${recheck.recheckOrderId}`,
    outboundOrderNo,
    status,
    managedPostFactoryId: existing?.managedPostFactoryId || `factory-${factoryKey(recheck.managedPostFactoryName)}`,
    managedPostFactoryName: recheck.managedPostFactoryName,
    sourceActionLabel: '复检完成 → 后道待交出仓',
    sourceWarehouseName: `${recheck.managedPostFactoryName}-后道待加工仓`,
    targetWarehouseName: `${recheck.managedPostFactoryName}-后道待交出仓`,
    productionOrderNo: recheck.productionOrderNo,
    taskNo: recheck.postTaskNo || recheck.sourceTaskNo,
    postOrderId: recheck.postOrderId,
    postOrderNo: recheck.postOrderNo,
    qcOrderId: recheck.qcOrderId,
    qcOrderNo: recheck.qcOrderNo,
    recheckOrderId: recheck.recheckOrderId,
    recheckOrderNo: recheck.recheckOrderNo,
    sourceObjectLabel: `复检单 · ${recheck.recheckOrderNo}`,
    outboundQty,
    inboundQty,
    qtyUnit: lines[0]?.qtyUnit || '件',
    createdAt: existing?.createdAt || recheck.recheckedAt || recheck.updatedAt,
    updatedAt: recheck.updatedAt,
    operatorName: recheck.recheckerName || '复检员',
    lines,
  }
  if (existingIndex >= 0) outboundOrders[existingIndex] = order
  else outboundOrders.push(order)
  persistOutboundOrders()
  return cloneOrder(projectOrder(order))
}

export function seedPostFinishingOutboundOrders(rechecks: PostFinishingRecheckOrder[]): void {
  rechecks
    .filter((recheck) => recheck.recheckStatus === '复检完成')
    .forEach((recheck, index) => upsertPostFinishingOutboundOrderFromRecheck(recheck, {
      status: index % 2 === 0 ? '已确认' : '待确认',
      inboundAsConfirmed: index % 2 === 0,
    }))
}

export function listPostFinishingOutboundOrders(): PostFinishingOutboundOrder[] {
  return outboundOrders
    .map((order) => cloneOrder(projectOrder(order)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function getPostFinishingOutboundOrderById(id: string): PostFinishingOutboundOrder | null {
  return listPostFinishingOutboundOrders().find((order) => order.outboundOrderId === id || order.outboundOrderNo === id) || null
}

export function getPostFinishingOutboundOrderByRecheckId(recheckOrderId: string): PostFinishingOutboundOrder | null {
  return listPostFinishingOutboundOrders().find((order) => order.recheckOrderId === recheckOrderId) || null
}
