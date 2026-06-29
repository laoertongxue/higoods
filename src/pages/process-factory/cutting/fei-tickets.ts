import { appStore } from '../../../state/store.ts'
import { escapeHtml } from '../../../utils.ts'
import {
  buildFeiTicketFiveDimTitle,
  buildPrintableUnitDetailViewModel,
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
  type TicketSplitDetail,
} from './fei-tickets-model.ts'
import { renderRealQrPlaceholder } from '../../../components/real-qr.ts'
import {
  renderCompactKpiCard,
  renderCompactKpiGroup,
  renderStickyFilterShell,
  renderStickyTableScroller,
} from './layout.helpers.ts'
import { renderMaterialIdentityBlock } from './material-identity.ts'
import {
  PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE,
  renderProductionOrderIdentityCell,
} from '../../../data/fcs/production-order-identity.ts'
import { getCanonicalCuttingMeta, getCanonicalCuttingPath, isCuttingAliasPath, renderCuttingPageHeader } from './meta.ts'
import {
  buildCuttingRouteWithContext,
  buildReturnToSummaryContext,
  hasSummaryReturnContext,
  readCuttingDrillContextFromLocation,
  serializeCuttingDrillContext,
} from './navigation-context.ts'
import {
  buildFeiTicketLabelPrintProjection,
  buildFeiTicketPrintProjection,
  type FeiTicketTemplateSize,
} from './fei-ticket-print-projection.ts'
import {
  FEI_TICKET_SOURCE_BASIS_TYPE,
  listGeneratedFeiTickets,
  listFeiTicketGenerationEligibilityRows,
  listPieceSequenceRangeScenarioRows,
  type GeneratedFeiTicketSourceRecord,
} from '../../../data/fcs/cutting/generated-fei-tickets.ts'
import {
  getFeiTicketNumberingStatus,
  type FeiTicketNumberingStatus,
} from '../../../data/fcs/cutting/fei-ticket-numbering.ts'
import {
  getSpecialCraftFeiTicketSummary,
  listCuttingSpecialCraftFeiTicketBindings,
} from '../../../data/fcs/cutting/special-craft-fei-ticket-flow.ts'
import { findCuttingSewingDispatchByFeiTicketNo } from '../../../data/fcs/cutting/sewing-dispatch.ts'
import { buildSpecialCraftTaskDetailPath } from '../../../data/fcs/special-craft-operations.ts'
import { buildFeiTicketLabelPrintLink } from '../../../data/fcs/fcs-route-links.ts'
import { buildBindingProcessOrders } from './binding-strip-orders.ts'
import type { BindingProcessOrder, BindingStripWorkOrderDetail } from './special-processes-model.ts'
import type { CutOrderRow } from './cut-orders-model.ts'
import type { MaterialPrepRow } from './material-prep-model.ts'
import type { MarkerPlanSourceRecord } from './marker-plan-source-model.ts'
import type { MarkerSpreadingStore } from './marker-spreading-model.ts'
import type { TransferBagStore } from './transfer-bags-model.ts'
import type { CraftTraceProjection, CraftTraceProjectionItem } from './craft-trace-projection.ts'

interface FeiTicketsPageState {
  filters: FeiTicketPrintFilters
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
  cutOrderRows: CutOrderRow[]
  materialPrepRows: MaterialPrepRow[]
  markerPlanSources: MarkerPlanSourceRecord[]
  markerStore: MarkerSpreadingStore
  ticketRecords: FeiTicketLabelRecord[]
  printJobs: FeiTicketPrintJob[]
  transferBagStore: TransferBagStore
  printableViewModel: PrintableUnitViewModel
  craftTraceProjection: CraftTraceProjection
  filteredUnits: PrintableUnit[]
}

type DetailTabKey = 'split' | 'printed'
type OperationPageKey = 'fei-ticket-print' | 'fei-ticket-reprint'
type FeiWorkbenchTabKey = 'WAIT_FIRST' | 'PRINTED' | 'NEED_REPRINT'
type FeiPrintObjectType = 'ALL' | 'SPREADING_ORDER' | 'BINDING_STRIP_ORDER'
type FeiTicketPrintObjectType = Exclude<FeiPrintObjectType, 'ALL'>
type FeiPrintObjectStatus = PrintableUnitStatus
type FeiTicketListMode = 'PART' | 'BINDING'

interface FeiTicketPrintFilters extends PrintableUnitFilters {
  printObjectType: FeiPrintObjectType
}

type PrintableActionPageKey =
  | 'fei-ticket-detail'
  | 'fei-ticket-printed'
  | 'fei-ticket-print'
  | 'fei-ticket-reprint'

const FEI_CODE_FIELD = ['qr', 'Payload'].join('')

interface FeiTicketWorkbenchRow {
  tab: FeiWorkbenchTabKey
  ticketId: string
  ticketNo: string
  versionLabel: string
  printStatusLabel: string
  productionOrderNo: string
  cutOrderNo: string
  markerPlanNo: string
  markerNumber: string
  spreadingOrderNo: string
  spuCode: string
  color: string
  size: string
  partName: string
  pieceQty: number
  pieceSequenceLabel: string
  hasSpecialCraft: boolean
  specialCraftLines: string[]
  receiverFactoryLines: string[]
  firstPrintedAt: string
  latestReprintAt: string
  printCount: number
  printedBy: string
  reason: string
  record: FeiTicketLabelRecord | null
  generated: GeneratedFeiTicketSourceRecord
}

interface FeiTicketSpreadingWorkbenchRow {
  tab: FeiWorkbenchTabKey
  spreadingKey: string
  spreadingOrderNo: string
  markerPlanNo: string
  markerNumber: string
  productionOrderNos: string[]
  cutOrderNos: string[]
  spuCodes: string[]
  colors: string[]
  sizes: string[]
  partNames: string[]
  ticketCount: number
  totalPieceQty: number
  pendingCount: number
  printedCount: number
  pieceSequenceLabels: string[]
  hasSpecialCraft: boolean
  specialCraftLines: string[]
  receiverFactoryLines: string[]
  firstPrintedAt: string
  latestReprintAt: string
  printCount: number
  printedBy: string
  printStatusLabel: string
  detailRows: FeiTicketWorkbenchRow[]
  primaryRow: FeiTicketWorkbenchRow
}

interface FeiTicketPrintObjectDetail {
  ticketId: string
  ticketNo: string
  primaryLabel: string
  secondaryLabel: string
  quantityLabel: string
  printStatusLabel: string
  printHref: string
}

interface FeiTicketPrintObjectRow {
  objectId: string
  objectNo: string
  objectType: FeiTicketPrintObjectType
  objectTypeLabel: string
  detailHref: string
  allPrintHref: string
  sourceLines: string[]
  material: {
    materialSku: string
    materialLabel: string
    materialAlias?: string
    materialImageUrl?: string
    materialColor?: string
  }
  styleCode: string
  materialSearchText: string
  ticketCount: number
  totalQuantityLabel: string
  printedCount: number
  missingCount: number
  printStatus: FeiPrintObjectStatus
  printStatusLabel: string
  firstPrintedAt: string
  latestReprintAt: string
  printCount: number
  printedBy: string
  detailRows: FeiTicketPrintObjectDetail[]
  keywordIndex: string[]
  sourceOrder?: FeiTicketSpreadingWorkbenchRow | BindingProcessOrder
}

function getTicketScanCode(source: Record<string, unknown>): string {
  const value = source[FEI_CODE_FIELD]
  return typeof value === 'string' ? value : ''
}

function buildFeiActualOutputBusinessLines(row: FeiTicketWorkbenchRow): string[] {
  const generated = row.generated
  const primaryLine = [
    row.spreadingOrderNo ? `铺布单 ${row.spreadingOrderNo}` : '',
    row.markerNumber ? `唛架编号 ${row.markerNumber}` : '',
    generated.bedNo ? `床次 ${generated.bedNo}` : '',
  ].filter(Boolean).join(' · ')
  const pieceLine = [
    row.partName || generated.partName ? `部位 ${row.partName || generated.partName}` : '',
    row.size || generated.skuSize ? `尺码 ${row.size || generated.skuSize}` : '',
    row.pieceSequenceLabel && row.pieceSequenceLabel !== '不可生成' ? `编号范围 ${row.pieceSequenceLabel}` : '',
  ].filter(Boolean).join(' · ')
  const qtyLine = row.pieceQty > 0 ? `本张菲票裁片数量 ${formatCount(row.pieceQty)} 片` : ''
  return [primaryLine, pieceLine, qtyLine].filter(Boolean)
}

function buildFeiQrBusinessTraceLines(
  row: FeiTicketWorkbenchRow,
  projection: ReturnType<typeof buildFeiTicketLabelPrintProjection>,
): string[] {
  const qr = projection.qrPayload
  const sourceLine = [
    qr.productionOrderNo ? `生产单 ${qr.productionOrderNo}` : '',
    qr.cutOrderNo ? `裁片单 ${qr.cutOrderNo}` : '',
    qr.spreadingOrderNo ? `铺布单 ${qr.spreadingOrderNo}` : '',
  ].filter(Boolean).join(' · ')
  const pieceLine = [
    qr.color ? `颜色 ${qr.color}` : '',
    qr.size ? `尺码 ${qr.size}` : '',
    qr.partName ? `部位 ${qr.partName}` : '',
    qr.pieceSequenceLabel ? `编号区间 ${qr.pieceSequenceLabel}` : '',
  ].filter(Boolean).join(' · ')
  const craftLine = row.hasSpecialCraft
    ? `特殊工艺 ${joinCompactLines(row.specialCraftLines, 3)}；承接工厂 ${joinCompactLines(row.receiverFactoryLines, 3)}`
    : '特殊工艺 无'
  return [sourceLine, pieceLine, craftLine].filter(Boolean)
}

function formatDispatchLabel(value: string): string {
  return value.replaceAll('发料', '交出')
}

const printableTypeMeta: Record<'ALL' | PrintableUnitType, string> = {
  ALL: '全部',
  MARKER_PLAN: '唛架方案',
  CUT_ORDER: '裁片单',
}

const printObjectTypeMeta: Record<FeiPrintObjectType, string> = {
  ALL: '全部',
  SPREADING_ORDER: '部位菲票',
  BINDING_STRIP_ORDER: '捆条菲票',
}

const ticketCardStatusMeta: Record<TicketCard['status'], { label: string; className: string }> = {
  VALID: {
    label: '有效',
    className: 'border border-emerald-200 bg-emerald-100 text-emerald-700',
  },
  VOIDED: {
    label: '不可用',
    className: 'border border-slate-200 bg-slate-100 text-slate-600',
  },
}

