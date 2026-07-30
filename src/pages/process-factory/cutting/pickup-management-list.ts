// @page-pattern: list

import { renderSecondaryButton } from '../../../components/ui/button.ts'
import {
  renderStandardListColumnSettings,
  renderStandardListTable,
  type StandardListColumn,
} from '../../../components/ui/list-table.ts'
import {
  loadListColumnPreferences,
  normalizeListColumnPreferences,
  paginateStandardListRows,
  saveListColumnPreferences,
  sortStandardListRows,
  type StandardListColumnPreferences,
  type StandardListSortState,
} from '../../../components/ui/list-table-model.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderProductionOrderIdentityCell } from '../../../data/fcs/production-order-identity.ts'
import { escapeHtml } from '../../../utils.ts'
import {
  listPickupOrderGroups,
  type PickupListKind,
  type PickupMaterialDemandRow,
  type PickupOrderGroup,
} from './pickup-management-projection.ts'

const PAGE_SIZES = [10, 20, 50]
const EVENT_PREFIX = 'pickup-list'
const PREFERENCE_KEYS: Record<PickupListKind, string> = {
  READY: 'standard-list:/fcs/craft/cutting/pickup-management/ready',
  INCOMPLETE: 'standard-list:/fcs/craft/cutting/pickup-management/incomplete',
  HISTORY: 'standard-list:/fcs/craft/cutting/pickup-management/history',
}

interface PickupListState {
  keyword: string
  materialKeyword: string
  currentPage: number
  sort: StandardListSortState | null
  preferences: StandardListColumnPreferences
  columnSettingsOpen: boolean
  draggedColumnKey: string
}

const states = new Map<PickupListKind, PickupListState>()
const searchDebounceTimers = new Map<string, ReturnType<typeof setTimeout>>()
const groupSnapshots = new Map<PickupListKind, PickupOrderGroup[]>()

export function pickupListFilterDebounceKey(kind: PickupListKind, field: string): string {
  return `${kind}:${field}`
}

function cancelInactivePickupListDebounces(activeKind: PickupListKind): void {
  for (const [key, timer] of searchDebounceTimers) {
    if (key.startsWith(`${activeKind}:`)) continue
    clearTimeout(timer)
    searchDebounceTimers.delete(key)
  }
}

function formatQty(value: number, unit: string): string {
  return `${Number(value || 0).toLocaleString('zh-CN', { maximumFractionDigits: 2 })} ${escapeHtml(unit)}`
}

function processRouteLabel(row: PickupMaterialDemandRow): string {
  if (row.processRoute === 'DYE_PRINT') return '染色 → 印花'
  if (row.processRoute === 'DYE') return '染色'
  return '无需加工'
}

function renderMaterialIdentity(row: PickupMaterialDemandRow): string {
  const source = row.demandSource === 'SUPPLEMENT'
    ? `补料单：${row.demandSourceNo || row.demandLineId}`
    : `需求/配料行：${row.demandSourceNo || row.demandLineId}`
  return `
    <article class="grid min-w-[640px] grid-cols-[44px_minmax(160px,1.3fr)_minmax(150px,1fr)_minmax(210px,1.2fr)] gap-3 rounded-md border bg-background p-2" data-pickup-material-row="${escapeHtml(row.rowKey)}">
      <div class="h-11 w-11 overflow-hidden rounded border bg-muted">
        ${row.materialImageUrl
          ? `<img src="${escapeHtml(row.materialImageUrl)}" alt="${escapeHtml(row.materialName)}" class="h-full w-full object-cover">`
          : '<div class="flex h-full items-center justify-center text-[10px] text-muted-foreground">暂无图</div>'}
      </div>
      <div class="min-w-0">
        <div class="font-medium text-foreground">${escapeHtml(row.materialName)}</div>
        <div class="mt-0.5 break-all text-xs text-muted-foreground">${escapeHtml(row.materialSku)}</div>
        <div class="mt-0.5 text-xs text-muted-foreground">${escapeHtml(row.color)} / ${escapeHtml(row.spec)} / ${escapeHtml(row.materialType)}</div>
      </div>
      <div class="text-xs leading-5">
        <div>${escapeHtml(source)}</div>
        ${row.supplementReason ? `<div class="text-muted-foreground">原因：${escapeHtml(row.supplementReason)}</div>` : ''}
        <div class="text-blue-700">${escapeHtml(processRouteLabel(row))} · ${escapeHtml(row.processBasisLabel)}</div>
      </div>
      <div class="grid grid-cols-3 gap-x-3 gap-y-1 text-xs">
        <div><span class="text-muted-foreground">应配</span><strong class="ml-1 tabular-nums">${formatQty(row.requiredQty, row.unit)}</strong></div>
        <div><span class="text-muted-foreground">当前配料</span><strong class="ml-1 tabular-nums">${formatQty(row.preparedQty, row.unit)}</strong></div>
        <div><span class="text-muted-foreground">累计领料</span><strong class="ml-1 tabular-nums">${formatQty(row.pickedQty, row.unit)}</strong></div>
      </div>
    </article>
  `
}

