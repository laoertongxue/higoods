import { createInventoryPostFinishingQcTask, registerPostFinishingInventoryQcCompletion, getPostFinishingFullFlowQcTask, getPostFinishingActiveQcTask, getCurrentPostFinishingActor } from './post-finishing-full-flow.ts'
import { completeFinishedInventoryQc, registerFinishedInventoryQcBridge } from '../wls/finished-inventory-quality.ts'
import { ensureFinishedInventoryRecords, inventoryTransactionParticipant } from '../wls/finished-inventory-records.ts'

/** Prepare the existing two business domains; no writes or seed copying on entry. */
export async function preparePostFinishingInventoryBridge(): Promise<void> {
  await ensureFinishedInventoryRecords()
  registerFinishedInventoryQcBridge({ receiveIntoQc: createInventoryPostFinishingQcTask })
  registerPostFinishingInventoryQcCompletion(completeFinishedInventoryQc)
}
export {isPreparedInventoryQcRoute,isPreparedQcRoute} from './post-finishing-qc-entry.ts'

export { inventoryTransactionParticipant }

// Callers that coordinate inventory QC use these same registered domain instances.
export {
  uploadPostFinishingDeliveryQcReference, uploadPostFinishingQcTaskReference,
  claimPostFinishingQcTask, submitPostFinishingQcRound, upgradePostFinishingQcInspection, completePostFinishingQcTask,
  attachPostFinishingQcSignedPaper, getPostFinishingQcInspectionSummary, getPostFinishingFullFlowQcTask,
  listPostFinishingFullFlowQcTasks, listPostFinishingFullFlowOutboundOrders, listPostFinishingFullFlowRecheckOrders,
  listPostFinishingFactoryReturns, listPostFinishingReturnConfirmationVersions, POST_FINISHING_ACCEPTANCE_ACTORS,
} from './post-finishing-full-flow.ts'
export { runPostFinishingCommand, ensurePostFinishingRecordState, ensurePostFinishingExecutionRecordState, ensurePreparedPostFinishingRecordState, registerPostFinishingFile,
  getPostFinishingStorageFailure } from './post-finishing-records.ts'
export { ensureQualityManagementRecords, buildQualityConfigurationDraft, saveQualityConfigurationDraft,
  publishQualityConfiguration, readPreparedInspectionSnapshot, readInspectionSnapshot, qualityConfigurationGuard } from './quality-management-records.ts'
export { listFinishedInventoryLots, previewFinishedInventoryQuality, runFinishedInventoryCommand,
  createFinishedInventoryQualityApplication, receiveFinishedInventoryQualityApplication,
  getFinishedInventoryApplication, listFinishedInventoryTransfers } from '../wls/finished-inventory-quality.ts'
export { FINISHED_INVENTORY_NAMESPACE, captureFinishedInventoryState, ensureFinishedInventoryRecords } from '../wls/finished-inventory-records.ts'
export { hydrateProductionContextRecords } from './production-context-records.ts'
