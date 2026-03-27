import { getPdaCuttingTaskSnapshot } from '../data/fcs/pda-cutting-execution-source.ts'

export function buildPdaCuttingHandoverProjection(taskId: string, executionKey?: string) {
  return getPdaCuttingTaskSnapshot(taskId, executionKey)
}

