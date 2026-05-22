import { formatFactoryDisplayName } from '../../../data/fcs/factory-mock-data.ts'
import { appStore } from '../../../state/store.ts'
import { escapeHtml } from '../../../utils.ts'
import {
  areCutOrdersReadyForMarkerPlan,
  buildQuickMarkerPlanBuckets,
  buildCuttablePoolStats,
  filterCuttablePoolGroups,
  type CuttableCutOrderItem,
  type CuttablePoolFilters,
  type CuttablePoolPrefilter,
  type CuttableStyleGroup,
  type CuttableViewMode,
} from './cuttable-pool-model.ts'
import { getCanonicalCuttingMeta, getCanonicalCuttingPath, isCuttingAliasPath, renderCuttingPageHeader } from './meta.ts'
import type { ProductionProgressUrgencyKey } from './production-progress-model.ts'
import { urgencyMeta } from './production-progress-model.ts'
import { buildCuttablePoolProjection } from './cuttable-pool-projection.ts'
import {
  paginateItems,
  renderCompactKpiCard,
  renderStickyFilterShell,
  renderStickyTableScroller,
  renderWorkbenchFilterChip,
  renderWorkbenchPagination,
  renderWorkbenchStateBar,
} from './layout.helpers.ts'
import { renderMaterialIdentityBlock } from './material-identity.ts'

type FilterField = 'keyword' | 'urgency'

const initialFilters: CuttablePoolFilters = {
  keyword: '',
  urgencyLevel: 'ALL',
  cuttableState: 'ALL',
  coverageStatus: 'ALL',
  configStatus: 'ALL',
  receiveStatus: 'ALL',
  onlyCuttable: false,
}

interface CuttablePoolPageState {
  filters: CuttablePoolFilters
  selectedIds: string[]
  querySignature: string
  prefilter: CuttablePoolPrefilter | null
  notice: string
  viewMode: CuttableViewMode
  page: number
  pageSize: number
}

const state: CuttablePoolPageState = {
  filters: { ...initialFilters },
  selectedIds: [],
  querySignature: '',
  prefilter: null,
  notice: '',
  viewMode: 'STYLE_GROUP',
  page: 1,
  pageSize: 10,
}

function getCurrentQueryString(): string {
  const pathname = appStore.getState().pathname
  const [, query] = pathname.split('?')
  return query || ''
}

function getCurrentSearchParams(): URLSearchParams {
  return new URLSearchParams(getCurrentQueryString())
}

function syncStateFromPath(): void {
  const pathname = appStore.getState().pathname
  if (state.querySignature === pathname) return

  const params = getCurrentSearchParams()
  const nextPrefilter: CuttablePoolPrefilter = {}

  const productionOrderId = params.get('productionOrderId') || ''
  const productionOrderNo = params.get('productionOrderNo') || ''
  const styleCode = params.get('styleCode') || ''
  const spuCode = params.get('spuCode') || ''
  const urgencyLevel = params.get('urgencyLevel') || ''
  const riskOnly = params.get('riskOnly') === 'true'

  if (productionOrderId) nextPrefilter.productionOrderId = productionOrderId
  if (productionOrderNo) nextPrefilter.productionOrderNo = productionOrderNo
  if (styleCode) nextPrefilter.styleCode = styleCode
  if (spuCode) nextPrefilter.spuCode = spuCode
  if (urgencyLevel && urgencyLevel in urgencyMeta) nextPrefilter.urgencyLevel = urgencyLevel as ProductionProgressUrgencyKey
  if (riskOnly) nextPrefilter.riskOnly = true

  state.prefilter = Object.keys(nextPrefilter).length ? nextPrefilter : null
  state.querySignature = pathname
}

function getViewModel() {
  return buildCuttablePoolProjection().viewModel
}

function getVisibleGroups(viewModel = getViewModel()) {
  return filterCuttablePoolGroups(viewModel, state.filters, state.selectedIds, state.prefilter)
}

function getVisibleOrders(viewModel = getViewModel()) {
  return getVisibleGroups(viewModel).flatMap((group) => group.orders)
}

function getSelectedItems(viewModel = getViewModel()): CuttableCutOrderItem[] {
  return state.selectedIds
    .map((id) => viewModel.itemsById[id])
    .filter((item): item is CuttableCutOrderItem => Boolean(item))
}

