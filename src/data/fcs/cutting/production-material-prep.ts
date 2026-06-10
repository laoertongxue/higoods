import {
  getBrowserLocalStorage,
  type BrowserStorageLike,
} from '../../browser-storage.ts'
import {
  listCuttingRuntimeEventsByType,
} from './cutting-runtime-event-ledger.ts'
import {
  getMaterialLedgerProjectionByCutOrder,
  listMaterialLedgerProjections,
  type MaterialLedgerProjection,
} from './material-ledger.ts'

export const PRODUCTION_MATERIAL_PREP_STORAGE_KEY = 'productionMaterialPrepWorkflow'

export type UpstreamSourceType = '中转仓库存' | '采购' | '印花' | '染色' | '无上游'
export type UpstreamProgressStatus = '已到仓可配' | '采购中' | '印花中' | '染色中' | '待到仓' | '无需跟进'
export type MaterialPrepMaterialType = '面料' | '辅料' | '纱线' | '包材'
export type MaterialPrepRecordStatus = 'DRAFT' | 'CONFIRMED' | 'REJECTED'
export type MaterialPrepOrderStatus =
  | 'NEED_PREP'
  | 'CONTINUE_PREP'
  | 'SHORTAGE_TRACKING'
  | 'REJECTED_REWORK'
  | 'READY'
  | 'CLOSED'
export type PickupOrderStatus =
  | 'NOT_PICKABLE'
  | 'WAIT_PICKUP'
  | 'PARTIAL_PICKABLE'
  | 'WAIT_CONTINUE_PICKUP'
  | 'REJECTED_WAIT_WLS'
  | 'PICKUP_DONE'
  | 'ACTUAL_CLOSED'

export interface MaterialPrepOrder {
  prepOrderId: string
  prepOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  styleNo: string
  styleName: string
  spu: string
  customerName: string
  planQty: number
  deliveryDate: string
  creatorName: string
  createdAt: string
  overallPrepStatus: MaterialPrepOrderStatus
  pickupStatus: PickupOrderStatus
  isClosed: boolean
  closedAt: string
  closeReason: string
}

export interface MaterialPrepLine {
  prepLineId: string
  prepOrderId: string
  cutOrderId: string
  cutOrderNo: string
  materialSku: string
  materialName: string
  materialType: MaterialPrepMaterialType
  materialImageUrl: string
  color: string
  spec: string
  unit: string
  requiredQty: number
  confirmedPrepQty: number
  pickedQty: number
  remainingNeedQty: number
  availableStockQty: number
  canPrepQty: number
  shortageQty: number
  linePrepStatus: '未配料' | '部分已配' | '已配齐' | '缺料跟进' | '被打回' | '按实关闭'
  upstreamSourceType: UpstreamSourceType
  upstreamProgressStatus: UpstreamProgressStatus
  expectedAvailableAt: string
  upstreamProgressDetail: string
}

export interface MaterialPrepRecordItem {
  prepRecordItemId: string
  prepLineId: string
  preparedQty: number
  rollCount: number
  warehouseArea: string
  locationCode: string
  sourceStockEventId: string
  remark: string
}

export interface MaterialPrepRecord {
  prepRecordId: string
  prepOrderId: string
  prepLineId: string
  batchNo: string
  preparedQty: number
  rollCount: number
  warehouseArea: string
  locationCode: string
  operatorName: string
  preparedAt: string
  recordStatus: MaterialPrepRecordStatus
  confirmedAt: string
  confirmedBy: string
  rejectedAt: string
  rejectedBy: string
  rejectReason: string
  sourceStockEventId: string
  remark: string
  items?: MaterialPrepRecordItem[]
}

export interface PickupRecord {
  pickupRecordId: string
  prepRecordId: string
  prepOrderId: string
  prepLineId: string
  productionOrderId: string
  pickedQty: number
  rollCount: number
  receiverName: string
  pickedAt: string
  warehouseArea: string
  locationCode: string
  waitProcessLedgerEventId: string
  differenceQty: number
  differenceReason: string
  pickupStatus: '已领料' | '差异领料' | '已入待加工仓'
  remark: string
}

export interface PrepRejectRecord {
  rejectId: string
  prepRecordId: string
  prepOrderId: string
  prepLineId: string
  rejectReason: string
  rejectDetail: string
  rejectedBy: string
  rejectedAt: string
  beforeStatus: MaterialPrepRecordStatus
  afterStatus: MaterialPrepRecordStatus
}

export interface ProductionMaterialPrepWorkflowStore {
  prepRecords: MaterialPrepRecord[]
  pickupRecords: PickupRecord[]
  rejectRecords: PrepRejectRecord[]
  closedOrders: Array<{
    prepOrderId: string
    closedAt: string
    closeReason: string
    closedBy: string
  }>
}

export interface MaterialPrepSeedLine {
  prepLineId: string
  prepOrderId: string
  cutOrderId: string
  cutOrderNo: string
  materialSku: string
  materialName: string
  materialType?: MaterialPrepMaterialType
  materialImageUrl?: string
  color: string
  spec: string
  unit: string
  requiredQty: number
  availableStockQty: number
  upstreamSourceType: UpstreamSourceType
  upstreamProgressStatus: UpstreamProgressStatus
  expectedAvailableAt: string
  upstreamProgressDetail: string
}

export interface MaterialPrepSeedOrder {
  prepOrderId: string
  prepOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  styleNo: string
  styleName: string
  spu: string
  customerName: string
  planQty: number
  deliveryDate: string
  creatorName: string
  createdAt: string
  lines: MaterialPrepSeedLine[]
}

export interface MaterialPrepOrderProjection {
  order: MaterialPrepOrder
  lines: MaterialPrepLine[]
  prepRecords: MaterialPrepRecord[]
  pickupRecords: PickupRecord[]
  rejectRecords: PrepRejectRecord[]
  totalRequiredQty: number
  totalConfirmedPrepQty: number
  totalPickedQty: number
  totalAvailableToPickupQty: number
  totalShortageQty: number
  lineCount: number
  readyLineCount: number
  shortageLineCount: number
  canContinuePrepLineCount: number
  rejectedRecordCount: number
  earliestExpectedAvailableAt: string
  latestOperatorName: string
  latestOperatedAt: string
}

export interface PrepRecordPickupCandidate {
  prepRecordId: string
  prepRecordItemId: string
  prepOrderId: string
  prepOrderNo: string
  prepLineId: string
  cutOrderId: string
  cutOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  materialSku: string
  materialName: string
  materialType: MaterialPrepMaterialType
  materialImageUrl: string
  color: string
  unit: string
  preparedQty: number
  pickedQty: number
  availableToPickupQty: number
  rollCount: number
  warehouseArea: string
  locationCode: string
  orderStatus: MaterialPrepOrderStatus
  pickupStatus: PickupOrderStatus
}

export const materialPrepStatusLabelMap: Record<MaterialPrepOrderStatus, string> = {
  NEED_PREP: '待配料',
  CONTINUE_PREP: '可继续配料',
  SHORTAGE_TRACKING: '未配齐跟进',
  REJECTED_REWORK: '被打回待重配',
  READY: '已配齐',
  CLOSED: '已关闭',
}

export const pickupStatusLabelMap: Record<PickupOrderStatus, string> = {
  NOT_PICKABLE: '暂不可领',
  WAIT_PICKUP: '待领料',
  PARTIAL_PICKABLE: '可部分领料',
  WAIT_CONTINUE_PICKUP: '待继续领料',
  REJECTED_WAIT_WLS: '打回待仓库处理',
  PICKUP_DONE: '已领料完结',
  ACTUAL_CLOSED: '按实完结',
}

export const materialPrepWorkbenchTabs: Array<{ key: MaterialPrepOrderStatus; label: string }> = [
  { key: 'NEED_PREP', label: '待配料' },
  { key: 'CONTINUE_PREP', label: '可继续配料' },
  { key: 'SHORTAGE_TRACKING', label: '未配齐跟进' },
  { key: 'REJECTED_REWORK', label: '被打回待重配' },
  { key: 'READY', label: '已配齐' },
  { key: 'CLOSED', label: '已关闭' },
]

export const pickupWorkbenchTabs: Array<{ key: PickupOrderStatus; label: string }> = [
  { key: 'WAIT_PICKUP', label: '待领料' },
  { key: 'PARTIAL_PICKABLE', label: '可部分领料' },
  { key: 'WAIT_CONTINUE_PICKUP', label: '待继续领料' },
  { key: 'REJECTED_WAIT_WLS', label: '打回待仓库处理' },
  { key: 'PICKUP_DONE', label: '已领料完结' },
  { key: 'ACTUAL_CLOSED', label: '按实完结' },
]

const materialPrepTypeMinimums: Record<MaterialPrepMaterialType, number> = {
  面料: 3,
  辅料: 3,
  纱线: 1,
  包材: 1,
}

const materialPrepTypeColors: Record<MaterialPrepMaterialType, { bg: string; fg: string }> = {
  面料: { bg: '#dbeafe', fg: '#1d4ed8' },
  辅料: { bg: '#fef3c7', fg: '#92400e' },
  纱线: { bg: '#dcfce7', fg: '#166534' },
  包材: { bg: '#f3e8ff', fg: '#6b21a8' },
}

