import { appStore } from '../../../state/store'
import { escapeHtml } from '../../../utils'
import {
  buildPrintableUnitDetailViewModel,
  canVoidTicketCard,
  CUTTING_FEI_TICKET_PRINT_JOBS_STORAGE_KEY,
  CUTTING_FEI_TICKET_RECORDS_STORAGE_KEY,
  executePrintableUnitPrint,
  filterPrintableUnits,
  getPrintableUnitStatusMeta,
  serializeFeiTicketPrintJobsStorage,
  serializeFeiTicketRecordsStorage,
  type FeiTicketLabelRecord,
  type FeiTicketPrintJob,
  type PrintableUnit,
  type PrintableUnitDetailViewModel,
  type PrintableUnitFilters,
  type PrintableUnitStatus,
  type PrintableUnitType,
  type PrintableUnitViewModel,
  type TicketCard,
  type TicketPrintRecord,
  type TicketSplitDetail,
  voidTicketCard,
} from './fei-tickets-model'
import {
  renderWorkbenchFilterChip,
  renderWorkbenchStateBar,
  renderStickyFilterShell,
  renderStickyTableScroller,
} from './layout.helpers'
import { getCanonicalCuttingMeta, getCanonicalCuttingPath, isCuttingAliasPath, renderCuttingPageHeader } from './meta'
import {
  buildCuttingDrillChipLabels,
  buildCuttingDrillSummary,
  buildCuttingRouteWithContext,
  buildReturnToSummaryContext,
  hasSummaryReturnContext,
  readCuttingDrillContextFromLocation,
  serializeCuttingDrillContext,
} from './navigation-context'
import {
  buildFeiTicketPrintProjection,
} from './fei-ticket-print-projection'
import type { OriginalCutOrderRow } from './original-orders-model'
import type { MaterialPrepRow } from './material-prep-model'
import type { MergeBatchRecord } from './merge-batches-model'
import type { MarkerSpreadingStore } from './marker-spreading-model'
import type { TransferBagStore } from './transfer-bags-model'
import type { CraftTraceProjection, CraftTraceProjectionItem } from './craft-trace-projection'

interface FeiTicketsPageState {
  filters: PrintableUnitFilters
  querySignature: string
  operationSignature: string
  operationDraft: FeiOperationDraft
}

interface FeiOperationDraft {
  operator: string
  printerName: string
  templateName: string
  reason: string
  remark: string
}

interface FeiTicketsDataBundle {
  originalRows: OriginalCutOrderRow[]
  materialPrepRows: MaterialPrepRow[]
  mergeBatches: MergeBatchRecord[]
  markerStore: MarkerSpreadingStore
  ticketRecords: FeiTicketLabelRecord[]
  printJobs: FeiTicketPrintJob[]
  transferBagStore: TransferBagStore
  printableViewModel: PrintableUnitViewModel
  craftTraceProjection: CraftTraceProjection
  filteredUnits: PrintableUnit[]
}

type DetailTabKey = 'split' | 'printed' | 'records'
type OperationPageKey = 'fei-ticket-print' | 'fei-ticket-continue-print' | 'fei-ticket-reprint' | 'fei-ticket-void'

type PrintableActionPageKey =
  | 'fei-ticket-detail'
  | 'fei-ticket-printed'
  | 'fei-ticket-records'
  | 'fei-ticket-print'
  | 'fei-ticket-continue-print'
  | 'fei-ticket-reprint'
  | 'fei-ticket-void'

const printableTypeMeta: Record<'ALL' | PrintableUnitType, string> = {
  ALL: '全部',
  BATCH: '裁片批次',
  CUT_ORDER: '裁片单',
}

const operationTypeMeta: Record<TicketPrintRecord['operationType'], string> = {
  FIRST_PRINT: '首次打印',
  CONTINUE_PRINT: '继续打印',
  REPRINT: '补打',
  VOID: '作废',
}

const ticketCardStatusMeta: Record<TicketCard['status'], { label: string; className: string }> = {
  VALID: {
    label: '有效',
    className: 'border border-emerald-200 bg-emerald-100 text-emerald-700',
  },
  VOIDED: {
    label: '已作废',
    className: 'border border-rose-200 bg-rose-100 text-rose-700',
  },
}

const initialFilters: PrintableUnitFilters = {
  keyword: '',
  printableUnitType: 'ALL',
  styleCode: '',
  fabricSku: '',
  productionOrderNo: '',
  printableUnitStatus: 'ALL',
  printedFrom: '',
  printedTo: '',
}

const state: FeiTicketsPageState = {
  filters: { ...initialFilters },
  querySignature: '',
  operationSignature: '',
  operationDraft: createDefaultOperationDraft(),
}

function createDefaultOperationDraft(): FeiOperationDraft {
  return {
    operator: '打票员-周莉',
    printerName: 'Zebra ZT411',
    templateName: '裁片菲票标准模板',
    reason: '',
    remark: '',
  }
}

function getCurrentPathname(): string {
  return appStore.getState().pathname.split('?')[0] || getCanonicalCuttingPath('fei-tickets')
}

function getCurrentQueryString(): string {
  const pathname = appStore.getState().pathname
  const [, query] = pathname.split('?')
  return query || ''
}

function getCurrentSearchParams(): URLSearchParams {
  return new URLSearchParams(getCurrentQueryString())
}

function buildRouteWithQuery(pathname: string, payload?: Record<string, string | undefined>): string {
  if (!payload) return pathname
  const params = new URLSearchParams()
  Object.entries(payload).forEach(([key, value]) => {
    if (value) params.set(key, value)
  })
  const query = params.toString()
  return query ? `${pathname}?${query}` : pathname
}

function clearCurrentFeiDrillRoute(): string {
  const pathname = getCurrentPathname()
  const params = getCurrentSearchParams()
  const drillPayload = serializeCuttingDrillContext(getCurrentDrillContext())
  Object.keys(drillPayload).forEach((key) => {
    params.delete(key)
  })
  return buildRouteWithQuery(pathname, Object.fromEntries(params.entries()))
}

function nowText(input = new Date()): string {
  const year = input.getFullYear()
  const month = `${input.getMonth() + 1}`.padStart(2, '0')
  const day = `${input.getDate()}`.padStart(2, '0')
  const hours = `${input.getHours()}`.padStart(2, '0')
  const minutes = `${input.getMinutes()}`.padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))))
}

function formatCount(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(Math.max(value, 0))
}

function formatDateTime(value: string): string {
  return value || '未打印'
}

function formatMaybeNumber(value: number | undefined, digits = 0): string {
  if (value === undefined || Number.isNaN(value)) return '待补录'
  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}

