// @page-pattern: dashboard

import { escapeHtml } from '../../utils.ts'
import { renderStandardListFilters, renderStandardListStats } from '../../components/ui/list-page.ts'
import { ensurePpicDailyReturnState, getPpicDailyStatisticsView, type PpicDailyStatisticsDay, type PpicDailyStatisticsRow } from '../../data/fcs/ppic-daily-return-records.ts'
import { ppicBusinessDate, ppicDailyTime } from '../../data/fcs/ppic-daily-return.ts'
import { renderPostFinishingStorageNotice } from '../process-factory/post-finishing/storage-notice.ts'

type Statistics = ReturnType<typeof getPpicDailyStatisticsView>
const state = { date: '', days: 7, draftDate: '', draftDays: 7, view: null as Statistics | null, error: '', busy: false }
const action = (name: string) => `data-ppic-stat-action="${name}"`
const buttonClass = 'h-9 rounded border px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50'
function loadView(): void {
  state.view = getPpicDailyStatisticsView({ date: state.date || undefined, days: state.days })
  state.date = state.view.date
  state.draftDate ||= state.view.date
}
function feedback(): string {
  return state.error ? `<p role="alert" class="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">${escapeHtml(state.error)}</p>` : ''
}
function contextLine(): string {
  return `${escapeHtml(state.view!.date)} · 近${state.view!.days}天 · 按当前任务口径`
}
function filters(): string {
  const options = [7, 14, 30].map(days => `<option value="${days}"${Number(state.draftDays) === days ? ' selected' : ''}>近${days}天</option>`).join('')
  return renderStandardListFilters({
    actionPrefix: 'ppic-stat',
    fieldsHtml: `<label class="text-xs text-slate-600">业务日期<input aria-label="业务日期" class="mt-1 block h-9 rounded border px-2 text-sm" type="date" data-skip-page-rerender="true" data-ppic-stat-field="date" value="${escapeHtml(state.draftDate || '')}"></label><label class="text-xs text-slate-600">统计周期<select aria-label="统计周期" class="mt-1 block h-9 rounded border bg-white px-2 text-sm" data-skip-page-rerender="true" data-ppic-stat-field="days">${options}</select></label>`,
  })
}
function percent(value: number, total: number): number {
  return total > 0 ? Math.max(0, Math.min(100, Math.round(value / total * 100))) : 0
}
function rateLabel(value: number | null): string { return value === null ? '—' : `${Math.round(value * 100)}%` }
function statusTone(status: string): string {
  if (['未提交', '未提交已超时', '待重新提交', '待重新确认', '待提交'].includes(status)) return 'text-amber-800'
  if (status === '逾期补交') return 'text-red-700'
  if (status === '已提交') return 'text-emerald-700'
  return 'text-slate-500'
}
function statCards(): string {
  const s = state.view!.stats
  return renderStandardListStats([
    { label: '应填报任务', value: s.requiredTasks },
    { label: '应填报 PPIC', value: s.requiredPpics },
    { label: '已填报 PPIC', value: s.filledPpics },
    { label: '未填报 PPIC', value: s.unfilledPpics },
    { label: '已覆盖任务', value: s.coveredTasks },
    { label: '已安排任务', value: s.arrangedTasks },
  ], { compact: true })
}
function trendChart(): string {
  const view = state.view!, days = view.daily
  const max = Math.max(1, ...days.map(day => Math.max(day.requiredTasks, day.coveredTasks)))
  const labelEvery = Math.max(1, Math.ceil(days.length / 7))
  return `<section class="rounded-lg border bg-card p-4" data-stat-trend-card>
    <div class="flex flex-wrap items-center justify-between gap-2"><h2 class="font-semibold">近${view.days}天填报趋势</h2><div class="flex gap-3 text-xs text-slate-600"><span><i class="mr-1 inline-block h-2 w-2 rounded-sm bg-slate-300"></i>应填报任务</span><span><i class="mr-1 inline-block h-2 w-2 rounded-sm bg-blue-600"></i>已覆盖任务</span></div></div>
    <div class="mt-4 flex h-48 items-end gap-1" role="img" aria-label="近${view.days}天应填报与已覆盖任务趋势">
      ${days.map((day, index) => `<div class="flex min-w-0 flex-1 flex-col items-center justify-end gap-1" data-stat-day="${day.date}">
        <div class="flex h-40 w-full items-end justify-center gap-0.5">
          <div class="w-1/3 rounded-t bg-slate-300" style="height:${percent(day.requiredTasks, max)}%" title="${day.date} 应填报 ${day.requiredTasks} 件"></div>
          <div class="w-1/3 rounded-t bg-blue-600" style="height:${percent(day.coveredTasks, max)}%" title="${day.date} 已覆盖 ${day.coveredTasks} 件"></div>
        </div>
        <span class="text-[10px] text-slate-500">${index % labelEvery === 0 || index === days.length - 1 ? day.date.slice(5) : ''}</span>
        <span class="text-[10px] text-slate-500">${day.filledPpics}/${day.requiredPpics}</span>
      </div>`).join('')}
    </div>
    <p class="mt-2 text-xs text-slate-500">柱下：已填报／应填报 PPIC</p>
    ${view.stats.filledPpics ? '' : '<p class="mt-1 text-xs text-slate-500">暂无已填报记录，完成日确认后显示覆盖趋势。</p>'}
  </section>`
}
function rateCard(): string {
  const s = state.view!.stats
  const rate = percent(s.filledPpics, s.requiredPpics)
  const taskRate = percent(s.coveredTasks, s.requiredTasks)
  return `<section class="rounded-lg border bg-card p-4" data-stat-rate-card>
    <h2 class="font-semibold">今日填报进度</h2>
    <div class="mt-4 flex items-center gap-5">
      <div class="relative h-28 w-28 shrink-0 rounded-full" style="background: conic-gradient(#2563eb ${rate}%, #e2e8f0 0)" role="img" aria-label="PPIC 日提交率 ${rate}%"><div class="absolute inset-3 flex flex-col items-center justify-center rounded-full bg-white"><b class="text-2xl">${rateLabel(s.confirmationRate)}</b><span class="text-xs text-slate-500">PPIC 提交</span></div></div>
      <div class="space-y-2 text-sm"><p>已填报 <b>${s.filledPpics}</b> / ${s.requiredPpics} 位 PPIC</p><p>已覆盖 <b>${s.coveredTasks}</b> / ${s.requiredTasks} 个任务</p><p>任务覆盖率 <b>${taskRate}%</b></p></div>
    </div>
  </section>`
}
function ppicChart(): string {
  const rows = state.view!.rows
  return `<section class="rounded-lg border bg-card p-4" data-stat-ppic-chart-card>
    <h2 class="font-semibold">PPIC 填报情况</h2>
    ${rows.length ? `<div class="mt-4 space-y-4">${rows.map(row => `<div data-stat-ppic-row="${escapeHtml(row.ownerId)}"><div class="flex flex-wrap items-center justify-between gap-2 text-sm"><b>${escapeHtml(row.ownerName)}</b><span class="text-xs ${statusTone(row.submissionStatus)}">${escapeHtml(row.submissionStatus)} · 已覆盖 ${row.coveredTasks}/${row.requiredTasks} · 已安排 ${row.arrangedTasks}</span></div><div class="mt-1 h-2 rounded bg-slate-100"><div class="h-2 rounded bg-blue-600" style="width:${percent(row.coveredTasks, row.requiredTasks)}%"></div></div></div>`).join('')}</div>` : '<p class="mt-4 text-sm text-slate-500">当前没有需要填报的任务。</p>'}
  </section>`
}
function ppicTable(): string {
  const view = state.view!, rows = view.rows
  return `<section class="overflow-hidden rounded-lg border bg-card" data-stat-ppic-table-card>
    <header class="border-b px-4 py-3"><h2 class="font-semibold">PPIC 明细</h2></header>
    <div class="overflow-x-auto"><table class="w-full text-left text-sm"><thead class="bg-muted/50"><tr><th class="p-3">PPIC</th><th class="p-3">应填报</th><th class="p-3">已安排</th><th class="p-3">已覆盖</th><th class="p-3">状态</th><th class="p-3">提交时间</th><th class="p-3">今日承诺</th><th class="p-3">补回</th></tr></thead><tbody>${rows.map(row => `<tr class="border-t" data-stat-ppic-table-row="${escapeHtml(row.ownerId)}"><td class="p-3"><b>${escapeHtml(row.ownerName)}</b></td><td class="p-3">${row.requiredTasks}</td><td class="p-3">${row.arrangedTasks}</td><td class="p-3">${row.coveredTasks}</td><td class="p-3 ${statusTone(row.submissionStatus)}">${escapeHtml(row.submissionStatus)}</td><td class="p-3">${row.submittedAt ? escapeHtml(ppicDailyTime(row.submittedAt, view.config.timeZone)) : '—'}</td><td class="p-3">${row.todayPromiseCount ? `${row.todayPromiseCount} 笔 · ${row.todayPromiseQty} 件` : '—'}</td><td class="p-3">${row.todayMakeupCount || '—'}</td></tr>`).join('') || '<tr><td class="p-4 text-center text-sm text-slate-500" colspan="8">当前没有需要填报的任务</td></tr>'}</tbody></table></div>
  </section>`
}
function dailyTable(): string {
  const view = state.view!, days = [...view.daily].reverse()
  return `<section class="overflow-hidden rounded-lg border bg-card" data-stat-daily-table-card>
    <header class="border-b px-4 py-3"><h2 class="font-semibold">每日明细</h2></header>
    <div class="max-h-80 overflow-auto"><table class="w-full text-left text-sm"><thead class="bg-muted/50"><tr><th class="p-3">日期</th><th class="p-3">应填报任务</th><th class="p-3">已覆盖任务</th><th class="p-3">已填报 PPIC</th><th class="p-3">提交率</th></tr></thead><tbody>${days.map(day => `<tr class="border-t" data-stat-daily-row="${day.date}"><td class="p-3">${day.date}</td><td class="p-3">${day.requiredTasks}</td><td class="p-3">${day.coveredTasks}</td><td class="p-3">${day.filledPpics}/${day.requiredPpics}</td><td class="p-3">${day.requiredPpics ? percent(day.filledPpics, day.requiredPpics) + '%' : '—'}</td></tr>`).join('')}</tbody></table></div>
  </section>`
}
function put(selector: string, html: string): void { const node = document.querySelector<HTMLElement>(selector); if (node) node.innerHTML = html }
function refresh(withFilters = false): void {
  loadView()
  put('[data-stat-context]', contextLine())
  put('[data-stat-feedback]', feedback())
  put('[data-stat-stats]', statCards())
  put('[data-stat-trend]', trendChart())
  put('[data-stat-rate]', rateCard())
  put('[data-stat-ppic-chart]', ppicChart())
  put('[data-stat-ppic-table]', ppicTable())
  put('[data-stat-daily-table]', dailyTable())
  if (withFilters) put('[data-stat-filters]', filters())
}
export async function renderPpicDailyStatisticsPage(): Promise<string> {
  try {
    await ensurePpicDailyReturnState()
    if (!state.date) { const date = ppicBusinessDate(new Date().toISOString()); state.date = date; state.draftDate = date }
    state.days = [7, 14, 30].includes(state.days) ? state.days : 7
    state.draftDays = state.days
    state.error = ''; state.busy = false
    loadView()
    return `${renderPostFinishingStorageNotice()}<main class="space-y-3 p-4" data-ppic-stat-page data-skip-page-rerender="true">
      <header class="flex flex-wrap items-start justify-between gap-3"><div><h1 class="text-xl font-semibold">每日填报统计</h1><p class="mt-1 text-xs text-slate-500" data-stat-context>${contextLine()}</p></div><a class="text-sm font-semibold text-blue-700" href="/fcs/sewing-outsourcing/daily-return-report" data-nav="/fcs/sewing-outsourcing/daily-return-report">返回每日回货填报</a></header>
      <div data-stat-feedback>${feedback()}</div>
      <div data-stat-filters>${filters()}</div>
      <div data-stat-stats>${statCards()}</div>
      <div class="grid gap-3 xl:grid-cols-3"><div class="xl:col-span-2" data-stat-trend>${trendChart()}</div><div data-stat-rate>${rateCard()}</div></div>
      <div class="grid gap-3 xl:grid-cols-2"><div data-stat-ppic-chart>${ppicChart()}</div><div data-stat-daily-table>${dailyTable()}</div></div>
      <div data-stat-ppic-table>${ppicTable()}</div>
    </main>`
  } catch (error) {
    return `${renderPostFinishingStorageNotice()}<main class="space-y-3 p-4" data-ppic-stat-page data-skip-page-rerender="true"><h1 class="text-xl font-semibold">每日填报统计</h1><p role="alert" class="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">${escapeHtml(error instanceof Error ? error.message : '每日填报统计读取失败')}。未读到的记录不会作为空记录保存。</p><button class="${buttonClass}" ${action('retry-load')}>重新读取</button></main>`
  }
}
export async function handlePpicDailyStatisticsEvent(target: HTMLElement, event?: Event): Promise<boolean> {
  const field = target.closest<HTMLInputElement | HTMLSelectElement>('[data-ppic-stat-field]')
  if (field) {
    if (field.dataset.ppicStatField === 'date') { state.draftDate = field.value; return true }
    if (field.dataset.ppicStatField === 'days') { state.draftDays = Number(field.value) || 7; return true }
    return false
  }
  const node = target.closest<HTMLElement>('[data-ppic-stat-action]'); if (!node || event && event.type !== 'click') return false
  const name = node.dataset.ppicStatAction
  if (name === 'retry-load') { const root = document.querySelector<HTMLElement>('[data-ppic-stat-page]'); if (root) root.outerHTML = await renderPpicDailyStatisticsPage(); return true }
  if (state.busy) return true
  if (name === 'query') { state.date = state.draftDate || state.date; state.days = [7, 14, 30].includes(state.draftDays) ? state.draftDays : 7; refresh(true); return true }
  if (name === 'reset') { const date = ppicBusinessDate(new Date().toISOString()); state.date = date; state.days = 7; state.draftDate = date; state.draftDays = 7; refresh(true); return true }
  return false
}
if (typeof window !== 'undefined') window.setInterval(() => {
  if (!document.querySelector('[data-ppic-stat-page]') || !state.view || state.busy) return
  try { refresh() } catch (error) { state.error = error instanceof Error ? error.message : '每日填报统计读取失败'; put('[data-stat-feedback]', feedback()) }
}, 30000)
