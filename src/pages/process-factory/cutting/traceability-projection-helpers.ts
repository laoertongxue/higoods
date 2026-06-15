import {
  type CuttingDomainSnapshot,
} from '../../../domain/fcs-cutting-runtime/index.ts'
import type { FeiTicketPrintJob, FeiTicketLabelRecord, PrintableUnitViewModel } from './fei-tickets-model.ts'
import {
  buildPrintableUnitViewModel,
  buildSystemSeedFeiTicketLedger,
} from './fei-tickets-model.ts'
import {
  buildBagUsageAuditTrail,
  applyPocketBindingLocksToTicketRecords,
  buildSystemSeedTransferBagStore,
  buildTransferBagViewModel,
  mergeTransferBagStores,
  type TransferBagStore,
  type TransferBagViewModel,
  type TransferBagItemBinding,
  type TransferBagUsage,
} from './transfer-bags-model.ts'
import {
  buildSpreadingTraceAnchors,
  findSpreadingTraceAnchor,
  finalizeSpreadingCompletion,
  type MarkerSpreadingStore,
  type SpreadingTraceAnchor,
  upsertSpreadingSession,
} from './marker-spreading-model.ts'
import { buildMarkerSpreadingPrototypeStore } from './marker-spreading-utils.ts'
import {
  buildTransferBagReturnViewModel,
  type TransferBagReturnViewModel,
} from './transfer-bag-return-model.ts'
import {
  parseCuttingTraceQr,
} from '../../../data/fcs/cutting/qr-codes.ts'
import {
  parseCarrierQrValue,
} from '../../../data/fcs/cutting/transfer-bag-runtime.ts'
import {
  buildExecutionPrepProjectionContext,
} from './execution-prep-projection-helpers.ts'
import { getCuttingRuntimeStorageSignature } from '../../../data/fcs/cutting/runtime-inputs.ts'

export interface CuttingTraceabilityProjectionContext {
  snapshot: CuttingDomainSnapshot
  cutOrderRows: ReturnType<typeof buildExecutionPrepProjectionContext>['sources']['cutOrderRows']
  materialPrepRows: ReturnType<typeof buildExecutionPrepProjectionContext>['sources']['materialPrepRows']
  markerPlanSources: ReturnType<typeof buildExecutionPrepProjectionContext>['sources']['markerPlanSources']
  markerStore: ReturnType<typeof buildExecutionPrepProjectionContext>['sources']['markerStore']
  spreadingStore: MarkerSpreadingStore
  spreadingTraceAnchors: SpreadingTraceAnchor[]
  rawTicketRecords: FeiTicketLabelRecord[]
  ticketRecords: FeiTicketLabelRecord[]
  printJobs: FeiTicketPrintJob[]
  transferBagStore: TransferBagStore
  printableViewModel: PrintableUnitViewModel
  transferBagViewModel: TransferBagViewModel
  transferBagReturnViewModel: TransferBagReturnViewModel
}

let defaultTraceabilityProjectionCache: {
  signature: string
  context: CuttingTraceabilityProjectionContext
} | null = null
const snapshotTraceabilityProjectionCache = new WeakMap<CuttingDomainSnapshot, CuttingTraceabilityProjectionContext>()

function castTicketRecords(input: Array<Record<string, unknown>>): FeiTicketLabelRecord[] {
  return input as unknown as FeiTicketLabelRecord[]
}

function castPrintJobs(input: Array<Record<string, unknown>>): FeiTicketPrintJob[] {
  return input as unknown as FeiTicketPrintJob[]
}

function castTransferBagStore(input: Record<string, unknown>): TransferBagStore {
  return input as unknown as TransferBagStore
}

function mergeTicketRecords(seed: FeiTicketLabelRecord[], stored: FeiTicketLabelRecord[]): FeiTicketLabelRecord[] {
  const merged = new Map(seed.map((record) => [record.ticketRecordId, record]))
  stored.forEach((record) => merged.set(record.ticketRecordId, record))
  return Array.from(merged.values()).sort((left, right) => {
    if (left.cutOrderNo !== right.cutOrderNo) {
      return left.cutOrderNo.localeCompare(right.cutOrderNo, 'zh-CN')
    }
    if (left.sequenceNo !== right.sequenceNo) return left.sequenceNo - right.sequenceNo
    const leftVersion = left.version ?? left.reprintCount + 1
    const rightVersion = right.version ?? right.reprintCount + 1
    return leftVersion - rightVersion
  })
}

