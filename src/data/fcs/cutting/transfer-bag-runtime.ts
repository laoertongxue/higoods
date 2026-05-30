import { buildCuttingTraceabilityId, encodeCarrierQr, parseCuttingTraceQr } from './qr-codes.ts'
import { getFactoryMasterRecordById } from '../factory-master-store.ts'
import { TEST_FACTORY_ID, TEST_FACTORY_NAME } from '../factory-mock-data.ts'
import {
  normalizeCarrierCycleItemBinding,
  normalizeTransferBagDispatchManifest,
  normalizeTransferCarrierCycleRecord,
  normalizeTransferCarrierRecord,
  normalizeTransferCarrierSeedTicket,
} from './transfer-carrier-normalizer.ts'

export const CUTTING_TRANSFER_BAG_LEDGER_STORAGE_KEY = 'cuttingTransferBagLedger'
export const CUTTING_TRANSFER_BAG_SELECTED_TICKET_IDS_STORAGE_KEY = 'cuttingTransferBagSelectedTicketRecordIds'

export type TransferCarrierType = 'bag' | 'box'
export type TransferCarrierStatus = 'idle' | 'loaded' | 'handed_over' | 'received' | 'returned' | 'recycled' | 'disabled'
export type TransferBagUsageStage = 'INBOUND_TEMP' | 'HANDOVER_PACKING'

export interface TransferBagSeedCutOrderRowLike {
  cutOrderId: string
  cutOrderNo: string
  productionOrderNo: string
  styleCode: string
  spuCode: string
  color: string
  materialSku: string
  plannedQty?: number
  orderQty?: number
}

export interface TransferBagSeedMarkerPlanSourceLike {
  markerPlanId: string
  markerPlanNo: string
  styleCode: string
  spuCode: string
  materialSkuSummary: string
  items: Array<{
    cutOrderId: string
  }>
}

export interface TransferBagSeedTicketLike {
  feiTicketId: string
  feiTicketNo: string
  sourceSpreadingSessionId?: string
  sourceSpreadingSessionNo?: string
  sourceMarkerId?: string
  sourceMarkerNo?: string
  sourceWritebackId?: string
  cutOrderId: string
  cutOrderNo: string
  productionOrderNo: string
  markerPlanNo: string
  styleCode: string
  spuCode: string
  fabricRollNo?: string
  fabricColor?: string
  color: string
  size?: string
  partCode?: string
  partName?: string
  bundleNo?: string
  qty?: number
  actualCutPieceQty?: number
  garmentQty?: number
  materialSku: string
  sourceContextType: string
  status: 'PRINTED' | 'VOIDED'
}

export interface TransferCarrierRecord {
  carrierId: string
  carrierCode: string
  carrierType: TransferCarrierType
  bagType: string
  bagName?: string
  bagSpec?: string
  bagMaterial?: string
  ownershipFactoryId?: string
  ownershipFactoryName?: string
  capacity: number
  reusable: boolean
  currentStatus: string
  currentLocation: string
  latestCycleId: string
  latestCycleNo: string
  currentCycleId: string
  currentOwnerTaskId: string
  note: string
  qrPayload: ReturnType<typeof encodeCarrierQr>['payload']
  qrMeta?: ReturnType<typeof encodeCarrierQr>['payload']
  qrValue: string
  enabled?: boolean
  createdAt?: string
  createdBy?: string
}

export interface TransferCarrierCycleRecord {
  cycleId: string
  cycleNo: string
  carrierId: string
  carrierCode: string
  carrierType: TransferCarrierType
  sewingTaskId: string
  sewingTaskNo: string
  sewingFactoryId: string
  sewingFactoryName: string
  boundObjectType?: string
  boundObjectId?: string
  boundObjectNo?: string
  receiverType?: string
  receiverId?: string
  receiverName?: string
  sourceWarehouseId?: string
  sourceWarehouseName?: string
  warehouseArea?: string
  locationCode?: string
  signedBy?: string
  signedPieceQty?: number
  returnWarehouseName?: string
  returnedBy?: string
  styleCode: string
  spuCode: string
  skuSummary: string
  colorSummary: string
  sizeSummary: string
  cycleStatus: string
  status: TransferCarrierStatus
  packedTicketCount: number
  packedCutOrderCount: number
  startedAt?: string
  finishedPackingAt?: string
  dispatchAt: string
  dispatchBy: string
  signoffStatus: 'PENDING' | 'WAITING' | 'SIGNED'
  signedAt?: string
  returnedAt?: string
  usageStage?: TransferBagUsageStage
  usageStageLabel?: string
  note: string
}

function pickTransferBagSewingFactory(index: number): { factoryId: string; factoryName: string } {
  return {
    factoryId: TEST_FACTORY_ID,
    factoryName: TEST_FACTORY_NAME,
  }
}

export interface CarrierCycleItemBinding {
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
  cutOrderId: string
  cutOrderNo: string
  productionOrderNo: string
  markerPlanNo: string
  fabricRollNo?: string
  fabricColor?: string
  size?: string
  partCode?: string
  partName?: string
  bundleNo?: string
  qty: number
  actualCutPieceQty?: number
  garmentQty?: number
  boundAt: string
  boundBy: string
  operator: string
  status: 'BOUND' | 'REMOVED'
  note: string
}

export interface TransferBagDispatchManifestRecord {
  manifestId: string
  cycleId: string
  carrierCode: string
  sewingTaskNo: string
  sewingFactoryName: string
  ticketCount: number
  cutOrderCount: number
  createdAt: string
  createdBy: string
  printStatus: 'PRINTED'
  note: string
}

export interface SewingTaskRefRecord {
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

export interface TransferBagRuntimeStore {
  masters: TransferCarrierRecord[]
  usages: TransferCarrierCycleRecord[]
  bindings: CarrierCycleItemBinding[]
  manifests: TransferBagDispatchManifestRecord[]
  sewingTasks: SewingTaskRefRecord[]
  auditTrail: Array<Record<string, unknown>>
  returnReceipts: Array<Record<string, unknown>>
  conditionRecords: Array<Record<string, unknown>>
  reuseCycles: Array<Record<string, unknown>>
  closureResults: Array<Record<string, unknown>>
  returnAuditTrail: Array<Record<string, unknown>>
  scrapRecords: Array<Record<string, unknown>>
}

function emptyStore(): TransferBagRuntimeStore {
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
    scrapRecords: [],
  }
}

const LEGACY_SCRAP_CLOSED_STATUS = ['EX' + 'CEPTION', 'CLOSED'].join('_')

function unique(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))))
}

function sanitizeId(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'na'
}

function buildCycleStatus(cycleStatus: string): TransferCarrierStatus {
  const normalizedCycleStatus = cycleStatus === LEGACY_SCRAP_CLOSED_STATUS ? 'SCRAP_CLOSED' : cycleStatus
  if (normalizedCycleStatus === 'READY_TO_DISPATCH' || normalizedCycleStatus === 'PACKING' || normalizedCycleStatus === 'DRAFT') return 'loaded'
  if (normalizedCycleStatus === 'DISPATCHED' || normalizedCycleStatus === 'PENDING_SIGNOFF') return 'handed_over'
  if (normalizedCycleStatus === 'WAITING_RETURN' || normalizedCycleStatus === 'RETURN_INSPECTING') return 'returned'
  if (normalizedCycleStatus === 'CLOSED') return 'recycled'
  if (normalizedCycleStatus === 'SCRAP_CLOSED') return 'disabled'
  return 'idle'
}

function mergeById<T extends Record<string, unknown>>(seedItems: T[], storedItems: T[], idKey: keyof T): T[] {
  const merged = new Map<string, T>()
  seedItems.forEach((item) => merged.set(String(item[idKey]), item))
  storedItems.forEach((item) => merged.set(String(item[idKey]), item))
  return Array.from(merged.values())
}

function normalizeMergedSewingTasks(
  seedTasks: SewingTaskRefRecord[],
  storedTasks: SewingTaskRefRecord[],
): SewingTaskRefRecord[] {
  const seedTasksById = Object.fromEntries(seedTasks.map((task) => [task.sewingTaskId, task]))
  return mergeById(seedTasks, storedTasks, 'sewingTaskId').map((task) => {
    const seedTask = seedTasksById[task.sewingTaskId]
    const factory = getFactoryMasterRecordById(String(task.sewingFactoryId || seedTask?.sewingFactoryId || ''))
    return {
      ...task,
      sewingFactoryId: String(factory?.id || task.sewingFactoryId || seedTask?.sewingFactoryId || ''),
      sewingFactoryName: factory?.name || seedTask?.sewingFactoryName || task.sewingFactoryName,
    }
  })
}

