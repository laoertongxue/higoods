import type { MaterialPrepRow } from './material-prep-model.ts'
import type { MarkerPlanSourceRecord } from './marker-plan-source-model.ts'
import { DEFAULT_MARKER_BED_SPREADING_DURATION_MINUTES } from './cutting-table-resource.ts'
import {
  buildMarkerSeedDraft,
  buildMarkerSpreadingNavigationPayload,
  buildSpreadingVarianceWarning,
  buildMarkerWarningMessages,
  buildSpreadingVarianceSummary,
  buildSpreadingWarningMessages,
  computeActualCutQty,
  computeOperatorHandledLayerCount,
  computeOperatorHandledPieceQty,
  computeLengthVariance,
  computeHighLowCuttingTotals,
  computeHighLowPatternTotals,
  computeMarkerTotalPieces,
  computeRemainingLength,
  computeRollActualCutGarmentQty,
  computeRollActualCutPieceQty,
  computeShortageQty,
  computeSinglePieceUsage,
  computeTheoreticalCutQty,
  computeNormalMarkerSpreadTotalLength,
  computeUsableLength,
  computeUsageSummary,
  buildRollHandoverViewModel,
  buildSpreadingSessionOperationLogs,
  buildSpreadingHandoverListSummary,
  createEmptyStore,
  createOperatorRecordDraft,
  createRollRecordDraft,
  createSpreadingDraftFromMarker,
  formatRollOperatorLayerRows,
  CUTTING_MARKER_SPREADING_LEDGER_STORAGE_KEY,
  DEFAULT_HIGH_LOW_PATTERN_KEYS,
  findSpreadingPlanUnitById,
  deriveMarkerTemplateByMode,
  deriveMarkerModeMeta,
  deriveSpreadingColorSummary,
  deriveSpreadingModeMeta,
  deserializeMarkerSpreadingStorage,
  buildRollActualCutGarmentQtyFormula,
  MARKER_SIZE_KEYS,
  summarizeSpreadingRolls,
  summarizeSpreadingOperatorAmounts,
  summarizeSpreadingOperators,
  validateMarkerModeShape,
  buildOperatorAmountWarnings,
  type SpreadingVarianceWarning,
  type SpreadingSuggestedAction,
  type HighLowCuttingRow,
  type HighLowPatternRow,
  type MarkerLineItem,
  type MarkerModeKey,
  type MarkerRecord,
  type MarkerSpreadingContext,
  type MarkerSpreadingPrefilter,
  type MarkerSpreadingStore,
  type SpreadingOperatorAmountSummary,
  type SpreadingOperatorRecord,
  type SpreadingRollHandoverSummary,
  type SpreadingSourceChannel,
  type SpreadingStatusKey,
  type SpreadingCuttingStatusKey,
  type SpreadingSession,
} from './marker-spreading-model.ts'
import { buildMarkerSpreadingProjection } from './marker-spreading-projection.ts'
import {
  buildMarkerAllocationSourceRows,
  buildMarkerPieceExplosionViewModel,
  type MarkerAllocationSizeSummaryRow,
  type MarkerAllocationSourceRow,
  type MarkerExplosionAllocationRow,
  type MarkerExplosionMissingMappingRow,
  type MarkerExplosionPieceDetailRow,
  type MarkerExplosionSkuSummaryRow,
  type MarkerPieceExplosionTotals,
} from './marker-piece-explosion.ts'

export {
  buildMarkerSpreadingNavigationPayload,
  buildSpreadingVarianceWarning,
  buildMarkerWarningMessages,
  buildSpreadingVarianceSummary,
  buildSpreadingWarningMessages,
  computeActualCutQty,
  computeOperatorHandledLayerCount,
  computeOperatorHandledPieceQty,
  computeLengthVariance,
  computeHighLowCuttingTotals,
  computeHighLowPatternTotals,
  computeMarkerTotalPieces,
  computeRemainingLength,
  computeRollActualCutGarmentQty,
  computeRollActualCutPieceQty,
  computeShortageQty,
  computeSinglePieceUsage,
  computeTheoreticalCutQty,
  computeNormalMarkerSpreadTotalLength,
  computeUsableLength,
  computeUsageSummary,
  buildRollHandoverViewModel,
  buildRollActualCutGarmentQtyFormula,
  buildSpreadingHandoverListSummary,
  buildOperatorAmountWarnings,
  DEFAULT_HIGH_LOW_PATTERN_KEYS,
  findSpreadingPlanUnitById,
  deriveMarkerTemplateByMode,
  deriveMarkerModeMeta,
  deriveSpreadingModeMeta,
  MARKER_SIZE_KEYS,
  summarizeSpreadingRolls,
  summarizeSpreadingOperatorAmounts,
  validateMarkerModeShape,
}

export interface MarkerListRow {
  markerId: string
  markerNo: string
  contextType: 'cut-order' | 'marker-plan'
  contextLabel: string
  cutOrderCount: number
  cutOrderNos: string[]
  markerPlanNo: string
  styleCode: string
  spuCode: string
  materialSkuSummary: string
  materialAliasSummary: string
  materialImageUrl: string
  colorSummary: string
  markerMode: MarkerRecord['markerMode']
  markerModeLabel: string
  totalPieces: number
  netLength: number
  singlePieceUsage: number
  spreadTotalLength: number
  markerImageStatus: string
  hasImage: boolean
  hasAdjustment: boolean
  updatedAt: string
  lineItemCount: number
  lineSummary: string
  record: MarkerRecord
  keywordIndex: string[]
}

export interface MarkerDetailViewModel {
  row: MarkerListRow
  lineSummary: MarkerLineItemSummary
  sizeRatioPlanText: string
  totalLineSpreadLength: number
  templateType: 'row-template' | 'matrix-template'
  usageSummary: ReturnType<typeof computeUsageSummary>
  warningMessages: string[]
  highLowPatternKeys: string[]
  highLowCuttingRows: HighLowCuttingRow[]
  highLowPatternRows: HighLowPatternRow[]
  highLowCuttingTotal: number
  highLowPatternTotal: number
  sourceOrderRows: MarkerAllocationSourceRow[]
  allocationRows: MarkerExplosionAllocationRow[]
  allocationSizeSummary: MarkerAllocationSizeSummaryRow[]
  skuSummaryRows: MarkerExplosionSkuSummaryRow[]
  pieceDetailRows: MarkerExplosionPieceDetailRow[]
  mappingWarnings: string[]
  missingMappings: MarkerExplosionMissingMappingRow[]
  totals: MarkerPieceExplosionTotals
}

export interface SpreadingListRow {
  spreadingSessionId: string
  sessionNo: string
  contextType: 'cut-order' | 'marker-plan'
  contextLabel: string
  cutOrderCount: number
  cutOrderNos: string[]
  markerPlanNo: string
  styleCode: string
  spuCode: string
  materialSkuSummary: string
  colorSummary: string
  spreadingMode: SpreadingSession['spreadingMode']
  spreadingModeLabel: string
  rollCount: number
  operatorCount: number
  totalActualLength: number
  totalCalculatedUsableLength: number
  totalRemainingLength: number
  actualCutPieceQty: number
  plannedCutGarmentQty: number
  theoreticalCutGarmentQty: number
  actualCutGarmentQty: number
  fabricRollCount: number
  spreadLayerCount: number
  spreadActualLengthM: number
  spreadUsableLengthM: number
  spreadRemainingLengthM: number
  configuredLengthTotal: number
  claimedLengthTotal: number
  varianceLength: number
  varianceNote: string
  hasVariance: boolean
  differenceStatusLabel: string
  differenceStatusTone: 'normal' | 'warning'
  completedCutOrderCount: number
  hasHandover: boolean
  hasHandoverWarnings: boolean
  handoverStatusLabel: string
  hasOperatorAllocation: boolean
  operatorAllocationAmountTotal: number
  hasManualAdjustedAmount: boolean
  operatorAllocationStatusLabel: string
  hasWarnings: boolean
  warningStatusLabel: string
  hasVarianceWarning: boolean
  varianceWarningLevel: string
  varianceSuggestedAction: SpreadingSuggestedAction
  pendingVarianceConfirmation: boolean
  warningMessages: string[]
  varianceWarning: SpreadingVarianceWarning | null
  variancePayload: Record<string, string | undefined>
  productionOrderNos: string[]
  statusLabel: string
  statusKey: SpreadingSession['status']
  updatedAt: string
  session: SpreadingSession
  keywordIndex: string[]
}