function mergePrintJobs(seed: FeiTicketPrintJob[], stored: FeiTicketPrintJob[]): FeiTicketPrintJob[] {
  const merged = new Map(seed.map((job) => [job.printJobId, job]))
  stored.forEach((job) => merged.set(job.printJobId, job))
  return Array.from(merged.values()).sort((left, right) => right.printedAt.localeCompare(left.printedAt, 'zh-CN'))
}

function uniqueStrings(values: Array<string | undefined | null>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))))
}

function sanitizeTraceabilityId(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'trace'
}

function resolveTraceabilitySessionColors(session: MarkerSpreadingStore['sessions'][number], materialPrepRows: CuttingTraceabilityProjectionContext['materialPrepRows']): string[] {
  const rollColors = session.rolls.map((item) => item.color).filter(Boolean)
  if (rollColors.length) return uniqueStrings(rollColors)
  const contextColors = materialPrepRows
    .filter((row) => session.cutOrderIds.includes(row.cutOrderId))
    .map((row) => row.color)
  return uniqueStrings(contextColors)
}

function buildTraceabilitySpreadingContext(
  session: MarkerSpreadingStore['sessions'][number],
  materialPrepRows: CuttingTraceabilityProjectionContext['materialPrepRows'],
  markerPlanSources: CuttingTraceabilityProjectionContext['markerPlanSources'],
) {
  const relatedRows = materialPrepRows.filter((row) => session.cutOrderIds.includes(row.cutOrderId))
  const batch =
    (session.markerPlanId
      ? markerPlanSources.find((item) => item.markerPlanId === session.markerPlanId)
      : markerPlanSources.find((item) => item.markerPlanNo === session.markerPlanNo)) || null
  if (!relatedRows.length && !batch) return null

  return {
    contextType: session.contextType,
    cutOrderIds: [...session.cutOrderIds],
    cutOrderNos: relatedRows.map((row) => row.cutOrderNo),
    markerPlanId: session.markerPlanId || batch?.markerPlanId || '',
    markerPlanNo: session.markerPlanNo || batch?.markerPlanNo || '',
    productionOrderNos: uniqueStrings(relatedRows.map((row) => row.productionOrderNo)),
    styleCode: session.styleCode || relatedRows[0]?.styleCode || batch?.styleCode || '',
    spuCode: session.spuCode || relatedRows[0]?.spuCode || batch?.spuCode || '',
    techPackSpuCode:
      uniqueStrings(relatedRows.map((row) => row.techPackSpuCode)).length === 1
        ? uniqueStrings(relatedRows.map((row) => row.techPackSpuCode))[0]
        : '',
    styleName: relatedRows[0]?.styleName || batch?.styleName || '',
    materialSkuSummary:
      session.materialSkuSummary ||
      batch?.materialSkuSummary ||
      uniqueStrings(relatedRows.map((row) => row.materialSkuSummary)).join(' / '),
    materialPrepRows: relatedRows,
  }
}

