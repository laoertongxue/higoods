import {
  buildFcsCuttingDomainSnapshot,
  type CuttingDomainSnapshot,
} from '../../../domain/fcs-cutting-runtime/index.ts'
import type { FeiTicketPrintJob, FeiTicketLabelRecord, PrintableUnitViewModel } from './fei-tickets-model'
import {
  buildPrintableUnitViewModel,
  buildSystemSeedFeiTicketLedger,
} from './fei-tickets-model'
import {
  buildBagUsageAuditTrail,
  applyPocketBindingLocksToTicketRecords,
  buildSystemSeedTransferBagStore,
  buildTransferBagViewModel,
  createTransferBagDispatchManifest,
  mergeTransferBagStores,
  type TransferBagStore,
  type TransferBagViewModel,
  type TransferBagItemBinding,
  type TransferBagUsage,
  type SewingTaskRef,
} from './transfer-bags-model'
import {
  buildSpreadingTraceAnchors,
  findSpreadingTraceAnchor,
  finalizeSpreadingCompletion,
  type MarkerSpreadingStore,
  type SpreadingTraceAnchor,
  upsertSpreadingSession,
} from './marker-spreading-model'
import { buildMarkerSpreadingPrototypeStore } from './marker-spreading-utils.ts'
import {
  applyWritebackToSpreadingSession,
  buildMockPdaWritebacks,
} from '../../../data/fcs/cutting/pda-spreading-writeback.ts'
import {
  buildTransferBagReturnViewModel,
  type TransferBagReturnViewModel,
} from './transfer-bag-return-model'
import {
  parseCuttingTraceQr,
} from '../../../data/fcs/cutting/qr-codes.ts'
import {
  parseCarrierQrValue,
} from '../../../data/fcs/cutting/transfer-bag-runtime.ts'
import {
  buildExecutionPrepProjectionContext,
} from './execution-prep-projection-helpers'

