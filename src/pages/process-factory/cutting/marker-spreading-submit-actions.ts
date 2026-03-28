import type { SpreadingStatusKey } from './marker-spreading-model'

export interface MarkerSpreadingSubmitActionContext {
  action: string
  actionNode: HTMLElement
  saveMarker: (goDetail: boolean) => boolean
  saveSpreading: (goDetail: boolean, successMessage?: string) => boolean
  completeSpreading: () => boolean
  persistSpreadingStatus: (status: SpreadingStatusKey) => boolean
}

export function handleMarkerSpreadingSubmitAction(context: MarkerSpreadingSubmitActionContext): boolean {
  const { action, actionNode, saveMarker, saveSpreading, completeSpreading, persistSpreadingStatus } = context

  if (action === 'save-marker') return saveMarker(false)
  if (action === 'save-marker-and-view') return saveMarker(true)
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
