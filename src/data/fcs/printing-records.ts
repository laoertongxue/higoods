import { listPrintingWorkOrders, listPrintingDispatchDocuments, getPrintWorkOrderById } from './printing-task-domain.ts'
import { ensureSpecialCraftRecords, hasSavedSpecialCraftCommand, runSpecialCraftRecordCommand } from './special-craft-records.ts'
import { withWashingStaticRead } from './fabric-washing-storage-bridge.ts'
import { isDesignRevisionFcsTarget } from './design-revision-pcs-storage.ts'
import { getCentralExecutionLedgerGuard } from './central-execution-record-bridge.ts'

/** Actual identities only. A factory name, code prefix, SKU or remark cannot acquire an order. */
export function printingCommandOrders(target: unknown): string[] {
  return withWashingStaticRead(() => {
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
    if(await(await import('../pcs-record-runtime.ts')).refreshPcsRecordStateAfterExternalChange()){await ensureSpecialCraftRecords(true);await(await import('./fabric-washing-repository.ts')).ensureWashingRecords(true)}
    return runSpecialCraftRecordCommand(target, recipe, operationId, intent, guards, 'process')
  }
  if (ids.some(isDesignRevisionFcsTarget)) return (await import('./printing-joint-records.ts')).runJoinedPrintingRecordCommand(target,ids,recipe,operationId,intent)
  const washing = await import('./fabric-washing-repository.ts'); await washing.ensureWashingRecords()
  const ledgerKey = 'higoods.formal-print-execution.v1'
  const historical = ids.map(id => ({ id, owner: washing.getWashingProcessRecordGuard(ledgerKey, 'state.workOrders', id) })).filter(row => !!row.owner)
  if (historical.some(row => row.owner!.deleted || getCentralExecutionLedgerGuard(ledgerKey, 'state.workOrders', row.id))) throw new Error('加工单保存来源重复或已删除，请保留记录并重新核对。')
  if (historical.length) return washing.runWashingRecordCommand(recipe, operationId, intent, true, {target,guardKeys:guards})
  return runSpecialCraftRecordCommand(target, recipe, operationId, intent, guards, 'process')
}
