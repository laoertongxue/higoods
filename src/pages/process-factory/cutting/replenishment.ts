// 本文件继续承接 canonical 页面“补料管理”。
// 页面主对象是补料建议与审核收口，不应与铺布、仓交接或生产单总览混用。
import { renderDialog as uiDialog, renderDrawer as uiDrawer, renderFormDrawer as uiFormDrawer } from '../../../components/ui'
import {
  cloneReplenishmentSuggestionRecords,
  type ReplenishmentFilters,
  type ReplenishmentReviewStatus,
  type ReplenishmentSuggestionRecord,
} from '../../../data/fcs/cutting/replenishment'
import { appStore } from '../../../state/store'
import { escapeHtml, formatDateTime } from '../../../utils'
import { getCanonicalCuttingMeta, getCanonicalCuttingPath, isCuttingAliasPath, renderCuttingPageHeader } from './meta'
import {
  buildEmptyStateText,
  buildGapSummary,
  buildImpactSummary,
  buildPriorityRecords,
  buildReplenishmentSummary,
  buildRiskTags,
  filterReplenishmentRecords,
  formatLength,
  formatQty,
  impactFlagMeta,
  materialTypeMeta,
  reasonTypeMeta,
  reviewStatusMeta,
  riskLevelMeta,
  riskTagMeta,
  sourceTypeMeta,
} from './replenishment.helpers'
import {
  paginateItems,
  renderCompactKpiCard,
  renderStickyFilterShell,
  renderStickyTableScroller,
  renderWorkbenchActionCard,
  renderWorkbenchFilterChip,
  renderWorkbenchPagination,
  renderWorkbenchSecondaryPanel,
  renderWorkbenchStateBar,
  renderWorkbenchShortcutZone,
} from './layout.helpers'

type OverlayType = 'detail' | 'review' | 'impact'
type ReplenishmentPriorityMode = 'PRIORITY_REVIEW'
type ReplenishmentKpiFilter = 'PENDING' | 'APPROVED' | 'REJECTED' | 'HIGH_RISK' | 'RECONFIG_REQUIRED' | 'AFFECTED_CRAFT'

interface ReplenishmentState {
  records: ReplenishmentSuggestionRecord[]
  filters: ReplenishmentFilters
  activeOverlay: OverlayType | null
  activeRecordId: string | null
  activePriorityMode: ReplenishmentPriorityMode | null
  activeKpiFilter: ReplenishmentKpiFilter | null
  page: number
  pageSize: number
  reviewDraft: {
    result: ReplenishmentReviewStatus
    comment: string
  }
}

const initialFilters: ReplenishmentFilters = {
  keyword: '',
  materialType: 'ALL',
  reviewStatus: 'ALL',
  riskLevel: 'ALL',
  impactFilter: 'ALL',
  sourceType: 'ALL',
}

const FIELD_TO_FILTER_KEY = {
  keyword: 'keyword',
  materialType: 'materialType',
  reviewStatus: 'reviewStatus',
  riskLevel: 'riskLevel',
  impactFilter: 'impactFilter',
  sourceType: 'sourceType',
} as const

const state: ReplenishmentState = {
  records: cloneReplenishmentSuggestionRecords(),
  filters: { ...initialFilters },
  activeOverlay: null,
  activeRecordId: null,
  activePriorityMode: null,
  activeKpiFilter: null,
  page: 1,
  pageSize: 20,
  reviewDraft: {
    result: 'APPROVED',
    comment: '',
  },
}

function getFilteredRecords(): ReplenishmentSuggestionRecord[] {
  return filterReplenishmentRecords(state.records, state.filters)
}

function resetPagination(): void {
  state.page = 1
}

function applyPriorityMode(records: ReplenishmentSuggestionRecord[]): ReplenishmentSuggestionRecord[] {
  if (state.activePriorityMode === 'PRIORITY_REVIEW') {
    return buildPriorityRecords(records)
  }
  return records
}

function applyKpiFilter(records: ReplenishmentSuggestionRecord[]): ReplenishmentSuggestionRecord[] {
  switch (state.activeKpiFilter) {
    case 'PENDING':
      return records.filter((record) => record.reviewStatus === 'PENDING')
    case 'APPROVED':
      return records.filter((record) => record.reviewStatus === 'APPROVED')
    case 'REJECTED':
      return records.filter((record) => record.reviewStatus === 'REJECTED')
    case 'HIGH_RISK':
      return records.filter((record) => record.riskLevel === 'HIGH')
    case 'RECONFIG_REQUIRED':
      return records.filter((record) => record.impactFlags.includes('RECONFIG_REQUIRED'))
    case 'AFFECTED_CRAFT':
      return records.filter((record) => record.impactFlags.includes('PRINTING_AFFECTED') || record.impactFlags.includes('DYEING_AFFECTED'))
    default:
      return records
  }
}

function getDisplayRecords(): ReplenishmentSuggestionRecord[] {
  return applyKpiFilter(applyPriorityMode(getFilteredRecords()))
}