export interface SpreadingDetailViewModel {
  row: SpreadingListRow
  markerRecord: MarkerRecord | null
  warningMessages: string[]
  varianceSummary: NonNullable<ReturnType<typeof buildSpreadingVarianceSummary>> | null
  varianceWarning: SpreadingVarianceWarning | null
  navigationPayload: ReturnType<typeof buildMarkerSpreadingNavigationPayload>
  linkedRollNos: Record<string, string>
  linkedCutOrderNos: string[]
  sortedOperators: SpreadingOperatorRecord[]
  operatorsByRollId: Record<string, SpreadingOperatorRecord[]>
  handoverSummaryByRollId: Record<string, SpreadingRollHandoverSummary>
  rollParticipantSummary: Record<string, string>
  operatorAmountSummary: SpreadingOperatorAmountSummary
  amountWarnings: string[]
}

export interface MarkerLineItemSummary {
  lineCount: number
  colorSummary: string
  totalLength: number
  totalPieces: number
  summaryText: string
}

export interface MarkerSpreadingPrototypeData {
  rows: MaterialPrepRow[]
  rowsById: Record<string, MaterialPrepRow>
  markerPlanSources: MarkerPlanSourceRecord[]
  store: MarkerSpreadingStore
}

function buildSessionContext(
  session: SpreadingSession,
  cutOrderRows: MaterialPrepRow[],
  batch: MarkerPlanSourceRecord | null,
): MarkerSpreadingContext | null {
  if (!cutOrderRows.length && !session.markerPlanId && !session.cutOrderIds.length) return null

  return {
    contextType: session.contextType,
    cutOrderIds: [...session.cutOrderIds],
    cutOrderNos: cutOrderRows.map((row) => row.cutOrderNo),
    markerPlanId: session.markerPlanId || batch?.markerPlanId || '',
    markerPlanNo: session.markerPlanNo || batch?.markerPlanNo || '',
    productionOrderNos: uniqueStrings(cutOrderRows.map((row) => row.productionOrderNo)),
    styleCode: session.styleCode || cutOrderRows[0]?.styleCode || batch?.styleCode || '',
    spuCode: session.spuCode || cutOrderRows[0]?.spuCode || batch?.spuCode || '',
    techPackSpuCode:
      uniqueStrings(cutOrderRows.map((row) => row.techPackSpuCode)).length === 1
        ? uniqueStrings(cutOrderRows.map((row) => row.techPackSpuCode))[0]
        : '',
    styleName: batch?.styleName || cutOrderRows[0]?.styleName || '',
    materialSkuSummary:
      session.materialSkuSummary ||
      batch?.materialSkuSummary ||
      uniqueStrings(cutOrderRows.map((row) => row.materialSkuSummary)).join(' / '),
    materialAliasSummary: uniqueStrings(cutOrderRows.flatMap((row) => row.materialLineItems.map((line) => line.materialAlias))).join(' / '),
    materialImageUrl: cutOrderRows.flatMap((row) => row.materialLineItems).find((line) => line.materialImageUrl)?.materialImageUrl || '',
    materialPrepRows: cutOrderRows,
  }
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))))
}

function getCompletedLinkedCutOrderIds(session: SpreadingSession): string[] {
  if (session.completionLinkage?.linkedCutOrderIds?.length) {
    return session.completionLinkage.linkedCutOrderIds
  }
  if (session.status === 'DONE' && session.contextType === 'cut-order') {
    return [...session.cutOrderIds]
  }
  return []
}

