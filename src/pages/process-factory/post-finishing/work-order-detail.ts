import { runPostFinishingCommand } from '../../../data/fcs/post-finishing-records.ts'
import { showPostFinishingActionFailure } from './storage-notice.ts'
// @page-pattern: detail

import {
  POST_FINISHING_ACCEPTANCE_ACTORS,
  POST_FINISHING_PROCESS_ITEMS,
  appendPostFinishingProcessCompletion,
  correctPostFinishingProcessCompletion,
  confirmPostFinishingLegacyCarryover,
  getCurrentPostFinishingActor,
  getPostFinishingFullFlowPostTask,
  getPostFinishingMaterialReadiness,
  getPostFinishingProcessProgress,
  listPostFinishingFullFlowRecheckOrders,
  listPostFinishingFullFlowOutboundOrders,
  submitPostFinishingForRecheck,
  type PostFinishingActor,
  type PostFinishingPostTask,
  type PostFinishingProcessItem,
} from '../../../data/fcs/post-finishing-full-flow.ts'
import { escapeHtml } from '../../../utils.ts'
import { renderPostAction, renderPostFinishingPageHeader, renderPostStatusBadge, renderPostSection } from './shared.ts'

type Progress = ReturnType<typeof getPostFinishingProcessProgress>
type CompletionRecord = Progress['records'][number]
type EntryMode = 'register' | 'recheck' | 'correct' | 'legacy'
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
    const historical = task.executionModel !== 'ITEMS_V1' && !task.legacyCarryover
    const status = historical ? '历史未分项' : !item.applicable ? '不涉及' : progress.legacyPending ? '历史未分项' : item.completedQty >= item.expectedQty ? '已完成' : item.completedQty > 0 ? '部分完成' : '待加工'
    return `<article class="rounded-xl border bg-card p-4" data-post-process-card="${escapeHtml(processItem)}"><div class="flex items-center justify-between gap-2"><h3 class="font-semibold">${escapeHtml(processItem)}</h3><span class="text-xs text-muted-foreground">${status}</span></div>${item.applicable || historical ? `<div class="mt-3 text-lg font-semibold">${historical || progress.legacyPending ? '历史未分项' : `${progress.lines.some((line) => line.historyCompletedQty > 0) ? '新增 ' : ''}${item.completedQty} / ${item.expectedQty} 件`}</div><div class="mt-1 text-xs text-muted-foreground">本项可登记 ${progress.legacyPending ? '待核对' : `${item.availableQty} 件`}</div>${!progress.legacyPending && item.availableQty === 0 && item.completedQty < item.expectedQty ? '<p class="mt-1 text-xs text-amber-700">前序尚未有可登记数量</p>' : ''}${!progress.legacyPending && item.availableQty > 0 ? `<button type="button" class="mt-3 h-9 rounded-md bg-blue-600 px-3 text-sm font-medium text-white" data-post-finishing-work-order-detail-action="open-register" data-task-id="${escapeHtml(task.postTaskId)}" data-process-item="${escapeHtml(processItem)}">登记${escapeHtml(processItem)}</button>` : ''}` : '<div class="mt-3 text-sm text-muted-foreground">本单无需加工此项</div>'}</article>`
  }).join('')}</section>`
}
function skuProgress(task: PostFinishingPostTask, progress: Progress): string {
  return `<section class="rounded-xl border bg-card p-4"><h3 class="font-semibold">SKU加工进度 <span class="text-xs font-normal text-muted-foreground">数量单位：件</span></h3><div class="mt-3 grid gap-3 xl:grid-cols-2">${task.lines.map((line) => {
    const current = progress.lines.find((item) => item.sku.skuId === line.sku.skuId)!
    return `<article class="min-w-0 rounded-lg border p-3"><div class="flex gap-3">${skuImage(line)}<div class="min-w-0"><div class="break-all font-mono text-sm font-semibold">${escapeHtml(line.sku.skuCode)}</div><div class="mt-1 text-xs text-muted-foreground">${escapeHtml(line.sku.spuName)} · ${escapeHtml(line.sku.colorName)} / ${escapeHtml(line.sku.sizeName)}</div><div class="mt-1 text-sm">应加工 ${current.expectedQty} · 全部后道完成 ${current.completedQty}</div></div></div><dl class="mt-3 grid grid-cols-2 gap-2 text-xs">${progress.processes.map((item) => {
      const sku = item.lines.find((row) => row.sku.skuId === line.sku.skuId)
      return `<div class="rounded bg-slate-50 px-2 py-1.5"><dt class="text-muted-foreground">${escapeHtml(item.processItem)}</dt><dd class="mt-1 font-medium">${task.executionModel !== 'ITEMS_V1' && !task.legacyCarryover ? '历史未分项' : !item.applicable ? '不涉及' : progress.legacyPending ? '历史未分项' : `${current.historyCompletedQty > 0 ? '新增 ' : ''}${sku?.completedQty ?? 0} / ${sku?.expectedQty ?? current.expectedQty}`}</dd></div>`
    }).join('')}<div><dt class="text-muted-foreground">已交复检</dt><dd class="mt-1">${current.reservedQty}</dd></div><div><dt class="text-muted-foreground">可交复检</dt><dd class="mt-1 font-semibold text-blue-700">${current.availableForRecheckQty}</dd></div></dl></article>`
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
    return `<article class="rounded-lg border p-3"><div class="flex flex-wrap items-start justify-between gap-2"><div class="font-medium">${escapeHtml(record.processItem)}${record.correctionOf ? ' · 订正调整' : ''}</div><span class="text-xs text-muted-foreground">${escapeHtml(new Date(record.recordedAt).toLocaleString('zh-CN'))}</span></div><div class="mt-2 break-words text-sm">${escapeHtml(text)}</div>${corrected ? `<div class="mt-1 text-xs text-amber-800">订正后有效量：${escapeHtml(corrected)}</div>` : ''}<div class="mt-2 text-xs text-muted-foreground">加工责任：${escapeHtml(record.responsible.actorName)} · 录入：${escapeHtml(record.recordedBy.actorName)}</div>${record.reason ? `<p class="mt-2 text-xs text-amber-800">订正原因：${escapeHtml(record.reason)}</p>` : ''}${!record.correctionOf && !progress.legacyPending ? `<button type="button" class="mt-2 text-xs text-amber-700 underline" data-post-finishing-work-order-detail-action="open-correct" data-task-id="${escapeHtml(task.postTaskId)}" data-record-id="${escapeHtml(record.recordId)}">订正本次登记</button>` : ''}</article>`
  }).join('') || '<p class="text-sm text-muted-foreground">尚无逐项登记记录。</p>'}</div>${progress.records.length > limit ? `<button type="button" class="mt-3 rounded-md border px-3 py-2 text-sm" data-post-finishing-work-order-detail-action="more-records" data-task-id="${escapeHtml(task.postTaskId)}">再显示20条</button>` : ''}</section>`
}
function legacyEvidenceHtml(task: PostFinishingPostTask): string {
  if (task.executionModel === 'ITEMS_V1' || (!task.results?.length && !task.draftLines?.length)) return ''
  return `<section class="rounded-xl border border-amber-200 bg-amber-50 p-4"><h3 class="font-semibold">原合并加工记录</h3><p class="mt-1 text-xs text-amber-900">保留原结果与草稿，仅作历史依据；草稿不自动计入整套已完成量。</p><div class="mt-3 space-y-2">${task.lines.map((line) => {
    const result = task.results?.find((item) => item.sku.skuId === line.sku.skuId)
    const draft = task.draftLines?.find((item) => item.skuId === line.sku.skuId)
    const prior = result || draft
    return prior ? `<div class="rounded border border-amber-200 bg-white p-2 text-xs"><strong class="font-mono">${escapeHtml(line.sku.skuCode)}</strong> · ${result ? '原结果' : '旧草稿'}：已处理 ${prior.processedQty} 件，未处理 ${prior.unprocessedQty} 件${prior.unprocessedReason ? `<div class="mt-1">原未处理说明：${escapeHtml(prior.unprocessedReason)}</div>` : ''}</div>` : ''
  }).join('')}</div></section>`
}
function downstreamHtml(task: PostFinishingPostTask): string {
  const rechecks = listPostFinishingFullFlowRecheckOrders().filter((item) => item.postTaskId === task.postTaskId)
  const outbounds = listPostFinishingFullFlowOutboundOrders().filter((item) => item.postTaskId === task.postTaskId)
  return `<section class="rounded-xl border bg-card p-4"><h3 class="font-semibold">复检与出货记录</h3><div class="mt-3 space-y-3">${rechecks.map((record) => {
    const outbound = outbounds.find((item) => item.recheckOrderId === record.recheckOrderId)
    return `<article class="rounded-lg border p-3"><div class="flex flex-wrap justify-between gap-2"><a data-nav="/fcs/craft/post-finishing/recheck-orders?id=${encodeURIComponent(record.recheckOrderId)}" class="break-all font-mono text-sm font-semibold text-blue-700 underline">${escapeHtml(record.recheckOrderNo)}</a>${renderPostStatusBadge(record.status)}</div><div class="mt-2 text-xs">本次交复检 ${record.lines.reduce((sum, line) => sum + line.expectedQty, 0)} 件${record.claimedBy ? ` · 复检员 ${escapeHtml(record.claimedBy.actorName)}` : ''}</div>${outbound ? `<div class="mt-2 text-xs"><a data-nav="/fcs/craft/post-finishing/outbound-orders/${encodeURIComponent(outbound.outboundOrderId)}" class="break-all font-mono text-blue-700 underline">${escapeHtml(outbound.outboundOrderNo)}</a> · ${outbound.lines.reduce((sum, line) => sum + line.outboundQty, 0)} 件 · ${escapeHtml(outbound.status)}${outbound.receivedBy ? ` · 实收人 ${escapeHtml(outbound.receivedBy.actorName)}` : ''}</div>` : '<div class="mt-2 text-xs text-muted-foreground">复检完成后生成本次出货单</div>'}</article>`
  }).join('') || '<p class="text-sm text-muted-foreground">尚未交复检。</p>'}</div></section>`
}
function legacyDialog(task: PostFinishingPostTask): string {
  const key = `${task.postTaskId}:legacy`
  return `<div id="${DIALOG_ID}" class="fixed inset-0 z-[210] flex items-center justify-center bg-black/40 p-4" data-skip-page-rerender="true"><section class="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl border bg-background shadow-2xl" role="dialog" aria-modal="true" aria-label="核对历史承接" data-post-entry-form data-task-id="${escapeHtml(task.postTaskId)}" data-mode="legacy" data-intent-key="${escapeHtml(key)}"><header class="flex justify-between gap-3 border-b p-4"><h2 class="font-semibold">核对历史承接</h2><button type="button" class="rounded-md border px-3 py-1.5 text-sm" data-post-finishing-work-order-detail-action="close-entry">关闭</button></header><div class="space-y-4 p-4"><p class="break-all font-mono text-sm">${escapeHtml(task.postTaskNo)}</p><p class="text-sm text-amber-900">核对历史整套后道完成量，以及剩余加工范围中各项已完成量。核对人不作为历史加工责任人。原记录和已有复检占用继续保留。</p>${supervisorConfirmation()}<fieldset class="rounded-lg border p-3"><legend class="px-1 text-sm font-medium">确认剩余加工需要的项目</legend><div class="grid grid-cols-2 gap-2 sm:grid-cols-4">${POST_FINISHING_PROCESS_ITEMS.map((item) => `<label class="flex items-center gap-2 text-sm"><input type="checkbox" value="${escapeHtml(item)}" ${task.processItems.includes(item) ? 'checked' : ''} data-post-legacy-process-item data-preserve-native-click="true" data-post-finishing-work-order-detail-action="toggle-legacy-item"/>${escapeHtml(item)}</label>`).join('')}</div></fieldset><div class="space-y-3">${task.lines.map((line) => {
    const result = task.results?.find((item) => item.sku.skuId === line.sku.skuId)
    return `<article class="rounded-lg border p-3" data-post-legacy-sku="${escapeHtml(line.sku.skuId)}"><div class="flex gap-3">${skuImage(line)}<div><div class="font-mono text-sm font-semibold">${escapeHtml(line.sku.skuCode)}</div><div class="mt-1 text-xs text-muted-foreground">${escapeHtml(line.sku.colorName)} / ${escapeHtml(line.sku.sizeName)} · 原应加工 ${line.expectedQty} 件</div></div></div><label class="mt-3 block text-sm">历史整套后道已完成量H<input type="number" min="0" max="${line.expectedQty}" step="1" value="${result?.processedQty ?? ''}" ${result ? 'readonly' : ''} class="mt-1 h-10 w-full rounded-md border px-3 text-right ${result ? 'bg-slate-100' : ''}" data-post-legacy-history /></label><div class="mt-3 grid gap-2 sm:grid-cols-2">${POST_FINISHING_PROCESS_ITEMS.map((item) => `<label class="block text-xs ${task.processItems.includes(item) ? '' : 'hidden'}" data-post-legacy-baseline-item="${escapeHtml(item)}">剩余范围${escapeHtml(item)}已完成量<input type="number" min="0" max="${line.expectedQty}" step="1" class="mt-1 h-10 w-full rounded-md border px-3 text-right" data-post-legacy-baseline="${escapeHtml(item)}" ${task.processItems.includes(item) ? '' : 'disabled'}/></label>`).join('')}</div></article>`
  }).join('')}</div><label class="block text-sm">核对依据与原因<textarea class="mt-1 min-h-24 w-full rounded-md border px-3 py-2" data-post-entry-reason placeholder="说明现场核对、历史完成量及剩余各项进度的依据"></textarea></label><button type="button" class="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white" data-post-finishing-work-order-detail-action="save-entry">确认并保存历史承接</button></div></section></div>`
}
function entryDialog(task: PostFinishingPostTask, mode: EntryMode, processItem?: PostFinishingProcessItem, recordId = ''): string {
  if (mode === 'legacy') return legacyDialog(task)
  const progress = getPostFinishingProcessProgress(task)
  if (progress.legacyPending) return ''
  const record = progress.records.find((entry) => entry.recordId === recordId)
  const item = progress.processes.find((entry) => entry.processItem === (processItem || record?.processItem) && entry.applicable)
  if (mode !== 'recheck' && !item) return ''
  if (mode === 'correct' && (!record || record.correctionOf)) return ''
  const key = `${task.postTaskId}:${mode}:${item?.processItem || ''}:${recordId}`
  const actors = postActors()
  const responsible = actors.find((actor) => actor.actorId === currentActor().actorId) || actors[0]
  const corrected = record ? effectiveQuantities(record, progress.records) : []
  const title = mode === 'recheck' ? '交复检' : mode === 'correct' ? `订正${item!.processItem}登记` : `登记${item!.processItem}`
  const lines = mode === 'recheck' ? progress.lines : item!.lines
  return `<div id="${DIALOG_ID}" class="fixed inset-0 z-[210] flex items-center justify-center bg-black/40 p-4" data-skip-page-rerender="true"><section class="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border bg-background shadow-2xl" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}" data-post-entry-form data-task-id="${escapeHtml(task.postTaskId)}" data-mode="${mode}" data-process-item="${escapeHtml(item?.processItem || '')}" data-record-id="${escapeHtml(recordId)}" data-intent-key="${escapeHtml(key)}" data-operation-id="${escapeHtml(operationId(key))}"><header class="flex items-center justify-between gap-3 border-b px-4 py-3"><h2 class="font-semibold">${escapeHtml(title)}</h2><button type="button" class="rounded-md border px-3 py-1.5 text-sm" data-post-finishing-work-order-detail-action="close-entry">关闭</button></header><div class="space-y-4 p-4"><p class="break-all font-mono text-sm">${escapeHtml(task.postTaskNo)}</p><p class="text-sm text-muted-foreground">${mode === 'recheck' ? '填写本次交复检量。保存成功即占用，待复检期间不能重复交出。' : mode === 'correct' ? '填写这次原登记订正后的数量。保留原记录和原因，后序或已交复检占用不能被破坏。' : '填写本次实际完成量，系统自动累计；本次未加工的SKU保留0。'}</p>${mode === 'register' ? `<label class="block text-sm">本次加工责任人<select class="mt-1 h-10 w-full rounded-md border px-3" data-post-entry-responsible>${actors.map((actor) => `<option value="${escapeHtml(actor.actorId)}" ${actor.actorId === responsible.actorId ? 'selected' : ''}>${escapeHtml(actor.actorName)} · ${escapeHtml(actor.roleName)}</option>`).join('')}</select></label>` : mode === 'correct' ? supervisorConfirmation() : ''}<div class="space-y-3">${lines.filter((line) => mode !== 'correct' || corrected.some((entry) => entry.skuId === line.sku.skuId)).map((line) => {
    const taskLine = task.lines.find((entry) => entry.sku.skuId === line.sku.skuId)!
    const available = mode === 'recheck' ? progress.lines.find((entry) => entry.sku.skuId === line.sku.skuId)!.availableForRecheckQty : item!.lines.find((entry) => entry.sku.skuId === line.sku.skuId)!.availableQty
    const full = progress.lines.find((entry) => entry.sku.skuId === line.sku.skuId)!
    return `<article class="rounded-lg border p-3" data-post-entry-line="${escapeHtml(line.sku.skuId)}"><div class="flex gap-3">${skuImage(taskLine)}<div class="min-w-0 flex-1"><div class="break-all font-mono text-sm font-medium">${escapeHtml(line.sku.skuCode)}</div><div class="mt-1 text-xs text-muted-foreground">${escapeHtml(line.sku.colorName)} / ${escapeHtml(line.sku.sizeName)}</div><div class="mt-1 text-xs">${mode === 'recheck' ? `全部后道完成 ${full.completedQty} · 已交复检 ${full.reservedQty} · 可交 ${available}` : mode === 'correct' ? `原登记 ${record!.quantities.find((entry) => entry.skuId === line.sku.skuId)?.quantity || 0} · 当前有效 ${corrected.find((entry) => entry.skuId === line.sku.skuId)?.quantity || 0}` : `本项累计 ${line.completedQty} · 本次可登记 ${available}`} 件</div></div></div><label class="mt-3 block text-sm">${mode === 'recheck' ? '本次交复检数量' : mode === 'correct' ? '订正后的原登记数量' : '本次完成数量'}<input type="number" min="0" ${mode === 'correct' ? '' : `max="${available}"`} step="1" inputmode="numeric" value="${mode === 'correct' ? corrected.find((entry) => entry.skuId === line.sku.skuId)?.quantity || 0 : 0}" class="mt-1 h-10 w-full rounded-md border px-3 text-right" data-post-entry-quantity /></label></article>`
  }).join('')}</div>${mode === 'correct' ? '<label class="block text-sm">订正原因<textarea class="mt-1 min-h-20 w-full rounded-md border px-3 py-2" data-post-entry-reason placeholder="说明实际误录及订正依据"></textarea></label>' : ''}<div class="flex justify-end gap-2"><button type="button" class="rounded-md border px-4 py-2 text-sm" data-post-finishing-work-order-detail-action="close-entry">取消</button><button type="button" class="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white" data-post-finishing-work-order-detail-action="save-entry">${mode === 'recheck' ? '确认交复检' : mode === 'correct' ? '保存订正' : '保存本次完成'}</button></div></div></section></div>`
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
  const material = getPostFinishingMaterialReadiness(task.productionOrderNo)
  const current = currentActor()
  const historyQty = progress.lines.reduce((sum, line) => sum + ('historyCompletedQty' in line ? Number(line.historyCompletedQty || 0) : 0), 0)
  const first = progress.processes.find((item) => item.applicable && item.availableQty > 0) || progress.processes.find((item) => item.applicable)
  const action = withQueryAction ? query().get('action') : ''
  const autoDialog = action === 'register' && first && !progress.legacyPending ? entryDialog(task, 'register', first.processItem) : action === 'recheck' && progress.availableForRecheckQty > 0 && !progress.legacyPending ? entryDialog(task, 'recheck') : ''
  return `<div class="min-w-0 space-y-4 p-4" data-web-post-task="${escapeHtml(task.postTaskId)}" data-skip-page-rerender="true">${renderPostFinishingPageHeader('后道加工单详情', `${task.postTaskNo} / ${task.productionOrderNo}`, `<div class="flex flex-wrap items-end gap-2"><a data-nav="/fcs/craft/post-finishing/work-orders" class="inline-flex h-9 items-center rounded-md border bg-white px-3 text-sm">返回列表</a></div>`)}${message ? `<div role="status" class="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">${escapeHtml(message)}</div>` : ''}${material.applicable && material.status !== '已入库' ? `<section class="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"><strong>后道辅料未到齐。</strong>${escapeHtml(material.label)}。现场核对后仍可登记加工。</section>` : ''}<section class="rounded-xl border bg-card p-4"><div class="flex flex-wrap items-start justify-between gap-4"><div><h2 class="break-all font-mono text-lg font-semibold">${escapeHtml(task.postTaskNo)}</h2><div class="mt-1 break-all text-sm text-muted-foreground">质检单 ${escapeHtml(task.qcTaskNo)} · 回货单 ${escapeHtml(task.deliveryOrderNo)}</div><div class="mt-2 text-sm">实际加工链：${task.processItems.map(escapeHtml).join(' → ')}</div></div><div class="text-right">${renderPostStatusBadge(task.status)}<div class="mt-2 text-xs text-muted-foreground">当前录入人：${escapeHtml(current.actorName)}</div></div></div><div class="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">${[['应加工', progress.totalExpectedQty], ['全部后道完成', progress.totalCompletedQty], ['已交复检', progress.totalReservedQty], ['可交复检', progress.availableForRecheckQty]].map(([label, quantity]) => `<div class="rounded-lg bg-slate-50 p-3"><div class="text-xs text-muted-foreground">${label}</div><div class="mt-1 font-semibold">${quantity} 件</div></div>`).join('')}</div>${historyQty > 0 ? `<p class="mt-3 text-sm text-amber-800">历史整套后道完成 ${historyQty} 件，未拆分为各项实际登记；新增分项仅记录剩余加工。</p>` : ''}${task.legacyCarryover ? `<p class="mt-2 text-xs text-muted-foreground">历史承接核对：${escapeHtml(task.legacyCarryover.confirmedBy.actorName)} · ${escapeHtml(new Date(task.legacyCarryover.confirmedAt).toLocaleString('zh-CN'))}；核对人不代表历史加工责任人。${escapeHtml(task.legacyCarryover.reason)}</p>` : ''}${progress.legacyPending ? `<div class="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">历史加工进度尚未分项核对，当前只读。请由后道主管核对历史完成量、已有复检及剩余加工后承接。<button type="button" class="mt-3 block rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white" data-post-finishing-work-order-detail-action="open-legacy" data-task-id="${escapeHtml(task.postTaskId)}">核对历史承接</button></div>` : ''}${!progress.legacyPending && progress.availableForRecheckQty > 0 ? `<button type="button" class="mt-4 rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white" data-post-finishing-work-order-detail-action="open-recheck" data-task-id="${escapeHtml(task.postTaskId)}">交复检 · 可交 ${progress.availableForRecheckQty} 件</button>` : ''}</section>${legacyEvidenceHtml(task)}${processCards(task, progress)}${skuProgress(task, progress)}${downstreamHtml(task)}${recordsHtml(task, progress)}${autoDialog}</div>`
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
    else if (action === 'open-recheck') openEntry(task, 'recheck')
    else if (action === 'open-legacy') openEntry(task, 'legacy')
    else if (action === 'toggle-legacy-item') {
      const input = node as HTMLInputElement
      document.querySelectorAll<HTMLElement>('[data-post-legacy-baseline-item]').forEach((label) => {
        if (label.dataset.postLegacyBaselineItem !== input.value) return
        label.classList.toggle('hidden', !input.checked)
        const field = label.querySelector<HTMLInputElement>('input')
        if (field) field.disabled = !input.checked
      })
    }
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
      if (mode === 'legacy') {
        const supervisor = readSupervisor(root)
        const items = Array.from(root.querySelectorAll<HTMLInputElement>('[data-post-legacy-process-item]:checked')).map((input) => input.value as PostFinishingProcessItem)
        if (!items.length) throw new Error('请选择剩余加工的实际项目。')
        const readNumber = (input: HTMLInputElement | null): number => {
          const value = input?.value.trim() || ''
          if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) throw new Error('历史完成量和已选加工项进度必须逐SKU填写0或正整数。')
          return Number(value)
        }
        const lines = Array.from(root.querySelectorAll<HTMLElement>('[data-post-legacy-sku]'))
        const history = lines.map((line) => ({ skuId: line.dataset.postLegacySku || '', completedQty: readNumber(line.querySelector<HTMLInputElement>('[data-post-legacy-history]')) }))
        const baselines = items.map((processItem) => ({ processItem, quantities: lines.map((line) => ({ skuId: line.dataset.postLegacySku || '', quantity: readNumber(Array.from(line.querySelectorAll<HTMLInputElement>('[data-post-legacy-baseline]')).find((input) => input.dataset.postLegacyBaseline === processItem) || null) })) }))
        const reason = root.querySelector<HTMLTextAreaElement>('[data-post-entry-reason]')?.value.trim() || ''
        if (!reason) throw new Error('请填写核对依据与原因。')
        if (!window.confirm(`${supervisor.actorName}核对：历史整套完成 ${history.reduce((sum, line) => sum + line.completedQty, 0)} 件，剩余按 ${items.join(' → ')} 加工？本次仅记录承接核对，不补造历史加工人员或时间。`)) return true
        pending.add(key)
        const button = node as HTMLButtonElement
        button.disabled = true
        try {
          await runPostFinishingCommand(() => confirmPostFinishingLegacyCarryover({ postTaskId: taskId, processItems: items, history, baselines, actor: supervisor, reason }))
          message = '历史承接已保存；原记录和已有复检占用保留，可继续剩余分项加工。'
          document.getElementById(DIALOG_ID)?.remove()
          refreshTask(taskId)
          document.querySelector<HTMLElement>('[data-web-post-task] button, [data-web-post-task] a')?.focus()
        } finally { pending.delete(key); button.disabled = false }
        return true
      }
      const values = readQuantities(root)
      const actor = mode === 'correct' ? readSupervisor(root) : currentActor()
      const intent = root.dataset.operationId || ''
      const responsibleId = root.querySelector<HTMLSelectElement>('[data-post-entry-responsible]')?.value
      const responsible = postActors().find((item) => item.actorId === responsibleId)
      const reason = root.querySelector<HTMLTextAreaElement>('[data-post-entry-reason]')?.value.trim() || ''
      const total = values.reduce((sum, line) => sum + line.quantity, 0)
      if (mode !== 'correct' && total === 0) throw new Error('至少一个SKU的本次数量大于0。')
      if (mode === 'register' && !responsible) throw new Error('请选择本次加工责任人。')
      if (mode === 'correct' && !reason) throw new Error('请填写订正原因。')
      if (mode === 'recheck' && !window.confirm(`${task.postTaskNo} 本次交复检 ${total} 件。保存成功即占用这些数量，确认交复检？`)) return true
      if (mode === 'correct' && !window.confirm(`${actor.actorName}核对：本次原登记订正后的数量合计 ${total} 件。原记录将保留，确认保存订正？`)) return true
      pending.add(key)
      const button = node as HTMLButtonElement
      button.disabled = true
      try {
        if (mode === 'recheck') {
          const recheck = await runPostFinishingCommand(() => submitPostFinishingForRecheck({ postTaskId: taskId, quantities: values, actor, operationId: intent }))
          message = `已交复检 ${total} 件，复检单 ${recheck.recheckOrderNo}。`
        } else if (mode === 'correct') {
          await runPostFinishingCommand(() => correctPostFinishingProcessCompletion({ recordId: root.dataset.recordId || '', quantities: values, reason, actor, operationId: intent }))
          message = '本次订正已保存，原登记及订正原因均已保留。'
        } else {
          const processItem = root.dataset.processItem as PostFinishingProcessItem
          await runPostFinishingCommand(() => appendPostFinishingProcessCompletion({ postTaskId: taskId, processItem, quantities: values, responsible: responsible!, actor, operationId: intent }))
          const progress = getPostFinishingProcessProgress(taskId)
          const process = progress.processes.find((item) => item.processItem === processItem)!
          message = `${processItem}本次 +${total} 件，累计 ${process.completedQty} 件；当前可交复检 ${progress.availableForRecheckQty} 件。`
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
export function renderPostFinishingWorkOrderDetailPage(postOrderId: string): string {
  installEntryGuard()
  const task = getPostFinishingFullFlowPostTask(postOrderId)
  if (task) return renderTask(task)
  return `<div class="space-y-4 p-4">${renderPostFinishingPageHeader('后道加工单详情', '', renderPostAction('返回后道加工单列表', '/fcs/craft/post-finishing/work-orders'))}${renderPostSection('未找到当前后道加工单', `<p class="text-sm text-muted-foreground">未找到加工单 ${escapeHtml(postOrderId)}。历史旧单仅保留审计，不从本页继续旧加工写入。</p>`)}</div>`
}