function truncate(value: string, maxLength = 36): string {
  if (!value) return '—'
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength)}...`
}

function formatOperationTypeLabel(value: TicketPrintRecord['operationType']): string {
  return operationTypeMeta[value]
}

function persistTicketRecords(records: FeiTicketLabelRecord[]): void {
  localStorage.setItem(CUTTING_FEI_TICKET_RECORDS_STORAGE_KEY, serializeFeiTicketRecordsStorage(records))
}

function persistPrintJobs(printJobs: FeiTicketPrintJob[]): void {
  localStorage.setItem(CUTTING_FEI_TICKET_PRINT_JOBS_STORAGE_KEY, serializeFeiTicketPrintJobsStorage(printJobs))
}

function mapLegacyStatus(value: string | null): 'ALL' | PrintableUnitStatus {
  if (!value) return 'ALL'
  if (value === 'WAITING_PRINT' || value === 'PARTIAL_PRINTED' || value === 'PRINTED' || value === 'NEED_REPRINT') {
    return value
  }
  if (value === 'NOT_GENERATED') return 'WAITING_PRINT'
  if (value === 'REPRINTED' || value === 'PENDING_SUPPLEMENT') return 'NEED_REPRINT'
  return 'ALL'
}

function inferPrintableUnitType(params: URLSearchParams): 'ALL' | PrintableUnitType {
  const explicit = params.get('printableUnitType')
  if (explicit === 'BATCH' || explicit === 'CUT_ORDER') return explicit
  if (params.get('mergeBatchId') || params.get('mergeBatchNo')) return 'BATCH'
  if (params.get('originalCutOrderId') || params.get('originalCutOrderNo')) return 'CUT_ORDER'
  return 'ALL'
}

function getCurrentDrillContext() {
  return readCuttingDrillContextFromLocation(getCurrentSearchParams())
}

function renderReturnToSummaryButton(): string {
  if (!hasSummaryReturnContext(getCurrentDrillContext())) return ''
  return `<button type="button" data-cutting-fei-action="return-summary" class="inline-flex min-h-10 items-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">返回裁剪总表</button>`
}

function buildFiltersFromQuery(params: URLSearchParams): PrintableUnitFilters {
  const drillContext = readCuttingDrillContextFromLocation(params)
  const keyword =
    params.get('keyword') ||
    drillContext?.printableUnitNo ||
    drillContext?.ticketNo ||
    drillContext?.originalCutOrderNo ||
    drillContext?.mergeBatchNo ||
    ''
  return {
    keyword,
    printableUnitType: inferPrintableUnitType(params),
    styleCode: drillContext?.styleCode || params.get('styleCode') || '',
    fabricSku: params.get('fabricSku') || drillContext?.materialSku || params.get('materialSku') || '',
    productionOrderNo: drillContext?.productionOrderNo || params.get('productionOrderNo') || '',
    printableUnitStatus: mapLegacyStatus(params.get('printableUnitStatus') || params.get('ticketStatus')),
    printedFrom: params.get('printedFrom') || '',
    printedTo: params.get('printedTo') || '',
  }
}

function hydrateFilterStateFromRoute(): void {
  const pathname = getCurrentPathname()
  const querySignature = `${pathname}?${getCurrentQueryString()}`
  if (pathname !== getCanonicalCuttingPath('fei-tickets')) return
  if (state.querySignature === querySignature) return
  const params = getCurrentSearchParams()
  state.filters = buildFiltersFromQuery(params)
  state.querySignature = querySignature
}

function hydrateOperationDraftFromRoute(): void {
  const pathname = getCurrentPathname()
  const isOperationPage = new Set<OperationPageKey>([
    'fei-ticket-print',
    'fei-ticket-continue-print',
    'fei-ticket-reprint',
    'fei-ticket-void',
  ]).has(getCanonicalCuttingMeta(pathname, 'fei-tickets').key as OperationPageKey)

  const signature = `${pathname}?${getCurrentQueryString()}`
  if (!isOperationPage) {
    state.operationSignature = ''
    return
  }
  if (state.operationSignature === signature) return

  const draft = createDefaultOperationDraft()
  if (pathname === getCanonicalCuttingPath('fei-ticket-reprint')) {
    draft.reason = '作废后补打'
  }
  if (pathname === getCanonicalCuttingPath('fei-ticket-void')) {
    draft.reason = ''
    draft.printerName = ''
    draft.templateName = ''
  }
  state.operationDraft = draft
  state.operationSignature = signature
}

function getDataBundle(): FeiTicketsDataBundle {
  hydrateFilterStateFromRoute()
  hydrateOperationDraftFromRoute()
  const projection = buildFeiTicketPrintProjection()

  return {
    originalRows: projection.originalRows,
    materialPrepRows: projection.materialPrepRows,
    mergeBatches: projection.mergeBatches,
    markerStore: projection.markerStore,
    ticketRecords: projection.ticketRecords,
    printJobs: projection.printJobs,
    transferBagStore: projection.transferBagStore,
    printableViewModel: projection.printableViewModel,
    craftTraceProjection: projection.craftTraceProjection,
    filteredUnits: filterPrintableUnits(projection.printableViewModel.units, state.filters),
  }
}

function buildPrintableUnitQuery(unit: PrintableUnit): Record<string, string | undefined> {
  return {
    printableUnitId: unit.printableUnitId,
    printableUnitNo: unit.printableUnitNo,
    printableUnitType: unit.printableUnitType,
    batchId: unit.batchId || undefined,
    batchNo: unit.batchNo || undefined,
    originalCutOrderId: unit.cutOrderId || undefined,
    originalCutOrderNo: unit.cutOrderNo || undefined,
    cutOrderId: unit.cutOrderId || undefined,
    cutOrderNo: unit.cutOrderNo || undefined,
    productionOrderId: unit.sourceProductionOrderIds[0] || undefined,
    sourceProductionOrderNo: unit.sourceProductionOrderNos[0] || undefined,
    productionOrderNo: unit.sourceProductionOrderNos[0] || undefined,
    styleCode: unit.styleCode || undefined,
    materialSku: unit.fabricSku || undefined,
    fabricSku: unit.fabricSku || undefined,
  }
}

function buildDetailRoute(
  pageKey: 'fei-ticket-detail' | 'fei-ticket-printed' | 'fei-ticket-records',
  unit: PrintableUnit,
  payload?: Record<string, string | undefined>,
): string {
  return buildRouteWithQuery(getCanonicalCuttingPath(pageKey), {
    ...serializeCuttingDrillContext(getCurrentDrillContext()),
    ...buildPrintableUnitQuery(unit),
    ...payload,
  })
}

function buildActionHref(
  pageKey: PrintableActionPageKey,
  unit: PrintableUnit,
  payload?: Record<string, string | undefined>,
): string {
  return buildRouteWithQuery(getCanonicalCuttingPath(pageKey), {
    ...serializeCuttingDrillContext(getCurrentDrillContext()),
    ...buildPrintableUnitQuery(unit),
    ...payload,
  })
}

function findUnit(bundle: FeiTicketsDataBundle): PrintableUnit | null {
  const params = getCurrentSearchParams()
  const printableUnitId = params.get('printableUnitId')
  const printableUnitNo = params.get('printableUnitNo')
  if (printableUnitId && bundle.printableViewModel.unitsById[printableUnitId]) {
    return bundle.printableViewModel.unitsById[printableUnitId]
  }
  if (printableUnitNo) {
    return bundle.printableViewModel.units.find((unit) => unit.printableUnitNo === printableUnitNo) || null
  }
  return null
}

function getDetailTab(pathname: string): DetailTabKey {
  if (pathname === getCanonicalCuttingPath('fei-ticket-printed')) return 'printed'
  if (pathname === getCanonicalCuttingPath('fei-ticket-records')) return 'records'
  const explicit = getCurrentSearchParams().get('tab')
  if (explicit === 'printed' || explicit === 'records') return explicit
  return 'split'
}

function findTicketCard(detailViewModel: PrintableUnitDetailViewModel | null): TicketCard | null {
  if (!detailViewModel) return null
  const params = getCurrentSearchParams()
  const ticketId = params.get('ticketRecordId') || params.get('ticketId')
  if (!ticketId) return null
  return detailViewModel.ticketCards.find((ticket) => ticket.ticketId === ticketId) || null
}

function renderBadge(label: string, className: string): string {
  return `<span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}">${escapeHtml(label)}</span>`
}

function renderUnitTypeBadge(type: PrintableUnitType): string {
  const className =
    type === 'BATCH'
      ? 'border border-violet-200 bg-violet-100 text-violet-700'
      : 'border border-slate-200 bg-slate-100 text-slate-700'
  return renderBadge(printableTypeMeta[type], className)
}

function renderStatusBadge(status: PrintableUnitStatus): string {
  const meta = getPrintableUnitStatusMeta(status)
  return renderBadge(meta.label, meta.className)
}

function renderTicketStatusBadge(status: TicketCard['status']): string {
  return renderBadge(ticketCardStatusMeta[status].label, ticketCardStatusMeta[status].className)
}

function renderStatusTab(status: 'ALL' | PrintableUnitStatus, label: string, count: number, active: boolean): string {
  const activeClass = active
    ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
  return `
    <button
      type="button"
      data-cutting-fei-action="set-status"
      data-status="${status}"
      class="inline-flex min-h-9 items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition whitespace-nowrap ${activeClass}"
    >
      <span>${escapeHtml(label)}</span>
      <span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">${formatCount(count)}</span>
    </button>
  `
}

