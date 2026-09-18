import { getPmsBomTemplate } from './bom-templates.ts'
import { PMS_STYLE_IMAGES } from './images.ts'
import { appendPmsLog, listPmsLogs, PmsDomainError, roundPmsQty, type PmsActorRole, type PmsOperationLog } from './runtime.ts'
import { createPmsMaterialRequirementFromOrder, type PmsMaterialRequirementLine } from './material-requirements.ts'

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
  purchaseType: '做货' | '成衣' | '样衣'
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
  return orders.map((order, index) => ({
    ...order,
    productionArea: order.productionArea ?? order.area,
    purchaser: order.purchaser ?? (index % 2 === 0 ? '王采购' : '陈采购'),
    isUrgent: order.isUrgent ?? (index % 4 === 3 ? '是' : '否'),
    isFirstOrder: order.isFirstOrder ?? (index % 5 === 4 ? '是' : '否'),
    lines: order.lines.map((line, lineIndex) => ({
      ...line,
      bomNo: line.needBom ? `BOM-${order.spu}-${String(lineIndex + 1).padStart(2, '0')}` : '',
    })),
  }))
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
  purchaseType: '做货' | '成衣' | '样衣'
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

export function createPmsProductPurchaseOrders(
  inputs: PmsCreatePurchaseOrderInput[],
  actor: { id: string; name: string; role: PmsActorRole },
): PmsProductPurchaseOrder[] {
  if (inputs.length === 0) throw new PmsDomainError('PPO_EMPTY', '请至少选择一个款式生成采购单')
  const created: PmsProductPurchaseOrder[] = []
  inputs.forEach((input) => {
    if (!input.supplierName.trim()) throw new PmsDomainError('PPO_SUPPLIER_REQUIRED', `${input.productName} 未选择供应商`)
    if (!input.warehouse.trim()) throw new PmsDomainError('PPO_WAREHOUSE_REQUIRED', `${input.productName} 未选择目标仓库`)
    if (input.lines.length === 0) throw new PmsDomainError('PPO_LINE_EMPTY', `${input.productName} 没有可采购的 SKU`)
    const purchaser = input.purchaser === undefined ? actor.name.trim() : input.purchaser.trim()
    if (!purchaser) throw new PmsDomainError('PPO_PURCHASER_REQUIRED', `${input.productName} 未填写采购专员`)
    if (input.purchaseType === '做货' && input.productionArea === '') {
      throw new PmsDomainError('PPO_PRODUCTION_AREA_REQUIRED', `${input.productName} 的做货采购必须选择采购区域`)
    }
    const productionArea = input.productionArea === undefined || input.productionArea === '' ? input.area : input.productionArea
    const bomTemplate = getPmsBomTemplate(input.spu)
    const needBom = input.purchaseType === '做货'
    const bomMatched = bomTemplate?.status === '已发布'
    orderSequence += 1
    const purchaseOrderNo = `CG-2026-${String(orderSequence).padStart(4, '0')}`
    const order: PmsProductPurchaseOrder = {
      purchaseOrderNo,
      spu: input.spu,
      productName: input.productName,
      imageUrl: input.imageUrl,
      purchaseType: input.purchaseType,
      area: input.area,
      productionArea,
      supplierName: input.supplierName.trim(),
      warehouse: input.warehouse.trim(),
      status: '待采购',
      version: 1,
      lines: input.lines.map((line, index) => {
        const valid = validateLineInput(line, index)
        return buildLine(
          `L-${purchaseOrderNo.slice(-4)}-${String(index + 1).padStart(2, '0')}`,
          valid.sku,
          valid.color,
          valid.size,
          input.imageUrl,
          valid.standardPrice,
          valid.actualPrice,
          valid.qty,
          0,
          needBom,
          bomMatched,
          needBom ? '未生成' : '不需要',
          {
            bomNo: needBom ? valid.bomNo?.trim() || `BOM-${input.spu}-${String(index + 1).padStart(2, '0')}` : '',
            bomVersion: needBom ? valid.bomVersion?.trim() || 'V1.0' : '',
            bomStatus: needBom ? (bomMatched ? '已匹配' : '未匹配') : '未匹配',
            applicant: valid.applicant?.trim() || '张三',
            creator: valid.creator?.trim() || '李四',
            weight: valid.weight ?? 0.35,
          },
        )
      }),
      orderedAt: new Date().toISOString(),
      expectedDeliveryDate: input.expectedDeliveryDate,
      creator: actor.name,
      purchaser,
      isUrgent: input.isUrgent ?? '否',
      isFirstOrder: input.isFirstOrder ?? '否',
      remark: input.remark?.trim() ?? '',
      sourceSuggestionNo: input.sourceSuggestionNo ?? '',
      closedReason: '',
    }
    getRuntime().orders.unshift(order)
    created.push(order)
    appendPmsLog({
      objectType: 'product-purchase-order',
      objectId: purchaseOrderNo,
      action: '创建',
      beforeValue: '',
      afterValue: `${order.productName} · ${order.lines.length} 个 SKU · 待采购`,
      reason: input.sourceSuggestionNo ? `由采购建议 ${input.sourceSuggestionNo} 生成` : '手工创建',
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      relatedPurchaseOrderNo: purchaseOrderNo,
    })
  })
  return created
}