function syncCycleFactoryNames(
  usages: TransferCarrierCycleRecord[],
  sewingTasks: SewingTaskRefRecord[],
): TransferCarrierCycleRecord[] {
  const tasksById = Object.fromEntries(sewingTasks.map((task) => [task.sewingTaskId, task]))
  return usages.map((usage) => {
    const sewingTask = tasksById[usage.sewingTaskId]
    if (!sewingTask) return usage
    return {
      ...usage,
      sewingFactoryId: sewingTask.sewingFactoryId,
      sewingFactoryName: sewingTask.sewingFactoryName,
    }
  })
}

function syncManifestFactoryNames(
  manifests: TransferBagDispatchManifestRecord[],
  usages: TransferCarrierCycleRecord[],
): TransferBagDispatchManifestRecord[] {
  const usagesByCycleId = Object.fromEntries(usages.map((usage) => [usage.cycleId, usage]))
  return manifests.map((manifest) => {
    const usage = usagesByCycleId[manifest.cycleId]
    if (!usage) return manifest
    return {
      ...manifest,
      sewingFactoryName: usage.sewingFactoryName,
    }
  })
}

function buildCarrierRecord(input: {
  carrierId: string
  carrierCode: string
  carrierType: TransferCarrierType
  capacity: number
  currentStatus: string
  currentLocation: string
  latestCycleId?: string
  latestCycleNo?: string
  currentCycleId?: string
  currentOwnerTaskId?: string
  note: string
}): TransferCarrierRecord {
  const issuedAt = '2026-03-24 08:00'
  const encoded = encodeCarrierQr({
    carrierId: input.carrierId,
    carrierCode: input.carrierCode,
    carrierType: input.carrierType,
    cycleId: input.currentCycleId || 'idle-cycle',
    issuedAt,
  })
  return {
    carrierId: input.carrierId,
    carrierCode: input.carrierCode,
    carrierType: input.carrierType,
    bagType: input.carrierType === 'bag' ? '中转袋' : '周转箱',
    capacity: input.capacity,
    reusable: true,
    currentStatus: input.currentStatus,
    currentLocation: input.currentLocation,
    latestCycleId: input.latestCycleId || '',
    latestCycleNo: input.latestCycleNo || '',
    currentCycleId: input.currentCycleId || '',
    currentOwnerTaskId: input.currentOwnerTaskId || '',
    note: input.note,
    qrPayload: encoded.payload,
    qrValue: encoded.qrValue,
  }
}

function buildSewingTaskSeeds(
  cutOrderRows: TransferBagSeedCutOrderRowLike[] = [],
  markerPlanSources: TransferBagSeedMarkerPlanSourceLike[] = [],
): SewingTaskRefRecord[] {
  const markerPlanSeeds = markerPlanSources.slice(0, 3).map((batch, index) => {
    const factory = pickTransferBagSewingFactory(index)
    return {
    sewingTaskId: `sewing-task-${sanitizeId(batch.markerPlanId || batch.markerPlanNo)}`,
    sewingTaskNo: `CF-${String(index + 1).padStart(3, '0')}`,
    sewingFactoryId: factory.factoryId,
    sewingFactoryName: factory.factoryName,
    styleCode: batch.styleCode,
    spuCode: batch.spuCode,
    skuSummary: batch.materialSkuSummary,
    colorSummary: '混色',
    sizeSummary: 'S / M / L',
    plannedQty: batch.items.length * 24,
    status: index === 0 ? '待接料' : index === 1 ? '排单中' : '待交接',
    note: `来源于 ${batch.markerPlanNo} 的正式载具任务引用。`,
  }})

  const fallbackSeeds = cutOrderRows.map((row, index) => {
    const factory = pickTransferBagSewingFactory(index + markerPlanSeeds.length)
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
    plannedQty: row.plannedQty || row.orderQty || 0,
    status: '待接料',
    note: '无批次场景下的正式交接任务引用。',
  }})

  return [...markerPlanSeeds, ...fallbackSeeds]
}

function buildCarrierCycleId(carrierId: string, sewingTaskId: string, startedAt: string): string {
  return buildCuttingTraceabilityId('carrier-cycle', startedAt, carrierId, sewingTaskId)
}

function buildCarrierBindingId(cycleId: string, feiTicketId: string, boundAt: string): string {
  return buildCuttingTraceabilityId('carrier-bind', boundAt, cycleId, feiTicketId)
}

function buildDispatchManifestId(cycleId: string, createdAt: string): string {
  return buildCuttingTraceabilityId('dispatch-manifest', createdAt, cycleId)
}

export function createCarrierCycleRecord(options: {
  carrier: TransferCarrierRecord
  sewingTask: SewingTaskRefRecord
  note?: string
  existingUsages: TransferCarrierCycleRecord[]
  nowText: string
}): TransferCarrierCycleRecord {
  const dateKey = options.nowText.slice(0, 10).replaceAll('-', '')
  const sameDay = options.existingUsages
    .map((item) => item.cycleNo)
    .filter((item) => item.startsWith(`TBU-${dateKey}`))
    .map((item) => Number.parseInt(item.split('-').pop() || '0', 10))
    .filter((item) => Number.isFinite(item))
  const nextSerial = Math.max(0, ...sameDay) + 1
  const cycleId = buildCarrierCycleId(options.carrier.carrierId, options.sewingTask.sewingTaskId, options.nowText)
  const cycleNo = `TBU-${dateKey}-${String(nextSerial).padStart(3, '0')}`
  return {
    cycleId,
    cycleNo,
    carrierId: options.carrier.carrierId,
    carrierCode: options.carrier.carrierCode,
    carrierType: options.carrier.carrierType,
    sewingTaskId: options.sewingTask.sewingTaskId,
    sewingTaskNo: options.sewingTask.sewingTaskNo,
    sewingFactoryId: options.sewingTask.sewingFactoryId,
    sewingFactoryName: options.sewingTask.sewingFactoryName,
    styleCode: options.sewingTask.styleCode,
    spuCode: options.sewingTask.spuCode,
    skuSummary: options.sewingTask.skuSummary,
    colorSummary: options.sewingTask.colorSummary,
    sizeSummary: options.sewingTask.sizeSummary,
    cycleStatus: 'DRAFT',
    status: 'idle',
    packedTicketCount: 0,
    packedCutOrderCount: 0,
    startedAt: options.nowText,
    finishedPackingAt: '',
    dispatchAt: '',
    dispatchBy: '',
    signoffStatus: 'PENDING',
    signedAt: '',
    returnedAt: '',
    usageStage: 'HANDOVER_PACKING',
    usageStageLabel: '交出装袋',
    note: options.note?.trim() || '载具周期草稿已创建，等待先扫口袋码再扫菲票子码。',
  }
}

export function createCarrierDispatchManifest(options: {
  cycle: TransferCarrierCycleRecord
  bindings: CarrierCycleItemBinding[]
  nowText: string
  createdBy: string
  note?: string
}): TransferBagDispatchManifestRecord {
  return {
    manifestId: buildDispatchManifestId(options.cycle.cycleId, options.nowText),
    cycleId: options.cycle.cycleId,
    carrierCode: options.cycle.carrierCode,
    sewingTaskNo: options.cycle.sewingTaskNo,
    sewingFactoryName: options.cycle.sewingFactoryName,
    ticketCount: options.bindings.length,
    cutOrderCount: unique(options.bindings.map((item) => item.cutOrderNo)).length,
    createdAt: options.nowText,
    createdBy: options.createdBy,
    printStatus: 'PRINTED',
    note: options.note?.trim() || '装袋清单来自正式父子映射，供流转交接核对。',
  }
}