const standardMaterialTemplates: Record<MaterialPrepMaterialType, Array<{
  code: string
  name: string
  color: string
  spec: string
  unit: string
  qtyRatio: number
  sourceType: UpstreamSourceType
  progressStatus: UpstreamProgressStatus
  progressDetail: string
}>> = {
  面料: [
    { code: 'fabric-main', name: '主身面料', color: '按款色', spec: '150cm / 主面料', unit: '米', qtyRatio: 0.42, sourceType: '中转仓库存', progressStatus: '已到仓可配', progressDetail: '主面料按生产单 BOM 计算，库存到仓后优先配。' },
    { code: 'fabric-contrast', name: '拼接面料', color: '配色', spec: '150cm / 配色面料', unit: '米', qtyRatio: 0.18, sourceType: '印花', progressStatus: '印花中', progressDetail: '配色面料需等印花回中转仓后继续配料。' },
    { code: 'fabric-lining', name: '里布', color: '同色系', spec: '145cm / 里布', unit: '米', qtyRatio: 0.28, sourceType: '中转仓库存', progressStatus: '已到仓可配', progressDetail: '里布当前有部分库存，可安排补配。' },
  ],
  辅料: [
    { code: 'accessory-zipper', name: '拉链', color: '同色', spec: 'YKK 18cm / 条', unit: '条', qtyRatio: 1, sourceType: '采购', progressStatus: '采购中', progressDetail: '拉链采购单已下，未全部入中转仓。' },
    { code: 'accessory-button', name: '纽扣', color: '同色', spec: '18L / 粒', unit: '粒', qtyRatio: 4, sourceType: '中转仓库存', progressStatus: '已到仓可配', progressDetail: '纽扣已有库存，按生产单数量配料。' },
    { code: 'accessory-label', name: '主唛/洗水唛', color: '白底黑字', spec: '套标 / 套', unit: '套', qtyRatio: 1, sourceType: '采购', progressStatus: '待到仓', progressDetail: '主唛和洗水唛待供应商送仓。' },
  ],
  纱线: [
    { code: 'yarn-stitching', name: '缝纫线', color: '同色', spec: '40S/2 / 公斤', unit: '公斤', qtyRatio: 0.012, sourceType: '中转仓库存', progressStatus: '已到仓可配', progressDetail: '缝纫线按颜色配套，库存可先配。' },
  ],
  包材: [
    { code: 'packing-bag', name: '包装袋/吊牌', color: '透明/白卡', spec: '单件包装 / 套', unit: '套', qtyRatio: 1, sourceType: '采购', progressStatus: '采购中', progressDetail: '包装袋和吊牌采购中，到仓后补配。' },
  ],
}

