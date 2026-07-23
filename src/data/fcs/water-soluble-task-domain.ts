import { getFactoryMasterRecordById } from './factory-master-store.ts'
import { listGeneratedProductionTaskArtifacts, type GeneratedTaskArtifact } from './production-artifact-generation.ts'
import { productionOrders } from './production-orders.ts'
import type { ProcessTask, QtyUnit } from './process-tasks.ts'
import { buildTaskQrValue } from './task-qr.ts'
import {
  validateWaterSolublePdaActor,
  type WaterSolublePdaActor,
} from './water-soluble-pda-actor.ts'

export type WaterSolubleWorkOrderStatus =
  | 'WAIT_FACTORY_ASSIGNMENT'
  | 'WAIT_MATERIAL'
  | 'WAIT_WATER_SOLUBLE'
  | 'WATER_SOLUBLE_IN_PROGRESS'
  | 'PRODUCTION_PAUSED'
  | 'WAIT_HANDOVER'
  | 'HANDOVER_WAIT_RECEIVE'
  | 'RECEIPT_DIFFERENCE'
  | 'DONE'

export type WaterSolubleSupervisorDecision =
  | 'CONTINUE_PROCESSING'
  | 'CONTINUE_WITH_ACTUAL_QTY'
  | 'RETURN_FOR_REWORK'

export const WATER_SOLUBLE_STATUS_LABEL: Record<WaterSolubleWorkOrderStatus, string> = {
  WAIT_FACTORY_ASSIGNMENT: '待分配染厂',
  WAIT_MATERIAL: '待原料',
  WAIT_WATER_SOLUBLE: '待水溶',
  WATER_SOLUBLE_IN_PROGRESS: '水溶中',
  PRODUCTION_PAUSED: '生产暂停',
  WAIT_HANDOVER: '待交出',
  HANDOVER_WAIT_RECEIVE: '交出待收货',
  RECEIPT_DIFFERENCE: '收货差异',
  DONE: '已完成',
}

export interface WaterSolubleActionLog {
  action: string
  detail: string
  at: string
  operatorName?: string
}

export interface WaterSolubleWorkOrder {
  waterOrderId: string
  waterOrderNo: string
  generationKey: string
  sourceArtifactId: string
  sourceDemandIds: []
  processCode: 'WATER_SOLUBLE'
  productionOrderId: string
  productionOrderNo: string
  techPackVersionId: string
  bomItemId: string
  materialCode: string
  materialName: string
  materialSpec: string
  plannedQty: number
  completedQty: number
  handoverQty?: number
  receivedQty?: number
  qtyUnit: string
  factoryId?: string
  factoryName?: string
  status: WaterSolubleWorkOrderStatus
  taskId: string
  taskNo: string
  taskQrValue: string
  handoverOrderId?: string
  exceptionReason?: string
  supervisorDecision?: WaterSolubleSupervisorDecision
  createdAt: string
  updatedAt: string
  actionLogs: WaterSolubleActionLog[]
}

export interface WaterSolubleActionResult {
  ok: boolean
  message: string
  order?: WaterSolubleWorkOrder
}

export interface WaterSolubleFactoryCapabilityResult {
  ok: boolean
  message: string
}

export interface WaterSolubleMobileTask extends ProcessTask {
  waterOrderId: string
  sourceArtifactId: string
  bomItemId: string
  materialCode: string
  materialName: string
  sourceQtyUnit: string
}

export interface WaterSolubleCurrentAction {
  actionCode: 'ASSIGN_FACTORY' | 'WAIT_MATERIAL' | 'START' | 'COMPLETE' | 'SUPERVISOR' | 'HANDOVER' | 'WAIT_RECEIPT' | 'RESOLVE_DIFFERENCE' | 'DONE'
  actionName: string
  message: string
}

const INITIAL_TIME = '2026-07-11 08:00:00'
const DEMO_FACTORY_ID = 'F090'
let orderStore: Map<string, WaterSolubleWorkOrder> | null = null

function cloneOrder(order: WaterSolubleWorkOrder): WaterSolubleWorkOrder {
  return {
    ...order,
    sourceDemandIds: [],
    actionLogs: order.actionLogs.map((item) => ({ ...item })),
  }
}

function toIdSegment(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, '_')
}

