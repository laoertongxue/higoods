import {
  appendHandoverWritebackRecord,
  appendInboundWritebackRecord,
  appendPickupWritebackRecord,
  appendReplenishmentFeedbackWritebackRecord,
  type PdaCutPieceHandoverWritebackRecord,
  type PdaCutPieceInboundWritebackRecord,
  type PdaPickupWritebackRecord,
  type PdaReplenishmentFeedbackWritebackRecord,
} from '../../data/fcs/cutting/pda-execution-writeback-ledger.ts'
import {
  applyWritebackToSpreadingSession,
  hydrateIncomingPdaWritebacks,
  normalizePdaWritebackPayload,
  serializePdaWritebackStorage,
  type PdaSpreadingWriteback,
  type PdaWritebackAuditTrail,
} from '../../data/fcs/cutting/pda-spreading-writeback.ts'
import {
  CUTTING_MARKER_SPREADING_LEDGER_STORAGE_KEY,
  createEmptyStore as createEmptyMarkerSpreadingStore,
  deserializeMarkerSpreadingStorage,
  serializeMarkerSpreadingStorage,
} from '../../data/fcs/cutting/marker-spreading-ledger.ts'
import {
  getLatestClaimDisputeByOriginalCutOrderNo,
  markClaimDisputeCraftWrittenBack,
} from '../../state/fcs-claim-dispute-store'
import {
  getPdaCuttingWritebackStorage,
  type CuttingPdaActionType,
  type CuttingPdaWritebackIdentityInput,
  type CuttingPdaWritebackOperatorInput,
  type CuttingPdaWritebackSourceInput,
  buildPdaCuttingWritebackId,
} from '../../data/fcs/pda-cutting-writeback-inputs.ts'
import {
  resolveMergeBatchRef,
  resolveOriginalCutOrderRef,
  resolvePdaExecutionRef,
  resolveProductionOrderRef,
} from '../cutting-core/index.ts'
import { CUTTING_PDA_WRITEBACK_STORAGE_KEY } from '../../data/fcs/cutting/pda-spreading-writeback.ts'

export type CuttingPdaWritebackIdentity = CuttingPdaWritebackIdentityInput
export type CuttingPdaWritebackOperator = CuttingPdaWritebackOperatorInput
export type CuttingPdaWritebackSource = CuttingPdaWritebackSourceInput

export interface CuttingPdaWritebackBridgeResult {
  success: boolean
  issues: string[]
  warningMessages: string[]
  writebackId: string
}

