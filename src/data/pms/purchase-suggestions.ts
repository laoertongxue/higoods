import { hydratePmsKolStock, preparePmsKolStockReceipt, publishPmsKolStock } from './kol-sample-stock.ts'
import { pmsCoreOperationSignature, assertPmsCoreDraftVersion, pmsCoreStableCode } from './core-write-contract.ts'
import { PMS_STYLE_IMAGES } from './images.ts'
import { PMS_STORES, pmsAll, pmsCommitRecords } from './idb-storage.ts'
import { listPmsCoreDemoProducts, preparePmsProductPurchaseOrders, publishPmsProductPurchaseOrders, type PmsCreatePurchaseOrderInput, type PmsProductPurchaseOrder } from './product-purchase-orders.ts'
import { listPmsLogs, PmsDomainError, type PmsOperationLog, type PmsActorRole } from './runtime.ts'

/**
 * 采购建议 + KOL 需求 IDB hydrate 状态机(同其他 PMS 模块模式)。
 */
let suggestionHydrationPromise: Promise<void> | null = null

export function hydratePmsPurchaseSuggestionsFromIdb(): Promise<void> {
  if (suggestionHydrationPromise) return suggestionHydrationPromise
  suggestionHydrationPromise = (async () => {
      const [storedSuggestions, storedDemands] = await Promise.all([
        pmsAll<PmsPurchaseSuggestion>(PMS_STORES.pmsPurchaseSuggestions),
        pmsAll<PmsKolDemand>(PMS_STORES.pmsKolDemands),
      ])
      const rt = getRuntime()
      for (const saved of storedSuggestions) {
        const existing = rt.suggestions.find((s) => s.suggestionNo === saved.suggestionNo)
        if (existing) Object.assign(existing, saved)
        else rt.suggestions.push(saved)
      }
      for (const saved of storedDemands) {
        const existing = rt.kolDemands.find((d) => d.demandNo === saved.demandNo)
        if (existing) Object.assign(existing, saved)
        else rt.kolDemands.push(saved)
      }
  })().catch((error: unknown) => { suggestionHydrationPromise = null; throw error })
  return suggestionHydrationPromise
}

export type PmsSuggestionStatus = '待生成' | '部分生成' | '已生成' | '无需采购'
export type PmsDemandLevel = '爆款' | '热销' | '常规'
export type PmsPurchaseType = '做货' | '成衣' | '样衣'
export type PmsKolDemandStatus = '草稿' | '待审核' | '待入库' | '部分入库' | '全部入库' | '已驳回' | '强制完成'

export interface PmsSuggestionSku {
  imageUrl?: string
  sku: string
  color: string
  size: string
  pendingDeliveryQty: number
  stockQty: number
  purchasingQty: number
  transitQty: number
  convertedQty: number
}

export interface PmsPurchaseSuggestion {
  suggestionNo: string
  spu: string
  productName: string
  imageUrl: string
  area: '国内' | '印尼'
  purchaseType: PmsPurchaseType
  needProduction: boolean
  firstOrder: boolean
  demandLevel: PmsDemandLevel
  status: PmsSuggestionStatus
  skuItems: PmsSuggestionSku[]
  convertedOrderNos: string[]
  creator: string
  createdAt: string
  updatedAt: string
  // § 2.4.3.6 乐观锁
  _pmsBaseVersion?: number
}

export interface PmsSuggestionSkuView extends PmsSuggestionSku {
  kolApplyQty: number
  gapQty: number
  discount: number
  suggestedQty: number
  availableQty: number
  needBom: boolean
}

export interface PmsSuggestionView extends Omit<PmsPurchaseSuggestion, 'skuItems'> {
  skuItems: PmsSuggestionSkuView[]
  totalPendingDeliveryQty: number
  totalKolApplyQty: number
  totalPurchasingQty: number
  totalStockQty: number
  totalSuggestedQty: number
  totalAvailableQty: number
}

export interface PmsKolInboundRecord {
  recordNo: string
  qty: number
  note: string
  actorName: string
  occurredAt: string
}

export interface PmsKolDemand {
  demandNo: string
  sku: string
  spu: string
  productName: string
  imageUrl: string
  color: string
  size: string
  applyQty: number
  inboundQty: number
  status: PmsKolDemandStatus
  applicant: string
  appliedAt: string
  remark: string
  rejectReason: string
  inboundRecords: PmsKolInboundRecord[]
  shop?: string
  position?: string
  canSellHot?: boolean
  linkedPurchaseOrderNos?: string[]
  operationHistory?: Array<{operationId:string;action:string;actorName:string;occurredAt:string;remark:string}>
  skuLines?: Array<{ sku: string; color: string; size: string; imageUrl: string; applyQty: number; inboundQty: number; remark: string }>
  // § 2.4.3.6 乐观锁
  _pmsBaseVersion?: number
}

