import { appStore } from '../../../state/store.ts'
import { escapeHtml, formatDateTime } from '../../../utils.ts'
import {
  CUTTING_FEI_TICKET_RECORDS_STORAGE_KEY,
} from '../../../data/fcs/cutting/storage/fei-tickets-storage.ts'
import {
  buildCuttingTraceabilityId,
  encodeCarrierQr,
  parseCuttingTraceQr,
} from '../../../data/fcs/cutting/qr-codes.ts'
import { parseCarrierQrValue } from '../../../data/fcs/cutting/transfer-bag-runtime.ts'
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
} from '../navigation-context.ts'
import {
  buildTransferBagsProjection,
} from '../transfer-bags-projection.ts'
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
} from '../transfer-bags-model.ts'
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
} from '../transfer-bag-return-model.ts'

export type MasterStatusFilter = 'ALL' | TransferBagCarrierCurrentStatus
export type MasterUseStageFilter = 'ALL' | TransferBagCarrierUseStage
export type UsageStatusFilter = 'ALL' | TransferBagUsageStatusKey
export type ReturnStatusFilter = 'ALL' | 'WAITING_RETURN' | 'RETURN_INSPECTING' | 'CLOSED' | 'SCRAP_CLOSED'
export type TransferBagDetailTab = 'basic' | 'current' | 'history' | 'items' | 'logs'
export type TransferBagBaggingStepId = 'scan' | 'review' | 'handover'
export type TransferBagBaggingStepState = 'pending' | 'active' | 'done' | 'locked'
export type TransferBagDialog =
  | 'new-master'
  | 'inbound-pack'
  | 'handover-pack'
  | 'return'
export type TransferBagsProjection = ReturnType<typeof buildTransferBagsProjection>
export type TransferBagCarrierManagementProjection = ReturnType<typeof buildTransferBagCarrierManagementProjection>
export type TransferBagCarrierMasterRecord = TransferBagCarrierManagementProjection['masterRecords'][number]

export type FeedbackTone = 'success' | 'warning'

export type MasterFilterField = 'keyword' | 'status' | 'useStage' | 'location' | 'boundObject'
export type UsageFilterField = 'keyword' | 'status' | 'sewingTask'
export type WorkbenchField = 'bagId' | 'bagCodeInput' | 'sewingTaskId' | 'ticketInput' | 'note'
export type ReturnFilterField = 'keyword' | 'status'
export type ReturnDraftField =
  | 'returnWarehouseName'
  | 'returnAt'
  | 'returnedBy'
  | 'receivedBy'
  | 'returnedFinishedQty'
  | 'returnedTicketCountSummary'
  | 'discrepancyType'
  | 'discrepancyNote'
  | 'note'
export type ConditionDraftField = 'conditionStatus' | 'cleanlinessStatus' | 'damageType' | 'repairNeeded' | 'reusableDecision' | 'note'
export type MasterDraftField = 'bagCode' | 'carrierType' | 'capacity' | 'bagSpec' | 'bagMaterial' | 'ownershipFactoryId' | 'currentLocation' | 'note'
export type PackDraftField =
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

export type FeedbackState = {
  tone: FeedbackTone
  message: string
} | null

export interface TransferBagLandingResolution {
  page: 'list' | 'detail'
  bagId?: string
  bagCode?: string
  usageId?: string
  usageNo?: string
  reason: string
  matchedCount?: number
}

export interface TransferBagLandingBanner {
  summary: string
  chips: string[]
}

export interface TransferBagBaggingStepView {
  id: TransferBagBaggingStepId
  index: number
  label: string
  state: TransferBagBaggingStepState
  summary: string
  helperText: string
  open: boolean
}

export interface TransferBagsPageState {
  store: TransferBagStore
  masterKeyword: string
  masterStatus: MasterStatusFilter
  masterUseStage: MasterUseStageFilter
  masterLocationKeyword: string
  masterBoundObjectKeyword: string
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
  activeDialog: TransferBagDialog | null
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

export function nowText(date = new Date()): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hours = `${date.getHours()}`.padStart(2, '0')
  const minutes = `${date.getMinutes()}`.padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

export function uniqueStrings(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))))
}

export function serializeTransferBagTicketRecordsStorage(records: TransferBagsProjection['ticketRecords']): string {
  return JSON.stringify(records)
}

export function sanitizeIdFragment(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'na'
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

export function invalidateTransferBagProjectionCache(): void {
  projectionVersion += 1
  projectionCache = null
  carrierManagementProjectionCache = null
}

export function getProjection() {
  if (projectionCache?.version === projectionVersion) return projectionCache.projection
  const projection = buildTransferBagsProjection(undefined, state.store)
  projectionCache = { version: projectionVersion, projection }
  return projection
}

export function hydrateStore(): TransferBagStore {
  return buildTransferBagsProjection().store
}

export const state: TransferBagsPageState = {
  store: hydrateStore(),
  masterKeyword: '',
  masterStatus: 'ALL',
  masterUseStage: 'ALL',
  masterLocationKeyword: '',
  masterBoundObjectKeyword: '',
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
  activeDialog: null,
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

export function getViewModel() {
  return getProjection().viewModel
}

export function getReturnViewModel() {
  return getProjection().returnViewModel
}

export function getCarrierManagementProjection() {
  if (carrierManagementProjectionCache?.version === projectionVersion) return carrierManagementProjectionCache.projection
  const projection = buildTransferBagCarrierManagementProjection(state.store, getViewModel())
  carrierManagementProjectionCache = {
    version: projectionVersion,
    projection,
    masterRecordMap: Object.fromEntries(projection.masterRecords.map((item) => [item.bagCode, item])),
  }
  return projection
}

export function persistStore(): void {
  invalidateTransferBagProjectionCache()
  localStorage.setItem(CUTTING_TRANSFER_BAG_LEDGER_STORAGE_KEY, serializeTransferBagStorage(state.store))
  const nextTicketRecords = getProjection().ticketRecords
  localStorage.setItem(CUTTING_FEI_TICKET_RECORDS_STORAGE_KEY, serializeTransferBagTicketRecordsStorage(nextTicketRecords))
}

export function persistSelectedTicketIds(): void {
  if (state.preselectedTicketRecordIds.length) {
    sessionStorage.setItem(
      CUTTING_TRANSFER_BAG_SELECTED_TICKET_IDS_STORAGE_KEY,
      serializeTransferBagSelectedTicketIds(state.preselectedTicketRecordIds),
    )
  } else {
    sessionStorage.removeItem(CUTTING_TRANSFER_BAG_SELECTED_TICKET_IDS_STORAGE_KEY)
  }
}

export function setFeedback(tone: FeedbackTone, message: string): void {
  state.feedback = { tone, message }
}

export function closeActiveDialog(): boolean {
  state.activeDialog = null
  return true
}

export function getFactoryOptions() {
  const factories = listBusinessFactoryMasterRecords({ includeTestFactories: true })
  return factories.length ? factories : [{ id: 'F090', code: 'F090', name: '全能力测试工厂' }]
}

export function getFactoryNameById(factoryId: string): string {
  const factory = getFactoryOptions().find((item) => item.id === factoryId || item.code === factoryId)
  return factory ? formatFactoryDisplayName(factory.name, factory.code || factory.id) : ''
}