function ensureTraceabilityTicketRecords(options: {
  ticketRecords: FeiTicketLabelRecord[]
  materialPrepRows: CuttingTraceabilityProjectionContext['materialPrepRows']
  markerPlanSources: CuttingTraceabilityProjectionContext['markerPlanSources']
  spreadingStore: MarkerSpreadingStore
}) {
  const tickets = [...options.ticketRecords]
  const ticketIds = new Set(tickets.map((item) => item.ticketRecordId))

  options.spreadingStore.sessions
    .filter((item) => item.status === 'DONE')
    .forEach((session, sessionIndex) => {
      const existingTickets = tickets.filter((item) => session.cutOrderIds.includes(item.cutOrderId))
      if (existingTickets.length) return

      const relatedRows = options.materialPrepRows.filter((row) => session.cutOrderIds.includes(row.cutOrderId))
      if (!relatedRows.length) return

      relatedRows.forEach((row, rowIndex) => {
        const ticketRecordId = `trace-ticket-${sanitizeTraceabilityId(session.spreadingSessionId)}-${rowIndex + 1}`
        if (ticketIds.has(ticketRecordId)) return
        const ticketNo = `FT-${row.cutOrderNo}-TRACE-${String(rowIndex + 1).padStart(3, '0')}`
        const size = '均码'
        const partName = '前后片'
        const materialSku = row.materialLineItems[0]?.materialSku || row.materialSkuSummary
        const markerPlanSource =
          (session.markerPlanId
            ? options.markerPlanSources.find((item) => item.markerPlanId === session.markerPlanId)
            : options.markerPlanSources.find((item) => item.markerPlanNo === session.markerPlanNo || item.items.some((detail) => detail.cutOrderId === row.cutOrderId))) ||
          null
        const traceTicket: FeiTicketLabelRecord = {
          ticketRecordId,
          ticketNo,
          cutOrderId: row.cutOrderId,
          cutOrderNo: row.cutOrderNo,
          productionOrderNo: row.productionOrderNo,
          styleCode: row.styleCode,
          spuCode: row.spuCode,
          materialSku,
          color: row.color,
          sequenceNo: rowIndex + 1,
          status: 'PRINTED',
          qrValue: ticketNo,
          createdAt: session.updatedAt || '2026-04-03 09:00',
          printedAt: session.completedAt || session.updatedAt || '2026-04-03 09:00',
          printedBy: session.completedBy || session.updatedBy || '系统示例',
          reprintCount: 0,
          sourcePrintJobId: `trace-print-job-${sanitizeTraceabilityId(session.spreadingSessionId)}-${rowIndex + 1}`,
          sourceContextType: session.contextType === 'marker-plan' ? 'marker-plan' : 'cut-order',
          sourceMarkerPlanId: session.markerPlanId || markerPlanSource?.markerPlanId || '',
          sourceMarkerPlanNo: session.markerPlanNo || markerPlanSource?.markerPlanNo || '',
          printableUnitId: session.contextType === 'marker-plan' ? `marker-plan:${session.markerPlanId || session.markerPlanNo}` : `cut-order:${row.cutOrderId}`,
          printableUnitNo: session.contextType === 'marker-plan' ? session.markerPlanNo || markerPlanSource?.markerPlanNo || '' : row.cutOrderNo,
          printableUnitType: session.contextType === 'marker-plan' ? 'marker-plan' : 'cut-order',
          sourceProductionOrderId: row.productionOrderId,
          partName,
          size,
          quantity: Math.max(Math.round((row.plannedQty || row.orderQty || 1) / Math.max(relatedRows.length, 1)), 1),
          processTags: ['TRACEABILITY_SEED'],
          version: 1,
          schemaName: 'FCS_FEI_TRACEABILITY_SEED',
          schemaVersion: '1.0.0',
          qrSerializedValue: ticketNo,
          schemaNote: `由 ${session.sessionNo || session.spreadingSessionId} 的 traceability 链路自动补齐正式菲票记录。`,
        }
        tickets.push(traceTicket)
        ticketIds.add(ticketRecordId)
      })
    })

  return tickets
}

