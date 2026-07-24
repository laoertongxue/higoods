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
} from './state'

export function resolveCarrierScanInput(input: string, store: TransferBagStore): TransferBagMaster | null {
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

export function resolveFeiTicketScanInput(input: string, ticketRecords: TransferBagsProjection['ticketRecords']) {
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

export function hasExplicitUsageContext(prefilter: TransferBagPrefilter | null): boolean {
  return Boolean(prefilter?.usageId || prefilter?.usageNo)
}

export function hasExplicitBagContext(prefilter: TransferBagPrefilter | null): boolean {
  return Boolean(prefilter?.bagId || prefilter?.bagCode)
}

export function hasSourceContext(prefilter: TransferBagPrefilter | null): boolean {
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

export function buildSourceOnlyPrefilter(prefilter: TransferBagPrefilter | null): TransferBagPrefilter | null {
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

export function hasResolverLookupContext(prefilter: TransferBagPrefilter | null): boolean {
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

export function resetMasterDraft(): void {
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

export function resetPackDraft(stage: 'INBOUND_TEMP' | 'HANDOVER_PACKING', bagId?: string): void {
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

export function getDialogTitle(): string {
  if (state.activeDialog === 'new-master') return '新增中转袋'
  if (state.activeDialog === 'inbound-pack') return '入仓暂存装袋'
  if (state.activeDialog === 'handover-pack') return '交出装袋'
  if (state.activeDialog === 'return') return '回收确认'
  return '中转袋流转'
}

export function syncReusableDecisionSuggestion(): void {
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

export function matchPrefilter(itemValues: Array<string | undefined>, search?: string): boolean {
  if (!search) return true
  return itemValues.some((value) => value?.includes(search))
}

export function matchesUsagePrefilter(item: TransferBagUsageItem, prefilter: TransferBagPrefilter | null = state.prefilter): boolean {
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

export function matchesBindingPrefilter(item: TransferBagBindingItem, prefilter: TransferBagPrefilter | null = state.prefilter): boolean {
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

export function findMatchingUsages(prefilter: TransferBagPrefilter | null, viewModel = getViewModel()): TransferBagUsageItem[] {
  if (!prefilter || !hasResolverLookupContext(prefilter)) return []
  return viewModel.usages.filter((item) => matchesUsagePrefilter(item, prefilter))
}

export function findMatchingBindings(prefilter: TransferBagPrefilter | null, viewModel = getViewModel()): TransferBagBindingItem[] {
  if (!prefilter || !hasResolverLookupContext(prefilter)) return []
  return viewModel.bindings.filter((item) => matchesBindingPrefilter(item, prefilter))
}

export function findMatchingMasters(prefilter: TransferBagPrefilter | null, viewModel = getViewModel()): TransferBagMasterItem[] {
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

export function getCarrierMasterRecordMap(): Record<string, TransferBagCarrierMasterRecord> {
  if (carrierManagementProjectionCache?.version !== projectionVersion) getCarrierManagementProjection()
  return carrierManagementProjectionCache?.masterRecordMap || {}
}

export function matchesMasterStatusFilter(
  item: TransferBagMasterItem,
  filter: MasterStatusFilter,
  carrierRecordsByBagCode = getCarrierMasterRecordMap(),
): boolean {
  if (filter === 'ALL') return true
  return carrierRecordsByBagCode[item.bagCode]?.currentStatus === filter
}

export function getMasterBaseItems(carrierRecordsByBagCode = getCarrierMasterRecordMap()) {
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

export function getFilteredMasters(baseItems = getMasterBaseItems(), carrierRecordsByBagCode = getCarrierMasterRecordMap()) {
  return baseItems.filter((item) => matchesMasterStatusFilter(item, state.masterStatus, carrierRecordsByBagCode))
}

export function resetMasterPagination(): void {
  state.masterPage = 1
}

export function getPagedMasters() {
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

export function getFilteredUsages() {
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

export function getFilteredBindings() {
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

export function getPrefilterFromQuery(): TransferBagPrefilter | null {
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

export function getActiveMaster(): TransferBagMasterItem | null {
  if (!state.activeMasterId) return null
  return getViewModel().mastersById[state.activeMasterId] ?? null
}

export function getActiveUsage(): TransferBagUsageItem | null {
  if (!state.activeUsageId) return null
  return getViewModel().usagesById[state.activeUsageId] ?? null
}

export function getSourceMaster(bagId: string | null): TransferBagMaster | null {
  if (!bagId) return null
  return state.store.masters.find((item) => item.bagId === bagId) ?? null
}

export function getSourceUsage(usageId: string | null): TransferBagUsage | null {
  if (!usageId) return null
  return state.store.usages.find((item) => item.usageId === usageId) ?? null
}

export function getSelectedBag(): TransferBagMaster | null {
  const bagId = state.draft.bagId || getActiveUsage()?.bagId || getActiveMaster()?.bagId || ''
  if (bagId) return getSourceMaster(bagId)
  return resolveCarrierScanInput(state.draft.bagCodeInput, state.store)
}

export function getSelectedSewingTask() {
  return state.draft.sewingTaskId ? getViewModel().sewingTasksById[state.draft.sewingTaskId] || null : null
}

export function getCandidateTickets(): TransferBagTicketCandidate[] {
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

export function getSelectedTicketRecord(): TransferBagTicketCandidate | null {
  const record = resolveFeiTicketScanInput(state.draft.ticketInput, getProjection().ticketRecords)
  if (!record) return null
  return getViewModel().ticketCandidatesById[record.ticketRecordId] ?? null
}

export function resolveLockedUsageContext(
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

export function ensureUsageAutoCreatedForTicket(ticket: TransferBagTicketCandidate): TransferBagUsage | null {
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

export function resolveTransferBagLandingFromPrefilter(
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

export function buildTransferBagLandingBanner(
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

export function refreshDerivedState(): void {
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

export function buildNextUsageNo(now = nowText()): string {
  const dateKey = now.slice(0, 10).replaceAll('-', '')
  const sameDay = state.store.usages
    .map((item) => item.usageNo)
    .filter((item) => item.startsWith(`TBU-${dateKey}`))
    .map((item) => Number.parseInt(item.split('-').pop() || '0', 10))
    .filter((item) => Number.isFinite(item))
  return `TBU-${dateKey}-${String(Math.max(0, ...sameDay) + 1).padStart(3, '0')}`
}

export function resolvePackBag(): TransferBagMaster | null {
  if (state.packDraft.bagId) return getSourceMaster(state.packDraft.bagId)
  return resolveCarrierScanInput(state.packDraft.bagCodeInput, state.store)
}

export function parseTicketInputs(value: string): string[] {
  return uniqueStrings(value.split(/[\s,，;；、]+/).map((item) => item.trim()).filter(Boolean))
}

export function resolvePackTickets(): { tickets: TransferBagTicketCandidate[]; missing: string[] } {
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

export function getSelectedSewingTaskByNo(taskNo: string) {
  return getViewModel().sewingTasks.find((item) => item.sewingTaskNo === taskNo || item.sewingTaskId === taskNo) || null
}

export function buildManualUsage(options: {
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

export function pushTicketBindings(usage: TransferBagUsage, tickets: TransferBagTicketCandidate[], now: string, note: string): void {
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

export function saveMasterDraft(): boolean {
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

export function savePackDraft(stage: 'INBOUND_TEMP' | 'HANDOVER_PACKING'): boolean {
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

export function confirmHandoverPacking(targetUsageId?: string): boolean {
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

export function completeInboundStorage(targetUsageId?: string): boolean {
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

export function releaseInboundBag(targetUsageId?: string): boolean {
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

export function saveReturnDraft(): boolean {
  const usage = getSourceUsage(state.activeUsageId)
  if (!usage) {
    setFeedback('warning', '请先选择待回收的使用记录。')
    return true
  }
  return completeReturnInspection(usage.usageId)
}

export function syncPrefilterFromQuery(): void {
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

export function resetReturnDraft(usageId?: string | null): void {
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
