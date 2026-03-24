import { cuttingOrderProgressRecords } from '../../../data/fcs/cutting/order-progress'
import { appStore } from '../../../state/store'
import { escapeHtml, formatDateTime } from '../../../utils'
import {
  buildSystemSeedFeiTicketLedger,
  CUTTING_FEI_TICKET_RECORDS_STORAGE_KEY,
  deserializeFeiTicketRecordsStorage,
  type FeiTicketLabelRecord,
} from './fei-tickets-model'
import {
  CUTTING_MARKER_SPREADING_LEDGER_STORAGE_KEY,
  deserializeMarkerSpreadingStorage,
} from './marker-spreading-model'
import { buildMaterialPrepViewModel } from './material-prep-model'
import {
  renderCompactKpiCard,
  renderStickyFilterShell,
  renderStickyTableScroller,
  renderWorkbenchFilterChip,
  renderWorkbenchSecondaryPanel,
  renderWorkbenchStateBar,
} from './layout.helpers'
import { getCanonicalCuttingMeta, getCanonicalCuttingPath, renderCuttingPageHeader } from './meta'
import {
  buildWarehouseOriginalRows,
  buildWarehouseRouteWithQuery,
  getWarehouseSearchParams,
  readWarehouseMergeBatchLedger,
} from './warehouse-shared'
import {
  buildBagUsageAuditTrail,
  buildSystemSeedTransferBagStore,
  buildTransferBagNavigationPayload,
  buildTransferBagParentChildSummary,
  buildTransferBagViewModel,
  createTransferBagDispatchManifest,
  createTransferBagUsageDraft,
  CUTTING_TRANSFER_BAG_LEDGER_STORAGE_KEY,
  CUTTING_TRANSFER_BAG_SELECTED_TICKET_IDS_STORAGE_KEY,
  deriveTransferBagMasterStatus,
  deriveTransferBagUsageStatus,
  deserializeTransferBagSelectedTicketIds,
  deserializeTransferBagStorage,
  mergeTransferBagStores,
  serializeTransferBagSelectedTicketIds,
  serializeTransferBagStorage,
  validateBagToSewingTaskBinding,
  validateTicketBindingEligibility,
  type SewingTaskRef,
  type TransferBagBindingItem,
  type TransferBagItemBinding,
  type TransferBagMaster,
  type TransferBagMasterItem,
  type TransferBagMasterStatusKey,
  type TransferBagPrefilter,
  type TransferBagStore,
  type TransferBagTicketCandidate,
  type TransferBagUsage,
  type TransferBagUsageItem,
  type TransferBagUsageStatusKey,
} from './transfer-bags-model'
import {
  buildBagReturnAuditTrail,
  buildReuseCycleSummary,
  buildReturnExceptionMeta,
  buildTransferBagReturnViewModel,
  closeTransferBagUsageCycle,
  createReturnReceiptDraft,
  deriveBagConditionDecision,
  deriveReturnEligibility,
  validateReturnReceiptPayload,
  type TransferBagConditionRecord,
  type TransferBagConditionStatus,
  type TransferBagDiscrepancyType,
  type TransferBagReusableDecision,
  type TransferBagReturnReceipt,
} from './transfer-bag-return-model'

type MasterStatusFilter = 'ALL' | TransferBagMasterStatusKey

type UsageStatusFilter = 'ALL' | TransferBagUsageStatusKey
type ReturnStatusFilter = 'ALL' | 'WAITING_RETURN' | 'RETURN_INSPECTING' | 'CLOSED' | 'EXCEPTION_CLOSED'

type FeedbackTone = 'success' | 'warning'

type MasterFilterField = 'keyword' | 'status'
type UsageFilterField = 'keyword' | 'status' | 'sewingTask'
type WorkbenchField = 'bagId' | 'bagCodeInput' | 'sewingTaskId' | 'ticketInput' | 'note'
type ReturnFilterField = 'keyword' | 'status'
type ReturnDraftField =
  | 'returnWarehouseName'
  | 'returnAt'
  | 'returnedBy'
  | 'receivedBy'
  | 'returnedFinishedQty'
  | 'returnedTicketCountSummary'
  | 'discrepancyType'
  | 'discrepancyNote'
  | 'note'
type ConditionDraftField = 'conditionStatus' | 'cleanlinessStatus' | 'damageType' | 'reusableDecision' | 'note'

type FeedbackState = {
  tone: FeedbackTone
  message: string
} | null

interface TransferBagsPageState {
  store: TransferBagStore
  masterKeyword: string
  masterStatus: MasterStatusFilter
  usageKeyword: string
  usageStatus: UsageStatusFilter
  usageSewingTaskId: string
  returnKeyword: string
  returnStatus: ReturnStatusFilter
  bindingKeyword: string
  activeMasterId: string | null
  activeUsageId: string | null
  prefilter: TransferBagPrefilter | null
  querySignature: string
  preselectedTicketRecordIds: string[]
  draft: {
    bagId: string
    bagCodeInput: string
    sewingTaskId: string
    ticketInput: string
    note: string
  }
  returnDraft: {
    returnWarehouseName: string
    returnAt: string
    returnedBy: string
    receivedBy: string
    returnedFinishedQty: string
    returnedTicketCountSummary: string
    discrepancyType: TransferBagDiscrepancyType
    discrepancyNote: string
    note: string
  }
  conditionDraft: {
    conditionStatus: TransferBagConditionStatus
    cleanlinessStatus: 'CLEAN' | 'DIRTY'
    damageType: string
    repairNeeded: boolean
    reusableDecision: TransferBagReusableDecision
    note: string
  }
  feedback: FeedbackState
}

function nowText(date = new Date()): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hours = `${date.getHours()}`.padStart(2, '0')
  const minutes = `${date.getMinutes()}`.padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))))
}

function loadTicketRecords(): FeiTicketLabelRecord[] {
  const mergeBatches = readWarehouseMergeBatchLedger()
  const originalRows = buildWarehouseOriginalRows()
  const markerStore = deserializeMarkerSpreadingStorage(localStorage.getItem(CUTTING_MARKER_SPREADING_LEDGER_STORAGE_KEY))
  const materialRows = buildMaterialPrepViewModel(cuttingOrderProgressRecords, mergeBatches).rows
  const seed = buildSystemSeedFeiTicketLedger({
    originalRows,
    materialRows,
    markerStore,
    mergeBatches,
  }).ticketRecords
  const stored = deserializeFeiTicketRecordsStorage(localStorage.getItem(CUTTING_FEI_TICKET_RECORDS_STORAGE_KEY))
  const merged = new Map<string, FeiTicketLabelRecord>()
  seed.forEach((record) => merged.set(record.ticketRecordId, record))
  stored.forEach((record) => merged.set(record.ticketRecordId, record))
  return Array.from(merged.values()).sort((left, right) => left.ticketNo.localeCompare(right.ticketNo, 'zh-CN'))
}

function hydrateStore(): TransferBagStore {
  const originalRows = buildWarehouseOriginalRows()
  const mergeBatches = readWarehouseMergeBatchLedger()
  const ticketRecords = loadTicketRecords()
  const seed = buildSystemSeedTransferBagStore({
    originalRows,
    ticketRecords,
    mergeBatches,
  })
  const stored = deserializeTransferBagStorage(localStorage.getItem(CUTTING_TRANSFER_BAG_LEDGER_STORAGE_KEY))
  return mergeTransferBagStores(seed, stored)
}

const state: TransferBagsPageState = {
  store: hydrateStore(),
  masterKeyword: '',
  masterStatus: 'ALL',
  usageKeyword: '',
  usageStatus: 'ALL',
  usageSewingTaskId: 'ALL',
  returnKeyword: '',
  returnStatus: 'ALL',
  bindingKeyword: '',
  activeMasterId: null,
  activeUsageId: null,
  prefilter: null,
  querySignature: '',
  preselectedTicketRecordIds: deserializeTransferBagSelectedTicketIds(
    sessionStorage.getItem(CUTTING_TRANSFER_BAG_SELECTED_TICKET_IDS_STORAGE_KEY),
  ),
  draft: {
    bagId: '',
    bagCodeInput: '',
    sewingTaskId: '',
    ticketInput: '',
    note: '',
  },
  returnDraft: {
    returnWarehouseName: '',
    returnAt: '',
    returnedBy: '',
    receivedBy: '',
    returnedFinishedQty: '',
    returnedTicketCountSummary: '',
    discrepancyType: 'NONE',
    discrepancyNote: '',
    note: '',
  },
  conditionDraft: {
    conditionStatus: 'GOOD',
    cleanlinessStatus: 'CLEAN',
    damageType: '',
    repairNeeded: false,
    reusableDecision: 'REUSABLE',
    note: '',
  },
  feedback: null,
}

function getViewModel() {
  return buildTransferBagViewModel({
    originalRows: buildWarehouseOriginalRows(),
    ticketRecords: loadTicketRecords(),
    mergeBatches: readWarehouseMergeBatchLedger(),
    store: state.store,
  })
}

function getReturnViewModel() {
  return buildTransferBagReturnViewModel({
    store: state.store,
    baseViewModel: getViewModel(),
  })
}

function persistStore(): void {
  localStorage.setItem(CUTTING_TRANSFER_BAG_LEDGER_STORAGE_KEY, serializeTransferBagStorage(state.store))
}

function persistSelectedTicketIds(): void {
  if (state.preselectedTicketRecordIds.length) {
    sessionStorage.setItem(
      CUTTING_TRANSFER_BAG_SELECTED_TICKET_IDS_STORAGE_KEY,
      serializeTransferBagSelectedTicketIds(state.preselectedTicketRecordIds),
    )
  } else {
    sessionStorage.removeItem(CUTTING_TRANSFER_BAG_SELECTED_TICKET_IDS_STORAGE_KEY)
  }
}

function setFeedback(tone: FeedbackTone, message: string): void {
  state.feedback = { tone, message }
}

function syncReusableDecisionSuggestion(): void {
  const suggested = deriveBagConditionDecision({
    conditionStatus: state.conditionDraft.conditionStatus,
    cleanlinessStatus: state.conditionDraft.cleanlinessStatus,
    damageType: state.conditionDraft.damageType,
    repairNeeded: state.conditionDraft.repairNeeded,
  })
  state.conditionDraft = {
    ...state.conditionDraft,
    reusableDecision: suggested.reusableDecision,
  }
}

function matchPrefilter(itemValues: Array<string | undefined>, search?: string): boolean {
  if (!search) return true
  return itemValues.some((value) => value?.includes(search))
}

function matchesMasterPrefilter(item: TransferBagMasterItem): boolean {
  if (!state.prefilter) return true
  return matchPrefilter([item.bagCode, item.latestUsageNo], state.prefilter.bagCode || state.prefilter.usageNo)
}

function matchesUsagePrefilter(item: TransferBagUsageItem): boolean {
  if (!state.prefilter) return true
  return (
    matchPrefilter(item.originalCutOrderNos, state.prefilter.originalCutOrderNo) &&
    matchPrefilter(item.mergeBatchNos, state.prefilter.mergeBatchNo) &&
    matchPrefilter([item.sewingTaskNo], state.prefilter.sewingTaskNo) &&
    matchPrefilter([item.bagCode], state.prefilter.bagCode) &&
    matchPrefilter([item.usageNo], state.prefilter.usageNo)
  )
}

function matchesBindingPrefilter(item: TransferBagBindingItem): boolean {
  if (!state.prefilter) return true
  return (
    matchPrefilter([item.ticketNo], state.prefilter.ticketNo) &&
    matchPrefilter([item.originalCutOrderNo], state.prefilter.originalCutOrderNo) &&
    matchPrefilter([item.mergeBatchNo], state.prefilter.mergeBatchNo) &&
    matchPrefilter([item.bagCode], state.prefilter.bagCode) &&
    matchPrefilter([item.usage?.usageNo], state.prefilter.usageNo)
  )
}

function getFilteredMasters() {
  const keyword = state.masterKeyword.trim().toLowerCase()
  return getViewModel().masters.filter((item) => {
    if (state.masterStatus !== 'ALL' && item.currentStatus !== state.masterStatus) return false
    if (!matchesMasterPrefilter(item)) return false
    if (keyword) {
      const haystack = [item.bagCode, item.bagType, item.currentLocation, item.latestUsageNo, item.note].join(' ').toLowerCase()
      if (!haystack.includes(keyword)) return false
    }
    return true
  })
}

function getFilteredUsages() {
  const keyword = state.usageKeyword.trim().toLowerCase()
  return getViewModel().usages.filter((item) => {
    if (state.usageStatus !== 'ALL' && item.usageStatus !== state.usageStatus) return false
    if (state.usageSewingTaskId !== 'ALL' && item.sewingTaskId !== state.usageSewingTaskId) return false
    if (!matchesUsagePrefilter(item)) return false
    if (keyword) {
      const haystack = [
        item.usageNo,
        item.bagCode,
        item.sewingTaskNo,
        item.sewingFactoryName,
        item.styleCode,
        item.spuCode,
        item.ticketNos.join(' '),
        item.originalCutOrderNos.join(' '),
      ]
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(keyword)) return false
    }
    return true
  })
}

function getFilteredBindings() {
  const keyword = state.bindingKeyword.trim().toLowerCase()
  return getViewModel().bindings.filter((item) => {
    if (!matchesBindingPrefilter(item)) return false
    if (keyword) {
      const haystack = [
        item.bagCode,
        item.ticketNo,
        item.originalCutOrderNo,
        item.productionOrderNo,
        item.mergeBatchNo,
        item.usage?.usageNo,
      ]
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(keyword)) return false
    }
    return true
  })
}

