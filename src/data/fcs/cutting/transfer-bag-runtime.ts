import { buildCuttingTraceabilityId, encodeCarrierQr, parseCuttingTraceQr } from './qr-codes.ts'
import {
  normalizeCarrierCycleItemBinding,
  normalizeTransferBagDispatchManifest,
  normalizeTransferCarrierCycleRecord,
  normalizeTransferCarrierRecord,
  normalizeTransferCarrierSeedTicket,
} from './transfer-bag-legacy-normalizer.ts'

export const CUTTING_TRANSFER_BAG_LEDGER_STORAGE_KEY = 'cuttingTransferBagLedger'
export const CUTTING_TRANSFER_BAG_SELECTED_TICKET_IDS_STORAGE_KEY = 'cuttingTransferBagSelectedTicketRecordIds'

export type TransferCarrierType = 'bag' | 'box'
export type TransferCarrierStatus = 'idle' | 'loaded' | 'handed_over' | 'received' | 'returned' | 'recycled' | 'disabled'

export interface TransferBagSeedOriginalRowLike {
  originalCutOrderId: string
  originalCutOrderNo: string
  productionOrderNo: string
  styleCode: string
  spuCode: string
  color: string
  materialSku: string
  plannedQty?: number
  orderQty?: number
}

export interface TransferBagSeedMergeBatchLike {
  mergeBatchId: string
  mergeBatchNo: string
  styleCode: string
  spuCode: string
  materialSkuSummary: string
  items: Array<{
    originalCutOrderId: string
  }>
}

export interface TransferBagSeedTicketLike {
  feiTicketId: string
  feiTicketNo: string
  originalCutOrderId: string
  originalCutOrderNo: string
  productionOrderNo: string
  mergeBatchNo: string
  styleCode: string
  spuCode: string
  color: string
  size?: string
  partName?: string
  qty?: number
  materialSku: string
  sourceContextType: string
  status: 'PRINTED' | 'VOIDED'
}

export interface TransferCarrierRecord {
  carrierId: string
  carrierCode: string
  carrierType: TransferCarrierType
  bagType: string
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
  qrValue: string
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
  styleCode: string
  spuCode: string
  skuSummary: string
  colorSummary: string
  sizeSummary: string
  cycleStatus: string
  status: TransferCarrierStatus
  packedTicketCount: number
  packedOriginalCutOrderCount: number
  startedAt?: string
  finishedPackingAt?: string
  dispatchAt: string
  dispatchBy: string
  signoffStatus: 'PENDING' | 'WAITING' | 'SIGNED'
  signedAt?: string
  returnedAt?: string
  note: string
}

export interface CarrierCycleItemBinding {
  bindingId: string
  cycleId: string
  cycleNo: string
  carrierId: string
  carrierCode: string
  feiTicketId: string
  feiTicketNo: string
  originalCutOrderId: string
  originalCutOrderNo: string
  productionOrderNo: string
  mergeBatchNo: string
  qty: number
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
  originalCutOrderCount: number
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
  }
}

function unique(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))))
}

function sanitizeId(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'na'
}

function buildCycleStatus(cycleStatus: string): TransferCarrierStatus {
  if (cycleStatus === 'READY_TO_DISPATCH' || cycleStatus === 'PACKING' || cycleStatus === 'DRAFT') return 'loaded'
  if (cycleStatus === 'DISPATCHED' || cycleStatus === 'PENDING_SIGNOFF') return 'handed_over'
  if (cycleStatus === 'WAITING_RETURN' || cycleStatus === 'RETURN_INSPECTING') return 'returned'
  if (cycleStatus === 'CLOSED') return 'recycled'
  if (cycleStatus === 'EXCEPTION_CLOSED') return 'disabled'
  return 'idle'
}

