import { appStore } from '../../../state/store'
import { hydrateRealQRCodes, renderRealQrPlaceholder } from '../../../components/real-qr'
import { escapeHtml, formatDateTime } from '../../../utils'
import {
  CUTTING_FEI_TICKET_RECORDS_STORAGE_KEY,
  serializeFeiTicketRecordsStorage,
} from './fei-tickets-model'
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
} from './layout.helpers'
import { getCanonicalCuttingMeta, getCanonicalCuttingPath, renderCuttingPageHeader } from './meta'
import {
  getWarehouseSearchParams,
} from './warehouse-shared'
import {
  buildCuttingTraceabilityId,
} from '../../../data/fcs/cutting/qr-codes.ts'
import {
  buildCuttingDrillChipLabels,
  buildCuttingDrillSummary,
  buildCuttingRouteWithContext,
  buildReturnToSummaryContext,
  getCuttingSourcePageLabel,
  hasSummaryReturnContext,
  normalizeLegacyCuttingPayload,
  readCuttingDrillContextFromLocation,
  type CuttingDrillContext,
  type CuttingNavigationTarget,
} from './navigation-context'
import {
  buildTransferBagsProjection,
} from './transfer-bags-projection'
import {
  resolveCarrierScanInput,
  resolveFeiTicketScanInput,
} from './traceability-projection-helpers'
import {
  buildBagUsageAuditTrail,
  buildTransferBagParentChildSummary,
  createTransferBagDispatchManifest,
  createTransferBagUsageDraft,
  CUTTING_TRANSFER_BAG_LEDGER_STORAGE_KEY,
  CUTTING_TRANSFER_BAG_SELECTED_TICKET_IDS_STORAGE_KEY,
  derivePocketCarrierStatus,
  deriveTransferBagMasterStatus,
  deriveTransferBagUsageStatus,
  deserializeTransferBagSelectedTicketIds,
  serializeTransferBagSelectedTicketIds,
  serializeTransferBagStorage,
  validateBagToSewingTaskBinding,
  validateTicketBindingEligibility,
  type PocketCarrierStatusKey,
  type SewingTaskRef,
  type TransferBagBindingItem,
  type TransferBagItemBinding,
  type TransferBagMaster,
  type TransferBagMasterItem,
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

type MasterStatusFilter = 'ALL' | 'IN_USE_ACTIVE' | PocketCarrierStatusKey

type UsageStatusFilter = 'ALL' | TransferBagUsageStatusKey
type ReturnStatusFilter = 'ALL' | 'WAITING_RETURN' | 'RETURN_INSPECTING' | 'CLOSED' | 'EXCEPTION_CLOSED'
type TransferBagDetailTab = 'current' | 'history' | 'recovery' | 'logs'
type TransferBagBaggingStepId = 'task' | 'binding' | 'review' | 'dispatch' | 'signoff'
type TransferBagBaggingStepState = 'pending' | 'active' | 'done' | 'locked'

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

interface TransferBagLandingResolution {
  page: 'list' | 'detail'
  bagId?: string
  bagCode?: string
  usageId?: string
  usageNo?: string
  reason: string
  matchedCount?: number
}

interface TransferBagLandingBanner {
  summary: string
  chips: string[]
}

interface TransferBagBaggingStepView {
  id: TransferBagBaggingStepId
  index: number
  label: string
  state: TransferBagBaggingStepState
  summary: string
  helperText: string
  open: boolean
}

interface TransferBagsPageState {
  store: TransferBagStore
  masterKeyword: string
  masterStatus: MasterStatusFilter
  masterPage: number
  masterPageSize: number
  usageKeyword: string
  usageStatus: UsageStatusFilter
  usageSewingTaskId: string
  returnKeyword: string
  returnStatus: ReturnStatusFilter
  bindingKeyword: string
  activeMasterId: string | null
  activeUsageId: string | null
  prefilter: TransferBagPrefilter | null
  drillContext: CuttingDrillContext | null
  landingBanner: TransferBagLandingBanner | null
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

function hasExplicitUsageContext(prefilter: TransferBagPrefilter | null): boolean {
  return Boolean(prefilter?.usageId || prefilter?.usageNo)
}

function hasExplicitBagContext(prefilter: TransferBagPrefilter | null): boolean {
  return Boolean(prefilter?.bagId || prefilter?.bagCode)
}

function hasSourceContext(prefilter: TransferBagPrefilter | null): boolean {
  return Boolean(
    prefilter?.originalCutOrderId ||
      prefilter?.originalCutOrderNo ||
      prefilter?.productionOrderId ||
      prefilter?.productionOrderNo ||
      prefilter?.mergeBatchId ||
      prefilter?.mergeBatchNo ||
      prefilter?.裁剪批次No ||
      prefilter?.materialSku ||
      prefilter?.styleCode ||
      prefilter?.cuttingGroup ||
      prefilter?.warehouseStatus,
  )
}

function buildSourceOnlyPrefilter(prefilter: TransferBagPrefilter | null): TransferBagPrefilter | null {
  if (!prefilter) return null
  return {
    originalCutOrderId: prefilter.originalCutOrderId,
    originalCutOrderNo: prefilter.originalCutOrderNo,
    productionOrderId: prefilter.productionOrderId,
    productionOrderNo: prefilter.productionOrderNo,
    mergeBatchId: prefilter.mergeBatchId,
    mergeBatchNo: prefilter.mergeBatchNo,
    裁剪批次No: prefilter.裁剪批次No,
    materialSku: prefilter.materialSku,
    styleCode: prefilter.styleCode,
    cuttingGroup: prefilter.cuttingGroup,
    warehouseStatus: prefilter.warehouseStatus,
  }
}

function hasResolverLookupContext(prefilter: TransferBagPrefilter | null): boolean {
  return Boolean(
    prefilter?.usageId ||
      prefilter?.usageNo ||
      prefilter?.bagId ||
      prefilter?.bagCode ||
      prefilter?.ticketId ||
      prefilter?.ticketNo ||
      prefilter?.sewingTaskNo ||
      prefilter?.originalCutOrderId ||
      prefilter?.originalCutOrderNo ||
      prefilter?.productionOrderId ||
      prefilter?.productionOrderNo ||
      prefilter?.mergeBatchId ||
      prefilter?.mergeBatchNo ||
      prefilter?.裁剪批次No ||
      prefilter?.materialSku ||
      prefilter?.styleCode,
  )
}

function getProjection() {
  return buildTransferBagsProjection(undefined, state.store)
}

function hydrateStore(): TransferBagStore {
  return buildTransferBagsProjection().store
}

const state: TransferBagsPageState = {
  store: hydrateStore(),
  masterKeyword: '',
  masterStatus: 'ALL',
  masterPage: 1,
  masterPageSize: 10,
  usageKeyword: '',
  usageStatus: 'ALL',
  usageSewingTaskId: 'ALL',
  returnKeyword: '',
  returnStatus: 'ALL',
  bindingKeyword: '',
  activeMasterId: null,
  activeUsageId: null,
  prefilter: null,
  drillContext: null,
  landingBanner: null,
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
  return getProjection().viewModel
}

function getReturnViewModel() {
  return getProjection().returnViewModel
}

function persistStore(): void {
  localStorage.setItem(CUTTING_TRANSFER_BAG_LEDGER_STORAGE_KEY, serializeTransferBagStorage(state.store))
  const nextTicketRecords = getProjection().ticketRecords
  localStorage.setItem(CUTTING_FEI_TICKET_RECORDS_STORAGE_KEY, serializeFeiTicketRecordsStorage(nextTicketRecords))
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

function matchesUsagePrefilter(item: TransferBagUsageItem, prefilter: TransferBagPrefilter | null = state.prefilter): boolean {
  if (!prefilter) return true
  const bindingItems = item.bindingItems || []
  const originalCutOrderIds = uniqueStrings([
    ...bindingItems.map((binding) => binding.originalCutOrderId),
    item.navigationPayload.originalOrders.originalCutOrderId,
  ])
  const productionOrderIds = uniqueStrings([
    ...bindingItems.map((binding) => binding.ticket?.productionOrderId),
    item.navigationPayload.originalOrders.productionOrderId,
  ])
  const mergeBatchIds = uniqueStrings([
    ...bindingItems.map((binding) => binding.ticket?.mergeBatchId),
    item.navigationPayload.originalOrders.mergeBatchId,
  ])
  const materialSkus = uniqueStrings(bindingItems.map((binding) => binding.ticket?.materialSku))
  const styleCodes = uniqueStrings([item.styleCode, ...bindingItems.map((binding) => binding.ticket?.styleCode)])

  return (
    matchPrefilter([item.usageId], prefilter.usageId) &&
    matchPrefilter([item.usageNo], prefilter.usageNo) &&
    matchPrefilter([item.bagId], prefilter.bagId) &&
    matchPrefilter([item.bagCode], prefilter.bagCode) &&
    matchPrefilter(originalCutOrderIds, prefilter.originalCutOrderId) &&
    matchPrefilter(item.originalCutOrderNos, prefilter.originalCutOrderNo) &&
    matchPrefilter(productionOrderIds, prefilter.productionOrderId) &&
    matchPrefilter(item.productionOrderNos, prefilter.productionOrderNo) &&
    matchPrefilter(mergeBatchIds, prefilter.mergeBatchId) &&
    matchPrefilter(item.mergeBatchNos, prefilter.mergeBatchNo || prefilter.裁剪批次No) &&
    matchPrefilter(materialSkus, prefilter.materialSku) &&
    matchPrefilter(styleCodes, prefilter.styleCode) &&
    matchPrefilter([item.sewingTaskNo], prefilter.sewingTaskNo) &&
    matchPrefilter(bindingItems.map((binding) => binding.ticket?.feiTicketId || binding.ticketRecordId), prefilter.ticketId) &&
    matchPrefilter(item.ticketNos, prefilter.ticketNo)
  )
}

function matchesBindingPrefilter(item: TransferBagBindingItem, prefilter: TransferBagPrefilter | null = state.prefilter): boolean {
  if (!prefilter) return true
  return (
    matchPrefilter([item.ticket?.feiTicketId || item.ticketRecordId], prefilter.ticketId) &&
    matchPrefilter([item.ticketNo], prefilter.ticketNo) &&
    matchPrefilter([item.originalCutOrderId], prefilter.originalCutOrderId) &&
    matchPrefilter([item.originalCutOrderNo], prefilter.originalCutOrderNo) &&
    matchPrefilter([item.ticket?.productionOrderId || item.navigationPayload.originalOrders.productionOrderId], prefilter.productionOrderId) &&
    matchPrefilter([item.productionOrderNo], prefilter.productionOrderNo) &&
    matchPrefilter([item.ticket?.mergeBatchId || item.navigationPayload.originalOrders.mergeBatchId], prefilter.mergeBatchId) &&
    matchPrefilter([item.mergeBatchNo || item.裁剪批次No], prefilter.mergeBatchNo || prefilter.裁剪批次No) &&
    matchPrefilter([item.ticket?.materialSku], prefilter.materialSku) &&
    matchPrefilter([item.ticket?.styleCode], prefilter.styleCode) &&
    matchPrefilter([item.bagId], prefilter.bagId) &&
    matchPrefilter([item.bagCode], prefilter.bagCode) &&
    matchPrefilter([item.usageId], prefilter.usageId) &&
    matchPrefilter([item.usage?.usageNo], prefilter.usageNo) &&
    matchPrefilter([item.usage?.sewingTaskNo], prefilter.sewingTaskNo)
  )
}

function findMatchingUsages(prefilter: TransferBagPrefilter | null, viewModel = getViewModel()): TransferBagUsageItem[] {
  if (!prefilter || !hasResolverLookupContext(prefilter)) return []
  return viewModel.usages.filter((item) => matchesUsagePrefilter(item, prefilter))
}

function findMatchingBindings(prefilter: TransferBagPrefilter | null, viewModel = getViewModel()): TransferBagBindingItem[] {
  if (!prefilter || !hasResolverLookupContext(prefilter)) return []
  return viewModel.bindings.filter((item) => matchesBindingPrefilter(item, prefilter))
}

function findMatchingMasters(prefilter: TransferBagPrefilter | null, viewModel = getViewModel()): TransferBagMasterItem[] {
  if (!prefilter) return []
  const matchedBagIds = new Set<string>()

  if (prefilter.bagId || prefilter.bagCode) {
    viewModel.masters
      .filter((item) => matchPrefilter([item.bagId], prefilter.bagId) && matchPrefilter([item.bagCode], prefilter.bagCode))
      .forEach((item) => matchedBagIds.add(item.bagId))
  }

  findMatchingUsages(prefilter, viewModel).forEach((item) => matchedBagIds.add(item.bagId))
  findMatchingBindings(prefilter, viewModel).forEach((item) => matchedBagIds.add(item.bagId))

  return matchedBagIds.size ? viewModel.masters.filter((item) => matchedBagIds.has(item.bagId)) : []
}

function matchesMasterStatusFilter(item: TransferBagMasterItem, filter: MasterStatusFilter): boolean {
  if (filter === 'ALL') return true
  if (filter === 'IN_USE_ACTIVE') {
    return ['PACKING', 'DISPATCHED', 'SIGNED'].includes(item.pocketStatusKey)
  }
  return item.pocketStatusKey === filter
}

function getMasterBaseItems() {
  const keyword = state.masterKeyword.trim().toLowerCase()
  const matchedMasterIds = state.prefilter ? new Set(findMatchingMasters(state.prefilter).map((item) => item.bagId)) : null
  return getViewModel().masters.filter((item) => {
    if (matchedMasterIds && matchedMasterIds.size && !matchedMasterIds.has(item.bagId)) return false
    if (keyword) {
      const haystack = [item.bagCode, item.bagType, item.currentLocation, item.latestUsageNo, item.note].join(' ').toLowerCase()
      if (!haystack.includes(keyword)) return false
    }
    return true
  })
}

function getFilteredMasters(baseItems = getMasterBaseItems()) {
  return baseItems.filter((item) => matchesMasterStatusFilter(item, state.masterStatus))
}

function getTransferBagListStats(baseItems = getMasterBaseItems()) {
  return [
    {
      label: '周转口袋总数',
      count: baseItems.length,
      filter: 'ALL' as MasterStatusFilter,
      accentClass: 'text-slate-900',
    },
    {
      label: '空闲口袋数',
      count: baseItems.filter((item) => matchesMasterStatusFilter(item, 'IDLE')).length,
      filter: 'IDLE' as MasterStatusFilter,
      accentClass: 'text-emerald-600',
    },
    {
      label: '使用中口袋数',
      count: baseItems.filter((item) => matchesMasterStatusFilter(item, 'IN_USE_ACTIVE')).length,
      filter: 'IN_USE_ACTIVE' as MasterStatusFilter,
      accentClass: 'text-blue-600',
    },
    {
      label: '待发出口袋数',
      count: baseItems.filter((item) => matchesMasterStatusFilter(item, 'READY_TO_DISPATCH')).length,
      filter: 'READY_TO_DISPATCH' as MasterStatusFilter,
      accentClass: 'text-violet-600',
    },
  ]
}

function resetMasterPagination(): void {
  state.masterPage = 1
}

function getPagedMasters() {
  const baseItems = getMasterBaseItems()
  const filteredItems = getFilteredMasters(baseItems)
  const pageSlice = paginateItems(filteredItems, state.masterPage, state.masterPageSize)
  state.masterPage = pageSlice.page
  return {
    baseItems,
    filteredItems,
    pageSlice,
  }
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
        item.mergeBatchNo || item.裁剪批次No,
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
  const drillContext = readCuttingDrillContextFromLocation(params)
  const prefilter: TransferBagPrefilter = {
    originalCutOrderId: drillContext?.originalCutOrderId || params.get('originalCutOrderId') || undefined,
    originalCutOrderNo: drillContext?.originalCutOrderNo || params.get('originalCutOrderNo') || undefined,
    mergeBatchId: drillContext?.mergeBatchId || params.get('mergeBatchId') || undefined,
    裁剪批次No: drillContext?.mergeBatchNo || params.get('裁剪批次No') || undefined,
    mergeBatchNo: drillContext?.mergeBatchNo || params.get('mergeBatchNo') || undefined,
    materialSku: drillContext?.materialSku || params.get('materialSku') || undefined,
    styleCode: drillContext?.styleCode || params.get('styleCode') || undefined,
    ticketId: drillContext?.ticketId || params.get('ticketId') || params.get('ticketRecordId') || undefined,
    cuttingGroup: drillContext?.cuttingGroup || params.get('cuttingGroup') || undefined,
    warehouseStatus: drillContext?.warehouseStatus || params.get('warehouseStatus') || undefined,
    ticketNo: drillContext?.ticketNo || params.get('ticketNo') || undefined,
    sewingTaskNo: params.get('sewingTaskNo') || undefined,
    bagId: drillContext?.bagId || params.get('bagId') || undefined,
    bagCode: drillContext?.bagCode || params.get('bagCode') || undefined,
    usageId: drillContext?.usageId || params.get('usageId') || undefined,
    usageNo: drillContext?.usageNo || params.get('usageNo') || undefined,
    returnStatus: params.get('returnStatus') || undefined,
    productionOrderId: drillContext?.productionOrderId || params.get('productionOrderId') || undefined,
    productionOrderNo: drillContext?.productionOrderNo || params.get('productionOrderNo') || undefined,
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
  return resolveCarrierScanInput(state.draft.bagCodeInput, state.store)
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
    if (state.prefilter.ticketId && ticket.feiTicketId !== state.prefilter.ticketId) return false
    if (state.prefilter.originalCutOrderId && ticket.originalCutOrderId !== state.prefilter.originalCutOrderId) return false
    if (state.prefilter.ticketNo && ticket.ticketNo !== state.prefilter.ticketNo) return false
    if (state.prefilter.originalCutOrderNo && ticket.originalCutOrderNo !== state.prefilter.originalCutOrderNo) return false
    if (state.prefilter.productionOrderId && ticket.productionOrderId !== state.prefilter.productionOrderId) return false
    if (state.prefilter.productionOrderNo && ticket.productionOrderNo !== state.prefilter.productionOrderNo) return false
    if (state.prefilter.mergeBatchId && ticket.mergeBatchId !== state.prefilter.mergeBatchId) return false
    if (state.prefilter.裁剪批次No && ticket.mergeBatchNo !== state.prefilter.裁剪批次No) return false
    if (state.prefilter.materialSku && ticket.materialSku !== state.prefilter.materialSku) return false
    if (state.prefilter.styleCode && ticket.styleCode !== state.prefilter.styleCode) return false
    return true
  })
}

function getSelectedTicketRecord(): TransferBagTicketCandidate | null {
  const record = resolveFeiTicketScanInput(state.draft.ticketInput, getProjection().ticketRecords)
  if (!record) return null
  return getViewModel().ticketCandidatesById[record.ticketRecordId] ?? null
}

function resolveTransferBagLandingFromPrefilter(
  prefilter: TransferBagPrefilter | null,
  viewModel = getViewModel(),
): TransferBagLandingResolution | null {
  if (!prefilter) return null

  if (hasExplicitUsageContext(prefilter)) {
    const matchedUsages = viewModel.usages.filter(
      (item) => matchPrefilter([item.usageId], prefilter.usageId) && matchPrefilter([item.usageNo], prefilter.usageNo),
    )
    if (matchedUsages.length === 1) {
      const matchedUsage = matchedUsages[0]
      return {
        page: 'detail',
        reason: 'explicit-usage',
        bagId: matchedUsage.bagId,
        bagCode: matchedUsage.bagCode,
        usageId: matchedUsage.usageId,
        usageNo: matchedUsage.usageNo,
      }
    }
    return {
      page: 'list',
      reason: matchedUsages.length ? 'ambiguous-usage' : 'missing-usage',
      matchedCount: matchedUsages.length,
    }
  }

  if (hasExplicitBagContext(prefilter)) {
    const matchedMasters = viewModel.masters.filter(
      (item) => matchPrefilter([item.bagId], prefilter.bagId) && matchPrefilter([item.bagCode], prefilter.bagCode),
    )
    if (matchedMasters.length === 1) {
      const matchedMaster = matchedMasters[0]
      return {
        page: 'detail',
        reason: 'explicit-bag',
        bagId: matchedMaster.bagId,
        bagCode: matchedMaster.bagCode,
        usageId: matchedMaster.currentUsage?.usageId || undefined,
        usageNo: matchedMaster.currentUsage?.usageNo || undefined,
      }
    }
    return {
      page: 'list',
      reason: matchedMasters.length ? 'ambiguous-bag' : 'missing-bag',
      matchedCount: matchedMasters.length,
    }
  }

  if (!hasSourceContext(prefilter)) {
    return {
      page: 'list',
      reason: 'no-source-context',
      matchedCount: 0,
    }
  }

  const sourcePrefilter = buildSourceOnlyPrefilter(prefilter)
  if (!hasResolverLookupContext(sourcePrefilter)) {
    return {
      page: 'list',
      reason: 'source-context-without-object-signal',
      matchedCount: 0,
    }
  }

  const matchedUsages = findMatchingUsages(sourcePrefilter, viewModel)
  if (matchedUsages.length === 1) {
    const matchedUsage = matchedUsages[0]
    return {
      page: 'detail',
      reason: 'source-unique-usage',
      bagId: matchedUsage.bagId,
      bagCode: matchedUsage.bagCode,
      usageId: matchedUsage.usageId,
      usageNo: matchedUsage.usageNo,
    }
  }

  const matchedBindings = findMatchingBindings(sourcePrefilter, viewModel)
  const matchedBindingUsages = uniqueStrings(matchedBindings.map((item) => item.usageId))
    .map((usageId) => viewModel.usagesById[usageId])
    .filter((item): item is TransferBagUsageItem => Boolean(item))

  if (matchedBindingUsages.length === 1) {
    const matchedUsage = matchedBindingUsages[0]
    return {
      page: 'detail',
      reason: 'source-unique-binding-usage',
      bagId: matchedUsage.bagId,
      bagCode: matchedUsage.bagCode,
      usageId: matchedUsage.usageId,
      usageNo: matchedUsage.usageNo,
    }
  }

  const matchedBagIds = uniqueStrings([
    ...matchedUsages.map((item) => item.bagId),
    ...matchedBindings.map((item) => item.bagId),
  ])

  if (matchedBagIds.length === 1) {
    const matchedMaster = viewModel.mastersById[matchedBagIds[0]]
    if (matchedMaster) {
      return {
        page: 'detail',
        reason: 'source-unique-bag',
        bagId: matchedMaster.bagId,
        bagCode: matchedMaster.bagCode,
        usageId: matchedMaster.currentUsage?.usageId || undefined,
        usageNo: matchedMaster.currentUsage?.usageNo || undefined,
      }
    }
  }

  return {
    page: 'list',
    reason: matchedBagIds.length || matchedUsages.length || matchedBindingUsages.length ? 'source-ambiguous' : 'source-not-found',
    matchedCount: Math.max(matchedBagIds.length, matchedUsages.length, matchedBindingUsages.length),
  }
}

function buildTransferBagLandingBanner(
  prefilter: TransferBagPrefilter | null,
  drillContext: CuttingDrillContext | null,
  resolution: TransferBagLandingResolution | null,
): TransferBagLandingBanner | null {
  if (!prefilter || !resolution || resolution.page !== 'list' || !hasSourceContext(prefilter)) return null

  const chips = Array.from(
    new Set(
      buildCuttingDrillChipLabels(drillContext).filter(
        (label) => !label.startsWith('周转口袋码：') && !label.startsWith('使用周期：'),
      ),
    ),
  )

  if (!chips.length) return null

  const sourceLabel = getCuttingSourcePageLabel(drillContext?.sourcePageKey)
  const summary =
    resolution.matchedCount && resolution.matchedCount > 1
      ? `已从${sourceLabel}带入上下文，当前未唯一匹配到某个周转口袋，请先选择口袋或进入详情。`
      : `已从${sourceLabel}带入上下文，当前还未定位到对应周转口袋，请先选择口袋或进入详情。`

  return {
    summary,
    chips,
  }
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
      master.currentLocation = '车缝流转待发区'
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
  state.drillContext = readCuttingDrillContextFromLocation(getWarehouseSearchParams())
  state.prefilter = getPrefilterFromQuery()
  state.preselectedTicketRecordIds = deserializeTransferBagSelectedTicketIds(
    sessionStorage.getItem(CUTTING_TRANSFER_BAG_SELECTED_TICKET_IDS_STORAGE_KEY),
  )
  const viewModel = getViewModel()
  const detailPage = isTransferBagDetailPage()
  const landing = resolveTransferBagLandingFromPrefilter(state.prefilter, viewModel)
  state.landingBanner = buildTransferBagLandingBanner(state.prefilter, state.drillContext, landing)

  if (landing?.page === 'detail' && landing.bagId) {
    const matchedMaster = viewModel.mastersById[landing.bagId] || null
    state.activeMasterId = matchedMaster?.bagId ?? null
    state.draft.bagCodeInput = matchedMaster?.bagCode || landing.bagCode || ''
    state.draft.bagId = matchedMaster?.bagId || landing.bagId

    if (landing.usageId && viewModel.usagesById[landing.usageId]) {
      syncUsageSelection(landing.usageId)
    } else if (matchedMaster?.currentUsage) {
      syncUsageSelection(matchedMaster.currentUsage.usageId)
    } else {
      state.activeUsageId = null
      state.draft.sewingTaskId = ''
      resetReturnDraft(null)
    }

    if (!detailPage) {
      const detailRoute = buildTransferBagDetailRoute({
        bagId: matchedMaster?.bagId || landing.bagId,
        bagCode: matchedMaster?.bagCode || landing.bagCode || undefined,
        usageId: landing.usageId || matchedMaster?.currentUsage?.usageId || undefined,
        usageNo: landing.usageNo || matchedMaster?.currentUsage?.usageNo || undefined,
      })
      if (appStore.getState().pathname !== detailRoute) {
        appStore.navigate(detailRoute)
      }
    }
  } else {
    state.activeMasterId = null
    state.activeUsageId = null
    state.draft.bagId = ''
    state.draft.bagCodeInput = ''
    state.draft.sewingTaskId = ''
    resetReturnDraft(null)
  }

  if (state.prefilter?.sewingTaskNo) {
    const matchedTask = viewModel.sewingTasks.find((item) => item.sewingTaskNo === state.prefilter?.sewingTaskNo)
    state.draft.sewingTaskId = matchedTask?.sewingTaskId ?? state.draft.sewingTaskId
  }

  if (state.prefilter?.returnStatus && ['WAITING_RETURN', 'RETURN_INSPECTING', 'CLOSED', 'EXCEPTION_CLOSED'].includes(state.prefilter.returnStatus)) {
    state.returnStatus = state.prefilter.returnStatus as ReturnStatusFilter
  }

  if (state.prefilter?.ticketId || state.prefilter?.ticketNo) {
    const matchedTicket =
      (state.prefilter.ticketId ? viewModel.ticketCandidatesById[state.prefilter.ticketId] : null) ||
      (state.prefilter.ticketNo ? viewModel.ticketCandidatesByNo[state.prefilter.ticketNo] : null) ||
      null
    state.draft.ticketInput = matchedTicket?.ticketNo || state.prefilter.ticketNo || ''
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

function getCurrentTransferBagPathname(): string {
  return appStore.getState().pathname.split('?')[0] || getCanonicalCuttingPath('transfer-bags')
}

function isTransferBagDetailPage(): boolean {
  return getCurrentTransferBagPathname() === getCanonicalCuttingPath('transfer-bag-detail')
}

function buildTransferBagDetailRoute(options: {
  bagId?: string | null
  bagCode?: string | null
  usageId?: string | null
  usageNo?: string | null
  detailTab?: TransferBagDetailTab | null
  focusSection?: string | null
}): string {
  return buildCuttingRouteWithContext('transferBags', {
    ...(state.drillContext || {}),
    sourcePageKey: state.drillContext?.sourcePageKey || 'transfer-bags',
    bagId: options.bagId || undefined,
    bagCode: options.bagCode || undefined,
    usageId: options.usageId || undefined,
    usageNo: options.usageNo || undefined,
    autoOpenDetail: true,
    detailTab: options.detailTab || undefined,
    focusSection: options.focusSection || undefined,
  })
}

function buildTransferBagListRoute(): string {
  if (!state.drillContext) return getCanonicalCuttingPath('transfer-bags')
  return buildCuttingRouteWithContext('transferBags', {
    ...state.drillContext,
    bagId: undefined,
    bagCode: undefined,
    usageId: undefined,
    usageNo: undefined,
    detailTab: undefined,
    focusSection: undefined,
  })
}

function resolveSourceReturnAction(): { label: string; href: string } | null {
  const sourcePageKey = state.drillContext?.sourcePageKey
  if (!sourcePageKey || sourcePageKey === 'transfer-bags') return null

  if (sourcePageKey === 'cutting-summary') {
    const context = buildReturnToSummaryContext(state.drillContext)
    return context
      ? {
          label: '返回裁剪总表',
          href: buildCuttingRouteWithContext('summary', context),
        }
      : null
  }

  const sourceTargetMap: Partial<Record<NonNullable<CuttingDrillContext['sourcePageKey']>, CuttingNavigationTarget>> = {
    replenishment: 'replenishment',
    'special-processes': 'specialProcesses',
    'material-prep': 'materialPrep',
    'marker-spreading': 'markerSpreading',
    'fei-tickets': 'feiTickets',
    'original-orders': 'originalOrders',
    'production-progress': 'productionProgress',
    'cut-piece-warehouse': 'cutPieceWarehouse',
    'fabric-warehouse': 'fabricWarehouse',
    'merge-batches': 'mergeBatches',
    'cuttable-pool': 'cuttablePool',
  }

  const target = sourceTargetMap[sourcePageKey]
  if (!target || !state.drillContext) return null

  return {
    label: `返回${getCuttingSourcePageLabel(sourcePageKey)}`,
    href: buildCuttingRouteWithContext(target, {
      ...state.drillContext,
      bagId: undefined,
      bagCode: undefined,
      usageId: undefined,
      usageNo: undefined,
      focusSection: undefined,
    }),
  }
}

function resolveFormalBagQrValue(item: TransferBagMasterItem | null): string {
  if (!item) return ''
  return item.qrValue || getSourceMaster(item.bagId)?.qrValue || ''
}

function resolveUsageBagQrValue(usage: TransferBagUsageItem): string {
  return usage.bagMaster?.qrValue || getViewModel().mastersById[usage.bagId]?.qrValue || getSourceMaster(usage.bagId)?.qrValue || ''
}

function summarizeQrValue(value: string): string {
  const normalized = value.trim()
  if (!normalized) return '未找到正式二维码值'
  if (normalized.length <= 32) return normalized
  return `${normalized.slice(0, 16)}...${normalized.slice(-12)}`
}

function isTransferBagDetailTab(value: string | null | undefined): value is TransferBagDetailTab {
  return value === 'current' || value === 'history' || value === 'recovery' || value === 'logs'
}

function readTransferBagDetailTab(): TransferBagDetailTab {
  const detailTab = state.drillContext?.detailTab || getWarehouseSearchParams().get('detailTab')
  return isTransferBagDetailTab(detailTab) ? detailTab : 'current'
}

function getDetailFocusedUsage(activeMaster: TransferBagMasterItem | null): TransferBagUsageItem | null {
  if (state.activeUsageId) {
    const usage = getViewModel().usagesById[state.activeUsageId] ?? null
    if (usage && (!activeMaster || usage.bagId === activeMaster.bagId)) return usage
  }
  return activeMaster?.currentUsage || null
}

function getDetailBagUsages(activeMaster: TransferBagMasterItem | null): TransferBagUsageItem[] {
  if (!activeMaster) return []
  return getViewModel().usages
    .filter((item) => item.bagId === activeMaster.bagId)
    .sort((left, right) => right.usageNo.localeCompare(left.usageNo, 'zh-CN'))
}

function getDetailReturnUsage(usageId: string | null | undefined) {
  if (!usageId) return null
  return getReturnViewModel().waitingReturnUsages.find((item) => item.usageId === usageId) || null
}

function getDetailBagRecoveryEntries(activeMaster: TransferBagMasterItem | null) {
  return getDetailBagUsages(activeMaster)
    .map((usage) => {
      const recovery = getDetailReturnUsage(usage.usageId)
      return {
        usage,
        latestReceipt: recovery?.latestReturnReceipt || null,
        latestCondition: recovery?.latestConditionRecord || null,
        latestClosure: recovery?.latestClosureResult || null,
        recovery,
      }
    })
    .filter((item) => item.latestReceipt || item.latestCondition || item.latestClosure)
}

function formatConditionStatusLabel(status: TransferBagConditionStatus | null | undefined): string {
  if (status === 'GOOD') return '完好'
  if (status === 'MINOR_DAMAGE') return '轻微损坏'
  if (status === 'SEVERE_DAMAGE') return '严重损坏'
  return '待评估'
}

function formatCleanlinessStatusLabel(status: 'CLEAN' | 'DIRTY' | null | undefined): string {
  if (status === 'CLEAN') return '干净'
  if (status === 'DIRTY') return '待清洁'
  return '待评估'
}

function formatReusableDecisionLabel(decision: TransferBagReusableDecision | null | undefined): string {
  if (decision === 'REUSABLE') return '可以'
  if (decision === 'WAITING_CLEANING') return '待清洁后再用'
  if (decision === 'WAITING_REPAIR') return '待维修后再用'
  if (decision === 'DISABLED') return '不能继续使用'
  return '待评估'
}

function formatRecoveryEntryNextStepLabel(entry: ReturnType<typeof getDetailBagRecoveryEntries>[number]): string {
  if (entry.latestCondition?.reusableDecision) return formatReusableDecisionLabel(entry.latestCondition.reusableDecision)
  if (entry.latestClosure?.nextBagStatus) return deriveTransferBagMasterStatus(entry.latestClosure.nextBagStatus).label
  return '待评估'
}

function renderDetailMetric(label: string, value: string, valueClassName = 'text-foreground'): string {
  return `
    <div class="rounded-lg border bg-muted/10 px-3 py-2">
      <div class="text-xs text-muted-foreground">${escapeHtml(label)}</div>
      <div class="mt-1 text-sm font-semibold ${valueClassName}">${escapeHtml(value)}</div>
    </div>
  `
}

function getMasterTodoMeta(item: TransferBagMasterItem): { label: string; href: string } {
  if (item.pocketStatusKey === 'IDLE') {
    return {
      label: '开始装袋',
      href: buildTransferBagDetailRoute({ bagId: item.bagId, bagCode: item.bagCode, focusSection: 'usage-workbench' }),
    }
  }

  if (item.pocketStatusKey === 'PACKING') {
    return {
      label: '继续装袋',
      href: buildTransferBagDetailRoute({
        bagId: item.bagId,
        bagCode: item.bagCode,
        usageId: item.currentUsage?.usageId || undefined,
        usageNo: item.currentUsage?.usageNo || undefined,
        focusSection: 'usage-workbench',
      }),
    }
  }

  if (item.pocketStatusKey === 'READY_TO_DISPATCH') {
    return {
      label: '打印清单',
      href: buildTransferBagDetailRoute({
        bagId: item.bagId,
        bagCode: item.bagCode,
        usageId: item.currentUsage?.usageId || undefined,
        usageNo: item.currentUsage?.usageNo || undefined,
        focusSection: 'usage-workbench',
      }),
    }
  }

  if (item.pocketStatusKey === 'DISPATCHED') {
    return {
      label: '签收',
      href: buildTransferBagDetailRoute({
        bagId: item.bagId,
        bagCode: item.bagCode,
        usageId: item.currentUsage?.usageId || undefined,
        usageNo: item.currentUsage?.usageNo || undefined,
        focusSection: 'usage-workbench',
      }),
    }
  }

  if (item.pocketStatusKey === 'SIGNED') {
    return {
      label: '回仓',
      href: buildTransferBagDetailRoute({
        bagId: item.bagId,
        bagCode: item.bagCode,
        usageId: item.currentUsage?.usageId || undefined,
        usageNo: item.currentUsage?.usageNo || undefined,
        focusSection: 'return-workbench',
      }),
    }
  }

  if (item.pocketStatusKey === 'RETURNED') {
    return {
      label: '关闭周期',
      href: buildTransferBagDetailRoute({
        bagId: item.bagId,
        bagCode: item.bagCode,
        usageId: item.currentUsage?.usageId || undefined,
        usageNo: item.currentUsage?.usageNo || undefined,
        focusSection: 'return-workbench',
      }),
    }
  }

  return {
    label: '查看详情',
    href: buildTransferBagDetailRoute({
      bagId: item.bagId,
      bagCode: item.bagCode,
      usageId: item.currentUsage?.usageId || undefined,
      usageNo: item.currentUsage?.usageNo || undefined,
    }),
  }
}

function renderHeaderActions(): string {
  const sourceReturnAction = resolveSourceReturnAction()
  const sourceReturnButton = sourceReturnAction
    ? `<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="${escapeHtml(sourceReturnAction.href)}">${escapeHtml(sourceReturnAction.label)}</button>`
    : ''
  const fallbackWarehouseButton = sourceReturnAction
    ? ''
    : '<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="go-cut-piece-warehouse-index">返回裁片仓</button>'

  if (isTransferBagDetailPage()) {
    return `
      <div class="flex flex-wrap items-center gap-2">
        <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="${escapeHtml(buildTransferBagListRoute())}">返回周转口袋流转</button>
        ${sourceReturnButton}
        ${hasSummaryReturnContext(state.drillContext) ? '' : '<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="go-summary-index">查看裁剪总表</button>'}
      </div>
    `
  }

  return `
    <div class="flex flex-wrap items-center gap-2">
      ${sourceReturnButton || fallbackWarehouseButton}
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="go-fei-tickets-index">去打印菲票</button>
      ${hasSummaryReturnContext(state.drillContext) ? '' : '<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="go-summary-index">查看裁剪总表</button>'}
    </div>
  `
}

function renderStatsCards(): string {
  const cardsHtml = getTransferBagListStats()
    .map((item) =>
      renderWorkbenchActionCard({
        title: item.label,
        count: item.count,
        hint: '',
        attrs: `data-transfer-bags-action="set-master-status" data-status="${item.filter}"`,
        active: state.masterStatus === item.filter,
        accentClass: item.accentClass,
      }),
    )
    .join('')

  return `
    <section class="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
      ${cardsHtml}
    </section>
  `
}

function renderReturnStatsCards(): string {
  const summary = getReturnViewModel().summary
  return `
    <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
      ${renderCompactKpiCard('待回仓使用周期数', summary.waitingReturnUsageCount, '', 'text-orange-600')}
      ${renderCompactKpiCard('回仓验收中使用周期数', summary.inspectingUsageCount, '', 'text-cyan-600')}
      ${renderCompactKpiCard('已关闭使用周期数', summary.closedUsageCount, '', 'text-emerald-600')}
      ${renderCompactKpiCard('可复用口袋数', summary.reusableBagCount, '', 'text-emerald-600')}
      ${renderCompactKpiCard('待清洁口袋数', summary.waitingCleaningBagCount, '', 'text-sky-600')}
      ${renderCompactKpiCard('待维修口袋数', summary.waitingRepairBagCount, '', 'text-rose-600')}
    </section>
  `
}

function renderPrefilterBar(): string {
  const chips = Array.from(
    new Set([
      ...buildCuttingDrillChipLabels(state.drillContext),
      state.prefilter?.sewingTaskNo ? `车缝任务：${state.prefilter.sewingTaskNo}` : '',
      state.prefilter?.returnStatus ? `回货状态：${state.prefilter.returnStatus}` : '',
      state.preselectedTicketRecordIds.length ? `预选菲票：${state.preselectedTicketRecordIds.length} 张` : '',
    ].filter(Boolean)),
  )
  if (!chips.length) return ''

  return renderWorkbenchStateBar({
    summary: buildCuttingDrillSummary(state.drillContext) || '当前按外部上下文预填周转口袋流转工作区',
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

function renderLandingBanner(): string {
  if (!state.landingBanner) return ''

  return renderWorkbenchStateBar({
    summary: state.landingBanner.summary,
    chips: state.landingBanner.chips.map((label) => renderWorkbenchFilterChip(label, 'data-transfer-bags-action="clear-prefill"', 'amber')),
    clearAttrs: 'data-transfer-bags-action="clear-prefill"',
  })
}

function renderDemoFixturePanel(): string {
  return ''
}

function renderMasterSection(): string {
  const { filteredItems, pageSlice } = getPagedMasters()
  const items = pageSlice.items
  return `
    <div class="space-y-3">
      ${renderStickyFilterShell(`
        <div class="space-y-3">
          <div>
            <h2 class="text-sm font-semibold text-foreground">筛选条件</h2>
          </div>
          <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label class="space-y-2 xl:col-span-3">
              <span class="text-sm font-medium text-foreground">关键词</span>
              <input
                type="text"
                value="${escapeHtml(state.masterKeyword)}"
                placeholder="支持周转口袋码 / 口袋类型 / 位置 / 最新使用周期号"
                class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                data-transfer-bags-master-field="keyword"
              />
            </label>
            <label class="space-y-2">
              <span class="text-sm font-medium text-foreground">状态筛选</span>
              <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-master-field="status">
                <option value="ALL" ${state.masterStatus === 'ALL' ? 'selected' : ''}>全部</option>
                <option value="IDLE" ${state.masterStatus === 'IDLE' ? 'selected' : ''}>空闲</option>
                <option value="IN_USE_ACTIVE" ${state.masterStatus === 'IN_USE_ACTIVE' ? 'selected' : ''}>使用中</option>
                <option value="PACKING" ${state.masterStatus === 'PACKING' ? 'selected' : ''}>装袋中</option>
                <option value="READY_TO_DISPATCH" ${state.masterStatus === 'READY_TO_DISPATCH' ? 'selected' : ''}>待发出</option>
                <option value="DISPATCHED" ${state.masterStatus === 'DISPATCHED' ? 'selected' : ''}>已发出</option>
                <option value="SIGNED" ${state.masterStatus === 'SIGNED' ? 'selected' : ''}>已签收</option>
                <option value="RETURNED" ${state.masterStatus === 'RETURNED' ? 'selected' : ''}>已回仓</option>
                <option value="DISABLED" ${state.masterStatus === 'DISABLED' ? 'selected' : ''}>停用 / 报废</option>
              </select>
            </label>
          </div>
        </div>
      `)}
      <section class="rounded-lg border bg-card">
        <div class="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h2 class="text-sm font-semibold text-foreground">周转口袋列表</h2>
          </div>
          <div class="text-xs text-muted-foreground">共 ${filteredItems.length} 条周转口袋</div>
        </div>
        ${!items.length
          ? '<div class="px-6 py-10 text-center text-sm text-muted-foreground">暂无匹配结果</div>'
          : `${renderStickyTableScroller(`
            <table class="min-w-full text-sm">
              <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th class="px-4 py-3 text-left">周转口袋码</th>
                  <th class="px-4 py-3 text-left">当前状态</th>
                  <th class="px-4 py-3 text-left">当前 / 最近周转号</th>
                  <th class="px-4 py-3 text-left">当前任务</th>
                  <th class="px-4 py-3 text-left">绑定数量</th>
                  <th class="px-4 py-3 text-left">当前位置</th>
                  <th class="px-4 py-3 text-left">操作</th>
                </tr>
              </thead>
              <tbody>
                ${items
                  .map(
                    (item) => {
                      const detailHref = buildTransferBagDetailRoute({
                        bagId: item.bagId,
                        bagCode: item.bagCode,
                        usageId: item.currentUsage?.usageId || undefined,
                        usageNo: item.currentUsage?.usageNo || undefined,
                      })
                      const todoMeta = getMasterTodoMeta(item)
                      return `
                      <tr class="border-b ${state.activeMasterId === item.bagId ? 'bg-blue-50/60' : 'bg-card'}">
                        <td class="px-4 py-3">
                          <button type="button" class="font-medium text-blue-700 hover:underline" data-nav="${escapeHtml(detailHref)}">${escapeHtml(item.bagCode)}</button>
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.bagType)} / 容量 ${escapeHtml(String(item.capacity))} 张</div>
                        </td>
                        <td class="px-4 py-3">
                          ${renderTag(item.pocketStatusMeta.label, item.pocketStatusMeta.className)}
                        </td>
                        <td class="px-4 py-3">
                          <div class="font-medium text-foreground">${escapeHtml(item.currentUsage?.usageNo || item.latestUsageNo || '暂无')}</div>
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.currentUsage?.startedAt || item.currentReturnedAt || item.currentSignedAt || item.currentDispatchedAt || '暂无时间')}</div>
                        </td>
                        <td class="px-4 py-3">
                          <div class="font-medium text-foreground">${escapeHtml(item.currentUsage?.sewingTaskNo || '待绑定任务')}</div>
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.currentStyleCode || '款号待锁定')}</div>
                        </td>
                        <td class="px-4 py-3">
                          <div class="font-medium text-foreground">菲票 ${escapeHtml(String(item.packedTicketCount))} 张</div>
                          <div class="mt-1 text-xs text-muted-foreground">总件数 ${escapeHtml(String(item.currentTotalPieceCount))} 件</div>
                        </td>
                        <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(item.currentLocation || '待命位')}</td>
                        <td class="px-4 py-3">
                          <div class="flex flex-wrap gap-2">
                            <button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-nav="${escapeHtml(todoMeta.href)}">${escapeHtml(todoMeta.label)}</button>
                            <button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-nav="${escapeHtml(detailHref)}">查看详情</button>
                          </div>
                        </td>
                      </tr>
                    `
                    },
                  )
                  .join('')}
              </tbody>
            </table>
          `)}
          ${renderWorkbenchPagination({
            page: pageSlice.page,
            pageSize: pageSlice.pageSize,
            total: filteredItems.length,
            actionAttr: 'data-transfer-bags-action',
            pageAction: 'set-master-page',
            pageSizeAttr: 'data-transfer-bags-master-page-size',
            pageSizeOptions: [10, 20, 50],
          })}`}
      </section>
    </div>
  `
}

