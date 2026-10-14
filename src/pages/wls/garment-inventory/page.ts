// @page-pattern: list
import { escapeHtml } from '../../../utils.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { renderStandardListPage } from '../../../components/ui/list-page.ts'
import {
  renderStandardListTable,
  type StandardListColumn,
} from '../../../components/ui/list-table.ts'
import {
  paginateStandardListRows,
  sortStandardListRows,
  type StandardListColumnPreferences,
  type StandardListSortState,
} from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'
import { renderDialog } from '../../../components/ui/dialog.ts'
import { garmentInventorySeed, type GarmentInventorySpuRow } from './seed.ts'

const EVENT_PREFIX = 'garment-inventory'
const DATASET_PREFIX = EVENT_PREFIX.replace(/-([a-z0-9])/g, (_, char: string) => char.toUpperCase())
const DEFAULT_PAGE_SIZE = 30
const PAGE_SIZE_OPTIONS = [10, 20, 30, 50, 100]

type SeaMarkFilter = '' | 'marked' | 'unmarked'

const state = {
  currentPage: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  sort: null as StandardListSortState | null,
  keyword: '',
  seaMark: '' as SeaMarkFilter,
  activeSpu: null as string | null,
  escapeBound: false,
}

function formatQty(value: number, unit: string): string {
  const formatted = value.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${formatted} ${unit}`
}

function materialTypeBadge(type: GarmentInventorySpuRow['materialType']): string {
  const tone = type === '面料' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
  return `<span class="rounded-full px-2 py-0.5 text-xs ${tone}">${escapeHtml(type)}</span>`
}

const columns: StandardListColumn<GarmentInventorySpuRow>[] = [
  {
    key: 'image',
    title: '商品图片',
    width: 96,
    required: true,
    render: (row) =>
      `<img src="${escapeHtml(row.image)}" alt="${escapeHtml(row.imageAlt)}" loading="lazy" class="h-12 w-12 rounded-md border border-slate-200 object-cover" onerror="this.style.display='none'">`,
  },
  {
    key: 'spu',
    title: 'Spu',
    width: 190,
    sortable: true,
    sortValue: (row) => row.spu,
    render: (row) =>
      `<div class="space-y-0.5"><span class="font-mono text-xs text-blue-600">${escapeHtml(row.spu)}</span>${
        row.seaInboundTime
          ? `<div class="text-[11px] text-slate-400">海运入库：${escapeHtml(row.seaInboundTime)}</div>`
          : ''
      }</div>`,
  },
  {
    key: 'materialType',
    title: '物料类型',
    width: 100,
    sortable: true,
    sortValue: (row) => row.materialType,
    render: (row) => materialTypeBadge(row.materialType),
  },
  {
    key: 'transitQty',
    title: '在途库存数',
    width: 140,
    align: 'right',
    sortable: true,
    sortValue: (row) => row.transitQty,
    render: (row) => `<span class="text-orange-700">${escapeHtml(formatQty(row.transitQty, row.unit))}</span>`,
  },
  {
    key: 'primaryQty',
    title: '一级仓库库存数',
    width: 150,
    align: 'right',
    sortable: true,
    sortValue: (row) => row.primaryQty,
    render: (row) => `<span class="font-medium text-slate-700">${escapeHtml(formatQty(row.primaryQty, row.unit))}</span>`,
  },
  {
    key: 'secondaryQty',
    title: '二级仓库库存数',
    width: 150,
    align: 'right',
    sortable: true,
    sortValue: (row) => row.secondaryQty,
    render: (row) => `<span class="text-slate-600">${escapeHtml(formatQty(row.secondaryQty, row.unit))}</span>`,
  },
  {
    key: 'yesterdayConsumption',
    title: '昨日消耗数量',
    width: 140,
    align: 'right',
    sortable: true,
    sortValue: (row) => row.yesterdayConsumption,
    render: (row) => `<span class="text-slate-600">${escapeHtml(formatQty(row.yesterdayConsumption, row.unit))}</span>`,
  },
  {
    key: 'avg7DayConsumption',
    title: '近7日平均消耗',
    width: 140,
    align: 'right',
    sortable: true,
    sortValue: (row) => row.avg7DayConsumption,
    render: (row) => `<span class="font-semibold text-slate-700">${escapeHtml(formatQty(row.avg7DayConsumption, row.unit))}</span>`,
  },
  {
    key: 'skuDetail',
    title: 'SKU明细',
    width: 160,
    actionColumn: true,
    render: (row) =>
      `<span data-${EVENT_PREFIX}-spu="${escapeHtml(row.spu)}">${renderSecondaryButton(
        `查看SKU明细（${row.skus.length}）`,
        { prefix: EVENT_PREFIX, action: 'open-sku-detail', skipPageRerender: true },
      )}</span>`,
  },
]

const preferences: StandardListColumnPreferences = {
  order: columns.map((column) => column.key),
  visibleKeys: columns.map((column) => column.key),
  frozenKeys: [],
  pageSize: DEFAULT_PAGE_SIZE,
}

function filteredRows(): GarmentInventorySpuRow[] {
  const keyword = state.keyword.trim().toLowerCase()
  let rows = garmentInventorySeed
  if (state.seaMark === 'marked') rows = rows.filter((row) => row.seaMark)
  else if (state.seaMark === 'unmarked') rows = rows.filter((row) => !row.seaMark)
  if (keyword) {
    rows = rows.filter((row) =>
      `${row.spu} ${row.name} ${row.skus.map((sku) => sku.sku).join(' ')}`.toLowerCase().includes(keyword),
    )
  }
  return rows
}

function renderFilters(): string {
  const options: Array<{ value: SeaMarkFilter; label: string }> = [
    { value: '', label: '请选择' },
    { value: 'marked', label: '有标记' },
    { value: 'unmarked', label: '没标记' },
  ]
  return `<div class="rounded-lg border bg-white p-3">
    <div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
      <label class="sm:col-span-2">
        <span class="mb-1 block text-xs text-muted-foreground">SPU/SKU 关键词</span>
        <input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.keyword)}" placeholder="SPU / SKU" data-${EVENT_PREFIX}-field="keyword">
      </label>
      <label>
        <span class="mb-1 block text-xs text-muted-foreground">海运标记</span>
        <select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="sea-mark">
          ${options.map((option) => `<option value="${option.value}" ${state.seaMark === option.value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}
        </select>
      </label>
    </div>
    <div class="mt-3 flex w-full flex-wrap items-center gap-2">
      ${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'query', skipPageRerender: true }, 'search')}
      ${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset', skipPageRerender: true }, 'rotate-ccw')}
    </div>
  </div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
}

function renderWorkspace(): string {
  const rows = filteredRows()
  const sorted = sortStandardListRows(rows, state.sort, (row, key) => {
    const column = columns.find((item) => item.key === key)
    return column?.sortValue?.(row)
  })
  const paging = paginateStandardListRows(sorted, state.currentPage, state.pageSize)
  state.currentPage = paging.currentPage

  return renderStandardListPage({
    title: '面料库存总览',
    filtersHtml: renderFilters(),
    listTitle: 'SPU 库存汇总',
    tableHtml: renderStandardListTable({
      columns,
      rows: paging.rows,
      preferences,
      sort: state.sort,
      eventPrefix: EVENT_PREFIX,
      emptyText: '未找到符合条件的 SPU',
    }),
    paginationHtml: renderTablePagination({
      total: paging.total,
      from: paging.from,
      to: paging.to,
      currentPage: paging.currentPage,
      totalPages: paging.totalPages,
      pageSize: paging.pageSize,
      actionPrefix: EVENT_PREFIX,
      fieldPrefix: EVENT_PREFIX,
      pageSizeOptions: [...PAGE_SIZE_OPTIONS],
    }),
  })
}

function renderSkuDetailTable(row: GarmentInventorySpuRow): string {
  const body = row.skus
    .map((sku) => {
      const total = sku.primaryQty + sku.secondaryQty + sku.transitQty
      return `<tr class="border-b last:border-b-0">
        <td class="px-3 py-2 font-mono text-xs text-slate-700">${escapeHtml(sku.sku)}</td>
        <td class="px-3 py-2 text-right text-sm text-slate-600">${escapeHtml(formatQty(sku.primaryQty, sku.unit))}</td>
        <td class="px-3 py-2 text-right text-sm text-slate-600">${escapeHtml(formatQty(sku.secondaryQty, sku.unit))}</td>
        <td class="px-3 py-2 text-right text-sm text-orange-700">${escapeHtml(formatQty(sku.transitQty, sku.unit))}</td>
        <td class="px-3 py-2 text-right text-sm font-semibold text-slate-700">${escapeHtml(formatQty(total, sku.unit))}</td>
      </tr>`
    })
    .join('')

  return `<div class="max-h-[60vh] overflow-auto rounded-md border">
    <table class="w-full min-w-[640px] border-collapse">
      <thead class="border-b bg-muted/50">
        <tr>
          <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">SKU</th>
          <th class="px-3 py-2 text-right text-xs font-medium text-muted-foreground">一级仓</th>
          <th class="px-3 py-2 text-right text-xs font-medium text-muted-foreground">二级仓</th>
          <th class="px-3 py-2 text-right text-xs font-medium text-muted-foreground">在途</th>
          <th class="px-3 py-2 text-right text-xs font-medium text-muted-foreground">合计</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
  </div>`
}

function renderOverlay(): string {
  if (!state.activeSpu) return ''
  const row = garmentInventorySeed.find((item) => item.spu === state.activeSpu)
  if (!row) return ''
  return renderDialog(
    {
      title: `SKU明细 — ${row.name}`,
      description: `${row.spu} · ${row.materialType} · 共 ${row.skus.length} 条 SKU`,
      closeAction: { prefix: EVENT_PREFIX, action: 'close-sku-detail', skipPageRerender: true },
      width: 'lg',
    },
    renderSkuDetailTable(row),
  )
}

function rootElement(): HTMLElement | null {
  return typeof document === 'undefined' ? null : document.querySelector<HTMLElement>(`[data-${EVENT_PREFIX}-root]`)
}

function refreshWorkspace(): void {
  const host = document.querySelector<HTMLElement>(`[data-${EVENT_PREFIX}-workspace]`)
  if (!host) return
  host.innerHTML = renderWorkspace()
  hydrateIcons(host)
}

function refreshOverlay(): void {
  const host = document.querySelector<HTMLElement>(`[data-${EVENT_PREFIX}-overlay]`)
  if (!host) return
  host.innerHTML = renderOverlay()
  hydrateIcons(host)
}

function ensureEscapeBinding(): void {
  if (state.escapeBound || typeof document === 'undefined') return
  state.escapeBound = true
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !state.activeSpu || !rootElement()) return
    state.activeSpu = null
    refreshOverlay()
  })
}

export function renderGarmentInventoryPage(): string {
  state.currentPage = 1
  state.sort = null
  state.activeSpu = null
  return `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true">
    <div data-${EVENT_PREFIX}-workspace>${renderWorkspace()}</div>
    <div data-${EVENT_PREFIX}-overlay>${renderOverlay()}</div>
  </div>`
}

export function handleGarmentInventoryEvent(target: HTMLElement, event?: Event): boolean {
  if (!rootElement()) return false

  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field]`)
  if (field) {
    const name = field.dataset[`${DATASET_PREFIX}Field`]
    if (name === 'keyword') {
      state.keyword = field.value
      return true
    }
    if (name === 'sea-mark') {
      state.seaMark = field.value as SeaMarkFilter
      return true
    }
    if (name === 'pageSize' && event?.type === 'change') {
      state.pageSize = Number(field.value) || DEFAULT_PAGE_SIZE
      state.currentPage = 1
      refreshWorkspace()
      return true
    }
    return true
  }

  const actionNode = target.closest<HTMLElement>(`[data-${EVENT_PREFIX}-action]`)
  const action = actionNode?.dataset[`${DATASET_PREFIX}Action`]
  if (!actionNode || !action) return false
  if (event?.type === 'change') return true

  if (action === 'query') {
    const keyword = rootElement()?.querySelector<HTMLInputElement>(`[data-${EVENT_PREFIX}-field="keyword"]`)
    if (keyword) state.keyword = keyword.value
    const select = rootElement()?.querySelector<HTMLSelectElement>(`[data-${EVENT_PREFIX}-field="sea-mark"]`)
    if (select) state.seaMark = select.value as SeaMarkFilter
    state.currentPage = 1
    refreshWorkspace()
    return true
  }
  if (action === 'reset') {
    state.keyword = ''
    state.seaMark = ''
    state.currentPage = 1
    refreshWorkspace()
    return true
  }
  if (action === 'prev-page' || action === 'next-page') {
    state.currentPage = Math.max(1, state.currentPage + (action === 'next-page' ? 1 : -1))
    refreshWorkspace()
    return true
  }
  if (action === 'sort-column') {
    const key = actionNode.dataset.columnKey || ''
    state.sort = state.sort?.key === key
      ? state.sort.direction === 'asc'
        ? { key, direction: 'desc' }
        : null
      : { key, direction: 'asc' }
    state.currentPage = 1
    refreshWorkspace()
    return true
  }
  if (action === 'open-sku-detail') {
    const spu = actionNode.closest<HTMLElement>(`[data-${EVENT_PREFIX}-spu]`)?.dataset[`${DATASET_PREFIX}Spu`] || ''
    if (!spu) return true
    state.activeSpu = spu
    ensureEscapeBinding()
    refreshOverlay()
    return true
  }
  if (action === 'close-sku-detail') {
    state.activeSpu = null
    refreshOverlay()
    return true
  }
  return false
}