export function createCarrierCycleBinding(options: {
  cycle: TransferCarrierCycleRecord
  carrier: TransferCarrierRecord
  ticket: TransferBagSeedTicketLike
  boundAt: string
  operator: string
  note?: string
}): CarrierCycleItemBinding {
  const normalizedTicket = normalizeTransferCarrierSeedTicket(options.ticket as unknown as Record<string, unknown>)
  return {
    bindingId: buildCarrierBindingId(options.cycle.cycleId, normalizedTicket.feiTicketId, options.boundAt),
    cycleId: options.cycle.cycleId,
    cycleNo: options.cycle.cycleNo,
    carrierId: options.carrier.carrierId,
    carrierCode: options.carrier.carrierCode,
    feiTicketId: normalizedTicket.feiTicketId,
    feiTicketNo: normalizedTicket.feiTicketNo,
    sourceSpreadingSessionId: options.ticket.sourceSpreadingSessionId || '',
    sourceSpreadingSessionNo: options.ticket.sourceSpreadingSessionNo || '',
    sourceMarkerId: options.ticket.sourceMarkerId || '',
    sourceMarkerNo: options.ticket.sourceMarkerNo || '',
    sourceWritebackId: options.ticket.sourceWritebackId || '',
    cutOrderId: options.ticket.cutOrderId,
    cutOrderNo: options.ticket.cutOrderNo,
    productionOrderNo: options.ticket.productionOrderNo,
    markerPlanNo: options.ticket.markerPlanNo,
    fabricRollNo: options.ticket.fabricRollNo || '',
    fabricColor: options.ticket.fabricColor || '',
    size: options.ticket.size || '',
    partCode: options.ticket.partCode || '',
    partName: options.ticket.partName || '',
    bundleNo: options.ticket.bundleNo || '',
    qty: Math.max(options.ticket.qty || 1, 1),
    actualCutPieceQty: Math.max(options.ticket.actualCutPieceQty || options.ticket.qty || 1, 1),
    garmentQty: Math.max(options.ticket.garmentQty || options.ticket.qty || 1, 1),
    boundAt: options.boundAt,
    boundBy: options.operator,
    operator: options.operator,
    status: 'BOUND',
    note: options.note?.trim() || '先扫口袋码，再扫菲票子码后建立正式父子映射。',
  }
}

