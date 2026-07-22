import { formatFactoryDisplayName, TEST_FACTORY_ID } from './factory-mock-data.ts'
import { getFactoryMasterRecordById } from './factory-master-store.ts'
import { getDyeWorkOrderByTaskId } from './dyeing-task-domain.ts'
import { getWoolWorkOrderByTaskId } from './wool-task-domain.ts'
import { getPdaCuttingTaskSnapshot } from './pda-cutting-execution-source.ts'
import {
  getMobileTaskFactoryId,
  getMobileTaskProcessType,
  getMobileTaskExecutionState,
  getOnboardingCuttingDemoFactoryName,
  getPdaMobileExecutionTaskById,
  isOnboardingCuttingDemoFactory,
  isTaskVisibleInMobileExecutionList,
  listPostFinishingMobileExecutionTasks,
  listPdaMobileExecutionTasks,
  type MobileTaskProcessType,
} from './process-mobile-task-binding.ts'
import type { ProcessTask } from './process-tasks.ts'
import { getPrintWorkOrderByTaskId } from './printing-task-domain.ts'
import {
  getPostFinishingTaskById,
  getPostFinishingWorkOrderBySourceTaskId,
} from './post-finishing-domain.ts'
import {
  getSpecialCraftTaskWorkOrderById,
  listSpecialCraftTaskOrders,
  listSpecialCraftTaskWorkOrders,
} from './special-craft-task-orders.ts'
import { canFactoryAccessSpecialCraftPdaTask, isGarmentWarehouseOutboundPdaTaskForFactory } from './special-craft-pda-scope.ts'
import { getWaterSolubleWorkOrderByTaskId } from './water-soluble-task-domain.ts'

export type MobileExecutionTaskStatusTab = 'NOT_STARTED' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE'

export interface MobileExecutionTaskSourceInfo {
  sourceType: string
  sourceId: string
  sourceWorkOrderId: string
  sourceWorkOrderNo: string
  workOrderNo: string
  printOrderNo: string
  dyeOrderNo: string
  waterSolubleOrderNo: string
  woolOrderNo: string
  cuttingOrderNo: string
  specialCraftOrderNo: string
  postOrderNo: string
  taskOrderId: string
  taskOrderNo: string
  workOrderIds: string[]
  workOrderNos: string[]
  sourceIds: string[]
  sourceNos: string[]
  productionOrderNo?: string
  stockMaterialId?: string
  stockMaterialName?: string
  sourceTaskNo: string
  factoryId: string
  factoryName: string
  factoryCode: string
  factoryDisplayName: string
  processType: MobileTaskProcessType
  patternNo: string
  materialSku: string
  materialName: string
  rawMaterialSku: string
  targetColor: string
  colorNo: string
  markerPlanNo: string
  markerPlanNos: string[]
  partName: string
  operationName: string
  feiTicketNos: string[]
}

export interface ListMobileExecutionTasksParams {
  currentFactoryId?: string
  keyword?: string
  statusTab?: MobileExecutionTaskStatusTab | '待开工' | '进行中' | '生产暂停' | '已完工'
  includeCompleted?: boolean
  processType?: MobileTaskProcessType
  sourceType?: string
  sourceId?: string
}

type TaskWithSearchFields = ProcessTask & {
  productionOrderNo?: string
  sourceTaskId?: string
  sourceTaskNo?: string
  taskOrderId?: string
  taskOrderNo?: string
  workOrderId?: string
  workOrderNo?: string
  cutOrderId?: string
  cutOrderNo?: string
  cutOrderIds?: string[]
  cutOrderNos?: string[]
  markerPlanId?: string
  markerPlanNo?: string
  markerPlanIds?: string[]
  markerPlanNos?: string[]
  materialSku?: string
  materialName?: string
  rawMaterialSku?: string
  targetColor?: string
  colorNo?: string
  partName?: string
  pieceName?: string
  craftName?: string
  processBusinessName?: string
  feiTicketNo?: string
  feiTicketNos?: string[]
  spuCode?: string
  spuName?: string
}

export const MOBILE_EXECUTION_TASK_TAB_LABELS: Record<MobileExecutionTaskStatusTab, string> = {
  NOT_STARTED: '待开工',
  IN_PROGRESS: '进行中',
  BLOCKED: '生产暂停',
  DONE: '已完工',
}

function normalizeString(value: string | undefined | null): string {
  return String(value || '').trim()
}

