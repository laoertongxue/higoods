import { appStore } from '../../../state/store.ts'
import { renderRealQrPlaceholder } from '../../../components/real-qr.ts'
import { escapeHtml, formatDateTime } from '../../../utils.ts'
import {
  PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE,
  renderProductionOrderIdentityCell,
} from '../../../data/fcs/production-order-identity.ts'
import {
  CUTTING_FEI_TICKET_RECORDS_STORAGE_KEY,
} from '../../../data/fcs/cutting/storage/fei-tickets-storage.ts'
import {
  paginateItems,
  renderCompactKpiCard,
  renderCompactKpiGroup,
  renderStickyFilterShell,
  renderStickyTableScroller,
  renderWorkbenchFilterChip,
  renderWorkbenchPagination,
  renderWorkbenchSecondaryPanel,
  renderWorkbenchStateBar,
} from './layout.helpers.ts'
import { getCanonicalCuttingMeta, getCanonicalCuttingPath, renderCuttingPageHeader } from './meta.ts'
import {
  getWarehouseSearchParams,
} from './warehouse-shared.ts'
import {
  buildCuttingTraceabilityId,
  encodeCarrierQr,
  parseCuttingTraceQr,
} from '../../../data/fcs/cutting/qr-codes.ts'
import { parseCarrierQrValue } from '../../../data/fcs/cutting/transfer-bag-runtime.ts'
import { buildTransferBagLabelPrintLink } from '../../../data/fcs/fcs-route-links.ts'
import { formatFactoryDisplayName } from '../../../data/fcs/factory-mock-data.ts'
import { listBusinessFactoryMasterRecords } from '../../../data/fcs/factory-master-store.ts'
import {
  buildCuttingDrillChipLabels,
  buildCuttingDrillSummary,
  buildCuttingRouteWithContext,
  buildReturnToSummaryContext,
  getCuttingSourcePageLabel,
  hasSummaryReturnContext,
  buildCuttingDrillContext,
  readCuttingDrillContextFromLocation,
  type CuttingDrillContext,
  type CuttingNavigationTarget,
} from './navigation-context.ts'
import {
  buildTransferBagsProjection,
} from './transfer-bags-projection.ts'
import {
  buildBagUsageAuditTrail,
  buildTransferBagCarrierManagementProjection,
  buildTransferBagParentChildSummary,
  createTransferBagUsageDraft,
  CUTTING_TRANSFER_BAG_LEDGER_STORAGE_KEY,
  CUTTING_TRANSFER_BAG_SELECTED_TICKET_IDS_STORAGE_KEY,
  deriveTransferBagMasterStatus,
  deriveTransferBagUsageStatus,
  deserializeTransferBagSelectedTicketIds,
  ensureUsageContextLockedByTicket,
  serializeTransferBagSelectedTicketIds,
  serializeTransferBagStorage,
  validateTicketBindingEligibility,
  type TransferBagBindingItem,
  type TransferBagCarrierCurrentStatus,
  type TransferBagCarrierUseStage,
  type TransferBagItemBinding,
  type TransferBagMaster,
  type TransferBagMasterItem,
  type TransferBagPrefilter,
  type TransferBagCycleContextResolution,
  type TransferBagStore,
  type TransferBagTicketCandidate,
  type TransferBagUsage,
  type TransferBagUsageItem,
  type TransferBagUsageStatusKey,
  type TransferBagVisibleStatusKey,
} from './transfer-bags-model.ts'
import {
  buildBagReturnAuditTrail,
  buildReuseCycleSummary,
  buildReturnDiscrepancyMeta,
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
} from './transfer-bag-return-model.ts'
import { renderMaterialIdentityBlock } from './material-identity.ts'
import {
  state,
  nowText,
  uniqueStrings,
  serializeTransferBagTicketRecordsStorage,
  sanitizeIdFragment,
  invalidateTransferBagProjectionCache,
  getProjection,
  hydrateStore,
  getViewModel,
  getReturnViewModel,
  getCarrierManagementProjection,
  persistStore,
  persistSelectedTicketIds,
  setFeedback,
  closeActiveDialog,
  getFactoryOptions,
  getFactoryNameById,
  type MasterStatusFilter,
  type MasterUseStageFilter,
  type UsageStatusFilter,
  type ReturnStatusFilter,
  type TransferBagDetailTab,
  type TransferBagBaggingStepId,
  type TransferBagBaggingStepState,
  type TransferBagDialog,
  type TransferBagsProjection,
  type TransferBagCarrierManagementProjection,
  type TransferBagCarrierMasterRecord,
  type FeedbackTone,
  type FeedbackState,
  type TransferBagLandingResolution,
  type TransferBagLandingBanner,
  type TransferBagBaggingStepView,
  type TransferBagsPageState,
  type MasterFilterField,
  type UsageFilterField,
  type WorkbenchField,
  type ReturnFilterField,
  type ReturnDraftField,
  type ConditionDraftField,
  type MasterDraftField,
  type PackDraftField,
} from './transfer-bags/state.ts'

function resolveCarrierScanInput(input: string, store: TransferBagStore): TransferBagMaster | null {
  const normalized = input.trim()
  if (!normalized) return null
  const parsed = parseCarrierQrValue(normalized)
  if (parsed) {
    return (
      store.masters.find((item) => item.carrierId === parsed.carrierId) ||
      store.masters.find((item) => item.carrierCode === parsed.carrierCode) ||
      null
    )
  }
  return store.masters.find((item) => item.carrierCode === normalized) || null
}

function resolveFeiTicketScanInput(input: string, ticketRecords: TransferBagsProjection['ticketRecords']) {
  const normalized = input.trim()
  if (!normalized) return null
  const parsed = parseCuttingTraceQr(normalized)
  if (parsed?.codeType === 'FEI_TICKET') {
    return (
      ticketRecords.find((item) => item.ticketRecordId === parsed.feiTicketId) ||
      ticketRecords.find((item) => item.ticketNo === parsed.feiTicketNo) ||
      null
    )
  }
  return (
    ticketRecords.find((item) => item.ticketNo === normalized) ||
    ticketRecords.find((item) => item.qrSerializedValue === normalized) ||
    ticketRecords.find((item) => item.qrValue === normalized) ||
    null
  )
}

function hasExplicitUsageContext(prefilter: TransferBagPrefilter | null): boolean {
  return Boolean(prefilter?.usageId || prefilter?.usageNo)
}

function hasExplicitBagContext(prefilter: TransferBagPrefilter | null): boolean {
  return Boolean(prefilter?.bagId || prefilter?.bagCode)
}

function hasSourceContext(prefilter: TransferBagPrefilter | null): boolean {
  return Boolean(
    prefilter?.cutOrderId ||
      prefilter?.cutOrderNo ||
      prefilter?.productionOrderId ||
      prefilter?.productionOrderNo ||
      prefilter?.markerPlanId ||
      prefilter?.markerPlanNo ||
      prefilter?.唛架方案No ||
      prefilter?.materialSku ||
      prefilter?.spreadingSessionId ||
      prefilter?.sourceWritebackId ||
      prefilter?.styleCode ||
      prefilter?.cuttingGroup ||
      prefilter?.warehouseStatus,
  )
}

function buildSourceOnlyPrefilter(prefilter: TransferBagPrefilter | null): TransferBagPrefilter | null {
  if (!prefilter) return null
  return {
    cutOrderId: prefilter.cutOrderId,
    cutOrderNo: prefilter.cutOrderNo,
    productionOrderId: prefilter.productionOrderId,
    productionOrderNo: prefilter.productionOrderNo,
    markerPlanId: prefilter.markerPlanId,
    markerPlanNo: prefilter.markerPlanNo,
    唛架方案No: prefilter.唛架方案No,
    materialSku: prefilter.materialSku,
    spreadingSessionId: prefilter.spreadingSessionId,
    sourceWritebackId: prefilter.sourceWritebackId,
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
      prefilter?.cutOrderId ||
      prefilter?.cutOrderNo ||
      prefilter?.productionOrderId ||
      prefilter?.productionOrderNo ||
      prefilter?.markerPlanId ||
      prefilter?.markerPlanNo ||
      prefilter?.唛架方案No ||
      prefilter?.materialSku ||
      prefilter?.spreadingSessionId ||
      prefilter?.sourceWritebackId ||
      prefilter?.styleCode,
  )
}

function resetMasterDraft(): void {
  const factory = getFactoryOptions()[0]
  state.masterDraft = {
    bagCode: '',
    carrierType: 'bag',
    capacity: '80',
    bagSpec: '中号 / 80 张菲票',
    bagMaterial: '循环软袋',
    ownershipFactoryId: factory?.id || '',
    currentLocation: '裁片仓空袋区',
    note: '',
  }
}

function resetPackDraft(stage: 'INBOUND_TEMP' | 'HANDOVER_PACKING', bagId?: string): void {
  const bag = bagId ? getSourceMaster(bagId) : getActiveMaster()
  const firstTask = getViewModel().sewingTasks[0]
  state.packDraft = {
    bagId: bag?.bagId || '',
    bagCodeInput: bag?.bagCode || '',
    ticketInput: '',
    warehouseArea: stage === 'INBOUND_TEMP' ? '裁片暂存区' : '交出备货区',
    locationCode: stage === 'INBOUND_TEMP' ? 'A-01-01' : '交出月台-01',
    operator: stage === 'INBOUND_TEMP' ? '裁床仓管' : '交出仓管',
    boundObjectType: stage === 'INBOUND_TEMP' ? '入仓暂存记录' : '车缝任务',
    boundObjectNo: stage === 'INBOUND_TEMP' ? '' : firstTask?.sewingTaskNo || '',
    receiverType: stage === 'INBOUND_TEMP' ? '仓库' : '工厂',
    receiverName: stage === 'INBOUND_TEMP' ? '裁床待交出仓' : formatFactoryDisplayName(firstTask?.sewingFactoryName || '') || '接收工厂待指定',
    note: '',
  }
}

