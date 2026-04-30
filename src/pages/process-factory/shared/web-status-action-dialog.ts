import { executeProcessWebAction, type ProcessWebSourceType } from '../../../data/fcs/process-web-status-actions.ts'
import { escapeHtml } from '../../../utils'

type ToastFn = (message: string) => void

export interface ProcessWebStatusActionDialogConfig {
  actionNode: HTMLElement
  sourceType: ProcessWebSourceType
}

export interface ProcessWebStatusActionDialogCallbacks {
  toast: ToastFn
  refresh: () => void
}

const DIALOG_ID = 'process-web-status-action-dialog'

export function closeProcessWebStatusActionDialog(): void {
  if (typeof document === 'undefined') return
  document.getElementById(DIALOG_ID)?.remove()
}

export function isQuantityField(label: string): boolean {
  return label.includes('数量')
    || label.includes('米数')
    || label.includes('卷数')
    || label.includes('容量')
    || label.includes('长度')
}

export function getDefaultFieldValue(
  label: string,
  context: { operatedAt: string; objectQty: string; qtyUnit: string },
): string {
  if (
    label.includes('操作人') ||
    label.includes('交出人') ||
    label.includes('接收人') ||
    label.includes('质检人') ||
    label.includes('复检人') ||
    label.includes('后道操作人') ||
    label.includes('上报人')
  ) return 'Web 端操作员'
  if (label.includes('时间')) return context.operatedAt
  if (label.includes('花型号') || label.includes('花型版本')) return 'PAT-20260328-A'
  if (label.includes('调色结果')) return '调色通过'
  if (label.includes('打印机编号')) return 'PRN-01'
  if (label.includes('染缸号')) return 'VAT-01'
  if (label.includes('染缸容量')) return '600'
  if (label.includes('色号')) return 'CLR-001'
  if (label.includes('打样结果')) return '打样通过'
  if (label.includes('原料面料 SKU')) return 'FAB-DYE-001'
  if (label.includes('关联菲票')) return '按绑定菲票'
  if (label.includes('差异类型')) return '数量差异'
  if (label.includes('原因')) return '现场数量差异'
  if (label === '单位') return context.qtyUnit
  if (label.includes('卷数')) return '12'
  if (isQuantityField(label)) return context.objectQty
  return ''
}

function parseFields(value: string | undefined): string[] {
  return (value || '').split('|').map((item) => item.trim()).filter(Boolean)
}

function resolveObjectQtyField(fields: Record<string, string>): [string, string] | undefined {
  return Object.entries(fields).find(([field]) =>
    isQuantityField(field)
    && !field.includes('包装数量')
    && !field.includes('染缸容量')
    && !field.includes('卷数')
    && field !== '单位',
  ) ?? Object.entries(fields).find(([field]) => isQuantityField(field) && field !== '单位')
}