const DEMAND_LEVEL_DISCOUNT: Record<PmsDemandLevel, number> = {
  爆款: 0.7,
  热销: 0.6,
  常规: 1,
}

interface SuggestionRuntime {
  suggestions: PmsPurchaseSuggestion[]
  kolDemands: PmsKolDemand[]
}

function buildSku(
  sku: string,
  color: string,
  size: string,
  pendingDeliveryQty: number,
  stockQty: number,
  purchasingQty: number,
  transitQty: number,
): PmsSuggestionSku {
  return { sku, color, size, pendingDeliveryQty, stockQty, purchasingQty, transitQty, convertedQty: 0 }
}

function buildInitialRuntime(): SuggestionRuntime {
  return {
    suggestions: [
      {
        suggestionNo: 'PSG-2026-0001',
        spu: 'HG-TS-2601',
        productName: '男款圆领T恤',
        imageUrl: PMS_STYLE_IMAGES.tshirt,
        area: '印尼',
        purchaseType: '做货',
        needProduction: true,
        firstOrder: false,
        demandLevel: '爆款',
        status: '待生成',
        skuItems: [
          buildSku('HG-TS-2601-WH-M', '白色', 'M', 4200, 1800, 1200, 600),
          buildSku('HG-TS-2601-WH-L', '白色', 'L', 4600, 2100, 1400, 800),
          buildSku('HG-TS-2601-BK-M', '黑色', 'M', 3900, 1600, 1100, 500),
          buildSku('HG-TS-2601-BK-L', '黑色', 'L', 3300, 1500, 900, 400),
        ],
        convertedOrderNos: [],
        creator: '系统计算',
        createdAt: '2026-06-02 08:40',
        updatedAt: '2026-06-06 09:30',
      },
      {
        suggestionNo: 'PSG-2026-0002',
        spu: 'HG-PT-2602',
        productName: '女款休闲裤',
        imageUrl: PMS_STYLE_IMAGES.pants,
        area: '印尼',
        purchaseType: '做货',
        needProduction: true,
        firstOrder: false,
        demandLevel: '热销',
        status: '待生成',
        skuItems: [
          buildSku('HG-PT-2602-BK-S', '黑色', 'S', 2600, 900, 700, 300),
          buildSku('HG-PT-2602-BK-M', '黑色', 'M', 3400, 1200, 800, 400),
          buildSku('HG-PT-2602-BK-L', '黑色', 'L', 2500, 800, 600, 300),
        ],
        convertedOrderNos: [],
        creator: '系统计算',
        createdAt: '2026-06-02 08:45',
        updatedAt: '2026-06-06 09:30',
      },
      {
        suggestionNo: 'PSG-2026-0003',
        spu: 'HG-HD-2603',
        productName: '连帽卫衣',
        imageUrl: PMS_STYLE_IMAGES.hoodie,
        area: '印尼',
        purchaseType: '做货',
        needProduction: true,
        firstOrder: false,
        demandLevel: '常规',
        status: '待生成',
        skuItems: [
          buildSku('HG-HD-2603-GY-M', '灰色', 'M', 1900, 600, 400, 200),
          buildSku('HG-HD-2603-GY-L', '灰色', 'L', 2200, 700, 500, 300),
          buildSku('HG-HD-2603-NV-M', '藏青', 'M', 1600, 500, 300, 200),
          buildSku('HG-HD-2603-NV-L', '藏青', 'L', 1600, 550, 350, 200),
        ],
        convertedOrderNos: [],
        creator: '系统计算',
        createdAt: '2026-06-02 09:00',
        updatedAt: '2026-06-06 09:30',
      },
      {
        suggestionNo: 'PSG-2026-0004',
        spu: 'HG-JK-2605',
        productName: '轻薄夹克',
        imageUrl: PMS_STYLE_IMAGES.jacket,
        area: '国内',
        purchaseType: '做货',
        needProduction: true,
        firstOrder: false,
        demandLevel: '常规',
        status: '待生成',
        skuItems: [
          buildSku('HG-JK-2605-KH-M', '卡其', 'M', 1400, 400, 300, 100),
          buildSku('HG-JK-2605-KH-L', '卡其', 'L', 1300, 420, 280, 100),
          buildSku('HG-JK-2605-BK-L', '黑色', 'L', 1200, 380, 260, 100),
        ],
        convertedOrderNos: [],
        creator: '系统计算',
        createdAt: '2026-06-02 09:20',
        updatedAt: '2026-06-06 09:30',
      },
      {
        suggestionNo: 'PSG-2026-0005',
        spu: 'HG-SH-2607',
        productName: '商务衬衫',
        imageUrl: PMS_STYLE_IMAGES.shirt,
        area: '印尼',
        purchaseType: '做货',
        needProduction: true,
        firstOrder: true,
        demandLevel: '常规',
        status: '待生成',
        skuItems: [
          buildSku('HG-SH-2607-WH-M', '白色', 'M', 1200, 500, 200, 100),
          buildSku('HG-SH-2607-WH-L', '白色', 'L', 1100, 450, 200, 100),
        ],
        convertedOrderNos: [],
        creator: '系统计算',
        createdAt: '2026-06-02 09:30',
        updatedAt: '2026-06-06 09:30',
      },
      {
        suggestionNo: 'PSG-2026-0006',
        spu: 'HG-GAR-2601',
        productName: '女款休闲裤成衣',
        imageUrl: PMS_STYLE_IMAGES.pants,
        area: '印尼',
        purchaseType: '成衣',
        needProduction: false,
        firstOrder: true,
        demandLevel: '常规',
        status: '待生成',
        skuItems: [buildSku('HG-GAR-2601-BK-M', '黑色', 'M', 1200, 100, 100, 100)],
        convertedOrderNos: [],
        creator: '系统计算',
        createdAt: '2026-06-02 10:00',
        updatedAt: '2026-06-06 09:40',
      },
      {
        suggestionNo: 'PSG-2026-0007',
        spu: 'HG-SAM-2601',
        productName: '男款圆领T恤样衣',
        imageUrl: PMS_STYLE_IMAGES.tshirt,
        area: '国内',
        purchaseType: '样衣',
        needProduction: false,
        firstOrder: true,
        demandLevel: '常规',
        status: '待生成',
        skuItems: [buildSku('HG-SAM-2601-WH-M', '白色', 'M', 60, 0, 0, 0)],
        convertedOrderNos: [],
        creator: '系统计算',
        createdAt: '2026-06-02 11:00',
        updatedAt: '2026-06-06 09:45',
      },
      {
        suggestionNo: 'PSG-2026-0008',
        spu: 'HG-SK-2604',
        productName: '女款连衣裙',
        imageUrl: PMS_STYLE_IMAGES.dress,
        area: '印尼',
        purchaseType: '做货',
        needProduction: true,
        firstOrder: false,
        demandLevel: '常规',
        status: '待生成',
        skuItems: [
          buildSku('HG-SK-2604-NV-M', '藏青', 'M', 900, 1400, 600, 600),
          buildSku('HG-SK-2604-NV-L', '藏青', 'L', 800, 1400, 600, 400),
        ],
        convertedOrderNos: [],
        creator: '系统计算',
        createdAt: '2026-06-02 13:00',
        updatedAt: '2026-06-06 09:50',
      },
    ],
    kolDemands: [
      {
        demandNo: 'KOL-2026-0001',
        sku: 'HG-TS-2601-WH-M',
        spu: 'HG-TS-2601',
        productName: '男款圆领T恤',
        imageUrl: PMS_STYLE_IMAGES.tshirt,
        color: '白色',
        size: 'M',
        applyQty: 600,
        inboundQty: 0,
        status: '待入库',
        applicant: '直播运营-林晓',
        appliedAt: '2026-06-03 10:20',
        remark: '6·18 直播间测款加单',
        rejectReason: '',
        inboundRecords: [],
      },
      {
        demandNo: 'KOL-2026-0002',
        sku: 'HG-TS-2601-WH-L',
        spu: 'HG-TS-2601',
        productName: '男款圆领T恤',
        imageUrl: PMS_STYLE_IMAGES.tshirt,
        color: '白色',
        size: 'L',
        applyQty: 400,
        inboundQty: 150,
        status: '部分入库',
        applicant: '直播运营-林晓',
        appliedAt: '2026-06-03 10:25',
        remark: '第一批先到 150 件',
        rejectReason: '',
        inboundRecords: [
          { recordNo: 'KOLIN-2026-0001', qty: 150, note: '首批发货', actorName: '王采购', occurredAt: '2026-06-05 14:20' },
        ],
      },
      {
        demandNo: 'KOL-2026-0003',
        sku: 'HG-PT-2602-BK-M',
        spu: 'HG-PT-2602',
        productName: '女款休闲裤',
        imageUrl: PMS_STYLE_IMAGES.pants,
        color: '黑色',
        size: 'M',
        applyQty: 300,
        inboundQty: 300,
        status: '全部入库',
        applicant: '短视频运营-赵敏',
        appliedAt: '2026-06-01 15:00',
        remark: '',
        rejectReason: '',
        inboundRecords: [
          { recordNo: 'KOLIN-2026-0002', qty: 300, note: '一次到齐', actorName: '王采购', occurredAt: '2026-06-04 11:00' },
        ],
      },
      {
        demandNo: 'KOL-2026-0004',
        sku: 'HG-HD-2603-GY-M',
        spu: 'HG-HD-2603',
        productName: '连帽卫衣',
        imageUrl: PMS_STYLE_IMAGES.hoodie,
        color: '灰色',
        size: 'M',
        applyQty: 200,
        inboundQty: 0,
        status: '草稿',
        applicant: '直播运营-林晓',
        appliedAt: '2026-06-06 09:10',
        remark: '等待确认播出档期',
        rejectReason: '',
        inboundRecords: [],
      },
      {
        demandNo: 'KOL-2026-0005',
        sku: 'HG-JK-2605-KH-M',
        spu: 'HG-JK-2605',
        productName: '轻薄夹克',
        imageUrl: PMS_STYLE_IMAGES.jacket,
        color: '卡其',
        size: 'M',
        applyQty: 150,
        inboundQty: 0,
        status: '已驳回',
        applicant: '短视频运营-赵敏',
        appliedAt: '2026-05-28 16:40',
        remark: '',
        rejectReason: '该款夹克本季不再追加，改推轻薄风衣',
        inboundRecords: [],
      },
      {
        demandNo: 'KOL-2026-0006',
        sku: 'HG-SK-2604-NV-M',
        spu: 'HG-SK-2604',
        productName: '女款连衣裙',
        imageUrl: PMS_STYLE_IMAGES.dress,
        color: '藏青',
        size: 'M',
        applyQty: 260,
        inboundQty: 100,
        status: '部分入库',
        applicant: '直播运营-孙倩',
        appliedAt: '2026-06-02 17:30',
        remark: '直播间返场',
        rejectReason: '',
        inboundRecords: [
          { recordNo: 'KOLIN-2026-0003', qty: 100, note: '返场首单', actorName: '王采购', occurredAt: '2026-06-05 16:40' },
        ],
      },
    ],
  }
}

