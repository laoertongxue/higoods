import { renderDrawer as uiDrawer, renderFormDrawer as uiFormDrawer } from '../../../components/ui'
import {
  cloneWarehouseManagementData,
  type CutPieceWarehouseRecord,
  type CutPieceZoneCode,
  type CuttingFabricStockRecord,
  type SampleWarehouseRecord,
  type WarehouseManagementFilters,
} from '../../../data/fcs/cutting/warehouse-management'
import { appStore } from '../../../state/store'
import { escapeHtml, formatDateTime } from '../../../utils'
import {
  alertLevelMeta,
  buildCutPieceSummary,
  buildFabricSummary,
  buildSampleSummary,
  buildWarehouseEmptyText,
  buildWarehouseSummary,
  filterCutPieceWarehouseRecords,
  filterCuttingFabricStocks,
  filterSampleWarehouseRecords,
  formatLength,
  formatQty,
  handoverStatusMeta,
  hasCutPieceFilters,
  hasFabricFilters,
  hasSampleFilters,
  inboundStatusMeta,
  materialTypeMeta,
  sampleStageMeta,
  sampleStatusMeta,
  sortAlerts,
  stockStatusMeta,
  zoneMeta,
} from './warehouse-management.helpers'
import {
  paginateItems,
  renderStickyFilterShell,
  renderStickyTableScroller,
  renderWorkbenchActionCard,
  renderWorkbenchFilterChip,
  renderWorkbenchPagination,
  renderWorkbenchSecondaryPanel,
  renderWorkbenchStateBar,
  renderWorkbenchShortcutZone,
} from './layout.helpers'

type WarehouseTab = 'fabric' | 'cutPiece' | 'sample'
type OverlayType = 'stock-detail' | 'location-guide' | 'sample-flow'
type WarehousePriorityMode = 'FABRIC_RECHECK' | 'UNASSIGNED_ZONE' | 'SAMPLE_RETURN' | 'WAITING_HANDOVER'
type WarehouseKpiFilter = 'FABRIC_RECHECK' | 'PENDING_INBOUND' | 'INBOUNDED' | 'UNASSIGNED_ZONE' | 'WAITING_RETURN' | 'WAITING_HANDOVER'

interface WarehouseManagementState {
  fabricStocks: CuttingFabricStockRecord[]
  cutPieceRecords: CutPieceWarehouseRecord[]
  sampleRecords: SampleWarehouseRecord[]
  alerts: ReturnType<typeof cloneWarehouseManagementData>['alerts']
  activeTab: WarehouseTab
  filters: WarehouseManagementFilters
  activePriorityMode: WarehousePriorityMode | null
  activeKpiFilter: WarehouseKpiFilter | null
  activeOverlay: OverlayType | null
  activeRecordId: string | null
  pagination: Record<WarehouseTab, { page: number; pageSize: number }>
  locationDraft: {
    zoneCode: CutPieceZoneCode
    locationLabel: string
    note: string
  }
  sampleDraft: {
    note: string
  }
}

const initialFilters: WarehouseManagementFilters = {
  cuttingFabric: {
    keyword: '',
    materialType: 'ALL',
    stockStatus: 'ALL',
  },
  cutPiece: {
    keyword: '',
    zoneCode: 'ALL',
    inboundStatus: 'ALL',
    handoverStatus: 'ALL',
  },
  sample: {
    keyword: '',
    stage: 'ALL',
    status: 'ALL',
  },
}

const initialData = cloneWarehouseManagementData()

const state: WarehouseManagementState = {
  ...initialData,
  activeTab: 'fabric',
  filters: { ...initialFilters },
  activePriorityMode: null,
  activeKpiFilter: null,
  activeOverlay: null,
  activeRecordId: null,
  pagination: {
    fabric: { page: 1, pageSize: 20 },
    cutPiece: { page: 1, pageSize: 20 },
    sample: { page: 1, pageSize: 20 },
  },
  locationDraft: {
    zoneCode: 'A',
    locationLabel: '',
    note: '',
  },
  sampleDraft: {
    note: '',
  },
}

function renderBadge(label: string, className: string): string {
  return `<span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}">${escapeHtml(label)}</span>`
}