function toStableNumericToken(value: string, size: number): string {
  let hash = 14695981039346656037n
  for (const character of value) {
    hash ^= BigInt(character.charCodeAt(0))
    hash = BigInt.asUintN(64, hash * 1099511628211n)
  }
  const modulus = 10n ** BigInt(size)
  return (hash % modulus).toString().padStart(size, '0')
}

export function buildWaterSolubleGenerationKey(productionOrderId: string, bomItemId: string): string {
  return `${productionOrderId.trim()}::${bomItemId.trim()}`
}

export function buildWaterSolubleOrderNo(
  productionOrderNo: string,
  productionOrderId: string,
  materialSequence: number,
): string {
  if (!Number.isInteger(materialSequence) || materialSequence < 1) {
    throw new Error('水溶加工单物料序号必须为正整数')
  }
  const matched = productionOrderNo.trim().match(/^PO-(\d{6})-(\d+)$/i)
  const productionToken = matched
    ? `${matched[1]}${matched[2].padStart(3, '0')}`
    : toStableNumericToken(`${productionOrderNo}::${productionOrderId}`, 9)
  return `SRJG-${productionToken}-${String(materialSequence).padStart(3, '0')}`
}

type MaterialWaterSolubleTaskArtifact = GeneratedTaskArtifact & Required<Pick<GeneratedTaskArtifact,
  'bomItemId' | 'materialCode' | 'materialName' | 'plannedQty' | 'plannedUnit' | 'linkedBomItemIds'
>>

function isMaterialWaterSolubleTaskArtifact(artifact: GeneratedTaskArtifact): artifact is MaterialWaterSolubleTaskArtifact {
  return artifact.processCode === 'WATER_SOLUBLE'
    && artifact.artifactType === 'TASK'
    && !artifact.artifactId.startsWith('DICT-')
    && !artifact.sourceEntryId.startsWith('DICT-MOCK-')
    && Boolean(artifact.bomItemId?.trim())
    && Boolean(artifact.materialCode?.trim())
    && Boolean(artifact.materialName?.trim())
    && Number.isFinite(artifact.plannedQty)
    && (artifact.plannedQty ?? 0) > 0
    && Boolean(artifact.plannedUnit?.trim())
    && artifact.linkedBomItemIds?.length === 1
    && artifact.linkedBomItemIds[0] === artifact.bomItemId
}

function buildOrderFromArtifact(artifact: MaterialWaterSolubleTaskArtifact, materialSequence: number): WaterSolubleWorkOrder {
  const productionOrder = productionOrders.find((item) => item.productionOrderId === artifact.orderId)
  const productionOrderNo = productionOrder?.productionOrderNo ?? artifact.orderId
  const bomItemId = artifact.bomItemId
  const generationKey = buildWaterSolubleGenerationKey(artifact.orderId, bomItemId)
  const idSegment = toIdSegment(generationKey)
  const taskId = `TASK-WATER-${idSegment}`
  const waterOrderNo = buildWaterSolubleOrderNo(productionOrderNo, artifact.orderId, materialSequence)

  return {
    waterOrderId: `WATER-${idSegment}`,
    waterOrderNo,
    generationKey,
    sourceArtifactId: artifact.artifactId,
    sourceDemandIds: [],
    processCode: 'WATER_SOLUBLE',
    productionOrderId: artifact.orderId,
    productionOrderNo,
    techPackVersionId: artifact.techPackId,
    bomItemId,
    materialCode: artifact.materialCode,
    materialName: artifact.materialName,
    materialSpec: `${artifact.materialName} / ${artifact.plannedUnit}`,
    plannedQty: artifact.plannedQty,
    completedQty: 0,
    qtyUnit: artifact.plannedUnit,
    status: 'WAIT_FACTORY_ASSIGNMENT',
    taskId,
    taskNo: waterOrderNo,
    taskQrValue: buildTaskQrValue(taskId),
    createdAt: INITIAL_TIME,
    updatedAt: INITIAL_TIME,
    actionLogs: [{ action: '生成水溶加工单', detail: `由物料级产物 ${artifact.artifactId} 生成`, at: INITIAL_TIME }],
  }
}