function getPrefilterFromQuery(): TransferBagPrefilter | null {
  const params = getWarehouseSearchParams()
  const prefilter: TransferBagPrefilter = {
    originalCutOrderNo: params.get('originalCutOrderNo') || undefined,
    mergeBatchNo: params.get('mergeBatchNo') || undefined,
    cuttingGroup: params.get('cuttingGroup') || undefined,
    warehouseStatus: params.get('warehouseStatus') || undefined,
    ticketNo: params.get('ticketNo') || undefined,
    sewingTaskNo: params.get('sewingTaskNo') || undefined,
    bagCode: params.get('bagCode') || undefined,
    usageNo: params.get('usageNo') || undefined,
    returnStatus: params.get('returnStatus') || undefined,
  }

  return Object.values(prefilter).some(Boolean) ? prefilter : null
}

function getActiveMaster(): TransferBagMasterItem | null {
  if (!state.activeMasterId) return null
  return getViewModel().mastersById[state.activeMasterId] ?? null
}

function getActiveUsage(): TransferBagUsageItem | null {
  if (!state.activeUsageId) return null
  return getViewModel().usagesById[state.activeUsageId] ?? null
}

function getSourceMaster(bagId: string | null): TransferBagMaster | null {
  if (!bagId) return null
  return state.store.masters.find((item) => item.bagId === bagId) ?? null
}

function getSourceUsage(usageId: string | null): TransferBagUsage | null {
  if (!usageId) return null
  return state.store.usages.find((item) => item.usageId === usageId) ?? null
}

function getSelectedBag(): TransferBagMaster | null {
  const bagId = state.draft.bagId || getActiveUsage()?.bagId || getActiveMaster()?.bagId || ''
  if (bagId) return getSourceMaster(bagId)
  const code = state.draft.bagCodeInput.trim()
  if (!code) return null
  return state.store.masters.find((item) => item.bagCode === code) ?? null
}

function getSelectedSewingTask(): SewingTaskRef | null {
  const sewingTaskId = state.draft.sewingTaskId || getActiveUsage()?.sewingTaskId || ''
  if (!sewingTaskId) return null
  return getViewModel().sewingTasksById[sewingTaskId] ?? null
}

function getCandidateTickets(): TransferBagTicketCandidate[] {
  const viewModel = getViewModel()
  if (state.preselectedTicketRecordIds.length) {
    return state.preselectedTicketRecordIds
      .map((id) => viewModel.ticketCandidatesById[id])
      .filter((item): item is TransferBagTicketCandidate => Boolean(item))
  }

  if (!state.prefilter) return []

  return viewModel.ticketCandidates.filter((ticket) => {
    if (state.prefilter.ticketNo && ticket.ticketNo !== state.prefilter.ticketNo) return false
    if (state.prefilter.originalCutOrderNo && ticket.originalCutOrderNo !== state.prefilter.originalCutOrderNo) return false
    if (state.prefilter.mergeBatchNo && ticket.mergeBatchNo !== state.prefilter.mergeBatchNo) return false
    return true
  })
}

function refreshDerivedState(): void {
  const usageMap = new Map<string, TransferBagItemBinding[]>()
  const closureMap = new Map<string, typeof state.store.closureResults>()
  state.store.bindings.forEach((binding) => {
    const current = usageMap.get(binding.usageId)
    if (current) {
      current.push(binding)
    } else {
      usageMap.set(binding.usageId, [binding])
    }
  })

  state.store.usages.forEach((usage) => {
    const bindings = usageMap.get(usage.usageId) || []
    usage.packedTicketCount = bindings.length
    usage.packedOriginalCutOrderCount = uniqueStrings(bindings.map((item) => item.originalCutOrderNo)).length
    if (usage.usageStatus === 'DRAFT' || usage.usageStatus === 'PACKING' || usage.usageStatus === 'READY_TO_DISPATCH') {
      if (!bindings.length) {
      usage.usageStatus = 'DRAFT'
      } else if (usage.usageStatus !== 'READY_TO_DISPATCH') {
        usage.usageStatus = 'PACKING'
      }
    }
  })

  state.store.closureResults.forEach((closure) => {
    const current = closureMap.get(closure.usageId)
    if (current) {
      current.push(closure)
    } else {
      closureMap.set(closure.usageId, [closure])
    }
  })

  state.store.masters.forEach((master) => {
    const relatedUsages = state.store.usages.filter((usage) => usage.bagId === master.bagId)
    const latestUsage = relatedUsages.sort((left, right) => right.usageNo.localeCompare(left.usageNo, 'zh-CN'))[0] || null
    if (!latestUsage) {
      master.currentStatus = 'IDLE'
      master.latestUsageId = ''
      master.latestUsageNo = ''
      return
    }

    master.latestUsageId = latestUsage.usageId
    master.latestUsageNo = latestUsage.usageNo
    const latestClosure = (closureMap.get(latestUsage.usageId) || []).sort((left, right) => right.closedAt.localeCompare(left.closedAt, 'zh-CN'))[0] || null
    if (latestUsage.usageStatus === 'DISPATCHED') {
      master.currentStatus = 'DISPATCHED'
      master.currentLocation = latestUsage.sewingFactoryName || '车缝工厂待确认'
    } else if (latestUsage.usageStatus === 'PENDING_SIGNOFF') {
      master.currentStatus = 'WAITING_SIGNOFF'
      master.currentLocation = latestUsage.sewingFactoryName || '待签收工厂'
    } else if (latestUsage.usageStatus === 'WAITING_RETURN') {
      master.currentStatus = 'WAITING_RETURN'
      master.currentLocation = latestUsage.sewingFactoryName || '待回仓工厂'
    } else if (latestUsage.usageStatus === 'RETURN_INSPECTING') {
      master.currentStatus = 'RETURN_INSPECTING'
      master.currentLocation = '裁片仓回货验收区'
    } else if (latestUsage.usageStatus === 'CLOSED' || latestUsage.usageStatus === 'EXCEPTION_CLOSED') {
      master.currentStatus = latestClosure?.nextBagStatus || 'REUSABLE'
      master.currentLocation =
        latestClosure?.nextBagStatus === 'WAITING_CLEANING'
          ? '裁片仓待清洁区'
          : latestClosure?.nextBagStatus === 'WAITING_REPAIR'
            ? '维修待处理区'
            : latestClosure?.nextBagStatus === 'DISABLED'
              ? '停用隔离区'
              : '裁片仓复用位'
    } else {
      master.currentStatus = 'IN_USE'
      master.currentLocation = '车缝交接待发区'
    }
  })

  state.store.reuseCycles = state.store.masters.map((master) =>
    buildReuseCycleSummary({
      bag: master,
      usages: state.store.usages,
      returnReceipts: state.store.returnReceipts,
      closureResults: state.store.closureResults,
    }),
  )
}

function syncPrefilterFromQuery(): void {
  const pathname = appStore.getState().pathname
  if (pathname === state.querySignature) return
  state.querySignature = pathname
  state.prefilter = getPrefilterFromQuery()
  state.preselectedTicketRecordIds = deserializeTransferBagSelectedTicketIds(
    sessionStorage.getItem(CUTTING_TRANSFER_BAG_SELECTED_TICKET_IDS_STORAGE_KEY),
  )
  const viewModel = getViewModel()

  if (state.prefilter?.bagCode) {
    const matchedMaster = viewModel.masters.find((item) => item.bagCode === state.prefilter?.bagCode)
    state.activeMasterId = matchedMaster?.bagId ?? null
    state.draft.bagCodeInput = state.prefilter.bagCode
    state.draft.bagId = matchedMaster?.bagId ?? ''
  }

  if (state.prefilter?.usageNo) {
    const matchedUsage = viewModel.usages.find((item) => item.usageNo === state.prefilter?.usageNo)
    if (matchedUsage) {
      syncUsageSelection(matchedUsage.usageId)
    } else {
      state.activeUsageId = null
    }
  }

  if (state.prefilter?.sewingTaskNo) {
    const matchedTask = viewModel.sewingTasks.find((item) => item.sewingTaskNo === state.prefilter?.sewingTaskNo)
    state.draft.sewingTaskId = matchedTask?.sewingTaskId ?? state.draft.sewingTaskId
  }

  if (state.prefilter?.returnStatus && ['WAITING_RETURN', 'RETURN_INSPECTING', 'CLOSED', 'EXCEPTION_CLOSED'].includes(state.prefilter.returnStatus)) {
    state.returnStatus = state.prefilter.returnStatus as ReturnStatusFilter
  }

  if (state.prefilter?.ticketNo) {
    state.draft.ticketInput = state.prefilter.ticketNo
  }
}

function resetReturnDraft(usageId?: string | null): void {
  const usage = usageId ? getViewModel().usagesById[usageId] ?? null : null
  const latestReceipt = usage ? (getReturnViewModel().returnReceiptsByUsageId[usage.usageId] || []).slice().sort((left, right) => right.returnAt.localeCompare(left.returnAt, 'zh-CN'))[0] || null : null
  const latestCondition = usage ? (getReturnViewModel().conditionRecordsByUsageId[usage.usageId] || []).slice().sort((left, right) => right.inspectedAt.localeCompare(left.inspectedAt, 'zh-CN'))[0] || null : null

  if (!usage) {
    state.returnDraft = {
      returnWarehouseName: '',
      returnAt: '',
      returnedBy: '',
      receivedBy: '',
      returnedFinishedQty: '',
      returnedTicketCountSummary: '',
      discrepancyType: 'NONE',
      discrepancyNote: '',
      note: '',
    }
    state.conditionDraft = {
      conditionStatus: 'GOOD',
      cleanlinessStatus: 'CLEAN',
      damageType: '',
      repairNeeded: false,
      reusableDecision: 'REUSABLE',
      note: '',
    }
    return
  }

  if (latestReceipt) {
    state.returnDraft = {
      returnWarehouseName: latestReceipt.returnWarehouseName,
      returnAt: latestReceipt.returnAt,
      returnedBy: latestReceipt.returnedBy,
      receivedBy: latestReceipt.receivedBy,
      returnedFinishedQty: String(latestReceipt.returnedFinishedQty),
      returnedTicketCountSummary: String(latestReceipt.returnedTicketCountSummary),
      discrepancyType: latestReceipt.discrepancyType,
      discrepancyNote: latestReceipt.discrepancyNote,
      note: latestReceipt.note,
    }
  } else {
    const bindings = getViewModel().bindingsByUsageId[usage.usageId] || []
    const draft = createReturnReceiptDraft({
      usage: getSourceUsage(usage.usageId) || usage,
      bindingsCount: bindings.length,
      originalCutOrderCount: uniqueStrings(bindings.map((item) => item.originalCutOrderNo)).length,
      nowText: nowText(),
    })
    state.returnDraft = {
      returnWarehouseName: draft.returnWarehouseName,
      returnAt: draft.returnAt,
      returnedBy: draft.returnedBy,
      receivedBy: draft.receivedBy,
      returnedFinishedQty: String(draft.returnedFinishedQty),
      returnedTicketCountSummary: String(draft.returnedTicketCountSummary),
      discrepancyType: draft.discrepancyType,
      discrepancyNote: draft.discrepancyNote,
      note: draft.note,
    }
  }

  if (latestCondition) {
    state.conditionDraft = {
      conditionStatus: latestCondition.conditionStatus,
      cleanlinessStatus: latestCondition.cleanlinessStatus,
      damageType: latestCondition.damageType,
      repairNeeded: latestCondition.repairNeeded,
      reusableDecision: latestCondition.reusableDecision,
      note: latestCondition.note,
    }
  } else {
    state.conditionDraft = {
      conditionStatus: 'GOOD',
      cleanlinessStatus: 'CLEAN',
      damageType: '',
      repairNeeded: false,
      reusableDecision: 'REUSABLE',
      note: '',
    }
  }
  syncReusableDecisionSuggestion()
}

function renderTag(label: string, className: string): string {
  return `<span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}">${escapeHtml(label)}</span>`
}

function renderHeaderActions(): string {
  return `
    <div class="flex flex-wrap items-center gap-2">
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="go-cut-piece-warehouse-index">返回裁片仓</button>
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="go-fei-tickets-index">去菲票 / 打编号</button>
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="go-summary-index">查看裁剪总结</button>
    </div>
  `
}

function renderStatsCards(): string {
  const summary = getViewModel().summary
  return `
    <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
      ${renderCompactKpiCard('周转口袋总数', summary.bagCount, '当前载具主档数量', 'text-slate-900')}
      ${renderCompactKpiCard('空闲口袋数', summary.idleBagCount, '可继续创建 usage', 'text-emerald-600')}
      ${renderCompactKpiCard('使用中口袋数', summary.inUseBagCount, '仍在装袋或待发出', 'text-blue-600')}
      ${renderCompactKpiCard('待发出 usage 数', summary.readyDispatchUsageCount, '已装袋待交接', 'text-violet-600')}
      ${renderCompactKpiCard('已发出 usage 数', summary.dispatchedUsageCount, '已完成发出动作', 'text-sky-600')}
      ${renderCompactKpiCard('待签收 usage 数', summary.pendingSignoffCount, '等待后道签收', 'text-amber-600')}
    </section>
  `
}

function renderReturnStatsCards(): string {
  const summary = getReturnViewModel().summary
  return `
    <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
      ${renderCompactKpiCard('待回仓 usage 数', summary.waitingReturnUsageCount, '已发出后等待返仓', 'text-orange-600')}
      ${renderCompactKpiCard('回仓验收中 usage 数', summary.inspectingUsageCount, '已进入回货与袋况确认', 'text-cyan-600')}
      ${renderCompactKpiCard('已关闭 usage 数', summary.closedUsageCount, '已形成完整使用周期', 'text-emerald-600')}
      ${renderCompactKpiCard('可复用 bag 数', summary.reusableBagCount, '已完成验收并释放', 'text-emerald-600')}
      ${renderCompactKpiCard('待清洁 bag 数', summary.waitingCleaningBagCount, '需清洁后再发放', 'text-sky-600')}
      ${renderCompactKpiCard('待维修 bag 数', summary.waitingRepairBagCount, '需维修后再决定复用', 'text-rose-600')}
    </section>
  `
}

