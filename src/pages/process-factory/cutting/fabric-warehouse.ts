import { renderDetailDrawer as uiDetailDrawer } from '../../../components/ui'
import type { CuttingFabricStockRecord } from '../../../data/fcs/cutting/warehouse-management'
import { appStore } from '../../../state/store'
import { escapeHtml, formatDateTime } from '../../../utils'
import {
  buildFabricWarehouseViewModel,
  fabricWarehouseMaterialMeta,
  fabricWarehouseStatusMeta,
  filterFabricWarehouseItems,
  findFabricWarehouseByPrefilter,
  formatFabricWarehouseLength,
  type FabricWarehouseFilters,
  type FabricWarehousePrefilter,
  type FabricWarehouseRiskKey,
  type FabricWarehouseStockItem,
} from './fabric-warehouse-model'
import { buildFabricWarehouseProjection } from './fabric-warehouse-projection'
import {
  renderCompactKpiCard,
  renderStickyFilterShell,
  renderStickyTableScroller,
  renderWorkbenchFilterChip,
  renderWorkbenchStateBar,
} from './layout.helpers'
import { getCanonicalCuttingMeta, getCanonicalCuttingPath, isCuttingAliasPath, renderCuttingPageHeader } from './meta'
import { getWarehouseSearchParams } from './warehouse-shared'
import {
  buildCuttingDrillChipLabels,
  buildCuttingDrillSummary,
  buildCuttingRouteWithContext,
  buildReturnToSummaryContext,
  hasSummaryReturnContext,
  normalizeLegacyCuttingPayload,
  readCuttingDrillContextFromLocation,
  type CuttingDrillContext,
  type CuttingNavigationTarget,
} from './navigation-context'

type FilterField = 'keyword' | 'materialCategory' | 'status' | 'risk'

interface FabricWarehousePageState {
  records: CuttingFabricStockRecord[]
  filters: FabricWarehouseFilters
  activeStockId: string | null
  prefilter: FabricWarehousePrefilter | null
  drillContext: CuttingDrillContext | null
  querySignature: string
  focusedStockIds: string[]
}

const initialFilters: FabricWarehouseFilters = {
  keyword: '',
  materialCategory: 'ALL',
  status: 'ALL',
  risk: 'ALL',
  lowRemainingOnly: false,
}

const FIELD_TO_FILTER_KEY: Record<FilterField, keyof FabricWarehouseFilters> = {
  keyword: 'keyword',
  materialCategory: 'materialCategory',
  status: 'status',
  risk: 'risk',
}

const state: FabricWarehousePageState = {
  records: buildFabricWarehouseProjection().records.map((item) => ({ ...item })),
  filters: { ...initialFilters },
  activeStockId: null,
  prefilter: null,
  drillContext: null,
  querySignature: '',
  focusedStockIds: [],
}

function getViewModel() {
  return buildFabricWarehouseProjection({ records: state.records }).viewModel
}

function getFilteredItems() {
  return filterFabricWarehouseItems(getViewModel().items, state.filters, state.prefilter)
}

function getPrefilterFromQuery(): FabricWarehousePrefilter | null {
  const params = getWarehouseSearchParams()
  const drillContext = readCuttingDrillContextFromLocation(params)
  const prefilter: FabricWarehousePrefilter = {
    materialSku: drillContext?.materialSku || params.get('materialSku') || undefined,
    originalCutOrderId: drillContext?.originalCutOrderId || params.get('originalCutOrderId') || undefined,
    originalCutOrderNo: drillContext?.originalCutOrderNo || params.get('originalCutOrderNo') || undefined,
    productionOrderId: drillContext?.productionOrderId || params.get('productionOrderId') || undefined,
    productionOrderNo: drillContext?.productionOrderNo || params.get('productionOrderNo') || undefined,
    rollNo: params.get('rollNo') || undefined,
  }

  return Object.values(prefilter).some(Boolean) ? prefilter : null
}