function renderMasterDetail(item: TransferBagMasterItem | null): string {
  if (!item) return ''
  const currentUsage = item.currentUsage
  const currentBindings = currentUsage?.bindingItems || []
  const qrValue = resolveFormalBagQrValue(item)
  const historyUsages = getViewModel().usages
    .filter((usage) => usage.bagId === item.bagId)
    .sort((left, right) => right.usageNo.localeCompare(left.usageNo, 'zh-CN'))
  return renderWorkbenchSecondaryPanel({
    title: `周转口袋详情：${item.bagCode}`,
    hint: '',
    defaultOpen: true,
    body: `
      <div class="grid gap-3 xl:grid-cols-[0.88fr,1.12fr]">
        <div class="space-y-3">
          <div class="space-y-3 rounded-lg border bg-muted/15 p-3 text-sm">
            <div><span class="text-muted-foreground">周转口袋码：</span><span class="font-medium text-foreground">${escapeHtml(item.bagCode)}</span></div>
            <div><span class="text-muted-foreground">口袋状态：</span>${renderTag(item.pocketStatusMeta.label, item.pocketStatusMeta.className)}</div>
            <div><span class="text-muted-foreground">当前使用周期号：</span><span class="font-medium text-foreground">${escapeHtml(currentUsage?.usageNo || '暂无')}</span></div>
            <div><span class="text-muted-foreground">开始时间：</span><span class="font-medium text-foreground">${escapeHtml(currentUsage?.startedAt || '待开始')}</span></div>
            <div><span class="text-muted-foreground">发出时间：</span><span class="font-medium text-foreground">${escapeHtml(item.currentDispatchedAt || '待发出')}</span></div>
            <div><span class="text-muted-foreground">签收时间：</span><span class="font-medium text-foreground">${escapeHtml(item.currentSignedAt || '待签收')}</span></div>
            <div><span class="text-muted-foreground">回仓时间：</span><span class="font-medium text-foreground">${escapeHtml(item.currentReturnedAt || '待回仓')}</span></div>
            <div><span class="text-muted-foreground">当前位置：</span><span class="font-medium text-foreground">${escapeHtml(item.currentLocation || '待命位')}</span></div>
          </div>
          <div class="space-y-3 rounded-lg border bg-muted/15 p-3 text-sm">
            <div><span class="text-muted-foreground">容量 / 当前绑定数：</span><span class="font-medium text-foreground">${escapeHtml(`${item.capacity} 张 / ${item.packedTicketCount} 张菲票`)}</span></div>
            <div><span class="text-muted-foreground">当前绑定总数量：</span><span class="font-medium text-foreground">${escapeHtml(String(item.currentTotalPieceCount))}</span></div>
            <div><span class="text-muted-foreground">当前款号：</span><span class="font-medium text-foreground">${escapeHtml(item.currentStyleCode || '待锁定')}</span></div>
            <div><span class="text-muted-foreground">来源生产单集合：</span><span class="font-medium text-foreground">${escapeHtml(currentUsage?.productionOrderNos.join(' / ') || '暂无')}</span></div>
            <div><span class="text-muted-foreground">来源原始裁片单集合：</span><span class="font-medium text-foreground">${escapeHtml(currentUsage?.originalCutOrderNos.join(' / ') || '暂无')}</span></div>
            <div><span class="text-muted-foreground">来源裁剪批次集合：</span><span class="font-medium text-foreground">${escapeHtml(currentUsage?.mergeBatchNos.join(' / ') || '暂无')}</span></div>
          </div>
          <div class="rounded-lg border bg-card p-4">
            <div class="text-sm font-semibold text-foreground">正式二维码</div>
            ${
              qrValue
                ? `
                  <div class="mt-3 flex flex-col gap-3 md:flex-row md:items-center">
                    <div class="inline-flex w-fit rounded-xl border bg-white p-3 shadow-sm">
                      ${renderRealQrPlaceholder({
                        value: qrValue,
                        size: 168,
                        title: `周转口袋码 ${item.bagCode}`,
                        label: `周转口袋 ${item.bagCode} 正式二维码`,
                      })}
                    </div>
                    <div class="space-y-2 text-sm">
                      <div><span class="text-muted-foreground">周转口袋码：</span><span class="font-medium text-foreground">${escapeHtml(item.bagCode)}</span></div>
                      <div><span class="text-muted-foreground">当前使用周期：</span><span class="font-medium text-foreground">${escapeHtml(currentUsage?.usageNo || '暂无')}</span></div>
                      <div><span class="text-muted-foreground">正式二维码值：</span><span class="font-medium break-all text-foreground">${escapeHtml(summarizeQrValue(qrValue))}</span></div>
                    </div>
                  </div>
                `
                : '<div class="mt-3 rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">当前未找到可展示的正式二维码值。</div>'
            }
          </div>
          <div class="flex flex-wrap gap-2">
            ${item.pocketStatusKey === 'IDLE' ? `<button type="button" class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-transfer-bags-action="use-master" data-bag-id="${escapeHtml(item.bagId)}">开始装袋</button>` : ''}
            ${item.pocketStatusKey === 'PACKING' ? `<button type="button" class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-transfer-bags-action="use-master" data-bag-id="${escapeHtml(item.bagId)}">继续装袋</button>` : ''}
            ${item.pocketStatusKey === 'READY_TO_DISPATCH' && currentUsage ? `<button type="button" class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-transfer-bags-action="print-manifest" data-usage-id="${escapeHtml(currentUsage.usageId)}">打印装袋清单</button><button type="button" class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-transfer-bags-action="mark-dispatched" data-usage-id="${escapeHtml(currentUsage.usageId)}">发出</button>` : ''}
            ${item.pocketStatusKey === 'DISPATCHED' && currentUsage ? `<button type="button" class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-transfer-bags-action="mark-signed" data-usage-id="${escapeHtml(currentUsage.usageId)}">签收</button>` : ''}
            ${item.pocketStatusKey === 'SIGNED' && currentUsage ? `<button type="button" class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-transfer-bags-action="prepare-return" data-usage-id="${escapeHtml(currentUsage.usageId)}">回仓</button>` : ''}
            ${item.pocketStatusKey === 'RETURNED' && currentUsage ? `<button type="button" class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-transfer-bags-action="close-usage-cycle" data-usage-id="${escapeHtml(currentUsage.usageId)}">关闭本次使用周期</button>` : ''}
          </div>
        </div>
        <div class="space-y-3">
          <div class="rounded-lg border">
            <div class="border-b px-3 py-2 text-xs font-medium text-muted-foreground">袋内菲票明细</div>
            ${
              currentBindings.length
                ? renderStickyTableScroller(`
                    <table class="min-w-full text-sm">
                      <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th class="px-3 py-2 text-left">菲票码</th>
                          <th class="px-3 py-2 text-left">款号</th>
                          <th class="px-3 py-2 text-left">面料 SKU</th>
                          <th class="px-3 py-2 text-left">部位</th>
                          <th class="px-3 py-2 text-right">数量</th>
                          <th class="px-3 py-2 text-left">来源生产单号</th>
                          <th class="px-3 py-2 text-left">来源裁片单号</th>
                          <th class="px-3 py-2 text-left">所属裁片批次号</th>
                          <th class="px-3 py-2 text-left">菲票状态</th>
                          <th class="px-3 py-2 text-left">是否允许移除</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${currentBindings
                          .map(
                            (binding) => `
                              <tr class="border-b bg-card">
                                <td class="px-3 py-2 font-medium text-foreground">${escapeHtml(binding.ticketNo)}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.ticket?.styleCode || currentUsage?.styleCode || '待补')}</td>
                                <td class="px-3 py-2">
                                  <div class="font-medium text-foreground">${escapeHtml(binding.ticket?.materialSku || '待补')}</div>
                                  <div class="text-xs text-muted-foreground">${escapeHtml(binding.ticket ? `${binding.ticket.color || '待补颜色'} / ${binding.ticket.size || '待补尺码'}` : '待补')}</div>
                                </td>
                                <td class="px-3 py-2">${escapeHtml(binding.ticket?.partName || '待补部位')}</td>
                                <td class="px-3 py-2 text-right tabular-nums">${escapeHtml(String(binding.qty))}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.productionOrderNo)}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.originalCutOrderNo)}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.mergeBatchNo || binding.裁剪批次No || '—')}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.ticket?.ticketStatus === 'VOIDED' ? '已作废' : '有效')}</td>
                                <td class="px-3 py-2">
                                  ${
                                    binding.removable
                                      ? `<button type="button" class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted" data-transfer-bags-action="remove-binding" data-binding-id="${escapeHtml(binding.bindingId)}">可移除</button>`
                                      : '<span class="text-xs text-muted-foreground">当前阶段不可移除</span>'
                                  }
                                </td>
                              </tr>
                            `,
                          )
                          .join('')}
                      </tbody>
                    </table>
                  `, 'max-h-[24vh]')
                : '<div class="px-3 py-8 text-center text-sm text-muted-foreground">当前口袋暂无已绑定菲票。</div>'
            }
          </div>
          <div class="rounded-lg border">
            <div class="border-b px-3 py-2 text-xs font-medium text-muted-foreground">历史使用周期</div>
            ${
              historyUsages.length
                ? renderStickyTableScroller(`
                    <table class="min-w-full text-sm">
                      <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th class="px-3 py-2 text-left">使用周期号</th>
                          <th class="px-3 py-2 text-left">状态</th>
                          <th class="px-3 py-2 text-left">时间</th>
                          <th class="px-3 py-2 text-right">绑定菲票数</th>
                          <th class="px-3 py-2 text-left">发出 / 签收 / 回仓</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${historyUsages
                          .map(
                            (usage) => `
                              <tr class="border-b bg-card">
                                <td class="px-3 py-2">
                                  <button type="button" class="font-medium text-blue-700 hover:underline" data-nav="${escapeHtml(buildTransferBagDetailRoute({
                                    bagId: usage.bagId,
                                    bagCode: usage.bagCode,
                                    usageId: usage.usageId,
                                    usageNo: usage.usageNo,
                                  }))}">${escapeHtml(usage.usageNo)}</button>
                                </td>
                                <td class="px-3 py-2">${renderTag(usage.pocketStatusMeta.label, usage.pocketStatusMeta.className)}</td>
                                <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(usage.startedAt || usage.dispatchAt || '待补')}</td>
                                <td class="px-3 py-2 text-right tabular-nums">${escapeHtml(String(usage.summary.ticketCount))}</td>
                                <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml([usage.dispatchAt || '待发出', usage.signedAt || '待签收', usage.returnedAt || '待回仓'].join(' / '))}</td>
                              </tr>
                            `,
                          )
                          .join('')}
                      </tbody>
                    </table>
                  `, 'max-h-[20vh]')
                : '<div class="px-3 py-8 text-center text-sm text-muted-foreground">当前还没有历史使用周期记录。</div>'
            }
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
          <h2 class="text-sm font-semibold text-foreground">当前使用周期工作区</h2>
        </div>
        <div class="grid gap-3 md:grid-cols-2">
          <label class="space-y-2">
            <span class="text-sm font-medium text-foreground">步骤 1：选择口袋</span>
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
            <span class="text-sm font-medium text-foreground">步骤 1：扫周转口袋码</span>
            <div class="flex gap-2">
              <input
                type="text"
                value="${escapeHtml(state.draft.bagCodeInput)}"
                placeholder="输入或扫描周转口袋码"
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
                placeholder="填写本次装袋备注"
              class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              data-transfer-bags-workbench-field="note"
            />
          </label>
        </div>
        <div class="flex flex-wrap gap-2">
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="create-usage">开始装袋</button>
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="clear-draft">清空工作台</button>
          ${candidateTickets.length ? `<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="import-prefill">导入候选菲票（${candidateTickets.length}）</button>` : ''}
        </div>
        ${renderCandidatePanel(candidateTickets)}
        <div class="grid gap-3 lg:grid-cols-[1fr,auto]">
          <label class="space-y-2">
            <span class="text-sm font-medium text-foreground">步骤 2：扫菲票码</span>
            <input
              type="text"
              value="${escapeHtml(state.draft.ticketInput)}"
              placeholder="输入或扫描菲票码"
              class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              data-transfer-bags-workbench-field="ticketInput"
            />
          </label>
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted lg:self-end" data-transfer-bags-action="bind-ticket">绑定父子码</button>
        </div>
      </article>
      <article class="space-y-3 rounded-lg border bg-card p-3">
        <div>
          <h2 class="text-sm font-semibold text-foreground">当前口袋使用周期摘要</h2>
        </div>
        ${activeUsage
          ? `
            <div class="grid gap-3 md:grid-cols-2">
              <div class="space-y-2 rounded-lg border bg-muted/15 p-3 text-sm">
                <div><span class="text-muted-foreground">使用周期号：</span><span class="font-medium text-foreground">${escapeHtml(activeUsage.usageNo)}</span></div>
                <div><span class="text-muted-foreground">周转口袋码：</span><span class="font-medium text-foreground">${escapeHtml(activeUsage.bagCode)}</span></div>
                <div><span class="text-muted-foreground">当前锁定款号：</span><span class="font-medium text-foreground">${escapeHtml(activeUsage.styleCode || '待锁定')}</span></div>
                <div><span class="text-muted-foreground">车缝任务：</span><span class="font-medium text-foreground">${escapeHtml(activeUsage.sewingTaskNo)}</span></div>
                <div><span class="text-muted-foreground">车缝工厂：</span><span class="font-medium text-foreground">${escapeHtml(activeUsage.sewingFactoryName)}</span></div>
                <div><span class="text-muted-foreground">状态：</span>${renderTag(activeUsage.statusMeta.label, activeUsage.statusMeta.className)}</div>
              </div>
              <div class="space-y-2 rounded-lg border bg-muted/15 p-3 text-sm">
                <div><span class="text-muted-foreground">已绑定菲票数：</span><span class="font-medium text-foreground">${escapeHtml(String(currentSummary?.ticketCount || 0))}</span></div>
                <div><span class="text-muted-foreground">当前总件数：</span><span class="font-medium text-foreground">${escapeHtml(String(currentSummary?.quantityTotal || 0))}</span></div>
                <div><span class="text-muted-foreground">原始裁片单数：</span><span class="font-medium text-foreground">${escapeHtml(String(currentSummary?.originalCutOrderCount || 0))}</span></div>
                <div><span class="text-muted-foreground">生产单数：</span><span class="font-medium text-foreground">${escapeHtml(String(currentSummary?.productionOrderCount || 0))}</span></div>
                <div><span class="text-muted-foreground">裁剪批次摘要：</span><span class="font-medium text-foreground">${escapeHtml(activeUsage.mergeBatchNos.join(' / ') || '无')}</span></div>
                <div><span class="text-muted-foreground">容量状态：</span><span class="font-medium ${capacityExceeded ? 'text-amber-700' : 'text-foreground'}">${capacityExceeded ? '已超容量' : '未超容量'}</span></div>
              </div>
            </div>
            <div class="flex flex-wrap gap-2">
              <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="print-manifest" data-usage-id="${escapeHtml(activeUsage.usageId)}">打印装袋清单</button>
              <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="mark-ready" data-usage-id="${escapeHtml(activeUsage.usageId)}">完成装袋</button>
              <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="mark-dispatched" data-usage-id="${escapeHtml(activeUsage.usageId)}">发出</button>
              <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="mark-signed" data-usage-id="${escapeHtml(activeUsage.usageId)}">签收</button>
            </div>
            <div class="rounded-lg border">
              <div class="border-b px-3 py-2 text-xs font-medium text-muted-foreground">袋内菲票明细</div>
              ${currentBindings.length
                ? renderStickyTableScroller(`
                    <table class="min-w-full text-sm">
                      <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th class="px-3 py-2 text-left">菲票码</th>
                          <th class="px-3 py-2 text-left">款号</th>
                          <th class="px-3 py-2 text-left">面料 SKU</th>
                          <th class="px-3 py-2 text-left">部位</th>
                          <th class="px-3 py-2 text-right">数量</th>
                          <th class="px-3 py-2 text-left">原始裁片单</th>
                          <th class="px-3 py-2 text-left">生产单</th>
                          <th class="px-3 py-2 text-left">裁剪批次</th>
                          <th class="px-3 py-2 text-left">菲票状态</th>
                          <th class="px-3 py-2 text-left">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${currentBindings
                          .map(
                            (binding) => `
                              <tr class="border-b bg-card">
                                <td class="px-3 py-2">${escapeHtml(binding.ticketNo)}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.ticket?.styleCode || activeUsage.styleCode || '待补')}</td>
                                <td class="px-3 py-2">
                                  <div class="font-medium text-foreground">${escapeHtml(binding.ticket?.materialSku || '待补')}</div>
                                  <div class="text-xs text-muted-foreground">${escapeHtml(binding.ticket ? `${binding.ticket.color || '待补颜色'} / ${binding.ticket.size || '待补尺码'}` : '待补')}</div>
                                </td>
                                <td class="px-3 py-2">${escapeHtml(binding.ticket?.partName || '待补部位')}</td>
                                <td class="px-3 py-2 text-right tabular-nums">${escapeHtml(String(binding.qty))}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.originalCutOrderNo)}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.productionOrderNo)}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.mergeBatchNo || binding.裁剪批次No || '无')}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.ticket?.ticketStatus === 'VOIDED' ? '已作废' : '有效')}</td>
                                <td class="px-3 py-2">
                                  ${
                                    binding.removable
                                      ? `<button type="button" class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted" data-transfer-bags-action="remove-binding" data-binding-id="${escapeHtml(binding.bindingId)}">移除未锁定菲票</button>`
                                      : '<span class="text-xs text-muted-foreground">当前阶段不可移除</span>'
                                  }
                                </td>
                              </tr>
                            `,
                          )
                          .join('')}
                      </tbody>
                    </table>
                  `, 'max-h-[28vh]')
                : '<div class="px-3 py-8 text-center text-sm text-muted-foreground">当前使用周期暂无已绑定菲票。</div>'}
            </div>
          `
          : '<div class="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">当前尚未选中使用周期。请先创建或从发出台账中选择一个使用周期。</div>'}
      </article>
    </section>
  `
}

