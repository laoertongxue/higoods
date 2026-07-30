// @page-pattern: list

import { renderSecondaryButton } from '../components/ui/button.ts'
import { renderStandardListPage, renderStandardListStats } from '../components/ui/list-page.ts'
import {
  clearListColumnPreferences,
  loadListColumnPreferences,
  normalizeListColumnPreferences,
  paginateStandardListRows,
  resetStandardListEntryTransientStateOnRouteEntry,
  saveListColumnPreferences,
  sortStandardListRows,
  type StandardListColumnPreferences,
  type StandardListPageSlice,
  type StandardListSortState,
} from '../components/ui/list-table-model.ts'
import {
  renderStandardListColumnSettings,
  renderStandardListTable,
  type StandardListColumn,
} from '../components/ui/list-table.ts'
import { renderTablePagination } from '../components/ui/pagination.ts'
import {
  getProjectChannelProductById,
  listProjectChannelProducts,
  type ProjectChannelProductRecord,
} from '../data/pcs-channel-product-project-repository.ts'
import {
  CHANNEL_PRODUCT_STATUS_RULES,
  resolveChannelProductBusinessStatus,
} from '../data/pcs-product-lifecycle-governance.ts'
import { escapeHtml, formatDateTime, toClassName } from '../utils.ts'

const PREFERRED_PROJECT_ORDER = [
  'PRJ-202603-002',
  'PRJ-202603-003',
  'PRJ-202603-004',
  'PRJ-202603-005',
  'PRJ-202603-008',
  'PRJ-202603-010',
  'PRJ-202603-011',
  'PRJ-202603-012',
  'PRJ-202603-013',
]

interface ChannelStoreSpuRow {
  rowKey: string
  channelCode: string
  channelName: string
  storeId: string
  storeName: string
  spuCode: string
  records: ProjectChannelProductRecord[]
  currentRecord: ProjectChannelProductRecord
  specLineCount: number
  uploadedSpecLineCount: number
  stockQty: number
}

interface ChannelProductListState {
  search: string
  channel: string
  status: string
  currentPage: number
}

const CHANNEL_PRODUCT_LIST_STORAGE_KEY = 'higood:list-page:/pcs/products/channel-products'
const CHANNEL_PRODUCT_LIST_PAGE_SIZES = [10, 20, 50]
const CHANNEL_PRODUCT_LIST_MAX_FROZEN_WIDTH = 520
const CHANNEL_PRODUCT_LIST_COLUMN_RULES = [
  { key: 'cover' },
  { key: 'spu', required: true, freezeable: true },
  { key: 'channelStore', freezeable: true },
  { key: 'title' },
  { key: 'upstreamId' },
  { key: 'inventory' },
  { key: 'price' },
  { key: 'status', required: true, freezeable: true },
  { key: 'linkage' },
  { key: 'updated', freezeable: true },
  { key: 'actions', required: true, actionColumn: true },
]

const channelProductListState: ChannelProductListState = {
  search: '',
  channel: '全部渠道',
  status: '全部状态',
  currentPage: 1,
}

const channelProductListUiState: {
  sort: StandardListSortState | null
  preferences: StandardListColumnPreferences
  columnSettingsOpen: boolean
  draggedColumnKey: string
  preferencesLoaded: boolean
} = {
  sort: null,
  preferences: normalizeListColumnPreferences(
    CHANNEL_PRODUCT_LIST_COLUMN_RULES,
    {
      order: CHANNEL_PRODUCT_LIST_COLUMN_RULES.map((item) => item.key),
      visibleKeys: CHANNEL_PRODUCT_LIST_COLUMN_RULES.map((item) => item.key),
      frozenKeys: [],
      pageSize: CHANNEL_PRODUCT_LIST_PAGE_SIZES[0]!,
    },
    CHANNEL_PRODUCT_LIST_PAGE_SIZES,
  ),
  columnSettingsOpen: false,
  draggedColumnKey: '',
  preferencesLoaded: false,
}

function resolveSpuCode(record: ProjectChannelProductRecord): string {
  return (
    record.upstreamProductId ||
    record.upstreamChannelProductCode ||
    record.styleCode ||
    record.channelProductCode ||
    '-'
  )
}

function buildChannelStoreSpuRows(records: ProjectChannelProductRecord[]): ChannelStoreSpuRow[] {
  const rowMap = new Map<string, ProjectChannelProductRecord[]>()
  records.forEach((record) => {
    const rowKey = [record.channelCode, record.storeId, resolveSpuCode(record)].join('::')
    rowMap.set(rowKey, [...(rowMap.get(rowKey) || []), record])
  })

  return Array.from(rowMap.entries()).map(([rowKey, rowRecords]) => {
    const sortedRecords = rowRecords.slice().sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    const currentRecord =
      sortedRecords.find((item) => item.channelProductStatus !== '已作废') ||
      sortedRecords[0]
    return {
      rowKey,
      channelCode: currentRecord.channelCode,
      channelName: currentRecord.channelName || getChannelLabel(currentRecord.channelCode),
      storeId: currentRecord.storeId,
      storeName: getStoreLabel(currentRecord),
      spuCode: resolveSpuCode(currentRecord),
      records: sortedRecords,
      currentRecord,
      specLineCount: sortedRecords.reduce((total, item) => total + (item.specLineCount || item.specLines.length || 0), 0),
      uploadedSpecLineCount: sortedRecords.reduce((total, item) => total + (item.uploadedSpecLineCount || 0), 0),
      stockQty: currentRecord.specLines.reduce((total, line) => total + (Number(line.stockQty) || 0), 0),
    }
  })
}

