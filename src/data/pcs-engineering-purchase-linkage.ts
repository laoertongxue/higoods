// 辅料采购联动：采购事实由采购系统 Mock 适配器提供，PCS 只保存采购单号引用并计算覆盖门禁。

import type { EngineeringTaskRecord } from './pcs-engineering-master-types.ts'
import {
  getEngineeringMasterOrderById,
  updateEngineeringTaskRecord,
} from './pcs-engineering-master-repository.ts'

export type EngineeringPurchaseOrderStatus = '待下单' | '已下单' | '部分到货' | '已完成' | '已作废' | '已取消'

export interface EngineeringPurchaseOrderMaterialLine {
  materialSkuId: string
  materialName: string
  quantity: number
  unit: string
}

export interface EngineeringPurchaseOrderFact {
  purchaseOrderNo: string
  styleCode: string
  supplierName: string
  status: EngineeringPurchaseOrderStatus
  orderedAt: string
  materialLines: EngineeringPurchaseOrderMaterialLine[]
  accessible?: boolean
}

export interface AccessoryPurchaseCompletionGate {
  complete: boolean
  completed: boolean
  coveredMaterialSkuIds: string[]
  missingMaterialSkuIds: string[]
  uncoveredMaterialSkuIds: string[]
  completedAt: string
  blockReason: string
}

const DEFAULT_PURCHASE_ORDER_FACTS: EngineeringPurchaseOrderFact[] = [
  {
    purchaseOrderNo: 'CG-260801-001',
    styleCode: 'STYLE-PRJ-202603-012',
    supplierName: '深圳辅料供应商甲',
    status: '已下单',
    orderedAt: '2026-08-01 09:20:00',
    materialLines: [{ materialSkuId: 'ACC-ZIPPER-001', materialName: '5 号尼龙拉链', quantity: 600, unit: '条' }],
  },
  {
    purchaseOrderNo: 'CG-260801-002',
    styleCode: 'STYLE-PRJ-202603-012',
    supplierName: '东莞纽扣供应商乙',
    status: '已下单',
    orderedAt: '2026-08-01 14:35:00',
    materialLines: [{ materialSkuId: 'ACC-BUTTON-002', materialName: '四眼树脂纽扣', quantity: 2400, unit: '颗' }],
  },
]

let purchaseOrderFacts: EngineeringPurchaseOrderFact[] = DEFAULT_PURCHASE_ORDER_FACTS.map(cloneFact)

function cloneFact(fact: EngineeringPurchaseOrderFact): EngineeringPurchaseOrderFact {
  return { ...fact, materialLines: fact.materialLines.map((line) => ({ ...line })) }
}

export function setEngineeringPurchaseOrderFacts(facts: EngineeringPurchaseOrderFact[]): void {
  purchaseOrderFacts = facts.map(cloneFact)
}

export function resetEngineeringPurchaseOrderFacts(): void {
  purchaseOrderFacts = DEFAULT_PURCHASE_ORDER_FACTS.map(cloneFact)
}

// 仅供采购事实 Mock 适配器和测试模拟外部系统变化；页面不暴露采购单编辑能力。
export function updateEngineeringPurchaseOrderFact(
  purchaseOrderNo: string,
  patch: Partial<Omit<EngineeringPurchaseOrderFact, 'purchaseOrderNo'>>,
): EngineeringPurchaseOrderFact {
  const index = purchaseOrderFacts.findIndex((item) => item.purchaseOrderNo === purchaseOrderNo)
  if (index < 0) throw new Error(`采购单不存在：${purchaseOrderNo}`)
  const current = purchaseOrderFacts[index]!
  const next = cloneFact({
    ...current,
    ...patch,
    materialLines: patch.materialLines ?? current.materialLines,
  })
  purchaseOrderFacts[index] = next
  return cloneFact(next)
}

export function removeEngineeringPurchaseOrderFact(purchaseOrderNo: string): void {
  purchaseOrderFacts = purchaseOrderFacts.filter((item) => item.purchaseOrderNo !== purchaseOrderNo)
}

export function findEngineeringPurchaseOrderFact(purchaseOrderNo: string): EngineeringPurchaseOrderFact | null {
  const normalized = purchaseOrderNo.trim().toUpperCase()
  const fact = purchaseOrderFacts.find((item) => item.purchaseOrderNo.trim().toUpperCase() === normalized)
  return fact ? cloneFact(fact) : null
}

export function listEngineeringPurchaseOrderFacts(orderNos: string[]): EngineeringPurchaseOrderFact[] {
  const requested = new Set(orderNos.map((item) => item.trim().toUpperCase()).filter(Boolean))
  return purchaseOrderFacts
    .filter((item) => requested.has(item.purchaseOrderNo.trim().toUpperCase()))
    .map(cloneFact)
}

