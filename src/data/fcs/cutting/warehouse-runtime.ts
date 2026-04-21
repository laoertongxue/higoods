import { buildCuttingCoreRegistry } from '../../../domain/cutting-core/index.ts'
import { productionOrders } from '../production-orders.ts'
import { listGeneratedOriginalCutOrderSourceRecords } from './generated-original-cut-orders.ts'
import { buildGeneratedFeiTicketTraceMatrix, listGeneratedFeiTickets } from './generated-fei-tickets.ts'
import { cuttingOrderProgressRecords } from './order-progress.ts'
import { buildSpreadingDrivenTransferBagTraceMatrix, buildSystemSeedTransferBagRuntime } from './transfer-bag-runtime.ts'
import type { CuttingConfigStatus, CuttingMaterialLine, CuttingMaterialType, CuttingReceiveStatus } from './types.ts'

export type CuttingFabricStockStatus = 'READY' | 'PARTIAL_USED' | 'NEED_RECHECK'
export type CutPieceZoneCode = 'A' | 'B' | 'C' | 'UNASSIGNED'
export type CutPieceInboundStatus = 'PENDING_INBOUND' | 'INBOUNDED' | 'WAITING_HANDOVER' | 'HANDED_OVER'
export type CutPieceHandoverStatus = 'WAITING_HANDOVER' | 'HANDED_OVER'
export type SampleLocationStage = 'DESIGN_CENTER' | 'CUTTING' | 'PMC_WAREHOUSE' | 'FACTORY_CHECK' | 'RETURN_CHECK' | 'BACK_TO_PMC'
export type SampleWarehouseStatus = 'IN_USE' | 'WAITING_RETURN' | 'AVAILABLE' | 'CHECKING'
export type WarehouseAlertType = 'SPACE_RISK' | 'UNASSIGNED_ZONE' | 'SAMPLE_OVERDUE' | 'STOCK_RECHECK'
export type WarehouseAlertLevel = 'HIGH' | 'MEDIUM' | 'LOW'
export type FormalWarehouseBindingState = 'BOUND_FORMAL_WAREHOUSE_RECORD' | 'UNBOUND_FORMAL_WAREHOUSE_RECORD'
export type FormalSampleBindingState = 'BOUND_FORMAL_SAMPLE_RECORD' | 'UNBOUND_FORMAL_SAMPLE_RECORD'

export interface CuttingFabricStockRecord {
  id: string
  warehouseType: 'CUTTING_FABRIC'
  bindingState: FormalWarehouseBindingState
  originalCutOrderId: string
  originalCutOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  mergeBatchId: string
  mergeBatchNo: string
  cutPieceOrderNo: string
  materialSku: string
  materialType: CuttingMaterialType
  materialLabel: string
  configuredRollCount: number
  configuredLength: number
  usedRollCount: number
  usedLength: number
  remainingRollCount: number
  remainingLength: number
  latestConfigAt: string
  latestReceiveAt: string
  latestActionText: string
  fabricState: CuttingFabricStockStatus
  note: string
}

export interface CutPieceWarehouseRecord {
  id: string
  warehouseType: 'CUT_PIECE'
  bindingState: FormalWarehouseBindingState
  originalCutOrderId: string
  originalCutOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  mergeBatchId: string
  mergeBatchNo: string
  cutPieceOrderNo: string
  materialSku: string
  groupNo: string
  zoneCode: CutPieceZoneCode
  locationLabel: string
  inboundStatus: CutPieceInboundStatus
  inboundAt: string
  inboundBy: string
  pieceSummary: string
  handoverStatus: CutPieceHandoverStatus
  handoverTarget: string
  note: string
}

export interface SampleFlowHistoryItem {
  stage: SampleLocationStage
  actionText: string
  operatedBy: string
  operatedAt: string
  note: string
}

export interface SampleWarehouseRecord {
  id: string
  warehouseType: 'SAMPLE'
  bindingState: FormalSampleBindingState
  originalCutOrderId: string
  originalCutOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  sampleNo: string
  sampleName: string
  relatedProductionOrderNo: string
  relatedCutPieceOrderNo: string
  currentLocationStage: SampleLocationStage
  currentHolder: string
  currentStatus: SampleWarehouseStatus
  latestActionAt: string
  latestActionBy: string
  nextSuggestedAction: string
  flowHistory: SampleFlowHistoryItem[]
}

