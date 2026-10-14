import { staticImageThumbnail } from '../../utils/static-image-thumbnail.ts'
// @page-pattern: dashboard

import { escapeHtml } from '../../utils.ts'
import {
  ensurePpicDailyReturnState, getPpicDailyReturnView, getCurrentPpicDailyActor,
  savePpicDailyReturnPromise, savePpicDailyReturnMakeup,
  savePpicDailyReturnReason, savePpicDailyReturnAmendment, confirmPpicDailyReport,
  type PpicDailyTaskView,
} from '../../data/fcs/ppic-daily-return-records.ts'
import { PPIC_RETURN_REASONS, ppicBusinessDate, ppicInstant } from '../../data/fcs/ppic-daily-return.ts'
import { renderPostFinishingStorageNotice } from '../process-factory/post-finishing/storage-notice.ts'
import { renderTablePagination } from '../../components/ui/pagination.ts'

type DailyView = ReturnType<typeof getPpicDailyReturnView>
type FormKind = 'promise' | 'makeup' | 'reason' | 'amendment'
type Dialog = { kind: FormKind; assignmentId: string; promiseId: string; operationId: string; quantity: string; deadlineAt: string; reason: string; detail: string; error: string; dirty: boolean }
  | { kind: 'image'; imageUrl: string; label: string } | null
const state = { date: '', query: '', draftQuery: '', page: 1, pageSize: 20, dialog: null as Dialog,
  noArrangementReasons: {} as Record<string, string>, reasonsDirty: false, dayOperationId: '', message: '', error: '', busy: false, view: null as DailyView | null }
