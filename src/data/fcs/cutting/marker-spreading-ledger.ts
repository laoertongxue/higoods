import {
  buildSpreadingTraceAnchors,
  deriveSpreadingSupervisorStage,
  type SpreadingSession,
  type SpreadingSourceChannel,
} from '../../../pages/process-factory/cutting/marker-spreading-model.ts'
import { readMarkerSpreadingPrototypeData } from '../../../pages/process-factory/cutting/marker-spreading-utils.ts'
import { listGeneratedCutOrderSourceRecords } from './generated-cut-orders.ts'
import { buildSpreadingDrivenFeiTicketTraceMatrix, listSpreadingResultGeneratedFeiTickets } from './generated-fei-tickets.ts'
import {
  buildSpreadingDrivenTransferBagTraceMatrix,
  buildSystemSeedTransferBagRuntime,
} from './transfer-bag-runtime.ts'
import { buildSpreadingDrivenWarehouseTraceMatrix } from './warehouse-runtime.ts'

export {
  CUTTING_MARKER_SPREADING_LEDGER_STORAGE_KEY,
  buildSpreadingTraceAnchors,
  buildVariancePreview,
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
  contextType: 'cut-order' | 'marker-plan'
  stageKey:
    | 'WAITING_START'
    | 'IN_PROGRESS'
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
  cutOrderIds: string[]
  cutOrderNos: string[]
  markerPlanId: string
  markerPlanNo: string
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
  const cutOrderRows = listGeneratedCutOrderSourceRecords()
  const feiTraceRows = buildSpreadingDrivenFeiTicketTraceMatrix()
  const feiTraceById = new Map(feiTraceRows.map((row) => [row.feiTicketId, row] as const))

  return buildSystemSeedTransferBagRuntime({
    cutOrderRows: cutOrderRows.map((record) => ({
      cutOrderId: record.cutOrderId,
      cutOrderNo: record.cutOrderNo,
      productionOrderNo: record.productionOrderNo,
      styleCode: '',
      spuCode: record.sourceTechPackSpuCode || '',
      color: record.colorScope[0] || '',
      materialSku: record.materialSku,
      plannedQty: record.requiredQty,
    })),
    ticketRecords: listSpreadingResultGeneratedFeiTickets()
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
          cutOrderId: record.cutOrderId,
          cutOrderNo: record.cutOrderNo,
          productionOrderNo: record.productionOrderNo,
          markerPlanNo: record.sourceMarkerPlanNo,
          styleCode: '',
          spuCode: record.sourceTechPackSpuCode || '',
          color: record.skuColor,
          size: record.skuSize,
          partName: record.partName,
          qty: record.garmentQty,
          materialSku: record.materialSku,
          sourceContextType: record.sourceMarkerPlanId ? 'marker-plan' : 'cut-order',
          status: 'PRINTED' as const,
        }
      }),
  })
}

function resolveSessionStageKey(session: SpreadingSession, options: { hasFeiTicket: boolean; hasBagging: boolean; hasWarehouse: boolean }) {
  const lifecycleOverrides = session.prototypeLifecycleOverrides || null
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
    pendingVarianceConfirmation: false,
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
  if (stageKey === 'WAITING_START' || stageKey === 'IN_PROGRESS') {
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
      const fei = feiRowsBySessionId[session.spreadingSessionId] || []
      const transfer = transferRowsBySessionId[session.spreadingSessionId] || []
      const warehouse =
        warehouseRowsBySessionId[session.spreadingSessionId]?.length
          ? warehouseRowsBySessionId[session.spreadingSessionId] || []
          : warehouseRows.filter(
              (item) =>
                session.cutOrderIds.includes(item.cutOrderId)
                || Boolean(session.markerPlanId && item.markerPlanId && item.markerPlanId === session.markerPlanId),
            )
      const stageKey = resolveSessionStageKey(session, {
        hasFeiTicket: fei.length > 0,
        hasBagging: transfer.length > 0,
        hasWarehouse: warehouse.length > 0,
      })
      const stageLabel = deriveSpreadingSupervisorStage({
        status: session.status,
        pendingVarianceConfirmation: false,
        feiTicketReady: !['WAITING_FEI_TICKET', 'WAITING_START', 'IN_PROGRESS'].includes(stageKey),
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
      const planUnitIds = uniqueStrings(session.rolls.map((item) => item.planUnitId))
      const rollRecordIds = uniqueStrings(session.rolls.map((item) => item.rollRecordId))
      const operatorRecordIds = uniqueStrings(session.operators.map((item) => item.operatorRecordId))

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
        cutOrderIds: uniqueStrings([
          ...session.cutOrderIds,
          ...fei.map((item) => item.cutOrderId),
          ...transfer.map((item) => item.cutOrderId),
          ...warehouse.map((item) => item.cutOrderId),
        ]),
        cutOrderNos: uniqueStrings([
          ...(anchor?.cutOrderNos || []),
          ...fei.map((item) => item.cutOrderNo),
          ...transfer.map((item) => item.cutOrderNo),
          ...warehouse.map((item) => item.cutOrderNo),
        ]),
        markerPlanId: session.markerPlanId || '',
        markerPlanNo: session.markerPlanNo || '',
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