function buildMaterialImageDataUri(type: MaterialPrepMaterialType, label: string): string {
  const colors = materialPrepTypeColors[type]
  const shortLabel = label.slice(0, 6)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="14" fill="${colors.bg}"/><circle cx="24" cy="24" r="10" fill="${colors.fg}" opacity="0.24"/><path d="M18 62 C34 42 48 76 78 50" fill="none" stroke="${colors.fg}" stroke-width="7" stroke-linecap="round" opacity="0.55"/><text x="48" y="86" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" font-weight="700" fill="${colors.fg}">${type}</text><text x="48" y="48" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" fill="${colors.fg}">${shortLabel}</text></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function inferMaterialType(line: Pick<MaterialPrepSeedLine, 'materialName' | 'spec' | 'materialSku'>): MaterialPrepMaterialType {
  const text = `${line.materialName} ${line.spec} ${line.materialSku}`
  if (text.includes('纱') || text.includes('线')) return '纱线'
  if (text.includes('包') || text.includes('吊牌') || text.includes('包装')) return '包材'
  if (text.includes('拉链') || text.includes('纽扣') || text.includes('唛') || text.includes('辅料')) return '辅料'
  return '面料'
}

function ensureLineImage(line: MaterialPrepSeedLine): string {
  return line.materialImageUrl || buildMaterialImageDataUri(line.materialType || inferMaterialType(line), line.materialName)
}

function buildGeneratedMaterialLine(
  order: MaterialPrepSeedOrder,
  type: MaterialPrepMaterialType,
  typeIndex: number,
): MaterialPrepSeedLine {
  const templates = standardMaterialTemplates[type]
  const template = templates[Math.min(typeIndex - 1, templates.length - 1)]
  const orderKey = order.productionOrderNo.toLowerCase()
  const requiredQty = Number(Math.max(order.planQty * template.qtyRatio, type === '纱线' ? 12 : 1).toFixed(2))
  const isReadyLike = order.prepOrderId === 'prep-order-po-202603-0001' || order.prepOrderId === 'prep-order-po-202603-0007'
  const isShortageDemo = order.prepOrderId === 'prep-order-po-202603-0102'
  const isClosedDemo = order.prepOrderId === 'prep-order-po-202603-0006'
  const availableStockQty = isReadyLike || isClosedDemo
    ? 0
    : isShortageDemo
      ? 0
      : type === '包材' || (type === '辅料' && typeIndex !== 2)
        ? 0
        : Math.round(requiredQty * 0.7)
  const progressStatus = isReadyLike
    ? '无需跟进'
    : isShortageDemo
      ? template.progressStatus
      : availableStockQty > 0
        ? '已到仓可配'
        : template.progressStatus
  const sourceType = isReadyLike
    ? '无上游'
    : availableStockQty > 0
      ? '中转仓库存'
      : template.sourceType
  return {
    prepLineId: `prep-line-${orderKey}-${template.code}`,
    prepOrderId: order.prepOrderId,
    cutOrderId: `cut-order:${orderKey}:${order.spu}:${template.code}:v1`,
    cutOrderNo: `CUT-${order.productionOrderNo.replace('PO-', '')}-${String(typeIndex).padStart(2, '0')}`,
    materialSku: `${order.spu}-bom-${template.code}`,
    materialName: template.name,
    materialType: type,
    materialImageUrl: buildMaterialImageDataUri(type, template.name),
    color: template.color === '按款色' ? order.styleName.replace(/[^\u4e00-\u9fa5A-Za-z0-9]/g, '').slice(0, 8) || '按款色' : template.color,
    spec: template.spec,
    unit: template.unit,
    requiredQty,
    availableStockQty,
    upstreamSourceType: sourceType,
    upstreamProgressStatus: progressStatus,
    expectedAvailableAt: progressStatus === '无需跟进' ? '' : progressStatus === '已到仓可配' ? '2026-03-16 15:30' : '2026-03-19 18:00',
    upstreamProgressDetail: progressStatus === '无需跟进'
      ? '已配齐，无需继续跟进上游。'
      : availableStockQty > 0
        ? `${template.name} 当前有 ${availableStockQty.toLocaleString('zh-CN')} ${template.unit} 可配。`
        : template.progressDetail,
  }
}

function expandSeedOrderMaterials(order: MaterialPrepSeedOrder): MaterialPrepSeedOrder {
  const existingLines = order.lines.map((line) => ({
    ...line,
    materialType: line.materialType || inferMaterialType(line),
    materialImageUrl: ensureLineImage(line),
  }))
  const lines = [...existingLines]
  ;(Object.keys(materialPrepTypeMinimums) as MaterialPrepMaterialType[]).forEach((type) => {
    const existingCount = lines.filter((line) => (line.materialType || inferMaterialType(line)) === type).length
    for (let index = existingCount + 1; index <= materialPrepTypeMinimums[type]; index += 1) {
      lines.push(buildGeneratedMaterialLine(order, type, index))
    }
  })
  return {
    ...order,
    lines,
  }
}

const baseMaterialPrepSeedOrders: MaterialPrepSeedOrder[] = [
  {
    prepOrderId: 'prep-order-po-202603-0004',
    prepOrderNo: 'WLS-PL-260302-004',
    productionOrderId: 'PO-202603-0004',
    productionOrderNo: 'PO-202603-0004',
    styleNo: 'TDV-010',
    styleName: '弹力斜纹裤',
    spu: 'tdv_demand_SPU_2024_010',
    customerName: 'HiGood 自营',
    planQty: 10500,
    deliveryDate: '2026-03-25',
    creatorName: '中转仓 周敏',
    createdAt: '2026-03-16 08:20',
    lines: [
      {
        prepLineId: 'prep-line-po-0004-main',
        prepOrderId: 'prep-order-po-202603-0004',
        cutOrderId: 'cut-order:po-202603-0004:tdv-demand-spu-2024-010-bom-black-stretch-twill:tdv-demand-spu-2024-010-pattern-main:v1-0:150cm',
        cutOrderNo: 'CUT-260302-004-01',
        materialSku: 'tdv_demand_SPU_2024_010-bom-black-stretch-twill',
        materialName: 'Black 弹力斜纹主面料',
        color: 'Black',
        spec: '150cm / 主面料',
        unit: '米',
        requiredQty: 4410,
        availableStockQty: 780,
        upstreamSourceType: '中转仓库存',
        upstreamProgressStatus: '已到仓可配',
        expectedAvailableAt: '2026-03-16 14:00',
        upstreamProgressDetail: '中转仓新增 780 米可配，优先安排首批配料。',
      },
    ],
  },
  {
    prepOrderId: 'prep-order-po-202603-0101',
    prepOrderNo: 'WLS-PL-260306-101',
    productionOrderId: 'PO-202603-0101',
    productionOrderNo: 'PO-202603-0101',
    styleNo: 'TDV-010',
    styleName: '弹力斜纹裤',
    spu: 'tdv_demand_SPU_2024_010',
    customerName: 'HiGood 自营',
    planQty: 3300,
    deliveryDate: '2026-03-22',
    creatorName: '中转仓 周敏',
    createdAt: '2026-03-16 08:32',
    lines: [
      {
        prepLineId: 'prep-line-po-0101-black',
        prepOrderId: 'prep-order-po-202603-0101',
        cutOrderId: 'cut-order:po-202603-0101:tdv-demand-spu-2024-010-bom-black-stretch-twill:tdv-demand-spu-2024-010-pattern-main:v1-0:150cm',
        cutOrderNo: 'CUT-260306-101-01',
        materialSku: 'tdv_demand_SPU_2024_010-bom-black-stretch-twill',
        materialName: 'Black 弹力斜纹主面料',
        color: 'Black',
        spec: '150cm / 主面料',
        unit: '米',
        requiredQty: 1386,
        availableStockQty: 300,
        upstreamSourceType: '中转仓库存',
        upstreamProgressStatus: '已到仓可配',
        expectedAvailableAt: '2026-03-16 15:30',
        upstreamProgressDetail: '此前已配 900 米，今日中转仓又到 300 米，可继续配料。',
      },
      {
        prepLineId: 'prep-line-po-0101-charcoal',
        prepOrderId: 'prep-order-po-202603-0101',
        cutOrderId: 'cut-order:po-202603-0101:tdv-demand-spu-2024-010-bom-charcoal-stretch-twill:tdv-demand-spu-2024-010-pattern-main:v1-0:150cm',
        cutOrderNo: 'CUT-260306-101-02',
        materialSku: 'tdv_demand_SPU_2024_010-bom-charcoal-stretch-twill',
        materialName: 'Charcoal 弹力斜纹主面料',
        color: 'Charcoal',
        spec: '150cm / 主面料',
        unit: '米',
        requiredQty: 1512,
        availableStockQty: 0,
        upstreamSourceType: '染色',
        upstreamProgressStatus: '染色中',
        expectedAvailableAt: '2026-03-18 18:00',
        upstreamProgressDetail: '染色缸 DYE-260316-08 已完成 60%，预计 3 月 18 日回中转仓。',
      },
    ],
  },
  {
    prepOrderId: 'prep-order-po-202603-0102',
    prepOrderNo: 'WLS-PL-260307-102',
    productionOrderId: 'PO-202603-0102',
    productionOrderNo: 'PO-202603-0102',
    styleNo: 'TDV-010',
    styleName: '弹力斜纹裤',
    spu: 'tdv_demand_SPU_2024_010',
    customerName: 'HiGood 自营',
    planQty: 3000,
    deliveryDate: '2026-03-21',
    creatorName: '中转仓 周敏',
    createdAt: '2026-03-16 09:00',
    lines: [
      {
        prepLineId: 'prep-line-po-0102-navy',
        prepOrderId: 'prep-order-po-202603-0102',
        cutOrderId: 'cut-order:po-202603-0102:tdv-demand-spu-2024-010-bom-navy-twill:tdv-demand-spu-2024-010-pattern-main:v1-0:150cm',
        cutOrderNo: 'CUT-260307-102-01',
        materialSku: 'tdv_demand_SPU_2024_010-bom-navy-twill',
        materialName: 'Navy 斜纹主面料',
        color: 'Navy',
        spec: '150cm / 主面料',
        unit: '米',
        requiredQty: 1260,
        availableStockQty: 0,
        upstreamSourceType: '印花',
        upstreamProgressStatus: '印花中',
        expectedAvailableAt: '2026-03-19 12:00',
        upstreamProgressDetail: '印花单 PR-260316-12 已排机，当前在印花中；未回中转仓前不可继续配。',
      },
      {
        prepLineId: 'prep-line-po-0102-khaki',
        prepOrderId: 'prep-order-po-202603-0102',
        cutOrderId: 'cut-order:po-202603-0102:tdv-demand-spu-2024-010-bom-khaki-canvas:tdv-demand-spu-2024-010-pattern-main:v1-0:150cm',
        cutOrderNo: 'CUT-260307-102-02',
        materialSku: 'tdv_demand_SPU_2024_010-bom-khaki-canvas',
        materialName: 'Khaki 帆布主面料',
        color: 'Khaki',
        spec: '150cm / 主面料',
        unit: '米',
        requiredQty: 1386,
        availableStockQty: 0,
        upstreamSourceType: '无上游',
        upstreamProgressStatus: '无需跟进',
        expectedAvailableAt: '',
        upstreamProgressDetail: '该行已配齐并领完，暂无后续配料动作。',
      },
    ],
  },
  {
    prepOrderId: 'prep-order-po-202603-0001',
    prepOrderNo: 'WLS-PL-260302-001',
    productionOrderId: 'PO-202603-0001',
    productionOrderNo: 'PO-202603-0001',
    styleNo: 'TDV-004',
    styleName: '纯色 T-shirt',
    spu: 'tdv_demand_SPU_2024_004',
    customerName: 'HiGood 自营',
    planQty: 15000,
    deliveryDate: '2026-03-20',
    creatorName: '中转仓 周敏',
    createdAt: '2026-03-15 14:40',
    lines: [
      {
        prepLineId: 'prep-line-po-0001-main',
        prepOrderId: 'prep-order-po-202603-0001',
        cutOrderId: 'cut-order:po-202603-0001:tdv-demand-spu-2024-004-bom-main:tdv-demand-spu-2024-004-pattern-main:v1-0:150cm',
        cutOrderNo: 'CUT-260302-001-01',
        materialSku: 'tdv_demand_SPU_2024_004-bom-main',
        materialName: '纯色 T-shirt 半成品',
        color: 'White',
        spec: '150cm / 主面料',
        unit: '米',
        requiredQty: 6300,
        availableStockQty: 0,
        upstreamSourceType: '无上游',
        upstreamProgressStatus: '无需跟进',
        expectedAvailableAt: '',
        upstreamProgressDetail: '已配齐并领料完结。',
      },
    ],
  },
  {
    prepOrderId: 'prep-order-po-202603-0002',
    prepOrderNo: 'WLS-PL-260303-002',
    productionOrderId: 'PO-202603-0002',
    productionOrderNo: 'PO-202603-0002',
    styleNo: 'TDV-005',
    styleName: '灰色连帽衫',
    spu: 'tdv_demand_SPU_2024_005',
    customerName: 'HiGood 自营',
    planQty: 7500,
    deliveryDate: '2026-03-24',
    creatorName: '中转仓 周敏',
    createdAt: '2026-03-16 10:10',
    lines: [
      {
        prepLineId: 'prep-line-po-0002-main',
        prepOrderId: 'prep-order-po-202603-0002',
        cutOrderId: 'cut-order:po-202603-0002:tdv-demand-spu-2024-005-bom-main:tdv-demand-spu-2024-005-pattern-main:v2-1:150cm',
        cutOrderNo: 'CUT-260303-002-01',
        materialSku: 'tdv_demand_SPU_2024_005-bom-main',
        materialName: '主面料',
        color: 'Grey',
        spec: '150cm / 主面料',
        unit: '米',
        requiredQty: 3150,
        availableStockQty: 3150,
        upstreamSourceType: '中转仓库存',
        upstreamProgressStatus: '已到仓可配',
        expectedAvailableAt: '2026-03-16 16:00',
        upstreamProgressDetail: '裁床领料端打回首批配料，仓库需复核批次与颜色。',
      },
    ],
  },
  {
    prepOrderId: 'prep-order-po-202603-0006',
    prepOrderNo: 'WLS-PL-260302-006',
    productionOrderId: 'PO-202603-0006',
    productionOrderNo: 'PO-202603-0006',
    styleNo: 'TDV-012',
    styleName: '米色毛织衫',
    spu: 'tdv_demand_SPU_2024_012',
    customerName: 'HiGood 自营',
    planQty: 1600,
    deliveryDate: '2026-03-26',
    creatorName: '中转仓 周敏',
    createdAt: '2026-03-16 11:10',
    lines: [
      {
        prepLineId: 'prep-line-po-0006-main',
        prepOrderId: 'prep-order-po-202603-0006',
        cutOrderId: 'cut-order:po-202603-0006:tdv-demand-spu-2024-012-bom-main:tdv-demand-spu-2024-012-pattern-main:v1-0:120cm',
        cutOrderNo: 'CUT-260302-006-01',
        materialSku: 'tdv_demand_SPU_2024_012-bom-main',
        materialName: '毛织用纱线',
        color: 'Beige',
        spec: '120cm / 主料',
        unit: '米',
        requiredQty: 672,
        availableStockQty: 0,
        upstreamSourceType: '采购',
        upstreamProgressStatus: '采购中',
        expectedAvailableAt: '2026-03-30 18:00',
        upstreamProgressDetail: '采购尾数取消，仓库关闭配料；裁床按已领数量完结。',
      },
    ],
  },
  {
    prepOrderId: 'prep-order-po-202603-0007',
    prepOrderNo: 'WLS-PL-260303-007',
    productionOrderId: 'PO-202603-0007',
    productionOrderNo: 'PO-202603-0007',
    styleNo: 'TDV-013',
    styleName: 'Navy 连衣裙',
    spu: 'tdv_demand_SPU_2024_013',
    customerName: 'HiGood 自营',
    planQty: 2400,
    deliveryDate: '2026-03-23',
    creatorName: '中转仓 林洁',
    createdAt: '2026-03-16 13:10',
    lines: [
      {
        prepLineId: 'prep-line-po-0007-main',
        prepOrderId: 'prep-order-po-202603-0007',
        cutOrderId: 'cut-order:po-202603-0007:tdv-demand-spu-2024-013-bom-main:tdv-demand-spu-2024-013-pattern-main:v1-5:150cm',
        cutOrderNo: 'CUT-260303-007-01',
        materialSku: 'tdv_demand_SPU_2024_013-bom-main',
        materialName: '主面料',
        color: 'Navy',
        spec: '150cm / 主面料',
        unit: '米',
        requiredQty: 1008,
        availableStockQty: 0,
        upstreamSourceType: '无上游',
        upstreamProgressStatus: '无需跟进',
        expectedAvailableAt: '',
        upstreamProgressDetail: '已配齐待裁床领取。',
      },
    ],
  },
]

const materialPrepSeedOrders = baseMaterialPrepSeedOrders.map(expandSeedOrderMaterials)

function buildLineRollCount(line: Pick<MaterialPrepSeedLine, 'requiredQty' | 'unit'>): number {
  if (line.unit === '米') return Math.max(Math.ceil(Number(line.requiredQty || 0) / 320), 1)
  if (line.unit === '公斤') return Math.max(Math.ceil(Number(line.requiredQty || 0) / 20), 1)
  return Math.max(Math.ceil(Number(line.requiredQty || 0) / 1000), 1)
}

function buildAutoPrepRecordsForCompletedOrders(explicitRecords: MaterialPrepRecord[]): MaterialPrepRecord[] {
  const completedPrepOrderIds = new Set(['prep-order-po-202603-0001', 'prep-order-po-202603-0007'])
  const explicitConfirmedLineIds = new Set(
    explicitRecords
      .filter((record) => completedPrepOrderIds.has(record.prepOrderId) && record.recordStatus === 'CONFIRMED')
      .flatMap((record) => getMaterialPrepRecordItems(record).map((item) => item.prepLineId)),
  )
  return materialPrepSeedOrders
    .filter((order) => completedPrepOrderIds.has(order.prepOrderId))
    .flatMap((order) =>
      order.lines
        .filter((line) => !explicitConfirmedLineIds.has(line.prepLineId))
        .map((line, index) => {
          const rollCount = buildLineRollCount(line)
          const recordId = `prep-rec-${order.productionOrderNo.toLowerCase()}-${line.materialType}-${index + 1}`
          return {
            prepRecordId: recordId,
            prepOrderId: order.prepOrderId,
            prepLineId: line.prepLineId,
            batchNo: `BATCH-${order.productionOrderNo.replace('PO-', '')}-${String(index + 2).padStart(2, '0')}`,
            preparedQty: line.requiredQty,
            rollCount,
            warehouseArea: '中转仓标准配料区',
            locationCode: `TR-STD-${String(index + 1).padStart(2, '0')}`,
            operatorName: order.creatorName,
            preparedAt: order.prepOrderId === 'prep-order-po-202603-0001' ? '2026-03-15 15:12' : '2026-03-16 13:28',
            recordStatus: 'CONFIRMED' as MaterialPrepRecordStatus,
            confirmedAt: order.prepOrderId === 'prep-order-po-202603-0001' ? '2026-03-15 15:18' : '2026-03-16 13:32',
            confirmedBy: order.creatorName,
            rejectedAt: '',
            rejectedBy: '',
            rejectReason: '',
            sourceStockEventId: `ledger:${order.productionOrderNo}:${line.materialSku}:auto-prep`,
            remark: '标准 BOM 补齐物料，整条配料记录已确认。',
            items: [
              {
                prepRecordItemId: `${recordId}:item:1`,
                prepLineId: line.prepLineId,
                preparedQty: line.requiredQty,
                rollCount,
                warehouseArea: '中转仓标准配料区',
                locationCode: `TR-STD-${String(index + 1).padStart(2, '0')}`,
                sourceStockEventId: `ledger:${order.productionOrderNo}:${line.materialSku}:auto-prep`,
                remark: '标准 BOM 物料明细，随整条配料记录确认。',
              },
            ],
          }
        }),
    )
}

const explicitSeedPrepRecords: MaterialPrepRecord[] = [
  {
    prepRecordId: 'prep-rec-po-0004-main-draft-001',
    prepOrderId: 'prep-order-po-202603-0004',
    prepLineId: 'prep-line-po-0004-main',
    batchNo: 'BATCH-BLK-260316-D01',
    preparedQty: 500,
    rollCount: 2,
    warehouseArea: '中转仓 A 区',
    locationCode: 'TR-A-021',
    operatorName: '中转仓 周敏',
    preparedAt: '2026-03-16 08:45',
    recordStatus: 'DRAFT',
    confirmedAt: '',
    confirmedBy: '',
    rejectedAt: '',
    rejectedBy: '',
    rejectReason: '',
    sourceStockEventId: 'ledger:cut-order:po-202603-0004:black:prep:draft:001',
    remark: '首批库存已点数，待复核门幅和卷标后确认。',
    items: [
      {
        prepRecordItemId: 'prep-item-po-0004-main-draft-001',
        prepLineId: 'prep-line-po-0004-main',
        preparedQty: 500,
        rollCount: 2,
        warehouseArea: '中转仓 A 区',
        locationCode: 'TR-A-021',
        sourceStockEventId: 'ledger:cut-order:po-202603-0004:black:prep:draft:001',
        remark: '该明细只是记录内物料行，确认动作在配料记录层完成。',
      },
    ],
  },
  {
    prepRecordId: 'prep-rec-po-0004-main-draft-002',
    prepOrderId: 'prep-order-po-202603-0004',
    prepLineId: 'prep-line-po-0004-main',
    batchNo: 'BATCH-BLK-260316-D02',
    preparedQty: 280,
    rollCount: 1,
    warehouseArea: '中转仓 A 区',
    locationCode: 'TR-A-022',
    operatorName: '中转仓 林洁',
    preparedAt: '2026-03-16 09:10',
    recordStatus: 'DRAFT',
    confirmedAt: '',
    confirmedBy: '',
    rejectedAt: '2026-03-16 09:38',
    rejectedBy: '裁床 李明',
    rejectReason: '卷标缺失，领料端要求补拍实物标签后再确认。',
    sourceStockEventId: 'ledger:cut-order:po-202603-0004:black:prep:draft:002',
    remark: '领料端预审打回，尚未确认，不进入可领数量。',
    items: [
      {
        prepRecordItemId: 'prep-item-po-0004-main-draft-002',
        prepLineId: 'prep-line-po-0004-main',
        preparedQty: 280,
        rollCount: 1,
        warehouseArea: '中转仓 A 区',
        locationCode: 'TR-A-022',
        sourceStockEventId: 'ledger:cut-order:po-202603-0004:black:prep:draft:002',
        remark: '该明细被领料端预审打回，重新确认仍以整条配料记录为对象。',
      },
    ],
  },
  {
    prepRecordId: 'prep-rec-po-0101-black-001',
    prepOrderId: 'prep-order-po-202603-0101',
    prepLineId: 'prep-line-po-0101-black',
    batchNo: 'BATCH-BLK-260316-01',
    preparedQty: 900,
    rollCount: 4,
    warehouseArea: '中转仓 A 区',
    locationCode: 'TR-A-010',
    operatorName: '中转仓 周敏',
    preparedAt: '2026-03-16 09:20',
    recordStatus: 'CONFIRMED',
    confirmedAt: '2026-03-16 09:30',
    confirmedBy: '中转仓 周敏',
    rejectedAt: '',
    rejectedBy: '',
    rejectReason: '',
    sourceStockEventId: 'ledger:cut-order:po-202603-0101:black:prep:001',
    remark: '首批可领，后续到仓继续配。',
  },
  {
    prepRecordId: 'prep-rec-po-0101-charcoal-001',
    prepOrderId: 'prep-order-po-202603-0101',
    prepLineId: 'prep-line-po-0101-charcoal',
    batchNo: 'BATCH-CHA-260316-01',
    preparedQty: 900,
    rollCount: 3,
    warehouseArea: '中转仓 A 区',
    locationCode: 'TR-A-011',
    operatorName: '中转仓 周敏',
    preparedAt: '2026-03-16 09:35',
    recordStatus: 'CONFIRMED',
    confirmedAt: '2026-03-16 09:45',
    confirmedBy: '中转仓 周敏',
    rejectedAt: '',
    rejectedBy: '',
    rejectReason: '',
    sourceStockEventId: 'ledger:cut-order:po-202603-0101:charcoal:prep:001',
    remark: '已领完，剩余待染色回仓。',
  },
  {
    prepRecordId: 'prep-rec-po-0101-mixed-002',
    prepOrderId: 'prep-order-po-202603-0101',
    prepLineId: 'prep-line-po-0101-black',
    batchNo: 'BATCH-MIX-260316-02',
    preparedQty: 160,
    rollCount: 2,
    warehouseArea: '中转仓 A 区',
    locationCode: 'TR-A-012',
    operatorName: '中转仓 林洁',
    preparedAt: '2026-03-16 12:10',
    recordStatus: 'DRAFT',
    confirmedAt: '',
    confirmedBy: '',
    rejectedAt: '',
    rejectedBy: '',
    rejectReason: '',
    sourceStockEventId: 'ledger:cut-order:po-202603-0101:mixed:prep:002',
    remark: '同一配料记录内包含多个物料明细；确认动作只在整条配料记录上完成。',
    items: [
      {
        prepRecordItemId: 'prep-item-po-0101-mixed-002-black',
        prepLineId: 'prep-line-po-0101-black',
        preparedQty: 100,
        rollCount: 1,
        warehouseArea: '中转仓 A 区',
        locationCode: 'TR-A-012',
        sourceStockEventId: 'ledger:cut-order:po-202603-0101:mixed:black:prep:002',
        remark: '记录内 Black 明细，不单独确认。',
      },
      {
        prepRecordItemId: 'prep-item-po-0101-mixed-002-charcoal',
        prepLineId: 'prep-line-po-0101-charcoal',
        preparedQty: 60,
        rollCount: 1,
        warehouseArea: '中转仓 A 区',
        locationCode: 'TR-A-013',
        sourceStockEventId: 'ledger:cut-order:po-202603-0101:mixed:charcoal:prep:002',
        remark: '记录内 Charcoal 明细，不单独确认。',
      },
    ],
  },
  {
    prepRecordId: 'prep-rec-po-0102-navy-001',
    prepOrderId: 'prep-order-po-202603-0102',
    prepLineId: 'prep-line-po-0102-navy',
    batchNo: 'BATCH-NAV-260316-01',
    preparedQty: 260,
    rollCount: 1,
    warehouseArea: '中转仓 B 区',
    locationCode: 'TR-B-006',
    operatorName: '中转仓 周敏',
    preparedAt: '2026-03-16 10:05',
    recordStatus: 'CONFIRMED',
    confirmedAt: '2026-03-16 10:15',
    confirmedBy: '中转仓 周敏',
    rejectedAt: '',
    rejectedBy: '',
    rejectReason: '',
    sourceStockEventId: 'ledger:cut-order:po-202603-0102:navy:prep:001',
    remark: '印花前置库存已领完，后续等印花回仓。',
  },
  {
    prepRecordId: 'prep-rec-po-0102-khaki-001',
    prepOrderId: 'prep-order-po-202603-0102',
    prepLineId: 'prep-line-po-0102-khaki',
    batchNo: 'BATCH-KHK-260316-01',
    preparedQty: 1386,
    rollCount: 5,
    warehouseArea: '中转仓 B 区',
    locationCode: 'TR-B-008',
    operatorName: '中转仓 周敏',
    preparedAt: '2026-03-16 10:20',
    recordStatus: 'CONFIRMED',
    confirmedAt: '2026-03-16 10:30',
    confirmedBy: '中转仓 周敏',
    rejectedAt: '',
    rejectedBy: '',
    rejectReason: '',
    sourceStockEventId: 'ledger:cut-order:po-202603-0102:khaki:prep:001',
    remark: '该行已配齐。',
  },
  {
    prepRecordId: 'prep-rec-po-0001-main-001',
    prepOrderId: 'prep-order-po-202603-0001',
    prepLineId: 'prep-line-po-0001-main',
    batchNo: 'BATCH-WHT-260315-01',
    preparedQty: 6300,
    rollCount: 18,
    warehouseArea: '中转仓 C 区',
    locationCode: 'TR-C-001',
    operatorName: '中转仓 林洁',
    preparedAt: '2026-03-15 15:00',
    recordStatus: 'CONFIRMED',
    confirmedAt: '2026-03-15 15:10',
    confirmedBy: '中转仓 林洁',
    rejectedAt: '',
    rejectedBy: '',
    rejectReason: '',
    sourceStockEventId: 'ledger:cut-order:po-202603-0001:white:prep:001',
    remark: '已配齐。',
  },
  {
    prepRecordId: 'prep-rec-po-0002-main-001',
    prepOrderId: 'prep-order-po-202603-0002',
    prepLineId: 'prep-line-po-0002-main',
    batchNo: 'BATCH-GRY-260316-01',
    preparedQty: 3150,
    rollCount: 9,
    warehouseArea: '中转仓 C 区',
    locationCode: 'TR-C-006',
    operatorName: '中转仓 周敏',
    preparedAt: '2026-03-16 10:20',
    recordStatus: 'REJECTED',
    confirmedAt: '2026-03-16 10:30',
    confirmedBy: '中转仓 周敏',
    rejectedAt: '2026-03-16 11:10',
    rejectedBy: '裁床 李明',
    rejectReason: '色号与生产单需求不一致，需重新核对。',
    sourceStockEventId: 'ledger:cut-order:po-202603-0002:grey:prep:001',
    remark: '领料端打回，暂不计入可领。',
  },
  {
    prepRecordId: 'prep-rec-po-0006-main-001',
    prepOrderId: 'prep-order-po-202603-0006',
    prepLineId: 'prep-line-po-0006-main',
    batchNo: 'BATCH-BGE-260316-01',
    preparedQty: 300,
    rollCount: 2,
    warehouseArea: '中转仓 D 区',
    locationCode: 'TR-D-002',
    operatorName: '中转仓 周敏',
    preparedAt: '2026-03-16 11:30',
    recordStatus: 'CONFIRMED',
    confirmedAt: '2026-03-16 11:35',
    confirmedBy: '中转仓 周敏',
    rejectedAt: '',
    rejectedBy: '',
    rejectReason: '',
    sourceStockEventId: 'ledger:cut-order:po-202603-0006:beige:prep:001',
    remark: '采购尾数取消，按实关闭。',
  },
  {
    prepRecordId: 'prep-rec-po-0007-main-001',
    prepOrderId: 'prep-order-po-202603-0007',
    prepLineId: 'prep-line-po-0007-main',
    batchNo: 'BATCH-NVY-260316-01',
    preparedQty: 1008,
    rollCount: 4,
    warehouseArea: '中转仓 A 区',
    locationCode: 'TR-A-018',
    operatorName: '中转仓 林洁',
    preparedAt: '2026-03-16 13:20',
    recordStatus: 'CONFIRMED',
    confirmedAt: '2026-03-16 13:25',
    confirmedBy: '中转仓 林洁',
    rejectedAt: '',
    rejectedBy: '',
    rejectReason: '',
    sourceStockEventId: 'ledger:cut-order:po-202603-0007:navy:prep:001',
    remark: '已确认但裁床尚未领料，用于待领料工作台。',
    items: [
      {
        prepRecordItemId: 'prep-item-po-0007-main-001',
        prepLineId: 'prep-line-po-0007-main',
        preparedQty: 1008,
        rollCount: 4,
        warehouseArea: '中转仓 A 区',
        locationCode: 'TR-A-018',
        sourceStockEventId: 'ledger:cut-order:po-202603-0007:navy:prep:001',
        remark: '领料端可领明细，来源确认对象是整条配料记录。',
      },
    ],
  },
]

const seedPrepRecords: MaterialPrepRecord[] = [
  ...explicitSeedPrepRecords,
  ...buildAutoPrepRecordsForCompletedOrders(explicitSeedPrepRecords),
]

function buildAutoPickupRecordsForCompletedOrders(
  explicitPickupRecords: PickupRecord[],
  prepRecords: MaterialPrepRecord[],
): PickupRecord[] {
  const pickupDonePrepOrderIds = new Set(['prep-order-po-202603-0001'])
  const explicitPickedLineIds = new Set(
    explicitPickupRecords
      .filter((record) => pickupDonePrepOrderIds.has(record.prepOrderId))
      .map((record) => record.prepLineId),
  )
  return materialPrepSeedOrders
    .filter((order) => pickupDonePrepOrderIds.has(order.prepOrderId))
    .flatMap((order) =>
      order.lines
        .filter((line) => !explicitPickedLineIds.has(line.prepLineId))
        .flatMap((line, index) => {
          const prepRecord = prepRecords.find((record) =>
            record.prepOrderId === order.prepOrderId &&
            record.recordStatus === 'CONFIRMED' &&
            getMaterialPrepRecordItems(record).some((item) => item.prepLineId === line.prepLineId),
          )
          if (!prepRecord) return []
          const rollCount = buildLineRollCount(line)
          return [{
            pickupRecordId: `pickup-rec-${order.productionOrderNo.toLowerCase()}-${line.materialType}-${index + 1}`,
            prepRecordId: prepRecord.prepRecordId,
            prepOrderId: order.prepOrderId,
            prepLineId: line.prepLineId,
            productionOrderId: order.productionOrderId,
            pickedQty: line.requiredQty,
            rollCount,
            receiverName: '裁床 李明',
            pickedAt: '2026-03-15 16:25',
            warehouseArea: '待加工仓标准区',
            locationCode: `FAB-STD-${String(index + 1).padStart(2, '0')}`,
            waitProcessLedgerEventId: `ledger:${order.productionOrderNo}:${line.materialSku}:auto-pickup`,
            differenceQty: 0,
            differenceReason: '',
            pickupStatus: '已入待加工仓' as PickupRecord['pickupStatus'],
            remark: '标准 BOM 补齐物料已领入待加工仓。',
          }]
        }),
    )
}

const explicitSeedPickupRecords: PickupRecord[] = [
  {
    pickupRecordId: 'pickup-rec-po-0004-main-preview-001',
    prepRecordId: 'prep-rec-po-0004-main-draft-002',
    prepOrderId: 'prep-order-po-202603-0004',
    prepLineId: 'prep-line-po-0004-main',
    productionOrderId: 'PO-202603-0004',
    pickedQty: 0,
    rollCount: 1,
    receiverName: '裁床 李明',
    pickedAt: '2026-03-16 09:40',
    warehouseArea: '待加工仓预检区',
    locationCode: 'FAB-PRECHECK',
    waitProcessLedgerEventId: 'ledger:po-0004:black:claim:preview:001',
    differenceQty: -280,
    differenceReason: '裁床领料前核对发现卷标缺失，未实际入待加工仓，已打回中转仓补资料。',
    pickupStatus: '差异领料',
    remark: '用于展示领料端打回链路，未形成待加工仓可用库存。',
  },
  {
    pickupRecordId: 'pickup-rec-po-0101-black-001',
    prepRecordId: 'prep-rec-po-0101-black-001',
    prepOrderId: 'prep-order-po-202603-0101',
    prepLineId: 'prep-line-po-0101-black',
    productionOrderId: 'PO-202603-0101',
    pickedQty: 720,
    rollCount: 3,
    receiverName: '裁床 李明',
    pickedAt: '2026-03-16 10:40',
    warehouseArea: '待加工仓 A 区',
    locationCode: 'FAB-A-01',
    waitProcessLedgerEventId: 'ledger:po-0101:black:claim:001',
    differenceQty: -180,
    differenceReason: '现场先领 3 卷，余量保留待继续领。',
    pickupStatus: '差异领料',
    remark: '仍有 180 米可领。',
  },
  {
    pickupRecordId: 'pickup-rec-po-0101-charcoal-001',
    prepRecordId: 'prep-rec-po-0101-charcoal-001',
    prepOrderId: 'prep-order-po-202603-0101',
    prepLineId: 'prep-line-po-0101-charcoal',
    productionOrderId: 'PO-202603-0101',
    pickedQty: 900,
    rollCount: 3,
    receiverName: '裁床 李明',
    pickedAt: '2026-03-16 10:45',
    warehouseArea: '待加工仓 A 区',
    locationCode: 'FAB-A-02',
    waitProcessLedgerEventId: 'ledger:po-0101:charcoal:claim:001',
    differenceQty: 0,
    differenceReason: '',
    pickupStatus: '已入待加工仓',
    remark: '首批已领完。',
  },
  {
    pickupRecordId: 'pickup-rec-po-0102-navy-001',
    prepRecordId: 'prep-rec-po-0102-navy-001',
    prepOrderId: 'prep-order-po-202603-0102',
    prepLineId: 'prep-line-po-0102-navy',
    productionOrderId: 'PO-202603-0102',
    pickedQty: 260,
    rollCount: 1,
    receiverName: '裁床 李明',
    pickedAt: '2026-03-16 11:05',
    warehouseArea: '待加工仓 B 区',
    locationCode: 'FAB-B-03',
    waitProcessLedgerEventId: 'ledger:po-0102:navy:claim:001',
    differenceQty: 0,
    differenceReason: '',
    pickupStatus: '已入待加工仓',
    remark: '当前可领已领完，等待后续配料。',
  },
  {
    pickupRecordId: 'pickup-rec-po-0102-khaki-001',
    prepRecordId: 'prep-rec-po-0102-khaki-001',
    prepOrderId: 'prep-order-po-202603-0102',
    prepLineId: 'prep-line-po-0102-khaki',
    productionOrderId: 'PO-202603-0102',
    pickedQty: 1386,
    rollCount: 5,
    receiverName: '裁床 李明',
    pickedAt: '2026-03-16 11:10',
    warehouseArea: '待加工仓 B 区',
    locationCode: 'FAB-B-04',
    waitProcessLedgerEventId: 'ledger:po-0102:khaki:claim:001',
    differenceQty: 0,
    differenceReason: '',
    pickupStatus: '已入待加工仓',
    remark: '该行已完结。',
  },
  {
    pickupRecordId: 'pickup-rec-po-0001-main-001',
    prepRecordId: 'prep-rec-po-0001-main-001',
    prepOrderId: 'prep-order-po-202603-0001',
    prepLineId: 'prep-line-po-0001-main',
    productionOrderId: 'PO-202603-0001',
    pickedQty: 6300,
    rollCount: 18,
    receiverName: '裁床 李明',
    pickedAt: '2026-03-15 16:20',
    warehouseArea: '待加工仓 C 区',
    locationCode: 'FAB-C-01',
    waitProcessLedgerEventId: 'ledger:po-0001:white:claim:001',
    differenceQty: 0,
    differenceReason: '',
    pickupStatus: '已入待加工仓',
    remark: '已领料完结。',
  },
  {
    pickupRecordId: 'pickup-rec-po-0006-main-001',
    prepRecordId: 'prep-rec-po-0006-main-001',
    prepOrderId: 'prep-order-po-202603-0006',
    prepLineId: 'prep-line-po-0006-main',
    productionOrderId: 'PO-202603-0006',
    pickedQty: 300,
    rollCount: 2,
    receiverName: '裁床 李明',
    pickedAt: '2026-03-16 12:10',
    warehouseArea: '待加工仓 D 区',
    locationCode: 'FAB-D-01',
    waitProcessLedgerEventId: 'ledger:po-0006:beige:claim:001',
    differenceQty: 0,
    differenceReason: '',
    pickupStatus: '已入待加工仓',
    remark: '配料端关闭后按实完结。',
  },
]

const seedPickupRecords: PickupRecord[] = [
  ...explicitSeedPickupRecords,
  ...buildAutoPickupRecordsForCompletedOrders(explicitSeedPickupRecords, seedPrepRecords),
]

const seedRejectRecords: PrepRejectRecord[] = [
  {
    rejectId: 'reject-prep-rec-po-0004-main-draft-002',
    prepRecordId: 'prep-rec-po-0004-main-draft-002',
    prepOrderId: 'prep-order-po-202603-0004',
    prepLineId: 'prep-line-po-0004-main',
    rejectReason: '卷标缺失',
    rejectDetail: '裁床领料前预审发现该卷缺少中转仓卷标照片，暂不接收，要求中转仓补齐标签信息后重新确认。',
    rejectedBy: '裁床 李明',
    rejectedAt: '2026-03-16 09:38',
    beforeStatus: 'DRAFT',
    afterStatus: 'DRAFT',
  },
  {
    rejectId: 'reject-prep-rec-po-0002-main-001',
    prepRecordId: 'prep-rec-po-0002-main-001',
    prepOrderId: 'prep-order-po-202603-0002',
    prepLineId: 'prep-line-po-0002-main',
    rejectReason: '色号不符',
    rejectDetail: '领料核对发现实物色号偏深，与生产单 Grey 色要求不一致。',
    rejectedBy: '裁床 李明',
    rejectedAt: '2026-03-16 11:10',
    beforeStatus: 'CONFIRMED',
    afterStatus: 'REJECTED',
  },
]

const seedClosedOrders: ProductionMaterialPrepWorkflowStore['closedOrders'] = [
  {
    prepOrderId: 'prep-order-po-202603-0006',
    closedAt: '2026-03-16 12:30',
    closeReason: '采购尾数取消，后续不会再有可配库存，裁床按已领数量安排。',
    closedBy: '中转仓 周敏',
  },
]

function cloneRecord<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function mergeMissingSeedRecords<T>(
  currentRecords: T[],
  seedRecords: T[],
  getKey: (record: T) => string,
): T[] {
  const existingKeys = new Set(currentRecords.map(getKey))
  const missingSeeds = seedRecords.filter((record) => !existingKeys.has(getKey(record)))
  return [...cloneRecord(missingSeeds), ...cloneRecord(currentRecords)]
}

function roundQty(value: number): number {
  return Number(Number(value || 0).toFixed(2))
}

function nowText(date = new Date()): string {
  return date.toISOString().slice(0, 19).replace('T', ' ')
}

export function createProductionMaterialPrepSeedStore(): ProductionMaterialPrepWorkflowStore {
  return {
    prepRecords: cloneRecord(seedPrepRecords),
    pickupRecords: cloneRecord(seedPickupRecords),
    rejectRecords: cloneRecord(seedRejectRecords),
    closedOrders: cloneRecord(seedClosedOrders),
  }
}

export function serializeProductionMaterialPrepStore(store: ProductionMaterialPrepWorkflowStore): string {
  return JSON.stringify(store)
}

export function deserializeProductionMaterialPrepStore(raw: string | null): ProductionMaterialPrepWorkflowStore {
  if (!raw) return createProductionMaterialPrepSeedStore()
  try {
    const parsed = JSON.parse(raw) as Partial<ProductionMaterialPrepWorkflowStore>
    return {
      prepRecords: Array.isArray(parsed.prepRecords)
        ? mergeMissingSeedRecords(parsed.prepRecords, seedPrepRecords, (record) => record.prepRecordId)
        : cloneRecord(seedPrepRecords),
      pickupRecords: Array.isArray(parsed.pickupRecords)
        ? mergeMissingSeedRecords(parsed.pickupRecords, seedPickupRecords, (record) => record.pickupRecordId)
        : cloneRecord(seedPickupRecords),
      rejectRecords: Array.isArray(parsed.rejectRecords)
        ? mergeMissingSeedRecords(parsed.rejectRecords, seedRejectRecords, (record) => record.rejectId)
        : cloneRecord(seedRejectRecords),
      closedOrders: Array.isArray(parsed.closedOrders)
        ? mergeMissingSeedRecords(parsed.closedOrders, seedClosedOrders, (record) => record.prepOrderId)
        : cloneRecord(seedClosedOrders),
    }
  } catch {
    return createProductionMaterialPrepSeedStore()
  }
}

export function hydrateProductionMaterialPrepStore(
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): ProductionMaterialPrepWorkflowStore {
  return deserializeProductionMaterialPrepStore(storage?.getItem(PRODUCTION_MATERIAL_PREP_STORAGE_KEY) ?? null)
}

export function persistProductionMaterialPrepStore(
  store: ProductionMaterialPrepWorkflowStore,
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): ProductionMaterialPrepWorkflowStore {
  storage?.setItem?.(PRODUCTION_MATERIAL_PREP_STORAGE_KEY, serializeProductionMaterialPrepStore(store))
  return store
}

function listRuntimePickupRecords(storage: BrowserStorageLike | null): PickupRecord[] {
  return listCuttingRuntimeEventsByType('中转仓领料', storage).flatMap((event) => {
    const payload = event.payload && typeof event.payload === 'object' ? event.payload as Record<string, unknown> : {}
    const prepRecordId = typeof payload.prepRecordId === 'string' ? payload.prepRecordId : ''
    const prepOrderId = typeof payload.prepOrderId === 'string' ? payload.prepOrderId : ''
    const prepLineId = typeof payload.prepLineId === 'string' ? payload.prepLineId : ''
    if (!prepRecordId || !prepOrderId || !prepLineId) return []
    const pickupQty = Number(payload.pickupQty || 0)
    return [{
      pickupRecordId: String(payload.pickupRecordId || event.eventId),
      prepRecordId,
      prepOrderId,
      prepLineId,
      productionOrderId: event.refs.productionOrderId || '',
      pickedQty: roundQty(pickupQty),
      rollCount: Number(payload.rollCount || event.inventoryEffect?.rollCount || 0),
      receiverName: String(payload.pickupBy || event.operatorName || '裁床仓管'),
      pickedAt: String(payload.pickupAt || event.occurredAt),
      warehouseArea: String(payload.warehouseArea || event.inventoryEffect?.toWarehouseArea || ''),
      locationCode: String(payload.locationCode || event.inventoryEffect?.toLocationCode || ''),
      waitProcessLedgerEventId: event.eventId,
      differenceQty: Number(payload.differenceQty || 0),
      differenceReason: String(payload.differenceReason || ''),
      pickupStatus: payload.hasDifference ? '差异领料' : '已入待加工仓',
      remark: '待加工仓中转仓领料执行回写。',
    }]
  })
}

function getClosedOrder(store: ProductionMaterialPrepWorkflowStore, prepOrderId: string) {
  return store.closedOrders.find((item) => item.prepOrderId === prepOrderId) || null
}

export function getMaterialPrepRecordItems(record: MaterialPrepRecord): MaterialPrepRecordItem[] {
  const explicitItems = Array.isArray(record.items) && record.items.length > 0
    ? record.items
    : [
        {
          prepRecordItemId: `${record.prepRecordId}:item:${record.prepLineId}`,
          prepLineId: record.prepLineId,
          preparedQty: record.preparedQty,
          rollCount: record.rollCount,
          warehouseArea: record.warehouseArea,
          locationCode: record.locationCode,
          sourceStockEventId: record.sourceStockEventId,
          remark: record.remark,
        },
      ]

  return explicitItems.map((item, index) => ({
    prepRecordItemId: item.prepRecordItemId || `${record.prepRecordId}:item:${index + 1}`,
    prepLineId: item.prepLineId || record.prepLineId,
    preparedQty: roundQty(item.preparedQty),
    rollCount: Math.max(Math.round(item.rollCount || 1), 1),
    warehouseArea: item.warehouseArea || record.warehouseArea,
    locationCode: item.locationCode || record.locationCode,
    sourceStockEventId: item.sourceStockEventId || record.sourceStockEventId,
    remark: item.remark || record.remark,
  }))
}

function getLineRecords(store: ProductionMaterialPrepWorkflowStore, prepLineId: string): MaterialPrepRecord[] {
  return store.prepRecords.filter((record) => getMaterialPrepRecordItems(record).some((item) => item.prepLineId === prepLineId))
}

function getRecordPickupQty(pickupRecords: PickupRecord[], prepRecordId: string): number {
  return roundQty(
    pickupRecords
      .filter((record) => record.prepRecordId === prepRecordId)
      .reduce((sum, record) => sum + Number(record.pickedQty || 0), 0),
  )
}

function getLinePickupQty(pickupRecords: PickupRecord[], prepLineId: string): number {
  return roundQty(
    pickupRecords
      .filter((record) => record.prepLineId === prepLineId)
      .reduce((sum, record) => sum + Number(record.pickedQty || 0), 0),
  )
}

function getRecordItemPickupQty(pickupRecords: PickupRecord[], prepRecordId: string, prepLineId: string): number {
  return roundQty(
    pickupRecords
      .filter((record) => record.prepRecordId === prepRecordId && record.prepLineId === prepLineId)
      .reduce((sum, record) => sum + Number(record.pickedQty || 0), 0),
  )
}

function getConfirmedLineQty(records: MaterialPrepRecord[], prepLineId: string): number {
  return roundQty(
    records
      .filter((record) => record.recordStatus === 'CONFIRMED')
      .reduce((sum, record) => {
        const recordLineQty = getMaterialPrepRecordItems(record)
          .filter((item) => item.prepLineId === prepLineId)
          .reduce((itemSum, item) => itemSum + Number(item.preparedQty || 0), 0)
        return sum + recordLineQty
      }, 0),
  )
}

function deriveLineStatus(
  seedLine: MaterialPrepSeedLine,
  records: MaterialPrepRecord[],
  confirmedPrepQty: number,
  pickedQty: number,
  closed: boolean,
): MaterialPrepLine['linePrepStatus'] {
  if (records.some((record) => record.recordStatus === 'REJECTED')) return '被打回'
  if (closed && confirmedPrepQty < seedLine.requiredQty) return '按实关闭'
  if (confirmedPrepQty >= seedLine.requiredQty) return '已配齐'
  if (confirmedPrepQty > 0) {
    return seedLine.availableStockQty > 0 && pickedQty <= confirmedPrepQty ? '部分已配' : '缺料跟进'
  }
  return seedLine.availableStockQty > 0 ? '未配料' : '缺料跟进'
}

function buildLine(
  seedLine: MaterialPrepSeedLine,
  store: ProductionMaterialPrepWorkflowStore,
  pickupRecords: PickupRecord[],
  closed: boolean,
): MaterialPrepLine {
  const records = getLineRecords(store, seedLine.prepLineId)
  const confirmedPrepQty = getConfirmedLineQty(records, seedLine.prepLineId)
  const pickedQty = getLinePickupQty(pickupRecords, seedLine.prepLineId)
  const remainingNeedQty = roundQty(Math.max(seedLine.requiredQty - confirmedPrepQty, 0))
  const canPrepQty = closed ? 0 : roundQty(Math.min(seedLine.availableStockQty, remainingNeedQty))
  const shortageQty = roundQty(Math.max(remainingNeedQty - seedLine.availableStockQty, 0))
  return {
    prepLineId: seedLine.prepLineId,
    prepOrderId: seedLine.prepOrderId,
    cutOrderId: seedLine.cutOrderId,
    cutOrderNo: seedLine.cutOrderNo,
    materialSku: seedLine.materialSku,
    materialName: seedLine.materialName,
    materialType: seedLine.materialType || inferMaterialType(seedLine),
    materialImageUrl: ensureLineImage(seedLine),
    color: seedLine.color,
    spec: seedLine.spec,
    unit: seedLine.unit,
    requiredQty: seedLine.requiredQty,
    confirmedPrepQty,
    pickedQty,
    remainingNeedQty,
    availableStockQty: seedLine.availableStockQty,
    canPrepQty,
    shortageQty,
    linePrepStatus: deriveLineStatus(seedLine, records, confirmedPrepQty, pickedQty, closed),
    upstreamSourceType: seedLine.upstreamSourceType,
    upstreamProgressStatus: seedLine.upstreamProgressStatus,
    expectedAvailableAt: seedLine.expectedAvailableAt,
    upstreamProgressDetail: seedLine.upstreamProgressDetail,
  }
}

function deriveOrderPrepStatus(
  lines: MaterialPrepLine[],
  prepRecords: MaterialPrepRecord[],
  closed: boolean,
): MaterialPrepOrderStatus {
  if (closed) return 'CLOSED'
  if (prepRecords.some((record) => record.recordStatus === 'REJECTED')) return 'REJECTED_REWORK'
  if (lines.length && lines.every((line) => line.confirmedPrepQty >= line.requiredQty)) return 'READY'
  if (lines.some((line) => line.confirmedPrepQty > 0 && line.canPrepQty > 0)) return 'CONTINUE_PREP'
  if (lines.every((line) => line.confirmedPrepQty <= 0) && lines.some((line) => line.canPrepQty > 0)) return 'NEED_PREP'
  return 'SHORTAGE_TRACKING'
}

function derivePickupStatus(
  lines: MaterialPrepLine[],
  prepRecords: MaterialPrepRecord[],
  pickupRecords: PickupRecord[],
  closed: boolean,
): PickupOrderStatus {
  if (closed) return 'ACTUAL_CLOSED'
  if (prepRecords.some((record) => record.recordStatus === 'REJECTED')) return 'REJECTED_WAIT_WLS'
  const confirmedQty = lines.reduce((sum, line) => sum + line.confirmedPrepQty, 0)
  const pickedQty = pickupRecords.reduce((sum, record) => sum + Number(record.pickedQty || 0), 0)
  const requiredQty = lines.reduce((sum, line) => sum + line.requiredQty, 0)
  const availableToPickup = Math.max(confirmedQty - pickedQty, 0)
  if (requiredQty > 0 && confirmedQty >= requiredQty && pickedQty >= confirmedQty) return 'PICKUP_DONE'
  if (availableToPickup > 0 && confirmedQty < requiredQty) return 'PARTIAL_PICKABLE'
  if (availableToPickup > 0) return 'WAIT_PICKUP'
  if (pickedQty > 0 && lines.some((line) => line.remainingNeedQty > 0)) return 'WAIT_CONTINUE_PICKUP'
  return 'NOT_PICKABLE'
}

function latestText(values: string[]): string {
  return values.filter(Boolean).sort((left, right) => right.localeCompare(left, 'zh-CN'))[0] || ''
}

function buildOrderProjection(
  seedOrder: MaterialPrepSeedOrder,
  store: ProductionMaterialPrepWorkflowStore,
  runtimePickupRecords: PickupRecord[],
): MaterialPrepOrderProjection {
  const closed = getClosedOrder(store, seedOrder.prepOrderId)
  const pickupRecords = [
    ...store.pickupRecords,
    ...runtimePickupRecords,
  ].filter((record) => record.prepOrderId === seedOrder.prepOrderId)
  const lines = seedOrder.lines.map((line) => buildLine(line, store, pickupRecords, Boolean(closed)))
  const prepRecords = store.prepRecords.filter((record) => record.prepOrderId === seedOrder.prepOrderId)
  const rejectRecords = store.rejectRecords.filter((record) => record.prepOrderId === seedOrder.prepOrderId)
  const overallPrepStatus = deriveOrderPrepStatus(lines, prepRecords, Boolean(closed))
  const pickupStatus = derivePickupStatus(lines, prepRecords, pickupRecords, Boolean(closed))
  const totalRequiredQty = roundQty(lines.reduce((sum, line) => sum + line.requiredQty, 0))
  const totalConfirmedPrepQty = roundQty(lines.reduce((sum, line) => sum + line.confirmedPrepQty, 0))
  const totalPickedQty = roundQty(lines.reduce((sum, line) => sum + line.pickedQty, 0))
  const totalAvailableToPickupQty = roundQty(Math.max(totalConfirmedPrepQty - totalPickedQty, 0))
  const totalShortageQty = roundQty(lines.reduce((sum, line) => sum + line.shortageQty, 0))
  const latestOperatedAt = latestText([
    ...prepRecords.map((record) => record.rejectedAt || record.confirmedAt || record.preparedAt),
    ...pickupRecords.map((record) => record.pickedAt),
    closed?.closedAt || '',
  ])
  const latestOperatorName =
    pickupRecords.find((record) => record.pickedAt === latestOperatedAt)?.receiverName ||
    prepRecords.find((record) => [record.rejectedAt, record.confirmedAt, record.preparedAt].includes(latestOperatedAt))?.operatorName ||
    closed?.closedBy ||
    seedOrder.creatorName

  return {
    order: {
      prepOrderId: seedOrder.prepOrderId,
      prepOrderNo: seedOrder.prepOrderNo,
      productionOrderId: seedOrder.productionOrderId,
      productionOrderNo: seedOrder.productionOrderNo,
      styleNo: seedOrder.styleNo,
      styleName: seedOrder.styleName,
      spu: seedOrder.spu,
      customerName: seedOrder.customerName,
      planQty: seedOrder.planQty,
      deliveryDate: seedOrder.deliveryDate,
      creatorName: seedOrder.creatorName,
      createdAt: seedOrder.createdAt,
      overallPrepStatus,
      pickupStatus,
      isClosed: Boolean(closed),
      closedAt: closed?.closedAt || '',
      closeReason: closed?.closeReason || '',
    },
    lines,
    prepRecords,
    pickupRecords,
    rejectRecords,
    totalRequiredQty,
    totalConfirmedPrepQty,
    totalPickedQty,
    totalAvailableToPickupQty,
    totalShortageQty,
    lineCount: lines.length,
    readyLineCount: lines.filter((line) => line.confirmedPrepQty >= line.requiredQty).length,
    shortageLineCount: lines.filter((line) => line.remainingNeedQty > 0).length,
    canContinuePrepLineCount: lines.filter((line) => line.canPrepQty > 0).length,
    rejectedRecordCount: prepRecords.filter((record) => record.recordStatus === 'REJECTED').length,
    earliestExpectedAvailableAt: lines
      .map((line) => line.expectedAvailableAt)
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right, 'zh-CN'))[0] || '',
    latestOperatorName,
    latestOperatedAt,
  }
}