let runtime: SuggestionRuntime | null = null

function getRuntime(): SuggestionRuntime {
  if (!runtime) {
    runtime = buildInitialRuntime()
    const catalog = listPmsCoreDemoProducts()
    runtime.suggestions = runtime.suggestions.map((row, index) => {
      const product = catalog[index % Math.min(catalog.length, 8)]
      if (!product) return row
      return { ...row, spu: product.spu, productName: product.productName, imageUrl: product.imageUrl,
        skuItems: product.skus.slice(0, Math.max(2, row.skuItems.length)).map((sku, skuIndex) => ({
          ...row.skuItems[skuIndex % row.skuItems.length], sku: sku.sku, color: sku.color, size: sku.size, imageUrl: sku.imageUrl,
        })) }
    })
    runtime.kolDemands = runtime.kolDemands.map((row, index) => {
      const product = catalog[index % Math.min(catalog.length, 8)]
      const sku = product?.skus[0]
      return !product || !sku ? row : { ...row, spu: product.spu, productName: product.productName, imageUrl: sku.imageUrl, sku: sku.sku, color: sku.color, size: sku.size, shop: index % 2 ? '直播店铺' : '品牌店铺', position: index % 2 ? '测新' : '主推' }
    })
  }
  return runtime
}

export function activeKolQtyBySku(demands = getRuntime().kolDemands): Map<string, number> {
  const quantities = new Map<string, number>()
  demands
    .filter((demand) => !['草稿', '待审核', '已驳回'].includes(demand.status))
    .forEach((demand) => {
      for (const line of demand.skuLines ?? [{ sku: demand.sku, applyQty: demand.applyQty }]) quantities.set(line.sku, (quantities.get(line.sku) ?? 0) + line.applyQty)
    })
  return quantities
}

