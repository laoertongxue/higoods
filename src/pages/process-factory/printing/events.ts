import { appStore } from '../../../state/store'
import { escapeHtml } from '../../../utils'
import {
  approvePrintReview,
  rejectPrintReview,
} from '../../../data/fcs/printing-task-domain.ts'
import { executeProcessWebAction } from '../../../data/fcs/process-web-status-actions.ts'

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

function getDefaultFieldValue(label: string, input: { operatedAt: string; objectQty: string; qtyUnit: string }): string {
  if (label.includes('操作人') || label.includes('交出人')) return 'Web 端操作员'
  if (label.includes('时间')) return input.operatedAt
  if (label.includes('花型号') || label.includes('花型版本')) return 'PAT-20260328-A'
  if (label.includes('调色结果')) return '调色通过'
  if (label.includes('打印机编号')) return 'PRN-01'
  if (label === '单位') return input.qtyUnit
  if (label.includes('数量') || label.includes('米数') || label.includes('卷数')) return input.objectQty
  return ''
}

function isQuantityField(label: string): boolean {
  return label.includes('数量') || label.includes('米数') || label.includes('卷数')
}

function openWebStatusActionDialog(actionNode: HTMLElement): void {
  if (typeof document === 'undefined') return

  document.getElementById('printing-web-status-action-dialog')?.remove()

  const sourceId = actionNode.dataset.sourceId || ''
  const actionCode = actionNode.dataset.actionCode || ''
  const actionLabel = actionNode.dataset.actionLabel || '状态操作'
  const fromStatus = actionNode.dataset.fromStatus || '当前状态'
  const toStatus = actionNode.dataset.toStatus || '目标状态'
  const confirmText = actionNode.dataset.confirmText || `确认执行 ${actionLabel}`
  const requiredFields = (actionNode.dataset.requiredFields || '').split('|').filter(Boolean)
  const optionalFields = (actionNode.dataset.optionalFields || '').split('|').filter(Boolean)
  const objectQty = actionNode.dataset.objectQty || ''
  const qtyUnit = actionNode.dataset.qtyUnit || ''
  const objectType = actionNode.dataset.objectType || ''
  const operatedAt = '2026-04-29 10:00'
  const allFields = [
    ...requiredFields,
    ...optionalFields.filter((field) => field !== '备注' && !requiredFields.includes(field)),
  ]

  const fieldHtml = allFields.map((field) => {
    const isRequired = requiredFields.includes(field)
    const defaultValue = getDefaultFieldValue(field, { operatedAt, objectQty, qtyUnit })
    const helper =
      field === '单位' && qtyUnit
        ? `默认单位：${qtyUnit}`
        : isQuantityField(field) && objectType
          ? `对象：${objectType}${qtyUnit ? `，单位：${qtyUnit}` : ''}`
          : ''
    return `
      <label class="space-y-1 text-sm">
        <span class="flex items-center gap-1 text-xs text-muted-foreground">
          ${escapeHtml(field)}
          ${isRequired ? '<span class="text-red-500">*</span>' : '<span class="text-muted-foreground">可选</span>'}
        </span>
        <input
          class="h-9 w-full rounded-md border bg-background px-3 text-sm"
          data-printing-action-field="${escapeHtml(field)}"
          data-required="${isRequired ? 'true' : 'false'}"
          value="${escapeHtml(defaultValue)}"
          placeholder="请填写${escapeHtml(field)}"
        />
        ${helper ? `<span class="text-[11px] text-muted-foreground">${escapeHtml(helper)}</span>` : ''}
      </label>
    `
  }).join('')

  const dialog = document.createElement('div')
  dialog.id = 'printing-web-status-action-dialog'
  dialog.dataset.testid = 'printing-web-status-action-dialog'
  dialog.className = 'fixed inset-0 z-[160] flex items-center justify-center bg-black/45 p-4'
  dialog.dataset.sourceId = sourceId
  dialog.dataset.actionCode = actionCode
  dialog.dataset.actionLabel = actionLabel
  dialog.dataset.qtyUnit = qtyUnit
  dialog.innerHTML = `
    <section class="w-full max-w-xl rounded-lg border bg-background shadow-xl">
      <header class="flex items-start justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2 class="text-base font-semibold text-foreground">${escapeHtml(actionLabel)}</h2>
          <p class="mt-1 text-xs text-muted-foreground">当前状态：${escapeHtml(fromStatus)}；目标状态：${escapeHtml(toStatus)}</p>
        </div>
        <button type="button" class="inline-flex h-8 w-8 items-center justify-center rounded-md border hover:bg-muted" data-printing-action="close-web-status-action-dialog" aria-label="关闭">×</button>
      </header>
      <div class="space-y-4 px-5 py-4">
        <div class="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">${escapeHtml(confirmText)}</div>
        <div class="grid gap-3 md:grid-cols-2">
          ${fieldHtml}
        </div>
        <label class="space-y-1 text-sm">
          <span class="text-xs text-muted-foreground">备注</span>
          <textarea class="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm" data-printing-action-field="备注" placeholder="补充本次操作说明">工艺工厂 Web 端状态操作</textarea>
        </label>
        <div class="rounded-md border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          提交后将调用统一写回函数，生成 Web 端操作记录，并同步移动端任务、平台聚合状态、仓交出联动结果。
        </div>
      </div>
      <footer class="flex justify-end gap-2 border-t px-5 py-4">
        <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-printing-action="close-web-status-action-dialog">取消</button>
        <button type="button" class="rounded-md border border-blue-600 bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700" data-printing-action="confirm-web-status-action">确认执行</button>
      </footer>
    </section>
  `
  const host = document.querySelector('#app')
  ;(host || document.body).appendChild(dialog)
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

function confirmWebStatusAction(): void {
  const dialog = document.getElementById('printing-web-status-action-dialog')
  if (!dialog) return

  const fields: Record<string, string> = {}
  const inputs = Array.from(dialog.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[data-printing-action-field]'))
  for (const input of inputs) {
    const field = input.dataset.printingActionField || ''
    const value = input.value.trim()
    if (input.dataset.required === 'true' && !value) {
      showPrintingToast(`请填写${field}`)
      input.focus()
      return
    }
    if (field) fields[field] = value
  }

  const operatorName = fields['操作人'] || fields['交出人'] || 'Web 端操作员'
  const operatedAt =
    fields['操作时间'] ||
    fields['开始时间'] ||
    fields['完成时间'] ||
    fields['交出时间'] ||
    '2026-04-29 10:00'
  const quantityField = Object.entries(fields).find(([field]) => isQuantityField(field))
  const objectQty = quantityField ? Number(quantityField[1]) : undefined
  const qtyUnit = fields['单位'] || dialog.dataset.qtyUnit || undefined

  try {
    const result = executeProcessWebAction({
      sourceType: 'PRINT_WORK_ORDER',
      sourceId: dialog.dataset.sourceId || '',
      actionCode: dialog.dataset.actionCode || '',
      operatorName,
      operatedAt,
      objectQty,
      qtyUnit,
      fields,
      remark: fields['备注'] || '工艺工厂 Web 端状态操作',
    })
    dialog.remove()
    showPrintingToast(result.message)
    refreshCurrentPrintingPage()
  } catch (error) {
    showPrintingToast(error instanceof Error ? error.message : '状态操作失败')
  }
}

export function handleCraftPrintingEvent(target: HTMLElement): boolean {
  const actionNode = target.closest<HTMLElement>('[data-printing-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.printingAction
  if (!action) return false

  if (action === 'open-web-status-action-dialog') {
    openWebStatusActionDialog(actionNode)
    return false
  }

  if (action === 'close-web-status-action-dialog') {
    document.getElementById('printing-web-status-action-dialog')?.remove()
    return false
  }

  if (action === 'confirm-web-status-action') {
    confirmWebStatusAction()
    return true
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

  if (action === 'approve-review') {
    const printOrderId = actionNode.dataset.printOrderId
    if (!printOrderId) return true
    approvePrintReview(printOrderId, { reviewedBy: '中转审核员', remark: '中转区域审核通过' })
    showPrintingToast('审核通过')
    appStore.navigate(`/fcs/craft/printing/pending-review?printOrderId=${encodeURIComponent(printOrderId)}`)
    return true
  }

  if (action === 'reject-review') {
    const printOrderId = actionNode.dataset.printOrderId
    if (!printOrderId) return true
    const rejectReason = window.prompt('请输入驳回原因')
    if (!rejectReason) return true
    rejectPrintReview(printOrderId, {
      reviewedBy: '中转审核员',
      rejectReason,
      remark: '中转区域审核驳回',
    })
    showPrintingToast('审核驳回')
    appStore.navigate(`/fcs/craft/printing/pending-review?printOrderId=${encodeURIComponent(printOrderId)}`)
    return true
  }

  return false
}
