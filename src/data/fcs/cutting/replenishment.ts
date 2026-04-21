import { readMarkerSpreadingPrototypeData } from '../../../pages/process-factory/cutting/marker-spreading-utils.ts'
import type { SpreadingSession } from '../../../pages/process-factory/cutting/marker-spreading-model.ts'
import { listGeneratedOriginalCutOrderSourceRecords } from './generated-original-cut-orders.ts'
import type { ReplenishmentPendingPrepFollowupRecord } from './storage/replenishment-storage.ts'
import type { CuttingConfigStatus, CuttingMaterialType, CuttingReceiveStatus } from './types'

export type ReplenishmentSourceType = 'MARKER' | 'SPREADING' | 'RECEIVE_DISCREPANCY' | 'EXECUTION_RISK'
export type ReplenishmentReasonType = 'LENGTH_SHORTAGE' | 'YIELD_RISK' | 'RECEIVE_GAP' | 'MANUAL_REVIEW'
export type ReplenishmentRiskLevel = 'HIGH' | 'MEDIUM' | 'LOW'
export type ReplenishmentReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'NEED_MORE_INFO'
export type ReplenishmentImpactFlag = 'RECONFIG_REQUIRED' | 'RERECEIVE_REQUIRED' | 'PENDING_PREP_REQUIRED'

export interface ReplenishmentDocumentSummary {
  docType: 'CUT_PIECE_ORDER' | 'CONFIG_BATCH' | 'PICKUP_RECORD' | 'REPLENISHMENT_REVIEW'
  docNo: string
  status: string
  createdAt: string
  summaryText: string
}

export interface ReplenishmentImpactPreview {
  requiresReconfig: boolean
  requiresRereceive: boolean
  requiresPendingPrep: boolean
  impactDescription: string
  nextSuggestedActionText: string
}

export interface ReplenishmentSuggestionRecord {
  id: string
  replenishmentNo: string
  cutPieceOrderNo: string
  productionOrderNo: string
  materialSku: string
  materialType: CuttingMaterialType
  materialLabel: string
  suggestionCreatedAt: string
  suggestionSourceTypes: ReplenishmentSourceType[]
  shortageReasonType: ReplenishmentReasonType
  riskLevel: ReplenishmentRiskLevel
  reviewStatus: ReplenishmentReviewStatus
  reviewerName: string
  reviewedAt: string
  reviewComment: string
  requiredQty: number
  theoreticalYieldQty: number
  predictedActualQty: number
  gapQty: number
  suggestedReplenishRollCount: number
  suggestedReplenishLength: number
  configStatus: CuttingConfigStatus
  receiveStatus: CuttingReceiveStatus
  configuredLength: number
  receivedLength: number
  latestReceiveAt: string
  latestReceiveBy: string
  markerSizeMixSummary: string
  markerTotalPieces: number
  markerNetLength: number
  perPieceConsumption: number
  spreadingLayerCount: number
  fabricHeadLength: number
  fabricTailLength: number
  hasMarkerImage: boolean
  spreadingRecordCount: number
  totalSpreadLength: number
  latestSpreadingAt: string
  latestSpreadingBy: string
  hasExecutionDiscrepancy: boolean
  impactFlags: ReplenishmentImpactFlag[]
  impactPreview: ReplenishmentImpactPreview
  linkedDocumentSummaries: ReplenishmentDocumentSummary[]
  note: string
}

export interface ReplenishmentFilters {
  keyword: string
  materialType: 'ALL' | CuttingMaterialType
  reviewStatus: 'ALL' | ReplenishmentReviewStatus
  riskLevel: 'ALL' | ReplenishmentRiskLevel
  impactFilter: 'ALL' | ReplenishmentImpactFlag
  sourceType: 'ALL' | ReplenishmentSourceType
}

