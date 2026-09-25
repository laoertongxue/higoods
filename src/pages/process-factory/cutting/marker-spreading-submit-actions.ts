import type { SpreadingStatusKey } from './marker-spreading-model.ts'

export interface MarkerSpreadingSubmitActionContext {
  action: string
  actionNode: HTMLElement
  saveSpreading: (goDetail: boolean, successMessage?: string) => boolean | Promise<boolean>
  completeSpreading: () => boolean | Promise<boolean>
  persistSpreadingStatus: (status: SpreadingStatusKey) => boolean | Promise<boolean>
}

export function handleMarkerSpreadingSubmitAction(context: MarkerSpreadingSubmitActionContext): boolean | Promise<boolean> {
  const { action, actionNode, saveSpreading, completeSpreading, persistSpreadingStatus } = context

  if (action === 'save-spreading') return saveSpreading(false)
  if (action === 'save-spreading-and-view') return saveSpreading(true)
  if (action === 'complete-spreading') return completeSpreading()
  if (action === 'set-spreading-status') {
    const nextStatus = actionNode.dataset.status as SpreadingStatusKey | undefined
    if (!nextStatus) return false
    return persistSpreadingStatus(nextStatus)
  }

  return false
}
