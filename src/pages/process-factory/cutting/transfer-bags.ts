import { appStore } from '../../../state/store.ts'
import { renderRealQrPlaceholder } from '../../../components/real-qr.ts'
import { escapeHtml, formatDateTime } from '../../../utils.ts'
import {
  CUTTING_FEI_TICKET_RECORDS_STORAGE_KEY,
} from '../../../data/fcs/cutting/storage/fei-tickets-storage.ts'
import {
  paginateItems,
  renderCompactKpiCard,
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
  createTransferBagDispatchManifest,
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
} from './transfer-bag-return-model.ts'
import { renderMaterialIdentityBlock } from './material-identity.ts'

type MasterStatusFilter = 'ALL' | TransferBagCarrierCurrentStatus
type MasterUseStageFilter = 'ALL' | TransferBagCarrierUseStage

type UsageStatusFilter = 'ALL' | TransferBagUsageStatusKey
type ReturnStatusFilter = 'ALL' | 'WAITING_RETURN' | 'RETURN_INSPECTING' | 'CLOSED' | 'EXCEPTION_CLOSED'
type TransferBagListTab = 'masters' | 'inbound' | 'handover' | 'recovery' | 'abnormal'
type TransferBagDetailTab = 'basic' | 'current' | 'history' | 'items' | 'recovery' | 'logs'
type TransferBagBaggingStepId = 'scan' | 'review' | 'handover'
type TransferBagBaggingStepState = 'pending' | 'active' | 'done' | 'locked'
type TransferBagDialog =
  | 'new-master'
  | 'inbound-pack'
  | 'handover-pack'
  | 'return'
  | 'abnormal'
  | 'handle-abnormal'
type TransferBagsProjection = ReturnType<typeof buildTransferBagsProjection>
type TransferBagCarrierManagementProjection = ReturnType<typeof buildTransferBagCarrierManagementProjection>
type TransferBagCarrierMasterRecord = TransferBagCarrierManagementProjection['masterRecords'][number]

type FeedbackTone = 'success' | 'warning'

type MasterFilterField = 'keyword' | 'status' | 'useStage' | 'location' | 'boundObject'
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
type MasterDraftField = 'bagCode' | 'carrierType' | 'capacity' | 'bagSpec' | 'bagMaterial' | 'ownershipFactoryId' | 'currentLocation' | 'note'
type PackDraftField =
  | 'bagId'
  | 'bagCodeInput'
  | 'ticketInput'
  | 'warehouseArea'
  | 'locationCode'
  | 'operator'
  | 'boundObjectType'
  | 'boundObjectNo'
  | 'receiverType'
  | 'receiverName'
  | 'note'
type AbnormalDraftField = 'bagId' | 'usageId' | 'abnormalType' | 'description' | 'reportedBy' | 'handlingDecision'

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
  masterUseStage: MasterUseStageFilter
  masterLocationKeyword: string
  masterBoundObjectKeyword: string
  masterPage: number
  masterPageSize: number
  activeListTab: TransferBagListTab
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
  activeDialog: TransferBagDialog | null
  activeAbnormalId: string
  masterDraft: {
    bagCode: string
    carrierType: 'bag' | 'box'
    capacity: string
    bagSpec: string
    bagMaterial: string
    ownershipFactoryId: string
    currentLocation: string
    note: string
  }
  packDraft: {
    bagId: string
    bagCodeInput: string
    ticketInput: string
    warehouseArea: string
    locationCode: string
    operator: string
    boundObjectType: string
    boundObjectNo: string
    receiverType: string
    receiverName: string
    note: string
  }
  abnormalDraft: {
    bagId: string
    usageId: string
    abnormalType: string
    description: string
    reportedBy: string
    handlingDecision: '继续使用' | '报废'
  }
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

function serializeTransferBagTicketRecordsStorage(records: TransferBagsProjection['ticketRecords']): string {
  return JSON.stringify(records)
}

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

let projectionVersion = 0
let projectionCache: { version: number; projection: TransferBagsProjection } | null = null
let carrierManagementProjectionCache:
  | {
      version: number
      projection: TransferBagCarrierManagementProjection
      masterRecordMap: Record<string, TransferBagCarrierMasterRecord>
    }
  | null = null

function invalidateTransferBagProjectionCache(): void {
  projectionVersion += 1
  projectionCache = null
  carrierManagementProjectionCache = null
}

function getProjection() {
  if (projectionCache?.version === projectionVersion) return projectionCache.projection
  const projection = buildTransferBagsProjection(undefined, state.store)
  projectionCache = { version: projectionVersion, projection }
  return projection
}

function hydrateStore(): TransferBagStore {
  return buildTransferBagsProjection().store
}