function buildOrdersFromCurrentArtifacts(): WaterSolubleWorkOrder[] {
  const artifacts = listGeneratedProductionTaskArtifacts()
    .filter(isMaterialWaterSolubleTaskArtifact)
  const materialSequenceByGenerationKey = new Map<string, number>()
  const artifactsByProductionOrder = new Map<string, MaterialWaterSolubleTaskArtifact[]>()
  artifacts.forEach((artifact) => {
    const group = artifactsByProductionOrder.get(artifact.orderId) ?? []
    group.push(artifact)
    artifactsByProductionOrder.set(artifact.orderId, group)
  })
  artifactsByProductionOrder.forEach((group) => {
    group
      .sort((left, right) => left.bomItemId.localeCompare(right.bomItemId))
      .forEach((artifact, index) => {
        materialSequenceByGenerationKey.set(
          buildWaterSolubleGenerationKey(artifact.orderId, artifact.bomItemId),
          index + 1,
        )
      })
  })
  const orders = artifacts.map((artifact) => {
    const generationKey = buildWaterSolubleGenerationKey(artifact.orderId, artifact.bomItemId)
    const materialSequence = materialSequenceByGenerationKey.get(generationKey)
    if (!materialSequence) throw new Error(`水溶加工单缺少稳定物料序号：${generationKey}`)
    return buildOrderFromArtifact(artifact, materialSequence)
  })
  const uniqueOrderNos = new Set<string>()
  orders.forEach((order) => {
    if (uniqueOrderNos.has(order.waterOrderNo)) {
      throw new Error(`水溶加工单号冲突：${order.waterOrderNo}，请检查正式生产单与 BOM 来源`)
    }
    uniqueOrderNos.add(order.waterOrderNo)
  })
  return orders
}

function canRefreshSourceFields(order: WaterSolubleWorkOrder): boolean {
  return order.status === 'WAIT_FACTORY_ASSIGNMENT'
    && !order.factoryId
    && order.completedQty === 0
    && order.actionLogs.length === 1
}

function seedWaterSolubleDemoOrders(store: Map<string, WaterSolubleWorkOrder>): void {
  const factory = getFactoryMasterRecordById(DEMO_FACTORY_ID)
  if (!factory || !canAssignWaterSolubleFactory(factory.id).ok) return
  const orders = [...store.values()].sort((left, right) => left.generationKey.localeCompare(right.generationKey))
  const inProgress = orders[1]
  const paused = orders[2]
  if (inProgress) {
    inProgress.factoryId = factory.id
    inProgress.factoryName = factory.name
    inProgress.status = 'WATER_SOLUBLE_IN_PROGRESS'
    inProgress.updatedAt = '2026-07-11 08:15:00'
    inProgress.actionLogs.push(
      { action: '分配染厂', detail: `已分配至 ${factory.name}`, at: '2026-07-11 08:05:00' },
      { action: '确认原料到位', detail: '原料已到位，可以开始水溶', at: '2026-07-11 08:10:00' },
      { action: '开始水溶', detail: '工厂已开始水溶加工', at: '2026-07-11 08:15:00' },
    )
  }
  if (paused) {
    const completedQty = Math.max(1, paused.plannedQty - Math.min(100, paused.plannedQty / 10))
    const reason = '现场实测原料不足，等待主管确认'
    paused.factoryId = factory.id
    paused.factoryName = factory.name
    paused.completedQty = completedQty
    paused.exceptionReason = reason
    paused.status = 'PRODUCTION_PAUSED'
    paused.updatedAt = '2026-07-11 08:35:00'
    paused.actionLogs.push(
      { action: '分配染厂', detail: `已分配至 ${factory.name}`, at: '2026-07-11 08:20:00' },
      { action: '确认原料到位', detail: '原料已到位，可以开始水溶', at: '2026-07-11 08:25:00' },
      { action: '开始水溶', detail: '工厂已开始水溶加工', at: '2026-07-11 08:30:00' },
      { action: '上报数量不足', detail: `实际完成 ${completedQty} ${paused.qtyUnit}；原因：${reason}`, at: '2026-07-11 08:35:00' },
    )
  }
}

function buildWaterSolubleOrderStore(seedDemo: boolean): Map<string, WaterSolubleWorkOrder> {
  const store = new Map<string, WaterSolubleWorkOrder>()
  buildOrdersFromCurrentArtifacts()
    .forEach((order) => {
      store.set(order.generationKey, order)
    })
  if (seedDemo) seedWaterSolubleDemoOrders(store)
  return store
}