export function discountForDemandLevel(level: PmsDemandLevel): number {
  return DEMAND_LEVEL_DISCOUNT[level]
}

export function computeGapQty(sku: PmsSuggestionSku, kolApplyQty: number): number {
  return Math.max(0, sku.pendingDeliveryQty + kolApplyQty - sku.purchasingQty - sku.stockQty)
}

export function computeSuggestedQty(gapQty: number, discount: number): number {
  return Math.ceil(gapQty * discount)
}

export function toSuggestionView(suggestion: PmsPurchaseSuggestion): PmsSuggestionView {
  const kolQty = activeKolQtyBySku()
  const discount = discountForDemandLevel(suggestion.demandLevel)
  const skuItems: PmsSuggestionSkuView[] = suggestion.skuItems.map((sku) => {
    const kolApplyQty = kolQty.get(sku.sku) ?? 0
    const gapQty = computeGapQty(sku, kolApplyQty)
    const suggestedQty = computeSuggestedQty(gapQty, discount)
    return {
      ...sku,
      kolApplyQty,
      gapQty,
      discount,
      suggestedQty,
      availableQty: Math.max(0, suggestedQty - sku.convertedQty),
      needBom: suggestion.purchaseType === '做货',
    }
  })
  return {
    ...suggestion,
    skuItems,
    totalPendingDeliveryQty: skuItems.reduce((sum, sku) => sum + sku.pendingDeliveryQty, 0),
    totalKolApplyQty: skuItems.reduce((sum, sku) => sum + sku.kolApplyQty, 0),
    totalPurchasingQty: skuItems.reduce((sum, sku) => sum + sku.purchasingQty, 0),
    totalStockQty: skuItems.reduce((sum, sku) => sum + sku.stockQty, 0),
    totalSuggestedQty: skuItems.reduce((sum, sku) => sum + sku.suggestedQty, 0),
    totalAvailableQty: skuItems.reduce((sum, sku) => sum + sku.availableQty, 0),
  }
}

