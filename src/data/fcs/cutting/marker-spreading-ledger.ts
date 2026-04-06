import {
  buildSpreadingTraceAnchors,
  deriveSpreadingSupervisorStage,
  type SpreadingSession,
  type SpreadingSourceChannel,
} from '../../../pages/process-factory/cutting/marker-spreading-model.ts'
import { readMarkerSpreadingPrototypeData } from '../../../pages/process-factory/cutting/marker-spreading-utils.ts'
import { listGeneratedOriginalCutOrderSourceRecords } from './generated-original-cut-orders.ts'
import { buildSpreadingDrivenFeiTicketTraceMatrix, listGeneratedFeiTickets } from './generated-fei-tickets.ts'
import { buildReplenishmentFlowTraceMatrix } from './replenishment.ts'
import {
  buildSpreadingDrivenTransferBagTraceMatrix,
  buildSystemSeedTransferBagRuntime,
} from './transfer-bag-runtime.ts'
import { buildSpreadingDrivenWarehouseTraceMatrix } from './warehouse-runtime.ts'

export {
  CUTTING_MARKER_SPREADING_LEDGER_STORAGE_KEY,
  buildSpreadingTraceAnchors,
  buildReplenishmentPreview,
  createEmptyStore,
  deserializeMarkerSpreadingStorage,
  serializeMarkerSpreadingStorage,
  upsertSpreadingSession,
  type MarkerSpreadingContext,
  type MarkerSpreadingStore,
  type SpreadingOperatorRecord,
  type SpreadingRollRecord,
  type SpreadingSession,
  type SpreadingSourceChannel,
  type SpreadingTraceAnchor,
} from '../../../pages/process-factory/cutting/marker-spreading-model.ts'

export { readMarkerSpreadingPrototypeData } from '../../../pages/process-factory/cutting/marker-spreading-utils.ts'

export interface CuttingSpreadingFlowMatrixRow {
  spreadingSessionId: string
  sessionNo: string
  contextType: 'original-order' | 'merge-batch'
  stageKey:
    | 'WAITING_START'
    | 'IN_PROGRESS'
    | 'WAITING_REPLENISHMENT'
    | 'WAITING_FEI_TICKET'
    | 'WAITING_BAGGING'
    | 'WAITING_WAREHOUSE'
    | 'DONE'
  stageLabel: string
  spreadingMode: SpreadingSession['spreadingMode']
  sourceChannel: SpreadingSourceChannel
  sourceWritebackId: string
  sourceMarkerId: string
  sourceMarkerNo: string
  originalCutOrderIds: string[]
  originalCutOrderNos: string[]
  mergeBatchId: string
  mergeBatchNo: string
  replenishmentRequestId: string
  pendingPrepFollowupId: string
  feiTicketId: string
  bagId: string
  transferBatchId: string
  warehouseRecordId: string
  planUnitId: string
  rollRecordId: string
  operatorRecordId: string
  planUnitIds: string[]
  rollRecordIds: string[]
  operatorRecordIds: string[]
  availableFeiTicketIds: string[]
  availableBagIds: string[]
  availableTransferBatchIds: string[]
  availableWarehouseRecordIds: string[]
}

function uniqueStrings(values: Array<string | undefined | null>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))))
}