export function updatePmsProductPurchaseOrder(
  purchaseOrderNo: string,
  patch: {
    supplierName?: string
    warehouse?: string
    expectedDeliveryDate?: string
    remark?: string
    purchaser?: string
    isUrgent?: PmsYesNo
    isFirstOrder?: PmsYesNo
    productionArea?: PmsPurchaseRegion | ''
    lines?: Array<{ lineId: string; qty: number; actualPrice: number; weight?: number }>
  },
  actor: { id: string; name: string; role: PmsActorRole },
): PmsProductPurchaseOrder {
  const order = getPmsProductPurchaseOrder(purchaseOrderNo)
  if (!order) throw new PmsDomainError('PPO_NOT_FOUND', `商品采购单 ${purchaseOrderNo} 不存在`)
  if (!EDITABLE_STATUSES.includes(order.status)) {
    throw new PmsDomainError('PPO_STATUS_BLOCKED', `${order.status} 状态不可编辑，请先确认或关闭`)
  }
  if (patch.supplierName !== undefined) {
    if (!patch.supplierName.trim()) throw new PmsDomainError('PPO_SUPPLIER_REQUIRED', '供应商不能为空')
    order.supplierName = patch.supplierName.trim()
  }
  if (patch.warehouse !== undefined) order.warehouse = patch.warehouse.trim()
  if (patch.expectedDeliveryDate !== undefined) order.expectedDeliveryDate = patch.expectedDeliveryDate
  if (patch.remark !== undefined) order.remark = patch.remark.trim()
  if (patch.purchaser !== undefined) {
    const purchaser = patch.purchaser.trim()
    if (!purchaser) throw new PmsDomainError('PPO_PURCHASER_REQUIRED', '采购专员不能为空')
    order.purchaser = purchaser
  }
  if (patch.isUrgent !== undefined) order.isUrgent = patch.isUrgent
  if (patch.isFirstOrder !== undefined) order.isFirstOrder = patch.isFirstOrder
  if (patch.productionArea !== undefined) {
    if (order.purchaseType === '做货' && !patch.productionArea) {
      throw new PmsDomainError('PPO_PRODUCTION_AREA_REQUIRED', '做货采购必须选择采购区域')
    }
    if (patch.productionArea) order.productionArea = patch.productionArea
  }
  patch.lines?.forEach((linePatch) => {
    const line = order.lines.find((item) => item.lineId === linePatch.lineId)
    if (!line) throw new PmsDomainError('PPO_LINE_NOT_FOUND', `采购明细 ${linePatch.lineId} 不存在`)
    if (!Number.isInteger(linePatch.qty) || linePatch.qty <= 0) {
      throw new PmsDomainError('PPO_QTY_INVALID', `${line.sku} 的采购数量必须是大于 0 的整数`)
    }
    if (!Number.isFinite(linePatch.actualPrice) || linePatch.actualPrice < 0) {
      throw new PmsDomainError('PPO_PRICE_INVALID', `${line.sku} 的采购单价不能为负数`)
    }
    if (linePatch.weight !== undefined && (!Number.isFinite(linePatch.weight) || linePatch.weight < 0)) {
      throw new PmsDomainError('PPO_WEIGHT_INVALID', `${line.sku} 的单件重量必须是大于等于 0 的数字`)
    }
    line.qty = linePatch.qty
    line.actualPrice = linePatch.actualPrice
    if (linePatch.weight !== undefined) line.weight = linePatch.weight
  })
  order.version += 1
  appendPmsLog({
    objectType: 'product-purchase-order',
    objectId: purchaseOrderNo,
    action: '编辑',
    beforeValue: `V${order.version - 1}`,
    afterValue: `V${order.version}`,
    reason: patch.remark ?? '',
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    relatedPurchaseOrderNo: purchaseOrderNo,
  })
  return order
}

export function advancePmsProductPurchaseOrderStatus(
  purchaseOrderNo: string,
  nextStatus: PmsProductPurchaseOrderStatus,
  actor: { id: string; name: string; role: PmsActorRole },
): PmsProductPurchaseOrder {
  const order = getPmsProductPurchaseOrder(purchaseOrderNo)
  if (!order) throw new PmsDomainError('PPO_NOT_FOUND', `商品采购单 ${purchaseOrderNo} 不存在`)
  if (!STATUS_TRANSITIONS[order.status].includes(nextStatus)) {
    throw new PmsDomainError('PPO_TRANSITION_BLOCKED', `${order.status} 不能直接流转到 ${nextStatus}`)
  }
  const beforeStatus = order.status
  order.status = nextStatus
  appendPmsLog({
    objectType: 'product-purchase-order',
    objectId: purchaseOrderNo,
    action: '状态流转',
    beforeValue: beforeStatus,
    afterValue: nextStatus,
    reason: '',
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    relatedPurchaseOrderNo: purchaseOrderNo,
  })
  return order
}

