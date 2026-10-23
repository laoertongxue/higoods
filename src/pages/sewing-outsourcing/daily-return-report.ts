import { staticImageThumbnail } from '../../utils/static-image-thumbnail.ts'
// @page-pattern: list

import { escapeHtml } from '../../utils.ts'
import { renderStandardListFilters, renderStandardListPage, renderStandardListStats } from '../../components/ui/list-page.ts'
import { renderStandardListTable, renderStandardListColumnSettings, type StandardListColumn } from '../../components/ui/list-table.ts'
import { loadListColumnPreferences, saveListColumnPreferences, normalizeListColumnPreferences, sortStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../components/ui/pagination.ts'
import {
  ensurePpicDailyReturnState, getPpicDailyWorklistView, getPpicDailyReturnView, getPpicDailyActorById, listPpicDailyActors,
  savePpicDailyReturnPromise, savePpicDailyReturnMakeup, savePpicDailyReturnReason, savePpicDailyReturnAmendment,
  confirmPpicDailyReport, savePpicDailyReturnConfig,
  PPIC_DAILY_WORKLIST_STATUS_OPTIONS, type PpicDailyWorklistQuery, type PpicDailyWorklistTask,
} from '../../data/fcs/ppic-daily-return-records.ts'
import { PPIC_RETURN_REASONS, ppicBusinessDate, ppicDailyTime } from '../../data/fcs/ppic-daily-return.ts'
import { renderPostFinishingStorageNotice } from '../process-factory/post-finishing/storage-notice.ts'

type Worklist = ReturnType<typeof getPpicDailyWorklistView>
type Task = PpicDailyWorklistTask
type PromiseRow = Task['promises'][number]
type FormKind = 'promise' | 'makeup' | 'reason' | 'amendment'
type Dialog = { kind: 'task'; assignmentId: string }
  | { kind: 'image'; imageUrl: string; label: string }
  | { kind: FormKind; assignmentId: string; promiseId: string; operationId: string; quantity: string; deadlineAt: string; reason: string; detail: string; error: string; dirty: boolean }
  | { kind: 'confirm'; ppicId: string; operationId: string; reasons: Record<string, string>; error: string; dirty: boolean }
  | { kind: 'config'; operationId: string; cutoff: string; timeZone: string; effectiveFrom: string; error: string; dirty: boolean }
  | { kind: 'columns' }
  | null
const state = {
  query: {} as PpicDailyWorklistQuery,
  draft: {} as PpicDailyWorklistQuery,
  page: 1,
  pageSize: 20,
  sort: null as StandardListSortState | null,
  dialog: null as Dialog,
  view: null as Worklist | null,
  preferences: null as StandardListColumnPreferences | null,
  message: '',
  error: '',
  busy: false,
}
const action = (name: string) => `data-ppic-daily-action="${name}"`
const buttonClass = 'h-9 rounded border px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50'
const typeLabel: Record<string, string> = { INDEPENDENT_SEWING: '独立车缝', SEWING_TO_IRON_PACK: '车缝＋烫包', CUTTING_TO_IRON_PACK: '裁剪＋车缝＋烫包' }
const sourceLabel: Record<string, string> = { ASSIGNMENT: '任务分配数量', CUT_PIECE_COMPLETE_KIT: '实际交出齐套数量', CUT_PIECE_RELEASE: '裁片放行数量' }
const milestoneLabel: Record<string, string> = { REACHED: '已达成', DUE_TODAY: '今日到期', OVERDUE: '已逾期', UPCOMING: '待达成', CUTTING_SHORTFALL: '缺裁片' }
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
export function renderPpicDailyImage(imageUrl: string, label: string, prefix: string): string {
  if (!imageUrl) return '<span class="inline-flex h-16 w-16 shrink-0 items-center rounded border border-red-200 bg-red-50 p-1 text-center text-xs text-red-700">对应款式图片缺失</span>'
  return `<button class="relative h-16 w-16 shrink-0 overflow-hidden rounded border" data-${prefix}-action="image" data-image-url="${escapeHtml(imageUrl)}" data-image-label="${escapeHtml(label)}" aria-label="查看${escapeHtml(label)}高清图"><img class="h-full w-full object-contain" src="${escapeHtml(staticImageThumbnail(imageUrl))}" alt="${escapeHtml(label)}款式图" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden class="absolute inset-0 flex items-center justify-center bg-red-50 p-1 text-xs text-red-700">图片加载失败</span></button>`
}
export function renderPpicDailyImageDialog(imageUrl: string, label: string, prefix: string): string {
  return `<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4" role="dialog" aria-modal="true" aria-label="${escapeHtml(label)}高清图"><button class="absolute inset-0" data-${prefix}-action="close" aria-label="关闭大图"></button><section class="relative z-10 max-h-[92vh] w-full max-w-4xl overflow-auto rounded bg-white p-4"><header class="mb-3 flex items-center justify-between gap-2"><b>${escapeHtml(label)}</b><button class="${buttonClass}" data-${prefix}-action="close">关闭</button></header><img class="mx-auto max-h-[78vh] max-w-full object-contain" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(label)}高清图" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><p hidden class="rounded bg-red-50 p-3 text-red-700">图片加载失败，关闭后可重新打开。</p></section></div>`
}
function nowBusinessDate(): string { return ppicBusinessDate(new Date().toISOString(), state.view?.config.timeZone || 'Asia/Jakarta') }
function writable(): boolean { return Boolean(state.view && state.view.date === nowBusinessDate()) }
function hasUnsavedInput(): boolean { const d = state.dialog; return Boolean(d && 'dirty' in d && d.dirty) }
function defaultDeadline(): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: state.view?.config.timeZone || 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(Date.now() + 3600000))
  const part = (type: string) => parts.find(p => p.type === type)!.value
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`
}
function loadView(): void {
  state.view = getPpicDailyWorklistView(state.query)
  state.query.date = state.view.date
  state.draft.date ||= state.view.date
  state.pageSize = preferences().pageSize
}
function feedback(): string {
  return `${state.error ? `<p role="alert" class="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">${escapeHtml(state.error)}</p>` : ''}${state.message ? `<p role="status" class="rounded bg-emerald-50 p-3 text-sm text-emerald-800">${escapeHtml(state.message)}</p>` : ''}`
}
function contextLine(): string {
  const view = state.view!
  return `${escapeHtml(view.date)} · 每日 ${escapeHtml(view.config.cutoff)} 截止（${escapeHtml(view.config.timeZone)}）${writable() ? '' : ' · 历史业务日只读'}`
}
function headerActions(): string {
  return `<button class="${buttonClass}" ${action('config')}>截止设置</button>`
}
function selectField(field: 'ppicId' | 'factoryId' | 'status', label: string, options: Array<{ value: string; label: string }>): string {
  const value = state.draft[field] || ''
  return `<label class="text-xs text-slate-600">${label}<select aria-label="${label}" class="mt-1 block h-9 min-w-36 max-w-52 rounded border bg-white px-2 text-sm" data-skip-page-rerender="true" data-ppic-daily-field="${field}"><option value="">全部</option>${options.map(o => `<option value="${escapeHtml(o.value)}"${value === o.value ? ' selected' : ''}>${escapeHtml(o.label)}</option>`).join('')}</select></label>`
}
function filters(): string {
  const view = state.view!
  return renderStandardListFilters({
    actionPrefix: 'ppic-daily',
    fieldsHtml: `<label class="text-xs text-slate-600">业务日期<input aria-label="业务日期" class="mt-1 block h-9 rounded border px-2 text-sm" type="date" data-skip-page-rerender="true" data-ppic-daily-field="date" value="${escapeHtml(state.draft.date || '')}"></label>${selectField('ppicId', 'PPIC', view.ppicOptions.map(o => ({ value: o.id, label: `${o.name}（${o.count}）` })))}${selectField('factoryId', '工厂', view.factories)}${selectField('status', '回货状态', PPIC_DAILY_WORKLIST_STATUS_OPTIONS.map(o => ({ value: o.value, label: o.label })))}<label class="min-w-44 flex-1 text-xs text-slate-600">生产单／任务／工厂／承诺号<input aria-label="生产单／任务／工厂／承诺号" class="mt-1 h-9 w-full rounded border px-2 text-sm" data-skip-page-rerender="true" data-ppic-daily-field="keyword" value="${escapeHtml(state.draft.keyword || '')}" placeholder="生产单、任务、工厂或承诺号"></label>`,
    extraActionsHtml: `<button class="${buttonClass}" ${action('export')}>导出全部筛选结果</button>`,
  })
}
function stats(): string {
  const s = state.view!.stats
  return renderStandardListStats([
    { label: '任务数', value: s.tasks },
    { label: '待核对', value: s.conflicts },
    { label: '应回合计', value: `${s.expectedQty} 件` },
    { label: '正式实收', value: `${s.receivedQty} 件` },
    { label: '待回合计', value: `${s.pendingQty} 件` },
    { label: '当前欠回', value: `${s.currentGap} 件` },
    { label: '今日已安排', value: `${s.arranged}／${s.tasks}` },
    { label: 'PPIC 提交', value: `${s.submitted}／${s.ppics}` },
  ], { compact: true })
}
function submissionTone(status: string): string {
  return ['未提交', '未提交已超时', '待重新确认'].includes(status) ? 'text-amber-800' : status === '逾期补交' ? 'text-red-700' : status === '已提交' ? 'text-emerald-700' : 'text-slate-500'
}
function statusTone(status: Task['status']): string {
  if (status === 'CONFLICT' || status === 'OVERDUE') return 'border-red-200 bg-red-50 text-red-700'
  if (status === 'MISSING_REASON' || status === 'PENDING' || status === 'NO_ARRANGEMENT') return 'border-amber-200 bg-amber-50 text-amber-800'
  if (status === 'COMPLETED') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  return 'border-blue-200 bg-blue-50 text-blue-700'
}
function milestoneTone(status: string): string {
  if (status === 'REACHED') return 'text-emerald-700'
  if (status === 'OVERDUE' || status === 'CUTTING_SHORTFALL') return 'text-red-700'
  if (status === 'DUE_TODAY') return 'text-amber-800'
  return 'text-slate-500'
}
function reporters(task: Task): string[] { return [...new Set(task.todayPromises.map(p => p.actorName))] }
const columns: StandardListColumn<Task>[] = [
  { key: 'task', title: '款式／任务／工厂', width: 250, required: true, freezeable: true, render: t => `<div class="flex gap-2" data-daily-task="${escapeHtml(t.task.assignmentId)}">${renderPpicDailyImage(t.basis.imageUrl, `${t.basis.productionOrderNo} ${t.basis.taskNo}`, 'ppic-daily')}<div class="min-w-0"><b>${escapeHtml(t.basis.taskNo)}</b><p class="mt-1 text-xs">${escapeHtml(t.basis.productionOrderNo)}</p><p class="mt-1 text-xs text-slate-500">${escapeHtml(t.basis.factoryName)}</p><p class="mt-1 text-xs text-slate-500">${t.basis.taskType ? escapeHtml(typeLabel[t.basis.taskType] || t.basis.taskType) : '任务类型待核对'}</p></div></div>` },
  { key: 'ppic', title: 'PPIC／今日填报', width: 150, required: true, freezeable: true, render: t => `<div><b>${escapeHtml(t.ownerName)}</b><p class="mt-1 text-xs ${submissionTone(t.submissionStatus)}">${escapeHtml(t.submissionStatus)}</p>${reporters(t).length && !reporters(t).includes(t.ownerName) ? `<p class="mt-1 text-xs text-slate-500">今日填报：${escapeHtml(reporters(t).join('、'))}</p>` : ''}${t.ownerActive && writable() && t.submissionStatus !== '已提交' ? `<button class="mt-1 text-xs font-semibold text-blue-700" ${action('confirm-owner')} data-ppic-id="${escapeHtml(t.task.ownerId)}">去确认</button>` : ''}</div>` },
  { key: 'basis', title: '应回／实收', width: 130, required: true, render: t => `<b>${t.capacity.expectedQty === null ? '待核对' : t.capacity.expectedQty + ' 件'}</b><p class="mt-1 text-xs">实收 ${t.capacity.receivedQty} 件</p><p class="mt-1 text-xs text-slate-500">${escapeHtml(sourceLabel[t.basis.sourceKind || ''] || '来源待核对')}</p>` },
  { key: 'pending', title: '状态／待回', width: 160, required: true, render: t => `<span class="mb-1 inline-flex rounded border px-2 py-0.5 text-xs font-semibold ${statusTone(t.status)}">${escapeHtml(t.statusLabel)}</span><p class="text-xs"><b class="${t.capacity.conflict ? 'text-red-700' : ''}">${t.capacity.conflict ? '待回待核对' : '待回 ' + t.capacity.pending + ' 件'}</b> · 未兑现 ${t.capacity.reserved} 件</p>${t.capacity.conflict ? '' : `<p class="mt-1 text-xs text-blue-700">可新增 ${t.capacity.available} 件</p>`}${t.capacity.expectedQty !== null && (t.capacity.pending < 0 || t.capacity.available < 0) ? '<p class="mt-1 text-xs text-red-700">实收或承诺超过应回</p>' : ''}${t.noArrangementReason && !t.todayHasArrangement ? `<p class="mt-1 text-xs text-slate-500">无安排：${escapeHtml(t.noArrangementReason)}</p>` : ''}` },
  { key: 'available', title: '可新增', width: 100, render: t => `<b class="${t.capacity.conflict ? 'text-red-700' : 'text-blue-700'}">${t.capacity.conflict ? '待核对' : t.capacity.available + ' 件'}</b>` },
  { key: 'promises', title: '今日回货承诺', width: 210, required: true, render: t => {
    const quantity = t.todayPromises.reduce((n, p) => n + p.quantity, 0)
    const latest = t.todayPromises.map(p => p.revisions.at(-1)?.deadlineAt || p.originalDeadlineAt).sort().at(-1) || ''
    const statuses = [...new Set(t.todayPromises.map(p => p.result.status))]
    return `${t.todayPromises.length ? `<b>${t.todayPromises.length} 笔 · ${quantity} 件</b><p class="mt-1 text-xs">${escapeHtml(statuses.join('、'))}${latest ? ' · ' + escapeHtml(ppicDailyTime(latest, state.view!.config.timeZone)) : ''}</p>` : '<span class="text-xs text-slate-500">今日无承诺</span>'}${t.todayMakeups.length ? `<p class="mt-1 text-xs text-blue-700">补回 ${t.todayMakeups.length} 笔</p>` : ''}${t.todayRevisionCount ? `<p class="mt-1 text-xs text-amber-800">修改安排 ${t.todayRevisionCount} 笔</p>` : ''}`
  } },
  { key: 'nodes', title: '累计节点', width: 210, render: t => `${t.milestones.map(m => `<p class="text-xs ${milestoneTone(m.status)}">${Math.round(m.ratio * 100)}% · ${m.targetQty} 件 · ${escapeHtml(ppicDailyTime(m.deadlineAt, state.view!.config.timeZone))} · ${escapeHtml(milestoneLabel[m.status] || m.status)}</p>`).join('')}${t.missingMilestones?.length ? '<p class="mt-1 text-xs text-amber-800">历史节点待核对</p>' : ''}${!t.milestones.length && !t.missingMilestones?.length ? '<span class="text-xs text-slate-500">尚无节点</span>' : ''}` },
  { key: 'status', title: '状态', width: 140, render: t => `<span class="inline-flex rounded border px-2 py-1 text-xs font-semibold ${statusTone(t.status)}">${escapeHtml(t.statusLabel)}</span>${t.noArrangementReason && !t.todayHasArrangement ? `<p class="mt-1 text-xs text-slate-500">无安排：${escapeHtml(t.noArrangementReason)}</p>` : ''}` },
  { key: 'actions', title: '操作', width: 160, required: true, actionColumn: true, render: t => `<div class="flex flex-col items-start gap-1"><button class="text-sm font-semibold text-blue-700" ${action('task-detail')} data-assignment-id="${escapeHtml(t.task.assignmentId)}">回货明细</button>${writable() && t.ownerActive ? `<button class="text-xs font-semibold text-blue-700 disabled:text-slate-400" ${action('promise')} data-assignment-id="${escapeHtml(t.task.assignmentId)}"${t.capacity.conflict || t.capacity.available <= 0 ? ' disabled' : ''}>新增承诺</button>` : ''}</div>` },
]
for (const column of columns) if (!column.actionColumn) {
  column.sortable = true
  column.freezeable = true
  column.sortValue = row => ({ task: `${row.basis.productionOrderNo} ${row.basis.taskNo}`, ppic: row.ownerName, basis: row.capacity.expectedQty ?? -1, pending: row.capacity.conflict ? -1 : row.capacity.pending, available: row.capacity.conflict ? -1 : row.capacity.available, promises: row.todayPromises.reduce((n, p) => n + p.quantity, 0), nodes: row.milestones.at(-1)?.deadlineAt || '', status: row.statusLabel })[column.key]
}
const preferenceStorage = {
  getItem(key: string) { const value = window.localStorage.getItem(key); return value && value.length > 4096 ? null : value },
  setItem(key: string, value: string) { if (value.length <= 4096) window.localStorage.setItem(key, value) },
}
function preferenceKey(): string { return 'higood.ppic-daily-worklist.columns.v1' }
function defaultPreferences(): StandardListColumnPreferences { return normalizeListColumnPreferences(columns, { order: columns.map(c => c.key), visibleKeys: columns.filter(c => !['nodes', 'available', 'status'].includes(c.key)).map(c => c.key), frozenKeys: ['task'], pageSize: 20 }, [20, 50]) }
function preferences(): StandardListColumnPreferences { return state.preferences ||= loadListColumnPreferences(preferenceStorage, preferenceKey(), columns, defaultPreferences(), [20, 50]) }
function persistPreferences(): void { state.preferences = normalizeListColumnPreferences(columns, preferences(), [20, 50]); saveListColumnPreferences(preferenceStorage, preferenceKey(), preferences()) }
function sortedRows(): Task[] { return sortStandardListRows(state.view!.rows, state.sort, (row, key) => columns.find(c => c.key === key)?.sortValue?.(row)) }
function pageSlice(): { rows: Task[]; from: number; to: number; totalPages: number } {
  const rows = sortedRows(), totalPages = Math.max(1, Math.ceil(rows.length / state.pageSize))
  state.page = Math.min(Math.max(1, state.page), totalPages)
  const from = (state.page - 1) * state.pageSize
  return { rows: rows.slice(from, from + state.pageSize), from, to: Math.min(from + state.pageSize, rows.length), totalPages }
}
function table(): string {
  const slice = pageSlice()
  return renderStandardListTable({ columns, rows: slice.rows, preferences: preferences(), sort: state.sort, eventPrefix: 'ppic-daily', skipPageRerender: true, emptyText: '当前筛选没有第三方车缝任务' })
}
function pagination(): string {
  const slice = pageSlice()
  return renderTablePagination({ total: sortedRows().length, from: sortedRows().length ? slice.from + 1 : 0, to: slice.to, currentPage: state.page, totalPages: slice.totalPages, pageSize: state.pageSize, actionPrefix: 'ppic-daily', fieldPrefix: 'ppic-daily', pageSizeOptions: [20, 50], skipPageRerender: true })
}
function promiseCard(task: Task, promise: PromiseRow): string {
  const r = promise.result
  const newTime = promise.revisions.at(-1)?.deadlineAt
  const canWrite = writable() && task.ownerActive
  return `<article class="rounded border bg-slate-50 p-3" data-promise-id="${escapeHtml(promise.promiseId)}"><div class="flex flex-wrap justify-between gap-2"><b class="text-sm">${escapeHtml(promise.promiseNo)} · ${promise.quantity} 件</b><span class="text-xs ${r.currentGap && r.due ? 'text-red-700' : 'text-slate-600'}">${escapeHtml(r.status)}${r.missingReason ? ' · 待补原因' : ''}</span></div><p class="mt-1 text-xs text-slate-600">原截止 ${escapeHtml(ppicDailyTime(promise.originalDeadlineAt, state.view!.config.timeZone))} · 准时 ${r.timelyQty} 件 · 实收 ${r.receivedQty} 件 · ${r.due ? '当前欠回' : '待回'} ${r.currentGap} 件${r.due ? ` · 原欠回 ${r.originalGap} 件 · 可新安排补回 ${r.makeupAvailableQty} 件` : ''}</p>${newTime ? `<p class="mt-1 text-xs text-amber-800">最新安排 ${escapeHtml(ppicDailyTime(newTime, state.view!.config.timeZone))}；仍按原截止考核 · ${escapeHtml(promise.revisions.at(-1)!.reason)}</p>` : ''}${r.makeups.length ? `<div class="mt-2 space-y-1">${r.makeups.map(m => `<p class="text-xs ${m.active ? 'text-blue-700' : 'text-slate-500'}">第 ${m.round} 轮补回 ${m.quantity} 件 · ${escapeHtml(ppicDailyTime(m.deadlineAt, state.view!.config.timeZone))} · ${escapeHtml(m.reason)}${m.detail ? `：${escapeHtml(m.detail)}` : ''} · 已回 ${m.receivedQty} 件${m.active ? ' · 待回 ' + m.currentGap + ' 件' + (m.releasedQty ? ' · 正式实收更新解除 ' + m.releasedQty + ' 件' : '') : ' · 剩余已重新安排'}</p>`).join('')}</div>` : ''}${r.makeupAllocationConflict ? '<p role="alert" class="mt-2 text-xs text-red-700">补回分摊存在数量冲突，核对后才能安排。</p>' : ''}<div class="mt-3 flex flex-wrap gap-2">${canWrite ? !r.due ? `<button class="${buttonClass}" ${action('amendment')} data-assignment-id="${escapeHtml(task.task.assignmentId)}" data-promise-id="${escapeHtml(promise.promiseId)}"${!r.currentGap ? ' disabled' : ''}>修改安排时间</button>` : `${r.currentGap && r.makeupAvailableQty > 0 && !r.makeupAllocationConflict ? `<button class="${buttonClass} bg-blue-600 text-white" ${action('makeup')} data-assignment-id="${escapeHtml(task.task.assignmentId)}" data-promise-id="${escapeHtml(promise.promiseId)}">安排补回</button>` : ''}${r.originalGap ? `<button class="${buttonClass}" ${action('reason')} data-assignment-id="${escapeHtml(task.task.assignmentId)}" data-promise-id="${escapeHtml(promise.promiseId)}">补充欠回原因</button>` : ''}` : ''}</div></article>`
}
function canPromise(task: Task): boolean { return writable() && task.ownerActive && !task.capacity.conflict && task.capacity.available > 0 }
function taskDetailDialog(task: Task): string {
  const b = task.basis, c = task.capacity
  return `<div class="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-label="回货任务明细"><button class="fixed inset-0" ${action('close')} aria-label="关闭"></button><section class="relative mx-auto my-8 w-full max-w-5xl rounded-xl bg-white p-5" data-daily-task-detail="${escapeHtml(task.task.assignmentId)}"><header class="flex items-start justify-between gap-3"><div><h2 class="text-lg font-semibold">${escapeHtml(b.taskNo)} · 回货明细</h2><p class="mt-1 text-sm">${escapeHtml(b.productionOrderNo)} · ${escapeHtml(b.factoryName)} · ${escapeHtml(typeLabel[b.taskType || ''] || '任务类型待核对')} · ${escapeHtml(task.ownerName)}</p></div><button class="${buttonClass}" ${action('close')}>关闭</button></header><div class="mt-4 flex flex-wrap items-start gap-4">${renderPpicDailyImage(b.imageUrl, `${b.productionOrderNo} ${b.taskNo}`, 'ppic-daily')}<div class="min-w-0 flex-1"><span class="inline-flex rounded border px-2 py-1 text-xs font-semibold ${statusTone(task.status)}">${escapeHtml(task.statusLabel)}</span><p class="mt-2 text-xs ${submissionTone(task.submissionStatus)}">今日填报：${escapeHtml(task.submissionStatus)}${task.needsReconfirmation ? ' · 有新增安排，需重新确认' : ''}</p><p class="mt-1 text-xs ${c.conflict ? 'text-red-700' : 'text-slate-500'}">${escapeHtml(b.message)}${c.expectedQty !== null && (c.pending < 0 || c.available < 0) ? ' · 后道实收或未兑现承诺超过当前应回量，核对来源后才能新增承诺。' : ''}${b.sourceKind ? ` · 依据：${escapeHtml(sourceLabel[b.sourceKind] || b.sourceKind)}` : ''}</p></div><div class="flex flex-wrap gap-2">${canPromise(task) ? `<button class="${buttonClass} bg-blue-600 text-white" ${action('promise')} data-assignment-id="${escapeHtml(task.task.assignmentId)}">新增回货承诺</button>` : ''}${writable() && task.ownerActive ? `<button class="${buttonClass}" ${action('confirm-owner')} data-ppic-id="${escapeHtml(task.task.ownerId)}">确认今日填报</button>` : ''}</div></div><div class="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5"><p class="rounded bg-slate-50 p-2 text-sm">应回 <b>${c.expectedQty === null ? '待核对' : c.expectedQty + ' 件'}</b></p><p class="rounded bg-slate-50 p-2 text-sm">实收 <b>${c.receivedQty} 件</b></p><p class="rounded bg-slate-50 p-2 text-sm">待回 <b class="${c.conflict ? 'text-red-700' : ''}">${c.conflict ? '待核对' : c.pending + ' 件'}</b></p><p class="rounded bg-slate-50 p-2 text-sm">未兑现承诺 <b>${c.reserved} 件</b></p><p class="rounded bg-slate-50 p-2 text-sm">可新增 <b class="${c.conflict ? 'text-red-700' : 'text-blue-700'}">${c.conflict ? '待核对' : c.available + ' 件'}</b></p></div><details class="mt-4 rounded border p-3"><summary class="cursor-pointer text-sm font-semibold">应回明细与两节点</summary><div class="mt-3 overflow-x-auto"><table class="w-full text-left text-xs"><thead><tr><th class="p-2">颜色／尺码</th><th class="p-2">分配（件）</th><th class="p-2">交出齐套（件）</th><th class="p-2">放行（件）</th><th class="p-2">应回（件）</th></tr></thead><tbody>${b.skuLines.map(l => `<tr class="border-t"><td class="p-2">${escapeHtml(l.color)}／${escapeHtml(l.size)}</td><td class="p-2">${l.assignedQty}</td><td class="p-2">${l.handedOverCompleteKitQty}</td><td class="p-2">${l.releaseConfirmQty ?? '—'}</td><td class="p-2">${l.expectedQty ?? '待核对'}</td></tr>`).join('')}</tbody></table></div>${b.missingParts.length ? `<p class="mt-2 text-xs text-amber-800">缺裁片：${b.missingParts.map(p => `${escapeHtml(p.color)}／${escapeHtml(p.size)} ${escapeHtml(p.partName)} ${p.missingPieceQty} 片`).join('；')}</p>` : ''}<div class="mt-2 flex flex-wrap gap-3">${task.missingMilestones?.length || task.milestones.length < 2 ? `<span class="text-xs text-amber-800">历史节点的应回依据待核对${task.missingMilestones?.length ? '：' + task.missingMilestones.map(m => Math.round(m.ratio * 100) + '% · ' + escapeHtml(ppicDailyTime(m.deadlineAt, state.view!.config.timeZone))).join('；') : '，尚未完整形成两个监控节点'}。</span>` : ''}${task.milestones.map(m => `<span class="text-xs ${milestoneTone(m.status)}">${Math.round(m.ratio * 100)}% · ${m.targetQty} 件 · ${escapeHtml(ppicDailyTime(m.deadlineAt, state.view!.config.timeZone))} · ${escapeHtml(milestoneLabel[m.status] || m.status)}</span>`).join('')}</div>${task.responsibilityHistory.length ? `<p class="mt-2 text-xs text-slate-500">责任历史：${task.responsibilityHistory.map(h => `${escapeHtml(h.ppicName)}（${escapeHtml(ppicDailyTime(h.effectiveAt, state.view!.config.timeZone))}）`).join(' → ')}</p>` : ''}</details><h3 class="mt-4 font-semibold">回货承诺与补回</h3><div class="mt-2 space-y-2">${task.promises.map(p => promiseCard(task, p)).join('') || '<p class="rounded border p-3 text-sm text-slate-500">今日暂无回货承诺</p>'}</div>${task.needsDailyConfirmation && !task.todayHasArrangement ? `<p class="mt-3 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">今日未安排回货；无安排原因：${task.noArrangementReason ? escapeHtml(task.noArrangementReason) : '尚未填写'}。${task.ownerActive && writable() ? '请在“确认今日填报”中补充原因。' : ''}</p>` : ''}</section></div>`
}
function formDialog(d: Extract<NonNullable<Dialog>, { kind: FormKind }>): string {
  const task = state.view!.rows.find(t => t.task.assignmentId === d.assignmentId)
  if (!task) return ''
  const p = task.promises.find(p => p.promiseId === d.promiseId)
  const title = { promise: '新增回货承诺', makeup: '安排补回', reason: '补充欠回原因', amendment: '修改安排时间' }[d.kind]
  return `<div class="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-label="${title}"><button class="fixed inset-0" ${action('close')} aria-label="关闭"></button><section class="relative mx-auto my-8 w-full max-w-lg rounded-xl bg-white p-5"><header class="flex items-center justify-between gap-3"><h2 class="text-lg font-semibold">${title}</h2><button class="${buttonClass}" ${action('close')}${state.busy ? ' disabled' : ''}>关闭</button></header><p class="mt-2 text-sm">${escapeHtml(task.basis.taskNo)} · ${escapeHtml(task.basis.factoryName)} · ${escapeHtml(task.ownerName)}</p>${p ? `<p class="mt-2 rounded bg-amber-50 p-3 text-sm">原承诺 ${p.quantity} 件 · 原截止 ${escapeHtml(ppicDailyTime(p.originalDeadlineAt, state.view!.config.timeZone))} · ${p.result.due ? '当前欠回' : '待回'} ${p.result.currentGap} 件${d.kind === 'makeup' ? ' · 可新安排补回 ' + p.result.makeupAvailableQty + ' 件' : ''}。修改安排和补回均保留原截止考核。</p>` : `<p class="mt-2 text-sm text-blue-700">可新增承诺 ${task.capacity.available} 件</p>`}<div class="mt-4 space-y-4">${['promise', 'makeup'].includes(d.kind) ? `<label class="block text-sm">${d.kind === 'makeup' ? '本次补回' : '承诺回货'}数量（件）<input aria-label="数量（件）" class="mt-1 h-11 w-full rounded border px-3" type="number" min="1" max="${d.kind === 'makeup' ? p!.result.makeupAvailableQty : task.capacity.available}" step="1" data-skip-page-rerender="true" data-ppic-daily-dialog-field="quantity" value="${escapeHtml(d.quantity)}"></label>` : ''}${d.kind !== 'reason' ? `<label class="block text-sm">预计后道确认时间（${escapeHtml(state.view!.config.timeZone)}）<input aria-label="预计后道确认时间" class="mt-1 h-11 w-full rounded border px-3" type="datetime-local" data-skip-page-rerender="true" data-ppic-daily-dialog-field="deadlineAt" value="${escapeHtml(d.deadlineAt)}"></label>` : ''}${d.kind === 'amendment' ? `<label class="block text-sm">修改原因<input aria-label="修改原因" class="mt-1 h-11 w-full rounded border px-3" data-skip-page-rerender="true" data-ppic-daily-dialog-field="reason" value="${escapeHtml(d.reason)}"></label>` : ['makeup', 'reason'].includes(d.kind) ? `<label class="block text-sm">欠回原因<select aria-label="欠回原因" class="mt-1 h-11 w-full rounded border px-3" data-skip-page-rerender="true" data-ppic-daily-dialog-field="reason"><option value="">选择原因</option>${PPIC_RETURN_REASONS.map(r => `<option${r === d.reason ? ' selected' : ''}>${r}</option>`).join('')}</select></label><label class="block text-sm">具体情况${d.reason === '其他' ? '（必填）' : ''}<textarea aria-label="具体情况" class="mt-1 min-h-20 w-full rounded border p-3" data-skip-page-rerender="true" data-ppic-daily-dialog-field="detail">${escapeHtml(d.detail)}</textarea></label>` : ''}</div><div data-daily-dialog-error>${d.error ? `<p role="alert" class="mt-3 rounded bg-red-50 p-3 text-sm text-red-700">${escapeHtml(d.error)} 输入尚未保存，可调整后重试。</p>` : ''}</div><footer class="mt-5 flex justify-end gap-2"><button class="${buttonClass}" ${action('close')}${state.busy ? ' disabled' : ''}>取消</button><button class="${buttonClass} bg-blue-600 text-white" ${action('save')}${state.busy ? ' disabled' : ''}>${state.busy ? '正在保存' : `保存${title}`}</button></footer></section></div>`
}
function confirmActorOptions(): Array<{ id: string; name: string }> {
  const map = new Map<string, string>()
  for (const actor of listPpicDailyActors()) map.set(actor.id, actor.name)
  for (const row of state.view?.rows || []) if (row.owner) map.set(row.owner.id, row.owner.name)
  return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
}
function readConfirmView(ppicId: string): { view: ReturnType<typeof getPpicDailyReturnView> | null; error: string } {
  try { return { view: getPpicDailyReturnView({ date: state.view!.date, actorId: ppicId }), error: '' } }
  catch (error) { return { view: null, error: error instanceof Error ? error.message : 'PPIC 填报读取失败。' } }
}
function confirmDialog(d: Extract<NonNullable<Dialog>, { kind: 'confirm' }>): string {
  const options = confirmActorOptions()
  if (!options.some(o => o.id === d.ppicId)) options.unshift({ id: d.ppicId, name: getPpicDailyActorById(d.ppicId)?.name || d.ppicId })
  const { view, error } = readConfirmView(d.ppicId)
  return `<div class="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-label="确认今日填报"><button class="fixed inset-0" ${action('close')} aria-label="关闭"></button><section class="relative mx-auto my-8 w-full max-w-2xl rounded-xl bg-white p-5"><header class="flex items-center justify-between gap-3"><h2 class="text-lg font-semibold">确认今日填报</h2><button class="${buttonClass}" ${action('close')}${state.busy ? ' disabled' : ''}>关闭</button></header><label class="mt-4 block text-sm">填报 PPIC<select aria-label="填报 PPIC" class="mt-1 h-10 w-full rounded border px-3" data-skip-page-rerender="true" data-ppic-daily-confirm-field="ppicId">${options.map(o => `<option value="${escapeHtml(o.id)}"${o.id === d.ppicId ? ' selected' : ''}>${escapeHtml(o.name)}</option>`).join('')}</select></label>${error ? `<p role="alert" class="mt-3 rounded bg-red-50 p-3 text-sm text-red-700">${escapeHtml(error)}</p>` : view ? `<p class="mt-3 rounded bg-slate-50 p-3 text-sm">${escapeHtml(view.actor.name)} · ${escapeHtml(view.date)} · <span class="${submissionTone(view.submissionStatus)}">${escapeHtml(view.submissionStatus)}</span>${view.confirmation ? ` · 上次提交 ${escapeHtml(ppicDailyTime(view.confirmation.submittedAt, view.config.timeZone))}` : ''}<br>确认覆盖该 PPIC 全部 ${view.tasks.length} 个当前任务${state.query.ppicId || state.query.keyword ? '，包括筛选未展示的任务' : ''}。${view.tasks.length ? '' : '今日无负责任务，也需要确认。'}</p><div class="mt-3 space-y-2">${view.tasks.map(task => `<article class="rounded border p-3" data-confirm-task="${escapeHtml(task.task.assignmentId)}"><div class="flex flex-wrap items-center justify-between gap-2"><b class="text-sm">${escapeHtml(task.basis.taskNo)} · ${escapeHtml(task.basis.factoryName)}</b><span class="text-xs ${task.todayHasArrangement ? 'text-emerald-700' : 'text-amber-800'}">${task.todayHasArrangement ? '今日已安排' : '今日无回货安排'}</span></div>${task.todayHasArrangement ? '' : `<input aria-label="${escapeHtml(task.basis.taskNo)}今日无安排原因" class="mt-2 h-10 w-full rounded border px-3 text-sm" data-skip-page-rerender="true" data-ppic-daily-confirm-reason="${escapeHtml(task.task.assignmentId)}" value="${escapeHtml(d.reasons[task.task.assignmentId] || '')}" placeholder="填写今天没有回货安排的原因"${!writable() ? ' disabled' : ''}>`}</article>`).join('')}</div>` : ''}${d.error ? `<p role="alert" class="mt-3 rounded bg-red-50 p-3 text-sm text-red-700">${escapeHtml(d.error)} 输入尚未保存，可调整后重试。</p>` : ''}<footer class="mt-5 flex justify-end gap-2"><button class="${buttonClass}" ${action('close')}${state.busy ? ' disabled' : ''}>取消</button><button class="${buttonClass} bg-blue-600 text-white" ${action('confirm-save')}${state.busy || !writable() || !view ? ' disabled' : ''}>${state.busy ? '正在保存' : view?.confirmation ? '更新今日填报确认' : '确认今日填报'}</button></footer></section></div>`
}
function configDialog(d: Extract<NonNullable<Dialog>, { kind: 'config' }>): string {
  return `<div class="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-label="每日提交截止设置"><button class="fixed inset-0" ${action('close')} aria-label="关闭"></button><section class="relative mx-auto my-8 w-full max-w-md rounded-xl bg-white p-5"><header class="flex items-center justify-between gap-3"><h2 class="text-lg font-semibold">每日提交截止设置</h2><button class="${buttonClass}" ${action('close')}${state.busy ? ' disabled' : ''}>关闭</button></header><p class="mt-2 text-xs text-slate-500">新设置按生效日使用，已提交记录保留当时截止依据。</p><label class="mt-4 block text-sm">业务时区<input aria-label="业务时区" class="mt-1 h-10 w-full rounded border bg-slate-50 px-3" readonly value="Asia/Jakarta"></label><label class="mt-4 block text-sm">每日截止时间<input aria-label="每日截止时间" class="mt-1 h-10 w-full rounded border px-3" type="time" data-skip-page-rerender="true" data-ppic-daily-config-field="cutoff" value="${escapeHtml(d.cutoff)}"></label><label class="mt-4 block text-sm">生效日期<input aria-label="生效日期" class="mt-1 h-10 w-full rounded border px-3" type="date" data-skip-page-rerender="true" data-ppic-daily-config-field="effectiveFrom" value="${escapeHtml(d.effectiveFrom)}"></label>${d.error ? `<p role="alert" class="mt-3 rounded bg-red-50 p-3 text-sm text-red-700">${escapeHtml(d.error)}；尚未保存，可重试。</p>` : ''}<button class="mt-5 w-full ${buttonClass} bg-blue-600 text-white" ${action('save-config')}${state.busy ? ' disabled' : ''}>${state.busy ? '正在保存' : '保存截止设置'}</button></section></div>`
}
function columnsDialog(): string {
  return renderStandardListColumnSettings({ title: '每日回货填报列设置', columns, preferences: preferences(), eventPrefix: 'ppic-daily', maxFrozenWidth: 520, skipPageRerender: true })
    .replace('<div class="fixed inset-0 z-50">', '<div class="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="每日回货填报列设置">')
}
function renderDialog(): string {
  const d = state.dialog
  if (!d) return ''
  if (d.kind === 'image') return renderPpicDailyImageDialog(d.imageUrl, d.label, 'ppic-daily')
  if (d.kind === 'task') { const task = state.view!.rows.find(t => t.task.assignmentId === d.assignmentId); return task ? taskDetailDialog(task) : '' }
  if (d.kind === 'columns') return columnsDialog()
  if (d.kind === 'confirm') return confirmDialog(d)
  if (d.kind === 'config') return configDialog(d)
  return formDialog(d)
}
function put(selector: string, html: string): void { if (selector === '[data-daily-overlay]') { updatePpicDailyOverlay(selector, html, state.busy); return }; const element = document.querySelector<HTMLElement>(selector); if (element) element.innerHTML = html }
function refresh(): void {
  loadView()
  put('[data-daily-header-actions]', headerActions())
  put('[data-daily-context]', contextLine())
  put('[data-daily-feedback]', feedback())
  put('[data-daily-stats]', stats())
  put('[data-daily-table]', table())
  put('[data-daily-pagination]', pagination())
  put('[data-daily-overlay]', renderDialog())
}
function refreshFilters(): void { put('[data-daily-filters]', filters()) }
export async function renderPpicDailyReturnReportPage(): Promise<string> {
  try {
    await ensurePpicDailyReturnState()
    if (!state.query.date) { const date = ppicBusinessDate(new Date().toISOString()); state.query = { date }; state.draft = { date } }
    state.dialog = null; state.busy = false; state.error = ''; state.message = ''
    loadView()
    return `${renderPostFinishingStorageNotice()}<main class="space-y-3" data-ppic-daily-page data-skip-page-rerender="true">${renderStandardListPage({
      title: '每日回货填报',
      primaryActionsHtml: `<div class="flex flex-wrap items-center gap-2" data-daily-header-actions>${headerActions()}</div>`,
      feedbackHtml: `<div class="flex flex-wrap items-center gap-3 text-sm text-slate-600" data-daily-context>${contextLine()}</div><div data-daily-feedback>${feedback()}</div>`,
      filtersHtml: `<div data-daily-filters>${filters()}</div>`,
      statsHtml: `<div data-daily-stats>${stats()}</div>`,
      listTitle: '回货车缝任务',
      listActionsHtml: `<button class="${buttonClass}" ${action('columns')}>列设置</button>`,
      tableHtml: `<div data-daily-table>${table()}</div>`,
      paginationHtml: `<div data-daily-pagination>${pagination()}</div>`,
      overlaysHtml: `<div data-daily-overlay>${renderDialog()}</div>`,
    })}</main>`
  } catch (error) {
    return `${renderPostFinishingStorageNotice()}<main data-ppic-daily-page data-skip-page-rerender="true" class="p-4"><h1 class="text-xl font-semibold">每日回货填报</h1><p role="alert" class="mt-4 rounded bg-red-50 p-4 text-red-700">${escapeHtml(error instanceof Error ? error.message : '回货记录读取失败')}。未读到的记录不会作为空记录保存。</p><button class="mt-3 ${buttonClass}" ${action('retry-load')}>重新读取</button></main>`
  }
}
export function closePpicDailyReturnDialog(): boolean {
  if (!state.dialog || state.busy) return false
  if (hasUnsavedInput() && !window.confirm('填写内容尚未保存，关闭将丢失输入。继续关闭？')) return true
  state.dialog = null; put('[data-daily-overlay]', ''); return true
}
export function isPpicDailyReturnDialogOpen(): boolean { return state.dialog !== null }
function openForm(kind: FormKind, assignmentId: string, promiseId = ''): void {
  const task = state.view!.rows.find(t => t.task.assignmentId === assignmentId)
  if (!task || !writable() || !task.ownerActive) return
  const p = task.promises.find(p => p.promiseId === promiseId)
  state.dialog = { kind, assignmentId, promiseId: p?.promiseId || '', operationId: crypto.randomUUID(), quantity: kind === 'makeup' ? String(p?.result.makeupAvailableQty || '') : '', deadlineAt: defaultDeadline(), reason: '', detail: '', error: '', dirty: false }
  put('[data-daily-overlay]', renderDialog())
}
function openConfirm(ppicId: string): void {
  if (!writable()) return
  if (!ppicId) { state.error = '未找到 PPIC，不能确认填报。'; put('[data-daily-feedback]', feedback()); return }
  const { view, error } = readConfirmView(ppicId)
  if (!view) { state.error = error; put('[data-daily-feedback]', feedback()); return }
  state.dialog = { kind: 'confirm', ppicId, operationId: crypto.randomUUID(), reasons: { ...(view.confirmation?.noArrangementReasons || {}) }, error: '', dirty: false }
  put('[data-daily-overlay]', renderDialog())
}
async function saveForm(): Promise<void> {
  const d = state.dialog; if (!d || !['promise', 'makeup', 'reason', 'amendment'].includes(d.kind) || state.busy) return
  const form = d as Extract<NonNullable<Dialog>, { kind: FormKind }>
  const task = state.view!.rows.find(t => t.task.assignmentId === form.assignmentId); if (!task) return
  state.busy = true; form.error = ''
  put('[data-daily-overlay]', renderDialog())
  try {
    const common = { operationId: form.operationId, assignmentId: form.assignmentId, actorId: task.task.ownerId }
    if (form.kind === 'promise') await savePpicDailyReturnPromise({ ...common, quantity: Number(form.quantity), deadlineAt: form.deadlineAt, date: state.view!.date, basisVersion: task.basis.basisVersion })
    else if (form.kind === 'makeup') await savePpicDailyReturnMakeup({ ...common, promiseId: form.promiseId, quantity: Number(form.quantity), deadlineAt: form.deadlineAt, reason: form.reason, detail: form.detail })
    else if (form.kind === 'reason') await savePpicDailyReturnReason({ ...common, promiseId: form.promiseId, reason: form.reason, detail: form.detail })
    else await savePpicDailyReturnAmendment({ ...common, promiseId: form.promiseId, deadlineAt: form.deadlineAt, reason: form.reason })
    state.dialog = null; state.message = `已保存 ${task.ownerName} 的回货安排。`; state.error = ''; state.busy = false; refresh(); refreshFilters()
  } catch (error) { state.busy = false; form.error = error instanceof Error ? error.message : '未保存，请重试。'; put('[data-daily-overlay]', renderDialog()) }
}
async function saveConfirm(): Promise<void> {
  const d = state.dialog; if (!d || d.kind !== 'confirm' || state.busy) return
  if (!writable()) return
  state.busy = true; d.error = ''
  put('[data-daily-overlay]', renderDialog())
  try {
    const { view } = readConfirmView(d.ppicId)
    const reasons = Object.fromEntries((view?.tasks || []).filter(task => !task.todayHasArrangement)
      .map(task => [task.task.assignmentId, (d.reasons[task.task.assignmentId] || '').trim()])
      .filter(([, reason]) => reason))
    await confirmPpicDailyReport({ operationId: d.operationId, date: state.view!.date, noArrangementReasons: reasons, actorId: d.ppicId })
    const name = getPpicDailyActorById(d.ppicId)?.name || d.ppicId
    state.dialog = null; state.message = `已确认 ${name} 的今日填报。`; state.error = ''; state.busy = false; refresh(); refreshFilters()
  } catch (error) { state.busy = false; d.error = error instanceof Error ? error.message : '今日填报未保存，请重试。'; put('[data-daily-overlay]', renderDialog()) }
}
async function saveConfig(): Promise<void> {
  const d = state.dialog; if (!d || d.kind !== 'config' || state.busy) return
  state.busy = true; d.error = ''
  put('[data-daily-overlay]', renderDialog())
  try {
    await savePpicDailyReturnConfig({ operationId: d.operationId, cutoff: d.cutoff, timeZone: d.timeZone, effectiveFrom: d.effectiveFrom })
    state.dialog = null; state.message = '已保存每日截止设置。'; state.error = ''; state.busy = false; refresh(); refreshFilters()
  } catch (error) { state.busy = false; d.error = error instanceof Error ? error.message : '截止设置未保存'; put('[data-daily-overlay]', renderDialog()) }
}
function exportRows(): void {
  const view = state.view!, cell = (value: unknown) => { const text = String(value ?? ''); return '"' + (typeof value === 'string' && /^[=+@\-\t\r]/.test(text) ? "'" + text : text).replaceAll('"', '""') + '"' }
  const rows = [['业务日期', '生产单', '任务', '工厂', '任务类型', 'PPIC', '今日填报', '应回件数', '正式实收件数', '待回件数', '未兑现承诺件数', '可新增件数', '今日承诺笔数', '今日承诺件数', '今日补回笔数', '今日修改安排笔数', '状态', '无安排原因', '累计节点'], ...view.rows.map(t => [view.date, t.basis.productionOrderNo, t.basis.taskNo, t.basis.factoryName, typeLabel[t.basis.taskType || ''] || '', t.ownerName, t.submissionStatus, t.capacity.expectedQty ?? '', t.capacity.receivedQty, t.capacity.conflict ? '' : t.capacity.pending, t.capacity.reserved, t.capacity.conflict ? '' : t.capacity.available, t.todayPromises.length, t.todayPromises.reduce((n, p) => n + p.quantity, 0), t.todayMakeups.length, t.todayRevisionCount, t.statusLabel, t.noArrangementReason, t.milestones.map(m => `${Math.round(m.ratio * 100)}% ${m.targetQty}件 ${ppicDailyTime(m.deadlineAt, view.config.timeZone)} ${milestoneLabel[m.status] || m.status}`).join('；')])]
  if (rows.length === 1) { state.error = '当前筛选没有可导出的记录。'; put('[data-daily-feedback]', feedback()); return }
  const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a'); link.href = url; link.download = `PPIC每日回货填报-${view.date}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}
function updatePageSlice(): void { put('[data-daily-table]', table()); put('[data-daily-pagination]', pagination()) }
export async function handlePpicDailyReturnReportEvent(target: HTMLElement, event?: Event): Promise<boolean> {
  const formField = target.closest<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[data-ppic-daily-dialog-field]')
  const activeDialog = state.dialog
  if (formField && activeDialog && (activeDialog.kind === 'promise' || activeDialog.kind === 'makeup' || activeDialog.kind === 'reason' || activeDialog.kind === 'amendment')) {
    const field = formField.dataset.ppicDailyDialogField as 'quantity' | 'deadlineAt' | 'reason' | 'detail'
    activeDialog[field] = formField.value; activeDialog.dirty = true; return true
  }
  const confirmField = target.closest<HTMLSelectElement>('[data-ppic-daily-confirm-field]')
  if (confirmField && state.dialog?.kind === 'confirm') {
    if (event?.type !== 'change') return true
    const d = state.dialog
    if (d.dirty && !window.confirm('已填写的无安排原因尚未保存，切换 PPIC 将丢失这些输入。继续切换？')) { confirmField.value = d.ppicId; return true }
    const ppicId = confirmField.value
    const { view, error } = readConfirmView(ppicId)
    state.dialog = { kind: 'confirm', ppicId, operationId: crypto.randomUUID(), reasons: { ...(view?.confirmation?.noArrangementReasons || {}) }, error, dirty: false }
    put('[data-daily-overlay]', renderDialog()); return true
  }
  const confirmReason = target.closest<HTMLInputElement>('[data-ppic-daily-confirm-reason]')
  if (confirmReason && state.dialog?.kind === 'confirm') { state.dialog.reasons[confirmReason.dataset.ppicDailyConfirmReason!] = confirmReason.value; state.dialog.dirty = true; return true }
  const configField = target.closest<HTMLInputElement>('[data-ppic-daily-config-field]')
  if (configField && state.dialog?.kind === 'config') { const field = configField.dataset.ppicDailyConfigField as 'cutoff' | 'effectiveFrom'; state.dialog[field] = configField.value; state.dialog.dirty = true; return true }
  const field = target.closest<HTMLInputElement | HTMLSelectElement>('[data-ppic-daily-field]')
  if (field) {
    const key = field.dataset.ppicDailyField
    if (key === 'keyword') { state.draft.keyword = field.value; return true }
    if (key === 'pageSize') { if (event?.type === 'change') { const prefs = preferences(); prefs.pageSize = [20, 50].includes(Number(field.value)) ? Number(field.value) : 20; persistPreferences(); state.pageSize = prefs.pageSize; state.page = 1; updatePageSlice() } return true }
    if (['date', 'ppicId', 'factoryId', 'status'].includes(key || '')) { state.draft[key as keyof PpicDailyWorklistQuery] = field.value; return true }
    return false
  }
  const node = target.closest<HTMLElement>('[data-ppic-daily-action]'); if (!node || event && event.type !== 'click') return false
  const name = node.dataset.ppicDailyAction
  if (name === 'close') { closePpicDailyReturnDialog(); return true }
  if (name === 'retry-load') { const root = document.querySelector<HTMLElement>('[data-ppic-daily-page]'); if (root) root.outerHTML = await renderPpicDailyReturnReportPage(); return true }
  if (state.busy) return true
  if (name === 'image') { state.dialog = { kind: 'image', imageUrl: node.dataset.imageUrl || '', label: node.dataset.imageLabel || '' }; put('[data-daily-overlay]', renderDialog()); return true }
  if (name === 'query') { state.query = { ...state.draft }; state.page = 1; refresh(); refreshFilters(); return true }
  if (name === 'reset') { const date = state.view?.date || ppicBusinessDate(new Date().toISOString()); state.query = { date }; state.draft = { date }; state.page = 1; state.sort = null; refresh(); refreshFilters(); return true }
  if (name === 'sort-column') { const key = node.dataset.columnKey || ''; state.sort = state.sort?.key !== key ? { key, direction: 'asc' } : state.sort.direction === 'asc' ? { key, direction: 'desc' } : null; state.page = 1; updatePageSlice(); return true }
  if (name === 'toggle-column-visibility' || name === 'toggle-column-freeze') { const key = node.dataset.ppicDailyColumnKey || ''; const column = columns.find(c => c.key === key); if (column && !column.actionColumn) { const prefs = preferences(), checked = node instanceof HTMLInputElement && node.checked; if (name === 'toggle-column-visibility' && !column.required) prefs.visibleKeys = checked ? [...new Set([...prefs.visibleKeys, key])] : prefs.visibleKeys.filter(k => k !== key); if (name === 'toggle-column-freeze' && column.freezeable) prefs.frozenKeys = checked ? [...new Set([...prefs.frozenKeys, key])] : prefs.frozenKeys.filter(k => k !== key); persistPreferences(); updatePageSlice(); put('[data-daily-overlay]', renderDialog()) } return true }
  if (name === 'restore-column-settings') { state.preferences = defaultPreferences(); persistPreferences(); state.sort = null; state.page = 1; updatePageSlice(); put('[data-daily-overlay]', renderDialog()); return true }
  if (name === 'close-column-settings') { state.dialog = null; put('[data-daily-overlay]', ''); return true }
  if (name === 'prev-page' || name === 'next-page') { state.page = Math.max(1, state.page + (name === 'next-page' ? 1 : -1)); updatePageSlice(); return true }
  if (name === 'export') { exportRows(); return true }
  if (name === 'columns') { state.dialog = { kind: 'columns' }; put('[data-daily-overlay]', renderDialog()); return true }
  if (name === 'task-detail') { const assignmentId = node.dataset.assignmentId || ''; if (state.view!.rows.some(t => t.task.assignmentId === assignmentId)) { state.dialog = { kind: 'task', assignmentId }; put('[data-daily-overlay]', renderDialog()) } return true }
  if (name === 'promise') { openForm('promise', node.dataset.assignmentId || ''); return true }
  if (name === 'makeup' || name === 'reason' || name === 'amendment') { openForm(name, node.dataset.assignmentId || '', node.dataset.promiseId || ''); return true }
  if (name === 'confirm-owner') { openConfirm(node.dataset.ppicId || ''); return true }
  if (name === 'save') { await saveForm(); return true }
  if (name === 'confirm-save') { await saveConfirm(); return true }
  if (name === 'config') { state.dialog = { kind: 'config', operationId: crypto.randomUUID(), cutoff: state.view!.config.cutoff, timeZone: state.view!.config.timeZone, effectiveFrom: nowBusinessDate(), error: '', dirty: false }; put('[data-daily-overlay]', renderDialog()); return true }
  if (name === 'save-config') { await saveConfig(); return true }
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
      else { state.dialog = null }
    }
  }, true)
  document.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return
    const dialog = document.querySelector<HTMLElement>('[data-daily-overlay] [role="dialog"]')
    if (!dialog) return
    const content = dialog.querySelector<HTMLElement>('section, aside') || dialog
    const items = [...content.querySelectorAll<HTMLElement>('input:not(:disabled), select:not(:disabled), textarea:not(:disabled), button:not(:disabled), a[href]')].filter(el => el.getClientRects().length)
    const first = items[0], last = items.at(-1); if (!first || !last) return
    if (!dialog.contains(document.activeElement) || event.shiftKey && document.activeElement === first || !event.shiftKey && document.activeElement === last) { event.preventDefault(); (event.shiftKey ? last : first).focus() }
  })
  window.setInterval(() => {
    if (!document.querySelector('[data-ppic-daily-page]') || !state.view || state.busy || state.dialog) return
    try { refresh() } catch (error) { state.error = error instanceof Error ? error.message : '回货任务读取失败'; put('[data-daily-feedback]', feedback()) }
  }, 30000)
}

if (typeof document !== 'undefined') {
  let draggedColumn = ''
  document.addEventListener('dragstart', event => { const node = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-ppic-daily-page] [data-standard-list-column-drag]') : null; if (!node) return; draggedColumn = node.dataset.dragSource || ''; event.dataTransfer?.setData('text/plain', draggedColumn); event.stopPropagation() }, true)
  document.addEventListener('dragover', event => { if (event.target instanceof Element && event.target.closest('[data-ppic-daily-page] [data-drop-target]')) { event.preventDefault(); event.stopPropagation() } }, true)
  document.addEventListener('drop', event => {
    const node = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-ppic-daily-page] [data-drop-target]') : null
    if (!node || !draggedColumn || draggedColumn === node.dataset.dropTarget) return
    const prefs = preferences(), order = prefs.order.filter(k => k !== draggedColumn), at = order.indexOf(node.dataset.dropTarget || '')
    if (at < 0) return
    order.splice(at, 0, draggedColumn); prefs.order = order; draggedColumn = ''; persistPreferences(); event.preventDefault(); event.stopPropagation(); updatePageSlice(); put('[data-daily-overlay]', renderDialog())
  }, true)
}