function isValidCoverageOrder(order: EngineeringPurchaseOrderFact): boolean {
  return order.accessible !== false && Boolean(order.orderedAt.trim()) && !['已作废', '已取消'].includes(order.status)
}

export interface AccessoryPurchaseCoverageOrder {
  orderNo: string
  materialSkuIds: string[]
  orderedAt: string
  status?: EngineeringPurchaseOrderStatus
}

export function evaluateAccessoryPurchaseCompletion(input: {
  requiredMaterialSkuIds: string[]
  purchaseOrders: Array<EngineeringPurchaseOrderFact | AccessoryPurchaseCoverageOrder>
}): AccessoryPurchaseCompletionGate {
  const purchaseOrders: EngineeringPurchaseOrderFact[] = input.purchaseOrders.map((order) => 'purchaseOrderNo' in order
    ? order
    : {
        purchaseOrderNo: order.orderNo,
        styleCode: '',
        supplierName: '',
        status: order.status || '已下单',
        orderedAt: order.orderedAt,
        materialLines: order.materialSkuIds.map((materialSkuId) => ({ materialSkuId, materialName: materialSkuId, quantity: 0, unit: '' })),
      })
  const required = [...new Set(input.requiredMaterialSkuIds.map((item) => item.trim()).filter(Boolean))]
  const inaccessibleOrders = purchaseOrders.filter((order) => order.accessible === false)
  const invalidOrders = purchaseOrders.filter((order) => ['已作废', '已取消'].includes(order.status))
  const missingTimeOrders = purchaseOrders.filter((order) => !order.orderedAt.trim())
  const validOrders = purchaseOrders.filter(isValidCoverageOrder)
  const covered = [...new Set(validOrders.flatMap((order) => order.materialLines.map((line) => line.materialSkuId.trim())).filter((sku) => required.includes(sku)))]
  const missing = required.filter((sku) => !covered.includes(sku))
  const completedAt = validOrders.map((order) => order.orderedAt.trim()).sort().at(-1) || ''
  let blockReason = ''
  if (inaccessibleOrders.length > 0) blockReason = `无权读取采购单：${inaccessibleOrders.map((order) => order.purchaseOrderNo).join('、')}`
  else if (invalidOrders.length > 0) blockReason = `采购单已作废或无效：${invalidOrders.map((order) => order.purchaseOrderNo).join('、')}`
  else if (missingTimeOrders.length > 0) blockReason = `采购单缺少实际下单时间：${missingTimeOrders.map((order) => order.purchaseOrderNo).join('、')}`
  else if (missing.length > 0) blockReason = `未覆盖任务所需物料：${missing.join('、')}`
  else if (required.length === 0) blockReason = '当前任务没有可核对的辅料需求。'
  const complete = required.length > 0 && !blockReason
  return {
    complete,
    completed: complete,
    coveredMaterialSkuIds: covered,
    missingMaterialSkuIds: missing,
    uncoveredMaterialSkuIds: missing,
    completedAt: complete ? completedAt : '',
    blockReason,
  }
}

function requiredMaterialSkuIds(task: EngineeringTaskRecord): string[] {
  return [...new Set(task.materialLines
    .filter((line) => line.status === '正常' && line.requirementType === '辅料')
    .map((line) => line.materialSkuId.trim())
    .filter(Boolean))]
}

function assertPurchaseTask(masterOrderId: string, taskId: string) {
  const master = getEngineeringMasterOrderById(masterOrderId)
  if (!master) throw new Error(`工程主单不存在：${masterOrderId}`)
  const task = master.tasks.find((item) => item.taskId === taskId)
  if (!task || task.taskType !== 'ACCESSORY_PURCHASE') throw new Error('仅辅料下单任务可以绑定采购单。')
  return { master, task }
}

export interface AccessoryPurchaseTaskLinkage {
  task: EngineeringTaskRecord
  purchaseOrders: EngineeringPurchaseOrderFact[]
  gate: AccessoryPurchaseCompletionGate
}

export function computeAccessoryPurchaseTaskLinkage(masterOrderId: string, taskId: string): AccessoryPurchaseTaskLinkage {
  const { master, task } = assertPurchaseTask(masterOrderId, taskId)
  const boundOrderNos = task.boundPurchaseOrderNos || []
  const purchaseOrders = listEngineeringPurchaseOrderFacts(boundOrderNos)
  const foundOrderNos = new Set(purchaseOrders.map((order) => order.purchaseOrderNo))
  const missingOrderNos = boundOrderNos.filter((orderNo) => !foundOrderNos.has(orderNo))
  const wrongStyleOrders = purchaseOrders.filter((order) => order.styleCode !== master.styleCode)
  let gate = evaluateAccessoryPurchaseCompletion({ requiredMaterialSkuIds: requiredMaterialSkuIds(task), purchaseOrders })
  if (missingOrderNos.length > 0 || wrongStyleOrders.length > 0) {
    gate = {
      ...gate,
      complete: false,
      completed: false,
      completedAt: '',
      blockReason: missingOrderNos.length > 0
        ? `采购事实不存在：${missingOrderNos.join('、')}`
        : `采购单不属于当前款式：${wrongStyleOrders.map((order) => order.purchaseOrderNo).join('、')}`,
    }
  }
  return { task, purchaseOrders, gate }
}

