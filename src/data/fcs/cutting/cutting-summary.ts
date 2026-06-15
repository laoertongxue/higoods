import { buildCuttingCoreRegistry } from '../../../domain/cutting-core/index.ts'
import { productionOrders, type ProductionOrder } from '../production-orders.ts'
import { listGeneratedCutOrderSourceRecords } from './generated-cut-orders.ts'
import { cuttingOrderProgressRecords, type CuttingOrderProgressRecord } from './order-progress.ts'
import type { CuttingUrgencyLevel } from './types'
import {
  listFormalCutPieceWarehouseRecords,
  listFormalFabricWarehouseRecords,
  listFormalSampleWarehouseRecords,
  type CutPieceWarehouseRecord,
  type CuttingFabricStockRecord,
  type SampleWarehouseRecord,
} from './warehouse-runtime.ts'

export type CuttingSummaryStatus =
  | 'PENDING_PREP_CLOSURE'
  | 'PENDING_EXECUTION_CLOSURE'
  | 'PENDING_WAREHOUSE_HANDOVER'
  | 'PENDING_SAMPLE_RETURN'
  | 'DONE_PENDING_REVIEW'
  | 'CLOSED'

export type CuttingSummaryRiskLevel = 'HIGH' | 'MEDIUM' | 'LOW'
export type CuttingSummaryUpdatedSource = 'PLATFORM' | 'PCS' | 'FACTORY_APP'
export type CuttingSummaryIssueSourcePage = 'MATERIAL_PREP' | 'CUT_PIECE_ORDER' | 'WAREHOUSE' | 'SAMPLE'

export interface CuttingSummaryMaterialSummary {
  configuredCount: number
  partiallyConfiguredCount: number
  fullyConfiguredCount: number
  printedSlipCount: number
  qrGeneratedCount: number
}

export interface CuttingSummaryReceiveSummary {
  receivedSuccessCount: number
  receivedPartialCount: number
  notReceivedCount: number
  receiveDiscrepancyCount: number
  latestReceiveAt: string
  latestReceiveBy: string
  photoProofCount: number
}

export interface CuttingSummaryMarkerSummary {
  markerMaintainedCount: number
  markerImageUploadedCount: number
  pendingMarkerCount: number
}

export interface CuttingSummarySpreadingSummary {
  spreadingRecordCount: number
  totalSpreadLength: number
  latestSpreadingAt: string
  latestSpreadingBy: string
  pendingSpreadingCount: number
}

export interface CuttingSummaryWarehouseSummary {
  cuttingFabricStockNeedRecheckCount: number
  cutPiecePendingInboundCount: number
  cutPieceInboundedCount: number
  waitingHandoverCount: number
  handedOverCount: number
  unassignedZoneCount: number
  latestInboundAt: string
  latestInboundBy: string
}

export interface CuttingSummarySampleSummary {
  sampleInUseCount: number
  sampleWaitingReturnCount: number
  sampleAvailableCount: number
  sampleCheckingCount: number
  overdueReturnCount: number
  latestSampleActionAt: string
  latestSampleActionBy: string
}

export interface CuttingSummaryIssue {
  issueType: string
  level: CuttingSummaryRiskLevel
  title: string
  description: string
  sourcePage: CuttingSummaryIssueSourcePage
  suggestedAction: string
  suggestedRoute: string
}

export interface CuttingSummaryLinkedPageSummary {
  pageKey: 'ORDER_PROGRESS' | 'MATERIAL_PREP' | 'CUT_PIECE_ORDER' | 'WAREHOUSE'
  pageLabel: string
  route: string
  summaryText: string
}

