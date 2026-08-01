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
import {
  listPickupDiscrepancies,
  resolvePickupDiscrepancy,
} from '../../../data/fcs/cutting/pickup-discrepancy.ts'
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
export const PICKUP_LIST_FILTER_DEBOUNCE_MS = 120
const PREFERENCE_KEYS: Record<PickupListKind, string> = {
  READY: 'standard-list:/fcs/craft/cutting/pickup-management/ready',
  INCOMPLETE: 'standard-list:/fcs/craft/cutting/pickup-management/incomplete',
  HISTORY: 'standard-list:/fcs/craft/cutting/pickup-management/history',
}

interface PickupListState {
  keyword: string
  materialKeyword: string
  demandSource: string
  processRoute: string
  readySource: string
  palletNumbered: string
  locationKeyword: string
  shortageOnly: string
  historyPath: string
  finalResult: string
  recentDate: string
  currentPage: number
  sort: StandardListSortState | null
  preferences: StandardListColumnPreferences
  columnSettingsOpen: boolean
  draggedColumnKey: string
  selectedRecordGroupKey: string
}

const states = new Map<PickupListKind, PickupListState>()
const searchDebounceTimers = new Map<string, ReturnType<typeof setTimeout>>()
const groupSnapshots = new Map<PickupListKind, PickupOrderGroup[]>()

export function pickupListFilterDebounceKey(kind: PickupListKind, field: string): string {
  return `${kind}:${field}`
}

