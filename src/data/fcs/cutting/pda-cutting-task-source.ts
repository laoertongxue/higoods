import { listGeneratedCutOrderSourceRecords } from './generated-cut-orders.ts'
import {
  listPdaCuttingExecutionSourceRecordsFromScenarios,
  listPdaCuttingTaskSourceRecordsFromScenarios,
} from './pda-cutting-task-scenarios.ts'
import type { PdaCuttingExecutionObjectType } from './pda-cutting-mock-matrix.ts'

export type PdaExecutionBindingState = 'BOUND' | 'UNBOUND'
export type PdaCuttingReportMode = 'INDEPENDENT_CUTTING_EXECUTION'

export interface PdaCuttingExecutionSourceRecord {
  taskId: string
  taskNo: string
  executionOrderId: string
  executionOrderNo: string
  legacyCutPieceOrderNo?: string
  executionObjectType: PdaCuttingExecutionObjectType
  productionOrderId: string
  productionOrderNo: string
  cutOrderId: string
  cutOrderNo: string
  markerPlanId: string
  markerPlanNo: string
  materialSku: string
  materialAlias?: string
  materialImageUrl?: string
  bindingState: PdaExecutionBindingState
  cuttingReportMode: PdaCuttingReportMode
}

export interface PdaCuttingTaskSourceRecord {
  taskId: string
  taskNo: string
  productionOrderId: string
  productionOrderNo: string
  cutOrderIds: string[]
  cutOrderNos: string[]
  executionOrderIds: string[]
  executionOrderNos: string[]
  bindingState: PdaExecutionBindingState
  cuttingReportMode: PdaCuttingReportMode
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
  const records = PDA_CUTTING_TASK_SOURCE_RECORDS.map(record => ({ ...record }))
  const existing = new Set(records.map(record => record.taskId))
  const cuts = listGeneratedCutOrderSourceRecords()
  for (const cut of cuts) {
    if (cut.cutOrderSourceType !== 'INDEPENDENT_CUTTING_TASK'
      || existing.has(cut.cuttingTaskId) || cut.cuttingTaskId.startsWith('CUTTASK-')) continue
    const linked = cuts.filter(item => item.cuttingTaskId === cut.cuttingTaskId)
    records.push({ taskId: cut.cuttingTaskId, taskNo: cut.cuttingTaskNo,
      productionOrderId: cut.productionOrderId, productionOrderNo: cut.productionOrderNo,
      cutOrderIds: linked.map(item => item.cutOrderId), cutOrderNos: linked.map(item => item.cutOrderNo),
      executionOrderIds: [], executionOrderNos: [], bindingState: 'BOUND',
      cuttingReportMode: 'INDEPENDENT_CUTTING_EXECUTION' })
    existing.add(cut.cuttingTaskId)
  }
  return records.map((record) => ({
    ...record,
    cutOrderIds: [...record.cutOrderIds],
    cutOrderNos: [...record.cutOrderNos],
    executionOrderIds: [...record.executionOrderIds],
    executionOrderNos: [...record.executionOrderNos],
  }))
}

export function getPdaCuttingTaskSourceRecord(taskId: string): PdaCuttingTaskSourceRecord | null {
  return listPdaCuttingTaskSourceRecords().find((record) => record.taskId === taskId) ?? null
}
