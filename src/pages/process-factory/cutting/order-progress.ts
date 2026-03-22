import { renderDrawer as uiDrawer } from '../../../components/ui'
import { cuttingOrderProgressRecords } from '../../../data/fcs/cutting/order-progress'
import type { CuttingOrderProgressFilters } from '../../../data/fcs/cutting/types'
import { appStore } from '../../../state/store'
import { escapeHtml, formatDateTime } from '../../../utils'
import {
  buildAuditSummaryText,
  buildConfigSummaryText,
  buildCuttingOrderProgressSummary,
  buildReceiveSummaryText,
  configMeta,
  deriveAuditStatus,
  deriveConfigStatus,
  deriveReceiveStatus,
  filterCuttingOrderProgressRecords,
  formatLength,
  formatQty,
  getPrepFocusRecords,
  getTopRiskRecords,
  materialTypeMeta,
  printSlipMeta,
  qrMeta,
  receiveMeta,
  reviewMeta,
  riskMeta,
  urgencyMeta,
} from './order-progress.helpers'
import {
  paginateItems,
  renderCompactKpiCard,
  renderStickyFilterShell,
  renderStickyTableScroller,
  renderWorkbenchActionCard,
  renderWorkbenchCardLayer,
  renderWorkbenchFilterChip,
  renderWorkbenchPagination,
  renderWorkbenchStateBar,
} from './layout.helpers'

type OrderProgressPriorityMode = 'PREP_FOCUS' | 'RISK_FOCUS'
type OrderProgressKpiFilter = 'PENDING_AUDIT' | 'PARTIAL_CONFIG' | 'PENDING_RECEIVE' | 'RECEIVE_DONE' | 'REPLENISH_PENDING' | 'URGENT'

const FIELD_TO_FILTER_KEY = {
  keyword: 'keyword',
  urgency: 'urgencyLevel',
  audit: 'auditStatus',
  config: 'configStatus',
  receive: 'receiveStatus',
  risk: 'riskFilter',
} as const

interface CuttingOrderProgressState {
  filters: CuttingOrderProgressFilters
  activeDetailId: string | null
  activePriorityMode: OrderProgressPriorityMode | null
  activeKpiFilter: OrderProgressKpiFilter | null
  page: number
  pageSize: number
}

const initialFilters: CuttingOrderProgressFilters = {
  keyword: '',
  urgencyLevel: 'ALL',
  auditStatus: 'ALL',
  configStatus: 'ALL',
  receiveStatus: 'ALL',
  riskFilter: 'ALL',
}

const state: CuttingOrderProgressState = {
  filters: { ...initialFilters },
  activeDetailId: null,
  activePriorityMode: null,
  activeKpiFilter: null,
  page: 1,
  pageSize: 20,
}

function resetPagination(): void {
  state.page = 1
}

function getBaseRecords() {
  return filterCuttingOrderProgressRecords(cuttingOrderProgressRecords, state.filters)
}

function applyPriorityMode(records: typeof cuttingOrderProgressRecords) {
  if (state.activePriorityMode === 'PREP_FOCUS') {
    return records.filter((record) => deriveConfigStatus(record.materialLines) !== 'CONFIGURED' || deriveReceiveStatus(record.materialLines) !== 'RECEIVED')
  }
  if (state.activePriorityMode === 'RISK_FOCUS') {
    return records.filter((record) => record.riskFlags.length > 0)
  }
  return records
}

function applyKpiFilter(records: typeof cuttingOrderProgressRecords) {
  switch (state.activeKpiFilter) {
    case 'PENDING_AUDIT':
      return records.filter((record) => deriveAuditStatus(record.materialLines) === 'PENDING')
    case 'PARTIAL_CONFIG':
      return records.filter((record) => deriveConfigStatus(record.materialLines) === 'PARTIAL')
    case 'PENDING_RECEIVE':
      return records.filter((record) => deriveReceiveStatus(record.materialLines) !== 'RECEIVED')
    case 'RECEIVE_DONE':
      return records.filter((record) => deriveReceiveStatus(record.materialLines) === 'RECEIVED')
    case 'REPLENISH_PENDING':
      return records.filter((record) => record.riskFlags.includes('REPLENISH_PENDING'))
    case 'URGENT':
      return records.filter((record) => record.urgencyLevel === 'AA' || record.urgencyLevel === 'A')
    default:
      return records
  }
}

