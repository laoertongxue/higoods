import { cuttingOrderProgressRecords } from '../../../data/fcs/cutting/order-progress'
import { appStore } from '../../../state/store'
import { escapeHtml } from '../../../utils'
import { buildCuttablePoolViewModel } from './cuttable-pool-model'
import {
  buildSystemSeedFeiTicketLedger,
  buildFeiTicketsViewModel,
  buildReprintDraft,
  createFeiTicketDraft,
  createFeiTicketPrintJob,
  CUTTING_FEI_TICKET_DRAFTS_STORAGE_KEY,
  CUTTING_FEI_TICKET_PRINT_JOBS_STORAGE_KEY,
  CUTTING_FEI_TICKET_RECORDS_STORAGE_KEY,
  deserializeFeiTicketDraftsStorage,
  deserializeFeiTicketPrintJobsStorage,
  deserializeFeiTicketRecordsStorage,
  filterFeiPrintJobs,
  filterFeiTicketOwners,
  getFeiTicketStatusMeta,
  serializeFeiTicketDraftsStorage,
  serializeFeiTicketPrintJobsStorage,
  serializeFeiTicketRecordsStorage,
  type FeiTicketDraft,
  type FeiTicketLabelRecord,
  type FeiTicketOwnerFilters,
  type FeiTicketPrintJob,
  type FeiTicketJobFilters,
  type FeiTicketPrintJobStatus,
  type FeiTicketSeedLedger,
  type FeiTicketStatusKey,
  type FeiTicketsContext,
  type FeiTicketsPrefilter,
  type FeiTicketsViewModel,
  type OriginalCutOrderTicketOwner,
} from './fei-tickets-model'
import { CUTTING_TRANSFER_BAG_SELECTED_TICKET_IDS_STORAGE_KEY } from './transfer-bags-model'
import {
  FEI_QR_SCHEMA_NAME,
  FEI_QR_SCHEMA_VERSION,
  buildFeiQrCompatibilityMeta,
  buildFeiQrPayload,
  buildFeiQrPayloadSummary,
  buildReservedProcessBadges,
  buildTransferBagReservedBridge,
  serializeFeiQrPayload,
  validateFeiQrPayload,
} from './fei-qr-model'
import {
  buildBatchContextNavigationPayload,
  buildBatchPrintPreviewIndex,
  buildOwnerLevelPrintPayloadFromBatch,
  createDraftsFromBatchOwnerGroups,
  createPrintJobsFromBatchOwnerGroups,
  CUTTING_FEI_BATCH_PRINT_SESSIONS_STORAGE_KEY,
  deserializeFeiBatchPrintSessionsStorage,
  expandMergeBatchToOriginalTicketOwners,
  getFeiBatchAggregateStatusMeta,
  serializeFeiBatchPrintSessionsStorage,
  type FeiBatchExpansionResult,
  type FeiBatchPrintSession,
} from './fei-batch-print-model'
import {
  buildSystemSeedMergeBatches,
  CUTTING_MERGE_BATCH_LEDGER_STORAGE_KEY,
  deserializeMergeBatchStorage,
  type MergeBatchRecord,
} from './merge-batches-model'
import {
  CUTTING_MARKER_SPREADING_LEDGER_STORAGE_KEY,
  deserializeMarkerSpreadingStorage,
  createEmptyStore as createEmptyMarkerStore,
  type MarkerSpreadingStore,
} from './marker-spreading-model'
import { buildMaterialPrepViewModel, type MaterialPrepRow } from './material-prep-model'
import { getCanonicalCuttingMeta, getCanonicalCuttingPath, isCuttingAliasPath, renderCuttingPageHeader } from './meta'
import {
  buildOriginalCutOrderViewModel,
  formatOriginalOrderCurrency,
  type OriginalCutOrderRow,
} from './original-orders-model'
import {
  renderCompactKpiCard,
  renderStickyFilterShell,
  renderStickyTableScroller,
  renderWorkbenchFilterChip,
  renderWorkbenchSecondaryPanel,
  renderWorkbenchStateBar,
} from './layout.helpers'

type OwnerFilterField = 'keyword' | 'ticketStatus'
type JobFilterField = 'keyword' | 'status' | 'printedBy' | 'printedDate'
type DraftField = 'ticketCount' | 'note'
type FeedbackTone = 'success' | 'warning'

interface FeiTicketsFeedback {
  tone: FeedbackTone
  message: string
}

interface FeiDataBundle {
  mergeBatches: MergeBatchRecord[]
  markerStore: MarkerSpreadingStore
  originalRows: OriginalCutOrderRow[]
  materialPrepRows: MaterialPrepRow[]
  seedLedger: FeiTicketSeedLedger
  drafts: Record<string, FeiTicketDraft>
  ticketRecords: FeiTicketLabelRecord[]
  printJobs: FeiTicketPrintJob[]
  batchPrintSessions: FeiBatchPrintSession[]
  fullViewModel: FeiTicketsViewModel
  pageViewModel: FeiTicketsViewModel
  batchExpansion: FeiBatchExpansionResult | null
}

interface FeiTicketsPageState {
  drafts: Record<string, FeiTicketDraft>
  ticketRecords: FeiTicketLabelRecord[]
  printJobs: FeiTicketPrintJob[]
  batchPrintSessions: FeiBatchPrintSession[]
  ownerFilters: FeiTicketOwnerFilters
  jobFilters: FeiTicketJobFilters
  prefilter: FeiTicketsPrefilter | null
  querySignature: string
  activeOwnerId: string | null
  activePrintJobId: string | null
  activeBatchPrintSessionId: string | null
  draftTicketCount: string
  draftNote: string
  feedback: FeiTicketsFeedback | null
}

const initialOwnerFilters: FeiTicketOwnerFilters = {
  keyword: '',
  ticketStatus: 'ALL',
}

const initialJobFilters: FeiTicketJobFilters = {
  keyword: '',
  status: 'ALL',
  printedBy: '',
  printedDate: '',
}

