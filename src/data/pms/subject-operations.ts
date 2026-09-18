import { appendPmsLog, PmsDomainError, roundPmsQty, type PmsActorRole } from './runtime.ts'
import { listPmsTradeSubjects } from './trade-subjects.ts'

export type PmsSubjectRevenueStatus = '未确认' | '部分确认' | '已确认'

export const PMS_SUBJECT_REVENUE_STATUSES = ['未确认', '部分确认', '已确认'] as const

export interface PmsSubjectOperation {
  operationId: string
  subjectCode: string
  subjectName: string
  period: string
  currency: 'RMB' | 'USD' | 'IDR' | 'HKD'
  salesAmount: number
  purchaseCost: number
  domesticFreight: number
  firstLegOceanFreight: number
  destinationPortFee: number
  lastMileDeliveryFee: number
  customsDuty: number
  vat: number
  clearanceFee: number
  otherCost: number
  adjustment: number
  logisticsCost: number
  allocatedCost: number
  totalCost: number
  grossProfit: number
  grossMargin: number
  revenueStatus: PmsSubjectRevenueStatus
  confirmedRevenue: number | null
  missingCostFields: string[]
  remark: string
  updatedBy: string
  updatedAt: string
}

function splitLogistics(total: number): { domesticFreight: number; firstLegOceanFreight: number; destinationPortFee: number; lastMileDeliveryFee: number } {
  const domesticFreight = Math.round(total * 0.3)
  const firstLegOceanFreight = Math.round(total * 0.5)
  const destinationPortFee = Math.round(total * 0.12)
  return { domesticFreight, firstLegOceanFreight, destinationPortFee, lastMileDeliveryFee: total - domesticFreight - firstLegOceanFreight - destinationPortFee }
}

function splitAllocated(total: number): { customsDuty: number; vat: number; clearanceFee: number } {
  const customsDuty = Math.round(total * 0.55)
  const vat = Math.round(total * 0.35)
  return { customsDuty, vat, clearanceFee: total - customsDuty - vat }
}

function recompute(row: PmsSubjectOperation): void {
  row.logisticsCost = roundPmsQty(row.domesticFreight + row.firstLegOceanFreight + row.destinationPortFee + row.lastMileDeliveryFee, 2)
  row.allocatedCost = roundPmsQty(row.customsDuty + row.vat + row.clearanceFee + row.adjustment, 2)
  row.totalCost = roundPmsQty(row.purchaseCost + row.logisticsCost + row.allocatedCost + row.otherCost, 2)
  row.grossProfit = roundPmsQty(row.salesAmount - row.totalCost, 2)
  row.grossMargin = row.salesAmount > 0 ? roundPmsQty((row.grossProfit / row.salesAmount) * 100, 2) : 0
}

function buildRow(
  operationId: string,
  subjectCode: string,
  salesAmount: number,
  purchaseCost: number,
  logisticsCost: number,
  allocatedCost: number,
  otherCost: number,
  extras: { revenueStatus: PmsSubjectRevenueStatus; confirmedRevenue: number | null; missingCostFields?: string[] },
): PmsSubjectOperation {
  const subject = listPmsTradeSubjects().find((item) => item.subjectCode === subjectCode)
  const row: PmsSubjectOperation = {
    operationId,
    subjectCode,
    subjectName: subject?.subjectName ?? subjectCode,
    period: '2026-05',
    currency: subject?.settlementCurrency ?? 'RMB',
    salesAmount,
    purchaseCost,
    ...splitLogistics(logisticsCost),
    ...splitAllocated(allocatedCost),
    otherCost,
    adjustment: 0,
    logisticsCost: 0,
    allocatedCost: 0,
    totalCost: 0,
    grossProfit: 0,
    grossMargin: 0,
    revenueStatus: extras.revenueStatus,
    confirmedRevenue: extras.confirmedRevenue,
    missingCostFields: extras.missingCostFields ?? [],
    remark: '',
    updatedBy: '刘财务',
    updatedAt: '2026-06-05 15:00:00',
  }
  recompute(row)
  return row
}

const rows: PmsSubjectOperation[] = [
  buildRow('SO-2026-05-01', 'TS-001', 1860000, 1186000, 142000, 86000, 24000, { revenueStatus: '已确认', confirmedRevenue: 2000000 }),
  buildRow('SO-2026-05-02', 'TS-002', 1240000, 812000, 96000, 52000, 18000, { revenueStatus: '已确认', confirmedRevenue: 1200000 }),
  buildRow('SO-2026-05-03', 'TS-003', 940000, 612000, 78000, 41000, 12000, { revenueStatus: '部分确认', confirmedRevenue: 900000 }),
  buildRow('SO-2026-05-04', 'TS-004', 760000, 508000, 46000, 32000, 9000, { revenueStatus: '已确认', confirmedRevenue: 760000 }),
  buildRow('SO-2026-05-05', 'TS-005', 320000, 214000, 26000, 14000, 5000, { revenueStatus: '部分确认', confirmedRevenue: null }),
  buildRow('SO-2026-05-06', 'TS-007', 280000, 176000, 52000, 16000, 6000, { revenueStatus: '未确认', confirmedRevenue: null, missingCostFields: ['关税', '增值税'] }),
]

export function listPmsSubjectOperations(): PmsSubjectOperation[] {
  return rows
}

export function getPmsSubjectOperation(operationId: string): PmsSubjectOperation | undefined {
  return rows.find((row) => row.operationId === operationId)
}

