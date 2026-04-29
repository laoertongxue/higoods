export type PostFinishingRouteMode = '专门后道工厂完整流程' | '车缝厂已做后道'
export type PostFinishingActionType = '接收领料' | '质检' | '后道' | '复检'

import { TEST_FACTORY_ID, TEST_FACTORY_NAME } from './factory-mock-data.ts'

export const FULL_CAPABILITY_TEST_FACTORY_ID = TEST_FACTORY_ID
export const FULL_CAPABILITY_TEST_FACTORY_NAME = TEST_FACTORY_NAME
export const FULL_CAPABILITY_SEWING_FACTORY_ID = 'ID-SEW-FULL'
export const FULL_CAPABILITY_SEWING_FACTORY_NAME = '全能力测试车缝工厂'

export interface PostFinishingActionRecord {
  actionId: string
  postOrderId: string
  postOrderNo: string
  actionType: PostFinishingActionType
  factoryId: string
  factoryName: string
  status: string
  startedAt?: string
  finishedAt?: string
  operatorName: string
  submittedGarmentQty: number
  acceptedGarmentQty: number
  rejectedGarmentQty: number
  diffGarmentQty: number
  qtyUnit: '件'
  receivedGarmentQty?: number
  inspectedGarmentQty?: number
  passedGarmentQty?: number
  defectiveGarmentQty?: number
  completedPostGarmentQty?: number
  recheckedGarmentQty?: number
  confirmedGarmentQty?: number
  qcResult?: string
  skipReason?: string
  evidenceUrls?: string[]
  remark: string
}

export interface PostFinishingWaitProcessWarehouseRecord {
  warehouseRecordId: string
  warehouseRecordNo: string
  postOrderId: string
  postOrderNo: string
  sourceFactoryId: string
  sourceFactoryName: string
  sourceSewingTaskNo: string
  postSourceLabel: string
  postFactoryId: string
  postFactoryName: string
  productionOrderNo: string
  skuSummary: string
  waitAction: Exclude<PostFinishingActionType, '接收领料'> | '接收领料'
  inboundGarmentQty: number
  inboundGarmentQtyUnit: '件'
  warehouseLocation: string
  inboundAt: string
  status: string
}

export interface PostFinishingWaitHandoverWarehouseRecord {
  handoverWarehouseRecordId: string
  handoverWarehouseRecordNo: string
  postOrderId: string
  postOrderNo: string
  recheckActionId: string
  sourceSewingTaskNo: string
  postSourceLabel: string
  productionOrderNo: string
  postFactoryId: string
  postFactoryName: string
  availableHandoverGarmentQty: number
  handedOverGarmentQty: number
  writtenBackGarmentQty: number
  diffGarmentQty: number
  qtyUnit: '件'
  status: string
  createdAt: string
}

export interface PostFinishingHandoverActionSnapshot {
  waitHandoverWarehouseRecordId?: string
  handoverRecordId?: string
  handoverGarmentQty: number
  receiveGarmentQty: number
  diffGarmentQty: number
  qtyUnit: '件'
  status: string
}

export interface PostFinishingWorkOrder {
  postOrderId: string
  postOrderNo: string
  routeMode: PostFinishingRouteMode
  sourceProductionOrderId: string
  sourceProductionOrderNo: string
  sourceTaskId: string
  sourceTaskNo: string
  sourceSewingTaskId: string
  sourceSewingTaskNo: string
  sourcePostTaskId: string
  sourcePostTaskNo: string
  sourceSewingFactoryId: string
  sourceSewingFactoryName: string
  currentFactoryId: string
  currentFactoryName: string
  managedPostFactoryId: string
  managedPostFactoryName: string
  styleNo: string
  skuSummary: string
  plannedGarmentQty: number
  plannedGarmentQtyUnit: '件'
  currentStatus: string
  isDedicatedPostFactory: boolean
  isPostDoneBySewingFactory: boolean
  requiresReceive: boolean
  requiresQc: boolean
  requiresPostFinishing: boolean
  requiresRecheck: boolean
  requiresHandover: boolean
  receiveAction: PostFinishingActionRecord
  postAction: PostFinishingActionRecord
  qcAction: PostFinishingActionRecord
  recheckAction: PostFinishingActionRecord
  handoverAction?: PostFinishingHandoverActionSnapshot
  waitProcessWarehouseRecordId: string
  waitHandoverWarehouseRecordId?: string
  handoverRecordId?: string
  createdAt: string
  updatedAt: string
}

export interface SewingFactoryPostTask {
  sewingTaskId: string
  sewingTaskNo: string
  postTaskId: string
  postTaskNo: string
  relatedPostOrderId: string
  relatedPostOrderNo: string
  productionOrderNo: string
  sewingFactoryId: string
  sewingFactoryName: string
  managedPostFactoryId: string
  managedPostFactoryName: string
  plannedGarmentQty: number
  completedSewingGarmentQty: number
  completedPostGarmentQty: number
  qtyUnit: '件'
  status: '待车缝' | '车缝中' | '车缝完成' | '待后道' | '后道中' | '后道完成' | '待交后道工厂' | '已交后道工厂'
  needFactoryPostFinishing: boolean
  postFinishedAt?: string
  handedToManagedPostFactoryAt?: string
}

