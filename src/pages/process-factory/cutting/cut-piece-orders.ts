import { renderDialog as uiDialog, renderDrawer as uiDrawer, renderFormDrawer as uiFormDrawer } from '../../../components/ui'
import {
  cloneCutPieceOrderRecords,
  type CutPieceMarkerInfo,
  type CutPieceOrderFilters,
  type CutPieceOrderRecord,
  type CutPieceSpreadingRecord,
} from '../../../data/fcs/cutting/cut-piece-orders'
import { buildCutPieceOrderPickupView } from '../../../domain/pickup/page-adapters/pcs-cut-piece-orders'
import { appStore } from '../../../state/store'
import { escapeHtml, formatDateTime } from '../../../utils'
import {
  buildConfigReceiveSummary,
  buildCutPieceOrderSummary,
  buildEmptyStateText,
  buildLinkedDocSummary,
  buildMarkerMixSummary,
  buildMarkerSummary,
  buildRiskFlags,
  buildSpreadingSummary,
  calculateMarkerTotalPieces,
  configReceiveMeta,
  deriveInboundStatus,
  deriveMarkerStatus,
  deriveSpreadingStatus,
  discrepancyStatusMeta,
  filterCutPieceOrders,
  formatLength,
  formatQty,
  inboundStatusMeta,
  linkedDocTypeMeta,
  markerImageStatusMeta,
  markerStatusMeta,
  materialTypeMeta,
  riskMeta,
  sizeLabelMap,
  spreadingStatusMeta,
  totalSpreadingLength,
} from './cut-piece-orders.helpers'
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

type OverlayType = 'detail' | 'marker' | 'spreading' | 'qr' | 'docs'
type SizeCode = CutPieceMarkerInfo['sizeMix'][number]['size']
type CutPiecePriorityMode = 'FOLLOW_UP' | 'EXECUTION_RISK'
type CutPieceKpiFilter = 'PENDING_MARKER' | 'UPLOADED_MARKER' | 'PENDING_SPREAD' | 'SPREAD_DONE' | 'REPLENISHMENT_RISK' | 'PENDING_INBOUND'

interface CutPieceOrdersState {
  records: CutPieceOrderRecord[]
  filters: CutPieceOrderFilters
  activeOverlay: OverlayType | null
  activeRecordId: string | null
  activePriorityMode: CutPiecePriorityMode | null
  activeKpiFilter: CutPieceKpiFilter | null
  page: number
  pageSize: number
  markerDraft: {
    sizeMix: Record<SizeCode, string>
    netLength: string
    perPieceConsumption: string
    markerImageStatus: CutPieceMarkerInfo['markerImageStatus']
    markerImageName: string
  }
  spreadingDraft: {
    fabricRollNo: string
    layerCount: string
    actualSpreadLength: string
    headLength: string
    tailLength: string
    note: string
  }
}

const initialFilters: CutPieceOrderFilters = {
  keyword: '',
  materialType: 'ALL',
  markerStatus: 'ALL',
  spreadingStatus: 'ALL',
  replenishmentRisk: 'ALL',
  inboundStatus: 'ALL',
}

const SIZE_ORDER: SizeCode[] = ['S', 'M', 'L', 'XL', '2XL', 'onesize', 'onesizeplus']

const FIELD_TO_FILTER_KEY = {
  keyword: 'keyword',
  materialType: 'materialType',
  markerStatus: 'markerStatus',
  spreadingStatus: 'spreadingStatus',
  replenishmentRisk: 'replenishmentRisk',
  inboundStatus: 'inboundStatus',
} as const

const state: CutPieceOrdersState = {
  records: cloneCutPieceOrderRecords(),
  filters: { ...initialFilters },
  activeOverlay: null,
  activeRecordId: null,
  activePriorityMode: null,
  activeKpiFilter: null,
  page: 1,
  pageSize: 20,
  markerDraft: createEmptyMarkerDraft(),
  spreadingDraft: createEmptySpreadingDraft(),
}

function createEmptyMarkerDraft(): CutPieceOrdersState['markerDraft'] {
  return {
    sizeMix: {
      S: '',
      M: '',
      L: '',
      XL: '',
      '2XL': '',
      onesize: '',
      onesizeplus: '',
    },
    netLength: '',
    perPieceConsumption: '',
    markerImageStatus: 'NOT_UPLOADED',
    markerImageName: '',
  }
}

function createEmptySpreadingDraft(): CutPieceOrdersState['spreadingDraft'] {
  return {
    fabricRollNo: '',
    layerCount: '',
    actualSpreadLength: '',
    headLength: '',
    tailLength: '',
    note: '',
  }
}

function getFilteredRecords(): CutPieceOrderRecord[] {
  return filterCutPieceOrders(state.records, state.filters)
}

function resetPagination(): void {
  state.page = 1
}

function applyPriorityMode(records: CutPieceOrderRecord[]): CutPieceOrderRecord[] {
  if (state.activePriorityMode === 'FOLLOW_UP') {
    return records.filter((record) => deriveMarkerStatus(record) !== 'UPLOADED' || deriveSpreadingStatus(record) === 'NOT_SPREAD' || !record.hasInboundRecord)
  }
  if (state.activePriorityMode === 'EXECUTION_RISK') {
    return records.filter((record) => buildRiskFlags(record).length > 0)
  }
  return records
}

function applyKpiFilter(records: CutPieceOrderRecord[]): CutPieceOrderRecord[] {
  switch (state.activeKpiFilter) {
    case 'PENDING_MARKER':
      return records.filter((record) => deriveMarkerStatus(record) === 'NOT_MAINTAINED')
    case 'UPLOADED_MARKER':
      return records.filter((record) => record.markerInfo.markerImageStatus === 'UPLOADED')
    case 'PENDING_SPREAD':
      return records.filter((record) => record.spreadingRecords.length === 0)
    case 'SPREAD_DONE':
      return records.filter((record) => record.spreadingRecords.length > 0)
    case 'REPLENISHMENT_RISK':
      return records.filter((record) => record.hasReplenishmentRisk)
    case 'PENDING_INBOUND':
      return records.filter((record) => !record.hasInboundRecord)
    default:
      return records
  }
}

function getDisplayRecords(): CutPieceOrderRecord[] {
  return applyKpiFilter(applyPriorityMode(getFilteredRecords()))
}

function findRecord(recordId: string | null): CutPieceOrderRecord | null {
  if (!recordId) return null
  return state.records.find((item) => item.id === recordId) ?? null
}

