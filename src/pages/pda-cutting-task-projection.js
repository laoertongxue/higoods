import { getPdaCuttingTaskSnapshot, getPdaTaskFlowTaskById, listPdaTaskFlowProjectedTasks, } from '../data/fcs/pda-cutting-execution-source.ts';
export function buildPdaCuttingTaskListProjection() {
    return listPdaTaskFlowProjectedTasks();
}
export function buildPdaCuttingTaskDetailProjection(taskId, executionKey) {
    return getPdaCuttingTaskSnapshot(taskId, executionKey);
}
export function getPdaCuttingProjectedTaskById(taskId) {
    return getPdaTaskFlowTaskById(taskId);
}
