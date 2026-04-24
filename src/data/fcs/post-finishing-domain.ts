export type PostFinishingRouteMode = '专门后道工厂' | '非专门工厂含后道'
export type PostFinishingActionType = '后道' | '质检' | '复检'

const FULL_CAPABILITY_TEST_FACTORY_ID = 'ID-F090'
const FULL_CAPABILITY_TEST_FACTORY_NAME = '全能力测试工厂'

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
  remark: string
}

export interface PostFinishingWaitProcessWarehouseRecord {
  warehouseRecordId: string
  warehouseRecordNo: string
  postOrderId: string
  postOrderNo: string
  sourceFactoryId: string
  sourceFactoryName: string
  postFactoryId: string
  postFactoryName: string
  productionOrderNo: string
  skuSummary: string
  waitAction: PostFinishingActionType
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

export interface PostFinishingWorkOrder {
  postOrderId: string
  postOrderNo: string
  routeMode: PostFinishingRouteMode
  sourceProductionOrderId: string
  sourceProductionOrderNo: string
  sourceTaskId: string
  sourceTaskNo: string
  currentFactoryId: string
  currentFactoryName: string
  managedPostFactoryId: string
  managedPostFactoryName: string
  styleNo: string
  skuSummary: string
  plannedGarmentQty: number
  plannedGarmentQtyUnit: '件'
  currentStatus: string
  postAction: PostFinishingActionRecord
  qcAction?: PostFinishingActionRecord
  recheckAction?: PostFinishingActionRecord
  waitProcessWarehouseRecordId: string
  waitHandoverWarehouseRecordId?: string
  handoverRecordId?: string
  createdAt: string
  updatedAt: string
}

const dedicatedStatuses = [
  '待后道',
  '后道中',
  '后道完成',
  '待质检',
  '质检中',
  '质检完成',
  '待复检',
  '复检中',
  '复检完成',
  '待交出',
  '已交出',
  '已回写',
  '数量差异',
]

const nonDedicatedScenes = [
  '车缝厂完成后道，待交给后道工厂',
  '车缝厂已交后道工厂，后道工厂待质检',
  '后道工厂质检中',
  '后道工厂待复检',
  '后道工厂复检完成，生成待交出记录',
]

function pad(value: number): string {
  return String(value).padStart(3, '0')
}

function hasQc(status: string): boolean {
  return ['待质检', '质检中', '质检完成', '待复检', '复检中', '复检完成', '待交出', '已交出', '已回写', '数量差异'].includes(status)
    || status.includes('后道工厂')
}

function hasRecheck(status: string): boolean {
  return ['待复检', '复检中', '复检完成', '待交出', '已交出', '已回写', '数量差异'].includes(status)
    || status.includes('待复检')
    || status.includes('复检完成')
}

function hasHandover(status: string): boolean {
  return ['复检完成', '待交出', '已交出', '已回写', '数量差异'].includes(status) || status.includes('复检完成')
}

function resolveWaitAction(status: string): PostFinishingActionType {
  if (status.includes('质检')) return '质检'
  if (status.includes('复检')) return '复检'
  return '后道'
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
}): PostFinishingActionRecord {
  const done = input.status.includes('完成') || input.status.includes('待') || input.status.includes('已')
  const rejected = input.actionType === '质检' && input.index % 5 === 0 ? 3 : 0
  const diff = input.actionType === '复检' && input.index % 7 === 0 ? 2 : 0
  return {
    actionId: `PFA-${pad(input.index)}-${input.actionType}`,
    postOrderId: input.postOrderId,
    postOrderNo: input.postOrderNo,
    actionType: input.actionType,
    factoryId: input.factoryId,
    factoryName: input.factoryName,
    status: input.status,
    startedAt: done ? `2026-04-${String(8 + (input.index % 12)).padStart(2, '0')} 09:00` : undefined,
    finishedAt: input.status.includes('完成') || input.status.includes('待') || input.status.includes('已')
      ? `2026-04-${String(8 + (input.index % 12)).padStart(2, '0')} 17:30`
      : undefined,
    operatorName: input.actionType === '后道' ? '后道班长' : input.actionType === '质检' ? '质检员' : '复检员',
    submittedGarmentQty: input.qty,
    acceptedGarmentQty: Math.max(input.qty - rejected - diff, 0),
    rejectedGarmentQty: rejected,
    diffGarmentQty: diff,
    qtyUnit: '件',
    remark: `${input.actionType}记录按成衣件数复核`,
  }
}

