import { getGeneratedCutOrderSourceRecordById } from './generated-cut-orders.ts'
import {
  getMaterialLedgerProjectionByCutOrder,
  type MaterialLedgerProjection,
} from './material-ledger.ts'
import type { CuttingOrderProgressRecord } from './types.ts'

export const CUTTING_CUT_ORDER_CLOSE_RECORDS_STORAGE_KEY = 'cuttingCutOrderCloseRecords'
export const CUTTING_CUT_ORDER_REOPEN_RECORDS_STORAGE_KEY = 'cuttingCutOrderReopenRecords'

export type CutOrderCloseReasonCode = NonNullable<CuttingOrderProgressRecord['closeReasonCode']>
export type CutOrderCloseSourceType = '差异确认' | '人工关闭' | '生产单取消' | '款式取消' | '其他来源'
export type CutOrderCloseImpactSeverity = 'info' | 'warning' | 'critical'

export interface CutOrderCloseImpactItem {
  impactKey:
    | 'AVAILABLE_BALANCE'
    | 'PENDING_DIFFERENCE'
    | 'INVENTORY'
    | 'PENDING_SPECIAL_CRAFT'
    | 'OPEN_HANDOVER'
  label: string
  value: string
  detailText: string
  severity: CutOrderCloseImpactSeverity
}

export interface CutOrderCloseRecord {
  operationKey?: string
  closeRecordId: string
  closeRecordNo: string
  cutOrderId: string
  cutOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  closeReasonCode: CutOrderCloseReasonCode
  closeReasonText: string
  closeDescription: string
  closedAt: string
  closedBy: string
  closeSourceType: CutOrderCloseSourceType
  sourceDifferenceId?: string
  linkedLedgerEventIds: string[]
  ledgerSnapshotBeforeClose: NonNullable<CuttingOrderProgressRecord['ledgerSnapshotBeforeClose']>
  openImpactItems: CutOrderCloseImpactItem[]
  remainingInventorySummary: string
  pendingSpecialCraftSummary: string
  pendingHandoverSummary: string
  createdAt: string
  createdBy: string
}

export interface CutOrderReopenRecord {
  operationKey?: string
  reopenRecordId: string
  reopenRecordNo: string
  cutOrderId: string
  cutOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  reopenedAt: string
  reopenedBy: string
  reopenReason: string
  previousCloseRecordNo: string
  createdAt: string
  createdBy: string
}

export const cutOrderCloseReasonOptions: Array<{ value: CutOrderCloseReasonCode; label: string }> = [
  { value: 'MATERIAL_NO_MORE_ARRIVAL', label: '面料不再到货' },
  { value: 'BUSINESS_STOP_RECUT', label: '业务决定不再继续裁剪' },
  { value: 'FORCED_CLOSE', label: '强行完结' },
  { value: 'STYLE_CANCELLED', label: '款式取消' },
  { value: 'DEMAND_CANCELLED', label: '需求取消' },
  { value: 'MATERIAL_REPLACED_UNUSED', label: '面料替代后不再使用本裁片单' },
  { value: 'OTHER', label: '其他原因' },
]

export function resolveCutOrderCloseReasonText(code?: CutOrderCloseReasonCode): string {
  return cutOrderCloseReasonOptions.find((option) => option.value === code)?.label || '其他原因'
}

function roundQty(value: number): number {
  return Number(Number(value || 0).toFixed(2))
}

export function buildCutOrderLedgerSnapshotBeforeClose(
  projection: MaterialLedgerProjection | null,
): NonNullable<CuttingOrderProgressRecord['ledgerSnapshotBeforeClose']> {
  if (!projection) {
    return {
      requiredMaterialQty: 0,
      transferWarehouseAllocatedQty: 0,
      cuttingClaimedQty: 0,
      spreadingConsumedQty: 0,
      availableQty: 0,
      unit: '米',
    }
  }

  return {
    requiredMaterialQty: roundQty(projection.requiredMaterialQty),
    transferWarehouseAllocatedQty: roundQty(projection.transferWarehouseAllocatedQty),
    cuttingClaimedQty: roundQty(projection.cuttingClaimedQty),
    spreadingConsumedQty: roundQty(projection.spreadingConsumedQty),
    availableQty: roundQty(projection.availableQty),
    unit: projection.unit || projection.materialIdentity.materialUnit || '米',
  }
}

