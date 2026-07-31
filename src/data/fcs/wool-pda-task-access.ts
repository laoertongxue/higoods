import type { ProcessTask } from './process-tasks.ts'
import {
  getWoolWorkOrderByTaskId,
  listWoolMobileProcessTasks,
  type WoolWorkOrder,
} from './wool-task-domain.ts'

export type WoolPdaTaskAccessReason =
  | 'OK'
  | 'SESSION_MISSING'
  | 'TASK_MISSING'
  | 'TASK_FACTORY_MISMATCH'
  | 'WOOL_ORDER_TASK_MISMATCH'

export interface WoolPdaTaskAccessResult {
  canAccess: boolean
  reasonCode: WoolPdaTaskAccessReason
  reasonLabel: string
  order: WoolWorkOrder | null
  task: ProcessTask | null
}

export function validateWoolPdaTaskAccess(params: {
  taskId: string
  woolOrderId?: string
  currentFactoryId?: string
}): WoolPdaTaskAccessResult {
  const taskId = params.taskId.trim()
  const currentFactoryId = params.currentFactoryId?.trim() || ''
  if (!currentFactoryId) {
    return {
      canAccess: false,
      reasonCode: 'SESSION_MISSING',
      reasonLabel: '当前 PDA 登录会话无效，请重新登录后操作。',
      order: null,
      task: null,
    }
  }

  let order: WoolWorkOrder | null = null
  try {
    order = getWoolWorkOrderByTaskId(taskId) ?? null
  } catch {
    return {
      canAccess: false,
      reasonCode: 'WOOL_ORDER_TASK_MISMATCH',
      reasonLabel: '当前任务未唯一绑定毛织加工单，已阻止操作。',
      order: null,
      task: null,
    }
  }
  const matchedTasks = listWoolMobileProcessTasks().filter((task) => task.taskId === taskId)
  const task = matchedTasks.length === 1 ? matchedTasks[0] : null
  if (!order || !task || (params.woolOrderId && order.woolOrderId !== params.woolOrderId)) {
    return {
      canAccess: false,
      reasonCode: order && task ? 'WOOL_ORDER_TASK_MISMATCH' : 'TASK_MISSING',
      reasonLabel: order && task
        ? '当前任务与毛织加工单不匹配，已阻止操作。'
        : '当前任务没有唯一对应的毛织加工单或移动执行任务，已阻止操作。',
      order,
      task,
    }
  }
  if (
    order.taskId !== taskId
    || task.taskId !== taskId
    || String((task as ProcessTask & { woolOrderId?: string }).woolOrderId || '') !== order.woolOrderId
  ) {
    return {
      canAccess: false,
      reasonCode: 'WOOL_ORDER_TASK_MISMATCH',
      reasonLabel: '当前任务与毛织加工单绑定不一致，已阻止操作。',
      order,
      task,
    }
  }
  if (order.factoryId !== currentFactoryId || task.assignedFactoryId !== currentFactoryId) {
    return {
      canAccess: false,
      reasonCode: 'TASK_FACTORY_MISMATCH',
      reasonLabel: '当前任务不属于当前登录工厂，请切换到任务所属工厂账号。',
      order,
      task,
    }
  }
  return {
    canAccess: true,
    reasonCode: 'OK',
    reasonLabel: '当前任务与毛织加工单绑定有效。',
    order,
    task,
  }
}
