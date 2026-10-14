import { pmsCoreOperationSignature, assertPmsCoreDraftVersion } from './core-write-contract.ts'
import { PMS_STYLE_IMAGES } from './images.ts'
import { PMS_BUYER_ACTOR, PmsDomainError } from './runtime.ts'
import { PMS_STORES, pmsAll, pmsCommitRecords } from './idb-storage.ts'
import { listPmsCoreDemoProducts, preparePmsProductPurchaseOrders, publishPmsProductPurchaseOrders, type PmsCreatePurchaseOrderInput } from './product-purchase-orders.ts'

/**
 * 备货参考列表(原型 mock,跟随 manage.higood.ai /pms/reorder/index)。
 * 固定演示记录只读；备货修改及生成的商品采购单同事务保存。
 */

export type PmsReorderRestockMark = '已标记' | '未标记'

export interface PmsReorderSuggestion {
  spu: string
  productName: string
  imageUrl: string
  restockCount: number
  restockMarked: PmsReorderRestockMark
  markedAt: string
  purchasingQty: number
  auditQty: number
  stockQty: number
  pendingDeliveryAndPackQty: number
  regularRestockQty: number
  suggestedRestockQty: number
  totalSales: number
  recent3DaySales: number
  recent5DaySales: number
  recent7DaySales: number
  remark: string
  createdPurchaseOrderNos?: string[]
  salesHistory?: Array<{ date: string; qty: number; amount: number }>
  _pmsBaseVersion?: number
}

interface ReorderRuntime {
  suggestions: PmsReorderSuggestion[]
}

function getRuntime(): ReorderRuntime {
  if (!reorderInitialized) {
    reorderInitialized = true
    const catalog = listPmsCoreDemoProducts()
    reorderRuntime.suggestions = reorderRuntime.suggestions.map((row, index) => {
      const product = catalog[index % catalog.length]
      if (!product) return { ...row, imageUrl: '' }
      return { ...row, spu: product.spu, productName: product.productName, imageUrl: product.imageUrl, createdPurchaseOrderNos: [],
        salesHistory: Array.from({ length: 7 }, (_, day) => ({ date: `2026-10-${String(day + 7).padStart(2, '0')}`, qty: Math.floor(row.recent7DaySales / 7) + (day < row.recent7DaySales % 7 ? 1 : 0), amount: Math.round((Math.floor(row.recent7DaySales / 7) + (day < row.recent7DaySales % 7 ? 1 : 0)) * (product.skus[0]?.price ?? 0) * 100) / 100 })) }
    })
  }
  return reorderRuntime
}
let reorderInitialized = false
let reorderHydration: Promise<void> | null = null
export function hydratePmsReorderSuggestionsFromIdb(): Promise<void> {
  if (reorderHydration) return reorderHydration
  reorderHydration = pmsAll<PmsReorderSuggestion>(PMS_STORES.pmsReorderSuggestions)
    .then(publishPmsReorderSuggestions).catch((error: unknown) => { reorderHydration = null; throw error })
  return reorderHydration
}
export function publishPmsReorderSuggestions(rows: PmsReorderSuggestion[]): void {
  const list = getRuntime().suggestions
  for (const row of rows) {
    const index = list.findIndex(item => item.spu === row.spu)
    if (index >= 0) list[index] = row
    else list.unshift(row)
  }
}