export function closePmsProductPurchaseOrder(
  purchaseOrderNo: string,
  reason: string,
  actor: { id: string; name: string; role: PmsActorRole },
): PmsProductPurchaseOrder {
  const order = getPmsProductPurchaseOrder(purchaseOrderNo)
  if (!order) throw new PmsDomainError('PPO_NOT_FOUND', `商品采购单 ${purchaseOrderNo} 不存在`)
  if (!reason.trim()) throw new PmsDomainError('PPO_REASON_REQUIRED', '关闭采购单必须填写原因')
  if (order.status === '已完成') throw new PmsDomainError('PPO_COMPLETED_BLOCKED', '已完成的采购单不可关闭')
  if (order.status === '已关闭') throw new PmsDomainError('PPO_CLOSED_BLOCKED', '该采购单已经关闭')
  const beforeStatus = order.status
  order.status = '已关闭'
  order.closedReason = reason.trim()
  appendPmsLog({
    objectType: 'product-purchase-order',
    objectId: purchaseOrderNo,
    action: '关闭',
    beforeValue: beforeStatus,
    afterValue: '已关闭',
    reason: reason.trim(),
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    relatedPurchaseOrderNo: purchaseOrderNo,
    secondConfirmation: true,
  })
  return order
}

export interface PmsGenerateRequirementResult {
  purchaseOrderNo: string
  requirementNo: string
  lines: PmsMaterialRequirementLine[]
}

export function syncPmsProductPurchaseOrderBomMatched(purchaseOrderNo: string): void {
  const order = getPmsProductPurchaseOrder(purchaseOrderNo)
  if (!order) return
  const template = getPmsBomTemplate(order.spu)
  const matched = template?.status === '已发布'
  order.lines.forEach((line) => {
    if (line.needBom) {
      line.bomMatched = matched
      line.bomStatus = matched ? '已匹配' : '未匹配'
    }
  })
}

export function checkPmsGenerateMaterialRequirement(purchaseOrderNo: string): { ok: boolean; reason: string } {
  syncPmsProductPurchaseOrderBomMatched(purchaseOrderNo)
  const order = getPmsProductPurchaseOrder(purchaseOrderNo)
  if (!order) return { ok: false, reason: '采购单不存在' }
  if (order.purchaseType !== '做货') return { ok: false, reason: '只有“做货”类采购单才能生成面辅料需求' }
  if (order.status === '草稿') return { ok: false, reason: '草稿采购单不能生成面辅料需求，请先提交' }
  if (order.status === '已关闭') return { ok: false, reason: '已关闭采购单不能生成面辅料需求' }
  if (order.lines.some((line) => line.qty <= 0)) return { ok: false, reason: '存在数量为 0 的 SKU，请先补齐数量' }
  if (order.lines.some((line) => line.needBom && !line.bomMatched)) return { ok: false, reason: 'BOM 未匹配的 SKU 不能生成面辅料需求' }
  if (order.lines.every((line) => line.materialStatus !== '未生成')) return { ok: false, reason: '该采购单的面辅料需求已经生成，不能重复生成' }
  return { ok: true, reason: '' }
}

export function generatePmsMaterialRequirement(
  purchaseOrderNo: string,
  actor: { id: string; name: string; role: PmsActorRole },
): PmsGenerateRequirementResult {
  const check = checkPmsGenerateMaterialRequirement(purchaseOrderNo)
  if (!check.ok) throw new PmsDomainError('PPO_REQUIREMENT_BLOCKED', check.reason)
  const order = getPmsProductPurchaseOrder(purchaseOrderNo)
  if (!order) throw new PmsDomainError('PPO_NOT_FOUND', `商品采购单 ${purchaseOrderNo} 不存在`)
  syncPmsProductPurchaseOrderBomMatched(purchaseOrderNo)
  const result = createPmsMaterialRequirementFromOrder(order)
  order.lines.forEach((line) => {
    if (line.needBom) line.materialStatus = '已生成'
  })
  appendPmsLog({
    objectType: 'product-purchase-order',
    objectId: purchaseOrderNo,
    action: '生成面辅料需求',
    beforeValue: '未生成',
    afterValue: `已生成 ${result.requirementNo}`,
    reason: `按 BOM 拆解 ${result.lines.length} 条物料需求`,
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    relatedPurchaseOrderNo: purchaseOrderNo,
  })
  return { purchaseOrderNo, requirementNo: result.requirementNo, lines: result.lines }
}

export function listPmsPpoLogs(purchaseOrderNo: string): PmsOperationLog[] {
  return listPmsLogs('product-purchase-order', purchaseOrderNo)
}

export function markPmsProductPurchaseOrderMaterialPushed(purchaseOrderNo: string): void {
  const order = getPmsProductPurchaseOrder(purchaseOrderNo)
  if (!order) throw new PmsDomainError('PPO_NOT_FOUND', `商品采购单 ${purchaseOrderNo} 不存在`)
  order.lines.forEach((line) => {
    if (line.needBom && line.materialStatus === '已生成') line.materialStatus = '已下推'
  })
}
