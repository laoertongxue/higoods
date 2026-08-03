// 首次正式生产策略：判断款式是否已形成正式生产事实，阻断非首次工程准备。

import { hasFormalProductionOrderFact } from './fcs/production-order-formal-fact-index.ts'

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
