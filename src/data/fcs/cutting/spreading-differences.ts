import type {
  SpreadingOrder,
  SpreadingRollRecord,
  SpreadingSession,
} from '../../../pages/process-factory/cutting/marker-spreading-model.ts'
import {
  listGeneratedCutOrderSourceRecords,
  type GeneratedCutOrderSourceRecord,
} from './generated-cut-orders.ts'
import { buildMaterialLedgerProjectionMap } from './material-ledger.ts'
import {
  listCuttingRuntimeEventsByType,
  listPdaReplenishmentFeedbackEvents,
  type CuttingRuntimeEvent,
} from './cutting-runtime-event-ledger.ts'

export type SpreadingDifferenceSourceType =
  | 'PDA 铺布记录'
  | 'PDA 裁剪记录'
  | 'Web 处理'
  | '领料差异延续'
  | '系统计算'

export type SpreadingDifferenceType =
  | '实铺小于计划'
  | '实际用量差异'
  | '实裁小于计划'
  | '面料余额不足'
  | '卷记录异常'
  | '布头布尾异常'
  | '现场反馈'
  | '其他异常'

export type SpreadingDifferenceLevel = '提示' | '待处理' | '需处理'
export type SpreadingDifferenceHandlingStatus = '待处理' | '处理中' | '已处理' | '仅记录'

export interface SpreadingDifferenceEvidence {
  summary: string
  operatorName: string
  occurredAt: string
  photoProofCount?: number
  rollNos?: string[]
  note?: string
}

export interface SpreadingDifference {
  differenceId: string
  sourceType: SpreadingDifferenceSourceType
  sourceObjectId: string
  spreadingOrderId: string
  spreadingOrderNo: string
  markerPlanId: string
  markerPlanNo: string
  cutOrderIds: string[]
  cutOrderNos: string[]
  productionOrderIds: string[]
  productionOrderNos: string[]
  materialSku: string
  materialAlias: string
  materialImageUrl: string
  patternFileName: string
  differenceType: SpreadingDifferenceType
  differenceLevel: SpreadingDifferenceLevel
  plannedValue: number
  actualValue: number
  differenceValue: number
  unit: string
  evidence: SpreadingDifferenceEvidence
  detectedAt: string
  detectedBy: string
  handlingStatus: SpreadingDifferenceHandlingStatus
  linkedReplenishmentId: string
  linkedLedgerEventIds: string[]
}

export type ReplenishmentReviewResult = '需要补料' | '仅记录差异' | '关闭裁片单'

export type ReplenishmentNextAction = '回到中转仓配料' | '无后续动作' | '关闭裁片单'

export interface SpreadingReplenishmentHandlingObject {
  replenishmentId: string
  sourceDifferenceId: string
  differenceSource: SpreadingDifferenceSourceType
  differenceType: SpreadingDifferenceType
  spreadingOrderId: string
  cutOrderIds: string[]
  productionOrderIds: string[]
  materialSku: string
  materialAlias: string
  patternFileName: string
  plannedValue: number
  actualValue: number
  differenceValue: number
  unit: string
  evidence: SpreadingDifferenceEvidence
  reviewStatus: SpreadingDifferenceHandlingStatus
  reviewResult: ReplenishmentReviewResult | ''
  nextAction: ReplenishmentNextAction | ''
  closeCutOrderRequired: boolean
  closeReason: string
  linkedLedgerEventIds: string[]
}

const USAGE_DIFFERENCE_THRESHOLD = 0.05

function round(value: number): number {
  return Number(Number(value || 0).toFixed(2))
}

function uniqueStrings(values: Array<string | undefined | null>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))))
}

function sumRolls(rolls: SpreadingRollRecord[], getter: (roll: SpreadingRollRecord) => number): number {
  return round(rolls.reduce((sum, roll) => sum + Math.max(Number(getter(roll) || 0), 0), 0))
}

function resolveSessionForOrder(order: SpreadingOrder, sessions: SpreadingSession[]): SpreadingSession | null {
  return (
    sessions.find((session) => session.spreadingSessionId === order.spreadingOrderId) ||
    sessions.find((session) => session.sessionNo === order.spreadingOrderNo) ||
    sessions.find((session) => session.markerPlanId === order.markerPlanId && session.sourceBedNo === order.bedNo) ||
    null
  )
}

function resolveOrderForRuntimeEvent(event: CuttingRuntimeEvent, orders: SpreadingOrder[]): SpreadingOrder | null {
  return (
    orders.find((order) => order.spreadingOrderId === event.refs.spreadingOrderId) ||
    orders.find((order) => order.spreadingOrderNo === event.refs.spreadingOrderNo) ||
    orders.find((order) => event.refs.cutOrderId && order.sourceCutOrderIds.includes(event.refs.cutOrderId)) ||
    orders.find((order) => event.refs.cutOrderNo && order.sourceCutOrderNos.includes(event.refs.cutOrderNo)) ||
    orders[0] ||
    null
  )
}

