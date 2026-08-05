import { listEffectiveTaskAssignmentAuditLogs, listEffectiveTaskAssignments } from './effective-task-assignments'
import { listProductionContracts, listMissingSignedContractScanTodos, listProductionContractAuditLogs } from './production-contracts'
import { listProductionReturnReceipts, listProductionReturnReminderLogs } from './production-return-fulfillment'

export interface DispatchFulfillmentAuditSnapshot {
  generatedAt: string
  assignments: ReturnType<typeof listEffectiveTaskAssignments>
  assignmentAuditLogs: ReturnType<typeof listEffectiveTaskAssignmentAuditLogs>
  contracts: ReturnType<typeof listProductionContracts>
  contractAuditLogs: ReturnType<typeof listProductionContractAuditLogs>
  missingSignedScanTodos: ReturnType<typeof listMissingSignedContractScanTodos>
  returnReceipts: ReturnType<typeof listProductionReturnReceipts>
  reminderLogs: ReturnType<typeof listProductionReturnReminderLogs>
}

export function buildDispatchFulfillmentAuditSnapshot(generatedAt: string): DispatchFulfillmentAuditSnapshot {
  return {
    generatedAt,
    assignments: listEffectiveTaskAssignments(),
    assignmentAuditLogs: listEffectiveTaskAssignmentAuditLogs(),
    contracts: listProductionContracts(),
    contractAuditLogs: listProductionContractAuditLogs(),
    missingSignedScanTodos: listMissingSignedContractScanTodos(),
    returnReceipts: listProductionReturnReceipts(),
    reminderLogs: listProductionReturnReminderLogs(),
  }
}