function buildOrder(index: number, status: string, routeMode: PostFinishingRouteMode): PostFinishingWorkOrder {
  const isDedicated = routeMode === '专门后道工厂'
  const postOrderId = `POST-WO-${pad(index)}`
  const postOrderNo = `HD-${new Date().getFullYear()}-${pad(index)}`
  const currentFactoryId = isDedicated ? FULL_CAPABILITY_TEST_FACTORY_ID : 'ID-F024'
  const currentFactoryName = FULL_CAPABILITY_TEST_FACTORY_NAME
  const managedPostFactoryId = FULL_CAPABILITY_TEST_FACTORY_ID
  const managedPostFactoryName = FULL_CAPABILITY_TEST_FACTORY_NAME
  const qty = 240 + (index % 9) * 20
  const postAction = buildAction({
    index,
    postOrderId,
    postOrderNo,
    actionType: '后道',
    status: status.includes('后道中') ? '后道中' : status.includes('待后道') ? '待后道' : '后道完成',
    factoryId: currentFactoryId,
    factoryName: currentFactoryName,
    qty,
  })
  const qcAction = hasQc(status)
    ? buildAction({
        index,
        postOrderId,
        postOrderNo,
        actionType: '质检',
        status: status.includes('质检中') ? '质检中' : status.includes('待质检') ? '待质检' : '质检完成',
        factoryId: managedPostFactoryId,
        factoryName: managedPostFactoryName,
        qty: postAction.acceptedGarmentQty,
      })
    : undefined
  const recheckAction = hasRecheck(status)
    ? buildAction({
        index,
        postOrderId,
        postOrderNo,
        actionType: '复检',
        status: status.includes('复检中') ? '复检中' : status.includes('待复检') ? '待复检' : '复检完成',
        factoryId: managedPostFactoryId,
        factoryName: managedPostFactoryName,
        qty: qcAction?.acceptedGarmentQty ?? postAction.acceptedGarmentQty,
      })
    : undefined

  return {
    postOrderId,
    postOrderNo,
    routeMode,
    sourceProductionOrderId: `PO-${pad(index)}`,
    sourceProductionOrderNo: `生产单-${pad(index)}`,
    sourceTaskId: `TASK-POST-${pad(index)}`,
    sourceTaskNo: `后道来源任务-${pad(index)}`,
    currentFactoryId,
    currentFactoryName,
    managedPostFactoryId,
    managedPostFactoryName,
    styleNo: `HG-ST-${1000 + index}`,
    skuSummary: `成衣 SKU-${pad(index)} / 黑色 / M-L`,
    plannedGarmentQty: qty,
    plannedGarmentQtyUnit: '件',
    currentStatus: status,
    postAction,
    qcAction,
    recheckAction,
    waitProcessWarehouseRecordId: `PFP-WP-${pad(index)}`,
    waitHandoverWarehouseRecordId: hasHandover(status) ? `PFP-WH-${pad(index)}` : undefined,
    handoverRecordId: ['已交出', '已回写', '数量差异'].includes(status) ? `HDR-POST-${pad(index)}` : undefined,
    createdAt: `2026-04-${String(1 + (index % 20)).padStart(2, '0')} 08:30`,
    updatedAt: `2026-04-${String(8 + (index % 12)).padStart(2, '0')} 18:00`,
  }
}

const dedicatedOrders = dedicatedStatuses.flatMap((status, statusIndex) =>
  [0, 1, 2].map((offset) => buildOrder(statusIndex * 3 + offset + 1, status, '专门后道工厂')),
)

const nonDedicatedOrders = nonDedicatedScenes.flatMap((status, sceneIndex) =>
  [0, 1, 2].map((offset) => buildOrder(200 + sceneIndex * 3 + offset + 1, status, '非专门工厂含后道')),
)

const postFinishingWorkOrders: PostFinishingWorkOrder[] = [...dedicatedOrders, ...nonDedicatedOrders]