function renderPrefilterBar(): string {
  const chips: string[] = []
  if (state.prefilter?.originalCutOrderNo) chips.push(`原始裁片单：${state.prefilter.originalCutOrderNo}`)
  if (state.prefilter?.mergeBatchNo) chips.push(`批次：${state.prefilter.mergeBatchNo}`)
  if (state.prefilter?.ticketNo) chips.push(`菲票：${state.prefilter.ticketNo}`)
  if (state.prefilter?.bagCode) chips.push(`口袋码：${state.prefilter.bagCode}`)
  if (state.prefilter?.usageNo) chips.push(`usage：${state.prefilter.usageNo}`)
  if (state.prefilter?.sewingTaskNo) chips.push(`车缝任务：${state.prefilter.sewingTaskNo}`)
  if (state.prefilter?.cuttingGroup) chips.push(`裁床组：${state.prefilter.cuttingGroup}`)
  if (state.prefilter?.warehouseStatus) chips.push(`仓状态：${state.prefilter.warehouseStatus}`)
  if (state.prefilter?.returnStatus) chips.push(`回货状态：${state.prefilter.returnStatus}`)
  if (state.preselectedTicketRecordIds.length) chips.push(`预选菲票：${state.preselectedTicketRecordIds.length} 张`)
  if (!chips.length) return ''

  return renderWorkbenchStateBar({
    summary: '当前按外部上下文预填周转口袋交接工作台',
    chips: chips.map((label) => renderWorkbenchFilterChip(label, 'data-transfer-bags-action="clear-prefill"', 'amber')),
    clearAttrs: 'data-transfer-bags-action="clear-prefill"',
  })
}

function renderFeedbackBar(): string {
  if (!state.feedback) return ''
  const toneClass =
    state.feedback.tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : 'border-amber-200 bg-amber-50 text-amber-700'

  return `
    <section class="rounded-lg border px-3 py-2 text-sm ${toneClass}">
      ${escapeHtml(state.feedback.message)}
    </section>
  `
}

function renderMasterSection(): string {
  const items = getFilteredMasters()
  const active = getActiveMaster()
  return `
    <section class="space-y-3 rounded-lg border bg-card p-3">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="text-sm font-semibold text-foreground">周转口袋主档</h2>
          <p class="mt-1 text-xs text-muted-foreground">周转口袋 / 周转箱是独立载具实体，不承接裁片 owner 身份，仅承接当前使用周期与位置状态。</p>
        </div>
      </div>
      ${renderStickyFilterShell(`
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label class="space-y-2 xl:col-span-3">
            <span class="text-sm font-medium text-foreground">关键词</span>
            <input
              type="text"
              value="${escapeHtml(state.masterKeyword)}"
              placeholder="支持 bagCode / bagType / 位置 / latestUsageNo"
              class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              data-transfer-bags-master-field="keyword"
            />
          </label>
          <label class="space-y-2">
            <span class="text-sm font-medium text-foreground">状态筛选</span>
            <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-master-field="status">
              <option value="ALL" ${state.masterStatus === 'ALL' ? 'selected' : ''}>全部</option>
              <option value="IDLE" ${state.masterStatus === 'IDLE' ? 'selected' : ''}>空闲</option>
              <option value="IN_USE" ${state.masterStatus === 'IN_USE' ? 'selected' : ''}>使用中</option>
              <option value="DISPATCHED" ${state.masterStatus === 'DISPATCHED' ? 'selected' : ''}>已发出</option>
              <option value="WAITING_SIGNOFF" ${state.masterStatus === 'WAITING_SIGNOFF' ? 'selected' : ''}>待签收</option>
              <option value="WAITING_RETURN" ${state.masterStatus === 'WAITING_RETURN' ? 'selected' : ''}>待回仓</option>
              <option value="RETURN_INSPECTING" ${state.masterStatus === 'RETURN_INSPECTING' ? 'selected' : ''}>回仓验收中</option>
              <option value="REUSABLE" ${state.masterStatus === 'REUSABLE' ? 'selected' : ''}>可复用</option>
              <option value="WAITING_CLEANING" ${state.masterStatus === 'WAITING_CLEANING' ? 'selected' : ''}>待清洁</option>
              <option value="WAITING_REPAIR" ${state.masterStatus === 'WAITING_REPAIR' ? 'selected' : ''}>待维修</option>
              <option value="DISABLED" ${state.masterStatus === 'DISABLED' ? 'selected' : ''}>停用 / 报废</option>
            </select>
          </label>
        </div>
      `)}
      ${!items.length
        ? '<div class="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">当前没有匹配的口袋主档记录。</div>'
        : renderStickyTableScroller(`
            <table class="min-w-full text-sm">
              <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th class="px-4 py-3 text-left">bagCode</th>
                  <th class="px-4 py-3 text-left">载具类型</th>
                  <th class="px-4 py-3 text-right">容量</th>
                  <th class="px-4 py-3 text-left">当前状态</th>
                  <th class="px-4 py-3 text-left">当前位置</th>
                  <th class="px-4 py-3 text-left">最新 usage</th>
                  <th class="px-4 py-3 text-left">操作</th>
                </tr>
              </thead>
              <tbody>
                ${items
                  .map(
                    (item) => `
                      <tr class="border-b ${state.activeMasterId === item.bagId ? 'bg-blue-50/60' : 'bg-card'}">
                        <td class="px-4 py-3">
                          <button type="button" class="font-medium text-blue-700 hover:underline" data-transfer-bags-action="select-master" data-bag-id="${escapeHtml(item.bagId)}">${escapeHtml(item.bagCode)}</button>
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.note || '无额外备注')}</div>
                        </td>
                        <td class="px-4 py-3">${escapeHtml(item.bagType)}</td>
                        <td class="px-4 py-3 text-right tabular-nums">${escapeHtml(String(item.capacity))}</td>
                        <td class="px-4 py-3">${renderTag(item.statusMeta.label, item.statusMeta.className)}</td>
                        <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(item.currentLocation || '待命位')}</td>
                        <td class="px-4 py-3">
                          <div class="font-medium text-foreground">${escapeHtml(item.latestUsageNo || '暂无 usage')}</div>
                          <div class="mt-1 text-xs text-muted-foreground">${item.latestUsageStatusMeta ? escapeHtml(item.latestUsageStatusMeta.label) : '尚未进入使用周期'}</div>
                        </td>
                        <td class="px-4 py-3">
                          <div class="flex flex-wrap gap-2">
                            <button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-transfer-bags-action="use-master" data-bag-id="${escapeHtml(item.bagId)}">用于装袋</button>
                            <button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-transfer-bags-action="select-master" data-bag-id="${escapeHtml(item.bagId)}">查看详情</button>
                          </div>
                        </td>
                      </tr>
                    `,
                  )
                  .join('')}
              </tbody>
            </table>
          `)}
      ${renderMasterDetail(active)}
    </section>
  `
}

function renderMasterDetail(item: TransferBagMasterItem | null): string {
  if (!item) return ''
  return renderWorkbenchSecondaryPanel({
    title: `口袋详情：${item.bagCode}`,
    hint: '当前展示载具主档与最新 usage 摘要；回货入仓与复用闭环请在下方回货区处理。',
    defaultOpen: true,
    body: `
      <div class="grid gap-3 lg:grid-cols-2">
        <div class="space-y-3 rounded-lg border bg-muted/15 p-3 text-sm">
          <div><span class="text-muted-foreground">载具类型：</span><span class="font-medium text-foreground">${escapeHtml(item.bagType)}</span></div>
          <div><span class="text-muted-foreground">容量：</span><span class="font-medium text-foreground">${escapeHtml(String(item.capacity))} 张菲票</span></div>
          <div><span class="text-muted-foreground">当前状态：</span>${renderTag(item.statusMeta.label, item.statusMeta.className)}</div>
          <div><span class="text-muted-foreground">当前位置：</span><span class="font-medium text-foreground">${escapeHtml(item.currentLocation || '待命位')}</span></div>
        </div>
        <div class="space-y-3 rounded-lg border bg-muted/15 p-3 text-sm">
          <div><span class="text-muted-foreground">最新 usage：</span><span class="font-medium text-foreground">${escapeHtml(item.latestUsageNo || '暂无')}</span></div>
          <div><span class="text-muted-foreground">当前装袋数：</span><span class="font-medium text-foreground">${escapeHtml(String(item.packedTicketCount))}</span></div>
          <div><span class="text-muted-foreground">涉及原始裁片单数：</span><span class="font-medium text-foreground">${escapeHtml(String(item.packedOriginalCutOrderCount))}</span></div>
          <div class="flex flex-wrap gap-2">
            <button type="button" class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-transfer-bags-action="use-master" data-bag-id="${escapeHtml(item.bagId)}">将此口袋带入装袋工作台</button>
          </div>
        </div>
      </div>
    `,
  })
}

function renderWorkbenchSection(): string {
  const activeUsage = getActiveUsage()
  const selectedBag = getSelectedBag()
  const selectedTask = getSelectedSewingTask()
  const candidateTickets = getCandidateTickets()
  const currentBindings = activeUsage ? getViewModel().bindingsByUsageId[activeUsage.usageId] || [] : []
  const currentSummary = activeUsage ? buildTransferBagParentChildSummary(currentBindings) : null
  const capacityExceeded = Boolean(activeUsage && selectedBag && currentSummary && currentSummary.ticketCount > selectedBag.capacity)

  return `
    <section class="grid gap-3 xl:grid-cols-[1.1fr,0.9fr]">
      <article class="space-y-3 rounded-lg border bg-card p-3">
        <div>
          <h2 class="text-sm font-semibold text-foreground">装袋工作台</h2>
          <p class="mt-1 text-xs text-muted-foreground">先确定 bag 与车缝任务，再建立口袋码（父码）与菲票码（子码）的绑定关系。一个 usage 只能绑定一个车缝任务。</p>
        </div>
        <div class="grid gap-3 md:grid-cols-2">
          <label class="space-y-2">
            <span class="text-sm font-medium text-foreground">选择周转口袋</span>
            <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-workbench-field="bagId">
              <option value="">请选择口袋</option>
              ${getViewModel().masters
                .map(
                  (item) => `<option value="${escapeHtml(item.bagId)}" ${state.draft.bagId === item.bagId ? 'selected' : ''}>${escapeHtml(`${item.bagCode} / ${item.statusMeta.label}`)}</option>`,
                )
                .join('')}
            </select>
          </label>
          <label class="space-y-2">
            <span class="text-sm font-medium text-foreground">模拟扫描 bagCode</span>
            <div class="flex gap-2">
              <input
                type="text"
                value="${escapeHtml(state.draft.bagCodeInput)}"
                placeholder="输入或扫描口袋码"
                class="h-10 flex-1 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                data-transfer-bags-workbench-field="bagCodeInput"
              />
              <button type="button" class="rounded-md border px-3 text-xs hover:bg-muted" data-transfer-bags-action="match-bag-code">匹配</button>
            </div>
          </label>
          <label class="space-y-2">
            <span class="text-sm font-medium text-foreground">绑定车缝任务</span>
            <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-workbench-field="sewingTaskId">
              <option value="">请选择车缝任务</option>
              ${getViewModel().sewingTasks
                .map(
                  (item) => `<option value="${escapeHtml(item.sewingTaskId)}" ${state.draft.sewingTaskId === item.sewingTaskId ? 'selected' : ''}>${escapeHtml(`${item.sewingTaskNo} / ${item.sewingFactoryName} / ${item.styleCode || item.spuCode}`)}</option>`,
                )
                .join('')}
            </select>
          </label>
          <label class="space-y-2">
            <span class="text-sm font-medium text-foreground">备注</span>
            <input
              type="text"
              value="${escapeHtml(state.draft.note)}"
              placeholder="说明本次 usage 的交接场景"
              class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              data-transfer-bags-workbench-field="note"
            />
          </label>
        </div>
        <div class="flex flex-wrap gap-2">
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="create-usage">创建 usage 草稿</button>
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="clear-draft">清空工作台</button>
          ${candidateTickets.length ? `<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="import-prefill">导入候选菲票（${candidateTickets.length}）</button>` : ''}
        </div>
        ${renderCandidatePanel(candidateTickets)}
        <div class="grid gap-3 lg:grid-cols-[1fr,auto]">
          <label class="space-y-2">
            <span class="text-sm font-medium text-foreground">模拟扫描 ticketNo</span>
            <input
              type="text"
              value="${escapeHtml(state.draft.ticketInput)}"
              placeholder="输入或扫描菲票码"
              class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              data-transfer-bags-workbench-field="ticketInput"
            />
          </label>
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted lg:self-end" data-transfer-bags-action="bind-ticket">装袋绑定</button>
        </div>
      </article>
      <article class="space-y-3 rounded-lg border bg-card p-3">
        <div>
          <h2 class="text-sm font-semibold text-foreground">当前 usage 摘要</h2>
          <p class="mt-1 text-xs text-muted-foreground">usage 是单次使用周期对象。bag 是载具，ticket / original-cut-order 仍是裁片 owner。</p>
        </div>
        ${activeUsage
          ? `
            <div class="grid gap-3 md:grid-cols-2">
              <div class="space-y-2 rounded-lg border bg-muted/15 p-3 text-sm">
                <div><span class="text-muted-foreground">usageNo：</span><span class="font-medium text-foreground">${escapeHtml(activeUsage.usageNo)}</span></div>
                <div><span class="text-muted-foreground">bagCode：</span><span class="font-medium text-foreground">${escapeHtml(activeUsage.bagCode)}</span></div>
                <div><span class="text-muted-foreground">车缝任务：</span><span class="font-medium text-foreground">${escapeHtml(activeUsage.sewingTaskNo)}</span></div>
                <div><span class="text-muted-foreground">车缝工厂：</span><span class="font-medium text-foreground">${escapeHtml(activeUsage.sewingFactoryName)}</span></div>
                <div><span class="text-muted-foreground">状态：</span>${renderTag(activeUsage.statusMeta.label, activeUsage.statusMeta.className)}</div>
              </div>
              <div class="space-y-2 rounded-lg border bg-muted/15 p-3 text-sm">
                <div><span class="text-muted-foreground">ticket 数：</span><span class="font-medium text-foreground">${escapeHtml(String(currentSummary?.ticketCount || 0))}</span></div>
                <div><span class="text-muted-foreground">原始裁片单数：</span><span class="font-medium text-foreground">${escapeHtml(String(currentSummary?.originalCutOrderCount || 0))}</span></div>
                <div><span class="text-muted-foreground">生产单数：</span><span class="font-medium text-foreground">${escapeHtml(String(currentSummary?.productionOrderCount || 0))}</span></div>
                <div><span class="text-muted-foreground">mergeBatch 摘要：</span><span class="font-medium text-foreground">${escapeHtml(activeUsage.mergeBatchNos.join(' / ') || '无批次上下文')}</span></div>
                <div><span class="text-muted-foreground">容量提示：</span><span class="font-medium ${capacityExceeded ? 'text-amber-700' : 'text-foreground'}">${capacityExceeded ? '当前票数已超过口袋容量，建议拆袋。' : '当前票数未超容量。'}</span></div>
              </div>
            </div>
            <div class="flex flex-wrap gap-2">
              <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="print-manifest" data-usage-id="${escapeHtml(activeUsage.usageId)}">打印交接清单</button>
              <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="mark-ready" data-usage-id="${escapeHtml(activeUsage.usageId)}">标记待发出</button>
              <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="mark-dispatched" data-usage-id="${escapeHtml(activeUsage.usageId)}">标记已发出</button>
              <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="mark-pending-signoff" data-usage-id="${escapeHtml(activeUsage.usageId)}">标记待签收</button>
            </div>
            <div class="rounded-lg border">
              <div class="border-b px-3 py-2 text-xs font-medium text-muted-foreground">当前口袋内 ticket 列表</div>
              ${currentBindings.length
                ? renderStickyTableScroller(`
                    <table class="min-w-full text-sm">
                      <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th class="px-3 py-2 text-left">ticketNo</th>
                          <th class="px-3 py-2 text-left">原始裁片单</th>
                          <th class="px-3 py-2 text-left">生产单</th>
                          <th class="px-3 py-2 text-left">mergeBatch</th>
                          <th class="px-3 py-2 text-left">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${currentBindings
                          .map(
                            (binding) => `
                              <tr class="border-b bg-card">
                                <td class="px-3 py-2">${escapeHtml(binding.ticketNo)}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.originalCutOrderNo)}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.productionOrderNo)}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.mergeBatchNo || '无')}</td>
                                <td class="px-3 py-2">
                                  <button type="button" class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted" data-transfer-bags-action="remove-binding" data-binding-id="${escapeHtml(binding.bindingId)}">移除错误绑定</button>
                                </td>
                              </tr>
                            `,
                          )
                          .join('')}
                      </tbody>
                    </table>
                  `, 'max-h-[28vh]')
                : '<div class="px-3 py-8 text-center text-sm text-muted-foreground">当前 usage 暂无已绑定菲票，可通过上方扫码输入或导入候选菲票。</div>'}
            </div>
          `
          : '<div class="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">当前尚未选中 usage。请先创建或从发出台账中选择一个 usage。</div>'}
      </article>
    </section>
  `
}