export interface WarehouseAlertRecord {
  id: string
  warehouseAlertType: WarehouseAlertType
  level: WarehouseAlertLevel
  title: string
  description: string
  relatedNo: string
  suggestedAction: string
}

export interface WarehouseManagementFilters {
  cuttingFabric: {
    keyword: string
    materialType: 'ALL' | CuttingMaterialType
    fabricState: 'ALL' | CuttingFabricStockStatus
  }
  cutPiece: {
    keyword: string
    zoneCode: 'ALL' | CutPieceZoneCode
    inboundStatus: 'ALL' | CutPieceInboundStatus
    handoverStatus: 'ALL' | CutPieceHandoverStatus
  }
  sample: {
    keyword: string
    stage: 'ALL' | SampleLocationStage
    status: 'ALL' | SampleWarehouseStatus
  }
}

interface FormalWarehouseRuntimeCache {
  fabric: CuttingFabricStockRecord[]
  cutPiece: CutPieceWarehouseRecord[]
  sample: SampleWarehouseRecord[]
  alerts: WarehouseAlertRecord[]
}

const numberFormatter = new Intl.NumberFormat('zh-CN')
const registry = buildCuttingCoreRegistry()
const productionOrderById = new Map(productionOrders.map((order) => [order.productionOrderId, order] as const))

function resolveSourceProductionOrderNo(source: {
  productionOrderId: string
  productionOrderNo?: string
  originalCutOrderNo: string
}): string {
  const rawOrderNo = source.productionOrderNo || productionOrderById.get(source.productionOrderId)?.productionOrderNo
  return String(rawOrderNo || source.productionOrderId || source.originalCutOrderNo || '').trim()
}

const progressLineByOriginalId = new Map<string, CuttingMaterialLine>()
const progressLineByOriginalNo = new Map<string, CuttingMaterialLine>()
const progressRecordByOriginalId = new Map<string, (typeof cuttingOrderProgressRecords)[number]>()
const progressRecordByOriginalNo = new Map<string, (typeof cuttingOrderProgressRecords)[number]>()

cuttingOrderProgressRecords.forEach((record) => {
  record.materialLines.forEach((line) => {
    if (line.originalCutOrderId) {
      progressLineByOriginalId.set(line.originalCutOrderId, line)
      progressRecordByOriginalId.set(line.originalCutOrderId, record)
    }
    if (line.originalCutOrderNo) {
      progressLineByOriginalNo.set(line.originalCutOrderNo, line)
      progressRecordByOriginalNo.set(line.originalCutOrderNo, record)
    }
  })
})

function cloneFlowHistory(items: SampleFlowHistoryItem[]): SampleFlowHistoryItem[] {
  return items.map((item) => ({ ...item }))
}

function cloneFabricRecord(record: CuttingFabricStockRecord): CuttingFabricStockRecord {
  return { ...record }
}

function cloneCutPieceRecord(record: CutPieceWarehouseRecord): CutPieceWarehouseRecord {
  return { ...record }
}

function cloneSampleRecord(record: SampleWarehouseRecord): SampleWarehouseRecord {
  return {
    ...record,
    flowHistory: cloneFlowHistory(record.flowHistory),
  }
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values))
}

function resolveProgressLine(originalCutOrderId: string, originalCutOrderNo: string): CuttingMaterialLine | null {
  return progressLineByOriginalId.get(originalCutOrderId) || progressLineByOriginalNo.get(originalCutOrderNo) || null
}

function resolveProgressRecord(originalCutOrderId: string, originalCutOrderNo: string) {
  return progressRecordByOriginalId.get(originalCutOrderId) || progressRecordByOriginalNo.get(originalCutOrderNo) || null
}

function resolveConfiguredLength(requiredQty: number, materialType: CuttingMaterialType): number {
  const multiplier = materialType === 'LINING' ? 0.85 : materialType === 'PRINT' ? 1.35 : 1.15
  return Math.max(48, Math.round(requiredQty * multiplier))
}

function resolveConfiguredRollCount(configuredLength: number): number {
  return Math.max(1, Math.ceil(configuredLength / 58))
}

