import { PMS_STYLE_IMAGES } from './images.ts'
import { appendPmsLog, listPmsLogs, nextPmsSequence, PmsDomainError, type PmsOperationLog } from './runtime.ts'

export type PmsSuggestionStatus = '待生成' | '部分生成' | '已生成' | '无需采购'
export type PmsDemandLevel = '爆款' | '热销' | '常规'
export type PmsPurchaseType = '做货' | '成衣' | '样衣'
export type PmsKolDemandStatus = '草稿' | '待入库' | '部分入库' | '全部入库' | '已驳回'

export interface PmsSuggestionSku {
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
  if (!runtime) runtime = buildInitialRuntime()
  return runtime
}

export function activeKolQtyBySku(): Map<string, number> {
  const quantities = new Map<string, number>()
  getRuntime().kolDemands
    .filter((demand) => demand.status !== '草稿' && demand.status !== '已驳回')
    .forEach((demand) => {
      quantities.set(demand.sku, (quantities.get(demand.sku) ?? 0) + demand.applyQty)
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
  return getRuntime().suggestions.map(toSuggestionView)
}

export function getPmsSuggestionView(suggestionNo: string): PmsSuggestionView | undefined {
  const suggestion = getRuntime().suggestions.find((item) => item.suggestionNo === suggestionNo)
  return suggestion ? toSuggestionView(suggestion) : undefined
}

export function markSuggestionConverted(
  suggestionNo: string,
  orderNo: string,
  conversions: Array<{ sku: string; qty: number }>,
  actor: { id: string; name: string; role: '采购员' | '采购主管' | '财务' | '系统' },
): void {
  const suggestion = getRuntime().suggestions.find((item) => item.suggestionNo === suggestionNo)
  if (!suggestion) throw new PmsDomainError('SUGGESTION_NOT_FOUND', `采购建议 ${suggestionNo} 不存在`)
  conversions.forEach((conversion) => {
    const sku = suggestion.skuItems.find((item) => item.sku === conversion.sku)
    if (sku) sku.convertedQty += conversion.qty
  })
  if (!suggestion.convertedOrderNos.includes(orderNo)) suggestion.convertedOrderNos.push(orderNo)
  const view = toSuggestionView(suggestion)
  suggestion.status = view.totalAvailableQty <= 0 ? '已生成' : '部分生成'
  suggestion.updatedAt = new Date().toISOString()
  appendPmsLog({
    objectType: 'purchase-suggestion',
    objectId: suggestionNo,
    action: '转采购单',
    beforeValue: '待生成',
    afterValue: `生成 ${orderNo}`,
    reason: '按建议缺口生成商品采购单',
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    relatedPurchaseOrderNo: orderNo,
  })
}

export function listPmsKolDemands(): PmsKolDemand[] {
  return getRuntime().kolDemands
}

export function getPmsKolDemand(demandNo: string): PmsKolDemand | undefined {
  return getRuntime().kolDemands.find((item) => item.demandNo === demandNo)
}

export interface PmsKolInboundInput {
  qty: number
  note: string
  overConfirm?: boolean
}

export function inboundPmsKolDemand(
  demandNo: string,
  input: PmsKolInboundInput,
  actor: { id: string; name: string; role: '采购员' | '采购主管' | '财务' | '系统' },
): PmsKolDemand {
  const demand = getPmsKolDemand(demandNo)
  if (!demand) throw new PmsDomainError('KOL_NOT_FOUND', `KOL 需求单 ${demandNo} 不存在`)
  if (demand.status === '草稿') throw new PmsDomainError('KOL_DRAFT_BLOCKED', '草稿需求需提交后才能入库')
  if (demand.status === '已驳回') throw new PmsDomainError('KOL_REJECTED_BLOCKED', '已驳回需求不可入库')
  if (demand.status === '全部入库') throw new PmsDomainError('KOL_FULL_BLOCKED', '该需求已全部入库')
  if (!Number.isInteger(input.qty) || input.qty <= 0) {
    throw new PmsDomainError('KOL_QTY_INVALID', '入库数量必须是大于 0 的整数')
  }
  const remaining = demand.applyQty - demand.inboundQty
  if (input.qty > remaining && !input.overConfirm) {
    throw new PmsDomainError('KOL_OVER_CONFIRM_REQUIRED', `本次入库超过待入库数量 ${remaining} 件，需要二次确认`)
  }
  if (input.qty > demand.applyQty) {
    throw new PmsDomainError('KOL_OVER_APPLY', '入库数量不能超过申请数量')
  }
  const beforeQty = demand.inboundQty
  demand.inboundQty += input.qty
  demand.status = demand.inboundQty >= demand.applyQty ? '全部入库' : '部分入库'
  demand.inboundRecords.unshift({
    recordNo: nextPmsSequence('KOLIN', 4),
    qty: input.qty,
    note: input.note,
    actorName: actor.name,
    occurredAt: new Date().toISOString(),
  })
  appendPmsLog({
    objectType: 'kol-demand',
    objectId: demandNo,
    action: '入库',
    beforeValue: `${beforeQty} 件 · ${demand.status}`,
    afterValue: `${demand.inboundQty} 件 · ${demand.status}`,
    reason: input.note || 'KOL 需求入库',
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    secondConfirmation: Boolean(input.overConfirm),
  })
  return demand
}

export function rejectPmsKolDemand(
  demandNo: string,
  reason: string,
  actor: { id: string; name: string; role: '采购员' | '采购主管' | '财务' | '系统' },
): PmsKolDemand {
  const demand = getPmsKolDemand(demandNo)
  if (!demand) throw new PmsDomainError('KOL_NOT_FOUND', `KOL 需求单 ${demandNo} 不存在`)
  if (!reason.trim()) throw new PmsDomainError('KOL_REASON_REQUIRED', '驳回必须填写原因')
  if (demand.status === '已驳回') throw new PmsDomainError('KOL_ALREADY_REJECTED', '该需求已经驳回')
  if (demand.status === '全部入库') throw new PmsDomainError('KOL_FULL_BLOCKED', '已全部入库的需求不可驳回')
  const beforeStatus = demand.status
  demand.status = '已驳回'
  demand.rejectReason = reason.trim()
  appendPmsLog({
    objectType: 'kol-demand',
    objectId: demandNo,
    action: '驳回',
    beforeValue: beforeStatus,
    afterValue: '已驳回',
    reason: reason.trim(),
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    secondConfirmation: true,
  })
  return demand
}

export function updatePmsKolRemark(
  demandNo: string,
  remark: string,
  actor: { id: string; name: string; role: '采购员' | '采购主管' | '财务' | '系统' },
): PmsKolDemand {
  const demand = getPmsKolDemand(demandNo)
  if (!demand) throw new PmsDomainError('KOL_NOT_FOUND', `KOL 需求单 ${demandNo} 不存在`)
  const beforeRemark = demand.remark
  demand.remark = remark.trim()
  appendPmsLog({
    objectType: 'kol-demand',
    objectId: demandNo,
    action: '备注',
    beforeValue: beforeRemark,
    afterValue: demand.remark,
    reason: '',
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
  })
  return demand
}

export function listPmsKolLogs(demandNo: string): PmsOperationLog[] {
  return listPmsLogs('kol-demand', demandNo)
}
