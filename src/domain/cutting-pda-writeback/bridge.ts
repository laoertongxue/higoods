import {
  appendHandoverWritebackRecord,
  appendInboundWritebackRecord,
  appendPickupWritebackRecord,
  appendReplenishmentFeedbackWritebackRecord,
  type PdaCutPieceHandoverWritebackRecord,
  type PdaCutPieceInboundWritebackRecord,
  type PdaPickupWritebackRecord,
  type PdaReplenishmentFeedbackWritebackRecord,
} from '../../pages/process-factory/cutting/pda-execution-writeback-model'
import {
  applyWritebackToSpreadingSession,
  hydrateIncomingPdaWritebacks,
  normalizePdaWritebackPayload,
  serializePdaWritebackStorage,
  type PdaSpreadingWriteback,
  type PdaWritebackAuditTrail,
} from '../../pages/process-factory/cutting/pda-writeback-model'
import {
  CUTTING_MARKER_SPREADING_LEDGER_STORAGE_KEY,
  createEmptyStore as createEmptyMarkerSpreadingStore,
  deserializeMarkerSpreadingStorage,
  serializeMarkerSpreadingStorage,
} from '../../pages/process-factory/cutting/marker-spreading-model'
import {
  getLatestClaimDisputeByOriginalCutOrderNo,
  markClaimDisputeCraftWrittenBack,
} from '../../state/fcs-claim-dispute-store'
import {
  resolveMergeBatchRef,
  resolveOriginalCutOrderRef,
  resolveProductionOrderRef,
} from '../cutting-identity'
import { CUTTING_PDA_WRITEBACK_STORAGE_KEY } from '../../pages/process-factory/cutting/pda-writeback-model'

export interface CuttingPdaWritebackIdentity {
  taskId: string
  taskNo: string
  productionOrderId: string
  productionOrderNo: string
  originalCutOrderId: string
  originalCutOrderNo: string
  mergeBatchId?: string
  mergeBatchNo?: string
  cutPieceOrderNo: string
  materialSku: string
  styleCode?: string
  spuCode?: string
}

export interface CuttingPdaWritebackBridgeResult {
  success: boolean
  issues: string[]
  warningMessages: string[]
  writebackId: string
}

interface BridgeStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

function getStorage(): BridgeStorage | null {
  return typeof localStorage === 'undefined' ? null : localStorage
}

function nowText(date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function createWritebackId(prefix: string, identity: CuttingPdaWritebackIdentity): string {
  return [
    prefix,
    identity.taskId,
    identity.originalCutOrderId || identity.originalCutOrderNo,
    identity.cutPieceOrderNo,
    `${Date.now()}`,
  ].join('-')
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
  if (!identity.cutPieceOrderNo.trim()) issues.push('缺少 PDA 裁片单执行对象标识。')
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
  operatorName: string
  resultLabel: string
  actualReceivedQtyText: string
  discrepancyNote: string
  photoProofCount: number
  claimDisputeId?: string
  claimDisputeNo?: string
  sourceRecordId?: string
}): CuttingPdaWritebackBridgeResult {
  const issues = validateIdentity(options.identity)
  const writebackId = createWritebackId('pickup', options.identity)
  if (issues.length) return buildFailure(issues, writebackId)
  const storage = getStorage()
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
    cutPieceOrderNo: options.identity.cutPieceOrderNo,
    materialSku: options.identity.materialSku,
    resultLabel: options.resultLabel,
    actualReceivedQtyText: options.actualReceivedQtyText,
    discrepancyNote: options.discrepancyNote,
    photoProofCount: options.photoProofCount,
    operatorName: options.operatorName,
    submittedAt: nowText(),
    sourceChannel: 'PDA',
    sourceWritebackId: writebackId,
    sourceRecordId: options.sourceRecordId || '',
    claimDisputeId,
    claimDisputeNo,
  }

  appendPickupWritebackRecord(record, storage)
  return buildSuccess(writebackId)
}

