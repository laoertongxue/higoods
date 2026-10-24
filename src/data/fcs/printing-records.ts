import { listPrintingWorkOrders, listPrintingDispatchDocuments, getPrintWorkOrderById } from './printing-task-domain.ts'
import { ensureSpecialCraftRecords, hasSavedSpecialCraftCommand, runSpecialCraftRecordCommand } from './special-craft-records.ts'
import { withFactoryProcessStaticRead } from './factory-process-storage.ts'
import { isDesignRevisionFcsTarget } from './design-revision-pcs-storage.ts'

/** Actual identities only. A factory name, code prefix, SKU or remark cannot acquire an order. */
export function printingCommandOrders(target: unknown): string[] {
  return withFactoryProcessStaticRead(() => {
    const values = new Set<string>(), visit = (v: unknown) => { if (typeof v === 'string') values.add(v); else if (Array.isArray(v)) v.forEach(visit); else if (v && typeof v === 'object') Object.values(v).forEach(visit) }; visit(target)
    const orders = listPrintingWorkOrders(), ids = new Set(orders.filter(o => { const raw = getPrintWorkOrderById(o.workOrderId); return [o.workOrderId, o.taskNo, raw?.taskId, raw?.handoverOrderId].some(id => !!id && values.has(id)) || o.barcodes.some(b => !!b.handoverRecordId && values.has(b.handoverRecordId)) }).map(o => o.workOrderId))
    for (const doc of listPrintingDispatchDocuments()) if (values.has(doc.id)) doc.lines.forEach(line => ids.add(line.workOrderId))
    return [...ids].sort()
  })
}
export const isPrintingRecordTarget = (target: unknown) => printingCommandOrders(target).length > 0
export async function runPrintingRecordCommand<T>(target: unknown, recipe: () => T, operationId: string = crypto.randomUUID(), intent: string = JSON.stringify(target)): Promise<T> {
  await ensureSpecialCraftRecords(true)
  const ids = printingCommandOrders(target)
  if (!ids.length) throw new Error('印花加工单不存在，请重新打开。')
  const guards = ids.map(id => 'print/' + id)
  if (hasSavedSpecialCraftCommand(operationId, intent)) {
    if(await(await import('../pcs-record-runtime.ts')).refreshPcsRecordStateAfterExternalChange()) await ensureSpecialCraftRecords(true)
    return runSpecialCraftRecordCommand(target, recipe, operationId, intent, guards, 'process')
  }
  if (ids.some(isDesignRevisionFcsTarget)) return (await import('./printing-joint-records.ts')).runJoinedPrintingRecordCommand(target,ids,recipe,operationId,intent)
  return runSpecialCraftRecordCommand(target, recipe, operationId, intent, guards, 'process')
}