function mergeById<T extends Record<string, unknown>>(seedItems: T[], storedItems: T[], idKey: keyof T): T[] {
  const merged = new Map<string, T>()
  seedItems.forEach((item) => merged.set(String(item[idKey]), item))
  storedItems.forEach((item) => merged.set(String(item[idKey]), item))
  return Array.from(merged.values())
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
    bagType: input.carrierType === 'bag' ? '周转口袋' : '周转箱',
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
  originalRows: TransferBagSeedOriginalRowLike[] = [],
  mergeBatches: TransferBagSeedMergeBatchLike[] = [],
): SewingTaskRefRecord[] {
  const mergeSeeds = mergeBatches.slice(0, 3).map((batch, index) => ({
    sewingTaskId: `sewing-task-${sanitizeId(batch.mergeBatchId || batch.mergeBatchNo)}`,
    sewingTaskNo: `CF-${String(index + 1).padStart(3, '0')}`,
    sewingFactoryId: `factory-${index + 1}`,
    sewingFactoryName: ['苏州车缝一厂', '嘉兴车缝二厂', '常熟协作车缝点'][index] || `车缝工厂 ${index + 1}`,
    styleCode: batch.styleCode,
    spuCode: batch.spuCode,
    skuSummary: batch.materialSkuSummary,
    colorSummary: '混色',
    sizeSummary: 'S / M / L',
    plannedQty: batch.items.length * 24,
    status: index === 0 ? '待接料' : index === 1 ? '排单中' : '待交接',
    note: `来源于 ${batch.mergeBatchNo} 的正式载具任务引用。`,
  }))

  const fallbackSeeds = originalRows.slice(0, 2).map((row, index) => ({
    sewingTaskId: `sewing-task-fallback-${sanitizeId(row.originalCutOrderId)}`,
    sewingTaskNo: `CF-FB-${String(index + 1).padStart(3, '0')}`,
    sewingFactoryId: `fallback-factory-${index + 1}`,
    sewingFactoryName: ['昆山外协车缝点', '无锡返修车缝组'][index] || '后道车缝组',
    styleCode: row.styleCode,
    spuCode: row.spuCode,
    skuSummary: row.materialSku,
    colorSummary: row.color,
    sizeSummary: '默认尺码组',
    plannedQty: row.plannedQty || row.orderQty || 0,
    status: '待接料',
    note: '无批次场景下的正式交接任务引用。',
  }))

  return [...mergeSeeds, ...fallbackSeeds].slice(0, 5)
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
    packedOriginalCutOrderCount: 0,
    startedAt: options.nowText,
    finishedPackingAt: '',
    dispatchAt: '',
    dispatchBy: '',
    signoffStatus: 'PENDING',
    signedAt: '',
    returnedAt: '',
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
    originalCutOrderCount: unique(options.bindings.map((item) => item.originalCutOrderNo)).length,
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
    originalCutOrderId: options.ticket.originalCutOrderId,
    originalCutOrderNo: options.ticket.originalCutOrderNo,
    productionOrderNo: options.ticket.productionOrderNo,
    mergeBatchNo: options.ticket.mergeBatchNo,
    qty: Math.max(options.ticket.qty || 1, 1),
    boundAt: options.boundAt,
    boundBy: options.operator,
    operator: options.operator,
    status: 'BOUND',
    note: options.note?.trim() || '先扫口袋码，再扫菲票子码后建立正式父子映射。',
  }
}

