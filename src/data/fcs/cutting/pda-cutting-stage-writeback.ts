import { getBrowserLocalStorage, type BrowserStorageLike } from '../../browser-storage.ts'

export const CUTTING_PDA_STAGE_WRITEBACK_STORAGE_KEY = 'cuttingPdaStageWritebackLedger'

export type PdaCuttingStageActionType =
  | 'START_WORK'
  | 'START_SPREADING'
  | 'FINISH_SPREADING'
  | 'START_CUTTING'
  | 'FINISH_CUTTING'

export type PdaCuttingSyncStatus = '已同步' | '待同步' | '同步失败'

export interface PdaCuttingStageWritebackRecord {
  writebackId: string
  taskId: string
  executionOrderId: string
  executionOrderNo: string
  cutOrderId: string
  cutOrderNo: string
  markerPlanId: string
  markerPlanNo: string
  actionType: PdaCuttingStageActionType
  actionLabel: string
  submittedAt: string
  operatorName: string
  syncStatus: PdaCuttingSyncStatus
  actualLayerCount?: number
  actualSpreadLength?: number
  headLength?: number
  tailLength?: number
  actualCutQty?: number
  actualUsage?: number
  varianceFlag?: boolean
  note: string
}

export interface PdaCuttingStageWritebackStore {
  records: PdaCuttingStageWritebackRecord[]
}

function nowText(date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function compactTimestamp(value: string): string {
  return value.replace(/[^0-9]/g, '').slice(0, 14)
}

function toString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function toNumber(value: unknown): number | undefined {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : undefined
}

function normalizeSyncStatus(value: unknown): PdaCuttingSyncStatus {
  if (value === '待同步' || value === '同步失败') return value
  return '已同步'
}

function normalizeActionType(value: unknown): PdaCuttingStageActionType {
  if (value === 'START_WORK') return 'START_WORK'
  if (value === 'START_SPREADING') return 'START_SPREADING'
  if (value === 'FINISH_SPREADING') return 'FINISH_SPREADING'
  if (value === 'START_CUTTING') return 'START_CUTTING'
  if (value === 'FINISH_CUTTING') return 'FINISH_CUTTING'
  return 'START_WORK'
}

function actionLabel(actionType: PdaCuttingStageActionType): string {
  if (actionType === 'START_WORK') return '开工'
  if (actionType === 'START_SPREADING') return '开始铺布'
  if (actionType === 'FINISH_SPREADING') return '完成铺布'
  if (actionType === 'START_CUTTING') return '开始裁剪'
  return '完成裁剪'
}

function sortDesc(records: PdaCuttingStageWritebackRecord[]): PdaCuttingStageWritebackRecord[] {
  return records.slice().sort((left, right) => right.submittedAt.localeCompare(left.submittedAt, 'zh-CN'))
}

function uniqueById(records: PdaCuttingStageWritebackRecord[]): PdaCuttingStageWritebackRecord[] {
  const seen = new Set<string>()
  return records.filter((record) => {
    if (!record.writebackId || seen.has(record.writebackId)) return false
    seen.add(record.writebackId)
    return true
  })
}

function normalizeRecord(raw: unknown): PdaCuttingStageWritebackRecord | null {
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>
  const actionType = normalizeActionType(record.actionType)
  const writebackId = toString(record.writebackId)
  if (!writebackId) return null
  return {
    writebackId,
    taskId: toString(record.taskId),
    executionOrderId: toString(record.executionOrderId),
    executionOrderNo: toString(record.executionOrderNo),
    cutOrderId: toString(record.cutOrderId),
    cutOrderNo: toString(record.cutOrderNo),
    markerPlanId: toString(record.markerPlanId),
    markerPlanNo: toString(record.markerPlanNo),
    actionType,
    actionLabel: toString(record.actionLabel) || actionLabel(actionType),
    submittedAt: toString(record.submittedAt),
    operatorName: toString(record.operatorName) || '现场操作员',
    syncStatus: normalizeSyncStatus(record.syncStatus),
    actualLayerCount: toNumber(record.actualLayerCount),
    actualSpreadLength: toNumber(record.actualSpreadLength),
    headLength: toNumber(record.headLength),
    tailLength: toNumber(record.tailLength),
    actualCutQty: toNumber(record.actualCutQty),
    actualUsage: toNumber(record.actualUsage),
    varianceFlag: Boolean(record.varianceFlag),
    note: toString(record.note),
  }
}

function createSeededStore(): PdaCuttingStageWritebackStore {
  return {
    records: [
      {
        writebackId: 'PDA-STAGE-SEED-SYNC-FAIL-0310',
        taskId: 'TASK-CUT-PDA-SYNC-FAIL-0310',
        executionOrderId: 'CPO-PDA-0310',
        executionOrderNo: 'CPO-PDA-0310',
        cutOrderId: '',
        cutOrderNo: 'CUT-260303-007-01',
        markerPlanId: '',
        markerPlanNo: '',
        actionType: 'START_SPREADING',
        actionLabel: '开始铺布',
        submittedAt: '2026-03-18 11:18:00',
        operatorName: 'Sari Wulandari',
        syncStatus: '同步失败',
        actualLayerCount: 18,
        actualSpreadLength: 36,
        varianceFlag: true,
        note: 'PDA 已提交开始铺布，但网络中断，等待重新同步。',
      },
    ],
  }
}

export function serializePdaCuttingStageWritebackStore(store: PdaCuttingStageWritebackStore): string {
  return JSON.stringify(store)
}

export function deserializePdaCuttingStageWritebackStore(raw: string | null): PdaCuttingStageWritebackStore {
  const seeded = createSeededStore()
  if (!raw) return seeded
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const records = Array.isArray(parsed.records)
      ? parsed.records.map((item) => normalizeRecord(item)).filter((item): item is PdaCuttingStageWritebackRecord => Boolean(item))
      : []
    return {
      records: sortDesc(uniqueById([...records, ...seeded.records])),
    }
  } catch {
    return seeded
  }
}