function uniqueStrings(values: Array<string | undefined | null>): string[] {
  const seen = new Set<string>()
  return values
    .map((value) => normalizeString(value))
    .filter((value) => {
      if (!value || seen.has(value)) return false
      seen.add(value)
      return true
    })
}

function normalizeTabKey(
  statusTab: ListMobileExecutionTasksParams['statusTab'] | undefined,
): MobileExecutionTaskStatusTab | null {
  if (!statusTab) return null
  if (statusTab === 'NOT_STARTED' || statusTab === '待开工') return 'NOT_STARTED'
  if (statusTab === 'IN_PROGRESS' || statusTab === '进行中') return 'IN_PROGRESS'
  if (statusTab === 'BLOCKED' || statusTab === '生产暂停') return 'BLOCKED'
  if (statusTab === 'DONE' || statusTab === '已完工') return 'DONE'
  return null
}

function getFactoryMeta(task: ProcessTask): Pick<
  MobileExecutionTaskSourceInfo,
  'factoryId' | 'factoryName' | 'factoryCode' | 'factoryDisplayName'
> {
  const factoryId = getMobileTaskFactoryId(task)
  const factory = factoryId ? getFactoryMasterRecordById(factoryId) : undefined
  const factoryName = normalizeString(factory?.name || task.assignedFactoryName || factoryId)
  const factoryCode = normalizeString(factory?.code || factory?.id || task.assignedFactoryId || factoryId)
  return {
    factoryId,
    factoryName,
    factoryCode,
    factoryDisplayName: formatFactoryDisplayName(factoryName || task.assignedFactoryName, factoryCode || factoryId),
  }
}

function getPrintSourceInfo(task: ProcessTask): Partial<MobileExecutionTaskSourceInfo> {
  const order = getPrintWorkOrderByTaskId(task.taskId)
  if (!order) return {}
  return {
    sourceType: 'PRINT_WORK_ORDER',
    sourceId: normalizeString(order.printOrderId),
    sourceWorkOrderId: normalizeString((order as typeof order & { workOrderId?: string }).workOrderId || order.printOrderId),
    sourceWorkOrderNo: normalizeString((order as typeof order & { workOrderNo?: string }).workOrderNo || order.printOrderNo),
    workOrderNo: normalizeString((order as typeof order & { workOrderNo?: string }).workOrderNo || order.printOrderNo),
    printOrderNo: normalizeString(order.printOrderNo),
    sourceIds: uniqueStrings([order.printOrderId, (order as typeof order & { workOrderId?: string }).workOrderId]),
    sourceNos: uniqueStrings([order.printOrderNo, (order as typeof order & { workOrderNo?: string }).workOrderNo]),
    ...(order.sourceType === 'STOCK'
      ? { stockMaterialId: order.stockMaterialId, stockMaterialName: order.stockMaterialName }
      : { productionOrderNo: normalizeString(order.sourceProductionOrderNo || order.sourceProductionOrderId || task.productionOrderId) }),
    patternNo: normalizeString(order.patternNo),
    materialSku: normalizeString(order.materialSku),
  }
}

function getDyeSourceInfo(task: ProcessTask): Partial<MobileExecutionTaskSourceInfo> {
  const order = getDyeWorkOrderByTaskId(task.taskId)
  if (!order) return {}
  return {
    sourceType: 'DYE_WORK_ORDER',
    sourceId: normalizeString(order.dyeOrderId),
    sourceWorkOrderId: normalizeString((order as typeof order & { workOrderId?: string }).workOrderId || order.dyeOrderId),
    sourceWorkOrderNo: normalizeString((order as typeof order & { workOrderNo?: string }).workOrderNo || order.dyeOrderNo),
    workOrderNo: normalizeString((order as typeof order & { workOrderNo?: string }).workOrderNo || order.dyeOrderNo),
    dyeOrderNo: normalizeString(order.dyeOrderNo),
    sourceIds: uniqueStrings([order.dyeOrderId, (order as typeof order & { workOrderId?: string }).workOrderId]),
    sourceNos: uniqueStrings([order.dyeOrderNo, (order as typeof order & { workOrderNo?: string }).workOrderNo]),
    ...(order.sourceType === 'STOCK'
      ? { stockMaterialId: order.stockMaterialId, stockMaterialName: order.stockMaterialName }
      : { productionOrderNo: normalizeString(order.sourceProductionOrderNo || order.sourceProductionOrderId || task.productionOrderId) }),
    rawMaterialSku: normalizeString(order.rawMaterialSku),
    targetColor: normalizeString(order.targetColor),
    colorNo: normalizeString(order.colorNo),
  }
}