function nowText(date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function buildWritebackId(actionType: CuttingPdaActionType, identity: CuttingPdaWritebackIdentity, actionAt: string): string {
  return buildPdaCuttingWritebackId(actionType, {
    taskId: identity.taskId,
    executionOrderId: identity.executionOrderId,
    originalCutOrderId: identity.originalCutOrderId,
  }, actionAt)
}

function buildFailure(issues: string[], writebackId = ''): CuttingPdaWritebackBridgeResult {
  return {
    success: false,
    issues,
    warningMessages: [],
    writebackId,
  }
}

function buildSuccess(writebackId: string, warningMessages: string[] = []): CuttingPdaWritebackBridgeResult {
  return {
    success: true,
    issues: [],
    warningMessages,
    writebackId,
  }
}

function validateIdentity(identity: CuttingPdaWritebackIdentity): string[] {
  const issues: string[] = []

  if (!identity.taskId.trim()) issues.push('缺少任务 ID。')
  if (!identity.taskNo.trim()) issues.push('缺少任务号。')
  if (!identity.productionOrderId.trim() || !identity.productionOrderNo.trim()) {
    issues.push('缺少生产单标识。')
  }
  if (!identity.originalCutOrderId.trim() || !identity.originalCutOrderNo.trim()) {
    issues.push('缺少原始裁片单标识。')
  }
  if (!identity.executionOrderId.trim() || !identity.executionOrderNo.trim()) {
    issues.push('缺少 PDA 执行对象标识。')
  }
  if (!identity.materialSku.trim()) issues.push('缺少面料编码。')

  const productionRef = resolveProductionOrderRef({
    productionOrderId: identity.productionOrderId,
    productionOrderNo: identity.productionOrderNo,
  })
  if (!productionRef) {
    issues.push('当前生产单未能对齐到工艺工厂主来源。')
  }

  const originalRef = resolveOriginalCutOrderRef({
    originalCutOrderId: identity.originalCutOrderId,
    originalCutOrderNo: identity.originalCutOrderNo,
  })
  if (!originalRef) {
    issues.push('当前原始裁片单未能对齐到工艺工厂主来源。')
  } else {
    if (productionRef && originalRef.productionOrderId !== productionRef.productionOrderId) {
      issues.push('原始裁片单与生产单引用不一致。')
    }
  }

  const executionRef = resolvePdaExecutionRef({
    taskId: identity.taskId,
    taskNo: identity.taskNo,
    executionOrderId: identity.executionOrderId,
    executionOrderNo: identity.executionOrderNo,
    legacyCutPieceOrderNo: identity.legacyCutPieceOrderNo,
    cutPieceOrderNo: identity.cutPieceOrderNo,
  })
  if (!executionRef) {
    issues.push('当前 PDA 执行对象未能对齐到工艺工厂主来源。')
  } else {
    if (executionRef.originalCutOrderId !== identity.originalCutOrderId) {
      issues.push('执行对象与原始裁片单引用不一致。')
    }
    if (executionRef.productionOrderId !== identity.productionOrderId) {
      issues.push('执行对象与生产单引用不一致。')
    }
    if ((identity.mergeBatchId || executionRef.mergeBatchId) && executionRef.mergeBatchId !== (identity.mergeBatchId || '')) {
      issues.push('执行对象与合并批次引用不一致。')
    }
  }

  if (identity.mergeBatchId || identity.mergeBatchNo) {
    const mergeBatchRef = resolveMergeBatchRef({
      mergeBatchId: identity.mergeBatchId,
      mergeBatchNo: identity.mergeBatchNo,
    })
    if (!mergeBatchRef) {
      issues.push('当前合并批次未能对齐到工艺工厂主来源。')
    }
  }

  return issues
}

function buildSpreadingAuditTrail(writeback: PdaSpreadingWriteback, sessionId: string, appliedBy: string): PdaWritebackAuditTrail {
  return {
    auditTrailId: `audit-${writeback.writebackId}`,
    writebackId: writeback.writebackId,
    action: 'APPLY',
    actionBy: appliedBy,
    actionAt: writeback.appliedAt,
    targetSessionId: sessionId,
    note: '由 PDA 执行页自动写回并应用。',
  }
}

export function writePdaPickupToFcs(options: {
  identity: CuttingPdaWritebackIdentity
  operator: CuttingPdaWritebackOperator
  actionAt?: string
  source: CuttingPdaWritebackSource
  resultLabel: string
  actualReceivedQtyText: string
  discrepancyNote: string
  photoProofCount: number
  claimDisputeId?: string
  claimDisputeNo?: string
}): CuttingPdaWritebackBridgeResult {
  const issues = validateIdentity(options.identity)
  const actionAt = options.actionAt || nowText()
  const writebackId = buildWritebackId(
    options.resultLabel.includes('异议') ? 'PICKUP_DISPUTE' : 'PICKUP_CONFIRM',
    options.identity,
    actionAt,
  )
  if (issues.length) return buildFailure(issues, writebackId)
  const storage = getPdaCuttingWritebackStorage()
  if (!storage) return buildFailure(['当前环境不支持持久化工艺工厂领料写回结果。'], writebackId)

  const needsDispute = !options.resultLabel.includes('成功')
  let claimDisputeId = options.claimDisputeId || ''
  let claimDisputeNo = options.claimDisputeNo || ''
  if (needsDispute) {
    const latestDispute = options.claimDisputeId
      ? markClaimDisputeCraftWrittenBack(options.claimDisputeId)
      : getLatestClaimDisputeByOriginalCutOrderNo(options.identity.originalCutOrderNo)
    if (!latestDispute) {
      return buildFailure(['当前领料差异尚未建立异议记录，不能写入工艺工厂领料结果。'], writebackId)
    }
    if (!options.claimDisputeId) {
      markClaimDisputeCraftWrittenBack(latestDispute.disputeId)
    }
    claimDisputeId = latestDispute.disputeId
    claimDisputeNo = latestDispute.disputeNo
  }

  const record: PdaPickupWritebackRecord = {
    writebackId,
    taskId: options.identity.taskId,
    taskNo: options.identity.taskNo,
    productionOrderId: options.identity.productionOrderId,
    productionOrderNo: options.identity.productionOrderNo,
    originalCutOrderId: options.identity.originalCutOrderId,
    originalCutOrderNo: options.identity.originalCutOrderNo,
    mergeBatchId: options.identity.mergeBatchId || '',
    mergeBatchNo: options.identity.mergeBatchNo || '',
    actionType: options.resultLabel.includes('异议') ? 'PICKUP_DISPUTE' : 'PICKUP_CONFIRM',
    actionAt,
    executionOrderId: options.identity.executionOrderId,
    executionOrderNo: options.identity.executionOrderNo,
    legacyCutPieceOrderNo: options.identity.legacyCutPieceOrderNo,
    cutPieceOrderNo: options.identity.cutPieceOrderNo,
    materialSku: options.identity.materialSku,
    resultLabel: options.resultLabel,
    actualReceivedQtyText: options.actualReceivedQtyText,
    discrepancyNote: options.discrepancyNote,
    photoProofCount: options.photoProofCount,
    operatorAccountId: options.operator.operatorAccountId,
    operatorName: options.operator.operatorName,
    operatorRole: options.operator.operatorRole,
    operatorFactoryId: options.operator.operatorFactoryId,
    operatorFactoryName: options.operator.operatorFactoryName,
    submittedAt: actionAt,
    sourceDeviceId: options.source.sourceDeviceId,
    sourceChannel: options.source.sourceChannel,
    sourceWritebackId: writebackId,
    sourceRecordId: options.source.sourceRecordId || options.source.sourcePageKey,
    claimDisputeId,
    claimDisputeNo,
  }

  appendPickupWritebackRecord(record, storage)
  return buildSuccess(writebackId)
}

export function writePdaSpreadingToFcs(options: {
  identity: CuttingPdaWritebackIdentity
  operator: CuttingPdaWritebackOperator
  actionAt?: string
  source: CuttingPdaWritebackSource
  spreadingSessionId?: string
  markerId?: string
  markerNo?: string
  planUnitId: string
  planUnits?: Array<{
    planUnitId: string
    sourceType: 'marker-line' | 'high-low-row' | 'exception'
    sourceLineId: string
    color: string
    materialSku: string
    garmentQtyPerUnit: number
    plannedRepeatCount: number
    lengthPerUnitM: number
    plannedCutGarmentQty: number
    plannedSpreadLengthM: number
  }>
  spreadingMode: 'NORMAL' | 'HIGH_LOW' | 'FOLD_NORMAL' | 'FOLD_HIGH_LOW'
  recordType: '开始铺布' | '中途交接' | '接手继续' | '完成铺布'
  fabricRollNo: string
  rollWritebackItemId?: string
  operatorActionType?: string
  handoverFlag?: boolean
  handoverNote?: string
  handoverToAccountId?: string
  handoverToName?: string
  layerCount: number
  actualLength: number
  headLength: number
  tailLength: number
  note: string
}): CuttingPdaWritebackBridgeResult {
  const issues = validateIdentity(options.identity)
  const actionAt = options.actionAt || nowText()
  const writebackId = buildWritebackId('SPREADING_RECORD', options.identity, actionAt)
  if (issues.length) return buildFailure(issues, writebackId)
  if (!options.planUnitId.trim()) return buildFailure(['当前铺布记录必须绑定计划单元。'], writebackId)
  if (!options.fabricRollNo.trim()) return buildFailure(['当前铺布记录必须填写卷号。'], writebackId)

  const storage = getPdaCuttingWritebackStorage()
  if (!storage) return buildFailure(['当前环境不支持写入工艺工厂铺布 ledger。'], writebackId)

  const submittedAt = actionAt
  const compactTimestamp = submittedAt.replace(/[^0-9]/g, '').slice(0, 14)
  const rollWritebackItemId = options.rollWritebackItemId || `${writebackId}-roll-1`
  const writeback = normalizePdaWritebackPayload({
    writebackId,
    writebackNo: `PDA-WB-${options.identity.taskNo}-${compactTimestamp}`,
    sourceAccountId: options.operator.operatorAccountId,
    sourceAccountName: options.operator.operatorName,
    sourceDeviceId: options.source.sourceDeviceId,
    submittedAt,
    occurredAt: submittedAt,
    contextType: options.identity.mergeBatchId || options.identity.mergeBatchNo ? 'merge-batch' : 'original-order',
    spreadingSessionId: options.spreadingSessionId || '',
    markerId: options.markerId || '',
    markerNo: options.markerNo || '',
    spreadingMode: options.spreadingMode,
    recordType: options.recordType,
    originalCutOrderIds: [options.identity.originalCutOrderId],
    originalCutOrderNos: [options.identity.originalCutOrderNo],
    mergeBatchId: options.identity.mergeBatchId || '',
    mergeBatchNo: options.identity.mergeBatchNo || '',
    productionOrderNos: [options.identity.productionOrderNo],
    styleCode: options.identity.styleCode || '',
    spuCode: options.identity.spuCode || '',
    note: options.note,
    planUnits: Array.isArray(options.planUnits) ? options.planUnits : [],
    rollItems: [
      {
        rollWritebackItemId,
        writebackId,
        planUnitId: options.planUnitId,
        rollNo: options.fabricRollNo,
        materialSku: options.planUnits?.find((item) => item.planUnitId === options.planUnitId)?.materialSku || options.identity.materialSku,
        color: options.planUnits?.find((item) => item.planUnitId === options.planUnitId)?.color || '',
        width: 0,
        labeledLength: options.actualLength,
        actualSpreadLengthM: options.actualLength,
        headLossM: options.headLength,
        tailLossM: options.tailLength,
        spreadLayerCount: options.layerCount,
        actualLength: options.actualLength,
        headLength: options.headLength,
        tailLength: options.tailLength,
        layerCount: options.layerCount,
        usableLength: Math.max(options.actualLength - options.headLength - options.tailLength, 0),
        note: options.note,
      },
    ],
    operatorItems: [
      {
        operatorWritebackItemId: `${writebackId}-operator-1`,
        writebackId,
        rollWritebackItemId,
        operatorAccountId: options.operator.operatorAccountId,
        operatorName: options.operator.operatorName,
        startAt: submittedAt,
        endAt: submittedAt,
        actionType: options.operatorActionType || '铺布录入',
        handoverFlag: Boolean(options.handoverFlag),
        handoverToAccountId: options.handoverToAccountId || '',
        handoverToName: options.handoverToName || '',
        note: [options.note, options.handoverNote].filter(Boolean).join('；'),
      },
    ],
  })

  const markerStore = deserializeMarkerSpreadingStorage(storage.getItem(CUTTING_MARKER_SPREADING_LEDGER_STORAGE_KEY))
  const applyResult = applyWritebackToSpreadingSession({
    writeback,
    store: markerStore.sessions.length || markerStore.markers.length ? markerStore : createEmptyMarkerSpreadingStore(),
    appliedBy: options.operator.operatorName,
  })
  if (!applyResult.applied) {
    return {
      success: false,
      issues: applyResult.warningMessages.length ? applyResult.warningMessages : ['铺布记录未写入工艺工厂铺布模型层。'],
      warningMessages: applyResult.warningMessages,
      writebackId,
    }
  }

  storage.setItem(CUTTING_MARKER_SPREADING_LEDGER_STORAGE_KEY, serializeMarkerSpreadingStorage(applyResult.nextStore))

  const inbox = hydrateIncomingPdaWritebacks(storage)
  const appliedWriteback = normalizePdaWritebackPayload({
    ...writeback,
    status: 'APPLIED',
    appliedSessionId: applyResult.updatedSessionId || applyResult.createdSessionId,
    appliedAt: submittedAt,
    appliedBy: options.operator.operatorName,
    warningMessages: applyResult.warningMessages,
  })
  const nextInbox = {
    writebacks: [appliedWriteback, ...inbox.writebacks.filter((item) => item.writebackId !== writeback.writebackId)],
    auditTrails: [buildSpreadingAuditTrail(appliedWriteback, appliedWriteback.appliedSessionId, options.operator.operatorName), ...inbox.auditTrails],
  }
  storage.setItem(CUTTING_PDA_WRITEBACK_STORAGE_KEY, serializePdaWritebackStorage(nextInbox))

  return buildSuccess(writebackId, applyResult.warningMessages)
}

export function writePdaInboundToFcs(options: {
  identity: CuttingPdaWritebackIdentity
  operator: CuttingPdaWritebackOperator
  actionAt?: string
  source: CuttingPdaWritebackSource
  zoneCode: 'A' | 'B' | 'C'
  locationLabel: string
  note: string
}): CuttingPdaWritebackBridgeResult {
  const issues = validateIdentity(options.identity)
  const actionAt = options.actionAt || nowText()
  const writebackId = buildWritebackId('INBOUND_CONFIRM', options.identity, actionAt)
  if (issues.length) return buildFailure(issues, writebackId)
  const storage = getPdaCuttingWritebackStorage()
  if (!storage) return buildFailure(['当前环境不支持持久化工艺工厂入仓写回结果。'], writebackId)

  const record: PdaCutPieceInboundWritebackRecord = {
    writebackId,
    actionType: 'INBOUND_CONFIRM',
    actionAt,
    taskId: options.identity.taskId,
    taskNo: options.identity.taskNo,
    executionOrderId: options.identity.executionOrderId,
    executionOrderNo: options.identity.executionOrderNo,
    legacyCutPieceOrderNo: options.identity.legacyCutPieceOrderNo,
    productionOrderId: options.identity.productionOrderId,
    productionOrderNo: options.identity.productionOrderNo,
    originalCutOrderId: options.identity.originalCutOrderId,
    originalCutOrderNo: options.identity.originalCutOrderNo,
    mergeBatchId: options.identity.mergeBatchId || '',
    mergeBatchNo: options.identity.mergeBatchNo || '',
    cutPieceOrderNo: options.identity.cutPieceOrderNo,
    materialSku: options.identity.materialSku,
    zoneCode: options.zoneCode,
    locationLabel: options.locationLabel,
    operatorAccountId: options.operator.operatorAccountId,
    operatorName: options.operator.operatorName,
    operatorRole: options.operator.operatorRole,
    operatorFactoryId: options.operator.operatorFactoryId,
    operatorFactoryName: options.operator.operatorFactoryName,
    note: options.note,
    submittedAt: actionAt,
    sourceDeviceId: options.source.sourceDeviceId,
    sourceChannel: options.source.sourceChannel,
    sourceWritebackId: writebackId,
    sourceRecordId: options.source.sourceRecordId || options.source.sourcePageKey,
  }

  appendInboundWritebackRecord(record, storage)
  return buildSuccess(writebackId)
}

export function writePdaHandoverToFcs(options: {
  identity: CuttingPdaWritebackIdentity
  operator: CuttingPdaWritebackOperator
  actionAt?: string
  source: CuttingPdaWritebackSource
  targetLabel: string
  note: string
}): CuttingPdaWritebackBridgeResult {
  const issues = validateIdentity(options.identity)
  const actionAt = options.actionAt || nowText()
  const writebackId = buildWritebackId('HANDOVER_CONFIRM', options.identity, actionAt)
  if (issues.length) return buildFailure(issues, writebackId)
  const storage = getPdaCuttingWritebackStorage()
  if (!storage) return buildFailure(['当前环境不支持持久化工艺工厂交接写回结果。'], writebackId)

  const record: PdaCutPieceHandoverWritebackRecord = {
    writebackId,
    actionType: 'HANDOVER_CONFIRM',
    actionAt,
    taskId: options.identity.taskId,
    taskNo: options.identity.taskNo,
    executionOrderId: options.identity.executionOrderId,
    executionOrderNo: options.identity.executionOrderNo,
    legacyCutPieceOrderNo: options.identity.legacyCutPieceOrderNo,
    productionOrderId: options.identity.productionOrderId,
    productionOrderNo: options.identity.productionOrderNo,
    originalCutOrderId: options.identity.originalCutOrderId,
    originalCutOrderNo: options.identity.originalCutOrderNo,
    mergeBatchId: options.identity.mergeBatchId || '',
    mergeBatchNo: options.identity.mergeBatchNo || '',
    cutPieceOrderNo: options.identity.cutPieceOrderNo,
    materialSku: options.identity.materialSku,
    targetLabel: options.targetLabel,
    operatorAccountId: options.operator.operatorAccountId,
    operatorName: options.operator.operatorName,
    operatorRole: options.operator.operatorRole,
    operatorFactoryId: options.operator.operatorFactoryId,
    operatorFactoryName: options.operator.operatorFactoryName,
    note: options.note,
    submittedAt: actionAt,
    sourceDeviceId: options.source.sourceDeviceId,
    sourceChannel: options.source.sourceChannel,
    sourceWritebackId: writebackId,
    sourceRecordId: options.source.sourceRecordId || options.source.sourcePageKey,
  }

  appendHandoverWritebackRecord(record, storage)
  return buildSuccess(writebackId)
}

export function writePdaReplenishmentFeedbackToFcs(options: {
  identity: CuttingPdaWritebackIdentity
  operator: CuttingPdaWritebackOperator
  actionAt?: string
  source: CuttingPdaWritebackSource
  reasonLabel: string
  note: string
  photoProofCount: number
}): CuttingPdaWritebackBridgeResult {
  const issues = validateIdentity(options.identity)
  const actionAt = options.actionAt || nowText()
  const writebackId = buildWritebackId('REPLENISHMENT_FEEDBACK', options.identity, actionAt)
  if (issues.length) return buildFailure(issues, writebackId)
  const storage = getPdaCuttingWritebackStorage()
  if (!storage) return buildFailure(['当前环境不支持持久化工艺工厂补料反馈写回结果。'], writebackId)

  const record: PdaReplenishmentFeedbackWritebackRecord = {
    writebackId,
    actionType: 'REPLENISHMENT_FEEDBACK',
    actionAt,
    taskId: options.identity.taskId,
    taskNo: options.identity.taskNo,
    executionOrderId: options.identity.executionOrderId,
    executionOrderNo: options.identity.executionOrderNo,
    legacyCutPieceOrderNo: options.identity.legacyCutPieceOrderNo,
    productionOrderId: options.identity.productionOrderId,
    productionOrderNo: options.identity.productionOrderNo,
    originalCutOrderId: options.identity.originalCutOrderId,
    originalCutOrderNo: options.identity.originalCutOrderNo,
    mergeBatchId: options.identity.mergeBatchId || '',
    mergeBatchNo: options.identity.mergeBatchNo || '',
    cutPieceOrderNo: options.identity.cutPieceOrderNo,
    materialSku: options.identity.materialSku,
    reasonLabel: options.reasonLabel,
    note: options.note,
    photoProofCount: options.photoProofCount,
    operatorAccountId: options.operator.operatorAccountId,
    operatorName: options.operator.operatorName,
    operatorRole: options.operator.operatorRole,
    operatorFactoryId: options.operator.operatorFactoryId,
    operatorFactoryName: options.operator.operatorFactoryName,
    submittedAt: actionAt,
    sourceDeviceId: options.source.sourceDeviceId,
    sourceChannel: options.source.sourceChannel,
    sourceWritebackId: writebackId,
    sourceRecordId: options.source.sourceRecordId || options.source.sourcePageKey,
  }

  appendReplenishmentFeedbackWritebackRecord(record, storage)
  return buildSuccess(writebackId)
}