const dedicatedStatuses = [
  '待接收领料',
  '待质检',
  '待后道',
  '待复检',
  '待交出',
  '已完成',
  '接收中',
  '质检中',
  '后道中',
  '复检中',
  '已交出',
  '已回写',
]

const sewingDoneStatuses = [
  '待接收领料',
  '待质检',
  '待复检',
  '待交出',
  '已完成',
  '有差异',
  '接收中',
  '质检中',
  '复检中',
  '已交出',
  '已回写',
  '平台处理中',
]

function pad(value: number): string {
  return String(value).padStart(3, '0')
}

function dateFor(index: number, hour = '09:00'): string {
  return `2026-04-${String(1 + (index % 24)).padStart(2, '0')} ${hour}`
}

export function getPostFinishingSourceLabel(order: Pick<PostFinishingWorkOrder, 'isPostDoneBySewingFactory'>): string {
  return order.isPostDoneBySewingFactory ? '车缝厂已完成后道' : '后道工厂执行'
}

export function getPostFinishingFlowText(order: Pick<PostFinishingWorkOrder, 'isPostDoneBySewingFactory'>): string {
  return order.isPostDoneBySewingFactory
    ? '接收领料 -> 质检 -> 复检 -> 交出'
    : '接收领料 -> 质检 -> 后道 -> 复检 -> 交出'
}

function actionStatusFor(status: string, actionType: PostFinishingActionType, isPostDoneBySewingFactory: boolean): string {
  if (actionType === '接收领料') {
    if (status === '待接收领料') return '待接收'
    if (status === '接收中') return '接收中'
    if (status === '接收差异') return '有差异'
    return '已接收'
  }
  if (actionType === '质检') {
    if (status === '待接收领料' || status === '接收中') return '待质检'
    if (status === '待质检') return '待质检'
    if (status === '质检中') return '质检中'
    if (status === '质检异常') return '有差异'
    return '质检完成'
  }
  if (actionType === '后道') {
    if (isPostDoneBySewingFactory) return '跳过后道'
    if (status === '待接收领料' || status === '接收中' || status === '待质检' || status === '质检中') return '待后道'
    if (status === '待后道') return '待后道'
    if (status === '后道中') return '后道中'
    return '后道完成'
  }
  if (status === '待接收领料' || status === '接收中' || status === '待质检' || status === '质检中' || status === '待后道' || status === '后道中') {
    return '待复检'
  }
  if (status === '待复检') return '待复检'
  if (status === '复检中') return '复检中'
  if (status === '复检差异' || status === '有差异') return '有差异'
  return '复检完成'
}

function isActionStarted(status: string): boolean {
  return !status.startsWith('待') && status !== '跳过后道'
}

function isActionFinished(status: string): boolean {
  return status.includes('完成') || status === '已接收' || status === '跳过后道' || status === '有差异'
}

function buildAction(input: {
  index: number
  postOrderId: string
  postOrderNo: string
  actionType: PostFinishingActionType
  status: string
  factoryId: string
  factoryName: string
  qty: number
  skipReason?: string
}): PostFinishingActionRecord {
  const started = isActionStarted(input.status)
  const finished = isActionFinished(input.status)
  const defectiveQty = input.actionType === '质检' && input.index % 5 === 0 ? 3 : 0
  const diffQty = input.actionType === '复检' && input.index % 7 === 0 ? 2 : 0
  const acceptedQty = Math.max(input.qty - defectiveQty - diffQty, 0)
  return {
    actionId: `PFA-${pad(input.index)}-${input.actionType}`,
    postOrderId: input.postOrderId,
    postOrderNo: input.postOrderNo,
    actionType: input.actionType,
    factoryId: input.factoryId,
    factoryName: input.factoryName,
    status: input.status,
    startedAt: started ? dateFor(input.index, '09:00') : undefined,
    finishedAt: finished ? dateFor(input.index, '17:30') : undefined,
    operatorName:
      input.actionType === '接收领料'
        ? '接收员'
        : input.actionType === '质检'
          ? '质检员'
          : input.actionType === '后道'
            ? '后道班长'
            : '复检员',
    submittedGarmentQty: input.qty,
    acceptedGarmentQty: acceptedQty,
    rejectedGarmentQty: defectiveQty,
    diffGarmentQty: diffQty,
    qtyUnit: '件',
    receivedGarmentQty: input.actionType === '接收领料' ? acceptedQty : undefined,
    inspectedGarmentQty: input.actionType === '质检' ? input.qty : undefined,
    passedGarmentQty: input.actionType === '质检' ? acceptedQty : undefined,
    defectiveGarmentQty: input.actionType === '质检' ? defectiveQty : undefined,
    completedPostGarmentQty: input.actionType === '后道' ? acceptedQty : undefined,
    recheckedGarmentQty: input.actionType === '复检' ? input.qty : undefined,
    confirmedGarmentQty: input.actionType === '复检' ? acceptedQty : undefined,
    qcResult: input.actionType === '质检' ? (defectiveQty > 0 ? '有不合格成衣，待平台处理' : '质检通过') : undefined,
    skipReason: input.skipReason,
    evidenceUrls: [],
    remark: input.skipReason || `${input.actionType}记录按成衣件数回写`,
  }
}

