import {
  buildFcsCuttingDomainSnapshot,
  type CuttingDomainSnapshot,
} from '../../domain/fcs-cutting-runtime/index.ts'
import type {
  CuttingConfigStatus,
  CuttingMaterialLine,
  CuttingOrderProgressRecord,
  CuttingReceiveStatus,
} from './cutting/types.ts'
import type { GeneratedOriginalCutOrderSourceRecord } from './cutting/generated-original-cut-orders.ts'
import {
  getCutPieceFeiTicketById,
  listCutPieceFeiTickets,
  type CutPieceFeiTicket,
} from './cutting/fei-ticket-generation.ts'

export type CuttingTaskPrintNodeRow = {
  rowId: string
  node: string
  startedAt: string
  finishedAt: string
  completedQty: string
  exceptionQty: string
  station: string
  operator: string
  remark: string
}

export interface CuttingOriginalOrderTaskPrintSource {
  originalCutOrderId: string
  originalCutOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  styleCode: string
  spuCode: string
  materialSku: string
  materialLabel: string
  materialCategory: string
  orderQty: number
  plannedQty: number
  plannedShipDate: string
  urgencyLabel: string
  prepStatusLabel: string
  claimStatusLabel: string
  currentStageLabel: string
  latestMergeBatchNo: string
  statusSummary: string
  relationSummary: string
  latestActionText: string
  nodeRows: CuttingTaskPrintNodeRow[]
}

export interface CuttingMergeBatchTaskPrintSource {
  mergeBatchId: string
  mergeBatchNo: string
  status: 'DRAFT' | 'READY' | 'CUTTING' | 'DONE' | 'CANCELLED'
  statusLabel: string
  styleCode: string
  spuCode: string
  materialSkuSummary: string
  sourceProductionOrderCount: number
  sourceOriginalCutOrderCount: number
  plannedCuttingGroup: string
  plannedCuttingDate: string
  note: string
  createdAt: string
  updatedAt: string
  firstProductionOrderId: string
  firstProductionOrderNo: string
  nodeRows: CuttingTaskPrintNodeRow[]
}

export interface CuttingPerPieceFeiTicketPrintSource {
  feiTicketId: string
  feiTicketNo: string
  sourcePieceInstanceId: string
  originalCutPieceOrderId: string
  originalCutPieceOrderNo: string
  mergeBatchId?: string
  mergeBatchNo?: string
  productionOrderId: string
  productionOrderNo: string
  pieceName: string
  colorName: string
  sizeName: string
  sequenceNo: number
  specialCraftSummary: string
  specialCrafts: CutPieceFeiTicket['specialCrafts']
  qrCodePayload: string
  printStatus: CutPieceFeiTicket['printStatus']
  flowStatus: CutPieceFeiTicket['flowStatus']
}

const CONFIG_STATUS_LABEL: Record<CuttingConfigStatus, string> = {
  NOT_CONFIGURED: '待配料',
  PARTIAL: '配料中',
  CONFIGURED: '已配料',
}

const RECEIVE_STATUS_LABEL: Record<CuttingReceiveStatus, string> = {
  NOT_RECEIVED: '待领料',
  PARTIAL: '部分领料',
  RECEIVED: '已领料',
}

const URGENCY_LABEL: Record<CuttingOrderProgressRecord['urgencyLevel'], string> = {
  AA: '特急',
  A: '加急',
  B: '较急',
  C: '常规',
  D: '低优先',
}

function numberText(value: number | undefined, unit: string): string {
  if (!Number.isFinite(value)) return '—'
  return `${Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 2 })} ${unit}`
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)))
}

function findOriginalSource(
  snapshot: CuttingDomainSnapshot,
  sourceId: string,
): GeneratedOriginalCutOrderSourceRecord | undefined {
  return snapshot.originalCutOrders.find(
    (record) => record.originalCutOrderId === sourceId || record.originalCutOrderNo === sourceId,
  )
}

function findProgressRecord(
  snapshot: CuttingDomainSnapshot,
  source: Pick<GeneratedOriginalCutOrderSourceRecord, 'productionOrderId'>,
): CuttingOrderProgressRecord | undefined {
  return snapshot.progressRecords.find((record) => record.productionOrderId === source.productionOrderId)
}

