import type { ProductionOrder } from './production-orders.ts'

export type ProductionOrderTaskBoundaryKind =
  | 'WHOLE_ORDER'
  | 'SEWING_IRON_PACK'
  | 'CUTTING_SEWING_IRON_PACK'
  | 'INDEPENDENT_CUTTING'
  | 'INDEPENDENT_NON_CUTTING'

export interface ProductionOrderTaskBoundary {
  kind: ProductionOrderTaskBoundaryKind
  label: string
  generateCutOrder: boolean
  generateInternalCraftOrder: boolean
  cutOrderSourceLabel: string
  cutReturnModeLabel: string
  internalCraftPolicyLabel: string
}

const CUTTING_PROCESS_NAMES = ['裁片', '裁剪', '定位裁（激光切）', '裁床', 'CUTTING', 'CUT_PANEL']

function hasIndependentCuttingProcess(order: ProductionOrder): boolean {
  const names = [
    ...(order.taskBreakdownSummary.coveredProcessNames ?? []),
    ...order.taskBreakdownSummary.taskTypesTop3,
  ]
  return names.some((name) => CUTTING_PROCESS_NAMES.some((token) => name.includes(token)))
}

export function resolveProductionOrderTaskBoundary(order: ProductionOrder): ProductionOrderTaskBoundary {
  const summary = order.taskBreakdownSummary

  if ((summary.wholeOrderTaskCount ?? 0) > 0) {
    return {
      kind: 'WHOLE_ORDER',
      label: '整单任务',
      generateCutOrder: false,
      generateInternalCraftOrder: false,
      cutOrderSourceLabel: '不生成裁片单',
      cutReturnModeLabel: '整单工厂内部处理',
      internalCraftPolicyLabel: '不生成中央辅助/特种工艺加工单',
    }
  }

  if (summary.mergedTaskType === 'SEWING_IRON_PACK') {
    return {
      kind: 'SEWING_IRON_PACK',
      label: '车缝+烫包',
      generateCutOrder: hasIndependentCuttingProcess(order),
      generateInternalCraftOrder: true,
      cutOrderSourceLabel: '裁剪仍按独立责任生成',
      cutReturnModeLabel: '裁片回我方裁床待交出仓',
      internalCraftPolicyLabel: '中央辅助/特种工艺加工单继续生成',
    }
  }

  if (summary.mergedTaskType === 'CUTTING_SEWING_IRON_PACK') {
    return {
      kind: 'CUTTING_SEWING_IRON_PACK',
      label: '裁剪+车缝+烫包',
      generateCutOrder: true,
      generateInternalCraftOrder: false,
      cutOrderSourceLabel: '保留三方裁剪执行所需裁片单和唛架依据',
      cutReturnModeLabel: '三方工厂上报裁片完成',
      internalCraftPolicyLabel: '辅助/特种工艺随合并任务交三方，不生成中央加工单',
    }
  }

  const hasCutting = hasIndependentCuttingProcess(order)
  return {
    kind: hasCutting ? 'INDEPENDENT_CUTTING' : 'INDEPENDENT_NON_CUTTING',
    label: hasCutting ? '独立裁剪任务' : '独立非裁剪任务',
    generateCutOrder: hasCutting,
    generateInternalCraftOrder: hasCutting,
    cutOrderSourceLabel: hasCutting ? '独立裁剪任务' : '不生成裁片单',
    cutReturnModeLabel: hasCutting ? '回我方裁床待交出仓' : '不涉及裁片',
    internalCraftPolicyLabel: hasCutting ? '按中央辅助/特种工艺要求生成加工单' : '按任务自身规则',
  }
}

export function shouldGenerateCutOrderForProductionOrder(order: ProductionOrder): boolean {
  return resolveProductionOrderTaskBoundary(order).generateCutOrder
}

export function shouldGenerateInternalCraftOrderForProductionOrder(order: ProductionOrder): boolean {
  return resolveProductionOrderTaskBoundary(order).generateInternalCraftOrder
}
