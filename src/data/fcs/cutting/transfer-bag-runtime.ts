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
    note: options.note?.trim() || '装袋清单来自正式父子映射，供车缝交接核对。',
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
  const masters: TransferCarrierRecord[] = [
    buildCarrierRecord({
      carrierId: 'carrier-bag-001',
      carrierCode: 'BAG-A-001',
      carrierType: 'bag',
      capacity: 24,
      currentStatus: 'IDLE',
      currentLocation: '裁片仓 A 区待命位',
      note: '常用车缝交接口袋。',
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
      carrierCode: 'BAG-B-001',
      carrierType: 'bag',
      capacity: 18,
      currentStatus: 'IDLE',
      currentLocation: '车缝交接待发区',
      note: '常用于返修与补片任务。',
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
  ]

  const usages: TransferCarrierCycleRecord[] = []
  const bindings: CarrierCycleItemBinding[] = []
  const manifests: TransferBagDispatchManifestRecord[] = []

  const firstTask = sewingTasks[0]
  const secondTask = sewingTasks[1] || sewingTasks[0]
  const printedTickets = options.ticketRecords.filter((ticket) => ticket.status === 'PRINTED')
  const firstChunk = printedTickets.slice(0, 3)
  const secondChunk = printedTickets.slice(3, 6)

  if (firstTask && firstChunk.length) {
    const cycle = createCarrierCycleRecord({
      carrier: masters[0],
      sewingTask: firstTask,
      nowText: '2026-03-24 09:20',
      existingUsages: usages,
      note: '首个正式口袋周期。',
    })
    cycle.cycleStatus = 'READY_TO_DISPATCH'
    cycle.status = buildCycleStatus(cycle.cycleStatus)
    cycle.packedTicketCount = firstChunk.length
    cycle.packedOriginalCutOrderCount = unique(firstChunk.map((item) => item.originalCutOrderNo)).length
    cycle.finishedPackingAt = '2026-03-24 09:45'
    usages.push(cycle)
    bindings.push(
      ...firstChunk.map((ticket, index) =>
        createCarrierCycleBinding({
          cycle,
          carrier: masters[0],
          ticket,
          boundAt: `2026-03-24 09:${String(22 + index).padStart(2, '0')}`,
          operator: '周转装袋员-刘强',
        }),
      ),
    )
    manifests.push(
      createCarrierDispatchManifest({
        cycle,
        bindings: bindings.filter((binding) => binding.cycleId === cycle.cycleId),
        nowText: '2026-03-24 10:10',
        createdBy: '周转装袋员-刘强',
      }),
    )
    masters[0] = buildCarrierRecord({
      carrierId: masters[0].carrierId,
      carrierCode: masters[0].carrierCode,
      carrierType: masters[0].carrierType,
      capacity: masters[0].capacity,
      currentStatus: 'IN_USE',
      currentLocation: '裁片仓待发区',
      latestCycleId: cycle.cycleId,
      latestCycleNo: cycle.cycleNo,
      currentCycleId: cycle.cycleId,
      currentOwnerTaskId: cycle.sewingTaskId,
      note: masters[0].note,
    })
  }

  if (secondTask && secondChunk.length) {
    const cycle = createCarrierCycleRecord({
      carrier: masters[3],
      sewingTask: secondTask,
      nowText: '2026-03-24 11:00',
      existingUsages: usages,
      note: '大批量周转箱装箱周期。',
    })
    cycle.cycleStatus = 'PACKING'
    cycle.status = buildCycleStatus(cycle.cycleStatus)
    cycle.packedTicketCount = secondChunk.length
    cycle.packedOriginalCutOrderCount = unique(secondChunk.map((item) => item.originalCutOrderNo)).length
    usages.push(cycle)
    bindings.push(
      ...secondChunk.map((ticket, index) =>
        createCarrierCycleBinding({
          cycle,
          carrier: masters[3],
          ticket,
          boundAt: `2026-03-24 11:${String(2 + index).padStart(2, '0')}`,
          operator: '周转装袋员-王敏',
        }),
      ),
    )
    masters[3] = buildCarrierRecord({
      carrierId: masters[3].carrierId,
      carrierCode: masters[3].carrierCode,
      carrierType: masters[3].carrierType,
      capacity: masters[3].capacity,
      currentStatus: 'IN_USE',
      currentLocation: '裁片仓 B 区待发位',
      latestCycleId: cycle.cycleId,
      latestCycleNo: cycle.cycleNo,
      currentCycleId: cycle.cycleId,
      currentOwnerTaskId: cycle.sewingTaskId,
      note: masters[3].note,
    })
  }

  return {
    masters,
    usages,
    bindings,
    manifests,
    sewingTasks,
    auditTrail: [],
    returnReceipts: [],
    conditionRecords: [],
    reuseCycles: [],
    closureResults: [],
    returnAuditTrail: [],
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
