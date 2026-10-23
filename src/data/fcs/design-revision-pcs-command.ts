import { isDesignRevisionFcsTarget } from './design-revision-pcs-storage.ts'
/** Await only the synchronous business mutation; keep dialogs/input until commit. */
export async function runDesignRevisionFcsCommand<T>(target: unknown, recipe: () => T): Promise<T> {
  const { ensurePcsRecordState, runPcsRecordCommand } = await import('../pcs-record-runtime.ts')
  await ensurePcsRecordState()
  const possiblePrintTarget = (value: unknown): boolean => typeof value === 'string'
    ? /PRINT|^(?:PWO-|PH-|SJ-|HO-|HOH-|HOTASK|HDR-)/.test(value)
    : Array.isArray(value) ? value.some(possiblePrintTarget)
      : !!value && typeof value === 'object' && Object.values(value).some(possiblePrintTarget)
  if (possiblePrintTarget(target)) {
    await (await import('./cutting/part-ticket-records.ts')).hydratePartTicketRecords()
    const print = await import('./printing-records.ts')
    if (print.isPrintingRecordTarget(target)) return print.runPrintingRecordCommand(target, recipe)
  }
  const possibleWaterTarget = (value: unknown): boolean => typeof value === 'string'
    ? /^(?:WATER-|TASK-WATER-|TASK-SR-|SJ-SR-|HO-|HOH-|HOTASK|HDR-)/.test(value)
    : Array.isArray(value) ? value.some(possibleWaterTarget)
      : !!value && typeof value === 'object' && Object.values(value).some(possibleWaterTarget)
  if (possibleWaterTarget(target)) {
    const water = await import('./water-soluble-records.ts')
    if (water.isWaterSolubleRecordTarget(target)) return water.runWaterSolubleRecordCommand(target, recipe)
  }
  const { WOOL_DOMAIN_STORE_KEY, runWoolRecordCommand, readWoolStore } = await import('./wool-domain/store.ts')
  const { getSpecialCraftTaskOrderById } = await import('./special-craft-task-orders.ts')
  const { getFactoryReceivingSource } = await import('./factory-receiving.ts')
  const matchesWool = (value: unknown): boolean => typeof value === 'string'
    ? value === WOOL_DOMAIN_STORE_KEY || value.startsWith('WSC:') || !!getSpecialCraftTaskOrderById(value)?.woolFinalInputOrderIds?.length || !!getFactoryReceivingSource(value)?.lines.some(line=>!!line.woolOrderId||!!line.woolCraftOrderId||line.material.kind==='WOOL_PIECE') || Object.values(readWoolStore().workOrders).some(order => [order.woolOrderId, order.sourceTaskId, order.taskId].includes(value))
    : Array.isArray(value) ? value.some(matchesWool) : !!value && typeof value === 'object' && Object.values(value).some(matchesWool)
  if (matchesWool(target)) return runWoolRecordCommand(recipe)
  const matchesSpecialCraft = (value: unknown): boolean => {
    if (typeof value === 'string') {
      const order = getSpecialCraftTaskOrderById(value)
      return !!order && !order.woolPieceKey && !order.woolFinalInputOrderIds?.length
    }
    return Array.isArray(value) ? value.some(matchesSpecialCraft)
      : !!value && typeof value === 'object' && Object.values(value).some(matchesSpecialCraft)
  }
  const storageBridge = await import('./fabric-washing-storage-bridge.ts')
  if (matchesSpecialCraft(target) || storageBridge.isSpecialCraftStorageTarget(target)) {
    return (await import('./special-craft-records.ts')).runSpecialCraftRecordCommand(target, recipe)
  }
  const { ensureWashingRecords, runWashingRecordCommand } = await import('./fabric-washing-repository.ts')
  const { isWashingStorageTarget } = await import('./fabric-washing-storage-bridge.ts')
  await ensureWashingRecords()
  if (isWashingStorageTarget(target)) return runWashingRecordCommand(recipe, crypto.randomUUID(), JSON.stringify(target))
  return isDesignRevisionFcsTarget(target) ? runPcsRecordCommand(recipe) : recipe()
}