export interface CuttingSummaryRecord {
  id: string
  productionOrderId: string
  productionOrderNo: string
  cutOrderIds: string[]
  cutOrderNos: string[]
  markerPlanIds: string[]
  markerPlanNos: string[]
  purchaseDate: string
  orderQty: number
  plannedShipDate: string
  urgencyLevel: CuttingUrgencyLevel
  cuttingTaskNo: string
  assignedFactoryName: string
  platformStageSummary: string
  cutPieceOrderCount: number
  materialTypeCount: number
  overallSummaryStatus: CuttingSummaryStatus
  overallRiskLevel: CuttingSummaryRiskLevel
  pendingIssueCount: number
  highRiskIssueCount: number
  lastUpdatedAt: string
  lastUpdatedSource: CuttingSummaryUpdatedSource
  materialSummary: CuttingSummaryMaterialSummary
  receiveSummary: CuttingSummaryReceiveSummary
  markerSummary: CuttingSummaryMarkerSummary
  spreadingSummary: CuttingSummarySpreadingSummary
  warehouseSummary: CuttingSummaryWarehouseSummary
  sampleSummary: CuttingSummarySampleSummary
  issueFlags: string[]
  nextActionSuggestions: string[]
  linkedPageSummary: CuttingSummaryLinkedPageSummary[]
  searchKeywords: string[]
  issues: CuttingSummaryIssue[]
  note: string
}

export interface CuttingSummaryFilters {
  keyword: string
  urgencyLevel: 'ALL' | CuttingUrgencyLevel
  summaryStatus: 'ALL' | CuttingSummaryStatus
  riskLevel: 'ALL' | CuttingSummaryRiskLevel
  issueSource: 'ALL' | 'PREP' | 'EXECUTION' | 'WAREHOUSE' | 'SAMPLE'
  pendingOnly: 'ALL' | 'PENDING_ONLY'
}

const cuttingIdentityRegistry = buildCuttingCoreRegistry()
const progressRecordMap = new Map(cuttingOrderProgressRecords.map((record) => [record.productionOrderId, record] as const))
const cutOrderSourceRecords = listGeneratedCutOrderSourceRecords()
const formalFabricWarehouseRecords = listFormalFabricWarehouseRecords()
const formalCutPieceWarehouseRecords = listFormalCutPieceWarehouseRecords()
const formalSampleWarehouseRecords = listFormalSampleWarehouseRecords()

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values.filter(Boolean)))
}

function maxDateTime(values: Array<string | undefined>): string {
  return values.filter(Boolean).sort().at(-1) ?? ''
}

function sumSkuQty(order: ProductionOrder): number {
  return order.demandSnapshot.skuLines.reduce((sum, line) => sum + Number(line.qty || 0), 0)
}

function deriveUrgencyLevel(order: ProductionOrder, progressRecord: CuttingOrderProgressRecord | null): CuttingUrgencyLevel {
  if (progressRecord) return progressRecord.urgencyLevel
  const requiredDeliveryDate = order.demandSnapshot.requiredDeliveryDate
  if (!requiredDeliveryDate) return 'C'
  if (requiredDeliveryDate <= '2026-03-24') return 'AA'
  if (requiredDeliveryDate <= '2026-03-28') return 'A'
  if (requiredDeliveryDate <= '2026-04-05') return 'B'
  return 'C'
}

function buildIssueFlags(issues: CuttingSummaryIssue[]): string[] {
  return unique(issues.map((item) => item.title))
}

function issueSourceMatches(
  issue: CuttingSummaryIssue,
  filter: CuttingSummaryFilters['issueSource'],
): boolean {
  if (filter === 'ALL') return true
  if (filter === 'PREP') return issue.sourcePage === 'MATERIAL_PREP'
  if (filter === 'EXECUTION') return issue.sourcePage === 'CUT_PIECE_ORDER'
  if (filter === 'WAREHOUSE') return issue.sourcePage === 'WAREHOUSE'
  return issue.sourcePage === 'SAMPLE'
}

function getProductionCutOrderSources(productionOrderId: string) {
  return cutOrderSourceRecords.filter((item) => item.productionOrderId === productionOrderId)
}