const waitProcessWarehouseRecords: PostFinishingWaitProcessWarehouseRecord[] = postFinishingWorkOrders.map((order, index) => ({
  warehouseRecordId: order.waitProcessWarehouseRecordId,
  warehouseRecordNo: `HD-RK-${pad(index + 1)}`,
  postOrderId: order.postOrderId,
  postOrderNo: order.postOrderNo,
  sourceFactoryId: order.currentFactoryId,
  sourceFactoryName: order.currentFactoryName,
  postFactoryId: order.managedPostFactoryId,
  postFactoryName: order.managedPostFactoryName,
  productionOrderNo: order.sourceProductionOrderNo,
  skuSummary: order.skuSummary,
  waitAction: resolveWaitAction(order.currentStatus),
  inboundGarmentQty: order.plannedGarmentQty,
  inboundGarmentQtyUnit: '件',
  warehouseLocation: `HD-A-${(index % 8) + 1}`,
  inboundAt: order.createdAt,
  status: order.currentStatus,
}))

const waitHandoverWarehouseRecords: PostFinishingWaitHandoverWarehouseRecord[] = postFinishingWorkOrders
  .filter((order) => order.waitHandoverWarehouseRecordId && order.recheckAction)
  .map((order, index) => {
    const availableQty = order.recheckAction?.acceptedGarmentQty ?? order.plannedGarmentQty
    const handedOver = order.currentStatus === '已交出' || order.currentStatus === '已回写' ? availableQty : 0
    const writtenBack = order.currentStatus === '已回写' ? Math.max(availableQty - (index % 4 === 0 ? 2 : 0), 0) : 0
    return {
      handoverWarehouseRecordId: order.waitHandoverWarehouseRecordId || '',
      handoverWarehouseRecordNo: `HD-CK-${pad(index + 1)}`,
      postOrderId: order.postOrderId,
      postOrderNo: order.postOrderNo,
      recheckActionId: order.recheckAction?.actionId || '',
      productionOrderNo: order.sourceProductionOrderNo,
      postFactoryId: order.managedPostFactoryId,
      postFactoryName: order.managedPostFactoryName,
      availableHandoverGarmentQty: availableQty,
      handedOverGarmentQty: handedOver,
      writtenBackGarmentQty: writtenBack,
      diffGarmentQty: Math.max(handedOver - writtenBack, 0),
      qtyUnit: '件',
      status: order.currentStatus,
      createdAt: order.updatedAt,
    }
  })

function nowTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function cloneActionRecord(record: PostFinishingActionRecord): PostFinishingActionRecord {
  return { ...record }
}

function cloneWorkOrder(order: PostFinishingWorkOrder): PostFinishingWorkOrder {
  return {
    ...order,
    postAction: cloneActionRecord(order.postAction),
    qcAction: order.qcAction ? cloneActionRecord(order.qcAction) : undefined,
    recheckAction: order.recheckAction ? cloneActionRecord(order.recheckAction) : undefined,
  }
}

function getMutablePostFinishingWorkOrder(postOrderId: string): PostFinishingWorkOrder {
  const order = postFinishingWorkOrders.find((item) => item.postOrderId === postOrderId)
  if (!order) {
    throw new Error(`未找到后道单：${postOrderId}`)
  }
  return order
}

function getOrderIndex(order: PostFinishingWorkOrder): number {
  const matched = order.postOrderId.match(/(\d+)$/)
  return matched ? Number(matched[1]) : postFinishingWorkOrders.findIndex((item) => item.postOrderId === order.postOrderId) + 1
}

function getAction(order: PostFinishingWorkOrder, actionType: PostFinishingActionType): PostFinishingActionRecord | undefined {
  if (actionType === '后道') return order.postAction
  if (actionType === '质检') return order.qcAction
  return order.recheckAction
}

function setAction(order: PostFinishingWorkOrder, action: PostFinishingActionRecord): void {
  if (action.actionType === '后道') order.postAction = action
  else if (action.actionType === '质检') order.qcAction = action
  else order.recheckAction = action
}

function ensureActionRecord(
  order: PostFinishingWorkOrder,
  actionType: PostFinishingActionType,
  status: string,
): PostFinishingActionRecord {
  const current = getAction(order, actionType)
  if (current) return current

  const factoryId = actionType === '后道' ? order.currentFactoryId : order.managedPostFactoryId
  const factoryName = actionType === '后道' ? order.currentFactoryName : order.managedPostFactoryName
  const qty =
    actionType === '后道'
      ? order.plannedGarmentQty
      : actionType === '质检'
        ? order.postAction.acceptedGarmentQty
        : order.qcAction?.acceptedGarmentQty ?? order.postAction.acceptedGarmentQty
  const created = buildAction({
    index: getOrderIndex(order),
    postOrderId: order.postOrderId,
    postOrderNo: order.postOrderNo,
    actionType,
    status,
    factoryId,
    factoryName,
    qty,
  })
  setAction(order, created)
  return created
}