export function hydratePdaCuttingStageWritebackStore(
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): PdaCuttingStageWritebackStore {
  return deserializePdaCuttingStageWritebackStore(storage?.getItem(CUTTING_PDA_STAGE_WRITEBACK_STORAGE_KEY) ?? null)
}

export function persistPdaCuttingStageWritebackStore(
  store: PdaCuttingStageWritebackStore,
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): void {
  if (!storage) return
  storage.setItem(CUTTING_PDA_STAGE_WRITEBACK_STORAGE_KEY, serializePdaCuttingStageWritebackStore(store))
}

export function appendPdaCuttingStageWritebackRecord(
  record: Omit<PdaCuttingStageWritebackRecord, 'writebackId' | 'actionLabel' | 'submittedAt'> & {
    writebackId?: string
    actionLabel?: string
    submittedAt?: string
  },
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): PdaCuttingStageWritebackRecord {
  const submittedAt = record.submittedAt || nowText()
  const writebackId =
    record.writebackId ||
    `pda-stage-${record.actionType.toLowerCase()}-${record.taskId}-${record.executionOrderId}-${compactTimestamp(submittedAt)}`
  const nextRecord: PdaCuttingStageWritebackRecord = {
    ...record,
    writebackId,
    actionLabel: record.actionLabel || actionLabel(record.actionType),
    submittedAt,
  }
  const store = hydratePdaCuttingStageWritebackStore(storage)
  persistPdaCuttingStageWritebackStore({
    records: sortDesc(uniqueById([nextRecord, ...store.records])),
  }, storage)
  return nextRecord
}

export function listPdaCuttingStageWritebackRecords(
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): PdaCuttingStageWritebackRecord[] {
  return hydratePdaCuttingStageWritebackStore(storage).records
}

export function listPdaCuttingStageWritebacksByExecution(
  taskId: string,
  executionOrderId: string,
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): PdaCuttingStageWritebackRecord[] {
  return listPdaCuttingStageWritebackRecords(storage)
    .filter((record) => record.taskId === taskId && record.executionOrderId === executionOrderId)
    .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt, 'zh-CN'))
}

export function getLatestPdaCuttingStageWritebackByExecution(
  taskId: string,
  executionOrderId: string,
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): PdaCuttingStageWritebackRecord | null {
  return listPdaCuttingStageWritebacksByExecution(taskId, executionOrderId, storage)[0] ?? null
}
