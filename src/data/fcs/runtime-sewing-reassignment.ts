import {
  commitRuntimeSewingTaskReassignment,
  captureRuntimeDirectDispatchState,
  restoreRuntimeDirectDispatchState,
  type RuntimeSewingTaskReassignmentResult,
} from './runtime-process-tasks.ts'
import { sumSewingDeliveryConfirmedReceiptQty } from './sewing-delivery-receipt-facts.ts'
import { captureSewingDeliverySlaSnapshotStore, restoreSewingDeliverySlaSnapshotStore } from './sewing-delivery-sla.ts'

export interface RuntimeSewingReassignmentInput {
  sourceTaskId: string
  targetFactoryId: string
  targetFactoryName: string
  businessAssignedAt: string
  operatedAt: string
  reason: string
  by: string
  mainFactoryId?: string
}

export function reassignRuntimeSewingTask(
  input: RuntimeSewingReassignmentInput,
): RuntimeSewingTaskReassignmentResult {
  const runtimeState = captureRuntimeDirectDispatchState()
  const slaState = captureSewingDeliverySlaSnapshotStore()
  try {
    const result = commitRuntimeSewingTaskReassignment({
      ...input,
      confirmedReceivedQty: sumSewingDeliveryConfirmedReceiptQty(input.sourceTaskId),
    })
    if (!result.ok) {
      restoreRuntimeDirectDispatchState(runtimeState)
      restoreSewingDeliverySlaSnapshotStore(slaState)
    }
    return result
  } catch (error) {
    restoreRuntimeDirectDispatchState(runtimeState)
    restoreSewingDeliverySlaSnapshotStore(slaState)
    return { ok: false, message: error instanceof Error ? error.message : '改派失败' }
  }
}