function findMaterialLine(
  progressRecord: CuttingOrderProgressRecord | undefined,
  source: Pick<GeneratedOriginalCutOrderSourceRecord, 'originalCutOrderId' | 'originalCutOrderNo' | 'materialSku'>,
): CuttingMaterialLine | undefined {
  return progressRecord?.materialLines.find(
    (line) =>
      line.originalCutOrderId === source.originalCutOrderId
      || line.originalCutOrderNo === source.originalCutOrderNo
      || line.cutPieceOrderNo === source.originalCutOrderNo
      || line.materialSku === source.materialSku,
  )
}

function getCurrentStage(progressRecord: CuttingOrderProgressRecord | undefined, line: CuttingMaterialLine | undefined): string {
  if (progressRecord?.cuttingStage) return progressRecord.cuttingStage
  if (line?.receiveStatus === 'RECEIVED') return '待裁'
  if (line?.configStatus === 'CONFIGURED') return '待领料'
  if (line?.configStatus === 'PARTIAL') return '配料中'
  return '待配料'
}

function buildOriginalOrderNodeRows(input: {
  source: GeneratedOriginalCutOrderSourceRecord
  progressRecord?: CuttingOrderProgressRecord
  line?: CuttingMaterialLine
  statusSummary: string
  relationSummary: string
  latestActionText: string
}): CuttingTaskPrintNodeRow[] {
  const { source, progressRecord, line, statusSummary, relationSummary, latestActionText } = input
  const unit = line?.materialType === 'SOLID' || line?.materialType === 'LINING' ? '米' : '件'
  const exceptionText = line?.issueFlags?.length ? `${line.issueFlags.length} 项` : '—'

  return [
    {
      rowId: `${source.originalCutOrderId}-prep`,
      node: '配料',
      startedAt: '—',
      finishedAt: '—',
      completedQty: numberText(line?.configuredLength, unit),
      exceptionQty: exceptionText,
      station: '—',
      operator: '—',
      remark: statusSummary,
    },
    {
      rowId: `${source.originalCutOrderId}-claim`,
      node: '领料',
      startedAt: '—',
      finishedAt: '—',
      completedQty: numberText(line?.receivedLength, unit),
      exceptionQty: exceptionText,
      station: '—',
      operator: '—',
      remark: latestActionText,
    },
    {
      rowId: `${source.originalCutOrderId}-merge`,
      node: '合批',
      startedAt: '—',
      finishedAt: '—',
      completedQty: numberText(source.requiredQty, '件'),
      exceptionQty: '—',
      station: '—',
      operator: '—',
      remark: relationSummary,
    },
    {
      rowId: `${source.originalCutOrderId}-current`,
      node: '当前阶段',
      startedAt: '—',
      finishedAt: '—',
      completedQty: numberText(source.requiredQty, '件'),
      exceptionQty: exceptionText,
      station: '—',
      operator: progressRecord?.lastOperatorName || '—',
      remark: latestActionText,
    },
  ]
}