function getProductionFabricWarehouseRecords(productionOrderId: string): CuttingFabricStockRecord[] {
  return formalFabricWarehouseRecords.filter((item) => item.productionOrderId === productionOrderId)
}

function getProductionCutPieceWarehouseRecords(productionOrderId: string): CutPieceWarehouseRecord[] {
  return formalCutPieceWarehouseRecords.filter((item) => item.productionOrderId === productionOrderId)
}

function getProductionSampleWarehouseRecords(productionOrderId: string): SampleWarehouseRecord[] {
  return formalSampleWarehouseRecords.filter((item) => item.productionOrderId === productionOrderId)
}

function buildMaterialSummary(progressRecord: CuttingOrderProgressRecord): CuttingSummaryMaterialSummary {
  const materialLines = progressRecord.materialLines
  return {
    configuredCount: materialLines.filter((item) => item.configStatus !== 'NOT_CONFIGURED').length,
    partiallyConfiguredCount: materialLines.filter((item) => item.configStatus === 'PARTIAL').length,
    fullyConfiguredCount: materialLines.filter((item) => item.configStatus === 'CONFIGURED').length,
    printedSlipCount: materialLines.filter((item) => item.printSlipStatus === 'PRINTED').length,
    qrGeneratedCount: materialLines.filter((item) => item.qrStatus === 'GENERATED').length,
  }
}

function buildReceiveSummary(progressRecord: CuttingOrderProgressRecord): CuttingSummaryReceiveSummary {
  const materialLines = progressRecord.materialLines
  const latestReceiveLine = materialLines
    .filter((item) => item.receiveStatus !== 'NOT_RECEIVED' && progressRecord.lastPickupScanAt)
    .at(-1)
  return {
    receivedSuccessCount: materialLines.filter((item) => item.receiveStatus === 'RECEIVED').length,
    receivedPartialCount: materialLines.filter((item) => item.receiveStatus === 'PARTIAL').length,
    notReceivedCount: materialLines.filter((item) => item.receiveStatus === 'NOT_RECEIVED').length,
    receiveDiscrepancyCount: materialLines.filter((item) => item.issueFlags.includes('RECEIVE_DIFF')).length,
    latestReceiveAt: progressRecord.lastPickupScanAt || '',
    latestReceiveBy: latestReceiveLine ? progressRecord.lastOperatorName : '',
    photoProofCount: materialLines.filter((item) => item.issueFlags.includes('PHOTO_SUBMITTED')).length,
  }
}

function buildMarkerSummary(progressRecord: CuttingOrderProgressRecord): CuttingSummaryMarkerSummary {
  const markerMaintainedCount = progressRecord.materialLines.filter((item) => (item.pieceProgressLines || []).length > 0).length
  const markerImageUploadedCount = progressRecord.hasSpreadingRecord ? markerMaintainedCount : 0
  return {
    markerMaintainedCount,
    markerImageUploadedCount,
    pendingMarkerCount: Math.max(progressRecord.materialLines.length - markerMaintainedCount, 0),
  }
}

function buildSpreadingSummary(progressRecord: CuttingOrderProgressRecord): CuttingSummarySpreadingSummary {
  const spreadingRecordCount = progressRecord.hasSpreadingRecord ? progressRecord.materialLines.length : 0
  return {
    spreadingRecordCount,
    totalSpreadLength: progressRecord.materialLines.reduce((sum, item) => sum + Number(item.configuredLength || 0), 0),
    latestSpreadingAt: progressRecord.hasSpreadingRecord ? progressRecord.lastFieldUpdateAt : '',
    latestSpreadingBy: progressRecord.hasSpreadingRecord ? progressRecord.lastOperatorName : '',
    pendingSpreadingCount: progressRecord.hasSpreadingRecord ? 0 : progressRecord.materialLines.length,
  }
}