export function writePdaSpreadingToFcs(options: {
  identity: CuttingPdaWritebackIdentity
  operatorName: string
  fabricRollNo: string
  layerCount: number
  actualLength: number
  headLength: number
  tailLength: number
  note: string
}): CuttingPdaWritebackBridgeResult {
  const issues = validateIdentity(options.identity)
  const writebackId = createWritebackId('spreading', options.identity)
  if (issues.length) return buildFailure(issues, writebackId)

  const storage = getStorage()
  if (!storage) return buildFailure(['当前环境不支持写入工艺工厂铺布 ledger。'], writebackId)

  const submittedAt = nowText()
  const writeback = normalizePdaWritebackPayload({
    writebackId,
    writebackNo: `PDA-WB-${options.identity.taskNo}-${Date.now()}`,
    sourceAccountId: options.operatorName,
    sourceAccountName: options.operatorName,
    sourceDeviceId: 'PDA-CUTTING',
    submittedAt,
    contextType: options.identity.mergeBatchId || options.identity.mergeBatchNo ? 'merge-batch' : 'original-order',
    originalCutOrderIds: [options.identity.originalCutOrderId],
    originalCutOrderNos: [options.identity.originalCutOrderNo],
    mergeBatchId: options.identity.mergeBatchId || '',
    mergeBatchNo: options.identity.mergeBatchNo || '',
    productionOrderNos: [options.identity.productionOrderNo],
    styleCode: options.identity.styleCode || '',
    spuCode: options.identity.spuCode || '',
    note: options.note,
    rollItems: [
      {
        rollWritebackItemId: `${writebackId}-roll-1`,
        writebackId,
        rollNo: options.fabricRollNo,
        materialSku: options.identity.materialSku,
        width: 0,
        labeledLength: options.actualLength,
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
        operatorAccountId: options.operatorName,
        operatorName: options.operatorName,
        startAt: submittedAt,
        endAt: submittedAt,
        actionType: '铺布录入',
        handoverFlag: false,
        note: options.note,
      },
    ],
  })

  const markerStore = deserializeMarkerSpreadingStorage(storage.getItem(CUTTING_MARKER_SPREADING_LEDGER_STORAGE_KEY))
  const applyResult = applyWritebackToSpreadingSession({
    writeback,
    store: markerStore.sessions.length || markerStore.markers.length ? markerStore : createEmptyMarkerSpreadingStore(),
    appliedBy: options.operatorName,
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
    appliedBy: options.operatorName,
    warningMessages: applyResult.warningMessages,
  })
  const nextInbox = {
    writebacks: [appliedWriteback, ...inbox.writebacks.filter((item) => item.writebackId !== writeback.writebackId)],
    auditTrails: [buildSpreadingAuditTrail(appliedWriteback, appliedWriteback.appliedSessionId, options.operatorName), ...inbox.auditTrails],
  }
  storage.setItem(CUTTING_PDA_WRITEBACK_STORAGE_KEY, serializePdaWritebackStorage(nextInbox))

  return buildSuccess(writebackId, applyResult.warningMessages)
}

export function writePdaInboundToFcs(options: {
  identity: CuttingPdaWritebackIdentity
  operatorName: string
  zoneCode: 'A' | 'B' | 'C'
  locationLabel: string
  note: string
  sourceRecordId?: string
}): CuttingPdaWritebackBridgeResult {
  const issues = validateIdentity(options.identity)
  const writebackId = createWritebackId('inbound', options.identity)
  if (issues.length) return buildFailure(issues, writebackId)
  const storage = getStorage()
  if (!storage) return buildFailure(['当前环境不支持持久化工艺工厂入仓写回结果。'], writebackId)

  const record: PdaCutPieceInboundWritebackRecord = {
    writebackId,
    taskId: options.identity.taskId,
    taskNo: options.identity.taskNo,
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
    operatorName: options.operatorName,
    note: options.note,
    submittedAt: nowText(),
    sourceChannel: 'PDA',
    sourceWritebackId: writebackId,
    sourceRecordId: options.sourceRecordId || '',
  }

  appendInboundWritebackRecord(record, storage)
  return buildSuccess(writebackId)
}

export function writePdaHandoverToFcs(options: {
  identity: CuttingPdaWritebackIdentity
  operatorName: string
  targetLabel: string
  note: string
  sourceRecordId?: string
}): CuttingPdaWritebackBridgeResult {
  const issues = validateIdentity(options.identity)
  const writebackId = createWritebackId('handover', options.identity)
  if (issues.length) return buildFailure(issues, writebackId)
  const storage = getStorage()
  if (!storage) return buildFailure(['当前环境不支持持久化工艺工厂交接写回结果。'], writebackId)

  const record: PdaCutPieceHandoverWritebackRecord = {
    writebackId,
    taskId: options.identity.taskId,
    taskNo: options.identity.taskNo,
    productionOrderId: options.identity.productionOrderId,
    productionOrderNo: options.identity.productionOrderNo,
    originalCutOrderId: options.identity.originalCutOrderId,
    originalCutOrderNo: options.identity.originalCutOrderNo,
    mergeBatchId: options.identity.mergeBatchId || '',
    mergeBatchNo: options.identity.mergeBatchNo || '',
    cutPieceOrderNo: options.identity.cutPieceOrderNo,
    materialSku: options.identity.materialSku,
    targetLabel: options.targetLabel,
    operatorName: options.operatorName,
    note: options.note,
    submittedAt: nowText(),
    sourceChannel: 'PDA',
    sourceWritebackId: writebackId,
    sourceRecordId: options.sourceRecordId || '',
  }

  appendHandoverWritebackRecord(record, storage)
  return buildSuccess(writebackId)
}

export function writePdaReplenishmentFeedbackToFcs(options: {
  identity: CuttingPdaWritebackIdentity
  operatorName: string
  reasonLabel: string
  note: string
  photoProofCount: number
  sourceRecordId?: string
}): CuttingPdaWritebackBridgeResult {
  const issues = validateIdentity(options.identity)
  const writebackId = createWritebackId('replenishment', options.identity)
  if (issues.length) return buildFailure(issues, writebackId)
  const storage = getStorage()
  if (!storage) return buildFailure(['当前环境不支持持久化工艺工厂补料反馈写回结果。'], writebackId)

  const record: PdaReplenishmentFeedbackWritebackRecord = {
    writebackId,
    taskId: options.identity.taskId,
    taskNo: options.identity.taskNo,
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
    operatorName: options.operatorName,
    submittedAt: nowText(),
    sourceChannel: 'PDA',
    sourceWritebackId: writebackId,
    sourceRecordId: options.sourceRecordId || '',
  }

  appendReplenishmentFeedbackWritebackRecord(record, storage)
  return buildSuccess(writebackId)
}