export function listMaterialPrepOrderProjections(
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): MaterialPrepOrderProjection[] {
  const store = hydrateProductionMaterialPrepStore(storage)
  const runtimePickupRecords = listRuntimePickupRecords(storage)
  return materialPrepSeedOrders
    .map((seedOrder) => buildOrderProjection(seedOrder, store, runtimePickupRecords))
    .sort((left, right) =>
      materialPrepStatusLabelMap[left.order.overallPrepStatus].localeCompare(materialPrepStatusLabelMap[right.order.overallPrepStatus], 'zh-CN')
      || left.order.deliveryDate.localeCompare(right.order.deliveryDate, 'zh-CN'),
    )
}

export function getMaterialPrepOrderProjection(
  prepOrderId: string,
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): MaterialPrepOrderProjection | null {
  return listMaterialPrepOrderProjections(storage).find((projection) => projection.order.prepOrderId === prepOrderId) || null
}

export function getMaterialPrepRecordContext(
  prepRecordId: string,
  prepLineIdOrStorage: string | BrowserStorageLike | null = '',
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): {
  projection: MaterialPrepOrderProjection
  record: MaterialPrepRecord
  item: MaterialPrepRecordItem
  line: MaterialPrepLine
  ledgerRow: MaterialLedgerProjection | null
  pickedQty: number
  availableToPickupQty: number
} | null {
  const prepLineId = typeof prepLineIdOrStorage === 'string' ? prepLineIdOrStorage : ''
  const resolvedStorage = typeof prepLineIdOrStorage === 'string' ? storage : prepLineIdOrStorage
  for (const projection of listMaterialPrepOrderProjections(resolvedStorage)) {
    const record = projection.prepRecords.find((item) => item.prepRecordId === prepRecordId)
    if (!record) continue
    const recordItems = getMaterialPrepRecordItems(record)
    const recordItem = recordItems.find((item) => item.prepLineId === prepLineId) || recordItems[0]
    if (!recordItem) return null
    const line = projection.lines.find((item) => item.prepLineId === recordItem.prepLineId)
    if (!line) return null
    const pickedQty = getRecordItemPickupQty(projection.pickupRecords, record.prepRecordId, recordItem.prepLineId)
    return {
      projection,
      record,
      item: recordItem,
      line,
      ledgerRow: getMaterialLedgerProjectionByCutOrder(line.cutOrderId),
      pickedQty,
      availableToPickupQty: roundQty(Math.max(record.recordStatus === 'CONFIRMED' ? recordItem.preparedQty - pickedQty : 0, 0)),
    }
  }
  return null
}

