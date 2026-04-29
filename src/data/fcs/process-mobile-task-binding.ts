import { buildFcsCuttingDomainSnapshot } from '../../domain/fcs-cutting-runtime/index.ts'
import { TEST_FACTORY_ID, TEST_FACTORY_NAME } from './factory-mock-data.ts'
import {
  getDyeWorkOrderById,
  listDyeWorkOrders,
  type DyeWorkOrder,
} from './dyeing-task-domain.ts'
import {
  listPdaTaskFlowTasks,
  type PdaTaskFlowProjectedTask,
} from './pda-cutting-execution-source.ts'
import { listPdaGenericTasksByProcess } from './pda-task-mock-factory.ts'
import {
  listPostFinishingWorkOrders,
  listSewingFactoryPostTasks,
  type PostFinishingWorkOrder,
  type SewingFactoryPostTask,
} from './post-finishing-domain.ts'
import type { ProcessTask } from './process-tasks.ts'
import {
  getPrintWorkOrderById,
  listPrintWorkOrders,
  type PrintWorkOrder,
} from './printing-task-domain.ts'
import {
  getSpecialCraftTaskOrderById,
  getSpecialCraftTaskWorkOrderById,
  listSpecialCraftTaskOrders,
  listSpecialCraftTaskWorkOrders,
  type SpecialCraftTaskOrder,
  type SpecialCraftTaskWorkOrder,
} from './special-craft-task-orders.ts'

export type BindingReasonCode =
  | 'OK'
  | 'TASK_MISSING'
  | 'TASK_NOT_BOUND'
  | 'TASK_PROCESS_TYPE_MISMATCH'
  | 'TASK_FACTORY_MISMATCH'
  | 'TASK_NOT_ACCEPTED'
  | 'TASK_IN_BIDDING'
  | 'TASK_WAITING_AWARD'
  | 'TASK_REJECTED'
  | 'TASK_CLOSED'
  | 'TASK_NOT_VISIBLE_IN_MOBILE_LIST'
  | 'SOURCE_OBJECT_MISSING'
  | 'UNKNOWN'

export type MobileTaskProcessType =
  | 'PRINT'
  | 'DYE'
  | 'CUTTING'
  | 'SPECIAL_CRAFT'
  | 'POST_FINISHING'
  | 'SEWING'
  | 'UNKNOWN'

export interface ProcessMobileTaskBindingResult {
  workOrderId: string
  workOrderNo: string
  processType: MobileTaskProcessType
  sourceType: string
  sourceId: string
  expectedTaskId: string
  expectedTaskNo: string
  actualTaskId: string
  actualTaskNo: string
  isBound: boolean
  isTaskFound: boolean
  isProcessTypeMatched: boolean
  isFactoryMatched: boolean
  isAcceptedOrExecutable: boolean
  isVisibleInMobileExecutionList: boolean
  canOpenMobileExecution: boolean
  canExecuteInMobile: boolean
  reasonCode: BindingReasonCode
  reasonLabel: string
  suggestedAction: string
}

interface ValidateBindingContext {
  workOrderId: string
  workOrderNo: string
  processType: MobileTaskProcessType
  sourceType: string
  sourceId: string
  expectedTaskId?: string
  expectedTaskNo?: string
  expectedFactoryId?: string
  expectedOperationName?: string
  sourceExists: boolean
  actualTask: ProcessTask | null
  currentFactoryId: string
}

interface MobileTaskAccessResult {
  canOpenMobileExecution: boolean
  canExecuteInMobile: boolean
  reasonCode: BindingReasonCode
  reasonLabel: string
  suggestedAction: string
}

type GenericMobileTask = ProcessTask & {
  mockOrigin?: string
  originalCutOrderIds?: string[]
  originalCutOrderNos?: string[]
  processBusinessName?: string
  craftName?: string
  productionOrderNo?: string
  taskOrderId?: string
  taskOrderNo?: string
}

const EXECUTABLE_STATES = new Set(['待开工', '进行中', '生产暂停'])
const OPENABLE_STATES = new Set(['待开工', '进行中', '生产暂停', '已完工'])

function getTaskOrigin(task: ProcessTask): string {
  return String((task as GenericMobileTask).mockOrigin || '')
}

function mapPostFinishingStatusToTaskStatus(status: string): ProcessTask['status'] {
  if (status.includes('差异')) return 'BLOCKED'
  if (status.includes('中')) return 'IN_PROGRESS'
  if (status.includes('已交出') || status.includes('已回写') || status.includes('已完成')) return 'DONE'
  return 'NOT_STARTED'
}

