import {
  classifySewingDeliverySla,
  formatOperationLocalWallClock,
  getLatestSewingDeliverySlaSnapshot,
  listAllSewingDeliverySlaSnapshots,
  listSewingDeliverySlaSnapshotHistory,
  projectSewingDeliverySla,
  type SewingDeliverySlaProjection,
  type SewingDeliverySlaSnapshot,
  type SewingDeliveryReceiptFact,
} from './sewing-delivery-sla.ts'
import { getRuntimeTaskById, listRuntimeExecutionTasks } from './runtime-process-tasks.ts'
import type { PdaHandoverRecord } from './pda-handover-events.ts'
import { listRegisteredHandoutHeads, listRegisteredHandoutRecords } from './pda-handover-handout-registry.ts'
import { toConfirmedSewingDeliveryReceiptFact } from './sewing-delivery-receipt-facts.ts'

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
  return listRegisteredHandoutHeads()
    .filter((head) => head.taskId === runtimeTaskId)
    .flatMap((head) => listRegisteredHandoutRecords(head.handoverId))
    .filter((record) => record.taskId === runtimeTaskId)
}

function buildView(
  runtimeTaskId: string,
  snapshot: SewingDeliverySlaSnapshot,
  records: PdaHandoverRecord[],
  nowAt: string,
): SewingDeliverySlaView {
  const taskRecords = records.filter((record) => record.taskId === runtimeTaskId)
  const submittedQty = taskRecords.reduce((sum, record) => {
    if (isVoided(record)) return sum
    return sum + (validNonNegativeQty(record.submittedQty ?? record.plannedQty) ?? 0)
  }, 0)
  const receipts = taskRecords
    .map((record) => toConfirmedSewingDeliveryReceiptFact(record, runtimeTaskId))
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
  const snapshot = getLatestSewingDeliverySlaSnapshot(runtimeTaskId)
  const slaKind = task ? classifySewingDeliverySla(task) : null
  if (!snapshot || slaKind === null || snapshot.slaKind !== slaKind) return null
  return buildView(runtimeTaskId, snapshot, listTaskHandoutRecords(runtimeTaskId), nowAt)
}


export function listSewingDeliverySlaViews(
  nowAt: string = formatOperationLocalWallClock(),
  runtimeTaskIds?: readonly string[],
): readonly SewingDeliverySlaView[] {
  const requestedTaskIds = runtimeTaskIds ? new Set(runtimeTaskIds) : null
  const snapshotsByTaskId = new Map<string, SewingDeliverySlaSnapshot>()
  listRuntimeExecutionTasks().forEach((task) => {
    if (requestedTaskIds && !requestedTaskIds.has(task.taskId)) return
    const slaKind = classifySewingDeliverySla(task)
    if (slaKind === null) return
    const snapshot = getLatestSewingDeliverySlaSnapshot(task.taskId)
    if (snapshot && snapshot.slaKind === slaKind) snapshotsByTaskId.set(task.taskId, snapshot)
  })
  listAllSewingDeliverySlaSnapshots().forEach((snapshot) => {
    if (requestedTaskIds && !requestedTaskIds.has(snapshot.runtimeTaskId)) return
    const task = getRuntimeTaskById(snapshot.runtimeTaskId)
    const slaKind = task ? classifySewingDeliverySla(task) : null
    if (slaKind !== snapshot.slaKind) return
    snapshotsByTaskId.set(snapshot.runtimeTaskId, getLatestSewingDeliverySlaSnapshot(snapshot.runtimeTaskId) ?? snapshot)
  })
  if (requestedTaskIds) {
    requestedTaskIds.forEach((taskId) => {
      if (snapshotsByTaskId.has(taskId)) return
      const history = listSewingDeliverySlaSnapshotHistory(taskId)
      const snapshot = history.at(-1)
      if (snapshot) snapshotsByTaskId.set(taskId, snapshot)
    })
  }
  const targetTaskIds = new Set(snapshotsByTaskId.keys())
  const recordsByTaskId = new Map<string, PdaHandoverRecord[]>()
  listRegisteredHandoutHeads().forEach((head) => {
    if (!targetTaskIds.has(head.taskId)) return
    const records = recordsByTaskId.get(head.taskId) ?? []
    records.push(...listRegisteredHandoutRecords(head.handoverId).filter((record) => record.taskId === head.taskId))
    recordsByTaskId.set(head.taskId, records)
  })
  const views = Array.from(snapshotsByTaskId.entries()).map(([runtimeTaskId, snapshot]) =>
    buildView(runtimeTaskId, snapshot, recordsByTaskId.get(runtimeTaskId) ?? [], nowAt),
  )
  return Object.freeze(views)
}