function buildOrder(index: number, status: string, routeMode: PostFinishingRouteMode): PostFinishingWorkOrder {
  const isPostDoneBySewingFactory = routeMode === '车缝厂已做后道'
  const postOrderId = `POST-WO-${pad(index)}`
  const postOrderNo = `HD-${new Date().getFullYear()}-${pad(index)}`
  const qty = 240 + (index % 9) * 20
  const sourceSewingFactoryId = index % 2 === 0 ? FULL_CAPABILITY_SEWING_FACTORY_ID : 'ID-SEW-ALT'
  const sourceSewingFactoryName = index % 2 === 0 ? FULL_CAPABILITY_SEWING_FACTORY_NAME : '泗水协作车缝工厂'
  const receiveAction = buildAction({
    index,
    postOrderId,
    postOrderNo,
    actionType: '接收领料',
    status: actionStatusFor(status, '接收领料', isPostDoneBySewingFactory),
    factoryId: FULL_CAPABILITY_TEST_FACTORY_ID,
    factoryName: FULL_CAPABILITY_TEST_FACTORY_NAME,
    qty,
  })
  const qcAction = buildAction({
    index,
    postOrderId,
    postOrderNo,
    actionType: '质检',
    status: actionStatusFor(status, '质检', isPostDoneBySewingFactory),
    factoryId: FULL_CAPABILITY_TEST_FACTORY_ID,
    factoryName: FULL_CAPABILITY_TEST_FACTORY_NAME,
    qty: receiveAction.acceptedGarmentQty,
  })
  const postAction = buildAction({
    index,
    postOrderId,
    postOrderNo,
    actionType: '后道',
    status: actionStatusFor(status, '后道', isPostDoneBySewingFactory),
    factoryId: isPostDoneBySewingFactory ? sourceSewingFactoryId : FULL_CAPABILITY_TEST_FACTORY_ID,
    factoryName: isPostDoneBySewingFactory ? sourceSewingFactoryName : FULL_CAPABILITY_TEST_FACTORY_NAME,
    qty: qcAction.acceptedGarmentQty,
    skipReason: isPostDoneBySewingFactory ? '后道已由车缝厂完成' : undefined,
  })
  const recheckAction = buildAction({
    index,
    postOrderId,
    postOrderNo,
    actionType: '复检',
    status: actionStatusFor(status, '复检', isPostDoneBySewingFactory),
    factoryId: FULL_CAPABILITY_TEST_FACTORY_ID,
    factoryName: FULL_CAPABILITY_TEST_FACTORY_NAME,
    qty: isPostDoneBySewingFactory ? qcAction.acceptedGarmentQty : postAction.acceptedGarmentQty,
  })
  const hasHandover = ['复检完成', '待交出', '已交出', '已回写', '已完成', '有差异', '平台处理中'].includes(status)
  const handoverQty = recheckAction.acceptedGarmentQty
  const handedOverQty = ['已交出', '已回写', '已完成', '有差异', '平台处理中'].includes(status) ? handoverQty : 0
  const receiveQty = status === '有差异' ? Math.max(handoverQty - 2, 0) : ['已回写', '已完成'].includes(status) ? handoverQty : 0

  return {
    postOrderId,
    postOrderNo,
    routeMode,
    sourceProductionOrderId: `PO-${pad(index)}`,
    sourceProductionOrderNo: `生产单-${pad(index)}`,
    sourceTaskId: `TASK-POST-${pad(index)}`,
    sourceTaskNo: `后道来源任务-${pad(index)}`,
    sourceSewingTaskId: `SEW-TASK-${pad(index)}`,
    sourceSewingTaskNo: `车缝任务-${pad(index)}`,
    sourcePostTaskId: isPostDoneBySewingFactory ? `SEW-POST-${pad(index)}` : `POST-TASK-${pad(index)}`,
    sourcePostTaskNo: isPostDoneBySewingFactory ? `车缝后道任务-${pad(index)}` : `后道任务-${pad(index)}`,
    sourceSewingFactoryId,
    sourceSewingFactoryName,
    currentFactoryId: FULL_CAPABILITY_TEST_FACTORY_ID,
    currentFactoryName: FULL_CAPABILITY_TEST_FACTORY_NAME,
    managedPostFactoryId: FULL_CAPABILITY_TEST_FACTORY_ID,
    managedPostFactoryName: FULL_CAPABILITY_TEST_FACTORY_NAME,
    styleNo: `HG-ST-${1000 + index}`,
    skuSummary: `成衣 SKU-${pad(index)} / 黑色 / M-L`,
    plannedGarmentQty: qty,
    plannedGarmentQtyUnit: '件',
    currentStatus: status,
    isDedicatedPostFactory: true,
    isPostDoneBySewingFactory,
    requiresReceive: true,
    requiresQc: true,
    requiresPostFinishing: !isPostDoneBySewingFactory,
    requiresRecheck: true,
    requiresHandover: true,
    receiveAction,
    postAction,
    qcAction,
    recheckAction,
    handoverAction: hasHandover
      ? {
          waitHandoverWarehouseRecordId: `PFP-WH-${pad(index)}`,
          handoverRecordId: handedOverQty > 0 ? `HDR-POST-${pad(index)}` : undefined,
          handoverGarmentQty: handedOverQty,
          receiveGarmentQty: receiveQty,
          diffGarmentQty: Math.max(handedOverQty - receiveQty, 0),
          qtyUnit: '件',
          status,
        }
      : undefined,
    waitProcessWarehouseRecordId: `PFP-WP-${pad(index)}`,
    waitHandoverWarehouseRecordId: hasHandover ? `PFP-WH-${pad(index)}` : undefined,
    handoverRecordId: handedOverQty > 0 ? `HDR-POST-${pad(index)}` : undefined,
    createdAt: dateFor(index, '08:30'),
    updatedAt: dateFor(index, '18:00'),
  }
}

