import {getPdaSession} from './store-domain-pda.ts'
import {getDyeFactoryReceiptProjection} from './factory-receiving-warehouse.ts'
import {listFactoryReceivingSources,getSourceActualReceipts,recordFactoryMaterialUsage,captureFactoryReceivingData,restoreFactoryReceivingData,listFactoryMaterialUses,convertReceiptQuantity} from './factory-receiving.ts'
import { localDateTimeText } from '../../utils.ts'
import { getFactoryMasterRecordById } from './factory-master-store.ts'
import {
  listGeneratedProductionPreparationOrderArtifacts,
  type GeneratedPreparationOrderArtifact,
} from './production-artifact-generation.ts'
import { productionOrders, initialProductionOrderIds } from './production-orders.ts'
import type { ProcessTask, QtyUnit } from './process-tasks.ts'
import { buildTaskQrValue } from './task-qr.ts'
import { resolveTerminalProcessOrderReceivingTarget } from './process-order-receiving-target.ts'
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
  | 'WAIT_MANUAL_COMPLETION'
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
  WAIT_MANUAL_COMPLETION: '待人工完成单据',
  DONE: '已完成',
}

export interface WaterSolubleActionLog {
  action: string
  detail: string
  at: string
  operatorName?: string
}

export interface WaterSolubleHandoverBatch {
  batchId: string
  handoverQty: number
  receivedQty?: number
  receiptDifferenceAccepted?: boolean
}

export interface WaterSolubleWorkOrder {
  waterOrderId: string
  waterOrderNo: string
  generationKey: string
  sourceArtifactId: string
  sourceDemandIds: string[]
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
  inputQty?: number
  materialReceipts?: Array<{ receiptId: string; upstreamRecordId?: string; qty: number; receiverName: string; receivedAt: string }>
  handoverQty?: number
  receivedQty?: number
  handoverBatches?: WaterSolubleHandoverBatch[]
  qtyUnit: string
  factoryId?: string
  factoryName?: string
  acceptanceStatus?: 'PENDING' | 'ACCEPTED' | 'REJECTED'
  acceptedAt?: string
  acceptedBy?: string
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
  actionCode: 'ASSIGN_FACTORY' | 'WAIT_MATERIAL' | 'START' | 'COMPLETE' | 'SUPERVISOR' | 'HANDOVER' | 'WAIT_RECEIPT' | 'RESOLVE_DIFFERENCE' | 'FINISH_DOCUMENT' | 'DONE'
  actionName: string
  message: string
}

const INITIAL_TIME = '2026-07-11 08:00:00'
const DEMO_FACTORY_ID = 'F090'
let orderStore: Map<string, WaterSolubleWorkOrder> | null = null

export function getWaterSolubleReceivingMaterial(orderId:string):import('./factory-receiving-types.ts').ReceivingMaterial {
 const o=getWaterSolubleWorkOrderById(orderId)
 if(!o)throw new Error('未找到水溶加工单。')
 if(!/水溶|花边/.test(o.materialName))throw new Error('请先维护水溶原料的图片、成分和规格。')
 return {sku:o.materialCode,name:o.materialName,kind:'ACCESSORY',imageUrl:'/materials/process-orders/white-water-soluble-lace-12-15mm.jpg',color:'本白',composition:'100% 涤纶',specification:o.materialSpec||'15 mm 水溶花边',batchNo:`${o.waterOrderNo}-01`}
}

function cloneOrder(order: WaterSolubleWorkOrder): WaterSolubleWorkOrder {
  return {
    ...order,
    sourceDemandIds: [...order.sourceDemandIds],
    materialReceipts: order.materialReceipts?.map((item) => ({ ...item })),
    handoverBatches: order.handoverBatches?.map((batch) => ({ ...batch })),
    actionLogs: order.actionLogs.map((item) => ({ ...item })),
  }
}


const WATER_EXECUTION_STORAGE_KEY = 'higoods.formal-water-execution.v1'
let waterMutationDepth = 0

