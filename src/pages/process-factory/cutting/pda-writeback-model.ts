import type {
  MarkerSpreadingContext,
  MarkerSpreadingStore,
  SpreadingOperatorRecord,
  SpreadingRollRecord,
  SpreadingSession,
  SpreadingSourceChannel,
} from './marker-spreading-model'
import { upsertSpreadingSession } from './marker-spreading-model'

export const CUTTING_PDA_WRITEBACK_STORAGE_KEY = 'cuttingPdaWritebackInbox'

export type PdaWritebackStatusKey = 'PENDING_REVIEW' | 'APPLIED' | 'CONFLICT' | 'PENDING_SUPPLEMENT' | 'REJECTED'

export interface PdaSpreadingRollWritebackItem {
  rollWritebackItemId: string
  writebackId: string
  rollNo: string
  materialSku: string
  width: number
  labeledLength: number
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
  operatorAccountId: string
  operatorName: string
  startAt: string
  endAt: string
  actionType: string
  handoverFlag: boolean
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
  payloadVersion: string
  contextType: 'original-order' | 'merge-batch'
  originalCutOrderIds: string[]
  originalCutOrderNos: string[]
  mergeBatchId: string
  mergeBatchNo: string
  productionOrderNos: string[]
  styleCode: string
  spuCode: string
  status: PdaWritebackStatusKey
  note: string
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

function nowText(input = new Date()): string {
  const year = input.getFullYear()
  const month = `${input.getMonth() + 1}`.padStart(2, '0')
  const day = `${input.getDate()}`.padStart(2, '0')
  const hours = `${input.getHours()}`.padStart(2, '0')
  const minutes = `${input.getMinutes()}`.padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
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
  const writebackId = String(raw.writebackId || `pda-writeback-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`)

  const rollItems = toArray<Record<string, unknown>>(raw.rollItems).map((item, index) => {
    const actualLength = toNumber(item.actualLength)
    const headLength = toNumber(item.headLength)
    const tailLength = toNumber(item.tailLength)
    return {
      rollWritebackItemId: String(item.rollWritebackItemId || `${writebackId}-roll-${index + 1}`),
      writebackId,
      rollNo: String(item.rollNo || ''),
      materialSku: String(item.materialSku || ''),
      width: toNumber(item.width),
      labeledLength: toNumber(item.labeledLength),
      actualLength,
      headLength,
      tailLength,
      layerCount: toNumber(item.layerCount),
      usableLength: toNumber(item.usableLength) || computeUsableLength(actualLength, headLength, tailLength),
      note: String(item.note || ''),
    }
  })

  const operatorItems = toArray<Record<string, unknown>>(raw.operatorItems).map((item, index) => ({
    operatorWritebackItemId: String(item.operatorWritebackItemId || `${writebackId}-operator-${index + 1}`),
    writebackId,
    operatorAccountId: String(item.operatorAccountId || ''),
    operatorName: String(item.operatorName || ''),
    startAt: String(item.startAt || ''),
    endAt: String(item.endAt || ''),
    actionType: String(item.actionType || '铺布'),
    handoverFlag: Boolean(item.handoverFlag),
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
    payloadVersion: String(raw.payloadVersion || 'v1'),
    contextType: raw.contextType === 'merge-batch' ? 'merge-batch' : 'original-order',
    originalCutOrderIds: uniqueStrings(toArray<string>(raw.originalCutOrderIds)),
    originalCutOrderNos: uniqueStrings(toArray<string>(raw.originalCutOrderNos)),
    mergeBatchId: String(raw.mergeBatchId || ''),
    mergeBatchNo: String(raw.mergeBatchNo || ''),
    productionOrderNos: uniqueStrings(toArray<string>(raw.productionOrderNos)),
    styleCode: String(raw.styleCode || ''),
    spuCode: String(raw.spuCode || ''),
    status: (raw.status as PdaWritebackStatusKey) || 'PENDING_REVIEW',
    note: String(raw.note || ''),
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

  const invalidRoll = writeback.rollItems.find((item) => !item.rollNo || !item.materialSku || item.actualLength <= 0)
  if (invalidRoll) {
    issues.push(`卷记录 ${invalidRoll.rollNo || '待补卷号'} 缺少关键字段。`)
  }

  const invalidOperator = writeback.operatorItems.find((item) => !item.operatorName)
  if (invalidOperator) {
    issues.push('存在缺少人员姓名的操作记录。')
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

function createSessionFromWriteback(writeback: PdaSpreadingWriteback, now = new Date()): SpreadingSession {
  return {
    spreadingSessionId: `spreading-session-pda-${now.getTime()}`,
    contextType: writeback.contextType,
    originalCutOrderIds: [...writeback.originalCutOrderIds],
    mergeBatchId: writeback.mergeBatchId,
    mergeBatchNo: writeback.mergeBatchNo,
    spreadingMode: 'NORMAL',
    status: 'IN_PROGRESS',
    importedFromMarker: false,
    plannedLayers: 0,
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
    rolls: [],
    operators: [],
  }
}

function buildRollFromWriteback(writeback: PdaSpreadingWriteback, item: PdaSpreadingRollWritebackItem, sessionId: string): SpreadingRollRecord {
  return {
    rollRecordId: `pda-roll-${writeback.writebackId}-${item.rollWritebackItemId}`,
    spreadingSessionId: sessionId,
    rollNo: item.rollNo,
    materialSku: item.materialSku,
    width: item.width,
    labeledLength: item.labeledLength,
    actualLength: item.actualLength,
    headLength: item.headLength,
    tailLength: item.tailLength,
    layerCount: item.layerCount,
    operatorNames: [],
    handoverNotes: '',
    usableLength: item.usableLength,
    note: item.note,
    sourceChannel: 'PDA_WRITEBACK',
    sourceWritebackId: writeback.writebackId,
    updatedFromPdaAt: writeback.submittedAt,
  }
}

function buildOperatorFromWriteback(writeback: PdaSpreadingWriteback, item: PdaSpreadingOperatorWritebackItem, sessionId: string): SpreadingOperatorRecord {
  return {
    operatorRecordId: `pda-operator-${writeback.writebackId}-${item.operatorWritebackItemId}`,
    spreadingSessionId: sessionId,
    operatorAccountId: item.operatorAccountId,
    operatorName: item.operatorName,
    startAt: item.startAt,
    endAt: item.endAt,
    actionType: item.actionType,
    handoverFlag: item.handoverFlag,
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
  const matchedSessions = options.store.sessions.filter((session) => {
    if (options.writeback.contextType === 'merge-batch') {
      return Boolean(options.writeback.mergeBatchId) && session.mergeBatchId === options.writeback.mergeBatchId
    }
    return options.writeback.originalCutOrderIds.some((id) => session.originalCutOrderIds.includes(id))
  })

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
  const targetSession = matchedSessions[0] ?? createSessionFromWriteback(options.writeback, now)
  let nextSession: SpreadingSession = {
    ...targetSession,
    sourceChannel: toSpreadingSourceChannel(matchedSessions[0] ?? null),
    sourceWritebackId: options.writeback.writebackId,
    updatedFromPdaAt: options.writeback.submittedAt,
  }

  let createdRollCount = 0
  let updatedRollCount = 0

  for (const item of options.writeback.rollItems) {
    const existingIndex = nextSession.rolls.findIndex((roll) => roll.rollNo === item.rollNo)
    if (existingIndex === -1) {
      nextSession = {
        ...nextSession,
        rolls: [...nextSession.rolls, buildRollFromWriteback(options.writeback, item, nextSession.spreadingSessionId)],
      }
      createdRollCount += 1
      continue
    }

    const nextRoll = buildRollFromWriteback(options.writeback, item, nextSession.spreadingSessionId)
    nextSession = {
      ...nextSession,
      rolls: nextSession.rolls.map((roll, index) => (index === existingIndex ? { ...roll, ...nextRoll } : roll)),
    }
    updatedRollCount += 1
  }

  let createdOperatorCount = 0
  let updatedOperatorCount = 0

  for (const item of options.writeback.operatorItems) {
    const existingIndex = nextSession.operators.findIndex(
      (operator) =>
        (operator.operatorAccountId && operator.operatorAccountId === item.operatorAccountId) ||
        (operator.operatorName === item.operatorName && operator.startAt === item.startAt && operator.actionType === item.actionType),
    )

    if (existingIndex === -1) {
      nextSession = {
        ...nextSession,
        operators: [...nextSession.operators, buildOperatorFromWriteback(options.writeback, item, nextSession.spreadingSessionId)],
      }
      createdOperatorCount += 1
      continue
    }

    const nextOperator = buildOperatorFromWriteback(options.writeback, item, nextSession.spreadingSessionId)
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
    createdSessionId: matchedSessions.length ? '' : nextSession.spreadingSessionId,
    updatedSessionId: matchedSessions.length ? nextSession.spreadingSessionId : '',
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
    auditTrailId: `wb-audit-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
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
    contextType: context.contextType,
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
        rollNo: `PDA-${Date.now().toString().slice(-5)}`,
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
        operatorAccountId: 'pda-operator-001',
        operatorName: '张红',
        startAt: nowText(now),
        endAt: nowText(new Date(now.getTime() + 45 * 60 * 1000)),
        actionType: '铺布',
        handoverFlag: false,
      },
    ],
  })

  const missing = normalizePdaWritebackPayload({
    writebackNo: `PDA-WB-${now.getFullYear()}${`${now.getMonth() + 1}`.padStart(2, '0')}${`${now.getDate()}`.padStart(2, '0')}-102`,
    sourceAccountId: '',
    sourceAccountName: '',
    submittedAt: nowText(new Date(now.getTime() - 30 * 60 * 1000)),
    contextType: 'original-order',
    originalCutOrderIds: [baseOriginalId],
    originalCutOrderNos: [baseOriginalNo],
    productionOrderNos: [baseProductionNo],
    styleCode: context.styleCode,
    spuCode: context.spuCode,
    note: '来源账号缺失，需要后台补录后再应用。',
    rollItems: [
      {
        rollNo: `PDA-MISS-${Date.now().toString().slice(-4)}`,
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
    contextType: context.contextType,
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
        operatorAccountId: 'pda-operator-018',
        operatorName: '王立',
        startAt: nowText(new Date(now.getTime() - 90 * 60 * 1000)),
        endAt: nowText(new Date(now.getTime() - 40 * 60 * 1000)),
        actionType: '复核',
        handoverFlag: true,
      },
    ],
  })

  const mergeBatchContext = normalizePdaWritebackPayload({
    writebackNo: `PDA-WB-${now.getFullYear()}${`${now.getMonth() + 1}`.padStart(2, '0')}${`${now.getDate()}`.padStart(2, '0')}-104`,
    sourceAccountId: 'pda-operator-009',
    sourceAccountName: '赵楠',
    submittedAt: nowText(new Date(now.getTime() - 10 * 60 * 1000)),
    contextType: 'merge-batch',
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
        rollNo: `PDA-BATCH-${Date.now().toString().slice(-4)}`,
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
        operatorAccountId: 'pda-operator-009',
        operatorName: '赵楠',
        startAt: nowText(new Date(now.getTime() - 15 * 60 * 1000)),
        endAt: nowText(new Date(now.getTime() - 5 * 60 * 1000)),
        actionType: '铺布',
        handoverFlag: false,
      },
    ],
  })

  return [normal, missing, conflict, mergeBatchContext]
}
