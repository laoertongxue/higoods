// 首次正式生产策略：判断款式是否已形成正式生产事实，阻断非首次工程准备。

import { productionDemands } from './fcs/production-demands.ts'
import { productionOrders } from './fcs/production-orders.ts'

const NON_FORMAL_PRODUCTION_ORDER_STATUSES = ['DRAFT', 'CANCELLED', 'ON_HOLD']

// 正式生产事实：该 SPU 存在已转生产单的需求单，或存在非草稿、取消、挂起的正式生产单。
export function hasFormalProductionFact(styleCode: string): boolean {
  const hasConvertedDemand = productionDemands.some(
    (demand) => demand.spuCode === styleCode && (demand.demandStatus === 'CONVERTED' || demand.hasProductionOrder),
  )
  if (hasConvertedDemand) return true

  const hasFormalOrder = productionOrders.some(
    (order) =>
      order.demandSnapshot.spuCode === styleCode &&
      !NON_FORMAL_PRODUCTION_ORDER_STATUSES.includes(order.status),
  )
  return hasFormalOrder
}

// 首次工程准备属于款式级事实：该 SPU 此前从未形成过正式生产。
// 已正式生产过的款式禁止创建工程主单。
export function assertFirstFormalProduction(styleCode: string): void {
  if (hasFormalProductionFact(styleCode)) {
    throw new Error('该款式已经正式生产过，不属于首次工程准备，不能创建工程主单。')
  }
}