function getRuntimeEventPayload(event: CuttingRuntimeEvent): Record<string, unknown> {
  return event.payload && typeof event.payload === 'object' ? (event.payload as Record<string, unknown>) : {}
}

function sumRuntimeOutputPieceQty(event: CuttingRuntimeEvent): number {
  const payload = getRuntimeEventPayload(event)
  const outputLines = Array.isArray(payload.outputLines) ? payload.outputLines : []
  return round(
    outputLines.reduce((sum, line) => {
      if (!line || typeof line !== 'object') return sum
      return sum + Math.max(Number((line as Record<string, unknown>).actualPieceQty || 0), 0)
    }, 0),
  )
}

function resolveOrderStatusFromSession(session: SpreadingSession): SpreadingOrder['status'] {
  if (session.cuttingStatus === 'CUTTING_DONE') return 'CUT_DONE'
  if (session.cuttingStatus === 'CUTTING') return 'CUTTING'
  if (session.cuttingStatus === 'WAITING_CUTTING') return 'WAITING_CUTTING'
  if (session.status === 'IN_PROGRESS') return 'SPREADING'
  if (session.status === 'DONE') return 'SPREAD_DONE'
  return 'WAITING_SPREADING'
}

function buildOrdersFromSessions(sessions: SpreadingSession[]): SpreadingOrder[] {
  if (!sessions.length) return []
  const sourceRecords = listGeneratedCutOrderSourceRecords()
  const sourceById = new Map<string, GeneratedCutOrderSourceRecord>()
  sourceRecords.forEach((record) => {
    sourceById.set(record.cutOrderId, record)
    sourceById.set(record.cutOrderNo, record)
  })

  return sessions.map((session) => {
    const sessionCutOrderIds = session.cutOrderIds || []
    const sourceRows = sessionCutOrderIds
      .map((cutOrderId) => sourceById.get(cutOrderId))
      .filter((record): record is GeneratedCutOrderSourceRecord => Boolean(record))
    const firstSource = sourceRows[0]
    const plannedGarmentQty = round(
      session.planUnits?.reduce((sum, unit) => sum + Math.max(Number(unit.plannedCutGarmentQty || 0), 0), 0) ||
        session.theoreticalCutGarmentQty ||
        session.theoreticalActualCutPieceQty ||
        0,
    )
    const plannedMaterialUsage = round(
      session.theoreticalSpreadTotalLength ||
        session.configuredLengthTotal ||
        session.claimedLengthTotal ||
        session.totalActualLength ||
        0,
    )

    return {
      spreadingOrderId: session.spreadingSessionId,
      spreadingOrderNo: session.sessionNo || session.spreadingSessionId,
      markerPlanId: session.markerPlanId,
      markerPlanNo: session.markerPlanNo,
      markerNumberId: session.sourceBedId || session.markerId || session.spreadingSessionId,
      markerNumber: session.sourceBedNo || session.markerNo || session.sessionNo || session.spreadingSessionId,
      bedNo: session.sourceBedNo || session.markerNo || '',
      sourceCutOrderIds: [...sessionCutOrderIds],
      sourceCutOrderNos: sourceRows.map((record) => record.cutOrderNo),
      productionOrderIds: uniqueStrings(sourceRows.map((record) => record.productionOrderId)),
      productionOrderNos: uniqueStrings(sourceRows.map((record) => record.productionOrderNo)),
      spuId: firstSource?.spuCode || session.spuCode || '',
      spuCode: firstSource?.spuCode || session.spuCode || '',
      styleId: firstSource?.styleId || session.styleCode || '',
      styleName: firstSource?.styleName || '',
      materialIdentity: {
        materialSku: firstSource?.materialSku || session.materialSkuSummary || '待补',
        materialName: firstSource?.materialName || session.materialAliasSummary || '铺布面料',
        materialColor: firstSource?.materialColor || session.colorSummary || '待补',
        materialAlias: firstSource?.materialAlias || session.materialAliasSummary || '待补',
        materialImageUrl: firstSource?.materialImageUrl || session.materialImageUrl || '',
        materialUnit: firstSource?.materialUnit || '米',
      },
      patternIdentity: {
        patternFileId: firstSource?.patternIdentity.patternFileId || '',
        patternFileName: firstSource?.patternIdentity.patternFileName || '纸样待补',
        patternVersion: firstSource?.patternIdentity.patternVersion || '待补',
        patternKind: firstSource?.patternIdentity.patternKind || '待补',
        effectiveWidthValue: firstSource?.patternIdentity.effectiveWidthValue || 0,
        effectiveWidthUnit: firstSource?.patternIdentity.effectiveWidthUnit || 'cm',
        effectiveWidthText: firstSource?.patternIdentity.effectiveWidthText || '待补',
        piecePartCodes: firstSource?.patternIdentity.piecePartCodes || [],
        piecePartNames: firstSource?.patternIdentity.piecePartNames || [],
      },
      effectiveWidth: firstSource?.patternIdentity.effectiveWidthText || '待补',
      plannedLayerCount: Math.max(Number(session.plannedLayers || 0), 0),
      plannedGarmentQty,
      plannedPieceQty: plannedGarmentQty,
      plannedMaterialUsage,
      plannedMaterialUsageUnit: firstSource?.materialUnit || '米',
      sizeRatio: (session.planUnits || []).map((unit) => `${unit.sizeLabel || unit.planUnitId}×${unit.plannedCutGarmentQty || 0}`).join(' / '),
      markerMode: session.spreadingMode,
      markerModeLabel: session.spreadingMode,
      markerImageUrl: '',
      status: resolveOrderStatusFromSession(session),
      createdAt: session.createdAt,
      createdBy: session.ownerName || '系统',
      confirmedAt: session.updatedAt || session.createdAt,
      linkedPdaTaskId: session.sourceWritebackId || '',
    }
  })
}