function buildWarehouseSummary(records: CutPieceWarehouseRecord[]): CuttingSummaryWarehouseSummary {
  return {
    cuttingFabricStockNeedRecheckCount: 0,
    cutPiecePendingInboundCount: records.filter((item) => item.inboundStatus === 'PENDING_INBOUND').length,
    cutPieceInboundedCount: records.filter((item) => item.inboundStatus !== 'PENDING_INBOUND').length,
    waitingHandoverCount: records.filter((item) => item.handoverStatus === 'WAITING_HANDOVER').length,
    handedOverCount: records.filter((item) => item.handoverStatus === 'HANDED_OVER').length,
    unassignedZoneCount: records.filter((item) => item.zoneCode === 'UNASSIGNED').length,
    latestInboundAt: maxDateTime(records.map((item) => item.inboundAt)),
    latestInboundBy: records.filter((item) => item.inboundAt).sort((a, b) => a.inboundAt.localeCompare(b.inboundAt)).at(-1)?.inboundBy ?? '',
  }
}

function buildSampleSummary(records: SampleWarehouseRecord[]): CuttingSummarySampleSummary {
  return {
    sampleInUseCount: records.filter((item) => item.currentStatus === 'IN_USE').length,
    sampleWaitingReturnCount: records.filter((item) => item.currentStatus === 'WAITING_RETURN').length,
    sampleAvailableCount: records.filter((item) => item.currentStatus === 'AVAILABLE').length,
    sampleCheckingCount: records.filter((item) => item.currentStatus === 'CHECKING').length,
    overdueReturnCount: records.filter((item) => item.currentStatus === 'WAITING_RETURN' && item.currentLocationStage === 'FACTORY_CHECK').length,
    latestSampleActionAt: maxDateTime(records.map((item) => item.latestActionAt)),
    latestSampleActionBy: records.filter((item) => item.latestActionAt).sort((a, b) => a.latestActionAt.localeCompare(b.latestActionAt)).at(-1)?.latestActionBy ?? '',
  }
}

function buildPlatformStageSummary(args: {
  receiveSummary: CuttingSummaryReceiveSummary
  warehouseSummary: CuttingSummaryWarehouseSummary
  sampleSummary: CuttingSummarySampleSummary
  spreadingSummary: CuttingSummarySpreadingSummary
}): string {
  if (args.warehouseSummary.cutPiecePendingInboundCount > 0 || args.warehouseSummary.unassignedZoneCount > 0) return '裁片仓入仓 / 分区仍待收口。'
  if (args.sampleSummary.sampleWaitingReturnCount > 0) return '样衣流转尚未收口，需继续回仓。'
  if (args.receiveSummary.receivedPartialCount > 0 || args.receiveSummary.notReceivedCount > 0) return '裁床领料入待加工仓仍在执行中。'
  if (args.spreadingSummary.pendingSpreadingCount > 0) return '铺布执行记录尚未完全回流。'
  return '正式裁片主链已进入稳定执行或收口阶段。'
}

