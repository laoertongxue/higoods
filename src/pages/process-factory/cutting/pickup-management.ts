// @page-pattern: list

import { renderBadge } from '../../../components/ui/badge.ts'
import type { BadgeVariant } from '../../../components/ui/types.ts'
import {
  appendPickupSessionFromNode,
  listActivePickupNodes,
  listMaterialPrepOrderProjections,
  pickupStatusLabelMap,
  pickupWorkbenchTabs,
  rejectMaterialPrepRecord,
  type MaterialPrepOrderProjection,
  type PickupOrderStatus,
  type PickupSession,
} from '../../../data/fcs/cutting/production-material-prep.ts'
import type {
  PickupNodeProjection,
  PickupNodeItem,
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
  type StandardListColumn,
  type StandardListColumnPreferences,
  type StandardListSort,
} from '../../../components/ui/list-table-model.ts'
import { renderStandardListTable } from '../../../components/ui/list-table.ts'
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
  const total = node.items.reduce((sum, item) => sum + item.effectivePickedQty, 0)
  const lines = node.items.filter((item) => item.effectivePickedQty > 0).length
  return `<div class="text-sm">
    <div class="font-medium tabular-nums">${formatQty(total)}</div>
    <div class="text-xs text-muted-foreground">${lines} 行有已领记录</div>
  </div>`
}

function renderRemainingShortageCell(node: PickupNodeProjection): string {
  const shortageItems = node.items.map((item) => Math.max(item.requiredQty - item.effectivePickedQty - item.currentAvailableQty, 0))
  const totalShortage = shortageItems.reduce((sum, val) => sum + val, 0)
  const shortageCount = shortageItems.filter((val) => val > 0).length
  if (totalShortage <= 0) {
    return `<span class="text-sm text-emerald-600 font-medium">本轮收尾，无缺口</span>`
  }
  return `<div class="text-sm">
    <div class="font-medium tabular-nums text-amber-600">${formatQty(totalShortage)}</div>
    <div class="text-xs text-muted-foreground">仍缺 ${shortageCount} 行物料</div>
  </div>`
}

function renderNodeSourceLocationCell(node: PickupNodeProjection): string {
  const locations = Array.from(new Set(node.items.map((item) => `${item.sourceWarehouseName} / ${item.sourceWarehouseArea} / ${item.sourceLocationCode}`)))
  return `<div class="text-xs space-y-0.5">
    ${locations.slice(0, 3).map((loc) => `<div>${escapeHtml(loc)}</div>`).join('')}
    ${locations.length > 3 ? `<div class="text-muted-foreground">等 ${locations.length} 处</div>` : ''}
  </div>`
}