export function syncWaterSolubleOrderStoreWithArtifacts(): void {
  if (!orderStore) {
    orderStore = buildWaterSolubleOrderStore(true)
    return
  }
  const current = orderStore ?? new Map<string, WaterSolubleWorkOrder>()
  const next = new Map<string, WaterSolubleWorkOrder>()
  const currentByBusinessIdentity = new Map<string, WaterSolubleWorkOrder>()
  current.forEach((order) => {
    const identity = buildWaterSolubleGenerationKey(order.productionOrderId, order.bomItemId)
    if (currentByBusinessIdentity.has(identity)) {
      throw new Error(`水溶加工单业务身份冲突：${identity}，请检查历史加工单`)
    }
    currentByBusinessIdentity.set(identity, order)
  })
  buildOrdersFromCurrentArtifacts()
    .forEach((generated) => {
      const existing = current.get(generated.generationKey)
        ?? currentByBusinessIdentity.get(generated.generationKey)
      if (!existing) {
        next.set(generated.generationKey, generated)
        return
      }
      if (canRefreshSourceFields(existing)) {
        next.set(generated.generationKey, {
          ...existing,
          generationKey: generated.generationKey,
          sourceArtifactId: generated.sourceArtifactId,
          productionOrderId: generated.productionOrderId,
          productionOrderNo: generated.productionOrderNo,
          techPackVersionId: generated.techPackVersionId,
          bomItemId: generated.bomItemId,
          materialCode: generated.materialCode,
          materialName: generated.materialName,
          materialSpec: generated.materialSpec,
          plannedQty: generated.plannedQty,
          qtyUnit: generated.qtyUnit,
        })
        return
      }
      next.set(generated.generationKey, {
        ...existing,
        generationKey: generated.generationKey,
      })
    })
  orderStore = next
}

function ensureStore(): Map<string, WaterSolubleWorkOrder> {
  syncWaterSolubleOrderStoreWithArtifacts()
  return orderStore!
}

function findMutableOrder(orderId: string): WaterSolubleWorkOrder | undefined {
  return [...ensureStore().values()].find((item) => item.waterOrderId === orderId)
}

function failure(message: string): WaterSolubleActionResult {
  return { ok: false, message }
}

function updateOrder(order: WaterSolubleWorkOrder, action: string, detail: string): WaterSolubleActionResult {
  const updatedAt = new Date().toISOString().slice(0, 19).replace('T', ' ')
  order.updatedAt = updatedAt
  order.actionLogs.push({ action, detail, at: updatedAt })
  return { ok: true, message: `${action}成功`, order: cloneOrder(order) }
}

function requireStatus(order: WaterSolubleWorkOrder, expected: WaterSolubleWorkOrderStatus, action: string): WaterSolubleActionResult | null {
  if (order.status === expected) return null
  return failure(`当前状态为“${WATER_SOLUBLE_STATUS_LABEL[order.status]}”，不能${action}。`)
}

function validatePositiveQty(value: number, fieldName: string): string | null {
  if (!Number.isFinite(value)) return `${fieldName}必须是有限数字。`
  if (value <= 0) return `${fieldName}必须大于 0。`
  return null
}

function validateNonNegativeQty(value: number, fieldName: string): string | null {
  if (!Number.isFinite(value)) return `${fieldName}必须是有限数字。`
  if (value < 0) return `${fieldName}必须大于或等于 0。`
  return null
}

export function mapWaterSolubleQtyUnit(qtyUnit: string): QtyUnit {
  const normalized = qtyUnit.trim().toLowerCase()
  if (['米', 'm', 'meter', '码', 'yard'].includes(normalized)) return 'METER'
  if (['件', '片'].includes(normalized)) return 'PIECE'
  return 'BUNDLE'
}

export function getWaterSolubleHandoverQtyUnit(qtyUnit: string): string {
  const unit = qtyUnit.trim()
  if (!unit) throw new Error('水溶交接缺少 BOM 物料单位。')
  return unit
}

export function listWaterSolubleWorkOrders(): WaterSolubleWorkOrder[] {
  return [...ensureStore().values()]
    .sort((left, right) => left.generationKey.localeCompare(right.generationKey))
    .map(cloneOrder)
}

export function getWaterSolubleWorkOrderById(orderId: string): WaterSolubleWorkOrder | null {
  const order = findMutableOrder(orderId)
  return order ? cloneOrder(order) : null
}

export function getWaterSolubleWorkOrderByTaskId(taskId: string): WaterSolubleWorkOrder | null {
  const order = [...ensureStore().values()].find((item) => item.taskId === taskId)
  return order ? cloneOrder(order) : null
}