export function getCuttingOriginalOrderTaskPrintSourceById(
  sourceId: string,
  snapshot: CuttingDomainSnapshot = buildFcsCuttingDomainSnapshot(),
): CuttingOriginalOrderTaskPrintSource | null {
  const source = findOriginalSource(snapshot, sourceId)
  if (!source) return null

  const progressRecord = findProgressRecord(snapshot, source)
  const line = findMaterialLine(progressRecord, source)
  const prepStatusLabel = CONFIG_STATUS_LABEL[line?.configStatus || 'NOT_CONFIGURED']
  const claimStatusLabel = RECEIVE_STATUS_LABEL[line?.receiveStatus || 'NOT_RECEIVED']
  const currentStageLabel = getCurrentStage(progressRecord, line)
  const latestMergeBatchNo = source.mergeBatchNo || line?.mergeBatchNo || ''
  const statusSummary = `${prepStatusLabel} / ${claimStatusLabel} / ${currentStageLabel}`
  const relationSummary = latestMergeBatchNo ? `最新裁片批次号：${latestMergeBatchNo}` : '当前未关联合并裁剪批次'
  const latestActionText =
    line?.latestActionText
    || (progressRecord?.lastFieldUpdateAt ? `最近更新：${progressRecord.lastFieldUpdateAt}` : '当前暂无独立执行日志')

  return {
    originalCutOrderId: source.originalCutOrderId,
    originalCutOrderNo: source.originalCutOrderNo,
    productionOrderId: source.productionOrderId,
    productionOrderNo: source.productionOrderNo,
    styleCode: progressRecord?.styleCode || source.sourceTechPackSpuCode,
    spuCode: progressRecord?.spuCode || source.sourceTechPackSpuCode,
    materialSku: source.materialSku,
    materialLabel: source.materialLabel,
    materialCategory: source.materialCategory,
    orderQty: progressRecord?.orderQty || source.skuScopeLines.reduce((total, item) => total + item.plannedQty, 0),
    plannedQty: source.requiredQty,
    plannedShipDate: progressRecord?.plannedShipDate || '—',
    urgencyLabel: progressRecord ? URGENCY_LABEL[progressRecord.urgencyLevel] : '常规',
    prepStatusLabel,
    claimStatusLabel,
    currentStageLabel,
    latestMergeBatchNo: latestMergeBatchNo || '—',
    statusSummary,
    relationSummary,
    latestActionText,
    nodeRows: buildOriginalOrderNodeRows({
      source,
      progressRecord,
      line,
      statusSummary,
      relationSummary,
      latestActionText,
    }),
  }
}

function normalizeMergeBatchStatus(value: string | undefined): CuttingMergeBatchTaskPrintSource['status'] {
  if (value === 'CUTTING' || value === 'DONE' || value === 'CANCELLED' || value === 'DRAFT' || value === 'READY') return value
  return 'READY'
}

function getMergeBatchStatusLabel(status: CuttingMergeBatchTaskPrintSource['status']): string {
  if (status === 'CUTTING') return '裁剪中'
  if (status === 'DONE') return '已完成'
  if (status === 'CANCELLED') return '已取消'
  return '待裁'
}

function parseBatchDateFromNo(mergeBatchNo: string): string {
  const match = mergeBatchNo.match(/(\d{2})(\d{2})(\d{2})/)
  if (!match) return ''
  return `20${match[1]}-${match[2]}-${match[3]}`
}

function inferMergeBatchStatus(rows: CuttingOriginalOrderTaskPrintSource[]): CuttingMergeBatchTaskPrintSource['status'] {
  if (rows.some((row) => /已完成|已入仓/.test(row.currentStageLabel))) return 'DONE'
  if (rows.some((row) => /裁片中|裁剪中|待入仓/.test(row.currentStageLabel))) return 'CUTTING'
  return 'READY'
}

function buildMergeBatchNodeRows(batch: CuttingMergeBatchTaskPrintSource): CuttingTaskPrintNodeRow[] {
  const visibleStatus = batch.status === 'DRAFT' ? 'READY' : batch.status
  const rows: CuttingTaskPrintNodeRow[] = [
    {
      rowId: `${batch.mergeBatchId}-created`,
      node: '创建批次',
      startedAt: batch.createdAt || '—',
      finishedAt: '—',
      completedQty: `${batch.sourceOriginalCutOrderCount} 单`,
      exceptionQty: '—',
      station: batch.plannedCuttingGroup || '—',
      operator: '—',
      remark: batch.plannedCuttingDate ? `计划裁剪日期：${batch.plannedCuttingDate}` : batch.note || '—',
    },
    {
      rowId: `${batch.mergeBatchId}-ready`,
      node: '待裁',
      startedAt: '—',
      finishedAt: '—',
      completedQty: '—',
      exceptionQty: '—',
      station: batch.plannedCuttingGroup || '—',
      operator: '—',
      remark: visibleStatus === 'READY' ? `当前状态：${batch.statusLabel}` : '已进入后续状态',
    },
  ]

  if (visibleStatus === 'CUTTING' || visibleStatus === 'DONE') {
    rows.push({
      rowId: `${batch.mergeBatchId}-cutting`,
      node: '裁剪中',
      startedAt: '—',
      finishedAt: '—',
      completedQty: visibleStatus === 'DONE' ? `${batch.sourceOriginalCutOrderCount} 单` : '—',
      exceptionQty: '—',
      station: batch.plannedCuttingGroup || '—',
      operator: '—',
      remark: batch.updatedAt ? `最近更新：${batch.updatedAt}` : `当前状态：${batch.statusLabel}`,
    })
  }

  if (visibleStatus === 'DONE' || visibleStatus === 'CANCELLED') {
    rows.push({
      rowId: `${batch.mergeBatchId}-${visibleStatus.toLowerCase()}`,
      node: visibleStatus === 'DONE' ? '已完成' : '已取消',
      startedAt: '—',
      finishedAt: '—',
      completedQty: visibleStatus === 'DONE' ? `${batch.sourceOriginalCutOrderCount} 单` : '—',
      exceptionQty: '—',
      station: batch.plannedCuttingGroup || '—',
      operator: '—',
      remark: batch.updatedAt ? `最近更新：${batch.updatedAt}` : batch.note || '—',
    })
  }

  return rows
}

