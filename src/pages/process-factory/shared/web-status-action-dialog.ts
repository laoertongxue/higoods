import { runDesignRevisionFcsCommand } from '../../../data/fcs/design-revision-pcs-command.ts'
import { executeProcessWebAction } from '../../../data/fcs/process-web-status-actions.ts'
import { closeProcessWebStatusActionDialog, confirmProcessWebStatusActionWith, type ProcessWebStatusActionDialogCallbacks } from './web-status-action-dialog-view.ts'
export { closeProcessWebStatusActionDialog, isQuantityField, getDefaultFieldValue, openProcessWebStatusActionDialog, collectProcessWebStatusActionFields } from './web-status-action-dialog-view.ts'
export type { ProcessWebStatusActionDialogConfig, ProcessWebStatusActionDialogCallbacks } from './web-status-action-dialog-view.ts'

export function handleProcessWebStatusActionDialogEvent(
  target: HTMLElement,
  callbacks: ProcessWebStatusActionDialogCallbacks,
): boolean | null {
  const actionNode = target.closest<HTMLElement>('[data-process-web-status-action]')
  if (!actionNode) return null
  const action = actionNode.dataset.processWebStatusAction
  if (action === 'close') {
    closeProcessWebStatusActionDialog()
    return false
  }
  if (action === 'confirm') {
    return confirmProcessWebStatusAction(callbacks)
  }
  return null
}

export function confirmProcessWebStatusAction(callbacks: ProcessWebStatusActionDialogCallbacks): boolean {
  return confirmProcessWebStatusActionWith(callbacks, executeProcessWebAction) as boolean
}

export async function handlePersistedProcessWebStatusActionDialogEvent(target: HTMLElement, callbacks: ProcessWebStatusActionDialogCallbacks): Promise<boolean | null> {
  if (target.closest<HTMLElement>('[data-process-web-status-action]')?.dataset.processWebStatusAction === 'confirm') {
    return confirmProcessWebStatusActionWith(callbacks, input => runDesignRevisionFcsCommand(input, () => executeProcessWebAction(input)))
  }
  return handleProcessWebStatusActionDialogEvent(target, callbacks)
}