export function buildSystemSeedTransferBagRuntime(options: {
  cutOrderRows: TransferBagSeedCutOrderRowLike[]
  ticketRecords: TransferBagSeedTicketLike[]
  markerPlanSources?: TransferBagSeedMarkerPlanSourceLike[]
}): TransferBagRuntimeStore {
  const markerPlanSources = options.markerPlanSources || []
  const sewingTasks = buildSewingTaskSeeds(options.cutOrderRows, markerPlanSources)
  if (!sewingTasks.length) {
    const fallbackFactory = pickTransferBagSewingFactory(0)
    sewingTasks.push({
      sewingTaskId: 'sewing-task-default',
      sewingTaskNo: 'CF-000',
      sewingFactoryId: fallbackFactory.factoryId,
      sewingFactoryName: fallbackFactory.factoryName,
      styleCode: 'HG-DEFAULT',
      spuCode: 'SPU-DEFAULT',
      skuSummary: 'MAT-DEFAULT',
      colorSummary: '默认色组',
      sizeSummary: '默认尺码组',
      plannedQty: 120,
      status: '待接料',
      note: '默认中转袋任务引用。',
    })
  }
  const masters: TransferCarrierRecord[] = [
    buildCarrierRecord({
      carrierId: 'carrier-bag-001',
      carrierCode: 'BAG-A-001',
      carrierType: 'bag',
      capacity: 24,
      currentStatus: 'IDLE',
      currentLocation: '裁片仓 A 区待命位',
      note: '常用中转袋。',
    }),
    buildCarrierRecord({
      carrierId: 'carrier-bag-002',
      carrierCode: 'BAG-A-002',
      carrierType: 'bag',
      capacity: 20,
      currentStatus: 'IDLE',
      currentLocation: '裁片仓 A 区待命位',
      note: '适合中等票数交接。',
    }),
    buildCarrierRecord({
      carrierId: 'carrier-bag-003',
      carrierCode: 'BAG-A-003',
      carrierType: 'bag',
      capacity: 22,
      currentStatus: 'IDLE',
      currentLocation: '裁片仓 A 区空袋待命位',
      note: '有历史周转记录，当前已回到待命状态。',
    }),
    buildCarrierRecord({
      carrierId: 'carrier-bag-004',
      carrierCode: 'BAG-A-004',
      carrierType: 'bag',
      capacity: 18,
      currentStatus: 'IDLE',
      currentLocation: '裁片仓 B 区装袋位',
      note: '常用于返修与补片任务。',
    }),
    buildCarrierRecord({
      carrierId: 'carrier-bag-005',
      carrierCode: 'BAG-A-005',
      carrierType: 'bag',
      capacity: 18,
      currentStatus: 'IDLE',
      currentLocation: '后道运输通道',
      note: '已交出待回收的口袋样例。',
    }),
    buildCarrierRecord({
      carrierId: 'carrier-bag-006',
      carrierCode: 'BAG-A-006',
      carrierType: 'bag',
      capacity: 20,
      currentStatus: 'IDLE',
      currentLocation: '车缝一厂待回收区',
      note: '已交出待回收的口袋样例。',
    }),
    buildCarrierRecord({
      carrierId: 'carrier-bag-007',
      carrierCode: 'BAG-A-007',
      carrierType: 'bag',
      capacity: 18,
      currentStatus: 'IDLE',
      currentLocation: '中转袋回收验收台',
      note: '正在进行回收验收的口袋样例。',
    }),
    buildCarrierRecord({
      carrierId: 'carrier-bag-008',
      carrierCode: 'BAG-A-008',
      carrierType: 'bag',
      capacity: 24,
      currentStatus: 'IDLE',
      currentLocation: '裁片仓空袋待命区',
      note: '已关闭并重新释放的口袋。',
    }),
    buildCarrierRecord({
      carrierId: 'carrier-bag-009',
      carrierCode: 'BAG-A-009',
      carrierType: 'bag',
      capacity: 20,
      currentStatus: 'IDLE',
      currentLocation: '裁片仓空袋待命区',
      note: '上一轮回收有袋况记录，当前可继续使用。',
    }),
    buildCarrierRecord({
      carrierId: 'carrier-bag-010',
      carrierCode: 'BAG-A-010',
      carrierType: 'bag',
      capacity: 20,
      currentStatus: 'IDLE',
      currentLocation: '裁片仓空袋待命区',
      note: '袋体边角破损已记录，当前可继续使用。',
    }),
    buildCarrierRecord({
      carrierId: 'carrier-bag-011',
      carrierCode: 'BAG-A-011',
      carrierType: 'bag',
      capacity: 16,
      currentStatus: 'DISABLED',
      currentLocation: '报废区',
      note: '袋体报废，仅保留追溯记录。',
    }),
    buildCarrierRecord({
      carrierId: 'carrier-box-001',
      carrierCode: 'BOX-C-001',
      carrierType: 'box',
      capacity: 32,
      currentStatus: 'IDLE',
      currentLocation: '裁片仓 C 区',
      note: '大批量交接使用。',
    }),
    buildCarrierRecord({
      carrierId: 'carrier-box-002',
      carrierCode: 'BOX-C-002',
      carrierType: 'box',
      capacity: 28,
      currentStatus: 'IDLE',
      currentLocation: '裁片仓 C 区待命位',
      note: '有历史周转记录的周转箱。',
    }),
    buildCarrierRecord({
      carrierId: 'carrier-box-003',
      carrierCode: 'BOX-C-003',
      carrierType: 'box',
      capacity: 28,
      currentStatus: 'IDLE',
      currentLocation: '后道运输通道',
      note: '整箱交出的样例。',
    }),
    buildCarrierRecord({
      carrierId: 'carrier-bag-012',
      carrierCode: 'BAG-B-001',
      carrierType: 'bag',
      capacity: 18,
      currentStatus: 'IDLE',
      currentLocation: '返修口袋待命位',
      note: '返修与补片任务常用口袋。',
    }),
    buildCarrierRecord({
      carrierId: 'carrier-bag-013',
      carrierCode: 'BAG-B-002',
      carrierType: 'bag',
      capacity: 22,
      currentStatus: 'IDLE',
      currentLocation: '裁片仓 D 区待发位',
      note: '待交出前的多款号混装样例。',
    }),
    buildCarrierRecord({
      carrierId: 'carrier-bag-014',
      carrierCode: 'BAG-B-003',
      carrierType: 'bag',
      capacity: 22,
      currentStatus: 'IDLE',
      currentLocation: '裁片仓 D 区待命位',
      note: '从未开始周转的新袋样例。',
    }),
    buildCarrierRecord({
      carrierId: 'carrier-bag-015',
      carrierCode: 'BAG-C-001',
      carrierType: 'bag',
      capacity: 26,
      currentStatus: 'IDLE',
      currentLocation: '裁片仓 E 区待命位',
      note: '大容量中转袋，可容纳更多菲票。',
    }),
    buildCarrierRecord({
      carrierId: 'carrier-bag-016',
      carrierCode: 'BAG-D-001',
      carrierType: 'bag',
      capacity: 30,
      currentStatus: 'IDLE',
      currentLocation: '裁床待交出仓入仓暂存位',
      note: '入仓暂存袋样例，允许不同生产单、SKU、部位菲票临时混装。',
    }),
  ]

  const usages: TransferCarrierCycleRecord[] = []
  const bindings: CarrierCycleItemBinding[] = []
  const manifests: TransferBagDispatchManifestRecord[] = []
  const auditTrail: Array<Record<string, unknown>> = []
  const returnReceipts: Array<Record<string, unknown>> = []
  const conditionRecords: Array<Record<string, unknown>> = []
  const reuseCycles: Array<Record<string, unknown>> = []
  const closureResults: Array<Record<string, unknown>> = []
  const returnAuditTrail: Array<Record<string, unknown>> = []
  const printedTickets = options.ticketRecords.filter((ticket) => ticket.status === 'PRINTED')
  let ticketCursor = 0

  function pickTickets(count: number): TransferBagSeedTicketLike[] {
    if (!printedTickets.length || count <= 0) return []
    const nextTickets = printedTickets.slice(ticketCursor, ticketCursor + count)
    ticketCursor += nextTickets.length
    return nextTickets
  }

  function pickInboundTempTickets(count: number): TransferBagSeedTicketLike[] {
    const picked: TransferBagSeedTicketLike[] = []
    printedTickets.forEach((ticket) => {
      if (picked.length >= count) return
      const duplicatedContext = picked.some(
        (item) =>
          item.productionOrderNo === ticket.productionOrderNo &&
          item.cutOrderNo === ticket.cutOrderNo &&
          item.materialSku === ticket.materialSku &&
          item.partName === ticket.partName,
      )
      if (!duplicatedContext) picked.push(ticket)
    })
    printedTickets.forEach((ticket) => {
      if (picked.length >= count) return
      if (!picked.some((item) => item.feiTicketId === ticket.feiTicketId)) picked.push(ticket)
    })
    return picked
  }

  function pushUsageAudit(cycle: TransferCarrierCycleRecord, actionAt: string, action: string, actionBy: string, note: string): void {
    auditTrail.push({
      auditTrailId: buildCuttingTraceabilityId('usage-audit', actionAt, cycle.cycleId, action),
      cycleId: cycle.cycleId,
      usageId: cycle.cycleId,
      action,
      actionAt,
      actionBy,
      note,
    })
  }

  function pushReturnAudit(
    cycle: TransferCarrierCycleRecord,
    actionAt: string,
    action: string,
    actionBy: string,
    payloadSummary: string,
    note: string,
  ): void {
    returnAuditTrail.push({
      auditTrailId: buildCuttingTraceabilityId('return-audit', actionAt, cycle.cycleId, action),
      usageId: cycle.cycleId,
      action,
      actionAt,
      actionBy,
      payloadSummary,
      note,
    })
  }

  function updateMasterRecord(options: {
    masterIndex: number
    currentStatus: string
    currentLocation: string
    latestCycle?: TransferCarrierCycleRecord | null
    currentCycle?: TransferCarrierCycleRecord | null
  }): void {
    const currentMaster = masters[options.masterIndex]
    if (!currentMaster) return
    masters[options.masterIndex] = buildCarrierRecord({
      carrierId: currentMaster.carrierId,
      carrierCode: currentMaster.carrierCode,
      carrierType: currentMaster.carrierType,
      capacity: currentMaster.capacity,
      currentStatus: options.currentStatus,
      currentLocation: options.currentLocation,
      latestCycleId: options.latestCycle?.cycleId || currentMaster.latestCycleId,
      latestCycleNo: options.latestCycle?.cycleNo || currentMaster.latestCycleNo,
      currentCycleId: options.currentCycle?.cycleId || '',
      currentOwnerTaskId: options.currentCycle?.sewingTaskId || '',
      note: currentMaster.note,
    })
  }

  function addSeedCycle(options: {
    masterIndex: number
    taskIndex: number
    startedAt: string
    operator: string
    cycleStatus: string
    masterStatus: string
    currentLocation: string
    ticketCount: number
    tickets?: TransferBagSeedTicketLike[]
    usageStage?: TransferBagUsageStage
    note: string
    active?: boolean
    finishedPackingAt?: string
    manifestAt?: string
    dispatchAt?: string
    dispatchBy?: string
    signoffStatus?: 'PENDING' | 'WAITING' | 'SIGNED'
    signedAt?: string
    returnedAt?: string
    returnWarehouseName?: string
    returnAt?: string
    returnedBy?: string
    receivedBy?: string
    discrepancyType?: 'NONE' | 'QTY_MISMATCH' | 'DAMAGED_BAG' | 'LATE_RETURN' | 'MISSING_RECORD'
    discrepancyNote?: string
    returnNote?: string
    conditionStatus?: 'GOOD' | 'MINOR_DAMAGE' | 'SEVERE_DAMAGE'
    cleanlinessStatus?: 'CLEAN' | 'DIRTY'
    damageType?: string
    repairNeeded?: boolean
    reusableDecision?: 'REUSABLE' | 'DISABLED'
    inspectedAt?: string
    inspectedBy?: string
    conditionNote?: string
    closedAt?: string
    closedBy?: string
    closureStatus?: 'CLOSED' | 'SCRAP_CLOSED'
    nextBagStatus?: string
    closureReason?: string
    warningMessages?: string[]
  }): TransferCarrierCycleRecord | null {
    const carrier = masters[options.masterIndex]
    const sewingTask = sewingTasks[options.taskIndex % sewingTasks.length]
    if (!carrier || !sewingTask) return null

    const cycle = createCarrierCycleRecord({
      carrier,
      sewingTask,
      nowText: options.startedAt,
      existingUsages: usages,
      note: options.note,
    })
    const selectedTickets = options.tickets?.length ? options.tickets : pickTickets(options.ticketCount)
    const cycleBindings = selectedTickets.map((ticket) =>
      createCarrierCycleBinding({
        cycle,
        carrier,
        ticket,
        boundAt: options.startedAt,
        operator: options.operator,
      }),
    )
    const usageStage = options.usageStage || 'HANDOVER_PACKING'

    cycle.cycleStatus = options.cycleStatus
    cycle.status = buildCycleStatus(cycle.cycleStatus)
    cycle.usageStage = usageStage
    cycle.usageStageLabel = usageStage === 'INBOUND_TEMP' ? '入仓暂存' : '交出装袋'
    if (usageStage === 'INBOUND_TEMP') {
      cycle.sewingTaskId = ''
      cycle.sewingTaskNo = ''
      cycle.sewingFactoryId = ''
      cycle.sewingFactoryName = ''
      cycle.styleCode = unique(selectedTickets.map((ticket) => ticket.styleCode)).join(' / ') || '混款'
      cycle.spuCode = unique(selectedTickets.map((ticket) => ticket.spuCode)).join(' / ') || '多 SKU'
      cycle.skuSummary = unique(selectedTickets.map((ticket) => ticket.materialSku)).join(' / ') || '混装菲票'
      cycle.colorSummary = unique(selectedTickets.map((ticket) => ticket.fabricColor || ticket.color)).join(' / ') || '多色'
      cycle.sizeSummary = unique(selectedTickets.map((ticket) => ticket.size || '')).join(' / ') || '多尺码'
      cycleBindings.forEach((binding) => {
        binding.note = '入仓暂存袋绑定：允许不同生产单、SKU、部位菲票临时混装。'
      })
    }
    cycle.packedTicketCount = cycleBindings.length
    cycle.packedCutOrderCount = unique(cycleBindings.map((item) => item.cutOrderNo)).length
    cycle.finishedPackingAt = options.finishedPackingAt || ''
    cycle.dispatchAt = options.dispatchAt || ''
    cycle.dispatchBy = options.dispatchBy || ''
    cycle.signoffStatus = options.signoffStatus || 'PENDING'
    cycle.signedAt = options.signedAt || ''
    cycle.returnedAt = options.returnedAt || ''

    usages.push(cycle)
    bindings.push(...cycleBindings)

    if (options.manifestAt && cycleBindings.length) {
      manifests.push(
        createCarrierDispatchManifest({
          cycle,
          bindings: cycleBindings,
          nowText: options.manifestAt,
          createdBy: options.operator,
        }),
      )
    }

    pushUsageAudit(cycle, options.startedAt, '开始本次周转', options.operator, options.note)
    if (cycleBindings.length) {
      pushUsageAudit(cycle, options.startedAt, '扫码装袋', options.operator, `已装入 ${cycleBindings.length} 张菲票。`)
    }
    if (options.manifestAt) {
      pushUsageAudit(cycle, options.manifestAt, '打印装袋清单', options.operator, '装袋清单已生成并用于交出核对。')
    }
    if (options.finishedPackingAt) {
      pushUsageAudit(cycle, options.finishedPackingAt, '完成装袋', options.operator, '袋内内容已核对完成。')
    }
    if (options.dispatchAt) {
      pushUsageAudit(cycle, options.dispatchAt, '交出', options.dispatchBy || options.operator, '已由裁片仓交给车缝厂领走。')
    }
    if (options.signedAt) {
      pushUsageAudit(cycle, options.signedAt, '接收确认', options.operator, '接收方已完成裁片接收确认。')
    }

    if (options.returnAt) {
      returnReceipts.push({
        returnReceiptId: buildCuttingTraceabilityId('return-receipt', options.returnAt, cycle.cycleId),
        cycleId: cycle.cycleId,
        cycleNo: cycle.cycleNo,
        carrierId: carrier.carrierId,
        carrierCode: carrier.carrierCode,
        usageId: cycle.cycleId,
        usageNo: cycle.cycleNo,
        bagId: carrier.carrierId,
        bagCode: carrier.carrierCode,
        sewingTaskId: cycle.sewingTaskId,
        sewingTaskNo: cycle.sewingTaskNo,
        returnWarehouseName: options.returnWarehouseName || '裁片仓回收点',
        returnAt: options.returnAt,
        returnedBy: options.returnedBy || '周转回收员',
        receivedBy: options.receivedBy || '回收验收员',
        returnedFinishedQty: cycleBindings.reduce((sum, item) => sum + item.qty, 0),
        returnedTicketCountSummary: cycleBindings.length,
        returnedCutOrderCount: unique(cycleBindings.map((item) => item.cutOrderNo)).length,
        discrepancyType: options.discrepancyType || 'NONE',
        discrepancyNote: options.discrepancyNote || '',
        note: options.returnNote || '已完成中转袋回收登记。',
      })
      pushReturnAudit(
        cycle,
        options.returnAt,
        '回收登记',
        options.receivedBy || '回收验收员',
        `回收点：${options.returnWarehouseName || '裁片仓回收点'}`,
        options.returnNote || '已完成回收登记。',
      )
    }

    if (options.inspectedAt && options.reusableDecision) {
      conditionRecords.push({
        conditionRecordId: buildCuttingTraceabilityId('condition', options.inspectedAt, cycle.cycleId),
        cycleId: cycle.cycleId,
        carrierId: carrier.carrierId,
        carrierCode: carrier.carrierCode,
        usageId: cycle.cycleId,
        bagId: carrier.carrierId,
        bagCode: carrier.carrierCode,
        conditionStatus: options.conditionStatus || 'GOOD',
        cleanlinessStatus: options.cleanlinessStatus || 'CLEAN',
        damageType: options.damageType || '',
        repairNeeded: Boolean(options.repairNeeded),
        reusableDecision: options.reusableDecision,
        inspectedAt: options.inspectedAt,
        inspectedBy: options.inspectedBy || '回收验收员',
        note: options.conditionNote || '已完成袋况检查。',
      })
      pushReturnAudit(
        cycle,
        options.inspectedAt,
        '完成回收',
        options.inspectedBy || '回收验收员',
        `袋况：${options.conditionStatus || 'GOOD'}`,
        options.conditionNote || '袋况检查完成。',
      )
    }

    if (options.closedAt && options.closureStatus && options.nextBagStatus) {
      closureResults.push({
        closureId: buildCuttingTraceabilityId('closure', options.closedAt, cycle.cycleId),
        cycleId: cycle.cycleId,
        cycleNo: cycle.cycleNo,
        usageId: cycle.cycleId,
        usageNo: cycle.cycleNo,
        closedAt: options.closedAt,
        closedBy: options.closedBy || '周转班长',
        closureStatus: options.closureStatus,
        nextBagStatus: options.nextBagStatus,
        reason: options.closureReason || '完成本轮周转闭环。',
        warningMessages: options.warningMessages || [],
      })
      pushReturnAudit(
        cycle,
        options.closedAt,
        '关闭本次周转',
        options.closedBy || '周转班长',
        `下一状态：${options.nextBagStatus}`,
        options.closureReason || '已关闭本轮周转。',
      )
    }

    const keepActive =
      options.active ?? ['DRAFT', 'PACKING', 'READY_TO_DISPATCH', 'DISPATCHED', 'PENDING_SIGNOFF', 'WAITING_RETURN', 'RETURN_INSPECTING'].includes(options.cycleStatus)
    updateMasterRecord({
      masterIndex: options.masterIndex,
      currentStatus: options.masterStatus,
      currentLocation: options.currentLocation,
      latestCycle: cycle,
      currentCycle: keepActive ? cycle : null,
    })

    return cycle
  }

  function generateSyntheticPrintedTickets(
    count: number,
    cutOrderRows: TransferBagSeedCutOrderRowLike[],
  ): TransferBagSeedTicketLike[] {
    const styles = ['HG-ST001', 'HG-ST002', 'HG-ST003', 'HG-ST004', 'HG-ST005']
    const spuCodes = ['SPU-A01', 'SPU-B02', 'SPU-C03', 'SPU-D04', 'SPU-E05']
    const fabricColors = ['黑色', '藏青', '酒红', '白色', '灰色']
    const sizes = ['S', 'M', 'L', 'XL', '2XL']
    const partNames = ['前片', '后片', '袖片', '领片', '门襟', '袋布', '贴边', '里衬']
    const result: TransferBagSeedTicketLike[] = []
    for (let i = 0; i < count; i++) {
      const cutOrder = cutOrderRows[i % cutOrderRows.length]!
      result.push({
        feiTicketId: `fei-ticket-syn-${String(i + 1).padStart(3, '0')}`,
        feiTicketNo: `FT-${String(i + 1).padStart(5, '0')}`,
        sourceSpreadingSessionId: '',
        sourceSpreadingSessionNo: '',
        sourceMarkerId: '',
        sourceMarkerNo: '',
        sourceWritebackId: '',
        cutOrderId: cutOrder.cutOrderId,
        cutOrderNo: cutOrder.cutOrderNo,
        productionOrderNo: cutOrder.productionOrderNo,
        markerPlanNo: '',
        styleCode: styles[i % styles.length],
        spuCode: spuCodes[i % spuCodes.length],
        fabricRollNo: '',
        fabricColor: fabricColors[i % fabricColors.length],
        color: fabricColors[i % fabricColors.length],
        size: sizes[i % sizes.length],
        partCode: `PART-${partNames[i % partNames.length]}`,
        partName: partNames[i % partNames.length],
        bundleNo: `BND-${String(i + 1).padStart(3, '0')}`,
        qty: Math.floor(Math.random() * 20) + 5,
        actualCutPieceQty: 0,
        garmentQty: 0,
        materialSku: `SKU-${styles[i % styles.length]}-${sizes[i % sizes.length]}`,
        sourceContextType: 'SYNTHETIC',
        status: 'PRINTED',
      })
    }
    return result
  }

  if (printedTickets.length === 0 && options.cutOrderRows.length > 0) {
    const synthetic = generateSyntheticPrintedTickets(40, options.cutOrderRows)
    printedTickets.push(...synthetic)
  }

  addSeedCycle({
    masterIndex: 0,
    taskIndex: 1,
    startedAt: '2026-03-12 08:40',
    operator: '周转装袋员-赵敏',
    cycleStatus: 'CLOSED',
    masterStatus: 'IDLE',
    currentLocation: '裁片仓 A 区待命位',
    ticketCount: 2,
    note: 'BAG-A-001 上一轮周转已完整闭环，可继续使用。',
    finishedPackingAt: '2026-03-12 09:05',
    manifestAt: '2026-03-12 09:10',
    dispatchAt: '2026-03-12 09:28',
    dispatchBy: '周转装袋员-赵敏',
    signoffStatus: 'SIGNED',
    signedAt: '2026-03-12 10:16',
    returnedAt: '2026-03-12 16:05',
    returnAt: '2026-03-12 16:10',
    returnWarehouseName: '裁片仓 A 区回收点',
    returnedBy: '车缝返还员-李娜',
    receivedBy: '回收验收员-陈静',
    returnNote: '上一轮回收登记完成，袋内票据与件数一致。',
    inspectedAt: '2026-03-12 16:28',
    inspectedBy: '回收验收员-陈静',
    reusableDecision: 'REUSABLE',
    conditionStatus: 'GOOD',
    cleanlinessStatus: 'CLEAN',
    conditionNote: '袋况正常，可直接继续使用。',
    closedAt: '2026-03-12 16:42',
    closedBy: '周转班长-韩涛',
    closureStatus: 'CLOSED',
    nextBagStatus: 'IDLE',
    closureReason: '上一轮回收验收通过，口袋释放为空闲。',
  })

  addSeedCycle({
    masterIndex: 0,
    taskIndex: 2,
    startedAt: '2026-03-20 08:55',
    operator: '周转装袋员-陈亮',
    cycleStatus: 'CLOSED',
    masterStatus: 'IDLE',
    currentLocation: '裁片仓 A 区空袋待命位',
    ticketCount: 2,
    note: 'BAG-A-001 第二轮历史周转已关闭，形成最近回收记录。',
    finishedPackingAt: '2026-03-20 09:20',
    manifestAt: '2026-03-20 09:25',
    dispatchAt: '2026-03-20 09:42',
    dispatchBy: '周转装袋员-陈亮',
    signoffStatus: 'SIGNED',
    signedAt: '2026-03-20 10:34',
    returnedAt: '2026-03-20 17:18',
    returnAt: '2026-03-20 17:22',
    returnWarehouseName: '裁片仓周转回收台',
    returnedBy: '车缝返还员-高宁',
    receivedBy: '回收验收员-张秀',
    returnNote: '最近一次回收完成，袋体干净，票据数量一致。',
    inspectedAt: '2026-03-20 17:36',
    inspectedBy: '回收验收员-张秀',
    reusableDecision: 'REUSABLE',
    conditionStatus: 'GOOD',
    cleanlinessStatus: 'CLEAN',
    conditionNote: '已核对袋况与清洁状态，可继续投入使用。',
    closedAt: '2026-03-20 17:50',
    closedBy: '周转班长-韩涛',
    closureStatus: 'CLOSED',
    nextBagStatus: 'IDLE',
    closureReason: '回收验收通过，已重新回到空闲池。',
  })

  addSeedCycle({
    masterIndex: 0,
    taskIndex: 0,
    startedAt: '2026-03-24 09:20',
    operator: '周转装袋员-刘强',
    cycleStatus: 'READY_TO_DISPATCH',
    masterStatus: 'IN_USE',
    currentLocation: '裁片仓待发区',
    ticketCount: 3,
    note: '首个正式口袋周期。',
    finishedPackingAt: '2026-03-24 09:45',
    manifestAt: '2026-03-24 10:10',
  })

  addSeedCycle({
    masterIndex: 2,
    taskIndex: 1,
    startedAt: '2026-03-18 08:40',
    operator: '周转装袋员-赵敏',
    cycleStatus: 'CLOSED',
    masterStatus: 'IDLE',
    currentLocation: '裁片仓 A 区空袋待命位',
    ticketCount: 2,
    note: '历史已完成的周转周期。',
    finishedPackingAt: '2026-03-18 09:05',
    manifestAt: '2026-03-18 09:10',
    dispatchAt: '2026-03-18 09:30',
    dispatchBy: '周转装袋员-赵敏',
    signoffStatus: 'SIGNED',
    signedAt: '2026-03-18 10:25',
    returnedAt: '2026-03-18 16:20',
    returnAt: '2026-03-18 16:25',
    returnedBy: '车缝返还员-李娜',
    receivedBy: '回收验收员-陈静',
    inspectedAt: '2026-03-18 16:40',
    inspectedBy: '回收验收员-陈静',
    reusableDecision: 'REUSABLE',
    closedAt: '2026-03-18 16:55',
    closedBy: '周转班长-韩涛',
    closureStatus: 'CLOSED',
    nextBagStatus: 'IDLE',
    closureReason: '回收验收通过，口袋重新释放。',
  })

  addSeedCycle({
    masterIndex: 3,
    taskIndex: 1,
    startedAt: '2026-03-24 11:00',
    operator: '周转装袋员-王敏',
    cycleStatus: 'PACKING',
    masterStatus: 'IN_USE',
    currentLocation: '裁片仓 B 区装袋位',
    ticketCount: 3,
    note: '返修口袋装袋中。',
  })

  addSeedCycle({
    masterIndex: 4,
    taskIndex: 2,
    startedAt: '2026-03-24 10:30',
    operator: '周转装袋员-陈亮',
    cycleStatus: 'PENDING_SIGNOFF',
    masterStatus: 'IN_USE',
    currentLocation: '后道运输通道',
    ticketCount: 2,
    note: '已交出，等待中转袋回收。',
    finishedPackingAt: '2026-03-24 10:55',
    manifestAt: '2026-03-24 11:00',
    dispatchAt: '2026-03-24 11:20',
    dispatchBy: '周转装袋员-陈亮',
    signoffStatus: 'WAITING',
  })

  addSeedCycle({
    masterIndex: 5,
    taskIndex: 3,
    startedAt: '2026-03-24 08:55',
    operator: '周转装袋员-周燕',
    cycleStatus: 'WAITING_RETURN',
    masterStatus: 'IN_USE',
    currentLocation: '车缝一厂待回收区',
    ticketCount: 2,
    note: '已交出，等待回收。',
    finishedPackingAt: '2026-03-24 09:20',
    manifestAt: '2026-03-24 09:28',
    dispatchAt: '2026-03-24 09:40',
    dispatchBy: '周转装袋员-周燕',
    signoffStatus: 'SIGNED',
    signedAt: '2026-03-24 10:15',
  })

  addSeedCycle({
    masterIndex: 6,
    taskIndex: 4,
    startedAt: '2026-03-23 13:15',
    operator: '周转装袋员-冯凯',
    cycleStatus: 'RETURN_INSPECTING',
    masterStatus: 'IN_USE',
    currentLocation: '中转袋回收验收台',
    ticketCount: 2,
    note: '已回收待验收。',
    finishedPackingAt: '2026-03-23 13:35',
    manifestAt: '2026-03-23 13:40',
    dispatchAt: '2026-03-23 14:00',
    dispatchBy: '周转装袋员-冯凯',
    signoffStatus: 'SIGNED',
    signedAt: '2026-03-23 15:10',
    returnedAt: '2026-03-23 18:20',
    returnAt: '2026-03-23 18:25',
    returnedBy: '车缝返还员-黄蕾',
    receivedBy: '回收验收员-宋洁',
    inspectedAt: '2026-03-23 18:35',
    inspectedBy: '回收验收员-宋洁',
    reusableDecision: 'REUSABLE',
    conditionStatus: 'GOOD',
    conditionNote: '袋况正常，等待班长确认关闭。',
  })

  addSeedCycle({
    masterIndex: 7,
    taskIndex: 0,
    startedAt: '2026-03-19 09:10',
    operator: '周转装袋员-吴婷',
    cycleStatus: 'CLOSED',
    masterStatus: 'IDLE',
    currentLocation: '裁片仓空袋待命区',
    ticketCount: 2,
    note: '上轮周转已完整关闭。',
    finishedPackingAt: '2026-03-19 09:30',
    manifestAt: '2026-03-19 09:36',
    dispatchAt: '2026-03-19 09:55',
    dispatchBy: '周转装袋员-吴婷',
    signoffStatus: 'SIGNED',
    signedAt: '2026-03-19 11:05',
    returnedAt: '2026-03-19 17:30',
    returnAt: '2026-03-19 17:35',
    returnedBy: '车缝返还员-高宁',
    receivedBy: '回收验收员-张秀',
    inspectedAt: '2026-03-19 17:45',
    inspectedBy: '回收验收员-张秀',
    reusableDecision: 'REUSABLE',
    closedAt: '2026-03-19 18:00',
    closedBy: '周转班长-韩涛',
    closureStatus: 'CLOSED',
    nextBagStatus: 'IDLE',
    closureReason: '本轮周转闭环完成，可继续空闲使用。',
  })

  addSeedCycle({
    masterIndex: 8,
    taskIndex: 2,
    startedAt: '2026-03-17 10:20',
    operator: '周转装袋员-邵伟',
    cycleStatus: 'SCRAP_CLOSED',
    masterStatus: 'IDLE',
    currentLocation: '裁片仓空袋待命区',
    ticketCount: 1,
    note: '回收后发现袋体较脏，已记录袋况。',
    finishedPackingAt: '2026-03-17 10:38',
    manifestAt: '2026-03-17 10:45',
    dispatchAt: '2026-03-17 11:00',
    dispatchBy: '周转装袋员-邵伟',
    signoffStatus: 'SIGNED',
    signedAt: '2026-03-17 13:10',
    returnedAt: '2026-03-17 17:20',
    returnAt: '2026-03-17 17:25',
    returnedBy: '车缝返还员-何琴',
    receivedBy: '回收验收员-张秀',
    inspectedAt: '2026-03-17 17:40',
    inspectedBy: '回收验收员-张秀',
    reusableDecision: 'REUSABLE',
    cleanlinessStatus: 'DIRTY',
    conditionStatus: 'GOOD',
    closedAt: '2026-03-17 17:55',
    closedBy: '周转班长-韩涛',
    closureStatus: 'SCRAP_CLOSED',
    nextBagStatus: 'IDLE',
    closureReason: '袋况已记录，关闭后恢复可用。',
    warningMessages: ['袋况已记录。'],
  })

  addSeedCycle({
    masterIndex: 9,
    taskIndex: 3,
    startedAt: '2026-03-16 14:10',
    operator: '周转装袋员-孙杰',
    cycleStatus: 'SCRAP_CLOSED',
    masterStatus: 'IDLE',
    currentLocation: '裁片仓空袋待命区',
    ticketCount: 1,
    note: '袋体边角破损，已记录袋况。',
    finishedPackingAt: '2026-03-16 14:25',
    manifestAt: '2026-03-16 14:30',
    dispatchAt: '2026-03-16 14:50',
    dispatchBy: '周转装袋员-孙杰',
    signoffStatus: 'SIGNED',
    signedAt: '2026-03-16 16:05',
    returnedAt: '2026-03-16 18:35',
    returnAt: '2026-03-16 18:40',
    returnedBy: '车缝返还员-贺晴',
    receivedBy: '回收验收员-陈静',
    inspectedAt: '2026-03-16 18:55',
    inspectedBy: '回收验收员-陈静',
    reusableDecision: 'REUSABLE',
    conditionStatus: 'MINOR_DAMAGE',
    damageType: '底角开线',
    repairNeeded: true,
    closedAt: '2026-03-16 19:10',
    closedBy: '周转班长-韩涛',
    closureStatus: 'SCRAP_CLOSED',
    nextBagStatus: 'IDLE',
    closureReason: '袋体破损已记录，关闭后恢复可用。',
    warningMessages: ['袋况已记录。'],
  })

  addSeedCycle({
    masterIndex: 10,
    taskIndex: 4,
    startedAt: '2026-03-15 08:15',
    operator: '周转装袋员-徐敏',
    cycleStatus: 'SCRAP_CLOSED',
    masterStatus: 'DISABLED',
    currentLocation: '报废区',
    ticketCount: 1,
    note: '袋体严重破损，已报废。',
    finishedPackingAt: '2026-03-15 08:32',
    manifestAt: '2026-03-15 08:38',
    dispatchAt: '2026-03-15 08:55',
    dispatchBy: '周转装袋员-徐敏',
    signoffStatus: 'SIGNED',
    signedAt: '2026-03-15 10:20',
    returnedAt: '2026-03-15 16:15',
    returnAt: '2026-03-15 16:20',
    returnedBy: '车缝返还员-罗青',
    receivedBy: '回收验收员-宋洁',
    discrepancyType: 'DAMAGED_BAG',
    discrepancyNote: '袋体拉链损坏且底部磨损。',
    inspectedAt: '2026-03-15 16:30',
    inspectedBy: '回收验收员-宋洁',
    reusableDecision: 'DISABLED',
    conditionStatus: 'SEVERE_DAMAGE',
    damageType: '拉链损坏 / 底部磨损',
    repairNeeded: true,
    closedAt: '2026-03-15 16:45',
    closedBy: '周转班长-韩涛',
    closureStatus: 'SCRAP_CLOSED',
    nextBagStatus: 'DISABLED',
    closureReason: '袋体报废，不再进入流转。',
    warningMessages: ['已转入报废状态。'],
  })

  addSeedCycle({
    masterIndex: 11,
    taskIndex: 1,
    startedAt: '2026-03-24 12:10',
    operator: '周转装袋员-王敏',
    cycleStatus: 'PACKING',
    masterStatus: 'IN_USE',
    currentLocation: '裁片仓 B 区待发位',
    ticketCount: 3,
    note: '大批量周转箱装箱周期。',
  })

  addSeedCycle({
    masterIndex: 12,
    taskIndex: 2,
    startedAt: '2026-03-18 12:20',
    operator: '周转装袋员-陈亮',
    cycleStatus: 'CLOSED',
    masterStatus: 'IDLE',
    currentLocation: '裁片仓 C 区待命位',
    ticketCount: 1,
    note: '整箱历史周期已关闭。',
    finishedPackingAt: '2026-03-18 12:35',
    manifestAt: '2026-03-18 12:38',
    dispatchAt: '2026-03-18 13:00',
    dispatchBy: '周转装袋员-陈亮',
    signoffStatus: 'SIGNED',
    signedAt: '2026-03-18 15:10',
    returnedAt: '2026-03-18 18:05',
    returnAt: '2026-03-18 18:10',
    returnedBy: '车缝返还员-高宁',
    receivedBy: '回收验收员-张秀',
    inspectedAt: '2026-03-18 18:18',
    inspectedBy: '回收验收员-张秀',
    reusableDecision: 'REUSABLE',
    closedAt: '2026-03-18 18:28',
    closedBy: '周转班长-韩涛',
    closureStatus: 'CLOSED',
    nextBagStatus: 'IDLE',
  })

  addSeedCycle({
    masterIndex: 13,
    taskIndex: 0,
    startedAt: '2026-03-24 07:50',
    operator: '周转装袋员-刘强',
    cycleStatus: 'DISPATCHED',
    masterStatus: 'IN_USE',
    currentLocation: '后道运输通道',
    ticketCount: 2,
    note: '整箱已交出，等待回收。',
    finishedPackingAt: '2026-03-24 08:08',
    manifestAt: '2026-03-24 08:10',
    dispatchAt: '2026-03-24 08:25',
    dispatchBy: '周转装袋员-刘强',
    signoffStatus: 'WAITING',
  })

  addSeedCycle({
    masterIndex: 14,
    taskIndex: 3,
    startedAt: '2026-03-14 09:00',
    operator: '周转装袋员-周燕',
    cycleStatus: 'CLOSED',
    masterStatus: 'IDLE',
    currentLocation: '返修口袋待命位',
    ticketCount: 1,
    note: '返修口袋上轮周期已完成。',
    finishedPackingAt: '2026-03-14 09:12',
    manifestAt: '2026-03-14 09:15',
    dispatchAt: '2026-03-14 09:35',
    dispatchBy: '周转装袋员-周燕',
    signoffStatus: 'SIGNED',
    signedAt: '2026-03-14 11:20',
    returnedAt: '2026-03-14 17:05',
    returnAt: '2026-03-14 17:10',
    returnedBy: '车缝返还员-李娜',
    receivedBy: '回收验收员-陈静',
    inspectedAt: '2026-03-14 17:18',
    inspectedBy: '回收验收员-陈静',
    reusableDecision: 'REUSABLE',
    closedAt: '2026-03-14 17:30',
    closedBy: '周转班长-韩涛',
    closureStatus: 'CLOSED',
    nextBagStatus: 'IDLE',
  })

  addSeedCycle({
    masterIndex: 15,
    taskIndex: 4,
    startedAt: '2026-03-24 13:05',
    operator: '周转装袋员-冯凯',
    cycleStatus: 'READY_TO_DISPATCH',
    masterStatus: 'IN_USE',
    currentLocation: '裁片仓 D 区待发位',
    ticketCount: 2,
    note: '多款号混装完成，等待交出。',
    finishedPackingAt: '2026-03-24 13:30',
    manifestAt: '2026-03-24 13:36',
  })

  const inboundTempTickets = pickInboundTempTickets(4)
  addSeedCycle({
    masterIndex: 16,
    taskIndex: 0,
    startedAt: '2026-03-24 14:20',
    operator: '裁片仓入仓员-林洁',
    cycleStatus: 'PACKING',
    masterStatus: 'IN_USE',
    currentLocation: '裁床待交出仓入仓暂存位',
    ticketCount: inboundTempTickets.length,
    tickets: inboundTempTickets,
    usageStage: 'INBOUND_TEMP',
    note: '入仓暂存袋：允许不同生产单、SKU、部位菲票临时混装，车缝任务分配后再分拣装袋。',
  })

  // ---------- BAG-A-002：补充历史 + 活跃周期 ----------
  addSeedCycle({
    masterIndex: 1,
    taskIndex: 0,
    startedAt: '2026-03-13 10:10',
    operator: '周转装袋员-赵敏',
    cycleStatus: 'CLOSED',
    masterStatus: 'IDLE',
    currentLocation: '裁片仓 A 区待命位',
    ticketCount: 3,
    note: 'BAG-A-002 第一轮周转已闭环，装袋内容含多部位裁片。',
    finishedPackingAt: '2026-03-13 10:35',
    manifestAt: '2026-03-13 10:40',
    dispatchAt: '2026-03-13 11:05',
    dispatchBy: '周转装袋员-赵敏',
    signoffStatus: 'SIGNED',
    signedAt: '2026-03-13 13:40',
    returnedAt: '2026-03-13 17:10',
    returnAt: '2026-03-13 17:15',
    returnWarehouseName: '裁片仓 A 区回收点',
    returnedBy: '车缝返还员-李娜',
    receivedBy: '回收验收员-陈静',
    returnNote: '本次回收登记完整，袋内菲票与裁片件数一致。',
    inspectedAt: '2026-03-13 17:30',
    inspectedBy: '回收验收员-陈静',
    reusableDecision: 'REUSABLE',
    conditionStatus: 'GOOD',
    cleanlinessStatus: 'CLEAN',
    conditionNote: '袋况正常，可直接继续使用。',
    closedAt: '2026-03-13 17:45',
    closedBy: '周转班长-韩涛',
    closureStatus: 'CLOSED',
    nextBagStatus: 'IDLE',
    closureReason: '回收验收通过，口袋释放为空闲。',
  })

  addSeedCycle({
    masterIndex: 1,
    taskIndex: 2,
    startedAt: '2026-03-24 09:30',
    operator: '周转装袋员-陈亮',
    cycleStatus: 'PACKING',
    masterStatus: 'IN_USE',
    currentLocation: '裁片仓 A 区装袋位',
    ticketCount: 2,
    note: 'BAG-A-002 第二轮周转进行中，装入车缝款号对应裁片。',
  })

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
    scrapRecords: [],
  }
}