// 兼容既有只读调用；该入口只计算，不写回。
export const getAccessoryPurchaseTaskLinkage = computeAccessoryPurchaseTaskLinkage

function applyGate(task: EngineeringTaskRecord, gate: AccessoryPurchaseCompletionGate): void {
  task.completedAt = gate.completedAt
  task.effectiveCompletedAt = gate.completedAt
  if (gate.complete) {
    task.status = '已完成'
    task.submittedAt = gate.completedAt
    task.firstCompletedAt ||= gate.completedAt
  } else {
    const hasBoundOrder = (task.boundPurchaseOrderNos || []).length > 0
    task.status = hasBoundOrder ? '进行中' : '待开始'
    task.submittedAt = ''
    if (!hasBoundOrder) task.startedAt = ''
  }
}

export function reconcileAccessoryPurchaseTaskLinkage(
  masterOrderId: string,
  taskId: string,
): AccessoryPurchaseTaskLinkage {
  const computed = computeAccessoryPurchaseTaskLinkage(masterOrderId, taskId)
  const result = updateEngineeringTaskRecord(masterOrderId, taskId, (current) => applyGate(current, computed.gate))
  return { task: result.task, purchaseOrders: computed.purchaseOrders, gate: computed.gate }
}

export function bindAccessoryPurchaseOrder(masterOrderId: string, taskId: string, purchaseOrderNo: string) {
  const normalized = purchaseOrderNo.trim()
  if (!normalized) throw new Error('请输入采购单号。')
  const { master, task } = assertPurchaseTask(masterOrderId, taskId)
  if ((task.boundPurchaseOrderNos || []).some((item) => item.toUpperCase() === normalized.toUpperCase())) {
    throw new Error(`采购单 ${normalized} 已绑定，请勿重复绑定。`)
  }
  const fact = findEngineeringPurchaseOrderFact(normalized)
  if (!fact) throw new Error(`采购单不存在：${normalized}`)
  if (fact.accessible === false) throw new Error(`无权读取采购单：${normalized}`)
  if (fact.styleCode !== master.styleCode) throw new Error(`采购单不属于当前款式：${normalized}`)
  if (['已作废', '已取消'].includes(fact.status)) throw new Error(`采购单已作废或无效：${normalized}`)
  const required = requiredMaterialSkuIds(task)
  if (!fact.materialLines.some((line) => required.includes(line.materialSkuId))) {
    throw new Error(`采购单未包含当前任务所需物料：${normalized}`)
  }
  const nextOrderNos = [...(task.boundPurchaseOrderNos || []), fact.purchaseOrderNo]
  const purchaseOrders = listEngineeringPurchaseOrderFacts(nextOrderNos)
  const gate = evaluateAccessoryPurchaseCompletion({ requiredMaterialSkuIds: required, purchaseOrders })
  const result = updateEngineeringTaskRecord(masterOrderId, taskId, (current) => {
    current.boundPurchaseOrderNos = nextOrderNos
    current.startedAt ||= fact.orderedAt || new Date().toLocaleString('zh-CN', { hour12: false })
    applyGate(current, gate)
  })
  return { ...result, purchaseOrders, gate }
}

export function unbindAccessoryPurchaseOrder(masterOrderId: string, taskId: string, purchaseOrderNo: string) {
  const { task } = assertPurchaseTask(masterOrderId, taskId)
  const bound = task.boundPurchaseOrderNos || []
  if (!bound.some((item) => item === purchaseOrderNo)) throw new Error(`采购单尚未绑定：${purchaseOrderNo}`)
  const nextOrderNos = bound.filter((item) => item !== purchaseOrderNo)
  const purchaseOrders = listEngineeringPurchaseOrderFacts(nextOrderNos)
  const gate = evaluateAccessoryPurchaseCompletion({ requiredMaterialSkuIds: requiredMaterialSkuIds(task), purchaseOrders })
  const result = updateEngineeringTaskRecord(masterOrderId, taskId, (current) => {
    current.boundPurchaseOrderNos = nextOrderNos
    applyGate(current, gate)
  })
  return { ...result, purchaseOrders, gate }
}