function renderFilterArea(): string {
  return renderStickyFilterShell(`
    <div class="space-y-4">
      <div class="flex items-center justify-between gap-3">
        <h2 class="text-sm font-semibold text-slate-900">筛选条件</h2>
        <button type="button" data-cutting-fei-action="reset-filters" class="inline-flex min-h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-50">清空筛选</button>
      </div>
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label class="space-y-1 text-sm text-slate-600">
          <span class="font-medium text-slate-700">可打印单元号</span>
          <input
            type="text"
            value="${escapeHtml(state.filters.keyword)}"
            data-cutting-fei-field="keyword"
            placeholder="输入裁片批次号 / 原始裁片单号"
            class="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        </label>
        <label class="space-y-1 text-sm text-slate-600">
          <span class="font-medium text-slate-700">单元类型</span>
          <select
            data-cutting-fei-field="printableUnitType"
            class="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          >
            ${(['ALL', 'BATCH', 'CUT_ORDER'] as const)
              .map((item) => `<option value="${item}" ${item === state.filters.printableUnitType ? 'selected' : ''}>${printableTypeMeta[item]}</option>`)
              .join('')}
          </select>
        </label>
        <label class="space-y-1 text-sm text-slate-600">
          <span class="font-medium text-slate-700">款号 / 款式编码</span>
          <input
            type="text"
            value="${escapeHtml(state.filters.styleCode)}"
            data-cutting-fei-field="styleCode"
            placeholder="输入款号 / 款式编码"
            class="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        </label>
        <label class="space-y-1 text-sm text-slate-600">
          <span class="font-medium text-slate-700">面料 SKU</span>
          <input
            type="text"
            value="${escapeHtml(state.filters.fabricSku)}"
            data-cutting-fei-field="fabricSku"
            placeholder="输入面料 SKU"
            class="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        </label>
        <label class="space-y-1 text-sm text-slate-600">
          <span class="font-medium text-slate-700">来源生产单号</span>
          <input
            type="text"
            value="${escapeHtml(state.filters.productionOrderNo)}"
            data-cutting-fei-field="productionOrderNo"
            placeholder="输入来源生产单号"
            class="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        </label>
        <label class="space-y-1 text-sm text-slate-600">
          <span class="font-medium text-slate-700">打印状态</span>
          <select
            data-cutting-fei-field="printableUnitStatus"
            class="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          >
            <option value="ALL" ${state.filters.printableUnitStatus === 'ALL' ? 'selected' : ''}>全部</option>
            ${(['WAITING_PRINT', 'PARTIAL_PRINTED', 'PRINTED', 'NEED_REPRINT'] as const)
              .map((status) => {
                const meta = getPrintableUnitStatusMeta(status)
                return `<option value="${status}" ${state.filters.printableUnitStatus === status ? 'selected' : ''}>${meta.label}</option>`
              })
              .join('')}
          </select>
        </label>
        <label class="space-y-1 text-sm text-slate-600">
          <span class="font-medium text-slate-700">最近打印开始日期</span>
          <input
            type="date"
            value="${escapeHtml(state.filters.printedFrom)}"
            data-cutting-fei-field="printedFrom"
            class="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        </label>
        <label class="space-y-1 text-sm text-slate-600">
          <span class="font-medium text-slate-700">最近打印结束日期</span>
          <input
            type="date"
            value="${escapeHtml(state.filters.printedTo)}"
            data-cutting-fei-field="printedTo"
            class="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        </label>
      </div>
    </div>
  `)
}

function renderStatusTabsArea(bundle: FeiTicketsDataBundle): string {
  const statusCounts = bundle.printableViewModel.statusCounts
  const totalCount = bundle.printableViewModel.units.length

  return `
    <section class="rounded-lg border bg-white p-3 shadow-sm">
      <div class="flex flex-wrap gap-2">
        ${renderStatusTab('ALL', '全部', totalCount, state.filters.printableUnitStatus === 'ALL')}
        ${renderStatusTab('WAITING_PRINT', '待打印', statusCounts.WAITING_PRINT, state.filters.printableUnitStatus === 'WAITING_PRINT')}
        ${renderStatusTab('PARTIAL_PRINTED', '部分打印', statusCounts.PARTIAL_PRINTED, state.filters.printableUnitStatus === 'PARTIAL_PRINTED')}
        ${renderStatusTab('PRINTED', '已打印', statusCounts.PRINTED, state.filters.printableUnitStatus === 'PRINTED')}
        ${renderStatusTab('NEED_REPRINT', '需补打', statusCounts.NEED_REPRINT, state.filters.printableUnitStatus === 'NEED_REPRINT')}
      </div>
    </section>
  `
}

function buildRowActionGroups(unit: PrintableUnit): {
  primary: { label: string; href: string } | null
  secondary: { label: string; href: string }
  more: Array<{ label: string; href: string }>
} {
  const detailHref = buildActionHref('fei-ticket-detail', unit)
  const printedHref = buildActionHref('fei-ticket-printed', unit)
  const recordsHref = buildActionHref('fei-ticket-records', unit)
  const printHref = buildActionHref('fei-ticket-print', unit)
  const continueHref = buildActionHref('fei-ticket-continue-print', unit)
  const reprintHref = buildActionHref('fei-ticket-reprint', unit)

  if (unit.printableUnitStatus === 'WAITING_PRINT') {
    return {
      primary: { label: '打印菲票', href: printHref },
      secondary: { label: '查看详情', href: detailHref },
      more: [],
    }
  }

  if (unit.printableUnitStatus === 'PARTIAL_PRINTED') {
    return {
      primary: { label: '继续打印', href: continueHref },
      secondary: { label: '查看详情', href: detailHref },
      more: [
        { label: '查看已打印菲票', href: printedHref },
        { label: '查看打印记录', href: recordsHref },
      ],
    }
  }

  if (unit.printableUnitStatus === 'NEED_REPRINT') {
    return {
      primary: { label: '补打', href: reprintHref },
      secondary: { label: '查看详情', href: detailHref },
      more: [
        { label: '查看已打印菲票', href: printedHref },
        { label: '查看打印记录', href: recordsHref },
      ],
    }
  }

  return {
    primary: null,
    secondary: { label: '查看详情', href: detailHref },
    more: [
      { label: '查看已打印菲票', href: printedHref },
      { label: '查看打印记录', href: recordsHref },
    ],
  }
}

function renderRowActions(unit: PrintableUnit): string {
  const actions = buildRowActionGroups(unit)

  return `
    <div class="flex items-center gap-2 whitespace-nowrap">
      ${
        actions.primary
          ? `<button type="button" data-nav="${escapeHtml(actions.primary.href)}" class="inline-flex min-h-8 items-center rounded-md border border-blue-600 bg-blue-600 px-3 text-xs font-medium text-white transition hover:bg-blue-700">${escapeHtml(actions.primary.label)}</button>`
          : ''
      }
      <button type="button" data-nav="${escapeHtml(actions.secondary.href)}" class="inline-flex min-h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-50">${escapeHtml(actions.secondary.label)}</button>
      ${
        actions.more.length
          ? `
            <details class="relative">
              <summary class="inline-flex min-h-8 cursor-pointer list-none items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-50">更多</summary>
              <div class="absolute right-0 z-20 mt-2 min-w-[144px] rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg">
                ${actions.more
                  .map(
                    (action) => `
                      <button type="button" data-nav="${escapeHtml(action.href)}" class="flex w-full items-center rounded-md px-2.5 py-2 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-50">
                        ${escapeHtml(action.label)}
                      </button>
                    `,
                  )
                  .join('')}
              </div>
            </details>
          `
          : ''
      }
    </div>
  `
}

function renderTruncatedText(value: string, fallback = '—', maxWidthClass = 'max-w-[12rem]'): string {
  const text = value || fallback
  return `<span class="block ${maxWidthClass} truncate whitespace-nowrap" title="${escapeHtml(text)}">${escapeHtml(text)}</span>`
}

function renderPrintablePageShell(content: string, options?: { showLocateBar?: boolean }): string {
  const drillContext = getCurrentDrillContext()
  const locateBar =
    options?.showLocateBar !== false &&
    drillContext &&
    renderWorkbenchStateBar({
      summary: buildCuttingDrillSummary(drillContext),
      chips: buildCuttingDrillChipLabels(drillContext).map((label) => renderWorkbenchFilterChip(label, '', 'amber')),
      clearAttrs: 'data-cutting-fei-action="clear-locate"',
    })
  return `<div class="space-y-3 p-4">${locateBar || ''}${content}</div>`
}