function renderCandidatePanel(candidates: TransferBagTicketCandidate[]): string {
  if (!candidates.length) return ''
  return renderWorkbenchSecondaryPanel({
    title: '候选菲票预填',
    hint: '',
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
        </div>
      </div>
      ${renderStickyFilterShell(`
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label class="space-y-2 xl:col-span-2">
            <span class="text-sm font-medium text-foreground">关键词</span>
            <input
              type="text"
              value="${escapeHtml(state.usageKeyword)}"
              placeholder="支持使用周期号 / 周转口袋码 / 车缝任务号 / 原始裁片单"
              class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              data-transfer-bags-usage-field="keyword"
            />
          </label>
          <label class="space-y-2">
            <span class="text-sm font-medium text-foreground">使用周期状态</span>
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
        ? '<div class="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">暂无使用周期台账</div>'
        : renderStickyTableScroller(`
            <table class="min-w-full text-sm">
              <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th class="px-4 py-3 text-left">使用周期号</th>
                  <th class="px-4 py-3 text-left">周转口袋码</th>
                  <th class="px-4 py-3 text-left">车缝任务号</th>
                  <th class="px-4 py-3 text-left">车缝工厂</th>
                  <th class="px-4 py-3 text-right">菲票数</th>
                  <th class="px-4 py-3 text-right">原始裁片单数</th>
                  <th class="px-4 py-3 text-left">使用周期状态</th>
                  <th class="px-4 py-3 text-left">发出时间</th>
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
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.note || '无备注')}</div>
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
    title: `使用周期详情：${item.usageNo}`,
    hint: '',
    countText: `${item.summary.ticketCount} 张票 / ${item.summary.originalCutOrderCount} 个原始裁片单`,
    defaultOpen: true,
    body: `
      <div class="grid gap-3 xl:grid-cols-[0.9fr,1.1fr]">
        <div class="space-y-3 rounded-lg border bg-muted/15 p-3 text-sm">
          <div><span class="text-muted-foreground">周转口袋码：</span><span class="font-medium text-foreground">${escapeHtml(item.bagCode)}</span></div>
          <div><span class="text-muted-foreground">车缝任务：</span><span class="font-medium text-foreground">${escapeHtml(item.sewingTaskNo)}</span></div>
          <div><span class="text-muted-foreground">车缝工厂：</span><span class="font-medium text-foreground">${escapeHtml(item.sewingFactoryName)}</span></div>
          <div><span class="text-muted-foreground">菲票数：</span><span class="font-medium text-foreground">${escapeHtml(String(item.summary.ticketCount))}</span></div>
          <div><span class="text-muted-foreground">生产单数：</span><span class="font-medium text-foreground">${escapeHtml(String(item.summary.productionOrderCount))}</span></div>
          <div><span class="text-muted-foreground">最新清单：</span><span class="font-medium text-foreground">${escapeHtml(item.latestManifest?.manifestId || '尚未打印')}</span></div>
          <div class="flex flex-wrap gap-2">
            <button type="button" class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-transfer-bags-action="go-original-orders" data-usage-id="${escapeHtml(item.usageId)}">查看原始裁片单</button>
            <button type="button" class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-transfer-bags-action="go-summary" data-usage-id="${escapeHtml(item.usageId)}">去裁剪总表</button>
          </div>
        </div>
        <div class="space-y-3 rounded-lg border bg-muted/15 p-3">
          <div>
            <h3 class="text-sm font-semibold text-foreground">动作审计</h3>
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
            : '<div class="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">暂无审计记录</div>'}
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
        <h2 class="text-sm font-semibold text-foreground">待回仓使用周期列表</h2>
      </div>
      ${renderStickyFilterShell(`
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label class="space-y-2 xl:col-span-3">
            <span class="text-sm font-medium text-foreground">关键词</span>
            <input
              type="text"
              value="${escapeHtml(state.returnKeyword)}"
              placeholder="支持使用周期号 / 周转口袋码 / 车缝任务号 / 原始裁片单号"
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
        ? '<div class="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">暂无回货使用周期</div>'
        : renderStickyTableScroller(`
            <table class="min-w-full text-sm">
              <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th class="px-4 py-3 text-left">使用周期号</th>
                  <th class="px-4 py-3 text-left">周转口袋码</th>
                  <th class="px-4 py-3 text-left">车缝任务号</th>
                  <th class="px-4 py-3 text-left">车缝工厂</th>
                  <th class="px-4 py-3 text-left">发出时间</th>
                  <th class="px-4 py-3 text-left">使用周期状态</th>
                  <th class="px-4 py-3 text-left">口袋状态</th>
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
          <h2 class="text-sm font-semibold text-foreground">回仓 / 验收工作区</h2>
        </div>
        ${activeUsage
          ? `
            <div class="grid gap-3 md:grid-cols-2">
              <div class="space-y-2 rounded-lg border bg-muted/15 p-3 text-sm">
                <div><span class="text-muted-foreground">使用周期号：</span><span class="font-medium text-foreground">${escapeHtml(activeUsage.usageNo)}</span></div>
                <div><span class="text-muted-foreground">周转口袋码：</span><span class="font-medium text-foreground">${escapeHtml(activeUsage.bagCode)}</span></div>
                <div><span class="text-muted-foreground">车缝任务：</span><span class="font-medium text-foreground">${escapeHtml(activeUsage.sewingTaskNo)}</span></div>
                <div><span class="text-muted-foreground">当前状态：</span>${renderTag(activeUsage.statusMeta.label, activeUsage.statusMeta.className)}</div>
                <div><span class="text-muted-foreground">口袋状态：</span>${activeUsage.bagStatusMeta ? renderTag(activeUsage.bagStatusMeta.label, activeUsage.bagStatusMeta.className) : '<span class="text-xs text-muted-foreground">待补</span>'}</div>
              </div>
              <div class="space-y-2 rounded-lg border bg-muted/15 p-3 text-sm">
                <div><span class="text-muted-foreground">菲票数：</span><span class="font-medium text-foreground">${escapeHtml(String(activeUsage.summary.ticketCount))}</span></div>
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
                <span class="text-sm font-medium text-foreground">回货菲票数摘要</span>
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
            </div>
            <div class="flex flex-wrap gap-2">
              <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="prepare-return" data-usage-id="${escapeHtml(activeUsage.usageId)}">创建回货草稿</button>
              <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="complete-return-inspection" data-usage-id="${escapeHtml(activeUsage.usageId)}">完成验收</button>
              <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="close-usage-cycle" data-usage-id="${escapeHtml(activeUsage.usageId)}">关闭使用周期</button>
              <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="clear-return-draft">重置回货草稿</button>
            </div>
          `
          : '<div class="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">请先选择一个待回仓使用周期</div>'}
      </article>
      <article class="space-y-3 rounded-lg border bg-card p-3">
        <div>
          <h2 class="text-sm font-semibold text-foreground">袋况与异常处理</h2>
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
      </div>
      ${!cycles.length
        ? '<div class="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">当前尚无复用周期台账。</div>'
        : renderStickyTableScroller(`
            <table class="min-w-full text-sm">
              <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th class="px-4 py-3 text-left">周转口袋码</th>
                  <th class="px-4 py-3 text-right">总使用次数</th>
                  <th class="px-4 py-3 text-right">总发出次数</th>
                  <th class="px-4 py-3 text-right">总回仓次数</th>
                  <th class="px-4 py-3 text-left">最近发出</th>
                  <th class="px-4 py-3 text-left">最近回仓</th>
                  <th class="px-4 py-3 text-left">当前状态</th>
                  <th class="px-4 py-3 text-left">当前位置</th>
                  <th class="px-4 py-3 text-left">最新使用周期号</th>
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
    return '<div class="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">暂无袋况记录</div>'
  }

  return renderStickyTableScroller(`
    <table class="min-w-full text-sm">
      <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
        <tr>
          <th class="px-4 py-3 text-left">周转口袋码</th>
          <th class="px-4 py-3 text-left">最新使用周期号</th>
          <th class="px-4 py-3 text-left">袋况</th>
          <th class="px-4 py-3 text-left">洁净情况</th>
          <th class="px-4 py-3 text-left">损坏说明</th>
          <th class="px-4 py-3 text-left">复用建议</th>
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
                <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(item.损坏说明 || '无')}</td>
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
        : '<div class="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">暂无回货审计记录</div>'}
    </section>
  `
}

function renderBindingSection(): string {
  const bindings = getFilteredBindings()
  return `
    <section class="space-y-3 rounded-lg border bg-card p-3">
        <div>
          <h2 class="text-sm font-semibold text-foreground">父子码映射明细</h2>
        </div>
      ${renderStickyFilterShell(`
        <label class="space-y-2">
          <span class="text-sm font-medium text-foreground">关键词</span>
          <input
            type="text"
            value="${escapeHtml(state.bindingKeyword)}"
            placeholder="支持周转口袋码 / 菲票码 / 原始裁片单号 / 批次号"
            class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            data-transfer-bags-binding-field="keyword"
          />
        </label>
      `)}
      ${!bindings.length
        ? '<div class="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">暂无父子码映射</div>'
        : renderStickyTableScroller(`
            <table class="min-w-full text-sm">
              <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th class="px-4 py-3 text-left">周转口袋码</th>
                  <th class="px-4 py-3 text-left">使用周期号</th>
                  <th class="px-4 py-3 text-left">菲票码</th>
                  <th class="px-4 py-3 text-left">原始裁片单号</th>
                  <th class="px-4 py-3 text-left">生产单号</th>
                  <th class="px-4 py-3 text-left">批次号</th>
                  <th class="px-4 py-3 text-left">绑定时间</th>
                  <th class="px-4 py-3 text-left">绑定人</th>
                  <th class="px-4 py-3 text-left">备注</th>
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
                        <td class="px-4 py-3">${escapeHtml(item.mergeBatchNo || item.裁剪批次No || '无')}</td>
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

function renderListPage(): string {
  syncPrefilterFromQuery()
  if (isTransferBagDetailPage()) return renderDetailPage()
  const meta = getCanonicalCuttingMeta(getCurrentTransferBagPathname(), 'transfer-bags')
  return `
    <div class="space-y-3 p-4">
      ${renderCuttingPageHeader(meta)}
      ${renderDemoFixturePanel()}
      ${renderStatsCards()}
      ${renderPrefilterBar()}
      ${renderLandingBanner()}
      ${renderFeedbackBar()}
      ${renderMasterSection()}
    </div>
  `
}

function renderDetailEmptyState(): string {
  return `
    <section class="rounded-lg border border-dashed bg-card px-6 py-12 text-center text-sm text-muted-foreground">
      未找到对应周转口袋，请返回列表重新选择。
    </section>
  `
}

function renderTransferBagDetailHeader(
  activeMaster: TransferBagMasterItem,
  focusedUsage: TransferBagUsageItem | null,
): string {
  const qrValue = resolveFormalBagQrValue(activeMaster)
  const summary = focusedUsage ? buildTransferBagParentChildSummary(focusedUsage.bindingItems || []) : null
  const statusMeta = focusedUsage?.statusMeta || activeMaster.pocketStatusMeta
  const summaryItems = [
    {
      label: '周转口袋码',
      valueHtml: `<span class="text-sm font-semibold text-foreground">${escapeHtml(activeMaster.bagCode)}</span>`,
    },
    {
      label: '当前状态',
      valueHtml: renderTag(statusMeta.label, statusMeta.className),
    },
    {
      label: '本次周转号',
      valueHtml: `<span class="text-sm font-semibold text-foreground">${escapeHtml(focusedUsage?.usageNo || '尚未开始')}</span>`,
    },
    {
      label: '当前车缝任务',
      valueHtml: `<span class="text-sm font-semibold text-foreground">${escapeHtml(focusedUsage?.sewingTaskNo || '待绑定')}</span>`,
    },
    {
      label: '当前装袋数量 / 容量',
      valueHtml: `<span class="text-sm font-semibold text-foreground">${escapeHtml(`${summary?.ticketCount || 0} 张 / ${activeMaster.capacity} 张`)}</span>`,
    },
  ]

  return `
    <section data-transfer-bag-summary-strip class="rounded-xl border bg-card px-4 py-3">
      <div class="flex flex-wrap items-center gap-x-6 gap-y-3 xl:flex-nowrap">
        ${summaryItems
          .map(
            (item) => `
              <div class="min-w-[128px]">
                <div class="text-[11px] text-muted-foreground">${escapeHtml(item.label)}</div>
                <div class="mt-1">${item.valueHtml}</div>
              </div>
            `,
          )
          .join('')}
        <div data-transfer-bag-summary-qr class="flex items-center gap-3 xl:ml-auto">
          ${
            qrValue
              ? `
                <div class="inline-flex shrink-0 rounded-lg border bg-white p-2">
                  ${renderRealQrPlaceholder({
                    value: qrValue,
                    size: 72,
                    title: `周转口袋码 ${activeMaster.bagCode}`,
                    label: `周转口袋二维码 ${activeMaster.bagCode}`,
                  })}
                </div>
              `
              : '<div class="inline-flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-lg border border-dashed text-[11px] text-muted-foreground">暂无二维码</div>'
          }
          <div class="min-w-0">
            <div class="text-[11px] text-muted-foreground">周转口袋二维码</div>
            <div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(activeMaster.bagCode)}</div>
          </div>
        </div>
      </div>
    </section>
  `
}

function renderTransferBagDetailTabs(
  activeMaster: TransferBagMasterItem,
  focusedUsage: TransferBagUsageItem | null,
  activeTab: TransferBagDetailTab,
): string {
  const tabs: Array<{ key: TransferBagDetailTab; label: string }> = [
    { key: 'current', label: '本次装袋情况' },
    { key: 'history', label: '过往周转记录' },
    { key: 'recovery', label: '周转口袋回收' },
    { key: 'logs', label: '操作日志' },
  ]

  return `
    <nav class="rounded-xl border bg-card p-2" aria-label="周转口袋详情页签">
      <div class="flex flex-wrap gap-2" role="tablist" aria-label="周转口袋详情页签">
        ${tabs
          .map((tab) => {
            const selected = tab.key === activeTab
            return `
              <button
                type="button"
                id="transfer-bag-tab-${tab.key}"
                role="tab"
                aria-selected="${selected ? 'true' : 'false'}"
                aria-controls="transfer-bag-tabpanel-${tab.key}"
                class="rounded-lg px-3 py-2 text-sm font-medium ${selected ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted'}"
                data-nav="${escapeHtml(buildTransferBagDetailRoute({
                  bagId: activeMaster.bagId,
                  bagCode: activeMaster.bagCode,
                  usageId: focusedUsage?.usageId || undefined,
                  usageNo: focusedUsage?.usageNo || undefined,
                  detailTab: tab.key,
                }))}"
              >${escapeHtml(tab.label)}</button>
            `
          })
          .join('')}
      </div>
    </nav>
  `
}