function getDisplayRecords() {
  return applyKpiFilter(applyPriorityMode(getBaseRecords()))
}

function renderBadge(label: string, className: string): string {
  return `<span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}">${escapeHtml(label)}</span>`
}

function renderSummaryCard(label: string, value: number, hint: string, accentClass: string): string {
  return renderCompactKpiCard(label, value, hint, accentClass)
}

function renderFilterSelect(
  label: string,
  field: keyof typeof FIELD_TO_FILTER_KEY,
  options: Array<{ value: string; label: string }>,
  value: string,
): string {
  return `
    <label class="space-y-2">
      <span class="text-sm font-medium text-foreground">${escapeHtml(label)}</span>
      <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-cutting-progress-field="${field}">
        ${options
          .map((option) => `<option value="${escapeHtml(option.value)}" ${option.value === value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`)
          .join('')}
      </select>
    </label>
  `
}

function getPriorityModeLabel(mode: OrderProgressPriorityMode | null): string | null {
  if (mode === 'PREP_FOCUS') return '重点模式：待跟进生产单'
  if (mode === 'RISK_FOCUS') return '重点模式：风险生产单'
  return null
}

function getKpiFilterLabel(filter: OrderProgressKpiFilter | null): string | null {
  if (filter === 'PENDING_AUDIT') return 'KPI：待审核生产单'
  if (filter === 'PARTIAL_CONFIG') return 'KPI：部分配置生产单'
  if (filter === 'PENDING_RECEIVE') return 'KPI：待领料生产单'
  if (filter === 'RECEIVE_DONE') return 'KPI：领料成功生产单'
  if (filter === 'REPLENISH_PENDING') return 'KPI：待补料生产单'
  if (filter === 'URGENT') return 'KPI：AA / A 紧急生产单'
  return null
}

function renderPriorityCardLayer(): string {
  const baseRecords = getBaseRecords()
  const prepCount = baseRecords.filter((record) => deriveConfigStatus(record.materialLines) !== 'CONFIGURED' || deriveReceiveStatus(record.materialLines) !== 'RECEIVED').length
  const riskCount = baseRecords.filter((record) => record.riskFlags.length > 0).length

  return renderWorkbenchCardLayer({
    title: '高优先级重点入口',
    hint: '先切到重点模式，再在主表里集中处理配料跟进和风险生产单。',
    columnsClass: 'grid gap-3 md:grid-cols-2',
    cardsHtml: [
      renderWorkbenchActionCard({
        title: '配料进展',
        count: prepCount,
        hint: '切到待跟进生产单模式，优先处理待配置和待领料记录。',
        attrs: 'data-cutting-progress-action="toggle-priority-mode" data-priority-mode="PREP_FOCUS"',
        active: state.activePriorityMode === 'PREP_FOCUS',
      }),
      renderWorkbenchActionCard({
        title: '风险提示',
        count: riskCount,
        hint: '切到风险生产单模式，优先处理补料、交期和领料差异风险。',
        attrs: 'data-cutting-progress-action="toggle-priority-mode" data-priority-mode="RISK_FOCUS"',
        active: state.activePriorityMode === 'RISK_FOCUS',
        accentClass: 'text-rose-600',
      }),
    ].join(''),
  })
}

function renderKpiCardLayer(): string {
  const summary = buildCuttingOrderProgressSummary(getBaseRecords())
  return renderWorkbenchCardLayer({
    title: 'KPI 快捷筛选',
    hint: '点击 KPI 在当前重点模式结果上继续筛主表，再次点击同卡片取消。',
    columnsClass: 'grid gap-3 sm:grid-cols-2 xl:grid-cols-6',
    cardsHtml: [
      renderWorkbenchActionCard({
        title: '待审核生产单数',
        count: summary.pendingAuditCount,
        hint: '优先处理上游审核缺口',
        attrs: 'data-cutting-progress-action="toggle-kpi-filter" data-kpi-filter="PENDING_AUDIT"',
        active: state.activeKpiFilter === 'PENDING_AUDIT',
        accentClass: 'text-amber-600',
      }),
      renderWorkbenchActionCard({
        title: '部分配置生产单数',
        count: summary.partialConfigCount,
        hint: '需要继续补齐仓库配料',
        attrs: 'data-cutting-progress-action="toggle-kpi-filter" data-kpi-filter="PARTIAL_CONFIG"',
        active: state.activeKpiFilter === 'PARTIAL_CONFIG',
        accentClass: 'text-orange-600',
      }),
      renderWorkbenchActionCard({
        title: '待领料生产单数',
        count: summary.pendingReceiveCount,
        hint: '含未领料和部分领料',
        attrs: 'data-cutting-progress-action="toggle-kpi-filter" data-kpi-filter="PENDING_RECEIVE"',
        active: state.activeKpiFilter === 'PENDING_RECEIVE',
        accentClass: 'text-slate-700',
      }),
      renderWorkbenchActionCard({
        title: '领料成功生产单数',
        count: summary.receiveDoneCount,
        hint: '可继续推进裁剪或入仓',
        attrs: 'data-cutting-progress-action="toggle-kpi-filter" data-kpi-filter="RECEIVE_DONE"',
        active: state.activeKpiFilter === 'RECEIVE_DONE',
        accentClass: 'text-emerald-600',
      }),
      renderWorkbenchActionCard({
        title: '待补料生产单数',
        count: summary.replenishmentPendingCount,
        hint: '待补料风险需尽快处理',
        attrs: 'data-cutting-progress-action="toggle-kpi-filter" data-kpi-filter="REPLENISH_PENDING"',
        active: state.activeKpiFilter === 'REPLENISH_PENDING',
        accentClass: 'text-fuchsia-600',
      }),
      renderWorkbenchActionCard({
        title: 'AA / A 紧急生产单数',
        count: summary.urgentCount,
        hint: '优先关注临近发货订单',
        attrs: 'data-cutting-progress-action="toggle-kpi-filter" data-kpi-filter="URGENT"',
        active: state.activeKpiFilter === 'URGENT',
        accentClass: 'text-rose-600',
      }),
    ].join(''),
  })
}

function renderActiveStateBar(): string {
  const chips: string[] = []
  const priorityLabel = getPriorityModeLabel(state.activePriorityMode)
  const kpiLabel = getKpiFilterLabel(state.activeKpiFilter)
  if (priorityLabel) {
    chips.push(renderWorkbenchFilterChip(priorityLabel, 'data-cutting-progress-action="clear-priority-mode"', 'amber'))
  }
  if (kpiLabel) {
    chips.push(renderWorkbenchFilterChip(kpiLabel, 'data-cutting-progress-action="clear-kpi-filter"', 'blue'))
  }

  return renderWorkbenchStateBar({
    summary: '当前主表视图',
    chips,
    clearAttrs: 'data-cutting-progress-action="clear-view-state"',
  })
}

function renderOrderProgressTable(): string {
  const records = getDisplayRecords()
  const emptyText =
    state.filters.riskFilter === 'RISK_ONLY'
      ? '当前筛选条件下暂无风险生产单。'
      : '当前筛选条件下暂无匹配的裁片生产单。'
  const pagination = paginateItems(records, state.page, state.pageSize)

  return `
    <section class="rounded-lg border bg-card">
      <div class="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 class="text-sm font-semibold">生产单主表</h2>
          <p class="mt-1 text-xs text-muted-foreground">按生产单聚合查看配料、领料、当前阶段和风险。</p>
        </div>
        <div class="text-xs text-muted-foreground">共 ${pagination.total} 条生产单</div>
      </div>
      ${renderStickyTableScroller(`
        <table class="w-full min-w-[1260px] text-sm">
          <thead class="sticky top-0 z-10 border-b bg-muted/95 text-muted-foreground backdrop-blur">
            <tr>
              <th class="px-4 py-3 text-left font-medium">紧急程度</th>
              <th class="px-4 py-3 text-left font-medium">采购日期</th>
              <th class="px-4 py-3 text-left font-medium">生产单号</th>
              <th class="px-4 py-3 text-left font-medium">下单数量</th>
              <th class="px-4 py-3 text-left font-medium">计划发货日期</th>
              <th class="px-4 py-3 text-left font-medium">面料审核</th>
              <th class="px-4 py-3 text-left font-medium">配料进展</th>
              <th class="px-4 py-3 text-left font-medium">领料进展</th>
              <th class="px-4 py-3 text-left font-medium">裁片单数</th>
              <th class="px-4 py-3 text-left font-medium">当前阶段</th>
              <th class="px-4 py-3 text-left font-medium">风险提示</th>
              <th class="px-4 py-3 text-left font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            ${
              pagination.items.length
                ? pagination.items
                    .map((record) => {
                      const auditStatus = deriveAuditStatus(record.materialLines)
                      const configStatus = deriveConfigStatus(record.materialLines)
                      const receiveStatus = deriveReceiveStatus(record.materialLines)

                      return `
                        <tr class="border-b last:border-b-0 hover:bg-muted/20">
                          <td class="px-4 py-3 align-top">${renderBadge(urgencyMeta[record.urgencyLevel].label, urgencyMeta[record.urgencyLevel].className)}</td>
                          <td class="px-4 py-3 align-top text-sm text-muted-foreground">${escapeHtml(record.purchaseDate)}</td>
                          <td class="px-4 py-3 align-top">
                            <button class="font-medium text-blue-600 hover:underline" data-cutting-progress-action="open-detail" data-record-id="${record.id}">
                              ${escapeHtml(record.productionOrderNo)}
                            </button>
                            <div class="mt-1 text-xs text-muted-foreground">
                              <div>裁片任务号：${escapeHtml(record.cuttingTaskNo)}</div>
                              <div>裁片厂：${escapeHtml(record.assignedFactoryName)}</div>
                            </div>
                          </td>
                          <td class="px-4 py-3 align-top font-medium tabular-nums">${formatQty(record.orderQty)}</td>
                          <td class="px-4 py-3 align-top">${escapeHtml(record.plannedShipDate)}</td>
                          <td class="px-4 py-3 align-top">
                            ${renderBadge(reviewMeta[auditStatus].label, reviewMeta[auditStatus].className)}
                            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(buildAuditSummaryText(record.materialLines))}</div>
                          </td>
                          <td class="px-4 py-3 align-top">
                            ${renderBadge(configMeta[configStatus].label, configMeta[configStatus].className)}
                            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(buildConfigSummaryText(record.materialLines))}</div>
                          </td>
                          <td class="px-4 py-3 align-top">
                            ${renderBadge(receiveMeta[receiveStatus].label, receiveMeta[receiveStatus].className)}
                            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(buildReceiveSummaryText(record.materialLines))}</div>
                          </td>
                          <td class="px-4 py-3 align-top font-medium">${record.materialLines.length}</td>
                          <td class="px-4 py-3 align-top">
                            <span class="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">${escapeHtml(record.cuttingStage)}</span>
                          </td>
                          <td class="px-4 py-3 align-top">
                            <div class="flex flex-wrap gap-1">
                              ${
                                record.riskFlags.length
                                  ? record.riskFlags
                                      .slice(0, 3)
                                      .map((flag) => renderBadge(riskMeta[flag].label, riskMeta[flag].className))
                                      .join('')
                                  : '<span class="text-xs text-muted-foreground">无风险</span>'
                              }
                              ${
                                record.riskFlags.length > 3
                                  ? `<span class="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">+${record.riskFlags.length - 3}</span>`
                                  : ''
                              }
                            </div>
                          </td>
                          <td class="px-4 py-3 align-top">
                            <div class="flex flex-wrap gap-2 text-xs">
                              <button class="rounded-md border px-2.5 py-1 hover:bg-muted" data-cutting-progress-action="open-detail" data-record-id="${record.id}">查看详情</button>
                              <button class="rounded-md border px-2.5 py-1 hover:bg-muted" data-cutting-progress-action="go-material-prep" data-record-id="${record.id}">去仓库配料</button>
                              <button class="rounded-md border px-2.5 py-1 hover:bg-muted" data-cutting-progress-action="go-cut-piece-orders" data-record-id="${record.id}">去裁片单</button>
                            </div>
                          </td>
                        </tr>
                      `
                    })
                    .join('')
                : `<tr><td colspan="12" class="px-6 py-12 text-center text-sm text-muted-foreground">${escapeHtml(emptyText)}</td></tr>`
            }
          </tbody>
        </table>
      `)}
      ${renderWorkbenchPagination({
        page: pagination.page,
        pageSize: pagination.pageSize,
        total: pagination.total,
        actionAttr: 'data-cutting-progress-action',
        pageAction: 'set-page',
        pageSizeAttr: 'data-cutting-progress-page-size',
      })}
    </section>
  `
}