function cancelPickupListDebouncesBeforeRender(): void {
  for (const [key, timer] of searchDebounceTimers) {
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
        <div><span class="text-muted-foreground">本轮可领</span><strong class="ml-1 tabular-nums">${formatQty(row.currentAvailableQty, row.unit)}</strong></div>
        <div><span class="text-muted-foreground">领后仍缺</span><strong class="ml-1 tabular-nums">${formatQty(row.afterCurrentPickupRemainingQty, row.unit)}</strong></div>
        ${row.overageQty > 0 ? `<div class="col-span-3 text-amber-700">超配异常：${formatQty(row.overageQty, row.unit)}</div>` : ''}
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

function renderStyleCell(group: PickupOrderGroup): string {
  return `<div class="space-y-1 text-sm">
    <div><span class="text-xs text-muted-foreground">款式</span><div class="font-medium">${escapeHtml(group.styleNo || '—')} ${escapeHtml(group.styleName || '')}</div></div>
    <div><span class="text-xs text-muted-foreground">SPU</span><div class="break-all text-xs">${escapeHtml(group.spu || '—')}</div></div>
  </div>`
}

function renderCurrentNodeCell(group: PickupOrderGroup): string {
  return `<div class="space-y-1 text-sm">
    <div class="font-medium">${escapeHtml(group.currentNodeState)}</div>
    <div class="text-xs text-muted-foreground">最近领料人：${escapeHtml(group.latestPickerName || '暂无')}</div>
    <div class="text-xs text-muted-foreground">最近领料时间：${escapeHtml(group.latestPickedAt || '暂无')}</div>
  </div>`
}

function renderPickupAction(group: PickupOrderGroup): string {
  const href = `/fcs/pda/warehouse/wait-process?scope=cutting&action=pickup&pickupNodeId=${encodeURIComponent(group.pickupNodeId)}&version=${group.pickupNodeVersion}`
  const differenceHref = `${href}&difference=1`
  return `<div class="space-y-1.5">
    <a href="${escapeHtml(href)}" class="inline-flex rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700">去领料</a>
    <button type="button" class="block text-left text-xs text-blue-700 hover:underline" data-pickup-list-action="open-pickup-records" data-group-key="${escapeHtml(group.groupKey)}">查看领料记录</button>
    <a href="${escapeHtml(differenceHref)}" class="block text-xs text-amber-700 hover:underline">上报领料差异</a>
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
            <div class="text-muted-foreground">颜色 / 规格：${escapeHtml(row.color || '—')} / ${escapeHtml(row.spec || '—')}</div>
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
        ${row.overageQty > 0 ? `<div class="mt-1 text-amber-700">超配异常：${formatQty(row.overageQty, row.unit)}</div>` : ''}
      </article>
    `
    }).join('')}
  </div>`
}

function summarizeQtyByUnit(
  rows: PickupMaterialDemandRow[],
  quantity: (row: PickupMaterialDemandRow) => number,
): string {
  const totals = new Map<string, number>()
  rows.forEach((row) => totals.set(row.unit, (totals.get(row.unit) ?? 0) + quantity(row)))
  return Array.from(totals)
    .filter(([, value]) => value > 0)
    .map(([unit, value]) => formatQty(value, unit))
    .join('；') || '无'
}

function currentLocationKeys(group: PickupOrderGroup): string[] {
  return Array.from(new Set(group.materialRows.flatMap((row) => row.currentLocations.map((location) =>
    `${location.sourceWarehouseName}/${location.sourceWarehouseArea}/${location.sourceLocationCode}`
  ))))
}

function renderReadySummary(group: PickupOrderGroup): string {
  const availableRows = group.materialRows.filter((row) => row.currentAvailableQty > 0)
  return `<div class="space-y-1 text-xs">
    <div>可领物料种数：<strong>${availableRows.length} 种</strong></div>
    <div>按单位可领：<strong>${summarizeQtyByUnit(availableRows, (row) => row.currentAvailableQty)}</strong></div>
    <div class="text-muted-foreground">最近配齐时间：${escapeHtml(group.currentNodeUpdatedAt || '—')}</div>
  </div>`
}

function renderIncompleteSummary(group: PickupOrderGroup): string {
  const availableRows = group.materialRows.filter((row) => row.currentAvailableQty > 0)
  const shortageRows = group.materialRows.filter((row) => row.afterCurrentPickupRemainingQty > 0)
  return `<div class="space-y-1 text-xs">
    <div>库位数：<strong>${currentLocationKeys(group).length} 个</strong></div>
    <div>可领物料种数：<strong>${availableRows.length} 种</strong></div>
    <div>仍缺物料种数：<strong>${shortageRows.length} 种</strong></div>
    <div>领后仍缺摘要：<strong>${summarizeQtyByUnit(shortageRows, (row) => row.afterCurrentPickupRemainingQty)}</strong></div>
    <div class="text-muted-foreground">最近配料时间：${escapeHtml(group.currentNodeUpdatedAt || '—')}</div>
  </div>`
}

const READY_COLUMNS: StandardListColumn<PickupOrderGroup>[] = [
  { key: 'productionOrder', title: '生产单', width: 230, required: true, freezeable: true, sortable: true, render: renderOrderCell, sortValue: (row) => row.productionOrderNo },
  { key: 'readyStyle', title: '款式 / SPU', width: 220, freezeable: true, sortable: true, render: renderStyleCell, sortValue: (row) => `${row.styleNo}:${row.spu}` },
  { key: 'materials', title: '物料明细（全部需求）', width: 720, required: true, freezeable: true, render: renderAllMaterials },
  { key: 'readyCarrier', title: '配齐方式 / 待领托盘', width: 210, required: true, freezeable: true, sortable: true, render: renderReadyCarrier, sortValue: (row) => row.readySource },
  { key: 'readySummary', title: '本次可领摘要', width: 260, required: true, freezeable: true, render: renderReadySummary },
  { key: 'nodeState', title: '当前节点状态', width: 220, freezeable: true, sortable: true, render: renderCurrentNodeCell, sortValue: (row) => row.currentNodeState },
  { key: 'actions', title: '操作', width: 170, required: true, actionColumn: true, render: renderPickupAction },
]

const INCOMPLETE_COLUMNS: StandardListColumn<PickupOrderGroup>[] = [
  { key: 'productionOrder', title: '生产单', width: 230, required: true, freezeable: true, sortable: true, render: renderOrderCell, sortValue: (row) => row.productionOrderNo },
  { key: 'incompleteStyle', title: '款式 / SPU', width: 220, freezeable: true, sortable: true, render: renderStyleCell, sortValue: (row) => `${row.styleNo}:${row.spu}` },
  { key: 'materials', title: '物料明细（全部需求）', width: 720, required: true, freezeable: true, render: renderAllMaterials },
  { key: 'locations', title: '当前全部库位及数量', width: 360, required: true, freezeable: true, render: renderAllLocations },
  { key: 'incompleteSummary', title: '配料 / 缺料摘要', width: 280, required: true, freezeable: true, render: renderIncompleteSummary },
  { key: 'nodeState', title: '当前节点状态', width: 220, freezeable: true, sortable: true, render: renderCurrentNodeCell, sortValue: (row) => row.currentNodeState },
  { key: 'actions', title: '操作', width: 170, required: true, actionColumn: true, render: renderPickupAction },
]

const HISTORY_COLUMNS: StandardListColumn<PickupOrderGroup>[] = [
  { key: 'productionOrder', title: '生产单', width: 230, required: true, freezeable: true, sortable: true, render: renderOrderCell, sortValue: (row) => row.productionOrderNo },
  { key: 'historyStyle', title: '款式 / SPU', width: 220, freezeable: true, sortable: true, render: renderStyleCell, sortValue: (row) => `${row.styleNo}:${row.spu}` },
  { key: 'materials', title: '物料领料结果（全部需求）', width: 620, required: true, freezeable: true, render: renderHistoryMaterials },
  { key: 'result', title: '领取路径 / 最终结果', width: 190, required: true, freezeable: true, sortable: true, render: renderHistoryResult, sortValue: (row) => `${row.historyPath}:${row.finalResult}` },
  { key: 'sessions', title: '领取次数 / 最近领料人 / 时间', width: 230, freezeable: true, sortable: true, render: (row) => `<div class="text-sm"><div>${row.pickupSessionCount} 次</div><div class="text-xs text-muted-foreground">${escapeHtml(row.latestPickerName || '—')}</div><div class="text-xs text-muted-foreground">${escapeHtml(row.latestPickedAt || '—')}</div></div>`, sortValue: (row) => row.latestPickedAt },
  { key: 'nodeState', title: '当前节点状态', width: 190, freezeable: true, sortable: true, render: renderCurrentNodeCell, sortValue: (row) => row.currentNodeState },
  { key: 'actions', title: '操作', width: 170, required: true, actionColumn: true, render: (row) => {
    const pendingHref = row.pickupNodeId
      ? `/fcs/pda/warehouse/wait-process?scope=cutting&action=pickup&pickupNodeId=${encodeURIComponent(row.pickupNodeId)}&version=${row.pickupNodeVersion}`
      : ''
    return `<div class="space-y-1.5">
      <button type="button" class="inline-flex rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white" data-pickup-list-action="open-pickup-records" data-group-key="${escapeHtml(row.groupKey)}">领料记录</button>
      ${pendingHref ? `<a href="${escapeHtml(pendingHref)}" class="block text-xs text-blue-700 hover:underline">去处理当前待领</a>` : ''}
    </div>`
  } },
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
    demandSource: 'ALL',
    processRoute: 'ALL',
    readySource: 'ALL',
    palletNumbered: 'ALL',
    locationKeyword: '',
    shortageOnly: 'ALL',
    historyPath: 'ALL',
    finalResult: 'ALL',
    recentDate: '',
    currentPage: 1,
    sort: null,
    preferences,
    columnSettingsOpen: false,
    draggedColumnKey: '',
    selectedRecordGroupKey: '',
  }
  states.set(kind, created)
  return created
}

function matchesFilters(kind: PickupListKind, group: PickupOrderGroup, state: PickupListState): boolean {
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
  if (state.demandSource !== 'ALL' && !group.materialRows.some((row) => row.demandSource === state.demandSource)) return false
  if (state.processRoute !== 'ALL' && !group.materialRows.some((row) => row.processRoute === state.processRoute)) return false
  if (kind === 'READY') {
    if (state.readySource !== 'ALL' && group.readySource !== state.readySource) return false
    if (state.palletNumbered === 'NUMBERED' && !group.palletId) return false
    if (state.palletNumbered === 'UNNUMBERED' && group.palletId) return false
  }
  if (kind === 'INCOMPLETE') {
    const locationText = group.materialRows
      .flatMap((row) => row.currentLocations)
      .map((location) => `${location.sourceWarehouseName} ${location.sourceWarehouseArea} ${location.sourceLocationCode}`)
      .join(' ')
      .toLowerCase()
    if (state.locationKeyword && !locationText.includes(state.locationKeyword.toLowerCase())) return false
    if (state.shortageOnly === 'SHORTAGE' && !group.materialRows.some((row) => row.afterCurrentPickupRemainingQty > 0)) return false
  }
  if (kind === 'HISTORY') {
    if (state.historyPath !== 'ALL' && group.historyPath !== state.historyPath) return false
    if (state.finalResult !== 'ALL' && group.finalResult !== state.finalResult) return false
  }
  const latestBusinessAt = kind === 'HISTORY' ? group.latestPickedAt : group.currentNodeUpdatedAt
  if (state.recentDate && (!latestBusinessAt || latestBusinessAt.substring(0, 10) < state.recentDate)) return false
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
  const groups = getPickupGroupSnapshot(kind).filter((group) => matchesFilters(kind, group, state))
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
  if (kind === 'READY') {
    return renderStandardListStats([
      { label: '待领生产单', value: `${groups.length} 个` },
      { label: '一次直接配齐', value: `${groups.filter((group) => group.readySource === 'DIRECT_READY').length} 个生产单` },
      { label: '从未配齐升级', value: `${groups.filter((group) => group.readySource === 'UPGRADED_FROM_INCOMPLETE').length} 个生产单` },
      { label: '当前未编号托盘', value: `${groups.filter((group) => !group.palletId).length} 个生产单` },
    ])
  }
  if (kind === 'INCOMPLETE') {
    return renderStandardListStats([
      { label: '未配齐生产单', value: `${groups.length} 个` },
      { label: '当前占用库位', value: `${new Set(groups.flatMap(currentLocationKeys)).size} 个` },
      { label: '可整批领料生产单', value: `${groups.filter((group) => group.materialRows.some((row) => row.currentAvailableQty > 0)).length} 个` },
      { label: '含补料生产单', value: `${groups.filter((group) => group.materialRows.some((row) => row.demandSource === 'SUPPLEMENT')).length} 个` },
    ])
  }
  return renderStandardListStats([
    { label: '有领料记录生产单', value: `${groups.length} 个` },
    { label: '已配齐后领料', value: `${groups.filter((group) => group.historyPath === 'READY_PICKUP').length} 个` },
    { label: '未配齐先领', value: `${groups.filter((group) => group.historyPath === 'INCOMPLETE_PICKUP').length} 个` },
    { label: '尚未全部领完', value: `${groups.filter((group) => group.finalResult === 'NOT_ALL_PICKED').length} 个` },
    { label: '新增补料待领', value: `${groups.filter((group) => group.finalResult === 'NEW_SUPPLEMENT_WAIT_PICKUP').length} 个` },
  ])
}

function withSkipPageRerender(html: string): string {
  return html
    .replaceAll('data-pickup-list-action=', 'data-skip-page-rerender="true" data-pickup-list-action=')
    .replaceAll('data-pickup-list-field=', 'data-skip-page-rerender="true" data-pickup-list-field=')
}

function renderSelect(label: string, field: string, value: string, options: Array<[string, string]>): string {
  return `<label class="space-y-1 text-sm">
    <span class="font-medium">${escapeHtml(label)}</span>
    <select class="h-10 w-full rounded-md border bg-background px-3" data-pickup-list-field="${escapeHtml(field)}">
      ${options.map(([optionValue, optionLabel]) => `<option value="${escapeHtml(optionValue)}"${value === optionValue ? ' selected' : ''}>${escapeHtml(optionLabel)}</option>`).join('')}
    </select>
  </label>`
}

function renderFilters(kind: PickupListKind, state: PickupListState): string {
  const extraFilters = kind === 'READY'
    ? `${renderSelect('配齐方式', 'readySource', state.readySource, [['ALL', '全部'], ['DIRECT_READY', '一次直接配齐'], ['UPGRADED_FROM_INCOMPLETE', '从未配齐升级']])}
       ${renderSelect('托盘是否编号', 'palletNumbered', state.palletNumbered, [['ALL', '全部'], ['NUMBERED', '已编号'], ['UNNUMBERED', '未编号']])}
       <label class="space-y-1 text-sm"><span class="font-medium">最近配齐时间</span><input type="date" class="h-10 w-full rounded-md border bg-background px-3" value="${escapeHtml(state.recentDate)}" data-skip-page-rerender="true" data-pickup-list-filter="recentDate"></label>`
    : kind === 'INCOMPLETE'
      ? `<label class="space-y-1 text-sm"><span class="font-medium">库区 / 库位</span><input class="h-10 w-full rounded-md border bg-background px-3" value="${escapeHtml(state.locationKeyword)}" placeholder="输入库区或库位" data-skip-page-rerender="true" data-pickup-list-filter="locationKeyword"></label>
         ${renderSelect('仍缺物料', 'shortageOnly', state.shortageOnly, [['ALL', '全部'], ['SHORTAGE', '有缺料']])}
         <label class="space-y-1 text-sm"><span class="font-medium">最近配料时间</span><input type="date" class="h-10 w-full rounded-md border bg-background px-3" value="${escapeHtml(state.recentDate)}" data-skip-page-rerender="true" data-pickup-list-filter="recentDate"></label>`
      : `${renderSelect('领料路径', 'historyPath', state.historyPath, [['ALL', '全部'], ['READY_PICKUP', '已配齐后领料'], ['INCOMPLETE_PICKUP', '未配齐先领']])}
         ${renderSelect('最终结果', 'finalResult', state.finalResult, [['ALL', '全部'], ['ALL_PICKED', '全部领完'], ['NOT_ALL_PICKED', '尚未全部领完'], ['NEW_SUPPLEMENT_WAIT_PICKUP', '新增补料待领']])}
         <label class="space-y-1 text-sm"><span class="font-medium">最近领料时间</span><input type="date" class="h-10 w-full rounded-md border bg-background px-3" value="${escapeHtml(state.recentDate)}" data-skip-page-rerender="true" data-pickup-list-filter="recentDate"></label>`
  return `<section class="rounded-lg border bg-card p-3">
    <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <label class="space-y-1 text-sm">
        <span class="font-medium">生产单 / 配料单</span>
        <input class="h-10 w-full rounded-md border bg-background px-3" value="${escapeHtml(state.keyword)}" placeholder="输入编号搜索" data-skip-page-rerender="true" data-pickup-list-filter="keyword">
      </label>
      <label class="space-y-1 text-sm">
        <span class="font-medium">物料</span>
        <input class="h-10 w-full rounded-md border bg-background px-3" value="${escapeHtml(state.materialKeyword)}" placeholder="输入物料名称、编码或补料单号" data-skip-page-rerender="true" data-pickup-list-filter="materialKeyword">
      </label>
      ${renderSelect('需求来源', 'demandSource', state.demandSource, [['ALL', '全部'], ['NORMAL', '计划需求'], ['SUPPLEMENT', '补料需求']])}
      ${renderSelect('加工路线', 'processRoute', state.processRoute, [['ALL', '全部'], ['NONE', '无需染色 / 印花'], ['DYE', '染色'], ['DYE_PRINT', '染色 → 印花']])}
      ${extraFilters}
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

