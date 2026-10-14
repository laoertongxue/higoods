import { appendKolLockRows } from './kol-sample-stock-lock-log.ts'
import { hydratePmsMaterialPurchaseOrdersFromIdb } from './material-purchase-orders.ts'
import { hydratePmsKolStock, preparePmsKolStockReceipt, preparePmsKolStockIssue, preparePmsKolStockIssueLogs, publishPmsKolStock } from './kol-sample-stock.ts'
import { pmsCoreOperationSignature, assertPmsCoreDraftVersion } from './core-write-contract.ts'
import { getPublishedPurchaseMaterials } from './canonical-purchase-references.ts'
import { listSkuArchives } from '../pcs-sku-archive-repository.ts'
import { PMS_STYLE_IMAGES } from './images.ts'
import { PMS_STORES, pmsAll, pmsCommitRecords, type PmsCommitRecord } from './idb-storage.ts'
import { listPmsLogs, PmsDomainError, roundPmsQty, type PmsActorRole, type PmsOperationLog } from './runtime.ts'
import { preparePmsMaterialRequirementFromOrder, publishPmsMaterialRequirements, type PmsMaterialRequirementLine } from './material-requirements.ts'

/**
 * 商品采购单 IDB hydrate 状态机(同其他 PMS 模块模式)。
 */
let ppoHydrationPromise: Promise<void> | null = null

export function hydratePmsProductPurchaseOrdersFromIdb(): Promise<void> {
  if (ppoHydrationPromise) return ppoHydrationPromise
  ppoHydrationPromise = pmsAll<PmsProductPurchaseOrder>(PMS_STORES.pmsProductPurchaseOrders)
    .then(publishPmsProductPurchaseOrders)
    .catch((error: unknown) => { ppoHydrationPromise = null; throw error })
  return ppoHydrationPromise
}

export type PmsProductPurchaseOrderStatus =
  | '草稿'
  | '待采购'
  | '待确认'
  | '已确认'
  | '已发货'
  | '已到货'
  | '已入库'
  | '已完成'
  | '已关闭'

export type PmsMaterialGenerationStatus = '不需要' | '未生成' | '已生成' | '已下推'

export type PmsPurchaseRegion = '国内' | '印尼' | '其他'

export type PmsYesNo = '是' | '否'
export type PmsProductPurchaseType = '做货' | '成衣' | '样衣' | '达人寄样' | '烫画'
export interface PmsProductExpress { carrier: string; trackingNo: string; shippedAt: string; receivedAt: string; remark: string }
export interface PmsPurchaseActionHistory { actionId: string; action: string; actorName: string; occurredAt: string; remark: string }

export type PmsBomMatchStatus = '已匹配' | '未匹配'

export interface PmsProductPurchaseOrderLine {
  lineId: string
  sku: string
  color: string
  size: string
  imageUrl: string
  standardPrice: number
  actualPrice: number
  qty: number
  deliveredQty: number
  needBom: boolean
  bomMatched: boolean
  materialStatus: PmsMaterialGenerationStatus
  bomNo?: string
  bomVersion?: string
  bomStatus?: PmsBomMatchStatus
  applicant?: string
  creator?: string
  weight?: number
}

export interface PmsProductPurchaseOrder {
  purchaseOrderNo: string
  spu: string
  productName: string
  imageUrl: string
  purchaseType: PmsProductPurchaseType
  area: PmsPurchaseRegion
  productionArea?: PmsPurchaseRegion
  supplierName: string
  warehouse: string
  status: PmsProductPurchaseOrderStatus
  version: number
  lines: PmsProductPurchaseOrderLine[]
  orderedAt: string
  expectedDeliveryDate: string
  creator: string
  purchaser?: string
  isUrgent?: PmsYesNo
  isFirstOrder?: PmsYesNo
  remark: string
  sourceSuggestionNo: string
  closedReason: string
  purchaseAddress?: string
  saleType?: string
  recipientName?: string
  partnerName?: string
  currency?: 'CNY' | 'IDR' | 'USD'
  exchangeRate?: number
  expressRecords?: PmsProductExpress[]
  outboundRecords?: Array<{ sku: string; qty: number; occurredAt: string; actorName: string; remark: string }>
  operationHistory?: PmsPurchaseActionHistory[]
  qualityResult?: string
  barcodeQuantities?: Record<string, number>
  templateConfirmed?: boolean
  sourceReorderSpu?: string
  sourceOrderNos?: string[]
  aftersaleIds?: string[]
  stockMovements?: Array<{operationId:string;sku:string;warehouse:string;direction:'入库'|'出库';qty:number;occurredAt:string;actorName:string}>
  reviewOutcome?: string
  auditedAt?: string
  receivedAt?: string
  inboundBy?: string
  inboundReopened?: boolean
  mergedInto?: string
  combinedOrderNo?: string
  platform?: string
  transferRequired?: string
  transferHistory?: boolean
  insertOrder?: boolean
  _pmsBaseVersion?: number
}

interface PmsPpoRuntime {
  orders: PmsProductPurchaseOrder[]
}

interface PmsPurchaseOrderLineExtras {
  bomNo?: string
  bomVersion?: string
  bomStatus?: PmsBomMatchStatus
  applicant?: string
  creator?: string
  weight?: number
}

function buildLine(
  lineId: string,
  sku: string,
  color: string,
  size: string,
  imageUrl: string,
  standardPrice: number,
  actualPrice: number,
  qty: number,
  deliveredQty: number,
  needBom: boolean,
  bomMatched: boolean,
  materialStatus: PmsMaterialGenerationStatus,
  extras: PmsPurchaseOrderLineExtras = {},
): PmsProductPurchaseOrderLine {
  return {
    lineId,
    sku,
    color,
    size,
    imageUrl,
    standardPrice,
    actualPrice,
    qty,
    deliveredQty,
    needBom,
    bomMatched,
    materialStatus,
    bomNo: extras.bomNo ?? '',
    bomVersion: extras.bomVersion ?? (needBom ? 'V1.0' : ''),
    bomStatus: extras.bomStatus ?? (needBom ? (bomMatched ? '已匹配' : '未匹配') : '未匹配'),
    applicant: extras.applicant ?? '张三',
    creator: extras.creator ?? '李四',
    weight: extras.weight ?? 0.35,
  }
}

function normalizeSeedOrders(orders: PmsProductPurchaseOrder[]): PmsProductPurchaseOrder[] {
  const catalog = listPmsCoreDemoProducts()
  return orders.map((order, index) => {
    const product = catalog[index % Math.min(catalog.length, 8)]
    const references = product?.skus.slice(0, Math.max(1, order.lines.length)) ?? []
    return ({
    ...order,
    ...(product ? { spu: product.spu, productName: product.productName, imageUrl: product.imageUrl } : {}),
    productionArea: order.productionArea ?? order.area,
    purchaser: order.purchaser ?? (index % 2 === 0 ? '王采购' : '陈采购'),
    isUrgent: order.isUrgent ?? (index % 4 === 3 ? '是' : '否'),
    isFirstOrder: order.isFirstOrder ?? (index % 5 === 4 ? '是' : '否'),
    lines: (references.length ? references : order.lines).map((reference, lineIndex) => ({
      ...order.lines[Math.min(lineIndex, order.lines.length - 1)],
      ...('price' in reference ? { sku: reference.sku, color: reference.color, size: reference.size, imageUrl: reference.imageUrl, standardPrice: reference.price, actualPrice: reference.price, weight: reference.weight } : {}),
      lineId: `${order.purchaseOrderNo}-L${lineIndex + 1}`,
      bomNo: '',
    })),
  })})
}

