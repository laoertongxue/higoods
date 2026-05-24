import { getPdaCuttingTaskSnapshot } from '../data/fcs/pda-cutting-execution-source.ts';
export function buildPdaCuttingInboundProjection(taskId, executionKey) {
    return getPdaCuttingTaskSnapshot(taskId, executionKey);
}
