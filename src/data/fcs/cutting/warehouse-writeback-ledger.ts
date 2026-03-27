export const CUTTING_WAREHOUSE_WRITEBACK_STORAGE_KEY = 'cuttingWarehouseWritebackLedger'

export type CuttingWarehouseWritebackSourceChannel = 'CUTTING_WAREHOUSE_UI'
export type CutPieceWarehouseActionType =
  | 'CUT_PIECE_WAREHOUSE_SAVE_LOCATION'
  | 'CUT_PIECE_WAREHOUSE_MARK_INBOUND'
  | 'CUT_PIECE_WAREHOUSE_MARK_WAITING_HANDOFF'
  | 'CUT_PIECE_WAREHOUSE_MARK_HANDED_OVER'
export type SampleWarehouseActionType =
  | 'SAMPLE_WAREHOUSE_BORROW'
  | 'SAMPLE_WAREHOUSE_RETURN'
  | 'SAMPLE_WAREHOUSE_TRANSFER'
  | 'SAMPLE_WAREHOUSE_MARK_INSPECTION'
export type SampleWarehouseWritebackLocationType = 'cutting-room' | 'production-center' | 'factory' | 'inspection'

interface CuttingWarehouseWritebackBase {
  writebackId: string
  actionType: string
  actionAt: string
  submittedAt: string
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
  sourceChannel: CuttingWarehouseWritebackSourceChannel
  sourceDeviceId: string
  sourceRecordId: string
  sourcePageKey: string
  status: 'RECORDED'
}

export interface CutPieceWarehouseWritebackRecord extends CuttingWarehouseWritebackBase {
  actionType: CutPieceWarehouseActionType
  warehouseRecordId: string
  zoneCode: string
  locationCode: string
  handoverTarget: string
  note: string
}

export interface SampleWarehouseWritebackRecord extends CuttingWarehouseWritebackBase {
  actionType: SampleWarehouseActionType
  sampleRecordId: string
  locationType: SampleWarehouseWritebackLocationType
  holder: string
  note: string
}

export interface CuttingWarehouseWritebackStore {
  cutPieceWritebacks: CutPieceWarehouseWritebackRecord[]
  sampleWritebacks: SampleWarehouseWritebackRecord[]
}

function toArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : []
}

function toString(value: unknown): string {
  return typeof value === 'string' ? value : ''
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
  const submittedAt = toString(raw.submittedAt)
  const actionAt = toString(raw.actionAt) || submittedAt
  return {
    writebackId: toString(raw.writebackId),
    actionType: toString(raw.actionType),
    actionAt,
    submittedAt: submittedAt || actionAt,
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
    sourceChannel: 'CUTTING_WAREHOUSE_UI' as const,
    sourceDeviceId: toString(raw.sourceDeviceId) || 'CUTTING-WAREHOUSE-DESKTOP',
    sourceRecordId: toString(raw.sourceRecordId),
    sourcePageKey: toString(raw.sourcePageKey),
    status: 'RECORDED' as const,
  }
}

function normalizeCutPieceWarehouseWritebackRecord(raw: unknown): CutPieceWarehouseWritebackRecord | null {
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>
  const base = normalizeBaseRecord(record)
  if (!base.writebackId) return null
  return {
    ...base,
    actionType: toString(record.actionType) as CutPieceWarehouseActionType,
    warehouseRecordId: toString(record.warehouseRecordId) || base.sourceRecordId,
    zoneCode: toString(record.zoneCode),
    locationCode: toString(record.locationCode),
    handoverTarget: toString(record.handoverTarget),
    note: toString(record.note),
  }
}

function normalizeSampleWarehouseWritebackRecord(raw: unknown): SampleWarehouseWritebackRecord | null {
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>
  const base = normalizeBaseRecord(record)
  if (!base.writebackId) return null
  const locationType = toString(record.locationType)
  return {
    ...base,
    actionType: toString(record.actionType) as SampleWarehouseActionType,
    sampleRecordId: toString(record.sampleRecordId) || base.sourceRecordId,
    locationType: (['cutting-room', 'production-center', 'factory', 'inspection'].includes(locationType) ? locationType : 'production-center') as SampleWarehouseWritebackLocationType,
    holder: toString(record.holder),
    note: toString(record.note),
  }
}

