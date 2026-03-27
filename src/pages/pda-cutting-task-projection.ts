import {
  getPdaCuttingTaskSnapshot,
  getPdaTaskFlowTaskById,
  listPdaTaskFlowProjectedTasks,
} from '../data/fcs/pda-cutting-execution-source.ts'

export function buildPdaCuttingTaskListProjection() {
  return listPdaTaskFlowProjectedTasks()
}

export function buildPdaCuttingTaskDetailProjection(taskId: string, executionKey?: string) {
  return getPdaCuttingTaskSnapshot(taskId, executionKey)
}

export function getPdaCuttingProjectedTaskById(taskId: string) {
  return getPdaTaskFlowTaskById(taskId)
}