function renderCandidatePanel(candidates: TransferBagTicketCandidate[]): string {
  if (!candidates.length) return ''
  return renderWorkbenchSecondaryPanel({
    title: '候选菲票预填',
    hint: '来自当前 query 预筛或 fei-tickets 预选结果，可一次导入当前 usage。',
    countText: `${candidates.length} 张`,
    defaultOpen: true,
    body: `
      <div class="flex flex-wrap gap-2">
        ${candidates
          .map((item) => renderWorkbenchFilterChip(`${item.ticketNo} / ${item.originalCutOrderNo}`, 'data-transfer-bags-action="set-ticket-input" data-ticket-no="' + escapeHtml(item.ticketNo) + '"', 'blue'))
          .join('')}
      </div>
    `,
  })
}

function renderUsageLedgerSection(): string {
  const usages = getFilteredUsages()
  const activeUsage = getActiveUsage()
  return `
    <section class="space-y-3 rounded-lg border bg-card p-3">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="text-sm font-semibold text-foreground">发出交接台账</h2>
          <p class="mt-1 text-xs text-muted-foreground">一个车缝任务可以对应多个 bag usages，但单个 usage 只能归属一个车缝任务。</p>
        </div>
      </div>
      ${renderStickyFilterShell(`
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label class="space-y-2 xl:col-span-2">
            <span class="text-sm font-medium text-foreground">关键词</span>
            <input
              type="text"
              value="${escapeHtml(state.usageKeyword)}"
              placeholder="支持 usageNo / bagCode / sewingTaskNo / 原始裁片单"
              class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              data-transfer-bags-usage-field="keyword"
            />
          </label>
          <label class="space-y-2">
            <span class="text-sm font-medium text-foreground">usage 状态</span>
            <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-usage-field="status">
              <option value="ALL" ${state.usageStatus === 'ALL' ? 'selected' : ''}>全部</option>
              <option value="DRAFT" ${state.usageStatus === 'DRAFT' ? 'selected' : ''}>草稿</option>
              <option value="PACKING" ${state.usageStatus === 'PACKING' ? 'selected' : ''}>装袋中</option>
              <option value="READY_TO_DISPATCH" ${state.usageStatus === 'READY_TO_DISPATCH' ? 'selected' : ''}>待发出</option>
              <option value="DISPATCHED" ${state.usageStatus === 'DISPATCHED' ? 'selected' : ''}>已发出</option>
              <option value="PENDING_SIGNOFF" ${state.usageStatus === 'PENDING_SIGNOFF' ? 'selected' : ''}>待签收</option>
              <option value="WAITING_RETURN" ${state.usageStatus === 'WAITING_RETURN' ? 'selected' : ''}>待回仓</option>
              <option value="RETURN_INSPECTING" ${state.usageStatus === 'RETURN_INSPECTING' ? 'selected' : ''}>回仓验收中</option>
              <option value="CLOSED" ${state.usageStatus === 'CLOSED' ? 'selected' : ''}>已关闭</option>
              <option value="EXCEPTION_CLOSED" ${state.usageStatus === 'EXCEPTION_CLOSED' ? 'selected' : ''}>异常关闭</option>
            </select>
          </label>
          <label class="space-y-2">
            <span class="text-sm font-medium text-foreground">车缝任务</span>
            <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-usage-field="sewingTask">
              <option value="ALL" ${state.usageSewingTaskId === 'ALL' ? 'selected' : ''}>全部</option>
              ${getViewModel().sewingTasks
                .map(
                  (item) => `<option value="${escapeHtml(item.sewingTaskId)}" ${state.usageSewingTaskId === item.sewingTaskId ? 'selected' : ''}>${escapeHtml(item.sewingTaskNo)}</option>`,
                )
                .join('')}
            </select>
          </label>
        </div>
      `)}
      ${!usages.length
        ? '<div class="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">当前筛选条件下暂无 usage 台账记录。</div>'
        : renderStickyTableScroller(`
            <table class="min-w-full text-sm">
              <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th class="px-4 py-3 text-left">usageNo</th>
                  <th class="px-4 py-3 text-left">bagCode</th>
                  <th class="px-4 py-3 text-left">sewingTaskNo</th>
                  <th class="px-4 py-3 text-left">车缝工厂</th>
                  <th class="px-4 py-3 text-right">ticket 数</th>
                  <th class="px-4 py-3 text-right">原始裁片单数</th>
                  <th class="px-4 py-3 text-left">usage 状态</th>
                  <th class="px-4 py-3 text-left">dispatchAt</th>
                  <th class="px-4 py-3 text-left">操作</th>
                </tr>
              </thead>
              <tbody>
                ${usages
                  .map(
                    (item) => `
                      <tr class="border-b ${state.activeUsageId === item.usageId ? 'bg-blue-50/60' : 'bg-card'}">
                        <td class="px-4 py-3">
                          <button type="button" class="font-medium text-blue-700 hover:underline" data-transfer-bags-action="select-usage" data-usage-id="${escapeHtml(item.usageId)}">${escapeHtml(item.usageNo)}</button>
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.note || '无额外备注')}</div>
                        </td>
                        <td class="px-4 py-3">${escapeHtml(item.bagCode)}</td>
                        <td class="px-4 py-3">${escapeHtml(item.sewingTaskNo)}</td>
                        <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(item.sewingFactoryName)}</td>
                        <td class="px-4 py-3 text-right tabular-nums">${escapeHtml(String(item.summary.ticketCount))}</td>
                        <td class="px-4 py-3 text-right tabular-nums">${escapeHtml(String(item.summary.originalCutOrderCount))}</td>
                        <td class="px-4 py-3">${renderTag(item.statusMeta.label, item.statusMeta.className)}</td>
                        <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(item.dispatchAt || '待发出')}</td>
                        <td class="px-4 py-3">
                          <div class="flex flex-wrap gap-2">
                            <button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-transfer-bags-action="select-usage" data-usage-id="${escapeHtml(item.usageId)}">查看详情</button>
                            <button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-transfer-bags-action="print-manifest" data-usage-id="${escapeHtml(item.usageId)}">打印清单</button>
                            <button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-transfer-bags-action="mark-dispatched" data-usage-id="${escapeHtml(item.usageId)}">标记发出</button>
                          </div>
                        </td>
                      </tr>
                    `,
                  )
                  .join('')}
              </tbody>
            </table>
          `)}
      ${renderUsageDetail(activeUsage)}
    </section>
  `
}

function renderUsageDetail(item: TransferBagUsageItem | null): string {
  if (!item) return ''
  const auditTrail = (getViewModel().auditTrailByUsageId[item.usageId] || []).slice().sort((left, right) => right.actionAt.localeCompare(left.actionAt, 'zh-CN'))
  return renderWorkbenchSecondaryPanel({
    title: `usage 详情：${item.usageNo}`,
    hint: '当前详情保留发出前与发出时动作。回货入仓、袋况与复用闭环在下方专属区块处理。',
    countText: `${item.summary.ticketCount} 张票 / ${item.summary.originalCutOrderCount} 个原始裁片单`,
    defaultOpen: true,
    body: `
      <div class="grid gap-3 xl:grid-cols-[0.9fr,1.1fr]">
        <div class="space-y-3 rounded-lg border bg-muted/15 p-3 text-sm">
          <div><span class="text-muted-foreground">载具父码：</span><span class="font-medium text-foreground">${escapeHtml(item.bagCode)}</span></div>
          <div><span class="text-muted-foreground">车缝任务：</span><span class="font-medium text-foreground">${escapeHtml(item.sewingTaskNo)}</span></div>
          <div><span class="text-muted-foreground">车缝工厂：</span><span class="font-medium text-foreground">${escapeHtml(item.sewingFactoryName)}</span></div>
          <div><span class="text-muted-foreground">ticket 子码数：</span><span class="font-medium text-foreground">${escapeHtml(String(item.summary.ticketCount))}</span></div>
          <div><span class="text-muted-foreground">production 数：</span><span class="font-medium text-foreground">${escapeHtml(String(item.summary.productionOrderCount))}</span></div>
          <div><span class="text-muted-foreground">最新 manifest：</span><span class="font-medium text-foreground">${escapeHtml(item.latestManifest?.manifestId || '尚未打印')}</span></div>
          <div class="flex flex-wrap gap-2">
            <button type="button" class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-transfer-bags-action="go-original-orders" data-usage-id="${escapeHtml(item.usageId)}">查看原始裁片单</button>
            <button type="button" class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-transfer-bags-action="go-summary" data-usage-id="${escapeHtml(item.usageId)}">查看裁剪总结</button>
          </div>
        </div>
        <div class="space-y-3 rounded-lg border bg-muted/15 p-3">
          <div>
            <h3 class="text-sm font-semibold text-foreground">动作审计</h3>
            <p class="mt-1 text-xs text-muted-foreground">装袋、移除、打印、发出等动作均留痕，便于后续回货与复用追溯。</p>
          </div>
          ${auditTrail.length
            ? `<div class="space-y-2">${auditTrail
                .map(
                  (audit) => `
                    <article class="rounded-md border bg-card px-3 py-2 text-sm">
                      <div class="flex items-center justify-between gap-3">
                        <p class="font-medium text-foreground">${escapeHtml(audit.action)}</p>
                        <p class="text-xs text-muted-foreground">${escapeHtml(formatDateTime(audit.actionAt))}</p>
                      </div>
                      <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(audit.actionBy)}</p>
                      <p class="mt-1 text-sm text-foreground">${escapeHtml(audit.note)}</p>
                    </article>
                  `,
                )
                .join('')}</div>`
            : '<div class="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">当前 usage 尚无审计记录。</div>'}
        </div>
      </div>
    `,
  })
}

