import type { CuttingConfigStatus, CuttingReceiveStatus } from '../../../data/fcs/cutting/types.ts'
import { appStore } from '../../../state/store.ts'
import { escapeHtml } from '../../../utils.ts'
import {
  areOriginalCutOrdersCompatibleForBatching,
  buildQuickMergeableBuckets,
  buildCuttablePoolStats,
  cuttableVisibleStatusMeta,
  filterCuttablePoolGroups,
  type CuttableOriginalOrderItem,
  type CuttablePoolFilters,
  type CuttablePoolPrefilter,
  type CuttableStyleGroup,
  type CuttableViewMode,
  type QuickMergeableBucket,
} from './cuttable-pool-model.ts'
import { getCanonicalCuttingMeta, getCanonicalCuttingPath, isCuttingAliasPath, renderCuttingPageHeader } from './meta.ts'
import {
  createReadyMergeBatchFromCuttableSelection,
  CUTTING_MERGE_BATCH_LEDGER_STORAGE_KEY,
  deserializeMergeBatchStorage,
  serializeMergeBatchStorage,
  type MergeBatchRecord,
} from './merge-batches-model.ts'
import { buildMergeBatchesProjection } from './merge-batches-projection.ts'
import type { ProductionProgressUrgencyKey } from './production-progress-model.ts'
import { urgencyMeta } from './production-progress-model.ts'
import { buildCuttablePoolProjection } from './cuttable-pool-projection.ts'
import {
  renderCompactKpiCard,
  renderStickyFilterShell,
  renderWorkbenchFilterChip,
  renderWorkbenchStateBar,
} from './layout.helpers.ts'

type FilterField = 'keyword' | 'urgency' | 'cuttable' | 'coverage' | 'config' | 'claim'

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
}

const state: CuttablePoolPageState = {
  filters: { ...initialFilters },
  selectedIds: [],
  querySignature: '',
  prefilter: null,
  notice: '',
  viewMode: 'STYLE_GROUP',
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
  return buildCuttablePoolProjection().viewModel
}

function readStoredMergeBatchLedger(): MergeBatchRecord[] {
  try {
    return deserializeMergeBatchStorage(localStorage.getItem(CUTTING_MERGE_BATCH_LEDGER_STORAGE_KEY))
  } catch {
    return []
  }
}

function writeStoredMergeBatchLedger(records: MergeBatchRecord[]): void {
  try {
    localStorage.setItem(CUTTING_MERGE_BATCH_LEDGER_STORAGE_KEY, serializeMergeBatchStorage(records))
  } catch {
    setNotice('当前浏览器未能保存合并裁剪批次，请稍后重试。')
  }
}

function upsertMergeBatchRecord(batch: MergeBatchRecord): void {
  const stored = readStoredMergeBatchLedger()
  const next = stored.filter((item) => item.mergeBatchId !== batch.mergeBatchId)
  next.push(batch)
  next.sort(
    (left, right) =>
      right.createdAt.localeCompare(left.createdAt, 'zh-CN') ||
      right.mergeBatchNo.localeCompare(left.mergeBatchNo, 'zh-CN'),
  )
  writeStoredMergeBatchLedger(next)
}

function getVisibleGroups(viewModel = getViewModel()) {
  return filterCuttablePoolGroups(viewModel, state.filters, state.selectedIds, state.prefilter)
}

function getVisibleOrders(viewModel = getViewModel()) {
  return getVisibleGroups(viewModel).flatMap((group) => group.orders)
}

