import { getFinishedInventoryApplication, listFinishedInventoryTransfers, finishedInventoryTransferStatus } from '../../../data/wls/finished-inventory-quality.ts'
import { postFinishingQualitySourceLabel } from '../../../data/fcs/post-finishing-qc-entry.ts'
import { runPostFinishingCommand } from '../../../data/fcs/post-finishing-records.ts'
import { showPostFinishingActionFailure } from './storage-notice.ts'
// @page-pattern: detail

import {
  POST_FINISHING_ACCEPTANCE_ACTORS,
  POST_FINISHING_PROCESS_ITEMS,
  appendPostFinishingProcessCompletion,
  correctPostFinishingProcessCompletion,
  getCurrentPostFinishingActor,
  getPostFinishingFullFlowQcTask,
  getPostFinishingFullFlowPostTask,
  getPostFinishingMaterialReadiness,
  getPostFinishingProcessProgress,
  listPostFinishingFullFlowOutboundOrders,
  submitPostFinishingForOutbound,
  type PostFinishingActor,
  type PostFinishingPostTask,
  type PostFinishingProcessItem,
} from '../../../data/fcs/post-finishing-full-flow.ts'
import { escapeHtml } from '../../../utils.ts'
import { renderPostAction, renderPostFinishingPageHeader, renderPostStatusBadge, renderPostSection } from './shared.ts'

type Progress = ReturnType<typeof getPostFinishingProcessProgress>
type CompletionRecord = Progress['records'][number]
type EntryMode = 'register' | 'outbound' | 'correct'
let message = ''
const intents = new Map<string, string>()
const pending = new Set<string>()
const historyLimits = new Map<string, number>()
const DIALOG_ID = 'post-finishing-process-entry-modal'
let entryReturnFocus: HTMLElement | null = null