function listDisplayRows(): ChannelStoreSpuRow[] {
  const priority = new Map(PREFERRED_PROJECT_ORDER.map((code, index) => [code, index]))
  return buildChannelStoreSpuRows(listProjectChannelProducts()).sort((left, right) => {
    const leftPriority = priority.get(left.currentRecord.projectCode) ?? Number.MAX_SAFE_INTEGER
    const rightPriority = priority.get(right.currentRecord.projectCode) ?? Number.MAX_SAFE_INTEGER
    if (leftPriority !== rightPriority) return leftPriority - rightPriority
    return right.currentRecord.updatedAt.localeCompare(left.currentRecord.updatedAt)
  })
}

function getChannelLabel(channelCode: string): string {
  if (channelCode === 'shopee') return '虾皮'
  if (channelCode === 'independent-site') return '独立站'
  return 'TikTok'
}

function getStoreLabel(record: ProjectChannelProductRecord): string {
  return record.storeName || '-'
}

function getViewLabel(record: ProjectChannelProductRecord): string {
  return CHANNEL_PRODUCT_STATUS_RULES[resolveChannelProductBusinessStatus(record)].label
}

function getLinkageDescription(record: ProjectChannelProductRecord): string {
  if (record.channelProductStatus === '已作废') {
    return record.testingStatusText || record.invalidatedReason || record.upstreamSyncNote || '当前款式上架批次已作废'
  }
  if (record.styleCode && record.upstreamSyncStatus === '已更新') {
    return '测款通过，已关联款式档案并完成上游最终更新'
  }
  if (record.styleCode && record.upstreamSyncStatus === '待更新') {
    return '测款通过，已生成款式档案，待启用技术包'
  }
  if (record.channelProductStatus === '已上架待测款') {
    return '已完成上架，等待直播或短视频正式测款'
  }
  return record.upstreamSyncNote || record.testingStatusText || '-'
}

function renderBadge(text: string, className: string): string {
  return `<span class="${escapeHtml(toClassName('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', className))}">${escapeHtml(text)}</span>`
}

function renderBusinessStatusBadge(record: ProjectChannelProductRecord): string {
  const rule = CHANNEL_PRODUCT_STATUS_RULES[resolveChannelProductBusinessStatus(record)]
  return renderBadge(rule.label, rule.className)
}

function renderDateTimeCell(value: string): string {
  const formatted = formatDateTime(value)
  if (formatted === '-') return '-'
  const [dateText, timeText] = formatted.split(' ')
  return `
    <div class="text-sm text-slate-500">
      <div>${escapeHtml(dateText || '-')}</div>
      <div class="mt-0.5">${escapeHtml(timeText || '')}</div>
    </div>
  `
}

function getListingMainImage(record: ProjectChannelProductRecord): {
  url: string
  title: string
} | null {
  const mainImage =
    record.listingImages.find((item) => item.imageId === record.listingMainImageId) ||
    record.listingImages[0] ||
    null
  if (mainImage) {
    return {
      url: mainImage.imageUrl,
      title: mainImage.imageName,
    }
  }
  if (record.mainImageUrls[0]) {
    return {
      url: record.mainImageUrls[0],
      title: '上架主图',
    }
  }
  return null
}

