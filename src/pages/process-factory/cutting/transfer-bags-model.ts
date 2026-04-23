import {
  buildCuttingTraceabilityId,
  encodeCarrierQr,
} from '../../../data/fcs/cutting/qr-codes.ts'
import {
  normalizeCarrierCycleItemBinding,
  normalizeTransferBagDispatchManifest,
  normalizeTransferCarrierCycleRecord,
  normalizeTransferCarrierRecord,
} from '../../../data/fcs/cutting/transfer-bag-legacy-normalizer.ts'
import {
  buildSystemSeedTransferBagRuntime,
  createCarrierCycleRecord,
  createCarrierDispatchManifest,
  deserializeTransferBagRuntimeStorage,
  mergeTransferBagRuntimeStores,
  serializeTransferBagRuntimeStorage,
  type CarrierCycleItemBinding,
  type SewingTaskRefRecord,
  type TransferBagDispatchManifestRecord,
  type TransferBagRuntimeStore,
  type TransferBagSeedMergeBatchLike,
  type TransferBagSeedOriginalRowLike,
  type TransferBagSeedTicketLike,
  type TransferCarrierCycleRecord,
  type TransferCarrierRecord,
} from '../../../data/fcs/cutting/transfer-bag-runtime.ts'
import {
  getFactoryMasterRecordById,
  listSewingFactoryMasterRecords,
} from '../../../data/fcs/factory-master-store.ts'
import { FEI_TICKET_DEMO_CASE_IDS, type FeiTicketLabelRecord } from './fei-tickets-model'
import type { MergeBatchRecord } from './merge-batches-model'
import {
  buildSpreadingTraceAnchors,
  findSpreadingTraceAnchor,
  type MarkerSpreadingStore,
  type SpreadingTraceAnchor,
} from './marker-spreading-model'
import type { OriginalCutOrderRow } from './original-orders-model'

const numberFormatter = new Intl.NumberFormat('zh-CN')
const LEGACY_TRANSFER_QR_FIELD = ['qr', 'Payload'].join('') as const

function readLegacyTransferQrMeta(master: TransferBagMaster): ReturnType<typeof encodeCarrierQr>['payload'] | null {
  const legacyMaster = master as unknown as Record<string, unknown>
  const legacyValue = legacyMaster[LEGACY_TRANSFER_QR_FIELD]
  if (legacyValue && typeof legacyValue === 'object') {
    return legacyValue as ReturnType<typeof encodeCarrierQr>['payload']
  }
  if (master.qrMeta && typeof master.qrMeta === 'object') {
    return master.qrMeta as ReturnType<typeof encodeCarrierQr>['payload']
  }
  return null
}

function readRuntimeTransferQrMeta(master: TransferCarrierRecord): Record<string, unknown> {
  const runtimeRecord = master as unknown as Record<string, unknown>
  const runtimeValue = runtimeRecord[LEGACY_TRANSFER_QR_FIELD]
  if (runtimeValue && typeof runtimeValue === 'object') {
    return runtimeValue as Record<string, unknown>
  }
  return {}
}

function assignLegacyTransferQrMeta(target: Record<string, unknown>, value: Record<string, unknown>): void {
  target[LEGACY_TRANSFER_QR_FIELD] = value
}

function resolveTransferBagFactoryName(factoryId: string | undefined, fallbackName: string | undefined): string {
  if (factoryId) {
    const factory = getFactoryMasterRecordById(factoryId)
    if (factory?.name) return factory.name
  }
  return fallbackName?.trim() || '工厂档案待补'
}

function pickTransferBagSewingFactory(index: number): { factoryId: string; factoryName: string } {
  const factories = listSewingFactoryMasterRecords()
  const factory = factories[index % factories.length] || factories[0] || null
  return {
    factoryId: factory?.id || `factory-sew-${index + 1}`,
    factoryName: factory?.name || '工厂档案待补',
  }
}

export const CUTTING_TRANSFER_BAG_LEDGER_STORAGE_KEY = 'cuttingTransferBagLedger'
export const CUTTING_TRANSFER_BAG_SELECTED_TICKET_IDS_STORAGE_KEY = 'cuttingTransferBagSelectedTicketRecordIds'

export function getTransferBagDemoCaseIds() {
  return {
    CASE_F: {
      pocketId: 'bag-master-005',
      pocketNo: 'BAG-C-002',
      usageId: 'seed-usage-case-f',
      usageNo: 'TBU-DEMO-F-001',
      lockedTicketId: FEI_TICKET_DEMO_CASE_IDS.CASE_C.sampleTicketId,
      lockedTicketNo: FEI_TICKET_DEMO_CASE_IDS.CASE_C.sampleTicketNo,
      mismatchTicketId: 'ticket-CUT-260313-086-01-002-v1',
      mismatchTicketNo: 'FT-CUT-260313-086-01-002',
    },
  } as const
}

export type TransferBagMasterStatusKey =
  | 'IDLE'
  | 'IN_USE'
  | 'DISPATCHED'
  | 'WAITING_SIGNOFF'
  | 'WAITING_RETURN'
  | 'RETURN_INSPECTING'
  | 'REUSABLE'
  | 'WAITING_CLEANING'
  | 'WAITING_REPAIR'
  | 'DISABLED'
export type TransferBagUsageStatusKey =
  | 'DRAFT'
  | 'PACKING'
  | 'READY_TO_DISPATCH'
  | 'DISPATCHED'
  | 'PENDING_SIGNOFF'
  | 'WAITING_RETURN'
  | 'RETURN_INSPECTING'
  | 'CLOSED'
  | 'EXCEPTION_CLOSED'
export type TransferBagSignoffStatus = 'PENDING' | 'WAITING' | 'SIGNED'
export type TransferBagDiscrepancyType = 'NONE' | 'QTY_MISMATCH' | 'DAMAGED_BAG' | 'LATE_RETURN' | 'MISSING_RECORD'
export type TransferBagConditionStatus = 'GOOD' | 'MINOR_DAMAGE' | 'SEVERE_DAMAGE'
export type TransferBagCleanlinessStatus = 'CLEAN' | 'DIRTY'
export type TransferBagReusableDecision = 'REUSABLE' | 'WAITING_CLEANING' | 'WAITING_REPAIR' | 'DISABLED'
export type PocketCarrierStatusKey = 'IDLE' | 'PACKING' | 'READY_TO_DISPATCH' | 'DISPATCHED' | 'SIGNED' | 'RETURNED' | 'DISABLED'
export type TransferBagVisibleStatusKey = 'IDLE' | 'IN_PROGRESS' | 'READY_HANDOVER' | 'HANDED_OVER' | 'ARCHIVED'

export interface TransferBagSummaryMeta<Key extends string> {
  key: Key
  label: string
  className: string
  detailText: string
}

export interface TransferBagCycleContextResolution {
  ok: boolean
  reason: string
  sewingTask: SewingTaskRef | null
  source: 'merge-batch' | 'original-order' | 'style-spu' | 'usage-locked' | null
}

export interface TransferBagMaster {
  carrierId: string
  carrierCode: string
  carrierType: 'bag' | 'box'
  latestCycleId: string
  latestCycleNo: string
  // Legacy page-shell aliases. Do not use as formal identity.
  bagId: string
  bagCode: string
  bagType: string
  capacity: number
  reusable: boolean
  currentStatus: TransferBagMasterStatusKey
  currentLocation: string
  // Legacy page-shell aliases. Do not use as formal identity.
  latestUsageId: string
  latestUsageNo: string
  currentCycleId: string
  currentOwnerTaskId: string
  qrValue?: string
  qrMeta?: Record<string, unknown>
  note: string
}

export interface TransferBagUsage {
  cycleId: string
  cycleNo: string
  carrierId: string
  carrierCode: string
  carrierType: 'bag' | 'box'
  cycleStatus: TransferBagUsageStatusKey
  // Legacy page-shell aliases. Do not use as formal identity.
  usageId: string
  usageNo: string
  bagId: string
  bagCode: string
  sewingTaskId: string
  sewingTaskNo: string
  sewingFactoryId: string
  sewingFactoryName: string
  styleCode: string
  spuCode: string
  skuSummary: string
  colorSummary: string
  sizeSummary: string
  // Legacy page-shell alias. Do not use as formal status identity.
  usageStatus: TransferBagUsageStatusKey
  packedTicketCount: number
  packedOriginalCutOrderCount: number
  startedAt?: string
  finishedPackingAt?: string
  dispatchAt: string
  dispatchBy: string
  signoffStatus: TransferBagSignoffStatus
  signedAt?: string
  returnedAt?: string
  status?: string
  note: string
}

export interface TransferBagItemBinding {
  bindingId: string
  cycleId: string
  cycleNo: string
  carrierId: string
  carrierCode: string
  feiTicketId: string
  feiTicketNo: string
  sourceSpreadingSessionId?: string
  sourceSpreadingSessionNo?: string
  sourceMarkerId?: string
  sourceMarkerNo?: string
  sourceWritebackId?: string
  // Legacy page-shell aliases. Do not use as formal identity.
  usageId: string
  usageNo: string
  bagId: string
  bagCode: string
  ticketRecordId: string
  ticketNo: string
  originalCutOrderId: string
  originalCutOrderNo: string
  productionOrderNo: string
  mergeBatchNo: string
  fabricRollNo?: string
  fabricColor?: string
  size?: string
  partName?: string
  bundleNo?: string
  actualCutPieceQty?: number
  assemblyGroupKey?: string
  siblingPartTicketNos?: string[]
  裁剪批次No?: string
  qty: number
  garmentQty: number
  boundAt: string
  boundBy: string
  operator?: string
  status?: 'BOUND' | 'REMOVED'
  note: string
}

export type PocketCarrier = TransferBagMaster
export type PocketUsage = TransferBagUsage
export type TicketPocketBinding = TransferBagItemBinding

export interface SewingTaskRef {
  sewingTaskId: string
  sewingTaskNo: string
  sewingFactoryId: string
  sewingFactoryName: string
  styleCode: string
  spuCode: string
  skuSummary: string
  colorSummary: string
  sizeSummary: string
  plannedQty: number
  status: string
  note: string
}

export interface TransferBagDispatchManifest {
  manifestId: string
  cycleId: string
  carrierCode: string
  // Legacy page-shell aliases. Do not use as formal identity.
  usageId: string
  bagCode: string
  sewingTaskNo: string
  sewingFactoryName: string
  ticketCount: number
  originalCutOrderCount: number
  createdAt: string
  createdBy: string
  printStatus: 'PRINTED'
  note: string
}