function renderAllMaterials(group: PickupOrderGroup): string {
  return `<div class="space-y-2">${group.materialRows.map(renderMaterialIdentity).join('')}</div>`
}

function renderAllLocations(group: PickupOrderGroup): string {
  return `<div class="space-y-2">
    ${group.materialRows.map((row) => `
      <article class="rounded-md border bg-background p-2 text-xs">
        <div class="font-medium">${escapeHtml(row.materialName)} · ${escapeHtml(row.materialSku)}</div>
        <div class="mt-1 space-y-1 text-muted-foreground">
          ${row.currentLocations.length
            ? row.currentLocations.map((location) => `
                <div>
                  ${escapeHtml(location.sourceWarehouseName)} / ${escapeHtml(location.sourceWarehouseArea)} /
                  ${escapeHtml(location.sourceLocationCode)}：
                  <strong class="text-foreground">${formatQty(location.currentAvailableQty, location.unit)}</strong>
                </div>
              `).join('')
            : '<div>当前无已确认库位</div>'}
        </div>
      </article>
    `).join('')}
  </div>`
}

function renderOrderCell(group: PickupOrderGroup): string {
  return `<div class="space-y-1">
    ${renderProductionOrderIdentityCell(group.productionOrderNo)}
    <div class="text-xs text-muted-foreground">配料单：${escapeHtml(group.prepOrderNo)}</div>
  </div>`
}

function renderPickupAction(group: PickupOrderGroup): string {
  const href = `/fcs/pda/warehouse/wait-process?scope=cutting&action=pickup&pickupNodeId=${encodeURIComponent(group.pickupNodeId)}&version=${group.pickupNodeVersion}`
  return `<div class="space-y-1.5">
    <a href="${escapeHtml(href)}" class="inline-flex rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700">去领料</a>
    <div class="max-w-[150px] text-xs leading-5 text-muted-foreground">一次领取本节点全部物料</div>
  </div>`
}

function renderReadyCarrier(group: PickupOrderGroup): string {
  const sourceLabel = group.readySource === 'UPGRADED_FROM_INCOMPLETE' ? '由未配齐升级' : '直接配齐'
  return `<div class="space-y-1 text-sm">
    <div class="font-medium text-emerald-700">${escapeHtml(sourceLabel)}</div>
    <div class="text-xs text-muted-foreground">${escapeHtml(group.palletDisplayLabel || '待领托盘（暂未编号）')}</div>
  </div>`
}

function renderHistoryResult(group: PickupOrderGroup): string {
  const pathLabel = group.historyPath === 'INCOMPLETE_PICKUP' ? '未配齐先领' : '已配齐后领料'
  const resultLabel = group.finalResult === 'ALL_PICKED'
    ? '全部领完'
    : group.finalResult === 'NEW_SUPPLEMENT_WAIT_PICKUP'
      ? '新增补料待领'
      : '未完成全部领料'
  return `<div class="space-y-1 text-sm">
    <div>${escapeHtml(pathLabel)}</div>
    <div class="${group.finalResult === 'ALL_PICKED' ? 'text-emerald-700' : 'text-amber-700'}">${escapeHtml(resultLabel)}</div>
  </div>`
}