function hydrateTraceabilitySpreadingStore(options: {
  store: MarkerSpreadingStore
  materialPrepRows: CuttingTraceabilityProjectionContext['materialPrepRows']
  markerPlanSources: CuttingTraceabilityProjectionContext['markerPlanSources']
  markerStore: CuttingTraceabilityProjectionContext['markerStore']
}) {
  let nextStore = options.store
  const targetSessions = [
    nextStore.sessions.find((item) => item.contextType === 'cut-order' && item.status === 'DONE') ||
      nextStore.sessions.find((item) => item.contextType === 'cut-order') ||
      null,
    nextStore.sessions.find((item) => item.contextType === 'marker-plan' && item.status === 'DONE') ||
      nextStore.sessions.find((item) => item.contextType === 'marker-plan') ||
      null,
  ].filter(Boolean)

  targetSessions.forEach((targetSession, index) => {
    const session = nextStore.sessions.find((item) => item.spreadingSessionId === targetSession!.spreadingSessionId)
    if (!session) return
    const context = buildTraceabilitySpreadingContext(session, options.materialPrepRows, options.markerPlanSources)
    if (!context) return
    const latestSession = nextStore.sessions.find((item) => item.spreadingSessionId === session.spreadingSessionId)
    if (!latestSession) return
    if (latestSession.contextType === 'marker-plan' && latestSession.status !== 'DONE') {
      const markerRecord = (options.markerStore as MarkerSpreadingStore | null)?.markers?.find((item) => item.markerId === latestSession.markerId) || null
      const finalized = finalizeSpreadingCompletion({
        session: latestSession,
        context,
        linkedCutOrderIds: [...context.cutOrderIds],
        linkedCutOrderNos: [...context.cutOrderNos],
        productionOrderNos: [...context.productionOrderNos],
        markerTotalPieces: markerRecord?.totalPieces || latestSession.actualCutPieceQty || 0,
        materialAttr: context.materialPrepRows[0]?.materialLabel || context.materialPrepRows[0]?.materialCategory || '',
        warningMessages: latestSession.warningMessages,
        completedBy: `traceability-projection-${index + 1}`,
      })
      nextStore = upsertSpreadingSession(finalized, nextStore)
    }
  })

  return nextStore
}