function findRecord(recordId: string | null): ReplenishmentSuggestionRecord | null {
  if (!recordId) return null
  return state.records.find((item) => item.id === recordId) ?? null
}

function getActiveRecord(): ReplenishmentSuggestionRecord | null {
  return findRecord(state.activeRecordId)
}

function renderBadge(label: string, className: string): string {
  return `<span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}">${escapeHtml(label)}</span>`
}

function buildSummaryCard(label: string, value: number, hint: string, accentClass: string): string {
  return renderCompactKpiCard(label, value, hint, accentClass)
}

function renderFilterSelect(
  label: string,
  field: keyof typeof FIELD_TO_FILTER_KEY,
  value: string,
  options: Array<{ value: string; label: string }>,
): string {
  return `
    <label class="space-y-2">
      <span class="text-sm font-medium text-foreground">${escapeHtml(label)}</span>
      <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-cutting-replenish-field="${field}">
        ${options
          .map((option) => `<option value="${escapeHtml(option.value)}" ${option.value === value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`)
          .join('')}
      </select>
    </label>
  `
}

function renderPageHeader(): string {
  const pathname = appStore.getState().pathname
  const meta = getCanonicalCuttingMeta(pathname, 'replenishment')
  return `
    ${renderCuttingPageHeader(meta, {
      showCompatibilityBadge: isCuttingAliasPath(pathname),
      actionsHtml: `
        <div class="flex flex-wrap gap-2">
          <button class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" data-cutting-replenish-action="go-cut-piece-orders">去裁片单（原始单）</button>
          <button class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" data-cutting-replenish-action="go-material-prep">去仓库配料 / 领料</button>
        </div>
      `,
    })}
  `
}

function getPriorityModeLabel(mode: ReplenishmentPriorityMode | null): string | null {
  if (mode === 'PRIORITY_REVIEW') return '重点模式：优先处理补料建议'
  return null
}

function getKpiFilterLabel(filter: ReplenishmentKpiFilter | null): string | null {
  if (filter === 'PENDING') return 'KPI：待审核补料建议'
  if (filter === 'APPROVED') return 'KPI：已通过补料建议'
  if (filter === 'REJECTED') return 'KPI：已驳回补料建议'
  if (filter === 'HIGH_RISK') return 'KPI：高风险缺口建议'
  if (filter === 'RECONFIG_REQUIRED') return 'KPI：需重新配料建议'
  if (filter === 'AFFECTED_CRAFT') return 'KPI：影响印花 / 染色建议'
  return null
}

function renderShortcutCardZone(records: ReplenishmentSuggestionRecord[]): string {
  const summary = buildReplenishmentSummary(getFilteredRecords())
  return renderWorkbenchShortcutZone({
    columnsClass: 'grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7',
    cardsHtml: [
      renderWorkbenchActionCard({
        title: '待审核优先区',
        count: buildPriorityRecords(records).length,
        hint: '',
        attrs: 'data-cutting-replenish-action="toggle-priority-mode" data-priority-mode="PRIORITY_REVIEW"',
        active: state.activePriorityMode === 'PRIORITY_REVIEW',
        accentClass: 'text-rose-600',
        variant: 'priority',
      }),
      renderWorkbenchActionCard({
        title: '待审核',
        count: summary.pendingCount,
        hint: '',
        attrs: 'data-cutting-replenish-action="toggle-kpi-filter" data-kpi-filter="PENDING"',
        active: state.activeKpiFilter === 'PENDING',
        accentClass: 'text-amber-600',
        variant: 'kpi',
      }),
      renderWorkbenchActionCard({
        title: '已通过',
        count: summary.approvedCount,
        hint: '',
        attrs: 'data-cutting-replenish-action="toggle-kpi-filter" data-kpi-filter="APPROVED"',
        active: state.activeKpiFilter === 'APPROVED',
        accentClass: 'text-emerald-600',
        variant: 'kpi',
      }),
      renderWorkbenchActionCard({
        title: '已驳回',
        count: summary.rejectedCount,
        hint: '',
        attrs: 'data-cutting-replenish-action="toggle-kpi-filter" data-kpi-filter="REJECTED"',
        active: state.activeKpiFilter === 'REJECTED',
        accentClass: 'text-slate-900',
        variant: 'kpi',
      }),
      renderWorkbenchActionCard({
        title: '高风险',
        count: summary.highRiskCount,
        hint: '',
        attrs: 'data-cutting-replenish-action="toggle-kpi-filter" data-kpi-filter="HIGH_RISK"',
        active: state.activeKpiFilter === 'HIGH_RISK',
        accentClass: 'text-rose-600',
        variant: 'kpi',
      }),
      renderWorkbenchActionCard({
        title: '需重新配料',
        count: summary.reconfigCount,
        hint: '',
        attrs: 'data-cutting-replenish-action="toggle-kpi-filter" data-kpi-filter="RECONFIG_REQUIRED"',
        active: state.activeKpiFilter === 'RECONFIG_REQUIRED',
        accentClass: 'text-blue-600',
        variant: 'kpi',
      }),
      renderWorkbenchActionCard({
        title: '影响后续工艺',
        count: summary.affectedCraftCount,
        hint: '',
        attrs: 'data-cutting-replenish-action="toggle-kpi-filter" data-kpi-filter="AFFECTED_CRAFT"',
        active: state.activeKpiFilter === 'AFFECTED_CRAFT',
        accentClass: 'text-violet-600',
        variant: 'kpi',
      }),
    ].join(''),
  })
}

function renderActiveStateBar(): string {
  const chips: string[] = []
  const priorityLabel = getPriorityModeLabel(state.activePriorityMode)
  const kpiLabel = getKpiFilterLabel(state.activeKpiFilter)
  if (priorityLabel) {
    chips.push(renderWorkbenchFilterChip(priorityLabel, 'data-cutting-replenish-action="clear-priority-mode"', 'amber'))
  }
  if (kpiLabel) {
    chips.push(renderWorkbenchFilterChip(kpiLabel, 'data-cutting-replenish-action="clear-kpi-filter"', 'blue'))
  }

  return renderWorkbenchStateBar({
    summary: '当前主表视图',
    chips,
    clearAttrs: 'data-cutting-replenish-action="clear-view-state"',
  })
}

function renderFilterSection(): string {
  return renderStickyFilterShell(`
      <div class="grid gap-3 lg:grid-cols-3 xl:grid-cols-7">
        <label class="space-y-2 xl:col-span-2">
          <span class="text-sm font-medium text-foreground">关键词搜索</span>
          <input
            class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            value="${escapeHtml(state.filters.keyword)}"
            placeholder="补料单号 / 裁片单号 / 生产单号 / 面料 SKU"
            data-cutting-replenish-field="keyword"
          />
        </label>
        ${renderFilterSelect('面料类型', 'materialType', state.filters.materialType, [
          { value: 'ALL', label: '全部' },
          { value: 'PRINT', label: '印花面料' },
          { value: 'DYE', label: '染色面料' },
          { value: 'SOLID', label: '净色面料' },
          { value: 'LINING', label: '里布' },
        ])}
        ${renderFilterSelect('审核状态', 'reviewStatus', state.filters.reviewStatus, [
          { value: 'ALL', label: '全部' },
          { value: 'PENDING', label: '待审核' },
          { value: 'APPROVED', label: '已通过' },
          { value: 'REJECTED', label: '已驳回' },
          { value: 'NEED_MORE_INFO', label: '待补充说明' },
        ])}
        ${renderFilterSelect('风险等级', 'riskLevel', state.filters.riskLevel, [
          { value: 'ALL', label: '全部' },
          { value: 'HIGH', label: '高' },
          { value: 'MEDIUM', label: '中' },
          { value: 'LOW', label: '低' },
        ])}
        ${renderFilterSelect('影响筛选', 'impactFilter', state.filters.impactFilter, [
          { value: 'ALL', label: '全部' },
          { value: 'RECONFIG_REQUIRED', label: '需重新配料' },
          { value: 'RERECEIVE_REQUIRED', label: '需重新领料' },
          { value: 'PRINTING_AFFECTED', label: '影响印花' },
          { value: 'DYEING_AFFECTED', label: '影响染色' },
        ])}
        ${renderFilterSelect('来源筛选', 'sourceType', state.filters.sourceType, [
          { value: 'ALL', label: '全部' },
          { value: 'MARKER', label: '唛架' },
          { value: 'SPREADING', label: '铺布' },
          { value: 'RECEIVE_DISCREPANCY', label: '领料差异' },
          { value: 'EXECUTION_RISK', label: '执行风险' },
        ])}
      </div>
  `)
}

function renderPrioritySection(records: ReplenishmentSuggestionRecord[]): string {
  const priorityRecords = buildPriorityRecords(records)
  return renderWorkbenchSecondaryPanel({
    title: '优先处理条',
    hint: '优先处理高风险、待审核和待补充说明的补料建议。',
    countText: `${priorityRecords.length} 条优先`,
    body: `
      <div class="divide-y">
        ${
          priorityRecords.length
            ? priorityRecords
                .map((record) => `
                  <div class="flex items-center justify-between gap-4 px-4 py-3">
                    <div class="min-w-0">
                      <div class="flex flex-wrap items-center gap-2">
                        <button class="font-medium text-blue-600 hover:underline" data-cutting-replenish-action="open-detail" data-record-id="${record.id}">${escapeHtml(record.replenishmentNo)}</button>
                        ${renderBadge(riskLevelMeta[record.riskLevel].label, riskLevelMeta[record.riskLevel].className)}
                        ${renderBadge(reviewStatusMeta[record.reviewStatus].label, reviewStatusMeta[record.reviewStatus].className)}
                      </div>
                      <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(record.cutPieceOrderNo)} · ${escapeHtml(record.materialSku)} · ${escapeHtml(buildGapSummary(record))}</p>
                      <div class="mt-2 flex flex-wrap gap-2">
                        ${buildRiskTags(record).map((tag) => renderBadge(riskTagMeta[tag].label, riskTagMeta[tag].className)).join('')}
                      </div>
                    </div>
                    <button class="shrink-0 rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-replenish-action="open-review" data-record-id="${record.id}">审核处理</button>
                  </div>
                `)
                .join('')
            : '<div class="px-4 py-8 text-center text-sm text-muted-foreground">当前筛选范围内暂无重点补料建议。</div>'
        }
      </div>
    `,
  })
}

