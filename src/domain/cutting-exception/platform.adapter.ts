import type { PlatformCuttingOverviewRow } from '../cutting-platform/overview.adapter'
import { buildPlatformCuttingRuntimeOverviewData } from '../cutting-platform/overview.adapter'
import {
  cuttingExceptionClosureConditionTexts,
  cuttingExceptionTriggerConditionTexts,
  cuttingExceptionTypeMeta,
} from './helpers'
import type {
  CuttingException,
  CuttingExceptionOwnerRole,
  CuttingExceptionRiskLevel,
  CuttingExceptionSourceLayer,
  CuttingExceptionSourcePage,
  CuttingExceptionStatus,
  CuttingExceptionType,
} from './types'
import {
  listCuttingPickupViewsByProductionOrder,
  type CuttingPickupView,
} from '../pickup/page-adapters/cutting-shared'

function buildExceptionNo(row: PlatformCuttingOverviewRow, type: CuttingExceptionType, index: number): string {
  const normalizedTaskNo = row.cuttingTaskNo.replace(/[^A-Z0-9]+/gi, '-').replace(/^-|-$/g, '')
  return `CUT-EX-${normalizedTaskNo}-${String(index).padStart(2, '0')}`
}

function pickRelevantPickupView(
  views: CuttingPickupView[],
  predicate: (view: CuttingPickupView) => boolean,
): CuttingPickupView | null {
  return views.find(predicate) ?? views[0] ?? null
}

function deriveOwner(type: CuttingExceptionType, row: PlatformCuttingOverviewRow): { role: CuttingExceptionOwnerRole; name: string } {
  if (type === 'REPLENISHMENT_PENDING') {
    return { role: 'PLATFORM', name: '平台裁片跟进岗' }
  }
  if (type === 'MARKER_NOT_MAINTAINED' || type === 'SPREADING_DATA_INSUFFICIENT') {
    return { role: 'FIELD_EXECUTION', name: `${row.assignedFactoryName}现场执行` }
  }
  return { role: 'CUTTING_FACTORY_OPS', name: row.assignedFactoryName }
}

function deriveSource(type: CuttingExceptionType): { layer: CuttingExceptionSourceLayer; page: CuttingExceptionSourcePage } {
  switch (type) {
    case 'RECEIVE_DISCREPANCY':
    case 'MISSING_EVIDENCE':
      return { layer: 'FACTORY_APP', page: 'PDA_PICKUP' }
    case 'MARKER_NOT_MAINTAINED':
      return { layer: 'PCS', page: 'CUT_PIECE_ORDER' }
    case 'SPREADING_DATA_INSUFFICIENT':
      return { layer: 'FACTORY_APP', page: 'PDA_SPREADING' }
    case 'REPLENISHMENT_PENDING':
      return { layer: 'PCS', page: 'REPLENISHMENT' }
    case 'INBOUND_PENDING':
    case 'ZONE_UNASSIGNED':
    case 'SAMPLE_OVERDUE':
      return { layer: 'PCS', page: 'WAREHOUSE' }
    case 'HANDOVER_PENDING':
      return { layer: 'FACTORY_APP', page: 'PDA_HANDOVER' }
    default:
      return { layer: 'PCS', page: 'WAREHOUSE' }
  }
}

function deriveSuggestedRoute(type: CuttingExceptionType, row: PlatformCuttingOverviewRow): string {
  if (type === 'RECEIVE_DISCREPANCY' || type === 'MISSING_EVIDENCE') return row.routes.materialPrep
  if (type === 'MARKER_NOT_MAINTAINED' || type === 'SPREADING_DATA_INSUFFICIENT') return row.routes.cutPieceOrders
  if (type === 'REPLENISHMENT_PENDING') return row.routes.replenishment
  return row.routes.warehouseManagement
}

