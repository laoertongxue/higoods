import { buildPdaCuttingTaskPickupView } from './pda-cutting-task-detail'

export function buildPdaCuttingPickupActionView(taskId: string, cutPieceOrderNo?: string | null) {
  return buildPdaCuttingTaskPickupView(taskId, cutPieceOrderNo)
}