function buildStoredMergeBatchSource(raw: Record<string, unknown>): CuttingMergeBatchTaskPrintSource | null {
  const mergeBatchId = typeof raw.mergeBatchId === 'string' ? raw.mergeBatchId : ''
  const mergeBatchNo = typeof raw.mergeBatchNo === 'string' ? raw.mergeBatchNo : ''
  if (!mergeBatchId || !mergeBatchNo) return null
  const status = normalizeMergeBatchStatus(typeof raw.status === 'string' ? raw.status : undefined)
  const items = Array.isArray(raw.items) ? raw.items.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object')) : []
  const originalNos = unique(items.map((item) => (typeof item.originalCutOrderNo === 'string' ? item.originalCutOrderNo : '')))
  const productionNos = unique(items.map((item) => (typeof item.productionOrderNo === 'string' ? item.productionOrderNo : '')))
  const materialSkus = unique(items.map((item) => (typeof item.materialSku === 'string' ? item.materialSku : '')))
  const batch: CuttingMergeBatchTaskPrintSource = {
    mergeBatchId,
    mergeBatchNo,
    status,
    statusLabel: getMergeBatchStatusLabel(status),
    styleCode: typeof raw.styleCode === 'string' ? raw.styleCode : '',
    spuCode: typeof raw.spuCode === 'string' ? raw.spuCode : '',
    materialSkuSummary: typeof raw.materialSkuSummary === 'string' ? raw.materialSkuSummary : materialSkus.join(' / '),
    sourceProductionOrderCount: Number(raw.sourceProductionOrderCount || productionNos.length || 0),
    sourceOriginalCutOrderCount: Number(raw.sourceOriginalCutOrderCount || originalNos.length || 0),
    plannedCuttingGroup: typeof raw.plannedCuttingGroup === 'string' ? raw.plannedCuttingGroup : '',
    plannedCuttingDate: typeof raw.plannedCuttingDate === 'string' ? raw.plannedCuttingDate : '',
    note: typeof raw.note === 'string' ? raw.note : '',
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : '',
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : '',
    firstProductionOrderId: typeof items[0]?.productionOrderId === 'string' ? items[0].productionOrderId : '',
    firstProductionOrderNo: productionNos[0] || '',
    nodeRows: [],
  }
  batch.nodeRows = buildMergeBatchNodeRows(batch)
  return batch
}