export function formatCutOrderCloseLedgerQty(value: number, unit = '米'): string {
  return `${new Intl.NumberFormat('zh-CN').format(roundQty(value))} ${unit}`
}

export function buildCutOrderCloseImpactItems(input: {
  ledgerSnapshot: NonNullable<CuttingOrderProgressRecord['ledgerSnapshotBeforeClose']>
  pendingDifferenceCount?: number
  inventorySummary?: string
  pendingSpecialCraftSummary?: string
  pendingHandoverSummary?: string
}): CutOrderCloseImpactItem[] {
  const unit = input.ledgerSnapshot.unit || '米'
  const availableQty = Number(input.ledgerSnapshot.availableQty || 0)
  return [
    {
      impactKey: 'AVAILABLE_BALANCE',
      label: '仍有可用余额',
      value: formatCutOrderCloseLedgerQty(availableQty, unit),
      detailText: availableQty > 0 ? '关闭后保留数量账，不再要求继续配料或领料。' : '当前无裁床可用余额。',
      severity: availableQty > 0 ? 'warning' : 'info',
    },
    {
      impactKey: 'PENDING_DIFFERENCE',
      label: '仍有待处理差异',
      value: `${Math.max(input.pendingDifferenceCount || 0, 0)} 项`,
      detailText: (input.pendingDifferenceCount || 0) > 0 ? '关闭不会删除差异记录，后续仍可追溯。' : '当前无待处理差异。',
      severity: (input.pendingDifferenceCount || 0) > 0 ? 'warning' : 'info',
    },
    {
      impactKey: 'INVENTORY',
      label: '仍有裁片库存',
      value: input.inventorySummary || '0 片',
      detailText: input.inventorySummary ? '关闭不影响已生成菲票、库存和后续交出追溯。' : '当前未发现裁片库存。',
      severity: input.inventorySummary ? 'warning' : 'info',
    },
    {
      impactKey: 'PENDING_SPECIAL_CRAFT',
      label: '仍有特殊工艺未回仓',
      value: input.pendingSpecialCraftSummary || '0 片',
      detailText: input.pendingSpecialCraftSummary ? '关闭不删除特殊工艺交出和回仓记录。' : '当前未发现特殊工艺未回仓。',
      severity: input.pendingSpecialCraftSummary ? 'warning' : 'info',
    },
    {
      impactKey: 'OPEN_HANDOVER',
      label: '仍有未关闭交出记录',
      value: input.pendingHandoverSummary || '0 条',
      detailText: input.pendingHandoverSummary ? '关闭不影响交出单和交出记录继续追溯。' : '当前未发现未关闭交出记录。',
      severity: input.pendingHandoverSummary ? 'warning' : 'info',
    },
  ]
}