function mapSewingFactoryPostTaskStatus(status: SewingFactoryPostTask['status']): ProcessTask['status'] {
  if (status.includes('中')) return 'IN_PROGRESS'
  if (status === '后道完成' || status === '已交后道工厂') return 'DONE'
  return 'NOT_STARTED'
}

function mapPostFinishingOrderToTask(order: PostFinishingWorkOrder, seq: number): ProcessTask {
  return {
    taskId: order.sourceTaskId,
    taskNo: order.postOrderNo,
    productionOrderId: order.sourceProductionOrderNo,
    seq,
    processCode: 'POST_FINISHING',
    processNameZh: '后道',
    stage: 'POST',
    qty: order.plannedGarmentQty,
    qtyUnit: 'PIECE',
    assignmentMode: 'DIRECT',
    assignmentStatus: 'ASSIGNED',
    ownerSuggestion: { kind: 'RECOMMENDED_FACTORY_POOL', recommendedTypes: ['FINISHING'] },
    assignedFactoryId: order.managedPostFactoryId,
    assignedFactoryName: order.managedPostFactoryName,
    qcPoints: [],
    attachments: [],
    status: mapPostFinishingStatusToTaskStatus(order.currentStatus),
    acceptanceStatus: 'ACCEPTED',
    acceptedAt: order.createdAt,
    acceptedBy: order.managedPostFactoryName,
    dispatchedAt: order.createdAt,
    dispatchedBy: '系统',
    dispatchRemark: '后道单同步到工厂端移动应用执行',
    taskDeadline: order.updatedAt,
    receiverKind: 'MANAGED_POST_FACTORY',
    receiverId: order.managedPostFactoryId,
    receiverName: order.managedPostFactoryName,
    handoverStatus: order.handoverRecordId ? 'WRITTEN_BACK' : order.waitHandoverWarehouseRecordId ? 'OPEN' : 'NOT_CREATED',
    handoverOrderId: order.handoverRecordId,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    auditLogs: [],
  }
}

function mapSewingFactoryPostTaskToTask(task: SewingFactoryPostTask, seq: number): ProcessTask {
  return {
    taskId: task.postTaskId,
    taskNo: task.relatedPostOrderNo || task.postTaskNo,
    productionOrderId: task.productionOrderNo,
    seq,
    processCode: 'SEWING_POST',
    processNameZh: '车缝后道',
    stage: 'POST',
    qty: task.plannedGarmentQty,
    qtyUnit: 'PIECE',
    assignmentMode: 'DIRECT',
    assignmentStatus: 'ASSIGNED',
    ownerSuggestion: { kind: 'RECOMMENDED_FACTORY_POOL', recommendedTypes: ['SEWING'] },
    assignedFactoryId: task.sewingFactoryId,
    assignedFactoryName: task.sewingFactoryName,
    qcPoints: [],
    attachments: [],
    status: mapSewingFactoryPostTaskStatus(task.status),
    acceptanceStatus: 'ACCEPTED',
    acceptedAt: task.postFinishedAt || '2026-04-01 08:30',
    acceptedBy: task.sewingFactoryName,
    dispatchedAt: task.postFinishedAt || '2026-04-01 08:30',
    dispatchedBy: '系统',
    dispatchRemark: '车缝工厂同时完成车缝与后道，完成后交给后道工厂质检和复检',
    taskDeadline: task.handedToManagedPostFactoryAt || '2026-04-25 18:00',
    receiverKind: 'MANAGED_POST_FACTORY',
    receiverId: task.managedPostFactoryId,
    receiverName: task.managedPostFactoryName,
    handoverStatus: task.status === '已交后道工厂' ? 'WRITTEN_BACK' : 'NOT_CREATED',
    createdAt: task.postFinishedAt || '2026-04-01 08:30',
    updatedAt: task.handedToManagedPostFactoryAt || '2026-04-25 18:00',
    auditLogs: [],
  }
}

function mapSpecialCraftExecutionStatus(status: string): ProcessTask['status'] {
  if (status === 'PROCESSING') return 'IN_PROGRESS'
  if (status === 'DIFFERENCE' || status === 'OBJECTION' || status === 'ABNORMAL') return 'BLOCKED'
  if (status === 'COMPLETED' || status === 'WAIT_HANDOVER' || status === 'HANDED_OVER' || status === 'WRITTEN_BACK') return 'DONE'
  return 'NOT_STARTED'
}