function restoreFormalWaterExecution(generated: Map<string, WaterSolubleWorkOrder>): void {
  const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(WATER_EXECUTION_STORAGE_KEY)
  if (!raw) return
  try {
    const saved = JSON.parse(raw)
    if (saved?.version !== 1 || !Array.isArray(saved.orders)) throw new Error('格式无效')
    const seen = new Set<string>()
    for (const order of saved.orders as WaterSolubleWorkOrder[]) {
      const source = generated.get(order?.generationKey)
      if (!source || seen.has(order.waterOrderId)
        || ['waterOrderId', 'taskId', 'sourceArtifactId', 'productionOrderId', 'techPackVersionId', 'bomItemId', 'materialCode', 'qtyUnit', 'plannedQty'].some(key => (order as unknown as Record<string, unknown>)[key] !== (source as unknown as Record<string, unknown>)[key])
        || !Object.hasOwn(WATER_SOLUBLE_STATUS_LABEL, order.status)
        || !Number.isFinite(order.completedQty) || order.completedQty < 0
        || !Array.isArray(order.sourceDemandIds) || JSON.stringify(order.sourceDemandIds) !== JSON.stringify(source.sourceDemandIds)
        || !Array.isArray(order.actionLogs) || !order.actionLogs.length || order.actionLogs.some(log => !log.action || !log.at || typeof log.detail !== 'string')
        || (order.materialReceipts !== undefined && (!Array.isArray(order.materialReceipts) || order.materialReceipts.some(row => !row.receiptId || !row.receiverName || !row.receivedAt || !Number.isFinite(row.qty) || row.qty < 0)))
        || (order.handoverBatches !== undefined && (!Array.isArray(order.handoverBatches) || order.handoverBatches.some(row => !row.batchId || !Number.isFinite(row.handoverQty) || row.handoverQty <= 0 || (row.receivedQty !== undefined && (!Number.isFinite(row.receivedQty) || row.receivedQty < 0)))))) throw new Error('原水溶单身份或记录无效')
      seen.add(order.waterOrderId)
    }
    for (const order of saved.orders as WaterSolubleWorkOrder[]) generated.set(order.generationKey, cloneOrder(order))
  } catch (error) {
    throw new Error('本机水溶加工记录损坏或与冻结来源不一致，未覆盖原记录，请联系负责人。' + (error instanceof Error ? error.message : String(error)))
  }
}

function persistFormalWaterExecution(): void {
  if (typeof localStorage === 'undefined') return
  const orders = [...(orderStore?.values() ?? [])].filter(order => order.actionLogs.length > 1)
  localStorage.setItem(WATER_EXECUTION_STORAGE_KEY, JSON.stringify({ version: 1, orders }))
}

export function captureWaterSolubleOrderMutation(order: WaterSolubleWorkOrder): { order: WaterSolubleWorkOrder; persistedRaw: string | null } {
  return { order: cloneOrder(order), persistedRaw: typeof localStorage === 'undefined' ? null : localStorage.getItem(WATER_EXECUTION_STORAGE_KEY) }
}

function restoreWaterExecutionBytes(raw: string | null): void {
  if (typeof localStorage === 'undefined' || localStorage.getItem(WATER_EXECUTION_STORAGE_KEY) === raw) return
  if (raw === null) localStorage.removeItem(WATER_EXECUTION_STORAGE_KEY)
  else localStorage.setItem(WATER_EXECUTION_STORAGE_KEY, raw)
}