const feiTicketNumberingStatusMeta: Record<FeiTicketNumberingStatus, { label: string; className: string }> = {
  已完成: {
    label: '已完成',
    className: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  未打编号: {
    label: '未打编号',
    className: 'border border-amber-200 bg-amber-50 text-amber-700',
  },
  免打编号: {
    label: '免打编号',
    className: 'border border-slate-200 bg-slate-50 text-slate-600',
  },
  缺少编号区间: {
    label: '缺少编号区间',
    className: 'border border-rose-200 bg-rose-50 text-rose-700',
  },
}

const initialFilters: FeiTicketPrintFilters = {
  keyword: '',
  printObjectType: 'ALL',
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

function isFeiTicketListPath(pathname: string): boolean {
  return pathname === getCanonicalCuttingPath('fei-tickets')
    || pathname === getCanonicalCuttingPath('binding-fei-tickets')
}

function resolveFeiTicketListMode(pathname = getCurrentPathname()): FeiTicketListMode {
  if (pathname === getCanonicalCuttingPath('binding-fei-tickets')) return 'BINDING'
  if (state.filters.printObjectType === 'BINDING_STRIP_ORDER') return 'BINDING'
  return 'PART'
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

function persistTicketRecords(records: FeiTicketLabelRecord[]): void {
  localStorage.setItem(CUTTING_FEI_TICKET_RECORDS_STORAGE_KEY, serializeFeiTicketRecordsStorage(records))
}

function persistPrintJobs(printJobs: FeiTicketPrintJob[]): void {
  localStorage.setItem(CUTTING_FEI_TICKET_PRINT_JOBS_STORAGE_KEY, serializeFeiTicketPrintJobsStorage(printJobs))
}

function mapPrintableStatusFromQuery(value: string | null): 'ALL' | PrintableUnitStatus {
  if (!value) return 'ALL'
  if (value === 'WAITING_PRINT' || value === 'PRINTED' || value === 'NEED_REPRINT') {
    return value
  }
  if (value === 'NOT_GENERATED') return 'WAITING_PRINT'
  if (value === 'REPRINTED' || value === 'PENDING_SUPPLEMENT' || value === 'PARTIAL_PRINTED') return 'NEED_REPRINT'
  return 'ALL'
}

function inferPrintableUnitType(params: URLSearchParams): 'ALL' | PrintableUnitType {
  const explicit = params.get('printableUnitType')
  if (explicit === 'MARKER_PLAN' || explicit === 'CUT_ORDER') return explicit
  if (params.get('markerPlanId') || params.get('markerPlanNo')) return 'MARKER_PLAN'
  if (params.get('cutOrderId') || params.get('cutOrderNo')) return 'CUT_ORDER'
  return 'ALL'
}

function mapPrintObjectTypeFromQuery(value: string | null): FeiPrintObjectType {
  if (value === 'SPREADING_ORDER' || value === 'BINDING_STRIP_ORDER') return value
  if (value === 'MARKER_PLAN' || value === 'CUT_ORDER') return 'SPREADING_ORDER'
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
    if (drillContext.markerPlanId && unit.batchId && unit.batchId !== drillContext.markerPlanId) return false
    if (drillContext.cutOrderId && !unit.sourceCutOrderIds.includes(drillContext.cutOrderId)) return false
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
  return orderedNos.join(' / ') || orderedIds.join(' / ') || '当前按裁片单参考补足'
}

function renderReturnToSummaryButton(): string {
  if (!hasSummaryReturnContext(getCurrentDrillContext())) return ''
  return `<button type="button" data-cutting-fei-action="return-summary" class="inline-flex min-h-10 items-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">返回裁剪结果核查</button>`
}

function buildFiltersFromQuery(params: URLSearchParams): FeiTicketPrintFilters {
  const drillContext = readCuttingDrillContextFromLocation(params)
  const hasSpreadingSessionAnchor = Boolean(drillContext?.spreadingSessionId || drillContext?.spreadingSessionNo)
  const keyword =
    params.get('keyword')
    || (hasSpreadingSessionAnchor
      ? ''
      : drillContext?.printableUnitNo
        || drillContext?.ticketNo
        || drillContext?.cutOrderNo
        || drillContext?.markerPlanNo
        || '')
  return {
    keyword,
    printObjectType: mapPrintObjectTypeFromQuery(params.get('printObjectType') || params.get('printableUnitType')),
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
    printableUnitStatus: mapPrintableStatusFromQuery(params.get('printableUnitStatus') || params.get('ticketStatus')),
    printedFrom: params.get('printedFrom') || '',
    printedTo: params.get('printedTo') || '',
  }
}

function hydrateFilterStateFromRoute(): void {
  const pathname = getCurrentPathname()
  const querySignature = `${pathname}?${getCurrentQueryString()}`
  if (!isFeiTicketListPath(pathname)) return
  if (state.querySignature === querySignature) return
  const params = getCurrentSearchParams()
  state.filters = buildFiltersFromQuery(params)
  state.querySignature = querySignature
}

function hydrateOperationDraftFromRoute(): void {
  const pathname = getCurrentPathname()
  const isOperationPage = new Set<OperationPageKey>([
    'fei-ticket-print',
    'fei-ticket-reprint',
  ]).has(getCanonicalCuttingMeta(pathname, 'fei-tickets').key as OperationPageKey)

  const signature = `${pathname}?${getCurrentQueryString()}`
  if (!isOperationPage) {
    state.operationSignature = ''
    return
  }
  if (state.operationSignature === signature) return

  const draft = createDefaultOperationDraft()
  if (pathname === getCanonicalCuttingPath('fei-ticket-reprint')) {
    draft.reason = ''
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
      PRINTED: contextualUnits.filter((unit) => unit.printableUnitStatus === 'PRINTED').length,
      NEED_REPRINT: contextualUnits.filter((unit) => unit.printableUnitStatus === 'NEED_REPRINT').length,
    },
  }

  return {
    cutOrderRows: projection.cutOrderRows,
    materialPrepRows: projection.materialPrepRows,
    markerPlanSources: projection.markerPlanSources,
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
  pageKey: 'fei-ticket-detail' | 'fei-ticket-printed',
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
  const explicit = getCurrentSearchParams().get('tab')
  if (explicit === 'printed') return explicit
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
    type === 'MARKER_PLAN'
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

function getTicketCardNumberingStatus(ticket: TicketCard): FeiTicketNumberingStatus {
  return getFeiTicketNumberingStatus({
    feiTicketId: ticket.ticketId,
    feiTicketNo: ticket.ticketNo,
    partName: ticket.partName,
    pieceSequenceRange: ticket.pieceSequenceRange,
  })
}

function renderFeiTicketNumberingStatusBadge(status: FeiTicketNumberingStatus): string {
  const meta = feiTicketNumberingStatusMeta[status]
  return renderBadge(meta.label, meta.className)
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
          <span class="font-medium text-slate-700">打印对象号</span>
          <input
            type="text"
            value="${escapeHtml(state.filters.keyword)}"
            data-cutting-fei-field="keyword"
            placeholder="输入铺布单号 / 捆条加工单号 / 菲票号"
            class="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        </label>
        <label class="space-y-1 text-sm text-slate-600">
          <span class="font-medium text-slate-700">款号 / SPU</span>
          <input
            type="text"
            value="${escapeHtml(state.filters.styleCode)}"
            data-cutting-fei-field="styleCode"
            placeholder="输入款号 / SPU"
            class="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        </label>
        <label class="space-y-1 text-sm text-slate-600">
          <span class="font-medium text-slate-700">面料</span>
          <input
            type="text"
            value="${escapeHtml(state.filters.fabricSku)}"
            data-cutting-fei-field="fabricSku"
            placeholder="输入面料 SKU / 技术包别名"
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
            ${(['WAITING_PRINT', 'PRINTED', 'NEED_REPRINT'] as const)
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

function renderPrintListStats(rows: Array<FeiTicketSpreadingWorkbenchRow | FeiTicketPrintObjectRow>, mode: FeiTicketListMode): string {
  const totalTicketCount = rows.reduce((sum, row) => sum + row.ticketCount, 0)
  const printedCount = rows.reduce((sum, row) => sum + row.printedCount, 0)
  const pendingCount = rows.reduce((sum, row) => sum + ('pendingCount' in row ? row.pendingCount : row.missingCount), 0)
  const printedObjectCount = rows.filter((row) => row.printedCount > 0).length
  const specialCraftCount = rows.filter((row) => 'hasSpecialCraft' in row && row.hasSpecialCraft).length

  return renderCompactKpiGroup(`
    ${renderCompactKpiCard(mode === 'BINDING' ? '捆条加工单' : '打印对象', rows.length, '当前筛选范围', 'text-slate-900')}
    ${renderCompactKpiCard('菲票', totalTicketCount, '当前筛选菲票数量', 'text-cyan-600')}
    ${renderCompactKpiCard('待打印', pendingCount, '尚未完成打印', 'text-amber-600')}
    ${renderCompactKpiCard('已打印', printedCount, '已完成打印菲票', 'text-emerald-600')}
    ${renderCompactKpiCard('已产生打印对象', printedObjectCount, '至少存在已打印菲票', 'text-blue-600')}
    ${mode === 'BINDING' ? '' : renderCompactKpiCard('含特殊工艺', specialCraftCount, '需关注外发/回仓', 'text-fuchsia-600')}
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
        ${renderStatusTab('PRINTED', '已打印', statusCounts.PRINTED, state.filters.printableUnitStatus === 'PRINTED')}
        ${renderStatusTab('NEED_REPRINT', '需补打', statusCounts.NEED_REPRINT, state.filters.printableUnitStatus === 'NEED_REPRINT')}
      </div>
    </section>
  `
}

const reprintReasonOptions = ['菲票丢失', '菲票破损', '打印不清晰', '数量拆分需要补打', '现场复核需要', '其他原因']

function normalizeTicketRouteId(value: string | undefined): string {
  return decodeURIComponent(value || '').trim()
}

function buildStandaloneFeiTicketHref(ticketId: string, suffix = ''): string {
  return `/fcs/craft/cutting/fei-tickets/${encodeURIComponent(ticketId)}${suffix}`
}

function buildStandaloneSpreadingHref(row: FeiTicketSpreadingWorkbenchRow, suffix = ''): string {
  return `/fcs/craft/cutting/fei-tickets/${encodeURIComponent(`spreading:${row.spreadingKey}`)}${suffix}`
}

function buildBindingRouteToken(order: Pick<BindingProcessOrder, 'bindingOrderId'>): string {
  return order.bindingOrderId.startsWith('binding:') ? order.bindingOrderId : `binding:${order.bindingOrderId}`
}

function buildStandaloneBindingHref(order: BindingProcessOrder, suffix = ''): string {
  return `/fcs/craft/cutting/fei-tickets/${encodeURIComponent(buildBindingRouteToken(order))}${suffix}`
}

function getTicketRecordVersionLabel(record: FeiTicketLabelRecord | null): string {
  const version = Number(record?.version || 0)
  if (Number.isFinite(version) && version > 0) return `V${version}`
  return 'V1'
}

function buildSpecialCraftLinesFromRecord(source: GeneratedFeiTicketSourceRecord | FeiTicketLabelRecord): {
  specialCraftLines: string[]
  receiverFactoryLines: string[]
} {
  const crafts = source.specialCrafts || []
  if (!crafts.length) return { specialCraftLines: ['无'], receiverFactoryLines: ['无'] }
  return {
    specialCraftLines: crafts.map((craft) => `${craft.craftType} / ${craft.craftCategory}`),
    receiverFactoryLines: crafts.map((craft) => `${craft.craftType}：${craft.receiverFactoryName || '承接工厂待补充'}`),
  }
}

function resolveTicketGeneratedRecord(row: FeiTicketWorkbenchRow | null): GeneratedFeiTicketSourceRecord | null {
  return row?.generated || null
}

function findGeneratedRecordByTicketId(ticketId: string): GeneratedFeiTicketSourceRecord | null {
  const normalized = normalizeTicketRouteId(ticketId)
  return listGeneratedFeiTickets().find((item) =>
    item.feiTicketId === normalized
    || item.feiTicketNo === normalized
    || item.sourceOutputLineId === normalized
  ) || null
}

function findTicketRecordByTicketId(records: FeiTicketLabelRecord[], ticketId: string): FeiTicketLabelRecord | null {
  const normalized = normalizeTicketRouteId(ticketId)
  return records.find((item) =>
    item.ticketRecordId === normalized
    || item.ticketNo === normalized
    || item.sourceOutputLineId === normalized
  ) || null
}

function buildSyntheticReprintRow(
  generated: GeneratedFeiTicketSourceRecord,
  record: FeiTicketLabelRecord | null,
): FeiTicketWorkbenchRow {
  const lines = buildSpecialCraftLinesFromRecord(generated)
  return {
    tab: 'NEED_REPRINT',
    ticketId: `${generated.feiTicketId}:reprint-review`,
    ticketNo: generated.feiTicketNo,
    versionLabel: getTicketRecordVersionLabel(record),
    printStatusLabel: '需补打',
    productionOrderNo: generated.productionOrderNo,
    cutOrderNo: generated.cutOrderNo,
    markerPlanNo: generated.sourceMarkerPlanNo,
    markerNumber: generated.sourceMarkerNo || generated.markerNumber,
    spreadingOrderNo: generated.sourceSpreadingSessionNo || generated.spreadingOrderNo,
    spuCode: generated.sourceTechPackSpuCode,
    color: generated.skuColor || generated.fabricColor,
    size: generated.skuSize,
    partName: generated.partName,
    pieceQty: generated.actualCutPieceQty,
    pieceSequenceLabel: generated.pieceSequenceLabel || '不可生成',
    hasSpecialCraft: generated.hasSpecialCraft,
    specialCraftLines: lines.specialCraftLines,
    receiverFactoryLines: lines.receiverFactoryLines,
    firstPrintedAt: record?.printedAt || '2026-03-24 09:10',
    latestReprintAt: '待补打',
    printCount: Math.max((record?.reprintCount || 0) + 1, 1),
    printedBy: record?.printedBy || '打票员-周莉',
    reason: '打印不清晰，待补打',
    record,
    generated,
  }
}

function buildFeiTicketWorkbenchRows(bundle: FeiTicketsDataBundle): FeiTicketWorkbenchRow[] {
  const generatedRecords = listGeneratedFeiTickets()
  const printedByOutput = new Map<string, FeiTicketLabelRecord[]>()
  bundle.ticketRecords.forEach((record) => {
    const key = record.sourceOutputLineId || record.ticketNo
    if (!key) return
    const bucket = printedByOutput.get(key) || []
    bucket.push(record)
    printedByOutput.set(key, bucket)
  })

  const rows: FeiTicketWorkbenchRow[] = []
  generatedRecords.forEach((generated, index) => {
    const relatedRecords = [
      ...(printedByOutput.get(generated.sourceOutputLineId) || []),
      ...bundle.ticketRecords.filter((record) => record.ticketNo === generated.feiTicketNo),
    ].filter((record, recordIndex, source) => source.findIndex((item) => item.ticketRecordId === record.ticketRecordId) === recordIndex)
    const sortedRecords = relatedRecords.sort((left, right) => {
      const leftVersion = left.version ?? left.reprintCount + 1
      const rightVersion = right.version ?? right.reprintCount + 1
      if (leftVersion !== rightVersion) return rightVersion - leftVersion
      return (right.printedAt || '').localeCompare(left.printedAt || '', 'zh-CN')
    })
    const latestRecord = sortedRecords[0] || null
    const validRecord = sortedRecords.find((record) => record.status !== 'VOIDED') || null
    const sourceForLines = validRecord || generated
    const lines = buildSpecialCraftLinesFromRecord(sourceForLines)
    const baseRow: FeiTicketWorkbenchRow = {
      tab: validRecord ? 'PRINTED' : 'WAIT_FIRST',
      ticketId: validRecord?.ticketRecordId || generated.feiTicketId,
      ticketNo: validRecord?.ticketNo || generated.feiTicketNo,
      versionLabel: getTicketRecordVersionLabel(validRecord),
      printStatusLabel: validRecord ? (validRecord.reprintCount > 0 || (validRecord.version || 1) > 1 ? '已补打' : '已打印') : '待打印',
      productionOrderNo: generated.productionOrderNo,
      cutOrderNo: generated.cutOrderNo,
      markerPlanNo: generated.sourceMarkerPlanNo,
      markerNumber: generated.sourceMarkerNo || generated.markerNumber,
      spreadingOrderNo: generated.sourceSpreadingSessionNo || generated.spreadingOrderNo,
      spuCode: generated.sourceTechPackSpuCode,
      color: generated.skuColor || generated.fabricColor,
      size: generated.skuSize,
      partName: generated.partName,
      pieceQty: generated.actualCutPieceQty,
      pieceSequenceLabel: generated.pieceSequenceLabel || '不可生成',
      hasSpecialCraft: generated.hasSpecialCraft,
      specialCraftLines: lines.specialCraftLines,
      receiverFactoryLines: lines.receiverFactoryLines,
      firstPrintedAt: validRecord?.printedAt || '',
      latestReprintAt: validRecord && ((validRecord.reprintCount > 0) || (validRecord.version || 1) > 1) ? validRecord.printedAt : '',
      printCount: validRecord ? Math.max((validRecord.reprintCount || 0) + 1, 1) : 0,
      printedBy: validRecord?.printedBy || '',
      reason: '',
      record: validRecord,
      generated,
    }

    if (validRecord) rows.push(baseRow)
    else rows.push(baseRow)

    // 原型需要稳定覆盖“需补打”页签，即使本地打印流水被清空，也保留典型演示行。
    if (index === 2 && !rows.some((row) => row.tab === 'NEED_REPRINT')) rows.push(buildSyntheticReprintRow(generated, latestRecord))
  })

  return rows
}

function resolveSpreadingGroupKey(row: FeiTicketWorkbenchRow): string {
  return row.generated.sourceSpreadingSessionId
    || row.generated.spreadingOrderId
    || row.spreadingOrderNo
    || row.ticketId
}

function buildFeiTicketSpreadingWorkbenchRows(rows: FeiTicketWorkbenchRow[]): FeiTicketSpreadingWorkbenchRow[] {
  const groups = new Map<string, FeiTicketWorkbenchRow[]>()

  rows.forEach((row) => {
    const key = `${row.tab}:${resolveSpreadingGroupKey(row)}`
    const bucket = groups.get(key) || []
    bucket.push(row)
    groups.set(key, bucket)
  })

  return Array.from(groups.values())
    .map((detailRows) => {
      const sortedRows = [...detailRows].sort((left, right) => {
        const sizeCompare = left.size.localeCompare(right.size, 'zh-CN')
        if (sizeCompare !== 0) return sizeCompare
        return left.partName.localeCompare(right.partName, 'zh-CN')
      })
      const primaryRow = sortedRows[0]
      const tab = primaryRow.tab
      const printCount = sortedRows.reduce((sum, row) => sum + row.printCount, 0)
      const latestReprintAt = sortedRows
        .map((row) => row.latestReprintAt)
        .filter(Boolean)
        .sort((left, right) => right.localeCompare(left, 'zh-CN'))[0] || ''
      const firstPrintedAt = sortedRows
        .map((row) => row.firstPrintedAt)
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right, 'zh-CN'))[0] || ''

      return {
        tab,
        spreadingKey: resolveSpreadingGroupKey(primaryRow),
        spreadingOrderNo: primaryRow.spreadingOrderNo || primaryRow.generated.sourceSpreadingSessionNo || '待补铺布单',
        markerPlanNo: primaryRow.markerPlanNo || '待补唛架方案',
        markerNumber: primaryRow.markerNumber || primaryRow.generated.markerNumber || '待补唛架编号',
        productionOrderNos: uniqueStrings(sortedRows.map((row) => row.productionOrderNo)),
        cutOrderNos: uniqueStrings(sortedRows.map((row) => row.cutOrderNo)),
        spuCodes: uniqueStrings(sortedRows.map((row) => row.spuCode)),
        colors: uniqueStrings(sortedRows.map((row) => row.color)),
        sizes: uniqueStrings(sortedRows.map((row) => row.size)),
        partNames: uniqueStrings(sortedRows.map((row) => row.partName)),
        ticketCount: sortedRows.length,
        totalPieceQty: sortedRows.reduce((sum, row) => sum + row.pieceQty, 0),
        pendingCount: sortedRows.filter((row) => row.tab === 'WAIT_FIRST').length,
        printedCount: sortedRows.filter((row) => row.tab === 'PRINTED' || row.tab === 'NEED_REPRINT').length,
        pieceSequenceLabels: uniqueStrings(sortedRows.map((row) => row.pieceSequenceLabel)),
        hasSpecialCraft: sortedRows.some((row) => row.hasSpecialCraft),
        specialCraftLines: uniqueStrings(sortedRows.flatMap((row) => row.specialCraftLines)),
        receiverFactoryLines: uniqueStrings(sortedRows.flatMap((row) => row.receiverFactoryLines)),
        firstPrintedAt,
        latestReprintAt,
        printCount,
        printedBy: uniqueStrings(sortedRows.map((row) => row.printedBy)).join('、'),
        printStatusLabel:
          tab === 'WAIT_FIRST'
            ? `待打印 ${sortedRows.length} 条`
            : tab === 'PRINTED'
              ? `已打印 ${sortedRows.length} 条`
              : `需补打 ${sortedRows.length} 条`,
        detailRows: sortedRows,
        primaryRow,
      } satisfies FeiTicketSpreadingWorkbenchRow
    })
    .sort((left, right) => left.spreadingOrderNo.localeCompare(right.spreadingOrderNo, 'zh-CN'))
}

function findFeiWorkbenchRow(bundle: FeiTicketsDataBundle, ticketId: string): FeiTicketWorkbenchRow | null {
  const normalized = normalizeTicketRouteId(ticketId)
  const rows = buildFeiTicketWorkbenchRows(bundle)
  return rows.find((row) =>
    row.ticketId === normalized
    || row.ticketNo === normalized
    || row.generated.feiTicketId === normalized
    || row.generated.feiTicketNo === normalized
    || row.generated.sourceOutputLineId === normalized
    || row.ticketId.replace(/:(reprint-review|void-demo)$/, '') === normalized
  ) || null
}

function findFeiSpreadingWorkbenchRow(bundle: FeiTicketsDataBundle, ticketId: string): FeiTicketSpreadingWorkbenchRow | null {
  const normalized = normalizeTicketRouteId(ticketId)
  const detailRows = buildFeiTicketWorkbenchRows(bundle)
  const rows = buildFeiTicketSpreadingWorkbenchRows(detailRows)
  if (normalized.startsWith('spreading:')) {
    const routeParts = normalized.split(':')
    const possibleTab = routeParts[1] as FeiWorkbenchTabKey | undefined
    const hasLegacyTab = possibleTab === 'WAIT_FIRST' || possibleTab === 'PRINTED' || possibleTab === 'NEED_REPRINT'
    const spreadingKey = hasLegacyTab ? routeParts.slice(2).join(':') : routeParts.slice(1).join(':')
    const row = rows.find((item) =>
      item.spreadingKey === spreadingKey
      && (!hasLegacyTab || item.tab === possibleTab)
    ) || rows.find((item) => item.spreadingKey === spreadingKey)
    return row ? withAllSpreadingDetailRows(row, detailRows) : null
  }
  const row = rows.find((item) =>
    item.spreadingKey === normalized
    || item.spreadingOrderNo === normalized
    || item.primaryRow.ticketId === normalized
    || item.primaryRow.ticketNo === normalized
  ) || null
  return row ? withAllSpreadingDetailRows(row, detailRows) : null
}

function sortFeiTicketDetailRows(rows: FeiTicketWorkbenchRow[]): FeiTicketWorkbenchRow[] {
  return [...rows].sort((left, right) => {
    const sizeCompare = left.size.localeCompare(right.size, 'zh-CN')
    if (sizeCompare !== 0) return sizeCompare
    const partCompare = left.partName.localeCompare(right.partName, 'zh-CN')
    if (partCompare !== 0) return partCompare
    return left.ticketNo.localeCompare(right.ticketNo, 'zh-CN')
  })
}

function dedupeSpreadingDetailRows(rows: FeiTicketWorkbenchRow[]): FeiTicketWorkbenchRow[] {
  const priority: Record<FeiWorkbenchTabKey, number> = {
    PRINTED: 4,
    WAIT_FIRST: 3,
    NEED_REPRINT: 2,
  }
  const grouped = new Map<string, FeiTicketWorkbenchRow>()
  rows.forEach((row) => {
    const key = row.generated.sourceOutputLineId || row.generated.feiTicketId || row.ticketNo
    const existing = grouped.get(key)
    if (!existing || priority[row.tab] > priority[existing.tab]) grouped.set(key, row)
  })
  return sortFeiTicketDetailRows(Array.from(grouped.values()))
}

function withAllSpreadingDetailRows(
  row: FeiTicketSpreadingWorkbenchRow,
  allRows: FeiTicketWorkbenchRow[],
): FeiTicketSpreadingWorkbenchRow {
  const allDetails = dedupeSpreadingDetailRows(
    allRows.filter((detail) => resolveSpreadingGroupKey(detail) === row.spreadingKey),
  )
  if (!allDetails.length) return row
  return {
    ...row,
    productionOrderNos: uniqueStrings(allDetails.map((detail) => detail.productionOrderNo)),
    cutOrderNos: uniqueStrings(allDetails.map((detail) => detail.cutOrderNo)),
    spuCodes: uniqueStrings(allDetails.map((detail) => detail.spuCode)),
    colors: uniqueStrings(allDetails.map((detail) => detail.color)),
    sizes: uniqueStrings(allDetails.map((detail) => detail.size)),
    partNames: uniqueStrings(allDetails.map((detail) => detail.partName)),
    ticketCount: allDetails.length,
    totalPieceQty: allDetails.reduce((sum, detail) => sum + detail.pieceQty, 0),
    pendingCount: allDetails.filter((detail) => detail.tab === 'WAIT_FIRST').length,
    printedCount: allDetails.filter((detail) => detail.tab === 'PRINTED' || detail.tab === 'NEED_REPRINT').length,
    pieceSequenceLabels: uniqueStrings(allDetails.map((detail) => detail.pieceSequenceLabel)),
    hasSpecialCraft: allDetails.some((detail) => detail.hasSpecialCraft),
    specialCraftLines: uniqueStrings(allDetails.flatMap((detail) => detail.specialCraftLines)),
    receiverFactoryLines: uniqueStrings(allDetails.flatMap((detail) => detail.receiverFactoryLines)),
    detailRows: allDetails,
  }
}

function buildPrintObjectKeywordIndex(values: Array<string | undefined>): string[] {
  return uniqueStrings(values).map((value) => value.toLowerCase())
}

function deriveSpreadingWorkbenchTab(details: FeiTicketWorkbenchRow[]): FeiWorkbenchTabKey {
  if (details.some((detail) => detail.tab === 'NEED_REPRINT')) return 'NEED_REPRINT'
  if (details.some((detail) => detail.tab === 'WAIT_FIRST')) return 'WAIT_FIRST'
  return 'PRINTED'
}

function mapWorkbenchTabToPrintStatus(tab: FeiWorkbenchTabKey): FeiPrintObjectStatus {
  return tab === 'WAIT_FIRST' ? 'WAITING_PRINT' : tab
}

function buildSpreadingPrintObjectRows(detailRows: FeiTicketWorkbenchRow[]): FeiTicketSpreadingWorkbenchRow[] {
  const groups = new Map<string, FeiTicketWorkbenchRow[]>()
  detailRows.forEach((row) => {
    const key = resolveSpreadingGroupKey(row)
    const bucket = groups.get(key) || []
    bucket.push(row)
    groups.set(key, bucket)
  })

  return Array.from(groups.values())
    .map((groupRows) => {
      const sortedRows = dedupeSpreadingDetailRows(groupRows)
      const primaryRow = sortedRows[0]
      const tab = deriveSpreadingWorkbenchTab(sortedRows)
      const pendingCount = sortedRows.filter((row) => row.tab === 'WAIT_FIRST').length
      const reprintCount = sortedRows.filter((row) => row.tab === 'NEED_REPRINT').length
      const printedCount = sortedRows.filter((row) => row.tab === 'PRINTED' || row.tab === 'NEED_REPRINT').length
      const latestReprintAt = sortedRows
        .map((row) => row.latestReprintAt)
        .filter(Boolean)
        .sort((left, right) => right.localeCompare(left, 'zh-CN'))[0] || ''
      const firstPrintedAt = sortedRows
        .map((row) => row.firstPrintedAt)
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right, 'zh-CN'))[0] || ''
      const statusCount = tab === 'PRINTED' ? sortedRows.length : tab === 'NEED_REPRINT' ? reprintCount || pendingCount : pendingCount

      return {
        tab,
        spreadingKey: resolveSpreadingGroupKey(primaryRow),
        spreadingOrderNo: primaryRow.spreadingOrderNo || primaryRow.generated.sourceSpreadingSessionNo || '待补铺布单',
        markerPlanNo: primaryRow.markerPlanNo || '待补唛架方案',
        markerNumber: primaryRow.markerNumber || primaryRow.generated.markerNumber || '待补唛架编号',
        productionOrderNos: uniqueStrings(sortedRows.map((row) => row.productionOrderNo)),
        cutOrderNos: uniqueStrings(sortedRows.map((row) => row.cutOrderNo)),
        spuCodes: uniqueStrings(sortedRows.map((row) => row.spuCode)),
        colors: uniqueStrings(sortedRows.map((row) => row.color)),
        sizes: uniqueStrings(sortedRows.map((row) => row.size)),
        partNames: uniqueStrings(sortedRows.map((row) => row.partName)),
        ticketCount: sortedRows.length,
        totalPieceQty: sortedRows.reduce((sum, row) => sum + row.pieceQty, 0),
        pendingCount,
        printedCount,
        pieceSequenceLabels: uniqueStrings(sortedRows.map((row) => row.pieceSequenceLabel)),
        hasSpecialCraft: sortedRows.some((row) => row.hasSpecialCraft),
        specialCraftLines: uniqueStrings(sortedRows.flatMap((row) => row.specialCraftLines)),
        receiverFactoryLines: uniqueStrings(sortedRows.flatMap((row) => row.receiverFactoryLines)),
        firstPrintedAt,
        latestReprintAt,
        printCount: sortedRows.reduce((sum, row) => sum + row.printCount, 0),
        printedBy: uniqueStrings(sortedRows.map((row) => row.printedBy)).join('、'),
        printStatusLabel:
          tab === 'WAIT_FIRST'
            ? `待打印 ${formatCount(statusCount)} 条`
            : tab === 'PRINTED'
              ? `已打印 ${formatCount(statusCount)} 条`
              : `需补打 ${formatCount(statusCount)} 条`,
        detailRows: sortedRows,
        primaryRow,
      } satisfies FeiTicketSpreadingWorkbenchRow
    })
    .sort((left, right) => left.spreadingOrderNo.localeCompare(right.spreadingOrderNo, 'zh-CN'))
}

function getPrintableBindingDetails(order: BindingProcessOrder): BindingStripWorkOrderDetail[] {
  if (order.status === '已取消') return []
  return order.bindingDetails.filter((detail) => detail.printStatus !== '未生成')
}

function deriveBindingPrintObjectStatus(details: BindingStripWorkOrderDetail[]): FeiPrintObjectStatus {
  const printedCount = details.filter((detail) => detail.printStatus === '已打印').length
  if (printedCount === details.length && details.length > 0) return 'PRINTED'
  if (printedCount > 0) return 'NEED_REPRINT'
  return 'WAITING_PRINT'
}

function buildBindingPrintPreviewHref(details: BindingStripWorkOrderDetail[]): string {
  const sourceIds = details.map((detail) => detail.feiTicketId || detail.feiTicketNo).filter(Boolean)
  return `/fcs/print/preview?documentType=FEI_TICKET_LABEL&sourceType=FEI_TICKET_RECORD&sourceId=${encodeURIComponent(sourceIds.join(','))}`
}

function buildBindingSinglePrintPreviewHref(detail: BindingStripWorkOrderDetail): string {
  return buildBindingPrintPreviewHref([detail])
}

function buildSpreadingPrintObjectRow(row: FeiTicketSpreadingWorkbenchRow): FeiTicketPrintObjectRow {
  const allPrintHref = buildSpreadingPrintPreviewHref(row.detailRows, 'all')
  const detailHref = buildStandaloneSpreadingHref(row)
  const materialSku = row.primaryRow.generated.materialIdentity?.materialSku || row.primaryRow.generated.materialSku || '待补面料'
  const materialAlias = row.primaryRow.generated.materialIdentity?.materialAlias || ''
  const materialColor = row.primaryRow.generated.materialIdentity?.materialColor || row.colors.join(' / ')
  return {
    objectId: `spreading:${row.spreadingKey}`,
    objectNo: row.spreadingOrderNo,
    objectType: 'SPREADING_ORDER',
    objectTypeLabel: printObjectTypeMeta.SPREADING_ORDER,
    detailHref,
    allPrintHref,
    sourceLines: [
      `生产单：${joinCompactLines(row.productionOrderNos, 2)}`,
      `裁片单：${joinCompactLines(row.cutOrderNos, 2)}`,
      `唛架方案：${row.markerPlanNo} / 唛架编号 ${row.markerNumber}`,
    ],
    material: {
      materialSku,
      materialLabel: row.primaryRow.generated.materialIdentity?.materialName || materialSku,
      materialAlias,
      materialImageUrl: row.primaryRow.generated.materialIdentity?.materialImageUrl,
      materialColor,
    },
    styleCode: row.spuCodes.join(' / '),
    materialSearchText: [materialSku, materialAlias, materialColor, ...row.colors].filter(Boolean).join(' '),
    ticketCount: row.ticketCount,
    totalQuantityLabel: `${formatCount(row.totalPieceQty)} 片`,
    printedCount: row.printedCount,
    missingCount: Math.max(row.ticketCount - row.printedCount, 0),
    printStatus: mapWorkbenchTabToPrintStatus(row.tab),
    printStatusLabel: row.printStatusLabel,
    firstPrintedAt: row.firstPrintedAt,
    latestReprintAt: row.latestReprintAt,
    printCount: row.printCount,
    printedBy: row.printedBy,
    detailRows: row.detailRows.map((detail) => ({
      ticketId: detail.ticketId,
      ticketNo: detail.ticketNo,
      primaryLabel: `${detail.partName || '待补部位'} / ${detail.size || '待补尺码'}`,
      secondaryLabel: `编号 ${detail.pieceSequenceLabel || '不可生成'}`,
      quantityLabel: `${formatCount(detail.pieceQty)} 片`,
      printStatusLabel: detail.printStatusLabel,
      printHref: buildDetailPrintPreviewHref(detail),
    })),
    keywordIndex: buildPrintObjectKeywordIndex([
      row.spreadingOrderNo,
      row.markerPlanNo,
      row.markerNumber,
      ...row.productionOrderNos,
      ...row.cutOrderNos,
      ...row.spuCodes,
      ...row.colors,
      ...row.detailRows.map((detail) => detail.ticketNo),
    ]),
    sourceOrder: row,
  }
}

function buildBindingPrintObjectRow(order: BindingProcessOrder): FeiTicketPrintObjectRow | null {
  const details = getPrintableBindingDetails(order)
  if (!details.length) return null
  const printStatus = deriveBindingPrintObjectStatus(details)
  const printedCount = details.filter((detail) => detail.printStatus === '已打印').length
  const missingCount = Math.max(details.length - printedCount, 0)
  const statusCount = printStatus === 'PRINTED' ? details.length : printStatus === 'NEED_REPRINT' ? missingCount : details.length
  const firstPrintedAt = printedCount ? order.completedAt || order.startedAt : ''
  return {
    objectId: buildBindingRouteToken(order),
    objectNo: order.bindingOrderNo,
    objectType: 'BINDING_STRIP_ORDER',
    objectTypeLabel: printObjectTypeMeta.BINDING_STRIP_ORDER,
    detailHref: buildStandaloneBindingHref(order),
    allPrintHref: buildBindingPrintPreviewHref(details),
    sourceLines: [
      `生产单：${order.sourceProductionOrderNo}`,
      `裁片单：${order.sourceCutOrderNo}`,
      `纸样：${order.patternIdentity.patternFileName || order.sourcePatternPackageName}`,
    ],
    material: {
      materialSku: order.materialIdentity.materialSku,
      materialLabel: order.materialIdentity.materialName,
      materialAlias: order.materialIdentity.materialAlias,
      materialImageUrl: order.materialIdentity.materialImageUrl,
      materialColor: order.materialIdentity.materialColor,
    },
    styleCode: order.patternIdentity.patternFileName || order.sourcePatternPackageName,
    materialSearchText: [
      order.materialIdentity.materialSku,
      order.materialIdentity.materialName,
      order.materialIdentity.materialAlias,
      order.materialIdentity.materialColor,
      ...details.map((detail) => `${detail.bindingWidth}cm`),
      ...details.map((detail) => detail.cuttingMethod),
    ].filter(Boolean).join(' '),
    ticketCount: details.length,
    totalQuantityLabel: `捆条需要 ${formatBindingLength(order.plannedTotalLength)} / 需要布料 ${formatBindingLength(order.requiredMaterialLength)}`,
    printedCount,
    missingCount,
    printStatus,
    printStatusLabel:
      printStatus === 'PRINTED'
        ? `已打印 ${formatCount(statusCount)} 张`
        : printStatus === 'NEED_REPRINT'
          ? `需补打 ${formatCount(statusCount)} 张`
          : `待打印 ${formatCount(statusCount)} 张`,
    firstPrintedAt,
    latestReprintAt: '',
    printCount: printedCount,
    printedBy: printedCount ? order.operatorName : '',
    detailRows: details.map((detail) => ({
      ticketId: detail.feiTicketId,
      ticketNo: detail.feiTicketNo,
      primaryLabel: `${detail.bindingStripName} / ${detail.bindingWidth} cm / 切割方式：${detail.cuttingMethod}`,
      secondaryLabel: `捆条需要 ${formatBindingLength(detail.plannedBindingLength)} / 每卷长度：${detail.rollLength ? formatBindingLength(detail.rollLength) : '待记录'} / 实切卷数：${detail.actualRollCount || 0} 卷`,
      quantityLabel: `宽度：${detail.bindingWidth} cm`,
      printStatusLabel: detail.printStatus === '已打印' ? '已打印' : '待打印',
      printHref: buildBindingSinglePrintPreviewHref(detail),
    })),
    keywordIndex: buildPrintObjectKeywordIndex([
      order.bindingOrderNo,
      order.sourceProductionOrderNo,
      order.sourceCutOrderNo,
      order.sourceMarkerPlanNo,
      order.sourcePatternPackageName,
      order.materialIdentity.materialSku,
      order.materialIdentity.materialName,
      order.materialIdentity.materialAlias,
      order.materialIdentity.materialColor,
      ...details.flatMap((detail) => [detail.feiTicketNo, detail.bindingStripName, `${detail.bindingWidth}cm`, detail.cuttingMethod]),
    ]),
    sourceOrder: order,
  }
}

function buildBindingFeiTicketPrintRows(): FeiTicketPrintObjectRow[] {
  return buildBindingProcessOrders()
    .map(buildBindingPrintObjectRow)
    .filter((row): row is FeiTicketPrintObjectRow => Boolean(row))
}

function filterFeiTicketPrintObjectRows(
  rows: FeiTicketPrintObjectRow[],
  options: { honorTypeFilter?: boolean } = {},
): FeiTicketPrintObjectRow[] {
  const keyword = state.filters.keyword.trim().toLowerCase()
  const styleCode = state.filters.styleCode.trim().toLowerCase()
  const fabricSku = state.filters.fabricSku.trim().toLowerCase()
  const productionOrderNo = state.filters.productionOrderNo.trim().toLowerCase()
  const honorTypeFilter = options.honorTypeFilter ?? true
  return rows
    .filter((row) => !honorTypeFilter || state.filters.printObjectType === 'ALL' || row.objectType === state.filters.printObjectType)
    .filter((row) => state.filters.printableUnitStatus === 'ALL' || row.printStatus === state.filters.printableUnitStatus)
    .filter((row) => !styleCode || row.styleCode.toLowerCase().includes(styleCode))
    .filter((row) => !fabricSku || row.materialSearchText.toLowerCase().includes(fabricSku))
    .filter((row) => !productionOrderNo || row.sourceLines.some((line) => line.toLowerCase().includes(productionOrderNo)))
    .filter((row) => !state.filters.printedFrom || (row.firstPrintedAt && row.firstPrintedAt.slice(0, 10) >= state.filters.printedFrom))
    .filter((row) => !state.filters.printedTo || (row.firstPrintedAt && row.firstPrintedAt.slice(0, 10) <= state.filters.printedTo))
    .filter((row) => !keyword || row.keywordIndex.some((value) => value.includes(keyword)))
    .sort((left, right) => {
      const statusPriority: Record<FeiPrintObjectStatus, number> = { WAITING_PRINT: 0, NEED_REPRINT: 1, PRINTED: 2 }
      const statusDiff = statusPriority[left.printStatus] - statusPriority[right.printStatus]
      if (statusDiff !== 0) return statusDiff
      if (left.objectType !== right.objectType) return left.objectType.localeCompare(right.objectType, 'zh-CN')
      return left.objectNo.localeCompare(right.objectNo, 'zh-CN')
    })
}

function filterSpreadingFeiTicketPrintRows(rows: FeiTicketSpreadingWorkbenchRow[]): FeiTicketSpreadingWorkbenchRow[] {
  return filterFeiTicketPrintObjectRows(rows.map(buildSpreadingPrintObjectRow), { honorTypeFilter: false })
    .map((row) => row.sourceOrder)
    .filter((row): row is FeiTicketSpreadingWorkbenchRow => Boolean(row))
}

function filterBindingFeiTicketPrintRows(rows: FeiTicketPrintObjectRow[]): FeiTicketPrintObjectRow[] {
  return filterFeiTicketPrintObjectRows(rows, { honorTypeFilter: false })
}

function renderGenerationEligibilityArea(): string {
  const rows = listFeiTicketGenerationEligibilityRows()
  const visibleRows = rows.slice(0, 9)
  return `
    <section class="rounded-lg border bg-white p-3 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-sm font-semibold text-slate-900">实际裁剪产出校验</h2>
        <span class="text-xs text-slate-500">正式菲票只能从实际裁剪产出生成</span>
      </div>
      <div class="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        ${visibleRows
          .map((row) => {
            const ok = row.eligibility.canGenerate
            const statusClass = ok
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-amber-200 bg-amber-50 text-amber-700'
            const statusText = ok ? '可生成菲票' : row.eligibility.reasonTexts.join(' / ') || '不可生成'
            return `
              <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div class="flex items-start justify-between gap-2">
                  <div>
                    <p class="text-sm font-semibold text-slate-900">${escapeHtml(row.scenarioLabel)}</p>
                    <p class="mt-1 text-xs text-slate-500">${escapeHtml(row.output?.spreadingOrderNo || row.output?.outputNo || '待补实际产出')}</p>
                  </div>
                  <span class="inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass}">${escapeHtml(statusText)}</span>
                </div>
                <p class="mt-2 text-xs text-slate-500">${escapeHtml(row.output ? `${row.output.cutOrderNo || '缺少裁片单'} / ${row.output.partName || '待补部位'} / ${formatCount(row.output.actualPieceQty)} 片` : '缺少实际裁剪产出')}</p>
              </div>
            `
          })
          .join('')}
      </div>
    </section>
  `
}

function renderSpecialCraftSummary(
  crafts: Array<{
    craftCategory: string
    craftType: string
    receiverFactoryName: string
    affectedPartName: string
    affectedSize: string
    affectedPieceQty: number
    requirementSource: string
  }> | undefined,
): string {
  if (!crafts?.length) return '<span class="text-slate-500">无</span>'
  return `
    <div class="space-y-1">
      ${crafts
        .map(
          (craft) => `
            <div class="rounded-md border border-slate-200 bg-white px-2 py-1">
              <p class="text-xs font-semibold text-slate-900">${escapeHtml(`${craft.craftType} / ${craft.craftCategory}`)}</p>
              <p class="text-xs text-slate-500">${escapeHtml(craft.receiverFactoryName || '承接工厂待补充')}</p>
              <p class="text-xs text-slate-500">${escapeHtml(`${craft.affectedPartName || '待补部位'} / ${craft.affectedSize || '待补尺码'} / ${formatCount(craft.affectedPieceQty)} 片 / ${craft.requirementSource}`)}</p>
            </div>
          `,
        )
        .join('')}
    </div>
  `
}

function renderSpecialCraftFieldArea(): string {
  const tickets = listGeneratedFeiTickets()
  const sampleTickets = tickets.slice(0, 8)
  return `
    <section class="rounded-lg border bg-white p-3 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-sm font-semibold text-slate-900">菲票特殊工艺字段</h2>
        <span class="text-xs text-slate-500">字段来自实际裁剪产出、裁片单明细和技术包配置；承接工厂只作后续分拣指引</span>
      </div>
      <div class="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        ${sampleTickets
          .map(
            (ticket) => `
              <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div class="flex items-start justify-between gap-2">
                  <div>
                    <p class="text-sm font-semibold text-slate-900">${escapeHtml(ticket.feiTicketNo)}</p>
                    <p class="mt-1 text-xs text-slate-500">${escapeHtml(`${ticket.partName} / ${ticket.skuSize}`)}</p>
                  </div>
                  <span class="inline-flex rounded-full border ${ticket.hasSpecialCraft ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-white text-slate-600'} px-2 py-0.5 text-xs font-medium">${ticket.hasSpecialCraft ? '有特殊工艺' : '无特殊工艺'}</span>
                </div>
                <div class="mt-2 text-xs">
                  <p class="font-medium text-slate-700">特殊工艺类型 / 承接工厂</p>
                  <div class="mt-1">${renderSpecialCraftSummary(ticket.specialCrafts)}</div>
                </div>
              </div>
            `,
          )
          .join('')}
      </div>
    </section>
  `
}

function renderPieceSequenceSummary(source: {
  pieceSequenceLabel: string
  pieceSequenceCannotGenerateReason?: string
  pieceSequenceRange?: {
    markerMode: string
    sizeGroupId: string
    partInstanceNo: string
    actualLayerCount: number
    actualLayerSource: string
    actualPieceQty: number
  } | null
}): string {
  if (!source.pieceSequenceRange) {
    return `<span class="text-amber-700">${escapeHtml(source.pieceSequenceCannotGenerateReason || '缺少实际裁剪产出')}</span>`
  }
  const instanceText = source.pieceSequenceRange.partInstanceNo
    ? `部位实例 ${source.pieceSequenceRange.partInstanceNo}`
    : '单部位实例'
  return `
    <div class="space-y-0.5">
      <p class="font-semibold text-slate-900">${escapeHtml(source.pieceSequenceLabel)}</p>
      <p class="text-xs text-slate-500">${escapeHtml(`${source.pieceSequenceRange.sizeGroupId} / ${instanceText}`)}</p>
      <p class="text-xs text-slate-500">${escapeHtml(`依据：${source.pieceSequenceRange.actualLayerSource} ${formatCount(source.pieceSequenceRange.actualLayerCount)} 层序 / 实际 ${formatCount(source.pieceSequenceRange.actualPieceQty)} 片`)}</p>
    </div>
  `
}

function renderPieceSequenceRangeArea(): string {
  const rows = listPieceSequenceRangeScenarioRows()
  return `
    <section class="rounded-lg border bg-white p-3 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-sm font-semibold text-slate-900">部位裁片编号范围</h2>
        <span class="text-xs text-slate-500">按床次层序生成，默认从 1 开始，不按需求数量或计划数量放大</span>
      </div>
      <div class="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        ${rows
          .map(
            (row) => `
              <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div class="flex items-start justify-between gap-2">
                  <div>
                    <p class="text-sm font-semibold text-slate-900">${escapeHtml(row.scenarioLabel)}</p>
                    <p class="mt-1 text-xs text-slate-500">${escapeHtml(`${row.feiTicketNo} / ${row.markerModeLabel}`)}</p>
                  </div>
                  <span class="inline-flex rounded-full border ${row.pieceSequenceRange ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'} px-2 py-0.5 text-xs font-medium">${escapeHtml(row.pieceSequenceLabel)}</span>
                </div>
                <div class="mt-2 text-xs">
                  <p class="font-medium text-slate-700">${escapeHtml(`${row.partName} / ${row.size}`)}</p>
                  <div class="mt-1">${renderPieceSequenceSummary(row)}</div>
                </div>
              </div>
            `,
          )
          .join('')}
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
  const printHref = buildFeiTicketLabelPrintLink(unit.printableUnitId, 'first')
  const reprintHref = buildFeiTicketLabelPrintLink(unit.printableUnitId, 'reprint')

  if (unit.printableUnitStatus === 'WAITING_PRINT') {
    return {
      primary: { label: '打印菲票', href: printHref },
      secondary: { label: '查看详情', href: detailHref },
      more: [],
    }
  }

  if (unit.printableUnitStatus === 'NEED_REPRINT') {
    return {
      primary: { label: '补打', href: reprintHref },
      secondary: { label: '查看详情', href: detailHref },
      more: [
        { label: '查看已打印菲票', href: printedHref },
      ],
    }
  }

  return {
    primary: null,
    secondary: { label: '查看详情', href: detailHref },
    more: [
      { label: '查看已打印菲票', href: printedHref },
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

function renderLifecycleStatusBadge(row: FeiTicketWorkbenchRow): string {
  const className =
    row.tab === 'WAIT_FIRST'
      ? 'border border-slate-200 bg-slate-100 text-slate-700'
      : row.tab === 'PRINTED'
        ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
        : row.tab === 'NEED_REPRINT'
          ? 'border border-amber-200 bg-amber-50 text-amber-700'
          : 'border border-slate-200 bg-slate-100 text-slate-700'
  return renderBadge(row.printStatusLabel, className)
}

function joinCompactLines(lines: string[], max = 2): string {
  const visible = lines.filter(Boolean)
  if (!visible.length) return '无'
  if (visible.length <= max) return visible.join('；')
  return `${visible.slice(0, max).join('；')}；另 ${visible.length - max} 项`
}

function renderWorkbenchRowActions(row: FeiTicketWorkbenchRow): string {
  const detailHref = buildStandaloneFeiTicketHref(row.ticketId)
  const printHref = buildStandaloneFeiTicketHref(row.ticketId, '/print')
  const reprintHref = buildStandaloneFeiTicketHref(row.ticketId, '/reprint')
  const canPrint = row.tab === 'WAIT_FIRST'
  const canReprint = row.tab === 'PRINTED' || row.tab === 'NEED_REPRINT'
  return `
    <div class="flex flex-wrap gap-1.5">
      <button type="button" data-nav="${escapeHtml(detailHref)}" class="inline-flex min-h-8 items-center rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50">查看</button>
      ${canPrint ? `<button type="button" data-nav="${escapeHtml(printHref)}" class="inline-flex min-h-8 items-center rounded-md border border-blue-600 bg-blue-600 px-2.5 text-xs font-medium text-white hover:bg-blue-700">打印</button>` : ''}
      ${canReprint ? `<button type="button" data-nav="${escapeHtml(reprintHref)}" class="inline-flex min-h-8 items-center rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50">补打</button>` : ''}
    </div>
  `
}

function renderSpreadingLifecycleStatusBadge(row: FeiTicketSpreadingWorkbenchRow): string {
  const className =
    row.tab === 'WAIT_FIRST'
      ? 'border border-slate-200 bg-slate-100 text-slate-700'
      : row.tab === 'PRINTED'
        ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
        : row.tab === 'NEED_REPRINT'
          ? 'border border-amber-200 bg-amber-50 text-amber-700'
          : 'border border-slate-200 bg-slate-100 text-slate-700'
  return renderBadge(row.printStatusLabel, className)
}

function renderSpreadingWorkbenchRowActions(row: FeiTicketSpreadingWorkbenchRow): string {
  const detailHref = buildStandaloneSpreadingHref(row)
  const allPrintHref = buildSpreadingPrintPreviewHref(row.detailRows, 'all')
  return `
    <div class="flex flex-wrap gap-1.5">
      <button type="button" data-nav="${escapeHtml(allPrintHref)}" class="inline-flex min-h-8 items-center rounded-md border border-blue-600 bg-blue-600 px-2.5 text-xs font-medium text-white hover:bg-blue-700">全部打印</button>
      <button type="button" data-nav="${escapeHtml(detailHref)}" class="inline-flex min-h-8 items-center rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50">菲票明细</button>
    </div>
  `
}

function renderFeiTicketWorkbenchCard(row: FeiTicketSpreadingWorkbenchRow): string {
  const detailLines = row.detailRows.slice(0, 4)
  const remainingCount = Math.max(row.detailRows.length - detailLines.length, 0)
  return `
    <article class="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div class="grid gap-3 xl:grid-cols-[1.05fr_1.2fr_1.25fr_1.1fr_1fr_auto] xl:items-start">
        <div>
          <p class="mb-1 text-xs text-slate-500">铺布单</p>
          <div class="flex flex-wrap items-center gap-2">
            <button type="button" data-nav="${escapeHtml(buildStandaloneSpreadingHref(row))}" class="text-left text-sm font-semibold text-blue-700 hover:underline">${escapeHtml(row.spreadingOrderNo)}</button>
            ${renderSpreadingLifecycleStatusBadge(row)}
          </div>
          <p class="mt-1 text-xs text-slate-500">${escapeHtml(`${row.markerPlanNo} / 唛架编号 ${row.markerNumber}`)}</p>
          <p class="mt-1 text-xs text-slate-500">${escapeHtml(`菲票明细 ${formatCount(row.ticketCount)} 条 / 裁片 ${formatCount(row.totalPieceQty)} 片`)}</p>
        </div>
        <div class="space-y-1 text-xs text-slate-600">
          <p class="font-semibold text-slate-900">来源</p>
          <p><span class="text-slate-400">生产单：</span><span class="font-medium text-slate-800">${escapeHtml(joinCompactLines(row.productionOrderNos, 2))}</span></p>
          <p><span class="text-slate-400">裁片单：</span><span class="font-medium text-slate-800">${escapeHtml(joinCompactLines(row.cutOrderNos, 2))}</span></p>
          <p><span class="text-slate-400">SPU：</span><span class="font-medium text-slate-800">${escapeHtml(joinCompactLines(row.spuCodes, 2))}</span></p>
          <p><span class="text-slate-400">颜色：</span><span class="font-medium text-slate-800">${escapeHtml(joinCompactLines(row.colors, 2))}</span></p>
        </div>
        <div class="space-y-1 text-xs text-slate-600">
          <p class="font-semibold text-slate-900">菲票明细</p>
          ${detailLines
            .map((detail) => `
              <p>
                <span class="font-medium text-slate-800">${escapeHtml(`${detail.partName || '待补部位'} / ${detail.size || '待补尺码'}`)}</span>
                <span class="text-slate-400"> · </span>
                <span class="font-semibold text-slate-900">${formatCount(detail.pieceQty)} 片</span>
                <span class="text-slate-400"> · 编号范围 </span>
                <span class="font-semibold text-slate-900">${escapeHtml(detail.pieceSequenceLabel || '不可生成')}</span>
              </p>
            `)
            .join('')}
          ${remainingCount ? `<p class="text-slate-500">另 ${formatCount(remainingCount)} 条明细，进入部位明细查看。</p>` : ''}
        </div>
        <div class="space-y-1 text-xs text-slate-600">
          <p class="font-semibold text-slate-900">特殊工艺</p>
          <p><span class="text-slate-400">是否有特殊工艺：</span><span class="font-medium text-slate-800">${row.hasSpecialCraft ? '是' : '无'}</span></p>
          <p><span class="text-slate-400">特殊工艺类型：</span><span class="font-medium text-slate-800">${escapeHtml(joinCompactLines(row.specialCraftLines, 2))}</span></p>
          <p><span class="text-slate-400">承接工厂：</span><span class="font-medium text-slate-800">${escapeHtml(joinCompactLines(row.receiverFactoryLines, 2))}</span></p>
        </div>
        <div class="space-y-1 text-xs text-slate-600">
          <p class="font-semibold text-slate-900">打印信息</p>
          <p><span class="text-slate-400">打印时间：</span><span class="font-medium text-slate-800">${escapeHtml(row.firstPrintedAt || '未打印')}</span></p>
          <p><span class="text-slate-400">最近补打：</span><span class="font-medium text-slate-800">${escapeHtml(row.latestReprintAt || '无')}</span></p>
          <p><span class="text-slate-400">打印次数：</span><span class="font-medium text-slate-800">${formatCount(row.printCount)}</span></p>
          <p><span class="text-slate-400">打印人：</span><span class="font-medium text-slate-800">${escapeHtml(row.printedBy || '待打印')}</span></p>
          <p><span class="text-slate-400">状态：</span><span class="font-medium text-slate-800">${escapeHtml(row.printStatusLabel)}</span></p>
        </div>
        <div class="xl:w-[216px]">${renderSpreadingWorkbenchRowActions(row)}</div>
      </div>
    </article>
  `
}

function renderFeiTicketWorkbenchTable(rows: FeiTicketSpreadingWorkbenchRow[]): string {
  if (!rows.length) {
    return `
      <section class="rounded-lg border bg-card px-6 py-10 text-center text-sm text-muted-foreground">
        当前筛选范围内暂无部位菲票打印对象。
      </section>
    `
  }

  return `
    <section class="rounded-lg border bg-card" data-testid="part-fei-ticket-print-workbench">
      <div class="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 class="text-sm font-semibold">部位菲票打印</h2>
        </div>
        <div class="text-xs text-muted-foreground">共 ${formatCount(rows.length)} 条铺布单</div>
      </div>
      ${renderStickyTableScroller(
        `
          <table class="w-full min-w-[1260px] text-sm">
            <thead class="sticky top-0 z-10 border-b bg-muted/95 text-muted-foreground backdrop-blur">
              <tr>
                <th class="px-4 py-3 text-left font-medium">铺布单</th>
                <th class="px-4 py-3 text-left font-medium">来源</th>
                <th class="px-4 py-3 text-left font-medium">菲票明细</th>
                <th class="px-4 py-3 text-left font-medium">特殊工艺</th>
                <th class="px-4 py-3 text-left font-medium">打印信息</th>
                <th class="px-4 py-3 text-left font-medium">状态</th>
                <th class="px-4 py-3 text-left font-medium">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              ${rows
                .map((row) => {
                  const detailLines = row.detailRows.slice(0, 3)
                  const remainingCount = Math.max(row.detailRows.length - detailLines.length, 0)
                  return `
                    <tr class="hover:bg-muted/20">
                      <td class="px-4 py-3 align-top">
                        <button type="button" data-nav="${escapeHtml(buildStandaloneSpreadingHref(row))}" class="text-left font-medium text-blue-600 hover:underline">
                          ${escapeHtml(row.spreadingOrderNo)}
                        </button>
                        <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(`${row.markerPlanNo} / 唛架编号 ${row.markerNumber}`)}</p>
                        <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(`菲票明细 ${formatCount(row.ticketCount)} 条 / 裁片 ${formatCount(row.totalPieceQty)} 片`)}</p>
                      </td>
                      <td class="px-4 py-3 align-top">
                        <div class="space-y-1 text-xs text-muted-foreground">
                          <p><span>生产单：</span><span class="font-medium text-foreground">${escapeHtml(joinCompactLines(row.productionOrderNos, 2))}</span></p>
                          <p><span>裁片单：</span><span class="font-medium text-foreground">${escapeHtml(joinCompactLines(row.cutOrderNos, 2))}</span></p>
                          <p><span>SPU：</span><span class="font-medium text-foreground">${escapeHtml(joinCompactLines(row.spuCodes, 2))}</span></p>
                          <p><span>颜色：</span><span class="font-medium text-foreground">${escapeHtml(joinCompactLines(row.colors, 2))}</span></p>
                        </div>
                      </td>
                      <td class="px-4 py-3 align-top">
                        <div class="space-y-1 text-xs text-muted-foreground">
                          ${detailLines
                            .map((detail) => `
                              <p>
                                <span class="font-medium text-foreground">${escapeHtml(`${detail.partName || '待补部位'} / ${detail.size || '待补尺码'}`)}</span>
                                <span> · ${formatCount(detail.pieceQty)} 片 · 编号 ${escapeHtml(detail.pieceSequenceLabel || '不可生成')}</span>
                              </p>
                            `)
                            .join('')}
                          ${remainingCount ? `<p>另 ${formatCount(remainingCount)} 条明细，进入部位明细查看。</p>` : ''}
                        </div>
                      </td>
                      <td class="px-4 py-3 align-top">
                        <div class="space-y-1 text-xs text-muted-foreground">
                          <p><span>是否有特殊工艺：</span><span class="font-medium text-foreground">${row.hasSpecialCraft ? '是' : '无'}</span></p>
                          <p><span>特殊工艺类型：</span><span class="font-medium text-foreground">${escapeHtml(joinCompactLines(row.specialCraftLines, 2))}</span></p>
                          <p><span>承接工厂：</span><span class="font-medium text-foreground">${escapeHtml(joinCompactLines(row.receiverFactoryLines, 2))}</span></p>
                        </div>
                      </td>
                      <td class="px-4 py-3 align-top">
                        <div class="space-y-1 text-xs text-muted-foreground">
                          <p><span>打印时间：</span><span class="font-medium text-foreground">${escapeHtml(row.firstPrintedAt || '未打印')}</span></p>
                          <p><span>最近补打：</span><span class="font-medium text-foreground">${escapeHtml(row.latestReprintAt || '无')}</span></p>
                          <p><span>打印次数：</span><span class="font-medium text-foreground">${formatCount(row.printCount)}</span></p>
                          <p><span>打印人：</span><span class="font-medium text-foreground">${escapeHtml(row.printedBy || '待打印')}</span></p>
                        </div>
                      </td>
                      <td class="px-4 py-3 align-top">${renderSpreadingLifecycleStatusBadge(row)}</td>
                      <td class="px-4 py-3 align-top">
                        <div class="min-w-[180px]">${renderSpreadingWorkbenchRowActions(row)}</div>
                      </td>
                    </tr>
                  `
                })
                .join('')}
            </tbody>
          </table>
        `,
      )}
    </section>
  `
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
          <th class="px-3 py-3 text-left font-medium">面料</th>
          <th class="px-3 py-3 text-left font-medium">来源生产单数</th>
          <th class="px-3 py-3 text-left font-medium">来源裁片单数</th>
          <th class="px-3 py-3 text-left font-medium">应打菲票数</th>
          <th class="px-3 py-3 text-left font-medium">有效已打印数</th>
          <th class="px-3 py-3 text-left font-medium">未打印 / 缺口数</th>
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
                <td class="px-3 py-2.5 text-slate-700">${renderMaterialIdentityBlock({
                  materialSku: unit.fabricSku || '待补面料',
                  materialLabel: unit.fabricSku || '待补面料',
                  materialAlias: unit.materialAlias,
                  materialImageUrl: unit.materialImageUrl,
                }, { compact: true, imageSizeClass: 'h-9 w-9' })}</td>
                <td class="px-3 py-2.5 text-slate-700">${formatCount(unit.sourceProductionOrderCount)}</td>
                <td class="px-3 py-2.5 text-slate-700">${formatCount(unit.sourceCutOrderCount)}</td>
                <td class="px-3 py-2.5 font-medium text-slate-900">${formatCount(unit.requiredTicketCount)}</td>
                <td class="px-3 py-2.5 text-slate-700">${formatCount(unit.validPrintedTicketCount)}</td>
                <td class="px-3 py-2.5 text-slate-700">${formatCount(unit.missingTicketCount)}</td>
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

function formatBindingLength(value: number): string {
  return `${Number(value || 0).toFixed(2)} m`
}

function resolveBindingDetailRollLength(detail: BindingStripWorkOrderDetail): number {
  if (detail.rollLength > 0) return detail.rollLength
  if (!detail.actualRollCount) return 0
  return Number((Number(detail.actualLength || 0) / detail.actualRollCount).toFixed(2))
}

function resolveBindingDetailCuttingLength(detail: BindingStripWorkOrderDetail): number {
  const rollLength = resolveBindingDetailRollLength(detail)
  if (rollLength > 0 && detail.actualRollCount > 0) return Number((rollLength * detail.actualRollCount).toFixed(2))
  if (detail.cuttingMethod === '直切') return detail.straightCutLength || detail.actualLength || 0
  if (detail.cuttingMethod === '横切') return detail.crossCutLength || detail.actualLength || 0
  return detail.biasCutLength || detail.actualLength || 0
}

function renderPrintObjectStatusBadge(row: FeiTicketPrintObjectRow): string {
  const className =
    row.printStatus === 'WAITING_PRINT'
      ? 'border border-slate-200 bg-slate-100 text-slate-700'
      : row.printStatus === 'PRINTED'
        ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
        : 'border border-amber-200 bg-amber-50 text-amber-700'
  return renderBadge(row.printStatusLabel, className)
}

function renderPrintObjectTypeBadge(row: FeiTicketPrintObjectRow): string {
  const className = row.objectType === 'BINDING_STRIP_ORDER'
    ? 'border border-indigo-200 bg-indigo-50 text-indigo-700'
    : 'border border-blue-200 bg-blue-50 text-blue-700'
  return renderBadge(row.objectTypeLabel, className)
}

function renderPrintObjectDetailSummary(row: FeiTicketPrintObjectRow): string {
  const visible = row.detailRows.slice(0, 3)
  const remainingCount = Math.max(row.detailRows.length - visible.length, 0)
  return `
    <div class="space-y-1 text-xs text-muted-foreground">
      ${visible.map((detail) => `
        <p>
          <span class="font-medium text-foreground">${escapeHtml(detail.primaryLabel)}</span>
          <span> · ${escapeHtml(detail.quantityLabel)}</span>
          <span> · ${escapeHtml(detail.secondaryLabel)}</span>
        </p>
      `).join('')}
      ${remainingCount ? `<p>另 ${formatCount(remainingCount)} 条明细，进入菲票明细查看。</p>` : ''}
    </div>
  `
}

function renderPrintObjectActions(row: FeiTicketPrintObjectRow): string {
  return `
    <div class="flex min-w-[168px] flex-wrap gap-1.5">
      <button type="button" data-nav="${escapeHtml(row.allPrintHref)}" class="inline-flex min-h-8 items-center rounded-md border border-blue-600 bg-blue-600 px-2.5 text-xs font-medium text-white hover:bg-blue-700">全部打印</button>
      <button type="button" data-nav="${escapeHtml(row.detailHref)}" class="inline-flex min-h-8 items-center rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50">菲票明细</button>
    </div>
  `
}

function renderBindingFeiTicketPrintTable(rows: FeiTicketPrintObjectRow[]): string {
  if (!rows.length) {
    return `
      <section class="rounded-lg border bg-card px-6 py-10 text-center text-sm text-muted-foreground">
        当前筛选范围内暂无捆条菲票打印对象。
      </section>
    `
  }
  return `
    <section class="rounded-lg border bg-card" data-testid="binding-fei-ticket-print-workbench">
      <div class="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 class="text-sm font-semibold">捆条菲票打印</h2>
          <p class="mt-1 text-xs text-muted-foreground">按捆条加工单打印；一个宽度对应一张捆条菲票。</p>
        </div>
        <div class="text-xs text-muted-foreground">共 ${formatCount(rows.length)} 条捆条加工单</div>
      </div>
      ${renderStickyTableScroller(
        `
          <table class="w-full min-w-[1260px] text-sm">
            <thead class="sticky top-0 z-10 border-b bg-muted/95 text-muted-foreground backdrop-blur">
              <tr>
                <th class="px-4 py-3 text-left font-medium">捆条加工单</th>
                <th class="px-4 py-3 text-left font-medium">来源</th>
                <th class="px-4 py-3 text-left font-medium">物料 / 纸样</th>
                <th class="px-4 py-3 text-left font-medium">捆条明细</th>
                <th class="px-4 py-3 text-left font-medium">应打菲票数</th>
                <th class="px-4 py-3 text-left font-medium">打印状态</th>
                <th class="px-4 py-3 text-left font-medium">最近打印</th>
                <th class="px-4 py-3 text-left font-medium">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              ${rows.map((row) => `
                <tr class="hover:bg-muted/20">
                  <td class="px-4 py-3 align-top">
                    <button type="button" data-nav="${escapeHtml(row.detailHref)}" class="text-left font-medium text-blue-600 hover:underline">${escapeHtml(row.objectNo)}</button>
                    <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(`捆条菲票 ${formatCount(row.ticketCount)} 张 / ${row.totalQuantityLabel}`)}</div>
                  </td>
                  <td class="px-4 py-3 align-top">
                    <div class="space-y-1 text-xs text-muted-foreground">
                      ${row.sourceLines.map((line) => `<p>${escapeHtml(line)}</p>`).join('')}
                    </div>
                  </td>
                  <td class="px-4 py-3 align-top">
                    <div class="space-y-2">
                      ${renderMaterialIdentityBlock(row.material, { compact: true, imageSizeClass: 'h-9 w-9' })}
                      <p class="text-xs text-muted-foreground">纸样：${escapeHtml(row.styleCode || '待补纸样')}</p>
                    </div>
                  </td>
                  <td class="px-4 py-3 align-top">
                    ${renderPrintObjectDetailSummary(row)}
                  </td>
                  <td class="px-4 py-3 align-top">
                    <div class="space-y-1 text-xs text-muted-foreground">
                      <p><span class="font-medium text-foreground">${formatCount(row.ticketCount)}</span> 张</p>
                      <p>已打印 ${formatCount(row.printedCount)} / 缺口 ${formatCount(row.missingCount)}</p>
                    </div>
                  </td>
                  <td class="px-4 py-3 align-top">${renderPrintObjectStatusBadge(row)}</td>
                  <td class="px-4 py-3 align-top">
                    <div class="space-y-1 text-xs text-muted-foreground">
                      <p><span class="font-medium text-foreground">${escapeHtml(row.firstPrintedAt || '未打印')}</span></p>
                      <p>最近补打：${escapeHtml(row.latestReprintAt || '无')}</p>
                      <p>打印次数：${formatCount(row.printCount)} / 打印人：${escapeHtml(row.printedBy || '待打印')}</p>
                    </div>
                  </td>
                  <td class="px-4 py-3 align-top">${renderPrintObjectActions(row)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `,
      )}
    </section>
  `
}

function renderListPage(): string {
  const pathname = getCurrentPathname()
  const mode = resolveFeiTicketListMode(pathname)
  const meta = mode === 'BINDING'
    ? getCanonicalCuttingMeta('binding-fei-tickets')
    : getCanonicalCuttingMeta(pathname, 'fei-tickets')
  const summaryAction = renderReturnToSummaryButton()
  const rows = mode === 'BINDING'
    ? filterBindingFeiTicketPrintRows(buildBindingFeiTicketPrintRows())
    : filterSpreadingFeiTicketPrintRows(buildSpreadingPrintObjectRows(buildFeiTicketWorkbenchRows(getDataBundle())))
  const body = `
    ${renderFilterArea()}
    ${renderPrintListStats(rows as Array<FeiTicketSpreadingWorkbenchRow | FeiTicketPrintObjectRow>, mode)}
    ${mode === 'BINDING'
      ? renderBindingFeiTicketPrintTable(rows as FeiTicketPrintObjectRow[])
      : renderFeiTicketWorkbenchTable(rows as FeiTicketSpreadingWorkbenchRow[])}
  `

  return renderPrintablePageShell(`
    ${renderCuttingPageHeader(meta, {
      showAliasBadge: isCuttingAliasPath(pathname),
      actionsHtml: summaryAction ? `<div class="flex flex-wrap gap-2">${summaryAction}</div>` : '',
    })}
    ${body}
  `)
}

function renderBackToList(unit: PrintableUnit | null): string {
  return `<button type="button" data-nav="${escapeHtml(unit ? buildActionHref('fei-tickets', unit) : getCanonicalCuttingPath('fei-tickets'))}" class="inline-flex min-h-10 items-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">返回部位菲票打印</button>`
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
  const sourceMarkerPlanText = unit.batchNo || '未关联唛架方案'
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
            <p class="text-xs text-slate-500">面料</p>
            <div class="mt-2">${renderMaterialIdentityBlock({
              materialSku: unit.fabricSku || '待补面料',
              materialLabel: unit.fabricSku || '待补面料',
              materialAlias: unit.materialAlias,
              materialImageUrl: unit.materialImageUrl,
            }, { compact: true })}</div>
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
              <span class="inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${unit.ticketCountBasisType === FEI_TICKET_SOURCE_BASIS_TYPE ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}">${escapeHtml(unit.ticketCountBasisLabel)}</span>
              <span class="text-xs text-slate-500">${escapeHtml(unit.ticketCountBasisType === FEI_TICKET_SOURCE_BASIS_TYPE ? '按实际裁片数量拆分' : '当前尚未形成实际裁剪产出')}</span>
            </div>
            <p class="mt-1 text-xs text-slate-500">${escapeHtml(unit.ticketCountBasisDetail)}</p>
          </div>
          <div class="rounded-lg border border-slate-200 bg-white p-3">
            <p class="text-xs text-slate-500">有效已打印数</p>
            <p class="mt-1 text-xl font-semibold text-slate-900">${formatCount(unit.validPrintedTicketCount)}</p>
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
            <p class="text-xs text-slate-500">来源裁片单</p>
            <p class="mt-1 text-sm font-medium text-slate-900">${escapeHtml(sourceCutOrderText)}</p>
          </div>
          <div class="rounded-lg border border-slate-200 bg-white p-3">
            <p class="text-xs text-slate-500">来源唛架方案</p>
            <p class="mt-1 text-sm font-medium text-slate-900">${escapeHtml(sourceMarkerPlanText)}</p>
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
          <th class="px-3 py-3 text-left font-medium">配套编号</th>
          <th class="px-3 py-3 text-left font-medium">部位裁片编号范围</th>
          <th class="px-3 py-3 text-left font-medium">特殊工艺 / 承接工厂</th>
          <th class="px-3 py-3 text-left font-medium">裁片单</th>
          <th class="px-3 py-3 text-left font-medium">${PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE}</th>
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
                <td class="px-3 py-3 text-slate-700">${escapeHtml(detail.pieceSetNoRange || '暂无数据')}</td>
                <td class="px-3 py-3 text-slate-700">${renderPieceSequenceSummary(detail)}</td>
                <td class="px-3 py-3 text-slate-700">${renderSpecialCraftSummary(detail.specialCrafts)}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(detail.sourceCutOrderNo)}</td>
                <td class="px-3 py-3 text-slate-700">${renderProductionOrderIdentityCell(detail.sourceProductionOrderNo)}</td>
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

function buildTicketPanelHref(unit: PrintableUnit, ticket: TicketCard, panel: 'qr' | 'preview'): string {
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
          <p class="text-xs text-slate-500">交出状态</p>
          <p class="text-sm font-semibold text-slate-900">${escapeHtml(formatDispatchLabel(summary.dispatchStatus))}</p>
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
  const numberingStatus = getTicketCardNumberingStatus(ticket)
  const title = panel === 'preview' ? '打印预览' : '菲票码预览'
  const body =
    panel === 'preview'
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
                  <p class="text-sm text-slate-500">裁片单 / 生产单</p>
                  <p class="text-sm font-semibold text-slate-900">${escapeHtml(`${craftTrace?.cutOrderNo || ticket.sourceCutOrderNo} / ${craftTrace?.productionOrderNo || ticket.sourceProductionOrderNo || '待补生产单'}`)}</p>
                </div>
                <div>
                  <p class="text-sm text-slate-500">面料 / 面料卷号</p>
                  ${renderMaterialIdentityBlock({
                    materialSku: craftTrace?.materialSku || unit.fabricSku || '待补',
                    materialLabel: craftTrace?.materialSku || unit.fabricSku || '待补',
                    materialAlias: unit.materialAlias,
                    materialImageUrl: unit.materialImageUrl,
                  }, { compact: true })}
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
                  <p class="text-sm text-slate-500">配套编号</p>
                  <p class="text-lg font-semibold text-slate-900">${escapeHtml(ticket.pieceSetNoRange || '暂无数据')}</p>
                  <p class="mt-1 text-xs text-slate-500">${escapeHtml(ticket.bundleTicketType || '扎束菲票')}</p>
                </div>
                <div>
                  <p class="text-sm text-slate-500">部位裁片编号范围</p>
                  <div class="mt-1 text-sm">${renderPieceSequenceSummary(ticket)}</div>
                </div>
                <div>
                  <p class="text-sm text-slate-500">打编号状态</p>
                  <div class="mt-1">${renderFeiTicketNumberingStatusBadge(numberingStatus)}</div>
                </div>
                <div>
                  <p class="text-sm text-slate-500">数量 / 裁片数</p>
                  <p class="text-lg font-semibold text-slate-900">${formatCount(ticket.quantity)}</p>
                  <p class="mt-1 text-xs text-slate-500">${escapeHtml(`${formatCount(ticket.actualCutPieceQty)} 片`)}</p>
                </div>
                <div>
                  <p class="text-sm text-slate-500">工艺顺序</p>
                  <p class="text-sm font-semibold text-slate-900">${escapeHtml(craftTrace?.secondaryCrafts.join(' → ') || '未配置')}</p>
                  <p class="mt-1 text-xs text-slate-500">${escapeHtml(`版本 ${craftTrace?.craftSequenceVersion || '待补'} / 当前 ${craftTrace?.currentCraftStage || '未开始'}`)}</p>
                </div>
                <div>
                  <p class="text-sm text-slate-500">特殊工艺</p>
                  <p class="text-sm font-semibold text-slate-900">${escapeHtml(ticket.specialCraftDisplayLabel || '无')}</p>
                  <div class="mt-1">${renderSpecialCraftSummary(ticket.specialCrafts)}</div>
                </div>
                <div>
                  <p class="text-sm text-slate-500">交出状态 / 回仓状态</p>
                  <p class="text-sm font-semibold text-slate-900">${escapeHtml(`${formatDispatchLabel(specialCraftSummary.dispatchStatus)} / ${specialCraftSummary.returnStatus}`)}</p>
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
                <div>裁片单：${escapeHtml(craftTrace?.cutOrderNo || ticket.sourceCutOrderNo)}</div>
                <div>生产单：${escapeHtml(craftTrace?.productionOrderNo || ticket.sourceProductionOrderNo || '待补')}</div>
                <div class="rounded-md bg-white/70 p-2">
                  ${renderMaterialIdentityBlock(
                    {
                      materialSku: craftTrace?.materialSku || unit.fabricSku || '待补',
                      materialLabel: craftTrace?.materialSku || unit.fabricSku || '待补',
                      materialAlias: unit.materialAlias,
                      materialImageUrl: unit.materialImageUrl,
                    },
                    { compact: true, imageSizeClass: 'h-9 w-9', showCategory: false },
                  )}
                </div>
                <div>扎号：${escapeHtml(ticket.bundleNo || '暂无数据')}</div>
                <div>配套编号：${escapeHtml(ticket.pieceSetNoRange || '暂无数据')}</div>
                <div>打编号状态：${escapeHtml(numberingStatus)}</div>
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
          <th class="px-3 py-3 text-left font-medium">裁片单</th>
          <th class="px-3 py-3 text-left font-medium">${PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE}</th>
          <th class="px-3 py-3 text-left font-medium">面料卷号</th>
          <th class="px-3 py-3 text-left font-medium">布料颜色</th>
          <th class="px-3 py-3 text-left font-medium">尺码</th>
          <th class="px-3 py-3 text-left font-medium">裁片部位</th>
          <th class="px-3 py-3 text-left font-medium">数量</th>
          <th class="px-3 py-3 text-left font-medium">扎号</th>
          <th class="px-3 py-3 text-left font-medium">配套编号</th>
          <th class="px-3 py-3 text-left font-medium">部位裁片编号范围</th>
          <th class="px-3 py-3 text-left font-medium">打编号状态</th>
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
          <th class="px-3 py-3 text-left font-medium">交出状态</th>
          <th class="px-3 py-3 text-left font-medium">回仓状态</th>
          <th class="px-3 py-3 text-left font-medium">当前所在</th>
          <th class="px-3 py-3 text-left font-medium">中转单号</th>
          <th class="px-3 py-3 text-left font-medium">中转袋号</th>
          <th class="px-3 py-3 text-left font-medium">袋内状态</th>
          <th class="px-3 py-3 text-left font-medium">所属交出记录</th>
          <th class="px-3 py-3 text-left font-medium">交出状态</th>
          <th class="px-3 py-3 text-left font-medium">是否已装袋</th>
          <th class="px-3 py-3 text-left font-medium">是否已交出</th>
          <th class="px-3 py-3 text-left font-medium">车缝回写状态</th>
          <th class="px-3 py-3 text-left font-medium">特殊工艺回仓状态</th>
          <th class="px-3 py-3 text-left font-medium">打印版本号</th>
          <th class="px-3 py-3 text-left font-medium">打印状态</th>
          <th class="px-3 py-3 text-left font-medium">中转袋绑定</th>
          <th class="px-3 py-3 text-left font-medium">打印时间</th>
          <th class="px-3 py-3 text-left font-medium">打印人</th>
          <th class="px-3 py-3 text-left font-medium">操作</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100 bg-white">
        ${detailView.ticketCards
          .filter((ticket) => ticket.status === 'VALID')
          .map((ticket) => {
            const specialCraftSummary = getSpecialCraftFeiTicketSummary(ticket.ticketNo)
            const sewingDispatchSummary = findCuttingSewingDispatchByFeiTicketNo(ticket.ticketNo)
            const numberingStatus = getTicketCardNumberingStatus(ticket)
            const actions =
              [
                    { label: '查看菲票码', href: buildFeiTicketLabelPrintLink(ticket.ticketId, 'first') },
                    { label: '查看打印预览', href: buildFeiTicketLabelPrintLink(ticket.ticketId, 'first') },
                    { label: '打印菲票标签', href: buildFeiTicketLabelPrintLink(ticket.ticketId, 'first') },
                    { label: '补打标签', href: buildFeiTicketLabelPrintLink(ticket.ticketId, 'reprint') },
                    {
                      label: '查看交出单',
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
                            label: '查看特殊工艺交出',
                            href: `${getCanonicalCuttingPath('special-craft-dispatch')}?keyword=${encodeURIComponent(ticket.ticketNo)}`,
                          },
                          {
                            label: '查看特殊工艺回仓',
                            href: `${getCanonicalCuttingPath('special-craft-return')}?keyword=${encodeURIComponent(ticket.ticketNo)}`,
                          },
                        ]
                      : []),
                  ]
            return `
              <tr>
                <td class="px-3 py-3 font-medium text-slate-900">${escapeHtml(ticket.ticketNo)}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(ticket.sourceCutOrderNo)}</td>
                <td class="px-3 py-3 text-slate-700">${renderProductionOrderIdentityCell(ticket.sourceProductionOrderNo)}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(ticket.fabricRollNo || '暂无数据')}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(ticket.fabricColor || '暂无数据')}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(ticket.size)}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(ticket.partName)}</td>
                <td class="px-3 py-3 text-slate-700">${formatCount(ticket.quantity)}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(ticket.bundleNo || '暂无数据')}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(ticket.pieceSetNoRange || '暂无数据')}</td>
                <td class="px-3 py-3 text-slate-700">${renderPieceSequenceSummary(ticket)}</td>
                <td class="px-3 py-3">${renderFeiTicketNumberingStatusBadge(numberingStatus)}</td>
                <td class="px-3 py-3 text-slate-700">${ticket.hasSpecialCraft ? '是' : '无'}</td>
                <td class="px-3 py-3 text-slate-700">${renderSpecialCraftSummary(ticket.specialCrafts)}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(ticket.specialCrafts.map((craft) => craft.craftType).join(' → ') || '无')}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(specialCraftSummary.completedOperationNames.join(' / ') || '—')}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(specialCraftSummary.currentOperationName)}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(specialCraftSummary.taskOrderNos.join(' / ') || '待绑定')}</td>
                <td class="px-3 py-3 text-slate-700">${formatCount(specialCraftSummary.originalQty)}</td>
                <td class="px-3 py-3 text-slate-700">${formatCount(specialCraftSummary.currentQty)}</td>
                <td class="px-3 py-3 text-slate-700">${formatCount(specialCraftSummary.cumulativeScrapQty)}</td>
                <td class="px-3 py-3 text-slate-700">${formatCount(specialCraftSummary.cumulativeDamageQty)}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(specialCraftSummary.receiveDifferenceStatus)}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(specialCraftSummary.returnDifferenceStatus)}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(formatDispatchLabel(specialCraftSummary.dispatchStatus))}</td>
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
                <td class="px-3 py-3 text-slate-700">V${formatCount(ticket.version)}</td>
                <td class="px-3 py-3">
                  <div class="space-y-1">
                    ${renderTicketStatusBadge(ticket.status)}
                    ${ticket.downstreamLocked ? `<p class="text-xs text-rose-600">${escapeHtml(ticket.downstreamLockedReason || '下游已锁定')}</p>` : ''}
                  </div>
                </td>
                <td class="px-3 py-3 text-slate-700">${ticket.boundPocketNo ? escapeHtml(`${ticket.boundPocketNo} / ${ticket.boundUsageNo || '待补使用周期号'}`) : '未绑定中转袋'}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(formatDateTime(ticket.printedAt))}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(ticket.printedBy || '未打印')}</td>
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
              <span>配套 ${escapeHtml(detail.pieceSetNoRange || '暂无')}</span>
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

function renderDetailOrChildPage(pageKey: 'fei-ticket-detail' | 'fei-ticket-printed'): string {
  const bundle = getDataBundle()
  const pathname = getCurrentPathname()
  const meta = getCanonicalCuttingMeta(pathname, 'fei-ticket-detail')
  const unit = findUnit(bundle)

  if (!unit) {
    return renderPrintablePageShell(`
      ${renderCuttingPageHeader(meta, {
        actionsHtml: renderReturnToSummaryButton() ? `<div class="flex flex-wrap gap-2">${renderReturnToSummaryButton()}</div>` : '',
      })}
      ${renderSectionCard('未找到打印单元', '', `<div class="space-y-3"><p class="text-sm text-slate-600">请先从菲票进入。</p>${renderBackToList(null)}</div>`)}
    `)
  }

  const detailView = buildPrintableUnitDetailViewModel({
    unit,
    cutOrderRows: bundle.cutOrderRows,
    materialPrepRows: bundle.materialPrepRows,
    markerPlanSources: bundle.markerPlanSources,
    markerStore: bundle.markerStore,
    ticketRecords: bundle.ticketRecords,
    printJobs: bundle.printJobs,
  })
  const activeTab = pageKey === 'fei-ticket-printed' ? 'printed' : getDetailTab(pathname)
  const content = activeTab === 'printed' ? renderPrintedTicketsTab(unit, detailView) : renderSplitDetailsTab(detailView)

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
          <th class="px-3 py-3 text-left font-medium">配套编号</th>
          <th class="px-3 py-3 text-left font-medium">部位裁片编号范围</th>
          <th class="px-3 py-3 text-left font-medium">特殊工艺</th>
          <th class="px-3 py-3 text-left font-medium">裁片单</th>
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
                <td class="px-3 py-3 text-slate-700">${escapeHtml(detail.pieceSetNoRange || '暂无数据')}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(detail.pieceSequenceLabel || detail.pieceSequenceCannotGenerateReason || '不可生成')}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(detail.specialCraftDisplayLabel || '无')}</td>
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
  const needsReason = pageKey === 'fei-ticket-reprint'

  return `
    <div class="grid gap-4 lg:grid-cols-2">
      <label class="space-y-1 text-sm text-slate-600">
        <span class="font-medium text-slate-700">操作人</span>
        <input type="text" value="${escapeHtml(state.operationDraft.operator)}" data-cutting-fei-op-field="operator" class="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" />
      </label>
      <label class="space-y-1 text-sm text-slate-600"><span class="font-medium text-slate-700">打印机</span><input type="text" value="${escapeHtml(state.operationDraft.printerName)}" data-cutting-fei-op-field="printerName" class="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" /></label>
      <label class="space-y-1 text-sm text-slate-600"><span class="font-medium text-slate-700">模板</span><input type="text" value="${escapeHtml(state.operationDraft.templateName)}" data-cutting-fei-op-field="templateName" class="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" /></label>
      <label class="space-y-1 text-sm text-slate-600">
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
  if (pageKey === 'fei-ticket-print') return { label: '确认首打', action: 'confirm-first-print' }
  return { label: '确认补打', action: 'confirm-reprint' }
}

function renderOperationPage(pageKey: OperationPageKey): string {
  const bundle = getDataBundle()
  const meta = getCanonicalCuttingMeta(getCurrentPathname(), pageKey)
  const unit = findUnit(bundle)
  if (!unit) return renderOperationValidation('未找到当前 printableUnit。', null, pageKey)

  const detailView = buildPrintableUnitDetailViewModel({
    unit,
    cutOrderRows: bundle.cutOrderRows,
    materialPrepRows: bundle.materialPrepRows,
    markerPlanSources: bundle.markerPlanSources,
    markerStore: bundle.markerStore,
    ticketRecords: bundle.ticketRecords,
    printJobs: bundle.printJobs,
  })

  if (pageKey === 'fei-ticket-print' && unit.printableUnitStatus !== 'WAITING_PRINT') {
    return renderOperationValidation('只有待打印状态才能进入首打页。', unit, pageKey)
  }
  if (pageKey === 'fei-ticket-reprint' && unit.printableUnitStatus !== 'NEED_REPRINT') {
    return renderOperationValidation('只有需补打状态才能进入补打页。', unit, pageKey)
  }

  const previewDetails = pageKey === 'fei-ticket-print' || pageKey === 'fei-ticket-reprint' ? detailView.missingSplitDetails : []
  const invalidPreviewDetails = previewDetails.filter((detail) => !isFeiTicketFiveDimComplete(detail))
  if (invalidPreviewDetails.length) {
    return renderOperationValidation('当前存在缺少五维字段的菲票，不能打印。', unit, pageKey)
  }
  const outputTicketCount = previewDetails.length
  const buttonMeta = getOperationButtonMeta(pageKey)
  const infoGrid = `
    <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <div class="rounded-lg border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">可打印单元号</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(unit.printableUnitNo)}</p></div>
      <div class="rounded-lg border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">单元类型</p><div class="mt-1">${renderUnitTypeBadge(unit.printableUnitType)}</div></div>
      <div class="rounded-lg border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">当前状态</p><div class="mt-1">${renderStatusBadge(unit.printableUnitStatus)}</div></div>
      <div class="rounded-lg border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">来源裁片单数</p><p class="mt-1 text-sm font-semibold text-slate-900">${formatCount(unit.sourceCutOrderCount)}</p></div>
    </div>
  `
  const operationSpecific = `
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">本次生成菲票数（张）</p><p class="mt-1 text-sm font-semibold text-slate-900">${formatCount(outputTicketCount)}</p></div>
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
      renderSectionCard('实际裁剪产出明细预览', '', buildOperationPreviewRows(previewDetails))
    }
    ${renderSectionCard('操作设置', '', renderOperationFields(pageKey))}
    ${renderSectionCard(
      '动作区',
      '',
      `<div class="flex flex-wrap gap-2"><button type="button" data-cutting-fei-action="${buttonMeta.action}" class="inline-flex min-h-10 items-center rounded-md border border-blue-600 bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700">${escapeHtml(buttonMeta.label)}</button><button type="button" data-nav="${escapeHtml(buildActionHref('fei-ticket-detail', unit))}" class="inline-flex min-h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">取消</button></div>`,
    )}
  `)
}

function renderStandaloneBackActions(row: FeiTicketWorkbenchRow | null): string {
  const detailHref = row ? buildStandaloneFeiTicketHref(row.ticketId) : getCanonicalCuttingPath('fei-tickets')
  return `<div class="flex flex-wrap gap-2"><button type="button" data-nav="${escapeHtml(getCanonicalCuttingPath('fei-tickets'))}" class="inline-flex min-h-10 items-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">返回部位菲票打印</button>${row ? `<button type="button" data-nav="${escapeHtml(detailHref)}" class="inline-flex min-h-10 items-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">返回详情</button>` : ''}</div>`
}

function renderSpreadingStandaloneBackActions(): string {
  return `<div class="flex flex-wrap gap-2"><button type="button" data-nav="${escapeHtml(getCanonicalCuttingPath('fei-tickets'))}" class="inline-flex min-h-10 items-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">返回部位菲票打印</button></div>`
}

function renderBindingStandaloneBackActions(): string {
  return `<div class="flex flex-wrap gap-2"><button type="button" data-nav="${escapeHtml(getCanonicalCuttingPath('binding-fei-tickets'))}" class="inline-flex min-h-10 items-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">返回捆条菲票打印</button></div>`
}

function renderStandaloneNotFound(ticketId: string): string {
  return renderPrintablePageShell(`
    ${renderCuttingPageHeader({
      key: 'fei-ticket-detail',
      canonicalPath: getCanonicalCuttingPath('fei-tickets'),
      aliases: [],
      menuGroupTitle: '裁后处理',
      pageTitle: '菲票详情',
      pageSubtitle: '',
      isPlaceholder: false,
      shortDescription: '',
    }, { actionsHtml: renderStandaloneBackActions(null) })}
    ${renderSectionCard('未找到菲票', '', `<p class="text-sm text-slate-600">没有找到 ${escapeHtml(ticketId)} 对应的菲票。</p>`)}
  `)
}

function isDetailPrinted(detail: FeiTicketWorkbenchRow): boolean {
  return detail.tab === 'PRINTED' || detail.tab === 'NEED_REPRINT'
}

function needsDetailPrint(detail: FeiTicketWorkbenchRow): boolean {
  return detail.tab === 'WAIT_FIRST' || detail.tab === 'NEED_REPRINT'
}

function renderDetailPrintedFlag(detail: FeiTicketWorkbenchRow): string {
  if (detail.tab === 'NEED_REPRINT') {
    return renderBadge('已打印，需补打', 'border border-amber-200 bg-amber-50 text-amber-700')
  }
  if (isDetailPrinted(detail)) {
    return renderBadge('已打印', 'border border-emerald-200 bg-emerald-50 text-emerald-700')
  }
  return renderBadge('未打印', 'border border-slate-200 bg-slate-100 text-slate-700')
}

function buildDetailPrintPreviewHref(detail: FeiTicketWorkbenchRow): string {
  const sourceId = detail.record?.ticketRecordId || detail.generated.feiTicketId || detail.generated.feiTicketNo || detail.ticketNo
  const documentType = detail.tab === 'WAIT_FIRST' ? 'FEI_TICKET_LABEL' : 'FEI_TICKET_REPRINT_LABEL'
  return `/fcs/print/preview?documentType=${documentType}&sourceType=FEI_TICKET_RECORD&sourceId=${encodeURIComponent(sourceId)}`
}

function buildSpreadingPrintPreviewHref(details: FeiTicketWorkbenchRow[], mode: 'all' | 'missing'): string {
  const printableDetails = mode === 'missing' ? details.filter(needsDetailPrint) : details
  const sourceIds = printableDetails
    .map((detail) => detail.record?.ticketRecordId || detail.generated.feiTicketId || detail.generated.feiTicketNo || detail.ticketNo)
    .filter(Boolean)
  const documentType = mode === 'missing' ? 'FEI_TICKET_REPRINT_LABEL' : 'FEI_TICKET_LABEL'
  return `/fcs/print/preview?documentType=${documentType}&sourceType=FEI_TICKET_RECORD&sourceId=${encodeURIComponent(sourceIds.join(','))}`
}

function renderSpreadingDetailHeaderActions(row: FeiTicketSpreadingWorkbenchRow): string {
  const missingDetails = row.detailRows.filter(needsDetailPrint)
  const allHref = buildSpreadingPrintPreviewHref(row.detailRows, 'all')
  const missingHref = buildSpreadingPrintPreviewHref(row.detailRows, 'missing')
  return `
    <div class="flex flex-wrap gap-2">
      <button type="button" data-nav="${escapeHtml(allHref)}" class="inline-flex min-h-9 items-center rounded-md border border-blue-600 bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-700">全部打印</button>
      <button type="button" ${missingDetails.length ? `data-nav="${escapeHtml(missingHref)}"` : 'disabled'} class="inline-flex min-h-9 items-center rounded-md border px-3 text-xs font-medium ${missingDetails.length ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50' : 'border-slate-200 bg-slate-100 text-slate-400'}">补打</button>
    </div>
  `
}

function renderSpreadingDetailSection(row: FeiTicketSpreadingWorkbenchRow): string {
  return `
    <section class="rounded-lg border bg-white shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <h2 class="text-sm font-semibold text-slate-900">该铺布单下全部部位明细</h2>
        ${renderSpreadingDetailHeaderActions(row)}
      </div>
      <div class="p-4">${renderSpreadingDetailRows(row)}</div>
    </section>
  `
}

function renderSpreadingDetailRows(row: FeiTicketSpreadingWorkbenchRow): string {
  return `
    <div class="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
      ${row.detailRows
        .map(
          (detail, index) => `
            <article class="grid gap-3 p-3 text-sm xl:grid-cols-[3.5rem_1.1fr_0.9fr_1fr_1.1fr_1.25fr_0.9fr_auto] xl:items-start">
              <div class="text-xs font-semibold text-slate-400">#${formatCount(index + 1)}</div>
              <div>
                <p class="text-xs text-slate-500">部位 / 尺码</p>
                <p class="mt-1 font-semibold text-slate-900">${escapeHtml(detail.partName || '待补部位')} / ${escapeHtml(detail.size || '待补尺码')}</p>
                <p class="mt-1 text-xs text-slate-500">${escapeHtml(detail.ticketNo)}</p>
              </div>
              <div>
                <p class="text-xs text-slate-500">裁片数量</p>
                <p class="mt-1 font-semibold text-slate-900">${formatCount(detail.pieceQty)} 片</p>
                <p class="mt-1 text-xs text-slate-500">${escapeHtml(detail.versionLabel)}</p>
              </div>
              <div>
                <p class="text-xs text-slate-500">部位裁片编号范围</p>
                <p class="mt-1 font-semibold text-slate-900">${escapeHtml(detail.pieceSequenceLabel || '不可生成')}</p>
              </div>
              <div>
                <p class="text-xs text-slate-500">来源裁片单</p>
                <p class="mt-1 font-semibold text-slate-900">${escapeHtml(detail.cutOrderNo || '待完善裁片单')}</p>
                <p class="mt-1 text-xs text-slate-500">${escapeHtml(detail.productionOrderNo || '待补生产单')}</p>
              </div>
              <div>
                <p class="text-xs text-slate-500">特殊工艺 / 承接工厂</p>
                <p class="mt-1 font-semibold text-slate-900">${escapeHtml(joinCompactLines(detail.specialCraftLines, 3))}</p>
                <p class="mt-1 text-xs text-slate-500">${escapeHtml(joinCompactLines(detail.receiverFactoryLines, 3))}</p>
              </div>
              <div>
                <p class="text-xs text-slate-500">是否已打印菲票</p>
                <div class="mt-1">${renderDetailPrintedFlag(detail)}</div>
              </div>
              <div class="flex flex-wrap gap-1.5 xl:justify-end">
                <button type="button" data-nav="${escapeHtml(buildDetailPrintPreviewHref(detail))}" class="inline-flex min-h-8 items-center rounded-md border border-blue-600 bg-blue-600 px-2.5 text-xs font-medium text-white hover:bg-blue-700">打印</button>
                <button type="button" data-nav="${escapeHtml(buildStandaloneFeiTicketHref(detail.ticketId))}" class="inline-flex min-h-8 items-center rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50">单条详情</button>
              </div>
            </article>
          `,
        )
        .join('')}
    </div>
  `
}

function renderSpreadingStandaloneDetailSections(row: FeiTicketSpreadingWorkbenchRow): string {
  return `
    ${renderSectionCard('铺布单菲票概况', '', `
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <div class="rounded-lg border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">铺布单</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(row.spreadingOrderNo)}</p></div>
        <div class="rounded-lg border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">唛架方案 / 编号</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(row.markerPlanNo)} / ${escapeHtml(row.markerNumber)}</p></div>
        <div class="rounded-lg border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">菲票明细</p><p class="mt-1 text-sm font-semibold text-slate-900">${formatCount(row.ticketCount)} 条</p></div>
        <div class="rounded-lg border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">裁片数量</p><p class="mt-1 text-sm font-semibold text-slate-900">${formatCount(row.totalPieceQty)} 片</p></div>
        <div class="rounded-lg border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">打印状态</p><div class="mt-1">${renderSpreadingLifecycleStatusBadge(row)}</div></div>
        <div class="rounded-lg border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">是否有特殊工艺</p><p class="mt-1 text-sm font-semibold text-slate-900">${row.hasSpecialCraft ? '是' : '无'}</p></div>
      </div>
    `)}
    ${renderSectionCard('来源与特殊工艺', '', `
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">生产单</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(joinCompactLines(row.productionOrderNos, 6))}</p></div>
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">裁片单</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(joinCompactLines(row.cutOrderNos, 6))}</p></div>
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">SPU / 颜色</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(joinCompactLines(row.spuCodes, 4))} / ${escapeHtml(joinCompactLines(row.colors, 4))}</p></div>
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">特殊工艺 / 承接工厂</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(joinCompactLines(row.specialCraftLines, 4))}</p><p class="mt-1 text-xs text-slate-500">${escapeHtml(joinCompactLines(row.receiverFactoryLines, 4))}</p></div>
      </div>
    `)}
    ${renderSpreadingDetailSection(row)}
  `
}

function buildFeiTicketPrintRecordLike(row: FeiTicketWorkbenchRow): Record<string, unknown> {
  if (!row.record) return row.generated
  return {
    ...row.generated,
    ...row.record,
    specialCrafts: row.generated.specialCrafts?.length ? row.generated.specialCrafts : row.record.specialCrafts,
    pieceSequenceRange: row.generated.pieceSequenceRange || row.record.pieceSequenceRange,
    pieceSequenceLabel: row.generated.pieceSequenceLabel || row.record.pieceSequenceLabel,
    applicableSkuCodes: row.generated.applicableSkuCodes,
    applicableSkuLabel: row.generated.applicableSkuLabel,
    assemblyGroupKey: row.generated.assemblyGroupKey,
    siblingPartTicketNos: row.generated.siblingPartTicketNos,
    garmentInstanceNo: row.generated.garmentInstanceNo,
    layerCount: row.generated.layerCount,
    businessSizeLabel: row.generated.businessSizeLabel,
    partQuantityPerGarment: row.generated.partQuantityPerGarment,
    materialIdentity: row.generated.materialIdentity,
    patternIdentity: row.generated.patternIdentity,
    markerNumber: row.generated.markerNumber,
    spreadingOrderNo: row.generated.spreadingOrderNo,
    sourceTechPackSpuCode: row.generated.sourceTechPackSpuCode,
  }
}

function renderStandaloneDetailSections(row: FeiTicketWorkbenchRow): string {
  const recordLike = buildFeiTicketPrintRecordLike(row)
  const printProjection = buildFeiTicketLabelPrintProjection(recordLike)
  const actualOutputBusinessLines = buildFeiActualOutputBusinessLines(row)
  const qrBusinessTraceLines = buildFeiQrBusinessTraceLines(row, printProjection)
  return `
    ${renderSectionCard('基本信息', '', `
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div class="rounded-lg border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">菲票号</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(row.ticketNo)}</p></div>
        <div class="rounded-lg border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">版本</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(row.versionLabel)}</p></div>
        <div class="rounded-lg border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">打印状态</p><div class="mt-1">${renderLifecycleStatusBadge(row)}</div></div>
        <div class="rounded-lg border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">生成时间 / 生成人</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(row.generated.issuedAt || '待补')} / ${escapeHtml(row.record?.printedBy || row.generated.qrPayload?.generatedAt ? '系统生成' : '待补')}</p></div>
      </div>
    `)}
    ${renderSectionCard('来源信息', '', `
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">生产单 / 裁片单</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(row.productionOrderNo)} / ${escapeHtml(row.cutOrderNo)}</p></div>
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">面料</p>${renderMaterialIdentityBlock({
          materialSku: row.generated.materialIdentity?.materialSku || row.generated.materialSku,
          materialLabel: row.generated.materialIdentity?.materialName || row.generated.materialSku,
          materialAlias: row.generated.materialIdentity?.materialAlias,
          materialImageUrl: row.generated.materialIdentity?.materialImageUrl,
          materialColor: row.generated.materialIdentity?.materialColor,
        }, { compact: true })}</div>
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">纸样</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(row.generated.patternIdentity?.patternFileName || '待补纸样')}</p><p class="mt-1 text-xs text-slate-500">${escapeHtml(`${row.generated.patternIdentity?.patternVersion || '待补版本'} / ${row.generated.patternIdentity?.effectiveWidthValue || ''}${row.generated.patternIdentity?.effectiveWidthUnit || ''}`)}</p></div>
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">唛架方案 / 唛架编号</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(row.markerPlanNo || '待补')} / ${escapeHtml(row.markerNumber || '待补')}</p></div>
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">铺布单</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(row.spreadingOrderNo || '待补')}</p></div>
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">裁剪产出来源</p>${actualOutputBusinessLines.length ? actualOutputBusinessLines.map((line, index) => `<p class="${index === 0 ? 'mt-1 text-sm font-semibold text-slate-900' : 'mt-1 text-xs text-slate-600'}">${escapeHtml(line)}</p>`).join('') : '<p class="mt-1 text-sm font-semibold text-slate-900">待补充裁剪产出</p>'}</div>
      </div>
    `)}
    ${renderSectionCard('裁片信息', '', `
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">颜色</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(row.color)}</p></div>
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">尺码</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(row.size)}</p></div>
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">部位</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(row.partName)}</p></div>
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">裁片数量</p><p class="mt-1 text-sm font-semibold text-slate-900">${formatCount(row.pieceQty)} 片</p></div>
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">部位裁片编号范围</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(row.pieceSequenceLabel)}</p></div>
      </div>
    `)}
    ${renderSectionCard('特殊工艺', '', `
      <div class="grid gap-3 md:grid-cols-2">
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">是否有特殊工艺</p><p class="mt-1 text-sm font-semibold text-slate-900">${row.hasSpecialCraft ? '是' : '无'}</p></div>
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">承接工厂</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(joinCompactLines(row.receiverFactoryLines, 4))}</p></div>
        <div class="md:col-span-2 rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">特殊工艺明细</p><div class="mt-2">${renderSpecialCraftSummary(row.generated.specialCrafts)}</div></div>
      </div>
    `)}
    ${renderSectionCard('二维码信息', '', `
      <div class="grid gap-4 md:grid-cols-[160px_1fr]">
        <div>
          ${renderRealQrPlaceholder({ value: printProjection.qrDisplayValue, size: 140, title: '菲票二维码', label: `菲票 ${row.ticketNo}` })}
          <p class="mt-2 text-center text-xs text-slate-500">二维码预览</p>
        </div>
        <div class="grid gap-3 md:grid-cols-2">
          <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">二维码版本</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(printProjection.qrPayload.payloadVersion)}</p></div>
          <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">业务类型</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(printProjection.qrPayload.qrType || '菲票')}</p></div>
          <div class="md:col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">业务追踪信息</p>${qrBusinessTraceLines.map((line, index) => `<p class="${index === 0 ? 'mt-1 text-sm font-semibold text-slate-900' : 'mt-1 text-xs text-slate-600'}">${escapeHtml(line)}</p>`).join('')}</div>
        </div>
      </div>
    `)}
    ${renderSectionCard('打印信息', '', `
      <div class="grid gap-3 md:grid-cols-2">
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">首次打印时间</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(row.firstPrintedAt || '未打印')}</p></div>
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">最近补打时间</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(row.latestReprintAt || '无')}</p></div>
      </div>
    `)}
	  `
}

