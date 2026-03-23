import { renderDrawer as uiDrawer } from '../../../components/ui'
import { cloneCuttingSummaryRecords, type CuttingSummaryFilters, type CuttingSummaryRecord } from '../../../data/fcs/cutting/cutting-summary'
import { buildCuttingSummaryPickupView } from '../../../domain/pickup/page-adapters/pcs-cutting-summary'
import { appStore } from '../../../state/store'
import { escapeHtml, formatDateTime } from '../../../utils'
import {
  buildEmptyStateText,
  buildExecutionText,
  buildIssueSummaryText,
  buildMaterialReceiveText,
  buildPriorityRecords,
  buildReplenishmentText,
  buildSummaryOverview,
  buildWarehouseSampleText,
  filterCuttingSummaryRecords,
  hasSummaryFilters,
  issueSourceMeta,
  riskLevelMeta,
  summaryStatusMeta,
  updatedSourceMeta,
  urgencyMeta,
} from './cutting-summary.helpers'
import {
  paginateItems,
  renderStickyFilterShell,
  renderStickyTableScroller,
  renderWorkbenchActionCard,
  renderWorkbenchFilterChip,
  renderWorkbenchPagination,
  renderWorkbenchStateBar,
  renderWorkbenchShortcutZone,
} from './layout.helpers'

type OverlayType = 'detail' | 'issues'
type CuttingSummaryPriorityMode = 'ISSUE_FOCUS'
type CuttingSummaryKpiFilter =
  | 'PENDING_CLOSURE'
  | 'DONE_PENDING_REVIEW'
  | 'CLOSED'
  | 'HIGH_RISK'
  | 'PENDING_REPLENISHMENT'
  | 'PENDING_WAREHOUSE'

interface CuttingSummaryState {
  records: CuttingSummaryRecord[]
  filters: CuttingSummaryFilters
  activePriorityMode: CuttingSummaryPriorityMode | null
  activeKpiFilter: CuttingSummaryKpiFilter | null
  activeOverlay: OverlayType | null
  activeRecordId: string | null
  page: number
  pageSize: number
}

const initialFilters: CuttingSummaryFilters = {
  keyword: '',
  urgencyLevel: 'ALL',
  summaryStatus: 'ALL',
  riskLevel: 'ALL',
  issueSource: 'ALL',
  pendingOnly: 'ALL',
}

const state: CuttingSummaryState = {
  records: cloneCuttingSummaryRecords(),
  filters: { ...initialFilters },
  activePriorityMode: null,
  activeKpiFilter: null,
  activeOverlay: null,
  activeRecordId: null,
  page: 1,
  pageSize: 20,
}

function renderBadge(label: string, className: string): string {
  return `<span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}">${escapeHtml(label)}</span>`
}

function resetPagination(): void {
  state.page = 1
}

function getBaseRecords(): CuttingSummaryRecord[] {
  return filterCuttingSummaryRecords(state.records, state.filters)
}