const dedicatedOrders = dedicatedStatuses.map((status, index) => buildOrder(index + 1, status, '专门后道工厂完整流程'))
const sewingDoneOrders = sewingDoneStatuses.map((status, index) => buildOrder(101 + index, status, '车缝厂已做后道'))
const postFinishingWorkOrders: PostFinishingWorkOrder[] = [...dedicatedOrders, ...sewingDoneOrders]

const sewingFactoryPostTasks: SewingFactoryPostTask[] = sewingDoneOrders.flatMap((order, index) => {
  const baseQty = order.plannedGarmentQty
  return [
    {
      sewingTaskId: order.sourceSewingTaskId,
      sewingTaskNo: order.sourceSewingTaskNo,
      postTaskId: order.sourcePostTaskId,
      postTaskNo: order.sourcePostTaskNo,
      relatedPostOrderId: order.postOrderId,
      relatedPostOrderNo: order.postOrderNo,
      productionOrderNo: order.sourceProductionOrderNo,
      sewingFactoryId: order.sourceSewingFactoryId,
      sewingFactoryName: order.sourceSewingFactoryName,
      managedPostFactoryId: order.managedPostFactoryId,
      managedPostFactoryName: order.managedPostFactoryName,
      plannedGarmentQty: baseQty,
      completedSewingGarmentQty: baseQty,
      completedPostGarmentQty: order.postAction.acceptedGarmentQty,
      qtyUnit: '件',
      status: ['待后道', '后道中', '后道完成', '待交后道工厂', '已交后道工厂'][index % 5] as SewingFactoryPostTask['status'],
      needFactoryPostFinishing: true,
      postFinishedAt: order.postAction.finishedAt,
      handedToManagedPostFactoryAt: order.currentStatus !== '待接收领料' ? order.createdAt : undefined,
    },
  ]
})

const waitProcessWarehouseRecords: PostFinishingWaitProcessWarehouseRecord[] = postFinishingWorkOrders.map((order, index) => ({
  warehouseRecordId: order.waitProcessWarehouseRecordId,
  warehouseRecordNo: `HD-RK-${pad(index + 1)}`,
  postOrderId: order.postOrderId,
  postOrderNo: order.postOrderNo,
  sourceFactoryId: order.sourceSewingFactoryId,
  sourceFactoryName: order.sourceSewingFactoryName,
  sourceSewingTaskNo: order.sourceSewingTaskNo,
  postSourceLabel: getPostFinishingSourceLabel(order),
  postFactoryId: order.managedPostFactoryId,
  postFactoryName: order.managedPostFactoryName,
  productionOrderNo: order.sourceProductionOrderNo,
  skuSummary: order.skuSummary,
  waitAction: resolveWaitAction(order),
  inboundGarmentQty: order.plannedGarmentQty,
  inboundGarmentQtyUnit: '件',
  warehouseLocation: `HD-A-${(index % 8) + 1}`,
  inboundAt: order.createdAt,
  status: order.currentStatus,
}))

