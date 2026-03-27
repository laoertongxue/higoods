import { getPdaCuttingTaskSnapshot } from '../data/fcs/pda-cutting-execution-source.ts'

export function buildPdaCuttingReplenishmentProjection(taskId: string, executionKey?: string) {
  return getPdaCuttingTaskSnapshot(taskId, executionKey)
}