export const replenishmentSuggestionRecords: ReplenishmentSuggestionRecord[] = [
  {
    id: 'rep-001',
    replenishmentNo: 'RP-202603-018-01',
    cutPieceOrderNo: 'CP-202603-018-01',
    productionOrderNo: 'PO-202603-018',
    materialSku: 'ML-PRINT-240311-01',
    materialType: 'PRINT',
    materialLabel: '面料 · 玫瑰满印布',
    suggestionCreatedAt: '2026-03-22 10:35',
    suggestionSourceTypes: ['SPREADING', 'RECEIVE_DISCREPANCY'],
    shortageReasonType: 'LENGTH_SHORTAGE',
    riskLevel: 'HIGH',
    reviewStatus: 'PENDING',
    reviewerName: '',
    reviewedAt: '',
    reviewComment: '',
    requiredQty: 124,
    theoreticalYieldQty: 122,
    predictedActualQty: 108,
    gapQty: 16,
    suggestedReplenishRollCount: 2,
    suggestedReplenishLength: 86,
    configStatus: 'PARTIAL',
    receiveStatus: 'PARTIAL',
    configuredLength: 650,
    receivedLength: 430,
    latestReceiveAt: '2026-03-20 14:12',
    latestReceiveBy: '黄秀娟',
    markerSizeMixSummary: 'S×30 / M×36 / L×32 / XL×18 / 2XL×8',
    markerTotalPieces: 124,
    markerNetLength: 12.8,
    perPieceConsumption: 0.103,
    spreadingLayerCount: 82,
    fabricHeadLength: 3.2,
    fabricTailLength: 2.6,
    hasMarkerImage: true,
    spreadingRecordCount: 2,
    totalSpreadLength: 442.7,
    latestSpreadingAt: '2026-03-21 09:45',
    latestSpreadingBy: '郑海燕',
    hasExecutionDiscrepancy: true,
    impactFlags: ['RECONFIG_REQUIRED', 'RERECEIVE_REQUIRED', 'PENDING_PREP_REQUIRED'],
    impactPreview: {
      requiresReconfig: true,
      requiresRereceive: true,
      requiresPendingPrep: true,
      impactDescription: '当前领料差异与铺布长度缺口叠加，若补料通过，需要仓库重新补配并补打领料单。',
      nextSuggestedActionText: '优先回到仓库配料页补齐 2 卷，再由仓库配料领料继续处理。',
    },
    linkedDocumentSummaries: [
      { docType: 'CUT_PIECE_ORDER', docNo: 'CP-202603-018-01', status: '裁片执行中', createdAt: '2026-03-18 09:10', summaryText: '已维护唛架并有 2 条铺布记录。' },
      { docType: 'CONFIG_BATCH', docNo: 'CFG-018-03', status: '待补齐', createdAt: '2026-03-20 08:45', summaryText: '最新补配 4 卷 / 220 米，尚未完全覆盖缺口。' },
      { docType: 'PICKUP_RECORD', docNo: 'RCV-018-01', status: '驳回核对', createdAt: '2026-03-20 14:12', summaryText: '现场少领 2 卷，当前存在执行差异。' },
      { docType: 'REPLENISHMENT_REVIEW', docNo: '—', status: '待审核', createdAt: '-', summaryText: '等待运营审核是否生效。' },
    ],
    note: '该建议通过后只回到仓库配料领料，不在此处分流其它后续业务对象。',
  },
  {
    id: 'rep-002',
    replenishmentNo: 'RP-202603-024-02',
    cutPieceOrderNo: 'CP-202603-024-02',
    productionOrderNo: 'PO-202603-024',
    materialSku: 'ML-LIN-240320-09',
    materialType: 'LINING',
    materialLabel: '里布 · 涤纶里布 150D',
    suggestionCreatedAt: '2026-03-22 10:30',
    suggestionSourceTypes: ['MARKER', 'MANUAL_REVIEW'],
    shortageReasonType: 'YIELD_RISK',
    riskLevel: 'MEDIUM',
    reviewStatus: 'NEED_MORE_INFO',
    reviewerName: '陈秋颖',
    reviewedAt: '2026-03-22 11:10',
    reviewComment: '需先补齐里布审核卷数，再确认是否按样衣参考追加 1 卷。',
    requiredQty: 46,
    theoreticalYieldQty: 46,
    predictedActualQty: 42,
    gapQty: 4,
    suggestedReplenishRollCount: 1,
    suggestedReplenishLength: 38,
    configStatus: 'NOT_CONFIGURED',
    receiveStatus: 'NOT_RECEIVED',
    configuredLength: 0,
    receivedLength: 0,
    latestReceiveAt: '',
    latestReceiveBy: '',
    markerSizeMixSummary: 'S×12 / M×12 / L×10 / XL×8 / 2XL×4',
    markerTotalPieces: 46,
    markerNetLength: 6.4,
    perPieceConsumption: 0.139,
    spreadingLayerCount: 64,
    fabricHeadLength: 2.1,
    fabricTailLength: 1.8,
    hasMarkerImage: false,
    spreadingRecordCount: 0,
    totalSpreadLength: 0,
    latestSpreadingAt: '',
    latestSpreadingBy: '',
    hasExecutionDiscrepancy: false,
    impactFlags: ['RECONFIG_REQUIRED'],
    impactPreview: {
      requiresReconfig: true,
      requiresRereceive: false,
      requiresPendingPrep: true,
      impactDescription: '当前建议主要用于补充里布准备，若审核通过，需要重新回到仓库配料页完成配置。',
      nextSuggestedActionText: '先补齐审核卷数，再决定是否补里布 1 卷。',
    },
    linkedDocumentSummaries: [
      { docType: 'CUT_PIECE_ORDER', docNo: 'CP-202603-024-02', status: '待维护唛架', createdAt: '2026-03-21 09:50', summaryText: '里布裁片单已维护尺码配比，但唛架图未上传。' },
      { docType: 'CONFIG_BATCH', docNo: '—', status: '未配置', createdAt: '-', summaryText: '当前尚未产生仓库配料批次。' },
      { docType: 'PICKUP_RECORD', docNo: '—', status: '暂无', createdAt: '-', summaryText: '尚未有领料扫码记录。' },
      { docType: 'REPLENISHMENT_REVIEW', docNo: 'RV-202603-024-02', status: '待补充说明', createdAt: '2026-03-22 11:10', summaryText: '等待补充里布审核依据后再决定。' },
    ],
    note: '当前不单独创建补料配置流，只在审核后提示返回仓库配料页处理。',
  },
  {
    id: 'rep-003',
    replenishmentNo: 'RP-202603-031-01',
    cutPieceOrderNo: 'CP-202603-031-01',
    productionOrderNo: 'PO-202603-031',
    materialSku: 'ML-PRINT-240327-08',
    materialType: 'PRINT',
    materialLabel: '面料 · 复古花叶提花',
    suggestionCreatedAt: '2026-03-22 12:05',
    suggestionSourceTypes: ['SPREADING', 'EXECUTION_RISK'],
    shortageReasonType: 'LENGTH_SHORTAGE',
    riskLevel: 'HIGH',
    reviewStatus: 'APPROVED',
    reviewerName: '陆嘉敏',
    reviewedAt: '2026-03-22 13:20',
    reviewComment: '同意补 1 卷，审批通过后统一回仓库配料领料继续处理。',
    requiredQty: 96,
    theoreticalYieldQty: 96,
    predictedActualQty: 88,
    gapQty: 8,
    suggestedReplenishRollCount: 1,
    suggestedReplenishLength: 52,
    configStatus: 'CONFIGURED',
    receiveStatus: 'PARTIAL',
    configuredLength: 290,
    receivedLength: 238,
    latestReceiveAt: '2026-03-22 11:18',
    latestReceiveBy: '郑海燕',
    markerSizeMixSummary: 'S×24 / M×28 / L×26 / XL×12 / 2XL×6',
    markerTotalPieces: 96,
    markerNetLength: 10.2,
    perPieceConsumption: 0.106,
    spreadingLayerCount: 76,
    fabricHeadLength: 2.8,
    fabricTailLength: 2.2,
    hasMarkerImage: true,
    spreadingRecordCount: 1,
    totalSpreadLength: 177.8,
    latestSpreadingAt: '2026-03-22 10:55',
    latestSpreadingBy: '郑海燕',
    hasExecutionDiscrepancy: true,
    impactFlags: ['RECONFIG_REQUIRED', 'RERECEIVE_REQUIRED', 'PENDING_PREP_REQUIRED'],
    impactPreview: {
      requiresReconfig: true,
      requiresRereceive: true,
      requiresPendingPrep: true,
      impactDescription: '该补料建议已通过，后续需回仓补配并重新领料，由仓库配料领料模块继续处理。',
      nextSuggestedActionText: '回到仓库配料页新增补配批次，并继续仓库待配料处理。',
    },
    linkedDocumentSummaries: [
      { docType: 'CUT_PIECE_ORDER', docNo: 'CP-202603-031-01', status: '裁片执行中', createdAt: '2026-03-22 08:35', summaryText: '唛架图已上传，现场已有 1 条铺布记录。' },
      { docType: 'CONFIG_BATCH', docNo: 'CFG-031-02', status: '已完成', createdAt: '2026-03-22 08:40', summaryText: '本批次补齐剩余 5 卷 / 290 米。' },
      { docType: 'PICKUP_RECORD', docNo: 'RCV-031-01', status: '已提交照片', createdAt: '2026-03-22 11:18', summaryText: '现场少领 1 卷，已提交 3 张差异照片。' },
      { docType: 'REPLENISHMENT_REVIEW', docNo: 'RV-202603-031-01', status: '已通过', createdAt: '2026-03-22 13:20', summaryText: '已生效，待回到仓库配料继续处理。' },
    ],
    note: '该建议已生效，唯一 follow-up 是在原裁片任务下生成补料待配料。',
  },
  {
    id: 'rep-004',
    replenishmentNo: 'RP-202603-031-03',
    cutPieceOrderNo: 'CP-202603-031-02',
    productionOrderNo: 'PO-202603-031',
    materialSku: 'ML-SOLID-240327-21',
    materialType: 'SOLID',
    materialLabel: '面料 · 水洗白府绸',
    suggestionCreatedAt: '2026-03-22 15:10',
    suggestionSourceTypes: ['RECEIVE_DISCREPANCY'],
    shortageReasonType: 'RECEIVE_GAP',
    riskLevel: 'LOW',
    reviewStatus: 'REJECTED',
    reviewerName: '陆嘉敏',
    reviewedAt: '2026-03-22 15:45',
    reviewComment: '复核后确认为扫描漏记，不需要补料，维持当前入仓节奏。',
    requiredQty: 70,
    theoreticalYieldQty: 70,
    predictedActualQty: 69,
    gapQty: 1,
    suggestedReplenishRollCount: 0,
    suggestedReplenishLength: 0,
    configStatus: 'CONFIGURED',
    receiveStatus: 'RECEIVED',
    configuredLength: 360,
    receivedLength: 360,
    latestReceiveAt: '2026-03-22 13:10',
    latestReceiveBy: '郑海燕',
    markerSizeMixSummary: 'S×16 / M×20 / L×20 / XL×10 / 2XL×4',
    markerTotalPieces: 70,
    markerNetLength: 8.4,
    perPieceConsumption: 0.12,
    spreadingLayerCount: 58,
    fabricHeadLength: 1.9,
    fabricTailLength: 1.6,
    hasMarkerImage: true,
    spreadingRecordCount: 2,
    totalSpreadLength: 270,
    latestSpreadingAt: '2026-03-22 14:30',
    latestSpreadingBy: '郑海燕',
    hasExecutionDiscrepancy: false,
    impactFlags: [],
    impactPreview: {
      requiresReconfig: false,
      requiresRereceive: false,
      requiresPendingPrep: false,
      impactDescription: '该建议已驳回，不需要补料，也不会触发后续配料或领料调整。',
      nextSuggestedActionText: '维持当前入仓与汇总节奏，记录审核意见即可。',
    },
    linkedDocumentSummaries: [
      { docType: 'CUT_PIECE_ORDER', docNo: 'CP-202603-031-02', status: '已入仓', createdAt: '2026-03-22 15:20', summaryText: '该裁片单已完成入裁片仓。' },
      { docType: 'CONFIG_BATCH', docNo: 'CFG-031-03', status: '已完成', createdAt: '2026-03-22 09:00', summaryText: '整单一次发齐。' },
      { docType: 'PICKUP_RECORD', docNo: 'RCV-031-02', status: '匹配', createdAt: '2026-03-22 13:10', summaryText: '扫码领料与配置一致。' },
      { docType: 'REPLENISHMENT_REVIEW', docNo: 'RV-202603-031-03', status: '已驳回', createdAt: '2026-03-22 15:45', summaryText: '复核确认无需补料。' },
    ],
    note: '该单仅保留审核痕迹，用于总结页汇总补料驳回次数。',
  },
  {
    id: 'rep-005',
    replenishmentNo: 'RP-202603-044-01',
    cutPieceOrderNo: 'CP-202603-044-01',
    productionOrderNo: 'PO-202603-044',
    materialSku: 'ML-DYE-240331-06',
    materialType: 'DYE',
    materialLabel: '面料 · 雾蓝细斜布',
    suggestionCreatedAt: '2026-03-22 16:00',
    suggestionSourceTypes: ['EXECUTION_RISK', 'MARKER'],
    shortageReasonType: 'MANUAL_REVIEW',
    riskLevel: 'MEDIUM',
    reviewStatus: 'PENDING',
    reviewerName: '',
    reviewedAt: '',
    reviewComment: '',
    requiredQty: 88,
    theoreticalYieldQty: 88,
    predictedActualQty: 82,
    gapQty: 6,
    suggestedReplenishRollCount: 1,
    suggestedReplenishLength: 40,
    configStatus: 'PARTIAL',
    receiveStatus: 'NOT_RECEIVED',
    configuredLength: 180,
    receivedLength: 0,
    latestReceiveAt: '',
    latestReceiveBy: '',
    markerSizeMixSummary: 'S×18 / M×22 / L×24 / XL×16 / 2XL×8',
    markerTotalPieces: 88,
    markerNetLength: 9.1,
    perPieceConsumption: 0.104,
    spreadingLayerCount: 69,
    fabricHeadLength: 2.4,
    fabricTailLength: 1.9,
    hasMarkerImage: false,
    spreadingRecordCount: 0,
    totalSpreadLength: 0,
    latestSpreadingAt: '',
    latestSpreadingBy: '',
    hasExecutionDiscrepancy: false,
    impactFlags: ['RECONFIG_REQUIRED', 'PENDING_PREP_REQUIRED'],
    impactPreview: {
      requiresReconfig: true,
      requiresRereceive: false,
      requiresPendingPrep: true,
      impactDescription: '若补料建议通过，仓库需回到配料页重新补配，并生成补料待配料。',
      nextSuggestedActionText: '先审核是否补 1 卷，再回到仓库配料页继续处理。',
    },
    linkedDocumentSummaries: [
      { docType: 'CUT_PIECE_ORDER', docNo: 'CP-202603-044-01', status: '待铺布', createdAt: '2026-03-22 09:30', summaryText: '当前只有唛架摘要，尚无铺布记录。' },
      { docType: 'CONFIG_BATCH', docNo: 'CFG-044-01', status: '部分配置', createdAt: '2026-03-22 10:20', summaryText: '当前仅配置 180 米，低于理论需求。' },
      { docType: 'PICKUP_RECORD', docNo: '—', status: '未领料', createdAt: '-', summaryText: '尚无扫码领取记录。' },
      { docType: 'REPLENISHMENT_REVIEW', docNo: '—', status: '待审核', createdAt: '-', summaryText: '待确认是否生成补料待配料。' },
    ],
    note: '该建议重点在于提醒补料后需回仓库待配料，不在本步分流其它工艺页面。',
  },
]

