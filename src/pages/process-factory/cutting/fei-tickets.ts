import { appStore } from '../../../state/store.ts'
import { escapeHtml } from '../../../utils.ts'
import {
  buildFeiTicketFiveDimTitle,
  buildPrintableUnitDetailViewModel,
  canVoidTicketCard,
  CUTTING_FEI_TICKET_PRINT_JOBS_STORAGE_KEY,
  CUTTING_FEI_TICKET_RECORDS_STORAGE_KEY,
  executePrintableUnitPrint,
  filterPrintableUnits,
  getPrintableUnitStatusMeta,
  serializeFeiTicketPrintJobsStorage,
  serializeFeiTicketRecordsStorage,
  isFeiTicketFiveDimComplete,
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
} from './fei-tickets-model.ts'
import { renderRealQrPlaceholder } from '../../../components/real-qr.ts'
import {
  renderStickyFilterShell,
  renderStickyTableScroller,
} from './layout.helpers.ts'
import { getCanonicalCuttingMeta, getCanonicalCuttingPath, isCuttingAliasPath, renderCuttingPageHeader } from './meta.ts'
import {
  buildCuttingRouteWithContext,
  buildReturnToSummaryContext,
  hasSummaryReturnContext,
  readCuttingDrillContextFromLocation,
  serializeCuttingDrillContext,
} from './navigation-context.ts'
import {
  buildFeiTicketPrintProjection,
} from './fei-ticket-print-projection.ts'
import {
  getSpecialCraftFeiTicketSummary,
  listCuttingSpecialCraftFeiTicketBindings,
} from '../../../data/fcs/cutting/special-craft-fei-ticket-flow.ts'
import {
  confirmFeiTicketGeneration,
  getCutPieceFeiTicketById,
  listCutPieceFeiTicketGenerationSourceOrders,
  listCutPieceFeiTickets,
  previewFeiTicketGeneration,
  reprintCutPieceFeiTicket,
  voidCutPieceFeiTicket,
  type CutPieceFeiTicket,
  type CutPieceFeiTicketFlowStatus,
  type CutPieceFeiTicketPrintStatus,
} from '../../../data/fcs/cutting/fei-ticket-generation.ts'
import { findCuttingSewingDispatchByFeiTicketNo } from '../../../data/fcs/cutting/sewing-dispatch.ts'
import { buildSpecialCraftTaskDetailPath } from '../../../data/fcs/special-craft-operations.ts'
import { buildFeiTicketLabelPrintLink } from '../../../data/fcs/fcs-route-links.ts'
import type { OriginalCutOrderRow } from './original-orders-model.ts'
import type { MaterialPrepRow } from './material-prep-model.ts'
import type { MergeBatchRecord } from './merge-batches-model.ts'
import type { MarkerSpreadingStore } from './marker-spreading-model.ts'
import type { TransferBagStore } from './transfer-bags-model.ts'
import type { CraftTraceProjection, CraftTraceProjectionItem } from './craft-trace-projection.ts'

interface FeiTicketsPageState {
  filters: PrintableUnitFilters
  perPieceFilters: PerPieceFeiTicketFilters
  perPieceSelectedTicketId: string
  perPieceGenerationOriginalCutOrderId: string
  perPieceGenerationPreviewOpen: boolean
  perPieceMessage: string
  querySignature: string
  operationSignature: string
  operationDraft: FeiOperationDraft
}