const CHANNEL_PRODUCT_LIST_COLUMNS: StandardListColumn<ChannelStoreSpuRow>[] = [
  {
    key: 'cover',
    title: '商品图片',
    width: 92,
    render: (row) => {
      const record = row.currentRecord
      const detailHref = `/pcs/products/channel-products/${encodeURIComponent(record.channelProductId)}`
      const mainImage = getListingMainImage(record)
      return mainImage
        ? `<button type="button" class="group block h-14 w-14 overflow-hidden rounded-md border border-slate-200 bg-slate-50" data-nav="${escapeHtml(detailHref)}"><img src="${escapeHtml(mainImage.url)}" alt="${escapeHtml(mainImage.title)}" class="h-full w-full object-cover transition group-hover:scale-105" /></button>`
        : '<div class="flex h-14 w-14 items-center justify-center rounded-md border border-dashed border-slate-200 text-[11px] text-slate-400">暂无图片</div>'
    },
  },
  {
    key: 'spu',
    title: 'SPU / 来源',
    width: 230,
    required: true,
    freezeable: true,
    sortable: true,
    render: (row) => {
      const record = row.currentRecord
      return `
        <button type="button" class="text-left text-sm font-semibold text-blue-700 hover:underline" data-nav="/pcs/products/channel-products/${encodeURIComponent(record.channelProductId)}">${escapeHtml(row.spuCode)}</button>
        <div class="mt-1 text-xs text-slate-500">上架批次：${escapeHtml(record.listingBatchCode || record.channelProductCode)}</div>
        <button type="button" class="mt-1 text-left text-xs font-medium text-blue-700 hover:underline" data-nav="/pcs/projects/${encodeURIComponent(record.projectId)}">${escapeHtml(record.projectCode)}</button>
      `
    },
    sortValue: (row) => row.spuCode,
  },
  {
    key: 'channelStore',
    title: '渠道 / 店铺',
    width: 220,
    freezeable: true,
    sortable: true,
    render: (row) => `
      <div class="font-medium text-slate-900">${escapeHtml(`${getChannelLabel(row.channelCode)} / ${row.storeName}`)}</div>
      <div class="mt-1 text-xs text-slate-500">${escapeHtml(row.currentRecord.channelName || row.channelName)}</div>
    `,
    sortValue: (row) => `${row.channelName}|${row.storeName}`,
  },
  {
    key: 'title',
    title: '商品标题',
    width: 270,
    render: (row) => `<div class="line-clamp-2 leading-6">${escapeHtml(row.currentRecord.styleListingTitle || row.currentRecord.listingTitle || '-')}</div>`,
  },
  {
    key: 'upstreamId',
    title: '平台商品 ID',
    width: 170,
    sortable: true,
    render: (row) => escapeHtml(row.currentRecord.upstreamProductId || row.currentRecord.upstreamChannelProductCode || '-'),
    sortValue: (row) => row.currentRecord.upstreamProductId || row.currentRecord.upstreamChannelProductCode || '',
  },
  {
    key: 'inventory',
    title: '库存 / SKU',
    width: 170,
    sortable: true,
    render: (row) => `
      <div class="font-medium text-slate-900">${escapeHtml(String(row.stockQty))}</div>
      <div class="mt-1 text-xs text-slate-500">规格 ${escapeHtml(String(row.specLineCount))} 条 / 已上传 ${escapeHtml(String(row.uploadedSpecLineCount))} 条</div>
    `,
    sortValue: (row) => row.stockQty,
  },
  {
    key: 'price',
    title: '默认售价',
    width: 150,
    sortable: true,
    render: (row) => {
      const record = row.currentRecord
      return `
        <div class="font-medium text-slate-900">${escapeHtml(`${record.defaultPriceAmount || record.listingPrice || '-'} ${record.currencyCode || record.currency || ''}`.trim())}</div>
        <div class="mt-1 text-xs text-slate-500">默认售价</div>
      `
    },
    sortValue: (row) => Number(row.currentRecord.defaultPriceAmount || row.currentRecord.listingPrice || 0),
  },
  {
    key: 'status',
    title: '业务状态',
    width: 140,
    required: true,
    freezeable: true,
    sortable: true,
    render: (row) => renderBusinessStatusBadge(row.currentRecord),
    sortValue: (row) => getViewLabel(row.currentRecord),
  },
  {
    key: 'linkage',
    title: '链路状态',
    width: 260,
    render: (row) => `<div class="line-clamp-3 text-xs leading-5 text-slate-500">${escapeHtml(getLinkageDescription(row.currentRecord))}</div>`,
  },
  {
    key: 'updated',
    title: '最近更新',
    width: 150,
    freezeable: true,
    sortable: true,
    render: (row) => renderDateTimeCell(row.currentRecord.updatedAt),
    sortValue: (row) => row.currentRecord.updatedAt,
  },
  {
    key: 'actions',
    title: '操作',
    width: 108,
    required: true,
    actionColumn: true,
    align: 'right',
    render: (row) => `
      <div class="flex flex-col items-end gap-2">
        <button type="button" class="inline-flex h-7 items-center rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-700 hover:bg-slate-50" data-nav="/pcs/products/channel-products/${encodeURIComponent(row.currentRecord.channelProductId)}">详情</button>
        <button type="button" class="inline-flex h-7 items-center rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-700 hover:bg-slate-50" data-nav="/pcs/projects/${encodeURIComponent(row.currentRecord.projectId)}">项目</button>
      </div>
    `,
  },
]

function getChannelProductListStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

function normalizeChannelProductListPreferences(
  raw: Partial<StandardListColumnPreferences> | null | undefined,
): StandardListColumnPreferences {
  const normalized = normalizeListColumnPreferences(
    CHANNEL_PRODUCT_LIST_COLUMN_RULES,
    raw,
    CHANNEL_PRODUCT_LIST_PAGE_SIZES,
  )
  const columnsByKey = new Map(CHANNEL_PRODUCT_LIST_COLUMNS.map((column) => [column.key, column]))
  const visibleKeys = new Set(normalized.visibleKeys)
  const requestedFrozen = new Set(normalized.frozenKeys)
  const frozen = normalized.order
    .map((key) => columnsByKey.get(key))
    .filter((column): column is StandardListColumn<ChannelStoreSpuRow> => Boolean(
      column && column.freezeable && !column.actionColumn && visibleKeys.has(column.key) && requestedFrozen.has(column.key),
    ))
  let width = frozen.reduce((sum, column) => sum + Math.max(column.width, column.minWidth ?? 0), 0)
  while (width > CHANNEL_PRODUCT_LIST_MAX_FROZEN_WIDTH && frozen.length > 0) {
    const removed = frozen.pop()
    if (removed) width -= Math.max(removed.width, removed.minWidth ?? 0)
  }
  return { ...normalized, frozenKeys: frozen.map((column) => column.key) }
}

function ensureChannelProductListPreferences(): void {
  if (channelProductListUiState.preferencesLoaded) return
  channelProductListUiState.preferencesLoaded = true
  const storage = getChannelProductListStorage()
  channelProductListUiState.preferences = storage
    ? loadListColumnPreferences(
        storage,
        CHANNEL_PRODUCT_LIST_STORAGE_KEY,
        CHANNEL_PRODUCT_LIST_COLUMN_RULES,
        channelProductListUiState.preferences,
        CHANNEL_PRODUCT_LIST_PAGE_SIZES,
      )
    : channelProductListUiState.preferences
  channelProductListUiState.preferences = normalizeChannelProductListPreferences(
    channelProductListUiState.preferences,
  )
}