const waitHandoverWarehouseRecords: PostFinishingWaitHandoverWarehouseRecord[] = postFinishingWorkOrders
  .filter((order) => order.waitHandoverWarehouseRecordId)
  .map((order, index) => ({
    handoverWarehouseRecordId: order.waitHandoverWarehouseRecordId || '',
    handoverWarehouseRecordNo: `HD-CK-${pad(index + 1)}`,
    postOrderId: order.postOrderId,
    postOrderNo: order.postOrderNo,
    recheckActionId: order.recheckAction.actionId,
    sourceSewingTaskNo: order.sourceSewingTaskNo,
    postSourceLabel: getPostFinishingSourceLabel(order),
    productionOrderNo: order.sourceProductionOrderNo,
    postFactoryId: order.managedPostFactoryId,
    postFactoryName: order.managedPostFactoryName,
    availableHandoverGarmentQty: order.recheckAction.acceptedGarmentQty,
    handedOverGarmentQty: order.handoverAction?.handoverGarmentQty ?? 0,
    writtenBackGarmentQty: order.handoverAction?.receiveGarmentQty ?? 0,
    diffGarmentQty: order.handoverAction?.diffGarmentQty ?? order.recheckAction.diffGarmentQty,
    qtyUnit: '件',
    status: order.currentStatus === '复检完成' ? '待交出' : order.currentStatus,
    createdAt: order.updatedAt,
  }))

function nowTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function cloneActionRecord(record: PostFinishingActionRecord): PostFinishingActionRecord {
  return { ...record, evidenceUrls: [...(record.evidenceUrls || [])] }
}

function cloneWorkOrder(order: PostFinishingWorkOrder): PostFinishingWorkOrder {
  return {
    ...order,
    receiveAction: cloneActionRecord(order.receiveAction),
    postAction: cloneActionRecord(order.postAction),
    qcAction: cloneActionRecord(order.qcAction),
    recheckAction: cloneActionRecord(order.recheckAction),
    handoverAction: order.handoverAction ? { ...order.handoverAction } : undefined,
  }
}

function getMutablePostFinishingWorkOrder(postOrderId: string): PostFinishingWorkOrder {
  const order = postFinishingWorkOrders.find((item) => item.postOrderId === postOrderId)
  if (!order) throw new Error(`未找到后道单：${postOrderId}`)
  return order
}

function resolveWaitAction(order: PostFinishingWorkOrder): PostFinishingWaitProcessWarehouseRecord['waitAction'] {
  if (order.currentStatus.includes('接收')) return '接收领料'
  if (order.currentStatus.includes('质检')) return '质检'
  if (!order.isPostDoneBySewingFactory && order.currentStatus.includes('后道')) return '后道'
  if (order.currentStatus.includes('复检')) return '复检'
  if (order.currentStatus === '待交出' || order.currentStatus.includes('已')) return '复检'
  return '接收领料'
}

function getAction(order: PostFinishingWorkOrder, actionType: PostFinishingActionType): PostFinishingActionRecord {
  if (actionType === '接收领料') return order.receiveAction
  if (actionType === '后道') return order.postAction
  if (actionType === '质检') return order.qcAction
  return order.recheckAction
}

function getStartedStatus(actionType: PostFinishingActionType): string {
  if (actionType === '接收领料') return '接收中'
  if (actionType === '后道') return '后道中'
  if (actionType === '质检') return '质检中'
  return '复检中'
}

function getWaitStatus(actionType: PostFinishingActionType): string {
  if (actionType === '接收领料') return '待接收领料'
  if (actionType === '后道') return '待后道'
  if (actionType === '质检') return '待质检'
  return '待复检'
}

function getDoneStatus(actionType: PostFinishingActionType): string {
  if (actionType === '接收领料') return '已接收'
  if (actionType === '后道') return '后道完成'
  if (actionType === '质检') return '质检完成'
  return '复检完成'
}

function updateActionQty(action: PostFinishingActionRecord, submittedQty: number, acceptedQty: number, rejectedQty: number, diffQty: number, remark?: string): void {
  action.submittedGarmentQty = submittedQty
  action.acceptedGarmentQty = acceptedQty
  action.rejectedGarmentQty = rejectedQty
  action.diffGarmentQty = diffQty
  if (action.actionType === '接收领料') action.receivedGarmentQty = acceptedQty
  if (action.actionType === '质检') {
    action.inspectedGarmentQty = submittedQty
    action.passedGarmentQty = acceptedQty
    action.defectiveGarmentQty = rejectedQty
    action.qcResult = rejectedQty > 0 ? '有不合格成衣，待平台处理' : '质检通过'
  }
  if (action.actionType === '后道') action.completedPostGarmentQty = acceptedQty
  if (action.actionType === '复检') {
    action.recheckedGarmentQty = submittedQty
    action.confirmedGarmentQty = acceptedQty
  }
  action.remark = remark || `${action.actionType}完成，按成衣件数回写`
}