function getActualCutQty(session: SpreadingSession | null): number {
  if (!session) return 0
  return round(
    Number(session.actualCutGarmentQty ?? session.actualCutPieceQty ?? 0) ||
      session.rolls.reduce((sum, roll) => sum + Number(roll.actualCutGarmentQty ?? roll.actualCutPieceQty ?? 0), 0),
  )
}

function buildDifferenceBase(order: SpreadingOrder, session: SpreadingSession | null) {
  const actualLayerCount = session ? Math.max(sumRolls(session.rolls, (roll) => roll.layerCount), Number(session.actualLayers || 0)) : 0
  const actualUsage = session ? Math.max(sumRolls(session.rolls, (roll) => roll.actualLength), Number(session.totalActualLength || 0)) : 0
  const actualCutQty = getActualCutQty(session)
  const detectedAt = session?.updatedFromPdaAt || session?.updatedAt || order.confirmedAt || order.createdAt
  const detectedBy =
    session?.operators?.[0]?.operatorName ||
    session?.rolls?.[0]?.operatorNames?.[0] ||
    session?.ownerName ||
    order.createdBy ||
    '系统计算'

  return {
    actualLayerCount,
    actualUsage,
    actualCutQty,
    detectedAt,
    detectedBy,
    evidenceRollNos: uniqueStrings(session?.rolls.map((roll) => roll.rollNo) || []),
    evidenceNote: session?.varianceNote || session?.note || '',
  }
}

function createDifference(
  order: SpreadingOrder,
  session: SpreadingSession | null,
  input: {
    suffix: string
    sourceType: SpreadingDifferenceSourceType
    sourceObjectId?: string
    differenceType: SpreadingDifferenceType
    differenceLevel: SpreadingDifferenceLevel
    plannedValue: number
    actualValue: number
    unit: string
    summary: string
    operatorName?: string
    occurredAt?: string
    note?: string
    photoProofCount?: number
  },
): SpreadingDifference {
  const base = buildDifferenceBase(order, session)
  const differenceId = `diff-${order.spreadingOrderId}-${input.suffix}`.replace(/[^a-zA-Z0-9\u4e00-\u9fa5-]/g, '-')
  const ledgerEventId = `ledger:${order.spreadingOrderId}:difference:${input.suffix}`.replace(/[^a-zA-Z0-9\u4e00-\u9fa5:-]/g, '-')
  return {
    differenceId,
    sourceType: input.sourceType,
    sourceObjectId: input.sourceObjectId || session?.sourceWritebackId || session?.spreadingSessionId || order.spreadingOrderId,
    spreadingOrderId: order.spreadingOrderId,
    spreadingOrderNo: order.spreadingOrderNo,
    markerPlanId: order.markerPlanId,
    markerPlanNo: order.markerPlanNo,
    cutOrderIds: [...order.sourceCutOrderIds],
    cutOrderNos: [...order.sourceCutOrderNos],
    productionOrderIds: [...order.productionOrderIds],
    productionOrderNos: [...order.productionOrderNos],
    materialSku: order.materialIdentity.materialSku,
    materialAlias: order.materialIdentity.materialAlias,
    materialImageUrl: order.materialIdentity.materialImageUrl,
    patternFileName: order.patternIdentity.patternFileName,
    differenceType: input.differenceType,
    differenceLevel: input.differenceLevel,
    plannedValue: round(input.plannedValue),
    actualValue: round(input.actualValue),
    differenceValue: round(input.actualValue - input.plannedValue),
    unit: input.unit,
    evidence: {
      summary: input.summary,
      operatorName: input.operatorName || base.detectedBy,
      occurredAt: input.occurredAt || base.detectedAt,
      photoProofCount: input.photoProofCount,
      rollNos: base.evidenceRollNos,
      note: input.note || base.evidenceNote,
    },
    detectedAt: input.occurredAt || base.detectedAt,
    detectedBy: input.operatorName || base.detectedBy,
    handlingStatus: '待处理',
    linkedReplenishmentId: `rep-diff-${differenceId}`,
    linkedLedgerEventIds: [ledgerEventId],
  }
}