function buildIssues(args: {
  productionOrderNo: string
  materialSummary: CuttingSummaryMaterialSummary
  receiveSummary: CuttingSummaryReceiveSummary
  markerSummary: CuttingSummaryMarkerSummary
  spreadingSummary: CuttingSummarySpreadingSummary
  warehouseSummary: CuttingSummaryWarehouseSummary
  sampleSummary: CuttingSummarySampleSummary
}): CuttingSummaryIssue[] {
  const issues: CuttingSummaryIssue[] = []

  if (args.receiveSummary.receiveDiscrepancyCount > 0) {
    issues.push({
      issueType: 'RECEIVE_DIFF',
      level: 'HIGH',
      title: '来料差异未收口',
      description: `当前共有 ${args.receiveSummary.receiveDiscrepancyCount} 条来料差异待核对。`,
      sourcePage: 'MATERIAL_PREP',
      suggestedAction: '返回待加工仓核对差异与举证。',
      suggestedRoute: '/fcs/craft/cutting/warehouse-management/wait-process',
    })
  }

  if (args.materialSummary.partiallyConfiguredCount > 0 || args.receiveSummary.notReceivedCount > 0) {
    issues.push({
      issueType: 'PREP_PENDING',
      level: args.productionOrderNo.endsWith('081') ? 'HIGH' : 'MEDIUM',
      title: '中转仓配料或裁床领料仍待收口',
      description: '当前仍有中转仓配料数量不足或裁床领料记录未完成的裁片单。',
      sourcePage: 'MATERIAL_PREP',
      suggestedAction: '优先核对中转仓配料数量与裁床领料记录。',
      suggestedRoute: '/fcs/craft/cutting/warehouse-management/wait-process',
    })
  }

  if (args.markerSummary.pendingMarkerCount > 0) {
    issues.push({
      issueType: 'MARKER_PENDING',
      level: 'MEDIUM',
      title: '唛架信息待补齐',
      description: `当前仍有 ${args.markerSummary.pendingMarkerCount} 张裁片单缺少唛架或部位进度信息。`,
      sourcePage: 'CUT_PIECE_ORDER',
      suggestedAction: '返回裁片单页补齐唛架与部位进度。',
      suggestedRoute: '/fcs/craft/cutting/cut-orders',
    })
  }

  if (args.spreadingSummary.pendingSpreadingCount > 0) {
    issues.push({
      issueType: 'SPREAD_PENDING',
      level: 'MEDIUM',
      title: '铺布回写仍待补齐',
      description: `当前仍有 ${args.spreadingSummary.pendingSpreadingCount} 个裁片单未形成正式铺布回写。`,
      sourcePage: 'CUT_PIECE_ORDER',
      suggestedAction: '回裁片单或铺布页核查正式回写。',
      suggestedRoute: '/fcs/craft/cutting/cut-orders',
    })
  }

  if (args.warehouseSummary.cutPiecePendingInboundCount > 0 || args.warehouseSummary.unassignedZoneCount > 0) {
    issues.push({
      issueType: 'WAREHOUSE_PENDING',
      level: args.warehouseSummary.unassignedZoneCount > 0 ? 'HIGH' : 'MEDIUM',
      title: '裁片仓待入仓 / 待分区',
      description: '当前仍存在待入仓或未完成区域分配的裁片仓记录。',
      sourcePage: 'WAREHOUSE',
      suggestedAction: '返回裁片仓页完成正式入仓和分区。',
      suggestedRoute: '/fcs/craft/cutting/warehouse-management/wait-handover?tab=cut-piece-warehouse',
    })
  } else if (args.warehouseSummary.waitingHandoverCount > 0) {
    issues.push({
      issueType: 'HANDOVER_PENDING',
      level: 'LOW',
      title: '后道交接待确认',
      description: `当前仍有 ${args.warehouseSummary.waitingHandoverCount} 条裁片仓记录待交接。`,
      sourcePage: 'WAREHOUSE',
      suggestedAction: '返回裁片仓页确认待交接对象。',
      suggestedRoute: '/fcs/craft/cutting/warehouse-management/wait-handover?tab=cut-piece-warehouse',
    })
  }

  if (args.sampleSummary.sampleWaitingReturnCount > 0 || args.sampleSummary.overdueReturnCount > 0) {
    issues.push({
      issueType: 'SAMPLE_PENDING',
      level: args.sampleSummary.overdueReturnCount > 0 ? 'HIGH' : 'MEDIUM',
      title: '样衣流转存在风险',
      description: `当前待归还样衣 ${args.sampleSummary.sampleWaitingReturnCount} 件，其中超期 ${args.sampleSummary.overdueReturnCount} 件。`,
      sourcePage: 'SAMPLE',
      suggestedAction: '返回样衣仓页继续完成归还与抽检。',
      suggestedRoute: '/fcs/craft/cutting/sample-warehouse',
    })
  }

  return issues
}

