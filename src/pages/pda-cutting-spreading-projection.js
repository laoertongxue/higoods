import { getPdaCuttingTaskSnapshot } from '../data/fcs/pda-cutting-execution-source.ts';
export function buildPdaCuttingSpreadingProjection(taskId, executionKey) {
    return getPdaCuttingTaskSnapshot(taskId, executionKey);
}