const reorderRuntime: ReorderRuntime = {
  suggestions: [
    {
      spu: 'ASYZZ26072909',
      productName: '80-Printed Blouse-39-55印花上衣',
      imageUrl: PMS_STYLE_IMAGES.shirt,
      restockCount: 1,
      restockMarked: '已标记',
      markedAt: '2026-10-08 10:30:00',
      purchasingQty: 1,
      auditQty: 0,
      stockQty: 0,
      pendingDeliveryAndPackQty: 3691,
      regularRestockQty: 0,
      suggestedRestockQty: 0,
      totalSales: 8613,
      recent3DaySales: 417,
      recent5DaySales: 771,
      recent7DaySales: 963,
      remark: '',
    },
    {
      spu: 'CHCXX26080306',
      productName: '49-Classic Top-18-30穆斯林设计上衣',
      imageUrl: PMS_STYLE_IMAGES.shirt,
      restockCount: 1,
      restockMarked: '已标记',
      markedAt: '2026-10-08 10:30:00',
      purchasingQty: 2,
      auditQty: 0,
      stockQty: 0,
      pendingDeliveryAndPackQty: 3915,
      regularRestockQty: 0,
      suggestedRestockQty: 0,
      totalSales: 4002,
      recent3DaySales: 238,
      recent5DaySales: 358,
      recent7DaySales: 560,
      remark: '',
    },
    {
      spu: 'CHCKL26072140',
      productName: '1-Casul Shirt-18-30休闲衬衫',
      imageUrl: PMS_STYLE_IMAGES.shirt,
      restockCount: 5,
      restockMarked: '已标记',
      markedAt: '2026-10-09 09:15:00',
      purchasingQty: 71,
      auditQty: 0,
      stockQty: 0,
      pendingDeliveryAndPackQty: 523,
      regularRestockQty: 0,
      suggestedRestockQty: 0,
      totalSales: 10249,
      recent3DaySales: 228,
      recent5DaySales: 313,
      recent7DaySales: 397,
      remark: '',
    },
    {
      spu: 'CHCMY26062204',
      productName: '48-Casul Shirt-30-45宽松衬衫',
      imageUrl: PMS_STYLE_IMAGES.shirt,
      restockCount: 9,
      restockMarked: '已标记',
      markedAt: '2026-10-09 09:15:00',
      purchasingQty: 4171,
      auditQty: 0,
      stockQty: 0,
      pendingDeliveryAndPackQty: 2467,
      regularRestockQty: 0,
      suggestedRestockQty: 1704,
      totalSales: 9245,
      recent3DaySales: 201,
      recent5DaySales: 275,
      recent7DaySales: 360,
      remark: '',
    },
    {
      spu: 'ASYZZ26033020',
      productName: '76-simple pants-18-35简约裤子',
      imageUrl: PMS_STYLE_IMAGES.pants,
      restockCount: 2,
      restockMarked: '已标记',
      markedAt: '2026-10-08 10:30:00',
      purchasingQty: 36,
      auditQty: 0,
      stockQty: 0,
      pendingDeliveryAndPackQty: 393,
      regularRestockQty: 0,
      suggestedRestockQty: 0,
      totalSales: 2580,
      recent3DaySales: 75,
      recent5DaySales: 123,
      recent7DaySales: 222,
      remark: '',
    },
    {
      spu: 'FADUU26070826',
      productName: '53-print shirt-45-60印花衬衫',
      imageUrl: PMS_STYLE_IMAGES.shirt,
      restockCount: 2,
      restockMarked: '已标记',
      markedAt: '2026-10-09 09:15:00',
      purchasingQty: 107,
      auditQty: 0,
      stockQty: 0,
      pendingDeliveryAndPackQty: 286,
      regularRestockQty: 0,
      suggestedRestockQty: 0,
      totalSales: 1833,
      recent3DaySales: 52,
      recent5DaySales: 78,
      recent7DaySales: 100,
      remark: '',
    },
    {
      spu: 'ASYZC26070302',
      productName: '72-Classic Top-18-35纯色上衣',
      imageUrl: PMS_STYLE_IMAGES.shirt,
      restockCount: 1,
      restockMarked: '已标记',
      markedAt: '2026-10-09 09:15:00',
      purchasingQty: 63,
      auditQty: 0,
      stockQty: 0,
      pendingDeliveryAndPackQty: 40,
      regularRestockQty: 0,
      suggestedRestockQty: 23,
      totalSales: 1525,
      recent3DaySales: 12,
      recent5DaySales: 15,
      recent7DaySales: 21,
      remark: '',
    },
    {
      spu: 'FADUU26061807',
      productName: '140-knitted tops-25-35针织上衣',
      imageUrl: PMS_STYLE_IMAGES.shirt,
      restockCount: 7,
      restockMarked: '已标记',
      markedAt: '2026-10-10 11:00:00',
      purchasingQty: 1955,
      auditQty: 0,
      stockQty: 0,
      pendingDeliveryAndPackQty: 22,
      regularRestockQty: 0,
      suggestedRestockQty: 1933,
      totalSales: 549,
      recent3DaySales: 10,
      recent5DaySales: 21,
      recent7DaySales: 32,
      remark: '',
    },
    {
      spu: 'FADAH25120820',
      productName: '100-Dress-30-45复古连衣裙',
      imageUrl: PMS_STYLE_IMAGES.dress,
      restockCount: 38,
      restockMarked: '已标记',
      markedAt: '2026-10-05 14:20:00',
      purchasingQty: 2793,
      auditQty: 0,
      stockQty: 0,
      pendingDeliveryAndPackQty: 2028,
      regularRestockQty: 0,
      suggestedRestockQty: 765,
      totalSales: 10147,
      recent3DaySales: 765,
      recent5DaySales: 964,
      recent7DaySales: 1119,
      remark: '',
    },
    {
      spu: 'TENQU25093001',
      productName: '10-print shirt-45-60印花衬衫',
      imageUrl: PMS_STYLE_IMAGES.shirt,
      restockCount: 44,
      restockMarked: '已标记',
      markedAt: '2026-10-05 14:20:00',
      purchasingQty: 3,
      auditQty: 0,
      stockQty: 0,
      pendingDeliveryAndPackQty: 9383,
      regularRestockQty: 0,
      suggestedRestockQty: 0,
      totalSales: 13818,
      recent3DaySales: 507,
      recent5DaySales: 821,
      recent7DaySales: 1127,
      remark: '',
    },
    {
      spu: 'FADSS25121719',
      productName: '20-Korean Set-30-45韩系套装',
      imageUrl: PMS_STYLE_IMAGES.dress,
      restockCount: 20,
      restockMarked: '已标记',
      markedAt: '2026-10-06 16:40:00',
      purchasingQty: 1497,
      auditQty: 0,
      stockQty: 0,
      pendingDeliveryAndPackQty: 2687,
      regularRestockQty: 0,
      suggestedRestockQty: 0,
      totalSales: 6780,
      recent3DaySales: 327,
      recent5DaySales: 621,
      recent7DaySales: 888,
      remark: '',
    },
    {
      spu: 'CHCKL25062602',
      productName: '4-Short Sleeve Top-18-35短袖上衣',
      imageUrl: PMS_STYLE_IMAGES.shirt,
      restockCount: 30,
      restockMarked: '已标记',
      markedAt: '2026-10-04 09:50:00',
      purchasingQty: 1217,
      auditQty: 0,
      stockQty: 0,
      pendingDeliveryAndPackQty: 605,
      regularRestockQty: 0,
      suggestedRestockQty: 612,
      totalSales: 5422,
      recent3DaySales: 102,
      recent5DaySales: 129,
      recent7DaySales: 157,
      remark: '',
    },
  ],
}

