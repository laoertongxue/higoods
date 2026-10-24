import { listDyeWorkOrders, listDyeDispatchDocuments } from './dyeing-task-domain.ts'
import { ensureSpecialCraftRecords, hasSavedSpecialCraftCommand, runSpecialCraftRecordCommand } from './special-craft-records.ts'
import { withFactoryProcessStaticRead } from './factory-process-storage.ts'
import { isDesignRevisionFcsTarget } from './design-revision-pcs-storage.ts'

/** Resolve original orders and every line of an actual dispatch. Codes/names/SKUs do not grant ownership. */
export function dyeingCommandOrders(target: unknown): string[] {
  return withFactoryProcessStaticRead(() => {
    const values = new Set<string>(), visit = (value: unknown) => { if (typeof value === 'string') values.add(value); else if (Array.isArray(value)) value.forEach(visit); else if (value && typeof value === 'object') Object.values(value).forEach(visit) }; visit(target)
    const ids = new Set(listDyeWorkOrders().filter(order => [order.dyeOrderId, order.taskId, order.handoverOrderId].some(id => !!id && values.has(id))).map(order => order.dyeOrderId))
    for (const doc of listDyeDispatchDocuments()) if (values.has(doc.id)) doc.lines.forEach(line => ids.add(line.orderId))
    return [...ids].sort()
  })
}
export async function runDyeingRecordCommand<T>(target: unknown, recipe: () => T, operationId: string, intent: string): Promise<T> {
  await ensureSpecialCraftRecords(true)
  const ids = dyeingCommandOrders(target)
  if (!ids.length) throw new Error('染色加工单不存在，请重新打开。')
  const guards = ids.map(id => 'dye/' + id)
  if (hasSavedSpecialCraftCommand(operationId, intent)) {
    if (await (await import('../pcs-record-runtime.ts')).refreshPcsRecordStateAfterExternalChange()) await ensureSpecialCraftRecords(true)
    return runSpecialCraftRecordCommand(target, recipe, operationId, intent, guards, 'process')
  }
  if (ids.some(isDesignRevisionFcsTarget)) return (await import('./printing-joint-records.ts')).runJoinedDyeingRecordCommand(target, ids, recipe, operationId, intent)
  return runSpecialCraftRecordCommand(target, recipe, operationId, intent, guards, 'process')
}