export function listPickupCandidates(
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): PrepRecordPickupCandidate[] {
  return listMaterialPrepOrderProjections(storage).flatMap((projection) =>
    projection.prepRecords.flatMap((record) => {
      if (record.recordStatus !== 'CONFIRMED' || projection.order.isClosed) return []
      return getMaterialPrepRecordItems(record).flatMap((recordItem) => {
        const line = projection.lines.find((item) => item.prepLineId === recordItem.prepLineId)
        if (!line) return []
        const pickedQty = getRecordItemPickupQty(projection.pickupRecords, record.prepRecordId, recordItem.prepLineId)
        const availableToPickupQty = roundQty(Math.max(recordItem.preparedQty - pickedQty, 0))
        if (availableToPickupQty <= 0) return []
        return [{
          prepRecordId: record.prepRecordId,
          prepRecordItemId: recordItem.prepRecordItemId,
          prepOrderId: projection.order.prepOrderId,
          prepOrderNo: projection.order.prepOrderNo,
          prepLineId: line.prepLineId,
          cutOrderId: line.cutOrderId,
          cutOrderNo: line.cutOrderNo,
          productionOrderId: projection.order.productionOrderId,
          productionOrderNo: projection.order.productionOrderNo,
          materialSku: line.materialSku,
          materialName: line.materialName,
          materialType: line.materialType,
          materialImageUrl: line.materialImageUrl,
          color: line.color,
          unit: line.unit,
          preparedQty: recordItem.preparedQty,
          pickedQty,
          availableToPickupQty,
          rollCount: recordItem.rollCount,
          warehouseArea: recordItem.warehouseArea,
          locationCode: recordItem.locationCode,
          orderStatus: projection.order.overallPrepStatus,
          pickupStatus: projection.order.pickupStatus,
        }]
      })
    }),
  )
}

