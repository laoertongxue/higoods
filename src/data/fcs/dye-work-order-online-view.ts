import {
  getDyeOrderHandoverSummary,
  getDyeReviewRecordByOrderId,
  listDyeWorkOrders,
  type DyeWorkOrder,
} from './dyeing-task-domain.ts'
import {
  getDyeWorkOrderOnlineRecord,
  type DyeWorkOrderOnlineStatus,
} from './dye-work-order-online-domain.ts'

export type DyeWorkOrderKeywordField =
  | 'all'
  | 'workOrderNo'
  | 'taskNo'
  | 'productionOrderNo'
  | 'purchaseOrderNo'
  | 'productCode'

export interface DyeWorkOrderOnlineFilters {
  keywordField: DyeWorkOrderKeywordField
  keyword: string
  statuses: DyeWorkOrderOnlineStatus[]
  salesType: string
  factoryName: string
  processName: string
  receiverName: string
  yarn: '全部' | '是' | '否'
  replenishment: '全部' | '是' | '否'
  gtgInStock: '全部' | '是' | '否'
  materialType: string
  colorNo: string
  timeField: 'orderedAt' | 'plannedFinishAt' | 'completedAt' | 'deliveredAt'
  startDate: string
  endDate: string
  composition: string
  width: string
  weightGsm: string
}

export interface DyeWorkOrderOnlineRow {
  dyeOrderId: string
  workOrderNo: string
  platformWorkOrderNo: string
  taskNo: string
  productionOrderNo: string
  productCode: string
  productImageUrl: string
  purchaseOrderNo: string
  purchaseType: string
  salesType: string
  receiverInventoryQty: number
  gtgInventoryQty: number
  materialName: string
  materialImageUrl: string
  rawMaterialSku: string
  colorSku: string
  colorNo: string
  composition: string
  width: string
  weightGsm: number | null
  processName: string
  factoryId: string
  factoryName: string
  receiverName: string
  status: DyeWorkOrderOnlineStatus
  shade: '' | '浅色' | '深色'
  temperature: 190 | 200 | 205 | null
  plannedQty: number
  qtyUnit: string
  rawMaterialQty: number
  rawMaterialRollCount: number
  preparedQty: number
  preparedWeightKg: number
  completedQty: number
  lossQty: number
  pendingWritebackQty: number
  differenceQty: number
  objectionQty: number
  pendingInboundQty: number
  orderedAt: string
  plannedFinishAt: string
  completedAt: string
  deliveredAt: string
  isOverdue: boolean
  isYarn: boolean
  isReplenishment: boolean
  materialType: string
  headVatOrRedye: string
  handoverOrderNo: string
  batchNo: string
  sourceType: 'PRODUCTION_ORDER' | 'STOCK'
  remark: string
}

export interface DyeWorkOrderUnitSummary {
  unit: string
  qty: number
}

export interface DyeWorkOrderOnlineSummary {
  plannedQtyByUnit: DyeWorkOrderUnitSummary[]
  rawMaterialQtyByUnit: DyeWorkOrderUnitSummary[]
  completedQtyByUnit: DyeWorkOrderUnitSummary[]
  lossQtyByUnit: DyeWorkOrderUnitSummary[]
  purchaseOrderCount: number
}

