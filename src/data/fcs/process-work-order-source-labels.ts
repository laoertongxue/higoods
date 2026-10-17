import type { ProcessWorkOrderSourceType } from './process-work-order-domain.ts'

export const PROCESS_WORK_ORDER_SOURCE_LABEL: Record<ProcessWorkOrderSourceType, string> = {
  PRODUCTION_ORDER: '生产单自动生成',
  PRODUCTION_DEMAND: '生产需求单提前创建',
  STOCK: '备货手动创建',
  CUT_PIECE_SUPPLEMENT: '裁片补料生成',
  DESIGN_REVISION: '设计改款任务',
}