function renderHistoryMaterials(group: PickupOrderGroup): string {
  return `<div class="space-y-2">
    ${group.materialRows.map((row) => {
      const source = row.demandSource === 'SUPPLEMENT'
        ? `补料单：${row.demandSourceNo || row.demandLineId}`
        : `需求/配料行：${row.demandSourceNo || row.demandLineId}`
      return `
      <article class="rounded-md border bg-background p-2 text-xs" data-pickup-material-row="${escapeHtml(row.rowKey)}">
        <div class="flex items-center gap-2">
          <div class="h-9 w-9 shrink-0 overflow-hidden rounded border bg-muted">
            ${row.materialImageUrl
              ? `<img src="${escapeHtml(row.materialImageUrl)}" alt="${escapeHtml(row.materialName)}" class="h-full w-full object-cover">`
              : '<div class="flex h-full items-center justify-center text-[9px] text-muted-foreground">暂无图</div>'}
          </div>
          <div>
            <div class="font-medium">${escapeHtml(row.materialName)} · ${escapeHtml(row.materialSku)}</div>
            <div class="text-muted-foreground">${escapeHtml(source)}</div>
            <div class="text-blue-700">${escapeHtml(processRouteLabel(row))} · ${escapeHtml(row.processBasisLabel)}</div>
          </div>
        </div>
        <div class="mt-2 grid grid-cols-4 gap-2">
          <div>应配 <strong>${formatQty(row.requiredQty, row.unit)}</strong></div>
          <div>当前配料 <strong>${formatQty(row.preparedQty, row.unit)}</strong></div>
          <div>累计领料 <strong>${formatQty(row.pickedQty, row.unit)}</strong></div>
          <div>剩余 <strong>${formatQty(row.remainingPickupQty, row.unit)}</strong></div>
        </div>
      </article>
    `
    }).join('')}
  </div>`
}

const READY_COLUMNS: StandardListColumn<PickupOrderGroup>[] = [
  { key: 'productionOrder', title: '生产单', width: 230, required: true, freezeable: true, sortable: true, render: renderOrderCell, sortValue: (row) => row.productionOrderNo },
  { key: 'materials', title: '物料明细（全部需求）', width: 720, required: true, freezeable: true, render: renderAllMaterials },
  { key: 'readyCarrier', title: '配齐方式 / 待领托盘', width: 210, required: true, freezeable: true, sortable: true, render: renderReadyCarrier, sortValue: (row) => row.readySource },
  { key: 'actions', title: '操作', width: 180, required: true, actionColumn: true, render: renderPickupAction },
]

const INCOMPLETE_COLUMNS: StandardListColumn<PickupOrderGroup>[] = [
  { key: 'productionOrder', title: '生产单', width: 230, required: true, freezeable: true, sortable: true, render: renderOrderCell, sortValue: (row) => row.productionOrderNo },
  { key: 'materials', title: '物料明细（全部需求）', width: 720, required: true, freezeable: true, render: renderAllMaterials },
  { key: 'locations', title: '当前全部库位及数量', width: 360, required: true, freezeable: true, render: renderAllLocations },
  { key: 'actions', title: '操作', width: 180, required: true, actionColumn: true, render: renderPickupAction },
]

const HISTORY_COLUMNS: StandardListColumn<PickupOrderGroup>[] = [
  { key: 'productionOrder', title: '生产单', width: 230, required: true, freezeable: true, sortable: true, render: renderOrderCell, sortValue: (row) => row.productionOrderNo },
  { key: 'materials', title: '物料领料结果（全部需求）', width: 620, required: true, freezeable: true, render: renderHistoryMaterials },
  { key: 'result', title: '领取路径 / 最终结果', width: 190, required: true, freezeable: true, sortable: true, render: renderHistoryResult, sortValue: (row) => `${row.historyPath}:${row.finalResult}` },
  { key: 'sessions', title: '领取次数 / 最近时间', width: 190, freezeable: true, sortable: true, render: (row) => `<div class="text-sm"><div>${row.pickupSessionCount} 次</div><div class="text-xs text-muted-foreground">${escapeHtml(row.latestPickedAt || '—')}</div></div>`, sortValue: (row) => row.latestPickedAt },
  { key: 'actions', title: '操作', width: 150, required: true, actionColumn: true, render: (row) => `<a href="/fcs/production/order-detail?id=${encodeURIComponent(row.productionOrderId)}" class="inline-flex rounded-md border px-3 py-2 text-xs hover:bg-muted">查看生产单</a>` },
]