function renderPrepFocusSection(): string {
  const records = getPrepFocusRecords(getFilteredRecords())
  return renderWorkbenchSecondaryPanel({
    title: '配料进展区',
    hint: '优先查看仍在配料、领料中的生产单。',
    countText: `${records.length} 条待跟进`,
    body: `
      <div class="divide-y">
        ${
          records.length
            ? records
                .map((record) => {
                  const configStatus = deriveConfigStatus(record.materialLines)
                  const receiveStatus = deriveReceiveStatus(record.materialLines)
                  return `
                    <div class="flex items-center justify-between gap-4 px-4 py-3">
                      <div class="min-w-0">
                        <div class="flex items-center gap-2">
                          <button class="font-medium text-blue-600 hover:underline" data-cutting-progress-action="open-detail" data-record-id="${record.id}">${escapeHtml(record.productionOrderNo)}</button>
                          ${renderBadge(urgencyMeta[record.urgencyLevel].label, urgencyMeta[record.urgencyLevel].className)}
                        </div>
                        <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(record.assignedFactoryName)} · ${escapeHtml(record.cuttingStage)}</p>
                        <div class="mt-2 flex flex-wrap gap-2">
                          ${renderBadge(configMeta[configStatus].label, configMeta[configStatus].className)}
                          ${renderBadge(receiveMeta[receiveStatus].label, receiveMeta[receiveStatus].className)}
                        </div>
                      </div>
                      <button class="shrink-0 rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-progress-action="go-material-prep" data-record-id="${record.id}">
                        去仓库配料
                      </button>
                    </div>
                  `
                })
                .join('')
            : '<div class="px-4 py-8 text-center text-sm text-muted-foreground">当前筛选范围内暂无需要跟进的配料生产单。</div>'
        }
      </div>
    `,
  })
}