function renderMainTable(): string {
  const records = getDisplayRecords()
  const pagination = paginateItems(records, state.page, state.pageSize)
  if (!pagination.total) {
    return `
      <section class="rounded-lg border bg-card px-6 py-16 text-center">
        <h2 class="text-base font-semibold text-foreground">暂无匹配的补料建议</h2>
        <p class="mt-2 text-sm text-muted-foreground">${escapeHtml(buildEmptyStateText(state.filters))}</p>
      </section>
    `
  }

  return `
    <section class="rounded-lg border bg-card">
      <div class="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 class="text-base font-semibold">补料建议主表</h2>
          <p class="mt-0.5 text-xs text-muted-foreground">风险、缺口、审核一屏查看。</p>
        </div>
        <div class="text-sm text-muted-foreground">共 ${pagination.total} 条补料建议</div>
      </div>
      ${renderStickyTableScroller(
        `
        <table class="w-full min-w-[1320px] text-sm">
          <thead class="sticky top-0 z-10 border-b bg-muted/95 text-muted-foreground backdrop-blur">
            <tr>
              <th class="px-4 py-3 text-left font-medium">补料单号</th>
              <th class="px-4 py-3 text-left font-medium">裁片单号</th>
              <th class="px-4 py-3 text-left font-medium">生产单号</th>
              <th class="px-4 py-3 text-left font-medium">面料 SKU</th>
              <th class="px-4 py-3 text-left font-medium">风险等级</th>
              <th class="px-4 py-3 text-left font-medium">建议缺口</th>
              <th class="px-4 py-3 text-left font-medium">建议补料长度 / 卷数</th>
              <th class="px-4 py-3 text-left font-medium">审核状态</th>
              <th class="px-4 py-3 text-left font-medium">影响摘要</th>
              <th class="px-4 py-3 text-left font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            ${pagination.items
              .map((record) => `
                <tr class="border-b last:border-b-0 hover:bg-muted/20">
                  <td class="px-4 py-3 align-top">
                    <button class="font-medium text-blue-600 hover:underline" data-cutting-replenish-action="open-detail" data-record-id="${record.id}">
                      ${escapeHtml(record.replenishmentNo)}
                    </button>
                    <div class="mt-1 text-xs text-muted-foreground">生成于 ${escapeHtml(formatDateTime(record.suggestionCreatedAt))}</div>
                  </td>
                  <td class="px-4 py-3 align-top">
                    <div class="font-medium text-foreground">${escapeHtml(record.cutPieceOrderNo)}</div>
                    <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(record.productionOrderNo)}</div>
                  </td>
                  <td class="px-4 py-3 align-top">${escapeHtml(record.productionOrderNo)}</td>
                  <td class="px-4 py-3 align-top">
                    <div class="font-medium text-foreground">${escapeHtml(record.materialSku)}</div>
                    <div class="mt-1">${renderBadge(materialTypeMeta[record.materialType].label, materialTypeMeta[record.materialType].className)}</div>
                  </td>
                  <td class="px-4 py-3 align-top">${renderBadge(riskLevelMeta[record.riskLevel].label, riskLevelMeta[record.riskLevel].className)}</td>
                  <td class="px-4 py-3 align-top">
                    <div class="font-medium text-foreground">${formatQty(record.gapQty)} 件</div>
                    <div class="mt-1 text-xs text-muted-foreground">理论 ${formatQty(record.theoreticalYieldQty)} / 预计 ${formatQty(record.predictedActualQty)}</div>
                  </td>
                  <td class="px-4 py-3 align-top">
                    <div class="font-medium text-foreground">${formatQty(record.suggestedReplenishRollCount)} 卷 / ${formatLength(record.suggestedReplenishLength)}</div>
                    <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(reasonTypeMeta[record.shortageReasonType])}</div>
                  </td>
                  <td class="px-4 py-3 align-top">
                    ${renderBadge(reviewStatusMeta[record.reviewStatus].label, reviewStatusMeta[record.reviewStatus].className)}
                    <div class="mt-1 text-xs text-muted-foreground">${record.reviewerName ? `${escapeHtml(record.reviewerName)} · ${escapeHtml(formatDateTime(record.reviewedAt))}` : '尚未审核'}</div>
                  </td>
                  <td class="px-4 py-3 align-top">
                    <div class="flex flex-wrap gap-1">
                      ${
                        record.impactFlags.length
                          ? record.impactFlags.slice(0, 2).map((flag) => renderBadge(impactFlagMeta[flag].label, impactFlagMeta[flag].className)).join('')
                          : '<span class="text-xs text-muted-foreground">无额外影响</span>'
                      }
                    </div>
                    <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(buildImpactSummary(record))}</div>
                  </td>
                  <td class="px-4 py-3 align-top">
                    <div class="flex flex-wrap gap-2 text-xs">
                      <button class="rounded-md border px-2.5 py-1.5 hover:bg-muted" data-cutting-replenish-action="open-detail" data-record-id="${record.id}">查看依据</button>
                      <button class="rounded-md border px-2.5 py-1.5 hover:bg-muted" data-cutting-replenish-action="open-review" data-record-id="${record.id}">审核处理</button>
                      <button class="rounded-md border px-2.5 py-1.5 hover:bg-muted" data-cutting-replenish-action="open-impact" data-record-id="${record.id}">查看影响</button>
                      <button class="rounded-md border px-2.5 py-1.5 hover:bg-muted" data-cutting-replenish-action="go-cut-piece-orders">去裁片单（原始单）</button>
                      <button class="rounded-md border px-2.5 py-1.5 hover:bg-muted" data-cutting-replenish-action="go-material-prep">去仓库配料 / 领料</button>
                    </div>
                  </td>
                </tr>
              `)
              .join('')}
          </tbody>
        </table>
      `,
        'max-h-[58vh]',
      )}
      ${renderWorkbenchPagination({
        page: pagination.page,
        pageSize: pagination.pageSize,
        total: pagination.total,
        actionAttr: 'data-cutting-replenish-action',
        pageAction: 'set-page',
        pageSizeAttr: 'data-cutting-replenish-page-size',
      })}
    </section>
  `
}

