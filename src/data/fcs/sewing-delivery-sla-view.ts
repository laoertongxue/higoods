import {
  classifySewingDeliverySla,
  formatOperationLocalWallClock,
  getLatestSewingDeliverySlaSnapshot,
  listAllSewingDeliverySlaSnapshots,
  projectSewingDeliverySla,
  type SewingDeliverySlaProjection,
  type SewingDeliverySlaSnapshot,
  type SewingDeliveryReceiptFact,
} from './sewing-delivery-sla.ts'
import { getRuntimeTaskById, listRuntimeProcessTasks, type RuntimeProcessTask } from './runtime-process-tasks.ts'
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
  const taskRecordById = new Map<string, PdaHandoverRecord>()
  records.filter((record) => record.taskId === runtimeTaskId).forEach((record) => {
    const recordId = record.handoverRecordId || record.recordId
    const current = taskRecordById.get(recordId)
    const recordTime = record.receiverWrittenAt || record.factorySubmittedAt
    const currentTime = current ? (current.receiverWrittenAt || current.factorySubmittedAt) : ''
    if (!current || recordTime > currentTime || (recordTime === currentTime && JSON.stringify(record) > JSON.stringify(current))) {
      taskRecordById.set(recordId, record)
    }
  })
  const taskRecords = Array.from(taskRecordById.values())
  const submittedQty = taskRecords.reduce((sum, record) => {
    if (isVoided(record) || record.factorySubmittedAt > nowAt) return sum
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

function resolveEligibleSnapshot(
  runtimeTaskId: string,
  task: RuntimeProcessTask | null = getRuntimeTaskById(runtimeTaskId),
  snapshot: SewingDeliverySlaSnapshot | null = getLatestSewingDeliverySlaSnapshot(runtimeTaskId),
): SewingDeliverySlaSnapshot | null {
  if (!snapshot) return null
  if (!task) return snapshot
  return classifySewingDeliverySla(task) === snapshot.slaKind ? snapshot : null
}

export function getSewingDeliverySlaView(
  runtimeTaskId: string,
  nowAt: string = formatOperationLocalWallClock(),
): SewingDeliverySlaView | null {
  const snapshot = resolveEligibleSnapshot(runtimeTaskId)
  if (!snapshot) return null
  return buildView(runtimeTaskId, snapshot, listTaskHandoutRecords(runtimeTaskId), nowAt)
}


export function listSewingDeliverySlaViews(
  nowAt: string = formatOperationLocalWallClock(),
  runtimeTaskIds?: readonly string[],
): readonly SewingDeliverySlaView[] {
  const requestedTaskIds = runtimeTaskIds ? new Set(runtimeTaskIds) : null
  const snapshotsByTaskId = new Map<string, SewingDeliverySlaSnapshot>()
  const latestSnapshotByTaskId = new Map<string, SewingDeliverySlaSnapshot>()
  listAllSewingDeliverySlaSnapshots().forEach((snapshot) => latestSnapshotByTaskId.set(snapshot.runtimeTaskId, snapshot))
  const candidateTaskIds = requestedTaskIds ?? new Set(latestSnapshotByTaskId.keys())
  const runtimeTaskById = new Map(listRuntimeProcessTasks().map((task) => [task.taskId, task] as const))
  candidateTaskIds.forEach((taskId) => {
    const snapshot = resolveEligibleSnapshot(
      taskId,
      runtimeTaskById.get(taskId) ?? null,
      latestSnapshotByTaskId.get(taskId) ?? null,
    )
    if (snapshot) snapshotsByTaskId.set(taskId, snapshot)
  })
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
