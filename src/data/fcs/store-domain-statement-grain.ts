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
  plannedPrepaymentAt: string
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

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function getNextMonthDate(date: Date, targetDay: number): Date {
  const year = date.getFullYear()
  const nextMonth = date.getMonth() + 1
  const nextMonthLast = new Date(year, nextMonth + 1, 0).getDate()
  return new Date(year, nextMonth, Math.min(targetDay, nextMonthLast))
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
  if (factoryKey) {
    return getSettlementEffectiveInfoByFactory(factoryKey)?.settlementConfigSnapshot.cycleType ?? 'WEEKLY'
  }

  const factory = getFactoryById(settlementPartyId) ?? getFactoryByCode(settlementPartyId)
  return factory?.tier === 'THIRD_PARTY' ? 'TRI_DECAD' : 'WEEKLY'
}

export function deriveSettlementCycleFields(
  settlementPartyId: string,
  referenceAt?: string,
): StatementCycleFields {
  const cycleType = resolveSettlementCycleType(settlementPartyId)
  const date = parseDateText(referenceAt)
  let start = new Date(date)
  let end = new Date(date)
  let plannedPrepaymentAt: string | undefined

  if (cycleType === 'WEEKLY') {
    const day = date.getDay()
    const diffToMonday = (day + 6) % 7
    start = new Date(date)
    start.setDate(date.getDate() - diffToMonday)
    end = new Date(start)
    end.setDate(start.getDate() + 6)
    plannedPrepaymentAt = formatDate(addDays(end, 3))
  } else if (cycleType === 'BIWEEKLY') {
    const isFirstHalf = date.getDate() <= 14
    start = new Date(date.getFullYear(), date.getMonth(), isFirstHalf ? 1 : 15)
    end = isFirstHalf ? new Date(date.getFullYear(), date.getMonth(), 14) : getMonthLastDate(date)
    plannedPrepaymentAt = formatDate(addDays(end, 10))
  } else if (cycleType === 'MONTHLY') {
    start = new Date(date.getFullYear(), date.getMonth(), 1)
    end = getMonthLastDate(date)
    plannedPrepaymentAt = formatDate(getNextMonthDate(date, 10))
  } else if (cycleType === 'TRI_DECAD') {
    const day = date.getDate()
    if (day <= 10) {
      start = new Date(date.getFullYear(), date.getMonth(), 1)
      end = new Date(date.getFullYear(), date.getMonth(), 10)
      plannedPrepaymentAt = formatDate(getNextMonthDate(date, 10))
    } else if (day <= 20) {
      start = new Date(date.getFullYear(), date.getMonth(), 11)
      end = new Date(date.getFullYear(), date.getMonth(), 20)
      plannedPrepaymentAt = formatDate(getNextMonthDate(date, 20))
    } else {
      start = new Date(date.getFullYear(), date.getMonth(), 21)
      end = getMonthLastDate(date)
      plannedPrepaymentAt = formatDate(getNextMonthDate(date, 30))
    }
  }

  const startAt = formatDate(start)
  const endAt = formatDate(end)
  const paymentAt = plannedPrepaymentAt ?? formatDate(addDays(end, 10))
  const cycleLabel = `${cycleTypeConfig[cycleType].label} ${startAt} ~ ${endAt}`

  return {
    settlementCycleId: `${settlementPartyId}-${cycleType}-${startAt}`,
    settlementCycleLabel: cycleLabel,
    settlementCycleStartAt: startAt,
    settlementCycleEndAt: endAt,
    plannedPrepaymentAt: paymentAt,
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