function renderDetailDrawer(): string {
  if (state.activeOverlay !== 'detail') return ''
  const record = getActiveRecord()
  if (!record) return ''
  return uiDrawer(
    {
      title: '补料建议详情',
      subtitle: `${record.replenishmentNo} · ${record.cutPieceOrderNo}`,
      closeAction: { prefix: 'cutting-replenish', action: 'close-overlay' },
      width: 'lg',
    },
    `
      <div class="space-y-6">
        <section class="grid gap-4 rounded-lg border bg-muted/20 p-4 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <p class="text-xs text-muted-foreground">补料单号</p>
            <p class="mt-1 font-medium text-foreground">${escapeHtml(record.replenishmentNo)}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">裁片单号</p>
            <p class="mt-1 font-medium text-foreground">${escapeHtml(record.cutPieceOrderNo)}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">生产单号</p>
            <p class="mt-1 font-medium text-foreground">${escapeHtml(record.productionOrderNo)}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">面料 SKU</p>
            <p class="mt-1 font-medium text-foreground">${escapeHtml(record.materialSku)}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">面料类型</p>
            <div class="mt-1">${renderBadge(materialTypeMeta[record.materialType].label, materialTypeMeta[record.materialType].className)}</div>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">建议生成时间</p>
            <p class="mt-1 font-medium text-foreground">${escapeHtml(formatDateTime(record.suggestionCreatedAt))}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">风险等级</p>
            <div class="mt-1">${renderBadge(riskLevelMeta[record.riskLevel].label, riskLevelMeta[record.riskLevel].className)}</div>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">当前审核状态</p>
            <div class="mt-1">${renderBadge(reviewStatusMeta[record.reviewStatus].label, reviewStatusMeta[record.reviewStatus].className)}</div>
          </div>
        </section>

        <section class="rounded-lg border p-4">
          <h3 class="text-sm font-semibold text-foreground">计算依据</h3>
          <div class="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3 text-sm text-muted-foreground">
            <p>唛架摘要：<span class="font-medium text-foreground">${escapeHtml(record.markerSizeMixSummary)}</span></p>
            <p>唛架总件数：<span class="font-medium text-foreground">${formatQty(record.markerTotalPieces)}</span></p>
            <p>唛架净长度：<span class="font-medium text-foreground">${formatLength(record.markerNetLength)}</span></p>
            <p>单件用量：<span class="font-medium text-foreground">${record.perPieceConsumption.toFixed(3)} 米</span></p>
            <p>铺布记录：<span class="font-medium text-foreground">${record.spreadingRecordCount} 条 / ${formatLength(record.totalSpreadLength)}</span></p>
            <p>最近一次铺布：<span class="font-medium text-foreground">${record.latestSpreadingAt ? `${escapeHtml(formatDateTime(record.latestSpreadingAt))} · ${escapeHtml(record.latestSpreadingBy)}` : '暂无铺布'}</span></p>
            <p>配置 / 领料：<span class="font-medium text-foreground">${formatLength(record.configuredLength)} / ${formatLength(record.receivedLength)}</span></p>
            <p>理论裁剪能力：<span class="font-medium text-foreground">${formatQty(record.theoreticalYieldQty)}</span></p>
            <p>预计实际裁剪能力：<span class="font-medium text-foreground">${formatQty(record.predictedActualQty)}</span></p>
            <p>缺口数量：<span class="font-medium text-foreground">${formatQty(record.gapQty)} 件</span></p>
            <p>建议补料长度 / 卷数：<span class="font-medium text-foreground">${formatQty(record.suggestedReplenishRollCount)} 卷 / ${formatLength(record.suggestedReplenishLength)}</span></p>
            <p>最近一次领料：<span class="font-medium text-foreground">${record.latestReceiveAt ? `${escapeHtml(formatDateTime(record.latestReceiveAt))} · ${escapeHtml(record.latestReceiveBy)}` : '暂无领料回写'}</span></p>
          </div>
        </section>

        <section class="rounded-lg border p-4">
          <h3 class="text-sm font-semibold text-foreground">原因与风险</h3>
          <div class="mt-4 space-y-3 text-sm text-muted-foreground">
            <p>建议来源：<span class="font-medium text-foreground">${escapeHtml(record.suggestionSourceTypes.map((item) => sourceTypeMeta[item]).join(' / '))}</span></p>
            <p>缺口原因：<span class="font-medium text-foreground">${escapeHtml(reasonTypeMeta[record.shortageReasonType])}</span></p>
            <div class="flex flex-wrap gap-2">
              ${buildRiskTags(record).map((tag) => renderBadge(riskTagMeta[tag].label, riskTagMeta[tag].className)).join('') || '<span class="text-muted-foreground">暂无额外风险标签</span>'}
            </div>
            <p>${escapeHtml(record.note)}</p>
          </div>
        </section>

        <section class="rounded-lg border p-4">
          <h3 class="text-sm font-semibold text-foreground">影响预览</h3>
          <div class="mt-4 flex flex-wrap gap-2">
            ${record.impactFlags.map((flag) => renderBadge(impactFlagMeta[flag].label, impactFlagMeta[flag].className)).join('') || '<span class="text-sm text-muted-foreground">当前审核结果不触发额外联动。</span>'}
          </div>
          <div class="mt-4 grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
            <p>是否需要重新配料：<span class="font-medium text-foreground">${record.impactPreview.requiresReconfig ? '是' : '否'}</span></p>
            <p>是否需要重新领料：<span class="font-medium text-foreground">${record.impactPreview.requiresRereceive ? '是' : '否'}</span></p>
            <p>是否可能影响印花单：<span class="font-medium text-foreground">${record.impactPreview.mayAffectPrintingOrder ? '是' : '否'}</span></p>
            <p>是否可能影响染色单：<span class="font-medium text-foreground">${record.impactPreview.mayAffectDyeingOrder ? '是' : '否'}</span></p>
          </div>
          <p class="mt-3 text-sm text-muted-foreground">${escapeHtml(record.impactPreview.impactDescription)}</p>
          <p class="mt-2 text-sm text-muted-foreground">推荐下一步：<span class="font-medium text-foreground">${escapeHtml(record.impactPreview.nextSuggestedActionText)}</span></p>
        </section>

        <section class="rounded-lg border p-4">
          <h3 class="text-sm font-semibold text-foreground">关联单据</h3>
          <div class="mt-4 space-y-3">
            ${record.linkedDocumentSummaries
              .map(
                (doc) => `
                  <article class="rounded-lg border bg-muted/20 p-3 text-sm">
                    <div class="flex items-center justify-between gap-3">
                      <div class="font-medium text-foreground">${escapeHtml(doc.docNo)}</div>
                      <span class="text-xs text-muted-foreground">${escapeHtml(doc.status)}</span>
                    </div>
                    <p class="mt-1 text-muted-foreground">${escapeHtml(doc.summaryText)}</p>
                  </article>
                `,
              )
              .join('')}
          </div>
        </section>

        <section class="rounded-lg border p-4">
          <h3 class="text-sm font-semibold text-foreground">快捷入口区</h3>
          <div class="mt-4 flex flex-wrap gap-2">
            <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-replenish-action="go-cut-piece-orders">去裁片单（原始单）</button>
            <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-replenish-action="go-material-prep">去仓库配料 / 领料</button>
            <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-replenish-action="open-review" data-record-id="${record.id}">打开审核处理</button>
          </div>
        </section>
      </div>
    `,
    {
      cancel: { prefix: 'cutting-replenish', action: 'close-overlay', label: '关闭' },
    },
  )
}