function deriveRiskLevel(type: CuttingExceptionType, row: PlatformCuttingOverviewRow): CuttingExceptionRiskLevel {
  if (type === 'MISSING_EVIDENCE') return 'HIGH'
  if (type === 'REPLENISHMENT_PENDING' && row.record.replenishmentSummary.highRiskCount > 0) return 'HIGH'
  if (type === 'RECEIVE_DISCREPANCY' && row.overallRiskLevel === 'HIGH') return 'HIGH'
  if (type === 'INBOUND_PENDING' && (row.urgencyLevel === 'AA' || row.urgencyLevel === 'A')) return 'HIGH'
  if (type === 'SAMPLE_OVERDUE' && row.record.sampleSummary.overdueReturnCount > 0) return 'HIGH'
  if (type === 'HANDOVER_PENDING' && row.urgencyLevel === 'AA') return 'HIGH'
  if (type === 'ZONE_UNASSIGNED' || type === 'MARKER_NOT_MAINTAINED' || type === 'SPREADING_DATA_INSUFFICIENT') return 'MEDIUM'
  return row.overallRiskLevel === 'LOW' ? 'LOW' : 'MEDIUM'
}

function deriveInitialStatus(type: CuttingExceptionType, row: PlatformCuttingOverviewRow): CuttingExceptionStatus {
  if (type === 'RECEIVE_DISCREPANCY' && row.hasPhotoEvidence) return 'WAITING_CONFIRM'
  if (type === 'ZONE_UNASSIGNED') return 'WAITING_CONFIRM'
  if (type === 'REPLENISHMENT_PENDING' || type === 'HANDOVER_PENDING' || type === 'SAMPLE_OVERDUE') return 'IN_PROGRESS'
  return 'OPEN'
}

function buildCommonException(
  row: PlatformCuttingOverviewRow,
  type: CuttingExceptionType,
  index: number,
  view: CuttingPickupView | null,
  overrides: {
    triggerSummary: string
    evidenceSummary: string
    latestActionSummary: string
    latestActionAt: string
    latestActionBy: string
    suggestedAction: string
  },
): CuttingException {
  const owner = deriveOwner(type, row)
  const source = deriveSource(type)
  const cutPieceOrderNo = view?.slip.boundObjectNo || '-'
  const materialSku = view?.slip.materialSku || row.record.searchKeywords.find((item) => item.startsWith('FAB-')) || '-'
  const pickupSlipNo = view?.pickupSlipNo || row.pickupSummary.pickupSlipNo
  const latestPrintVersionNo = view?.latestPrintVersionNo || row.pickupSummary.latestPrintVersionNo
  const qrCodeValue = view?.qrCodeValue || row.pickupSummary.qrCodeValue
  const latestScanResultLabel = view?.latestResultLabel || row.pickupSummary.latestResultLabel
  const evidenceCount = view?.photoProofCount ?? row.pickupSummary.photoProofCount

  return {
    exceptionNo: buildExceptionNo(row, type, index),
    exceptionType: type,
    exceptionTypeLabel: cuttingExceptionTypeMeta[type].label,
    scenarioType: 'CUTTING',
    productionOrderNo: row.productionOrderNo,
    cuttingTaskNo: row.cuttingTaskNo,
    cutPieceOrderNo,
    materialSku,
    sourceLayer: source.layer,
    sourcePage: source.page,
    riskLevel: deriveRiskLevel(type, row),
    status: deriveInitialStatus(type, row),
    ownerRole: owner.role,
    ownerName: owner.name,
    assignedFactoryName: row.assignedFactoryName,
    triggerSummary: overrides.triggerSummary,
    evidenceSummary: overrides.evidenceSummary,
    latestActionSummary: overrides.latestActionSummary,
    latestActionAt: overrides.latestActionAt || '-',
    latestActionBy: overrides.latestActionBy || '-',
    suggestedAction: overrides.suggestedAction,
    suggestedRoute: deriveSuggestedRoute(type, row),
    closureCondition: cuttingExceptionClosureConditionTexts[type],
    closedAt: '',
    closedBy: '',
    closeNote: '',
    pickupSlipNo,
    latestPrintVersionNo,
    qrCodeValue,
    latestScanResultLabel,
    hasPhotoEvidence: view?.hasPhotoEvidence ?? row.pickupSummary.hasPhotoEvidence,
    needsRecheck: view?.needsRecheck ?? row.pickupSummary.needsRecheck,
    pickupSummaryText: row.pickupSummaryText,
    executionSummaryText: row.executionSummaryText,
    replenishmentSummaryText: row.replenishmentSummaryText,
    warehouseSummaryText: row.warehouseSummaryText,
    sampleSummaryText: row.sampleSummaryText,
    evidenceCount,
    triggerConditionText: cuttingExceptionTriggerConditionTexts[type],
    closureConditionText: cuttingExceptionClosureConditionTexts[type],
  }
}