function renderNodeActions(node: PickupNodeProjection): string {
  const detailHref = `/fcs/craft/cutting/pickup-management-detail?pickupNodeId=${encodeURIComponent(node.nodeId)}`
  return `<div class="flex flex-wrap gap-1.5">
    <button type="button" data-pickup-nav="detail" data-pickup-node-id="${escapeHtml(node.nodeId)}" class="rounded-md border px-2 py-1.5 text-xs hover:bg-muted">查看当前节点</button>
    <button type="button" data-pickup-action="confirm-pickup" data-pickup-node-id="${escapeHtml(node.nodeId)}" data-pickup-node-version="${node.version}" class="rounded-md bg-blue-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-blue-700">办理领料入库</button>
    <a href="${escapeHtml(detailHref)}" class="rounded-md border px-2 py-1.5 text-xs hover:bg-muted inline-block" data-pickup-nav="detail" data-pickup-node-id="${escapeHtml(node.nodeId)}">查看历史</a>
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
  { key: 'actions', title: '操作', width: 200, required: true, sticky: 'right', render: renderNodeActions },
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
  sort: StandardListSort | null
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
  if (state.sort) params.set('sort', `${state.sort.column}:${state.sort.direction}`)
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

function parseSort(raw: string | null): StandardListSort | null {
  if (!raw) return null
  const [column, direction] = raw.split(':')
  if (direction === 'asc' || direction === 'desc') return { column, direction }
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

function renderStatus(status: string, variant: BadgeVariant = 'neutral'): string {
  return renderBadge(status, variant)
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
  const incompleteCount = activeNodes.filter((n) => n.nodeType === 'INCOMPLETE_PICKABLE').length
  const readyCount = activeNodes.filter((n) => n.nodeType === 'READY_TO_PICKUP').length
  return `
    <div class="flex flex-wrap gap-2">
      ${pickupWorkbenchTabs.map((tab) => {
        const count = tab.key === 'WAIT_PICKUP' ? activeNodes.length : allRows.filter((r) => r.order.pickupStatus === tab.key).length
        return `
          <button type="button" data-pickup-action="switch-tab" data-pickup-tab="${escapeHtml(tab.key)}" class="rounded-md border px-3 py-2 text-sm ${tab.key === state.activeTab ? 'bg-blue-600 text-white' : 'bg-background hover:bg-muted'}">
            ${escapeHtml(tab.label)} <span class="ml-1 text-xs opacity-80">${count}</span>
          </button>
        `
      }).join('')}
  `
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
  const allNodes = listActivePickupNodes()
  const allRows = listMaterialPrepOrderProjections()
  const filteredNodes = allNodes.filter((n) => matchesPickupNode(n, state.filters))
  const sortedNodes = state.sort
    ? sortStandardListRows(filteredNodes, state.sort, PICKUP_NODE_COLUMNS)
    : filteredNodes
  const paging = paginateStandardListRows(sortedNodes, state.page, state.pageSize)

  const tableHtml = `
    <div data-pickup-region="table">
      ${renderStandardListTable({
        columns: PICKUP_NODE_COLUMNS,
        rows: paging.rows,
        preferences: state.columnPreferences,
        sort: state.sort,
        eventPrefix: 'pickup-list',
        emptyText: state.activeTab === 'WAIT_PICKUP' ? '当前暂无待领节点，等待中转仓确认配料后会自动出现。' : '当前状态下暂无领料记录。',
      })}
    </div>`

  const paginationHtml = `
    <div data-pickup-region="pagination">
      ${renderTablePagination({
        total: paging.total,
        from: (paging.page - 1) * paging.pageSize + 1,
        to: Math.min(paging.page * paging.pageSize, paging.total),
        currentPage: paging.page,
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
      <div class="mt-3" data-pickup-region="stats">${renderNodeStats(filteredNodes)}</div>
      <div class="mt-3">${renderPickupFilters(state.filters)}</div>
    `,
    listTitle: `待领节点（${filteredNodes.length}）`,
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
          <div><span class="text-xs text-muted-foreground">更新时间</span><div class="font-medium">${escapeHtml(node.updatedAt)}</div></div>
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
                    ${escapeHtml(item.sourceWarehouseName)} / ${escapeHtml(item.sourceWarehouseArea)} / ${escapeHtml(item.sourceLocationCode)}
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
        <button type="button" data-pickup-action="confirm-pickup" data-pickup-node-id="${escapeHtml(node.nodeId)}" data-pickup-node-version="${node.version}" class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">本轮全部领取</button>
        <button type="button" data-pickup-action="reject-prep" data-pickup-node-id="${escapeHtml(node.nodeId)}" class="rounded-md border border-rose-200 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50">打回中转仓</button>
      </div>
    </section>
  `
}

function renderSessionHistory(node: PickupNodeProjection, projection: MaterialPrepOrderProjection | null): string {
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
  const allNodes = listActivePickupNodes()
  const node = allNodes.find((n) => n.nodeId === pickupNodeId) || null

  if (!node) {
    return `
      <div class="space-y-5 p-6">
        ${renderCuttingPageHeader(getCanonicalCuttingMeta('pickup-management'), {
          actionsHtml: `<button type="button" class="rounded-md border px-4 py-2 text-sm" data-nav="/fcs/craft/cutting/pickup-management">返回领料列表</button>`,
        })}
        <section class="rounded-lg border bg-card px-4 py-10 text-center text-sm text-muted-foreground">未找到该领料节点，可能已被领取或不存在。</section>
      </div>
    `
  }

  const projection = listMaterialPrepOrderProjections().find((p) => p.order.prepOrderId === node.prepOrderId) || null

  return `
    <div class="space-y-5 p-6">
      <header class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div class="text-sm text-muted-foreground">工艺工厂运营系统 / 裁床厂管理 / 裁前准备 / 领料管理</div>
          <h1 class="mt-1 text-2xl font-bold">领料详情</h1>
          <p class="mt-2 text-sm text-muted-foreground">生产单 ${renderProductionOrderIdentityCell(node.productionOrderNo)} / 配料单 ${escapeHtml(node.prepOrderNo)}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button type="button" class="rounded-md border px-4 py-2 text-sm" data-nav="/fcs/craft/cutting/pickup-management">返回领料列表</button>
        </div>
      </header>
      ${renderNodeDetailContent(node)}
      ${renderSessionHistory(node, projection)}
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
    const allNodes = listActivePickupNodes()
    const filtered = allNodes.filter((n) => matchesPickupNode(n, state.filters))
    const totalPages = Math.ceil(filtered.length / state.pageSize)
    if (state.page < totalPages) {
      state.page += 1
      syncStateToUrl()
      refreshPickupRegions()
    }
    return true
  }

  if (action === 'confirm-pickup') {
    const nodeId = actionNode.dataset.pickupNodeId || ''
    const version = Number(actionNode.dataset.pickupNodeVersion || '0')
    if (!nodeId) return false
    try {
      appendPickupSessionFromNode({
        pickupNodeId: nodeId,
        pickupNodeVersion: version,
        receiverName: '裁床 李明',
        warehouseArea: '待加工仓 A 区',
        locationCode: 'FAB-A-01',
        waitProcessLedgerEventId: `pickup:${nodeId}:${Date.now()}`,
      })
      refreshPickupRegions()
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '领料失败')
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

  return false
}

function refreshPickupRegions(): void {
  const allNodes = listActivePickupNodes()
  const allRows = listMaterialPrepOrderProjections()
  const filteredNodes = allNodes.filter((n) => matchesPickupNode(n, state.filters))
  const sortedNodes = state.sort
    ? sortStandardListRows(filteredNodes, state.sort, PICKUP_NODE_COLUMNS)
    : filteredNodes
  const paging = paginateStandardListRows(sortedNodes, state.page, state.pageSize)

  const statsEl = document.querySelector('[data-pickup-region="stats"]')
  if (statsEl) statsEl.outerHTML = renderNodeStats(filteredNodes)

  const tableEl = document.querySelector('[data-pickup-region="table"]')
  if (tableEl) {
    tableEl.outerHTML = renderStandardListTable({
      columns: PICKUP_NODE_COLUMNS,
      rows: paging.rows,
      preferences: state.columnPreferences,
      sort: state.sort,
      eventPrefix: 'pickup-list',
      emptyText: state.activeTab === 'WAIT_PICKUP' ? '当前暂无待领节点，等待中转仓确认配料后会自动出现。' : '当前状态下暂无领料记录。',
    })
  }

  const paginationEl = document.querySelector('[data-pickup-region="pagination"]')
  if (paginationEl) {
    paginationEl.outerHTML = renderTablePagination({
      total: paging.total,
      from: (paging.page - 1) * paging.pageSize + 1,
      to: Math.min(paging.page * paging.pageSize, paging.total),
      currentPage: paging.page,
      totalPages: paging.totalPages,
      pageSize: paging.pageSize,
      actionPrefix: 'pickup',
      pageSizeOptions: PAGE_SIZES,
    })
  }
}