export function listWaterSolubleMobileTasks(): WaterSolubleMobileTask[] {
  return listWaterSolubleWorkOrders().map((order, index) => ({
    taskId: order.taskId,
    taskNo: order.taskNo,
    productionOrderId: order.productionOrderId,
    seq: index + 1,
    processCode: 'PROC_WATER_SOLUBLE',
    processNameZh: '水溶',
    stage: 'PREP',
    qty: order.plannedQty,
    qtyUnit: mapWaterSolubleQtyUnit(order.qtyUnit),
    qtyDisplayUnit: order.qtyUnit,
    assignmentMode: 'DIRECT',
    assignmentStatus: order.factoryId ? 'ASSIGNED' : 'UNASSIGNED',
    ownerSuggestion: { kind: 'RECOMMENDED_FACTORY_POOL', recommendedTypes: ['DYEING_FACTORY'] },
    assignedFactoryId: order.factoryId,
    assignedFactoryName: order.factoryName,
    qcPoints: [],
    attachments: [],
    status: order.status === 'DONE' ? 'DONE' : order.status === 'WATER_SOLUBLE_IN_PROGRESS' ? 'IN_PROGRESS' : order.status === 'PRODUCTION_PAUSED' ? 'BLOCKED' : 'NOT_STARTED',
    acceptanceStatus: order.factoryId ? 'ACCEPTED' : 'PENDING',
    acceptedAt: order.factoryId ? order.updatedAt : undefined,
    acceptedBy: order.factoryId ? order.factoryName : undefined,
    taskQrValue: order.taskQrValue,
    taskQrStatus: 'ACTIVE',
    sourceEntryType: 'CRAFT',
    stageCode: 'PREP',
    stageName: '准备阶段',
    processBusinessCode: 'WATER_SOLUBLE',
    processBusinessName: '水溶',
    defaultDocType: 'TASK',
    taskTypeMode: 'PROCESS',
    isSpecialCraft: false,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    auditLogs: [],
    waterOrderId: order.waterOrderId,
    sourceArtifactId: order.sourceArtifactId,
    bomItemId: order.bomItemId,
    materialCode: order.materialCode,
    materialName: order.materialName,
    sourceQtyUnit: order.qtyUnit,
  }))
}

export function getWaterSolubleCurrentAction(orderOrId: string | WaterSolubleWorkOrder): WaterSolubleCurrentAction | null {
  const order = typeof orderOrId === 'string' ? findMutableOrder(orderOrId) : findMutableOrder(orderOrId.waterOrderId)
  if (!order) return null
  const actions: Record<WaterSolubleWorkOrderStatus, WaterSolubleCurrentAction> = {
    WAIT_FACTORY_ASSIGNMENT: { actionCode: 'ASSIGN_FACTORY', actionName: '分配染厂', message: '请分配具备水溶能力的染厂。' },
    WAIT_MATERIAL: { actionCode: 'WAIT_MATERIAL', actionName: '确认原料到位', message: '原料到位后确认。' },
    WAIT_WATER_SOLUBLE: { actionCode: 'START', actionName: '开始水溶', message: '原料已到位，可以开始水溶。' },
    WATER_SOLUBLE_IN_PROGRESS: { actionCode: 'COMPLETE', actionName: '完成水溶', message: '请输入本次实际完成数量。' },
    PRODUCTION_PAUSED: { actionCode: 'SUPERVISOR', actionName: '处理数量不足', message: '数量不足，请主管选择处理方式。' },
    WAIT_HANDOVER: { actionCode: 'HANDOVER', actionName: '去交出', message: '请前往交接页面完成交出。' },
    HANDOVER_WAIT_RECEIVE: { actionCode: 'WAIT_RECEIPT', actionName: '等待收货', message: '已交出，等待对方确认收货。' },
    RECEIPT_DIFFERENCE: { actionCode: 'RESOLVE_DIFFERENCE', actionName: '确认收货差异', message: '收货数量不一致，请主管确认。' },
    DONE: { actionCode: 'DONE', actionName: '已完成', message: '本单已完成。' },
  }
  return { ...actions[order.status] }
}

