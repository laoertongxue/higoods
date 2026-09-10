import { listWarehouseIssueOrders, listWarehouseInternalTransferOrders } from './warehouse-material-execution.ts'
import { listPdaHandoverHeads, getPdaHandoverRecordsByHead } from './pda-handover-events.ts'
import { getDyeMaterialReceiptOptions } from './dyeing-material-receipts.ts'
import { getProcessOrderTaskRelationView } from './process-order-task-links.ts'
import {
  listDyeWorkOrders,
  listDyeExecutionNodeRecords,
  getDyeOrderHandoverRecords,
  type DyeWorkOrder,
} from './dyeing-task-domain.ts'
import {
  getDyeWorkOrderOnlineRecord,
  type DyeWorkOrderOnlineStatus,
} from './dye-work-order-online-domain.ts'
import {
  PROCESS_WORK_ORDER_SOURCE_LABEL,
  type ProcessWorkOrderSourceType,
} from './process-work-order-domain.ts'
import {
  PROCESS_ORDER_HANDOVER_STATUS_LABEL,
  PROCESS_ORDER_PROCESSING_STATUS_LABEL,
  PROCESS_ORDER_RECEIPT_STATUS_LABEL,
  type ProcessOrderHandoverStatus,
  type ProcessOrderInputSourceType,
  type ProcessOrderProcessingStatus,
  type ProcessOrderReceiptStatus,
} from './process-order-flow-contract.ts'
import { getDyeWorkOrderThreeAxisView } from './process-order-three-axis-view.ts'
import { getDyeOrderImageManifest } from './process-order-image-manifest.ts'
import { productionOrders } from './production-orders.ts'

export type DyeWorkOrderKeywordField =
  | 'all'
  | 'workOrderNo'
  | 'taskNo'
  | 'productionOrderNo'
  | 'purchaseOrderNo'
  | 'productCode'

export interface DyeWorkOrderOnlineFilters {
  keywordField: DyeWorkOrderKeywordField
  upstreamName: string
  exception: string
  keyword: string
  statuses: DyeWorkOrderOnlineStatus[]
  receiptStatus: '' | ProcessOrderReceiptStatus
  processingStatus: '' | ProcessOrderProcessingStatus
  handoverStatus: '' | ProcessOrderHandoverStatus
  salesType: string
  factoryName: string
  processName: string
  receiverName: string
  sourceType: '' | ProcessWorkOrderSourceType
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
  usageKnown: boolean
  receiptKnown: boolean
  lossKnown: boolean
  upstreamName: string
  upstreamLinks: Array<{label: string; href?: string}>
  downstreamLinks: Array<{label: string; href?: string}>
  receiptRecords: Array<{receiptId: string; upstreamRecordId?: string; qty: number; receiverName: string; receivedAt: string}>
  executionRecords: Array<{nodeName: string; operatorName: string; startedAt?: string; finishedAt?: string; inputQty?: number; outputQty?: number; lossQty?: number; qtyUnit: string}>
  handoverRecords: ReturnType<typeof getDyeOrderHandoverRecords>
  dyeOrderId: string
  workOrderNo: string
  platformWorkOrderNo: string
  taskNo: string
  productionOrderNo: string
  productCode: string
  productName: string
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
  receiverWarehouseName: string
  receiverReady: boolean
  status: DyeWorkOrderOnlineStatus
  receiptStatus: ProcessOrderReceiptStatus
  receiptStatusLabel: string
  processingStatus: ProcessOrderProcessingStatus
  processingStatusLabel: string
  handoverStatus: ProcessOrderHandoverStatus
  handoverStatusLabel: string
  inputSourceMode: ProcessOrderInputSourceType | 'UNRESOLVED'
  inputSourceDocumentNos: string[]
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
  receivedInputQty: number
  handedOverQty: number
  downstreamReceivedQty: number
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
  sourceType: ProcessWorkOrderSourceType
  sourceLabel: string
  remark: string
}

export interface DyeWorkOrderUnitSummary {
  unit: string
  qty: number
}