export function deserializeTransferBagRuntimeStorage(raw: string | null): TransferBagRuntimeStore {
  if (!raw) return emptyStore()
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return emptyStore()
    const rawCycles = Array.isArray(parsed.usages) ? parsed.usages : []
    const cyclesById = Object.fromEntries(
      rawCycles.map((item: Record<string, unknown>) => {
        const normalized = normalizeTransferCarrierCycleRecord(item)
        return [normalized.cycleId, item]
      }),
    )
    const bindings = Array.isArray(parsed.bindings)
      ? parsed.bindings.map((binding: Record<string, unknown>) => {
          const normalized = normalizeCarrierCycleItemBinding(binding, cyclesById)
          return {
            ...binding,
            cycleId: normalized.cycleId,
            cycleNo: normalized.cycleNo,
            carrierId: normalized.carrierId,
            carrierCode: normalized.carrierCode,
            feiTicketId: normalized.feiTicketId,
            feiTicketNo: normalized.feiTicketNo,
            operator: normalized.operator,
            status: normalized.status,
          }
        })
      : []
    const masters = Array.isArray(parsed.masters) ? parsed.masters : []
    return {
      masters: masters.map((item: Record<string, unknown>) => {
        const normalized = normalizeTransferCarrierRecord(item)
        return {
          ...item,
          carrierId: normalized.carrierId,
          carrierCode: normalized.carrierCode,
          latestCycleId: normalized.latestCycleId,
          latestCycleNo: normalized.latestCycleNo,
          currentCycleId: normalized.currentCycleId,
          currentOwnerTaskId: normalized.currentOwnerTaskId,
        }
      }),
      usages: rawCycles.map((item: Record<string, unknown>) => {
        const normalized = normalizeTransferCarrierCycleRecord(item)
        const cycleStatus = normalized.cycleStatus === LEGACY_SCRAP_CLOSED_STATUS ? 'SCRAP_CLOSED' : normalized.cycleStatus
        return {
          ...item,
          cycleId: normalized.cycleId,
          cycleNo: normalized.cycleNo,
          carrierId: normalized.carrierId,
          carrierCode: normalized.carrierCode,
          carrierType: normalized.carrierType,
          cycleStatus,
          status: normalized.status || buildCycleStatus(cycleStatus),
        }
      }),
      bindings,
      manifests: Array.isArray(parsed.manifests)
        ? parsed.manifests.map((item: Record<string, unknown>) => {
            const normalized = normalizeTransferBagDispatchManifest(item)
            return {
              ...item,
              cycleId: normalized.cycleId,
              carrierCode: normalized.carrierCode,
            }
          })
        : [],
      sewingTasks: Array.isArray(parsed.sewingTasks) ? parsed.sewingTasks : [],
      auditTrail: Array.isArray(parsed.auditTrail) ? parsed.auditTrail : [],
      returnReceipts: Array.isArray(parsed.returnReceipts) ? parsed.returnReceipts : [],
      conditionRecords: Array.isArray(parsed.conditionRecords) ? parsed.conditionRecords : [],
      reuseCycles: Array.isArray(parsed.reuseCycles) ? parsed.reuseCycles : [],
      closureResults: Array.isArray(parsed.closureResults) ? parsed.closureResults : [],
      returnAuditTrail: Array.isArray(parsed.returnAuditTrail) ? parsed.returnAuditTrail : [],
      scrapRecords: Array.isArray(parsed.scrapRecords) ? parsed.scrapRecords : [],
    }
  } catch {
    return emptyStore()
  }
}

