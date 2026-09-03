import { escapeHtml } from '../../utils.ts'
import { toActionAttr } from './types.ts'

export interface StandardListStatItem {
  label: string
  value: string | number
}

export interface StandardListPageConfig {
  title: string
  primaryActionsHtml?: string
  feedbackHtml?: string
  statusTabsHtml?: string
  filtersHtml: string
  statsHtml?: string
  listTitle?: string
  listActionsHtml?: string
  tableHtml: string
  paginationHtml: string
  overlaysHtml?: string
  className?: string
}

export interface StandardListFiltersConfig {
  fieldsHtml: string
  actionPrefix: string
  queryAction?: string
  resetAction?: string
}

export function renderStandardListFilters(config: StandardListFiltersConfig): string {
  return `
    <div class="flex flex-wrap items-end justify-between gap-3 rounded-lg border bg-card p-3" data-standard-list-filter-bar>
      <div class="flex min-w-0 flex-1 flex-wrap items-end gap-3">${config.fieldsHtml}</div>
      <div class="flex shrink-0 items-center gap-2">
        <button type="button" class="h-9 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700" ${toActionAttr({ prefix: config.actionPrefix, action: config.queryAction ?? 'query' })} data-standard-list-query>查询</button>
        <button type="button" class="h-9 rounded-md border bg-background px-4 text-sm font-semibold text-foreground hover:bg-muted" ${toActionAttr({ prefix: config.actionPrefix, action: config.resetAction ?? 'reset' })} data-standard-list-reset>重置</button>
      </div>
    </div>
  `
}

export function renderStandardListStats(items: StandardListStatItem[], options: { compact?: boolean } = {}): string {
  const itemWidthClass = options.compact ? 'min-w-[9rem] flex-[1_1_9rem]' : 'min-w-[12rem] flex-[1_1_12rem]'
  return `
    <div class="flex flex-wrap gap-3" data-standard-list-stats>
      ${items
        .map(
          (item) => `
            <div class="flex h-12 ${itemWidthClass} items-center justify-between gap-2 rounded-lg border bg-card px-3">
              <span class="shrink-0 whitespace-nowrap text-xs text-muted-foreground">${escapeHtml(item.label)}</span>
              <strong class="whitespace-nowrap text-sm font-semibold tabular-nums">${escapeHtml(item.value)}</strong>
            </div>
          `,
        )
        .join('')}
    </div>
  `
}

export function renderStandardListPage(config: StandardListPageConfig): string {
  const className = ['p-4', 'space-y-3', config.className].filter(Boolean).join(' ')
  const listHeader = config.listTitle || config.listActionsHtml
    ? `<header class="flex min-h-11 flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        ${config.listTitle ? `<h2 class="font-semibold">${escapeHtml(config.listTitle)}</h2>` : ''}
        ${config.listActionsHtml ?? ''}
      </header>`
    : ''

  return `
    <section class="${escapeHtml(className)}" data-standard-list-page>
      <header class="flex min-h-9 flex-wrap items-center justify-between gap-3">
        <h1 class="text-xl font-semibold">${escapeHtml(config.title)}</h1>
        ${config.primaryActionsHtml ?? ''}
      </header>
      ${config.feedbackHtml ?? ''}
      ${config.statusTabsHtml ? `<div data-standard-list-status-tabs>${config.statusTabsHtml}</div>` : ''}
      <div data-standard-list-filters>${config.filtersHtml}</div>
      ${config.statsHtml ?? ''}
      <section class="overflow-hidden rounded-lg border bg-card" data-standard-list-table-section>
        ${listHeader}
        <div class="overflow-x-auto">${config.tableHtml}</div>
        <div class="border-t px-4 py-3">${config.paginationHtml}</div>
      </section>
      ${config.overlaysHtml ?? ''}
    </section>
  `
}