export interface DyeWorkOrderOnlineSummary {
  receivedQtyByUnit: DyeWorkOrderUnitSummary[]
  pendingQtyByUnit: DyeWorkOrderUnitSummary[]
  unknownUsageCount: number
  unknownReceiptCount: number
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
  'productImageUrl' | 'materialImageUrl' | 'materialName' | 'productCode' | 'productName' | 'salesType' | 'purchaseOrderNo' | 'purchaseType' | 'plannedFinishAt'
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
  'DYE-COMBINED-DEMO-001': {
    productCode: 'SPU-COMBINED-901',
    productName: '藏青基础款上衣',
  },
  'DYE-COMBINED-DEMO-002': {
    productCode: 'SPU-COMBINED-902',
    productName: '藏青基础款下装',
  },
}

export const DEFAULT_DYE_WORK_ORDER_ONLINE_FILTERS: DyeWorkOrderOnlineFilters = {
  keywordField: 'all',
  keyword: '',
  upstreamName: '',
  exception: '',
  statuses: [],
  receiptStatus: '',
  processingStatus: '',
  handoverStatus: '',
  salesType: '',
  factoryName: '',
  processName: '',
  receiverName: '',
  sourceType: '',
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

export function getDyePendingReceiptQty(records: ReturnType<typeof getDyeOrderHandoverRecords>): number {
  return round(records.reduce((sum, record) => {
    if (record.handoverRecordStatus === 'VOIDED' || record.factoryDiffDecision === 'ACCEPT_DIFF' || record.objectionStatus === 'RESOLVED') return sum
    const received = record.taskReceipts?.length ? record.taskReceipts.reduce((qty, receipt) => qty + receipt.qty, 0) : record.receiverWrittenQty ?? record.warehouseWrittenQty ?? 0
    return sum + Math.max(0, (record.submittedQty ?? record.plannedQty ?? 0) - received)
  }, 0))
}

function makeRow(order: DyeWorkOrder): DyeWorkOrderOnlineRow {
  const online = getDyeWorkOrderOnlineRecord(order.dyeOrderId)
  const axes = getDyeWorkOrderThreeAxisView(order)
  const presentation = DYE_WORK_ORDER_PRESENTATION_FACTS[order.dyeOrderId] || {}
  const images = getDyeOrderImageManifest(order.dyeOrderId)
  const plannedQty = order.plannedQty
  const executionRecords = [...(order.completedExecutionBatches ?? []).flat(), ...listDyeExecutionNodeRecords(order.dyeOrderId)]
  const dyeNodes = executionRecords.filter(node => node.nodeCode === 'DYE' && node.qtyUnit === order.qtyUnit)
  const rawMaterialQty = dyeNodes.reduce((sum, node) => sum + (node.inputQty ?? 0), 0)
  const usageKnown = dyeNodes.some(node => typeof node.inputQty === 'number') || (!dyeNodes.some(node => node.startedAt) && !executionRecords.some(node => ['DYE','PACK'].includes(node.nodeCode) && (node.outputQty ?? 0) > 0))
  const completedQty = axes.completedQty
  const confirmedLossNodes = executionRecords.filter(node => node.finishedAt && node.qtyUnit === order.qtyUnit && typeof node.lossQty === 'number')
  const lossQty = round(confirmedLossNodes.reduce((sum, node) => sum + (node.lossQty ?? 0), 0))
  const receiptKnown = Boolean(order.materialReceipts?.length) || (!rawMaterialQty && !completedQty && axes.processingStatus !== 'PROCESSING')
  const source = getDyeMaterialReceiptOptions(order.dyeOrderId)
  const relation = getProcessOrderTaskRelationView(order.dyeOrderId)
  const upstreamLinks = (relation?.predecessors ?? []).filter(item => item.documentKind !== 'SOURCE_DOCUMENT').map(item => ({label: `${item.processName} · ${item.documentNo}`, href: item.href}))
  const downstreamLinks = (relation?.successors ?? []).filter(item => item.documentKind !== 'SOURCE_DOCUMENT').map(item => ({label: `${item.processName} · ${item.documentNo}`, href: item.href}))
  const consumedSourceIds = new Set((order.materialReceipts ?? []).map(item => item.upstreamRecordId).filter(Boolean))
  const historicalWarehouseNames = [...listWarehouseIssueOrders(), ...listWarehouseInternalTransferOrders()].filter(doc => doc.lines.some(line => consumedSourceIds.has(line.lineId))).map(doc => doc.warehouseName)
  const historicalFactoryNames = listPdaHandoverHeads().filter(head => getPdaHandoverRecordsByHead(head.handoverId).some(record => consumedSourceIds.has(record.handoverRecordId || record.recordId))).map(head => head.sourceFactoryName)
  const upstreamName = [...new Set([...historicalWarehouseNames, ...historicalFactoryNames, ...source.options.map(item => item.sourceWarehouseName)].filter(Boolean))].join(' / ') || upstreamLinks.map(item => item.label).join(' / ') || (source.sourceMode === 'CENTRAL_TRANSFER' ? '供料仓待补充' : '上游待确定')
  const orderedAt = order.productionOrderOrderedAt || order.createdAt
  const plannedFinishAt = online.plannedFinishAt || order.plannedFinishAt || presentation.plannedFinishAt || ''
  const isClosed = online.status === '取消' || online.status === '已完成'
  const handoverRecords = getDyeOrderHandoverRecords(order.dyeOrderId)
  const pendingInboundQty = getDyePendingReceiptQty(handoverRecords)
  const snapshot = order.formalProductionOrderSnapshot
  const sourceProductionOrder = order.sourceType === 'PRODUCTION_ORDER'
    ? productionOrders.find((item) => item.productionOrderId === order.sourceProductionOrderId
      || item.productionOrderId === order.productionOrderIds?.[0]
      || item.productionOrderNo === order.sourceProductionOrderNo)
    : undefined
  const productCode = presentation.productCode
    || snapshot?.spuCode
    || sourceProductionOrder?.demandSnapshot.spuCode
    || order.stockMaterialId
    || '—'
  const productName = presentation.productName
    || sourceProductionOrder?.demandSnapshot.spuName
    || (order.sourceType === 'STOCK' ? order.stockMaterialName || '备货物料' : '')
    || (order.sourceType === 'CUT_PIECE_SUPPLEMENT' ? '生产补料' : '')
    || '商品名称待补齐'
  const materialName = presentation.materialName || snapshot?.materialName || order.stockMaterialName || order.rawMaterialSku
  const snapshotMaterialTypes = [...new Set(
    (snapshot?.materialItems ?? [])
      .map((item) => item.materialType?.trim())
      .filter((value): value is string => Boolean(value)),
  )]
  const materialType = snapshotMaterialTypes.length === 1
    ? snapshotMaterialTypes[0]
    : /纱|yarn/i.test(`${materialName} ${order.rawMaterialSku}`) ? '纱线' : '面料'
  const isYarn = materialType === '纱线' || /纱|yarn/i.test(materialType)
  return {
    usageKnown, receiptKnown, lossKnown: confirmedLossNodes.length > 0 || (usageKnown && rawMaterialQty === 0),
    upstreamName, upstreamLinks, downstreamLinks,
    receiptRecords: order.materialReceipts ?? [], executionRecords,
    handoverRecords,
    dyeOrderId: order.dyeOrderId,
    workOrderNo: order.dyeOrderNo,
    platformWorkOrderNo: order.dyeOrderNo,
    taskNo: order.taskNo,
    productionOrderNo: order.sourceProductionOrderNo || '',
    productCode,
    productName,
    productImageUrl: images?.product || presentation.productImageUrl || '',
    purchaseOrderNo: presentation.purchaseOrderNo || (order.sourceType === 'STOCK'
      ? '备货创建'
      : order.sourceType === 'CUT_PIECE_SUPPLEMENT'
        ? (order.sourceSnapshot?.supplementRecordNo || '补料创建')
        : '—'),
    purchaseType: presentation.purchaseType || (order.sourceType === 'STOCK'
      ? '备货'
      : order.sourceType === 'CUT_PIECE_SUPPLEMENT'
        ? '补料'
        : '—'),
    salesType: presentation.salesType || sourceProductionOrder?.demandSnapshot.saleType || (order.sourceType === 'STOCK' ? '采购备货' : '—'),
    receiverInventoryQty: 0,
    gtgInventoryQty: 0,
    materialName,
    materialImageUrl: images?.material || presentation.materialImageUrl || '',
    rawMaterialSku: order.rawMaterialSku,
    colorSku: '',
    colorNo: [order.colorNo, order.targetColor].find(value => value && !/^(TDV|tdv)[-_]/.test(value)) || '目标色号待补充',
    composition: order.composition && ![snapshot?.materialName, ...(snapshot?.materialItems ?? []).map(item => item.materialName)].includes(order.composition) && !/主面料|放行|补料|净色/.test(order.composition) ? order.composition : '成分待补充',
    width: order.width || '—',
    weightGsm: order.weightGsm ?? null,
    processName: order.dyeProcessName || '匹染',
    factoryId: online.factoryId,
    factoryName: online.factoryName,
    receiverName: axes.receiver.receiverName,
    receiverWarehouseName: axes.receiver.receiverWarehouseName,
    receiverReady: axes.receiver.ready,
    status: online.status,
    receiptStatus: axes.receiptStatus,
    receiptStatusLabel: PROCESS_ORDER_RECEIPT_STATUS_LABEL[axes.receiptStatus],
    processingStatus: axes.processingStatus,
    processingStatusLabel: PROCESS_ORDER_PROCESSING_STATUS_LABEL[axes.processingStatus],
    handoverStatus: axes.handoverStatus,
    handoverStatusLabel: PROCESS_ORDER_HANDOVER_STATUS_LABEL[axes.handoverStatus],
    inputSourceMode: axes.sourceMode,
    inputSourceDocumentNos: axes.sourceDocumentNos,
    shade: online.shade,
    temperature: online.temperature,
    plannedQty,
    qtyUnit: order.qtyUnit,
    rawMaterialQty,
    rawMaterialRollCount: online.rawMaterialRollCount,
    preparedQty: axes.receivedInputQty,
    preparedWeightKg: 0,
    completedQty,
    lossQty,
    pendingWritebackQty: 0,
    differenceQty: Math.max(0, axes.handedOverQty - axes.downstreamReceivedQty),
    objectionQty: 0,
    pendingInboundQty,
    receivedInputQty: axes.receivedInputQty,
    handedOverQty: axes.handedOverQty,
    downstreamReceivedQty: axes.downstreamReceivedQty,
    orderedAt,
    plannedFinishAt,
    completedAt: online.completedAt,
    deliveredAt: online.deliveredAt,
    isOverdue: Boolean(plannedFinishAt && new Date(plannedFinishAt).getTime() < Date.now() && !isClosed),
    isYarn,
    isReplenishment: order.isReplenishment === true,
    materialType,
    headVatOrRedye: '—',
    handoverOrderNo: order.handoverOrderNo || order.handoverOrderId || '',
    batchNo: order.sourceArtifactIds?.[1] || '—',
    sourceType: order.sourceType,
    sourceLabel: PROCESS_WORK_ORDER_SOURCE_LABEL[order.sourceType],
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
  return [row.workOrderNo, row.taskNo, row.productionOrderNo, row.purchaseOrderNo, row.productCode, row.productName, row.materialName, row.rawMaterialSku, row.upstreamName, row.receiverName, row.handoverOrderNo, ...row.inputSourceDocumentNos, ...row.downstreamLinks.map(item => item.label)].join(' ')
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
      && (!filters.receiptStatus || row.receiptStatus === filters.receiptStatus)
      && (!filters.processingStatus || row.processingStatus === filters.processingStatus)
      && (!filters.handoverStatus || row.handoverStatus === filters.handoverStatus)
      && (!filters.upstreamName || row.upstreamName === filters.upstreamName)
      && (!filters.exception || (filters.exception === '超期' ? row.isOverdue : filters.exception === '补料' ? row.isReplenishment : filters.exception === '历史待补录' ? !row.receiptKnown || !row.usageKnown : row.receiptStatus === 'RECEIPT_DIFFERENCE'))
      && (!filters.salesType || row.salesType === filters.salesType)
      && (!filters.factoryName || row.factoryName === filters.factoryName)
      && (!filters.processName || row.processName === filters.processName)
      && (!filters.receiverName || row.receiverName === filters.receiverName)
      && (!filters.sourceType || row.sourceType === filters.sourceType)
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
    receivedQtyByUnit: sumByUnit(rows.filter(row => row.receiptKnown), row => row.receivedInputQty),
    pendingQtyByUnit: sumByUnit(rows, row => row.pendingInboundQty),
    unknownUsageCount: rows.filter(row => !row.usageKnown).length,
    unknownReceiptCount: rows.filter(row => !row.receiptKnown).length,
    plannedQtyByUnit: sumByUnit(rows, (row) => row.plannedQty),
    rawMaterialQtyByUnit: sumByUnit(rows.filter(row => row.usageKnown), (row) => row.rawMaterialQty),
    completedQtyByUnit: sumByUnit(rows, (row) => row.completedQty),
    lossQtyByUnit: sumByUnit(rows, (row) => row.lossQty),
    purchaseOrderCount: new Set(rows.map((row) => row.purchaseOrderNo).filter((value) => value && value !== '备货创建')).size,
  }
}

type DyeWorkOrderExportKind = '全部' | '投入接收' | '超期未完结'

function csvCell(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

export function buildDyeWorkOrderCsv(rows: DyeWorkOrderOnlineRow[], kind: DyeWorkOrderExportKind): string {
  const selectedRows = kind === '超期未完结' ? rows.filter((row) => row.isOverdue) : rows
  const columns: Array<[string, (row: DyeWorkOrderOnlineRow) => unknown]> = kind === '投入接收'
    ? [
        ['平台加工单号', (row) => row.platformWorkOrderNo],
        ['生产单号', (row) => row.productionOrderNo || '备货创建'],
        ['面料名称', (row) => row.materialName],
        ['原料SKU', (row) => row.rawMaterialSku],
        ['计划数量', (row) => `${row.plannedQty} ${row.qtyUnit}`],
        ['接收状态', (row) => row.receiptStatusLabel],
        ['累计接收', (row) => row.receiptKnown ? `${row.receivedInputQty} ${row.qtyUnit}` : '历史接收待补录'],
        ['来源单据', (row) => row.inputSourceDocumentNos.join(' / ') || '尚无可接收来源'],
      ]
    : [
        ['平台加工单号', (row) => row.platformWorkOrderNo],
        ['任务单号', (row) => row.taskNo],
        ['生产单号', (row) => row.productionOrderNo || '备货创建'],
        ['商品编码', (row) => row.productCode],
        ['商品名称', (row) => row.productName],
        ['采购单号', (row) => row.purchaseOrderNo],
        ['面料名称', (row) => row.materialName],
        ['染色色号', (row) => row.colorNo],
        ['接收状态', (row) => row.receiptStatusLabel],
        ['加工状态', (row) => row.processingStatusLabel],
        ['交出状态', (row) => row.handoverStatusLabel],
        ['上游供料方', (row) => row.upstreamName],
        ['来源单据', (row) => row.inputSourceDocumentNos.join(' / ') || '待补录'],
        ['下游接收方', (row) => `${row.receiverName} / ${row.receiverWarehouseName}`],
        ['计划数量', (row) => `${row.plannedQty} ${row.qtyUnit}`],
        ['已接收', (row) => row.receiptKnown ? `${row.receivedInputQty} ${row.qtyUnit}` : '历史接收待补录'],
        ['完成数量', (row) => `${row.completedQty} ${row.qtyUnit}`],
        ['已交出', (row) => `${row.handedOverQty} ${row.qtyUnit}`],
        ['下游已收', (row) => `${row.downstreamReceivedQty} ${row.qtyUnit}`],
        ['下游待接收', (row) => `${row.pendingInboundQty} ${row.qtyUnit}`],
        ['实际使用', (row) => row.usageKnown ? `${row.rawMaterialQty} ${row.qtyUnit}` : '待补录'],
        ['确认损耗', (row) => row.lossKnown ? `${row.lossQty} ${row.qtyUnit}` : '待确认'],
        ['预计完成时间', (row) => row.plannedFinishAt],
      ]
  return `\uFEFF${[
    columns.map(([label]) => csvCell(label)).join(','),
    ...selectedRows.map((row) => columns.map(([, getter]) => csvCell(getter(row))).join(',')),
  ].join('\n')}`
}