function getActiveRecord(): CutPieceOrderRecord | null {
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
      <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-cutting-piece-field="${field}">
        ${options
          .map((option) => `<option value="${escapeHtml(option.value)}" ${option.value === value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`)
          .join('')}
      </select>
    </label>
  `
}

function renderPageHeader(): string {
  return `
    <header class="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p class="mb-1 text-sm text-muted-foreground">工艺工厂运营系统 / 裁片管理</p>
        <h1 class="text-xl font-bold">裁片单</h1>
        <p class="mt-0.5 text-xs text-muted-foreground">裁片单主表优先。</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" data-cutting-piece-action="go-material-prep">去仓库配料</button>
        <button class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" data-cutting-piece-action="go-replenishment">去补料管理</button>
      </div>
    </header>
  `
}

function getPriorityModeLabel(mode: CutPiecePriorityMode | null): string | null {
  if (mode === 'FOLLOW_UP') return '重点模式：待维护 / 待铺布 / 待入仓'
  if (mode === 'EXECUTION_RISK') return '重点模式：补料风险 / 执行异常'
  return null
}

function getKpiFilterLabel(filter: CutPieceKpiFilter | null): string | null {
  if (filter === 'PENDING_MARKER') return 'KPI：待维护唛架信息'
  if (filter === 'UPLOADED_MARKER') return 'KPI：已上传唛架图'
  if (filter === 'PENDING_SPREAD') return 'KPI：待铺布'
  if (filter === 'SPREAD_DONE') return 'KPI：已有铺布记录'
  if (filter === 'REPLENISHMENT_RISK') return 'KPI：待补料'
  if (filter === 'PENDING_INBOUND') return 'KPI：待入仓'
  return null
}

function renderShortcutCardZone(records: CutPieceOrderRecord[]): string {
  const followUpCount = records.filter((record) => deriveMarkerStatus(record) !== 'UPLOADED' || deriveSpreadingStatus(record) === 'NOT_SPREAD' || !record.hasInboundRecord).length
  const riskCount = records.filter((record) => buildRiskFlags(record).length > 0).length
  const summary = buildCutPieceOrderSummary(getFilteredRecords())
  return renderWorkbenchShortcutZone({
    columnsClass: 'grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8',
    cardsHtml: [
      renderWorkbenchActionCard({
        title: '待跟进裁片单',
        count: followUpCount,
        hint: '',
        attrs: 'data-cutting-piece-action="toggle-priority-mode" data-priority-mode="FOLLOW_UP"',
        active: state.activePriorityMode === 'FOLLOW_UP',
        variant: 'priority',
      }),
      renderWorkbenchActionCard({
        title: '补料与执行风险',
        count: riskCount,
        hint: '',
        attrs: 'data-cutting-piece-action="toggle-priority-mode" data-priority-mode="EXECUTION_RISK"',
        active: state.activePriorityMode === 'EXECUTION_RISK',
        accentClass: 'text-rose-600',
        variant: 'priority',
      }),
      renderWorkbenchActionCard({
        title: '待维护唛架',
        count: summary.pendingMarkerCount,
        hint: '',
        attrs: 'data-cutting-piece-action="toggle-kpi-filter" data-kpi-filter="PENDING_MARKER"',
        active: state.activeKpiFilter === 'PENDING_MARKER',
        accentClass: 'text-slate-900',
        variant: 'kpi',
      }),
      renderWorkbenchActionCard({
        title: '已上传唛架图',
        count: summary.uploadedMarkerCount,
        hint: '',
        attrs: 'data-cutting-piece-action="toggle-kpi-filter" data-kpi-filter="UPLOADED_MARKER"',
        active: state.activeKpiFilter === 'UPLOADED_MARKER',
        accentClass: 'text-emerald-600',
        variant: 'kpi',
      }),
      renderWorkbenchActionCard({
        title: '待铺布',
        count: summary.pendingSpreadCount,
        hint: '',
        attrs: 'data-cutting-piece-action="toggle-kpi-filter" data-kpi-filter="PENDING_SPREAD"',
        active: state.activeKpiFilter === 'PENDING_SPREAD',
        accentClass: 'text-slate-900',
        variant: 'kpi',
      }),
      renderWorkbenchActionCard({
        title: '已有铺布',
        count: summary.spreadDoneCount,
        hint: '',
        attrs: 'data-cutting-piece-action="toggle-kpi-filter" data-kpi-filter="SPREAD_DONE"',
        active: state.activeKpiFilter === 'SPREAD_DONE',
        accentClass: 'text-sky-600',
        variant: 'kpi',
      }),
      renderWorkbenchActionCard({
        title: '待补料',
        count: summary.replenishmentRiskCount,
        hint: '',
        attrs: 'data-cutting-piece-action="toggle-kpi-filter" data-kpi-filter="REPLENISHMENT_RISK"',
        active: state.activeKpiFilter === 'REPLENISHMENT_RISK',
        accentClass: 'text-rose-600',
        variant: 'kpi',
      }),
      renderWorkbenchActionCard({
        title: '待入仓',
        count: summary.pendingInboundCount,
        hint: '',
        attrs: 'data-cutting-piece-action="toggle-kpi-filter" data-kpi-filter="PENDING_INBOUND"',
        active: state.activeKpiFilter === 'PENDING_INBOUND',
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
    chips.push(renderWorkbenchFilterChip(priorityLabel, 'data-cutting-piece-action="clear-priority-mode"', 'amber'))
  }
  if (kpiLabel) {
    chips.push(renderWorkbenchFilterChip(kpiLabel, 'data-cutting-piece-action="clear-kpi-filter"', 'blue'))
  }
  return renderWorkbenchStateBar({
    summary: '当前主表视图',
    chips,
    clearAttrs: 'data-cutting-piece-action="clear-view-state"',
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
            placeholder="生产单号 / 裁片单号 / 面料 SKU"
            data-cutting-piece-field="keyword"
          />
        </label>
        ${renderFilterSelect('面料类型', 'materialType', state.filters.materialType, [
          { value: 'ALL', label: '全部' },
          { value: 'PRINT', label: '印花面料' },
          { value: 'DYE', label: '染色面料' },
          { value: 'SOLID', label: '净色面料' },
          { value: 'LINING', label: '里布' },
        ])}
        ${renderFilterSelect('唛架状态', 'markerStatus', state.filters.markerStatus, [
          { value: 'ALL', label: '全部' },
          { value: 'NOT_MAINTAINED', label: '待维护' },
          { value: 'MAINTAINED', label: '已维护' },
          { value: 'UPLOADED', label: '已上传唛架图' },
        ])}
        ${renderFilterSelect('铺布状态', 'spreadingStatus', state.filters.spreadingStatus, [
          { value: 'ALL', label: '全部' },
          { value: 'NOT_SPREAD', label: '未铺布' },
          { value: 'SPREAD', label: '已铺布' },
        ])}
        ${renderFilterSelect('补料风险', 'replenishmentRisk', state.filters.replenishmentRisk, [
          { value: 'ALL', label: '全部' },
          { value: 'RISK_ONLY', label: '仅看待补料' },
        ])}
        ${renderFilterSelect('入仓状态', 'inboundStatus', state.filters.inboundStatus, [
          { value: 'ALL', label: '全部' },
          { value: 'NOT_INBOUND', label: '未入仓' },
          { value: 'INBOUND', label: '已入仓' },
        ])}
      </div>
  `)
}