function getVisibleItems(viewModel = getViewModel()): CuttableOriginalOrderItem[] {
  return getVisibleOrders(viewModel).flatMap((order) => order.items)
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

function getContextOrder(viewModel = getViewModel()) {
  const prefilter = state.prefilter
  if (!prefilter) return null
  return (
    viewModel.orders.find(
      (order) =>
        (!!prefilter.productionOrderId && order.productionOrderId === prefilter.productionOrderId) ||
        (!!prefilter.productionOrderNo && order.productionOrderNo === prefilter.productionOrderNo),
    ) ?? null
  )
}

function setNotice(message: string): void {
  state.notice = message
}

function clearNotice(): void {
  state.notice = ''
}

function resetFilterState(): void {
  state.filters = { ...initialFilters }
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
      <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cuttable-pool-action="go-capacity-overview">查看产能日历</button>
      <button class="${selectedCount ? 'rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700' : 'rounded-md border px-3 py-2 text-sm hover:bg-muted'}" data-cuttable-pool-action="create-merge-batch">
        创建合并裁剪批次${selectedCount ? `（${selectedCount}）` : ''}
      </button>
    </div>
  `
}

function renderStats(groups: ReturnType<typeof getVisibleGroups>): string {
  const stats = buildCuttablePoolStats(groups, state.selectedIds)
  return `
    <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      ${renderCompactKpiCard('生产单数', stats.productionOrderCount, '当前筛选范围', 'text-slate-900')}
      ${renderCompactKpiCard('原始裁片单总数', stats.originalCutOrderCount, '当前筛选范围', 'text-blue-600')}
      ${renderCompactKpiCard('当前可裁数', stats.cuttableOriginalOrderCount, '配料 / 领料均已到位', 'text-emerald-600')}
      ${renderCompactKpiCard('待配料 / 部分配料数', stats.prepPendingOriginalOrderCount, '仍需补齐仓库配料', 'text-amber-600')}
      ${renderCompactKpiCard('待领料 / 领料差异数', stats.claimPendingOriginalOrderCount, '仍需领料或复核差异', 'text-sky-600')}
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

function renderQuickFilterRow(): string {
  return `
    <div class="flex flex-wrap items-center gap-2">
      <span class="text-xs font-medium text-muted-foreground">快捷筛选</span>
      ${renderWorkbenchFilterChip(
        '只看可裁',
        'data-cuttable-pool-action="toggle-only-cuttable"',
        state.filters.onlyCuttable ? 'emerald' : 'blue',
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
  if (state.filters.cuttableState !== 'ALL') labels.push(`裁片单状态：${cuttableVisibleStatusMeta[state.filters.cuttableState].label}`)
  if (state.filters.coverageStatus !== 'ALL') labels.push(`生产单状态：${state.filters.coverageStatus === 'FULL' ? '整单可裁' : state.filters.coverageStatus === 'PARTIAL' ? '部分可裁' : '整单不可裁'}`)
  if (state.filters.configStatus !== 'ALL') labels.push(`配料状态：${configStatusLabelMap[state.filters.configStatus]}`)
  if (state.filters.receiveStatus !== 'ALL') {
    const receiveLabelMap: Record<CuttingReceiveStatus | 'EXCEPTION', string> = {
      NOT_RECEIVED: '待领料',
      PARTIAL: '部分领料',
      RECEIVED: '领料完成',
      EXCEPTION: '领料异常',
    }
    labels.push(`领料状态：${receiveLabelMap[state.filters.receiveStatus]}`)
  }
  if (state.filters.onlyCuttable) labels.push('快捷筛选：只看可裁')
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
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <label class="space-y-2 md:col-span-2 xl:col-span-2">
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
        ${renderFilterSelect('裁片单状态', 'cuttable', state.filters.cuttableState, [
          { value: 'ALL', label: '全部' },
          { value: 'CUTTABLE', label: '可裁' },
          { value: 'NOT_CUTTABLE', label: '不可裁' },
        ])}
        ${renderFilterSelect('生产单状态', 'coverage', state.filters.coverageStatus, [
          { value: 'ALL', label: '全部' },
          { value: 'FULL', label: '整单可裁' },
          { value: 'PARTIAL', label: '部分可裁' },
          { value: 'BLOCKED', label: '整单不可裁' },
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

function formatMaterialProgressHint(prefix: '已配' | '已领', rollCount: number, length: number): string {
  const parts: string[] = []
  if (rollCount > 0) parts.push(`${prefix} ${rollCount} 卷`)
  if (length > 0) parts.push(`${length} m`)
  return parts.join(' / ')
}

function renderOriginalOrderRows(order: ReturnType<typeof getVisibleOrders>[number], currentCompatibilityKey: string | null): string {
  return order.items
    .map((item) => {
      const disabled = !item.cuttableState.selectable || isCompatibilityBlocked(item, currentCompatibilityKey)

      const prepHint = formatMaterialProgressHint('已配', item.configuredRollCount, item.configuredLength)
      const claimHint = formatMaterialProgressHint('已领', item.receivedRollCount, item.receivedLength)

      return `
        <tr class="border-b last:border-b-0 align-top ${state.selectedIds.includes(item.id) ? 'bg-blue-50/40' : ''}" data-testid="cutting-cuttable-pool-original-order-row">
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
            <button class="font-medium text-blue-600 hover:underline" data-cuttable-pool-action="go-original-order-detail" data-item-id="${item.id}">
              ${escapeHtml(item.originalCutOrderNo)}
            </button>
          </td>
          <td class="px-3 py-3">
            <div class="font-medium text-foreground">${escapeHtml(item.materialLabel)}</div>
            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.materialSku)}</div>
            <div class="mt-1 text-[11px] text-muted-foreground">${escapeHtml(item.materialCategory)}</div>
          </td>
          <td class="px-3 py-3">
            ${renderBadge(
              configStatusLabelMap[item.materialPrepStatus],
              item.materialPrepStatus === 'CONFIGURED'
                ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                : item.materialPrepStatus === 'PARTIAL'
                  ? 'bg-orange-100 text-orange-700 border border-orange-200'
                  : 'bg-slate-100 text-slate-700 border border-slate-200',
            )}
            ${prepHint ? `<div class="mt-1 text-xs text-muted-foreground">${escapeHtml(prepHint)}</div>` : ''}
          </td>
          <td class="px-3 py-3">
            ${renderBadge(
              item.cuttableState.key === 'CLAIM_EXCEPTION' ? '领料异常' : receiveStatusLabelMap[item.materialClaimStatus],
              item.cuttableState.key === 'CLAIM_EXCEPTION'
                ? 'bg-rose-100 text-rose-700 border border-rose-200'
                : item.materialClaimStatus === 'RECEIVED'
                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                  : item.materialClaimStatus === 'PARTIAL'
                    ? 'bg-sky-100 text-sky-700 border border-sky-200'
                    : 'bg-blue-100 text-blue-700 border border-blue-200',
            )}
            ${claimHint ? `<div class="mt-1 text-xs text-muted-foreground">${escapeHtml(claimHint)}</div>` : ''}
          </td>
          <td class="px-3 py-3">
            ${renderBadge(item.visibleStatus.label, item.visibleStatus.className)}
          </td>
          <td class="px-3 py-3 text-xs text-muted-foreground">
            ${escapeHtml(item.currentSituationText)}
          </td>
        </tr>
      `
    })
    .join('')
}

function getQuickBucketLabel(bucket: QuickMergeableBucket): string {
  return `${bucket.styleCode || bucket.spuCode || '同款'} · ${bucket.materialSku}`
}

function renderOrderQuickSelectActions(order: ReturnType<typeof getVisibleOrders>[number]): string {
  const buckets = buildQuickMergeableBuckets(order.items)
  if (!buckets.length) return ''

  if (buckets.length === 1) {
    return `
      <button
        class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted"
        data-cuttable-pool-action="select-quick-bucket"
        data-order-id="${order.id}"
        data-compatibility-key="${escapeHtml(buckets[0].compatibilityKey)}"
      >
        快速选择本单可合并项
      </button>
    `
  }

  return buckets
    .map(
      (bucket) => `
        <button
          class="rounded-full border px-3 py-1 text-xs hover:bg-muted"
          data-cuttable-pool-action="select-quick-bucket"
          data-order-id="${order.id}"
          data-compatibility-key="${escapeHtml(bucket.compatibilityKey)}"
        >
          快速选择 ${escapeHtml(bucket.materialSku)}（${bucket.cuttableCount}）
        </button>
      `,
    )
    .join('')
}

function renderOrderCard(order: ReturnType<typeof getVisibleOrders>[number], currentCompatibilityKey: string | null): string {
  return `
    <article class="rounded-lg border bg-card" data-testid="cutting-cuttable-pool-order-card">
      <div class="flex flex-col gap-3 border-b px-4 py-3 lg:flex-row lg:items-start lg:justify-between">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <h3 class="text-sm font-semibold">${escapeHtml(order.productionOrderNo)}</h3>
            ${renderBadge(order.urgency.label, order.urgency.className)}
            ${renderBadge(order.coverageStatus.label, order.coverageStatus.className)}
          </div>
          <div class="mt-2 grid gap-2 text-xs text-muted-foreground md:grid-cols-2 xl:grid-cols-6">
            <span>工厂：${escapeHtml(order.factoryName || '—')}</span>
            <span>款号 / SPU：${escapeHtml(order.styleCode || order.spuCode || '-')}</span>
            <span>款式名称：${escapeHtml(order.styleName || '-')}</span>
            <span>下单成衣件数（件）：${escapeHtml(String(order.orderQty))}</span>
            <span>计划发货：${escapeHtml(order.plannedShipDateDisplay)}</span>
            <span>${escapeHtml(order.shipCountdownText)}</span>
            <span>原始裁片单总数：${order.totalOriginalOrderCount}</span>
            <span>当前可裁数：${order.cuttableOriginalOrderCount}</span>
            <span>生产单状态：${escapeHtml(order.coverageStatus.label)}</span>
          </div>
        </div>
        <div class="flex max-w-full flex-col items-start gap-2">
          <div class="flex flex-wrap items-center gap-2">
            <button class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted" data-cuttable-pool-action="go-original-orders" data-order-id="${order.id}">查看原始裁片单</button>
            <button class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted" data-cuttable-pool-action="go-material-prep" data-order-id="${order.id}">查看配料 / 领料</button>
            <button class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted" data-cuttable-pool-action="go-capacity-constraints" data-order-id="${order.productionOrderId}">查看产能约束</button>
          </div>
          <div class="flex flex-wrap items-center gap-2">${renderOrderQuickSelectActions(order)}</div>
        </div>
      </div>
      <div class="overflow-x-auto" data-testid="cutting-cuttable-pool-original-order-table">
        <table class="w-full min-w-[920px] text-sm">
          <thead class="border-b bg-muted/30 text-muted-foreground">
            <tr>
              <th class="px-3 py-2 text-left font-medium">选择</th>
              <th class="px-3 py-2 text-left font-medium">原始裁片单号</th>
              <th class="px-3 py-2 text-left font-medium">面料</th>
              <th class="px-3 py-2 text-left font-medium">配料状态</th>
              <th class="px-3 py-2 text-left font-medium">领料状态</th>
              <th class="px-3 py-2 text-left font-medium">裁片单状态</th>
              <th class="px-3 py-2 text-left font-medium">当前情况</th>
            </tr>
          </thead>
          <tbody>${renderOriginalOrderRows(order, currentCompatibilityKey)}</tbody>
        </table>
      </div>
    </article>
  `
}

function renderQuickMergeableSidebar(viewModel = getViewModel()): string {
  const buckets = buildQuickMergeableBuckets(getVisibleItems(viewModel))
  if (!buckets.length) {
    return `
      <section class="space-y-2" data-testid="cutting-cuttable-pool-quick-select-sidebar">
        <div>
          <h3 class="text-sm font-semibold text-foreground">快速选择可合并裁剪</h3>
          <p class="mt-1 text-xs text-muted-foreground">当前筛选范围内暂无可直接快速选择的同款同料可裁项。</p>
        </div>
      </section>
    `
  }

  return `
    <section class="space-y-2" data-testid="cutting-cuttable-pool-quick-select-sidebar">
      <div>
        <h3 class="text-sm font-semibold text-foreground">快速选择可合并裁剪</h3>
        <p class="mt-1 text-xs text-muted-foreground">按同款同料快速带出当前可见范围内的可裁原始裁片单。</p>
      </div>
      <div class="space-y-2">
        ${buckets
          .map(
            (bucket) => `
              <div class="rounded-lg border px-3 py-2" data-testid="cutting-cuttable-pool-quick-select-entry">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <div class="font-medium text-foreground">${escapeHtml(getQuickBucketLabel(bucket))}</div>
                    <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(bucket.styleName || '未命名款式')}</div>
                    <div class="mt-1 text-[11px] text-muted-foreground">
                      面料：${escapeHtml(bucket.materialLabel)} / ${escapeHtml(bucket.materialSku)}
                    </div>
                    <div class="mt-1 text-[11px] text-muted-foreground">
                      可裁 ${bucket.cuttableCount} 个 · 生产单 ${bucket.productionOrderCount} 个 · 最早发货 ${escapeHtml(bucket.earliestShipDateDisplay || '待补日期')} · 最高紧急程度 ${escapeHtml(bucket.highestUrgencyLabel)}
                    </div>
                  </div>
                  <div class="flex shrink-0 flex-col items-end gap-1">
                    <button class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted" data-cuttable-pool-action="select-quick-bucket" data-compatibility-key="${escapeHtml(bucket.compatibilityKey)}">快速选择</button>
                    <button class="text-xs text-blue-600 hover:underline" data-cuttable-pool-action="go-capacity-constraints" data-order-ids="${escapeHtml(bucket.productionOrderIds.join(','))}">查看产能约束</button>
                  </div>
                </div>
              </div>
            `,
          )
          .join('')}
      </div>
    </section>
  `
}

function renderStyleGroups(groups: CuttableStyleGroup[], currentCompatibilityKey: string | null): string {
  if (!groups.length) {
    return '<section class="rounded-lg border bg-card px-6 py-14 text-center text-sm text-muted-foreground">当前筛选条件下暂无可展示的同款分组。</section>'
  }

  return groups
    .map(
      (group) => `
        <section class="rounded-xl border bg-card" data-testid="cutting-cuttable-pool-style-group">
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
                    : '<span class="text-xs text-muted-foreground">当前无同款同料摘要</span>'
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
    <section class="space-y-3" data-testid="cutting-cuttable-pool-order-list">
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
  const selectedOrderIds = Array.from(new Set(selectedItems.map((item) => item.productionOrderId)))
  const selectedCompatibilityLabel = selectedItems[0]
    ? `${selectedItems[0].styleCode || selectedItems[0].spuCode || '同款'} · ${selectedItems[0].materialSku}`
    : '未选择'

  return `
    <aside class="sticky top-24 rounded-xl border bg-card" data-testid="cutting-cuttable-pool-selected-sidebar">
      <div class="border-b px-4 py-4">
        <h2 class="text-sm font-semibold">已选清单</h2>
        <p class="mt-1 text-xs text-muted-foreground">原始裁片单进入合并裁剪批次前的选择清单。</p>
      </div>
      <div class="space-y-4 p-4">
        ${renderQuickMergeableSidebar(viewModel)}

        <div class="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          <div class="rounded-lg border bg-muted/10 px-3 py-2">
            <div class="text-xs text-muted-foreground">已选原始裁片单</div>
            <div class="mt-1 text-lg font-semibold tabular-nums">${selectedItems.length}</div>
          </div>
          <div class="rounded-lg border bg-muted/10 px-3 py-2">
            <div class="text-xs text-muted-foreground">涉及生产单</div>
            <div class="mt-1 text-lg font-semibold tabular-nums">${selectedOrderIds.length}</div>
          </div>
          <div class="rounded-lg border bg-muted/10 px-3 py-2">
            <div class="text-xs text-muted-foreground">当前同款同料</div>
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
                            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.productionOrderNo)} · ${escapeHtml(item.materialLabel)} / ${escapeHtml(item.materialSku)}</div>
                          </div>
                          <button class="text-xs text-blue-600 hover:underline" data-cuttable-pool-action="toggle-item" data-item-id="${item.id}">移除</button>
                        </div>
                      </div>
                    `,
                  )
                  .join('')}
              </div>
            `
            : '<div class="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">当前尚未选择原始裁片单。可直接勾选，或先用右侧快速选择推荐组。</div>'
        }

        <div class="space-y-2">
          <button class="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" data-cuttable-pool-action="create-merge-batch">
            创建合并裁剪批次
          </button>
          <button class="w-full rounded-md border px-4 py-2 text-sm hover:bg-muted" data-cuttable-pool-action="clear-selection">
            清空选择
          </button>
          <button
            class="w-full rounded-md border px-4 py-2 text-sm hover:bg-muted ${selectedItems.length ? '' : 'cursor-not-allowed opacity-60'}"
            data-cuttable-pool-action="go-capacity-constraints"
            data-order-ids="${escapeHtml(selectedOrderIds.join(','))}"
            ${selectedItems.length ? '' : 'disabled'}
          >
            查看产能约束
          </button>
          <button
            class="w-full rounded-md border px-4 py-2 text-sm hover:bg-muted ${selectedItems.length ? '' : 'cursor-not-allowed opacity-60'}"
            data-cuttable-pool-action="go-selected-original-orders"
            ${selectedItems.length ? '' : 'disabled'}
          >
            查看已选原始裁片单
          </button>
        </div>

        ${selectedItems.length ? `<p class="text-xs text-muted-foreground">当前选择将按 ${escapeHtml(selectedCompatibilityLabel)} 这一同款同料清单进入下一步。</p>` : ''}
      </div>
    </aside>
  `
}

