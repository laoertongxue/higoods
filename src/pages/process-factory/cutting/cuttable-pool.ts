import { cuttingOrderProgressRecords } from '../../../data/fcs/cutting/order-progress'
import type {
  CuttingConfigStatus,
  CuttingReceiveStatus,
  CuttingReviewStatus,
} from '../../../data/fcs/cutting/types'
import { appStore } from '../../../state/store'
import { escapeHtml } from '../../../utils'
import {
  areOriginalCutOrdersCompatibleForBatching,
  buildCuttablePoolStats,
  buildCuttablePoolViewModel,
  cuttableStateMeta,
  filterCuttablePoolGroups,
  type CoverageStatusKey,
  type CuttableOriginalOrderItem,
  type CuttablePoolFilters,
  type CuttablePoolPrefilter,
  type CuttableStateKey,
  type CuttableStyleGroup,
  type CuttableViewMode,
} from './cuttable-pool-model'
import { getCanonicalCuttingMeta, getCanonicalCuttingPath, isCuttingAliasPath, renderCuttingPageHeader } from './meta'
import type { ProductionProgressUrgencyKey } from './production-progress-model'
import { urgencyMeta } from './production-progress-model'
import {
  renderCompactKpiCard,
  renderStickyFilterShell,
  renderWorkbenchFilterChip,
  renderWorkbenchStateBar,
} from './layout.helpers'

const SELECTED_IDS_STORAGE_KEY = 'cuttingSelectedOriginalOrderIds'
const SELECTED_COMPATIBILITY_KEY_STORAGE_KEY = 'cuttingSelectedCompatibilityKey'

type FilterField = 'keyword' | 'urgency' | 'cuttable' | 'coverage' | 'audit' | 'config' | 'claim'

const initialFilters: CuttablePoolFilters = {
  keyword: '',
  urgencyLevel: 'ALL',
  cuttableState: 'ALL',
  coverageStatus: 'ALL',
  auditStatus: 'ALL',
  configStatus: 'ALL',
  receiveStatus: 'ALL',
  onlySelected: false,
  onlyCuttable: false,
  onlyPartialOrders: false,
  viewMode: 'STYLE_GROUP',
}

interface CuttablePoolPageState {
  filters: CuttablePoolFilters
  selectedIds: string[]
  querySignature: string
  prefilter: CuttablePoolPrefilter | null
  notice: string
}

const state: CuttablePoolPageState = {
  filters: { ...initialFilters },
  selectedIds: [],
  querySignature: '',
  prefilter: null,
  notice: '',
}

const auditStatusLabelMap: Record<CuttingReviewStatus, string> = {
  NOT_REQUIRED: '无需审核',
  PENDING: '待审核',
  PARTIAL: '部分已审核',
  APPROVED: '已审核',
}

const configStatusLabelMap: Record<CuttingConfigStatus, string> = {
  NOT_CONFIGURED: '未配置',
  PARTIAL: '部分配置',
  CONFIGURED: '已配置',
}

const receiveStatusLabelMap: Record<CuttingReceiveStatus, string> = {
  NOT_RECEIVED: '待领料',
  PARTIAL: '部分领料',
  RECEIVED: '领料完成',
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
  return buildCuttablePoolViewModel(cuttingOrderProgressRecords)
}

function getVisibleGroups(viewModel = getViewModel()): CuttableStyleGroup[] {
  return filterCuttablePoolGroups(viewModel, state.filters, state.selectedIds, state.prefilter)
}

function getSelectedItems(viewModel = getViewModel()): CuttableOriginalOrderItem[] {
  return state.selectedIds
    .map((id) => viewModel.itemsById[id])
    .filter((item): item is CuttableOriginalOrderItem => Boolean(item))
}

function getSelectedCompatibilityKey(viewModel = getViewModel()): string | null {
  const selectedItems = getSelectedItems(viewModel)
  const compatibility = areOriginalCutOrdersCompatibleForBatching(selectedItems)
  return compatibility.ok ? compatibility.compatibilityKey : selectedItems[0]?.compatibilityKey ?? null
}

