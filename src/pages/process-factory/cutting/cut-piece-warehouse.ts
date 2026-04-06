import { renderDetailDrawer as uiDetailDrawer } from '../../../components/ui'
import type { CutPieceZoneCode } from '../../../data/fcs/cutting/warehouse-runtime'
import { normalizeCutPieceWarehouseWritebackInput } from '../../../data/fcs/cutting/warehouse-writeback-inputs'
import { submitCutPieceWarehouseWriteback } from '../../../domain/cutting-warehouse-writeback/bridge'
import { appStore } from '../../../state/store'
import { escapeHtml, formatDateTime } from '../../../utils'
import {
  buildCutPieceWarehouseNavigationPayload,
  cutPieceHandoverStatusMeta,
  cutPieceWarehouseStatusMeta,
  cutPieceWarehouseZoneMeta,
  filterCutPieceWarehouseItems,
  findCutPieceWarehouseByPrefilter,
  formatCutPieceQuantity,
  type CutPieceWarehouseFilters,
  type CutPieceWarehouseItem,
  type CutPieceWarehousePrefilter,
  type CutPieceWarehouseRiskKey,
} from './cut-piece-warehouse-model'
import { buildCutPieceWarehouseProjection } from './cut-piece-warehouse-projection'
import {
  renderCompactKpiCard,
  renderStickyFilterShell,
  renderStickyTableScroller,
  renderWorkbenchFilterChip,
  renderWorkbenchStateBar,
} from './layout.helpers'
import { getCanonicalCuttingMeta, getCanonicalCuttingPath, isCuttingAliasPath, renderCuttingPageHeader } from './meta'
import {
  getWarehouseSearchParams,
} from './warehouse-shared'
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

type FilterField = 'keyword' | 'zoneCode' | 'cuttingGroup' | 'warehouseStatus' | 'risk'
type DetailField = 'zoneCode' | 'locationCode' | 'note'
type WarehouseStatusFilter = 'ALL' | 'PENDING_INBOUND' | 'INBOUNDED' | 'WAITING_HANDOVER' | 'HANDED_OVER'

interface CutPieceWarehousePageState {
  filters: CutPieceWarehouseFilters
  activeItemId: string | null
  prefilter: CutPieceWarehousePrefilter | null
  drillContext: CuttingDrillContext | null
  querySignature: string
  detailDraft: {
    zoneCode: CutPieceZoneCode
    locationCode: string
    note: string
  }
}

const initialFilters: CutPieceWarehouseFilters = {
  keyword: '',
  zoneCode: 'ALL',
  cuttingGroup: '',
  warehouseStatus: 'ALL',
  handoffOnly: false,
  risk: 'ALL',
}

const FIELD_TO_FILTER_KEY: Record<FilterField, keyof CutPieceWarehouseFilters> = {
  keyword: 'keyword',
  zoneCode: 'zoneCode',
  cuttingGroup: 'cuttingGroup',
  warehouseStatus: 'warehouseStatus',
  risk: 'risk',
}

const state: CutPieceWarehousePageState = {
  filters: { ...initialFilters },
  activeItemId: null,
  prefilter: null,
  drillContext: null,
  querySignature: '',
  detailDraft: {
    zoneCode: 'A',
    locationCode: '',
    note: '',
  },
}

function getProjection() {
  return buildCutPieceWarehouseProjection()
}

function getViewModel() {
  return getProjection().viewModel
}

function getFilteredItems() {
  return filterCutPieceWarehouseItems(getViewModel().items, state.filters, state.prefilter)
}

function getPrefilterFromQuery(): CutPieceWarehousePrefilter | null {
  const params = getWarehouseSearchParams()
  const drillContext = readCuttingDrillContextFromLocation(params)
  const prefilter: CutPieceWarehousePrefilter = {
    originalCutOrderId: drillContext?.originalCutOrderId || params.get('originalCutOrderId') || undefined,
    originalCutOrderNo: drillContext?.originalCutOrderNo || params.get('originalCutOrderNo') || undefined,
    productionOrderId: drillContext?.productionOrderId || params.get('productionOrderId') || undefined,
    productionOrderNo: drillContext?.productionOrderNo || params.get('productionOrderNo') || undefined,
    mergeBatchId: drillContext?.mergeBatchId || params.get('mergeBatchId') || undefined,
    mergeBatchNo: drillContext?.mergeBatchNo || params.get('mergeBatchNo') || undefined,
    materialSku: drillContext?.materialSku || params.get('materialSku') || undefined,
    spreadingSessionId: drillContext?.spreadingSessionId || params.get('spreadingSessionId') || params.get('sessionId') || undefined,
    sourceWritebackId: params.get('sourceWritebackId') || params.get('holder') || undefined,
    cuttingGroup: drillContext?.cuttingGroup || params.get('cuttingGroup') || undefined,
    zoneCode: (params.get('zoneCode') as CutPieceZoneCode | null) || undefined,
    warehouseStatus: (drillContext?.warehouseStatus as WarehouseStatusFilter | undefined) || (params.get('warehouseStatus') as WarehouseStatusFilter | null) || undefined,
  }

  return Object.values(prefilter).some(Boolean) ? prefilter : null
}