function renderRiskSection(): string {
  const records = getTopRiskRecords(getFilteredRecords())
  return renderWorkbenchSecondaryPanel({
    title: '风险提示区',
    hint: '按紧急程度优先展示当前需要跟进的裁片风险。',
    countText: `${records.length} 条风险`,
    body: `
      <div class="divide-y">
        ${
          records.length
            ? records
                .map((record) => `
                  <div class="px-4 py-3">
                    <div class="flex items-center justify-between gap-4">
                      <div class="min-w-0">
                        <div class="flex items-center gap-2">
                          <button class="font-medium text-blue-600 hover:underline" data-cutting-progress-action="open-detail" data-record-id="${record.id}">${escapeHtml(record.productionOrderNo)}</button>
                          ${renderBadge(urgencyMeta[record.urgencyLevel].label, urgencyMeta[record.urgencyLevel].className)}
                        </div>
                        <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(record.cuttingTaskNo)} · ${escapeHtml(record.assignedFactoryName)}</p>
                      </div>
                      <button class="shrink-0 rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-progress-action="go-cut-piece-orders" data-record-id="${record.id}">
                        去裁片单
                      </button>
                    </div>
                    <div class="mt-3 flex flex-wrap gap-2">
                      ${record.riskFlags.map((flag) => renderBadge(riskMeta[flag].label, riskMeta[flag].className)).join('')}
                    </div>
                  </div>
                `)
                .join('')
            : '<div class="px-4 py-8 text-center text-sm text-muted-foreground">当前筛选范围内暂无风险生产单。</div>'
        }
      </div>
    `,
  })
}