export interface TransferBagUsageAuditTrail {
  auditTrailId: string
  cycleId: string
  // Legacy page-shell alias. Do not use as formal identity.
  usageId: string
  action: string
  actionAt: string
  actionBy: string
  note: string
}

export interface TransferBagReturnReceipt {
  returnReceiptId: string
  cycleId: string
  cycleNo: string
  carrierId: string
  carrierCode: string
  // Legacy page-shell aliases. Do not use as formal identity.
  usageId: string
  usageNo: string
  bagId: string
  bagCode: string
  sewingTaskId: string
  sewingTaskNo: string
  returnWarehouseName: string
  returnAt: string
  returnedBy: string
  receivedBy: string
  returnedFinishedQty: number
  returnedTicketCountSummary: number
  returnedOriginalCutOrderCount: number
  discrepancyType: TransferBagDiscrepancyType
  discrepancyNote: string
  note: string
}

export interface TransferBagConditionRecord {
  conditionRecordId: string
  cycleId: string
  carrierId: string
  carrierCode: string
  // Legacy page-shell aliases. Do not use as formal identity.
  usageId: string
  bagId: string
  bagCode: string
  conditionStatus: TransferBagConditionStatus
  cleanlinessStatus: TransferBagCleanlinessStatus
  damageType: string
  repairNeeded: boolean
  reusableDecision: TransferBagReusableDecision
  inspectedAt: string
  inspectedBy: string
  note: string
}

export interface TransferBagReuseCycleSummary {
  cycleSummaryId: string
  carrierId: string
  carrierCode: string
  latestCycleId: string
  latestCycleNo: string
  currentOpenCycleId: string
  // Legacy page-shell aliases. Do not use as formal identity.
  bagId: string
  bagCode: string
  latestUsageId: string
  latestUsageNo: string
  totalUsageCount: number
  totalDispatchCount: number
  totalReturnCount: number
  lastDispatchedAt: string
  lastReturnedAt: string
  currentReusableStatus: TransferBagMasterStatusKey
  currentLocation: string
  currentOpenUsageId: string
  note: string
}

export interface TransferBagUsageClosureResult {
  closureId: string
  cycleId: string
  cycleNo: string
  // Legacy page-shell aliases. Do not use as formal identity.
  usageId: string
  usageNo: string
  closedAt: string
  closedBy: string
  closureStatus: 'CLOSED' | 'EXCEPTION_CLOSED'
  nextBagStatus: TransferBagMasterStatusKey
  reason: string
  warningMessages: string[]
}

export interface TransferBagReturnAuditTrail {
  auditTrailId: string
  usageId: string
  action: string
  actionAt: string
  actionBy: string
  payloadSummary: string
  note: string
}

export interface TransferBagStore {
  masters: TransferBagMaster[]
  usages: TransferBagUsage[]
  bindings: TransferBagItemBinding[]
  manifests: TransferBagDispatchManifest[]
  sewingTasks: SewingTaskRef[]
  auditTrail: TransferBagUsageAuditTrail[]
  returnReceipts: TransferBagReturnReceipt[]
  conditionRecords: TransferBagConditionRecord[]
  reuseCycles: TransferBagReuseCycleSummary[]
  closureResults: TransferBagUsageClosureResult[]
  returnAuditTrail: TransferBagReturnAuditTrail[]
}

export interface TransferBagPrefilter {
  originalCutOrderId?: string
  originalCutOrderNo?: string
  mergeBatchId?: string
  mergeBatchNo?: string
  裁剪批次No?: string
  productionOrderId?: string
  productionOrderNo?: string
  materialSku?: string
  spreadingSessionId?: string
  sourceWritebackId?: string
  styleCode?: string
  ticketId?: string
  cuttingGroup?: string
  warehouseStatus?: string
  ticketNo?: string
  sewingTaskNo?: string
  bagId?: string
  bagCode?: string
  usageId?: string
  usageNo?: string
  returnStatus?: string
}

export interface TransferBagNavigationPayload {
  cutPieceWarehouse: Record<string, string | undefined>
  feiTickets: Record<string, string | undefined>
  originalOrders: Record<string, string | undefined>
  summary: Record<string, string | undefined>
}

export interface TransferBagParentChildSummary {
  ticketCount: number
  originalCutOrderCount: number
  productionOrderCount: number
  mergeBatchCount: number
  assemblyGroupCount: number
  quantityTotal: number
  garmentQtyTotal: number
}

export interface TransferBagTicketCandidate {
  ticketRecordId: string
  feiTicketId: string
  ticketNo: string
  sourceSpreadingSessionId: string
  sourceSpreadingSessionNo: string
  sourceMarkerId: string
  sourceMarkerNo: string
  originalCutOrderId: string
  originalCutOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  mergeBatchId: string
  mergeBatchNo: string
  styleCode: string
  spuCode: string
  fabricRollNo: string
  fabricColor: string
  color: string
  size: string
  partCode: string
  partName: string
  bundleNo: string
  qty: number
  actualCutPieceQty: number
  assemblyGroupKey: string
  siblingPartTicketNos: string[]
  garmentQty: number
  materialSku: string
  sourceContextType: string
  ticketStatus: FeiTicketLabelRecord['status']
}

export interface TransferBagMasterItem extends TransferBagMaster {
  statusMeta: TransferBagSummaryMeta<TransferBagMasterStatusKey>
  visibleStatusKey: TransferBagVisibleStatusKey
  visibleStatusMeta: TransferBagSummaryMeta<TransferBagVisibleStatusKey>
  latestUsageStatusMeta: TransferBagSummaryMeta<TransferBagUsageStatusKey> | null
  packedTicketCount: number
  packedOriginalCutOrderCount: number
  pocketStatusKey: PocketCarrierStatusKey
  pocketStatusMeta: TransferBagSummaryMeta<PocketCarrierStatusKey>
  currentUsage: TransferBagUsageItem | null
  currentStyleCode: string
  currentTotalPieceCount: number
  currentGarmentQtyTotal: number
  currentSourceProductionOrderCount: number
  currentSourceCutOrderCount: number
  currentSourceBatchCount: number
  currentDispatchedAt: string
  currentSignedAt: string
  currentReturnedAt: string
}

export interface TransferBagUsageItem extends TransferBagUsage {
  statusMeta: TransferBagSummaryMeta<TransferBagUsageStatusKey>
  visibleStatusKey: TransferBagVisibleStatusKey
  visibleStatusMeta: TransferBagSummaryMeta<TransferBagVisibleStatusKey>
  pocketStatusKey: PocketCarrierStatusKey
  pocketStatusMeta: TransferBagSummaryMeta<PocketCarrierStatusKey>
  bagMaster: TransferBagMaster | null
  sewingTask: SewingTaskRef | null
  summary: TransferBagParentChildSummary
  bindingItems: TransferBagBindingItem[]
  boundTicketIds: string[]
  ticketNos: string[]
  originalCutOrderNos: string[]
  productionOrderNos: string[]
  sourceMarkerNos: string[]
  mergeBatchNos: string[]
  latestManifest: TransferBagDispatchManifest | null
  spreadingSessionId: string
  spreadingSessionNo: string
  spreadingSourceWritebackId: string
  spreadingUpdatedFromPdaAt: string
  spreadingColorSummary: string
  bagFirstSatisfied: boolean
  bagFirstRuleLabel: string
  navigationPayload: TransferBagNavigationPayload
}

export interface TransferBagBindingItem extends TransferBagItemBinding {
  usage: TransferBagUsageItem | null
  ticket: TransferBagTicketCandidate | null
  pocketStatusKey: PocketCarrierStatusKey
  removable: boolean
  sourceSpreadingSessionId?: string
  sourceSpreadingSessionNo?: string
  sourceMarkerId?: string
  sourceMarkerNo?: string
  sourceWritebackId?: string
  spreadingSessionId: string
  spreadingSessionNo: string
  spreadingSourceWritebackId: string
  bagFirstRuleLabel: string
  navigationPayload: TransferBagNavigationPayload
}

export interface ActiveTicketPocketBinding {
  bindingId: string
  ticketRecordId: string
  ticketNo: string
  pocketId: string
  pocketNo: string
  usageId: string
  usageNo: string
  styleCode: string
  boundAt: string
  usageStatus: TransferBagUsageStatusKey
}

export interface TransferBagViewModel {
  summary: {
    bagCount: number
    idleBagCount: number
    inProgressBagCount: number
    readyHandoverBagCount: number
    handedOverBagCount: number
  }
  masters: TransferBagMasterItem[]
  mastersById: Record<string, TransferBagMasterItem>
  usages: TransferBagUsageItem[]
  usagesById: Record<string, TransferBagUsageItem>
  bindings: TransferBagBindingItem[]
  bindingsByUsageId: Record<string, TransferBagBindingItem[]>
  activeTicketBindingsByTicketId: Record<string, ActiveTicketPocketBinding>
  manifestsByUsageId: Record<string, TransferBagDispatchManifest[]>
  sewingTasks: SewingTaskRef[]
  sewingTasksById: Record<string, SewingTaskRef>
  auditTrailByUsageId: Record<string, TransferBagUsageAuditTrail[]>
  ticketCandidates: TransferBagTicketCandidate[]
  ticketCandidatesById: Record<string, TransferBagTicketCandidate>
  ticketCandidatesByNo: Record<string, TransferBagTicketCandidate>
}

export interface TransferBagValidationResult {
  ok: boolean
  reason: string
}