export function createEmptyCuttingWarehouseWritebackStore(): CuttingWarehouseWritebackStore {
  return {
    cutPieceWritebacks: [],
    sampleWritebacks: [],
  }
}

export function serializeCuttingWarehouseWritebackStorage(store: CuttingWarehouseWritebackStore): string {
  return JSON.stringify(store)
}

export function deserializeCuttingWarehouseWritebackStorage(raw: string | null): CuttingWarehouseWritebackStore {
  if (!raw) return createEmptyCuttingWarehouseWritebackStore()
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return {
      cutPieceWritebacks: sortBySubmittedAtDesc(
        uniqueById(
          toArray(parsed.cutPieceWritebacks)
            .map((item) => normalizeCutPieceWarehouseWritebackRecord(item))
            .filter((item): item is CutPieceWarehouseWritebackRecord => Boolean(item)),
        ),
      ),
      sampleWritebacks: sortBySubmittedAtDesc(
        uniqueById(
          toArray(parsed.sampleWritebacks)
            .map((item) => normalizeSampleWarehouseWritebackRecord(item))
            .filter((item): item is SampleWarehouseWritebackRecord => Boolean(item)),
        ),
      ),
    }
  } catch {
    return createEmptyCuttingWarehouseWritebackStore()
  }
}

export function hydrateCuttingWarehouseWritebackStore(storage?: Pick<Storage, 'getItem'>): CuttingWarehouseWritebackStore {
  if (!storage) return createEmptyCuttingWarehouseWritebackStore()
  return deserializeCuttingWarehouseWritebackStorage(storage.getItem(CUTTING_WAREHOUSE_WRITEBACK_STORAGE_KEY))
}

export function persistCuttingWarehouseWritebackStore(
  store: CuttingWarehouseWritebackStore,
  storage?: Pick<Storage, 'setItem'>,
): void {
  if (!storage) return
  storage.setItem(CUTTING_WAREHOUSE_WRITEBACK_STORAGE_KEY, serializeCuttingWarehouseWritebackStorage(store))
}

function appendUniqueRecord<T extends { writebackId: string; submittedAt: string }>(records: T[], record: T): T[] {
  return sortBySubmittedAtDesc(uniqueById([record, ...records.filter((item) => item.writebackId !== record.writebackId)]))
}

export function appendCutPieceWarehouseWritebackRecord(
  record: CutPieceWarehouseWritebackRecord,
  storage?: Pick<Storage, 'getItem' | 'setItem'>,
): CuttingWarehouseWritebackStore {
  const store = hydrateCuttingWarehouseWritebackStore(storage)
  const nextStore = {
    ...store,
    cutPieceWritebacks: appendUniqueRecord(store.cutPieceWritebacks, record),
  }
  persistCuttingWarehouseWritebackStore(nextStore, storage)
  return nextStore
}

export function appendSampleWarehouseWritebackRecord(
  record: SampleWarehouseWritebackRecord,
  storage?: Pick<Storage, 'getItem' | 'setItem'>,
): CuttingWarehouseWritebackStore {
  const store = hydrateCuttingWarehouseWritebackStore(storage)
  const nextStore = {
    ...store,
    sampleWritebacks: appendUniqueRecord(store.sampleWritebacks, record),
  }
  persistCuttingWarehouseWritebackStore(nextStore, storage)
  return nextStore
}

export function listCutPieceWarehouseWritebacks(storage?: Pick<Storage, 'getItem'>): CutPieceWarehouseWritebackRecord[] {
  return hydrateCuttingWarehouseWritebackStore(storage).cutPieceWritebacks
}

export function listSampleWarehouseWritebacks(storage?: Pick<Storage, 'getItem'>): SampleWarehouseWritebackRecord[] {
  return hydrateCuttingWarehouseWritebackStore(storage).sampleWritebacks
}