const printJobStatusMeta: Record<FeiTicketPrintJobStatus, { label: string; className: string }> = {
  PRINTED: { label: '已打印', className: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
  REPRINTED: { label: '已重打', className: 'bg-violet-100 text-violet-700 border border-violet-200' },
  CANCELLED: { label: '已取消', className: 'bg-slate-100 text-slate-700 border border-slate-200' },
}

const state: FeiTicketsPageState = {
  drafts: {},
  ticketRecords: [],
  printJobs: [],
  batchPrintSessions: [],
  ownerFilters: { ...initialOwnerFilters },
  jobFilters: { ...initialJobFilters },
  prefilter: null,
  querySignature: '',
  activeOwnerId: null,
  activePrintJobId: null,
  activeBatchPrintSessionId: null,
  draftTicketCount: '',
  draftNote: '',
  feedback: null,
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

function nowText(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = `${now.getMonth() + 1}`.padStart(2, '0')
  const day = `${now.getDate()}`.padStart(2, '0')
  const hours = `${now.getHours()}`.padStart(2, '0')
  const minutes = `${now.getMinutes()}`.padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

function formatCount(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(Math.max(value, 0))
}

function renderBadge(label: string, className: string): string {
  return `<span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}">${escapeHtml(label)}</span>`
}

function buildKeywordIndex(values: Array<string | undefined>): string[] {
  return values
    .filter((value): value is string => Boolean(value && value.trim()))
    .map((value) => value.toLowerCase())
}

function mergeTicketRecords(seed: FeiTicketLabelRecord[], stored: FeiTicketLabelRecord[]): FeiTicketLabelRecord[] {
  const merged = new Map(seed.map((record) => [record.ticketRecordId, record]))
  stored.forEach((record) => merged.set(record.ticketRecordId, record))
  return Array.from(merged.values()).sort(
    (left, right) =>
      right.printedAt.localeCompare(left.printedAt, 'zh-CN') ||
      left.originalCutOrderNo.localeCompare(right.originalCutOrderNo, 'zh-CN') ||
      left.sequenceNo - right.sequenceNo,
  )
}

function mergePrintJobs(seed: FeiTicketPrintJob[], stored: FeiTicketPrintJob[]): FeiTicketPrintJob[] {
  const merged = new Map(seed.map((job) => [job.printJobId, job]))
  stored.forEach((job) => merged.set(job.printJobId, job))
  return Array.from(merged.values()).sort((left, right) => right.printedAt.localeCompare(left.printedAt, 'zh-CN'))
}

function readStoredDrafts(): Record<string, FeiTicketDraft> {
  try {
    return deserializeFeiTicketDraftsStorage(sessionStorage.getItem(CUTTING_FEI_TICKET_DRAFTS_STORAGE_KEY))
  } catch {
    return {}
  }
}

function readStoredTicketRecords(): FeiTicketLabelRecord[] {
  try {
    return deserializeFeiTicketRecordsStorage(localStorage.getItem(CUTTING_FEI_TICKET_RECORDS_STORAGE_KEY))
  } catch {
    return []
  }
}

function readStoredPrintJobs(): FeiTicketPrintJob[] {
  try {
    return deserializeFeiTicketPrintJobsStorage(localStorage.getItem(CUTTING_FEI_TICKET_PRINT_JOBS_STORAGE_KEY))
  } catch {
    return []
  }
}

function readStoredBatchPrintSessions(): FeiBatchPrintSession[] {
  try {
    return deserializeFeiBatchPrintSessionsStorage(localStorage.getItem(CUTTING_FEI_BATCH_PRINT_SESSIONS_STORAGE_KEY)).sort(
      (left, right) => right.createdAt.localeCompare(left.createdAt, 'zh-CN'),
    )
  } catch {
    return []
  }
}

function persistDrafts(drafts: Record<string, FeiTicketDraft>): void {
  state.drafts = drafts
  sessionStorage.setItem(CUTTING_FEI_TICKET_DRAFTS_STORAGE_KEY, serializeFeiTicketDraftsStorage(drafts))
}

function persistTicketRecords(records: FeiTicketLabelRecord[]): void {
  state.ticketRecords = records
  localStorage.setItem(CUTTING_FEI_TICKET_RECORDS_STORAGE_KEY, serializeFeiTicketRecordsStorage(records))
}

function persistPrintJobs(printJobs: FeiTicketPrintJob[]): void {
  state.printJobs = printJobs
  localStorage.setItem(CUTTING_FEI_TICKET_PRINT_JOBS_STORAGE_KEY, serializeFeiTicketPrintJobsStorage(printJobs))
}

function persistBatchPrintSessions(sessions: FeiBatchPrintSession[]): void {
  const ordered = [...sessions].sort((left, right) => right.createdAt.localeCompare(left.createdAt, 'zh-CN'))
  state.batchPrintSessions = ordered
  localStorage.setItem(
    CUTTING_FEI_BATCH_PRINT_SESSIONS_STORAGE_KEY,
    serializeFeiBatchPrintSessionsStorage(ordered),
  )
}

function readStoredMarkerLedger(): MarkerSpreadingStore {
  try {
    return deserializeMarkerSpreadingStorage(localStorage.getItem(CUTTING_MARKER_SPREADING_LEDGER_STORAGE_KEY))
  } catch {
    return createEmptyMarkerStore()
  }
}

function readStoredMergeBatches(): MergeBatchRecord[] {
  try {
    return deserializeMergeBatchStorage(localStorage.getItem(CUTTING_MERGE_BATCH_LEDGER_STORAGE_KEY))
  } catch {
    return []
  }
}

function getMergeBatchLedger(): MergeBatchRecord[] {
  const cuttablePoolView = buildCuttablePoolViewModel(cuttingOrderProgressRecords)
  const systemSeed = buildSystemSeedMergeBatches(Object.values(cuttablePoolView.itemsById))
  const merged = new Map(systemSeed.map((batch) => [batch.mergeBatchId, batch]))
  readStoredMergeBatches().forEach((batch) => merged.set(batch.mergeBatchId, batch))
  return Array.from(merged.values()).sort(
    (left, right) =>
      right.updatedAt.localeCompare(left.updatedAt, 'zh-CN') ||
      right.createdAt.localeCompare(left.createdAt, 'zh-CN') ||
      right.mergeBatchNo.localeCompare(left.mergeBatchNo, 'zh-CN'),
  )
}

function parsePrefilterFromPath(): FeiTicketsPrefilter | null {
  const params = getCurrentSearchParams()
  const prefilter: FeiTicketsPrefilter = {}

  const entries: Array<[keyof FeiTicketsPrefilter, string | null]> = [
    ['originalCutOrderId', params.get('originalCutOrderId')],
    ['originalCutOrderNo', params.get('originalCutOrderNo')],
    ['mergeBatchId', params.get('mergeBatchId')],
    ['mergeBatchNo', params.get('mergeBatchNo')],
    ['productionOrderNo', params.get('productionOrderNo')],
    ['printJobNo', params.get('printJobNo')],
    ['ticketStatus', params.get('ticketStatus')],
    ['ticketStatus', params.get('ownerStatus')],
  ]

  entries.forEach(([key, value]) => {
    if (!value) return
    if (key === 'ticketStatus') {
      const validStatus = ['NOT_GENERATED', 'DRAFT', 'PARTIAL_PRINTED', 'PRINTED', 'REPRINTED', 'PENDING_SUPPLEMENT'] as const
      if (validStatus.includes(value as FeiTicketStatusKey)) {
        prefilter.ticketStatus = value as FeiTicketStatusKey
      }
      return
    }
    prefilter[key] = value as never
  })

  return Object.keys(prefilter).length ? prefilter : null
}

function getDataBundle(): FeiDataBundle {
  const mergeBatches = getMergeBatchLedger()
  const markerStore = readStoredMarkerLedger()
  const originalRows = buildOriginalCutOrderViewModel(cuttingOrderProgressRecords, mergeBatches).rows
  const materialPrepRows = buildMaterialPrepViewModel(cuttingOrderProgressRecords, mergeBatches).rows
  const seedLedger = buildSystemSeedFeiTicketLedger({
    originalRows,
    materialPrepRows,
    mergeBatches,
    markerStore,
  })
  const ticketRecords = mergeTicketRecords(seedLedger.ticketRecords, state.ticketRecords)
  const printJobs = mergePrintJobs(seedLedger.printJobs, state.printJobs)
  const batchPrintSessions = readStoredBatchPrintSessions()

  const fullViewModel = buildFeiTicketsViewModel({
    originalRows,
    materialPrepRows,
    mergeBatches,
    markerStore,
    ticketRecords,
    printJobs,
    drafts: state.drafts,
    prefilter: null,
  })

  const pageViewModel = buildFeiTicketsViewModel({
    originalRows,
    materialPrepRows,
    mergeBatches,
    markerStore,
    ticketRecords,
    printJobs,
    drafts: state.drafts,
    prefilter: state.prefilter,
  })

  const batchExpansion = expandMergeBatchToOriginalTicketOwners(
    pageViewModel.context,
    pageViewModel.owners,
    fullViewModel.printJobs,
  )

  return {
    mergeBatches,
    markerStore,
    originalRows,
    materialPrepRows,
    seedLedger,
    drafts: state.drafts,
    ticketRecords,
    printJobs,
    batchPrintSessions,
    fullViewModel,
    pageViewModel,
    batchExpansion,
  }
}

function findOwnerByPrefilter(viewModel: FeiTicketsViewModel, prefilter: FeiTicketsPrefilter | null): OriginalCutOrderTicketOwner | null {
  if (!prefilter) return null
  if (prefilter.originalCutOrderId) {
    return viewModel.owners.find((owner) => owner.originalCutOrderId === prefilter.originalCutOrderId) ?? null
  }
  if (prefilter.originalCutOrderNo) {
    return viewModel.owners.find((owner) => owner.originalCutOrderNo === prefilter.originalCutOrderNo) ?? null
  }
  if (prefilter.productionOrderNo) {
    return viewModel.owners.find((owner) => owner.productionOrderNo === prefilter.productionOrderNo) ?? null
  }
  return null
}

function findPrintJobByPrefilter(printJobs: FeiTicketPrintJob[], prefilter: FeiTicketsPrefilter | null): FeiTicketPrintJob | null {
  if (!prefilter?.printJobNo) return null
  return printJobs.find((job) => job.printJobNo === prefilter.printJobNo) ?? null
}

function findBatchPrintSessionByPrefilter(
  batchPrintSessions: FeiBatchPrintSession[],
  batchPrintSessionId: string | null,
): FeiBatchPrintSession | null {
  if (!batchPrintSessionId) return null
  return batchPrintSessions.find((session) => session.batchPrintSessionId === batchPrintSessionId) ?? null
}

function syncDraftEditor(owner: OriginalCutOrderTicketOwner | null): void {
  if (!owner) {
    state.draftTicketCount = ''
    state.draftNote = ''
    return
  }

  const existingDraft = state.drafts[owner.originalCutOrderId]
  if (existingDraft) {
    state.draftTicketCount = String(existingDraft.ticketCount)
    state.draftNote = existingDraft.note
    return
  }

  state.draftTicketCount = String(owner.plannedTicketQty)
  state.draftNote = `${owner.originalCutOrderNo} 菲票打印草稿。`
}

function syncStateFromPath(): void {
  const pathname = appStore.getState().pathname
  if (state.querySignature === pathname) return

  state.drafts = readStoredDrafts()
  state.ticketRecords = readStoredTicketRecords()
  state.printJobs = readStoredPrintJobs()
  state.batchPrintSessions = readStoredBatchPrintSessions()
  state.prefilter = parsePrefilterFromPath()
  state.querySignature = pathname
  state.feedback = null

  const bundle = getDataBundle()
  const matchedOwner = findOwnerByPrefilter(bundle.pageViewModel, state.prefilter)
  const matchedPrintJob = findPrintJobByPrefilter(bundle.pageViewModel.printJobs, state.prefilter)
  const batchPrintSessionId = getCurrentSearchParams().get('batchPrintSessionId')
  const matchedBatchSession = findBatchPrintSessionByPrefilter(bundle.batchPrintSessions, batchPrintSessionId)

  state.activeOwnerId = matchedOwner?.id ?? bundle.pageViewModel.owners[0]?.id ?? null
  state.activePrintJobId = matchedPrintJob?.printJobId ?? bundle.pageViewModel.printJobs[0]?.printJobId ?? null
  state.activeBatchPrintSessionId =
    matchedBatchSession?.batchPrintSessionId ?? bundle.batchPrintSessions[0]?.batchPrintSessionId ?? null
  syncDraftEditor(state.activeOwnerId ? bundle.pageViewModel.ownersById[state.activeOwnerId] ?? null : null)
}

function getDisplayOwners(bundle = getDataBundle()): OriginalCutOrderTicketOwner[] {
  return filterFeiTicketOwners(bundle.pageViewModel.owners, state.ownerFilters, state.prefilter)
}

function getDisplayPrintJobs(bundle = getDataBundle()): FeiTicketPrintJob[] {
  const jobs = filterFeiPrintJobs(bundle.pageViewModel.printJobs, state.jobFilters)
  if (state.prefilter?.printJobNo) {
    return jobs.filter((job) => job.printJobNo === state.prefilter?.printJobNo)
  }
  return jobs
}

function getActiveOwner(bundle = getDataBundle()): OriginalCutOrderTicketOwner | null {
  if (!state.activeOwnerId) return null
  return bundle.pageViewModel.ownersById[state.activeOwnerId] ?? bundle.fullViewModel.ownersById[state.activeOwnerId] ?? null
}

function getActivePrintJob(bundle = getDataBundle()): FeiTicketPrintJob | null {
  if (!state.activePrintJobId) return null
  return bundle.pageViewModel.printJobs.find((job) => job.printJobId === state.activePrintJobId) ??
    bundle.fullViewModel.printJobs.find((job) => job.printJobId === state.activePrintJobId) ??
    null
}

function getContextBatchPrintSessions(bundle = getDataBundle()): FeiBatchPrintSession[] {
  const expansion = bundle.batchExpansion
  if (!expansion) return []
  return bundle.batchPrintSessions.filter(
    (session) =>
      session.mergeBatchId === expansion.mergeBatchId || session.mergeBatchNo === expansion.mergeBatchNo,
  )
}

function getActiveBatchPrintSession(bundle = getDataBundle()): FeiBatchPrintSession | null {
  const sessions = getContextBatchPrintSessions(bundle)
  if (!sessions.length) return null
  if (state.activeBatchPrintSessionId) {
    const matched = sessions.find((session) => session.batchPrintSessionId === state.activeBatchPrintSessionId)
    if (matched) return matched
  }
  return sessions[0] ?? null
}

function getOwnerPrintJobs(owner: OriginalCutOrderTicketOwner, bundle = getDataBundle()): FeiTicketPrintJob[] {
  return bundle.fullViewModel.printJobs.filter((job) => job.originalCutOrderIds.includes(owner.originalCutOrderId))
}

function getOwnerTicketRecords(owner: OriginalCutOrderTicketOwner, bundle = getDataBundle()): FeiTicketLabelRecord[] {
  return bundle.fullViewModel.ticketRecords.filter((record) => record.originalCutOrderId === owner.originalCutOrderId)
}

function getLatestOwnerTicketRecord(owner: OriginalCutOrderTicketOwner, bundle = getDataBundle()): FeiTicketLabelRecord | null {
  return getOwnerTicketRecords(owner, bundle)
    .sort(
      (left, right) =>
        right.printedAt.localeCompare(left.printedAt, 'zh-CN') ||
        right.createdAt.localeCompare(left.createdAt, 'zh-CN') ||
        right.sequenceNo - left.sequenceNo,
    )[0] ?? null
}

function getQrPreviewForRecord(
  owner: OriginalCutOrderTicketOwner,
  record: FeiTicketLabelRecord,
  bundle = getDataBundle(),
): {
  payloadJson: string
  serializedValue: string
  validationText: string
  compatibilityText: string
  summaryRows: Array<{ label: string; value: string }>
  reservedProcessHtml: string
  reservedTraceRows: Array<{ label: string; value: string }>
  bridgeRows: Array<{ label: string; value: string }>
} {
  const printJob =
    bundle.fullViewModel.printJobs.find((job) => job.printJobId === record.sourcePrintJobId) ??
    bundle.pageViewModel.printJobs.find((job) => job.printJobId === record.sourcePrintJobId) ??
    null
  const payload = buildFeiQrPayload({
    ticketRecord: record,
    owner,
    printJob,
  })
  const summary = buildFeiQrPayloadSummary(payload)
  const validation = validateFeiQrPayload(payload)
  const compatibility = buildFeiQrCompatibilityMeta(record)
  const serializedValue = record.qrSerializedValue || serializeFeiQrPayload(payload)
  const transferBridge = buildTransferBagReservedBridge(payload)
  const reservedProcessHtml = buildReservedProcessBadges(payload)
    .map(
      (badge) => `
        <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}" title="${escapeHtml(badge.detailText)}">
          ${escapeHtml(badge.label)}
        </span>
      `,
    )
    .join('')

  return {
    payloadJson: JSON.stringify(payload, null, 2),
    serializedValue,
    validationText: validation.isValid
      ? `结构校验通过 · owner=${payload.ownerType} · schema=${payload.schemaName}@${payload.schemaVersion}`
      : `结构校验未通过：${validation.warnings.join('；') || '请检查 owner / sourceContext / baseBiz 字段。'}`,
    compatibilityText: compatibility.compatibilityNote,
    summaryRows: [
      { label: 'schemaName', value: payload.schemaName },
      { label: 'schemaVersion', value: payload.schemaVersion },
      { label: 'ownerType', value: payload.ownerType },
      { label: 'ownerId', value: payload.ownerId },
      { label: 'sourceContext', value: payload.sourceContext.sourceContextType === 'merge-batch' ? `来自批次 ${payload.sourceContext.sourceMergeBatchNo || '待补批次号'}` : '原始单上下文' },
      { label: '二维码基础值', value: payload.ticket.qrBaseValue },
    ],
    reservedTraceRows: [
      { label: 'reservedTransferBagBinding', value: payload.reservedTrace.reservedTransferBagBinding.enabled ? '已启用' : '已预留' },
      { label: 'reservedScanCheckpoint', value: payload.reservedTrace.reservedScanCheckpoint.enabled ? '已启用' : '已预留' },
    ],
    bridgeRows: [
      { label: 'ticketNo', value: transferBridge.ticketNo },
      { label: 'originalCutOrderNo', value: transferBridge.originalCutOrderNo },
      { label: 'ownerType', value: transferBridge.ownerType },
      { label: 'qrSchemaVersion', value: transferBridge.qrSchemaVersion },
      { label: 'qrBaseValue', value: transferBridge.qrBaseValue },
    ],
    reservedProcessHtml,
  }
}

function getCurrentDraft(owner: OriginalCutOrderTicketOwner | null): FeiTicketDraft | null {
  if (!owner) return null
  return state.drafts[owner.originalCutOrderId] ?? null
}

function setFeedback(tone: FeedbackTone, message: string): void {
  state.feedback = { tone, message }
}

function clearFeedback(): void {
  state.feedback = null
}

function getPrefilterLabels(): string[] {
  const labels: string[] = []
  const prefilter = state.prefilter
  if (!prefilter) return labels

  if (prefilter.originalCutOrderNo) labels.push(`预筛：原始裁片单 ${prefilter.originalCutOrderNo}`)
  if (prefilter.mergeBatchNo) labels.push(`预筛：批次 ${prefilter.mergeBatchNo}`)
  if (prefilter.productionOrderNo) labels.push(`预筛：生产单 ${prefilter.productionOrderNo}`)
  if (prefilter.printJobNo) labels.push(`预筛：作业 ${prefilter.printJobNo}`)
  if (prefilter.ticketStatus) labels.push(`预筛：票据状态 ${getFeiTicketStatusMeta(prefilter.ticketStatus).label}`)

  return labels
}

function getFilterLabels(): string[] {
  const labels: string[] = []
  if (state.ownerFilters.keyword) labels.push(`主体关键词：${state.ownerFilters.keyword}`)
  if (state.ownerFilters.ticketStatus !== 'ALL') labels.push(`主体状态：${getFeiTicketStatusMeta(state.ownerFilters.ticketStatus).label}`)
  if (state.jobFilters.keyword) labels.push(`作业关键词：${state.jobFilters.keyword}`)
  if (state.jobFilters.status !== 'ALL') labels.push(`作业状态：${printJobStatusMeta[state.jobFilters.status].label}`)
  if (state.jobFilters.printedBy) labels.push(`打印人：${state.jobFilters.printedBy}`)
  if (state.jobFilters.printedDate) labels.push(`打印日期：${state.jobFilters.printedDate}`)
  return labels
}

function renderFeedbackBar(): string {
  if (!state.feedback) return ''
  const className =
    state.feedback.tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : 'border-amber-200 bg-amber-50 text-amber-700'

  return `
    <section class="flex items-center justify-between rounded-lg border px-4 py-3 text-sm ${className}">
      <span>${escapeHtml(state.feedback.message)}</span>
      <button type="button" class="rounded-md px-2 py-1 text-xs hover:bg-black/5" data-cutting-fei-action="clear-feedback">关闭</button>
    </section>
  `
}

function renderSummaryCard(label: string, value: string | number, hint: string): string {
  return `
    <article class="rounded-lg border bg-muted/10 px-3 py-2">
      <p class="text-xs text-muted-foreground">${escapeHtml(label)}</p>
      <p class="mt-1 text-base font-semibold">${escapeHtml(String(value))}</p>
      <p class="mt-1 text-[11px] text-muted-foreground">${escapeHtml(hint)}</p>
    </article>
  `
}

function renderPrefilterBar(): string {
  const labels = getPrefilterLabels()
  if (!labels.length) return ''
  return renderWorkbenchStateBar({
    summary: '当前预筛条件',
    chips: labels.map((label) => renderWorkbenchFilterChip(label, 'data-cutting-fei-action="clear-prefilter"', 'amber')),
    clearAttrs: 'data-cutting-fei-action="clear-prefilter"',
  })
}

function renderFilterStateBar(): string {
  const labels = getFilterLabels()
  if (!labels.length) return ''
  return renderWorkbenchStateBar({
    summary: '当前筛选条件',
    chips: labels.map((label) => renderWorkbenchFilterChip(label, 'data-cutting-fei-action="clear-filters"', 'blue')),
    clearAttrs: 'data-cutting-fei-action="clear-filters"',
  })
}

function buildHeaderActions(bundle: FeiDataBundle): string {
  const context = bundle.pageViewModel.context
  const activeOwner = getActiveOwner(bundle)
  const activeOwnerPayload = activeOwner?.navigationPayload
  const transferRoute = buildRouteWithQuery(
    getCanonicalCuttingPath('transfer-bags'),
    activeOwnerPayload?.transferBags ?? (context?.mergeBatchNo ? { mergeBatchNo: context.mergeBatchNo } : undefined),
  )
  const summaryRoute = buildRouteWithQuery(
    getCanonicalCuttingPath('summary'),
    activeOwnerPayload?.summary ?? (context?.mergeBatchNo ? { mergeBatchNo: context.mergeBatchNo } : undefined),
  )

  return `
    <div class="flex flex-wrap items-center gap-2">
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-fei-action="go-back-context">返回裁片单 / 批次</button>
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-fei-action="go-summary" data-nav-target="${escapeHtml(summaryRoute)}">查看裁剪总结</button>
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-fei-action="go-transfer-bags" data-nav-target="${escapeHtml(transferRoute)}" ${activeOwner || context ? '' : 'disabled'}>去周转口袋 / 车缝交接</button>
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-fei-action="refresh-ledger">刷新打印台账</button>
    </div>
  `
}

function renderStatsCards(bundle: FeiDataBundle): string {
  const stats = bundle.pageViewModel.stats
  return `
    <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
      ${renderCompactKpiCard('原始裁片单票据主体数', stats.ownerCount, '当前筛选范围', 'text-slate-900')}
      ${renderCompactKpiCard('已生成菲票数', stats.generatedTicketCount, '按原始裁片单建议票数汇总', 'text-blue-600')}
      ${renderCompactKpiCard('已打印菲票数', stats.printedTicketCount, '含首轮与重打记录', 'text-emerald-600')}
      ${renderCompactKpiCard('待打印草稿数', stats.draftCount, '仅统计当前上下文草稿', 'text-amber-600')}
      ${renderCompactKpiCard('打印作业数', stats.printJobCount, '原型期本地台账', 'text-violet-600')}
      ${renderCompactKpiCard('重打次数', stats.reprintCount, '单张票据重打累计', 'text-rose-600')}
    </section>
  `
}

function renderContextSummary(bundle: FeiDataBundle): string {
  const context = bundle.pageViewModel.context
  if (!context) {
    return `
      <section class="rounded-lg border bg-card p-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="text-sm font-semibold text-foreground">当前票据上下文</h2>
            <p class="mt-1 text-xs text-muted-foreground">
              当前未锁定具体原始裁片单或合并裁剪批次，可直接在下方按原始裁片单查看、生成草稿并打印。
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-fei-action="go-original-orders-index">去裁片单（原始单）</button>
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-fei-action="go-merge-batches-index">去合并裁剪批次</button>
          </div>
        </div>
      </section>
    `
  }

  const contextBadgeClass =
    context.contextType === 'merge-batch'
      ? 'bg-violet-100 text-violet-700 border border-violet-200'
      : 'bg-blue-100 text-blue-700 border border-blue-200'
  const activeOwner = getActiveOwner(bundle)
  const activeBatchGroup =
    context.contextType === 'merge-batch' && activeOwner
      ? bundle.batchExpansion?.ownerGroups.find((group) => group.originalCutOrderId === activeOwner.originalCutOrderId) ?? null
      : null
  const singleOwnerRoute =
    activeOwner && context.contextType === 'merge-batch' && activeBatchGroup
      ? buildRouteWithQuery(getCanonicalCuttingPath('fei-tickets'), {
          ...buildOwnerLevelPrintPayloadFromBatch(activeBatchGroup, context),
        })
      : ''

  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="space-y-2">
          <div class="flex flex-wrap items-center gap-2">
            ${renderBadge(context.contextType === 'merge-batch' ? '合并裁剪批次上下文' : '原始裁片单上下文', contextBadgeClass)}
            ${
              context.contextType === 'merge-batch'
                ? '<span class="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">菲票归属仍回落原始裁片单</span>'
                : ''
            }
          </div>
          <p class="text-sm text-foreground">
            ${escapeHtml(
              context.contextType === 'merge-batch'
                ? `当前来自批次 ${context.mergeBatchNo || '待补批次号'}，本步仅在批次上下文下按原始裁片单查看 / 打印。`
                : `当前聚焦原始裁片单 ${context.originalCutOrderNos[0] || '待补编号'}。`,
            )}
          </p>
          <div class="grid gap-2 text-xs text-muted-foreground md:grid-cols-2 xl:grid-cols-5">
            <p>原始裁片单：${escapeHtml(context.originalCutOrderNos.join(' / ') || '待补')}</p>
            <p>来源生产单：${escapeHtml(context.productionOrderNos.join(' / ') || '待补')}</p>
            <p>款号 / SPU：${escapeHtml(context.styleCode || context.spuCode || '待补')}</p>
            <p>款式名称：${escapeHtml(context.styleName || '待补')}</p>
            <p>面料摘要：${escapeHtml(context.materialSkuSummary || '待补')}</p>
          </div>
        </div>
        <div class="flex flex-wrap gap-2">
          ${context.contextType === 'merge-batch' && activeOwner ? `<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-fei-action="go-single-owner-context" data-nav-target="${escapeHtml(singleOwnerRoute)}">按原始裁片单查看</button>` : ''}
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-fei-action="go-original-orders">查看原始裁片单</button>
          ${context.contextType === 'merge-batch' ? '<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-fei-action="go-merge-batches">返回批次</button>' : ''}
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-fei-action="clear-prefilter">清除上下文</button>
        </div>
      </div>
    </section>
  `
}

function renderQrSchemaSummary(bundle: FeiDataBundle): string {
  const context = bundle.pageViewModel.context
  const activeOwner = getActiveOwner(bundle)
  const previewOwner = activeOwner || bundle.pageViewModel.owners[0] || null
  const previewRecord = previewOwner ? getLatestOwnerTicketRecord(previewOwner, bundle) : null
  const preview = previewOwner && previewRecord ? getQrPreviewForRecord(previewOwner, previewRecord, bundle) : null

  return `
    <section class="rounded-lg border bg-card">
      <div class="border-b px-4 py-3">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-sm font-semibold">二维码 schema / payload 摘要区</h2>
            <p class="mt-1 text-xs text-muted-foreground">二维码 owner 固定回落到单张 ticketRecord / 原始裁片单；merge-batch 仅作为 sourceContext 出现在 payload 中。</p>
          </div>
          <div class="flex items-center gap-2">
            ${renderBadge(FEI_QR_SCHEMA_NAME, 'bg-slate-100 text-slate-700 border border-slate-200')}
            ${renderBadge(`v${FEI_QR_SCHEMA_VERSION}`, 'bg-blue-100 text-blue-700 border border-blue-200')}
          </div>
        </div>
      </div>
      <div class="grid gap-4 p-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div class="space-y-3">
          <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            ${renderSummaryCard('schemaName', FEI_QR_SCHEMA_NAME, '二维码结构冻结名称')}
            ${renderSummaryCard('schemaVersion', FEI_QR_SCHEMA_VERSION, '本步冻结为 1.0.0')}
            ${renderSummaryCard('ownerType', 'original-cut-order', '二维码 owner 永远回落原始裁片单')}
            ${renderSummaryCard('当前上下文', context?.contextType === 'merge-batch' ? 'merge-batch' : 'original-order', 'merge-batch 仅作为 sourceContext')}
            ${renderSummaryCard('当前票据数', bundle.pageViewModel.ticketRecords.length, '当前页面上下文内单张票据记录')}
            ${renderSummaryCard('reserved slots', '4 + 2', '4 类工艺扩展 + 2 类 trace 保留槽位')}
          </div>
          <div class="rounded-lg border bg-muted/10 p-3 text-sm text-muted-foreground">
            <p>基础 payload 固定分层为：ticket / sourceContext / baseBiz / reservedProcess / reservedTrace。</p>
            <p class="mt-2">当前不会启用 embroidery、template、strip、dyeMark 正式业务逻辑，只保留版本化占位结构。</p>
          </div>
          <div class="rounded-lg border bg-muted/10 p-3">
            <h3 class="text-sm font-semibold text-foreground">二级工艺扩展占位区</h3>
            <div class="mt-3 flex flex-wrap gap-2">
              ${
                preview?.reservedProcessHtml ||
                ['绣花扩展', '打模板扩展', '打条扩展', '打染标扩展']
                  .map((label) => `<span class="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">${label} · disabled</span>`)
                  .join('')
              }
            </div>
          </div>
        </div>
        <div class="space-y-3">
          ${
            previewOwner && previewRecord && preview
              ? `
                <div class="rounded-lg border p-3">
                  <div class="flex items-center justify-between gap-3">
                    <div>
                      <h3 class="text-sm font-semibold text-foreground">单张票据二维码预览</h3>
                      <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(previewRecord.ticketNo)} · ${escapeHtml(previewOwner.originalCutOrderNo)}</p>
                    </div>
                    ${renderBadge(previewRecord.sourceContextType === 'merge-batch' ? 'sourceContext: merge-batch' : 'sourceContext: original-order', previewRecord.sourceContextType === 'merge-batch' ? 'bg-violet-100 text-violet-700 border border-violet-200' : 'bg-blue-100 text-blue-700 border border-blue-200')}
                  </div>
                  <div class="mt-3 grid gap-3 md:grid-cols-2">
                    ${preview.summaryRows
                      .map(
                        (item) => `
                          <div class="rounded-md border bg-muted/10 px-3 py-2">
                            <p class="text-xs text-muted-foreground">${escapeHtml(item.label)}</p>
                            <p class="mt-1 text-sm font-medium text-foreground">${escapeHtml(item.value || '待补')}</p>
                          </div>
                        `,
                      )
                      .join('')}
                  </div>
                  <div class="mt-3 rounded-lg border bg-muted/10 p-3 text-xs text-muted-foreground">
                    <p>${escapeHtml(preview.validationText)}</p>
                    <p class="mt-1">${escapeHtml(preview.compatibilityText)}</p>
                  </div>
                  <details class="mt-3 rounded-lg border bg-background p-3">
                    <summary class="cursor-pointer text-sm font-medium text-foreground">查看 payload JSON / serialized value</summary>
                    <div class="mt-3 space-y-3">
                      <div>
                        <p class="text-xs text-muted-foreground">serialized value</p>
                        <pre class="mt-1 overflow-x-auto rounded-md bg-slate-950 px-3 py-2 text-[11px] text-slate-100">${escapeHtml(preview.serializedValue)}</pre>
                      </div>
                      <div>
                        <p class="text-xs text-muted-foreground">payload JSON</p>
                        <pre class="mt-1 max-h-[18rem] overflow-auto rounded-md bg-slate-950 px-3 py-2 text-[11px] text-slate-100">${escapeHtml(preview.payloadJson)}</pre>
                      </div>
                    </div>
                  </details>
                </div>
              `
              : `
                <div class="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
                  当前还没有可预览的单张 ticketRecord。生成草稿并打印后，这里会展示二维码 payload 摘要、JSON 与序列化值。
                </div>
              `
          }
        </div>
      </div>
    </section>
  `
}

function renderBatchOverview(bundle: FeiDataBundle): string {
  const expansion = bundle.batchExpansion
  const context = bundle.pageViewModel.context
  if (!expansion || !context) return ''

  const aggregateMeta = getFeiBatchAggregateStatusMeta(expansion.aggregateStatus)
  const navPayload = buildBatchContextNavigationPayload(context)
  const previewIndex = buildBatchPrintPreviewIndex(expansion.ownerGroups)
  const unprintedGroups = expansion.ownerGroups.filter((group) =>
    ['NOT_GENERATED', 'DRAFT'].includes(group.ticketStatus),
  ).length
  const partialGroups = expansion.ownerGroups.filter((group) => group.ticketStatus === 'PARTIAL_PRINTED').length

  return `
    <section class="rounded-lg border bg-card">
      <div class="border-b px-4 py-3">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-sm font-semibold">批次级总览区</h2>
            <p class="mt-1 text-xs text-muted-foreground">当前只是在批次上下文下组织打印工作流。菲票 owner 仍然是原始裁片单，不会转移给批次。</p>
          </div>
          ${renderBadge(aggregateMeta.label, aggregateMeta.className)}
        </div>
      </div>
      <div class="space-y-4 px-4 py-4">
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          ${renderSummaryCard('批次号', expansion.mergeBatchNo || '待补', '当前批次级打印工作流上下文')}
          ${renderSummaryCard('owner 组数', expansion.ownerGroupCount, '一个 owner = 一个原始裁片单')}
          ${renderSummaryCard('计划总票数', expansion.totalPlannedTicketQty, '按原始裁片单建议票数汇总')}
          ${renderSummaryCard('已打印总票数', expansion.totalPrintedTicketQty, '累计已打印与已重打记录')}
          ${renderSummaryCard('总重打次数', expansion.totalReprintCount, '仍然回落到 owner 级票据记录')}
          ${renderSummaryCard('aggregateStatus', aggregateMeta.label, aggregateMeta.detailText)}
        </div>

        ${
          expansion.warningMessages.length
            ? `
              <div class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-700">
                <p class="font-medium">当前批次级提示</p>
                <ul class="mt-2 list-disc space-y-1 pl-5">
                  ${expansion.warningMessages.map((message) => `<li>${escapeHtml(message)}</li>`).join('')}
                </ul>
              </div>
            `
            : ''
        }

        <div class="grid gap-3 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div class="rounded-lg border bg-muted/10 p-3">
            <h3 class="text-sm font-semibold">批量动作区</h3>
            <p class="mt-1 text-xs text-muted-foreground">
              当前批次下仍然是对多个原始裁片单逐组生成 draft / printJob。本区只负责 orchestration，不生成 merge-batch owner。
            </p>
            <div class="mt-3 flex flex-wrap gap-2">
              <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-fei-action="batch-generate-drafts">一键生成全部草稿</button>
              <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-fei-action="batch-print-unprinted">一键打印全部未打印 owner</button>
              <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-fei-action="batch-reprint-all" ${expansion.totalPrintedTicketQty > 0 ? '' : 'disabled'}>一键重打全部 owner</button>
              <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-fei-action="clear-batch-session">清空本次批次级草稿会话</button>
            </div>
            <div class="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-3">
              <p>未打印 owner：${escapeHtml(String(unprintedGroups))}</p>
              <p>部分已打印 owner：${escapeHtml(String(partialGroups))}</p>
              <p>打印顺序：${escapeHtml(previewIndex.map((item) => item.originalCutOrderNo).join(' / ') || '待补')}</p>
            </div>
          </div>

          <div class="rounded-lg border bg-muted/10 p-3">
            <h3 class="text-sm font-semibold">快捷入口</h3>
            <div class="mt-3 flex flex-col gap-2">
              <button type="button" class="rounded-md border px-3 py-2 text-sm text-left hover:bg-muted" data-cutting-fei-action="go-merge-batches" data-nav-target="${escapeHtml(buildRouteWithQuery(getCanonicalCuttingPath('merge-batches'), navPayload.mergeBatches))}">返回合并裁剪批次</button>
              <button type="button" class="rounded-md border px-3 py-2 text-sm text-left hover:bg-muted" data-cutting-fei-action="go-summary" data-nav-target="${escapeHtml(buildRouteWithQuery(getCanonicalCuttingPath('summary'), navPayload.summary))}">查看裁剪总结</button>
              <button type="button" class="rounded-md border px-3 py-2 text-sm text-left hover:bg-muted" data-cutting-fei-action="exit-batch-context">退出批次上下文</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  `
}

function renderBatchSessionResult(bundle: FeiDataBundle): string {
  const expansion = bundle.batchExpansion
  const session = getActiveBatchPrintSession(bundle)
  if (!expansion) return ''

  if (!session) {
    return `
      <section class="rounded-lg border bg-card p-4">
        <h2 class="text-sm font-semibold">批次级打印会话结果</h2>
        <p class="mt-2 text-sm text-muted-foreground">当前批次上下文还没有批量打印会话记录。可先执行“一键生成全部草稿”或“一键打印全部未打印 owner”。</p>
      </section>
    `
  }

  const result = session.resultSummary

  return `
    <section class="rounded-lg border bg-card">
      <div class="border-b px-4 py-3">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-sm font-semibold">批次级打印会话结果</h2>
            <p class="mt-1 text-xs text-muted-foreground">本区只记录从批次上下文发起的一次批量动作过程，不代表 ticket owner 层。</p>
          </div>
          <div class="text-xs text-muted-foreground">${escapeHtml(session.batchPrintSessionId)}</div>
        </div>
      </div>
      <div class="space-y-4 px-4 py-4">
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          ${renderSummaryCard('会话状态', session.status, '批次级 orchestration 状态')}
          ${renderSummaryCard('创建草稿数', result.createdDraftCount, 'owner 级 draft 数量')}
          ${renderSummaryCard('创建作业数', result.createdPrintJobCount, 'owner 级 printJob 数量')}
          ${renderSummaryCard('处理 owner 组数', session.totalOwnerGroups, '来自当前 merge-batch 展开')}
        </div>

        <div class="grid gap-4 xl:grid-cols-2">
          <div class="rounded-lg border bg-muted/10 p-3">
            <h3 class="text-sm font-semibold">失败 / 跳过详情</h3>
            <div class="mt-3 space-y-3 text-sm">
              ${
                result.failedOwnerGroups.length
                  ? `
                    <div>
                      <p class="font-medium text-rose-600">失败 ${result.failedOwnerGroups.length} 个</p>
                      <ul class="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                        ${result.failedOwnerGroups.map((item) => `<li>${escapeHtml(item.originalCutOrderNo)}：${escapeHtml(item.reason)}</li>`).join('')}
                      </ul>
                    </div>
                  `
                  : '<p class="text-muted-foreground">当前会话没有失败项。</p>'
              }
              ${
                result.skippedOwnerGroups.length
                  ? `
                    <div>
                      <p class="font-medium text-amber-700">跳过 ${result.skippedOwnerGroups.length} 个</p>
                      <ul class="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                        ${result.skippedOwnerGroups.map((item) => `<li>${escapeHtml(item.originalCutOrderNo)}：${escapeHtml(item.reason)}</li>`).join('')}
                      </ul>
                    </div>
                  `
                  : ''
              }
            </div>
          </div>

          <div class="rounded-lg border bg-muted/10 p-3">
            <h3 class="text-sm font-semibold">会话说明</h3>
            <ul class="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>当前批次会话仅用于组织与追踪一次批量打印工作流。</li>
              <li>会话下的 draft、printJob、ticketRecord 仍逐条归属到原始裁片单。</li>
              <li>本步不生成 merge-batch 总票，也不会把批次变成菲票 owner。</li>
              ${result.warningMessages.map((message) => `<li>${escapeHtml(message)}</li>`).join('')}
            </ul>
          </div>
        </div>
      </div>
    </section>
  `
}

function renderFilterSelect(
  label: string,
  field: OwnerFilterField | JobFilterField,
  value: string,
  options: Array<{ value: string; label: string }>,
): string {
  return `
    <label class="space-y-2">
      <span class="text-sm font-medium text-foreground">${escapeHtml(label)}</span>
      <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-cutting-fei-field="${escapeHtml(field)}">
        ${options
          .map((option) => `<option value="${escapeHtml(option.value)}" ${option.value === value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`)
          .join('')}
      </select>
    </label>
  `
}

function renderFilterArea(): string {
  return renderStickyFilterShell(`
    <div class="space-y-3">
      <div class="grid gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <label class="space-y-2">
          <span class="text-sm font-medium text-foreground">主体关键字</span>
          <input
            type="search"
            value="${escapeHtml(state.ownerFilters.keyword)}"
            placeholder="搜索原始裁片单号 / 生产单号 / 款号 / 面料 SKU / 批次号"
            class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            data-cutting-fei-field="keyword"
          />
        </label>
        ${renderFilterSelect(
          '票据状态',
          'ticketStatus',
          state.ownerFilters.ticketStatus,
          [
            { value: 'ALL', label: '全部票据状态' },
            { value: 'NOT_GENERATED', label: '未生成' },
            { value: 'DRAFT', label: '草稿中' },
            { value: 'PARTIAL_PRINTED', label: '部分已打印' },
            { value: 'PRINTED', label: '已打印' },
            { value: 'REPRINTED', label: '已重打' },
            { value: 'PENDING_SUPPLEMENT', label: '待补录' },
          ],
        )}
        <div class="flex items-end justify-end gap-2">
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-fei-action="clear-filters">重置筛选</button>
        </div>
      </div>
      <div class="grid gap-3 xl:grid-cols-4">
        <label class="space-y-2">
          <span class="text-sm font-medium text-foreground">作业关键字</span>
          <input
            type="search"
            value="${escapeHtml(state.jobFilters.keyword)}"
            placeholder="搜索作业号 / 原始裁片单号 / 打印人"
            class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            data-cutting-fei-field="job-keyword"
          />
        </label>
        ${renderFilterSelect(
          '作业状态',
          'status',
          state.jobFilters.status,
          [
            { value: 'ALL', label: '全部作业状态' },
            { value: 'PRINTED', label: '已打印' },
            { value: 'REPRINTED', label: '已重打' },
            { value: 'CANCELLED', label: '已取消' },
          ],
        )}
        <label class="space-y-2">
          <span class="text-sm font-medium text-foreground">打印人</span>
          <input
            type="search"
            value="${escapeHtml(state.jobFilters.printedBy)}"
            placeholder="输入打印人"
            class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            data-cutting-fei-field="printedBy"
          />
        </label>
        <label class="space-y-2">
          <span class="text-sm font-medium text-foreground">打印日期</span>
          <input
            type="date"
            value="${escapeHtml(state.jobFilters.printedDate)}"
            class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            data-cutting-fei-field="printedDate"
          />
        </label>
      </div>
    </div>
  `)
}

function renderOwnersTable(owners: OriginalCutOrderTicketOwner[], bundle: FeiDataBundle): string {
  const activeOwnerId = state.activeOwnerId
  const isBatchContext = bundle.pageViewModel.context?.contextType === 'merge-batch'
  return `
    <section class="rounded-lg border bg-card">
      <div class="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 class="text-sm font-semibold">${isBatchContext ? 'owner 分组列表区' : '票据主体列表'}</h2>
          <p class="mt-1 text-xs text-muted-foreground">
            ${
              isBatchContext
                ? '当前来自合并裁剪批次上下文，但本表仍严格按原始裁片单一行组织。所有草稿、printJob、ticketRecord 最终都回落到 owner 级。'
                : '一行一个原始裁片单。即使在合并裁剪批次上下文下，也始终按原始裁片单作为菲票归属主体。'
            }
          </p>
        </div>
        <div class="text-xs text-muted-foreground">共 ${owners.length} 个票据主体</div>
      </div>
      ${renderStickyTableScroller(`
        <table class="w-full min-w-[1620px] text-sm">
          <thead class="sticky top-0 z-10 border-b bg-muted/95 text-muted-foreground backdrop-blur">
            <tr>
              <th class="px-4 py-3 text-left font-medium">原始裁片单号</th>
              <th class="px-4 py-3 text-left font-medium">来源生产单号</th>
              <th class="px-4 py-3 text-left font-medium">款号 / SPU</th>
              <th class="px-4 py-3 text-left font-medium">面料 SKU</th>
              <th class="px-4 py-3 text-left font-medium">计划票数</th>
              <th class="px-4 py-3 text-left font-medium">已打印票数</th>
              <th class="px-4 py-3 text-left font-medium">票据状态</th>
              <th class="px-4 py-3 text-left font-medium">最新打印作业号</th>
              <th class="px-4 py-3 text-left font-medium">来源上下文</th>
              <th class="px-4 py-3 text-left font-medium">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y">
            ${
              owners.length
                ? owners
                    .map((owner) => {
                      const statusMeta = getFeiTicketStatusMeta(owner.ticketStatus)
                      const highlighted = owner.id === activeOwnerId
                      return `
                        <tr class="${highlighted ? 'bg-blue-50/60' : 'hover:bg-muted/20'}">
                          <td class="px-4 py-3 align-top">
                            <button type="button" class="text-left font-medium text-blue-600 hover:underline" data-cutting-fei-action="open-owner" data-owner-id="${escapeHtml(owner.id)}">
                              ${escapeHtml(owner.originalCutOrderNo)}
                            </button>
                            <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(owner.sameCodeValue)} / ${escapeHtml(owner.qrBaseValue)}</p>
                          </td>
                          <td class="px-4 py-3 align-top">
                            <div class="font-medium">${escapeHtml(owner.productionOrderNo)}</div>
                            <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(owner.styleName || '待补款式')}</p>
                          </td>
                          <td class="px-4 py-3 align-top">
                            <div class="font-medium">${escapeHtml(owner.styleCode || owner.spuCode || '待补')}</div>
                            <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(owner.color || '待补颜色')}</p>
                          </td>
                          <td class="px-4 py-3 align-top">
                            <div class="font-medium">${escapeHtml(owner.materialSku)}</div>
                            <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(owner.cuttableStateLabel)} · ${escapeHtml(owner.currentStageLabel)}</p>
                          </td>
                          <td class="px-4 py-3 align-top">
                            <div class="font-medium">${formatCount(owner.plannedTicketQty)}</div>
                            <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(owner.ticketCountBasisLabel)}</p>
                          </td>
                          <td class="px-4 py-3 align-top">
                            <div class="font-medium">${formatCount(owner.printedTicketQty)}</div>
                            <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(owner.ticketCountBasisDetail)}</p>
                          </td>
                          <td class="px-4 py-3 align-top">
                            <div class="space-y-1">
                              ${renderBadge(statusMeta.label, statusMeta.className)}
                              <p class="text-xs text-muted-foreground">${escapeHtml(statusMeta.detailText)}</p>
                            </div>
                          </td>
                          <td class="px-4 py-3 align-top">
                            <div class="font-medium">${escapeHtml(owner.latestPrintJobNo || '尚无')}</div>
                            <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(owner.latestActionText || '暂无最近动作')}</p>
                          </td>
                          <td class="px-4 py-3 align-top">
                            <div class="font-medium">${escapeHtml(owner.sourceContextLabel)}</div>
                            <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(owner.relatedMergeBatchNos.join(' / ') || '当前未关联批次')}</p>
                          </td>
                          <td class="px-4 py-3 align-top">
                            <div class="flex flex-wrap gap-2">
                              <button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-cutting-fei-action="open-owner" data-owner-id="${escapeHtml(owner.id)}">查看详情</button>
                              <button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-cutting-fei-action="generate-draft" data-owner-id="${escapeHtml(owner.id)}">生成草稿</button>
                              <button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-cutting-fei-action="print-owner" data-owner-id="${escapeHtml(owner.id)}">打印</button>
                              <button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-cutting-fei-action="reprint-owner" data-owner-id="${escapeHtml(owner.id)}" ${owner.printedTicketQty > 0 ? '' : 'disabled'}>重打</button>
                              <button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-cutting-fei-action="go-original-orders" data-owner-id="${escapeHtml(owner.id)}">查看原始裁片单</button>
                              <button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-cutting-fei-action="go-transfer-bags" data-owner-id="${escapeHtml(owner.id)}">去周转口袋 / 车缝交接</button>
                            </div>
                          </td>
                        </tr>
                      `
                    })
                    .join('')
                : `
                  <tr>
                    <td colspan="10" class="px-4 py-16 text-center text-sm text-muted-foreground">
                      当前筛选条件下暂无票据主体，请调整筛选条件或清除预筛后重试。
                    </td>
                  </tr>
                `
            }
          </tbody>
        </table>
      `)}
    </section>
  `
}

function renderDraftPreviewTable(records: FeiTicketLabelRecord[]): string {
  if (!records.length) {
    return '<div class="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">当前尚未生成打印草稿，请先选择票据主体并生成草稿。</div>'
  }

  return renderStickyTableScroller(`
    <table class="w-full min-w-[920px] text-sm">
      <thead class="sticky top-0 z-10 border-b bg-muted/95 text-muted-foreground backdrop-blur">
        <tr>
          <th class="px-4 py-3 text-left font-medium">ticketNo</th>
          <th class="px-4 py-3 text-left font-medium">序号</th>
          <th class="px-4 py-3 text-left font-medium">原始裁片单号</th>
          <th class="px-4 py-3 text-left font-medium">生产单号</th>
          <th class="px-4 py-3 text-left font-medium">面料 SKU</th>
          <th class="px-4 py-3 text-left font-medium">二维码值</th>
        </tr>
      </thead>
      <tbody class="divide-y">
        ${records
          .map(
            (record) => `
              <tr>
                <td class="px-4 py-3 font-medium">${escapeHtml(record.ticketNo)}</td>
                <td class="px-4 py-3">${escapeHtml(String(record.sequenceNo))}</td>
                <td class="px-4 py-3">${escapeHtml(record.originalCutOrderNo)}</td>
                <td class="px-4 py-3">${escapeHtml(record.productionOrderNo)}</td>
                <td class="px-4 py-3">${escapeHtml(record.materialSku)}</td>
                <td class="px-4 py-3">${escapeHtml(record.qrValue)}</td>
              </tr>
            `,
          )
          .join('')}
      </tbody>
    </table>
  `, 'max-h-[28rem]')
}

function renderDraftWorkspace(bundle: FeiDataBundle): string {
  const owner = getActiveOwner(bundle)
  const draft = getCurrentDraft(owner)

  if (!owner) {
    return `
      <section class="rounded-lg border bg-card p-4">
        <h2 class="text-sm font-semibold">打印草稿 / 预览区</h2>
        <p class="mt-2 text-sm text-muted-foreground">请先从上方票据主体列表中选择一个原始裁片单，再生成草稿与预览。</p>
      </section>
    `
  }

  const previewRecords = draft?.previewLabelRecords ?? []
  const statusMeta = getFeiTicketStatusMeta(owner.ticketStatus)

  return `
    <section class="rounded-lg border bg-card">
      <div class="border-b px-4 py-3">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-sm font-semibold">打印草稿 / 预览区</h2>
            <p class="mt-1 text-xs text-muted-foreground">当前按原始裁片单维度生成菲票草稿与预览。打印归属始终回落原始裁片单。</p>
          </div>
          <div class="flex items-center gap-2">
            ${renderBadge(statusMeta.label, statusMeta.className)}
            ${draft ? renderBadge(draft.isReprint ? '重打草稿' : '打印草稿', 'bg-blue-100 text-blue-700 border border-blue-200') : ''}
          </div>
        </div>
      </div>
      <div class="grid gap-4 p-4 xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <div class="space-y-3">
          <div class="rounded-lg border bg-muted/10 p-3 text-sm">
            <div class="grid gap-2 text-muted-foreground">
              <p><span class="font-medium text-foreground">原始裁片单：</span>${escapeHtml(owner.originalCutOrderNo)}</p>
              <p><span class="font-medium text-foreground">来源生产单：</span>${escapeHtml(owner.productionOrderNo)}</p>
              <p><span class="font-medium text-foreground">款号 / SPU：</span>${escapeHtml(owner.styleCode || owner.spuCode || '待补')}</p>
              <p><span class="font-medium text-foreground">面料 SKU：</span>${escapeHtml(owner.materialSku)}</p>
              <p><span class="font-medium text-foreground">sameCode：</span>${escapeHtml(owner.sameCodeValue)}</p>
              <p><span class="font-medium text-foreground">qrBase：</span>${escapeHtml(owner.qrBaseValue)}</p>
              <p><span class="font-medium text-foreground">建议票数：</span>${escapeHtml(formatCount(owner.plannedTicketQty))}（${escapeHtml(owner.ticketCountBasisLabel)}）</p>
            </div>
          </div>

          <label class="space-y-2">
            <span class="text-sm font-medium text-foreground">票数</span>
            <input
              type="number"
              min="1"
              step="1"
              value="${escapeHtml(state.draftTicketCount)}"
              class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              data-cutting-fei-draft-field="ticketCount"
            />
          </label>

          <label class="space-y-2">
            <span class="text-sm font-medium text-foreground">草稿备注</span>
            <textarea
              class="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              data-cutting-fei-draft-field="note"
            >${escapeHtml(state.draftNote)}</textarea>
          </label>

          <div class="rounded-lg border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            当前步骤只建设原始裁片单维度的菲票工作台。若当前来自合并裁剪批次上下文，页面仍先按原始裁片单生成草稿与打印。
          </div>

          <div class="flex flex-wrap gap-2">
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-fei-action="generate-draft">生成草稿</button>
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-fei-action="preview-draft" ${draft ? '' : 'disabled'}>打印预览</button>
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-fei-action="print-draft" ${draft ? '' : 'disabled'}>打印</button>
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-fei-action="cancel-draft" ${draft ? '' : 'disabled'}>取消草稿</button>
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-fei-action="reprint-owner" data-owner-id="${escapeHtml(owner.id)}" ${owner.printedTicketQty > 0 ? '' : 'disabled'}>重打</button>
          </div>
        </div>

        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-sm font-semibold text-foreground">预览票据</h3>
              <p class="mt-1 text-xs text-muted-foreground">预览中展示将生成的 ticketNo、序号和二维码值。打印后将沉淀单张票据记录与打印作业台账。</p>
            </div>
            <div class="text-xs text-muted-foreground">${draft ? `当前草稿 ${draft.previewLabelRecords.length} 张` : '尚未生成草稿'}</div>
          </div>
          ${renderDraftPreviewTable(previewRecords)}
        </div>
      </div>
    </section>
  `
}

function renderOwnerDetail(bundle: FeiDataBundle): string {
  const owner = getActiveOwner(bundle)
  if (!owner) return ''

  const statusMeta = getFeiTicketStatusMeta(owner.ticketStatus)
  const ownerJobs = getOwnerPrintJobs(owner, bundle)
  const ownerRecords = getOwnerTicketRecords(owner, bundle)
  const latestRecord = getLatestOwnerTicketRecord(owner, bundle)
  const qrPreview = latestRecord ? getQrPreviewForRecord(owner, latestRecord, bundle) : null

  return renderWorkbenchSecondaryPanel({
    title: `票据主体详情 · ${owner.originalCutOrderNo}`,
    hint: '当前详情仍以原始裁片单为主体，合并裁剪批次仅作为来源上下文显示，不改变菲票归属。',
    countText: `打印作业 ${ownerJobs.length} 条 / 单张记录 ${ownerRecords.length} 张`,
    defaultOpen: true,
    body: `
      <div class="space-y-4">
        <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-4 text-sm">
          <div class="rounded-lg border bg-muted/10 p-3">
            <p class="text-xs text-muted-foreground">原始裁片单号</p>
            <p class="mt-1 font-medium text-foreground">${escapeHtml(owner.originalCutOrderNo)}</p>
          </div>
          <div class="rounded-lg border bg-muted/10 p-3">
            <p class="text-xs text-muted-foreground">来源生产单号</p>
            <p class="mt-1 font-medium text-foreground">${escapeHtml(owner.productionOrderNo)}</p>
          </div>
          <div class="rounded-lg border bg-muted/10 p-3">
            <p class="text-xs text-muted-foreground">款号 / SPU</p>
            <p class="mt-1 font-medium text-foreground">${escapeHtml(owner.styleCode || owner.spuCode || '待补')}</p>
          </div>
          <div class="rounded-lg border bg-muted/10 p-3">
            <p class="text-xs text-muted-foreground">面料 SKU</p>
            <p class="mt-1 font-medium text-foreground">${escapeHtml(owner.materialSku)}</p>
          </div>
          <div class="rounded-lg border bg-muted/10 p-3">
            <p class="text-xs text-muted-foreground">sameCode / qrBase</p>
            <p class="mt-1 font-medium text-foreground">${escapeHtml(owner.sameCodeValue)} / ${escapeHtml(owner.qrBaseValue)}</p>
          </div>
          <div class="rounded-lg border bg-muted/10 p-3">
            <p class="text-xs text-muted-foreground">计划票数 / 已打印票数</p>
            <p class="mt-1 font-medium text-foreground">${formatCount(owner.plannedTicketQty)} / ${formatCount(owner.printedTicketQty)}</p>
          </div>
          <div class="rounded-lg border bg-muted/10 p-3">
            <p class="text-xs text-muted-foreground">当前状态</p>
            <div class="mt-1">${renderBadge(statusMeta.label, statusMeta.className)}</div>
          </div>
          <div class="rounded-lg border bg-muted/10 p-3">
            <p class="text-xs text-muted-foreground">最近打印作业</p>
            <p class="mt-1 font-medium text-foreground">${escapeHtml(owner.latestPrintJobNo || '尚无')}</p>
          </div>
        </section>

        <section class="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div class="rounded-lg border p-3">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-semibold text-foreground">历史打印记录</h3>
              <span class="text-xs text-muted-foreground">${ownerJobs.length} 条作业</span>
            </div>
            ${
              ownerJobs.length
                ? `
                  <div class="mt-3 space-y-2">
                    ${ownerJobs
                      .map((job) => {
                        const meta = printJobStatusMeta[job.status]
                        return `
                          <button type="button" class="w-full rounded-lg border px-3 py-2 text-left hover:bg-muted/20" data-cutting-fei-action="open-print-job" data-print-job-id="${escapeHtml(job.printJobId)}">
                            <div class="flex items-center justify-between gap-2">
                              <div>
                                <p class="font-medium text-foreground">${escapeHtml(job.printJobNo)}</p>
                                <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(job.printedAt)} · ${escapeHtml(job.printedBy)} · ${escapeHtml(job.note || '无备注')}</p>
                              </div>
                              ${renderBadge(meta.label, meta.className)}
                            </div>
                          </button>
                        `
                      })
                      .join('')}
                  </div>
                `
                : '<p class="mt-3 text-sm text-muted-foreground">当前尚无历史打印作业。</p>'
            }
          </div>

          <div class="rounded-lg border p-3">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-semibold text-foreground">单张票据记录</h3>
              <span class="text-xs text-muted-foreground">${ownerRecords.length} 张</span>
            </div>
            ${
              ownerRecords.length
                ? renderStickyTableScroller(
                    `
                      <table class="w-full min-w-[720px] text-sm">
                        <thead class="sticky top-0 z-10 border-b bg-muted/95 text-muted-foreground backdrop-blur">
                          <tr>
                            <th class="px-3 py-2 text-left font-medium">ticketNo</th>
                            <th class="px-3 py-2 text-left font-medium">序号</th>
                            <th class="px-3 py-2 text-left font-medium">打印时间</th>
                            <th class="px-3 py-2 text-left font-medium">打印人</th>
                            <th class="px-3 py-2 text-left font-medium">重打次数</th>
                          </tr>
                        </thead>
                        <tbody class="divide-y">
                          ${ownerRecords
                            .map(
                              (record) => `
                                <tr>
                                  <td class="px-3 py-2 font-medium">${escapeHtml(record.ticketNo)}</td>
                                  <td class="px-3 py-2">${escapeHtml(String(record.sequenceNo))}</td>
                                  <td class="px-3 py-2">${escapeHtml(record.printedAt || '待打印')}</td>
                                  <td class="px-3 py-2">${escapeHtml(record.printedBy || '待补')}</td>
                                  <td class="px-3 py-2">${escapeHtml(String(record.reprintCount))}</td>
                                </tr>
                              `,
                            )
                            .join('')}
                        </tbody>
                      </table>
                    `,
                    'max-h-[16rem]',
                  )
                : '<p class="mt-3 text-sm text-muted-foreground">当前尚未生成单张票据记录。</p>'
            }
          </div>
        </section>

        <section class="rounded-lg border p-3">
          <div class="flex items-center justify-between gap-3">
            <div>
              <h3 class="text-sm font-semibold text-foreground">二维码 schema / payload 预览</h3>
              <p class="mt-1 text-xs text-muted-foreground">当前仅冻结 owner 回落、schema 版本和工艺扩展槽位；merge-batch 仍只作为 sourceContext。</p>
            </div>
            ${renderBadge(`schema ${qrPreview?.summary.schemaVersion || FEI_QR_SCHEMA_VERSION}`, 'bg-blue-100 text-blue-700 border border-blue-200')}
          </div>
          ${
            qrPreview
              ? `
                <div class="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3 text-sm">
                  ${qrPreview.summaryRows
                    .map(
                      (item) => `
                        <div class="rounded-md border bg-muted/10 px-3 py-2">
                          <p class="text-xs text-muted-foreground">${escapeHtml(item.label)}</p>
                          <p class="mt-1 font-medium text-foreground">${escapeHtml(item.value || '待补')}</p>
                        </div>
                      `,
                    )
                    .join('')}
                </div>
                <div class="mt-3 flex flex-wrap gap-2">
                  ${qrPreview.reservedProcessHtml}
                </div>
                <div class="mt-3 grid gap-3 md:grid-cols-2">
                  <article class="rounded-lg border bg-muted/10 px-3 py-2">
                    <p class="text-xs text-muted-foreground">reservedTrace</p>
                    <div class="mt-2 space-y-1 text-sm">
                      ${qrPreview.reservedTraceRows.map((item) => `<p>${escapeHtml(item.label)}：${escapeHtml(item.value)}</p>`).join('')}
                    </div>
                  </article>
                  <article class="rounded-lg border bg-muted/10 px-3 py-2">
                    <p class="text-xs text-muted-foreground">transfer-bags 桥接摘要</p>
                    <div class="mt-2 space-y-1 text-sm">
                      ${qrPreview.bridgeRows.map((item) => `<p>${escapeHtml(item.label)}：${escapeHtml(item.value)}</p>`).join('')}
                    </div>
                  </article>
                </div>
                <details class="mt-3 rounded-lg border bg-background p-3">
                  <summary class="cursor-pointer text-sm font-medium text-foreground">展开 payload JSON / serialized value</summary>
                  <div class="mt-3 space-y-3">
                    <pre class="overflow-x-auto rounded-md bg-slate-950 px-3 py-2 text-[11px] text-slate-100">${escapeHtml(qrPreview.serializedValue)}</pre>
                    <pre class="max-h-[18rem] overflow-auto rounded-md bg-slate-950 px-3 py-2 text-[11px] text-slate-100">${escapeHtml(qrPreview.payloadJson)}</pre>
                  </div>
                </details>
              `
              : '<p class="mt-3 text-sm text-muted-foreground">当前尚无已生成票据记录，二维码 payload 将在首轮打印后自动按默认 schema 构建并展示。</p>'
          }
        </section>

        <section class="rounded-lg border border-dashed bg-muted/10 p-3 text-sm text-muted-foreground">
          <p>说明：菲票归属主体为原始裁片单，合并裁剪批次仅作为执行上下文。后续若扩展二维码二级工艺信息，也仍基于原始裁片单回落，不会转移给批次。</p>
        </section>

        <section class="flex flex-wrap gap-2">
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-fei-action="go-original-orders" data-owner-id="${escapeHtml(owner.id)}">查看裁片单（原始单）</button>
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-fei-action="go-marker-spreading" data-owner-id="${escapeHtml(owner.id)}">返回唛架 / 铺布</button>
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-fei-action="go-summary" data-owner-id="${escapeHtml(owner.id)}">查看裁剪总结</button>
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-fei-action="go-transfer-bags" data-owner-id="${escapeHtml(owner.id)}">去周转口袋 / 车缝交接</button>
        </section>
      </div>
    `,
  })
}

function renderPrintJobsLedger(bundle: FeiDataBundle): string {
  const printJobs = getDisplayPrintJobs(bundle)
  const activePrintJob = getActivePrintJob(bundle)

  return `
    <section class="rounded-lg border bg-card">
      <div class="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 class="text-sm font-semibold">打印作业台账</h2>
          <p class="mt-1 text-xs text-muted-foreground">记录原型期 print job 与单张票据历史。后续可替换为真实后端台账接口，但仍保持原始裁片单为票据 owner。</p>
        </div>
        <div class="text-xs text-muted-foreground">共 ${printJobs.length} 条作业</div>
      </div>
      ${renderStickyTableScroller(`
        <table class="w-full min-w-[1320px] text-sm">
          <thead class="sticky top-0 z-10 border-b bg-muted/95 text-muted-foreground backdrop-blur">
            <tr>
              <th class="px-4 py-3 text-left font-medium">作业号</th>
              <th class="px-4 py-3 text-left font-medium">状态</th>
              <th class="px-4 py-3 text-left font-medium">原始裁片单</th>
              <th class="px-4 py-3 text-left font-medium">来源上下文</th>
              <th class="px-4 py-3 text-left font-medium">打印张数</th>
              <th class="px-4 py-3 text-left font-medium">打印人</th>
              <th class="px-4 py-3 text-left font-medium">打印时间</th>
              <th class="px-4 py-3 text-left font-medium">备注</th>
              <th class="px-4 py-3 text-left font-medium">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y">
            ${
              printJobs.length
                ? printJobs
                    .map((job) => {
                      const meta = printJobStatusMeta[job.status]
                      const highlighted = job.printJobId === state.activePrintJobId
                      return `
                        <tr class="${highlighted ? 'bg-blue-50/60' : 'hover:bg-muted/20'}">
                          <td class="px-4 py-3 align-top font-medium">${escapeHtml(job.printJobNo)}</td>
                          <td class="px-4 py-3 align-top">${renderBadge(meta.label, meta.className)}</td>
                          <td class="px-4 py-3 align-top">${escapeHtml(job.originalCutOrderNos.join(' / '))}</td>
                          <td class="px-4 py-3 align-top">
                            <div class="font-medium">${escapeHtml(job.sourceContextType === 'merge-batch' ? `来自批次 ${job.sourceMergeBatchNo || '待补批次号'}` : '原始单上下文')}</div>
                            <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(job.sourceMergeBatchNo || '无批次来源')}</p>
                          </td>
                          <td class="px-4 py-3 align-top">${escapeHtml(formatCount(job.totalTicketCount))}</td>
                          <td class="px-4 py-3 align-top">${escapeHtml(job.printedBy || '待补')}</td>
                          <td class="px-4 py-3 align-top">${escapeHtml(job.printedAt || '待补')}</td>
                          <td class="px-4 py-3 align-top">${escapeHtml(job.note || '无')}</td>
                          <td class="px-4 py-3 align-top">
                            <div class="flex flex-wrap gap-2">
                              <button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-cutting-fei-action="open-print-job" data-print-job-id="${escapeHtml(job.printJobId)}">查看详情</button>
                              <button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-cutting-fei-action="go-transfer-bags" data-print-job-id="${escapeHtml(job.printJobId)}">去周转口袋 / 车缝交接</button>
                            </div>
                          </td>
                        </tr>
                      `
                    })
                    .join('')
                : `
                  <tr>
                    <td colspan="9" class="px-4 py-16 text-center text-sm text-muted-foreground">
                      当前筛选条件下暂无打印作业台账。可先在上方为原始裁片单生成草稿并打印。
                    </td>
                  </tr>
                `
            }
          </tbody>
        </table>
      `)}
      ${
        activePrintJob
          ? `
            <div class="border-t p-4">
              <h3 class="text-sm font-semibold text-foreground">当前作业详情 · ${escapeHtml(activePrintJob.printJobNo)}</h3>
              <div class="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4 text-sm">
                <div class="rounded-lg border bg-muted/10 p-3">
                  <p class="text-xs text-muted-foreground">状态</p>
                  <div class="mt-1">${renderBadge(printJobStatusMeta[activePrintJob.status].label, printJobStatusMeta[activePrintJob.status].className)}</div>
                </div>
                <div class="rounded-lg border bg-muted/10 p-3">
                  <p class="text-xs text-muted-foreground">原始裁片单</p>
                  <p class="mt-1 font-medium text-foreground">${escapeHtml(activePrintJob.originalCutOrderNos.join(' / '))}</p>
                </div>
                <div class="rounded-lg border bg-muted/10 p-3">
                  <p class="text-xs text-muted-foreground">来源上下文</p>
                  <p class="mt-1 font-medium text-foreground">${escapeHtml(activePrintJob.sourceContextType === 'merge-batch' ? `来自批次 ${activePrintJob.sourceMergeBatchNo || '待补批次号'}` : '原始单上下文')}</p>
                </div>
                <div class="rounded-lg border bg-muted/10 p-3">
                  <p class="text-xs text-muted-foreground">打印人 / 时间</p>
                  <p class="mt-1 font-medium text-foreground">${escapeHtml(activePrintJob.printedBy || '待补')} / ${escapeHtml(activePrintJob.printedAt || '待补')}</p>
                </div>
              </div>
            </div>
          `
          : ''
      }
    </section>
  `
}

function buildPrintPreviewHtml(owner: OriginalCutOrderTicketOwner, draft: FeiTicketDraft): string {
  const printedAt = nowText()
  return `
    <!doctype html>
    <html lang="zh-CN">
      <head>
        <meta charset="utf-8" />
        <title>菲票打印预览 - ${escapeHtml(owner.originalCutOrderNo)}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif; margin: 24px; color: #111827; }
          h1 { margin: 0 0 12px; font-size: 24px; }
          .meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 16px; margin-bottom: 20px; font-size: 13px; color: #4b5563; }
          .tip { margin-bottom: 20px; padding: 10px 12px; border: 1px solid #dbeafe; background: #eff6ff; border-radius: 10px; font-size: 12px; color: #1d4ed8; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #e5e7eb; padding: 8px 10px; text-align: left; font-size: 12px; vertical-align: top; }
          th { background: #f8fafc; }
          .footer { margin-top: 16px; font-size: 12px; color: #6b7280; }
        </style>
      </head>
      <body>
        <h1>菲票打印预览</h1>
        <div class="meta">
          <div>原始裁片单号：${escapeHtml(owner.originalCutOrderNo)}</div>
          <div>来源生产单号：${escapeHtml(owner.productionOrderNo)}</div>
          <div>款号 / SPU：${escapeHtml(owner.styleCode || owner.spuCode || '待补')}</div>
          <div>面料 SKU：${escapeHtml(owner.materialSku)}</div>
          <div>sameCode：${escapeHtml(owner.sameCodeValue)}</div>
          <div>qrBase：${escapeHtml(owner.qrBaseValue)}</div>
          <div>schemaVersion：${FEI_QR_SCHEMA_VERSION}</div>
          <div>ownerType：original-cut-order</div>
          <div>打印时间：${escapeHtml(printedAt)}</div>
          <div>草稿备注：${escapeHtml(draft.note || '无')}</div>
        </div>
        <div class="tip">说明：当前打印上下文仅用于筛选与查看；菲票归属主体始终回落原始裁片单，不会转移给合并裁剪批次。</div>
        <details class="tip" open>
          <summary style="cursor:pointer;font-weight:600;">二维码 payload 摘要</summary>
          <div style="margin-top:8px;">当前票面只展示基础二维码值；结构化 payload 采用 ${FEI_QR_SCHEMA_NAME}@${FEI_QR_SCHEMA_VERSION}，后续工艺扩展字段仍保留在 reservedProcess / reservedTrace 中。</div>
        </details>
        <table>
          <thead>
            <tr>
              <th>ticketNo</th>
              <th>序号</th>
              <th>原始裁片单号</th>
              <th>生产单号</th>
              <th>面料 SKU</th>
              <th>二维码值</th>
            </tr>
          </thead>
          <tbody>
            ${draft.previewLabelRecords
              .map(
                (record) => `
                  <tr>
                    <td>${escapeHtml(record.ticketNo)}</td>
                    <td>${escapeHtml(String(record.sequenceNo))}</td>
                    <td>${escapeHtml(record.originalCutOrderNo)}</td>
                    <td>${escapeHtml(record.productionOrderNo)}</td>
                    <td>${escapeHtml(record.materialSku)}</td>
                    <td>${escapeHtml(record.qrValue)}</td>
                  </tr>
                `,
              )
              .join('')}
          </tbody>
        </table>
        <p class="footer">原型期说明：本预览仅承接原始裁片单维度的菲票工作台，不代表真实打印设备协议。</p>
      </body>
    </html>
  `
}

function openPrintWindow(owner: OriginalCutOrderTicketOwner, draft: FeiTicketDraft, autoPrint: boolean): boolean {
  const printWindow = window.open('', '_blank', 'width=1100,height=760')
  if (!printWindow) {
    setFeedback('warning', '当前浏览器阻止了打印预览窗口，请允许弹出窗口后重试。')
    return true
  }

  printWindow.document.open()
  printWindow.document.write(buildPrintPreviewHtml(owner, draft))
  printWindow.document.close()
  printWindow.focus()
  if (autoPrint) {
    printWindow.print()
  }
  return true
}

function buildBatchPrintPreviewHtml(
  expansion: FeiBatchExpansionResult,
  printJobs: FeiTicketPrintJob[],
  ticketRecords: FeiTicketLabelRecord[],
): string {
  const previewIndex = buildBatchPrintPreviewIndex(expansion.ownerGroups)
  return `
    <!doctype html>
    <html lang="zh-CN">
      <head>
        <meta charset="utf-8" />
        <title>批次打票预览 - ${escapeHtml(expansion.mergeBatchNo)}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif; margin: 24px; color: #111827; }
          h1 { margin: 0 0 12px; font-size: 24px; }
          h2 { margin: 20px 0 8px; font-size: 16px; }
          .tip { margin-bottom: 16px; padding: 10px 12px; border: 1px solid #e9d5ff; background: #faf5ff; border-radius: 10px; font-size: 12px; color: #7c3aed; }
          .meta { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px 16px; margin-bottom: 20px; font-size: 13px; color: #4b5563; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th, td { border: 1px solid #e5e7eb; padding: 8px 10px; text-align: left; font-size: 12px; vertical-align: top; }
          th { background: #f8fafc; }
          .group { margin-bottom: 24px; page-break-inside: avoid; }
          .footer { margin-top: 16px; font-size: 12px; color: #6b7280; }
        </style>
      </head>
      <body>
        <h1>批次上下文菲票打印预览</h1>
        <div class="meta">
          <div>批次号：${escapeHtml(expansion.mergeBatchNo)}</div>
          <div>owner 组数：${escapeHtml(String(expansion.ownerGroupCount))}</div>
          <div>计划总票数：${escapeHtml(String(expansion.totalPlannedTicketQty))}</div>
        </div>
        <div class="tip">说明：当前只是从合并裁剪批次发起打印工作流。打印归属主体仍然是原始裁片单，不会生成 merge-batch 总票。</div>
        ${previewIndex
          .map((item) => {
            const group = expansion.ownerGroups.find((candidate) => candidate.groupId === item.groupId)
            if (!group) return ''
            const groupJobs = printJobs.filter((job) => job.originalCutOrderIds.includes(group.originalCutOrderId))
            const jobIds = new Set(groupJobs.map((job) => job.printJobId))
            const groupRecords = ticketRecords
              .filter(
                (record) =>
                  record.originalCutOrderId === group.originalCutOrderId &&
                  jobIds.has(record.sourcePrintJobId),
              )
              .sort((left, right) => left.sequenceNo - right.sequenceNo)

            return `
              <section class="group">
                <h2>${escapeHtml(group.originalCutOrderNo)} · ${escapeHtml(group.productionOrderNo)}</h2>
                <div class="meta">
                  <div>款号 / SPU：${escapeHtml(group.styleCode || group.spuCode || '待补')}</div>
                  <div>面料 SKU：${escapeHtml(group.materialSku)}</div>
                  <div>最新作业：${escapeHtml(groupJobs[0]?.printJobNo || '待补')}</div>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>ticketNo</th>
                      <th>序号</th>
                      <th>原始裁片单号</th>
                      <th>生产单号</th>
                      <th>面料 SKU</th>
                      <th>二维码值</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${groupRecords
                      .map(
                        (record) => `
                          <tr>
                            <td>${escapeHtml(record.ticketNo)}</td>
                            <td>${escapeHtml(String(record.sequenceNo))}</td>
                            <td>${escapeHtml(record.originalCutOrderNo)}</td>
                            <td>${escapeHtml(record.productionOrderNo)}</td>
                            <td>${escapeHtml(record.materialSku)}</td>
                            <td>${escapeHtml(record.qrValue)}</td>
                          </tr>
                        `,
                      )
                      .join('')}
                  </tbody>
                </table>
              </section>
            `
          })
          .join('')}
        <p class="footer">原型期说明：当前仅完成批次上下文下按原始裁片单展开的打印工作流，不包含真实设备协议。</p>
      </body>
    </html>
  `
}

function openBatchPrintWindow(
  expansion: FeiBatchExpansionResult,
  printJobs: FeiTicketPrintJob[],
  ticketRecords: FeiTicketLabelRecord[],
  autoPrint: boolean,
): void {
  const printWindow = window.open('', '_blank', 'width=1180,height=820')
  if (!printWindow) {
    setFeedback('warning', '批量打印预览窗口被浏览器拦截，已保留打印台账，请允许弹窗后重试。')
    return
  }

  printWindow.document.open()
  printWindow.document.write(buildBatchPrintPreviewHtml(expansion, printJobs, ticketRecords))
  printWindow.document.close()
  printWindow.focus()
  if (autoPrint) {
    printWindow.print()
  }
}

function findOwnerById(id: string, bundle = getDataBundle()): OriginalCutOrderTicketOwner | null {
  return bundle.pageViewModel.ownersById[id] ?? bundle.fullViewModel.ownersById[id] ?? null
}

function updateActiveOwner(ownerId: string | null): void {
  const bundle = getDataBundle()
  state.activeOwnerId = ownerId
  const owner = ownerId ? findOwnerById(ownerId, bundle) : null
  syncDraftEditor(owner)
  if (owner) {
    const latestJob = getOwnerPrintJobs(owner, bundle)[0]
    if (latestJob) state.activePrintJobId = latestJob.printJobId
  }
}

function createDraftForOwner(owner: OriginalCutOrderTicketOwner, bundle = getDataBundle(), options?: { isReprint?: boolean }): FeiTicketDraft | null {
  const ticketCount = Math.max(1, Number(state.draftTicketCount) || owner.plannedTicketQty || 1)
  if (!Number.isFinite(ticketCount) || ticketCount <= 0) {
    setFeedback('warning', '请先填写正确的票数，再生成草稿。')
    return null
  }

  if (options?.isReprint) {
    const reprintDraft = buildReprintDraft(owner, bundle.fullViewModel.ticketRecords, bundle.pageViewModel.context, nowText())
    if (!reprintDraft) {
      setFeedback('warning', '当前原始裁片单尚无可重打的历史票据。')
      return null
    }
    const nextDrafts = { ...state.drafts, [owner.originalCutOrderId]: reprintDraft }
    persistDrafts(nextDrafts)
    state.draftTicketCount = String(reprintDraft.ticketCount)
    state.draftNote = reprintDraft.note
    return reprintDraft
  }

  const draft = createFeiTicketDraft({
    owner,
    context: bundle.pageViewModel.context,
    ticketCount,
    note: state.draftNote.trim(),
    nowText: nowText(),
  })
  const nextDrafts = { ...state.drafts, [owner.originalCutOrderId]: draft }
  persistDrafts(nextDrafts)
  return draft
}

function previewDraft(owner: OriginalCutOrderTicketOwner, draft: FeiTicketDraft): boolean {
  return openPrintWindow(owner, draft, false)
}

function printDraft(owner: OriginalCutOrderTicketOwner, draft: FeiTicketDraft, bundle = getDataBundle()): boolean {
  openPrintWindow(owner, draft, true)
  const result = createFeiTicketPrintJob({
    draft,
    owner,
    existingRecords: bundle.fullViewModel.ticketRecords,
    existingJobs: bundle.fullViewModel.printJobs,
    printedBy: '后台打票员',
    nowText: nowText(),
  })

  persistTicketRecords(result.nextRecords)
  persistPrintJobs([...bundle.fullViewModel.printJobs, result.printJob])

  const nextDrafts = { ...state.drafts }
  delete nextDrafts[owner.originalCutOrderId]
  persistDrafts(nextDrafts)

  state.activePrintJobId = result.printJob.printJobId
  state.draftTicketCount = String(owner.plannedTicketQty)
  state.draftNote = `${owner.originalCutOrderNo} 菲票打印草稿。`
  setFeedback('success', `${owner.originalCutOrderNo} 已完成打印，并生成作业 ${result.printJob.printJobNo}。`)
  return true
}

function pushBatchPrintSession(session: FeiBatchPrintSession): void {
  const nextSessions = state.batchPrintSessions.filter((item) => item.batchPrintSessionId !== session.batchPrintSessionId)
  nextSessions.unshift(session)
  persistBatchPrintSessions(nextSessions)
  state.activeBatchPrintSessionId = session.batchPrintSessionId
}

function handleBatchGenerateDrafts(bundle = getDataBundle()): boolean {
  const expansion = bundle.batchExpansion
  const context = bundle.pageViewModel.context
  if (!expansion || !context || context.contextType !== 'merge-batch') {
    setFeedback('warning', '当前不在合并裁剪批次上下文下，不能执行批量生成草稿。')
    return true
  }

  const result = createDraftsFromBatchOwnerGroups({
    expansion,
    context,
    existingDrafts: state.drafts,
    nowText: nowText(),
    createdBy: '后台打票员',
  })

  persistDrafts(result.nextDrafts)
  pushBatchPrintSession(result.session)

  const firstCreatedOwner = expansion.ownerGroups.find((group) => result.nextDrafts[group.originalCutOrderId])
  if (firstCreatedOwner) {
    updateActiveOwner(firstCreatedOwner.groupId)
  }

  const summary = result.session.resultSummary
  setFeedback(
    summary.createdDraftCount > 0 ? 'success' : 'warning',
    `批次 ${expansion.mergeBatchNo} 已批量生成 ${summary.createdDraftCount} 个 owner 草稿，跳过 ${summary.skippedOwnerGroups.length} 个，失败 ${summary.failedOwnerGroups.length} 个。`,
  )
  return true
}

function handleBatchPrint(bundle = getDataBundle(), includeReprint = false): boolean {
  const expansion = bundle.batchExpansion
  const context = bundle.pageViewModel.context
  if (!expansion || !context || context.contextType !== 'merge-batch') {
    setFeedback('warning', '当前不在合并裁剪批次上下文下，不能执行批量打印。')
    return true
  }

  const existingJobIds = new Set(bundle.fullViewModel.printJobs.map((job) => job.printJobId))
  const result = createPrintJobsFromBatchOwnerGroups({
    expansion,
    context,
    existingDrafts: state.drafts,
    existingPrintJobs: bundle.fullViewModel.printJobs,
    existingTicketRecords: bundle.fullViewModel.ticketRecords,
    nowText: nowText(),
    printedBy: '后台打票员',
    createdBy: '后台打票员',
    includeReprint,
  })

  persistDrafts(result.nextDrafts)
  persistTicketRecords(result.nextTicketRecords)
  persistPrintJobs(result.nextPrintJobs)
  pushBatchPrintSession(result.session)

  const createdJobs = result.nextPrintJobs.filter((job) => !existingJobIds.has(job.printJobId))
  if (createdJobs.length) {
    openBatchPrintWindow(expansion, createdJobs, result.nextTicketRecords, true)
  }

  const summary = result.session.resultSummary
  setFeedback(
    summary.createdPrintJobCount > 0 ? 'success' : 'warning',
    `${includeReprint ? '批量重打' : '批量打印'}已处理 ${summary.createdPrintJobCount} 个 owner，跳过 ${summary.skippedOwnerGroups.length} 个，失败 ${summary.failedOwnerGroups.length} 个。`,
  )
  return true
}

function clearBatchContextDrafts(bundle = getDataBundle()): boolean {
  const expansion = bundle.batchExpansion
  if (!expansion) {
    setFeedback('warning', '当前没有可清理的批次级草稿会话。')
    return true
  }

  const nextDrafts = { ...state.drafts }
  expansion.ownerGroups.forEach((group) => {
    delete nextDrafts[group.originalCutOrderId]
  })
  persistDrafts(nextDrafts)
  state.activeBatchPrintSessionId = null
  setFeedback('success', `已清空批次 ${expansion.mergeBatchNo} 当前上下文下的 owner 草稿。`)
  return true
}

function cancelDraft(owner: OriginalCutOrderTicketOwner | null): boolean {
  if (!owner) return false
  if (!state.drafts[owner.originalCutOrderId]) {
    setFeedback('warning', '当前没有可取消的打印草稿。')
    return true
  }
  const nextDrafts = { ...state.drafts }
  delete nextDrafts[owner.originalCutOrderId]
  persistDrafts(nextDrafts)
  syncDraftEditor(owner)
  setFeedback('success', `${owner.originalCutOrderNo} 的打印草稿已取消。`)
  return true
}

function navigateToPayload(target: 'originalOrders' | 'mergeBatches' | 'markerSpreading' | 'replenishment' | 'summary' | 'transferBags', owner: OriginalCutOrderTicketOwner | null, context: FeiTicketsContext | null): boolean {
  const routeMap = {
    originalOrders: getCanonicalCuttingPath('original-orders'),
    mergeBatches: getCanonicalCuttingPath('merge-batches'),
    markerSpreading: getCanonicalCuttingPath('marker-spreading'),
    replenishment: getCanonicalCuttingPath('replenishment'),
    summary: getCanonicalCuttingPath('summary'),
    transferBags: getCanonicalCuttingPath('transfer-bags'),
  }

  if (!owner && !context) {
    appStore.navigate(routeMap[target])
    return true
  }

  const payload = owner?.navigationPayload ?? (context
    ? {
        originalOrders: { originalCutOrderNo: context.originalCutOrderNos[0], mergeBatchNo: context.mergeBatchNo || undefined },
        mergeBatches: { mergeBatchNo: context.mergeBatchNo || undefined },
        markerSpreading: { mergeBatchNo: context.mergeBatchNo || undefined, originalCutOrderNo: context.originalCutOrderNos[0] || undefined },
        replenishment: { mergeBatchNo: context.mergeBatchNo || undefined, originalCutOrderNo: context.originalCutOrderNos[0] || undefined },
        summary: { mergeBatchNo: context.mergeBatchNo || undefined, originalCutOrderNo: context.originalCutOrderNos[0] || undefined },
        transferBags: { mergeBatchNo: context.mergeBatchNo || undefined, originalCutOrderNo: context.originalCutOrderNos[0] || undefined },
      }
    : null)

  appStore.navigate(buildRouteWithQuery(routeMap[target], payload?.[target]))
  return true
}

function renderPage(): string {
  syncStateFromPath()
  const pathname = appStore.getState().pathname
  const meta = getCanonicalCuttingMeta(pathname, 'fei-tickets')
  const bundle = getDataBundle()
  const displayOwners = getDisplayOwners(bundle)

  return `
    <div class="space-y-4 p-4">
      ${renderCuttingPageHeader(meta, {
        actionsHtml: buildHeaderActions(bundle),
        showCompatibilityBadge: isCuttingAliasPath(pathname),
      })}
      ${renderStatsCards(bundle)}
      ${renderFeedbackBar()}
      ${renderPrefilterBar()}
      ${renderFilterStateBar()}
      ${renderContextSummary(bundle)}
      ${renderQrSchemaSummary(bundle)}
      ${renderBatchOverview(bundle)}
      ${renderBatchSessionResult(bundle)}
      ${renderFilterArea()}
      ${renderOwnersTable(displayOwners, bundle)}
      ${renderDraftWorkspace(bundle)}
      ${renderOwnerDetail(bundle)}
      ${renderPrintJobsLedger(bundle)}
    </div>
  `
}

export function renderCraftCuttingFeiTicketsPage(): string {
  return renderPage()
}

function getOwnerFromActionNode(actionNode: HTMLElement, bundle = getDataBundle()): OriginalCutOrderTicketOwner | null {
  const ownerId = actionNode.dataset.ownerId
  return ownerId ? findOwnerById(ownerId, bundle) : getActiveOwner(bundle)
}

export function handleCraftCuttingFeiTicketsEvent(target: Element): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-cutting-fei-field]')
  if (fieldNode) {
    const field = fieldNode.dataset.cuttingFeiField as OwnerFilterField | JobFilterField | 'job-keyword' | undefined
    if (!field) return false
    const input = fieldNode as HTMLInputElement | HTMLSelectElement

    if (field === 'keyword') {
      state.ownerFilters = { ...state.ownerFilters, keyword: input.value }
      return true
    }
    if (field === 'ticketStatus') {
      state.ownerFilters = { ...state.ownerFilters, ticketStatus: input.value as FeiTicketOwnerFilters['ticketStatus'] }
      return true
    }
    if (field === 'job-keyword') {
      state.jobFilters = { ...state.jobFilters, keyword: input.value }
      return true
    }
    if (field === 'status') {
      state.jobFilters = { ...state.jobFilters, status: input.value as FeiTicketJobFilters['status'] }
      return true
    }
    if (field === 'printedBy') {
      state.jobFilters = { ...state.jobFilters, printedBy: input.value }
      return true
    }
    if (field === 'printedDate') {
      state.jobFilters = { ...state.jobFilters, printedDate: input.value }
      return true
    }
  }

  const draftFieldNode = target.closest<HTMLElement>('[data-cutting-fei-draft-field]')
  if (draftFieldNode) {
    const field = draftFieldNode.dataset.cuttingFeiDraftField as DraftField | undefined
    if (!field) return false
    const input = draftFieldNode as HTMLInputElement | HTMLTextAreaElement
    if (field === 'ticketCount') {
      state.draftTicketCount = input.value
      return true
    }
    if (field === 'note') {
      state.draftNote = input.value
      return true
    }
  }

  const actionNode = target.closest<HTMLElement>('[data-cutting-fei-action]')
  const action = actionNode?.dataset.cuttingFeiAction
  if (!action) return false

  if (action === 'clear-feedback') {
    clearFeedback()
    return true
  }

  if (action === 'clear-prefilter') {
    state.prefilter = null
    state.querySignature = getCanonicalCuttingPath('fei-tickets')
    appStore.navigate(getCanonicalCuttingPath('fei-tickets'))
    return true
  }

  if (action === 'clear-filters') {
    state.ownerFilters = { ...initialOwnerFilters }
    state.jobFilters = { ...initialJobFilters }
    return true
  }

  if (action === 'refresh-ledger') {
    state.drafts = readStoredDrafts()
    state.ticketRecords = readStoredTicketRecords()
    state.printJobs = readStoredPrintJobs()
    state.batchPrintSessions = readStoredBatchPrintSessions()
    setFeedback('success', '已刷新菲票草稿与打印台账。')
    return true
  }

  if (action === 'batch-generate-drafts') {
    return handleBatchGenerateDrafts(getDataBundle())
  }

  if (action === 'batch-print-unprinted') {
    return handleBatchPrint(getDataBundle(), false)
  }

  if (action === 'batch-reprint-all') {
    return handleBatchPrint(getDataBundle(), true)
  }

  if (action === 'clear-batch-session') {
    return clearBatchContextDrafts(getDataBundle())
  }

  if (action === 'open-owner') {
    const owner = getOwnerFromActionNode(actionNode)
    if (!owner) return false
    updateActiveOwner(owner.id)
    return true
  }

  if (action === 'open-print-job') {
    const printJobId = actionNode.dataset.printJobId
    if (!printJobId) return false
    state.activePrintJobId = printJobId
    return true
  }

  if (action === 'generate-draft') {
    const bundle = getDataBundle()
    const owner = getOwnerFromActionNode(actionNode, bundle)
    if (!owner) return false
    updateActiveOwner(owner.id)
    const draft = createDraftForOwner(owner, bundle)
    if (!draft) return true
    setFeedback('success', `${owner.originalCutOrderNo} 已生成打印草稿，可继续预览或打印。`)
    return true
  }

  if (action === 'preview-draft') {
    const bundle = getDataBundle()
    const owner = getActiveOwner(bundle)
    const draft = getCurrentDraft(owner)
    if (!owner || !draft) {
      setFeedback('warning', '请先生成打印草稿，再查看预览。')
      return true
    }
    return previewDraft(owner, draft)
  }

  if (action === 'print-draft') {
    const bundle = getDataBundle()
    const owner = getActiveOwner(bundle)
    if (!owner) return false
    const draft = getCurrentDraft(owner) ?? createDraftForOwner(owner, bundle)
    if (!draft) return true
    return printDraft(owner, draft, bundle)
  }

  if (action === 'print-owner') {
    const bundle = getDataBundle()
    const owner = getOwnerFromActionNode(actionNode, bundle)
    if (!owner) return false
    updateActiveOwner(owner.id)
    const draft = getCurrentDraft(owner) ?? createDraftForOwner(owner, bundle)
    if (!draft) return true
    return printDraft(owner, draft, bundle)
  }

  if (action === 'cancel-draft') {
    return cancelDraft(getActiveOwner(getDataBundle()))
  }

  if (action === 'reprint-owner') {
    const bundle = getDataBundle()
    const owner = getOwnerFromActionNode(actionNode, bundle)
    if (!owner) return false
    updateActiveOwner(owner.id)
    const draft = createDraftForOwner(owner, bundle, { isReprint: true })
    if (!draft) return true
    setFeedback('success', `${owner.originalCutOrderNo} 已生成重打草稿，可继续预览或打印。`)
    return true
  }

  if (action === 'go-back-context') {
    const bundle = getDataBundle()
    const owner = getActiveOwner(bundle)
    if (bundle.pageViewModel.context?.contextType === 'merge-batch') {
      return navigateToPayload('mergeBatches', owner, bundle.pageViewModel.context)
    }
    return navigateToPayload('originalOrders', owner, bundle.pageViewModel.context)
  }

  if (action === 'go-single-owner-context') {
    const targetRoute = actionNode.dataset.navTarget
    if (!targetRoute) return false
    appStore.navigate(targetRoute)
    return true
  }

  if (action === 'exit-batch-context') {
    appStore.navigate(getCanonicalCuttingPath('fei-tickets'))
    return true
  }

  if (action === 'go-summary') {
    const bundle = getDataBundle()
    return navigateToPayload('summary', getOwnerFromActionNode(actionNode, bundle), bundle.pageViewModel.context)
  }

  if (action === 'go-transfer-bags') {
    const bundle = getDataBundle()
    const printJob =
      actionNode.dataset.printJobId
        ? bundle.pageViewModel.printJobs.find((job) => job.printJobId === actionNode.dataset.printJobId) ??
          bundle.fullViewModel.printJobs.find((job) => job.printJobId === actionNode.dataset.printJobId)
        : null
    const owner = printJob
      ? bundle.fullViewModel.owners.find((item) => item.originalCutOrderId === printJob.originalCutOrderIds[0]) ?? getActiveOwner(bundle)
      : getOwnerFromActionNode(actionNode, bundle)
    const selectedTicketRecordIds = printJob
      ? bundle.fullViewModel.ticketRecords
          .filter((record) => record.sourcePrintJobId === printJob.printJobId)
          .map((record) => record.ticketRecordId)
      : owner
        ? bundle.fullViewModel.ticketRecords
            .filter((record) => record.originalCutOrderId === owner.originalCutOrderId)
            .map((record) => record.ticketRecordId)
        : []

    if (selectedTicketRecordIds.length) {
      sessionStorage.setItem(
        CUTTING_TRANSFER_BAG_SELECTED_TICKET_IDS_STORAGE_KEY,
        JSON.stringify(selectedTicketRecordIds),
      )
    } else {
      sessionStorage.removeItem(CUTTING_TRANSFER_BAG_SELECTED_TICKET_IDS_STORAGE_KEY)
    }

    return navigateToPayload('transferBags', owner, bundle.pageViewModel.context)
  }

  if (action === 'go-original-orders') {
    const bundle = getDataBundle()
    return navigateToPayload('originalOrders', getOwnerFromActionNode(actionNode, bundle), bundle.pageViewModel.context)
  }

  if (action === 'go-merge-batches') {
    const bundle = getDataBundle()
    return navigateToPayload('mergeBatches', getOwnerFromActionNode(actionNode, bundle), bundle.pageViewModel.context)
  }

  if (action === 'go-marker-spreading') {
    const bundle = getDataBundle()
    return navigateToPayload('markerSpreading', getOwnerFromActionNode(actionNode, bundle), bundle.pageViewModel.context)
  }

  if (action === 'go-original-orders-index') {
    appStore.navigate(getCanonicalCuttingPath('original-orders'))
    return true
  }

  if (action === 'go-merge-batches-index') {
    appStore.navigate(getCanonicalCuttingPath('merge-batches'))
    return true
  }

  return false
}