function renderReturnLedgerSection(): string {
  const items = getFilteredReturnUsages()
  return `
    <section class="space-y-3 rounded-lg border bg-card p-3">
      <div>
        <h2 class="text-sm font-semibold text-foreground">待回仓 usage 列表</h2>
        <p class="mt-1 text-xs text-muted-foreground">从“已发出 / 待签收”进入回货流程，直到回货验收完成并关闭 usage。bag master 与 usage 状态在此开始分流管理。</p>
      </div>
      ${renderStickyFilterShell(`
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label class="space-y-2 xl:col-span-3">
            <span class="text-sm font-medium text-foreground">关键词</span>
            <input
              type="text"
              value="${escapeHtml(state.returnKeyword)}"
              placeholder="支持 usageNo / bagCode / sewingTaskNo / originalCutOrderNo"
              class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              data-transfer-bags-return-field="keyword"
            />
          </label>
          <label class="space-y-2">
            <span class="text-sm font-medium text-foreground">回货状态</span>
            <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-return-field="status">
              <option value="ALL" ${state.returnStatus === 'ALL' ? 'selected' : ''}>全部</option>
              <option value="WAITING_RETURN" ${state.returnStatus === 'WAITING_RETURN' ? 'selected' : ''}>待回仓</option>
              <option value="RETURN_INSPECTING" ${state.returnStatus === 'RETURN_INSPECTING' ? 'selected' : ''}>回仓验收中</option>
              <option value="CLOSED" ${state.returnStatus === 'CLOSED' ? 'selected' : ''}>已关闭</option>
              <option value="EXCEPTION_CLOSED" ${state.returnStatus === 'EXCEPTION_CLOSED' ? 'selected' : ''}>异常关闭</option>
            </select>
          </label>
        </div>
      `)}
      ${!items.length
        ? '<div class="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">当前没有匹配的回货 usage。</div>'
        : renderStickyTableScroller(`
            <table class="min-w-full text-sm">
              <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th class="px-4 py-3 text-left">usageNo</th>
                  <th class="px-4 py-3 text-left">bagCode</th>
                  <th class="px-4 py-3 text-left">sewingTaskNo</th>
                  <th class="px-4 py-3 text-left">车缝工厂</th>
                  <th class="px-4 py-3 text-left">dispatchAt</th>
                  <th class="px-4 py-3 text-left">usage 状态</th>
                  <th class="px-4 py-3 text-left">bag 状态</th>
                  <th class="px-4 py-3 text-left">操作</th>
                </tr>
              </thead>
              <tbody>
                ${items
                  .map(
                    (item) => `
                      <tr class="border-b ${state.activeUsageId === item.usageId ? 'bg-orange-50/60' : 'bg-card'}">
                        <td class="px-4 py-3">
                          <button type="button" class="font-medium text-blue-700 hover:underline" data-transfer-bags-action="prepare-return" data-usage-id="${escapeHtml(item.usageId)}">${escapeHtml(item.usageNo)}</button>
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.latestReturnReceipt?.returnAt || '尚未创建回货草稿')}</div>
                        </td>
                        <td class="px-4 py-3">${escapeHtml(item.bagCode)}</td>
                        <td class="px-4 py-3">${escapeHtml(item.sewingTaskNo)}</td>
                        <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(item.sewingFactoryName)}</td>
                        <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(item.dispatchAt || '待发出')}</td>
                        <td class="px-4 py-3">${renderTag(item.statusMeta.label, item.statusMeta.className)}</td>
                        <td class="px-4 py-3">${item.bagStatusMeta ? renderTag(item.bagStatusMeta.label, item.bagStatusMeta.className) : '<span class="text-xs text-muted-foreground">待补</span>'}</td>
                        <td class="px-4 py-3">
                          <div class="flex flex-wrap gap-2">
                            <button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-transfer-bags-action="prepare-return" data-usage-id="${escapeHtml(item.usageId)}">回货验收</button>
                            <button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-transfer-bags-action="select-usage" data-usage-id="${escapeHtml(item.usageId)}">查看详情</button>
                          </div>
                        </td>
                      </tr>
                    `,
                  )
                  .join('')}
              </tbody>
            </table>
          `)}
    </section>
  `
}

function renderReturnWorkbenchSection(): string {
  const activeUsage = state.activeUsageId ? getReturnViewModel().waitingReturnUsages.find((item) => item.usageId === state.activeUsageId) || null : null
  const decisionMeta = deriveBagConditionDecision({
    conditionStatus: state.conditionDraft.conditionStatus,
    cleanlinessStatus: state.conditionDraft.cleanlinessStatus,
    damageType: state.conditionDraft.damageType,
    repairNeeded: state.conditionDraft.repairNeeded,
  })
  const exceptionMeta = buildReturnExceptionMeta(state.returnDraft.discrepancyType)

  return `
    <section class="grid gap-3 xl:grid-cols-[1.15fr,0.85fr]">
      <article class="space-y-3 rounded-lg border bg-card p-3">
        <div>
          <h2 class="text-sm font-semibold text-foreground">回货入仓工作台</h2>
          <p class="mt-1 text-xs text-muted-foreground">先确认 usage 已进入回货流程，再填写返仓信息、袋况与差异。验收完成后，才能正式关闭 usage 并释放 bag。</p>
        </div>
        ${activeUsage
          ? `
            <div class="grid gap-3 md:grid-cols-2">
              <div class="space-y-2 rounded-lg border bg-muted/15 p-3 text-sm">
                <div><span class="text-muted-foreground">usageNo：</span><span class="font-medium text-foreground">${escapeHtml(activeUsage.usageNo)}</span></div>
                <div><span class="text-muted-foreground">bagCode：</span><span class="font-medium text-foreground">${escapeHtml(activeUsage.bagCode)}</span></div>
                <div><span class="text-muted-foreground">sewingTask：</span><span class="font-medium text-foreground">${escapeHtml(activeUsage.sewingTaskNo)}</span></div>
                <div><span class="text-muted-foreground">当前状态：</span>${renderTag(activeUsage.statusMeta.label, activeUsage.statusMeta.className)}</div>
                <div><span class="text-muted-foreground">bag 状态：</span>${activeUsage.bagStatusMeta ? renderTag(activeUsage.bagStatusMeta.label, activeUsage.bagStatusMeta.className) : '<span class="text-xs text-muted-foreground">待补</span>'}</div>
              </div>
              <div class="space-y-2 rounded-lg border bg-muted/15 p-3 text-sm">
                <div><span class="text-muted-foreground">ticket 数：</span><span class="font-medium text-foreground">${escapeHtml(String(activeUsage.summary.ticketCount))}</span></div>
                <div><span class="text-muted-foreground">原始裁片单数：</span><span class="font-medium text-foreground">${escapeHtml(String(activeUsage.summary.originalCutOrderCount))}</span></div>
                <div><span class="text-muted-foreground">生产单数：</span><span class="font-medium text-foreground">${escapeHtml(String(activeUsage.summary.productionOrderCount))}</span></div>
                <div><span class="text-muted-foreground">回货资格：</span><span class="font-medium ${activeUsage.returnEligibility.ok ? 'text-emerald-700' : 'text-amber-700'}">${escapeHtml(activeUsage.returnEligibility.ok ? '可进入回货流程' : activeUsage.returnEligibility.reason)}</span></div>
              </div>
            </div>
            <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label class="space-y-2">
                <span class="text-sm font-medium text-foreground">回货入仓点</span>
                <input type="text" value="${escapeHtml(state.returnDraft.returnWarehouseName)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-return-draft-field="returnWarehouseName" />
              </label>
              <label class="space-y-2">
                <span class="text-sm font-medium text-foreground">回货时间</span>
                <input type="text" value="${escapeHtml(state.returnDraft.returnAt)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-return-draft-field="returnAt" />
              </label>
              <label class="space-y-2">
                <span class="text-sm font-medium text-foreground">回货人</span>
                <input type="text" value="${escapeHtml(state.returnDraft.returnedBy)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-return-draft-field="returnedBy" />
              </label>
              <label class="space-y-2">
                <span class="text-sm font-medium text-foreground">接收人</span>
                <input type="text" value="${escapeHtml(state.returnDraft.receivedBy)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-return-draft-field="receivedBy" />
              </label>
              <label class="space-y-2">
                <span class="text-sm font-medium text-foreground">回货成衣数量摘要</span>
                <input type="number" value="${escapeHtml(state.returnDraft.returnedFinishedQty)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-return-draft-field="returnedFinishedQty" />
              </label>
              <label class="space-y-2">
                <span class="text-sm font-medium text-foreground">回货 ticket 数摘要</span>
                <input type="number" value="${escapeHtml(state.returnDraft.returnedTicketCountSummary)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-return-draft-field="returnedTicketCountSummary" />
              </label>
              <label class="space-y-2">
                <span class="text-sm font-medium text-foreground">差异类型</span>
                <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-return-draft-field="discrepancyType">
                  <option value="NONE" ${state.returnDraft.discrepancyType === 'NONE' ? 'selected' : ''}>无差异</option>
                  <option value="QTY_MISMATCH" ${state.returnDraft.discrepancyType === 'QTY_MISMATCH' ? 'selected' : ''}>数量异常</option>
                  <option value="DAMAGED_BAG" ${state.returnDraft.discrepancyType === 'DAMAGED_BAG' ? 'selected' : ''}>口袋损坏</option>
                  <option value="LATE_RETURN" ${state.returnDraft.discrepancyType === 'LATE_RETURN' ? 'selected' : ''}>迟归还</option>
                  <option value="MISSING_RECORD" ${state.returnDraft.discrepancyType === 'MISSING_RECORD' ? 'selected' : ''}>缺记录</option>
                </select>
              </label>
              <label class="space-y-2 xl:col-span-1">
                <span class="text-sm font-medium text-foreground">差异说明</span>
                <input type="text" value="${escapeHtml(state.returnDraft.discrepancyNote)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-return-draft-field="discrepancyNote" />
              </label>
            </div>
            <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <label class="space-y-2">
                <span class="text-sm font-medium text-foreground">袋况</span>
                <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-condition-field="conditionStatus">
                  <option value="GOOD" ${state.conditionDraft.conditionStatus === 'GOOD' ? 'selected' : ''}>完好</option>
                  <option value="MINOR_DAMAGE" ${state.conditionDraft.conditionStatus === 'MINOR_DAMAGE' ? 'selected' : ''}>轻微损坏</option>
                  <option value="SEVERE_DAMAGE" ${state.conditionDraft.conditionStatus === 'SEVERE_DAMAGE' ? 'selected' : ''}>严重损坏</option>
                </select>
              </label>
              <label class="space-y-2">
                <span class="text-sm font-medium text-foreground">洁净情况</span>
                <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-condition-field="cleanlinessStatus">
                  <option value="CLEAN" ${state.conditionDraft.cleanlinessStatus === 'CLEAN' ? 'selected' : ''}>干净</option>
                  <option value="DIRTY" ${state.conditionDraft.cleanlinessStatus === 'DIRTY' ? 'selected' : ''}>待清洁</option>
                </select>
              </label>
              <label class="space-y-2">
                <span class="text-sm font-medium text-foreground">损坏说明</span>
                <input type="text" value="${escapeHtml(state.conditionDraft.damageType)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-condition-field="damageType" />
              </label>
              <label class="space-y-2">
                <span class="text-sm font-medium text-foreground">复用建议</span>
                <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-condition-field="reusableDecision">
                  <option value="REUSABLE" ${state.conditionDraft.reusableDecision === 'REUSABLE' ? 'selected' : ''}>可复用</option>
                  <option value="WAITING_CLEANING" ${state.conditionDraft.reusableDecision === 'WAITING_CLEANING' ? 'selected' : ''}>待清洁</option>
                  <option value="WAITING_REPAIR" ${state.conditionDraft.reusableDecision === 'WAITING_REPAIR' ? 'selected' : ''}>待维修</option>
                  <option value="DISABLED" ${state.conditionDraft.reusableDecision === 'DISABLED' ? 'selected' : ''}>停用 / 报废</option>
                </select>
              </label>
              <label class="space-y-2">
                <span class="text-sm font-medium text-foreground">维修需求</span>
                <label class="flex h-10 items-center gap-2 rounded-md border bg-background px-3 text-sm">
                  <input type="checkbox" ${state.conditionDraft.repairNeeded ? 'checked' : ''} data-transfer-bags-condition-toggle="repairNeeded" />
                  <span>需要维修</span>
                </label>
              </label>
              <label class="space-y-2 md:col-span-2 xl:col-span-5">
                <span class="text-sm font-medium text-foreground">袋况备注</span>
                <input type="text" value="${escapeHtml(state.conditionDraft.note)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-condition-field="note" />
              </label>
            </div>
            <div class="rounded-lg border bg-muted/15 p-3 text-sm">
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-muted-foreground">自动建议：</span>
                ${renderTag(decisionMeta.label, decisionMeta.className)}
                ${exceptionMeta ? renderTag(exceptionMeta.label, exceptionMeta.className) : ''}
              </div>
              <p class="mt-2 text-xs text-muted-foreground">${escapeHtml(decisionMeta.detailText)}</p>
              ${exceptionMeta ? `<p class="mt-1 text-xs text-muted-foreground">${escapeHtml(exceptionMeta.detailText)}</p>` : ''}
            </div>
            <div class="flex flex-wrap gap-2">
              <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="prepare-return" data-usage-id="${escapeHtml(activeUsage.usageId)}">创建回货草稿</button>
              <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="complete-return-inspection" data-usage-id="${escapeHtml(activeUsage.usageId)}">完成验收</button>
              <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="close-usage-cycle" data-usage-id="${escapeHtml(activeUsage.usageId)}">关闭 usage</button>
              <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="clear-return-draft">重置回货草稿</button>
            </div>
          `
          : '<div class="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">请先从“待回仓 usage 列表”中选择一个 usage 进入回货工作台。</div>'}
      </article>
      <article class="space-y-3 rounded-lg border bg-card p-3">
        <div>
          <h2 class="text-sm font-semibold text-foreground">袋况与异常处理</h2>
          <p class="mt-1 text-xs text-muted-foreground">袋况记录与回货差异是关闭 usage、释放 bag、决定是否可复用的依据。</p>
        </div>
        ${renderConditionSection()}
      </article>
    </section>
  `
}

