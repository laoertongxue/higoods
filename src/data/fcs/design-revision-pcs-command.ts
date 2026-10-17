import { isDesignRevisionFcsTarget } from './design-revision-pcs-storage.ts'
/** Await only the synchronous business mutation; keep dialogs/input until commit. */
export async function runDesignRevisionFcsCommand<T>(target: unknown, recipe: () => T): Promise<T> {
  const { ensurePcsRecordState, runPcsRecordCommand } = await import('../pcs-record-runtime.ts')
  await ensurePcsRecordState()
  const { WOOL_DOMAIN_STORE_KEY, runWoolRecordCommand, readWoolStore } = await import('./wool-domain/store.ts')
  const { getSpecialCraftTaskOrderById } = await import('./special-craft-task-orders.ts')
  const matchesWool = (value: unknown): boolean => typeof value === 'string'
    ? value === WOOL_DOMAIN_STORE_KEY || value.startsWith('WSC:') || !!getSpecialCraftTaskOrderById(value)?.woolFinalInputOrderIds?.length || Object.values(readWoolStore().workOrders).some(order => [order.woolOrderId, order.sourceTaskId, order.taskId].includes(value))
    : Array.isArray(value) ? value.some(matchesWool) : !!value && typeof value === 'object' && Object.values(value).some(matchesWool)
  if (matchesWool(target)) return runWoolRecordCommand(recipe)
  const { ensureWashingRecords, runWashingRecordCommand } = await import('./fabric-washing-repository.ts')
  const { isWashingStorageTarget } = await import('./fabric-washing-storage-bridge.ts')
  await ensureWashingRecords()
  if (isWashingStorageTarget(target)) return runWashingRecordCommand(recipe, crypto.randomUUID(), JSON.stringify(target))
  return isDesignRevisionFcsTarget(target) ? runPcsRecordCommand(recipe) : recipe()
}