function syncPrefilterFromQuery(): void {
  const pathname = appStore.getState().pathname
  if (pathname === state.querySignature) return
  state.querySignature = pathname
  state.drillContext = readCuttingDrillContextFromLocation(getWarehouseSearchParams())
  state.prefilter = getPrefilterFromQuery()
  const matched = findFabricWarehouseByPrefilter(getViewModel().items, state.prefilter)
  state.activeStockId = matched?.stockItemId ?? null
}

function getActiveItem(): FabricWarehouseStockItem | null {
  if (!state.activeStockId) return null
  return getViewModel().itemsById[state.activeStockId] ?? null
}

function renderTag(label: string, className: string): string {
  return `<span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}">${escapeHtml(label)}</span>`
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
        data-fabric-warehouse-field="${field}"
      >
        ${options
          .map((option) => `<option value="${escapeHtml(option.value)}" ${option.value === value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`)
          .join('')}
      </select>
    </label>
  `
}

function renderHeaderActions(): string {
  const returnToSummary = hasSummaryReturnContext(state.drillContext)
    ? `<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-fabric-warehouse-action="return-summary">返回裁剪总表</button>`
    : ''
  return `
    <div class="flex flex-wrap items-center gap-2">
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-fabric-warehouse-action="go-material-prep-index">返回仓库配料领料</button>
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-fabric-warehouse-action="go-original-orders-index">查看原始裁片单</button>
      ${returnToSummary}
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-fabric-warehouse-action="go-summary-index">查看裁剪总表</button>
    </div>
  `
}

function renderStatsCards(): string {
  const summary = getViewModel().summary
  return `
    <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      ${renderCompactKpiCard('面料 SKU 数', summary.stockItemCount, '当前裁床仓库存对象', 'text-slate-900')}
      ${renderCompactKpiCard('卷数', summary.rollCount, '当前卷级明细总量', 'text-blue-600')}
      ${renderCompactKpiCard('配置长度总量', formatFabricWarehouseLength(summary.configuredLengthTotal), '来自仓库配料领料', 'text-emerald-600')}
      ${renderCompactKpiCard('剩余长度总量', formatFabricWarehouseLength(summary.remainingLengthTotal), '裁床侧当前可用余量', 'text-violet-600')}
      ${renderCompactKpiCard('低余量项数', summary.lowRemainingItemCount, '建议优先核对并关注', 'text-amber-600')}
    </section>
  `
}

function renderPrefilterBar(): string {
  if (!state.prefilter) return ''

  const labels = Array.from(
    new Set([
      ...buildCuttingDrillChipLabels(state.drillContext),
      state.prefilter.rollNo ? `卷号：${state.prefilter.rollNo}` : '',
    ].filter(Boolean)),
  )

  return renderWorkbenchStateBar({
    summary: buildCuttingDrillSummary(state.drillContext) || '当前按外部上下文预筛裁床仓记录',
    chips: labels.map((label) => renderWorkbenchFilterChip(label, 'data-fabric-warehouse-action="clear-prefilter"', 'amber')),
    clearAttrs: 'data-fabric-warehouse-action="clear-prefilter"',
  })
}

function renderFilterStateBar(): string {
  const labels: string[] = []
  if (state.filters.keyword.trim()) labels.push(`关键词：${state.filters.keyword.trim()}`)
  if (state.filters.materialCategory !== 'ALL') labels.push(`面料类别：${fabricWarehouseMaterialMeta[state.filters.materialCategory].label}`)
  if (state.filters.status !== 'ALL') labels.push(`库存状态：${fabricWarehouseStatusMeta[state.filters.status].label}`)
  if (state.filters.risk !== 'ALL') {
    const riskLabelMap: Record<FabricWarehouseRiskKey, string> = {
      LOW_REMAINING: '低余量',
      STOCK_RECHECK: '待核对',
      WAITING_RECEIVE: '待领用',
    }
    labels.push(`风险筛选：${riskLabelMap[state.filters.risk]}`)
  }
  if (state.filters.lowRemainingOnly) labels.push('仅看低余量：已开启')
  if (!labels.length) return ''

  return renderWorkbenchStateBar({
    summary: '当前裁床仓视图条件',
    chips: labels.map((label) => renderWorkbenchFilterChip(label, 'data-fabric-warehouse-action="clear-filters"', 'blue')),
    clearAttrs: 'data-fabric-warehouse-action="clear-filters"',
  })
}

function renderFilterArea(): string {
  return renderStickyFilterShell(`
    <div class="space-y-3">
      <div class="flex flex-wrap items-center gap-2">
        ${renderWorkbenchFilterChip(
          state.filters.lowRemainingOnly ? '仅看低余量：已开启' : '仅看低余量',
          'data-fabric-warehouse-action="toggle-low-remaining"',
          state.filters.lowRemainingOnly ? 'amber' : 'blue',
        )}
      </div>
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <label class="space-y-2 xl:col-span-2">
          <span class="text-sm font-medium text-foreground">关键词</span>
          <input
            type="text"
            value="${escapeHtml(state.filters.keyword)}"
            placeholder="支持面料 SKU / 原始裁片单号 / 生产单号 / 卷号"
            class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            data-fabric-warehouse-field="keyword"
          />
        </label>
        ${renderFilterSelect('面料类别', 'materialCategory', state.filters.materialCategory, [
          { value: 'ALL', label: '全部' },
          { value: 'PRINT', label: '面料' },
          { value: 'DYE', label: '面料' },
          { value: 'SOLID', label: '面料' },
          { value: 'LINING', label: '里布' },
        ])}
        ${renderFilterSelect('状态筛选', 'status', state.filters.status, [
          { value: 'ALL', label: '全部' },
          { value: 'READY', label: '库存正常' },
          { value: 'PARTIAL_USED', label: '部分已用' },
          { value: 'NEED_RECHECK', label: '待核对' },
        ])}
        ${renderFilterSelect('风险筛选', 'risk', state.filters.risk, [
          { value: 'ALL', label: '全部' },
          { value: 'LOW_REMAINING', label: '低余量' },
          { value: 'STOCK_RECHECK', label: '待核对' },
          { value: 'WAITING_RECEIVE', label: '待领用' },
        ])}
      </div>
    </div>
  `)
}

function renderTable(items: FabricWarehouseStockItem[]): string {
  if (!items.length) {
    return '<section class="rounded-lg border border-dashed bg-card px-6 py-12 text-center text-sm text-muted-foreground">当前筛选条件下暂无裁床仓库存记录。</section>'
  }

  return renderStickyTableScroller(`
    <table class="min-w-full text-sm">
      <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
        <tr>
          <th class="px-4 py-3 text-left">面料 SKU</th>
          <th class="px-4 py-3 text-left">面料类别</th>
          <th class="px-4 py-3 text-right">卷数</th>
          <th class="px-4 py-3 text-right">配置长度</th>
          <th class="px-4 py-3 text-right">剩余长度</th>
          <th class="px-4 py-3 text-right">关联原始裁片单数</th>
          <th class="px-4 py-3 text-left">风险提示</th>
          <th class="px-4 py-3 text-left">操作</th>
        </tr>
      </thead>
      <tbody>
        ${items
          .map((item) => {
            const isFocused = state.focusedStockIds.includes(item.stockItemId)
            const materialMeta = fabricWarehouseMaterialMeta[item.materialCategory as keyof typeof fabricWarehouseMaterialMeta]
            return `
              <tr class="border-b align-top ${state.activeStockId === item.stockItemId ? 'bg-blue-50/60' : 'bg-card'}">
                <td class="px-4 py-3">
                  <button type="button" class="font-medium text-blue-700 hover:underline" data-fabric-warehouse-action="open-detail" data-stock-id="${escapeHtml(item.stockItemId)}">${escapeHtml(item.materialSku)}</button>
                  <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.materialName)}</div>
                </td>
                <td class="px-4 py-3">
                  <div class="flex flex-wrap gap-1.5">
                    ${renderTag(item.materialAttr, materialMeta?.className || 'bg-slate-100 text-slate-700')}
                    ${renderTag(fabricWarehouseStatusMeta[item.status].label, fabricWarehouseStatusMeta[item.status].className)}
                    ${isFocused ? renderTag('重点关注', 'bg-amber-100 text-amber-700 border border-amber-200') : ''}
                  </div>
                  <div class="mt-1 text-xs text-muted-foreground">幅宽：${escapeHtml(item.widthSummary || '待补')}</div>
                </td>
                <td class="px-4 py-3 text-right font-medium tabular-nums">${item.rollCount}</td>
                <td class="px-4 py-3 text-right tabular-nums">${escapeHtml(formatFabricWarehouseLength(item.configuredLengthTotal))}</td>
                <td class="px-4 py-3 text-right tabular-nums">${escapeHtml(formatFabricWarehouseLength(item.remainingLengthTotal))}</td>
                <td class="px-4 py-3 text-right tabular-nums">${item.sourceOriginalCutOrderNos.length}</td>
                <td class="px-4 py-3">
                  <div class="flex flex-wrap gap-1.5">${item.riskTags.length ? item.riskTags.map((tag) => renderTag(tag.label, tag.className)).join('') : '<span class="text-xs text-muted-foreground">无明显风险</span>'}</div>
                </td>
                <td class="px-4 py-3">
                  <div class="flex flex-wrap gap-2">
                    <button type="button" class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-fabric-warehouse-action="open-detail" data-stock-id="${escapeHtml(item.stockItemId)}">查看详情</button>
                    <button type="button" class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-fabric-warehouse-action="go-material-prep" data-stock-id="${escapeHtml(item.stockItemId)}">查看配料</button>
                    <button type="button" class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-fabric-warehouse-action="go-original-orders" data-stock-id="${escapeHtml(item.stockItemId)}">查看原始裁片单</button>
                  </div>
                </td>
              </tr>
            `
          })
          .join('')}
      </tbody>
    </table>
  `)
}

function renderDetailDrawer(): string {
  const item = getActiveItem()
  if (!item) return ''

  return uiDetailDrawer(
    {
      title: `裁床仓详情 · ${item.materialSku}`,
      subtitle: '',
      closeAction: { prefix: 'fabric-warehouse', action: 'close-detail' },
      width: 'lg',
    },
    `
      <div class="space-y-6 text-sm">
        <section class="grid gap-3 md:grid-cols-2">
          <div class="rounded-lg border bg-muted/20 p-3">
            <div class="text-xs text-muted-foreground">面料名称</div>
            <div class="mt-1 font-medium text-foreground">${escapeHtml(item.materialName)}</div>
          </div>
          <div class="rounded-lg border bg-muted/20 p-3">
            <div class="text-xs text-muted-foreground">最近更新时间</div>
            <div class="mt-1 font-medium text-foreground">${escapeHtml(formatDateTime(item.lastUpdatedAt))}</div>
          </div>
          <div class="rounded-lg border bg-muted/20 p-3">
            <div class="text-xs text-muted-foreground">配置长度</div>
            <div class="mt-1 font-medium text-foreground">${escapeHtml(formatFabricWarehouseLength(item.configuredLengthTotal))}</div>
          </div>
          <div class="rounded-lg border bg-muted/20 p-3">
            <div class="text-xs text-muted-foreground">剩余长度</div>
            <div class="mt-1 font-medium text-foreground">${escapeHtml(formatFabricWarehouseLength(item.remainingLengthTotal))}</div>
          </div>
        </section>

        <section class="rounded-lg border bg-card">
          <div class="border-b px-4 py-3">
            <h3 class="text-sm font-semibold text-foreground">卷级明细</h3>
            <p class="mt-1 text-xs text-muted-foreground">保留卷号、长度、幅宽与当前是否仍在裁床仓。</p>
          </div>
          <div class="overflow-auto">
            <table class="min-w-full text-sm">
              <thead class="bg-muted/60 text-xs text-muted-foreground">
                <tr>
                  <th class="px-3 py-2 text-left">卷号</th>
                  <th class="px-3 py-2 text-right">幅宽</th>
                  <th class="px-3 py-2 text-right">标注米数</th>
                  <th class="px-3 py-2 text-right">剩余长度</th>
                  <th class="px-3 py-2 text-left">来源原始裁片单</th>
                  <th class="px-3 py-2 text-left">状态</th>
                </tr>
              </thead>
              <tbody>
                ${item.rolls
                  .map(
                    (roll) => `
                      <tr class="border-t align-top">
                        <td class="px-3 py-2 font-medium text-foreground">${escapeHtml(roll.rollNo)}</td>
                        <td class="px-3 py-2 text-right tabular-nums">${roll.width} cm</td>
                        <td class="px-3 py-2 text-right tabular-nums">${escapeHtml(formatFabricWarehouseLength(roll.labeledLength))}</td>
                        <td class="px-3 py-2 text-right tabular-nums">${escapeHtml(formatFabricWarehouseLength(roll.remainingLength))}</td>
                        <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(`${roll.sourceOriginalCutOrderNo} / ${roll.sourceProductionOrderNo}`)}</td>
                        <td class="px-3 py-2">${renderTag(roll.status === 'IN_STOCK' ? '在仓' : '已用', roll.status === 'IN_STOCK' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-700 border border-slate-200')}</td>
                      </tr>
                    `,
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </section>

        <section class="grid gap-3 md:grid-cols-2">
          <div class="rounded-lg border bg-card p-4">
            <h3 class="text-sm font-semibold text-foreground">关联原始裁片单</h3>
            <div class="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
              ${item.sourceOriginalCutOrderNos.map((orderNo) => `<span class="rounded-full border px-2 py-1">${escapeHtml(orderNo)}</span>`).join('')}
            </div>
          </div>
          <div class="rounded-lg border bg-card p-4">
            <h3 class="text-sm font-semibold text-foreground">关联生产单</h3>
            <div class="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
              ${item.sourceProductionOrderNos.map((orderNo) => `<span class="rounded-full border px-2 py-1">${escapeHtml(orderNo)}</span>`).join('')}
            </div>
          </div>
        </section>

        <section class="rounded-lg border border-dashed bg-amber-50/60 p-4">
          <div class="flex items-center justify-between gap-3">
            <div>
              <h3 class="text-sm font-semibold text-foreground">关注与后续链路</h3>
              <p class="mt-1 text-xs text-muted-foreground">当前只承接裁床仓库存视角，不在此页做真实出入库确认。</p>
            </div>
            <button type="button" class="rounded-md border px-3 py-2 text-xs hover:bg-white" data-fabric-warehouse-action="toggle-focus" data-stock-id="${escapeHtml(item.stockItemId)}">${state.focusedStockIds.includes(item.stockItemId) ? '取消重点关注' : '标记低余量关注'}</button>
          </div>
        </section>
      </div>
    `,
    `
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-fabric-warehouse-action="go-material-prep" data-stock-id="${escapeHtml(item.stockItemId)}">跳去仓库配料领料</button>
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-fabric-warehouse-action="go-original-orders" data-stock-id="${escapeHtml(item.stockItemId)}">查看原始裁片单</button>
    `,
  )
}

function renderPage(): string {
  syncPrefilterFromQuery()
  const pathname = appStore.getState().pathname
  const meta = getCanonicalCuttingMeta(pathname, 'fabric-warehouse')
  const items = getFilteredItems()

  return `
    <div class="space-y-3 p-4">
      ${renderCuttingPageHeader(meta, {
        showCompatibilityBadge: isCuttingAliasPath(pathname),
        actionsHtml: renderHeaderActions(),
      })}
      ${renderStatsCards()}
      ${renderPrefilterBar()}
      ${renderFilterArea()}
      ${renderFilterStateBar()}
      ${renderTable(items)}
      ${renderDetailDrawer()}
    </div>
  `
}

function navigateByPayload(stockId: string | undefined, target: keyof FabricWarehouseStockItem['navigationPayload']): boolean {
  if (!stockId) return false
  const item = getViewModel().itemsById[stockId]
  if (!item) return false
  const context = normalizeLegacyCuttingPayload(item.navigationPayload[target], 'fabric-warehouse', {
    materialSku: item.materialSku,
    productionOrderId: item.productionOrderId || undefined,
    productionOrderNo: item.productionOrderNo || undefined,
    originalCutOrderId: item.originalCutOrderId || undefined,
    originalCutOrderNo: item.originalCutOrderNo || undefined,
    mergeBatchId: item.mergeBatchId || undefined,
    mergeBatchNo: item.mergeBatchNo || undefined,
    warehouseRecordId: item.stockItemId,
    autoOpenDetail: true,
  })
  appStore.navigate(buildCuttingRouteWithContext(target as CuttingNavigationTarget, context))
  return true
}

export function renderCraftCuttingFabricWarehousePage(): string {
  return renderPage()
}

export function handleCraftCuttingFabricWarehouseEvent(target: Element): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-fabric-warehouse-field]')
  if (fieldNode) {
    const field = fieldNode.dataset.fabricWarehouseField as FilterField | undefined
    if (!field) return false
    const input = fieldNode as HTMLInputElement | HTMLSelectElement
    const filterKey = FIELD_TO_FILTER_KEY[field]
    state.filters = {
      ...state.filters,
      [filterKey]: input.value,
    }
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-fabric-warehouse-action]')
  const action = actionNode?.dataset.fabricWarehouseAction
  if (!action) return false

  if (action === 'toggle-low-remaining') {
    state.filters.lowRemainingOnly = !state.filters.lowRemainingOnly
    return true
  }

  if (action === 'clear-filters') {
    state.filters = { ...initialFilters }
    return true
  }

  if (action === 'clear-prefilter') {
    state.prefilter = null
    state.drillContext = null
    state.activeStockId = null
    state.querySignature = getCanonicalCuttingPath('fabric-warehouse')
    appStore.navigate(getCanonicalCuttingPath('fabric-warehouse'))
    return true
  }

  if (action === 'open-detail') {
    state.activeStockId = actionNode.dataset.stockId ?? null
    return true
  }

  if (action === 'close-detail') {
    state.activeStockId = null
    return true
  }

  if (action === 'toggle-focus') {
    const stockId = actionNode.dataset.stockId
    if (!stockId) return false
    state.focusedStockIds = state.focusedStockIds.includes(stockId)
      ? state.focusedStockIds.filter((item) => item !== stockId)
      : [...state.focusedStockIds, stockId]
    return true
  }

  if (action === 'go-material-prep') return navigateByPayload(actionNode.dataset.stockId || state.activeStockId || undefined, 'materialPrep')
  if (action === 'go-original-orders') return navigateByPayload(actionNode.dataset.stockId || state.activeStockId || undefined, 'originalOrders')
  if (action === 'go-summary') return navigateByPayload(actionNode.dataset.stockId || state.activeStockId || undefined, 'summary')

  if (action === 'go-material-prep-index') {
    appStore.navigate(getCanonicalCuttingPath('material-prep'))
    return true
  }

  if (action === 'go-original-orders-index') {
    appStore.navigate(getCanonicalCuttingPath('original-orders'))
    return true
  }

  if (action === 'go-summary-index') {
    appStore.navigate(getCanonicalCuttingPath('summary'))
    return true
  }

  if (action === 'return-summary') {
    const context = buildReturnToSummaryContext(state.drillContext)
    if (!context) return false
    appStore.navigate(buildCuttingRouteWithContext('summary', context))
    return true
  }

  return false
}

export function isCraftCuttingFabricWarehouseDialogOpen(): boolean {
  return state.activeStockId !== null
}
