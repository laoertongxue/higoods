import {
  getEffectiveDyeingFulfillment,
  listCombinedDyeingTasks,
  type CombinedDyeingAllocationVersion,
  type CombinedDyeingSatisfaction,
  type CombinedDyeingTask,
} from './combined-dyeing-domain.ts'
import type {
  DyeWorkOrder,
} from './dyeing-task-domain.ts'
import type {
  ProcessWorkOrderAutoSyncRecord,
  ProcessWorkOrderChangeImpact,
} from './process-work-order-domain.ts'

export interface DyeWorkOrderCombinedDyeingView {
  activeTask?: CombinedDyeingTask
  occupiedByActiveTask: boolean
  requiredQty: number
  currentEffectiveAllocationQty: number
  unmetQty: number
  satisfaction: CombinedDyeingSatisfaction
  allocationVersions: CombinedDyeingAllocationVersion[]
  history: CombinedDyeingTask[]
  changeImpacts: ProcessWorkOrderChangeImpact[]
  autoSyncHistory: ProcessWorkOrderAutoSyncRecord[]
}

export function buildDyeWorkOrderCombinedDyeingView(
  order: DyeWorkOrder,
): DyeWorkOrderCombinedDyeingView | undefined {
  if (order.sourceType !== 'PRODUCTION_ORDER') return undefined

  const history = listCombinedDyeingTasks({ includeDeleted: true })
    .filter((task) => task.members.some((member) => member.dyeWorkOrderId === order.dyeOrderId))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.taskNo.localeCompare(left.taskNo, 'zh-CN'))
  if (history.length === 0 && !(order.changeImpact?.length || order.autoSyncHistory?.length)) return undefined

  const activeTask = history.find((task) => task.status !== 'DELETED')
  const fulfillment = getEffectiveDyeingFulfillment(order.dyeOrderId)
  const requiredQty = fulfillment.requiredQty > 0 ? fulfillment.requiredQty : order.plannedQty
  const currentEffectiveAllocationQty = fulfillment.requiredQty > 0 ? fulfillment.effectiveSatisfiedQty : 0
  const unmetQty = Math.max(0, requiredQty - currentEffectiveAllocationQty)
  const satisfaction: CombinedDyeingSatisfaction = unmetQty === 0
    ? 'FULL'
    : currentEffectiveAllocationQty > 0 ? 'PARTIAL' : 'UNMET'
  const allocationVersions = history.flatMap((task) => task.allocationVersions.map((version) => ({
    ...structuredClone(version),
    excessQty: version.excessQty,
  })))

  return {
    activeTask: activeTask ? structuredClone(activeTask) : undefined,
    occupiedByActiveTask: Boolean(activeTask),
    requiredQty,
    currentEffectiveAllocationQty,
    unmetQty,
    satisfaction,
    allocationVersions,
    history: structuredClone(history),
    changeImpacts: structuredClone(order.changeImpact ?? []),
    autoSyncHistory: structuredClone(order.autoSyncHistory ?? []),
  }
}