function buildInitialRuntime(): PmsPpoRuntime {
  const tshirt = PMS_STYLE_IMAGES.tshirt
  const pants = PMS_STYLE_IMAGES.pants
  const hoodie = PMS_STYLE_IMAGES.hoodie
  const jacket = PMS_STYLE_IMAGES.jacket
  const shirt = PMS_STYLE_IMAGES.shirt
  const dress = PMS_STYLE_IMAGES.dress
  const orders: PmsProductPurchaseOrder[] = [
    {
      purchaseOrderNo: 'CG-2026-0016', spu: 'HG-TS-2601', productName: '男款圆领T恤', imageUrl: tshirt, purchaseType: '做货', area: '印尼', supplierName: '广州华盛制衣有限公司', warehouse: '印尼雅加达成品仓', status: '待采购', version: 1,
      lines: [
        buildLine('L-0016-01', 'HG-TS-2601-WH-M', '白色', 'M', tshirt, 31.5, 31.5, 2000, 0, true, true, '未生成'),
        buildLine('L-0016-02', 'HG-TS-2601-WH-L', '白色', 'L', tshirt, 31.5, 31.2, 2200, 0, true, true, '未生成'),
        buildLine('L-0016-03', 'HG-TS-2601-BK-M', '黑色', 'M', tshirt, 32.2, 32.2, 1900, 0, true, true, '未生成'),
      ],
      orderedAt: '2026-06-07T09:20:00+07:00', expectedDeliveryDate: '2026-06-30', creator: '王采购', remark: '618 返场备货', sourceSuggestionNo: 'PSG-2026-0001', closedReason: '',
    },
    {
      purchaseOrderNo: 'CG-2026-0017', spu: 'HG-PT-2602', productName: '女款休闲裤', imageUrl: pants, purchaseType: '做货', area: '印尼', supplierName: '佛山成衣加工厂', warehouse: '印尼雅加达成品仓', status: '待确认', version: 2,
      lines: [
        buildLine('L-0017-01', 'HG-PT-2602-BK-M', '黑色', 'M', pants, 58.6, 58.6, 2600, 0, true, true, '未生成'),
        buildLine('L-0017-02', 'HG-PT-2602-BK-L', '黑色', 'L', pants, 58.6, 58.9, 1800, 0, true, true, '未生成'),
      ],
      orderedAt: '2026-06-06T14:10:00+07:00', expectedDeliveryDate: '2026-07-05', creator: '王采购', remark: '', sourceSuggestionNo: 'PSG-2026-0002', closedReason: '',
    },
    {
      purchaseOrderNo: 'CG-2026-0018', spu: 'HG-HD-2603', productName: '连帽卫衣', imageUrl: hoodie, purchaseType: '做货', area: '印尼', supplierName: '中山针织制衣有限公司', warehouse: '印尼雅加达成品仓', status: '已确认', version: 1,
      lines: [
        buildLine('L-0018-01', 'HG-HD-2603-GY-M', '灰色', 'M', hoodie, 86.2, 86.0, 1200, 0, true, true, '已生成'),
        buildLine('L-0018-02', 'HG-HD-2603-GY-L', '灰色', 'L', hoodie, 86.2, 86.0, 1400, 0, true, true, '已生成'),
        buildLine('L-0018-03', 'HG-HD-2603-NV-M', '藏青', 'M', hoodie, 87.5, 87.5, 1000, 0, true, true, '已生成'),
      ],
      orderedAt: '2026-06-05T10:05:00+07:00', expectedDeliveryDate: '2026-07-08', creator: '王采购', remark: '秋款首批', sourceSuggestionNo: 'PSG-2026-0003', closedReason: '',
    },
    {
      purchaseOrderNo: 'CG-2026-0019', spu: 'HG-JK-2605', productName: '轻薄夹克', imageUrl: jacket, purchaseType: '做货', area: '国内', supplierName: '苏州户外服饰有限公司', warehouse: '广州原料仓', status: '草稿', version: 1,
      lines: [
        buildLine('L-0019-01', 'HG-JK-2605-KH-M', '卡其', 'M', jacket, 112, 112, 900, 0, true, false, '未生成'),
        buildLine('L-0019-02', 'HG-JK-2605-BK-L', '黑色', 'L', jacket, 116, 116, 700, 0, true, false, '未生成'),
      ],
      orderedAt: '2026-06-08T16:30:00+07:00', expectedDeliveryDate: '2026-07-20', creator: '王采购', remark: 'BOM 尚未匹配，先存草稿', sourceSuggestionNo: 'PSG-2026-0004', closedReason: '',
    },
    {
      purchaseOrderNo: 'CG-2026-0020', spu: 'HG-SH-2607', productName: '商务衬衫', imageUrl: shirt, purchaseType: '做货', area: '印尼', supplierName: '宁波衬衫制造有限公司', warehouse: '印尼雅加达成品仓', status: '已发货', version: 1,
      lines: [
        buildLine('L-0020-01', 'HG-SH-2607-WH-M', '白色', 'M', shirt, 49, 48.5, 700, 0, true, true, '已下推'),
        buildLine('L-0020-02', 'HG-SH-2607-WH-L', '白色', 'L', shirt, 49, 48.5, 700, 0, true, true, '已下推'),
      ],
      orderedAt: '2026-05-28T09:00:00+07:00', expectedDeliveryDate: '2026-06-25', creator: '王采购', remark: '', sourceSuggestionNo: '', closedReason: '',
    },
    {
      purchaseOrderNo: 'CG-2026-0021', spu: 'HG-SK-2604', productName: '女款连衣裙', imageUrl: dress, purchaseType: '做货', area: '印尼', supplierName: '杭州女装制衣有限公司', warehouse: '印尼雅加达成品仓', status: '已到货', version: 2,
      lines: [
        buildLine('L-0021-01', 'HG-SK-2604-NV-M', '藏青', 'M', dress, 96, 95.5, 900, 900, true, true, '已下推'),
        buildLine('L-0021-02', 'HG-SK-2604-NV-L', '藏青', 'L', dress, 96, 95.5, 800, 800, true, true, '已下推'),
      ],
      orderedAt: '2026-05-20T11:20:00+07:00', expectedDeliveryDate: '2026-06-18', creator: '王采购', remark: '', sourceSuggestionNo: '', closedReason: '',
    },
    {
      purchaseOrderNo: 'CG-2026-0022', spu: 'HG-GAR-2601', productName: '女款休闲裤成衣', imageUrl: pants, purchaseType: '成衣', area: '印尼', supplierName: '佛山成衣加工厂', warehouse: '印尼雅加达成品仓', status: '已入库', version: 1,
      lines: [buildLine('L-0022-01', 'HG-GAR-2601-BK-M', '黑色', 'M', pants, 120, 118, 900, 900, false, true, '不需要')],
      orderedAt: '2026-05-16T10:00:00+07:00', expectedDeliveryDate: '2026-06-10', creator: '王采购', remark: '成衣直采', sourceSuggestionNo: '', closedReason: '',
    },
    {
      purchaseOrderNo: 'CG-2026-0023', spu: 'HG-SAM-2601', productName: '男款圆领T恤样衣', imageUrl: tshirt, purchaseType: '样衣', area: '国内', supplierName: '杭州样衣开发中心', warehouse: '杭州样衣仓', status: '已完成', version: 1,
      lines: [buildLine('L-0023-01', 'HG-SAM-2601-WH-M', '白色', 'M', tshirt, 260, 260, 60, 60, false, true, '不需要')],
      orderedAt: '2026-05-10T09:30:00+07:00', expectedDeliveryDate: '2026-05-30', creator: '刘采购', remark: '样衣开发首单', sourceSuggestionNo: '', closedReason: '',
    },
    {
      purchaseOrderNo: 'CG-2026-0024', spu: 'HG-TS-2601', productName: '男款圆领T恤', imageUrl: tshirt, purchaseType: '做货', area: '印尼', supplierName: '广州华盛制衣有限公司', warehouse: '印尼雅加达成品仓', status: '待确认', version: 1,
      lines: [
        buildLine('L-0024-01', 'HG-TS-2601-BK-L', '黑色', 'L', tshirt, 32.2, 32.0, 1500, 0, true, true, '未生成'),
        buildLine('L-0024-02', 'HG-TS-2601-WH-L', '白色', 'L', tshirt, 31.5, 31.5, 800, 0, true, true, '未生成'),
      ],
      orderedAt: '2026-06-08T09:15:00+07:00', expectedDeliveryDate: '2026-07-02', creator: '王采购', remark: '', sourceSuggestionNo: '', closedReason: '',
    },
    {
      purchaseOrderNo: 'CG-2026-0025', spu: 'HG-HD-2603', productName: '连帽卫衣', imageUrl: hoodie, purchaseType: '做货', area: '印尼', supplierName: '中山针织制衣有限公司', warehouse: '印尼雅加达成品仓', status: '草稿', version: 1,
      lines: [buildLine('L-0025-01', 'HG-HD-2603-NV-L', '藏青', 'L', hoodie, 87.5, 87.5, 1000, 0, true, true, '未生成')],
      orderedAt: '2026-06-09T08:40:00+07:00', expectedDeliveryDate: '2026-07-15', creator: '刘采购', remark: '等供应商回签价格', sourceSuggestionNo: '', closedReason: '',
    },
    {
      purchaseOrderNo: 'CG-2026-0026', spu: 'HG-PT-2602', productName: '女款休闲裤', imageUrl: pants, purchaseType: '做货', area: '印尼', supplierName: '佛山成衣加工厂', warehouse: '印尼雅加达成品仓', status: '已完成', version: 3,
      lines: [
        buildLine('L-0026-01', 'HG-PT-2602-BK-S', '黑色', 'S', pants, 58.6, 58.6, 1800, 1800, true, true, '已下推'),
        buildLine('L-0026-02', 'HG-PT-2602-BK-L', '黑色', 'L', pants, 58.6, 58.6, 1800, 1800, true, true, '已下推'),
      ],
      orderedAt: '2026-05-06T10:10:00+07:00', expectedDeliveryDate: '2026-06-02', creator: '王采购', remark: '', sourceSuggestionNo: '', closedReason: '',
    },
    {
      purchaseOrderNo: 'CG-2026-0027', spu: 'HG-JK-2605', productName: '轻薄夹克', imageUrl: jacket, purchaseType: '做货', area: '国内', supplierName: '苏州户外服饰有限公司', warehouse: '广州原料仓', status: '已关闭', version: 2,
      lines: [buildLine('L-0027-01', 'HG-JK-2605-KH-L', '卡其', 'L', jacket, 112, 112, 800, 0, true, false, '未生成')],
      orderedAt: '2026-05-02T13:00:00+07:00', expectedDeliveryDate: '2026-06-01', creator: '王采购', remark: '', sourceSuggestionNo: '', closedReason: '终端取消本批卡其色订单',
    },
  ]
  return { orders: normalizeSeedOrders(orders) }
}

