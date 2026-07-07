import type { ProductionOrder } from './production-orders.ts'

export type ProductionOrderTaskBoundaryKind =
  | 'WHOLE_ORDER'
  | 'CONTINUOUS_WITH_CUTTING'
  | 'CONTINUOUS_WITHOUT_CUTTING'
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

const CUTTING_PROCESS_NAMES = ['裁片', '裁剪', '定位裁', '裁床']

function hasCuttingProcess(names: string[] = []): boolean {
  return names.some((name) => CUTTING_PROCESS_NAMES.some((processName) => name.includes(processName)))
}

export function resolveProductionOrderTaskBoundary(order: ProductionOrder): ProductionOrderTaskBoundary {
  const summary = order.taskBreakdownSummary
  const hasCutting = hasCuttingProcess(summary.coveredProcessNames)

  if ((summary.wholeOrderTaskCount ?? 0) > 0) {
    return {
      kind: 'WHOLE_ORDER',
      label: '整单任务',
      generateCutOrder: false,
      generateInternalCraftOrder: false,
      cutOrderSourceLabel: '不生成裁片单',
      cutReturnModeLabel: '整单工厂内部处理',
      internalCraftPolicyLabel: '不生成我方加工单',
    }
  }

  if ((summary.combinedProcessTaskCount ?? 0) > 0) {
    return {
      kind: hasCutting ? 'CONTINUOUS_WITH_CUTTING' : 'CONTINUOUS_WITHOUT_CUTTING',
      label: hasCutting ? '含裁片连续工序任务' : '不含裁片连续工序任务',
      generateCutOrder: hasCutting,
      generateInternalCraftOrder: false,
      cutOrderSourceLabel: hasCutting ? '含裁片连续任务' : '不生成裁片单',
      cutReturnModeLabel: hasCutting ? '三方上报裁片完成' : '不涉及裁片',
      internalCraftPolicyLabel: '不生成我方加工单',
    }
  }

  return {
    kind: hasCutting ? 'INDEPENDENT_CUTTING' : 'INDEPENDENT_NON_CUTTING',
    label: hasCutting ? '独立裁片任务' : '独立非裁片任务',
    generateCutOrder: hasCutting,
    generateInternalCraftOrder: hasCutting,
    cutOrderSourceLabel: hasCutting ? '独立裁片任务' : '不生成裁片单',
    cutReturnModeLabel: hasCutting ? '回我方裁床待交出仓' : '不涉及裁片',
    internalCraftPolicyLabel: hasCutting ? '回仓后生成我方加工单' : '按工序自身规则',
  }
}

export function shouldGenerateCutOrderForProductionOrder(order: ProductionOrder): boolean {
  return resolveProductionOrderTaskBoundary(order).generateCutOrder
}

export function shouldGenerateInternalCraftOrderForProductionOrder(order: ProductionOrder): boolean {
  return resolveProductionOrderTaskBoundary(order).generateInternalCraftOrder
}
