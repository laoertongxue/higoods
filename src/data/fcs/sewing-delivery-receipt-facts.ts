import {
  getPdaHandoverRecordsByHead,
  listHandoverOrdersByTaskId,
  type PdaHandoverRecord,
} from './pda-handover-events.ts'
import type { SewingDeliveryReceiptFact } from './sewing-delivery-sla.ts'

function validNonNegativeQty(value: number | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

export function listSewingDeliveryReceiptFacts(runtimeTaskId: string): SewingDeliveryReceiptFact[] {
  return listHandoverOrdersByTaskId(runtimeTaskId)
    .flatMap((head) => getPdaHandoverRecordsByHead(head.handoverId))
    .map((record: PdaHandoverRecord): SewingDeliveryReceiptFact | null => {
      const submittedQty = validNonNegativeQty(record.submittedQty ?? record.plannedQty)
      const receivedQty = validNonNegativeQty(record.receiverWrittenQty)
      if (submittedQty === null || receivedQty === null || !record.receiverWrittenAt) return null
      return {
        recordId: record.handoverRecordId || record.recordId,
        submittedQty,
        submittedAt: record.factorySubmittedAt,
        receivedQty,
        receivedAt: record.receiverWrittenAt,
        voided: record.handoverRecordStatus === 'VOIDED',
      }
    })
    .filter((fact): fact is SewingDeliveryReceiptFact => fact !== null)
}

export function sumSewingDeliveryConfirmedReceiptQty(runtimeTaskId: string): number {
  return listSewingDeliveryReceiptFacts(runtimeTaskId).reduce(
    (sum, fact) => sum + (fact.voided ? 0 : fact.receivedQty),
    0,
  )
}