export function listPmsSuggestionViews(): PmsSuggestionView[] {
  return getRuntime().suggestions.map(row=>toSuggestionView(row))
}

export function getPmsSuggestionView(suggestionNo: string): PmsSuggestionView | undefined {
  const suggestion = getRuntime().suggestions.find((item) => item.suggestionNo === suggestionNo)
  return suggestion ? toSuggestionView(suggestion) : undefined
}

type DemandActor = { id: string; name: string; role: PmsActorRole }

function publishPmsSuggestions(rows: PmsPurchaseSuggestion[]): void {
  const all = getRuntime().suggestions
  for (const row of rows) {
    const index = all.findIndex(item => item.suggestionNo === row.suggestionNo)
    if (index >= 0) all[index] = row
    else all.unshift(row)
  }
}

export function publishPmsKolDemands(rows: PmsKolDemand[]): void {
  const all = getRuntime().kolDemands
  for (const row of rows) {
    const index = all.findIndex(item => item.demandNo === row.demandNo)
    if (index >= 0) all[index] = row
    else all.unshift(row)
  }
}

export function preparePmsSuggestionConversion(suggestionNo: string, orderNo: string, conversions: Array<{ sku: string; qty: number }>): PmsPurchaseSuggestion {
  const old = getRuntime().suggestions.find(item => item.suggestionNo === suggestionNo)
  if (!old) throw new PmsDomainError('SUGGESTION_NOT_FOUND', '采购建议不存在')
  if (!old.needProduction) throw new PmsDomainError('SUGGESTION_DISABLED', '此款已设置不需要做货')
  const next = structuredClone(old)
  for (const conversion of conversions) {
    const sku = next.skuItems.find(item => item.sku === conversion.sku)
    if (!sku || !Number.isInteger(conversion.qty) || conversion.qty <= 0) throw new PmsDomainError('SUGGESTION_QTY_INVALID', '采购SKU和数量不合法')
    sku.convertedQty += conversion.qty
  }
  next.convertedOrderNos = [...new Set([...next.convertedOrderNos, orderNo])]
  next.status = toSuggestionView(next).totalAvailableQty <= 0 ? '已生成' : '部分生成'
  next.updatedAt = new Date().toISOString()
  return next
}

export async function markSuggestionConverted(suggestionNo: string, orderNo: string, conversions: Array<{ sku: string; qty: number }>, actor: DemandActor, operationId = `convert-${crypto.randomUUID()}`): Promise<void> {
  await hydratePmsPurchaseSuggestionsFromIdb()
  const next = preparePmsSuggestionConversion(suggestionNo, orderNo, conversions)
  await pmsCommitRecords([{ store: PMS_STORES.pmsPurchaseSuggestions, value: next }], { operationId,
    log: { objectType: 'purchase-suggestion', objectId: suggestionNo, action: '关联采购单', beforeValue: '', afterValue: orderNo, reason: '', actorId: actor.id, actorName: actor.name, actorRole: actor.role, relatedPurchaseOrderNo: orderNo } })
  publishPmsSuggestions([next])
}