function getWaterSolubleSourceInfo(task: ProcessTask): Partial<MobileExecutionTaskSourceInfo> {
  const order = getWaterSolubleWorkOrderByTaskId(task.taskId)
  if (!order) return {}
  return {
    sourceType: 'WATER_SOLUBLE_WORK_ORDER',
    sourceId: normalizeString(order.waterOrderId),
    sourceWorkOrderId: normalizeString(order.waterOrderId),
    sourceWorkOrderNo: normalizeString(order.waterOrderNo),
    workOrderNo: normalizeString(order.waterOrderNo),
    waterSolubleOrderNo: normalizeString(order.waterOrderNo),
    sourceIds: uniqueStrings([order.waterOrderId, order.sourceArtifactId]),
    sourceNos: uniqueStrings([order.waterOrderNo, order.taskNo]),
    productionOrderNo: normalizeString(order.productionOrderNo),
    materialSku: normalizeString(order.materialCode),
    materialName: normalizeString(order.materialName),
    operationName: '水溶',
  }
}

function getWoolSourceInfo(task: ProcessTask): Partial<MobileExecutionTaskSourceInfo> {
  const order = getWoolWorkOrderByTaskId(task.taskId)
  if (!order) return {}
  return {
    sourceType: 'WOOL_WORK_ORDER',
    sourceId: normalizeString(order.woolOrderId),
    sourceWorkOrderId: normalizeString(order.woolOrderId),
    sourceWorkOrderNo: normalizeString(order.woolOrderNo),
    workOrderNo: normalizeString(order.woolOrderNo),
    woolOrderNo: normalizeString(order.woolOrderNo),
    sourceIds: uniqueStrings([order.woolOrderId, order.taskNo]),
    sourceNos: uniqueStrings([order.woolOrderNo, order.taskNo]),
    productionOrderNo: normalizeString(order.productionOrderNo || task.productionOrderId),
    sourceTaskNo: normalizeString(order.taskNo),
    materialSku: normalizeString(order.yarnReceipt.yarnSku),
    targetColor: normalizeString(order.colorName),
    partName: normalizeString(order.kind === 'PART_PANEL' ? order.partPanels.map((panel) => panel.partName).join(' / ') : '整件'),
    operationName: normalizeString(order.kind === 'PART_PANEL' ? '部位毛织' : '整件毛织'),
    feiTicketNos: uniqueStrings(order.partPanels.map((panel) => panel.feiTicketNo)),
  }
}

function getCuttingSourceInfo(task: ProcessTask): Partial<MobileExecutionTaskSourceInfo> {
  const taskLike = task as TaskWithSearchFields
  const detail = getPdaCuttingTaskSnapshot(task.taskId)
  const cutOrderId = normalizeString(detail?.cutOrderId || taskLike.cutOrderId || taskLike.cutOrderIds?.[0])
  const cutOrderNo = normalizeString(detail?.cutOrderNo || taskLike.cutOrderNo || taskLike.cutOrderNos?.[0])
  const markerPlanNo = normalizeString(detail?.markerPlanNo || taskLike.markerPlanNo || taskLike.markerPlanNos?.[0])
  const productionOrderNo = normalizeString(detail?.productionOrderNo || taskLike.productionOrderNo || task.productionOrderId)
  const markerPlanNos = uniqueStrings([markerPlanNo, ...(detail?.markerPlanNos || []), ...(taskLike.markerPlanNos || [])])

  return {
    sourceType: 'CUTTING_ORDER',
    sourceId: cutOrderId || cutOrderNo,
    sourceWorkOrderId: cutOrderId,
    sourceWorkOrderNo: cutOrderNo,
    workOrderNo: cutOrderNo,
    cuttingOrderNo: cutOrderNo,
    sourceIds: uniqueStrings([cutOrderId, ...(taskLike.cutOrderIds || [])]),
    sourceNos: uniqueStrings([cutOrderNo, task.taskNo, task.rootTaskNo, ...(taskLike.cutOrderNos || [])]),
    productionOrderNo,
    materialSku: normalizeString(detail?.materialSku || taskLike.materialSku),
    markerPlanNo,
    markerPlanNos,
    partName: normalizeString(taskLike.partName || taskLike.pieceName),
  }
}