function getStartedStatus(actionType: PostFinishingActionType): string {
  if (actionType === '后道') return '后道中'
  if (actionType === '质检') return '质检中'
  return '复检中'
}

function getWaitStatus(actionType: PostFinishingActionType): string {
  if (actionType === '后道') return '待后道'
  if (actionType === '质检') return '待质检'
  return '待复检'
}

function getDoneStatus(actionType: PostFinishingActionType): string {
  if (actionType === '后道') return '后道完成'
  if (actionType === '质检') return '质检完成'
  return '复检完成'
}

function updateWaitProcessRecord(order: PostFinishingWorkOrder, waitAction: PostFinishingActionType, status = order.currentStatus): void {
  const record = waitProcessWarehouseRecords.find((item) => item.warehouseRecordId === order.waitProcessWarehouseRecordId)
  if (!record) return
  record.waitAction = waitAction
  record.status = status
  record.inboundGarmentQty = order.plannedGarmentQty
  record.sourceFactoryId = order.currentFactoryId
  record.sourceFactoryName = order.currentFactoryName
  record.postFactoryId = order.managedPostFactoryId
  record.postFactoryName = order.managedPostFactoryName
}

function assertPostActionAllowed(order: PostFinishingWorkOrder, actionType: PostFinishingActionType): void {
  if (actionType === '后道') return
  if (order.routeMode !== '非专门工厂含后道') return
  const managedFactoryStage = ['已交后道工厂', '后道工厂待质检', '待质检', '质检中', '质检完成', '待复检', '复检中', '复检完成', '待交出', '已交出', '已回写'].includes(order.currentStatus)
  if (!managedFactoryStage) {
    throw new Error('非专门工厂只能执行后道，质检和复检必须由后道工厂执行')
  }
}

export function getPostFinishingWorkOrderById(postOrderId: string): PostFinishingWorkOrder | undefined {
  const order = postFinishingWorkOrders.find((item) => item.postOrderId === postOrderId)
  return order ? cloneWorkOrder(order) : undefined
}

export function getPostFinishingWorkOrderBySourceTaskId(sourceTaskId: string): PostFinishingWorkOrder | undefined {
  const order = postFinishingWorkOrders.find((item) => item.sourceTaskId === sourceTaskId || item.sourceTaskNo === sourceTaskId)
  return order ? cloneWorkOrder(order) : undefined
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
  const action = ensureActionRecord(order, input.actionType, getWaitStatus(input.actionType))
  action.status = getStartedStatus(input.actionType)
  action.startedAt = action.startedAt || now
  action.operatorName = input.operatorName
  order.currentStatus = getStartedStatus(input.actionType)
  order.updatedAt = now
  updateWaitProcessRecord(order, input.actionType, order.currentStatus)
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
  const action = ensureActionRecord(order, input.actionType, getStartedStatus(input.actionType))
  const submittedQty = input.submittedGarmentQty ?? action.submittedGarmentQty ?? order.plannedGarmentQty
  const rejectedQty = input.rejectedGarmentQty ?? action.rejectedGarmentQty ?? 0
  const diffQty = input.diffGarmentQty ?? action.diffGarmentQty ?? 0
  const acceptedQty = input.acceptedGarmentQty ?? Math.max(submittedQty - rejectedQty - diffQty, 0)

  action.status = getDoneStatus(input.actionType)
  action.startedAt = action.startedAt || now
  action.finishedAt = now
  action.operatorName = input.operatorName
  action.submittedGarmentQty = submittedQty
  action.acceptedGarmentQty = acceptedQty
  action.rejectedGarmentQty = rejectedQty
  action.diffGarmentQty = diffQty
  action.remark = input.remark || `${input.actionType}完成，按成衣件数回写`

  if (input.actionType === '后道') {
    if (order.routeMode === '非专门工厂含后道') {
      order.currentStatus = '待交后道工厂'
      updateWaitProcessRecord(order, '后道', order.currentStatus)
    } else {
      order.currentStatus = '待质检'
      ensureActionRecord(order, '质检', '待质检').status = '待质检'
      updateWaitProcessRecord(order, '质检', order.currentStatus)
    }
  } else if (input.actionType === '质检') {
    order.currentStatus = '待复检'
    ensureActionRecord(order, '复检', '待复检').status = '待复检'
    updateWaitProcessRecord(order, '复检', order.currentStatus)
  } else {
    order.currentStatus = '待交出'
    ensurePostFinishingHandoverWarehouseRecord({
      postOrderId: order.postOrderId,
      createdAt: now,
    })
  }

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
  if (order.routeMode !== '非专门工厂含后道') {
    throw new Error('专门后道工厂任务不需要转交后道工厂')
  }
  const now = input.transferredAt || nowTimestamp()
  order.currentStatus = '已交后道工厂'
  order.updatedAt = now
  order.postAction.remark = input.remark || '非专门工厂完成后道后交给后道工厂'
  updateWaitProcessRecord(order, '质检', order.currentStatus)
  return cloneWorkOrder(order)
}