function buildOverallSummaryStatus(args: {
  materialSummary: CuttingSummaryMaterialSummary
  receiveSummary: CuttingSummaryReceiveSummary
  markerSummary: CuttingSummaryMarkerSummary
  spreadingSummary: CuttingSummarySpreadingSummary
  warehouseSummary: CuttingSummaryWarehouseSummary
  sampleSummary: CuttingSummarySampleSummary
  issues: CuttingSummaryIssue[]
}): CuttingSummaryStatus {
  if (args.sampleSummary.sampleWaitingReturnCount > 0 || args.sampleSummary.overdueReturnCount > 0) return 'PENDING_SAMPLE_RETURN'
  if (args.warehouseSummary.cutPiecePendingInboundCount > 0 || args.warehouseSummary.unassignedZoneCount > 0 || args.warehouseSummary.waitingHandoverCount > 0) return 'PENDING_WAREHOUSE_HANDOVER'
  if (args.markerSummary.pendingMarkerCount > 0 || args.spreadingSummary.pendingSpreadingCount > 0) return 'PENDING_EXECUTION_CLOSURE'
  if (args.materialSummary.partiallyConfiguredCount > 0 || args.receiveSummary.receivedPartialCount > 0 || args.receiveSummary.notReceivedCount > 0) return 'PENDING_PREP_CLOSURE'
  if (args.issues.length > 0) return 'DONE_PENDING_REVIEW'
  return 'CLOSED'
}

function buildLinkedPageSummary(args: {
  progressRecord: CuttingOrderProgressRecord
  materialSummary: CuttingSummaryMaterialSummary
  receiveSummary: CuttingSummaryReceiveSummary
  markerSummary: CuttingSummaryMarkerSummary
  spreadingSummary: CuttingSummarySpreadingSummary
  warehouseSummary: CuttingSummaryWarehouseSummary
}): CuttingSummaryLinkedPageSummary[] {
  return [
    {
      pageKey: 'ORDER_PROGRESS',
      pageLabel: '生产单进度',
      route: '/fcs/craft/cutting/production-progress',
      summaryText: `${args.progressRecord.urgencyLevel} 紧急 · ${args.progressRecord.cuttingStage}`,
    },
    {
      pageKey: 'MATERIAL_PREP',
      pageLabel: '中转仓配料 / 裁床领料',
      route: '/fcs/craft/cutting/warehouse-management/wait-process',
      summaryText: `有配料数量 ${args.materialSummary.fullyConfiguredCount}，有领料记录 ${args.receiveSummary.receivedSuccessCount}`,
    },
    {
      pageKey: 'CUT_PIECE_ORDER',
      pageLabel: '裁片单',
      route: '/fcs/craft/cutting/cut-orders',
      summaryText: `唛架已维护 ${args.markerSummary.markerMaintainedCount}，铺布回写 ${args.spreadingSummary.spreadingRecordCount} 条`,
    },
    {
      pageKey: 'WAREHOUSE',
      pageLabel: '裁片仓',
      route: '/fcs/craft/cutting/warehouse-management/wait-handover?tab=cut-piece-warehouse',
      summaryText: `待入仓 ${args.warehouseSummary.cutPiecePendingInboundCount}，待交接 ${args.warehouseSummary.waitingHandoverCount}`,
    },
  ]
}