function getSpecialCraftSourceInfo(task: ProcessTask): Partial<MobileExecutionTaskSourceInfo> {
  const taskLike = task as TaskWithSearchFields
  const matchedTaskOrder =
    listSpecialCraftTaskOrders().find((taskOrder) =>
      taskOrder.sourceTaskId === task.taskId
      || taskOrder.taskOrderId === taskLike.sourceTaskId
      || taskOrder.taskOrderNo === task.rootTaskNo
      || taskOrder.sourceTaskNo === task.taskNo,
    )
    || null

  const directWorkOrder = taskLike.workOrderId ? getSpecialCraftTaskWorkOrderById(taskLike.workOrderId) : null
  const relatedWorkOrders =
    directWorkOrder
      ? [directWorkOrder]
      : matchedTaskOrder
        ? listSpecialCraftTaskWorkOrders().filter((workOrder) => workOrder.taskOrderId === matchedTaskOrder.taskOrderId)
        : []

  const firstWorkOrder = relatedWorkOrders[0] ?? null
  const workOrderIds = uniqueStrings(relatedWorkOrders.map((workOrder) => workOrder.workOrderId))
  const workOrderNos = uniqueStrings(relatedWorkOrders.map((workOrder) => workOrder.workOrderNo))
  const feiTicketNos = uniqueStrings([
    ...(firstWorkOrder?.feiTicketNos || []),
    ...(matchedTaskOrder?.feiTicketNos || []),
    ...relatedWorkOrders.flatMap((workOrder) => workOrder.feiTicketNos),
    taskLike.feiTicketNo,
    ...(taskLike.feiTicketNos || []),
  ])

  return {
    sourceType: firstWorkOrder ? 'SPECIAL_CRAFT_WORK_ORDER' : 'SPECIAL_CRAFT_TASK_ORDER',
    sourceId: normalizeString(firstWorkOrder?.workOrderId || matchedTaskOrder?.taskOrderId || taskLike.sourceTaskId || task.taskId),
    sourceWorkOrderId: normalizeString(firstWorkOrder?.workOrderId || matchedTaskOrder?.taskOrderId),
    sourceWorkOrderNo: normalizeString(firstWorkOrder?.workOrderNo || matchedTaskOrder?.taskOrderNo || task.taskNo || task.taskId),
    workOrderNo: normalizeString(firstWorkOrder?.workOrderNo || matchedTaskOrder?.taskOrderNo),
    specialCraftOrderNo: normalizeString(firstWorkOrder?.workOrderNo || matchedTaskOrder?.taskOrderNo),
    taskOrderId: normalizeString(matchedTaskOrder?.taskOrderId),
    taskOrderNo: normalizeString(matchedTaskOrder?.taskOrderNo),
    workOrderIds,
    workOrderNos,
    sourceIds: uniqueStrings([
      matchedTaskOrder?.taskOrderId,
      firstWorkOrder?.workOrderId,
      ...workOrderIds,
      taskLike.sourceTaskId,
    ]),
    sourceNos: uniqueStrings([
      matchedTaskOrder?.taskOrderNo,
      matchedTaskOrder?.sourceTaskNo,
      firstWorkOrder?.workOrderNo,
      ...workOrderNos,
      task.rootTaskNo,
    ]),
    productionOrderNo: normalizeString(firstWorkOrder?.productionOrderNo || matchedTaskOrder?.productionOrderNo || task.productionOrderId),
    sourceTaskNo: normalizeString(matchedTaskOrder?.sourceTaskNo || task.rootTaskNo || task.taskNo || task.taskId),
    materialSku: normalizeString(firstWorkOrder?.materialSku || matchedTaskOrder?.materialSku || taskLike.materialSku),
    partName: normalizeString(firstWorkOrder?.partName || matchedTaskOrder?.partName || taskLike.partName || taskLike.pieceName),
    operationName: normalizeString(firstWorkOrder?.operationName || matchedTaskOrder?.operationName || task.processNameZh || taskLike.craftName),
    feiTicketNos,
  }
}

