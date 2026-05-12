import { escapeHtml } from '../../../utils'
import { appStore } from '../../../state/store.ts'
import {
  DEFAULT_PAGE_SIZE_OPTIONS,
  paginateRows,
  parsePageSize,
  type PagingResult,
} from '../../../utils/paging.ts'
import {
  getKnittingWorkOrderKindLabel,
  getKnittingWorkOrderStatusLabel,
  type KnittingWorkOrderKind,
  type KnittingWorkOrderStatus,
} from '../../../data/fcs/knitting-task-domain.ts'

export type BadgeTone = 'muted' | 'info' | 'warning' | 'success' | 'danger'

export function formatNumber(value: number, maximumFractionDigits = 2): string {
  return Number(value || 0).toLocaleString('zh-CN', { maximumFractionDigits })
}

export function formatQty(value: number | undefined, unit: string | undefined): string {
  return `${formatNumber(value ?? 0)} ${escapeHtml(unit || '')}`.trim()
}

export function formatMoney(value: number, currency: string): string {
  if (!value) return '待公式'
  return `${formatNumber(value, 0)} ${escapeHtml(currency)}`
}

export function renderBadge(label: string, tone: BadgeTone = 'muted'): string {
  const className =
    tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : tone === 'warning'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : tone === 'danger'
          ? 'border-red-200 bg-red-50 text-red-700'
          : tone === 'info'
            ? 'border-blue-200 bg-blue-50 text-blue-700'
            : 'border-slate-200 bg-slate-50 text-slate-700'

  return `<span class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${className}">${escapeHtml(label)}</span>`
}

export function renderKindBadge(kind: KnittingWorkOrderKind): string {
  return renderBadge(getKnittingWorkOrderKindLabel(kind), kind === 'PART_PANEL' ? 'info' : 'muted')
}

export function renderStatusBadge(status: KnittingWorkOrderStatus): string {
  const tone: BadgeTone =
    status === 'COMPLETED'
      ? 'success'
      : ['WAIT_PICKUP', 'PICKUP_IN_PROGRESS', 'WAIT_MACHINE_SCHEDULE', 'MACHINE_SCHEDULED', 'WAIT_HANDOVER', 'HANDOVER_SUBMITTED', 'WAIT_FEI_TICKET', 'FEI_TICKET_PRINTED'].includes(status)
          ? 'warning'
          : ['FLAT_KNITTING', 'LINKING', 'IRONING', 'PACKING'].includes(status)
            ? 'info'
            : 'muted'
  return renderBadge(getKnittingWorkOrderStatusLabel(status), tone)
}

export function renderMetricCard(title: string, value: string, helper = ''): string {
  return `
    <article class="rounded-lg border bg-card px-4 py-3">
      <div class="text-xs text-muted-foreground">${escapeHtml(title)}</div>
      <div class="mt-2 text-2xl font-semibold text-foreground">${escapeHtml(value)}</div>
      ${helper ? `<div class="mt-1 text-xs text-muted-foreground">${escapeHtml(helper)}</div>` : ''}
    </article>
  `
}

export function renderPageHeader(title: string, subtitle: string, actionHtml = ''): string {
  return `
    <header class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold text-foreground">${escapeHtml(title)}</h1>
        ${subtitle.trim() ? `<p class="mt-1 text-sm text-muted-foreground">${escapeHtml(subtitle)}</p>` : ''}
      </div>
      ${actionHtml}
    </header>
  `
}

export function renderSection(title: string, body: string, actionHtml = ''): string {
  return `
    <section class="rounded-lg border bg-card">
      <header class="flex items-center justify-between gap-3 border-b px-4 py-3">
        <h2 class="text-sm font-semibold">${escapeHtml(title)}</h2>
        ${actionHtml}
      </header>
      <div class="p-4">${body}</div>
    </section>
  `
}

export function renderField(label: string, value: string): string {
  return `<div><span class="text-muted-foreground">${escapeHtml(label)}：</span><span class="font-medium">${escapeHtml(value || '—')}</span></div>`
}

export function renderTable(headers: string[], rows: string, minWidthClass = 'min-w-[1180px]'): string {
  return `
    <div class="overflow-x-auto">
      <table class="${minWidthClass} w-full text-left text-sm">
        <thead class="bg-slate-50 text-xs text-muted-foreground">
          <tr>${headers.map((header) => `<th class="px-3 py-2 font-medium">${escapeHtml(header)}</th>`).join('')}</tr>
        </thead>
        <tbody>${rows || `<tr><td colspan="${headers.length}" class="px-3 py-8 text-center text-muted-foreground">暂无数据</td></tr>`}</tbody>
      </table>
    </div>
  `
}