function updateWaitProcessRecord(order: PostFinishingWorkOrder): void {
  const record = waitProcessWarehouseRecords.find((item) => item.warehouseRecordId === order.waitProcessWarehouseRecordId)
  if (!record) return
  record.waitAction = resolveWaitAction(order)
  record.status = order.currentStatus
  record.inboundGarmentQty = order.plannedGarmentQty
  record.postFactoryId = order.managedPostFactoryId
  record.postFactoryName = order.managedPostFactoryName
}

function assertPostActionAllowed(order: PostFinishingWorkOrder, actionType: PostFinishingActionType): void {
  if (actionType === '后道' && order.isPostDoneBySewingFactory) {
    throw new Error('后道已由车缝厂完成，后道工厂不再执行后道动作')
  }
}

function applyNextStatusAfterFinish(order: PostFinishingWorkOrder, actionType: PostFinishingActionType): void {
  if (actionType === '接收领料') {
    order.currentStatus = '待质检'
  } else if (actionType === '质检') {
    order.currentStatus = order.isPostDoneBySewingFactory ? '待复检' : '待后道'
  } else if (actionType === '后道') {
    order.currentStatus = '待复检'
  } else {
    order.currentStatus = '待交出'
    ensurePostFinishingHandoverWarehouseRecord({ postOrderId: order.postOrderId })
  }
  updateWaitProcessRecord(order)
}

export function getPostFinishingWorkOrderById(postOrderId: string): PostFinishingWorkOrder | undefined {
  const order = postFinishingWorkOrders.find((item) => item.postOrderId === postOrderId)
  return order ? cloneWorkOrder(order) : undefined
}

export function getPostFinishingWorkOrderBySourceTaskId(sourceTaskId: string): PostFinishingWorkOrder | undefined {
  const order = postFinishingWorkOrders.find((item) =>
    item.sourceTaskId === sourceTaskId
    || item.sourceTaskNo === sourceTaskId
    || item.sourcePostTaskId === sourceTaskId
    || item.sourcePostTaskNo === sourceTaskId,
  )
  return order ? cloneWorkOrder(order) : undefined
}

export function getSewingFactoryPostTaskById(taskId: string): SewingFactoryPostTask | undefined {
  const task = sewingFactoryPostTasks.find((item) => item.sewingTaskId === taskId || item.postTaskId === taskId)
  return task ? { ...task } : undefined
}

function getMutableSewingFactoryPostTask(taskId: string): SewingFactoryPostTask {
  const task = sewingFactoryPostTasks.find((item) => item.sewingTaskId === taskId || item.postTaskId === taskId)
  if (!task) throw new Error(`未找到车缝后道任务：${taskId}`)
  return task
}

export function startSewingFactoryPostTask(taskId: string): SewingFactoryPostTask {
  const task = getMutableSewingFactoryPostTask(taskId)
  if (task.status !== '待后道') throw new Error('当前车缝后道任务不能开始后道')
  task.status = '后道中'
  return { ...task }
}

export function finishSewingFactoryPostTask(taskId: string, completedQty?: number): SewingFactoryPostTask {
  const task = getMutableSewingFactoryPostTask(taskId)
  if (task.status !== '后道中') throw new Error('当前车缝后道任务不能完成后道')
  task.status = '后道完成'
  task.completedPostGarmentQty = completedQty || task.plannedGarmentQty
  task.postFinishedAt = nowTimestamp()
  return { ...task }
}

export function transferSewingFactoryPostTaskToManagedFactory(taskId: string): SewingFactoryPostTask {
  const task = getMutableSewingFactoryPostTask(taskId)
  if (task.status !== '后道完成' && task.status !== '待交后道工厂') throw new Error('当前车缝后道任务不能交给后道工厂')
  task.status = '已交后道工厂'
  task.handedToManagedPostFactoryAt = nowTimestamp()
  return { ...task }
}

export function applyPostFinishingActionStart(input: {
  postOrderId: string
  actionType: PostFinishingActionType
  operatorName: string
  startedAt?: string
}): PostFinishingWorkOrder {
  const order = getMutablePostFinishingWorkOrder(input.postOrderId)
  assertPostActionAllowed(order, input.actionType)
  const now = input.startedAt || nowTimestamp()
  const action = getAction(order, input.actionType)
  action.status = getStartedStatus(input.actionType)
  action.startedAt = action.startedAt || now
  action.operatorName = input.operatorName
  order.currentStatus = getStartedStatus(input.actionType)
  order.updatedAt = now
  updateWaitProcessRecord(order)
  return cloneWorkOrder(order)
}