function mapSpecialCraftTaskOrderToMobileTask(taskOrder: SpecialCraftTaskOrder, seq: number): ProcessTask {
  const taskId = taskOrder.sourceTaskId || taskOrder.taskOrderId
  const taskNo = taskOrder.sourceTaskNo || taskOrder.taskOrderNo
  return {
    taskId,
    taskNo,
    rootTaskNo: taskOrder.taskOrderNo,
    productionOrderId: taskOrder.productionOrderId,
    seq,
    processCode: 'SPECIAL_CRAFT',
    processNameZh: taskOrder.operationName,
    stage: 'SPECIAL',
    qty: taskOrder.planQty,
    qtyUnit: 'PIECE',
    assignmentMode: 'DIRECT',
    assignmentStatus: 'ASSIGNED',
    ownerSuggestion: { kind: 'RECOMMENDED_FACTORY_POOL', recommendedTypes: ['FINISHING'] },
    assignedFactoryId: taskOrder.factoryId,
    assignedFactoryName: taskOrder.factoryName,
    qcPoints: [],
    attachments: [],
    status: mapSpecialCraftExecutionStatus(taskOrder.executionStatus),
    acceptanceStatus: 'ACCEPTED',
    acceptedAt: taskOrder.createdAt,
    acceptedBy: taskOrder.factoryName,
    dispatchedAt: taskOrder.createdAt,
    dispatchedBy: '系统',
    dispatchRemark: '特殊工艺任务同步到工厂端移动应用执行',
    taskDeadline: taskOrder.dueAt,
    processBusinessName: '特殊工艺',
    craftName: taskOrder.operationName,
    sourceTaskId: taskOrder.taskOrderId,
    createdAt: taskOrder.createdAt,
    updatedAt: taskOrder.updatedAt,
    auditLogs: [],
  }
}

function isSpecialCraftTask(task: ProcessTask): boolean {
  return getMobileTaskProcessType(task) === 'SPECIAL_CRAFT'
}

export function listPdaMobileExecutionTasks(): ProcessTask[] {
  const baseTasks = listPdaTaskFlowTasks().filter((task) => !isSpecialCraftTask(task))
  const existingTaskIds = new Set(baseTasks.map((task) => task.taskId))
  const genericProcessTasks = [
    ...listPdaGenericTasksByProcess('PRINTING'),
    ...listPdaGenericTasksByProcess('DYEING'),
  ].filter((task) => !existingTaskIds.has(task.taskId))
  const existingWithGeneric = new Set([...existingTaskIds, ...genericProcessTasks.map((task) => task.taskId)])
  const specialCraftTasks = listSpecialCraftTaskOrders()
    .map((taskOrder, index) => mapSpecialCraftTaskOrderToMobileTask(taskOrder, baseTasks.length + genericProcessTasks.length + index + 1))
    .filter((task) => !existingWithGeneric.has(task.taskId))
  const existingWithSpecial = new Set([...existingWithGeneric, ...specialCraftTasks.map((task) => task.taskId)])
  const postTasks = listPostFinishingWorkOrders()
    .filter((order) => !existingWithSpecial.has(order.sourceTaskId))
    .map((order, index) => mapPostFinishingOrderToTask(order, baseTasks.length + genericProcessTasks.length + specialCraftTasks.length + index + 1))
  const existingWithPost = new Set([...existingWithSpecial, ...postTasks.map((task) => task.taskId)])
  const sewingPostTasks = listSewingFactoryPostTasks()
    .filter((task) => !existingWithPost.has(task.postTaskId))
    .map((task, index) => mapSewingFactoryPostTaskToTask(task, baseTasks.length + genericProcessTasks.length + specialCraftTasks.length + postTasks.length + index + 1))
  return [...baseTasks, ...genericProcessTasks, ...specialCraftTasks, ...postTasks, ...sewingPostTasks]
}

export function getPdaMobileExecutionTaskById(taskId: string): ProcessTask | null {
  return listPdaMobileExecutionTasks().find((task) => task.taskId === taskId) ?? null
}