export function listCuttingMergeBatchTaskPrintSources(
  snapshot: CuttingDomainSnapshot = buildFcsCuttingDomainSnapshot(),
): CuttingMergeBatchTaskPrintSource[] {
  const originalRows = snapshot.originalCutOrders
    .map((source) => getCuttingOriginalOrderTaskPrintSourceById(source.originalCutOrderId, snapshot))
    .filter((source): source is CuttingOriginalOrderTaskPrintSource => Boolean(source))
  const originalsById = new Map(originalRows.map((row) => [row.originalCutOrderId, row]))
  const byId = new Map<string, CuttingMergeBatchTaskPrintSource>()

  snapshot.mergeBatchState.sourceRecords.forEach((record) => {
    const rows = record.sourceOriginalCutOrderIds
      .map((id) => originalsById.get(id))
      .filter((row): row is CuttingOriginalOrderTaskPrintSource => Boolean(row))
    if (!rows.length) return
    const status = inferMergeBatchStatus(rows)
    const plannedDate = parseBatchDateFromNo(record.mergeBatchNo)
    const batch: CuttingMergeBatchTaskPrintSource = {
      mergeBatchId: record.mergeBatchId,
      mergeBatchNo: record.mergeBatchNo,
      status,
      statusLabel: getMergeBatchStatusLabel(status),
      styleCode: rows[0]?.styleCode || '',
      spuCode: rows[0]?.spuCode || '',
      materialSkuSummary: unique(rows.map((row) => row.materialSku)).join(' / '),
      sourceProductionOrderCount: unique(rows.map((row) => row.productionOrderId)).length,
      sourceOriginalCutOrderCount: rows.length,
      plannedCuttingGroup: '',
      plannedCuttingDate: plannedDate,
      note: '来源于裁片 runtime 主源聚合。',
      createdAt: plannedDate ? `${plannedDate} 09:00` : '',
      updatedAt: plannedDate ? `${plannedDate} 09:00` : '',
      firstProductionOrderId: rows[0]?.productionOrderId || '',
      firstProductionOrderNo: rows[0]?.productionOrderNo || '',
      nodeRows: [],
    }
    batch.nodeRows = buildMergeBatchNodeRows(batch)
    byId.set(batch.mergeBatchId, batch)
  })

  snapshot.mergeBatchState.storedRecords
    .map((record) => buildStoredMergeBatchSource(record))
    .filter((record): record is CuttingMergeBatchTaskPrintSource => Boolean(record))
    .forEach((record) => byId.set(record.mergeBatchId, record))

  return Array.from(byId.values())
}

export function getCuttingMergeBatchTaskPrintSourceById(
  sourceId: string,
  snapshot: CuttingDomainSnapshot = buildFcsCuttingDomainSnapshot(),
): CuttingMergeBatchTaskPrintSource | null {
  return listCuttingMergeBatchTaskPrintSources(snapshot).find(
    (record) => record.mergeBatchId === sourceId || record.mergeBatchNo === sourceId,
  ) || null
}

function mapPerPieceTicketPrintSource(ticket: CutPieceFeiTicket): CuttingPerPieceFeiTicketPrintSource {
  return {
    feiTicketId: ticket.feiTicketId,
    feiTicketNo: ticket.feiTicketNo,
    sourcePieceInstanceId: ticket.sourcePieceInstanceId,
    originalCutPieceOrderId: ticket.originalCutPieceOrderId,
    originalCutPieceOrderNo: ticket.originalCutPieceOrderNo,
    mergeBatchId: ticket.mergeBatchId || '',
    mergeBatchNo: ticket.mergeBatchNo || '',
    productionOrderId: ticket.productionOrderId,
    productionOrderNo: ticket.productionOrderNo,
    pieceName: ticket.pieceName,
    colorName: ticket.colorName,
    sizeName: ticket.sizeName,
    sequenceNo: ticket.sequenceNo,
    specialCraftSummary: ticket.specialCraftSummary,
    specialCrafts: ticket.specialCrafts.map((craft) => ({ ...craft })),
    qrCodePayload: ticket.qrCodePayload,
    printStatus: ticket.printStatus,
    flowStatus: ticket.flowStatus,
  }
}

export function listCuttingPerPieceFeiTicketPrintSources(): CuttingPerPieceFeiTicketPrintSource[] {
  return listCutPieceFeiTickets().map(mapPerPieceTicketPrintSource)
}

export function getCuttingPerPieceFeiTicketPrintSourceById(sourceId: string): CuttingPerPieceFeiTicketPrintSource | null {
  const ticket = getCutPieceFeiTicketById(sourceId)
  return ticket ? mapPerPieceTicketPrintSource(ticket) : null
}