function renderListTable(bundle: FeiTicketsDataBundle): string {
  if (!bundle.filteredUnits.length) {
    const title = bundle.printableViewModel.units.length ? '暂无匹配结果' : '暂无待打印对象'

    return `
      <section class="rounded-lg border bg-white px-6 py-10 text-center shadow-sm">
        <h2 class="text-base font-semibold text-slate-900">${escapeHtml(title)}</h2>
      </section>
    `
  }

  const tableHtml = `
    <table class="min-w-full text-sm">
      <thead class="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
        <tr>
          <th class="px-3 py-3 text-left font-medium">可打印单元号</th>
          <th class="px-3 py-3 text-left font-medium">单元类型</th>
          <th class="px-3 py-3 text-left font-medium">款号</th>
          <th class="px-3 py-3 text-left font-medium">面料 SKU</th>
          <th class="px-3 py-3 text-left font-medium">来源生产单数</th>
          <th class="px-3 py-3 text-left font-medium">来源裁片单数</th>
          <th class="px-3 py-3 text-left font-medium">应打菲票数</th>
          <th class="px-3 py-3 text-left font-medium">有效已打印数</th>
          <th class="px-3 py-3 text-left font-medium">未打印 / 缺口数</th>
          <th class="px-3 py-3 text-left font-medium">已作废数</th>
          <th class="px-3 py-3 text-left font-medium">打印状态</th>
          <th class="px-3 py-3 text-left font-medium">最近打印时间</th>
          <th class="px-3 py-3 text-left font-medium">最近打印人</th>
          <th class="px-3 py-3 text-left font-medium">操作</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100 bg-white">
        ${bundle.filteredUnits
          .map((unit) => {
            const statusMeta = getPrintableUnitStatusMeta(unit.printableUnitStatus)
            return `
              <tr class="hover:bg-slate-50/60">
                <td class="px-3 py-2.5">
                  <button type="button" data-nav="${escapeHtml(buildActionHref('fei-ticket-detail', unit))}" class="text-left font-semibold text-blue-700 hover:underline" title="${escapeHtml(unit.printableUnitNo)}">
                    ${renderTruncatedText(unit.printableUnitNo, '—', 'max-w-[13rem]')}
                  </button>
                </td>
                <td class="px-3 py-2.5 whitespace-nowrap">${renderUnitTypeBadge(unit.printableUnitType)}</td>
                <td class="px-3 py-2.5 text-slate-700">${renderTruncatedText(unit.styleCode || '待补款号', '待补款号', 'max-w-[8rem]')}</td>
                <td class="px-3 py-2.5 text-slate-700">${renderTruncatedText(unit.fabricSku || '待补面料', '待补面料', 'max-w-[10rem]')}</td>
                <td class="px-3 py-2.5 text-slate-700">${formatCount(unit.sourceProductionOrderCount)}</td>
                <td class="px-3 py-2.5 text-slate-700">${formatCount(unit.sourceCutOrderCount)}</td>
                <td class="px-3 py-2.5 font-medium text-slate-900">${formatCount(unit.requiredTicketCount)}</td>
                <td class="px-3 py-2.5 text-slate-700">${formatCount(unit.validPrintedTicketCount)}</td>
                <td class="px-3 py-2.5 text-slate-700">${formatCount(unit.missingTicketCount)}</td>
                <td class="px-3 py-2.5 text-slate-700">${formatCount(unit.voidedTicketCount)}</td>
                <td class="px-3 py-2.5 whitespace-nowrap">
                  <div class="flex items-center gap-2">
                    ${renderBadge(statusMeta.label, statusMeta.className)}
                    <span class="text-xs text-slate-500">缺口 ${formatCount(unit.missingTicketCount)}</span>
                  </div>
                </td>
                <td class="px-3 py-2.5 text-slate-700">${renderTruncatedText(formatDateTime(unit.lastPrintedAt), '未打印', 'max-w-[8rem]')}</td>
                <td class="px-3 py-2.5 text-slate-700">${renderTruncatedText(unit.lastPrintedBy || '未打印', '未打印', 'max-w-[6rem]')}</td>
                <td class="px-3 py-2.5">
                  <div class="min-w-[180px]">
                    ${renderRowActions(unit)}
                  </div>
                </td>
              </tr>
            `
          })
          .join('')}
      </tbody>
    </table>
  `

  return `
    <section class="rounded-lg border bg-white shadow-sm">
      ${renderStickyTableScroller(tableHtml, 'max-h-[68vh]')}
    </section>
  `
}

function renderListPage(): string {
  const bundle = getDataBundle()
  const pathname = getCurrentPathname()
  const meta = getCanonicalCuttingMeta(pathname, 'fei-tickets')
  const summaryAction = renderReturnToSummaryButton()

  return renderPrintablePageShell(`
    ${renderCuttingPageHeader(meta, {
      showCompatibilityBadge: isCuttingAliasPath(pathname),
      actionsHtml: summaryAction ? `<div class="flex flex-wrap gap-2">${summaryAction}</div>` : '',
    })}
    ${renderFilterArea()}
    ${renderStatusTabsArea(bundle)}
    ${renderListTable(bundle)}
  `)
}

function renderBackToList(unit: PrintableUnit | null): string {
  return `<button type="button" data-nav="${escapeHtml(unit ? buildActionHref('fei-tickets', unit) : getCanonicalCuttingPath('fei-tickets'))}" class="inline-flex min-h-10 items-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">返回打印菲票列表</button>`
}

function renderDetailHeaderActions(unit: PrintableUnit): string {
  const actions = buildRowActionGroups(unit)
  return `
    <div class="flex flex-wrap gap-2">
      ${
        actions.primary
          ? `<button type="button" data-nav="${escapeHtml(actions.primary.href)}" class="inline-flex min-h-10 items-center rounded-md border border-blue-600 bg-blue-600 px-3 text-sm font-medium text-white transition hover:bg-blue-700">${escapeHtml(actions.primary.label)}</button>`
          : ''
      }
      <button type="button" data-nav="${escapeHtml(actions.secondary.href)}" class="inline-flex min-h-10 items-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50">${escapeHtml(actions.secondary.label)}</button>
      ${
        actions.more.length
          ? actions.more
              .map(
                (action) => `<button type="button" data-nav="${escapeHtml(action.href)}" class="inline-flex min-h-10 items-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50">${escapeHtml(action.label)}</button>`,
              )
              .join('')
          : ''
      }
    </div>
  `
}

function renderDetailSummary(detailView: PrintableUnitDetailViewModel): string {
  const { unit } = detailView
  return `
    <section class="rounded-lg border bg-white p-4 shadow-sm">
      <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p class="text-xs text-slate-500">可打印单元号</p>
            <p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(unit.printableUnitNo)}</p>
          </div>
          <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p class="text-xs text-slate-500">单元类型</p>
            <div class="mt-1">${renderUnitTypeBadge(unit.printableUnitType)}</div>
          </div>
          <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p class="text-xs text-slate-500">款号</p>
            <p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(unit.styleCode || '待补款号')}</p>
          </div>
          <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p class="text-xs text-slate-500">面料 SKU</p>
            <p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(unit.fabricSku || '待补面料')}</p>
          </div>
          <div class="rounded-lg border border-slate-200 bg-white p-3">
            <p class="text-xs text-slate-500">来源生产单数</p>
            <p class="mt-1 text-xl font-semibold text-slate-900">${formatCount(unit.sourceProductionOrderCount)}</p>
          </div>
          <div class="rounded-lg border border-slate-200 bg-white p-3">
            <p class="text-xs text-slate-500">来源裁片单数</p>
            <p class="mt-1 text-xl font-semibold text-slate-900">${formatCount(unit.sourceCutOrderCount)}</p>
          </div>
          <div class="rounded-lg border border-slate-200 bg-white p-3">
            <p class="text-xs text-slate-500">应打菲票数</p>
            <p class="mt-1 text-xl font-semibold text-slate-900">${formatCount(unit.requiredTicketCount)}</p>
          </div>
          <div class="rounded-lg border border-slate-200 bg-white p-3">
            <p class="text-xs text-slate-500">有效已打印数</p>
            <p class="mt-1 text-xl font-semibold text-slate-900">${formatCount(unit.validPrintedTicketCount)}</p>
          </div>
          <div class="rounded-lg border border-slate-200 bg-white p-3">
            <p class="text-xs text-slate-500">已作废数</p>
            <p class="mt-1 text-xl font-semibold text-slate-900">${formatCount(unit.voidedTicketCount)}</p>
          </div>
          <div class="rounded-lg border border-slate-200 bg-white p-3">
            <p class="text-xs text-slate-500">当前状态</p>
            <div class="mt-1">${renderStatusBadge(unit.printableUnitStatus)}</div>
          </div>
          <div class="rounded-lg border border-slate-200 bg-white p-3">
            <p class="text-xs text-slate-500">最近打印时间</p>
            <p class="mt-1 text-sm font-medium text-slate-900">${escapeHtml(formatDateTime(unit.lastPrintedAt))}</p>
          </div>
          <div class="rounded-lg border border-slate-200 bg-white p-3">
            <p class="text-xs text-slate-500">最近打印人</p>
            <p class="mt-1 text-sm font-medium text-slate-900">${escapeHtml(unit.lastPrintedBy || '未打印')}</p>
          </div>
        </div>
        ${renderDetailHeaderActions(unit)}
      </div>
    </section>
  `
}

function renderDetailTabs(unit: PrintableUnit, activeTab: DetailTabKey): string {
  const tabs: Array<{ key: DetailTabKey; label: string; href: string }> = [
    { key: 'split', label: '菲票拆分明细', href: buildDetailRoute('fei-ticket-detail', unit, { tab: 'split' }) },
    { key: 'printed', label: '已打印菲票', href: buildDetailRoute('fei-ticket-printed', unit) },
    { key: 'records', label: '打印记录', href: buildDetailRoute('fei-ticket-records', unit) },
  ]

  return `
    <section class="rounded-lg border bg-white p-3 shadow-sm">
      <div class="flex flex-wrap gap-2">
        ${tabs
          .map((tab) => {
            const active = tab.key === activeTab
            const className = active
              ? 'border-blue-500 bg-blue-50 text-blue-700'
              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
            return `<button type="button" data-nav="${escapeHtml(tab.href)}" class="inline-flex min-h-10 items-center rounded-lg border px-4 text-sm font-medium transition ${className}">${escapeHtml(tab.label)}</button>`
          })
          .join('')}
      </div>
    </section>
  `
}