function normalizeCloseRecord(item: unknown): CutOrderCloseRecord | null {
  const raw = item as Partial<CutOrderCloseRecord> | null
  if (!raw?.cutOrderId || !raw.cutOrderNo || !raw.closeRecordId) return null
  const code = cutOrderCloseReasonOptions.some((option) => option.value === raw.closeReasonCode)
    ? raw.closeReasonCode as CutOrderCloseReasonCode
    : 'OTHER'
  const ledgerSnapshot = buildCutOrderLedgerSnapshotBeforeClose(null)
  const snapshot = raw.ledgerSnapshotBeforeClose || ledgerSnapshot
  return {
    operationKey: raw.operationKey ? String(raw.operationKey) : undefined,
    closeRecordId: String(raw.closeRecordId),
    closeRecordNo: String(raw.closeRecordNo || raw.closeRecordId),
    cutOrderId: String(raw.cutOrderId),
    cutOrderNo: String(raw.cutOrderNo),
    productionOrderId: String(raw.productionOrderId || ''),
    productionOrderNo: String(raw.productionOrderNo || ''),
    closeReasonCode: code,
    closeReasonText: String(raw.closeReasonText || resolveCutOrderCloseReasonText(code)),
    closeDescription: String(raw.closeDescription || ''),
    closedAt: String(raw.closedAt || ''),
    closedBy: String(raw.closedBy || ''),
    closeSourceType: (['差异确认', '人工关闭', '生产单取消', '款式取消', '其他来源'].includes(String(raw.closeSourceType || ''))
      ? raw.closeSourceType
      : '人工关闭') as CutOrderCloseSourceType,
    sourceDifferenceId: raw.sourceDifferenceId ? String(raw.sourceDifferenceId) : undefined,
    linkedLedgerEventIds: Array.isArray(raw.linkedLedgerEventIds)
      ? raw.linkedLedgerEventIds.map((value) => String(value || '')).filter(Boolean)
      : [`ledger:${String(raw.cutOrderId)}:close:${String(raw.closeRecordId)}`],
    ledgerSnapshotBeforeClose: {
      requiredMaterialQty: roundQty(Number(snapshot.requiredMaterialQty || 0)),
      transferWarehouseAllocatedQty: roundQty(Number(snapshot.transferWarehouseAllocatedQty || 0)),
      cuttingClaimedQty: roundQty(Number(snapshot.cuttingClaimedQty || 0)),
      spreadingConsumedQty: roundQty(Number(snapshot.spreadingConsumedQty || 0)),
      availableQty: roundQty(Number(snapshot.availableQty || 0)),
      unit: String(snapshot.unit || '米'),
    },
    openImpactItems: Array.isArray(raw.openImpactItems)
      ? raw.openImpactItems
          .map((impact) => {
            const item = impact as Partial<CutOrderCloseImpactItem>
            if (!item?.impactKey || !item.label) return null
            return {
              impactKey: item.impactKey as CutOrderCloseImpactItem['impactKey'],
              label: String(item.label),
              value: String(item.value || '0'),
              detailText: String(item.detailText || ''),
              severity: (['info', 'warning', 'critical'].includes(String(item.severity || '')) ? item.severity : 'info') as CutOrderCloseImpactSeverity,
            }
          })
          .filter((impact): impact is CutOrderCloseImpactItem => impact !== null)
      : [],
    remainingInventorySummary: String(raw.remainingInventorySummary || ''),
    pendingSpecialCraftSummary: String(raw.pendingSpecialCraftSummary || ''),
    pendingHandoverSummary: String(raw.pendingHandoverSummary || ''),
    createdAt: String(raw.createdAt || raw.closedAt || ''),
    createdBy: String(raw.createdBy || raw.closedBy || ''),
  }
}

export function deserializeCutOrderCloseRecordsStorage(raw: string | null): CutOrderCloseRecord[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map(normalizeCloseRecord)
      .filter((record): record is CutOrderCloseRecord => record !== null)
  } catch {
    return []
  }
}

export function serializeCutOrderCloseRecordsStorage(records: CutOrderCloseRecord[]): string {
  return JSON.stringify(records)
}

export function listStoredCutOrderCloseRecords(
  storage: Pick<Storage, 'getItem'> | null = typeof localStorage === 'undefined' ? null : localStorage,
): CutOrderCloseRecord[] {
  if (!storage || typeof storage.getItem !== 'function') return []
  return deserializeCutOrderCloseRecordsStorage(storage.getItem(CUTTING_CUT_ORDER_CLOSE_RECORDS_STORAGE_KEY))
}