function renderFocusSection(records: CutPieceOrderRecord[]): string {
  const focusRecords = records.filter((record) => deriveMarkerStatus(record) !== 'UPLOADED' || deriveSpreadingStatus(record) === 'NOT_SPREAD').slice(0, 4)
  return renderWorkbenchSecondaryPanel({
    title: '待跟进裁片单',
    hint: '优先处理待维护唛架、待铺布和待补料的裁片单。',
    countText: `${focusRecords.length} 条待跟进`,
    body: `
      <div class="divide-y">
        ${
          focusRecords.length
            ? focusRecords
                .map((record) => `
                  <div class="flex items-center justify-between gap-4 px-4 py-3">
                    <div class="min-w-0">
                      <div class="flex flex-wrap items-center gap-2">
                        <button class="font-medium text-blue-600 hover:underline" data-cutting-piece-action="open-detail" data-record-id="${record.id}">${escapeHtml(record.cutPieceOrderNo)}</button>
                        ${renderBadge(materialTypeMeta[record.materialType].label, materialTypeMeta[record.materialType].className)}
                        ${renderBadge(markerStatusMeta[deriveMarkerStatus(record)].label, markerStatusMeta[deriveMarkerStatus(record)].className)}
                      </div>
                      <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(record.productionOrderNo)} · ${escapeHtml(record.materialSku)} · ${escapeHtml(record.currentStage)}</p>
                      <div class="mt-2 flex flex-wrap gap-2">
                        ${buildRiskFlags(record).slice(0, 3).map((flag) => renderBadge(riskMeta[flag].label, riskMeta[flag].className)).join('')}
                      </div>
                    </div>
                    <button class="shrink-0 rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-piece-action="open-marker" data-record-id="${record.id}">编辑唛架</button>
                  </div>
                `)
                .join('')
            : '<div class="px-4 py-8 text-center text-sm text-muted-foreground">当前筛选范围内暂无需要重点跟进的裁片单。</div>'
        }
      </div>
    `,
  })
}