function findBindingProcessOrderByRouteId(ticketId: string): BindingProcessOrder | null {
  const normalized = normalizeTicketRouteId(ticketId)
  const routeId = normalized.startsWith('binding:') ? normalized.replace(/^binding:/, '') : normalized
  return buildBindingProcessOrders().find((order) =>
    order.bindingOrderId === normalized
    || order.bindingOrderId === routeId
    || order.bindingOrderNo === routeId
    || order.bindingDetails.some((detail) =>
      detail.feiTicketId === routeId
      || detail.feiTicketNo === routeId
      || detail.detailId === routeId,
    ),
  ) || null
}

function renderBindingTicketPrintedFlag(detail: BindingStripWorkOrderDetail): string {
  if (detail.printStatus === '已打印') return renderBadge('已打印', 'border border-emerald-200 bg-emerald-50 text-emerald-700')
  return renderBadge('待打印', 'border border-slate-200 bg-slate-100 text-slate-700')
}

function renderBindingStandaloneDetailSections(order: BindingProcessOrder): string {
  const details = getPrintableBindingDetails(order)
  return `
    ${renderSectionCard('捆条加工单菲票概况', '', `
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <div class="rounded-lg border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">捆条加工单</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(order.bindingOrderNo)}</p></div>
        <div class="rounded-lg border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">来源生产单</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(order.sourceProductionOrderNo)}</p></div>
        <div class="rounded-lg border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">来源裁片单</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(order.sourceCutOrderNo)}</p></div>
        <div class="rounded-lg border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">应打菲票</p><p class="mt-1 text-sm font-semibold text-slate-900">${formatCount(details.length)} 张</p></div>
        <div class="rounded-lg border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">捆条需要长度</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(formatBindingLength(order.plannedTotalLength))}</p></div>
      </div>
    `)}
    ${renderSectionCard('物料与纸样', '', `
      <div class="grid gap-3 md:grid-cols-2">
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="mb-2 text-xs text-slate-500">物料</p>${renderMaterialIdentityBlock({
          materialSku: order.materialIdentity.materialSku,
          materialLabel: order.materialIdentity.materialName,
          materialAlias: order.materialIdentity.materialAlias,
          materialImageUrl: order.materialIdentity.materialImageUrl,
          materialColor: order.materialIdentity.materialColor,
        }, { compact: true })}</div>
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">纸样</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(order.patternIdentity.patternFileName || order.sourcePatternPackageName)}</p><p class="mt-1 text-xs text-slate-500">${escapeHtml(order.patternIdentity.patternVersion || '待补版本')}</p></div>
      </div>
    `)}
    ${renderSectionCard('菲票明细', '', `
      <div class="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
        ${details.map((detail, index) => `
          <article class="grid gap-3 p-3 text-sm xl:grid-cols-[3.5rem_1fr_0.9fr_0.9fr_1fr_1fr_0.9fr_auto] xl:items-start">
            <div class="text-xs font-semibold text-slate-400">#${formatCount(index + 1)}</div>
            <div>
              <p class="text-xs text-slate-500">菲票号</p>
              <p class="mt-1 font-semibold text-slate-900">${escapeHtml(detail.feiTicketNo)}</p>
            </div>
            <div>
              <p class="text-xs text-slate-500">捆条名称</p>
              <p class="mt-1 font-semibold text-slate-900">${escapeHtml(detail.bindingStripName)}</p>
            </div>
            <div>
              <p class="text-xs text-slate-500">捆条宽度</p>
              <p class="mt-1 font-semibold text-slate-900">${escapeHtml(`${detail.bindingWidth} cm`)}</p>
            </div>
            <div>
              <p class="text-xs text-slate-500">切割方式</p>
              <p class="mt-1 font-semibold text-slate-900">${escapeHtml(detail.cuttingMethod)}</p>
              <p class="mt-1 text-xs text-slate-500">${escapeHtml(detail.cuttingMethodIndonesian)}</p>
            </div>
            <div>
              <p class="text-xs text-slate-500">捆条需要 / 实际完成</p>
              <p class="mt-1 font-semibold text-slate-900">${escapeHtml(formatBindingLength(detail.plannedBindingLength))} / ${escapeHtml(detail.actualLength ? formatBindingLength(detail.actualLength) : '待回写')}</p>
              <p class="mt-1 text-xs text-slate-500">需要布料 ${escapeHtml(formatBindingLength(detail.requiredLength))} / 接收 ${escapeHtml(detail.receivedMaterialLength ? formatBindingLength(detail.receivedMaterialLength) : '待记录')}</p>
            </div>
            <div>
              <p class="text-xs text-slate-500">每卷长度 / 实切卷数</p>
              <p class="mt-1 font-semibold text-slate-900">${escapeHtml(`${resolveBindingDetailRollLength(detail) ? formatBindingLength(resolveBindingDetailRollLength(detail)) : '待记录'} / ${formatCount(detail.actualRollCount)} 卷`)}</p>
              <p class="mt-1 text-xs text-slate-500">切割长度 = 每卷长度 × 实切卷数</p>
            </div>
            <div>
              <p class="text-xs text-slate-500">切割长度</p>
              <p class="mt-1 font-semibold text-slate-900">${escapeHtml(`${detail.cuttingMethod} ${resolveBindingDetailCuttingLength(detail) ? formatBindingLength(resolveBindingDetailCuttingLength(detail)) : '待记录'}`)}</p>
            </div>
            <div>
              <p class="text-xs text-slate-500">打印状态</p>
              <div class="mt-1">${renderBindingTicketPrintedFlag(detail)}</div>
              <p class="mt-1 text-xs text-slate-500">${escapeHtml(detail.sufficiencyStatus)}${detail.shortageLength ? ` / 缺口 ${escapeHtml(formatBindingLength(detail.shortageLength))}` : ''}</p>
            </div>
            <div class="flex flex-wrap gap-1.5 xl:justify-end">
              <button type="button" data-nav="${escapeHtml(buildBindingSinglePrintPreviewHref(detail))}" class="inline-flex min-h-8 items-center rounded-md border border-blue-600 bg-blue-600 px-2.5 text-xs font-medium text-white hover:bg-blue-700">打印</button>
            </div>
          </article>
        `).join('')}
      </div>
    `)}
  `
}

