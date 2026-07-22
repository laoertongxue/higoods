import { appStore } from '../../../state/store'
import {
  confirmPrintReceipt,
  getPrintReviewRecordByOrderId,
  markPrintReceiptDifference,
} from '../../../data/fcs/printing-task-domain.ts'
import { executeProcessWebAction } from '../../../data/fcs/process-web-status-actions.ts'
import {
  handleProcessWebStatusActionDialogEvent,
  openProcessWebStatusActionDialog,
} from '../shared/web-status-action-dialog.ts'

function showPrintingToast(message: string): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return

  const rootId = 'printing-page-toast-root'
  let root = document.getElementById(rootId)
  if (!root) {
    root = document.createElement('div')
    root.id = rootId
    root.className = 'pointer-events-none fixed right-6 top-20 z-[130] flex max-w-sm flex-col gap-2'
    document.body.appendChild(root)
  }

  const toast = document.createElement('div')
  toast.className =
    'pointer-events-auto rounded-md border bg-background px-4 py-3 text-sm text-foreground shadow-md transition-all duration-200'
  toast.textContent = message
  toast.style.opacity = '0'
  toast.style.transform = 'translateY(-6px)'
  root.appendChild(toast)

  window.requestAnimationFrame(() => {
    toast.style.opacity = '1'
    toast.style.transform = 'translateY(0)'
  })

  window.setTimeout(() => {
    toast.style.opacity = '0'
    toast.style.transform = 'translateY(-6px)'
    window.setTimeout(() => {
      toast.remove()
      if (root && root.childElementCount === 0) root.remove()
    }, 180)
  }, 2200)
}

function refreshCurrentPrintingPage(): void {
  const current = appStore.getState().pathname || '/'
  const [path, queryString = ''] = current.split('?')
  const params = new URLSearchParams(queryString)
  params.delete('webAction')
  params.set('actionResultAt', String(Date.now()))
  const next = `${path}?${params.toString()}`
  appStore.navigate(next, { historyMode: 'replace' })
}

export function handleCraftPrintingEvent(target: HTMLElement): boolean {
  const sourceFilter = target.closest<HTMLSelectElement>('[data-printing-source-filter]')
  if (sourceFilter) {
    const sourceType = sourceFilter.value
    const root = sourceFilter.closest<HTMLElement>('[data-printing-work-orders-root]') || document
    root.querySelectorAll<HTMLElement>('[data-printing-work-order-row]').forEach((row) => {
      row.hidden = Boolean(sourceType && row.dataset.sourceType !== sourceType)
    })
    return true
  }

  const dialogHandled = handleProcessWebStatusActionDialogEvent(target, {
    toast: showPrintingToast,
    refresh: refreshCurrentPrintingPage,
  })
  if (dialogHandled !== null) return dialogHandled

  const actionNode = target.closest<HTMLElement>('[data-printing-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.printingAction
  if (!action) return false

  if (action === 'open-web-status-action-dialog') {
    openProcessWebStatusActionDialog({ actionNode, sourceType: 'PRINT_WORK_ORDER' })
    return false
  }

  if (action === 'close-web-status-action-dialog') {
    return false
  }

  if (action === 'confirm-web-status-action') {
    return false
  }

  if (action === 'navigate') {
    const href = actionNode.dataset.href
    if (href) appStore.navigate(href)
    return true
  }

  if (action === 'web-status-action') {
    const sourceId = actionNode.dataset.sourceId
    const actionCode = actionNode.dataset.actionCode
    if (!sourceId || !actionCode) return true
    try {
      const result = executeProcessWebAction({
        sourceType: 'PRINT_WORK_ORDER',
        sourceId,
        actionCode,
        operatorName: 'Web 端操作员',
        operatedAt: '2026-04-28 10:00',
        remark: '工艺工厂 Web 端状态操作',
      })
      showPrintingToast(result.message)
    } catch (error) {
      showPrintingToast(error instanceof Error ? error.message : '状态操作失败')
    }
    return true
  }

  if (action === 'confirm-receipt') {
    const printOrderId = actionNode.dataset.printOrderId
    if (!printOrderId) return true
    confirmPrintReceipt(printOrderId, { receivedBy: '仓库收货员', remark: '仓库确认本次收货' })
    showPrintingToast('已确认本次收货')
    appStore.navigate(`/fcs/craft/printing/pending-review?printOrderId=${encodeURIComponent(printOrderId)}`)
    return true
  }

  if (action === 'mark-receipt-difference') {
    const printOrderId = actionNode.dataset.printOrderId
    if (!printOrderId) return true
    const review = getPrintReviewRecordByOrderId(printOrderId)
    const defaultQty = review?.receivedQty || review?.submittedQty || 0
    const qtyText = window.prompt('请输入本次实收数量', String(defaultQty))
    if (qtyText === null) return true
    const receivedQty = Number(qtyText)
    if (!Number.isFinite(receivedQty) || receivedQty < 0) {
      showPrintingToast('请填写有效的实收数量')
      return true
    }
    const differenceReason = window.prompt('请输入收货差异原因')
    if (!differenceReason) return true
    markPrintReceiptDifference(printOrderId, {
      receivedBy: '仓库收货员',
      receivedQty,
      differenceReason,
      remark: '仓库确认收货差异',
    })
    showPrintingToast('已标记收货差异')
    appStore.navigate(`/fcs/craft/printing/pending-review?printOrderId=${encodeURIComponent(printOrderId)}`)
    return true
  }

  return false
}