const masterStatusMetaMap: Record<TransferBagMasterStatusKey, { label: string; className: string; detailText: string }> = {
  IDLE: {
    label: '空闲',
    className: 'bg-slate-100 text-slate-700 border border-slate-200',
    detailText: '当前口袋未进入使用周期，可继续装袋。',
  },
  IN_USE: {
    label: '使用中',
    className: 'bg-blue-100 text-blue-700 border border-blue-200',
    detailText: '当前口袋已有使用周期，仍处于装袋或待发出阶段。',
  },
  DISPATCHED: {
    label: '已发出',
    className: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    detailText: '当前口袋已发往车缝任务对应工厂。',
  },
  WAITING_SIGNOFF: {
    label: '待签收',
    className: 'bg-amber-100 text-amber-700 border border-amber-200',
    detailText: '当前口袋已到发出阶段，等待后道签收确认。',
  },
  WAITING_RETURN: {
    label: '待回仓',
    className: 'bg-orange-100 text-orange-700 border border-orange-200',
    detailText: '当前口袋已完成发出链路，等待回货入仓。',
  },
  RETURN_INSPECTING: {
    label: '回仓验收中',
    className: 'bg-cyan-100 text-cyan-700 border border-cyan-200',
    detailText: '当前口袋已进入回货验收，等待袋况与差异确认。',
  },
  REUSABLE: {
    label: '可复用',
    className: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    detailText: '当前口袋已完成本轮使用周期闭环，可继续复用。',
  },
  WAITING_CLEANING: {
    label: '待清洁',
    className: 'bg-sky-100 text-sky-700 border border-sky-200',
    detailText: '当前口袋已返仓，但需清洁后才能再次复用。',
  },
  WAITING_REPAIR: {
    label: '待维修',
    className: 'bg-rose-100 text-rose-700 border border-rose-200',
    detailText: '当前口袋存在损坏，需要维修确认后再决定是否复用。',
  },
  DISABLED: {
    label: '停用 / 报废',
    className: 'bg-slate-200 text-slate-700 border border-slate-300',
    detailText: '当前口袋不再进入复用链路，仅保留周期台账追溯。',
  },
}

const pocketCarrierStatusMetaMap: Record<PocketCarrierStatusKey, { label: string; className: string; detailText: string }> = {
  IDLE: {
    label: '空闲',
    className: 'bg-slate-100 text-slate-700 border border-slate-200',
    detailText: '当前口袋没有进行中的使用周期，可直接开始装袋。',
  },
  PACKING: {
    label: '装袋中',
    className: 'bg-blue-100 text-blue-700 border border-blue-200',
    detailText: '当前口袋已进入使用周期，仍可继续扫描菲票并调整袋内明细。',
  },
  READY_TO_DISPATCH: {
    label: '待发出',
    className: 'bg-violet-100 text-violet-700 border border-violet-200',
    detailText: '当前口袋已完成装袋，等待打印装袋清单并发出。',
  },
  DISPATCHED: {
    label: '已发出',
    className: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    detailText: '当前口袋已发往下游，等待签收。',
  },
  SIGNED: {
    label: '已签收',
    className: 'bg-amber-100 text-amber-700 border border-amber-200',
    detailText: '当前口袋已完成签收，等待回仓与验收。',
  },
  RETURNED: {
    label: '已回仓',
    className: 'bg-cyan-100 text-cyan-700 border border-cyan-200',
    detailText: '当前口袋已回仓，等待关闭使用周期并释放复用。',
  },
  DISABLED: {
    label: '停用',
    className: 'bg-rose-100 text-rose-700 border border-rose-200',
    detailText: '当前口袋已停用，不可继续进入装袋流程。',
  },
}

const usageStatusMetaMap: Record<TransferBagUsageStatusKey, { label: string; className: string; detailText: string }> = {
  DRAFT: {
    label: '草稿',
    className: 'bg-slate-100 text-slate-700 border border-slate-200',
    detailText: '当前使用周期仅完成口袋与任务草稿绑定。',
  },
  PACKING: {
    label: '装袋中',
    className: 'bg-blue-100 text-blue-700 border border-blue-200',
    detailText: '当前使用周期正在持续建立父子码映射。',
  },
  READY_TO_DISPATCH: {
    label: '待发出',
    className: 'bg-violet-100 text-violet-700 border border-violet-200',
    detailText: '当前使用周期已完成装袋，可打印交接清单并发出。',
  },
  DISPATCHED: {
    label: '已发出',
    className: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    detailText: '当前使用周期已发出，但尚未进入回货闭环。',
  },
  PENDING_SIGNOFF: {
    label: '待签收',
    className: 'bg-amber-100 text-amber-700 border border-amber-200',
    detailText: '当前使用周期已到待签收状态，后续进入回货与复用处理。',
  },
  WAITING_RETURN: {
    label: '待回仓',
    className: 'bg-orange-100 text-orange-700 border border-orange-200',
    detailText: '当前使用周期已到回货前置阶段，等待返仓。',
  },
  RETURN_INSPECTING: {
    label: '回仓验收中',
    className: 'bg-cyan-100 text-cyan-700 border border-cyan-200',
    detailText: '当前使用周期已进入回货验收与袋况确认。',
  },
  CLOSED: {
    label: '已关闭',
    className: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    detailText: '当前使用周期已完成回货验收并正式关闭。',
  },
  EXCEPTION_CLOSED: {
    label: '异常关闭',
    className: 'bg-rose-100 text-rose-700 border border-rose-200',
    detailText: '当前使用周期在存在差异或袋况异常时带说明关闭。',
  },
}

const visibleStatusMetaMap: Record<TransferBagVisibleStatusKey, { label: string; className: string; detailText: string }> = {
  IDLE: {
    label: '空闲',
    className: 'bg-slate-100 text-slate-700 border border-slate-200',
    detailText: '当前没有打开中的周转，可继续开始装袋。',
  },
  IN_PROGRESS: {
    label: '使用中',
    className: 'bg-blue-100 text-blue-700 border border-blue-200',
    detailText: '当前正在扫码装袋，尚未完成核对。',
  },
  READY_HANDOVER: {
    label: '待交出',
    className: 'bg-violet-100 text-violet-700 border border-violet-200',
    detailText: '当前已完成装袋，等待裁片仓交出。',
  },
  HANDED_OVER: {
    label: '已交出',
    className: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    detailText: '当前已从裁片仓交出，等待后续回收。',
  },
  ARCHIVED: {
    label: '归档',
    className: 'bg-slate-200 text-slate-700 border border-slate-300',
    detailText: '当前口袋不可继续使用，仅保留追溯记录。',
  },
}

function createMeta<Key extends string>(
  key: Key,
  config: { label: string; className: string; detailText: string },
): TransferBagSummaryMeta<Key> {
  return {
    key,
    label: config.label,
    className: config.className,
    detailText: config.detailText,
  }
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))))
}

function buildBagAuditId(nowText: string, usageId: string, action: string): string {
  return buildCuttingTraceabilityId('bag-audit', nowText, usageId, action)
}

function toCarrierType(bagCode: string, explicit?: string): 'bag' | 'box' {
  if (explicit === 'box' || explicit === 'bag') return explicit
  return bagCode.startsWith('BOX') ? 'box' : 'bag'
}

function toLegacyMasterStatus(status: string | undefined): TransferBagMasterStatusKey {
  const normalized = String(status || 'IDLE').toUpperCase()
  if (
    normalized === 'IDLE' ||
    normalized === 'IN_USE' ||
    normalized === 'DISPATCHED' ||
    normalized === 'WAITING_SIGNOFF' ||
    normalized === 'WAITING_RETURN' ||
    normalized === 'RETURN_INSPECTING' ||
    normalized === 'REUSABLE' ||
    normalized === 'WAITING_CLEANING' ||
    normalized === 'WAITING_REPAIR' ||
    normalized === 'DISABLED'
  ) {
    return normalized
  }
  return 'IDLE'
}

function toLegacyUsageStatus(status: string | undefined): TransferBagUsageStatusKey {
  const normalized = String(status || 'DRAFT').toUpperCase()
  if (
    normalized === 'DRAFT' ||
    normalized === 'PACKING' ||
    normalized === 'READY_TO_DISPATCH' ||
    normalized === 'DISPATCHED' ||
    normalized === 'PENDING_SIGNOFF' ||
    normalized === 'WAITING_RETURN' ||
    normalized === 'RETURN_INSPECTING' ||
    normalized === 'CLOSED' ||
    normalized === 'EXCEPTION_CLOSED'
  ) {
    return normalized
  }
  return 'DRAFT'
}

function toRuntimeCarrierRecord(master: TransferBagMaster): TransferCarrierRecord {
  const normalized = normalizeTransferCarrierRecord(master as unknown as Record<string, unknown>)
  const carrierId = normalized.carrierId
  const carrierCode = normalized.carrierCode
  const carrierType = toCarrierType(carrierCode, master.carrierType)
  const encoded = encodeCarrierQr({
    carrierId,
    carrierCode,
    carrierType,
    cycleId: master.currentCycleId || 'idle-cycle',
    issuedAt: '2026-03-24 08:00',
  })

  return {
    carrierId,
    carrierCode,
    carrierType,
    bagType: master.bagType,
    capacity: master.capacity,
    reusable: master.reusable,
    currentStatus: master.currentStatus,
    currentLocation: master.currentLocation,
    latestCycleId: normalized.latestCycleId,
    latestCycleNo: normalized.latestCycleNo,
    currentCycleId: normalized.currentCycleId,
    currentOwnerTaskId: normalized.currentOwnerTaskId,
    note: master.note,
    qrMeta: readLegacyTransferQrMeta(master) || encoded.payload,
    qrValue: master.qrValue || encoded.qrValue,
  }
}

function toLegacyMaster(master: TransferCarrierRecord): TransferBagMaster {
  const legacyMaster = {
    carrierId: master.carrierId,
    carrierCode: master.carrierCode,
    carrierType: master.carrierType,
    latestCycleId: master.latestCycleId || '',
    latestCycleNo: master.latestCycleNo || '',
    bagId: master.carrierId,
    bagCode: master.carrierCode,
    bagType: master.bagType,
    capacity: master.capacity,
    reusable: master.reusable,
    currentStatus: toLegacyMasterStatus(master.currentStatus),
    currentLocation: master.currentLocation,
    latestUsageId: master.latestCycleId || '',
    latestUsageNo: master.latestCycleNo || '',
    currentCycleId: master.currentCycleId || '',
    currentOwnerTaskId: master.currentOwnerTaskId || '',
    qrValue: master.qrValue,
    qrMeta: readRuntimeTransferQrMeta(master),
    note: master.note,
  } as TransferBagMaster & Record<string, unknown>
  assignLegacyTransferQrMeta(legacyMaster, readRuntimeTransferQrMeta(master))
  return legacyMaster
}