export function applyPostFinishingActionFinish(input: {
  postOrderId: string
  actionType: PostFinishingActionType
  operatorName: string
  finishedAt?: string
  submittedGarmentQty?: number
  acceptedGarmentQty?: number
  rejectedGarmentQty?: number
  diffGarmentQty?: number
  remark?: string
}): PostFinishingWorkOrder {
  const order = getMutablePostFinishingWorkOrder(input.postOrderId)
  assertPostActionAllowed(order, input.actionType)
  const now = input.finishedAt || nowTimestamp()
  const action = getAction(order, input.actionType)
  const submittedQty = input.submittedGarmentQty ?? action.submittedGarmentQty ?? order.plannedGarmentQty
  const rejectedQty = input.rejectedGarmentQty ?? action.rejectedGarmentQty ?? 0
  const diffQty = input.diffGarmentQty ?? action.diffGarmentQty ?? 0
  const acceptedQty = input.acceptedGarmentQty ?? Math.max(submittedQty - rejectedQty - diffQty, 0)

  action.status = getDoneStatus(input.actionType)
  action.startedAt = action.startedAt || now
  action.finishedAt = now
  action.operatorName = input.operatorName
  updateActionQty(action, submittedQty, acceptedQty, rejectedQty, diffQty, input.remark)
  applyNextStatusAfterFinish(order, input.actionType)
  order.updatedAt = now
  return cloneWorkOrder(order)
}

export function transferPostFinishingToManagedFactory(input: {
  postOrderId: string
  operatorName: string
  transferredAt?: string
  remark?: string
}): PostFinishingWorkOrder {
  const order = getMutablePostFinishingWorkOrder(input.postOrderId)
  if (!order.isPostDoneBySewingFactory) {
    throw new Error('专门后道工厂完整流程不需要车缝厂转交')
  }
  const now = input.transferredAt || nowTimestamp()
  order.currentStatus = '待接收领料'
  order.updatedAt = now
  order.postAction.status = '跳过后道'
  order.postAction.skipReason = '后道已由车缝厂完成'
  order.postAction.remark = input.remark || '车缝厂完成后道后交给后道工厂接收领料'
  updateWaitProcessRecord(order)
  return cloneWorkOrder(order)
}

export function receivePostFinishingAtManagedFactory(input: {
  postOrderId: string
  operatorName: string
  receivedAt?: string
}): PostFinishingWorkOrder {
  return applyPostFinishingActionFinish({
    postOrderId: input.postOrderId,
    actionType: '接收领料',
    operatorName: input.operatorName,
    finishedAt: input.receivedAt,
  })
}

export function ensurePostFinishingHandoverWarehouseRecord(input: {
  postOrderId: string
  createdAt?: string
}): PostFinishingWaitHandoverWarehouseRecord {
  const order = getMutablePostFinishingWorkOrder(input.postOrderId)
  if (order.recheckAction.status !== '复检完成' && order.currentStatus !== '待交出') {
    throw new Error('后道交出仓只能由复检完成后生成')
  }
  const existed = order.waitHandoverWarehouseRecordId
    ? waitHandoverWarehouseRecords.find((record) => record.handoverWarehouseRecordId === order.waitHandoverWarehouseRecordId)
    : undefined
  if (existed) {
    existed.availableHandoverGarmentQty = order.recheckAction.acceptedGarmentQty
    existed.diffGarmentQty = order.recheckAction.diffGarmentQty
    existed.status = order.currentStatus === '复检完成' ? '待交出' : order.currentStatus
    return { ...existed }
  }
  const now = input.createdAt || nowTimestamp()
  const id = `PFP-WH-${order.postOrderId.replace(/[^A-Za-z0-9]/g, '').slice(-8)}`
  const created: PostFinishingWaitHandoverWarehouseRecord = {
    handoverWarehouseRecordId: id,
    handoverWarehouseRecordNo: `HD-CK-${pad(waitHandoverWarehouseRecords.length + 1)}`,
    postOrderId: order.postOrderId,
    postOrderNo: order.postOrderNo,
    recheckActionId: order.recheckAction.actionId,
    sourceSewingTaskNo: order.sourceSewingTaskNo,
    postSourceLabel: getPostFinishingSourceLabel(order),
    productionOrderNo: order.sourceProductionOrderNo,
    postFactoryId: order.managedPostFactoryId,
    postFactoryName: order.managedPostFactoryName,
    availableHandoverGarmentQty: order.recheckAction.acceptedGarmentQty,
    handedOverGarmentQty: 0,
    writtenBackGarmentQty: 0,
    diffGarmentQty: order.recheckAction.diffGarmentQty,
    qtyUnit: '件',
    status: '待交出',
    createdAt: now,
  }
  waitHandoverWarehouseRecords.push(created)
  order.waitHandoverWarehouseRecordId = id
  order.currentStatus = '待交出'
  order.updatedAt = now
  order.handoverAction = {
    waitHandoverWarehouseRecordId: id,
    handoverGarmentQty: 0,
    receiveGarmentQty: 0,
    diffGarmentQty: order.recheckAction.diffGarmentQty,
    qtyUnit: '件',
    status: '待交出',
  }
  return { ...created }
}