function renderReuseCycleSection(): string {
  const cycles = getReturnViewModel().reuseCycles
  return `
    <section class="space-y-3 rounded-lg border bg-card p-3">
      <div>
        <h2 class="text-sm font-semibold text-foreground">复用周期台账</h2>
        <p class="mt-1 text-xs text-muted-foreground">按 bag 维度累计展示总使用次数、总回仓次数、当前可复用状态与最新 usage 闭环结果，体现循环复用轨迹。</p>
      </div>
      ${!cycles.length
        ? '<div class="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">当前尚无复用周期台账。</div>'
        : renderStickyTableScroller(`
            <table class="min-w-full text-sm">
              <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th class="px-4 py-3 text-left">bagCode</th>
                  <th class="px-4 py-3 text-right">总使用次数</th>
                  <th class="px-4 py-3 text-right">总发出次数</th>
                  <th class="px-4 py-3 text-right">总回仓次数</th>
                  <th class="px-4 py-3 text-left">最近发出</th>
                  <th class="px-4 py-3 text-left">最近回仓</th>
                  <th class="px-4 py-3 text-left">当前状态</th>
                  <th class="px-4 py-3 text-left">当前位置</th>
                  <th class="px-4 py-3 text-left">最新 usage</th>
                </tr>
              </thead>
              <tbody>
                ${cycles
                  .map(
                    (item) => `
                      <tr class="border-b bg-card">
                        <td class="px-4 py-3 font-medium text-foreground">${escapeHtml(item.bagCode)}</td>
                        <td class="px-4 py-3 text-right tabular-nums">${escapeHtml(String(item.totalUsageCount))}</td>
                        <td class="px-4 py-3 text-right tabular-nums">${escapeHtml(String(item.totalDispatchCount))}</td>
                        <td class="px-4 py-3 text-right tabular-nums">${escapeHtml(String(item.totalReturnCount))}</td>
                        <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(item.lastDispatchedAt || '暂无')}</td>
                        <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(item.lastReturnedAt || '暂无')}</td>
                        <td class="px-4 py-3">${renderTag(item.bagStatusMeta.label, item.bagStatusMeta.className)}</td>
                        <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(item.currentLocation || '待补')}</td>
                        <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(item.latestUsageNo || '暂无')}</td>
                      </tr>
                    `,
                  )
                  .join('')}
              </tbody>
            </table>
          `)}
    </section>
  `
}

function renderConditionSection(): string {
  const items = getReturnViewModel().conditionItems.slice(0, 8)
  if (!items.length) {
    return '<div class="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">当前还没有袋况记录。完成回货验收后，这里会展示可复用 / 待清洁 / 待维修决策。</div>'
  }

  return renderStickyTableScroller(`
    <table class="min-w-full text-sm">
      <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
        <tr>
          <th class="px-4 py-3 text-left">bagCode</th>
          <th class="px-4 py-3 text-left">latestUsageNo</th>
          <th class="px-4 py-3 text-left">袋况</th>
          <th class="px-4 py-3 text-left">洁净情况</th>
          <th class="px-4 py-3 text-left">damageType</th>
          <th class="px-4 py-3 text-left">reusableDecision</th>
          <th class="px-4 py-3 text-left">处理建议</th>
        </tr>
      </thead>
      <tbody>
        ${items
          .map(
            (item) => `
              <tr class="border-b bg-card">
                <td class="px-4 py-3">${escapeHtml(item.bagCode)}</td>
                <td class="px-4 py-3">${escapeHtml(item.latestUsage?.usageNo || '待补')}</td>
                <td class="px-4 py-3">${escapeHtml(item.conditionStatus === 'GOOD' ? '完好' : item.conditionStatus === 'MINOR_DAMAGE' ? '轻微损坏' : '严重损坏')}</td>
                <td class="px-4 py-3">${escapeHtml(item.cleanlinessStatus === 'CLEAN' ? '干净' : '待清洁')}</td>
                <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(item.damageType || '无')}</td>
                <td class="px-4 py-3">${renderTag(item.decisionMeta.label, item.decisionMeta.className)}</td>
                <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(item.returnExceptionMeta?.label || item.decisionMeta.detailText)}</td>
              </tr>
            `,
          )
          .join('')}
      </tbody>
    </table>
  `, 'max-h-[28vh]')
}

function renderReturnAuditSection(): string {
  const currentUsageId = state.activeUsageId
  const allAudits = Object.values(getReturnViewModel().returnAuditTrailByUsageId)
    .flat()
    .sort((left, right) => right.actionAt.localeCompare(left.actionAt, 'zh-CN'))
  const audits = currentUsageId ? (getReturnViewModel().returnAuditTrailByUsageId[currentUsageId] || []).slice().sort((left, right) => right.actionAt.localeCompare(left.actionAt, 'zh-CN')) : allAudits

  return `
    <section class="space-y-3 rounded-lg border bg-card p-3">
      <div>
        <h2 class="text-sm font-semibold text-foreground">回货审计记录</h2>
        <p class="mt-1 text-xs text-muted-foreground">记录谁创建了回货草稿、谁完成了袋况验收、谁关闭了 usage，并保留 bag 释放去向。</p>
      </div>
      ${audits.length
        ? `<div class="space-y-2">${audits
            .slice(0, 10)
            .map(
              (audit) => `
                <article class="rounded-lg border bg-muted/15 px-3 py-2 text-sm">
                  <div class="flex items-center justify-between gap-3">
                    <p class="font-medium text-foreground">${escapeHtml(audit.action)}</p>
                    <p class="text-xs text-muted-foreground">${escapeHtml(formatDateTime(audit.actionAt))}</p>
                  </div>
                  <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(audit.actionBy)}</p>
                  <p class="mt-1 text-sm text-foreground">${escapeHtml(audit.payloadSummary)}</p>
                  <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(audit.note)}</p>
                </article>
              `,
            )
            .join('')}</div>`
        : '<div class="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">当前还没有回货审计记录。</div>'}
    </section>
  `
}

function renderBindingSection(): string {
  const bindings = getFilteredBindings()
  return `
    <section class="space-y-3 rounded-lg border bg-card p-3">
      <div>
        <h2 class="text-sm font-semibold text-foreground">父子码映射明细</h2>
        <p class="mt-1 text-xs text-muted-foreground">父码 = 周转口袋码，子码 = 菲票码。ticket owner 仍回落 original-cut-order，不会因为装袋而改变主体。</p>
      </div>
      ${renderStickyFilterShell(`
        <label class="space-y-2">
          <span class="text-sm font-medium text-foreground">关键词</span>
          <input
            type="text"
            value="${escapeHtml(state.bindingKeyword)}"
            placeholder="支持 bagCode / ticketNo / originalCutOrderNo / mergeBatchNo"
            class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            data-transfer-bags-binding-field="keyword"
          />
        </label>
      `)}
      ${!bindings.length
        ? '<div class="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">当前没有可展示的父子码映射。</div>'
        : renderStickyTableScroller(`
            <table class="min-w-full text-sm">
              <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th class="px-4 py-3 text-left">bagCode</th>
                  <th class="px-4 py-3 text-left">usageNo</th>
                  <th class="px-4 py-3 text-left">ticketNo</th>
                  <th class="px-4 py-3 text-left">originalCutOrderNo</th>
                  <th class="px-4 py-3 text-left">productionOrderNo</th>
                  <th class="px-4 py-3 text-left">mergeBatchNo</th>
                  <th class="px-4 py-3 text-left">boundAt</th>
                  <th class="px-4 py-3 text-left">boundBy</th>
                  <th class="px-4 py-3 text-left">note</th>
                </tr>
              </thead>
              <tbody>
                ${bindings
                  .map(
                    (item) => `
                      <tr class="border-b bg-card">
                        <td class="px-4 py-3">${escapeHtml(item.bagCode)}</td>
                        <td class="px-4 py-3">${escapeHtml(item.usage?.usageNo || '待补')}</td>
                        <td class="px-4 py-3">${escapeHtml(item.ticketNo)}</td>
                        <td class="px-4 py-3">${escapeHtml(item.originalCutOrderNo)}</td>
                        <td class="px-4 py-3">${escapeHtml(item.productionOrderNo)}</td>
                        <td class="px-4 py-3">${escapeHtml(item.mergeBatchNo || '无')}</td>
                        <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(formatDateTime(item.boundAt))}</td>
                        <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(item.boundBy)}</td>
                        <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(item.note || '无')}</td>
                      </tr>
                    `,
                  )
                  .join('')}
              </tbody>
            </table>
          `)}
    </section>
  `
}

function renderPage(): string {
  syncPrefilterFromQuery()
  const meta = getCanonicalCuttingMeta(appStore.getState().pathname, 'transfer-bags')
  return `
    <div class="space-y-3 p-4">
      ${renderCuttingPageHeader(meta, { actionsHtml: renderHeaderActions() })}
      ${renderStatsCards()}
      ${renderReturnStatsCards()}
      ${renderPrefilterBar()}
      ${renderFeedbackBar()}
      ${renderMasterSection()}
      ${renderWorkbenchSection()}
      ${renderUsageLedgerSection()}
      ${renderReturnLedgerSection()}
      ${renderReturnWorkbenchSection()}
      ${renderReuseCycleSection()}
      ${renderReturnAuditSection()}
      ${renderBindingSection()}
    </div>
  `
}

function syncMasterSelection(masterId: string): void {
  const master = getViewModel().mastersById[masterId]
  if (!master) return
  state.activeMasterId = masterId
  state.draft.bagId = master.bagId
  state.draft.bagCodeInput = master.bagCode
}

function syncUsageSelection(usageId: string): void {
  const usage = getViewModel().usagesById[usageId]
  if (!usage) return
  state.activeUsageId = usageId
  state.activeMasterId = usage.bagId
  state.draft.bagId = usage.bagId
  state.draft.bagCodeInput = usage.bagCode
  state.draft.sewingTaskId = usage.sewingTaskId
  state.draft.note = usage.note
  resetReturnDraft(usageId)
}

function buildReturnReceiptFromState(usage: TransferBagUsage, bag: TransferBagMaster): TransferBagReturnReceipt {
  const bindings = getViewModel().bindingsByUsageId[usage.usageId] || []
  return {
    returnReceiptId: `return-${usage.usageId}`,
    usageId: usage.usageId,
    usageNo: usage.usageNo,
    bagId: bag.bagId,
    bagCode: bag.bagCode,
    sewingTaskId: usage.sewingTaskId,
    sewingTaskNo: usage.sewingTaskNo,
    returnWarehouseName: state.returnDraft.returnWarehouseName.trim(),
    returnAt: state.returnDraft.returnAt.trim(),
    returnedBy: state.returnDraft.returnedBy.trim(),
    receivedBy: state.returnDraft.receivedBy.trim(),
    returnedFinishedQty: Number.parseInt(state.returnDraft.returnedFinishedQty || '0', 10) || 0,
    returnedTicketCountSummary: Number.parseInt(state.returnDraft.returnedTicketCountSummary || '0', 10) || 0,
    returnedOriginalCutOrderCount: uniqueStrings(bindings.map((item) => item.originalCutOrderNo)).length,
    discrepancyType: state.returnDraft.discrepancyType,
    discrepancyNote: state.returnDraft.discrepancyNote.trim(),
    note: state.returnDraft.note.trim(),
  }
}

function buildConditionRecordFromState(usage: TransferBagUsage, bag: TransferBagMaster): TransferBagConditionRecord {
  return {
    conditionRecordId: `condition-${usage.usageId}`,
    usageId: usage.usageId,
    bagId: bag.bagId,
    bagCode: bag.bagCode,
    conditionStatus: state.conditionDraft.conditionStatus,
    cleanlinessStatus: state.conditionDraft.cleanlinessStatus,
    damageType: state.conditionDraft.damageType.trim(),
    repairNeeded: state.conditionDraft.repairNeeded,
    reusableDecision: state.conditionDraft.reusableDecision,
    inspectedAt: nowText(),
    inspectedBy: state.returnDraft.receivedBy.trim() || '周转口袋工作台',
    note: state.conditionDraft.note.trim(),
  }
}

function getFilteredReturnUsages() {
  const keyword = state.returnKeyword.trim().toLowerCase()
  return getReturnViewModel().waitingReturnUsages.filter((item) => {
    const returnStatus = item.latestClosureResult?.closureStatus || item.usageStatus
    if (state.returnStatus !== 'ALL' && returnStatus !== state.returnStatus) return false
    if (state.prefilter?.returnStatus && returnStatus !== state.prefilter.returnStatus) return false
    if (keyword) {
      const haystack = [
        item.usageNo,
        item.bagCode,
        item.sewingTaskNo,
        item.sewingFactoryName,
        item.originalCutOrderNos.join(' '),
        item.ticketNos.join(' '),
      ]
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(keyword)) return false
    }
    return true
  })
}

function prepareReturnDraft(targetUsageId?: string): boolean {
  const usage = getSourceUsage(targetUsageId || state.activeUsageId)
  if (!usage) {
    setFeedback('warning', '请先选择一个待回仓 usage。')
    return true
  }
  const bag = getSourceMaster(usage.bagId)
  const latestClosure = (getReturnViewModel().closureResultsByUsageId[usage.usageId] || []).slice().sort((left, right) => right.closedAt.localeCompare(left.closedAt, 'zh-CN'))[0] || null
  const eligibility = deriveReturnEligibility({ usage, bag, latestClosureResult: latestClosure })
  if (!eligibility.ok) {
    setFeedback('warning', eligibility.reason)
    return true
  }

  syncUsageSelection(usage.usageId)
  resetReturnDraft(usage.usageId)
  if (usage.usageStatus === 'DISPATCHED' || usage.usageStatus === 'PENDING_SIGNOFF') {
    usage.usageStatus = 'WAITING_RETURN'
    if (bag) {
      bag.currentStatus = 'WAITING_RETURN'
      bag.currentLocation = usage.sewingFactoryName || '待回仓工厂'
    }
    state.store.returnAuditTrail.push(
      buildBagReturnAuditTrail({
        usageId: usage.usageId,
        action: '创建回货草稿',
        actionAt: nowText(),
        actionBy: '周转口袋工作台',
        payloadSummary: `${usage.usageNo} 已进入待回仓流程`,
        note: '从发出台账进入回货入仓工作台。',
      }),
    )
    refreshDerivedState()
    persistStore()
  }
  setFeedback('success', `${usage.usageNo} 已带入回货工作台。`)
  return true
}

