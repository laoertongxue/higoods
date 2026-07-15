import { escapeHtml } from '../../utils.ts'

export interface StandardListStatItem {
  label: string
  value: string | number
}

export interface StandardListPageConfig {
  title: string
  primaryActionsHtml?: string
  feedbackHtml?: string
  filtersHtml: string
  statsHtml?: string
  listTitle: string
  listActionsHtml?: string
  tableHtml: string
  paginationHtml: string
  overlaysHtml?: string
  className?: string
}

export function renderStandardListStats(items: StandardListStatItem[]): string {
  return `
    <div class="flex flex-wrap gap-3" data-standard-list-stats>
      ${items
        .map(
          (item) => `
            <div class="flex h-12 min-w-[10rem] flex-1 items-center justify-between gap-4 rounded-lg border bg-card px-4">
              <span class="text-sm text-muted-foreground">${escapeHtml(item.label)}</span>
              <strong class="text-lg font-semibold tabular-nums">${escapeHtml(item.value)}</strong>
            </div>
          `,
        )
        .join('')}
    </div>
  `
}

export function renderStandardListPage(config: StandardListPageConfig): string {
  const className = ['p-4', 'space-y-3', config.className].filter(Boolean).join(' ')

  return `
    <section class="${escapeHtml(className)}" data-standard-list-page>
      <header class="flex min-h-9 flex-wrap items-center justify-between gap-3">
        <h1 class="text-xl font-semibold">${escapeHtml(config.title)}</h1>
        ${config.primaryActionsHtml ?? ''}
      </header>
      ${config.feedbackHtml ?? ''}
      <div data-standard-list-filters>${config.filtersHtml}</div>
      ${config.statsHtml ?? ''}
      <section class="overflow-hidden rounded-lg border bg-card" data-standard-list-table-section>
        <header class="flex min-h-11 flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <h2 class="font-semibold">${escapeHtml(config.listTitle)}</h2>
          ${config.listActionsHtml ?? ''}
        </header>
        <div class="overflow-x-auto">${config.tableHtml}</div>
        <div class="border-t px-4 py-3">${config.paginationHtml}</div>
      </section>
      ${config.overlaysHtml ?? ''}
    </section>
  `
}
