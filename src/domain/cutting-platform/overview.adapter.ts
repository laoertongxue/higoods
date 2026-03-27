import type {
  CuttingSummaryIssue as PlatformRuntimeIssue,
  CuttingSummaryIssueSourcePage,
  CuttingSummaryLinkedPageSummary,
  CuttingSummaryRecord,
  CuttingSummaryRiskLevel,
  CuttingSummaryUpdatedSource,
} from '../../data/fcs/cutting/cutting-summary'
import type { CuttingUrgencyLevel, CuttingOrderProgressRecord } from '../../data/fcs/cutting/types'
import type {
  CutPieceWarehouseRecord,
} from '../../data/fcs/cutting/warehouse-runtime.ts'
import {
  buildProductionPieceTruth,
  type PieceTruthOverlaySignal,
  type ProductionPieceTruthResult,
} from '../fcs-cutting-piece-truth/index.ts'
import {
  buildFcsCuttingDomainSnapshot,
  type CuttingDomainSnapshot,
} from '../fcs-cutting-runtime/index.ts'
import type {
  CuttingTaskRef,
  MergeBatchRef,
  OriginalCutOrderRef,
  ProductionOrderRef,
} from '../cutting-core/index.ts'
import {
  buildPlatformCuttingPrepProjection,
  type PlatformCuttingPickupAggregate,
  type PlatformCuttingPickupSummary,
} from './overview-prep-projection'

export type PlatformCuttingOverviewStage =
  | 'PENDING_PICKUP'
  | 'EXECUTING'
  | 'PENDING_REPLENISHMENT'
  | 'PENDING_INBOUND'
  | 'PENDING_HANDOVER'
  | 'ALMOST_DONE'

export interface PlatformCuttingOverviewRoutes {
  productionProgress: string
  materialPrep: string
  originalOrders: string
  replenishment: string
  fabricWarehouse: string
}

export type PlatformCuttingRuntimeRecordSnapshot = Pick<
  CuttingSummaryRecord,
  | 'cutPieceOrderCount'
  | 'markerSummary'
  | 'spreadingSummary'
  | 'replenishmentSummary'
  | 'warehouseSummary'
  | 'sampleSummary'
  | 'lastUpdatedAt'
  | 'lastUpdatedSource'
  | 'searchKeywords'
>

export interface PlatformCuttingOverviewRow {
  id: string
  sourceRowId: string
  productionOrderId: string
  productionOrderNo: string
  originalCutOrderIds: string[]
  originalCutOrderNos: string[]
  mergeBatchIds: string[]
  mergeBatchNos: string[]
  productionOrderRef: ProductionOrderRef | null
  originalCutOrderRefs: OriginalCutOrderRef[]
  mergeBatchRefs: MergeBatchRef[]
  cuttingTaskRef: CuttingTaskRef | null
  purchaseDate: string
  orderQty: number
  plannedShipDate: string
  urgencyLevel: CuttingUrgencyLevel
  cuttingTaskNo: string
  assignedFactoryName: string
  platformStageSummary: string
  currentStage: PlatformCuttingOverviewStage
  overallRiskLevel: CuttingSummaryRiskLevel
  pendingIssueCount: number
  highRiskIssueCount: number
  pickupSlipNo: string
  latestPrintVersionNo: string
  printCopyCount: number
  pickupSummary: PlatformCuttingPickupSummary
  pickupAggregate: PlatformCuttingPickupAggregate
  pickupSummaryText: string
  executionSummaryText: string
  replenishmentSummaryText: string
  warehouseSummaryText: string
  sampleSummaryText: string
  recentFactoryActionAt: string
  recentFactoryActionBy: string
  recentFactoryActionSource: '领料回写' | '铺布录入' | '入仓回写' | '样衣流转' | '暂无回写'
  mainIssueTitle: string
  mainIssueDescription: string
  mainIssueSourceLabel: string
  suggestedActionText: string
  suggestedRoute: string
  issueFlags: string[]
  issues: PlatformRuntimeIssue[]
  linkedPages: CuttingSummaryLinkedPageSummary[]
  nextActionSuggestions: string[]
  hasPendingReplenishment: boolean
  hasReceiveRecheck: boolean
  hasPhotoEvidence: boolean
  hasExecutionStalled: boolean
  hasPendingInbound: boolean
  hasPendingHandover: boolean
  hasSampleRisk: boolean
  isPendingFollowUp: boolean
  record: PlatformCuttingRuntimeRecordSnapshot
  routes: PlatformCuttingOverviewRoutes
}

export interface PlatformCuttingRuntimeOverviewData {
  snapshot: CuttingDomainSnapshot
  rows: PlatformCuttingOverviewRow[]
}

interface RuntimeMarkerRecord {
  originalCutOrderIds?: string[]
  mergeBatchId?: string
  markerImageUrl?: string
}