function syncPrefilterFromQuery(): void {
  const pathname = appStore.getState().pathname
  if (pathname === state.querySignature) return
  state.querySignature = pathname
  state.drillContext = readCuttingDrillContextFromLocation(getWarehouseSearchParams())
  state.prefilter = getPrefilterFromQuery()
  const matched = findCutPieceWarehouseByPrefilter(getViewModel().items, state.prefilter)
  state.activeItemId = matched?.warehouseItemId ?? null
  syncDetailDraft()
}

function getActiveItem(): CutPieceWarehouseItem | null {
  if (!state.activeItemId) return null
  return getViewModel().itemsById[state.activeItemId] ?? null
}

function syncDetailDraft(): void {
  const item = getActiveItem()
  if (!item) return
  state.detailDraft = {
    zoneCode: item.zoneCode,
    locationCode: item.locationCode,
    note: item.note,
  }
}

function renderTag(label: string, className: string): string {
  return `<span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}">${escapeHtml(label)}</span>`
}

function renderHeaderActions(): string {
  const returnToSummary = hasSummaryReturnContext(state.drillContext)
    ? `<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cut-piece-warehouse-action="return-summary">返回裁剪总表</button>`
    : ''
  return `
    <div class="flex flex-wrap items-center gap-2">
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cut-piece-warehouse-action="go-original-orders-index">查看原始裁片单</button>
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cut-piece-warehouse-action="go-transfer-bags-index">查看周转口袋流转</button>
      ${returnToSummary}
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cut-piece-warehouse-action="go-summary-index">查看裁剪总表</button>
    </div>
  `
}

