import {
  classifySewingDeliverySla,
  formatOperationLocalWallClock,
  getSewingDeliverySlaSnapshot,
  projectSewingDeliverySla,
  type SewingDeliveryReceiptFact,
  type SewingDeliverySlaProjection,
  type SewingDeliverySlaSnapshot,
} from './sewing-delivery-sla.ts'
import { getRuntimeTaskById, listRuntimeExecutionTasks } from './runtime-process-tasks.ts'
import {
  getPdaHandoverRecordsByHead,
  listHandoverOrdersByTaskId,
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

function validNonNegativeQty(value: number | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

function listTaskHandoutRecords(runtimeTaskId: string): PdaHandoverRecord[] {
  return listHandoverOrdersByTaskId(runtimeTaskId)
    .flatMap((head) => getPdaHandoverRecordsByHead(head.handoverId))
}

function toReceiptFact(record: PdaHandoverRecord): SewingDeliveryReceiptFact | null {
  const submittedQty = validNonNegativeQty(record.submittedQty ?? record.plannedQty)
  const receivedQty = validNonNegativeQty(record.receiverWrittenQty)
  if (submittedQty === null || receivedQty === null || !record.receiverWrittenAt) return null
  return {
    recordId: record.handoverRecordId || record.recordId,
    submittedQty,
    submittedAt: record.factorySubmittedAt,
    receivedQty,
    receivedAt: record.receiverWrittenAt,
    voided: isVoided(record),
  }
}

function buildView(
  runtimeTaskId: string,
  snapshot: SewingDeliverySlaSnapshot,
  records: PdaHandoverRecord[],
  nowAt: string,
): SewingDeliverySlaView {
  const submittedQty = records.reduce((sum, record) => {
    if (isVoided(record)) return sum
    return sum + (validNonNegativeQty(record.submittedQty ?? record.plannedQty) ?? 0)
  }, 0)
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

export function getSewingDeliverySlaView(
  runtimeTaskId: string,
  nowAt: string = formatOperationLocalWallClock(),
): SewingDeliverySlaView | null {
  const task = getRuntimeTaskById(runtimeTaskId)
  const snapshot = getSewingDeliverySlaSnapshot(runtimeTaskId)
  const slaKind = task ? classifySewingDeliverySla(task) : null
  if (!snapshot?.active || slaKind === null || snapshot.slaKind !== slaKind) return null
  return buildView(runtimeTaskId, snapshot, listTaskHandoutRecords(runtimeTaskId), nowAt)
}

export function listSewingDeliverySlaViews(
  nowAt: string = formatOperationLocalWallClock(),
): readonly SewingDeliverySlaView[] {
  const snapshotsByTaskId = new Map<string, SewingDeliverySlaSnapshot>()
  listRuntimeExecutionTasks().forEach((task) => {
    const slaKind = classifySewingDeliverySla(task)
    if (slaKind === null) return
    const snapshot = getSewingDeliverySlaSnapshot(task.taskId)
    if (snapshot?.active && snapshot.slaKind === slaKind) snapshotsByTaskId.set(task.taskId, snapshot)
  })
  const targetTaskIds = new Set(snapshotsByTaskId.keys())
  const recordsByTaskId = new Map<string, PdaHandoverRecord[]>()
  listPdaHandoverHeads().forEach((head) => {
    if (head.headType !== 'HANDOUT' || !targetTaskIds.has(head.taskId)) return
    const records = recordsByTaskId.get(head.taskId) ?? []
    records.push(...getPdaHandoverRecordsByHead(head.handoverId))
    recordsByTaskId.set(head.taskId, records)
  })
  const views = Array.from(snapshotsByTaskId.entries()).map(([runtimeTaskId, snapshot]) =>
    buildView(runtimeTaskId, snapshot, recordsByTaskId.get(runtimeTaskId) ?? [], nowAt),
  )
  return Object.freeze(views)
}