let runtime: PmsPpoRuntime | null = null
let orderSequence = 27

const SPU_STANDARD_PRICE: Record<string, number> = {
  'HG-TS-2601': 31.5,
  'HG-PT-2602': 58.6,
  'HG-HD-2603': 86.2,
  'HG-JK-2605': 112,
  'HG-SH-2607': 49,
  'HG-SK-2604': 96,
  'HG-GAR-2601': 120,
  'HG-SAM-2601': 260,
}

export function defaultPmsSkuPrice(sku: string): number {
  const reference = listSkuArchives().find(item => item.skuCode === sku)
  if (reference) return reference.costPrice
  const spu = sku.split('-').slice(0, 3).join('-')
  return SPU_STANDARD_PRICE[spu] ?? 0
}

export function pmsProductPurchaseOrderLineAmount(line: PmsProductPurchaseOrderLine): number {
  return roundPmsQty(line.actualPrice * line.qty)
}

export function pmsProductPurchaseOrderAmount(order: PmsProductPurchaseOrder): number {
  return roundPmsQty(order.lines.reduce((sum, line) => sum + pmsProductPurchaseOrderLineAmount(line), 0))
}

function getRuntime(): PmsPpoRuntime {
  if (!runtime) runtime = buildInitialRuntime()
  return runtime
}

const EDITABLE_STATUSES: PmsProductPurchaseOrderStatus[] = ['草稿', '待采购', '待确认']
const STATUS_TRANSITIONS: Record<PmsProductPurchaseOrderStatus, PmsProductPurchaseOrderStatus[]> = {
  草稿: ['待采购'],
  待采购: ['待确认'],
  待确认: ['已确认'],
  已确认: ['已发货'],
  已发货: ['已到货'],
  已到货: ['已入库'],
  已入库: ['已完成'],
  已完成: [],
  已关闭: [],
}

export function listPmsProductPurchaseOrders(): PmsProductPurchaseOrder[] {
  return getRuntime().orders
}

export function pmsAllowedNextStatuses(status: PmsProductPurchaseOrderStatus): PmsProductPurchaseOrderStatus[] {
  return STATUS_TRANSITIONS[status]
}

export function getPmsProductPurchaseOrder(purchaseOrderNo: string): PmsProductPurchaseOrder | undefined {
  return getRuntime().orders.find((order) => order.purchaseOrderNo === purchaseOrderNo)
}

export interface PmsPurchaseOrderLineInput {
  sku: string
  color: string
  size: string
  qty: number
  standardPrice: number
  actualPrice: number
  bomNo?: string
  bomVersion?: string
  bomStatus?: PmsBomMatchStatus
  applicant?: string
  creator?: string
  weight?: number
}

export interface PmsCreatePurchaseOrderInput {
  spu: string
  productName: string
  imageUrl: string
  purchaseType: PmsProductPurchaseType
  area: PmsPurchaseRegion
  productionArea?: PmsPurchaseRegion | ''
  supplierName: string
  warehouse: string
  expectedDeliveryDate: string
  sourceSuggestionNo?: string
  remark?: string
  purchaser?: string
  isUrgent?: PmsYesNo
  isFirstOrder?: PmsYesNo
  lines: PmsPurchaseOrderLineInput[]
  purchaseAddress?: string
  saleType?: string
  recipientName?: string
  currency?: 'CNY' | 'IDR' | 'USD'
  exchangeRate?: number
}

function validateLineInput(line: PmsPurchaseOrderLineInput, index: number): PmsPurchaseOrderLineInput {
  if (!line.sku.trim()) throw new PmsDomainError('PPO_SKU_REQUIRED', `第 ${index + 1} 行缺少 SKU`)
  if (!Number.isInteger(line.qty) || line.qty <= 0) {
    throw new PmsDomainError('PPO_QTY_INVALID', `${line.sku} 的采购数量必须是大于 0 的整数`)
  }
  if (!Number.isFinite(line.actualPrice) || line.actualPrice < 0) {
    throw new PmsDomainError('PPO_PRICE_INVALID', `${line.sku} 的采购单价不能为负数`)
  }
  if (line.weight !== undefined && (!Number.isFinite(line.weight) || line.weight < 0)) {
    throw new PmsDomainError('PPO_WEIGHT_INVALID', `${line.sku} 的单件重量必须是大于等于 0 的数字`)
  }
  return line
}

