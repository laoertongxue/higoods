import { isDesignRevisionFcsTarget } from './design-revision-pcs-storage.ts'
/** Await only the synchronous business mutation; keep dialogs/input until commit. */
export async function runDesignRevisionFcsCommand<T>(target: unknown, recipe: () => T): Promise<T> {
  const { ensurePcsRecordState, runPcsRecordCommand } = await import('../pcs-record-runtime.ts')
  await ensurePcsRecordState()
  const { ensureWashingRecords, runWashingRecordCommand } = await import('./fabric-washing-repository.ts')
  const { isWashingStorageTarget } = await import('./fabric-washing-storage-bridge.ts')
  await ensureWashingRecords()
  if (isWashingStorageTarget(target)) return runWashingRecordCommand(recipe, crypto.randomUUID(), JSON.stringify(target))
  return isDesignRevisionFcsTarget(target) ? runPcsRecordCommand(recipe) : recipe()
}