function nowText(input = new Date()): string {
  const year = input.getFullYear()
  const month = `${input.getMonth() + 1}`.padStart(2, '0')
  const day = `${input.getDate()}`.padStart(2, '0')
  const hours = `${input.getHours()}`.padStart(2, '0')
  const minutes = `${input.getMinutes()}`.padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

function buildCutOrderContext(row: MaterialPrepRow): MarkerSpreadingContext {
  return {
    contextType: 'cut-order',
    cutOrderIds: [row.cutOrderId],
    cutOrderNos: [row.cutOrderNo],
    markerPlanId: row.markerPlanIds[0] || '',
    markerPlanNo: row.latestMarkerPlanNo || row.markerPlanNos[0] || '',
    productionOrderNos: [row.productionOrderNo],
    styleCode: row.styleCode,
    spuCode: row.spuCode,
    techPackSpuCode: row.techPackSpuCode || '',
    styleName: row.styleName,
    materialSkuSummary: row.materialSkuSummary,
    materialAliasSummary: uniqueStrings(row.materialLineItems.map((line) => line.materialAlias)).join(' / '),
    materialImageUrl: row.materialLineItems.find((line) => line.materialImageUrl)?.materialImageUrl || '',
    materialPrepRows: [row],
  }
}

function buildMarkerPlanSourceContext(batch: MarkerPlanSourceRecord, rowsById: Record<string, MaterialPrepRow>): MarkerSpreadingContext | null {
  const materialPrepRows = batch.items
    .map((item) => rowsById[item.cutOrderId])
    .filter((row): row is MaterialPrepRow => Boolean(row))

  if (!materialPrepRows.length) return null

  return {
    contextType: 'marker-plan',
    cutOrderIds: materialPrepRows.map((row) => row.cutOrderId),
    cutOrderNos: materialPrepRows.map((row) => row.cutOrderNo),
    markerPlanId: batch.markerPlanId,
    markerPlanNo: batch.markerPlanNo,
    productionOrderNos: uniqueStrings(materialPrepRows.map((row) => row.productionOrderNo)),
    styleCode: batch.styleCode || materialPrepRows[0]?.styleCode || '',
    spuCode: batch.spuCode || materialPrepRows[0]?.spuCode || '',
    techPackSpuCode:
      uniqueStrings(materialPrepRows.map((row) => row.techPackSpuCode)).length === 1
        ? uniqueStrings(materialPrepRows.map((row) => row.techPackSpuCode))[0]
        : '',
    styleName: batch.styleName || materialPrepRows[0]?.styleName || '',
    materialSkuSummary: batch.materialSkuSummary || uniqueStrings(materialPrepRows.map((row) => row.materialSkuSummary)).join(' / '),
    materialAliasSummary: uniqueStrings(materialPrepRows.flatMap((row) => row.materialLineItems.map((line) => line.materialAlias))).join(' / '),
    materialImageUrl: materialPrepRows.flatMap((row) => row.materialLineItems).find((line) => line.materialImageUrl)?.materialImageUrl || '',
    materialPrepRows,
  }
}

interface SeedSessionProfile {
  code: string
  status: SpreadingStatusKey
  cuttingStatus?: SpreadingCuttingStatusKey
  sourceChannel?: SpreadingSourceChannel
  sourceWritebackId?: string
  plannedLayerCount?: number
  actualLayerCounts?: number[]
  scenarioNote?: string
}

const SEED_SESSION_MATRIX: SeedSessionProfile[][] = [
  [
    { code: 'waiting-start-a', status: 'DRAFT' },
  ],
  [
    {
      code: 'in-progress-b',
      status: 'IN_PROGRESS',
      sourceChannel: 'PDA_WRITEBACK',
      sourceWritebackId: 'pda-sync-failed-in-progress-b',
      scenarioNote: 'PDA 已写回部分卷记录，但同步失败，等待 Web 复核。',
    },
  ],
  [
    { code: 'waiting-cutting-b', status: 'DONE', cuttingStatus: 'WAITING_CUTTING' },
  ],
  [
    { code: 'cutting-b', status: 'DONE', cuttingStatus: 'CUTTING' },
  ],
  [
    {
      code: 'planned-100-actual-80-c',
      status: 'DONE',
      cuttingStatus: 'CUTTING_DONE',
      plannedLayerCount: 100,
      actualLayerCounts: [50, 30],
      scenarioNote: '计划铺 100 层，现场按已领面料先实铺 80 层并完成裁剪。',
    },
    {
      code: 'second-replan-after-pickup-c',
      status: 'DONE',
      cuttingStatus: 'CUTTING_DONE',
      plannedLayerCount: 40,
      actualLayerCounts: [24, 16],
      scenarioNote: '第二次领料后继续排唛架，继续按可用领料余额铺布裁剪。',
    },
  ],
  [
    {
      code: 'pda-sync-failed-h',
      status: 'IN_PROGRESS',
      sourceChannel: 'PDA_WRITEBACK',
      sourceWritebackId: 'pda-sync-failed-h',
      plannedLayerCount: 60,
      actualLayerCounts: [42],
      scenarioNote: 'PDA 执行记录已到达 Web，但同步失败，等待主管处理。',
    },
  ],
]

const SEED_SESSION_OWNERS = [
  { ownerAccountId: 'supervisor-liufang', ownerName: '铺布主管-刘芳' },
  { ownerAccountId: 'supervisor-zhouwei', ownerName: '铺布主管-周伟' },
  { ownerAccountId: 'planner-chenjing', ownerName: '计划员-陈静' },
] as const

function sanitizeSeedKey(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'na'
}

function formatSeedDateTimeLocal(date: Date): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hours = `${date.getHours()}`.padStart(2, '0')
  const minutes = `${date.getMinutes()}`.padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

function parseSeedDate(value?: string): Date | null {
  if (!value) return null
  const parsed = new Date(value.includes('T') ? value : value.replace(' ', 'T'))
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function ensureSpreadingScheduleDefaults(session: SpreadingSession, index: number): SpreadingSession {
  const operatorStartTimes = (session.operators || []).map((operator) => operator.startAt).filter(Boolean).sort((left, right) => left.localeCompare(right, 'zh-CN'))
  const operatorEndTimes = (session.operators || []).map((operator) => operator.endAt).filter(Boolean).sort((left, right) => right.localeCompare(left, 'zh-CN'))
  const shouldHaveCuttingStartedAt = session.cuttingStatus === 'CUTTING' || session.cuttingStatus === 'CUTTING_DONE'
  const shouldHaveCuttingFinishedAt = session.cuttingStatus === 'CUTTING_DONE'
  if (
    session.plannedStartAt &&
    session.plannedEndAt &&
    session.ownerName &&
    session.actualStartAt &&
    (session.status !== 'DONE' || session.actualEndAt) &&
    (!shouldHaveCuttingStartedAt || session.cuttingStartedAt) &&
    (!shouldHaveCuttingFinishedAt || session.cuttingFinishedAt)
  ) {
    return session
  }
  const baseDate =
    parseSeedDate(session.plannedStartAt) ||
    parseSeedDate(session.createdAt) ||
    parseSeedDate(session.updatedAt) ||
    new Date(`2026-03-${String(10 + (index % 8)).padStart(2, '0')}T09:00:00`)
  const endDate = new Date(baseDate)
  endDate.setMinutes(endDate.getMinutes() + (session.estimatedDurationMinutes || DEFAULT_MARKER_BED_SPREADING_DURATION_MINUTES))
  const owner = SEED_SESSION_OWNERS[index % SEED_SESSION_OWNERS.length]
  const isUnstartedDraft = session.status === 'DRAFT' && !session.plannedStartAt && !session.cuttingTableId
  return {
    ...session,
    plannedStartAt: isUnstartedDraft ? '' : session.plannedStartAt || formatSeedDateTimeLocal(baseDate),
    plannedEndAt: isUnstartedDraft ? '' : session.plannedEndAt || formatSeedDateTimeLocal(endDate),
    estimatedDurationMinutes: session.estimatedDurationMinutes || DEFAULT_MARKER_BED_SPREADING_DURATION_MINUTES,
    tableScheduleStatus: isUnstartedDraft ? session.tableScheduleStatus || '未排程' : session.tableScheduleStatus || '已排程',
    ownerAccountId: isUnstartedDraft ? session.ownerAccountId || '' : session.ownerAccountId || owner.ownerAccountId,
    ownerName: isUnstartedDraft ? session.ownerName || '' : session.ownerName || owner.ownerName,
    actualStartAt: session.actualStartAt || (session.status !== 'DRAFT' ? operatorStartTimes[0] || session.updatedFromPdaAt || '' : ''),
    actualEndAt:
      session.actualEndAt ||
      (session.status === 'DONE' ? session.completionLinkage?.completedAt || operatorEndTimes[0] || session.updatedAt || '' : ''),
    cuttingStartedAt:
      session.cuttingStartedAt ||
      (shouldHaveCuttingStartedAt ? session.cuttingStatusUpdatedAt || session.updatedAt || '' : ''),
    cuttingFinishedAt:
      session.cuttingFinishedAt ||
      (shouldHaveCuttingFinishedAt ? session.cuttingStatusUpdatedAt || session.updatedAt || '' : ''),
  }
}

function createSeedSession(
  marker: MarkerRecord,
  context: MarkerSpreadingContext,
  contextIndex: number,
  profile: SeedSessionProfile,
  profileIndex: number,
): SpreadingSession {
  const seedDate = new Date(`2026-03-${String(10 + contextIndex).padStart(2, '0')}T${String(9 + profileIndex * 2).padStart(2, '0')}:00:00`)
  const seedEndDate = new Date(seedDate)
  seedEndDate.setMinutes(seedEndDate.getMinutes() + DEFAULT_MARKER_BED_SPREADING_DURATION_MINUTES)
  const owner = SEED_SESSION_OWNERS[(contextIndex + profileIndex) % SEED_SESSION_OWNERS.length]
  const sessionKeyBase =
    context.contextType === 'marker-plan' ? context.markerPlanId || context.markerPlanNo : context.cutOrderIds[0] || context.cutOrderNos[0]
  const sessionId = `spreading-session-${context.contextType}-${sanitizeSeedKey(sessionKeyBase)}-${profile.code}`
  const session = createSpreadingDraftFromMarker(marker, context, seedDate, {
    baseSession: {
      spreadingSessionId: sessionId,
      sessionNo: `PB-${String(2400 + contextIndex * 10 + profileIndex).padStart(4, '0')}`,
      status: profile.status,
      plannedStartAt: formatSeedDateTimeLocal(seedDate),
      plannedEndAt: formatSeedDateTimeLocal(seedEndDate),
      estimatedDurationMinutes: DEFAULT_MARKER_BED_SPREADING_DURATION_MINUTES,
      tableScheduleStatus: profile.status === 'DONE' ? '已完成' : profile.status === 'IN_PROGRESS' ? '执行中' : '已排程',
      ownerAccountId: owner.ownerAccountId,
      ownerName: owner.ownerName,
      sourceChannel: profile.sourceChannel || 'MANUAL',
      sourceWritebackId: profile.sourceWritebackId || '',
      updatedFromPdaAt: profile.sourceChannel === 'PDA_WRITEBACK' ? nowText(seedDate) : '',
    },
  })
  const primaryMaterial = context.materialPrepRows[0]?.materialLineItems[0]
  const colors = uniqueStrings(context.materialPrepRows.map((row) => row.color))

  if (profile.plannedLayerCount && profile.plannedLayerCount > 0) {
    session.plannedLayers = profile.plannedLayerCount
    session.planUnits = (session.planUnits || []).map((unit) => {
      const plannedRepeatCount = profile.plannedLayerCount || unit.plannedRepeatCount
      const lengthPerUnitM = Number(unit.lengthPerUnitM || marker.markerLength || marker.netLength || 0)
      const plannedSpreadLengthM = Number(((lengthPerUnitM + 0.06) * plannedRepeatCount).toFixed(2))
      return {
        ...unit,
        plannedRepeatCount,
        plannedCutGarmentQty: Math.max(Number(unit.garmentQtyPerUnit || 0), 0) * plannedRepeatCount,
        plannedSpreadLengthM,
      }
    })
    session.theoreticalActualCutPieceQty = session.planUnits.reduce(
      (sum, unit) => sum + Math.max(Number(unit.plannedCutGarmentQty || 0), 0),
      0,
    )
    session.theoreticalSpreadTotalLength = session.planUnits.reduce(
      (sum, unit) => sum + Math.max(Number(unit.plannedSpreadLengthM || 0), 0),
      0,
    )
  }

  const primaryPlanUnit = session.planUnits?.[0] || null
  const secondaryPlanUnit = session.planUnits?.[1] || primaryPlanUnit

  const rollA = createRollRecordDraft(session.spreadingSessionId, primaryMaterial?.materialSku || '')
  rollA.planUnitId = primaryPlanUnit?.planUnitId || ''
  rollA.sortOrder = 1
  rollA.rollNo = `ROLL-${String(contextIndex + 1).padStart(2, '0')}${String(profileIndex + 1).padStart(2, '0')}A`
  rollA.color = primaryPlanUnit?.color || colors[0] || ''
  rollA.materialSku = primaryPlanUnit?.materialSku || primaryMaterial?.materialSku || ''
  rollA.width = 160
  rollA.labeledLength = 28 + contextIndex * 2 + profileIndex
  rollA.actualLength = 27 + contextIndex * 2 + profileIndex
  rollA.headLength = 0.6
  rollA.tailLength = 0.4
  rollA.layerCount = profile.actualLayerCounts?.[0] ?? 10 + contextIndex + profileIndex
  rollA.totalLength = computeUsableLength(rollA.actualLength, rollA.headLength, rollA.tailLength, rollA.layerCount)
  rollA.remainingLength = Number(Math.max(rollA.labeledLength - rollA.actualLength, 0).toFixed(2))
  rollA.actualCutPieceQty = computeRollActualCutGarmentQty(rollA.layerCount, primaryPlanUnit?.garmentQtyPerUnit || marker.totalPieces || 0)
  rollA.occurredAt = nowText(new Date(`2026-03-${String(10 + contextIndex).padStart(2, '0')}T10:${String(profileIndex).padStart(2, '0')}:00`))
  rollA.operatorLayerRows = [
    {
      rowId: `${rollA.rollRecordId}-operator-1`,
      startLayer: 1,
      endLayer: rollA.layerCount,
      operatorName: '张师傅',
    },
  ]
  rollA.operatorLayerText = formatRollOperatorLayerRows(rollA.operatorLayerRows)
  rollA.operatorNames = ['张师傅']
  rollA.usableLength = computeUsableLength(rollA.actualLength, rollA.headLength, rollA.tailLength, rollA.layerCount)
  rollA.sourceChannel = profile.sourceChannel || 'MANUAL'
  rollA.sourceWritebackId = profile.sourceWritebackId || ''
  rollA.updatedFromPdaAt = profile.sourceChannel === 'PDA_WRITEBACK' ? rollA.occurredAt || nowText(seedDate) : ''

  const rollB = createRollRecordDraft(session.spreadingSessionId, primaryMaterial?.materialSku || '')
  rollB.planUnitId = secondaryPlanUnit?.planUnitId || ''
  rollB.sortOrder = 2
  rollB.rollNo = `ROLL-${String(contextIndex + 1).padStart(2, '0')}${String(profileIndex + 1).padStart(2, '0')}B`
  rollB.color = secondaryPlanUnit?.color || colors[1] || colors[0] || ''
  rollB.materialSku = secondaryPlanUnit?.materialSku || primaryMaterial?.materialSku || ''
  rollB.width = 160
  rollB.labeledLength = 16 + contextIndex + profileIndex
  rollB.actualLength = 15 + contextIndex + profileIndex
  rollB.headLength = 0.5
  rollB.tailLength = 0.3
  rollB.layerCount = profile.actualLayerCounts?.[1] ?? 6 + contextIndex + profileIndex
  rollB.totalLength = computeUsableLength(rollB.actualLength, rollB.headLength, rollB.tailLength, rollB.layerCount)
  rollB.remainingLength = Number(Math.max(rollB.labeledLength - rollB.actualLength, 0).toFixed(2))
  rollB.actualCutPieceQty = computeRollActualCutGarmentQty(rollB.layerCount, secondaryPlanUnit?.garmentQtyPerUnit || marker.totalPieces || 0)
  rollB.occurredAt = nowText(new Date(`2026-03-${String(10 + contextIndex).padStart(2, '0')}T13:${String(profileIndex).padStart(2, '0')}:00`))
  const rollBFirstEndLayer = Math.max(Math.floor(rollB.layerCount / 2), 1)
  rollB.operatorLayerRows = [
    {
      rowId: `${rollB.rollRecordId}-operator-1`,
      startLayer: 1,
      endLayer: rollBFirstEndLayer,
      operatorName: '李师傅',
    },
    {
      rowId: `${rollB.rollRecordId}-operator-2`,
      startLayer: rollBFirstEndLayer + 1,
      endLayer: rollB.layerCount,
      operatorName: '王师傅',
    },
  ]
  rollB.operatorLayerText = formatRollOperatorLayerRows(rollB.operatorLayerRows)
  rollB.operatorNames = ['李师傅', '王师傅']
  rollB.usableLength = computeUsableLength(rollB.actualLength, rollB.headLength, rollB.tailLength, rollB.layerCount)
  rollB.handoverNotes = '同卷未铺完，午后换班继续完成。'
  rollB.sourceChannel = profile.sourceChannel || 'MANUAL'
  rollB.sourceWritebackId = profile.sourceWritebackId || ''
  rollB.updatedFromPdaAt = profile.sourceChannel === 'PDA_WRITEBACK' ? rollB.occurredAt || nowText(seedDate) : ''

  const operatorA = createOperatorRecordDraft(session.spreadingSessionId)
  operatorA.sortOrder = 1
  operatorA.rollRecordId = rollA.rollRecordId
  operatorA.operatorName = '张师傅'
  operatorA.operatorAccountId = 'CUT001'
  operatorA.startAt = `2026-03-${String(10 + contextIndex).padStart(2, '0')} 09:00`
  operatorA.endAt = `2026-03-${String(10 + contextIndex).padStart(2, '0')} 12:00`
  operatorA.actionType = '完成铺布'
  operatorA.startLayer = 1
  operatorA.endLayer = rollA.layerCount
  operatorA.handledLength = rollA.actualLength

  const operatorB = createOperatorRecordDraft(session.spreadingSessionId)
  operatorB.sortOrder = 2
  operatorB.rollRecordId = rollB.rollRecordId
  operatorB.operatorName = '李师傅'
  operatorB.operatorAccountId = 'CUT002'
  operatorB.startAt = `2026-03-${String(10 + contextIndex).padStart(2, '0')} 13:00`
  operatorB.endAt = `2026-03-${String(10 + contextIndex).padStart(2, '0')} 15:00`
  operatorB.actionType = '中途交接'
  operatorB.handoverFlag = true
  operatorB.startLayer = 1
  operatorB.endLayer = Math.max(Math.floor(rollB.layerCount / 2), 1)
  operatorB.handledLength = Number((rollB.actualLength * 0.45).toFixed(2))
  operatorB.note = '先完成本卷前半段铺布。'
  operatorB.handoverNotes = '午后换班，将该卷交接给王师傅继续铺。'

  const operatorC = createOperatorRecordDraft(session.spreadingSessionId)
  operatorC.sortOrder = 3
  operatorC.rollRecordId = rollB.rollRecordId
  operatorC.operatorName = '王师傅'
  operatorC.operatorAccountId = 'CUT003'
  operatorC.startAt = `2026-03-${String(10 + contextIndex).padStart(2, '0')} 15:00`
  operatorC.endAt = `2026-03-${String(10 + contextIndex).padStart(2, '0')} 17:30`
  operatorC.actionType = '完成铺布'
  operatorC.handoverFlag = true
  operatorC.startLayer = operatorB.endLayer + 1
  operatorC.endLayer = rollB.layerCount
  operatorC.handledLength = Number((rollB.actualLength - (operatorB.handledLength || 0)).toFixed(2))
  operatorC.previousOperatorName = operatorB.operatorName
  operatorC.handoverAtLayer = operatorB.endLayer
  operatorC.handoverAtLength = operatorB.handledLength
  operatorC.note = '接手完成本卷剩余铺布。'
  operatorC.handoverNotes = '承接李师傅交接，继续铺至本卷结束。'

  const hasExecution = profile.status !== 'DRAFT'
  const multiRoll = profile.status === 'DONE'
  session.rolls = hasExecution ? (multiRoll ? [rollA, rollB] : [rollA]) : []
  session.operators = hasExecution ? (multiRoll ? [operatorA, operatorB, operatorC] : [operatorA]) : []
  session.status = profile.status
  if (profile.status !== 'DRAFT') {
    session.actualStartAt = formatSeedDateTimeLocal(seedDate)
  }
  if (profile.status === 'DONE') {
    session.cuttingStatus = profile.cuttingStatus || 'WAITING_CUTTING'
    session.actualEndAt = formatSeedDateTimeLocal(new Date(`2026-03-${String(10 + contextIndex).padStart(2, '0')}T17:30:00`))
    if (session.cuttingStatus === 'CUTTING' || session.cuttingStatus === 'CUTTING_DONE') {
      session.cuttingStartedAt = formatSeedDateTimeLocal(new Date(`2026-03-${String(10 + contextIndex).padStart(2, '0')}T18:00:00`))
    }
    if (session.cuttingStatus === 'CUTTING_DONE') {
      session.cuttingFinishedAt = formatSeedDateTimeLocal(new Date(`2026-03-${String(10 + contextIndex).padStart(2, '0')}T20:00:00`))
    }
  }
  session.actualCutPieceQty = session.rolls.reduce((sum, roll) => sum + Math.max(roll.actualCutPieceQty || 0, 0), 0)
  session.actualLayers = session.rolls.reduce((sum, roll) => sum + Math.max(roll.layerCount || 0, 0), 0)
  session.unitPrice = 0.46 + contextIndex * 0.04 + profileIndex * 0.01
  session.note =
    profile.scenarioNote ||
    (profile.status === 'DRAFT'
      ? '当前待铺布，已完成铺布创建但尚未录入卷记录。'
      : profile.status === 'IN_PROGRESS'
        ? '当前仍可继续补录剩余卷与人员交接。'
        : '当前铺布记录已完成。')
  session.updatedAt = nowText(new Date(`2026-03-${String(10 + contextIndex).padStart(2, '0')}T18:${String(profileIndex).padStart(2, '0')}:00`))
  if (profile.status === 'DONE') {
    session.cuttingStatusUpdatedAt = session.updatedAt
    const warning = buildSpreadingVarianceWarning({
      context,
      session,
      markerTotalPieces: marker.totalPieces,
      cutOrderNos: context.cutOrderNos,
      productionOrderNos: context.productionOrderNos,
      materialAttr: context.materialPrepRows[0]?.materialLabel || '',
      createdAt: session.updatedAt,
      note: '当前为 prototype 完成样例。',
    })
    session.varianceWarning = {
      ...warning,
      suggestedAction: '无需处理',
      handled: true,
      shortageQty: 0,
      note: 'prototype：无需处理',
    }
  }
  session.operationLogs = buildSpreadingSessionOperationLogs(session)
  if (profile.status === 'DONE') {
    session.completionLinkage = {
      completedAt: session.updatedAt,
      completedBy: profile.sourceChannel === 'PDA_WRITEBACK' ? '工厂端回写' : '现场主管',
      linkedCutOrderIds: [...context.cutOrderIds],
      linkedCutOrderNos: [...context.cutOrderNos],
      generatedWarningId: session.varianceWarning?.warningId || `warning-${session.spreadingSessionId}`,
      generatedWarning: false,
      note: '当前铺布已完成。',
    }
  }
  return session
}

function hasMarkerForContext(store: MarkerSpreadingStore, context: MarkerSpreadingContext): boolean {
  if (context.contextType === 'marker-plan') {
    return store.markers.some((item) => item.contextType === 'marker-plan' && item.markerPlanId === context.markerPlanId)
  }
  return store.markers.some(
    (item) => item.contextType === 'cut-order' && item.cutOrderIds[0] === context.cutOrderIds[0],
  )
}

function hasSessionById(store: MarkerSpreadingStore, spreadingSessionId: string): boolean {
  return store.sessions.some((item) => item.spreadingSessionId === spreadingSessionId)
}

export function summarizeMarkerLineItems(lineItems: MarkerLineItem[] = []): MarkerLineItemSummary {
  const totalLength = Number(lineItems.reduce((sum, item) => sum + Math.max(item.markerLength, 0), 0).toFixed(2))
  const totalPieces = lineItems.reduce((sum, item) => sum + Math.max(item.markerPieceCount ?? item.pieceCount ?? 0, 0), 0)
  const colorSummary = uniqueStrings(lineItems.map((item) => item.color)).join(' / ')
  return {
    lineCount: lineItems.length,
    colorSummary,
    totalLength,
    totalPieces,
    summaryText: lineItems.length
      ? `${lineItems.length} 行 · ${colorSummary || '颜色待补'} · ${totalPieces} 件`
      : '当前尚未补录唛架明细。',
  }
}

export function buildMarkerSpreadingPrototypeStore(options: {
  rows: MaterialPrepRow[]
  markerPlanSources: MarkerPlanSourceRecord[]
  stored?: MarkerSpreadingStore
}): MarkerSpreadingStore {
  let nextStore = options.stored ? deserializeMarkerSpreadingStorage(JSON['stringify'](options.stored)) : createEmptyStore()
  const executableRows = options.rows.filter(isMaterialPrepRowReadyForSpreadingSeed)
  const executableRowIds = new Set(executableRows.map((row) => row.cutOrderId))
  const rowsById = Object.fromEntries(executableRows.map((row) => [row.cutOrderId, row]))
  const isLinkedToExecutableRows = (cutOrderIds: string[] = []) =>
    cutOrderIds.length > 0 && cutOrderIds.every((id) => executableRowIds.has(id))
  const isLinkedToMarkerPlan = (session: SpreadingSession) =>
    Boolean(
      session.sourceSchemeId &&
      session.sourceSchemeNo &&
      session.sourceBedId &&
      session.sourceBedNo &&
      session.sourceMarkerId &&
      session.sourceMarkerNo &&
      session.planUnits?.length,
    )
  const isGeneratedFromConfirmedMarkerPlan = (session: SpreadingSession) =>
    isLinkedToMarkerPlan(session) && /^MKP-\d{8}-\d{3}$/.test(session.sourceSchemeNo || '')
  nextStore = {
    ...nextStore,
    markers: nextStore.markers.filter((marker) => isLinkedToExecutableRows(marker.cutOrderIds || [])),
    sessions: nextStore.sessions.filter((session) =>
      (isLinkedToExecutableRows(session.cutOrderIds || []) || isGeneratedFromConfirmedMarkerPlan(session)) &&
      isLinkedToMarkerPlan(session),
    ).map((session, index) => ensureSpreadingScheduleDefaults(session, index)),
  }

  const cutOrderContexts = executableRows
    .map((row) => buildCutOrderContext(row))
    .filter((context, index, all) => all.findIndex((item) => item.cutOrderIds[0] === context.cutOrderIds[0]) === index)
    .slice(0, 3)
  const markerPlanSourceContexts = options.markerPlanSources
    .map((batch) => buildMarkerPlanSourceContext(batch, rowsById))
    .filter((context): context is MarkerSpreadingContext => Boolean(context))
    .filter((context) => context.cutOrderIds.every((id) => executableRowIds.has(id)))
    .filter((context, index, all) => all.findIndex((item) => item.markerPlanId === context.markerPlanId) === index)
    .slice(0, 3)

  const seedContexts: MarkerSpreadingContext[] = [...cutOrderContexts, ...markerPlanSourceContexts].slice(0, 5)

  const preferredSeedModes = new Map<string, MarkerModeKey>()
  if (cutOrderContexts[0]) preferredSeedModes.set(`cut-order:${cutOrderContexts[0].cutOrderIds[0]}`, 'normal')
  if (cutOrderContexts[1]) preferredSeedModes.set(`cut-order:${cutOrderContexts[1].cutOrderIds[0]}`, 'fold_normal')
  if (cutOrderContexts[2]) preferredSeedModes.set(`cut-order:${cutOrderContexts[2].cutOrderIds[0]}`, 'high_low')
  if (markerPlanSourceContexts[0]) preferredSeedModes.set(`marker-plan:${markerPlanSourceContexts[0].markerPlanId}`, 'fold_high_low')
  if (markerPlanSourceContexts[1]) preferredSeedModes.set(`marker-plan:${markerPlanSourceContexts[1].markerPlanId}`, 'normal')
  if (markerPlanSourceContexts[2]) preferredSeedModes.set(`marker-plan:${markerPlanSourceContexts[2].markerPlanId}`, 'high_low')

  seedContexts.forEach((context, index) => {
    const contextKey =
      context.contextType === 'marker-plan'
        ? `marker-plan:${context.markerPlanId}`
        : `cut-order:${context.cutOrderIds[0]}`
    if (!hasMarkerForContext(nextStore, context)) {
      const markerDraft = buildMarkerSeedDraft(context, null)
      if (!markerDraft) return
      markerDraft.markerMode = preferredSeedModes.get(contextKey) || markerDraft.markerMode
      markerDraft.markerNo = markerDraft.markerNo || `MKP-${String(index + 1).padStart(4, '0')}`
      markerDraft.updatedAt = nowText(new Date(`2026-03-${String(10 + index).padStart(2, '0')}T08:30:00`))
      nextStore = {
        ...nextStore,
        markers: [...nextStore.markers, markerDraft],
      }
    }

    const marker =
      nextStore.markers.find((item) =>
        context.contextType === 'marker-plan'
          ? item.contextType === 'marker-plan' && item.markerPlanId === context.markerPlanId
          : item.contextType === 'cut-order' && item.cutOrderIds[0] === context.cutOrderIds[0],
      ) || null

    if (!marker) return

    const profiles = SEED_SESSION_MATRIX[index] || SEED_SESSION_MATRIX[SEED_SESSION_MATRIX.length - 1]
    profiles.forEach((profile, profileIndex) => {
      const sessionKeyBase =
        context.contextType === 'marker-plan' ? context.markerPlanId || context.markerPlanNo : context.cutOrderIds[0] || context.cutOrderNos[0]
      const sessionId = `spreading-session-${context.contextType}-${sanitizeSeedKey(sessionKeyBase)}-${profile.code}`
      if (hasSessionById(nextStore, sessionId)) return
      nextStore = {
        ...nextStore,
        sessions: [...nextStore.sessions, createSeedSession(marker, context, index, profile, profileIndex)],
      }
    })
  })

  return {
    markers: [...nextStore.markers].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt, 'zh-CN')),
    sessions: [...nextStore.sessions].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt, 'zh-CN')),
  }
}