export interface PmsPurchaseProductCandidate {
  spu: string
  productName: string
  imageUrl: string
  skus: Array<{ sku: string; color: string; size: string; imageUrl: string; price: number; weight: number }>
}

export function listPmsPurchaseProductCandidates(keyword = ''): PmsPurchaseProductCandidate[] {
  const needle = keyword.trim().toLowerCase()
  const grouped = new Map<string, PmsPurchaseProductCandidate>()
  for (const sku of listSkuArchives()) {
    if (sku.archiveStatus !== 'ACTIVE' || !sku.skuImageUrl) continue
    let group = grouped.get(sku.styleCode)
    if (!group) {
      group = { spu: sku.styleCode, productName: sku.styleName, imageUrl: sku.skuImageUrl, skus: [] }
      grouped.set(sku.styleCode, group)
    }
    group.skus.push({ sku: sku.skuCode, color: sku.colorName, size: sku.sizeName, imageUrl: sku.skuImageUrl, price: sku.costPrice, weight: sku.weightKg })
  }
  return [...grouped.values()].filter(row => !needle || [row.spu, row.productName, ...row.skus.map(sku => sku.sku)].some(value => value.toLowerCase().includes(needle)))
}

export function listPmsCoreDemoProducts(): PmsPurchaseProductCandidate[] {
  const catalog = listPmsPurchaseProductCandidates()
  return [...catalog.filter(row => getPublishedPurchaseMaterials(row.spu)), ...catalog.filter(row => !getPublishedPurchaseMaterials(row.spu))]
}

function stablePurchaseSuffix(value: string): string {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619)
  return (hash >>> 0).toString(36).toUpperCase().padStart(7, '0')
}

function addPurchaseHistory(order: PmsProductPurchaseOrder, action: string, actorName: string, remark: string, operationId: string): void {
  order.operationHistory = [{ actionId: operationId, action, actorName, occurredAt: new Date().toISOString(), remark }, ...(order.operationHistory ?? [])]
}

/** Pure draft preparation. Callers may include source suggestions/reorder records in the same commit. */
export function preparePmsProductPurchaseOrders(
  inputs: PmsCreatePurchaseOrderInput[],
  actor: { id: string; name: string; role: PmsActorRole },
  operationId: string,
): PmsProductPurchaseOrder[] {
  if (!inputs.length) throw new PmsDomainError('PPO_EMPTY', '请至少选择一个款式生成采购单')
  if (!operationId) throw new PmsDomainError('PPO_OPERATION_REQUIRED', '采购表单已失效，请重新打开')
  return inputs.map((input, index) => {
    const canonical=listPmsPurchaseProductCandidates().find(row=>row.spu===input.spu)
    if(!canonical||input.lines.some(line=>!canonical.skus.some(sku=>sku.sku===line.sku)))throw new PmsDomainError('PPO_CANONICAL_SKU_REQUIRED','请选择商品中心当前有效SPU及其SKU；历史采购快照仍可查看')
    if (!input.spu.trim() || !input.productName.trim()) throw new PmsDomainError('PPO_PRODUCT_REQUIRED', '请选择商品')
    if (!input.supplierName.trim()) throw new PmsDomainError('PPO_SUPPLIER_REQUIRED', `${input.productName} 未选择供应商`)
    if (!input.warehouse.trim()) throw new PmsDomainError('PPO_WAREHOUSE_REQUIRED', `${input.productName} 未选择目标仓库`)
    if (!input.lines.length) throw new PmsDomainError('PPO_LINE_EMPTY', `${input.productName} 没有可采购的SKU`)
    const purchaser = (input.purchaser ?? actor.name).trim()
    if (!purchaser) throw new PmsDomainError('PPO_PURCHASER_REQUIRED', '请填写采购员')
    if (input.purchaseType === '做货' && input.productionArea === '') throw new PmsDomainError('PPO_PRODUCTION_AREA_REQUIRED', '请选择做货区域')
    const seen = new Set<string>()
    input.lines.forEach((line, lineIndex) => {
      validateLineInput(line, lineIndex)
      if (seen.has(line.sku)) throw new PmsDomainError('PPO_SKU_DUPLICATE', `${line.sku} 重复，请合并数量`)
      seen.add(line.sku)
    })
    const template = getPublishedPurchaseMaterials(input.spu)
    const needBom = input.purchaseType === '做货' || input.purchaseType === '烫画'
    const purchaseOrderNo = `CG-2026-${stablePurchaseSuffix(`${operationId}:${index}`)}`
    const order: PmsProductPurchaseOrder = {
      purchaseOrderNo, spu: input.spu, productName: input.productName, imageUrl: input.imageUrl,
      purchaseType: input.purchaseType, area: input.area, productionArea: input.productionArea || input.area,
      supplierName: input.supplierName.trim(), warehouse: input.warehouse.trim(), status: '待采购', version: 1,
      lines: input.lines.map((line, lineIndex) => buildLine(`${purchaseOrderNo}-L${lineIndex + 1}`, line.sku, line.color, line.size, canonical.skus.find(sku=>sku.sku===line.sku)!.imageUrl, line.standardPrice, line.actualPrice, line.qty, 0, needBom, needBom && Boolean(template), needBom ? '未生成' : '不需要', {
        bomNo: line.bomNo || '', bomVersion: needBom ? line.bomVersion || template?.version || '' : '', bomStatus: needBom && template ? '已匹配' : '未匹配', applicant: line.applicant || actor.name, creator: line.creator || actor.name, weight: line.weight ?? canonical.skus.find(sku=>sku.sku===line.sku)!.weight,
      })),
      orderedAt: new Date().toISOString(), expectedDeliveryDate: input.expectedDeliveryDate, creator: actor.name,
      purchaser, isUrgent: input.isUrgent ?? '否', isFirstOrder: input.isFirstOrder ?? '否', remark: input.remark?.trim() ?? '',
      sourceSuggestionNo: input.sourceSuggestionNo ?? '', closedReason: '', purchaseAddress: input.purchaseAddress ?? '',
      saleType: input.saleType ?? '', recipientName: input.recipientName ?? '', currency: input.currency ?? 'CNY', exchangeRate: input.exchangeRate ?? 1,
      expressRecords: [], outboundRecords: [], _pmsBaseVersion: 0,
    }
    addPurchaseHistory(order, '创建采购单', actor.name, input.sourceSuggestionNo ? `来源采购建议 ${input.sourceSuggestionNo}` : order.remark, operationId)
    return order
  })
}

export function publishPmsProductPurchaseOrders(orders: PmsProductPurchaseOrder[]): void {
  const list = getRuntime().orders
  for (const order of orders) {
    const index = list.findIndex(item => item.purchaseOrderNo === order.purchaseOrderNo)
    if (index >= 0) list[index] = order
    else list.unshift(order)
  }
}