const transferBagBaggingStepMeta: Array<{ id: TransferBagBaggingStepId; index: number; label: string }> = [
  { id: 'task', index: 1, label: '绑定任务' },
  { id: 'binding', index: 2, label: '装袋绑定' },
  { id: 'review', index: 3, label: '核对并完成装袋' },
  { id: 'dispatch', index: 4, label: '发出' },
  { id: 'signoff', index: 5, label: '签收' },
]

function getBaggingActiveStepId(
  focusedUsage: TransferBagUsageItem | null,
  currentSummary: ReturnType<typeof buildTransferBagParentChildSummary> | null,
): TransferBagBaggingStepId | null {
  if (!focusedUsage) return 'task'
  if (['WAITING_RETURN', 'RETURN_INSPECTING', 'CLOSED', 'EXCEPTION_CLOSED'].includes(focusedUsage.usageStatus)) return null
  if (['DISPATCHED', 'PENDING_SIGNOFF'].includes(focusedUsage.usageStatus)) return 'signoff'
  if (focusedUsage.usageStatus === 'READY_TO_DISPATCH') return 'dispatch'
  if ((currentSummary?.ticketCount || 0) > 0) return 'review'
  return 'binding'
}

function getBaggingStepState(
  stepId: TransferBagBaggingStepId,
  activeStepId: TransferBagBaggingStepId | null,
  focusedUsage: TransferBagUsageItem | null,
): TransferBagBaggingStepState {
  if (!focusedUsage) return stepId === 'task' ? 'active' : 'locked'
  if (!activeStepId) return 'done'

  const stepIndex = transferBagBaggingStepMeta.find((item) => item.id === stepId)?.index || 0
  const activeIndex = transferBagBaggingStepMeta.find((item) => item.id === activeStepId)?.index || 0
  if (stepIndex < activeIndex) return 'done'
  if (stepIndex === activeIndex) return 'active'
  return 'pending'
}