export function readMarkerSpreadingPrototypeData(): MarkerSpreadingPrototypeData {
  const projection = buildMarkerSpreadingProjection()
  const store = buildMarkerSpreadingPrototypeStore({
    rows: projection.rows,
    markerPlanSources: projection.markerPlanSources,
    stored: projection.store,
  })

  return {
    rows: projection.rows,
    rowsById: projection.rowsById,
    markerPlanSources: projection.markerPlanSources,
    store,
  }
}

export function buildMarkerListViewModel(options: {
  markerRecords: MarkerRecord[]
  rowsById: Record<string, MaterialPrepRow>
  markerPlanSources: MarkerPlanSourceRecord[]
}): MarkerListRow[] {
  const batchById = Object.fromEntries(options.markerPlanSources.map((batch) => [batch.markerPlanId, batch]))

  return options.markerRecords
    .map((record) => {
      const cutOrderRows = record.cutOrderIds.map((id) => options.rowsById[id]).filter((row): row is MaterialPrepRow => Boolean(row))
      const cutOrderNos = cutOrderRows.map((row) => row.cutOrderNo)
      const lineSummary = summarizeMarkerLineItems(record.lineItems)
      const batch = record.markerPlanId ? batchById[record.markerPlanId] : null
      const modeMeta = deriveMarkerModeMeta(record.markerMode)
      const templateType = deriveMarkerTemplateByMode(record.markerMode)
      const highLowCuttingTotal = computeHighLowCuttingTotals(record.highLowCuttingRows || []).cuttingTotal

      return {
        markerId: record.markerId,
        markerNo: record.markerNo || record.markerId,
        contextType: record.contextType,
        contextLabel: record.contextType === 'marker-plan' ? '唛架方案上下文' : '裁片单上下文',
        cutOrderCount: record.cutOrderIds.length,
        cutOrderNos,
        markerPlanNo: record.markerPlanNo || batch?.markerPlanNo || '',
        styleCode: record.styleCode || cutOrderRows[0]?.styleCode || '',
        spuCode: record.spuCode || cutOrderRows[0]?.spuCode || '',
        materialSkuSummary:
          record.materialSkuSummary ||
          uniqueStrings(cutOrderRows.map((row) => row.materialSkuSummary)).join(' / '),
        materialAliasSummary: record.materialAliasSummary || uniqueStrings(cutOrderRows.flatMap((row) => row.materialLineItems.map((line) => line.materialAlias))).join(' / '),
        materialImageUrl: record.materialImageUrl || cutOrderRows.flatMap((row) => row.materialLineItems).find((line) => line.materialImageUrl)?.materialImageUrl || '',
        colorSummary: record.colorSummary || lineSummary.colorSummary || uniqueStrings(cutOrderRows.map((row) => row.color)).join(' / '),
        markerMode: record.markerMode,
        markerModeLabel: modeMeta.label,
        totalPieces: record.totalPieces || computeMarkerTotalPieces(record.sizeDistribution),
        netLength: record.netLength,
        singlePieceUsage: record.singlePieceUsage,
        spreadTotalLength:
          record.spreadTotalLength ||
          (templateType === 'row-template'
            ? computeNormalMarkerSpreadTotalLength(record.lineItems || [])
            : Number(record.actualMaterialMeter || 0)),
        markerImageStatus: record.markerImageName ? '已上传' : '未上传',
        hasImage: Boolean(record.markerImageName),
        hasAdjustment: Boolean(record.adjustmentRequired || record.adjustmentNote),
        updatedAt: record.updatedAt,
        lineItemCount: lineSummary.lineCount,
        lineSummary:
          templateType === 'row-template'
            ? lineSummary.summaryText
            : `高低层矩阵 · ${(record.highLowCuttingRows || []).length} 色 · ${highLowCuttingTotal} 件`,
        record,
        keywordIndex: uniqueStrings([
          record.markerNo,
          record.markerPlanNo,
          ...cutOrderNos,
          record.styleCode,
          record.spuCode,
          record.materialSkuSummary,
          record.colorSummary,
          modeMeta.label,
          record.adjustmentNote,
          ...(record.lineItems || []).flatMap((item) => [item.layoutCode, item.layoutDetailText]),
        ]),
      }
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt, 'zh-CN'))
}