export async function commitPmsProductPurchaseOrders(
  orders: PmsProductPurchaseOrder[],
  actor: { id: string; name: string; role: PmsActorRole },
  action: string,
  operationId: string,
  relatedRecords: PmsCommitRecord[] = [],
  operationSignature?: string,
): Promise<PmsProductPurchaseOrder[]> {
  const committed = await pmsCommitRecords([
    ...orders.map(value => ({ store: PMS_STORES.pmsProductPurchaseOrders, value })), ...relatedRecords,
  ], { operationId, operationSignature: operationSignature ?? pmsCoreOperationSignature(action, orders.map(({ operationHistory, orderedAt, version, _pmsBaseVersion, ...business }) => business)), log: { objectType: 'product-purchase-order', objectId: orders[0]?.purchaseOrderNo ?? operationId,
    action, beforeValue: '', afterValue: `${orders.length}张采购单`, reason: orders.map(order => order.remark).filter(Boolean).join('；'),
    actorId: actor.id, actorName: actor.name, actorRole: actor.role, relatedPurchaseOrderNo: orders[0]?.purchaseOrderNo } })
  const saved = committed.values.slice(0, orders.length) as PmsProductPurchaseOrder[]
  publishPmsProductPurchaseOrders(saved)
  return saved
}

export async function createPmsProductPurchaseOrders(inputs: PmsCreatePurchaseOrderInput[], actor: { id: string; name: string; role: PmsActorRole }, operationId = `ppo-${crypto.randomUUID()}`): Promise<PmsProductPurchaseOrder[]> {
  await hydratePmsProductPurchaseOrdersFromIdb()
  return commitPmsProductPurchaseOrders(preparePmsProductPurchaseOrders(inputs, actor, operationId), actor, '创建采购单', operationId, [], pmsCoreOperationSignature('创建采购单', inputs))
}

export interface PmsPurchaseOrderPatch {
  supplierName?: string; warehouse?: string; expectedDeliveryDate?: string; remark?: string; purchaser?: string
  isUrgent?: PmsYesNo; isFirstOrder?: PmsYesNo; productionArea?: PmsPurchaseRegion | ''
  purchaseAddress?: string; saleType?: string; recipientName?: string; partnerName?: string
  purchaseType?: PmsProductPurchaseType; currency?: 'CNY' | 'IDR' | 'USD'; exchangeRate?: number
  qualityResult?: string; templateConfirmed?: boolean; barcodeQuantities?: Record<string, number>
  expressRecords?: PmsProductExpress[]
  lines?: Array<{ lineId: string; qty: number; actualPrice: number; weight?: number }>
}

export function preparePmsProductPurchaseOrderPatch(purchaseOrderNo: string, patch: PmsPurchaseOrderPatch, actorName: string, operationId: string, allowConfirmed = false, expectedVersion?: number): PmsProductPurchaseOrder {
  const old = getPmsProductPurchaseOrder(purchaseOrderNo)
  if (!old) throw new PmsDomainError('PPO_NOT_FOUND', `商品采购单 ${purchaseOrderNo} 不存在`)
  if (!allowConfirmed && !EDITABLE_STATUSES.includes(old.status)) throw new PmsDomainError('PPO_STATUS_BLOCKED', `${old.status}状态不能编辑采购数量与价格`)
  assertPmsCoreDraftVersion(old, expectedVersion)
  const next = structuredClone(old)
  const { lines, ...fields } = patch
  Object.assign(next, fields)
  if (!next.supplierName.trim() || !next.warehouse.trim() || !(next.purchaser || next.creator).trim()) throw new PmsDomainError('PPO_REQUIRED', '供应商、仓库和采购员不能为空')
  if (next.exchangeRate !== undefined && (!Number.isFinite(next.exchangeRate) || next.exchangeRate <= 0)) throw new PmsDomainError('PPO_EXCHANGE_INVALID', '汇率必须大于0')
  if ((next.purchaseType === '做货' || next.purchaseType === '烫画') && !next.productionArea) throw new PmsDomainError('PPO_PRODUCTION_AREA_REQUIRED', '请选择做货区域')
  for (const linePatch of lines ?? []) {
    const line = next.lines.find(item => item.lineId === linePatch.lineId)
    if (!line) throw new PmsDomainError('PPO_LINE_NOT_FOUND', '采购明细不存在')
    validateLineInput({ ...line, ...linePatch }, 0)
    if (linePatch.qty < line.deliveredQty) throw new PmsDomainError('PPO_QTY_BELOW_DELIVERED', `${line.sku}采购数量不能小于已到货数量`)
    Object.assign(line, linePatch)
  }
  next.version += 1
  addPurchaseHistory(next, '编辑采购单', actorName, patch.remark ?? '', operationId)
  return next
}

export async function updatePmsProductPurchaseOrder(purchaseOrderNo: string, patch: PmsPurchaseOrderPatch, actor: { id: string; name: string; role: PmsActorRole }, operationId = `edit-${crypto.randomUUID()}`, expectedVersion?: number): Promise<PmsProductPurchaseOrder> {
  await hydratePmsProductPurchaseOrdersFromIdb()
  return (await commitPmsProductPurchaseOrders([preparePmsProductPurchaseOrderPatch(purchaseOrderNo, patch, actor.name, operationId, false, expectedVersion)], actor, '编辑采购单', operationId, [], pmsCoreOperationSignature('编辑采购单', { purchaseOrderNo, patch })))[0]
}

export async function advancePmsProductPurchaseOrderStatus(purchaseOrderNo: string, nextStatus: PmsProductPurchaseOrderStatus, actor: { id: string; name: string; role: PmsActorRole }, operationId = `status-${crypto.randomUUID()}`): Promise<PmsProductPurchaseOrder> {
  await hydratePmsProductPurchaseOrdersFromIdb()
  const old = getPmsProductPurchaseOrder(purchaseOrderNo)
  if (!old) throw new PmsDomainError('PPO_NOT_FOUND', '采购单不存在')
  if (!STATUS_TRANSITIONS[old.status].includes(nextStatus)) throw new PmsDomainError('PPO_TRANSITION_BLOCKED', `${old.status}不能直接变为${nextStatus}`)
  const next = structuredClone(old)
  next.status = nextStatus; next.version += 1
  addPurchaseHistory(next, '状态变更', actor.name, `${old.status}→${nextStatus}`, operationId)
  return (await commitPmsProductPurchaseOrders([next], actor, '状态变更', operationId, [], pmsCoreOperationSignature('状态变更', { purchaseOrderNo, nextStatus })))[0]
}

export function preparePmsProductPurchaseOrderClose(purchaseOrderNo:string,reason:string,actor:{name:string},operationId:string):PmsProductPurchaseOrder {
  const old = getPmsProductPurchaseOrder(purchaseOrderNo)
  if (!old) throw new PmsDomainError('PPO_NOT_FOUND', '采购单不存在')
  if (!reason.trim()) throw new PmsDomainError('PPO_REASON_REQUIRED', '请填写关闭原因')
  if (old.status === '已完成' || old.status === '已关闭') throw new PmsDomainError('PPO_CLOSED_BLOCKED', `${old.status}采购单不能关闭`)
  const next = structuredClone(old); next.status = '已关闭'; next.closedReason = reason.trim(); next.version += 1
  addPurchaseHistory(next, '关闭采购单', actor.name, reason.trim(), operationId)
  return next
}
export async function closePmsProductPurchaseOrder(purchaseOrderNo:string,reason:string,actor:{id:string;name:string;role:PmsActorRole},operationId=`close-${crypto.randomUUID()}`):Promise<PmsProductPurchaseOrder>{
  await hydratePmsProductPurchaseOrdersFromIdb()
  const next=preparePmsProductPurchaseOrderClose(purchaseOrderNo,reason,actor,operationId)
  return (await commitPmsProductPurchaseOrders([next],actor,'关闭采购单',operationId,[],pmsCoreOperationSignature('关闭采购单',{purchaseOrderNo,reason})))[0]
}