export function listPdaTransferPickupCandidates(
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): PrepRecordPickupCandidate[] {
  return listPickupCandidates(storage)
}

export function appendManualPrepRecord(
  input: {
    prepOrderId: string
    prepLineId: string
    preparedQty: number
    rollCount: number
    warehouseArea: string
    locationCode: string
    operatorName: string
    remark?: string
  },
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): MaterialPrepRecord {
  const store = hydrateProductionMaterialPrepStore(storage)
  const occurredAt = nowText()
  const record: MaterialPrepRecord = {
    prepRecordId: `prep-rec:${input.prepLineId}:${occurredAt.replace(/[^0-9]/g, '')}`,
    prepOrderId: input.prepOrderId,
    prepLineId: input.prepLineId,
    batchNo: `BATCH-${occurredAt.replace(/[^0-9]/g, '').slice(2, 12)}`,
    preparedQty: roundQty(input.preparedQty),
    rollCount: Math.max(Math.round(input.rollCount || 1), 1),
    warehouseArea: input.warehouseArea,
    locationCode: input.locationCode,
    operatorName: input.operatorName,
    preparedAt: occurredAt,
    recordStatus: 'DRAFT',
    confirmedAt: '',
    confirmedBy: '',
    rejectedAt: '',
    rejectedBy: '',
    rejectReason: '',
    sourceStockEventId: '',
    remark: input.remark || '手动新增配料记录，待确认后进入领料管理。',
    items: [
      {
        prepRecordItemId: `prep-item:${input.prepLineId}:${occurredAt.replace(/[^0-9]/g, '')}`,
        prepLineId: input.prepLineId,
        preparedQty: roundQty(input.preparedQty),
        rollCount: Math.max(Math.round(input.rollCount || 1), 1),
        warehouseArea: input.warehouseArea,
        locationCode: input.locationCode,
        sourceStockEventId: '',
        remark: input.remark || '手动新增配料记录明细，随配料记录一起确认。',
      },
    ],
  }
  store.prepRecords = [record, ...store.prepRecords]
  persistProductionMaterialPrepStore(store, storage)
  return cloneRecord(record)
}