function renderSectionCard(title: string, _subtitle: string, content: string): string {
  return `
    <section class="rounded-lg border bg-white shadow-sm">
      <div class="border-b border-slate-200 px-4 py-3">
        <h2 class="text-sm font-semibold text-slate-900">${escapeHtml(title)}</h2>
      </div>
      <div class="p-4">${content}</div>
    </section>
  `
}

function renderSplitDetailsTab(detailView: PrintableUnitDetailViewModel): string {
  const tableHtml = `
    <table class="min-w-full text-sm">
      <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
        <tr>
          <th class="px-3 py-3 text-left font-medium">部位名称</th>
          <th class="px-3 py-3 text-left font-medium">颜色</th>
          <th class="px-3 py-3 text-left font-medium">尺码</th>
          <th class="px-3 py-3 text-left font-medium">数量</th>
          <th class="px-3 py-3 text-left font-medium">来源原始裁片单号</th>
          <th class="px-3 py-3 text-left font-medium">来源生产单号</th>
          <th class="px-3 py-3 text-left font-medium">所属裁片批次号</th>
          <th class="px-3 py-3 text-left font-medium">应生成菲票数量</th>
          <th class="px-3 py-3 text-left font-medium">已生成有效菲票数量</th>
          <th class="px-3 py-3 text-left font-medium">缺口数量</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100 bg-white">
        ${detailView.splitDetails
          .map(
            (detail) => `
              <tr>
                <td class="px-3 py-3 font-medium text-slate-900">${escapeHtml(detail.partName)}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(detail.color || '待补颜色')}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(detail.size || '待补尺码')}</td>
                <td class="px-3 py-3 text-slate-700">${formatCount(detail.quantity)}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(detail.sourceCutOrderNo)}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(detail.sourceProductionOrderNo)}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(detail.batchNo || '—')}</td>
                <td class="px-3 py-3 text-slate-700">${formatCount(detail.requiredTicketCount)}</td>
                <td class="px-3 py-3 text-slate-700">${formatCount(detail.validPrintedTicketCount)}</td>
                <td class="px-3 py-3 text-slate-700">${formatCount(detail.gapCount)}</td>
              </tr>
            `,
          )
          .join('')}
      </tbody>
    </table>
  `

  return renderSectionCard(
    '菲票拆分明细',
    '',
    renderStickyTableScroller(tableHtml, 'max-h-[60vh]'),
  )
}

function buildTicketPanelHref(unit: PrintableUnit, ticket: TicketCard, panel: 'qr' | 'preview' | 'void-info'): string {
  return buildActionHref('fei-ticket-printed', unit, {
    ticketId: ticket.ticketId,
    ticketRecordId: ticket.ticketId,
    panel,
  })
}

function findCraftTraceItem(bundle: FeiTicketsDataBundle, ticket: TicketCard | null): CraftTraceProjectionItem | null {
  if (!ticket) return null
  return bundle.craftTraceProjection.itemsByTicketId[ticket.ticketId] || bundle.craftTraceProjection.itemsByTicketNo[ticket.ticketNo] || null
}

function renderTicketPreviewPanel(unit: PrintableUnit, ticket: TicketCard | null): string {
  if (!ticket) return ''
  const bundle = getDataBundle()
  const craftTrace = findCraftTraceItem(bundle, ticket)
  const panel = getCurrentSearchParams().get('panel') || 'qr'
  const title = panel === 'void-info' ? '作废与替代信息' : panel === 'preview' ? '打印预览' : '菲票码预览'
  const body =
    panel === 'void-info'
      ? `
        <div class="grid gap-3 md:grid-cols-2">
          <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p class="text-xs text-slate-500">作废原因</p>
            <p class="mt-1 text-sm text-slate-900">${escapeHtml(ticket.voidReason || '暂无作废原因')}</p>
          </div>
          <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p class="text-xs text-slate-500">替代菲票号</p>
            <p class="mt-1 text-sm text-slate-900">${escapeHtml(ticket.replacementTicketNo || '暂无替代菲票')}</p>
          </div>
        </div>
      `
      : panel === 'preview'
        ? `
          <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p class="text-xs uppercase tracking-wide text-slate-500">裁片菲票预览</p>
            <div class="mt-3 grid gap-3 md:grid-cols-2">
              <div>
                <p class="text-sm text-slate-500">票号</p>
                <p class="text-lg font-semibold text-slate-900">${escapeHtml(ticket.ticketNo)}</p>
              </div>
              <div>
                <p class="text-sm text-slate-500">面料 SKU</p>
                <p class="text-lg font-semibold text-slate-900">${escapeHtml(craftTrace?.materialSku || unit.fabricSku || '待补')}</p>
                <p class="mt-1 text-xs text-slate-500">${escapeHtml(`${ticket.color} / ${ticket.size}`)}</p>
              </div>
              <div>
                <p class="text-sm text-slate-500">裁片部位</p>
                <p class="text-lg font-semibold text-slate-900">${escapeHtml(ticket.partName)}</p>
              </div>
              <div>
                <p class="text-sm text-slate-500">原始裁片单 / 生产单</p>
                <p class="text-sm font-semibold text-slate-900">${escapeHtml(`${craftTrace?.originalCutOrderNo || ticket.sourceCutOrderNo} / ${craftTrace?.productionOrderNo || ticket.sourceProductionOrderNo || '待补生产单'}`)}</p>
              </div>
              <div>
                <p class="text-sm text-slate-500">工艺顺序</p>
                <p class="text-sm font-semibold text-slate-900">${escapeHtml(craftTrace?.secondaryCrafts.join(' → ') || '未配置')}</p>
                <p class="mt-1 text-xs text-slate-500">${escapeHtml(`版本 ${craftTrace?.craftSequenceVersion || '待补'} / 当前 ${craftTrace?.currentCraftStage || '未开始'}`)}</p>
              </div>
              <div class="md:col-span-2">
                <p class="text-sm text-slate-500">顺序校验 / 载具绑定</p>
                <p class="text-sm font-semibold ${craftTrace?.validation.allowed ? 'text-emerald-700' : 'text-amber-700'}">${escapeHtml(craftTrace?.validation.reason || '待补校验结果')}</p>
                <p class="mt-1 text-xs text-slate-500">${escapeHtml(craftTrace?.carrierCode ? `已装入 ${craftTrace.carrierCode} / 周期 ${craftTrace.usageNo || '待补'}` : '当前未装袋')}</p>
              </div>
              <div>
                <p class="text-sm text-slate-500">数量</p>
                <p class="text-lg font-semibold text-slate-900">${formatCount(ticket.quantity)}</p>
              </div>
            </div>
          </div>
        `
        : `
          <div class="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <p class="text-xs text-blue-600">菲票码值</p>
            <p class="mt-2 break-all text-sm font-medium text-blue-900">${escapeHtml(ticket.qrPayload)}</p>
            <div class="mt-3 grid gap-2 text-xs text-blue-900/80 md:grid-cols-2">
              <div>原始裁片单：${escapeHtml(craftTrace?.originalCutOrderNo || ticket.sourceCutOrderNo)}</div>
              <div>生产单：${escapeHtml(craftTrace?.productionOrderNo || ticket.sourceProductionOrderNo || '待补')}</div>
              <div>面料 SKU：${escapeHtml(craftTrace?.materialSku || unit.fabricSku || '待补')}</div>
              <div>工艺版本：${escapeHtml(craftTrace?.craftSequenceVersion || '待补')}</div>
            </div>
          </div>
        `

  return renderSectionCard(title, '', body)
}

