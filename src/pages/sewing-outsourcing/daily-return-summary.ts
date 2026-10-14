// @page-pattern: list

import { escapeHtml } from '../../utils.ts'
import { renderStandardListFilters, renderStandardListPage, renderStandardListStats } from '../../components/ui/list-page.ts'
import { renderStandardListTable, renderStandardListColumnSettings, type StandardListColumn } from '../../components/ui/list-table.ts'
import { loadListColumnPreferences, saveListColumnPreferences, normalizeListColumnPreferences, sortStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../components/ui/pagination.ts'
import { ensurePpicDailyReturnState, getPpicDailySupervisorView, getCurrentPpicDailyActor,
  PPIC_DAILY_DEMO_MEMBERS, savePpicDailyReturnConfig, type PpicDailySummaryQuery } from '../../data/fcs/ppic-daily-return-records.ts'
import { PPIC_RETURN_REASONS } from '../../data/fcs/ppic-daily-return.ts'
import { renderPostFinishingStorageNotice } from '../process-factory/post-finishing/storage-notice.ts'
import { ppicDailyTime, renderPpicDailyCurrentUser, renderPpicDailyImage, renderPpicDailyImageDialog, updatePpicDailyOverlay } from './daily-return-report.ts'

type Summary = ReturnType<typeof getPpicDailySupervisorView>
type Row = Summary['rows'][number]
type MakeupRow = Summary['todayMakeups'][number]
type Dialog = { kind: 'image'; imageUrl: string; label: string } | { kind: 'config'; operationId: string; cutoff: string; timeZone: string; effectiveFrom: string; error: string; dirty: boolean } | { kind: 'detail'; promiseId: string } | { kind: 'columns' } | { kind: 'makeup-detail'; makeupId: string } | null
const state = { query: {} as PpicDailySummaryQuery, draft: {} as PpicDailySummaryQuery, page: 1, pageSize: 20,
  tab: 'promises' as 'promises' | 'people' | 'makeups', dialog: null as Dialog, view: null as Summary | null, busy: false, error: '', message: '', sort: null as StandardListSortState | null }
const action = (name: string) => `data-ppic-summary-action="${name}"`
const buttonClass = 'h-9 rounded border px-3 text-sm font-semibold disabled:opacity-50'
function load(): void { state.view = getPpicDailySupervisorView(state.query); state.query.date = state.view.date; state.draft.date ||= state.view.date }
function feedback(): string { return `${state.error ? `<p role="alert" class="rounded bg-red-50 p-3 text-sm text-red-700">${escapeHtml(state.error)}</p>` : ''}${state.message ? `<p role="status" class="rounded bg-emerald-50 p-3 text-sm text-emerald-700">${escapeHtml(state.message)}</p>` : ''}` }
function select(field: string, label: string, options: Array<{ value: string; label: string }>): string {
  const value = state.draft[field as keyof PpicDailySummaryQuery] || ''
  return `<label class="text-xs text-slate-600">${label}<select aria-label="${label}" class="mt-1 block h-9 max-w-48 rounded border bg-white px-2 text-sm" data-skip-page-rerender="true" data-ppic-summary-field="${field}"><option value="">全部</option>${options.map(o => `<option value="${escapeHtml(o.value)}"${value === o.value ? ' selected' : ''}>${escapeHtml(o.label)}</option>`).join('')}</select></label>`
}
function filters(): string {
  const factories = [...new Map(state.view!.tasks.map(t => [t.basis.factoryId, { value: t.basis.factoryId, label: t.basis.factoryName }])).values()]
  return renderStandardListFilters({ actionPrefix: 'ppic-summary', fieldsHtml: `<label class="text-xs text-slate-600">业务日期<input aria-label="业务日期" class="mt-1 block h-9 rounded border px-2 text-sm" type="date" data-skip-page-rerender="true" data-ppic-summary-field="date" value="${escapeHtml(state.draft.date || '')}"></label>${select('ppicId', 'PPIC', PPIC_DAILY_DEMO_MEMBERS.filter(p => !p.leader).map(p => ({ value: p.id, label: p.name })))}${select('factoryId', '工厂', factories)}${select('reason', '欠回原因', PPIC_RETURN_REASONS.map(r => ({ value: r, label: r })))}${select('status', '回货状态', ['待履行', '按期兑现', '到期欠回', '逾期已补齐', '待补回', '已补齐', '补回逾期', '已重新安排', '原欠回已解除'].map(r => ({ value: r, label: r })))}<label class="min-w-36 flex-1 text-xs text-slate-600">生产单／任务<input aria-label="生产单／任务查询" class="mt-1 h-9 w-full rounded border px-2 text-sm" data-skip-page-rerender="true" data-ppic-summary-field="keyword" value="${escapeHtml(state.draft.keyword || '')}" placeholder="生产单、任务或承诺号"></label>`, extraActionsHtml: `<button class="${buttonClass}" ${action('export')}>导出全部筛选结果</button>` })
}
const columns: StandardListColumn<Row>[] = [
  { key: 'task', title: '款式／任务／工厂', width: 280, required: true, freezeable: true, render: r => `<div class="flex gap-2">${renderPpicDailyImage(r.basis.imageUrl, `${r.basis.productionOrderNo} ${r.basis.taskNo}`, 'ppic-summary')}<div><b>${escapeHtml(r.basis.taskNo)}</b><p class="mt-1 text-xs">${escapeHtml(r.basis.productionOrderNo)}</p><p class="mt-1 text-xs text-slate-500">${escapeHtml(r.basis.factoryName)}</p></div></div>` },
  { key: 'ppic', title: '填报／到期负责人', width: 150, required: true, render: r => `<b>${escapeHtml(r.promise.actorName)}</b><p class="mt-1 text-xs text-slate-500">到期：${escapeHtml(PPIC_DAILY_DEMO_MEMBERS.find(p => p.id === r.dueOwnerId)?.name || r.promise.actorName)}</p><p class="mt-1 text-xs text-slate-500">当前：${escapeHtml(PPIC_DAILY_DEMO_MEMBERS.find(p => p.id === r.ownerId)?.name || '待核对')}</p>` },
  { key: 'promise', title: '原承诺', width: 190, required: true, render: r => `<b>${r.promise.quantity} 件</b><p class="mt-1 text-xs">${escapeHtml(r.promise.promiseNo)}</p><p class="mt-1 text-xs text-slate-500">${escapeHtml(ppicDailyTime(r.promise.originalDeadlineAt, state.view!.config.timeZone))}</p>` },
  { key: 'actual', title: '实收／准时', width: 120, required: true, render: r => `<b>${r.result.receivedQty}／${r.result.timelyQty} 件</b><p class="mt-1 text-xs">${Math.round(r.result.timelyQty / r.promise.quantity * 100)}% 准时</p>` },
  { key: 'gap', title: '原欠回／当前欠回', width: 160, required: true, render: r => `<b class="${r.result.currentGap && r.result.due ? 'text-red-700' : ''}">${r.result.due ? r.result.originalGap + '／' + r.result.currentGap + ' 件' : '未到期 · 待回 ' + r.result.currentGap + ' 件'}</b><p class="mt-1 text-xs">${escapeHtml(r.result.status)}</p>` },
  { key: 'reason', title: '原因／补回轮次', width: 160, render: r => `<span class="text-xs">${escapeHtml(r.reason || (r.result.due && r.result.originalGap ? '待补充原因' : '—'))}</span><p class="mt-1 text-xs">${r.result.rounds} 轮</p>` },
  { key: 'actions', title: '操作', width: 100, required: true, actionColumn: true, render: r => `<button class="text-blue-700" ${action('detail')} data-promise-id="${escapeHtml(r.promise.promiseId)}">查看明细</button>` },
]
const peopleColumns: StandardListColumn<Summary['people'][number]>[] = [
  { key: 'name', title: 'PPIC', width: 180, required: true, render: r => `<b>${escapeHtml(r.name)}</b>${r.id.startsWith('PPIC-DAILY-MOCK') ? '<p class="mt-1 text-xs text-slate-500">补充演示成员</p>' : ''}` },
  { key: 'status', title: '提交状态', width: 160, required: true, render: r => `<b class="${['未提交', '待重新确认'].includes(r.status) ? 'text-amber-800' : r.status === '逾期补交' ? 'text-red-700' : 'text-emerald-700'}">${escapeHtml(r.status)}</b>` },
  { key: 'time', title: '提交时间', width: 210, required: true, render: r => escapeHtml(r.confirmation ? ppicDailyTime(r.confirmation.submittedAt, state.view!.config.timeZone) : '—') },
  { key: 'tasks', title: '确认任务数', width: 120, render: r => String(r.taskCount) },
  { key: 'none', title: '无安排说明', width: 320, render: r => r.confirmation ? Object.entries(r.confirmation.noArrangementReasons).map(([id, reason]) => `<p class="text-xs">${escapeHtml(state.view!.tasks.find(t => t.task.assignmentId === id)?.basis.taskNo || '历史任务')}：${escapeHtml(reason)}</p>`).join('') || '已有回货安排或当日无任务' : '—' },
]
const makeupColumns: StandardListColumn<MakeupRow>[] = [
  { key: 'task', title: '款式／任务／工厂', width: 280, required: true, render: r => `<div class="flex gap-2">${renderPpicDailyImage(r.basis.imageUrl, `${r.basis.productionOrderNo} ${r.basis.taskNo}`, 'ppic-summary')}<div><b>${escapeHtml(r.basis.taskNo)}</b><p class="mt-1 text-xs">${escapeHtml(r.basis.productionOrderNo)}</p><p class="mt-1 text-xs">${escapeHtml(r.basis.factoryName)}</p></div></div>` },
  { key: 'original', title: '原承诺／填报人', width: 220, required: true, render: r => `<b>${escapeHtml(r.promise.promiseNo)}</b><p class="mt-1 text-xs">${r.promise.quantity} 件 · ${escapeHtml(r.promise.actorName)}</p><p class="mt-1 text-xs text-slate-500">原截止 ${escapeHtml(ppicDailyTime(r.promise.originalDeadlineAt))}</p>` },
  { key: 'arrangement', title: '补回安排', width: 220, required: true, render: r => `<b>第 ${r.makeup.round} 轮 · ${r.makeup.quantity} 件</b><p class="mt-1 text-xs">${escapeHtml(ppicDailyTime(r.makeup.deadlineAt))}</p><p class="mt-1 text-xs text-slate-500">${escapeHtml(PPIC_DAILY_DEMO_MEMBERS.find(p => p.id === r.makeup.actorId)?.name || '历史填报人')} · ${escapeHtml(ppicDailyTime(r.makeup.createdAt))}</p>` },
  { key: 'received', title: '已回／待回', width: 150, required: true, render: r => `<b>${r.result.receivedQty}／${r.makeup.active ? r.result.currentGap : '已转下轮'} 件</b><p class="mt-1 text-xs ${r.result.status === '补回逾期' ? 'text-red-700' : ''}">${escapeHtml(r.result.status)}${r.result.releasedQty ? ' · 因正式实收更新解除 ' + r.result.releasedQty + ' 件' : ''}</p>` },
  { key: 'reason', title: '欠回原因', width: 190, render: r => `<b class="text-xs">${escapeHtml(r.makeup.reason)}</b><p class="mt-1 text-xs text-slate-500">${escapeHtml(r.makeup.detail || '—')}</p>` },
  { key: 'actions', title: '操作', width: 100, required: true, actionColumn: true, render: r => `<button class="text-blue-700" ${action('makeup-detail')} data-makeup-id="${escapeHtml(r.makeup.makeupId)}">查看补回</button>` },
]
function stats(): string {
  const s = state.view!.stats
  return renderStandardListStats([{ label: '已提交／人员', value: `${s.submitted}／${s.members}` }, { label: '原承诺', value: `${s.originalQty} 件` }, { label: '正式实收', value: `${s.actualReceivedQty} 件` }, { label: '原到期欠回', value: `${s.originalGap} 件` }, { label: '当前欠回', value: `${s.currentGap} 件` }, { label: '原承诺延期轮次', value: s.makeupRounds }, { label: '当日补回安排', value: s.todayMakeupPlans }, { label: '当日补回待回', value: `${s.todayMakeupPendingQty} 件` }, { label: '当日补回实收', value: `${s.actualMakeupReceivedQty} 件` }, { label: '加权准时率', value: s.timelyRate === null ? '无承诺' : `${(s.timelyRate * 100).toFixed(1)}%` }], { compact: true })
}
function tabs(): string { return `<div class="flex flex-wrap gap-2"><button class="${buttonClass} ${state.tab === 'promises' ? 'bg-blue-600 text-white' : ''}" ${action('tab-promises')}>承诺与欠回（${state.view!.rows.length}）</button><button class="${buttonClass} ${state.tab === 'makeups' ? 'bg-blue-600 text-white' : ''}" ${action('tab-makeups')}>当日补回（${state.view!.todayMakeups.length}）</button><button class="${buttonClass} ${state.tab === 'people' ? 'bg-blue-600 text-white' : ''}" ${action('tab-people')}>人员提交（${state.view!.people.length}）</button></div>` }
// 每个视图仅保存列显示、列顺序、冻结和每页条数；每键最多 4096 字符，默认 20 条。
const preferenceValues: Partial<Record<typeof state.tab, StandardListColumnPreferences>> = {}
const preferenceStorage = {
  getItem(key: string) { const value = window.localStorage.getItem(key); return value && value.length > 4096 ? null : value },
  setItem(key: string, value: string) { if (value.length <= 4096) window.localStorage.setItem(key, value) },
}
function preferenceKey(): string { return `higood.ppic-daily-summary.columns.${state.tab}.v1` }
function activeColumns(): StandardListColumn<unknown>[] { return (state.tab === 'promises' ? columns : state.tab === 'makeups' ? makeupColumns : peopleColumns) as StandardListColumn<unknown>[] }
function defaultPreferences(): StandardListColumnPreferences { const cols = activeColumns(); return normalizeListColumnPreferences(cols, { order: cols.map(c => c.key), visibleKeys: cols.map(c => c.key), frozenKeys: state.tab === 'people' ? ['name'] : ['task'], pageSize: 20 }, [20, 50]) }
function preferences(): StandardListColumnPreferences { return preferenceValues[state.tab] ||= loadListColumnPreferences(preferenceStorage, preferenceKey(), activeColumns(), defaultPreferences(), [20, 50]) }
function persistPreferences(): void { preferenceValues[state.tab] = normalizeListColumnPreferences(activeColumns(), preferences(), [20, 50]); saveListColumnPreferences(preferenceStorage, preferenceKey(), preferences()) }
for (const c of columns) if (!c.actionColumn) {
  c.sortable = true; c.freezeable = true
  c.sortValue = r => ({ task: r.basis.taskNo, ppic: r.promise.actorName, promise: r.promise.quantity, actual: r.result.receivedQty, gap: r.result.currentGap, reason: r.reason })[c.key]
}
for (const c of peopleColumns) { c.sortable = true; c.freezeable = true; c.sortValue = r => ({ name: r.name, status: r.status, time: r.confirmation?.submittedAt || '', tasks: r.taskCount, none: Object.values(r.confirmation?.noArrangementReasons || {}).join('；') })[c.key] }
for (const c of makeupColumns) if (!c.actionColumn) { c.sortable = true; c.freezeable = true; c.sortValue = r => ({ task: r.basis.taskNo, original: r.promise.promiseNo, arrangement: r.makeup.deadlineAt, received: r.result.receivedQty, reason: r.makeup.reason })[c.key] }
function table(): string {
  const prefs = preferences(); state.pageSize = prefs.pageSize
  const rows = state.tab === 'promises' ? state.view!.rows : state.tab === 'makeups' ? state.view!.todayMakeups : state.view!.people
  const pages = Math.max(1, Math.ceil(rows.length / state.pageSize)); state.page = Math.min(Math.max(1, state.page), pages)
  const from = (state.page - 1) * state.pageSize
  if (state.tab === 'promises') return renderStandardListTable({ columns, rows: sortStandardListRows(state.view!.rows, state.sort, (r, key) => columns.find(c => c.key === key)?.sortValue?.(r)).slice(from, from + state.pageSize), preferences: prefs, sort: state.sort, eventPrefix: 'ppic-summary', skipPageRerender: true, emptyText: '暂无符合条件的原承诺；补回不重复计入原承诺' })
  if (state.tab === 'makeups') return renderStandardListTable({ columns: makeupColumns, rows: sortStandardListRows(state.view!.todayMakeups, state.sort, (r, key) => makeupColumns.find(c => c.key === key)?.sortValue?.(r)).slice(from, from + state.pageSize), preferences: prefs, sort: state.sort, eventPrefix: 'ppic-summary', skipPageRerender: true, emptyText: '当日没有补回安排' })
  return renderStandardListTable({ columns: peopleColumns, rows: sortStandardListRows(state.view!.people, state.sort, (r, key) => peopleColumns.find(c => c.key === key)?.sortValue?.(r)).slice(from, from + state.pageSize), preferences: prefs, sort: state.sort, eventPrefix: 'ppic-summary', skipPageRerender: true, emptyText: '暂无符合条件的人员' })
}
function pagination(): string {
  const rows = state.tab === 'promises' ? state.view!.rows : state.tab === 'makeups' ? state.view!.todayMakeups : state.view!.people, from = (state.page - 1) * state.pageSize
  return renderTablePagination({ total: rows.length, from: rows.length ? from + 1 : 0, to: Math.min(from + state.pageSize, rows.length), currentPage: state.page, totalPages: Math.max(1, Math.ceil(rows.length / state.pageSize)), pageSize: state.pageSize, actionPrefix: 'ppic-summary', fieldPrefix: 'ppic-summary', pageSizeOptions: [20, 50], skipPageRerender: true })
}
function dialog(): string {
  const d = state.dialog; if (!d) return ''
  if (d.kind === 'columns') return renderStandardListColumnSettings({ title: '每日回货汇总列设置', columns: activeColumns(), preferences: preferences(), eventPrefix: 'ppic-summary', maxFrozenWidth: 520, skipPageRerender: true }).replace('<div class="fixed inset-0 z-50">', '<div class="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="每日回货汇总列设置">')
  if (d.kind === 'image') return renderPpicDailyImageDialog(d.imageUrl, d.label, 'ppic-summary')
  if (d.kind === 'makeup-detail') {
    const r = state.view!.todayMakeups.find(r => r.makeup.makeupId === d.makeupId); if (!r) return ''
    return `<div class="fixed inset-0 z-50 overflow-auto bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-label="补回安排明细"><button class="fixed inset-0" ${action('close')} aria-label="关闭"></button><section class="relative mx-auto my-8 max-w-xl rounded bg-white p-5"><header class="flex justify-between gap-3"><h2 class="text-lg font-semibold">第 ${r.makeup.round} 轮补回</h2><button class="${buttonClass}" ${action('close')}>关闭</button></header><p class="mt-3 text-sm">${escapeHtml(r.basis.productionOrderNo)} · ${escapeHtml(r.basis.taskNo)} · ${escapeHtml(r.basis.factoryName)}</p><p class="mt-3 rounded bg-slate-50 p-3 text-sm">${escapeHtml(r.promise.promiseNo)} · 原承诺 ${r.promise.quantity} 件<br>原截止 ${escapeHtml(ppicDailyTime(r.promise.originalDeadlineAt))}</p><p class="mt-3 text-sm">本次补回 ${r.makeup.quantity} 件 · 截止 ${escapeHtml(ppicDailyTime(r.makeup.deadlineAt))}<br>已回 ${r.result.receivedQty} 件 · ${r.makeup.active ? '当前待回 ' + r.result.currentGap + ' 件' : '剩余已重新安排'} · ${escapeHtml(r.result.status)}</p><p class="mt-3 text-sm">${escapeHtml(r.makeup.reason)}${r.makeup.detail ? '：' + escapeHtml(r.makeup.detail) : ''}</p><p class="mt-3 text-xs text-slate-500">补回履行原欠回，不重复计入原承诺及准时率分母。</p></section></div>`
  }
  if (d.kind === 'detail') {
    const r = state.view!.rows.find(r => r.promise.promiseId === d.promiseId); if (!r) return ''
    return `<div class="fixed inset-0 z-50 overflow-auto bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-label="回货承诺明细"><button class="fixed inset-0" ${action('close')} aria-label="关闭"></button><section class="relative mx-auto my-8 max-w-2xl rounded bg-white p-5"><header class="flex justify-between gap-3"><h2 class="text-lg font-semibold">${escapeHtml(r.promise.promiseNo)}</h2><button class="${buttonClass}" ${action('close')}>关闭</button></header><p class="mt-3 text-sm">${escapeHtml(r.basis.productionOrderNo)} · ${escapeHtml(r.basis.taskNo)} · ${escapeHtml(r.basis.factoryName)} · ${escapeHtml(r.promise.actorName)}</p><p class="mt-3 rounded bg-slate-50 p-3 text-sm">原承诺 ${r.promise.quantity} 件 · 原截止 ${escapeHtml(ppicDailyTime(r.promise.originalDeadlineAt))}<br>准时 ${r.result.timelyQty} 件 · 实收 ${r.result.receivedQty} 件 · ${r.result.due ? '当前欠回' : '待回'} ${r.result.currentGap} 件</p><h3 class="mt-4 font-semibold">安排时间修改</h3>${r.promise.revisions.map(v => `<p class="mt-2 text-sm">${escapeHtml(PPIC_DAILY_DEMO_MEMBERS.find(p => p.id === v.actorId)?.name || '历史操作人')} · ${escapeHtml(ppicDailyTime(v.at))} → ${escapeHtml(ppicDailyTime(v.deadlineAt))} · ${escapeHtml(v.reason)}</p>`).join('') || '<p class="mt-2 text-sm text-slate-500">没有修改记录</p>'}<h3 class="mt-4 font-semibold">补回链</h3>${r.result.makeups.map(m => `<article class="mt-2 rounded border p-3 text-sm">第 ${m.round} 轮 · ${m.quantity} 件 · ${escapeHtml(ppicDailyTime(m.deadlineAt))}<p class="mt-1">${escapeHtml(m.reason)}${m.detail ? '：' + escapeHtml(m.detail) : ''} · ${m.active ? '当前安排' : '已重新安排'}</p></article>`).join('') || '<p class="mt-2 text-sm text-slate-500">没有补回安排</p>'}<p class="mt-4 text-sm">原因：${escapeHtml(r.reason || '—')}</p><a class="mt-4 inline-block text-sm text-blue-700" href="/fcs/sewing-outsourcing/returns" data-nav="/fcs/sewing-outsourcing/returns">打开任务回货台账</a></section></div>`
  }
  return `<div class="fixed inset-0 z-50 overflow-auto bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-label="每日提交截止设置"><button class="fixed inset-0" ${action('close')} aria-label="关闭"></button><section class="relative mx-auto my-8 max-w-md rounded bg-white p-5"><header class="flex justify-between gap-3"><h2 class="text-lg font-semibold">每日提交截止设置</h2><button class="${buttonClass}" ${action('close')}${state.busy ? ' disabled' : ''}>关闭</button></header><p class="mt-2 text-xs text-slate-500">新设置按生效日使用，已提交记录保留当时截止依据。</p><label class="mt-4 block text-sm">业务时区<input aria-label="业务时区" class="mt-1 h-10 w-full rounded border bg-slate-50 px-3" readonly value="Asia/Jakarta"></label><label class="mt-4 block text-sm">每日截止时间<input aria-label="每日截止时间" class="mt-1 h-10 w-full rounded border px-3" type="time" data-skip-page-rerender="true" data-ppic-summary-dialog-field="cutoff" value="${escapeHtml(d.cutoff)}"></label><label class="mt-4 block text-sm">生效日期<input aria-label="生效日期" class="mt-1 h-10 w-full rounded border px-3" type="date" data-skip-page-rerender="true" data-ppic-summary-dialog-field="effectiveFrom" value="${escapeHtml(d.effectiveFrom)}"></label>${d.error ? `<p role="alert" class="mt-3 rounded bg-red-50 p-3 text-sm text-red-700">${escapeHtml(d.error)}；尚未保存，可重试。</p>` : ''}<button class="mt-5 w-full ${buttonClass} bg-blue-600 text-white" ${action('save-config')}${state.busy ? ' disabled' : ''}>${state.busy ? '正在保存' : '保存截止设置'}</button></section></div>`
}
function put(selector: string, html: string): void { if (selector === '[data-summary-overlay]') { updatePpicDailyOverlay(selector, html, state.busy); return }; const node = document.querySelector<HTMLElement>(selector); if (node) node.innerHTML = html }
function refresh(withFilters = false): void { load(); put('[data-summary-context]', `${escapeHtml(state.view!.date)} · ${escapeHtml(state.view!.config.timeZone)} ${escapeHtml(state.view!.config.cutoff)} 截止 · 30 人演示名单`); put('[data-summary-feedback]', feedback()); put('[data-summary-stats]', stats()); put('[data-summary-tabs]', tabs()); put('[data-summary-table]', table()); put('[data-summary-pagination]', pagination()); put('[data-summary-overlay]', dialog()); if (withFilters) put('[data-summary-filters]', filters()) }
export async function renderPpicDailyReturnSummaryPage(): Promise<string> {
  try {
    await ensurePpicDailyReturnState()
    if (!getCurrentPpicDailyActor().leader) return `${renderPostFinishingStorageNotice()}<main class="space-y-4 p-4" data-ppic-summary-page data-skip-page-rerender="true"><h1 class="text-xl font-semibold">每日回货汇总</h1><section class="rounded border p-3">${renderPpicDailyCurrentUser()}</section><p class="rounded bg-amber-50 p-3 text-sm text-amber-800">当前身份只能查看本人填报。团队汇总由组长查看。</p><a class="text-blue-700" href="/fcs/sewing-outsourcing/daily-return-report" data-nav="/fcs/sewing-outsourcing/daily-return-report">打开本人每日填报</a></main>`
    load()
    return `${renderPostFinishingStorageNotice()}<main data-ppic-summary-page data-skip-page-rerender="true">${renderStandardListPage({ title: '每日回货汇总', primaryActionsHtml: `<a class="text-sm text-blue-700" href="/fcs/sewing-outsourcing/daily-return-report" data-nav="/fcs/sewing-outsourcing/daily-return-report">本人填报</a><button class="${buttonClass}" ${action('config')}>截止设置</button>`, feedbackHtml: `<div class="flex flex-wrap items-center gap-3 rounded border bg-white p-3">${renderPpicDailyCurrentUser()}<span data-summary-context class="text-xs text-slate-500">${escapeHtml(state.view!.date)} · ${escapeHtml(state.view!.config.timeZone)} ${escapeHtml(state.view!.config.cutoff)} 截止 · 30 人演示名单</span></div><div data-summary-feedback>${feedback()}</div>`, filtersHtml: `<div data-summary-filters>${filters()}</div>`, statsHtml: `<div data-summary-stats>${stats()}</div>`, listTitle: '每日回货记录', listActionsHtml: `<div data-summary-tabs>${tabs()}</div><button class="${buttonClass}" ${action('columns')}>列设置</button>`, tableHtml: `<div data-summary-table>${table()}</div>`, paginationHtml: `<div data-summary-pagination>${pagination()}</div>`, overlaysHtml: `<div data-summary-overlay>${dialog()}</div>` })}</main>`
  } catch (error) { return `${renderPostFinishingStorageNotice()}<main class="space-y-3 p-4" data-ppic-summary-page data-skip-page-rerender="true"><h1 class="text-xl font-semibold">每日回货汇总</h1><p role="alert" class="rounded bg-red-50 p-3 text-sm text-red-700">${escapeHtml(error instanceof Error ? error.message : '汇总读取失败')}。未读到的记录不会作为空记录保存。</p><button class="${buttonClass}" ${action('retry-load')}>重新读取</button></main>` }
}
export function closePpicDailySummaryDialog(): boolean { if (!state.dialog || state.busy) return false; if (state.dialog.kind === 'config' && state.dialog.dirty && !window.confirm('截止设置尚未保存，关闭将丢失输入。继续关闭？')) return true; state.dialog = null; put('[data-summary-overlay]', ''); return true }
function exportRows(): void {
  const view = state.view!, cell = (value: unknown) => { const text = String(value ?? ''); return '"' + (typeof value === 'string' && /^[=+@\-\t\r]/.test(text) ? "'" + text : text).replaceAll('"', '""') + '"' }
  const rows = state.tab === 'makeups' ? [['生产单', '任务', '工厂', '原承诺号', '原承诺件数', '原截止', '补回轮次', '补回件数', '补回截止', '已回件数', '当前待回件数', '状态', '原因', '具体情况'], ...view.todayMakeups.map(r => [r.basis.productionOrderNo, r.basis.taskNo, r.basis.factoryName, r.promise.promiseNo, r.promise.quantity, ppicDailyTime(r.promise.originalDeadlineAt), r.makeup.round, r.makeup.quantity, ppicDailyTime(r.makeup.deadlineAt), r.result.receivedQty, r.makeup.active ? r.result.currentGap : '', r.result.status, r.makeup.reason, r.makeup.detail])] : state.tab === 'people' ? [['PPIC', '提交状态', '提交时间', '任务数', '无安排原因'], ...view.people.map(p => [p.name, p.status, p.confirmation ? ppicDailyTime(p.confirmation.submittedAt) : '', p.taskCount, Object.values(p.confirmation?.noArrangementReasons || {}).join('；')])]
    : [['生产单', '任务', '工厂', 'PPIC', '承诺号', '原承诺件数', '原截止', '实收件数', '准时件数', '原欠回件数', '当前欠回件数', '状态', '原因', '补回轮次'], ...view.rows.map(r => [r.basis.productionOrderNo, r.basis.taskNo, r.basis.factoryName, r.promise.actorName, r.promise.promiseNo, r.promise.quantity, ppicDailyTime(r.promise.originalDeadlineAt), r.result.receivedQty, r.result.timelyQty, r.result.due ? r.result.originalGap : '', r.result.currentGap, r.result.status, r.reason, r.result.rounds])]
  if (rows.length === 1) { state.error = '当前筛选没有可导出的记录。'; put('[data-summary-feedback]', feedback()); return }
  const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a'); link.href = url; link.download = `PPIC每日回货-${view.date}-${state.tab === 'people' ? '人员提交' : state.tab === 'makeups' ? '补回明细' : '承诺明细'}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export async function handlePpicDailyReturnSummaryEvent(target: HTMLElement, event?: Event): Promise<boolean> {
  const configField = target.closest<HTMLInputElement | HTMLSelectElement>('[data-ppic-summary-dialog-field]')
  if (configField && state.dialog?.kind === 'config') { const field = configField.dataset.ppicSummaryDialogField as 'cutoff' | 'timeZone' | 'effectiveFrom'; state.dialog[field] = configField.value; state.dialog.dirty = true; return true }
  const field = target.closest<HTMLInputElement | HTMLSelectElement>('[data-ppic-summary-field]')
  if (field) {
    const key = field.dataset.ppicSummaryField
    if (key === 'pageSize') { if (event?.type === 'change') { const prefs = preferences(); prefs.pageSize = [20, 50].includes(Number(field.value)) ? Number(field.value) : 20; persistPreferences(); state.pageSize = prefs.pageSize; state.page = 1; put('[data-summary-table]', table()); put('[data-summary-pagination]', pagination()) } return true }
    if (['date', 'ppicId', 'factoryId', 'keyword', 'reason', 'status'].includes(key || '')) { state.draft[key as keyof PpicDailySummaryQuery] = field.value; return true }
    return false
  }
  const node = target.closest<HTMLElement>('[data-ppic-summary-action]'); if (!node || event && event.type !== 'click') return false
  const name = node.dataset.ppicSummaryAction
  if (name === 'retry-load') { const root = document.querySelector<HTMLElement>('[data-ppic-summary-page]'); if (root) root.outerHTML = await renderPpicDailyReturnSummaryPage(); return true }
  if (name === 'close' || name === 'close-column-settings') { closePpicDailySummaryDialog(); return true }
  if (state.busy || !getCurrentPpicDailyActor().leader) return true
  if (name === 'sort-column') { const key = node.dataset.columnKey || ''; state.sort = state.sort?.key !== key ? { key, direction: 'asc' } : state.sort.direction === 'asc' ? { key, direction: 'desc' } : null; state.page = 1; put('[data-summary-table]', table()); put('[data-summary-pagination]', pagination()); return true }
  if (name === 'toggle-column-visibility' || name === 'toggle-column-freeze') { const key = node.dataset.ppicSummaryColumnKey || ''; const col = activeColumns().find(c => c.key === key); if (col && !col.actionColumn) { const prefs = preferences(), checked = node instanceof HTMLInputElement && node.checked; if (name === 'toggle-column-visibility' && !col.required) prefs.visibleKeys = checked ? [...new Set([...prefs.visibleKeys, key])] : prefs.visibleKeys.filter(k => k !== key); if (name === 'toggle-column-freeze' && col.freezeable) prefs.frozenKeys = checked ? [...new Set([...prefs.frozenKeys, key])] : prefs.frozenKeys.filter(k => k !== key); persistPreferences(); put('[data-summary-table]', table()); put('[data-summary-overlay]', dialog()) } return true }
  if (name === 'restore-column-settings') { preferenceValues[state.tab] = defaultPreferences(); persistPreferences(); state.sort = null; state.page = 1; put('[data-summary-table]', table()); put('[data-summary-pagination]', pagination()); put('[data-summary-overlay]', dialog()); return true }
  if (name === 'query' || name === 'reset') { state.query = name === 'reset' ? {} : { ...state.draft }; if (name === 'reset') state.draft = {}; state.page = 1; refresh(name === 'reset'); return true }
  if (name === 'tab-promises' || name === 'tab-people' || name === 'tab-makeups') { state.tab = name === 'tab-people' ? 'people' : name === 'tab-makeups' ? 'makeups' : 'promises'; state.sort = null; state.page = 1; put('[data-summary-tabs]', tabs()); put('[data-summary-table]', table()); put('[data-summary-pagination]', pagination()); return true }
  if (name === 'prev-page' || name === 'next-page') { state.page = Math.max(1, state.page + (name === 'next-page' ? 1 : -1)); put('[data-summary-table]', table()); put('[data-summary-pagination]', pagination()); return true }
  if (name === 'export') { exportRows(); return true }
  if (name === 'columns') state.dialog = { kind: 'columns' }
  else if (name === 'image') state.dialog = { kind: 'image', imageUrl: node.dataset.imageUrl || '', label: node.dataset.imageLabel || '' }
  else if (name === 'makeup-detail') state.dialog = { kind: 'makeup-detail', makeupId: node.dataset.makeupId || '' }
  else if (name === 'detail') state.dialog = { kind: 'detail', promiseId: node.dataset.promiseId || '' }
  else if (name === 'config') state.dialog = { kind: 'config', operationId: crypto.randomUUID(), cutoff: state.view!.config.cutoff, timeZone: state.view!.config.timeZone, effectiveFrom: state.view!.date, error: '', dirty: false }
  else if (name === 'save-config' && state.dialog?.kind === 'config') {
    const d = state.dialog; state.busy = true; d.error = ''; put('[data-summary-overlay]', dialog())
    try { await savePpicDailyReturnConfig({ operationId: d.operationId, cutoff: d.cutoff, timeZone: d.timeZone, effectiveFrom: d.effectiveFrom }); state.dialog = null; state.message = '已保存每日截止设置。历史提交保留原配置。'; state.error = ''; state.busy = false; refresh() }
    catch (error) { state.busy = false; d.error = error instanceof Error ? error.message : '截止设置未保存'; put('[data-summary-overlay]', dialog()) }
    return true
  } else return false
  put('[data-summary-overlay]', dialog()); return true
}

if (typeof window !== 'undefined') window.setInterval(() => {
  if (!document.querySelector('[data-ppic-summary-page]') || !state.view || state.busy || state.dialog || !getCurrentPpicDailyActor().leader) return
  try { refresh() }
  catch (error) { state.error = error instanceof Error ? error.message : '每日汇总读取失败'; put('[data-summary-feedback]', feedback()) }
}, 30000)

if (typeof document !== 'undefined') {
  let draggedColumn = ''
  document.addEventListener('dragstart', event => { const node = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-ppic-summary-page] [data-standard-list-column-drag]') : null; if (!node) return; draggedColumn = node.dataset.dragSource || ''; event.dataTransfer?.setData('text/plain', draggedColumn); event.stopPropagation() }, true)
  document.addEventListener('dragover', event => { if (event.target instanceof Element && event.target.closest('[data-ppic-summary-page] [data-drop-target]')) { event.preventDefault(); event.stopPropagation() } }, true)
  document.addEventListener('drop', event => {
    const node = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-ppic-summary-page] [data-drop-target]') : null
    if (!node || !draggedColumn || draggedColumn === node.dataset.dropTarget) return
    const prefs = preferences(), order = prefs.order.filter(k => k !== draggedColumn), at = order.indexOf(node.dataset.dropTarget || '')
    if (at < 0) return
    order.splice(at, 0, draggedColumn); prefs.order = order; draggedColumn = ''; persistPreferences(); event.preventDefault(); event.stopPropagation(); put('[data-summary-table]', table()); put('[data-summary-overlay]', dialog())
  }, true)
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', event => { if (document.querySelector('[data-ppic-summary-page]') && state.dialog?.kind === 'config' && state.dialog.dirty) { event.preventDefault(); event.returnValue = '' } })
  document.addEventListener('click', event => { const target = event.target instanceof Element ? event.target : null; if (document.querySelector('[data-ppic-summary-page]') && state.dialog?.kind === 'config' && state.dialog.dirty && target?.closest('a[href], a[data-nav]') && !window.confirm('截止设置尚未保存，离开将丢失输入。继续离开？')) { event.preventDefault(); event.stopImmediatePropagation() } }, true)
}
