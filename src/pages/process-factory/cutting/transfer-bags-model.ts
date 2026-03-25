import { FEI_TICKET_DEMO_CASE_IDS, type FeiTicketLabelRecord } from './fei-tickets-model'
import type { MergeBatchRecord } from './merge-batches-model'
import type { OriginalCutOrderRow } from './original-orders-model'

const numberFormatter = new Intl.NumberFormat('zh-CN')

export const CUTTING_TRANSFER_BAG_LEDGER_STORAGE_KEY = 'cuttingTransferBagLedger'
export const CUTTING_TRANSFER_BAG_SELECTED_TICKET_IDS_STORAGE_KEY = 'cuttingTransferBagSelectedTicketRecordIds'

export const TRANSFER_BAG_DEMO_CASE_IDS = {
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

export interface TransferBagSummaryMeta<Key extends string> {
  key: Key
  label: string
  className: string
  detailText: string
}

export interface TransferBagMaster {
  bagId: string
  bagCode: string
  bagType: string
  capacity: number
  reusable: boolean
  currentStatus: TransferBagMasterStatusKey
  currentLocation: string
  latestUsageId: string
  latestUsageNo: string
  note: string
}

export interface TransferBagUsage {
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
  note: string
}

export interface TransferBagItemBinding {
  bindingId: string
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
  qty: number
  boundAt: string
  boundBy: string
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
  usageId: string
  action: string
  actionAt: string
  actionBy: string
  note: string
}

export interface TransferBagReturnReceipt {
  returnReceiptId: string
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
  originalCutOrderNo?: string
  mergeBatchNo?: string
  cuttingGroup?: string
  warehouseStatus?: string
  ticketNo?: string
  sewingTaskNo?: string
  bagCode?: string
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
  quantityTotal: number
}

export interface TransferBagTicketCandidate {
  ticketRecordId: string
  ticketNo: string
  originalCutOrderId: string
  originalCutOrderNo: string
  productionOrderNo: string
  mergeBatchNo: string
  styleCode: string
  spuCode: string
  color: string
  size: string
  partName: string
  qty: number
  materialSku: string
  sourceContextType: string
  ticketStatus: FeiTicketLabelRecord['status']
}

export interface TransferBagMasterItem extends TransferBagMaster {
  statusMeta: TransferBagSummaryMeta<TransferBagMasterStatusKey>
  latestUsageStatusMeta: TransferBagSummaryMeta<TransferBagUsageStatusKey> | null
  packedTicketCount: number
  packedOriginalCutOrderCount: number
  pocketStatusKey: PocketCarrierStatusKey
  pocketStatusMeta: TransferBagSummaryMeta<PocketCarrierStatusKey>
  currentUsage: TransferBagUsageItem | null
  currentStyleCode: string
  currentTotalPieceCount: number
  currentSourceProductionOrderCount: number
  currentSourceCutOrderCount: number
  currentSourceBatchCount: number
  currentDispatchedAt: string
  currentSignedAt: string
  currentReturnedAt: string
}

export interface TransferBagUsageItem extends TransferBagUsage {
  statusMeta: TransferBagSummaryMeta<TransferBagUsageStatusKey>
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
  mergeBatchNos: string[]
  latestManifest: TransferBagDispatchManifest | null
  navigationPayload: TransferBagNavigationPayload
}

export interface TransferBagBindingItem extends TransferBagItemBinding {
  usage: TransferBagUsage | null
  ticket: TransferBagTicketCandidate | null
  pocketStatusKey: PocketCarrierStatusKey
  removable: boolean
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
    inUseBagCount: number
    readyDispatchUsageCount: number
    dispatchedUsageCount: number
    pendingSignoffCount: number
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
    detailText: '当前口袋已完成本轮 usage 闭环，可继续复用。',
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
    detailText: '当前 usage 仅完成袋子与任务草稿绑定。',
  },
  PACKING: {
    label: '装袋中',
    className: 'bg-blue-100 text-blue-700 border border-blue-200',
    detailText: '当前 usage 正在持续建立口袋码 -> 菲票码父子映射。',
  },
  READY_TO_DISPATCH: {
    label: '待发出',
    className: 'bg-violet-100 text-violet-700 border border-violet-200',
    detailText: '当前 usage 已完成装袋，可打印交接清单并发出。',
  },
  DISPATCHED: {
    label: '已发出',
    className: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    detailText: '当前 usage 已发出，但尚未进入回货闭环。',
  },
  PENDING_SIGNOFF: {
    label: '待签收',
    className: 'bg-amber-100 text-amber-700 border border-amber-200',
    detailText: '当前 usage 已到待签收状态，后续在阶段 5 / 步骤 3 进入回货与复用处理。',
  },
  WAITING_RETURN: {
    label: '待回仓',
    className: 'bg-orange-100 text-orange-700 border border-orange-200',
    detailText: '当前 usage 已到回货前置阶段，等待返仓。',
  },
  RETURN_INSPECTING: {
    label: '回仓验收中',
    className: 'bg-cyan-100 text-cyan-700 border border-cyan-200',
    detailText: '当前 usage 已进入回货验收与袋况确认。',
  },
  CLOSED: {
    label: '已关闭',
    className: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    detailText: '当前 usage 已完成回货验收并正式关闭。',
  },
  EXCEPTION_CLOSED: {
    label: '异常关闭',
    className: 'bg-rose-100 text-rose-700 border border-rose-200',
    detailText: '当前 usage 在存在差异或袋况异常时带说明关闭。',
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

function sanitizeId(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
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
  originalCutOrderNo?: string
  productionOrderNo?: string
  mergeBatchNo?: string
  bagCode?: string
  usageNo?: string
  sewingTaskNo?: string
}): TransferBagNavigationPayload {
  return {
    cutPieceWarehouse: {
      originalCutOrderNo: options.originalCutOrderNo,
      productionOrderNo: options.productionOrderNo,
      mergeBatchNo: options.mergeBatchNo,
    },
    feiTickets: {
      originalCutOrderNo: options.originalCutOrderNo,
      mergeBatchNo: options.mergeBatchNo,
    },
    originalOrders: {
      originalCutOrderNo: options.originalCutOrderNo,
      productionOrderNo: options.productionOrderNo,
      mergeBatchNo: options.mergeBatchNo,
    },
    summary: {
      originalCutOrderNo: options.originalCutOrderNo,
      bagCode: options.bagCode,
      sewingTaskNo: options.sewingTaskNo,
      mergeBatchNo: options.mergeBatchNo,
      usageNo: options.usageNo,
    },
  }
}

export function buildTransferBagNavigationPayload(options: {
  originalCutOrderNo?: string
  productionOrderNo?: string
  mergeBatchNo?: string
  bagCode?: string
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
    quantityTotal: bindings.reduce((sum, item) => sum + Math.max(item.qty, 0), 0),
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
    auditTrailId: `bag-audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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
  const dateKey = options.nowText.slice(0, 10).replaceAll('-', '')
  const sameDay = options.existingUsages
    .map((item) => item.usageNo)
    .filter((item) => item.startsWith(`TBU-${dateKey}`))
    .map((item) => Number.parseInt(item.split('-').pop() || '0', 10))
    .filter((item) => Number.isFinite(item))
  const nextSerial = Math.max(0, ...sameDay) + 1

  return {
    usageId: `usage-${Date.now()}`,
    usageNo: `TBU-${dateKey}-${String(nextSerial).padStart(3, '0')}`,
    bagId: options.bag.bagId,
    bagCode: options.bag.bagCode,
    sewingTaskId: options.sewingTask.sewingTaskId,
    sewingTaskNo: options.sewingTask.sewingTaskNo,
    sewingFactoryId: options.sewingTask.sewingFactoryId,
    sewingFactoryName: options.sewingTask.sewingFactoryName,
    styleCode: options.sewingTask.styleCode,
    spuCode: options.sewingTask.spuCode,
    skuSummary: options.sewingTask.skuSummary,
    colorSummary: options.sewingTask.colorSummary,
    sizeSummary: options.sewingTask.sizeSummary,
    usageStatus: 'DRAFT',
    packedTicketCount: 0,
    packedOriginalCutOrderCount: 0,
    startedAt: options.nowText,
    finishedPackingAt: '',
    dispatchAt: '',
    dispatchBy: '',
    signoffStatus: 'PENDING',
    signedAt: '',
    returnedAt: '',
    note: options.note?.trim() || '周转口袋 usage 草稿已创建，等待装袋与交接。',
  }
}

export function validateBagToSewingTaskBinding(usage: TransferBagUsage | null, sewingTaskId: string): TransferBagValidationResult {
  if (!usage) return { ok: false, reason: '当前没有可绑定的 usage，请先创建 usage 草稿。' }
  if (!sewingTaskId) return { ok: false, reason: '当前 usage 尚未绑定车缝任务。' }
  if (usage.sewingTaskId && usage.sewingTaskId !== sewingTaskId) {
    return { ok: false, reason: '同一次 usage 只能归属一个车缝任务，请不要混装到多个车缝任务。' }
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
  if (!options.usage) return { ok: false, reason: '请先创建或选择一个 usage，再进行装袋。' }
  if (!options.sewingTask) return { ok: false, reason: '当前 usage 尚未绑定车缝任务。' }
  if (options.ticket.ticketStatus === 'VOIDED') {
    return { ok: false, reason: `${options.ticket.ticketNo} 已作废，禁止继续装袋。` }
  }
  if (!options.ticket.originalCutOrderId || !options.ticket.originalCutOrderNo) {
    return { ok: false, reason: '当前菲票缺少原始裁片单 owner，不能进入周转口袋。' }
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
    return { ok: false, reason: `${options.ticket.ticketNo} 的款号与当前车缝任务不一致，不能装入同一 usage。` }
  }

  if (options.sewingTask.spuCode && options.ticket.spuCode && options.sewingTask.spuCode !== options.ticket.spuCode) {
    return { ok: false, reason: `${options.ticket.ticketNo} 的 SPU 与当前车缝任务不一致，不能装入同一 usage。` }
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
  return {
    manifestId: `dispatch-manifest-${Date.now()}`,
    usageId: options.usage.usageId,
    bagCode: options.usage.bagCode,
    sewingTaskNo: options.usage.sewingTaskNo,
    sewingFactoryName: options.usage.sewingFactoryName,
    ticketCount: options.summary.ticketCount,
    originalCutOrderCount: options.summary.originalCutOrderCount,
    createdAt: options.nowText,
    createdBy: options.createdBy,
    printStatus: 'PRINTED',
    note: options.note?.trim() || '当前交接清单用于发出前的袋码 / 菲票码核对。',
  }
}

function buildSewingTaskSeeds(originalRows: OriginalCutOrderRow[], mergeBatches: MergeBatchRecord[]): SewingTaskRef[] {
  const mergeTaskSeeds = mergeBatches.slice(0, 3).map((batch, index) => ({
    sewingTaskId: `sewing-task-${sanitizeId(batch.mergeBatchNo)}`,
    sewingTaskNo: `CF-${String(index + 1).padStart(3, '0')}`,
    sewingFactoryId: `factory-${index + 1}`,
    sewingFactoryName: ['苏州车缝一厂', '嘉兴车缝二厂', '常熟协作车缝点'][index] || `车缝工厂 ${index + 1}`,
    styleCode: batch.styleCode,
    spuCode: batch.spuCode,
    skuSummary: batch.materialSkuSummary,
    colorSummary: uniqueStrings(batch.items.map((item) => originalRows.find((row) => row.originalCutOrderId === item.originalCutOrderId)?.color)).join(' / ') || '混色',
    sizeSummary: 'S / M / L',
    plannedQty: batch.items.length * 24,
    status: index === 0 ? '待接料' : index === 1 ? '排单中' : '待交接',
    note: `来源于 ${batch.mergeBatchNo} 的后道交接任务占位。`,
  }))

  const fallbackRows = originalRows.slice(0, 2).map((row, index) => ({
    sewingTaskId: `sewing-task-fallback-${sanitizeId(row.originalCutOrderId)}`,
    sewingTaskNo: `CF-FB-${String(index + 1).padStart(3, '0')}`,
    sewingFactoryId: `fallback-factory-${index + 1}`,
    sewingFactoryName: ['昆山外协车缝点', '无锡返修车缝组'][index] || '后道车缝组',
    styleCode: row.styleCode,
    spuCode: row.spuCode,
    skuSummary: row.materialSku,
    colorSummary: row.color,
    sizeSummary: '默认尺码组',
    plannedQty: row.plannedQty || row.orderQty,
    status: '待接料',
    note: '用于无批次场景下的交接任务占位。',
  }))

  return [...mergeTaskSeeds, ...fallbackRows].slice(0, 5)
}

function buildTicketCandidates(ticketRecords: FeiTicketLabelRecord[]): TransferBagTicketCandidate[] {
  return ticketRecords
    .map((record) => ({
      ticketRecordId: record.ticketRecordId,
      ticketNo: record.ticketNo,
      originalCutOrderId: record.originalCutOrderId,
      originalCutOrderNo: record.originalCutOrderNo,
      productionOrderNo: record.productionOrderNo,
      mergeBatchNo: record.sourceMergeBatchNo,
      styleCode: record.styleCode,
      spuCode: record.spuCode,
      color: record.color,
      size: record.size || '',
      partName: record.partName || '',
      qty: Math.max(record.quantity ?? 1, 1),
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
  mergeBatches: MergeBatchRecord[]
}): TransferBagStore {
  const sewingTasks = buildSewingTaskSeeds(options.originalRows, options.mergeBatches)
  const ticketCandidates = buildTicketCandidates(options.ticketRecords)

  const masters: TransferBagMaster[] = [
    {
      bagId: 'bag-master-001',
      bagCode: 'BAG-A-001',
      bagType: '周转口袋',
      capacity: 24,
      reusable: true,
      currentStatus: 'IDLE',
      currentLocation: '裁片仓 A 区待命位',
      latestUsageId: '',
      latestUsageNo: '',
      note: '常用车缝交接口袋。',
    },
    {
      bagId: 'bag-master-002',
      bagCode: 'BAG-A-002',
      bagType: '周转口袋',
      capacity: 20,
      reusable: true,
      currentStatus: 'IDLE',
      currentLocation: '裁片仓 A 区待命位',
      latestUsageId: '',
      latestUsageNo: '',
      note: '适合中等票数交接。',
    },
    {
      bagId: 'bag-master-003',
      bagCode: 'BAG-B-001',
      bagType: '周转口袋',
      capacity: 18,
      reusable: true,
      currentStatus: 'IDLE',
      currentLocation: '车缝交接待发区',
      latestUsageId: '',
      latestUsageNo: '',
      note: '常用于返修与补片任务。',
    },
    {
      bagId: 'bag-master-004',
      bagCode: 'BOX-C-001',
      bagType: '周转箱',
      capacity: 32,
      reusable: true,
      currentStatus: 'IDLE',
      currentLocation: '裁片仓 C 区',
      latestUsageId: '',
      latestUsageNo: '',
      note: '大批量交接使用。',
    },
    {
      bagId: 'bag-master-005',
      bagCode: 'BAG-C-002',
      bagType: '周转口袋',
      capacity: 16,
      reusable: true,
      currentStatus: 'IDLE',
      currentLocation: '样衣仓旁临时交接位',
      latestUsageId: '',
      latestUsageNo: '',
      note: '预留给特殊工艺或返工批次。',
    },
  ]

  const usages: TransferBagUsage[] = []
  const bindings: TransferBagItemBinding[] = []
  const manifests: TransferBagDispatchManifest[] = []
  const auditTrail: TransferBagUsageAuditTrail[] = []
  const returnReceipts: TransferBagReturnReceipt[] = []
  const conditionRecords: TransferBagConditionRecord[] = []
  const reuseCycles: TransferBagReuseCycleSummary[] = []
  const closureResults: TransferBagUsageClosureResult[] = []
  const returnAuditTrail: TransferBagReturnAuditTrail[] = []

  const firstTask = sewingTasks[0]
  const secondTask = sewingTasks[1] || sewingTasks[0]
  const thirdTask = sewingTasks[2] || sewingTasks[0]
  const reservedTicketNos = new Set([
    TRANSFER_BAG_DEMO_CASE_IDS.CASE_F.lockedTicketNo,
    TRANSFER_BAG_DEMO_CASE_IDS.CASE_F.mismatchTicketNo,
  ])
  const genericTicketCandidates = ticketCandidates.filter((ticket) => !reservedTicketNos.has(ticket.ticketNo))
  const firstChunk = genericTicketCandidates.slice(0, 2)
  const secondChunk = genericTicketCandidates.slice(2, 4)
  const thirdChunk = genericTicketCandidates.slice(4, 6)

  if (firstTask && firstChunk.length) {
    const usage: TransferBagUsage = {
      usageId: 'seed-usage-001',
      usageNo: 'TBU-20260324-001',
      bagId: masters[0].bagId,
      bagCode: masters[0].bagCode,
      sewingTaskId: firstTask.sewingTaskId,
      sewingTaskNo: firstTask.sewingTaskNo,
      sewingFactoryId: firstTask.sewingFactoryId,
      sewingFactoryName: firstTask.sewingFactoryName,
      styleCode: firstTask.styleCode,
      spuCode: firstTask.spuCode,
      skuSummary: firstTask.skuSummary,
      colorSummary: firstTask.colorSummary,
      sizeSummary: firstTask.sizeSummary,
      usageStatus: 'READY_TO_DISPATCH',
      packedTicketCount: firstChunk.length,
      packedOriginalCutOrderCount: uniqueStrings(firstChunk.map((item) => item.originalCutOrderNo)).length,
      startedAt: '2026-03-24 08:35',
      finishedPackingAt: '2026-03-24 08:50',
      dispatchAt: '',
      dispatchBy: '',
      signoffStatus: 'PENDING',
      note: '已完成装袋，等待打印交接清单。',
    }
    usages.push(usage)
    masters[0].currentStatus = 'IN_USE'
    masters[0].latestUsageId = usage.usageId
    masters[0].latestUsageNo = usage.usageNo
    masters[0].currentLocation = '车缝交接待发区'

    firstChunk.forEach((ticket, index) => {
      bindings.push({
        bindingId: `seed-binding-a-${index + 1}`,
        usageId: usage.usageId,
        usageNo: usage.usageNo,
        bagId: usage.bagId,
        bagCode: usage.bagCode,
        ticketRecordId: ticket.ticketRecordId,
        ticketNo: ticket.ticketNo,
        originalCutOrderId: ticket.originalCutOrderId,
        originalCutOrderNo: ticket.originalCutOrderNo,
        productionOrderNo: ticket.productionOrderNo,
        mergeBatchNo: ticket.mergeBatchNo,
        qty: ticket.qty,
        boundAt: '2026-03-24 08:40',
        boundBy: '交接员-陈红',
        note: index === 0 ? '首袋装入主票。' : '同 task 补充票据。',
      })
    })
    manifests.push({
      manifestId: 'seed-manifest-001',
      usageId: usage.usageId,
      bagCode: usage.bagCode,
      sewingTaskNo: usage.sewingTaskNo,
      sewingFactoryName: usage.sewingFactoryName,
      ticketCount: firstChunk.length,
      originalCutOrderCount: uniqueStrings(firstChunk.map((item) => item.originalCutOrderNo)).length,
      createdAt: '2026-03-24 08:55',
      createdBy: '交接员-陈红',
      printStatus: 'PRINTED',
      note: '首轮发出前已打印交接清单。',
    })
    auditTrail.push(
      buildBagUsageAuditTrail({
        usageId: usage.usageId,
        action: '创建 usage',
        actionAt: '2026-03-24 08:35',
        actionBy: '交接员-陈红',
        note: `${usage.bagCode} 已绑定 ${usage.sewingTaskNo}。`,
      }),
      buildBagUsageAuditTrail({
        usageId: usage.usageId,
        action: '装袋完成',
        actionAt: '2026-03-24 08:50',
        actionBy: '交接员-陈红',
        note: `已绑定 ${formatNumber(firstChunk.length)} 张菲票。`,
      }),
    )
  }

  if (secondTask && secondChunk.length) {
    const usage: TransferBagUsage = {
      usageId: 'seed-usage-002',
      usageNo: 'TBU-20260324-002',
      bagId: masters[2].bagId,
      bagCode: masters[2].bagCode,
      sewingTaskId: secondTask.sewingTaskId,
      sewingTaskNo: secondTask.sewingTaskNo,
      sewingFactoryId: secondTask.sewingFactoryId,
      sewingFactoryName: secondTask.sewingFactoryName,
      styleCode: secondTask.styleCode,
      spuCode: secondTask.spuCode,
      skuSummary: secondTask.skuSummary,
      colorSummary: secondTask.colorSummary,
      sizeSummary: secondTask.sizeSummary,
      usageStatus: 'DISPATCHED',
      packedTicketCount: secondChunk.length,
      packedOriginalCutOrderCount: uniqueStrings(secondChunk.map((item) => item.originalCutOrderNo)).length,
      startedAt: '2026-03-24 09:00',
      finishedPackingAt: '2026-03-24 09:10',
      dispatchAt: '2026-03-24 09:20',
      dispatchBy: '交接员-张敏',
      signoffStatus: 'WAITING',
      note: '已发出，等待后道签收。',
    }
    usages.push(usage)
    masters[2].currentStatus = 'DISPATCHED'
    masters[2].latestUsageId = usage.usageId
    masters[2].latestUsageNo = usage.usageNo
    masters[2].currentLocation = secondTask.sewingFactoryName

    secondChunk.forEach((ticket, index) => {
      bindings.push({
        bindingId: `seed-binding-b-${index + 1}`,
        usageId: usage.usageId,
        usageNo: usage.usageNo,
        bagId: usage.bagId,
        bagCode: usage.bagCode,
        ticketRecordId: ticket.ticketRecordId,
        ticketNo: ticket.ticketNo,
        originalCutOrderId: ticket.originalCutOrderId,
        originalCutOrderNo: ticket.originalCutOrderNo,
        productionOrderNo: ticket.productionOrderNo,
        mergeBatchNo: ticket.mergeBatchNo,
        qty: ticket.qty,
        boundAt: '2026-03-24 09:05',
        boundBy: '交接员-张敏',
        note: index === 0 ? '按批次下发前校对。' : '补装同款余票。',
      })
    })
    manifests.push({
      manifestId: 'seed-manifest-002',
      usageId: usage.usageId,
      bagCode: usage.bagCode,
      sewingTaskNo: usage.sewingTaskNo,
      sewingFactoryName: usage.sewingFactoryName,
      ticketCount: secondChunk.length,
      originalCutOrderCount: uniqueStrings(secondChunk.map((item) => item.originalCutOrderNo)).length,
      createdAt: '2026-03-24 09:10',
      createdBy: '交接员-张敏',
      printStatus: 'PRINTED',
      note: '已随车缝交接一并发出。',
    })
    auditTrail.push(
      buildBagUsageAuditTrail({
        usageId: usage.usageId,
        action: '创建 usage',
        actionAt: '2026-03-24 09:00',
        actionBy: '交接员-张敏',
        note: `${usage.bagCode} 已绑定 ${usage.sewingTaskNo}。`,
      }),
      buildBagUsageAuditTrail({
        usageId: usage.usageId,
        action: '标记已发出',
        actionAt: '2026-03-24 09:20',
        actionBy: '交接员-张敏',
        note: `已发往 ${usage.sewingFactoryName}。`,
      }),
    )
  }

  if (thirdTask && thirdChunk.length) {
    const usage: TransferBagUsage = {
      usageId: 'seed-usage-003',
      usageNo: 'TBU-20260323-001',
      bagId: masters[1].bagId,
      bagCode: masters[1].bagCode,
      sewingTaskId: thirdTask.sewingTaskId,
      sewingTaskNo: thirdTask.sewingTaskNo,
      sewingFactoryId: thirdTask.sewingFactoryId,
      sewingFactoryName: thirdTask.sewingFactoryName,
      styleCode: thirdTask.styleCode,
      spuCode: thirdTask.spuCode,
      skuSummary: thirdTask.skuSummary,
      colorSummary: thirdTask.colorSummary,
      sizeSummary: thirdTask.sizeSummary,
      usageStatus: 'CLOSED',
      packedTicketCount: thirdChunk.length,
      packedOriginalCutOrderCount: uniqueStrings(thirdChunk.map((item) => item.originalCutOrderNo)).length,
      startedAt: '2026-03-23 15:00',
      finishedPackingAt: '2026-03-23 15:15',
      dispatchAt: '2026-03-23 15:40',
      dispatchBy: '交接员-周婷',
      signoffStatus: 'SIGNED',
      signedAt: '2026-03-23 17:10',
      returnedAt: '2026-03-24 09:35',
      note: '本轮 usage 已完成回货验收并释放口袋。',
    }
    usages.push(usage)
    masters[1].currentStatus = 'REUSABLE'
    masters[1].latestUsageId = usage.usageId
    masters[1].latestUsageNo = usage.usageNo
    masters[1].currentLocation = '裁片仓复用位'

    thirdChunk.forEach((ticket, index) => {
      bindings.push({
        bindingId: `seed-binding-c-${index + 1}`,
        usageId: usage.usageId,
        usageNo: usage.usageNo,
        bagId: usage.bagId,
        bagCode: usage.bagCode,
        ticketRecordId: ticket.ticketRecordId,
        ticketNo: ticket.ticketNo,
        originalCutOrderId: ticket.originalCutOrderId,
        originalCutOrderNo: ticket.originalCutOrderNo,
        productionOrderNo: ticket.productionOrderNo,
        mergeBatchNo: ticket.mergeBatchNo,
        qty: ticket.qty,
        boundAt: '2026-03-23 15:10',
        boundBy: '交接员-周婷',
        note: '历史闭环 usage 的装袋记录。',
      })
    })
    manifests.push({
      manifestId: 'seed-manifest-003',
      usageId: usage.usageId,
      bagCode: usage.bagCode,
      sewingTaskNo: usage.sewingTaskNo,
      sewingFactoryName: usage.sewingFactoryName,
      ticketCount: thirdChunk.length,
      originalCutOrderCount: uniqueStrings(thirdChunk.map((item) => item.originalCutOrderNo)).length,
      createdAt: '2026-03-23 15:20',
      createdBy: '交接员-周婷',
      printStatus: 'PRINTED',
      note: '历史闭环 usage 的发出清单。',
    })
    returnReceipts.push({
      returnReceiptId: 'seed-return-001',
      usageId: usage.usageId,
      usageNo: usage.usageNo,
      bagId: usage.bagId,
      bagCode: usage.bagCode,
      sewingTaskId: usage.sewingTaskId,
      sewingTaskNo: usage.sewingTaskNo,
      returnWarehouseName: '裁片仓返仓口',
      returnAt: '2026-03-24 09:35',
      returnedBy: '车缝厂-李梅',
      receivedBy: '仓管-吴洁',
      returnedFinishedQty: 24,
      returnedTicketCountSummary: thirdChunk.length,
      returnedOriginalCutOrderCount: uniqueStrings(thirdChunk.map((item) => item.originalCutOrderNo)).length,
      discrepancyType: 'NONE',
      discrepancyNote: '',
      note: '回货数量与交接清单一致。',
    })
    conditionRecords.push({
      conditionRecordId: 'seed-condition-001',
      usageId: usage.usageId,
      bagId: usage.bagId,
      bagCode: usage.bagCode,
      conditionStatus: 'GOOD',
      cleanlinessStatus: 'CLEAN',
      damageType: '',
      repairNeeded: false,
      reusableDecision: 'REUSABLE',
      inspectedAt: '2026-03-24 09:45',
      inspectedBy: '仓管-吴洁',
      note: '袋况完好，可直接复用。',
    })
    closureResults.push({
      closureId: 'seed-closure-001',
      usageId: usage.usageId,
      usageNo: usage.usageNo,
      closedAt: '2026-03-24 09:50',
      closedBy: '仓管-吴洁',
      closureStatus: 'CLOSED',
      nextBagStatus: 'REUSABLE',
      reason: '回货验收完成，口袋可继续复用。',
      warningMessages: [],
    })
    returnAuditTrail.push(
      {
        auditTrailId: 'seed-return-audit-001',
        usageId: usage.usageId,
        action: '创建回货草稿',
        actionAt: '2026-03-24 09:30',
        actionBy: '仓管-吴洁',
        payloadSummary: `${usage.usageNo} 已进入回货入仓流程`,
        note: '从发出台账进入回货工作台。',
      },
      {
        auditTrailId: 'seed-return-audit-002',
        usageId: usage.usageId,
        action: '完成验收',
        actionAt: '2026-03-24 09:45',
        actionBy: '仓管-吴洁',
        payloadSummary: '回货数量一致，袋况完好',
        note: '已写入回货验收记录与袋况记录。',
      },
      {
        auditTrailId: 'seed-return-audit-003',
        usageId: usage.usageId,
        action: '关闭 usage',
        actionAt: '2026-03-24 09:50',
        actionBy: '仓管-吴洁',
        payloadSummary: 'usage 已关闭，口袋释放为可复用',
        note: '当前 bag 已回到裁片仓复用位。',
      },
    )
    reuseCycles.push({
      cycleSummaryId: 'seed-cycle-001',
      bagId: usage.bagId,
      bagCode: usage.bagCode,
      latestUsageId: usage.usageId,
      latestUsageNo: usage.usageNo,
      totalUsageCount: 1,
      totalDispatchCount: 1,
      totalReturnCount: 1,
      lastDispatchedAt: usage.dispatchAt,
      lastReturnedAt: '2026-03-24 09:35',
      currentReusableStatus: 'REUSABLE',
      currentLocation: '裁片仓复用位',
      currentOpenUsageId: '',
      note: '当前 bag 已完成一轮完整发出 -> 回货 -> 复用闭环。',
    })
    auditTrail.push(
      buildBagUsageAuditTrail({
        usageId: usage.usageId,
        action: '创建 usage',
        actionAt: '2026-03-23 15:00',
        actionBy: '交接员-周婷',
        note: `${usage.bagCode} 已绑定 ${usage.sewingTaskNo}。`,
      }),
      buildBagUsageAuditTrail({
        usageId: usage.usageId,
        action: '标记已发出',
        actionAt: '2026-03-23 15:40',
        actionBy: '交接员-周婷',
        note: `已发往 ${usage.sewingFactoryName}。`,
      }),
    )
  }

  const caseFLockedTicket =
    ticketCandidates.find(
      (ticket) =>
        ticket.ticketRecordId === TRANSFER_BAG_DEMO_CASE_IDS.CASE_F.lockedTicketId &&
        ticket.ticketStatus !== 'VOIDED',
    ) || null

  if (caseFLockedTicket) {
    let demoTask =
      sewingTasks.find((task) => task.styleCode === caseFLockedTicket.styleCode) ||
      sewingTasks.find((task) => task.spuCode === caseFLockedTicket.spuCode) ||
      null

    if (!demoTask) {
      demoTask = {
        sewingTaskId: 'sewing-task-demo-case-f',
        sewingTaskNo: 'CF-DEMO-F-001',
        sewingFactoryId: 'factory-demo-f',
        sewingFactoryName: '打印验收演示车缝组',
        styleCode: caseFLockedTicket.styleCode,
        spuCode: caseFLockedTicket.spuCode,
        skuSummary: caseFLockedTicket.materialSku,
        colorSummary: caseFLockedTicket.color || '待补颜色',
        sizeSummary: caseFLockedTicket.size || '待补尺码',
        plannedQty: caseFLockedTicket.qty,
        status: '装袋中',
        note: '开发环境验收：用于验证 active usage 锁定与混装拦截。',
      }
      sewingTasks.push(demoTask)
    }

    const demoUsage: TransferBagUsage = {
      usageId: TRANSFER_BAG_DEMO_CASE_IDS.CASE_F.usageId,
      usageNo: TRANSFER_BAG_DEMO_CASE_IDS.CASE_F.usageNo,
      bagId: TRANSFER_BAG_DEMO_CASE_IDS.CASE_F.pocketId,
      bagCode: TRANSFER_BAG_DEMO_CASE_IDS.CASE_F.pocketNo,
      sewingTaskId: demoTask.sewingTaskId,
      sewingTaskNo: demoTask.sewingTaskNo,
      sewingFactoryId: demoTask.sewingFactoryId,
      sewingFactoryName: demoTask.sewingFactoryName,
      styleCode: demoTask.styleCode,
      spuCode: demoTask.spuCode,
      skuSummary: demoTask.skuSummary,
      colorSummary: demoTask.colorSummary,
      sizeSummary: demoTask.sizeSummary,
      usageStatus: 'PACKING',
      packedTicketCount: 1,
      packedOriginalCutOrderCount: 1,
      startedAt: '2026-03-25 10:20',
      finishedPackingAt: '',
      dispatchAt: '',
      dispatchBy: '',
      signoffStatus: 'PENDING',
      note: '开发环境验收：当前 usage 仍处于装袋中，用于验证 active usage 锁定与同款混装拦截。',
    }
    usages.push(demoUsage)
    masters[4].currentStatus = 'IN_USE'
    masters[4].latestUsageId = demoUsage.usageId
    masters[4].latestUsageNo = demoUsage.usageNo
    masters[4].currentLocation = '打印验收装袋工作台'
    bindings.push({
      bindingId: 'seed-binding-case-f-001',
      usageId: demoUsage.usageId,
      usageNo: demoUsage.usageNo,
      bagId: demoUsage.bagId,
      bagCode: demoUsage.bagCode,
      ticketRecordId: caseFLockedTicket.ticketRecordId,
      ticketNo: caseFLockedTicket.ticketNo,
      originalCutOrderId: caseFLockedTicket.originalCutOrderId,
      originalCutOrderNo: caseFLockedTicket.originalCutOrderNo,
      productionOrderNo: caseFLockedTicket.productionOrderNo,
      mergeBatchNo: caseFLockedTicket.mergeBatchNo,
      qty: caseFLockedTicket.qty,
      boundAt: '2026-03-25 10:25',
      boundBy: '交接员-演示',
      note: '开发环境验收：已绑定 active usage，打印模块中应显示不可作废。',
    })
    auditTrail.push(
      buildBagUsageAuditTrail({
        usageId: demoUsage.usageId,
        action: '创建 usage',
        actionAt: '2026-03-25 10:20',
        actionBy: '交接员-演示',
        note: `${demoUsage.bagCode} 已进入装袋中，用于验证 active usage 锁定。`,
      }),
      buildBagUsageAuditTrail({
        usageId: demoUsage.usageId,
        action: '绑定菲票',
        actionAt: '2026-03-25 10:25',
        actionBy: '交接员-演示',
        note: `${caseFLockedTicket.ticketNo} 已装入 ${demoUsage.bagCode}，当前不可作废。`,
      }),
    )
  }

  return {
    masters,
    usages,
    bindings,
    manifests,
    sewingTasks,
    auditTrail,
    returnReceipts,
    conditionRecords,
    reuseCycles,
    closureResults,
    returnAuditTrail,
  }
}

export function serializeTransferBagStorage(store: TransferBagStore): string {
  return JSON.stringify(store)
}

export function deserializeTransferBagStorage(raw: string | null): TransferBagStore {
  if (!raw) {
    return {
      masters: [],
      usages: [],
      bindings: [],
      manifests: [],
      sewingTasks: [],
      auditTrail: [],
      returnReceipts: [],
      conditionRecords: [],
      reuseCycles: [],
      closureResults: [],
      returnAuditTrail: [],
    }
  }

  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('invalid transfer bag ledger')
    }
    const usages = Array.isArray(parsed.usages) ? parsed.usages : []
    const usagesById = Object.fromEntries(usages.map((item) => [item.usageId, item]))
    const bindings = Array.isArray(parsed.bindings)
      ? parsed.bindings.map((binding) => ({
          ...binding,
          usageNo: binding.usageNo || usagesById[binding.usageId]?.usageNo || '',
        }))
      : []
    return {
      masters: Array.isArray(parsed.masters) ? parsed.masters : [],
      usages,
      bindings,
      manifests: Array.isArray(parsed.manifests) ? parsed.manifests : [],
      sewingTasks: Array.isArray(parsed.sewingTasks) ? parsed.sewingTasks : [],
      auditTrail: Array.isArray(parsed.auditTrail) ? parsed.auditTrail : [],
      returnReceipts: Array.isArray(parsed.returnReceipts) ? parsed.returnReceipts : [],
      conditionRecords: Array.isArray(parsed.conditionRecords) ? parsed.conditionRecords : [],
      reuseCycles: Array.isArray(parsed.reuseCycles) ? parsed.reuseCycles : [],
      closureResults: Array.isArray(parsed.closureResults) ? parsed.closureResults : [],
      returnAuditTrail: Array.isArray(parsed.returnAuditTrail) ? parsed.returnAuditTrail : [],
    }
  } catch {
    return {
      masters: [],
      usages: [],
      bindings: [],
      manifests: [],
      sewingTasks: [],
      auditTrail: [],
      returnReceipts: [],
      conditionRecords: [],
      reuseCycles: [],
      closureResults: [],
      returnAuditTrail: [],
    }
  }
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
  return JSON.stringify(ids)
}

export function mergeTransferBagStores(seed: TransferBagStore, stored: TransferBagStore): TransferBagStore {
  const mergeById = <T extends Record<string, unknown>>(seedItems: T[], storedItems: T[], idKey: keyof T): T[] => {
    const merged = new Map<string, T>()
    seedItems.forEach((item) => merged.set(String(item[idKey]), item))
    storedItems.forEach((item) => merged.set(String(item[idKey]), item))
    return Array.from(merged.values())
  }

  return {
    masters: mergeById(seed.masters, stored.masters, 'bagId'),
    usages: mergeById(seed.usages, stored.usages, 'usageId'),
    bindings: mergeById(seed.bindings, stored.bindings, 'bindingId'),
    manifests: mergeById(seed.manifests, stored.manifests, 'manifestId'),
    sewingTasks: mergeById(seed.sewingTasks, stored.sewingTasks, 'sewingTaskId'),
    auditTrail: mergeById(seed.auditTrail, stored.auditTrail, 'auditTrailId'),
    returnReceipts: mergeById(seed.returnReceipts, stored.returnReceipts, 'returnReceiptId'),
    conditionRecords: mergeById(seed.conditionRecords, stored.conditionRecords, 'conditionRecordId'),
    reuseCycles: mergeById(seed.reuseCycles, stored.reuseCycles, 'cycleSummaryId'),
    closureResults: mergeById(seed.closureResults, stored.closureResults, 'closureId'),
    returnAuditTrail: mergeById(seed.returnAuditTrail, stored.returnAuditTrail, 'auditTrailId'),
  }
}

export function buildTransferBagViewModel(options: {
  originalRows: OriginalCutOrderRow[]
  ticketRecords: FeiTicketLabelRecord[]
  mergeBatches: MergeBatchRecord[]
  store: TransferBagStore
}): TransferBagViewModel {
  void options.mergeBatches
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

  const usageItems: TransferBagUsageItem[] = options.store.usages
    .map((usage) => {
      const bindings = (bindingsByUsageIdRaw[usage.usageId] || []).slice().sort((left, right) => left.boundAt.localeCompare(right.boundAt, 'zh-CN'))
      const summary = buildTransferBagParentChildSummary(bindings)
      const manifests = (manifestsByUsageId[usage.usageId] || []).slice().sort((left, right) => right.createdAt.localeCompare(left.createdAt, 'zh-CN'))
      const bagMaster = options.store.masters.find((item) => item.bagId === usage.bagId) ?? null
      const pocketStatusKey = mapUsageStatusToPocketCarrierStatus({
        usage,
        masterStatus: bagMaster?.currentStatus || 'IDLE',
      })
      return {
        ...usage,
        statusMeta: deriveTransferBagUsageStatus(usage.usageStatus),
        pocketStatusKey,
        pocketStatusMeta: derivePocketCarrierStatus(pocketStatusKey),
        bagMaster,
        sewingTask: sewingTasksById[usage.sewingTaskId] ?? null,
        summary,
        bindingItems: [],
        boundTicketIds: bindings.map((item) => item.ticketRecordId),
        ticketNos: bindings.map((item) => item.ticketNo),
        originalCutOrderNos: uniqueStrings(bindings.map((item) => item.originalCutOrderNo)),
        productionOrderNos: uniqueStrings(bindings.map((item) => item.productionOrderNo)),
        mergeBatchNos: uniqueStrings(bindings.map((item) => item.mergeBatchNo)),
        latestManifest: manifests[0] ?? null,
        navigationPayload: buildTransferBagNavigationPayload({
          originalCutOrderNo: bindings[0]?.originalCutOrderNo,
          productionOrderNo: bindings[0]?.productionOrderNo,
          mergeBatchNo: bindings[0]?.mergeBatchNo || undefined,
          bagCode: usage.bagCode,
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
        latestUsageStatusMeta: latestUsage ? latestUsage.statusMeta : null,
        packedTicketCount: summary.ticketCount,
        packedOriginalCutOrderCount: summary.originalCutOrderCount,
        pocketStatusKey,
        pocketStatusMeta: derivePocketCarrierStatus(pocketStatusKey),
        currentUsage: usage,
        currentStyleCode: usage?.styleCode || '',
        currentTotalPieceCount: summary.quantityTotal,
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
    .map((binding) => ({
      ...binding,
      usage: usageItemsById[binding.usageId] ?? null,
      ticket: ticketCandidatesById[binding.ticketRecordId] ?? null,
      pocketStatusKey: mapUsageStatusToPocketCarrierStatus({
        usage: usagesByIdRaw[binding.usageId] ?? null,
        masterStatus: options.store.masters.find((item) => item.bagId === binding.bagId)?.currentStatus || 'IDLE',
      }),
      removable: ['DRAFT', 'PACKING'].includes(usagesByIdRaw[binding.usageId]?.usageStatus || ''),
      navigationPayload: buildTransferBagNavigationPayload({
        originalCutOrderNo: binding.originalCutOrderNo,
        productionOrderNo: binding.productionOrderNo,
        mergeBatchNo: binding.mergeBatchNo || undefined,
        bagCode: binding.bagCode,
        usageNo: usageItemsById[binding.usageId]?.usageNo,
        sewingTaskNo: usageItemsById[binding.usageId]?.sewingTaskNo,
      }),
    }))
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
      bagCount: masterItems.length,
      idleBagCount: masterItems.filter((item) => item.currentStatus === 'IDLE').length,
      inUseBagCount: masterItems.filter((item) => item.currentStatus === 'IN_USE').length,
      readyDispatchUsageCount: usageItems.filter((item) => item.usageStatus === 'READY_TO_DISPATCH').length,
      dispatchedUsageCount: usageItems.filter((item) => item.usageStatus === 'DISPATCHED').length,
      pendingSignoffCount: usageItems.filter((item) => item.usageStatus === 'PENDING_SIGNOFF').length,
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