function renderPrintedTicketsTab(unit: PrintableUnit, detailView: PrintableUnitDetailViewModel): string {
  const craftTraceProjection = getDataBundle().craftTraceProjection
  const selectedTicket = findTicketCard(detailView)
  const tableHtml = `
    <table class="min-w-full text-sm">
      <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
        <tr>
          <th class="px-3 py-3 text-left font-medium">菲票号</th>
          <th class="px-3 py-3 text-left font-medium">款号</th>
          <th class="px-3 py-3 text-left font-medium">面料 SKU</th>
          <th class="px-3 py-3 text-left font-medium">裁片部位</th>
          <th class="px-3 py-3 text-left font-medium">数量</th>
          <th class="px-3 py-3 text-left font-medium">来源原始裁片单号</th>
          <th class="px-3 py-3 text-left font-medium">来源生产单号</th>
          <th class="px-3 py-3 text-left font-medium">所属裁片批次号</th>
          <th class="px-3 py-3 text-left font-medium">二级工艺标签</th>
          <th class="px-3 py-3 text-left font-medium">菲票码</th>
          <th class="px-3 py-3 text-left font-medium">打印版本号</th>
          <th class="px-3 py-3 text-left font-medium">打印状态</th>
          <th class="px-3 py-3 text-left font-medium">周转口袋绑定</th>
          <th class="px-3 py-3 text-left font-medium">是否可作废</th>
          <th class="px-3 py-3 text-left font-medium">打印时间</th>
          <th class="px-3 py-3 text-left font-medium">打印人</th>
          <th class="px-3 py-3 text-left font-medium">作废原因 / 替代票</th>
          <th class="px-3 py-3 text-left font-medium">操作</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100 bg-white">
        ${detailView.ticketCards
          .map((ticket) => {
            const actions =
              ticket.status === 'VALID'
                ? [
                    { label: '查看菲票码', href: buildTicketPanelHref(unit, ticket, 'qr') },
                    { label: '查看打印预览', href: buildTicketPanelHref(unit, ticket, 'preview') },
                    ...(!ticket.downstreamLocked
                      ? [{ label: '发起作废', href: buildActionHref('fei-ticket-void', unit, { ticketRecordId: ticket.ticketId }) }]
                      : []),
                  ]
                : [
                    { label: '查看作废原因', href: buildTicketPanelHref(unit, ticket, 'void-info') },
                    ...(ticket.replacementTicketNo
                      ? [
                          {
                            label: '查看替代菲票',
                            href: buildActionHref('fei-ticket-printed', unit, {
                              ticketRecordId: ticket.replacementTicketId,
                              panel: 'preview',
                            }),
                          },
                        ]
                      : []),
                  ]
            return `
              <tr>
                <td class="px-3 py-3 font-medium text-slate-900">${escapeHtml(ticket.ticketNo)}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(ticket.styleCode)}</td>
                <td class="px-3 py-3 text-slate-700">
                  <div class="font-medium text-slate-900">${escapeHtml(craftTraceProjection.itemsByTicketId[ticket.ticketId]?.materialSku || craftTraceProjection.itemsByTicketNo[ticket.ticketNo]?.materialSku || unit.fabricSku || '待补')}</div>
                  <div class="text-xs text-slate-500">${escapeHtml(`${ticket.color} / ${ticket.size}`)}</div>
                </td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(ticket.partName)}</td>
                <td class="px-3 py-3 text-slate-700">${formatCount(ticket.quantity)}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(ticket.sourceCutOrderNo)}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(ticket.sourceProductionOrderNo)}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(ticket.batchNo || '—')}</td>
                <td class="px-3 py-3 text-slate-700">${ticket.processTags.length ? escapeHtml(ticket.processTags.join(' / ')) : '—'}</td>
                <td class="px-3 py-3 text-xs leading-5 text-slate-600">${escapeHtml(truncate(ticket.qrPayload, 42))}</td>
                <td class="px-3 py-3 text-slate-700">V${formatCount(ticket.version)}</td>
                <td class="px-3 py-3">
                  <div class="space-y-1">
                    ${renderTicketStatusBadge(ticket.status)}
                    ${ticket.downstreamLocked ? `<p class="text-xs text-rose-600">${escapeHtml(ticket.downstreamLockedReason || '下游已锁定')}</p>` : ''}
                  </div>
                </td>
                <td class="px-3 py-3 text-slate-700">${ticket.boundPocketNo ? escapeHtml(`${ticket.boundPocketNo} / ${ticket.boundUsageNo || '待补使用周期号'}`) : '未绑定周转口袋'}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(ticket.status === 'VALID' ? (ticket.downstreamLocked ? '不可作废' : '可作废') : '不可作废')}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(formatDateTime(ticket.printedAt))}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(ticket.printedBy || '未打印')}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(ticket.status === 'VOIDED' ? `${ticket.voidReason || '已作废'}${ticket.replacementTicketNo ? ` / 替代：${ticket.replacementTicketNo}` : ''}` : '—')}</td>
                <td class="px-3 py-3">
                  <div class="flex min-w-[240px] flex-wrap gap-2">
                    ${actions
                      .map(
                        (action) => `<button type="button" data-nav="${escapeHtml(action.href)}" class="inline-flex min-h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-50">${escapeHtml(action.label)}</button>`,
                      )
                      .join('')}
                  </div>
                </td>
              </tr>
            `
          })
          .join('')}
      </tbody>
    </table>
  `

  return `
    <div class="space-y-4">
      ${renderTicketPreviewPanel(unit, selectedTicket)}
      ${renderSectionCard(
        '已打印菲票',
        '',
        renderStickyTableScroller(tableHtml, 'max-h-[60vh]'),
      )}
    </div>
  `
}

function renderPrintRecordsTab(detailView: PrintableUnitDetailViewModel): string {
  const tableHtml = `
    <table class="min-w-full text-sm">
      <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
        <tr>
          <th class="px-3 py-3 text-left font-medium">操作类型</th>
          <th class="px-3 py-3 text-left font-medium">关联打印单元号</th>
          <th class="px-3 py-3 text-left font-medium">关联菲票数</th>
          <th class="px-3 py-3 text-left font-medium">操作时间</th>
          <th class="px-3 py-3 text-left font-medium">操作人</th>
          <th class="px-3 py-3 text-left font-medium">原因</th>
          <th class="px-3 py-3 text-left font-medium">打印机 / 模板</th>
          <th class="px-3 py-3 text-left font-medium">原票 / 新票</th>
          <th class="px-3 py-3 text-left font-medium">备注</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100 bg-white">
        ${detailView.printRecords
          .map(
            (record) => `
              <tr>
                <td class="px-3 py-3 font-medium text-slate-900">${escapeHtml(formatOperationTypeLabel(record.operationType))}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(record.printableUnitNo)}</td>
                <td class="px-3 py-3 text-slate-700">${formatCount(record.relatedTicketCount)}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(formatDateTime(record.operatedAt))}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(record.operator)}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(record.reason || '—')}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(`${record.printerName || '待补打印机'} / ${record.templateName || '待补模板'}`)}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(record.fromTicketId || record.toTicketId ? `${record.fromTicketId || '—'} -> ${record.toTicketId || '—'}` : '—')}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(record.remark || '—')}</td>
              </tr>
            `,
          )
          .join('')}
      </tbody>
    </table>
  `

  return renderSectionCard(
    '打印记录',
    '',
    renderStickyTableScroller(tableHtml, 'max-h-[60vh]'),
  )
}

function renderMissingDetailsSummary(detailView: PrintableUnitDetailViewModel): string {
  if (!detailView.missingSplitDetails.length) {
    return `<p class="text-sm text-slate-600">当前没有待打印缺口。</p>`
  }
  return `
    <ul class="space-y-2 text-sm text-slate-700">
      ${detailView.missingSplitDetails
        .map(
          (detail) => `
            <li class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <span class="font-medium text-slate-900">${escapeHtml(detail.partName)}</span>
              <span class="mx-2 text-slate-400">/</span>
              <span>${escapeHtml(`${detail.color} / ${detail.size}`)}</span>
              <span class="mx-2 text-slate-400">/</span>
              <span>来源 ${escapeHtml(detail.sourceCutOrderNo)}</span>
              <span class="mx-2 text-slate-400">/</span>
              <span>缺口 ${formatCount(detail.gapCount)}</span>
            </li>
          `,
        )
        .join('')}
    </ul>
  `
}

function renderDetailOrChildPage(pageKey: 'fei-ticket-detail' | 'fei-ticket-printed' | 'fei-ticket-records'): string {
  const bundle = getDataBundle()
  const pathname = getCurrentPathname()
  const meta = getCanonicalCuttingMeta(pathname, 'fei-ticket-detail')
  const unit = findUnit(bundle)

  if (!unit) {
    return renderPrintablePageShell(`
      ${renderCuttingPageHeader(meta, {
        actionsHtml: renderReturnToSummaryButton() ? `<div class="flex flex-wrap gap-2">${renderReturnToSummaryButton()}</div>` : '',
      })}
      ${renderSectionCard('未找到打印单元', '', `<div class="space-y-3"><p class="text-sm text-slate-600">请先从打印菲票进入。</p>${renderBackToList(null)}</div>`)}
    `, { showLocateBar: pageKey !== 'fei-ticket-detail' })
  }

  const detailView = buildPrintableUnitDetailViewModel({
    unit,
    originalRows: bundle.originalRows,
    materialPrepRows: bundle.materialPrepRows,
    mergeBatches: bundle.mergeBatches,
    markerStore: bundle.markerStore,
    ticketRecords: bundle.ticketRecords,
    printJobs: bundle.printJobs,
  })
  const activeTab = pageKey === 'fei-ticket-printed' ? 'printed' : pageKey === 'fei-ticket-records' ? 'records' : getDetailTab(pathname)
  const content = activeTab === 'printed' ? renderPrintedTicketsTab(unit, detailView) : activeTab === 'records' ? renderPrintRecordsTab(detailView) : renderSplitDetailsTab(detailView)

  return renderPrintablePageShell(`
    ${renderCuttingPageHeader(meta, {
      actionsHtml: `<div class="flex flex-wrap gap-2">${renderBackToList(unit)}${renderReturnToSummaryButton()}</div>`,
    })}
    ${renderDetailSummary(detailView)}
    ${renderDetailTabs(unit, activeTab)}
    ${content}
  `, { showLocateBar: pageKey !== 'fei-ticket-detail' })
}