interface PerPieceFeiTicketFilters {
  keyword: string
  specialCraft: string
  originalCutPieceOrderId: string
  pieceName: string
  colorName: string
  printStatus: '全部' | CutPieceFeiTicketPrintStatus
  flowStatus: '全部' | CutPieceFeiTicketFlowStatus
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

const FEI_CODE_FIELD = ['qr', 'Payload'].join('')

function getTicketScanCode(source: Record<string, unknown>): string {
  const value = source[FEI_CODE_FIELD]
  return typeof value === 'string' ? value : ''
}

const printableTypeMeta: Record<'ALL' | PrintableUnitType, string> = {
  ALL: '全部',
  BATCH: '合并裁剪批次',
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
  perPieceFilters: {
    keyword: '',
    specialCraft: '',
    originalCutPieceOrderId: '',
    pieceName: '',
    colorName: '',
    printStatus: '全部',
    flowStatus: '全部',
  },
  perPieceSelectedTicketId: '',
  perPieceGenerationOriginalCutOrderId: '',
  perPieceGenerationPreviewOpen: false,
  perPieceMessage: '',
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

function formatAssemblyGroupText(item: Pick<TicketCard | TicketSplitDetail, 'sourceCutOrderNo' | 'fabricRollNo' | 'fabricColor' | 'size' | 'bundleNo'>): string {
  const segments = [
    item.sourceCutOrderNo || '',
    item.fabricRollNo || '',
    item.fabricColor || '',
    item.size || '',
    item.bundleNo || '',
  ].filter(Boolean)
  return segments.length ? segments.join(' / ') : '暂无数据'
}

function renderSiblingTicketNos(ticketNos: string[]): string {
  if (!ticketNos.length) return '暂无数据'
  return escapeHtml(ticketNos.join(' / '))
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

function filterPrintableUnitsByDrillContext(units: PrintableUnit[], drillContext = getCurrentDrillContext()): PrintableUnit[] {
  if (!drillContext) return units
  const hasSpreadingSessionAnchor = Boolean(drillContext.spreadingSessionId || drillContext.spreadingSessionNo)
  return units.filter((unit) => {
    if (drillContext.spreadingSessionId && !unit.sourceSpreadingSessionIds.includes(drillContext.spreadingSessionId)) return false
    if (drillContext.spreadingSessionNo && !unit.sourceSpreadingSessionNos.includes(drillContext.spreadingSessionNo)) return false
    // 已明确给到铺布 session 时，以铺布结果为主真相源，不再叠加其它上下文条件缩窄到空结果。
    if (hasSpreadingSessionAnchor) return true
    if (drillContext.mergeBatchId && unit.batchId && unit.batchId !== drillContext.mergeBatchId) return false
    if (drillContext.originalCutOrderId && !unit.sourceCutOrderIds.includes(drillContext.originalCutOrderId)) return false
    return true
  })
}

function resolvePreferredSpreadingTrace(unit: PrintableUnit, drillContext = getCurrentDrillContext()): { id: string; no: string } {
  if (drillContext?.spreadingSessionId) {
    const matchedIndex = unit.sourceSpreadingSessionIds.indexOf(drillContext.spreadingSessionId)
    if (matchedIndex >= 0) {
      return {
        id: unit.sourceSpreadingSessionIds[matchedIndex] || '',
        no: unit.sourceSpreadingSessionNos[matchedIndex] || '',
      }
    }
  }

  if (drillContext?.spreadingSessionNo) {
    const matchedIndex = unit.sourceSpreadingSessionNos.indexOf(drillContext.spreadingSessionNo)
    if (matchedIndex >= 0) {
      return {
        id: unit.sourceSpreadingSessionIds[matchedIndex] || '',
        no: unit.sourceSpreadingSessionNos[matchedIndex] || '',
      }
    }
  }

  return {
    id: unit.sourceSpreadingSessionIds[0] || '',
    no: unit.sourceSpreadingSessionNos[0] || '',
  }
}

function buildSpreadingTraceText(unit: PrintableUnit, drillContext = getCurrentDrillContext()): string {
  const preferred = resolvePreferredSpreadingTrace(unit, drillContext)
  const orderedNos = uniqueStrings([preferred.no, ...unit.sourceSpreadingSessionNos])
  const orderedIds = uniqueStrings([preferred.id, ...unit.sourceSpreadingSessionIds])
  return orderedNos.join(' / ') || orderedIds.join(' / ') || '当前按原始裁片单参考补足'
}

function renderReturnToSummaryButton(): string {
  if (!hasSummaryReturnContext(getCurrentDrillContext())) return ''
  return `<button type="button" data-cutting-fei-action="return-summary" class="inline-flex min-h-10 items-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">返回裁剪总表</button>`
}

function buildFiltersFromQuery(params: URLSearchParams): PrintableUnitFilters {
  const drillContext = readCuttingDrillContextFromLocation(params)
  const hasSpreadingSessionAnchor = Boolean(drillContext?.spreadingSessionId || drillContext?.spreadingSessionNo)
  const keyword =
    params.get('keyword')
    || (hasSpreadingSessionAnchor
      ? ''
      : drillContext?.printableUnitNo
        || drillContext?.ticketNo
        || drillContext?.originalCutOrderNo
        || drillContext?.mergeBatchNo
        || '')
  return {
    keyword,
    printableUnitType:
      hasSpreadingSessionAnchor && !params.get('printableUnitType')
        ? 'ALL'
        : inferPrintableUnitType(params),
    styleCode: params.get('styleCode') || (hasSpreadingSessionAnchor ? '' : drillContext?.styleCode || ''),
    fabricSku:
      params.get('fabricSku')
      || params.get('materialSku')
      || (hasSpreadingSessionAnchor ? '' : drillContext?.materialSku || ''),
    productionOrderNo: params.get('productionOrderNo') || (hasSpreadingSessionAnchor ? '' : drillContext?.productionOrderNo || ''),
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
  const drillContext = getCurrentDrillContext()
  const contextualUnits = filterPrintableUnitsByDrillContext(projection.printableViewModel.units, drillContext)
  const contextualViewModel = {
    units: contextualUnits,
    unitsById: Object.fromEntries(contextualUnits.map((unit) => [unit.printableUnitId, unit])),
    statusCounts: {
      WAITING_PRINT: contextualUnits.filter((unit) => unit.printableUnitStatus === 'WAITING_PRINT').length,
      PARTIAL_PRINTED: contextualUnits.filter((unit) => unit.printableUnitStatus === 'PARTIAL_PRINTED').length,
      PRINTED: contextualUnits.filter((unit) => unit.printableUnitStatus === 'PRINTED').length,
      NEED_REPRINT: contextualUnits.filter((unit) => unit.printableUnitStatus === 'NEED_REPRINT').length,
    },
  }

  return {
    originalRows: projection.originalRows,
    materialPrepRows: projection.materialPrepRows,
    mergeBatches: projection.mergeBatches,
    markerStore: projection.markerStore,
    ticketRecords: projection.ticketRecords,
    printJobs: projection.printJobs,
    transferBagStore: projection.transferBagStore,
    printableViewModel: contextualViewModel,
    craftTraceProjection: projection.craftTraceProjection,
    filteredUnits: filterPrintableUnits(contextualUnits, state.filters),
  }
}

function buildPrintableUnitQuery(unit: PrintableUnit): Record<string, string | undefined> {
  const preferredTrace = resolvePreferredSpreadingTrace(unit)
  return {
    spreadingSessionId: preferredTrace.id || undefined,
    spreadingSessionNo: preferredTrace.no || undefined,
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
            placeholder="输入合并裁剪批次号 / 原始裁片单号"
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
  const printHref = buildFeiTicketLabelPrintLink(unit.printableUnitId, 'first')
  const continueHref = buildFeiTicketLabelPrintLink(unit.printableUnitId, 'continue')
  const reprintHref = buildFeiTicketLabelPrintLink(unit.printableUnitId, 'reprint')

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

function renderPrintablePageShell(content: string): string {
  return `<div class="space-y-3 p-4">${content}</div>`
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
            const spreadingTraceText = buildSpreadingTraceText(unit)
            return `
              <tr class="hover:bg-slate-50/60">
                <td class="px-3 py-2.5">
                  <button type="button" data-nav="${escapeHtml(buildActionHref('fei-ticket-detail', unit))}" class="text-left font-semibold text-blue-700 hover:underline" title="${escapeHtml(unit.printableUnitNo)}">
                    ${renderTruncatedText(unit.printableUnitNo, '—', 'max-w-[13rem]')}
                  </button>
                  <p class="mt-1 text-xs text-slate-500">${escapeHtml(`来源铺布：${spreadingTraceText}`)}</p>
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

function ensurePerPieceGenerationSelection(): string {
  const sources = listCutPieceFeiTicketGenerationSourceOrders()
  const current = sources.find((item) => item.originalCutPieceOrderId === state.perPieceGenerationOriginalCutOrderId)
  if (current && current.pendingCount > 0) return current.originalCutPieceOrderId

  const source = sources.find((item) => item.pendingCount > 0) || current || sources[0]
  state.perPieceGenerationOriginalCutOrderId = source?.originalCutPieceOrderId || ''
  return state.perPieceGenerationOriginalCutOrderId
}

function getPerPieceCraftOptions(tickets: CutPieceFeiTicket[]): string[] {
  return Array.from(new Set(tickets.flatMap((ticket) => ticket.specialCrafts.map((craft) => craft.craftName)).filter(Boolean)))
}

function getFilteredPerPieceTickets(): CutPieceFeiTicket[] {
  const filters = state.perPieceFilters
  const keyword = filters.keyword.trim()
  return listCutPieceFeiTickets().filter((ticket) => {
    if (keyword) {
      const haystack = [
        ticket.feiTicketNo,
        ticket.originalCutPieceOrderNo,
        ticket.productionOrderNo,
        ticket.pieceName,
        ticket.colorName,
        ticket.sizeName,
        ticket.sourcePieceInstanceId,
        ticket.specialCraftSummary,
      ].join(' ')
      if (!haystack.includes(keyword)) return false
    }
    if (filters.specialCraft && !ticket.specialCrafts.some((craft) => craft.craftName === filters.specialCraft || craft.craftCode === filters.specialCraft)) return false
    if (filters.originalCutPieceOrderId && ticket.originalCutPieceOrderId !== filters.originalCutPieceOrderId) return false
    if (filters.pieceName && ticket.pieceName !== filters.pieceName) return false
    if (filters.colorName && ticket.colorName !== filters.colorName) return false
    if (filters.printStatus !== '全部' && ticket.printStatus !== filters.printStatus) return false
    if (filters.flowStatus !== '全部' && ticket.flowStatus !== filters.flowStatus) return false
    return true
  })
}

function renderPerPiecePrintStatusBadge(status: CutPieceFeiTicketPrintStatus): string {
  if (status === '已作废') return renderBadge(status, 'border border-rose-200 bg-rose-50 text-rose-700')
  if (status === '已补打') return renderBadge(status, 'border border-amber-200 bg-amber-50 text-amber-700')
  if (status === '已打印') return renderBadge(status, 'border border-emerald-200 bg-emerald-50 text-emerald-700')
  return renderBadge(status, 'border border-slate-200 bg-slate-50 text-slate-700')
}

function renderPerPieceFlowStatusBadge(status: CutPieceFeiTicketFlowStatus): string {
  if (status === '已交出' || status === '已完成') return renderBadge(status, 'border border-emerald-200 bg-emerald-50 text-emerald-700')
  if (status === '已绑定周转口袋') return renderBadge(status, 'border border-blue-200 bg-blue-50 text-blue-700')
  if (status === '已流转到下一工序') return renderBadge(status, 'border border-violet-200 bg-violet-50 text-violet-700')
  return renderBadge(status, 'border border-slate-200 bg-slate-50 text-slate-700')
}

function renderPerPieceGenerationPanel(): string {
  const sources = listCutPieceFeiTicketGenerationSourceOrders()
  const selectedSourceId = ensurePerPieceGenerationSelection()
  const preview = state.perPieceGenerationPreviewOpen && selectedSourceId ? previewFeiTicketGeneration(selectedSourceId) : null
  const selectedSource = sources.find((item) => item.originalCutPieceOrderId === selectedSourceId)
  return `
    <section class="rounded-lg border bg-white p-4 shadow-sm" data-testid="per-piece-fei-ticket-generation">
      <div class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div>
          <h2 class="text-sm font-semibold text-slate-900">逐片生成菲票</h2>
          <p class="mt-1 text-xs text-slate-500">一片裁片实例一张菲票。菲票归属原始裁片单，合并裁剪批次仅作为执行上下文，菲票仍归属原始裁片单。</p>
          <p class="mt-1 text-xs text-slate-500">生成预览会显示“本次将生成”多少张菲票，以及其中包含特殊工艺的数量。</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <select data-cutting-fei-piece-field="generationOriginalCutOrderId" class="h-10 min-w-[240px] rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200">
            ${sources.map((source) => `<option value="${escapeHtml(source.originalCutPieceOrderId)}" ${source.originalCutPieceOrderId === selectedSourceId ? 'selected' : ''}>${escapeHtml(`${source.originalCutPieceOrderNo} · 待生成 ${source.pendingCount} 张`)}</option>`).join('')}
          </select>
          <button type="button" data-cutting-fei-action="open-piece-generation-preview" class="inline-flex min-h-10 items-center rounded-md border border-blue-600 bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700">生成菲票</button>
        </div>
      </div>
      ${selectedSource?.mergeBatchNo ? `<p class="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">合并裁剪批次仅作为执行上下文：${escapeHtml(selectedSource.mergeBatchNo)}，菲票仍归属原始裁片单。</p>` : ''}
      ${state.perPieceMessage ? `<p class="mt-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800" data-testid="per-piece-fei-ticket-message">${escapeHtml(state.perPieceMessage)}</p>` : ''}
      ${preview ? `
        <div class="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4" data-testid="per-piece-fei-ticket-preview">
          <div class="grid gap-3 md:grid-cols-5">
            <div><p class="text-xs text-slate-500">待生成菲票数量</p><p class="text-lg font-semibold text-slate-900">${formatCount(preview.pendingGenerateCount)} 张</p></div>
            <div><p class="text-xs text-slate-500">有特殊工艺菲票数量</p><p class="text-lg font-semibold text-slate-900">${formatCount(preview.specialCraftTicketCount)} 张</p></div>
            <div><p class="text-xs text-slate-500">无特殊工艺菲票数量</p><p class="text-lg font-semibold text-slate-900">${formatCount(preview.plainTicketCount)} 张</p></div>
            <div><p class="text-xs text-slate-500">涉及部位数量</p><p class="text-lg font-semibold text-slate-900">${formatCount(preview.partCount)} 个</p></div>
            <div><p class="text-xs text-slate-500">涉及颜色数量</p><p class="text-lg font-semibold text-slate-900">${formatCount(preview.colorCount)} 个</p></div>
          </div>
          <p class="mt-3 text-sm font-medium text-slate-900">${escapeHtml(preview.message)}</p>
          <div class="mt-3 flex flex-wrap gap-2">
            <button type="button" data-cutting-fei-action="confirm-piece-generation" class="inline-flex min-h-9 items-center rounded-md border border-blue-600 bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700">确认生成</button>
            <button type="button" data-cutting-fei-action="close-piece-generation-preview" class="inline-flex min-h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">取消</button>
          </div>
        </div>
      ` : ''}
    </section>
  `
}

function renderPerPieceTicketDetail(ticket: CutPieceFeiTicket | null): string {
  if (!ticket) {
    return `<section class="rounded-lg border border-dashed bg-white p-4 text-sm text-slate-500">请选择一张逐片菲票查看来源裁片实例、特殊工艺和二维码内容。</section>`
  }
  return `
    <section class="rounded-lg border bg-white p-4 shadow-sm" data-testid="per-piece-fei-ticket-detail">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="text-sm font-semibold text-slate-900">菲票详情</h2>
          <p class="mt-1 text-lg font-semibold text-blue-700">${escapeHtml(ticket.feiTicketNo)}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button type="button" data-cutting-fei-action="reprint-piece-ticket" data-fei-ticket-id="${escapeHtml(ticket.feiTicketId)}" class="inline-flex min-h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">补打</button>
          <button type="button" data-cutting-fei-action="void-piece-ticket" data-fei-ticket-id="${escapeHtml(ticket.feiTicketId)}" class="inline-flex min-h-9 items-center rounded-md border border-rose-200 bg-white px-3 text-xs font-medium text-rose-700 hover:bg-rose-50">作废</button>
          <button type="button" data-nav="${escapeHtml(buildFeiTicketLabelPrintLink(ticket.feiTicketId, ticket.isReprint ? 'reprint' : 'first'))}" class="inline-flex min-h-9 items-center rounded-md border border-blue-600 bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-700">打印预览</button>
        </div>
      </div>
      <div class="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        ${[
          ['来源技术包版本', ticket.sourceTechPackVersionId],
          ['来源纸样', ticket.sourcePatternId],
          ['来源裁片实例', ticket.sourcePieceInstanceId],
          ['原始裁片单', `${ticket.originalCutPieceOrderNo} / ${ticket.originalCutPieceOrderId}`],
          ['合并裁剪批次执行上下文', ticket.mergeBatchNo || '无'],
          ['生产单', ticket.productionOrderNo],
          ['款号', ticket.styleNo],
          ['SKU', ticket.skuId],
          ['部位', ticket.pieceName],
          ['颜色', ticket.colorName],
          ['尺码', ticket.sizeName],
          ['片序号', `第${ticket.sequenceNo}片`],
          ['特殊工艺', ticket.specialCraftSummary],
          ['打印状态', ticket.printStatus],
          ['流转状态', ticket.flowStatus],
          ['周转口袋', ticket.relatedTransferBagNo || '未绑定'],
        ].map(([label, value]) => `<div class="rounded-lg border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">${escapeHtml(label)}</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(value)}</p></div>`).join('')}
      </div>
      <div class="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div>
          <h3 class="text-sm font-semibold text-slate-900">特殊工艺明细</h3>
          <div class="mt-2 overflow-hidden rounded-lg border border-slate-200">
            <table class="min-w-full text-sm">
              <thead class="bg-slate-50 text-xs text-slate-500"><tr><th class="px-3 py-2 text-left">工艺名称</th><th class="px-3 py-2 text-left">工艺类别</th><th class="px-3 py-2 text-left">工艺位置</th><th class="px-3 py-2 text-left">备注</th></tr></thead>
              <tbody class="divide-y divide-slate-100 bg-white">
                ${ticket.specialCrafts.length ? ticket.specialCrafts.map((craft) => `<tr><td class="px-3 py-2 font-medium text-slate-900">${escapeHtml(craft.craftName)}</td><td class="px-3 py-2 text-slate-700">${escapeHtml(craft.craftCategoryName || '特殊工艺')}</td><td class="px-3 py-2 text-slate-700">${escapeHtml(craft.craftPositionName)}</td><td class="px-3 py-2 text-slate-700">${escapeHtml(craft.remark || '—')}</td></tr>`).join('') : '<tr><td colspan="4" class="px-3 py-6 text-center text-slate-500">无特殊工艺</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
        <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p class="text-xs text-slate-500">二维码内容</p>
          <div class="mt-2 flex justify-center">${renderRealQrPlaceholder({ value: ticket.qrCodePayload, size: 128, title: '菲票二维码', label: ticket.feiTicketNo })}</div>
          <p class="mt-2 break-all text-xs text-slate-600" data-testid="per-piece-fei-ticket-qr-payload">${escapeHtml(ticket.qrCodePayload)}</p>
        </div>
      </div>
    </section>
  `
}

function renderPerPieceFeiTicketsSection(): string {
  const allTickets = listCutPieceFeiTickets()
  const filteredTickets = getFilteredPerPieceTickets()
  const selectedTicket = getCutPieceFeiTicketById(state.perPieceSelectedTicketId)
    || filteredTickets[0]
    || allTickets[0]
    || null
  if (selectedTicket) state.perPieceSelectedTicketId = selectedTicket.feiTicketId
  const originalOptions = Array.from(new Map(allTickets.map((ticket) => [ticket.originalCutPieceOrderId, ticket.originalCutPieceOrderNo])).entries())
  const pieceOptions = uniqueStrings(allTickets.map((ticket) => ticket.pieceName))
  const colorOptions = uniqueStrings(allTickets.map((ticket) => ticket.colorName))
  const craftOptions = getPerPieceCraftOptions(allTickets)
  const printStatuses: Array<'全部' | CutPieceFeiTicketPrintStatus> = ['全部', '待打印', '已打印', '已补打', '已作废']
  const flowStatuses: Array<'全部' | CutPieceFeiTicketFlowStatus> = ['全部', '已生成', '已打印', '已绑定周转口袋', '已交出', '已流转到下一工序', '已完成']
  const rowHtml = filteredTickets.length
    ? filteredTickets.map((ticket) => `
      <tr class="hover:bg-slate-50/60" data-testid="per-piece-fei-ticket-row">
        <td class="px-3 py-2.5">
          <button type="button" data-cutting-fei-action="select-piece-ticket" data-fei-ticket-id="${escapeHtml(ticket.feiTicketId)}" class="text-left font-semibold text-blue-700 hover:underline">${escapeHtml(ticket.feiTicketNo)}</button>
          <p class="mt-1 text-xs text-slate-500">${escapeHtml(ticket.sourcePieceInstanceId)}</p>
        </td>
        <td class="px-3 py-2.5 text-slate-700">${escapeHtml(ticket.originalCutPieceOrderNo)}</td>
        <td class="px-3 py-2.5 text-slate-700">${escapeHtml(ticket.productionOrderNo)}</td>
        <td class="px-3 py-2.5 text-slate-700">${escapeHtml(ticket.pieceName)}</td>
        <td class="px-3 py-2.5 text-slate-700">${escapeHtml(ticket.colorName)}</td>
        <td class="px-3 py-2.5 text-slate-700">${escapeHtml(ticket.sizeName)}</td>
        <td class="px-3 py-2.5 text-slate-700">第${formatCount(ticket.sequenceNo)}片</td>
        <td class="px-3 py-2.5 text-slate-700" data-testid="per-piece-fei-ticket-special-craft">${escapeHtml(ticket.specialCraftSummary)}</td>
        <td class="px-3 py-2.5">${renderPerPiecePrintStatusBadge(ticket.printStatus)}</td>
        <td class="px-3 py-2.5">${renderPerPieceFlowStatusBadge(ticket.flowStatus)}</td>
        <td class="px-3 py-2.5 text-slate-700">${escapeHtml(ticket.relatedTransferBagNo || '未绑定')}</td>
        <td class="px-3 py-2.5">
          <div class="flex min-w-[220px] flex-wrap gap-2">
            <button type="button" data-cutting-fei-action="select-piece-ticket" data-fei-ticket-id="${escapeHtml(ticket.feiTicketId)}" class="inline-flex min-h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">详情</button>
            <button type="button" data-nav="${escapeHtml(buildFeiTicketLabelPrintLink(ticket.feiTicketId, ticket.printStatus === '已补打' ? 'reprint' : ticket.printStatus === '已作废' ? 'void' : 'first'))}" class="inline-flex min-h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">打印预览</button>
          </div>
        </td>
      </tr>
    `).join('')
    : '<tr><td colspan="12" class="px-3 py-8 text-center text-slate-500">暂无逐片菲票，请调整筛选或先生成菲票。</td></tr>'
  return `
    <div class="space-y-3">
      ${renderPerPieceGenerationPanel()}
      <section class="rounded-lg border bg-white p-4 shadow-sm" data-testid="per-piece-fei-ticket-section">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-sm font-semibold text-slate-900">逐片菲票</h2>
            <p class="mt-1 text-xs text-slate-500">列表按裁片实例展开，不是部位汇总；每张菲票只代表一个裁片实例。</p>
          </div>
          <div class="text-xs text-slate-500">共 ${formatCount(filteredTickets.length)} 张 / 全部 ${formatCount(allTickets.length)} 张</div>
        </div>
        <div class="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label class="space-y-1 text-sm text-slate-600"><span class="font-medium text-slate-700">菲票搜索</span><input data-cutting-fei-piece-field="keyword" value="${escapeHtml(state.perPieceFilters.keyword)}" placeholder="菲票号 / 原始裁片单 / 裁片实例" class="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" /></label>
          <label class="space-y-1 text-sm text-slate-600"><span class="font-medium text-slate-700">特殊工艺筛选</span><select data-cutting-fei-piece-field="specialCraft" class="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"><option value="">全部</option>${craftOptions.map((craft) => `<option value="${escapeHtml(craft)}" ${state.perPieceFilters.specialCraft === craft ? 'selected' : ''}>${escapeHtml(craft)}</option>`).join('')}</select></label>
          <label class="space-y-1 text-sm text-slate-600"><span class="font-medium text-slate-700">原始裁片单</span><select data-cutting-fei-piece-field="originalCutPieceOrderId" class="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"><option value="">全部</option>${originalOptions.map(([id, no]) => `<option value="${escapeHtml(id)}" ${state.perPieceFilters.originalCutPieceOrderId === id ? 'selected' : ''}>${escapeHtml(no)}</option>`).join('')}</select></label>
          <label class="space-y-1 text-sm text-slate-600"><span class="font-medium text-slate-700">部位</span><select data-cutting-fei-piece-field="pieceName" class="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"><option value="">全部</option>${pieceOptions.map((piece) => `<option value="${escapeHtml(piece)}" ${state.perPieceFilters.pieceName === piece ? 'selected' : ''}>${escapeHtml(piece)}</option>`).join('')}</select></label>
          <label class="space-y-1 text-sm text-slate-600"><span class="font-medium text-slate-700">颜色</span><select data-cutting-fei-piece-field="colorName" class="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"><option value="">全部</option>${colorOptions.map((color) => `<option value="${escapeHtml(color)}" ${state.perPieceFilters.colorName === color ? 'selected' : ''}>${escapeHtml(color)}</option>`).join('')}</select></label>
          <label class="space-y-1 text-sm text-slate-600"><span class="font-medium text-slate-700">打印状态</span><select data-cutting-fei-piece-field="printStatus" class="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200">${printStatuses.map((status) => `<option value="${status}" ${state.perPieceFilters.printStatus === status ? 'selected' : ''}>${status}</option>`).join('')}</select></label>
          <label class="space-y-1 text-sm text-slate-600"><span class="font-medium text-slate-700">流转状态</span><select data-cutting-fei-piece-field="flowStatus" class="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200">${flowStatuses.map((status) => `<option value="${status}" ${state.perPieceFilters.flowStatus === status ? 'selected' : ''}>${status}</option>`).join('')}</select></label>
        </div>
        <div class="mt-4 overflow-hidden rounded-lg border border-slate-200">
          ${renderStickyTableScroller(`<table class="min-w-full text-sm"><thead class="sticky top-0 z-10 bg-slate-50 text-xs text-slate-500"><tr><th class="px-3 py-3 text-left font-medium">菲票编号</th><th class="px-3 py-3 text-left font-medium">原始裁片单</th><th class="px-3 py-3 text-left font-medium">生产单</th><th class="px-3 py-3 text-left font-medium">部位</th><th class="px-3 py-3 text-left font-medium">颜色</th><th class="px-3 py-3 text-left font-medium">尺码</th><th class="px-3 py-3 text-left font-medium">片序号</th><th class="px-3 py-3 text-left font-medium">特殊工艺</th><th class="px-3 py-3 text-left font-medium">打印状态</th><th class="px-3 py-3 text-left font-medium">流转状态</th><th class="px-3 py-3 text-left font-medium">周转口袋</th><th class="px-3 py-3 text-left font-medium">操作</th></tr></thead><tbody class="divide-y divide-slate-100 bg-white">${rowHtml}</tbody></table>`, 'max-h-[52vh]')}
        </div>
      </section>
      ${renderPerPieceTicketDetail(selectedTicket)}
    </div>
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
    ${renderPerPieceFeiTicketsSection()}
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
  const sourceMarkerText = unit.sourceMarkerNos.join(' / ') || '待补'
  const sourceCutOrderText = unit.sourceCutOrderNos.join(' / ') || '待补'
  const sourceMergeBatchText = unit.batchNo || '未关联合并裁剪批次'
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
            <div class="mt-1 flex flex-wrap items-center gap-2">
              <span class="inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${unit.ticketCountBasisType === 'SPREADING_RESULT' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}">${escapeHtml(unit.ticketCountBasisLabel)}</span>
              <span class="text-xs text-slate-500">${escapeHtml(unit.ticketCountBasisType === 'SPREADING_RESULT' ? '按实际成衣件数拆分' : '当前尚未形成完整铺布完成结果')}</span>
            </div>
            <p class="mt-1 text-xs text-slate-500">${escapeHtml(unit.ticketCountBasisDetail)}</p>
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
          <div class="rounded-lg border border-slate-200 bg-white p-3 md:col-span-2 xl:col-span-4">
            <p class="text-xs text-slate-500">来源铺布</p>
            <p class="mt-1 text-sm font-medium text-slate-900">${escapeHtml(buildSpreadingTraceText(unit))}</p>
          </div>
          <div class="rounded-lg border border-slate-200 bg-white p-3">
            <p class="text-xs text-slate-500">来源唛架</p>
            <p class="mt-1 text-sm font-medium text-slate-900">${escapeHtml(sourceMarkerText)}</p>
          </div>
          <div class="rounded-lg border border-slate-200 bg-white p-3">
            <p class="text-xs text-slate-500">来源原始裁片单</p>
            <p class="mt-1 text-sm font-medium text-slate-900">${escapeHtml(sourceCutOrderText)}</p>
          </div>
          <div class="rounded-lg border border-slate-200 bg-white p-3">
            <p class="text-xs text-slate-500">来源合并裁剪批次</p>
            <p class="mt-1 text-sm font-medium text-slate-900">${escapeHtml(sourceMergeBatchText)}</p>
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
          <th class="px-3 py-3 text-left font-medium">面料卷号</th>
          <th class="px-3 py-3 text-left font-medium">布料颜色</th>
          <th class="px-3 py-3 text-left font-medium">尺码</th>
          <th class="px-3 py-3 text-left font-medium">裁片部位</th>
          <th class="px-3 py-3 text-left font-medium">数量</th>
          <th class="px-3 py-3 text-left font-medium">扎号</th>
          <th class="px-3 py-3 text-left font-medium">原始裁片单</th>
          <th class="px-3 py-3 text-left font-medium">生产单</th>
          <th class="px-3 py-3 text-left font-medium">同组裁片</th>
          <th class="px-3 py-3 text-left font-medium">缺口菲票数</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100 bg-white">
        ${detailView.splitDetails
          .map(
            (detail) => `
              <tr>
                <td class="px-3 py-3 font-medium text-slate-900">${escapeHtml(detail.fabricRollNo || '暂无数据')}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(detail.fabricColor || '暂无数据')}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(detail.size || '待补尺码')}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(detail.partName)}</td>
                <td class="px-3 py-3 text-slate-700">${formatCount(detail.quantity)}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(detail.bundleNo || '暂无数据')}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(detail.sourceCutOrderNo)}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(detail.sourceProductionOrderNo)}</td>
                <td class="px-3 py-3 text-slate-700">${renderSiblingTicketNos(detail.siblingPartTicketNos)}</td>
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

function resolveSpecialCraftTaskRoute(ticketNo: string): string {
  const binding = listCuttingSpecialCraftFeiTicketBindings().find((item) => item.feiTicketNo === ticketNo)
  return binding ? buildSpecialCraftTaskDetailPath(binding.operationId, binding.taskOrderId) : '/fcs/craft/cutting/special-processes'
}

function renderSpecialCraftFlowBlock(ticketNo: string): string {
  const summary = getSpecialCraftFeiTicketSummary(ticketNo)
  return `
    <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p class="text-xs text-slate-500">特殊工艺流转</p>
      <div class="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        <div>
          <p class="text-xs text-slate-500">是否需要特殊工艺</p>
          <p class="text-sm font-semibold text-slate-900">${summary.needSpecialCraft ? '是' : '无'}</p>
        </div>
        <div>
          <p class="text-xs text-slate-500">特殊工艺</p>
          <p class="text-sm font-semibold text-slate-900">${escapeHtml(summary.operationNames.join(' / ') || '待绑定')}</p>
        </div>
        <div>
          <p class="text-xs text-slate-500">已完成特殊工艺</p>
          <p class="text-sm font-semibold text-slate-900">${escapeHtml(summary.completedOperationNames.join(' / ') || '—')}</p>
        </div>
        <div>
          <p class="text-xs text-slate-500">当前特殊工艺</p>
          <p class="text-sm font-semibold text-slate-900">${escapeHtml(summary.currentOperationName)}</p>
        </div>
        <div>
          <p class="text-xs text-slate-500">特殊工艺任务</p>
          <p class="text-sm font-semibold text-slate-900">${escapeHtml(summary.taskOrderNos.join(' / ') || '待绑定')}</p>
        </div>
        <div>
          <p class="text-xs text-slate-500">发料状态</p>
          <p class="text-sm font-semibold text-slate-900">${escapeHtml(summary.dispatchStatus)}</p>
        </div>
        <div>
          <p class="text-xs text-slate-500">回仓状态</p>
          <p class="text-sm font-semibold text-slate-900">${escapeHtml(summary.returnStatus)}</p>
        </div>
        <div>
          <p class="text-xs text-slate-500">当前所在</p>
          <p class="text-sm font-semibold text-slate-900">${escapeHtml(summary.currentLocation)}</p>
        </div>
        <div>
          <p class="text-xs text-slate-500">原数量 / 当前数量</p>
          <p class="text-sm font-semibold text-slate-900">${formatCount(summary.originalQty)} / ${formatCount(summary.currentQty)}</p>
        </div>
        <div>
          <p class="text-xs text-slate-500">累计报废 / 累计货损</p>
          <p class="text-sm font-semibold text-slate-900">${formatCount(summary.cumulativeScrapQty)} / ${formatCount(summary.cumulativeDamageQty)}</p>
        </div>
        <div>
          <p class="text-xs text-slate-500">差异状态</p>
          <p class="text-sm font-semibold text-slate-900">${escapeHtml([summary.receiveDifferenceStatus, summary.returnDifferenceStatus].filter((item) => item !== '—').join(' / ') || '无')}</p>
        </div>
      </div>
    </div>
  `
}

function renderTicketPreviewPanel(unit: PrintableUnit, ticket: TicketCard | null): string {
  if (!ticket) return ''
  const bundle = getDataBundle()
  const craftTrace = findCraftTraceItem(bundle, ticket)
  const specialCraftSummary = getSpecialCraftFeiTicketSummary(ticket.ticketNo)
  const panel = getCurrentSearchParams().get('panel') || 'qr'
  const fiveDimTitle = buildFeiTicketFiveDimTitle(ticket)
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
            <div class="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <p class="text-lg font-semibold text-slate-900">${escapeHtml(fiveDimTitle)}</p>
            </div>
            <div class="mt-3 grid gap-3 md:grid-cols-[1fr,140px]">
              <div class="grid gap-3 md:grid-cols-2">
                <div>
                  <p class="text-sm text-slate-500">票号</p>
                  <p class="text-lg font-semibold text-slate-900">${escapeHtml(ticket.ticketNo)}</p>
                </div>
                <div>
                  <p class="text-sm text-slate-500">原始裁片单 / 生产单</p>
                  <p class="text-sm font-semibold text-slate-900">${escapeHtml(`${craftTrace?.originalCutOrderNo || ticket.sourceCutOrderNo} / ${craftTrace?.productionOrderNo || ticket.sourceProductionOrderNo || '待补生产单'}`)}</p>
                </div>
                <div>
                  <p class="text-sm text-slate-500">面料 SKU / 面料卷号</p>
                  <p class="text-lg font-semibold text-slate-900">${escapeHtml(craftTrace?.materialSku || unit.fabricSku || '待补')}</p>
                  <p class="mt-1 text-xs text-slate-500">${escapeHtml(ticket.fabricRollNo || '暂无数据')}</p>
                </div>
                <div>
                  <p class="text-sm text-slate-500">布料颜色 / 成衣颜色</p>
                  <p class="text-lg font-semibold text-slate-900">${escapeHtml(ticket.fabricColor || '暂无数据')}</p>
                  <p class="mt-1 text-xs text-slate-500">${escapeHtml(ticket.color || '暂无数据')}</p>
                </div>
                <div>
                  <p class="text-sm text-slate-500">裁片部位 / 扎号</p>
                  <p class="text-lg font-semibold text-slate-900">${escapeHtml(ticket.partName)}</p>
                  <p class="mt-1 text-xs text-slate-500">${escapeHtml(ticket.bundleNo || '暂无数据')}</p>
                </div>
                <div>
                  <p class="text-sm text-slate-500">数量 / 裁片数</p>
                  <p class="text-lg font-semibold text-slate-900">${formatCount(ticket.quantity)}</p>
                  <p class="mt-1 text-xs text-slate-500">${escapeHtml(`${formatCount(ticket.actualCutPieceQty)} 片`)}</p>
                </div>
                <div>
                  <p class="text-sm text-slate-500">同组裁片</p>
                  <p class="text-sm font-semibold text-slate-900">${escapeHtml(formatAssemblyGroupText(ticket))}</p>
                  <p class="mt-1 text-xs text-slate-500">${renderSiblingTicketNos(ticket.siblingPartTicketNos)}</p>
                </div>
                <div>
                  <p class="text-sm text-slate-500">工艺顺序</p>
                  <p class="text-sm font-semibold text-slate-900">${escapeHtml(craftTrace?.secondaryCrafts.join(' → ') || '未配置')}</p>
                  <p class="mt-1 text-xs text-slate-500">${escapeHtml(`版本 ${craftTrace?.craftSequenceVersion || '待补'} / 当前 ${craftTrace?.currentCraftStage || '未开始'}`)}</p>
                </div>
                <div>
                  <p class="text-sm text-slate-500">特殊工艺</p>
                  <p class="text-sm font-semibold text-slate-900">${escapeHtml(specialCraftSummary.operationNames.join(' / ') || '无')}</p>
                  <p class="mt-1 text-xs text-slate-500">${escapeHtml(specialCraftSummary.taskOrderNos.join(' / ') || '待绑定')}</p>
                </div>
                <div>
                  <p class="text-sm text-slate-500">发料状态 / 回仓状态</p>
                  <p class="text-sm font-semibold text-slate-900">${escapeHtml(`${specialCraftSummary.dispatchStatus} / ${specialCraftSummary.returnStatus}`)}</p>
                  <p class="mt-1 text-xs text-slate-500">${escapeHtml(specialCraftSummary.currentLocation)}</p>
                </div>
              </div>
              <div>
                ${
                  isFeiTicketFiveDimComplete(ticket)
                    ? renderRealQrPlaceholder({
                        value: getTicketScanCode(ticket),
                        size: 128,
                        title: '菲票二维码',
                        label: `菲票 ${ticket.ticketNo}`,
                      })
                    : '<div class="inline-flex h-[128px] w-[128px] items-center justify-center rounded-lg border border-dashed text-xs text-slate-500">缺少数据</div>'
                }
                <p class="mt-2 text-center text-xs text-slate-500">菲票二维码</p>
              </div>
            </div>
          </div>
        `
        : `
          <div class="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div class="flex flex-wrap items-start gap-4">
              ${
                isFeiTicketFiveDimComplete(ticket)
                  ? renderRealQrPlaceholder({
                      value: getTicketScanCode(ticket),
                      size: 128,
                      title: '菲票二维码',
                      label: `菲票 ${ticket.ticketNo}`,
                    })
                  : '<div class="inline-flex h-[128px] w-[128px] items-center justify-center rounded-lg border border-dashed text-xs text-blue-600">缺少数据</div>'
              }
              <div class="grid flex-1 gap-2 text-sm text-blue-900">
                <div class="font-semibold">${escapeHtml(fiveDimTitle)}</div>
                <div>原始裁片单：${escapeHtml(craftTrace?.originalCutOrderNo || ticket.sourceCutOrderNo)}</div>
                <div>生产单：${escapeHtml(craftTrace?.productionOrderNo || ticket.sourceProductionOrderNo || '待补')}</div>
                <div>面料 SKU：${escapeHtml(craftTrace?.materialSku || unit.fabricSku || '待补')}</div>
                <div>扎号：${escapeHtml(ticket.bundleNo || '暂无数据')}</div>
                <div>同组裁片：${escapeHtml(formatAssemblyGroupText(ticket))}</div>
              </div>
            </div>
          </div>
        `

  return renderSectionCard(title, '', `${body}${renderSpecialCraftFlowBlock(ticket.ticketNo)}`)
}

function renderPrintedTicketsTab(unit: PrintableUnit, detailView: PrintableUnitDetailViewModel): string {
  const selectedTicket = findTicketCard(detailView)
  const tableHtml = `
    <table class="min-w-full text-sm">
      <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
        <tr>
          <th class="px-3 py-3 text-left font-medium">菲票号</th>
          <th class="px-3 py-3 text-left font-medium">原始裁片单</th>
          <th class="px-3 py-3 text-left font-medium">生产单</th>
          <th class="px-3 py-3 text-left font-medium">面料卷号</th>
          <th class="px-3 py-3 text-left font-medium">布料颜色</th>
          <th class="px-3 py-3 text-left font-medium">尺码</th>
          <th class="px-3 py-3 text-left font-medium">裁片部位</th>
          <th class="px-3 py-3 text-left font-medium">数量</th>
          <th class="px-3 py-3 text-left font-medium">扎号</th>
          <th class="px-3 py-3 text-left font-medium">是否需要特殊工艺</th>
          <th class="px-3 py-3 text-left font-medium">特殊工艺</th>
          <th class="px-3 py-3 text-left font-medium">特殊工艺顺序</th>
          <th class="px-3 py-3 text-left font-medium">已完成特殊工艺</th>
          <th class="px-3 py-3 text-left font-medium">当前特殊工艺</th>
          <th class="px-3 py-3 text-left font-medium">特殊工艺任务</th>
          <th class="px-3 py-3 text-left font-medium">原数量</th>
          <th class="px-3 py-3 text-left font-medium">当前数量</th>
          <th class="px-3 py-3 text-left font-medium">累计报废</th>
          <th class="px-3 py-3 text-left font-medium">累计货损</th>
          <th class="px-3 py-3 text-left font-medium">接收差异状态</th>
          <th class="px-3 py-3 text-left font-medium">回仓差异状态</th>
          <th class="px-3 py-3 text-left font-medium">发料状态</th>
          <th class="px-3 py-3 text-left font-medium">回仓状态</th>
          <th class="px-3 py-3 text-left font-medium">当前所在</th>
          <th class="px-3 py-3 text-left font-medium">中转单号</th>
          <th class="px-3 py-3 text-left font-medium">中转袋号</th>
          <th class="px-3 py-3 text-left font-medium">袋内状态</th>
          <th class="px-3 py-3 text-left font-medium">所属交出记录</th>
          <th class="px-3 py-3 text-left font-medium">发车缝状态</th>
          <th class="px-3 py-3 text-left font-medium">是否已装袋</th>
          <th class="px-3 py-3 text-left font-medium">是否已交出</th>
          <th class="px-3 py-3 text-left font-medium">车缝回写状态</th>
          <th class="px-3 py-3 text-left font-medium">特殊工艺回仓状态</th>
          <th class="px-3 py-3 text-left font-medium">同组裁片</th>
          <th class="px-3 py-3 text-left font-medium">打印版本号</th>
          <th class="px-3 py-3 text-left font-medium">打印状态</th>
          <th class="px-3 py-3 text-left font-medium">中转袋绑定</th>
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
            const specialCraftSummary = getSpecialCraftFeiTicketSummary(ticket.ticketNo)
            const sewingDispatchSummary = findCuttingSewingDispatchByFeiTicketNo(ticket.ticketNo)
            const actions =
              ticket.status === 'VALID'
                ? [
                    { label: '查看菲票码', href: buildFeiTicketLabelPrintLink(ticket.ticketId, 'first') },
                    { label: '查看打印预览', href: buildFeiTicketLabelPrintLink(ticket.ticketId, 'first') },
                    { label: '打印菲票标签', href: buildFeiTicketLabelPrintLink(ticket.ticketId, 'first') },
                    { label: '补打标签', href: buildFeiTicketLabelPrintLink(ticket.ticketId, 'reprint') },
                    { label: '查看同组', href: buildTicketPanelHref(unit, ticket, 'preview') },
                    {
                      label: '查看裁片发料',
                      href: `${getCanonicalCuttingPath('sewing-dispatch')}?keyword=${encodeURIComponent(ticket.ticketNo)}`,
                    },
                    {
                      label: '查看中转袋',
                      href: `${getCanonicalCuttingPath('transfer-bags')}?keyword=${encodeURIComponent(sewingDispatchSummary.transferBag?.transferBagNo || ticket.ticketNo)}`,
                    },
                    {
                      label: sewingDispatchSummary.transferBag?.editableBeforeHandover ? '已装袋未交出可移出' : '已交出后不可移出',
                      href: `${getCanonicalCuttingPath('sewing-dispatch')}?keyword=${encodeURIComponent(ticket.ticketNo)}`,
                    },
                    ...(specialCraftSummary.needSpecialCraft
                      ? [
                          { label: '查看特殊工艺任务', href: resolveSpecialCraftTaskRoute(ticket.ticketNo) },
                          {
                            label: '查看特殊工艺发料',
                            href: `${getCanonicalCuttingPath('special-craft-dispatch')}?keyword=${encodeURIComponent(ticket.ticketNo)}`,
                          },
                          {
                            label: '查看特殊工艺回仓',
                            href: `${getCanonicalCuttingPath('special-craft-return')}?keyword=${encodeURIComponent(ticket.ticketNo)}`,
                          },
                        ]
                      : []),
                    ...(!ticket.downstreamLocked
                      ? [{ label: '发起作废', href: buildActionHref('fei-ticket-void', unit, { ticketRecordId: ticket.ticketId }) }]
                      : []),
                  ]
                : [
                    { label: '查看作废原因', href: buildTicketPanelHref(unit, ticket, 'void-info') },
                    { label: '打印作废标识', href: buildFeiTicketLabelPrintLink(ticket.ticketId, 'void') },
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
                <td class="px-3 py-3 text-slate-700">${escapeHtml(ticket.sourceCutOrderNo)}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(ticket.sourceProductionOrderNo)}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(ticket.fabricRollNo || '暂无数据')}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(ticket.fabricColor || '暂无数据')}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(ticket.size)}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(ticket.partName)}</td>
                <td class="px-3 py-3 text-slate-700">${formatCount(ticket.quantity)}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(ticket.bundleNo || '暂无数据')}</td>
                <td class="px-3 py-3 text-slate-700">${specialCraftSummary.needSpecialCraft ? '是' : '无'}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(specialCraftSummary.operationNames.join(' / ') || '待绑定')}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(specialCraftSummary.operationNames.join(' → ') || '无')}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(specialCraftSummary.completedOperationNames.join(' / ') || '—')}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(specialCraftSummary.currentOperationName)}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(specialCraftSummary.taskOrderNos.join(' / ') || '待绑定')}</td>
                <td class="px-3 py-3 text-slate-700">${formatCount(specialCraftSummary.originalQty)}</td>
                <td class="px-3 py-3 text-slate-700">${formatCount(specialCraftSummary.currentQty)}</td>
                <td class="px-3 py-3 text-slate-700">${formatCount(specialCraftSummary.cumulativeScrapQty)}</td>
                <td class="px-3 py-3 text-slate-700">${formatCount(specialCraftSummary.cumulativeDamageQty)}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(specialCraftSummary.receiveDifferenceStatus)}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(specialCraftSummary.returnDifferenceStatus)}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(specialCraftSummary.dispatchStatus)}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(specialCraftSummary.returnStatus)}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(specialCraftSummary.currentLocation)}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(sewingDispatchSummary.dispatchBatch?.transferOrderNo || '未装袋')}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(sewingDispatchSummary.transferBag?.transferBagNo || '未装袋')}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(sewingDispatchSummary.transferBag ? sewingDispatchSummary.transferBag.packStatus : '未装袋')}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(sewingDispatchSummary.dispatchBatch?.handoverRecordNo || '待提交')}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(sewingDispatchSummary.feiTicketSewingStatus)}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(sewingDispatchSummary.transferBag ? '已装袋' : '未装袋')}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(['已交出', '已回写', '差异', '异议中'].includes(sewingDispatchSummary.feiTicketSewingStatus) ? '已交出' : '未交出')}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(sewingDispatchSummary.feiTicketSewingStatus === '已回写' ? '已回写' : sewingDispatchSummary.feiTicketSewingStatus === '差异' ? '差异' : sewingDispatchSummary.feiTicketSewingStatus === '异议中' ? '异议中' : '待回写')}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(sewingDispatchSummary.specialCraftReturnStatus)}</td>
                <td class="px-3 py-3 text-slate-700">${renderSiblingTicketNos(ticket.siblingPartTicketNos)}</td>
                <td class="px-3 py-3 text-slate-700">V${formatCount(ticket.version)}</td>
                <td class="px-3 py-3">
                  <div class="space-y-1">
                    ${renderTicketStatusBadge(ticket.status)}
                    ${ticket.downstreamLocked ? `<p class="text-xs text-rose-600">${escapeHtml(ticket.downstreamLockedReason || '下游已锁定')}</p>` : ''}
                  </div>
                </td>
                <td class="px-3 py-3 text-slate-700">${ticket.boundPocketNo ? escapeHtml(`${ticket.boundPocketNo} / ${ticket.boundUsageNo || '待补使用周期号'}`) : '未绑定中转袋'}</td>
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
    `)
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
  `)
}

function buildOperationPreviewRows(rows: TicketSplitDetail[]): string {
  const tableHtml = `
    <table class="min-w-full text-sm">
      <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
        <tr>
          <th class="px-3 py-3 text-left font-medium">面料卷号</th>
          <th class="px-3 py-3 text-left font-medium">布料颜色</th>
          <th class="px-3 py-3 text-left font-medium">尺码</th>
          <th class="px-3 py-3 text-left font-medium">裁片部位</th>
          <th class="px-3 py-3 text-left font-medium">数量</th>
          <th class="px-3 py-3 text-left font-medium">扎号</th>
          <th class="px-3 py-3 text-left font-medium">原始裁片单</th>
          <th class="px-3 py-3 text-left font-medium">当前缺口数</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100 bg-white">
        ${rows
          .map(
            (detail) => `
              <tr>
                <td class="px-3 py-3 font-medium text-slate-900">${escapeHtml(detail.fabricRollNo || '暂无数据')}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(detail.fabricColor || '暂无数据')}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(detail.size)}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(detail.partName)}</td>
                <td class="px-3 py-3 text-slate-700">${formatCount(detail.quantity)}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(detail.bundleNo || '暂无数据')}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(detail.sourceCutOrderNo)}</td>
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
  `)
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
  const invalidPreviewDetails = previewDetails.filter((detail) => !isFeiTicketFiveDimComplete(detail))
  if (invalidPreviewDetails.length) {
    return renderOperationValidation('当前存在缺少五维字段的菲票，不能打印。', unit, pageKey)
  }
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
          <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">本次计划打印件数（件）</p><p class="mt-1 text-sm font-semibold text-slate-900">${formatCount(planCount)}</p></div>
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
  `)
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

  const pieceFieldNode = target.closest<HTMLElement>('[data-cutting-fei-piece-field]')
  if (pieceFieldNode) {
    const field = pieceFieldNode.dataset.cuttingFeiPieceField
    const input = pieceFieldNode as HTMLInputElement | HTMLSelectElement
    if (field === 'generationOriginalCutOrderId') {
      state.perPieceGenerationOriginalCutOrderId = input.value
      state.perPieceGenerationPreviewOpen = false
      state.perPieceMessage = ''
      return true
    }
    if (
      field === 'keyword'
      || field === 'specialCraft'
      || field === 'originalCutPieceOrderId'
      || field === 'pieceName'
      || field === 'colorName'
      || field === 'printStatus'
      || field === 'flowStatus'
    ) {
      state.perPieceFilters = {
        ...state.perPieceFilters,
        [field]: input.value,
      } as PerPieceFeiTicketFilters
      return true
    }
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

  if (action === 'open-piece-generation-preview') {
    const sourceId = ensurePerPieceGenerationSelection()
    if (!sourceId) {
      state.perPieceMessage = '请先选择原始裁片单。'
      return true
    }
    const preview = previewFeiTicketGeneration(sourceId)
    if (!preview) {
      state.perPieceMessage = '当前纸样未生成裁片实例，请先维护颜色片数和裁片实例。'
      return true
    }
    state.perPieceGenerationPreviewOpen = true
    state.perPieceMessage = preview.message
    return true
  }

  if (action === 'close-piece-generation-preview') {
    state.perPieceGenerationPreviewOpen = false
    return true
  }

  if (action === 'confirm-piece-generation') {
    const result = confirmFeiTicketGeneration(ensurePerPieceGenerationSelection())
    state.perPieceGenerationPreviewOpen = false
    state.perPieceMessage = result.message
    if (result.createdTickets[0]) {
      state.perPieceSelectedTicketId = result.createdTickets[0].feiTicketId
      state.perPieceFilters = {
        ...state.perPieceFilters,
        originalCutPieceOrderId: result.createdTickets[0].originalCutPieceOrderId,
      }
    }
    return true
  }

  if (action === 'select-piece-ticket') {
    const ticketId = actionNode.dataset.feiTicketId || ''
    if (ticketId) state.perPieceSelectedTicketId = ticketId
    return true
  }

  if (action === 'reprint-piece-ticket') {
    const ticketId = actionNode.dataset.feiTicketId || state.perPieceSelectedTicketId
    const ticket = reprintCutPieceFeiTicket(ticketId)
    state.perPieceMessage = ticket ? `已补打菲票 ${ticket.feiTicketNo}，补打不生成新的业务菲票。` : '未找到需要补打的菲票。'
    return true
  }

  if (action === 'void-piece-ticket') {
    const ticketId = actionNode.dataset.feiTicketId || state.perPieceSelectedTicketId
    const reason = window.prompt('请填写作废原因') || ''
    if (!reason.trim()) {
      state.perPieceMessage = '已打印菲票不能删除，如需取消请作废。'
      return true
    }
    const ticket = voidCutPieceFeiTicket(ticketId, reason.trim())
    state.perPieceMessage = ticket ? `已作废菲票 ${ticket.feiTicketNo}，原因：${reason.trim()}` : '未找到需要作废的菲票。'
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