function renderFilterSelect(
  label: string,
  field: keyof CuttingSummaryFilters,
  value: string,
  options: Array<{ value: string; label: string }>,
): string {
  return `
    <label class="space-y-2">
      <span class="text-sm font-medium text-foreground">${escapeHtml(label)}</span>
      <select
        class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        data-cutting-summary-field="${field}"
      >
        ${options
          .map((option) => `<option value="${escapeHtml(option.value)}" ${option.value === value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`)
          .join('')}
      </select>
    </label>
  `
}

function applyPriorityMode(records: CuttingSummaryRecord[]): CuttingSummaryRecord[] {
  if (state.activePriorityMode === 'ISSUE_FOCUS') return buildPriorityRecords(records)
  return records
}

function applyKpiFilter(records: CuttingSummaryRecord[]): CuttingSummaryRecord[] {
  if (state.activeKpiFilter === 'PENDING_CLOSURE') return records.filter((record) => record.overallSummaryStatus !== 'CLOSED')
  if (state.activeKpiFilter === 'DONE_PENDING_REVIEW') return records.filter((record) => record.overallSummaryStatus === 'DONE_PENDING_REVIEW')
  if (state.activeKpiFilter === 'CLOSED') return records.filter((record) => record.overallSummaryStatus === 'CLOSED')
  if (state.activeKpiFilter === 'HIGH_RISK') return records.filter((record) => record.overallRiskLevel === 'HIGH')
  if (state.activeKpiFilter === 'PENDING_REPLENISHMENT') return records.filter((record) => record.replenishmentSummary.pendingReviewCount > 0 || record.replenishmentSummary.needMoreInfoCount > 0)
  if (state.activeKpiFilter === 'PENDING_WAREHOUSE') {
    return records.filter(
      (record) =>
        record.warehouseSummary.cutPiecePendingInboundCount > 0 ||
        record.warehouseSummary.waitingHandoverCount > 0 ||
        record.sampleSummary.sampleWaitingReturnCount > 0,
    )
  }
  return records
}

function getDisplayRecords(): CuttingSummaryRecord[] {
  return applyKpiFilter(applyPriorityMode(getBaseRecords()))
}

function getPriorityModeLabel(mode: CuttingSummaryPriorityMode | null): string | null {
  if (mode === 'ISSUE_FOCUS') return '重点模式：待收口问题生产单'
  return null
}

function getKpiFilterLabel(filter: CuttingSummaryKpiFilter | null): string | null {
  if (filter === 'PENDING_CLOSURE') return 'KPI：待收口生产单'
  if (filter === 'DONE_PENDING_REVIEW') return 'KPI：已完成待核查生产单'
  if (filter === 'CLOSED') return 'KPI：已收口生产单'
  if (filter === 'HIGH_RISK') return 'KPI：高风险生产单'
  if (filter === 'PENDING_REPLENISHMENT') return 'KPI：待补料处理生产单'
  if (filter === 'PENDING_WAREHOUSE') return 'KPI：待入仓 / 待发后道生产单'
  return null
}

function findRecord(recordId: string | null): CuttingSummaryRecord | null {
  if (!recordId) return null
  return state.records.find((item) => item.id === recordId) ?? null
}

function getActiveRecord(): CuttingSummaryRecord | null {
  return findRecord(state.activeRecordId)
}

function openOverlay(type: OverlayType, recordId: string): void {
  state.activeOverlay = type
  state.activeRecordId = recordId
}

function closeOverlay(): void {
  state.activeOverlay = null
  state.activeRecordId = null
}

function navigateTo(route: string): void {
  appStore.navigate(route)
}

function renderPageHeader(): string {
  return `
    <header class="flex flex-col gap-2">
      <div>
        <p class="mb-1 text-sm text-muted-foreground">工艺工厂运营系统 / 裁片管理</p>
        <h1 class="text-xl font-bold">裁剪总结</h1>
        <p class="mt-0.5 text-xs text-muted-foreground">生产单汇总主表优先。</p>
      </div>
    </header>
  `
}

function renderShortcutCardZone(): string {
  const baseRecords = getBaseRecords()
  const summary = buildSummaryOverview(getBaseRecords())
  return renderWorkbenchShortcutZone({
    columnsClass: 'grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7',
    cardsHtml: [
      renderWorkbenchActionCard({
        title: '重点问题',
        count: buildPriorityRecords(baseRecords).length,
        hint: '',
        attrs: 'data-cutting-summary-action="toggle-priority-mode" data-priority-mode="ISSUE_FOCUS"',
        active: state.activePriorityMode === 'ISSUE_FOCUS',
        accentClass: 'text-rose-600',
        variant: 'priority',
      }),
      renderWorkbenchActionCard({
        title: '待收口',
        count: summary.pendingClosureCount,
        hint: '',
        attrs: 'data-cutting-summary-action="toggle-kpi-filter" data-kpi-filter="PENDING_CLOSURE"',
        active: state.activeKpiFilter === 'PENDING_CLOSURE',
        variant: 'kpi',
      }),
      renderWorkbenchActionCard({
        title: '待核查',
        count: summary.donePendingReviewCount,
        hint: '',
        attrs: 'data-cutting-summary-action="toggle-kpi-filter" data-kpi-filter="DONE_PENDING_REVIEW"',
        active: state.activeKpiFilter === 'DONE_PENDING_REVIEW',
        accentClass: 'text-emerald-600',
        variant: 'kpi',
      }),
      renderWorkbenchActionCard({
        title: '已收口',
        count: summary.closedCount,
        hint: '',
        attrs: 'data-cutting-summary-action="toggle-kpi-filter" data-kpi-filter="CLOSED"',
        active: state.activeKpiFilter === 'CLOSED',
        accentClass: 'text-emerald-600',
        variant: 'kpi',
      }),
      renderWorkbenchActionCard({
        title: '高风险',
        count: summary.highRiskCount,
        hint: '',
        attrs: 'data-cutting-summary-action="toggle-kpi-filter" data-kpi-filter="HIGH_RISK"',
        active: state.activeKpiFilter === 'HIGH_RISK',
        accentClass: 'text-rose-600',
        variant: 'kpi',
      }),
      renderWorkbenchActionCard({
        title: '待补料',
        count: summary.pendingReplenishmentCount,
        hint: '',
        attrs: 'data-cutting-summary-action="toggle-kpi-filter" data-kpi-filter="PENDING_REPLENISHMENT"',
        active: state.activeKpiFilter === 'PENDING_REPLENISHMENT',
        accentClass: 'text-violet-600',
        variant: 'kpi',
      }),
      renderWorkbenchActionCard({
        title: '待入仓 / 交接',
        count: summary.pendingWarehouseCount,
        hint: '',
        attrs: 'data-cutting-summary-action="toggle-kpi-filter" data-kpi-filter="PENDING_WAREHOUSE"',
        active: state.activeKpiFilter === 'PENDING_WAREHOUSE',
        accentClass: 'text-sky-600',
        variant: 'kpi',
      }),
    ].join(''),
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
            placeholder="生产单号 / 裁片任务号 / 裁片单号 / 面料 SKU"
            data-cutting-summary-field="keyword"
          />
        </label>
        ${renderFilterSelect('紧急程度', 'urgencyLevel', state.filters.urgencyLevel, [
          { value: 'ALL', label: '全部' },
          { value: 'AA', label: 'AA 紧急' },
          { value: 'A', label: 'A 紧急' },
          { value: 'B', label: 'B 紧急' },
          { value: 'C', label: 'C 优先' },
          { value: 'D', label: 'D 常规' },
        ])}
        ${renderFilterSelect('总结状态', 'summaryStatus', state.filters.summaryStatus, [
          { value: 'ALL', label: '全部' },
          { value: 'PENDING_PREP_CLOSURE', label: '待配料收口' },
          { value: 'PENDING_EXECUTION_CLOSURE', label: '待执行收口' },
          { value: 'PENDING_REPLENISHMENT', label: '待补料处理' },
          { value: 'PENDING_WAREHOUSE_HANDOVER', label: '待入仓交接' },
          { value: 'PENDING_SAMPLE_RETURN', label: '待样衣归还' },
          { value: 'DONE_PENDING_REVIEW', label: '已完成待核查' },
          { value: 'CLOSED', label: '已收口' },
        ])}
        ${renderFilterSelect('风险等级', 'riskLevel', state.filters.riskLevel, [
          { value: 'ALL', label: '全部' },
          { value: 'HIGH', label: '高风险' },
          { value: 'MEDIUM', label: '中风险' },
          { value: 'LOW', label: '低风险' },
        ])}
        ${renderFilterSelect('问题来源', 'issueSource', state.filters.issueSource, [
          { value: 'ALL', label: '全部' },
          { value: 'PREP', label: '配料领料' },
          { value: 'EXECUTION', label: '裁片执行' },
          { value: 'REPLENISHMENT', label: '补料' },
          { value: 'WAREHOUSE', label: '仓库' },
          { value: 'SAMPLE', label: '样衣' },
        ])}
        ${renderFilterSelect('仅看待核查', 'pendingOnly', state.filters.pendingOnly, [
          { value: 'ALL', label: '全部' },
          { value: 'PENDING_ONLY', label: '仅看待核查' },
        ])}
      </div>
  `)
}

function renderEmptyState(text: string): string {
  return `
    <div class="rounded-lg border border-dashed bg-card px-6 py-10 text-center">
      <p class="text-sm text-muted-foreground">${escapeHtml(text)}</p>
    </div>
  `
}

function renderActiveStateBar(): string {
  const chips: string[] = []
  const priorityLabel = getPriorityModeLabel(state.activePriorityMode)
  const kpiLabel = getKpiFilterLabel(state.activeKpiFilter)

  if (priorityLabel) {
    chips.push(renderWorkbenchFilterChip(priorityLabel, 'data-cutting-summary-action="clear-priority-mode"', 'amber'))
  }
  if (kpiLabel) {
    chips.push(renderWorkbenchFilterChip(kpiLabel, 'data-cutting-summary-action="clear-kpi-filter"', 'blue'))
  }

  return renderWorkbenchStateBar({
    summary: '当前主表视图',
    chips,
    clearAttrs: 'data-cutting-summary-action="clear-view-state"',
  })
}

function renderMainTable(): string {
  const records = getDisplayRecords()
  const hasFilters = hasSummaryFilters(state.filters) || state.activePriorityMode !== null || state.activeKpiFilter !== null
  const pagination = paginateItems(records, state.page, state.pageSize)

  if (records.length === 0) {
    return renderEmptyState(buildEmptyStateText(hasFilters, 'records'))
  }

  return `
    <section class="overflow-hidden rounded-lg border bg-card">
      <div class="border-b px-4 py-3">
        <div class="flex items-center justify-between gap-3">
          <div>
            <h2 class="text-base font-semibold text-foreground">生产单汇总主表</h2>
            <p class="mt-0.5 text-xs text-muted-foreground">收口状态与回源入口一屏查看。</p>
          </div>
          <span class="text-sm text-muted-foreground">共 ${pagination.total} 条汇总</span>
        </div>
      </div>
      ${renderStickyTableScroller(`
        <table class="min-w-full divide-y divide-border text-sm">
          <thead class="sticky top-0 z-10 bg-muted/95 text-left text-muted-foreground backdrop-blur">
            <tr>
              <th class="px-4 py-3 font-medium">紧急程度</th>
              <th class="px-4 py-3 font-medium">生产单号</th>
              <th class="px-4 py-3 font-medium">采购日期</th>
              <th class="px-4 py-3 font-medium">下单数量</th>
              <th class="px-4 py-3 font-medium">裁片单数</th>
              <th class="px-4 py-3 font-medium">配料 / 领料摘要</th>
              <th class="px-4 py-3 font-medium">执行摘要</th>
              <th class="px-4 py-3 font-medium">补料摘要</th>
              <th class="px-4 py-3 font-medium">仓库 / 样衣摘要</th>
              <th class="px-4 py-3 font-medium">风险 / 问题数</th>
              <th class="px-4 py-3 font-medium">当前总结状态</th>
              <th class="px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            ${pagination.items
              .map((record) => {
                const pickupSummary = buildCuttingSummaryPickupView(record.productionOrderNo)
                return `
                  <tr class="align-top">
                    <td class="px-4 py-3">${renderBadge(urgencyMeta[record.urgencyLevel].label, urgencyMeta[record.urgencyLevel].className)}</td>
                    <td class="px-4 py-3">
                      <button class="font-medium text-blue-600 hover:underline" data-cutting-summary-action="open-detail" data-record-id="${record.id}">
                        ${escapeHtml(record.productionOrderNo)}
                      </button>
                      <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(record.cuttingTaskNo)}</p>
                    </td>
                    <td class="px-4 py-3 text-muted-foreground">${escapeHtml(record.purchaseDate)}</td>
                    <td class="px-4 py-3 font-medium text-foreground">${record.orderQty.toLocaleString('zh-CN')}</td>
                    <td class="px-4 py-3">${record.cutPieceOrderCount}</td>
                    <td class="px-4 py-3">
                      <p class="font-medium text-foreground">${escapeHtml(buildMaterialReceiveText(record))}</p>
                      <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(pickupSummary.materialReceiveSummaryText)}</p>
                    </td>
                    <td class="px-4 py-3">
                      <p class="font-medium text-foreground">${escapeHtml(buildExecutionText(record))}</p>
                      <p class="mt-1 text-xs text-muted-foreground">最近铺布：${escapeHtml(formatDateTime(record.spreadingSummary.latestSpreadingAt))}</p>
                    </td>
                    <td class="px-4 py-3">
                      <p class="font-medium text-foreground">${escapeHtml(buildReplenishmentText(record))}</p>
                      <p class="mt-1 text-xs text-muted-foreground">已通过 ${record.replenishmentSummary.approvedCount} · 待补充说明 ${record.replenishmentSummary.needMoreInfoCount}</p>
                    </td>
                    <td class="px-4 py-3">
                      <p class="font-medium text-foreground">${escapeHtml(buildWarehouseSampleText(record))}</p>
                      <p class="mt-1 text-xs text-muted-foreground">样衣可调用 ${record.sampleSummary.sampleAvailableCount} · 超期 ${record.sampleSummary.overdueReturnCount}</p>
                    </td>
                    <td class="px-4 py-3">
                      <div class="flex flex-wrap gap-2">
                        ${renderBadge(riskLevelMeta[record.overallRiskLevel].label, riskLevelMeta[record.overallRiskLevel].className)}
                        <span class="text-xs text-muted-foreground">${escapeHtml(buildIssueSummaryText(record))}</span>
                      </div>
                    </td>
                    <td class="px-4 py-3">${renderBadge(summaryStatusMeta[record.overallSummaryStatus].label, summaryStatusMeta[record.overallSummaryStatus].className)}</td>
                    <td class="px-4 py-3">
                      <div class="flex flex-wrap gap-2">
                        <button class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-cutting-summary-action="open-detail" data-record-id="${record.id}">查看总结详情</button>
                        <button class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-cutting-summary-action="go-order-progress">去订单进度</button>
                        <button class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-cutting-summary-action="go-material-prep">去仓库配料</button>
                        <button class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-cutting-summary-action="go-cut-piece-orders">去裁片单</button>
                        <button class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-cutting-summary-action="go-replenishment">去补料管理</button>
                        <button class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-cutting-summary-action="go-warehouse-management">去仓库管理</button>
                      </div>
                    </td>
                  </tr>
                `
              })
              .join('')}
          </tbody>
        </table>
      `, 'max-h-[58vh]')}
      ${renderWorkbenchPagination({
        page: pagination.page,
        pageSize: pagination.pageSize,
        total: pagination.total,
        actionAttr: 'data-cutting-summary-action',
        pageAction: 'set-page',
        pageSizeAttr: 'data-cutting-summary-page-size',
      })}
    </section>
  `
}

function renderDetailDrawer(): string {
  if (state.activeOverlay !== 'detail') return ''
  const record = getActiveRecord()
  if (!record) return ''
  const pickupSummary = buildCuttingSummaryPickupView(record.productionOrderNo)

  return uiDrawer(
    {
      title: '生产单裁剪总结详情',
      subtitle: '按生产单汇总配料、执行、补料、仓库和样衣的收口情况。',
      closeAction: { prefix: 'cutting-summary', action: 'close-overlay' },
      width: 'lg',
    },
    `
      <div class="space-y-5 text-sm">
        <section class="grid gap-4 rounded-lg border p-4 md:grid-cols-2">
          <div>
            <p class="text-xs text-muted-foreground">生产单号</p>
            <p class="mt-1 font-medium text-foreground">${escapeHtml(record.productionOrderNo)}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">采购日期 / 计划发货日期</p>
            <p class="mt-1 font-medium text-foreground">${escapeHtml(record.purchaseDate)} / ${escapeHtml(record.plannedShipDate)}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">下单数量</p>
            <p class="mt-1 font-medium text-foreground">${record.orderQty.toLocaleString('zh-CN')}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">紧急程度</p>
            <p class="mt-1">${renderBadge(urgencyMeta[record.urgencyLevel].label, urgencyMeta[record.urgencyLevel].className)}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">裁片任务号</p>
            <p class="mt-1 font-medium text-foreground">${escapeHtml(record.cuttingTaskNo)}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">当前分配工厂 / 最近更新时间</p>
            <p class="mt-1 font-medium text-foreground">${escapeHtml(record.assignedFactoryName)} / ${escapeHtml(formatDateTime(record.lastUpdatedAt))}</p>
            <p class="mt-1 text-xs text-muted-foreground">更新来源：${escapeHtml(updatedSourceMeta[record.lastUpdatedSource])}</p>
          </div>
        </section>

        <section class="rounded-lg border p-4">
          <h3 class="font-semibold text-foreground">配料与领料汇总</h3>
          <div class="mt-4 grid gap-4 md:grid-cols-3">
            <div>
              <p class="text-xs text-muted-foreground">裁片单 / 面料种类</p>
              <p class="mt-1 font-medium text-foreground">${record.cutPieceOrderCount} / ${record.materialTypeCount}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">已配置 / 部分配置</p>
              <p class="mt-1 font-medium text-foreground">${record.materialSummary.fullyConfiguredCount} / ${record.materialSummary.partiallyConfiguredCount}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">已打印领料单 / 二维码</p>
              <p class="mt-1 font-medium text-foreground">${pickupSummary.printedSlipCount} / ${pickupSummary.qrGeneratedCount}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">领料成功 / 部分领料</p>
              <p class="mt-1 font-medium text-foreground">${pickupSummary.receiveSuccessCount} / ${record.receiveSummary.receivedPartialCount}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">待复核 / 已提交照片</p>
              <p class="mt-1 font-medium text-foreground">${pickupSummary.recheckRequiredCount} / ${pickupSummary.photoSubmittedCount}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">最近一次领料</p>
              <p class="mt-1 font-medium text-foreground">${pickupSummary.latestReceiveAt !== '-' ? escapeHtml(formatDateTime(pickupSummary.latestReceiveAt)) : '-'} ${pickupSummary.latestReceiveBy !== '-' ? ` / ${escapeHtml(pickupSummary.latestReceiveBy)}` : ''}</p>
            </div>
          </div>
        </section>

        <section class="rounded-lg border p-4">
          <h3 class="font-semibold text-foreground">裁片执行汇总</h3>
          <div class="mt-4 grid gap-4 md:grid-cols-3">
            <div>
              <p class="text-xs text-muted-foreground">唛架已维护 / 待维护</p>
              <p class="mt-1 font-medium text-foreground">${record.markerSummary.markerMaintainedCount} / ${record.markerSummary.pendingMarkerCount}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">唛架图已上传</p>
              <p class="mt-1 font-medium text-foreground">${record.markerSummary.markerImageUploadedCount}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">铺布记录数量</p>
              <p class="mt-1 font-medium text-foreground">${record.spreadingSummary.spreadingRecordCount}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">铺布总长度</p>
              <p class="mt-1 font-medium text-foreground">${record.spreadingSummary.totalSpreadLength.toFixed(1)} m</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">最近一次铺布录入</p>
              <p class="mt-1 font-medium text-foreground">${escapeHtml(formatDateTime(record.spreadingSummary.latestSpreadingAt))} ${record.spreadingSummary.latestSpreadingBy ? ` / ${escapeHtml(record.spreadingSummary.latestSpreadingBy)}` : ''}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">当前执行阶段说明</p>
              <p class="mt-1 font-medium text-foreground">${escapeHtml(record.platformStageSummary)}</p>
            </div>
          </div>
        </section>

        <section class="rounded-lg border p-4">
          <h3 class="font-semibold text-foreground">补料汇总</h3>
          <div class="mt-4 grid gap-4 md:grid-cols-3">
            <div>
              <p class="text-xs text-muted-foreground">补料建议总数</p>
              <p class="mt-1 font-medium text-foreground">${record.replenishmentSummary.suggestionCount}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">待审核 / 已通过</p>
              <p class="mt-1 font-medium text-foreground">${record.replenishmentSummary.pendingReviewCount} / ${record.replenishmentSummary.approvedCount}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">已驳回 / 待补充说明</p>
              <p class="mt-1 font-medium text-foreground">${record.replenishmentSummary.rejectedCount} / ${record.replenishmentSummary.needMoreInfoCount}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">高风险补料数量</p>
              <p class="mt-1 font-medium text-foreground">${record.replenishmentSummary.highRiskCount}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">可能影响印花 / 染色</p>
              <p class="mt-1 font-medium text-foreground">${record.replenishmentSummary.mayAffectPrintingCount} / ${record.replenishmentSummary.mayAffectDyeingCount}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">当前总结状态</p>
              <p class="mt-1">${renderBadge(summaryStatusMeta[record.overallSummaryStatus].label, summaryStatusMeta[record.overallSummaryStatus].className)}</p>
            </div>
          </div>
        </section>

        <section class="rounded-lg border p-4">
          <h3 class="font-semibold text-foreground">仓库与样衣汇总</h3>
          <div class="mt-4 grid gap-4 md:grid-cols-3">
            <div>
              <p class="text-xs text-muted-foreground">待入仓 / 已入仓</p>
              <p class="mt-1 font-medium text-foreground">${record.warehouseSummary.cutPiecePendingInboundCount} / ${record.warehouseSummary.cutPieceInboundedCount}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">未分配区域 / 待发后道</p>
              <p class="mt-1 font-medium text-foreground">${record.warehouseSummary.unassignedZoneCount} / ${record.warehouseSummary.waitingHandoverCount}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">最近一次入仓</p>
              <p class="mt-1 font-medium text-foreground">${escapeHtml(formatDateTime(record.warehouseSummary.latestInboundAt))} ${record.warehouseSummary.latestInboundBy ? ` / ${escapeHtml(record.warehouseSummary.latestInboundBy)}` : ''}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">样衣使用中 / 待归还</p>
              <p class="mt-1 font-medium text-foreground">${record.sampleSummary.sampleInUseCount} / ${record.sampleSummary.sampleWaitingReturnCount}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">样衣可调用 / 超期风险</p>
              <p class="mt-1 font-medium text-foreground">${record.sampleSummary.sampleAvailableCount} / ${record.sampleSummary.overdueReturnCount}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">最近一次样衣动作</p>
              <p class="mt-1 font-medium text-foreground">${escapeHtml(formatDateTime(record.sampleSummary.latestSampleActionAt))} ${record.sampleSummary.latestSampleActionBy ? ` / ${escapeHtml(record.sampleSummary.latestSampleActionBy)}` : ''}</p>
            </div>
          </div>
        </section>

        <section class="rounded-lg border p-4">
          <div class="flex items-center justify-between gap-3">
            <h3 class="font-semibold text-foreground">问题清单</h3>
            <button class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-cutting-summary-action="open-issues" data-record-id="${record.id}">查看完整问题清单</button>
          </div>
          <div class="mt-4 space-y-3">
            ${
              record.issues.length === 0
                ? '<p class="text-sm text-muted-foreground">当前没有待核查问题，生产单已接近收口完成。</p>'
                : record.issues
                    .slice(0, 3)
                    .map(
                      (issue) => `
                        <article class="rounded-lg border bg-muted/20 p-4">
                          <div class="flex flex-wrap items-center gap-2">
                            ${renderBadge(riskLevelMeta[issue.level].label, riskLevelMeta[issue.level].className)}
                            ${renderBadge(issueSourceMeta[issue.sourcePage].shortLabel, 'bg-slate-100 text-slate-700')}
                          </div>
                          <h4 class="mt-3 font-medium text-foreground">${escapeHtml(issue.title)}</h4>
                          <p class="mt-2 text-sm text-muted-foreground">${escapeHtml(issue.description)}</p>
                          <p class="mt-2 text-xs text-muted-foreground">建议动作：${escapeHtml(issue.suggestedAction)}</p>
                        </article>
                      `,
                    )
                    .join('')
            }
          </div>
        </section>

        <section class="rounded-lg border p-4">
          <h3 class="font-semibold text-foreground">平台关注提示</h3>
          <div class="mt-4 flex flex-wrap gap-2">
            ${record.replenishmentSummary.mayAffectPrintingCount > 0 ? renderBadge('建议印花侧关注', 'bg-fuchsia-50 text-fuchsia-700') : ''}
            ${record.replenishmentSummary.mayAffectDyeingCount > 0 ? renderBadge('建议染色侧关注', 'bg-sky-50 text-sky-700') : ''}
            ${record.receiveSummary.receiveDiscrepancyCount > 0 ? renderBadge('建议平台异常跟进', 'bg-rose-50 text-rose-700') : ''}
            ${record.overallRiskLevel === 'HIGH' ? renderBadge('建议质量 / 扣款关注', 'bg-amber-50 text-amber-700') : ''}
            ${record.issueFlags.length === 0 ? '<span class="text-sm text-muted-foreground">当前没有额外平台关注提示。</span>' : ''}
          </div>
          <p class="mt-3 text-sm text-muted-foreground">${escapeHtml(record.note)}</p>
        </section>

        <section class="rounded-lg border p-4">
          <h3 class="font-semibold text-foreground">快捷入口区</h3>
          <div class="mt-4 flex flex-wrap gap-2">
            <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-summary-action="go-order-progress">去订单进度</button>
            <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-summary-action="go-material-prep">去仓库配料</button>
            <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-summary-action="go-cut-piece-orders">去裁片单</button>
            <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-summary-action="go-replenishment">去补料管理</button>
            <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-summary-action="go-warehouse-management">去仓库管理</button>
          </div>
        </section>
      </div>
    `,
    {
      cancel: { prefix: 'cutting-summary', action: 'close-overlay', label: '关闭' },
    },
  )
}

function renderIssuesDrawer(): string {
  if (state.activeOverlay !== 'issues') return ''
  const record = getActiveRecord()
  if (!record) return ''

  return uiDrawer(
    {
      title: '问题清单',
      subtitle: '聚合当前生产单尚未收口的问题、来源页面和建议动作。',
      closeAction: { prefix: 'cutting-summary', action: 'close-overlay' },
      width: 'md',
    },
    `
      <div class="space-y-4 text-sm">
        <section class="rounded-lg border bg-muted/20 p-4">
          <p class="text-xs text-muted-foreground">生产单号</p>
          <p class="mt-1 font-medium text-foreground">${escapeHtml(record.productionOrderNo)}</p>
          <p class="mt-2 text-muted-foreground">${escapeHtml(buildIssueSummaryText(record))}</p>
        </section>
        ${
          record.issues.length === 0
            ? '<p class="rounded-lg border border-dashed px-4 py-8 text-center text-muted-foreground">当前没有待核查问题。</p>'
            : record.issues
                .map(
                  (issue) => `
                    <article class="rounded-lg border p-4">
                      <div class="flex flex-wrap items-center gap-2">
                        ${renderBadge(riskLevelMeta[issue.level].label, riskLevelMeta[issue.level].className)}
                        ${renderBadge(issueSourceMeta[issue.sourcePage].label, 'bg-slate-100 text-slate-700')}
                      </div>
                      <h3 class="mt-3 font-semibold text-foreground">${escapeHtml(issue.title)}</h3>
                      <p class="mt-2 text-muted-foreground">${escapeHtml(issue.description)}</p>
                      <p class="mt-3 text-xs text-muted-foreground">建议动作：${escapeHtml(issue.suggestedAction)}</p>
                      <div class="mt-4 flex flex-wrap gap-2">
                        <button class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-cutting-summary-action="go-route" data-route="${issue.suggestedRoute}">去对应页面</button>
                      </div>
                    </article>
                  `,
                )
                .join('')
        }
      </div>
    `,
    {
      cancel: { prefix: 'cutting-summary', action: 'close-overlay', label: '关闭' },
    },
  )
}

export function renderCraftCuttingSummaryPage(): string {
  return `
    <div class="space-y-2.5 p-4">
      ${renderPageHeader()}
      ${renderShortcutCardZone()}
      ${renderFilterSection()}
      ${renderActiveStateBar()}
      ${renderMainTable()}
      ${renderDetailDrawer()}
      ${renderIssuesDrawer()}
    </div>
  `
}

export function handleCraftCuttingSummaryEvent(target: Element): boolean {
  const pageSizeNode = target.closest<HTMLElement>('[data-cutting-summary-page-size]')
  if (pageSizeNode) {
    const select = pageSizeNode as HTMLSelectElement
    const nextPageSize = Number(select.value)
    if (!Number.isFinite(nextPageSize)) return false
    state.page = 1
    state.pageSize = nextPageSize
    return true
  }

  const fieldNode = target.closest<HTMLElement>('[data-cutting-summary-field]')
  if (fieldNode) {
    const field = fieldNode.dataset.cuttingSummaryField as keyof CuttingSummaryFilters | undefined
    if (!field) return false
    const input = fieldNode as HTMLInputElement | HTMLSelectElement
    state.filters = {
      ...state.filters,
      [field]: input.value,
    }
    resetPagination()
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-cutting-summary-action]')
  const action = actionNode?.dataset.cuttingSummaryAction
  if (!action) return false

  const recordId = actionNode?.dataset.recordId ?? ''
  const route = actionNode?.dataset.route ?? ''

  if (action === 'open-detail' && recordId) {
    openOverlay('detail', recordId)
    return true
  }

  if (action === 'open-issues' && recordId) {
    openOverlay('issues', recordId)
    return true
  }

  if (action === 'close-overlay') {
    closeOverlay()
    return true
  }

  if (action === 'toggle-priority-mode') {
    const mode = actionNode?.dataset.priorityMode as CuttingSummaryPriorityMode | undefined
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
    const filter = actionNode?.dataset.kpiFilter as CuttingSummaryKpiFilter | undefined
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
    resetPagination()
    return true
  }

  if (action === 'set-page') {
    const page = Number(actionNode?.dataset.page)
    if (!Number.isFinite(page)) return false
    state.page = page
    return true
  }

  if (action === 'go-route' && route) {
    navigateTo(route)
    return true
  }

  if (action === 'go-order-progress') {
    navigateTo('/fcs/craft/cutting/order-progress')
    return true
  }

  if (action === 'go-material-prep') {
    navigateTo('/fcs/craft/cutting/material-prep')
    return true
  }

  if (action === 'go-cut-piece-orders') {
    navigateTo('/fcs/craft/cutting/cut-piece-orders')
    return true
  }

  if (action === 'go-replenishment') {
    navigateTo('/fcs/craft/cutting/replenishment')
    return true
  }

  if (action === 'go-warehouse-management') {
    navigateTo('/fcs/craft/cutting/warehouse-management')
    return true
  }

  return false
}

export function isCraftCuttingSummaryDialogOpen(): boolean {
  return state.activeOverlay !== null
}