function clearReturnDraft(): boolean {
  resetReturnDraft(state.activeUsageId)
  setFeedback('success', '回货验收草稿已重置。')
  return true
}

function completeReturnInspection(targetUsageId?: string): boolean {
  const usage = getSourceUsage(targetUsageId || state.activeUsageId)
  if (!usage) {
    setFeedback('warning', '请先选择一个 usage，再填写回货验收信息。')
    return true
  }
  const bag = getSourceMaster(usage.bagId)
  if (!bag) {
    setFeedback('warning', '当前 usage 缺少 bag 主档，不能验收。')
    return true
  }

  const receipt = buildReturnReceiptFromState(usage, bag)
  const condition = buildConditionRecordFromState(usage, bag)
  const validation = validateReturnReceiptPayload({
    usage,
    bag,
    receipt,
    condition,
  })
  if (!validation.ok) {
    setFeedback('warning', validation.reason)
    return true
  }

  const receiptIndex = state.store.returnReceipts.findIndex((item) => item.usageId === usage.usageId)
  if (receiptIndex >= 0) {
    state.store.returnReceipts[receiptIndex] = receipt
  } else {
    state.store.returnReceipts.push(receipt)
  }

  const conditionIndex = state.store.conditionRecords.findIndex((item) => item.usageId === usage.usageId)
  if (conditionIndex >= 0) {
    state.store.conditionRecords[conditionIndex] = condition
  } else {
    state.store.conditionRecords.push(condition)
  }

  usage.usageStatus = 'RETURN_INSPECTING'
  usage.signoffStatus = 'SIGNED'
  usage.note = receipt.discrepancyType === 'NONE' ? '当前 usage 已完成回货验收，等待关闭。' : '当前 usage 已完成回货验收，但存在差异待带说明关闭。'
  bag.currentStatus = 'RETURN_INSPECTING'
  bag.currentLocation = receipt.returnWarehouseName

  state.store.returnAuditTrail.push(
    buildBagReturnAuditTrail({
      usageId: usage.usageId,
      action: '完成验收',
      actionAt: receipt.returnAt,
      actionBy: receipt.receivedBy,
      payloadSummary: `${receipt.bagCode} 回货 ${receipt.returnedTicketCountSummary} 张票`,
      note: receipt.discrepancyType === 'NONE' ? '已写入回货验收记录与袋况。' : `存在差异：${receipt.discrepancyNote || receipt.discrepancyType}`,
    }),
  )

  refreshDerivedState()
  persistStore()
  setFeedback('success', `${usage.usageNo} 已完成回货验收。`)
  return true
}

function closeUsageCycleAction(targetUsageId?: string): boolean {
  const usage = getSourceUsage(targetUsageId || state.activeUsageId)
  if (!usage) {
    setFeedback('warning', '请先选择一个 usage。')
    return true
  }
  const bag = getSourceMaster(usage.bagId)
  if (!bag) {
    setFeedback('warning', '当前 usage 缺少 bag 主档，不能关闭。')
    return true
  }
  const receipt = (getReturnViewModel().returnReceiptsByUsageId[usage.usageId] || []).slice().sort((left, right) => right.returnAt.localeCompare(left.returnAt, 'zh-CN'))[0] || null
  const condition = (getReturnViewModel().conditionRecordsByUsageId[usage.usageId] || []).slice().sort((left, right) => right.inspectedAt.localeCompare(left.inspectedAt, 'zh-CN'))[0] || null
  if (!receipt || !condition) {
    setFeedback('warning', '请先完成回货验收，再关闭 usage。')
    return true
  }

  const closure = closeTransferBagUsageCycle({
    usage,
    bag,
    receipt,
    condition,
    nowText: nowText(),
    closedBy: receipt.receivedBy || '周转口袋工作台',
  })
  const closureIndex = state.store.closureResults.findIndex((item) => item.usageId === usage.usageId)
  if (closureIndex >= 0) {
    state.store.closureResults[closureIndex] = closure
  } else {
    state.store.closureResults.push(closure)
  }

  usage.usageStatus = closure.closureStatus
  usage.note = closure.reason
  bag.currentStatus = closure.nextBagStatus
  bag.currentLocation =
    closure.nextBagStatus === 'WAITING_CLEANING'
      ? '裁片仓待清洁区'
      : closure.nextBagStatus === 'WAITING_REPAIR'
        ? '维修待处理区'
        : closure.nextBagStatus === 'DISABLED'
          ? '停用隔离区'
          : '裁片仓复用位'

  state.store.returnAuditTrail.push(
    buildBagReturnAuditTrail({
      usageId: usage.usageId,
      action: '关闭 usage',
      actionAt: closure.closedAt,
      actionBy: closure.closedBy,
      payloadSummary: `${usage.usageNo} 已关闭，bag -> ${deriveTransferBagMasterStatus(closure.nextBagStatus).label}`,
      note: closure.reason,
    }),
  )

  refreshDerivedState()
  persistStore()
  setFeedback(
    closure.warningMessages.length ? 'warning' : 'success',
    closure.warningMessages.length
      ? `${usage.usageNo} 已异常关闭：${closure.warningMessages.join('；')}`
      : `${usage.usageNo} 已关闭，${bag.bagCode} 已释放为“${deriveTransferBagMasterStatus(closure.nextBagStatus).label}”。`,
  )
  return true
}

function createUsage(): boolean {
  const bag = getSelectedBag()
  if (!bag) {
    setFeedback('warning', '请先选择或匹配一个周转口袋。')
    return true
  }
  if (!['IDLE', 'REUSABLE'].includes(bag.currentStatus)) {
    setFeedback('warning', `${bag.bagCode} 当前状态为“${deriveTransferBagMasterStatus(bag.currentStatus).label}”，本步不允许开启新的 usage。`)
    return true
  }
  const sewingTask = getSelectedSewingTask()
  if (!sewingTask) {
    setFeedback('warning', '请先选择一个车缝任务。')
    return true
  }

  const usage = createTransferBagUsageDraft({
    bag,
    sewingTask,
    note: state.draft.note,
    existingUsages: state.store.usages,
    nowText: nowText(),
  })
  state.store.usages.push(usage)
  state.store.auditTrail.push(
    buildBagUsageAuditTrail({
      usageId: usage.usageId,
      action: '创建 usage',
      actionAt: nowText(),
      actionBy: '周转口袋工作台',
      note: `${usage.bagCode} 已绑定 ${usage.sewingTaskNo}。`,
    }),
  )
  refreshDerivedState()
  persistStore()
  syncUsageSelection(usage.usageId)

  if (getCandidateTickets().length) {
    importCandidateTickets(usage.usageId)
    return true
  }

  setFeedback('success', `${usage.usageNo} 已创建，可继续装袋。`)
  return true
}

function bindTicketByInput(): boolean {
  const usage = getSourceUsage(state.activeUsageId)
  if (!usage) {
    setFeedback('warning', '请先创建或选中一个 usage。')
    return true
  }
  if (usage.usageStatus === 'DISPATCHED' || usage.usageStatus === 'PENDING_SIGNOFF') {
    setFeedback('warning', `${usage.usageNo} 已进入发出阶段，不能继续修改装袋内容。`)
    return true
  }
  const sewingTask = getViewModel().sewingTasksById[usage.sewingTaskId] ?? null
  const ticketNo = state.draft.ticketInput.trim()
  if (!ticketNo) {
    setFeedback('warning', '请输入或模拟扫描 ticketNo。')
    return true
  }
  const ticket = getViewModel().ticketCandidatesByNo[ticketNo] ?? null
  const validation = validateTicketBindingEligibility({
    ticket,
    usage,
    sewingTask,
    bindings: state.store.bindings,
    usagesById: Object.fromEntries(state.store.usages.map((item) => [item.usageId, item])),
  })
  if (!validation.ok) {
    setFeedback('warning', validation.reason)
    return true
  }

  state.store.bindings.push({
    bindingId: `binding-${Date.now()}`,
    usageId: usage.usageId,
    bagId: usage.bagId,
    bagCode: usage.bagCode,
    ticketRecordId: ticket.ticketRecordId,
    ticketNo: ticket.ticketNo,
    originalCutOrderId: ticket.originalCutOrderId,
    originalCutOrderNo: ticket.originalCutOrderNo,
    productionOrderNo: ticket.productionOrderNo,
    mergeBatchNo: ticket.mergeBatchNo,
    qty: 1,
    boundAt: nowText(),
    boundBy: '周转口袋工作台',
    note: '通过装袋工作台补录父子码映射。',
  })
  state.store.auditTrail.push(
    buildBagUsageAuditTrail({
      usageId: usage.usageId,
      action: '绑定菲票',
      actionAt: nowText(),
      actionBy: '周转口袋工作台',
      note: `${usage.bagCode} -> ${ticket.ticketNo} 已建立父子码映射。`,
    }),
  )
  state.draft.ticketInput = ''
  refreshDerivedState()
  persistStore()
  setFeedback('success', `${ticket.ticketNo} 已装入 ${usage.bagCode}。`)
  return true
}

function importCandidateTickets(targetUsageId?: string): boolean {
  const usage = getSourceUsage(targetUsageId || state.activeUsageId)
  if (!usage) {
    setFeedback('warning', '请先创建或选中一个 usage，再导入候选菲票。')
    return true
  }
  const sewingTask = getViewModel().sewingTasksById[usage.sewingTaskId] ?? null
  const candidates = getCandidateTickets()
  if (!candidates.length) {
    setFeedback('warning', '当前没有可导入的候选菲票。')
    return true
  }

  let successCount = 0
  const failedIds: string[] = []
  const failedReasons: string[] = []

  candidates.forEach((ticket) => {
    const validation = validateTicketBindingEligibility({
      ticket,
      usage,
      sewingTask,
      bindings: state.store.bindings,
      usagesById: Object.fromEntries(state.store.usages.map((item) => [item.usageId, item])),
    })
    if (!validation.ok) {
      failedIds.push(ticket.ticketRecordId)
      failedReasons.push(`${ticket.ticketNo}：${validation.reason}`)
      return
    }

    state.store.bindings.push({
      bindingId: `binding-${Date.now()}-${successCount}`,
      usageId: usage.usageId,
      bagId: usage.bagId,
      bagCode: usage.bagCode,
      ticketRecordId: ticket.ticketRecordId,
      ticketNo: ticket.ticketNo,
      originalCutOrderId: ticket.originalCutOrderId,
      originalCutOrderNo: ticket.originalCutOrderNo,
      productionOrderNo: ticket.productionOrderNo,
      mergeBatchNo: ticket.mergeBatchNo,
      qty: 1,
      boundAt: nowText(),
      boundBy: '周转口袋工作台',
      note: '通过候选导入批量建立父子码映射。',
    })
    successCount += 1
  })

  if (successCount) {
    state.store.auditTrail.push(
      buildBagUsageAuditTrail({
        usageId: usage.usageId,
        action: '批量导入菲票',
        actionAt: nowText(),
        actionBy: '周转口袋工作台',
        note: `${usage.bagCode} 批量导入 ${successCount} 张菲票。`,
      }),
    )
  }

  state.preselectedTicketRecordIds = failedIds
  persistSelectedTicketIds()
  refreshDerivedState()
  persistStore()

  if (failedReasons.length) {
    setFeedback('warning', `已导入 ${successCount} 张，仍有 ${failedReasons.length} 张待处理：${failedReasons.join('；')}`)
  } else {
    setFeedback('success', `${usage.usageNo} 已导入 ${successCount} 张候选菲票。`)
  }
  return true
}

function removeBinding(bindingId: string | undefined): boolean {
  if (!bindingId) return false
  const binding = state.store.bindings.find((item) => item.bindingId === bindingId)
  if (!binding) return false
  const usage = getSourceUsage(binding.usageId)
  if (usage && (usage.usageStatus === 'DISPATCHED' || usage.usageStatus === 'PENDING_SIGNOFF')) {
    setFeedback('warning', `${usage.usageNo} 已进入发出阶段，不能移除映射。`)
    return true
  }
  state.store.bindings = state.store.bindings.filter((item) => item.bindingId !== bindingId)
  state.store.auditTrail.push(
    buildBagUsageAuditTrail({
      usageId: binding.usageId,
      action: '移除绑定',
      actionAt: nowText(),
      actionBy: '周转口袋工作台',
      note: `${binding.ticketNo} 已从 ${binding.bagCode} 中移除。`,
    }),
  )
  refreshDerivedState()
  persistStore()
  setFeedback('success', `${binding.ticketNo} 已移除。`)
  return true
}