function toRuntimeUsage(usage: TransferBagUsage): TransferCarrierCycleRecord {
  const normalized = normalizeTransferCarrierCycleRecord(usage as unknown as Record<string, unknown>)
  return {
    cycleId: normalized.cycleId,
    cycleNo: normalized.cycleNo,
    carrierId: normalized.carrierId,
    carrierCode: normalized.carrierCode,
    carrierType: normalized.carrierType,
    sewingTaskId: usage.sewingTaskId,
    sewingTaskNo: usage.sewingTaskNo,
    sewingFactoryId: usage.sewingFactoryId,
    sewingFactoryName: usage.sewingFactoryName,
    styleCode: usage.styleCode,
    spuCode: usage.spuCode,
    skuSummary: usage.skuSummary,
    colorSummary: usage.colorSummary,
    sizeSummary: usage.sizeSummary,
    cycleStatus: normalized.cycleStatus as TransferBagUsageStatusKey,
    status: String(usage.status || ''),
    packedTicketCount: usage.packedTicketCount,
    packedOriginalCutOrderCount: usage.packedOriginalCutOrderCount,
    startedAt: usage.startedAt || '',
    finishedPackingAt: usage.finishedPackingAt || '',
    dispatchAt: usage.dispatchAt,
    dispatchBy: usage.dispatchBy,
    signoffStatus: usage.signoffStatus,
    signedAt: usage.signedAt || '',
    returnedAt: usage.returnedAt || '',
    note: usage.note,
  }
}

function toLegacyUsage(usage: TransferCarrierCycleRecord): TransferBagUsage {
  return {
    cycleId: usage.cycleId,
    cycleNo: usage.cycleNo,
    carrierId: usage.carrierId,
    carrierCode: usage.carrierCode,
    carrierType: usage.carrierType,
    usageId: usage.cycleId,
    usageNo: usage.cycleNo,
    bagId: usage.carrierId,
    bagCode: usage.carrierCode,
    sewingTaskId: usage.sewingTaskId,
    sewingTaskNo: usage.sewingTaskNo,
    sewingFactoryId: usage.sewingFactoryId,
    sewingFactoryName: usage.sewingFactoryName,
    styleCode: usage.styleCode,
    spuCode: usage.spuCode,
    skuSummary: usage.skuSummary,
    colorSummary: usage.colorSummary,
    sizeSummary: usage.sizeSummary,
    cycleStatus: toLegacyUsageStatus(usage.cycleStatus),
    usageStatus: toLegacyUsageStatus(usage.cycleStatus),
    packedTicketCount: usage.packedTicketCount || 0,
    packedOriginalCutOrderCount: usage.packedOriginalCutOrderCount || 0,
    startedAt: usage.startedAt || '',
    finishedPackingAt: usage.finishedPackingAt || '',
    dispatchAt: usage.dispatchAt || '',
    dispatchBy: usage.dispatchBy || '',
    signoffStatus: usage.signoffStatus || 'PENDING',
    signedAt: usage.signedAt || '',
    returnedAt: usage.returnedAt || '',
    status: usage.status,
    note: usage.note,
  }
}

function toRuntimeBinding(binding: TransferBagItemBinding): CarrierCycleItemBinding {
  const cycleKey = binding.cycleId
  const normalized = normalizeCarrierCycleItemBinding(binding as unknown as Record<string, unknown>, {
    [cycleKey]: binding as unknown as Record<string, unknown>,
  })
  return {
    bindingId: binding.bindingId,
    cycleId: normalized.cycleId,
    cycleNo: normalized.cycleNo,
    carrierId: normalized.carrierId,
    carrierCode: normalized.carrierCode,
    feiTicketId: normalized.feiTicketId,
    feiTicketNo: normalized.feiTicketNo,
    originalCutOrderId: binding.originalCutOrderId,
    originalCutOrderNo: binding.originalCutOrderNo,
    productionOrderNo: binding.productionOrderNo,
    mergeBatchNo: binding.mergeBatchNo,
    fabricRollNo: binding.fabricRollNo || '',
    fabricColor: binding.fabricColor || '',
    size: binding.size || '',
    partCode: binding.ticket?.partCode || '',
    partName: binding.partName || '',
    bundleNo: binding.bundleNo || '',
    qty: binding.qty,
    actualCutPieceQty: binding.actualCutPieceQty ?? binding.qty,
    garmentQty: binding.garmentQty ?? binding.qty,
    assemblyGroupKey: binding.assemblyGroupKey || '',
    siblingPartTicketNos: [...(binding.siblingPartTicketNos || [])],
    boundAt: binding.boundAt,
    boundBy: binding.boundBy,
    operator: normalized.operator,
    status: normalized.status as 'BOUND' | 'REMOVED',
    note: binding.note,
  }
}

function toLegacyBinding(binding: CarrierCycleItemBinding): TransferBagItemBinding {
  return {
    bindingId: binding.bindingId,
    cycleId: binding.cycleId,
    cycleNo: binding.cycleNo,
    carrierId: binding.carrierId,
    carrierCode: binding.carrierCode,
    feiTicketId: binding.feiTicketId,
    feiTicketNo: binding.feiTicketNo,
    usageId: binding.cycleId,
    usageNo: binding.cycleNo,
    bagId: binding.carrierId,
    bagCode: binding.carrierCode,
    ticketRecordId: binding.feiTicketId,
    ticketNo: binding.feiTicketNo,
    originalCutOrderId: binding.originalCutOrderId,
    originalCutOrderNo: binding.originalCutOrderNo,
    productionOrderNo: binding.productionOrderNo,
    mergeBatchNo: binding.mergeBatchNo,
    裁剪批次No: binding.mergeBatchNo,
    fabricRollNo: binding.fabricRollNo || '',
    fabricColor: binding.fabricColor || '',
    size: binding.size || '',
    partName: binding.partName || '',
    bundleNo: binding.bundleNo || '',
    qty: binding.qty,
    garmentQty: binding.garmentQty ?? binding.qty,
    actualCutPieceQty: binding.actualCutPieceQty ?? binding.qty,
    assemblyGroupKey: binding.assemblyGroupKey || '',
    siblingPartTicketNos: [...(binding.siblingPartTicketNos || [])],
    boundAt: binding.boundAt,
    boundBy: binding.boundBy,
    operator: binding.operator || binding.boundBy,
    status: binding.status || 'BOUND',
    note: binding.note,
  }
}

function toRuntimeManifest(manifest: TransferBagDispatchManifest): TransferBagDispatchManifestRecord {
  const normalized = normalizeTransferBagDispatchManifest(manifest as unknown as Record<string, unknown>)
  return {
    manifestId: manifest.manifestId,
    cycleId: normalized.cycleId,
    carrierCode: normalized.carrierCode,
    sewingTaskNo: manifest.sewingTaskNo,
    sewingFactoryName: manifest.sewingFactoryName,
    ticketCount: manifest.ticketCount,
    originalCutOrderCount: manifest.originalCutOrderCount,
    createdAt: manifest.createdAt,
    createdBy: manifest.createdBy,
    printStatus: manifest.printStatus,
    note: manifest.note,
  }
}

function toLegacyManifest(manifest: TransferBagDispatchManifestRecord): TransferBagDispatchManifest {
  return {
    manifestId: manifest.manifestId,
    cycleId: manifest.cycleId,
    carrierCode: manifest.carrierCode,
    usageId: manifest.cycleId,
    bagCode: manifest.carrierCode,
    sewingTaskNo: manifest.sewingTaskNo,
    sewingFactoryName: manifest.sewingFactoryName,
    ticketCount: manifest.ticketCount,
    originalCutOrderCount: manifest.originalCutOrderCount,
    createdAt: manifest.createdAt,
    createdBy: manifest.createdBy,
    printStatus: manifest.printStatus,
    note: manifest.note,
  }
}

function toRuntimeStore(store: TransferBagStore): TransferBagRuntimeStore {
  return {
    masters: store.masters.map((item) => toRuntimeCarrierRecord(item)),
    usages: store.usages.map((item) => toRuntimeUsage(item)),
    bindings: store.bindings.map((item) => toRuntimeBinding(item)),
    manifests: store.manifests.map((item) => toRuntimeManifest(item)),
    sewingTasks: store.sewingTasks.map((item) => ({ ...item })) as SewingTaskRefRecord[],
    auditTrail: store.auditTrail.map((item) => ({ ...item })),
    returnReceipts: store.returnReceipts.map((item) => ({ ...item })),
    conditionRecords: store.conditionRecords.map((item) => ({ ...item })),
    reuseCycles: store.reuseCycles.map((item) => ({ ...item })),
    closureResults: store.closureResults.map((item) => ({ ...item })),
    returnAuditTrail: store.returnAuditTrail.map((item) => ({ ...item })),
  }
}

function toLegacyStore(store: TransferBagRuntimeStore): TransferBagStore {
  return {
    masters: store.masters.map((item) => toLegacyMaster(item)),
    usages: store.usages.map((item) => toLegacyUsage(item)),
    bindings: store.bindings.map((item) => toLegacyBinding(item)),
    manifests: store.manifests.map((item) => toLegacyManifest(item)),
    sewingTasks: store.sewingTasks.map((item) => ({ ...item })),
    auditTrail: store.auditTrail as TransferBagUsageAuditTrail[],
    returnReceipts: store.returnReceipts as TransferBagReturnReceipt[],
    conditionRecords: store.conditionRecords as TransferBagConditionRecord[],
    reuseCycles: store.reuseCycles as TransferBagReuseCycleSummary[],
    closureResults: store.closureResults as TransferBagUsageClosureResult[],
    returnAuditTrail: store.returnAuditTrail as TransferBagReturnAuditTrail[],
  }
}

function toRuntimeSeedOriginalRows(rows: OriginalCutOrderRow[]): TransferBagSeedOriginalRowLike[] {
  return rows.map((row) => ({
    originalCutOrderId: row.originalCutOrderId,
    originalCutOrderNo: row.originalCutOrderNo,
    productionOrderNo: row.productionOrderNo,
    styleCode: row.styleCode,
    spuCode: row.spuCode,
    color: row.color,
    materialSku: row.materialSku,
    plannedQty: row.plannedQty,
    orderQty: row.orderQty,
  }))
}

function toRuntimeSeedMergeBatches(batches: MergeBatchRecord[]): TransferBagSeedMergeBatchLike[] {
  return batches.map((batch) => ({
    mergeBatchId: batch.mergeBatchId,
    mergeBatchNo: batch.mergeBatchNo,
    styleCode: batch.styleCode,
    spuCode: batch.spuCode,
    materialSkuSummary: batch.materialSkuSummary,
    items: batch.items.map((item) => ({
      originalCutOrderId: item.originalCutOrderId,
    })),
  }))
}