function resolveUsageByReceiveStatus(options: {
  receiveStatus: CuttingReceiveStatus
  configStatus: CuttingConfigStatus
  configuredRollCount: number
  configuredLength: number
  sequence: number
}): { fabricState: CuttingFabricStockStatus; usedRollCount: number; usedLength: number } {
  const { receiveStatus, configuredRollCount, configuredLength, sequence } = options
  if (receiveStatus === 'PARTIAL') {
    return {
      fabricState: 'NEED_RECHECK',
      usedRollCount: Math.max(1, Math.floor(configuredRollCount * 0.6)),
      usedLength: Math.round(configuredLength * 0.62),
    }
  }
  if (receiveStatus === 'RECEIVED') {
    const partial = sequence % 3 === 0
    return {
      fabricState: partial ? 'PARTIAL_USED' : 'READY',
      usedRollCount: partial ? Math.max(1, configuredRollCount - 1) : configuredRollCount,
      usedLength: partial ? Math.round(configuredLength * 0.82) : configuredLength,
    }
  }
  return {
    fabricState: 'READY',
    usedRollCount: 0,
    usedLength: 0,
  }
}

function buildFabricActionText(line: CuttingMaterialLine | null, originalCutOrderNo: string): string {
  if (line?.latestActionText) return line.latestActionText
  return `原始裁片单 ${originalCutOrderNo} 的裁床仓记录已切到正式主源，待现场继续确认领用节奏。`
}

function buildPieceSummaryText(requiredQty: number, pieceName: string): string {
  return `${pieceName} ${numberFormatter.format(Math.max(requiredQty, 0))} 件，已进入正式裁片仓读链。`
}

function buildSampleFlowHistory(options: {
  sampleItemId: string
  sampleNo: string
  sampleName: string
  currentLocationStage: SampleLocationStage
  latestActionAt: string
  latestActionBy: string
}): SampleFlowHistoryItem[] {
  const base = options.latestActionAt.slice(0, 10)
  const initialBy = '样衣管理员 陈如意'
  const initialHistory: SampleFlowHistoryItem[] = [
    {
      stage: 'DESIGN_CENTER',
      actionText: `设计中心完成 ${options.sampleName}`,
      operatedBy: '设计师 林若彤',
      operatedAt: `${base} 09:00`,
      note: `${options.sampleNo} 首版样衣完成。`,
    },
    {
      stage: 'PMC_WAREHOUSE',
      actionText: '样衣进入 PMC 仓库',
      operatedBy: initialBy,
      operatedAt: `${base} 12:00`,
      note: '等待裁床或工厂调用。',
    },
  ]

  if (options.currentLocationStage === 'PMC_WAREHOUSE' || options.currentLocationStage === 'BACK_TO_PMC') {
    return initialHistory.concat({
      stage: 'BACK_TO_PMC',
      actionText: '样衣回到 PMC 仓库',
      operatedBy: options.latestActionBy,
      operatedAt: options.latestActionAt,
      note: '当前可再次调用。',
    })
  }

  return initialHistory.concat({
    stage: options.currentLocationStage,
    actionText:
      options.currentLocationStage === 'CUTTING'
        ? '裁床调用样衣'
        : options.currentLocationStage === 'FACTORY_CHECK'
          ? '工厂核价调用样衣'
          : '样衣进入回仓抽检',
    operatedBy: options.latestActionBy,
    operatedAt: options.latestActionAt,
    note:
      options.currentLocationStage === 'CUTTING'
        ? '用于裁片版位和工艺确认。'
        : options.currentLocationStage === 'FACTORY_CHECK'
          ? '用于工厂侧工艺与核价确认。'
          : '用于回仓抽检与复核。',
  })
}