function saveChannelProductListPreferences(): void {
  const storage = getChannelProductListStorage()
  if (storage) {
    saveListColumnPreferences(
      storage,
      CHANNEL_PRODUCT_LIST_STORAGE_KEY,
      channelProductListUiState.preferences,
    )
  }
}

function withChannelProductLocalInteractions(html: string): string {
  return html
    .replace(/data-pcs-channel-product-list-action="([^"]+)"/g, (attribute) =>
      `data-skip-page-rerender="true" data-pcs-channel-product-list-root="true" ${attribute}`)
    .replace(/data-pcs-channel-product-list-field="([^"]+)"/g, (attribute) =>
      `data-skip-page-rerender="true" data-pcs-channel-product-list-root="true" ${attribute}`)
}

function getFilteredChannelProductRows(): ChannelStoreSpuRow[] {
  const keyword = channelProductListState.search.trim().toLowerCase()
  return listDisplayRows().filter((row) => {
    if (channelProductListState.channel !== '全部渠道' && row.channelName !== channelProductListState.channel) return false
    if (channelProductListState.status !== '全部状态' && getViewLabel(row.currentRecord) !== channelProductListState.status) return false
    if (!keyword) return true
    const record = row.currentRecord
    return [
      row.spuCode,
      row.channelName,
      row.storeName,
      record.projectCode,
      record.projectName,
      record.styleListingTitle,
      record.listingTitle,
      record.upstreamProductId,
      record.upstreamChannelProductCode,
    ].join('|').toLowerCase().includes(keyword)
  })
}

function getChannelProductListView(): StandardListPageSlice<ChannelStoreSpuRow> {
  ensureChannelProductListPreferences()
  const sortedRows = sortStandardListRows(
    getFilteredChannelProductRows(),
    channelProductListUiState.sort,
    (row, key) => CHANNEL_PRODUCT_LIST_COLUMNS.find((column) => column.key === key)?.sortValue?.(row),
  )
  const paging = paginateStandardListRows(
    sortedRows,
    channelProductListState.currentPage,
    channelProductListUiState.preferences.pageSize,
  )
  channelProductListState.currentPage = paging.currentPage
  return paging
}

function renderChannelProductListFilters(): string {
  const allRows = listDisplayRows()
  const channels = ['全部渠道', ...Array.from(new Set(allRows.map((row) => row.channelName))).sort()]
  const statuses = ['全部状态', ...Array.from(new Set(allRows.map((row) => getViewLabel(row.currentRecord)))).sort()]
  return `
    <section class="rounded-lg border bg-white p-4">
      <div class="grid gap-3 md:grid-cols-3">
        <label class="space-y-1">
          <span class="text-xs text-slate-500">搜索商品</span>
          <input class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="搜索 SPU、标题、项目或平台商品 ID" value="${escapeHtml(channelProductListState.search)}" data-pcs-channel-product-list-field="search" />
        </label>
        <label class="space-y-1">
          <span class="text-xs text-slate-500">渠道</span>
          <select class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm" data-pcs-channel-product-list-field="channel">
            ${channels.map((channel) => `<option value="${escapeHtml(channel)}" ${channelProductListState.channel === channel ? 'selected' : ''}>${escapeHtml(channel)}</option>`).join('')}
          </select>
        </label>
        <label class="space-y-1">
          <span class="text-xs text-slate-500">业务状态</span>
          <select class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm" data-pcs-channel-product-list-field="status">
            ${statuses.map((status) => `<option value="${escapeHtml(status)}" ${channelProductListState.status === status ? 'selected' : ''}>${escapeHtml(status)}</option>`).join('')}
          </select>
        </label>
      </div>
    </section>
  `
}

function renderChannelProductListTable(
  paging: StandardListPageSlice<ChannelStoreSpuRow>,
): string {
  return withChannelProductLocalInteractions(renderStandardListTable({
    columns: CHANNEL_PRODUCT_LIST_COLUMNS,
    rows: paging.rows,
    preferences: channelProductListUiState.preferences,
    sort: channelProductListUiState.sort,
    eventPrefix: 'pcs-channel-product-list',
    emptyText: '暂无符合条件的渠道店铺商品',
  }))
}

function renderChannelProductListPagination(
  paging: StandardListPageSlice<ChannelStoreSpuRow>,
): string {
  return withChannelProductLocalInteractions(renderTablePagination({
    total: paging.total,
    from: paging.from,
    to: paging.to,
    currentPage: paging.currentPage,
    totalPages: paging.totalPages,
    pageSize: paging.pageSize,
    actionPrefix: 'pcs-channel-product-list',
    fieldPrefix: 'pcs-channel-product-list',
    pageSizeOptions: CHANNEL_PRODUCT_LIST_PAGE_SIZES,
  }))
}

function renderChannelProductColumnSettings(): string {
  if (!channelProductListUiState.columnSettingsOpen) return ''
  return withChannelProductLocalInteractions(renderStandardListColumnSettings({
    title: '列设置',
    columns: CHANNEL_PRODUCT_LIST_COLUMNS,
    preferences: channelProductListUiState.preferences,
    eventPrefix: 'pcs-channel-product-list',
    maxFrozenWidth: CHANNEL_PRODUCT_LIST_MAX_FROZEN_WIDTH,
  }))
}