function getPostFinishingSourceInfo(task: ProcessTask): Partial<MobileExecutionTaskSourceInfo> {
  const postTask = getPostFinishingTaskById(task.taskId)
  if (postTask) {
    return {
      sourceType: 'POST_FINISHING_TASK',
      sourceId: normalizeString(postTask.postTaskId),
      sourceWorkOrderId: normalizeString(postTask.postTaskId),
      sourceWorkOrderNo: normalizeString(postTask.postTaskNo),
      workOrderNo: normalizeString(postTask.postTaskNo),
      postOrderNo: normalizeString(postTask.postTaskNo),
      sourceIds: uniqueStrings([postTask.postTaskId, postTask.productionOrderId, postTask.productionOrderNo]),
      sourceNos: uniqueStrings([postTask.postTaskNo, postTask.productionOrderNo, ...postTask.sourceTaskNos]),
      productionOrderNo: normalizeString(postTask.productionOrderNo),
      sourceTaskNo: normalizeString(postTask.sourceTaskNos.join('、') || postTask.postTaskNo),
      partName: normalizeString(postTask.spuName),
      operationName: '后道',
    }
  }
  const order = getPostFinishingWorkOrderBySourceTaskId(task.taskId)
  if (!order) return {}
  return {
    sourceType: 'POST_FINISHING_WORK_ORDER',
    sourceId: normalizeString(order.postOrderId),
    sourceWorkOrderId: normalizeString(order.postOrderId),
    sourceWorkOrderNo: normalizeString(order.postOrderNo),
    workOrderNo: normalizeString(order.postOrderNo),
    postOrderNo: normalizeString(order.postOrderNo),
    sourceIds: uniqueStrings([order.postOrderId, order.sourceTaskId, order.sourcePostTaskId]),
    sourceNos: uniqueStrings([order.postOrderNo, order.sourceTaskNo, order.sourcePostTaskNo]),
    productionOrderNo: normalizeString(order.sourceProductionOrderNo || task.productionOrderId),
    sourceTaskNo: normalizeString(order.sourceTaskNo || task.taskNo || task.taskId),
    partName: normalizeString(order.skuSummary),
    operationName: '后道',
  }
}

function buildSourceInfo(task: ProcessTask): MobileExecutionTaskSourceInfo {
  const processType = getMobileTaskProcessType(task)
  const factoryMeta = getFactoryMeta(task)
  const taskLike = task as TaskWithSearchFields
  const baseInfo: MobileExecutionTaskSourceInfo = {
    sourceType: '',
    sourceId: '',
    sourceWorkOrderId: '',
    sourceWorkOrderNo: '',
    workOrderNo: '',
    printOrderNo: '',
    dyeOrderNo: '',
    waterSolubleOrderNo: '',
    woolOrderNo: '',
    cuttingOrderNo: '',
    specialCraftOrderNo: '',
    postOrderNo: '',
    taskOrderId: '',
    taskOrderNo: '',
    workOrderIds: [],
    workOrderNos: [],
    sourceIds: [],
    sourceNos: [],
    ...(task.sourceType === 'STOCK'
      ? { stockMaterialId: task.stockMaterialId, stockMaterialName: task.stockMaterialName }
      : { productionOrderNo: normalizeString(taskLike.productionOrderNo || task.productionOrderId) }),
    sourceTaskNo: normalizeString(taskLike.sourceTaskNo || task.rootTaskNo || task.taskNo || task.taskId),
    factoryId: factoryMeta.factoryId,
    factoryName: factoryMeta.factoryName,
    factoryCode: factoryMeta.factoryCode,
    factoryDisplayName: factoryMeta.factoryDisplayName,
    processType,
    patternNo: '',
    materialSku: normalizeString(taskLike.materialSku),
    materialName: normalizeString(taskLike.materialName),
    rawMaterialSku: normalizeString(taskLike.rawMaterialSku),
    targetColor: normalizeString(taskLike.targetColor),
    colorNo: normalizeString(taskLike.colorNo),
    markerPlanNo: normalizeString(taskLike.markerPlanNo),
    markerPlanNos: uniqueStrings(taskLike.markerPlanNos || []),
    partName: normalizeString(taskLike.partName || taskLike.pieceName),
    operationName: normalizeString(task.processNameZh || taskLike.craftName || taskLike.processBusinessName),
    feiTicketNos: uniqueStrings([taskLike.feiTicketNo, ...(taskLike.feiTicketNos || [])]),
  }

  const processInfo =
    processType === 'WATER_SOLUBLE'
      ? getWaterSolubleSourceInfo(task)
      : processType === 'PRINT'
      ? getPrintSourceInfo(task)
      : processType === 'DYE'
        ? getDyeSourceInfo(task)
        : processType === 'WOOL'
          ? getWoolSourceInfo(task)
          : processType === 'CUTTING'
            ? getCuttingSourceInfo(task)
            : processType === 'SPECIAL_CRAFT'
              ? getSpecialCraftSourceInfo(task)
              : processType === 'POST_FINISHING'
                ? getPostFinishingSourceInfo(task)
                : {}

  return {
    ...baseInfo,
    ...processInfo,
    sourceIds: uniqueStrings([...(baseInfo.sourceIds || []), ...(processInfo.sourceIds || []), processInfo.sourceId]),
    sourceNos: uniqueStrings([...(baseInfo.sourceNos || []), ...(processInfo.sourceNos || []), processInfo.sourceWorkOrderNo, processInfo.workOrderNo]),
    workOrderIds: uniqueStrings([...(baseInfo.workOrderIds || []), ...(processInfo.workOrderIds || [])]),
    workOrderNos: uniqueStrings([...(baseInfo.workOrderNos || []), ...(processInfo.workOrderNos || [])]),
    markerPlanNos: uniqueStrings([...(baseInfo.markerPlanNos || []), ...(processInfo.markerPlanNos || []), processInfo.markerPlanNo]),
    feiTicketNos: uniqueStrings([...(baseInfo.feiTicketNos || []), ...(processInfo.feiTicketNos || [])]),
  }
}

