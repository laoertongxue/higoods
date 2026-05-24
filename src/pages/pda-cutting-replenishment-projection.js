import { getPdaCuttingTaskSnapshot } from '../data/fcs/pda-cutting-execution-source.ts';
export function buildPdaCuttingReplenishmentProjection(taskId, executionKey) {
    return getPdaCuttingTaskSnapshot(taskId, executionKey);
}