function toRuntimeSeedTickets(ticketRecords: FeiTicketLabelRecord[]): TransferBagSeedTicketLike[] {
  return ticketRecords.map((record) => ({
    feiTicketId: record.ticketRecordId,
    feiTicketNo: record.ticketNo,
    sourceSpreadingSessionId: record.sourceSpreadingSessionId || '',
    sourceSpreadingSessionNo: record.sourceSpreadingSessionNo || '',
    sourceMarkerId: record.sourceMarkerId || '',
    sourceMarkerNo: record.sourceMarkerNo || '',
    sourceWritebackId: '',
    originalCutOrderId: record.originalCutOrderId,
    originalCutOrderNo: record.originalCutOrderNo,
    productionOrderNo: record.productionOrderNo,
    mergeBatchNo: record.sourceMergeBatchNo,
    styleCode: record.styleCode,
    spuCode: record.spuCode,
    fabricRollNo: record.fabricRollNo,
    fabricColor: record.fabricColor,
    color: record.color,
    size: record.size,
    partCode: record.partCode,
    partName: record.partName,
    bundleNo: record.bundleNo,
    qty: record.quantity,
    actualCutPieceQty: record.actualCutPieceQty,
    assemblyGroupKey: record.assemblyGroupKey,
    siblingPartTicketNos: record.siblingPartTicketNos,
    garmentQty: record.quantity,
    materialSku: record.materialSku,
    sourceContextType: record.sourceContextType,
    status: record.status,
  }))
}