function buildDifferencesFromOrders(orders: SpreadingOrder[], sessions: SpreadingSession[]): SpreadingDifference[] {
  const ledgerByCutOrder = buildMaterialLedgerProjectionMap()
  return orders.flatMap((order) => {
    const session = resolveSessionForOrder(order, sessions)
    const base = buildDifferenceBase(order, session)
    const differences: SpreadingDifference[] = []

    if (base.actualLayerCount > 0 && base.actualLayerCount < order.plannedLayerCount) {
      differences.push(createDifference(order, session, {
        suffix: 'actual-layer-less-than-plan',
        sourceType: session?.sourceWritebackId ? 'PDA 铺布记录' : '系统计算',
        differenceType: '实铺小于计划',
        differenceLevel: '需处理',
        plannedValue: order.plannedLayerCount,
        actualValue: base.actualLayerCount,
        unit: '层',
        summary: '实铺层数小于唛架方案计划层数，允许提交，后续处理差异只选择发起布料或忽略。',
      }))
    }

    if (base.actualUsage > 0 && order.plannedMaterialUsage > 0) {
      const usageRatio = Math.abs(base.actualUsage - order.plannedMaterialUsage) / Math.max(order.plannedMaterialUsage, 1)
      if (usageRatio > USAGE_DIFFERENCE_THRESHOLD) {
        differences.push(createDifference(order, session, {
          suffix: 'usage-difference',
          sourceType: session?.sourceWritebackId ? 'PDA 铺布记录' : '系统计算',
          differenceType: '实际用量差异',
          differenceLevel: usageRatio > 0.1 ? '需处理' : '待处理',
          plannedValue: order.plannedMaterialUsage,
          actualValue: base.actualUsage,
          unit: order.plannedMaterialUsageUnit || '米',
          summary: '实际用量与计划用量差异超过 5%，需要进入差异处理。',
        }))
      }
    }

    if (base.actualCutQty > 0 && base.actualCutQty < order.plannedGarmentQty) {
      differences.push(createDifference(order, session, {
        suffix: 'actual-cut-less-than-plan',
        sourceType: session?.sourceWritebackId ? 'PDA 裁剪记录' : '系统计算',
        differenceType: '实裁小于计划',
        differenceLevel: '需处理',
        plannedValue: order.plannedGarmentQty,
        actualValue: base.actualCutQty,
        unit: '件',
        summary: '实际裁剪数量小于计划数量，允许提交，后续处理差异只选择发起布料或忽略。',
      }))
    }

    const availableQty = order.sourceCutOrderIds
      .map((id) => ledgerByCutOrder[id]?.availableQty ?? 0)
      .reduce((sum, value) => sum + Number(value || 0), 0)
    if (order.plannedMaterialUsage > 0 && availableQty > 0 && availableQty < Math.max(order.plannedMaterialUsage - base.actualUsage, 0)) {
      differences.push(createDifference(order, session, {
        suffix: 'material-balance-shortage',
        sourceType: '系统计算',
        differenceType: '面料余额不足',
        differenceLevel: '需处理',
        plannedValue: Math.max(order.plannedMaterialUsage - base.actualUsage, 0),
        actualValue: availableQty,
        unit: order.plannedMaterialUsageUnit || '米',
        summary: '当前裁床可用余额不足以支撑后续计划，需要补料管理确认下一步。',
      }))
    }

    const abnormalRolls = session?.rolls.filter((roll) =>
      !roll.rollNo ||
      Number(roll.actualLength || 0) > Number(roll.labeledLength || 0) ||
      /异常|漏扫|不在本次领料/.test(roll.note || roll.handoverNotes || ''),
    ) || []
    if (abnormalRolls.length) {
      differences.push(createDifference(order, session, {
        suffix: 'roll-record-abnormal',
        sourceType: session?.sourceWritebackId ? 'PDA 铺布记录' : 'Web 处理',
        differenceType: '卷记录异常',
        differenceLevel: '待处理',
        plannedValue: abnormalRolls.length,
        actualValue: 0,
        unit: '卷',
        summary: '存在布卷扫码或卷长使用异常，需要进入差异处理。',
        note: abnormalRolls.map((roll) => roll.note || roll.handoverNotes || roll.rollNo || '未命名布卷').join('；'),
      }))
    }

    const headTailLength = session ? sumRolls(session.rolls, (roll) => Number(roll.headLength || 0) + Number(roll.tailLength || 0)) : 0
    if (headTailLength > 8) {
      differences.push(createDifference(order, session, {
        suffix: 'head-tail-abnormal',
        sourceType: session?.sourceWritebackId ? 'PDA 铺布记录' : '系统计算',
        differenceType: '布头布尾异常',
        differenceLevel: '待处理',
        plannedValue: 8,
        actualValue: headTailLength,
        unit: '米',
        summary: '布头布尾合计偏高，需要进入差异处理。',
      }))
    }

    return differences
  })
}