function buildSeedTransferBagStore() {
  const originalRows = listGeneratedOriginalCutOrderSourceRecords()
  const feiTraceRows = buildSpreadingDrivenFeiTicketTraceMatrix()
  const feiTraceById = new Map(feiTraceRows.map((row) => [row.feiTicketId, row] as const))

  return buildSystemSeedTransferBagRuntime({
    originalRows: originalRows.map((record) => ({
      originalCutOrderId: record.originalCutOrderId,
      originalCutOrderNo: record.originalCutOrderNo,
      productionOrderNo: record.productionOrderNo,
      styleCode: '',
      spuCode: record.sourceTechPackSpuCode || '',
      color: record.colorScope[0] || '',
      materialSku: record.materialSku,
      plannedQty: record.requiredQty,
    })),
    ticketRecords: listGeneratedFeiTickets()
      .filter((record) => Boolean(record.sourceSpreadingSessionId))
      .map((record) => {
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
          styleCode: '',
          spuCode: record.sourceTechPackSpuCode || '',
          color: record.skuColor,
          size: record.skuSize,
          partName: record.partName,
          qty: record.garmentQty,
          materialSku: record.materialSku,
          sourceContextType: record.sourceMergeBatchId ? 'merge-batch' : 'original-order',
          status: 'PRINTED' as const,
        }
      }),
  })
}

function resolveSessionStageKey(session: SpreadingSession, options: { hasFeiTicket: boolean; hasBagging: boolean; hasWarehouse: boolean }) {
  const lifecycleOverrides = session.prototypeLifecycleOverrides || null
  const pendingReplenishmentConfirmation =
    lifecycleOverrides?.replenishmentStatusLabel === '待补料确认'
    || Boolean(session.replenishmentWarning && session.replenishmentWarning.suggestedAction !== '无需补料' && !session.replenishmentWarning.handled)
  const feiTicketReady =
    lifecycleOverrides?.feiTicketStatusLabel
      ? lifecycleOverrides.feiTicketStatusLabel === '已打印菲票'
      : options.hasFeiTicket
  const baggingReady =
    lifecycleOverrides?.baggingStatusLabel
      ? lifecycleOverrides.baggingStatusLabel === '已装袋'
      : options.hasBagging
  const warehouseReady =
    lifecycleOverrides?.warehouseStatusLabel
      ? lifecycleOverrides.warehouseStatusLabel === '已入仓'
      : options.hasWarehouse

  return deriveSpreadingSupervisorStage({
    status: session.status,
    pendingReplenishmentConfirmation,
    feiTicketReady,
    baggingReady,
    warehouseReady,
  }).key
}

function gateDownstreamAnchorsByStage(
  stageKey: CuttingSpreadingFlowMatrixRow['stageKey'],
  anchors: {
    feiTicketIds: string[]
    bagIds: string[]
    transferBatchIds: string[]
    warehouseRecordIds: string[]
  },
) {
  if (stageKey === 'WAITING_START' || stageKey === 'IN_PROGRESS' || stageKey === 'WAITING_REPLENISHMENT') {
    return {
      feiTicketId: '',
      bagId: '',
      transferBatchId: '',
      warehouseRecordId: '',
    }
  }
  if (stageKey === 'WAITING_FEI_TICKET') {
    return {
      feiTicketId: '',
      bagId: '',
      transferBatchId: '',
      warehouseRecordId: '',
    }
  }
  if (stageKey === 'WAITING_BAGGING') {
    return {
      feiTicketId: anchors.feiTicketIds[0] || '',
      bagId: '',
      transferBatchId: '',
      warehouseRecordId: '',
    }
  }
  if (stageKey === 'WAITING_WAREHOUSE') {
    return {
      feiTicketId: anchors.feiTicketIds[0] || '',
      bagId: anchors.bagIds[0] || '',
      transferBatchId: anchors.transferBatchIds[0] || '',
      warehouseRecordId: '',
    }
  }
  return {
    feiTicketId: anchors.feiTicketIds[0] || '',
    bagId: anchors.bagIds[0] || '',
    transferBatchId: anchors.transferBatchIds[0] || '',
    warehouseRecordId: anchors.warehouseRecordIds[0] || '',
  }
}

