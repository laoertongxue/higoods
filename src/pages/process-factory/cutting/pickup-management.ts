// @page-pattern: list

import { renderBadge } from '../../../components/ui/badge.ts'
import type { BadgeVariant } from '../../../components/ui/types.ts'
import {
  listActivePickupNodes,
  listMaterialPrepOrderProjections,
  pickupStatusLabelMap,
  pickupWorkbenchTabs,
  recordPickupSessionWarehouseSyncResult,
  rejectMaterialPrepRecord,
  type MaterialPrepOrderProjection,
  type PickupOrderStatus,
} from '../../../data/fcs/cutting/production-material-prep.ts'
import type {
  PickupNodeProjection,
  PickupNodeItem,
  PickupSession,
} from '../../../data/fcs/cutting/pickup-node-domain.ts'
import {
  PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE,
  renderProductionObjectCodeButton,
  renderProductionOrderIdentityCell,
} from '../../../data/fcs/production-order-identity.ts'
import { escapeHtml } from '../../../utils.ts'
import { getCanonicalCuttingMeta, renderCuttingPageHeader } from './meta.ts'
import {
  loadListColumnPreferences,
  normalizeListColumnPreferences,
  paginateStandardListRows,
  saveListColumnPreferences,
  sortStandardListRows,
  type StandardListColumnPreferences,
  type StandardListSortState,
} from '../../../components/ui/list-table-model.ts'
import { renderStandardListTable, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'

const PREFERENCE_KEY = 'standard-list:/fcs/craft/cutting/pickup-management'
const PAGE_SIZES = [10, 20, 50]

function renderNodeTypeCell(node: PickupNodeProjection): string {
  const isReady = node.nodeType === 'READY_TO_PICKUP'
  return renderBadge(
    isReady ? '已配齐待领' : '未配齐清单',
    isReady ? 'success' : 'warning',
  )
}

function renderNodeOrderCell(node: PickupNodeProjection): string {
  return `<div class="space-y-1">
    <div class="cursor-pointer hover:underline" data-pickup-nav="detail" data-pickup-node-id="${escapeHtml(node.nodeId)}">${renderProductionOrderIdentityCell(node.productionOrderNo)}</div>
    <div class="text-xs text-muted-foreground">配料单：${escapeHtml(node.prepOrderNo)}</div>
    <div class="text-xs text-muted-foreground">第 ${node.sequence} 轮领料</div>
  </div>`
}

function renderNodeMaterialsCell(node: PickupNodeProjection): string {
  return `<div class="space-y-1">
    ${node.items.slice(0, 3).map((item) => `
      <div class="flex items-center gap-2 rounded bg-muted/40 px-2 py-1 text-xs">
        <span class="font-medium">${escapeHtml(item.materialName)}</span>
        <span class="text-muted-foreground">${escapeHtml(item.color)}</span>
        <span class="text-muted-foreground">${formatQty(item.currentAvailableQty, item.unit)}</span>
        <span class="text-muted-foreground">${escapeHtml(item.sourceWarehouseName)}</span>
      </div>
    `).join('')}
    ${node.items.length > 3 ? `<div class="text-xs text-muted-foreground">还有 ${node.items.length - 3} 项物料...</div>` : ''}
  </div>`
}

function renderEffectivePickedCell(node: PickupNodeProjection): string {
  const summaries = buildPickupUnitSummaries(node.items, (item) => item.effectivePickedQty)
  const lines = node.items.filter((item) => item.effectivePickedQty > 0).length
  return `<div class="text-sm">
    <div class="font-medium tabular-nums">${summaries.map((item) => formatQty(item.qty, item.unit)).join(' / ') || '0'}</div>
    <div class="text-xs text-muted-foreground">${lines} 行有已领记录</div>
  </div>`
}

function renderRemainingShortageCell(node: PickupNodeProjection): string {
  const shortageItems = node.items.map((item) => ({
    ...item,
    shortageQty: Math.max(item.requiredQty - item.effectivePickedQty - item.currentAvailableQty, 0),
  }))
  const shortageCount = shortageItems.filter((item) => item.shortageQty > 0).length
  if (!shortageCount) {
    return `<span class="text-sm text-emerald-600 font-medium">本轮收尾，无缺口</span>`
  }
  const summaries = new Map<string, number>()
  for (const item of shortageItems) summaries.set(item.unit, (summaries.get(item.unit) || 0) + item.shortageQty)
  return `<div class="text-sm">
    <div class="font-medium tabular-nums text-amber-600">${Array.from(summaries).map(([unit, qty]) => formatQty(qty, unit)).join(' / ')}</div>
    <div class="text-xs text-muted-foreground">仍缺 ${shortageCount} 行物料</div>
  </div>`
}

function renderNodeSourceLocationCell(node: PickupNodeProjection): string {
  const locations = Array.from(new Set(node.items.flatMap((item) => item.sourceLocations.map((location) =>
    `${location.sourceWarehouseName} / ${location.sourceWarehouseArea} / ${location.sourceLocationCode}`
  ))))
  return `<div class="text-xs space-y-0.5">
    ${locations.slice(0, 3).map((loc) => `<div>${escapeHtml(loc)}</div>`).join('')}
    ${locations.length > 3 ? `<div class="text-muted-foreground">等 ${locations.length} 处</div>` : ''}
  </div>`
}

function renderNodeActions(node: PickupNodeProjection): string {
  const detailHref = `/fcs/craft/cutting/pickup-management-detail?pickupNodeId=${encodeURIComponent(node.nodeId)}`
  const pdaHref = `/fcs/pda/warehouse/wait-process?scope=cutting&action=pickup&pickupNodeId=${encodeURIComponent(node.nodeId)}&version=${node.version}`
  return `<div class="flex flex-wrap gap-1.5">
    <a href="${escapeHtml(detailHref)}" data-pickup-nav="detail" data-pickup-node-id="${escapeHtml(node.nodeId)}" class="rounded-md border px-2 py-1.5 text-xs hover:bg-muted">查看当前节点</a>
    <a href="${escapeHtml(pdaHref)}" data-pickup-action="open-pda-pickup" data-pickup-node-id="${escapeHtml(node.nodeId)}" data-pickup-node-version="${node.version}" class="rounded-md bg-blue-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-blue-700">办理领料入库</a>
  </div>`
}

const PICKUP_NODE_COLUMNS: StandardListColumn<PickupNodeProjection>[] = [
  { key: 'nodeType', title: '当前领料节点', width: 130, required: true, sortable: true, render: renderNodeTypeCell },
  { key: 'productionOrder', title: PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE, width: 220, required: true, sortable: true, render: renderNodeOrderCell },
  { key: 'materials', title: '当前节点全部物料', width: 400, required: true, render: renderNodeMaterialsCell },
  { key: 'picked', title: '历史有效已领', width: 160, required: true, sortable: true, render: renderEffectivePickedCell },
  { key: 'shortage', title: '领后剩余缺口', width: 170, required: true, sortable: true, render: renderRemainingShortageCell },
  { key: 'sourceLocation', title: '中转仓承载位置', width: 200, required: true, render: renderNodeSourceLocationCell },
  { key: 'updatedAt', title: '节点更新时间', width: 160, required: true, sortable: true, render: (node) => `<span class="text-sm">${escapeHtml(node.updatedAt)}</span>` },
  { key: 'actions', title: '操作', width: 200, required: true, actionColumn: true, freezeable: false, render: renderNodeActions },
]

interface PickupWorkbenchRow {
  rowKind: 'ACTIVE_NODE' | 'REJECTED_ORDER' | 'PICKUP_SESSION' | 'CLOSED_ORDER'
  rowId: string
  status: PickupOrderStatus
  projection: MaterialPrepOrderProjection
  node?: PickupNodeProjection
  session?: PickupSession
}

const PICKUP_HISTORY_COLUMNS: StandardListColumn<PickupWorkbenchRow>[] = [
  {
    key: 'status',
    title: '领料状态',
    width: 150,
    required: true,
    sortable: true,
    render: (row) => `<div data-pickup-row-kind="${row.rowKind}">${renderStatus(
      row.session?.status || pickupStatusLabelMap[row.status],
      row.status === 'PICKUP_DONE' ? 'success' : row.status === 'REJECTED_WAIT_WLS' ? 'danger' : 'neutral',
    )}</div>`,
  },
  {
    key: 'productionOrder',
    title: PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE,
    width: 240,
    required: true,
    sortable: true,
    render: (row) => `<div class="space-y-1">
      ${renderProductionOrderIdentityCell(row.projection.order.productionOrderNo)}
      <div class="text-xs text-muted-foreground">配料单：${escapeHtml(row.projection.order.prepOrderNo)}</div>
      ${row.session ? `<div class="text-xs text-muted-foreground">${escapeHtml(row.session.pickupSessionNo)} / 节点版本 V${row.session.pickupNodeVersion}</div>` : ''}
    </div>`,
  },
  {
    key: 'materials',
    title: '本次物料事实',
    width: 360,
    required: true,
    render: (row) => {
      const items = getHistoryRowItems(row)
      if (!items.length) {
        const rejected = row.projection.prepRecords.filter((record) => record.recordStatus === 'REJECTED')
        return rejected.length
          ? `<div class="text-sm text-rose-700">${rejected.length} 条配料记录已打回，等待中转仓处理</div>`
          : '<div class="text-sm text-muted-foreground">按实关闭，不再等待后续配料</div>'
      }
      return `<div class="space-y-1">${items.slice(0, 4).map((item) => `
        <div class="rounded bg-muted/40 px-2 py-1 text-xs">${escapeHtml(item.materialName)} / ${formatQty(item.qty, item.unit)} / ${item.rollCount} 卷件</div>
      `).join('')}${items.length > 4 ? `<div class="text-xs text-muted-foreground">还有 ${items.length - 4} 项</div>` : ''}</div>`
    },
  },
  {
    key: 'source',
    title: '来源位置',
    width: 260,
    required: true,
    render: (row) => {
      const locations = Array.from(new Set(getHistoryRowItems(row).flatMap((item) => item.sourceLocations)))
      return locations.length
        ? `<div class="space-y-1 text-xs">${locations.map((location) => `<div>${escapeHtml(location)}</div>`).join('')}</div>`
        : '<span class="text-xs text-muted-foreground">—</span>'
    },
  },
  {
    key: 'confirm',
    title: '确认信息',
    width: 180,
    required: true,
    sortable: true,
    render: (row) => row.session
      ? `<div class="text-xs"><div>${escapeHtml(row.session.receiverName)}</div><div class="text-muted-foreground">${escapeHtml(row.session.pickedAt)}</div><div>${escapeHtml(row.session.toWarehouseArea)} / ${escapeHtml(row.session.toLocationCode)}</div></div>`
      : `<div class="text-xs text-muted-foreground">${escapeHtml(row.projection.latestOperatorName || '—')}<br>${escapeHtml(row.projection.latestOperatedAt || '')}</div>`,
  },
  {
    key: 'actions',
    title: '操作',
    width: 170,
    required: true,
    actionColumn: true,
    freezeable: false,
    render: (row) => {
      if (row.session) {
        const detailHref = `/fcs/craft/cutting/pickup-management-detail?pickupNodeId=${encodeURIComponent(row.session.pickupNodeId)}`
        return `<div class="flex flex-wrap gap-1.5">
          <a href="${escapeHtml(detailHref)}" class="rounded-md border px-2 py-1.5 text-xs hover:bg-muted">查看领料详情</a>
          ${row.session.warehouseSyncStatus === '回写异常待重试' ? `<button type="button" data-pickup-action="retry-sync" data-pickup-session-id="${escapeHtml(row.session.pickupSessionId)}" class="rounded-md border border-amber-300 px-2 py-1.5 text-xs text-amber-700">重试仓储回写</button>` : ''}
        </div>`
      }
      return `<a href="/fcs/craft/cutting/material-prep-detail?id=${encodeURIComponent(row.projection.order.prepOrderId)}" class="rounded-md border px-2 py-1.5 text-xs hover:bg-muted">查看配料单</a>`
    },
  },
]

interface PickupListFilters {
  keyword: string
  materialKeyword: string
  nodeType: '全部' | 'INCOMPLETE_PICKABLE' | 'READY_TO_PICKUP'
}

interface PickupListState {
  activeTab: PickupOrderStatus
  filters: PickupListFilters
  page: number
  pageSize: number
  sort: StandardListSortState | null
  columnPreferences: StandardListColumnPreferences
  columnSettingsOpen: boolean
  selectedPickupNodeId: string
}

const state: PickupListState = (() => {
  const params = getSearchParams()
  const storage = typeof localStorage !== 'undefined' ? localStorage : null
  return {
    activeTab: normalizePickupWorkbenchTab(params.get('tab')),
    filters: getPickupListFilters(params),
    page: Math.max(Number(params.get('page') || '1'), 1),
    pageSize: Number(params.get('pageSize') || String(PAGE_SIZES[0])),
    sort: parseSort(params.get('sort')),
    columnPreferences: storage
      ? loadListColumnPreferences(
          storage,
          PREFERENCE_KEY,
          PICKUP_NODE_COLUMNS,
          { order: [], visibleKeys: [], frozenKeys: [], pageSize: PAGE_SIZES[0] },
          PAGE_SIZES,
        )
      : normalizeListColumnPreferences(
          PICKUP_NODE_COLUMNS,
          { order: [], visibleKeys: [], frozenKeys: [], pageSize: PAGE_SIZES[0] },
          PAGE_SIZES,
        ),
    columnSettingsOpen: false,
    selectedPickupNodeId: params.get('pickupNodeId') || '',
  }
})()

function syncStateToUrl(): void {
  const params = new URLSearchParams()
  params.set('tab', state.activeTab)
  if (state.filters.keyword) params.set('q', state.filters.keyword)
  if (state.filters.materialKeyword) params.set('material', state.filters.materialKeyword)
  if (state.filters.nodeType !== '全部') params.set('nodeType', state.filters.nodeType)
  if (state.page > 1) params.set('page', String(state.page))
  if (state.pageSize !== PAGE_SIZES[0]) params.set('pageSize', String(state.pageSize))
  if (state.sort) params.set('sort', `${state.sort.key}:${state.sort.direction}`)
  const path = window.location.pathname
  const query = params.toString()
  const href = query ? `${path}?${query}` : path
  if (window.location.search !== `?${query}`) {
    window.history.replaceState({}, '', href)
  }
}

function getSearchParams(): URLSearchParams {
  if (typeof window === 'undefined') return new URLSearchParams()
  return new URLSearchParams(window.location.search)
}

function parseSort(raw: string | null): StandardListSortState | null {
  if (!raw) return null
  const [column, direction] = raw.split(':')
  if (direction === 'asc' || direction === 'desc') return { key: column, direction }
  return null
}

function normalizePickupWorkbenchTab(value: string | null): PickupOrderStatus {
  const matched = pickupWorkbenchTabs.find((tab) => tab.key === value)
  return matched?.key || 'WAIT_PICKUP'
}

function getPickupListFilters(params = getSearchParams()): PickupListFilters {
  return {
    keyword: (params.get('q') || '').trim(),
    materialKeyword: (params.get('material') || '').trim(),
    nodeType: (params.get('nodeType') as PickupListFilters['nodeType']) || '全部',
  }
}

function formatQty(value: number, unit = 'yard'): string {
  return `${Number(value || 0).toLocaleString('zh-CN', { maximumFractionDigits: 2 })} ${unit}`
}

function buildPickupUnitSummaries(
  items: PickupNodeItem[],
  getQty: (item: PickupNodeItem) => number,
): Array<{ unit: string; qty: number }> {
  const summaries = new Map<string, number>()
  for (const item of items) {
    summaries.set(item.unit, (summaries.get(item.unit) || 0) + Number(getQty(item) || 0))
  }
  return Array.from(summaries, ([unit, qty]) => ({ unit, qty }))
}

function renderStatus(status: string, variant: BadgeVariant = 'neutral'): string {
  return renderBadge(status, variant)
}

function getListSortValue<T>(columns: StandardListColumn<T>[], row: T, key: string): unknown {
  const column = columns.find((item) => item.key === key)
  if (column?.sortValue) return column.sortValue(row)
  return (row as Record<string, unknown>)[key]
}

function matchesPickupNode(node: PickupNodeProjection, filters: PickupListFilters): boolean {
  const keyword = filters.keyword.toLowerCase()
  const materialKeyword = filters.materialKeyword.toLowerCase()
  if (filters.nodeType !== '全部' && node.nodeType !== filters.nodeType) return false
  if (keyword) {
    const text = [
      node.prepOrderNo,
      node.productionOrderNo,
    ].join(' ').toLowerCase()
    if (!text.includes(keyword)) return false
  }
  if (materialKeyword) {
    const text = node.items
      .map((item) => `${item.materialSku} ${item.materialName} ${item.color} ${item.materialType}`)
      .join(' ')
      .toLowerCase()
    if (!text.includes(materialKeyword)) return false
  }
  return true
}

function renderPickupFilters(filters: PickupListFilters): string {
  return `
    <section class="rounded-lg border bg-card p-4" data-pickup-region="filters">
      <div class="grid gap-3 md:grid-cols-[minmax(200px,1fr)_minmax(180px,1fr)_auto_auto_auto] md:items-end">
        <label class="space-y-1 text-sm">
          <span class="font-medium text-foreground">关键词</span>
          <input class="h-10 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(filters.keyword)}" placeholder="生产单 / 配料单" data-pickup-filter="keyword" />
        </label>
        <label class="space-y-1 text-sm">
          <span class="font-medium text-foreground">物料</span>
          <input class="h-10 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(filters.materialKeyword)}" placeholder="物料 SKU / 名称" data-pickup-filter="materialKeyword" />
        </label>
        <label class="space-y-1 text-sm">
          <span class="font-medium text-foreground">节点类型</span>
          <select class="h-10 w-full rounded-md border bg-background px-3 text-sm" data-pickup-filter="nodeType">
            <option value="全部" ${filters.nodeType === '全部' ? 'selected' : ''}>全部</option>
            <option value="INCOMPLETE_PICKABLE" ${filters.nodeType === 'INCOMPLETE_PICKABLE' ? 'selected' : ''}>未配齐清单</option>
            <option value="READY_TO_PICKUP" ${filters.nodeType === 'READY_TO_PICKUP' ? 'selected' : ''}>已配齐待领</option>
          </select>
        </label>
        <button type="button" class="h-10 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-pickup-action="apply-filters">查询</button>
        <button type="button" class="h-10 rounded-md border px-4 text-sm hover:bg-muted" data-pickup-action="reset-filters">重置</button>
      </div>
    </section>
  `
}

function renderTabs(allRows: MaterialPrepOrderProjection[]): string {
  const activeNodes = listActivePickupNodes()
  const workbenchRows = buildPickupWorkbenchRows(activeNodes, allRows)
  return `
    <div class="flex flex-wrap gap-2" data-pickup-region="tabs">
      ${pickupWorkbenchTabs.map((tab) => {
        const count = workbenchRows.filter((row) => row.status === tab.key).length
        return `
          <button type="button" data-pickup-action="switch-tab" data-pickup-tab="${escapeHtml(tab.key)}" class="rounded-md border px-3 py-2 text-sm ${tab.key === state.activeTab ? 'bg-blue-600 text-white' : 'bg-background hover:bg-muted'}">
            ${escapeHtml(tab.label)} <span class="ml-1 text-xs opacity-80">${count}</span>
          </button>
        `
      }).join('')}
  `
}

function buildPickupWorkbenchRows(
  activeNodes = listActivePickupNodes(),
  projections = listMaterialPrepOrderProjections(),
): PickupWorkbenchRow[] {
  const projectionsById = new Map(projections.map((projection) => [projection.order.prepOrderId, projection]))
  const activeRows: PickupWorkbenchRow[] = activeNodes.flatMap((node) => {
    const projection = projectionsById.get(node.prepOrderId)
    return projection ? [{
      rowKind: 'ACTIVE_NODE',
      rowId: node.nodeId,
      status: 'WAIT_PICKUP',
      projection,
      node,
    }] : []
  })
  const rejectedRows: PickupWorkbenchRow[] = projections
    .filter((projection) => projection.order.pickupStatus === 'REJECTED_WAIT_WLS')
    .map((projection) => ({
      rowKind: 'REJECTED_ORDER',
      rowId: `rejected:${projection.order.prepOrderId}`,
      status: 'REJECTED_WAIT_WLS',
      projection,
    }))
  const sessionRows: PickupWorkbenchRow[] = projections.flatMap((projection) =>
    projection.pickupSessions.map((session) => ({
      rowKind: 'PICKUP_SESSION',
      rowId: session.pickupSessionId,
      status: 'PICKUP_DONE',
      projection,
      session,
    } as PickupWorkbenchRow))
  )
  const closedRows: PickupWorkbenchRow[] = projections
    .filter((projection) => projection.order.pickupStatus === 'ACTUAL_CLOSED')
    .map((projection) => ({
      rowKind: 'CLOSED_ORDER',
      rowId: `closed:${projection.order.prepOrderId}`,
      status: 'ACTUAL_CLOSED',
      projection,
    }))
  return [...activeRows, ...rejectedRows, ...sessionRows, ...closedRows]
}

function getPickupWorkbenchRowsForActiveTab(): PickupWorkbenchRow[] {
  return buildPickupWorkbenchRows().filter((row) => row.status === state.activeTab)
}

function getHistoryRowItems(row: PickupWorkbenchRow): Array<{
  materialName: string
  unit: string
  qty: number
  rollCount: number
  sourceLocations: string[]
}> {
  if (row.node) {
    return row.node.items.map((item) => ({
      materialName: item.materialName,
      unit: item.unit,
      qty: item.currentAvailableQty,
      rollCount: item.rollCount,
      sourceLocations: item.sourceLocations.map((location) =>
        `${location.sourceWarehouseName} / ${location.sourceWarehouseArea} / ${location.sourceLocationCode}`
      ),
    }))
  }
  if (!row.session) return []
  return row.projection.pickupRecords
    .filter((record) => record.pickupSessionId === row.session?.pickupSessionId)
    .map((record) => {
      const line = row.projection.lines.find((item) => item.prepLineId === record.prepLineId)
      return {
        materialName: line?.materialName || record.prepLineId,
        unit: line?.unit || record.sourceAllocations?.[0]?.unit || '件',
        qty: record.pickedQty,
        rollCount: record.rollCount,
        sourceLocations: (record.sourceAllocations || []).map((allocation) =>
          `${allocation.sourceWarehouseName} / ${allocation.sourceWarehouseArea} / ${allocation.sourceLocationCode}`
        ),
      }
    })
}

function matchesPickupWorkbenchRow(row: PickupWorkbenchRow, filters: PickupListFilters): boolean {
  if (row.node) return matchesPickupNode(row.node, filters)
  if (filters.nodeType !== '全部') return false
  const order = row.projection.order
  const keyword = filters.keyword.toLowerCase()
  const materialKeyword = filters.materialKeyword.toLowerCase()
  if (keyword && !`${order.prepOrderNo} ${order.productionOrderNo} ${row.session?.pickupSessionNo || ''}`.toLowerCase().includes(keyword)) return false
  if (materialKeyword) {
    const text = row.projection.lines.map((line) => `${line.materialSku} ${line.materialName} ${line.color} ${line.materialType}`).join(' ').toLowerCase()
    if (!text.includes(materialKeyword)) return false
  }
  return true
}

function renderNodeStats(nodes: PickupNodeProjection[]): string {
  const incomplete = nodes.filter((n) => n.nodeType === 'INCOMPLETE_PICKABLE').length
  const ready = nodes.filter((n) => n.nodeType === 'READY_TO_PICKUP').length
  return renderStandardListStats([
    { label: '未配齐清单', value: `${incomplete}` },
    { label: '已配齐待领', value: `${ready}` },
    { label: '当前可领节点', value: `${nodes.length}` },
  ])
}

export function renderCraftCuttingPickupManagementPage(): string {
  state.activeTab = normalizePickupWorkbenchTab(getSearchParams().get('tab'))
  const allNodes = listActivePickupNodes()
  const allRows = listMaterialPrepOrderProjections()
  const isWaiting = state.activeTab === 'WAIT_PICKUP'
  const filteredNodes = allNodes.filter((node) => matchesPickupNode(node, state.filters))
  const filteredHistoryRows = getPickupWorkbenchRowsForActiveTab().filter((row) => matchesPickupWorkbenchRow(row, state.filters))
  const sortedNodes = state.sort ? sortStandardListRows(filteredNodes, state.sort, (row, key) => getListSortValue(PICKUP_NODE_COLUMNS, row, key)) : filteredNodes
  const sortedHistoryRows = state.sort ? sortStandardListRows(filteredHistoryRows, state.sort, (row, key) => getListSortValue(PICKUP_HISTORY_COLUMNS, row, key)) : filteredHistoryRows
  const paging = isWaiting
    ? paginateStandardListRows(sortedNodes, state.page, state.pageSize)
    : paginateStandardListRows(sortedHistoryRows, state.page, state.pageSize)

  const tableHtml = `
    <div data-pickup-region="table">
      ${isWaiting
        ? renderStandardListTable({
            columns: PICKUP_NODE_COLUMNS,
            rows: paging.rows as PickupNodeProjection[],
            preferences: state.columnPreferences,
            sort: state.sort,
            eventPrefix: 'pickup-list',
            emptyText: '当前暂无待领节点，等待中转仓确认配料后会自动出现。',
          })
        : renderStandardListTable({
            columns: PICKUP_HISTORY_COLUMNS,
            rows: paging.rows as PickupWorkbenchRow[],
            preferences: normalizeListColumnPreferences(PICKUP_HISTORY_COLUMNS, state.columnPreferences, PAGE_SIZES),
            sort: state.sort,
            eventPrefix: 'pickup-list',
            emptyText: '当前状态下暂无领料记录。',
          })}
    </div>`

  const paginationHtml = `
    <div data-pickup-region="pagination">
      ${renderTablePagination({
        total: paging.total,
        from: paging.from,
        to: paging.to,
        currentPage: paging.currentPage,
        totalPages: paging.totalPages,
        pageSize: paging.pageSize,
        actionPrefix: 'pickup',
        pageSizeOptions: PAGE_SIZES,
      })}
    </div>`

  return renderStandardListPage({
    title: '领料管理',
    filtersHtml: `
      ${renderTabs(allRows)}
      <div class="mt-3" data-pickup-region="stats">${isWaiting
        ? renderNodeStats(filteredNodes)
        : renderStandardListStats([
            { label: pickupStatusLabelMap[state.activeTab], value: `${filteredHistoryRows.length}` },
            { label: '关联生产单', value: `${new Set(filteredHistoryRows.map((row) => row.projection.order.productionOrderId)).size}` },
            { label: '当前页签', value: pickupStatusLabelMap[state.activeTab] },
          ])}</div>
      <div class="mt-3">${renderPickupFilters(state.filters)}</div>
    `,
    listTitle: `${pickupStatusLabelMap[state.activeTab]}（${isWaiting ? filteredNodes.length : filteredHistoryRows.length}）`,
    tableHtml,
    paginationHtml,
  })
}

function renderNodeDetailContent(node: PickupNodeProjection): string {
  const isReady = node.nodeType === 'READY_TO_PICKUP'
  return `
    <section class="space-y-4">
      <div class="rounded-lg border bg-card p-4">
        <h2 class="text-base font-semibold">当前节点全部物料</h2>
        <div class="mt-3 grid grid-cols-2 gap-3 text-sm lg:grid-cols-5">
          <div><span class="text-xs text-muted-foreground">节点类型</span><div class="font-medium">${renderNodeTypeCell(node)}</div></div>
          <div><span class="text-xs text-muted-foreground">生产单</span><div class="font-medium">${renderProductionOrderIdentityCell(node.productionOrderNo)}</div></div>
          <div><span class="text-xs text-muted-foreground">配料单</span><div class="font-medium">${escapeHtml(node.prepOrderNo)}</div></div>
          <div><span class="text-xs text-muted-foreground">第几轮</span><div class="font-medium">第 ${node.sequence} 轮领料</div></div>
          <div><span class="text-xs text-muted-foreground">节点版本</span><div class="font-medium">V${node.version} / ${escapeHtml(node.updatedAt)}</div></div>
        </div>
      </div>

      <div class="rounded-lg border bg-card p-4">
        <h3 class="text-base font-semibold">物料明细</h3>
        <div class="mt-2 overflow-x-auto">
          <table class="w-full min-w-[1024px] text-left text-sm">
            <thead class="bg-muted/60 text-xs text-muted-foreground">
              <tr>
                <th class="px-3 py-2">物料</th>
                <th class="px-3 py-2">需求数量</th>
                <th class="px-3 py-2">历史有效已领</th>
                <th class="px-3 py-2">当前可领</th>
                <th class="px-3 py-2">领后剩余</th>
                <th class="px-3 py-2">来源仓库/库位</th>
              </tr>
            </thead>
            <tbody>
              ${node.items.map((item) => `
                <tr class="border-t">
                  <td class="px-3 py-3">
                    <div class="font-medium">${escapeHtml(item.materialName)}</div>
                    <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.materialSku)} / ${escapeHtml(item.color)} / ${escapeHtml(item.spec)}</div>
                    <span class="mt-1 inline-block rounded px-1.5 py-0.5 text-xs bg-muted">${escapeHtml(item.materialType)}</span>
                  </td>
                  <td class="px-3 py-3">${formatQty(item.requiredQty, item.unit)}</td>
                  <td class="px-3 py-3">${formatQty(item.effectivePickedQty, item.unit)}</td>
                  <td class="px-3 py-3 font-medium">${formatQty(item.currentAvailableQty, item.unit)}</td>
                  <td class="px-3 py-3">${formatQty(Math.max(item.requiredQty - item.effectivePickedQty - item.currentAvailableQty, 0), item.unit)}</td>
                  <td class="px-3 py-3 text-xs text-muted-foreground">
                    ${item.sourceLocations.map((location) => `
                      <div>${escapeHtml(location.sourceWarehouseName)} / ${escapeHtml(location.sourceWarehouseArea)} / ${escapeHtml(location.sourceLocationCode)} / ${formatQty(location.currentAvailableQty, location.unit)} / ${location.rollCount} 卷件</div>
                    `).join('')}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      ${!isReady ? `
        <div class="rounded-lg border border-amber-200 bg-amber-50/40 p-4">
          <h3 class="text-base font-semibold text-amber-700">仍缺物料</h3>
          <div class="mt-2 text-sm text-amber-600">当前节点物料未满足生产单全部需求，领料后中转仓继续等待剩余物料。</div>
        </div>
      ` : `
        <div class="rounded-lg border border-emerald-200 bg-emerald-50/40 p-4">
          <h3 class="text-base font-semibold text-emerald-700">本轮为收尾领料</h3>
          <div class="mt-2 text-sm text-emerald-600">当前节点已覆盖全部需求，本次领料为最后一轮。</div>
        </div>
      `}

      <div class="flex flex-wrap gap-2">
        <a href="/fcs/pda/warehouse/wait-process?scope=cutting&action=pickup&pickupNodeId=${encodeURIComponent(node.nodeId)}&version=${node.version}" class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">去 PDA 办理领料入库</a>
        <button type="button" data-pickup-action="reject-prep" data-pickup-node-id="${escapeHtml(node.nodeId)}" class="rounded-md border border-rose-200 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50">打回中转仓</button>
      </div>
    </section>
  `
}

function renderSessionHistory(projection: MaterialPrepOrderProjection | null): string {
  if (!projection || !projection.pickupSessions.length) {
    return `
      <section class="rounded-lg border bg-card p-4">
        <h3 class="text-base font-semibold">领料历史</h3>
        <div class="mt-2 text-sm text-muted-foreground">暂无领料记录。</div>
      </section>
    `
  }

  return `
    <section class="rounded-lg border bg-card p-4">
      <h3 class="text-base font-semibold">领料主记录</h3>
      <div class="mt-3 space-y-4">
        ${projection.pickupSessions.map((session) => {
          const records = projection.pickupRecords.filter((r) => r.pickupSessionId === session.pickupSessionId)
          return `
            <div class="rounded-md border bg-background p-3">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div class="font-medium">${escapeHtml(session.pickupSessionNo)}</div>
                  <div class="mt-1 text-xs text-muted-foreground">${renderBadge(session.status, 'success')}</div>
                  <div class="mt-1 text-xs text-muted-foreground">领取人：${escapeHtml(session.receiverName)} / ${escapeHtml(session.pickedAt)}</div>
                  <div class="mt-1 text-xs text-muted-foreground">入仓：${escapeHtml(session.toWarehouseArea)} / ${escapeHtml(session.toLocationCode)}</div>
                  <div class="mt-1 text-xs text-muted-foreground">仓储同步：${renderBadge(session.warehouseSyncStatus === '已回写' ? '已回写' : '回写异常待重试', session.warehouseSyncStatus === '已回写' ? 'success' : 'warning')}</div>
                </div>
              </div>
              <details class="mt-2">
                <summary class="cursor-pointer text-xs text-blue-600 hover:text-blue-700">展开领料明细（${records.length} 条）</summary>
                <div class="mt-2 overflow-x-auto">
                  <table class="w-full text-left text-xs">
                    <thead class="bg-muted/60 text-muted-foreground">
                      <tr>
                        <th class="px-2 py-1">物料</th>
                        <th class="px-2 py-1">领料数量</th>
                        <th class="px-2 py-1">来源配料记录</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${records.map((r) => {
                        const line = projection.lines.find((l) => l.prepLineId === r.prepLineId)
                        return `
                          <tr class="border-t">
                            <td class="px-2 py-1">${escapeHtml(line?.materialName || r.prepLineId)}</td>
                            <td class="px-2 py-1">${formatQty(r.pickedQty, line?.unit || 'yard')}</td>
                            <td class="px-2 py-1 text-muted-foreground">${escapeHtml(r.prepRecordId)}</td>
                          </tr>
                        `
                      }).join('')}
                    </tbody>
                  </table>
                </div>
              </details>
            </div>
          `
        }).join('')}
      </div>
    </section>
  `
}

export function renderCraftCuttingPickupManagementDetailPage(): string {
  const params = getSearchParams()
  const pickupNodeId = params.get('pickupNodeId') || state.selectedPickupNodeId || ''
  const projections = listMaterialPrepOrderProjections()
  const allNodes = listActivePickupNodes()
  const node = allNodes.find((n) => n.nodeId === pickupNodeId) || null
  const historicalProjection = projections.find((projection) =>
    projection.pickupSessions.some((session) => session.pickupNodeId === pickupNodeId)
  ) || null
  const historicalSession = historicalProjection?.pickupSessions.find((session) => session.pickupNodeId === pickupNodeId) || null

  if (!node && !historicalSession) {
    return `
      <div class="space-y-5 p-6">
        ${renderCuttingPageHeader(getCanonicalCuttingMeta('pickup-management'), {
          actionsHtml: `<button type="button" class="rounded-md border px-4 py-2 text-sm" data-nav="/fcs/craft/cutting/pickup-management">返回领料列表</button>`,
        })}
        <section class="rounded-lg border bg-card px-4 py-10 text-center text-sm text-muted-foreground">未找到该领料节点，可能已被领取或不存在。</section>
      </div>
    `
  }

  const projection = node
    ? projections.find((item) => item.order.prepOrderId === node.prepOrderId) || null
    : historicalProjection
  const productionOrderNo = node?.productionOrderNo || projection?.order.productionOrderNo || ''
  const prepOrderNo = node?.prepOrderNo || projection?.order.prepOrderNo || ''

  return `
    <div class="space-y-5 p-6">
      <header class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div class="text-sm text-muted-foreground">工艺工厂运营系统 / 裁床厂管理 / 裁前准备 / 领料管理</div>
          <h1 class="mt-1 text-2xl font-bold">领料详情</h1>
          <p class="mt-2 text-sm text-muted-foreground">生产单 ${renderProductionOrderIdentityCell(productionOrderNo)} / 配料单 ${escapeHtml(prepOrderNo)}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button type="button" class="rounded-md border px-4 py-2 text-sm" data-nav="/fcs/craft/cutting/pickup-management">返回领料列表</button>
        </div>
      </header>
      ${node ? renderNodeDetailContent(node) : `
        <section class="rounded-lg border bg-card p-4">
          <h2 class="text-base font-semibold">已完成领料节点</h2>
          <div class="mt-3 grid gap-3 text-sm md:grid-cols-4">
            <div><span class="text-xs text-muted-foreground">领料主记录</span><div class="font-medium">${escapeHtml(historicalSession?.pickupSessionNo || '')}</div></div>
            <div><span class="text-xs text-muted-foreground">节点版本</span><div class="font-medium">V${historicalSession?.pickupNodeVersion || 1}</div></div>
            <div><span class="text-xs text-muted-foreground">本轮结果</span><div class="font-medium">${renderBadge(historicalSession?.status || '本轮已领完', 'success')}</div></div>
            <div><span class="text-xs text-muted-foreground">仓储同步</span><div class="font-medium">${renderBadge(historicalSession?.warehouseSyncStatus || '已回写', historicalSession?.warehouseSyncStatus === '回写异常待重试' ? 'warning' : 'success')}</div></div>
          </div>
        </section>
      `}
      ${renderSessionHistory(projection)}
    </div>
  `
}

export function handleCraftCuttingPickupManagementEvent(target: HTMLElement): boolean {
  const actionNode = target.closest<HTMLElement>('[data-pickup-action]')
  const action = actionNode?.dataset.pickupAction
  if (!actionNode || !action) return false

  if (action === 'apply-filters') {
    const keyword = document.querySelector<HTMLInputElement>('[data-pickup-filter="keyword"]')?.value.trim() || ''
    const materialKeyword = document.querySelector<HTMLInputElement>('[data-pickup-filter="materialKeyword"]')?.value.trim() || ''
    const nodeType = document.querySelector<HTMLSelectElement>('[data-pickup-filter="nodeType"]')?.value || '全部'
    state.filters = { keyword, materialKeyword, nodeType: nodeType as PickupListFilters['nodeType'] }
    state.page = 1
    syncStateToUrl()
    refreshPickupRegions()
    return true
  }

  if (action === 'reset-filters') {
    state.filters = { keyword: '', materialKeyword: '', nodeType: '全部' }
    state.page = 1
    syncStateToUrl()
    refreshPickupRegions()
    return true
  }

  if (action === 'switch-tab') {
    const tab = actionNode.dataset.pickupTab as PickupOrderStatus
    state.activeTab = tab
    state.page = 1
    state.filters = { keyword: '', materialKeyword: '', nodeType: '全部' }
    syncStateToUrl()
    refreshPickupRegions()
    return true
  }

  if (action === 'go-page') {
    const page = Number(actionNode.dataset.pickupPage)
    if (!isNaN(page) && page > 0) {
      state.page = page
      syncStateToUrl()
      refreshPickupRegions()
    }
    return true
  }

  if (action === 'prev-page') {
    if (state.page > 1) {
      state.page -= 1
      syncStateToUrl()
      refreshPickupRegions()
    }
    return true
  }

  if (action === 'next-page') {
    const filtered = state.activeTab === 'WAIT_PICKUP'
      ? listActivePickupNodes().filter((node) => matchesPickupNode(node, state.filters))
      : getPickupWorkbenchRowsForActiveTab().filter((row) => matchesPickupWorkbenchRow(row, state.filters))
    const totalPages = Math.ceil(filtered.length / state.pageSize)
    if (state.page < totalPages) {
      state.page += 1
      syncStateToUrl()
      refreshPickupRegions()
    }
    return true
  }

  if (action === 'reject-prep') {
    const nodeId = actionNode.dataset.pickupNodeId || ''
    const node = listActivePickupNodes().find((n) => n.nodeId === nodeId)
    if (!node) return false
    const reason = window.prompt('打回原因（必填）：', '实物与节点不符')
    if (!reason) return false
    const detail = window.prompt('详细说明（必填）：', '请中转仓重新核对') || reason
    for (const item of node.items) {
      for (const prepRecordId of item.sourcePrepRecordIds) {
        try {
          rejectMaterialPrepRecord(prepRecordId, reason, detail, '裁床 李明')
        } catch {
          //
        }
      }
    }
    refreshPickupRegions()
    return true
  }

  if (action === 'retry-sync') {
    const pickupSessionId = actionNode.dataset.pickupSessionId || ''
    if (!pickupSessionId) return false
    recordPickupSessionWarehouseSyncResult(pickupSessionId, { status: '已回写' })
    refreshPickupRegions()
    return true
  }

  return false
}

function refreshPickupRegions(): void {
  const allNodes = listActivePickupNodes()
  const allRows = listMaterialPrepOrderProjections()
  const isWaiting = state.activeTab === 'WAIT_PICKUP'
  const filteredNodes = allNodes.filter((n) => matchesPickupNode(n, state.filters))
  const filteredHistoryRows = getPickupWorkbenchRowsForActiveTab().filter((row) => matchesPickupWorkbenchRow(row, state.filters))
  const sortedNodes = state.sort
    ? sortStandardListRows(filteredNodes, state.sort, (row, key) => getListSortValue(PICKUP_NODE_COLUMNS, row, key))
    : filteredNodes
  const sortedHistoryRows = state.sort
    ? sortStandardListRows(filteredHistoryRows, state.sort, (row, key) => getListSortValue(PICKUP_HISTORY_COLUMNS, row, key))
    : filteredHistoryRows
  const paging = isWaiting
    ? paginateStandardListRows(sortedNodes, state.page, state.pageSize)
    : paginateStandardListRows(sortedHistoryRows, state.page, state.pageSize)

  const statsEl = document.querySelector('[data-pickup-region="stats"]')
  if (statsEl) {
    statsEl.innerHTML = isWaiting
      ? renderNodeStats(filteredNodes)
      : renderStandardListStats([
          { label: pickupStatusLabelMap[state.activeTab], value: `${filteredHistoryRows.length}` },
          { label: '关联生产单', value: `${new Set(filteredHistoryRows.map((row) => row.projection.order.productionOrderId)).size}` },
          { label: '当前页签', value: pickupStatusLabelMap[state.activeTab] },
        ])
  }

  const tabsEl = document.querySelector('[data-pickup-region="tabs"]')
  if (tabsEl) tabsEl.outerHTML = renderTabs(allRows)

  const tableEl = document.querySelector('[data-pickup-region="table"]')
  if (tableEl) {
    tableEl.innerHTML = isWaiting
      ? renderStandardListTable({
          columns: PICKUP_NODE_COLUMNS,
          rows: paging.rows as PickupNodeProjection[],
          preferences: state.columnPreferences,
          sort: state.sort,
          eventPrefix: 'pickup-list',
          emptyText: '当前暂无待领节点，等待中转仓确认配料后会自动出现。',
        })
      : renderStandardListTable({
          columns: PICKUP_HISTORY_COLUMNS,
          rows: paging.rows as PickupWorkbenchRow[],
          preferences: normalizeListColumnPreferences(PICKUP_HISTORY_COLUMNS, state.columnPreferences, PAGE_SIZES),
          sort: state.sort,
          eventPrefix: 'pickup-list',
          emptyText: '当前状态下暂无领料记录。',
        })
  }

  const paginationEl = document.querySelector('[data-pickup-region="pagination"]')
  if (paginationEl) {
    paginationEl.innerHTML = renderTablePagination({
      total: paging.total,
      from: paging.from,
      to: paging.to,
      currentPage: paging.currentPage,
      totalPages: paging.totalPages,
      pageSize: paging.pageSize,
      actionPrefix: 'pickup',
      pageSizeOptions: PAGE_SIZES,
    })
  }
}
