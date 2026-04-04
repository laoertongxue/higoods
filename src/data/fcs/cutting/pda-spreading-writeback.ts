import type {
  MarkerSpreadingContext,
  MarkerSpreadingStore,
  SpreadingOperatorRecord,
  SpreadingRollRecord,
  SpreadingSession,
  SpreadingSourceChannel,
} from './marker-spreading-ledger.ts'
import { upsertSpreadingSession } from './marker-spreading-ledger.ts'

export const CUTTING_PDA_WRITEBACK_STORAGE_KEY = 'cuttingPdaWritebackInbox'

export type PdaWritebackStatusKey = 'PENDING_REVIEW' | 'APPLIED' | 'CONFLICT' | 'PENDING_SUPPLEMENT' | 'REJECTED'
export type PdaSpreadingMode = 'NORMAL' | 'HIGH_LOW' | 'FOLD_NORMAL' | 'FOLD_HIGH_LOW'
export type PdaSpreadingRecordType = '开始铺布' | '中途交接' | '接手继续' | '完成铺布'

export interface PdaSpreadingPlanUnitSnapshot {
  planUnitId: string
  sourceType: 'marker-line' | 'high-low-row' | 'exception'
  sourceLineId: string
  color: string
  materialSku: string
  garmentQtyPerUnit: number
  plannedRepeatCount: number
  lengthPerUnitM: number
  plannedCutGarmentQty: number
  plannedSpreadLengthM: number
}

export interface PdaSpreadingRollWritebackItem {
  rollWritebackItemId: string
  writebackId: string
  planUnitId: string
  rollNo: string
  materialSku: string
  color?: string
  width: number
  labeledLength: number
  actualSpreadLengthM: number
  headLossM: number
  tailLossM: number
  spreadLayerCount: number
  actualLength: number
  headLength: number
  tailLength: number
  layerCount: number
  usableLength: number
  note: string
}

export interface PdaSpreadingOperatorWritebackItem {
  operatorWritebackItemId: string
  writebackId: string
  rollWritebackItemId: string
  operatorAccountId: string
  operatorName: string
  startAt: string
  endAt: string
  actionType: string
  handoverFlag: boolean
  handoverToAccountId: string
  handoverToName: string
  note: string
}

export interface PdaWritebackValidationResult {
  isValid: boolean
  matchedContextType: 'original-order' | 'merge-batch' | ''
  matchedOriginalCutOrderIds: string[]
  matchedMergeBatchId: string
  hasConflict: boolean
  hasMissingField: boolean
  hasOccupancyConflict: boolean
  issues: string[]
}

export interface PdaWritebackApplyResult {
  applied: boolean
  createdSessionId: string
  updatedSessionId: string
  createdRollCount: number
  updatedRollCount: number
  createdOperatorCount: number
  updatedOperatorCount: number
  auditTrailIds: string[]
  warningMessages: string[]
  nextStore: MarkerSpreadingStore
}

export interface PdaWritebackAuditTrail {
  auditTrailId: string
  writebackId: string
  action: 'IMPORT' | 'APPLY' | 'FORCE_APPLY' | 'REJECT' | 'MARK_PENDING_SUPPLEMENT' | 'SAVE_SUPPLEMENT'
  actionBy: string
  actionAt: string
  targetSessionId: string
  note: string
}

export interface PdaSupplementDraft {
  writebackId: string
  sourceAccountId: string
  sourceAccountName: string
  originalCutOrderIdsText: string
  originalCutOrderNosText: string
  mergeBatchId: string
  mergeBatchNo: string
  note: string
}

export interface PdaSettlementReserveFields {
  sourceAccountId: string
  sourceAccountName: string
  operatorCount: number
  rollCount: number
  totalLayerCount: number
  totalActualLength: number
}

export interface PdaWritebackSessionComparison {
  matchedSessionId: string
  duplicateRollNos: string[]
  conflictingRollNos: string[]
  newRollNos: string[]
  issues: string[]
  hasConflict: boolean
}

export interface PdaSpreadingWriteback {
  writebackId: string
  writebackNo: string
  sourceChannel: 'pda'
  sourceAccountId: string
  sourceAccountName: string
  sourceDeviceId: string
  submittedAt: string
  occurredAt: string
  payloadVersion: string
  contextType: 'original-order' | 'merge-batch'
  spreadingSessionId: string
  markerId: string
  markerNo: string
  spreadingMode: PdaSpreadingMode
  recordType: PdaSpreadingRecordType
  originalCutOrderIds: string[]
  originalCutOrderNos: string[]
  mergeBatchId: string
  mergeBatchNo: string
  productionOrderNos: string[]
  styleCode: string
  spuCode: string
  status: PdaWritebackStatusKey
  note: string
  planUnits: PdaSpreadingPlanUnitSnapshot[]
  rollItems: PdaSpreadingRollWritebackItem[]
  operatorItems: PdaSpreadingOperatorWritebackItem[]
  validationIssues: string[]
  warningMessages: string[]
  appliedSessionId: string
  appliedAt: string
  appliedBy: string
  settlementReserve: PdaSettlementReserveFields
}

export interface PdaWritebackStore {
  writebacks: PdaSpreadingWriteback[]
  auditTrails: PdaWritebackAuditTrail[]
}

export interface PdaWritebackStats {
  pendingReviewCount: number
  appliedCount: number
  conflictCount: number
  pendingSupplementCount: number
  todayCount: number
  accountCount: number
  rollCount: number
  originalCutOrderCount: number
}

