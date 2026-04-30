import { appStore } from '../../../state/store'
import {
  handleProcessWebStatusActionDialogEvent,
  openProcessWebStatusActionDialog,
} from '../shared/web-status-action-dialog.ts'

function showPostFinishingToast(message: string): void {
  if (typeof document === 'undefined') return
  const root = document.getElementById('post-finishing-page-toast-root') || document.body
  const toast = document.createElement('div')
  toast.className = 'fixed right-4 top-4 z-[180] rounded-md border bg-background px-3 py-2 text-sm shadow-lg'
  toast.textContent = message
  root.appendChild(toast)
  window.setTimeout(() => toast.remove(), 2400)
}

function refreshCurrentPage(): void {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  url.searchParams.set('actionResultAt', String(Date.now()))
  window.history.replaceState(null, '', `${url.pathname}${url.search}`)
  appStore.navigate(`${url.pathname}${url.search}`)
}

export function handlePostFinishingEvent(target: HTMLElement): boolean {
  const dialogResult = handleProcessWebStatusActionDialogEvent(target, {
    toast: showPostFinishingToast,
    refresh: refreshCurrentPage,
  })
  if (dialogResult !== null) return dialogResult

  const actionNode = target.closest<HTMLElement>('[data-post-finishing-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.postFinishingAction
  if (action === 'open-web-status-action-dialog') {
    openProcessWebStatusActionDialog({
      actionNode,
      sourceType: 'POST_FINISHING_WORK_ORDER',
    })
    return false
  }

  return false
}