export function confirmMaterialPrepRecord(
  prepRecordId: string,
  operatorName = '中转仓 周敏',
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): MaterialPrepRecord | null {
  const store = hydrateProductionMaterialPrepStore(storage)
  const record = store.prepRecords.find((item) => item.prepRecordId === prepRecordId)
  if (!record) return null
  record.recordStatus = 'CONFIRMED'
  record.confirmedAt = nowText()
  record.confirmedBy = operatorName
  record.rejectedAt = ''
  record.rejectedBy = ''
  record.rejectReason = ''
  persistProductionMaterialPrepStore(store, storage)
  return cloneRecord(record)
}

export function rejectMaterialPrepRecord(
  prepRecordId: string,
  rejectReason: string,
  rejectDetail = '',
  rejectedBy = '裁床 李明',
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): PrepRejectRecord {
  if (!rejectReason.trim()) {
    throw new Error('打回原因必填')
  }
  const store = hydrateProductionMaterialPrepStore(storage)
  const record = store.prepRecords.find((item) => item.prepRecordId === prepRecordId)
  if (!record) {
    throw new Error(`配料记录不存在：${prepRecordId}`)
  }
  const occurredAt = nowText()
  const beforeStatus = record.recordStatus
  record.recordStatus = 'REJECTED'
  record.rejectedAt = occurredAt
  record.rejectedBy = rejectedBy
  record.rejectReason = rejectReason.trim()
  const rejectRecord: PrepRejectRecord = {
    rejectId: `reject:${prepRecordId}:${occurredAt.replace(/[^0-9]/g, '')}`,
    prepRecordId,
    prepOrderId: record.prepOrderId,
    prepLineId: record.prepLineId,
    rejectReason: rejectReason.trim(),
    rejectDetail: rejectDetail.trim() || rejectReason.trim(),
    rejectedBy,
    rejectedAt: occurredAt,
    beforeStatus,
    afterStatus: 'REJECTED',
  }
  store.rejectRecords = [rejectRecord, ...store.rejectRecords]
  persistProductionMaterialPrepStore(store, storage)
  return cloneRecord(rejectRecord)
}

