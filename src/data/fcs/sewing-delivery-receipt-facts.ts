import type { PdaHandoverRecord } from './pda-handover-events.ts'
import { listRegisteredHandoutHeads, listRegisteredHandoutRecords } from './pda-handover-handout-registry.ts'
import type { SewingDeliveryReceiptFact } from './sewing-delivery-sla.ts'

function validNonNegativeQty(value: number | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

const CONFIRMED_RECEIPT_STATUSES = new Set([
  'WRITTEN_BACK_MATCHED',
  'WRITTEN_BACK_DIFF',
  'DIFF_ACCEPTED',
])

function rawRecordVersionAt(record: PdaHandoverRecord): string {
  return [record.receiverWrittenAt, record.factorySubmittedAt]
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? ''
}

export function selectLatestSewingDeliveryRawRecords(records: readonly PdaHandoverRecord[]): PdaHandoverRecord[] {
  const latestByRecordId = new Map<string, PdaHandoverRecord>()
  records.forEach((record) => {
    const recordId = record.handoverRecordId || record.recordId
    const current = latestByRecordId.get(recordId)
    if (!current || rawRecordVersionAt(record) >= rawRecordVersionAt(current)) {
      latestByRecordId.set(recordId, record)
    }
  })
  return Array.from(latestByRecordId.values())
}

export function listLatestSewingDeliveryRawRecords(): PdaHandoverRecord[] {
  const records: PdaHandoverRecord[] = []
  listRegisteredHandoutHeads().forEach((head) => {
    records.push(...listRegisteredHandoutRecords(head.handoverId))
  })
  return selectLatestSewingDeliveryRawRecords(records)
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

export function listSewingDeliveryReceiptFacts(runtimeTaskId: string): SewingDeliveryReceiptFact[] {
  return listLatestSewingDeliveryRawRecords()
    .filter((record) => record.taskId === runtimeTaskId)
    .map((record) => toConfirmedSewingDeliveryReceiptFact(record, runtimeTaskId))
    .filter((fact): fact is SewingDeliveryReceiptFact => fact !== null)
}

export function sumSewingDeliveryConfirmedReceiptQty(runtimeTaskId: string): number {
  return listSewingDeliveryReceiptFacts(runtimeTaskId).reduce(
    (sum, fact) => sum + (fact.voided ? 0 : fact.receivedQty),
    0,
  )
}