const writebackStatusMeta: Record<PdaWritebackStatusKey, { label: string; className: string; detailText: string }> = {
  PENDING_REVIEW: {
    label: '待审核',
    className: 'bg-amber-100 text-amber-700 border border-amber-200',
    detailText: '已进入后台收件箱，等待人工查看与应用。',
  },
  APPLIED: {
    label: '已应用',
    className: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    detailText: '已将 PDA 回写并入当前铺布记录，并保留来源痕迹。',
  },
  CONFLICT: {
    label: '冲突待处理',
    className: 'bg-rose-100 text-rose-700 border border-rose-200',
    detailText: '当前回写与既有 session 或上下文冲突，不能静默覆盖。',
  },
  PENDING_SUPPLEMENT: {
    label: '待补录',
    className: 'bg-blue-100 text-blue-700 border border-blue-200',
    detailText: '关键字段缺失，需要后台补录后再次校验。',
  },
  REJECTED: {
    label: '已驳回',
    className: 'bg-slate-100 text-slate-700 border border-slate-200',
    detailText: '当前回写已驳回，但记录仍保留在收件箱中供后续审计。',
  },
}

function normalizeSpreadingMode(value: unknown): PdaSpreadingMode {
  if (value === 'HIGH_LOW') return 'HIGH_LOW'
  if (value === 'FOLD_HIGH_LOW') return 'FOLD_HIGH_LOW'
  if (value === 'FOLD_NORMAL' || value === 'FOLD') return 'FOLD_NORMAL'
  return 'NORMAL'
}

function mapWritebackModeToSessionMode(mode: PdaSpreadingMode): SpreadingSession['spreadingMode'] {
  if (mode === 'HIGH_LOW') return 'high_low'
  if (mode === 'FOLD_HIGH_LOW') return 'fold_high_low'
  if (mode === 'FOLD_NORMAL') return 'fold_normal'
  return 'normal'
}

function mapSessionModeToWritebackMode(mode: SpreadingSession['spreadingMode'] | undefined): PdaSpreadingMode {
  if (mode === 'high_low') return 'HIGH_LOW'
  if (mode === 'fold_high_low') return 'FOLD_HIGH_LOW'
  if (mode === 'fold_normal') return 'FOLD_NORMAL'
  return 'NORMAL'
}

function nowText(input = new Date()): string {
  const year = input.getFullYear()
  const month = `${input.getMonth() + 1}`.padStart(2, '0')
  const day = `${input.getDate()}`.padStart(2, '0')
  const hours = `${input.getHours()}`.padStart(2, '0')
  const minutes = `${input.getMinutes()}`.padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

function buildWritebackTimestampId(prefix: string, input: Date = new Date(), suffix = Math.random().toString(16).slice(2, 6)): string {
  const compact = input.toISOString().replace(/[-:.TZ]/g, '').slice(2, 14)
  return `${prefix}-${compact}-${suffix}`
}

function uniqueStrings(values: Array<string | undefined | null>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))))
}

function toArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : []
}

