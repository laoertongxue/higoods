import { escapeHtml as e } from '../../../utils.ts'
import { renderDialog } from '../../../components/ui/dialog.ts'
import { runDesignRevisionFcsCommand } from '../../../data/fcs/design-revision-pcs-command.ts'
import { getDyeDispatchPartner, getDyeWorkOrderById, getDyeReceivingTargetChangeBlocker, listDyeReceivingTargetOptions, updateDyeReceivingTarget, type DyeWorkOrder } from '../../../data/fcs/dyeing-task-domain.ts'

let active: { id: string; updatedAt: string; targetKey: string; focus?: HTMLElement; busy: boolean } | undefined
const mountId = 'dye-recipient-dialog-root'
function close() {
  if (active?.busy) return
  const focus = active?.focus
  document.getElementById(mountId)?.remove(); active = undefined
  if (focus?.isConnected) focus.focus()
}
export function renderDyeRecipientSummary(order: DyeWorkOrder): string {
  let name = '接收方待核对'
  try { name = getDyeDispatchPartner(order.dyeOrderId).name } catch { /* Explicit linked-target readiness remains visible. */ }
  const blocker = getDyeReceivingTargetChangeBlocker(order.dyeOrderId)
  return `<div class="mt-3 rounded-md border p-3 text-sm" data-dye-recipient-summary><div class="flex flex-wrap items-center justify-between gap-3"><span>交出接收方：<strong>${e(name)}</strong></span><button type="button" class="rounded-md border px-3 py-2 hover:bg-muted disabled:opacity-50" data-dyeing-action="recipient-open" data-dye-order-id="${e(order.dyeOrderId)}" data-skip-page-rerender="true" ${blocker ? 'disabled' : ''}>调整接收方</button></div>${blocker ? `<p class="mt-2 text-xs text-muted-foreground">${e(blocker)}</p>` : ''}${order.receivingTargetChanges?.length ? `<details class="mt-3"><summary class="cursor-pointer text-blue-700">接收方调整记录（${order.receivingTargetChanges.length}）</summary>${[...order.receivingTargetChanges].reverse().map(change => `<p class="mt-2">${e(change.from.name)} → ${e(change.to.name)}<br><span class="text-xs text-muted-foreground">${e(change.by)} · ${e(change.at)} · ${e(change.reason)}</span></p>`).join('')}</details>` : ''}</div>`
}
export async function handleDyeRecipientEvent(target: HTMLElement, notify: (message: string) => void, refresh: () => void): Promise<boolean> {
  const button = target.closest<HTMLElement>('[data-dyeing-action^="recipient-"]')
  if (!button) return false
  const action = button.dataset.dyeingAction
  if (action === 'recipient-close') { close(); return true }
  if (action === 'recipient-open') {
    const id = button.dataset.dyeOrderId || '', order = getDyeWorkOrderById(id)
    if (!order) { notify('加工单不存在，请重新读取。'); return true }
    const blocker = getDyeReceivingTargetChangeBlocker(id)
    if (blocker) { notify(blocker); return true }
    close()
    const prior = getDyeDispatchPartner(id)
    active = { id, updatedAt: order.updatedAt, targetKey: prior.kind + ':' + prior.id, focus: button, busy: false }
    const mount = document.createElement('div'); mount.id = mountId; mount.dataset.skipPageRerender = 'true'
    mount.innerHTML = renderDialog({ title: '调整交出接收方', description: order.dyeOrderNo, width: 'md', closeAction: { prefix: 'dyeing', action: 'recipient-close', skipPageRerender: true } }, `<div class="space-y-4"><p class="text-sm">当前接收方：${e(prior.name)}</p><label class="block text-sm">新接收方<select class="mt-1 w-full rounded-md border p-2" data-dye-recipient-target aria-label="新接收方"><option value="">选择已登记工厂或仓库</option>${listDyeReceivingTargetOptions().map(option => `<option value="${e(option.kind + ':' + option.id)}">${e(option.name)}（${e(option.id)}）</option>`).join('')}</select></label><label class="block text-sm">调整原因<textarea class="mt-1 w-full rounded-md border p-2" data-dye-recipient-reason aria-label="调整原因" rows="3"></textarea></label><p class="text-sm text-muted-foreground">确认后更新本单接收方。已最终完工且新接收方不是染厂时，系统同时补建染厂QC单。调整不会登记实物交出或实收。</p><p class="text-sm text-red-600" role="alert" data-dye-recipient-error></p></div>`, `<button type="button" class="rounded-md border px-3 py-2" data-dyeing-action="recipient-close" data-skip-page-rerender="true">取消</button><button type="button" class="rounded-md bg-blue-600 px-3 py-2 text-white" data-dyeing-action="recipient-save" data-skip-page-rerender="true">确认调整</button>`)
    const panel = mount.querySelector('.relative')!; panel.setAttribute('role','dialog'); panel.setAttribute('aria-modal','true'); panel.setAttribute('aria-label','调整交出接收方')
    mount.querySelector('button')?.setAttribute('aria-label','关闭调整接收方')
    mount.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); close() }
      if (event.key !== 'Tab') return
      const fields = [...mount.querySelectorAll<HTMLElement>('button:not(:disabled),select,textarea')], first = fields[0], last = fields.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    })
    // Business clicks are delegated by the existing app root.
    document.getElementById('app')!.appendChild(mount); mount.querySelector<HTMLSelectElement>('[data-dye-recipient-target]')?.focus()
    return true
  }
  if (action === 'recipient-save') {
    const current = active, mount = document.getElementById(mountId)
    if (!current || !mount || current.busy) return true
    const targetKey = mount.querySelector<HTMLSelectElement>('[data-dye-recipient-target]')?.value || '', reason = mount.querySelector<HTMLTextAreaElement>('[data-dye-recipient-reason]')?.value || ''
    const errorNode = mount.querySelector<HTMLElement>('[data-dye-recipient-error]')!
    if (!targetKey || !reason.trim()) { errorNode.textContent = '选择新接收方并填写调整原因。'; return true }
    current.busy = true; (button as HTMLButtonElement).disabled = true; button.textContent = '保存中…'; errorNode.textContent = ''
    try {
      await runDesignRevisionFcsCommand(current.id, () => updateDyeReceivingTarget(current.id, { targetKey, expectedUpdatedAt: current.updatedAt, expectedTargetKey: current.targetKey, by: 'Web现场操作员', reason }))
      current.busy = false; close(); notify('接收方已调整，相关QC资料已同步保存。'); refresh()
    } catch (error) { errorNode.textContent = error instanceof Error ? error.message : '保存失败，当前输入已保留。' }
    finally { current.busy = false; if (button.isConnected) { (button as HTMLButtonElement).disabled = false; button.textContent = '确认调整' } }
    return true
  }
  return false
}