interface RuntimeSpreadingOperator {
  operatorName?: string
}

interface RuntimeSpreadingRoll {
  operatorNames?: string[]
}

interface RuntimeSpreadingSession {
  originalCutOrderIds?: string[]
  mergeBatchId?: string
  totalActualLength?: number
  updatedAt?: string
  updatedFromPdaAt?: string
  operators?: RuntimeSpreadingOperator[]
  rolls?: RuntimeSpreadingRoll[]
}

interface RuntimeMarkerStore {
  markers?: RuntimeMarkerRecord[]
  sessions?: RuntimeSpreadingSession[]
}

interface RuntimeExecutionWriteback {
  productionOrderId: string
  productionOrderNo: string
  originalCutOrderId: string
  originalCutOrderNo: string
  mergeBatchId: string
  mergeBatchNo: string
  cutPieceOrderNo: string
  materialSku: string
  submittedAt: string
  operatorName: string
  note?: string
}

interface RuntimeInboundWriteback extends RuntimeExecutionWriteback {
  zoneCode: string
  locationLabel: string
}

interface RuntimeHandoverWriteback extends RuntimeExecutionWriteback {
  targetLabel: string
}

interface RuntimeReplenishmentFeedbackWriteback extends RuntimeExecutionWriteback {
  reasonLabel: string
  photoProofCount: number
}

const defaultRoutes: PlatformCuttingOverviewRoutes = {
  productionProgress: '/fcs/craft/cutting/production-progress',
  materialPrep: '/fcs/craft/cutting/material-prep',
  originalOrders: '/fcs/craft/cutting/original-orders',
  replenishment: '/fcs/craft/cutting/replenishment',
  fabricWarehouse: '/fcs/craft/cutting/fabric-warehouse',
}

function compareDateTime(left: string, right: string): number {
  return (left || '').localeCompare(right || '')
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)))
}

function buildRouteWithPayload(route: string, payload?: Record<string, string | undefined>): string {
  const params = new URLSearchParams()
  Object.entries(payload || {}).forEach(([key, value]) => {
    if (value) params.set(key, value)
  })
  const query = params.toString()
  return query ? `${route}?${query}` : route
}

function getIssueSourceLabel(sourcePage: CuttingSummaryIssueSourcePage): string {
  if (sourcePage === 'MATERIAL_PREP') return '仓库配料'
  if (sourcePage === 'REPLENISHMENT') return '补料管理'
  if (sourcePage === 'WAREHOUSE') return '裁床仓'
  if (sourcePage === 'SAMPLE') return '样衣流转'
  return '裁片执行'
}

function getProductionOrderRef(snapshot: CuttingDomainSnapshot, record: CuttingOrderProgressRecord): ProductionOrderRef | null {
  return snapshot.registry.productionOrdersById[record.productionOrderId]
    || snapshot.registry.productionOrdersByNo[record.productionOrderNo]
    || null
}

function getOriginalCutOrderRefs(snapshot: CuttingDomainSnapshot, record: CuttingOrderProgressRecord): OriginalCutOrderRef[] {
  const rows = snapshot.originalCutOrders.filter((item) => item.productionOrderId === record.productionOrderId)
  return rows
    .map((row) => snapshot.registry.originalCutOrdersById[row.originalCutOrderId] || snapshot.registry.originalCutOrdersByNo[row.originalCutOrderNo])
    .filter((row): row is OriginalCutOrderRef => Boolean(row))
}

function getMergeBatchRefs(snapshot: CuttingDomainSnapshot, record: CuttingOrderProgressRecord): MergeBatchRef[] {
  const refs = snapshot.mergeBatchState.sourceRecords
    .filter((item) => item.sourceProductionOrderIds.includes(record.productionOrderId) || item.sourceProductionOrderNos.includes(record.productionOrderNo))
    .map((item) => snapshot.registry.mergeBatchesById[item.mergeBatchId] || snapshot.registry.mergeBatchesByNo[item.mergeBatchNo])
    .filter((item): item is MergeBatchRef => Boolean(item))

  return unique(refs.map((item) => item.mergeBatchId)).map((mergeBatchId) => refs.find((item) => item.mergeBatchId === mergeBatchId)!).filter(Boolean)
}

function getCuttingTaskRef(snapshot: CuttingDomainSnapshot, record: CuttingOrderProgressRecord): CuttingTaskRef | null {
  return (
    Object.values(snapshot.registry.cuttingTasksById).find(
      (item) => item.productionOrderId === record.productionOrderId || item.productionOrderNo === record.productionOrderNo,
    ) ?? null
  )
}