function renderReviewDrawer(): string {
  if (state.activeOverlay !== 'review') return ''
  const record = getActiveRecord()
  if (!record) return ''
  return uiFormDrawer(
    {
      title: '补料审核',
      subtitle: `${record.replenishmentNo} · ${record.cutPieceOrderNo}`,
      closeAction: { prefix: 'cutting-replenish', action: 'close-overlay' },
      submitAction: { prefix: 'cutting-replenish', action: 'save-review', label: '保存审核结果' },
      width: 'lg',
    },
    `
      <div class="space-y-6">
        <section class="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
          <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <p>当前建议：<span class="font-medium text-foreground">${escapeHtml(buildGapSummary(record))}</span></p>
            <p>来源：<span class="font-medium text-foreground">${escapeHtml(record.suggestionSourceTypes.map((item) => sourceTypeMeta[item]).join(' / '))}</span></p>
            <p>当前状态：<span class="font-medium text-foreground">${escapeHtml(reviewStatusMeta[record.reviewStatus].label)}</span></p>
            <p>风险等级：<span class="font-medium text-foreground">${escapeHtml(riskLevelMeta[record.riskLevel].label)}</span></p>
          </div>
        </section>

        <section class="rounded-lg border p-4">
          <h3 class="text-sm font-semibold text-foreground">审核结果</h3>
          <div class="mt-4 flex flex-wrap gap-3">
            ${(['APPROVED', 'REJECTED', 'NEED_MORE_INFO'] as ReplenishmentReviewStatus[])
              .map((status) => `
                <button
                  class="rounded-md border px-3 py-2 text-sm ${state.reviewDraft.result === status ? 'border-blue-600 bg-blue-50 text-blue-700' : 'hover:bg-muted'}"
                  data-cutting-replenish-action="select-review-status"
                  data-review-status="${status}"
                >
                  ${escapeHtml(reviewStatusMeta[status].label)}
                </button>
              `)
              .join('')}
          </div>
        </section>

        <section class="rounded-lg border p-4">
          <h3 class="text-sm font-semibold text-foreground">审核意见</h3>
          <textarea class="mt-4 min-h-[120px] w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-cutting-replenish-review-field="comment">${escapeHtml(state.reviewDraft.comment)}</textarea>
        </section>

        <section class="rounded-lg border p-4">
          <h3 class="text-sm font-semibold text-foreground">影响确认区</h3>
          <div class="mt-4 flex flex-wrap gap-2">
            ${record.impactFlags.map((flag) => renderBadge(impactFlagMeta[flag].label, impactFlagMeta[flag].className)).join('') || '<span class="text-sm text-muted-foreground">当前没有额外影响。</span>'}
          </div>
          <p class="mt-3 text-sm text-muted-foreground">${escapeHtml(record.impactPreview.impactDescription)}</p>
          <p class="mt-2 text-sm text-muted-foreground">本步只展示影响，不单独创建补料专属配置流程；若审核通过，后续回到仓库配料页处理。</p>
        </section>
      </div>
    `,
  )
}

