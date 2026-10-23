import { runLaceFactoryRecordCommand } from '../../../../data/fcs/lace-factory-records.ts'
import { captureLaceFactoryRuntime } from '../../../../data/fcs/lace-factory-domain.ts'

const attempts = new WeakMap<HTMLElement, Map<string, { id: string; intent: string }>>()
/** The original lace forms keep their fields. Only persistence and pending
 * controls are shared here; no new role, state or quantity rules are added. */
export async function saveWebLaceRecord(root: HTMLElement | null, action: string, mutate: () => unknown, operationId?: string, workOrderId?: string) {
  if (!root) throw new Error('花边页面已离开，本次未保存。')
  if (root.dataset.laceRecordBusy || root.dataset.laceRecordCommitted) throw new Error('请等待保存完成；已保存但未更新时请重新读取。')
  const fields = [...root.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input,select,textarea')]
    .map(field => [field.getAttribute('data-lace-detail-field') || field.getAttribute('data-wls-lace-receipts-field') || field.name,
      field instanceof HTMLInputElement && ['checkbox', 'radio'].includes(field.type) ? field.checked : field.value])
  const intent = JSON.stringify({ action, workOrderId, path: window.location.pathname, fields })
  const cache = attempts.get(root) || new Map<string, { id: string; intent: string }>(); attempts.set(root, cache)
  const old = cache.get(action), attempt = old?.intent === intent ? old : { id: operationId || crypto.randomUUID(), intent }
  cache.set(action, attempt)
  const guard = workOrderId ? { workOrderId, expected: JSON.stringify(captureLaceFactoryRuntime().workOrders.find(order => order.workOrderId === workOrderId)) } : undefined
  const controls = [...root.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLTextAreaElement | HTMLSelectElement>('input,button,textarea,select')]
    .map(control => ({ control, disabled: control.disabled }))
  root.dataset.laceRecordBusy = 'true'; root.setAttribute('aria-busy', 'true')
  controls.forEach(({ control }) => { control.disabled = true })
  try {
    await runLaceFactoryRecordCommand(attempt.id, intent, mutate, guard)
    cache.delete(action)
  } catch (error) {
    if (error instanceof Error && /已保存.*未能更新/.test(error.message)) {
      root.dataset.laceRecordCommitted = 'true'
      const notice = document.createElement('div'); notice.className = 'rounded-md border border-blue-200 bg-blue-50 p-3 text-sm'
      notice.textContent = '本次操作已保存，重新读取后继续。'
      const reload = document.createElement('button'); reload.type = 'button'; reload.className = 'ml-3 rounded-md border bg-white px-3 py-2'; reload.textContent = '重新读取'
      reload.addEventListener('click', () => window.location.reload()); notice.append(reload); root.prepend(notice)
    }
    throw error
  } finally {
    delete root.dataset.laceRecordBusy; root.removeAttribute('aria-busy')
    if (!root.dataset.laceRecordCommitted) controls.forEach(({ control, disabled }) => { if (control.isConnected) control.disabled = disabled })
  }
}

export function laceRecordErrorText(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return /已保存.*未能更新/.test(message) ? message : `未保存：${message}。请修正后重新提交。`
}