export function getMobileTaskProcessType(task: ProcessTask | null | undefined): MobileTaskProcessType {
  if (!task) return 'UNKNOWN'
  const explicitFields = [
    task.processCode,
    task.processNameZh,
    (task as GenericMobileTask).processBusinessName,
  ]
    .filter(Boolean)
    .join(' ')
  const craftFields = [
    explicitFields,
    (task as GenericMobileTask).craftName,
    task.stage,
  ]
    .filter(Boolean)
    .join(' ')
  if (/PROC_PRINT|PRINT\b|印花|转印/.test(explicitFields)) return 'PRINT'
  if (/PROC_DYE|DYE\b|染色/.test(explicitFields)) return 'DYE'
  if (/PROC_CUT|CUTTING|裁片|定位裁/.test(explicitFields)) return 'CUTTING'
  if (/POST_FINISH|后道/.test(explicitFields)) return 'POST_FINISHING'
  if (/SEW|车缝/.test(explicitFields)) return 'SEWING'
  if (/SPECIAL|特殊工艺|绣花|打揽|打条|激光切|洗水|烫画|直喷|捆条/.test(craftFields)) return 'SPECIAL_CRAFT'
  return 'UNKNOWN'
}

export function getMobileTaskFactoryId(task: ProcessTask | null | undefined): string {
  return String((task as GenericMobileTask | null | undefined)?.assignedFactoryId || '')
}

export function getMobileTaskAcceptanceState(task: ProcessTask | null | undefined): '待接单' | '已接单' | '已拒单' | '不适用' | '未知' {
  if (!task) return '未知'
  const origin = getTaskOrigin(task)
  if (origin === 'AWARDED_PENDING') return '待接单'
  if (origin.endsWith('REJECTED')) return '已拒单'
  if (task.acceptanceStatus === 'PENDING') return '待接单'
  if (task.acceptanceStatus === 'ACCEPTED') return '已接单'
  if (task.acceptanceStatus === 'REJECTED') return '已拒单'
  return '不适用'
}

export function getMobileTaskBiddingState(task: ProcessTask | null | undefined): '待报价' | '已报价' | '待定标' | '已中标' | '非报价任务' | '未知' {
  if (!task) return '未知'
  const origin = getTaskOrigin(task)
  if (origin === 'BIDDING_PENDING') return '待报价'
  if (origin === 'BIDDING_QUOTED') return '待定标'
  if (origin.startsWith('AWARDED')) return '已中标'
  if (task.assignmentStatus === 'BIDDING') return '已报价'
  if (task.assignmentStatus === 'AWARDED') return '已中标'
  return '非报价任务'
}

export function getMobileTaskExecutionState(task: ProcessTask | null | undefined): '待开工' | '进行中' | '生产暂停' | '已完工' | '已关闭' | '未知' {
  if (!task) return '未知'
  const origin = getTaskOrigin(task)
  if (task.status === 'CANCELLED' || origin.endsWith('CANCELLED')) return '已关闭'
  if (task.status === 'DONE') return '已完工'
  if (task.status === 'BLOCKED' || origin.endsWith('BLOCKED')) return '生产暂停'
  if (task.status === 'IN_PROGRESS') return '进行中'
  if (task.status === 'NOT_STARTED') return '待开工'
  return '未知'
}

export function isTaskAccepted(task: ProcessTask | null | undefined): boolean {
  return getMobileTaskAcceptanceState(task) === '已接单'
}

export function isTaskInBiddingOrAwarding(task: ProcessTask | null | undefined): boolean {
  const biddingState = getMobileTaskBiddingState(task)
  return biddingState === '待报价' || biddingState === '已报价' || biddingState === '待定标'
}

function isTaskRejected(task: ProcessTask | null | undefined): boolean {
  return getMobileTaskAcceptanceState(task) === '已拒单' || getTaskOrigin(task as ProcessTask).endsWith('REJECTED')
}

function isTaskClosed(task: ProcessTask | null | undefined): boolean {
  return getMobileTaskExecutionState(task) === '已关闭'
}

export function isTaskExecutable(task: ProcessTask | null | undefined): boolean {
  if (!task || !isTaskAccepted(task) || isTaskRejected(task) || isTaskInBiddingOrAwarding(task) || isTaskClosed(task)) return false
  return EXECUTABLE_STATES.has(getMobileTaskExecutionState(task))
}

export function isTaskVisibleInMobileExecutionList(task: ProcessTask | null | undefined, currentFactoryId = TEST_FACTORY_ID): boolean {
  if (!task) return false
  if (getMobileTaskFactoryId(task) !== currentFactoryId) return false
  if (!isTaskAccepted(task)) return false
  if (isTaskRejected(task) || isTaskInBiddingOrAwarding(task) || isTaskClosed(task)) return false
  return OPENABLE_STATES.has(getMobileTaskExecutionState(task))
}

