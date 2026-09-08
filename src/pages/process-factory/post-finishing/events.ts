import { appStore } from '../../../state/store'
import { escapeHtml } from '../../../utils'
import { getPostFinishingFullFlowQcTask } from '../../../data/fcs/post-finishing-full-flow.ts'
import { handlePostFinishingAuditRecordsEvent } from './audit-records.ts'
import { handlePostFinishingMaterialTransfersEvent } from './material-transfers.ts'
import { handlePostFinishingOutboundOrderEvent } from './outbound-orders.ts'
import { handlePostFinishingQcOrdersEvent } from './qc-orders.ts'
import { handlePostFinishingQcWorkbenchEvent } from './qc-workbench.ts'
import { handlePostFinishingRecheckOrdersEvent } from './recheck-orders.ts'
import { handlePostFinishingTasksEvent } from './tasks.ts'
import { handlePostFinishingReturnFlowEvent } from './warehouse.ts'
import { handlePostFinishingWorkOrderDetailEvent } from './work-order-detail.ts'
import { handlePostFinishingWorkOrdersEvent } from './work-orders.ts'

const POST_FINISHING_QC_PRINT_MODAL_ID = 'post-finishing-qc-print-modal'

function removePostFinishingQcPrintDialog(): void {
  document.getElementById(POST_FINISHING_QC_PRINT_MODAL_ID)?.remove()
}

function openPostFinishingQcPrintDialog(type: 'QC_ORDER' | 'QC_DETAIL'): void {
  removePostFinishingQcPrintDialog()
  const title = type === 'QC_ORDER' ? '打印质检单' : '打印质检单详情'
  const host = document.getElementById('app') || document.body
  host.insertAdjacentHTML('beforeend', `
    <div id="${POST_FINISHING_QC_PRINT_MODAL_ID}" class="fixed inset-0 z-[210] flex items-center justify-center bg-black/40 p-4" data-skip-page-rerender="true">
      <section class="w-full max-w-lg rounded-lg border bg-background shadow-2xl" role="dialog" aria-modal="true" aria-label="${title}">
        <header class="flex items-center justify-between gap-3 border-b px-4 py-3"><h2 class="font-semibold">${title}</h2><button type="button" class="rounded-md border px-2 py-1 text-xs" data-post-finishing-action="close-qc-print-dialog">关闭</button></header>
        <div class="space-y-3 p-4"><p class="text-sm text-muted-foreground">输入或扫描完整质检单号，系统不提供模糊匹配。</p><input autofocus class="h-10 w-full rounded-md border px-3 font-mono text-sm" placeholder="完整质检单号" data-qc-print-task-no /><div class="flex justify-end gap-2"><button type="button" class="rounded-md border px-4 py-2 text-sm" data-post-finishing-action="close-qc-print-dialog">取消</button><button type="button" class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white" data-post-finishing-action="confirm-qc-print" data-qc-print-type="${type}">${title}</button></div></div>
      </section>
    </div>`)
  document.querySelector<HTMLInputElement>('[data-qc-print-task-no]')?.focus()
}

function openImage(url: string, label: string): void {
  const overlay = document.createElement('div')
  overlay.className = 'fixed inset-0 z-[200] flex cursor-zoom-out items-center justify-center bg-black/70 p-4'
  overlay.innerHTML = `<div class="max-h-[90vh] max-w-[90vw]"><img src="${escapeHtml(url)}" alt="${escapeHtml(label)}" class="max-h-[85vh] max-w-[85vw] rounded-lg object-contain shadow-2xl" /><div class="mt-2 text-center text-xs text-white/60">${escapeHtml(label)}</div></div>`
  overlay.addEventListener('click', () => overlay.remove())
  document.body.appendChild(overlay)
}

export function handlePostFinishingEvent(target: HTMLElement, event?: Event): boolean {
  if (handlePostFinishingMaterialTransfersEvent(target, event)) return true
  if (handlePostFinishingAuditRecordsEvent(target, event)) return true
  if (handlePostFinishingTasksEvent(target, event)) return true
  if (handlePostFinishingWorkOrderDetailEvent(target)) return true
  if (handlePostFinishingWorkOrdersEvent(target, event)) return true
  if (handlePostFinishingQcWorkbenchEvent(target, event)) return true
  if (handlePostFinishingQcOrdersEvent(target, event)) return true
  if (handlePostFinishingRecheckOrdersEvent(target, event)) return true
  if (handlePostFinishingReturnFlowEvent(target, event)) return true
  if (handlePostFinishingOutboundOrderEvent(target, event)) return true

  const actionNode = target.closest<HTMLElement>('[data-post-finishing-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.postFinishingAction
  if (action === 'open-qc-print-dialog') {
    openPostFinishingQcPrintDialog(actionNode.dataset.qcPrintType === 'QC_DETAIL' ? 'QC_DETAIL' : 'QC_ORDER')
    return true
  }
  if (action === 'close-qc-print-dialog') {
    removePostFinishingQcPrintDialog()
    return true
  }
  if (action === 'confirm-qc-print') {
    const qcTaskNo = document.querySelector<HTMLInputElement>('[data-qc-print-task-no]')?.value.trim() || ''
    if (!getPostFinishingFullFlowQcTask(qcTaskNo)) {
      window.alert('未找到完整质检单号，不提供模糊候选。')
      return true
    }
    const printType = actionNode.dataset.qcPrintType === 'QC_DETAIL' ? 'QC_DETAIL' : 'QC_ORDER'
    removePostFinishingQcPrintDialog()
    appStore.navigate(`/fcs/craft/post-finishing/print?type=${printType}&id=${encodeURIComponent(qcTaskNo)}`)
    return true
  }
  if (action === 'zoom-image') {
    const url = actionNode.dataset.zoomUrl
    if (url) openImage(url, actionNode.dataset.zoomLabel || '')
    return true
  }
  return false
}