function buildOperationPreviewRows(rows: TicketSplitDetail[]): string {
  const tableHtml = `
    <table class="min-w-full text-sm">
      <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
        <tr>
          <th class="px-3 py-3 text-left font-medium">部位</th>
          <th class="px-3 py-3 text-left font-medium">颜色</th>
          <th class="px-3 py-3 text-left font-medium">尺码</th>
          <th class="px-3 py-3 text-left font-medium">来源原始裁片单号</th>
          <th class="px-3 py-3 text-left font-medium">来源生产单号</th>
          <th class="px-3 py-3 text-left font-medium">当前缺口数</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100 bg-white">
        ${rows
          .map(
            (detail) => `
              <tr>
                <td class="px-3 py-3 font-medium text-slate-900">${escapeHtml(detail.partName)}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(detail.color)}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(detail.size)}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(detail.sourceCutOrderNo)}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(detail.sourceProductionOrderNo)}</td>
                <td class="px-3 py-3 text-slate-700">${formatCount(detail.gapCount)}</td>
              </tr>
            `,
          )
          .join('')}
      </tbody>
    </table>
  `
  return renderStickyTableScroller(tableHtml, 'max-h-[50vh]')
}

function renderOperationFields(pageKey: OperationPageKey): string {
  const needsReason = pageKey === 'fei-ticket-reprint' || pageKey === 'fei-ticket-void'
  const showPrintConfig = pageKey !== 'fei-ticket-void'

  return `
    <div class="grid gap-4 lg:grid-cols-2">
      <label class="space-y-1 text-sm text-slate-600">
        <span class="font-medium text-slate-700">操作人</span>
        <input type="text" value="${escapeHtml(state.operationDraft.operator)}" data-cutting-fei-op-field="operator" class="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" />
      </label>
      ${showPrintConfig ? `<label class="space-y-1 text-sm text-slate-600"><span class="font-medium text-slate-700">打印机</span><input type="text" value="${escapeHtml(state.operationDraft.printerName)}" data-cutting-fei-op-field="printerName" class="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" /></label>` : ''}
      ${showPrintConfig ? `<label class="space-y-1 text-sm text-slate-600"><span class="font-medium text-slate-700">模板</span><input type="text" value="${escapeHtml(state.operationDraft.templateName)}" data-cutting-fei-op-field="templateName" class="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" /></label>` : ''}
      <label class="space-y-1 text-sm text-slate-600 ${showPrintConfig ? '' : 'lg:col-span-2'}">
        <span class="font-medium text-slate-700">${needsReason ? '原因（必填）' : '原因（可选）'}</span>
        <input type="text" value="${escapeHtml(state.operationDraft.reason)}" data-cutting-fei-op-field="reason" class="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" placeholder="${needsReason ? '请输入原因' : '可选填写'}" />
      </label>
      <label class="space-y-1 text-sm text-slate-600 lg:col-span-2">
        <span class="font-medium text-slate-700">备注</span>
        <textarea rows="3" data-cutting-fei-op-field="remark" class="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200">${escapeHtml(state.operationDraft.remark)}</textarea>
      </label>
    </div>
  `
}

function renderOperationValidation(message: string, unit: PrintableUnit | null, pageKey: OperationPageKey): string {
  const meta = getCanonicalCuttingMeta(getCurrentPathname(), pageKey)
  return renderPrintablePageShell(`
    ${renderCuttingPageHeader(meta, {
      actionsHtml: `<div class="flex flex-wrap gap-2">${renderBackToList(unit)}${renderReturnToSummaryButton()}</div>`,
    })}
    ${renderSectionCard('当前操作不可执行', '', `<p class="text-sm text-slate-600">${escapeHtml(message)}</p>`)}
  `, { showLocateBar: pageKey !== 'fei-ticket-print' })
}

function getOperationButtonMeta(pageKey: OperationPageKey): { label: string; action: string } {
  if (pageKey === 'fei-ticket-print') return { label: '确认首次打印', action: 'confirm-first-print' }
  if (pageKey === 'fei-ticket-continue-print') return { label: '确认继续打印', action: 'confirm-continue-print' }
  if (pageKey === 'fei-ticket-reprint') return { label: '确认补打', action: 'confirm-reprint' }
  return { label: '确认作废', action: 'confirm-void-ticket' }
}

function renderOperationPage(pageKey: OperationPageKey): string {
  const bundle = getDataBundle()
  const meta = getCanonicalCuttingMeta(getCurrentPathname(), pageKey)
  const unit = findUnit(bundle)
  if (!unit) return renderOperationValidation('未找到当前 printableUnit。', null, pageKey)

  const detailView = buildPrintableUnitDetailViewModel({
    unit,
    originalRows: bundle.originalRows,
    materialPrepRows: bundle.materialPrepRows,
    mergeBatches: bundle.mergeBatches,
    markerStore: bundle.markerStore,
    ticketRecords: bundle.ticketRecords,
    printJobs: bundle.printJobs,
  })
  const ticket = findTicketCard(detailView)

  if (pageKey === 'fei-ticket-print' && unit.printableUnitStatus !== 'WAITING_PRINT') {
    return renderOperationValidation('只有待打印状态才能进入首次打印页。', unit, pageKey)
  }
  if (pageKey === 'fei-ticket-continue-print' && unit.printableUnitStatus !== 'PARTIAL_PRINTED') {
    return renderOperationValidation('只有部分打印状态才能进入继续打印页。', unit, pageKey)
  }
  if (pageKey === 'fei-ticket-reprint' && unit.printableUnitStatus !== 'NEED_REPRINT') {
    return renderOperationValidation('只有需补打状态才能进入补打页。', unit, pageKey)
  }
  if (pageKey === 'fei-ticket-void') {
    const validation = canVoidTicketCard(
      ticket ? bundle.ticketRecords.find((record) => record.ticketRecordId === ticket.ticketId) || null : null,
    )
    if (!ticket) return renderOperationValidation('当前没有定位到需要作废的菲票。', unit, pageKey)
    if (!validation.allowed) {
      return renderOperationValidation(validation.reason, unit, pageKey)
    }
  }

  const previewDetails = pageKey === 'fei-ticket-print' || pageKey === 'fei-ticket-continue-print' || pageKey === 'fei-ticket-reprint' ? detailView.missingSplitDetails : []
  const planCount = previewDetails.length
  const buttonMeta = getOperationButtonMeta(pageKey)
  const infoGrid = `
    <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <div class="rounded-lg border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">可打印单元号</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(unit.printableUnitNo)}</p></div>
      <div class="rounded-lg border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">单元类型</p><div class="mt-1">${renderUnitTypeBadge(unit.printableUnitType)}</div></div>
      <div class="rounded-lg border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">当前状态</p><div class="mt-1">${renderStatusBadge(unit.printableUnitStatus)}</div></div>
      <div class="rounded-lg border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">来源裁片单数</p><p class="mt-1 text-sm font-semibold text-slate-900">${formatCount(unit.sourceCutOrderCount)}</p></div>
    </div>
  `
  const operationSpecific =
    pageKey === 'fei-ticket-void' && ticket
      ? `
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">菲票号</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(ticket.ticketNo)}</p></div>
          <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">面料 SKU</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(findCraftTraceItem(bundle, ticket)?.materialSku || unit.fabricSku || '待补')}</p><p class="mt-1 text-xs text-slate-500">${escapeHtml(`${ticket.color} / ${ticket.size}`)}</p></div>
          <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">裁片部位</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(ticket.partName)}</p></div>
          <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">是否存在替代票</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(ticket.replacementTicketNo || '暂无')}</p></div>
        </div>
      `
      : `
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">本次计划打印数量</p><p class="mt-1 text-sm font-semibold text-slate-900">${formatCount(planCount)}</p></div>
          <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">当前缺口总数</p><p class="mt-1 text-sm font-semibold text-slate-900">${formatCount(unit.missingTicketCount)}</p></div>
          <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">最近打印时间</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(formatDateTime(unit.lastPrintedAt))}</p></div>
          <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">最近打印人</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(unit.lastPrintedBy || '未打印')}</p></div>
        </div>
      `

  return renderPrintablePageShell(`
    ${renderCuttingPageHeader(meta, {
      actionsHtml: `<div class="flex flex-wrap gap-2">${renderBackToList(unit)}${renderReturnToSummaryButton()}</div>`,
    })}
    ${renderSectionCard('当前打印单元基础信息', '', `${infoGrid}${operationSpecific}`)}
    ${
      pageKey === 'fei-ticket-void'
        ? renderSectionCard('作废对象', '', ticket ? renderTicketPreviewPanel(unit, ticket) : '<p class="text-sm text-slate-600">未找到作废对象。</p>')
        : renderSectionCard('计划打印明细预览', '', buildOperationPreviewRows(previewDetails))
    }
    ${renderSectionCard('操作设置', '', renderOperationFields(pageKey))}
    ${renderSectionCard(
      '动作区',
      '',
      `<div class="flex flex-wrap gap-2"><button type="button" data-cutting-fei-action="${buttonMeta.action}" class="inline-flex min-h-10 items-center rounded-md border border-blue-600 bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700">${escapeHtml(buttonMeta.label)}</button><button type="button" data-nav="${escapeHtml(buildActionHref('fei-ticket-detail', unit))}" class="inline-flex min-h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">取消</button></div>`,
    )}
  `, { showLocateBar: pageKey !== 'fei-ticket-print' })
}