function buildOverlaySignals(snapshot: CuttingDomainSnapshot, record: CuttingOrderProgressRecord): PieceTruthOverlaySignal[] {
  const productionMatches = (item: { productionOrderId: string; productionOrderNo: string }) =>
    item.productionOrderId === record.productionOrderId || item.productionOrderNo === record.productionOrderNo

  const toSignal = (
    sourceType: PieceTruthOverlaySignal['sourceType'],
    item: RuntimeExecutionWriteback,
  ): PieceTruthOverlaySignal => ({
    sourceType,
    productionOrderId: item.productionOrderId,
    productionOrderNo: item.productionOrderNo,
    originalCutOrderId: item.originalCutOrderId,
    originalCutOrderNo: item.originalCutOrderNo,
    mergeBatchId: item.mergeBatchId,
    mergeBatchNo: item.mergeBatchNo,
    cutPieceOrderNo: item.cutPieceOrderNo,
    materialSku: item.materialSku,
    latestUpdatedAt: item.submittedAt,
    latestOperatorName: item.operatorName,
    note: item.note,
  })

  const pickupWritebacks = snapshot.pdaExecutionState.pickupWritebacks as unknown as RuntimeExecutionWriteback[]
  const inboundWritebacks = snapshot.pdaExecutionState.inboundWritebacks as unknown as RuntimeExecutionWriteback[]
  const handoverWritebacks = snapshot.pdaExecutionState.handoverWritebacks as unknown as RuntimeExecutionWriteback[]
  const replenishmentFeedbackWritebacks = snapshot.pdaExecutionState.replenishmentFeedbackWritebacks as unknown as RuntimeExecutionWriteback[]

  return [
    ...pickupWritebacks.filter(productionMatches).map((item) => toSignal('PICKUP', item)),
    ...inboundWritebacks.filter(productionMatches).map((item) => toSignal('INBOUND', item)),
    ...handoverWritebacks.filter(productionMatches).map((item) => toSignal('HANDOVER', item)),
    ...replenishmentFeedbackWritebacks.filter(productionMatches).map((item) => toSignal('REPLENISHMENT', item)),
  ]
}

function buildMarkerAndSpreadingSummary(snapshot: CuttingDomainSnapshot, originalRefs: OriginalCutOrderRef[], mergeBatchRefs: MergeBatchRef[]) {
  const originalIdSet = new Set(originalRefs.map((item) => item.originalCutOrderId))
  const mergeBatchIdSet = new Set(mergeBatchRefs.map((item) => item.mergeBatchId))
  const store = snapshot.markerSpreadingState.store as unknown as RuntimeMarkerStore
  const markers = (store.markers || []).filter(
    (item) => (item.originalCutOrderIds || []).some((id) => originalIdSet.has(id)) || (item.mergeBatchId && mergeBatchIdSet.has(item.mergeBatchId)),
  )
  const sessions = (store.sessions || []).filter(
    (item) => (item.originalCutOrderIds || []).some((id) => originalIdSet.has(id)) || (item.mergeBatchId && mergeBatchIdSet.has(item.mergeBatchId)),
  )
  const latestSession = [...sessions].sort((left, right) => compareDateTime(right.updatedAt || right.updatedFromPdaAt || '', left.updatedAt || left.updatedFromPdaAt || ''))[0] || null
  const latestSpreadingBy = latestSession?.operators?.find((item) => item.operatorName)?.operatorName
    || latestSession?.rolls?.find((item) => (item.operatorNames || []).length)?.operatorNames?.[0]
    || '-'

  return {
    markerSummary: {
      markerMaintainedCount: markers.length,
      markerImageUploadedCount: markers.filter((item) => Boolean(item.markerImageUrl)).length,
      pendingMarkerCount: Math.max(originalRefs.length - markers.length, 0),
    },
    spreadingSummary: {
      spreadingRecordCount: sessions.length,
      totalSpreadLength: sessions.reduce((sum, item) => sum + Number(item.totalActualLength || 0), 0),
      latestSpreadingAt: latestSession?.updatedAt || latestSession?.updatedFromPdaAt || '',
      latestSpreadingBy,
      pendingSpreadingCount: Math.max(originalRefs.length - sessions.length, 0),
    },
  }
}

