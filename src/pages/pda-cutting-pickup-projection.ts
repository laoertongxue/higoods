import { buildPdaCuttingPickupActionView } from '../domain/pickup/page-adapters/pda-cutting-pickup.ts'
import { getPdaCuttingTaskSnapshot } from '../data/fcs/pda-cutting-execution-source.ts'

export function buildPdaCuttingPickupProjection(taskId: string, executionKey?: string) {
  const detail = getPdaCuttingTaskSnapshot(taskId, executionKey)
  if (!detail) return null
  return {
    detail,
    pickupView: buildPdaCuttingPickupActionView(taskId, executionKey ?? detail.executionOrderId),
  }
}