function renderPickupRecordsDrawer(kind: PickupListKind): string {
  const state = getState(kind)
  if (!state.selectedRecordGroupKey) return ''
  const group = (groupSnapshots.get(kind) ?? []).find((item) => item.groupKey === state.selectedRecordGroupKey)
  if (!group) return ''
  const discrepancies = listPickupDiscrepancies()
  const groupDiscrepancies = discrepancies.filter((record) =>
    record.productionOrderId === group.productionOrderId
  )
  return `<div class="fixed inset-0 z-50 flex justify-end bg-black/30" data-skip-page-rerender="true">
    <section class="h-full w-full max-w-2xl overflow-y-auto bg-background shadow-xl">
      <div class="sticky top-0 z-10 flex items-start justify-between border-b bg-background px-5 py-4">
        <div>
          <div class="text-lg font-semibold">领料记录</div>
          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(group.productionOrderNo)} · ${escapeHtml(group.prepOrderNo)}</div>
        </div>
        <button type="button" class="rounded-md border px-3 py-2 text-sm" data-pickup-list-action="close-pickup-records">关闭</button>
      </div>
      <div class="space-y-3 p-5">
        ${groupDiscrepancies.length ? `<section class="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div class="text-sm font-semibold text-amber-800">领料差异与主管处理</div>
          ${groupDiscrepancies.map((record) => `<div class="rounded-md bg-white p-3 text-xs">
            <div class="font-medium">${escapeHtml(record.materialName)} · 差异 ${formatQty(record.differenceQty, record.unit)}</div>
            <div class="mt-1 text-muted-foreground">${escapeHtml(record.carrierLabel)} · ${escapeHtml(record.operatorName)} ${escapeHtml(record.reportedAt)}</div>
            <div class="mt-1">现场证据：${escapeHtml(record.photoName || '无照片')}；${escapeHtml(record.note || '无说明')}</div>
            ${record.status === '待主管处理'
              ? `<button type="button" class="mt-2 rounded-md bg-amber-600 px-3 py-2 font-medium text-white" data-pickup-list-action="resolve-pickup-discrepancy" data-discrepancy-id="${escapeHtml(record.discrepancyId)}">主管处理完成</button>`
              : `<div class="mt-2 text-emerald-700">已处理：${escapeHtml(record.handledBy)} ${escapeHtml(record.handledAt)} · ${escapeHtml(record.resolution)}</div>`}
          </div>`).join('')}
        </section>` : ''}
        ${group.pickupSessions.length ? group.pickupSessions.map((session) => {
          const snapshot = session.pickupNodeSnapshot
          const evidence = discrepancies.filter((record) =>
            record.pickupNodeId === session.pickupNodeId
            && record.pickupNodeVersion === session.pickupNodeVersion
          )
          const carrierLabel = snapshot?.carrierType === 'PALLET'
            ? snapshot.palletDisplayLabel || snapshot.palletId || '待领托盘（暂未编号）'
            : Array.from(new Set(snapshot?.items.flatMap((item) =>
                item.sourceLocations.map((location) =>
                  `${location.sourceWarehouseName} / ${location.sourceWarehouseArea} / ${location.sourceLocationCode}`
                )
              ) ?? [])).join('；') || '来源库位未记录'
          return `<article class="rounded-lg border bg-card p-4 text-sm">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="font-medium">${escapeHtml(session.pickupSessionNo)}</div>
              <div class="text-xs text-muted-foreground">节点 V${session.pickupNodeVersion}</div>
            </div>
            <div class="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
              <div>领取人：<span class="text-foreground">${escapeHtml(session.receiverName)}</span></div>
              <div>领取时间：<span class="text-foreground">${escapeHtml(session.pickedAt)}</span></div>
              <div class="sm:col-span-2">来源库位或托盘：<span class="text-foreground">${escapeHtml(carrierLabel)}</span></div>
              <div class="sm:col-span-2">接收位置：<span class="text-foreground">${escapeHtml(`${session.toWarehouseArea} / ${session.toLocationCode}`)}</span></div>
            </div>
            <div class="mt-3 space-y-1">
              ${(snapshot?.items ?? []).map((item) => `<div class="rounded bg-muted/50 px-2 py-1.5 text-xs">${escapeHtml(item.materialName)} · ${escapeHtml(item.materialSku)} · ${formatQty(item.currentAvailableQty, item.unit)}</div>`).join('')}
            </div>
            <div class="mt-3 text-xs">
              <span class="font-medium">异常证据：</span>
              ${evidence.length
                ? evidence.map((record) => `${record.photoName || '无照片'}；${record.note || '无说明'}；${record.supervisorRequestedBy || '待主管响应'}`).map(escapeHtml).join('<br>')
                : '<span class="text-muted-foreground">无</span>'}
            </div>
          </article>`
        }).join('') : '<div class="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">当前生产单尚无领料记录。</div>'}
      </div>
    </section>
  </div>`
}