function ensureTraceabilityBagFirstSeed(options: {
  store: TransferBagStore
  ticketRecords: FeiTicketLabelRecord[]
  materialPrepRows: CuttingTraceabilityProjectionContext['materialPrepRows']
  markerPlanSources: CuttingTraceabilityProjectionContext['markerPlanSources']
  spreadingStore: MarkerSpreadingStore
}) {
  let nextStore = options.store
  const usedBagIds = new Set(nextStore.usages.map((item) => item.bagId))
  const traceAnchors = buildSpreadingTraceAnchors(options.spreadingStore)
  const rankedDoneSessions = options.spreadingStore.sessions
    .filter(
      (item) =>
        item.status === 'DONE' &&
        (!item.varianceWarning ||
          item.varianceWarning.suggestedAction === '无需处理' ||
          item.varianceWarning.handled),
    )
    .slice()
    .sort((left, right) => {
      const leftScore = (left.sourceWritebackId ? 8 : 0) + (left.contextType === 'marker-plan' ? 4 : 0)
      const rightScore = (right.sourceWritebackId ? 8 : 0) + (right.contextType === 'marker-plan' ? 4 : 0)
      if (leftScore !== rightScore) return rightScore - leftScore
      return right.updatedAt.localeCompare(left.updatedAt, 'zh-CN')
    })
  const targetSessions = rankedDoneSessions.reduce<typeof rankedDoneSessions>((accumulator, session) => {
    if (accumulator.some((item) => item.spreadingSessionId === session.spreadingSessionId)) return accumulator
    if (session.sourceWritebackId) {
      accumulator.push(session)
      return accumulator
    }
    const sameContextAlreadySeeded = accumulator.some((item) => item.contextType === session.contextType)
    if (!sameContextAlreadySeeded) {
      accumulator.push(session)
    }
    return accumulator
  }, []).slice(0, 4)

  targetSessions.forEach((session, index) => {
    const sessionId = session!.spreadingSessionId
    const sessionNo = session!.sessionNo || session!.spreadingSessionId
    const relatedRows = options.materialPrepRows.filter((row) => session!.cutOrderIds.includes(row.cutOrderId))
    const colors = resolveTraceabilitySessionColors(session!, options.materialPrepRows)
    const traceAnchor =
      traceAnchors.find((item) => item.spreadingSessionId === sessionId) ||
      findSpreadingTraceAnchor(traceAnchors, {
        cutOrderIds: session!.cutOrderIds,
        markerPlanId: session!.markerPlanId,
        materialSku: session!.materialSkuSummary || relatedRows[0]?.materialSkuSummary || '',
        color: colors[0] || '',
      })
    const candidateTickets = options.ticketRecords.filter((ticket) =>
      session!.cutOrderIds.includes(ticket.cutOrderId),
    )
    const existingBindings = nextStore.bindings.filter((binding) =>
      session!.cutOrderIds.includes(binding.cutOrderId),
    )
    const existingUsageIds = uniqueStrings(existingBindings.map((binding) => binding.usageId))
    const existingUsageMatches = existingUsageIds.some((usageId) => {
      const bindings = nextStore.bindings.filter((binding) => binding.usageId === usageId)
      const cutOrderIds = uniqueStrings(bindings.map((binding) => binding.cutOrderId))
      const markerPlanId =
        uniqueStrings(
          bindings.map((binding) => {
            const ticket = options.ticketRecords.find((item) => item.ticketRecordId === binding.ticketRecordId)
            return ticket?.sourceMarkerPlanId || ''
          }),
        )[0] || session!.markerPlanId || ''
      const materialSku =
        uniqueStrings(
          bindings.map((binding) => {
            const ticket = options.ticketRecords.find((item) => item.ticketRecordId === binding.ticketRecordId)
            return ticket?.materialSku || ''
          }),
        )[0] || ''
      const color =
        uniqueStrings(
          bindings.map((binding) => {
            const ticket = options.ticketRecords.find((item) => item.ticketRecordId === binding.ticketRecordId)
            return ticket?.color || ''
          }),
        )[0] || ''
      const matchedAnchor = findSpreadingTraceAnchor(traceAnchors, {
        cutOrderIds,
        markerPlanId,
        materialSku,
        color,
      })
      return Boolean(matchedAnchor?.spreadingSessionId === sessionId)
    })
    if (existingUsageMatches) return

    const unboundTickets = candidateTickets.filter(
      (ticket) => !nextStore.bindings.some((binding) => binding.ticketRecordId === ticket.ticketRecordId),
    )
    const tickets = (unboundTickets.length ? unboundTickets : candidateTickets).sort((left, right) =>
      left.ticketNo.localeCompare(right.ticketNo, 'zh-CN'),
    )
    if (!tickets.length) return

    const bag =
      nextStore.masters.find((item) => !usedBagIds.has(item.bagId) && item.currentStatus === 'IDLE') ||
      nextStore.masters.find((item) => !usedBagIds.has(item.bagId)) ||
      nextStore.masters.find((item) => item.currentStatus === 'IDLE') ||
      nextStore.masters[0] ||
      null
    const sewingTask =
      (session!.markerPlanNo
        ? nextStore.sewingTasks.find((item) => item.sewingTaskId === `sewing-task-${sanitizeTraceabilityId(session!.markerPlanNo || '')}`)
        : null) ||
      nextStore.sewingTasks.find((item) => item.styleCode === session!.styleCode && item.spuCode === session!.spuCode) ||
      nextStore.sewingTasks.find((item) => item.styleCode === session!.styleCode) ||
      nextStore.sewingTasks[0] ||
      null
    if (!bag) return

    const nowText = session!.completedAt || session!.updatedFromPdaAt || session!.updatedAt || '2026-04-03 09:00'
    const usageId = `traceability-usage-${sanitizeTraceabilityId(sessionId)}`
    const usageNo = `TBU-TRACE-${String(index + 1).padStart(3, '0')}-${sessionId.slice(-4)}`
    const operatorName = session!.completedBy || session!.updatedBy || '系统示例'
    const usage: TransferBagUsage = {
      cycleId: usageId,
      cycleNo: usageNo,
      carrierId: bag.carrierId,
      carrierCode: bag.carrierCode,
      carrierType: bag.carrierType,
      cycleStatus: 'PACKING',
      usageId,
      usageNo,
      bagId: bag.bagId,
      bagCode: bag.bagCode,
      boundObjectType: '入仓暂存记录',
      boundObjectId: usageId,
      boundObjectNo: usageNo,
      receiverType: '仓库',
      receiverId: 'cutting-wait-handover',
      receiverName: '裁床待交出仓',
      sourceWarehouseId: 'cutting-wait-handover',
      sourceWarehouseName: '裁床待交出仓',
      sewingTaskId: '',
      sewingTaskNo: '',
      sewingFactoryId: '',
      sewingFactoryName: '',
      styleCode: session!.styleCode || sewingTask?.styleCode || '混款',
      spuCode: session!.spuCode || sewingTask?.spuCode || '多 SKU',
      skuSummary: uniqueStrings(tickets.map((item) => item.materialSku)).join(' / ') || session!.materialSkuSummary || sewingTask?.skuSummary || '混装菲票',
      colorSummary: colors.join(' / ') || sewingTask?.colorSummary || '多色',
      sizeSummary: uniqueStrings(tickets.map((item) => item.size || '')).join(' / ') || sewingTask?.sizeSummary || '多尺码',
      usageStatus: 'PACKING',
      packedTicketCount: tickets.length,
      packedCutOrderCount: uniqueStrings(tickets.map((item) => item.cutOrderNo)).length,
      startedAt: nowText,
      finishedPackingAt: nowText,
      dispatchAt: '',
      dispatchBy: '',
      signoffStatus: 'PENDING',
      usageStage: 'INBOUND_TEMP',
      usageStageLabel: '入仓暂存',
      note: `由 ${sessionNo} 完成后自动补齐入仓暂存袋链路。`,
    }

    const bindings: TransferBagItemBinding[] = tickets.map((ticket, ticketIndex) => ({
      bindingId: `${usage.usageId}-${ticket.ticketRecordId}-${ticketIndex + 1}`,
      cycleId: usage.usageId,
      cycleNo: usage.usageNo,
      carrierId: usage.bagId,
      carrierCode: usage.bagCode,
      feiTicketId: ticket.feiTicketId,
      feiTicketNo: ticket.feiTicketNo,
      sourceSpreadingSessionId: sessionId,
      sourceSpreadingSessionNo: sessionNo,
      sourceMarkerId: session!.sourceMarkerId || session!.markerId || '',
      sourceMarkerNo: session!.sourceMarkerNo || session!.markerNo || '',
      sourceWritebackId: traceAnchor?.sourceWritebackId || session!.sourceWritebackId || '',
      usageId: usage.usageId,
      usageNo: usage.usageNo,
      bagId: usage.bagId,
      bagCode: usage.bagCode,
      ticketRecordId: ticket.ticketRecordId,
      ticketNo: ticket.ticketNo,
      cutOrderId: ticket.cutOrderId,
      cutOrderNo: ticket.cutOrderNo,
      productionOrderNo: ticket.productionOrderNo,
      markerPlanNo: ticket.markerPlanNo || session!.markerPlanNo || '',
      唛架方案No: ticket.markerPlanNo || session!.markerPlanNo || '',
      qty: Math.max(ticket.qty || 0, 1),
      garmentQty: Math.max(ticket.qty || 0, 1),
      boundAt: nowText,
      boundBy: operatorName,
      operator: operatorName,
      status: 'BOUND',
      note: `由 ${sessionNo} 形成入仓暂存袋绑定。`,
    }))
    const audit = buildBagUsageAuditTrail({
      usageId: usage.usageId,
      action: 'TRACEABILITY_AUTOLINK',
      actionAt: nowText,
      actionBy: operatorName,
      note: '自动补齐入仓暂存袋映射，裁片交出前仍需按车缝任务分拣装袋。',
    })

    const nextUsages = nextStore.usages.filter((item) => item.usageId !== usage.usageId)
    const nextBindings = [
      ...nextStore.bindings.filter((item) => !bindings.some((binding) => binding.bindingId === item.bindingId)),
      ...bindings,
    ]
    nextStore = {
      ...nextStore,
      masters: nextStore.masters.map((item) =>
        item.bagId === bag.bagId
          ? {
              ...item,
              latestUsageId: usage.usageId,
              latestUsageNo: usage.usageNo,
              latestCycleId: usage.usageId,
              latestCycleNo: usage.usageNo,
              currentCycleId: usage.usageId,
              currentOwnerTaskId: '',
              currentStatus: 'IN_USE',
              note: item.note || '当前口袋用于铺布完成后的入仓暂存追溯链。',
            }
          : item,
      ),
      usages: [...nextUsages, usage],
      bindings: nextBindings,
      manifests: nextStore.manifests,
      auditTrail: [...nextStore.auditTrail.filter((item) => item.auditTrailId !== audit.auditTrailId), audit],
    }
    usedBagIds.add(bag.bagId)
  })

  return nextStore
}

