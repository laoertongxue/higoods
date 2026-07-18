import {
  assignDyeWorkOrderFactory,
  getDyeWorkOrderById,
  getDyeWorkOrderByTaskId,
  listDyeExecutionNodeRecords,
  registerDyeReceiptOnlineStatusListener,
  type DyeWorkOrder,
  type DyeWorkOrderStatus,
} from './dyeing-task-domain.ts'
import { listPdaGenericProcessTasks } from './pda-task-mock-factory.ts'

export const DYE_WORK_ORDER_ONLINE_STATUSES = [
  '等待处理',
  '取消',
  '染色中',
  '染色完成',
  '待审核',
  '部分入库',
  '已完成',
] as const

export type DyeWorkOrderOnlineStatus = typeof DYE_WORK_ORDER_ONLINE_STATUSES[number]
export type DyeWorkOrderOnlineAction = '接单' | '开工' | '完工' | '交出' | '部分入库' | '全部入库' | '主管取消'
export type DyeWorkOrderOperationSource = 'PFOS' | 'PDA' | '入库'

export interface DyeWorkOrderOnlineRecord {
  dyeOrderId: string
  workOrderNo: string
  status: DyeWorkOrderOnlineStatus
  accepted: boolean
  version: number
  plannedFinishAt: string
  factoryId: string
  factoryName: string
  receiverName: string
  shade: '' | '浅色' | '深色'
  temperature: 190 | 200 | 205 | null
  rawMaterialQty: number
  rawMaterialRollCount: number
  completedQty: number
  lossQty: number
  remark: string
  completedAt: string
  deliveredAt: string
  updatedAt: string
}

export interface DyeWorkOrderOnlineFieldChange {
  field: string
  label: string
  before: string
  after: string
}

export interface DyeWorkOrderOnlineLog {
  logId: string
  dyeOrderId: string
  workOrderNo: string
  operatedAt: string
  operatorName: string
  source: DyeWorkOrderOperationSource
  action: DyeWorkOrderOnlineAction | 'PFOS人工编辑'
  beforeStatus: DyeWorkOrderOnlineStatus
  afterStatus: DyeWorkOrderOnlineStatus
  changes: DyeWorkOrderOnlineFieldChange[]
  remark: string
}

export interface DyeWorkOrderPfosEditInput {
  expectedVersion: number
  operatorName: string
  operatedAt: string
  status: DyeWorkOrderOnlineStatus
  plannedFinishAt: string
  factoryId: string
  factoryName: string
  receiverName: string
  shade: '' | '浅色' | '深色'
  temperature: 190 | 200 | 205 | null
  rawMaterialQty: number
  rawMaterialRollCount: number
  completedQty: number
  lossQty: number
  remark: string
}

export interface DyeWorkOrderPdaActionInput {
  action: DyeWorkOrderOnlineAction
  operatorName: string
  operatedAt: string
  source: Extract<DyeWorkOrderOperationSource, 'PDA' | '入库'>
  completedQty?: number
  lossQty?: number
  remark?: string
}

const records = new Map<string, DyeWorkOrderOnlineRecord>()
const logs = new Map<string, DyeWorkOrderOnlineLog[]>()
let logSequence = 0

const STATUS_RANK: Record<DyeWorkOrderOnlineStatus, number> = {
  等待处理: 0,
  取消: 99,
  染色中: 1,
  染色完成: 2,
  待审核: 3,
  部分入库: 4,
  已完成: 5,
}

function mapExecutionStatus(status: DyeWorkOrderStatus): DyeWorkOrderOnlineStatus {
  if (status === 'REJECTED') return '取消'
  if (status === 'COMPLETED' || status === 'FULL_HANDOVER') return '已完成'
  if (status === 'PARTIAL_HANDOVER') return '部分入库'
  if (status === 'HANDOVER_WAIT_RECEIVE' || status === 'WAIT_REVIEW' || status === 'HANDOVER_DIFFERENCE') return '待审核'
  if (status === 'WAIT_HANDOVER') return '染色完成'
  if (['DYEING', 'DEHYDRATING', 'DRYING', 'SETTING', 'ROLLING', 'PACKING'].includes(status)) return '染色中'
  return '等待处理'
}

