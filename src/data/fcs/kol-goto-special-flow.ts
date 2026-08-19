import {
  KOL_GOTO_FACTORY_CODE,
  KOL_GOTO_FACTORY_ID,
} from './factory-mock-data.ts'
import {
  productionOrders,
  type ProductionOrder,
} from './production-orders.ts'
import {
  KOL_GOTO_SALE_TYPES,
  isKolGotoSaleType,
  type KolGotoSaleType,
} from './production-demands.ts'

export { KOL_GOTO_SALE_TYPES, isKolGotoSaleType, type KolGotoSaleType }

export const KOL_GOTO_WHOLE_ORDER_FIXED_TOTAL_PRICE_IDR = 1_500_000
export const KOL_GOTO_WHOLE_ORDER_PROCESS_CODE = 'WHOLE_ORDER_TASK'
export const KOL_GOTO_WHOLE_ORDER_TASK_NAME = 'KOL整单任务'

export function normalizeKolGotoFactoryId(value: unknown): string | null {
  if (value === KOL_GOTO_FACTORY_ID || value === KOL_GOTO_FACTORY_CODE) return KOL_GOTO_FACTORY_ID
  return null
}

export function isKolGotoFactory(value: unknown): boolean {
  return normalizeKolGotoFactoryId(value) === KOL_GOTO_FACTORY_ID
}

export function isKolGotoProductionOrder(
  order: Pick<ProductionOrder, 'sourceDemandSnapshots' | 'mainFactoryId'> | null | undefined,
): boolean {
  return Boolean(
    order
    && isKolGotoFactory(order.mainFactoryId)
    && order.sourceDemandSnapshots.length > 0
    && order.sourceDemandSnapshots.every((snapshot) => isKolGotoSaleType(snapshot.saleType)),
  )
}

export function getKolGotoProductionOrderById(productionOrderId: string | null | undefined): ProductionOrder | null {
  if (!productionOrderId) return null
  return productionOrders.find((order) => order.productionOrderId === productionOrderId) ?? null
}

export interface KolGotoWholeOrderTaskLike {
  productionOrderId?: string
  taskUnitType?: string
  processCode?: string
  processBusinessCode?: string
  assignedFactoryId?: string
}

export function isKolGotoWholeOrderTask(
  task: KolGotoWholeOrderTaskLike | null | undefined,
  order: Pick<ProductionOrder, 'sourceDemandSnapshots' | 'mainFactoryId'> | null | undefined = task
    ? getKolGotoProductionOrderById(task.productionOrderId)
    : null,
): boolean {
  return Boolean(
    task
    && task.taskUnitType === 'WHOLE_ORDER_TASK'
    && task.processCode === KOL_GOTO_WHOLE_ORDER_PROCESS_CODE
    && task.processBusinessCode === KOL_GOTO_WHOLE_ORDER_PROCESS_CODE
    && isKolGotoFactory(task.assignedFactoryId)
    && isKolGotoProductionOrder(order),
  )
}

export function assertKolGotoWholeOrderTask(
  task: KolGotoWholeOrderTaskLike | null | undefined,
  actionLabel: string,
): asserts task is KolGotoWholeOrderTaskLike {
  if (!isKolGotoWholeOrderTask(task)) {
    throw new Error(`${actionLabel}仅允许 KOL-GOTO 整单任务执行`)
  }
}