export function listPmsReorderSuggestions(): PmsReorderSuggestion[] {
  return getRuntime().suggestions.slice()
}

export function getPmsReorderSuggestion(spu: string): PmsReorderSuggestion | undefined {
  return getRuntime().suggestions.find((s) => s.spu === spu)
}

export interface PmsReorderFilter {
  spu?: string
  restockMarked?: '' | PmsReorderRestockMark
  recent3DaySalesAtLeast?: number
  recent5DaySalesAtLeast?: number
  stockQtyAtMost?: number
  sortBy?: 'restockCount' | 'recent3DaySales' | 'recent7DaySales' | 'totalSales'
  markedFrom?: string
  markedTo?: string
  remark?: string
}

export function filterPmsReorderSuggestions(filter: PmsReorderFilter): PmsReorderSuggestion[] {
  const all = listPmsReorderSuggestions()
  const result = all.filter((row) => {
    if (filter.spu && !row.spu.toLowerCase().includes(filter.spu.toLowerCase())) return false
    if (filter.restockMarked && row.restockMarked !== filter.restockMarked) return false
    if (filter.markedFrom && row.markedAt.slice(0, 10) < filter.markedFrom) return false
    if (filter.markedTo && row.markedAt.slice(0, 10) > filter.markedTo) return false
    if (filter.remark && !row.remark.toLowerCase().includes(filter.remark.toLowerCase())) return false
    if (filter.recent3DaySalesAtLeast !== undefined && row.recent3DaySales < filter.recent3DaySalesAtLeast) return false
    if (filter.recent5DaySalesAtLeast !== undefined && row.recent5DaySales < filter.recent5DaySalesAtLeast) return false
    if (filter.stockQtyAtMost !== undefined && row.stockQty > filter.stockQtyAtMost) return false
    return true
  })
  if (filter.sortBy) {
    const key = filter.sortBy
    result.sort((a, b) => b[key] - a[key])
  }
  return result
}