function renderImpactDialog(): string {
  if (state.activeOverlay !== 'impact') return ''
  const record = getActiveRecord()
  if (!record) return ''
  return uiDialog(
    {
      title: '补料影响预览',
      description: '展示补料建议若通过后，后续可能影响的环节和下一步动作。',
      closeAction: { prefix: 'cutting-replenish', action: 'close-overlay' },
      width: 'lg',
    },
    `
      <div class="space-y-5 text-sm">
        <section class="rounded-lg border bg-muted/20 p-4">
          <div class="flex flex-wrap gap-2">
            ${record.impactFlags.map((flag) => renderBadge(impactFlagMeta[flag].label, impactFlagMeta[flag].className)).join('') || '<span class="text-muted-foreground">当前没有额外影响。</span>'}
          </div>
          <p class="mt-3 text-muted-foreground">${escapeHtml(record.impactPreview.impactDescription)}</p>
        </section>
        <section class="grid gap-4 rounded-lg border p-4 md:grid-cols-2">
          <div>
            <p class="text-xs text-muted-foreground">需重新配料</p>
            <p class="mt-1 font-medium text-foreground">${record.impactPreview.requiresReconfig ? '是' : '否'}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">需重新领料</p>
            <p class="mt-1 font-medium text-foreground">${record.impactPreview.requiresRereceive ? '是' : '否'}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">可能影响印花单</p>
            <p class="mt-1 font-medium text-foreground">${record.impactPreview.mayAffectPrintingOrder ? '是' : '否'}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">可能影响染色单</p>
            <p class="mt-1 font-medium text-foreground">${record.impactPreview.mayAffectDyeingOrder ? '是' : '否'}</p>
          </div>
        </section>
        <section class="rounded-lg border p-4">
          <h3 class="text-sm font-semibold text-foreground">推荐下一步动作</h3>
          <p class="mt-3 text-muted-foreground">${escapeHtml(record.impactPreview.nextSuggestedActionText)}</p>
        </section>
      </div>
    `,
    `
      <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-cutting-replenish-action="close-overlay">关闭</button>
      <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" data-cutting-replenish-action="open-review" data-record-id="${record.id}">去审核处理</button>
    `,
  )
}