function buildDifferencesFromRuntimeStageEvents(orders: SpreadingOrder[]): SpreadingDifference[] {
  if (!orders.length) return []
  const spreadingEvents = listCuttingRuntimeEventsByType('完成铺布')
  const cuttingEvents = listCuttingRuntimeEventsByType('完成裁剪')

  const spreadingDifferences = spreadingEvents.flatMap((event) => {
    const order = resolveOrderForRuntimeEvent(event, orders)
    if (!order) return []
    const payload = getRuntimeEventPayload(event)
    const actualLayerCount = Number(payload.actualLayerCount || 0)
    const plannedLayerCount = Number(order.plannedLayerCount || 0)
    if (!(actualLayerCount > 0 && plannedLayerCount > 0 && actualLayerCount < plannedLayerCount)) return []
    return [createDifference(order, null, {
      suffix: `pda-event-${event.eventId}-layer`,
      sourceType: 'PDA 铺布记录',
      sourceObjectId: event.eventId,
      differenceType: '实铺小于计划',
      differenceLevel: '需处理',
      plannedValue: plannedLayerCount,
      actualValue: actualLayerCount,
      unit: '层',
      summary: 'PDA 完成铺布事件记录实铺层数小于计划层数。',
      operatorName: event.operatorName,
      occurredAt: event.occurredAt,
      note: `来源事件：${event.eventNo}`,
    })]
  })

  const cuttingDifferences = cuttingEvents.flatMap((event) => {
    const order = resolveOrderForRuntimeEvent(event, orders)
    if (!order) return []
    const actualPieceQty = sumRuntimeOutputPieceQty(event)
    const plannedPieceQty = Number(order.plannedPieceQty || order.plannedGarmentQty || 0)
    if (!(actualPieceQty > 0 && plannedPieceQty > 0 && actualPieceQty < plannedPieceQty)) return []
    return [createDifference(order, null, {
      suffix: `pda-event-${event.eventId}-cut`,
      sourceType: 'PDA 裁剪记录',
      sourceObjectId: event.eventId,
      differenceType: '实裁小于计划',
      differenceLevel: '需处理',
      plannedValue: plannedPieceQty,
      actualValue: actualPieceQty,
      unit: '片',
      summary: 'PDA 完成裁剪事件记录实际裁片数量小于计划数量。',
      operatorName: event.operatorName,
      occurredAt: event.occurredAt,
      note: `来源事件：${event.eventNo}`,
    })]
  })

  return [...spreadingDifferences, ...cuttingDifferences]
}

function buildDifferencesFromPdaFeedbacks(orders: SpreadingOrder[]): SpreadingDifference[] {
  const fallbackOrder = orders[0]
  if (!fallbackOrder) return []
  return listPdaReplenishmentFeedbackEvents().map((record) => createDifference(fallbackOrder, null, {
    suffix: `pda-feedback-${record.runtimeEventId}`,
    sourceType: 'PDA 铺布记录',
    sourceObjectId: record.runtimeEventId,
    differenceType: record.reasonLabel.includes('余量') || record.reasonLabel.includes('不足') ? '面料余额不足' : '现场反馈',
    differenceLevel: '需处理',
    plannedValue: 1,
    actualValue: 0,
    unit: '项',
    summary: `PDA 现场反馈：${record.reasonLabel}`,
    operatorName: record.operatorName,
    occurredAt: record.submittedAt,
    note: record.note,
    photoProofCount: record.photoProofCount,
  }))
}