function matchSourceType(task: ProcessTask, sourceType: string | undefined, sourceId: string | undefined): boolean {
  const normalizedSourceId = normalizeString(sourceId).toLowerCase()
  if (!sourceType && !normalizedSourceId) return true
  const info = buildSourceInfo(task)
  const normalizedSourceType = normalizeString(sourceType).toUpperCase()
  const relatedIds = uniqueStrings([
    info.sourceId,
    info.sourceWorkOrderId,
    info.taskOrderId,
    ...info.sourceIds,
    ...info.workOrderIds,
    info.printOrderNo,
    info.dyeOrderNo,
    info.waterSolubleOrderNo,
    info.woolOrderNo,
    info.cuttingOrderNo,
    info.specialCraftOrderNo,
    info.postOrderNo,
    info.sourceWorkOrderNo,
    ...info.workOrderNos,
  ]).map((value) => value.toLowerCase())

  if (normalizedSourceId && !relatedIds.includes(normalizedSourceId)) return false

  if (!normalizedSourceType) return true
  if (['PRINT_WORK_ORDER', 'PRINT_ORDER', 'PRINTING_WORK_ORDER'].includes(normalizedSourceType)) {
    return info.processType === 'PRINT'
  }
  if (['DYE_WORK_ORDER', 'DYE_ORDER', 'DYEING_WORK_ORDER'].includes(normalizedSourceType)) {
    return info.processType === 'DYE'
  }
  if (['WATER_SOLUBLE_WORK_ORDER', 'WATER_SOLUBLE_ORDER'].includes(normalizedSourceType)) {
    return info.processType === 'WATER_SOLUBLE'
  }
  if (['WOOL_WORK_ORDER', 'WOOL_ORDER', 'WOOL_ORDER'].includes(normalizedSourceType)) {
    return info.processType === 'WOOL'
  }
  if (['CUTTING_ORDER', 'CUTTING_ORDER', 'CUT_ORDER', 'CUT_PIECE_ORDER'].includes(normalizedSourceType)) {
    return info.processType === 'CUTTING'
  }
  if (['SPECIAL_CRAFT_WORK_ORDER', 'SPECIAL_CRAFT_TASK_ORDER', 'SPECIAL_CRAFT_ORDER'].includes(normalizedSourceType)) {
    return info.processType === 'SPECIAL_CRAFT'
  }
  if (['POST_FINISHING_TASK', 'POST_TASK', 'POST_FINISHING_WORK_ORDER', 'POST_FINISHING_ORDER', 'POST_ORDER'].includes(normalizedSourceType)) {
    return info.processType === 'POST_FINISHING'
  }
  return info.sourceType === normalizedSourceType || relatedIds.includes(normalizedSourceType.toLowerCase())
}

function compareTasks(left: ProcessTask, right: ProcessTask): number {
  const leftVisible = isMobileTaskVisibleForFactory(left, TEST_FACTORY_ID) ? 0 : 1
  const rightVisible = isMobileTaskVisibleForFactory(right, TEST_FACTORY_ID) ? 0 : 1
  if (leftVisible !== rightVisible) return leftVisible - rightVisible

  const rank = (task: ProcessTask): number => {
    const tabKey = getMobileTaskTabKey(task)
    if (tabKey === 'NOT_STARTED') return 0
    if (tabKey === 'IN_PROGRESS') return 1
    if (tabKey === 'BLOCKED') return 2
    return 3
  }
  const rankDiff = rank(left) - rank(right)
  if (rankDiff !== 0) return rankDiff
  return (left.taskNo || left.taskId).localeCompare(right.taskNo || right.taskId, 'zh-Hans-CN')
}