function columnsFor(kind: PickupListKind): StandardListColumn<PickupOrderGroup>[] {
  if (kind === 'READY') return READY_COLUMNS
  if (kind === 'INCOMPLETE') return INCOMPLETE_COLUMNS
  return HISTORY_COLUMNS
}

function titleFor(kind: PickupListKind): string {
  if (kind === 'READY') return '已配齐待领料'
  if (kind === 'INCOMPLETE') return '未配齐配料'
  return '已领料'
}

function getState(kind: PickupListKind): PickupListState {
  const existing = states.get(kind)
  if (existing) return existing
  const columns = columnsFor(kind)
  const defaults = normalizeListColumnPreferences(
    columns,
    {
      order: columns.map((column) => column.key),
      visibleKeys: columns.map((column) => column.key),
      frozenKeys: ['productionOrder'],
      pageSize: PAGE_SIZES[0],
    },
    PAGE_SIZES,
  )
  const preferences = typeof localStorage === 'undefined'
    ? defaults
    : loadListColumnPreferences(localStorage, PREFERENCE_KEYS[kind], columns, defaults, PAGE_SIZES)
  const created: PickupListState = {
    keyword: '',
    materialKeyword: '',
    currentPage: 1,
    sort: null,
    preferences,
    columnSettingsOpen: false,
    draggedColumnKey: '',
  }
  states.set(kind, created)
  return created
}

function matchesFilters(group: PickupOrderGroup, state: PickupListState): boolean {
  const keyword = state.keyword.toLowerCase()
  const materialKeyword = state.materialKeyword.toLowerCase()
  if (keyword && !`${group.productionOrderNo} ${group.prepOrderNo}`.toLowerCase().includes(keyword)) return false
  if (materialKeyword) {
    const materialText = group.materialRows
      .map((row) => `${row.materialName} ${row.materialSku} ${row.demandSourceNo}`)
      .join(' ')
      .toLowerCase()
    if (!materialText.includes(materialKeyword)) return false
  }
  return true
}

function getPickupGroupSnapshot(kind: PickupListKind): PickupOrderGroup[] {
  const existing = groupSnapshots.get(kind)
  if (existing) return existing
  const created = listPickupOrderGroups(kind)
  groupSnapshots.set(kind, created)
  return created
}

function getView(kind: PickupListKind): {
  groups: PickupOrderGroup[]
  paging: ReturnType<typeof paginateStandardListRows<PickupOrderGroup>>
} {
  const state = getState(kind)
  const columns = columnsFor(kind)
  const groups = getPickupGroupSnapshot(kind).filter((group) => matchesFilters(group, state))
  const sorted = sortStandardListRows(groups, state.sort, (row, key) => {
    const column = columns.find((candidate) => candidate.key === key)
    return column?.sortValue?.(row)
  })
  return {
    groups,
    paging: paginateStandardListRows(sorted, state.currentPage, state.preferences.pageSize),
  }
}

function renderStats(kind: PickupListKind, groups: PickupOrderGroup[]): string {
  const materialCount = groups.reduce((total, group) => total + group.materialRows.length, 0)
  const supplementalCount = groups.reduce(
    (total, group) => total + group.materialRows.filter((row) => row.demandSource === 'SUPPLEMENT').length,
    0,
  )
  return renderStandardListStats([
    { label: titleFor(kind), value: `${groups.length} 个生产单` },
    { label: '物料需求', value: `${materialCount} 行` },
    { label: '其中补料需求', value: `${supplementalCount} 行` },
  ])
}

