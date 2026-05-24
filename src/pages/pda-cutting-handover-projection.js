import { getPdaCuttingTaskSnapshot } from '../data/fcs/pda-cutting-execution-source.ts';
export function buildPdaCuttingHandoverProjection(taskId, executionKey) {
    return getPdaCuttingTaskSnapshot(taskId, executionKey);
}
