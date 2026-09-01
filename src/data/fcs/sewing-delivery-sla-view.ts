import {
  classifySewingDeliverySla,
  formatOperationLocalWallClock,
  listAllSewingDeliverySlaSnapshots,
  listSewingDeliverySlaSnapshotHistory,
  projectSewingDeliverySla,
  type SewingDeliverySlaProjection,
  type SewingDeliverySlaSnapshot,
} from './sewing-delivery-sla.ts'
import { getRuntimeTaskById, listRuntimeProcessTasks, type RuntimeProcessTask } from './runtime-process-tasks.ts'
import {
  listSewingDeliveryReceiptFacts,
  listSewingDeliverySubmissionFacts,
} from './sewing-delivery-receipt-facts.ts'

export interface SewingDeliverySlaView {
  readonly runtimeTaskId: string
  readonly submittedQty: number
  readonly confirmedReceivedQty: number
  readonly projection: SewingDeliverySlaProjection
}

function buildView(
  runtimeTaskId: string,
  snapshot: SewingDeliverySlaSnapshot,
  nowAt: string,
): SewingDeliverySlaView {
  const submittedQty = listSewingDeliverySubmissionFacts(runtimeTaskId, nowAt)
    .reduce((sum, record) => sum + record.submittedQty, 0)
  const receipts = listSewingDeliveryReceiptFacts(runtimeTaskId, nowAt)
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
  return buildView(runtimeTaskId, snapshot, nowAt)
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
  const views = Array.from(snapshotsByTaskId.entries()).map(([runtimeTaskId, snapshot]) =>
    buildView(runtimeTaskId, snapshot, nowAt),
  )
  return Object.freeze(views)
}
