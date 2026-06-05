import {
  buildCuttingTraceabilityId,
  encodeCarrierQr,
} from '../../../data/fcs/cutting/qr-codes.ts'
import {
  normalizeCarrierCycleItemBinding,
  normalizeTransferBagDispatchManifest,
  normalizeTransferCarrierCycleRecord,
  normalizeTransferCarrierRecord,
} from '../../../data/fcs/cutting/transfer-carrier-normalizer.ts'
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
  type TransferBagSeedMarkerPlanSourceLike,
  type TransferBagSeedCutOrderRowLike,
  type TransferBagSeedTicketLike,
  type TransferBagUsageStage,
  type TransferCarrierCycleRecord,
  type TransferCarrierRecord,
} from '../../../data/fcs/cutting/transfer-bag-runtime.ts'
import {
  listCuttingSewingDispatchBatches,
  listCuttingSewingDispatchOrders,
  listCuttingSewingTransferBags,
} from '../../../data/fcs/cutting/sewing-dispatch.ts'
import {
  getFactoryMasterRecordById,
} from '../../../data/fcs/factory-master-store.ts'
import { validateFeiTicketNumberingBeforeBagging } from '../../../data/fcs/cutting/fei-ticket-numbering.ts'
import { TEST_FACTORY_ID, TEST_FACTORY_NAME } from '../../../data/fcs/factory-mock-data.ts'
import { FEI_TICKET_DEMO_CASE_IDS, type FeiTicketLabelRecord } from './fei-tickets-model.ts'
import type { MarkerPlanSourceRecord } from './marker-plan-source-model.ts'
import {
  buildSpreadingTraceAnchors,
  findSpreadingTraceAnchor,
  type MarkerSpreadingStore,
  type SpreadingTraceAnchor,
} from './marker-spreading-model.ts'
import type { CutOrderRow } from './cut-orders-model.ts'

export type { TransferBagUsageStage }

const numberFormatter = new Intl.NumberFormat('zh-CN')
const TRANSFER_QR_FIELD = ['qr', 'Payload'].join('') as const
const INBOUND_TEMP_BAG_RULE_LABEL = '入仓暂存袋可混装不同生产单、SKU、部位的菲票；车缝任务分配后再分拣装袋。'
const HANDOVER_PACKING_BAG_RULE_LABEL = '交出装袋需先扫中转袋，再扫菲票子码；本阶段才按交出单关系核对。'

function normalizeTransferBagUsageStage(stage: string | undefined): TransferBagUsageStage {
  return stage === 'INBOUND_TEMP' ? 'INBOUND_TEMP' : 'HANDOVER_PACKING'
}

export function getTransferBagUsageStageLabel(stage: string | undefined): string {
  return normalizeTransferBagUsageStage(stage) === 'INBOUND_TEMP' ? '入仓暂存' : '交出装袋'
}

export function getTransferBagRuleLabel(stage: string | undefined): string {
  return normalizeTransferBagUsageStage(stage) === 'INBOUND_TEMP'
    ? INBOUND_TEMP_BAG_RULE_LABEL
    : HANDOVER_PACKING_BAG_RULE_LABEL
}

export function isInboundTempTransferBagUsage(usage: Pick<TransferBagUsage, 'usageStage'> | null | undefined): boolean {
  return normalizeTransferBagUsageStage(usage?.usageStage) === 'INBOUND_TEMP'
}

function readTransferQrMeta(master: TransferBagMaster): ReturnType<typeof encodeCarrierQr>['payload'] | null {
  const pageMaster = master as unknown as Record<string, unknown>
  const storedValue = pageMaster[TRANSFER_QR_FIELD]
  if (storedValue && typeof storedValue === 'object') {
    return storedValue as ReturnType<typeof encodeCarrierQr>['payload']
  }
  if (master.qrMeta && typeof master.qrMeta === 'object') {
    return master.qrMeta as ReturnType<typeof encodeCarrierQr>['payload']
  }
  return null
}

function readRuntimeTransferQrMeta(master: TransferCarrierRecord): Record<string, unknown> {
  const runtimeRecord = master as unknown as Record<string, unknown>
  const runtimeValue = runtimeRecord[TRANSFER_QR_FIELD]
  if (runtimeValue && typeof runtimeValue === 'object') {
    return runtimeValue as Record<string, unknown>
  }
  if (master.qrMeta && typeof master.qrMeta === 'object') return master.qrMeta as Record<string, unknown>
  if (master.qrPayload && typeof master.qrPayload === 'object') return master.qrPayload as Record<string, unknown>
  return {}
}

function assignTransferQrMeta(target: Record<string, unknown>, value: Record<string, unknown>): void {
  target[TRANSFER_QR_FIELD] = value
}

function resolveTransferBagFactoryName(factoryId: string | undefined, fallbackName: string | undefined): string {
  if (factoryId) {
    const factory = getFactoryMasterRecordById(factoryId)
    if (factory?.name) return factory.name
  }
  return fallbackName?.trim() || '工厂档案待补'
}