function buildFormalWarehouseRuntimeCache(): FormalWarehouseRuntimeCache {
  const originalSources = listGeneratedOriginalCutOrderSourceRecords()
  const fabric: CuttingFabricStockRecord[] = originalSources.map((source, index) => {
    const productionOrderNo = resolveSourceProductionOrderNo(source)
    const progressLine = resolveProgressLine(source.originalCutOrderId, source.originalCutOrderNo)
    const progressRecord = resolveProgressRecord(source.originalCutOrderId, source.originalCutOrderNo)
    const originalRef = registry.originalCutOrdersById[source.originalCutOrderId]
    const configuredLength = progressLine?.configuredLength || resolveConfiguredLength(source.requiredQty, source.materialType)
    const configuredRollCount = progressLine?.configuredRollCount || resolveConfiguredRollCount(configuredLength)
    const usage = resolveUsageByReceiveStatus({
      receiveStatus: progressLine?.receiveStatus || 'NOT_RECEIVED',
      configStatus: progressLine?.configStatus || 'NOT_CONFIGURED',
      configuredRollCount,
      configuredLength,
      sequence: index,
    })
    const usedRollCount = Math.min(configuredRollCount, usage.usedRollCount)
    const usedLength = Math.min(configuredLength, usage.usedLength)
    const remainingRollCount = Math.max(configuredRollCount - usedRollCount, 0)
    const remainingLength = Math.max(configuredLength - usedLength, 0)

    return {
      id: `formal-fabric-${source.originalCutOrderId}`,
      warehouseType: 'CUTTING_FABRIC',
      bindingState: 'BOUND_FORMAL_WAREHOUSE_RECORD',
      originalCutOrderId: source.originalCutOrderId,
      originalCutOrderNo: source.originalCutOrderNo,
      productionOrderId: source.productionOrderId,
      productionOrderNo,
      mergeBatchId: originalRef?.activeMergeBatchId || '',
      mergeBatchNo: originalRef?.activeMergeBatchNo || '',
      cutPieceOrderNo: source.originalCutOrderNo,
      materialSku: source.materialSku,
      materialType: source.materialType,
      materialLabel: source.materialLabel,
      configuredRollCount,
      configuredLength,
      usedRollCount,
      usedLength,
      remainingRollCount,
      remainingLength,
      latestConfigAt: progressRecord?.lastFieldUpdateAt || progressRecord?.purchaseDate || productionOrderById.get(source.productionOrderId)?.createdAt || '',
      latestReceiveAt: progressLine?.receiveStatus === 'NOT_RECEIVED' ? '' : progressRecord?.lastPickupScanAt || progressRecord?.lastFieldUpdateAt || '',
      latestActionText: buildFabricActionText(progressLine, source.originalCutOrderNo),
      fabricState: usage.fabricState,
      note: usage.fabricState === 'NEED_RECHECK' ? '当前领料 / 使用记录存在差异，需继续核对。' : '当前仓务读链已切换到正式原始裁片单主码。',
    }
  })

  const cutPiece: CutPieceWarehouseRecord[] = originalSources.map((source, index) => {
    const productionOrderNo = resolveSourceProductionOrderNo(source)
    const progressLine = resolveProgressLine(source.originalCutOrderId, source.originalCutOrderNo)
    const progressRecord = resolveProgressRecord(source.originalCutOrderId, source.originalCutOrderNo)
    const originalRef = registry.originalCutOrdersById[source.originalCutOrderId]
    const inboundStatus: CutPieceInboundStatus =
      progressRecord?.hasInboundRecord || (progressLine?.pieceProgressLines || []).some((line) => Number(line.inboundQty || 0) > 0)
        ? index % 5 === 0
          ? 'HANDED_OVER'
          : 'WAITING_HANDOVER'
        : 'PENDING_INBOUND'
    const zoneCode: CutPieceZoneCode = inboundStatus === 'PENDING_INBOUND' ? 'UNASSIGNED' : (['A', 'B', 'C'] as CutPieceZoneCode[])[index % 3]
    const latestActor = progressRecord?.lastOperatorName || '裁片仓 库管'
    const quantity = (progressLine?.pieceProgressLines || []).reduce((sum, line) => sum + Number(line.actualCutQty || line.inboundQty || 0), 0) || Math.max(source.requiredQty, 12)
    const pieceName = source.pieceRows[0]?.partName || '裁片主片'

    return {
      id: `formal-cut-piece-${source.originalCutOrderId}`,
      warehouseType: 'CUT_PIECE',
      bindingState: 'BOUND_FORMAL_WAREHOUSE_RECORD',
      originalCutOrderId: source.originalCutOrderId,
      originalCutOrderNo: source.originalCutOrderNo,
      productionOrderId: source.productionOrderId,
      productionOrderNo,
      mergeBatchId: originalRef?.activeMergeBatchId || '',
      mergeBatchNo: originalRef?.activeMergeBatchNo || '',
      cutPieceOrderNo: source.originalCutOrderNo,
      materialSku: source.materialSku,
      groupNo: originalRef?.activeMergeBatchNo || `${source.materialSku}-主组`,
      zoneCode,
      locationLabel: zoneCode === 'UNASSIGNED' ? '待分区' : `${zoneCode} 区 ${String((index % 4) + 1)} 组`,
      inboundStatus,
      inboundAt: inboundStatus === 'PENDING_INBOUND' ? '' : progressRecord?.lastFieldUpdateAt || productionOrderById.get(source.productionOrderId)?.updatedAt || '',
      inboundBy: inboundStatus === 'PENDING_INBOUND' ? '' : latestActor,
      pieceSummary: buildPieceSummaryText(quantity, pieceName),
      handoverStatus: inboundStatus === 'HANDED_OVER' ? 'HANDED_OVER' : 'WAITING_HANDOVER',
      handoverTarget: inboundStatus === 'HANDED_OVER' ? '已交接后道缝制' : '待后道交接',
      note: progressLine?.latestActionText || `原始裁片单 ${source.originalCutOrderNo} 的裁片仓记录已切换到正式仓务读链。`,
    }
  })

  const sample: SampleWarehouseRecord[] = []
  const seenProductionOrders = new Set<string>()
  originalSources.forEach((source, index) => {
    if (seenProductionOrders.has(source.productionOrderId)) return
    seenProductionOrders.add(source.productionOrderId)

    const productionOrder = productionOrderById.get(source.productionOrderId)
    const productionOrderNo = resolveSourceProductionOrderNo(source)
    const statusPattern = index % 4
    const latestActionAt = productionOrder?.updatedAt || productionOrder?.createdAt || '2026-03-27 09:00'
    const latestActionBy = statusPattern === 0 ? '样衣管理员 陈如意' : statusPattern === 1 ? 'PMC 样衣管理员 林佩琪' : statusPattern === 2 ? '抽检员 周雅晴' : '裁床组 黄秀娟'
    const currentLocationStage: SampleLocationStage =
      statusPattern === 0 ? 'CUTTING' : statusPattern === 1 ? 'FACTORY_CHECK' : statusPattern === 2 ? 'BACK_TO_PMC' : 'RETURN_CHECK'
    const currentStatus: SampleWarehouseStatus =
      statusPattern === 0 ? 'IN_USE' : statusPattern === 1 ? 'WAITING_RETURN' : statusPattern === 2 ? 'AVAILABLE' : 'CHECKING'
    const sampleNo = `SMP-${productionOrderNo.replace(/[^0-9]/g, '').slice(-6) || source.originalCutOrderNo.slice(-6)}`
    const sampleName = `${productionOrder?.demandSnapshot.spuName || source.sourceTechPackSpuCode || source.originalCutOrderNo} 样衣`
    const nextSuggestedAction =
      currentStatus === 'IN_USE'
        ? '裁床参考结束后归还 PMC 仓库。'
        : currentStatus === 'WAITING_RETURN'
          ? '样衣核价完成后归还，并安排抽检复核。'
          : currentStatus === 'CHECKING'
            ? '抽检完成后回到 PMC 仓库。'
            : '下次裁床启动前可再次调用。'

    sample.push({
      id: `formal-sample-${source.productionOrderId}`,
      warehouseType: 'SAMPLE',
      bindingState: 'BOUND_FORMAL_SAMPLE_RECORD',
      originalCutOrderId: source.originalCutOrderId,
      originalCutOrderNo: source.originalCutOrderNo,
      productionOrderId: source.productionOrderId,
      productionOrderNo,
      sampleNo,
      sampleName,
      relatedProductionOrderNo: productionOrderNo,
      relatedCutPieceOrderNo: source.originalCutOrderNo,
      currentLocationStage,
      currentHolder:
        currentStatus === 'IN_USE'
          ? '裁床组 黄秀娟'
          : currentStatus === 'WAITING_RETURN'
            ? '工厂核价组 吴晓莹'
            : currentStatus === 'CHECKING'
              ? '抽检员 周雅晴'
              : 'PMC 样衣仓',
      currentStatus,
      latestActionAt,
      latestActionBy,
      nextSuggestedAction,
      flowHistory: buildSampleFlowHistory({
        sampleItemId: `formal-sample-${source.productionOrderId}`,
        sampleNo,
        sampleName,
        currentLocationStage,
        latestActionAt,
        latestActionBy,
      }),
    })
  })

  const alerts: WarehouseAlertRecord[] = []
  const firstUnassigned = cutPiece.find((item) => item.zoneCode === 'UNASSIGNED')
  if (firstUnassigned) {
    alerts.push({
      id: 'formal-wa-unassigned',
      warehouseAlertType: 'UNASSIGNED_ZONE',
      level: 'HIGH',
      title: '裁片待分区',
      description: `${firstUnassigned.originalCutOrderNo} 仍待裁片仓分配区域。`,
      relatedNo: firstUnassigned.originalCutOrderNo,
      suggestedAction: '优先完成入仓分区，避免后续查找与交接延迟。',
    })
  }

  const firstNeedRecheck = fabric.find((item) => item.fabricState === 'NEED_RECHECK')
  if (firstNeedRecheck) {
    alerts.push({
      id: 'formal-wa-stock-recheck',
      warehouseAlertType: 'STOCK_RECHECK',
      level: 'HIGH',
      title: '裁床仓余量待核对',
      description: `${firstNeedRecheck.materialSku} 当前存在领料或余量差异待核对。`,
      relatedNo: firstNeedRecheck.materialSku,
      suggestedAction: '先核对裁床仓余料，再推进后续仓务收口。',
    })
  }

  const firstOverdueSample = sample.find((item) => item.currentStatus === 'WAITING_RETURN')
  if (firstOverdueSample) {
    alerts.push({
      id: 'formal-wa-sample-overdue',
      warehouseAlertType: 'SAMPLE_OVERDUE',
      level: 'MEDIUM',
      title: '样衣待归还',
      description: `${firstOverdueSample.sampleNo} 当前仍在外部环节流转。`,
      relatedNo: firstOverdueSample.sampleNo,
      suggestedAction: '联系当前持有人完成样衣归还与抽检。',
    })
  }

  if (cutPiece.some((item) => item.handoverStatus === 'WAITING_HANDOVER')) {
    alerts.push({
      id: 'formal-wa-space-risk',
      warehouseAlertType: 'SPACE_RISK',
      level: 'LOW',
      title: '裁片待交接',
      description: '当前仍存在待交接裁片组，建议优先核对发后道节奏。',
      relatedNo: '裁片仓',
      suggestedAction: '优先处理已入仓待后道交接的裁片组。',
    })
  }

  return { fabric, cutPiece, sample, alerts }
}