export function buildSpreadingListViewModel(options: {
  spreadingSessions: SpreadingSession[]
  rowsById: Record<string, MaterialPrepRow>
  markerPlanSources: MarkerPlanSourceRecord[]
  markerRecords?: MarkerRecord[]
}): SpreadingListRow[] {
  const batchById = Object.fromEntries(options.markerPlanSources.map((batch) => [batch.markerPlanId, batch]))
  const markerById = Object.fromEntries((options.markerRecords || []).map((marker) => [marker.markerId, marker]))

  return options.spreadingSessions
    .map((session) => {
      const cutOrderIds = Array.isArray(session.cutOrderIds) ? session.cutOrderIds : []
      const rolls = Array.isArray(session.rolls) ? session.rolls : []
      const operators = Array.isArray(session.operators) ? session.operators : []
      const cutOrderRows = cutOrderIds.map((id) => options.rowsById[id]).filter((row): row is MaterialPrepRow => Boolean(row))
      const rollSummary = summarizeSpreadingRolls(rolls)
      const operatorSummary = summarizeSpreadingOperators(operators)
      const cutOrderNos = cutOrderRows.map((row) => row.cutOrderNo)
      const modeMeta = deriveSpreadingModeMeta(session.spreadingMode)
      const batch = session.markerPlanId ? batchById[session.markerPlanId] : null
      const markerRecord = session.markerId ? markerById[session.markerId] || null : null
      const context = buildSessionContext(session, cutOrderRows, batch)
      const colorSummary = deriveSpreadingColorSummary({
        rolls,
        importSourceColorSummary: session.importSource?.sourceColorSummary,
        contextColors: cutOrderRows.map((row) => row.color),
        fallbackSummary: session.colorSummary,
      }).value
      const varianceSummary = buildSpreadingVarianceSummary(context, markerRecord, session)
      const handoverSummary = buildSpreadingHandoverListSummary(rolls, operators, markerRecord?.totalPieces || 0)
      const operatorAmountSummary = summarizeSpreadingOperatorAmounts(
        operators,
        markerRecord?.totalPieces || 0,
        session.unitPrice,
      )
      const warningMessages = buildSpreadingWarningMessages({
        session,
        markerTotalPieces: markerRecord?.totalPieces || 0,
        claimedLengthTotal: varianceSummary?.claimedLengthTotal || 0,
      })
      const varianceWarning =
        buildSpreadingVarianceWarning({
          context,
          session,
          markerTotalPieces: markerRecord?.totalPieces || 0,
          cutOrderNos,
          productionOrderNos: context?.productionOrderNos || uniqueStrings(cutOrderRows.map((row) => row.productionOrderNo)),
          materialAttr: cutOrderRows[0]?.materialLabel || cutOrderRows[0]?.materialCategory || '',
          warningMessages,
        })
      const navigationPayload = buildMarkerSpreadingNavigationPayload(context, varianceSummary, varianceWarning)
      const completedCutOrderCount = getCompletedLinkedCutOrderIds(session).length

      return {
        spreadingSessionId: session.spreadingSessionId,
        sessionNo: session.sessionNo || session.spreadingSessionId,
        contextType: session.contextType,
        contextLabel: session.contextType === 'marker-plan' ? '唛架方案上下文' : '裁片单上下文',
        cutOrderCount: cutOrderIds.length,
        cutOrderNos,
        markerPlanNo: session.markerPlanNo || batch?.markerPlanNo || '',
        styleCode: session.styleCode || cutOrderRows[0]?.styleCode || '',
        spuCode: session.spuCode || cutOrderRows[0]?.spuCode || '',
        materialSkuSummary:
          session.materialSkuSummary || uniqueStrings(cutOrderRows.map((row) => row.materialSkuSummary)).join(' / '),
        materialAliasSummary: session.materialAliasSummary || context?.materialAliasSummary || '',
        materialImageUrl: session.materialImageUrl || context?.materialImageUrl || '',
        colorSummary: colorSummary === '待补' ? '' : colorSummary,
        spreadingMode: session.spreadingMode,
        spreadingModeLabel: modeMeta.label,
        rollCount: session.rollCount || rolls.length,
        operatorCount: session.operatorCount || operators.length,
        totalActualLength: session.totalActualLength || rollSummary.totalActualLength,
        totalCalculatedUsableLength: session.totalCalculatedUsableLength || rollSummary.totalCalculatedUsableLength,
        totalRemainingLength: session.totalRemainingLength ?? rollSummary.totalRemainingLength,
        actualCutPieceQty: session.actualCutPieceQty || rollSummary.totalActualCutPieceQty,
        plannedCutGarmentQty: varianceSummary?.plannedCutGarmentQty || varianceWarning.plannedCutGarmentQty,
        theoreticalCutGarmentQty: varianceSummary?.theoreticalCutGarmentQty || varianceWarning.theoreticalCutGarmentQty,
        actualCutGarmentQty: varianceSummary?.actualCutGarmentQty || varianceWarning.actualCutGarmentQty,
        fabricRollCount: varianceSummary?.fabricRollCount || rolls.length,
        spreadLayerCount: varianceSummary?.spreadLayerCount || rollSummary.totalLayers,
        spreadActualLengthM: varianceSummary?.spreadActualLengthM || session.totalActualLength || rollSummary.totalActualLength,
        spreadUsableLengthM: varianceSummary?.spreadUsableLengthM || session.totalCalculatedUsableLength || rollSummary.totalCalculatedUsableLength,
        spreadRemainingLengthM: varianceSummary?.spreadRemainingLengthM || session.totalRemainingLength || rollSummary.totalRemainingLength,
        configuredLengthTotal: varianceSummary?.configuredLengthTotal || session.configuredLengthTotal || 0,
        claimedLengthTotal: varianceSummary?.claimedLengthTotal || session.claimedLengthTotal || 0,
        varianceLength: varianceSummary?.varianceLength || session.varianceLength || 0,
        varianceNote: varianceSummary?.varianceHint || session.varianceNote || '当前未识别明显差异。',
        hasVariance: Math.abs(varianceSummary?.varianceLength || session.varianceLength || 0) > 0.01,
        differenceStatusLabel:
          Math.abs(varianceSummary?.varianceLength || session.varianceLength || 0) > 0.01
            ? `存在差异 ${(varianceSummary?.varianceLength || session.varianceLength || 0).toFixed(2)} 米`
            : '无明显差异',
        differenceStatusTone:
          Math.abs(varianceSummary?.varianceLength || session.varianceLength || 0) > 0.01 ? 'warning' : 'normal',
        completedCutOrderCount,
        hasHandover: handoverSummary.hasHandover,
        hasHandoverWarnings: handoverSummary.hasAbnormalHandover,
        handoverStatusLabel: handoverSummary.statusLabel,
        hasOperatorAllocation: operatorAmountSummary.hasAnyAllocationData,
        operatorAllocationAmountTotal: operatorAmountSummary.totalDisplayAmount,
        hasManualAdjustedAmount: operatorAmountSummary.hasManualAdjustedAmount,
        operatorAllocationStatusLabel: operatorAmountSummary.hasAnyAllocationData
          ? operatorAmountSummary.hasManualAdjustedAmount
            ? '已生成人员分摊，含人工调价'
            : '已生成人员分摊'
          : '待补录人员分摊',
        hasWarnings: warningMessages.length > 0,
        warningStatusLabel:
          warningMessages.length > 0
            ? `有 ${warningMessages.length} 条提醒`
            : operatorSummary.handoverRollCount > 0
              ? `已记录 ${operatorSummary.handoverRollCount} 卷交接`
              : '无提醒',
        hasVarianceWarning:
          varianceWarning.suggestedAction === '差异处理' || varianceWarning.suggestedAction === '存在异常差异，需人工确认',
        varianceWarningLevel: varianceWarning.warningLevel,
        varianceSuggestedAction: varianceWarning.suggestedAction,
        pendingVarianceConfirmation:
          !varianceWarning.handled && varianceWarning.suggestedAction !== '无需处理',
        warningMessages,
        varianceWarning,
        variancePayload: navigationPayload.variance,
        productionOrderNos: context?.productionOrderNos || uniqueStrings(cutOrderRows.map((row) => row.productionOrderNo)),
        statusLabel: session.status === 'DRAFT' ? '待铺布' : session.status === 'IN_PROGRESS' ? '铺布中' : session.status === 'DONE' ? '已铺布' : '待补录',
        statusKey: session.status,
        updatedAt: session.updatedAt,
        session,
        keywordIndex: uniqueStrings([
          session.sessionNo,
          session.markerNo,
          session.markerPlanNo,
          ...cutOrderNos,
          ...(context?.productionOrderNos || []),
          session.styleCode,
          session.spuCode,
          session.materialSkuSummary,
          ...rolls.map((roll) => roll.rollNo),
          ...rolls.map((roll) => roll.materialSku),
          ...operators.map((operator) => operator.operatorName),
        ]),
      }
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt, 'zh-CN'))
}