function renderStandaloneDetailPage(ticketId: string): string {
  const bundle = getDataBundle()
  const bindingOrder = findBindingProcessOrderByRouteId(ticketId)
  if (bindingOrder && normalizeTicketRouteId(ticketId).startsWith('binding:')) {
    return renderPrintablePageShell(`
      ${renderCuttingPageHeader({
        key: 'fei-ticket-detail',
        canonicalPath: buildStandaloneBindingHref(bindingOrder),
        aliases: [],
        menuGroupTitle: '裁后处理',
        pageTitle: '捆条加工单菲票明细',
        pageSubtitle: '',
        isPlaceholder: false,
        shortDescription: '',
      }, { actionsHtml: renderBindingStandaloneBackActions() })}
      ${renderBindingStandaloneDetailSections(bindingOrder)}
    `)
  }
  const spreadingRow = findFeiSpreadingWorkbenchRow(bundle, ticketId)
  if (spreadingRow && normalizeTicketRouteId(ticketId).startsWith('spreading:')) {
    return renderPrintablePageShell(`
      ${renderCuttingPageHeader({
        key: 'fei-ticket-detail',
        canonicalPath: buildStandaloneSpreadingHref(spreadingRow),
        aliases: [],
        menuGroupTitle: '裁后处理',
        pageTitle: '铺布单菲票明细',
        pageSubtitle: '',
        isPlaceholder: false,
        shortDescription: '',
      }, { actionsHtml: renderSpreadingStandaloneBackActions() })}
      ${renderSpreadingStandaloneDetailSections(spreadingRow)}
    `)
  }
  const row = findFeiWorkbenchRow(bundle, ticketId)
  if (!row) return renderStandaloneNotFound(ticketId)
  return renderPrintablePageShell(`
    ${renderCuttingPageHeader({
      key: 'fei-ticket-detail',
      canonicalPath: buildStandaloneFeiTicketHref(row.ticketId),
      aliases: [],
      menuGroupTitle: '裁后处理',
      pageTitle: '菲票详情',
      pageSubtitle: '',
      isPlaceholder: false,
      shortDescription: '',
    }, { actionsHtml: renderStandaloneBackActions(row) })}
    ${renderStandaloneDetailSections(row)}
  `)
}