function refreshChannelProductListRegions(options: { filters?: boolean; settings?: boolean } = {}): void {
  if (typeof document === 'undefined') return
  const paging = getChannelProductListView()
  const tableHost = document.querySelector<HTMLElement>('[data-pcs-channel-product-list-region="table"]')
  const paginationHost = document.querySelector<HTMLElement>('[data-pcs-channel-product-list-region="pagination"]')
  if (tableHost) tableHost.innerHTML = renderChannelProductListTable(paging)
  if (paginationHost) paginationHost.innerHTML = renderChannelProductListPagination(paging)
  if (options.filters) {
    const filtersHost = document.querySelector<HTMLElement>('[data-pcs-channel-product-list-region="filters"]')
    if (filtersHost) filtersHost.innerHTML = withChannelProductLocalInteractions(renderChannelProductListFilters())
  }
  if (options.settings) {
    const settingsHost = document.querySelector<HTMLElement>('[data-pcs-channel-product-list-region="column-settings"]')
    if (settingsHost) settingsHost.innerHTML = renderChannelProductColumnSettings()
  }
}

function renderDetailField(label: string, value: string): string {
  return `
    <div class="flex items-start justify-between gap-4 text-sm">
      <span class="text-slate-500">${escapeHtml(label)}</span>
      <span class="text-right font-semibold text-slate-900">${escapeHtml(value || '-')}</span>
    </div>
  `
}

function renderDetailButton(label: string, href: string | null): string {
  if (!href) {
    return `<button type="button" class="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-300" disabled>${escapeHtml(label)}</button>`
  }
  return `<button type="button" class="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50" data-nav="${escapeHtml(href)}">${escapeHtml(label)}</button>`
}

function renderSpecLineRows(record: ProjectChannelProductRecord): string {
  if (!record.specLines.length) {
    return '<tr><td colspan="9" class="px-3 py-4 text-center text-xs text-slate-400">暂无规格明细</td></tr>'
  }
  return record.specLines
    .map(
      (line) => `
        <tr>
          <td class="px-3 py-2 text-slate-700">${escapeHtml(line.colorName || '-')}</td>
          <td class="px-3 py-2 text-slate-700">${escapeHtml(line.sizeName || '-')}</td>
          <td class="px-3 py-2 text-slate-700">${escapeHtml(line.printName || '-')}</td>
          <td class="px-3 py-2 text-slate-700">${escapeHtml(line.sellerSku || line.specLineCode || '-')}</td>
          <td class="px-3 py-2 text-slate-700">${escapeHtml(String(line.priceAmount || '-'))}</td>
          <td class="px-3 py-2 text-slate-700">${escapeHtml(line.currencyCode || '-')}</td>
          <td class="px-3 py-2 text-slate-700">${escapeHtml(line.stockQty ? String(line.stockQty) : '-')}</td>
          <td class="px-3 py-2 text-slate-700">${escapeHtml(line.upstreamSkuId || '-')}</td>
          <td class="px-3 py-2 text-slate-700">${escapeHtml(line.lineStatus || '-')}</td>
        </tr>
      `,
    )
    .join('')
}

export function renderPcsChannelProductListPage(): string {
  ensureChannelProductListPreferences()
  const transient = {
    currentPage: channelProductListState.currentPage,
    sort: channelProductListUiState.sort,
  }
  const hasMountedRoot = typeof document !== 'undefined'
    && Boolean(document.querySelector('[data-pcs-channel-product-list-page]'))
  resetStandardListEntryTransientStateOnRouteEntry(transient, hasMountedRoot)
  channelProductListState.currentPage = transient.currentPage
  channelProductListUiState.sort = transient.sort

  const allRows = listDisplayRows()
  const paging = getChannelProductListView()
  const page = renderStandardListPage({
    title: '渠道店铺商品',
    filtersHtml: `<div data-pcs-channel-product-list-region="filters">${withChannelProductLocalInteractions(renderChannelProductListFilters())}</div>`,
    statsHtml: renderStandardListStats([
      { label: '渠道商品', value: allRows.length },
      { label: '已上架待测款', value: allRows.filter((row) => getViewLabel(row.currentRecord) === '已上架待测款').length },
      { label: '已生效', value: allRows.filter((row) => getViewLabel(row.currentRecord) === '已生效').length },
      { label: '已作废', value: allRows.filter((row) => getViewLabel(row.currentRecord) === '已作废').length },
    ]),
    listTitle: '商品列表',
    listActionsHtml: withChannelProductLocalInteractions(
      renderSecondaryButton(
        '列设置',
        { prefix: 'pcs-channel-product-list', action: 'open-column-settings' },
        'settings-2',
      ),
    ),
    tableHtml: `<div data-pcs-channel-product-list-region="table">${renderChannelProductListTable(paging)}</div>`,
    paginationHtml: `<div data-table-pagination data-pcs-channel-product-list-region="pagination">${renderChannelProductListPagination(paging)}</div>`,
    overlaysHtml: `<div data-pcs-channel-product-list-region="column-settings">${renderChannelProductColumnSettings()}</div>`,
    className: 'min-w-0 max-w-full',
  })
  return `<div class="min-w-0 max-w-full" data-pcs-channel-product-list-page>${page}</div>`
}

