import {
  getProcessHandoverRecordById,
  listProcessHandoverRecords,
  type ProcessWarehouseObjectType,
} from './process-warehouse-domain.ts'
import type { PreSettlementLedger } from './store-domain-settlement-types.ts'

export type ProcessWorkOrderQcStatus = '待质检' | '已质检'

export interface ProcessWorkOrderQcRecord {
  qcRecordId: string
  qcRecordNo: string
  handoverRecordId: string
  handoverRecordNo: string
  workOrderId: string
  workOrderNo: string
  sourceTaskId: string
  sourceTaskNo: string
  priceSourceTaskId: string
  priceSourceTaskNo: string
  productionOrderId: string
  productionOrderNo: string
  craftType: string
  craftName: string
  factoryId: string
  factoryName: string
  objectType: ProcessWarehouseObjectType
  receivedQty: number
  inspectedQty: number
  qualifiedQty: number
  unqualifiedQty: number
  qtyUnit: string
  unitPrice: number
  currency: string
  status: ProcessWorkOrderQcStatus
  inspectorName: string
  inspectedAt: string
  evidenceUrls: string[]
  remark: string
}

const qcRecords: ProcessWorkOrderQcRecord[] = []

function round(value: number): number {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100
}

function token(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '')
}

function isDiscreteUnit(unit: string): boolean {
  return ['片', '件', '个', '条', '张'].includes(unit)
}

export function listProcessWorkOrderQcRecords(filter: {
  workOrderId?: string
  handoverRecordId?: string
  factoryId?: string
  status?: ProcessWorkOrderQcStatus
} = {}): ProcessWorkOrderQcRecord[] {
  return qcRecords
    .filter((record) => !filter.workOrderId || record.workOrderId === filter.workOrderId)
    .filter((record) => !filter.handoverRecordId || record.handoverRecordId === filter.handoverRecordId)
    .filter((record) => !filter.factoryId || record.factoryId === filter.factoryId)
    .filter((record) => !filter.status || record.status === filter.status)
    .map((record) => structuredClone(record))
}

export function listProcessHandoversWaitingQc(factoryId?: string) {
  const linkedHandoverIds = new Set(qcRecords.map((record) => record.handoverRecordId))
  return listProcessHandoverRecords()
    .filter((handover) => Boolean(handover.receiveAt) && handover.receiveObjectQty > 0)
    .filter((handover) => !factoryId || handover.handoverFactoryId === factoryId)
    .filter((handover) => !linkedHandoverIds.has(handover.handoverRecordId))
}

export function createProcessWorkOrderQcRecord(input: {
  handoverRecordId: string
  unitPrice?: number
  currency?: string
  createdBy: string
}): ProcessWorkOrderQcRecord {
  const existed = qcRecords.find((record) => record.handoverRecordId === input.handoverRecordId)
  if (existed) return structuredClone(existed)
  const handover = getProcessHandoverRecordById(input.handoverRecordId)
  if (!handover) throw new Error('交出记录不存在，不能创建加工单质检记录。')
  if (!handover.receiveAt || handover.receiveObjectQty <= 0) throw new Error('必须先完成仓库实收，才能创建加工单质检记录。')
  if (!handover.workOrderId || !handover.workOrderNo) throw new Error('交出记录缺少具体加工单身份，已阻断质检建单。')
  const unitPrice = Number(input.unitPrice ?? 1)
  if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new Error('加工价格快照必须是有效非负数。')
  const index = qcRecords.length + 1
  const record: ProcessWorkOrderQcRecord = {
    qcRecordId: `PQC-${token(handover.workOrderId)}-${String(index).padStart(3, '0')}`,
    qcRecordNo: `PQC-${handover.workOrderNo}-${String(index).padStart(2, '0')}`,
    handoverRecordId: handover.handoverRecordId,
    handoverRecordNo: handover.handoverRecordNo,
    workOrderId: handover.workOrderId,
    workOrderNo: handover.workOrderNo,
    sourceTaskId: handover.sourceTaskId,
    sourceTaskNo: handover.sourceTaskNo,
    priceSourceTaskId: handover.sourceTaskId,
    priceSourceTaskNo: handover.sourceTaskNo,
    productionOrderId: handover.sourceProductionOrderId || '',
    productionOrderNo: handover.sourceProductionOrderNo || '',
    craftType: handover.craftType,
    craftName: handover.craftName,
    factoryId: handover.handoverFactoryId,
    factoryName: handover.handoverFactoryName,
    objectType: handover.objectType,
    receivedQty: handover.receiveObjectQty,
    inspectedQty: 0,
    qualifiedQty: 0,
    unqualifiedQty: 0,
    qtyUnit: handover.qtyUnit,
    unitPrice: round(unitPrice),
    currency: input.currency || 'CNY',
    status: '待质检',
    inspectorName: '',
    inspectedAt: '',
    evidenceUrls: [],
    remark: `由加工单 ${handover.workOrderNo} 的仓库实收批次创建；建单人 ${input.createdBy}。`,
  }
  qcRecords.unshift(record)
  return structuredClone(record)
}