export interface KnittingPaginationResult<T> extends PagingResult<T> {
  pageParam: string
  pageSize: number
  pageSizeParam: string
}

function getCurrentPathParts(): { path: string; params: URLSearchParams } {
  const statePath = appStore.getState().pathname || (typeof window === 'undefined' ? '' : `${window.location.pathname}${window.location.search}`)
  const [path = '', query = ''] = statePath.split('?')
  return {
    path: path || '/fcs/craft/knitting/work-orders',
    params: new URLSearchParams(query),
  }
}

function buildPaginationHref(pageParam: string, page: number, pageSizeParam: string, pageSize: number): string {
  const { path, params } = getCurrentPathParts()
  params.set(pageParam, String(Math.max(1, Math.trunc(page) || 1)))
  params.set(pageSizeParam, String(pageSize))
  params.delete('refreshAt')
  return `${path}?${params.toString()}`
}

export function paginateKnittingItems<T>(
  items: T[],
  pageParam: string,
  defaultPageSize = 10,
  pageSizeParam = `${pageParam}Size`,
): KnittingPaginationResult<T> {
  const { params } = getCurrentPathParts()
  const pageSize = parsePageSize(params.get(pageSizeParam) || defaultPageSize, DEFAULT_PAGE_SIZE_OPTIONS, defaultPageSize)
  const page = Number(params.get(pageParam) || 1)
  return {
    ...paginateRows(items, page, pageSize),
    pageParam,
    pageSize,
    pageSizeParam,
  }
}

export function renderPaginationControls<T>(paging: KnittingPaginationResult<T>, label = '条记录'): string {
  const pages = new Set<number>([
    1,
    paging.totalPages,
    paging.currentPage,
    paging.currentPage - 1,
    paging.currentPage + 1,
  ])
  const pageButtons = Array.from(pages)
    .filter((page) => page >= 1 && page <= paging.totalPages)
    .sort((a, b) => a - b)
  let lastPage = 0

  return `
    <footer class="flex flex-wrap items-center justify-between gap-3 border-t px-3 py-3 text-xs text-muted-foreground">
      <div>
        共 ${formatNumber(paging.total, 0)} ${escapeHtml(label)}，当前 ${formatNumber(paging.from, 0)}-${formatNumber(paging.to, 0)}
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <span>每页</span>
        ${DEFAULT_PAGE_SIZE_OPTIONS.map((size) => `
          <button
            type="button"
            class="rounded-md border px-2 py-1 ${size === paging.pageSize ? 'border-blue-500 bg-blue-50 text-blue-700' : 'hover:bg-muted'}"
            data-nav="${escapeHtml(buildPaginationHref(paging.pageParam, 1, paging.pageSizeParam, size))}"
          >${size}</button>
        `).join('')}
        <span>条</span>
        <button
          type="button"
          class="rounded-md border px-2.5 py-1 ${paging.currentPage <= 1 ? 'pointer-events-none opacity-50' : 'hover:bg-muted'}"
          data-nav="${escapeHtml(buildPaginationHref(paging.pageParam, Math.max(1, paging.currentPage - 1), paging.pageSizeParam, paging.pageSize))}"
        >上一页</button>
        ${pageButtons.map((page) => {
          const gap = lastPage && page - lastPage > 1 ? '<span class="px-1">...</span>' : ''
          lastPage = page
          return `
            ${gap}
            <button
              type="button"
              class="min-w-8 rounded-md border px-2.5 py-1 ${page === paging.currentPage ? 'border-blue-500 bg-blue-50 text-blue-700' : 'hover:bg-muted'}"
              data-nav="${escapeHtml(buildPaginationHref(paging.pageParam, page, paging.pageSizeParam, paging.pageSize))}"
            >${page}</button>
          `
        }).join('')}
        <button
          type="button"
          class="rounded-md border px-2.5 py-1 ${paging.currentPage >= paging.totalPages ? 'pointer-events-none opacity-50' : 'hover:bg-muted'}"
          data-nav="${escapeHtml(buildPaginationHref(paging.pageParam, Math.min(paging.totalPages, paging.currentPage + 1), paging.pageSizeParam, paging.pageSize))}"
        >下一页</button>
      </div>
    </footer>
  `
}

export function renderPaginatedTable<T>(
  headers: string[],
  items: T[],
  renderRow: (item: T) => string,
  minWidthClass: string,
  pageParam: string,
  label = '条记录',
  defaultPageSize = 10,
): string {
  const paging = paginateKnittingItems(items, pageParam, defaultPageSize)
  return `
    ${renderTable(headers, paging.rows.map(renderRow).join(''), minWidthClass)}
    ${renderPaginationControls(paging, label)}
  `
}
