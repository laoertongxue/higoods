/**
 * Legacy WMS Picking 模块
 * 提供配料单相关类型和辅助方法
 */

// 重导出类型
export type {
  PickingStatus,
  ShortageReasonCode,
  PickingLine,
  PickingOrder,
  PoSummary,
} from './utils/makeLegacyWmsPicking'

// 导入生成器
import {
  makePickingOrdersForPo,
  makePickingLines,
  makePoSummary,
  makePoList,
  type PickingOrder,
  type PickingLine,
  type PoSummary,
  type PickingStatus,
} from './utils/makeLegacyWmsPicking'

// 重导出生成器
export { makePickingOrdersForPo, makePickingLines, makePoSummary, makePoList }

/**
 * 获取生产单的配料单列表
 */
export function getPickingOrdersByPo(poId: string): PickingOrder[] {
  return makePickingOrdersForPo(poId)
}

/**
 * 根据 pickId 获取配料单明细行
 */
export function getPickingLinesByPickId(pickId: string): PickingLine[] {
  return makePickingLines(pickId)
}

/**
 * 获取生产单摘要
 */
export function getPoSummaryById(poId: string): PoSummary {
  return makePoSummary(poId)
}

/**
 * 根据 pickId 获取配料单
 */
export function getPickingOrderById(pickId: string, poId: string): PickingOrder | undefined {
  const orders = makePickingOrdersForPo(poId)
  return orders.find(o => o.pickId === pickId)
}

/**
 * 获取缺口汇总（shortQty > 0 的行）
 */
export function getShortageSummaryByPo(poId: string): PickingLine[] {
  const orders = makePickingOrdersForPo(poId)
  const allLines: PickingLine[] = []
  
  for (const order of orders) {
    const lines = makePickingLines(order.pickId)
    allLines.push(...lines.filter(l => l.shortQty > 0))
  }
  
  return allLines
}

/**
 * 模拟 PO 列表（用于选择器）- 旧版兼容
 */
export function getMockPoList(): { poId: string; label: string }[] {
  const poList = makePoList()
  return poList.map(po => ({
    poId: po.poId,
    label: `${po.poId} (${po.spuName})`,
  }))
}

/**
 * 获取生产单列表（至少20个PO）
 */
export function getPoList(): PoSummary[] {
  return makePoList()
}

/**
 * 物料进度汇总信息
 */
export interface MaterialProgress {
  readinessStatus: PoSummary['materialReadyStatus']
  fulfillmentRate: number
  shortLineCount: number
  latestPickStatus: PickingStatus | null
  latestUpdatedAt: string | null
}

/**
 * 获取单个PO的物料进度汇总
 * 口径计算：
 * - readinessStatus: 无配料单=>NOT_CREATED, 任一PICKING=>PICKING, 有缺口=>PARTIAL, 全COMPLETED且无缺口=>COMPLETED, 否则=>CREATED
 * - fulfillmentRate: sum(min(picked, required)) / sum(required)
 * - shortLineCount: 所有配料单明细行中 shortQty>0 的合计行数
 * - latestPickStatus: updatedAt 最新的配料单状态
 * - latestUpdatedAt: 最新配料单的 updatedAt
 */
export function getMaterialProgressByPo(poId: string): MaterialProgress {
  const orders = makePickingOrdersForPo(poId)
  
  // 无配料单
  if (orders.length === 0) {
    return {
      readinessStatus: 'NOT_CREATED',
      fulfillmentRate: 0,
      shortLineCount: 0,
      latestPickStatus: null,
      latestUpdatedAt: null,
    }
  }
  
  // 收集所有明细行
  let totalRequired = 0
  let totalPicked = 0
  let shortLineCount = 0
  
  for (const order of orders) {
    const lines = makePickingLines(order.pickId)
    for (const line of lines) {
      totalRequired += line.requiredQty
      totalPicked += Math.min(line.pickedQty, line.requiredQty)
      if (line.shortQty > 0) {
        shortLineCount++
      }
    }
  }
  
  // 计算配齐率
  const fulfillmentRate = totalRequired > 0 ? Math.round((totalPicked / totalRequired) * 100) : 0
  
  // 找最新更新的配料单
  const sortedOrders = [...orders].sort((a, b) => 
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )
  const latestOrder = sortedOrders[0]
  
  // 计算就绪状态
  const hasPicking = orders.some(o => o.status === 'PICKING')
  const allCompleted = orders.every(o => o.status === 'COMPLETED')
  const hasShortage = shortLineCount > 0
  
  let readinessStatus: PoSummary['materialReadyStatus'] = 'CREATED'
  if (hasPicking) {
    readinessStatus = 'PICKING'
  } else if (hasShortage) {
    readinessStatus = 'PARTIAL'
  } else if (allCompleted) {
    readinessStatus = 'COMPLETED'
  }
  
  return {
    readinessStatus,
    fulfillmentRate,
    shortLineCount,
    latestPickStatus: latestOrder.status,
    latestUpdatedAt: latestOrder.updatedAt,
  }
}