export interface PmsGenerateRequirementResult { purchaseOrderNo: string; requirementNo: string; lines: PmsMaterialRequirementLine[] }

/** Explicit refresh commits the purchase snapshot; ordinary reads never perform this action. */
export async function syncPmsProductPurchaseOrderBomMatched(purchaseOrderNo: string): Promise<void> {
  await hydratePmsProductPurchaseOrdersFromIdb()
  const old = getPmsProductPurchaseOrder(purchaseOrderNo)
  if (!old) throw new PmsDomainError('PPO_NOT_FOUND', '采购单不存在')
  const next = structuredClone(old)
  const matched = Boolean(getPublishedPurchaseMaterials(old.spu))
  for (const line of next.lines) if (line.needBom) { line.bomMatched = matched; line.bomStatus = matched ? '已匹配' : '未匹配' }
  await pmsCommitRecords([{ store: PMS_STORES.pmsProductPurchaseOrders, value: next }])
  publishPmsProductPurchaseOrders([next])
}

export function checkPmsGenerateMaterialRequirement(purchaseOrderNo: string): { ok: boolean; reason: string } {
  const order = getPmsProductPurchaseOrder(purchaseOrderNo)
  if (!order) return { ok: false, reason: '采购单不存在' }
  if (order.purchaseType !== '做货' && order.purchaseType !== '烫画') return { ok: false, reason: '只有做货或烫画采购能生成面辅料需求' }
  if (order.status === '草稿' || order.status === '已关闭') return { ok: false, reason: `${order.status}采购单不能生成需求` }
  if (!getPublishedPurchaseMaterials(order.spu)) return { ok: false, reason: '该款没有可用的已发布技术包用料，请先在商品中心完善' }
  if (order.lines.every(line => !line.needBom || line.materialStatus !== '未生成')) return { ok: false, reason: '面辅料需求已经生成，不能重复生成' }
  return { ok: true, reason: '' }
}

export async function generatePmsMaterialRequirement(purchaseOrderNo: string, actor: { id: string; name: string; role: PmsActorRole }, operationId = `material-${crypto.randomUUID()}`): Promise<PmsGenerateRequirementResult> {
  await hydratePmsProductPurchaseOrdersFromIdb()
  await hydratePmsMaterialPurchaseOrdersFromIdb()
  const check = checkPmsGenerateMaterialRequirement(purchaseOrderNo)
  if (!check.ok) throw new PmsDomainError('PPO_REQUIREMENT_BLOCKED', check.reason)
  const order = structuredClone(getPmsProductPurchaseOrder(purchaseOrderNo)!)
  const requirement = preparePmsMaterialRequirementFromOrder(order, operationId)
  for (const line of order.lines) if (line.needBom) { line.materialStatus = '已生成'; line.bomMatched = true; line.bomStatus = '已匹配' }
  addPurchaseHistory(order, '生成面辅料需求', actor.name, requirement.requirementNo, operationId)
  await commitPmsProductPurchaseOrders([order], actor, '生成面辅料需求', operationId, [{ store: PMS_STORES.pmsMaterialRequirements, value: requirement }], pmsCoreOperationSignature('生成面辅料需求', { purchaseOrderNo }))
  publishPmsMaterialRequirements([requirement])
  return { purchaseOrderNo, requirementNo: requirement.requirementNo, lines: requirement.lines }
}

export function listPmsPpoLogs(purchaseOrderNo: string): PmsOperationLog[] {
  const stored = listPmsLogs('product-purchase-order', purchaseOrderNo)
  const history = getPmsProductPurchaseOrder(purchaseOrderNo)?.operationHistory ?? []
  const reflected: PmsOperationLog[] = history.map(entry => ({ id: entry.actionId, objectType: 'product-purchase-order', objectId: purchaseOrderNo, action: entry.action, actorId: entry.actorName, actorName: entry.actorName, actorRole: '采购员', beforeValue: '', afterValue: '', reason: entry.remark, occurredAt: entry.occurredAt, timeZone: 'Asia/Jakarta', source: 'PMS', relatedPurchaseOrderNo: purchaseOrderNo }))
  return [...reflected, ...stored.filter(log => !history.some(entry => entry.actionId === log.id))]
}

export async function markPmsProductPurchaseOrderMaterialPushed(purchaseOrderNo: string): Promise<void> {
  await hydratePmsProductPurchaseOrdersFromIdb()
  const old = getPmsProductPurchaseOrder(purchaseOrderNo)
  if (!old) throw new PmsDomainError('PPO_NOT_FOUND', '采购单不存在')
  const next = structuredClone(old)
  for (const line of next.lines) if (line.needBom && line.materialStatus === '已生成') line.materialStatus = '已下推'
  await pmsCommitRecords([{ store: PMS_STORES.pmsProductPurchaseOrders, value: next }])
  publishPmsProductPurchaseOrders([next])
}