function renderDetailDrawer(): string {
  const record = cuttingOrderProgressRecords.find((item) => item.id === state.activeDetailId)
  if (!record) return ''

  const auditStatus = deriveAuditStatus(record.materialLines)
  const configStatus = deriveConfigStatus(record.materialLines)
  const receiveStatus = deriveReceiveStatus(record.materialLines)

  const content = `
    <div class="space-y-6">
      <section class="grid gap-4 rounded-lg border bg-muted/10 p-4 sm:grid-cols-2">
        <div>
          <p class="text-xs text-muted-foreground">生产单号</p>
          <p class="mt-1 text-sm font-semibold">${escapeHtml(record.productionOrderNo)}</p>
        </div>
        <div>
          <p class="text-xs text-muted-foreground">裁片任务号</p>
          <p class="mt-1 text-sm font-semibold">${escapeHtml(record.cuttingTaskNo)}</p>
        </div>
        <div>
          <p class="text-xs text-muted-foreground">采购日期</p>
          <p class="mt-1 text-sm">${escapeHtml(record.purchaseDate)}</p>
        </div>
        <div>
          <p class="text-xs text-muted-foreground">计划发货日期</p>
          <p class="mt-1 text-sm">${escapeHtml(record.plannedShipDate)}</p>
        </div>
        <div>
          <p class="text-xs text-muted-foreground">下单数量</p>
          <p class="mt-1 text-sm">${formatQty(record.orderQty)}</p>
        </div>
        <div>
          <p class="text-xs text-muted-foreground">当前紧急程度</p>
          <div class="mt-1">${renderBadge(urgencyMeta[record.urgencyLevel].label, urgencyMeta[record.urgencyLevel].className)}</div>
        </div>
        <div>
          <p class="text-xs text-muted-foreground">当前分配工厂 / 裁片厂</p>
          <p class="mt-1 text-sm">${escapeHtml(record.assignedFactoryName)}</p>
        </div>
        <div>
          <p class="text-xs text-muted-foreground">当前订单级裁片阶段</p>
          <p class="mt-1 text-sm">${escapeHtml(record.cuttingStage)}</p>
        </div>
      </section>

      <section class="rounded-lg border bg-card">
        <div class="border-b px-4 py-3">
          <h3 class="text-sm font-semibold">聚合状态</h3>
        </div>
        <div class="grid gap-4 px-4 py-4 sm:grid-cols-3">
          <div>
            <p class="text-xs text-muted-foreground">面料是否审核</p>
            <div class="mt-1 flex items-center gap-2">
              ${renderBadge(reviewMeta[auditStatus].label, reviewMeta[auditStatus].className)}
              <span class="text-xs text-muted-foreground">${escapeHtml(buildAuditSummaryText(record.materialLines))}</span>
            </div>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">配料状态</p>
            <div class="mt-1 flex items-center gap-2">
              ${renderBadge(configMeta[configStatus].label, configMeta[configStatus].className)}
              <span class="text-xs text-muted-foreground">${escapeHtml(buildConfigSummaryText(record.materialLines))}</span>
            </div>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">领料状态</p>
            <div class="mt-1 flex items-center gap-2">
              ${renderBadge(receiveMeta[receiveStatus].label, receiveMeta[receiveStatus].className)}
              <span class="text-xs text-muted-foreground">${escapeHtml(buildReceiveSummaryText(record.materialLines))}</span>
            </div>
          </div>
        </div>
      </section>

      <section class="rounded-lg border bg-card">
        <div class="border-b px-4 py-3">
          <h3 class="text-sm font-semibold">面料进展列表</h3>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full min-w-[980px] text-sm">
            <thead class="border-b bg-muted/30 text-muted-foreground">
              <tr>
                <th class="px-4 py-3 text-left font-medium">裁片单号</th>
                <th class="px-4 py-3 text-left font-medium">面料 SKU</th>
                <th class="px-4 py-3 text-left font-medium">面料类型</th>
                <th class="px-4 py-3 text-left font-medium">审核状态</th>
                <th class="px-4 py-3 text-left font-medium">配料状态</th>
                <th class="px-4 py-3 text-left font-medium">领料状态</th>
                <th class="px-4 py-3 text-left font-medium">打印状态</th>
                <th class="px-4 py-3 text-left font-medium">二维码状态</th>
                <th class="px-4 py-3 text-left font-medium">最新动作说明</th>
              </tr>
            </thead>
            <tbody>
              ${record.materialLines
                .map(
                  (line) => `
                    <tr class="border-b last:border-b-0 align-top">
                      <td class="px-4 py-4">${escapeHtml(line.cutPieceOrderNo)}</td>
                      <td class="px-4 py-4">
                        <div class="font-medium">${escapeHtml(line.materialSku)}</div>
                        <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(line.materialLabel)}</div>
                      </td>
                      <td class="px-4 py-4">${escapeHtml(materialTypeMeta[line.materialType])}</td>
                      <td class="px-4 py-4">${renderBadge(reviewMeta[line.reviewStatus].label, reviewMeta[line.reviewStatus].className)}</td>
                      <td class="px-4 py-4">
                        ${renderBadge(configMeta[line.configStatus].label, configMeta[line.configStatus].className)}
                        <div class="mt-1 text-xs text-muted-foreground">${line.configuredRollCount} 卷 / ${escapeHtml(formatLength(line.configuredLength))}</div>
                      </td>
                      <td class="px-4 py-4">
                        ${renderBadge(receiveMeta[line.receiveStatus].label, receiveMeta[line.receiveStatus].className)}
                        <div class="mt-1 text-xs text-muted-foreground">${line.receivedRollCount} 卷 / ${escapeHtml(formatLength(line.receivedLength))}</div>
                      </td>
                      <td class="px-4 py-4">${renderBadge(printSlipMeta[line.printSlipStatus].label, printSlipMeta[line.printSlipStatus].className)}</td>
                      <td class="px-4 py-4">${renderBadge(qrMeta[line.qrStatus].label, qrMeta[line.qrStatus].className)}</td>
                      <td class="px-4 py-4">
                        <p>${escapeHtml(line.latestActionText)}</p>
                        ${
                          line.issueFlags.length
                            ? `<div class="mt-2 flex flex-wrap gap-1">${line.issueFlags
                                .map((flag) => renderBadge(riskMeta[flag].label, riskMeta[flag].className))
                                .join('')}</div>`
                            : ''
                        }
                      </td>
                    </tr>
                  `,
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </section>

      <section class="grid gap-4 sm:grid-cols-2">
        <article class="rounded-lg border bg-card p-4">
          <h3 class="text-sm font-semibold">风险与备注</h3>
          <div class="mt-3 flex flex-wrap gap-2">
            ${
              record.riskFlags.length
                ? record.riskFlags.map((flag) => renderBadge(riskMeta[flag].label, riskMeta[flag].className)).join('')
                : '<span class="text-sm text-muted-foreground">当前暂无风险标签。</span>'
            }
          </div>
          <dl class="mt-4 space-y-3 text-sm">
            <div class="flex items-start justify-between gap-3">
              <dt class="text-muted-foreground">最近一次领料扫码时间</dt>
              <dd class="text-right">${escapeHtml(formatDateTime(record.lastPickupScanAt))}</dd>
            </div>
            <div class="flex items-start justify-between gap-3">
              <dt class="text-muted-foreground">最近一次现场执行回写时间</dt>
              <dd class="text-right">${escapeHtml(formatDateTime(record.lastFieldUpdateAt))}</dd>
            </div>
            <div class="flex items-start justify-between gap-3">
              <dt class="text-muted-foreground">最近一次操作人</dt>
              <dd class="text-right">${escapeHtml(record.lastOperatorName || '-')}</dd>
            </div>
            <div class="flex items-start justify-between gap-3">
              <dt class="text-muted-foreground">是否已有铺布记录</dt>
              <dd class="text-right">${record.hasSpreadingRecord ? '已记录' : '未记录'}</dd>
            </div>
            <div class="flex items-start justify-between gap-3">
              <dt class="text-muted-foreground">是否已有入仓动作</dt>
              <dd class="text-right">${record.hasInboundRecord ? '已入仓' : '待入仓'}</dd>
            </div>
          </dl>
        </article>

        <article class="rounded-lg border bg-card p-4">
          <h3 class="text-sm font-semibold">快捷入口区</h3>
          <p class="mt-2 text-sm text-muted-foreground">从订单进度直接联动到仓库配料和裁片单，后续继续承接配料详情、裁片单详情与补料管理。</p>
          <div class="mt-4 flex flex-wrap gap-3">
            <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" data-cutting-progress-action="go-material-prep" data-record-id="${record.id}">
              去仓库配料
            </button>
            <button class="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted" data-cutting-progress-action="go-cut-piece-orders" data-record-id="${record.id}">
              去裁片单
            </button>
          </div>
        </article>
      </section>
    </div>
  `

  return uiDrawer(
    {
      title: '生产单裁片进度详情',
      subtitle: `${record.productionOrderNo} · ${record.assignedFactoryName}`,
      closeAction: { prefix: 'cutting-progress', action: 'close-detail' },
      width: 'lg',
    },
    content,
    {
      cancel: { prefix: 'cutting-progress', action: 'close-detail', label: '关闭' },
      extra: `
        <div class="flex items-center gap-3">
          <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-progress-action="go-material-prep" data-record-id="${record.id}">去仓库配料</button>
          <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-progress-action="go-cut-piece-orders" data-record-id="${record.id}">去裁片单</button>
        </div>
      `,
    },
  )
}