export function cloneReplenishmentSuggestionRecords(): ReplenishmentSuggestionRecord[] {
  return replenishmentSuggestionRecords.map((record) => ({
    ...record,
    suggestionSourceTypes: [...record.suggestionSourceTypes],
    impactFlags: [...record.impactFlags],
    impactPreview: { ...record.impactPreview },
    linkedDocumentSummaries: record.linkedDocumentSummaries.map((doc) => ({ ...doc })),
  }))
}

export interface ReplenishmentFlowTraceMatrixRow {
  suggestionId: string
  replenishmentRequestId: string
  replenishmentNo: string
  reviewStatus: ReplenishmentReviewStatus
  originalCutOrderId: string
  originalCutOrderNo: string
  materialSku: string
  color: string
  shortageGarmentQty: number
  sourceSpreadingSessionId: string
  sourceSpreadingSessionNo: string
  sourceMarkerId: string
  sourceMarkerNo: string
  mergeBatchId: string
  mergeBatchNo: string
  sourceWritebackId: string
  pendingPrepFollowupId: string
}

function resolveReplenishmentSourceOriginal(
  suggestion: ReplenishmentSuggestionRecord,
  sourceRecords: ReturnType<typeof listGeneratedOriginalCutOrderSourceRecords>,
) {
  const byExactNo =
    sourceRecords.find((record) => record.originalCutOrderNo === suggestion.cutPieceOrderNo)
    || sourceRecords.find((record) => record.originalCutOrderNo === suggestion.cutPieceOrderNo.replace(/^CP-/, 'CUT-'))
  if (byExactNo) return byExactNo

  const sameProductionOrder = sourceRecords.filter((record) => record.productionOrderNo === suggestion.productionOrderNo)
  if (!sameProductionOrder.length) return null

  return (
    sameProductionOrder
      .slice()
      .sort((left, right) => {
        const score = (record: (typeof sameProductionOrder)[number]) => {
          let value = 0
          if (record.materialSku === suggestion.materialSku) value += 32
          if (record.materialType === suggestion.materialType) value += 20
          if (record.materialLabel === suggestion.materialLabel) value += 12
          if (record.requiredQty === suggestion.requiredQty) value += 8
          if (record.mergeBatchId) value += 2
          return value
        }
        return score(right) - score(left) || right.originalCutOrderNo.localeCompare(left.originalCutOrderNo, 'zh-CN')
      })[0] || null
  )
}