function buildWarehouseRecordsWithOverlay(
  snapshot: CuttingDomainSnapshot,
  record: CuttingOrderProgressRecord,
): CutPieceWarehouseRecord[] {
  const productionOrderNo = record.productionOrderNo
  const base = snapshot.warehouseState.cutPieceRecords
    .filter((item) => item.productionOrderNo === productionOrderNo)
    .map((item) => ({ ...item }))
  const byKey = new Map(base.map((item) => [`${item.productionOrderNo}::${item.cutPieceOrderNo}::${item.materialSku}`, item] as const))

  const ensureRecord = (item: RuntimeExecutionWriteback): CutPieceWarehouseRecord => {
    const key = `${item.productionOrderNo}::${item.originalCutOrderNo}::${item.materialSku}`
    const current = byKey.get(key)
    if (current) return current
    const created: CutPieceWarehouseRecord = {
      id: `runtime-${item.productionOrderNo}-${item.originalCutOrderNo}-${item.materialSku}`,
      warehouseType: 'CUT_PIECE',
      productionOrderNo: item.productionOrderNo,
      cutPieceOrderNo: item.originalCutOrderNo,
      materialSku: item.materialSku,
      groupNo: item.mergeBatchNo || '',
      zoneCode: 'UNASSIGNED',
      locationLabel: '',
      inboundStatus: 'PENDING_INBOUND',
      inboundAt: '',
      inboundBy: '',
      pieceSummary: '待补数量',
      handoverStatus: 'WAITING_HANDOVER',
      handoverTarget: '',
      note: item.note || '',
    }
    byKey.set(key, created)
    return created
  }

  ;(snapshot.pdaExecutionState.inboundWritebacks as unknown as RuntimeInboundWriteback[])
    .filter((item) => item.productionOrderId === record.productionOrderId || item.productionOrderNo === productionOrderNo)
    .forEach((item) => {
      const current = ensureRecord(item)
      current.cutPieceOrderNo = item.originalCutOrderNo || current.cutPieceOrderNo
      current.materialSku = item.materialSku || current.materialSku
      current.groupNo = item.mergeBatchNo || current.groupNo
      current.zoneCode = (item.zoneCode as CutPieceWarehouseRecord['zoneCode']) || current.zoneCode
      current.locationLabel = item.locationLabel || current.locationLabel
      current.inboundStatus = 'INBOUNDED'
      current.inboundAt = item.submittedAt || current.inboundAt
      current.inboundBy = item.operatorName || current.inboundBy
      current.note = item.note || current.note
    })

  ;(snapshot.pdaExecutionState.handoverWritebacks as unknown as RuntimeHandoverWriteback[])
    .filter((item) => item.productionOrderId === record.productionOrderId || item.productionOrderNo === productionOrderNo)
    .forEach((item) => {
      const current = ensureRecord(item)
      current.cutPieceOrderNo = item.originalCutOrderNo || current.cutPieceOrderNo
      current.materialSku = item.materialSku || current.materialSku
      current.groupNo = item.mergeBatchNo || current.groupNo
      current.handoverStatus = 'HANDED_OVER'
      current.handoverTarget = item.targetLabel || current.handoverTarget
      current.note = item.note || current.note
      current.inboundStatus = current.inboundStatus === 'PENDING_INBOUND' ? 'HANDED_OVER' : current.inboundStatus
    })

  return Array.from(byKey.values())
}

function buildWarehouseSummary(snapshot: CuttingDomainSnapshot, record: CuttingOrderProgressRecord) {
  const records = buildWarehouseRecordsWithOverlay(snapshot, record)
  const latestInbound = [...records]
    .filter((item) => item.inboundStatus !== 'PENDING_INBOUND')
    .sort((left, right) => compareDateTime(right.inboundAt, left.inboundAt))[0] || null

  return {
    cutPiecePendingInboundCount: records.filter((item) => item.inboundStatus === 'PENDING_INBOUND').length,
    cutPieceInboundedCount: records.filter((item) => item.inboundStatus !== 'PENDING_INBOUND').length,
    waitingHandoverCount: records.filter((item) => item.handoverStatus === 'WAITING_HANDOVER').length,
    handedOverCount: records.filter((item) => item.handoverStatus === 'HANDED_OVER').length,
    unassignedZoneCount: records.filter((item) => item.zoneCode === 'UNASSIGNED').length,
    latestInboundAt: latestInbound?.inboundAt || '',
    latestInboundBy: latestInbound?.inboundBy || '',
  }
}

function buildSampleSummary(snapshot: CuttingDomainSnapshot, record: CuttingOrderProgressRecord) {
  const items = snapshot.warehouseState.sampleRecords.filter((item) => item.relatedProductionOrderNo === record.productionOrderNo)
  const latestItem = [...items].sort((left, right) => compareDateTime(right.latestActionAt, left.latestActionAt))[0] || null
  return {
    sampleInUseCount: items.filter((item) => item.currentStatus === 'IN_USE').length,
    sampleWaitingReturnCount: items.filter((item) => item.currentStatus === 'WAITING_RETURN').length,
    sampleAvailableCount: items.filter((item) => item.currentStatus === 'AVAILABLE').length,
    sampleCheckingCount: items.filter((item) => item.currentStatus === 'CHECKING').length,
    overdueReturnCount: items.filter((item) => (item.nextSuggestedAction || '').includes('超期')).length,
    latestSampleActionAt: latestItem?.latestActionAt || '',
    latestSampleActionBy: latestItem?.latestActionBy || '',
  }
}

