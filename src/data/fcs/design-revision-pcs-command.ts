import { isDesignRevisionFcsTarget } from './design-revision-pcs-storage.ts'
/** Await only the synchronous business mutation; keep dialogs/input until commit. */
export async function runDesignRevisionFcsCommand<T>(target: unknown, recipe: () => T): Promise<T> {
  const { ensurePcsRecordState, runPcsRecordCommand } = await import('../pcs-record-runtime.ts')
  await ensurePcsRecordState()
  return isDesignRevisionFcsTarget(target) ? runPcsRecordCommand(recipe) : recipe()
}