export function openProcessWebStatusActionDialog(config: ProcessWebStatusActionDialogConfig): void {
  if (typeof document === 'undefined') return

  closeProcessWebStatusActionDialog()

  const { actionNode, sourceType } = config
  const sourceId = actionNode.dataset.sourceId || ''
  const actionCode = actionNode.dataset.actionCode || ''
  const actionLabel = actionNode.dataset.actionLabel || '状态操作'
  const fromStatus = actionNode.dataset.fromStatus || '当前状态'
  const toStatus = actionNode.dataset.toStatus || '目标状态'
  const confirmText = actionNode.dataset.confirmText || `确认执行 ${actionLabel}`
  const requiredFields = parseFields(actionNode.dataset.requiredFields)
  const optionalFields = parseFields(actionNode.dataset.optionalFields)
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
          data-testid="process-web-status-action-field"
          data-process-web-status-action-field="${escapeHtml(field)}"
          data-required="${isRequired ? 'true' : 'false'}"
          data-quantity-field="${isQuantityField(field) && field !== '单位' ? 'true' : 'false'}"
          value="${escapeHtml(defaultValue)}"
          placeholder="请填写${escapeHtml(field)}"
        />
        ${helper ? `<span class="text-[11px] text-muted-foreground">${escapeHtml(helper)}</span>` : ''}
      </label>
    `
  }).join('')

  const dialog = document.createElement('div')
  dialog.id = DIALOG_ID
  dialog.setAttribute('data-testid', 'process-web-status-action-dialog')
  dialog.className = 'fixed inset-0 z-[160] flex items-center justify-center bg-black/45 p-4'
  dialog.dataset.sourceType = sourceType
  dialog.dataset.sourceId = sourceId
  dialog.dataset.actionCode = actionCode
  dialog.dataset.actionLabel = actionLabel
  dialog.dataset.objectType = objectType
  dialog.dataset.objectQty = objectQty
  dialog.dataset.qtyUnit = qtyUnit
  dialog.innerHTML = `
    <section class="w-full max-w-xl rounded-lg border bg-background shadow-xl">
      <header class="flex items-start justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2 class="text-base font-semibold text-foreground" data-testid="process-web-status-action-title">${escapeHtml(actionLabel)}</h2>
          <p class="mt-1 text-xs text-muted-foreground">当前状态：${escapeHtml(fromStatus)}；目标状态：${escapeHtml(toStatus)}</p>
        </div>
        <button type="button" class="inline-flex h-8 w-8 items-center justify-center rounded-md border hover:bg-muted" data-process-web-status-action="close" data-testid="process-web-status-action-cancel" aria-label="关闭">×</button>
      </header>
      <div class="space-y-4 px-5 py-4">
        <div class="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">${escapeHtml(confirmText)}</div>
        <div class="grid gap-3 md:grid-cols-2">
          ${fieldHtml}
        </div>
        <label class="space-y-1 text-sm">
          <span class="text-xs text-muted-foreground">备注</span>
          <textarea class="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm" data-process-web-status-action-field="备注" placeholder="补充本次操作说明">工艺工厂 Web 端状态操作</textarea>
        </label>
        <div class="rounded-md border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          提交后将调用统一写回函数，生成操作记录，并同步移动端任务、平台聚合状态、仓交出联动结果。
        </div>
      </div>
      <footer class="flex justify-end gap-2 border-t px-5 py-4">
        <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-process-web-status-action="close" data-testid="process-web-status-action-cancel">取消</button>
        <button type="button" class="rounded-md border border-blue-600 bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700" data-process-web-status-action="confirm" data-testid="process-web-status-action-confirm">确认执行</button>
      </footer>
    </section>
  `
  const host = document.querySelector('#app')
  ;(host || document.body).appendChild(dialog)
}

export function collectProcessWebStatusActionFields(
  dialog: HTMLElement,
  toast: ToastFn,
): Record<string, string> | null {
  const fields: Record<string, string> = {}
  const inputs = Array.from(dialog.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[data-process-web-status-action-field]'))
  for (const input of inputs) {
    const field = input.dataset.processWebStatusActionField || ''
    const value = input.value.trim()
    if (input.dataset.required === 'true' && !value) {
      toast(`请填写${field}`)
      input.focus()
      return null
    }
    if (input.dataset.quantityField === 'true' && value && !Number.isFinite(Number(value))) {
      toast(`${field}必须填写数字`)
      input.focus()
      return null
    }
    if (field) fields[field] = value
  }
  return fields
}

export function confirmProcessWebStatusAction(callbacks: ProcessWebStatusActionDialogCallbacks): boolean {
  const dialog = typeof document === 'undefined' ? null : document.getElementById(DIALOG_ID)
  if (!dialog) return false

  const fields = collectProcessWebStatusActionFields(dialog, callbacks.toast)
  if (!fields) return false

  const operatorName =
    fields['操作人'] ||
    fields['交出人'] ||
    fields['接收人'] ||
    fields['质检人'] ||
    fields['复检人'] ||
    fields['后道操作人'] ||
    fields['上报人'] ||
    'Web 端操作员'
  const operatedAt =
    fields['操作时间'] ||
    fields['开始时间'] ||
    fields['完成时间'] ||
    fields['交出时间'] ||
    fields['样衣到位时间'] ||
    fields['到位时间'] ||
    fields['排缸时间'] ||
    '2026-04-29 10:00'
  const objectQtyField = resolveObjectQtyField(fields)
  const objectQty = objectQtyField ? Number(objectQtyField[1]) : undefined
  const qtyUnit = fields['单位'] || dialog.dataset.qtyUnit || undefined

  try {
    const result = executeProcessWebAction({
      sourceType: (dialog.dataset.sourceType || 'PRINT_WORK_ORDER') as ProcessWebSourceType,
      sourceId: dialog.dataset.sourceId || '',
      actionCode: dialog.dataset.actionCode || '',
      operatorName,
      operatedAt,
      objectType: dialog.dataset.objectType,
      objectQty,
      qtyUnit,
      fields,
      remark: fields['备注'] || '工艺工厂 Web 端状态操作',
    })
    closeProcessWebStatusActionDialog()
    callbacks.toast(result.message)
    callbacks.refresh()
    return true
  } catch (error) {
    callbacks.toast(error instanceof Error ? error.message : '状态操作失败')
    return false
  }
}

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