function scopeOnboardingCuttingDemoTask(task: ProcessTask, currentFactoryId: string): ProcessTask {
  if (!isOnboardingCuttingDemoFactory(currentFactoryId)) return task
  if (getMobileTaskFactoryId(task) !== TEST_FACTORY_ID) return task
  if (getMobileTaskProcessType(task) !== 'CUTTING') return task

  const factoryName = getOnboardingCuttingDemoFactoryName(currentFactoryId)
  return {
    ...task,
    assignedFactoryId: currentFactoryId,
    assignedFactoryName: factoryName || task.assignedFactoryName,
    receiverId: currentFactoryId,
    receiverName: factoryName || task.assignedFactoryName,
  }
}

export function getMobileTaskTabKey(task: ProcessTask | null | undefined): MobileExecutionTaskStatusTab {
  const state = getMobileTaskExecutionState(task)
  if (state === '待开工') return 'NOT_STARTED'
  if (state === '进行中') return 'IN_PROGRESS'
  if (state === '生产暂停') return 'BLOCKED'
  return 'DONE'
}

export function isMobileTaskVisibleForFactory(task: ProcessTask | null | undefined, currentFactoryId = TEST_FACTORY_ID): boolean {
  return (isTaskVisibleInMobileExecutionList(task, currentFactoryId) || isGarmentWarehouseOutboundPdaTaskForFactory(currentFactoryId, task))
    && canFactoryAccessSpecialCraftPdaTask(currentFactoryId, task)
}

export function getMobileExecutionTaskSourceInfo(task: ProcessTask | null | undefined): MobileExecutionTaskSourceInfo {
  if (!task) {
    return {
      sourceType: '',
      sourceId: '',
      sourceWorkOrderId: '',
      sourceWorkOrderNo: '',
      workOrderNo: '',
      printOrderNo: '',
      dyeOrderNo: '',
      waterSolubleOrderNo: '',
      woolOrderNo: '',
      cuttingOrderNo: '',
      specialCraftOrderNo: '',
      postOrderNo: '',
      taskOrderId: '',
      taskOrderNo: '',
      workOrderIds: [],
      workOrderNos: [],
      sourceIds: [],
      sourceNos: [],
      sourceTaskNo: '',
      factoryId: '',
      factoryName: '',
      factoryCode: '',
      factoryDisplayName: '',
      processType: 'UNKNOWN',
      patternNo: '',
      materialSku: '',
      materialName: '',
      rawMaterialSku: '',
      targetColor: '',
      colorNo: '',
      markerPlanNo: '',
      markerPlanNos: [],
      partName: '',
      operationName: '',
      feiTicketNos: [],
    }
  }
  return buildSourceInfo(task)
}

export function matchMobileTaskKeyword(task: ProcessTask | null | undefined, keyword: string | undefined): boolean {
  if (!task) return false
  const normalizedKeyword = normalizeString(keyword).toLowerCase()
  if (!normalizedKeyword) return true
  const info = getMobileExecutionTaskSourceInfo(task)
  const taskLike = task as TaskWithSearchFields
  const tokens = uniqueStrings([
    task.taskId,
    task.taskNo,
    task.rootTaskNo,
    info.sourceTaskNo,
    info.sourceWorkOrderId,
    info.sourceWorkOrderNo,
    info.workOrderNo,
    info.printOrderNo,
    info.dyeOrderNo,
    info.waterSolubleOrderNo,
    info.woolOrderNo,
    info.cuttingOrderNo,
    info.specialCraftOrderNo,
    info.postOrderNo,
    info.taskOrderId,
    info.taskOrderNo,
    ...info.workOrderIds,
    ...info.workOrderNos,
    ...info.sourceIds,
    ...info.sourceNos,
    task.productionOrderId,
    info.productionOrderNo,
    taskLike.productionOrderNo,
    info.factoryName,
    info.factoryCode,
    info.factoryId,
    info.factoryDisplayName,
    info.patternNo,
    info.materialSku,
    info.materialName,
    info.rawMaterialSku,
    info.targetColor,
    info.colorNo,
    info.markerPlanNo,
    ...info.markerPlanNos,
    info.partName,
    info.operationName,
    ...info.feiTicketNos,
    task.processNameZh,
    taskLike.craftName,
    taskLike.processBusinessName,
    taskLike.materialSku,
    taskLike.materialName,
    taskLike.rawMaterialSku,
    taskLike.targetColor,
    taskLike.colorNo,
    taskLike.cutOrderNo,
    taskLike.cutOrderId,
    ...(taskLike.cutOrderNos || []),
    ...(taskLike.cutOrderIds || []),
    taskLike.markerPlanNo,
    ...(taskLike.markerPlanNos || []),
    taskLike.feiTicketNo,
    ...(taskLike.feiTicketNos || []),
    taskLike.spuCode,
    taskLike.spuName,
  ])
  return tokens.some((token) => token.toLowerCase().includes(normalizedKeyword))
}