export function totalPmsReorderRestockQty(): number {
  return listPmsReorderSuggestions().reduce((sum, row) => sum + row.regularRestockQty, 0)
}

export async function updatePmsReorderMark(spu: string, mark: PmsReorderRestockMark, operationId = `reorder-mark-${crypto.randomUUID()}`): Promise<PmsReorderSuggestion> {
  await hydratePmsReorderSuggestionsFromIdb()
  const row = getPmsReorderSuggestion(spu)
  if (!row) throw new PmsDomainError('PMS_REORDER_NOT_FOUND', `备货参考 ${spu} 不存在`)
  const next = structuredClone(row)
  next.restockMarked = mark
  next.markedAt = mark === '已标记' ? new Date().toISOString() : ''
  await pmsCommitRecords([{ store: PMS_STORES.pmsReorderSuggestions, value: next }], { operationId, operationSignature:pmsCoreOperationSignature('标记备货',{spu,mark}), log: { objectType: 'reorder-suggestion', objectId: spu, action: mark === '已标记' ? '标记备货' : '取消标记', beforeValue: row.restockMarked, afterValue: mark, reason: '', actorId: PMS_BUYER_ACTOR.id, actorName: PMS_BUYER_ACTOR.name, actorRole: PMS_BUYER_ACTOR.role, secondConfirmation: mark === '未标记' } })
  publishPmsReorderSuggestions([next])
  return next
}

export async function updatePmsReorderRegularQty(spu: string, regularQty: number, operationId = `reorder-qty-${crypto.randomUUID()}`): Promise<PmsReorderSuggestion> {
  await hydratePmsReorderSuggestionsFromIdb()
  if (!Number.isInteger(regularQty) || regularQty < 0) {
    throw new PmsDomainError('PMS_REORDER_INVALID_QTY', `常备数量 ${regularQty} 不合法`)
  }
  const row = getPmsReorderSuggestion(spu)
  if (!row) throw new PmsDomainError('PMS_REORDER_NOT_FOUND', `备货参考 ${spu} 不存在`)
  const next = { ...row, regularRestockQty: regularQty }
  await pmsCommitRecords([{ store: PMS_STORES.pmsReorderSuggestions, value: next }], { operationId, operationSignature:pmsCoreOperationSignature('设置常备数量',{spu,regularQty}), log: { objectType: 'reorder-suggestion', objectId: spu, action: '设置常备数量', beforeValue: String(row.regularRestockQty), afterValue: String(regularQty), reason: '', actorId: PMS_BUYER_ACTOR.id, actorName: PMS_BUYER_ACTOR.name, actorRole: PMS_BUYER_ACTOR.role } })
  publishPmsReorderSuggestions([next])
  return next
}

export async function updatePmsReorderRemark(spu: string, remark: string, operationId: string): Promise<void> {
  await hydratePmsReorderSuggestionsFromIdb()
  const old = getPmsReorderSuggestion(spu)
  if (!old) throw new PmsDomainError('PMS_REORDER_NOT_FOUND', '备货款不存在')
  const next = { ...old, remark: remark.trim() }
  await pmsCommitRecords([{ store: PMS_STORES.pmsReorderSuggestions, value: next }], { operationId, operationSignature:pmsCoreOperationSignature('备注',{spu,remark}), log: { objectType: 'reorder-suggestion', objectId: spu, action: '备注', beforeValue: old.remark, afterValue: next.remark, reason: '', actorId: PMS_BUYER_ACTOR.id, actorName: PMS_BUYER_ACTOR.name, actorRole: PMS_BUYER_ACTOR.role } })
  publishPmsReorderSuggestions([next])
}