function renderPrintableUnitPage(pageKey: PrintableActionPageKey): string {
  if (pageKey === 'fei-tickets') return renderListPage()
  if (pageKey === 'fei-ticket-detail' || pageKey === 'fei-ticket-printed' || pageKey === 'fei-ticket-records') {
    return renderDetailOrChildPage(pageKey)
  }
  return renderOperationPage(pageKey as OperationPageKey)
}

function performPrintOperation(pageKey: Extract<OperationPageKey, 'fei-ticket-print' | 'fei-ticket-continue-print' | 'fei-ticket-reprint'>): void {
  const bundle = getDataBundle()
  const unit = findUnit(bundle)
  if (!unit) return
  const detailView = buildPrintableUnitDetailViewModel({
    unit,
    originalRows: bundle.originalRows,
    materialPrepRows: bundle.materialPrepRows,
    mergeBatches: bundle.mergeBatches,
    markerStore: bundle.markerStore,
    ticketRecords: bundle.ticketRecords,
    printJobs: bundle.printJobs,
  })
  if (!detailView.missingSplitDetails.length) return
  if (!state.operationDraft.operator.trim()) return
  if (!state.operationDraft.printerName.trim()) return
  if (!state.operationDraft.templateName.trim()) return
  if (pageKey === 'fei-ticket-reprint' && !state.operationDraft.reason.trim()) return

  const operationType =
    pageKey === 'fei-ticket-print'
      ? 'FIRST_PRINT'
      : pageKey === 'fei-ticket-continue-print'
        ? 'CONTINUE_PRINT'
        : 'REPRINT'

  const params = getCurrentSearchParams()
  const result = executePrintableUnitPrint({
    unit,
    splitDetails: detailView.missingSplitDetails,
    originalRows: bundle.originalRows,
    materialPrepRows: bundle.materialPrepRows,
    mergeBatches: bundle.mergeBatches,
    markerStore: bundle.markerStore,
    ticketRecords: bundle.ticketRecords,
    printJobs: bundle.printJobs,
    operationType,
    operator: state.operationDraft.operator.trim(),
    operatedAt: nowText(),
    printerName: state.operationDraft.printerName.trim(),
    templateName: state.operationDraft.templateName.trim(),
    reason: state.operationDraft.reason.trim(),
    remark: state.operationDraft.remark.trim(),
    fromTicketId: params.get('ticketRecordId') || undefined,
  })
  persistTicketRecords(result.nextRecords)
  persistPrintJobs(result.nextJobs)
  state.operationDraft = createDefaultOperationDraft()
  state.operationSignature = ''
  appStore.navigate(buildActionHref('fei-ticket-printed', unit))
}

function performVoidTicket(): void {
  const bundle = getDataBundle()
  const unit = findUnit(bundle)
  if (!unit) return
  const detailView = buildPrintableUnitDetailViewModel({
    unit,
    originalRows: bundle.originalRows,
    materialPrepRows: bundle.materialPrepRows,
    mergeBatches: bundle.mergeBatches,
    markerStore: bundle.markerStore,
    ticketRecords: bundle.ticketRecords,
    printJobs: bundle.printJobs,
  })
  const ticket = findTicketCard(detailView)
  if (!ticket) return
  if (!state.operationDraft.operator.trim() || !state.operationDraft.reason.trim()) return

  const result = voidTicketCard({
    recordId: ticket.ticketId,
    ticketRecords: bundle.ticketRecords,
    printJobs: bundle.printJobs,
    operator: state.operationDraft.operator.trim(),
    operatedAt: nowText(),
    reason: state.operationDraft.reason.trim(),
    remark: state.operationDraft.remark.trim(),
    printableUnit: unit,
  })
  if (!result) return
  persistTicketRecords(result.nextRecords)
  persistPrintJobs(result.nextJobs)
  state.operationDraft = createDefaultOperationDraft()
  state.operationSignature = ''
  appStore.navigate(buildActionHref('fei-ticket-printed', unit, { ticketRecordId: ticket.ticketId, panel: 'void-info' }))
}

export function renderCraftCuttingFeiTicketsPage(): string {
  return renderPrintableUnitPage('fei-tickets')
}

export function renderCraftCuttingFeiTicketDetailPage(): string {
  return renderPrintableUnitPage('fei-ticket-detail')
}

export function renderCraftCuttingFeiTicketPrintedPage(): string {
  return renderPrintableUnitPage('fei-ticket-printed')
}

export function renderCraftCuttingFeiTicketRecordsPage(): string {
  return renderPrintableUnitPage('fei-ticket-records')
}

export function renderCraftCuttingFeiTicketPrintPage(): string {
  return renderPrintableUnitPage('fei-ticket-print')
}

export function renderCraftCuttingFeiTicketContinuePrintPage(): string {
  return renderPrintableUnitPage('fei-ticket-continue-print')
}

export function renderCraftCuttingFeiTicketReprintPage(): string {
  return renderPrintableUnitPage('fei-ticket-reprint')
}

export function renderCraftCuttingFeiTicketVoidPage(): string {
  return renderPrintableUnitPage('fei-ticket-void')
}

function resetFilters(): void {
  state.filters = { ...initialFilters }
}

export function handleCraftCuttingFeiTicketsEvent(target: Element): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-cutting-fei-field]')
  if (fieldNode) {
    const field = fieldNode.dataset.cuttingFeiField as keyof PrintableUnitFilters | undefined
    if (!field) return false
    const input = fieldNode as HTMLInputElement | HTMLSelectElement
    if (field === 'printableUnitType') {
      state.filters = { ...state.filters, printableUnitType: input.value as PrintableUnitFilters['printableUnitType'] }
      return true
    }
    if (field === 'printableUnitStatus') {
      state.filters = { ...state.filters, printableUnitStatus: input.value as PrintableUnitFilters['printableUnitStatus'] }
      return true
    }
    state.filters = { ...state.filters, [field]: input.value }
    return true
  }

  const opFieldNode = target.closest<HTMLElement>('[data-cutting-fei-op-field]')
  if (opFieldNode) {
    const field = opFieldNode.dataset.cuttingFeiOpField as keyof FeiOperationDraft | undefined
    if (!field) return false
    const input = opFieldNode as HTMLInputElement | HTMLTextAreaElement
    state.operationDraft = {
      ...state.operationDraft,
      [field]: input.value,
    }
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-cutting-fei-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.cuttingFeiAction
  if (!action) return false

  if (action === 'set-status') {
    const status = actionNode.dataset.status as PrintableUnitStatus | 'ALL' | undefined
    if (!status) return false
    state.filters = { ...state.filters, printableUnitStatus: status }
    return true
  }

  if (action === 'reset-filters') {
    resetFilters()
    return true
  }

  if (action === 'clear-locate') {
    state.querySignature = ''
    appStore.navigate(clearCurrentFeiDrillRoute())
    return true
  }

  if (action === 'return-summary') {
    const context = buildReturnToSummaryContext(getCurrentDrillContext())
    if (!context) return false
    appStore.navigate(buildCuttingRouteWithContext('summary', context))
    return true
  }

  if (action === 'confirm-first-print') {
    performPrintOperation('fei-ticket-print')
    return true
  }

  if (action === 'confirm-continue-print') {
    performPrintOperation('fei-ticket-continue-print')
    return true
  }

  if (action === 'confirm-reprint') {
    performPrintOperation('fei-ticket-reprint')
    return true
  }

  if (action === 'confirm-void-ticket') {
    performVoidTicket()
    return true
  }

  return false
}