function assertNonNegative(label: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label}必须是非负数`)
}

function cloneRecord(record: DyeWorkOrderOnlineRecord): DyeWorkOrderOnlineRecord {
  return { ...record }
}

function cloneLog(log: DyeWorkOrderOnlineLog): DyeWorkOrderOnlineLog {
  return { ...log, changes: log.changes.map((change) => ({ ...change })) }
}

function makeInitialRecord(order: DyeWorkOrder): DyeWorkOrderOnlineRecord {
  const status = mapExecutionStatus(order.status)
  const task = listPdaGenericProcessTasks().find((item) => item.taskId === order.taskId)
  const nodes = listDyeExecutionNodeRecords(order.dyeOrderId)
  const dyeInputQty = nodes.find((node) => node.nodeCode === 'DYE')?.inputQty || 0
  const completedNode = [...nodes]
    .reverse()
    .find((node) => node.finishedAt && typeof node.outputQty === 'number')
  const hasCompletedDyeing = ['染色完成', '待审核', '部分入库', '已完成', '取消'].includes(status)
  const completedQty = hasCompletedDyeing ? completedNode?.outputQty || 0 : 0
  const rawMaterialQty = dyeInputQty || completedQty
  const lossQty = completedQty > 0 ? Number(Math.max(0, rawMaterialQty - completedQty).toFixed(2)) : 0
  return {
    dyeOrderId: order.dyeOrderId,
    workOrderNo: order.dyeOrderNo,
    status,
    accepted: Boolean(order.dyeFactoryId && (task?.acceptanceStatus === 'ACCEPTED' || status !== '等待处理')),
    version: 1,
    plannedFinishAt: order.plannedFinishAt || '',
    factoryId: order.dyeFactoryId,
    factoryName: order.dyeFactoryName,
    receiverName: order.receiverName,
    shade: '',
    temperature: null,
    rawMaterialQty,
    rawMaterialRollCount: rawMaterialQty > 0 ? order.plannedRollCount || Math.max(1, Math.ceil(rawMaterialQty / 80)) : 0,
    completedQty,
    lossQty,
    remark: order.remark || '',
    completedAt: status === '染色完成' || status === '待审核' || status === '部分入库' || status === '已完成' ? order.updatedAt : '',
    deliveredAt: status === '待审核' || status === '部分入库' || status === '已完成' ? order.updatedAt : '',
    updatedAt: order.updatedAt,
  }
}

function getMutableRecord(dyeOrderId: string): DyeWorkOrderOnlineRecord {
  const existing = records.get(dyeOrderId)
  if (existing) return existing
  const order = getDyeWorkOrderById(dyeOrderId)
  if (!order) throw new Error('染色加工单不存在')
  const created = makeInitialRecord(order)
  records.set(dyeOrderId, created)
  return created
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  return String(value)
}

function appendLog(
  record: DyeWorkOrderOnlineRecord,
  input: {
    operatedAt: string
    operatorName: string
    source: DyeWorkOrderOperationSource
    action: DyeWorkOrderOnlineAction | 'PFOS人工编辑'
    beforeStatus: DyeWorkOrderOnlineStatus
    changes: DyeWorkOrderOnlineFieldChange[]
    remark?: string
  },
): void {
  const next: DyeWorkOrderOnlineLog = {
    logId: `DYE-ONLINE-LOG-${String(++logSequence).padStart(5, '0')}`,
    dyeOrderId: record.dyeOrderId,
    workOrderNo: record.workOrderNo,
    operatedAt: input.operatedAt,
    operatorName: input.operatorName,
    source: input.source,
    action: input.action,
    beforeStatus: input.beforeStatus,
    afterStatus: record.status,
    changes: input.changes,
    remark: input.remark || '',
  }
  logs.set(record.dyeOrderId, [...(logs.get(record.dyeOrderId) || []), next])
}

function statusChange(before: DyeWorkOrderOnlineStatus, after: DyeWorkOrderOnlineStatus): DyeWorkOrderOnlineFieldChange[] {
  return before === after ? [] : [{ field: 'status', label: '状态', before, after }]
}

export function getDyeWorkOrderOnlineRecord(dyeOrderId: string): DyeWorkOrderOnlineRecord {
  return cloneRecord(getMutableRecord(dyeOrderId))
}

export function listDyeWorkOrderOnlineLogs(dyeOrderId: string): DyeWorkOrderOnlineLog[] {
  return (logs.get(dyeOrderId) || []).map(cloneLog).sort((a, b) => b.operatedAt.localeCompare(a.operatedAt))
}

export function isDyeWorkOrderHighRiskStatusChange(
  before: DyeWorkOrderOnlineStatus,
  after: DyeWorkOrderOnlineStatus,
): boolean {
  if (before === after) return false
  return after === '取消'
    || before === '取消'
    || after === '部分入库'
    || after === '已完成'
    || STATUS_RANK[after] < STATUS_RANK[before]
}

export function getDyeWorkOrderOnlineActionError(
  dyeOrderId: string,
  action: DyeWorkOrderOnlineAction,
): string | null {
  const record = getMutableRecord(dyeOrderId)
  if (record.status === '取消' && action !== '主管取消') return '当前加工单已取消，不能继续操作'
  if (action === '接单') {
    if (!record.factoryId) return '当前加工单待分配工厂，不能接单'
    if (record.accepted) return '当前加工单不能重复接单'
    return record.status === '取消' || record.status === '已完成' ? '当前加工单不能接单' : null
  }
  if (action === '开工') {
    if (record.status !== '等待处理') return '当前加工单不是等待处理状态，不能开工'
    return record.accepted ? null : '请先接单后再开工'
  }
  if (action === '完工') return record.status === '染色中' ? null : '当前加工单尚未开工，不能完工'
  if (action === '交出') return record.status === '染色完成' ? null : '请先完工后再交出'
  if (action === '部分入库') return record.status === '待审核' || record.status === '部分入库' ? null : '当前加工单不能部分入库'
  if (action === '全部入库') return record.status === '待审核' || record.status === '部分入库' ? null : '当前加工单不能全部入库'
  if (action === '主管取消') return record.status === '已完成' ? '已完成加工单不能取消' : null
  return '当前加工单不能执行该操作'
}

export function assertDyeWorkOrderOnlineActionAllowed(
  dyeOrderId: string,
  action: DyeWorkOrderOnlineAction,
): void {
  const error = getDyeWorkOrderOnlineActionError(dyeOrderId, action)
  if (error) throw new Error(error)
}

export function isDyeWorkOrderOnlineActionAllowed(
  dyeOrderId: string,
  action: DyeWorkOrderOnlineAction,
): boolean {
  return getDyeWorkOrderOnlineActionError(dyeOrderId, action) === null
}

export function updateDyeWorkOrderFromPfos(
  dyeOrderId: string,
  input: DyeWorkOrderPfosEditInput,
): DyeWorkOrderOnlineRecord {
  const record = getMutableRecord(dyeOrderId)
  if (input.expectedVersion !== record.version) throw new Error('加工单已被其他操作更新，请重新打开后再保存')
  if (record.status === '已完成' && input.status !== '已完成') throw new Error('已完成加工单不能修改状态')
  assertNonNegative('原料数量', input.rawMaterialQty)
  assertNonNegative('原料卷数', input.rawMaterialRollCount)
  assertNonNegative('完成数量', input.completedQty)
  assertNonNegative('损耗数量', input.lossQty)
  if (!Number.isInteger(input.rawMaterialRollCount)) throw new Error('原料卷数必须是整数')
  if (!DYE_WORK_ORDER_ONLINE_STATUSES.includes(input.status)) throw new Error('状态不在允许范围内')

  const before = cloneRecord(record)
  const factoryChanged = before.factoryId !== input.factoryId || before.factoryName !== input.factoryName
  if (factoryChanged) {
    assignDyeWorkOrderFactory(dyeOrderId, {
      factoryId: input.factoryId,
      factoryName: input.factoryName,
      assignedAt: input.operatedAt,
      assignedBy: input.operatorName,
    })
  }
  Object.assign(record, {
    status: input.status,
    plannedFinishAt: input.plannedFinishAt,
    factoryId: input.factoryId,
    factoryName: input.factoryName,
    receiverName: input.receiverName,
    shade: input.shade,
    temperature: input.temperature,
    rawMaterialQty: input.rawMaterialQty,
    rawMaterialRollCount: input.rawMaterialRollCount,
    completedQty: input.completedQty,
    lossQty: input.lossQty,
    remark: input.remark,
    completedAt: input.status === '染色完成' && !record.completedAt ? input.operatedAt : record.completedAt,
    deliveredAt: input.status === '待审核' && !record.deliveredAt ? input.operatedAt : record.deliveredAt,
    updatedAt: input.operatedAt,
    version: record.version + 1,
    accepted: factoryChanged ? false : record.accepted,
  })

  const fields: Array<[keyof DyeWorkOrderOnlineRecord, string]> = [
    ['status', '状态'],
    ['plannedFinishAt', '预计完成时间'],
    ['factoryName', '生产工厂'],
    ['receiverName', '面料接收人'],
    ['shade', '深浅'],
    ['temperature', '温度'],
    ['rawMaterialQty', '原料数量'],
    ['rawMaterialRollCount', '原料卷数'],
    ['completedQty', '完成数量'],
    ['lossQty', '损耗数量'],
    ['remark', '备注'],
  ]
  const changes = fields.flatMap(([field, label]) => before[field] === record[field]
    ? []
    : [{ field, label, before: formatValue(before[field]), after: formatValue(record[field]) }])
  appendLog(record, {
    operatedAt: input.operatedAt,
    operatorName: input.operatorName,
    source: 'PFOS',
    action: 'PFOS人工编辑',
    beforeStatus: before.status,
    changes,
    remark: input.remark,
  })
  return cloneRecord(record)
}

export function advanceDyeWorkOrderOnlineStatus(
  dyeOrderId: string,
  input: DyeWorkOrderPdaActionInput,
): DyeWorkOrderOnlineRecord {
  const record = getMutableRecord(dyeOrderId)
  assertDyeWorkOrderOnlineActionAllowed(dyeOrderId, input.action)
  const beforeStatus = record.status
  let nextStatus = beforeStatus

  if (input.action === '接单') {
    record.accepted = true
  } else if (input.action === '开工') {
    nextStatus = '染色中'
  } else if (input.action === '完工') {
    nextStatus = '染色完成'
    assertNonNegative('完成数量', input.completedQty ?? record.completedQty)
    assertNonNegative('损耗数量', input.lossQty ?? record.lossQty)
    record.completedQty = input.completedQty ?? record.completedQty
    record.lossQty = input.lossQty ?? record.lossQty
    record.completedAt = input.operatedAt
  } else if (input.action === '交出') {
    nextStatus = '待审核'
    record.deliveredAt = input.operatedAt
  } else if (input.action === '部分入库') {
    nextStatus = '部分入库'
  } else if (input.action === '全部入库') {
    nextStatus = '已完成'
  } else if (input.action === '主管取消') {
    nextStatus = '取消'
  }

  record.status = nextStatus
  record.updatedAt = input.operatedAt
  record.version += 1
  appendLog(record, {
    operatedAt: input.operatedAt,
    operatorName: input.operatorName,
    source: input.source,
    action: input.action,
    beforeStatus,
    changes: statusChange(beforeStatus, record.status),
    remark: input.remark,
  })
  return cloneRecord(record)
}

export function recordDyeWorkOrderPdaAcceptance(
  taskId: string,
  operatorName: string,
  operatedAt: string,
): DyeWorkOrderOnlineRecord | null {
  const order = getDyeWorkOrderByTaskId(taskId)
  if (!order) return null
  const current = getDyeWorkOrderOnlineRecord(order.dyeOrderId)
  if (current.accepted) return current
  return advanceDyeWorkOrderOnlineStatus(order.dyeOrderId, {
    action: '接单',
    operatorName,
    operatedAt,
    source: 'PDA',
  })
}

export function assertDyeWorkOrderPdaStartAllowed(taskId: string): void {
  const order = getDyeWorkOrderByTaskId(taskId)
  if (order) assertDyeWorkOrderOnlineActionAllowed(order.dyeOrderId, '开工')
}

export function recordDyeWorkOrderPdaStart(
  taskId: string,
  operatorName: string,
  operatedAt: string,
): DyeWorkOrderOnlineRecord | null {
  const order = getDyeWorkOrderByTaskId(taskId)
  if (!order) return null
  return advanceDyeWorkOrderOnlineStatus(order.dyeOrderId, {
    action: '开工',
    operatorName,
    operatedAt,
    source: 'PDA',
  })
}

export function assertDyeWorkOrderPdaAcceptanceAllowed(taskId: string): void {
  const order = getDyeWorkOrderByTaskId(taskId)
  if (order) assertDyeWorkOrderOnlineActionAllowed(order.dyeOrderId, '接单')
}

registerDyeReceiptOnlineStatusListener({
  validate: (event) => {
    assertDyeWorkOrderOnlineActionAllowed(
      event.dyeOrderId,
      event.receivedQty < event.expectedQty ? '部分入库' : '全部入库',
    )
  },
  commit: (event) => {
    advanceDyeWorkOrderOnlineStatus(event.dyeOrderId, {
      action: event.receivedQty < event.expectedQty ? '部分入库' : '全部入库',
      operatorName: event.receivedBy,
      operatedAt: event.receivedAt,
      source: '入库',
      remark: `累计实收 ${event.receivedQty} / 应收 ${event.expectedQty}`,
    })
  },
})