export function buildCuttingTraceabilityProjectionContext(
  snapshot?: CuttingDomainSnapshot,
  storeOverride?: TransferBagStore,
): CuttingTraceabilityProjectionContext {
  const canUseDefaultCache = !snapshot && !storeOverride
  if (canUseDefaultCache) {
    const signature = getCuttingRuntimeStorageSignature()
    if (defaultTraceabilityProjectionCache?.signature === signature) {
      return defaultTraceabilityProjectionCache.context
    }
  }

  if (snapshot && !storeOverride) {
    const cachedContext = snapshotTraceabilityProjectionCache.get(snapshot)
    if (cachedContext) {
      return cachedContext
    }
  }

  const context = buildExecutionPrepProjectionContext(snapshot)
  const effectiveSnapshot = context.snapshot
  const cutOrderRows = context.sources.cutOrderRows
  const materialPrepRows = context.sources.materialPrepRows
  const markerPlanSources = context.sources.markerPlanSources
  const markerStore = context.sources.markerStore
  const prototypeSpreadingStore = buildMarkerSpreadingPrototypeStore({
    rows: materialPrepRows,
    markerPlanSources,
    stored: markerStore as unknown as MarkerSpreadingStore,
  })
  const spreadingStore = hydrateTraceabilitySpreadingStore({
    store: prototypeSpreadingStore,
    materialPrepRows,
    markerPlanSources,
    markerStore,
  })
  const spreadingTraceAnchors = buildSpreadingTraceAnchors(spreadingStore)
  const seedLedger = buildSystemSeedFeiTicketLedger({
    cutOrderRows,
    materialPrepRows,
    markerPlanSources,
    markerStore,
  })
  const mergedRawTicketRecords = mergeTicketRecords(
    seedLedger.ticketRecords,
    castTicketRecords(effectiveSnapshot.feiTicketState.ticketRecords),
  )
  const rawTicketRecords = ensureTraceabilityTicketRecords({
    ticketRecords: mergedRawTicketRecords,
    materialPrepRows,
    markerPlanSources,
    spreadingStore,
  })
  const printJobs = mergePrintJobs(seedLedger.printJobs, castPrintJobs(effectiveSnapshot.feiTicketState.printJobs))
  const seedTransferBagStore = buildSystemSeedTransferBagStore({
    cutOrderRows,
    ticketRecords: rawTicketRecords,
    markerPlanSources,
  })
  const mergedTransferBagStore = storeOverride
    ? mergeTransferBagStores(seedTransferBagStore, storeOverride)
    : mergeTransferBagStores(seedTransferBagStore, castTransferBagStore(effectiveSnapshot.transferBagState.store))
  const transferBagStore = ensureTraceabilityBagFirstSeed({
    store: mergedTransferBagStore,
    ticketRecords: rawTicketRecords,
    materialPrepRows,
    markerPlanSources,
    spreadingStore,
  })
  const ticketRecords = applyPocketBindingLocksToTicketRecords(rawTicketRecords, transferBagStore)
  const printableViewModel = buildPrintableUnitViewModel({
    cutOrderRows,
    materialPrepRows,
    markerPlanSources,
    markerStore,
    ticketRecords,
    printJobs,
    prefilter: null,
  })
  const transferBagViewModel = buildTransferBagViewModel({
    cutOrderRows,
    ticketRecords,
    markerPlanSources,
    store: transferBagStore,
    spreadingStore,
  })
  const transferBagReturnViewModel = buildTransferBagReturnViewModel({
    store: transferBagStore,
    baseViewModel: transferBagViewModel,
  })

  const nextContext = {
    snapshot: context.snapshot,
    cutOrderRows,
    materialPrepRows,
    markerPlanSources,
    markerStore,
    spreadingStore,
    spreadingTraceAnchors,
    rawTicketRecords,
    ticketRecords,
    printJobs,
    transferBagStore,
    printableViewModel,
    transferBagViewModel,
    transferBagReturnViewModel,
  }

  if (canUseDefaultCache) {
    defaultTraceabilityProjectionCache = {
      signature: getCuttingRuntimeStorageSignature(),
      context: nextContext,
    }
  }
  if (snapshot && !storeOverride) {
    snapshotTraceabilityProjectionCache.set(snapshot, nextContext)
  }

  return nextContext
}