export function saveStoredCutOrderCloseRecords(
  records: CutOrderCloseRecord[],
  storage: Pick<Storage, 'setItem'> | null = typeof localStorage === 'undefined' ? null : localStorage,
): void {
  if (!storage || typeof storage.setItem !== 'function') return
  storage.setItem(CUTTING_CUT_ORDER_CLOSE_RECORDS_STORAGE_KEY, serializeCutOrderCloseRecordsStorage(records))
}

export type CutOrderLifecycleStorage = Pick<Storage, 'getItem' | 'setItem'>

export interface CutOrderLifecycleWriteResult<T> {
  ok: boolean
  record: T
  idempotent: boolean
  conflict: boolean
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, stableValue(item)]))
  }
  return value
}

function sameLifecycleRecord(left: unknown, right: unknown): boolean {
  return JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right))
}

function parseLifecycleCycle(...values: string[]): number {
  for (const value of values) {
    const explicit = value.match(/cycle[-:]?(\d+)/i)
    if (explicit) return Number(explicit[1]) || 0
    const legacySuffix = value.match(/-(\d{4,})(?:[-:][a-z0-9-]+)?$/i)
    if (legacySuffix) return Number(legacySuffix[1]) || 0
  }
  return 0
}

function nextLifecycleSequence(records: Array<{ cutOrderId: string; cutOrderNo: string } & Record<string, unknown>>, cutOrderId: string, cutOrderNo: string, idKey: string, noKey: string): number {
  return records
    .filter((record) => record.cutOrderId === cutOrderId || record.cutOrderNo === cutOrderNo)
    .reduce((max, record) => Math.max(max, parseLifecycleCycle(String(record[idKey] || ''), String(record[noKey] || ''))), 0) + 1
}

function createLifecycleNonce(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID().replaceAll('-', '').slice(0, 12)
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

function hashLifecycleOperationKey(operationKey: string): string {
  let hash = 2166136261
  for (const character of operationKey) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36).padStart(7, '0')
}

export function createCutOrderLifecycleOperationKey(
  action: 'close' | 'reopen',
  cutOrderId: string,
  priorLifecycleRecordId = 'none',
): string {
  return `${action}:${cutOrderId.trim()}:${priorLifecycleRecordId.trim() || 'none'}`
}

export function createNextCutOrderCloseRecordIdentity(
  cutOrderId: string,
  cutOrderNo: string,
  storage: CutOrderLifecycleStorage | null = typeof localStorage === 'undefined' ? null : localStorage,
  operationKey = '',
): Pick<CutOrderCloseRecord, 'closeRecordId' | 'closeRecordNo'> {
  const sequence = nextLifecycleSequence(listStoredCutOrderCloseRecords(storage), cutOrderId, cutOrderNo, 'closeRecordId', 'closeRecordNo')
  const suffix = String(sequence).padStart(4, '0')
  const nonce = operationKey ? hashLifecycleOperationKey(operationKey) : createLifecycleNonce()
  return { closeRecordId: `close:${cutOrderId}:cycle-${suffix}-${nonce}`, closeRecordNo: `CLOSE-${cutOrderNo.replace(/^CUT-?/, '')}-${suffix}-${nonce}` }
}

export function upsertStoredCutOrderCloseRecord(
  record: CutOrderCloseRecord,
  storage: CutOrderLifecycleStorage | null = typeof localStorage === 'undefined' ? null : localStorage,
): CutOrderLifecycleWriteResult<CutOrderCloseRecord> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const records = listStoredCutOrderCloseRecords(storage)
    const existingOperation = record.operationKey
      ? records.find((item) => item.operationKey === record.operationKey)
      : undefined
    if (existingOperation) return { ok: true, record: existingOperation, idempotent: true, conflict: false }
    const existing = records.find((item) => item.closeRecordId === record.closeRecordId)
    if (existing) {
      const idempotent = sameLifecycleRecord(existing, record)
      return { ok: idempotent, record: existing, idempotent, conflict: !idempotent }
    }
    saveStoredCutOrderCloseRecords([...records, record], storage)
    const verified = listStoredCutOrderCloseRecords(storage)
    const stored = record.operationKey
      ? verified.find((item) => item.operationKey === record.operationKey)
      : verified.find((item) => item.closeRecordId === record.closeRecordId)
    if (stored) return { ok: true, record: stored, idempotent: stored.closeRecordId !== record.closeRecordId, conflict: false }
  }
  return { ok: false, record, idempotent: false, conflict: true }
}