export function buildSpreadingDetailViewModel(options: {
  row: SpreadingListRow
  rowsById: Record<string, MaterialPrepRow>
  markerPlanSources: MarkerPlanSourceRecord[]
  markerRecords: MarkerRecord[]
}): SpreadingDetailViewModel {
  const batchById = Object.fromEntries(options.markerPlanSources.map((batch) => [batch.markerPlanId, batch]))
  const markerById = Object.fromEntries(options.markerRecords.map((marker) => [marker.markerId, marker]))
  const session = options.row.session
  const batch = session.markerPlanId ? batchById[session.markerPlanId] || null : null
  const cutOrderRows = session.cutOrderIds.map((id) => options.rowsById[id]).filter((row): row is MaterialPrepRow => Boolean(row))
  const markerRecord = session.markerId ? markerById[session.markerId] || null : null
  const context = buildSessionContext(session, cutOrderRows, batch)
  const varianceSummary = buildSpreadingVarianceSummary(context, markerRecord, session)
  const warningMessages = buildSpreadingWarningMessages({
    session,
    markerTotalPieces: markerRecord?.totalPieces || 0,
    claimedLengthTotal: varianceSummary?.claimedLengthTotal || 0,
  })
  const operatorSummary = summarizeSpreadingOperators(session.operators)
  const operatorAmountSummary = summarizeSpreadingOperatorAmounts(session.operators, markerRecord?.totalPieces || 0, session.unitPrice)
  const amountWarnings = buildOperatorAmountWarnings(session.operators, markerRecord?.totalPieces || 0, session.unitPrice)
  const handoverSummaryByRollId = Object.fromEntries(
    session.rolls.map((roll) => [
      roll.rollRecordId,
      buildRollHandoverViewModel(roll, operatorSummary.operatorsByRollId[roll.rollRecordId] || [], markerRecord?.totalPieces || 0),
    ]),
  )
  const varianceWarning =
    buildSpreadingVarianceWarning({
      context,
      session,
      markerTotalPieces: markerRecord?.totalPieces || 0,
      cutOrderNos: cutOrderRows.map((item) => item.cutOrderNo),
      productionOrderNos: context?.productionOrderNos || uniqueStrings(cutOrderRows.map((row) => row.productionOrderNo)),
      materialAttr: cutOrderRows[0]?.materialLabel || cutOrderRows[0]?.materialCategory || '',
      warningMessages,
    })
  return {
    row: options.row,
    markerRecord,
    warningMessages,
    varianceSummary,
    varianceWarning,
    navigationPayload: buildMarkerSpreadingNavigationPayload(context, varianceSummary, varianceWarning),
    linkedRollNos: Object.fromEntries(session.rolls.map((roll) => [roll.rollRecordId, roll.rollNo])),
    linkedCutOrderNos: cutOrderRows.map((item) => item.cutOrderNo),
    sortedOperators: operatorSummary.sortedOperators,
    operatorsByRollId: operatorSummary.operatorsByRollId,
    handoverSummaryByRollId,
    rollParticipantSummary: Object.fromEntries(
      Object.entries(operatorSummary.rollParticipantNames).map(([rollId, names]) => [rollId, names.join(' → ') || '待补录']),
    ),
    operatorAmountSummary,
    amountWarnings,
  }
}

