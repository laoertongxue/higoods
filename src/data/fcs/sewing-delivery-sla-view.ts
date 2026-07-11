import {
  classifySewingDeliverySla,
  formatOperationLocalWallClock,
  listAllSewingDeliverySlaSnapshots,
  listSewingDeliverySlaSnapshotHistory,
  projectSewingDeliverySla,
  type SewingDeliverySlaProjection,
  type SewingDeliverySlaSnapshot,
  type SewingDeliveryReceiptFact,
} from './sewing-delivery-sla.ts'
import { getRuntimeTaskById, listRuntimeProcessTasks, type RuntimeProcessTask } from './runtime-process-tasks.ts'
import type { PdaHandoverRecord } from './pda-handover-events.ts'
import { listLatestSewingDeliveryRawRecords, toConfirmedSewingDeliveryReceiptFact } from './sewing-delivery-receipt-facts.ts'

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

function buildView(
  runtimeTaskId: string,
  snapshot: SewingDeliverySlaSnapshot,
  records: PdaHandoverRecord[],
  nowAt: string,
): SewingDeliverySlaView {
  const taskRecords = records.filter((record) => record.taskId === runtimeTaskId)
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
  nowAt: string,
  task: RuntimeProcessTask | null = getRuntimeTaskById(runtimeTaskId),
  snapshot: SewingDeliverySlaSnapshot | null = listSewingDeliverySlaSnapshotHistory(runtimeTaskId)
    .filter((candidate) => candidate.acceptedAt <= nowAt)
    .at(-1) ?? null,
): SewingDeliverySlaSnapshot | null {
  if (!snapshot) return null
  if (!task) return snapshot
  return classifySewingDeliverySla(task) === snapshot.slaKind ? snapshot : null
}

export function getSewingDeliverySlaView(
  runtimeTaskId: string,
  nowAt: string = formatOperationLocalWallClock(),
): SewingDeliverySlaView | null {
  const snapshot = resolveEligibleSnapshot(runtimeTaskId, nowAt)
  if (!snapshot) return null
  return buildView(runtimeTaskId, snapshot, listLatestSewingDeliveryRawRecords(nowAt).filter((record) => record.taskId === runtimeTaskId), nowAt)
}


export function listSewingDeliverySlaViews(
  nowAt: string = formatOperationLocalWallClock(),
  runtimeTaskIds?: readonly string[],
): readonly SewingDeliverySlaView[] {
  const requestedTaskIds = runtimeTaskIds ? new Set(runtimeTaskIds) : null
  const snapshotsByTaskId = new Map<string, SewingDeliverySlaSnapshot>()
  const latestSnapshotByTaskId = new Map<string, SewingDeliverySlaSnapshot>()
  listAllSewingDeliverySlaSnapshots()
    .filter((snapshot) => snapshot.acceptedAt <= nowAt)
    .forEach((snapshot) => latestSnapshotByTaskId.set(snapshot.runtimeTaskId, snapshot))
  const candidateTaskIds = requestedTaskIds ?? new Set(latestSnapshotByTaskId.keys())
  const runtimeTaskById = new Map(listRuntimeProcessTasks().map((task) => [task.taskId, task] as const))
  candidateTaskIds.forEach((taskId) => {
    const snapshot = resolveEligibleSnapshot(
      taskId,
      nowAt,
      runtimeTaskById.get(taskId) ?? null,
      latestSnapshotByTaskId.get(taskId) ?? null,
    )
    if (snapshot) snapshotsByTaskId.set(taskId, snapshot)
  })
  const targetTaskIds = new Set(snapshotsByTaskId.keys())
  const recordsByTaskId = new Map<string, PdaHandoverRecord[]>()
  listLatestSewingDeliveryRawRecords(nowAt).forEach((record) => {
    if (!targetTaskIds.has(record.taskId)) return
    const records = recordsByTaskId.get(record.taskId) ?? []
    records.push(record)
    recordsByTaskId.set(record.taskId, records)
  })
  const views = Array.from(snapshotsByTaskId.entries()).map(([runtimeTaskId, snapshot]) =>
    buildView(runtimeTaskId, snapshot, recordsByTaskId.get(runtimeTaskId) ?? [], nowAt),
  )
  return Object.freeze(views)
}