export function resolveCarrierScanInput(input: string, store: TransferBagStore) {
  const normalized = input.trim()
  if (!normalized) return null
  const parsed = parseCarrierQrValue(normalized)
  if (parsed) {
    return (
      store.masters.find((item) => item.carrierId === parsed.carrierId) ||
      store.masters.find((item) => item.carrierCode === parsed.carrierCode) ||
      null
    )
  }
  return store.masters.find((item) => item.carrierCode === normalized) || null
}

export function resolveFeiTicketScanInput(input: string, ticketRecords: FeiTicketLabelRecord[]) {
  const normalized = input.trim()
  if (!normalized) return null
  const parsed = parseCuttingTraceQr(normalized)
  if (parsed?.codeType === 'FEI_TICKET') {
    return (
      ticketRecords.find((item) => item.ticketRecordId === parsed.feiTicketId) ||
      ticketRecords.find((item) => item.ticketNo === parsed.feiTicketNo) ||
      null
    )
  }
  return (
    ticketRecords.find((item) => item.ticketNo === normalized) ||
    ticketRecords.find((item) => item.qrSerializedValue === normalized) ||
    ticketRecords.find((item) => item.qrValue === normalized) ||
    null
  )
}

export interface SpreadingBagWarehouseTraceItemLike {
  warehouseItemId: string
  cutOrderId: string
  cutOrderNo: string
  markerPlanId: string
  markerPlanNo: string
  materialSku: string
  spreadingSessionId: string
  spreadingSessionNo: string
  sourceWritebackId: string
  bagUsageId: string
  bagUsageNo: string
  bagCode: string
  bagFirstSatisfied: boolean
  bagFirstRuleLabel: string
}