function renderTemplateSizeSelector(row: FeiTicketWorkbenchRow, activeSize: FeiTicketTemplateSize): string {
  const sizes: FeiTicketTemplateSize[] = ['10cm x 10cm', '15cm x 10cm']
  return `<div class="flex flex-wrap gap-2">${sizes.map((size) => `<button type="button" data-nav="${escapeHtml(`${buildStandaloneFeiTicketHref(row.ticketId, '/print')}?size=${encodeURIComponent(size)}`)}" class="inline-flex min-h-9 items-center rounded-md border px-3 text-sm font-medium ${size === activeSize ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}">${escapeHtml(size)}</button>`).join('')}</div>`
}

function stripFeiTicketLabelPrefix(value: string): string {
  return value.replace(/^(裁片数量|部位数量|编号范围|编号区间|本票裁片)：/, '')
}

function renderFeiTicketLabelCell(label: string, value: string, options: { className?: string; strong?: boolean } = {}): string {
  return `
    <div class="min-h-[11mm] border-b border-r border-slate-900 p-[1.4mm] ${options.className || ''}">
      <span class="text-[8px] font-medium text-slate-700">${escapeHtml(label)}</span>
      <strong class="ml-1 break-words ${options.strong ? 'text-[15px] font-black' : 'text-[10.5px] font-extrabold'} leading-tight text-slate-950">${escapeHtml(value || '—')}</strong>
    </div>
  `
}