let cachedRuntime: FormalWarehouseRuntimeCache | null = null

function getCache(): FormalWarehouseRuntimeCache {
  if (!cachedRuntime) {
    cachedRuntime = buildFormalWarehouseRuntimeCache()
  }
  return cachedRuntime
}

export function listFormalFabricWarehouseRecords(): CuttingFabricStockRecord[] {
  return getCache().fabric.map(cloneFabricRecord)
}

export function listFormalCutPieceWarehouseRecords(): CutPieceWarehouseRecord[] {
  return getCache().cutPiece.map(cloneCutPieceRecord)
}

export function listFormalSampleWarehouseRecords(): SampleWarehouseRecord[] {
  return getCache().sample.map(cloneSampleRecord)
}

export const cuttingFabricStockRecords: CuttingFabricStockRecord[] = listFormalFabricWarehouseRecords()
export const cutPieceWarehouseRecords: CutPieceWarehouseRecord[] = listFormalCutPieceWarehouseRecords()
export const sampleWarehouseRecords: SampleWarehouseRecord[] = listFormalSampleWarehouseRecords()
export const warehouseAlertRecords: WarehouseAlertRecord[] = getCache().alerts.map((item) => ({ ...item }))

export function cloneWarehouseManagementData() {
  return {
    fabricStocks: listFormalFabricWarehouseRecords(),
    cutPieceRecords: listFormalCutPieceWarehouseRecords(),
    sampleRecords: listFormalSampleWarehouseRecords(),
    alerts: warehouseAlertRecords.map((item) => ({ ...item })),
  }
}