export interface SpreadingBagWarehouseTraceProjectionRow {
  warehouseItemId: string
  cutOrderId: string
  cutOrderNo: string
  markerPlanId: string
  markerPlanNo: string
  materialSku: string
  spreadingSessionId: string
  spreadingSessionNo: string
  sourceWritebackId: string
  bagUsageId: string
  bagUsageNo: string
  bagCode: string
  bagFirstSatisfied: boolean
  bagFirstRuleLabel: string
  primaryAnchorType: 'spreading-session'
}

export function buildSpreadingBagWarehouseTraceProjection(options: {
  transferBagViewModel: TransferBagViewModel
  warehouseItems: SpreadingBagWarehouseTraceItemLike[]
}): SpreadingBagWarehouseTraceProjectionRow[] {
  const usageMap = Object.fromEntries(options.transferBagViewModel.usages.map((item) => [item.usageId, item] as const))

  return options.warehouseItems
    .filter((item) => item.spreadingSessionId || item.bagUsageId)
    .map((item) => {
      const usage = usageMap[item.bagUsageId] || null
      return {
        warehouseItemId: item.warehouseItemId,
        cutOrderId: item.cutOrderId,
        cutOrderNo: item.cutOrderNo,
        markerPlanId: item.markerPlanId,
        markerPlanNo: item.markerPlanNo,
        materialSku: item.materialSku,
        spreadingSessionId: item.spreadingSessionId || usage?.spreadingSessionId || '',
        spreadingSessionNo: item.spreadingSessionNo || usage?.spreadingSessionNo || '',
        sourceWritebackId: item.sourceWritebackId || usage?.spreadingSourceWritebackId || '',
        bagUsageId: item.bagUsageId,
        bagUsageNo: item.bagUsageNo || usage?.usageNo || '',
        bagCode: item.bagCode || usage?.bagCode || '',
        bagFirstSatisfied: item.bagFirstSatisfied,
        bagFirstRuleLabel: item.bagFirstRuleLabel,
        primaryAnchorType: 'spreading-session',
      }
    })
    .filter((row) => Boolean(row.spreadingSessionId))
    .sort((left, right) => {
      const leftScore =
        (left.spreadingSessionId ? 4 : 0) +
        (left.sourceWritebackId ? 2 : 0) +
        (left.bagFirstSatisfied ? 1 : 0)
      const rightScore =
        (right.spreadingSessionId ? 4 : 0) +
        (right.sourceWritebackId ? 2 : 0) +
        (right.bagFirstSatisfied ? 1 : 0)
      if (leftScore !== rightScore) return rightScore - leftScore
      return left.cutOrderNo.localeCompare(right.cutOrderNo, 'zh-CN')
    })
}