export function listMobileExecutionTasks(params: ListMobileExecutionTasksParams = {}): ProcessTask[] {
  const currentFactoryId = normalizeString(params.currentFactoryId) || TEST_FACTORY_ID
  const statusTab = normalizeTabKey(params.statusTab)
  let tasks = (params.processType === 'POST_FINISHING' ? listPostFinishingMobileExecutionTasks() : listPdaMobileExecutionTasks())
    .filter((task) => isMobileTaskVisibleForFactory(task, currentFactoryId))
    .map((task) => scopeOnboardingCuttingDemoTask(task, currentFactoryId))

  if (params.processType) {
    tasks = tasks.filter((task) => getMobileTaskProcessType(task) === params.processType)
  }
  if (params.sourceType || params.sourceId) {
    tasks = tasks.filter((task) => matchSourceType(task, params.sourceType, params.sourceId))
  }
  if (params.includeCompleted === false) {
    tasks = tasks.filter((task) => getMobileTaskTabKey(task) !== 'DONE')
  }
  if (statusTab) {
    tasks = tasks.filter((task) => getMobileTaskTabKey(task) === statusTab)
  }
  if (normalizeString(params.keyword)) {
    tasks = tasks.filter((task) => matchMobileTaskKeyword(task, params.keyword))
  }

  return [...tasks].sort(compareTasks)
}

export function getMobileExecutionTaskById(taskId: string): ProcessTask | null {
  return getPdaMobileExecutionTaskById(taskId) ?? null
}

export function getMobileExecutionTaskByNo(taskNo: string): ProcessTask | null {
  const normalizedTaskNo = normalizeString(taskNo)
  if (!normalizedTaskNo) return null
  return listPdaMobileExecutionTasks().find((task) => task.taskNo === normalizedTaskNo || task.taskId === normalizedTaskNo) ?? null
}

export function getMobileExecutionTaskBySource(sourceType: string, sourceId: string): ProcessTask | null {
  const normalizedSourceId = normalizeString(sourceId)
  if (!normalizedSourceId) return null
  return listMobileExecutionTasks().filter((task) => matchSourceType(task, sourceType, normalizedSourceId)).sort(compareTasks)[0] ?? null
}

export function buildMobileExecutionListPath(params: ListMobileExecutionTasksParams = {}): string {
  const searchParams = new URLSearchParams()
  const normalizedTab = normalizeTabKey(params.statusTab)
  if (normalizedTab) searchParams.set('tab', normalizedTab)
  if (normalizeString(params.keyword)) searchParams.set('keyword', normalizeString(params.keyword))
  if (normalizeString(params.currentFactoryId)) searchParams.set('currentFactoryId', normalizeString(params.currentFactoryId))
  if (normalizeString(params.processType)) searchParams.set('processType', normalizeString(params.processType))
  if (normalizeString(params.sourceType)) searchParams.set('sourceType', normalizeString(params.sourceType))
  if (normalizeString(params.sourceId)) searchParams.set('sourceId', normalizeString(params.sourceId))
  const query = searchParams.toString()
  return query ? `/fcs/pda/exec?${query}` : '/fcs/pda/exec'
}

export function buildMobileExecutionListLocatePathForTask(
  task: ProcessTask,
  options: { currentFactoryId?: string; keyword?: string } = {},
): string {
  const info = getMobileExecutionTaskSourceInfo(task)
  const keyword =
    normalizeString(options.keyword)
    || info.sourceWorkOrderNo
    || info.workOrderNo
    || info.printOrderNo
    || info.dyeOrderNo
    || info.waterSolubleOrderNo
    || info.woolOrderNo
    || info.cuttingOrderNo
    || info.specialCraftOrderNo
    || info.postOrderNo
    || info.productionOrderNo
    || task.taskNo
    || task.taskId

  return buildMobileExecutionListPath({
    currentFactoryId: normalizeString(options.currentFactoryId) || info.factoryId || TEST_FACTORY_ID,
    statusTab: getMobileTaskTabKey(task),
    keyword,
  })
}