function renderAllPickupOverlays(kind: PickupListKind): string {
  return `${renderColumnSettings(kind)}${renderPickupRecordsDrawer(kind)}`
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
  cancelPickupListDebouncesBeforeRender()
  groupSnapshots.set(kind, listPickupOrderGroups(kind))
  const state = getState(kind)
  state.currentPage = 1
  state.sort = null
  state.keyword = ''
  state.materialKeyword = ''
  state.demandSource = 'ALL'
  state.processRoute = 'ALL'
  state.readySource = 'ALL'
  state.palletNumbered = 'ALL'
  state.locationKeyword = ''
  state.shortageOnly = 'ALL'
  state.historyPath = 'ALL'
  state.finalResult = 'ALL'
  state.recentDate = ''
  const view = getView(kind)
  return `<div data-pickup-list-root="${kind}">
    ${renderStandardListPage({
      title: titleFor(kind),
      filtersHtml: renderFilters(kind, state),
      statsHtml: `<div data-pickup-list-region="stats">${renderStats(kind, view.groups)}</div>`,
      listTitle: `${titleFor(kind)}生产单`,
      listActionsHtml: withSkipPageRerender(renderSecondaryButton(
        '列设置',
        { prefix: EVENT_PREFIX, action: 'open-column-settings' },
        'columns-3',
      )),
      tableHtml: `<div data-pickup-list-region="table">${renderTableRegion(kind, view)}</div>`,
      paginationHtml: `<div data-pickup-list-region="pagination">${renderPaginationRegion(kind, view)}</div>`,
      overlaysHtml: `<div data-pickup-list-region="overlay">${renderAllPickupOverlays(kind)}</div>`,
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
  if (overlay) overlay.innerHTML = renderAllPickupOverlays(kind)
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
      if (filterField === 'locationKeyword') state.locationKeyword = nextValue
      if (filterField === 'recentDate') state.recentDate = nextValue
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
    }, PICKUP_LIST_FILTER_DEBOUNCE_MS))
    return true
  }

  const field = target.closest<HTMLSelectElement>('[data-pickup-list-field]')
  if (field && field.dataset.pickupListField !== 'pageSize' && event?.type === 'change') {
    const filterField = field.dataset.pickupListField || ''
    if (filterField === 'demandSource') state.demandSource = field.value
    if (filterField === 'processRoute') state.processRoute = field.value
    if (filterField === 'readySource') state.readySource = field.value
    if (filterField === 'palletNumbered') state.palletNumbered = field.value
    if (filterField === 'shortageOnly') state.shortageOnly = field.value
    if (filterField === 'historyPath') state.historyPath = field.value
    if (filterField === 'finalResult') state.finalResult = field.value
    state.currentPage = 1
    refreshPickupListRegions(kind)
    return true
  }
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

  if (action === 'resolve-pickup-discrepancy') {
    const discrepancyId = actionNode.dataset.discrepancyId || ''
    const resolution = window.prompt('请填写主管处理结论 / 说明', '已现场复核并处理差异')
    if (!resolution?.trim()) return true
    resolvePickupDiscrepancy(discrepancyId, {
      handledBy: '裁床主管 王芳',
      resolution,
    })
    groupSnapshots.set(kind, listPickupOrderGroups(kind))
    refreshPickupListRegions(kind)
    refreshPickupListOverlay(kind)
    return true
  }
  if (action === 'open-pickup-records') {
    state.selectedRecordGroupKey = actionNode.dataset.groupKey || ''
    refreshPickupListOverlay(kind)
    return true
  }
  if (action === 'close-pickup-records') {
    state.selectedRecordGroupKey = ''
    refreshPickupListOverlay(kind)
    return true
  }
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