function buildRecord(order: ProductionOrder): CuttingSummaryRecord | null {
  const progressRecord = progressRecordMap.get(order.productionOrderId) || null
  const cutOrderSources = getProductionCutOrderSources(order.productionOrderId)
  if (!progressRecord && cutOrderSources.length === 0) return null

  const cutOrderRefs = unique(cutOrderSources.map((item) => item.cutOrderId))
    .map((cutOrderId) => cuttingIdentityRegistry.cutOrdersById[cutOrderId])
    .filter(Boolean)
  const markerPlanIds = unique(cutOrderRefs.flatMap((ref) => [ref.activeMarkerPlanSourceId, ...ref.markerPlanIds]).filter(Boolean))
  const markerPlanNos = unique(cutOrderRefs.flatMap((ref) => [ref.activeMarkerPlanSourceNo, ...ref.markerPlanNos]).filter(Boolean))
  const fabricWarehouseRecords = getProductionFabricWarehouseRecords(order.productionOrderId)
  const cutPieceWarehouseRecords = getProductionCutPieceWarehouseRecords(order.productionOrderId)
  const sampleWarehouseRecords = getProductionSampleWarehouseRecords(order.productionOrderId)

  const materialSummary = progressRecord
    ? buildMaterialSummary(progressRecord)
    : {
        configuredCount: 0,
        partiallyConfiguredCount: 0,
        fullyConfiguredCount: 0,
        printedSlipCount: 0,
        qrGeneratedCount: 0,
      }
  const receiveSummary = progressRecord
    ? buildReceiveSummary(progressRecord)
    : {
        receivedSuccessCount: 0,
        receivedPartialCount: 0,
        notReceivedCount: 0,
        receiveDiscrepancyCount: 0,
        latestReceiveAt: '',
        latestReceiveBy: '',
        photoProofCount: 0,
      }
  const markerSummary = progressRecord
    ? buildMarkerSummary(progressRecord)
    : {
        markerMaintainedCount: cutOrderSources.filter((item) => item.pieceRows.length > 0).length,
        markerImageUploadedCount: 0,
        pendingMarkerCount: cutOrderSources.filter((item) => item.pieceRows.length === 0).length,
      }
  const spreadingSummary = progressRecord
    ? buildSpreadingSummary(progressRecord)
    : {
        spreadingRecordCount: 0,
        totalSpreadLength: 0,
        latestSpreadingAt: '',
        latestSpreadingBy: '',
        pendingSpreadingCount: cutOrderSources.length,
      }
  const warehouseSummary = buildWarehouseSummary(cutPieceWarehouseRecords)
  warehouseSummary.cuttingFabricStockNeedRecheckCount = fabricWarehouseRecords.filter((item) => item.fabricState === 'NEED_RECHECK').length
  const sampleSummary = buildSampleSummary(sampleWarehouseRecords)
  const issues = buildIssues({
    productionOrderNo: order.productionOrderNo,
    materialSummary,
    receiveSummary,
    markerSummary,
    spreadingSummary,
    warehouseSummary,
    sampleSummary,
  })

  const overallRiskLevel: CuttingSummaryRiskLevel = issues.some((item) => item.level === 'HIGH')
    ? 'HIGH'
    : issues.some((item) => item.level === 'MEDIUM')
      ? 'MEDIUM'
      : 'LOW'
  const overallSummaryStatus = buildOverallSummaryStatus({
    materialSummary,
    receiveSummary,
    markerSummary,
    spreadingSummary,
    warehouseSummary,
    sampleSummary,
    issues,
  })
  const linkedPageSummary = progressRecord
    ? buildLinkedPageSummary({
        progressRecord,
        materialSummary,
        receiveSummary,
        markerSummary,
        spreadingSummary,
        warehouseSummary,
      })
    : []

  const latestCandidates: Array<{ value: string; source: CuttingSummaryUpdatedSource }> = [
    { value: order.updatedAt, source: 'PLATFORM' },
    { value: progressRecord?.lastFieldUpdateAt || '', source: 'FACTORY_APP' },
    { value: receiveSummary.latestReceiveAt, source: 'FACTORY_APP' },
    { value: spreadingSummary.latestSpreadingAt, source: 'FACTORY_APP' },
    { value: warehouseSummary.latestInboundAt, source: 'FACTORY_APP' },
    { value: sampleSummary.latestSampleActionAt, source: 'PCS' },
  ].filter((item) => item.value)
  const lastUpdated = latestCandidates.sort((a, b) => a.value.localeCompare(b.value)).at(-1)

  return {
    id: `cutting-summary-${order.productionOrderId}`,
    productionOrderId: order.productionOrderId,
    productionOrderNo: order.productionOrderNo,
    cutOrderIds: cutOrderRefs.map((ref) => ref.cutOrderId),
    cutOrderNos: cutOrderRefs.map((ref) => ref.cutOrderNo),
    markerPlanIds,
    markerPlanNos,
    purchaseDate: (progressRecord?.purchaseDate || order.createdAt).slice(0, 10),
    orderQty: progressRecord?.orderQty || sumSkuQty(order),
    plannedShipDate: progressRecord?.plannedShipDate || order.demandSnapshot.requiredDeliveryDate || '',
    urgencyLevel: deriveUrgencyLevel(order, progressRecord),
    cuttingTaskNo: progressRecord?.cuttingTaskNo || `CUT-TASK-${order.productionOrderId.replace(/\D/g, '').slice(-6)}`,
    assignedFactoryName: progressRecord?.assignedFactoryName || order.mainFactorySnapshot.name,
    platformStageSummary: buildPlatformStageSummary({
      receiveSummary,
      warehouseSummary,
      sampleSummary,
      spreadingSummary,
    }),
    cutPieceOrderCount: cutOrderSources.length,
    materialTypeCount: unique(cutOrderSources.map((item) => item.materialType)).length || 1,
    overallSummaryStatus,
    overallRiskLevel,
    pendingIssueCount: issues.length,
    highRiskIssueCount: issues.filter((item) => item.level === 'HIGH').length,
    lastUpdatedAt: lastUpdated?.value || order.updatedAt,
    lastUpdatedSource: lastUpdated?.source || 'PLATFORM',
    materialSummary,
    receiveSummary,
    markerSummary,
    spreadingSummary,
    warehouseSummary,
    sampleSummary,
    issueFlags: buildIssueFlags(issues),
    nextActionSuggestions: unique(issues.map((item) => item.suggestedAction)).slice(0, 4),
    linkedPageSummary,
    searchKeywords: unique([
      order.productionOrderId,
      order.productionOrderNo,
      progressRecord?.cuttingTaskNo || '',
      ...cutOrderSources.map((item) => item.cutOrderId),
      ...cutOrderSources.map((item) => item.cutOrderNo),
      ...cutOrderSources.map((item) => item.materialSku),
      ...markerPlanNos,
      order.demandSnapshot.spuCode,
      order.demandSnapshot.spuName,
    ]),
    issues,
    note: order.demandSnapshot.constraintsNote || '当前裁片总览已切换到正式主链汇总。',
  }
}