function relativeDemoFinishAt(days: number): string {
  const date = new Date()
  date.setHours(18, 0, 0, 0)
  date.setDate(date.getDate() + days)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day} 18:00:00`
}

const DYE_WORK_ORDER_PRESENTATION_FACTS: Record<string, Partial<Pick<DyeWorkOrderOnlineRow,
  'productImageUrl' | 'materialImageUrl' | 'materialName' | 'productCode' | 'salesType' | 'purchaseOrderNo' | 'purchaseType' | 'plannedFinishAt'
>>> = {
  'DWO-001': {
    productImageUrl: '/shirt-sample.jpg',
    materialImageUrl: '/materials/fabric-main.jpg',
    materialName: '细冰丝坑条 Td-s 025',
    plannedFinishAt: relativeDemoFinishAt(-2),
  },
  'DWO-002': {
    productImageUrl: '/cardigan-sample.jpg',
    materialImageUrl: '/materials/fabric-contrast.jpg',
    materialName: '牛奶丝 R063',
    plannedFinishAt: relativeDemoFinishAt(2),
  },
  'DWO-003': {
    productImageUrl: '/dress-sample-1.jpg',
    materialImageUrl: '/materials/fabric-lining.jpg',
    materialName: '50D 四面弹里布 S256',
    plannedFinishAt: relativeDemoFinishAt(-1),
  },
  'DWO-004': {
    productImageUrl: '/tshirt-sample.jpg',
    materialImageUrl: '/materials/yarn-stitching.jpg',
    materialName: '棉感针织布 K118',
  },
}

export const DEFAULT_DYE_WORK_ORDER_ONLINE_FILTERS: DyeWorkOrderOnlineFilters = {
  keywordField: 'all',
  keyword: '',
  statuses: [],
  salesType: '',
  factoryName: '',
  processName: '',
  receiverName: '',
  yarn: '全部',
  replenishment: '全部',
  gtgInStock: '全部',
  materialType: '',
  colorNo: '',
  timeField: 'orderedAt',
  startDate: '',
  endDate: '',
  composition: '',
  width: '',
  weightGsm: '',
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function makeRow(order: DyeWorkOrder): DyeWorkOrderOnlineRow {
  const online = getDyeWorkOrderOnlineRecord(order.dyeOrderId)
  const handover = getDyeOrderHandoverSummary(order.dyeOrderId)
  const presentation = DYE_WORK_ORDER_PRESENTATION_FACTS[order.dyeOrderId] || {}
  const receiptReview = getDyeReviewRecordByOrderId(order.dyeOrderId)
  const partialInbound = online.status === '部分入库'
  const plannedQty = order.plannedQty
  const rawMaterialQty = online.rawMaterialQty
  const completedQty = online.completedQty
  const lossQty = online.lossQty
  const orderedAt = order.productionOrderOrderedAt || order.createdAt
  const plannedFinishAt = online.plannedFinishAt || order.plannedFinishAt || presentation.plannedFinishAt || ''
  const isClosed = online.status === '取消' || online.status === '已完成'
  const expectedInboundQty = handover.submittedQty || completedQty || plannedQty
  const pendingInboundQty = partialInbound ? round(Math.max(0, expectedInboundQty - (receiptReview?.receivedQty || 0))) : 0
  const snapshot = order.formalProductionOrderSnapshot
  const productCode = presentation.productCode || snapshot?.spuCode || order.stockMaterialId || '—'
  const materialName = presentation.materialName || snapshot?.materialName || order.stockMaterialName || order.rawMaterialSku
  const isYarn = /纱|yarn/i.test(`${materialName} ${order.rawMaterialSku}`)
  return {
    dyeOrderId: order.dyeOrderId,
    workOrderNo: order.dyeOrderNo,
    platformWorkOrderNo: order.dyeOrderNo,
    taskNo: order.taskNo,
    productionOrderNo: order.sourceProductionOrderNo || '',
    productCode,
    productImageUrl: presentation.productImageUrl || '',
    purchaseOrderNo: presentation.purchaseOrderNo || (order.sourceType === 'STOCK' ? '备货创建' : '—'),
    purchaseType: presentation.purchaseType || (order.sourceType === 'STOCK' ? '备货' : '—'),
    salesType: presentation.salesType || '—',
    receiverInventoryQty: 0,
    gtgInventoryQty: 0,
    materialName,
    materialImageUrl: presentation.materialImageUrl || '',
    rawMaterialSku: order.rawMaterialSku,
    colorSku: `${order.rawMaterialSku}-${order.targetColor.replace(/\s+/g, '-')}`,
    colorNo: order.colorNo || order.targetColor || '—',
    composition: snapshot && order.composition === snapshot.materialName ? '—' : order.composition || '—',
    width: order.width || '—',
    weightGsm: order.weightGsm ?? null,
    processName: order.dyeProcessName || '匹染',
    factoryId: online.factoryId,
    factoryName: online.factoryName,
    receiverName: online.receiverName,
    status: online.status,
    shade: online.shade,
    temperature: online.temperature,
    plannedQty,
    qtyUnit: order.qtyUnit,
    rawMaterialQty,
    rawMaterialRollCount: online.rawMaterialRollCount,
    preparedQty: online.rawMaterialQty,
    preparedWeightKg: 0,
    completedQty,
    lossQty,
    pendingWritebackQty: handover.pendingWritebackCount,
    differenceQty: handover.diffQty,
    objectionQty: handover.objectionCount,
    pendingInboundQty,
    orderedAt,
    plannedFinishAt,
    completedAt: online.completedAt,
    deliveredAt: online.deliveredAt,
    isOverdue: Boolean(plannedFinishAt && new Date(plannedFinishAt).getTime() < Date.now() && !isClosed),
    isYarn,
    isReplenishment: order.isReplenishment === true,
    materialType: isYarn ? '纱线' : '面料',
    headVatOrRedye: '—',
    handoverOrderNo: order.handoverOrderNo || order.handoverOrderId || '',
    batchNo: order.sourceArtifactIds?.[1] || '—',
    sourceType: order.sourceType,
    remark: online.remark,
  }
}

export function listDyeWorkOrderOnlineRows(): DyeWorkOrderOnlineRow[] {
  return listDyeWorkOrders().map(makeRow)
}

function matchesBooleanFilter(value: boolean, filter: '全部' | '是' | '否'): boolean {
  return filter === '全部' || value === (filter === '是')
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase('zh-CN')
}

function keywordValue(row: DyeWorkOrderOnlineRow, field: DyeWorkOrderKeywordField): string {
  if (field === 'workOrderNo') return row.workOrderNo
  if (field === 'taskNo') return row.taskNo
  if (field === 'productionOrderNo') return row.productionOrderNo
  if (field === 'purchaseOrderNo') return row.purchaseOrderNo
  if (field === 'productCode') return row.productCode
  return [row.workOrderNo, row.taskNo, row.productionOrderNo, row.purchaseOrderNo, row.productCode].join(' ')
}

export function filterDyeWorkOrderOnlineRows(
  rows: DyeWorkOrderOnlineRow[],
  input: Partial<DyeWorkOrderOnlineFilters>,
): DyeWorkOrderOnlineRow[] {
  const filters = { ...DEFAULT_DYE_WORK_ORDER_ONLINE_FILTERS, ...input }
  const keyword = normalized(filters.keyword)
  return rows.filter((row) => {
    const time = row[filters.timeField]
    return (!keyword || normalized(keywordValue(row, filters.keywordField)).includes(keyword))
      && (!filters.statuses.length || filters.statuses.includes(row.status))
      && (!filters.salesType || row.salesType === filters.salesType)
      && (!filters.factoryName || row.factoryName === filters.factoryName)
      && (!filters.processName || row.processName === filters.processName)
      && (!filters.receiverName || row.receiverName === filters.receiverName)
      && matchesBooleanFilter(row.isYarn, filters.yarn)
      && matchesBooleanFilter(row.isReplenishment, filters.replenishment)
      && matchesBooleanFilter(row.gtgInventoryQty > 0, filters.gtgInStock)
      && (!filters.materialType || row.materialType === filters.materialType)
      && (!normalized(filters.colorNo) || normalized(row.colorNo).includes(normalized(filters.colorNo)))
      && (!normalized(filters.composition) || normalized(row.composition).includes(normalized(filters.composition)))
      && (!filters.width || row.width === filters.width)
      && (!filters.weightGsm || String(row.weightGsm || '') === filters.weightGsm)
      && (!filters.startDate || time.slice(0, 10) >= filters.startDate)
      && (!filters.endDate || time.slice(0, 10) <= filters.endDate)
  })
}

function sumByUnit(rows: DyeWorkOrderOnlineRow[], selector: (row: DyeWorkOrderOnlineRow) => number): DyeWorkOrderUnitSummary[] {
  const grouped = new Map<string, number>()
  rows.forEach((row) => grouped.set(row.qtyUnit, round((grouped.get(row.qtyUnit) || 0) + selector(row))))
  return [...grouped.entries()].map(([unit, qty]) => ({ unit, qty })).sort((a, b) => a.unit.localeCompare(b.unit, 'zh-CN'))
}

export function getDyeWorkOrderOnlineSummary(rows: DyeWorkOrderOnlineRow[]): DyeWorkOrderOnlineSummary {
  return {
    plannedQtyByUnit: sumByUnit(rows, (row) => row.plannedQty),
    rawMaterialQtyByUnit: sumByUnit(rows, (row) => row.rawMaterialQty),
    completedQtyByUnit: sumByUnit(rows, (row) => row.completedQty),
    lossQtyByUnit: sumByUnit(rows, (row) => row.lossQty),
    purchaseOrderCount: new Set(rows.map((row) => row.purchaseOrderNo).filter((value) => value && value !== '备货创建')).size,
  }
}

type DyeWorkOrderExportKind = '全部' | '备料' | '超期未完结'

function csvCell(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

export function buildDyeWorkOrderCsv(rows: DyeWorkOrderOnlineRow[], kind: DyeWorkOrderExportKind): string {
  const selectedRows = kind === '超期未完结' ? rows.filter((row) => row.isOverdue) : rows
  const columns: Array<[string, (row: DyeWorkOrderOnlineRow) => unknown]> = kind === '备料'
    ? [
        ['平台加工单号', (row) => row.platformWorkOrderNo],
        ['生产单号', (row) => row.productionOrderNo || '备货创建'],
        ['面料名称', (row) => row.materialName],
        ['原料SKU', (row) => row.rawMaterialSku],
        ['计划数量', (row) => `${row.plannedQty} ${row.qtyUnit}`],
        ['备料数量', (row) => `${row.preparedQty} ${row.qtyUnit}`],
        ['备料重量', (row) => `${row.preparedWeightKg} kg`],
      ]
    : [
        ['平台加工单号', (row) => row.platformWorkOrderNo],
        ['任务单号', (row) => row.taskNo],
        ['生产单号', (row) => row.productionOrderNo || '备货创建'],
        ['商品编码', (row) => row.productCode],
        ['采购单号', (row) => row.purchaseOrderNo],
        ['面料名称', (row) => row.materialName],
        ['染色色号', (row) => row.colorNo],
        ['状态', (row) => row.status],
        ['计划数量', (row) => `${row.plannedQty} ${row.qtyUnit}`],
        ['完成数量', (row) => `${row.completedQty} ${row.qtyUnit}`],
        ['损耗数量', (row) => `${row.lossQty} ${row.qtyUnit}`],
        ['预计完成时间', (row) => row.plannedFinishAt],
      ]
  return `\uFEFF${[
    columns.map(([label]) => csvCell(label)).join(','),
    ...selectedRows.map((row) => columns.map(([, getter]) => csvCell(getter(row))).join(',')),
  ].join('\n')}`
}