export async function generatePmsSuggestionPurchases(inputs: PmsCreatePurchaseOrderInput[], actor: DemandActor, operationId: string): Promise<PmsProductPurchaseOrder[]> {
  await hydratePmsPurchaseSuggestionsFromIdb()
  const orders = preparePmsProductPurchaseOrders(inputs, actor, operationId)
  const suggestions = orders.map((order, index) => preparePmsSuggestionConversion(inputs[index].sourceSuggestionNo ?? '', order.purchaseOrderNo, order.lines.map(line => ({ sku: line.sku, qty: line.qty }))))
  await pmsCommitRecords([
    ...orders.map(value => ({ store: PMS_STORES.pmsProductPurchaseOrders, value })),
    ...suggestions.map(value => ({ store: PMS_STORES.pmsPurchaseSuggestions, value })),
  ], { operationId, operationSignature:pmsCoreOperationSignature('生成商品采购单',inputs), log: { objectType: 'purchase-suggestion', objectId: suggestions[0].suggestionNo, action: '生成商品采购单', beforeValue: '待生成', afterValue: orders.map(order => order.purchaseOrderNo).join('、'), reason: '', actorId: actor.id, actorName: actor.name, actorRole: actor.role, relatedPurchaseOrderNo: orders[0].purchaseOrderNo } })
  publishPmsProductPurchaseOrders(orders)
  publishPmsSuggestions(suggestions)
  return orders
}

export async function setPmsSuggestionNeedProduction(suggestionNo: string, needProduction: boolean, actor: DemandActor, operationId: string): Promise<void> {
  await hydratePmsPurchaseSuggestionsFromIdb()
  const old = getRuntime().suggestions.find(row => row.suggestionNo === suggestionNo)
  if (!old) throw new PmsDomainError('SUGGESTION_NOT_FOUND', '采购建议不存在')
  const next = structuredClone(old)
  next.needProduction = needProduction
  next.status = !needProduction ? '无需采购' : toSuggestionView(next).totalAvailableQty ? '待生成' : '已生成'
  next.updatedAt = new Date().toISOString()
  await pmsCommitRecords([{ store: PMS_STORES.pmsPurchaseSuggestions, value: next }], { operationId, operationSignature:pmsCoreOperationSignature('设置是否做货',{suggestionNo,needProduction}), log: { objectType: 'purchase-suggestion', objectId: suggestionNo, action: needProduction ? '恢复做货' : '设置不需要做货', beforeValue: String(old.needProduction), afterValue: String(needProduction), reason: '', actorId: actor.id, actorName: actor.name, actorRole: actor.role, secondConfirmation: true } })
  publishPmsSuggestions([next])
}

export function listPmsKolDemands(): PmsKolDemand[] { return getRuntime().kolDemands.slice() }
export function getPmsKolDemand(demandNo: string): PmsKolDemand | undefined { return getRuntime().kolDemands.find(item => item.demandNo === demandNo) }

export interface PmsCreateKolDemandInput {
  spu: string; applicant: string; shop: string; appliedAt: string; position?: string; canSellHot?: boolean; remark?: string; draft?: boolean
  lines: Array<{ sku: string; qty: number; remark?: string }>
}