export type WaterSolublePdaActionInput =
  | { action: 'MATERIAL_READY'; orderId: string; taskId: string; expectedStatus: 'WAIT_MATERIAL'; expectedNode: 'WAIT_MATERIAL'; actor: WaterSolublePdaActor }
  | { action: 'START'; orderId: string; taskId: string; expectedStatus: 'WAIT_WATER_SOLUBLE'; expectedNode: 'START'; actor: WaterSolublePdaActor }
  | { action: 'COMPLETE'; orderId: string; taskId: string; expectedStatus: 'WATER_SOLUBLE_IN_PROGRESS'; expectedNode: 'COMPLETE'; completedQty: number; reason: string; actor: WaterSolublePdaActor }
  | { action: 'RESOLVE_PAUSE'; orderId: string; taskId: string; expectedStatus: 'PRODUCTION_PAUSED'; expectedNode: 'SUPERVISOR'; decision: WaterSolubleSupervisorDecision; actor: WaterSolublePdaActor }
  | { action: 'HANDOVER'; orderId: string; taskId: string; expectedStatus: 'WAIT_HANDOVER'; expectedNode: 'HANDOVER'; handoverQty: number; actor: WaterSolublePdaActor }

function attachWaterSolublePdaActor(result: WaterSolubleActionResult, actor: WaterSolublePdaActor): WaterSolubleActionResult {
  if (!result.ok) return result
  const order = result.order ? findMutableOrder(result.order.waterOrderId) : undefined
  const lastLog = order?.actionLogs.at(-1)
  if (!order || !lastLog) return result
  lastLog.operatorName = actor.userName
  lastLog.detail = `${lastLog.detail}；操作人：${actor.userName}`
  return { ...result, order: cloneOrder(order) }
}

export function executeWaterSolublePdaAction(input: WaterSolublePdaActionInput): WaterSolubleActionResult {
  const order = findMutableOrder(input.orderId)
  if (!order) return failure(`未找到水溶加工单“${input.orderId}”。`)
  if (order.taskId !== input.taskId) return failure('当前任务与水溶加工单不一致，不能操作。')
  if (order.status !== input.expectedStatus) {
    return failure(`当前状态为“${WATER_SOLUBLE_STATUS_LABEL[order.status]}”，此操作已经处理或已失效。`)
  }
  const currentAction = getWaterSolubleCurrentAction(order)
  if (!currentAction || currentAction.actionCode !== input.expectedNode) {
    return failure(`当前动作与“${input.expectedNode}”不一致，不能操作。`)
  }
  const roleAction = input.action === 'RESOLVE_PAUSE' ? 'SUPERVISE' : input.action === 'HANDOVER' ? 'HANDOVER' : 'OPERATE'
  const actorError = validateWaterSolublePdaActor(input.actor, order.factoryId, roleAction)
  if (actorError) return failure(actorError)
  if (input.action === 'MATERIAL_READY') return attachWaterSolublePdaActor(markWaterSolubleMaterialReady(input.orderId), input.actor)
  if (input.action === 'START') return attachWaterSolublePdaActor(startWaterSoluble(input.orderId), input.actor)
  if (input.action === 'COMPLETE') return attachWaterSolublePdaActor(completeWaterSoluble(input.orderId, input.completedQty, input.reason), input.actor)
  if (input.action === 'RESOLVE_PAUSE') return attachWaterSolublePdaActor(resolveWaterSolublePause(input.orderId, input.decision), input.actor)
  return failure('请通过通用交接单完成交出，当前页面不能直接确认交出。')
}

export function canAssignWaterSolubleFactory(factoryId: string): WaterSolubleFactoryCapabilityResult {
  const factory = getFactoryMasterRecordById(factoryId)
  if (!factory) return { ok: false, message: `未找到工厂“${factoryId}”。` }
  if (factory.status !== 'active') return { ok: false, message: `工厂“${factory.name}”当前不是启用状态，不能分配水溶加工单。` }
  if (!factory.eligibility.allowDispatch) return { ok: false, message: `工厂“${factory.name}”当前禁止派单，不能分配水溶加工单。` }
  const hasFormalAbilities = factory.processAbilities.length > 0
  const hasCapability = hasFormalAbilities
    ? factory.processAbilities.some((ability) =>
        ability.processCode === 'WATER_SOLUBLE'
          && (ability.status ?? 'ACTIVE') === 'ACTIVE'
          && ability.canReceiveTask !== false,
      )
    : Boolean(factory.selectedCapabilities?.some((ability) =>
        ability.processCode === 'WATER_SOLUBLE' && ability.canReceiveTask !== false,
      ))
  if (!hasCapability) return { ok: false, message: `工厂“${factory.name}”没有水溶能力，不能分配此加工单。` }
  return { ok: true, message: `工厂“${factory.name}”具备水溶能力。` }
}

