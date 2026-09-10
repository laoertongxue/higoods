import {
  assertSingleReceivingTarget,
  type ProcessOrderReceivingTargetSnapshot,
} from './process-order-flow-contract.ts'
import type { ProcessOrderTaskRelationView } from './process-order-task-links.ts'

export interface ProcessOrderTerminalReceivingTarget {
  targetBusinessId: string
  targetName: string
  targetFactoryId?: string
  targetFactoryName?: string
  targetWarehouseId: string
  targetWarehouseName: string
  resolvedFrom: string
}

function targetToken(value: string): string {
  return value.trim().replace(/[^A-Za-z0-9_-]/g, '-') || 'UNKNOWN'
}

/**
 * 解析没有直接下游加工单时的唯一收货对象。
 *
 * 这里仅生成业务目标，不读取或保存交出数量。首次有效交出后的冻结仍由
 * `freezeProcessOrderReceivingTarget()` 负责。
 */
export function resolveTerminalProcessOrderReceivingTarget(input: {
  sourceType: 'PRODUCTION_ORDER' | 'STOCK' | 'CUT_PIECE_SUPPLEMENT'
  productionOrderNo?: string
  supplementRecordId?: string
  supplementRecordNo?: string
  supplementConsumerId?: string
  supplementConsumerName?: string
  supplementWarehouseId?: string
  supplementWarehouseName?: string
}): ProcessOrderTerminalReceivingTarget {
  if (input.sourceType === 'STOCK') {
    return {
      targetBusinessId: 'CENTRAL-WAREHOUSE',
      targetName: '中央仓库',
      targetWarehouseId: 'CENTRAL-WAREHOUSE',
      targetWarehouseName: '中央仓库',
      resolvedFrom: '采购备货末道规则',
    }
  }

  if (input.sourceType === 'CUT_PIECE_SUPPLEMENT') {
    const supplementNo = input.supplementRecordNo?.trim() || input.supplementRecordId?.trim()
    const consumerName = input.supplementConsumerName?.trim() || (supplementNo ? `${supplementNo} 补料需求方` : '')
    const warehouseName = input.supplementWarehouseName?.trim() || (supplementNo ? `${supplementNo} 指定接收位置` : '')
    if (!consumerName || !warehouseName) throw new Error('补料加工单缺少指定需求方或接收位置，暂不能交出')
    return {
      targetBusinessId: input.supplementConsumerId?.trim() || `SUPPLEMENT-CONSUMER-${targetToken(supplementNo || consumerName)}`,
      targetName: consumerName,
      targetWarehouseId: input.supplementWarehouseId?.trim() || `SUPPLEMENT-WAREHOUSE-${targetToken(supplementNo || warehouseName)}`,
      targetWarehouseName: warehouseName,
      resolvedFrom: '补料单指定消费位置',
    }
  }

  const productionOrderNo = input.productionOrderNo?.trim()
  if (!productionOrderNo) throw new Error('生产来源末道加工单缺少生产单号，暂不能解析裁床配套中转仓')
  const token = targetToken(productionOrderNo)
  return {
    targetBusinessId: `CUTTING-${token}`,
    targetName: `${productionOrderNo} 裁床`,
    targetWarehouseId: `CUTTING-TRANSFER-WAREHOUSE-${token}`,
    targetWarehouseName: `${productionOrderNo} 配套中转仓`,
    resolvedFrom: '生产单裁床配套中转仓',
  }
}

function nowText(): string {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

export function resolveProcessOrderReceivingTarget(input: {
  relation: ProcessOrderTaskRelationView
  downstreamTargets: Array<ProcessOrderTerminalReceivingTarget & { downstreamOrderId: string; downstreamOrderNo: string; downstreamOccurrenceId?: string }>
  demandSourceType: 'PRODUCTION' | 'PURCHASE_STOCK' | 'SUPPLEMENT'
  terminalTarget?: ProcessOrderTerminalReceivingTarget
  resolvedAt?: string
}): ProcessOrderReceivingTargetSnapshot {
  const resolvedAt = input.resolvedAt || nowText()
  if (input.relation.successors.length > 0 || input.relation.pendingSuccessors.length > 0) {
    const expectedIds = new Set(input.relation.successors.map((document) => document.documentId))
    const candidates = input.downstreamTargets
      .filter((target) => expectedIds.has(target.downstreamOrderId))
      .map((target): ProcessOrderReceivingTargetSnapshot => ({
        targetType: 'DOWNSTREAM_PROCESS_ORDER',
        targetBusinessId: target.downstreamOrderId,
        targetName: target.targetName,
        targetFactoryId: target.targetFactoryId,
        targetFactoryName: target.targetFactoryName,
        targetWarehouseId: target.targetWarehouseId,
        targetWarehouseName: target.targetWarehouseName,
        downstreamOrderId: target.downstreamOrderId,
        downstreamOrderNo: target.downstreamOrderNo,
        downstreamOccurrenceId: target.downstreamOccurrenceId,
        resolvedFrom: target.resolvedFrom,
        resolvedAt,
      }))
    return assertSingleReceivingTarget(candidates)
  }

  if (!input.terminalTarget) throw new Error('末道加工单缺少需求来源对应的目标仓，暂不能交出')
  const targetType = input.demandSourceType === 'PRODUCTION'
    ? 'CUTTING_TRANSFER_WAREHOUSE'
    : input.demandSourceType === 'PURCHASE_STOCK'
      ? 'CENTRAL_WAREHOUSE'
      : 'SUPPLEMENT_CONSUMER'
  return {
    targetType,
    targetBusinessId: input.terminalTarget.targetBusinessId,
    targetName: input.terminalTarget.targetName,
    targetFactoryId: input.terminalTarget.targetFactoryId,
    targetFactoryName: input.terminalTarget.targetFactoryName,
    targetWarehouseId: input.terminalTarget.targetWarehouseId,
    targetWarehouseName: input.terminalTarget.targetWarehouseName,
    resolvedFrom: input.terminalTarget.resolvedFrom,
    resolvedAt,
  }
}
