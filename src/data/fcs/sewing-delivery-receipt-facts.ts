import type { PdaHandoverRecord } from './pda-handover-events.ts'
import { listRegisteredHandoutRecordVersions } from './pda-handover-handout-registry.ts'
import { formatOperationLocalWallClock, type SewingDeliveryReceiptFact } from './sewing-delivery-sla.ts'

function validNonNegativeQty(value: number | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

const CONFIRMED_RECEIPT_STATUSES = new Set([
  'WRITTEN_BACK_MATCHED',
  'WRITTEN_BACK_DIFF',
  'DIFF_ACCEPTED',
])

function rawRecordVersionAt(record: PdaHandoverRecord): string {
  if (record.lifecycleUpdatedAt) return record.lifecycleUpdatedAt
  return [record.receiverWrittenAt, record.factorySubmittedAt]
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? ''
}

function lifecycleRank(record: PdaHandoverRecord): number {
  if (record.handoverRecordStatus === 'VOIDED') return 4
  if (CONFIRMED_RECEIPT_STATUSES.has(record.handoverRecordStatus ?? '')) return 3
  if (record.handoverRecordStatus === 'SUBMITTED_WAIT_WRITEBACK') return 2
  return 1
}

function rawRecordStableSignature(record: PdaHandoverRecord): string {
  // Legacy records may lack lifecycleUpdatedAt. This fixed-field signature is
  // only a deterministic final fallback, never a substitute for business time.
  return JSON.stringify({
    recordId: record.handoverRecordId || record.recordId,
    taskId: record.taskId,
    handoverId: record.handoverId,
    handoverRecordStatus: record.handoverRecordStatus ?? '',
    status: record.status,
    factorySubmittedAt: record.factorySubmittedAt,
    submittedQty: record.submittedQty ?? record.plannedQty ?? null,
    receiverWrittenAt: record.receiverWrittenAt ?? '',
    receiverWrittenQty: record.receiverWrittenQty ?? null,
    lifecycleUpdatedAt: record.lifecycleUpdatedAt ?? '',
  })
}

function compareRawRecordVersion(left: PdaHandoverRecord, right: PdaHandoverRecord): number {
  const timeOrder = rawRecordVersionAt(left).localeCompare(rawRecordVersionAt(right))
  if (timeOrder !== 0) return timeOrder
  const rankOrder = lifecycleRank(left) - lifecycleRank(right)
  if (rankOrder !== 0) return rankOrder
  return rawRecordStableSignature(left).localeCompare(rawRecordStableSignature(right))
}

export function selectLatestSewingDeliveryRawRecords(
  records: readonly PdaHandoverRecord[],
  nowAt: string = formatOperationLocalWallClock(),
): PdaHandoverRecord[] {
  const latestByRecordId = new Map<string, PdaHandoverRecord>()
  records.filter((record) => rawRecordVersionAt(record) <= nowAt).forEach((record) => {
    const recordId = record.handoverRecordId || record.recordId
    const current = latestByRecordId.get(recordId)
    if (!current || compareRawRecordVersion(record, current) > 0) {
      latestByRecordId.set(recordId, record)
    }
  })
  return Array.from(latestByRecordId.values()).sort((left, right) =>
    (left.handoverRecordId || left.recordId).localeCompare(right.handoverRecordId || right.recordId),
  )
}

export function listLatestSewingDeliveryRawRecords(
  nowAt: string = formatOperationLocalWallClock(),
): PdaHandoverRecord[] {
  return selectLatestSewingDeliveryRawRecords(listRegisteredHandoutRecordVersions(), nowAt)
}

export function toConfirmedSewingDeliveryReceiptFact(
  record: PdaHandoverRecord,
  runtimeTaskId: string,
): SewingDeliveryReceiptFact | null {
  if (record.taskId !== runtimeTaskId) return null
  if (!CONFIRMED_RECEIPT_STATUSES.has(record.handoverRecordStatus)) return null
  const submittedQty = validNonNegativeQty(record.submittedQty ?? record.plannedQty)
  const receivedQty = validNonNegativeQty(record.receiverWrittenQty)
  if (submittedQty === null || receivedQty === null || !record.factorySubmittedAt || !record.receiverWrittenAt) return null
  return {
    recordId: record.handoverRecordId || record.recordId,
    submittedQty,
    submittedAt: record.factorySubmittedAt,
    receivedQty,
    receivedAt: record.receiverWrittenAt,
    voided: false,
  }
}

export function listSewingDeliveryReceiptFacts(
  runtimeTaskId: string,
  nowAt: string = formatOperationLocalWallClock(),
): SewingDeliveryReceiptFact[] {
  return listLatestSewingDeliveryRawRecords(nowAt)
    .filter((record) => record.taskId === runtimeTaskId)
    .map((record) => toConfirmedSewingDeliveryReceiptFact(record, runtimeTaskId))
    .filter((fact): fact is SewingDeliveryReceiptFact => fact !== null)
}

export function sumSewingDeliveryConfirmedReceiptQty(
  runtimeTaskId: string,
  nowAt: string = formatOperationLocalWallClock(),
): number {
  return listSewingDeliveryReceiptFacts(runtimeTaskId, nowAt).reduce(
    (sum, fact) => sum + (fact.voided ? 0 : fact.receivedQty),
    0,
  )
}