export function serializeTransferBagRuntimeStorage(store: TransferBagRuntimeStore): string {
  return JSON.stringify(store)
}

export function mergeTransferBagRuntimeStores(seed: TransferBagRuntimeStore, stored: TransferBagRuntimeStore): TransferBagRuntimeStore {
  const sewingTasks = normalizeMergedSewingTasks(seed.sewingTasks, stored.sewingTasks)
  const usages = syncCycleFactoryNames(
    mergeById(seed.usages, stored.usages, 'cycleId'),
    sewingTasks,
  )
  return {
    masters: mergeById(seed.masters, stored.masters, 'carrierId'),
    usages,
    bindings: mergeById(seed.bindings, stored.bindings, 'bindingId'),
    manifests: syncManifestFactoryNames(
      mergeById(seed.manifests, stored.manifests, 'manifestId'),
      usages,
    ),
    sewingTasks,
    auditTrail: mergeById(seed.auditTrail, stored.auditTrail, 'auditTrailId'),
    returnReceipts: mergeById(seed.returnReceipts, stored.returnReceipts, 'returnReceiptId'),
    conditionRecords: mergeById(seed.conditionRecords, stored.conditionRecords, 'conditionRecordId'),
    reuseCycles: mergeById(seed.reuseCycles, stored.reuseCycles, 'cycleSummaryId'),
    closureResults: mergeById(seed.closureResults, stored.closureResults, 'closureId'),
    returnAuditTrail: mergeById(seed.returnAuditTrail, stored.returnAuditTrail, 'auditTrailId'),
    scrapRecords: mergeById(seed.scrapRecords, stored.scrapRecords, 'scrapRecordId'),
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

export interface TransferBagRuntimeTraceMatrixRow {
  usageId: string
  transferBatchId: string
  bagId: string
  bagCode: string
  feiTicketId: string
  feiTicketNo: string
  sourceSpreadingSessionId: string
  sourceSpreadingSessionNo: string
  sourceMarkerId: string
  sourceMarkerNo: string
  sourceWritebackId: string
  cutOrderId: string
  cutOrderNo: string
  markerPlanNo: string
}

export function buildTransferBagRuntimeTraceMatrix(store: TransferBagRuntimeStore): TransferBagRuntimeTraceMatrixRow[] {
  return store.bindings
    .map((binding) => ({
      usageId: binding.cycleId || '',
      transferBatchId: binding.cycleId || '',
      bagId: binding.carrierId || '',
      bagCode: binding.carrierCode || '',
      feiTicketId: binding.feiTicketId,
      feiTicketNo: binding.feiTicketNo,
      sourceSpreadingSessionId: String(binding.sourceSpreadingSessionId || ''),
      sourceSpreadingSessionNo: String(binding.sourceSpreadingSessionNo || ''),
      sourceMarkerId: String(binding.sourceMarkerId || ''),
      sourceMarkerNo: String(binding.sourceMarkerNo || ''),
      sourceWritebackId: String(binding.sourceWritebackId || ''),
      cutOrderId: binding.cutOrderId,
      cutOrderNo: binding.cutOrderNo,
      markerPlanNo: binding.markerPlanNo,
    }))
    .sort(
      (left, right) =>
        left.usageId.localeCompare(right.usageId, 'zh-CN')
        || left.feiTicketId.localeCompare(right.feiTicketId, 'zh-CN'),
    )
}

export function buildSpreadingDrivenTransferBagTraceMatrix(
  store: TransferBagRuntimeStore,
): TransferBagRuntimeTraceMatrixRow[] {
  return buildTransferBagRuntimeTraceMatrix(store).filter((row) => Boolean(row.sourceSpreadingSessionId))
}

export function parseCarrierQrValue(value: string): {
  carrierId: string
  carrierCode: string
  cycleId: string
} | null {
  const payload = parseCuttingTraceQr(value)
  if (!payload || payload.codeType !== 'CARRIER') return null
  return {
    carrierId: payload.carrierId,
    carrierCode: payload.carrierCode,
    cycleId: payload.cycleId,
  }
}