export function submitPostFinishingHandoverRecord(input: {
  postOrderId: string
  operatorName: string
  submittedAt?: string
  submittedGarmentQty?: number
  writtenBackGarmentQty?: number
}): PostFinishingWorkOrder {
  const order = getMutablePostFinishingWorkOrder(input.postOrderId)
  const now = input.submittedAt || nowTimestamp()
  const handoverRecord = ensurePostFinishingHandoverWarehouseRecord({ postOrderId: order.postOrderId, createdAt: now })
  const mutableRecord = waitHandoverWarehouseRecords.find((record) => record.handoverWarehouseRecordId === handoverRecord.handoverWarehouseRecordId)
  if (mutableRecord) {
    mutableRecord.handedOverGarmentQty = input.submittedGarmentQty ?? mutableRecord.availableHandoverGarmentQty
    mutableRecord.writtenBackGarmentQty = input.writtenBackGarmentQty ?? mutableRecord.handedOverGarmentQty
    mutableRecord.diffGarmentQty = mutableRecord.handedOverGarmentQty - mutableRecord.writtenBackGarmentQty
    mutableRecord.status = mutableRecord.diffGarmentQty === 0 ? '已回写' : '有差异'
    order.handoverAction = {
      waitHandoverWarehouseRecordId: mutableRecord.handoverWarehouseRecordId,
      handoverRecordId: `HDR-POST-${order.postOrderId.replace(/[^A-Za-z0-9]/g, '').slice(-8)}`,
      handoverGarmentQty: mutableRecord.handedOverGarmentQty,
      receiveGarmentQty: mutableRecord.writtenBackGarmentQty,
      diffGarmentQty: mutableRecord.diffGarmentQty,
      qtyUnit: '件',
      status: mutableRecord.status,
    }
  }
  order.handoverRecordId = `HDR-POST-${order.postOrderId.replace(/[^A-Za-z0-9]/g, '').slice(-8)}`
  order.currentStatus = mutableRecord?.status || '已交出'
  order.updatedAt = now
  return cloneWorkOrder(order)
}

export function listPostFinishingWorkOrders(): PostFinishingWorkOrder[] {
  return postFinishingWorkOrders.map((order) => cloneWorkOrder(order))
}

export function listPostFinishingActionRecords(actionType?: PostFinishingActionType): PostFinishingActionRecord[] {
  const records = postFinishingWorkOrders.flatMap((order) => [order.receiveAction, order.qcAction, order.postAction, order.recheckAction])
  const filtered = actionType ? records.filter((record) => record.actionType === actionType) : records
  return filtered.map((record) => cloneActionRecord(record))
}

export function listPostFinishingQcOrders(): PostFinishingActionRecord[] {
  return listPostFinishingActionRecords('质检')
}

export function listPostFinishingRecheckOrders(): PostFinishingActionRecord[] {
  return listPostFinishingActionRecords('复检')
}

export function listPostFinishingReceiveOrders(): PostFinishingActionRecord[] {
  return listPostFinishingActionRecords('接收领料')
}

export function listSewingFactoryPostTasks(): SewingFactoryPostTask[] {
  return sewingFactoryPostTasks.map((task) => ({ ...task }))
}

export function listPostFinishingWaitProcessWarehouseRecords(): PostFinishingWaitProcessWarehouseRecord[] {
  return waitProcessWarehouseRecords.map((record) => ({ ...record }))
}

export function listPostFinishingWaitHandoverWarehouseRecords(): PostFinishingWaitHandoverWarehouseRecord[] {
  return waitHandoverWarehouseRecords.map((record) => ({ ...record }))
}

export function getPostFinishingSummary() {
  const orders = listPostFinishingWorkOrders()
  const waitProcess = listPostFinishingWaitProcessWarehouseRecords()
  const waitHandover = listPostFinishingWaitHandoverWarehouseRecords()
  return {
    total: orders.length,
    waitReceiveQty: waitProcess.filter((record) => record.waitAction === '接收领料').reduce((sum, record) => sum + record.inboundGarmentQty, 0),
    waitPostQty: waitProcess.filter((record) => record.waitAction === '后道').reduce((sum, record) => sum + record.inboundGarmentQty, 0),
    waitQcQty: waitProcess.filter((record) => record.waitAction === '质检').reduce((sum, record) => sum + record.inboundGarmentQty, 0),
    waitRecheckQty: waitProcess.filter((record) => record.waitAction === '复检').reduce((sum, record) => sum + record.inboundGarmentQty, 0),
    waitHandoverQty: waitHandover.reduce((sum, record) => sum + record.availableHandoverGarmentQty, 0),
    diffQty: waitHandover.reduce((sum, record) => sum + record.diffGarmentQty, 0),
    dedicatedCount: orders.filter((order) => order.routeMode === '专门后道工厂完整流程').length,
    sewingDoneCount: orders.filter((order) => order.routeMode === '车缝厂已做后道').length,
  }
}