function buildReplenishmentSummary(snapshot: CuttingDomainSnapshot, record: CuttingOrderProgressRecord) {
  const feedbacks = (snapshot.pdaExecutionState.replenishmentFeedbackWritebacks as unknown as RuntimeReplenishmentFeedbackWriteback[])
    .filter((item) => item.productionOrderId === record.productionOrderId || item.productionOrderNo === record.productionOrderNo)
  const suggestionCount = Math.max(feedbacks.length, record.riskFlags.includes('REPLENISH_PENDING') ? 1 : 0)
  const highRiskCount = feedbacks.filter((item) => /缺料|短缺|高风险/.test(item.reasonLabel || item.note || '')).length

  return {
    suggestionCount,
    pendingReviewCount: feedbacks.length,
    approvedCount: 0,
    rejectedCount: 0,
    needMoreInfoCount: 0,
    highRiskCount,
    mayAffectPrintingCount: feedbacks.filter((item) => (item.note || '').includes('印花')).length,
    mayAffectDyeingCount: feedbacks.filter((item) => (item.note || '').includes('染色')).length,
  }
}

function buildLatestFactoryAction(
  pickupSummary: PlatformCuttingPickupSummary,
  markerSummary: PlatformCuttingRuntimeRecordSnapshot['markerSummary'],
  spreadingSummary: PlatformCuttingRuntimeRecordSnapshot['spreadingSummary'],
  warehouseSummary: PlatformCuttingRuntimeRecordSnapshot['warehouseSummary'],
  sampleSummary: PlatformCuttingRuntimeRecordSnapshot['sampleSummary'],
): { at: string; by: string; source: PlatformCuttingOverviewRow['recentFactoryActionSource']; updatedSource: CuttingSummaryUpdatedSource } {
  const candidates = [
    {
      at: pickupSummary.latestScannedAt === '-' ? '' : pickupSummary.latestScannedAt,
      by: pickupSummary.latestScannedBy,
      source: '领料回写' as const,
      updatedSource: 'FACTORY_APP' as const,
    },
    {
      at: spreadingSummary.latestSpreadingAt,
      by: spreadingSummary.latestSpreadingBy,
      source: '铺布录入' as const,
      updatedSource: 'PCS' as const,
    },
    {
      at: warehouseSummary.latestInboundAt,
      by: warehouseSummary.latestInboundBy,
      source: '入仓回写' as const,
      updatedSource: 'FACTORY_APP' as const,
    },
    {
      at: sampleSummary.latestSampleActionAt,
      by: sampleSummary.latestSampleActionBy,
      source: '样衣流转' as const,
      updatedSource: 'PCS' as const,
    },
  ].filter((item) => item.at)

  if (!candidates.length) {
    return {
      at: '-',
      by: '-',
      source: '暂无回写',
      updatedSource: 'PCS',
    }
  }

  return candidates.sort((left, right) => compareDateTime(right.at, left.at))[0]!
}