function renderLabelPreviewCard(row: FeiTicketWorkbenchRow, templateSize: FeiTicketTemplateSize): string {
  const projection = buildFeiTicketLabelPrintProjection(buildFeiTicketPrintRecordLike(row), { templateSize })
  const maxPrintLines = templateSize === '15cm x 10cm' ? 4 : 2
  const specialCraftHandoverText = joinCompactLines(projection.specialCraftHandoverLines, maxPrintLines)
  const paperClass = templateSize === '15cm x 10cm' ? 'w-[150mm] min-h-[100mm]' : 'w-[100mm] min-h-[100mm]'
  const qrSize = templateSize === '15cm x 10cm' ? 132 : 116
  return `
    <div class="overflow-hidden rounded-lg border bg-slate-50 p-4">
      <div class="${paperClass} max-w-full rounded-md border border-slate-900 bg-white p-[2mm] text-slate-900 shadow-sm">
        <div class="border border-slate-900">
          <div class="border-b border-slate-900 px-[2mm] py-[2.2mm] text-[22px] font-black leading-none">
            ${escapeHtml(projection.titleLabel)}
          </div>
          <div class="grid ${templateSize === '15cm x 10cm' ? 'grid-cols-[1fr_36mm]' : 'grid-cols-[1fr_32mm]'}">
            <div class="grid grid-cols-2">
              ${renderFeiTicketLabelCell('面料 / 颜色', projection.materialWithColorLabel, { strong: true })}
              ${renderFeiTicketLabelCell('唛架编号+铺布单号', projection.markerSpreadingLabel, { strong: true })}
              ${renderFeiTicketLabelCell('部位', projection.partName, { strong: true })}
              ${renderFeiTicketLabelCell('尺码', projection.businessSizeLabel, { strong: true })}
              ${renderFeiTicketLabelCell('部位数量', stripFeiTicketLabelPrefix(projection.partQuantityLabel), { strong: true })}
              ${renderFeiTicketLabelCell('编号区间', stripFeiTicketLabelPrefix(projection.pieceSequenceLabel), { strong: true })}
              ${renderFeiTicketLabelCell('适用SKU', projection.applicableSkuLabel, { className: 'col-span-2' })}
              ${renderFeiTicketLabelCell('特殊工艺 / 承接工厂', specialCraftHandoverText, { className: 'col-span-2', strong: true })}
              ${renderFeiTicketLabelCell('菲票号', projection.feiTicketNo, { strong: true })}
              ${renderFeiTicketLabelCell('本票裁片', stripFeiTicketLabelPrefix(projection.actualCutPieceQtyLabel))}
            </div>
            <div class="flex flex-col items-center justify-center gap-[1.5mm] border-l border-slate-900 p-[1.5mm] text-center">
              <div class="flex min-h-[31mm] w-full items-center justify-center border border-slate-900">${renderRealQrPlaceholder({ value: projection.qrDisplayValue, size: qrSize, title: '菲票二维码', label: `菲票 ${row.ticketNo}` })}</div>
              <div class="text-[8px] font-semibold text-slate-800">菲票二维码</div>
              <div class="break-all text-[7px] leading-tight text-slate-500">${escapeHtml(projection.versionLabel)} / 扫码查看菲票</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
}

function renderStandalonePrintPage(ticketId: string): string {
  const bundle = getDataBundle()
  const row = findFeiWorkbenchRow(bundle, ticketId)
  if (!row) return renderStandaloneNotFound(ticketId)
  const requestedSize = getCurrentSearchParams().get('size')
  const templateSize: FeiTicketTemplateSize = requestedSize === '15cm x 10cm' ? '15cm x 10cm' : '10cm x 10cm'
  return renderPrintablePageShell(`
    ${renderCuttingPageHeader({
      key: 'fei-ticket-print',
      canonicalPath: buildStandaloneFeiTicketHref(row.ticketId, '/print'),
      aliases: [],
      menuGroupTitle: '裁后处理',
      pageTitle: '菲票打印',
      pageSubtitle: '',
      isPlaceholder: false,
      shortDescription: '',
    }, { actionsHtml: renderStandaloneBackActions(row) })}
    ${renderSectionCard('模板尺寸', '', renderTemplateSizeSelector(row, templateSize))}
    ${renderSectionCard('打印模板预览', '', renderLabelPreviewCard(row, templateSize))}
    ${renderSectionCard('打印内容核对', '', `
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">菲票号</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(row.ticketNo)}</p></div>
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">裁片数量</p><p class="mt-1 text-sm font-semibold text-slate-900">${formatCount(row.pieceQty)} 片</p></div>
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">编号范围</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(row.pieceSequenceLabel)}</p></div>
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">特殊工艺 / 承接工厂</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(joinCompactLines(row.specialCraftLines, 2))} / ${escapeHtml(joinCompactLines(row.receiverFactoryLines, 2))}</p></div>
      </div>
    `)}
    ${renderSectionCard('动作区', '', `<button type="button" data-nav="${escapeHtml(`/fcs/print/preview?documentType=FEI_TICKET_LABEL&sourceType=FEI_TICKET_RECORD&sourceId=${encodeURIComponent(row.record?.ticketRecordId || row.generated.feiTicketNo)}`)}" class="inline-flex min-h-10 items-center rounded-md border border-blue-600 bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700">打印</button>`)}
  `)
}

function renderImpactScope(row: FeiTicketWorkbenchRow, includeVoidFields = false): string {
  return `
    <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">菲票号</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(row.ticketNo)}</p></div>
      <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">裁片数量</p><p class="mt-1 text-sm font-semibold text-slate-900">${formatCount(row.pieceQty)} 片</p></div>
      <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">部位裁片编号范围</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(row.pieceSequenceLabel)}</p></div>
      <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">是否有特殊工艺</p><p class="mt-1 text-sm font-semibold text-slate-900">${row.hasSpecialCraft ? '是' : '无'}</p></div>
      <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">特殊工艺类型</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(joinCompactLines(row.specialCraftLines, 3))}</p></div>
      <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">承接工厂</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(joinCompactLines(row.receiverFactoryLines, 3))}</p></div>
      <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">是否已打印</p><p class="mt-1 text-sm font-semibold text-slate-900">${row.firstPrintedAt ? '是' : '否'}</p></div>
      <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">是否已入仓 / 已装袋 / 已进入交出记录</p><p class="mt-1 text-sm font-semibold text-slate-900">${includeVoidFields ? '当前阶段仅提示影响范围，未接入后续对象' : '如已有后续对象，需同步核对'}</p></div>
    </div>
  `
}

function renderReasonOptions(options: string[]): string {
  const currentPath = getCurrentPathname()
  const activeReason = getCurrentSearchParams().get('reason') || state.operationDraft.reason
  return `<div class="flex flex-wrap gap-2">${options
    .map((option) => {
      const selected = option === activeReason
      return `<button type="button" data-nav="${escapeHtml(buildRouteWithQuery(currentPath, { reason: option }))}" class="rounded-md border px-3 py-1.5 text-xs ${selected ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}">${escapeHtml(option)}</button>`
    })
    .join('')}</div>`
}

function syncStandaloneReasonControls(): void {
  const hasReason = Boolean(state.operationDraft.reason.trim())
  document.querySelectorAll<HTMLInputElement>('[data-cutting-fei-op-field="reason"]').forEach((input) => {
    if (input.value !== state.operationDraft.reason) input.value = state.operationDraft.reason
  })
  document
    .querySelectorAll<HTMLButtonElement>(
      '[data-cutting-fei-action="standalone-reprint-confirm"]',
    )
    .forEach((button) => {
      button.toggleAttribute('disabled', !hasReason)
      button.className = `inline-flex min-h-10 items-center rounded-md border px-4 text-sm font-medium ${
        hasReason
          ? 'border-blue-600 bg-blue-600 text-white hover:bg-blue-700'
          : 'border-slate-200 bg-slate-100 text-slate-400'
      }`
    })
}

function renderStandaloneReprintPage(ticketId: string): string {
  const bundle = getDataBundle()
  const row = findFeiWorkbenchRow(bundle, ticketId)
  if (!row) return renderStandaloneNotFound(ticketId)
  const currentReason = getCurrentSearchParams().get('reason') || state.operationDraft.reason
  const canSubmit = Boolean(currentReason.trim())
  return renderPrintablePageShell(`
    ${renderCuttingPageHeader({
      key: 'fei-ticket-reprint',
      canonicalPath: buildStandaloneFeiTicketHref(row.ticketId, '/reprint'),
      aliases: [],
      menuGroupTitle: '裁后处理',
      pageTitle: '菲票补打',
      pageSubtitle: '',
      isPlaceholder: false,
      shortDescription: '',
    }, { actionsHtml: renderStandaloneBackActions(row) })}
    ${renderSectionCard('影响范围', '', renderImpactScope(row))}
    ${renderSectionCard('补打原因', '', `
      ${renderReasonOptions(reprintReasonOptions)}
      <label class="mt-3 block space-y-1 text-sm text-slate-600">
        <span class="font-medium text-slate-700">补打原因（必填）</span>
        <input type="text" value="${escapeHtml(currentReason)}" data-cutting-fei-op-field="reason" class="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" placeholder="请选择或输入补打原因" />
      </label>
    `)}
    ${renderSectionCard('动作区', '', `<button type="button" data-cutting-fei-action="standalone-reprint-confirm" ${canSubmit ? '' : 'disabled'} class="inline-flex min-h-10 items-center rounded-md border px-4 text-sm font-medium ${canSubmit ? 'border-blue-600 bg-blue-600 text-white hover:bg-blue-700' : 'border-slate-200 bg-slate-100 text-slate-400'}">确认补打</button>`)}
  `)
}

function renderPrintableUnitPage(pageKey: PrintableActionPageKey): string {
  if (pageKey === 'fei-tickets') return renderListPage()
  if (pageKey === 'fei-ticket-detail' || pageKey === 'fei-ticket-printed') {
    return renderDetailOrChildPage(pageKey)
  }
  return renderOperationPage(pageKey as OperationPageKey)
}

function performPrintOperation(pageKey: Extract<OperationPageKey, 'fei-ticket-print' | 'fei-ticket-reprint'>): void {
  const bundle = getDataBundle()
  const unit = findUnit(bundle)
  if (!unit) return
  const detailView = buildPrintableUnitDetailViewModel({
    unit,
    cutOrderRows: bundle.cutOrderRows,
    materialPrepRows: bundle.materialPrepRows,
    markerPlanSources: bundle.markerPlanSources,
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
      : 'REPRINT'

  const params = getCurrentSearchParams()
  const result = executePrintableUnitPrint({
    unit,
    splitDetails: detailView.missingSplitDetails,
    cutOrderRows: bundle.cutOrderRows,
    materialPrepRows: bundle.materialPrepRows,
    markerPlanSources: bundle.markerPlanSources,
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

export function renderCraftCuttingFeiTicketsPage(): string {
  return renderPrintableUnitPage('fei-tickets')
}

export function renderCraftCuttingBindingFeiTicketsPage(): string {
  return renderPrintableUnitPage('fei-tickets')
}

export function renderCraftCuttingFeiTicketDetailPage(): string {
  const path = getCurrentPathname()
  const match = /^\/fcs\/craft\/cutting\/fei-tickets\/([^/]+)$/.exec(path)
  if (match) return renderStandaloneDetailPage(match[1])
  return renderPrintableUnitPage('fei-ticket-detail')
}

export function renderCraftCuttingFeiTicketPrintedPage(): string {
  return renderPrintableUnitPage('fei-ticket-printed')
}

export function renderCraftCuttingFeiTicketPrintPage(): string {
  const path = getCurrentPathname()
  const match = /^\/fcs\/craft\/cutting\/fei-tickets\/([^/]+)\/print$/.exec(path)
  if (match) return renderStandalonePrintPage(match[1])
  return renderPrintableUnitPage('fei-ticket-print')
}

export function renderCraftCuttingFeiTicketReprintPage(): string {
  const path = getCurrentPathname()
  const match = /^\/fcs\/craft\/cutting\/fei-tickets\/([^/]+)\/reprint$/.exec(path)
  if (match) return renderStandaloneReprintPage(match[1])
  return renderPrintableUnitPage('fei-ticket-reprint')
}

function resetFilters(): void {
  state.filters = { ...initialFilters }
}

export function handleCraftCuttingFeiTicketsEvent(target: Element): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-cutting-fei-field]')
  if (fieldNode) {
    const field = fieldNode.dataset.cuttingFeiField as keyof FeiTicketPrintFilters | undefined
    if (!field) return false
    const input = fieldNode as HTMLInputElement | HTMLSelectElement
    if (field === 'printObjectType') {
      state.filters = { ...state.filters, printObjectType: input.value as FeiPrintObjectType }
      return true
    }
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
    syncStandaloneReasonControls()
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

  if (action === 'set-operation-reason') {
    const reason = actionNode.dataset.reason || ''
    state.operationDraft = { ...state.operationDraft, reason }
    syncStandaloneReasonControls()
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

  if (action === 'confirm-reprint') {
    performPrintOperation('fei-ticket-reprint')
    return true
  }

  if (action === 'standalone-reprint-confirm') {
    const currentReason = (getCurrentSearchParams().get('reason') || state.operationDraft.reason).trim()
    if (!currentReason) return true
    const path = getCurrentPathname()
    const ticketId = path.split('/fei-tickets/')[1]?.split('/')[0] || ''
    const target = `/fcs/print/preview?documentType=FEI_TICKET_REPRINT_LABEL&sourceType=FEI_TICKET_RECORD&sourceId=${encodeURIComponent(ticketId)}&reason=${encodeURIComponent(currentReason)}`
    state.operationDraft = createDefaultOperationDraft()
    appStore.navigate(target)
    return true
  }

  return false
}