function buildExceptionsForRow(row: PlatformCuttingOverviewRow): CuttingException[] {
  const views = listCuttingPickupViewsByProductionOrder(row.productionOrderNo)
  const latestView = views[0] ?? null
  const recheckView = pickRelevantPickupView(views, (view) => view.needsRecheck)
  const photoView = pickRelevantPickupView(views, (view) => view.hasPhotoEvidence)
  const rows: CuttingException[] = []

  if (row.hasReceiveRecheck) {
    rows.push(
      buildCommonException(row, 'RECEIVE_DISCREPANCY', rows.length + 1, recheckView || latestView, {
        triggerSummary: `最新扫码结果为${row.pickupSummary.latestResultLabel}，实领与配置摘要存在差异。`,
        evidenceSummary: row.pickupSummary.hasPhotoEvidence ? '已提交照片凭证，待平台复核。' : '当前仅有扫码差异回写，尚未形成照片凭证。',
        latestActionSummary: '工厂端已提交领料差异回写',
        latestActionAt: row.pickupSummary.latestScannedAt,
        latestActionBy: row.pickupSummary.latestScannedBy,
        suggestedAction: '优先回仓库配料页核对配置数量、实领数量和差异说明。',
      }),
    )
  }

  if (row.hasReceiveRecheck && !row.hasPhotoEvidence) {
    rows.push(
      buildCommonException(row, 'MISSING_EVIDENCE', rows.length + 1, recheckView || latestView, {
        triggerSummary: '当前领料差异需要凭证留痕，但统一回执中未检测到照片凭证。',
        evidenceSummary: 'photoProofCount = 0，需补齐现场照片或备注说明。',
        latestActionSummary: '差异回写已到平台，但凭证仍缺失',
        latestActionAt: row.pickupSummary.latestScannedAt,
        latestActionBy: row.pickupSummary.latestScannedBy,
        suggestedAction: '联系现场执行补齐照片凭证，或确认无需凭证并补备注。',
      }),
    )
  }

  if (row.record.markerSummary.pendingMarkerCount > 0) {
    rows.push(
      buildCommonException(row, 'MARKER_NOT_MAINTAINED', rows.length + 1, latestView, {
        triggerSummary: `当前仍有 ${row.record.markerSummary.pendingMarkerCount} 张裁片单未维护唛架。`,
        evidenceSummary: `已维护 ${row.record.markerSummary.markerMaintainedCount} 张，唛架图已上传 ${row.record.markerSummary.markerImageUploadedCount} 张。`,
        latestActionSummary: 'PCS 侧仍未看到完整唛架维护摘要',
        latestActionAt: row.record.lastUpdatedAt,
        latestActionBy: 'PCS 汇总回写',
        suggestedAction: '回裁片单页补齐唛架配比、净长度和唛架图状态。',
      }),
    )
  }

  if (row.record.spreadingSummary.pendingSpreadingCount > 0) {
    rows.push(
      buildCommonException(row, 'SPREADING_DATA_INSUFFICIENT', rows.length + 1, latestView, {
        triggerSummary: `当前仍有 ${row.record.spreadingSummary.pendingSpreadingCount} 张裁片单缺少可判断的铺布数据。`,
        evidenceSummary: `已录入 ${row.record.spreadingSummary.spreadingRecordCount} 条铺布记录，总长度 ${row.record.spreadingSummary.totalSpreadLength}。`,
        latestActionSummary: '现场铺布录入仍未形成完整判断依据',
        latestActionAt: row.record.spreadingSummary.latestSpreadingAt || row.record.lastUpdatedAt,
        latestActionBy: row.record.spreadingSummary.latestSpreadingBy || '工厂端补录',
        suggestedAction: '回裁片单页补录铺布记录，确认卷号、层数、布头布尾和总长度。',
      }),
    )
  }

  if (row.record.replenishmentSummary.pendingReviewCount > 0 || row.record.replenishmentSummary.needMoreInfoCount > 0) {
    rows.push(
      buildCommonException(row, 'REPLENISHMENT_PENDING', rows.length + 1, latestView, {
        triggerSummary: `补料建议待审核 ${row.record.replenishmentSummary.pendingReviewCount} 条，待补充说明 ${row.record.replenishmentSummary.needMoreInfoCount} 条。`,
        evidenceSummary: `高风险补料 ${row.record.replenishmentSummary.highRiskCount} 条，已通过 ${row.record.replenishmentSummary.approvedCount} 条。`,
        latestActionSummary: '补料链路仍待平台继续跟进',
        latestActionAt: row.record.lastUpdatedAt,
        latestActionBy: 'PCS 补料汇总',
        suggestedAction: '回补料管理页处理待审核或待补充说明的建议。',
      }),
    )
  }

  if (row.record.warehouseSummary.cutPiecePendingInboundCount > 0) {
    rows.push(
      buildCommonException(row, 'INBOUND_PENDING', rows.length + 1, latestView, {
        triggerSummary: `执行阶段已推进，但仍有 ${row.record.warehouseSummary.cutPiecePendingInboundCount} 组裁片待入仓。`,
        evidenceSummary: `已入仓 ${row.record.warehouseSummary.cutPieceInboundedCount} 组，未分配区域 ${row.record.warehouseSummary.unassignedZoneCount} 组。`,
        latestActionSummary: '仓务入仓摘要尚未收口',
        latestActionAt: row.record.warehouseSummary.latestInboundAt || row.record.lastUpdatedAt,
        latestActionBy: row.record.warehouseSummary.latestInboundBy || row.assignedFactoryName,
        suggestedAction: '回仓库管理页确认入仓和区域定位，避免后续查找失败。',
      }),
    )
  }

  if (row.record.warehouseSummary.unassignedZoneCount > 0) {
    rows.push(
      buildCommonException(row, 'ZONE_UNASSIGNED', rows.length + 1, latestView, {
        triggerSummary: `当前仍有 ${row.record.warehouseSummary.unassignedZoneCount} 组裁片已入仓但未完成区域分配。`,
        evidenceSummary: `已入仓 ${row.record.warehouseSummary.cutPieceInboundedCount} 组，但库位可查性不足。`,
        latestActionSummary: '仓内区域提示仍未补齐',
        latestActionAt: row.record.warehouseSummary.latestInboundAt || row.record.lastUpdatedAt,
        latestActionBy: row.record.warehouseSummary.latestInboundBy || row.assignedFactoryName,
        suggestedAction: '回仓库管理页补齐 A / B / C 区和位置说明。',
      }),
    )
  }

  if (row.record.sampleSummary.sampleWaitingReturnCount > 0 || row.record.sampleSummary.overdueReturnCount > 0) {
    rows.push(
      buildCommonException(row, 'SAMPLE_OVERDUE', rows.length + 1, latestView, {
        triggerSummary: `样衣待归还 ${row.record.sampleSummary.sampleWaitingReturnCount} 件，超期 ${row.record.sampleSummary.overdueReturnCount} 件。`,
        evidenceSummary: `使用中 ${row.record.sampleSummary.sampleInUseCount} 件，可调用 ${row.record.sampleSummary.sampleAvailableCount} 件。`,
        latestActionSummary: '样衣流转仍需平台核对回仓状态',
        latestActionAt: row.record.sampleSummary.latestSampleActionAt || row.record.lastUpdatedAt,
        latestActionBy: row.record.sampleSummary.latestSampleActionBy || row.assignedFactoryName,
        suggestedAction: '回仓库管理页核对样衣当前节点、归还时间和下一步去向。',
      }),
    )
  }

  if (row.record.warehouseSummary.waitingHandoverCount > 0) {
    rows.push(
      buildCommonException(row, 'HANDOVER_PENDING', rows.length + 1, latestView, {
        triggerSummary: `当前仍有 ${row.record.warehouseSummary.waitingHandoverCount} 组裁片待交接后道。`,
        evidenceSummary: `已交接 ${row.record.warehouseSummary.handedOverCount} 组，仓内节奏仍待收口。`,
        latestActionSummary: '后道交接尚未完成确认',
        latestActionAt: row.record.warehouseSummary.latestInboundAt || row.record.lastUpdatedAt,
        latestActionBy: row.record.warehouseSummary.latestInboundBy || row.assignedFactoryName,
        suggestedAction: '回仓库管理页核对待发后道状态，确认当前交接对象和去向。',
      }),
    )
  }

  return rows
}

export function buildPlatformCuttingExceptionViews(
  rows: PlatformCuttingOverviewRow[] = buildPlatformCuttingRuntimeOverviewData().rows,
): CuttingException[] {
  return rows.flatMap((row) => buildExceptionsForRow(row))
}