export function removeStoredCutOrderCloseRecord(
  closeRecordId: string,
  storage: CutOrderLifecycleStorage | null = typeof localStorage === 'undefined' ? null : localStorage,
): boolean {
  const key = closeRecordId.trim()
  if (!key) return false
  const records = listStoredCutOrderCloseRecords(storage)
  const nextRecords = records.filter((item) => item.closeRecordId !== key)
  if (nextRecords.length === records.length) return false
  saveStoredCutOrderCloseRecords(nextRecords, storage)
  return true
}

function normalizeReopenRecord(item: unknown): CutOrderReopenRecord | null {
  const raw = item as Partial<CutOrderReopenRecord> | null
  if (!raw?.cutOrderId || !raw.cutOrderNo || !raw.reopenRecordId) return null
  return {
    operationKey: raw.operationKey ? String(raw.operationKey) : undefined,
    reopenRecordId: String(raw.reopenRecordId),
    reopenRecordNo: String(raw.reopenRecordNo || raw.reopenRecordId),
    cutOrderId: String(raw.cutOrderId),
    cutOrderNo: String(raw.cutOrderNo),
    productionOrderId: String(raw.productionOrderId || ''),
    productionOrderNo: String(raw.productionOrderNo || ''),
    reopenedAt: String(raw.reopenedAt || raw.createdAt || ''),
    reopenedBy: String(raw.reopenedBy || raw.createdBy || ''),
    reopenReason: String(raw.reopenReason || '业务需要继续针对裁片单补料或铺布执行。'),
    previousCloseRecordNo: String(raw.previousCloseRecordNo || ''),
    createdAt: String(raw.createdAt || raw.reopenedAt || ''),
    createdBy: String(raw.createdBy || raw.reopenedBy || ''),
  }
}

export function deserializeCutOrderReopenRecordsStorage(raw: string | null): CutOrderReopenRecord[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map(normalizeReopenRecord)
      .filter((record): record is CutOrderReopenRecord => record !== null)
  } catch {
    return []
  }
}

export function serializeCutOrderReopenRecordsStorage(records: CutOrderReopenRecord[]): string {
  return JSON.stringify(records)
}

export function listStoredCutOrderReopenRecords(
  storage: Pick<Storage, 'getItem'> | null = typeof localStorage === 'undefined' ? null : localStorage,
): CutOrderReopenRecord[] {
  if (!storage || typeof storage.getItem !== 'function') return []
  return deserializeCutOrderReopenRecordsStorage(storage.getItem(CUTTING_CUT_ORDER_REOPEN_RECORDS_STORAGE_KEY))
}

export function saveStoredCutOrderReopenRecords(
  records: CutOrderReopenRecord[],
  storage: Pick<Storage, 'setItem'> | null = typeof localStorage === 'undefined' ? null : localStorage,
): void {
  if (!storage || typeof storage.setItem !== 'function') return
  storage.setItem(CUTTING_CUT_ORDER_REOPEN_RECORDS_STORAGE_KEY, serializeCutOrderReopenRecordsStorage(records))
}