function runWaterSolubleMutation(action: () => WaterSolubleActionResult): WaterSolubleActionResult {
  if (waterMutationDepth) return action()
  const before = new Map([...ensureStore()].map(([key, value]) => [key, cloneOrder(value)]))
  const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(WATER_EXECUTION_STORAGE_KEY)
  const receiving=captureFactoryReceivingData()
  waterMutationDepth++
  try {
    const result = action()
    if (!result.ok) { orderStore = before; restoreFactoryReceivingData(receiving); return result }
    persistFormalWaterExecution()
    return result
  } catch (error) {
    orderStore = before
    restoreFactoryReceivingData(receiving)
    restoreWaterExecutionBytes(raw)
    return failure('水溶操作未保存，原动作已撤回，请检查本机存储后重试。' + (error instanceof Error ? error.message : String(error)))
  } finally { waterMutationDepth-- }
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

type MaterialWaterSolublePreparationArtifact = GeneratedPreparationOrderArtifact & Required<Pick<GeneratedPreparationOrderArtifact,
  'bomItemId' | 'materialCode' | 'materialName' | 'plannedQty' | 'plannedUnit' | 'linkedBomItemIds'
>>

function isMaterialWaterSolublePreparationArtifact(artifact: GeneratedPreparationOrderArtifact): artifact is MaterialWaterSolublePreparationArtifact {
  return artifact.processCode === 'WATER_SOLUBLE'
    && artifact.artifactType === 'PREPARATION_ORDER'
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

function buildOrderFromArtifact(artifact: MaterialWaterSolublePreparationArtifact, materialSequence: number): WaterSolubleWorkOrder {
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
    sourceDemandIds: [...(productionOrder?.sourceDemandIds ?? [])],
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
    actionLogs: [{ action: '生成水溶加工单', operatorName:'系统自动生成', detail: `由物料级产物 ${artifact.artifactId} 生成`, at: INITIAL_TIME }],
  }
}

function buildOrdersFromCurrentArtifacts(): WaterSolubleWorkOrder[] {
  const artifacts = listGeneratedProductionPreparationOrderArtifacts()
    .filter(isMaterialWaterSolublePreparationArtifact)
  const materialSequenceByGenerationKey = new Map<string, number>()
  const artifactsByProductionOrder = new Map<string, MaterialWaterSolublePreparationArtifact[]>()
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
  const orders = [...store.values()].filter(order => initialProductionOrderIds.has(order.productionOrderId)).sort((left, right) => left.generationKey.localeCompare(right.generationKey))
  const inProgress = orders[1]
  const paused = orders[2]
  if (inProgress) {
    inProgress.factoryId = factory.id
    inProgress.factoryName = factory.name
    inProgress.status = 'WATER_SOLUBLE_IN_PROGRESS'
    inProgress.materialReceipts = [{ receiptId: 'DEMO-MATERIAL-RECEIPT-087', upstreamRecordId: 'ISSUE-WATER-PO-202603-087-L001', qty: inProgress.plannedQty, receiverName: factory.name, receivedAt: '2026-07-11 08:10:00' }]
    inProgress.updatedAt = '2026-07-11 08:15:00'
    inProgress.actionLogs.push(
      { action: '分配染厂', operatorName:'计划员 Lilis', detail: `已分配至 ${factory.name}`, at: '2026-07-11 08:05:00' },
      { action: '确认本次接收', operatorName:'仓管 Budi', detail: '已按中央仓调拨单确认接收，可以开始水溶', at: '2026-07-11 08:10:00' },
      { action: '开始水溶', operatorName:'水溶操作员 Sari', detail: '工厂已开始水溶加工', at: '2026-07-11 08:15:00' },
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
    paused.materialReceipts = [{ receiptId: 'DEMO-MATERIAL-RECEIPT-088', upstreamRecordId: 'ISSUE-WATER-PO-202603-088-L001', qty: paused.plannedQty, receiverName: factory.name, receivedAt: '2026-07-11 08:25:00' }]
    paused.updatedAt = '2026-07-11 08:35:00'
    paused.actionLogs.push(
      { action: '分配染厂', operatorName:'计划员 Lilis', detail: `已分配至 ${factory.name}`, at: '2026-07-11 08:20:00' },
      { action: '确认本次接收', operatorName:'仓管 Budi', detail: '已按中央仓调拨单确认接收，可以开始水溶', at: '2026-07-11 08:25:00' },
      { action: '开始水溶', operatorName:'水溶操作员 Sari', detail: '工厂已开始水溶加工', at: '2026-07-11 08:30:00' },
      { action: '上报数量不足', operatorName:'水溶操作员 Sari', detail: `实际完成 ${completedQty} ${paused.qtyUnit}；原因：${reason}`, at: '2026-07-11 08:35:00' },
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
    const generated = buildWaterSolubleOrderStore(true)
    restoreFormalWaterExecution(generated)
    orderStore = generated
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
  for(const order of orderStore!.values()){
    const receipts=getDyeFactoryReceiptProjection(order.waterOrderId,order.qtyUnit,'water')
    const legacy=(order.materialReceipts??[]).filter(r=>!r.receiptId.startsWith('FRP-'))
    if(order.inputQty===undefined&&!['WAIT_MATERIAL','WAIT_WATER_SOLUBLE'].includes(order.status))order.inputQty=legacy.reduce((n,r)=>n+r.qty,0)
    order.materialReceipts=[...legacy,...receipts]
    if(order.status==='WAIT_MATERIAL'&&order.materialReceipts.some(r=>r.qty>0))order.status='WAIT_WATER_SOLUBLE'
    for(const source of listFactoryReceivingSources(undefined,true).filter(s=>s.workOrderNo===order.waterOrderNo&&s.waterBatchId)){const batch=order.handoverBatches?.find(b=>b.batchId===source.waterBatchId),actual=getSourceActualReceipts(source.id);if(batch&&actual.length){batch.receivedQty=actual.reduce((n,r)=>n+(convertReceiptQuantity(r.qty,r.unit,order.qtyUnit)??(r.businessUnit===order.qtyUnit?r.businessQty??0:0)),0);order.receivedQty=(order.handoverBatches??[]).reduce((n,b)=>n+(b.receivedQty??0),0)}}
  }
  return orderStore!
}

function findMutableOrder(orderId: string): WaterSolubleWorkOrder | undefined {
  return [...ensureStore().values()].find((item) => item.waterOrderId === orderId)
}

function failure(message: string): WaterSolubleActionResult {
  return { ok: false, message }
}

function updateOrder(order: WaterSolubleWorkOrder, action: string, detail: string, operatorName=getPdaSession()?.userName||'原型操作员'): WaterSolubleActionResult {
  const updatedAt = localDateTimeText()
  order.updatedAt = updatedAt
  order.actionLogs.push({ action, detail, at: updatedAt, operatorName })
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

function ensureWaterSolubleAcceptanceFact(order: WaterSolubleWorkOrder): void {
  if (order.acceptanceStatus) return
  if (!order.factoryId) {
    order.acceptanceStatus = 'PENDING'
    return
  }
  const hasHistoricalExecution = order.status !== 'WAIT_MATERIAL'
  order.acceptanceStatus = hasHistoricalExecution ? 'ACCEPTED' : 'PENDING'
  order.acceptedAt = hasHistoricalExecution ? order.createdAt : undefined
  order.acceptedBy = hasHistoricalExecution ? order.factoryName : undefined
}

export function listWaterSolubleWorkOrders(): WaterSolubleWorkOrder[] {
  return [...ensureStore().values()]
    .map((order) => {
      ensureWaterSolubleAcceptanceFact(order)
      return order
    })
    .sort((left, right) => left.generationKey.localeCompare(right.generationKey))
    .map(cloneOrder)
}

export function getWaterSolubleWorkOrderById(orderId: string): WaterSolubleWorkOrder | null {
  const order = findMutableOrder(orderId)
  if (order) ensureWaterSolubleAcceptanceFact(order)
  return order ? cloneOrder(order) : null
}

// 原交接事务保存失败时，仅撤回本次已存在水溶单的原事实。
export function restoreWaterSolubleOrderMutation(snapshot: WaterSolubleWorkOrder, persistedRaw?: string | null): void {
  const current = orderStore?.get(snapshot.generationKey)
  if (!current || current.waterOrderId !== snapshot.waterOrderId || current.taskId !== snapshot.taskId || current.productionOrderId !== snapshot.productionOrderId) throw new Error('水溶原单身份已变化，不能撤回到其他单据。')
  orderStore!.set(snapshot.generationKey, cloneOrder(snapshot))
  if (persistedRaw !== undefined) restoreWaterExecutionBytes(persistedRaw)
}

export function getWaterSolubleWorkOrderByTaskId(taskId: string): WaterSolubleWorkOrder | null {
  const order = [...ensureStore().values()].find((item) => item.taskId === taskId)
  if (order) ensureWaterSolubleAcceptanceFact(order)
  return order ? cloneOrder(order) : null
}

export function listWaterSolubleMobileTasks(): WaterSolubleMobileTask[] {
  return listWaterSolubleWorkOrders().map((order, index) => {
    const receivingTarget = resolveTerminalProcessOrderReceivingTarget({
      sourceType: 'PRODUCTION_ORDER',
      productionOrderNo: order.productionOrderNo,
    })
    return {
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
    status: order.status === 'DONE' ? 'DONE' : order.status === 'WATER_SOLUBLE_IN_PROGRESS' || order.status === 'WAIT_MANUAL_COMPLETION' ? 'IN_PROGRESS' : order.status === 'PRODUCTION_PAUSED' ? 'BLOCKED' : 'NOT_STARTED',
    acceptanceStatus: order.acceptanceStatus || 'PENDING',
    acceptedAt: order.acceptedAt,
    acceptedBy: order.acceptedBy,
    taskQrValue: order.taskQrValue,
    taskQrStatus: 'ACTIVE',
    receiverKind: 'WAREHOUSE',
    receiverId: receivingTarget.targetBusinessId,
    receiverName: receivingTarget.targetName,
    sourceEntryType: 'CRAFT',
    stageCode: 'PREP',
    stageName: '准备阶段',
    processBusinessCode: 'WATER_SOLUBLE',
    processBusinessName: '水溶',
    defaultDocType: 'PREPARATION_ORDER',
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
    }
  })
}

export function getWaterSolubleCurrentAction(orderOrId: string | WaterSolubleWorkOrder): WaterSolubleCurrentAction | null {
  const order = typeof orderOrId === 'string' ? findMutableOrder(orderOrId) : findMutableOrder(orderOrId.waterOrderId)
  if (!order) return null
  const actions: Record<WaterSolubleWorkOrderStatus, WaterSolubleCurrentAction> = {
    WAIT_FACTORY_ASSIGNMENT: { actionCode: 'ASSIGN_FACTORY', actionName: '分配染厂', message: '请分配具备水溶能力的染厂。' },
    WAIT_MATERIAL: { actionCode: 'WAIT_MATERIAL', actionName: '确认本次接收', message: '选择来源单据并填写本次实际接收数量。' },
    WAIT_WATER_SOLUBLE: { actionCode: 'START', actionName: '开始水溶', message: '原料已到位，可以开始水溶。' },
    WATER_SOLUBLE_IN_PROGRESS: { actionCode: 'COMPLETE', actionName: '完成水溶', message: '填写累计完成数量；可分批交出，剩余继续加工。' },
    PRODUCTION_PAUSED: { actionCode: 'SUPERVISOR', actionName: '处理数量不足', message: '数量不足，请主管选择处理方式。' },
    WAIT_HANDOVER: { actionCode: 'HANDOVER', actionName: '去交出', message: '请前往交接页面完成交出。' },
    HANDOVER_WAIT_RECEIVE: { actionCode: 'WAIT_RECEIPT', actionName: '等待收货', message: '已交出，等待对方确认收货。' },
    RECEIPT_DIFFERENCE: { actionCode: 'RESOLVE_DIFFERENCE', actionName: '确认收货差异', message: '收货数量不一致，请主管确认。' },
    WAIT_MANUAL_COMPLETION: { actionCode: 'FINISH_DOCUMENT', actionName: '人工完成单据', message: '全部加工产出已交接，请人工确认完成本单。' },
    DONE: { actionCode: 'DONE', actionName: '已完成', message: '本单已完成。' },
  }
  return { ...actions[order.status] }
}

export type WaterSolublePdaActionInput =
  | { action: 'RECEIVE_INPUT'; orderId: string; taskId: string; expectedStatus: 'WAIT_MATERIAL' | 'WATER_SOLUBLE_IN_PROGRESS'; expectedNode: 'WAIT_MATERIAL' | 'COMPLETE'; qty?: number; receiptId?: string; upstreamRecordId?: string; actor: WaterSolublePdaActor }
  | { action: 'START'; orderId: string; taskId: string; expectedStatus: 'WAIT_WATER_SOLUBLE' | 'WATER_SOLUBLE_IN_PROGRESS' | 'WAIT_HANDOVER'; expectedNode: 'START' | 'COMPLETE' | 'HANDOVER'; actor: WaterSolublePdaActor }
  | { action: 'COMPLETE'; orderId: string; taskId: string; expectedStatus: 'WATER_SOLUBLE_IN_PROGRESS'; expectedNode: 'COMPLETE'; completedQty: number; reason: string; actor: WaterSolublePdaActor }
  | { action: 'RESOLVE_PAUSE'; orderId: string; taskId: string; expectedStatus: 'PRODUCTION_PAUSED'; expectedNode: 'SUPERVISOR'; decision: WaterSolubleSupervisorDecision; actor: WaterSolublePdaActor }
  | { action: 'FINISH_DOCUMENT'; orderId: string; taskId: string; expectedStatus: 'WAIT_MANUAL_COMPLETION'; expectedNode: 'FINISH_DOCUMENT'; actor: WaterSolublePdaActor }
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
  return runWaterSolubleMutation(() => {
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
  if (input.action === 'RECEIVE_INPUT') return attachWaterSolublePdaActor(receiveWaterSolubleInput(input.orderId, input.qty === undefined ? undefined : { qty: input.qty, receiptId: input.receiptId || '', upstreamRecordId: input.upstreamRecordId, receiverName: input.actor.userName }), input.actor)
  if (input.action === 'START') return attachWaterSolublePdaActor(startWaterSoluble(input.orderId,input.actor.userName), input.actor)
  if (input.action === 'COMPLETE') return attachWaterSolublePdaActor(completeWaterSoluble(input.orderId, input.completedQty, input.reason), input.actor)
  if (input.action === 'RESOLVE_PAUSE') return attachWaterSolublePdaActor(resolveWaterSolublePause(input.orderId, input.decision), input.actor)
  if (input.action === 'FINISH_DOCUMENT') return attachWaterSolublePdaActor(completeWaterSolubleWorkOrder(input.orderId), input.actor)
  return failure('请通过通用交接单完成交出，当前页面不能直接确认交出。')

  })
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
  return runWaterSolubleMutation(() => {
  const order = findMutableOrder(orderId)
  if (!order) return failure(`未找到水溶加工单“${orderId}”。`)
  const statusError = requireStatus(order, 'WAIT_FACTORY_ASSIGNMENT', '分配染厂')
  if (statusError) return statusError
  const capability = canAssignWaterSolubleFactory(factoryId)
  if (!capability.ok) return failure(capability.message)
  const factory = getFactoryMasterRecordById(factoryId)!
  order.factoryId = factory.id
  order.factoryName = factory.name
  order.acceptanceStatus = 'PENDING'
  order.acceptedAt = undefined
  order.acceptedBy = undefined
  order.status = 'WAIT_MATERIAL'
  return updateOrder(order, '分配染厂', `已分配至 ${factory.name}`)

  })
}

export function acceptWaterSolubleWorkOrderPdaTask(taskId: string, acceptedBy: string): WaterSolubleActionResult {
  return runWaterSolubleMutation(() => {
  const order = [...ensureStore().values()].find((item) => item.taskId === taskId)
  if (!order) return failure('水溶加工单不存在。')
  if (!order.factoryId) return failure('水溶加工单尚未分配染厂。')
  if (order.acceptanceStatus === 'REJECTED') return failure('水溶加工单已拒绝，不能接单。')
  if (order.acceptanceStatus === 'ACCEPTED') return { ok: true, message: '加工单已经接单', order: cloneOrder(order) }
  order.acceptanceStatus = 'ACCEPTED'
  const result = updateOrder(order, 'PDA 接单', `接单人：${acceptedBy}`)
  order.acceptedAt = order.updatedAt
  order.acceptedBy = acceptedBy
  return { ...result, order: cloneOrder(order) }

  })
}

export function rejectWaterSolubleWorkOrderPdaTask(taskId: string, rejectedBy: string, reason: string): WaterSolubleActionResult {
  return runWaterSolubleMutation(() => {
  const order = [...ensureStore().values()].find((item) => item.taskId === taskId)
  if (!order) return failure('水溶加工单不存在。')
  if (!order.factoryId) return failure('水溶加工单尚未分配染厂。')
  if (order.acceptanceStatus === 'REJECTED') return failure('水溶加工单已拒单，不可重复拒单。')
  if (order.status !== 'WAIT_MATERIAL') return failure(`当前状态为“${WATER_SOLUBLE_STATUS_LABEL[order.status]}”，不能拒单。`)
  order.acceptanceStatus = 'REJECTED'
  order.acceptedAt = undefined
  order.acceptedBy = undefined
  order.factoryId = undefined
  order.factoryName = undefined
  order.status = 'WAIT_FACTORY_ASSIGNMENT'
  return updateOrder(order, 'PDA 拒单', `拒单人：${rejectedBy}；原因：${reason}`)

  })
}

export function getWaterSolubleReceivedMaterialQty(orderId: string): number {
  const order = [...(orderStore ?? ensureStore()).values()].find((item) => item.waterOrderId === orderId)
  if (!order) return 0
  return (order.materialReceipts??[]).filter(r=>!r.receiptId.startsWith('FRP-')).reduce((n,r)=>n+r.qty,0)+getDyeFactoryReceiptProjection(orderId,order.qtyUnit,'water').reduce((n,r)=>n+r.qty,0)
}

export function receiveWaterSolubleInput(orderId: string, input?: { qty: number; receiptId: string; upstreamRecordId?: string; receiverName?: string }): WaterSolubleActionResult {
  return failure('请从染厂待接收核对原单、填写实收并选择入库库位。接收后再开始水溶。')
}

export function startWaterSoluble(orderId: string, operatorName='水溶操作员'): WaterSolubleActionResult {
  return runWaterSolubleMutation(() => {
  const order = findMutableOrder(orderId)
  if (!order) return failure(`未找到水溶加工单“${orderId}”。`)
  if(!['WAIT_WATER_SOLUBLE','WATER_SOLUBLE_IN_PROGRESS','WAIT_HANDOVER'].includes(order.status))return failure('当前状态不能开始水溶。')
  const received=getWaterSolubleReceivedMaterialQty(orderId),qty=received-(order.inputQty??0)
  if(!(qty>0)&&!(order.supervisorDecision&&(order.inputQty??0)>0))return failure('本单暂无可投入的实收库存。')
  if(qty>0)recordFactoryMaterialUsage({id:`WATER-USE-${orderId}-${order.actionLogs.length}`,waterOrderId:orderId,factoryId:order.factoryId!,operatorName,at:localDateTimeText(),qty,unit:order.qtyUnit,legacyAvailableQty:Math.max(0,(order.materialReceipts??[]).filter(r=>!r.receiptId.startsWith('FRP-')).reduce((n,r)=>n+r.qty,0)-(order.inputQty??0))})
  order.inputQty=received
  order.status = 'WATER_SOLUBLE_IN_PROGRESS'
  return updateOrder(order, '开始水溶', '工厂已开始水溶加工', operatorName)

  })
}

export function completeWaterSoluble(orderId: string, completedQty: number, exceptionReason?: string): WaterSolubleActionResult {
  return runWaterSolubleMutation(() => {
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
  if ((completedQty === 0 || completedQty > order.plannedQty) && !reason) {
    return failure(completedQty < order.plannedQty
      ? `完成数量少于计划数量 ${order.plannedQty} ${order.qtyUnit}，请填写原因并交主管处理。`
      : `完成数量超过计划数量 ${order.plannedQty} ${order.qtyUnit}，请填写原因后再确认。`)
  }
  const receivedMaterialQty = order.inputQty ?? getWaterSolubleReceivedMaterialQty(orderId)
  if (completedQty > receivedMaterialQty + 0.000001) return failure(`累计产出不能超过实际接收 ${receivedMaterialQty} ${order.qtyUnit}。`)
  order.completedQty = completedQty
  order.exceptionReason = reason
  if (completedQty < order.plannedQty && reason) {
    order.status = 'PRODUCTION_PAUSED'
    return updateOrder(order, '上报数量不足', `实际完成 ${completedQty} ${order.qtyUnit}；原因：${reason}；等待主管处理`)
  }
  order.status = 'WAIT_HANDOVER'
  return updateOrder(order, '完成水溶', `实际完成 ${completedQty} ${order.qtyUnit}${reason ? `；原因：${reason}` : ''}；等待交出`)

  })
}

export function resolveWaterSolublePause(orderId: string, decision: WaterSolubleSupervisorDecision): WaterSolubleActionResult {
  return runWaterSolubleMutation(() => {
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

  })
}

export function submitWaterSolubleHandover(orderId: string, handoverQty: number): WaterSolubleActionResult {
  return runWaterSolubleMutation(() => {
  const order = findMutableOrder(orderId)
  if (!order) return failure(`未找到水溶加工单“${orderId}”。`)
  const statusError = requireStatus(order, 'WAIT_HANDOVER', '确认交出')
  if (statusError) return statusError
  const qtyError = validatePositiveQty(handoverQty, '交出数量')
  if (qtyError) return failure(qtyError)
  const handedOverQty = order.handoverQty ?? 0
  const availableQty = Math.max(order.completedQty - handedOverQty, 0)
  if (handoverQty - availableQty > 0.000001) {
    return failure(`本次交出不能超过剩余可交出数量 ${availableQty} ${order.qtyUnit}。`)
  }
  const batches = order.handoverBatches ?? []
  batches.push({
    batchId: `${order.waterOrderId}-HANDOVER-${String(batches.length + 1).padStart(3, '0')}`,
    handoverQty,
  })
  order.handoverBatches = batches
  order.handoverQty = handedOverQty + handoverQty
  order.status = 'HANDOVER_WAIT_RECEIVE'
  return updateOrder(order, '确认交出', `本次交出 ${handoverQty} ${order.qtyUnit}；累计交出 ${order.handoverQty} ${order.qtyUnit}，等待本批收货`)

  })
}

export function linkWaterSolubleHandoverOrder(
  orderId: string,
  taskId: string,
  handoverOrderId: string,
): WaterSolubleActionResult {
  return runWaterSolubleMutation(() => {
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
  return updateOrder(order, '关联交出单', `已关联通用交出单 ${normalizedHandoverOrderId}`, '系统自动关联')

  })
}

function getWaterSolubleStatusAfterReceipt(order: WaterSolubleWorkOrder): WaterSolubleWorkOrderStatus {
  if ((order.handoverQty ?? 0) + 0.000001 < order.completedQty) return 'WAIT_HANDOVER'
  if (order.completedQty + 0.000001 < order.plannedQty && order.supervisorDecision !== 'CONTINUE_WITH_ACTUAL_QTY') return 'WATER_SOLUBLE_IN_PROGRESS'
  return 'WAIT_MANUAL_COMPLETION'
}

export function receiveWaterSolubleHandoverBatch(orderId: string, sequenceNo: number, cumulativeQty: number): WaterSolubleActionResult {
  return runWaterSolubleMutation(() => {
  const order = findMutableOrder(orderId)
  if (!order || order.status === 'DONE') return failure('当前水溶加工单不能接收。')
  const batch = order.handoverBatches?.[sequenceNo - 1]
  if (!batch || !Number.isFinite(cumulativeQty) || cumulativeQty < (batch.receivedQty ?? 0)) return failure('本批累计接收数量无效。')
  batch.receivedQty = cumulativeQty
  order.receivedQty = (order.handoverBatches ?? []).reduce((sum, item) => sum + (item.receivedQty ?? 0), 0)
  order.status = cumulativeQty + 0.000001 < batch.handoverQty ? 'HANDOVER_WAIT_RECEIVE' : getWaterSolubleStatusAfterReceipt(order)
  return updateOrder(order, '分次接收交出批次', `第 ${sequenceNo} 批累计接收 ${cumulativeQty} ${order.qtyUnit}`)

  })
}

export function writeBackWaterSolubleReceipt(orderId: string, receivedQty: number): WaterSolubleActionResult {
  return runWaterSolubleMutation(() => {
  const order = findMutableOrder(orderId)
  if (!order) return failure(`未找到水溶加工单“${orderId}”。`)
  const statusError = requireStatus(order, 'HANDOVER_WAIT_RECEIVE', '确认收货')
  if (statusError) return statusError
  const qtyError = validateNonNegativeQty(receivedQty, '收货数量')
  if (qtyError) return failure(qtyError)
  const batch = [...(order.handoverBatches ?? [])].reverse().find((item) => item.receivedQty === undefined)
  if (!batch) return failure('当前没有等待收货的水溶交出批次。')
  batch.receivedQty = receivedQty
  order.receivedQty = (order.handoverBatches ?? []).reduce((sum, item) => sum + (item.receivedQty ?? 0), 0)
  const isSameBatchQty = Math.abs(receivedQty - batch.handoverQty) <= 0.000001
  order.status = isSameBatchQty
    ? getWaterSolubleStatusAfterReceipt(order)
    : 'RECEIPT_DIFFERENCE'
  return updateOrder(
    order,
    isSameBatchQty ? '确认本批收货' : '上报本批收货差异',
    isSameBatchQty
      ? `本批已收货 ${receivedQty} ${order.qtyUnit}；累计实收 ${order.receivedQty} ${order.qtyUnit}`
      : `本批交出 ${batch.handoverQty} ${order.qtyUnit}，实际收货 ${receivedQty} ${order.qtyUnit}`,
  )

  })
}

export function resolveWaterSolubleReceiptDifference(orderId: string): WaterSolubleActionResult {
  return runWaterSolubleMutation(() => {
  const order = findMutableOrder(orderId)
  if (!order) return failure(`未找到水溶加工单“${orderId}”。`)
  const statusError = requireStatus(order, 'RECEIPT_DIFFERENCE', '确认收货差异')
  if (statusError) return statusError
  const batch = [...(order.handoverBatches ?? [])].reverse().find((item) => item.receivedQty !== undefined && item.receiptDifferenceAccepted !== true && Math.abs((item.receivedQty ?? 0) - item.handoverQty) > 0.000001)
  if (!batch) return failure('当前没有待确认的本批收货差异。')
  batch.receiptDifferenceAccepted = true
  order.status = getWaterSolubleStatusAfterReceipt(order)
  return updateOrder(order, '确认收货差异', `主管已确认本批按实际收货；累计实收 ${order.receivedQty ?? 0} ${order.qtyUnit}`)

  })
}

export function completeWaterSolubleWorkOrder(orderId: string): WaterSolubleActionResult {
  return runWaterSolubleMutation(() => {
  const order = findMutableOrder(orderId)
  if (!order) return failure(`未找到水溶加工单“${orderId}”。`)
  const statusError = requireStatus(order, 'WAIT_MANUAL_COMPLETION', '人工完成单据')
  if (statusError) return statusError
  const batches = order.handoverBatches ?? []
  const hasUnresolvedBatch = batches.some((batch) => batch.receivedQty === undefined || (Math.abs((batch.receivedQty ?? 0) - batch.handoverQty) > 0.000001 && !batch.receiptDifferenceAccepted))
  if (hasUnresolvedBatch) return failure('仍有未收货或未确认差异的交出批次，不能完成单据。')
  if ((order.handoverQty ?? 0) + 0.000001 < order.completedQty) return failure('仍有已完成数量尚未交出，不能完成单据。')
  order.status = 'DONE'
  return updateOrder(order, '人工完成单据', `人工确认水溶加工单完成；累计交出 ${order.handoverQty ?? 0} ${order.qtyUnit}`)

  })
}

export function resetWaterSolubleDomainForChecks(options: { seedDemo?: boolean } = {}): void {
  const data=captureFactoryReceivingData(),ids=new Set(data.receipts.flatMap(r=>r.lines.filter(l=>l.waterOrderId).map(l=>l.id)));data.receipts=data.receipts.filter(r=>!r.lines.some(l=>l.waterOrderId));data.allocations=data.allocations.filter(a=>!a.waterOrderId&&!ids.has(a.receiptLineId));data.materialUses=data.materialUses?.filter(u=>!u.waterOrderId);data.sources=data.sources.filter(s=>!s.lines.some(l=>l.waterOrderId));restoreFactoryReceivingData(data)
  orderStore = buildWaterSolubleOrderStore(options.seedDemo === true)
}