export function buildCuttingSpreadingFlowMatrix(): CuttingSpreadingFlowMatrixRow[] {
  const prototypeData = readMarkerSpreadingPrototypeData()
  const anchors = buildSpreadingTraceAnchors(prototypeData.store)
  const anchorBySessionId = new Map(anchors.map((item) => [item.spreadingSessionId, item] as const))
  const replenishmentRows = buildReplenishmentFlowTraceMatrix()
  const replenishmentRowsBySessionId = replenishmentRows.reduce<Record<string, typeof replenishmentRows>>((acc, row) => {
    if (!row.sourceSpreadingSessionId) return acc
    if (!acc[row.sourceSpreadingSessionId]) acc[row.sourceSpreadingSessionId] = []
    acc[row.sourceSpreadingSessionId].push(row)
    return acc
  }, {})
  const feiRows = buildSpreadingDrivenFeiTicketTraceMatrix()
  const feiRowsBySessionId = feiRows.reduce<Record<string, typeof feiRows>>((acc, row) => {
    if (!row.sourceSpreadingSessionId) return acc
    if (!acc[row.sourceSpreadingSessionId]) acc[row.sourceSpreadingSessionId] = []
    acc[row.sourceSpreadingSessionId].push(row)
    return acc
  }, {})
  const transferRows = buildSpreadingDrivenTransferBagTraceMatrix(buildSeedTransferBagStore())
  const transferRowsBySessionId = transferRows.reduce<Record<string, typeof transferRows>>((acc, row) => {
    if (!row.sourceSpreadingSessionId) return acc
    if (!acc[row.sourceSpreadingSessionId]) acc[row.sourceSpreadingSessionId] = []
    acc[row.sourceSpreadingSessionId].push(row)
    return acc
  }, {})
  const warehouseRows = buildSpreadingDrivenWarehouseTraceMatrix()
  const warehouseRowsBySessionId = warehouseRows.reduce<Record<string, typeof warehouseRows>>((acc, row) => {
    if (!row.spreadingSessionId) return acc
    if (!acc[row.spreadingSessionId]) acc[row.spreadingSessionId] = []
    acc[row.spreadingSessionId].push(row)
    return acc
  }, {})

  return prototypeData.store.sessions
    .map((session) => {
      const anchor = anchorBySessionId.get(session.spreadingSessionId) || null
      const replenishment = replenishmentRowsBySessionId[session.spreadingSessionId] || []
      const fei = feiRowsBySessionId[session.spreadingSessionId] || []
      const transfer = transferRowsBySessionId[session.spreadingSessionId] || []
      const warehouse =
        warehouseRowsBySessionId[session.spreadingSessionId]?.length
          ? warehouseRowsBySessionId[session.spreadingSessionId] || []
          : warehouseRows.filter(
              (item) =>
                session.originalCutOrderIds.includes(item.originalCutOrderId)
                || Boolean(session.mergeBatchId && item.mergeBatchId && item.mergeBatchId === session.mergeBatchId),
            )
      const stageKey = resolveSessionStageKey(session, {
        hasFeiTicket: fei.length > 0,
        hasBagging: transfer.length > 0,
        hasWarehouse: warehouse.length > 0,
      })
      const stageLabel = deriveSpreadingSupervisorStage({
        status: session.status,
        pendingReplenishmentConfirmation: stageKey === 'WAITING_REPLENISHMENT',
        feiTicketReady: !['WAITING_FEI_TICKET', 'WAITING_REPLENISHMENT', 'WAITING_START', 'IN_PROGRESS'].includes(stageKey),
        baggingReady: ['WAITING_WAREHOUSE', 'DONE'].includes(stageKey),
        warehouseReady: stageKey === 'DONE',
      }).label
      const availableFeiTicketIds = uniqueStrings(fei.map((item) => item.feiTicketId))
      const availableBagIds = uniqueStrings(transfer.map((item) => item.bagId))
      const availableTransferBatchIds = uniqueStrings(transfer.map((item) => item.transferBatchId))
      const availableWarehouseRecordIds = uniqueStrings(warehouse.map((item) => item.warehouseRecordId))
      const gatedAnchors = gateDownstreamAnchorsByStage(stageKey, {
        feiTicketIds: availableFeiTicketIds,
        bagIds: availableBagIds,
        transferBatchIds: availableTransferBatchIds,
        warehouseRecordIds: availableWarehouseRecordIds,
      })
      const pendingRows = replenishment.filter((item) => !item.pendingPrepFollowupId && item.reviewStatus !== 'REJECTED')
      const approvedRows = replenishment.filter((item) => Boolean(item.pendingPrepFollowupId))
      const planUnitIds = uniqueStrings(session.rolls.map((item) => item.planUnitId))
      const rollRecordIds = uniqueStrings(session.rolls.map((item) => item.rollRecordId))
      const operatorRecordIds = uniqueStrings(session.operators.map((item) => item.operatorRecordId))
      const fallbackReplenishmentRequestId =
        stageKey === 'WAITING_REPLENISHMENT' && session.replenishmentWarning && !session.replenishmentWarning.handled
          ? session.replenishmentWarning.warningId
          : ''

      return {
        spreadingSessionId: session.spreadingSessionId,
        sessionNo: session.sessionNo || session.spreadingSessionId,
        contextType: session.contextType,
        stageKey,
        stageLabel,
        spreadingMode: session.spreadingMode,
        sourceChannel: session.sourceChannel,
        sourceWritebackId: anchor?.sourceWritebackId || session.sourceWritebackId || '',
        sourceMarkerId:
          session.sourceMarkerId
          || session.markerId
          || transfer[0]?.sourceMarkerId
          || warehouse[0]?.sourceMarkerId
          || fei[0]?.sourceMarkerId
          || '',
        sourceMarkerNo:
          session.sourceMarkerNo
          || session.markerNo
          || transfer[0]?.sourceMarkerNo
          || warehouse[0]?.sourceMarkerNo
          || fei[0]?.sourceMarkerNo
          || '',
        originalCutOrderIds: uniqueStrings([
          ...session.originalCutOrderIds,
          ...replenishment.map((item) => item.originalCutOrderId),
          ...fei.map((item) => item.originalCutOrderId),
          ...transfer.map((item) => item.originalCutOrderId),
          ...warehouse.map((item) => item.originalCutOrderId),
        ]),
        originalCutOrderNos: uniqueStrings([
          ...(anchor?.originalCutOrderNos || []),
          ...replenishment.map((item) => item.originalCutOrderNo),
          ...fei.map((item) => item.originalCutOrderNo),
          ...transfer.map((item) => item.originalCutOrderNo),
          ...warehouse.map((item) => item.originalCutOrderNo),
        ]),
        mergeBatchId: session.mergeBatchId || replenishment[0]?.mergeBatchId || '',
        mergeBatchNo: session.mergeBatchNo || replenishment[0]?.mergeBatchNo || '',
        replenishmentRequestId:
          (stageKey === 'WAITING_REPLENISHMENT' ? pendingRows[0] : pendingRows[0] || approvedRows[0])?.replenishmentRequestId
          || fallbackReplenishmentRequestId,
        pendingPrepFollowupId: approvedRows[0]?.pendingPrepFollowupId || '',
        feiTicketId: gatedAnchors.feiTicketId,
        bagId: gatedAnchors.bagId,
        transferBatchId: gatedAnchors.transferBatchId,
        warehouseRecordId: gatedAnchors.warehouseRecordId,
        planUnitId: planUnitIds[0] || '',
        rollRecordId: rollRecordIds[0] || '',
        operatorRecordId: operatorRecordIds[0] || '',
        planUnitIds,
        rollRecordIds,
        operatorRecordIds,
        availableFeiTicketIds,
        availableBagIds,
        availableTransferBatchIds,
        availableWarehouseRecordIds,
      }
    })
    .sort(
      (left, right) =>
        left.sessionNo.localeCompare(right.sessionNo, 'zh-CN')
        || left.spreadingSessionId.localeCompare(right.spreadingSessionId, 'zh-CN'),
    )
}