function setNotice(message: string): void {
  state.notice = message
}

function clearNotice(): void {
  state.notice = ''
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
      <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cuttable-pool-action="go-production-progress">返回生产单进度</button>
      <button class="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700" data-cuttable-pool-action="go-merge-batches">
        去合并裁剪批次${selectedCount ? `（${selectedCount}）` : ''}
      </button>
      <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cuttable-pool-action="go-summary-index">查看裁剪总结</button>
    </div>
  `
}

function renderStats(groups: CuttableStyleGroup[]): string {
  const stats = buildCuttablePoolStats(groups, state.selectedIds)
  return `
    <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
      ${renderCompactKpiCard('可裁原始裁片单数', stats.cuttableOriginalOrderCount, '当前筛选范围', 'text-emerald-600')}
      ${renderCompactKpiCard('整单可裁生产单数', stats.fullProductionOrderCount, '全部原始裁片单可裁', 'text-blue-600')}
      ${renderCompactKpiCard('部分料可裁生产单数', stats.partialProductionOrderCount, '仅部分原始裁片单可裁', 'text-amber-600')}
      ${renderCompactKpiCard('暂不可裁生产单数', stats.blockedProductionOrderCount, '仍需审核 / 配料 / 领料', 'text-slate-700')}
      ${renderCompactKpiCard('已选原始裁片单数', stats.selectedOriginalOrderCount, '准备进入下一步', 'text-violet-600')}
      ${renderCompactKpiCard('当前兼容组数', stats.compatibilityBucketCount, '按同款同料轻量聚合', 'text-sky-600')}
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
            state.filters.viewMode === option.key ? 'blue' : 'emerald',
          ),
        )
        .join('')}
    </div>
  `
}

function renderQuickFilterRow(): string {
  return `
    <div class="flex flex-wrap items-center gap-2">
      <span class="text-xs font-medium text-muted-foreground">快捷筛选</span>
      ${renderWorkbenchFilterChip(
        '只看可裁',
        'data-cuttable-pool-action="toggle-only-cuttable"',
        state.filters.onlyCuttable ? 'emerald' : 'blue',
      )}
      ${renderWorkbenchFilterChip(
        '只看已选',
        'data-cuttable-pool-action="toggle-only-selected"',
        state.filters.onlySelected ? 'blue' : 'blue',
      )}
      ${renderWorkbenchFilterChip(
        '只看部分料可裁生产单',
        'data-cuttable-pool-action="toggle-only-partial-orders"',
        state.filters.onlyPartialOrders ? 'amber' : 'blue',
      )}
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
  if (state.filters.cuttableState !== 'ALL') labels.push(`可裁状态：${cuttableStateMeta[state.filters.cuttableState].label}`)
  if (state.filters.coverageStatus !== 'ALL') {
    const labelMap: Record<CoverageStatusKey, string> = {
      FULL: '整单可裁',
      PARTIAL: '部分料可裁',
      BLOCKED: '暂不可裁',
    }
    labels.push(`覆盖状态：${labelMap[state.filters.coverageStatus]}`)
  }
  if (state.filters.auditStatus !== 'ALL') {
    const labelMap: Record<CuttingReviewStatus, string> = {
      NOT_REQUIRED: '无需审核',
      PENDING: '待审核',
      PARTIAL: '部分已审核',
      APPROVED: '已审核',
    }
    labels.push(`面料审核：${labelMap[state.filters.auditStatus]}`)
  }
  if (state.filters.configStatus !== 'ALL') {
    const labelMap: Record<CuttingConfigStatus, string> = {
      NOT_CONFIGURED: '未配置',
      PARTIAL: '部分配置',
      CONFIGURED: '已配置',
    }
    labels.push(`配料状态：${labelMap[state.filters.configStatus]}`)
  }
  if (state.filters.receiveStatus !== 'ALL') {
    const labelMap: Record<CuttingReceiveStatus | 'EXCEPTION', string> = {
      NOT_RECEIVED: '待领料',
      PARTIAL: '部分领料',
      RECEIVED: '领料完成',
      EXCEPTION: '领料异常',
    }
    labels.push(`领料状态：${labelMap[state.filters.receiveStatus]}`)
  }
  if (state.filters.onlySelected) labels.push('快捷筛选：只看已选')
  if (state.filters.onlyCuttable) labels.push('快捷筛选：只看可裁')
  if (state.filters.onlyPartialOrders) labels.push('快捷筛选：只看部分料可裁生产单')
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
        ${renderQuickFilterRow()}
      </div>
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-8">
        <label class="space-y-2 md:col-span-2 xl:col-span-2">
          <span class="text-sm font-medium text-foreground">关键词</span>
          <input
            type="text"
            value="${escapeHtml(state.filters.keyword)}"
            placeholder="支持生产单号 / 裁片单号 / 款号 / 面料 SKU"
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
        ${renderFilterSelect('可裁状态', 'cuttable', state.filters.cuttableState, [
          { value: 'ALL', label: '全部' },
          { value: 'CUTTABLE', label: '可裁' },
          { value: 'WAITING_REVIEW', label: '待审核' },
          { value: 'WAITING_PREP', label: '待配料' },
          { value: 'PARTIAL_PREP', label: '部分配料' },
          { value: 'WAITING_CLAIM', label: '待领料' },
          { value: 'PARTIAL_CLAIM', label: '部分领料' },
          { value: 'CLAIM_EXCEPTION', label: '领料异常' },
          { value: 'IN_BATCH', label: '已入批次' },
          { value: 'NOT_READY', label: '暂不可裁' },
        ])}
        ${renderFilterSelect('覆盖状态', 'coverage', state.filters.coverageStatus, [
          { value: 'ALL', label: '全部' },
          { value: 'FULL', label: '整单可裁' },
          { value: 'PARTIAL', label: '部分料可裁' },
          { value: 'BLOCKED', label: '暂不可裁' },
        ])}
        ${renderFilterSelect('面料审核', 'audit', state.filters.auditStatus, [
          { value: 'ALL', label: '全部' },
          { value: 'NOT_REQUIRED', label: '无需审核' },
          { value: 'PENDING', label: '待审核' },
          { value: 'PARTIAL', label: '部分已审核' },
          { value: 'APPROVED', label: '已审核' },
        ])}
        ${renderFilterSelect('配料状态', 'config', state.filters.configStatus, [
          { value: 'ALL', label: '全部' },
          { value: 'NOT_CONFIGURED', label: '未配置' },
          { value: 'PARTIAL', label: '部分配置' },
          { value: 'CONFIGURED', label: '已配置' },
        ])}
        ${renderFilterSelect('领料状态', 'claim', state.filters.receiveStatus, [
          { value: 'ALL', label: '全部' },
          { value: 'NOT_RECEIVED', label: '待领料' },
          { value: 'PARTIAL', label: '部分领料' },
          { value: 'RECEIVED', label: '领料完成' },
          { value: 'EXCEPTION', label: '领料异常' },
        ])}
      </div>
    </div>
  `)
}

function isCompatibilityBlocked(item: CuttableOriginalOrderItem, currentCompatibilityKey: string | null): boolean {
  return !!currentCompatibilityKey && item.compatibilityKey !== currentCompatibilityKey
}

function renderOriginalOrderRows(order: CuttableStyleGroup['orders'][number], currentCompatibilityKey: string | null): string {
  return order.items
    .map((item) => {
      const disabled = !item.cuttableState.selectable || isCompatibilityBlocked(item, currentCompatibilityKey)
      const disabledReason = !item.cuttableState.selectable
        ? item.cuttableState.reasonText
        : currentCompatibilityKey && item.compatibilityKey !== currentCompatibilityKey
          ? '当前已选清单仅支持同一兼容组'
          : ''

      return `
        <tr class="border-b last:border-b-0 align-top ${state.selectedIds.includes(item.id) ? 'bg-blue-50/40' : ''}">
          <td class="px-3 py-3">
            <input
              type="checkbox"
              class="h-4 w-4 rounded border"
              data-cuttable-pool-action="toggle-item"
              data-item-id="${item.id}"
              ${state.selectedIds.includes(item.id) ? 'checked' : ''}
              ${disabled ? 'disabled' : ''}
            />
          </td>
          <td class="px-3 py-3 font-medium">${escapeHtml(item.originalCutOrderNo)}</td>
          <td class="px-3 py-3 text-sm text-muted-foreground">${escapeHtml(item.productionOrderNo)}</td>
          <td class="px-3 py-3">
            <div class="font-medium">${escapeHtml(item.materialSku)}</div>
            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.materialLabel)}</div>
          </td>
          <td class="px-3 py-3 text-sm text-muted-foreground">${escapeHtml(item.materialCategory)}</td>
          <td class="px-3 py-3">
            ${renderBadge(item.cuttableState.label, item.cuttableState.className)}
            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.cuttableState.detailText)}</div>
          </td>
          <td class="px-3 py-3 text-sm text-muted-foreground">${escapeHtml(item.currentStage || '-')}</td>
          <td class="px-3 py-3">
            <div class="text-xs text-muted-foreground">审核：${escapeHtml(auditStatusLabelMap[item.materialAuditStatus])}</div>
            <div class="mt-1 text-xs text-muted-foreground">配料：${escapeHtml(configStatusLabelMap[item.materialPrepStatus])}</div>
            <div class="mt-1 text-xs text-muted-foreground">领料：${escapeHtml(receiveStatusLabelMap[item.materialClaimStatus])}</div>
          </td>
          <td class="px-3 py-3 text-xs text-muted-foreground">
            ${escapeHtml(disabledReason || item.latestActionText)}
            ${item.mergeBatchNo ? `<div class="mt-1 font-medium text-violet-700">${escapeHtml(item.mergeBatchNo)}</div>` : ''}
          </td>
        </tr>
      `
    })
    .join('')
}

function renderOrderCard(order: CuttableStyleGroup['orders'][number], currentCompatibilityKey: string | null): string {
  return `
    <article class="rounded-lg border bg-card">
      <div class="flex flex-col gap-3 border-b px-4 py-3 lg:flex-row lg:items-start lg:justify-between">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <h3 class="text-sm font-semibold">${escapeHtml(order.productionOrderNo)}</h3>
            ${renderBadge(order.urgency.label, order.urgency.className)}
            ${renderBadge(order.coverageStatus.label, order.coverageStatus.className)}
          </div>
          <div class="mt-2 grid gap-2 text-xs text-muted-foreground md:grid-cols-2 xl:grid-cols-5">
            <span>下单数量：${escapeHtml(String(order.orderQty))}</span>
            <span>计划发货：${escapeHtml(order.plannedShipDateDisplay)}</span>
            <span>可裁原始单：${order.cuttableOriginalOrderCount}/${order.totalOriginalOrderCount}</span>
            <span>款号 / SPU：${escapeHtml(order.styleCode || order.spuCode || '-')}</span>
            <span>风险：${order.riskTags.length ? escapeHtml(order.riskTags.map((tag) => tag.label).join('、')) : '无'}</span>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted" data-cuttable-pool-action="select-order-cuttable" data-order-id="${order.id}">选中本单可裁项</button>
          <button class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted" data-cuttable-pool-action="go-original-orders" data-order-id="${order.id}">查看裁片单</button>
          <button class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted" data-cuttable-pool-action="go-material-prep" data-order-id="${order.id}">查看配料</button>
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1120px] text-sm">
          <thead class="border-b bg-muted/30 text-muted-foreground">
            <tr>
              <th class="px-3 py-2 text-left font-medium">选择</th>
              <th class="px-3 py-2 text-left font-medium">原始裁片单号</th>
              <th class="px-3 py-2 text-left font-medium">所属生产单</th>
              <th class="px-3 py-2 text-left font-medium">面料 SKU</th>
              <th class="px-3 py-2 text-left font-medium">面料属性</th>
              <th class="px-3 py-2 text-left font-medium">可裁状态</th>
              <th class="px-3 py-2 text-left font-medium">当前阶段</th>
              <th class="px-3 py-2 text-left font-medium">审核 / 配料 / 领料</th>
              <th class="px-3 py-2 text-left font-medium">原因 / 最新动作</th>
            </tr>
          </thead>
          <tbody>${renderOriginalOrderRows(order, currentCompatibilityKey)}</tbody>
        </table>
      </div>
    </article>
  `
}

function renderStyleGroups(groups: CuttableStyleGroup[], currentCompatibilityKey: string | null): string {
  if (!groups.length) {
    return '<section class="rounded-lg border bg-card px-6 py-14 text-center text-sm text-muted-foreground">当前筛选条件下暂无可展示的同款分组。</section>'
  }

  return groups
    .map(
      (group) => `
        <section class="rounded-xl border bg-card">
          <div class="flex flex-col gap-3 border-b px-4 py-4 lg:flex-row lg:items-start lg:justify-between">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h2 class="text-base font-semibold">${escapeHtml(group.styleCode || group.spuCode || '未命名同款')}</h2>
                <span class="text-sm text-muted-foreground">${escapeHtml(group.styleName || '-')}</span>
              </div>
              <div class="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>生产单 ${group.totalOrderCount} 个</span>
                <span>原始裁片单 ${group.totalOriginalOrderCount} 个</span>
                <span>当前可裁 ${group.cuttableOriginalOrderCount} 个</span>
                <span>整单可裁 ${group.fullOrderCount} 个</span>
                <span>部分料可裁 ${group.partialOrderCount} 个</span>
                <span>暂不可裁 ${group.blockedOrderCount} 个</span>
              </div>
              <div class="mt-3 flex flex-wrap gap-2">
                ${
                  group.compatibilityBuckets.length
                    ? group.compatibilityBuckets
                        .map((bucket) =>
                          renderBadge(
                            `${bucket.materialSku} · ${bucket.cuttableCount}/${bucket.totalCount}`,
                            bucket.cuttableCount > 0
                              ? 'bg-sky-50 text-sky-700 border border-sky-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200',
                          ),
                        )
                        .join('')
                    : '<span class="text-xs text-muted-foreground">当前无兼容组摘要</span>'
                }
              </div>
            </div>
            <div class="flex items-center gap-2 text-xs text-muted-foreground">
              <span>勾选粒度固定为原始裁片单</span>
            </div>
          </div>
          <div class="space-y-3 p-4">
            ${group.orders.map((order) => renderOrderCard(order, currentCompatibilityKey)).join('')}
          </div>
        </section>
      `,
    )
    .join('')
}

function renderProductionOrderFlat(groups: CuttableStyleGroup[], currentCompatibilityKey: string | null): string {
  const orders = groups.flatMap((group) => group.orders)
  if (!orders.length) {
    return '<section class="rounded-lg border bg-card px-6 py-14 text-center text-sm text-muted-foreground">当前筛选条件下暂无可展示的生产单。</section>'
  }

  return `
    <section class="space-y-3">
      ${orders
        .map(
          (order) => `
            <div class="rounded-lg border bg-card p-4">
              <div class="mb-3 text-xs text-muted-foreground">同款：${escapeHtml(order.styleCode || order.spuCode || '-')} · ${escapeHtml(order.styleName || '-')}</div>
              ${renderOrderCard(order, currentCompatibilityKey)}
            </div>
          `,
        )
        .join('')}
    </section>
  `
}

function renderSelectedPanel(viewModel = getViewModel()): string {
  const selectedItems = getSelectedItems(viewModel)
  const selectedOrderCount = new Set(selectedItems.map((item) => item.productionOrderId)).size
  const currentCompatibilityKey = getSelectedCompatibilityKey(viewModel)
  const selectedCompatibilityLabel = selectedItems[0]
    ? `${selectedItems[0].styleCode || selectedItems[0].spuCode} · ${selectedItems[0].materialSku}`
    : '未选择兼容组'

  return `
    <aside class="sticky top-24 rounded-xl border bg-card">
      <div class="border-b px-4 py-4">
        <h2 class="text-sm font-semibold">已选清单</h2>
        <p class="mt-1 text-xs text-muted-foreground">仅承接原始裁片单；下一步将把它们作为合并裁剪批次输入。</p>
      </div>
      <div class="space-y-4 p-4">
        <div class="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          <div class="rounded-lg border bg-muted/10 px-3 py-2">
            <div class="text-xs text-muted-foreground">已选原始裁片单</div>
            <div class="mt-1 text-lg font-semibold tabular-nums">${selectedItems.length}</div>
          </div>
          <div class="rounded-lg border bg-muted/10 px-3 py-2">
            <div class="text-xs text-muted-foreground">涉及生产单</div>
            <div class="mt-1 text-lg font-semibold tabular-nums">${selectedOrderCount}</div>
          </div>
          <div class="rounded-lg border bg-muted/10 px-3 py-2">
            <div class="text-xs text-muted-foreground">当前兼容组</div>
            <div class="mt-1 text-sm font-semibold">${escapeHtml(selectedCompatibilityLabel)}</div>
          </div>
        </div>

        ${
          selectedItems.length
            ? `
              <div class="space-y-2">
                ${selectedItems
                  .map(
                    (item) => `
                      <div class="rounded-lg border px-3 py-2">
                        <div class="flex items-start justify-between gap-3">
                          <div class="min-w-0">
                            <div class="font-medium">${escapeHtml(item.originalCutOrderNo)}</div>
                            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.productionOrderNo)} · ${escapeHtml(item.materialSku)}</div>
                          </div>
                          <button class="text-xs text-blue-600 hover:underline" data-cuttable-pool-action="toggle-item" data-item-id="${item.id}">移除</button>
                        </div>
                      </div>
                    `,
                  )
                  .join('')}
              </div>
            `
            : '<div class="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">当前尚未选择原始裁片单。请从同款分组内勾选可裁项，再进入下一步。</div>'
        }

        <div class="space-y-2">
          <button class="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" data-cuttable-pool-action="go-merge-batches">
            去合并裁剪批次
          </button>
          <button class="w-full rounded-md border px-4 py-2 text-sm hover:bg-muted" data-cuttable-pool-action="clear-selection">
            清空选择
          </button>
          <button class="w-full rounded-md border px-4 py-2 text-sm hover:bg-muted" data-cuttable-pool-action="go-selected-original-orders">
            查看原始裁片单
          </button>
        </div>
        ${currentCompatibilityKey ? `<p class="text-xs text-muted-foreground">当前选择将按 ${escapeHtml(selectedCompatibilityLabel)} 这一兼容组带到下一步。</p>` : ''}
      </div>
    </aside>
  `
}

function renderMainContent(groups: CuttableStyleGroup[], viewModel = getViewModel()): string {
  const currentCompatibilityKey = getSelectedCompatibilityKey(viewModel)

  return `
    <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div class="space-y-4">
        ${
          state.filters.viewMode === 'PRODUCTION_ORDER'
            ? renderProductionOrderFlat(groups, currentCompatibilityKey)
            : renderStyleGroups(groups, currentCompatibilityKey)
        }
      </div>
      ${renderSelectedPanel(viewModel)}
    </div>
  `
}

function renderEmptyStateIfNeeded(groups: CuttableStyleGroup[]): string {
  if (groups.length) return ''

  return `
    <section class="rounded-lg border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
      当前筛选条件下暂无可裁池数据，可清除筛选或返回生产单进度重新进入。
    </section>
  `
}

export function renderCraftCuttingCuttablePoolPage(): string {
  syncStateFromPath()

  const pathname = appStore.getState().pathname
  const meta = getCanonicalCuttingMeta(pathname, 'cuttable-pool')
  const viewModel = getViewModel()
  const groups = getVisibleGroups(viewModel)

  return `
    <div class="space-y-4 p-4">
      ${renderCuttingPageHeader(meta, {
        actionsHtml: renderActionBar(viewModel),
        showCompatibilityBadge: isCuttingAliasPath(pathname),
      })}
      ${renderStats(groups)}
      ${renderFilters()}
      ${renderActiveStateBar()}
      ${renderNoticeBar()}
      ${renderEmptyStateIfNeeded(groups)}
      ${groups.length ? renderMainContent(groups, viewModel) : ''}
    </div>
  `
}

function findOrderById(viewModel: ReturnType<typeof getViewModel>, orderId: string | undefined) {
  if (!orderId) return null
  return viewModel.orders.find((order) => order.id === orderId) ?? null
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

  const currentCompatibilityKey = getSelectedCompatibilityKey(viewModel)
  if (currentCompatibilityKey && currentCompatibilityKey !== item.compatibilityKey) {
    setNotice('当前已选清单仅支持同一兼容组的原始裁片单，请清空后重新选择，或在下一次批次中处理。')
    return true
  }

  state.selectedIds = [...state.selectedIds, itemId]
  clearNotice()
  return true
}

function selectOrderCuttable(orderId: string | undefined): boolean {
  const viewModel = getViewModel()
  const order = findOrderById(viewModel, orderId)
  if (!order) return false

  const selectableItems = order.items.filter((item) => item.cuttableState.selectable)
  if (!selectableItems.length) {
    setNotice('当前生产单下暂无可直接加入排产清单的原始裁片单。')
    return true
  }

  const currentCompatibilityKey = getSelectedCompatibilityKey(viewModel)
  if (currentCompatibilityKey) {
    const compatibleItems = selectableItems.filter((item) => item.compatibilityKey === currentCompatibilityKey)
    if (!compatibleItems.length) {
      setNotice('当前已选清单仅支持同一兼容组，本生产单下没有可并入当前选择的原始裁片单。')
      return true
    }
    state.selectedIds = Array.from(new Set([...state.selectedIds, ...compatibleItems.map((item) => item.id)]))
    clearNotice()
    return true
  }

  const compatibilityKeys = Array.from(new Set(selectableItems.map((item) => item.compatibilityKey)))
  if (compatibilityKeys.length > 1) {
    setNotice('当前生产单下包含多个兼容组，请直接勾选具体原始裁片单，或先选中同一料项后继续扩选。')
    return true
  }

  state.selectedIds = Array.from(new Set([...state.selectedIds, ...selectableItems.map((item) => item.id)]))
  clearNotice()
  return true
}

function navigateToOriginalOrdersForSelection(): boolean {
  const selectedItems = getSelectedItems()
  if (!selectedItems.length) {
    setNotice('请先选择至少 1 条原始裁片单，再查看对应明细。')
    return true
  }

  const firstItem = selectedItems[0]
  appStore.navigate(
    buildRouteWithQuery(getCanonicalCuttingPath('original-orders'), {
      productionOrderId: firstItem.productionOrderId,
      productionOrderNo: firstItem.productionOrderNo,
    }),
  )
  return true
}

function goToMergeBatches(): boolean {
  const selectedItems = getSelectedItems()
  const compatibility = areOriginalCutOrdersCompatibleForBatching(selectedItems)
  if (!compatibility.ok) {
    setNotice(compatibility.reason || '当前选择无法进入合并裁剪批次。')
    return true
  }

  try {
    sessionStorage.setItem(SELECTED_IDS_STORAGE_KEY, JSON.stringify(selectedItems.map((item) => item.originalCutOrderId)))
    sessionStorage.setItem(SELECTED_COMPATIBILITY_KEY_STORAGE_KEY, compatibility.compatibilityKey || '')
  } catch {
    setNotice('当前浏览器未能保存已选清单，请重试。')
    return true
  }

  clearNotice()
  appStore.navigate(getCanonicalCuttingPath('merge-batches'))
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
    if (field === 'cuttable') state.filters.cuttableState = input.value as CuttablePoolFilters['cuttableState']
    if (field === 'coverage') state.filters.coverageStatus = input.value as CuttablePoolFilters['coverageStatus']
    if (field === 'audit') state.filters.auditStatus = input.value as CuttablePoolFilters['auditStatus']
    if (field === 'config') state.filters.configStatus = input.value as CuttablePoolFilters['configStatus']
    if (field === 'claim') state.filters.receiveStatus = input.value as CuttablePoolFilters['receiveStatus']
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-cuttable-pool-action]')
  const action = actionNode?.dataset.cuttablePoolAction
  if (!action) return false

  if (action === 'set-view-mode') {
    const viewMode = actionNode.dataset.viewMode as CuttableViewMode | undefined
    if (!viewMode) return false
    state.filters.viewMode = viewMode
    return true
  }

  if (action === 'toggle-only-selected') {
    state.filters.onlySelected = !state.filters.onlySelected
    return true
  }

  if (action === 'toggle-only-cuttable') {
    state.filters.onlyCuttable = !state.filters.onlyCuttable
    return true
  }

  if (action === 'toggle-only-partial-orders') {
    state.filters.onlyPartialOrders = !state.filters.onlyPartialOrders
    return true
  }

  if (action === 'toggle-item') {
    return toggleItemSelection(actionNode.dataset.itemId)
  }

  if (action === 'select-order-cuttable') {
    return selectOrderCuttable(actionNode.dataset.orderId)
  }

  if (action === 'clear-selection') {
    state.selectedIds = []
    clearNotice()
    return true
  }

  if (action === 'clear-filters') {
    state.filters = { ...initialFilters, viewMode: state.filters.viewMode }
    clearNotice()
    return true
  }

  if (action === 'clear-all-state') {
    state.filters = { ...initialFilters, viewMode: state.filters.viewMode }
    clearNotice()
    appStore.navigate(getCanonicalCuttingPath('cuttable-pool'))
    return true
  }

  if (action === 'clear-prefilter') {
    const params = getCurrentSearchParams()
    ;['productionOrderId', 'productionOrderNo', 'styleCode', 'spuCode', 'urgencyLevel', 'riskOnly'].forEach((key) => params.delete(key))
    const query = params.toString()
    appStore.navigate(query ? `${getCanonicalCuttingPath('cuttable-pool')}?${query}` : getCanonicalCuttingPath('cuttable-pool'))
    return true
  }

  if (action === 'clear-notice') {
    clearNotice()
    return true
  }

  if (action === 'go-production-progress') {
    appStore.navigate(getCanonicalCuttingPath('production-progress'))
    return true
  }

  if (action === 'go-summary-index') {
    appStore.navigate(getCanonicalCuttingPath('summary'))
    return true
  }

  if (action === 'go-merge-batches') {
    return goToMergeBatches()
  }

  if (action === 'go-selected-original-orders') {
    return navigateToOriginalOrdersForSelection()
  }

  if (action === 'go-original-orders') {
    const viewModel = getViewModel()
    const order = findOrderById(viewModel, actionNode.dataset.orderId)
    if (!order) return false
    appStore.navigate(
      buildRouteWithQuery(getCanonicalCuttingPath('original-orders'), {
        productionOrderId: order.filterPayloadForOriginalOrders.productionOrderId,
        productionOrderNo: order.filterPayloadForOriginalOrders.productionOrderNo,
      }),
    )
    return true
  }

  if (action === 'go-material-prep') {
    const viewModel = getViewModel()
    const order = findOrderById(viewModel, actionNode.dataset.orderId)
    if (!order) return false
    appStore.navigate(
      buildRouteWithQuery(getCanonicalCuttingPath('material-prep'), {
        productionOrderId: order.filterPayloadForMaterialPrep.productionOrderId,
        productionOrderNo: order.filterPayloadForMaterialPrep.productionOrderNo,
      }),
    )
    return true
  }

  return false
}

export function isCraftCuttingCuttablePoolDialogOpen(): boolean {
  return false
}