export function assignWaterSolubleFactory(orderId: string, factoryId: string): WaterSolubleActionResult {
  const order = findMutableOrder(orderId)
  if (!order) return failure(`未找到水溶加工单“${orderId}”。`)
  const statusError = requireStatus(order, 'WAIT_FACTORY_ASSIGNMENT', '分配染厂')
  if (statusError) return statusError
  const capability = canAssignWaterSolubleFactory(factoryId)
  if (!capability.ok) return failure(capability.message)
  const factory = getFactoryMasterRecordById(factoryId)!
  order.factoryId = factory.id
  order.factoryName = factory.name
  order.status = 'WAIT_MATERIAL'
  return updateOrder(order, '分配染厂', `已分配至 ${factory.name}`)
}

export function markWaterSolubleMaterialReady(orderId: string): WaterSolubleActionResult {
  const order = findMutableOrder(orderId)
  if (!order) return failure(`未找到水溶加工单“${orderId}”。`)
  const statusError = requireStatus(order, 'WAIT_MATERIAL', '确认原料到位')
  if (statusError) return statusError
  order.status = 'WAIT_WATER_SOLUBLE'
  return updateOrder(order, '确认原料到位', '原料已到位，可以开始水溶')
}

export function startWaterSoluble(orderId: string): WaterSolubleActionResult {
  const order = findMutableOrder(orderId)
  if (!order) return failure(`未找到水溶加工单“${orderId}”。`)
  const statusError = requireStatus(order, 'WAIT_WATER_SOLUBLE', '开始水溶')
  if (statusError) return statusError
  order.status = 'WATER_SOLUBLE_IN_PROGRESS'
  return updateOrder(order, '开始水溶', '工厂已开始水溶加工')
}

export function completeWaterSoluble(orderId: string, completedQty: number, exceptionReason?: string): WaterSolubleActionResult {
  const order = findMutableOrder(orderId)
  if (!order) return failure(`未找到水溶加工单“${orderId}”。`)
  const statusError = requireStatus(order, 'WATER_SOLUBLE_IN_PROGRESS', '上报完成数量')
  if (statusError) return statusError
  const qtyError = validateNonNegativeQty(completedQty, '完成数量')
  if (qtyError) return failure(qtyError)
  if (completedQty + 0.000001 < order.completedQty) {
    return failure(`累计完成数量不能少于已有完成数量 ${order.completedQty} ${order.qtyUnit}。`)
  }
  const reason = exceptionReason?.trim()
  if (completedQty !== order.plannedQty && !reason) {
    return failure(completedQty < order.plannedQty
      ? `完成数量少于计划数量 ${order.plannedQty} ${order.qtyUnit}，请填写原因并交主管处理。`
      : `完成数量超过计划数量 ${order.plannedQty} ${order.qtyUnit}，请填写原因后再确认。`)
  }
  order.completedQty = completedQty
  order.exceptionReason = reason
  if (completedQty < order.plannedQty) {
    order.status = 'PRODUCTION_PAUSED'
    return updateOrder(order, '上报数量不足', `实际完成 ${completedQty} ${order.qtyUnit}；原因：${reason}；等待主管处理`)
  }
  order.handoverQty = completedQty
  order.status = 'WAIT_HANDOVER'
  return updateOrder(order, '完成水溶', `实际完成 ${completedQty} ${order.qtyUnit}${reason ? `；原因：${reason}` : ''}；等待交出`)
}

export function resolveWaterSolublePause(orderId: string, decision: WaterSolubleSupervisorDecision): WaterSolubleActionResult {
  const order = findMutableOrder(orderId)
  if (!order) return failure(`未找到水溶加工单“${orderId}”。`)
  const statusError = requireStatus(order, 'PRODUCTION_PAUSED', '处理生产暂停')
  if (statusError) return statusError
  if (!['CONTINUE_PROCESSING', 'CONTINUE_WITH_ACTUAL_QTY', 'RETURN_FOR_REWORK'].includes(decision)) {
    return failure('请选择有效的主管处理方式。')
  }
  order.supervisorDecision = decision
  if (decision === 'CONTINUE_WITH_ACTUAL_QTY') {
    if (order.completedQty <= 0) return failure('当前没有可交出的完成数量。')
    order.handoverQty = order.completedQty
    order.status = 'WAIT_HANDOVER'
    return updateOrder(order, '主管确认按实际数量继续', `可交出 ${order.completedQty} ${order.qtyUnit}`)
  }
  order.status = 'WAIT_WATER_SOLUBLE'
  order.handoverQty = undefined
  if (decision === 'RETURN_FOR_REWORK') {
    order.completedQty = 0
    order.exceptionReason = undefined
    return updateOrder(order, '主管退回返工', '已清理本次完成数量，等待重新水溶')
  }
  return updateOrder(order, '主管要求继续加工', '保留已完成数量，等待继续水溶')
}