function openOverlay(type: OverlayType, recordId: string): void {
  state.activeOverlay = type
  state.activeRecordId = recordId
  const record = findRecord(recordId)
  if (!record) return
  if (type === 'review') {
    state.reviewDraft = {
      result: record.reviewStatus === 'PENDING' ? 'APPROVED' : record.reviewStatus,
      comment: record.reviewComment,
    }
  }
}

function closeOverlay(): void {
  state.activeOverlay = null
  state.activeRecordId = null
  state.reviewDraft = {
    result: 'APPROVED',
    comment: '',
  }
}

function saveReview(): boolean {
  const record = getActiveRecord()
  if (!record) return false
  record.reviewStatus = state.reviewDraft.result
  record.reviewComment = state.reviewDraft.comment.trim() || '运营审核已记录。'
  record.reviewerName = '运营审核员 林可心'
  record.reviewedAt = '2026-03-22 18:05'
  closeOverlay()
  return true
}

export function renderCraftCuttingReplenishmentPage(): string {
  const records = getFilteredRecords()
  return `
    <div class="space-y-2.5 p-4">
      ${renderPageHeader()}
      ${renderShortcutCardZone(records)}
      ${renderFilterSection()}
      ${renderActiveStateBar()}
      ${renderMainTable()}
      ${renderDetailDrawer()}
      ${renderReviewDrawer()}
      ${renderImpactDialog()}
    </div>
  `
}

