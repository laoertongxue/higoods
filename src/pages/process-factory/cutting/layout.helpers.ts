import { escapeHtml } from '../../../utils.ts'

export function renderCompactKpiCard(
  label: string,
  value: number | string,
  hint: string,
  accentClass: string,
  formula = '',
): string {
  return `
    <article class="rounded-lg border bg-card px-3 py-2">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <p class="text-xs text-muted-foreground">${escapeHtml(label)}</p>
          <p class="mt-0.5 text-lg font-semibold leading-none tabular-nums ${accentClass}">${escapeHtml(String(value))}</p>
          ${formula ? `<p class="mt-1 font-mono text-[11px] leading-4 text-muted-foreground">${escapeHtml(formula)}</p>` : ''}
        </div>
        ${hint ? `<p class="max-w-[9rem] text-right text-[10px] leading-4 text-muted-foreground">${escapeHtml(hint)}</p>` : ''}
      </div>
    </article>
  `
}

export function renderWorkbenchActionCard(options: {
  title: string
  count: number | string
  hint: string
  attrs: string
  active?: boolean
  accentClass?: string
  variant?: 'priority' | 'kpi'
}): string {
  const variant = options.variant ?? 'kpi'
  const activeClass =
    variant === 'priority'
      ? 'border-amber-500 bg-amber-50 shadow-sm'
      : 'border-blue-500 bg-blue-50 shadow-sm'
  const inactiveClass =
    variant === 'priority'
      ? 'border-amber-200/80 bg-amber-50/40 hover:border-amber-300 hover:bg-amber-50/70'
      : 'bg-card hover:border-slate-300 hover:bg-muted/20'
  const activeBadgeClass = variant === 'priority' ? 'bg-amber-600 text-white' : 'bg-blue-600 text-white'

  return `
    <button
      type="button"
      ${options.attrs}
      class="w-full rounded-lg border px-2 py-1.5 text-left transition ${options.active ? activeClass : inactiveClass}"
    >
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <p class="truncate text-[11px] font-semibold leading-4 text-foreground">${escapeHtml(options.title)}</p>
          ${options.hint ? `<p class="mt-1 text-[10px] leading-4 text-muted-foreground">${escapeHtml(options.hint)}</p>` : ''}
        </div>
        <div class="shrink-0 text-right">
          <p class="text-base font-semibold leading-none tabular-nums ${options.accentClass ?? 'text-slate-900'}">${escapeHtml(String(options.count))}</p>
          ${options.active ? `<span class="mt-0.5 inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-medium ${activeBadgeClass}">已选</span>` : ''}
        </div>
      </div>
    </button>
  `
}

export function renderWorkbenchShortcutZone(options: {
  cardsHtml: string
  columnsClass?: string
}): string {
  return `
    <section class="rounded-lg border bg-card px-2 py-1.5">
      <div class="${options.columnsClass ?? 'grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8'}">
        ${options.cardsHtml}
      </div>
    </section>
  `
}

export function renderWorkbenchCardLayer(options: {
  title: string
  hint: string
  cardsHtml: string
  columnsClass?: string
}): string {
  return `
    <section class="rounded-lg border bg-card p-2.5">
      <div class="mb-2 flex items-start justify-between gap-3">
        <div>
          <h2 class="text-sm font-semibold text-foreground">${escapeHtml(options.title)}</h2>
          ${options.hint ? `<p class="mt-0.5 text-[11px] text-muted-foreground">${escapeHtml(options.hint)}</p>` : ''}
        </div>
      </div>
      <div class="${options.columnsClass ?? 'grid gap-3 md:grid-cols-2 xl:grid-cols-4'}">
        ${options.cardsHtml}
      </div>
    </section>
  `
}

export function renderWorkbenchFilterChip(label: string, attrs: string, tone: 'blue' | 'amber' | 'emerald' | 'rose' = 'blue'): string {
  const toneClass =
    tone === 'amber'
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : tone === 'emerald'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
        : tone === 'rose'
          ? 'border-rose-200 bg-rose-50 text-rose-700'
          : 'border-blue-200 bg-blue-50 text-blue-700'

  return `
    <button type="button" ${attrs} class="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${toneClass}">
      ${escapeHtml(label)}
    </button>
  `
}

export function renderWorkbenchStateBar(options: {
  summary: string
  chips: string[]
  clearAttrs: string
}): string {
  if (!options.chips.length) return ''

  return `
    <section class="flex flex-col gap-2 rounded-lg border border-dashed bg-muted/20 px-3 py-2 lg:flex-row lg:items-center lg:justify-between">
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-xs font-medium text-muted-foreground">${escapeHtml(options.summary)}</span>
        ${options.chips.join('')}
      </div>
      <button type="button" ${options.clearAttrs} class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted">
        清除当前视图条件
      </button>
    </section>
  `
}

export function renderStickyFilterShell(content: string, extraClass = '', extraAttrs = ''): string {
  return `
    <section ${extraAttrs} class="sticky top-2 z-20 rounded-lg border bg-card/95 p-2.5 shadow-sm backdrop-blur ${extraClass}">
      ${content}
    </section>
  `
}