export async function createPmsKolDemand(input: PmsCreateKolDemandInput, actor: DemandActor, operationId: string): Promise<PmsKolDemand> {
  await hydratePmsPurchaseSuggestionsFromIdb()
  const product = listPmsCoreDemoProducts().find(row => row.spu === input.spu)
  if (!product || !input.lines.length) throw new PmsDomainError('KOL_PRODUCT_REQUIRED', '请选择商品及SKU')
  if (!input.applicant.trim() || !input.shop.trim() || !input.appliedAt) throw new PmsDomainError('KOL_REQUIRED', '申请人、店铺及申请时间不能为空')
  const seen = new Set<string>()
  const lines = input.lines.map(line => {
    const sku = product.skus.find(item => item.sku === line.sku)
    if (!sku || !Number.isInteger(line.qty) || line.qty <= 0 || seen.has(line.sku)) throw new PmsDomainError('KOL_SKU_INVALID', '请选择有效且不重复的SKU，数量必须是正整数')
    seen.add(line.sku)
    return { sku: sku.sku, color: sku.color, size: sku.size, imageUrl: sku.imageUrl, applyQty: line.qty, inboundQty: 0, remark: line.remark?.trim() ?? '' }
  })
  const row: PmsKolDemand = { demandNo: `KOL-2026-${pmsCoreStableCode(operationId)}`, spu: product.spu,
    productName: product.productName, imageUrl: product.imageUrl, sku: lines[0].sku, color: lines[0].color, size: lines[0].size,
    applyQty: lines.reduce((sum, line) => sum + line.applyQty, 0), inboundQty: 0, status: input.draft ? '草稿' : '待审核', applicant: input.applicant.trim(),
    appliedAt: input.appliedAt, shop: input.shop.trim(), position: input.position ?? '', canSellHot: Boolean(input.canSellHot),
    remark: input.remark?.trim() ?? '', rejectReason: '', inboundRecords: [], skuLines: lines, operationHistory:[{operationId,action:'新建KOL需求',actorName:actor.name,occurredAt:new Date().toISOString(),remark:input.remark?.trim()??''}], _pmsBaseVersion: 0 }
  await pmsCommitRecords([{ store: PMS_STORES.pmsKolDemands, value: row }], { operationId, operationSignature:pmsCoreOperationSignature('新建KOL需求',input), log: { objectType: 'kol-demand', objectId: row.demandNo, action: '新建KOL需求', beforeValue: '', afterValue: `${lines.length}SKU/${row.applyQty}件`, reason: row.remark, actorId: actor.id, actorName: actor.name, actorRole: actor.role } })
  publishPmsKolDemands([row])
  return row
}

export interface PmsKolInboundInput { qty: number; note: string; overConfirm?: boolean; lines?: Array<{ sku: string; qty: number }> }

export type PmsKolBatchAction = '审核通过' | '驳回' | '备注' | '确认入库' | '强制完成'
export function preparePmsKolDemandBatch(entries: Array<{ demandNo: string; qty?: number; lines?: Array<{ sku: string; qty: number }> }>, action: PmsKolBatchAction, remark: string, actor: DemandActor, operationId: string): PmsKolDemand[] {
  if (!entries.length) throw new PmsDomainError('KOL_EMPTY_SELECTION', '请先选择KOL需求')
  const ids = entries.map(entry => entry.demandNo)
  if (new Set(ids).size !== ids.length) throw new PmsDomainError('KOL_DUPLICATE', '需求重复，请重新选择')
  const rows = entries.map(entry => {
    const old = getPmsKolDemand(entry.demandNo)
    if (!old) throw new PmsDomainError('KOL_NOT_FOUND', '需求不存在')
    const next = structuredClone(old)
    if (action === '审核通过') {
      if (!['草稿', '待审核'].includes(old.status)) throw new PmsDomainError('KOL_AUDIT_BLOCKED', `${old.demandNo}不是待审核需求`)
      next.status = '待入库'
    } else if (action === '驳回') {
      if (!remark.trim()) throw new PmsDomainError('KOL_REASON_REQUIRED', '请填写驳回原因')
      if (['已驳回', '全部入库', '强制完成'].includes(old.status)) throw new PmsDomainError('KOL_REJECT_BLOCKED', `${old.demandNo}当前状态不能驳回`)
      next.status = '已驳回'; next.rejectReason = remark.trim()
    } else if (action === '备注') next.remark = remark.trim()
    else if (action === '强制完成') {
      if (!remark.trim()) throw new PmsDomainError('KOL_REASON_REQUIRED', '请说明强制完成原因')
      if (!['待入库', '部分入库'].includes(old.status)) throw new PmsDomainError('KOL_COMPLETE_BLOCKED', '当前状态不能强制完成')
      next.status = '强制完成'
    } else {
      if (!['待入库', '部分入库'].includes(old.status)) throw new PmsDomainError('KOL_INBOUND_BLOCKED', `${old.demandNo}当前状态不能入库`)
      let qty = entry.qty ?? entry.lines?.reduce((sum, line) => sum + line.qty, 0) ?? 0
      if (!Number.isInteger(qty) || qty <= 0 || qty > old.applyQty - old.inboundQty) throw new PmsDomainError('KOL_QTY_INVALID', `${old.demandNo}入库数量必须大于0且不能超过待入库${old.applyQty - old.inboundQty}件`)
      if (next.skuLines) {
        let remaining = qty
        for (const line of next.skuLines) {
          const actual = entry.lines ? entry.lines.find(item => item.sku === line.sku)?.qty ?? 0 : Math.min(remaining, line.applyQty - line.inboundQty)
          if (!Number.isInteger(actual) || actual < 0 || actual > line.applyQty - line.inboundQty) throw new PmsDomainError('KOL_SKU_QTY_INVALID', `${line.sku}入库数量超出待入库数量`)
          line.inboundQty += actual; remaining -= actual
        }
        if (remaining !== 0) throw new PmsDomainError('KOL_SKU_QTY_INVALID', 'SKU入库数量与汇总不一致')
      }
      next.inboundQty += qty
      next.status = next.inboundQty === next.applyQty ? '全部入库' : '部分入库'
      next.inboundRecords.unshift({ recordNo: `KOLIN-${operationId.slice(-12)}`, qty, note: remark.trim(), actorName: actor.name, occurredAt: new Date().toISOString() })
    }
    next.operationHistory=[{operationId,action,actorName:actor.name,occurredAt:new Date().toISOString(),remark:remark.trim()},...(next.operationHistory??[])]
    return next
  })
  return rows
}