function isSpecialCraftOperationMatched(task: ProcessTask, expectedOperationName?: string): boolean {
  if (!expectedOperationName) return getMobileTaskProcessType(task) === 'SPECIAL_CRAFT'
  const haystack = [
    task.processNameZh,
    (task as GenericMobileTask).processBusinessName,
    (task as GenericMobileTask).craftName,
    task.taskNo,
    task.rootTaskNo,
  ]
    .filter(Boolean)
    .join(' ')
  return getMobileTaskProcessType(task) === 'SPECIAL_CRAFT' && haystack.includes(expectedOperationName)
}

function getReasonMeta(reasonCode: BindingReasonCode): { label: string; action: string } {
  const map: Record<BindingReasonCode, { label: string; action: string }> = {
    OK: { label: '绑定有效，可打开移动端执行页', action: '允许打开移动端执行页' },
    TASK_MISSING: { label: '移动端任务不存在', action: '补齐移动端任务或修正 taskId / taskNo' },
    TASK_NOT_BOUND: { label: '当前加工单尚未绑定移动端执行任务', action: '补充正确的 taskId / taskNo' },
    TASK_PROCESS_TYPE_MISMATCH: { label: '移动端任务工艺类型不匹配', action: '改绑同工艺的移动端任务' },
    TASK_FACTORY_MISMATCH: { label: '当前任务不属于全能力测试工厂（F090）', action: '改绑 F090 / 全能力测试工厂的执行任务' },
    TASK_NOT_ACCEPTED: { label: '当前任务尚未接单，不能执行', action: '先在接单模块完成接单，再开放执行入口' },
    TASK_IN_BIDDING: { label: '当前任务仍在报价阶段，不能执行', action: '改绑已接单且可执行的移动端任务' },
    TASK_WAITING_AWARD: { label: '当前任务仍在待定标阶段，不能执行', action: '等待定标完成后再绑定执行任务' },
    TASK_REJECTED: { label: '当前任务已拒单或未中标，不能执行', action: '改绑有效执行任务' },
    TASK_CLOSED: { label: '当前任务已关闭或已作废，不能执行', action: '改绑有效执行任务' },
    TASK_NOT_VISIBLE_IN_MOBILE_LIST: { label: '当前任务不在移动端执行列表中', action: '检查工厂、接单状态和执行状态是否满足列表过滤规则' },
    SOURCE_OBJECT_MISSING: { label: '来源加工单不存在', action: '先修复来源对象，再重新校验绑定关系' },
    UNKNOWN: { label: '绑定校验失败', action: '检查任务主数据和绑定字段' },
  }
  return map[reasonCode]
}

export function getMobileTaskAccessResult(task: ProcessTask | null | undefined, currentFactoryId = TEST_FACTORY_ID): MobileTaskAccessResult {
  if (!task) {
    const reasonMeta = getReasonMeta('TASK_MISSING')
    return {
      canOpenMobileExecution: false,
      canExecuteInMobile: false,
      reasonCode: 'TASK_MISSING',
      reasonLabel: reasonMeta.label,
      suggestedAction: reasonMeta.action,
    }
  }
  let reasonCode: BindingReasonCode = 'OK'
  if (getMobileTaskFactoryId(task) !== currentFactoryId) {
    reasonCode = 'TASK_FACTORY_MISMATCH'
  } else if (isTaskRejected(task)) {
    reasonCode = 'TASK_REJECTED'
  } else if (isTaskClosed(task)) {
    reasonCode = 'TASK_CLOSED'
  } else if (getMobileTaskBiddingState(task) === '待定标') {
    reasonCode = 'TASK_WAITING_AWARD'
  } else if (isTaskInBiddingOrAwarding(task)) {
    reasonCode = 'TASK_IN_BIDDING'
  } else if (!isTaskAccepted(task)) {
    reasonCode = 'TASK_NOT_ACCEPTED'
  } else if (!isTaskVisibleInMobileExecutionList(task, currentFactoryId)) {
    reasonCode = 'TASK_NOT_VISIBLE_IN_MOBILE_LIST'
  }
  const reasonMeta = getReasonMeta(reasonCode)
  const canOpenMobileExecution = reasonCode === 'OK'
  return {
    canOpenMobileExecution,
    canExecuteInMobile: canOpenMobileExecution && EXECUTABLE_STATES.has(getMobileTaskExecutionState(task)),
    reasonCode,
    reasonLabel: reasonMeta.label,
    suggestedAction: reasonMeta.action,
  }
}