export function submitProcessWorkOrderQcResult(input: {
  qcRecordId: string
  inspectedQty: number
  qualifiedQty: number
  unqualifiedQty: number
  inspectorName: string
  inspectedAt: string
  evidenceUrls?: string[]
  remark?: string
}): ProcessWorkOrderQcRecord {
  const record = qcRecords.find((item) => item.qcRecordId === input.qcRecordId)
  if (!record) throw new Error('加工单质检记录不存在。')
  if (record.status === '已质检') throw new Error('该实收批次已经完成质检，不能重复提交。')
  const inspectedQty = round(input.inspectedQty)
  const qualifiedQty = round(input.qualifiedQty)
  const unqualifiedQty = round(input.unqualifiedQty)
  if (![inspectedQty, qualifiedQty, unqualifiedQty].every(Number.isFinite) || inspectedQty <= 0 || qualifiedQty < 0 || unqualifiedQty < 0) {
    throw new Error('质检数量必须是有效的非负数，且本次质检数量必须大于 0。')
  }
  if (inspectedQty > record.receivedQty) throw new Error('质检数量不能超过当前加工单批次的仓库实收数量。')
  if (inspectedQty !== record.receivedQty) throw new Error('本次必须完成该加工单实收批次的全部数量质检。')
  if (round(qualifiedQty + unqualifiedQty) !== inspectedQty) throw new Error('合格与不合格数量之和必须等于本次质检数量。')
  if (isDiscreteUnit(record.qtyUnit) && ![inspectedQty, qualifiedQty, unqualifiedQty].every(Number.isInteger)) {
    throw new Error(`${record.qtyUnit}为离散单位，质检数量必须为整数。`)
  }
  if (!input.inspectorName.trim() || !input.inspectedAt.trim()) throw new Error('质检人和质检时间不能为空。')
  if (unqualifiedQty > 0 && !(input.remark?.trim() || input.evidenceUrls?.length)) {
    throw new Error('存在不合格数量时，必须填写原因或上传质检证据。')
  }
  record.inspectedQty = inspectedQty
  record.qualifiedQty = qualifiedQty
  record.unqualifiedQty = unqualifiedQty
  record.inspectorName = input.inspectorName.trim()
  record.inspectedAt = input.inspectedAt
  record.evidenceUrls = [...(input.evidenceUrls || [])]
  record.remark = input.remark?.trim() || record.remark
  record.status = '已质检'
  return structuredClone(record)
}

function getCycle(at: string) {
  const date = at.slice(0, 10) || '2026-01-01'
  const month = date.slice(0, 7)
  const [year, monthNo] = month.split('-').map(Number)
  const monthEnd = Number.isFinite(year) && Number.isFinite(monthNo)
    ? new Date(year, monthNo, 0).getDate()
    : 31
  return {
    id: `MONTH-${month}`,
    label: `${month} 月结`,
    start: `${month}-01`,
    end: `${month}-${String(monthEnd).padStart(2, '0')}`,
  }
}

export function listProcessWorkOrderSettlementLedgers(): PreSettlementLedger[] {
  return qcRecords
    .filter((record) => record.status === '已质检' && record.qualifiedQty > 0)
    .map((record) => {
      const cycle = getCycle(record.inspectedAt)
      const amount = round(record.qualifiedQty * record.unitPrice)
      return {
        ledgerId: `PSET-${record.qcRecordId}`,
        ledgerNo: `PSET-${record.qcRecordNo}`,
        ledgerType: 'TASK_EARNING',
        direction: 'INCOME',
        sourceType: 'WORK_ORDER_QUALITY_RESULT',
        sourceRefId: record.qcRecordId,
        factoryId: record.factoryId,
        factoryName: record.factoryName,
        taskId: record.sourceTaskId,
        taskNo: record.sourceTaskNo,
        workOrderId: record.workOrderId,
        workOrderNo: record.workOrderNo,
        priceSourceTaskId: record.priceSourceTaskId,
        priceSourceTaskNo: record.priceSourceTaskNo,
        productionOrderId: record.productionOrderId,
        productionOrderNo: record.productionOrderNo,
        qcRecordId: record.qcRecordId,
        priceSourceType: 'DISPATCH',
        unitPrice: record.unitPrice,
        qty: record.qualifiedQty,
        qtyUnit: record.qtyUnit,
        originalCurrency: record.currency,
        originalAmount: amount,
        settlementCurrency: record.currency,
        settlementAmount: amount,
        fxRate: 1,
        fxAppliedAt: record.inspectedAt,
        occurredAt: record.inspectedAt,
        settlementCycleId: cycle.id,
        settlementCycleLabel: cycle.label,
        settlementCycleStartAt: cycle.start,
        settlementCycleEndAt: cycle.end,
        status: 'OPEN',
        sourceReason: '按具体加工单仓库实收批次的质检合格数量生成收入流水。',
        remark: `${record.craftName}加工单 ${record.workOrderNo}；合格 ${record.qualifiedQty} ${record.qtyUnit}；价格来源任务 ${record.priceSourceTaskNo || record.priceSourceTaskId}。`,
      }
    })
}

export function captureProcessWorkOrderQualityState(): ProcessWorkOrderQcRecord[] {
  return structuredClone(qcRecords)
}

export function restoreProcessWorkOrderQualityState(snapshot: ProcessWorkOrderQcRecord[]): void {
  qcRecords.splice(0, qcRecords.length, ...structuredClone(snapshot))
}

export function resetProcessWorkOrderQualityState(): void {
  qcRecords.splice(0, qcRecords.length)
}