export async function commitPmsKolDemandBatch(entries: Array<{ demandNo: string; qty?: number; lines?: Array<{ sku: string; qty: number }> }>, action: PmsKolBatchAction, remark: string, actor: DemandActor, operationId: string): Promise<PmsKolDemand[]> {
  await hydratePmsPurchaseSuggestionsFromIdb()
  const rows=preparePmsKolDemandBatch(entries,action,remark,actor,operationId)
  await hydratePmsKolStock()
  const receiptEntries=new Map<string,number>()
  if(action==='确认入库')rows.forEach((row,index)=>{const old=getPmsKolDemand(row.demandNo)!;for(const line of row.skuLines??[{sku:row.sku,inboundQty:row.inboundQty}]){const prior=old.skuLines?.find(item=>item.sku===line.sku)?.inboundQty??old.inboundQty;const qty=line.inboundQty-prior;if(qty>0)receiptEntries.set(line.sku,(receiptEntries.get(line.sku)??0)+qty)}})
  const stockRows=receiptEntries.size?preparePmsKolStockReceipt([...receiptEntries].map(([sku,quantity])=>({sku,quantity}))):[]
  await pmsCommitRecords([...rows.map(value => ({ store: PMS_STORES.pmsKolDemands, value })),...stockRows.map(value=>({store:PMS_STORES.pmsKolStock,value}))], { operationId, operationSignature:pmsCoreOperationSignature(action,{entries,remark}),
    log: { objectType: 'kol-demand', objectId: rows[0].demandNo, action, beforeValue: '', afterValue: rows.map(row => `${row.demandNo}/${row.status}`).join('、'), reason: remark.trim(), actorId: actor.id, actorName: actor.name, actorRole: actor.role, secondConfirmation: action === '驳回' || action === '强制完成' } })
  publishPmsKolDemands(rows)
  publishPmsKolStock(stockRows)
  return rows
}

export async function inboundPmsKolDemand(demandNo: string, input: PmsKolInboundInput, actor: DemandActor, operationId = `kol-inbound-${crypto.randomUUID()}`): Promise<PmsKolDemand> {
  return (await commitPmsKolDemandBatch([{ demandNo, qty: input.qty, lines: input.lines }], '确认入库', input.note, actor, operationId))[0]
}
export async function rejectPmsKolDemand(demandNo: string, reason: string, actor: DemandActor, operationId = `kol-reject-${crypto.randomUUID()}`): Promise<PmsKolDemand> {
  return (await commitPmsKolDemandBatch([{ demandNo }], '驳回', reason, actor, operationId))[0]
}
export async function updatePmsKolRemark(demandNo: string, remark: string, actor: DemandActor, operationId = `kol-remark-${crypto.randomUUID()}`): Promise<PmsKolDemand> {
  return (await commitPmsKolDemandBatch([{ demandNo }], '备注', remark, actor, operationId))[0]
}
export function listPmsKolLogs(demandNo: string): PmsOperationLog[] { const row=getPmsKolDemand(demandNo),history=row?.operationHistory??[];const saved=listPmsLogs('kol-demand',demandNo);return [...history.map(entry=>({id:`${demandNo}/${entry.operationId}`,objectType:'kol-demand',objectId:demandNo,action:entry.action,actorId:entry.actorName,actorName:entry.actorName,actorRole:'采购员' as const,occurredAt:entry.occurredAt,reason:entry.remark,beforeValue:'',afterValue:row?.status??'',source:'PMS' as const,timeZone:'Asia/Jakarta' as const})),...saved.filter(log=>!history.some(entry=>entry.action===log.action&&entry.actorName===log.actorName))] }