export function createNextCutOrderReopenRecordIdentity(
  cutOrderId: string,
  cutOrderNo: string,
  storage: CutOrderLifecycleStorage | null = typeof localStorage === 'undefined' ? null : localStorage,
  operationKey = '',
): Pick<CutOrderReopenRecord, 'reopenRecordId' | 'reopenRecordNo'> {
  const sequence = nextLifecycleSequence(listStoredCutOrderReopenRecords(storage), cutOrderId, cutOrderNo, 'reopenRecordId', 'reopenRecordNo')
  const suffix = String(sequence).padStart(4, '0')
  const nonce = operationKey ? hashLifecycleOperationKey(operationKey) : createLifecycleNonce()
  return { reopenRecordId: `reopen:${cutOrderId}:cycle-${suffix}-${nonce}`, reopenRecordNo: `REOPEN-${cutOrderNo.replace(/^CUT-?/, '')}-${suffix}-${nonce}` }
}

export function upsertStoredCutOrderReopenRecord(
  record: CutOrderReopenRecord,
  storage: CutOrderLifecycleStorage | null = typeof localStorage === 'undefined' ? null : localStorage,
): CutOrderLifecycleWriteResult<CutOrderReopenRecord> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const records = listStoredCutOrderReopenRecords(storage)
    const existingOperation = record.operationKey
      ? records.find((item) => item.operationKey === record.operationKey)
      : undefined
    if (existingOperation) return { ok: true, record: existingOperation, idempotent: true, conflict: false }
    const existing = records.find((item) => item.reopenRecordId === record.reopenRecordId)
    if (existing) {
      const idempotent = sameLifecycleRecord(existing, record)
      return { ok: idempotent, record: existing, idempotent, conflict: !idempotent }
    }
    saveStoredCutOrderReopenRecords([...records, record], storage)
    const verified = listStoredCutOrderReopenRecords(storage)
    const stored = record.operationKey
      ? verified.find((item) => item.operationKey === record.operationKey)
      : verified.find((item) => item.reopenRecordId === record.reopenRecordId)
    if (stored) return { ok: true, record: stored, idempotent: stored.reopenRecordId !== record.reopenRecordId, conflict: false }
  }
  return { ok: false, record, idempotent: false, conflict: true }
}

export function removeStoredCutOrderReopenRecord(
  reopenRecordId: string,
  storage: CutOrderLifecycleStorage | null = typeof localStorage === 'undefined' ? null : localStorage,
): boolean {
  const key = reopenRecordId.trim()
  if (!key) return false
  const records = listStoredCutOrderReopenRecords(storage)
  const nextRecords = records.filter((item) => item.reopenRecordId !== key)
  if (nextRecords.length === records.length) return false
  saveStoredCutOrderReopenRecords(nextRecords, storage)
  return true
}

export function buildCutOrderReopenRecordLookup(): Record<string, CutOrderReopenRecord> {
  const entries: Array<[string, CutOrderReopenRecord]> = []
  listStoredCutOrderReopenRecords()
    .sort((left, right) => compareLifecycleEvents(
      { occurredAt: left.reopenedAt || left.createdAt, cycle: parseLifecycleCycle(left.reopenRecordId, left.reopenRecordNo), recordId: left.reopenRecordId },
      { occurredAt: right.reopenedAt || right.createdAt, cycle: parseLifecycleCycle(right.reopenRecordId, right.reopenRecordNo), recordId: right.reopenRecordId },
    ))
    .forEach((record) => {
    entries.push([record.cutOrderId, record])
    entries.push([record.cutOrderNo, record])
  })
  return Object.fromEntries(entries)
}

function compareLifecycleEvents(
  left: { occurredAt: string; cycle: number; recordId: string },
  right: { occurredAt: string; cycle: number; recordId: string },
): number {
  return left.occurredAt.localeCompare(right.occurredAt, 'zh-CN')
    || left.cycle - right.cycle
    || left.recordId.localeCompare(right.recordId, 'zh-CN')
}

