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
  applyPocketBindingLocksToTicketRecords,
  buildSystemSeedTransferBagStore,
  buildTransferBagViewModel,
  mergeTransferBagStores,
  type TransferBagStore,
  type TransferBagViewModel,
} from './transfer-bags-model'
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

export function buildCuttingTraceabilityProjectionContext(
  snapshot: CuttingDomainSnapshot = buildFcsCuttingDomainSnapshot(),
  storeOverride?: TransferBagStore,
): CuttingTraceabilityProjectionContext {
  const context = buildExecutionPrepProjectionContext(snapshot)
  const originalRows = context.sources.originalRows
  const materialPrepRows = context.sources.materialPrepRows
  const mergeBatches = context.sources.mergeBatches
  const markerStore = context.sources.markerStore
  const seedLedger = buildSystemSeedFeiTicketLedger({
    originalRows,
    materialPrepRows,
    mergeBatches,
    markerStore,
  })
  const rawTicketRecords = mergeTicketRecords(
    seedLedger.ticketRecords,
    castTicketRecords(snapshot.feiTicketState.ticketRecords),
  )
  const printJobs = mergePrintJobs(seedLedger.printJobs, castPrintJobs(snapshot.feiTicketState.printJobs))
  const seedTransferBagStore = buildSystemSeedTransferBagStore({
    originalRows,
    ticketRecords: rawTicketRecords,
    mergeBatches,
  })
  const transferBagStore = storeOverride
    ? mergeTransferBagStores(seedTransferBagStore, storeOverride)
    : mergeTransferBagStores(seedTransferBagStore, castTransferBagStore(snapshot.transferBagState.store))
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