function buildBaggingStepSummary(
  stepId: TransferBagBaggingStepId,
  activeMaster: TransferBagMasterItem,
  focusedUsage: TransferBagUsageItem | null,
  currentSummary: ReturnType<typeof buildTransferBagParentChildSummary> | null,
  capacityExceeded: boolean,
): string {
  if (stepId === 'task') {
    if (!focusedUsage) return `先确认 ${activeMaster.bagCode} 本次对应的车缝任务`
    return `已绑定 ${focusedUsage.sewingTaskNo} / ${focusedUsage.sewingFactoryName}`
  }

  if (stepId === 'binding') {
    if (!focusedUsage) return '请先完成步骤 1，开始本次周转'
    return `已绑 ${currentSummary?.ticketCount || 0} 张菲票 / ${currentSummary?.quantityTotal || 0} 件`
  }

  if (stepId === 'review') {
    if (!focusedUsage) return '开始本次周转后再核对袋内内容'
    if (!currentSummary?.ticketCount) return '当前还没有菲票，请先装袋绑定'
    return capacityExceeded ? '当前容量已超出，请先核对后再完成装袋' : '袋内内容待核对，可打印清单后完成装袋'
  }

  if (stepId === 'dispatch') {
    if (!focusedUsage) return '完成装袋后才可发出'
    return focusedUsage.dispatchAt ? `已于 ${focusedUsage.dispatchAt} 发出` : '装袋完成后可发出'
  }

  if (!focusedUsage) return '发出后才可签收'
  return focusedUsage.signedAt ? `已于 ${focusedUsage.signedAt} 签收` : '发出后待签收'
}

function buildBaggingStepHelperText(step: TransferBagBaggingStepView): string {
  if (step.id === 'task') return '先确认本次周转对应的车缝任务'
  if (step.id === 'binding') return step.state === 'locked' ? '请先完成步骤 1，开始本次周转' : '扫菲票加入本袋，候选菲票也可以直接导入'
  if (step.id === 'review') return step.state === 'locked' ? '请先完成装袋绑定，再核对袋内内容' : '核对袋内内容，确认后完成装袋'
  if (step.id === 'dispatch') return step.state === 'locked' ? '完成装袋后才能发出' : '核对无误后发出本次周转口袋'
  return step.state === 'locked' ? '发出后才能签收' : '由对应接收方确认已收到'
}

function getBaggingStepViews(
  activeMaster: TransferBagMasterItem,
  focusedUsage: TransferBagUsageItem | null,
  currentSummary: ReturnType<typeof buildTransferBagParentChildSummary> | null,
  capacityExceeded: boolean,
): TransferBagBaggingStepView[] {
  const activeStepId = getBaggingActiveStepId(focusedUsage, currentSummary)
  return transferBagBaggingStepMeta.map((meta) => {
    const state = getBaggingStepState(meta.id, activeStepId, focusedUsage)
    return {
      ...meta,
      state,
      summary: buildBaggingStepSummary(meta.id, activeMaster, focusedUsage, currentSummary, capacityExceeded),
      helperText: '',
      open: state === 'active',
    }
  }).map((item) => ({
    ...item,
    helperText: buildBaggingStepHelperText(item),
  }))
}

function getBaggingStepTone(stepState: TransferBagBaggingStepState): {
  railClass: string
  badgeClass: string
  cardClass: string
  stateLabel: string
} {
  if (stepState === 'done') {
    return {
      railClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      cardClass: 'border-emerald-200 bg-emerald-50/40',
      stateLabel: '已完成',
    }
  }
  if (stepState === 'active') {
    return {
      railClass: 'border-amber-200 bg-amber-50 text-amber-700',
      badgeClass: 'border-amber-200 bg-amber-50 text-amber-700',
      cardClass: 'border-amber-200 bg-amber-50/30 shadow-sm',
      stateLabel: '进行中',
    }
  }
  if (stepState === 'pending') {
    return {
      railClass: 'border-slate-200 bg-slate-50 text-slate-600',
      badgeClass: 'border-slate-200 bg-slate-50 text-slate-600',
      cardClass: 'border-slate-200 bg-card',
      stateLabel: '未开始',
    }
  }
  return {
    railClass: 'border-dashed border-slate-200 bg-slate-50/70 text-slate-400',
    badgeClass: 'border-dashed border-slate-200 bg-slate-50 text-slate-400',
    cardClass: 'border-dashed border-slate-200 bg-slate-50/70',
    stateLabel: '暂不可操作',
  }
}

function renderBaggingStepRail(steps: TransferBagBaggingStepView[]): string {
  return `
    <section class="rounded-xl border bg-card p-3">
      <div class="flex flex-wrap gap-2" aria-label="本次装袋步骤">
        ${steps
          .map((step) => {
            const tone = getBaggingStepTone(step.state)
            return `
              <div class="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${tone.railClass}">
                <span class="inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold ${tone.badgeClass}">${step.index}</span>
                <span class="font-medium">${escapeHtml(step.label)}</span>
              </div>
            `
          })
          .join('')}
      </div>
    </section>
  `
}

function renderCollapsedBaggingStepSummary(step: TransferBagBaggingStepView): string {
  const tone = getBaggingStepTone(step.state)
  return `
    <summary class="cursor-pointer list-none px-4 py-3 [&::-webkit-details-marker]:hidden">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex min-w-0 items-start gap-3">
          <span class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${tone.badgeClass}">${step.index}</span>
          <div class="min-w-0">
            <div class="text-sm font-semibold text-foreground">${escapeHtml(step.label)}</div>
            <div class="mt-1 text-sm text-muted-foreground">${escapeHtml(step.summary)}</div>
          </div>
        </div>
        <span class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${tone.badgeClass}">${tone.stateLabel}</span>
      </div>
    </summary>
  `
}

function renderBaggingStepCard(step: TransferBagBaggingStepView, body: string): string {
  const tone = getBaggingStepTone(step.state)
  return `
    <details data-bagging-step="${step.id}" data-step-state="${step.state}" class="rounded-xl border ${tone.cardClass}" ${step.open ? 'open' : ''}>
      ${renderCollapsedBaggingStepSummary(step)}
      <div class="border-t px-4 py-4">
        <p class="mb-3 text-sm text-muted-foreground">${escapeHtml(step.helperText)}</p>
        ${body}
      </div>
    </details>
  `
}