function buildSeedCloseRecord(input: {
  cutOrderNo: string
  reasonCode: CutOrderCloseReasonCode
  description: string
  closedAt: string
  closedBy: string
  sourceType: CutOrderCloseSourceType
  pendingDifferenceCount?: number
  inventorySummary?: string
  pendingSpecialCraftSummary?: string
  pendingHandoverSummary?: string
}): CutOrderCloseRecord | null {
  const source = getGeneratedCutOrderSourceRecordById(input.cutOrderNo)
  if (!source) return null
  const ledgerSnapshot = buildCutOrderLedgerSnapshotBeforeClose(getMaterialLedgerProjectionByCutOrder(source.cutOrderId))
  return {
    closeRecordId: `close-${source.cutOrderId}`,
    closeRecordNo: `CLOSE-${source.cutOrderNo.replace(/^CUT-/, '')}`,
    cutOrderId: source.cutOrderId,
    cutOrderNo: source.cutOrderNo,
    productionOrderId: source.productionOrderId,
    productionOrderNo: source.productionOrderNo,
    closeReasonCode: input.reasonCode,
    closeReasonText: resolveCutOrderCloseReasonText(input.reasonCode),
    closeDescription: input.description,
    closedAt: input.closedAt,
    closedBy: input.closedBy,
    closeSourceType: input.sourceType,
    linkedLedgerEventIds: [`ledger:${source.cutOrderId}:close:close-${source.cutOrderId}`],
    ledgerSnapshotBeforeClose: ledgerSnapshot,
    openImpactItems: buildCutOrderCloseImpactItems({
      ledgerSnapshot,
      pendingDifferenceCount: input.pendingDifferenceCount,
      inventorySummary: input.inventorySummary,
      pendingSpecialCraftSummary: input.pendingSpecialCraftSummary,
      pendingHandoverSummary: input.pendingHandoverSummary,
    }),
    remainingInventorySummary: input.inventorySummary || '0 片',
    pendingSpecialCraftSummary: input.pendingSpecialCraftSummary || '0 片',
    pendingHandoverSummary: input.pendingHandoverSummary || '0 条',
    createdAt: input.closedAt,
    createdBy: input.closedBy,
  }
}

export function listSystemCutOrderCloseRecords(): CutOrderCloseRecord[] {
  return [
    buildSeedCloseRecord({
      cutOrderNo: 'CUT-260306-101-04',
      reasonCode: 'MATERIAL_NO_MORE_ARRIVAL',
      description: '面料 155cm 幅宽批次不再到货，保留历史铺布、菲票和库存追溯。',
      closedAt: '2026-03-26 17:40',
      closedBy: '裁床主管 何倩',
      sourceType: '人工关闭',
      pendingDifferenceCount: 1,
      inventorySummary: '48 片',
      pendingHandoverSummary: '1 条',
    }),
    buildSeedCloseRecord({
      cutOrderNo: 'CUT-260306-101-06',
      reasonCode: 'BUSINESS_STOP_RECUT',
      description: '历史组合组 B 仅保留已裁出部分，业务决定不再继续排唛架。',
      closedAt: '2026-03-27 15:20',
      closedBy: '差异确认员 徐海宁',
      sourceType: '差异确认',
      pendingDifferenceCount: 2,
      inventorySummary: '72 片',
      pendingSpecialCraftSummary: '绣花后片 32 片未回仓',
    }),
    buildSeedCloseRecord({
      cutOrderNo: 'CUT-260307-102-03',
      reasonCode: 'FORCED_CLOSE',
      description: '跨生产单同组排唛架不再继续，强行完结并保留交出记录。',
      closedAt: '2026-03-28 18:10',
      closedBy: '生产经理 林悦',
      sourceType: '人工关闭',
      pendingDifferenceCount: 1,
      inventorySummary: '120 片',
      pendingHandoverSummary: '2 条',
    }),
  ].filter((record): record is CutOrderCloseRecord => record !== null)
}