function buildSeedDifferences(orders: SpreadingOrder[]): SpreadingDifference[] {
  const sourceRecords = listGeneratedCutOrderSourceRecords()
  const fallbackSource = sourceRecords[0]
  const pb2440Sources = sourceRecords.filter((record) =>
    ['CUT-260307-102-01', 'CUT-260307-102-02', 'CUT-260307-102-03'].includes(record.cutOrderNo),
  )
  const pb2440Primary = pb2440Sources[0]
  const pb2440Order = pb2440Primary ? {
    spreadingOrderId: 'spreading-session-marker-plan-marker-plan-mb-030102-02-planned-100-actual-80-c',
    spreadingOrderNo: 'PB-2440',
    markerPlanId: 'marker-plan:MB-030102-02',
    markerPlanNo: 'MB-030102-02',
    markerNumberId: 'seed-marker-marker-plan-marker-plan:MB-030102-02-bed-A-1',
    markerNumber: 'A-1',
    bedNo: 'A-1',
    sourceCutOrderIds: pb2440Sources.map((record) => record.cutOrderId),
    sourceCutOrderNos: pb2440Sources.map((record) => record.cutOrderNo),
    productionOrderIds: uniqueStrings(pb2440Sources.map((record) => record.productionOrderId)),
    productionOrderNos: uniqueStrings(pb2440Sources.map((record) => record.productionOrderNo)),
    spuId: pb2440Primary.spuCode,
    spuCode: pb2440Primary.spuCode,
    styleId: pb2440Primary.styleId,
    styleName: pb2440Primary.styleName,
    materialIdentity: {
      materialSku: pb2440Primary.materialIdentity.materialSku,
      materialName: pb2440Primary.materialIdentity.materialName,
      materialColor: pb2440Primary.materialIdentity.materialColor,
      materialAlias: pb2440Primary.materialIdentity.materialAlias,
      materialImageUrl: pb2440Primary.materialIdentity.materialImageUrl,
      materialUnit: pb2440Primary.materialIdentity.materialUnit,
    },
    patternIdentity: {
      patternFileId: pb2440Primary.patternIdentity.patternFileId,
      patternFileName: pb2440Primary.patternIdentity.patternFileName,
      patternVersion: pb2440Primary.patternIdentity.patternVersion,
      patternKind: pb2440Primary.patternIdentity.patternKind,
      effectiveWidthValue: pb2440Primary.patternIdentity.effectiveWidthValue,
      effectiveWidthUnit: pb2440Primary.patternIdentity.effectiveWidthUnit,
      effectiveWidthText: `${pb2440Primary.patternIdentity.effectiveWidthValue}${pb2440Primary.patternIdentity.effectiveWidthUnit}`,
      piecePartCodes: [...pb2440Primary.patternIdentity.piecePartCodes],
      piecePartNames: [...pb2440Primary.patternIdentity.piecePartNames],
    },
    effectiveWidth: `${pb2440Primary.patternIdentity.effectiveWidthValue}${pb2440Primary.patternIdentity.effectiveWidthUnit}`,
    plannedLayerCount: 100,
    plannedGarmentQty: 2900,
    plannedPieceQty: 2900,
    plannedMaterialUsage: 4296.6,
    plannedMaterialUsageUnit: pb2440Primary.materialIdentity.materialUnit,
    sizeRatio: 'S×36 / M×54 / L×48 / XL×30 / 2XL×18',
    markerMode: 'high_low',
    markerModeLabel: '高低层模式',
    markerImageUrl: '',
    status: 'CUT_DONE',
    createdAt: '2026-03-14 09:00',
    createdBy: '系统',
    confirmedAt: '2026-03-14 18:00',
    linkedPdaTaskId: '',
  } satisfies SpreadingOrder : null
  const order = orders[0] || (fallbackSource ? {
    spreadingOrderId: 'spreading-seed-difference',
    spreadingOrderNo: 'PB-DIFF-SEED',
    markerPlanId: 'marker-plan-diff-seed',
    markerPlanNo: 'MJ-DIFF-SEED',
    markerNumberId: 'BED-DIFF-SEED',
    markerNumber: 'BED-DIFF-SEED',
    bedNo: 'BED-DIFF-SEED',
    sourceCutOrderIds: [fallbackSource.cutOrderId],
    sourceCutOrderNos: [fallbackSource.cutOrderNo],
    productionOrderIds: [fallbackSource.productionOrderId],
    productionOrderNos: [fallbackSource.productionOrderNo],
    spuId: fallbackSource.spuId,
    spuCode: fallbackSource.spuCode,
    styleId: fallbackSource.styleId,
    styleName: fallbackSource.styleName,
    materialIdentity: {
      materialSku: fallbackSource.materialIdentity.materialSku,
      materialName: fallbackSource.materialIdentity.materialName,
      materialColor: fallbackSource.materialIdentity.materialColor,
      materialAlias: fallbackSource.materialIdentity.materialAlias,
      materialImageUrl: fallbackSource.materialIdentity.materialImageUrl,
      materialUnit: fallbackSource.materialIdentity.materialUnit,
    },
    patternIdentity: {
      patternFileId: fallbackSource.patternIdentity.patternFileId,
      patternFileName: fallbackSource.patternIdentity.patternFileName,
      patternVersion: fallbackSource.patternIdentity.patternVersion,
      patternKind: fallbackSource.patternIdentity.patternKind,
      effectiveWidthValue: fallbackSource.patternIdentity.effectiveWidthValue,
      effectiveWidthUnit: fallbackSource.patternIdentity.effectiveWidthUnit,
      effectiveWidthText: `${fallbackSource.patternIdentity.effectiveWidthValue}${fallbackSource.patternIdentity.effectiveWidthUnit}`,
      piecePartCodes: [...fallbackSource.patternIdentity.piecePartCodes],
      piecePartNames: [...fallbackSource.patternIdentity.piecePartNames],
    },
    effectiveWidth: `${fallbackSource.patternIdentity.effectiveWidthValue}${fallbackSource.patternIdentity.effectiveWidthUnit}`,
    plannedLayerCount: 100,
    plannedGarmentQty: 1000,
    plannedPieceQty: 1000,
    plannedMaterialUsage: 1020,
    plannedMaterialUsageUnit: fallbackSource.materialIdentity.materialUnit,
    sizeRatio: 'S/M/L/XL',
    markerMode: 'normal',
    markerModeLabel: '普通模式',
    markerImageUrl: '',
    status: 'CUT_DONE',
    createdAt: '2026-03-18 09:00',
    createdBy: '系统',
    confirmedAt: '2026-03-18 09:30',
    linkedPdaTaskId: '',
  } satisfies SpreadingOrder : null)
  if (!order) return []

  return [
    createDifference(order, null, {
      suffix: 'seed-layer-short',
      sourceType: 'PDA 铺布记录',
      differenceType: '实铺小于计划',
      differenceLevel: '需处理',
      plannedValue: 100,
      actualValue: 80,
      unit: '层',
      summary: '计划铺 100 层，现场实际只铺 80 层。',
      operatorName: 'PDA 操作员',
      occurredAt: '2026-03-18 14:20',
    }),
    createDifference(order, null, {
      suffix: 'seed-cut-short',
      sourceType: 'PDA 裁剪记录',
      differenceType: '实裁小于计划',
      differenceLevel: '需处理',
      plannedValue: 1000,
      actualValue: 878,
      unit: '件',
      summary: '实际裁剪数量小于计划数量。',
      operatorName: '裁剪组',
      occurredAt: '2026-03-18 16:50',
    }),
    createDifference(order, null, {
      suffix: 'seed-usage-diff',
      sourceType: '系统计算',
      differenceType: '实际用量差异',
      differenceLevel: '待处理',
      plannedValue: 1020,
      actualValue: 1112,
      unit: order.plannedMaterialUsageUnit || '米',
      summary: '实际用量超过计划用量 5% 阈值。',
      occurredAt: '2026-03-18 17:05',
    }),
    createDifference(order, null, {
      suffix: 'seed-material-short',
      sourceType: 'PDA 铺布记录',
      differenceType: '面料余额不足',
      differenceLevel: '需处理',
      plannedValue: 240,
      actualValue: 60,
      unit: order.plannedMaterialUsageUnit || '米',
      summary: '现场反馈当前面料不足以支撑后续铺布。',
      operatorName: '现场组长',
      occurredAt: '2026-03-18 17:18',
      note: 'PDA 现场反馈面料不足。',
      photoProofCount: 2,
    }),
    createDifference(order, null, {
      suffix: 'seed-roll-abnormal',
      sourceType: 'PDA 铺布记录',
      differenceType: '卷记录异常',
      differenceLevel: '待处理',
      plannedValue: 1,
      actualValue: 0,
      unit: '卷',
      summary: '扫描布卷不在本次领料记录中。',
      operatorName: '铺布员',
      occurredAt: '2026-03-18 17:25',
      note: '布卷 R-ABN-01 未匹配本次领料记录。',
    }),
    createDifference(order, null, {
      suffix: 'seed-field-feedback',
      sourceType: 'PDA 铺布记录',
      differenceType: '现场反馈',
      differenceLevel: '需处理',
      plannedValue: 1,
      actualValue: 0,
      unit: '项',
      summary: 'PDA 现场反馈布面局部瑕疵，需要处理差异。',
      operatorName: '现场组长',
      occurredAt: '2026-03-18 17:28',
      note: '布面瑕疵已拍照，待处理。',
      photoProofCount: 1,
    }),
    createDifference(order, null, {
      suffix: 'seed-claim-diff-carry',
      sourceType: '领料差异延续',
      differenceType: '面料余额不足',
      differenceLevel: '需处理',
      plannedValue: 180,
      actualValue: 120,
      unit: order.plannedMaterialUsageUnit || '米',
      summary: '领料时少领 60 米，差异仍影响后续用料。',
      operatorName: '裁床领料员',
      occurredAt: '2026-03-18 17:32',
      note: '由领料差异延续到铺布阶段，需补料管理判断后续动作。',
    }),
    ...(pb2440Order ? [
      createDifference(pb2440Order, null, {
        suffix: 'seed-pb2440-layer-short',
        sourceType: '系统计算',
        differenceType: '实铺小于计划',
        differenceLevel: '需处理',
        plannedValue: 100,
        actualValue: 80,
        unit: '层',
        summary: 'PB-2440 计划铺 100 层，现场按已领面料先实铺 80 层。',
        operatorName: '张师傅',
        occurredAt: '2026-03-14 18:00',
      }),
      createDifference(pb2440Order, null, {
        suffix: 'seed-pb2440-cut-short',
        sourceType: '系统计算',
        differenceType: '实裁小于计划',
        differenceLevel: '需处理',
        plannedValue: 2900,
        actualValue: 1250,
        unit: '件',
        summary: 'PB-2440 实际裁剪数量小于计划数量。',
        operatorName: '张师傅',
        occurredAt: '2026-03-14 18:00',
      }),
      createDifference(pb2440Order, null, {
        suffix: 'seed-pb2440-usage-diff',
        sourceType: '系统计算',
        differenceType: '实际用量差异',
        differenceLevel: '待处理',
        plannedValue: 4296.6,
        actualValue: 54,
        unit: pb2440Order.plannedMaterialUsageUnit,
        summary: 'PB-2440 实际用量与计划用量差异超过阈值。',
        operatorName: '张师傅',
        occurredAt: '2026-03-14 18:00',
      }),
    ] : []),
  ]
}

