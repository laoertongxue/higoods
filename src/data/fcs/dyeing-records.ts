import { listDyeWorkOrders, listDyeDispatchDocuments } from './dyeing-task-domain.ts'
import { ensureSpecialCraftRecords, hasSavedSpecialCraftCommand, runSpecialCraftRecordCommand } from './special-craft-records.ts'
import { withWashingStaticRead } from './fabric-washing-storage-bridge.ts'
import { isDesignRevisionFcsTarget } from './design-revision-pcs-storage.ts'
import { getCentralExecutionLedgerGuard } from './central-execution-record-bridge.ts'

/** Resolve original orders and every line of an actual dispatch. Codes/names/SKUs do not grant ownership. */
export function dyeingCommandOrders(target: unknown): string[] {
  return withWashingStaticRead(() => {
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
    if (await (await import('../pcs-record-runtime.ts')).refreshPcsRecordStateAfterExternalChange()) { await ensureSpecialCraftRecords(true); await (await import('./fabric-washing-repository.ts')).ensureWashingRecords(true) }
    return runSpecialCraftRecordCommand(target, recipe, operationId, intent, guards, 'process')
  }
  if (ids.some(isDesignRevisionFcsTarget)) return (await import('./printing-joint-records.ts')).runJoinedDyeingRecordCommand(target, ids, recipe, operationId, intent)
  const washing = await import('./fabric-washing-repository.ts'); await washing.ensureWashingRecords()
  const ledgerKey = 'higoods.formal-dye-execution.v1'
  const historical = ids.map(id => ({ id, owner: washing.getWashingProcessRecordGuard(ledgerKey, 'state.workOrders', id) })).filter(row => !!row.owner)
  if (historical.some(row => row.owner!.deleted || getCentralExecutionLedgerGuard(ledgerKey, 'state.workOrders', row.id))) throw new Error('加工单保存来源重复或已删除，请保留记录并重新核对。')
  if (historical.length) return washing.runWashingRecordCommand(recipe, operationId, intent, true, { target, guardKeys: guards })
  return runSpecialCraftRecordCommand(target, recipe, operationId, intent, guards, 'process')
}