function renderBaggingTaskStepCard(step: TransferBagBaggingStepView, focusedUsage: TransferBagUsageItem | null): string {
  const editable = step.state === 'active'
  return renderBaggingStepCard(
    step,
    focusedUsage && !editable
      ? `
        <div class="grid gap-3 md:grid-cols-2 text-sm">
          <div><span class="text-muted-foreground">当前车缝任务：</span><span class="font-medium text-foreground">${escapeHtml(focusedUsage.sewingTaskNo)}</span></div>
          <div><span class="text-muted-foreground">车缝工厂：</span><span class="font-medium text-foreground">${escapeHtml(focusedUsage.sewingFactoryName)}</span></div>
          <div><span class="text-muted-foreground">当前款号：</span><span class="font-medium text-foreground">${escapeHtml(focusedUsage.styleCode || '待锁定')}</span></div>
          <div><span class="text-muted-foreground">备注：</span><span class="font-medium text-foreground">${escapeHtml(focusedUsage.note || '无')}</span></div>
        </div>
      `
      : `
        <div class="space-y-3">
          <div class="grid gap-3 md:grid-cols-2">
            <label class="space-y-2">
              <span class="text-sm font-medium text-foreground">绑定任务</span>
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
                placeholder="可选填写本次说明"
                class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                data-transfer-bags-workbench-field="note"
              />
            </label>
          </div>
          <div class="flex flex-wrap gap-2">
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="create-usage">开始本次周转</button>
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="clear-draft">清空输入</button>
          </div>
        </div>
      `,
  )
}

function renderBaggingBindingStepCard(
  step: TransferBagBaggingStepView,
  focusedUsage: TransferBagUsageItem | null,
  currentSummary: ReturnType<typeof buildTransferBagParentChildSummary>,
  candidateTickets: TransferBagTicketCandidate[],
  capacityExceeded: boolean,
): string {
  const canEditBindings = Boolean(
    focusedUsage &&
      !['DISPATCHED', 'PENDING_SIGNOFF', 'WAITING_RETURN', 'RETURN_INSPECTING', 'CLOSED', 'EXCEPTION_CLOSED'].includes(focusedUsage.usageStatus),
  )

  return renderBaggingStepCard(
    step,
    !focusedUsage
      ? '<div class="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">请先完成步骤 1，开始本次周转。</div>'
      : `
        <div class="space-y-3">
          <div class="grid gap-3 md:grid-cols-[1fr,auto]">
            <label class="space-y-2">
              <span class="text-sm font-medium text-foreground">扫菲票加入本袋</span>
              <input
                type="text"
                value="${escapeHtml(state.draft.ticketInput)}"
                placeholder="输入或扫描菲票码"
                class="h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                data-transfer-bags-workbench-field="ticketInput"
                ${canEditBindings ? '' : 'disabled'}
              />
            </label>
            <button type="button" class="rounded-md border px-4 py-2 text-sm hover:bg-muted md:self-end" data-transfer-bags-action="bind-ticket" ${canEditBindings ? '' : 'disabled'}>加入本袋</button>
          </div>
          <div class="grid gap-3 md:grid-cols-3">
            ${renderDetailMetric('已绑菲票数', String(currentSummary.ticketCount))}
            ${renderDetailMetric('当前总件数', String(currentSummary.quantityTotal))}
            ${renderDetailMetric('容量状态', capacityExceeded ? '已超容量' : '容量正常', capacityExceeded ? 'text-amber-700' : 'text-foreground')}
          </div>
          ${
            candidateTickets.length
              ? `
                <div class="space-y-2 rounded-lg border bg-muted/15 p-3">
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <div class="text-sm font-medium text-foreground">候选菲票</div>
                    <button type="button" class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-transfer-bags-action="import-prefill" ${canEditBindings ? '' : 'disabled'}>导入候选菲票（${candidateTickets.length}）</button>
                  </div>
                  <div class="flex flex-wrap gap-2">
                    ${candidateTickets
                      .map((item) =>
                        renderWorkbenchFilterChip(
                          `${item.ticketNo} / ${item.originalCutOrderNo}`,
                          `data-transfer-bags-action="set-ticket-input" data-ticket-no="${escapeHtml(item.ticketNo)}"`,
                          'blue',
                        ),
                      )
                      .join('')}
                  </div>
                </div>
              `
              : ''
          }
          ${capacityExceeded ? '<div class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">当前装袋数量已超容量，请先核对袋内内容再继续操作。</div>' : ''}
          ${canEditBindings ? '' : '<div class="rounded-lg border border-dashed px-4 py-5 text-sm text-muted-foreground">当前状态下不可继续装袋绑定，可在步骤 3 核对结果。</div>'}
        </div>
      `,
  )
}