function uniqueByDifferenceId(differences: SpreadingDifference[]): SpreadingDifference[] {
  const seen = new Set<string>()
  return differences.filter((difference) => {
    if (seen.has(difference.differenceId)) return false
    seen.add(difference.differenceId)
    return true
  })
}

export function listSpreadingDifferences(input?: {
  orders?: SpreadingOrder[]
  sessions?: SpreadingSession[]
}): SpreadingDifference[] {
  const sessions = input?.sessions || []
  const orders = input?.orders?.length ? input.orders : buildOrdersFromSessions(sessions)
  return uniqueByDifferenceId([
    ...buildDifferencesFromOrders(orders, sessions),
    ...buildDifferencesFromRuntimeStageEvents(orders),
    ...buildDifferencesFromPdaFeedbacks(orders),
    ...buildSeedDifferences(orders),
  ]).sort((left, right) => right.detectedAt.localeCompare(left.detectedAt, 'zh-CN'))
}

export function listSpreadingDifferencesBySpreadingOrder(
  spreadingOrderIdOrNo: string,
  input?: {
    orders?: SpreadingOrder[]
    sessions?: SpreadingSession[]
  },
): SpreadingDifference[] {
  return listSpreadingDifferences(input).filter(
    (difference) =>
      difference.spreadingOrderId === spreadingOrderIdOrNo ||
      difference.spreadingOrderNo === spreadingOrderIdOrNo ||
      difference.sourceObjectId === spreadingOrderIdOrNo,
  )
}

