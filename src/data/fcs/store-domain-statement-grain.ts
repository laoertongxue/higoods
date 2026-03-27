import { getFactoryByCode, getFactoryById } from './indonesia-factories.ts'
import { processTasks } from './process-tasks.ts'
import { getSettlementEffectiveInfoByFactory } from './settlement-change-requests.ts'
import { cycleTypeConfig, type CycleType } from './settlement-types.ts'

export type StatementPricingSourceType = 'DISPATCH' | 'BIDDING' | 'NONE'

export interface StatementCycleFields {
  settlementCycleId: string
  settlementCycleLabel: string
  settlementCycleStartAt: string
  settlementCycleEndAt: string
}

export interface StatementPricingFields {
  pricingSourceType: StatementPricingSourceType
  pricingSourceRefId?: string
  settlementUnitPrice?: number
  earningAmount: number
}

function parseDateText(dateText?: string): Date {
  if (!dateText) return new Date('2026-03-01T00:00:00')
  const normalized = dateText.length > 10 ? dateText.replace(' ', 'T') : `${dateText}T00:00:00`
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return new Date('2026-03-01T00:00:00')
  return date
}

function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getMonthLastDate(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

function resolveSettlementFactoryKey(settlementPartyId: string): string | null {
  if (getSettlementEffectiveInfoByFactory(settlementPartyId)) return settlementPartyId
  const factoryById = getFactoryById(settlementPartyId)
  if (factoryById?.code && getSettlementEffectiveInfoByFactory(factoryById.code)) return factoryById.code
  const factoryByCode = getFactoryByCode(settlementPartyId)
  if (factoryByCode?.code && getSettlementEffectiveInfoByFactory(factoryByCode.code)) return factoryByCode.code
  return null
}

function resolveSettlementCycleType(settlementPartyId: string): CycleType {
  const factoryKey = resolveSettlementFactoryKey(settlementPartyId)
  return factoryKey
    ? (getSettlementEffectiveInfoByFactory(factoryKey)?.settlementConfigSnapshot.cycleType ?? 'WEEKLY')
    : 'WEEKLY'
}

export function deriveSettlementCycleFields(
  settlementPartyId: string,
  referenceAt?: string,
): StatementCycleFields {
  const cycleType = resolveSettlementCycleType(settlementPartyId)
  const date = parseDateText(referenceAt)
  let start = new Date(date)
  let end = new Date(date)

  if (cycleType === 'WEEKLY') {
    const day = date.getDay()
    const diffToMonday = (day + 6) % 7
    start = new Date(date)
    start.setDate(date.getDate() - diffToMonday)
    end = new Date(start)
    end.setDate(start.getDate() + 6)
  } else if (cycleType === 'BIWEEKLY') {
    const isFirstHalf = date.getDate() <= 14
    start = new Date(date.getFullYear(), date.getMonth(), isFirstHalf ? 1 : 15)
    end = isFirstHalf ? new Date(date.getFullYear(), date.getMonth(), 14) : getMonthLastDate(date)
  } else if (cycleType === 'MONTHLY') {
    start = new Date(date.getFullYear(), date.getMonth(), 1)
    end = getMonthLastDate(date)
  }

  const startAt = formatDate(start)
  const endAt = formatDate(end)
  const cycleLabel = `${cycleTypeConfig[cycleType].label} ${startAt} ~ ${endAt}`

  return {
    settlementCycleId: `${settlementPartyId}-${cycleType}-${startAt}`,
    settlementCycleLabel: cycleLabel,
    settlementCycleStartAt: startAt,
    settlementCycleEndAt: endAt,
  }
}

export function deriveTaskPricingFields(taskId: string | undefined, qty: number): StatementPricingFields {
  if (!taskId) {
    return {
      pricingSourceType: 'NONE',
      earningAmount: 0,
    }
  }

  const task = processTasks.find((item) => item.taskId === taskId)
  if (!task) {
    return {
      pricingSourceType: 'NONE',
      pricingSourceRefId: taskId,
      earningAmount: 0,
    }
  }

  const settlementUnitPrice = task.dispatchPrice ?? task.standardPrice
  if (!settlementUnitPrice) {
    return {
      pricingSourceType: 'NONE',
      pricingSourceRefId: task.taskId,
      earningAmount: 0,
    }
  }

  return {
    pricingSourceType: task.assignmentMode === 'BIDDING' ? 'BIDDING' : 'DISPATCH',
    pricingSourceRefId: task.taskId,
    settlementUnitPrice,
    earningAmount: Number((settlementUnitPrice * qty).toFixed(2)),
  }
}