function pickReplenishmentSourceSession(
  suggestion: ReplenishmentSuggestionRecord,
  sourceOriginalCutOrderId: string,
  sessions: SpreadingSession[],
): SpreadingSession | null {
  const scoreSession = (session: SpreadingSession) => {
    let value = 0
    if (sourceOriginalCutOrderId && session.originalCutOrderIds.includes(sourceOriginalCutOrderId)) value += 40
    if ((session.completionLinkage?.linkedOriginalCutOrderNos || []).includes(suggestion.cutPieceOrderNo)) value += 20
    if ((session.completionLinkage?.linkedOriginalCutOrderNos || []).includes(suggestion.cutPieceOrderNo.replace(/^CP-/, 'CUT-'))) value += 18
    if (session.materialSkuSummary?.includes(suggestion.materialSku)) value += 12
    if (suggestion.reviewStatus === 'PENDING' && session.prototypeLifecycleOverrides?.replenishmentStatusLabel === '待补料确认') value += 24
    if (suggestion.reviewStatus === 'APPROVED' && session.replenishmentWarning?.handled) value += 18
    if (session.status === 'DONE') value += 8
    if (session.sourceMarkerId || session.markerId) value += 2
    return value
  }

  const directMatchedSessions = sessions.filter(
    (session) =>
      session.originalCutOrderIds.includes(sourceOriginalCutOrderId)
      || (session.completionLinkage?.linkedOriginalCutOrderNos || []).includes(suggestion.cutPieceOrderNo)
      || (session.completionLinkage?.linkedOriginalCutOrderNos || []).includes(suggestion.cutPieceOrderNo.replace(/^CP-/, 'CUT-')),
  )
  const rankedSessions = (directMatchedSessions.length ? directMatchedSessions : sessions)
    .slice()
    .sort((left, right) => {
      return scoreSession(right) - scoreSession(left) || right.updatedAt.localeCompare(left.updatedAt, 'zh-CN')
    })

  const best = rankedSessions[0] || null
  if (!best) return null
  const threshold = directMatchedSessions.length ? 18 : 24
  return scoreSession(best) >= threshold ? best : null
}