export function listPmsSubjectOperationDataGaps(row: PmsSubjectOperation): string[] {
  const gaps = [...row.missingCostFields]
  if (row.confirmedRevenue === null) gaps.push('已确认收入金额')
  return gaps
}

export interface PmsSubjectOperationPatch {
  salesAmount?: number
  purchaseCost?: number
  domesticFreight?: number
  firstLegOceanFreight?: number
  destinationPortFee?: number
  lastMileDeliveryFee?: number
  customsDuty?: number
  vat?: number
  clearanceFee?: number
  otherCost?: number
  adjustment?: number
  allocatedCost?: number
  revenueStatus?: PmsSubjectRevenueStatus
  confirmedRevenue?: number | null
  remark?: string
}

type PmsSubjectCostField = 'purchaseCost' | 'domesticFreight' | 'firstLegOceanFreight' | 'destinationPortFee' | 'lastMileDeliveryFee' | 'customsDuty' | 'vat' | 'clearanceFee' | 'otherCost'

const COST_FIELDS: Array<{ key: PmsSubjectCostField; label: string; code: string }> = [
  { key: 'purchaseCost', label: '采购成本', code: 'SUBJECT_PURCHASE_INVALID' },
  { key: 'domesticFreight', label: '国内段运费', code: 'SUBJECT_DOMESTIC_FREIGHT_INVALID' },
  { key: 'firstLegOceanFreight', label: '头程海运费', code: 'SUBJECT_OCEAN_FREIGHT_INVALID' },
  { key: 'destinationPortFee', label: '目的港费', code: 'SUBJECT_PORT_FEE_INVALID' },
  { key: 'lastMileDeliveryFee', label: '末端配送费', code: 'SUBJECT_LAST_MILE_INVALID' },
  { key: 'customsDuty', label: '关税', code: 'SUBJECT_CUSTOMS_DUTY_INVALID' },
  { key: 'vat', label: '增值税', code: 'SUBJECT_VAT_INVALID' },
  { key: 'clearanceFee', label: '清关费', code: 'SUBJECT_CLEARANCE_INVALID' },
  { key: 'otherCost', label: '其他费用', code: 'SUBJECT_OTHER_INVALID' },
]

export function updatePmsSubjectOperation(
  operationId: string,
  patch: PmsSubjectOperationPatch,
  actor: { id: string; name: string; role: PmsActorRole },
): PmsSubjectOperation {
  const row = getPmsSubjectOperation(operationId)
  if (!row) throw new PmsDomainError('SUBJECT_OPERATION_NOT_FOUND', `主体经营明细 ${operationId} 不存在`)
  if (patch.salesAmount !== undefined) {
    if (!Number.isFinite(patch.salesAmount) || patch.salesAmount < 0) throw new PmsDomainError('SUBJECT_SALES_INVALID', '销售金额不能为负数')
    row.salesAmount = roundPmsQty(patch.salesAmount, 2)
  }
  for (const field of COST_FIELDS) {
    const value = patch[field.key]
    if (value === undefined) continue
    if (!Number.isFinite(value) || value < 0) throw new PmsDomainError(field.code, `${field.label}不能为负数`)
    row[field.key] = roundPmsQty(value, 2)
    row.missingCostFields = row.missingCostFields.filter((item) => item !== field.label)
  }
  if (patch.adjustment !== undefined) {
    if (!Number.isFinite(patch.adjustment)) throw new PmsDomainError('SUBJECT_ADJUSTMENT_INVALID', '调整金额必须是有效数字')
    row.adjustment = roundPmsQty(patch.adjustment, 2)
  }
  if (patch.allocatedCost !== undefined) {
    if (!Number.isFinite(patch.allocatedCost) || patch.allocatedCost < 0) throw new PmsDomainError('SUBJECT_ALLOCATED_INVALID', '费用分摊不能为负数')
    row.adjustment = roundPmsQty(patch.allocatedCost - (row.customsDuty + row.vat + row.clearanceFee), 2)
  }
  if (patch.revenueStatus !== undefined) {
    if (!(PMS_SUBJECT_REVENUE_STATUSES as readonly string[]).includes(patch.revenueStatus)) throw new PmsDomainError('SUBJECT_REVENUE_STATUS_INVALID', '收入状态不在允许范围')
    row.revenueStatus = patch.revenueStatus
  }
  if (patch.confirmedRevenue !== undefined) {
    if (patch.confirmedRevenue === null) {
      row.confirmedRevenue = null
    } else if (!Number.isFinite(patch.confirmedRevenue) || patch.confirmedRevenue < 0) {
      throw new PmsDomainError('SUBJECT_CONFIRMED_REVENUE_INVALID', '已确认收入金额不能为负数')
    } else {
      row.confirmedRevenue = roundPmsQty(patch.confirmedRevenue, 2)
    }
  }
  if (patch.remark !== undefined) row.remark = patch.remark.trim()
  recompute(row)
  row.updatedBy = actor.name
  row.updatedAt = new Date().toISOString()
  appendPmsLog({
    objectType: 'subject-operation',
    objectId: operationId,
    action: '调整经营明细',
    beforeValue: '',
    afterValue: `销售 ${row.salesAmount} · 成本明细 9 项 · 调整 ${row.adjustment} · 总成本 ${row.totalCost} · 毛利率 ${row.grossMargin}%`,
    reason: patch.remark ?? '',
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
  })
  return row
}