function sanitizeId(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function buildTaskResolutionResult(
  source: TransferBagCycleContextResolution['source'],
  matches: SewingTaskRef[],
  missingReason: string,
  ambiguousReason: string,
): TransferBagCycleContextResolution {
  if (matches.length === 1) {
    return {
      ok: true,
      reason: '',
      sewingTask: matches[0],
      source,
    }
  }
  if (matches.length > 1) {
    return {
      ok: false,
      reason: ambiguousReason,
      sewingTask: null,
      source,
    }
  }
  return {
    ok: false,
    reason: missingReason,
    sewingTask: null,
    source: null,
  }
}

export function resolveTransferBagCycleContextFromTicket(options: {
  ticket: TransferBagTicketCandidate | null
  sewingTasks: SewingTaskRef[]
}): TransferBagCycleContextResolution {
  if (!options.ticket) {
    return { ok: false, reason: '当前票号不存在，请先确认菲票记录。', sewingTask: null, source: null }
  }

  if (options.ticket.mergeBatchNo) {
    const matches = options.sewingTasks.filter((task) => task.sewingTaskId === `sewing-task-${sanitizeId(options.ticket!.mergeBatchNo)}`)
    const result = buildTaskResolutionResult(
      'merge-batch',
      matches,
      '',
      `${options.ticket.mergeBatchNo} 对应了多个车缝任务，暂不能自动装袋。`,
    )
    if (result.ok || matches.length > 1) return result
  }

  if (options.ticket.originalCutOrderId) {
    const matches = options.sewingTasks.filter(
      (task) => task.sewingTaskId === `sewing-task-fallback-${sanitizeId(options.ticket!.originalCutOrderId)}`,
    )
    const result = buildTaskResolutionResult(
      'original-order',
      matches,
      '',
      `${options.ticket.originalCutOrderNo} 对应了多个车缝任务，暂不能自动装袋。`,
    )
    if (result.ok || matches.length > 1) return result
  }

  const styleMatches = options.sewingTasks.filter(
    (task) => task.styleCode === options.ticket!.styleCode && task.spuCode === options.ticket!.spuCode,
  )
  if (styleMatches.length === 1) {
    return {
      ok: true,
      reason: '',
      sewingTask: styleMatches[0],
      source: 'style-spu',
    }
  }
  if (styleMatches.length > 1) {
    return {
      ok: false,
      reason: `${options.ticket.ticketNo} 无法唯一定位车缝厂，请联系班组长确认。`,
      sewingTask: null,
      source: 'style-spu',
    }
  }

  return {
    ok: false,
    reason: `${options.ticket.ticketNo} 无法自动推导当前车缝厂 / 任务，暂不能装袋。`,
    sewingTask: null,
    source: null,
  }
}

export function ensureUsageContextLockedByTicket(options: {
  usage: TransferBagUsage | null
  ticket: TransferBagTicketCandidate | null
  sewingTasks: SewingTaskRef[]
  sewingTasksById: Record<string, SewingTaskRef>
}): TransferBagCycleContextResolution {
  if (options.usage?.sewingTaskId) {
    const lockedTask = options.sewingTasksById[options.usage.sewingTaskId] || null
    if (!lockedTask) {
      return { ok: false, reason: '当前周转上下文不完整，请重新扫描首张菲票。', sewingTask: null, source: null }
    }
    if (options.ticket) {
      const resolved = resolveTransferBagCycleContextFromTicket({
        ticket: options.ticket,
        sewingTasks: options.sewingTasks,
      })
      if (resolved.ok && resolved.sewingTask && resolved.sewingTask.sewingTaskId !== lockedTask.sewingTaskId) {
        return {
          ok: false,
          reason: `当前袋已锁定到 ${lockedTask.sewingFactoryName} / ${lockedTask.styleCode || lockedTask.spuCode}，不可混装。`,
          sewingTask: null,
          source: 'usage-locked',
        }
      }
    }
    if (
      options.ticket &&
      ((lockedTask.styleCode && options.ticket.styleCode && lockedTask.styleCode !== options.ticket.styleCode) ||
        (lockedTask.spuCode && options.ticket.spuCode && lockedTask.spuCode !== options.ticket.spuCode))
    ) {
      return {
        ok: false,
        reason: `当前袋已锁定到 ${lockedTask.sewingFactoryName} / ${lockedTask.styleCode || lockedTask.spuCode}，不可混装。`,
        sewingTask: null,
        source: 'usage-locked',
      }
    }
    return {
      ok: true,
      reason: '',
      sewingTask: lockedTask,
      source: 'usage-locked',
    }
  }

  return resolveTransferBagCycleContextFromTicket({
    ticket: options.ticket,
    sewingTasks: options.sewingTasks,
  })
}

function formatNumber(value: number): string {
  return numberFormatter.format(Math.max(value, 0))
}

export function deriveTransferBagMasterStatus(status: TransferBagMasterStatusKey): TransferBagSummaryMeta<TransferBagMasterStatusKey> {
  return createMeta(status, masterStatusMetaMap[status])
}

export function deriveTransferBagUsageStatus(status: TransferBagUsageStatusKey): TransferBagSummaryMeta<TransferBagUsageStatusKey> {
  return createMeta(status, usageStatusMetaMap[status])
}

export function derivePocketCarrierStatus(status: PocketCarrierStatusKey): TransferBagSummaryMeta<PocketCarrierStatusKey> {
  return createMeta(status, pocketCarrierStatusMetaMap[status])
}

export function deriveTransferBagVisibleStatusMeta(status: TransferBagVisibleStatusKey): TransferBagSummaryMeta<TransferBagVisibleStatusKey> {
  return createMeta(status, visibleStatusMetaMap[status])
}

export function deriveTransferBagVisibleStatusFromUsage(options: {
  usage: TransferBagUsage | null
  masterStatus: TransferBagMasterStatusKey
}): TransferBagVisibleStatusKey {
  if (options.masterStatus === 'DISABLED' || options.masterStatus === 'WAITING_CLEANING' || options.masterStatus === 'WAITING_REPAIR') {
    return 'ARCHIVED'
  }
  if (!options.usage) return 'IDLE'
  if (options.usage.usageStatus === 'READY_TO_DISPATCH') return 'READY_HANDOVER'
  if (
    options.usage.usageStatus === 'DISPATCHED' ||
    options.usage.usageStatus === 'PENDING_SIGNOFF' ||
    options.usage.usageStatus === 'WAITING_RETURN' ||
    options.usage.usageStatus === 'RETURN_INSPECTING'
  ) {
    return 'HANDED_OVER'
  }
  if (options.usage.usageStatus === 'CLOSED') return 'IDLE'
  if (options.usage.usageStatus === 'EXCEPTION_CLOSED') return 'ARCHIVED'
  return 'IN_PROGRESS'
}

export function deriveTransferBagVisibleStatusFromMaster(options: {
  master: TransferBagMaster
  usage: TransferBagUsage | null
}): TransferBagVisibleStatusKey {
  return deriveTransferBagVisibleStatusFromUsage({
    usage: options.usage,
    masterStatus: options.master.currentStatus,
  })
}

export function isTransferBagUsageActiveStatus(status: TransferBagUsageStatusKey): boolean {
  return status !== 'CLOSED' && status !== 'EXCEPTION_CLOSED'
}

export function mapUsageStatusToPocketCarrierStatus(options: {
  usage: TransferBagUsage | null
  masterStatus: TransferBagMasterStatusKey
}): PocketCarrierStatusKey {
  if (options.masterStatus === 'DISABLED') return 'DISABLED'
  if (!options.usage) return 'IDLE'
  if (options.usage.usageStatus === 'READY_TO_DISPATCH') return 'READY_TO_DISPATCH'
  if (options.usage.usageStatus === 'DISPATCHED' || options.usage.usageStatus === 'PENDING_SIGNOFF') return 'DISPATCHED'
  if (options.usage.usageStatus === 'WAITING_RETURN') return 'SIGNED'
  if (options.usage.usageStatus === 'RETURN_INSPECTING') return 'RETURNED'
  if (options.usage.usageStatus === 'CLOSED' || options.usage.usageStatus === 'EXCEPTION_CLOSED') {
    return options.masterStatus === 'DISABLED' ? 'DISABLED' : 'IDLE'
  }
  return 'PACKING'
}

export function buildWarehouseQueryPayload(options: {
  originalCutOrderId?: string
  originalCutOrderNo?: string
  productionOrderId?: string
  productionOrderNo?: string
  mergeBatchId?: string
  mergeBatchNo?: string
  materialSku?: string
  spreadingSessionId?: string
  sourceWritebackId?: string
  ticketId?: string
  ticketNo?: string
  bagId?: string
  bagCode?: string
  usageId?: string
  usageNo?: string
  sewingTaskNo?: string
}): TransferBagNavigationPayload {
  return {
    cutPieceWarehouse: {
      originalCutOrderId: options.originalCutOrderId,
      originalCutOrderNo: options.originalCutOrderNo,
      productionOrderId: options.productionOrderId,
      productionOrderNo: options.productionOrderNo,
      mergeBatchId: options.mergeBatchId,
      mergeBatchNo: options.mergeBatchNo,
      materialSku: options.materialSku,
      spreadingSessionId: options.spreadingSessionId,
      sourceWritebackId: options.sourceWritebackId,
    },
    feiTickets: {
      originalCutOrderId: options.originalCutOrderId,
      originalCutOrderNo: options.originalCutOrderNo,
      productionOrderId: options.productionOrderId,
      ticketId: options.ticketId,
      ticketNo: options.ticketNo,
      materialSku: options.materialSku,
      mergeBatchId: options.mergeBatchId,
      mergeBatchNo: options.mergeBatchNo,
    },
    originalOrders: {
      originalCutOrderId: options.originalCutOrderId,
      originalCutOrderNo: options.originalCutOrderNo,
      productionOrderId: options.productionOrderId,
      productionOrderNo: options.productionOrderNo,
      mergeBatchId: options.mergeBatchId,
      mergeBatchNo: options.mergeBatchNo,
      materialSku: options.materialSku,
    },
    summary: {
      originalCutOrderId: options.originalCutOrderId,
      originalCutOrderNo: options.originalCutOrderNo,
      productionOrderId: options.productionOrderId,
      productionOrderNo: options.productionOrderNo,
      mergeBatchId: options.mergeBatchId,
      bagCode: options.bagCode,
      bagId: options.bagId,
      sewingTaskNo: options.sewingTaskNo,
      mergeBatchNo: options.mergeBatchNo,
      materialSku: options.materialSku,
      ticketId: options.ticketId,
      ticketNo: options.ticketNo,
      usageId: options.usageId,
      usageNo: options.usageNo,
    },
  }
}

export function buildTransferBagNavigationPayload(options: {
  originalCutOrderId?: string
  originalCutOrderNo?: string
  productionOrderId?: string
  productionOrderNo?: string
  mergeBatchId?: string
  mergeBatchNo?: string
  materialSku?: string
  spreadingSessionId?: string
  sourceWritebackId?: string
  ticketId?: string
  ticketNo?: string
  bagId?: string
  bagCode?: string
  usageId?: string
  usageNo?: string
  sewingTaskNo?: string
}): TransferBagNavigationPayload {
  return buildWarehouseQueryPayload(options)
}

export function buildTransferBagParentChildSummary(bindings: TransferBagItemBinding[]): TransferBagParentChildSummary {
  return {
    ticketCount: bindings.length,
    originalCutOrderCount: uniqueStrings(bindings.map((item) => item.originalCutOrderNo)).length,
    productionOrderCount: uniqueStrings(bindings.map((item) => item.productionOrderNo)).length,
    mergeBatchCount: uniqueStrings(bindings.map((item) => item.mergeBatchNo)).length,
    assemblyGroupCount: uniqueStrings(bindings.map((item) => item.assemblyGroupKey)).length,
    quantityTotal: bindings.reduce((sum, item) => sum + Math.max(item.qty, 0), 0),
    garmentQtyTotal: bindings.reduce((sum, item) => sum + Math.max(item.garmentQty ?? item.qty, 0), 0),
  }
}

export function buildBagUsageAuditTrail(options: {
  usageId: string
  action: string
  actionAt: string
  actionBy: string
  note: string
}): TransferBagUsageAuditTrail {
  return {
    auditTrailId: buildBagAuditId(options.actionAt, options.usageId, options.action),
    usageId: options.usageId,
    action: options.action,
    actionAt: options.actionAt,
    actionBy: options.actionBy,
    note: options.note,
  }
}

export function createTransferBagUsageDraft(options: {
  bag: TransferBagMaster
  sewingTask: SewingTaskRef
  note?: string
  existingUsages: TransferBagUsage[]
  nowText: string
}): TransferBagUsage {
  const runtimeUsage = createCarrierCycleRecord({
    carrier: toRuntimeCarrierRecord(options.bag),
    sewingTask: { ...options.sewingTask },
    nowText: options.nowText,
    existingUsages: options.existingUsages.map((item) => toRuntimeUsage(item)),
    note: options.note?.trim() || '正式载具周期草稿已创建，等待先扫口袋码再扫菲票子码。',
  })
  return toLegacyUsage(runtimeUsage)
}

export function validateBagToSewingTaskBinding(usage: TransferBagUsage | null, sewingTaskId: string): TransferBagValidationResult {
  if (!usage) return { ok: false, reason: '当前没有可绑定的使用周期，请先创建使用周期草稿。' }
  if (!sewingTaskId) return { ok: false, reason: '当前使用周期尚未绑定车缝任务。' }
  if (usage.sewingTaskId && usage.sewingTaskId !== sewingTaskId) {
    return { ok: false, reason: '同一次使用周期只能归属一个车缝任务，请不要混装到多个车缝任务。' }
  }
  return { ok: true, reason: '' }
}

export function validateTicketBindingEligibility(options: {
  ticket: TransferBagTicketCandidate | null
  usage: TransferBagUsage | null
  sewingTask: SewingTaskRef | null
  bindings: TransferBagItemBinding[]
  usagesById: Record<string, TransferBagUsage>
}): TransferBagValidationResult {
  if (!options.ticket) return { ok: false, reason: '当前票号不存在，请先确认菲票记录。' }
  if (!options.usage) return { ok: false, reason: '请先创建或选择一个使用周期，再进行装袋。' }
  if (!options.sewingTask) return { ok: false, reason: '当前使用周期尚未绑定车缝任务。' }
  if (options.ticket.ticketStatus === 'VOIDED') {
    return { ok: false, reason: `${options.ticket.ticketNo} 已作废，禁止继续装袋。` }
  }
  if (!options.ticket.originalCutOrderId || !options.ticket.originalCutOrderNo) {
    return { ok: false, reason: '当前菲票缺少原始裁片单 owner，不能进入中转袋。' }
  }

  const sameUsageBinding = options.bindings.find(
    (binding) => binding.ticketRecordId === options.ticket.ticketRecordId && binding.usageId === options.usage.usageId,
  )
  if (sameUsageBinding) {
    return { ok: false, reason: `${options.ticket.ticketNo} 已在当前口袋中，无需重复装袋。` }
  }

  const existingBinding = options.bindings.find((binding) => binding.ticketRecordId === options.ticket.ticketRecordId && binding.usageId !== options.usage.usageId)
  if (existingBinding) {
    const otherUsage = options.usagesById[existingBinding.usageId]
    if (otherUsage && isTransferBagUsageActiveStatus(otherUsage.usageStatus)) {
      return { ok: false, reason: `${options.ticket.ticketNo} 已绑定到 ${otherUsage.usageNo}，不能重复装袋。` }
    }
  }

  if (options.sewingTask.styleCode && options.ticket.styleCode && options.sewingTask.styleCode !== options.ticket.styleCode) {
    return { ok: false, reason: `${options.ticket.ticketNo} 的款号与当前车缝任务不一致，不能装入同一使用周期。` }
  }

  if (options.sewingTask.spuCode && options.ticket.spuCode && options.sewingTask.spuCode !== options.ticket.spuCode) {
    return { ok: false, reason: `${options.ticket.ticketNo} 的 SPU 与当前车缝任务不一致，不能装入同一使用周期。` }
  }

  return { ok: true, reason: '' }
}

export function createTransferBagDispatchManifest(options: {
  usage: TransferBagUsage
  summary: TransferBagParentChildSummary
  nowText: string
  createdBy: string
  note?: string
}): TransferBagDispatchManifest {
  const runtimeManifest = createCarrierDispatchManifest({
    cycle: toRuntimeUsage(options.usage),
    bindings: [],
    nowText: options.nowText,
    createdBy: options.createdBy,
    note: options.note?.trim() || '当前交接清单来自正式载具周期映射。',
  })
  return {
    ...toLegacyManifest(runtimeManifest),
    ticketCount: options.summary.ticketCount,
    originalCutOrderCount: options.summary.originalCutOrderCount,
  }
}

function buildSewingTaskSeeds(
  originalRows: OriginalCutOrderRow[] = [],
  mergeBatches: MergeBatchRecord[] = [],
): SewingTaskRef[] {
  const mergeTaskSeeds = mergeBatches.slice(0, 3).map((batch, index) => {
    const factory = pickTransferBagSewingFactory(index)
    return {
    sewingTaskId: `sewing-task-${sanitizeId(batch.mergeBatchNo)}`,
    sewingTaskNo: `CF-${String(index + 1).padStart(3, '0')}`,
    sewingFactoryId: factory.factoryId,
    sewingFactoryName: factory.factoryName,
    styleCode: batch.styleCode,
    spuCode: batch.spuCode,
    skuSummary: batch.materialSkuSummary,
    colorSummary: uniqueStrings(batch.items.map((item) => originalRows.find((row) => row.originalCutOrderId === item.originalCutOrderId)?.color)).join(' / ') || '混色',
    sizeSummary: 'S / M / L',
    plannedQty: batch.items.length * 24,
    status: index === 0 ? '待接料' : index === 1 ? '排单中' : '待交接',
    note: `来源于 ${batch.mergeBatchNo} 的后道交接任务预留。`,
  }})

  const fallbackRows = originalRows.map((row, index) => {
    const factory = pickTransferBagSewingFactory(index + mergeTaskSeeds.length)
    return {
    sewingTaskId: `sewing-task-fallback-${sanitizeId(row.originalCutOrderId)}`,
    sewingTaskNo: `CF-FB-${String(index + 1).padStart(3, '0')}`,
    sewingFactoryId: factory.factoryId,
    sewingFactoryName: factory.factoryName,
    styleCode: row.styleCode,
    spuCode: row.spuCode,
    skuSummary: row.materialSku,
    colorSummary: row.color,
    sizeSummary: '默认尺码组',
    plannedQty: row.plannedQty || row.orderQty,
    status: '待接料',
    note: '用于无批次场景下的交接任务预留。',
  }})

  return [...mergeTaskSeeds, ...fallbackRows]
}

function buildTicketCandidates(ticketRecords: FeiTicketLabelRecord[]): TransferBagTicketCandidate[] {
  return ticketRecords
    .map((record) => ({
      ticketRecordId: record.ticketRecordId,
      feiTicketId: record.ticketRecordId,
      ticketNo: record.ticketNo,
      sourceSpreadingSessionId: record.sourceSpreadingSessionId || '',
      sourceSpreadingSessionNo: record.sourceSpreadingSessionNo || '',
      sourceMarkerId: record.sourceMarkerId || '',
      sourceMarkerNo: record.sourceMarkerNo || '',
      originalCutOrderId: record.originalCutOrderId,
      originalCutOrderNo: record.originalCutOrderNo,
      productionOrderId: record.sourceProductionOrderId || '',
      productionOrderNo: record.productionOrderNo,
      mergeBatchId: record.sourceMergeBatchId || '',
      mergeBatchNo: record.sourceMergeBatchNo,
      styleCode: record.styleCode,
      spuCode: record.spuCode,
      fabricRollNo: record.fabricRollNo || '',
      fabricColor: record.fabricColor || record.color || '',
      color: record.color,
      size: record.size || '',
      partCode: record.partCode || '',
      partName: record.partName || '',
      bundleNo: record.bundleNo || '',
      qty: Math.max(record.quantity ?? 1, 1),
      actualCutPieceQty: Math.max(record.actualCutPieceQty ?? record.quantity ?? 1, 1),
      assemblyGroupKey: record.assemblyGroupKey || '',
      siblingPartTicketNos: [...(record.siblingPartTicketNos || [])],
      garmentQty: Math.max(record.quantity ?? 1, 1),
      materialSku: record.materialSku,
      sourceContextType: record.sourceContextType,
      ticketStatus: record.status,
    }))
    .sort((left, right) => left.ticketNo.localeCompare(right.ticketNo, 'zh-CN'))
}

export function buildActiveTicketPocketBindingMap(store: TransferBagStore): Record<string, ActiveTicketPocketBinding> {
  const usagesById = Object.fromEntries(store.usages.map((item) => [item.usageId, item]))
  return store.bindings.reduce<Record<string, ActiveTicketPocketBinding>>((accumulator, binding) => {
    const usage = usagesById[binding.usageId]
    if (!usage || !isTransferBagUsageActiveStatus(usage.usageStatus)) return accumulator
    accumulator[binding.ticketRecordId] = {
      bindingId: binding.bindingId,
      ticketRecordId: binding.ticketRecordId,
      ticketNo: binding.ticketNo,
      pocketId: binding.bagId,
      pocketNo: binding.bagCode,
      usageId: usage.usageId,
      usageNo: binding.usageNo || usage.usageNo,
      styleCode: usage.styleCode,
      boundAt: binding.boundAt,
      usageStatus: usage.usageStatus,
    }
    return accumulator
  }, {})
}

export function applyPocketBindingLocksToTicketRecords(
  ticketRecords: FeiTicketLabelRecord[],
  store: TransferBagStore,
): FeiTicketLabelRecord[] {
  const activeBindings = buildActiveTicketPocketBindingMap(store)
  return ticketRecords.map((record) => {
    const binding = activeBindings[record.ticketRecordId]
    if (!binding) {
      return {
        ...record,
        downstreamLocked: false,
        downstreamLockedReason: '',
        boundPocketNo: '',
        boundUsageNo: '',
      }
    }
    return {
      ...record,
      downstreamLocked: true,
      downstreamLockedReason: `${binding.pocketNo} / ${binding.usageNo} 使用周期未关闭，当前禁止作废或重复装袋。`,
      boundPocketNo: binding.pocketNo,
      boundUsageNo: binding.usageNo,
    }
  })
}

export function buildSystemSeedTransferBagStore(options: {
  originalRows: OriginalCutOrderRow[]
  ticketRecords: FeiTicketLabelRecord[]
  mergeBatches?: MergeBatchRecord[]
  裁剪批次es?: MergeBatchRecord[]
}): TransferBagStore {
  const mergeBatches = options.mergeBatches ?? options.裁剪批次es ?? []
  return toLegacyStore(
    buildSystemSeedTransferBagRuntime({
      originalRows: toRuntimeSeedOriginalRows(options.originalRows),
      ticketRecords: toRuntimeSeedTickets(options.ticketRecords),
      mergeBatches: toRuntimeSeedMergeBatches(mergeBatches),
    }),
  )
}

export function serializeTransferBagStorage(store: TransferBagStore): string {
  return serializeTransferBagRuntimeStorage(toRuntimeStore(store))
}

export function deserializeTransferBagStorage(raw: string | null): TransferBagStore {
  return toLegacyStore(deserializeTransferBagRuntimeStorage(raw))
}

export function deserializeTransferBagSelectedTicketIds(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

export function serializeTransferBagSelectedTicketIds(ids: string[]): string {
  return JSON['stringify'](ids)
}

export function mergeTransferBagStores(seed: TransferBagStore, stored: TransferBagStore): TransferBagStore {
  return toLegacyStore(
    mergeTransferBagRuntimeStores(toRuntimeStore(seed), toRuntimeStore(stored)),
  )
}

export function buildTransferBagViewModel(options: {
  originalRows: OriginalCutOrderRow[]
  ticketRecords: FeiTicketLabelRecord[]
  mergeBatches: MergeBatchRecord[]
  store: TransferBagStore
  spreadingStore?: MarkerSpreadingStore
}): TransferBagViewModel {
  void options.mergeBatches
  const spreadingTraceAnchors = options.spreadingStore ? buildSpreadingTraceAnchors(options.spreadingStore) : []
  const ticketCandidates = buildTicketCandidates(options.ticketRecords)
  const ticketCandidatesById = Object.fromEntries(ticketCandidates.map((item) => [item.ticketRecordId, item]))
  const ticketCandidatesByNo = Object.fromEntries(ticketCandidates.map((item) => [item.ticketNo, item]))
  const activeTicketBindingsByTicketId = buildActiveTicketPocketBindingMap(options.store)
  const sewingTasksById = Object.fromEntries(options.store.sewingTasks.map((item) => [item.sewingTaskId, item]))
  const usagesByIdRaw = Object.fromEntries(options.store.usages.map((item) => [item.usageId, item]))
  const bindingsByUsageIdRaw: Record<string, TransferBagItemBinding[]> = {}
  const manifestsByUsageId: Record<string, TransferBagDispatchManifest[]> = {}
  const auditTrailByUsageId: Record<string, TransferBagUsageAuditTrail[]> = {}

  options.store.bindings.forEach((binding) => {
    if (!bindingsByUsageIdRaw[binding.usageId]) bindingsByUsageIdRaw[binding.usageId] = []
    bindingsByUsageIdRaw[binding.usageId].push(binding)
  })

  options.store.manifests.forEach((manifest) => {
    if (!manifestsByUsageId[manifest.usageId]) manifestsByUsageId[manifest.usageId] = []
    manifestsByUsageId[manifest.usageId].push(manifest)
  })

  options.store.auditTrail.forEach((audit) => {
    if (!auditTrailByUsageId[audit.usageId]) auditTrailByUsageId[audit.usageId] = []
    auditTrailByUsageId[audit.usageId].push(audit)
  })

  function resolveBindingTraceAnchor(binding: TransferBagItemBinding, usageItem?: TransferBagUsageItem | null): SpreadingTraceAnchor | null {
    if (usageItem?.spreadingSessionId) {
      const inheritedAnchor = spreadingTraceAnchors.find((item) => item.spreadingSessionId === usageItem.spreadingSessionId) || null
      if (inheritedAnchor) return inheritedAnchor
    }
    const ticket = ticketCandidatesById[binding.ticketRecordId]
    if (ticket?.sourceSpreadingSessionId) {
      const exactAnchor = spreadingTraceAnchors.find((item) => item.spreadingSessionId === ticket.sourceSpreadingSessionId) || null
      if (exactAnchor) return exactAnchor
    }
    return findSpreadingTraceAnchor(spreadingTraceAnchors, {
      originalCutOrderIds: binding.originalCutOrderId ? [binding.originalCutOrderId] : [],
      mergeBatchId: ticket?.mergeBatchId || '',
      materialSku: ticket?.materialSku || '',
      color: ticket?.color || '',
    })
  }

  function resolveUsageTraceAnchor(usage: TransferBagUsage, bindings: TransferBagItemBinding[]): SpreadingTraceAnchor | null {
    const explicitSessionIds = uniqueStrings(
      bindings.map((item) => ticketCandidatesById[item.ticketRecordId]?.sourceSpreadingSessionId).filter(Boolean),
    )
    if (explicitSessionIds.length === 1) {
      const exactAnchor = spreadingTraceAnchors.find((item) => item.spreadingSessionId === explicitSessionIds[0]) || null
      if (exactAnchor) return exactAnchor
    }
    const originalCutOrderIds = uniqueStrings(bindings.map((item) => item.originalCutOrderId))
    const mergeBatchIds = uniqueStrings(
      bindings.map((item) => ticketCandidatesById[item.ticketRecordId]?.mergeBatchId).filter(Boolean),
    )
    const materialSkus = uniqueStrings(
      bindings.map((item) => ticketCandidatesById[item.ticketRecordId]?.materialSku).filter(Boolean),
    )
    const colors = uniqueStrings(
      bindings.map((item) => ticketCandidatesById[item.ticketRecordId]?.color).filter(Boolean),
    )

    return findSpreadingTraceAnchor(spreadingTraceAnchors, {
      originalCutOrderIds,
      mergeBatchId: mergeBatchIds[0] || '',
      materialSku: materialSkus[0] || usage.skuSummary || '',
      color: colors[0] || usage.colorSummary || '',
    })
  }

  const usageItems: TransferBagUsageItem[] = options.store.usages
    .map((usage) => {
      const bindings = (bindingsByUsageIdRaw[usage.usageId] || []).slice().sort((left, right) => left.boundAt.localeCompare(right.boundAt, 'zh-CN'))
      const traceAnchor = resolveUsageTraceAnchor(usage, bindings)
      const summary = buildTransferBagParentChildSummary(bindings)
      const manifests = (manifestsByUsageId[usage.usageId] || []).slice().sort((left, right) => right.createdAt.localeCompare(left.createdAt, 'zh-CN'))
      const bagMaster = options.store.masters.find((item) => item.bagId === usage.bagId) ?? null
      const sewingTask = sewingTasksById[usage.sewingTaskId] ?? null
      const sewingFactoryName = resolveTransferBagFactoryName(
        usage.sewingFactoryId || sewingTask?.sewingFactoryId,
        usage.sewingFactoryName || sewingTask?.sewingFactoryName,
      )
      const pocketStatusKey = mapUsageStatusToPocketCarrierStatus({
        usage,
        masterStatus: bagMaster?.currentStatus || 'IDLE',
      })
      return {
        ...usage,
        sewingFactoryName,
        statusMeta: deriveTransferBagUsageStatus(usage.usageStatus),
        visibleStatusKey: deriveTransferBagVisibleStatusFromUsage({
          usage,
          masterStatus: bagMaster?.currentStatus || 'IDLE',
        }),
        visibleStatusMeta: deriveTransferBagVisibleStatusMeta(
          deriveTransferBagVisibleStatusFromUsage({
            usage,
            masterStatus: bagMaster?.currentStatus || 'IDLE',
          }),
        ),
        pocketStatusKey,
        pocketStatusMeta: derivePocketCarrierStatus(pocketStatusKey),
        bagMaster,
        sewingTask: sewingTask
          ? {
              ...sewingTask,
              sewingFactoryName: resolveTransferBagFactoryName(sewingTask.sewingFactoryId, sewingTask.sewingFactoryName),
            }
          : null,
        summary,
        bindingItems: [],
        boundTicketIds: bindings.map((item) => item.ticketRecordId),
        ticketNos: bindings.map((item) => item.ticketNo),
        originalCutOrderNos: uniqueStrings(bindings.map((item) => item.originalCutOrderNo)),
        productionOrderNos: uniqueStrings(bindings.map((item) => item.productionOrderNo)),
        sourceMarkerNos: uniqueStrings(bindings.map((item) => item.sourceMarkerNo)),
        mergeBatchNos: uniqueStrings(bindings.map((item) => item.mergeBatchNo)),
        latestManifest: manifests[0] ?? null,
        spreadingSessionId: traceAnchor?.spreadingSessionId || '',
        spreadingSessionNo: traceAnchor?.spreadingSessionNo || '',
        spreadingSourceWritebackId: traceAnchor?.sourceWritebackId || '',
        spreadingUpdatedFromPdaAt: traceAnchor?.updatedFromPdaAt || '',
        spreadingColorSummary: traceAnchor?.colorSummary || '',
        bagFirstSatisfied: bindings.length > 0,
        bagFirstRuleLabel: bindings.length ? '必须先扫口袋码，再扫菲票子码' : '必须先扫口袋码，再扫菲票子码',
        navigationPayload: buildTransferBagNavigationPayload({
          originalCutOrderId: bindings[0]?.originalCutOrderId,
          originalCutOrderNo: bindings[0]?.originalCutOrderNo,
          productionOrderId: bindings[0]?.ticket?.productionOrderId || '',
          productionOrderNo: bindings[0]?.productionOrderNo,
          mergeBatchId: bindings[0]?.ticket?.mergeBatchId || '',
          mergeBatchNo: bindings[0]?.mergeBatchNo || undefined,
          materialSku: bindings[0]?.ticket?.materialSku || '',
          spreadingSessionId: traceAnchor?.spreadingSessionId || undefined,
          sourceWritebackId: traceAnchor?.sourceWritebackId || undefined,
          bagId: usage.bagId,
          bagCode: usage.bagCode,
          usageId: usage.usageId,
          usageNo: usage.usageNo,
          sewingTaskNo: usage.sewingTaskNo,
        }),
      }
    })
    .sort((left, right) => right.usageNo.localeCompare(left.usageNo, 'zh-CN'))

  const usageItemsById = Object.fromEntries(usageItems.map((item) => [item.usageId, item]))

  const masterItems: TransferBagMasterItem[] = options.store.masters
    .map((master) => {
      const relatedUsages = usageItems
        .filter((item) => item.bagId === master.bagId)
        .sort((left, right) => right.usageNo.localeCompare(left.usageNo, 'zh-CN'))
      const usage = relatedUsages.find((item) => isTransferBagUsageActiveStatus(item.usageStatus)) ?? null
      const latestUsage = relatedUsages[0] ?? null
      const bindings = usage ? bindingsByUsageIdRaw[usage.usageId] || [] : []
      const summary = buildTransferBagParentChildSummary(bindings)
      const pocketStatusKey = mapUsageStatusToPocketCarrierStatus({
        usage,
        masterStatus: master.currentStatus,
      })
      return {
        ...master,
        statusMeta: deriveTransferBagMasterStatus(master.currentStatus),
        visibleStatusKey: deriveTransferBagVisibleStatusFromMaster({
          master,
          usage,
        }),
        visibleStatusMeta: deriveTransferBagVisibleStatusMeta(
          deriveTransferBagVisibleStatusFromMaster({
            master,
            usage,
          }),
        ),
        latestUsageStatusMeta: latestUsage ? latestUsage.statusMeta : null,
        packedTicketCount: summary.ticketCount,
        packedOriginalCutOrderCount: summary.originalCutOrderCount,
        pocketStatusKey,
        pocketStatusMeta: derivePocketCarrierStatus(pocketStatusKey),
        currentUsage: usage,
        currentStyleCode: usage?.styleCode || '',
        currentTotalPieceCount: summary.quantityTotal,
        currentGarmentQtyTotal: summary.garmentQtyTotal,
        currentSourceProductionOrderCount: summary.productionOrderCount,
        currentSourceCutOrderCount: summary.originalCutOrderCount,
        currentSourceBatchCount: summary.mergeBatchCount,
        currentDispatchedAt: usage?.dispatchAt || latestUsage?.dispatchAt || '',
        currentSignedAt: usage?.signedAt || latestUsage?.signedAt || '',
        currentReturnedAt: usage?.returnedAt || latestUsage?.returnedAt || '',
      }
    })
    .sort((left, right) => left.bagCode.localeCompare(right.bagCode, 'zh-CN'))

  const bindingItems: TransferBagBindingItem[] = options.store.bindings
    .map((binding) => {
      const usageItem = usageItemsById[binding.usageId] ?? null
      const traceAnchor = resolveBindingTraceAnchor(binding, usageItem)
      const ticketCandidate = ticketCandidatesById[binding.ticketRecordId] ?? null
      return {
        ...binding,
        usage: usageItem,
        ticket: ticketCandidate,
        fabricRollNo: binding.fabricRollNo || ticketCandidate?.fabricRollNo || '',
        fabricColor: binding.fabricColor || ticketCandidate?.fabricColor || '',
        size: binding.size || ticketCandidate?.size || '',
        partName: binding.partName || ticketCandidate?.partName || '',
        bundleNo: binding.bundleNo || ticketCandidate?.bundleNo || '',
        assemblyGroupKey: binding.assemblyGroupKey || ticketCandidate?.assemblyGroupKey || '',
        siblingPartTicketNos: binding.siblingPartTicketNos || ticketCandidate?.siblingPartTicketNos || [],
        pocketStatusKey: mapUsageStatusToPocketCarrierStatus({
          usage: usagesByIdRaw[binding.usageId] ?? null,
          masterStatus: options.store.masters.find((item) => item.bagId === binding.bagId)?.currentStatus || 'IDLE',
        }),
        removable: ['DRAFT', 'PACKING'].includes(usagesByIdRaw[binding.usageId]?.usageStatus || ''),
        spreadingSessionId: traceAnchor?.spreadingSessionId || '',
        spreadingSessionNo: traceAnchor?.spreadingSessionNo || '',
        spreadingSourceWritebackId: traceAnchor?.sourceWritebackId || '',
        bagFirstRuleLabel: '必须先扫口袋码，再扫菲票子码',
        navigationPayload: buildTransferBagNavigationPayload({
          originalCutOrderId: binding.originalCutOrderId,
          originalCutOrderNo: binding.originalCutOrderNo,
          productionOrderId: ticketCandidatesById[binding.ticketRecordId]?.productionOrderId || '',
          productionOrderNo: binding.productionOrderNo,
          mergeBatchId: ticketCandidatesById[binding.ticketRecordId]?.mergeBatchId || '',
          mergeBatchNo: binding.mergeBatchNo || undefined,
          materialSku: ticketCandidatesById[binding.ticketRecordId]?.materialSku || '',
          spreadingSessionId: traceAnchor?.spreadingSessionId || undefined,
          sourceWritebackId: traceAnchor?.sourceWritebackId || undefined,
          ticketId: binding.feiTicketId,
          ticketNo: binding.ticketNo,
          bagId: binding.bagId,
          bagCode: binding.bagCode,
          usageId: binding.usageId,
          usageNo: usageItemsById[binding.usageId]?.usageNo,
          sewingTaskNo: usageItemsById[binding.usageId]?.sewingTaskNo,
        }),
      }
    })
    .sort((left, right) => right.boundAt.localeCompare(left.boundAt, 'zh-CN'))

  const bindingsByUsageId = Object.fromEntries(
    Object.entries(bindingsByUsageIdRaw).map(([usageId, bindings]) => [
      usageId,
      bindings
        .map((binding) => bindingItems.find((item) => item.bindingId === binding.bindingId))
        .filter((item): item is TransferBagBindingItem => Boolean(item)),
    ]),
  )

  usageItems.forEach((usageItem) => {
    usageItem.bindingItems = bindingsByUsageId[usageItem.usageId] || []
  })

  return {
    summary: {
      bagCount: masterItems.filter((item) => item.visibleStatusKey !== 'ARCHIVED').length,
      idleBagCount: masterItems.filter((item) => item.visibleStatusKey === 'IDLE').length,
      inProgressBagCount: masterItems.filter((item) => item.visibleStatusKey === 'IN_PROGRESS').length,
      readyHandoverBagCount: masterItems.filter((item) => item.visibleStatusKey === 'READY_HANDOVER').length,
      handedOverBagCount: masterItems.filter((item) => item.visibleStatusKey === 'HANDED_OVER').length,
    },
    masters: masterItems,
    mastersById: Object.fromEntries(masterItems.map((item) => [item.bagId, item])),
    usages: usageItems,
    usagesById: usageItemsById,
    bindings: bindingItems,
    bindingsByUsageId,
    activeTicketBindingsByTicketId,
    manifestsByUsageId,
    sewingTasks: options.store.sewingTasks,
    sewingTasksById,
    auditTrailByUsageId,
    ticketCandidates,
    ticketCandidatesById,
    ticketCandidatesByNo,
  }
}