function buildManifestPrintHtml(usage: TransferBagUsageItem, bindings: TransferBagBindingItem[]): string {
  const summary = buildTransferBagParentChildSummary(bindings)
  return `
    <!doctype html>
    <html lang="zh-CN">
      <head>
        <meta charset="utf-8" />
        <title>周转口袋交接清单 - ${escapeHtml(usage.usageNo)}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif; margin: 28px; color: #111827; }
          h1 { margin: 0 0 8px; font-size: 24px; }
          .tip { margin-top: 12px; border: 1px solid #bfdbfe; background: #eff6ff; color: #1d4ed8; border-radius: 10px; padding: 12px; font-size: 13px; line-height: 1.6; }
          .meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 16px; margin-top: 18px; }
          .meta-item { border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px; }
          .label { font-size: 12px; color: #6b7280; }
          .value { margin-top: 4px; font-size: 14px; font-weight: 600; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #d1d5db; padding: 8px 10px; font-size: 13px; text-align: left; vertical-align: top; }
          th { background: #f3f4f6; }
        </style>
      </head>
      <body>
        <h1>周转口袋交接清单</h1>
        <div class="meta">
          <div class="meta-item"><div class="label">bagCode</div><div class="value">${escapeHtml(usage.bagCode)}</div></div>
          <div class="meta-item"><div class="label">usageNo</div><div class="value">${escapeHtml(usage.usageNo)}</div></div>
          <div class="meta-item"><div class="label">sewingTaskNo</div><div class="value">${escapeHtml(usage.sewingTaskNo)}</div></div>
          <div class="meta-item"><div class="label">车缝工厂</div><div class="value">${escapeHtml(usage.sewingFactoryName)}</div></div>
          <div class="meta-item"><div class="label">ticketCount</div><div class="value">${escapeHtml(String(summary.ticketCount))}</div></div>
          <div class="meta-item"><div class="label">originalCutOrderCount</div><div class="value">${escapeHtml(String(summary.originalCutOrderCount))}</div></div>
          <div class="meta-item"><div class="label">production 摘要</div><div class="value">${escapeHtml(usage.productionOrderNos.join(' / ') || '待补')}</div></div>
          <div class="meta-item"><div class="label">打印时间</div><div class="value">${escapeHtml(nowText())}</div></div>
        </div>
        <table>
          <thead>
            <tr>
              <th>父码（bagCode）</th>
              <th>子码（ticketNo）</th>
              <th>原始裁片单</th>
              <th>生产单</th>
              <th>mergeBatch</th>
            </tr>
          </thead>
          <tbody>
            ${bindings
              .map(
                (binding) => `
                  <tr>
                    <td>${escapeHtml(binding.bagCode)}</td>
                    <td>${escapeHtml(binding.ticketNo)}</td>
                    <td>${escapeHtml(binding.originalCutOrderNo)}</td>
                    <td>${escapeHtml(binding.productionOrderNo)}</td>
                    <td>${escapeHtml(binding.mergeBatchNo || '无')}</td>
                  </tr>
                `,
              )
              .join('')}
          </tbody>
        </table>
        <div class="tip">
          说明：口袋为载具父码，菲票为子码。当前装袋与交接不会改变裁片 owner，裁片 owner 仍回落 original-cut-order。
        </div>
      </body>
    </html>
  `
}

function printManifest(usageId: string | undefined): boolean {
  if (!usageId) return false
  const usage = getViewModel().usagesById[usageId]
  if (!usage) return false
  const bindings = getViewModel().bindingsByUsageId[usageId] || []
  if (!bindings.length) {
    setFeedback('warning', `${usage.usageNo} 还没有装入任何菲票，不能打印交接清单。`)
    return true
  }

  const manifest = createTransferBagDispatchManifest({
    usage,
    summary: buildTransferBagParentChildSummary(bindings),
    nowText: nowText(),
    createdBy: '周转口袋工作台',
  })
  state.store.manifests.push(manifest)
  const sourceUsage = getSourceUsage(usageId)
  if (sourceUsage && sourceUsage.usageStatus !== 'DISPATCHED' && sourceUsage.usageStatus !== 'PENDING_SIGNOFF') {
    sourceUsage.usageStatus = 'READY_TO_DISPATCH'
  }
  state.store.auditTrail.push(
    buildBagUsageAuditTrail({
      usageId,
      action: '打印交接清单',
      actionAt: manifest.createdAt,
      actionBy: manifest.createdBy,
      note: `${usage.bagCode} 当前已打印装袋清单。`,
    }),
  )
  refreshDerivedState()
  persistStore()

  const printWindow = window.open('', '_blank', 'width=980,height=760')
  if (!printWindow) {
    setFeedback('warning', '浏览器拦截了打印窗口，请允许弹窗后重试。')
    return true
  }
  printWindow.document.open()
  printWindow.document.write(buildManifestPrintHtml(getViewModel().usagesById[usageId], getViewModel().bindingsByUsageId[usageId] || []))
  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
  setFeedback('success', `${usage.usageNo} 的交接清单已打开打印预览。`)
  return true
}

function updateUsageStatus(usageId: string | undefined, nextStatus: TransferBagUsageStatusKey): boolean {
  if (!usageId) return false
  const usage = getSourceUsage(usageId)
  if (!usage) return false
  if (!usage.packedTicketCount && nextStatus !== 'DRAFT') {
    setFeedback('warning', `${usage.usageNo} 尚未装入菲票，不能进入后续交接状态。`)
    return true
  }

  const currentSummary = buildTransferBagParentChildSummary(state.store.bindings.filter((item) => item.usageId === usage.usageId))
  if (!validateBagToSewingTaskBinding(usage, usage.sewingTaskId).ok) {
    setFeedback('warning', '当前 usage 的车缝任务绑定不完整，请先补齐。')
    return true
  }

  usage.usageStatus = nextStatus
  if (nextStatus === 'READY_TO_DISPATCH') {
    usage.note = '当前 usage 已装袋完成，等待发出。'
  }
  if (nextStatus === 'DISPATCHED') {
    usage.dispatchAt = nowText()
    usage.dispatchBy = '周转口袋工作台'
    usage.signoffStatus = 'WAITING'
    usage.note = `当前 usage 已发出，共 ${currentSummary.ticketCount} 张菲票。`
  }
  if (nextStatus === 'PENDING_SIGNOFF') {
    usage.signoffStatus = 'WAITING'
    usage.note = '当前 usage 等待后道签收，回货与复用将在下一步处理。'
  }

  state.store.auditTrail.push(
    buildBagUsageAuditTrail({
      usageId: usage.usageId,
      action: nextStatus === 'READY_TO_DISPATCH' ? '标记待发出' : nextStatus === 'DISPATCHED' ? '标记已发出' : '标记待签收',
      actionAt: nowText(),
      actionBy: '周转口袋工作台',
      note: `${usage.usageNo} 已更新为 ${deriveTransferBagUsageStatus(nextStatus).label}。`,
    }),
  )
  refreshDerivedState()
  persistStore()
  setFeedback('success', `${usage.usageNo} 已更新为“${deriveTransferBagUsageStatus(nextStatus).label}”。`)
  return true
}

function clearDraft(): boolean {
  state.draft = {
    bagId: '',
    bagCodeInput: '',
    sewingTaskId: '',
    ticketInput: '',
    note: '',
  }
  setFeedback('success', '装袋工作台已清空。')
  return true
}

function clearPrefill(): boolean {
  state.prefilter = null
  state.preselectedTicketRecordIds = []
  state.returnStatus = 'ALL'
  persistSelectedTicketIds()
  state.querySignature = getCanonicalCuttingPath('transfer-bags')
  appStore.navigate(getCanonicalCuttingPath('transfer-bags'))
  return true
}

function navigateByPayload(payload: Record<string, string | undefined>, path: string): boolean {
  appStore.navigate(buildWarehouseRouteWithQuery(path, payload))
  return true
}

export function renderCraftCuttingTransferBagsPage(): string {
  return renderPage()
}

export function handleCraftCuttingTransferBagsEvent(target: Element): boolean {
  const masterFieldNode = target.closest<HTMLElement>('[data-transfer-bags-master-field]')
  if (masterFieldNode) {
    const field = masterFieldNode.dataset.transferBagsMasterField as MasterFilterField | undefined
    if (!field) return false
    const input = masterFieldNode as HTMLInputElement | HTMLSelectElement
    if (field === 'keyword') state.masterKeyword = input.value
    if (field === 'status') state.masterStatus = input.value as MasterStatusFilter
    return true
  }

  const usageFieldNode = target.closest<HTMLElement>('[data-transfer-bags-usage-field]')
  if (usageFieldNode) {
    const field = usageFieldNode.dataset.transferBagsUsageField as UsageFilterField | undefined
    if (!field) return false
    const input = usageFieldNode as HTMLInputElement | HTMLSelectElement
    if (field === 'keyword') state.usageKeyword = input.value
    if (field === 'status') state.usageStatus = input.value as UsageStatusFilter
    if (field === 'sewingTask') state.usageSewingTaskId = input.value
    return true
  }

  const workbenchFieldNode = target.closest<HTMLElement>('[data-transfer-bags-workbench-field]')
  if (workbenchFieldNode) {
    const field = workbenchFieldNode.dataset.transferBagsWorkbenchField as WorkbenchField | undefined
    if (!field) return false
    const input = workbenchFieldNode as HTMLInputElement | HTMLSelectElement
    state.draft = {
      ...state.draft,
      [field]: input.value,
    }
    return true
  }

  const bindingFieldNode = target.closest<HTMLElement>('[data-transfer-bags-binding-field]')
  if (bindingFieldNode) {
    const input = bindingFieldNode as HTMLInputElement
    state.bindingKeyword = input.value
    return true
  }

  const returnFieldNode = target.closest<HTMLElement>('[data-transfer-bags-return-field]')
  if (returnFieldNode) {
    const field = returnFieldNode.dataset.transferBagsReturnField as ReturnFilterField | undefined
    if (!field) return false
    const input = returnFieldNode as HTMLInputElement | HTMLSelectElement
    if (field === 'keyword') state.returnKeyword = input.value
    if (field === 'status') state.returnStatus = input.value as ReturnStatusFilter
    return true
  }

  const returnDraftFieldNode = target.closest<HTMLElement>('[data-transfer-bags-return-draft-field]')
  if (returnDraftFieldNode) {
    const field = returnDraftFieldNode.dataset.transferBagsReturnDraftField as ReturnDraftField | undefined
    if (!field) return false
    const input = returnDraftFieldNode as HTMLInputElement | HTMLSelectElement
    state.returnDraft = {
      ...state.returnDraft,
      [field]: input.value,
    }
    return true
  }

  const conditionFieldNode = target.closest<HTMLElement>('[data-transfer-bags-condition-field]')
  if (conditionFieldNode) {
    const field = conditionFieldNode.dataset.transferBagsConditionField as ConditionDraftField | undefined
    if (!field) return false
    const input = conditionFieldNode as HTMLInputElement | HTMLSelectElement
    state.conditionDraft = {
      ...state.conditionDraft,
      [field]: input.value,
    }
    if (field !== 'reusableDecision' && field !== 'note') {
      syncReusableDecisionSuggestion()
    }
    return true
  }

  const conditionToggleNode = target.closest<HTMLElement>('[data-transfer-bags-condition-toggle]')
  if (conditionToggleNode) {
    const field = conditionToggleNode.dataset.transferBagsConditionToggle
    if (field === 'repairNeeded') {
      state.conditionDraft = {
        ...state.conditionDraft,
        repairNeeded: (conditionToggleNode as HTMLInputElement).checked,
      }
      syncReusableDecisionSuggestion()
      return true
    }
  }

  const actionNode = target.closest<HTMLElement>('[data-transfer-bags-action]')
  const action = actionNode?.dataset.transferBagsAction
  if (!action) return false

  if (action === 'clear-prefill') return clearPrefill()
  if (action === 'clear-draft') return clearDraft()
  if (action === 'match-bag-code') {
    const matched = getSelectedBag()
    if (!matched) {
      setFeedback('warning', '未匹配到该 bagCode，请检查载具编码。')
      return true
    }
    syncMasterSelection(matched.bagId)
    setFeedback('success', `${matched.bagCode} 已带入装袋工作台。`)
    return true
  }
  if (action === 'set-ticket-input') {
    state.draft.ticketInput = actionNode.dataset.ticketNo ?? ''
    return true
  }
  if (action === 'select-master') {
    const bagId = actionNode.dataset.bagId
    if (!bagId) return false
    syncMasterSelection(bagId)
    return true
  }
  if (action === 'use-master') {
    const bagId = actionNode.dataset.bagId
    if (!bagId) return false
    syncMasterSelection(bagId)
    setFeedback('success', '已将当前口袋带入装袋工作台。')
    return true
  }
  if (action === 'select-usage') {
    const usageId = actionNode.dataset.usageId
    if (!usageId) return false
    syncUsageSelection(usageId)
    return true
  }
  if (action === 'create-usage') return createUsage()
  if (action === 'bind-ticket') return bindTicketByInput()
  if (action === 'import-prefill') return importCandidateTickets()
  if (action === 'remove-binding') return removeBinding(actionNode.dataset.bindingId)
  if (action === 'print-manifest') return printManifest(actionNode.dataset.usageId || state.activeUsageId || undefined)
  if (action === 'mark-ready') return updateUsageStatus(actionNode.dataset.usageId || state.activeUsageId || undefined, 'READY_TO_DISPATCH')
  if (action === 'mark-dispatched') return updateUsageStatus(actionNode.dataset.usageId || state.activeUsageId || undefined, 'DISPATCHED')
  if (action === 'mark-pending-signoff') return updateUsageStatus(actionNode.dataset.usageId || state.activeUsageId || undefined, 'PENDING_SIGNOFF')
  if (action === 'prepare-return') return prepareReturnDraft(actionNode.dataset.usageId || state.activeUsageId || undefined)
  if (action === 'clear-return-draft') return clearReturnDraft()
  if (action === 'complete-return-inspection') return completeReturnInspection(actionNode.dataset.usageId || state.activeUsageId || undefined)
  if (action === 'close-usage-cycle') return closeUsageCycleAction(actionNode.dataset.usageId || state.activeUsageId || undefined)

  if (action === 'go-cut-piece-warehouse-index') {
    appStore.navigate(getCanonicalCuttingPath('cut-piece-warehouse'))
    return true
  }
  if (action === 'go-fei-tickets-index') {
    appStore.navigate(getCanonicalCuttingPath('fei-tickets'))
    return true
  }
  if (action === 'go-summary-index') {
    appStore.navigate(getCanonicalCuttingPath('summary'))
    return true
  }
  if (action === 'go-original-orders') {
    const usage = getViewModel().usagesById[actionNode.dataset.usageId || state.activeUsageId || '']
    if (!usage) return false
    return navigateByPayload(usage.navigationPayload.originalOrders, getCanonicalCuttingPath('original-orders'))
  }
  if (action === 'go-summary') {
    const usage = getViewModel().usagesById[actionNode.dataset.usageId || state.activeUsageId || '']
    if (!usage) return false
    return navigateByPayload(usage.navigationPayload.summary, getCanonicalCuttingPath('summary'))
  }

  return false
}