export function handlePcsChannelProductListInput(target: Element): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-pcs-channel-product-list-field]')
  if (!fieldNode) return false
  const field = fieldNode.dataset.pcsChannelProductListField
  if (!field) return false

  if (field === 'pageSize' && fieldNode instanceof HTMLSelectElement) {
    channelProductListUiState.preferences = normalizeChannelProductListPreferences({
      ...channelProductListUiState.preferences,
      pageSize: Number(fieldNode.value),
    })
    channelProductListState.currentPage = 1
    saveChannelProductListPreferences()
    refreshChannelProductListRegions()
    return true
  }
  if (field === 'search' && fieldNode instanceof HTMLInputElement) {
    channelProductListState.search = fieldNode.value
  } else if (field === 'channel' && fieldNode instanceof HTMLSelectElement) {
    channelProductListState.channel = fieldNode.value
  } else if (field === 'status' && fieldNode instanceof HTMLSelectElement) {
    channelProductListState.status = fieldNode.value
  } else {
    return false
  }
  channelProductListState.currentPage = 1
  refreshChannelProductListRegions()
  return true
}

export function handlePcsChannelProductListEvent(target: HTMLElement, event?: Event): boolean {
  const dragNode = target.closest<HTMLElement>('[data-standard-list-column-drag]')
  if (dragNode && event && ['dragstart', 'dragover', 'drop', 'dragend'].includes(event.type)) {
    const columnKey = dragNode.dataset.pcsChannelProductListColumnKey
      || dragNode.dataset.dragSource
      || dragNode.dataset.dropTarget
      || ''
    if (event.type === 'dragstart') {
      channelProductListUiState.draggedColumnKey = columnKey
      ;(event as DragEvent).dataTransfer?.setData('application/x-higood-list-column-key', columnKey)
      return Boolean(columnKey)
    }
    if (event.type === 'dragend') {
      channelProductListUiState.draggedColumnKey = ''
      return true
    }
    const sourceKey = channelProductListUiState.draggedColumnKey
    if (!sourceKey || !columnKey || sourceKey === columnKey) return false
    if (event.type === 'dragover') {
      event.preventDefault()
      return true
    }
    event.preventDefault()
    const order = channelProductListUiState.preferences.order.filter((key) => key !== sourceKey)
    const targetIndex = order.indexOf(columnKey)
    if (targetIndex < 0) return false
    order.splice(targetIndex, 0, sourceKey)
    channelProductListUiState.preferences = normalizeChannelProductListPreferences({
      ...channelProductListUiState.preferences,
      order,
    })
    channelProductListUiState.draggedColumnKey = ''
    saveChannelProductListPreferences()
    refreshChannelProductListRegions({ settings: true })
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-pcs-channel-product-list-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.pcsChannelProductListAction
  if (!action) return false

  if (action === 'sort-column') {
    const columnKey = actionNode.dataset.columnKey || ''
    const column = CHANNEL_PRODUCT_LIST_COLUMNS.find((item) => item.key === columnKey && item.sortable)
    if (!column) return true
    const currentSort = channelProductListUiState.sort
    channelProductListUiState.sort = currentSort?.key !== columnKey
      ? { key: columnKey, direction: 'asc' }
      : currentSort.direction === 'asc'
        ? { key: columnKey, direction: 'desc' }
        : null
    channelProductListState.currentPage = 1
    refreshChannelProductListRegions()
    return true
  }
  if (action === 'prev-page' || action === 'next-page') {
    const totalPages = Math.max(
      1,
      Math.ceil(getFilteredChannelProductRows().length / channelProductListUiState.preferences.pageSize),
    )
    channelProductListState.currentPage = action === 'prev-page'
      ? Math.max(1, channelProductListState.currentPage - 1)
      : Math.min(totalPages, channelProductListState.currentPage + 1)
    refreshChannelProductListRegions()
    return true
  }
  if (action === 'open-column-settings' || action === 'close-column-settings') {
    channelProductListUiState.columnSettingsOpen = action === 'open-column-settings'
    refreshChannelProductListRegions({ settings: true })
    return true
  }
  if (action === 'restore-column-settings') {
    channelProductListUiState.preferences = normalizeChannelProductListPreferences({
      order: CHANNEL_PRODUCT_LIST_COLUMNS.map((column) => column.key),
      visibleKeys: CHANNEL_PRODUCT_LIST_COLUMNS.map((column) => column.key),
      frozenKeys: [],
      pageSize: CHANNEL_PRODUCT_LIST_PAGE_SIZES[0],
    })
    channelProductListUiState.sort = null
    channelProductListState.currentPage = 1
    const storage = getChannelProductListStorage()
    if (storage) clearListColumnPreferences(storage, CHANNEL_PRODUCT_LIST_STORAGE_KEY)
    refreshChannelProductListRegions({ settings: true })
    return true
  }
  if (
    (action === 'toggle-column-visibility' || action === 'toggle-column-freeze')
    && (!event || event.type === 'change')
  ) {
    const columnKey = actionNode.dataset.pcsChannelProductListColumnKey
      || actionNode.dataset.columnKey
      || ''
    const column = CHANNEL_PRODUCT_LIST_COLUMNS.find((item) => item.key === columnKey)
    if (!column || column.actionColumn) return true
    const visibleKeys = new Set(channelProductListUiState.preferences.visibleKeys)
    const frozenKeys = new Set(channelProductListUiState.preferences.frozenKeys)
    if (action === 'toggle-column-visibility' && !column.required) {
      if (visibleKeys.has(columnKey)) {
        visibleKeys.delete(columnKey)
        frozenKeys.delete(columnKey)
      } else {
        visibleKeys.add(columnKey)
      }
      if (!visibleKeys.has(columnKey) && channelProductListUiState.sort?.key === columnKey) {
        channelProductListUiState.sort = null
      }
    }
    if (action === 'toggle-column-freeze' && column.freezeable) {
      if (frozenKeys.has(columnKey)) frozenKeys.delete(columnKey)
      else frozenKeys.add(columnKey)
    }
    channelProductListUiState.preferences = normalizeChannelProductListPreferences({
      ...channelProductListUiState.preferences,
      visibleKeys: [...visibleKeys],
      frozenKeys: [...frozenKeys],
    })
    saveChannelProductListPreferences()
    refreshChannelProductListRegions({ settings: true })
    return true
  }
  return false
}

export function isPcsChannelProductListDialogOpen(): boolean {
  return channelProductListUiState.columnSettingsOpen
}

export function renderPcsChannelProductDetailPage(channelProductId: string): string {
  const record = getProjectChannelProductById(channelProductId)

  if (!record) {
    return `
      <div class="p-4">
        <section class="rounded-[20px] border border-slate-200 bg-white px-6 py-8 shadow-sm">
          <h1 class="text-2xl font-semibold text-slate-900">未找到渠道店铺商品</h1>
          <p class="mt-3 text-sm text-slate-500">请返回列表重新选择。</p>
          <button type="button" class="mt-6 inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50" data-nav="/pcs/products/channel-products">
            返回列表
          </button>
        </section>
      </div>
    `
  }

  const projectHref = `/pcs/projects/${encodeURIComponent(record.projectId)}`
  const styleHref = record.styleId ? `/pcs/products/styles/${encodeURIComponent(record.styleId)}` : null
  const completedUpstreamUpdate = record.upstreamSyncStatus === '已更新'
  const upstreamUpdateTime = record.lastUpstreamSyncAt || (completedUpstreamUpdate ? record.updatedAt : '')
  const currentRule = CHANNEL_PRODUCT_STATUS_RULES[resolveChannelProductBusinessStatus(record)]
  const listingImages = record.listingImages
    .slice()
    .sort((left, right) => left.sortNo - right.sortNo)

  return `
    <div class="p-4">
      <div class="space-y-4">
        <section class="rounded-[20px] border border-slate-200 bg-white px-4 py-4 shadow-sm">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div>
              <button type="button" class="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50" data-nav="/pcs/products/channel-products">
                <i data-lucide="arrow-left" class="h-4 w-4"></i>返回列表
              </button>
              <div class="mt-3 text-xs text-slate-500">商品档案 / 渠道店铺商品</div>
              <div class="mt-2 flex flex-wrap items-center gap-2">
                <h1 class="text-[20px] font-semibold text-slate-900">${escapeHtml(resolveSpuCode(record))}</h1>
                ${renderBusinessStatusBadge(record)}
              </div>
              <div class="mt-2 text-sm text-slate-500">${escapeHtml(`${getChannelLabel(record.channelCode)} / ${getStoreLabel(record)} ｜ ${record.styleListingTitle || record.listingTitle || '-'}`)}</div>
            </div>
            <div class="flex flex-wrap items-center gap-3">
              ${renderDetailButton('查看来源项目', projectHref)}
              ${renderDetailButton('查看款式档案', styleHref)}
            </div>
          </div>
        </section>

        <div class="grid gap-4 xl:grid-cols-3">
          <section class="rounded-xl border border-slate-200 bg-white px-4 py-4">
            <h2 class="text-base font-semibold text-slate-900">来源与上架信息</h2>
            <div class="mt-4 space-y-3">
              ${renderDetailField('来源项目', record.projectCode)}
              ${renderDetailField('项目名称', record.projectName)}
              ${renderDetailField('SPU / 平台商品 ID', resolveSpuCode(record))}
              ${renderDetailField('来源商品上架批次', record.listingInstanceCode || record.channelProductCode)}
              ${renderDetailField('来源项目步骤', record.projectNodeId)}
              ${renderDetailField('渠道 / 店铺', `${getChannelLabel(record.channelCode)} / ${getStoreLabel(record)}`)}
              ${renderDetailField('上架标题', record.styleListingTitle || record.listingTitle || '—')}
              ${renderDetailField('默认售价 / 币种', `${record.defaultPriceAmount || record.listingPrice || '—'} / ${record.currencyCode || record.currency || '—'}`)}
            </div>
          </section>

          <section class="rounded-xl border border-slate-200 bg-white px-4 py-4">
            <h2 class="text-base font-semibold text-slate-900">规格上传结果</h2>
            <div class="mt-4 space-y-3">
              ${renderDetailField('规格数量', String(record.specLineCount || record.specLines.length || 0))}
              ${renderDetailField('已上传规格数量', String(record.uploadedSpecLineCount || 0))}
              ${renderDetailField('上架批次状态', record.listingBatchStatus || record.channelProductStatus)}
              ${renderDetailField('上游款式商品编号', record.upstreamProductId || record.upstreamChannelProductCode || '—')}
              ${renderDetailField('上传结果', record.uploadResultText || '—')}
              ${renderDetailField('上传时间', record.uploadedAt ? formatDateTime(record.uploadedAt) : '—')}
            </div>
          </section>

          <section class="rounded-xl border border-slate-200 bg-white px-4 py-4">
            <h2 class="text-base font-semibold text-slate-900">测款与链路状态</h2>
            <div class="mt-4 space-y-3">
              ${renderDetailField('当前测款状态', getLinkageDescription(record))}
              ${renderDetailField('渠道商品状态', record.channelProductStatus)}
              ${renderDetailField('是否已作废', record.channelProductStatus === '已作废' ? '是' : '否')}
              ${renderDetailField('作废原因', record.invalidatedReason || '—')}
              ${renderDetailField('关联改版任务', record.linkedRevisionTaskCode || '—')}
            </div>
          </section>
        </div>

        <section class="rounded-xl border border-slate-200 bg-white px-4 py-4">
          <div class="grid gap-4 xl:grid-cols-[1.3fr,1fr]">
            <div class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div class="flex flex-wrap items-center gap-2">
                ${renderBusinessStatusBadge(record)}
                <span class="text-sm text-slate-500">当前正式业务状态</span>
              </div>
              <div class="mt-3 text-sm leading-6 text-slate-700">${escapeHtml(currentRule.scene)}</div>
            </div>
            <div class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div class="text-sm font-medium text-slate-900">当前可操作项</div>
              <div class="mt-3 flex flex-wrap gap-2">
                ${currentRule.operations.map((item) => renderBadge(item, 'bg-white text-slate-700')).join('')}
              </div>
            </div>
          </div>
        </section>

        <section class="rounded-xl border border-slate-200 bg-white px-4 py-4">
          <h2 class="text-base font-semibold text-slate-900">上架图片</h2>
          <div class="mt-4">
            ${
              listingImages.length > 0
                ? `<div class="flex flex-wrap gap-3">
                    ${listingImages
                      .map(
                        (image) => `
                          <div class="w-24">
                            <div class="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                              <img src="${escapeHtml(image.imageUrl)}" alt="${escapeHtml(image.imageName)}" class="h-24 w-24 object-cover" />
                              ${image.imageId === record.listingMainImageId ? '<span class="absolute left-1 top-1 rounded bg-blue-600 px-1.5 py-0.5 text-[10px] text-white">主图</span>' : ''}
                            </div>
                            <div class="mt-1 text-[11px] text-slate-500">${escapeHtml(image.imageName)}</div>
                            <div class="text-[11px] text-slate-400">排序 ${escapeHtml(String(image.sortNo))}</div>
                          </div>
                        `,
                      )
                      .join('')}
                  </div>`
                : '<div class="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">暂无上架图片</div>'
            }
          </div>
        </section>

        <section class="rounded-xl border border-slate-200 bg-white px-4 py-4">
          <h2 class="text-base font-semibold text-slate-900">规格明细</h2>
          <div class="mt-4 overflow-x-auto">
            <table class="min-w-full text-sm">
              <thead class="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th class="px-3 py-2 font-medium">颜色</th>
                  <th class="px-3 py-2 font-medium">尺码</th>
                  <th class="px-3 py-2 font-medium">花型</th>
                  <th class="px-3 py-2 font-medium">平台销售 SKU</th>
                  <th class="px-3 py-2 font-medium">价格</th>
                  <th class="px-3 py-2 font-medium">币种</th>
                  <th class="px-3 py-2 font-medium">初始库存</th>
                  <th class="px-3 py-2 font-medium">上游规格编号</th>
                  <th class="px-3 py-2 font-medium">状态</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200 bg-white">
                ${renderSpecLineRows(record)}
              </tbody>
            </table>
          </div>
        </section>

        <section class="rounded-xl border border-slate-200 bg-white px-4 py-4">
          <h2 class="text-base font-semibold text-slate-900">上游更新日志</h2>
          <div class="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div class="text-sm font-semibold text-slate-900">${escapeHtml(record.upstreamSyncNote || record.upstreamSyncLog || '当前暂无上游更新日志。')}</div>
            <div class="mt-1.5 text-xs leading-5 text-slate-500">${escapeHtml(record.upstreamSyncLog || (upstreamUpdateTime ? `${formatDateTime(upstreamUpdateTime)} 记录当前状态。` : '尚未触发上游更新。'))}</div>
          </div>
        </section>

        <section class="rounded-xl border border-slate-200 bg-white px-4 py-4">
          <h2 class="text-base font-semibold text-slate-900">关联对象</h2>
          <div class="mt-4 grid gap-3 xl:grid-cols-4">
            <div class="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div class="text-sm text-slate-500">款式档案编码</div>
              <div class="mt-1.5 text-base font-semibold text-slate-900">${escapeHtml(record.styleCode || '—')}</div>
            </div>
            <div class="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div class="text-sm text-slate-500">渠道店铺商品编码</div>
              <div class="mt-1.5 text-base font-semibold text-slate-900">${escapeHtml(record.channelProductCode)}</div>
            </div>
            <div class="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div class="text-sm text-slate-500">上游款式商品编号</div>
              <div class="mt-1.5 text-base font-semibold text-slate-900">${escapeHtml(record.upstreamProductId || record.upstreamChannelProductCode || '—')}</div>
            </div>
            <div class="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div class="text-sm text-slate-500">最后一次上游更新时间</div>
              <div class="mt-1.5 text-base font-semibold text-slate-900">${escapeHtml(upstreamUpdateTime ? formatDateTime(upstreamUpdateTime) : '—')}</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  `
}