export function renderCraftCuttingOrderProgressPage(): string {
  return `
    <div class="space-y-4 p-5">
      <div class="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p class="mb-1 text-sm text-muted-foreground">工艺工厂运营系统 / 裁片管理</p>
          <h1 class="text-2xl font-bold">订单进度</h1>
          <p class="mt-1 text-sm text-muted-foreground">以生产单维度快速定位配料、领料、当前阶段和风险。</p>
        </div>
      </div>

      ${renderPriorityCardLayer()}
      ${renderKpiCardLayer()}

      ${renderStickyFilterShell(`
        <div class="grid gap-4 lg:grid-cols-6">
          <label class="space-y-2 lg:col-span-2">
            <span class="text-sm font-medium text-foreground">关键词</span>
            <input
              type="text"
              value="${escapeHtml(state.filters.keyword)}"
              placeholder="支持生产单号 / 裁片任务号 / 面料 SKU"
              class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              data-cutting-progress-field="keyword"
            />
          </label>
          ${renderFilterSelect('紧急程度', 'urgency', [
            { value: 'ALL', label: '全部' },
            { value: 'AA', label: 'AA 紧急' },
            { value: 'A', label: 'A 紧急' },
            { value: 'B', label: 'B 紧急' },
            { value: 'C', label: 'C 优先' },
            { value: 'D', label: 'D 常规' },
          ], state.filters.urgencyLevel)}
          ${renderFilterSelect('审核状态', 'audit', [
            { value: 'ALL', label: '全部' },
            { value: 'PENDING', label: '待审核' },
            { value: 'PARTIAL', label: '部分审核' },
            { value: 'APPROVED', label: '已审核' },
          ], state.filters.auditStatus)}
          ${renderFilterSelect('配料状态', 'config', [
            { value: 'ALL', label: '全部' },
            { value: 'NOT_CONFIGURED', label: '未配置' },
            { value: 'PARTIAL', label: '部分配置' },
            { value: 'CONFIGURED', label: '已配置' },
          ], state.filters.configStatus)}
          ${renderFilterSelect('领料状态', 'receive', [
            { value: 'ALL', label: '全部' },
            { value: 'NOT_RECEIVED', label: '未领料' },
            { value: 'PARTIAL', label: '部分领料' },
            { value: 'RECEIVED', label: '领料成功' },
          ], state.filters.receiveStatus)}
        </div>
        <div class="mt-4 grid gap-4 lg:grid-cols-[220px_1fr]">
          ${renderFilterSelect('风险筛选', 'risk', [
            { value: 'ALL', label: '全部' },
            { value: 'RISK_ONLY', label: '仅看有风险' },
          ], state.filters.riskFilter)}
          <div class="flex items-end text-xs text-muted-foreground">
            公共筛选会影响顶部卡片计数与主表；重点模式和 KPI 快捷筛选会在此基础上继续收紧主表结果。
          </div>
        </div>
      `)}

      ${renderActiveStateBar()}
      ${renderOrderProgressTable()}

      ${renderDetailDrawer()}
    </div>
  `
}