export function listSpreadingDifferencesByProductionOrder(
  productionOrderIdOrNo: string,
  input?: {
    orders?: SpreadingOrder[]
    sessions?: SpreadingSession[]
  },
): SpreadingDifference[] {
  return listSpreadingDifferences(input).filter(
    (difference) =>
      difference.productionOrderIds.includes(productionOrderIdOrNo) ||
      difference.productionOrderNos.includes(productionOrderIdOrNo),
  )
}

function resolveReviewResultFromDifferenceType(differenceType: SpreadingDifferenceType): ReplenishmentReviewResult | '' {
  if (differenceType === '面料余额不足') return '需要补料'
  if (differenceType === '实际用量差异') return '需要补料'
  if (differenceType === '实铺小于计划') return '需要补料'
  if (differenceType === '实裁小于计划') return '需要补料'
  if (differenceType === '卷记录异常') return '仅记录差异'
  if (differenceType === '现场反馈') return '关闭裁片单'
  return ''
}

function resolveNextActionFromReviewResult(reviewResult: ReplenishmentReviewResult | ''): ReplenishmentNextAction | '' {
  if (reviewResult === '需要补料') return '回到中转仓配料'
  if (reviewResult === '仅记录差异') return '无后续动作'
  if (reviewResult === '关闭裁片单') return '关闭裁片单'
  return ''
}

export function buildSpreadingReplenishmentHandlingObjects(
  differences: SpreadingDifference[] = listSpreadingDifferences(),
): SpreadingReplenishmentHandlingObject[] {
  return differences.map((difference) => {
    const reviewResult = resolveReviewResultFromDifferenceType(difference.differenceType)
    const nextAction = resolveNextActionFromReviewResult(reviewResult)
    return {
      replenishmentId: difference.linkedReplenishmentId,
      sourceDifferenceId: difference.differenceId,
      differenceSource: difference.sourceType,
      differenceType: difference.differenceType,
      spreadingOrderId: difference.spreadingOrderId,
      cutOrderIds: [...difference.cutOrderIds],
      productionOrderIds: [...difference.productionOrderIds],
      materialSku: difference.materialSku,
      materialAlias: difference.materialAlias,
      patternFileName: difference.patternFileName,
      plannedValue: difference.plannedValue,
      actualValue: difference.actualValue,
      differenceValue: difference.differenceValue,
      unit: difference.unit,
      evidence: { ...difference.evidence },
      reviewStatus: reviewResult ? '已处理' : difference.handlingStatus,
      reviewResult,
      nextAction,
      closeCutOrderRequired: reviewResult === '关闭裁片单',
      closeReason: reviewResult === '关闭裁片单' ? '现场确认剩余缺口不再继续排唛架铺布裁剪。' : '',
      linkedLedgerEventIds: reviewResult === '仅记录差异' ? [] : [...difference.linkedLedgerEventIds],
    }
  })
}