function renderFilterSelect(
  label: string,
  scope: 'fabric' | 'cutPiece' | 'sample',
  field: string,
  value: string,
  options: Array<{ value: string; label: string }>,
): string {
  return `
    <label class="space-y-2">
      <span class="text-sm font-medium text-foreground">${escapeHtml(label)}</span>
      <select
        class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        data-cutting-warehouse-scope="${scope}"
        data-cutting-warehouse-field="${field}"
      >
        ${options
          .map((option) => `<option value="${escapeHtml(option.value)}" ${option.value === value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`)
          .join('')}
      </select>
    </label>
  `
}

function getFilteredFabricStocks(): CuttingFabricStockRecord[] {
  return filterCuttingFabricStocks(state.fabricStocks, state.filters.cuttingFabric)
}

function getFilteredCutPieceRecords(): CutPieceWarehouseRecord[] {
  return filterCutPieceWarehouseRecords(state.cutPieceRecords, state.filters.cutPiece)
}

function getFilteredSampleRecords(): SampleWarehouseRecord[] {
  return filterSampleWarehouseRecords(state.sampleRecords, state.filters.sample)
}

function resetPagination(tab: WarehouseTab = state.activeTab): void {
  state.pagination = {
    ...state.pagination,
    [tab]: {
      ...state.pagination[tab],
      page: 1,
    },
  }
}

function setActiveTabWithReset(tab: WarehouseTab): void {
  state.activeTab = tab
  resetPagination(tab)
}

function applyPriorityModeForFabric(records: CuttingFabricStockRecord[]): CuttingFabricStockRecord[] {
  if (state.activePriorityMode === 'FABRIC_RECHECK') return records.filter((record) => record.stockStatus === 'NEED_RECHECK')
  return records
}

function applyPriorityModeForCutPiece(records: CutPieceWarehouseRecord[]): CutPieceWarehouseRecord[] {
  if (state.activePriorityMode === 'UNASSIGNED_ZONE') return records.filter((record) => record.zoneCode === 'UNASSIGNED')
  if (state.activePriorityMode === 'WAITING_HANDOVER') return records.filter((record) => record.handoverStatus === 'WAITING_HANDOVER')
  return records
}

function applyPriorityModeForSample(records: SampleWarehouseRecord[]): SampleWarehouseRecord[] {
  if (state.activePriorityMode === 'SAMPLE_RETURN') return records.filter((record) => record.currentStatus === 'WAITING_RETURN')
  return records
}

function applyKpiFilterForFabric(records: CuttingFabricStockRecord[]): CuttingFabricStockRecord[] {
  if (state.activeKpiFilter === 'FABRIC_RECHECK') return records.filter((record) => record.stockStatus === 'NEED_RECHECK')
  return records
}

function applyKpiFilterForCutPiece(records: CutPieceWarehouseRecord[]): CutPieceWarehouseRecord[] {
  if (state.activeKpiFilter === 'PENDING_INBOUND') return records.filter((record) => record.inboundStatus === 'PENDING_INBOUND')
  if (state.activeKpiFilter === 'INBOUNDED') return records.filter((record) => record.inboundStatus !== 'PENDING_INBOUND')
  if (state.activeKpiFilter === 'UNASSIGNED_ZONE') return records.filter((record) => record.zoneCode === 'UNASSIGNED')
  if (state.activeKpiFilter === 'WAITING_HANDOVER') return records.filter((record) => record.handoverStatus === 'WAITING_HANDOVER')
  return records
}

function applyKpiFilterForSample(records: SampleWarehouseRecord[]): SampleWarehouseRecord[] {
  if (state.activeKpiFilter === 'WAITING_RETURN') return records.filter((record) => record.currentStatus === 'WAITING_RETURN')
  return records
}

function getPriorityModeTab(mode: WarehousePriorityMode | null): WarehouseTab | null {
  if (mode === 'FABRIC_RECHECK') return 'fabric'
  if (mode === 'UNASSIGNED_ZONE' || mode === 'WAITING_HANDOVER') return 'cutPiece'
  if (mode === 'SAMPLE_RETURN') return 'sample'
  return null
}

function getKpiFilterTab(filter: WarehouseKpiFilter | null): WarehouseTab | null {
  if (filter === 'FABRIC_RECHECK') return 'fabric'
  if (filter === 'PENDING_INBOUND' || filter === 'INBOUNDED' || filter === 'UNASSIGNED_ZONE' || filter === 'WAITING_HANDOVER') return 'cutPiece'
  if (filter === 'WAITING_RETURN') return 'sample'
  return null
}

function alignCrossTabViewState(targetTab: WarehouseTab): void {
  if (state.activePriorityMode && getPriorityModeTab(state.activePriorityMode) !== targetTab) {
    state.activePriorityMode = null
  }
  if (state.activeKpiFilter && getKpiFilterTab(state.activeKpiFilter) !== targetTab) {
    state.activeKpiFilter = null
  }
}

function getPriorityModeLabel(mode: WarehousePriorityMode | null): string | null {
  if (mode === 'FABRIC_RECHECK') return '重点模式：待核对库存'
  if (mode === 'UNASSIGNED_ZONE') return '重点模式：未分配区域'
  if (mode === 'SAMPLE_RETURN') return '重点模式：样衣待归还 / 超期'
  if (mode === 'WAITING_HANDOVER') return '重点模式：待发后道'
  return null
}

function getKpiFilterLabel(filter: WarehouseKpiFilter | null): string | null {
  if (filter === 'FABRIC_RECHECK') return 'KPI：裁床仓待核对库存'
  if (filter === 'PENDING_INBOUND') return 'KPI：裁片仓待入仓'
  if (filter === 'INBOUNDED') return 'KPI：裁片仓已入仓'
  if (filter === 'UNASSIGNED_ZONE') return 'KPI：未分配区域'
  if (filter === 'WAITING_RETURN') return 'KPI：样衣待归还'
  if (filter === 'WAITING_HANDOVER') return 'KPI：待发后道'
  return null
}

function renderShortcutCardZone(): string {
  const fabricRecords = getFilteredFabricStocks()
  const cutPieceRecords = getFilteredCutPieceRecords()
  const sampleRecords = getFilteredSampleRecords()
  const sampleFocusCount = sampleRecords.filter((record) => record.currentStatus === 'WAITING_RETURN').length
  const summary = buildWarehouseSummary(fabricRecords, cutPieceRecords, sampleRecords)

  return renderWorkbenchShortcutZone({
    columnsClass: 'grid gap-2 sm:grid-cols-2 lg:grid-cols-5 xl:grid-cols-10',
    cardsHtml: [
      renderWorkbenchActionCard({
        title: '待核对库存',
        count: fabricRecords.filter((record) => record.stockStatus === 'NEED_RECHECK').length,
        hint: '',
        attrs: 'data-cutting-warehouse-action="toggle-priority-mode" data-priority-mode="FABRIC_RECHECK" data-tab="fabric"',
        active: state.activePriorityMode === 'FABRIC_RECHECK',
        accentClass: 'text-rose-600',
        variant: 'priority',
      }),
      renderWorkbenchActionCard({
        title: '未分配区域',
        count: cutPieceRecords.filter((record) => record.zoneCode === 'UNASSIGNED').length,
        hint: '',
        attrs: 'data-cutting-warehouse-action="toggle-priority-mode" data-priority-mode="UNASSIGNED_ZONE" data-tab="cutPiece"',
        active: state.activePriorityMode === 'UNASSIGNED_ZONE',
        accentClass: 'text-violet-600',
        variant: 'priority',
      }),
      renderWorkbenchActionCard({
        title: '样衣待归还 / 超期',
        count: sampleFocusCount,
        hint: '',
        attrs: 'data-cutting-warehouse-action="toggle-priority-mode" data-priority-mode="SAMPLE_RETURN" data-tab="sample"',
        active: state.activePriorityMode === 'SAMPLE_RETURN',
        accentClass: 'text-amber-600',
        variant: 'priority',
      }),
      renderWorkbenchActionCard({
        title: '待发后道',
        count: cutPieceRecords.filter((record) => record.handoverStatus === 'WAITING_HANDOVER').length,
        hint: '',
        attrs: 'data-cutting-warehouse-action="toggle-priority-mode" data-priority-mode="WAITING_HANDOVER" data-tab="cutPiece"',
        active: state.activePriorityMode === 'WAITING_HANDOVER',
        accentClass: 'text-sky-600',
        variant: 'priority',
      }),
      renderWorkbenchActionCard({
        title: '待核对',
        count: summary.fabricRecheckCount,
        hint: '',
        attrs: 'data-cutting-warehouse-action="toggle-kpi-filter" data-kpi-filter="FABRIC_RECHECK" data-tab="fabric"',
        active: state.activeKpiFilter === 'FABRIC_RECHECK',
        accentClass: 'text-rose-600',
        variant: 'kpi',
      }),
      renderWorkbenchActionCard({
        title: '待入仓',
        count: summary.pendingInboundCount,
        hint: '',
        attrs: 'data-cutting-warehouse-action="toggle-kpi-filter" data-kpi-filter="PENDING_INBOUND" data-tab="cutPiece"',
        active: state.activeKpiFilter === 'PENDING_INBOUND',
        accentClass: 'text-slate-900',
        variant: 'kpi',
      }),
      renderWorkbenchActionCard({
        title: '已入仓',
        count: summary.inboundedCount,
        hint: '',
        attrs: 'data-cutting-warehouse-action="toggle-kpi-filter" data-kpi-filter="INBOUNDED" data-tab="cutPiece"',
        active: state.activeKpiFilter === 'INBOUNDED',
        accentClass: 'text-emerald-600',
        variant: 'kpi',
      }),
      renderWorkbenchActionCard({
        title: '未分区',
        count: summary.unassignedZoneCount,
        hint: '',
        attrs: 'data-cutting-warehouse-action="toggle-kpi-filter" data-kpi-filter="UNASSIGNED_ZONE" data-tab="cutPiece"',
        active: state.activeKpiFilter === 'UNASSIGNED_ZONE',
        accentClass: 'text-violet-600',
        variant: 'kpi',
      }),
      renderWorkbenchActionCard({
        title: '待归还',
        count: summary.waitingReturnCount,
        hint: '',
        attrs: 'data-cutting-warehouse-action="toggle-kpi-filter" data-kpi-filter="WAITING_RETURN" data-tab="sample"',
        active: state.activeKpiFilter === 'WAITING_RETURN',
        accentClass: 'text-amber-600',
        variant: 'kpi',
      }),
      renderWorkbenchActionCard({
        title: '待发后道',
        count: summary.waitingHandoverCount,
        hint: '',
        attrs: 'data-cutting-warehouse-action="toggle-kpi-filter" data-kpi-filter="WAITING_HANDOVER" data-tab="cutPiece"',
        active: state.activeKpiFilter === 'WAITING_HANDOVER',
        accentClass: 'text-sky-600',
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
    chips.push(renderWorkbenchFilterChip(priorityLabel, 'data-cutting-warehouse-action="clear-priority-mode"', 'amber'))
  }
  if (kpiLabel) {
    chips.push(renderWorkbenchFilterChip(kpiLabel, 'data-cutting-warehouse-action="clear-kpi-filter"', 'blue'))
  }

  return renderWorkbenchStateBar({
    summary: `当前主表视图 · ${state.activeTab === 'fabric' ? '裁床仓' : state.activeTab === 'cutPiece' ? '裁片仓' : '样衣仓'}`,
    chips,
    clearAttrs: 'data-cutting-warehouse-action="clear-view-state"',
  })
}

function findFabricStock(recordId: string | null): CuttingFabricStockRecord | null {
  if (!recordId) return null
  return state.fabricStocks.find((item) => item.id === recordId) ?? null
}

function findCutPieceRecord(recordId: string | null): CutPieceWarehouseRecord | null {
  if (!recordId) return null
  return state.cutPieceRecords.find((item) => item.id === recordId) ?? null
}

function findSampleRecord(recordId: string | null): SampleWarehouseRecord | null {
  if (!recordId) return null
  return state.sampleRecords.find((item) => item.id === recordId) ?? null
}

function resetLocationDraft(): void {
  state.locationDraft = {
    zoneCode: 'A',
    locationLabel: '',
    note: '',
  }
}

function resetSampleDraft(): void {
  state.sampleDraft = { note: '' }
}

function openOverlay(type: OverlayType, recordId: string): void {
  state.activeOverlay = type
  state.activeRecordId = recordId

  if (type === 'location-guide') {
    const record = findCutPieceRecord(recordId)
    if (record) {
      state.locationDraft = {
        zoneCode: record.zoneCode === 'UNASSIGNED' ? 'A' : record.zoneCode,
        locationLabel: record.zoneCode === 'UNASSIGNED' ? '' : record.locationLabel,
        note: record.note,
      }
    }
  }

  if (type === 'sample-flow') {
    resetSampleDraft()
  }
}

function closeOverlay(): void {
  state.activeOverlay = null
  state.activeRecordId = null
  resetLocationDraft()
  resetSampleDraft()
}

function saveLocationGuide(): boolean {
  const record = findCutPieceRecord(state.activeRecordId)
  if (!record) return false

  record.zoneCode = state.locationDraft.zoneCode
  record.locationLabel = state.locationDraft.locationLabel.trim() || `${zoneMeta[state.locationDraft.zoneCode].label} 待补充库位`
  record.note = state.locationDraft.note.trim() || record.note
  record.inboundBy = '仓务运营 刘安琪'
  record.inboundAt = '2026-03-22 18:20'
  if (record.inboundStatus === 'PENDING_INBOUND') {
    record.inboundStatus = 'INBOUNDED'
  }

  state.alerts = state.alerts.filter(
    (item) => !(item.warehouseAlertType === 'UNASSIGNED_ZONE' && item.relatedNo === record.cutPieceOrderNo),
  )
  closeOverlay()
  return true
}

function saveSampleReturn(): boolean {
  const record = findSampleRecord(state.activeRecordId)
  if (!record) return false

  record.currentLocationStage = 'BACK_TO_PMC'
  record.currentHolder = 'PMC 样衣仓'
  record.currentStatus = 'AVAILABLE'
  record.latestActionAt = '2026-03-22 18:28'
  record.latestActionBy = '仓务运营 刘安琪'
  record.nextSuggestedAction = '可继续为下一批裁床调用。'
  record.flowHistory = [
    ...record.flowHistory,
    {
      stage: 'BACK_TO_PMC',
      actionText: '登记归还样衣',
      operatedBy: '仓务运营 刘安琪',
      operatedAt: '2026-03-22 18:28',
      note: state.sampleDraft.note.trim() || '仓库管理页补录归还，待下次裁床调用。',
    },
  ]

  state.alerts = state.alerts.filter(
    (item) => !(item.warehouseAlertType === 'SAMPLE_OVERDUE' && item.relatedNo === record.sampleNo),
  )
  closeOverlay()
  return true
}

function renderPageHeader(): string {
  return `
    <header class="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p class="mb-1 text-sm text-muted-foreground">工艺工厂运营系统 / 裁片管理</p>
        <h1 class="text-xl font-bold">仓库管理</h1>
        <p class="mt-0.5 text-xs text-muted-foreground">当前 tab 主表优先。</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" data-cutting-warehouse-action="go-cut-piece-orders">去裁片单</button>
        <button class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" data-cutting-warehouse-action="go-cutting-summary">去裁剪总结</button>
      </div>
    </header>
  `
}

function renderAlertSection(): string {
  const alerts = sortAlerts(state.alerts)
  return renderWorkbenchSecondaryPanel({
    title: '仓务提醒',
    hint: '优先处理未分配区域、待交接后道、样衣超期未归还和库存待核对。',
    countText: `${alerts.length} 条提醒`,
    body: `
      <div class="grid gap-3 xl:grid-cols-4">
        ${alerts
          .map(
            (alert) => `
              <article class="rounded-lg border bg-muted/20 p-3">
                <div class="flex items-center justify-between gap-3">
                  <h3 class="text-sm font-semibold text-foreground">${escapeHtml(alert.title)}</h3>
                  ${renderBadge(alertLevelMeta[alert.level].label, alertLevelMeta[alert.level].className)}
                </div>
                <p class="mt-2 text-sm text-muted-foreground">${escapeHtml(alert.description)}</p>
                <p class="mt-2 text-xs text-muted-foreground">关联编号：${escapeHtml(alert.relatedNo)}</p>
                <p class="mt-1 text-xs text-muted-foreground">建议动作：${escapeHtml(alert.suggestedAction)}</p>
              </article>
            `,
          )
          .join('')}
      </div>
    `,
  })
}

function renderTabButton(tab: WarehouseTab, label: string): string {
  const active = state.activeTab === tab
  return `
    <button
      class="rounded-md px-4 py-2 text-sm font-medium ${active ? 'bg-blue-600 text-white' : 'border bg-background hover:bg-muted'}"
      data-cutting-warehouse-action="switch-tab"
      data-tab="${tab}"
    >
      ${escapeHtml(label)}
    </button>
  `
}

function renderTabs(): string {
  return `
    <section class="rounded-lg border bg-card p-2.5">
      <div class="flex flex-wrap gap-2">
        ${renderTabButton('fabric', '裁床仓')}
        ${renderTabButton('cutPiece', '裁片仓')}
        ${renderTabButton('sample', '样衣仓')}
      </div>
    </section>
  `
}

function renderEmptyState(text: string): string {
  return `
    <div class="rounded-lg border border-dashed bg-card px-6 py-10 text-center">
      <p class="text-sm text-muted-foreground">${escapeHtml(text)}</p>
    </div>
  `
}

function renderFabricView(): string {
  const baseRecords = getFilteredFabricStocks()
  const records = applyKpiFilterForFabric(applyPriorityModeForFabric(baseRecords))
  const summary = buildFabricSummary(baseRecords)
  const hasFilters = hasFabricFilters(state.filters.cuttingFabric) || state.activePriorityMode !== null || state.activeKpiFilter !== null
  const pagination = paginateItems(records, state.pagination.fabric.page, state.pagination.fabric.pageSize)
  return `
    <section class="space-y-4">
      ${renderStickyFilterShell(`
        <div class="grid gap-3 lg:grid-cols-3 xl:grid-cols-4">
          <label class="space-y-2 xl:col-span-2">
            <span class="text-sm font-medium text-foreground">关键词搜索</span>
            <input
              class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              value="${escapeHtml(state.filters.cuttingFabric.keyword)}"
              placeholder="生产单号 / 裁片单号 / 面料 SKU"
              data-cutting-warehouse-scope="fabric"
              data-cutting-warehouse-field="keyword"
            />
          </label>
          ${renderFilterSelect('面料类型', 'fabric', 'materialType', state.filters.cuttingFabric.materialType, [
            { value: 'ALL', label: '全部' },
            { value: 'PRINT', label: '印花面料' },
            { value: 'DYE', label: '染色面料' },
            { value: 'SOLID', label: '净色面料' },
            { value: 'LINING', label: '里布' },
          ])}
          ${renderFilterSelect('库存状态', 'fabric', 'stockStatus', state.filters.cuttingFabric.stockStatus, [
            { value: 'ALL', label: '全部' },
            { value: 'READY', label: '库存正常' },
            { value: 'PARTIAL_USED', label: '部分已用' },
            { value: 'NEED_RECHECK', label: '待核对' },
          ])}
        </div>
      `)}

      ${
        records.length === 0
          ? renderEmptyState(buildWarehouseEmptyText('fabric', hasFilters))
          : `
              <section class="overflow-hidden rounded-lg border bg-card">
                <div class="border-b px-4 py-3">
                  <div class="flex items-center justify-between gap-3">
                    <div>
                      <h2 class="text-base font-semibold text-foreground">裁床仓主表</h2>
                      <p class="mt-0.5 text-xs text-muted-foreground">配置、已用、剩余一屏查看。</p>
                    </div>
                    <span class="text-sm text-muted-foreground">共 ${pagination.total} 条库存</span>
                  </div>
                </div>
                ${renderStickyTableScroller(`
                  <table class="min-w-full divide-y divide-border text-sm">
                    <thead class="sticky top-0 z-10 bg-muted/95 text-left text-muted-foreground backdrop-blur">
                      <tr>
                        <th class="px-4 py-3 font-medium">生产单号</th>
                        <th class="px-4 py-3 font-medium">裁片单号</th>
                        <th class="px-4 py-3 font-medium">面料 SKU</th>
                        <th class="px-4 py-3 font-medium">面料类型</th>
                        <th class="px-4 py-3 font-medium">已配置卷数 / 长度</th>
                        <th class="px-4 py-3 font-medium">已用卷数 / 长度</th>
                        <th class="px-4 py-3 font-medium">剩余卷数 / 长度</th>
                        <th class="px-4 py-3 font-medium">库存状态</th>
                        <th class="px-4 py-3 font-medium">最新动作</th>
                        <th class="px-4 py-3 font-medium">操作</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-border">
                      ${pagination.items
                        .map(
                          (record) => `
                            <tr class="align-top">
                              <td class="px-4 py-3 font-medium text-foreground">${escapeHtml(record.productionOrderNo)}</td>
                              <td class="px-4 py-3">
                                <button class="font-medium text-blue-600 hover:underline" data-cutting-warehouse-action="go-cut-piece-orders">${escapeHtml(record.cutPieceOrderNo)}</button>
                              </td>
                              <td class="px-4 py-3">
                                <p class="font-medium text-foreground">${escapeHtml(record.materialSku)}</p>
                                <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(record.materialLabel)}</p>
                              </td>
                              <td class="px-4 py-3">${renderBadge(materialTypeMeta[record.materialType].label, materialTypeMeta[record.materialType].className)}</td>
                              <td class="px-4 py-3 text-muted-foreground">${formatQty(record.configuredRollCount)} / ${formatLength(record.configuredLength)}</td>
                              <td class="px-4 py-3 text-muted-foreground">${formatQty(record.usedRollCount)} / ${formatLength(record.usedLength)}</td>
                              <td class="px-4 py-3">
                                <p class="font-medium text-foreground">${formatQty(record.remainingRollCount)} / ${formatLength(record.remainingLength)}</p>
                              </td>
                              <td class="px-4 py-3">${renderBadge(stockStatusMeta[record.stockStatus].label, stockStatusMeta[record.stockStatus].className)}</td>
                              <td class="px-4 py-3 text-muted-foreground">${escapeHtml(record.latestActionText)}</td>
                              <td class="px-4 py-3">
                                <div class="flex flex-wrap gap-2">
                                  <button class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-cutting-warehouse-action="open-stock-detail" data-record-id="${record.id}">查看库存明细</button>
                                  <button class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-cutting-warehouse-action="go-cut-piece-orders">查看裁片单</button>
                                </div>
                              </td>
                            </tr>
                          `,
                        )
                        .join('')}
                    </tbody>
                  </table>
                `, 'max-h-[56vh]')}
                ${renderWorkbenchPagination({
                  page: pagination.page,
                  pageSize: pagination.pageSize,
                  total: pagination.total,
                  actionAttr: 'data-cutting-warehouse-action',
                  pageAction: 'set-page',
                  pageSizeAttr: 'data-cutting-warehouse-page-size',
                  extraAttrs: 'data-tab="fabric"',
                })}
              </section>
            `
      }

      ${renderWorkbenchSecondaryPanel({
        title: '库存摘要',
        hint: '压缩展示裁床仓总长度和待核对规模。',
        countText: `${summary.recheckCount} 条待核对`,
        body: `
          <div class="grid gap-3 md:grid-cols-3">
            <article class="rounded-lg border bg-muted/20 p-3">
              <p class="text-sm text-muted-foreground">当前配置总长度</p>
              <p class="mt-2 text-xl font-semibold text-foreground">${formatLength(summary.totalConfiguredLength)}</p>
            </article>
            <article class="rounded-lg border bg-muted/20 p-3">
              <p class="text-sm text-muted-foreground">当前剩余总长度</p>
              <p class="mt-2 text-xl font-semibold text-emerald-600">${formatLength(summary.totalRemainingLength)}</p>
            </article>
            <article class="rounded-lg border bg-muted/20 p-3">
              <p class="text-sm text-muted-foreground">待核对库存条数</p>
              <p class="mt-2 text-xl font-semibold text-rose-600">${summary.recheckCount}</p>
            </article>
          </div>
        `,
      })}
    </section>
  `
}

function renderCutPieceView(): string {
  const baseRecords = getFilteredCutPieceRecords()
  const records = applyKpiFilterForCutPiece(applyPriorityModeForCutPiece(baseRecords))
  const summary = buildCutPieceSummary(baseRecords)
  const hasFilters = hasCutPieceFilters(state.filters.cutPiece) || state.activePriorityMode !== null || state.activeKpiFilter !== null
  const pagination = paginateItems(records, state.pagination.cutPiece.page, state.pagination.cutPiece.pageSize)
  return `
    <section class="space-y-4">
      ${renderStickyFilterShell(`
        <div class="grid gap-3 lg:grid-cols-3 xl:grid-cols-4">
          <label class="space-y-2 xl:col-span-2">
            <span class="text-sm font-medium text-foreground">关键词搜索</span>
            <input
              class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              value="${escapeHtml(state.filters.cutPiece.keyword)}"
              placeholder="生产单号 / 裁片单号 / 分组"
              data-cutting-warehouse-scope="cutPiece"
              data-cutting-warehouse-field="keyword"
            />
          </label>
          ${renderFilterSelect('区域筛选', 'cutPiece', 'zoneCode', state.filters.cutPiece.zoneCode, [
            { value: 'ALL', label: '全部' },
            { value: 'A', label: 'A 区' },
            { value: 'B', label: 'B 区' },
            { value: 'C', label: 'C 区' },
            { value: 'UNASSIGNED', label: '未分配' },
          ])}
          ${renderFilterSelect('入仓状态', 'cutPiece', 'inboundStatus', state.filters.cutPiece.inboundStatus, [
            { value: 'ALL', label: '全部' },
            { value: 'PENDING_INBOUND', label: '待入仓' },
            { value: 'INBOUNDED', label: '已入仓' },
            { value: 'WAITING_HANDOVER', label: '待发后道' },
            { value: 'HANDED_OVER', label: '已交接后道' },
          ])}
          ${renderFilterSelect('交接状态', 'cutPiece', 'handoverStatus', state.filters.cutPiece.handoverStatus, [
            { value: 'ALL', label: '全部' },
            { value: 'WAITING_HANDOVER', label: '待发后道' },
            { value: 'HANDED_OVER', label: '已交接后道' },
          ])}
        </div>
      `)}

      ${
        records.length === 0
          ? renderEmptyState(buildWarehouseEmptyText('cutPiece', hasFilters))
          : `
              <section class="overflow-hidden rounded-lg border bg-card">
                <div class="border-b px-4 py-3">
                  <div class="flex items-center justify-between gap-3">
                    <div>
                      <h2 class="text-base font-semibold text-foreground">裁片仓主表</h2>
                      <p class="mt-0.5 text-xs text-muted-foreground">区域、入仓、交接一屏查看。</p>
                    </div>
                    <span class="text-sm text-muted-foreground">共 ${pagination.total} 条入仓记录</span>
                  </div>
                </div>
                ${renderStickyTableScroller(`
                  <table class="min-w-full divide-y divide-border text-sm">
                    <thead class="sticky top-0 z-10 bg-muted/95 text-left text-muted-foreground backdrop-blur">
                      <tr>
                        <th class="px-4 py-3 font-medium">生产单号</th>
                        <th class="px-4 py-3 font-medium">裁片单号</th>
                        <th class="px-4 py-3 font-medium">分组</th>
                        <th class="px-4 py-3 font-medium">当前区域</th>
                        <th class="px-4 py-3 font-medium">位置说明</th>
                        <th class="px-4 py-3 font-medium">入仓状态</th>
                        <th class="px-4 py-3 font-medium">入仓时间</th>
                        <th class="px-4 py-3 font-medium">后道交接状态</th>
                        <th class="px-4 py-3 font-medium">操作</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-border">
                      ${pagination.items
                        .map(
                          (record) => `
                            <tr class="align-top">
                              <td class="px-4 py-3 font-medium text-foreground">${escapeHtml(record.productionOrderNo)}</td>
                              <td class="px-4 py-3">
                                <button class="font-medium text-blue-600 hover:underline" data-cutting-warehouse-action="go-cut-piece-orders">${escapeHtml(record.cutPieceOrderNo)}</button>
                              </td>
                              <td class="px-4 py-3">${escapeHtml(record.groupNo)}</td>
                              <td class="px-4 py-3">${renderBadge(zoneMeta[record.zoneCode].label, zoneMeta[record.zoneCode].className)}</td>
                              <td class="px-4 py-3 text-muted-foreground">${escapeHtml(record.locationLabel)}</td>
                              <td class="px-4 py-3">${renderBadge(inboundStatusMeta[record.inboundStatus].label, inboundStatusMeta[record.inboundStatus].className)}</td>
                              <td class="px-4 py-3 text-muted-foreground">${escapeHtml(formatDateTime(record.inboundAt))}</td>
                              <td class="px-4 py-3">${renderBadge(handoverStatusMeta[record.handoverStatus].label, handoverStatusMeta[record.handoverStatus].className)}</td>
                              <td class="px-4 py-3">
                                <div class="flex flex-wrap gap-2">
                                  <button class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-cutting-warehouse-action="open-location-guide" data-record-id="${record.id}">查看库位 / 入仓指引</button>
                                  <button class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-cutting-warehouse-action="open-location-guide" data-record-id="${record.id}">确认入仓</button>
                                  <button class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-cutting-warehouse-action="open-location-guide" data-record-id="${record.id}">查看交接摘要</button>
                                </div>
                              </td>
                            </tr>
                          `,
                        )
                        .join('')}
                    </tbody>
                  </table>
                `, 'max-h-[56vh]')}
                ${renderWorkbenchPagination({
                  page: pagination.page,
                  pageSize: pagination.pageSize,
                  total: pagination.total,
                  actionAttr: 'data-cutting-warehouse-action',
                  pageAction: 'set-page',
                  pageSizeAttr: 'data-cutting-warehouse-page-size',
                  extraAttrs: 'data-tab="cutPiece"',
                })}
              </section>
            `
      }

      ${renderWorkbenchSecondaryPanel({
        title: '区域摘要',
        hint: '压缩查看 A/B/C 区分布和未分配规模。',
        countText: `${summary.unassignedCount} 条未分配`,
        body: `
          <div class="grid gap-3 md:grid-cols-4">
            <article class="rounded-lg border bg-muted/20 p-3">
              <p class="text-sm text-muted-foreground">A 区组数</p>
              <p class="mt-2 text-xl font-semibold text-blue-600">${summary.zoneACount}</p>
            </article>
            <article class="rounded-lg border bg-muted/20 p-3">
              <p class="text-sm text-muted-foreground">B 区组数</p>
              <p class="mt-2 text-xl font-semibold text-violet-600">${summary.zoneBCount}</p>
            </article>
            <article class="rounded-lg border bg-muted/20 p-3">
              <p class="text-sm text-muted-foreground">C 区组数</p>
              <p class="mt-2 text-xl font-semibold text-amber-600">${summary.zoneCCount}</p>
            </article>
            <article class="rounded-lg border bg-muted/20 p-3">
              <p class="text-sm text-muted-foreground">未分配区域</p>
              <p class="mt-2 text-xl font-semibold text-rose-600">${summary.unassignedCount}</p>
            </article>
          </div>
        `,
      })}
    </section>
  `
}

function renderSampleView(): string {
  const baseRecords = getFilteredSampleRecords()
  const records = applyKpiFilterForSample(applyPriorityModeForSample(baseRecords))
  const summary = buildSampleSummary(baseRecords)
  const hasFilters = hasSampleFilters(state.filters.sample) || state.activePriorityMode !== null || state.activeKpiFilter !== null
  const pagination = paginateItems(records, state.pagination.sample.page, state.pagination.sample.pageSize)
  return `
    <section class="space-y-4">
      ${renderStickyFilterShell(`
        <div class="grid gap-3 lg:grid-cols-3 xl:grid-cols-4">
          <label class="space-y-2 xl:col-span-2">
            <span class="text-sm font-medium text-foreground">关键词搜索</span>
            <input
              class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              value="${escapeHtml(state.filters.sample.keyword)}"
              placeholder="样衣编号 / 样衣名称 / 生产单号"
              data-cutting-warehouse-scope="sample"
              data-cutting-warehouse-field="keyword"
            />
          </label>
          ${renderFilterSelect('当前阶段', 'sample', 'stage', state.filters.sample.stage, [
            { value: 'ALL', label: '全部' },
            { value: 'DESIGN_CENTER', label: '设计中心' },
            { value: 'CUTTING', label: '裁床现场' },
            { value: 'PMC_WAREHOUSE', label: 'PMC 仓库' },
            { value: 'FACTORY_CHECK', label: '工厂核价' },
            { value: 'RETURN_CHECK', label: '回货抽检' },
            { value: 'BACK_TO_PMC', label: '回 PMC 仓库' },
          ])}
          ${renderFilterSelect('当前状态', 'sample', 'status', state.filters.sample.status, [
            { value: 'ALL', label: '全部' },
            { value: 'AVAILABLE', label: '可调用' },
            { value: 'IN_USE', label: '使用中' },
            { value: 'WAITING_RETURN', label: '待归还' },
            { value: 'CHECKING', label: '抽检中' },
          ])}
        </div>
      `)}

      ${
        records.length === 0
          ? renderEmptyState(buildWarehouseEmptyText('sample', hasFilters))
          : `
              <section class="overflow-hidden rounded-lg border bg-card">
                <div class="border-b px-4 py-3">
                  <div class="flex items-center justify-between gap-3">
                    <div>
                      <h2 class="text-base font-semibold text-foreground">样衣仓主表</h2>
                      <p class="mt-0.5 text-xs text-muted-foreground">阶段、持有人、状态一屏查看。</p>
                    </div>
                    <span class="text-sm text-muted-foreground">共 ${pagination.total} 条样衣记录</span>
                  </div>
                </div>
                ${renderStickyTableScroller(`
                  <table class="min-w-full divide-y divide-border text-sm">
                    <thead class="sticky top-0 z-10 bg-muted/95 text-left text-muted-foreground backdrop-blur">
                      <tr>
                        <th class="px-4 py-3 font-medium">样衣编号</th>
                        <th class="px-4 py-3 font-medium">样衣名称</th>
                        <th class="px-4 py-3 font-medium">关联生产单</th>
                        <th class="px-4 py-3 font-medium">当前阶段</th>
                        <th class="px-4 py-3 font-medium">当前持有人 / 所在位置</th>
                        <th class="px-4 py-3 font-medium">当前状态</th>
                        <th class="px-4 py-3 font-medium">最近动作时间</th>
                        <th class="px-4 py-3 font-medium">下一步建议动作</th>
                        <th class="px-4 py-3 font-medium">操作</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-border">
                      ${pagination.items
                        .map(
                          (record) => `
                            <tr class="align-top">
                              <td class="px-4 py-3 font-medium text-foreground">${escapeHtml(record.sampleNo)}</td>
                              <td class="px-4 py-3">
                                <p class="font-medium text-foreground">${escapeHtml(record.sampleName)}</p>
                                <p class="mt-1 text-xs text-muted-foreground">关联裁片单：${escapeHtml(record.relatedCutPieceOrderNo)}</p>
                              </td>
                              <td class="px-4 py-3">${escapeHtml(record.relatedProductionOrderNo)}</td>
                              <td class="px-4 py-3">${escapeHtml(sampleStageMeta[record.currentLocationStage])}</td>
                              <td class="px-4 py-3 text-muted-foreground">${escapeHtml(record.currentHolder)}</td>
                              <td class="px-4 py-3">${renderBadge(sampleStatusMeta[record.currentStatus].label, sampleStatusMeta[record.currentStatus].className)}</td>
                              <td class="px-4 py-3 text-muted-foreground">${escapeHtml(formatDateTime(record.latestActionAt))}</td>
                              <td class="px-4 py-3 text-muted-foreground">${escapeHtml(record.nextSuggestedAction)}</td>
                              <td class="px-4 py-3">
                                <div class="flex flex-wrap gap-2">
                                  <button class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-cutting-warehouse-action="open-sample-flow" data-record-id="${record.id}">查看流转详情</button>
                                  <button class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-cutting-warehouse-action="open-sample-flow" data-record-id="${record.id}">登记归还</button>
                                  <button class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-cutting-warehouse-action="go-cut-piece-orders">查看关联裁片单</button>
                                </div>
                              </td>
                            </tr>
                          `,
                        )
                        .join('')}
                    </tbody>
                  </table>
                `, 'max-h-[56vh]')}
                ${renderWorkbenchPagination({
                  page: pagination.page,
                  pageSize: pagination.pageSize,
                  total: pagination.total,
                  actionAttr: 'data-cutting-warehouse-action',
                  pageAction: 'set-page',
                  pageSizeAttr: 'data-cutting-warehouse-page-size',
                  extraAttrs: 'data-tab="sample"',
                })}
              </section>
            `
      }

      ${renderWorkbenchSecondaryPanel({
        title: '流转摘要',
        hint: '压缩查看样衣可调用、使用中、待归还和抽检中规模。',
        countText: `${summary.waitingReturnCount} 条待归还`,
        body: `
          <div class="grid gap-3 md:grid-cols-4">
            <article class="rounded-lg border bg-muted/20 p-3">
              <p class="text-sm text-muted-foreground">可调用</p>
              <p class="mt-2 text-xl font-semibold text-emerald-600">${summary.availableCount}</p>
            </article>
            <article class="rounded-lg border bg-muted/20 p-3">
              <p class="text-sm text-muted-foreground">使用中</p>
              <p class="mt-2 text-xl font-semibold text-sky-600">${summary.inUseCount}</p>
            </article>
            <article class="rounded-lg border bg-muted/20 p-3">
              <p class="text-sm text-muted-foreground">待归还</p>
              <p class="mt-2 text-xl font-semibold text-amber-600">${summary.waitingReturnCount}</p>
            </article>
            <article class="rounded-lg border bg-muted/20 p-3">
              <p class="text-sm text-muted-foreground">抽检中</p>
              <p class="mt-2 text-xl font-semibold text-violet-600">${summary.checkingCount}</p>
            </article>
          </div>
        `,
      })}
    </section>
  `
}

function renderStockDetailDrawer(): string {
  if (state.activeOverlay !== 'stock-detail') return ''
  const record = findFabricStock(state.activeRecordId)
  if (!record) return ''

  return uiDrawer(
    {
      title: '库存明细',
      subtitle: '查看裁床仓当前配置、已用和剩余库存摘要。',
      closeAction: { prefix: 'cutting-warehouse', action: 'close-overlay' },
      width: 'md',
    },
    `
      <div class="space-y-5 text-sm">
        <section class="grid gap-4 rounded-lg border p-4 md:grid-cols-2">
          <div>
            <p class="text-xs text-muted-foreground">生产单号</p>
            <p class="mt-1 font-medium text-foreground">${escapeHtml(record.productionOrderNo)}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">裁片单号</p>
            <p class="mt-1 font-medium text-foreground">${escapeHtml(record.cutPieceOrderNo)}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">面料 SKU</p>
            <p class="mt-1 font-medium text-foreground">${escapeHtml(record.materialSku)}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">面料类型</p>
            <p class="mt-1">${renderBadge(materialTypeMeta[record.materialType].label, materialTypeMeta[record.materialType].className)}</p>
          </div>
        </section>
        <section class="grid gap-4 md:grid-cols-3">
          <div class="rounded-lg border bg-muted/20 p-4">
            <p class="text-xs text-muted-foreground">配置摘要</p>
            <p class="mt-2 font-medium text-foreground">${formatQty(record.configuredRollCount)} / ${formatLength(record.configuredLength)}</p>
          </div>
          <div class="rounded-lg border bg-muted/20 p-4">
            <p class="text-xs text-muted-foreground">已用摘要</p>
            <p class="mt-2 font-medium text-foreground">${formatQty(record.usedRollCount)} / ${formatLength(record.usedLength)}</p>
          </div>
          <div class="rounded-lg border bg-muted/20 p-4">
            <p class="text-xs text-muted-foreground">剩余摘要</p>
            <p class="mt-2 font-medium text-foreground">${formatQty(record.remainingRollCount)} / ${formatLength(record.remainingLength)}</p>
          </div>
        </section>
        <section class="rounded-lg border p-4">
          <div class="flex items-center justify-between gap-3">
            <h3 class="font-semibold text-foreground">状态说明</h3>
            ${renderBadge(stockStatusMeta[record.stockStatus].label, stockStatusMeta[record.stockStatus].className)}
          </div>
          <p class="mt-3 text-muted-foreground">${escapeHtml(record.note)}</p>
          <div class="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <p class="text-xs text-muted-foreground">最近配置时间</p>
              <p class="mt-1 font-medium text-foreground">${escapeHtml(formatDateTime(record.latestConfigAt))}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">最近领料时间</p>
              <p class="mt-1 font-medium text-foreground">${escapeHtml(formatDateTime(record.latestReceiveAt))}</p>
            </div>
          </div>
          <p class="mt-4 text-sm text-muted-foreground">最近动作：${escapeHtml(record.latestActionText)}</p>
        </section>
      </div>
    `,
    {
      cancel: { prefix: 'cutting-warehouse', action: 'close-overlay', label: '关闭' },
    },
  )
}

function renderLocationGuideDrawer(): string {
  if (state.activeOverlay !== 'location-guide') return ''
  const record = findCutPieceRecord(state.activeRecordId)
  if (!record) return ''
  const isReadonly = record.handoverStatus === 'HANDED_OVER'

  return uiFormDrawer(
    {
      title: '库位与入仓指引',
      subtitle: '查看建议区域、当前位置和后道交接状态，可做本地入仓确认演示。',
      closeAction: { prefix: 'cutting-warehouse', action: 'close-overlay' },
      submitAction: {
        prefix: 'cutting-warehouse',
        action: 'save-location',
        label: record.inboundStatus === 'PENDING_INBOUND' ? '确认入仓' : '保存指引',
      },
      submitDisabled: isReadonly,
      width: 'md',
    },
    `
      <div class="space-y-5 text-sm">
        <section class="grid gap-4 rounded-lg border p-4 md:grid-cols-2">
          <div>
            <p class="text-xs text-muted-foreground">裁片单号</p>
            <p class="mt-1 font-medium text-foreground">${escapeHtml(record.cutPieceOrderNo)}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">分组</p>
            <p class="mt-1 font-medium text-foreground">${escapeHtml(record.groupNo)}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">当前区域</p>
            <p class="mt-1">${renderBadge(zoneMeta[record.zoneCode].label, zoneMeta[record.zoneCode].className)}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">后道交接状态</p>
            <p class="mt-1">${renderBadge(handoverStatusMeta[record.handoverStatus].label, handoverStatusMeta[record.handoverStatus].className)}</p>
          </div>
        </section>
        <section class="rounded-lg border p-4">
          <h3 class="font-semibold text-foreground">建议区域说明</h3>
          <p class="mt-3 text-muted-foreground">${escapeHtml(record.note)}</p>
          <p class="mt-2 text-sm text-muted-foreground">当前后续目标：${escapeHtml(record.handoverTarget)}</p>
        </section>
        <section class="grid gap-4 rounded-lg border p-4 md:grid-cols-2">
          <label class="space-y-2">
            <span class="text-sm font-medium text-foreground">入仓区域</span>
            <select
              class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              data-cutting-warehouse-draft="zoneCode"
              ${isReadonly ? 'disabled' : ''}
            >
              ${(['A', 'B', 'C'] as CutPieceZoneCode[])
                .map((zone) => `<option value="${zone}" ${state.locationDraft.zoneCode === zone ? 'selected' : ''}>${zoneMeta[zone].label}</option>`)
                .join('')}
            </select>
          </label>
          <label class="space-y-2">
            <span class="text-sm font-medium text-foreground">位置说明</span>
            <input
              class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              value="${escapeHtml(state.locationDraft.locationLabel)}"
              placeholder="例如：A 区 3 组"
              data-cutting-warehouse-draft="locationLabel"
              ${isReadonly ? 'disabled' : ''}
            />
          </label>
        </section>
        <label class="space-y-2 block">
          <span class="text-sm font-medium text-foreground">备注</span>
          <textarea
            class="min-h-[96px] w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="补充当前区域说明、待整理提示或交接备注。"
            data-cutting-warehouse-draft="note"
            ${isReadonly ? 'disabled' : ''}
          >${escapeHtml(state.locationDraft.note)}</textarea>
        </label>
        ${
          isReadonly
            ? '<p class="rounded-lg border border-dashed bg-muted/20 px-4 py-3 text-sm text-muted-foreground">当前记录已交接后道，仅保留查看与说明，不再允许修改入仓区域。</p>'
            : ''
        }
      </div>
    `,
  )
}

function renderSampleFlowDrawer(): string {
  if (state.activeOverlay !== 'sample-flow') return ''
  const record = findSampleRecord(state.activeRecordId)
  if (!record) return ''
  const canReturn = record.currentStatus === 'WAITING_RETURN' || record.currentStatus === 'IN_USE'

  return uiFormDrawer(
    {
      title: '样衣流转详情',
      subtitle: '查看样衣当前节点、关键历史时间线，并可做本地归还登记演示。',
      closeAction: { prefix: 'cutting-warehouse', action: 'close-overlay' },
      submitAction: {
        prefix: 'cutting-warehouse',
        action: 'save-sample-return',
        label: '登记归还',
      },
      submitDisabled: !canReturn,
      width: 'md',
    },
    `
      <div class="space-y-5 text-sm">
        <section class="grid gap-4 rounded-lg border p-4 md:grid-cols-2">
          <div>
            <p class="text-xs text-muted-foreground">样衣编号 / 名称</p>
            <p class="mt-1 font-medium text-foreground">${escapeHtml(record.sampleNo)} / ${escapeHtml(record.sampleName)}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">当前阶段</p>
            <p class="mt-1 font-medium text-foreground">${escapeHtml(sampleStageMeta[record.currentLocationStage])}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">当前持有人 / 所在位置</p>
            <p class="mt-1 font-medium text-foreground">${escapeHtml(record.currentHolder)}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">当前状态</p>
            <p class="mt-1">${renderBadge(sampleStatusMeta[record.currentStatus].label, sampleStatusMeta[record.currentStatus].className)}</p>
          </div>
        </section>
        <section class="rounded-lg border p-4">
          <div class="flex items-center justify-between gap-3">
            <h3 class="font-semibold text-foreground">历史流转时间线</h3>
            <span class="text-xs text-muted-foreground">最近动作 ${escapeHtml(formatDateTime(record.latestActionAt))}</span>
          </div>
          <ol class="mt-4 space-y-4">
            ${record.flowHistory
              .map(
                (item) => `
                  <li class="rounded-lg border bg-muted/20 p-4">
                    <div class="flex items-center justify-between gap-3">
                      <p class="font-medium text-foreground">${escapeHtml(sampleStageMeta[item.stage])}</p>
                      <span class="text-xs text-muted-foreground">${escapeHtml(formatDateTime(item.operatedAt))}</span>
                    </div>
                    <p class="mt-2 text-sm text-foreground">${escapeHtml(item.actionText)}</p>
                    <p class="mt-1 text-xs text-muted-foreground">操作人：${escapeHtml(item.operatedBy)}</p>
                    <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.note)}</p>
                  </li>
                `,
              )
              .join('')}
          </ol>
        </section>
        <section class="rounded-lg border p-4">
          <h3 class="font-semibold text-foreground">下一步建议动作</h3>
          <p class="mt-3 text-muted-foreground">${escapeHtml(record.nextSuggestedAction)}</p>
        </section>
        <label class="space-y-2 block">
          <span class="text-sm font-medium text-foreground">归还备注</span>
          <textarea
            class="min-h-[96px] w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="例如：样衣归还 PMC 仓，待下批裁床调用。"
            data-cutting-warehouse-sample-draft="note"
            ${canReturn ? '' : 'disabled'}
          >${escapeHtml(state.sampleDraft.note)}</textarea>
        </label>
        ${
          !canReturn
            ? '<p class="rounded-lg border border-dashed bg-muted/20 px-4 py-3 text-sm text-muted-foreground">当前样衣已处于可调用或抽检节点，无需重复登记归还。</p>'
            : '<p class="text-xs text-muted-foreground">说明：真实业务中的样衣流转主要由现场与仓务节点回写，这里只做运营查看与补录演示。</p>'
        }
      </div>
    `,
  )
}

function renderCurrentView(): string {
  if (state.activeTab === 'fabric') return renderFabricView()
  if (state.activeTab === 'cutPiece') return renderCutPieceView()
  return renderSampleView()
}

export function renderCraftCuttingWarehouseManagementPage(): string {
  return `
    <div class="space-y-2.5 p-4">
      ${renderPageHeader()}
      ${renderShortcutCardZone()}
      ${renderTabs()}
      ${renderActiveStateBar()}
      ${renderCurrentView()}
      ${renderAlertSection()}
      ${renderStockDetailDrawer()}
      ${renderLocationGuideDrawer()}
      ${renderSampleFlowDrawer()}
    </div>
  `
}

export function handleCraftCuttingWarehouseManagementEvent(target: Element): boolean {
  const pageSizeNode = target.closest<HTMLElement>('[data-cutting-warehouse-page-size]')
  if (pageSizeNode) {
    const tab = (pageSizeNode.dataset.tab as WarehouseTab | undefined) ?? state.activeTab
    const select = pageSizeNode as HTMLSelectElement
    const nextPageSize = Number(select.value)
    if (!Number.isFinite(nextPageSize)) return false
    state.pagination = {
      ...state.pagination,
      [tab]: {
        page: 1,
        pageSize: nextPageSize,
      },
    }
    return true
  }

  const fieldNode = target.closest<HTMLElement>('[data-cutting-warehouse-field]')
  if (fieldNode) {
    const scope = fieldNode.dataset.cuttingWarehouseScope as 'fabric' | 'cutPiece' | 'sample' | undefined
    const field = fieldNode.dataset.cuttingWarehouseField
    if (!scope || !field) return false
    const input = fieldNode as HTMLInputElement | HTMLSelectElement
    state.filters = {
      ...state.filters,
      [scope === 'fabric' ? 'cuttingFabric' : scope]: {
        ...(scope === 'fabric' ? state.filters.cuttingFabric : scope === 'cutPiece' ? state.filters.cutPiece : state.filters.sample),
        [field]: input.value,
      },
    } as WarehouseManagementState['filters']
    resetPagination(scope === 'fabric' ? 'fabric' : scope === 'cutPiece' ? 'cutPiece' : 'sample')
    return true
  }

  const locationDraftNode = target.closest<HTMLElement>('[data-cutting-warehouse-draft]')
  if (locationDraftNode) {
    const field = locationDraftNode.dataset.cuttingWarehouseDraft
    if (!field) return false
    const input = locationDraftNode as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    state.locationDraft = {
      ...state.locationDraft,
      [field]: input.value,
    }
    return true
  }

  const sampleDraftNode = target.closest<HTMLElement>('[data-cutting-warehouse-sample-draft]')
  if (sampleDraftNode) {
    const input = sampleDraftNode as HTMLTextAreaElement
    state.sampleDraft = {
      note: input.value,
    }
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-cutting-warehouse-action]')
  const action = actionNode?.dataset.cuttingWarehouseAction
  if (!action) return false

  const recordId = actionNode?.dataset.recordId ?? ''
  const tab = actionNode?.dataset.tab as WarehouseTab | undefined

  if (action === 'switch-tab' && tab) {
    setActiveTabWithReset(tab)
    alignCrossTabViewState(tab)
    return true
  }

  if (action === 'toggle-priority-mode') {
    const mode = actionNode?.dataset.priorityMode as WarehousePriorityMode | undefined
    if (!mode || !tab) return false
    setActiveTabWithReset(tab)
    alignCrossTabViewState(tab)
    state.activePriorityMode = state.activePriorityMode === mode ? null : mode
    resetPagination(tab)
    return true
  }

  if (action === 'clear-priority-mode') {
    state.activePriorityMode = null
    resetPagination()
    return true
  }

  if (action === 'toggle-kpi-filter') {
    const filter = actionNode?.dataset.kpiFilter as WarehouseKpiFilter | undefined
    if (!filter || !tab) return false
    setActiveTabWithReset(tab)
    alignCrossTabViewState(tab)
    state.activeKpiFilter = state.activeKpiFilter === filter ? null : filter
    resetPagination(tab)
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
    const targetTab = tab ?? state.activeTab
    if (!Number.isFinite(page)) return false
    state.pagination = {
      ...state.pagination,
      [targetTab]: {
        ...state.pagination[targetTab],
        page,
      },
    }
    return true
  }

  if (action === 'go-cut-piece-orders') {
    appStore.navigate('/fcs/craft/cutting/cut-piece-orders')
    return true
  }

  if (action === 'go-cutting-summary') {
    appStore.navigate('/fcs/craft/cutting/cutting-summary')
    return true
  }

  if (action === 'open-stock-detail' && recordId) {
    openOverlay('stock-detail', recordId)
    return true
  }

  if (action === 'open-location-guide' && recordId) {
    openOverlay('location-guide', recordId)
    return true
  }

  if (action === 'open-sample-flow' && recordId) {
    openOverlay('sample-flow', recordId)
    return true
  }

  if (action === 'save-location') {
    return saveLocationGuide()
  }

  if (action === 'save-sample-return') {
    return saveSampleReturn()
  }

  if (action === 'close-overlay') {
    closeOverlay()
    return true
  }

  return false
}

export function isCraftCuttingWarehouseManagementDialogOpen(): boolean {
  return state.activeOverlay !== null
}