function buildIssues(options: {
  record: CuttingOrderProgressRecord
  truth: ProductionPieceTruthResult
  pickupSummary: PlatformCuttingPickupSummary
  markerSummary: PlatformCuttingRuntimeRecordSnapshot['markerSummary']
  spreadingSummary: PlatformCuttingRuntimeRecordSnapshot['spreadingSummary']
  replenishmentSummary: PlatformCuttingRuntimeRecordSnapshot['replenishmentSummary']
  warehouseSummary: PlatformCuttingRuntimeRecordSnapshot['warehouseSummary']
  sampleSummary: PlatformCuttingRuntimeRecordSnapshot['sampleSummary']
}): PlatformRuntimeIssue[] {
  const issues: PlatformRuntimeIssue[] = []

  if (options.pickupSummary.needsRecheck) {
    issues.push({
      issueType: 'RECEIVE_DISCREPANCY',
      level: options.pickupSummary.hasPhotoEvidence ? 'HIGH' : 'MEDIUM',
      title: '领料结果待复核',
      description: options.pickupSummary.resultSummaryText,
      sourcePage: 'MATERIAL_PREP',
      suggestedAction: '回仓库配料领料页核对配置数量、扫码结果和差异说明。',
      suggestedRoute: defaultRoutes.materialPrep,
    })
  }

  if (options.markerSummary.pendingMarkerCount > 0) {
    issues.push({
      issueType: 'MARKER_NOT_READY',
      level: 'MEDIUM',
      title: '唛架待维护',
      description: `仍有 ${options.markerSummary.pendingMarkerCount} 张原始裁片单缺少唛架维护。`,
      sourcePage: 'CUT_PIECE_ORDER',
      suggestedAction: '回原始裁片单页补齐唛架配比、净长度和唛架图。',
      suggestedRoute: defaultRoutes.originalOrders,
    })
  }

  if (options.spreadingSummary.pendingSpreadingCount > 0) {
    issues.push({
      issueType: 'SPREADING_PENDING',
      level: 'MEDIUM',
      title: '铺布记录待补',
      description: `仍有 ${options.spreadingSummary.pendingSpreadingCount} 张原始裁片单缺少铺布记录。`,
      sourcePage: 'CUT_PIECE_ORDER',
      suggestedAction: '回原始裁片单页补录铺布记录，补齐卷号、层数和总长度。',
      suggestedRoute: defaultRoutes.originalOrders,
    })
  }

  if (options.replenishmentSummary.pendingReviewCount > 0 || options.replenishmentSummary.highRiskCount > 0) {
    issues.push({
      issueType: 'REPLENISHMENT_PENDING',
      level: options.replenishmentSummary.highRiskCount > 0 ? 'HIGH' : 'MEDIUM',
      title: '补料待跟进',
      description: `当前有 ${options.replenishmentSummary.pendingReviewCount || options.replenishmentSummary.suggestionCount} 条补料反馈待收口。`,
      sourcePage: 'REPLENISHMENT',
      suggestedAction: '回补料管理页确认补料建议、影响范围和后续动作。',
      suggestedRoute: defaultRoutes.replenishment,
    })
  }

  if (options.warehouseSummary.cutPiecePendingInboundCount > 0 || options.warehouseSummary.unassignedZoneCount > 0) {
    issues.push({
      issueType: 'INBOUND_PENDING',
      level: options.record.urgencyLevel === 'AA' || options.record.urgencyLevel === 'A' ? 'HIGH' : 'MEDIUM',
      title: '裁片待入仓',
      description: `待入仓 ${options.warehouseSummary.cutPiecePendingInboundCount} 张，未分区 ${options.warehouseSummary.unassignedZoneCount} 张。`,
      sourcePage: 'WAREHOUSE',
      suggestedAction: '回裁床仓核对入仓、区位和交接节奏。',
      suggestedRoute: defaultRoutes.fabricWarehouse,
    })
  }

  if (options.warehouseSummary.waitingHandoverCount > 0) {
    issues.push({
      issueType: 'HANDOVER_PENDING',
      level: 'MEDIUM',
      title: '裁片待交接',
      description: `仍有 ${options.warehouseSummary.waitingHandoverCount} 张裁片待完成后道交接。`,
      sourcePage: 'WAREHOUSE',
      suggestedAction: '回裁床仓确认交接目标、交接时间和后道承接情况。',
      suggestedRoute: defaultRoutes.fabricWarehouse,
    })
  }

  if (options.sampleSummary.sampleWaitingReturnCount > 0 || options.sampleSummary.overdueReturnCount > 0) {
    issues.push({
      issueType: 'SAMPLE_OVERDUE',
      level: options.sampleSummary.overdueReturnCount > 0 ? 'HIGH' : 'MEDIUM',
      title: '样衣待归还',
      description: `待归还 ${options.sampleSummary.sampleWaitingReturnCount} 件，超期 ${options.sampleSummary.overdueReturnCount} 件。`,
      sourcePage: 'SAMPLE',
      suggestedAction: '回裁床仓核对样衣流转、归还时点和责任人。',
      suggestedRoute: defaultRoutes.fabricWarehouse,
    })
  }

  if (options.truth.completionState === 'DATA_PENDING') {
    issues.push({
      issueType: 'DATA_PENDING',
      level: 'MEDIUM',
      title: '数据待补',
      description: options.truth.completionDetailText,
      sourcePage: 'CUT_PIECE_ORDER',
      suggestedAction: '先补齐原始裁片单映射和执行进度，再继续判断收口状态。',
      suggestedRoute: defaultRoutes.productionProgress,
    })
  }

  return issues
}

function buildPlatformStageSummary(currentStage: PlatformCuttingOverviewStage, truth: ProductionPieceTruthResult, issue: PlatformRuntimeIssue | null): string {
  const stageLabelMap: Record<PlatformCuttingOverviewStage, string> = {
    PENDING_PICKUP: '待领料',
    EXECUTING: '执行中',
    PENDING_REPLENISHMENT: '待补料',
    PENDING_INBOUND: '待入仓',
    PENDING_HANDOVER: '待交接',
    ALMOST_DONE: '已基本完成',
  }
  if (issue) return `${stageLabelMap[currentStage]} · ${issue.title}`
  return `${stageLabelMap[currentStage]} · ${truth.completionLabel}`
}

