import { handlePostFinishingStorageEvent } from './storage-notice.ts'
import { appStore } from '../../../state/store'
import { escapeHtml } from '../../../utils'
import { getPostFinishingFullFlowQcTask } from '../../../data/fcs/post-finishing-full-flow.ts'
import { handlePostFinishingAuditRecordsEvent } from './audit-records.ts'
import { handlePostFinishingMaterialTransfersEvent } from './material-transfers.ts'
import { handlePostFinishingOutboundOrderEvent } from './outbound-orders.ts'
import { handlePostFinishingQcOrdersEvent } from './qc-orders.ts'
import { handlePostFinishingQcWorkbenchEvent } from './qc-workbench.ts'
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
  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined
  const overlay = document.createElement('div')
  overlay.className = 'fixed inset-0 z-[200] flex cursor-zoom-out items-center justify-center bg-black/70 p-4'
  overlay.setAttribute('role', 'dialog')
  overlay.setAttribute('aria-modal', 'true')
  overlay.setAttribute('aria-label', `${label}大图`)
  overlay.setAttribute('data-post-image-overlay', '')
  overlay.setAttribute('data-post-finishing-image-preview', 'true')
  const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey); previousFocus?.focus() }
  const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close() }
  document.addEventListener('keydown', onKey)
  overlay.innerHTML = `<button type="button" data-post-image-close aria-label="关闭图片" class="absolute right-4 top-4 rounded-md bg-white px-4 py-2">关闭</button><div class="max-h-[90vh] max-w-[90vw]"><img alt="${escapeHtml(label)}" class="max-h-[85vh] max-w-[85vw] rounded-lg object-contain shadow-2xl" /><p role="status" class="mt-2 text-center text-sm text-white" data-post-image-status>图片加载中…</p><button type="button" data-post-image-retry hidden class="mt-2 rounded-md bg-white px-4 py-2">重新加载图片</button><div class="mt-2 text-center text-xs text-white/60">${escapeHtml(label)}</div></div>`
  const img = overlay.querySelector<HTMLImageElement>('img')!
  const status = overlay.querySelector<HTMLElement>('[data-post-image-status]')!
  const retry = overlay.querySelector<HTMLButtonElement>('[data-post-image-retry]')!
  img.addEventListener('load', () => { status.hidden = true; retry.hidden = true })
  img.addEventListener('error', () => { status.hidden = false; status.textContent = '图片加载失败，可重新加载。'; retry.hidden = false })
  retry.addEventListener('click', () => { status.textContent = '图片加载中…'; retry.hidden = true; img.src = url })
  overlay.addEventListener('click', event => { if (event.target === overlay || (event.target as HTMLElement).closest('[data-post-image-close]')) close() })
  document.body.appendChild(overlay)
  img.src = url
  overlay.querySelector<HTMLButtonElement>('[data-post-image-close]')?.focus()
}

export async function handlePostFinishingEvent(target: HTMLElement, event?: Event): Promise<boolean> {
  if (await handlePostFinishingStorageEvent(target, event)) return true
  const imageAction = target.closest<HTMLElement>('[data-post-finishing-action]')
  if (['zoom-image', 'full-flow-zoom-image'].includes(imageAction?.dataset.postFinishingAction || '')) {
    const url = imageAction?.dataset.zoomUrl || imageAction?.dataset.imageUrl
    if (url) openImage(url, imageAction?.dataset.zoomLabel || imageAction?.dataset.imageLabel || '')
    return true
  }
  if (await handlePostFinishingMaterialTransfersEvent(target, event)) return true
  if (await handlePostFinishingAuditRecordsEvent(target, event)) return true
  if (await handlePostFinishingTasksEvent(target, event)) return true
  if (await handlePostFinishingWorkOrderDetailEvent(target)) return true
  if (await handlePostFinishingWorkOrdersEvent(target, event)) return true
  if (await handlePostFinishingQcWorkbenchEvent(target, event)) return true
  if (await handlePostFinishingQcOrdersEvent(target, event)) return true
  if (await handlePostFinishingReturnFlowEvent(target, event)) return true
  if (await handlePostFinishingOutboundOrderEvent(target, event)) return true

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
  if (action === 'zoom-image' || action === 'full-flow-zoom-image') {
    const url = actionNode.dataset.zoomUrl || actionNode.dataset.imageUrl
    if (url) openImage(url, actionNode.dataset.zoomLabel || actionNode.dataset.imageLabel || '')
    return true
  }
  return false
}