function getSelectedMarkerPlanGroupKey(viewModel = getViewModel()): string | null {
  const selectedItems = getSelectedItems(viewModel)
  const markerPlanReadiness = areCutOrdersReadyForMarkerPlan(selectedItems)
  return markerPlanReadiness.ok ? markerPlanReadiness.markerPlanGroupKey : selectedItems[0]?.markerPlanGroupKey ?? null
}

function setNotice(message: string): void {
  state.notice = message
}

function clearNotice(): void {
  state.notice = ''
}

function resetFilterState(): void {
  state.filters = { ...initialFilters }
  resetPagination()
}

function resetPagination(): void {
  state.page = 1
}

function normalizeCuttableOnlyFilters(): void {
  state.filters.cuttableState = 'ALL'
  state.filters.coverageStatus = 'ALL'
  state.filters.configStatus = 'ALL'
  state.filters.receiveStatus = 'ALL'
  state.filters.onlyCuttable = false
}

function buildRouteWithQuery(pathname: string, params: Record<string, string | undefined>): string {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value)
  })
  const query = search.toString()
  return query ? `${pathname}?${query}` : pathname
}

function renderBadge(label: string, className: string): string {
  return `<span class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${className}">${escapeHtml(label)}</span>`
}

function renderFilterSelect(
  label: string,
  field: FilterField,
  value: string,
  options: Array<{ value: string; label: string }>,
): string {
  return `
    <label class="space-y-2">
      <span class="text-sm font-medium text-foreground">${escapeHtml(label)}</span>
      <select
        class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        data-cuttable-pool-field="${field}"
      >
        ${options
          .map((option) => `<option value="${escapeHtml(option.value)}" ${option.value === value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`)
          .join('')}
      </select>
    </label>
  `
}

function renderActionBar(viewModel = getViewModel()): string {
  const selectedCount = getSelectedItems(viewModel).length
  return `
    <div class="flex flex-wrap items-center gap-2">
      <button class="${selectedCount ? 'rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700' : 'rounded-md border px-3 py-2 text-sm hover:bg-muted'}" data-cuttable-pool-action="create-marker-plan">
        新建唛架方案${selectedCount ? `（${selectedCount}）` : ''}
      </button>
    </div>
  `
}

function renderStats(groups: ReturnType<typeof getVisibleGroups>): string {
  const stats = buildCuttablePoolStats(groups, state.selectedIds)
  const markerPlanGroupCount = buildQuickMarkerPlanBuckets(groups.flatMap((group) => group.orders.flatMap((order) => order.items))).length
  return `
    <section class="grid gap-3 md:grid-cols-3">
      ${renderCompactKpiCard('生产单数', stats.productionOrderCount, '当前筛选范围', 'text-slate-900')}
      ${renderCompactKpiCard('可排唛架裁片单数', stats.cuttableCutOrderCount, '已开工、有领料余额、未被方案锁定', 'text-emerald-600')}
      ${renderCompactKpiCard('可建唛架方案分组', markerPlanGroupCount, '按唛架组合规则聚合', 'text-blue-600')}
    </section>
  `
}

function renderViewModeSwitch(): string {
  const options: Array<{ key: CuttableViewMode; label: string }> = [
    { key: 'STYLE_GROUP', label: '按同款分组' },
    { key: 'PRODUCTION_ORDER', label: '按生产单平铺' },
  ]

  return `
    <div class="flex flex-wrap items-center gap-2">
      <span class="text-xs font-medium text-muted-foreground">视图</span>
      ${options
        .map((option) =>
          renderWorkbenchFilterChip(
            option.label,
            `data-cuttable-pool-action="set-view-mode" data-view-mode="${option.key}"`,
            state.viewMode === option.key ? 'blue' : 'emerald',
          ),
        )
        .join('')}
    </div>
  `
}

function getPrefilterLabels(): string[] {
  const labels: string[] = []
  const prefilter = state.prefilter
  if (!prefilter) return labels

  if (prefilter.productionOrderNo) labels.push(`来自生产单进度：${prefilter.productionOrderNo}`)
  if (prefilter.styleCode) labels.push(`预筛同款：${prefilter.styleCode}`)
  if (prefilter.spuCode) labels.push(`预筛 SPU：${prefilter.spuCode}`)
  if (prefilter.urgencyLevel) labels.push(`预筛紧急度：${urgencyMeta[prefilter.urgencyLevel].label}`)
  if (prefilter.riskOnly) labels.push('预筛：只看风险生产单')
  return labels
}

function getFilterLabels(): string[] {
  const labels = getPrefilterLabels()
  if (state.filters.keyword) labels.push(`关键词：${state.filters.keyword}`)
  if (state.filters.urgencyLevel !== 'ALL') labels.push(`紧急程度：${urgencyMeta[state.filters.urgencyLevel].label}`)
  return labels
}

function renderActiveStateBar(): string {
  const labels = getFilterLabels()
  if (!labels.length) return ''

  return renderWorkbenchStateBar({
    summary: '当前视图条件',
    chips: labels.map((label) => renderWorkbenchFilterChip(label, 'data-cuttable-pool-action="clear-all-state"', 'blue')),
    clearAttrs: 'data-cuttable-pool-action="clear-all-state"',
  })
}

function renderNoticeBar(): string {
  if (!state.notice) return ''

  return `
    <section class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
      <div class="flex items-start justify-between gap-3">
        <p>${escapeHtml(state.notice)}</p>
        <button type="button" class="shrink-0 text-xs font-medium hover:underline" data-cuttable-pool-action="clear-notice">知道了</button>
      </div>
    </section>
  `
}

function renderFilters(): string {
  return renderStickyFilterShell(`
    <div class="space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-3">
        ${renderViewModeSwitch()}
      </div>
      <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_18rem]">
        <label class="space-y-2">
          <span class="text-sm font-medium text-foreground">关键词</span>
          <input
            type="text"
            value="${escapeHtml(state.filters.keyword)}"
            placeholder="支持生产单号 / 裁片单号 / 款号 / SPU / 面料 SKU"
            class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            data-cuttable-pool-field="keyword"
          />
        </label>
        ${renderFilterSelect('紧急程度', 'urgency', state.filters.urgencyLevel, [
          { value: 'ALL', label: '全部' },
          { value: 'AA', label: 'AA 紧急' },
          { value: 'A', label: 'A 紧急' },
          { value: 'B', label: 'B 紧急' },
          { value: 'C', label: 'C 优先' },
          { value: 'D', label: 'D 常规' },
          { value: 'UNKNOWN', label: '待补日期' },
        ])}
      </div>
    </div>
  `)
}

function isMarkerPlanGroupBlocked(item: CuttableCutOrderItem, currentMarkerPlanGroupKey: string | null): boolean {
  return !!currentMarkerPlanGroupKey && item.markerPlanGroupKey !== currentMarkerPlanGroupKey
}

function formatLength(value: number): string {
  return `${Math.round(Number(value || 0) * 10) / 10} m`
}

function renderCutOrderRows(order: ReturnType<typeof getVisibleOrders>[number], currentMarkerPlanGroupKey: string | null): string {
  return order.items
    .map((item) => {
      const disabled = isMarkerPlanGroupBlocked(item, currentMarkerPlanGroupKey)

      return `
        <tr class="border-b last:border-b-0 align-top ${state.selectedIds.includes(item.id) ? 'bg-blue-50/40' : ''}" data-testid="cutting-cuttable-pool-cut-order-row">
          <td class="px-3 py-3">
            <input
              type="checkbox"
              class="h-4 w-4 rounded border"
              data-cuttable-pool-action="toggle-item"
              data-item-id="${item.id}"
              ${state.selectedIds.includes(item.id) ? 'checked' : ''}
              ${disabled ? 'aria-disabled="true"' : ''}
            />
          </td>
          <td class="px-3 py-3">
            <button class="font-medium text-blue-600 hover:underline" data-cuttable-pool-action="go-cut-order-detail" data-item-id="${item.id}">
              ${escapeHtml(item.cutOrderNo)}
            </button>
          </td>
          <td class="px-3 py-3">
            ${renderMaterialIdentityBlock(item, { compact: true })}
          </td>
          <td class="px-3 py-3">
            <div class="font-medium text-emerald-700">${escapeHtml(formatLength(item.availableLength))}</div>
            <div class="mt-1 text-xs text-muted-foreground">已领 ${escapeHtml(formatLength(item.receivedLength))}</div>
          </td>
          <td class="px-3 py-3 text-sm text-muted-foreground">
            ${escapeHtml(item.productionOrderNo)}
          </td>
          <td class="px-3 py-3 text-sm text-muted-foreground">
            ${escapeHtml(item.plannedShipDateDisplay)}
          </td>
        </tr>
      `
    })
    .join('')
}

function renderOrderCard(order: ReturnType<typeof getVisibleOrders>[number], currentMarkerPlanGroupKey: string | null): string {
  const tableHtml = `
    <table class="w-full min-w-[920px] text-sm">
      <thead class="sticky top-0 z-10 border-b bg-muted/95 text-muted-foreground backdrop-blur">
        <tr>
          <th class="px-3 py-2 text-left font-medium">选择</th>
          <th class="px-3 py-2 text-left font-medium">裁片单号</th>
          <th class="px-3 py-2 text-left font-medium">面料</th>
          <th class="px-3 py-2 text-left font-medium">可用领料余额</th>
          <th class="px-3 py-2 text-left font-medium">生产单</th>
          <th class="px-3 py-2 text-left font-medium">计划发货</th>
        </tr>
      </thead>
      <tbody>${renderCutOrderRows(order, currentMarkerPlanGroupKey)}</tbody>
    </table>
  `

  return `
    <article class="rounded-lg border bg-card" data-testid="cutting-cuttable-pool-order-card">
      <div class="border-b px-4 py-3">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <h3 class="text-sm font-semibold">${escapeHtml(order.productionOrderNo)}</h3>
            ${renderBadge(order.urgency.label, order.urgency.className)}
          </div>
          <div class="mt-2 grid gap-2 text-xs text-muted-foreground md:grid-cols-2 xl:grid-cols-6">
            <span>工厂：${escapeHtml(formatFactoryDisplayName(order.factoryName) || '—')}</span>
            <span>款号 / SPU：${escapeHtml(order.styleCode || order.spuCode || '-')}</span>
            <span>款式名称：${escapeHtml(order.styleName || '-')}</span>
            <span>下单成衣件数（件）：${escapeHtml(String(order.orderQty))}</span>
            <span>计划发货：${escapeHtml(order.plannedShipDateDisplay)}</span>
            <span>${escapeHtml(order.shipCountdownText)}</span>
            <span>可排唛架裁片单：${order.cuttableCutOrderCount}</span>
          </div>
        </div>
      </div>
      <div data-testid="cutting-cuttable-pool-cut-order-table">
        ${renderStickyTableScroller(tableHtml, 'max-h-[24rem]')}
      </div>
    </article>
  `
}

function renderPoolPagination(total: number): string {
  if (total <= state.pageSize) return ''
  return renderWorkbenchPagination({
    page: state.page,
    pageSize: state.pageSize,
    total,
    actionAttr: 'data-cuttable-pool-action',
    pageAction: 'set-page',
    pageSizeAttr: 'data-cuttable-pool-page-size',
    pageSizeOptions: [10, 20, 50],
  })
}

function renderStyleGroups(groups: CuttableStyleGroup[], currentMarkerPlanGroupKey: string | null): string {
  if (!groups.length) {
    return '<section class="rounded-lg border bg-card px-6 py-14 text-center text-sm text-muted-foreground">当前筛选条件下暂无可展示的同款分组。</section>'
  }
  const pagination = paginateItems(groups, state.page, state.pageSize)

  return `
    <section class="space-y-3">
      <div class="space-y-4">
        ${pagination.items
          .map(
            (group) => `
              <section class="rounded-lg border bg-card" data-testid="cutting-cuttable-pool-style-group">
                <div class="flex flex-col gap-3 border-b px-4 py-4 lg:flex-row lg:items-start lg:justify-between">
                  <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-2">
                      <h2 class="text-base font-semibold">${escapeHtml(group.styleCode || group.spuCode || '未命名同款')}</h2>
                      <span class="text-sm text-muted-foreground">${escapeHtml(group.styleName || '-')}</span>
                    </div>
                    <div class="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>生产单 ${group.totalOrderCount} 个</span>
                      <span>裁片单 ${group.totalCutOrderCount} 个</span>
                      <span>当前可排唛架 ${group.cuttableCutOrderCount} 个</span>
                    </div>
                    <div class="mt-3 flex flex-wrap gap-2">
                      ${
                        group.markerPlanBuckets.length
                          ? group.markerPlanBuckets
                              .map((bucket) =>
                                renderBadge(
                                  `${bucket.materialSku} · ${bucket.cuttableCount}/${bucket.totalCount}`,
                                  bucket.cuttableCount > 0
                                    ? 'bg-sky-50 text-sky-700 border border-sky-200'
                                    : 'bg-slate-100 text-slate-600 border border-slate-200',
                                ),
                              )
                              .join('')
                          : '<span class="text-xs text-muted-foreground">当前无可组合唛架摘要</span>'
                      }
                    </div>
                  </div>
                  <div class="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>勾选粒度固定为裁片单</span>
                  </div>
                </div>
                <div class="space-y-3 p-4">
                  ${group.orders.map((order) => renderOrderCard(order, currentMarkerPlanGroupKey)).join('')}
                </div>
              </section>
            `,
          )
          .join('')}
      </div>
      ${renderPoolPagination(pagination.total)}
    </section>
  `
}

function renderProductionOrderFlat(groups: CuttableStyleGroup[], currentMarkerPlanGroupKey: string | null): string {
  const orders = groups.flatMap((group) => group.orders)
  if (!orders.length) {
    return '<section class="rounded-lg border bg-card px-6 py-14 text-center text-sm text-muted-foreground">当前筛选条件下暂无可展示的生产单。</section>'
  }
  const pagination = paginateItems(orders, state.page, state.pageSize)

  return `
    <section class="space-y-3" data-testid="cutting-cuttable-pool-order-list">
      ${pagination.items
        .map(
          (order) => `
            <div class="rounded-lg border bg-card p-4">
              <div class="mb-3 text-xs text-muted-foreground">同款：${escapeHtml(order.styleCode || order.spuCode || '-')} · ${escapeHtml(order.styleName || '-')}</div>
              ${renderOrderCard(order, currentMarkerPlanGroupKey)}
            </div>
          `,
        )
        .join('')}
      ${renderPoolPagination(pagination.total)}
    </section>
  `
}

function renderEmptyStateIfNeeded(groups: ReturnType<typeof getVisibleGroups>): string {
  if (groups.length) return ''

  return `
    <section class="rounded-lg border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
      当前筛选条件下暂无可排唛架裁片单，可调整筛选条件或从生产单进度重新进入。
    </section>
  `
}

export function renderCraftCuttingCuttablePoolPage(): string {
  syncStateFromPath()
  normalizeCuttableOnlyFilters()

  const pathname = appStore.getState().pathname
  const meta = getCanonicalCuttingMeta(pathname, 'cuttable-pool')
  const viewModel = getViewModel()
  const groups = getVisibleGroups(viewModel)
  const currentMarkerPlanGroupKey = getSelectedMarkerPlanGroupKey(viewModel)

  return `
    <div class="space-y-4 p-4" data-testid="cutting-cuttable-pool-page">
      ${renderCuttingPageHeader(meta, {
        actionsHtml: renderActionBar(viewModel),
        showAliasBadge: isCuttingAliasPath(pathname),
      })}
      ${renderStats(groups)}
      ${renderFilters()}
      ${renderActiveStateBar()}
      ${renderNoticeBar()}
      ${renderEmptyStateIfNeeded(groups)}
      ${
        groups.length
          ? `
            <div class="space-y-4">
              ${
                state.viewMode === 'PRODUCTION_ORDER'
                  ? renderProductionOrderFlat(groups, currentMarkerPlanGroupKey)
                  : renderStyleGroups(groups, currentMarkerPlanGroupKey)
              }
            </div>
          `
          : ''
      }
    </div>
  `
}

function toggleItemSelection(itemId: string | undefined): boolean {
  if (!itemId) return false

  const viewModel = getViewModel()
  const item = viewModel.itemsById[itemId]
  if (!item) return false

  if (state.selectedIds.includes(itemId)) {
    state.selectedIds = state.selectedIds.filter((id) => id !== itemId)
    clearNotice()
    return true
  }

  if (!item.cuttableState.selectable) {
    setNotice(item.cuttableState.reasonText)
    return true
  }

  const currentMarkerPlanGroupKey = getSelectedMarkerPlanGroupKey(viewModel)
  if (currentMarkerPlanGroupKey && currentMarkerPlanGroupKey !== item.markerPlanGroupKey) {
    setNotice('当前选择仅支持同 SPU、同纸样、同有效幅宽的裁片单进入同一唛架方案。')
    return true
  }

  state.selectedIds = [...state.selectedIds, itemId]
  clearNotice()
  return true
}

function createMarkerPlanAndGo(): boolean {
  const selectedItems = getSelectedItems()
  const markerPlanReadiness = areCutOrdersReadyForMarkerPlan(selectedItems)
  if (!markerPlanReadiness.ok) {
    setNotice(markerPlanReadiness.reason || '当前选择无法进入唛架方案。')
    return true
  }

  const query = new URLSearchParams()
  selectedItems.forEach((item) => {
    query.append('contextKey', `cut-order:${item.cutOrderId}`)
  })
  query.set('tab', 'layout')
  state.selectedIds = []
  clearNotice()
  appStore.navigate(`${getCanonicalCuttingPath('marker-create')}?${query.toString()}`)
  return true
}

export function handleCraftCuttingCuttablePoolEvent(target: Element): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-cuttable-pool-field]')
  if (fieldNode) {
    const field = fieldNode.dataset.cuttablePoolField as FilterField | undefined
    if (!field) return false

    const input = fieldNode as HTMLInputElement | HTMLSelectElement
    if (field === 'keyword') state.filters.keyword = input.value
    if (field === 'urgency') state.filters.urgencyLevel = input.value as CuttablePoolFilters['urgencyLevel']
    resetPagination()
    return true
  }

  const pageSizeNode = target.closest<HTMLElement>('[data-cuttable-pool-page-size]')
  if (pageSizeNode) {
    const input = pageSizeNode as HTMLSelectElement
    state.pageSize = Number(input.value || 10) || 10
    resetPagination()
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-cuttable-pool-action]')
  const action = actionNode?.dataset.cuttablePoolAction
  if (!action) return false

  if (action === 'set-view-mode') {
    const nextMode = actionNode.dataset.viewMode as CuttableViewMode | undefined
    if (!nextMode) return false
    state.viewMode = nextMode
    resetPagination()
    return true
  }

  if (action === 'set-page') {
    state.page = Number(actionNode.dataset.page || 1) || 1
    return true
  }

  if (action === 'toggle-item') {
    return toggleItemSelection(actionNode.dataset.itemId)
  }

  if (action === 'clear-all-state') {
    resetFilterState()
    state.viewMode = 'STYLE_GROUP'
    const params = getCurrentSearchParams()
    ;['productionOrderId', 'productionOrderNo', 'styleCode', 'spuCode', 'urgencyLevel', 'riskOnly'].forEach((key) => params.delete(key))
    clearNotice()
    const query = params.toString()
    appStore.navigate(query ? `${getCanonicalCuttingPath('cuttable-pool')}?${query}` : getCanonicalCuttingPath('cuttable-pool'))
    return true
  }

  if (action === 'clear-notice') {
    clearNotice()
    return true
  }

  if (action === 'create-marker-plan') {
    return createMarkerPlanAndGo()
  }

  if (action === 'go-cut-order-detail') {
    const viewModel = getViewModel()
    const itemId = actionNode.dataset.itemId
    const item = itemId ? viewModel.itemsById[itemId] : null
    if (!item) return false
    appStore.navigate(
      buildRouteWithQuery(getCanonicalCuttingPath('cut-orders'), {
        cutOrderId: item.cutOrderId,
        cutOrderNo: item.cutOrderNo,
        productionOrderId: item.productionOrderId,
        productionOrderNo: item.productionOrderNo,
      }),
    )
    return true
  }

  return false
}

export function isCraftCuttingCuttablePoolDialogOpen(): boolean {
  return false
}