function getDialogTitle(): string {
  if (state.activeDialog === 'new-master') return '新增中转袋'
  if (state.activeDialog === 'inbound-pack') return '入仓暂存装袋'
  if (state.activeDialog === 'handover-pack') return '交出装袋'
  if (state.activeDialog === 'return') return '回收确认'
  return '中转袋流转'
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
  const cutOrderIds = uniqueStrings([
    ...bindingItems.map((binding) => binding.cutOrderId),
    item.navigationPayload.cutOrders.cutOrderId,
  ])
  const productionOrderIds = uniqueStrings([
    ...bindingItems.map((binding) => binding.ticket?.productionOrderId),
    item.navigationPayload.cutOrders.productionOrderId,
  ])
  const markerPlanIds = uniqueStrings([
    ...bindingItems.map((binding) => binding.ticket?.markerPlanId),
    item.navigationPayload.cutOrders.markerPlanId,
  ])
  const materialSkus = uniqueStrings(bindingItems.map((binding) => binding.ticket?.materialSku))
  const styleCodes = uniqueStrings([item.styleCode, ...bindingItems.map((binding) => binding.ticket?.styleCode)])

  return (
    matchPrefilter([item.usageId], prefilter.usageId) &&
    matchPrefilter([item.usageNo], prefilter.usageNo) &&
    matchPrefilter([item.bagId], prefilter.bagId) &&
    matchPrefilter([item.bagCode], prefilter.bagCode) &&
    matchPrefilter(cutOrderIds, prefilter.cutOrderId) &&
    matchPrefilter(item.cutOrderNos, prefilter.cutOrderNo) &&
    matchPrefilter(productionOrderIds, prefilter.productionOrderId) &&
    matchPrefilter(item.productionOrderNos, prefilter.productionOrderNo) &&
    matchPrefilter(markerPlanIds, prefilter.markerPlanId) &&
    matchPrefilter(item.markerPlanNos, prefilter.markerPlanNo || prefilter.唛架方案No) &&
    matchPrefilter(materialSkus, prefilter.materialSku) &&
    matchPrefilter([item.spreadingSessionId], prefilter.spreadingSessionId) &&
    matchPrefilter([item.spreadingSourceWritebackId], prefilter.sourceWritebackId) &&
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
    matchPrefilter([item.cutOrderId], prefilter.cutOrderId) &&
    matchPrefilter([item.cutOrderNo], prefilter.cutOrderNo) &&
    matchPrefilter([item.ticket?.productionOrderId || item.navigationPayload.cutOrders.productionOrderId], prefilter.productionOrderId) &&
    matchPrefilter([item.productionOrderNo], prefilter.productionOrderNo) &&
    matchPrefilter([item.ticket?.markerPlanId || item.navigationPayload.cutOrders.markerPlanId], prefilter.markerPlanId) &&
    matchPrefilter([item.markerPlanNo || item.唛架方案No], prefilter.markerPlanNo || prefilter.唛架方案No) &&
    matchPrefilter([item.ticket?.materialSku], prefilter.materialSku) &&
    matchPrefilter([item.spreadingSessionId], prefilter.spreadingSessionId) &&
    matchPrefilter([item.spreadingSourceWritebackId], prefilter.sourceWritebackId) &&
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

function getCarrierMasterRecordMap(): Record<string, TransferBagCarrierMasterRecord> {
  if (carrierManagementProjectionCache?.version !== projectionVersion) getCarrierManagementProjection()
  return carrierManagementProjectionCache?.masterRecordMap || {}
}

function matchesMasterStatusFilter(
  item: TransferBagMasterItem,
  filter: MasterStatusFilter,
  carrierRecordsByBagCode = getCarrierMasterRecordMap(),
): boolean {
  if (filter === 'ALL') return true
  return carrierRecordsByBagCode[item.bagCode]?.currentStatus === filter
}

function getMasterBaseItems(carrierRecordsByBagCode = getCarrierMasterRecordMap()) {
  const keyword = state.masterKeyword.trim().toLowerCase()
  const locationKeyword = state.masterLocationKeyword.trim().toLowerCase()
  const matchedMasterIds = state.prefilter ? new Set(findMatchingMasters(state.prefilter).map((item) => item.bagId)) : null
  return getViewModel().masters.filter((item) => {
    if (matchedMasterIds && matchedMasterIds.size && !matchedMasterIds.has(item.bagId)) return false
    const carrierRecord = carrierRecordsByBagCode[item.bagCode]
    if (keyword) {
      const haystack = [
        item.bagCode,
        item.bagType,
        item.currentLocation,
        item.latestUsageNo,
        item.note,
        carrierRecord?.bagSpec,
        carrierRecord?.currentStatus,
        carrierRecord?.currentUseStage,
        carrierRecord?.currentBoundObjectNo,
      ].join(' ').toLowerCase()
      if (!haystack.includes(keyword)) return false
    }
    if (state.masterUseStage !== 'ALL' && carrierRecord?.currentUseStage !== state.masterUseStage) return false
    if (locationKeyword && ![item.currentLocation, carrierRecord?.currentLocation].join(' ').toLowerCase().includes(locationKeyword)) return false
    return true
  })
}

function getFilteredMasters(baseItems = getMasterBaseItems(), carrierRecordsByBagCode = getCarrierMasterRecordMap()) {
  return baseItems.filter((item) => matchesMasterStatusFilter(item, state.masterStatus, carrierRecordsByBagCode))
}

function resetMasterPagination(): void {
  state.masterPage = 1
}

function getPagedMasters() {
  const carrierRecordsByBagCode = getCarrierMasterRecordMap()
  const baseItems = getMasterBaseItems(carrierRecordsByBagCode)
  const filteredItems = getFilteredMasters(baseItems, carrierRecordsByBagCode)
  const pageSlice = paginateItems(filteredItems, state.masterPage, state.masterPageSize)
  state.masterPage = pageSlice.page
  return {
    baseItems,
    filteredItems,
    carrierRecordsByBagCode,
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
        item.usageStageLabel,
        item.sewingTaskNo,
        item.sewingFactoryName,
        item.styleCode,
        item.spuCode,
        item.ticketNos.join(' '),
        item.cutOrderNos.join(' '),
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
        item.cutOrderNo,
        item.productionOrderNo,
        item.markerPlanNo || item.唛架方案No,
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
    cutOrderId: drillContext?.cutOrderId || params.get('cutOrderId') || undefined,
    cutOrderNo: drillContext?.cutOrderNo || params.get('cutOrderNo') || undefined,
    markerPlanId: drillContext?.markerPlanId || params.get('markerPlanId') || undefined,
    唛架方案No: drillContext?.markerPlanNo || params.get('唛架方案No') || undefined,
    markerPlanNo: drillContext?.markerPlanNo || params.get('markerPlanNo') || undefined,
    materialSku: drillContext?.materialSku || params.get('materialSku') || undefined,
    spreadingSessionId: drillContext?.spreadingSessionId || params.get('spreadingSessionId') || params.get('sessionId') || undefined,
    sourceWritebackId: params.get('sourceWritebackId') || params.get('holder') || undefined,
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

function getSelectedSewingTask() {
  return state.draft.sewingTaskId ? getViewModel().sewingTasksById[state.draft.sewingTaskId] || null : null
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
    if (state.prefilter.cutOrderId && ticket.cutOrderId !== state.prefilter.cutOrderId) return false
    if (state.prefilter.ticketNo && ticket.ticketNo !== state.prefilter.ticketNo) return false
    if (state.prefilter.cutOrderNo && ticket.cutOrderNo !== state.prefilter.cutOrderNo) return false
    if (state.prefilter.productionOrderId && ticket.productionOrderId !== state.prefilter.productionOrderId) return false
    if (state.prefilter.productionOrderNo && ticket.productionOrderNo !== state.prefilter.productionOrderNo) return false
    if (state.prefilter.markerPlanId && ticket.markerPlanId !== state.prefilter.markerPlanId) return false
    if (state.prefilter.唛架方案No && ticket.markerPlanNo !== state.prefilter.唛架方案No) return false
    if (state.prefilter.materialSku && ticket.materialSku !== state.prefilter.materialSku) return false
    if (state.prefilter.spreadingSessionId && ticket.sourceSpreadingSessionId !== state.prefilter.spreadingSessionId) return false
    if (state.prefilter.styleCode && ticket.styleCode !== state.prefilter.styleCode) return false
    return true
  })
}

function getSelectedTicketRecord(): TransferBagTicketCandidate | null {
  const record = resolveFeiTicketScanInput(state.draft.ticketInput, getProjection().ticketRecords)
  if (!record) return null
  return getViewModel().ticketCandidatesById[record.ticketRecordId] ?? null
}

function resolveLockedUsageContext(
  usage: TransferBagUsage | null,
  ticket: TransferBagTicketCandidate | null,
): TransferBagCycleContextResolution {
  return ensureUsageContextLockedByTicket({
    usage,
    ticket,
    sewingTasks: getViewModel().sewingTasks,
    sewingTasksById: getViewModel().sewingTasksById,
  })
}

function ensureUsageAutoCreatedForTicket(ticket: TransferBagTicketCandidate): TransferBagUsage | null {
  const existingUsage = getSourceUsage(state.activeUsageId)
  if (existingUsage) return existingUsage

  const bag = getSelectedBag()
  if (!bag) {
    setFeedback('warning', '当前未锁定中转袋，请先从列表进入详情后再扫码装袋。')
    return null
  }
  const hasOpenUsage = state.store.usages.some((usage) => usage.bagId === bag.bagId && !['CLOSED', 'SCRAP_CLOSED'].includes(usage.usageStatus))
  if (bag.currentStatus === 'DISABLED' || hasOpenUsage) {
    setFeedback('warning', `${bag.bagCode} 当前状态为“${deriveTransferBagMasterStatus(bag.currentStatus).label}”，当前不能开始新的周转。`)
    return null
  }

  const context = resolveLockedUsageContext(null, ticket)
  if (!context.ok || !context.sewingTask) {
    setFeedback('warning', context.reason || '当前菲票无法自动锁定车缝厂 / 任务，暂不能装袋。')
    return null
  }

  const now = nowText()
  const usage = createTransferBagUsageDraft({
    bag,
    sewingTask: context.sewingTask,
    note: `扫描首张菲票后自动锁定到 ${context.sewingTask.sewingFactoryName} / ${context.sewingTask.sewingTaskNo}。`,
    existingUsages: state.store.usages,
    nowText: now,
  })
  state.store.usages.push(usage)
  state.store.auditTrail.push(
    buildBagUsageAuditTrail({
      usageId: usage.usageId,
      action: '开始本次周转',
      actionAt: now,
      actionBy: '中转袋工作台',
      note: `${usage.bagCode} 已自动锁定到 ${usage.sewingFactoryName} / ${usage.sewingTaskNo}。`,
    }),
  )
  refreshDerivedState()
  persistStore()
  syncUsageSelection(usage.usageId)
  return getSourceUsage(usage.usageId)
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
  viewModel = getViewModel(),
): TransferBagLandingBanner | null {
  if (!prefilter || !resolution || resolution.page !== 'list' || !hasSourceContext(prefilter)) return null

  const matchedUsages = findMatchingUsages(prefilter, viewModel)
  const matchedBindings = findMatchingBindings(prefilter, viewModel)
  const sourceMarkerNos = uniqueStrings([
    ...matchedUsages.flatMap((item) => item.sourceMarkerNos),
    ...matchedBindings.map((item) => item.sourceMarkerNo),
  ])
  const sourceMarkerPlanNos = uniqueStrings([
    ...matchedUsages.flatMap((item) => item.markerPlanNos),
    ...matchedBindings.map((item) => item.markerPlanNo || item.唛架方案No),
  ])
  const sourceCutOrderNos = uniqueStrings([
    ...matchedUsages.flatMap((item) => item.cutOrderNos),
    ...matchedBindings.map((item) => item.cutOrderNo),
  ])
  const sourceSpreadingNos = uniqueStrings([
    ...matchedUsages.map((item) => item.spreadingSessionNo || item.spreadingSessionId),
    ...matchedBindings.map((item) => item.spreadingSessionNo || item.spreadingSessionId),
  ])
  const chips = Array.from(new Set([
    ...buildCuttingDrillChipLabels(drillContext).filter(
      (label) => !label.startsWith('中转袋码：') && !label.startsWith('使用周期：'),
    ),
    !drillContext?.cutOrderNo && sourceCutOrderNos.length
      ? `来源裁片单：${sourceCutOrderNos.join(' / ')}`
      : '',
    !drillContext?.markerNo && sourceMarkerNos.length ? `来源唛架：${sourceMarkerNos.join(' / ')}` : '',
    !drillContext?.markerPlanNo && sourceMarkerPlanNos.length
      ? `来源唛架方案：${sourceMarkerPlanNos.join(' / ')}`
      : '',
    !drillContext?.spreadingSessionNo && sourceSpreadingNos.length
      ? `来源铺布：${sourceSpreadingNos.join(' / ')}`
      : '',
  ].filter(Boolean)))

  if (!chips.length) return null

  const sourceLabel = getCuttingSourcePageLabel(drillContext?.sourcePageKey)
  const summary =
    resolution.matchedCount && resolution.matchedCount > 1
      ? `已从${sourceLabel}带入上下文，当前未唯一匹配到某个中转袋，请先选择口袋或进入详情。`
      : `已从${sourceLabel}带入上下文，当前还未定位到对应中转袋，请先选择口袋或进入详情。`

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
    usage.packedCutOrderCount = uniqueStrings(bindings.map((item) => item.cutOrderNo)).length
    if (usage.usageStatus === 'DRAFT' || usage.usageStatus === 'PACKING' || usage.usageStatus === 'READY_TO_DISPATCH') {
      if (!bindings.length) {
      usage.usageStatus = 'DRAFT'
      usage.cycleStatus = 'DRAFT'
      } else if (usage.usageStatus !== 'READY_TO_DISPATCH') {
        usage.usageStatus = 'PACKING'
        usage.cycleStatus = 'PACKING'
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
      master.currentStatus = master.currentStatus === 'DISABLED' ? 'DISABLED' : 'IDLE'
      master.latestUsageId = ''
      master.latestUsageNo = ''
      master.currentCycleId = ''
      master.currentOwnerTaskId = ''
      return
    }

    master.latestUsageId = latestUsage.usageId
    master.latestUsageNo = latestUsage.usageNo
    master.latestCycleId = latestUsage.cycleId
    master.latestCycleNo = latestUsage.cycleNo
    master.currentCycleId = ['CLOSED', 'SCRAP_CLOSED'].includes(latestUsage.usageStatus) ? '' : latestUsage.cycleId
    master.currentOwnerTaskId = latestUsage.boundObjectId || latestUsage.sewingTaskId || ''
    const latestClosure = (closureMap.get(latestUsage.usageId) || []).sort((left, right) => right.closedAt.localeCompare(left.closedAt, 'zh-CN'))[0] || null
    if (latestUsage.usageStatus === 'CLOSED' || latestUsage.usageStatus === 'SCRAP_CLOSED') {
      master.currentStatus = latestClosure?.nextBagStatus === 'DISABLED' || master.currentStatus === 'DISABLED' ? 'DISABLED' : 'IDLE'
      master.currentLocation = master.currentStatus === 'DISABLED' ? '报废区' : latestUsage.returnWarehouseName || '裁片仓空袋区'
    } else if (master.currentStatus === 'DISABLED') {
      master.currentLocation = '报废区'
    } else if (latestUsage.usageStage === 'INBOUND_TEMP') {
      master.currentStatus = 'IN_USE'
      master.currentLocation = latestUsage.usageStatus === 'READY_TO_DISPATCH'
        ? [latestUsage.sourceWarehouseName || '裁床待交出仓', latestUsage.warehouseArea, latestUsage.locationCode].filter(Boolean).join(' / ')
        : [latestUsage.sourceWarehouseName || '裁床待交出仓', '入仓装袋台', latestUsage.locationCode].filter(Boolean).join(' / ')
    } else if (latestUsage.usageStatus === 'READY_TO_DISPATCH') {
      master.currentStatus = 'IN_USE'
      master.currentLocation = latestUsage.locationCode || '交出待交区'
    } else if (['DISPATCHED', 'PENDING_SIGNOFF', 'WAITING_RETURN', 'RETURN_INSPECTING'].includes(latestUsage.usageStatus)) {
      master.currentStatus = 'DISPATCHED'
      master.currentLocation = latestUsage.receiverName || latestUsage.sewingFactoryName || '接收方待回收'
    } else {
      master.currentStatus = 'IN_USE'
      master.currentLocation = latestUsage.locationCode || '交出装袋台'
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

function buildNextUsageNo(now = nowText()): string {
  const dateKey = now.slice(0, 10).replaceAll('-', '')
  const sameDay = state.store.usages
    .map((item) => item.usageNo)
    .filter((item) => item.startsWith(`TBU-${dateKey}`))
    .map((item) => Number.parseInt(item.split('-').pop() || '0', 10))
    .filter((item) => Number.isFinite(item))
  return `TBU-${dateKey}-${String(Math.max(0, ...sameDay) + 1).padStart(3, '0')}`
}

function resolvePackBag(): TransferBagMaster | null {
  if (state.packDraft.bagId) return getSourceMaster(state.packDraft.bagId)
  return resolveCarrierScanInput(state.packDraft.bagCodeInput, state.store)
}

function parseTicketInputs(value: string): string[] {
  return uniqueStrings(value.split(/[\s,，;；、]+/).map((item) => item.trim()).filter(Boolean))
}

function resolvePackTickets(): { tickets: TransferBagTicketCandidate[]; missing: string[] } {
  const ticketRecords = getProjection().ticketRecords
  const tickets: TransferBagTicketCandidate[] = []
  const missing: string[] = []
  parseTicketInputs(state.packDraft.ticketInput).forEach((input) => {
    const record = resolveFeiTicketScanInput(input, ticketRecords)
    const ticket = record ? getViewModel().ticketCandidatesById[record.ticketRecordId] : null
    if (ticket && !tickets.some((item) => item.ticketRecordId === ticket.ticketRecordId)) {
      tickets.push(ticket)
    } else if (!ticket) {
      missing.push(input)
    }
  })
  return { tickets, missing }
}

function getSelectedSewingTaskByNo(taskNo: string) {
  return getViewModel().sewingTasks.find((item) => item.sewingTaskNo === taskNo || item.sewingTaskId === taskNo) || null
}

function buildManualUsage(options: {
  stage: 'INBOUND_TEMP' | 'HANDOVER_PACKING'
  bag: TransferBagMaster
  tickets: TransferBagTicketCandidate[]
  now: string
}): TransferBagUsage {
  const usageNo = buildNextUsageNo(options.now)
  const usageId = buildCuttingTraceabilityId('carrier-cycle', options.now, options.bag.bagId, usageNo)
  const firstTicket = options.tickets[0] || null
  const selectedTask = options.stage === 'HANDOVER_PACKING' ? getSelectedSewingTaskByNo(state.packDraft.boundObjectNo) : null
  const receiverName = state.packDraft.receiverName.trim() || selectedTask?.sewingFactoryName || (options.stage === 'INBOUND_TEMP' ? '裁床待交出仓' : '接收工厂待指定')
  const boundObjectType = options.stage === 'INBOUND_TEMP' ? '入仓暂存记录' : state.packDraft.boundObjectType.trim() || '车缝任务'
  const boundObjectNo = options.stage === 'INBOUND_TEMP' ? usageNo : state.packDraft.boundObjectNo.trim() || selectedTask?.sewingTaskNo || usageNo
  const boundObjectId = selectedTask?.sewingTaskId || boundObjectNo

  return {
    cycleId: usageId,
    cycleNo: usageNo,
    carrierId: options.bag.carrierId,
    carrierCode: options.bag.carrierCode,
    carrierType: options.bag.carrierType,
    cycleStatus: 'PACKING',
    usageId,
    usageNo,
    bagId: options.bag.bagId,
    bagCode: options.bag.bagCode,
    boundObjectType,
    boundObjectId,
    boundObjectNo,
    receiverType: options.stage === 'INBOUND_TEMP' ? '仓库' : state.packDraft.receiverType.trim() || '工厂',
    receiverId: selectedTask?.sewingFactoryId || '',
    receiverName,
    sourceWarehouseId: 'cutting-wait-handover',
    sourceWarehouseName: '裁床待交出仓',
    warehouseArea: state.packDraft.warehouseArea.trim(),
    locationCode: state.packDraft.locationCode.trim(),
    sewingTaskId: selectedTask?.sewingTaskId || (options.stage === 'HANDOVER_PACKING' ? boundObjectId : ''),
    sewingTaskNo: selectedTask?.sewingTaskNo || (options.stage === 'HANDOVER_PACKING' ? boundObjectNo : ''),
    sewingFactoryId: selectedTask?.sewingFactoryId || '',
    sewingFactoryName: selectedTask?.sewingFactoryName || (options.stage === 'HANDOVER_PACKING' ? receiverName : ''),
    styleCode: firstTicket?.styleCode || '',
    spuCode: firstTicket?.spuCode || '',
    skuSummary: firstTicket ? `${firstTicket.color || firstTicket.fabricColor} / ${firstTicket.size}` : '',
    colorSummary: firstTicket?.color || firstTicket?.fabricColor || '',
    sizeSummary: firstTicket?.size || '',
    usageStatus: 'PACKING',
    packedTicketCount: 0,
    packedCutOrderCount: 0,
    startedAt: options.now,
    finishedPackingAt: '',
    dispatchAt: '',
    dispatchBy: state.packDraft.operator.trim(),
    signoffStatus: 'PENDING',
    signedAt: '',
    returnedAt: '',
    status: 'loaded',
    usageStage: options.stage,
    usageStageLabel: options.stage === 'INBOUND_TEMP' ? '入仓暂存' : '交出装袋',
    note: state.packDraft.note.trim() || (options.stage === 'INBOUND_TEMP' ? '入仓暂存装袋已记录。' : '交出装袋已记录，等待完成装袋。'),
  }
}

function pushTicketBindings(usage: TransferBagUsage, tickets: TransferBagTicketCandidate[], now: string, note: string): void {
  tickets.forEach((ticket, index) => {
    state.store.bindings.push({
      bindingId: buildCuttingTraceabilityId('carrier-bind', now, usage.usageId, ticket.ticketRecordId, String(index + 1)),
      usageId: usage.usageId,
      usageNo: usage.usageNo,
      cycleId: usage.cycleId,
      cycleNo: usage.cycleNo,
      bagId: usage.bagId,
      bagCode: usage.bagCode,
      carrierId: usage.carrierId,
      carrierCode: usage.carrierCode,
      feiTicketId: ticket.feiTicketId || ticket.ticketRecordId,
      feiTicketNo: ticket.ticketNo,
      ticketRecordId: ticket.ticketRecordId,
      ticketNo: ticket.ticketNo,
      cutOrderId: ticket.cutOrderId,
      cutOrderNo: ticket.cutOrderNo,
      markerPlanNo: ticket.markerPlanNo,
      productionOrderNo: ticket.productionOrderNo,
      唛架方案No: ticket.markerPlanNo,
      fabricRollNo: ticket.fabricRollNo,
      fabricColor: ticket.fabricColor,
      size: ticket.size,
      partName: ticket.partName,
      bundleNo: ticket.bundleNo,
      qty: ticket.qty,
      garmentQty: ticket.garmentQty,
      actualCutPieceQty: ticket.actualCutPieceQty,
      boundAt: now,
      boundBy: state.packDraft.operator.trim() || '中转袋工作台',
      operator: state.packDraft.operator.trim() || '中转袋工作台',
      status: 'BOUND',
      note,
    })
  })
}

function saveMasterDraft(): boolean {
  const bagCode = state.masterDraft.bagCode.trim()
  if (!bagCode) {
    setFeedback('warning', '请填写中转袋编号。')
    return true
  }
  if (state.store.masters.some((item) => item.bagCode === bagCode || item.carrierCode === bagCode)) {
    setFeedback('warning', `${bagCode} 已存在，请更换中转袋编号。`)
    return true
  }
  const now = nowText()
  const carrierType = state.masterDraft.carrierType
  const carrierId = `carrier-${sanitizeIdFragment(bagCode)}`
  const ownershipFactoryName = getFactoryNameById(state.masterDraft.ownershipFactoryId)
  const encoded = encodeCarrierQr({
    carrierId,
    carrierCode: bagCode,
    carrierType,
    issuedAt: now,
    ownershipFactoryId: state.masterDraft.ownershipFactoryId,
    ownershipFactoryName,
  })
  const capacity = Number.parseInt(state.masterDraft.capacity, 10)
  state.store.masters.push({
    carrierId,
    carrierCode: bagCode,
    carrierType,
    latestCycleId: '',
    latestCycleNo: '',
    bagId: carrierId,
    bagCode,
    bagName: bagCode,
    bagSpec: state.masterDraft.bagSpec.trim() || `${carrierType === 'box' ? '周转箱' : '中转袋'} / 容量 ${Number.isFinite(capacity) ? capacity : 80} 张菲票`,
    bagMaterial: state.masterDraft.bagMaterial.trim() || (carrierType === 'box' ? '周转箱' : '循环软袋'),
    ownershipFactoryId: state.masterDraft.ownershipFactoryId,
    ownershipFactoryName,
    bagType: carrierType === 'box' ? '周转箱' : '中转袋',
    capacity: Number.isFinite(capacity) && capacity > 0 ? capacity : 80,
    reusable: true,
    currentStatus: 'IDLE',
    currentLocation: state.masterDraft.currentLocation.trim() || '裁片仓空袋区',
    latestUsageId: '',
    latestUsageNo: '',
    currentCycleId: '',
    currentOwnerTaskId: '',
    qrValue: encoded.qrValue,
    qrMeta: encoded.payload,
    enabled: true,
    createdAt: now,
    createdBy: '中转袋工作台',
    note: state.masterDraft.note.trim(),
  })
  refreshDerivedState()
  persistStore()
  closeActiveDialog()
  state.masterKeyword = bagCode
  resetMasterPagination()
  setFeedback('success', `${bagCode} 已新增，并生成归属 ${ownershipFactoryName || '未指定工厂'} 的中转袋二维码。`)
  return true
}

function savePackDraft(stage: 'INBOUND_TEMP' | 'HANDOVER_PACKING'): boolean {
  const bag = resolvePackBag()
  if (!bag) {
    setFeedback('warning', '请先扫描中转袋二维码。')
    return true
  }
  const hasOpenUsage = state.store.usages.some((usage) => usage.bagId === bag.bagId && !['CLOSED', 'SCRAP_CLOSED'].includes(usage.usageStatus))
  if (bag.currentStatus === 'DISABLED' || hasOpenUsage) {
    setFeedback('warning', `${bag.bagCode} 当前状态为“${deriveTransferBagMasterStatus(bag.currentStatus).label}”，不能开始新的装袋。`)
    return true
  }
  const scannedTicketInputs = parseTicketInputs(state.packDraft.ticketInput)
  const { tickets, missing } = resolvePackTickets()
  if (!scannedTicketInputs.length) {
    setFeedback('warning', '请至少扫描或输入一张菲票。')
    return true
  }
  if (missing.length) {
    setFeedback('warning', `以下菲票未匹配：${missing.join('、')}`)
    return true
  }
  if (!tickets.length) {
    setFeedback('warning', '当前菲票不能装入中转袋，请确认菲票状态或重新扫描。')
    return true
  }
  if (stage === 'INBOUND_TEMP' && (!state.packDraft.warehouseArea.trim() || !state.packDraft.locationCode.trim())) {
    setFeedback('warning', '请选择入仓暂存的库区和库位。')
    return true
  }
  const now = nowText()
  const usage = buildManualUsage({ stage, bag, tickets, now })
  if (stage === 'INBOUND_TEMP') {
    usage.usageStatus = 'READY_TO_DISPATCH'
    usage.cycleStatus = 'READY_TO_DISPATCH'
    usage.finishedPackingAt = now
    usage.note = `入仓暂存已确认，共装入 ${tickets.length} 张菲票。`
  } else {
    usage.usageStatus = 'DISPATCHED'
    usage.cycleStatus = 'DISPATCHED'
    usage.finishedPackingAt = now
    usage.dispatchAt = now
    usage.dispatchBy = state.packDraft.operator.trim() || '交出仓管'
    usage.signoffStatus = 'WAITING'
    usage.note = `交出确认已完成，共装入 ${tickets.length} 张菲票，等待中转袋回收。`
  }
  state.store.usages.push(usage)
  pushTicketBindings(
    usage,
    tickets,
    now,
    stage === 'INBOUND_TEMP' ? '入仓暂存装袋建立父子映射。' : '交出装袋建立父子映射。',
  )
  state.store.auditTrail.push(
    buildBagUsageAuditTrail({
      usageId: usage.usageId,
      action: stage === 'INBOUND_TEMP' ? '确认入仓暂存' : '交出确认',
      actionAt: now,
      actionBy: state.packDraft.operator.trim() || '中转袋工作台',
      note: `${usage.bagCode} 已装入 ${tickets.length} 张菲票。`,
    }),
  )
  refreshDerivedState()
  persistStore()
  closeActiveDialog()
  syncUsageSelection(usage.usageId)
  setFeedback('success', stage === 'INBOUND_TEMP' ? `${usage.usageNo} 已完成入仓暂存，装入 ${tickets.length} 张菲票。` : `${usage.usageNo} 已交出确认，${usage.bagCode} 已进入“已交出待回收”。`)
  return true
}

function confirmHandoverPacking(targetUsageId?: string): boolean {
  const usage = getSourceUsage(targetUsageId || state.activeUsageId)
  if (!usage || usage.usageStage !== 'HANDOVER_PACKING') {
    setFeedback('warning', '请先选择交出装袋记录。')
    return true
  }
  if (!usage.packedTicketCount) {
    setFeedback('warning', `${usage.usageNo} 尚未装入菲票，不能交出确认。`)
    return true
  }
  if (['DISPATCHED', 'PENDING_SIGNOFF', 'WAITING_RETURN', 'RETURN_INSPECTING'].includes(usage.usageStatus)) {
    setFeedback('warning', `${usage.usageNo} 已交出，当前等待回收。`)
    return true
  }
  if (['CLOSED', 'SCRAP_CLOSED'].includes(usage.usageStatus)) {
    setFeedback('warning', `${usage.usageNo} 已关闭，不能交出确认。`)
    return true
  }
  const now = nowText()
  const currentSummary = buildTransferBagParentChildSummary(state.store.bindings.filter((item) => item.usageId === usage.usageId))
  usage.usageStatus = 'DISPATCHED'
  usage.cycleStatus = 'DISPATCHED'
  usage.finishedPackingAt = usage.finishedPackingAt || now
  usage.dispatchAt = now
  usage.dispatchBy = '交出仓管'
  usage.signoffStatus = 'WAITING'
  usage.note = `交出确认已完成，共 ${currentSummary.ticketCount} 张菲票，等待中转袋回收。`
  state.store.auditTrail.push(
    buildBagUsageAuditTrail({
      usageId: usage.usageId,
      action: '交出确认',
      actionAt: now,
      actionBy: '交出仓管',
      note: `${usage.bagCode} 已交出确认，进入已交出待回收。`,
    }),
  )
  refreshDerivedState()
  persistStore()
  syncUsageSelection(usage.usageId)
  setFeedback('success', `${usage.usageNo} 已交出确认，${usage.bagCode} 已进入“已交出待回收”。`)
  return true
}

function completeInboundStorage(targetUsageId?: string): boolean {
  const usage = getSourceUsage(targetUsageId || state.activeUsageId)
  if (!usage || usage.usageStage !== 'INBOUND_TEMP') {
    setFeedback('warning', '请先选择入仓暂存装袋记录。')
    return true
  }
  if (!usage.packedTicketCount) {
    setFeedback('warning', `${usage.usageNo} 尚未装入菲票，不能确认暂存。`)
    return true
  }
  if (usage.usageStatus !== 'PACKING' && usage.usageStatus !== 'DRAFT') {
    setFeedback('warning', `${usage.usageNo} 当前不在入仓装袋中。`)
    return true
  }
  const now = nowText()
  usage.usageStatus = 'READY_TO_DISPATCH'
  usage.cycleStatus = 'READY_TO_DISPATCH'
  usage.finishedPackingAt = now
  usage.note = '入仓暂存已确认，袋内内容等待二次分拣或转出。'
  state.store.auditTrail.push(
    buildBagUsageAuditTrail({
      usageId: usage.usageId,
      action: '确认入仓暂存',
      actionAt: now,
      actionBy: '中转袋工作台',
      note: `${usage.usageNo} 已进入入仓暂存中。`,
    }),
  )
  refreshDerivedState()
  persistStore()
  setFeedback('success', `${usage.usageNo} 已确认入仓暂存。`)
  return true
}

function releaseInboundBag(targetUsageId?: string): boolean {
  const usage = getSourceUsage(targetUsageId || state.activeUsageId)
  if (!usage || usage.usageStage !== 'INBOUND_TEMP') {
    setFeedback('warning', '请先选择入仓暂存使用记录。')
    return true
  }
  if (!['READY_TO_DISPATCH', 'PACKING', 'DRAFT'].includes(usage.usageStatus)) {
    setFeedback('warning', `${usage.usageNo} 当前已关闭，不能重复清空。`)
    return true
  }
  const now = nowText()
  usage.usageStatus = 'CLOSED'
  usage.cycleStatus = 'CLOSED'
  usage.returnedAt = now
  usage.returnedBy = '中转袋工作台'
  usage.returnWarehouseName = usage.sourceWarehouseName || '裁床待交出仓'
  usage.note = '入仓暂存内容已转出或清空，中转袋恢复可用。'
  const bag = getSourceMaster(usage.bagId)
  if (bag && bag.currentStatus !== 'DISABLED') {
    bag.currentStatus = 'IDLE'
    bag.currentLocation = '裁片仓空袋区'
  }
  state.store.auditTrail.push(
    buildBagUsageAuditTrail({
      usageId: usage.usageId,
      action: '清空入仓暂存袋',
      actionAt: now,
      actionBy: '中转袋工作台',
      note: `${usage.bagCode} 已清空，恢复可用。`,
    }),
  )
  refreshDerivedState()
  persistStore()
  setFeedback('success', `${usage.bagCode} 已清空，恢复可用。`)
  return true
}

function saveReturnDraft(): boolean {
  const usage = getSourceUsage(state.activeUsageId)
  if (!usage) {
    setFeedback('warning', '请先选择待回收的使用记录。')
    return true
  }
  return completeReturnInspection(usage.usageId)
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
  state.landingBanner = buildTransferBagLandingBanner(state.prefilter, state.drillContext, landing, viewModel)

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

  if (state.prefilter?.returnStatus && ['WAITING_RETURN', 'RETURN_INSPECTING', 'CLOSED', 'SCRAP_CLOSED'].includes(state.prefilter.returnStatus)) {
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
      cutOrderCount: uniqueStrings(bindings.map((item) => item.cutOrderNo)).length,
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

function getCarrierCurrentStatusClass(status: string): string {
  if (status === '可用') return 'bg-emerald-100 text-emerald-700 border border-emerald-200'
  if (status === '入仓装袋中' || status === '交出装袋中') return 'bg-blue-100 text-blue-700 border border-blue-200'
  if (status === '入仓暂存中') return 'bg-cyan-100 text-cyan-700 border border-cyan-200'
  if (status === '待交出') return 'bg-violet-100 text-violet-700 border border-violet-200'
  if (status === '已交出待回收') return 'bg-orange-100 text-orange-700 border border-orange-200'
  if (status === '报废') return 'bg-slate-200 text-slate-700 border border-slate-300'
  return 'bg-slate-100 text-slate-700 border border-slate-200'
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
          label: '返回裁剪结果核查',
          href: buildCuttingRouteWithContext('summary', context),
        }
      : null
  }

  const sourceTargetMap: Partial<Record<NonNullable<CuttingDrillContext['sourcePageKey']>, CuttingNavigationTarget>> = {
    'special-processes': 'specialProcesses',
    'material-prep': 'materialPrep',
    'marker-spreading': 'markerSpreading',
    'fei-tickets': 'feiTickets',
    'cut-orders': 'cutOrders',
    'production-progress': 'productionProgress',
    'cut-piece-warehouse': 'cutPieceWarehouse',
    'fabric-warehouse': 'fabricWarehouse',
     'marker-list': 'markerPlanSources',
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
  return buildTransferBagArchiveQrValue(item) || buildTransferBagArchiveQrValue(getSourceMaster(item.bagId))
}

function resolveUsageBagQrValue(usage: TransferBagUsageItem): string {
  return buildTransferBagArchiveQrValue(usage.bagMaster)
    || buildTransferBagArchiveQrValue(getViewModel().mastersById[usage.bagId])
    || buildTransferBagArchiveQrValue(getSourceMaster(usage.bagId))
}

function getTransferBagQrValueByBagCode(bagCode: string): string {
  const normalizedBagCode = bagCode.trim()
  if (!normalizedBagCode) return ''
  const masterItem = getViewModel().masters.find((item) => item.bagCode === normalizedBagCode || item.carrierCode === normalizedBagCode) || null
  const sourceMaster = state.store.masters.find((item) => item.bagCode === normalizedBagCode || item.carrierCode === normalizedBagCode) || null
  return buildTransferBagArchiveQrValue(masterItem) || buildTransferBagArchiveQrValue(sourceMaster)
}

function buildTransferBagArchiveQrValue(master: (Partial<TransferBagMaster> & Partial<TransferBagMasterItem>) | null | undefined): string {
  if (!master) return ''
  const carrierId = master.carrierId || master.bagId || ''
  const carrierCode = master.carrierCode || master.bagCode || ''
  if (!carrierId || !carrierCode) return ''
  const carrierType = master.carrierType === 'box' || master.bagType === 'box' || master.bagType === '周转箱' ? 'box' : 'bag'
  return encodeCarrierQr({
    carrierId,
    carrierCode,
    carrierType,
    issuedAt: master.createdAt || '2026-03-24 08:00',
    ownershipFactoryId: master.ownershipFactoryId || '',
    ownershipFactoryName: master.ownershipFactoryName || '',
  }).qrValue
}

function renderTransferBagQrCell(bagCode: string, size = 64): string {
  const qrValue = getTransferBagQrValueByBagCode(bagCode)
  if (!qrValue) {
    return '<div class="text-xs text-muted-foreground">暂无二维码</div>'
  }
  return `
    <div class="flex flex-col items-start gap-1">
      <div class="inline-flex rounded-md border bg-white p-1 shadow-sm">
        ${renderRealQrPlaceholder({
          value: qrValue,
          size,
          title: `中转袋码 ${bagCode}`,
          label: `中转袋 ${bagCode} 二维码`,
        })}
      </div>
      <div class="text-[11px] text-muted-foreground">已生成</div>
    </div>
  `
}

function renderMasterStatusActions(options: {
  item: TransferBagMasterItem
  currentStatus: string
  detailHref: string
  historyHref: string
}): string {
  const { item, currentStatus, detailHref, historyHref } = options
  void currentStatus
  const actionButtons: string[] = [
    `<button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-nav="${escapeHtml(detailHref)}">查看详情</button>`,
    `<button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-nav="${escapeHtml(historyHref)}">查看使用周期</button>`,
    `<button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-nav="${escapeHtml(buildTransferBagLabelPrintLink(item.bagId))}">打印中转袋二维码</button>`,
  ]

  return actionButtons.join('')
}

function renderDetailMetric(label: string, value: string, valueClassName = 'text-foreground'): string {
  return `
    <div class="rounded-lg border bg-muted/10 px-3 py-2">
      <div class="text-xs text-muted-foreground">${escapeHtml(label)}</div>
      <div class="mt-1 text-sm font-semibold ${valueClassName}">${escapeHtml(value)}</div>
    </div>
  `
}

function renderTransferBagTraceabilityBlock(focusedUsage: TransferBagUsageItem | null): string {
  if (!focusedUsage) return ''
  const sourceMarkerSummary = focusedUsage.sourceMarkerNos.join(' / ') || '当前尚未绑定正式来源唛架'
  const sourceOrderSummary = focusedUsage.cutOrderNos.join(' / ') || '暂无'
  const sourceMarkerPlanSummary = focusedUsage.markerPlanNos.join(' / ') || '暂无'
  const isInboundTempUsage = focusedUsage.usageStage === 'INBOUND_TEMP'
  return `
    <section class="rounded-lg border ${focusedUsage.bagFirstSatisfied ? 'border-emerald-200 bg-emerald-50/30' : 'border-rose-200 bg-rose-50/40'} p-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 class="text-sm font-semibold text-foreground">${isInboundTempUsage ? '铺布 / 入仓暂存追溯' : '铺布 / 装袋追溯'}</h3>
          <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(focusedUsage.bagFirstRuleLabel)}</p>
        </div>
        ${renderTag(isInboundTempUsage ? '入仓暂存已记录' : focusedUsage.bagFirstSatisfied ? '交出装袋已记录' : '交出装袋待补', focusedUsage.bagFirstSatisfied ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-rose-100 text-rose-700 border border-rose-200')}
      </div>
      <div class="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        ${renderDetailMetric('来源铺布', focusedUsage.spreadingSessionNo || focusedUsage.spreadingSessionId || '当前尚未绑定正式铺布')}
        ${renderDetailMetric('来源唛架', sourceMarkerSummary)}
        ${renderDetailMetric('来源裁片单', sourceOrderSummary)}
        ${renderDetailMetric('来源唛架方案', sourceMarkerPlanSummary)}
      </div>
      <details class="mt-3 rounded-lg border bg-background/70 p-3" data-testid="transfer-bags-traceability-fold" data-default-open="collapsed">
        <summary class="cursor-pointer text-sm font-medium text-foreground">追溯信息</summary>
        <div class="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          ${renderDetailMetric('来源铺布记录', focusedUsage.spreadingSessionNo || focusedUsage.spreadingSessionId || '当前尚无来源铺布记录')}
          ${renderDetailMetric('铺布颜色摘要', focusedUsage.spreadingColorSummary || focusedUsage.colorSummary || '待补')}
          ${renderDetailMetric(isInboundTempUsage ? '入仓暂存规则' : '交出装袋规则', focusedUsage.bagFirstRuleLabel, focusedUsage.bagFirstSatisfied ? 'text-emerald-700' : 'text-rose-700')}
        </div>
      </details>
    </section>
  `
}

function getMasterTodoMeta(item: TransferBagMasterItem): { label: string; href: string } {
  if (item.visibleStatusKey === 'IDLE') {
    return {
      label: '开始装袋',
      href: buildTransferBagDetailRoute({ bagId: item.bagId, bagCode: item.bagCode, focusSection: 'usage-workbench' }),
    }
  }

  if (item.visibleStatusKey === 'IN_PROGRESS') {
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

  if (item.visibleStatusKey === 'READY_HANDOVER') {
    return {
      label: '交出',
      href: buildTransferBagDetailRoute({
        bagId: item.bagId,
        bagCode: item.bagCode,
        usageId: item.currentUsage?.usageId || undefined,
        usageNo: item.currentUsage?.usageNo || undefined,
        focusSection: 'usage-workbench',
      }),
    }
  }

  if (item.visibleStatusKey === 'HANDED_OVER') {
    return {
      label: '回收',
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
        <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="${escapeHtml(buildTransferBagListRoute())}">返回中转袋管理</button>
        ${sourceReturnButton}
        ${hasSummaryReturnContext(state.drillContext) ? '' : '<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="go-summary-index">查看裁剪结果核查</button>'}
      </div>
    `
  }

  return `
    <div class="flex flex-wrap items-center gap-2">
      ${sourceReturnButton || fallbackWarehouseButton}
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="go-fei-tickets-index">去打印菲票</button>
      ${hasSummaryReturnContext(state.drillContext) ? '' : '<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="go-summary-index">查看裁剪结果核查</button>'}
    </div>
  `
}

function renderReturnStatsCards(): string {
  const summary = getReturnViewModel().summary
  const scrapRecordCount = getCarrierManagementProjection().scrapRecords.filter(isTransferBagScrapRecord).length
  return renderCompactKpiGroup(`
      ${renderCompactKpiCard('已交出待回收', summary.waitingReturnUsageCount, '', 'text-orange-600')}
      ${renderCompactKpiCard('回收确认中', summary.inspectingUsageCount, '', 'text-cyan-600')}
      ${renderCompactKpiCard('已关闭使用周期数', summary.closedUsageCount, '', 'text-emerald-600')}
      ${renderCompactKpiCard('可用袋数', summary.reusableBagCount + summary.waitingCleaningBagCount + summary.waitingRepairBagCount, '', 'text-emerald-600')}
      ${renderCompactKpiCard('报废袋数', getViewModel().masters.filter((item) => item.currentStatus === 'DISABLED').length, '', 'text-slate-600')}
      ${renderCompactKpiCard('报废记录数', scrapRecordCount, '', 'text-rose-600')}
  `)
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
    summary: buildCuttingDrillSummary(state.drillContext) || '当前按外部上下文预填中转袋流转工作区',
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

function renderDialogShell(body: string, footer: string): string {
  if (!state.activeDialog) return ''
  return `
    <div class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/35 px-4 py-8" role="dialog" aria-modal="true">
      <section class="w-full max-w-5xl rounded-lg border bg-background shadow-xl">
        <div class="flex items-center justify-between border-b px-5 py-4">
          <h2 class="text-base font-semibold text-foreground">${escapeHtml(getDialogTitle())}</h2>
          <button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-transfer-bags-action="close-dialog">关闭</button>
        </div>
        <div class="space-y-4 px-5 py-4">
          ${body}
        </div>
        <div class="flex flex-wrap justify-end gap-2 border-t px-5 py-4">
          ${footer}
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="close-dialog">取消</button>
        </div>
      </section>
    </div>
  `
}

function renderFactoryOptions(selectedId: string): string {
  return getFactoryOptions()
    .map((factory) => `<option value="${escapeHtml(factory.id)}" ${selectedId === factory.id ? 'selected' : ''}>${escapeHtml(formatFactoryDisplayName(factory.name, factory.code || factory.id))}</option>`)
    .join('')
}

function renderBagOptions(selectedId: string): string {
  return getViewModel().masters
    .map((bag) => `<option value="${escapeHtml(bag.bagId)}" ${selectedId === bag.bagId ? 'selected' : ''}>${escapeHtml(`${bag.bagCode} / ${getCarrierMasterRecordMap()[bag.bagCode]?.currentStatus || bag.visibleStatusMeta.label}`)}</option>`)
    .join('')
}

function renderUsageOptions(selectedId: string, bagId?: string): string {
  return getViewModel().usages
    .filter((usage) => !bagId || usage.bagId === bagId)
    .map((usage) => `<option value="${escapeHtml(usage.usageId)}" ${selectedId === usage.usageId ? 'selected' : ''}>${escapeHtml(`${usage.usageNo} / ${usage.bagCode} / ${usage.usageStageLabel || '交出装袋'}`)}</option>`)
    .join('')
}

function renderNewMasterDialog(): string {
  return renderDialogShell(
    `
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label class="space-y-2">
          <span class="text-sm font-medium text-foreground">中转袋编号</span>
          <input class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" value="${escapeHtml(state.masterDraft.bagCode)}" placeholder="例如 BAG-HG-001" data-transfer-bags-master-draft-field="bagCode" />
        </label>
        <label class="space-y-2">
          <span class="text-sm font-medium text-foreground">归属工厂（货权）</span>
          <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-master-draft-field="ownershipFactoryId">${renderFactoryOptions(state.masterDraft.ownershipFactoryId)}</select>
        </label>
        <label class="space-y-2">
          <span class="text-sm font-medium text-foreground">载具类型</span>
          <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-master-draft-field="carrierType">
            <option value="bag" ${state.masterDraft.carrierType === 'bag' ? 'selected' : ''}>袋</option>
            <option value="box" ${state.masterDraft.carrierType === 'box' ? 'selected' : ''}>箱</option>
          </select>
        </label>
        <label class="space-y-2">
          <span class="text-sm font-medium text-foreground">容量</span>
          <input type="number" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" value="${escapeHtml(state.masterDraft.capacity)}" data-transfer-bags-master-draft-field="capacity" />
        </label>
        <label class="space-y-2">
          <span class="text-sm font-medium text-foreground">规格</span>
          <input class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" value="${escapeHtml(state.masterDraft.bagSpec)}" data-transfer-bags-master-draft-field="bagSpec" />
        </label>
        <label class="space-y-2">
          <span class="text-sm font-medium text-foreground">材质</span>
          <input class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" value="${escapeHtml(state.masterDraft.bagMaterial)}" data-transfer-bags-master-draft-field="bagMaterial" />
        </label>
        <label class="space-y-2">
          <span class="text-sm font-medium text-foreground">初始位置</span>
          <input class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" value="${escapeHtml(state.masterDraft.currentLocation)}" data-transfer-bags-master-draft-field="currentLocation" />
        </label>
        <label class="space-y-2">
          <span class="text-sm font-medium text-foreground">备注</span>
          <input class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" value="${escapeHtml(state.masterDraft.note)}" data-transfer-bags-master-draft-field="note" />
        </label>
      </div>
      <div class="rounded-lg border bg-muted/15 px-4 py-3 text-sm text-muted-foreground">保存后会生成正式中转袋档案二维码，二维码只包含袋码、载具类型和所属工厂等主档信息。</div>
    `,
    '<button type="button" class="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700" data-transfer-bags-action="save-master">保存中转袋</button>',
  )
}

function renderPackDialog(stage: 'INBOUND_TEMP' | 'HANDOVER_PACKING'): string {
  const isInbound = stage === 'INBOUND_TEMP'
  const bag = resolvePackBag()
  const scannedTicketInputs = parseTicketInputs(state.packDraft.ticketInput)
  const { tickets, missing } = resolvePackTickets()
  const carrierRecord = bag ? getCarrierMasterRecordMap()[bag.bagCode] : null
  const bagStatusLabel = carrierRecord?.currentStatus || (bag ? deriveTransferBagMasterStatus(bag.currentStatus).label : '待扫描')
  const ticketPreview = tickets.slice(0, 4).map((ticket) => ticket.ticketNo).join(' / ')
  const warehouseReady = Boolean(state.packDraft.warehouseArea.trim() && state.packDraft.locationCode.trim())
  const stepClass = (done: boolean, active: boolean) =>
    done
      ? 'border-emerald-200 bg-emerald-50/70'
      : active
        ? 'border-blue-200 bg-blue-50/60'
        : 'border-border bg-muted/10'
  const stepBadgeClass = (done: boolean, active: boolean) =>
    done
      ? 'bg-emerald-600 text-white'
      : active
        ? 'bg-blue-600 text-white'
        : 'bg-muted text-muted-foreground'
  const renderStep = (index: number, title: string, done: boolean, active: boolean, body: string) => `
    <section class="rounded-lg border p-4 ${stepClass(done, active)}">
      <div class="mb-3 flex items-center gap-2">
        <span class="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${stepBadgeClass(done, active)}">${index}</span>
        <h3 class="text-sm font-semibold text-foreground">${escapeHtml(title)}</h3>
      </div>
      ${body}
    </section>
  `
  return renderDialogShell(
    `
      <div class="space-y-3">
        ${renderStep(
          1,
          '扫码中转袋二维码',
          Boolean(bag),
          !bag,
          `
            <div class="grid gap-3 md:grid-cols-[1fr,1fr]">
              <label class="space-y-2">
                <span class="text-sm font-medium text-foreground">中转袋二维码 / 袋码</span>
                <input class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" value="${escapeHtml(state.packDraft.bagCodeInput)}" placeholder="扫描中转袋二维码，或输入 BAG-A-001" data-transfer-bags-pack-draft-field="bagCodeInput" />
              </label>
              <div class="rounded-lg border bg-background px-3 py-2 text-sm">
                <div><span class="text-muted-foreground">已选中转袋：</span><span class="font-medium text-foreground">${escapeHtml(bag?.bagCode || '待扫描')}</span></div>
                <div class="mt-1 text-xs text-muted-foreground">当前状态：${escapeHtml(bagStatusLabel)}</div>
                <div class="mt-1 text-xs text-muted-foreground">当前位置：${escapeHtml(bag?.currentLocation || '待确认')}</div>
              </div>
            </div>
          `,
        )}
        ${renderStep(
          2,
          '扫码菲票',
          tickets.length > 0 && !missing.length,
          Boolean(bag) && !tickets.length,
          `
            <label class="space-y-2">
              <span class="text-sm font-medium text-foreground">菲票码</span>
              <textarea class="min-h-[104px] w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="连续扫描多张菲票，或粘贴票号，使用空格 / 换行 / 顿号分隔" data-transfer-bags-pack-draft-field="ticketInput">${escapeHtml(state.packDraft.ticketInput)}</textarea>
            </label>
            <div class="mt-2 grid gap-2 text-xs text-muted-foreground md:grid-cols-3">
              <div>已扫描：<span class="font-medium text-foreground">${escapeHtml(String(scannedTicketInputs.length))}</span> 张</div>
              <div>已识别：<span class="font-medium text-foreground">${escapeHtml(String(tickets.length))}</span> 张</div>
              <div>未匹配：<span class="${missing.length ? 'font-medium text-amber-700' : 'font-medium text-foreground'}">${escapeHtml(String(missing.length))}</span> 张</div>
            </div>
            ${ticketPreview ? `<div class="mt-2 text-xs text-muted-foreground">示例：${escapeHtml(ticketPreview)}${tickets.length > 4 ? ' ...' : ''}</div>` : ''}
            ${missing.length ? `<div class="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">未匹配：${escapeHtml(missing.join('、'))}</div>` : ''}
          `,
        )}
        ${isInbound
          ? renderStep(
              3,
              '选择库区库位',
              Boolean(bag && tickets.length && !missing.length && warehouseReady),
              Boolean(bag && tickets.length && !missing.length),
              `
                <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <label class="space-y-2">
                    <span class="text-sm font-medium text-foreground">库区</span>
                    <input class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" value="${escapeHtml(state.packDraft.warehouseArea)}" placeholder="例如 裁片暂存区" data-transfer-bags-pack-draft-field="warehouseArea" />
                  </label>
                  <label class="space-y-2">
                    <span class="text-sm font-medium text-foreground">库位</span>
                    <input class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" value="${escapeHtml(state.packDraft.locationCode)}" placeholder="例如 A-01-01" data-transfer-bags-pack-draft-field="locationCode" />
                  </label>
                  <label class="space-y-2">
                    <span class="text-sm font-medium text-foreground">操作人</span>
                    <input class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" value="${escapeHtml(state.packDraft.operator)}" data-transfer-bags-pack-draft-field="operator" />
                  </label>
                  <label class="space-y-2">
                    <span class="text-sm font-medium text-foreground">备注</span>
                    <input class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" value="${escapeHtml(state.packDraft.note)}" data-transfer-bags-pack-draft-field="note" />
                  </label>
                </div>
              `,
            )
          : `
            <section class="rounded-lg border bg-muted/10 p-4">
              <h3 class="mb-3 text-sm font-semibold text-foreground">交出信息</h3>
              <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <label class="space-y-2">
                  <span class="text-sm font-medium text-foreground">绑定对象类型</span>
                  <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-pack-draft-field="boundObjectType">
                    ${['车缝任务', '特殊工艺交出单'].map((item) => `<option value="${escapeHtml(item)}" ${state.packDraft.boundObjectType === item ? 'selected' : ''}>${escapeHtml(item)}</option>`).join('')}
                  </select>
                </label>
                <label class="space-y-2">
                  <span class="text-sm font-medium text-foreground">绑定对象单号</span>
                  <input class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" value="${escapeHtml(state.packDraft.boundObjectNo)}" placeholder="可填车缝任务 / 交出单号" data-transfer-bags-pack-draft-field="boundObjectNo" />
                </label>
                <label class="space-y-2">
                  <span class="text-sm font-medium text-foreground">接收对象类型</span>
                  <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-pack-draft-field="receiverType">
                    ${['工厂', '仓库', '其他'].map((item) => `<option value="${escapeHtml(item)}" ${state.packDraft.receiverType === item ? 'selected' : ''}>${escapeHtml(item)}</option>`).join('')}
                  </select>
                </label>
                <label class="space-y-2">
                  <span class="text-sm font-medium text-foreground">接收对象</span>
                  <input class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" value="${escapeHtml(state.packDraft.receiverName)}" placeholder="未填则按待指定展示" data-transfer-bags-pack-draft-field="receiverName" />
                </label>
                <label class="space-y-2">
                  <span class="text-sm font-medium text-foreground">操作人</span>
                  <input class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" value="${escapeHtml(state.packDraft.operator)}" data-transfer-bags-pack-draft-field="operator" />
                </label>
                <label class="space-y-2 xl:col-span-3">
                  <span class="text-sm font-medium text-foreground">备注</span>
                  <input class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" value="${escapeHtml(state.packDraft.note)}" data-transfer-bags-pack-draft-field="note" />
                </label>
              </div>
            </section>
          `}
      </div>
      <div class="rounded-lg border bg-muted/15 px-4 py-3 text-sm text-muted-foreground">${isInbound ? '入仓暂存支持一个中转袋混装；确认后完成入仓暂存，中转袋进入所选库区库位。' : '交出确认后，中转袋直接进入“已交出待回收”。'}</div>
    `,
    `<button type="button" class="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700" data-transfer-bags-action="${isInbound ? 'save-inbound-pack' : 'save-handover-pack'}">${isInbound ? '确认入仓暂存' : '交出确认'}</button>`,
  )
}

function renderReturnDialog(): string {
  const usage = getSourceUsage(state.activeUsageId)
  return renderDialogShell(
    `
      ${usage ? `<div class="rounded-lg border bg-muted/15 px-4 py-3 text-sm text-muted-foreground">当前回收：${escapeHtml(usage.usageNo)} / ${escapeHtml(usage.bagCode)}</div>` : ''}
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label class="space-y-2"><span class="text-sm font-medium text-foreground">回收仓 / 回收点</span><input class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" value="${escapeHtml(state.returnDraft.returnWarehouseName)}" data-transfer-bags-return-draft-field="returnWarehouseName" /></label>
        <label class="space-y-2"><span class="text-sm font-medium text-foreground">回收时间</span><input class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" value="${escapeHtml(state.returnDraft.returnAt)}" data-transfer-bags-return-draft-field="returnAt" /></label>
        <label class="space-y-2"><span class="text-sm font-medium text-foreground">回收人</span><input class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" value="${escapeHtml(state.returnDraft.returnedBy)}" data-transfer-bags-return-draft-field="returnedBy" /></label>
        <label class="space-y-2"><span class="text-sm font-medium text-foreground">回收确认人</span><input class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" value="${escapeHtml(state.returnDraft.receivedBy)}" data-transfer-bags-return-draft-field="receivedBy" /></label>
        <label class="space-y-2"><span class="text-sm font-medium text-foreground">差异类型</span><select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-return-draft-field="discrepancyType">
          ${[
            ['NONE', '无差异'],
            ['QTY_MISMATCH', '数量差异'],
            ['DAMAGED_BAG', '中转袋破损'],
            ['LATE_RETURN', '逾期未回收'],
            ['MISSING_RECORD', '缺记录'],
          ].map(([value, label]) => `<option value="${value}" ${state.returnDraft.discrepancyType === value ? 'selected' : ''}>${label}</option>`).join('')}
        </select></label>
        <label class="space-y-2 xl:col-span-3"><span class="text-sm font-medium text-foreground">差异说明</span><input class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" value="${escapeHtml(state.returnDraft.discrepancyNote)}" data-transfer-bags-return-draft-field="discrepancyNote" /></label>
        <label class="space-y-2"><span class="text-sm font-medium text-foreground">袋况</span><select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-condition-field="conditionStatus"><option value="GOOD" ${state.conditionDraft.conditionStatus === 'GOOD' ? 'selected' : ''}>完好</option><option value="MINOR_DAMAGE" ${state.conditionDraft.conditionStatus === 'MINOR_DAMAGE' ? 'selected' : ''}>轻微破损可继续使用</option><option value="SEVERE_DAMAGE" ${state.conditionDraft.conditionStatus === 'SEVERE_DAMAGE' ? 'selected' : ''}>报废</option></select></label>
        <label class="space-y-2"><span class="text-sm font-medium text-foreground">回收结果</span><select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-condition-field="reusableDecision"><option value="REUSABLE" ${state.conditionDraft.reusableDecision === 'REUSABLE' ? 'selected' : ''}>可继续使用</option><option value="DISABLED" ${state.conditionDraft.reusableDecision === 'DISABLED' ? 'selected' : ''}>报废</option></select></label>
        <label class="space-y-2 md:col-span-2"><span class="text-sm font-medium text-foreground">报废说明</span><input class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" value="${escapeHtml(state.conditionDraft.damageType)}" data-transfer-bags-condition-field="damageType" /></label>
        <label class="space-y-2 md:col-span-2 xl:col-span-4"><span class="text-sm font-medium text-foreground">回收备注</span><input class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" value="${escapeHtml(state.returnDraft.note)}" data-transfer-bags-return-draft-field="note" /></label>
      </div>
    `,
    '<button type="button" class="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700" data-transfer-bags-action="save-return">确认回收</button>',
  )
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
  const summary = buildTransferBagParentChildSummary(bindings)
  return {
    returnReceiptId: `return-${usage.usageId}`,
    cycleId: usage.cycleId,
    cycleNo: usage.cycleNo,
    carrierId: bag.carrierId,
    carrierCode: bag.carrierCode,
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
    returnedFinishedQty: summary.quantityTotal,
    returnedTicketCountSummary: bindings.length,
    returnedCutOrderCount: uniqueStrings(bindings.map((item) => item.cutOrderNo)).length,
    discrepancyType: state.returnDraft.discrepancyType,
    discrepancyNote: state.returnDraft.discrepancyNote.trim(),
    note: state.returnDraft.note.trim(),
  }
}

function buildConditionRecordFromState(usage: TransferBagUsage, bag: TransferBagMaster): TransferBagConditionRecord {
  return {
    conditionRecordId: `condition-${usage.usageId}`,
    cycleId: usage.cycleId,
    carrierId: bag.carrierId,
    carrierCode: bag.carrierCode,
    usageId: usage.usageId,
    bagId: bag.bagId,
    bagCode: bag.bagCode,
    conditionStatus: state.conditionDraft.conditionStatus,
    cleanlinessStatus: state.conditionDraft.cleanlinessStatus,
    damageType: state.conditionDraft.damageType.trim(),
    repairNeeded: state.conditionDraft.repairNeeded,
    reusableDecision: state.conditionDraft.reusableDecision,
    inspectedAt: nowText(),
    inspectedBy: state.returnDraft.receivedBy.trim() || '中转袋工作台',
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
        item.cutOrderNos.join(' '),
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
    setFeedback('warning', '请先选择一个已交出待回收使用周期。')
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
  state.store.returnAuditTrail.push(
    buildBagReturnAuditTrail({
      cycleId: usage.cycleId,
      action: '回收登记',
      actionAt: nowText(),
      actionBy: '中转袋工作台',
      payloadSummary: `${usage.usageNo} 已进入回收流程`,
      note: '已打开回收登记表单，等待填写回收结果。',
    }),
  )
  refreshDerivedState()
  persistStore()
  setFeedback('success', `${usage.usageNo} 已带入回收确认。`)
  return true
}

function clearReturnDraft(): boolean {
  resetReturnDraft(state.activeUsageId)
  setFeedback('success', '回收确认草稿已重置。')
  return true
}

function completeReturnInspection(targetUsageId?: string): boolean {
  const usage = getSourceUsage(targetUsageId || state.activeUsageId)
  if (!usage) {
    setFeedback('warning', '请先选择一个使用周期，再填写回收确认信息。')
    return true
  }
  const bag = getSourceMaster(usage.bagId)
  if (!bag) {
    setFeedback('warning', '当前使用周期缺少中转袋主档，不能回收。')
    return true
  }

  const receipt = buildReturnReceiptFromState(usage, bag)
  const validation = validateReturnReceiptPayload({
    usage,
    bag,
    receipt,
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

  const condition = buildConditionRecordFromState(usage, bag)
  const conditionIndex = state.store.conditionRecords.findIndex((item) => item.usageId === usage.usageId)
  if (conditionIndex >= 0) {
    state.store.conditionRecords[conditionIndex] = condition
  } else {
    state.store.conditionRecords.push(condition)
  }

  const closure = closeTransferBagUsageCycle({
    usage,
    bag,
    receipt,
    condition,
    nowText: receipt.returnAt,
    closedBy: receipt.receivedBy || '中转袋工作台',
  })
  const closureIndex = state.store.closureResults.findIndex((item) => item.usageId === usage.usageId)
  if (closureIndex >= 0) {
    state.store.closureResults[closureIndex] = closure
  } else {
    state.store.closureResults.push(closure)
  }

  usage.usageStatus = closure.closureStatus
  usage.cycleStatus = closure.closureStatus
  usage.signoffStatus = usage.signoffStatus === 'SIGNED' ? usage.signoffStatus : 'SIGNED'
  usage.returnedAt = receipt.returnAt
  usage.returnedBy = receipt.returnedBy
  usage.returnWarehouseName = receipt.returnWarehouseName
  usage.note = closure.reason
  bag.currentStatus = closure.nextBagStatus === 'REUSABLE' ? 'IDLE' : closure.nextBagStatus
  bag.currentLocation = closure.nextBagStatus === 'DISABLED' ? '报废区' : receipt.returnWarehouseName

  state.store.returnAuditTrail.push(
    buildBagReturnAuditTrail({
      cycleId: usage.cycleId,
      action: '完成回收',
      actionAt: receipt.returnAt,
      actionBy: receipt.receivedBy,
      payloadSummary: `${receipt.bagCode} 已完成回收登记`,
      note: receipt.note || closure.reason,
    }),
  )

  refreshDerivedState()
  persistStore()
  closeActiveDialog()
  setFeedback(closure.closureStatus === 'SCRAP_CLOSED' ? 'warning' : 'success', `${usage.usageNo} 已完成回收，${bag.bagCode} 当前状态：${deriveTransferBagMasterStatus(bag.currentStatus).label}。`)
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
    closedBy: receipt.receivedBy || '中转袋工作台',
  })
  const closureIndex = state.store.closureResults.findIndex((item) => item.usageId === usage.usageId)
  if (closureIndex >= 0) {
    state.store.closureResults[closureIndex] = closure
  } else {
    state.store.closureResults.push(closure)
  }

  usage.usageStatus = closure.closureStatus
  usage.cycleStatus = closure.closureStatus
  usage.note = closure.reason
  bag.currentStatus = closure.nextBagStatus === 'DISABLED' ? 'DISABLED' : 'IDLE'
  const nextBagVisibleLabel = closure.nextBagStatus === 'DISABLED' ? '报废' : '可用'
  bag.currentLocation = closure.nextBagStatus === 'DISABLED' ? '报废区' : '裁片仓空袋区'

  state.store.returnAuditTrail.push(
    buildBagReturnAuditTrail({
      cycleId: usage.cycleId,
      action: '关闭本次周转',
      actionAt: closure.closedAt,
      actionBy: closure.closedBy,
      payloadSummary: `${usage.usageNo} 已关闭，口袋 -> ${nextBagVisibleLabel}`,
      note: closure.reason,
    }),
  )

  refreshDerivedState()
  persistStore()
  setFeedback(
    closure.warningMessages.length ? 'warning' : 'success',
    closure.warningMessages.length
      ? `${usage.usageNo} 已报废关闭：${closure.warningMessages.join('；')}`
      : `${usage.usageNo} 已关闭，${bag.bagCode} 已返回“${nextBagVisibleLabel}”状态。`,
  )
  return true
}

function createUsage(): boolean {
  setFeedback('warning', '当前无需手动创建周转。请直接扫描首张菲票，系统会自动开始本次周转。')
  return true
}

function bindTicketByInput(): boolean {
  const ticket = getSelectedTicketRecord()
  if (!state.draft.ticketInput.trim()) {
    setFeedback('warning', '请先扫描菲票。')
    return true
  }
  if (!ticket) {
    setFeedback('warning', '当前票号不存在，请先确认菲票记录。')
    return true
  }

  let usage = getSourceUsage(state.activeUsageId)
  if (!usage) {
    usage = ensureUsageAutoCreatedForTicket(ticket)
    if (!usage) return true
  }
  if (usage.usageStatus === 'DISPATCHED' || usage.usageStatus === 'PENDING_SIGNOFF') {
    setFeedback('warning', `${usage.usageNo} 已进入交出阶段，不能继续修改装袋内容。`)
    return true
  }
  const context = resolveLockedUsageContext(usage, ticket)
  if (!context.ok || !context.sewingTask) {
    setFeedback('warning', context.reason || '请确认袋内菲票属于本次交出记录。')
    return true
  }
  const validation = validateTicketBindingEligibility({
    ticket,
    usage,
    sewingTask: context.sewingTask,
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
    cutOrderId: ticket.cutOrderId,
    cutOrderNo: ticket.cutOrderNo,
    markerPlanNo: ticket.markerPlanNo,
    productionOrderNo: ticket.productionOrderNo,
    唛架方案No: ticket.markerPlanNo,
    qty: ticket.qty,
    garmentQty: ticket.qty,
    boundAt: nowText(),
    boundBy: '中转袋工作台',
    operator: '中转袋工作台',
    status: 'BOUND',
      note: '先扫中转袋父码，再扫菲票子码，已建立正式父子映射。',
  })
  if (usage.usageStatus === 'DRAFT') {
    usage.usageStatus = 'PACKING'
    usage.cycleStatus = 'PACKING'
  }
  state.store.auditTrail.push(
    buildBagUsageAuditTrail({
      usageId: usage.usageId,
      action: '扫码装袋',
      actionAt: nowText(),
      actionBy: '中转袋工作台',
      note: `${usage.bagCode} -> ${ticket.ticketNo} 已装袋，并锁定到 ${usage.sewingFactoryName} / ${usage.sewingTaskNo}。`,
    }),
  )
  state.draft.ticketInput = ''
  refreshDerivedState()
  persistStore()
  setFeedback('success', `${ticket.ticketNo} 已装入 ${usage.bagCode}。`)
  return true
}

function importCandidateTickets(targetUsageId?: string): boolean {
  let usage = getSourceUsage(targetUsageId || state.activeUsageId)
  const candidates = getCandidateTickets()
  if (!usage) {
    const firstCandidate = candidates[0]
    if (!firstCandidate) {
      setFeedback('warning', '当前没有可导入的候选菲票。')
      return true
    }
    usage = ensureUsageAutoCreatedForTicket(firstCandidate)
    if (!usage) return true
  }
  const context = resolveLockedUsageContext(usage, null)
  if (!context.ok || !context.sewingTask) {
    setFeedback('warning', context.reason || '当前周转上下文不完整，不能导入候选菲票。')
    return true
  }
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
      sewingTask: context.sewingTask,
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
      cutOrderId: ticket.cutOrderId,
      cutOrderNo: ticket.cutOrderNo,
      markerPlanNo: ticket.markerPlanNo,
      productionOrderNo: ticket.productionOrderNo,
      唛架方案No: ticket.markerPlanNo,
      qty: ticket.qty,
      garmentQty: ticket.qty,
      boundAt: nowText(),
      boundBy: '中转袋工作台',
      operator: '中转袋工作台',
      status: 'BOUND',
      note: '通过候选菲票批量建立正式父子映射。',
    })
    if (usage.usageStatus === 'DRAFT') {
      usage.usageStatus = 'PACKING'
      usage.cycleStatus = 'PACKING'
    }
    successCount += 1
  })

  if (successCount) {
    state.store.auditTrail.push(
      buildBagUsageAuditTrail({
        usageId: usage.usageId,
        action: '导入候选菲票',
        actionAt: nowText(),
        actionBy: '中转袋工作台',
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
    setFeedback('warning', `${usage.usageNo} 已进入交出后阶段，不能移除袋内映射。`)
    return true
  }
  state.store.bindings = state.store.bindings.filter((item) => item.bindingId !== bindingId)
  state.store.auditTrail.push(
    buildBagUsageAuditTrail({
      usageId: binding.usageId,
      action: '移除绑定',
      actionAt: nowText(),
      actionBy: '中转袋工作台',
      note: `${binding.ticketNo} 已从 ${binding.bagCode} 中移除。`,
    }),
  )
  refreshDerivedState()
  persistStore()
  setFeedback('success', `${binding.ticketNo} 已移除。`)
  return true
}

function printManifest(usageId: string | undefined): boolean {
  if (!usageId) return false
  const usage = getViewModel().usagesById[usageId]
  if (!usage) return false
  state.store.auditTrail.push(
    buildBagUsageAuditTrail({
      usageId,
      action: '打印中转袋档案二维码',
      actionAt: nowText(),
      actionBy: '中转袋工作台',
      note: `${usage.bagCode} 已进入中转袋档案二维码打印预览。`,
    }),
  )
  refreshDerivedState()
  persistStore()

  appStore.navigate(buildTransferBagLabelPrintLink(usage.bagId || usage.bagCode))
  setFeedback('success', `${usage.bagCode} 的中转袋档案二维码已进入统一打印预览。`)
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
    setFeedback('warning', `${usage.usageNo} 需先完成装袋，再交出。`)
    return true
  }
  if (nextStatus === 'WAITING_RETURN' && !['DISPATCHED', 'PENDING_SIGNOFF', 'WAITING_RETURN'].includes(usage.usageStatus)) {
    setFeedback('warning', `${usage.usageNo} 当前还不能回收，请先完成交出。`)
    return true
  }

  const currentSummary = buildTransferBagParentChildSummary(state.store.bindings.filter((item) => item.usageId === usage.usageId))

  usage.usageStatus = nextStatus
  usage.cycleStatus = nextStatus
  if (nextStatus === 'READY_TO_DISPATCH') {
    usage.finishedPackingAt = nowText()
    usage.note = '当前使用周期已完成核对，等待交出。'
  }
  if (nextStatus === 'DISPATCHED') {
    usage.dispatchAt = nowText()
    usage.dispatchBy = '中转袋工作台'
    usage.signoffStatus = 'WAITING'
    usage.note = `当前使用周期已交出，共 ${currentSummary.ticketCount} 张菲票。`
  }
  if (nextStatus === 'WAITING_RETURN') {
    usage.signoffStatus = 'SIGNED'
    usage.note = '当前使用周期已交出，等待回收确认。'
  }
  if (nextStatus === 'PENDING_SIGNOFF') {
    usage.signoffStatus = 'WAITING'
    usage.note = '当前使用周期已交出，等待回收确认。'
  }

  state.store.auditTrail.push(
    buildBagUsageAuditTrail({
      usageId: usage.usageId,
      action:
        nextStatus === 'READY_TO_DISPATCH'
            ? '完成装袋'
            : nextStatus === 'DISPATCHED'
              ? '交出'
            : nextStatus === 'WAITING_RETURN'
              ? '进入回收确认'
              : '更新交出状态',
      actionAt: nowText(),
      actionBy: '中转袋工作台',
      note: `${usage.usageNo} 已更新为 ${nextStatus === 'DISPATCHED' ? '已交出' : deriveTransferBagUsageStatus(nextStatus).label}。`,
    }),
  )
  refreshDerivedState()
  persistStore()
  setFeedback('success', `${usage.usageNo} 已更新为“${nextStatus === 'DISPATCHED' ? '已交出' : deriveTransferBagUsageStatus(nextStatus).label}”。`)
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
    [getCanonicalCuttingPath('cut-orders')]: 'cutOrders',
    [getCanonicalCuttingPath('summary')]: 'summary',
    [getCanonicalCuttingPath('fei-tickets')]: 'feiTickets',
    [getCanonicalCuttingPath('cut-piece-warehouse')]: 'cutPieceWarehouse',
  }
  const target = targetMap[path]
  if (target) {
    const context = buildCuttingDrillContext(payload, 'transfer-bags', {
      autoOpenDetail: true,
      bagCode: payload.bagCode,
      usageNo: payload.usageNo,
      cutOrderNo: payload.cutOrderNo,
      markerPlanNo: payload.markerPlanNo || payload['唛架方案No'],
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
    if (field === 'useStage') {
      state.masterUseStage = input.value as MasterUseStageFilter
      resetMasterPagination()
    }
    if (field === 'location') {
      state.masterLocationKeyword = input.value
      resetMasterPagination()
    }
    if (field === 'boundObject') {
      state.masterBoundObjectKeyword = input.value
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

  const masterDraftFieldNode = target.closest<HTMLElement>('[data-transfer-bags-master-draft-field]')
  if (masterDraftFieldNode) {
    const field = masterDraftFieldNode.dataset.transferBagsMasterDraftField as MasterDraftField | undefined
    if (!field) return false
    const input = masterDraftFieldNode as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    state.masterDraft = {
      ...state.masterDraft,
      [field]: input.value,
    }
    return true
  }

  const packDraftFieldNode = target.closest<HTMLElement>('[data-transfer-bags-pack-draft-field]')
  if (packDraftFieldNode) {
    const field = packDraftFieldNode.dataset.transferBagsPackDraftField as PackDraftField | undefined
    if (!field) return false
    const input = packDraftFieldNode as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    state.packDraft = {
      ...state.packDraft,
      [field]: input.value,
    }
    if (field === 'bagId') {
      const bag = getSourceMaster(input.value)
      state.packDraft.bagCodeInput = bag?.bagCode || state.packDraft.bagCodeInput
    }
    if (field === 'bagCodeInput') {
      const bag = resolveCarrierScanInput(input.value, state.store)
      state.packDraft.bagId = bag?.bagId || ''
    }
    if (field === 'boundObjectNo') {
      const task = getSelectedSewingTaskByNo(input.value)
      if (task) {
        state.packDraft.receiverName = formatFactoryDisplayName(task.sewingFactoryName)
        state.packDraft.receiverType = '工厂'
      }
    }
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-transfer-bags-action]')
  const action = actionNode?.dataset.transferBagsAction
  if (!action) return false

  if (action === 'clear-prefill') return clearPrefill()
  if (action === 'close-dialog') return closeActiveDialog()
  if (action === 'new-master') {
    resetMasterDraft()
    state.activeDialog = 'new-master'
    return true
  }
  if (action === 'save-master') return saveMasterDraft()
  if (action === 'open-inbound-pack') {
    resetPackDraft('INBOUND_TEMP', actionNode.dataset.bagId)
    state.activeDialog = 'inbound-pack'
    return true
  }
  if (action === 'open-handover-pack') {
    resetPackDraft('HANDOVER_PACKING', actionNode.dataset.bagId)
    state.activeDialog = 'handover-pack'
    return true
  }
  if (action === 'save-inbound-pack') return savePackDraft('INBOUND_TEMP')
  if (action === 'save-handover-pack') return savePackDraft('HANDOVER_PACKING')
  if (action === 'complete-inbound-storage') return completeInboundStorage(actionNode.dataset.usageId || state.activeUsageId || undefined)
  if (action === 'release-inbound-bag') return releaseInboundBag(actionNode.dataset.usageId || state.activeUsageId || undefined)
  if (action === 'open-return') {
    const usageId = actionNode.dataset.usageId || state.activeUsageId || ''
    if (usageId) syncUsageSelection(usageId)
    resetReturnDraft(usageId)
    state.activeDialog = 'return'
    return true
  }
  if (action === 'save-return') return saveReturnDraft()
  if (action === 'prepare-return') {
    const usageId = actionNode.dataset.usageId || state.activeUsageId || ''
    if (usageId) syncUsageSelection(usageId)
    resetReturnDraft(usageId)
    state.activeDialog = 'return'
    return true
  }
  if (action === 'clear-return-draft') return clearReturnDraft()
  if (action === 'close-usage-cycle') {
    return closeUsageCycleAction(actionNode.dataset.usageId || state.activeUsageId || undefined)
  }
  if (action === 'focus-scan-query') {
    setFeedback('success', '请在袋码筛选中输入或扫描中转袋码。')
    return true
  }
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
      setFeedback('warning', '未匹配到该中转袋码，请检查载具编码。')
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
  if (action === 'confirm-handover') return confirmHandoverPacking(actionNode.dataset.usageId || state.activeUsageId || undefined)
  if (action === 'mark-ready') return updateUsageStatus(actionNode.dataset.usageId || state.activeUsageId || undefined, 'READY_TO_DISPATCH')
  if (action === 'mark-dispatched') return updateUsageStatus(actionNode.dataset.usageId || state.activeUsageId || undefined, 'DISPATCHED')
  if (action === 'complete-return-inspection') return completeReturnInspection(actionNode.dataset.usageId || state.activeUsageId || undefined)

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
  if (action === 'go-cut-orders') {
    const usage = getViewModel().usagesById[actionNode.dataset.usageId || state.activeUsageId || '']
    if (!usage) return false
    return navigateByPayload(usage.navigationPayload.cutOrders, getCanonicalCuttingPath('cut-orders'))
  }
  if (action === 'go-summary') {
    const usage = getViewModel().usagesById[actionNode.dataset.usageId || state.activeUsageId || '']
    if (!usage) return false
    return navigateByPayload(usage.navigationPayload.summary, getCanonicalCuttingPath('summary'))
  }

  return false
}