export type PmsPurchaseLocalAction = '审核采购'|'驳回采购'|'设置采购员'|'修改售卖类型'|'更改采购类型'|'采购备注'|'完善快递信息'|'确认模板'|'开启入库'|'样衣质检'|'手动出库'|'运单入库'|'复制采购单'|'现货采购'|'样衣转做货'|'拆分采购单'|'合并采购单'|'组合生产采购单'
export interface PmsPurchaseActionFields { remark?: string; purchaser?: string; saleType?: string; purchaseType?: PmsProductPurchaseType; carrier?: string; trackingNo?: string; shippedAt?: string; weight?: number; skuQty?: Record<string, number> }
export async function performPmsProductPurchaseAction(orderNos: string[], action: PmsPurchaseLocalAction, fields: PmsPurchaseActionFields, actor: {id:string;name:string;role:PmsActorRole}, operationId: string, expectedVersions?: Record<string, number>): Promise<PmsProductPurchaseOrder[]> {
  await hydratePmsProductPurchaseOrdersFromIdb()
  await hydratePmsProductStockBalancesFromIdb()
  const balances=new Map<string,PmsProductStockBalance>()
  const originals=[...new Set(orderNos)].map(no=>{const row=getPmsProductPurchaseOrder(no);if(!row)throw new PmsDomainError('PPO_NOT_FOUND','采购单不存在');assertPmsCoreDraftVersion(row,expectedVersions?.[no]);return row})
  if(!originals.length)throw new PmsDomainError('PPO_EMPTY','请先选择采购单')
  const rows=originals.map(row=>structuredClone(row)),created:PmsProductPurchaseOrder[]=[]
  const copying=['复制采购单','现货采购','样衣转做货','拆分采购单','合并采购单'].includes(action)
  for(const row of rows){
    if(row.status==='已关闭'&&!copying)throw new PmsDomainError('PPO_STATUS_BLOCKED',`${row.purchaseOrderNo}已关闭，不能${action}`)
    if(action==='审核采购') {if(!['待采购','待确认','草稿'].includes(row.status))throw new PmsDomainError('PPO_STATUS_BLOCKED',`${row.purchaseOrderNo}当前状态不可审核`);row.status='已确认';row.reviewOutcome='已通过';row.auditedAt=new Date().toISOString()}
    else if(action==='驳回采购'){if(!fields.remark?.trim())throw new PmsDomainError('PPO_REASON_REQUIRED','请填写驳回原因');if(['已入库','已完成'].includes(row.status))throw new PmsDomainError('PPO_STATUS_BLOCKED','已入库或完成采购单不能驳回');row.status='已关闭';row.reviewOutcome=originals.find(old=>old.purchaseOrderNo===row.purchaseOrderNo)?.status==='已确认'?'采购驳回':'审核驳回';row.closedReason=fields.remark.trim()}
    else if(action==='设置采购员'){if(!fields.purchaser?.trim())throw new PmsDomainError('PPO_REQUIRED','请填写采购员');row.purchaser=fields.purchaser.trim()}
    else if(action==='修改售卖类型'){if(!fields.saleType)throw new PmsDomainError('PPO_REQUIRED','请选择售卖类型');row.saleType=fields.saleType}
    else if(action==='更改采购类型'){if(!fields.purchaseType)throw new PmsDomainError('PPO_REQUIRED','请选择采购类型');if(row.lines.some(line=>line.materialStatus==='已生成'||line.materialStatus==='已下推'))throw new PmsDomainError('PPO_MATERIAL_EXISTS','已生成用料需求，不能改变采购类型');row.purchaseType=fields.purchaseType;for(const line of row.lines){line.needBom=['做货','烫画'].includes(row.purchaseType);line.materialStatus=line.needBom?'未生成':'不需要'}}
    else if(action==='采购备注')row.remark=fields.remark?.trim()??''
    else if(action==='完善快递信息'){if(!fields.carrier?.trim()||!fields.trackingNo?.trim()||!fields.shippedAt)throw new PmsDomainError('PPO_EXPRESS_REQUIRED','请填写快递公司、运单号和发货时间');if(row.expressRecords?.some(item=>item.trackingNo===fields.trackingNo!.trim()))throw new PmsDomainError('PPO_EXPRESS_DUPLICATE','运单号已登记');row.expressRecords=[...(row.expressRecords??[]),{carrier:fields.carrier.trim(),trackingNo:fields.trackingNo.trim(),shippedAt:fields.shippedAt,receivedAt:'',remark:fields.remark??''}]}
    else if(action==='确认模板'){if(!getPublishedPurchaseMaterials(row.spu))throw new PmsDomainError('PPO_TEMPLATE_MISSING',`${row.spu}没有已发布技术包`);row.templateConfirmed=true}
    else if(action==='开启入库'){if(!['已入库','已完成'].includes(row.status))throw new PmsDomainError('PPO_STATUS_BLOCKED','仅已结束入库的采购单可重新开启');row.status='已确认';row.inboundReopened=true}
    else if(action==='样衣质检'||action==='运单入库'||action==='手动出库'){
      if(action==='样衣质检'&&!['样衣','达人寄样'].includes(row.purchaseType))throw new PmsDomainError('PPO_TYPE_BLOCKED','样衣质检只适用于样衣或达人寄样采购')
      if(action!=='手动出库'&&['草稿','待采购','待确认'].includes(row.status))throw new PmsDomainError('PPO_STATUS_BLOCKED','采购单须先通过审核再入库')
      let total=0
      for(const line of row.lines){const qty=fields.skuQty?.[line.sku]??0;if(!Number.isInteger(qty)||qty<0)throw new PmsDomainError('PPO_QTY_INVALID','实际数量必须为非负整数');total+=qty;if(action==='手动出库'){const issued=(row.outboundRecords??[]).filter(entry=>entry.sku===line.sku).reduce((sum,entry)=>sum+entry.qty,0);if(qty>line.deliveredQty-issued)throw new PmsDomainError('PPO_OUTBOUND_OVER','出库数量不能超过已入库可出库数量');if(qty)row.outboundRecords=[...(row.outboundRecords??[]),{sku:line.sku,qty,occurredAt:new Date().toISOString(),actorName:actor.name,remark:fields.remark??''}]}else{if(qty>line.qty-line.deliveredQty)throw new PmsDomainError('PPO_INBOUND_OVER','入库数量不能超过待入库数量');line.deliveredQty+=qty;if(fields.weight!==undefined){if(!Number.isFinite(fields.weight)||fields.weight<0)throw new PmsDomainError('PPO_WEIGHT_INVALID','重量不能小于0');line.weight=fields.weight}}}
      for(const line of row.lines){const qty=fields.skuQty?.[line.sku]??0;if(!qty)continue;const oldBalance=getPmsProductStockBalance(line.sku,row.warehouse),balance=balances.get(oldBalance.id)||structuredClone(oldBalance);if(action==='手动出库'&&qty>balance.qty)throw new PmsDomainError('PPO_STOCK_OVER','出库数量不能超过此仓库本地可用库存');balance.qty+=action==='手动出库'?-qty:qty;balance.updatedAt=new Date().toISOString();balance.sourcePurchaseOrderNos=[...new Set([...balance.sourcePurchaseOrderNos,row.purchaseOrderNo])];balances.set(balance.id,balance);row.stockMovements=[...(row.stockMovements||[]),{operationId,sku:line.sku,warehouse:row.warehouse,direction:action==='手动出库'?'出库':'入库',qty,occurredAt:balance.updatedAt,actorName:actor.name}]}
      if(!total)throw new PmsDomainError('PPO_QTY_EMPTY','请填写本次实际数量')
      if(action!=='手动出库'){row.status=row.lines.every(line=>line.deliveredQty===line.qty)?'已入库':'已确认';row.inboundBy=actor.name;row.receivedAt=new Date().toISOString();if(action==='样衣质检')row.qualityResult=fields.remark?.trim()||'已质检';for(const express of row.expressRecords??[])if(!express.receivedAt)express.receivedAt=row.receivedAt}
    }
    if(!copying){row.version+=1;addPurchaseHistory(row,action,actor.name,fields.remark??'',operationId)}
  }
  const makeCopy=(source:PmsProductPurchaseOrder,index:number,type?:PmsProductPurchaseType)=>{const copy=structuredClone(source);copy.purchaseOrderNo=`CG-2026-${stablePurchaseSuffix(`${operationId}:copy:${index}`)}`;copy.status='待采购';copy.version=1;copy._pmsBaseVersion=0;copy.purchaseType=type??source.purchaseType;copy.sourceOrderNos=[source.purchaseOrderNo];copy.closedReason='';copy.reviewOutcome='';copy.qualityResult='';copy.auditedAt='';copy.inboundReopened=false;copy.mergedInto='';copy.aftersaleIds=[];copy.expressRecords=[];copy.outboundRecords=[];copy.stockMovements=[];copy.receivedAt='';copy.inboundBy='';copy.operationHistory=[];copy.orderedAt=new Date().toISOString();copy.lines=copy.lines.map((line,i)=>({...line,lineId:`${copy.purchaseOrderNo}-L${i+1}`,deliveredQty:0,needBom:['做货','烫画'].includes(copy.purchaseType),materialStatus:['做货','烫画'].includes(copy.purchaseType)?'未生成':'不需要'}));addPurchaseHistory(copy,action,actor.name,source.purchaseOrderNo,operationId);return copy}
  if(['复制采购单','现货采购','样衣转做货'].includes(action))rows.forEach((row,index)=>created.push(makeCopy(row,index,action==='现货采购'?'成衣':action==='样衣转做货'?'做货':undefined)))
  if(action==='拆分采购单'){
    if(rows.length!==1||!EDITABLE_STATUSES.includes(rows[0].status))throw new PmsDomainError('PPO_SPLIT_STATE','只可拆分一张未审核采购单')
    const old=rows[0],copy=makeCopy(old,0);let total=0
    for(const line of old.lines){const qty=fields.skuQty?.[line.sku]??0;if(!Number.isInteger(qty)||qty<0||qty>line.qty-line.deliveredQty)throw new PmsDomainError('PPO_SPLIT_QTY','拆分数量不得超过未入库数量');total+=qty;line.qty-=qty;copy.lines.find(item=>item.sku===line.sku)!.qty=qty}
    if(!total||old.lines.every(line=>line.qty===0))throw new PmsDomainError('PPO_SPLIT_EMPTY','拆分后原单和新单都须保留采购数量')
    old.lines=old.lines.filter(line=>line.qty>0);copy.lines=copy.lines.filter(line=>line.qty>0);old.version+=1;addPurchaseHistory(old,action,actor.name,copy.purchaseOrderNo,operationId);created.push(copy)
  }
  if(action==='合并采购单'){
    const first=rows[0];if(rows.length<2||rows.some(row=>!EDITABLE_STATUSES.includes(row.status)||row.spu!==first.spu||row.purchaseType!==first.purchaseType||row.supplierName!==first.supplierName||row.warehouse!==first.warehouse||row.lines.some(line=>line.deliveredQty>0)))throw new PmsDomainError('PPO_MERGE_INCOMPATIBLE','请选择至少两张未审核、未入库且同款、同采购类型、同供应商和同仓库的采购单')
    if(rows.some(row=>(row.currency||'CNY')!==(first.currency||'CNY')||(row.exchangeRate??1)!==(first.exchangeRate??1)))throw new PmsDomainError('PPO_MERGE_CURRENCY','采购单币种或汇率不一致，不能合并；请分别保留原单')
    const copy=makeCopy(first,0);copy.sourceOrderNos=rows.map(row=>row.purchaseOrderNo);const lines=new Map<string,PmsProductPurchaseOrderLine>();for(const row of rows)for(const line of row.lines){const prior=lines.get(line.sku);if(prior){if(prior.actualPrice!==line.actualPrice)throw new PmsDomainError('PPO_MERGE_PRICE','相同SKU采购单价不一致，不能合并');prior.qty+=line.qty}else lines.set(line.sku,structuredClone(line))}copy.lines=[...lines.values()].map((line,index)=>({...line,lineId:`${copy.purchaseOrderNo}-L${index+1}`,deliveredQty:0}));created.push(copy);for(const row of rows){row.status='已关闭';row.mergedInto=copy.purchaseOrderNo;row.closedReason=`已合并至 ${copy.purchaseOrderNo}`;row.version+=1;addPurchaseHistory(row,action,actor.name,copy.purchaseOrderNo,operationId)}
  }
  if(action==='组合生产采购单'){if(rows.length<2||rows.some(row=>row.purchaseType!=='做货'||!EDITABLE_STATUSES.includes(row.status)))throw new PmsDomainError('PPO_COMBINE_STATE','请选择至少两张未审核的做货采购单');const group=`ZHC-${stablePurchaseSuffix(operationId)}`;for(const row of rows)row.combinedOrderNo=group}
  await hydratePmsKolStock()
  const kolEntries=new Map<string,number>()
  if(action==='样衣质检'||action==='运单入库'||action==='手动出库')for(const row of rows)if(['样衣','达人寄样'].includes(row.purchaseType))for(const line of row.lines){const quantity=fields.skuQty?.[line.sku]??0;if(quantity>0)kolEntries.set(line.sku,(kolEntries.get(line.sku)??0)+quantity)}
  const kolInput=[...kolEntries].map(([sku,quantity])=>({sku,quantity}))
  const kolStock=kolEntries.size?(action==='手动出库'?preparePmsKolStockIssue(kolInput):preparePmsKolStockReceipt(kolInput)):[]
  const kolLogs=kolEntries.size&&action==='手动出库'?preparePmsKolStockIssueLogs(kolInput,operationId):[]
  const candidates=copying&&!['拆分采购单','合并采购单'].includes(action)?created:[...rows,...created]
  const result=await commitPmsProductPurchaseOrders(candidates,actor,action,operationId,[...[...balances.values()].map(value=>({store:PMS_STORES.pmsProductStockBalances,value})),...kolStock.map(value=>({store:PMS_STORES.pmsKolStock,value})),...kolLogs.map(value=>({store:PMS_STORES.pmsKolLockLogs,value}))],pmsCoreOperationSignature(action,{orderNos:[...new Set(orderNos)],fields}))
  publishPmsKolStock(kolStock)
  appendKolLockRows(kolLogs)
  for(const balance of balances.values())productStockBalances.set(balance.id,balance)
  return result
}
export function pmsProductPurchaseDisplayStatus(order:PmsProductPurchaseOrder):string {
  if(order.mergedInto)return '合并已删除'
  if(order.reviewOutcome==='采购驳回'||order.reviewOutcome==='审核驳回')return order.reviewOutcome
  if(order.status==='草稿')return '草稿'
  if(order.status==='待采购')return '等待采购'
  if(order.status==='待确认')return '待审核'
  if(order.status==='已确认')return order.lines.some(line=>line.deliveredQty>0)?'部分入库':'采购中'
  if(order.status==='已发货')return '待发货'
  if(order.status==='已入库')return '全部入库'
  return order.status
}

