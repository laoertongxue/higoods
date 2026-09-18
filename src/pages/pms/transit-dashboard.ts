// @page-pattern: dashboard
import { renderPrimaryButton } from '../../components/ui/button.ts'
import { renderProcessOrderStats } from '../../components/ui/process-order-list-presentation.ts'
import { getPmsTransitDashboard, setPmsTransitFilter, type PmsTransitMetric } from '../../data/pms/transit-warehouse.ts'
import { appStore } from '../../state/store.ts'
import { escapeHtml } from '../../utils.ts'
import { hydratePmsSurface } from './shared.ts'

const ROOT_SELECTOR = '[data-pms-trn-dash-root]'
const EVENT_PREFIX = 'pms-trnd'

function toneClasses(tone: string): string {
  if (tone === 'green') return 'border-emerald-200 bg-emerald-50 text-emerald-800'
  if (tone === 'red') return 'border-red-200 bg-red-50 text-red-800'
  if (tone === 'yellow') return 'border-amber-200 bg-amber-50 text-amber-800'
  if (tone === 'blue') return 'border-blue-200 bg-blue-50 text-blue-800'
  return 'border-slate-200 bg-slate-50 text-slate-700'
}

function renderTrend(): string {
  const dashboard = getPmsTransitDashboard()
  const max = Math.max(...dashboard.trend.flatMap((point) => [point.inbound, point.outbound]), 1)
  return `<section class="rounded-lg border bg-card p-4">
    <h2 class="text-base font-semibold">近 7 天收货趋势</h2>
    <div class="mt-4 flex items-end gap-3" data-pms-trn-dash-trend>
      ${dashboard.trend
        .map(
          (point) => `<div class="flex flex-1 flex-col items-center gap-1">
        <div class="flex h-40 w-full items-end justify-center gap-1">
          <div class="w-1/3 rounded-t bg-blue-500" style="height: ${Math.round((point.inbound / max) * 100)}%" title="收货 ${point.inbound}"></div>
          <div class="w-1/3 rounded-t bg-slate-400" style="height: ${Math.round((point.outbound / max) * 100)}%" title="发出 ${point.outbound}"></div>
        </div>
        <span class="text-xs text-slate-500">${escapeHtml(point.date)}</span>
        <span class="text-[10px] text-slate-400">${point.inbound}/${point.outbound}</span>
      </div>`,
        )
        .join('')}
    </div>
    <p class="mt-2 text-xs text-slate-500">蓝色为收货（单），灰色为发出（单）。</p>
  </section>`
}

function renderDistribution(title: string, items: Array<{ label: string; value: number; tone: string }>): string {
  const max = Math.max(...items.map((item) => item.value), 1)
  return `<section class="rounded-lg border bg-card p-4"><h2 class="text-base font-semibold">${escapeHtml(title)}</h2><ul class="mt-3 space-y-2">${items
    .map(
      (item) => `<li><div class="flex items-center justify-between text-sm"><span>${escapeHtml(item.label)}</span><strong class="tabular-nums">${item.value}</strong></div><div class="mt-1 h-2 rounded-full bg-slate-100"><div class="h-2 rounded-full ${item.tone === 'green' ? 'bg-emerald-500' : item.tone === 'red' ? 'bg-red-500' : item.tone === 'yellow' ? 'bg-amber-500' : item.tone === 'blue' ? 'bg-blue-500' : 'bg-slate-400'}" style="width: ${Math.round((item.value / max) * 100)}%"></div></div></li>`,
    )
    .join('')}</ul></section>`
}

function renderMetricCard(metric: PmsTransitMetric): string {
  const cardHtml = renderProcessOrderStats([{ label: metric.label, value: `${metric.value} ${metric.unit}` }])
    .replace('<div class="grid grid-cols-3 gap-2 xl:grid-cols-6" data-standard-list-stats>', '')
    .replace(/<\/div>$/, '')
  return `<button type="button" class="block w-full min-w-0 cursor-pointer text-left" data-${EVENT_PREFIX}-action="open-receipts" data-filter="${escapeHtml(metric.filter)}" data-skip-page-rerender="true">${cardHtml}</button>`
}

export function renderPmsTransitDashboardPage(): string {
  const dashboard = getPmsTransitDashboard()
  const metricCards = dashboard.metrics.map(renderMetricCard).join('')
  const exceptions = dashboard.exceptions.length
    ? dashboard.exceptions
        .map(
          (exception) => `<article class="rounded-lg border ${toneClasses(exception.tone)} p-4"><h3 class="text-sm font-semibold">${escapeHtml(exception.title)}</h3><p class="mt-1 text-xs leading-5 text-slate-600">${escapeHtml(exception.detail)}</p><button type="button" class="mt-3 h-8 rounded-md border bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50" data-${EVENT_PREFIX}-action="open-receipts" data-filter="${escapeHtml(exception.filter)}" data-skip-page-rerender="true">去处理收货异常</button></article>`,
        )
        .join('')
    : '<p class="rounded-lg border bg-card px-4 py-6 text-sm text-muted-foreground">当前没有收货异常。</p>'
  return `<div data-pms-trn-dash-root data-skip-page-rerender="true" class="space-y-4 p-4">
    <header class="flex flex-wrap items-end justify-between gap-3">
      <div><h1 class="text-xl font-semibold">中转仓数据总览</h1><p class="mt-1 text-sm text-muted-foreground">收货、在途、异常与来源分布；点击指标可跳转收货单列表并携带筛选</p></div>
      ${renderPrimaryButton('查看全部收货单', { prefix: EVENT_PREFIX, action: 'open-receipts', skipPageRerender: true }, 'arrow-right').replace('<button', '<button data-filter=""')}
    </header>
    <section class="grid grid-cols-3 gap-2 xl:grid-cols-6" data-pms-trn-dash-metrics data-standard-list-stats>${metricCards}</section>
    ${renderTrend()}
    <section class="grid grid-cols-1 gap-3 lg:grid-cols-3">
      ${renderDistribution('收货状态分布', dashboard.statusDistribution)}
      ${renderDistribution('来源地区分布', dashboard.regionDistribution)}
      ${renderDistribution('目的仓分布', dashboard.warehouseDistribution)}
    </section>
    <section class="space-y-3"><h2 class="text-base font-semibold">收货异常</h2><div class="grid grid-cols-1 gap-3 md:grid-cols-2">${exceptions}</div></section>
  </div>`
}

export function handlePmsTransitDashboardEvent(target: HTMLElement): boolean {
  if (!rootElement()) return false
  const actionNode = target.closest<HTMLElement>(`[data-${EVENT_PREFIX}-action]`)
  if (!actionNode) return false
  if (actionNode.dataset.pmsTrndAction === 'open-receipts') {
    setPmsTransitFilter(actionNode.dataset.filter || '')
    appStore.navigate('/pms/transit/receipts')
    return true
  }
  return false
}

function rootElement(): HTMLElement | null {
  if (typeof window === 'undefined') return null
  return document.querySelector<HTMLElement>(ROOT_SELECTOR)
}

export function hydratePmsTransitDashboardSurface(): void {
  hydratePmsSurface(document.querySelector(ROOT_SELECTOR))
}