export interface CuttingTraceabilityProjectionContext {
  snapshot: CuttingDomainSnapshot
  originalRows: ReturnType<typeof buildExecutionPrepProjectionContext>['sources']['originalRows']
  materialPrepRows: ReturnType<typeof buildExecutionPrepProjectionContext>['sources']['materialPrepRows']
  mergeBatches: ReturnType<typeof buildExecutionPrepProjectionContext>['sources']['mergeBatches']
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
    if (left.originalCutOrderNo !== right.originalCutOrderNo) {
      return left.originalCutOrderNo.localeCompare(right.originalCutOrderNo, 'zh-CN')
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
    .filter((row) => session.originalCutOrderIds.includes(row.originalCutOrderId))
    .map((row) => row.color)
  return uniqueStrings(contextColors)
}

function buildTraceabilitySpreadingContext(
  session: MarkerSpreadingStore['sessions'][number],
  materialPrepRows: CuttingTraceabilityProjectionContext['materialPrepRows'],
  mergeBatches: CuttingTraceabilityProjectionContext['mergeBatches'],
) {
  const relatedRows = materialPrepRows.filter((row) => session.originalCutOrderIds.includes(row.originalCutOrderId))
  const batch =
    (session.mergeBatchId
      ? mergeBatches.find((item) => item.mergeBatchId === session.mergeBatchId)
      : mergeBatches.find((item) => item.mergeBatchNo === session.mergeBatchNo)) || null
  if (!relatedRows.length && !batch) return null

  return {
    contextType: session.contextType,
    originalCutOrderIds: [...session.originalCutOrderIds],
    originalCutOrderNos: relatedRows.map((row) => row.originalCutOrderNo),
    mergeBatchId: session.mergeBatchId || batch?.mergeBatchId || '',
    mergeBatchNo: session.mergeBatchNo || batch?.mergeBatchNo || '',
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
  mergeBatches: CuttingTraceabilityProjectionContext['mergeBatches']
  spreadingStore: MarkerSpreadingStore
}) {
  const tickets = [...options.ticketRecords]
  const ticketIds = new Set(tickets.map((item) => item.ticketRecordId))

  options.spreadingStore.sessions
    .filter((item) => item.status === 'DONE')
    .forEach((session, sessionIndex) => {
      const existingTickets = tickets.filter((item) => session.originalCutOrderIds.includes(item.originalCutOrderId))
      if (existingTickets.length) return

      const relatedRows = options.materialPrepRows.filter((row) => session.originalCutOrderIds.includes(row.originalCutOrderId))
      if (!relatedRows.length) return

      relatedRows.forEach((row, rowIndex) => {
        const ticketRecordId = `trace-ticket-${sanitizeTraceabilityId(session.spreadingSessionId)}-${rowIndex + 1}`
        if (ticketIds.has(ticketRecordId)) return
        const ticketNo = `FT-${row.originalCutOrderNo}-TRACE-${String(rowIndex + 1).padStart(3, '0')}`
        const size = '均码'
        const partName = '前后片'
        const materialSku = row.materialLineItems[0]?.materialSku || row.materialSkuSummary
        const mergeBatch =
          (session.mergeBatchId
            ? options.mergeBatches.find((item) => item.mergeBatchId === session.mergeBatchId)
            : options.mergeBatches.find((item) => item.mergeBatchNo === session.mergeBatchNo || item.items.some((detail) => detail.originalCutOrderId === row.originalCutOrderId))) ||
          null
        const traceTicket: FeiTicketLabelRecord = {
          ticketRecordId,
          ticketNo,
          originalCutOrderId: row.originalCutOrderId,
          originalCutOrderNo: row.originalCutOrderNo,
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
          sourceContextType: session.contextType === 'merge-batch' ? 'merge-batch' : 'original-order',
          sourceMergeBatchId: session.mergeBatchId || mergeBatch?.mergeBatchId || '',
          sourceMergeBatchNo: session.mergeBatchNo || mergeBatch?.mergeBatchNo || '',
          printableUnitId: session.contextType === 'merge-batch' ? `batch:${session.mergeBatchId || session.mergeBatchNo}` : `cut-order:${row.originalCutOrderId}`,
          printableUnitNo: session.contextType === 'merge-batch' ? session.mergeBatchNo || mergeBatch?.mergeBatchNo || '' : row.originalCutOrderNo,
          printableUnitType: session.contextType === 'merge-batch' ? 'merge-batch' : 'original-cut-order',
          sourceProductionOrderId: row.productionOrderId,
          partName,
          size,
          quantity: Math.max(Math.round((row.plannedQty || row.orderQty || 1) / Math.max(relatedRows.length, 1)), 1),
          processTags: ['TRACEABILITY_SEED'],
          version: 1,
          schemaName: 'FCS_FEI_TRACEABILITY_SEED',
          schemaVersion: '1.0.0',
          qrSerializedValue: ticketNo,
          compatibilityNote: `由 ${session.sessionNo || session.spreadingSessionId} 的 traceability 链路自动补齐正式菲票记录。`,
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
  mergeBatches: CuttingTraceabilityProjectionContext['mergeBatches']
  markerStore: CuttingTraceabilityProjectionContext['markerStore']
}) {
  let nextStore = options.store
  const targetSessions = [
    nextStore.sessions.find((item) => item.contextType === 'original-order' && item.status === 'DONE') ||
      nextStore.sessions.find((item) => item.contextType === 'original-order') ||
      null,
    nextStore.sessions.find((item) => item.contextType === 'merge-batch' && item.status === 'DONE') ||
      nextStore.sessions.find((item) => item.contextType === 'merge-batch') ||
      null,
  ].filter(Boolean)

  targetSessions.forEach((targetSession, index) => {
    const session = nextStore.sessions.find((item) => item.spreadingSessionId === targetSession!.spreadingSessionId)
    if (!session) return
    const context = buildTraceabilitySpreadingContext(session, options.materialPrepRows, options.mergeBatches)
    if (!context) return
    const writebackDraft =
      buildMockPdaWritebacks({ context, sessions: [session] }).find(
        (item) => item.sourceAccountId && item.contextType === context.contextType && item.rollItems.length > 0,
      ) || null
    if (!writebackDraft) return
    const writebackId = `pda-writeback-trace-${sanitizeTraceabilityId(session.spreadingSessionId)}`
    const rollItems = writebackDraft.rollItems.map((item, rollIndex) => ({
      ...item,
      writebackId,
      rollWritebackItemId: `${writebackId}-roll-${rollIndex + 1}`,
    }))
    const writeback = {
      ...writebackDraft,
      writebackId,
      rollItems,
      operatorItems: writebackDraft.operatorItems.map((item, operatorIndex) => ({
        ...item,
        writebackId,
        operatorWritebackItemId: `${writebackId}-operator-${operatorIndex + 1}`,
        rollWritebackItemId:
          rollItems[operatorIndex]?.rollWritebackItemId || rollItems[0]?.rollWritebackItemId || `${writebackId}-roll-1`,
      })),
    }
    const applyResult = applyWritebackToSpreadingSession({
      writeback,
      store: nextStore,
      force: true,
      appliedBy: 'traceability-projection',
    })
    nextStore = applyResult.nextStore

    const latestSession = nextStore.sessions.find((item) => item.spreadingSessionId === (applyResult.updatedSessionId || applyResult.createdSessionId || session.spreadingSessionId))
    if (!latestSession) return
    if (latestSession.contextType === 'merge-batch' && latestSession.status !== 'DONE') {
      const markerRecord = (options.markerStore as MarkerSpreadingStore | null)?.markers?.find((item) => item.markerId === latestSession.markerId) || null
      const finalized = finalizeSpreadingCompletion({
        session: latestSession,
        context,
        linkedOriginalCutOrderIds: [...context.originalCutOrderIds],
        linkedOriginalCutOrderNos: [...context.originalCutOrderNos],
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
  mergeBatches: CuttingTraceabilityProjectionContext['mergeBatches']
  spreadingStore: MarkerSpreadingStore
}) {
  let nextStore = options.store
  const usedBagIds = new Set(nextStore.usages.map((item) => item.bagId))
  const traceAnchors = buildSpreadingTraceAnchors(options.spreadingStore)
  const rankedDoneSessions = options.spreadingStore.sessions
    .filter(
      (item) =>
        item.status === 'DONE' &&
        (!item.replenishmentWarning ||
          item.replenishmentWarning.suggestedAction === '无需补料' ||
          item.replenishmentWarning.handled),
    )
    .slice()
    .sort((left, right) => {
      const leftScore = (left.sourceWritebackId ? 8 : 0) + (left.contextType === 'merge-batch' ? 4 : 0)
      const rightScore = (right.sourceWritebackId ? 8 : 0) + (right.contextType === 'merge-batch' ? 4 : 0)
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
    const relatedRows = options.materialPrepRows.filter((row) => session!.originalCutOrderIds.includes(row.originalCutOrderId))
    const colors = resolveTraceabilitySessionColors(session!, options.materialPrepRows)
    const traceAnchor =
      traceAnchors.find((item) => item.spreadingSessionId === sessionId) ||
      findSpreadingTraceAnchor(traceAnchors, {
        originalCutOrderIds: session!.originalCutOrderIds,
        mergeBatchId: session!.mergeBatchId,
        materialSku: session!.materialSkuSummary || relatedRows[0]?.materialSkuSummary || '',
        color: colors[0] || '',
      })
    const candidateTickets = options.ticketRecords.filter((ticket) =>
      session!.originalCutOrderIds.includes(ticket.originalCutOrderId),
    )
    const existingBindings = nextStore.bindings.filter((binding) =>
      session!.originalCutOrderIds.includes(binding.originalCutOrderId),
    )
    const existingUsageIds = uniqueStrings(existingBindings.map((binding) => binding.usageId))
    const existingUsageMatches = existingUsageIds.some((usageId) => {
      const bindings = nextStore.bindings.filter((binding) => binding.usageId === usageId)
      const originalIds = uniqueStrings(bindings.map((binding) => binding.originalCutOrderId))
      const mergeBatchId =
        uniqueStrings(
          bindings.map((binding) => {
            const ticket = options.ticketRecords.find((item) => item.ticketRecordId === binding.ticketRecordId)
            return ticket?.sourceMergeBatchId || ''
          }),
        )[0] || session!.mergeBatchId || ''
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
        originalCutOrderIds: originalIds,
        mergeBatchId,
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
      (session!.mergeBatchNo
        ? nextStore.sewingTasks.find((item) => item.sewingTaskId === `sewing-task-${sanitizeTraceabilityId(session!.mergeBatchNo || '')}`)
        : null) ||
      nextStore.sewingTasks.find((item) => item.styleCode === session!.styleCode && item.spuCode === session!.spuCode) ||
      nextStore.sewingTasks.find((item) => item.styleCode === session!.styleCode) ||
      nextStore.sewingTasks[0] ||
      null
    if (!bag || !sewingTask) return

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
      cycleStatus: 'READY_TO_DISPATCH',
      usageId,
      usageNo,
      bagId: bag.bagId,
      bagCode: bag.bagCode,
      sewingTaskId: sewingTask.sewingTaskId,
      sewingTaskNo: sewingTask.sewingTaskNo,
      sewingFactoryId: sewingTask.sewingFactoryId,
      sewingFactoryName: sewingTask.sewingFactoryName,
      styleCode: session!.styleCode || sewingTask.styleCode,
      spuCode: session!.spuCode || sewingTask.spuCode,
      skuSummary: uniqueStrings(tickets.map((item) => item.materialSku)).join(' / ') || session!.materialSkuSummary || sewingTask.skuSummary,
      colorSummary: colors.join(' / ') || sewingTask.colorSummary,
      sizeSummary: uniqueStrings(tickets.map((item) => item.size || '')).join(' / ') || sewingTask.sizeSummary,
      usageStatus: 'READY_TO_DISPATCH',
      packedTicketCount: tickets.length,
      packedOriginalCutOrderCount: uniqueStrings(tickets.map((item) => item.originalCutOrderNo)).length,
      startedAt: nowText,
      finishedPackingAt: nowText,
      dispatchAt: nowText,
      dispatchBy: operatorName,
      signoffStatus: 'PENDING',
      note: session!.sourceWritebackId
        ? `由 ${sessionNo}（PDA回写 ${session!.sourceWritebackId}）完成后自动补齐正式装袋链路。`
        : `由 ${sessionNo} 完成后自动补齐正式装袋链路。`,
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
      originalCutOrderId: ticket.originalCutOrderId,
      originalCutOrderNo: ticket.originalCutOrderNo,
      productionOrderNo: ticket.productionOrderNo,
      mergeBatchNo: ticket.mergeBatchNo || session!.mergeBatchNo || '',
      裁剪批次No: ticket.mergeBatchNo || session!.mergeBatchNo || '',
      qty: Math.max(ticket.qty || 0, 1),
      garmentQty: Math.max(ticket.qty || 0, 1),
      boundAt: nowText,
      boundBy: operatorName,
      operator: operatorName,
      status: 'BOUND',
      note: traceAnchor?.sourceWritebackId
        ? `由 ${sessionNo}（PDA回写 ${traceAnchor.sourceWritebackId}）形成正式装袋绑定。`
        : `由 ${sessionNo} 形成正式装袋绑定。`,
    }))
    const summary = {
      ticketCount: bindings.length,
      originalCutOrderCount: uniqueStrings(bindings.map((item) => item.originalCutOrderNo)).length,
      productionOrderCount: uniqueStrings(bindings.map((item) => item.productionOrderNo)).length,
      mergeBatchCount: uniqueStrings(bindings.map((item) => item.mergeBatchNo)).length,
      quantityTotal: bindings.reduce((sum, item) => sum + Math.max(item.qty, 0), 0),
    }

    const manifest = createTransferBagDispatchManifest({
      usage,
      summary,
      nowText,
      createdBy: operatorName,
      note: '由铺布完成链路自动生成的周转口袋交接清单。',
    })
    const audit = buildBagUsageAuditTrail({
      usageId: usage.usageId,
      action: 'TRACEABILITY_AUTOLINK',
      actionAt: nowText,
      actionBy: operatorName,
      note: '自动补齐先装袋后入仓主链，确保后续裁片仓与追溯统一基于正式装袋映射。',
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
              currentOwnerTaskId: usage.sewingTaskId,
              currentStatus: 'IN_USE',
              note: item.note || '当前口袋用于铺布完成后的正式装袋追溯链。',
            }
          : item,
      ),
      usages: [...nextUsages, usage],
      bindings: nextBindings,
      manifests: [...nextStore.manifests.filter((item) => item.manifestId !== manifest.manifestId), manifest],
      auditTrail: [...nextStore.auditTrail.filter((item) => item.auditTrailId !== audit.auditTrailId), audit],
    }
    usedBagIds.add(bag.bagId)
  })

  return nextStore
}

export function buildCuttingTraceabilityProjectionContext(
  snapshot: CuttingDomainSnapshot = buildFcsCuttingDomainSnapshot(),
  storeOverride?: TransferBagStore,
): CuttingTraceabilityProjectionContext {
  const context = buildExecutionPrepProjectionContext(snapshot)
  const originalRows = context.sources.originalRows
  const materialPrepRows = context.sources.materialPrepRows
  const mergeBatches = context.sources.mergeBatches
  const markerStore = context.sources.markerStore
  const prototypeSpreadingStore = buildMarkerSpreadingPrototypeStore({
    rows: materialPrepRows,
    mergeBatches,
    stored: markerStore as unknown as MarkerSpreadingStore,
  })
  const spreadingStore = hydrateTraceabilitySpreadingStore({
    store: prototypeSpreadingStore,
    materialPrepRows,
    mergeBatches,
    markerStore,
  })
  const spreadingTraceAnchors = buildSpreadingTraceAnchors(spreadingStore)
  const seedLedger = buildSystemSeedFeiTicketLedger({
    originalRows,
    materialPrepRows,
    mergeBatches,
    markerStore,
  })
  const mergedRawTicketRecords = mergeTicketRecords(
    seedLedger.ticketRecords,
    castTicketRecords(snapshot.feiTicketState.ticketRecords),
  )
  const rawTicketRecords = ensureTraceabilityTicketRecords({
    ticketRecords: mergedRawTicketRecords,
    materialPrepRows,
    mergeBatches,
    spreadingStore,
  })
  const printJobs = mergePrintJobs(seedLedger.printJobs, castPrintJobs(snapshot.feiTicketState.printJobs))
  const seedTransferBagStore = buildSystemSeedTransferBagStore({
    originalRows,
    ticketRecords: rawTicketRecords,
    mergeBatches,
  })
  const mergedTransferBagStore = storeOverride
    ? mergeTransferBagStores(seedTransferBagStore, storeOverride)
    : mergeTransferBagStores(seedTransferBagStore, castTransferBagStore(snapshot.transferBagState.store))
  const transferBagStore = ensureTraceabilityBagFirstSeed({
    store: mergedTransferBagStore,
    ticketRecords: rawTicketRecords,
    materialPrepRows,
    mergeBatches,
    spreadingStore,
  })
  const ticketRecords = applyPocketBindingLocksToTicketRecords(rawTicketRecords, transferBagStore)
  const printableViewModel = buildPrintableUnitViewModel({
    originalRows,
    materialPrepRows,
    mergeBatches,
    markerStore,
    ticketRecords,
    printJobs,
    prefilter: null,
  })
  const transferBagViewModel = buildTransferBagViewModel({
    originalRows,
    ticketRecords,
    mergeBatches,
    store: transferBagStore,
    spreadingStore,
  })
  const transferBagReturnViewModel = buildTransferBagReturnViewModel({
    store: transferBagStore,
    baseViewModel: transferBagViewModel,
  })

  return {
    snapshot,
    originalRows,
    materialPrepRows,
    mergeBatches,
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
  originalCutOrderId: string
  originalCutOrderNo: string
  mergeBatchId: string
  mergeBatchNo: string
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
  originalCutOrderId: string
  originalCutOrderNo: string
  mergeBatchId: string
  mergeBatchNo: string
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
        originalCutOrderId: item.originalCutOrderId,
        originalCutOrderNo: item.originalCutOrderNo,
        mergeBatchId: item.mergeBatchId,
        mergeBatchNo: item.mergeBatchNo,
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
      return left.originalCutOrderNo.localeCompare(right.originalCutOrderNo, 'zh-CN')
    })
}