export interface PmsProductStockBalance { id:string; sku:string; warehouse:string; qty:number; sourcePurchaseOrderNos:string[]; updatedAt:string; _pmsBaseVersion?:number }
const productStockBalances=new Map<string,PmsProductStockBalance>()
let productStockHydration:Promise<void>|null=null
export function hydratePmsProductStockBalancesFromIdb():Promise<void>{return productStockHydration??=pmsAll<PmsProductStockBalance>(PMS_STORES.pmsProductStockBalances).then(rows=>rows.forEach(row=>productStockBalances.set(row.id,row))).catch(error=>{productStockHydration=null;throw error})}
export function getPmsProductStockBalance(sku:string,warehouse:string):PmsProductStockBalance{
 const id=`${sku}@${warehouse}`,saved=productStockBalances.get(id);if(saved)return saved
 const orders=listPmsProductPurchaseOrders().filter(order=>order.warehouse===warehouse&&order.lines.some(line=>line.sku===sku))
 const qty=orders.reduce((sum,order)=>sum+order.lines.filter(line=>line.sku===sku).reduce((value,line)=>value+line.deliveredQty,0)-(order.outboundRecords||[]).filter(entry=>entry.sku===sku).reduce((value,entry)=>value+entry.qty,0),0)
 return{id,sku,warehouse,qty:Math.max(0,qty),sourcePurchaseOrderNos:orders.filter(order=>order.lines.some(line=>line.sku===sku&&line.deliveredQty>0)).map(order=>order.purchaseOrderNo),updatedAt:'',_pmsBaseVersion:0}
}

export function pmsProductPurchaseExportTable(orders:PmsProductPurchaseOrder[],skuDetail=false):{headers:string[];rows:Array<Array<string|number>>}{
  if(skuDetail)return{headers:['采购单','SPU','SKU','颜色','尺码','数量','币种','采购单价（原币）','汇率','已入库'],rows:orders.flatMap(order=>order.lines.map(line=>[order.purchaseOrderNo,order.spu,line.sku,line.color,line.size,line.qty,order.currency??'CNY',line.actualPrice,order.exchangeRate??'',line.deliveredQty]))}
  return{headers:['采购单','SPU','商品','类型','状态','供应商','采购员','数量','币种','采购金额（原币）','汇率'],rows:orders.map(order=>[order.purchaseOrderNo,order.spu,order.productName,order.purchaseType,pmsProductPurchaseDisplayStatus(order),order.supplierName,order.purchaser||order.creator,order.lines.reduce((sum,line)=>sum+line.qty,0),order.currency??'CNY',pmsProductPurchaseOrderAmount(order),order.exchangeRate??''])}
}
