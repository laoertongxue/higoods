import { escapeHtml as e } from '../../../../utils.ts'
import { HAND_FEELS, HAND_FEEL_ENGLISH, type FactoryQcCommand, type HandFeel, type StenterHandfeelOrder, type StenterHandfeelRoll } from '../../../../data/fcs/stenter-handfeel.ts'
import { getFactoryReceiptLocations } from '../../../../data/fcs/factory-receiving.ts'
import { stenterButton, stenterImage, stenterQuantity } from './presentation.ts'

export const stenterExecutionLabels = { send: '来源交给GTG', receive: 'GTG逐卷实收', start: '投入手感加工', output: '登记实际产出', handout: 'GTG交给下游', 'downstream-receive': '登记下游实收' } as const
export type StenterExecutionAction = keyof typeof stenterExecutionLabels
type DialogAction = StenterExecutionAction | 'target' | 'complete' | 'continue'
export const isStenterExecutionAction = (value: string): value is StenterExecutionAction => Object.hasOwn(stenterExecutionLabels, value)
export function stenterExecutionRolls(order: StenterHandfeelOrder, action: StenterExecutionAction): StenterHandfeelRoll[] {
  if (order.completedAt) return []
  return order.rolls.filter(roll => {
    switch (action) {
      case 'send': return !roll.sentAt
      case 'receive': return !!roll.sentAt && !roll.receivedAt
      case 'start': return !!order.handFeel && !!roll.receivedAt && !roll.startedAt
      case 'output': return !!roll.startedAt && !roll.completedAt
      case 'handout': return !!roll.completedAt && !roll.handedOutAt && order.source.target.kind !== 'UNKNOWN'
      case 'downstream-receive': return !!roll.handedOutAt && !roll.downstreamReceivedAt
    }
  })
}
const measured = (action: DialogAction) => ['receive', 'output', 'downstream-receive'].includes(action)
const scanned = (action: DialogAction) => ['send', 'receive', 'handout'].includes(action)
const expected = (roll: StenterHandfeelRoll, action: DialogAction) => action === 'receive' ? roll.inputQty : action === 'output' ? roll.receivedQty : roll.outputQty
const codeFor = (roll: StenterHandfeelRoll, action: DialogAction) => action === 'handout' ? roll.outputBarcode || roll.barcode : roll.barcode
const dialogButton = (label: string, action: string, primary = false) => stenterButton(label, action, '', primary).replace('data-stenter-handfeel-action', 'data-stenter-dialog-action')
function titleFor(order: StenterHandfeelOrder, action: DialogAction): string {
  return action === 'target' ? '补充目标手感' : action === 'complete' ? '人工完单' : action === 'continue' ? '继续处理新增卷' : action === 'send' && order.source.factoryId === order.factoryId ? 'GTG内部转入' : stenterExecutionLabels[action]
}
function receivingFactoryId(order: StenterHandfeelOrder, action: DialogAction): string | undefined {
  return action === 'receive' ? order.factoryId : action === 'downstream-receive' && order.source.target.kind === 'FACTORY' ? order.source.target.factoryId || order.source.target.id : undefined
}
function renderRollInputs(rolls: StenterHandfeelRoll[], action: DialogAction): string {
  return rolls.map(roll => `<article class="space-y-2 rounded border p-3" data-stenter-dialog-roll="${e(roll.id)}"><label class="flex items-start gap-3"><input type="checkbox" class="mt-0.5 h-5 w-5" data-preserve-native-click="true" data-stenter-selected-roll="${e(roll.id)}"><span class="min-w-0 break-all font-medium">${e(codeFor(roll, action))}</span></label><p class="text-sm text-slate-500">参考数量 ${e(stenterQuantity(action === 'send' || action === 'receive' ? roll.inputQty : action === 'start' || action === 'output' ? roll.receivedQty : roll.outputQty, roll.unit))}</p>${measured(action) ? `<label class="block text-sm">${action === 'output' ? '实际产出' : '实际接收'} (${e(roll.unit)})<input type="number" min="0" step="any" inputmode="decimal" class="mt-1 block min-h-11 w-full rounded border px-3" data-stenter-quantity="${e(roll.id)}" data-expected="${expected(roll, action) ?? ''}" aria-label="${e(roll.barcode)}实际数量"></label>` : ''}${action === 'output' ? `<label class="block text-sm">实际产出卷码<input class="mt-1 block min-h-11 w-full rounded border px-3" data-stenter-output-code="${e(roll.id)}" aria-label="${e(roll.barcode)}实际产出卷码"></label>` : ''}</article>`).join('')
}
function renderDialog(order: StenterHandfeelOrder, action: DialogAction): string {
  const rolls = isStenterExecutionAction(action) ? stenterExecutionRolls(order, action) : []
  const receiptFactory = receivingFactoryId(order, action)
  const positions = receiptFactory ? getFactoryReceiptLocations(receiptFactory) : []
  const receiptFactoryName = action === 'receive' ? 'GTG' : order.source.target.name
  const positionHtml = receiptFactory ? `<label class="block text-sm">${e(receiptFactoryName)}实际接收仓库及库位<select class="mt-1 block min-h-11 w-full rounded border px-3" data-stenter-position><option value="">选择实际库位</option>${positions.map(position => `<option value="${e(position.warehouse.warehouseId + '|' + position.location.locationId)}">${e(position.warehouse.warehouseName + ' / ' + position.location.locationName)}</option>`).join('')}</select></label>${positions.length ? '' : `<p class="text-sm text-amber-800">${e(receiptFactoryName)}暂无启用的待加工库位，维护实际库位后再接收。</p>`}` : ''
  const title = titleFor(order, action)
  const controls = action === 'target'
    ? `<label class="block text-sm">目标手感<select class="mt-1 block min-h-11 w-full rounded border px-3" data-stenter-target><option value="">选择目标手感</option>${HAND_FEELS.map(feel => `<option value="${e(feel)}" ${order.handFeel === feel ? 'selected' : ''}>${e(feel)} · ${e(HAND_FEEL_ENGLISH[feel])}</option>`).join('')}</select></label>`
    : action === 'continue'
      ? `<p class="rounded border border-amber-200 bg-amber-50 p-3 text-sm">${e(order.no)} · 来源后补 ${order.rolls.filter(roll => !roll.sentAt).length} 卷。确认后继续同一张单和原手感决定，保留原人工完单历史、已发生收发及质检完成记录。</p>`
    : action === 'complete'
      ? `<p class="rounded border border-amber-200 bg-amber-50 p-3 text-sm">${e(order.no)} · ${order.rolls.length} 卷，已全部由 ${e(order.source.target.name)} 实际接收。确认人工完单后，本单不能自动重开或修改已发生实物。</p>`
      : `<fieldset class="space-y-3" data-stenter-fields><legend class="mb-2 text-sm font-medium">本次操作的卷 <span class="text-slate-500" data-stenter-selected-count>已选 0 / ${rolls.length} 卷</span></legend><div class="space-y-3" data-stenter-dialog-rolls>${renderRollInputs(rolls.slice(0, 50), action)}</div>${rolls.length > 50 ? dialogButton('显示更多可操作卷', 'more') : ''}${positionHtml}${scanned(action) ? `<div class="flex flex-wrap items-end gap-2"><label class="min-w-0 flex-1 text-sm">扫描或手输本次实际卷码<input class="mt-1 block min-h-11 w-full rounded border px-3" data-stenter-scan autocomplete="off"></label>${dialogButton('核对卷码', 'scan')}</div><p class="break-all text-sm text-blue-800" data-stenter-scanned>尚未核对卷码</p>` : ''}${measured(action) ? '<label class="flex gap-2 rounded border border-amber-200 bg-amber-50 p-3 text-sm" data-stenter-difference-row hidden><input type="checkbox" class="h-5 w-5 shrink-0" data-preserve-native-click="true" data-stenter-difference>已核对数量差异，确认按本次实际数量记录</label>' : ''}</fieldset>`
  return `<dialog class="m-auto w-[calc(100%-1rem)] max-w-2xl overflow-hidden rounded-xl border p-0 shadow-xl backdrop:bg-black/40" aria-labelledby="stenter-dialog-title" data-stenter-dialog><div class="flex max-h-[calc(100dvh-1rem)] flex-col"><header class="flex items-center justify-between gap-3 border-b p-4"><h2 class="text-lg font-semibold" id="stenter-dialog-title">${e(title)}</h2>${dialogButton('关闭', 'close')}</header><div class="min-h-0 space-y-4 overflow-y-auto p-4"><div class="flex items-start gap-3">${stenterImage(order.source.imageUrl, order.source.materialName, 'h-12 w-12')}<div class="min-w-0 text-sm"><strong>${e(order.source.materialName)}</strong><p class="break-all">${e(order.no)} · ${e(order.source.materialSku)}</p><p class="mt-1">${e(order.source.factoryName)} → GTG → ${e(order.source.target.name || '下游待核对')}</p></div></div>${controls}<p class="empty:hidden text-sm text-red-700" role="alert" data-stenter-dialog-error></p><section class="space-y-2 rounded border border-amber-200 bg-amber-50 p-3" data-stenter-discard hidden><p class="text-sm">本次填写尚未保存，关闭后不保留。</p><div class="flex flex-wrap gap-2">${dialogButton('继续填写', 'continue')}${dialogButton('放弃填写并关闭', 'discard')}</div></section></div><footer class="flex shrink-0 justify-end gap-3 border-t p-4">${dialogButton('取消', 'close')}${dialogButton('确认' + title, 'submit', true)}</footer></div></dialog>`
}
export function stenterExecutionCommand(order: StenterHandfeelOrder, action: DialogAction, dialog: HTMLElement, codes: ReadonlySet<string>): FactoryQcCommand {
  if (action === 'target') {
    const target = dialog.querySelector<HTMLSelectElement>('[data-stenter-target]')!.value as HandFeel
    if (!HAND_FEELS.includes(target)) throw new Error('选择四类目标手感之一。')
    return { type: 'TARGET', orderId: order.id, expectedVersion: order.version, target }
  }
  if (action === 'complete') return { type: 'COMPLETE', orderId: order.id, expectedVersion: order.version }
  if (action === 'continue') return { type: 'CONTINUE', orderId: order.id, expectedVersion: order.version }
  const allowed = stenterExecutionRolls(order, action)
  const ids = [...dialog.querySelectorAll<HTMLInputElement>('[data-stenter-selected-roll]:checked')].map(input => input.dataset.stenterSelectedRoll!)
  if (!ids.length || ids.some(id => !allowed.some(roll => roll.id === id))) throw new Error('选择本次可操作的卷。')
  const position = dialog.querySelector<HTMLSelectElement>('[data-stenter-position]')?.value.split('|') || []
  const rolls = ids.map(id => {
    const roll = allowed.find(item => item.id === id)!
    if (scanned(action) && !codes.has(codeFor(roll, action))) throw new Error('逐卷扫描或手输实际卷码后确认。')
    const quantityText = dialog.querySelector<HTMLInputElement>(`[data-stenter-quantity="${CSS.escape(id)}"]`)?.value
    const qty = quantityText === undefined ? undefined : quantityText.trim() ? Number(quantityText) : NaN
    if (measured(action) && (!Number.isFinite(qty) || qty! <= 0)) throw new Error('填写所选卷大于零的实际数量。')
    const barcode = action === 'output' ? dialog.querySelector<HTMLInputElement>(`[data-stenter-output-code="${CSS.escape(id)}"]`)!.value.trim() : scanned(action) ? codeFor(roll, action) : undefined
    if (action === 'output' && !barcode) throw new Error('填写每卷实际产出卷码。')
    if (receivingFactoryId(order, action) && (!position[0] || !position[1])) throw new Error('选择实际接收工厂的仓库及库位。')
    return { id, ...(qty !== undefined ? { qty } : {}), ...(barcode ? { barcode } : {}), ...(receivingFactoryId(order, action) ? { warehouseId: position[0], locationId: position[1] } : {}) }
  })
  const type = ({ send: 'SEND', receive: 'RECEIVE', start: 'START', output: 'OUTPUT', handout: 'HANDOUT', 'downstream-receive': 'DOWNSTREAM_RECEIVE' } as const)[action]
  return { type, orderId: order.id, expectedVersion: order.version, rolls, differenceConfirmed: dialog.querySelector<HTMLInputElement>('[data-stenter-difference]')?.checked || false }
}
export function openStenterExecutionDialog(root: HTMLElement, order: StenterHandfeelOrder, action: DialogAction, options: { trigger: HTMLElement; submit: (command: FactoryQcCommand, operationId: string) => Promise<void>; saved: (command: FactoryQcCommand) => void }): void {
  if (root.querySelector('[data-stenter-dialog]')) return
  if (isStenterExecutionAction(action) && !stenterExecutionRolls(order, action).length) throw new Error('当前没有可执行本操作的卷，请重新读取单据。')
  const slot = root.querySelector<HTMLElement>('[data-stenter-operation-slot]')!
  slot.innerHTML = renderDialog(order, action)
  const dialog = slot.querySelector<HTMLDialogElement>('dialog')!, error = dialog.querySelector<HTMLElement>('[data-stenter-dialog-error]')!
  const eligible = isStenterExecutionAction(action) ? stenterExecutionRolls(order, action) : [], codes = new Set<string>()
  let dirty = false, pending = false, intent = '', operationId = '', shownRolls = 50
  const beforeUnload = (event: BeforeUnloadEvent) => { if (!dialog.isConnected) { cleanup(); return }; if (dirty || pending) { event.preventDefault(); event.returnValue = '' } }
  const preventNavigation = (event: MouseEvent) => { if (dialog.isConnected && (dirty || pending) && (event.target as HTMLElement).closest('[data-nav],a[href]') && !dialog.contains(event.target as Node)) { event.preventDefault(); event.stopImmediatePropagation(); requestClose() } }
  const cleanup = () => { window.removeEventListener('beforeunload', beforeUnload); document.removeEventListener('click', preventNavigation, true) }
  const close = () => { cleanup(); dialog.close(); dialog.remove(); if (options.trigger.isConnected) options.trigger.focus() }
  const requestClose = () => { if (pending) return; if (!dirty) { close(); return }; dialog.querySelector<HTMLElement>('[data-stenter-discard]')!.hidden = false; dialog.querySelector<HTMLElement>('[data-stenter-dialog-action="continue"]')!.focus() }
  const update = () => {
    const selected = [...dialog.querySelectorAll<HTMLInputElement>('[data-stenter-selected-roll]:checked')]
    const count = dialog.querySelector('[data-stenter-selected-count]'); if (count) count.textContent = `已选 ${selected.length} / ${eligible.length} 卷`
    const changed = selected.some(input => { const quantity = dialog.querySelector<HTMLInputElement>(`[data-stenter-quantity="${CSS.escape(input.dataset.stenterSelectedRoll!)}"]`); return quantity && quantity.value.trim() && Number(quantity.value) !== Number(quantity.dataset.expected) })
    const difference = dialog.querySelector<HTMLElement>('[data-stenter-difference-row]'); if (difference) difference.hidden = !changed
    if (!changed) { const checkbox = dialog.querySelector<HTMLInputElement>('[data-stenter-difference]'); if (checkbox) checkbox.checked = false }
    const scannedText = dialog.querySelector('[data-stenter-scanned]'); if (scannedText) scannedText.textContent = codes.size ? '已核对：' + [...codes].join('、') : '尚未核对卷码'
  }
  const scan = () => {
    const input = dialog.querySelector<HTMLInputElement>('[data-stenter-scan]')!, code = input.value.trim(), roll = eligible.find(item => codeFor(item, action) === code)
    if (!roll) throw new Error('卷码不在本次可操作范围，请核对实物和加工单。')
    if (codes.has(code)) throw new Error('本卷已经核对，无需重复扫描。')
    if (!dialog.querySelector(`[data-stenter-selected-roll="${CSS.escape(roll.id)}"]`)) dialog.querySelector('[data-stenter-dialog-rolls]')!.insertAdjacentHTML('beforeend', renderRollInputs([roll], action))
    codes.add(code); dialog.querySelector<HTMLInputElement>(`[data-stenter-selected-roll="${CSS.escape(roll.id)}"]`)!.checked = true
    dirty = true; input.value = ''; update(); input.focus()
  }
  for (const type of ['input', 'change']) dialog.addEventListener(type, event => {
    event.stopPropagation(); if (pending) return
    dirty = true; error.textContent = ''
    const input = event.target as HTMLInputElement
    if (input.matches('[data-stenter-quantity],[data-stenter-output-code]') && input.value.trim()) input.closest('[data-stenter-dialog-roll]')!.querySelector<HTMLInputElement>('[data-stenter-selected-roll]')!.checked = true
    if (input.matches('[data-stenter-selected-roll]') && !input.checked) { const roll = eligible.find(item => item.id === input.dataset.stenterSelectedRoll)!; codes.delete(codeFor(roll, action)) }
    if (input.matches('[data-stenter-quantity],[data-stenter-selected-roll]')) { const checkbox = dialog.querySelector<HTMLInputElement>('[data-stenter-difference]'); if (checkbox) checkbox.checked = false }
    update()
  })
  dialog.addEventListener('cancel', event => { event.preventDefault(); requestClose() })
  dialog.addEventListener('keydown', event => { if (event.key === 'Enter' && (event.target as HTMLElement).matches('[data-stenter-scan]')) { event.preventDefault(); event.stopPropagation(); if (!pending) { try { error.textContent = ''; scan() } catch (failure) { error.textContent = failure instanceof Error ? failure.message : String(failure) } } } })
  dialog.addEventListener('click', async event => {
    const control = (event.target as HTMLElement).closest<HTMLElement>('[data-stenter-dialog-action]')
    if (!control) { if (event.target === dialog) requestClose(); return }
    event.preventDefault(); event.stopPropagation(); if (pending) return
    const value = control.dataset.stenterDialogAction
    if (value === 'close') { requestClose(); return }; if (value === 'continue') { dialog.querySelector<HTMLElement>('[data-stenter-discard]')!.hidden = true; return }; if (value === 'discard') { close(); return }
    error.textContent = ''
    let committed = false
    try {
      if (value === 'scan') { scan(); return }
      if (value === 'more') { const next = eligible.slice(shownRolls, shownRolls + 50).filter(roll => !dialog.querySelector(`[data-stenter-selected-roll="${CSS.escape(roll.id)}"]`)); dialog.querySelector('[data-stenter-dialog-rolls]')!.insertAdjacentHTML('beforeend', renderRollInputs(next, action)); shownRolls += 50; if (shownRolls >= eligible.length) control.remove(); return }
      if (value !== 'submit') return
      const command = stenterExecutionCommand(order, action, dialog, codes), nextIntent = JSON.stringify(command)
      if (nextIntent !== intent) { operationId = crypto.randomUUID(); intent = nextIntent }
      pending = true; dialog.setAttribute('aria-busy', 'true'); dialog.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLSelectElement>('input,button,select').forEach(input => { input.disabled = true })
      await options.submit(command, operationId)
      committed = true
      dirty = false; close(); options.saved(command)
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : String(failure)
      const destination = committed ? root.querySelector<HTMLElement>('[data-stenter-error]') || error : error
      destination.textContent = committed ? '数据已保存，页面更新失败。重新打开单据核对：' + message : message.includes('已保存') ? message : '未保存：' + message
      destination.scrollIntoView({ block: 'nearest' })
    }
    finally { pending = false; dialog.removeAttribute('aria-busy'); dialog.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLSelectElement>('input,button,select').forEach(input => { input.disabled = false }) }
  })
  window.addEventListener('beforeunload', beforeUnload); document.addEventListener('click', preventNavigation, true)
  dialog.showModal(); dialog.querySelector<HTMLElement>('[data-stenter-scan],[data-stenter-target],input,button')?.focus()
}