function withSkipPageRerender(html: string): string {
  return html
    .replaceAll('data-pickup-list-action=', 'data-skip-page-rerender="true" data-pickup-list-action=')
    .replaceAll('data-pickup-list-field=', 'data-skip-page-rerender="true" data-pickup-list-field=')
}

function renderFilters(state: PickupListState): string {
  return `<section class="rounded-lg border bg-card p-3">
    <div class="grid gap-3 md:grid-cols-2">
      <label class="space-y-1 text-sm">
        <span class="font-medium">生产单 / 配料单</span>
        <input class="h-10 w-full rounded-md border bg-background px-3" value="${escapeHtml(state.keyword)}" placeholder="输入编号搜索" data-skip-page-rerender="true" data-pickup-list-filter="keyword">
      </label>
      <label class="space-y-1 text-sm">
        <span class="font-medium">物料</span>
        <input class="h-10 w-full rounded-md border bg-background px-3" value="${escapeHtml(state.materialKeyword)}" placeholder="输入物料名称、编码或补料单号" data-skip-page-rerender="true" data-pickup-list-filter="materialKeyword">
      </label>
    </div>
  </section>`
}

function renderColumnSettings(kind: PickupListKind): string {
  const state = getState(kind)
  if (!state.columnSettingsOpen) return ''
  return withSkipPageRerender(renderStandardListColumnSettings({
    title: `${titleFor(kind)}列设置`,
    columns: columnsFor(kind),
    preferences: state.preferences,
    eventPrefix: EVENT_PREFIX,
    maxFrozenWidth: 720,
  }))
}

function renderTableRegion(
  kind: PickupListKind,
  view = getView(kind),
): string {
  const state = getState(kind)
  return withSkipPageRerender(renderStandardListTable({
    columns: columnsFor(kind),
    rows: view.paging.rows,
    preferences: state.preferences,
    sort: state.sort,
    eventPrefix: EVENT_PREFIX,
    emptyText: `当前暂无${titleFor(kind)}生产单。`,
  }))
}

function renderPaginationRegion(
  kind: PickupListKind,
  view = getView(kind),
): string {
  const state = getState(kind)
  const { paging } = view
  return withSkipPageRerender(renderTablePagination({
    total: paging.total,
    from: paging.from,
    to: paging.to,
    currentPage: paging.currentPage,
    totalPages: paging.totalPages,
    pageSize: state.preferences.pageSize,
    actionPrefix: EVENT_PREFIX,
    pageSizeOptions: PAGE_SIZES,
  }))
}

function renderPickupList(kind: PickupListKind): string {
  cancelInactivePickupListDebounces(kind)
  groupSnapshots.set(kind, listPickupOrderGroups(kind))
  const state = getState(kind)
  state.currentPage = 1
  state.sort = null
  state.keyword = ''
  state.materialKeyword = ''
  const view = getView(kind)
  return `<div data-pickup-list-root="${kind}">
    ${renderStandardListPage({
      title: titleFor(kind),
      filtersHtml: renderFilters(state),
      statsHtml: `<div data-pickup-list-region="stats">${renderStats(kind, view.groups)}</div>`,
      listTitle: `${titleFor(kind)}生产单`,
      listActionsHtml: withSkipPageRerender(renderSecondaryButton(
        '列设置',
        { prefix: EVENT_PREFIX, action: 'open-column-settings' },
        'columns-3',
      )),
      tableHtml: `<div data-pickup-list-region="table">${renderTableRegion(kind, view)}</div>`,
      paginationHtml: `<div data-pickup-list-region="pagination">${renderPaginationRegion(kind, view)}</div>`,
      overlaysHtml: `<div data-pickup-list-region="overlay">${renderColumnSettings(kind)}</div>`,
    })}
  </div>`
}

export function renderCraftCuttingPickupReadyPage(): string {
  return renderPickupList('READY')
}

export function renderCraftCuttingPickupIncompletePage(): string {
  return renderPickupList('INCOMPLETE')
}