function renderEmptyStateIfNeeded(groups: ReturnType<typeof getVisibleGroups>): string {
  if (groups.length) return ''

  return `
    <section class="rounded-lg border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
      当前筛选条件下暂无可裁准备数据，可清除筛选或返回生产单进度重新进入。
    </section>
  `
}

export function renderCraftCuttingCuttablePoolPage(): string {
  syncStateFromPath()

  const pathname = appStore.getState().pathname
  const meta = getCanonicalCuttingMeta(pathname, 'cuttable-pool')
  const viewModel = getViewModel()
  const groups = getVisibleGroups(viewModel)
  const currentCompatibilityKey = getSelectedCompatibilityKey(viewModel)

  return `
    <div class="space-y-4 p-4" data-testid="cutting-cuttable-pool-page">
      ${renderCuttingPageHeader(meta, {
        actionsHtml: renderActionBar(viewModel),
        showCompatibilityBadge: isCuttingAliasPath(pathname),
      })}
      ${renderStats(groups)}
      ${renderFilters()}
      ${renderActiveStateBar()}
      ${renderNoticeBar()}
      ${renderEmptyStateIfNeeded(groups)}
      ${
        groups.length
          ? `
            <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
              <div class="space-y-4">
                ${
                  state.viewMode === 'PRODUCTION_ORDER'
                    ? renderProductionOrderFlat(groups, currentCompatibilityKey)
                    : renderStyleGroups(groups, currentCompatibilityKey)
                }
              </div>
              ${renderSelectedPanel(viewModel)}
            </div>
          `
          : ''
      }
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
    setNotice('当前已选清单仅支持同一同款同料，请清空后重新选择，或改用上方快速选择。')
    return true
  }

  state.selectedIds = [...state.selectedIds, itemId]
  clearNotice()
  return true
}

function findQuickMergeableBucket(viewModel: ReturnType<typeof getViewModel>, compatibilityKey: string | undefined, orderId?: string): QuickMergeableBucket | null {
  if (!compatibilityKey) return null
  const items = orderId ? findOrderById(viewModel, orderId)?.items ?? [] : getVisibleItems(viewModel)
  return buildQuickMergeableBuckets(items).find((bucket) => bucket.compatibilityKey === compatibilityKey) ?? null
}

function selectQuickMergeableBucket(bucket: QuickMergeableBucket | null): boolean {
  if (!bucket) return false
  const currentCompatibilityKey = getSelectedCompatibilityKey()
  const nextIds = Array.from(new Set(bucket.itemIds))

  if (!state.selectedIds.length || !currentCompatibilityKey) {
    state.selectedIds = nextIds
    clearNotice()
    return true
  }

  if (currentCompatibilityKey === bucket.compatibilityKey) {
    state.selectedIds = Array.from(new Set([...state.selectedIds, ...nextIds]))
    clearNotice()
    return true
  }

  state.selectedIds = nextIds
  setNotice(`已切换到 ${getQuickBucketLabel(bucket)} 的可合并裁剪清单。`)
  return true
}

function navigateToOriginalOrdersForSelection(): boolean {
  const selectedItems = getSelectedItems()
  if (!selectedItems.length) {
    setNotice('请先选择至少 1 条原始裁片单，再查看对应明细。')
    return true
  }

  if (selectedItems.length === 1) {
    const [selectedItem] = selectedItems
    appStore.navigate(
      buildRouteWithQuery(getCanonicalCuttingPath('original-orders'), {
        originalCutOrderId: selectedItem.originalCutOrderId,
        originalCutOrderNo: selectedItem.originalCutOrderNo,
        productionOrderId: selectedItem.productionOrderId,
        productionOrderNo: selectedItem.productionOrderNo,
      }),
    )
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

function buildCapacityOverviewPath(): string {
  const contextOrder = getContextOrder()
  return buildRouteWithQuery('/fcs/capacity/overview', {
    source: 'cuttable-pool',
    keyword: contextOrder?.productionOrderNo || '',
  })
}

function buildCapacityConstraintsPath(orderIds: string[]): string {
  const uniqueIds = Array.from(new Set(orderIds.filter(Boolean)))
  return buildRouteWithQuery('/fcs/capacity/constraints', {
    source: 'cuttable-pool',
    orderId: uniqueIds.length === 1 ? uniqueIds[0] : undefined,
    orderIds: uniqueIds.length > 1 ? uniqueIds.join(',') : undefined,
  })
}

function createMergeBatchAndGo(): boolean {
  const selectedItems = getSelectedItems()
  const compatibility = areOriginalCutOrdersCompatibleForBatching(selectedItems)
  if (!compatibility.ok) {
    setNotice(compatibility.reason || '当前选择无法进入合并裁剪批次。')
    return true
  }

  const batch = createReadyMergeBatchFromCuttableSelection({
    items: selectedItems,
    existingBatches: buildMergeBatchesProjection().sources.mergeBatches,
  })

  upsertMergeBatchRecord(batch)
  state.selectedIds = []
  clearNotice()
  appStore.navigate(
    buildRouteWithQuery(getCanonicalCuttingPath('merge-batches'), {
      focusBatchId: batch.mergeBatchId,
      createdBatchNo: batch.mergeBatchNo,
    }),
  )
  return true
}

function navigateToCapacityOverview(): boolean {
  appStore.navigate(buildCapacityOverviewPath())
  return true
}

function navigateToCapacityConstraints(orderIds: string[]): boolean {
  if (!orderIds.length) return false
  appStore.navigate(buildCapacityConstraintsPath(orderIds))
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
    if (field === 'config') state.filters.configStatus = input.value as CuttablePoolFilters['configStatus']
    if (field === 'claim') state.filters.receiveStatus = input.value as CuttablePoolFilters['receiveStatus']
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-cuttable-pool-action]')
  const action = actionNode?.dataset.cuttablePoolAction
  if (!action) return false

  if (action === 'toggle-only-cuttable') {
    state.filters.onlyCuttable = !state.filters.onlyCuttable
    return true
  }

  if (action === 'set-view-mode') {
    const nextMode = actionNode.dataset.viewMode as CuttableViewMode | undefined
    if (!nextMode) return false
    state.viewMode = nextMode
    return true
  }

  if (action === 'toggle-item') {
    return toggleItemSelection(actionNode.dataset.itemId)
  }

  if (action === 'select-quick-bucket') {
    const viewModel = getViewModel()
    const bucket = findQuickMergeableBucket(viewModel, actionNode.dataset.compatibilityKey, actionNode.dataset.orderId)
    return selectQuickMergeableBucket(bucket)
  }

  if (action === 'clear-selection') {
    state.selectedIds = []
    clearNotice()
    return true
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

  if (action === 'go-production-progress') {
    appStore.navigate(getCanonicalCuttingPath('production-progress'))
    return true
  }

  if (action === 'go-capacity-overview') {
    return navigateToCapacityOverview()
  }

  if (action === 'go-capacity-constraints') {
    const directOrderId = actionNode.dataset.orderId
    const orderIds = directOrderId ? [directOrderId] : (actionNode.dataset.orderIds || '').split(',').filter(Boolean)
    return navigateToCapacityConstraints(orderIds)
  }

  if (action === 'create-merge-batch') {
    return createMergeBatchAndGo()
  }

  if (action === 'go-selected-original-orders') {
    return navigateToOriginalOrdersForSelection()
  }

  if (action === 'go-original-order-detail') {
    const viewModel = getViewModel()
    const itemId = actionNode.dataset.itemId
    const item = itemId ? viewModel.itemsById[itemId] : null
    if (!item) return false
    appStore.navigate(
      buildRouteWithQuery(getCanonicalCuttingPath('original-orders'), {
        originalCutOrderId: item.originalCutOrderId,
        originalCutOrderNo: item.originalCutOrderNo,
        productionOrderId: item.productionOrderId,
        productionOrderNo: item.productionOrderNo,
      }),
    )
    return true
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
