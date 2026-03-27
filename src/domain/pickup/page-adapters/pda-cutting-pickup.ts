import { buildPdaCuttingTaskPickupView } from './pda-cutting-task-detail'

export function buildPdaCuttingPickupActionView(taskId: string, executionKey?: string | null) {
  return buildPdaCuttingTaskPickupView(taskId, executionKey)
}
