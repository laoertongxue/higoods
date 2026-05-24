import { listPdaCuttingExecutionSourceRecordsFromScenarios, listPdaCuttingTaskSourceRecordsFromScenarios, } from './pda-cutting-task-scenarios.ts';
const PDA_CUTTING_EXECUTION_SOURCE_RECORDS = listPdaCuttingExecutionSourceRecordsFromScenarios();
const PDA_CUTTING_TASK_SOURCE_RECORDS = listPdaCuttingTaskSourceRecordsFromScenarios();
export function listPdaCuttingExecutionSourceRecords() {
    return PDA_CUTTING_EXECUTION_SOURCE_RECORDS.map((record) => ({ ...record }));
}
export function getPdaCuttingExecutionSourceRecord(taskId, executionOrderNo) {
    return PDA_CUTTING_EXECUTION_SOURCE_RECORDS.find((record) => record.taskId === taskId && record.executionOrderNo === executionOrderNo) ?? null;
}
export function listPdaCuttingTaskSourceRecords() {
    return PDA_CUTTING_TASK_SOURCE_RECORDS.map((record) => ({
        ...record,
        executionOrderIds: [...record.executionOrderIds],
        executionOrderNos: [...record.executionOrderNos],
    }));
}
export function getPdaCuttingTaskSourceRecord(taskId) {
    return listPdaCuttingTaskSourceRecords().find((record) => record.taskId === taskId) ?? null;
}
