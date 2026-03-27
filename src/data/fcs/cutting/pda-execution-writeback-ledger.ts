export const CUTTING_PDA_EXECUTION_WRITEBACK_STORAGE_KEY = 'cuttingPdaExecutionWritebackLedger'

export type PdaExecutionWritebackSourceChannel = 'PDA'

interface PdaExecutionWritebackBase {
  writebackId: string
  actionType: string
  actionAt: string
  taskId: string
  taskNo: string
  executionOrderId: string
  executionOrderNo: string
  legacyCutPieceOrderNo: string
  cutPieceOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  originalCutOrderId: string
  originalCutOrderNo: string
  mergeBatchId: string
  mergeBatchNo: string
  materialSku: string
  operatorAccountId: string
  operatorName: string
  operatorRole: string
  operatorFactoryId: string
  operatorFactoryName: string
  submittedAt: string
  sourceDeviceId: string
  sourceChannel: PdaExecutionWritebackSourceChannel
  sourceWritebackId: string
  sourceRecordId: string
}

export interface PdaPickupWritebackRecord extends PdaExecutionWritebackBase {
  resultLabel: string
  actualReceivedQtyText: string
  discrepancyNote: string
  photoProofCount: number
  claimDisputeId: string
  claimDisputeNo: string
}

export interface PdaCutPieceInboundWritebackRecord extends PdaExecutionWritebackBase {
  zoneCode: 'A' | 'B' | 'C'
  locationLabel: string
  note: string
}

export interface PdaCutPieceHandoverWritebackRecord extends PdaExecutionWritebackBase {
  targetLabel: string
  note: string
}

export interface PdaReplenishmentFeedbackWritebackRecord extends PdaExecutionWritebackBase {
  reasonLabel: string
  note: string
  photoProofCount: number
}

export interface PdaExecutionWritebackStore {
  pickupWritebacks: PdaPickupWritebackRecord[]
  inboundWritebacks: PdaCutPieceInboundWritebackRecord[]
  handoverWritebacks: PdaCutPieceHandoverWritebackRecord[]
  replenishmentFeedbackWritebacks: PdaReplenishmentFeedbackWritebackRecord[]
}

function toArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : []
}

function toString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function toNumber(value: unknown): number {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

function uniqueById<T extends { writebackId: string }>(items: T[]): T[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    if (!item.writebackId || seen.has(item.writebackId)) return false
    seen.add(item.writebackId)
    return true
  })
}

function sortBySubmittedAtDesc<T extends { submittedAt: string }>(items: T[]): T[] {
  return items.slice().sort((left, right) => right.submittedAt.localeCompare(left.submittedAt, 'zh-CN'))
}

function normalizeBaseRecord(raw: Record<string, unknown>) {
  const legacyCutPieceOrderNo = toString(raw.legacyCutPieceOrderNo) || toString(raw.cutPieceOrderNo)
  const executionOrderNo = toString(raw.executionOrderNo) || legacyCutPieceOrderNo
  const submittedAt = toString(raw.submittedAt)
  const actionAt = toString(raw.actionAt) || submittedAt
  return {
    writebackId: toString(raw.writebackId),
    actionType: toString(raw.actionType),
    actionAt,
    taskId: toString(raw.taskId),
    taskNo: toString(raw.taskNo),
    executionOrderId: toString(raw.executionOrderId) || executionOrderNo,
    executionOrderNo,
    legacyCutPieceOrderNo,
    cutPieceOrderNo: legacyCutPieceOrderNo,
    productionOrderId: toString(raw.productionOrderId),
    productionOrderNo: toString(raw.productionOrderNo),
    originalCutOrderId: toString(raw.originalCutOrderId),
    originalCutOrderNo: toString(raw.originalCutOrderNo),
    mergeBatchId: toString(raw.mergeBatchId),
    mergeBatchNo: toString(raw.mergeBatchNo),
    materialSku: toString(raw.materialSku),
    operatorAccountId: toString(raw.operatorAccountId),
    operatorName: toString(raw.operatorName),
    operatorRole: toString(raw.operatorRole),
    operatorFactoryId: toString(raw.operatorFactoryId),
    operatorFactoryName: toString(raw.operatorFactoryName),
    submittedAt: submittedAt || actionAt,
    sourceDeviceId: toString(raw.sourceDeviceId) || 'PDA-CUTTING',
    sourceChannel: 'PDA' as const,
    sourceWritebackId: toString(raw.sourceWritebackId),
    sourceRecordId: toString(raw.sourceRecordId),
  }
}