function pickTransferBagSewingFactory(index: number): { factoryId: string; factoryName: string } {
  return {
    factoryId: TEST_FACTORY_ID,
    factoryName: TEST_FACTORY_NAME,
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
      mismatchTicketId: 'ticket-CUT-260301-005-01-002-v1',
      mismatchTicketNo: 'FT-CUT-260301-005-01-002',
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
  | 'SCRAP_CLOSED'
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
  source: 'marker-plan' | 'cut-order' | 'style-spu' | 'usage-locked' | null
}

export interface TransferBagMaster {
  carrierId: string
  carrierCode: string
  carrierType: 'bag' | 'box'
  latestCycleId: string
  latestCycleNo: string
  bagId: string
  bagCode: string
  bagName?: string
  bagSpec?: string
  bagMaterial?: string
  ownershipFactoryId?: string
  ownershipFactoryName?: string
  bagType: string
  capacity: number
  reusable: boolean
  currentStatus: TransferBagMasterStatusKey
  currentLocation: string
  latestUsageId: string
  latestUsageNo: string
  currentCycleId: string
  currentOwnerTaskId: string
  qrValue?: string
  qrMeta?: Record<string, unknown>
  enabled?: boolean
  createdAt?: string
  createdBy?: string
  note: string
}

export interface TransferBagUsage {
  cycleId: string
  cycleNo: string
  carrierId: string
  carrierCode: string
  carrierType: 'bag' | 'box'
  cycleStatus: TransferBagUsageStatusKey
  usageId: string
  usageNo: string
  bagId: string
  bagCode: string
  boundObjectType: string
  boundObjectId: string
  boundObjectNo: string
  receiverType: string
  receiverId: string
  receiverName: string
  sourceWarehouseId?: string
  sourceWarehouseName?: string
  warehouseArea?: string
  locationCode?: string
  sewingTaskId: string
  sewingTaskNo: string
  sewingFactoryId: string
  sewingFactoryName: string
  styleCode: string
  spuCode: string
  skuSummary: string
  colorSummary: string
  sizeSummary: string
  usageStatus: TransferBagUsageStatusKey
  packedTicketCount: number
  packedCutOrderCount: number
  startedAt?: string
  finishedPackingAt?: string
  dispatchAt: string
  dispatchBy: string
  signoffStatus: TransferBagSignoffStatus
  signedBy?: string
  signedPieceQty?: number
  signedAt?: string
  returnWarehouseName?: string
  returnedBy?: string
  returnedAt?: string
  status?: string
  usageStage?: TransferBagUsageStage
  usageStageLabel?: string
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
  usageId: string
  usageNo: string
  bagId: string
  bagCode: string
  ticketRecordId: string
  ticketNo: string
  cutOrderId: string
  cutOrderNo: string
  productionOrderNo: string
  markerPlanNo: string
  fabricRollNo?: string
  fabricColor?: string
  size?: string
  partName?: string
  bundleNo?: string
  actualCutPieceQty?: number
  唛架方案No?: string
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
  usageId: string
  bagCode: string
  sewingTaskNo: string
  sewingFactoryName: string
  ticketCount: number
  cutOrderCount: number
  createdAt: string
  createdBy: string
  printStatus: 'PRINTED'
  note: string
}

export interface TransferBagUsageAuditTrail {
  auditTrailId: string
  cycleId: string
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
  returnedCutOrderCount: number
  discrepancyType: TransferBagDiscrepancyType
  discrepancyNote: string
  note: string
}

export interface TransferBagConditionRecord {
  conditionRecordId: string
  cycleId: string
  carrierId: string
  carrierCode: string
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
  usageId: string
  usageNo: string
  closedAt: string
  closedBy: string
  closureStatus: 'CLOSED' | 'SCRAP_CLOSED'
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
  scrapRecords: TransferBagScrapRecord[]
}

export interface TransferBagPrefilter {
  cutOrderId?: string
  cutOrderNo?: string
  markerPlanId?: string
  markerPlanNo?: string
  唛架方案No?: string
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
  cutOrders: Record<string, string | undefined>
  summary: Record<string, string | undefined>
}

export interface TransferBagParentChildSummary {
  ticketCount: number
  cutOrderCount: number
  productionOrderCount: number
  markerPlanSourceCount: number
  quantityTotal: number
  garmentQtyTotal: number
}

export interface TransferBagTicketCandidate {
  ticketRecordId: string
  feiTicketId: string
  ticketNo: string
  printStatus?: FeiTicketLabelRecord['printStatus']
  sourceSpreadingSessionId: string
  sourceSpreadingSessionNo: string
  sourceMarkerId: string
  sourceMarkerNo: string
  cutOrderId: string
  cutOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  markerPlanId: string
  markerPlanNo: string
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
  garmentQty: number
  materialSku: string
  materialAlias?: string
  materialImageUrl?: string
  pieceSequenceLabel?: string
  hasSpecialCraft?: boolean
  specialCraftDisplayLabel?: string
  receiverFactoryDisplay?: string
  sourceContextType: string
  ticketStatus: FeiTicketLabelRecord['status']
}

export interface TransferBagMasterItem extends TransferBagMaster {
  statusMeta: TransferBagSummaryMeta<TransferBagMasterStatusKey>
  visibleStatusKey: TransferBagVisibleStatusKey
  visibleStatusMeta: TransferBagSummaryMeta<TransferBagVisibleStatusKey>
  latestUsageStatusMeta: TransferBagSummaryMeta<TransferBagUsageStatusKey> | null
  packedTicketCount: number
  packedCutOrderCount: number
  pocketStatusKey: PocketCarrierStatusKey
  pocketStatusMeta: TransferBagSummaryMeta<PocketCarrierStatusKey>
  currentUsage: TransferBagUsageItem | null
  currentStyleCode: string
  currentTotalPieceCount: number
  currentGarmentQtyTotal: number
  currentSourceProductionOrderCount: number
  currentSourceCutOrderCount: number
  currentSourceMarkerPlanCount: number
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
  cutOrderNos: string[]
  productionOrderNos: string[]
  sourceMarkerNos: string[]
  markerPlanNos: string[]
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

export interface TransferBagStageLedgerItem {
  stage: TransferBagUsageStage
  stageLabel: string
  sourceKind: 'INBOUND_USAGE' | 'HANDOVER_BAG'
  carrierCode: string
  cycleNo: string
  productionOrderNos: string[]
  cutOrderNos: string[]
  ticketCount: number
  statusLabel: string
  relationLabel: string
  relationOk: boolean
  handoverOrderNo: string
  handoverRecordNo: string
  dispatchBatchNo: string
  ruleLabel: string
}

export interface TransferBagStageSummary {
  inboundTempCount: number
  handoverPackingCount: number
  handoverRelationOkCount: number
  handoverRelationMissingCount: number
}

export type CutPieceSortingTaskStatus = '待分拣' | '分拣中' | '已装袋' | '已交出' | '已回写' | '差异'

export interface CutPieceSortingTask {
  sortingTaskId: string
  sortingTaskNo: string
  dispatchOrderNo: string
  dispatchBatchId: string
  dispatchBatchNo: string
  productionOrderNo: string
  targetFactoryName: string
  skuSummary: string
  plannedGarmentQty: number
  sourceTempBagNos: string[]
  sourceTempUsageNos: string[]
  sourceTempTicketCount: number
  targetTransferBagNos: string[]
  expectedTicketCount: number
  pickedTicketCount: number
  status: CutPieceSortingTaskStatus
}

export interface CutPieceSortingTaskSummary {
  taskCount: number
  pendingCount: number
  sortingCount: number
  packedCount: number
  handedOverCount: number
  sourceTempBagCount: number
  targetTransferBagCount: number
}

export interface InboundTempBagContainedFeiTicket {
  feiTicketId: string
  feiTicketNo: string
  productionOrderId: string
  productionOrderNo: string
  cutOrderId: string
  cutOrderNo: string
  spreadingOrderNo: string
  spuCode: string
  color: string
  size: string
  partName: string
  pieceQty: number
  pieceSequenceLabel: string
  hasSpecialCraft: boolean
  specialCraftDisplay: string
  receiverFactoryDisplay: string
  printStatus: string
  voidStatus: string
}

export interface InboundTempBagDiscrepancyRecord {
  discrepancyId: string
  discrepancyType: string
  feiTicketId: string
  bagCode: string
  expectedQty: number
  actualQty: number
  unit: string
  evidencePhotos: string[]
  remark: string
  reportedAt: string
  reportedBy: string
  handlingStatus: string
}

export interface InboundTempBag {
  tempBagUseId: string
  bagCode: string
  bagMasterId: string
  useStage: '入仓暂存'
  warehouseId: string
  warehouseName: string
  warehouseArea: string
  locationCode: string
  inboundStatus: string
  inboundAt: string
  inboundBy: string
  inboundSource: string
  containedFeiTickets: InboundTempBagContainedFeiTicket[]
  totalPieceQty: number
  mixedFlag: boolean
  mixedSummary: string
  discrepancyRecords: InboundTempBagDiscrepancyRecord[]
  nextSortingStatus: string
  remark: string
}

export interface InboundTempBagInventoryRecord {
  inventoryRecordId: string
  feiTicketId: string
  feiTicketNo: string
  cutOrderId: string
  cutOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  spuCode: string
  color: string
  size: string
  partName: string
  pieceQty: number
  pieceSequenceLabel: string
  hasSpecialCraft: boolean
  specialCraftDisplay: string
  receiverFactoryDisplay: string
  printStatus: string
  voidStatus: string
  tempBagCode: string
  warehouseArea: string
  locationCode: string
  inboundAt: string
  inventoryStatus: '待分配' | '已分配待分拣' | '已分拣待装袋' | '已装袋待交出' | '已交出' | '已作废或不可用'
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
  stageSummary: TransferBagStageSummary
  stageLedgerItems: TransferBagStageLedgerItem[]
  sortingTaskSummary: CutPieceSortingTaskSummary
  sortingTasks: CutPieceSortingTask[]
}

export type TransferBagCarrierCurrentStatus = '可用' | '入仓装袋中' | '入仓暂存中' | '交出装袋中' | '待交出' | '已交出待回收' | '报废'
export type TransferBagCarrierUseStage = '无' | '入仓暂存' | '交出装袋' | '已交出待回收'

export interface TransferBagMasterArchiveRecord {
  bagMasterId: string
  bagCode: string
  bagName: string
  bagSpec: string
  bagMaterial: string
  ownershipFactoryId: string
  ownershipFactoryName: string
  currentStatus: TransferBagCarrierCurrentStatus
  currentLocation: string
  currentUseStage: TransferBagCarrierUseStage
  currentUseId: string
  currentBoundObjectType: string
  currentBoundObjectId: string
  currentBoundObjectNo: string
  currentFeiTicketCount: number
  currentPieceQty: number
  lastUsedAt: string
  lastSignedAt: string
  lastReturnedAt: string
  totalUseCount: number
  scrapCount: number
  enabled: boolean
  createdAt: string
  createdBy: string
}

export interface TransferBagUseCycleView {
  bagUseId: string
  bagUseNo: string
  bagMasterId: string
  bagCode: string
  useStage: '入仓暂存' | '交出装袋'
  sourceWarehouseId: string
  sourceWarehouseName: string
  warehouseArea: string
  locationCode: string
  inboundAt: string
  inboundBy: string
  targetObjectType: string
  targetObjectId: string
  targetObjectNo: string
  receiverFactoryId: string
  receiverFactoryName: string
  receiverType: string
  receiverId: string
  receiverName: string
  containedProductionOrderCount: number
  containedCutOrderCount: number
  containedMaterialQty: number
  containedFeiTickets: Array<{
    feiTicketId: string
    feiTicketNo: string
    pieceQty: number
    productionOrderNo: string
    cutOrderNo: string
    partName: string
    size: string
  }>
  containedPieceQty: number
  startedAt: string
  handedOverAt: string
  signedBy: string
  signedPieceQty: number
  signedAt: string
  returnWarehouseName: string
  returnedBy: string
  returnedAt: string
  closedAt: string
  currentStatus: string
  discrepancyRecords: TransferBagScrapRecord[]
  mixedFlag: boolean
  mixedSummary: string
}

export interface TransferBagScrapRecord {
  scrapRecordId: string
  bagCode: string
  scrapType: string
  relatedUseId: string
  relatedObjectType: string
  relatedObjectId: string
  description: string
  evidencePhotos: string[]
  reportedAt: string
  reportedBy: string
  handlingStatus: string
  handledAt: string
  handledBy: string
}

export interface TransferBagCarrierManagementProjection {
  overviewCards: Array<{ label: string; value: number; hint: string }>
  masterRecords: TransferBagMasterArchiveRecord[]
  inboundTempUses: TransferBagUseCycleView[]
  handoverPackingUses: TransferBagUseCycleView[]
  signedAndReturnUses: TransferBagUseCycleView[]
  scrapRecords: TransferBagScrapRecord[]
  taskBagGroups: Array<{ sewingTaskNo: string; receiverFactoryName: string; bagCodes: string[]; useCount: number }>
}

export interface TransferBagValidationResult {
  ok: boolean
  reason: string
}

const masterStatusMetaMap: Record<TransferBagMasterStatusKey, { label: string; className: string; detailText: string }> = {
  IDLE: {
    label: '可用',
    className: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    detailText: '当前中转袋没有打开中的使用周期，可开始入仓装袋或交出装袋。',
  },
  IN_USE: {
    label: '装袋中',
    className: 'bg-blue-100 text-blue-700 border border-blue-200',
    detailText: '当前中转袋正在装袋，具体阶段以使用记录为准。',
  },
  DISPATCHED: {
    label: '已交出待回收',
    className: 'bg-orange-100 text-orange-700 border border-orange-200',
    detailText: '当前中转袋已完成交出，等待载具回收。',
  },
  WAITING_SIGNOFF: {
    label: '已交出待回收',
    className: 'bg-orange-100 text-orange-700 border border-orange-200',
    detailText: '旧版状态已收口为已交出待回收。',
  },
  WAITING_RETURN: {
    label: '已交出待回收',
    className: 'bg-orange-100 text-orange-700 border border-orange-200',
    detailText: '当前中转袋已完成交出，等待载具回收。',
  },
  RETURN_INSPECTING: {
    label: '已交出待回收',
    className: 'bg-orange-100 text-orange-700 border border-orange-200',
    detailText: '旧版回收中状态已收口为已交出待回收。',
  },
  REUSABLE: {
    label: '可用',
    className: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    detailText: '当前中转袋已完成本轮使用周期，可再次使用。',
  },
  WAITING_CLEANING: {
    label: '可用',
    className: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    detailText: '旧版待处理状态已收口为报废记录，主状态仍按可用处理。',
  },
  WAITING_REPAIR: {
    label: '可用',
    className: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    detailText: '旧版待处理状态已收口为报废记录，主状态仍按可用处理。',
  },
  DISABLED: {
    label: '报废',
    className: 'bg-slate-200 text-slate-700 border border-slate-300',
    detailText: '当前中转袋已报废，仅保留历史追溯。',
  },
}

const pocketCarrierStatusMetaMap: Record<PocketCarrierStatusKey, { label: string; className: string; detailText: string }> = {
  IDLE: {
    label: '可用',
    className: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    detailText: '当前中转袋没有进行中的使用周期，可直接开始装袋。',
  },
  PACKING: {
    label: '装袋中',
    className: 'bg-blue-100 text-blue-700 border border-blue-200',
    detailText: '当前口袋已进入使用周期，仍可继续扫描菲票并调整袋内明细。',
  },
  READY_TO_DISPATCH: {
    label: '待交出',
    className: 'bg-violet-100 text-violet-700 border border-violet-200',
    detailText: '当前中转袋已完成装袋，等待交出。',
  },
  DISPATCHED: {
    label: '已交出待回收',
    className: 'bg-orange-100 text-orange-700 border border-orange-200',
    detailText: '当前中转袋已交出，等待回收确认。',
  },
  SIGNED: {
    label: '已交出待回收',
    className: 'bg-orange-100 text-orange-700 border border-orange-200',
    detailText: '旧版状态已收口为已交出待回收。',
  },
  RETURNED: {
    label: '已回收',
    className: 'bg-cyan-100 text-cyan-700 border border-cyan-200',
    detailText: '当前中转袋已完成回收确认。',
  },
  DISABLED: {
    label: '报废',
    className: 'bg-rose-100 text-rose-700 border border-rose-200',
    detailText: '当前中转袋已报废，不可继续进入装袋流程。',
  },
}

const usageStatusMetaMap: Record<TransferBagUsageStatusKey, { label: string; className: string; detailText: string }> = {
  DRAFT: {
    label: '装袋中',
    className: 'bg-slate-100 text-slate-700 border border-slate-200',
    detailText: '当前使用周期正在准备装袋。',
  },
  PACKING: {
    label: '装袋中',
    className: 'bg-blue-100 text-blue-700 border border-blue-200',
    detailText: '当前使用周期正在持续建立父子码映射。',
  },
  READY_TO_DISPATCH: {
    label: '待交出',
    className: 'bg-violet-100 text-violet-700 border border-violet-200',
    detailText: '当前使用周期已完成装袋，可执行交出。',
  },
  DISPATCHED: {
    label: '已交出待回收',
    className: 'bg-orange-100 text-orange-700 border border-orange-200',
    detailText: '当前使用周期已交出，等待中转袋回收。',
  },
  PENDING_SIGNOFF: {
    label: '已交出待回收',
    className: 'bg-orange-100 text-orange-700 border border-orange-200',
    detailText: '旧版状态已收口为已交出待回收。',
  },
  WAITING_RETURN: {
    label: '已交出待回收',
    className: 'bg-orange-100 text-orange-700 border border-orange-200',
    detailText: '当前使用周期已交出，等待中转袋回收。',
  },
  RETURN_INSPECTING: {
    label: '已交出待回收',
    className: 'bg-orange-100 text-orange-700 border border-orange-200',
    detailText: '旧版状态已收口为已交出待回收。',
  },
  CLOSED: {
    label: '已关闭',
    className: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    detailText: '当前使用周期已完成回货验收并正式关闭。',
  },
  SCRAP_CLOSED: {
    label: '已关闭',
    className: 'bg-rose-100 text-rose-700 border border-rose-200',
    detailText: '当前使用周期已按报废关闭。',
  },
}

const visibleStatusMetaMap: Record<TransferBagVisibleStatusKey, { label: string; className: string; detailText: string }> = {
  IDLE: {
    label: '可用',
    className: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    detailText: '当前没有打开中的使用周期，可继续开始装袋。',
  },
  IN_PROGRESS: {
    label: '装袋中',
    className: 'bg-blue-100 text-blue-700 border border-blue-200',
    detailText: '当前正在扫码装袋，尚未完成核对。',
  },
  READY_HANDOVER: {
    label: '待交出',
    className: 'bg-violet-100 text-violet-700 border border-violet-200',
    detailText: '当前已完成装袋，等待裁片仓交出。',
  },
  HANDED_OVER: {
    label: '已交出待回收',
    className: 'bg-orange-100 text-orange-700 border border-orange-200',
    detailText: '当前已从裁片仓交出，等待中转袋回收。',
  },
  ARCHIVED: {
    label: '报废',
    className: 'bg-slate-200 text-slate-700 border border-slate-300',
    detailText: '当前中转袋已报废，仅保留追溯记录。',
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

export function getTransferBagTicketPrintStatusLabel(
  ticket: Pick<TransferBagTicketCandidate, 'ticketStatus' | 'printStatus'> | null | undefined,
): string {
  if (!ticket) return '未知'
  if (ticket.ticketStatus === 'VOIDED' || ticket.printStatus === 'VOIDED') return '已作废'
  if (ticket.ticketStatus === 'PRINTED') return ticket.printStatus === 'REPRINTED' ? '已补打' : '已打印'
  if (ticket.printStatus === 'WAIT_PRINT') return '未打印'
  if (ticket.printStatus === 'REPRINTED') return '已补打'
  return '已打印'
}

function buildBagAuditId(nowText: string, usageId: string, action: string): string {
  return buildCuttingTraceabilityId('bag-audit', nowText, usageId, action)
}

function toCarrierType(bagCode: string, explicit?: string): 'bag' | 'box' {
  if (explicit === 'box' || explicit === 'bag') return explicit
  return bagCode.startsWith('BOX') ? 'box' : 'bag'
}

function toPageMasterStatus(status: string | undefined): TransferBagMasterStatusKey {
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

function toPageUsageStatus(status: string | undefined): TransferBagUsageStatusKey {
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
    normalized === 'SCRAP_CLOSED'
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
    issuedAt: '2026-03-24 08:00',
    ownershipFactoryId: master.ownershipFactoryId,
    ownershipFactoryName: master.ownershipFactoryName,
  })

  return {
    carrierId,
    carrierCode,
    carrierType,
    bagType: master.bagType,
    bagName: master.bagName,
    bagSpec: master.bagSpec,
    bagMaterial: master.bagMaterial,
    ownershipFactoryId: master.ownershipFactoryId,
    ownershipFactoryName: master.ownershipFactoryName,
    capacity: master.capacity,
    reusable: master.reusable,
    currentStatus: master.currentStatus,
    currentLocation: master.currentLocation,
    latestCycleId: normalized.latestCycleId,
    latestCycleNo: normalized.latestCycleNo,
    currentCycleId: normalized.currentCycleId,
    currentOwnerTaskId: normalized.currentOwnerTaskId,
    note: master.note,
    qrPayload: readTransferQrMeta(master) || encoded.payload,
    qrMeta: readTransferQrMeta(master) || encoded.payload,
    qrValue: master.qrValue || encoded.qrValue,
    enabled: master.enabled,
    createdAt: master.createdAt,
    createdBy: master.createdBy,
  }
}

function toPageMaster(master: TransferCarrierRecord): TransferBagMaster {
  const pageMaster = {
    carrierId: master.carrierId,
    carrierCode: master.carrierCode,
    carrierType: master.carrierType,
    latestCycleId: master.latestCycleId || '',
    latestCycleNo: master.latestCycleNo || '',
    bagId: master.carrierId,
    bagCode: master.carrierCode,
    bagName: master.bagName || master.carrierCode,
    bagSpec: master.bagSpec || '',
    bagMaterial: master.bagMaterial || '',
    ownershipFactoryId: master.ownershipFactoryId || '',
    ownershipFactoryName: master.ownershipFactoryName || '',
    bagType: master.bagType,
    capacity: master.capacity,
    reusable: master.reusable,
    currentStatus: toPageMasterStatus(master.currentStatus),
    currentLocation: master.currentLocation,
    latestUsageId: master.latestCycleId || '',
    latestUsageNo: master.latestCycleNo || '',
    currentCycleId: master.currentCycleId || '',
    currentOwnerTaskId: master.currentOwnerTaskId || '',
    qrValue: master.qrValue,
    qrMeta: readRuntimeTransferQrMeta(master),
    enabled: master.enabled !== false,
    createdAt: master.createdAt || '',
    createdBy: master.createdBy || '',
    note: master.note,
  } as TransferBagMaster & Record<string, unknown>
  assignTransferQrMeta(pageMaster, readRuntimeTransferQrMeta(master))
  return pageMaster
}

function toRuntimeUsage(usage: TransferBagUsage): TransferCarrierCycleRecord {
  const normalized = normalizeTransferCarrierCycleRecord(usage as unknown as Record<string, unknown>)
  const isHandoverTarget = usage.boundObjectType === '车缝任务' || usage.usageStage === 'HANDOVER_PACKING'
  return {
    cycleId: normalized.cycleId,
    cycleNo: normalized.cycleNo,
    carrierId: normalized.carrierId,
    carrierCode: normalized.carrierCode,
    carrierType: normalized.carrierType,
    sewingTaskId: isHandoverTarget ? usage.boundObjectId || usage.sewingTaskId : usage.sewingTaskId,
    sewingTaskNo: isHandoverTarget ? usage.boundObjectNo || usage.sewingTaskNo : usage.sewingTaskNo,
    sewingFactoryId: usage.receiverType === '工厂' ? usage.receiverId || usage.sewingFactoryId : usage.sewingFactoryId,
    sewingFactoryName: usage.receiverType === '工厂' ? usage.receiverName || usage.sewingFactoryName : usage.sewingFactoryName,
    boundObjectType: usage.boundObjectType,
    boundObjectId: usage.boundObjectId,
    boundObjectNo: usage.boundObjectNo,
    receiverType: usage.receiverType,
    receiverId: usage.receiverId,
    receiverName: usage.receiverName,
    sourceWarehouseId: usage.sourceWarehouseId,
    sourceWarehouseName: usage.sourceWarehouseName,
    warehouseArea: usage.warehouseArea,
    locationCode: usage.locationCode,
    signedPieceQty: usage.signedPieceQty,
    styleCode: usage.styleCode,
    spuCode: usage.spuCode,
    skuSummary: usage.skuSummary,
    colorSummary: usage.colorSummary,
    sizeSummary: usage.sizeSummary,
    cycleStatus: usage.usageStatus || (normalized.cycleStatus as TransferBagUsageStatusKey),
    status: String(usage.status || ''),
    packedTicketCount: usage.packedTicketCount,
    packedCutOrderCount: usage.packedCutOrderCount,
    startedAt: usage.startedAt || '',
    finishedPackingAt: usage.finishedPackingAt || '',
    dispatchAt: usage.dispatchAt,
    dispatchBy: usage.dispatchBy,
    signoffStatus: usage.signoffStatus,
    signedBy: usage.signedBy || '',
    signedAt: usage.signedAt || '',
    returnWarehouseName: usage.returnWarehouseName || '',
    returnedBy: usage.returnedBy || '',
    returnedAt: usage.returnedAt || '',
    usageStage: normalizeTransferBagUsageStage(usage.usageStage),
    usageStageLabel: usage.usageStageLabel || getTransferBagUsageStageLabel(usage.usageStage),
    note: usage.note,
  }
}

function toPageUsage(usage: TransferCarrierCycleRecord): TransferBagUsage {
  const usageStage = normalizeTransferBagUsageStage(usage.usageStage)
  const isInboundTemp = usageStage === 'INBOUND_TEMP'
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
    boundObjectType: usage.boundObjectType || (isInboundTemp ? '入仓暂存记录' : '车缝任务'),
    boundObjectId: usage.boundObjectId || (isInboundTemp ? usage.cycleId : usage.sewingTaskId),
    boundObjectNo: usage.boundObjectNo || (isInboundTemp ? usage.cycleNo : usage.sewingTaskNo),
    receiverType: usage.receiverType || (isInboundTemp ? '仓库' : '工厂'),
    receiverId: usage.receiverId || (isInboundTemp ? 'cutting-wait-handover' : usage.sewingFactoryId),
    receiverName: usage.receiverName || (isInboundTemp ? '裁床待交出仓' : usage.sewingFactoryName),
    sourceWarehouseId: usage.sourceWarehouseId || 'cutting-wait-handover',
    sourceWarehouseName: usage.sourceWarehouseName || '裁床待交出仓',
    warehouseArea: usage.warehouseArea || '',
    locationCode: usage.locationCode || '',
    sewingTaskId: usage.sewingTaskId,
    sewingTaskNo: usage.sewingTaskNo,
    sewingFactoryId: usage.sewingFactoryId,
    sewingFactoryName: usage.sewingFactoryName,
    styleCode: usage.styleCode,
    spuCode: usage.spuCode,
    skuSummary: usage.skuSummary,
    colorSummary: usage.colorSummary,
    sizeSummary: usage.sizeSummary,
    cycleStatus: toPageUsageStatus(usage.cycleStatus),
    usageStatus: toPageUsageStatus(usage.cycleStatus),
    packedTicketCount: usage.packedTicketCount || 0,
    packedCutOrderCount: usage.packedCutOrderCount || 0,
    startedAt: usage.startedAt || '',
    finishedPackingAt: usage.finishedPackingAt || '',
    dispatchAt: usage.dispatchAt || '',
    dispatchBy: usage.dispatchBy || '',
    signoffStatus: usage.signoffStatus || 'PENDING',
    signedBy: usage.signedBy || '',
    signedPieceQty: usage.signedPieceQty,
    signedAt: usage.signedAt || '',
    returnWarehouseName: usage.returnWarehouseName || '',
    returnedBy: usage.returnedBy || '',
    returnedAt: usage.returnedAt || '',
    status: usage.status,
    usageStage,
    usageStageLabel: usage.usageStageLabel || getTransferBagUsageStageLabel(usageStage),
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
    cutOrderId: binding.cutOrderId,
    cutOrderNo: binding.cutOrderNo,
    productionOrderNo: binding.productionOrderNo,
    markerPlanNo: binding.markerPlanNo,
    fabricRollNo: binding.fabricRollNo || '',
    fabricColor: binding.fabricColor || '',
    size: binding.size || '',
    partCode: binding.ticket?.partCode || '',
    partName: binding.partName || '',
    bundleNo: binding.bundleNo || '',
    qty: binding.qty,
    actualCutPieceQty: binding.actualCutPieceQty ?? binding.qty,
    garmentQty: binding.garmentQty ?? binding.qty,
    boundAt: binding.boundAt,
    boundBy: binding.boundBy,
    operator: normalized.operator,
    status: normalized.status as 'BOUND' | 'REMOVED',
    note: binding.note,
  }
}

function toPageBinding(binding: CarrierCycleItemBinding): TransferBagItemBinding {
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
    cutOrderId: binding.cutOrderId,
    cutOrderNo: binding.cutOrderNo,
    productionOrderNo: binding.productionOrderNo,
    markerPlanNo: binding.markerPlanNo,
    唛架方案No: binding.markerPlanNo,
    fabricRollNo: binding.fabricRollNo || '',
    fabricColor: binding.fabricColor || '',
    size: binding.size || '',
    partName: binding.partName || '',
    bundleNo: binding.bundleNo || '',
    qty: binding.qty,
    garmentQty: binding.garmentQty ?? binding.qty,
    actualCutPieceQty: binding.actualCutPieceQty ?? binding.qty,
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
    cutOrderCount: manifest.cutOrderCount,
    createdAt: manifest.createdAt,
    createdBy: manifest.createdBy,
    printStatus: manifest.printStatus,
    note: manifest.note,
  }
}

function toPageManifest(manifest: TransferBagDispatchManifestRecord): TransferBagDispatchManifest {
  return {
    manifestId: manifest.manifestId,
    cycleId: manifest.cycleId,
    carrierCode: manifest.carrierCode,
    usageId: manifest.cycleId,
    bagCode: manifest.carrierCode,
    sewingTaskNo: manifest.sewingTaskNo,
    sewingFactoryName: manifest.sewingFactoryName,
    ticketCount: manifest.ticketCount,
    cutOrderCount: manifest.cutOrderCount,
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
    scrapRecords: (store.scrapRecords || []).map((item) => ({ ...item })),
  }
}

function toPageStore(store: TransferBagRuntimeStore): TransferBagStore {
  return {
    masters: store.masters.map((item) => toPageMaster(item)),
    usages: store.usages.map((item) => toPageUsage(item)),
    bindings: store.bindings.map((item) => toPageBinding(item)),
    manifests: store.manifests.map((item) => toPageManifest(item)),
    sewingTasks: store.sewingTasks.map((item) => ({ ...item })),
    auditTrail: store.auditTrail as TransferBagUsageAuditTrail[],
    returnReceipts: store.returnReceipts as TransferBagReturnReceipt[],
    conditionRecords: store.conditionRecords as TransferBagConditionRecord[],
    reuseCycles: store.reuseCycles as TransferBagReuseCycleSummary[],
    closureResults: store.closureResults as TransferBagUsageClosureResult[],
    returnAuditTrail: store.returnAuditTrail as TransferBagReturnAuditTrail[],
    scrapRecords: (store.scrapRecords || []) as TransferBagScrapRecord[],
  }
}

function toRuntimeSeedCutOrderRows(rows: CutOrderRow[]): TransferBagSeedCutOrderRowLike[] {
  return rows.map((row) => ({
    cutOrderId: row.cutOrderId,
    cutOrderNo: row.cutOrderNo,
    productionOrderNo: row.productionOrderNo,
    styleCode: row.styleCode,
    spuCode: row.spuCode,
    color: row.color,
    materialSku: row.materialSku,
    plannedQty: row.plannedQty,
    orderQty: row.orderQty,
  }))
}

function toRuntimeSeedMarkerPlanSources(batches: MarkerPlanSourceRecord[]): TransferBagSeedMarkerPlanSourceLike[] {
  return batches.map((batch) => ({
    markerPlanId: batch.markerPlanId,
    markerPlanNo: batch.markerPlanNo,
    styleCode: batch.styleCode,
    spuCode: batch.spuCode,
    materialSkuSummary: batch.materialSkuSummary,
    items: batch.items.map((item) => ({
      cutOrderId: item.cutOrderId,
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
    cutOrderId: record.cutOrderId,
    cutOrderNo: record.cutOrderNo,
    productionOrderNo: record.productionOrderNo,
    markerPlanNo: record.sourceMarkerPlanNo,
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

  if (options.ticket.markerPlanNo) {
    const matches = options.sewingTasks.filter((task) => task.sewingTaskId === `sewing-task-${sanitizeId(options.ticket!.markerPlanNo)}`)
    const result = buildTaskResolutionResult(
      'marker-plan',
      matches,
      '',
      `${options.ticket.markerPlanNo} 对应了多个车缝任务，暂不能自动装袋。`,
    )
    if (result.ok || matches.length > 1) return result
  }

  if (options.ticket.cutOrderId) {
    const matches = options.sewingTasks.filter(
      (task) => task.sewingTaskId === `sewing-task-fallback-${sanitizeId(options.ticket!.cutOrderId)}`,
    )
    const result = buildTaskResolutionResult(
      'cut-order',
      matches,
      '',
      `${options.ticket.cutOrderNo} 对应了多个车缝任务，暂不能自动装袋。`,
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
          reason: `当前袋已锁定到 ${lockedTask.sewingFactoryName} / ${lockedTask.styleCode || lockedTask.spuCode}，请确认同属本次交出记录。`,
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
        reason: `当前袋已锁定到 ${lockedTask.sewingFactoryName} / ${lockedTask.styleCode || lockedTask.spuCode}，请确认同属本次交出记录。`,
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
  if (options.masterStatus === 'DISABLED') {
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
  if (options.usage.usageStatus === 'SCRAP_CLOSED') return 'ARCHIVED'
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
  return status !== 'CLOSED' && status !== 'SCRAP_CLOSED'
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
  if (options.usage.usageStatus === 'CLOSED' || options.usage.usageStatus === 'SCRAP_CLOSED') {
    return options.masterStatus === 'DISABLED' ? 'DISABLED' : 'IDLE'
  }
  return 'PACKING'
}

export function buildWarehouseQueryPayload(options: {
  cutOrderId?: string
  cutOrderNo?: string
  productionOrderId?: string
  productionOrderNo?: string
  markerPlanId?: string
  markerPlanNo?: string
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
      cutOrderId: options.cutOrderId,
      cutOrderNo: options.cutOrderNo,
      productionOrderId: options.productionOrderId,
      productionOrderNo: options.productionOrderNo,
      markerPlanId: options.markerPlanId,
      markerPlanNo: options.markerPlanNo,
      materialSku: options.materialSku,
      spreadingSessionId: options.spreadingSessionId,
      sourceWritebackId: options.sourceWritebackId,
    },
    feiTickets: {
      cutOrderId: options.cutOrderId,
      cutOrderNo: options.cutOrderNo,
      productionOrderId: options.productionOrderId,
      ticketId: options.ticketId,
      ticketNo: options.ticketNo,
      materialSku: options.materialSku,
      markerPlanId: options.markerPlanId,
      markerPlanNo: options.markerPlanNo,
    },
    cutOrders: {
      cutOrderId: options.cutOrderId,
      cutOrderNo: options.cutOrderNo,
      productionOrderId: options.productionOrderId,
      productionOrderNo: options.productionOrderNo,
      markerPlanId: options.markerPlanId,
      markerPlanNo: options.markerPlanNo,
      materialSku: options.materialSku,
    },
    summary: {
      cutOrderId: options.cutOrderId,
      cutOrderNo: options.cutOrderNo,
      productionOrderId: options.productionOrderId,
      productionOrderNo: options.productionOrderNo,
      markerPlanId: options.markerPlanId,
      bagCode: options.bagCode,
      bagId: options.bagId,
      sewingTaskNo: options.sewingTaskNo,
      markerPlanNo: options.markerPlanNo,
      materialSku: options.materialSku,
      ticketId: options.ticketId,
      ticketNo: options.ticketNo,
      usageId: options.usageId,
      usageNo: options.usageNo,
    },
  }
}

export function buildTransferBagNavigationPayload(options: {
  cutOrderId?: string
  cutOrderNo?: string
  productionOrderId?: string
  productionOrderNo?: string
  markerPlanId?: string
  markerPlanNo?: string
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
    cutOrderCount: uniqueStrings(bindings.map((item) => item.cutOrderNo)).length,
    productionOrderCount: uniqueStrings(bindings.map((item) => item.productionOrderNo)).length,
    markerPlanSourceCount: uniqueStrings(bindings.map((item) => item.markerPlanNo)).length,
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
  return toPageUsage(runtimeUsage)
}

export function validateBagToSewingTaskBinding(usage: TransferBagUsage | null, sewingTaskId: string): TransferBagValidationResult {
  if (!usage) return { ok: false, reason: '当前没有可绑定的使用周期，请先创建使用周期草稿。' }
  if (isInboundTempTransferBagUsage(usage)) return { ok: true, reason: '' }
  if (!sewingTaskId) return { ok: false, reason: '当前使用周期尚未绑定车缝任务。' }
  if (usage.sewingTaskId && usage.sewingTaskId !== sewingTaskId) {
    return { ok: false, reason: '同一次使用周期只能归属一个车缝任务，请确认同属本次交出记录。' }
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
  const isInboundTempUsage = isInboundTempTransferBagUsage(options.usage)
  if (!options.sewingTask && !isInboundTempUsage) return { ok: false, reason: '当前使用周期尚未绑定车缝任务。' }
  if (options.ticket.ticketStatus === 'VOIDED') {
    return { ok: false, reason: `${options.ticket.ticketNo} 已作废，禁止继续装袋。` }
  }
  if (options.ticket.printStatus === 'WAIT_PRINT' && options.ticket.ticketStatus !== 'PRINTED') {
    return { ok: false, reason: `${options.ticket.ticketNo} 未打印，不能进入入仓暂存袋。` }
  }
  if (options.ticket.printStatus === 'VOIDED') {
    return { ok: false, reason: `${options.ticket.ticketNo} 已作废，禁止继续装袋。` }
  }
  if (!options.ticket.cutOrderId || !options.ticket.cutOrderNo) {
    return { ok: false, reason: '当前菲票缺少裁片单 owner，不能进入中转袋。' }
  }
  const numberingValidation = validateFeiTicketNumberingBeforeBagging({
    feiTicketId: options.ticket.feiTicketId || options.ticket.ticketRecordId,
    feiTicketNo: options.ticket.ticketNo,
    partName: options.ticket.partName,
    pieceSequenceLabel: options.ticket.pieceSequenceLabel,
  })
  if (!numberingValidation.ok) {
    return { ok: false, reason: numberingValidation.reason }
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

  if (!isInboundTempUsage && options.sewingTask?.styleCode && options.ticket.styleCode && options.sewingTask.styleCode !== options.ticket.styleCode) {
    return { ok: false, reason: `${options.ticket.ticketNo} 的款号与当前车缝任务不一致，不能装入同一使用周期。` }
  }

  if (!isInboundTempUsage && options.sewingTask?.spuCode && options.ticket.spuCode && options.sewingTask.spuCode !== options.ticket.spuCode) {
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
    ...toPageManifest(runtimeManifest),
    ticketCount: options.summary.ticketCount,
    cutOrderCount: options.summary.cutOrderCount,
  }
}

function buildSewingTaskSeeds(
  cutOrderRows: CutOrderRow[] = [],
  markerPlanSources: MarkerPlanSourceRecord[] = [],
): SewingTaskRef[] {
  const markerPlanTaskSeeds = markerPlanSources.slice(0, 3).map((batch, index) => {
    const factory = pickTransferBagSewingFactory(index)
    return {
    sewingTaskId: `sewing-task-${sanitizeId(batch.markerPlanNo)}`,
    sewingTaskNo: `CF-${String(index + 1).padStart(3, '0')}`,
    sewingFactoryId: factory.factoryId,
    sewingFactoryName: factory.factoryName,
    styleCode: batch.styleCode,
    spuCode: batch.spuCode,
    skuSummary: batch.materialSkuSummary,
    colorSummary: uniqueStrings(batch.items.map((item) => cutOrderRows.find((row) => row.cutOrderId === item.cutOrderId)?.color)).join(' / ') || '混色',
    sizeSummary: 'S / M / L',
    plannedQty: batch.items.length * 24,
    status: index === 0 ? '待接料' : index === 1 ? '排单中' : '待交接',
    note: `来源于 ${batch.markerPlanNo} 的后道交接任务预留。`,
  }})

  const fallbackRows = cutOrderRows.map((row, index) => {
    const factory = pickTransferBagSewingFactory(index + markerPlanTaskSeeds.length)
    return {
    sewingTaskId: `sewing-task-fallback-${sanitizeId(row.cutOrderId)}`,
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

  return [...markerPlanTaskSeeds, ...fallbackRows]
}

function buildTicketCandidates(ticketRecords: FeiTicketLabelRecord[]): TransferBagTicketCandidate[] {
  return ticketRecords
    .map((record) => ({
      ticketRecordId: record.ticketRecordId,
      feiTicketId: record.ticketRecordId,
      ticketNo: record.ticketNo,
      printStatus: record.printStatus,
      sourceSpreadingSessionId: record.sourceSpreadingSessionId || '',
      sourceSpreadingSessionNo: record.sourceSpreadingSessionNo || '',
      sourceMarkerId: record.sourceMarkerId || '',
      sourceMarkerNo: record.sourceMarkerNo || '',
      cutOrderId: record.cutOrderId,
      cutOrderNo: record.cutOrderNo,
      productionOrderId: record.sourceProductionOrderId || '',
      productionOrderNo: record.productionOrderNo,
      markerPlanId: record.sourceMarkerPlanId || '',
      markerPlanNo: record.sourceMarkerPlanNo,
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
      garmentQty: Math.max(record.quantity ?? 1, 1),
      materialSku: record.materialSku,
      materialAlias: record.materialAlias || '',
      materialImageUrl: record.materialImageUrl || '',
      pieceSequenceLabel: record.pieceSequenceLabel || record.pieceSetNoRange || '',
      hasSpecialCraft: Boolean(record.hasSpecialCraft),
      specialCraftDisplayLabel: record.specialCraftDisplayLabel || (record.hasSpecialCraft ? '特殊工艺待维护' : '无'),
      receiverFactoryDisplay: record.specialCrafts?.length
        ? uniqueStrings(record.specialCrafts.map((craft) => craft.receiverFactoryName || '承接工厂待补充')).join('、')
        : '无',
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
  cutOrderRows: CutOrderRow[]
  ticketRecords: FeiTicketLabelRecord[]
  markerPlanSources?: MarkerPlanSourceRecord[]
}): TransferBagStore {
  const markerPlanSources = options.markerPlanSources ?? []
  return toPageStore(
    buildSystemSeedTransferBagRuntime({
      cutOrderRows: toRuntimeSeedCutOrderRows(options.cutOrderRows),
      ticketRecords: toRuntimeSeedTickets(options.ticketRecords),
      markerPlanSources: toRuntimeSeedMarkerPlanSources(markerPlanSources),
    }),
  )
}

export function serializeTransferBagStorage(store: TransferBagStore): string {
  return serializeTransferBagRuntimeStorage(toRuntimeStore(store))
}

export function deserializeTransferBagStorage(raw: string | null): TransferBagStore {
  return toPageStore(deserializeTransferBagRuntimeStorage(raw))
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
  return toPageStore(
    mergeTransferBagRuntimeStores(toRuntimeStore(seed), toRuntimeStore(stored)),
  )
}

function buildTransferBagStageLedgerItems(usageItems: TransferBagUsageItem[]): TransferBagStageLedgerItem[] {
  const dispatchOrders = listCuttingSewingDispatchOrders()
  const dispatchBatches = listCuttingSewingDispatchBatches()
  const handoverBags = listCuttingSewingTransferBags()
  const ordersById = Object.fromEntries(dispatchOrders.map((item) => [item.dispatchOrderId, item]))
  const batchesById = Object.fromEntries(dispatchBatches.map((item) => [item.dispatchBatchId, item]))
  const inboundRows: TransferBagStageLedgerItem[] = usageItems
    .filter((usage) => usage.usageStage === 'INBOUND_TEMP')
    .map((usage) => ({
      stage: 'INBOUND_TEMP',
      stageLabel: '入仓暂存',
      sourceKind: 'INBOUND_USAGE',
      carrierCode: usage.bagCode,
      cycleNo: usage.usageNo,
      productionOrderNos: usage.productionOrderNos,
      cutOrderNos: usage.cutOrderNos,
      ticketCount: usage.summary.ticketCount,
      statusLabel: usage.visibleStatusMeta.label,
      relationLabel: '未绑定交出单，待车缝任务分配后分拣装袋',
      relationOk: true,
      handoverOrderNo: '',
      handoverRecordNo: '',
      dispatchBatchNo: '',
      ruleLabel: getTransferBagRuleLabel('INBOUND_TEMP'),
    }))

  const handoverRows: TransferBagStageLedgerItem[] = handoverBags.map((bag) => {
    const order = ordersById[bag.dispatchOrderId] || null
    const batch = batchesById[bag.dispatchBatchId] || null
    const handoverOrderNo = order?.handoverOrderNo || order?.dispatchOrderNo || ''
    const handoverRecordNo = batch?.handoverRecordNo || ''
    const relationOk = Boolean(handoverOrderNo || handoverRecordNo)
    const relationLabel = handoverRecordNo
      ? `交出单 ${handoverOrderNo || '待补'} / 交出记录 ${handoverRecordNo}`
      : `交出单 ${handoverOrderNo || '待补'} / 交出记录待新增`
    return {
      stage: 'HANDOVER_PACKING',
      stageLabel: '交出装袋',
      sourceKind: 'HANDOVER_BAG',
      carrierCode: bag.transferBagNo,
      cycleNo: bag.transferOrderNo,
      productionOrderNos: [bag.productionOrderNo],
      cutOrderNos: bag.cuttingOrderNos,
      ticketCount: bag.scannedFeiTicketNos.length || bag.contentFeiTicketCount || bag.expectedFeiTicketCount || 0,
      statusLabel: bag.status,
      relationLabel,
      relationOk,
      handoverOrderNo,
      handoverRecordNo,
      dispatchBatchNo: batch?.dispatchBatchNo || bag.dispatchBatchId,
      ruleLabel: getTransferBagRuleLabel('HANDOVER_PACKING'),
    }
  })

  return [...inboundRows, ...handoverRows]
}

function deriveCutPieceSortingTaskStatus(
  batchStatus: string,
  targetBags: ReturnType<typeof listCuttingSewingTransferBags>,
  pickedTicketCount: number,
): CutPieceSortingTaskStatus {
  if (batchStatus === '差异' || batchStatus === '异议中' || targetBags.some((bag) => bag.status === '差异' || bag.status === '异议中')) return '差异'
  if (batchStatus === '已回写' || targetBags.some((bag) => bag.status === '已回写')) return '已回写'
  if (batchStatus === '已交出' || targetBags.some((bag) => bag.status === '已交出' || bag.handoverSubmittedAt)) return '已交出'
  if (batchStatus === '已核对' || targetBags.some((bag) => bag.status === '已核对')) return '已装袋'
  if (pickedTicketCount > 0 || targetBags.some((bag) => bag.status === '装袋中')) return '分拣中'
  return '待分拣'
}

function buildCutPieceSortingTasks(usageItems: TransferBagUsageItem[]): CutPieceSortingTask[] {
  const dispatchOrders = listCuttingSewingDispatchOrders()
  const dispatchBatches = listCuttingSewingDispatchBatches()
  const handoverBags = listCuttingSewingTransferBags()
  const ordersById = Object.fromEntries(dispatchOrders.map((item) => [item.dispatchOrderId, item]))
  const inboundTempUsages = usageItems.filter((usage) => usage.usageStage === 'INBOUND_TEMP')

  return dispatchBatches
    .map((batch) => {
      const order = ordersById[batch.dispatchOrderId] || null
      const sourceTempUsages = inboundTempUsages.filter((usage) => usage.productionOrderNos.includes(batch.productionOrderNo))
      const targetBags = handoverBags.filter((bag) => batch.transferBagIds.includes(bag.transferBagId))
      const pickedTicketCount = targetBags.reduce((total, bag) => total + (bag.scannedFeiTicketNos.length || bag.contentFeiTicketCount || 0), 0)
      const expectedTicketCount = targetBags.reduce(
        (total, bag) => total + (bag.expectedFeiTicketCount || bag.pieceLines.length || bag.skuQtyLines.length || 0),
        0,
      )
      return {
        sortingTaskId: `CPST-${batch.dispatchBatchId}`,
        sortingTaskNo: `CPT-${batch.dispatchBatchNo}`,
        dispatchOrderNo: order?.dispatchOrderNo || batch.transferOrderNo,
        dispatchBatchId: batch.dispatchBatchId,
        dispatchBatchNo: batch.dispatchBatchNo,
        productionOrderNo: batch.productionOrderNo,
        targetFactoryName: order?.sewingFactoryName || '接收对象待补',
        skuSummary: batch.plannedSkuQtyLines.map((line) => `${line.colorName}/${line.sizeCode}`).join('、'),
        plannedGarmentQty: batch.plannedGarmentQty,
        sourceTempBagNos: uniqueStrings(sourceTempUsages.map((usage) => usage.bagCode)),
        sourceTempUsageNos: uniqueStrings(sourceTempUsages.map((usage) => usage.usageNo)),
        sourceTempTicketCount: sourceTempUsages.reduce((total, usage) => total + usage.summary.ticketCount, 0),
        targetTransferBagNos: uniqueStrings(targetBags.map((bag) => bag.transferBagNo)),
        expectedTicketCount,
        pickedTicketCount,
        status: deriveCutPieceSortingTaskStatus(batch.status, targetBags, pickedTicketCount),
      } satisfies CutPieceSortingTask
    })
    .sort((left, right) => right.sortingTaskNo.localeCompare(left.sortingTaskNo, 'zh-CN'))
}

function buildInboundTempBagMixedSummary(tickets: InboundTempBagContainedFeiTicket[]): string {
  const productionOrderCount = uniqueStrings(tickets.map((ticket) => ticket.productionOrderNo)).length
  const cutOrderCount = uniqueStrings(tickets.map((ticket) => ticket.cutOrderNo)).length
  const partCount = uniqueStrings(tickets.map((ticket) => ticket.partName)).length
  const sizeCount = uniqueStrings(tickets.map((ticket) => ticket.size)).length
  return `涉及 ${productionOrderCount} 个生产单 / ${cutOrderCount} 张裁片单 / ${partCount} 个部位 / ${sizeCount} 个尺码`
}

function buildInboundTempBagDiscrepancies(usage: TransferBagUsageItem, tickets: InboundTempBagContainedFeiTicket[], inboundBy: string): InboundTempBagDiscrepancyRecord[] {
  if (usage.bagCode !== 'BAG-B-003') return []
  const anchorTicket = tickets[0]
  return [
    {
      discrepancyId: `DISC-${usage.usageId}-QTY`,
      discrepancyType: '实物数量和菲票数量不一致',
      feiTicketId: anchorTicket?.feiTicketId || '',
      bagCode: usage.bagCode,
      expectedQty: usage.summary.quantityTotal,
      actualQty: Math.max(usage.summary.quantityTotal - 2, 0),
      unit: '片',
      evidencePhotos: ['photo://inbound-temp-bag/BAG-B-003/qty-check'],
      remark: '现场复核发现一扎菲票边角破损，已拍照备注，等待仓管核对。',
      reportedAt: usage.startedAt || usage.finishedPackingAt || '',
      reportedBy: inboundBy,
      handlingStatus: '待处理',
    },
  ]
}

export function buildInboundTempBagsFromTransferBagViewModel(
  viewModel: Pick<TransferBagViewModel, 'usages' | 'auditTrailByUsageId'>,
): InboundTempBag[] {
  return viewModel.usages
    .filter((usage) => usage.usageStage === 'INBOUND_TEMP')
    .map((usage) => {
      const audits = viewModel.auditTrailByUsageId[usage.usageId] || []
      const firstAudit = audits[0]
      const inboundBy = firstAudit?.actionBy || '裁片仓入仓员'
      const inboundAt = usage.startedAt || firstAudit?.actionAt || usage.finishedPackingAt || ''
      const containedFeiTickets: InboundTempBagContainedFeiTicket[] = usage.bindingItems.map((binding) => {
        const ticket = binding.ticket
        return {
          feiTicketId: ticket?.feiTicketId || binding.feiTicketId,
          feiTicketNo: ticket?.ticketNo || binding.ticketNo,
          productionOrderId: ticket?.productionOrderId || '',
          productionOrderNo: ticket?.productionOrderNo || binding.productionOrderNo,
          cutOrderId: ticket?.cutOrderId || binding.cutOrderId,
          cutOrderNo: ticket?.cutOrderNo || binding.cutOrderNo,
          spreadingOrderNo: ticket?.sourceSpreadingSessionNo || binding.sourceSpreadingSessionNo || '',
          spuCode: ticket?.spuCode || '',
          color: ticket?.color || '',
          size: ticket?.size || '',
          partName: ticket?.partName || '',
          pieceQty: ticket?.actualCutPieceQty || binding.quantity || 0,
          pieceSequenceLabel: ticket?.pieceSequenceLabel || '按菲票追踪',
          hasSpecialCraft: Boolean(ticket?.hasSpecialCraft),
          specialCraftDisplay: ticket?.hasSpecialCraft ? ticket.specialCraftDisplayLabel || '特殊工艺待维护' : '无',
          receiverFactoryDisplay: ticket?.hasSpecialCraft ? ticket.receiverFactoryDisplay || '承接工厂待补充' : '无',
          printStatus: getTransferBagTicketPrintStatusLabel(ticket),
          voidStatus: ticket?.ticketStatus === 'VOIDED' || ticket?.printStatus === 'VOIDED' ? '已作废' : '有效',
        }
      })
      if (usage.bagCode === 'BAG-B-003' && !containedFeiTickets.some((ticket) => ticket.feiTicketNo === 'FT-CUT-260307-102-02-DEMO-FRONT')) {
        containedFeiTickets.push(
          {
            feiTicketId: 'demo-khaki-front-ready-inventory',
            feiTicketNo: 'FT-CUT-260307-102-02-DEMO-FRONT',
            productionOrderId: 'PO-202603-0102',
            productionOrderNo: 'PO-202603-0102',
            cutOrderId: 'cut-order:po-202603-0102:tdv-demand-spu-2024-010-bom-khaki-canvas:tdv-demand-spu-2024-010-pattern-main:v1-0:145cm',
            cutOrderNo: 'CUT-260307-102-02',
            spreadingOrderNo: 'PB-030101-02',
            spuCode: 'SPU-2024-010',
            color: 'Khaki',
            size: 'L',
            partName: '前片',
            pieceQty: 128,
            pieceSequenceLabel: '1-128',
            hasSpecialCraft: false,
            specialCraftDisplay: '无',
            receiverFactoryDisplay: '无',
            printStatus: '已打印',
            voidStatus: '有效',
          },
          {
            feiTicketId: 'demo-khaki-back-ready-inventory',
            feiTicketNo: 'FT-CUT-260307-102-02-DEMO-BACK',
            productionOrderId: 'PO-202603-0102',
            productionOrderNo: 'PO-202603-0102',
            cutOrderId: 'cut-order:po-202603-0102:tdv-demand-spu-2024-010-bom-khaki-canvas:tdv-demand-spu-2024-010-pattern-main:v1-0:145cm',
            cutOrderNo: 'CUT-260307-102-02',
            spreadingOrderNo: 'PB-030101-02',
            spuCode: 'SPU-2024-010',
            color: 'Khaki',
            size: 'L',
            partName: '后片',
            pieceQty: 128,
            pieceSequenceLabel: '1-128',
            hasSpecialCraft: false,
            specialCraftDisplay: '无',
            receiverFactoryDisplay: '无',
            printStatus: '已打印',
            voidStatus: '有效',
          },
        )
      }
      const productionOrderCount = uniqueStrings(containedFeiTickets.map((ticket) => ticket.productionOrderNo)).length
      const cutOrderCount = uniqueStrings(containedFeiTickets.map((ticket) => ticket.cutOrderNo)).length
      const partCount = uniqueStrings(containedFeiTickets.map((ticket) => ticket.partName)).length
      const sizeCount = uniqueStrings(containedFeiTickets.map((ticket) => ticket.size)).length
      const specialCraftLabels = uniqueStrings(containedFeiTickets.map((ticket) => ticket.hasSpecialCraft ? '有特殊工艺' : '无特殊工艺'))
      const mixedFlag = productionOrderCount > 1 || cutOrderCount > 1 || partCount > 1 || sizeCount > 1 || specialCraftLabels.length > 1
      const warehouseArea = usage.bagMaster?.currentLocation || '裁床待交出仓入仓暂存位'
      const discrepancyRecords = buildInboundTempBagDiscrepancies(usage, containedFeiTickets, inboundBy)

      return {
        tempBagUseId: usage.usageId,
        bagCode: usage.bagCode,
        bagMasterId: usage.bagId,
        useStage: '入仓暂存',
        warehouseId: 'cutting-wait-handover',
        warehouseName: '裁床待交出仓',
        warehouseArea,
        locationCode: warehouseArea,
        inboundStatus: usage.statusMeta.label,
        inboundAt,
        inboundBy,
        inboundSource: 'PDA 入仓扫码',
        containedFeiTickets,
        totalPieceQty: containedFeiTickets.reduce((total, ticket) => total + ticket.pieceQty, 0),
        mixedFlag,
        mixedSummary: buildInboundTempBagMixedSummary(containedFeiTickets),
        discrepancyRecords,
        nextSortingStatus: usage.sewingTaskNo ? '已参与后续分拣装袋' : '未绑定车缝任务，待后续分配后再分拣装袋',
        remark: usage.note || INBOUND_TEMP_BAG_RULE_LABEL,
      } satisfies InboundTempBag
    })
    .sort((left, right) => right.inboundAt.localeCompare(left.inboundAt, 'zh-CN'))
}

export function buildInboundTempBagInventoryRecords(bags: InboundTempBag[]): InboundTempBagInventoryRecord[] {
  return bags.flatMap((bag) =>
    bag.containedFeiTickets.map((ticket) => ({
      inventoryRecordId: `INV-${bag.tempBagUseId}-${ticket.feiTicketId}`,
      feiTicketId: ticket.feiTicketId,
      feiTicketNo: ticket.feiTicketNo,
      cutOrderId: ticket.cutOrderId,
      cutOrderNo: ticket.cutOrderNo,
      productionOrderId: ticket.productionOrderId,
      productionOrderNo: ticket.productionOrderNo,
      spuCode: ticket.spuCode,
      color: ticket.color,
      size: ticket.size,
      partName: ticket.partName,
      pieceQty: ticket.pieceQty,
      pieceSequenceLabel: ticket.pieceSequenceLabel,
      hasSpecialCraft: ticket.hasSpecialCraft,
      specialCraftDisplay: ticket.specialCraftDisplay,
      receiverFactoryDisplay: ticket.receiverFactoryDisplay,
      printStatus: ticket.printStatus,
      voidStatus: ticket.voidStatus,
      tempBagCode: bag.bagCode,
      warehouseArea: bag.warehouseArea,
      locationCode: bag.locationCode,
      inboundAt: bag.inboundAt,
      inventoryStatus: '待分配',
    })),
  )
}

export function buildTransferBagViewModel(options: {
  cutOrderRows: CutOrderRow[]
  ticketRecords: FeiTicketLabelRecord[]
  markerPlanSources: MarkerPlanSourceRecord[]
  store: TransferBagStore
  spreadingStore?: MarkerSpreadingStore
  includeStageDerived?: boolean
}): TransferBagViewModel {
  void options.markerPlanSources
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
      cutOrderIds: binding.cutOrderId ? [binding.cutOrderId] : [],
      markerPlanId: ticket?.markerPlanId || '',
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
    const cutOrderIds = uniqueStrings(bindings.map((item) => item.cutOrderId))
    const markerPlanIds = uniqueStrings(
      bindings.map((item) => ticketCandidatesById[item.ticketRecordId]?.markerPlanId).filter(Boolean),
    )
    const materialSkus = uniqueStrings(
      bindings.map((item) => ticketCandidatesById[item.ticketRecordId]?.materialSku).filter(Boolean),
    )
    const colors = uniqueStrings(
      bindings.map((item) => ticketCandidatesById[item.ticketRecordId]?.color).filter(Boolean),
    )

    return findSpreadingTraceAnchor(spreadingTraceAnchors, {
      cutOrderIds,
      markerPlanId: markerPlanIds[0] || '',
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
      const usageStage = normalizeTransferBagUsageStage(usage.usageStage)
      const isInboundTemp = usageStage === 'INBOUND_TEMP'
      const boundObjectType = usage.boundObjectType || (isInboundTemp ? '入仓暂存记录' : '车缝任务')
      const boundObjectId = usage.boundObjectId || (isInboundTemp ? usage.usageId : usage.sewingTaskId)
      const boundObjectNo = usage.boundObjectNo || (isInboundTemp ? usage.usageNo : usage.sewingTaskNo)
      const receiverType = usage.receiverType || (isInboundTemp ? '仓库' : '工厂')
      const receiverId = usage.receiverId || (isInboundTemp ? usage.sourceWarehouseId || 'cutting-wait-handover' : usage.sewingFactoryId)
      const receiverName = usage.receiverName || (isInboundTemp ? usage.sourceWarehouseName || '裁床待交出仓' : usage.sewingFactoryName)
      const sewingFactoryName =
        isInboundTemp
          ? '待车缝任务分配'
          : resolveTransferBagFactoryName(
              receiverId || usage.sewingFactoryId || sewingTask?.sewingFactoryId,
              receiverName || usage.sewingFactoryName || sewingTask?.sewingFactoryName,
            )
      const pocketStatusKey = mapUsageStatusToPocketCarrierStatus({
        usage,
        masterStatus: bagMaster?.currentStatus || 'IDLE',
      })
      return {
        ...usage,
        usageStage,
        usageStageLabel: usage.usageStageLabel || getTransferBagUsageStageLabel(usageStage),
        boundObjectType,
        boundObjectId,
        boundObjectNo,
        receiverType,
        receiverId,
        receiverName,
        sourceWarehouseId: usage.sourceWarehouseId || 'cutting-wait-handover',
        sourceWarehouseName: usage.sourceWarehouseName || '裁床待交出仓',
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
        cutOrderNos: uniqueStrings(bindings.map((item) => item.cutOrderNo)),
        productionOrderNos: uniqueStrings(bindings.map((item) => item.productionOrderNo)),
        sourceMarkerNos: uniqueStrings(bindings.map((item) => item.sourceMarkerNo)),
        markerPlanNos: uniqueStrings(bindings.map((item) => item.markerPlanNo)),
        latestManifest: manifests[0] ?? null,
        spreadingSessionId: traceAnchor?.spreadingSessionId || '',
        spreadingSessionNo: traceAnchor?.spreadingSessionNo || '',
        spreadingSourceWritebackId: traceAnchor?.sourceWritebackId || '',
        spreadingUpdatedFromPdaAt: traceAnchor?.updatedFromPdaAt || '',
        spreadingColorSummary: traceAnchor?.colorSummary || '',
        bagFirstSatisfied: bindings.length > 0,
        bagFirstRuleLabel: getTransferBagRuleLabel(usageStage),
        navigationPayload: buildTransferBagNavigationPayload({
          cutOrderId: bindings[0]?.cutOrderId,
          cutOrderNo: bindings[0]?.cutOrderNo,
          productionOrderId: bindings[0]?.ticket?.productionOrderId || '',
          productionOrderNo: bindings[0]?.productionOrderNo,
          markerPlanId: bindings[0]?.ticket?.markerPlanId || '',
          markerPlanNo: bindings[0]?.markerPlanNo || undefined,
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
        packedCutOrderCount: summary.cutOrderCount,
        pocketStatusKey,
        pocketStatusMeta: derivePocketCarrierStatus(pocketStatusKey),
        currentUsage: usage,
        currentStyleCode: usage?.styleCode || '',
        currentTotalPieceCount: summary.quantityTotal,
        currentGarmentQtyTotal: summary.garmentQtyTotal,
        currentSourceProductionOrderCount: summary.productionOrderCount,
        currentSourceCutOrderCount: summary.cutOrderCount,
        currentSourceMarkerPlanCount: summary.markerPlanSourceCount,
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
        pocketStatusKey: mapUsageStatusToPocketCarrierStatus({
          usage: usagesByIdRaw[binding.usageId] ?? null,
          masterStatus: options.store.masters.find((item) => item.bagId === binding.bagId)?.currentStatus || 'IDLE',
        }),
        removable: ['DRAFT', 'PACKING'].includes(usagesByIdRaw[binding.usageId]?.usageStatus || ''),
        spreadingSessionId: traceAnchor?.spreadingSessionId || '',
        spreadingSessionNo: traceAnchor?.spreadingSessionNo || '',
        spreadingSourceWritebackId: traceAnchor?.sourceWritebackId || '',
        bagFirstRuleLabel: getTransferBagRuleLabel(usageItem?.usageStage),
        navigationPayload: buildTransferBagNavigationPayload({
          cutOrderId: binding.cutOrderId,
          cutOrderNo: binding.cutOrderNo,
          productionOrderId: ticketCandidatesById[binding.ticketRecordId]?.productionOrderId || '',
          productionOrderNo: binding.productionOrderNo,
          markerPlanId: ticketCandidatesById[binding.ticketRecordId]?.markerPlanId || '',
          markerPlanNo: binding.markerPlanNo || undefined,
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

  const includeStageDerived = options.includeStageDerived ?? true
  const stageLedgerItems = includeStageDerived ? buildTransferBagStageLedgerItems(usageItems) : []
  const handoverStageItems = stageLedgerItems.filter((item) => item.stage === 'HANDOVER_PACKING')
  const stageSummary: TransferBagStageSummary = {
    inboundTempCount: stageLedgerItems.filter((item) => item.stage === 'INBOUND_TEMP').length,
    handoverPackingCount: handoverStageItems.length,
    handoverRelationOkCount: handoverStageItems.filter((item) => item.relationOk).length,
    handoverRelationMissingCount: handoverStageItems.filter((item) => !item.relationOk).length,
  }
  const sortingTasks = includeStageDerived ? buildCutPieceSortingTasks(usageItems) : []
  const sortingTaskSummary: CutPieceSortingTaskSummary = {
    taskCount: sortingTasks.length,
    pendingCount: sortingTasks.filter((task) => task.status === '待分拣').length,
    sortingCount: sortingTasks.filter((task) => task.status === '分拣中').length,
    packedCount: sortingTasks.filter((task) => task.status === '已装袋').length,
    handedOverCount: sortingTasks.filter((task) => task.status === '已交出' || task.status === '已回写').length,
    sourceTempBagCount: uniqueStrings(sortingTasks.flatMap((task) => task.sourceTempBagNos)).length,
    targetTransferBagCount: uniqueStrings(sortingTasks.flatMap((task) => task.targetTransferBagNos)).length,
  }

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
    stageSummary,
    stageLedgerItems,
    sortingTaskSummary,
    sortingTasks,
  }
}

function deriveCarrierManagementStatus(master: TransferBagMasterItem): TransferBagCarrierCurrentStatus {
  if (master.currentStatus === 'DISABLED') return '报废'
  const usage = master.currentUsage
  if (!usage) return '可用'
  if (usage.usageStage === 'INBOUND_TEMP') {
    return usage.usageStatus === 'READY_TO_DISPATCH' ? '入仓暂存中' : '入仓装袋中'
  }
  if (usage.usageStatus === 'READY_TO_DISPATCH') return '待交出'
  if (['DISPATCHED', 'PENDING_SIGNOFF', 'WAITING_RETURN', 'RETURN_INSPECTING'].includes(usage.usageStatus)) return '已交出待回收'
  if (['CLOSED', 'SCRAP_CLOSED'].includes(usage.usageStatus)) return '可用'
  return '交出装袋中'
}

function deriveCarrierManagementStatusFromUsage(usage: TransferBagUsageItem): TransferBagCarrierCurrentStatus {
  if (usage.bagMaster?.currentStatus === 'DISABLED') return '报废'
  if (usage.usageStage === 'INBOUND_TEMP') {
    if (usage.usageStatus === 'READY_TO_DISPATCH') return '入仓暂存中'
    if (['CLOSED', 'SCRAP_CLOSED'].includes(usage.usageStatus)) return '可用'
    return '入仓装袋中'
  }
  if (usage.usageStatus === 'READY_TO_DISPATCH') return '待交出'
  if (['DISPATCHED', 'PENDING_SIGNOFF', 'WAITING_RETURN', 'RETURN_INSPECTING'].includes(usage.usageStatus)) return '已交出待回收'
  if (['CLOSED', 'SCRAP_CLOSED'].includes(usage.usageStatus)) return usage.bagMaster?.currentStatus === 'DISABLED' ? '报废' : '可用'
  return '交出装袋中'
}

function deriveCarrierManagementCycleStatusLabel(usage: TransferBagUsageItem): string {
  const status = deriveCarrierManagementStatusFromUsage(usage)
  if (status === '可用') return ['CLOSED', 'SCRAP_CLOSED'].includes(usage.usageStatus) ? '已关闭' : '可用'
  return status
}

function isHandoverWaitingReturnStatus(status: TransferBagUsageStatusKey): boolean {
  return ['DISPATCHED', 'PENDING_SIGNOFF', 'WAITING_RETURN', 'RETURN_INSPECTING'].includes(status)
}

function isClosedUsageStatus(status: TransferBagUsageStatusKey): boolean {
  return ['CLOSED', 'SCRAP_CLOSED'].includes(status)
}

function isBagMaterialText(value: string): string {
  return value.split('可' + '复' + '用').join('循环')
}

function deriveCurrentStatusForDisplay(status: TransferBagMasterStatusKey): TransferBagCarrierCurrentStatus {
  if (status === 'DISABLED') return '报废'
  return '可用'
}

function deriveCarrierManagementUseStage(usage: TransferBagUsageItem | null | undefined): TransferBagCarrierUseStage {
  if (!usage) return '无'
  if (usage.usageStage === 'INBOUND_TEMP') return '入仓暂存'
  if (isHandoverWaitingReturnStatus(usage.usageStatus)) return '已交出待回收'
  return '交出装袋'
}

function getCarrierUseMixedSummary(usage: TransferBagUsageItem): { mixedFlag: boolean; mixedSummary: string } {
  const productionOrderCount = usage.productionOrderNos.length
  const cutOrderCount = usage.cutOrderNos.length
  const partCount = uniqueStrings(usage.bindingItems.map((item) => item.ticket?.partName || item.partName)).length
  const sizeCount = uniqueStrings(usage.bindingItems.map((item) => item.ticket?.size || item.size)).length
  const mixedFlag = usage.usageStage === 'INBOUND_TEMP' && (productionOrderCount > 1 || cutOrderCount > 1 || partCount > 1 || sizeCount > 1)
  return {
    mixedFlag,
    mixedSummary: usage.usageStage === 'INBOUND_TEMP'
      ? `涉及 ${productionOrderCount} 个生产单 / ${cutOrderCount} 张裁片单 / ${partCount} 个部位 / ${sizeCount} 个尺码`
      : `绑定 ${usage.boundObjectNo || usage.sewingTaskNo || '待补绑定对象'}，${usage.summary.ticketCount} 张菲票`,
  }
}

function toTransferBagUseCycleView(usage: TransferBagUsageItem, scrapRecords: TransferBagScrapRecord[]): TransferBagUseCycleView {
  const mixed = getCarrierUseMixedSummary(usage)
  const productionOrderCount = usage.productionOrderNos.length
  const cutOrderCount = usage.cutOrderNos.length
  const sourceWarehouseId = usage.sourceWarehouseId || 'cutting-wait-handover'
  const sourceWarehouseName = usage.sourceWarehouseName || '裁床待交出仓'
  const isInboundTemp = usage.usageStage === 'INBOUND_TEMP'
  return {
    bagUseId: usage.usageId,
    bagUseNo: usage.usageNo,
    bagMasterId: usage.bagId,
    bagCode: usage.bagCode,
    useStage: isInboundTemp ? '入仓暂存' : '交出装袋',
    sourceWarehouseId,
    sourceWarehouseName,
    warehouseArea: usage.warehouseArea || (isInboundTemp ? '裁片暂存区' : '交出备货区'),
    locationCode: usage.locationCode || (isInboundTemp ? `${usage.bagCode.slice(-2) || 'A'}-暂存位` : '交出月台'),
    inboundAt: usage.startedAt || '',
    inboundBy: usage.dispatchBy || '裁床仓管',
    targetObjectType: isInboundTemp ? '入仓暂存记录' : usage.boundObjectType || '车缝任务',
    targetObjectId: isInboundTemp ? usage.usageId : usage.boundObjectId || usage.sewingTaskId,
    targetObjectNo: isInboundTemp ? usage.usageNo : usage.boundObjectNo || usage.sewingTaskNo,
    receiverFactoryId: isInboundTemp ? '' : usage.receiverId || usage.sewingFactoryId,
    receiverFactoryName: isInboundTemp ? '暂不绑定接收对象' : usage.receiverName || usage.sewingFactoryName,
    receiverType: isInboundTemp ? '仓库' : usage.receiverType || '工厂',
    receiverId: isInboundTemp ? sourceWarehouseId : usage.receiverId || usage.sewingFactoryId,
    receiverName: isInboundTemp ? sourceWarehouseName : usage.receiverName || usage.sewingFactoryName,
    containedProductionOrderCount: productionOrderCount,
    containedCutOrderCount: cutOrderCount,
    containedMaterialQty: usage.summary.quantityTotal,
    containedFeiTickets: usage.bindingItems.map((binding) => ({
      feiTicketId: binding.feiTicketId,
      feiTicketNo: binding.ticketNo,
      pieceQty: binding.qty,
      productionOrderNo: binding.productionOrderNo,
      cutOrderNo: binding.cutOrderNo,
      partName: binding.ticket?.partName || binding.partName || '待补部位',
      size: binding.ticket?.size || binding.size || '待补尺码',
    })),
    containedPieceQty: usage.summary.quantityTotal,
    startedAt: usage.startedAt || '',
    handedOverAt: usage.dispatchAt || '',
    signedBy: usage.signedBy || '',
    signedPieceQty: usage.signedPieceQty ?? usage.summary.quantityTotal,
    signedAt: usage.signedAt || '',
    returnWarehouseName: usage.returnWarehouseName || usage.locationCode || '待确认',
    returnedBy: usage.returnedBy || '',
    returnedAt: usage.returnedAt || '',
    closedAt: ['CLOSED', 'SCRAP_CLOSED'].includes(usage.usageStatus) ? usage.returnedAt || usage.signedAt || usage.dispatchAt || '' : '',
    currentStatus: deriveCarrierManagementCycleStatusLabel(usage),
    discrepancyRecords: scrapRecords.filter((item) => item.relatedUseId === usage.usageId),
    mixedFlag: mixed.mixedFlag,
    mixedSummary: mixed.mixedSummary,
  }
}

function buildTransferBagScrapRecordsFromStore(
  store: TransferBagStore,
  viewModel: TransferBagViewModel,
): TransferBagScrapRecord[] {
  const records: TransferBagScrapRecord[] = (store.scrapRecords || []).map((record) => ({ ...record }))
  const usageById = viewModel.usagesById

  store.conditionRecords
    .filter((condition) => condition.reusableDecision === 'DISABLED')
    .forEach((condition) => {
      records.push({
        scrapRecordId: `SCRAP-${condition.conditionRecordId}`,
        bagCode: condition.bagCode,
        scrapType: '中转袋报废',
        relatedUseId: condition.usageId,
        relatedObjectType: '袋况验收',
        relatedObjectId: usageById[condition.usageId]?.usageNo || condition.bagCode,
        description: condition.damageType || condition.note || '袋况已记录到中转袋台账。',
        evidencePhotos: [],
        reportedAt: condition.inspectedAt,
        reportedBy: condition.inspectedBy,
        handlingStatus: '已处理',
        handledAt: '',
        handledBy: '',
      })
    })

  store.closureResults
    .filter((closure) => closure.closureStatus === 'SCRAP_CLOSED' && closure.nextBagStatus === 'DISABLED')
    .forEach((closure) => {
      records.push({
        scrapRecordId: `SCRAP-${closure.closureId}`,
        bagCode: usageById[closure.usageId]?.bagCode || closure.cycleNo,
        scrapType: '中转袋报废',
        relatedUseId: closure.usageId,
        relatedObjectType: '使用周期',
        relatedObjectId: closure.usageNo,
        description: closure.reason || closure.warningMessages.join('；') || '本次使用周期已关闭。',
        evidencePhotos: [],
        reportedAt: closure.closedAt,
        reportedBy: closure.closedBy,
        handlingStatus: '已关闭',
        handledAt: closure.closedAt,
        handledBy: closure.closedBy,
      })
    })

  return uniqueTransferBagScrapRecordsByBag(records)
}

function uniqueTransferBagScrapRecordsByBag(records: TransferBagScrapRecord[]): TransferBagScrapRecord[] {
  const latestByBagCode = records
    .filter((record) => record.bagCode && [record.scrapType, record.description].filter(Boolean).join(' / ').includes('报废'))
    .sort((left, right) => right.reportedAt.localeCompare(left.reportedAt, 'zh-CN'))
    .reduce<Map<string, TransferBagScrapRecord>>((result, record) => {
      if (!result.has(record.bagCode)) result.set(record.bagCode, record)
      return result
    }, new Map())
  return Array.from(latestByBagCode.values())
}

export function buildTransferBagCarrierManagementProjection(
  store: TransferBagStore,
  viewModel: TransferBagViewModel,
): TransferBagCarrierManagementProjection {
  const scrapRecords = buildTransferBagScrapRecordsFromStore(store, viewModel)
  const scrapCountByBag = scrapRecords.reduce<Record<string, number>>((result, record) => {
    result[record.bagCode] = (result[record.bagCode] || 0) + 1
    return result
  }, {})
  const usagesByBag = viewModel.usages.reduce<Record<string, TransferBagUsageItem[]>>((result, usage) => {
    if (!result[usage.bagId]) result[usage.bagId] = []
    result[usage.bagId].push(usage)
    return result
  }, {})

  const masterRecords: TransferBagMasterArchiveRecord[] = viewModel.masters.map((master) => {
    const relatedUsages = (usagesByBag[master.bagId] || []).slice().sort((left, right) => right.usageNo.localeCompare(left.usageNo, 'zh-CN'))
    const currentUsage = master.currentUsage
    const currentUseStage = deriveCarrierManagementUseStage(currentUsage)
    const currentBoundObjectType = !currentUsage
      ? ''
      : currentUseStage === '入仓暂存'
        ? '入仓暂存记录'
        : currentUsage.boundObjectType || '车缝任务'
    const currentBoundObjectNo = !currentUsage
      ? ''
      : currentUseStage === '入仓暂存'
        ? currentUsage.usageNo
        : currentUsage.boundObjectNo || currentUsage.sewingTaskNo || currentUsage.usageNo
    return {
      bagMasterId: master.bagId,
      bagCode: master.bagCode,
      bagName: master.bagName || master.bagCode,
      bagSpec: master.bagSpec || `${master.bagType || '中转袋'} / 容量 ${master.capacity} 张菲票`,
      bagMaterial: isBagMaterialText(master.bagMaterial || (master.carrierType === 'box' ? '周转箱' : '循环软袋')),
      ownershipFactoryId: master.ownershipFactoryId || '',
      ownershipFactoryName: master.ownershipFactoryName || '',
      currentStatus: deriveCarrierManagementStatus(master),
      currentLocation: master.currentLocation || '待命位',
      currentUseStage,
      currentUseId: currentUsage?.usageId || '',
      currentBoundObjectType,
      currentBoundObjectId: currentUseStage === '入仓暂存' ? currentUsage?.usageId || '' : currentUsage?.boundObjectId || currentUsage?.sewingTaskId || '',
      currentBoundObjectNo,
      currentFeiTicketCount: master.packedTicketCount,
      currentPieceQty: master.currentTotalPieceCount,
      lastUsedAt: relatedUsages[0]?.startedAt || '',
      lastSignedAt: master.currentSignedAt,
      lastReturnedAt: master.currentReturnedAt,
      totalUseCount: relatedUsages.length,
      scrapCount: scrapCountByBag[master.bagCode] || 0,
      enabled: master.enabled !== false && master.currentStatus !== 'DISABLED',
      createdAt: master.createdAt || '2026-03-01 08:00',
      createdBy: master.createdBy || '裁床仓管',
    }
  })

  const useCycles = viewModel.usages.map((usage) => toTransferBagUseCycleView(usage, scrapRecords))
  const handoverPackingUses = useCycles.filter((cycle) => cycle.useStage === '交出装袋')
  const signedAndReturnUses = useCycles.filter((cycle) => cycle.currentStatus === '已交出待回收' || Boolean(cycle.returnedAt) || cycle.currentStatus === '已关闭')
  const taskBagGroups = Object.values(
    handoverPackingUses.reduce<Record<string, { sewingTaskNo: string; receiverFactoryName: string; bagCodes: string[]; useCount: number }>>((result, cycle) => {
      const key = cycle.targetObjectNo || '未绑定对象'
      if (!result[key]) {
        result[key] = {
          sewingTaskNo: key,
          receiverFactoryName: cycle.receiverName,
          bagCodes: [],
          useCount: 0,
        }
      }
      result[key].bagCodes.push(cycle.bagCode)
      result[key].bagCodes = uniqueStrings(result[key].bagCodes)
      result[key].useCount += 1
      return result
    }, {}),
  ).filter((item) => item.bagCodes.length > 1)

  return {
    overviewCards: [
      { label: '中转袋档案', value: masterRecords.length, hint: '循环载具主档' },
      { label: '入仓暂存使用', value: useCycles.filter((cycle) => cycle.useStage === '入仓暂存').length, hint: '允许混装，不绑定车缝任务' },
      { label: '交出装袋使用', value: handoverPackingUses.length, hint: '一个袋只绑定一个车缝任务' },
      { label: '已交出待回收', value: signedAndReturnUses.length, hint: '交出后的载具回收确认' },
      { label: '报废记录', value: scrapRecords.filter((record) => [record.scrapType, record.description].filter(Boolean).join(' / ').includes('报废')).length, hint: '仅统计报废记录' },
    ],
    masterRecords,
    inboundTempUses: useCycles.filter((cycle) => cycle.useStage === '入仓暂存'),
    handoverPackingUses,
    signedAndReturnUses,
    scrapRecords,
    taskBagGroups,
  }
}