const state: TransferBagsPageState = {
  store: hydrateStore(),
  masterKeyword: '',
  masterStatus: 'ALL',
  masterUseStage: 'ALL',
  masterLocationKeyword: '',
  masterBoundObjectKeyword: '',
  masterPage: 1,
  masterPageSize: 10,
  activeListTab: 'masters',
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
  activeDialog: null,
  activeAbnormalId: '',
  masterDraft: {
    bagCode: '',
    carrierType: 'bag',
    capacity: '80',
    bagSpec: '中号 / 80 张菲票',
    bagMaterial: '循环软袋',
    ownershipFactoryId: '',
    currentLocation: '裁片仓空袋区',
    note: '',
  },
  packDraft: {
    bagId: '',
    bagCodeInput: '',
    ticketInput: '',
    warehouseArea: '裁片暂存区',
    locationCode: 'A-01-01',
    operator: '裁床仓管',
    boundObjectType: '车缝任务',
    boundObjectNo: '',
    receiverType: '工厂',
    receiverName: '',
    note: '',
  },
  abnormalDraft: {
    bagId: '',
    usageId: '',
    abnormalType: '中转袋破损',
    description: '',
    reportedBy: '中转袋工作台',
    handlingDecision: '继续使用',
  },
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

function getCarrierManagementProjection() {
  if (carrierManagementProjectionCache?.version === projectionVersion) return carrierManagementProjectionCache.projection
  const projection = buildTransferBagCarrierManagementProjection(state.store, getViewModel())
  carrierManagementProjectionCache = {
    version: projectionVersion,
    projection,
    masterRecordMap: Object.fromEntries(projection.masterRecords.map((item) => [item.bagCode, item])),
  }
  return projection
}

function persistStore(): void {
  invalidateTransferBagProjectionCache()
  localStorage.setItem(CUTTING_TRANSFER_BAG_LEDGER_STORAGE_KEY, serializeTransferBagStorage(state.store))
  const nextTicketRecords = getProjection().ticketRecords
  localStorage.setItem(CUTTING_FEI_TICKET_RECORDS_STORAGE_KEY, serializeTransferBagTicketRecordsStorage(nextTicketRecords))
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

function closeActiveDialog(): boolean {
  state.activeDialog = null
  state.activeAbnormalId = ''
  return true
}

function getFactoryOptions() {
  const factories = listBusinessFactoryMasterRecords({ includeTestFactories: true })
  return factories.length ? factories : [{ id: 'F090', code: 'F090', name: '全能力测试工厂' }]
}

function getFactoryNameById(factoryId: string): string {
  const factory = getFactoryOptions().find((item) => item.id === factoryId || item.code === factoryId)
  return factory ? formatFactoryDisplayName(factory.name, factory.code || factory.id) : ''
}

function sanitizeIdFragment(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'na'
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

function resetAbnormalDraft(options: { bagId?: string; usageId?: string; abnormalId?: string } = {}): void {
  const usage = options.usageId ? getSourceUsage(options.usageId) : null
  const bag = options.bagId ? getSourceMaster(options.bagId) : usage ? getSourceMaster(usage.bagId) : getActiveMaster()
  state.activeAbnormalId = options.abnormalId || ''
  state.abnormalDraft = {
    bagId: bag?.bagId || '',
    usageId: usage?.usageId || '',
    abnormalType: '中转袋破损',
    description: '',
    reportedBy: '中转袋工作台',
    handlingDecision: '继续使用',
  }
}

function getDialogTitle(): string {
  if (state.activeDialog === 'new-master') return '新增中转袋'
  if (state.activeDialog === 'inbound-pack') return '入仓暂存装袋'
  if (state.activeDialog === 'handover-pack') return '交出装袋'
  if (state.activeDialog === 'return') return '回收确认'
  if (state.activeDialog === 'handle-abnormal') return '处理异常'
  return '异常登记'
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
  const boundObjectKeyword = state.masterBoundObjectKeyword.trim().toLowerCase()
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
    if (boundObjectKeyword && ![carrierRecord?.currentBoundObjectType, carrierRecord?.currentBoundObjectNo].join(' ').toLowerCase().includes(boundObjectKeyword)) return false
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
  const hasOpenUsage = state.store.usages.some((usage) => usage.bagId === bag.bagId && !['CLOSED', 'EXCEPTION_CLOSED'].includes(usage.usageStatus))
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
    master.currentCycleId = ['CLOSED', 'EXCEPTION_CLOSED'].includes(latestUsage.usageStatus) ? '' : latestUsage.cycleId
    master.currentOwnerTaskId = latestUsage.boundObjectId || latestUsage.sewingTaskId || ''
    const latestClosure = (closureMap.get(latestUsage.usageId) || []).sort((left, right) => right.closedAt.localeCompare(left.closedAt, 'zh-CN'))[0] || null
    if (latestUsage.usageStatus === 'CLOSED' || latestUsage.usageStatus === 'EXCEPTION_CLOSED') {
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

function addManualAbnormalRecord(input: {
  bag: TransferBagMaster
  usage?: TransferBagUsage | null
  abnormalType: string
  description: string
  reportedBy: string
  handlingStatus?: string
}): void {
  const now = nowText()
  state.store.abnormalRecords.push({
    abnormalId: buildCuttingTraceabilityId('bag-abnormal', now, input.bag.bagId, input.usage?.usageId || input.abnormalType),
    bagCode: input.bag.bagCode,
    abnormalType: input.abnormalType,
    relatedUseId: input.usage?.usageId || '',
    relatedObjectType: input.usage ? '使用周期' : '中转袋主档',
    relatedObjectId: input.usage?.usageNo || input.bag.bagCode,
    description: input.description,
    evidencePhotos: [],
    reportedAt: now,
    reportedBy: input.reportedBy,
    handlingStatus: input.handlingStatus || '待处理',
    handledAt: '',
    handledBy: '',
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
    cycleId: 'idle-cycle',
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
  state.activeListTab = 'masters'
  state.masterKeyword = bagCode
  resetMasterPagination()
  setFeedback('success', `${bagCode} 已新增，并生成归属 ${ownershipFactoryName || '未指定工厂'} 的中转袋二维码。`)
  return true
}

function savePackDraft(stage: 'INBOUND_TEMP' | 'HANDOVER_PACKING'): boolean {
  const bag = resolvePackBag()
  if (!bag) {
    setFeedback('warning', '请先选择或扫描中转袋。')
    return true
  }
  const hasOpenUsage = state.store.usages.some((usage) => usage.bagId === bag.bagId && !['CLOSED', 'EXCEPTION_CLOSED'].includes(usage.usageStatus))
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
  if (stage === 'HANDOVER_PACKING' && !state.packDraft.boundObjectNo.trim()) {
    setFeedback('warning', '交出装袋需要绑定接收对象、车缝任务或交出单号。')
    return true
  }
  const now = nowText()
  const usage = buildManualUsage({ stage, bag, tickets, now })
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
      action: stage === 'INBOUND_TEMP' ? '入仓暂存装袋' : '交出装袋',
      actionAt: now,
      actionBy: state.packDraft.operator.trim() || '中转袋工作台',
      note: `${usage.bagCode} 已装入 ${tickets.length} 张菲票。`,
    }),
  )
  refreshDerivedState()
  persistStore()
  closeActiveDialog()
  syncUsageSelection(usage.usageId)
  state.activeListTab = stage === 'INBOUND_TEMP' ? 'inbound' : 'handover'
  setFeedback('success', `${usage.usageNo} 已开始${stage === 'INBOUND_TEMP' ? '入仓暂存' : '交出'}装袋，装入 ${tickets.length} 张菲票。`)
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

function saveAbnormalDraft(): boolean {
  const bag = getSourceMaster(state.abnormalDraft.bagId)
  if (!bag) {
    setFeedback('warning', '请先选择中转袋。')
    return true
  }
  const usage = state.abnormalDraft.usageId ? getSourceUsage(state.abnormalDraft.usageId) : null
  addManualAbnormalRecord({
    bag,
    usage,
    abnormalType: state.abnormalDraft.abnormalType.trim() || '中转袋异常',
    description: state.abnormalDraft.description.trim() || '人工登记中转袋异常。',
    reportedBy: state.abnormalDraft.reportedBy.trim() || '中转袋工作台',
  })
  refreshDerivedState()
  persistStore()
  closeActiveDialog()
  state.activeListTab = 'abnormal'
  setFeedback('success', `${bag.bagCode} 已登记异常。`)
  return true
}

function handleAbnormalDraft(): boolean {
  const abnormalId = state.activeAbnormalId
  const abnormal = getCarrierManagementProjection().abnormalRecords.find((item) => item.abnormalId === abnormalId)
  if (!abnormal) {
    setFeedback('warning', '未找到待处理异常。')
    return true
  }
  const bag = state.store.masters.find((item) => item.bagCode === abnormal.bagCode) || null
  if (!bag) {
    setFeedback('warning', '异常缺少对应中转袋主档。')
    return true
  }
  const stored = state.store.abnormalRecords.find((item) => item.abnormalId === abnormalId)
  const now = nowText()
  if (stored) {
    stored.handlingStatus = '已处理'
    stored.handledAt = now
    stored.handledBy = state.abnormalDraft.reportedBy.trim() || '中转袋工作台'
    stored.description = state.abnormalDraft.description.trim() || stored.description
  }
  const derivedRecordId = abnormalId.replace(/^ABN-/, '')
  const condition = state.store.conditionRecords.find((item) => item.conditionRecordId === derivedRecordId)
  if (condition) {
    condition.note = state.abnormalDraft.description.trim() || condition.note
    condition.repairNeeded = false
    condition.reusableDecision =
      state.abnormalDraft.handlingDecision === '报废'
        ? 'DISABLED'
        : 'REUSABLE'
  }
  if (state.abnormalDraft.handlingDecision === '报废') {
    bag.currentStatus = 'DISABLED'
    bag.currentLocation = '报废区'
  } else {
    bag.currentStatus = 'IDLE'
    bag.currentLocation = '裁片仓空袋区'
  }
  state.store.returnAuditTrail.push(
    buildBagReturnAuditTrail({
      cycleId: abnormal.relatedUseId || bag.bagId,
      action: '处理异常',
      actionAt: now,
      actionBy: state.abnormalDraft.reportedBy.trim() || '中转袋工作台',
      payloadSummary: `${bag.bagCode} 异常处理：${state.abnormalDraft.handlingDecision}`,
      note: state.abnormalDraft.description.trim() || abnormal.description,
    }),
  )
  refreshDerivedState()
  persistStore()
  closeActiveDialog()
  state.activeListTab = 'abnormal'
  setFeedback('success', `${bag.bagCode} 异常已处理，当前状态：${deriveTransferBagMasterStatus(bag.currentStatus).label}。`)
  return true
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
    replenishment: 'replenishment',
    'special-processes': 'specialProcesses',
    'material-prep': 'materialPrep',
    'marker-spreading': 'markerSpreading',
    'fei-tickets': 'feiTickets',
    'cut-orders': 'cutOrders',
    'production-progress': 'productionProgress',
    'cut-piece-warehouse': 'cutPieceWarehouse',
    'fabric-warehouse': 'fabricWarehouse',
     'marker-list': 'markerPlanSources',
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

function isTransferBagDetailTab(value: string | null | undefined): value is TransferBagDetailTab {
  return value === 'basic' || value === 'current' || value === 'history' || value === 'items' || value === 'recovery' || value === 'logs'
}

function readTransferBagDetailTab(): TransferBagDetailTab {
  const detailTab = state.drillContext?.detailTab || getWarehouseSearchParams().get('detailTab')
  return isTransferBagDetailTab(detailTab) ? detailTab : 'basic'
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
  if (status === 'DIRTY') return '已记录异常'
  return '待评估'
}

function formatReusableDecisionLabel(decision: TransferBagReusableDecision | null | undefined): string {
  if (decision === 'REUSABLE' || decision === 'WAITING_CLEANING' || decision === 'WAITING_REPAIR') return '可继续使用'
  if (decision === 'DISABLED') return '报废'
  return '待评估'
}

function formatRecoveryEntryNextStepLabel(entry: ReturnType<typeof getDetailBagRecoveryEntries>[number]): string {
  if (entry.latestCondition?.reusableDecision) return formatReusableDecisionLabel(entry.latestCondition.reusableDecision)
  if (entry.latestClosure?.nextBagStatus) {
    return ['IDLE', 'REUSABLE'].includes(entry.latestClosure.nextBagStatus) ? '可以' : '不能继续使用'
  }
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
        <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="${escapeHtml(buildTransferBagListRoute())}">返回中转袋流转</button>
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
  return `
    <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
      ${renderCompactKpiCard('已交出待回收', summary.waitingReturnUsageCount, '', 'text-orange-600')}
      ${renderCompactKpiCard('回收确认中', summary.inspectingUsageCount, '', 'text-cyan-600')}
      ${renderCompactKpiCard('已关闭使用周期数', summary.closedUsageCount, '', 'text-emerald-600')}
      ${renderCompactKpiCard('可用袋数', summary.reusableBagCount + summary.waitingCleaningBagCount + summary.waitingRepairBagCount, '', 'text-emerald-600')}
      ${renderCompactKpiCard('报废袋数', getViewModel().masters.filter((item) => item.currentStatus === 'DISABLED').length, '', 'text-slate-600')}
      ${renderCompactKpiCard('异常记录数', getCarrierManagementProjection().abnormalRecords.length, '', 'text-rose-600')}
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
      <div class="rounded-lg border bg-muted/15 px-4 py-3 text-sm text-muted-foreground">保存后会生成正式中转袋二维码，二维码包含袋码、载具类型、当前周期和归属工厂信息。</div>
    `,
    '<button type="button" class="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700" data-transfer-bags-action="save-master">保存中转袋</button>',
  )
}

function renderPackDialog(stage: 'INBOUND_TEMP' | 'HANDOVER_PACKING'): string {
  const isInbound = stage === 'INBOUND_TEMP'
  return renderDialogShell(
    `
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label class="space-y-2">
          <span class="text-sm font-medium text-foreground">中转袋</span>
          <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-pack-draft-field="bagId">
            <option value="">请选择中转袋</option>
            ${renderBagOptions(state.packDraft.bagId)}
          </select>
        </label>
        <label class="space-y-2">
          <span class="text-sm font-medium text-foreground">扫袋码</span>
          <input class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" value="${escapeHtml(state.packDraft.bagCodeInput)}" placeholder="可直接扫描中转袋二维码" data-transfer-bags-pack-draft-field="bagCodeInput" />
        </label>
        <label class="space-y-2">
          <span class="text-sm font-medium text-foreground">库区</span>
          <input class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" value="${escapeHtml(state.packDraft.warehouseArea)}" data-transfer-bags-pack-draft-field="warehouseArea" />
        </label>
        <label class="space-y-2">
          <span class="text-sm font-medium text-foreground">库位 / 月台</span>
          <input class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" value="${escapeHtml(state.packDraft.locationCode)}" data-transfer-bags-pack-draft-field="locationCode" />
        </label>
        ${isInbound
          ? ''
          : `
            <label class="space-y-2">
              <span class="text-sm font-medium text-foreground">绑定对象类型</span>
              <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-pack-draft-field="boundObjectType">
                ${['车缝任务', '特殊工艺交出单', '仓库交出单', '其他'].map((item) => `<option value="${escapeHtml(item)}" ${state.packDraft.boundObjectType === item ? 'selected' : ''}>${escapeHtml(item)}</option>`).join('')}
              </select>
            </label>
            <label class="space-y-2">
              <span class="text-sm font-medium text-foreground">绑定对象单号</span>
              <input class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" value="${escapeHtml(state.packDraft.boundObjectNo)}" placeholder="车缝任务 / 交出单号" data-transfer-bags-pack-draft-field="boundObjectNo" />
            </label>
            <label class="space-y-2">
              <span class="text-sm font-medium text-foreground">接收对象类型</span>
              <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-pack-draft-field="receiverType">
                ${['工厂', '仓库', '其他'].map((item) => `<option value="${escapeHtml(item)}" ${state.packDraft.receiverType === item ? 'selected' : ''}>${escapeHtml(item)}</option>`).join('')}
              </select>
            </label>
            <label class="space-y-2">
              <span class="text-sm font-medium text-foreground">接收对象</span>
              <input class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" value="${escapeHtml(state.packDraft.receiverName)}" data-transfer-bags-pack-draft-field="receiverName" />
            </label>
          `}
        <label class="space-y-2">
          <span class="text-sm font-medium text-foreground">操作人</span>
          <input class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" value="${escapeHtml(state.packDraft.operator)}" data-transfer-bags-pack-draft-field="operator" />
        </label>
        <label class="space-y-2 xl:col-span-3">
          <span class="text-sm font-medium text-foreground">备注</span>
          <input class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" value="${escapeHtml(state.packDraft.note)}" data-transfer-bags-pack-draft-field="note" />
        </label>
        <label class="space-y-2 md:col-span-2 xl:col-span-4">
          <span class="text-sm font-medium text-foreground">菲票码</span>
          <textarea class="min-h-[96px] w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="可粘贴或连续扫描多张菲票，使用空格 / 换行 / 顿号分隔" data-transfer-bags-pack-draft-field="ticketInput">${escapeHtml(state.packDraft.ticketInput)}</textarea>
        </label>
      </div>
      <div class="rounded-lg border bg-muted/15 px-4 py-3 text-sm text-muted-foreground">${isInbound ? '入仓暂存支持一个中转袋混装，保存后先进入入仓装袋中，可再确认暂存或清空袋。' : '交出装袋必须绑定接收对象或任务，保存后可继续完成装袋、交出和回收确认。'}</div>
    `,
    `<button type="button" class="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700" data-transfer-bags-action="${isInbound ? 'save-inbound-pack' : 'save-handover-pack'}">保存装袋</button>`,
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
        <label class="space-y-2"><span class="text-sm font-medium text-foreground">袋况</span><select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-condition-field="conditionStatus"><option value="GOOD" ${state.conditionDraft.conditionStatus === 'GOOD' ? 'selected' : ''}>完好</option><option value="MINOR_DAMAGE" ${state.conditionDraft.conditionStatus === 'MINOR_DAMAGE' ? 'selected' : ''}>有异常但可继续使用</option><option value="SEVERE_DAMAGE" ${state.conditionDraft.conditionStatus === 'SEVERE_DAMAGE' ? 'selected' : ''}>报废</option></select></label>
        <label class="space-y-2"><span class="text-sm font-medium text-foreground">回收结果</span><select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-condition-field="reusableDecision"><option value="REUSABLE" ${state.conditionDraft.reusableDecision === 'REUSABLE' ? 'selected' : ''}>可继续使用</option><option value="DISABLED" ${state.conditionDraft.reusableDecision === 'DISABLED' ? 'selected' : ''}>报废</option></select></label>
        <label class="space-y-2 md:col-span-2"><span class="text-sm font-medium text-foreground">异常 / 报废说明</span><input class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" value="${escapeHtml(state.conditionDraft.damageType)}" data-transfer-bags-condition-field="damageType" /></label>
        <label class="space-y-2 md:col-span-2 xl:col-span-4"><span class="text-sm font-medium text-foreground">回收备注</span><input class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" value="${escapeHtml(state.returnDraft.note)}" data-transfer-bags-return-draft-field="note" /></label>
      </div>
    `,
    '<button type="button" class="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700" data-transfer-bags-action="save-return">确认回收</button>',
  )
}

function renderAbnormalDialog(): string {
  const isHandle = state.activeDialog === 'handle-abnormal'
  const abnormal = isHandle ? getCarrierManagementProjection().abnormalRecords.find((item) => item.abnormalId === state.activeAbnormalId) || null : null
  return renderDialogShell(
    `
      ${abnormal ? `<div class="rounded-lg border bg-muted/15 px-4 py-3 text-sm text-muted-foreground">当前处理：${escapeHtml(abnormal.bagCode)} / ${escapeHtml(abnormal.abnormalType)} / ${escapeHtml(abnormal.description)}</div>` : ''}
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        ${isHandle
          ? ''
          : `
            <label class="space-y-2"><span class="text-sm font-medium text-foreground">中转袋</span><select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-abnormal-draft-field="bagId"><option value="">请选择中转袋</option>${renderBagOptions(state.abnormalDraft.bagId)}</select></label>
            <label class="space-y-2"><span class="text-sm font-medium text-foreground">关联使用记录</span><select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-abnormal-draft-field="usageId"><option value="">无</option>${renderUsageOptions(state.abnormalDraft.usageId, state.abnormalDraft.bagId)}</select></label>
            <label class="space-y-2"><span class="text-sm font-medium text-foreground">异常类型</span><select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-abnormal-draft-field="abnormalType">${['中转袋破损', '中转袋丢失', '错扫', '数量差异', '逾期未回收', '其他异常'].map((item) => `<option value="${escapeHtml(item)}" ${state.abnormalDraft.abnormalType === item ? 'selected' : ''}>${escapeHtml(item)}</option>`).join('')}</select></label>
          `}
        <label class="space-y-2"><span class="text-sm font-medium text-foreground">${isHandle ? '处理人' : '登记人'}</span><input class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" value="${escapeHtml(state.abnormalDraft.reportedBy)}" data-transfer-bags-abnormal-draft-field="reportedBy" /></label>
        ${isHandle ? `<label class="space-y-2"><span class="text-sm font-medium text-foreground">处理结果</span><select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-abnormal-draft-field="handlingDecision">${['继续使用', '报废'].map((item) => `<option value="${escapeHtml(item)}" ${state.abnormalDraft.handlingDecision === item ? 'selected' : ''}>${escapeHtml(item)}</option>`).join('')}</select></label>` : ''}
        <label class="space-y-2 md:col-span-2 xl:col-span-4"><span class="text-sm font-medium text-foreground">${isHandle ? '处理说明' : '异常说明'}</span><textarea class="min-h-[88px] w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-abnormal-draft-field="description">${escapeHtml(state.abnormalDraft.description)}</textarea></label>
      </div>
    `,
    `<button type="button" class="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700" data-transfer-bags-action="${isHandle ? 'save-handle-abnormal' : 'save-abnormal'}">${isHandle ? '保存处理结果' : '保存异常'}</button>`,
  )
}

function renderActiveDialog(): string {
  if (state.activeDialog === 'new-master') return renderNewMasterDialog()
  if (state.activeDialog === 'inbound-pack') return renderPackDialog('INBOUND_TEMP')
  if (state.activeDialog === 'handover-pack') return renderPackDialog('HANDOVER_PACKING')
  if (state.activeDialog === 'return') return renderReturnDialog()
  if (state.activeDialog === 'abnormal' || state.activeDialog === 'handle-abnormal') return renderAbnormalDialog()
  return ''
}

function renderListHeaderActions(): string {
  return `
    <div class="flex flex-wrap items-center gap-2">
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-fast-page-render="true" data-transfer-bags-action="new-master">新增中转袋</button>
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-fast-page-render="true" data-transfer-bags-action="focus-scan-query">扫码查询</button>
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-fast-page-render="true" data-transfer-bags-action="open-abnormal">异常登记</button>
    </div>
  `
}

function renderMasterQuickFilterBar(): string {
  const statusOptions: TransferBagCarrierCurrentStatus[] = ['可用', '入仓装袋中', '入仓暂存中', '交出装袋中', '待交出', '已交出待回收', '报废']
  const stageOptions: TransferBagCarrierUseStage[] = ['无', '入仓暂存', '交出装袋', '已交出待回收']
  return renderStickyFilterShell(`
    <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.15fr,0.9fr,0.9fr,1fr,1.15fr]">
      <label class="space-y-2">
        <span class="text-sm font-medium text-foreground">袋码</span>
        <input
          type="text"
          value="${escapeHtml(state.masterKeyword)}"
          placeholder="袋码 / 规格 / 当前装载"
          class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          data-fast-page-render="true"
          data-transfer-bags-master-field="keyword"
        />
      </label>
      <label class="space-y-2">
        <span class="text-sm font-medium text-foreground">当前状态</span>
        <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-fast-page-render="true" data-transfer-bags-master-field="status">
          <option value="ALL" ${state.masterStatus === 'ALL' ? 'selected' : ''}>全部状态</option>
          ${statusOptions
            .map((status) => `<option value="${escapeHtml(status)}" ${state.masterStatus === status ? 'selected' : ''}>${escapeHtml(status)}</option>`)
            .join('')}
        </select>
      </label>
      <label class="space-y-2">
        <span class="text-sm font-medium text-foreground">使用阶段</span>
        <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-fast-page-render="true" data-transfer-bags-master-field="useStage">
          <option value="ALL" ${state.masterUseStage === 'ALL' ? 'selected' : ''}>全部阶段</option>
          ${stageOptions
            .map((stage) => `<option value="${escapeHtml(stage)}" ${state.masterUseStage === stage ? 'selected' : ''}>${escapeHtml(stage)}</option>`)
            .join('')}
        </select>
      </label>
      <label class="space-y-2">
        <span class="text-sm font-medium text-foreground">当前位置</span>
        <input
          type="text"
          value="${escapeHtml(state.masterLocationKeyword)}"
          placeholder="工厂 / 仓库 / 库位"
          class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          data-fast-page-render="true"
          data-transfer-bags-master-field="location"
        />
      </label>
      <label class="space-y-2">
        <span class="text-sm font-medium text-foreground">绑定对象</span>
        <input
          type="text"
          value="${escapeHtml(state.masterBoundObjectKeyword)}"
          placeholder="使用记录 / 交出单 / 接收对象"
          class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          data-fast-page-render="true"
          data-transfer-bags-master-field="boundObject"
        />
      </label>
    </div>
  `)
}

function getTransferBagListTabs(): Array<{ key: TransferBagListTab; label: string; count: number }> {
  const projection = getCarrierManagementProjection()
  return [
    { key: 'masters', label: '中转袋档案', count: getFilteredMasters().length },
    { key: 'inbound', label: '入仓暂存使用', count: projection.inboundTempUses.length },
    { key: 'handover', label: '交出装袋使用', count: projection.handoverPackingUses.length },
    { key: 'recovery', label: '已交出待回收', count: projection.signedAndReturnUses.length },
    { key: 'abnormal', label: '异常记录', count: projection.abnormalRecords.length },
  ]
}

function renderTransferBagListTabs(): string {
  return `
    <nav class="rounded-lg border bg-card p-2" aria-label="中转袋流转页签">
      <div class="flex flex-wrap gap-2" role="tablist" aria-label="中转袋流转页签">
        ${getTransferBagListTabs()
          .map((tab) => {
            const selected = state.activeListTab === tab.key
            return `
              <button
                type="button"
                role="tab"
                aria-selected="${selected ? 'true' : 'false'}"
                class="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${selected ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted'}"
                data-fast-page-render="true"
                data-transfer-bags-action="set-list-tab"
                data-tab="${tab.key}"
              >
                <span>${escapeHtml(tab.label)}</span>
                <span class="rounded-full ${selected ? 'bg-background/20 text-background' : 'bg-muted text-muted-foreground'} px-2 py-0.5 text-xs">${escapeHtml(String(tab.count))}</span>
              </button>
            `
          })
          .join('')}
      </div>
    </nav>
  `
}

function renderTransferBagListTabPanel(): string {
  if (state.activeListTab === 'inbound') return renderInboundTempUseSection()
  if (state.activeListTab === 'handover') return renderHandoverPackingUseSection()
  if (state.activeListTab === 'recovery') return renderSignAndReturnUseSection()
  if (state.activeListTab === 'abnormal') return renderCarrierAbnormalSection()
  return renderMasterSection()
}

function renderDemoFixturePanel(): string {
  return ''
}

function renderInboundTempUseSection(): string {
  const projection = getCarrierManagementProjection()
  const items = projection.inboundTempUses
  return `
    <section class="rounded-lg border bg-card" role="tabpanel" aria-label="入仓暂存使用">
      <div class="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 class="text-sm font-semibold text-foreground">入仓暂存使用</h2>
        </div>
        <button type="button" class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-transfer-bags-action="open-inbound-pack">开始入仓暂存装袋</button>
      </div>
      ${items.length
        ? renderStickyTableScroller(`
            <table class="min-w-[1120px] w-full text-sm">
              <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th class="px-4 py-3 text-left">使用记录</th>
                  <th class="px-4 py-3 text-left">入仓信息</th>
                  <th class="px-4 py-3 text-left">装入内容</th>
                  <th class="px-4 py-3 text-left">混装情况</th>
                  <th class="px-4 py-3 text-left">后续状态</th>
                  <th class="px-4 py-3 text-left">操作</th>
                </tr>
              </thead>
              <tbody>
                ${items
                  .map((item) => {
                    const detailHref = buildTransferBagDetailRoute({
                      bagId: item.bagMasterId,
                      bagCode: item.bagCode,
                      usageId: item.bagUseId,
                      usageNo: item.bagUseNo,
                      detailTab: 'current',
                    })
                    const itemsHref = buildTransferBagDetailRoute({
                      bagId: item.bagMasterId,
                      bagCode: item.bagCode,
                      usageId: item.bagUseId,
                      usageNo: item.bagUseNo,
                      detailTab: 'items',
                    })
                    return `
                      <tr class="border-b bg-card">
                        <td class="px-4 py-3">
                          <div class="font-medium text-blue-700">${escapeHtml(item.bagUseNo)}</div>
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.bagCode)}</div>
                          <div class="mt-2">${renderTag(item.currentStatus, getCarrierCurrentStatusClass(item.currentStatus))}</div>
                        </td>
                        <td class="px-4 py-3 text-xs text-muted-foreground">
                          <div><span class="font-medium text-foreground">${escapeHtml(item.inboundAt || item.startedAt || '待入仓')}</span></div>
                          <div class="mt-1">${escapeHtml(item.inboundBy || '裁床仓管')}</div>
                          <div class="mt-1">${escapeHtml(`${item.sourceWarehouseName} / ${item.warehouseArea} / ${item.locationCode}`)}</div>
                        </td>
                        <td class="px-4 py-3 text-xs text-muted-foreground">
                          <div><span class="font-medium text-foreground">${escapeHtml(String(item.containedFeiTickets.length))}</span> 张菲票</div>
                          <div class="mt-1"><span class="font-medium text-foreground">${escapeHtml(String(item.containedPieceQty))}</span> 片裁片</div>
                          <div class="mt-1">${escapeHtml(`${item.containedProductionOrderCount} 个生产单 / ${item.containedCutOrderCount} 张裁片单`)}</div>
                        </td>
                        <td class="px-4 py-3">
                          ${renderTag(item.mixedFlag ? '混装' : '单一来源', item.mixedFlag ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-slate-100 text-slate-700 border border-slate-200')}
                          <div class="mt-2 text-xs text-muted-foreground">${escapeHtml(item.mixedSummary)}</div>
                        </td>
                        <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(item.currentStatus === '入仓暂存中' ? '暂存中，等待二次分拣或转出' : item.currentStatus === '入仓装袋中' ? '装袋中，待确认暂存' : '已转出或已清空')}</td>
                        <td class="px-4 py-3">
                          <div class="flex flex-wrap gap-2">
                            <button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-nav="${escapeHtml(detailHref)}">查看使用详情</button>
                            <button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-nav="${escapeHtml(itemsHref)}">查看菲票</button>
                            <button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-nav="${escapeHtml(getCanonicalCuttingPath('cut-piece-warehouse'))}">查看库存流水</button>
                            ${item.currentStatus === '入仓装袋中' ? `<button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-transfer-bags-action="complete-inbound-storage" data-usage-id="${escapeHtml(item.bagUseId)}">确认暂存</button>` : ''}
                            ${item.currentStatus === '入仓暂存中' ? `<button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-transfer-bags-action="release-inbound-bag" data-usage-id="${escapeHtml(item.bagUseId)}">清空袋</button>` : ''}
                            <button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-transfer-bags-action="open-abnormal" data-usage-id="${escapeHtml(item.bagUseId)}">登记异常</button>
                          </div>
                        </td>
                      </tr>
                    `
                  })
                  .join('')}
              </tbody>
            </table>
          `)
        : '<div class="px-6 py-10 text-center text-sm text-muted-foreground">暂无入仓暂存使用记录</div>'}
    </section>
  `
}

function renderHandoverPackingUseSection(): string {
  const projection = getCarrierManagementProjection()
  const items = projection.handoverPackingUses
  return `
    <section class="rounded-lg border bg-card" role="tabpanel" aria-label="交出装袋使用">
      <div class="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 class="text-sm font-semibold text-foreground">交出装袋使用</h2>
        </div>
        <button type="button" class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-transfer-bags-action="open-handover-pack">开始交出装袋</button>
      </div>
      ${items.length
        ? renderStickyTableScroller(`
            <table class="min-w-[1180px] w-full text-sm">
              <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th class="px-4 py-3 text-left">使用记录</th>
                  <th class="px-4 py-3 text-left">绑定对象</th>
                  <th class="px-4 py-3 text-left">接收对象</th>
                  <th class="px-4 py-3 text-left">装入内容</th>
                  <th class="px-4 py-3 text-left">交出信息</th>
                  <th class="px-4 py-3 text-left">交出状态</th>
                  <th class="px-4 py-3 text-left">操作</th>
                </tr>
              </thead>
              <tbody>
                ${items
                  .map((item) => {
                    const detailHref = buildTransferBagDetailRoute({
                      bagId: item.bagMasterId,
                      bagCode: item.bagCode,
                      usageId: item.bagUseId,
                      usageNo: item.bagUseNo,
                      detailTab: 'items',
                    })
                    const recoveryHref = buildTransferBagDetailRoute({
                      bagId: item.bagMasterId,
                      bagCode: item.bagCode,
                      usageId: item.bagUseId,
                      usageNo: item.bagUseNo,
                      detailTab: 'recovery',
                    })
                    const canCompletePacking = item.currentStatus === '交出装袋中'
                    const canDispatch = item.currentStatus === '待交出'
                    const canReturn = item.currentStatus === '已交出待回收' && !item.returnedAt
                    return `
                      <tr class="border-b bg-card">
                        <td class="px-4 py-3">
                          <div class="font-medium text-blue-700">${escapeHtml(item.bagUseNo)}</div>
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.bagCode)}</div>
                          <div class="mt-2">${renderTag(item.currentStatus, getCarrierCurrentStatusClass(item.currentStatus))}</div>
                        </td>
                        <td class="px-4 py-3">
                          <div class="font-medium text-foreground">${escapeHtml(item.targetObjectNo || '待绑定')}</div>
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.targetObjectType || '绑定对象待补')}</div>
                        </td>
                        <td class="px-4 py-3">
                          <div class="font-medium text-foreground">${escapeHtml(formatFactoryDisplayName(item.receiverName || item.receiverFactoryName) || '待指定')}</div>
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.receiverType || '接收对象')}</div>
                        </td>
                        <td class="px-4 py-3 text-xs text-muted-foreground">
                          <div><span class="font-medium text-foreground">${escapeHtml(String(item.containedFeiTickets.length))}</span> 张菲票</div>
                          <div class="mt-1"><span class="font-medium text-foreground">${escapeHtml(String(item.containedPieceQty))}</span> 片裁片</div>
                          <div class="mt-1">${escapeHtml(item.mixedSummary)}</div>
                        </td>
                        <td class="px-4 py-3 text-xs text-muted-foreground">
                          <div>交出单：${escapeHtml(item.targetObjectNo || '待生成')}</div>
                          <div class="mt-1">交出记录：${escapeHtml(item.handedOverAt ? item.bagUseNo : '待交出')}</div>
                          <div class="mt-1">交出时间：${escapeHtml(item.handedOverAt || '待交出')}</div>
                        </td>
                        <td class="px-4 py-3">${renderTag(item.currentStatus, getCarrierCurrentStatusClass(item.currentStatus))}</td>
                        <td class="px-4 py-3">
                          <div class="flex flex-wrap gap-2">
                            <button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-nav="${escapeHtml(getCanonicalCuttingPath('handover-record-detail'))}">查看交出记录</button>
                            <button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-nav="${escapeHtml(detailHref)}">查看装袋明细</button>
                            <button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-nav="${escapeHtml(recoveryHref)}">查看回收</button>
                            ${canCompletePacking ? `<button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-transfer-bags-action="mark-ready" data-usage-id="${escapeHtml(item.bagUseId)}">完成装袋</button>` : ''}
                            ${canDispatch ? `<button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-transfer-bags-action="mark-dispatched" data-usage-id="${escapeHtml(item.bagUseId)}">交出</button>` : ''}
                            ${canReturn ? `<button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-transfer-bags-action="open-return" data-usage-id="${escapeHtml(item.bagUseId)}">回收确认</button>` : ''}
                          </div>
                        </td>
                      </tr>
                    `
                  })
                  .join('')}
              </tbody>
            </table>
          `)
        : '<div class="px-6 py-10 text-center text-sm text-muted-foreground">暂无交出装袋使用记录</div>'}
    </section>
  `
}

function renderSignAndReturnUseSection(): string {
  const projection = getCarrierManagementProjection()
  const items = projection.signedAndReturnUses
  return `
    <section class="rounded-lg border bg-card" role="tabpanel" aria-label="已交出待回收">
      <div class="flex items-center justify-between border-b px-4 py-3">
        <h2 class="text-sm font-semibold text-foreground">已交出待回收</h2>
        <button type="button" class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-transfer-bags-action="open-return">回收确认</button>
      </div>
      ${items.length
        ? renderStickyTableScroller(`
            <table class="min-w-[1080px] w-full text-sm">
              <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th class="px-4 py-3 text-left">袋码</th>
                  <th class="px-4 py-3 text-left">交出对象</th>
                  <th class="px-4 py-3 text-left">交出</th>
                  <th class="px-4 py-3 text-left">回收</th>
                  <th class="px-4 py-3 text-left">差异</th>
                  <th class="px-4 py-3 text-left">操作</th>
                </tr>
              </thead>
              <tbody>
                ${items
                  .map((item) => {
                    const recoveryHref = buildTransferBagDetailRoute({
                      bagId: item.bagMasterId,
                      bagCode: item.bagCode,
                      usageId: item.bagUseId,
                      usageNo: item.bagUseNo,
                      detailTab: 'recovery',
                    })
                    const logsHref = buildTransferBagDetailRoute({
                      bagId: item.bagMasterId,
                      bagCode: item.bagCode,
                      usageId: item.bagUseId,
                      usageNo: item.bagUseNo,
                      detailTab: 'logs',
                    })
                    const discrepancySummary = item.discrepancyRecords.length
                      ? item.discrepancyRecords.map((record) => record.abnormalType).join(' / ')
                      : '无差异'
                    return `
                      <tr class="border-b bg-card">
                        <td class="px-4 py-3">
                          <div class="font-medium text-blue-700">${escapeHtml(item.bagCode)}</div>
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.bagUseNo)}</div>
                        </td>
                        <td class="px-4 py-3">
                          <div class="font-medium text-foreground">${escapeHtml(formatFactoryDisplayName(item.receiverName || item.receiverFactoryName) || '待补接收方')}</div>
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.targetObjectNo || '交出记录待补')}</div>
                        </td>
                        <td class="px-4 py-3 text-xs text-muted-foreground">
                          <div><span class="font-medium text-foreground">${escapeHtml(item.handedOverAt || '待交出')}</span></div>
                          <div class="mt-1">交出记录：${escapeHtml(item.targetObjectNo || item.bagUseNo)}</div>
                          <div class="mt-1">装载数量：${escapeHtml(String(item.containedPieceQty))} 片</div>
                        </td>
                        <td class="px-4 py-3 text-xs text-muted-foreground">
                          <div><span class="font-medium text-foreground">${escapeHtml(item.returnedAt || '待回收')}</span></div>
                          <div class="mt-1">回收人：${escapeHtml(item.returnedBy || '待确认')}</div>
                          <div class="mt-1">回收库位：${escapeHtml(item.returnedAt ? item.returnWarehouseName || item.locationCode : '待确认')}</div>
                        </td>
                        <td class="px-4 py-3">
                          ${renderTag(discrepancySummary, item.discrepancyRecords.length ? 'bg-rose-100 text-rose-700 border border-rose-200' : 'bg-emerald-100 text-emerald-700 border border-emerald-200')}
                        </td>
                        <td class="px-4 py-3">
                          <div class="flex flex-wrap gap-2">
                            <button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-nav="${escapeHtml(recoveryHref)}">查看回收</button>
                            ${!item.returnedAt ? `<button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-transfer-bags-action="open-return" data-usage-id="${escapeHtml(item.bagUseId)}">回收确认</button>` : ''}
                            <button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-transfer-bags-action="open-abnormal" data-usage-id="${escapeHtml(item.bagUseId)}">回收异常</button>
                            <button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-nav="${escapeHtml(logsHref)}">查看差异</button>
                          </div>
                        </td>
                      </tr>
                    `
                  })
                  .join('')}
              </tbody>
            </table>
          `)
        : '<div class="px-6 py-10 text-center text-sm text-muted-foreground">暂无已交出待回收记录</div>'}
    </section>
  `
}

function renderCarrierAbnormalSection(): string {
  const projection = getCarrierManagementProjection()
  const items = projection.abnormalRecords
  const carrierRecordsByBagCode = getCarrierMasterRecordMap()
  return `
    <section class="rounded-lg border bg-card" role="tabpanel" aria-label="异常记录">
      <div class="flex items-center justify-between border-b px-4 py-3">
        <h2 class="text-sm font-semibold text-foreground">异常记录</h2>
        <button type="button" class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-transfer-bags-action="open-abnormal">异常登记</button>
      </div>
      ${items.length
        ? renderStickyTableScroller(`
            <table class="min-w-[1080px] w-full text-sm">
              <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th class="px-4 py-3 text-left">异常</th>
                  <th class="px-4 py-3 text-left">中转袋</th>
                  <th class="px-4 py-3 text-left">关联对象</th>
                  <th class="px-4 py-3 text-left">异常说明</th>
                  <th class="px-4 py-3 text-left">处理</th>
                  <th class="px-4 py-3 text-left">操作</th>
                </tr>
              </thead>
              <tbody>
                ${items
                  .map((item) => {
                    const carrierRecord = carrierRecordsByBagCode[item.bagCode]
                    const detailHref = buildTransferBagDetailRoute({
                      bagCode: item.bagCode,
                      usageId: item.relatedUseId,
                      usageNo: item.relatedObjectId,
                      detailTab: 'logs',
                    })
                    return `
                      <tr class="border-b bg-card">
                        <td class="px-4 py-3">
                          ${renderTag(item.abnormalType, 'bg-rose-100 text-rose-700 border border-rose-200')}
                          <div class="mt-1 text-xs text-muted-foreground">等级：${escapeHtml(item.abnormalType.includes('报废') ? '高' : '中')}</div>
                          <div class="mt-1 text-xs text-muted-foreground">状态：${escapeHtml(item.handlingStatus)}</div>
                        </td>
                        <td class="px-4 py-3">
                          <div class="font-medium text-blue-700">${escapeHtml(item.bagCode)}</div>
                          <div class="mt-1">${renderTag(carrierRecord?.currentStatus || '异常', getCarrierCurrentStatusClass(carrierRecord?.currentStatus || '异常'))}</div>
                        </td>
                        <td class="px-4 py-3 text-xs text-muted-foreground">
                          <div>${escapeHtml(item.relatedObjectType || '使用记录')}</div>
                          <div class="mt-1">${escapeHtml(item.relatedObjectId || '业务对象待补')}</div>
                        </td>
                        <td class="px-4 py-3 text-xs text-muted-foreground">
                          <div class="text-sm text-foreground">${escapeHtml(item.description)}</div>
                          <div class="mt-1">照片：${escapeHtml(String(item.evidencePhotos.length))} 张</div>
                        </td>
                        <td class="px-4 py-3 text-xs text-muted-foreground">
                          <div>${escapeHtml(item.handlingStatus)}</div>
                          <div class="mt-1">${escapeHtml(item.handledBy || '待处理')}</div>
                          <div class="mt-1">${escapeHtml(item.handledAt || '待确认')}</div>
                        </td>
                        <td class="px-4 py-3">
                          <div class="flex flex-wrap gap-2">
                            <button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-nav="${escapeHtml(detailHref)}">查看异常</button>
                            <button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-transfer-bags-action="open-handle-abnormal" data-abnormal-id="${escapeHtml(item.abnormalId)}">处理异常</button>
                          </div>
                        </td>
                      </tr>
                    `
                  })
                  .join('')}
              </tbody>
            </table>
          `)
        : '<div class="px-6 py-10 text-center text-sm text-muted-foreground">暂无异常记录</div>'}
    </section>
  `
}

function renderTransferBagStageLedgerPanel(): string {
  const viewModel = getViewModel()
  const stageItems = viewModel.stageLedgerItems
  if (!stageItems.length) return ''
  const stageSummary = viewModel.stageSummary

  return `
    <section class="rounded-lg border bg-card">
      <div class="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 class="text-sm font-semibold text-foreground">中转袋业务阶段</h2>
        </div>
        <button type="button" class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-nav="${escapeHtml(getCanonicalCuttingPath('sewing-dispatch'))}">查看交出单</button>
      </div>
      <div class="grid gap-3 border-b p-4 md:grid-cols-4">
        ${renderCompactKpiCard('入仓暂存', stageSummary.inboundTempCount, '允许混装', 'text-blue-600')}
        ${renderCompactKpiCard('交出装袋', stageSummary.handoverPackingCount, '绑定交出关系', 'text-emerald-600')}
        ${renderCompactKpiCard('已绑定交出关系', stageSummary.handoverRelationOkCount, '交出单或交出记录', 'text-emerald-600')}
        ${renderCompactKpiCard('关系待补', stageSummary.handoverRelationMissingCount, '交出装袋阶段', 'text-amber-600')}
      </div>
      ${renderStickyTableScroller(`
        <table class="min-w-[1080px] w-full text-sm">
          <thead class="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              <th class="px-4 py-3 text-left">阶段</th>
              <th class="px-4 py-3 text-left">中转袋</th>
              <th class="px-4 py-3 text-left">业务关系</th>
              <th class="px-4 py-3 text-left">生产单</th>
              <th class="px-4 py-3 text-left">裁片单</th>
              <th class="px-4 py-3 text-left">菲票</th>
              <th class="px-4 py-3 text-left">状态</th>
              <th class="px-4 py-3 text-left">规则</th>
            </tr>
          </thead>
          <tbody>
            ${stageItems
              .map(
                (item) => `
                  <tr class="border-t">
                    <td class="px-4 py-3">${renderTag(item.stageLabel, item.stage === 'INBOUND_TEMP' ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-emerald-100 text-emerald-700 border border-emerald-200')}</td>
                    <td class="px-4 py-3">
                      <div class="font-medium text-blue-700">${escapeHtml(item.carrierCode)}</div>
                      <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.cycleNo || '暂无周期')}</div>
                    </td>
                    <td class="px-4 py-3">
                      <div class="${item.relationOk ? 'text-foreground' : 'text-amber-700'}">${escapeHtml(item.relationLabel)}</div>
                      ${item.stage === 'HANDOVER_PACKING' ? `<div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.dispatchBatchNo || '交出记录待新增')}</div>` : ''}
                    </td>
                    <td class="px-4 py-3">${escapeHtml(item.productionOrderNos.join(' / ') || '暂无')}</td>
                    <td class="px-4 py-3">${escapeHtml(item.cutOrderNos.join(' / ') || '暂无')}</td>
                    <td class="px-4 py-3">${escapeHtml(`${item.ticketCount} 张`)}</td>
                    <td class="px-4 py-3">${escapeHtml(item.statusLabel)}</td>
                    <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(item.ruleLabel)}</td>
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

function renderSortingTaskStatusTag(status: string): string {
  const className =
    status === '待分拣'
      ? 'bg-amber-100 text-amber-700 border border-amber-200'
      : status === '分拣中'
        ? 'bg-blue-100 text-blue-700 border border-blue-200'
        : status === '已装袋'
          ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
          : status === '已交出' || status === '已回写'
            ? 'bg-slate-900 text-white border border-slate-900'
            : 'bg-rose-100 text-rose-700 border border-rose-200'
  return renderTag(status, className)
}

function renderCutPieceSortingTaskPanel(): string {
  return ''
}

function renderMasterSection(): string {
  const { filteredItems, pageSlice, carrierRecordsByBagCode } = getPagedMasters()
  const items = pageSlice.items
  return `
    <div class="space-y-3" role="tabpanel" aria-label="中转袋档案">
      <section class="rounded-lg border bg-card">
        <div class="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h2 class="text-sm font-semibold text-foreground">中转袋档案</h2>
          </div>
          <div class="text-xs text-muted-foreground">共 ${filteredItems.length} 条中转袋</div>
        </div>
        ${!items.length
          ? '<div class="px-6 py-10 text-center text-sm text-muted-foreground">暂无匹配结果</div>'
          : `${renderStickyTableScroller(`
            <table class="min-w-[1180px] w-full text-sm">
              <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th class="px-4 py-3 text-left">中转袋</th>
                  <th class="px-4 py-3 text-left">当前状态</th>
                  <th class="px-4 py-3 text-left">当前使用</th>
                  <th class="px-4 py-3 text-left">当前所在</th>
                  <th class="px-4 py-3 text-left">当前装载</th>
                  <th class="px-4 py-3 text-left">最近记录</th>
                  <th class="px-4 py-3 text-left">异常</th>
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
                      const historyHref = buildTransferBagDetailRoute({
                        bagId: item.bagId,
                        bagCode: item.bagCode,
                        usageId: item.currentUsage?.usageId || undefined,
                        usageNo: item.currentUsage?.usageNo || undefined,
                        detailTab: 'history',
                      })
                      const recoveryHref = buildTransferBagDetailRoute({
                        bagId: item.bagId,
                        bagCode: item.bagCode,
                        usageId: item.currentUsage?.usageId || undefined,
                        usageNo: item.currentUsage?.usageNo || undefined,
                        detailTab: 'recovery',
                      })
                      const abnormalHref = buildTransferBagDetailRoute({
                        bagId: item.bagId,
                        bagCode: item.bagCode,
                        usageId: item.currentUsage?.usageId || undefined,
                        usageNo: item.currentUsage?.usageNo || undefined,
                        detailTab: 'logs',
                      })
                      const carrierRecord = carrierRecordsByBagCode[item.bagCode]
                      const currentStatus = carrierRecord?.currentStatus || item.visibleStatusMeta.label
                      return `
                      <tr class="border-b ${state.activeMasterId === item.bagId ? 'bg-blue-50/60' : 'bg-card'}">
                        <td class="px-4 py-3">
                          <button type="button" class="font-medium text-blue-700 hover:underline" data-nav="${escapeHtml(detailHref)}">${escapeHtml(item.bagCode)}</button>
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(carrierRecord?.bagSpec || `${item.bagType} / 容量 ${item.capacity} 张`)}</div>
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(`载具类型：${item.carrierType === 'box' ? '箱' : '袋'} / ${(carrierRecord?.bagMaterial || '循环载具').split('可' + '复' + '用').join('循环')}`)}</div>
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(`归属：${carrierRecord?.ownershipFactoryName || item.ownershipFactoryName || '待补货权工厂'}`)}</div>
                        </td>
                        <td class="px-4 py-3">
                          ${renderTag(currentStatus, getCarrierCurrentStatusClass(currentStatus))}
                        </td>
                        <td class="px-4 py-3">
                          <div class="font-medium text-foreground">${escapeHtml(carrierRecord?.currentUseStage || '无')}</div>
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml([carrierRecord?.currentBoundObjectType, carrierRecord?.currentBoundObjectNo].filter(Boolean).join('：') || '未绑定业务对象')}</div>
                        </td>
                        <td class="px-4 py-3">
                          <div class="font-medium text-foreground">${escapeHtml(carrierRecord?.currentLocation || item.currentLocation || '待命位')}</div>
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(carrierRecord?.enabled === false ? '已报废' : '可流转')}</div>
                        </td>
                        <td class="px-4 py-3">
                          <div class="font-medium text-foreground">${escapeHtml(`${carrierRecord?.currentFeiTicketCount || item.packedTicketCount || 0} 张菲票`)}</div>
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(`${carrierRecord?.currentPieceQty || item.currentTotalPieceCount || 0} 片裁片`)}</div>
                          <div class="mt-1 text-xs text-muted-foreground">物料：按装载明细追溯</div>
                        </td>
                        <td class="px-4 py-3">
                          <div class="font-medium text-foreground">${escapeHtml(carrierRecord?.lastUsedAt || item.currentUsage?.startedAt || '暂无使用记录')}</div>
                          <div class="mt-1 text-xs text-muted-foreground">最近交出：${escapeHtml(item.currentUsage?.dispatchAt || '暂无')}</div>
                          <div class="mt-1 text-xs text-muted-foreground">最近回收：${escapeHtml(carrierRecord?.lastReturnedAt || '暂无')}</div>
                          <div class="mt-1 text-xs text-muted-foreground">累计使用：${escapeHtml(String(carrierRecord?.totalUseCount || 0))} 次</div>
                        </td>
                        <td class="px-4 py-3">
                          <div class="font-medium ${carrierRecord?.abnormalCount ? 'text-rose-700' : 'text-muted-foreground'}">${escapeHtml(String(carrierRecord?.abnormalCount || 0))} 条</div>
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.note || '无异常备注')}</div>
                        </td>
                        <td class="px-4 py-3">
                          <div class="flex flex-wrap gap-2">
                            <button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-nav="${escapeHtml(detailHref)}">查看详情</button>
                            <button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-nav="${escapeHtml(historyHref)}">查看使用周期</button>
                            <button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-transfer-bags-action="open-inbound-pack" data-bag-id="${escapeHtml(item.bagId)}">入仓装袋</button>
                            <button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-transfer-bags-action="open-handover-pack" data-bag-id="${escapeHtml(item.bagId)}">交出装袋</button>
                            <button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-transfer-bags-action="open-abnormal" data-bag-id="${escapeHtml(item.bagId)}">标记异常</button>
                            ${currentStatus === '已交出待回收' && item.currentUsage ? `<button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-transfer-bags-action="open-return" data-usage-id="${escapeHtml(item.currentUsage.usageId)}">回收确认</button>` : ''}
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
            extraAttrs: 'data-fast-page-render="true"',
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
  const transferBagQrValue = resolveFormalBagQrValue(item)
  const historyUsages = getViewModel().usages
    .filter((usage) => usage.bagId === item.bagId)
    .sort((left, right) => right.usageNo.localeCompare(left.usageNo, 'zh-CN'))
  return renderWorkbenchSecondaryPanel({
    title: `中转袋详情：${item.bagCode}`,
    hint: '',
    defaultOpen: true,
    body: `
      <div class="grid gap-3 xl:grid-cols-[0.88fr,1.12fr]">
        <div class="space-y-3">
          <div class="space-y-3 rounded-lg border bg-muted/15 p-3 text-sm">
            <div><span class="text-muted-foreground">中转袋码：</span><span class="font-medium text-foreground">${escapeHtml(item.bagCode)}</span></div>
            <div><span class="text-muted-foreground">口袋状态：</span>${renderTag(item.pocketStatusMeta.label, item.pocketStatusMeta.className)}</div>
            <div><span class="text-muted-foreground">当前使用周期号：</span><span class="font-medium text-foreground">${escapeHtml(currentUsage?.usageNo || '暂无')}</span></div>
            <div><span class="text-muted-foreground">开始时间：</span><span class="font-medium text-foreground">${escapeHtml(currentUsage?.startedAt || '待开始')}</span></div>
            <div><span class="text-muted-foreground">交出时间：</span><span class="font-medium text-foreground">${escapeHtml(item.currentDispatchedAt || '待交出')}</span></div>
            <div><span class="text-muted-foreground">回收时间：</span><span class="font-medium text-foreground">${escapeHtml(item.currentReturnedAt || '待回收')}</span></div>
            <div><span class="text-muted-foreground">当前位置：</span><span class="font-medium text-foreground">${escapeHtml(item.currentLocation || '待命位')}</span></div>
          </div>
          <div class="space-y-3 rounded-lg border bg-muted/15 p-3 text-sm">
            <div><span class="text-muted-foreground">容量 / 当前绑定数：</span><span class="font-medium text-foreground">${escapeHtml(`${item.capacity} 张 / ${item.packedTicketCount} 张菲票`)}</span></div>
            <div><span class="text-muted-foreground">当前袋内成衣件数（件）：</span><span class="font-medium text-foreground">${escapeHtml(String(item.currentTotalPieceCount))}</span></div>
            <div><span class="text-muted-foreground">当前款号：</span><span class="font-medium text-foreground">${escapeHtml(item.currentStyleCode || '待锁定')}</span></div>
            <div><span class="text-muted-foreground">来源铺布：</span><span class="font-medium text-foreground">${escapeHtml(currentUsage?.spreadingSessionNo || currentUsage?.spreadingSessionId || '暂无')}</span></div>
            <div><span class="text-muted-foreground">来源唛架：</span><span class="font-medium text-foreground">${escapeHtml(currentUsage?.sourceMarkerNos.join(' / ') || '暂无')}</span></div>
            <div><span class="text-muted-foreground">来源生产单集合：</span><span class="font-medium text-foreground">${escapeHtml(currentUsage?.productionOrderNos.join(' / ') || '暂无')}</span></div>
            <div><span class="text-muted-foreground">来源裁片单：</span><span class="font-medium text-foreground">${escapeHtml(currentUsage?.cutOrderNos.join(' / ') || '暂无')}</span></div>
            <div><span class="text-muted-foreground">来源唛架方案：</span><span class="font-medium text-foreground">${escapeHtml(currentUsage?.markerPlanNos.join(' / ') || '暂无')}</span></div>
          </div>
          <div class="rounded-lg border bg-card p-4">
            <div class="text-sm font-semibold text-foreground">正式二维码</div>
            ${
              transferBagQrValue
                ? `
                  <div class="mt-3 flex flex-col gap-3 md:flex-row md:items-center">
                    <div class="inline-flex w-fit rounded-xl border bg-white p-3 shadow-sm">
                      ${renderRealQrPlaceholder({
                        value: transferBagQrValue,
                        size: 168,
                        title: `中转袋码 ${item.bagCode}`,
                        label: `中转袋 ${item.bagCode} 正式二维码`,
                      })}
                    </div>
                    <div class="space-y-2 text-sm">
                      <div><span class="text-muted-foreground">中转袋码：</span><span class="font-medium text-foreground">${escapeHtml(item.bagCode)}</span></div>
                      <div><span class="text-muted-foreground">当前使用周期：</span><span class="font-medium text-foreground">${escapeHtml(currentUsage?.usageNo || '暂无')}</span></div>
                      <div><span class="text-muted-foreground">二维码：</span><span class="font-medium text-foreground">已生成</span></div>
                    </div>
                  </div>
                `
                : '<div class="mt-3 rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">暂无二维码</div>'
            }
          </div>
          <div class="flex flex-wrap gap-2">
            ${item.pocketStatusKey === 'IDLE' ? `<button type="button" class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-transfer-bags-action="use-master" data-bag-id="${escapeHtml(item.bagId)}">开始装袋</button>` : ''}
            ${item.pocketStatusKey === 'PACKING' ? `<button type="button" class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-transfer-bags-action="use-master" data-bag-id="${escapeHtml(item.bagId)}">继续装袋</button>` : ''}
            ${item.pocketStatusKey === 'READY_TO_DISPATCH' && currentUsage ? `<button type="button" class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-transfer-bags-action="print-manifest" data-usage-id="${escapeHtml(currentUsage.usageId)}">打印中转袋二维码</button><button type="button" class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-transfer-bags-action="mark-dispatched" data-usage-id="${escapeHtml(currentUsage.usageId)}">交出</button>` : ''}
            ${item.pocketStatusKey === 'DISPATCHED' && currentUsage ? `<button type="button" class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-transfer-bags-action="prepare-return" data-usage-id="${escapeHtml(currentUsage.usageId)}">回收确认</button>` : ''}
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
                          <th class="px-3 py-2 text-left">面料</th>
                          <th class="px-3 py-2 text-left">部位</th>
                          <th class="px-3 py-2 text-right">菲票件数（件）</th>
                          <th class="px-3 py-2 text-left">来源生产单号</th>
                          <th class="px-3 py-2 text-left">来源裁片单号</th>
                          <th class="px-3 py-2 text-left">所属唛架方案号</th>
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
                                  ${renderMaterialIdentityBlock({
                                    materialSku: binding.ticket?.materialSku || '待补',
                                    materialLabel: binding.ticket?.materialSku || '待补',
                                    materialAlias: binding.ticket?.materialAlias || '',
                                    materialImageUrl: binding.ticket?.materialImageUrl || '',
                                  }, { compact: true })}
                                  <div class="text-xs text-muted-foreground">${escapeHtml(binding.ticket ? `${binding.ticket.color || '待补颜色'} / ${binding.ticket.size || '待补尺码'}` : '待补')}</div>
                                </td>
                                <td class="px-3 py-2">${escapeHtml(binding.ticket?.partName || '待补部位')}</td>
                                <td class="px-3 py-2 text-right tabular-nums">${escapeHtml(String(binding.qty))}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.productionOrderNo)}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.cutOrderNo)}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.markerPlanNo || binding.唛架方案No || '—')}</td>
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
                          <th class="px-3 py-2 text-right">绑定菲票数量</th>
                          <th class="px-3 py-2 text-left">交出 / 回收</th>
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
                                <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml([usage.dispatchAt || '待交出', usage.returnedAt || '待回收'].join(' / '))}</td>
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
            <span class="text-sm font-medium text-foreground">步骤 1：扫中转袋码</span>
            <div class="flex gap-2">
              <input
                type="text"
                value="${escapeHtml(state.draft.bagCodeInput)}"
                placeholder="输入或扫描中转袋码"
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
                  (item) => `<option value="${escapeHtml(item.sewingTaskId)}" ${state.draft.sewingTaskId === item.sewingTaskId ? 'selected' : ''}>${escapeHtml(`${item.sewingTaskNo} / ${formatFactoryDisplayName(item.sewingFactoryName)} / ${item.styleCode || item.spuCode}`)}</option>`,
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
                <div><span class="text-muted-foreground">中转袋码：</span><span class="font-medium text-foreground">${escapeHtml(activeUsage.bagCode)}</span></div>
                <div><span class="text-muted-foreground">当前锁定款号：</span><span class="font-medium text-foreground">${escapeHtml(activeUsage.styleCode || '待锁定')}</span></div>
                <div><span class="text-muted-foreground">车缝任务：</span><span class="font-medium text-foreground">${escapeHtml(activeUsage.sewingTaskNo)}</span></div>
                <div><span class="text-muted-foreground">车缝工厂：</span><span class="font-medium text-foreground">${escapeHtml(formatFactoryDisplayName(activeUsage.sewingFactoryName))}</span></div>
                <div><span class="text-muted-foreground">状态：</span>${renderTag(activeUsage.statusMeta.label, activeUsage.statusMeta.className)}</div>
              </div>
              <div class="space-y-2 rounded-lg border bg-muted/15 p-3 text-sm">
                <div><span class="text-muted-foreground">已绑定菲票数量：</span><span class="font-medium text-foreground">${escapeHtml(String(currentSummary?.ticketCount || 0))}</span></div>
                <div><span class="text-muted-foreground">当前袋内成衣件数（件）：</span><span class="font-medium text-foreground">${escapeHtml(String(currentSummary?.quantityTotal || 0))}</span></div>
                <div><span class="text-muted-foreground">裁片单数：</span><span class="font-medium text-foreground">${escapeHtml(String(currentSummary?.cutOrderCount || 0))}</span></div>
                <div><span class="text-muted-foreground">生产单数：</span><span class="font-medium text-foreground">${escapeHtml(String(currentSummary?.productionOrderCount || 0))}</span></div>
                <div><span class="text-muted-foreground">唛架方案汇总：</span><span class="font-medium text-foreground">${escapeHtml(activeUsage.markerPlanNos.join(' / ') || '无')}</span></div>
                <div><span class="text-muted-foreground">容量状态：</span><span class="font-medium ${capacityExceeded ? 'text-amber-700' : 'text-foreground'}">${capacityExceeded ? '已超容量' : '未超容量'}</span></div>
              </div>
            </div>
            <div class="flex flex-wrap gap-2">
              <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="print-manifest" data-usage-id="${escapeHtml(activeUsage.usageId)}">打印中转袋二维码</button>
              <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="mark-ready" data-usage-id="${escapeHtml(activeUsage.usageId)}">完成装袋</button>
              <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="mark-dispatched" data-usage-id="${escapeHtml(activeUsage.usageId)}">交出</button>
            </div>
            <div class="rounded-lg border">
              <div class="border-b px-3 py-2 text-xs font-medium text-muted-foreground">袋内菲票明细</div>
              ${currentBindings.length
                ? renderStickyTableScroller(`
                    <table class="min-w-full text-sm">
                      <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th class="px-3 py-2 text-left">菲票码</th>
                          <th class="px-3 py-2 text-left">面料卷号</th>
                          <th class="px-3 py-2 text-left">布料颜色</th>
                          <th class="px-3 py-2 text-left">尺码</th>
                          <th class="px-3 py-2 text-left">部位</th>
                          <th class="px-3 py-2 text-right">数量</th>
                          <th class="px-3 py-2 text-left">扎号</th>
                          <th class="px-3 py-2 text-left">裁片单</th>
                          <th class="px-3 py-2 text-left">生产单</th>
                          <th class="px-3 py-2 text-left">唛架方案</th>
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
                                <td class="px-3 py-2">${escapeHtml(binding.fabricRollNo || binding.ticket?.fabricRollNo || '暂无数据')}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.fabricColor || binding.ticket?.fabricColor || '暂无数据')}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.size || binding.ticket?.size || '暂无数据')}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.partName || binding.ticket?.partName || '待补部位')}</td>
                                <td class="px-3 py-2 text-right tabular-nums">${escapeHtml(String(binding.qty))}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.bundleNo || binding.ticket?.bundleNo || '暂无数据')}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.cutOrderNo)}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.productionOrderNo)}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.markerPlanNo || binding.唛架方案No || '无')}</td>
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
          : '<div class="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">当前尚未选中使用周期。请先创建或从交出台账中选择一个使用周期。</div>'}
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
          .map((item) => renderWorkbenchFilterChip(`${item.ticketNo} / ${item.cutOrderNo}`, 'data-transfer-bags-action="set-ticket-input" data-ticket-no="' + escapeHtml(item.ticketNo) + '"', 'blue'))
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
          <h2 class="text-sm font-semibold text-foreground">交出台账</h2>
        </div>
      </div>
      ${renderStickyFilterShell(`
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label class="space-y-2 xl:col-span-2">
            <span class="text-sm font-medium text-foreground">关键词</span>
            <input
              type="text"
              value="${escapeHtml(state.usageKeyword)}"
              placeholder="支持使用周期号 / 中转袋码 / 车缝任务号 / 裁片单"
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
              <option value="READY_TO_DISPATCH" ${state.usageStatus === 'READY_TO_DISPATCH' ? 'selected' : ''}>待交出</option>
              <option value="DISPATCHED" ${state.usageStatus === 'DISPATCHED' ? 'selected' : ''}>已交出待回收</option>
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
                  <th class="px-4 py-3 text-left">中转袋码</th>
                  <th class="px-4 py-3 text-left">阶段 / 车缝任务</th>
                  <th class="px-4 py-3 text-left">车缝工厂</th>
                  <th class="px-4 py-3 text-right">菲票数量</th>
                  <th class="px-4 py-3 text-right">裁片单数</th>
                  <th class="px-4 py-3 text-left">使用周期状态</th>
                  <th class="px-4 py-3 text-left">交出时间</th>
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
                        <td class="px-4 py-3">
                          <div class="font-medium text-foreground">${escapeHtml(item.usageStageLabel || '交出装袋')}</div>
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.sewingTaskNo || (item.usageStage === 'INBOUND_TEMP' ? '待分配' : '未绑定'))}</div>
                        </td>
                        <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(formatFactoryDisplayName(item.sewingFactoryName))}</td>
                        <td class="px-4 py-3 text-right tabular-nums">${escapeHtml(String(item.summary.ticketCount))}</td>
                        <td class="px-4 py-3 text-right tabular-nums">${escapeHtml(String(item.summary.cutOrderCount))}</td>
                        <td class="px-4 py-3">${renderTag(item.statusMeta.label, item.statusMeta.className)}</td>
                        <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(item.dispatchAt || '待交出')}</td>
                        <td class="px-4 py-3">
                          <div class="flex flex-wrap gap-2">
                            <button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-transfer-bags-action="select-usage" data-usage-id="${escapeHtml(item.usageId)}">查看详情</button>
                            <button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-transfer-bags-action="print-manifest" data-usage-id="${escapeHtml(item.usageId)}">打印二维码</button>
                            <button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-transfer-bags-action="mark-dispatched" data-usage-id="${escapeHtml(item.usageId)}">标记交出</button>
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
    countText: `${item.summary.ticketCount} 张票 / ${item.summary.cutOrderCount} 个裁片单`,
    defaultOpen: true,
    body: `
      <div class="grid gap-3 xl:grid-cols-[0.9fr,1.1fr]">
        <div class="space-y-3 rounded-lg border bg-muted/15 p-3 text-sm">
          <div><span class="text-muted-foreground">中转袋码：</span><span class="font-medium text-foreground">${escapeHtml(item.bagCode)}</span></div>
          <div><span class="text-muted-foreground">车缝任务：</span><span class="font-medium text-foreground">${escapeHtml(item.sewingTaskNo)}</span></div>
          <div><span class="text-muted-foreground">车缝工厂：</span><span class="font-medium text-foreground">${escapeHtml(formatFactoryDisplayName(item.sewingFactoryName))}</span></div>
          <div><span class="text-muted-foreground">菲票数量：</span><span class="font-medium text-foreground">${escapeHtml(String(item.summary.ticketCount))}</span></div>
          <div><span class="text-muted-foreground">生产单数：</span><span class="font-medium text-foreground">${escapeHtml(String(item.summary.productionOrderCount))}</span></div>
          <div><span class="text-muted-foreground">最新清单：</span><span class="font-medium text-foreground">${escapeHtml(item.latestManifest?.manifestId || '尚未打印')}</span></div>
          <div class="flex flex-wrap gap-2">
            <button type="button" class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-transfer-bags-action="go-cut-orders" data-usage-id="${escapeHtml(item.usageId)}">去来源裁片单</button>
            <button type="button" class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-transfer-bags-action="go-summary" data-usage-id="${escapeHtml(item.usageId)}">去裁剪结果核查</button>
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
        <h2 class="text-sm font-semibold text-foreground">已交出待回收使用周期列表</h2>
      </div>
      ${renderStickyFilterShell(`
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label class="space-y-2 xl:col-span-3">
            <span class="text-sm font-medium text-foreground">关键词</span>
            <input
              type="text"
              value="${escapeHtml(state.returnKeyword)}"
              placeholder="支持使用周期号 / 中转袋码 / 车缝任务号 / 裁片单号"
              class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              data-transfer-bags-return-field="keyword"
            />
          </label>
          <label class="space-y-2">
            <span class="text-sm font-medium text-foreground">回收状态</span>
            <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-return-field="status">
              <option value="ALL" ${state.returnStatus === 'ALL' ? 'selected' : ''}>全部</option>
              <option value="WAITING_RETURN" ${state.returnStatus === 'WAITING_RETURN' ? 'selected' : ''}>已交出待回收</option>
              <option value="RETURN_INSPECTING" ${state.returnStatus === 'RETURN_INSPECTING' ? 'selected' : ''}>回收确认中</option>
              <option value="CLOSED" ${state.returnStatus === 'CLOSED' ? 'selected' : ''}>已关闭</option>
              <option value="EXCEPTION_CLOSED" ${state.returnStatus === 'EXCEPTION_CLOSED' ? 'selected' : ''}>异常关闭</option>
            </select>
          </label>
        </div>
      `)}
      ${!items.length
        ? '<div class="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">暂无已交出待回收使用周期</div>'
        : renderStickyTableScroller(`
            <table class="min-w-full text-sm">
              <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th class="px-4 py-3 text-left">使用周期号</th>
                  <th class="px-4 py-3 text-left">中转袋码</th>
                  <th class="px-4 py-3 text-left">车缝任务号</th>
                  <th class="px-4 py-3 text-left">车缝工厂</th>
                  <th class="px-4 py-3 text-left">交出时间</th>
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
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.latestReturnReceipt?.returnAt || '尚未创建回收草稿')}</div>
                        </td>
                        <td class="px-4 py-3">${escapeHtml(item.bagCode)}</td>
                        <td class="px-4 py-3">${escapeHtml(item.sewingTaskNo)}</td>
                        <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(formatFactoryDisplayName(item.sewingFactoryName))}</td>
                        <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(item.dispatchAt || '待交出')}</td>
                        <td class="px-4 py-3">${renderTag(item.statusMeta.label, item.statusMeta.className)}</td>
                        <td class="px-4 py-3">${item.bagStatusMeta ? renderTag(item.bagStatusMeta.label, item.bagStatusMeta.className) : '<span class="text-xs text-muted-foreground">待补</span>'}</td>
                        <td class="px-4 py-3">
                          <div class="flex flex-wrap gap-2">
                            <button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-transfer-bags-action="prepare-return" data-usage-id="${escapeHtml(item.usageId)}">回收确认</button>
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
          <h2 class="text-sm font-semibold text-foreground">回收确认工作区</h2>
        </div>
        ${activeUsage
          ? `
            <div class="grid gap-3 md:grid-cols-2">
              <div class="space-y-2 rounded-lg border bg-muted/15 p-3 text-sm">
                <div><span class="text-muted-foreground">使用周期号：</span><span class="font-medium text-foreground">${escapeHtml(activeUsage.usageNo)}</span></div>
                <div><span class="text-muted-foreground">中转袋码：</span><span class="font-medium text-foreground">${escapeHtml(activeUsage.bagCode)}</span></div>
                <div><span class="text-muted-foreground">车缝任务：</span><span class="font-medium text-foreground">${escapeHtml(activeUsage.sewingTaskNo)}</span></div>
                <div><span class="text-muted-foreground">当前状态：</span>${renderTag(activeUsage.statusMeta.label, activeUsage.statusMeta.className)}</div>
                <div><span class="text-muted-foreground">口袋状态：</span>${activeUsage.bagStatusMeta ? renderTag(activeUsage.bagStatusMeta.label, activeUsage.bagStatusMeta.className) : '<span class="text-xs text-muted-foreground">待补</span>'}</div>
              </div>
              <div class="space-y-2 rounded-lg border bg-muted/15 p-3 text-sm">
                <div><span class="text-muted-foreground">菲票数量：</span><span class="font-medium text-foreground">${escapeHtml(String(activeUsage.summary.ticketCount))}</span></div>
                <div><span class="text-muted-foreground">裁片单数：</span><span class="font-medium text-foreground">${escapeHtml(String(activeUsage.summary.cutOrderCount))}</span></div>
                <div><span class="text-muted-foreground">生产单数：</span><span class="font-medium text-foreground">${escapeHtml(String(activeUsage.summary.productionOrderCount))}</span></div>
                <div><span class="text-muted-foreground">回收资格：</span><span class="font-medium ${activeUsage.returnEligibility.ok ? 'text-emerald-700' : 'text-amber-700'}">${escapeHtml(activeUsage.returnEligibility.ok ? '可进入回收确认' : activeUsage.returnEligibility.reason)}</span></div>
              </div>
            </div>
            <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label class="space-y-2">
                <span class="text-sm font-medium text-foreground">回收仓 / 回收点</span>
                <input type="text" value="${escapeHtml(state.returnDraft.returnWarehouseName)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-return-draft-field="returnWarehouseName" />
              </label>
              <label class="space-y-2">
                <span class="text-sm font-medium text-foreground">回收时间</span>
                <input type="text" value="${escapeHtml(state.returnDraft.returnAt)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-return-draft-field="returnAt" />
              </label>
              <label class="space-y-2">
                <span class="text-sm font-medium text-foreground">回收人</span>
                <input type="text" value="${escapeHtml(state.returnDraft.returnedBy)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-return-draft-field="returnedBy" />
              </label>
              <label class="space-y-2">
                <span class="text-sm font-medium text-foreground">回收确认人</span>
                <input type="text" value="${escapeHtml(state.returnDraft.receivedBy)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-return-draft-field="receivedBy" />
              </label>
              <label class="space-y-2">
                <span class="text-sm font-medium text-foreground">回收成衣件数摘要（件）</span>
                <input type="number" value="${escapeHtml(state.returnDraft.returnedFinishedQty)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-return-draft-field="returnedFinishedQty" />
              </label>
              <label class="space-y-2">
                <span class="text-sm font-medium text-foreground">回收菲票数量摘要</span>
                <input type="number" value="${escapeHtml(state.returnDraft.returnedTicketCountSummary)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-return-draft-field="returnedTicketCountSummary" />
              </label>
              <label class="space-y-2">
                <span class="text-sm font-medium text-foreground">差异类型</span>
                <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-return-draft-field="discrepancyType">
                  <option value="NONE" ${state.returnDraft.discrepancyType === 'NONE' ? 'selected' : ''}>无差异</option>
                  <option value="QTY_MISMATCH" ${state.returnDraft.discrepancyType === 'QTY_MISMATCH' ? 'selected' : ''}>件数异常</option>
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
                  <option value="DIRTY" ${state.conditionDraft.cleanlinessStatus === 'DIRTY' ? 'selected' : ''}>已记录异常</option>
                </select>
              </label>
              <label class="space-y-2">
                <span class="text-sm font-medium text-foreground">损坏说明</span>
                <input type="text" value="${escapeHtml(state.conditionDraft.damageType)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-condition-field="damageType" />
              </label>
              <label class="space-y-2">
                <span class="text-sm font-medium text-foreground">回收结果</span>
                <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-condition-field="reusableDecision">
                  <option value="REUSABLE" ${state.conditionDraft.reusableDecision === 'REUSABLE' ? 'selected' : ''}>可继续使用</option>
                  <option value="WAITING_CLEANING" ${state.conditionDraft.reusableDecision === 'WAITING_CLEANING' ? 'selected' : ''}>可继续使用</option>
                  <option value="WAITING_REPAIR" ${state.conditionDraft.reusableDecision === 'WAITING_REPAIR' ? 'selected' : ''}>可继续使用</option>
                  <option value="DISABLED" ${state.conditionDraft.reusableDecision === 'DISABLED' ? 'selected' : ''}>报废</option>
                </select>
              </label>
              <label class="space-y-2">
                <span class="text-sm font-medium text-foreground">维修需求</span>
                <label class="flex h-10 items-center gap-2 rounded-md border bg-background px-3 text-sm">
                  <input type="checkbox" ${state.conditionDraft.repairNeeded ? 'checked' : ''} data-transfer-bags-condition-toggle="repairNeeded" />
                <span>记录异常</span>
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
              <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="prepare-return" data-usage-id="${escapeHtml(activeUsage.usageId)}">创建回收草稿</button>
              <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="complete-return-inspection" data-usage-id="${escapeHtml(activeUsage.usageId)}">完成回收</button>
              <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="close-usage-cycle" data-usage-id="${escapeHtml(activeUsage.usageId)}">关闭使用周期</button>
              <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="clear-return-draft">重置回收草稿</button>
            </div>
          `
          : '<div class="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">请先选择一个已交出待回收使用周期</div>'}
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
        <h2 class="text-sm font-semibold text-foreground">使用周期台账</h2>
      </div>
      ${!cycles.length
        ? '<div class="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">当前尚无使用周期台账。</div>'
        : renderStickyTableScroller(`
            <table class="min-w-full text-sm">
              <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th class="px-4 py-3 text-left">中转袋码</th>
                  <th class="px-4 py-3 text-right">总使用次数</th>
                  <th class="px-4 py-3 text-right">总交出次数</th>
                  <th class="px-4 py-3 text-right">总回收次数</th>
                  <th class="px-4 py-3 text-left">最近交出</th>
                  <th class="px-4 py-3 text-left">最近回收</th>
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
          <th class="px-4 py-3 text-left">中转袋码</th>
          <th class="px-4 py-3 text-left">最新使用周期号</th>
          <th class="px-4 py-3 text-left">袋况</th>
          <th class="px-4 py-3 text-left">异常记录</th>
          <th class="px-4 py-3 text-left">异常说明</th>
          <th class="px-4 py-3 text-left">回收结果</th>
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
                <td class="px-4 py-3">${escapeHtml(item.conditionStatus === 'GOOD' ? '完好' : item.conditionStatus === 'MINOR_DAMAGE' ? '有异常' : '报废')}</td>
                <td class="px-4 py-3">${escapeHtml(item.cleanlinessStatus === 'CLEAN' ? '无' : '已记录')}</td>
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
            placeholder="支持中转袋码 / 菲票码 / 裁片单号 / 唛架方案号"
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
                  <th class="px-4 py-3 text-left">中转袋码</th>
                  <th class="px-4 py-3 text-left">使用周期号</th>
                  <th class="px-4 py-3 text-left">菲票码</th>
                  <th class="px-4 py-3 text-left">面料卷号</th>
                  <th class="px-4 py-3 text-left">布料颜色</th>
                  <th class="px-4 py-3 text-left">尺码</th>
                  <th class="px-4 py-3 text-left">裁片部位</th>
                  <th class="px-4 py-3 text-left">数量</th>
                  <th class="px-4 py-3 text-left">扎号</th>
                  <th class="px-4 py-3 text-left">裁片单号</th>
                  <th class="px-4 py-3 text-left">生产单号</th>
                  <th class="px-4 py-3 text-left">唛架方案号</th>
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
                        <td class="px-4 py-3">${escapeHtml(item.fabricRollNo || item.ticket?.fabricRollNo || '暂无数据')}</td>
                        <td class="px-4 py-3">${escapeHtml(item.fabricColor || item.ticket?.fabricColor || '暂无数据')}</td>
                        <td class="px-4 py-3">${escapeHtml(item.size || item.ticket?.size || '暂无数据')}</td>
                        <td class="px-4 py-3">${escapeHtml(item.partName || item.ticket?.partName || '暂无数据')}</td>
                        <td class="px-4 py-3">${escapeHtml(String(item.garmentQty || item.qty || 0))}</td>
                        <td class="px-4 py-3">${escapeHtml(item.bundleNo || item.ticket?.bundleNo || '暂无数据')}</td>
                        <td class="px-4 py-3">${escapeHtml(item.cutOrderNo)}</td>
                        <td class="px-4 py-3">${escapeHtml(item.productionOrderNo)}</td>
                        <td class="px-4 py-3">${escapeHtml(item.markerPlanNo || item.唛架方案No || '无')}</td>
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
      ${renderCuttingPageHeader(meta, { actionsHtml: renderListHeaderActions() })}
      ${renderPrefilterBar()}
      ${renderLandingBanner()}
      ${renderFeedbackBar()}
      ${renderMasterQuickFilterBar()}
      ${renderTransferBagListTabs()}
      ${renderTransferBagListTabPanel()}
      ${renderActiveDialog()}
    </div>
  `
}

function renderDetailEmptyState(): string {
  return `
    <section class="rounded-lg border border-dashed bg-card px-6 py-12 text-center text-sm text-muted-foreground">
      未找到对应中转袋，请返回列表重新选择。
    </section>
  `
}

function renderTransferBagDetailHeader(
  activeMaster: TransferBagMasterItem,
  focusedUsage: TransferBagUsageItem | null,
): string {
  const transferBagQrValue = resolveFormalBagQrValue(activeMaster)
  const summary = focusedUsage ? buildTransferBagParentChildSummary(focusedUsage.bindingItems || []) : null
  const carrierRecord = getCarrierMasterRecordMap()[activeMaster.bagCode]
  const currentStatus = carrierRecord?.currentStatus || focusedUsage?.visibleStatusMeta.label || activeMaster.visibleStatusMeta.label
  const summaryItems = [
    {
      label: '中转袋码',
      valueHtml: `<span class="text-sm font-semibold text-foreground">${escapeHtml(activeMaster.bagCode)}</span>`,
    },
    {
      label: '当前状态',
      valueHtml: renderTag(currentStatus, getCarrierCurrentStatusClass(currentStatus)),
    },
    {
      label: '当前所在位置',
      valueHtml: `<span class="text-sm font-semibold text-foreground">${escapeHtml(carrierRecord?.currentLocation || activeMaster.currentLocation || '待命位')}</span>`,
    },
    {
      label: '当前使用阶段',
      valueHtml: `<span class="text-sm font-semibold text-foreground">${escapeHtml(carrierRecord?.currentUseStage || '无')}</span>`,
    },
    {
      label: '绑定对象',
      valueHtml: `<span class="text-sm font-semibold text-foreground">${escapeHtml(carrierRecord?.currentBoundObjectNo || focusedUsage?.boundObjectNo || '未绑定')}</span>`,
    },
    {
      label: '当前装载',
      valueHtml: `<span class="text-sm font-semibold text-foreground">${escapeHtml(`${summary?.ticketCount || 0} 张 / ${activeMaster.capacity} 张`)}</span>`,
    },
  ]

  return `
    <section data-transfer-bag-summary-strip class="rounded-xl border bg-card px-4 py-3">
      <div class="flex flex-wrap items-center gap-x-6 gap-y-3">
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
        <div data-transfer-bag-summary-qr class="flex items-center gap-3">
          ${
            transferBagQrValue
              ? `
                <div class="inline-flex shrink-0 rounded-lg border bg-white p-2">
                  ${renderRealQrPlaceholder({
                    value: transferBagQrValue,
                    size: 72,
                    title: `中转袋码 ${activeMaster.bagCode}`,
                    label: `中转袋二维码 ${activeMaster.bagCode}`,
                  })}
                </div>
              `
              : '<div class="inline-flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-lg border border-dashed text-[11px] text-muted-foreground">暂无二维码</div>'
          }
          <div class="min-w-0">
            <div class="text-[11px] text-muted-foreground">中转袋二维码</div>
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
    { key: 'basic', label: '基本信息' },
    { key: 'current', label: '当前使用' },
    { key: 'history', label: '使用周期' },
    { key: 'items', label: '装载明细' },
    { key: 'recovery', label: '回收确认' },
    { key: 'logs', label: '异常记录' },
  ]

  return `
    <nav class="rounded-xl border bg-card p-2" aria-label="中转袋详情页签">
      <div class="flex flex-wrap gap-2" role="tablist" aria-label="中转袋详情页签">
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
  { id: 'scan', index: 1, label: '扫码装袋' },
  { id: 'review', index: 2, label: '核对完成' },
  { id: 'handover', index: 3, label: '交出' },
]

function getBaggingActiveStepId(
  focusedUsage: TransferBagUsageItem | null,
  currentSummary: ReturnType<typeof buildTransferBagParentChildSummary> | null,
): TransferBagBaggingStepId | null {
  void currentSummary
  if (!focusedUsage) return 'scan'
  if (['DISPATCHED', 'PENDING_SIGNOFF', 'WAITING_RETURN', 'RETURN_INSPECTING', 'CLOSED', 'EXCEPTION_CLOSED'].includes(focusedUsage.usageStatus)) return null
  if (focusedUsage.usageStatus === 'READY_TO_DISPATCH') return 'handover'
  return 'scan'
}

function getBaggingStepState(
  stepId: TransferBagBaggingStepId,
  activeStepId: TransferBagBaggingStepId | null,
  focusedUsage: TransferBagUsageItem | null,
): TransferBagBaggingStepState {
  if (!focusedUsage) return stepId === 'scan' ? 'active' : 'locked'
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
  const isInboundTempUsage = focusedUsage?.usageStage === 'INBOUND_TEMP'
  if (stepId === 'scan') {
    if (!focusedUsage) return `扫描首张菲票后，自动开始 ${activeMaster.bagCode} 本次周转`
    return isInboundTempUsage ? `已暂存 ${currentSummary?.ticketCount || 0} 张菲票` : `已装 ${currentSummary?.ticketCount || 0} 张菲票`
  }
  if (stepId === 'review') {
    if (!focusedUsage) return '装袋后再核对袋内内容'
    if (!currentSummary?.ticketCount) return '当前还没有菲票，请先扫码装袋'
    if (isInboundTempUsage) return '入仓暂存袋内容可混装，交出前再按车缝任务分拣装袋'
    return capacityExceeded ? '当前容量已超出，请先核对后再完成装袋' : '袋内内容待核对，可打印清单后完成装袋'
  }
  if (!focusedUsage) return '完成装袋后才可交出'
  if (isInboundTempUsage) return '车缝任务分配后进入交出装袋阶段'
  return focusedUsage.dispatchAt ? `已于 ${focusedUsage.dispatchAt} 交出` : '完成核对后即可交出'
}

function buildBaggingStepHelperText(step: TransferBagBaggingStepView): string {
  if (step.id === 'scan') {
    return step.state === 'locked' ? '本次周转完成后才能再次扫码装袋' : '入仓暂存可混装；交出装袋按交出单或交出记录核对'
  }
  if (step.id === 'review') {
    return step.state === 'locked' ? '请先扫码装袋，再核对袋内内容' : '核对袋内内容，确认后完成装袋'
  }
  return step.state === 'locked' ? '完成装袋后才能进入下一阶段' : '交出装袋阶段必须绑定交出单或交出记录'
}

function getBaggingStepViews(
  activeMaster: TransferBagMasterItem,
  focusedUsage: TransferBagUsageItem | null,
  currentSummary: ReturnType<typeof buildTransferBagParentChildSummary> | null,
  capacityExceeded: boolean,
): TransferBagBaggingStepView[] {
  const activeStepId = getBaggingActiveStepId(focusedUsage, currentSummary)
  return transferBagBaggingStepMeta
    .map((meta) => {
      const state = getBaggingStepState(meta.id, activeStepId, focusedUsage)
      return {
        ...meta,
        state,
        summary: buildBaggingStepSummary(meta.id, activeMaster, focusedUsage, currentSummary, capacityExceeded),
        helperText: '',
        open: state === 'active',
      }
    })
    .map((item) => ({
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

function renderBaggingInlineField(label: string, value: string, valueClassName = 'text-foreground'): string {
  return `
    <div class="text-sm">
      <span class="text-muted-foreground">${escapeHtml(label)}：</span>
      <span class="font-medium ${valueClassName}">${escapeHtml(value)}</span>
    </div>
  `
}

function renderBaggedTicketCompactList(
  currentBindings: TransferBagBindingItem[],
  focusedUsage: TransferBagUsageItem | null,
): string {
  if (!currentBindings.length || !focusedUsage) {
    return '<div class="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">当前还没有已装袋菲票，请先扫码加入本袋。</div>'
  }

  return `
    <div class="rounded-lg border bg-card">
      <div class="border-b px-3 py-2 text-sm font-medium text-foreground">已装袋菲票</div>
      ${renderStickyTableScroller(
        `
          <table class="min-w-full text-sm">
            <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th class="px-3 py-2 text-left">菲票码</th>
                <th class="px-3 py-2 text-left">裁片单</th>
                <th class="px-3 py-2 text-left">款号</th>
                <th class="px-3 py-2 text-left">车缝工厂</th>
                <th class="px-3 py-2 text-left">任务单号</th>
              </tr>
            </thead>
            <tbody>
              ${currentBindings
                .map(
                  (binding) => `
                    <tr class="border-b bg-card">
                      <td class="px-3 py-2 font-medium text-foreground">${escapeHtml(binding.ticketNo)}</td>
                      <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(binding.cutOrderNo || '—')}</td>
                      <td class="px-3 py-2">${escapeHtml(binding.ticket?.styleCode || focusedUsage.styleCode || '待补')}</td>
                      <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(formatFactoryDisplayName(focusedUsage.sewingFactoryName) || '待锁定')}</td>
                      <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(focusedUsage.sewingTaskNo || '待锁定')}</td>
                    </tr>
                  `,
                )
                .join('')}
            </tbody>
          </table>
        `,
        'max-h-[18vh]',
      )}
    </div>
  `
}

function renderBaggingScanStepCard(
  step: TransferBagBaggingStepView,
  focusedUsage: TransferBagUsageItem | null,
  currentBindings: TransferBagBindingItem[],
  currentSummary: ReturnType<typeof buildTransferBagParentChildSummary>,
  candidateTickets: TransferBagTicketCandidate[],
  capacityExceeded: boolean,
): string {
  const canEditBindings = !focusedUsage
    ? true
    : !['DISPATCHED', 'PENDING_SIGNOFF', 'WAITING_RETURN', 'RETURN_INSPECTING', 'CLOSED', 'EXCEPTION_CLOSED'].includes(focusedUsage.usageStatus)

  return renderBaggingStepCard(
    step,
    `
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
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          ${renderBaggingInlineField('已装菲票数量', `${currentSummary.ticketCount} 张`)}
          ${renderBaggingInlineField('容量状态', capacityExceeded ? '已超容量' : '容量正常', capacityExceeded ? 'text-amber-700' : 'text-foreground')}
          ${
            focusedUsage
              ? `
                ${renderBaggingInlineField('车缝工厂', formatFactoryDisplayName(focusedUsage.sewingFactoryName) || '待锁定')}
                ${renderBaggingInlineField('车缝任务', focusedUsage.sewingTaskNo || '待锁定')}
                ${renderBaggingInlineField('当前款号', focusedUsage.styleCode || '待锁定')}
              `
              : ''
          }
        </div>
        ${focusedUsage
          ? ''
          : '<div class="rounded-lg border border-dashed px-4 py-4 text-sm text-muted-foreground">扫描首张菲票后，会自动开始本次周转并锁定车缝工厂 / 款号上下文。</div>'}
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
                        `${item.ticketNo} / ${item.cutOrderNo}`,
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
        ${renderBaggedTicketCompactList(currentBindings, focusedUsage)}
        ${capacityExceeded ? '<div class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">当前装袋数量已超容量，请先核对袋内内容再继续操作。</div>' : ''}
        ${canEditBindings ? '' : '<div class="rounded-lg border border-dashed px-4 py-5 text-sm text-muted-foreground">当前状态下不可继续扫码装袋，请在回收页签处理后续回收。</div>'}
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
            ${renderDetailMetric('已绑菲票数量', String(currentSummary.ticketCount))}
            ${renderDetailMetric('来源裁片单数', String(currentSummary.cutOrderCount))}
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
                          <th class="px-3 py-2 text-left">面料卷号</th>
                          <th class="px-3 py-2 text-left">布料颜色</th>
                          <th class="px-3 py-2 text-left">尺码</th>
                          <th class="px-3 py-2 text-left">部位</th>
                          <th class="px-3 py-2 text-right">数量</th>
                          <th class="px-3 py-2 text-left">扎号</th>
                          <th class="px-3 py-2 text-left">裁片单</th>
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
                                <td class="px-3 py-2">${escapeHtml(binding.fabricRollNo || binding.ticket?.fabricRollNo || '暂无数据')}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.fabricColor || binding.ticket?.fabricColor || '暂无数据')}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.size || binding.ticket?.size || '暂无数据')}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.partName || binding.ticket?.partName || '暂无数据')}</td>
                                <td class="px-3 py-2 text-right tabular-nums">${escapeHtml(String(binding.qty))}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.bundleNo || binding.ticket?.bundleNo || '暂无数据')}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.cutOrderNo || '—')}</td>
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
            ${currentBindings.length ? `<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="print-manifest" data-usage-id="${escapeHtml(focusedUsage.usageId)}">打印中转袋二维码</button>` : ''}
            ${currentBindings.length && ['DRAFT', 'PACKING'].includes(focusedUsage.usageStatus) ? `<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="mark-ready" data-usage-id="${escapeHtml(focusedUsage.usageId)}">完成装袋</button>` : ''}
          </div>
          ${currentBindings.length
            ? ''
            : '<div class="text-sm text-muted-foreground">当前还没有装入菲票，暂不能完成装袋。</div>'}
          ${(focusedUsage.productionOrderNos.length || focusedUsage.cutOrderNos.length || focusedUsage.markerPlanNos.length)
            ? `
              <details class="rounded-lg border bg-muted/10 p-3" data-testid="transfer-bags-source-trace-fold" data-default-open="collapsed">
                <summary class="cursor-pointer text-sm font-medium text-foreground">追溯信息</summary>
                <div class="mt-3 grid gap-3 md:grid-cols-3 text-sm">
                  <div><span class="text-muted-foreground">来源生产单：</span><span class="font-medium text-foreground">${escapeHtml(focusedUsage.productionOrderNos.join(' / ') || '暂无')}</span></div>
                  <div><span class="text-muted-foreground">来源裁片单：</span><span class="font-medium text-foreground">${escapeHtml(focusedUsage.cutOrderNos.join(' / ') || '暂无')}</span></div>
                  <div><span class="text-muted-foreground">来源唛架方案：</span><span class="font-medium text-foreground">${escapeHtml(focusedUsage.markerPlanNos.join(' / ') || '暂无')}</span></div>
                </div>
              </details>
            `
            : ''}
        </div>
      `,
  )
}

function renderBaggingHandoverStepCard(
  step: TransferBagBaggingStepView,
  focusedUsage: TransferBagUsageItem | null,
  currentSummary: ReturnType<typeof buildTransferBagParentChildSummary>,
): string {
  return renderBaggingStepCard(
    step,
    !focusedUsage
      ? '<div class="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">完成装袋后，才会进入交出步骤。</div>'
      : `
        <div class="space-y-3">
          <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            ${renderDetailMetric('本次周转号', focusedUsage.usageNo)}
            ${renderDetailMetric('中转袋码', focusedUsage.bagCode)}
            ${renderDetailMetric('车缝工厂', formatFactoryDisplayName(focusedUsage.sewingFactoryName) || '待锁定')}
            ${renderDetailMetric('已装菲票数量', `${currentSummary.ticketCount}`)}
            ${renderDetailMetric('当前状态', focusedUsage.visibleStatusMeta.label)}
          </div>
          <div class="flex flex-wrap gap-2">
            ${focusedUsage.usageStatus === 'READY_TO_DISPATCH' ? `<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="mark-dispatched" data-usage-id="${escapeHtml(focusedUsage.usageId)}">交出</button>` : ''}
          </div>
          ${focusedUsage.usageStatus === 'READY_TO_DISPATCH' ? '<div class="text-sm text-muted-foreground">核对无误后交出即可，裁片仓侧主流程至此完成。</div>' : '<div class="text-sm text-muted-foreground">当前步骤仅保留交出结果摘要。</div>'}
        </div>
      `,
  )
}

function renderTransferBagBasicTab(
  activeMaster: TransferBagMasterItem,
  focusedUsage: TransferBagUsageItem | null,
): string {
  void focusedUsage
  const carrierRecord = getCarrierMasterRecordMap()[activeMaster.bagCode]
  const currentStatus = carrierRecord?.currentStatus || activeMaster.visibleStatusMeta.label

  return `
    <section id="transfer-bag-tabpanel-basic" role="tabpanel" aria-labelledby="transfer-bag-tab-basic" class="rounded-xl border bg-card p-4">
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        ${renderDetailMetric('袋码', activeMaster.bagCode)}
        ${renderDetailMetric('中转袋名称', carrierRecord?.bagName || activeMaster.bagCode)}
        ${renderDetailMetric('规格', carrierRecord?.bagSpec || `${activeMaster.bagType} / 容量 ${activeMaster.capacity} 张菲票`)}
            ${renderDetailMetric('材质', (carrierRecord?.bagMaterial || '循环软袋').split('可' + '复' + '用').join('循环'))}
        ${renderDetailMetric('归属工厂（货权）', carrierRecord?.ownershipFactoryName || activeMaster.ownershipFactoryName || '待补')}
        ${renderDetailMetric('载具类型', activeMaster.carrierType === 'box' ? '箱' : '袋')}
        ${renderDetailMetric('当前状态', currentStatus)}
        ${renderDetailMetric('当前所在位置', carrierRecord?.currentLocation || activeMaster.currentLocation || '待命位')}
        ${renderDetailMetric('是否启用', carrierRecord?.enabled === false ? '报废' : '启用')}
        ${renderDetailMetric('使用次数', `${carrierRecord?.totalUseCount || 0} 次`)}
        ${renderDetailMetric('异常次数', `${carrierRecord?.abnormalCount || 0} 次`, carrierRecord?.abnormalCount ? 'text-rose-700' : 'text-foreground')}
      </div>
    </section>
  `
}

function renderTransferBagCurrentTab(
  activeMaster: TransferBagMasterItem,
  focusedUsage: TransferBagUsageItem | null,
): string {
  const carrierRecord = getCarrierMasterRecordMap()[activeMaster.bagCode]
  const currentBindings = focusedUsage ? getViewModel().bindingsByUsageId[focusedUsage.usageId] || [] : []
  const currentSummary = buildTransferBagParentChildSummary(currentBindings)

  return `
    <section id="transfer-bag-tabpanel-current" role="tabpanel" aria-labelledby="transfer-bag-tab-current" class="space-y-3 rounded-xl border bg-card p-4">
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        ${renderDetailMetric('当前使用阶段', carrierRecord?.currentUseStage || '无')}
        ${renderDetailMetric('当前使用记录', focusedUsage?.usageNo || '暂无')}
        ${renderDetailMetric('绑定对象类型', carrierRecord?.currentBoundObjectType || focusedUsage?.boundObjectType || '无')}
        ${renderDetailMetric('绑定对象单号', carrierRecord?.currentBoundObjectNo || focusedUsage?.boundObjectNo || '无')}
        ${renderDetailMetric('接收对象类型', focusedUsage?.receiverType || (focusedUsage?.usageStage === 'INBOUND_TEMP' ? '仓库' : '工厂'))}
        ${renderDetailMetric('接收对象', focusedUsage?.receiverName || formatFactoryDisplayName(focusedUsage?.sewingFactoryName || '') || '待指定')}
        ${renderDetailMetric('当前库区', focusedUsage?.usageStage === 'INBOUND_TEMP' ? '裁片暂存区' : '交出备货区')}
        ${renderDetailMetric('当前库位', carrierRecord?.currentLocation || activeMaster.currentLocation || '待命位')}
        ${renderDetailMetric('当前装载摘要', `${currentSummary.ticketCount} 张菲票 / ${currentSummary.quantityTotal} 片裁片`)}
      </div>
      ${
        focusedUsage
          ? `<div class="rounded-lg border bg-muted/10 p-3 text-sm text-muted-foreground">${escapeHtml(focusedUsage.note || '当前使用记录暂无备注。')}</div>`
          : '<div class="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">当前中转袋暂无打开中的使用记录。</div>'
      }
    </section>
  `
}

function renderTransferBagItemsTab(
  activeMaster: TransferBagMasterItem,
  focusedUsage: TransferBagUsageItem | null,
): string {
  const usages = getDetailBagUsages(activeMaster)
  const selectedUsage = focusedUsage && focusedUsage.bagId === activeMaster.bagId ? focusedUsage : activeMaster.currentUsage || usages[0] || null
  const bindings = selectedUsage ? getViewModel().bindingsByUsageId[selectedUsage.usageId] || [] : []

  return `
    <section id="transfer-bag-tabpanel-items" role="tabpanel" aria-labelledby="transfer-bag-tab-items" class="space-y-3 rounded-xl border bg-card p-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-sm font-semibold text-foreground">装载明细</h2>
        <div class="text-xs text-muted-foreground">${escapeHtml(selectedUsage?.usageNo || '暂无使用记录')}</div>
      </div>
      ${bindings.length
        ? renderStickyTableScroller(`
            <table class="min-w-[1080px] w-full text-sm">
              <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th class="px-3 py-2 text-left">对象</th>
                  <th class="px-3 py-2 text-left">生产单</th>
                  <th class="px-3 py-2 text-left">裁片单</th>
                  <th class="px-3 py-2 text-left">SPU</th>
                  <th class="px-3 py-2 text-left">颜色</th>
                  <th class="px-3 py-2 text-left">尺码</th>
                  <th class="px-3 py-2 text-left">部位</th>
                  <th class="px-3 py-2 text-right">裁片数量</th>
                  <th class="px-3 py-2 text-left">来源</th>
                </tr>
              </thead>
              <tbody>
                ${bindings
                  .map(
                    (binding) => `
                      <tr class="border-b bg-card">
                        <td class="px-3 py-2">
                          <div class="font-medium text-foreground">${escapeHtml(binding.ticketNo)}</div>
                          <div class="mt-1 text-xs text-muted-foreground">菲票</div>
                        </td>
                        <td class="px-3 py-2">${escapeHtml(binding.productionOrderNo || '待补')}</td>
                        <td class="px-3 py-2">${escapeHtml(binding.cutOrderNo || '待补')}</td>
                        <td class="px-3 py-2">${escapeHtml(binding.ticket?.spuCode || selectedUsage?.spuCode || '待补')}</td>
                        <td class="px-3 py-2">${escapeHtml(binding.fabricColor || binding.ticket?.fabricColor || binding.ticket?.color || '待补')}</td>
                        <td class="px-3 py-2">${escapeHtml(binding.size || binding.ticket?.size || '待补')}</td>
                        <td class="px-3 py-2">${escapeHtml(binding.partName || binding.ticket?.partName || '待补')}</td>
                        <td class="px-3 py-2 text-right tabular-nums">${escapeHtml(String(binding.qty || 0))}</td>
                        <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(binding.bagCode || activeMaster.bagCode)}</td>
                      </tr>
                    `,
                  )
                  .join('')}
              </tbody>
            </table>
          `, 'max-h-[56vh]')
        : '<div class="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">当前使用记录暂无装载明细。</div>'}
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
        <h2 class="text-sm font-semibold text-foreground">使用周期</h2>
      </div>
      ${!usages.length
        ? '<div class="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">当前口袋还没有过往周转记录。</div>'
        : `
          ${renderStickyTableScroller(
            `
              <table class="min-w-full text-sm">
                <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th class="px-3 py-2 text-left">使用周期号</th>
                    <th class="px-3 py-2 text-left">使用阶段</th>
                    <th class="px-3 py-2 text-left">开始 / 装袋</th>
                    <th class="px-3 py-2 text-left">交出</th>
                    <th class="px-3 py-2 text-left">回收 / 关闭</th>
                    <th class="px-3 py-2 text-right">菲票数量</th>
                    <th class="px-3 py-2 text-left">状态</th>
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
                          <td class="px-3 py-2">${escapeHtml(item.usageStageLabel || '交出装袋')}</td>
                          <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml([item.startedAt || '待开始', item.finishedPackingAt || '待装袋完成'].join(' / '))}</td>
                          <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(item.dispatchAt || '待交出')}</td>
                          <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml([item.returnedAt || '待回收', ['CLOSED', 'EXCEPTION_CLOSED'].includes(item.usageStatus) ? item.returnedAt || item.signedAt || '已关闭' : '待关闭'].join(' / '))}</td>
                          <td class="px-3 py-2 text-right tabular-nums">${escapeHtml(String(item.summary.ticketCount))}</td>
                          <td class="px-3 py-2">${renderTag(item.statusMeta.label, item.statusMeta.className)}</td>
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
                  <div class="text-sm font-semibold text-foreground">当前摘要</div>
                  <div class="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4 text-sm">
                    <div><span class="text-muted-foreground">本次周转号：</span><span class="font-medium text-foreground">${escapeHtml(selectedUsage.usageNo)}</span></div>
                    <div><span class="text-muted-foreground">开始时间：</span><span class="font-medium text-foreground">${escapeHtml(selectedUsage.startedAt || '待补')}</span></div>
                    <div><span class="text-muted-foreground">使用阶段：</span><span class="font-medium text-foreground">${escapeHtml(selectedUsage.usageStageLabel || '交出装袋')}</span></div>
                    <div><span class="text-muted-foreground">绑定对象：</span><span class="font-medium text-foreground">${escapeHtml(selectedUsage.boundObjectNo || '无')}</span></div>
                    <div><span class="text-muted-foreground">菲票数量：</span><span class="font-medium text-foreground">${escapeHtml(String(selectedUsage.summary.ticketCount))}</span></div>
                    <div><span class="text-muted-foreground">交出时间：</span><span class="font-medium text-foreground">${escapeHtml(selectedUsage.dispatchAt || '待交出')}</span></div>
                    <div><span class="text-muted-foreground">回收时间：</span><span class="font-medium text-foreground">${escapeHtml(selectedUsage.returnedAt || '待回收')}</span></div>
                    <div><span class="text-muted-foreground">周期状态：</span><span class="font-medium text-foreground">${escapeHtml(selectedUsage.statusMeta.label)}</span></div>
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
  const canShowForm = Boolean(
    selectedUsage &&
      returnUsage &&
      returnUsage.returnEligibility.ok,
  )
  const recoveryNotice = latestReceipt
    ? '当前周转已完成回收登记，下面保留最近历史回收记录。'
    : `当前尚未进入回收阶段，当前状态为：${(selectedUsage || focusedUsage)?.visibleStatusMeta.label || activeMaster.visibleStatusMeta.label}。下面保留最近历史回收记录。`

  return `
    <section id="transfer-bag-tabpanel-recovery" role="tabpanel" aria-labelledby="transfer-bag-tab-recovery" class="space-y-3 rounded-xl border bg-card p-4">
      <div>
        <h2 class="text-sm font-semibold text-foreground">回收确认</h2>
      </div>
      ${
        !canShowForm
          ? `<div class="rounded-lg border border-dashed px-6 py-8 text-sm text-muted-foreground">${escapeHtml(recoveryNotice)}</div>`
          : `
            <article class="space-y-3 rounded-xl border bg-muted/15 p-4">
              <div>
                <h3 class="text-sm font-semibold text-foreground">回收登记</h3>
                <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(`当前处理 ${selectedUsage?.usageNo || activeMaster.latestUsageNo || activeMaster.bagCode}。登记完成后，中转袋会直接回到可用，或按结果报废。`)}</p>
              </div>
              <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <label class="space-y-2">
                  <span class="text-sm font-medium text-foreground">回收点 / 回收仓</span>
                  <input type="text" value="${escapeHtml(state.returnDraft.returnWarehouseName)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-return-draft-field="returnWarehouseName" />
                </label>
                <label class="space-y-2">
                  <span class="text-sm font-medium text-foreground">回收时间</span>
                  <input type="text" value="${escapeHtml(state.returnDraft.returnAt)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-return-draft-field="returnAt" />
                </label>
                <label class="space-y-2">
                  <span class="text-sm font-medium text-foreground">回收确认人</span>
                  <input type="text" value="${escapeHtml(state.returnDraft.receivedBy)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-return-draft-field="receivedBy" />
                </label>
                <label class="space-y-2 md:col-span-2 xl:col-span-4">
                  <span class="text-sm font-medium text-foreground">备注</span>
                  <input type="text" value="${escapeHtml(state.returnDraft.note)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-return-draft-field="note" />
                </label>
              </div>
              <div class="flex flex-wrap gap-2">
                <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="complete-return-inspection" data-usage-id="${escapeHtml(selectedUsage?.usageId || '')}">完成回收</button>
              </div>
            </article>
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
                        <th class="px-3 py-2 text-left">接收人</th>
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
                              <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(entry.latestReceipt?.receivedBy || '待补')}</td>
                              <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(entry.latestReceipt?.note || entry.latestClosure?.reason || '无')}</td>
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
  void focusedUsage
  const usageIds = getDetailBagUsages(activeMaster).map((item) => item.usageId)
  const abnormalRecords = getCarrierManagementProjection().abnormalRecords.filter((item) => item.bagCode === activeMaster.bagCode)
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
        <h2 class="text-sm font-semibold text-foreground">异常记录</h2>
        <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(`当前查看 ${activeMaster.bagCode} 的异常和操作追溯。`)}</p>
      </div>
      ${
        abnormalRecords.length
          ? `<div class="grid gap-3 md:grid-cols-2">
              ${abnormalRecords
                .map(
                  (item) => `
                    <article class="rounded-xl border bg-rose-50/40 px-4 py-3 text-sm">
                      <div class="flex flex-wrap items-center justify-between gap-3">
                        <p class="font-medium text-foreground">${escapeHtml(item.abnormalType)}</p>
                        ${renderTag(item.handlingStatus, 'bg-rose-100 text-rose-700 border border-rose-200')}
                      </div>
                      <p class="mt-2 text-sm text-foreground">${escapeHtml(item.description)}</p>
                      <p class="mt-2 text-xs text-muted-foreground">${escapeHtml([item.relatedObjectType, item.relatedObjectId, item.reportedAt].filter(Boolean).join(' / '))}</p>
                    </article>
                  `,
                )
                .join('')}
            </div>`
          : '<div class="rounded-lg border border-dashed px-6 py-8 text-center text-sm text-muted-foreground">当前中转袋暂无异常记录。</div>'
      }
      <div class="pt-2 text-sm font-semibold text-foreground">操作日志</div>
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
  if (activeTab === 'basic') return renderTransferBagBasicTab(activeMaster, focusedUsage)
  if (activeTab === 'history') return renderTransferBagHistoryTab(activeMaster, focusedUsage)
  if (activeTab === 'items') return renderTransferBagItemsTab(activeMaster, focusedUsage)
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
        <div>
          <h1 class="text-xl font-bold">${escapeHtml(meta.pageTitle)}</h1>
          ${activeMaster ? `<p class="mt-1 text-sm text-muted-foreground">${escapeHtml([activeMaster.bagCode, getCarrierMasterRecordMap()[activeMaster.bagCode]?.currentStatus || activeMaster.visibleStatusMeta.label, getCarrierMasterRecordMap()[activeMaster.bagCode]?.currentLocation || activeMaster.currentLocation || '待命位'].join(' / '))}</p>` : ''}
        </div>
        <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="${escapeHtml(buildTransferBagListRoute())}">返回中转袋流转</button>
      </header>
      ${renderFeedbackBar()}
      ${activeMaster ? renderTransferBagDetailHeader(activeMaster, focusedUsage) : renderDetailEmptyState()}
      ${activeMaster ? renderTransferBagDetailTabs(activeMaster, focusedUsage, activeTab) : ''}
      ${activeMaster ? renderTransferBagDetailTabPanel(activeMaster, focusedUsage, activeTab) : ''}
      ${renderActiveDialog()}
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
  setFeedback(closure.closureStatus === 'EXCEPTION_CLOSED' ? 'warning' : 'success', `${usage.usageNo} 已完成回收，${bag.bagCode} 当前状态：${deriveTransferBagMasterStatus(bag.currentStatus).label}。`)
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
      ? `${usage.usageNo} 已异常关闭：${closure.warningMessages.join('；')}`
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
  const bindings = getViewModel().bindingsByUsageId[usageId] || []
  if (!bindings.length) {
    setFeedback('warning', `${usage.usageNo} 还没有装入任何菲票，不能打印流转清单。`)
    return true
  }

  const manifest = createTransferBagDispatchManifest({
    usage,
    summary: buildTransferBagParentChildSummary(bindings),
    nowText: nowText(),
    createdBy: '中转袋工作台',
  })
  state.store.manifests.push(manifest)
  state.store.auditTrail.push(
    buildBagUsageAuditTrail({
      usageId,
      action: '打印装袋清单',
      actionAt: manifest.createdAt,
      actionBy: manifest.createdBy,
      note: `${usage.bagCode} 当前已打印装袋清单。`,
    }),
  )
  refreshDerivedState()
  persistStore()

  appStore.navigate(buildTransferBagLabelPrintLink(usageId))
  setFeedback('success', `${usage.usageNo} 的中转袋二维码已进入统一打印预览。`)
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
    if (field === 'boundObjectNo') {
      const task = getSelectedSewingTaskByNo(input.value)
      if (task) {
        state.packDraft.receiverName = formatFactoryDisplayName(task.sewingFactoryName)
        state.packDraft.receiverType = '工厂'
      }
    }
    return true
  }

  const abnormalDraftFieldNode = target.closest<HTMLElement>('[data-transfer-bags-abnormal-draft-field]')
  if (abnormalDraftFieldNode) {
    const field = abnormalDraftFieldNode.dataset.transferBagsAbnormalDraftField as AbnormalDraftField | undefined
    if (!field) return false
    const input = abnormalDraftFieldNode as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    state.abnormalDraft = {
      ...state.abnormalDraft,
      [field]: input.value,
    }
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-transfer-bags-action]')
  const action = actionNode?.dataset.transferBagsAction
  if (!action) return false

  if (action === 'clear-prefill') return clearPrefill()
  if (action === 'set-list-tab') {
    const nextTab = actionNode.dataset.tab as TransferBagListTab | undefined
    if (nextTab === 'masters' || nextTab === 'inbound' || nextTab === 'handover' || nextTab === 'recovery' || nextTab === 'abnormal') {
      state.activeListTab = nextTab
      return true
    }
    return false
  }
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
  if (action === 'open-abnormal') {
    resetAbnormalDraft({ bagId: actionNode.dataset.bagId, usageId: actionNode.dataset.usageId })
    state.activeDialog = 'abnormal'
    return true
  }
  if (action === 'save-abnormal') return saveAbnormalDraft()
  if (action === 'open-handle-abnormal') {
    resetAbnormalDraft({ abnormalId: actionNode.dataset.abnormalId })
    state.activeDialog = 'handle-abnormal'
    return true
  }
  if (action === 'save-handle-abnormal') return handleAbnormalDraft()
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
    state.activeListTab = 'masters'
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