function renderRiskSection(records: CutPieceOrderRecord[]): string {
  const riskRecords = records.filter((record) => buildRiskFlags(record).length > 0).slice(0, 5)
  return renderWorkbenchSecondaryPanel({
    title: '补料与执行风险',
    hint: '结合领料差异、唛架图状态和铺布记录，提前识别待补料风险。',
    countText: `${riskRecords.length} 条风险`,
    body: `
      <div class="divide-y">
        ${
          riskRecords.length
            ? riskRecords
                .map((record) => `
                  <div class="px-4 py-3">
                    <div class="flex items-center justify-between gap-4">
                      <div>
                        <div class="flex flex-wrap items-center gap-2">
                          <button class="font-medium text-blue-600 hover:underline" data-cutting-piece-action="open-detail" data-record-id="${record.id}">${escapeHtml(record.cutPieceOrderNo)}</button>
                          ${renderBadge(discrepancyStatusMeta[record.discrepancyStatus].label, discrepancyStatusMeta[record.discrepancyStatus].className)}
                        </div>
                        <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(record.notes)}</p>
                      </div>
                      <button class="shrink-0 rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-piece-action="go-replenishment">去补料管理</button>
                    </div>
                  </div>
                `)
                .join('')
            : '<div class="px-4 py-8 text-center text-sm text-muted-foreground">当前筛选范围内暂无需要补料跟进的风险提示。</div>'
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
        <h2 class="text-base font-semibold text-foreground">暂无匹配的裁片单</h2>
        <p class="mt-2 text-sm text-muted-foreground">${escapeHtml(buildEmptyStateText(state.filters))}</p>
      </section>
    `
  }

  return `
    <section class="rounded-lg border bg-card">
      <div class="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 class="text-base font-semibold">裁片单主表</h2>
          <p class="mt-0.5 text-xs text-muted-foreground">唛架、铺布、入仓一屏查看。</p>
        </div>
        <div class="text-sm text-muted-foreground">共 ${pagination.total} 张裁片单</div>
      </div>
      ${renderStickyTableScroller(
        `
        <table class="w-full min-w-[1280px] text-sm">
          <thead class="sticky top-0 z-10 border-b bg-muted/95 text-muted-foreground backdrop-blur">
            <tr>
              <th class="px-4 py-3 text-left font-medium">裁片单号</th>
              <th class="px-4 py-3 text-left font-medium">生产单号</th>
              <th class="px-4 py-3 text-left font-medium">面料 SKU</th>
              <th class="px-4 py-3 text-left font-medium">面料类型</th>
              <th class="px-4 py-3 text-left font-medium">配置 / 领料状态</th>
              <th class="px-4 py-3 text-left font-medium">唛架状态</th>
              <th class="px-4 py-3 text-left font-medium">铺布记录</th>
              <th class="px-4 py-3 text-left font-medium">补料风险</th>
              <th class="px-4 py-3 text-left font-medium">当前阶段</th>
              <th class="px-4 py-3 text-left font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            ${pagination.items
              .map((record) => {
                const pickupView = buildCutPieceOrderPickupView(record)
                const markerStatus = deriveMarkerStatus(record)
                const spreadingStatus = deriveSpreadingStatus(record)
                const riskFlags = buildRiskFlags(record)
                return `
                  <tr class="border-b last:border-b-0 hover:bg-muted/20">
                    <td class="px-4 py-3 align-top">
                      <button class="font-medium text-blue-600 hover:underline" data-cutting-piece-action="open-detail" data-record-id="${record.id}">
                        ${escapeHtml(record.cutPieceOrderNo)}
                      </button>
                      <div class="mt-1 text-xs text-muted-foreground">领料单：${escapeHtml(pickupView.pickupSlipNo)}</div>
                      <div class="mt-1 text-xs text-muted-foreground">二维码：${pickupView.qrStatus === 'GENERATED' ? escapeHtml(pickupView.qrCodeValue) : '未生成'}</div>
                    </td>
                    <td class="px-4 py-3 align-top">
                      <div class="font-medium text-foreground">${escapeHtml(record.productionOrderNo)}</div>
                      <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(record.assignedFactoryName)}</div>
                    </td>
                    <td class="px-4 py-3 align-top">
                      <div class="font-medium text-foreground">${escapeHtml(record.materialSku)}</div>
                      <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(record.materialLabel)}</div>
                    </td>
                    <td class="px-4 py-3 align-top">${renderBadge(materialTypeMeta[record.materialType].label, materialTypeMeta[record.materialType].className)}</td>
                    <td class="px-4 py-3 align-top">
                      <div>${renderBadge(configReceiveMeta[record.configStatus].label, configReceiveMeta[record.configStatus].className)}</div>
                      <div class="mt-1">${renderBadge(record.receiveStatus === 'PARTIAL' ? configReceiveMeta.RECEIVED_PARTIAL.label : configReceiveMeta[record.receiveStatus].label, record.receiveStatus === 'PARTIAL' ? configReceiveMeta.RECEIVED_PARTIAL.className : configReceiveMeta[record.receiveStatus].className)}</div>
                      <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(buildConfigReceiveSummary(record))}</div>
                      <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(pickupView.latestResultLabel)} · ${escapeHtml(pickupView.receiptStatusLabel)}</div>
                    </td>
                    <td class="px-4 py-3 align-top">
                      ${renderBadge(markerStatusMeta[markerStatus].label, markerStatusMeta[markerStatus].className)}
                      <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(buildMarkerSummary(record))}</div>
                    </td>
                    <td class="px-4 py-3 align-top">
                      ${renderBadge(spreadingStatusMeta[spreadingStatus].label, spreadingStatusMeta[spreadingStatus].className)}
                      <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(buildSpreadingSummary(record))}</div>
                    </td>
                    <td class="px-4 py-3 align-top">
                      <div class="flex flex-wrap gap-1">
                        ${
                          riskFlags.length
                            ? riskFlags.slice(0, 3).map((flag) => renderBadge(riskMeta[flag].label, riskMeta[flag].className)).join('')
                            : '<span class="text-xs text-muted-foreground">无风险</span>'
                        }
                      </div>
                    </td>
                    <td class="px-4 py-3 align-top">
                      <span class="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">${escapeHtml(record.currentStage)}</span>
                    </td>
                    <td class="px-4 py-3 align-top">
                      <div class="flex flex-wrap gap-2 text-xs">
                        <button class="rounded-md border px-2.5 py-1.5 hover:bg-muted" data-cutting-piece-action="open-detail" data-record-id="${record.id}">查看详情</button>
                        <button class="rounded-md border px-2.5 py-1.5 hover:bg-muted" data-cutting-piece-action="open-marker" data-record-id="${record.id}">编辑唛架</button>
                        <button class="rounded-md border px-2.5 py-1.5 hover:bg-muted" data-cutting-piece-action="open-spreading" data-record-id="${record.id}">查看 / 新增铺布</button>
                        <button class="rounded-md border px-2.5 py-1.5 hover:bg-muted" data-cutting-piece-action="open-qr" data-record-id="${record.id}">查看二维码</button>
                        <button class="rounded-md border px-2.5 py-1.5 hover:bg-muted" data-cutting-piece-action="open-docs" data-record-id="${record.id}">查看关联单据</button>
                      </div>
                    </td>
                  </tr>
                `
              })
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
        actionAttr: 'data-cutting-piece-action',
        pageAction: 'set-page',
        pageSizeAttr: 'data-cutting-piece-page-size',
      })}
    </section>
  `
}

function renderSizeMixGrid(sizeMix: CutPieceMarkerInfo['sizeMix']): string {
  return `
    <div class="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
      ${sizeMix
        .map(
          (item) => `
            <div class="rounded-lg border bg-muted/20 px-3 py-2 text-sm">
              <div class="text-xs text-muted-foreground">${escapeHtml(sizeLabelMap[item.size])}</div>
              <div class="mt-1 font-medium text-foreground">${formatQty(item.qty)}</div>
            </div>
          `,
        )
        .join('')}
    </div>
  `
}

function renderDetailDrawer(): string {
  if (state.activeOverlay !== 'detail') return ''
  const record = getActiveRecord()
  if (!record) return ''
  const pickupView = buildCutPieceOrderPickupView(record)
  const riskFlags = buildRiskFlags(record)
  return uiDrawer(
    {
      title: '裁片单详情',
      subtitle: `${record.cutPieceOrderNo} · ${record.materialSku}`,
      closeAction: { prefix: 'cutting-piece', action: 'close-overlay' },
      width: 'lg',
    },
    `
      <div class="space-y-6">
        <section class="grid gap-4 rounded-lg border bg-muted/20 p-4 md:grid-cols-2 xl:grid-cols-4">
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
            <p class="text-xs text-muted-foreground">裁片任务号</p>
            <p class="mt-1 font-medium text-foreground">${escapeHtml(record.cuttingTaskNo)}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">当前分配工厂</p>
            <p class="mt-1 font-medium text-foreground">${escapeHtml(record.assignedFactoryName)}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">计划发货日期</p>
            <p class="mt-1 font-medium text-foreground">${escapeHtml(record.plannedShipDate)}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">当前阶段</p>
            <p class="mt-1 font-medium text-foreground">${escapeHtml(record.currentStage)}</p>
          </div>
        </section>

        <section class="rounded-lg border p-4">
          <h3 class="text-sm font-semibold text-foreground">状态摘要</h3>
          <div class="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div>${renderBadge(configReceiveMeta[record.configStatus].label, configReceiveMeta[record.configStatus].className)}</div>
            <div>${renderBadge(record.receiveStatus === 'PARTIAL' ? configReceiveMeta.RECEIVED_PARTIAL.label : configReceiveMeta[record.receiveStatus].label, record.receiveStatus === 'PARTIAL' ? configReceiveMeta.RECEIVED_PARTIAL.className : configReceiveMeta[record.receiveStatus].className)}</div>
            <div>${renderBadge(pickupView.printSlipStatusLabel, pickupView.printSlipStatus === 'PRINTED' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700')}</div>
            <div>${renderBadge(pickupView.qrStatusLabel, pickupView.qrStatus === 'GENERATED' ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-700')}</div>
          </div>
          <div class="mt-4 grid gap-3 text-sm text-muted-foreground md:grid-cols-2 xl:grid-cols-3">
            <p>领料单号 / 最新打印版本：<span class="font-medium text-foreground">${escapeHtml(pickupView.pickupSlipNo)} / ${escapeHtml(pickupView.latestPrintVersionNo)}</span></p>
            <p>扫码回执 / 结果：<span class="font-medium text-foreground">${escapeHtml(pickupView.receiptStatusLabel)} / ${escapeHtml(pickupView.latestResultLabel)}</span></p>
            <p>照片凭证 / 是否复核：<span class="font-medium text-foreground">${pickupView.hasPhotoEvidence ? '有' : '无'} / ${pickupView.needsRecheck ? '需复核' : '无需复核'}</span></p>
            <p>最近一次领料时间：<span class="font-medium text-foreground">${pickupView.latestScannedAt !== '-' ? escapeHtml(formatDateTime(pickupView.latestScannedAt)) : '暂无回写'}</span></p>
            <p>最近一次铺布录入：<span class="font-medium text-foreground">${record.latestSpreadingAt ? escapeHtml(formatDateTime(record.latestSpreadingAt)) : '暂无铺布'}</span></p>
            <p>入仓状态：<span class="font-medium text-foreground">${inboundStatusMeta[deriveInboundStatus(record)].label}</span></p>
          </div>
        </section>

        <section class="rounded-lg border p-4">
          <div class="flex items-center justify-between gap-3">
            <h3 class="text-sm font-semibold text-foreground">唛架信息</h3>
            <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-piece-action="open-marker" data-record-id="${record.id}">编辑唛架</button>
          </div>
          <div class="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <p class="text-xs text-muted-foreground">尺码配比</p>
              <p class="mt-1 text-sm text-foreground">${escapeHtml(buildMarkerMixSummary(record.markerInfo) || '尚未维护尺码配比')}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">唛架图状态</p>
              <div class="mt-1">${renderBadge(markerImageStatusMeta[record.markerInfo.markerImageStatus].label, markerImageStatusMeta[record.markerInfo.markerImageStatus].className)}</div>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">唛架总件数</p>
              <p class="mt-1 font-medium text-foreground">${formatQty(record.markerInfo.totalPieces)}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">唛架净长度 / 单件用量</p>
              <p class="mt-1 font-medium text-foreground">${formatLength(record.markerInfo.netLength)} / ${record.markerInfo.perPieceConsumption.toFixed(3)} 米</p>
            </div>
          </div>
        </section>

        <section class="rounded-lg border p-4">
          <div class="flex items-center justify-between gap-3">
            <h3 class="text-sm font-semibold text-foreground">铺布记录</h3>
            <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-piece-action="open-spreading" data-record-id="${record.id}">查看 / 新增铺布记录</button>
          </div>
          ${
            record.spreadingRecords.length
              ? `
                <div class="mt-4 space-y-3">
                  ${record.spreadingRecords
                    .map(
                      (item) => `
                        <article class="rounded-lg border bg-muted/20 p-3 text-sm">
                          <div class="flex items-center justify-between gap-3">
                            <div class="font-medium text-foreground">${escapeHtml(item.recordNo)}</div>
                            <span class="text-xs text-muted-foreground">${escapeHtml(formatDateTime(item.enteredAt))}</span>
                          </div>
                          <div class="mt-2 grid gap-3 text-muted-foreground md:grid-cols-3">
                            <div>布卷号：<span class="font-medium text-foreground">${escapeHtml(item.fabricRollNo)}</span></div>
                            <div>铺布层数：<span class="font-medium text-foreground">${formatQty(item.layerCount)}</span></div>
                            <div>单卷布长度：<span class="font-medium text-foreground">${formatLength(item.calculatedRollLength)}</span></div>
                          </div>
                        </article>
                      `,
                    )
                    .join('')}
                  <p class="text-sm text-muted-foreground">汇总长度：<span class="font-medium text-foreground">${formatLength(totalSpreadingLength(record.spreadingRecords))}</span></p>
                </div>
              `
              : '<div class="mt-4 rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">当前裁片单尚无铺布记录，真实业务建议由工厂端/PDA录入。</div>'
          }
        </section>

        <section class="rounded-lg border p-4">
          <div class="flex items-center justify-between gap-3">
            <h3 class="text-sm font-semibold text-foreground">关联单据</h3>
            <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-piece-action="open-docs" data-record-id="${record.id}">查看关联单据</button>
          </div>
          ${
            record.linkedDocuments.length
              ? `
                <div class="mt-4 grid gap-3">
                  ${record.linkedDocuments
                    .slice(0, 4)
                    .map(
                      (doc) => `
                        <div class="rounded-lg border bg-muted/20 px-3 py-3 text-sm">
                          <div class="flex items-center justify-between gap-3">
                            <span class="font-medium text-foreground">${escapeHtml(linkedDocTypeMeta[doc.docType])}</span>
                            <span class="text-xs text-muted-foreground">${escapeHtml(doc.status)}</span>
                          </div>
                          <p class="mt-1 text-muted-foreground">${escapeHtml(doc.docNo)} · ${escapeHtml(doc.summaryText)}</p>
                        </div>
                      `,
                    )
                    .join('')}
                </div>
              `
              : '<div class="mt-4 rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">当前裁片单暂无关联单据。</div>'
          }
        </section>

        <section class="rounded-lg border p-4">
          <h3 class="text-sm font-semibold text-foreground">快捷入口区</h3>
          <div class="mt-4 flex flex-wrap gap-2">
            <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-piece-action="go-material-prep">去仓库配料</button>
            <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-piece-action="go-replenishment">去补料管理</button>
            <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-piece-action="open-qr" data-record-id="${record.id}">查看二维码</button>
          </div>
          <div class="mt-4 flex flex-wrap gap-2">
            ${buildRiskFlags(record).map((flag) => renderBadge(riskMeta[flag].label, riskMeta[flag].className)).join('') || '<span class="text-sm text-muted-foreground">当前暂无补料或执行风险。</span>'}
          </div>
          <p class="mt-3 text-sm text-muted-foreground">${escapeHtml(record.notes)}</p>
        </section>
      </div>
    `,
    {
      cancel: { prefix: 'cutting-piece', action: 'close-overlay', label: '关闭' },
    },
  )
}

function renderMarkerDrawer(): string {
  if (state.activeOverlay !== 'marker') return ''
  const record = getActiveRecord()
  if (!record) return ''
  const totalPieces = calculateMarkerTotalPieces(
    SIZE_ORDER.map((size) => ({
      size,
      qty: Number(state.markerDraft.sizeMix[size]) || 0,
    })),
  )

  return uiFormDrawer(
    {
      title: '编辑唛架信息',
      subtitle: `${record.cutPieceOrderNo} · ${record.materialSku}`,
      closeAction: { prefix: 'cutting-piece', action: 'close-overlay' },
      submitAction: { prefix: 'cutting-piece', action: 'save-marker', label: '保存唛架信息' },
      width: 'lg',
    },
    `
      <div class="space-y-6">
        <section class="grid gap-4 rounded-lg border bg-muted/20 p-4 md:grid-cols-2">
          <div>
            <p class="text-xs text-muted-foreground">生产单号</p>
            <p class="mt-1 font-medium text-foreground">${escapeHtml(record.productionOrderNo)}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">面料 SKU</p>
            <p class="mt-1 font-medium text-foreground">${escapeHtml(record.materialSku)}</p>
          </div>
        </section>

        <section class="rounded-lg border p-4">
          <h3 class="text-sm font-semibold text-foreground">尺码配比编辑区</h3>
          <div class="mt-4 grid gap-4 md:grid-cols-3 xl:grid-cols-4">
            ${SIZE_ORDER.map(
              (size) => `
                <label class="space-y-2">
                  <span class="text-sm font-medium text-foreground">${escapeHtml(sizeLabelMap[size])}</span>
                  <input
                    type="number"
                    min="0"
                    class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    value="${escapeHtml(state.markerDraft.sizeMix[size])}"
                    data-cutting-piece-marker-field="size:${size}"
                  />
                </label>
              `,
            ).join('')}
          </div>
        </section>

        <section class="grid gap-4 rounded-lg border p-4 md:grid-cols-3">
          <label class="space-y-2">
            <span class="text-sm font-medium text-foreground">唛架净长度（米）</span>
            <input
              type="number"
              min="0"
              step="0.1"
              class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              value="${escapeHtml(state.markerDraft.netLength)}"
              data-cutting-piece-marker-field="netLength"
            />
          </label>
          <label class="space-y-2">
            <span class="text-sm font-medium text-foreground">单件用量（米）</span>
            <input
              type="number"
              min="0"
              step="0.001"
              class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              value="${escapeHtml(state.markerDraft.perPieceConsumption)}"
              data-cutting-piece-marker-field="perPieceConsumption"
            />
          </label>
          <div class="space-y-2 rounded-lg border bg-muted/20 p-3">
            <span class="text-sm font-medium text-foreground">唛架总件数</span>
            <p class="text-2xl font-semibold text-foreground">${formatQty(totalPieces)}</p>
            <p class="text-xs text-muted-foreground">由尺码配比自动计算，不单独手填。</p>
          </div>
        </section>

        <section class="rounded-lg border p-4">
          <div class="flex items-center justify-between gap-3">
            <div>
              <h3 class="text-sm font-semibold text-foreground">唛架图状态区</h3>
              <p class="mt-1 text-sm text-muted-foreground">本步只保留高保真上传位和状态，不接真实文件上传服务。</p>
            </div>
            ${renderBadge(
              markerImageStatusMeta[state.markerDraft.markerImageStatus].label,
              markerImageStatusMeta[state.markerDraft.markerImageStatus].className,
            )}
          </div>
          <div class="mt-4 flex flex-wrap items-center gap-3">
            <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-piece-action="toggle-marker-image">
              ${state.markerDraft.markerImageStatus === 'UPLOADED' ? '移除已上传状态' : '模拟上传唛架图'}
            </button>
            <span class="text-sm text-muted-foreground">
              ${escapeHtml(state.markerDraft.markerImageName || '当前尚未上传唛架图')}
            </span>
          </div>
        </section>
      </div>
    `,
  )
}

function renderSpreadingDrawer(): string {
  if (state.activeOverlay !== 'spreading') return ''
  const record = getActiveRecord()
  if (!record) return ''
  const calculatedRollLength =
    (Number(state.spreadingDraft.actualSpreadLength) || 0) +
    (Number(state.spreadingDraft.headLength) || 0) +
    (Number(state.spreadingDraft.tailLength) || 0)

  return uiFormDrawer(
    {
      title: '铺布记录',
      subtitle: `${record.cutPieceOrderNo} · ${record.materialSku}`,
      closeAction: { prefix: 'cutting-piece', action: 'close-overlay' },
      submitAction: { prefix: 'cutting-piece', action: 'save-spreading', label: '新增铺布记录' },
      width: 'lg',
    },
    `
      <div class="space-y-6">
        <section class="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
          真实业务建议由工厂端 / PDA 录入铺布记录；当前页面用于运营查看和补录演示。
        </section>
        <section class="rounded-lg border p-4">
          <div class="flex items-center justify-between gap-3">
            <h3 class="text-sm font-semibold text-foreground">已有铺布记录</h3>
            <span class="text-sm text-muted-foreground">汇总长度 ${formatLength(totalSpreadingLength(record.spreadingRecords))}</span>
          </div>
          <div class="mt-4 space-y-3">
            ${
              record.spreadingRecords.length
                ? record.spreadingRecords
                    .map(
                      (item) => `
                        <article class="rounded-lg border bg-muted/20 p-3 text-sm">
                          <div class="flex items-center justify-between gap-3">
                            <div class="font-medium text-foreground">${escapeHtml(item.recordNo)}</div>
                            <span class="text-xs text-muted-foreground">${escapeHtml(formatDateTime(item.enteredAt))}</span>
                          </div>
                          <div class="mt-2 grid gap-3 text-muted-foreground md:grid-cols-3">
                            <div>布卷号：<span class="font-medium text-foreground">${escapeHtml(item.fabricRollNo)}</span></div>
                            <div>铺布层数：<span class="font-medium text-foreground">${formatQty(item.layerCount)}</span></div>
                            <div>单卷布长度：<span class="font-medium text-foreground">${formatLength(item.calculatedRollLength)}</span></div>
                            <div>布头长度：<span class="font-medium text-foreground">${formatLength(item.headLength)}</span></div>
                            <div>布尾长度：<span class="font-medium text-foreground">${formatLength(item.tailLength)}</span></div>
                            <div>录入来源：<span class="font-medium text-foreground">${item.sourceType === 'PDA' ? '工厂端 / PDA' : 'PCS 补录'}</span></div>
                          </div>
                          <p class="mt-2 text-muted-foreground">${escapeHtml(item.note)}</p>
                        </article>
                      `,
                    )
                    .join('')
                : '<div class="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">当前裁片单尚无铺布记录。</div>'
            }
          </div>
        </section>

        <section class="rounded-lg border p-4">
          <h3 class="text-sm font-semibold text-foreground">新增铺布记录</h3>
          <div class="mt-4 grid gap-4 md:grid-cols-2">
            <label class="space-y-2">
              <span class="text-sm font-medium text-foreground">布料卷号</span>
              <input class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" value="${escapeHtml(state.spreadingDraft.fabricRollNo)}" data-cutting-piece-spreading-field="fabricRollNo" />
            </label>
            <label class="space-y-2">
              <span class="text-sm font-medium text-foreground">铺布层数</span>
              <input type="number" min="0" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" value="${escapeHtml(state.spreadingDraft.layerCount)}" data-cutting-piece-spreading-field="layerCount" />
            </label>
            <label class="space-y-2">
              <span class="text-sm font-medium text-foreground">铺布实际长度（米）</span>
              <input type="number" min="0" step="0.1" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" value="${escapeHtml(state.spreadingDraft.actualSpreadLength)}" data-cutting-piece-spreading-field="actualSpreadLength" />
            </label>
            <label class="space-y-2">
              <span class="text-sm font-medium text-foreground">布头长度（米）</span>
              <input type="number" min="0" step="0.1" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" value="${escapeHtml(state.spreadingDraft.headLength)}" data-cutting-piece-spreading-field="headLength" />
            </label>
            <label class="space-y-2">
              <span class="text-sm font-medium text-foreground">布尾长度（米）</span>
              <input type="number" min="0" step="0.1" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" value="${escapeHtml(state.spreadingDraft.tailLength)}" data-cutting-piece-spreading-field="tailLength" />
            </label>
            <div class="space-y-2 rounded-lg border bg-muted/20 p-3">
              <span class="text-sm font-medium text-foreground">自动计算单卷布长度</span>
              <p class="text-2xl font-semibold text-foreground">${formatLength(calculatedRollLength)}</p>
              <p class="text-xs text-muted-foreground">按实际长度 + 布头 + 布尾自动计算。</p>
            </div>
          </div>
          <label class="mt-4 block space-y-2">
            <span class="text-sm font-medium text-foreground">备注</span>
            <textarea class="min-h-[88px] w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-cutting-piece-spreading-field="note">${escapeHtml(state.spreadingDraft.note)}</textarea>
          </label>
        </section>
      </div>
    `,
  )
}

function renderQrDialog(): string {
  if (state.activeOverlay !== 'qr') return ''
  const record = getActiveRecord()
  if (!record) return ''
  const pickupView = buildCutPieceOrderPickupView(record)
  return uiDialog(
    {
      title: '裁片单二维码',
      description: '二维码沿用仓库配料页的裁片单编号，不因唛架或铺布动作重新发号。',
      closeAction: { prefix: 'cutting-piece', action: 'close-overlay' },
      width: 'md',
    },
    `
      <div class="space-y-5 text-center">
        <div>
          <p class="text-sm text-muted-foreground">裁片单号</p>
          <p class="mt-1 text-lg font-semibold text-foreground">${escapeHtml(record.cutPieceOrderNo)}</p>
        </div>
        <div class="mx-auto flex h-56 w-56 items-center justify-center rounded-2xl border-2 border-dashed border-muted bg-white text-xs text-muted-foreground">
          ${escapeHtml(pickupView.qrCodeValue)}
        </div>
        <div class="rounded-lg border bg-muted/20 px-4 py-3 text-left text-sm text-muted-foreground">
          <p>二维码编码值：<span class="font-medium text-foreground">${escapeHtml(pickupView.qrCodeValue)}</span></p>
          <p class="mt-2">${pickupView.qrStatus === 'GENERATED' ? '该二维码会贯穿领料、执行、入仓等后续环节。' : '当前尚未配置配料，二维码将在首次有配置后自动生成。'}</p>
          <p class="mt-2">打印状态 / 版本：<span class="font-medium text-foreground">${pickupView.printSlipStatusLabel} / ${escapeHtml(pickupView.latestPrintVersionNo)}</span></p>
          <p class="mt-2">扫码回执：<span class="font-medium text-foreground">${escapeHtml(pickupView.receiptStatusLabel)}</span></p>
        </div>
      </div>
    `,
    `<button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" data-cutting-piece-action="close-overlay">关闭</button>`,
  )
}

function renderDocsDrawer(): string {
  if (state.activeOverlay !== 'docs') return ''
  const record = getActiveRecord()
  if (!record) return ''
  const pickupView = buildCutPieceOrderPickupView(record)
  return uiDrawer(
    {
      title: '关联单据',
      subtitle: `${record.cutPieceOrderNo} · ${buildLinkedDocSummary(record)}`,
      closeAction: { prefix: 'cutting-piece', action: 'close-overlay' },
      width: 'md',
    },
    `
      <div class="space-y-4">
        <section class="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
          <p>领料单号：<span class="font-medium text-foreground">${escapeHtml(pickupView.pickupSlipNo)}</span></p>
          <p class="mt-2">最新打印版本：<span class="font-medium text-foreground">${escapeHtml(pickupView.latestPrintVersionNo)}</span></p>
          <p class="mt-2">扫码结果：<span class="font-medium text-foreground">${escapeHtml(pickupView.latestResultLabel)}</span></p>
          <p class="mt-2">差异凭证：<span class="font-medium text-foreground">${escapeHtml(pickupView.evidenceSummaryText)}</span></p>
        </section>
        ${
          record.linkedDocuments.length
            ? record.linkedDocuments
                .map(
                  (doc) => `
                    <article class="rounded-lg border p-4">
                      <div class="flex items-center justify-between gap-3">
                        <div>
                          <p class="text-sm text-muted-foreground">${escapeHtml(linkedDocTypeMeta[doc.docType])}</p>
                          <h3 class="mt-1 font-medium text-foreground">${escapeHtml(doc.docNo)}</h3>
                        </div>
                        <span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">${escapeHtml(doc.status)}</span>
                      </div>
                      <p class="mt-3 text-sm text-muted-foreground">创建时间：${escapeHtml(doc.createdAt)}</p>
                      <p class="mt-2 text-sm text-muted-foreground">${escapeHtml(doc.summaryText)}</p>
                    </article>
                  `,
                )
                .join('')
            : '<div class="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">当前裁片单暂无关联单据。</div>'
        }
      </div>
    `,
    {
      cancel: { prefix: 'cutting-piece', action: 'close-overlay', label: '关闭' },
    },
  )
}

function openOverlay(type: OverlayType, recordId: string): void {
  state.activeOverlay = type
  state.activeRecordId = recordId

  const record = findRecord(recordId)
  if (!record) return

  if (type === 'marker') {
    state.markerDraft = {
      sizeMix: SIZE_ORDER.reduce<Record<SizeCode, string>>((acc, size) => {
        const item = record.markerInfo.sizeMix.find((entry) => entry.size === size)
        acc[size] = item && item.qty > 0 ? String(item.qty) : ''
        return acc
      }, {} as Record<SizeCode, string>),
      netLength: record.markerInfo.netLength ? String(record.markerInfo.netLength) : '',
      perPieceConsumption: record.markerInfo.perPieceConsumption ? String(record.markerInfo.perPieceConsumption) : '',
      markerImageStatus: record.markerInfo.markerImageStatus,
      markerImageName: record.markerInfo.markerImageName,
    }
  }

  if (type === 'spreading') {
    state.spreadingDraft = createEmptySpreadingDraft()
  }
}

function closeOverlay(): void {
  state.activeOverlay = null
  state.activeRecordId = null
  state.markerDraft = createEmptyMarkerDraft()
  state.spreadingDraft = createEmptySpreadingDraft()
}

function updateRecord(recordId: string, updater: (record: CutPieceOrderRecord) => void): boolean {
  const record = findRecord(recordId)
  if (!record) return false
  updater(record)
  return true
}

function saveMarker(): boolean {
  if (!state.activeRecordId) return false
  return updateRecord(state.activeRecordId, (record) => {
    const sizeMix = SIZE_ORDER.map((size) => ({
      size,
      qty: Math.max(Number(state.markerDraft.sizeMix[size]) || 0, 0),
    }))
    const totalPieces = calculateMarkerTotalPieces(sizeMix)
    record.markerInfo = {
      sizeMix,
      totalPieces,
      netLength: Math.max(Number(state.markerDraft.netLength) || 0, 0),
      perPieceConsumption: Math.max(Number(state.markerDraft.perPieceConsumption) || 0, 0),
      markerImageStatus: state.markerDraft.markerImageStatus,
      markerImageName: state.markerDraft.markerImageStatus === 'UPLOADED' ? state.markerDraft.markerImageName || `${record.cutPieceOrderNo}-marker-updated.png` : '',
      updatedAt: '2026-03-22 16:40',
      updatedBy: '运营录入 许文静',
    }
    record.hasMarkerImage = record.markerInfo.markerImageStatus === 'UPLOADED'
    record.notes = totalPieces > 0 ? `唛架信息已更新，总件数 ${formatQty(totalPieces)}。` : record.notes
    closeOverlay()
  })
}

function toggleMarkerImage(): boolean {
  if (state.activeOverlay !== 'marker') return false
  const nextUploaded = state.markerDraft.markerImageStatus !== 'UPLOADED'
  state.markerDraft = {
    ...state.markerDraft,
    markerImageStatus: nextUploaded ? 'UPLOADED' : 'NOT_UPLOADED',
    markerImageName: nextUploaded ? `${findRecord(state.activeRecordId)?.cutPieceOrderNo || 'marker'}-marker-v3.png` : '',
  }
  return true
}

function createSpreadingRecordNo(record: CutPieceOrderRecord): string {
  return `SPR-${record.cutPieceOrderNo.slice(-8)}-${String(record.spreadingRecords.length + 1).padStart(2, '0')}`
}

function saveSpreading(): boolean {
  if (!state.activeRecordId) return false
  const fabricRollNo = state.spreadingDraft.fabricRollNo.trim()
  const layerCount = Math.max(Number(state.spreadingDraft.layerCount) || 0, 0)
  const actualSpreadLength = Math.max(Number(state.spreadingDraft.actualSpreadLength) || 0, 0)
  const headLength = Math.max(Number(state.spreadingDraft.headLength) || 0, 0)
  const tailLength = Math.max(Number(state.spreadingDraft.tailLength) || 0, 0)
  if (!fabricRollNo || layerCount <= 0 || actualSpreadLength <= 0) return false

  return updateRecord(state.activeRecordId, (record) => {
    const newRecord: CutPieceSpreadingRecord = {
      recordNo: createSpreadingRecordNo(record),
      cutPieceOrderNo: record.cutPieceOrderNo,
      fabricRollNo,
      layerCount,
      actualSpreadLength,
      headLength,
      tailLength,
      calculatedRollLength: actualSpreadLength + headLength + tailLength,
      enteredBy: '运营补录 赵清雅',
      enteredAt: '2026-03-22 17:10',
      sourceType: 'PCS_MOCK',
      note: state.spreadingDraft.note.trim() || 'PCS 页面补录铺布记录。',
    }
    record.spreadingRecords.push(newRecord)
    record.spreadingRecordCount = record.spreadingRecords.length
    record.latestSpreadingAt = newRecord.enteredAt
    record.latestSpreadingBy = newRecord.enteredBy
    if (!record.currentStage.includes('入仓')) {
      record.currentStage = '铺布记录已回写'
    }
    closeOverlay()
  })
}

export function renderCraftCuttingPieceOrdersPage(): string {
  const records = getFilteredRecords()
  return `
    <div class="space-y-2.5 p-4">
      ${renderPageHeader()}
      ${renderShortcutCardZone(records)}
      ${renderFilterSection()}
      ${renderActiveStateBar()}
      ${renderMainTable()}
      ${renderDetailDrawer()}
      ${renderMarkerDrawer()}
      ${renderSpreadingDrawer()}
      ${renderQrDialog()}
      ${renderDocsDrawer()}
    </div>
  `
}

export function handleCraftCuttingPieceOrdersEvent(target: Element): boolean {
  const pageSizeNode = target.closest<HTMLElement>('[data-cutting-piece-page-size]')
  if (pageSizeNode) {
    const input = pageSizeNode as HTMLSelectElement
    state.pageSize = Number(input.value) || 20
    state.page = 1
    return true
  }

  const fieldNode = target.closest<HTMLElement>('[data-cutting-piece-field]')
  if (fieldNode) {
    const field = fieldNode.dataset.cuttingPieceField as keyof typeof FIELD_TO_FILTER_KEY | undefined
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

  const markerFieldNode = target.closest<HTMLElement>('[data-cutting-piece-marker-field]')
  if (markerFieldNode) {
    const field = markerFieldNode.dataset.cuttingPieceMarkerField
    if (!field) return false
    const input = markerFieldNode as HTMLInputElement
    if (field.startsWith('size:')) {
      const size = field.replace('size:', '') as SizeCode
      state.markerDraft = {
        ...state.markerDraft,
        sizeMix: {
          ...state.markerDraft.sizeMix,
          [size]: input.value,
        },
      }
      return true
    }

    if (field === 'netLength' || field === 'perPieceConsumption') {
      state.markerDraft = {
        ...state.markerDraft,
        [field]: input.value,
      }
      return true
    }
  }

  const spreadingFieldNode = target.closest<HTMLElement>('[data-cutting-piece-spreading-field]')
  if (spreadingFieldNode) {
    const field = spreadingFieldNode.dataset.cuttingPieceSpreadingField
    if (!field) return false
    const input = spreadingFieldNode as HTMLInputElement | HTMLTextAreaElement
    state.spreadingDraft = {
      ...state.spreadingDraft,
      [field]: input.value,
    }
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-cutting-piece-action]')
  const action = actionNode?.dataset.cuttingPieceAction
  if (!action) return false

  const recordId = actionNode?.dataset.recordId ?? state.activeRecordId ?? ''

  if (action === 'toggle-priority-mode') {
    const mode = actionNode?.dataset.priorityMode as CutPiecePriorityMode | undefined
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
    const filter = actionNode?.dataset.kpiFilter as CutPieceKpiFilter | undefined
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

  if (action === 'go-material-prep') {
    appStore.navigate('/fcs/craft/cutting/material-prep')
    return true
  }

  if (action === 'go-replenishment') {
    appStore.navigate('/fcs/craft/cutting/replenishment')
    return true
  }

  if (action === 'open-detail' && recordId) {
    openOverlay('detail', recordId)
    return true
  }

  if (action === 'open-marker' && recordId) {
    openOverlay('marker', recordId)
    return true
  }

  if (action === 'open-spreading' && recordId) {
    openOverlay('spreading', recordId)
    return true
  }

  if (action === 'open-qr' && recordId) {
    openOverlay('qr', recordId)
    return true
  }

  if (action === 'open-docs' && recordId) {
    openOverlay('docs', recordId)
    return true
  }

  if (action === 'toggle-marker-image') {
    return toggleMarkerImage()
  }

  if (action === 'save-marker') {
    return saveMarker()
  }

  if (action === 'save-spreading') {
    return saveSpreading()
  }

  if (action === 'close-overlay') {
    closeOverlay()
    return true
  }

  return false
}

export function isCraftCuttingPieceOrdersDialogOpen(): boolean {
  return state.activeOverlay !== null
}