function normalizePickupRecord(raw: unknown): PdaPickupWritebackRecord | null {
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>
  const base = normalizeBaseRecord(record)
  if (!base.writebackId) return null
  return {
    ...base,
    resultLabel: toString(record.resultLabel),
    actualReceivedQtyText: toString(record.actualReceivedQtyText),
    discrepancyNote: toString(record.discrepancyNote),
    photoProofCount: toNumber(record.photoProofCount),
    claimDisputeId: toString(record.claimDisputeId),
    claimDisputeNo: toString(record.claimDisputeNo),
  }
}

function normalizeInboundRecord(raw: unknown): PdaCutPieceInboundWritebackRecord | null {
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>
  const base = normalizeBaseRecord(record)
  if (!base.writebackId) return null
  return {
    ...base,
    zoneCode: (['A', 'B', 'C'].includes(toString(record.zoneCode)) ? toString(record.zoneCode) : 'A') as 'A' | 'B' | 'C',
    locationLabel: toString(record.locationLabel),
    note: toString(record.note),
  }
}

function normalizeHandoverRecord(raw: unknown): PdaCutPieceHandoverWritebackRecord | null {
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>
  const base = normalizeBaseRecord(record)
  if (!base.writebackId) return null
  return {
    ...base,
    targetLabel: toString(record.targetLabel),
    note: toString(record.note),
  }
}

function normalizeReplenishmentFeedbackRecord(raw: unknown): PdaReplenishmentFeedbackWritebackRecord | null {
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>
  const base = normalizeBaseRecord(record)
  if (!base.writebackId) return null
  return {
    ...base,
    reasonLabel: toString(record.reasonLabel),
    note: toString(record.note),
    photoProofCount: toNumber(record.photoProofCount),
  }
}

export function createEmptyPdaExecutionWritebackStore(): PdaExecutionWritebackStore {
  return {
    pickupWritebacks: [],
    inboundWritebacks: [],
    handoverWritebacks: [],
    replenishmentFeedbackWritebacks: [],
  }
}

export function serializePdaExecutionWritebackStorage(store: PdaExecutionWritebackStore): string {
  return JSON.stringify(store)
}

export function deserializePdaExecutionWritebackStorage(raw: string | null): PdaExecutionWritebackStore {
  if (!raw) return createEmptyPdaExecutionWritebackStore()
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return {
      pickupWritebacks: sortBySubmittedAtDesc(
        uniqueById(toArray(parsed.pickupWritebacks).map((item) => normalizePickupRecord(item)).filter((item): item is PdaPickupWritebackRecord => Boolean(item))),
      ),
      inboundWritebacks: sortBySubmittedAtDesc(
        uniqueById(toArray(parsed.inboundWritebacks).map((item) => normalizeInboundRecord(item)).filter((item): item is PdaCutPieceInboundWritebackRecord => Boolean(item))),
      ),
      handoverWritebacks: sortBySubmittedAtDesc(
        uniqueById(toArray(parsed.handoverWritebacks).map((item) => normalizeHandoverRecord(item)).filter((item): item is PdaCutPieceHandoverWritebackRecord => Boolean(item))),
      ),
      replenishmentFeedbackWritebacks: sortBySubmittedAtDesc(
        uniqueById(
          toArray(parsed.replenishmentFeedbackWritebacks)
            .map((item) => normalizeReplenishmentFeedbackRecord(item))
            .filter((item): item is PdaReplenishmentFeedbackWritebackRecord => Boolean(item)),
        ),
      ),
    }
  } catch {
    return createEmptyPdaExecutionWritebackStore()
  }
}

export function hydratePdaExecutionWritebackStore(storage?: Pick<Storage, 'getItem'>): PdaExecutionWritebackStore {
  if (!storage) return createEmptyPdaExecutionWritebackStore()
  return deserializePdaExecutionWritebackStorage(storage.getItem(CUTTING_PDA_EXECUTION_WRITEBACK_STORAGE_KEY))
}