function isPendingReplenishmentSession(session: SpreadingSession): boolean {
  return session.prototypeLifecycleOverrides?.replenishmentStatusLabel === '待补料确认'
}

function isHandledReplenishmentSession(session: SpreadingSession): boolean {
  return Boolean(session.replenishmentWarning?.handled) || session.status === 'DONE'
}

function buildReplenishmentSourceSessionMap(
  records: ReplenishmentSuggestionRecord[],
  sessions: SpreadingSession[],
): Map<string, SpreadingSession> {
  const originalSourceRecords = listGeneratedOriginalCutOrderSourceRecords()
  const usedSessionIds = new Set<string>()
  const sessionBySuggestionId = new Map<string, SpreadingSession>()
  const pendingPool = sessions.filter(isPendingReplenishmentSession)
  const handledPool = sessions.filter(isHandledReplenishmentSession)

  records.forEach((record) => {
    const sourceOriginal = resolveReplenishmentSourceOriginal(record, originalSourceRecords)
    const directSession = pickReplenishmentSourceSession(record, sourceOriginal?.originalCutOrderId || '', sessions)
    if (directSession && !usedSessionIds.has(directSession.spreadingSessionId)) {
      sessionBySuggestionId.set(record.id, directSession)
      usedSessionIds.add(directSession.spreadingSessionId)
      return
    }

    const pool = record.reviewStatus === 'APPROVED' ? handledPool : pendingPool
    const fallbackSession =
      pool.find((session) => !usedSessionIds.has(session.spreadingSessionId) && session.materialSkuSummary?.includes(record.materialSku))
      || pool.find((session) => !usedSessionIds.has(session.spreadingSessionId))
      || null
    if (!fallbackSession) return
    sessionBySuggestionId.set(record.id, fallbackSession)
    usedSessionIds.add(fallbackSession.spreadingSessionId)
  })

  return sessionBySuggestionId
}

