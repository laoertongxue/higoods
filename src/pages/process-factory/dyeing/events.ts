import { appStore } from '../../../state/store'
import {
  approveDyeReview,
  rejectDyeReview,
} from '../../../data/fcs/dyeing-task-domain.ts'
import { executeProcessWebAction } from '../../../data/fcs/process-web-status-actions.ts'

function showDyeingToast(message: string): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return

  const rootId = 'dyeing-page-toast-root'
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

export function handleCraftDyeingEvent(target: HTMLElement): boolean {
  const actionNode = target.closest<HTMLElement>('[data-dyeing-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.dyeingAction
  if (!action) return false

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
        sourceType: 'DYE_WORK_ORDER',
        sourceId,
        actionCode,
        operatorName: 'Web 端操作员',
        operatedAt: '2026-04-28 10:00',
        remark: '工艺工厂 Web 端状态操作',
      })
      showDyeingToast(result.message)
    } catch (error) {
      showDyeingToast(error instanceof Error ? error.message : '状态操作失败')
    }
    return true
  }

  if (action === 'approve-review') {
    const dyeOrderId = actionNode.dataset.dyeOrderId
    if (!dyeOrderId) return true
    approveDyeReview(dyeOrderId, { reviewedBy: '中转审核员', remark: '中转区域审核通过' })
    showDyeingToast('审核通过')
    appStore.navigate(`/fcs/craft/dyeing/reports?dyeOrderId=${encodeURIComponent(dyeOrderId)}`)
    return true
  }

  if (action === 'reject-review') {
    const dyeOrderId = actionNode.dataset.dyeOrderId
    if (!dyeOrderId) return true
    const rejectReason = window.prompt('请输入驳回原因')
    if (!rejectReason) return true
    rejectDyeReview(dyeOrderId, {
      reviewedBy: '中转审核员',
      rejectReason,
      remark: '中转区域审核驳回',
    })
    showDyeingToast('审核驳回')
    appStore.navigate(`/fcs/craft/dyeing/reports?dyeOrderId=${encodeURIComponent(dyeOrderId)}`)
    return true
  }

  return false
}
