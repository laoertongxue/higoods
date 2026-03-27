import { getPdaCuttingTaskSnapshot } from '../data/fcs/pda-cutting-execution-source.ts'

export function buildPdaCuttingSpreadingProjection(taskId: string, executionKey?: string) {
  return getPdaCuttingTaskSnapshot(taskId, executionKey)
}