function toNumber(value: unknown): number {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

function computeUsableLength(actualLength: number, headLength: number, tailLength: number): number {
  return Math.max(actualLength - headLength - tailLength, 0)
}

function countTotalLayers(rollItems: PdaSpreadingRollWritebackItem[]): number {
  return rollItems.reduce((sum, item) => sum + Math.max(item.layerCount, 0), 0)
}

function countActualLength(rollItems: PdaSpreadingRollWritebackItem[]): number {
  return Number(rollItems.reduce((sum, item) => sum + Math.max(item.actualLength, 0), 0).toFixed(2))
}

export function createEmptyPdaWritebackStore(): PdaWritebackStore {
  return { writebacks: [], auditTrails: [] }
}

export function derivePdaWritebackStatus(status: PdaWritebackStatusKey): {
  key: PdaWritebackStatusKey
  label: string
  className: string
  detailText: string
} {
  const meta = writebackStatusMeta[status]
  return { key: status, label: meta.label, className: meta.className, detailText: meta.detailText }
}

export function buildSettlementReserveFields(
  payload: Pick<PdaSpreadingWriteback, 'sourceAccountId' | 'sourceAccountName' | 'rollItems' | 'operatorItems'>,
): PdaSettlementReserveFields {
  // 这些字段仅为后续计件结算 / 绩效统计预留，本步不形成正式结算口径。
  return {
    sourceAccountId: payload.sourceAccountId,
    sourceAccountName: payload.sourceAccountName,
    operatorCount: payload.operatorItems.length,
    rollCount: payload.rollItems.length,
    totalLayerCount: countTotalLayers(payload.rollItems),
    totalActualLength: countActualLength(payload.rollItems),
  }
}

export function normalizePdaWritebackPayload(rawPayload: unknown): PdaSpreadingWriteback {
  const raw = (rawPayload ?? {}) as Record<string, unknown>
  const writebackId = String(raw.writebackId || buildWritebackTimestampId('pda-writeback'))

  const planUnits = toArray<Record<string, unknown>>(raw.planUnits).map((item, index) => ({
    planUnitId: String(item.planUnitId || `${writebackId}-plan-unit-${index + 1}`),
    sourceType: item.sourceType === 'high-low-row' ? 'high-low-row' : item.sourceType === 'exception' ? 'exception' : 'marker-line',
    sourceLineId: String(item.sourceLineId || `${index + 1}`),
    color: String(item.color || ''),
    materialSku: String(item.materialSku || ''),
    garmentQtyPerUnit: toNumber(item.garmentQtyPerUnit),
    plannedRepeatCount: toNumber(item.plannedRepeatCount),
    lengthPerUnitM: toNumber(item.lengthPerUnitM),
    plannedCutGarmentQty: toNumber(item.plannedCutGarmentQty),
    plannedSpreadLengthM: toNumber(item.plannedSpreadLengthM),
  }))

  const rollItems = toArray<Record<string, unknown>>(raw.rollItems).map((item, index) => {
    const actualLength = toNumber(item.actualSpreadLengthM ?? item.actualLength)
    const headLength = toNumber(item.headLossM ?? item.headLength)
    const tailLength = toNumber(item.tailLossM ?? item.tailLength)
    const layerCount = toNumber(item.spreadLayerCount ?? item.layerCount)
    return {
      rollWritebackItemId: String(item.rollWritebackItemId || `${writebackId}-roll-${index + 1}`),
      writebackId,
      planUnitId: String(item.planUnitId || ''),
      rollNo: String(item.rollNo || item.fabricRollNo || ''),
      materialSku: String(item.materialSku || ''),
      color: String(item.color || ''),
      width: toNumber(item.width),
      labeledLength: toNumber(item.labeledLength),
      actualSpreadLengthM: actualLength,
      headLossM: headLength,
      tailLossM: tailLength,
      spreadLayerCount: layerCount,
      actualLength,
      headLength,
      tailLength,
      layerCount,
      usableLength: toNumber(item.usableLength) || computeUsableLength(actualLength, headLength, tailLength),
      note: String(item.note || ''),
    }
  })

  const operatorItems = toArray<Record<string, unknown>>(raw.operatorItems).map((item, index) => ({
    operatorWritebackItemId: String(item.operatorWritebackItemId || `${writebackId}-operator-${index + 1}`),
    writebackId,
    rollWritebackItemId: String(item.rollWritebackItemId || rollItems[0]?.rollWritebackItemId || `${writebackId}-roll-1`),
    operatorAccountId: String(item.operatorAccountId || ''),
    operatorName: String(item.operatorName || ''),
    startAt: String(item.startAt || ''),
    endAt: String(item.endAt || ''),
    actionType: String(item.actionType || '铺布'),
    handoverFlag: Boolean(item.handoverFlag),
    handoverToAccountId: String(item.handoverToAccountId || ''),
    handoverToName: String(item.handoverToName || ''),
    note: String(item.note || ''),
  }))

  const normalized: PdaSpreadingWriteback = {
    writebackId,
    writebackNo: String(raw.writebackNo || `PDA-WB-${new Date().getFullYear()}${`${new Date().getMonth() + 1}`.padStart(2, '0')}${`${new Date().getDate()}`.padStart(2, '0')}-${Math.floor(Math.random() * 900 + 100)}`),
    sourceChannel: 'pda',
    sourceAccountId: String(raw.sourceAccountId || ''),
    sourceAccountName: String(raw.sourceAccountName || ''),
    sourceDeviceId: String(raw.sourceDeviceId || ''),
    submittedAt: String(raw.submittedAt || nowText()),
    occurredAt: String(raw.occurredAt || raw.submittedAt || nowText()),
    payloadVersion: String(raw.payloadVersion || 'v1'),
    contextType: raw.contextType === 'merge-batch' ? 'merge-batch' : 'original-order',
    spreadingSessionId: String(raw.spreadingSessionId || ''),
    markerId: String(raw.markerId || ''),
    markerNo: String(raw.markerNo || ''),
    spreadingMode: normalizeSpreadingMode(raw.spreadingMode),
    recordType: (raw.recordType as PdaSpreadingRecordType) || '开始铺布',
    originalCutOrderIds: uniqueStrings(toArray<string>(raw.originalCutOrderIds)),
    originalCutOrderNos: uniqueStrings(toArray<string>(raw.originalCutOrderNos)),
    mergeBatchId: String(raw.mergeBatchId || ''),
    mergeBatchNo: String(raw.mergeBatchNo || ''),
    productionOrderNos: uniqueStrings(toArray<string>(raw.productionOrderNos)),
    styleCode: String(raw.styleCode || ''),
    spuCode: String(raw.spuCode || ''),
    status: (raw.status as PdaWritebackStatusKey) || 'PENDING_REVIEW',
    note: String(raw.note || ''),
    planUnits,
    rollItems,
    operatorItems,
    validationIssues: uniqueStrings(toArray<string>(raw.validationIssues)),
    warningMessages: uniqueStrings(toArray<string>(raw.warningMessages)),
    appliedSessionId: String(raw.appliedSessionId || ''),
    appliedAt: String(raw.appliedAt || ''),
    appliedBy: String(raw.appliedBy || ''),
    settlementReserve: buildSettlementReserveFields({
      sourceAccountId: String(raw.sourceAccountId || ''),
      sourceAccountName: String(raw.sourceAccountName || ''),
      rollItems,
      operatorItems,
    }),
  }

  return normalized
}

export function validatePdaWritebackPayload(writeback: PdaSpreadingWriteback): PdaWritebackValidationResult {
  const issues: string[] = []

  if (!writeback.sourceAccountId || !writeback.sourceAccountName) {
    issues.push('来源账号缺失，需要先补录账号后再应用。')
  }
  if (!writeback.originalCutOrderIds.length || !writeback.originalCutOrderNos.length) {
    issues.push('缺少原始裁片单追溯信息，不能直接应用。')
  }
  if (writeback.contextType === 'merge-batch' && !writeback.mergeBatchId && !writeback.mergeBatchNo) {
    issues.push('批次上下文缺少 mergeBatchId / mergeBatchNo。')
  }
  if (!writeback.rollItems.length) {
    issues.push('当前回写未携带卷记录，无法形成有效铺布回写。')
  }
  if (!writeback.spreadingMode) {
    issues.push('当前回写缺少铺布模式。')
  }
  if (!writeback.planUnits.length) {
    issues.push('当前回写缺少计划单元快照。')
  }

  const invalidRoll = writeback.rollItems.find((item) => !item.planUnitId || !item.rollNo || !item.materialSku || item.actualLength <= 0)
  if (invalidRoll) {
    issues.push(`卷记录 ${invalidRoll.rollNo || '待补卷号'} 缺少关键字段。`)
  }

  const invalidOperator = writeback.operatorItems.find(
    (item) => !item.operatorName || !item.operatorAccountId || !item.rollWritebackItemId,
  )
  if (invalidOperator) {
    issues.push('存在缺少人员账号、姓名或绑定卷号的操作记录。')
  }

  return {
    isValid: issues.length === 0,
    matchedContextType: writeback.contextType,
    matchedOriginalCutOrderIds: [...writeback.originalCutOrderIds],
    matchedMergeBatchId: writeback.mergeBatchId,
    hasConflict: false,
    hasMissingField: issues.length > 0,
    hasOccupancyConflict: false,
    issues,
  }
}

export function matchWritebackToSpreadingContext(
  writeback: PdaSpreadingWriteback,
  context: MarkerSpreadingContext | null,
): PdaWritebackValidationResult {
  const base = validatePdaWritebackPayload(writeback)
  if (!context) return base

  const issues = [...base.issues]
  let hasConflict = base.hasConflict

  if (context.contextType !== writeback.contextType) {
    hasConflict = true
    issues.push('回写上下文类型与当前页面上下文不一致。')
  }

  if (writeback.contextType === 'merge-batch') {
    const currentBatchKey = context.mergeBatchId || context.mergeBatchNo
    const incomingBatchKey = writeback.mergeBatchId || writeback.mergeBatchNo
    if (currentBatchKey && incomingBatchKey && currentBatchKey !== incomingBatchKey) {
      hasConflict = true
      issues.push('回写批次与当前页面批次不一致。')
    }
  }

  const unmatchedOriginalIds = writeback.originalCutOrderIds.filter((id) => !context.originalCutOrderIds.includes(id))
  if (unmatchedOriginalIds.length) {
    hasConflict = true
    issues.push('回写中的原始裁片单与当前页面上下文不匹配。')
  }

  return {
    ...base,
    hasConflict,
    issues,
  }
}

export function compareWritebackWithExistingSession(
  writeback: PdaSpreadingWriteback,
  sessions: SpreadingSession[],
): PdaWritebackSessionComparison {
  const matchedSessions = sessions.filter((session) => {
    if (writeback.contextType === 'merge-batch') {
      return Boolean(writeback.mergeBatchId) && session.mergeBatchId === writeback.mergeBatchId
    }
    return writeback.originalCutOrderIds.some((id) => session.originalCutOrderIds.includes(id))
  })

  const targetSession = matchedSessions[0] ?? null
  const duplicateRollNos: string[] = []
  const conflictingRollNos: string[] = []
  const newRollNos: string[] = []
  const issues: string[] = []

  for (const rollItem of writeback.rollItems) {
    const existingRoll = matchedSessions.flatMap((session) => session.rolls).find((roll) => roll.rollNo === rollItem.rollNo)
    if (!existingRoll) {
      newRollNos.push(rollItem.rollNo)
      continue
    }

    const sameLength = Math.abs(existingRoll.actualLength - rollItem.actualLength) < 0.01
    const sameLayer = existingRoll.layerCount === rollItem.layerCount
    const sameSku = existingRoll.materialSku === rollItem.materialSku

    if (sameLength && sameLayer && sameSku) {
      duplicateRollNos.push(rollItem.rollNo)
    } else {
      conflictingRollNos.push(rollItem.rollNo)
      issues.push(`卷号 ${rollItem.rollNo} 已存在且长度或层数不一致。`)
    }
  }

  const duplicateSession = matchedSessions.find((session) => session.sourceWritebackId === writeback.writebackId)
  if (duplicateSession) {
    issues.push('当前回写已应用过，不能重复应用。')
  }

  return {
    matchedSessionId: targetSession?.spreadingSessionId || '',
    duplicateRollNos,
    conflictingRollNos,
    newRollNos,
    issues,
    hasConflict: conflictingRollNos.length > 0 || Boolean(duplicateSession),
  }
}

export function resolvePdaWritebackStatus(
  writeback: PdaSpreadingWriteback,
  context: MarkerSpreadingContext | null,
  sessions: SpreadingSession[],
  honorTerminalStatus = true,
): {
  status: PdaWritebackStatusKey
  validation: PdaWritebackValidationResult
  comparison: PdaWritebackSessionComparison
} {
  const validation = matchWritebackToSpreadingContext(writeback, context)
  const comparison = compareWritebackWithExistingSession(writeback, sessions)

  if (honorTerminalStatus && (writeback.status === 'APPLIED' || writeback.status === 'REJECTED')) {
    return { status: writeback.status, validation, comparison }
  }

  if (validation.hasMissingField) {
    return { status: 'PENDING_SUPPLEMENT', validation, comparison }
  }

  if (validation.hasConflict || comparison.hasConflict) {
    return { status: 'CONFLICT', validation, comparison }
  }

  return { status: 'PENDING_REVIEW', validation, comparison }
}

function toSpreadingSourceChannel(session: SpreadingSession | null): SpreadingSourceChannel {
  if (!session) return 'PDA_WRITEBACK'
  if (session.sourceChannel === 'PDA_WRITEBACK' || session.sourceChannel === 'MIXED') return session.sourceChannel
  return 'MIXED'
}

function sessionMatchesWritebackContext(session: SpreadingSession, writeback: PdaSpreadingWriteback): boolean {
  if (writeback.contextType === 'merge-batch') {
    if (writeback.mergeBatchId && session.mergeBatchId === writeback.mergeBatchId) return true
    if (writeback.mergeBatchNo && session.mergeBatchNo === writeback.mergeBatchNo) return true
    return false
  }
  return writeback.originalCutOrderIds.some((id) => session.originalCutOrderIds.includes(id))
}

function findWritebackCandidateSessions(store: MarkerSpreadingStore, writeback: PdaSpreadingWriteback): SpreadingSession[] {
  return store.sessions.filter((session) => sessionMatchesWritebackContext(session, writeback))
}

function findTargetSession(store: MarkerSpreadingStore, writeback: PdaSpreadingWriteback): SpreadingSession | null {
  if (writeback.spreadingSessionId) {
    const exact = store.sessions.find((session) => session.spreadingSessionId === writeback.spreadingSessionId)
    if (exact) return exact
  }

  if (writeback.markerId || writeback.markerNo) {
    const byMarker = store.sessions.find(
      (session) =>
        sessionMatchesWritebackContext(session, writeback)
        && ((writeback.markerId && session.markerId === writeback.markerId) || (writeback.markerNo && session.markerNo === writeback.markerNo)),
    )
    if (byMarker) return byMarker
  }

  const inProgress = store.sessions.find(
    (session) => sessionMatchesWritebackContext(session, writeback) && session.status === 'IN_PROGRESS',
  )
  if (inProgress) return inProgress

  return null
}

function createSessionFromWriteback(writeback: PdaSpreadingWriteback, now = new Date()): SpreadingSession {
  const totalLayers = countTotalLayers(writeback.rollItems)
  return {
    spreadingSessionId: writeback.spreadingSessionId || `spreading-session-pda-${now.getTime()}`,
    contextType: writeback.contextType,
    originalCutOrderIds: [...writeback.originalCutOrderIds],
    mergeBatchId: writeback.mergeBatchId,
    mergeBatchNo: writeback.mergeBatchNo,
    markerId: writeback.markerId || '',
    markerNo: writeback.markerNo || '',
    styleCode: writeback.styleCode || '',
    spuCode: writeback.spuCode || '',
    materialSkuSummary: uniqueStrings(writeback.rollItems.map((item) => item.materialSku)).join(' / '),
    spreadingMode: mapWritebackModeToSessionMode(writeback.spreadingMode),
    status: 'IN_PROGRESS',
    importedFromMarker: Boolean(writeback.markerId || writeback.markerNo),
    plannedLayers: totalLayers,
    actualLayers: 0,
    totalActualLength: 0,
    totalHeadLength: 0,
    totalTailLength: 0,
    totalCalculatedUsableLength: 0,
    operatorCount: 0,
    rollCount: 0,
    note: '由 PDA 回写自动创建的铺布 session。',
    createdAt: nowText(now),
    updatedAt: nowText(now),
    sourceChannel: 'PDA_WRITEBACK',
    sourceWritebackId: writeback.writebackId,
    updatedFromPdaAt: writeback.submittedAt,
    planUnits: writeback.planUnits.map((item) => ({
      ...item,
      planUnitId: item.planUnitId,
    })),
    rolls: [],
    operators: [],
  }
}

function buildRollFromWriteback(
  writeback: PdaSpreadingWriteback,
  item: PdaSpreadingRollWritebackItem,
  sessionId: string,
  existingRollRecordId?: string,
): SpreadingRollRecord {
  return {
    rollRecordId: existingRollRecordId || `pda-roll-${writeback.writebackId}-${item.rollWritebackItemId}`,
    spreadingSessionId: sessionId,
    planUnitId: item.planUnitId,
    rollNo: item.rollNo,
    materialSku: item.materialSku,
    color: item.color || '',
    width: item.width,
    labeledLength: item.labeledLength,
    actualLength: item.actualSpreadLengthM,
    headLength: item.headLossM,
    tailLength: item.tailLossM,
    layerCount: item.spreadLayerCount,
    operatorNames: [],
    handoverNotes: '',
    usableLength: item.usableLength,
    occurredAt: writeback.occurredAt || writeback.submittedAt,
    note: item.note,
    sourceChannel: 'PDA_WRITEBACK',
    sourceWritebackId: writeback.writebackId,
    updatedFromPdaAt: writeback.submittedAt,
  }
}

function buildOperatorFromWriteback(
  writeback: PdaSpreadingWriteback,
  item: PdaSpreadingOperatorWritebackItem,
  sessionId: string,
  rollRecordId: string,
  existingOperatorRecordId?: string,
): SpreadingOperatorRecord {
  return {
    operatorRecordId: existingOperatorRecordId || `pda-operator-${writeback.writebackId}-${item.operatorWritebackItemId}`,
    spreadingSessionId: sessionId,
    rollRecordId,
    operatorAccountId: item.operatorAccountId,
    operatorName: item.operatorName,
    startAt: item.startAt,
    endAt: item.endAt,
    actionType: item.actionType,
    handoverFlag: item.handoverFlag,
    nextOperatorName: item.handoverToName || '',
    handoverNotes: item.handoverFlag
      ? [item.handoverToName ? `交给 ${item.handoverToName}` : '', item.note].filter(Boolean).join('；')
      : item.note,
    note: item.note,
    sourceChannel: 'PDA_WRITEBACK',
    sourceWritebackId: writeback.writebackId,
    updatedFromPdaAt: writeback.submittedAt,
  }
}

export function applyWritebackToSpreadingSession(options: {
  writeback: PdaSpreadingWriteback
  store: MarkerSpreadingStore
  force?: boolean
  appliedBy?: string
}): PdaWritebackApplyResult {
  const matchedSessions = findWritebackCandidateSessions(options.store, options.writeback)

  const comparison = compareWritebackWithExistingSession(options.writeback, matchedSessions)
  const validation = validatePdaWritebackPayload(options.writeback)

  if ((!validation.isValid || comparison.hasConflict) && !options.force) {
    return {
      applied: false,
      createdSessionId: '',
      updatedSessionId: '',
      createdRollCount: 0,
      updatedRollCount: 0,
      createdOperatorCount: 0,
      updatedOperatorCount: 0,
      auditTrailIds: [],
      warningMessages: [...validation.issues, ...comparison.issues],
      nextStore: options.store,
    }
  }

  const now = new Date()
  const resolvedTargetSession = findTargetSession(options.store, options.writeback)
  const targetSession = resolvedTargetSession ?? createSessionFromWriteback(options.writeback, now)
  let nextSession: SpreadingSession = {
    ...targetSession,
    markerId: targetSession.markerId || options.writeback.markerId || '',
    markerNo: targetSession.markerNo || options.writeback.markerNo || '',
    styleCode: targetSession.styleCode || options.writeback.styleCode || '',
    spuCode: targetSession.spuCode || options.writeback.spuCode || '',
    materialSkuSummary:
      targetSession.materialSkuSummary
      || uniqueStrings(options.writeback.rollItems.map((item) => item.materialSku)).join(' / '),
    spreadingMode: mapWritebackModeToSessionMode(options.writeback.spreadingMode),
    importedFromMarker: targetSession.importedFromMarker || Boolean(options.writeback.markerId || options.writeback.markerNo),
    plannedLayers: targetSession.plannedLayers || countTotalLayers(options.writeback.rollItems),
    planUnits:
      Array.isArray(targetSession.planUnits) && targetSession.planUnits.length
        ? targetSession.planUnits
        : options.writeback.planUnits.map((item) => ({ ...item })),
    sourceChannel: toSpreadingSourceChannel(resolvedTargetSession),
    sourceWritebackId: options.writeback.writebackId,
    updatedFromPdaAt: options.writeback.submittedAt,
  }

  let createdRollCount = 0
  let updatedRollCount = 0
  const rollRecordIdByWritebackItemId = new Map<string, string>()

  for (const item of options.writeback.rollItems) {
    const existingIndex = nextSession.rolls.findIndex((roll) => roll.rollNo === item.rollNo)
    if (existingIndex === -1) {
      const nextRoll = buildRollFromWriteback(options.writeback, item, nextSession.spreadingSessionId)
      rollRecordIdByWritebackItemId.set(item.rollWritebackItemId, nextRoll.rollRecordId)
      nextSession = {
        ...nextSession,
        rolls: [...nextSession.rolls, nextRoll],
      }
      createdRollCount += 1
      continue
    }

    const existingRoll = nextSession.rolls[existingIndex]
    const nextRoll = buildRollFromWriteback(options.writeback, item, nextSession.spreadingSessionId, existingRoll.rollRecordId)
    rollRecordIdByWritebackItemId.set(item.rollWritebackItemId, existingRoll.rollRecordId)
    nextSession = {
      ...nextSession,
      rolls: nextSession.rolls.map((roll, index) => (index === existingIndex ? { ...roll, ...nextRoll } : roll)),
    }
    updatedRollCount += 1
  }

  let createdOperatorCount = 0
  let updatedOperatorCount = 0

  for (const item of options.writeback.operatorItems) {
    const rollRecordId =
      rollRecordIdByWritebackItemId.get(item.rollWritebackItemId)
      || nextSession.rolls.find((roll) => roll.sourceWritebackId === options.writeback.writebackId)?.rollRecordId
      || ''
    const existingIndex = nextSession.operators.findIndex(
      (operator) =>
        (operator.operatorAccountId
          && operator.operatorAccountId === item.operatorAccountId
          && operator.rollRecordId === rollRecordId
          && operator.sourceWritebackId === options.writeback.writebackId) ||
        (operator.operatorAccountId && operator.operatorAccountId === item.operatorAccountId && operator.rollRecordId === rollRecordId) ||
        (operator.operatorName === item.operatorName && operator.startAt === item.startAt && operator.actionType === item.actionType),
    )

    if (existingIndex === -1) {
      const nextOperator = buildOperatorFromWriteback(
        options.writeback,
        item,
        nextSession.spreadingSessionId,
        rollRecordId,
      )
      nextSession = {
        ...nextSession,
        operators: [...nextSession.operators, nextOperator],
      }
      createdOperatorCount += 1
      continue
    }

    const existingOperator = nextSession.operators[existingIndex]
    const nextOperator = buildOperatorFromWriteback(
      options.writeback,
      item,
      nextSession.spreadingSessionId,
      rollRecordId || existingOperator.rollRecordId,
      existingOperator.operatorRecordId,
    )
    nextSession = {
      ...nextSession,
      operators: nextSession.operators.map((operator, index) => (index === existingIndex ? { ...operator, ...nextOperator } : operator)),
    }
    updatedOperatorCount += 1
  }

  const nextStore = upsertSpreadingSession(nextSession, options.store, now)
  const auditAction = options.force ? 'FORCE_APPLY' : 'APPLY'
  const audit = buildWritebackAuditTrail({
    writebackId: options.writeback.writebackId,
    action: auditAction,
    actionBy: options.appliedBy || '后台审核人',
    targetSessionId: nextSession.spreadingSessionId,
    note:
      createdRollCount || updatedRollCount || createdOperatorCount || updatedOperatorCount
        ? `卷记录新增 ${createdRollCount} 条，更新 ${updatedRollCount} 条；人员记录新增 ${createdOperatorCount} 条，更新 ${updatedOperatorCount} 条。`
        : '当前回写与已有 session 数据一致，未新增差异。',
  })

  return {
    applied: true,
    createdSessionId: resolvedTargetSession ? '' : nextSession.spreadingSessionId,
    updatedSessionId: resolvedTargetSession ? nextSession.spreadingSessionId : '',
    createdRollCount,
    updatedRollCount,
    createdOperatorCount,
    updatedOperatorCount,
    auditTrailIds: [audit.auditTrailId],
    warningMessages: [...validation.issues, ...comparison.issues].filter(Boolean),
    nextStore,
  }
}

export function buildWritebackAuditTrail(options: {
  writebackId: string
  action: PdaWritebackAuditTrail['action']
  actionBy: string
  targetSessionId?: string
  note?: string
  actionAt?: string
}): PdaWritebackAuditTrail {
  return {
    auditTrailId: buildWritebackTimestampId('wb-audit'),
    writebackId: options.writebackId,
    action: options.action,
    actionBy: options.actionBy,
    actionAt: options.actionAt || nowText(),
    targetSessionId: options.targetSessionId || '',
    note: options.note || '',
  }
}

export function buildPdaSupplementDraft(writeback: PdaSpreadingWriteback): PdaSupplementDraft {
  return {
    writebackId: writeback.writebackId,
    sourceAccountId: writeback.sourceAccountId,
    sourceAccountName: writeback.sourceAccountName,
    originalCutOrderIdsText: writeback.originalCutOrderIds.join('，'),
    originalCutOrderNosText: writeback.originalCutOrderNos.join('，'),
    mergeBatchId: writeback.mergeBatchId,
    mergeBatchNo: writeback.mergeBatchNo,
    note: writeback.note,
  }
}

export function serializePdaWritebackStorage(store: PdaWritebackStore): string {
  return JSON.stringify(store)
}

export function deserializePdaWritebackStorage(raw: string | null): PdaWritebackStore {
  if (!raw) return createEmptyPdaWritebackStore()
  try {
    const parsed = JSON.parse(raw)
    return {
      writebacks: toArray(parsed?.writebacks).map((item) => normalizePdaWritebackPayload(item)),
      auditTrails: toArray(parsed?.auditTrails).map((item, index) => ({
        auditTrailId: String((item as Record<string, unknown>).auditTrailId || `audit-${index + 1}`),
        writebackId: String((item as Record<string, unknown>).writebackId || ''),
        action: ((item as Record<string, unknown>).action as PdaWritebackAuditTrail['action']) || 'IMPORT',
        actionBy: String((item as Record<string, unknown>).actionBy || '系统'),
        actionAt: String((item as Record<string, unknown>).actionAt || ''),
        targetSessionId: String((item as Record<string, unknown>).targetSessionId || ''),
        note: String((item as Record<string, unknown>).note || ''),
      })),
    }
  } catch {
    return createEmptyPdaWritebackStore()
  }
}

export function hydrateIncomingPdaWritebacks(storage: Pick<Storage, 'getItem'>): PdaWritebackStore {
  return deserializePdaWritebackStorage(storage.getItem(CUTTING_PDA_WRITEBACK_STORAGE_KEY))
}

export function buildPdaWritebackStats(writebacks: PdaSpreadingWriteback[]): PdaWritebackStats {
  const today = nowText().slice(0, 10)
  return {
    pendingReviewCount: writebacks.filter((item) => item.status === 'PENDING_REVIEW').length,
    appliedCount: writebacks.filter((item) => item.status === 'APPLIED').length,
    conflictCount: writebacks.filter((item) => item.status === 'CONFLICT').length,
    pendingSupplementCount: writebacks.filter((item) => item.status === 'PENDING_SUPPLEMENT').length,
    todayCount: writebacks.filter((item) => item.submittedAt.startsWith(today)).length,
    accountCount: uniqueStrings(writebacks.map((item) => item.sourceAccountId)).length,
    rollCount: writebacks.reduce((sum, item) => sum + item.rollItems.length, 0),
    originalCutOrderCount: uniqueStrings(writebacks.flatMap((item) => item.originalCutOrderIds)).length,
  }
}

export function buildMockPdaWritebacks(options: {
  context: MarkerSpreadingContext | null
  sessions: SpreadingSession[]
}): PdaSpreadingWriteback[] {
  const context = options.context
  if (!context) return []

  const baseOriginalId = context.originalCutOrderIds[0] || ''
  const baseOriginalNo = context.originalCutOrderNos[0] || ''
  const baseProductionNo = context.productionOrderNos[0] || ''
  const baseMaterialSku = context.materialPrepRows[0]?.materialLineItems[0]?.materialSku || ''
  const existingRollNo = options.sessions[0]?.rolls[0]?.rollNo || 'ROLL-PDA-001'
  const now = new Date()

  const normal = normalizePdaWritebackPayload({
    writebackNo: `PDA-WB-${now.getFullYear()}${`${now.getMonth() + 1}`.padStart(2, '0')}${`${now.getDate()}`.padStart(2, '0')}-101`,
    sourceAccountId: 'pda-operator-001',
    sourceAccountName: '张红',
    sourceDeviceId: 'PDA-CUT-01',
    submittedAt: nowText(now),
    occurredAt: nowText(now),
    contextType: context.contextType,
    spreadingSessionId: options.sessions[0]?.spreadingSessionId || '',
    markerId: options.sessions[0]?.markerId || '',
    markerNo: options.sessions[0]?.markerNo || '',
    spreadingMode: mapSessionModeToWritebackMode(options.sessions[0]?.spreadingMode),
    originalCutOrderIds: context.originalCutOrderIds,
    originalCutOrderNos: context.originalCutOrderNos,
    mergeBatchId: context.mergeBatchId,
    mergeBatchNo: context.mergeBatchNo,
    productionOrderNos: context.productionOrderNos,
    styleCode: context.styleCode,
    spuCode: context.spuCode,
    note: '现场已完成一卷铺布录入，等待后台审核应用。',
    rollItems: [
      {
        rollNo: buildWritebackTimestampId('PDA'),
        materialSku: baseMaterialSku,
        width: 160,
        labeledLength: 38.5,
        actualLength: 37.8,
        headLength: 0.3,
        tailLength: 0.4,
        layerCount: 16,
      },
    ],
    operatorItems: [
      {
        rollWritebackItemId: 'normal-roll-1',
        operatorAccountId: 'pda-operator-001',
        operatorName: '张红',
        startAt: nowText(now),
        endAt: nowText(new Date(now.getTime() + 45 * 60 * 1000)),
        actionType: '铺布',
        handoverFlag: false,
        handoverToAccountId: '',
        handoverToName: '',
      },
    ],
  })

  const handoverFollowup = normalizePdaWritebackPayload({
    writebackNo: `PDA-WB-${now.getFullYear()}${`${now.getMonth() + 1}`.padStart(2, '0')}${`${now.getDate()}`.padStart(2, '0')}-105`,
    sourceAccountId: 'pda-operator-015',
    sourceAccountName: '周海燕',
    sourceDeviceId: 'PDA-CUT-03',
    submittedAt: nowText(new Date(now.getTime() - 5 * 60 * 1000)),
    occurredAt: nowText(new Date(now.getTime() - 5 * 60 * 1000)),
    contextType: context.contextType,
    spreadingSessionId: options.sessions[0]?.spreadingSessionId || '',
    markerId: options.sessions[0]?.markerId || '',
    markerNo: options.sessions[0]?.markerNo || '',
    spreadingMode: mapSessionModeToWritebackMode(options.sessions[0]?.spreadingMode),
    recordType: '接手继续',
    originalCutOrderIds: context.originalCutOrderIds,
    originalCutOrderNos: context.originalCutOrderNos,
    mergeBatchId: context.mergeBatchId,
    mergeBatchNo: context.mergeBatchNo,
    productionOrderNos: context.productionOrderNos,
    styleCode: context.styleCode,
    spuCode: context.spuCode,
    note: '第二班组接手继续铺布，用于演示 PDA 写回后的下游追溯链。',
    rollItems: [
      {
        rollNo: buildWritebackTimestampId('PDA-HO'),
        materialSku: baseMaterialSku,
        width: 160,
        labeledLength: 31.2,
        actualLength: 30.4,
        headLength: 0.2,
        tailLength: 0.3,
        layerCount: 12,
      },
    ],
    operatorItems: [
      {
        rollWritebackItemId: 'handover-roll-1',
        operatorAccountId: 'pda-operator-015',
        operatorName: '周海燕',
        startAt: nowText(new Date(now.getTime() - 25 * 60 * 1000)),
        endAt: nowText(new Date(now.getTime() - 5 * 60 * 1000)),
        actionType: '接手继续',
        handoverFlag: true,
        handoverToAccountId: 'pda-operator-016',
        handoverToName: '黎莎',
      },
    ],
  })

  const missing = normalizePdaWritebackPayload({
    writebackNo: `PDA-WB-${now.getFullYear()}${`${now.getMonth() + 1}`.padStart(2, '0')}${`${now.getDate()}`.padStart(2, '0')}-102`,
    sourceAccountId: '',
    sourceAccountName: '',
    submittedAt: nowText(new Date(now.getTime() - 30 * 60 * 1000)),
    occurredAt: nowText(new Date(now.getTime() - 30 * 60 * 1000)),
    contextType: 'original-order',
    spreadingMode: 'NORMAL',
    originalCutOrderIds: [baseOriginalId],
    originalCutOrderNos: [baseOriginalNo],
    productionOrderNos: [baseProductionNo],
    styleCode: context.styleCode,
    spuCode: context.spuCode,
    note: '来源账号缺失，需要后台补录后再应用。',
    rollItems: [
      {
        rollNo: buildWritebackTimestampId('PDA-MISS'),
        materialSku: baseMaterialSku,
        width: 158,
        labeledLength: 22,
        actualLength: 21.4,
        headLength: 0.2,
        tailLength: 0.3,
        layerCount: 10,
      },
    ],
  })

  const conflict = normalizePdaWritebackPayload({
    writebackNo: `PDA-WB-${now.getFullYear()}${`${now.getMonth() + 1}`.padStart(2, '0')}${`${now.getDate()}`.padStart(2, '0')}-103`,
    sourceAccountId: 'pda-operator-018',
    sourceAccountName: '王立',
    submittedAt: nowText(new Date(now.getTime() - 90 * 60 * 1000)),
    occurredAt: nowText(new Date(now.getTime() - 90 * 60 * 1000)),
    contextType: context.contextType,
    spreadingSessionId: options.sessions[0]?.spreadingSessionId || '',
    markerId: options.sessions[0]?.markerId || '',
    markerNo: options.sessions[0]?.markerNo || '',
    spreadingMode: mapSessionModeToWritebackMode(options.sessions[0]?.spreadingMode),
    originalCutOrderIds: context.originalCutOrderIds,
    originalCutOrderNos: context.originalCutOrderNos,
    mergeBatchId: context.mergeBatchId,
    mergeBatchNo: context.mergeBatchNo,
    productionOrderNos: context.productionOrderNos,
    styleCode: context.styleCode,
    spuCode: context.spuCode,
    note: '卷号重复且长度差异较大，用于演示冲突处理。',
    rollItems: [
      {
        rollNo: existingRollNo,
        materialSku: baseMaterialSku,
        width: 160,
        labeledLength: 44,
        actualLength: 42.2,
        headLength: 0.5,
        tailLength: 0.6,
        layerCount: 18,
      },
    ],
    operatorItems: [
      {
        rollWritebackItemId: 'conflict-roll-1',
        operatorAccountId: 'pda-operator-018',
        operatorName: '王立',
        startAt: nowText(new Date(now.getTime() - 90 * 60 * 1000)),
        endAt: nowText(new Date(now.getTime() - 40 * 60 * 1000)),
        actionType: '复核',
        handoverFlag: true,
        handoverToAccountId: 'pda-operator-021',
        handoverToName: '李珊',
      },
    ],
  })

  const mergeBatchContext = normalizePdaWritebackPayload({
    writebackNo: `PDA-WB-${now.getFullYear()}${`${now.getMonth() + 1}`.padStart(2, '0')}${`${now.getDate()}`.padStart(2, '0')}-104`,
    sourceAccountId: 'pda-operator-009',
    sourceAccountName: '赵楠',
    submittedAt: nowText(new Date(now.getTime() - 10 * 60 * 1000)),
    occurredAt: nowText(new Date(now.getTime() - 10 * 60 * 1000)),
    contextType: 'merge-batch',
    spreadingMode: 'HIGH_LOW',
    originalCutOrderIds: context.originalCutOrderIds,
    originalCutOrderNos: context.originalCutOrderNos,
    mergeBatchId: context.mergeBatchId || 'mock-merge-batch',
    mergeBatchNo: context.mergeBatchNo || 'CUT-MB-MOCK',
    productionOrderNos: context.productionOrderNos,
    styleCode: context.styleCode,
    spuCode: context.spuCode,
    note: '批次上下文回写，用于演示批次执行上下文下的回写接入。',
    rollItems: [
      {
        rollNo: buildWritebackTimestampId('PDA-BATCH'),
        materialSku: baseMaterialSku,
        width: 162,
        labeledLength: 28.6,
        actualLength: 27.9,
        headLength: 0.3,
        tailLength: 0.2,
        layerCount: 12,
      },
    ],
    operatorItems: [
      {
        rollWritebackItemId: 'merge-batch-roll-1',
        operatorAccountId: 'pda-operator-009',
        operatorName: '赵楠',
        startAt: nowText(new Date(now.getTime() - 15 * 60 * 1000)),
        endAt: nowText(new Date(now.getTime() - 5 * 60 * 1000)),
        actionType: '铺布',
        handoverFlag: false,
        handoverToAccountId: '',
        handoverToName: '',
      },
    ],
  })

  return [normal, handoverFollowup, mergeBatchContext, missing, conflict]
}
