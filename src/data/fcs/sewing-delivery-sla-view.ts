import {
  classifySewingDeliverySla,
  formatOperationLocalWallClock,
  getSewingDeliverySlaSnapshot,
  projectSewingDeliverySla,
  type SewingDeliveryReceiptFact,
  type SewingDeliverySlaProjection,
} from './sewing-delivery-sla.ts'
import { getRuntimeTaskById, listRuntimeExecutionTasks } from './runtime-process-tasks.ts'
import {
  getPdaHandoverRecordsByHead,
  listPdaHandoverHeads,
  type PdaHandoverRecord,
} from './pda-handover-events.ts'

export interface SewingDeliverySlaView {
  readonly runtimeTaskId: string
  readonly submittedQty: number
  readonly confirmedReceivedQty: number
  readonly projection: SewingDeliverySlaProjection
}

function isVoided(record: PdaHandoverRecord): boolean {
  return record.handoverRecordStatus === 'VOIDED'
}

function submittedQtyOf(record: PdaHandoverRecord): number {
  return record.submittedQty ?? record.plannedQty ?? 0
}

function listTaskHandoutRecords(runtimeTaskId: string): PdaHandoverRecord[] {
  return listPdaHandoverHeads()
    .filter((head) =>
      head.headType === 'HANDOUT'
      && (head.runtimeTaskId === runtimeTaskId || head.taskId === runtimeTaskId || head.sourceTaskId === runtimeTaskId),
    )
    .flatMap((head) => getPdaHandoverRecordsByHead(head.handoverId))
}

function toReceiptFact(record: PdaHandoverRecord): SewingDeliveryReceiptFact | null {
  if (typeof record.receiverWrittenQty !== 'number' || !record.receiverWrittenAt) return null
  return {
    recordId: record.handoverRecordId || record.recordId,
    submittedQty: submittedQtyOf(record),
    submittedAt: record.factorySubmittedAt,
    receivedQty: record.receiverWrittenQty,
    receivedAt: record.receiverWrittenAt,
    voided: isVoided(record),
  }
}

export function getSewingDeliverySlaView(
  runtimeTaskId: string,
  nowAt: string = formatOperationLocalWallClock(),
): SewingDeliverySlaView | null {
  const task = getRuntimeTaskById(runtimeTaskId)
  const snapshot = getSewingDeliverySlaSnapshot(runtimeTaskId)
  const slaKind = task ? classifySewingDeliverySla(task) : null
  if (!snapshot?.active || slaKind === null || snapshot.slaKind !== slaKind) return null

  const records = listTaskHandoutRecords(runtimeTaskId)
  const submittedQty = records.reduce(
    (sum, record) => sum + (isVoided(record) ? 0 : submittedQtyOf(record)),
    0,
  )
  const receipts = records
    .map(toReceiptFact)
    .filter((receipt): receipt is SewingDeliveryReceiptFact => receipt !== null)
  const projection = projectSewingDeliverySla(snapshot, receipts, nowAt)

  return Object.freeze({
    runtimeTaskId,
    submittedQty,
    confirmedReceivedQty: projection.confirmedReceivedQty,
    projection,
  })
}

export function listSewingDeliverySlaViews(
  nowAt: string = formatOperationLocalWallClock(),
): readonly SewingDeliverySlaView[] {
  const views = listRuntimeExecutionTasks()
    .map((task) => getSewingDeliverySlaView(task.taskId, nowAt))
    .filter((view): view is SewingDeliverySlaView => view !== null)
  return Object.freeze(views)
}