export async function createPmsReorderSuggestion(spu: string, regularRestockQty: number, remark: string, operationId: string): Promise<PmsReorderSuggestion> {
  await hydratePmsReorderSuggestionsFromIdb()
  if (getPmsReorderSuggestion(spu)) throw new PmsDomainError('PMS_REORDER_DUPLICATE', '此款已在备货列表，请修改原记录')
  const product = listPmsCoreDemoProducts().find(item => item.spu === spu)
  if (!product) throw new PmsDomainError('PMS_REORDER_PRODUCT', '请选择有有效SKU与对应图片的商品')
  if (!Number.isInteger(regularRestockQty) || regularRestockQty < 0) throw new PmsDomainError('PMS_REORDER_QTY', '常备数量必须是非负整数')
  const row: PmsReorderSuggestion = { spu, productName: product.productName, imageUrl: product.imageUrl, restockCount: 0, restockMarked: '已标记', markedAt: new Date().toISOString(), purchasingQty: 0, auditQty: 0, stockQty: 0, pendingDeliveryAndPackQty: 0, regularRestockQty, suggestedRestockQty: regularRestockQty, totalSales: 0, recent3DaySales: 0, recent5DaySales: 0, recent7DaySales: 0, remark: remark.trim(), createdPurchaseOrderNos: [], salesHistory: [], _pmsBaseVersion: 0 }
  await pmsCommitRecords([{ store: PMS_STORES.pmsReorderSuggestions, value: row }], { operationId, operationSignature:pmsCoreOperationSignature('新增备货款',{spu,regularRestockQty,remark}) })
  publishPmsReorderSuggestions([row])
  return row
}

export interface PmsReorderActInput {
  spu: string
  actorName?: string
  remark?: string
  supplierName?: string
  warehouse?: string
  operationId?: string
  lines?: Array<{ sku: string; qty: number; price: number }>
}

export async function actPmsReorder(input: PmsReorderActInput): Promise<PmsReorderSuggestion> {
  await hydratePmsReorderSuggestionsFromIdb()
  const row = getPmsReorderSuggestion(input.spu)
  if (!row) throw new PmsDomainError('PMS_REORDER_NOT_FOUND', `备货参考 ${input.spu} 不存在`)
  if (row.restockMarked !== '已标记') {
    throw new PmsDomainError('PMS_REORDER_NOT_MARKED', `备货参考 ${input.spu} 未标记`)
  }
  const product = listPmsCoreDemoProducts().find(item => item.spu === input.spu)
  if (!product) throw new PmsDomainError('PMS_REORDER_SKU_REQUIRED', '此款没有当前有效SKU，请先完善商品档案')
  const operationId = input.operationId ?? `reorder-${crypto.randomUUID()}`
  const lines = (input.lines ?? []).filter(line => line.qty > 0).map(line => {
    const sku = product.skus.find(item => item.sku === line.sku)
    if (!sku) throw new PmsDomainError('PMS_REORDER_SKU_REQUIRED', '备货SKU不属于当前商品')
    return { sku: sku.sku, color: sku.color, size: sku.size, qty: line.qty, standardPrice: sku.price, actualPrice: line.price, weight: sku.weight }
  })
  if (!lines.length) throw new PmsDomainError('PMS_REORDER_QTY_REQUIRED', '请先分配备货数量')
  const orderInput: PmsCreatePurchaseOrderInput = { spu: product.spu, productName: product.productName, imageUrl: product.imageUrl, purchaseType: '成衣', area: '国内', supplierName: input.supplierName ?? '', warehouse: input.warehouse ?? '', purchaser: input.actorName ?? PMS_BUYER_ACTOR.name, expectedDeliveryDate: '', remark: input.remark ?? row.remark, lines }
  const orders = preparePmsProductPurchaseOrders([orderInput], PMS_BUYER_ACTOR, operationId)
  orders[0].sourceReorderSpu = row.spu
  const next = structuredClone(row)
  next.purchasingQty += lines.reduce((sum, line) => sum + line.qty, 0)
  next.restockCount += 1
  next.remark = input.remark ?? next.remark
  next.createdPurchaseOrderNos = [...new Set([...(next.createdPurchaseOrderNos ?? []), orders[0].purchaseOrderNo])]
  await pmsCommitRecords([{ store: PMS_STORES.pmsReorderSuggestions, value: next }, ...orders.map(value => ({ store: PMS_STORES.pmsProductPurchaseOrders, value }))], { operationId, operationSignature:pmsCoreOperationSignature('生成备货采购单',orderInput), log: { objectType: 'reorder-suggestion', objectId: row.spu, action: '生成备货采购单', beforeValue: String(row.purchasingQty), afterValue: String(next.purchasingQty), reason: next.remark, actorId: PMS_BUYER_ACTOR.id, actorName: PMS_BUYER_ACTOR.name, actorRole: PMS_BUYER_ACTOR.role, relatedPurchaseOrderNo: orders[0].purchaseOrderNo } })
  publishPmsReorderSuggestions([next])
  publishPmsProductPurchaseOrders(orders)
  return next
}