export function listCutOrderCloseRecords(): CutOrderCloseRecord[] {
  return [...listSystemCutOrderCloseRecords(), ...listStoredCutOrderCloseRecords()]
}

export function resolveActiveCutOrderCloseRecords(
  closeRecords: CutOrderCloseRecord[],
  reopenRecords: CutOrderReopenRecord[],
): CutOrderCloseRecord[] {
  const byCutOrder = new Map<string, Array<{
    kind: 'close' | 'reopen'
    occurredAt: string
    cycle: number
    recordId: string
    closeRecord?: CutOrderCloseRecord
  }>>()
  closeRecords.forEach((record) => {
    const events = byCutOrder.get(record.cutOrderId) ?? []
    events.push({ kind: 'close', occurredAt: record.closedAt || record.createdAt, cycle: parseLifecycleCycle(record.closeRecordId, record.closeRecordNo), recordId: record.closeRecordId, closeRecord: record })
    byCutOrder.set(record.cutOrderId, events)
  })
  reopenRecords.forEach((record) => {
    const events = byCutOrder.get(record.cutOrderId) ?? []
    events.push({ kind: 'reopen', occurredAt: record.reopenedAt || record.createdAt, cycle: parseLifecycleCycle(record.reopenRecordId, record.reopenRecordNo), recordId: record.reopenRecordId })
    byCutOrder.set(record.cutOrderId, events)
  })
  return [...byCutOrder.values()].flatMap((events) => {
    const latest = [...events].sort(compareLifecycleEvents).at(-1)
    return latest?.kind === 'close' && latest.closeRecord ? [latest.closeRecord] : []
  })
}

export function listActiveCutOrderCloseRecords(): CutOrderCloseRecord[] {
  return resolveActiveCutOrderCloseRecords(listCutOrderCloseRecords(), listStoredCutOrderReopenRecords())
}

export function buildCutOrderCloseRecordLookup(
  records: CutOrderCloseRecord[] = listActiveCutOrderCloseRecords(),
): Record<string, CutOrderCloseRecord> {
  const entries: Array<[string, CutOrderCloseRecord]> = []
  records.forEach((record) => {
    entries.push([record.cutOrderId, record])
    entries.push([record.cutOrderNo, record])
  })
  return Object.fromEntries(entries)
}

export function applyCutOrderCloseRecordToProgressRecord(
  record: CuttingOrderProgressRecord,
  closeRecord: CutOrderCloseRecord | null | undefined,
): CuttingOrderProgressRecord {
  if (!closeRecord) return record
  return {
    ...record,
    cuttingStage: '已关闭',
    closeReasonCode: closeRecord.closeReasonCode,
    closeReasonText: closeRecord.closeReasonText,
    closeReason: closeRecord.closeDescription || closeRecord.closeReasonText,
    closedAt: closeRecord.closedAt,
    closedBy: closeRecord.closedBy,
    ledgerSnapshotBeforeClose: closeRecord.ledgerSnapshotBeforeClose,
  }
}

export function applyCutOrderReopenRecordToProgressRecord(
  record: CuttingOrderProgressRecord,
  reopenRecord: CutOrderReopenRecord | null | undefined,
): CuttingOrderProgressRecord {
  if (!reopenRecord) return record
  const reopenedStage = record.hasSpreadingRecord || record.hasInboundRecord ? '已开工' : '待中转仓配料'
  return {
    ...record,
    cuttingStage: /已关闭|不再继续裁剪/.test(record.cuttingStage) ? reopenedStage : record.cuttingStage,
    closeReasonCode: undefined,
    closeReasonText: '',
    closeReason: '',
    closedAt: '',
    closedBy: '',
    ledgerSnapshotBeforeClose: undefined,
    lastOperatorName: reopenRecord.reopenedBy || record.lastOperatorName,
    lastFieldUpdateAt: reopenRecord.reopenedAt || record.lastFieldUpdateAt,
  }
}