export function renderWorkbenchSecondaryPanel(options: {
  title: string
  hint: string
  body: string
  countText?: string
  defaultOpen?: boolean
}): string {
  return `
    <details class="rounded-lg border bg-card" ${options.defaultOpen ? 'open' : ''}>
      <summary class="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <h2 class="text-sm font-semibold text-foreground">${escapeHtml(options.title)}</h2>
            ${options.countText ? `<span class="text-xs text-muted-foreground">${escapeHtml(options.countText)}</span>` : ''}
          </div>
          <p class="mt-0.5 text-[11px] text-muted-foreground">${escapeHtml(options.hint)}</p>
        </div>
        <span class="shrink-0 text-xs text-muted-foreground">展开查看</span>
      </summary>
      <div class="border-t p-3">
        ${options.body}
      </div>
    </details>
  `
}

export function renderStickyTableScroller(tableHtml: string, heightClass = 'max-h-[62vh]'): string {
  return `
    <div class="${heightClass} overflow-auto">
      ${tableHtml}
    </div>
  `
}

export interface PaginationSliceResult<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
  start: number
  end: number
}

export function paginateItems<T>(items: T[], page: number, pageSize: number): PaginationSliceResult<T> {
  const safePageSize = pageSize > 0 ? pageSize : 20
  const total = items.length
  const totalPages = Math.max(1, Math.ceil(total / safePageSize))
  const safePage = Math.min(Math.max(page, 1), totalPages)
  const startIndex = (safePage - 1) * safePageSize
  const pagedItems = items.slice(startIndex, startIndex + safePageSize)

  return {
    items: pagedItems,
    page: safePage,
    pageSize: safePageSize,
    total,
    totalPages,
    start: total === 0 ? 0 : startIndex + 1,
    end: total === 0 ? 0 : startIndex + pagedItems.length,
  }
}

function buildPaginationWindow(page: number, totalPages: number): Array<number | 'ellipsis'> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const pages: Array<number | 'ellipsis'> = [1]
  const start = Math.max(2, page - 1)
  const end = Math.min(totalPages - 1, page + 1)

  if (start > 2) pages.push('ellipsis')
  for (let current = start; current <= end; current += 1) {
    pages.push(current)
  }
  if (end < totalPages - 1) pages.push('ellipsis')
  pages.push(totalPages)
  return pages
}

export function renderWorkbenchPagination(options: {
  page: number
  pageSize: number
  total: number
  actionAttr: string
  pageAction: string
  pageSizeAttr: string
  extraAttrs?: string
  pageSizeOptions?: number[]
}): string {
  const pageSizeOptions = options.pageSizeOptions ?? [20, 50, 100]
  const totalPages = Math.max(1, Math.ceil(options.total / options.pageSize))
  const safePage = Math.min(Math.max(options.page, 1), totalPages)
  const extraAttrs = options.extraAttrs ? ` ${options.extraAttrs}` : ''
  const pageWindow = buildPaginationWindow(safePage, totalPages)
  const start = options.total === 0 ? 0 : (safePage - 1) * options.pageSize + 1
  const end = options.total === 0 ? 0 : Math.min(options.total, safePage * options.pageSize)

  return `
    <div class="flex flex-col gap-2 border-t px-3 py-2.5 lg:flex-row lg:items-center lg:justify-between">
      <div class="text-xs text-muted-foreground">
        显示 ${start}-${end} 条，共 ${options.total} 条，第 ${safePage} / ${totalPages} 页
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <label class="flex items-center gap-2 text-xs text-muted-foreground">
          <span>每页</span>
          <select ${options.pageSizeAttr}="true"${extraAttrs} class="h-8 rounded-md border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-blue-500">
            ${pageSizeOptions
              .map((size) => `<option value="${size}" ${size === options.pageSize ? 'selected' : ''}>${size}</option>`)
              .join('')}
          </select>
        </label>
        <div class="flex flex-wrap items-center gap-1">
          <button type="button" ${options.actionAttr}="${options.pageAction}" data-page="${Math.max(1, safePage - 1)}"${extraAttrs} class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted ${safePage === 1 ? 'pointer-events-none opacity-50' : ''}">
            上一页
          </button>
          ${pageWindow
            .map((item) =>
              item === 'ellipsis'
                ? '<span class="px-1 text-xs text-muted-foreground">…</span>'
                : `<button type="button" ${options.actionAttr}="${options.pageAction}" data-page="${item}"${extraAttrs} class="rounded-md border px-2.5 py-1 text-xs ${item === safePage ? 'border-blue-500 bg-blue-50 text-blue-700' : 'hover:bg-muted'}">${item}</button>`,
            )
            .join('')}
          <button type="button" ${options.actionAttr}="${options.pageAction}" data-page="${Math.min(totalPages, safePage + 1)}"${extraAttrs} class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted ${safePage === totalPages ? 'pointer-events-none opacity-50' : ''}">
            下一页
          </button>
        </div>
      </div>
    </div>
  `
}