export function buildMarkerDetailViewModel(row: MarkerListRow): MarkerDetailViewModel {
  const lineSummary = summarizeMarkerLineItems(row.record.lineItems)
  const templateType = deriveMarkerTemplateByMode(row.record.markerMode)
  const usageSummary = computeUsageSummary(row.record)
  const highLowPatternKeys = row.record.highLowPatternKeys?.length ? row.record.highLowPatternKeys : [...DEFAULT_HIGH_LOW_PATTERN_KEYS]
  const highLowCuttingTotals = computeHighLowCuttingTotals(row.record.highLowCuttingRows || [])
  const highLowPatternTotals = computeHighLowPatternTotals(row.record.highLowPatternRows || [], highLowPatternKeys)
  const prototypeData = readMarkerSpreadingPrototypeData()
  const sourceRows = buildMarkerAllocationSourceRows(row.record, prototypeData.rowsById)
  const pieceExplosion = buildMarkerPieceExplosionViewModel({
    marker: row.record,
    sourceRows,
  })
  const warningMessages = uniqueStrings([...buildMarkerWarningMessages(row.record), ...pieceExplosion.mappingWarnings])
  return {
    row,
    lineSummary,
    sizeRatioPlanText:
      row.record.sizeRatioPlanText ||
      row.record.sizeDistribution
        .filter((item) => item.quantity > 0)
        .map((item) => `${item.sizeLabel}×${item.quantity}`)
        .join(' / '),
    totalLineSpreadLength: computeNormalMarkerSpreadTotalLength(row.record.lineItems || []),
    templateType,
    usageSummary,
    warningMessages,
    highLowPatternKeys,
    highLowCuttingRows: highLowCuttingTotals.rows,
    highLowPatternRows: highLowPatternTotals.rows,
    highLowCuttingTotal: highLowCuttingTotals.cuttingTotal,
    highLowPatternTotal: highLowPatternTotals.patternTotal,
    sourceOrderRows: pieceExplosion.sourceOrderRows,
    allocationRows: pieceExplosion.allocationRows,
    allocationSizeSummary: pieceExplosion.allocationSizeSummary,
    skuSummaryRows: pieceExplosion.skuSummaryRows,
    pieceDetailRows: pieceExplosion.pieceDetailRows,
    mappingWarnings: pieceExplosion.mappingWarnings,
    missingMappings: pieceExplosion.missingMappings,
    totals: pieceExplosion.totals,
  }
}