function validateBinding(context: ValidateBindingContext): ProcessMobileTaskBindingResult {
  const expectedTaskId = context.expectedTaskId || ''
  const expectedTaskNo = context.expectedTaskNo || ''
  const task = context.actualTask
  const actualTaskId = task?.taskId || ''
  const actualTaskNo = task?.taskNo || task?.taskId || ''
  const isTaskFound = Boolean(task)
  const isBound = Boolean(expectedTaskId || actualTaskId)
  const isProcessTypeMatched = task
    ? context.processType === 'SPECIAL_CRAFT'
      ? isSpecialCraftOperationMatched(task, context.expectedOperationName)
      : getMobileTaskProcessType(task) === context.processType
    : false
  const isFactoryMatched = task
    ? getMobileTaskFactoryId(task) === (context.expectedFactoryId || context.currentFactoryId)
      && getMobileTaskFactoryId(task) === context.currentFactoryId
    : false
  const isAcceptedOrExecutable = Boolean(task) && (isTaskAccepted(task) || isTaskExecutable(task))
  const isVisibleInMobileExecutionList = isTaskVisibleInMobileExecutionList(task, context.currentFactoryId)

  let reasonCode: BindingReasonCode = 'OK'
  if (!context.sourceExists) {
    reasonCode = 'SOURCE_OBJECT_MISSING'
  } else if (!isBound) {
    reasonCode = 'TASK_NOT_BOUND'
  } else if (!isTaskFound) {
    reasonCode = 'TASK_MISSING'
  } else if (!isProcessTypeMatched) {
    reasonCode = 'TASK_PROCESS_TYPE_MISMATCH'
  } else if (!isFactoryMatched) {
    reasonCode = 'TASK_FACTORY_MISMATCH'
  } else if (isTaskRejected(task)) {
    reasonCode = 'TASK_REJECTED'
  } else if (isTaskClosed(task)) {
    reasonCode = 'TASK_CLOSED'
  } else if (getMobileTaskBiddingState(task) === '待定标') {
    reasonCode = 'TASK_WAITING_AWARD'
  } else if (isTaskInBiddingOrAwarding(task)) {
    reasonCode = 'TASK_IN_BIDDING'
  } else if (!isTaskAccepted(task)) {
    reasonCode = 'TASK_NOT_ACCEPTED'
  } else if (!isVisibleInMobileExecutionList) {
    reasonCode = 'TASK_NOT_VISIBLE_IN_MOBILE_LIST'
  }

  const reasonMeta = getReasonMeta(reasonCode)
  const canOpenMobileExecution = reasonCode === 'OK'

  return {
    workOrderId: context.workOrderId,
    workOrderNo: context.workOrderNo,
    processType: context.processType,
    sourceType: context.sourceType,
    sourceId: context.sourceId,
    expectedTaskId,
    expectedTaskNo,
    actualTaskId,
    actualTaskNo,
    isBound,
    isTaskFound,
    isProcessTypeMatched,
    isFactoryMatched,
    isAcceptedOrExecutable,
    isVisibleInMobileExecutionList,
    canOpenMobileExecution,
    canExecuteInMobile: canOpenMobileExecution && EXECUTABLE_STATES.has(getMobileTaskExecutionState(task)),
    reasonCode,
    reasonLabel: reasonMeta.label,
    suggestedAction: reasonMeta.action,
  }
}

function getPrintTask(order: PrintWorkOrder): ProcessTask | null {
  return order.taskId ? getPdaMobileExecutionTaskById(order.taskId) : null
}

function getDyeTask(order: DyeWorkOrder): ProcessTask | null {
  return order.taskId ? getPdaMobileExecutionTaskById(order.taskId) : null
}

function selectBestCuttingTask(orderId: string): ProcessTask | null {
  const cuttingTasks = listPdaMobileExecutionTasks()
    .filter((task) => getMobileTaskProcessType(task) === 'CUTTING')
    .filter((task) => {
      const taskLike = task as GenericMobileTask
      return taskLike.originalCutOrderIds?.includes(orderId) || taskLike.originalCutOrderNos?.includes(orderId)
    })
  const sorted = cuttingTasks.sort((left, right) => {
    const leftVisible = isTaskVisibleInMobileExecutionList(left, TEST_FACTORY_ID) ? 0 : 1
    const rightVisible = isTaskVisibleInMobileExecutionList(right, TEST_FACTORY_ID) ? 0 : 1
    if (leftVisible !== rightVisible) return leftVisible - rightVisible
    const rank = (task: ProcessTask) => {
      const state = getMobileTaskExecutionState(task)
      if (state === '待开工') return 0
      if (state === '进行中') return 1
      if (state === '生产暂停') return 2
      if (state === '已完工') return 3
      return 4
    }
    return rank(left) - rank(right)
  })
  return sorted[0] ?? null
}