export function closeMaterialPrepOrder(
  prepOrderId: string,
  closeReason: string,
  closedBy = '中转仓 周敏',
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): void {
  if (!closeReason.trim()) {
    throw new Error('关闭原因必填')
  }
  const store = hydrateProductionMaterialPrepStore(storage)
  const occurredAt = nowText()
  store.closedOrders = [
    {
      prepOrderId,
      closedAt: occurredAt,
      closeReason: closeReason.trim(),
      closedBy,
    },
    ...store.closedOrders.filter((item) => item.prepOrderId !== prepOrderId),
  ]
  persistProductionMaterialPrepStore(store, storage)
}

export function appendPickupRecordFromPrepRecord(
  input: {
    prepRecordId: string
    prepLineId?: string
    pickedQty: number
    rollCount: number
    receiverName: string
    warehouseArea: string
    locationCode: string
    waitProcessLedgerEventId: string
    differenceReason?: string
  },
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): PickupRecord {
  const context = input.prepLineId
    ? getMaterialPrepRecordContext(input.prepRecordId, input.prepLineId, storage)
    : getMaterialPrepRecordContext(input.prepRecordId, storage)
  if (!context) {
    throw new Error(`配料记录不存在：${input.prepRecordId}`)
  }
  if (context.record.recordStatus !== 'CONFIRMED') {
    throw new Error('未确认或已打回的配料记录不可领料')
  }
  const occurredAt = nowText()
  const differenceQty = roundQty(Number(input.pickedQty || 0) - context.availableToPickupQty)
  const pickupRecord: PickupRecord = {
    pickupRecordId: `pickup:${input.prepRecordId}:${context.item.prepLineId}:${occurredAt.replace(/[^0-9]/g, '')}`,
    prepRecordId: input.prepRecordId,
    prepOrderId: context.record.prepOrderId,
    prepLineId: context.item.prepLineId,
    productionOrderId: context.projection.order.productionOrderId,
    pickedQty: roundQty(input.pickedQty),
    rollCount: Math.max(Math.round(input.rollCount || 1), 1),
    receiverName: input.receiverName,
    pickedAt: occurredAt,
    warehouseArea: input.warehouseArea,
    locationCode: input.locationCode,
    waitProcessLedgerEventId: input.waitProcessLedgerEventId,
    differenceQty,
    differenceReason: input.differenceReason || (differenceQty ? '现场按实领料' : ''),
    pickupStatus: differenceQty ? '差异领料' : '已入待加工仓',
    remark: '与配料记录关联的领料记录。',
  }
  const store = hydrateProductionMaterialPrepStore(storage)
  store.pickupRecords = [pickupRecord, ...store.pickupRecords]
  persistProductionMaterialPrepStore(store, storage)
  return cloneRecord(pickupRecord)
}

export function buildPrepLedgerRows(): MaterialLedgerProjection[] {
  const knownCutOrderIds = new Set(materialPrepSeedOrders.flatMap((order) => order.lines.map((line) => line.cutOrderId)))
  return listMaterialLedgerProjections().filter((row) => knownCutOrderIds.has(row.cutOrderId))
}
