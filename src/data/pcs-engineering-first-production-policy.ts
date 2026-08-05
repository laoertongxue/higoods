// 首次正式生产策略：判断款式是否已形成正式生产事实，阻断非首次工程准备。

import { hasFormalProductionOrderFact } from './fcs/production-order-formal-fact-index.ts'
import type { EngineeringFirstProductionQualificationFact } from './pcs-engineering-master-types.ts'

// 正式生产事实：该 SPU 存在已转单需求，或存在非草稿、取消、挂起的正式生产单。
// 轻量索引不加载技术包快照，避免工程主单反向依赖自己的下游产物。
export function hasFormalProductionFact(styleCode: string): boolean {
  return hasFormalProductionOrderFact(styleCode)
}

// 首次工程准备属于款式级事实：该 SPU 此前从未形成过正式生产。
// 已正式生产过的款式禁止创建工程主单。
export function assertFirstFormalProduction(styleCode: string): void {
  if (hasFormalProductionFact(styleCode)) {
    throw new Error('该款式已经正式生产过，不属于首次工程准备，不能创建工程主单。')
  }
}

export function buildFirstProductionQualificationFact(input: {
  styleCode: string
  hasFormalSale: boolean | null
  formalSaleSource: string
  formalProductionSource?: string
  checkedAt: string
}): EngineeringFirstProductionQualificationFact {
  const styleCode = input.styleCode.trim()
  if (!styleCode) throw new Error('首单资格缺少目标 SPU。')
  return {
    styleCode,
    formalSaleStatus: input.hasFormalSale === null
      ? 'UNAVAILABLE'
      : input.hasFormalSale ? 'HAS_FORMAL_SALE' : 'NO_FORMAL_SALE',
    formalProductionStatus: hasFormalProductionFact(styleCode)
      ? 'HAS_FORMAL_PRODUCTION'
      : 'NO_FORMAL_PRODUCTION',
    formalSaleSource: input.formalSaleSource.trim(),
    formalProductionSource: input.formalProductionSource?.trim() || '正式生产单事实',
    checkedAt: input.checkedAt.trim(),
  }
}

// 首单必须同时满足“未正式售卖”和“未正式生产”。
// 两个事实均必须有权威来源；不可用、冲突或款式不一致时一律阻断。
export function assertFirstProductionQualification(
  styleCode: string,
  fact: EngineeringFirstProductionQualificationFact,
): void {
  const normalizedStyleCode = styleCode.trim()
  if (!fact || fact.styleCode.trim() !== normalizedStyleCode) {
    throw new Error('首单资格事实与目标 SPU 不一致，请跟单核实。')
  }
  if (!fact.checkedAt.trim() || !fact.formalSaleSource.trim() || !fact.formalProductionSource.trim()) {
    throw new Error('首单资格缺少权威来源或核查时间，禁止创建工程主单。')
  }
  if (fact.formalSaleStatus === 'UNAVAILABLE' || fact.formalProductionStatus === 'UNAVAILABLE') {
    throw new Error('首单资格权威来源暂不可用，请跟单核实后再创建。')
  }
  if (fact.formalSaleStatus === 'CONFLICT' || fact.formalProductionStatus === 'CONFLICT') {
    throw new Error('首单资格权威事实存在冲突，请跟单核实后再创建。')
  }
  if (fact.formalSaleStatus === 'HAS_FORMAL_SALE') {
    throw new Error('该款式已正式售卖过，不属于首单，不能创建工程主单。')
  }
  if (fact.formalProductionStatus === 'HAS_FORMAL_PRODUCTION' || hasFormalProductionFact(normalizedStyleCode)) {
    throw new Error('该款式已正式生产过，不属于首单，不能创建工程主单。')
  }
}