export function buildSystemSeedTransferBagRuntime(options: {
  originalRows: TransferBagSeedOriginalRowLike[]
  ticketRecords: TransferBagSeedTicketLike[]
  mergeBatches?: TransferBagSeedMergeBatchLike[]
}): TransferBagRuntimeStore {
  const mergeBatches = options.mergeBatches || []
  const sewingTasks = buildSewingTaskSeeds(options.originalRows, mergeBatches)
  if (!sewingTasks.length) {
    sewingTasks.push({
      sewingTaskId: 'sewing-task-default',
      sewingTaskNo: 'CF-000',
      sewingFactoryId: 'factory-default',
      sewingFactoryName: '默认车缝组',
      styleCode: 'HG-DEFAULT',
      spuCode: 'SPU-DEFAULT',
      skuSummary: 'MAT-DEFAULT',
      colorSummary: '默认色组',
      sizeSummary: '默认尺码组',
      plannedQty: 120,
      status: '待接料',
      note: '默认周转口袋任务引用。',
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
      note: '常用周转口袋。',
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
      currentLocation: '裁片仓 A 区复用待命位',
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
      note: '已发出待签收的口袋样例。',
    }),
    buildCarrierRecord({
      carrierId: 'carrier-bag-006',
      carrierCode: 'BAG-A-006',
      carrierType: 'bag',
      capacity: 20,
      currentStatus: 'IDLE',
      currentLocation: '车缝一厂签收区',
      note: '已签收待回收的口袋样例。',
    }),
    buildCarrierRecord({
      carrierId: 'carrier-bag-007',
      carrierCode: 'BAG-A-007',
      carrierType: 'bag',
      capacity: 18,
      currentStatus: 'IDLE',
      currentLocation: '周转口袋回收验收台',
      note: '正在进行回收验收的口袋样例。',
    }),
    buildCarrierRecord({
      carrierId: 'carrier-bag-008',
      carrierCode: 'BAG-A-008',
      carrierType: 'bag',
      capacity: 24,
      currentStatus: 'IDLE',
      currentLocation: '裁片仓复用待命区',
      note: '已关闭并重新释放的口袋。',
    }),
    buildCarrierRecord({
      carrierId: 'carrier-bag-009',
      carrierCode: 'BAG-A-009',
      carrierType: 'bag',
      capacity: 20,
      currentStatus: 'WAITING_CLEANING',
      currentLocation: '周转口袋清洁区',
      note: '上一轮回收后待清洁。',
    }),
    buildCarrierRecord({
      carrierId: 'carrier-bag-010',
      carrierCode: 'BAG-A-010',
      carrierType: 'bag',
      capacity: 20,
      currentStatus: 'WAITING_REPAIR',
      currentLocation: '周转口袋维修区',
      note: '袋体边角破损，待维修确认。',
    }),
    buildCarrierRecord({
      carrierId: 'carrier-bag-011',
      carrierCode: 'BAG-A-011',
      carrierType: 'bag',
      capacity: 16,
      currentStatus: 'DISABLED',
      currentLocation: '停用待报废区',
      note: '袋体报废停用，仅保留追溯记录。',
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
      note: '整箱发出的样例。',
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
      note: '待发出前的多款号混装样例。',
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
      note: '大容量周转口袋，可容纳更多菲票。',
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
    reusableDecision?: 'REUSABLE' | 'WAITING_CLEANING' | 'WAITING_REPAIR' | 'DISABLED'
    inspectedAt?: string
    inspectedBy?: string
    conditionNote?: string
    closedAt?: string
    closedBy?: string
    closureStatus?: 'CLOSED' | 'EXCEPTION_CLOSED'
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
    const selectedTickets = pickTickets(options.ticketCount)
    const cycleBindings = selectedTickets.map((ticket) =>
      createCarrierCycleBinding({
        cycle,
        carrier,
        ticket,
        boundAt: options.startedAt,
        operator: options.operator,
      }),
    )

    cycle.cycleStatus = options.cycleStatus
    cycle.status = buildCycleStatus(cycle.cycleStatus)
    cycle.packedTicketCount = cycleBindings.length
    cycle.packedOriginalCutOrderCount = unique(cycleBindings.map((item) => item.originalCutOrderNo)).length
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

    pushUsageAudit(cycle, options.startedAt, '创建本次周转', options.operator, options.note)
    if (cycleBindings.length) {
      pushUsageAudit(cycle, options.startedAt, '装袋绑定', options.operator, `已绑定 ${cycleBindings.length} 张菲票。`)
    }
    if (options.finishedPackingAt) {
      pushUsageAudit(cycle, options.finishedPackingAt, '完成装袋', options.operator, '袋内内容已核对完成。')
    }
    if (options.dispatchAt) {
      pushUsageAudit(cycle, options.dispatchAt, '发出', options.dispatchBy || options.operator, '已发往对应车缝任务。')
    }
    if (options.signedAt) {
      pushUsageAudit(cycle, options.signedAt, '签收', options.operator, '车缝端已完成签收。')
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
        returnedOriginalCutOrderCount: unique(cycleBindings.map((item) => item.originalCutOrderNo)).length,
        discrepancyType: options.discrepancyType || 'NONE',
        discrepancyNote: options.discrepancyNote || '',
        note: options.returnNote || '已完成周转口袋回收登记。',
      })
      pushReturnAudit(
        cycle,
        options.returnAt,
        '创建回收记录',
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
        '完成袋况检查',
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
    currentLocation: '裁片仓 A 区复用待命位',
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
    note: '已发出，等待接收方签收。',
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
    currentLocation: '车缝一厂签收区',
    ticketCount: 2,
    note: '已签收，等待回收。',
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
    currentLocation: '周转口袋回收验收台',
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
    currentLocation: '裁片仓复用待命区',
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
    cycleStatus: 'EXCEPTION_CLOSED',
    masterStatus: 'WAITING_CLEANING',
    currentLocation: '周转口袋清洁区',
    ticketCount: 1,
    note: '回收后发现袋体较脏，需先清洁。',
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
    reusableDecision: 'WAITING_CLEANING',
    cleanlinessStatus: 'DIRTY',
    conditionStatus: 'GOOD',
    closedAt: '2026-03-17 17:55',
    closedBy: '周转班长-韩涛',
    closureStatus: 'EXCEPTION_CLOSED',
    nextBagStatus: 'WAITING_CLEANING',
    closureReason: '袋体待清洁，暂不释放到空闲池。',
    warningMessages: ['待完成清洁后再释放使用。'],
  })

  addSeedCycle({
    masterIndex: 9,
    taskIndex: 3,
    startedAt: '2026-03-16 14:10',
    operator: '周转装袋员-孙杰',
    cycleStatus: 'EXCEPTION_CLOSED',
    masterStatus: 'WAITING_REPAIR',
    currentLocation: '周转口袋维修区',
    ticketCount: 1,
    note: '袋体边角破损，需要维修确认。',
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
    reusableDecision: 'WAITING_REPAIR',
    conditionStatus: 'MINOR_DAMAGE',
    damageType: '底角开线',
    repairNeeded: true,
    closedAt: '2026-03-16 19:10',
    closedBy: '周转班长-韩涛',
    closureStatus: 'EXCEPTION_CLOSED',
    nextBagStatus: 'WAITING_REPAIR',
    closureReason: '袋体需维修后再决定是否复用。',
    warningMessages: ['维修确认前不可再次装袋。'],
  })

  addSeedCycle({
    masterIndex: 10,
    taskIndex: 4,
    startedAt: '2026-03-15 08:15',
    operator: '周转装袋员-徐敏',
    cycleStatus: 'EXCEPTION_CLOSED',
    masterStatus: 'DISABLED',
    currentLocation: '停用待报废区',
    ticketCount: 1,
    note: '袋体严重破损，已停用。',
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
    closureStatus: 'EXCEPTION_CLOSED',
    nextBagStatus: 'DISABLED',
    closureReason: '袋体报废停用，不再进入复用链路。',
    warningMessages: ['已转入报废停用状态。'],
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
    note: '整箱已发出，等待签收。',
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
    note: '多款号混装完成，等待发出。',
    finishedPackingAt: '2026-03-24 13:30',
    manifestAt: '2026-03-24 13:36',
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
        return {
          ...item,
          cycleId: normalized.cycleId,
          cycleNo: normalized.cycleNo,
          carrierId: normalized.carrierId,
          carrierCode: normalized.carrierCode,
          carrierType: normalized.carrierType,
          cycleStatus: normalized.cycleStatus,
          status: normalized.status || buildCycleStatus(normalized.cycleStatus),
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
    }
  } catch {
    return emptyStore()
  }
}

export function serializeTransferBagRuntimeStorage(store: TransferBagRuntimeStore): string {
  return JSON.stringify(store)
}

export function mergeTransferBagRuntimeStores(seed: TransferBagRuntimeStore, stored: TransferBagRuntimeStore): TransferBagRuntimeStore {
  return {
    masters: mergeById(seed.masters, stored.masters, 'carrierId'),
    usages: mergeById(seed.usages, stored.usages, 'cycleId'),
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