function buildLinkedPages(row: PlatformCuttingOverviewRow): CuttingSummaryLinkedPageSummary[] {
  return [
    {
      pageKey: 'ORDER_PROGRESS',
      pageLabel: '生产单进度',
      route: row.routes.productionProgress,
      summaryText: row.platformStageSummary,
    },
    {
      pageKey: 'MATERIAL_PREP',
      pageLabel: '仓库配料领料',
      route: row.routes.materialPrep,
      summaryText: row.pickupSummaryText,
    },
    {
      pageKey: 'CUT_PIECE_ORDER',
      pageLabel: '原始裁片单',
      route: row.routes.originalOrders,
      summaryText: row.executionSummaryText,
    },
    {
      pageKey: 'REPLENISHMENT',
      pageLabel: '补料管理',
      route: row.routes.replenishment,
      summaryText: row.replenishmentSummaryText,
    },
    {
      pageKey: 'WAREHOUSE',
      pageLabel: '裁床仓',
      route: row.routes.fabricWarehouse,
      summaryText: `${row.warehouseSummaryText} · ${row.sampleSummaryText}`,
    },
  ]
}

function buildOverviewRow(snapshot: CuttingDomainSnapshot, record: CuttingOrderProgressRecord): PlatformCuttingOverviewRow {
  const productionOrderRef = getProductionOrderRef(snapshot, record)
  const originalCutOrderRefs = getOriginalCutOrderRefs(snapshot, record)
  const mergeBatchRefs = getMergeBatchRefs(snapshot, record)
  const cuttingTaskRef = getCuttingTaskRef(snapshot, record)
  const overlaySignals = buildOverlaySignals(snapshot, record)
  const truth = buildProductionPieceTruth(record, { overlaySignals })
  const pickupPrepProjection = buildPlatformCuttingPrepProjection(snapshot, record, originalCutOrderRefs)
  const pickupAggregate = pickupPrepProjection.aggregate
  const pickupSummary = pickupPrepProjection.summary
  const { markerSummary, spreadingSummary } = buildMarkerAndSpreadingSummary(snapshot, originalCutOrderRefs, mergeBatchRefs)
  const replenishmentSummary = buildReplenishmentSummary(snapshot, record)
  const warehouseSummary = buildWarehouseSummary(snapshot, record)
  const sampleSummary = buildSampleSummary(snapshot, record)
  const issues = buildIssues({
    record,
    truth,
    pickupSummary,
    markerSummary,
    spreadingSummary,
    replenishmentSummary,
    warehouseSummary,
    sampleSummary,
  })
  const highRiskIssueCount = issues.filter((item) => item.level === 'HIGH').length
  const overallRiskLevel: CuttingSummaryRiskLevel = highRiskIssueCount > 0 ? 'HIGH' : issues.length > 0 ? 'MEDIUM' : 'LOW'
  const hasPendingReplenishment = replenishmentSummary.pendingReviewCount > 0 || replenishmentSummary.highRiskCount > 0
  const hasExecutionStalled = markerSummary.pendingMarkerCount > 0 || spreadingSummary.pendingSpreadingCount > 0
  const hasPendingInbound = warehouseSummary.cutPiecePendingInboundCount > 0 || warehouseSummary.unassignedZoneCount > 0
  const hasPendingHandover = warehouseSummary.waitingHandoverCount > 0
  const hasSampleRisk = sampleSummary.sampleWaitingReturnCount > 0 || sampleSummary.overdueReturnCount > 0
  const currentStage: PlatformCuttingOverviewStage =
    pickupAggregate.receiveSuccessCount === 0
      ? 'PENDING_PICKUP'
      : hasPendingReplenishment
        ? 'PENDING_REPLENISHMENT'
        : hasPendingInbound
          ? 'PENDING_INBOUND'
          : hasPendingHandover
            ? 'PENDING_HANDOVER'
            : truth.completionState === 'COMPLETED' && !issues.length
              ? 'ALMOST_DONE'
              : 'EXECUTING'
  const latestFactoryAction = buildLatestFactoryAction(pickupSummary, markerSummary, spreadingSummary, warehouseSummary, sampleSummary)
  const recordSnapshot: PlatformCuttingRuntimeRecordSnapshot = {
    cutPieceOrderCount: originalCutOrderRefs.length,
    markerSummary,
    spreadingSummary,
    replenishmentSummary,
    warehouseSummary,
    sampleSummary,
    lastUpdatedAt: latestFactoryAction.at === '-' ? record.lastFieldUpdateAt || record.lastPickupScanAt || '' : latestFactoryAction.at,
    lastUpdatedSource: latestFactoryAction.updatedSource,
    searchKeywords: unique([
      record.productionOrderNo,
      record.styleCode,
      record.spuCode,
      record.styleName,
      ...originalCutOrderRefs.map((item) => item.originalCutOrderNo),
      ...originalCutOrderRefs.map((item) => item.materialSku),
      ...issues.map((item) => item.title),
    ]).map((item) => item.toLowerCase()),
  }
  const executionSummaryText = `唛架已维护 ${markerSummary.markerMaintainedCount} / ${originalCutOrderRefs.length}，铺布 ${spreadingSummary.spreadingRecordCount} 条。`
  const replenishmentSummaryText = hasPendingReplenishment
    ? `待跟进 ${replenishmentSummary.pendingReviewCount || replenishmentSummary.suggestionCount} 条。`
    : '当前无待跟进补料。'
  const warehouseSummaryText = `待入仓 ${warehouseSummary.cutPiecePendingInboundCount}，待交接 ${warehouseSummary.waitingHandoverCount}。`
  const sampleSummaryText = sampleSummary.sampleWaitingReturnCount > 0 || sampleSummary.overdueReturnCount > 0
    ? `待归还 ${sampleSummary.sampleWaitingReturnCount}，超期 ${sampleSummary.overdueReturnCount}。`
    : '当前无样衣风险。'
  const mainIssue = issues[0] ?? null
  const suggestedRoute = mainIssue?.suggestedRoute || defaultRoutes.productionProgress
  const row: PlatformCuttingOverviewRow = {
    id: record.productionOrderId,
    sourceRowId: record.productionOrderId,
    productionOrderId: record.productionOrderId,
    productionOrderNo: record.productionOrderNo,
    originalCutOrderIds: originalCutOrderRefs.map((item) => item.originalCutOrderId),
    originalCutOrderNos: originalCutOrderRefs.map((item) => item.originalCutOrderNo),
    mergeBatchIds: mergeBatchRefs.map((item) => item.mergeBatchId),
    mergeBatchNos: mergeBatchRefs.map((item) => item.mergeBatchNo),
    productionOrderRef,
    originalCutOrderRefs,
    mergeBatchRefs,
    cuttingTaskRef,
    purchaseDate: record.purchaseDate,
    orderQty: record.orderQty,
    plannedShipDate: record.plannedShipDate,
    urgencyLevel: record.urgencyLevel,
    cuttingTaskNo: cuttingTaskRef?.taskNo || record.cuttingTaskNo || '-',
    assignedFactoryName: record.assignedFactoryName || '-',
    platformStageSummary: buildPlatformStageSummary(currentStage, truth, mainIssue),
    currentStage,
    overallRiskLevel,
    pendingIssueCount: issues.length,
    highRiskIssueCount,
    pickupSlipNo: pickupSummary.pickupSlipNo,
    latestPrintVersionNo: pickupSummary.latestPrintVersionNo,
    printCopyCount: pickupSummary.printCopyCount,
    pickupSummary,
    pickupAggregate,
    pickupSummaryText: `${pickupAggregate.materialReceiveSummaryText} · ${pickupSummary.latestResultLabel}`,
    executionSummaryText,
    replenishmentSummaryText,
    warehouseSummaryText,
    sampleSummaryText,
    recentFactoryActionAt: latestFactoryAction.at,
    recentFactoryActionBy: latestFactoryAction.by || '-',
    recentFactoryActionSource: latestFactoryAction.source,
    mainIssueTitle: mainIssue?.title || '当前无明显风险',
    mainIssueDescription: mainIssue?.description || truth.completionDetailText,
    mainIssueSourceLabel: mainIssue ? getIssueSourceLabel(mainIssue.sourcePage) : '平台跟进',
    suggestedActionText: mainIssue?.suggestedAction || truth.nextActionLabel || '继续跟进当前裁片任务。',
    suggestedRoute,
    issueFlags: unique([
      ...record.riskFlags,
      ...issues.map((item) => item.issueType),
    ]),
    issues,
    linkedPages: [],
    nextActionSuggestions: unique([truth.nextActionLabel, ...issues.map((item) => item.suggestedAction)].filter(Boolean)),
    hasPendingReplenishment,
    hasReceiveRecheck: pickupSummary.needsRecheck,
    hasPhotoEvidence: pickupSummary.hasPhotoEvidence,
    hasExecutionStalled,
    hasPendingInbound,
    hasPendingHandover,
    hasSampleRisk,
    isPendingFollowUp: truth.completionState !== 'COMPLETED' || issues.length > 0,
    record: recordSnapshot,
    routes: defaultRoutes,
  }
  row.linkedPages = buildLinkedPages(row)
  return row
}

export function buildPlatformCuttingRuntimeOverviewData(
  snapshot: CuttingDomainSnapshot = buildFcsCuttingDomainSnapshot(),
): PlatformCuttingRuntimeOverviewData {
  const rows = snapshot.progressRecords
    .map((record) => buildOverviewRow(snapshot, record))
    .sort((left, right) => {
      const riskWeight = { HIGH: 0, MEDIUM: 1, LOW: 2 }
      const riskDiff = riskWeight[left.overallRiskLevel] - riskWeight[right.overallRiskLevel]
      if (riskDiff !== 0) return riskDiff
      return left.productionOrderNo.localeCompare(right.productionOrderNo, 'zh-CN')
    })

  return { snapshot, rows }
}

export function buildPlatformCuttingOverviewRows(): PlatformCuttingOverviewRow[] {
  return buildPlatformCuttingRuntimeOverviewData().rows
}