export function persistPdaExecutionWritebackStore(
  store: PdaExecutionWritebackStore,
  storage?: Pick<Storage, 'setItem'>,
): void {
  if (!storage) return
  storage.setItem(CUTTING_PDA_EXECUTION_WRITEBACK_STORAGE_KEY, serializePdaExecutionWritebackStorage(store))
}

function appendUniqueRecord<T extends { writebackId: string; submittedAt: string }>(records: T[], record: T): T[] {
  return sortBySubmittedAtDesc(uniqueById([record, ...records.filter((item) => item.writebackId !== record.writebackId)]))
}

export function appendPickupWritebackRecord(
  record: PdaPickupWritebackRecord,
  storage?: Pick<Storage, 'getItem' | 'setItem'>,
): PdaExecutionWritebackStore {
  const store = hydratePdaExecutionWritebackStore(storage)
  const nextStore = {
    ...store,
    pickupWritebacks: appendUniqueRecord(store.pickupWritebacks, record),
  }
  persistPdaExecutionWritebackStore(nextStore, storage)
  return nextStore
}

export function appendInboundWritebackRecord(
  record: PdaCutPieceInboundWritebackRecord,
  storage?: Pick<Storage, 'getItem' | 'setItem'>,
): PdaExecutionWritebackStore {
  const store = hydratePdaExecutionWritebackStore(storage)
  const nextStore = {
    ...store,
    inboundWritebacks: appendUniqueRecord(store.inboundWritebacks, record),
  }
  persistPdaExecutionWritebackStore(nextStore, storage)
  return nextStore
}

export function appendHandoverWritebackRecord(
  record: PdaCutPieceHandoverWritebackRecord,
  storage?: Pick<Storage, 'getItem' | 'setItem'>,
): PdaExecutionWritebackStore {
  const store = hydratePdaExecutionWritebackStore(storage)
  const nextStore = {
    ...store,
    handoverWritebacks: appendUniqueRecord(store.handoverWritebacks, record),
  }
  persistPdaExecutionWritebackStore(nextStore, storage)
  return nextStore
}

export function appendReplenishmentFeedbackWritebackRecord(
  record: PdaReplenishmentFeedbackWritebackRecord,
  storage?: Pick<Storage, 'getItem' | 'setItem'>,
): PdaExecutionWritebackStore {
  const store = hydratePdaExecutionWritebackStore(storage)
  const nextStore = {
    ...store,
    replenishmentFeedbackWritebacks: appendUniqueRecord(store.replenishmentFeedbackWritebacks, record),
  }
  persistPdaExecutionWritebackStore(nextStore, storage)
  return nextStore
}

export function listPdaPickupWritebacks(storage?: Pick<Storage, 'getItem'>): PdaPickupWritebackRecord[] {
  return hydratePdaExecutionWritebackStore(storage).pickupWritebacks
}

export function listPdaPickupWritebacksByOriginalCutOrderNo(
  originalCutOrderNo: string,
  storage?: Pick<Storage, 'getItem'>,
): PdaPickupWritebackRecord[] {
  return listPdaPickupWritebacks(storage).filter((item) => item.originalCutOrderNo === originalCutOrderNo)
}

export function getLatestPdaPickupWritebackByOriginalCutOrderNo(
  originalCutOrderNo: string,
  storage?: Pick<Storage, 'getItem'>,
): PdaPickupWritebackRecord | null {
  return listPdaPickupWritebacksByOriginalCutOrderNo(originalCutOrderNo, storage)[0] ?? null
}

export function listPdaInboundWritebacks(storage?: Pick<Storage, 'getItem'>): PdaCutPieceInboundWritebackRecord[] {
  return hydratePdaExecutionWritebackStore(storage).inboundWritebacks
}

export function listPdaHandoverWritebacks(storage?: Pick<Storage, 'getItem'>): PdaCutPieceHandoverWritebackRecord[] {
  return hydratePdaExecutionWritebackStore(storage).handoverWritebacks
}

export function listPdaReplenishmentFeedbackWritebacks(
  storage?: Pick<Storage, 'getItem'>,
): PdaReplenishmentFeedbackWritebackRecord[] {
  return hydratePdaExecutionWritebackStore(storage).replenishmentFeedbackWritebacks
}