export function handleCraftCuttingOrderProgressEvent(target: Element): boolean {
  const pageSizeNode = target.closest<HTMLElement>('[data-cutting-progress-page-size]')
  if (pageSizeNode) {
    const input = pageSizeNode as HTMLSelectElement
    state.pageSize = Number(input.value) || 20
    state.page = 1
    return true
  }

  const fieldNode = target.closest<HTMLElement>('[data-cutting-progress-field]')
  if (fieldNode) {
    const field = fieldNode.dataset.cuttingProgressField as keyof typeof FIELD_TO_FILTER_KEY | undefined
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

  const actionNode = target.closest<HTMLElement>('[data-cutting-progress-action]')
  const action = actionNode?.dataset.cuttingProgressAction
  if (!action) return false

  if (action === 'open-detail') {
    state.activeDetailId = actionNode?.dataset.recordId ?? null
    return true
  }

  if (action === 'toggle-priority-mode') {
    const mode = actionNode?.dataset.priorityMode as OrderProgressPriorityMode | undefined
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
    const filter = actionNode?.dataset.kpiFilter as OrderProgressKpiFilter | undefined
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

  if (action === 'close-detail') {
    state.activeDetailId = null
    return true
  }

  if (action === 'go-material-prep') {
    appStore.navigate('/fcs/craft/cutting/material-prep')
    return true
  }

  if (action === 'go-cut-piece-orders') {
    appStore.navigate('/fcs/craft/cutting/cut-piece-orders')
    return true
  }

  return false
}

export function isCraftCuttingOrderProgressDialogOpen(): boolean {
  return state.activeDetailId !== null
}