export function handleCraftCuttingReplenishmentEvent(target: Element): boolean {
  const pageSizeNode = target.closest<HTMLElement>('[data-cutting-replenish-page-size]')
  if (pageSizeNode) {
    const input = pageSizeNode as HTMLSelectElement
    state.pageSize = Number(input.value) || 20
    state.page = 1
    return true
  }

  const fieldNode = target.closest<HTMLElement>('[data-cutting-replenish-field]')
  if (fieldNode) {
    const field = fieldNode.dataset.cuttingReplenishField as keyof typeof FIELD_TO_FILTER_KEY | undefined
    if (!field) return false
    const filterKey = FIELD_TO_FILTER_KEY[field]
    const input = fieldNode as HTMLInputElement | HTMLSelectElement
    state.filters = {
      ...state.filters,
      [filterKey]: input.value,
    }
    resetPagination()
    return true
  }

  const reviewFieldNode = target.closest<HTMLElement>('[data-cutting-replenish-review-field]')
  if (reviewFieldNode) {
    const field = reviewFieldNode.dataset.cuttingReplenishReviewField
    if (field === 'comment') {
      const input = reviewFieldNode as HTMLTextAreaElement
      state.reviewDraft = {
        ...state.reviewDraft,
        comment: input.value,
      }
      return true
    }
  }

  const actionNode = target.closest<HTMLElement>('[data-cutting-replenish-action]')
  const action = actionNode?.dataset.cuttingReplenishAction
  if (!action) return false

  const recordId = actionNode?.dataset.recordId ?? state.activeRecordId ?? ''

  if (action === 'toggle-priority-mode') {
    const mode = actionNode?.dataset.priorityMode as ReplenishmentPriorityMode | undefined
    if (!mode) return false
    state.activePriorityMode = state.activePriorityMode === mode ? null : mode
    resetPagination()
    return true
  }

  if (action === 'clear-priority-mode') {
    state.activePriorityMode = null
    resetPagination()
    return true
  }

  if (action === 'toggle-kpi-filter') {
    const filter = actionNode?.dataset.kpiFilter as ReplenishmentKpiFilter | undefined
    if (!filter) return false
    state.activeKpiFilter = state.activeKpiFilter === filter ? null : filter
    resetPagination()
    return true
  }

  if (action === 'clear-kpi-filter') {
    state.activeKpiFilter = null
    resetPagination()
    return true
  }

  if (action === 'clear-view-state') {
    state.activePriorityMode = null
    state.activeKpiFilter = null
    state.filters = { ...initialFilters }
    resetPagination()
    return true
  }

  if (action === 'set-page') {
    state.page = Number(actionNode?.dataset.page) || 1
    return true
  }

  if (action === 'go-cut-piece-orders') {
    appStore.navigate(getCanonicalCuttingPath('original-orders'))
    return true
  }

  if (action === 'go-material-prep') {
    appStore.navigate(getCanonicalCuttingPath('material-prep'))
    return true
  }

  if (action === 'open-detail' && recordId) {
    openOverlay('detail', recordId)
    return true
  }

  if (action === 'open-review' && recordId) {
    openOverlay('review', recordId)
    return true
  }

  if (action === 'open-impact' && recordId) {
    openOverlay('impact', recordId)
    return true
  }

  if (action === 'select-review-status') {
    const reviewStatus = actionNode?.dataset.reviewStatus as ReplenishmentReviewStatus | undefined
    if (!reviewStatus) return false
    state.reviewDraft = {
      ...state.reviewDraft,
      result: reviewStatus,
    }
    return true
  }

  if (action === 'save-review') {
    return saveReview()
  }

  if (action === 'close-overlay') {
    closeOverlay()
    return true
  }

  return false
}

export function isCraftCuttingReplenishmentDialogOpen(): boolean {
  return state.activeOverlay !== null
}