export const cuttingSummaryRecords: CuttingSummaryRecord[] = productionOrders
  .map((order) => buildRecord(order))
  .filter((record): record is CuttingSummaryRecord => record !== null)

export function cloneCuttingSummaryRecords(): CuttingSummaryRecord[] {
  return cuttingSummaryRecords.map((record) => ({
    ...record,
    cutOrderIds: [...record.cutOrderIds],
    cutOrderNos: [...record.cutOrderNos],
    markerPlanIds: [...record.markerPlanIds],
    markerPlanNos: [...record.markerPlanNos],
    materialSummary: { ...record.materialSummary },
    receiveSummary: { ...record.receiveSummary },
    markerSummary: { ...record.markerSummary },
    spreadingSummary: { ...record.spreadingSummary },
    warehouseSummary: { ...record.warehouseSummary },
    sampleSummary: { ...record.sampleSummary },
    issueFlags: [...record.issueFlags],
    nextActionSuggestions: [...record.nextActionSuggestions],
    linkedPageSummary: record.linkedPageSummary.map((item) => ({ ...item })),
    searchKeywords: [...record.searchKeywords],
    issues: record.issues.map((item) => ({ ...item })),
  }))
}

export function filterIssuesBySource(
  records: CuttingSummaryRecord[],
  filter: CuttingSummaryFilters['issueSource'],
): CuttingSummaryRecord[] {
  if (filter === 'ALL') return records
  return records.filter((record) => record.issues.some((issue) => issueSourceMatches(issue, filter)))
}