function renderBaggingReviewStepCard(
  step: TransferBagBaggingStepView,
  focusedUsage: TransferBagUsageItem | null,
  currentBindings: TransferBagBindingItem[],
  currentSummary: ReturnType<typeof buildTransferBagParentChildSummary>,
  capacityExceeded: boolean,
): string {
  return renderBaggingStepCard(
    step,
    !focusedUsage
      ? '<div class="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">请先开始本次周转，再核对袋内内容。</div>'
      : `
        <div class="space-y-3">
          <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            ${renderDetailMetric('已绑菲票数', String(currentSummary.ticketCount))}
            ${renderDetailMetric('当前总件数', String(currentSummary.quantityTotal))}
            ${renderDetailMetric('来源原始裁片单数', String(currentSummary.originalCutOrderCount))}
            ${renderDetailMetric('来源生产单数', String(currentSummary.productionOrderCount))}
            ${renderDetailMetric('当前款号', focusedUsage.styleCode || '待锁定')}
            ${renderDetailMetric('容量状态', capacityExceeded ? '已超容量' : '容量正常', capacityExceeded ? 'text-amber-700' : 'text-foreground')}
          </div>
          ${
            currentBindings.length
              ? renderStickyTableScroller(
                  `
                    <table class="min-w-full text-sm">
                      <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th class="px-3 py-2 text-left">菲票码</th>
                          <th class="px-3 py-2 text-left">款号</th>
                          <th class="px-3 py-2 text-left">面料 SKU</th>
                          <th class="px-3 py-2 text-left">部位</th>
                          <th class="px-3 py-2 text-right">数量</th>
                          <th class="px-3 py-2 text-left">原始裁片单</th>
                          <th class="px-3 py-2 text-left">状态</th>
                          <th class="px-3 py-2 text-left">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${currentBindings
                          .map(
                            (binding) => `
                              <tr class="border-b bg-card">
                                <td class="px-3 py-2 font-medium text-foreground">${escapeHtml(binding.ticketNo)}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.ticket?.styleCode || focusedUsage.styleCode || '待补')}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.ticket?.materialSku || '待补')}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.ticket?.partName || '待补')}</td>
                                <td class="px-3 py-2 text-right tabular-nums">${escapeHtml(String(binding.qty))}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.originalCutOrderNo || '—')}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.ticket?.ticketStatus === 'VOIDED' ? '已作废' : '有效')}</td>
                                <td class="px-3 py-2">
                                  ${
                                    binding.removable
                                      ? `<button type="button" class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted" data-transfer-bags-action="remove-binding" data-binding-id="${escapeHtml(binding.bindingId)}">移除</button>`
                                      : '<span class="text-xs text-muted-foreground">不可移除</span>'
                                  }
                                </td>
                              </tr>
                            `,
                          )
                          .join('')}
                      </tbody>
                    </table>
                  `,
                  'max-h-[24vh]',
                )
              : '<div class="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">当前还没有菲票，请先完成步骤 2 的装袋绑定。</div>'
          }
          <div class="flex flex-wrap gap-2">
            ${currentBindings.length ? `<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="print-manifest" data-usage-id="${escapeHtml(focusedUsage.usageId)}">打印装袋清单</button>` : ''}
            ${currentBindings.length && ['DRAFT', 'PACKING'].includes(focusedUsage.usageStatus) ? `<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="mark-ready" data-usage-id="${escapeHtml(focusedUsage.usageId)}">完成装袋</button>` : ''}
          </div>
          ${currentBindings.length
            ? ''
            : '<div class="text-sm text-muted-foreground">当前还没有装入菲票，暂不能完成装袋。</div>'}
          ${(focusedUsage.productionOrderNos.length || focusedUsage.originalCutOrderNos.length || focusedUsage.mergeBatchNos.length)
            ? `
              <details class="rounded-lg border bg-muted/10 p-3">
                <summary class="cursor-pointer text-sm font-medium text-foreground">更多来源信息</summary>
                <div class="mt-3 grid gap-3 md:grid-cols-3 text-sm">
                  <div><span class="text-muted-foreground">来源生产单：</span><span class="font-medium text-foreground">${escapeHtml(focusedUsage.productionOrderNos.join(' / ') || '暂无')}</span></div>
                  <div><span class="text-muted-foreground">来源原始裁片单：</span><span class="font-medium text-foreground">${escapeHtml(focusedUsage.originalCutOrderNos.join(' / ') || '暂无')}</span></div>
                  <div><span class="text-muted-foreground">来源裁剪批次：</span><span class="font-medium text-foreground">${escapeHtml(focusedUsage.mergeBatchNos.join(' / ') || '暂无')}</span></div>
                </div>
              </details>
            `
            : ''}
        </div>
      `,
  )
}

function renderBaggingDispatchStepCard(
  step: TransferBagBaggingStepView,
  focusedUsage: TransferBagUsageItem | null,
  currentSummary: ReturnType<typeof buildTransferBagParentChildSummary>,
): string {
  return renderBaggingStepCard(
    step,
    !focusedUsage
      ? '<div class="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">完成装袋后，才会进入发出步骤。</div>'
      : `
        <div class="space-y-3">
          <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            ${renderDetailMetric('本次周转号', focusedUsage.usageNo)}
            ${renderDetailMetric('周转口袋码', focusedUsage.bagCode)}
            ${renderDetailMetric('当前车缝任务', focusedUsage.sewingTaskNo)}
            ${renderDetailMetric('已绑菲票数 / 总件数', `${currentSummary.ticketCount} / ${currentSummary.quantityTotal}`)}
            ${renderDetailMetric('当前状态', focusedUsage.statusMeta.label)}
          </div>
          <div class="flex flex-wrap gap-2">
            ${focusedUsage.usageStatus === 'READY_TO_DISPATCH' ? `<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="mark-dispatched" data-usage-id="${escapeHtml(focusedUsage.usageId)}">发出</button>` : ''}
          </div>
          ${focusedUsage.usageStatus === 'READY_TO_DISPATCH' ? '<div class="text-sm text-muted-foreground">核对无误后发出即可。</div>' : '<div class="text-sm text-muted-foreground">当前步骤仅保留发出结果摘要。</div>'}
        </div>
      `,
  )
}

function renderBaggingSignoffStepCard(step: TransferBagBaggingStepView, focusedUsage: TransferBagUsageItem | null): string {
  return renderBaggingStepCard(
    step,
    !focusedUsage
      ? '<div class="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">发出后，才会进入签收步骤。</div>'
      : `
        <div class="space-y-3">
          <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            ${renderDetailMetric('本次周转号', focusedUsage.usageNo)}
            ${renderDetailMetric('周转口袋码', focusedUsage.bagCode)}
            ${renderDetailMetric('发出时间', focusedUsage.dispatchAt || '待发出')}
            ${renderDetailMetric('当前状态', focusedUsage.statusMeta.label)}
          </div>
          <div class="flex flex-wrap gap-2">
            ${['DISPATCHED', 'PENDING_SIGNOFF'].includes(focusedUsage.usageStatus) ? `<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="mark-signed" data-usage-id="${escapeHtml(focusedUsage.usageId)}">签收</button>` : ''}
          </div>
          ${['DISPATCHED', 'PENDING_SIGNOFF'].includes(focusedUsage.usageStatus) ? '<div class="text-sm text-muted-foreground">由对应接收方确认已收到本袋。</div>' : '<div class="text-sm text-muted-foreground">当前步骤仅保留签收结果摘要。</div>'}
        </div>
      `,
  )
}

function renderTransferBagCurrentTab(
  activeMaster: TransferBagMasterItem,
  focusedUsage: TransferBagUsageItem | null,
): string {
  const currentBindings = focusedUsage ? getViewModel().bindingsByUsageId[focusedUsage.usageId] || [] : []
  const currentSummary = buildTransferBagParentChildSummary(currentBindings)
  const candidateTickets = focusedUsage ? getCandidateTickets() : []
  const capacityExceeded = currentSummary.ticketCount > activeMaster.capacity
  const steps = getBaggingStepViews(activeMaster, focusedUsage, currentSummary, capacityExceeded)
  const finishedFlow = Boolean(focusedUsage && ['WAITING_RETURN', 'RETURN_INSPECTING', 'CLOSED', 'EXCEPTION_CLOSED'].includes(focusedUsage.usageStatus))

  return `
    <section id="transfer-bag-tabpanel-current" role="tabpanel" aria-labelledby="transfer-bag-tab-current" class="space-y-3">
      ${renderBaggingStepRail(steps)}
      ${
        finishedFlow && focusedUsage
          ? `
            <article class="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
              <div class="text-sm font-semibold text-foreground">本次装袋已完成</div>
              <p class="mt-1 text-sm text-muted-foreground">当前状态为：${escapeHtml(focusedUsage.statusMeta.label)}。装袋、发出、签收已完成，请到周转口袋回收页签处理后续回收。</p>
              <div class="mt-3 flex flex-wrap gap-2">
                <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="${escapeHtml(buildTransferBagDetailRoute({
                  bagId: activeMaster.bagId,
                  bagCode: activeMaster.bagCode,
                  usageId: focusedUsage.usageId,
                  usageNo: focusedUsage.usageNo,
                  detailTab: 'recovery',
                }))}">去周转口袋回收</button>
              </div>
            </article>
          `
          : ''
      }
      ${renderBaggingTaskStepCard(steps[0], focusedUsage)}
      ${renderBaggingBindingStepCard(steps[1], focusedUsage, currentSummary, candidateTickets, capacityExceeded)}
      ${renderBaggingReviewStepCard(steps[2], focusedUsage, currentBindings, currentSummary, capacityExceeded)}
      ${renderBaggingDispatchStepCard(steps[3], focusedUsage, currentSummary)}
      ${renderBaggingSignoffStepCard(steps[4], focusedUsage)}
    </section>
  `
}

function renderTransferBagHistoryTab(
  activeMaster: TransferBagMasterItem,
  focusedUsage: TransferBagUsageItem | null,
): string {
  const usages = getDetailBagUsages(activeMaster)
  const selectedUsage = focusedUsage && focusedUsage.bagId === activeMaster.bagId ? focusedUsage : usages[0] || null

  return `
    <section id="transfer-bag-tabpanel-history" role="tabpanel" aria-labelledby="transfer-bag-tab-history" class="space-y-3 rounded-xl border bg-card p-4">
      <div>
        <h2 class="text-sm font-semibold text-foreground">过往周转记录</h2>
      </div>
      ${!usages.length
        ? '<div class="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">当前口袋还没有过往周转记录。</div>'
        : `
          ${renderStickyTableScroller(
            `
              <table class="min-w-full text-sm">
                <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th class="px-3 py-2 text-left">本次周转号</th>
                    <th class="px-3 py-2 text-left">状态</th>
                    <th class="px-3 py-2 text-left">开始时间</th>
                    <th class="px-3 py-2 text-left">车缝任务</th>
                    <th class="px-3 py-2 text-left">车缝工厂</th>
                    <th class="px-3 py-2 text-right">菲票数</th>
                    <th class="px-3 py-2 text-left">发出 / 签收 / 回收</th>
                  </tr>
                </thead>
                <tbody>
                  ${usages
                    .map(
                      (item) => `
                        <tr class="border-b ${selectedUsage?.usageId === item.usageId ? 'bg-orange-50/60' : 'bg-card'}">
                          <td class="px-3 py-2">
                            <button
                              type="button"
                              class="font-medium text-blue-700 hover:underline"
                              data-nav="${escapeHtml(buildTransferBagDetailRoute({
                                bagId: item.bagId,
                                bagCode: item.bagCode,
                                usageId: item.usageId,
                                usageNo: item.usageNo,
                                detailTab: 'history',
                              }))}"
                            >${escapeHtml(item.usageNo)}</button>
                          </td>
                          <td class="px-3 py-2">${renderTag(item.statusMeta.label, item.statusMeta.className)}</td>
                          <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(item.startedAt || '待补')}</td>
                          <td class="px-3 py-2">${escapeHtml(item.sewingTaskNo)}</td>
                          <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(item.sewingFactoryName || '待补')}</td>
                          <td class="px-3 py-2 text-right tabular-nums">${escapeHtml(String(item.summary.ticketCount))}</td>
                          <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml([item.dispatchAt || '待发出', item.signedAt || '待签收', item.returnedAt || '待回收'].join(' / '))}</td>
                        </tr>
                      `,
                    )
                    .join('')}
                </tbody>
              </table>
            `,
            'max-h-[26vh]',
          )}
          ${
            selectedUsage
              ? `
                <div class="rounded-xl border bg-muted/15 p-4">
                  <div class="text-sm font-semibold text-foreground">轻量摘要</div>
                  <div class="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4 text-sm">
                    <div><span class="text-muted-foreground">本次周转号：</span><span class="font-medium text-foreground">${escapeHtml(selectedUsage.usageNo)}</span></div>
                    <div><span class="text-muted-foreground">开始时间：</span><span class="font-medium text-foreground">${escapeHtml(selectedUsage.startedAt || '待补')}</span></div>
                    <div><span class="text-muted-foreground">车缝任务：</span><span class="font-medium text-foreground">${escapeHtml(selectedUsage.sewingTaskNo)}</span></div>
                    <div><span class="text-muted-foreground">车缝工厂：</span><span class="font-medium text-foreground">${escapeHtml(selectedUsage.sewingFactoryName || '待补')}</span></div>
                    <div><span class="text-muted-foreground">菲票数：</span><span class="font-medium text-foreground">${escapeHtml(String(selectedUsage.summary.ticketCount))}</span></div>
                    <div><span class="text-muted-foreground">发出时间：</span><span class="font-medium text-foreground">${escapeHtml(selectedUsage.dispatchAt || '待发出')}</span></div>
                    <div><span class="text-muted-foreground">签收时间：</span><span class="font-medium text-foreground">${escapeHtml(selectedUsage.signedAt || '待签收')}</span></div>
                    <div><span class="text-muted-foreground">回收时间：</span><span class="font-medium text-foreground">${escapeHtml(selectedUsage.returnedAt || '待回收')}</span></div>
                  </div>
                </div>
              `
              : ''
          }
        `}
    </section>
  `
}

function renderTransferBagRecoveryTab(
  activeMaster: TransferBagMasterItem,
  focusedUsage: TransferBagUsageItem | null,
): string {
  const recoveryEntries = getDetailBagRecoveryEntries(activeMaster)
  const selectedRecoveryEntry =
    recoveryEntries.find((item) => item.usage.usageId === focusedUsage?.usageId) ||
    recoveryEntries[0] ||
    null
  const selectedUsage = focusedUsage || selectedRecoveryEntry?.usage || null

  if (!selectedUsage && !recoveryEntries.length) {
    return `
      <section id="transfer-bag-tabpanel-recovery" role="tabpanel" aria-labelledby="transfer-bag-tab-recovery" class="space-y-3 rounded-xl border bg-card p-4">
        <div class="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">当前还没有可回收的周转记录。</div>
      </section>
    `
  }

  const returnUsage = selectedUsage ? getDetailReturnUsage(selectedUsage.usageId) : null
  const latestReceipt = returnUsage?.latestReturnReceipt || null
  const latestCondition = returnUsage?.latestConditionRecord || null
  const latestClosure = returnUsage?.latestClosureResult || null
  const canShowForm = Boolean(
    selectedUsage &&
      returnUsage &&
      (returnUsage.returnEligibility.ok ||
        latestReceipt ||
        latestCondition ||
        latestClosure ||
        ['WAITING_RETURN', 'RETURN_INSPECTING', 'CLOSED', 'EXCEPTION_CLOSED'].includes(selectedUsage.usageStatus)),
  )

  return `
    <section id="transfer-bag-tabpanel-recovery" role="tabpanel" aria-labelledby="transfer-bag-tab-recovery" class="space-y-3 rounded-xl border bg-card p-4">
      <div>
        <h2 class="text-sm font-semibold text-foreground">周转口袋回收</h2>
      </div>
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        ${renderDetailMetric('本次周转号', selectedUsage?.usageNo || activeMaster.latestUsageNo || '尚未开始')}
        ${renderDetailMetric('周转口袋码', activeMaster.bagCode)}
        <div class="rounded-lg border bg-muted/10 px-3 py-2">
          <div class="text-xs text-muted-foreground">当前状态</div>
          <div class="mt-1">${renderTag((selectedUsage || focusedUsage)?.statusMeta.label || activeMaster.pocketStatusMeta.label, (selectedUsage || focusedUsage)?.statusMeta.className || activeMaster.pocketStatusMeta.className)}</div>
        </div>
        ${renderDetailMetric('是否可进入回收流程', returnUsage?.returnEligibility.ok ? '可以' : returnUsage?.returnEligibility.reason || '暂不可进入')}
      </div>
      ${
        !canShowForm
          ? `<div class="rounded-lg border border-dashed px-6 py-8 text-sm text-muted-foreground">当前尚未进入回收阶段，当前状态为：${escapeHtml((selectedUsage || focusedUsage)?.statusMeta.label || activeMaster.pocketStatusMeta.label)}。下面保留最近历史回收记录，便于查看上次回收结果。</div>`
          : `
            <div class="grid gap-3 xl:grid-cols-[1.05fr,0.95fr]">
              <article class="space-y-3 rounded-xl border bg-muted/15 p-4">
                <div>
                  <h3 class="text-sm font-semibold text-foreground">回收表单</h3>
                </div>
                <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <label class="space-y-2">
                    <span class="text-sm font-medium text-foreground">回收仓 / 回收点</span>
                    <input type="text" value="${escapeHtml(state.returnDraft.returnWarehouseName)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-return-draft-field="returnWarehouseName" />
                  </label>
                  <label class="space-y-2">
                    <span class="text-sm font-medium text-foreground">回收时间</span>
                    <input type="text" value="${escapeHtml(state.returnDraft.returnAt)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-return-draft-field="returnAt" />
                  </label>
                  <label class="space-y-2">
                    <span class="text-sm font-medium text-foreground">交回人</span>
                    <input type="text" value="${escapeHtml(state.returnDraft.returnedBy)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-return-draft-field="returnedBy" />
                  </label>
                  <label class="space-y-2">
                    <span class="text-sm font-medium text-foreground">接收人</span>
                    <input type="text" value="${escapeHtml(state.returnDraft.receivedBy)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-return-draft-field="receivedBy" />
                  </label>
                  <label class="space-y-2">
                    <span class="text-sm font-medium text-foreground">回收菲票数量</span>
                    <input type="number" value="${escapeHtml(state.returnDraft.returnedTicketCountSummary)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-return-draft-field="returnedTicketCountSummary" />
                  </label>
                  <label class="space-y-2">
                    <span class="text-sm font-medium text-foreground">回收成品 / 件数摘要</span>
                    <input type="number" value="${escapeHtml(state.returnDraft.returnedFinishedQty)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-return-draft-field="returnedFinishedQty" />
                  </label>
                  <label class="space-y-2">
                    <span class="text-sm font-medium text-foreground">袋况</span>
                    <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-condition-field="conditionStatus">
                      <option value="GOOD" ${state.conditionDraft.conditionStatus === 'GOOD' ? 'selected' : ''}>完好</option>
                      <option value="MINOR_DAMAGE" ${state.conditionDraft.conditionStatus === 'MINOR_DAMAGE' ? 'selected' : ''}>轻微损坏</option>
                      <option value="SEVERE_DAMAGE" ${state.conditionDraft.conditionStatus === 'SEVERE_DAMAGE' ? 'selected' : ''}>严重损坏</option>
                    </select>
                  </label>
                  <label class="space-y-2">
                    <span class="text-sm font-medium text-foreground">清洁情况</span>
                    <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-condition-field="cleanlinessStatus">
                      <option value="CLEAN" ${state.conditionDraft.cleanlinessStatus === 'CLEAN' ? 'selected' : ''}>干净</option>
                      <option value="DIRTY" ${state.conditionDraft.cleanlinessStatus === 'DIRTY' ? 'selected' : ''}>待清洁</option>
                    </select>
                  </label>
                  <label class="space-y-2">
                    <span class="text-sm font-medium text-foreground">是否可继续使用</span>
                    <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-condition-field="reusableDecision">
                      <option value="REUSABLE" ${state.conditionDraft.reusableDecision === 'REUSABLE' ? 'selected' : ''}>可以</option>
                      <option value="WAITING_CLEANING" ${state.conditionDraft.reusableDecision === 'WAITING_CLEANING' ? 'selected' : ''}>待清洁后再用</option>
                      <option value="WAITING_REPAIR" ${state.conditionDraft.reusableDecision === 'WAITING_REPAIR' ? 'selected' : ''}>待维修后再用</option>
                      <option value="DISABLED" ${state.conditionDraft.reusableDecision === 'DISABLED' ? 'selected' : ''}>不能继续使用</option>
                    </select>
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
                  <label class="space-y-2 md:col-span-2 xl:col-span-2">
                    <span class="text-sm font-medium text-foreground">差异说明</span>
                    <input type="text" value="${escapeHtml(state.returnDraft.discrepancyNote)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-return-draft-field="discrepancyNote" />
                  </label>
                  <label class="space-y-2 md:col-span-2 xl:col-span-3">
                    <span class="text-sm font-medium text-foreground">备注</span>
                    <input type="text" value="${escapeHtml(state.returnDraft.note)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-return-draft-field="note" />
                  </label>
                </div>
                <div class="flex flex-wrap gap-2">
                  <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="prepare-return" data-usage-id="${escapeHtml(selectedUsage?.usageId || '')}">创建回收草稿</button>
                  <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="complete-return-inspection" data-usage-id="${escapeHtml(selectedUsage?.usageId || '')}">完成回收</button>
                  <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="close-usage-cycle" data-usage-id="${escapeHtml(selectedUsage?.usageId || '')}">关闭本次周转</button>
                  <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="clear-return-draft">重置回收草稿</button>
                </div>
              </article>
              <article class="space-y-3 rounded-xl border bg-muted/15 p-4">
                <div>
                  <h3 class="text-sm font-semibold text-foreground">回收摘要</h3>
                </div>
                <div class="grid gap-3 text-sm">
                  <div><span class="text-muted-foreground">最近回收时间：</span><span class="font-medium text-foreground">${escapeHtml(latestReceipt?.returnAt || '尚未回收')}</span></div>
                  <div><span class="text-muted-foreground">交回 / 接收：</span><span class="font-medium text-foreground">${escapeHtml(latestReceipt ? `${latestReceipt.returnedBy || '待补'} / ${latestReceipt.receivedBy || '待补'}` : '待补')}</span></div>
                  <div><span class="text-muted-foreground">回收菲票数量：</span><span class="font-medium text-foreground">${escapeHtml(latestReceipt ? String(latestReceipt.returnedTicketCountSummary) : '待补')}</span></div>
                  <div><span class="text-muted-foreground">袋况：</span><span class="font-medium text-foreground">${escapeHtml(formatConditionStatusLabel(latestCondition?.conditionStatus))}</span></div>
                  <div><span class="text-muted-foreground">清洁情况：</span><span class="font-medium text-foreground">${escapeHtml(formatCleanlinessStatusLabel(latestCondition?.cleanlinessStatus))}</span></div>
                  <div><span class="text-muted-foreground">是否可继续使用：</span><span class="font-medium text-foreground">${escapeHtml(formatReusableDecisionLabel(latestCondition?.reusableDecision))}</span></div>
                  ${
                    latestClosure
                      ? `<div><span class="text-muted-foreground">关闭结果：</span><span class="font-medium text-foreground">${escapeHtml(latestClosure.reason)}</span></div>`
                      : ''
                  }
                </div>
              </article>
            </div>
          `
      }
      ${
        recoveryEntries.length
          ? `
            <article class="space-y-3 rounded-xl border bg-muted/10 p-4">
              <div>
                <h3 class="text-sm font-semibold text-foreground">最近回收记录</h3>
              </div>
              ${renderStickyTableScroller(
                `
                  <table class="min-w-full text-sm">
                    <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th class="px-3 py-2 text-left">周转号</th>
                        <th class="px-3 py-2 text-left">回收时间</th>
                        <th class="px-3 py-2 text-left">回收点</th>
                        <th class="px-3 py-2 text-left">交回 / 接收</th>
                        <th class="px-3 py-2 text-left">袋况 / 清洁</th>
                        <th class="px-3 py-2 text-left">是否可继续使用</th>
                        <th class="px-3 py-2 text-left">备注</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${recoveryEntries
                        .map(
                          (entry) => `
                            <tr class="border-b ${selectedUsage?.usageId === entry.usage.usageId ? 'bg-orange-50/50' : 'bg-card'}">
                              <td class="px-3 py-2 font-medium text-foreground">${escapeHtml(entry.usage.usageNo)}</td>
                              <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(entry.latestReceipt?.returnAt || entry.latestClosure?.closedAt || '待补')}</td>
                              <td class="px-3 py-2">${escapeHtml(entry.latestReceipt?.returnWarehouseName || '待补')}</td>
                              <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(entry.latestReceipt ? `${entry.latestReceipt.returnedBy || '待补'} / ${entry.latestReceipt.receivedBy || '待补'}` : '待补')}</td>
                              <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(`${formatConditionStatusLabel(entry.latestCondition?.conditionStatus)} / ${formatCleanlinessStatusLabel(entry.latestCondition?.cleanlinessStatus)}`)}</td>
                              <td class="px-3 py-2">${escapeHtml(formatRecoveryEntryNextStepLabel(entry))}</td>
                              <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(entry.latestClosure?.reason || entry.latestReceipt?.note || entry.latestCondition?.note || '无')}</td>
                            </tr>
                          `,
                        )
                        .join('')}
                    </tbody>
                  </table>
                `,
                'max-h-[24vh]',
              )}
            </article>
          `
          : ''
      }
    </section>
  `
}

function renderTransferBagLogsTab(
  activeMaster: TransferBagMasterItem,
  focusedUsage: TransferBagUsageItem | null,
): string {
  const usageIds = getDetailBagUsages(activeMaster).map((item) => item.usageId)
  const usageAudits = usageIds.flatMap((usageId) =>
    (getViewModel().auditTrailByUsageId[usageId] || []).map((audit) => ({
      actionAt: audit.actionAt,
      action: audit.action,
      actor: audit.actionBy,
      note: audit.note,
    })),
  )
  const returnAudits = usageIds.flatMap((usageId) =>
    (getReturnViewModel().returnAuditTrailByUsageId[usageId] || []).map((audit) => ({
      actionAt: audit.actionAt,
      action: audit.action,
      actor: audit.actionBy,
      note: [audit.payloadSummary, audit.note].filter(Boolean).join('；'),
    })),
  )
  const logs = usageAudits
    .concat(returnAudits)
    .sort((left, right) => right.actionAt.localeCompare(left.actionAt, 'zh-CN'))

  return `
    <section id="transfer-bag-tabpanel-logs" role="tabpanel" aria-labelledby="transfer-bag-tab-logs" class="space-y-3 rounded-xl border bg-card p-4">
      <div>
        <h2 class="text-sm font-semibold text-foreground">操作日志</h2>
        <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(`当前查看 ${activeMaster.bagCode} 的全部操作日志，已按时间倒序排列。`)}</p>
      </div>
      ${logs.length
        ? `<div class="space-y-2">${logs
            .map(
              (log) => `
                <article class="rounded-xl border bg-muted/15 px-4 py-3 text-sm">
                  <div class="flex items-center justify-between gap-3">
                    <p class="font-medium text-foreground">${escapeHtml(log.action)}</p>
                    <p class="text-xs text-muted-foreground">${escapeHtml(formatDateTime(log.actionAt))}</p>
                  </div>
                  <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(log.actor)}</p>
                  <p class="mt-2 text-sm text-foreground">${escapeHtml(log.note || '无备注')}</p>
                </article>
              `,
            )
            .join('')}</div>`
        : '<div class="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">当前还没有操作日志。</div>'}
    </section>
  `
}

function renderTransferBagDetailTabPanel(
  activeMaster: TransferBagMasterItem,
  focusedUsage: TransferBagUsageItem | null,
  activeTab: TransferBagDetailTab,
): string {
  if (activeTab === 'history') return renderTransferBagHistoryTab(activeMaster, focusedUsage)
  if (activeTab === 'recovery') return renderTransferBagRecoveryTab(activeMaster, focusedUsage)
  if (activeTab === 'logs') return renderTransferBagLogsTab(activeMaster, focusedUsage)
  return renderTransferBagCurrentTab(activeMaster, focusedUsage)
}

function renderDetailPage(): string {
  syncPrefilterFromQuery()
  const meta = getCanonicalCuttingMeta(getCurrentTransferBagPathname(), 'transfer-bag-detail')
  const activeMaster = getActiveMaster()
  const activeTab = readTransferBagDetailTab()
  const focusedUsage = getDetailFocusedUsage(activeMaster)

  return `
    <div class="space-y-3 p-4">
      <header data-transfer-bag-page-header class="flex items-center justify-between gap-3">
        <h1 class="text-xl font-bold">${escapeHtml(meta.pageTitle)}</h1>
        <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="${escapeHtml(buildTransferBagListRoute())}">返回周转口袋流转</button>
      </header>
      ${renderFeedbackBar()}
      ${activeMaster ? renderTransferBagDetailHeader(activeMaster, focusedUsage) : renderDetailEmptyState()}
      ${activeMaster ? renderTransferBagDetailTabs(activeMaster, focusedUsage, activeTab) : ''}
      ${activeMaster ? renderTransferBagDetailTabPanel(activeMaster, focusedUsage, activeTab) : ''}
    </div>
  `
}

function syncMasterSelection(masterId: string): void {
  const master = getViewModel().mastersById[masterId]
  if (!master) return
  state.activeMasterId = masterId
  state.draft.bagId = master.bagId
  state.draft.bagCodeInput = master.bagCode
  if (master.currentUsage) {
    syncUsageSelection(master.currentUsage.usageId)
  }
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
    复用建议: state.conditionDraft.reusableDecision,
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
    setFeedback('warning', '请先选择一个待回仓使用周期。')
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
    usage.signoffStatus = 'SIGNED'
    usage.signedAt = usage.signedAt || nowText()
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
        note: '从当前使用周期进入回仓 / 验收工作区。',
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
    setFeedback('warning', '请先选择一个使用周期，再填写回货验收信息。')
    return true
  }
  const bag = getSourceMaster(usage.bagId)
  if (!bag) {
    setFeedback('warning', '当前使用周期缺少口袋主档，不能验收。')
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
  usage.returnedAt = receipt.returnAt
  usage.note = receipt.discrepancyType === 'NONE' ? '当前使用周期已完成回货验收，等待关闭。' : '当前使用周期已完成回货验收，但存在差异待补说明后关闭。'
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
    setFeedback('warning', '请先选择一个使用周期。')
    return true
  }
  const bag = getSourceMaster(usage.bagId)
  if (!bag) {
    setFeedback('warning', '当前使用周期缺少口袋主档，不能关闭。')
    return true
  }
  const receipt = (getReturnViewModel().returnReceiptsByUsageId[usage.usageId] || []).slice().sort((left, right) => right.returnAt.localeCompare(left.returnAt, 'zh-CN'))[0] || null
  const condition = (getReturnViewModel().conditionRecordsByUsageId[usage.usageId] || []).slice().sort((left, right) => right.inspectedAt.localeCompare(left.inspectedAt, 'zh-CN'))[0] || null
  if (!receipt || !condition) {
    setFeedback('warning', '请先完成回货验收，再关闭使用周期。')
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
      action: '关闭使用周期',
      actionAt: closure.closedAt,
      actionBy: closure.closedBy,
      payloadSummary: `${usage.usageNo} 已关闭，口袋 -> ${deriveTransferBagMasterStatus(closure.nextBagStatus).label}`,
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
    setFeedback('warning', `${bag.bagCode} 当前状态为“${deriveTransferBagMasterStatus(bag.currentStatus).label}”，本步不允许开启新的使用周期。`)
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
      action: '创建使用周期',
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
    setFeedback('warning', '必须先扫口袋码，再扫菲票子码。请先创建或选中一个使用周期。')
    return true
  }
  if (usage.usageStatus === 'DISPATCHED' || usage.usageStatus === 'PENDING_SIGNOFF') {
    setFeedback('warning', `${usage.usageNo} 已进入发出阶段，不能继续修改装袋内容。`)
    return true
  }
  const sewingTask = getViewModel().sewingTasksById[usage.sewingTaskId] ?? null
  if (!state.draft.ticketInput.trim()) {
    setFeedback('warning', '请先扫描菲票子码。')
    return true
  }
  const ticket = getSelectedTicketRecord()
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
    bindingId: buildCuttingTraceabilityId('carrier-bind', nowText(), usage.usageId, ticket.ticketRecordId),
    usageId: usage.usageId,
    usageNo: usage.usageNo,
    cycleId: usage.cycleId,
    bagId: usage.bagId,
    bagCode: usage.bagCode,
    carrierId: usage.carrierId || usage.bagId,
    carrierCode: usage.carrierCode || usage.bagCode,
    feiTicketId: ticket.feiTicketId || ticket.ticketRecordId,
    ticketRecordId: ticket.ticketRecordId,
    ticketNo: ticket.ticketNo,
    originalCutOrderId: ticket.originalCutOrderId,
    originalCutOrderNo: ticket.originalCutOrderNo,
    mergeBatchNo: ticket.mergeBatchNo,
    productionOrderNo: ticket.productionOrderNo,
    裁剪批次No: ticket.mergeBatchNo,
    qty: ticket.qty,
    boundAt: nowText(),
    boundBy: '周转口袋工作台',
    operator: '周转口袋工作台',
    status: 'BOUND',
    note: '先扫周转口袋父码，再扫菲票子码，已建立正式父子映射。',
  })
  state.store.auditTrail.push(
    buildBagUsageAuditTrail({
      usageId: usage.usageId,
      action: '绑定菲票',
      actionAt: nowText(),
      actionBy: '周转口袋工作台',
      note: `${usage.bagCode} -> ${ticket.ticketNo} 已绑定父子码。`,
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
    setFeedback('warning', '必须先扫口袋码，再扫菲票子码。请先创建或选中一个使用周期，再导入候选菲票。')
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
      bindingId: buildCuttingTraceabilityId('carrier-bind', nowText(), usage.usageId, ticket.ticketRecordId, String(successCount + 1)),
      usageId: usage.usageId,
      usageNo: usage.usageNo,
      cycleId: usage.cycleId,
      bagId: usage.bagId,
      bagCode: usage.bagCode,
      carrierId: usage.carrierId || usage.bagId,
      carrierCode: usage.carrierCode || usage.bagCode,
      feiTicketId: ticket.feiTicketId || ticket.ticketRecordId,
      ticketRecordId: ticket.ticketRecordId,
      ticketNo: ticket.ticketNo,
      originalCutOrderId: ticket.originalCutOrderId,
      originalCutOrderNo: ticket.originalCutOrderNo,
      mergeBatchNo: ticket.mergeBatchNo,
      productionOrderNo: ticket.productionOrderNo,
      裁剪批次No: ticket.mergeBatchNo,
      qty: ticket.qty,
      boundAt: nowText(),
      boundBy: '周转口袋工作台',
      operator: '周转口袋工作台',
      status: 'BOUND',
      note: '通过候选菲票批量建立正式父子映射。',
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
    setFeedback('warning', `${usage.usageNo} 已进入发出阶段，不能移除父子码映射。`)
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
  const qrValue = resolveUsageBagQrValue(usage)
  return `
    <!doctype html>
    <html lang="zh-CN">
      <head>
        <meta charset="utf-8" />
        <title>周转口袋流转清单 - ${escapeHtml(usage.usageNo)}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif; margin: 28px; color: #111827; }
          h1 { margin: 0 0 8px; font-size: 24px; }
          .tip { margin-top: 12px; border: 1px solid #bfdbfe; background: #eff6ff; color: #1d4ed8; border-radius: 10px; padding: 12px; font-size: 13px; line-height: 1.6; }
          .hero { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; }
          .hero-copy { flex: 1; min-width: 0; }
          .qr-panel { width: 180px; border: 1px solid #d1d5db; border-radius: 14px; padding: 14px; text-align: center; background: #fff; }
          .qr-panel [data-real-qr] { display: inline-flex; align-items: center; justify-content: center; min-height: 112px; min-width: 112px; }
          .qr-title { margin-top: 10px; font-size: 13px; font-weight: 600; }
          .qr-meta { margin-top: 4px; font-size: 12px; line-height: 1.5; color: #6b7280; word-break: break-all; }
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
        <div class="hero">
          <div class="hero-copy">
            <h1>周转口袋流转清单</h1>
            <div class="tip">打印预览中展示正式 SVG 二维码，用于装袋、发出、签收与回仓追溯。</div>
          </div>
          <div class="qr-panel">
            ${
              qrValue
                ? renderRealQrPlaceholder({
                  value: qrValue,
                  size: 112,
                  title: `周转口袋码 ${usage.bagCode}`,
                  label: `周转口袋 ${usage.bagCode} 打印二维码`,
                })
                : '<div class="qr-meta">当前未找到正式二维码值</div>'
            }
            <div class="qr-title">${escapeHtml(usage.bagCode)}</div>
            <div class="qr-meta">本次周转：${escapeHtml(usage.usageNo)}</div>
            <div class="qr-meta">${escapeHtml(summarizeQrValue(qrValue))}</div>
          </div>
        </div>
        <div class="meta">
          <div class="meta-item"><div class="label">周转口袋码</div><div class="value">${escapeHtml(usage.bagCode)}</div></div>
          <div class="meta-item"><div class="label">本次周转号</div><div class="value">${escapeHtml(usage.usageNo)}</div></div>
          <div class="meta-item"><div class="label">车缝任务号</div><div class="value">${escapeHtml(usage.sewingTaskNo)}</div></div>
          <div class="meta-item"><div class="label">车缝工厂</div><div class="value">${escapeHtml(usage.sewingFactoryName)}</div></div>
          <div class="meta-item"><div class="label">菲票数</div><div class="value">${escapeHtml(String(summary.ticketCount))}</div></div>
          <div class="meta-item"><div class="label">原始裁片单数</div><div class="value">${escapeHtml(String(summary.originalCutOrderCount))}</div></div>
          <div class="meta-item"><div class="label">生产单摘要</div><div class="value">${escapeHtml(usage.productionOrderNos.join(' / ') || '待补')}</div></div>
          <div class="meta-item"><div class="label">打印时间</div><div class="value">${escapeHtml(nowText())}</div></div>
        </div>
        <table>
          <thead>
            <tr>
              <th>周转口袋码</th>
              <th>菲票码</th>
              <th>面料 SKU</th>
              <th>原始裁片单</th>
              <th>生产单</th>
              <th>裁剪批次</th>
            </tr>
          </thead>
          <tbody>
            ${bindings
              .map(
                (binding) => `
                  <tr>
                    <td>${escapeHtml(binding.bagCode)}</td>
                    <td>${escapeHtml(binding.ticketNo)}</td>
                    <td>${escapeHtml(binding.ticket?.materialSku || '待补')}</td>
                    <td>${escapeHtml(binding.originalCutOrderNo)}</td>
                    <td>${escapeHtml(binding.productionOrderNo)}</td>
                    <td>${escapeHtml(binding.mergeBatchNo || binding.裁剪批次No || '无')}</td>
                  </tr>
                `,
              )
              .join('')}
          </tbody>
        </table>
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
    setFeedback('warning', `${usage.usageNo} 还没有装入任何菲票，不能打印流转清单。`)
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
      action: '打印流转清单',
      actionAt: manifest.createdAt,
      actionBy: manifest.createdBy,
      note: `${usage.bagCode} 当前已打印流转清单。`,
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
  const frame = printWindow.requestAnimationFrame?.bind(printWindow) || window.requestAnimationFrame.bind(window)
  frame(() => {
    hydrateRealQRCodes(printWindow.document)
    frame(() => {
      printWindow.setTimeout(() => {
        printWindow.focus()
        printWindow.print()
      }, 0)
    })
  })
  setFeedback('success', `${usage.usageNo} 的流转清单已打开打印预览。`)
  return true
}

function updateUsageStatus(usageId: string | undefined, nextStatus: TransferBagUsageStatusKey): boolean {
  if (!usageId) return false
  const usage = getSourceUsage(usageId)
  if (!usage) return false
  if (!usage.packedTicketCount && nextStatus !== 'DRAFT') {
    setFeedback('warning', `${usage.usageNo} 尚未装入菲票，不能进入后续流转状态。`)
    return true
  }
  if (nextStatus === 'DISPATCHED' && !['READY_TO_DISPATCH', 'DISPATCHED'].includes(usage.usageStatus)) {
    setFeedback('warning', `${usage.usageNo} 需先完成装袋，再标记发出。`)
    return true
  }
  if (nextStatus === 'WAITING_RETURN' && !['DISPATCHED', 'PENDING_SIGNOFF', 'WAITING_RETURN'].includes(usage.usageStatus)) {
    setFeedback('warning', `${usage.usageNo} 当前还不能签收，请先完成发出。`)
    return true
  }

  const currentSummary = buildTransferBagParentChildSummary(state.store.bindings.filter((item) => item.usageId === usage.usageId))
  if (!validateBagToSewingTaskBinding(usage, usage.sewingTaskId).ok) {
    setFeedback('warning', '当前使用周期的车缝任务绑定不完整，请先补齐。')
    return true
  }

  usage.usageStatus = nextStatus
  if (nextStatus === 'READY_TO_DISPATCH') {
    usage.finishedPackingAt = nowText()
    usage.note = '当前使用周期已装袋完成，等待发出。'
  }
  if (nextStatus === 'DISPATCHED') {
    usage.dispatchAt = nowText()
    usage.dispatchBy = '周转口袋工作台'
    usage.signoffStatus = 'WAITING'
    usage.note = `当前使用周期已发出，共 ${currentSummary.ticketCount} 张菲票。`
  }
  if (nextStatus === 'WAITING_RETURN') {
    usage.signoffStatus = 'SIGNED'
    usage.signedAt = nowText()
    usage.note = '当前使用周期已完成签收，等待回仓验收。'
  }
  if (nextStatus === 'PENDING_SIGNOFF') {
    usage.signoffStatus = 'WAITING'
    usage.note = '当前使用周期等待后道签收，回货与复用将在下一步处理。'
  }

  state.store.auditTrail.push(
    buildBagUsageAuditTrail({
      usageId: usage.usageId,
      action:
        nextStatus === 'READY_TO_DISPATCH'
          ? '完成装袋'
          : nextStatus === 'DISPATCHED'
            ? '标记已发出'
            : nextStatus === 'WAITING_RETURN'
              ? '标记已签收'
              : '标记待签收',
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
  state.drillContext = null
  state.landingBanner = null
  state.preselectedTicketRecordIds = []
  state.returnStatus = 'ALL'
  persistSelectedTicketIds()
  state.querySignature = getCanonicalCuttingPath('transfer-bags')
  appStore.navigate(getCanonicalCuttingPath('transfer-bags'))
  return true
}

function navigateByPayload(payload: Record<string, string | undefined>, path: string): boolean {
  const targetMap: Record<string, CuttingNavigationTarget> = {
    [getCanonicalCuttingPath('original-orders')]: 'originalOrders',
    [getCanonicalCuttingPath('summary')]: 'summary',
    [getCanonicalCuttingPath('fei-tickets')]: 'feiTickets',
    [getCanonicalCuttingPath('cut-piece-warehouse')]: 'cutPieceWarehouse',
  }
  const target = targetMap[path]
  if (target) {
    const context = normalizeLegacyCuttingPayload(payload, 'transfer-bags', {
      autoOpenDetail: true,
      bagCode: payload.bagCode,
      usageNo: payload.usageNo,
      originalCutOrderNo: payload.originalCutOrderNo,
      mergeBatchNo: payload.mergeBatchNo || payload['裁剪批次No'],
      ticketNo: payload.ticketNo,
      productionOrderNo: payload.productionOrderNo,
    })
    appStore.navigate(buildCuttingRouteWithContext(target, context))
    return true
  }
  appStore.navigate(path)
  return true
}

export function renderCraftCuttingTransferBagsPage(): string {
  return renderListPage()
}

export function renderCraftCuttingTransferBagDetailPage(): string {
  return renderDetailPage()
}

export function handleCraftCuttingTransferBagsEvent(target: Element): boolean {
  const masterFieldNode = target.closest<HTMLElement>('[data-transfer-bags-master-field]')
  if (masterFieldNode) {
    const field = masterFieldNode.dataset.transferBagsMasterField as MasterFilterField | undefined
    if (!field) return false
    const input = masterFieldNode as HTMLInputElement | HTMLSelectElement
    if (field === 'keyword') {
      state.masterKeyword = input.value
      resetMasterPagination()
    }
    if (field === 'status') {
      state.masterStatus = input.value as MasterStatusFilter
      resetMasterPagination()
    }
    return true
  }

  const masterPageSizeNode = target.closest<HTMLElement>('[data-transfer-bags-master-page-size]')
  if (masterPageSizeNode) {
    const input = masterPageSizeNode as HTMLSelectElement
    const nextPageSize = Number.parseInt(input.value || '10', 10)
    state.masterPageSize = Number.isFinite(nextPageSize) && nextPageSize > 0 ? nextPageSize : 10
    resetMasterPagination()
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
  if (action === 'set-master-status') {
    state.masterStatus = (actionNode.dataset.status as MasterStatusFilter | undefined) || 'ALL'
    resetMasterPagination()
    return true
  }
  if (action === 'set-master-page') {
    const nextPage = Number.parseInt(actionNode.dataset.page || '1', 10)
    state.masterPage = Number.isFinite(nextPage) && nextPage > 0 ? nextPage : 1
    return true
  }
  if (action === 'clear-draft') return clearDraft()
  if (action === 'match-bag-code') {
    const matched = getSelectedBag()
    if (!matched) {
      setFeedback('warning', '未匹配到该周转口袋码，请检查载具编码。')
      return true
    }
    syncMasterSelection(matched.bagId)
    const masterItem = getViewModel().mastersById[matched.bagId]
    if (masterItem?.pocketStatusKey === 'IDLE') {
      setFeedback('success', `${matched.bagCode} 已带入装袋工作台，可开始本次装袋。`)
    } else if (masterItem?.pocketStatusKey === 'PACKING') {
      setFeedback('success', `${matched.bagCode} 已进入当前使用周期，可继续装袋。`)
    } else {
      setFeedback('warning', `${matched.bagCode} 当前状态为“${masterItem?.pocketStatusMeta.label || '待补'}”，已带入详情与当前使用周期。`)
    }
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
    const masterItem = getViewModel().mastersById[bagId]
    setFeedback('success', `已切换到 ${masterItem?.bagCode || '当前口袋'}，当前状态：${masterItem?.pocketStatusMeta.label || '待补'}。`)
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
  if (action === 'mark-signed') return updateUsageStatus(actionNode.dataset.usageId || state.activeUsageId || undefined, 'WAITING_RETURN')
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
  if (action === 'return-summary') {
    const context = buildReturnToSummaryContext(state.drillContext)
    if (!context) return false
    appStore.navigate(buildCuttingRouteWithContext('summary', context))
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