export function receivePostFinishingAtManagedFactory(input: {
  postOrderId: string
  operatorName: string
  receivedAt?: string
}): PostFinishingWorkOrder {
  const order = getMutablePostFinishingWorkOrder(input.postOrderId)
  if (order.routeMode !== '非专门工厂含后道') {
    throw new Error('专门后道工厂任务已在本厂处理')
  }
  const now = input.receivedAt || nowTimestamp()
  order.currentStatus = '后道工厂待质检'
  ensureActionRecord(order, '质检', '待质检').status = '待质检'
  order.updatedAt = now
  updateWaitProcessRecord(order, '质检', order.currentStatus)
  return cloneWorkOrder(order)
}

export function ensurePostFinishingHandoverWarehouseRecord(input: {
  postOrderId: string
  createdAt?: string
}): PostFinishingWaitHandoverWarehouseRecord {
  const order = getMutablePostFinishingWorkOrder(input.postOrderId)
  const recheckAction = ensureActionRecord(order, '复检', '复检完成')
  const existed = order.waitHandoverWarehouseRecordId
    ? waitHandoverWarehouseRecords.find((record) => record.handoverWarehouseRecordId === order.waitHandoverWarehouseRecordId)
    : undefined
  if (existed) {
    existed.availableHandoverGarmentQty = recheckAction.acceptedGarmentQty
    existed.diffGarmentQty = recheckAction.diffGarmentQty
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
    recheckActionId: recheckAction.actionId,
    productionOrderNo: order.sourceProductionOrderNo,
    postFactoryId: order.managedPostFactoryId,
    postFactoryName: order.managedPostFactoryName,
    availableHandoverGarmentQty: recheckAction.acceptedGarmentQty,
    handedOverGarmentQty: 0,
    writtenBackGarmentQty: 0,
    diffGarmentQty: recheckAction.diffGarmentQty,
    qtyUnit: '件',
    status: '待交出',
    createdAt: now,
  }
  waitHandoverWarehouseRecords.push(created)
  order.waitHandoverWarehouseRecordId = id
  order.currentStatus = '待交出'
  order.updatedAt = now
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
    mutableRecord.status = mutableRecord.diffGarmentQty === 0 ? '已回写' : '数量差异'
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
  const records = postFinishingWorkOrders.flatMap((order) => [order.postAction, order.qcAction, order.recheckAction].filter(Boolean) as PostFinishingActionRecord[])
  const filtered = actionType ? records.filter((record) => record.actionType === actionType) : records
  return filtered.map((record) => cloneActionRecord(record))
}

export function listPostFinishingQcOrders(): PostFinishingActionRecord[] {
  return listPostFinishingActionRecords('质检')
}

export function listPostFinishingRecheckOrders(): PostFinishingActionRecord[] {
  return listPostFinishingActionRecords('复检')
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
    waitPostQty: waitProcess.filter((record) => record.waitAction === '后道').reduce((sum, record) => sum + record.inboundGarmentQty, 0),
    waitQcQty: waitProcess.filter((record) => record.waitAction === '质检').reduce((sum, record) => sum + record.inboundGarmentQty, 0),
    waitRecheckQty: waitProcess.filter((record) => record.waitAction === '复检').reduce((sum, record) => sum + record.inboundGarmentQty, 0),
    waitHandoverQty: waitHandover.reduce((sum, record) => sum + record.availableHandoverGarmentQty, 0),
    diffQty: waitHandover.reduce((sum, record) => sum + record.diffGarmentQty, 0),
    dedicatedCount: orders.filter((order) => order.routeMode === '专门后道工厂').length,
    transferInCount: orders.filter((order) => order.routeMode === '非专门工厂含后道').length,
  }
}
