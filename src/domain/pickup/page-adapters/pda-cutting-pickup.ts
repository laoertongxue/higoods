import { buildPdaCuttingTaskPickupView } from './pda-cutting-task-detail.ts'

export function buildPdaCuttingPickupActionView(taskId: string, executionKey?: string | null) {
  return buildPdaCuttingTaskPickupView(taskId, executionKey)
}