function renderFilterSelect(
  label: string,
  field: FilterField | DetailField,
  value: string,
  options: Array<{ value: string; label: string }>,
  attrName: 'data-cut-piece-warehouse-field' | 'data-cut-piece-warehouse-detail-field',
): string {
  return `
    <label class="space-y-2">
      <span class="text-sm font-medium text-foreground">${escapeHtml(label)}</span>
      <select
        class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        ${attrName}="${field}"
      >
        ${options
          .map((option) => `<option value="${escapeHtml(option.value)}" ${option.value === value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`)
          .join('')}
      </select>
    </label>
  `
}

function renderStatsCards(): string {
  const summary = getViewModel().summary
  return `
    <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
      ${renderCompactKpiCard('裁片仓项目数', summary.totalItemCount, '原始裁片单仓务项目', 'text-slate-900')}
      ${renderCompactKpiCard('裁片总片数（片）', formatCutPieceQuantity(summary.totalQuantity), '当前筛选范围汇总', 'text-blue-600')}
      ${renderCompactKpiCard('待入仓数', summary.waitingInWarehouseCount, '仍待仓务确认', 'text-slate-700')}
      ${renderCompactKpiCard('已入仓数', summary.inWarehouseCount, '已进入裁片仓', 'text-emerald-600')}
      ${renderCompactKpiCard('待交接数', summary.waitingHandoffCount, '待发后道或进入周转口袋流转', 'text-amber-600')}
      ${renderCompactKpiCard('区域数', summary.zoneCount, 'A / B / C / 未分配', 'text-violet-600')}
    </section>
  `
}

function renderZoneSummary(): string {
  const zoneSummary = getViewModel().zoneSummary
  return `
    <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      ${zoneSummary
        .map(
          (zone) => `
            <button
              type="button"
              class="rounded-lg border bg-card p-3 text-left transition hover:border-blue-300 hover:bg-blue-50/40 ${state.filters.zoneCode === zone.zoneCode ? 'border-blue-400 bg-blue-50' : ''}"
              data-cut-piece-warehouse-action="set-zone-filter"
              data-zone-code="${escapeHtml(zone.zoneCode)}"
            >
              <div class="flex items-center justify-between gap-3">
                <div>
                  <div class="flex items-center gap-2">
                    ${renderTag(cutPieceWarehouseZoneMeta[zone.zoneCode].label, cutPieceWarehouseZoneMeta[zone.zoneCode].className)}
                    <span class="text-xs text-muted-foreground">${escapeHtml(zone.occupancyStatus)}</span>
                  </div>
                  <p class="mt-2 text-lg font-semibold text-foreground">${zone.itemCount}</p>
                  <p class="text-xs text-muted-foreground">${escapeHtml(formatCutPieceQuantity(zone.quantityTotal))}</p>
                </div>
                <div class="text-right text-xs text-muted-foreground">
                  <div>裁床组</div>
                  <div class="mt-1 text-foreground">${escapeHtml(zone.cuttingGroupSummary)}</div>
                </div>
              </div>
            </button>
          `,
        )
        .join('')}
    </section>
  `
}

function renderPrefilterBar(): string {
  if (!state.prefilter) return ''
  const labels = Array.from(
    new Set([
      ...buildCuttingDrillChipLabels(state.drillContext),
      state.prefilter.cuttingGroup ? `裁床组：${state.prefilter.cuttingGroup}` : '',
      state.prefilter.zoneCode ? `区域：${cutPieceWarehouseZoneMeta[state.prefilter.zoneCode].label}` : '',
      state.prefilter.warehouseStatus ? `仓状态：${cutPieceWarehouseStatusMeta[state.prefilter.warehouseStatus].label}` : '',
    ].filter(Boolean)),
  )

  return renderWorkbenchStateBar({
    summary: buildCuttingDrillSummary(state.drillContext) || '当前按外部上下文预筛裁片仓记录',
    chips: labels.map((label) => renderWorkbenchFilterChip(label, 'data-cut-piece-warehouse-action="clear-prefilter"', 'amber')),
    clearAttrs: 'data-cut-piece-warehouse-action="clear-prefilter"',
  })
}

function renderFilterStateBar(): string {
  const labels: string[] = []
  if (state.filters.keyword.trim()) labels.push(`关键词：${state.filters.keyword.trim()}`)
  if (state.filters.zoneCode !== 'ALL') labels.push(`区域：${cutPieceWarehouseZoneMeta[state.filters.zoneCode].label}`)
  if (state.filters.cuttingGroup.trim()) labels.push(`裁床组：${state.filters.cuttingGroup.trim()}`)
  if (state.filters.warehouseStatus !== 'ALL') labels.push(`仓状态：${cutPieceWarehouseStatusMeta[state.filters.warehouseStatus].label}`)
  if (state.filters.handoffOnly) labels.push('仅看待交接：已开启')
  if (state.filters.risk !== 'ALL') {
    const riskLabelMap: Record<CutPieceWarehouseRiskKey, string> = {
      UNASSIGNED_ZONE: '未分区',
      WAITING_INBOUND: '待入仓',
      WAITING_HANDOFF: '待交接',
    }
    labels.push(`风险：${riskLabelMap[state.filters.risk]}`)
  }
  if (!labels.length) return ''

  return renderWorkbenchStateBar({
    summary: '当前裁片仓视图条件',
    chips: labels.map((label) => renderWorkbenchFilterChip(label, 'data-cut-piece-warehouse-action="clear-filters"', 'blue')),
    clearAttrs: 'data-cut-piece-warehouse-action="clear-filters"',
  })
}

function renderFilterArea(): string {
  return renderStickyFilterShell(`
    <div class="space-y-3">
      <div class="flex flex-wrap items-center gap-2">
        ${renderWorkbenchFilterChip(
          state.filters.handoffOnly ? '仅看待交接：已开启' : '仅看待交接',
          'data-cut-piece-warehouse-action="toggle-handoff-only"',
          state.filters.handoffOnly ? 'amber' : 'blue',
        )}
      </div>
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <label class="space-y-2 xl:col-span-2">
          <span class="text-sm font-medium text-foreground">关键词</span>
          <input
            type="text"
            value="${escapeHtml(state.filters.keyword)}"
            placeholder="支持原始裁片单号 / 生产单号 / 合并裁剪批次号 / 款号"
            class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            data-cut-piece-warehouse-field="keyword"
          />
        </label>
        ${renderFilterSelect('区域筛选', 'zoneCode', state.filters.zoneCode, [
          { value: 'ALL', label: '全部' },
          { value: 'A', label: 'A 区' },
          { value: 'B', label: 'B 区' },
          { value: 'C', label: 'C 区' },
          { value: 'UNASSIGNED', label: '未分配' },
        ], 'data-cut-piece-warehouse-field')}
        <label class="space-y-2">
          <span class="text-sm font-medium text-foreground">裁床组</span>
          <input
            type="text"
            value="${escapeHtml(state.filters.cuttingGroup)}"
            placeholder="例如 G-前后片-03"
            class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            data-cut-piece-warehouse-field="cuttingGroup"
          />
        </label>
        ${renderFilterSelect('仓状态', 'warehouseStatus', state.filters.warehouseStatus, [
          { value: 'ALL', label: '全部' },
          { value: 'PENDING_INBOUND', label: '待入仓' },
          { value: 'INBOUNDED', label: '已入仓' },
          { value: 'WAITING_HANDOVER', label: '待交接' },
          { value: 'HANDED_OVER', label: '已交接' },
        ], 'data-cut-piece-warehouse-field')}
        ${renderFilterSelect('风险筛选', 'risk', state.filters.risk, [
          { value: 'ALL', label: '全部' },
          { value: 'UNASSIGNED_ZONE', label: '未分区' },
          { value: 'WAITING_INBOUND', label: '待入仓' },
          { value: 'WAITING_HANDOFF', label: '待交接' },
        ], 'data-cut-piece-warehouse-field')}
      </div>
    </div>
  `)
}

function renderTable(items: CutPieceWarehouseItem[]): string {
  if (!items.length) {
    return '<section class="rounded-lg border border-dashed bg-card px-6 py-12 text-center text-sm text-muted-foreground">当前筛选条件下暂无裁片仓记录。</section>'
  }

  return renderStickyTableScroller(`
    <table class="min-w-full text-sm">
      <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
        <tr>
          <th class="px-4 py-3 text-left">原始裁片单号</th>
          <th class="px-4 py-3 text-left">来源生产单号</th>
          <th class="px-4 py-3 text-left">合并裁剪批次 / 裁床组</th>
          <th class="px-4 py-3 text-left">区域 / 库位</th>
          <th class="px-4 py-3 text-right">裁片片数（片）</th>
          <th class="px-4 py-3 text-left">仓状态</th>
          <th class="px-4 py-3 text-left">交接状态</th>
          <th class="px-4 py-3 text-left">操作</th>
        </tr>
      </thead>
      <tbody>
        ${items
          .map(
            (item) => `
              <tr class="border-b align-top ${state.activeItemId === item.warehouseItemId ? 'bg-blue-50/60' : 'bg-card'}">
                <td class="px-4 py-3">
                  <button type="button" class="font-medium text-blue-700 hover:underline" data-cut-piece-warehouse-action="open-detail" data-item-id="${escapeHtml(item.warehouseItemId)}">${escapeHtml(item.originalCutOrderNo)}</button>
                  <div class="mt-1 text-xs text-foreground">${escapeHtml(item.materialSku || '待补面料')}</div>
                  <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.styleCode || item.spuCode || '待补款号')}</div>
                </td>
                <td class="px-4 py-3">${escapeHtml(item.productionOrderNo)}</td>
                <td class="px-4 py-3">
                  <div class="text-foreground">${escapeHtml(item.mergeBatchNo || '未关联合并裁剪批次')}</div>
                  <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.cuttingGroup)}</div>
                </td>
                <td class="px-4 py-3">
                  <div class="flex flex-wrap gap-1.5">
                    ${renderTag(cutPieceWarehouseZoneMeta[item.zoneCode].label, cutPieceWarehouseZoneMeta[item.zoneCode].className)}
                  </div>
                  <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.locationCode || '待补库位')}</div>
                </td>
                <td class="px-4 py-3 text-right tabular-nums">${escapeHtml(formatCutPieceQuantity(item.quantity))}</td>
                <td class="px-4 py-3">
                  ${renderTag(item.warehouseStatus.label, item.warehouseStatus.className)}
                </td>
                <td class="px-4 py-3">
                  <div class="flex flex-wrap gap-1.5">
                    ${renderTag(item.handoffStatus.label, item.handoffStatus.className)}
                    ${item.riskTags.map((tag) => renderTag(tag.label, tag.className)).join('')}
                  </div>
                </td>
                <td class="px-4 py-3">
                  <div class="flex flex-wrap gap-2">
                    <button type="button" class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-cut-piece-warehouse-action="open-detail" data-item-id="${escapeHtml(item.warehouseItemId)}">查看详情</button>
                    <button type="button" class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-cut-piece-warehouse-action="go-transfer-bags" data-item-id="${escapeHtml(item.warehouseItemId)}">去周转口袋流转</button>
                  </div>
                </td>
              </tr>
            `,
          )
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
      title: `裁片仓详情 · ${item.originalCutOrderNo}`,
      subtitle: '',
      closeAction: { prefix: 'cut-piece-warehouse', action: 'close-detail' },
      width: 'lg',
    },
    `
      <div class="space-y-6 text-sm">
        <section class="grid gap-3 md:grid-cols-2">
          <div class="rounded-lg border bg-muted/20 p-3">
            <div class="text-xs text-muted-foreground">面料 SKU</div>
            <div class="mt-1 font-medium text-foreground">${escapeHtml(item.materialSku || '待补面料')}</div>
          </div>
          <div class="rounded-lg border bg-muted/20 p-3">
            <div class="text-xs text-muted-foreground">来源生产单号</div>
            <div class="mt-1 font-medium text-foreground">${escapeHtml(item.productionOrderNo)}</div>
          </div>
          <div class="rounded-lg border bg-muted/20 p-3">
            <div class="text-xs text-muted-foreground">关联合并裁剪批次</div>
            <div class="mt-1 font-medium text-foreground">${escapeHtml(item.mergeBatchNo || '未关联合并裁剪批次')}</div>
          </div>
          <div class="rounded-lg border bg-muted/20 p-3">
            <div class="text-xs text-muted-foreground">裁床组</div>
            <div class="mt-1 font-medium text-foreground">${escapeHtml(item.cuttingGroup)}</div>
          </div>
          <div class="rounded-lg border bg-muted/20 p-3">
            <div class="text-xs text-muted-foreground">当前裁片片数（片）</div>
            <div class="mt-1 font-medium text-foreground">${escapeHtml(formatCutPieceQuantity(item.quantity))}</div>
          </div>
        </section>

        <section class="rounded-lg border bg-card p-4">
          <h3 class="text-sm font-semibold text-foreground">入仓记录</h3>
          <dl class="mt-3 grid gap-3 md:grid-cols-2">
            <div>
              <dt class="text-xs text-muted-foreground">入仓时间</dt>
              <dd class="mt-1 font-medium text-foreground">${escapeHtml(formatDateTime(item.inWarehouseAt))}</dd>
            </div>
            <div>
              <dt class="text-xs text-muted-foreground">入仓人</dt>
              <dd class="mt-1 font-medium text-foreground">${escapeHtml(item.inWarehouseBy || '待补录')}</dd>
            </div>
            <div>
              <dt class="text-xs text-muted-foreground">仓状态</dt>
              <dd class="mt-1">${renderTag(item.warehouseStatus.label, item.warehouseStatus.className)}</dd>
            </div>
            <div>
              <dt class="text-xs text-muted-foreground">待交接目标</dt>
              <dd class="mt-1 font-medium text-foreground">${escapeHtml(item.handoffTarget || '待确认')}</dd>
            </div>
          </dl>
        </section>

        <section class="rounded-lg border bg-card p-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h3 class="text-sm font-semibold text-foreground">铺布 / 装袋追溯</h3>
              <p class="mt-1 text-xs text-muted-foreground">先装袋，再入裁片仓；当前主锚点以铺布 session 与周转口袋使用周期为准。</p>
            </div>
            ${renderTag(item.bagFirstSatisfied ? '先装袋后入仓已满足' : '先装袋后入仓待补', item.bagFirstSatisfied ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-rose-100 text-rose-700 border border-rose-200')}
          </div>
          ${
            item.bagFirstSatisfied
              ? ''
              : '<div class="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">当前未找到正式周转口袋装袋绑定，当前入仓链路仍为待补状态。</div>'
          }
          <dl class="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <div class="rounded-lg border bg-muted/10 p-3">
              <dt class="text-xs text-muted-foreground">来源铺布</dt>
              <dd class="mt-1 font-medium text-foreground">${escapeHtml(item.spreadingSessionNo || item.spreadingSessionId || '待补')}</dd>
            </div>
            <div class="rounded-lg border bg-muted/10 p-3">
              <dt class="text-xs text-muted-foreground">来源唛架</dt>
              <dd class="mt-1 font-medium text-foreground">${escapeHtml(item.sourceMarkerNo || '待补')}</dd>
            </div>
            <div class="rounded-lg border bg-muted/10 p-3">
              <dt class="text-xs text-muted-foreground">来源原始裁片单</dt>
              <dd class="mt-1 font-medium text-foreground">${escapeHtml(item.originalCutOrderNo || '待补')}</dd>
            </div>
            <div class="rounded-lg border bg-muted/10 p-3">
              <dt class="text-xs text-muted-foreground">来源合并裁剪批次</dt>
              <dd class="mt-1 font-medium text-foreground">${escapeHtml(item.mergeBatchNo || '未关联合并裁剪批次')}</dd>
            </div>
          </dl>
          <details class="mt-3 rounded-lg border bg-background/70 p-3" data-testid="cut-piece-warehouse-traceability-fold" data-default-open="collapsed">
            <summary class="cursor-pointer text-sm font-medium text-foreground">追溯信息</summary>
            <dl class="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <div class="rounded-lg border bg-muted/10 p-3">
                <dt class="text-xs text-muted-foreground">PDA回写流水</dt>
                <dd class="mt-1 font-medium text-foreground">${escapeHtml(item.sourceWritebackId || '当前尚无 PDA 回写流水')}</dd>
              </div>
              <div class="rounded-lg border bg-muted/10 p-3">
                <dt class="text-xs text-muted-foreground">周转口袋使用周期</dt>
                <dd class="mt-1 font-medium text-foreground">${escapeHtml(item.bagUsageNo || item.bagUsageId || '待补')}</dd>
              </div>
              <div class="rounded-lg border bg-muted/10 p-3">
                <dt class="text-xs text-muted-foreground">周转口袋码</dt>
                <dd class="mt-1 font-medium text-foreground">${escapeHtml(item.bagCode || '待补')}</dd>
              </div>
              <div class="rounded-lg border bg-muted/10 p-3 md:col-span-2 xl:col-span-3">
                <dt class="text-xs text-muted-foreground">先装袋后入仓规则</dt>
                <dd class="mt-1 font-medium ${item.bagFirstSatisfied ? 'text-emerald-700' : 'text-rose-700'}">${escapeHtml(item.bagFirstRuleLabel)}</dd>
              </div>
            </dl>
          </details>
        </section>

        <section class="rounded-lg border bg-card p-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h3 class="text-sm font-semibold text-foreground">区位信息</h3>
              <p class="mt-1 text-xs text-muted-foreground">当前预留 zoneCode 与 locationCode 两层，不在本步进入真实库位系统。</p>
            </div>
          </div>
          <div class="mt-4 grid gap-3 md:grid-cols-3">
            ${renderFilterSelect('区域', 'zoneCode', state.detailDraft.zoneCode, [
              { value: 'A', label: 'A 区' },
              { value: 'B', label: 'B 区' },
              { value: 'C', label: 'C 区' },
              { value: 'UNASSIGNED', label: '未分配' },
            ], 'data-cut-piece-warehouse-detail-field')}
            <label class="space-y-2 md:col-span-2">
              <span class="text-sm font-medium text-foreground">locationCode / 库位说明</span>
              <input
                type="text"
                value="${escapeHtml(state.detailDraft.locationCode)}"
                placeholder="例如 A 区 3 组 / B 区 2 组"
                class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                data-cut-piece-warehouse-detail-field="locationCode"
              />
            </label>
            <label class="space-y-2 md:col-span-3">
              <span class="text-sm font-medium text-foreground">备注</span>
              <textarea
                class="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                data-cut-piece-warehouse-detail-field="note"
              >${escapeHtml(state.detailDraft.note)}</textarea>
            </label>
          </div>
          <div class="mt-4 flex flex-wrap gap-2">
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cut-piece-warehouse-action="save-location" data-item-id="${escapeHtml(item.warehouseItemId)}">保存区位</button>
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cut-piece-warehouse-action="mark-inbound" data-item-id="${escapeHtml(item.warehouseItemId)}">标记入仓</button>
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cut-piece-warehouse-action="mark-waiting-handoff" data-item-id="${escapeHtml(item.warehouseItemId)}">标记待交接</button>
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cut-piece-warehouse-action="mark-handed-over" data-item-id="${escapeHtml(item.warehouseItemId)}">标记已交接</button>
          </div>
        </section>

        <section class="rounded-lg border border-dashed bg-blue-50/50 p-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h3 class="text-sm font-semibold text-foreground">周转口袋流转</h3>
              <p class="mt-1 text-xs text-muted-foreground">将当前裁片对象带入周转口袋流转页，可继续选择周转口袋、进入详情、执行装袋与后续流转操作。</p>
            </div>
          </div>
          <dl class="mt-4 grid gap-3 md:grid-cols-2">
            <div class="rounded-lg border bg-white/70 p-3">
              <dt class="text-xs text-muted-foreground">原始裁片单号</dt>
              <dd class="mt-1 font-medium text-foreground">${escapeHtml(item.originalCutOrderNo)}</dd>
            </div>
            <div class="rounded-lg border bg-white/70 p-3">
              <dt class="text-xs text-muted-foreground">生产单号</dt>
              <dd class="mt-1 font-medium text-foreground">${escapeHtml(item.productionOrderNo)}</dd>
            </div>
            <div class="rounded-lg border bg-white/70 p-3">
              <dt class="text-xs text-muted-foreground">合并裁剪批次号</dt>
              <dd class="mt-1 font-medium text-foreground">${escapeHtml(item.mergeBatchNo || '未关联合并裁剪批次')}</dd>
            </div>
            <div class="rounded-lg border bg-white/70 p-3">
              <dt class="text-xs text-muted-foreground">面料 SKU</dt>
              <dd class="mt-1 font-medium text-foreground">${escapeHtml(item.materialSku || '待补面料')}</dd>
            </div>
            <div class="rounded-lg border bg-white/70 p-3">
              <dt class="text-xs text-muted-foreground">裁床组</dt>
              <dd class="mt-1 font-medium text-foreground">${escapeHtml(item.cuttingGroup)}</dd>
            </div>
            <div class="rounded-lg border bg-white/70 p-3">
              <dt class="text-xs text-muted-foreground">仓状态</dt>
              <dd class="mt-1">${renderTag(item.warehouseStatus.label, item.warehouseStatus.className)}</dd>
            </div>
          </dl>
          <div class="mt-4 flex flex-wrap gap-2">
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-white" data-cut-piece-warehouse-action="go-transfer-bags" data-item-id="${escapeHtml(item.warehouseItemId)}">去周转口袋流转</button>
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-white" data-cut-piece-warehouse-action="go-original-orders" data-item-id="${escapeHtml(item.warehouseItemId)}">去来源原始裁片单</button>
          </div>
        </section>
      </div>
    `,
  )
}

function renderPage(): string {
  syncPrefilterFromQuery()
  const pathname = appStore.getState().pathname
  const meta = getCanonicalCuttingMeta(pathname, 'cut-piece-warehouse')
  const items = getFilteredItems()

  return `
    <div class="space-y-3 p-4">
      ${renderCuttingPageHeader(meta, {
        showCompatibilityBadge: isCuttingAliasPath(pathname),
        actionsHtml: renderHeaderActions(),
      })}
      ${renderStatsCards()}
      ${renderZoneSummary()}
      ${renderPrefilterBar()}
      ${renderFilterArea()}
      ${renderFilterStateBar()}
      ${renderTable(items)}
      ${renderDetailDrawer()}
    </div>
  `
}

function navigateByPayload(itemId: string | undefined, target: keyof ReturnType<typeof buildCutPieceWarehouseNavigationPayload>): boolean {
  if (!itemId) return false
  const item = getViewModel().itemsById[itemId]
  if (!item) return false
  const context = normalizeLegacyCuttingPayload(item.navigationPayload[target], 'cut-piece-warehouse', {
    productionOrderId: item.productionOrderId || undefined,
    productionOrderNo: item.productionOrderNo || undefined,
    originalCutOrderId: item.originalCutOrderId || undefined,
    originalCutOrderNo: item.originalCutOrderNo,
    mergeBatchId: item.mergeBatchId || undefined,
    mergeBatchNo: item.mergeBatchNo || undefined,
    materialSku: item.materialSku || undefined,
    cuttingGroup: item.cuttingGroup || undefined,
    warehouseStatus: item.warehouseStatus.key,
    styleCode: item.styleCode || undefined,
    warehouseRecordId: item.warehouseItemId,
    autoOpenDetail: target === 'transferBags',
  })
  appStore.navigate(buildCuttingRouteWithContext(target as CuttingNavigationTarget, context))
  return true
}

function submitWarehouseAction(
  itemId: string | undefined,
  actionType:
    | 'CUT_PIECE_WAREHOUSE_SAVE_LOCATION'
    | 'CUT_PIECE_WAREHOUSE_MARK_INBOUND'
    | 'CUT_PIECE_WAREHOUSE_MARK_WAITING_HANDOFF'
    | 'CUT_PIECE_WAREHOUSE_MARK_HANDED_OVER',
): boolean {
  if (!itemId) return false
  const item = getViewModel().itemsById[itemId]
  if (!item) return false

  const payload = normalizeCutPieceWarehouseWritebackInput({
    actionType,
    identity: {
      warehouseRecordId: item.warehouseItemId,
      originalCutOrderId: item.originalCutOrderId,
      originalCutOrderNo: item.originalCutOrderNo,
      productionOrderId: item.productionOrderId,
      productionOrderNo: item.productionOrderNo,
      mergeBatchId: item.mergeBatchId,
      mergeBatchNo: item.mergeBatchNo,
      materialSku: item.materialSku,
    },
    zoneCode: state.detailDraft.zoneCode,
    locationCode: state.detailDraft.locationCode.trim() || item.locationCode || '待补库位',
    handoverTarget: actionType === 'CUT_PIECE_WAREHOUSE_MARK_HANDED_OVER' ? '已交接至后道 / 周转口袋后续' : item.handoffTarget,
    note: state.detailDraft.note.trim() || item.note,
  })
  const result = submitCutPieceWarehouseWriteback(payload)
  if (!result.success) return false
  state.activeItemId = itemId
  syncDetailDraft()
  return true
}

export function renderCraftCuttingCutPieceWarehousePage(): string {
  return renderPage()
}

export function handleCraftCuttingCutPieceWarehouseEvent(target: Element): boolean {
  const filterNode = target.closest<HTMLElement>('[data-cut-piece-warehouse-field]')
  if (filterNode) {
    const field = filterNode.dataset.cutPieceWarehouseField as FilterField | undefined
    if (!field) return false
    const input = filterNode as HTMLInputElement | HTMLSelectElement
    const filterKey = FIELD_TO_FILTER_KEY[field]
    state.filters = {
      ...state.filters,
      [filterKey]: input.value,
    }
    return true
  }

  const detailFieldNode = target.closest<HTMLElement>('[data-cut-piece-warehouse-detail-field]')
  if (detailFieldNode) {
    const field = detailFieldNode.dataset.cutPieceWarehouseDetailField as DetailField | undefined
    if (!field) return false
    const input = detailFieldNode as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    state.detailDraft = {
      ...state.detailDraft,
      [field]: input.value,
    }
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-cut-piece-warehouse-action]')
  const action = actionNode?.dataset.cutPieceWarehouseAction
  if (!action) return false

  if (action === 'toggle-handoff-only') {
    state.filters.handoffOnly = !state.filters.handoffOnly
    return true
  }

  if (action === 'clear-filters') {
    state.filters = { ...initialFilters }
    return true
  }

  if (action === 'clear-prefilter') {
    state.prefilter = null
    state.drillContext = null
    state.activeItemId = null
    state.querySignature = getCanonicalCuttingPath('cut-piece-warehouse')
    appStore.navigate(getCanonicalCuttingPath('cut-piece-warehouse'))
    return true
  }

  if (action === 'set-zone-filter') {
    const zoneCode = actionNode.dataset.zoneCode as CutPieceZoneCode | undefined
    if (!zoneCode) return false
    state.filters.zoneCode = state.filters.zoneCode === zoneCode ? 'ALL' : zoneCode
    return true
  }

  if (action === 'open-detail') {
    state.activeItemId = actionNode.dataset.itemId ?? null
    syncDetailDraft()
    return true
  }

  if (action === 'close-detail') {
    state.activeItemId = null
    return true
  }

  if (action === 'save-location') {
    return submitWarehouseAction(actionNode.dataset.itemId || state.activeItemId || undefined, 'CUT_PIECE_WAREHOUSE_SAVE_LOCATION')
  }

  if (action === 'mark-inbound') {
    return submitWarehouseAction(actionNode.dataset.itemId || state.activeItemId || undefined, 'CUT_PIECE_WAREHOUSE_MARK_INBOUND')
  }

  if (action === 'mark-waiting-handoff') {
    return submitWarehouseAction(actionNode.dataset.itemId || state.activeItemId || undefined, 'CUT_PIECE_WAREHOUSE_MARK_WAITING_HANDOFF')
  }

  if (action === 'mark-handed-over') {
    return submitWarehouseAction(actionNode.dataset.itemId || state.activeItemId || undefined, 'CUT_PIECE_WAREHOUSE_MARK_HANDED_OVER')
  }

  if (action === 'go-original-orders') return navigateByPayload(actionNode.dataset.itemId || state.activeItemId || undefined, 'originalOrders')
  if (action === 'go-material-prep') return navigateByPayload(actionNode.dataset.itemId || state.activeItemId || undefined, 'materialPrep')
  if (action === 'go-summary') return navigateByPayload(actionNode.dataset.itemId || state.activeItemId || undefined, 'summary')
  if (action === 'go-transfer-bags') return navigateByPayload(actionNode.dataset.itemId || state.activeItemId || undefined, 'transferBags')

  if (action === 'go-original-orders-index') {
    appStore.navigate(getCanonicalCuttingPath('original-orders'))
    return true
  }

  if (action === 'go-transfer-bags-index') {
    appStore.navigate(getCanonicalCuttingPath('transfer-bags'))
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

export function isCraftCuttingCutPieceWarehouseDialogOpen(): boolean {
  return state.activeItemId !== null
}