export function buildMarkerNavigationPayload(row: MarkerListRow): Record<string, string | undefined> {
  return {
    markerId: row.markerId,
    cutOrderId: row.contextType === 'cut-order' ? row.record.cutOrderIds[0] : undefined,
    cutOrderNo: row.contextType === 'cut-order' ? row.cutOrderNos[0] : undefined,
    markerPlanId: row.contextType === 'marker-plan' ? row.record.markerPlanId || undefined : undefined,
    markerPlanNo: row.contextType === 'marker-plan' ? row.markerPlanNo || undefined : undefined,
    styleCode: row.styleCode || undefined,
    materialSku: row.materialSkuSummary?.split(' / ')[0] || undefined,
  }
}

export function getDefaultMarkerSpreadingContext(
  rows: MaterialPrepRow[],
  markerPlanSources: MarkerPlanSourceRecord[],
  prefilter: MarkerSpreadingPrefilter | null,
): MarkerSpreadingContext | null {
  if (prefilter?.markerPlanId || prefilter?.markerPlanNo) {
    const rowsById = Object.fromEntries(rows.map((row) => [row.cutOrderId, row]))
    const batch =
      (prefilter.markerPlanId && markerPlanSources.find((item) => item.markerPlanId === prefilter.markerPlanId)) ||
      (prefilter.markerPlanNo && markerPlanSources.find((item) => item.markerPlanNo === prefilter.markerPlanNo)) ||
      null
    if (batch) return buildMarkerPlanSourceContext(batch, rowsById)
  }

  if (prefilter?.cutOrderId || prefilter?.cutOrderNo) {
    const row =
      rows.find(
        (item) =>
          item.cutOrderId === prefilter.cutOrderId || item.cutOrderNo === prefilter.cutOrderNo,
      ) || null
    if (row) return buildCutOrderContext(row)
  }

  return rows[0] ? buildCutOrderContext(rows[0]) : null
}

export function buildMarkerSpreadingCountsByCutOrder(cutOrderId: string): {
  markerCount: number
  sessionCount: number
  rollCount: number
  operatorCount: number
  statusSummary: string
  spreadingStatusLabel: string
  latestSessionNo: string
  hasVarianceWarning: boolean
  warningLevelLabel: string
  suggestedAction: string
  hasOperatorAllocation: boolean
  operatorAmountTotal: number
  hasManualAdjustedAmount: boolean
} {
  const prototypeData = readMarkerSpreadingPrototypeData()
  const sourceRow = prototypeData.rowsById[cutOrderId]
  if (!sourceRow || !isMaterialPrepRowReadyForSpreadingSeed(sourceRow)) {
    return createEmptyMarkerSpreadingCounts(sourceRow)
  }
  const { store } = prototypeData
  const linkedSessions = store.sessions.filter((item) => item.cutOrderIds.includes(cutOrderId))
  const markersById = Object.fromEntries(store.markers.map((marker) => [marker.markerId, marker]))
  const draftCount = linkedSessions.filter((item) => item.status === 'DRAFT' || item.status === 'TO_FILL').length
  const doneCount = linkedSessions.filter((item) => item.status === 'DONE').length
  const inProgressCount = linkedSessions.filter((item) => item.status === 'IN_PROGRESS').length
  const latestSession = [...linkedSessions].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt, 'zh-CN'))[0] || null
  const latestMarkerTotalPieces = latestSession?.markerId ? markersById[latestSession.markerId]?.totalPieces || 0 : 0
  const latestAmountSummary = latestSession
    ? summarizeSpreadingOperatorAmounts(latestSession.operators, latestMarkerTotalPieces, latestSession.unitPrice)
    : null
  const latestWarning = latestSession?.varianceWarning || null
  const completedForCurrentOrder = linkedSessions.some((item) => getCompletedLinkedCutOrderIds(item).includes(cutOrderId))
  const spreadingStatusLabel = completedForCurrentOrder
    ? '已铺布'
    : inProgressCount > 0
      ? '铺布中'
      : doneCount > 0
        ? '已铺布'
        : '待铺布'

  return {
    markerCount: store.markers.filter((item) => item.cutOrderIds.includes(cutOrderId)).length,
    sessionCount: linkedSessions.length,
    rollCount: linkedSessions.reduce((sum, item) => sum + item.rolls.length, 0),
    operatorCount: linkedSessions.reduce((sum, item) => sum + item.operators.length, 0),
    statusSummary:
      linkedSessions.length > 0
        ? `已铺布 ${doneCount} 张 / 铺布中 ${inProgressCount} 张 / 待铺布 ${draftCount} 张`
        : '暂无铺布记录',
    spreadingStatusLabel,
    latestSessionNo: latestSession?.sessionNo || '暂无',
    hasVarianceWarning: Boolean(latestWarning && latestWarning.suggestedAction !== '无需处理'),
    warningLevelLabel: latestWarning?.warningLevel || '低',
    suggestedAction: latestWarning?.suggestedAction || '无需处理',
    hasOperatorAllocation: Boolean(latestAmountSummary?.hasAnyAllocationData),
    operatorAmountTotal: latestAmountSummary?.totalDisplayAmount || 0,
    hasManualAdjustedAmount: Boolean(latestAmountSummary?.hasManualAdjustedAmount),
  }
}

function isMaterialPrepRowReadyForSpreadingSeed(row: MaterialPrepRow): boolean {
  return row.materialPrepStatus.key === 'CONFIGURED' && row.materialClaimStatus.key === 'RECEIVED'
}

function createEmptyMarkerSpreadingCounts(row?: MaterialPrepRow) {
  const stageLabel = row?.currentStage.label || '配料数量待补'
  const suggestedAction = row?.currentStage.key === 'WAITING_CLAIM' ? '等待裁床领料' : '等待裁床领料'
  return {
    markerCount: 0,
    sessionCount: 0,
    rollCount: 0,
    operatorCount: 0,
    statusSummary: '暂无铺布记录',
    spreadingStatusLabel: stageLabel,
    latestSessionNo: '暂无',
    hasVarianceWarning: false,
    warningLevelLabel: '低',
    suggestedAction,
    hasOperatorAllocation: false,
    operatorAmountTotal: 0,
    hasManualAdjustedAmount: false,
  }
}
