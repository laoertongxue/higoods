import {
  listPdaCuttingExecutionSourceRecordsFromScenarios,
  listPdaCuttingTaskSourceRecordsFromScenarios,
} from './pda-cutting-task-scenarios.ts'

export type PdaExecutionBindingState = 'BOUND' | 'UNBOUND'

export interface PdaCuttingExecutionSourceRecord {
  taskId: string
  taskNo: string
  executionOrderId: string
  executionOrderNo: string
  legacyCutPieceOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  originalCutOrderId: string
  originalCutOrderNo: string
  mergeBatchId: string
  mergeBatchNo: string
  materialSku: string
  bindingState: PdaExecutionBindingState
}

export interface PdaCuttingTaskSourceRecord {
  taskId: string
  taskNo: string
  productionOrderId: string
  productionOrderNo: string
  executionOrderIds: string[]
  executionOrderNos: string[]
  bindingState: PdaExecutionBindingState
}

const PDA_CUTTING_EXECUTION_SOURCE_RECORDS: PdaCuttingExecutionSourceRecord[] =
  listPdaCuttingExecutionSourceRecordsFromScenarios()

const PDA_CUTTING_TASK_SOURCE_RECORDS: PdaCuttingTaskSourceRecord[] =
  listPdaCuttingTaskSourceRecordsFromScenarios()

export function listPdaCuttingExecutionSourceRecords(): PdaCuttingExecutionSourceRecord[] {
  return PDA_CUTTING_EXECUTION_SOURCE_RECORDS.map((record) => ({ ...record }))
}

export function getPdaCuttingExecutionSourceRecord(taskId: string, executionOrderNo: string): PdaCuttingExecutionSourceRecord | null {
  return PDA_CUTTING_EXECUTION_SOURCE_RECORDS.find((record) => record.taskId === taskId && record.executionOrderNo === executionOrderNo) ?? null
}

export function listPdaCuttingTaskSourceRecords(): PdaCuttingTaskSourceRecord[] {
  return PDA_CUTTING_TASK_SOURCE_RECORDS.map((record) => ({
    ...record,
    executionOrderIds: [...record.executionOrderIds],
    executionOrderNos: [...record.executionOrderNos],
  }))
}

export function getPdaCuttingTaskSourceRecord(taskId: string): PdaCuttingTaskSourceRecord | null {
  return listPdaCuttingTaskSourceRecords().find((record) => record.taskId === taskId) ?? null
}