let guardInstalled = false
function entryHasUnsavedInput(): boolean {
  const root = document.querySelector<HTMLElement>('[data-post-entry-form]')
  if (!root) return false
  return Array.from(root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea')).some((input) => input instanceof HTMLInputElement && input.type === 'checkbox' ? input.checked !== input.defaultChecked : input.value !== input.defaultValue)
    || Array.from(root.querySelectorAll<HTMLSelectElement>('select')).some((select) => !select.selectedOptions[0]?.defaultSelected)
}
function installEntryGuard(): void {
  if (guardInstalled || typeof document === 'undefined' || typeof window === 'undefined') return
  guardInstalled = true
  window.addEventListener('beforeunload', (event) => {
    if (!entryHasUnsavedInput() && !pending.size) return
    event.preventDefault()
    event.returnValue = ''
  })
  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : undefined
    if (!document.getElementById(DIALOG_ID) || !target?.closest('[data-nav], a[href]')) return
    if (pending.size || (entryHasUnsavedInput() && !window.confirm('本次输入尚未保存，确认离开并放弃？'))) {
      event.preventDefault()
      event.stopImmediatePropagation()
    } else document.getElementById(DIALOG_ID)?.remove()
  }, true)
  document.addEventListener('keydown', (event) => {
    const dialog = document.getElementById(DIALOG_ID)
    if (!dialog) return
    if (event.key === 'Escape') {
      event.preventDefault()
      dialog.querySelector<HTMLButtonElement>('[data-post-finishing-work-order-detail-action="close-entry"]')?.click()
    } else if (event.key === 'Tab') {
      const controls = Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]')).filter((control) => control.getClientRects().length > 0)
      if (!controls.length) return
      const first = controls[0], last = controls.at(-1)!
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { event.preventDefault(); first.focus() }
    }
  })
}
function currentActor(): PostFinishingActor {
  const selected = getCurrentPostFinishingActor(POST_FINISHING_ACCEPTANCE_ACTORS.postOperator.actorId)
  return postActors().find((actor) => actor.actorId === selected.actorId) || POST_FINISHING_ACCEPTANCE_ACTORS.postOperator
}
function postActors(): PostFinishingActor[] { return (Object.values(POST_FINISHING_ACCEPTANCE_ACTORS) as PostFinishingActor[]).filter((actor) => actor.roleName === '后道操作员' || actor.roleName === '后道主管') }
function supervisorConfirmation(): string {
  const supervisors = postActors().filter((actor) => actor.roleName === '后道主管')
  return `<label class="block text-sm">实际核对主管<select class="mt-1 h-10 w-full rounded-md border px-3" required data-post-entry-supervisor><option value="" selected>请选择实际核对主管</option>${supervisors.map((actor) => `<option value="${escapeHtml(actor.actorId)}">${escapeHtml(actor.actorName)} · ${escapeHtml(actor.roleName)}</option>`).join('')}</select></label>`
}
function readSupervisor(root: HTMLElement): PostFinishingActor {
  const actorId = root.querySelector<HTMLSelectElement>('[data-post-entry-supervisor]')?.value || ''
  const supervisor = postActors().find((actor) => actor.actorId === actorId && actor.roleName === '后道主管')
  if (!supervisor) throw new Error('请选择本次实际核对主管。')
  return supervisor
}
function query(): URLSearchParams { return typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search) }
function operationId(key: string): string {
  if (!intents.has(key)) intents.set(key, globalThis.crypto.randomUUID())
  return intents.get(key)!
}
function skuImage(line: PostFinishingPostTask['lines'][number]): string {
  const label = `${line.sku.spuName} ${line.sku.skuCode} ${line.sku.colorName} ${line.sku.sizeName}`
  return `<button type="button" class="relative flex h-14 w-14 shrink-0 cursor-zoom-in items-center justify-center overflow-hidden rounded-lg border bg-slate-50" data-post-finishing-action="full-flow-zoom-image" data-image-url="${escapeHtml(line.sku.imageUrl)}" data-image-label="${escapeHtml(label)}"><img src="${escapeHtml(line.sku.imageUrl)}" alt="${escapeHtml(label)}" class="h-full w-full object-contain" onload="this.nextElementSibling.hidden=true" onerror="this.hidden=true;this.nextElementSibling.textContent='图片加载失败';this.nextElementSibling.hidden=false"/><span class="px-1 text-center text-[9px] text-slate-500">图片加载中…</span></button>`
}
function processCards(task: PostFinishingPostTask, progress: Progress): string {
  return `<section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="各加工项进度">${POST_FINISHING_PROCESS_ITEMS.map((processItem) => {
    const item = progress.processes.find((process) => process.processItem === processItem)!
    const status = !item.applicable ? '不涉及' : item.completedQty >= item.expectedQty ? '已完成' : item.completedQty > 0 ? '部分完成' : '待加工'
    return `<article class="rounded-xl border bg-card p-4" data-post-process-card="${escapeHtml(processItem)}"><div class="flex items-center justify-between gap-2"><h3 class="font-semibold">${escapeHtml(processItem)}</h3><span class="text-xs text-muted-foreground">${status}</span></div>${item.applicable ? `<div class="mt-3 text-lg font-semibold">${item.completedQty} / ${item.expectedQty} 件</div><div class="mt-1 text-xs text-muted-foreground">本项可登记 ${`${item.availableQty} 件`}</div>${ item.availableQty === 0 && item.completedQty < item.expectedQty ? '<p class="mt-1 text-xs text-amber-700">前序尚未有可登记数量</p>' : ''}${ item.availableQty > 0 ? `<button type="button" class="mt-3 h-9 rounded-md bg-blue-600 px-3 text-sm font-medium text-white" data-post-finishing-work-order-detail-action="open-register" data-task-id="${escapeHtml(task.postTaskId)}" data-process-item="${escapeHtml(processItem)}">登记${escapeHtml(processItem)}</button>` : ''}` : '<div class="mt-3 text-sm text-muted-foreground">本单无需加工此项</div>'}</article>`
  }).join('')}</section>`
}
function skuProgress(task: PostFinishingPostTask, progress: Progress): string {
  return `<section class="rounded-xl border bg-card p-4"><h3 class="font-semibold">SKU加工进度 <span class="text-xs font-normal text-muted-foreground">数量单位：件</span></h3><div class="mt-3 grid gap-3 xl:grid-cols-2">${task.lines.map((line) => {
    const current = progress.lines.find((item) => item.sku.skuId === line.sku.skuId)!
    return `<article class="min-w-0 rounded-lg border p-3"><div class="flex gap-3">${skuImage(line)}<div class="min-w-0"><div class="break-all font-mono text-sm font-semibold">${escapeHtml(line.sku.skuCode)}</div><div class="mt-1 text-xs text-muted-foreground">${escapeHtml(line.sku.spuName)} · ${escapeHtml(line.sku.colorName)} / ${escapeHtml(line.sku.sizeName)}</div><div class="mt-1 text-sm">应加工 ${current.expectedQty} · 全部后道完成 ${current.completedQty}</div></div></div><dl class="mt-3 grid grid-cols-2 gap-2 text-xs">${progress.processes.map((item) => {
      const sku = item.lines.find((row) => row.sku.skuId === line.sku.skuId)
      return `<div class="rounded bg-slate-50 px-2 py-1.5"><dt class="text-muted-foreground">${escapeHtml(item.processItem)}</dt><dd class="mt-1 font-medium">${!item.applicable ? '不涉及' : `${sku?.completedQty ?? 0} / ${sku?.expectedQty ?? current.expectedQty}`}</dd></div>`
    }).join('')}<div><dt class="text-muted-foreground">已准备出货</dt><dd class="mt-1">${current.reservedQty}</dd></div><div><dt class="text-muted-foreground">可准备出货</dt><dd class="mt-1 font-semibold text-blue-700">${current.availableForOutboundQty}</dd></div></dl></article>`
  }).join('')}</div></section>`
}
function effectiveQuantities(record: CompletionRecord, records: CompletionRecord[]): Array<{ skuId: string; quantity: number }> {
  return record.quantities.map((line) => ({ skuId: line.skuId, quantity: line.quantity + records.filter((entry) => entry.correctionOf === record.recordId).reduce((sum, entry) => sum + (entry.quantities.find((item) => item.skuId === line.skuId)?.quantity || 0), 0) }))
}
function recordsHtml(task: PostFinishingPostTask, progress: Progress): string {
  const limit = historyLimits.get(task.postTaskId) || 20
  const records = [...progress.records].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)).slice(0, limit)
  return `<section id="records" class="rounded-xl border bg-card p-4"><h3 class="font-semibold">加工登记记录 <span class="text-xs font-normal text-muted-foreground">${progress.records.length} 次</span></h3><div class="mt-3 space-y-3">${records.map((record) => {
    const lines = record.quantities
    const corrected = !record.correctionOf && progress.records.some((item) => item.correctionOf === record.recordId)
      ? effectiveQuantities(record, progress.records).map((item) => `${task.lines.find((line) => line.sku.skuId === item.skuId)?.sku.skuCode || '未知SKU'}：${item.quantity} 件`).join('；') : ''
    const text = lines.map((item) => `${task.lines.find((line) => line.sku.skuId === item.skuId)?.sku.skuCode || '未知SKU'}：${item.quantity > 0 && record.correctionOf ? '+' : ''}${item.quantity} 件`).join('；')
    return `<article class="rounded-lg border p-3"><div class="flex flex-wrap items-start justify-between gap-2"><div class="font-medium">${escapeHtml(record.processItem)}${record.correctionOf ? ' · 订正调整' : ''}</div><span class="text-xs text-muted-foreground">${escapeHtml(new Date(record.recordedAt).toLocaleString('zh-CN'))}</span></div><div class="mt-2 break-words text-sm">${escapeHtml(text)}</div>${corrected ? `<div class="mt-1 text-xs text-amber-800">订正后有效量：${escapeHtml(corrected)}</div>` : ''}<div class="mt-2 text-xs text-muted-foreground">加工责任：${escapeHtml(record.responsible.actorName)} · 录入：${escapeHtml(record.recordedBy.actorName)}</div>${record.reason ? `<p class="mt-2 text-xs text-amber-800">订正原因：${escapeHtml(record.reason)}</p>` : ''}${!record.correctionOf ? `<button type="button" class="mt-2 text-xs text-amber-700 underline" data-post-finishing-work-order-detail-action="open-correct" data-task-id="${escapeHtml(task.postTaskId)}" data-record-id="${escapeHtml(record.recordId)}">订正本次登记</button>` : ''}</article>`
  }).join('') || '<p class="text-sm text-muted-foreground">尚无逐项登记记录。</p>'}</div>${progress.records.length > limit ? `<button type="button" class="mt-3 rounded-md border px-3 py-2 text-sm" data-post-finishing-work-order-detail-action="more-records" data-task-id="${escapeHtml(task.postTaskId)}">再显示20条</button>` : ''}</section>`
}
function downstreamHtml(task: PostFinishingPostTask): string {
  const records=listPostFinishingFullFlowOutboundOrders().filter(row=>row.postTaskId===task.postTaskId)
  return `<section class="rounded-xl border bg-card p-4"><h3 class="font-semibold">出货记录</h3><div class="mt-3 space-y-3">${records.map(row=>`<article class="rounded border p-3"><a data-nav="/fcs/craft/post-finishing/outbound-orders/${encodeURIComponent(row.outboundOrderId)}" class="font-mono text-blue-700 underline">${escapeHtml(row.outboundOrderNo)}</a><p class="mt-2 text-sm">${row.lines.reduce((sum,line)=>sum+line.outboundQty,0)} 件 · ${escapeHtml(row.status)}</p><p class="text-xs">实际发出：${escapeHtml(row.dispatchedBy?.actorName||'尚未发出')}；实收：${escapeHtml(row.receivedBy?.actorName||'尚未接收')}</p></article>`).join('')||'<p class="text-sm text-muted-foreground">尚未准备出货。</p>'}</div></section>`
}
function entryDialog(task: PostFinishingPostTask, mode: EntryMode, processItem?: PostFinishingProcessItem, recordId = ''): string {
  const progress = getPostFinishingProcessProgress(task)
  const record = progress.records.find((entry) => entry.recordId === recordId)
  const item = progress.processes.find((entry) => entry.processItem === (processItem || record?.processItem) && entry.applicable)
  if (mode !== 'outbound' && !item) return ''
  if (mode === 'correct' && (!record || record.correctionOf)) return ''
  const key = `${task.postTaskId}:${mode}:${item?.processItem || ''}:${recordId}`
  const actors = postActors()
  const responsible = actors.find((actor) => actor.actorId === currentActor().actorId) || actors[0]
  const corrected = record ? effectiveQuantities(record, progress.records) : []
  const title = mode === 'outbound' ? '准备出货' : mode === 'correct' ? `订正${item!.processItem}登记` : `登记${item!.processItem}`
  const lines = mode === 'outbound' ? progress.lines : item!.lines
  return `<div id="${DIALOG_ID}" class="fixed inset-0 z-[210] flex items-center justify-center bg-black/40 p-4" data-skip-page-rerender="true"><section class="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border bg-background shadow-2xl" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}" data-post-entry-form data-task-id="${escapeHtml(task.postTaskId)}" data-mode="${mode}" data-process-item="${escapeHtml(item?.processItem || '')}" data-record-id="${escapeHtml(recordId)}" data-intent-key="${escapeHtml(key)}" data-operation-id="${escapeHtml(operationId(key))}"><header class="flex items-center justify-between gap-3 border-b px-4 py-3"><h2 class="font-semibold">${escapeHtml(title)}</h2><button type="button" class="rounded-md border px-3 py-1.5 text-sm" data-post-finishing-work-order-detail-action="close-entry">关闭</button></header><div class="space-y-4 p-4"><p class="break-all font-mono text-sm">${escapeHtml(task.postTaskNo)}</p><p class="text-sm text-muted-foreground">${mode === 'outbound' ? '填写本次准备出货量，保存后生成待出货单。实际发出仍需单独确认，不能把准备量当已发出。' : mode === 'correct' ? '填写这次原登记订正后的数量。保留原记录和原因，后序或已准备出货占用不能被破坏。' : '填写本次实际完成量，系统自动累计；本次未加工的SKU保留0。'}</p>${mode === 'register' ? `<label class="block text-sm">本次加工责任人<select class="mt-1 h-10 w-full rounded-md border px-3" data-post-entry-responsible>${actors.map((actor) => `<option value="${escapeHtml(actor.actorId)}" ${actor.actorId === responsible.actorId ? 'selected' : ''}>${escapeHtml(actor.actorName)} · ${escapeHtml(actor.roleName)}</option>`).join('')}</select></label>` : mode === 'correct' ? supervisorConfirmation() : ''}<div class="space-y-3">${lines.filter((line) => mode !== 'correct' || corrected.some((entry) => entry.skuId === line.sku.skuId)).map((line) => {
    const taskLine = task.lines.find((entry) => entry.sku.skuId === line.sku.skuId)!
    const available = mode === 'outbound' ? progress.lines.find((entry) => entry.sku.skuId === line.sku.skuId)!.availableForOutboundQty : item!.lines.find((entry) => entry.sku.skuId === line.sku.skuId)!.availableQty
    const full = progress.lines.find((entry) => entry.sku.skuId === line.sku.skuId)!
    return `<article class="rounded-lg border p-3" data-post-entry-line="${escapeHtml(line.sku.skuId)}"><div class="flex gap-3">${skuImage(taskLine)}<div class="min-w-0 flex-1"><div class="break-all font-mono text-sm font-medium">${escapeHtml(line.sku.skuCode)}</div><div class="mt-1 text-xs text-muted-foreground">${escapeHtml(line.sku.colorName)} / ${escapeHtml(line.sku.sizeName)}</div><div class="mt-1 text-xs">${mode === 'outbound' ? `全部后道完成 ${full.completedQty} · 已准备出货 ${full.reservedQty} · 可交 ${available}` : mode === 'correct' ? `原登记 ${record!.quantities.find((entry) => entry.skuId === line.sku.skuId)?.quantity || 0} · 当前有效 ${corrected.find((entry) => entry.skuId === line.sku.skuId)?.quantity || 0}` : `本项累计 ${line.completedQty} · 本次可登记 ${available}`} 件</div></div></div><label class="mt-3 block text-sm">${mode === 'outbound' ? '本次准备出货数量' : mode === 'correct' ? '订正后的原登记数量' : '本次完成数量'}<input type="number" min="0" ${mode === 'correct' ? '' : `max="${available}"`} step="1" inputmode="numeric" value="${mode === 'correct' ? corrected.find((entry) => entry.skuId === line.sku.skuId)?.quantity || 0 : 0}" class="mt-1 h-10 w-full rounded-md border px-3 text-right" data-post-entry-quantity /></label></article>`
  }).join('')}</div>${mode === 'correct' ? '<label class="block text-sm">订正原因<textarea class="mt-1 min-h-20 w-full rounded-md border px-3 py-2" data-post-entry-reason placeholder="说明实际误录及订正依据"></textarea></label>' : ''}<div class="flex justify-end gap-2"><button type="button" class="rounded-md border px-4 py-2 text-sm" data-post-finishing-work-order-detail-action="close-entry">取消</button><button type="button" class="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white" data-post-finishing-work-order-detail-action="save-entry">${mode === 'outbound' ? '确认准备出货' : mode === 'correct' ? '保存订正' : '保存本次完成'}</button></div></div></section></div>`
}
function openEntry(task: PostFinishingPostTask, mode: EntryMode, processItem?: PostFinishingProcessItem, recordId = ''): void {
  entryReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  document.getElementById(DIALOG_ID)?.remove()
  const host = document.getElementById('app') || document.body
  host.insertAdjacentHTML('beforeend', entryDialog(task, mode, processItem, recordId))
  document.querySelector<HTMLElement>('[data-post-entry-supervisor], [data-post-entry-quantity]')?.focus()
}
function renderTask(task: PostFinishingPostTask, withQueryAction = true): string {
  const progress = getPostFinishingProcessProgress(task)
  const material = task.inventoryApplicationId ? {applicable:false,status:'不适用',label:'成衣库存质检按本批加工项目办理'} : getPostFinishingMaterialReadiness(task.productionOrderNo)
  const current = task.inventoryApplicationId ? getCurrentPostFinishingActor(POST_FINISHING_ACCEPTANCE_ACTORS.postOperator.actorId) : currentActor()
  const first = progress.processes.find((item) => item.applicable && item.availableQty > 0) || progress.processes.find((item) => item.applicable)
  const action = withQueryAction ? query().get('action') : ''
  const autoDialog = action === 'register' && first ? entryDialog(task, 'register', first.processItem) : action === 'outbound' && progress.availableForOutboundQty > 0 ? entryDialog(task, 'outbound') : ''
  return `<div class="min-w-0 space-y-4 p-4" data-web-post-task="${escapeHtml(task.postTaskId)}" data-skip-page-rerender="true">${renderPostFinishingPageHeader('后道加工单详情', `${task.postTaskNo} / ${task.productionOrderNo}`, `<div class="flex flex-wrap items-end gap-2"><a data-nav="/fcs/craft/post-finishing/work-orders" class="inline-flex h-9 items-center rounded-md border bg-white px-3 text-sm">返回列表</a></div>`)}${message ? `<div role="status" class="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">${escapeHtml(message)}</div>` : ''}${material.applicable && material.status !== '已入库' ? `<section class="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"><strong>后道辅料未到齐。</strong>${escapeHtml(material.label)}。现场核对后仍可登记加工。</section>` : ''}<section class="rounded-xl border bg-card p-4"><div class="flex flex-wrap items-start justify-between gap-4"><div><h2 class="break-all font-mono text-lg font-semibold">${escapeHtml(task.postTaskNo)}</h2><p class="mt-2 text-sm text-blue-700">业务类型：${postFinishingQualitySourceLabel(getPostFinishingFullFlowQcTask(task.qcTaskId)?.sourceKind)}</p><div class="mt-1 break-all text-sm text-muted-foreground">质检单 ${escapeHtml(task.qcTaskNo)} · ${task.inventoryApplicationId ? '送检申请' : '回货单'} ${escapeHtml(task.deliveryOrderNo)}</div><div class="mt-2 text-sm">实际加工链：${task.processItems.map(escapeHtml).join(' → ')}</div></div><div class="text-right">${renderPostStatusBadge(task.status)}<div class="mt-2 text-xs text-muted-foreground">当前录入人：${escapeHtml(current.actorName)}</div></div></div><div class="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">${[['应加工', progress.totalExpectedQty], ['全部后道完成', progress.totalCompletedQty], ['已准备出货', progress.totalReservedQty], ['可准备出货', progress.availableForOutboundQty]].map(([label, quantity]) => `<div class="rounded-lg bg-slate-50 p-3"><div class="text-xs text-muted-foreground">${label}</div><div class="mt-1 font-semibold">${quantity} 件</div></div>`).join('')}</div>${ progress.availableForOutboundQty > 0 && !task.inventoryApplicationId ? `<button type="button" class="mt-4 rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white" data-post-finishing-work-order-detail-action="open-outbound" data-task-id="${escapeHtml(task.postTaskId)}">准备出货 · 可交 ${progress.availableForOutboundQty} 件</button>` : ''}</section>${processCards(task, progress)}${skuProgress(task, progress)}${task.inventoryApplicationId ? inventoryDownstreamHtml(task) : downstreamHtml(task)}${recordsHtml(task, progress)}${autoDialog}</div>`
}
function refreshTask(taskId: string): void {
  document.querySelector('[data-post-finishing-action-error]')?.remove()
  const task = getPostFinishingFullFlowPostTask(taskId)
  const root = document.querySelector<HTMLElement>('[data-web-post-task]')
  if (task && root) root.outerHTML = renderTask(task, false)
}
function readQuantities(root: HTMLElement): Array<{ skuId: string; quantity: number }> {
  return Array.from(root.querySelectorAll<HTMLElement>('[data-post-entry-line]')).map((line) => {
    const value = line.querySelector<HTMLInputElement>('[data-post-entry-quantity]')?.value.trim() || ''
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) throw new Error('各SKU数量必须填写0或正整数，不能留空、小数或负数。')
    return { skuId: line.dataset.postEntryLine || '', quantity: Number(value) }
  })
}
export async function handlePostFinishingWorkOrderDetailEvent(target: HTMLElement): Promise<boolean> {
  if (typeof window === 'undefined' || !window.location.pathname.startsWith('/fcs/craft/post-finishing/work-orders/')) return false
  const node = target.closest<HTMLElement>('[data-post-finishing-work-order-detail-action]')
  const action = node?.dataset.postFinishingWorkOrderDetailAction
  if (!node || !action) return false
  const taskId = node.dataset.taskId || target.closest<HTMLElement>('[data-post-entry-form]')?.dataset.taskId || decodeURIComponent(window.location.pathname.split('/').pop() || '')
  try {
    if (action === 'close-entry') {
      const root = document.querySelector<HTMLElement>('[data-post-entry-form]')
      if (root && pending.has(root.dataset.intentKey || '')) return true
      const changed = entryHasUnsavedInput()
      if (changed && !window.confirm('本次输入尚未保存，确认放弃并关闭？')) return true
      if (root?.dataset.intentKey) intents.delete(root.dataset.intentKey)
      document.getElementById(DIALOG_ID)?.remove()
      if (entryReturnFocus?.isConnected) entryReturnFocus.focus()
      else document.querySelector<HTMLElement>('[data-web-post-task] button, [data-web-post-task] a')?.focus()
      return true
    }
    const task = getPostFinishingFullFlowPostTask(taskId)
    if (!task) throw new Error('未找到当前后道加工单，请重新读取。')
    if (action === 'open-register') openEntry(task, 'register', node.dataset.processItem as PostFinishingProcessItem)
    else if (action === 'open-outbound') openEntry(task, 'outbound')
    else if (action === 'open-correct') openEntry(task, 'correct', undefined, node.dataset.recordId)
    else if (action === 'more-records') {
      historyLimits.set(taskId, (historyLimits.get(taskId) || 20) + 20)
      const prior = document.getElementById('records')
      if (prior) prior.outerHTML = recordsHtml(task, getPostFinishingProcessProgress(task))
    } else if (action === 'save-entry') {
      const root = target.closest<HTMLElement>('[data-post-entry-form]')
      if (!root) throw new Error('未找到当前登记表单。')
      const key = root.dataset.intentKey || ''
      if (pending.has(key)) return true
      const mode = root.dataset.mode as EntryMode
      const values = readQuantities(root)
      const actor = mode === 'correct' ? readSupervisor(root) : task.inventoryApplicationId ? getCurrentPostFinishingActor(POST_FINISHING_ACCEPTANCE_ACTORS.postOperator.actorId) : currentActor()
      const intent = root.dataset.operationId || ''
      const responsibleId = root.querySelector<HTMLSelectElement>('[data-post-entry-responsible]')?.value
      const responsible = postActors().find((item) => item.actorId === responsibleId)
      const reason = root.querySelector<HTMLTextAreaElement>('[data-post-entry-reason]')?.value.trim() || ''
      const total = values.reduce((sum, line) => sum + line.quantity, 0)
      if (mode !== 'correct' && total === 0) throw new Error('至少一个SKU的本次数量大于0。')
      if (mode === 'register' && !responsible) throw new Error('请选择本次加工责任人。')
      if (mode === 'correct' && !reason) throw new Error('请填写订正原因。')
      if (mode === 'outbound' && !window.confirm(`${task.postTaskNo} 本次准备出货 ${total} 件。保存成功即占用这些数量，确认准备出货？`)) return true
      if (mode === 'correct' && !window.confirm(`${actor.actorName}核对：本次原登记订正后的数量合计 ${total} 件。原记录将保留，确认保存订正？`)) return true
      pending.add(key)
      const button = node as HTMLButtonElement
      button.disabled = true
      try {
        if (mode === 'outbound') {
          const outbound = await runPostFinishingCommand(() => submitPostFinishingForOutbound({ postTaskId: taskId, quantities: values, actor, operationId: intent }))
          message = `已准备出货 ${total} 件，出货单 ${outbound.outboundOrderNo}。`
        } else if (mode === 'correct') {
          await runPostFinishingCommand(() => correctPostFinishingProcessCompletion({ recordId: root.dataset.recordId || '', quantities: values, reason, actor, operationId: intent }))
          message = '本次订正已保存，原登记及订正原因均已保留。'
        } else {
          const processItem = root.dataset.processItem as PostFinishingProcessItem
          await runPostFinishingCommand(() => appendPostFinishingProcessCompletion({ postTaskId: taskId, processItem, quantities: values, responsible: responsible!, actor, operationId: intent }))
          const progress = getPostFinishingProcessProgress(taskId)
          const process = progress.processes.find((item) => item.processItem === processItem)!
          message = `${processItem}本次 +${total} 件，累计 ${process.completedQty} 件；当前可准备出货 ${progress.availableForOutboundQty} 件。`
        }
        intents.delete(key)
        document.getElementById(DIALOG_ID)?.remove()
        refreshTask(taskId)
        document.querySelector<HTMLElement>('[data-web-post-task] button, [data-web-post-task] a')?.focus()
      } finally { pending.delete(key); button.disabled = false }
    } else return false
  } catch (error) { showPostFinishingActionFailure(`${error instanceof Error ? error.message : String(error)} 本次输入已保留。`, target) }
  return true
}
function inventoryDownstreamHtml(task: PostFinishingPostTask): string {
  const app = getFinishedInventoryApplication(task.inventoryApplicationId!)
  const transfers = listFinishedInventoryTransfers(task.inventoryApplicationId).filter(row=>row.category==='正常返仓')
  return `<section class="rounded-xl border bg-white p-4"><h2 class="font-semibold">成衣库存质检出货</h2><p class="my-2 text-sm">正常货须全部加工项完成后整批交出；各SKU按正常可放行量登记，不另建分批出货。</p>${transfers.map(row=>`<p class="my-2 text-sm">${escapeHtml(row.applicationNo)}-RETURN · ${row.lines.reduce((n,line)=>n+line.quantity,0)} 件 · ${escapeHtml(finishedInventoryTransferStatus(row))}</p>`).join('')}<a class="text-blue-700 underline" href="/fcs/craft/post-finishing/outbound-orders?sourceKind=WAREHOUSE_STOCK&keyword=${encodeURIComponent(app?.applicationNo || task.deliveryOrderNo)}" data-nav="/fcs/craft/post-finishing/outbound-orders?sourceKind=WAREHOUSE_STOCK&keyword=${encodeURIComponent(app?.applicationNo || task.deliveryOrderNo)}">进入后道出货单</a></section>`
}
export function renderPostFinishingWorkOrderDetailPage(postOrderId: string): string {
  installEntryGuard()
  const task = getPostFinishingFullFlowPostTask(postOrderId)
  if (task) return renderTask(task)
  return `<div class="space-y-4 p-4">${renderPostFinishingPageHeader('后道加工单详情', '', renderPostAction('返回后道加工单列表', '/fcs/craft/post-finishing/work-orders'))}${renderPostSection('未找到当前后道加工单', `<p class="text-sm text-muted-foreground">未找到加工单 ${escapeHtml(postOrderId)}。请返回列表核对单号。</p>`)}</div>`
}