const action = (name: string) => `data-ppic-daily-action="${name}"`
const buttonClass = 'h-10 rounded border px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50'
const typeLabel = { INDEPENDENT_SEWING: '独立车缝', SEWING_TO_IRON_PACK: '车缝＋烫包', CUTTING_TO_IRON_PACK: '裁剪＋车缝＋烫包' }
const sourceLabel = { ASSIGNMENT: '任务分配数量', CUT_PIECE_COMPLETE_KIT: '实际交出齐套数量', CUT_PIECE_RELEASE: '裁片放行数量' }
let overlayReturnFocus: HTMLElement | null = null
export function updatePpicDailyOverlay(selector: string, html: string, busy = false): void {
  const region = document.querySelector<HTMLElement>(selector); if (!region) return
  if (html && !region.querySelector('[role="dialog"]')) overlayReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  region.innerHTML = html
  if (busy) region.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement>('input, select, textarea, button').forEach(input => { input.disabled = true })
  if (html) {
    const section = region.querySelector<HTMLElement>('section, aside, [role="dialog"]')
    const target = section?.querySelector<HTMLElement>('input:not(:disabled):not([readonly]), select:not(:disabled), textarea:not(:disabled)') || section?.querySelector<HTMLElement>('button:not(:disabled)')
    if (target) target.focus({ preventScroll: true })
    else if (section) { section.tabIndex = -1; section.focus({ preventScroll: true }) }
  } else { if (overlayReturnFocus?.isConnected) overlayReturnFocus.focus({ preventScroll: true }); overlayReturnFocus = null }
}
export function ppicDailyTime(value: string, timeZone = 'Asia/Jakarta'): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat('zh-CN', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(ppicInstant(value, timeZone)))
}
function defaultDeadline(): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: state.view?.config.timeZone || 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(Date.now() + 3600000))
  const part = (type: string) => parts.find(p => p.type === type)!.value
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`
}
export function renderPpicDailyCurrentUser(): string {
  const actor = getCurrentPpicDailyActor()
  return `<span class="text-sm">当前登录：${escapeHtml(actor.name)}（${actor.leader ? 'PPIC组长' : 'PPIC'}）</span>`
}
export function renderPpicDailyImage(imageUrl: string, label: string, prefix: string): string {
  if (!imageUrl) return '<span class="inline-flex h-16 w-16 shrink-0 items-center rounded border border-red-200 bg-red-50 p-1 text-center text-xs text-red-700">对应款式图片缺失</span>'
  return `<button class="relative h-16 w-16 shrink-0 overflow-hidden rounded border" data-${prefix}-action="image" data-image-url="${escapeHtml(imageUrl)}" data-image-label="${escapeHtml(label)}" aria-label="查看${escapeHtml(label)}高清图"><img class="h-full w-full object-contain" src="${escapeHtml(staticImageThumbnail(imageUrl))}" alt="${escapeHtml(label)}款式图" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden class="absolute inset-0 flex items-center justify-center bg-red-50 p-1 text-xs text-red-700">图片加载失败</span></button>`
}
export function renderPpicDailyImageDialog(imageUrl: string, label: string, prefix: string): string {
  return `<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4" role="dialog" aria-modal="true" aria-label="${escapeHtml(label)}高清图"><button class="absolute inset-0" data-${prefix}-action="close" aria-label="关闭大图"></button><section class="relative z-10 max-h-[92vh] w-full max-w-4xl overflow-auto rounded bg-white p-4"><header class="mb-3 flex items-center justify-between gap-2"><b>${escapeHtml(label)}</b><button class="${buttonClass}" data-${prefix}-action="close">关闭</button></header><img class="mx-auto max-h-[78vh] max-w-full object-contain" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(label)}高清图" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><p hidden class="rounded bg-red-50 p-3 text-red-700">图片加载失败，关闭后可重新打开。</p></section></div>`
}
function writable(): boolean { return Boolean(state.view && state.view.date === ppicBusinessDate(new Date().toISOString(), state.view.config.timeZone)) }
function hasUnsavedInput(): boolean { return state.reasonsDirty || Boolean(state.dialog && state.dialog.kind !== 'image' && state.dialog.dirty) }
function loadView(): void {
  state.view = getPpicDailyReturnView({ date: state.date || undefined })
  state.date = state.view.date
}
function feedback(): string {
  return `${state.error ? `<p role="alert" class="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">${escapeHtml(state.error)}</p>` : ''}${state.message ? `<p role="status" class="rounded bg-emerald-50 p-3 text-sm text-emerald-800">${escapeHtml(state.message)}</p>` : ''}`
}
function toolbar(): string {
  const view = state.view!
  return `<div class="flex flex-wrap items-center gap-3"><a class="ml-auto text-sm font-semibold text-blue-700" href="/fcs/sewing-outsourcing/workbench" data-nav="/fcs/sewing-outsourcing/workbench">我的工作台</a>${view.actor.leader ? '<a class="text-sm font-semibold text-blue-700" href="/fcs/sewing-outsourcing/daily-return-summary" data-nav="/fcs/sewing-outsourcing/daily-return-summary">每日回货汇总</a>' : ''}</div>`
}
function reportHeader(): string {
  const view = state.view!
  return `<div class="flex flex-wrap items-end justify-between gap-3"><div><h1 class="text-xl font-semibold">每日回货填报</h1><p class="mt-2 text-sm text-slate-600">${escapeHtml(view.actor.name)} · ${escapeHtml(view.date)} · 每日 ${escapeHtml(view.config.cutoff)} 截止（${escapeHtml(view.config.timeZone)}）</p></div><strong class="rounded px-3 py-2 text-sm ${view.submissionStatus.includes('超时') ? 'bg-red-50 text-red-700' : view.confirmation && !view.needsReconfirmation ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}">${escapeHtml(view.submissionStatus)}</strong></div>`
}
function promiseCard(task: PpicDailyTaskView, promise: PpicDailyTaskView['promises'][number]): string {
  const r = promise.result
  const newTime = promise.revisions.at(-1)?.deadlineAt
  return `<article class="rounded border bg-slate-50 p-3" data-promise-id="${escapeHtml(promise.promiseId)}"><div class="flex flex-wrap justify-between gap-2"><b class="text-sm">${escapeHtml(promise.promiseNo)} · ${promise.quantity} 件</b><span class="text-xs ${r.currentGap && r.due ? 'text-red-700' : 'text-slate-600'}">${escapeHtml(r.status)}${r.missingReason ? ' · 待补原因' : ''}</span></div><p class="mt-1 text-xs text-slate-600">原截止 ${escapeHtml(ppicDailyTime(promise.originalDeadlineAt, state.view!.config.timeZone))} · 准时 ${r.timelyQty} 件 · 实收 ${r.receivedQty} 件 · ${r.due ? '当前欠回' : '待回'} ${r.currentGap} 件${r.due ? ` · 原欠回 ${r.originalGap} 件 · 可新安排补回 ${r.makeupAvailableQty} 件` : ''}</p>${newTime ? `<p class="mt-1 text-xs text-amber-800">最新安排 ${escapeHtml(ppicDailyTime(newTime))}；仍按原截止考核 · ${escapeHtml(promise.revisions.at(-1)!.reason)}</p>` : ''}${r.makeups.length ? `<div class="mt-2 space-y-1">${r.makeups.map(m => `<p class="text-xs ${m.active ? 'text-blue-700' : 'text-slate-500'}">第 ${m.round} 轮补回 ${m.quantity} 件 · ${escapeHtml(ppicDailyTime(m.deadlineAt))} · ${escapeHtml(m.reason)}${m.detail ? `：${escapeHtml(m.detail)}` : ''} · 已回 ${m.receivedQty} 件${m.active ? ' · 待回 ' + m.currentGap + ' 件' + (m.releasedQty ? ' · 正式实收更新解除 ' + m.releasedQty + ' 件' : '') : ' · 剩余已重新安排'}</p>`).join('')}</div>` : ''}${r.makeupAllocationConflict ? '<p role="alert" class="mt-2 text-xs text-red-700">补回分摊存在数量冲突，核对后才能安排。</p>' : ''}<div class="mt-3 flex flex-wrap gap-2">${writable() ? !r.due ? `<button class="${buttonClass}" ${action('amendment')} data-assignment-id="${escapeHtml(task.task.assignmentId)}" data-promise-id="${escapeHtml(promise.promiseId)}"${!r.currentGap ? ' disabled' : ''}>修改安排时间</button>` : `${r.currentGap && r.makeupAvailableQty > 0 && !r.makeupAllocationConflict ? `<button class="${buttonClass} bg-blue-600 text-white" ${action('makeup')} data-assignment-id="${escapeHtml(task.task.assignmentId)}" data-promise-id="${escapeHtml(promise.promiseId)}">安排补回</button>` : ''}${r.originalGap ? `<button class="${buttonClass}" ${action('reason')} data-assignment-id="${escapeHtml(task.task.assignmentId)}" data-promise-id="${escapeHtml(promise.promiseId)}">补充欠回原因</button>` : ''}` : ''}</div></article>`
}
function taskCard(task: PpicDailyTaskView): string {
  const b = task.basis, c = task.capacity, promises = task.promises.filter(p => p.date === state.date || p.result.currentGap > 0 || p.result.missingReason)
  const arrangedToday = task.todayHasArrangement ?? task.promises.some(p => p.date === state.date)
  return `<article class="rounded-xl border bg-white p-4" data-daily-task="${escapeHtml(task.task.assignmentId)}"><header class="flex items-start gap-3">${renderPpicDailyImage(b.imageUrl, `${b.productionOrderNo} ${b.taskNo}`, 'ppic-daily')}<div class="min-w-0 flex-1"><h2 class="font-semibold">${escapeHtml(b.taskNo)}</h2><p class="mt-1 text-sm">${escapeHtml(b.productionOrderNo)} · ${escapeHtml(b.factoryName)}</p><p class="mt-1 text-xs text-slate-500">${b.taskType ? typeLabel[b.taskType] : '任务类型待核对'}</p></div><button class="${buttonClass} bg-blue-600 text-white" ${action('promise')} data-assignment-id="${escapeHtml(task.task.assignmentId)}"${!writable() || c.conflict || c.available <= 0 ? ' disabled' : ''}>新增回货承诺</button></header><div class="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm"><span>应回 <b>${c.expectedQty === null ? '待核对' : c.expectedQty + ' 件'}</b></span><span>后道实收 <b>${c.receivedQty} 件</b></span><span>待回 <b>${c.conflict ? '待核对' : c.pending + ' 件'}</b></span><span>未兑现承诺 <b>${c.reserved} 件</b></span><span>可新增 <b class="${c.conflict ? 'text-red-700' : 'text-blue-700'}">${c.conflict ? '待核对' : c.available + ' 件'}</b></span></div><p class="mt-2 text-xs ${c.conflict ? 'text-red-700' : 'text-slate-500'}">${escapeHtml(b.message)}${c.expectedQty !== null && (c.pending < 0 || c.available < 0) ? ' · 后道实收或未兑现承诺超过当前应回量，核对来源后才能新增承诺。' : ''}${b.sourceKind ? ` · 依据：${sourceLabel[b.sourceKind]}` : ''}</p><details class="mt-3 rounded border p-3"><summary class="cursor-pointer text-sm font-semibold">应回明细与两节点</summary><div class="mt-3 overflow-x-auto"><table class="w-full text-left text-xs"><thead><tr><th class="p-2">颜色／尺码</th><th class="p-2">分配（件）</th><th class="p-2">交出齐套（件）</th><th class="p-2">放行（件）</th><th class="p-2">应回（件）</th></tr></thead><tbody>${b.skuLines.map(l => `<tr class="border-t"><td class="p-2">${escapeHtml(l.color)}／${escapeHtml(l.size)}</td><td class="p-2">${l.assignedQty}</td><td class="p-2">${l.handedOverCompleteKitQty}</td><td class="p-2">${l.releaseConfirmQty ?? '—'}</td><td class="p-2">${l.expectedQty ?? '待核对'}</td></tr>`).join('')}</tbody></table></div>${b.missingParts.length ? `<p class="mt-2 text-xs text-amber-800">缺裁片：${b.missingParts.map(p => `${escapeHtml(p.color)}／${escapeHtml(p.size)} ${escapeHtml(p.partName)} ${p.missingPieceQty} 片`).join('；')}</p>` : ''}<div class="mt-2 flex flex-wrap gap-3">${task.missingMilestones?.length || task.milestones.length < 2 ? `<span class="text-xs text-amber-800">历史节点的应回依据待核对${task.missingMilestones?.length ? '：' + task.missingMilestones.map(m => Math.round(m.ratio * 100) + '% · ' + escapeHtml(ppicDailyTime(m.deadlineAt))).join('；') : '，尚未完整形成两个监控节点'}。</span>` : ''}${task.milestones.map(m => `<span class="text-xs">${Math.round(m.ratio * 100)}% · ${m.targetQty} 件 · ${escapeHtml(ppicDailyTime(m.deadlineAt))}</span>`).join('')}</div>${task.responsibilityHistory.length ? `<p class="mt-2 text-xs text-slate-500">责任历史：${task.responsibilityHistory.map(h => `${escapeHtml(h.ppicName)}（${escapeHtml(ppicDailyTime(h.effectiveAt))}）`).join(' → ')}</p>` : ''}</details><div class="mt-3 space-y-2">${promises.map(p => promiseCard(task, p)).join('')}</div>${!arrangedToday ? `<label class="mt-3 block text-sm">今日无回货安排原因<input aria-label="${escapeHtml(b.taskNo)}今日无安排原因" class="mt-1 h-10 w-full rounded border px-3" data-skip-page-rerender="true" data-ppic-daily-no-arrangement="${escapeHtml(task.task.assignmentId)}" value="${escapeHtml(state.noArrangementReasons[task.task.assignmentId] || '')}" placeholder="填写今天没有回货安排的原因"${!writable() ? ' disabled' : ''}></label>` : ''}</article>`
}
function taskArea(): string {
  const view = state.view!, needle = state.query.trim().toLowerCase()
  const tasks = view.tasks.filter(t => !needle || [t.basis.productionOrderNo, t.basis.taskNo, t.basis.factoryName].some(v => v.toLowerCase().includes(needle)))
  const totalPages = Math.max(1, Math.ceil(tasks.length / state.pageSize)); state.page = Math.min(state.page, totalPages)
  const from = (state.page - 1) * state.pageSize
  return `${!writable() ? '<p class="mb-3 rounded bg-amber-50 p-3 text-sm text-amber-800">历史业务日只读。新增、修改和确认操作仅在当前业务日开放。</p>' : ''}<div class="space-y-4">${tasks.slice(from, from + state.pageSize).map(taskCard).join('') || '<p class="rounded border bg-white p-6 text-sm text-slate-600">当前范围没有负责的第三方车缝任务。</p>'}</div>${renderTablePagination({ total: tasks.length, from: tasks.length ? from + 1 : 0, to: Math.min(from + state.pageSize, tasks.length), currentPage: state.page, totalPages, pageSize: state.pageSize, actionPrefix: 'ppic-daily', fieldPrefix: 'ppic-daily', pageSizeOptions: [20, 50], skipPageRerender: true })}<section class="mt-3 rounded border bg-white p-4"><div class="flex flex-wrap items-center justify-between gap-3"><p class="text-sm">确认覆盖本人全部 ${view.tasks.length} 个当前任务${state.query ? '，包括筛选未展示的任务' : ''}。${!view.tasks.length ? '今日无任务也需要确认。' : ''}</p><button class="${buttonClass} bg-blue-600 text-white" ${action('confirm-day')}${!writable() || state.busy ? ' disabled' : ''}>${state.busy ? '正在保存' : view.confirmation ? '更新今日填报确认' : '确认今日填报'}</button></div>${view.confirmation ? `<p class="mt-2 text-xs text-slate-500">上次提交 ${escapeHtml(ppicDailyTime(view.confirmation.submittedAt))}</p>` : ''}</section>${view.history.length ? `<details class="mt-4 rounded border bg-white p-4"><summary class="cursor-pointer text-sm font-semibold">已移交任务的本人历史填报（只读）</summary>${view.history.map(h => `<article class="mt-3 rounded bg-slate-50 p-3 text-sm"><b>${escapeHtml(h.taskNo)} · ${escapeHtml(h.factoryName)}</b>${h.promises.map(p => `<p class="mt-1 text-xs">${escapeHtml(p.promiseNo)} · ${p.quantity} 件 · ${escapeHtml(p.result.status)} · ${p.result.currentGap} 件未回</p>`).join('')}</article>`).join('')}</details>` : ''}`
}
function renderDialog(): string {
  const d = state.dialog
  if (!d) return ''
  if (d.kind === 'image') return renderPpicDailyImageDialog(d.imageUrl, d.label, 'ppic-daily')
  const task = state.view!.tasks.find(t => t.task.assignmentId === d.assignmentId)!
  const p = task.promises.find(p => p.promiseId === d.promiseId)
  const title = { promise: '新增回货承诺', makeup: '安排补回', reason: '补充欠回原因', amendment: '修改安排时间' }[d.kind]
  return `<div class="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-label="${title}"><button class="fixed inset-0" ${action('close')} aria-label="关闭"></button><section class="relative mx-auto my-8 w-full max-w-lg rounded-xl bg-white p-5"><header class="flex items-center justify-between gap-3"><h2 class="text-lg font-semibold">${title}</h2><button class="${buttonClass}" ${action('close')}${state.busy ? ' disabled' : ''}>关闭</button></header><p class="mt-2 text-sm">${escapeHtml(task.basis.taskNo)} · ${escapeHtml(task.basis.factoryName)}</p>${p ? `<p class="mt-2 rounded bg-amber-50 p-3 text-sm">原承诺 ${p.quantity} 件 · 原截止 ${escapeHtml(ppicDailyTime(p.originalDeadlineAt))} · ${p.result.due ? '当前欠回' : '待回'} ${p.result.currentGap} 件${d.kind === 'makeup' ? ' · 可新安排补回 ' + p.result.makeupAvailableQty + ' 件' : ''}。修改安排和补回均保留原截止考核。</p>` : `<p class="mt-2 text-sm text-blue-700">可新增承诺 ${task.capacity.available} 件</p>`}<div class="mt-4 space-y-4">${['promise', 'makeup'].includes(d.kind) ? `<label class="block text-sm">${d.kind === 'makeup' ? '本次补回' : '承诺回货'}数量（件）<input aria-label="数量（件）" class="mt-1 h-11 w-full rounded border px-3" type="number" min="1" max="${d.kind === 'makeup' ? p!.result.makeupAvailableQty : task.capacity.available}" step="1" data-skip-page-rerender="true" data-ppic-daily-dialog-field="quantity" value="${escapeHtml(d.quantity)}"></label>` : ''}${d.kind !== 'reason' ? `<label class="block text-sm">预计后道确认时间（${escapeHtml(state.view!.config.timeZone)}）<input aria-label="预计后道确认时间" class="mt-1 h-11 w-full rounded border px-3" type="datetime-local" data-skip-page-rerender="true" data-ppic-daily-dialog-field="deadlineAt" value="${escapeHtml(d.deadlineAt)}"></label>` : ''}${d.kind === 'amendment' ? `<label class="block text-sm">修改原因<input aria-label="修改原因" class="mt-1 h-11 w-full rounded border px-3" data-skip-page-rerender="true" data-ppic-daily-dialog-field="reason" value="${escapeHtml(d.reason)}"></label>` : ['makeup', 'reason'].includes(d.kind) ? `<label class="block text-sm">欠回原因<select aria-label="欠回原因" class="mt-1 h-11 w-full rounded border px-3" data-skip-page-rerender="true" data-ppic-daily-dialog-field="reason"><option value="">选择原因</option>${PPIC_RETURN_REASONS.map(r => `<option${r === d.reason ? ' selected' : ''}>${r}</option>`).join('')}</select></label><label class="block text-sm">具体情况${d.reason === '其他' ? '（必填）' : ''}<textarea aria-label="具体情况" class="mt-1 min-h-20 w-full rounded border p-3" data-skip-page-rerender="true" data-ppic-daily-dialog-field="detail">${escapeHtml(d.detail)}</textarea></label>` : ''}</div><div data-daily-dialog-error>${d.error ? `<p role="alert" class="mt-3 rounded bg-red-50 p-3 text-sm text-red-700">${escapeHtml(d.error)} 输入尚未保存，可调整后重试。</p>` : ''}</div><footer class="mt-5 flex justify-end gap-2"><button class="${buttonClass}" ${action('close')}${state.busy ? ' disabled' : ''}>取消</button><button class="${buttonClass} bg-blue-600 text-white" ${action('save')}${state.busy ? ' disabled' : ''}>${state.busy ? '正在保存' : `保存${title}`}</button></footer></section></div>`
}
function put(selector: string, html: string): void { if (selector === '[data-daily-overlay]') { updatePpicDailyOverlay(selector, html, state.busy); return }; const element = document.querySelector<HTMLElement>(selector); if (element) element.innerHTML = html }
function refresh(): void { loadView(); put('[data-daily-header]', reportHeader()); put('[data-daily-toolbar]', toolbar()); put('[data-daily-feedback]', feedback()); put('[data-daily-tasks]', taskArea()); put('[data-daily-overlay]', renderDialog()) }
export async function renderPpicDailyReturnReportPage(): Promise<string> {
  try {
    await ensurePpicDailyReturnState(); loadView()
    if (!Object.keys(state.noArrangementReasons).length && state.view!.confirmation) state.noArrangementReasons = { ...state.view!.confirmation.noArrangementReasons }
    return `${renderPostFinishingStorageNotice()}<main class="space-y-4 p-4" data-ppic-daily-page data-skip-page-rerender="true"><header data-daily-header>${reportHeader()}</header><section class="rounded border bg-white p-3" data-daily-toolbar>${toolbar()}</section><div data-daily-feedback>${feedback()}</div><section class="flex flex-wrap items-end gap-3 rounded border bg-white p-3"><label class="text-sm">业务日期<input aria-label="业务日期" type="date" class="ml-2 h-10 rounded border px-3" data-skip-page-rerender="true" data-ppic-daily-field="date" value="${state.date}"></label><input aria-label="任务查询" class="h-10 min-w-0 flex-1 rounded border px-3" data-skip-page-rerender="true" data-ppic-daily-field="query" value="${escapeHtml(state.draftQuery)}" placeholder="生产单／任务／工厂"><button class="${buttonClass} bg-blue-600 text-white" ${action('query')}>查询</button><button class="${buttonClass}" ${action('reset')}>重置</button></section><div data-daily-tasks>${taskArea()}</div><div data-daily-overlay>${renderDialog()}</div></main>`
  } catch (error) {
    return `${renderPostFinishingStorageNotice()}<main data-ppic-daily-page data-skip-page-rerender="true" class="p-4"><h1 class="text-xl font-semibold">每日回货填报</h1><p role="alert" class="mt-4 rounded bg-red-50 p-4 text-red-700">${escapeHtml(error instanceof Error ? error.message : '回货记录读取失败')}。未读到的记录不会作为空记录保存。</p><button class="mt-3 ${buttonClass}" ${action('retry-load')}>重新读取</button></main>`
  }
}
export function closePpicDailyReturnDialog(): boolean { if (!state.dialog || state.busy) return false; if (state.dialog.kind !== 'image' && state.dialog.dirty && !window.confirm('这笔填写内容尚未保存，关闭将丢失输入。继续关闭？')) return true; state.dialog = null; put('[data-daily-overlay]', ''); return true }
export function isPpicDailyReturnDialogOpen(): boolean { return state.dialog !== null }
async function saveDialog(): Promise<void> {
  const d = state.dialog; if (!d || d.kind === 'image' || state.busy) return
  state.busy = true; d.error = ''; put('[data-daily-overlay]', renderDialog())
  try {
    const common = { operationId: d.operationId, assignmentId: d.assignmentId }
    if (d.kind === 'promise') await savePpicDailyReturnPromise({ ...common, quantity: Number(d.quantity), deadlineAt: d.deadlineAt, date: state.date, basisVersion: state.view!.tasks.find(t => t.task.assignmentId === d.assignmentId)!.basis.basisVersion })
    else if (d.kind === 'makeup') await savePpicDailyReturnMakeup({ ...common, promiseId: d.promiseId, quantity: Number(d.quantity), deadlineAt: d.deadlineAt, reason: d.reason, detail: d.detail })
    else if (d.kind === 'reason') await savePpicDailyReturnReason({ ...common, promiseId: d.promiseId, reason: d.reason, detail: d.detail })
    else await savePpicDailyReturnAmendment({ ...common, promiseId: d.promiseId, deadlineAt: d.deadlineAt, reason: d.reason })
    state.dialog = null; state.message = '已保存。今日安排有变化时，需更新今日填报确认。'; state.error = ''; state.dayOperationId = ''; state.busy = false; refresh()
  } catch (error) { state.busy = false; d.error = error instanceof Error ? error.message : '未保存，请重试。'; put('[data-daily-overlay]', renderDialog()) }
}
export async function handlePpicDailyReturnReportEvent(target: HTMLElement, event?: Event): Promise<boolean> {
  const input = target.closest<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[data-ppic-daily-dialog-field]')
  if (input && state.dialog && state.dialog.kind !== 'image') { const field = input.dataset.ppicDailyDialogField as 'quantity' | 'deadlineAt' | 'reason' | 'detail'; state.dialog[field] = input.value; state.dialog.dirty = true; return true }
  const noReason = target.closest<HTMLInputElement>('[data-ppic-daily-no-arrangement]')
  if (noReason) { state.noArrangementReasons[noReason.dataset.ppicDailyNoArrangement!] = noReason.value; state.reasonsDirty = true; state.dayOperationId = ''; return true }
  const field = target.closest<HTMLInputElement | HTMLSelectElement>('[data-ppic-daily-field]')
  if (field) {
    const name = field.dataset.ppicDailyField
    if (name === 'query') { state.draftQuery = field.value; return true }
    if (event?.type !== 'change') return true
    if (state.dialog || state.busy) return true
    if (name === 'date' && hasUnsavedInput() && !window.confirm('无安排原因尚未确认保存，切换后将丢失这些输入。继续切换？')) {
      field.value = state.date; return true
    }
    if (name === 'date') { state.date = field.value; state.noArrangementReasons = {}; state.dayOperationId = ''; state.message = ''; state.error = '' }
    else if (name === 'pageSize') state.pageSize = Number(field.value) || 20
    else return false
    if (name === 'date') state.reasonsDirty = false; state.page = 1; refresh(); if (state.view?.confirmation) state.noArrangementReasons = { ...state.view.confirmation.noArrangementReasons }; put('[data-daily-tasks]', taskArea()); return true
  }
  const node = target.closest<HTMLElement>('[data-ppic-daily-action]'); if (!node || event && event.type !== 'click') return false
  const name = node.dataset.ppicDailyAction
  if (name === 'close') { closePpicDailyReturnDialog(); return true }
  if (name === 'retry-load') { const root = document.querySelector<HTMLElement>('[data-ppic-daily-page]'); if (root) root.outerHTML = await renderPpicDailyReturnReportPage(); return true }
  if (state.busy) return true
  if (name === 'image') { state.dialog = { kind: 'image', imageUrl: node.dataset.imageUrl || '', label: node.dataset.imageLabel || '' }; put('[data-daily-overlay]', renderDialog()); return true }
  if (name === 'query' || name === 'reset') { state.query = name === 'reset' ? '' : state.draftQuery; state.draftQuery = state.query; const input = document.querySelector<HTMLInputElement>('[data-ppic-daily-field="query"]'); if (input) input.value = state.query; state.page = 1; put('[data-daily-tasks]', taskArea()); return true }
  if (name === 'prev-page' || name === 'next-page') { state.page = Math.max(1, state.page + (name === 'next-page' ? 1 : -1)); put('[data-daily-tasks]', taskArea()); return true }
  if (name === 'save') { if (writable()) await saveDialog(); return true }
  if (name === 'confirm-day') {
    if (!writable()) return true
    state.busy = true; state.error = ''; state.dayOperationId ||= crypto.randomUUID(); put('[data-daily-tasks]', taskArea())
    try { await confirmPpicDailyReport({ operationId: state.dayOperationId, date: state.date, noArrangementReasons: state.noArrangementReasons }); state.message = '已确认今日全部任务的填报。'; state.dayOperationId = ''; state.reasonsDirty = false }
    catch (error) { state.error = error instanceof Error ? error.message : '今日填报未保存，请重试。' }
    state.busy = false; refresh(); return true
  }
  if (['promise', 'makeup', 'reason', 'amendment'].includes(name || '') && writable()) {
    const task = state.view!.tasks.find(t => t.task.assignmentId === node.dataset.assignmentId); if (!task) return true
    const p = task.promises.find(p => p.promiseId === node.dataset.promiseId)
    state.dialog = { kind: name as FormKind, assignmentId: task.task.assignmentId, promiseId: p?.promiseId || '', operationId: crypto.randomUUID(), quantity: name === 'makeup' ? String(p?.result.makeupAvailableQty || '') : '', deadlineAt: defaultDeadline(), reason: '', detail: '', error: '', dirty: false }
    put('[data-daily-overlay]', renderDialog()); return true
  }
  return false
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', event => {
    if (document.querySelector('[data-ppic-daily-page]') && hasUnsavedInput()) { event.preventDefault(); event.returnValue = '' }
  })
  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null
    if (document.querySelector('[data-ppic-daily-page]') && hasUnsavedInput() && target?.closest('a[href], a[data-nav]')) {
      if (!window.confirm('填写内容尚未保存，离开将丢失这些输入。继续离开？')) { event.preventDefault(); event.stopImmediatePropagation() }
      else { state.dialog = null; state.noArrangementReasons = {}; state.reasonsDirty = false }
    }
  }, true)
  document.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return
    const dialog = document.querySelector<HTMLElement>('[data-daily-overlay] [role="dialog"], [data-summary-overlay] [role="dialog"]')
    if (!dialog) return
    const content = dialog.querySelector<HTMLElement>('section, aside') || dialog
    const items = [...content.querySelectorAll<HTMLElement>('input:not(:disabled), select:not(:disabled), textarea:not(:disabled), button:not(:disabled), a[href]')].filter(el => el.getClientRects().length)
    const first = items[0], last = items.at(-1); if (!first || !last) return
    if (!dialog.contains(document.activeElement) || event.shiftKey && document.activeElement === first || !event.shiftKey && document.activeElement === last) { event.preventDefault(); (event.shiftKey ? last : first).focus() }
  })
  window.setInterval(() => {
    if (!document.querySelector('[data-ppic-daily-page]') || !state.view || state.busy || state.dialog) return
    try {
      loadView(); put('[data-daily-header]', reportHeader())
      if (!hasUnsavedInput() && !document.activeElement?.closest('[data-ppic-daily-no-arrangement]')) put('[data-daily-tasks]', taskArea())
    } catch (error) { state.error = error instanceof Error ? error.message : '回货待办读取失败'; put('[data-daily-feedback]', feedback()) }
  }, 30000)
}