export function buildSeedReplenishmentPendingPrepFollowups(
  records: ReplenishmentSuggestionRecord[] = cloneReplenishmentSuggestionRecords(),
): ReplenishmentPendingPrepFollowupRecord[] {
  const originalSourceRecords = listGeneratedOriginalCutOrderSourceRecords()
  const { store } = readMarkerSpreadingPrototypeData()
  const sessionBySuggestionId = buildReplenishmentSourceSessionMap(records, store.sessions)

  return records
    .filter((record) => record.reviewStatus === 'APPROVED')
    .map((record, index) => {
      const sourceOriginal = resolveReplenishmentSourceOriginal(record, originalSourceRecords)
      const sourceSession =
        sessionBySuggestionId.get(record.id)
        || pickReplenishmentSourceSession(record, sourceOriginal?.originalCutOrderId || '', store.sessions)
      const sourceColor = sourceOriginal?.colorScope[0] || sourceSession?.colorSummary?.split(' / ')[0] || ''
      return {
        followupId: `pending-prep-${record.id}`,
        suggestionId: record.id,
        sourceReplenishmentRequestId: record.id,
        sourceSpreadingSessionId: sourceSession?.spreadingSessionId || '',
        sourceMarkerId: sourceSession?.sourceMarkerId || sourceSession?.markerId || '',
        sourceMarkerNo: sourceSession?.sourceMarkerNo || sourceSession?.markerNo || '',
        originalCutOrderId:
          sourceOriginal?.originalCutOrderId
          || sourceSession?.originalCutOrderIds?.[0]
          || `original-${index + 1}`,
        originalCutOrderNo:
          sourceOriginal?.originalCutOrderNo
          || sourceSession?.originalCutOrderNos?.[0]
          || record.cutPieceOrderNo,
        materialSku: record.materialSku,
        color: sourceColor,
        shortageGarmentQty: Math.max(record.gapQty, 0),
        status: 'PENDING_PREP',
        createdAt: record.reviewedAt || record.suggestionCreatedAt,
        createdBy: record.reviewerName || '补料审核',
        note: '补料审批通过后，仅回到原裁片任务的仓库配料领料记录下生成待配料。',
      }
    })
    .sort(
      (left, right) =>
        left.originalCutOrderNo.localeCompare(right.originalCutOrderNo, 'zh-CN')
        || left.materialSku.localeCompare(right.materialSku, 'zh-CN'),
    )
}