export function renderCraftCuttingPickupHistoryPage(): string {
  return renderPickupList('HISTORY')
}

function kindFromPathname(): PickupListKind | null {
  const pathname = typeof window === 'undefined' ? '' : window.location.pathname
  if (pathname === '/fcs/craft/cutting/pickup-management/ready') return 'READY'
  if (pathname === '/fcs/craft/cutting/pickup-management/incomplete') return 'INCOMPLETE'
  if (pathname === '/fcs/craft/cutting/pickup-management/history') return 'HISTORY'
  return null
}

function savePreferences(kind: PickupListKind): void {
  if (typeof localStorage === 'undefined') return
  saveListColumnPreferences(localStorage, PREFERENCE_KEYS[kind], getState(kind).preferences)
}

function refreshPickupListRegions(kind: PickupListKind): void {
  const root = document.querySelector<HTMLElement>(`[data-pickup-list-root="${kind}"]`)
  if (!root) return
  const view = getView(kind)
  const stats = root.querySelector<HTMLElement>('[data-pickup-list-region="stats"]')
  const table = root.querySelector<HTMLElement>('[data-pickup-list-region="table"]')
  const pagination = root.querySelector<HTMLElement>('[data-pickup-list-region="pagination"]')
  if (stats) stats.innerHTML = renderStats(kind, view.groups)
  if (table) table.innerHTML = renderTableRegion(kind, view)
  if (pagination) pagination.innerHTML = renderPaginationRegion(kind, view)
}

function refreshPickupListOverlay(kind: PickupListKind): void {
  const root = document.querySelector<HTMLElement>(`[data-pickup-list-root="${kind}"]`)
  const overlay = root?.querySelector<HTMLElement>('[data-pickup-list-region="overlay"]')
  if (overlay) overlay.innerHTML = renderColumnSettings(kind)
}