function getSpecialCraftTaskOrderByTaskOrderId(taskOrderId: string): SpecialCraftTaskOrder | null {
  return getSpecialCraftTaskOrderById(taskOrderId) ?? null
}

export function validatePrintWorkOrderMobileTaskBinding(printOrderId: string): ProcessMobileTaskBindingResult {
  const order = getPrintWorkOrderById(printOrderId)
  return validateBinding({
    workOrderId: order?.printOrderId || printOrderId,
    workOrderNo: order?.printOrderNo || printOrderId,
    processType: 'PRINT',
    sourceType: 'PRINT_WORK_ORDER',
    sourceId: printOrderId,
    expectedTaskId: order?.taskId,
    expectedTaskNo: order?.taskNo,
    expectedFactoryId: order?.printFactoryId || TEST_FACTORY_ID,
    sourceExists: Boolean(order),
    actualTask: order ? getPrintTask(order) : null,
    currentFactoryId: TEST_FACTORY_ID,
  })
}

export function validateDyeWorkOrderMobileTaskBinding(dyeOrderId: string): ProcessMobileTaskBindingResult {
  const order = getDyeWorkOrderById(dyeOrderId)
  return validateBinding({
    workOrderId: order?.dyeOrderId || dyeOrderId,
    workOrderNo: order?.dyeOrderNo || dyeOrderId,
    processType: 'DYE',
    sourceType: 'DYE_WORK_ORDER',
    sourceId: dyeOrderId,
    expectedTaskId: order?.taskId,
    expectedTaskNo: order?.taskNo,
    expectedFactoryId: order?.dyeFactoryId || TEST_FACTORY_ID,
    sourceExists: Boolean(order),
    actualTask: order ? getDyeTask(order) : null,
    currentFactoryId: TEST_FACTORY_ID,
  })
}

export function validateCuttingOrderMobileTaskBinding(cuttingOrderId: string): ProcessMobileTaskBindingResult {
  const snapshot = buildFcsCuttingDomainSnapshot()
  const order = snapshot.originalCutOrders.find(
    (item) => item.originalCutOrderId === cuttingOrderId || item.originalCutOrderNo === cuttingOrderId,
  )
  const actualTask = selectBestCuttingTask(cuttingOrderId)
  return validateBinding({
    workOrderId: order?.originalCutOrderId || cuttingOrderId,
    workOrderNo: order?.originalCutOrderNo || cuttingOrderId,
    processType: 'CUTTING',
    sourceType: 'CUTTING_ORDER',
    sourceId: cuttingOrderId,
    expectedTaskId: actualTask?.taskId,
    expectedTaskNo: actualTask?.taskNo || actualTask?.taskId,
    expectedFactoryId: TEST_FACTORY_ID,
    sourceExists: Boolean(order),
    actualTask,
    currentFactoryId: TEST_FACTORY_ID,
  })
}

export function validateSpecialCraftTaskOrderMobileTaskBinding(taskOrderId: string): ProcessMobileTaskBindingResult {
  const taskOrder = getSpecialCraftTaskOrderByTaskOrderId(taskOrderId)
  const expectedTaskId = taskOrder?.sourceTaskId || taskOrder?.taskOrderId
  return validateBinding({
    workOrderId: taskOrder?.taskOrderId || taskOrderId,
    workOrderNo: taskOrder?.taskOrderNo || taskOrderId,
    processType: 'SPECIAL_CRAFT',
    sourceType: 'SPECIAL_CRAFT_TASK_ORDER',
    sourceId: taskOrderId,
    expectedTaskId,
    expectedTaskNo: taskOrder?.sourceTaskNo || taskOrder?.taskOrderNo,
    expectedFactoryId: taskOrder?.factoryId || TEST_FACTORY_ID,
    expectedOperationName: taskOrder?.operationName,
    sourceExists: Boolean(taskOrder),
    actualTask: expectedTaskId ? getPdaMobileExecutionTaskById(expectedTaskId) : null,
    currentFactoryId: TEST_FACTORY_ID,
  })
}