export interface WarehouseRuntimeTraceMatrixRow {
  warehouseRecordId: string
  originalCutOrderId: string
  originalCutOrderNo: string
  mergeBatchId: string
  mergeBatchNo: string
  materialSku: string
  cutPieceOrderNo: string
  spreadingSessionId: string
  spreadingSessionNo: string
  sourceMarkerId: string
  sourceMarkerNo: string
  feiTicketId: string
  feiTicketNo: string
  bagId: string
  bagCode: string
  transferBatchId: string
  sourceWritebackId: string
  inboundStatus: CutPieceInboundStatus
  handoverStatus: CutPieceHandoverStatus
}

export function buildWarehouseRuntimeTraceMatrix(
  records: CutPieceWarehouseRecord[] = listFormalCutPieceWarehouseRecords(),
): WarehouseRuntimeTraceMatrixRow[] {
  const originalRows = listGeneratedOriginalCutOrderSourceRecords()
  const originalRowsById = new Map(originalRows.map((record) => [record.originalCutOrderId, record] as const))
  const feiTraceById = new Map(buildGeneratedFeiTicketTraceMatrix().map((row) => [row.feiTicketId, row] as const))
  const transferTraceRows = buildSpreadingDrivenTransferBagTraceMatrix(
    buildSystemSeedTransferBagRuntime({
      originalRows: originalRows.map((record) => ({
        originalCutOrderId: record.originalCutOrderId,
        originalCutOrderNo: record.originalCutOrderNo,
        productionOrderNo: record.productionOrderNo,
        styleCode: record.styleCode,
        spuCode: record.sourceTechPackSpuCode || '',
        color: record.colorScope[0] || '',
        materialSku: record.materialSku,
        plannedQty: record.requiredQty,
      })),
      ticketRecords: listGeneratedFeiTickets().filter((record) => Boolean(record.sourceSpreadingSessionId)).map((record) => {
        const original = originalRowsById.get(record.originalCutOrderId)
        const trace = feiTraceById.get(record.feiTicketId)
        return {
          feiTicketId: record.feiTicketId,
          feiTicketNo: record.feiTicketNo,
          sourceSpreadingSessionId: record.sourceSpreadingSessionId,
          sourceSpreadingSessionNo: record.sourceSpreadingSessionNo,
          sourceMarkerId: record.sourceMarkerId,
          sourceMarkerNo: record.sourceMarkerNo,
          sourceWritebackId: trace?.sourceWritebackId || '',
          originalCutOrderId: record.originalCutOrderId,
          originalCutOrderNo: record.originalCutOrderNo,
          productionOrderNo: record.productionOrderNo,
          mergeBatchNo: record.sourceMergeBatchNo,
          styleCode: original?.styleCode || '',
          spuCode: record.sourceTechPackSpuCode || original?.sourceTechPackSpuCode || '',
          color: record.skuColor,
          size: record.skuSize,
          partName: record.partName,
          qty: record.garmentQty,
          materialSku: record.materialSku,
          sourceContextType: record.sourceMergeBatchId ? 'merge-batch' : 'original-order',
          status: 'PRINTED' as const,
        }
      }),
    }),
  )

  return records
    .map((record) => {
      const matchedTransferRow =
        transferTraceRows.find(
          (row) =>
            row.originalCutOrderId === record.originalCutOrderId &&
            (!record.mergeBatchNo || !row.mergeBatchNo || row.mergeBatchNo === record.mergeBatchNo),
        ) ||
        transferTraceRows.find((row) => row.originalCutOrderId === record.originalCutOrderId) ||
        null

      return {
        warehouseRecordId: record.id,
        originalCutOrderId: record.originalCutOrderId,
        originalCutOrderNo: record.originalCutOrderNo,
        mergeBatchId: record.mergeBatchId,
        mergeBatchNo: record.mergeBatchNo,
        materialSku: record.materialSku,
        cutPieceOrderNo: record.cutPieceOrderNo,
        spreadingSessionId: matchedTransferRow?.sourceSpreadingSessionId || '',
        spreadingSessionNo: matchedTransferRow?.sourceSpreadingSessionNo || '',
        sourceMarkerId: matchedTransferRow?.sourceMarkerId || '',
        sourceMarkerNo: matchedTransferRow?.sourceMarkerNo || '',
        feiTicketId: matchedTransferRow?.feiTicketId || '',
        feiTicketNo: matchedTransferRow?.feiTicketNo || '',
        bagId: matchedTransferRow?.bagId || '',
        bagCode: matchedTransferRow?.bagCode || '',
        transferBatchId: matchedTransferRow?.transferBatchId || '',
        sourceWritebackId: matchedTransferRow?.sourceWritebackId || '',
        inboundStatus: record.inboundStatus,
        handoverStatus: record.handoverStatus,
      }
    })
    .sort(
      (left, right) =>
        left.originalCutOrderNo.localeCompare(right.originalCutOrderNo, 'zh-CN')
        || left.warehouseRecordId.localeCompare(right.warehouseRecordId, 'zh-CN'),
    )
}

export function buildSpreadingDrivenWarehouseTraceMatrix(
  records: CutPieceWarehouseRecord[] = listFormalCutPieceWarehouseRecords(),
): WarehouseRuntimeTraceMatrixRow[] {
  return buildWarehouseRuntimeTraceMatrix(records).filter((record) => Boolean(record.spreadingSessionId))
}