export function handleCraftCuttingPickupListEvent(target: HTMLElement, event?: Event): boolean {
  const kind = kindFromPathname()
  if (!kind) return false
  const state = getState(kind)
  const columns = columnsFor(kind)
  const filter = target.closest<HTMLInputElement>('[data-pickup-list-filter]')
  if (filter && event?.type === 'input') {
    const filterField = filter.dataset.pickupListFilter || ''
    const debounceKey = pickupListFilterDebounceKey(kind, filterField)
    const existingTimer = searchDebounceTimers.get(debounceKey)
    if (existingTimer) clearTimeout(existingTimer)
    const nextValue = filter.value.trim()
    const applyFilter = (): void => {
      searchDebounceTimers.delete(debounceKey)
      if (filterField === 'keyword') state.keyword = nextValue
      if (filterField === 'materialKeyword') state.materialKeyword = nextValue
      state.currentPage = 1
      refreshPickupListRegions(kind)
    }
    if (!nextValue) {
      applyFilter()
      return true
    }
    searchDebounceTimers.set(debounceKey, setTimeout(() => {
      if (kindFromPathname() !== kind) {
        searchDebounceTimers.delete(debounceKey)
        return
      }
      applyFilter()
    }, 180))
    return true
  }

  const field = target.closest<HTMLSelectElement>('[data-pickup-list-field]')
  if (field?.dataset.pickupListField === 'pageSize' && event?.type === 'change') {
    const pageSize = Number(field.value)
    if (PAGE_SIZES.includes(pageSize)) {
      state.preferences = normalizeListColumnPreferences(
        columns,
        { ...state.preferences, pageSize },
        PAGE_SIZES,
      )
      state.currentPage = 1
      savePreferences(kind)
      refreshPickupListRegions(kind)
    }
    return true
  }

  const dragEvent = event as (DragEvent & { higoodStandardListColumnKey?: string }) | undefined
  const dragNode = target.closest<HTMLElement>('[data-standard-list-column-drag]')
  if (dragNode && event && ['dragstart', 'dragover', 'drop'].includes(event.type)) {
    const targetKey = dragNode.dataset.pickupListColumnKey
      || dragNode.dataset.dragSource
      || dragNode.dataset.dropTarget
      || ''
    if (event.type === 'dragstart') {
      state.draggedColumnKey = targetKey
      dragEvent?.dataTransfer?.setData('application/x-higood-list-column-key', targetKey)
      return true
    }
    const sourceKey = dragEvent?.higoodStandardListColumnKey || state.draggedColumnKey
    if (!sourceKey || !targetKey || sourceKey === targetKey) return false
    if (event.type === 'dragover') {
      event.preventDefault()
      return true
    }
    event.preventDefault()
    const order = state.preferences.order.filter((key) => key !== sourceKey)
    const targetIndex = order.indexOf(targetKey)
    if (targetIndex >= 0) order.splice(targetIndex, 0, sourceKey)
    state.preferences = normalizeListColumnPreferences(columns, { ...state.preferences, order }, PAGE_SIZES)
    state.draggedColumnKey = ''
    savePreferences(kind)
    refreshPickupListRegions(kind)
    refreshPickupListOverlay(kind)
    return true
  }
  if (event?.type === 'dragend' && state.draggedColumnKey) {
    state.draggedColumnKey = ''
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-pickup-list-action]')
  const action = actionNode?.dataset.pickupListAction
  if (!actionNode || !action) return false

  if (action === 'prev-page' || action === 'next-page') {
    const totalPages = getView(kind).paging.totalPages
    state.currentPage = action === 'prev-page'
      ? Math.max(1, state.currentPage - 1)
      : Math.min(totalPages, state.currentPage + 1)
    refreshPickupListRegions(kind)
    return true
  }
  if (action === 'sort-column') {
    const columnKey = actionNode.dataset.columnKey || ''
    const column = columns.find((candidate) => candidate.key === columnKey && candidate.sortable)
    if (!column) return true
    state.sort = state.sort?.key !== columnKey
      ? { key: columnKey, direction: 'asc' }
      : state.sort.direction === 'asc'
        ? { key: columnKey, direction: 'desc' }
        : null
    state.currentPage = 1
    refreshPickupListRegions(kind)
    return true
  }
  if (action === 'open-column-settings' || action === 'close-column-settings') {
    state.columnSettingsOpen = action === 'open-column-settings'
    refreshPickupListOverlay(kind)
    return true
  }
  if (action === 'toggle-column-visibility' || action === 'toggle-column-freeze') {
    if (event?.type !== 'change') return false
    const columnKey = actionNode.dataset.pickupListColumnKey || actionNode.dataset.columnKey || ''
    const column = columns.find((candidate) => candidate.key === columnKey)
    if (!column || column.actionColumn) return true
    const visibleKeys = new Set(state.preferences.visibleKeys)
    const frozenKeys = new Set(state.preferences.frozenKeys)
    if (action === 'toggle-column-visibility' && !column.required) {
      visibleKeys.has(columnKey) ? visibleKeys.delete(columnKey) : visibleKeys.add(columnKey)
      if (!visibleKeys.has(columnKey)) frozenKeys.delete(columnKey)
    }
    if (action === 'toggle-column-freeze' && column.freezeable) {
      frozenKeys.has(columnKey) ? frozenKeys.delete(columnKey) : frozenKeys.add(columnKey)
    }
    state.preferences = normalizeListColumnPreferences(columns, {
      ...state.preferences,
      visibleKeys: [...visibleKeys],
      frozenKeys: [...frozenKeys],
    }, PAGE_SIZES)
    savePreferences(kind)
    refreshPickupListRegions(kind)
    refreshPickupListOverlay(kind)
    return true
  }
  if (action === 'restore-column-settings') {
    state.preferences = normalizeListColumnPreferences(columns, {
      order: columns.map((column) => column.key),
      visibleKeys: columns.map((column) => column.key),
      frozenKeys: ['productionOrder'],
      pageSize: PAGE_SIZES[0],
    }, PAGE_SIZES)
    state.currentPage = 1
    state.sort = null
    savePreferences(kind)
    refreshPickupListRegions(kind)
    refreshPickupListOverlay(kind)
    return true
  }
  return false
}