export function validateSpecialCraftMobileTaskBinding(workOrderId: string): ProcessMobileTaskBindingResult {
  const workOrder = getSpecialCraftTaskWorkOrderById(workOrderId)
  const taskOrder = workOrder ? getSpecialCraftTaskOrderByTaskOrderId(workOrder.taskOrderId) : null
  const expectedTaskId = taskOrder?.sourceTaskId || taskOrder?.taskOrderId
  return validateBinding({
    workOrderId: workOrder?.workOrderId || workOrderId,
    workOrderNo: workOrder?.workOrderNo || workOrderId,
    processType: 'SPECIAL_CRAFT',
    sourceType: 'SPECIAL_CRAFT_WORK_ORDER',
    sourceId: workOrderId,
    expectedTaskId,
    expectedTaskNo: taskOrder?.sourceTaskNo || taskOrder?.taskOrderNo,
    expectedFactoryId: workOrder?.factoryId || TEST_FACTORY_ID,
    expectedOperationName: workOrder?.operationName,
    sourceExists: Boolean(workOrder && taskOrder),
    actualTask: expectedTaskId ? getPdaMobileExecutionTaskById(expectedTaskId) : null,
    currentFactoryId: TEST_FACTORY_ID,
  })
}

export function validateProcessMobileTaskBinding(params: { processType: MobileTaskProcessType; sourceId: string }): ProcessMobileTaskBindingResult {
  if (params.processType === 'PRINT') return validatePrintWorkOrderMobileTaskBinding(params.sourceId)
  if (params.processType === 'DYE') return validateDyeWorkOrderMobileTaskBinding(params.sourceId)
  if (params.processType === 'CUTTING') return validateCuttingOrderMobileTaskBinding(params.sourceId)
  if (params.processType === 'SPECIAL_CRAFT') return validateSpecialCraftMobileTaskBinding(params.sourceId)
  return validateBinding({
    workOrderId: params.sourceId,
    workOrderNo: params.sourceId,
    processType: params.processType,
    sourceType: 'UNKNOWN',
    sourceId: params.sourceId,
    sourceExists: false,
    actualTask: null,
    currentFactoryId: TEST_FACTORY_ID,
  })
}

function listKnownCuttingOrderIds(): string[] {
  const ids = new Set<string>()
  const snapshot = buildFcsCuttingDomainSnapshot()
  const originalCutOrders = Array.isArray(snapshot.originalCutOrders)
    ? snapshot.originalCutOrders
    : Object.values((snapshot as { originalCutOrdersById?: Record<string, { originalCutOrderId: string }> }).originalCutOrdersById || {})
  originalCutOrders.forEach((order) => ids.add(order.originalCutOrderId))
  return [...ids]
}

export function listInvalidProcessMobileTaskBindings(filter: { processType?: MobileTaskProcessType } = {}): ProcessMobileTaskBindingResult[] {
  const results: ProcessMobileTaskBindingResult[] = []
  if (!filter.processType || filter.processType === 'PRINT') {
    results.push(...listPrintWorkOrders().map((order) => validatePrintWorkOrderMobileTaskBinding(order.printOrderId)))
  }
  if (!filter.processType || filter.processType === 'DYE') {
    results.push(...listDyeWorkOrders().map((order) => validateDyeWorkOrderMobileTaskBinding(order.dyeOrderId)))
  }
  if (!filter.processType || filter.processType === 'CUTTING') {
    results.push(...listKnownCuttingOrderIds().map((orderId) => validateCuttingOrderMobileTaskBinding(orderId)))
  }
  if (!filter.processType || filter.processType === 'SPECIAL_CRAFT') {
    results.push(...listSpecialCraftTaskWorkOrders().map((workOrder) => validateSpecialCraftMobileTaskBinding(workOrder.workOrderId)))
  }
  return results.filter((item) => item.reasonCode !== 'OK')
}

export function assertValidProcessMobileTaskBinding(params: { processType: MobileTaskProcessType; sourceId: string }): ProcessMobileTaskBindingResult {
  const result = validateProcessMobileTaskBinding(params)
  if (!result.canOpenMobileExecution) {
    throw new Error(`${result.workOrderNo} 绑定校验失败：${result.reasonLabel}`)
  }
  return result
}

export const PROCESS_MOBILE_TASK_BINDING_DEMO_FACTORY = {
  factoryId: TEST_FACTORY_ID,
  factoryName: TEST_FACTORY_NAME,
}