export function submitWaterSolubleHandover(orderId: string, handoverQty: number): WaterSolubleActionResult {
  const order = findMutableOrder(orderId)
  if (!order) return failure(`未找到水溶加工单“${orderId}”。`)
  const statusError = requireStatus(order, 'WAIT_HANDOVER', '确认交出')
  if (statusError) return statusError
  const qtyError = validatePositiveQty(handoverQty, '交出数量')
  if (qtyError) return failure(qtyError)
  if (order.handoverQty === undefined || Math.abs(handoverQty - order.handoverQty) > 0.000001) {
    return failure(`本期不支持部分交出，请按批准数量 ${order.handoverQty ?? 0} ${order.qtyUnit} 交出。`)
  }
  order.handoverQty = handoverQty
  order.status = 'HANDOVER_WAIT_RECEIVE'
  return updateOrder(order, '确认交出', `已交出 ${handoverQty} ${order.qtyUnit}，等待收货`)
}

export function linkWaterSolubleHandoverOrder(
  orderId: string,
  taskId: string,
  handoverOrderId: string,
): WaterSolubleActionResult {
  const order = findMutableOrder(orderId)
  if (!order) return failure(`未找到水溶加工单“${orderId}”。`)
  if (order.taskId !== taskId) return failure('当前任务与水溶加工单不一致，不能关联交出单。')
  const normalizedHandoverOrderId = handoverOrderId.trim()
  if (!normalizedHandoverOrderId) return failure('交出单 ID 不能为空。')
  if (order.handoverOrderId === normalizedHandoverOrderId) {
    return { ok: true, message: '交出单已关联', order: cloneOrder(order) }
  }
  if (order.handoverOrderId) {
    return failure(`水溶加工单已关联交出单“${order.handoverOrderId}”，不能改绑。`)
  }
  const statusError = requireStatus(order, 'WAIT_HANDOVER', '关联交出单')
  if (statusError) return statusError
  order.handoverOrderId = normalizedHandoverOrderId
  return updateOrder(order, '关联交出单', `已关联通用交出单 ${normalizedHandoverOrderId}`)
}

export function writeBackWaterSolubleReceipt(orderId: string, receivedQty: number): WaterSolubleActionResult {
  const order = findMutableOrder(orderId)
  if (!order) return failure(`未找到水溶加工单“${orderId}”。`)
  const statusError = requireStatus(order, 'HANDOVER_WAIT_RECEIVE', '确认收货')
  if (statusError) return statusError
  const qtyError = validateNonNegativeQty(receivedQty, '收货数量')
  if (qtyError) return failure(qtyError)
  order.receivedQty = receivedQty
  order.status = receivedQty === order.handoverQty ? 'DONE' : 'RECEIPT_DIFFERENCE'
  return updateOrder(
    order,
    receivedQty === order.handoverQty ? '确认收货' : '上报收货差异',
    receivedQty === order.handoverQty
      ? `已收货 ${receivedQty} ${order.qtyUnit}，数量一致`
      : `交出 ${order.handoverQty} ${order.qtyUnit}，实际收货 ${receivedQty} ${order.qtyUnit}`,
  )
}

export function resolveWaterSolubleReceiptDifference(orderId: string): WaterSolubleActionResult {
  const order = findMutableOrder(orderId)
  if (!order) return failure(`未找到水溶加工单“${orderId}”。`)
  const statusError = requireStatus(order, 'RECEIPT_DIFFERENCE', '确认收货差异')
  if (statusError) return statusError
  order.status = 'DONE'
  return updateOrder(order, '确认收货差异', `主管已确认按实际收货 ${order.receivedQty ?? 0} ${order.qtyUnit} 完成`)
}

export function resetWaterSolubleDomainForChecks(options: { seedDemo?: boolean } = {}): void {
  orderStore = buildWaterSolubleOrderStore(options.seedDemo === true)
}