export function buildReplenishmentFlowTraceMatrix(
  records: ReplenishmentSuggestionRecord[] = cloneReplenishmentSuggestionRecords(),
  pendingPrepFollowups: ReplenishmentPendingPrepFollowupRecord[] = buildSeedReplenishmentPendingPrepFollowups(records),
): ReplenishmentFlowTraceMatrixRow[] {
  const originalSourceRecords = listGeneratedOriginalCutOrderSourceRecords()
  const pendingPrepBySuggestionId = new Map(pendingPrepFollowups.map((record) => [record.suggestionId, record] as const))
  const { store } = readMarkerSpreadingPrototypeData()
  const sessionBySuggestionId = buildReplenishmentSourceSessionMap(records, store.sessions)

  return records
    .map((record) => {
      const sourceOriginal = resolveReplenishmentSourceOriginal(record, originalSourceRecords)
      const sourceSession =
        sessionBySuggestionId.get(record.id)
        || pickReplenishmentSourceSession(record, sourceOriginal?.originalCutOrderId || '', store.sessions)
      const pendingPrep = pendingPrepBySuggestionId.get(record.id) || null
      const sourceColor =
        sourceOriginal?.colorScope[0]
        || pendingPrep?.color
        || sourceSession?.colorSummary?.split(' / ')[0]
        || ''
      return {
        suggestionId: record.id,
        replenishmentRequestId: record.id,
        replenishmentNo: record.replenishmentNo,
        reviewStatus: record.reviewStatus,
        originalCutOrderId:
          sourceOriginal?.originalCutOrderId
          || pendingPrep?.originalCutOrderId
          || sourceSession?.originalCutOrderIds?.[0]
          || '',
        originalCutOrderNo:
          sourceOriginal?.originalCutOrderNo
          || pendingPrep?.originalCutOrderNo
          || sourceSession?.originalCutOrderNos?.[0]
          || record.cutPieceOrderNo,
        materialSku: record.materialSku,
        color: sourceColor,
        shortageGarmentQty: Math.max(record.gapQty, 0),
        sourceSpreadingSessionId: sourceSession?.spreadingSessionId || pendingPrep?.sourceSpreadingSessionId || '',
        sourceSpreadingSessionNo: sourceSession?.sessionNo || sourceSession?.spreadingSessionId || '',
        sourceMarkerId: sourceSession?.sourceMarkerId || sourceSession?.markerId || pendingPrep?.sourceMarkerId || '',
        sourceMarkerNo: sourceSession?.sourceMarkerNo || sourceSession?.markerNo || pendingPrep?.sourceMarkerNo || '',
        mergeBatchId: sourceSession?.mergeBatchId || sourceOriginal?.mergeBatchId || '',
        mergeBatchNo: sourceSession?.mergeBatchNo || sourceOriginal?.mergeBatchNo || '',
        sourceWritebackId: sourceSession?.sourceWritebackId || '',
        pendingPrepFollowupId: pendingPrep?.followupId || '',
      }
    })
    .sort(
      (left, right) =>
        left.originalCutOrderNo.localeCompare(right.originalCutOrderNo, 'zh-CN')
        || left.materialSku.localeCompare(right.materialSku, 'zh-CN')
        || left.color.localeCompare(right.color, 'zh-CN')
        || left.replenishmentNo.localeCompare(right.replenishmentNo, 'zh-CN'),
    )
}
