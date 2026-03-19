import {
  getWarehouseExecutionDocById,
  listWarehouseIssueOrders,
  listWarehouseReturnOrders,
  type WarehouseIssueOrder,
  type WarehouseReturnOrder,
} from './warehouse-material-execution'
import {
  PROCESS_ASSIGNMENT_GRANULARITY_LABEL,
  type ProcessAssignmentGranularity,
} from './process-craft-dict'
import {
  getRuntimeTaskById,
  type RuntimeExecutorKind,
  type RuntimeProcessTask,
  type RuntimeTaskScopeType,
} from './runtime-process-tasks'

export type HandoverAction = 'PICKUP' | 'HANDOUT'
export type HandoverStatus = 'PENDING' | 'CONFIRMED'
export type HandoverPartyKind = 'WAREHOUSE' | 'FACTORY'

export interface HandoverEvent {
  eventId: string
  action: HandoverAction
  taskId: string
  productionOrderId: string
  currentProcess: string
  prevProcess?: string
  isFirstProcess: boolean
  fromPartyKind: HandoverPartyKind
  fromPartyName: string
  toPartyKind: HandoverPartyKind
  toPartyName: string
  qtyExpected: number
  qtyActual?: number
  qtyUnit: string
  qtyDiff?: number
  diffReason?: string
  diffNote?: string
  deadlineTime: string
  status: HandoverStatus
  confirmedAt?: string
  proofCount?: number
  factoryId: string
  materialSummary?: string
}

// 保留旧导出以兼容历史引用，真实数据由下方构建函数实时生成。
export const pdaHandoverEvents: HandoverEvent[] = []

export type HandoverHeadSummaryStatus =
  | 'NONE'
  | 'SUBMITTED'
  | 'PARTIAL_WRITTEN_BACK'
  | 'WRITTEN_BACK'
  | 'HAS_OBJECTION'
export type PdaHandoverHeadType = 'PICKUP' | 'HANDOUT'
export type PdaHeadCompletionStatus = 'OPEN' | 'COMPLETED'

export type HandoverRecordStatus =
  | 'PENDING_WRITEBACK'
  | 'WRITTEN_BACK'
  | 'OBJECTION_REPORTED'
  | 'OBJECTION_PROCESSING'
  | 'OBJECTION_RESOLVED'

export interface HandoverProofFile {
  id: string
  type: 'IMAGE' | 'VIDEO'
  name: string
  uploadedAt: string
}

export interface PdaHandoverHead {
  handoverId: string
  headType: PdaHandoverHeadType
  taskId: string
  taskNo: string
  productionOrderNo: string
  processName: string
  sourceFactoryName: string
  targetName: string
  targetKind: HandoverPartyKind
  qtyUnit: string
  factoryId: string
  taskStatus: 'IN_PROGRESS' | 'DONE'
  summaryStatus: HandoverHeadSummaryStatus
  recordCount: number
  pendingWritebackCount: number
  writtenBackQtyTotal: number
  objectionCount: number
  lastRecordAt?: string
  completionStatus: PdaHeadCompletionStatus
  completedByWarehouseAt?: string
  qtyExpectedTotal: number
  qtyActualTotal: number
  qtyDiffTotal: number
  runtimeTaskId?: string
  sourceDocId?: string
  sourceDocNo?: string
  scopeType?: RuntimeTaskScopeType
  scopeKey?: string
  scopeLabel?: string
  executorKind?: RuntimeExecutorKind
  transitionFromPrev?: 'RETURN_TO_WAREHOUSE' | 'SAME_FACTORY_CONTINUE' | 'NOT_APPLICABLE'
  transitionToNext?: 'RETURN_TO_WAREHOUSE' | 'SAME_FACTORY_CONTINUE' | 'NOT_APPLICABLE'
  stageCode?: 'PREP' | 'PROD' | 'POST'
  stageName?: string
  processBusinessCode?: string
  processBusinessName?: string
  craftCode?: string
  craftName?: string
  taskTypeCode?: string
  taskTypeLabel?: string
  assignmentGranularity?: ProcessAssignmentGranularity
  assignmentGranularityLabel?: string
  isSpecialCraft?: boolean
}

export interface PdaHandoverRecord {
  recordId: string
  handoverId: string
  taskId: string
  sequenceNo: number
  materialCode?: string
  materialName?: string
  materialSpec?: string
  skuCode?: string
  skuColor?: string
  skuSize?: string
  pieceName?: string
  plannedQty?: number
  qtyUnit?: string
  factorySubmittedAt: string
  factoryRemark?: string
  factoryProofFiles: HandoverProofFile[]
  status: HandoverRecordStatus
  warehouseReturnNo?: string
  warehouseWrittenQty?: number
  warehouseWrittenAt?: string
  objectionReason?: string
  objectionRemark?: string
  objectionProofFiles?: HandoverProofFile[]
  objectionStatus?: 'REPORTED' | 'PROCESSING' | 'RESOLVED'
  followUpRemark?: string
  resolvedRemark?: string
}

export type PdaPickupRecordStatus =
  | 'PENDING_WAREHOUSE_DISPATCH'
  | 'PENDING_FACTORY_PICKUP'
  | 'RECEIVED'

export interface PdaPickupRecord {
  recordId: string
  handoverId: string
  taskId: string
  sequenceNo: number
  materialCode?: string
  materialName?: string
  materialSpec?: string
  skuCode?: string
  skuColor?: string
  skuSize?: string
  pieceName?: string
  pickupMode: 'WAREHOUSE_DELIVERY' | 'FACTORY_PICKUP'
  pickupModeLabel: '仓库配送到厂' | '工厂到仓自提'
  materialSummary: string
  qtyExpected: number
  qtyActual?: number
  qtyUnit: string
  submittedAt: string
  status: PdaPickupRecordStatus
  receivedAt?: string
  remark?: string
}

export interface PdaHandoverSummary {
  totalHeads: number
  pickupPendingCount: number
  handoutPendingCount: number
  completedCount: number
  objectionCount: number
}

const pickupRecordAdditions = new Map<string, PdaPickupRecord[]>()
const handoutRecordAdditions = new Map<string, PdaHandoverRecord[]>()
const pickupRecordOverrides = new Map<string, Partial<PdaPickupRecord>>()
const handoutRecordOverrides = new Map<string, Partial<PdaHandoverRecord>>()
const headCompletionOverrides = new Map<
  string,
  { completionStatus: PdaHeadCompletionStatus; completedByWarehouseAt?: string }
>()

function nowTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function parseDateMs(value: string | undefined): number {
  if (!value) return Number.NaN
  return new Date(value.replace(' ', 'T')).getTime()
}

function cloneProofFiles(files: HandoverProofFile[]): HandoverProofFile[] {
  return files.map((file) => ({ ...file }))
}

function cloneHead(head: PdaHandoverHead): PdaHandoverHead {
  return { ...head }
}

function clonePickupRecord(record: PdaPickupRecord): PdaPickupRecord {
  return { ...record }
}

function cloneRecord(record: PdaHandoverRecord): PdaHandoverRecord {
  return {
    ...record,
    factoryProofFiles: cloneProofFiles(record.factoryProofFiles),
    objectionProofFiles: cloneProofFiles(record.objectionProofFiles ?? []),
  }
}

function sumBy<T>(rows: T[], picker: (row: T) => number): number {
  return rows.reduce((sum, row) => sum + picker(row), 0)
}

function makePickupHeadId(docId: string): string {
  return `PKH-${docId}`
}

function makeHandoutHeadId(docId: string): string {
  return `HOH-${docId}`
}

function readIssueDocByHeadId(handoverId: string): WarehouseIssueOrder | undefined {
  if (!handoverId.startsWith('PKH-')) return undefined
  return listWarehouseIssueOrders().find((doc) => makePickupHeadId(doc.id) === handoverId)
}

function readReturnDocByHeadId(handoverId: string): WarehouseReturnOrder | undefined {
  if (!handoverId.startsWith('HOH-')) return undefined
  return listWarehouseReturnOrders().find((doc) => makeHandoutHeadId(doc.id) === handoverId)
}

function mapTaskStatus(task: RuntimeProcessTask | null): 'IN_PROGRESS' | 'DONE' {
  return task?.status === 'DONE' ? 'DONE' : 'IN_PROGRESS'
}

function buildPickupHeadFromIssue(doc: WarehouseIssueOrder): PdaHandoverHead {
  const runtimeTask = getRuntimeTaskById(doc.runtimeTaskId)
  const assignmentGranularity = runtimeTask?.assignmentGranularity
  return {
    handoverId: makePickupHeadId(doc.id),
    headType: 'PICKUP',
    taskId: runtimeTask?.baseTaskId ?? doc.baseTaskId,
    taskNo: runtimeTask?.taskId ?? doc.runtimeTaskId,
    productionOrderNo: doc.productionOrderId,
    processName: doc.processNameZh,
    sourceFactoryName: doc.warehouseName ?? '仓库',
    targetName: doc.targetFactoryName ?? runtimeTask?.assignedFactoryName ?? '待分配工厂',
    targetKind: 'FACTORY',
    qtyUnit: runtimeTask?.qtyUnit ?? '件',
    factoryId: doc.targetFactoryId ?? runtimeTask?.assignedFactoryId ?? '',
    taskStatus: mapTaskStatus(runtimeTask),
    summaryStatus: 'NONE',
    recordCount: 0,
    pendingWritebackCount: 0,
    writtenBackQtyTotal: 0,
    objectionCount: 0,
    completionStatus: 'OPEN',
    qtyExpectedTotal: sumBy(doc.lines, (line) => line.plannedQty),
    qtyActualTotal: 0,
    qtyDiffTotal: 0,
    runtimeTaskId: doc.runtimeTaskId,
    sourceDocId: doc.id,
    sourceDocNo: doc.docNo,
    scopeType: doc.scopeType,
    scopeKey: doc.scopeKey,
    scopeLabel: doc.scopeLabel,
    executorKind: doc.executorKind,
    transitionFromPrev: runtimeTask?.transitionFromPrev,
    transitionToNext: runtimeTask?.transitionToNext,
    stageCode: runtimeTask?.stageCode,
    stageName: runtimeTask?.stageName,
    processBusinessCode: runtimeTask?.processBusinessCode,
    processBusinessName: runtimeTask?.processBusinessName,
    craftCode: runtimeTask?.craftCode,
    craftName: runtimeTask?.craftName,
    taskTypeCode: runtimeTask
      ? runtimeTask.isSpecialCraft
        ? runtimeTask.craftCode || runtimeTask.processBusinessCode
        : runtimeTask.processBusinessCode
      : undefined,
    taskTypeLabel: runtimeTask?.taskCategoryZh,
    assignmentGranularity,
    assignmentGranularityLabel: assignmentGranularity
      ? PROCESS_ASSIGNMENT_GRANULARITY_LABEL[assignmentGranularity]
      : undefined,
    isSpecialCraft: runtimeTask?.isSpecialCraft,
  }
}

function buildHandoutHeadFromReturn(doc: WarehouseReturnOrder): PdaHandoverHead {
  const runtimeTask = getRuntimeTaskById(doc.runtimeTaskId)
  const assignmentGranularity = runtimeTask?.assignmentGranularity
  return {
    handoverId: makeHandoutHeadId(doc.id),
    headType: 'HANDOUT',
    taskId: runtimeTask?.baseTaskId ?? doc.baseTaskId,
    taskNo: runtimeTask?.taskId ?? doc.runtimeTaskId,
    productionOrderNo: doc.productionOrderId,
    processName: doc.processNameZh,
    sourceFactoryName: doc.targetFactoryName ?? runtimeTask?.assignedFactoryName ?? '待分配工厂',
    targetName: doc.warehouseName ?? '仓库',
    targetKind: 'WAREHOUSE',
    qtyUnit: runtimeTask?.qtyUnit ?? '件',
    factoryId: doc.targetFactoryId ?? runtimeTask?.assignedFactoryId ?? '',
    taskStatus: mapTaskStatus(runtimeTask),
    summaryStatus: 'NONE',
    recordCount: 0,
    pendingWritebackCount: 0,
    writtenBackQtyTotal: 0,
    objectionCount: 0,
    completionStatus: 'OPEN',
    qtyExpectedTotal: sumBy(doc.lines, (line) => line.plannedQty),
    qtyActualTotal: 0,
    qtyDiffTotal: 0,
    runtimeTaskId: doc.runtimeTaskId,
    sourceDocId: doc.id,
    sourceDocNo: doc.docNo,
    scopeType: doc.scopeType,
    scopeKey: doc.scopeKey,
    scopeLabel: doc.scopeLabel,
    executorKind: doc.executorKind,
    transitionFromPrev: runtimeTask?.transitionFromPrev,
    transitionToNext: runtimeTask?.transitionToNext,
    stageCode: runtimeTask?.stageCode,
    stageName: runtimeTask?.stageName,
    processBusinessCode: runtimeTask?.processBusinessCode,
    processBusinessName: runtimeTask?.processBusinessName,
    craftCode: runtimeTask?.craftCode,
    craftName: runtimeTask?.craftName,
    taskTypeCode: runtimeTask
      ? runtimeTask.isSpecialCraft
        ? runtimeTask.craftCode || runtimeTask.processBusinessCode
        : runtimeTask.processBusinessCode
      : undefined,
    taskTypeLabel: runtimeTask?.taskCategoryZh,
    assignmentGranularity,
    assignmentGranularityLabel: assignmentGranularity
      ? PROCESS_ASSIGNMENT_GRANULARITY_LABEL[assignmentGranularity]
      : undefined,
    isSpecialCraft: runtimeTask?.isSpecialCraft,
  }
}

function isPrepProcessCode(code: string | undefined): boolean {
  if (!code) return false
  return code === 'PRINT' || code === 'DYE' || code === 'PROC_PRINT' || code === 'PROC_DYE'
}

function shouldIncludePdaDoc(
  doc: WarehouseIssueOrder | WarehouseReturnOrder,
  runtimeTask: RuntimeProcessTask | null,
): boolean {
  if (runtimeTask?.stageCode === 'PREP') return false
  if (isPrepProcessCode(runtimeTask?.processBusinessCode) || isPrepProcessCode(runtimeTask?.processCode)) return false
  if (isPrepProcessCode(doc.processCode)) return false
  return true
}

function mapIssueLineStatus(doc: WarehouseIssueOrder, line: WarehouseIssueOrder['lines'][number]): PdaPickupRecordStatus {
  if (line.issuedQty >= line.plannedQty && line.plannedQty > 0) return 'RECEIVED'
  if (line.preparedQty >= line.plannedQty && line.plannedQty > 0) return 'PENDING_FACTORY_PICKUP'
  if (doc.status === 'READY') return 'PENDING_FACTORY_PICKUP'
  return 'PENDING_WAREHOUSE_DISPATCH'
}

function buildPickupLineRecord(
  head: PdaHandoverHead,
  doc: WarehouseIssueOrder,
  line: WarehouseIssueOrder['lines'][number],
  index: number,
): PdaPickupRecord {
  const status = mapIssueLineStatus(doc, line)
  const qtyActual = status === 'RECEIVED' ? Math.max(line.issuedQty, line.plannedQty) : undefined
  return {
    recordId: `PKR-${doc.id}-${String(index + 1).padStart(3, '0')}`,
    handoverId: head.handoverId,
    taskId: head.taskId,
    sequenceNo: index + 1,
    materialCode: line.materialCode,
    materialName: line.materialName,
    materialSpec: line.materialSpec,
    skuCode: line.skuCode,
    skuColor: line.skuColor,
    skuSize: line.skuSize,
    pieceName: line.pieceName,
    pickupMode: 'WAREHOUSE_DELIVERY',
    pickupModeLabel: '仓库配送到厂',
    materialSummary: line.pieceName ? `${line.materialName} / ${line.pieceName}` : line.materialName,
    qtyExpected: line.plannedQty,
    qtyActual,
    qtyUnit: line.unit,
    submittedAt: doc.updatedAt,
    status,
    receivedAt: status === 'RECEIVED' ? doc.updatedAt : undefined,
    remark: doc.remark,
  }
}

function mapReturnLineStatus(doc: WarehouseReturnOrder, line: WarehouseReturnOrder['lines'][number]): HandoverRecordStatus {
  if (line.returnedQty > 0) return 'WRITTEN_BACK'
  if (doc.status === 'RETURNED' || doc.status === 'CLOSED') return 'WRITTEN_BACK'
  return 'PENDING_WRITEBACK'
}

function buildHandoutLineRecord(
  head: PdaHandoverHead,
  doc: WarehouseReturnOrder,
  line: WarehouseReturnOrder['lines'][number],
  index: number,
): PdaHandoverRecord {
  const status = mapReturnLineStatus(doc, line)
  const writtenQty = status === 'WRITTEN_BACK' ? Math.max(line.returnedQty, 0) : undefined
  const sourceText = line.pieceName ? `${line.materialName} / ${line.pieceName}` : line.materialName

  return {
    recordId: `HOR-${doc.id}-${String(index + 1).padStart(3, '0')}`,
    handoverId: head.handoverId,
    taskId: head.taskId,
    sequenceNo: index + 1,
    materialCode: line.materialCode,
    materialName: line.materialName,
    materialSpec: line.materialSpec,
    skuCode: line.skuCode,
    skuColor: line.skuColor,
    skuSize: line.skuSize,
    pieceName: line.pieceName,
    plannedQty: line.plannedQty,
    qtyUnit: line.unit,
    factorySubmittedAt: doc.updatedAt,
    factoryRemark: `回货来源：${sourceText}`,
    factoryProofFiles: [],
    status,
    warehouseReturnNo: status === 'WRITTEN_BACK' ? doc.docNo : undefined,
    warehouseWrittenQty: writtenQty,
    warehouseWrittenAt: status === 'WRITTEN_BACK' ? doc.updatedAt : undefined,
  }
}

function getHeadCompletionOverride(handoverId: string): {
  completionStatus: PdaHeadCompletionStatus
  completedByWarehouseAt?: string
} | null {
  return headCompletionOverrides.get(handoverId) ?? null
}

function getPickupRecordsForHeadInternal(head: PdaHandoverHead): PdaPickupRecord[] {
  const doc = head.sourceDocId ? (getWarehouseExecutionDocById(head.sourceDocId) as WarehouseIssueOrder | null) : null
  const baseRecords =
    doc && doc.docType === 'ISSUE'
      ? doc.lines.map((line, index) => buildPickupLineRecord(head, doc, line, index))
      : []

  const appended = pickupRecordAdditions.get(head.handoverId) ?? []
  const merged = [...baseRecords, ...appended].map((record) => ({ ...record, ...(pickupRecordOverrides.get(record.recordId) ?? {}) }))

  return merged
    .sort((a, b) => b.sequenceNo - a.sequenceNo)
    .map(clonePickupRecord)
}

function getHandoutRecordsForHeadInternal(head: PdaHandoverHead): PdaHandoverRecord[] {
  const doc = head.sourceDocId ? (getWarehouseExecutionDocById(head.sourceDocId) as WarehouseReturnOrder | null) : null
  const baseRecords =
    doc && doc.docType === 'RETURN'
      ? doc.lines.map((line, index) => buildHandoutLineRecord(head, doc, line, index))
      : []

  const appended = handoutRecordAdditions.get(head.handoverId) ?? []
  const merged = [...baseRecords, ...appended].map((record) => ({ ...record, ...(handoutRecordOverrides.get(record.recordId) ?? {}) }))

  return merged
    .sort((a, b) => b.sequenceNo - a.sequenceNo)
    .map(cloneRecord)
}

function refreshPickupHeadSummary(head: PdaHandoverHead): PdaHandoverHead {
  const records = getPickupRecordsForHeadInternal(head)
  const pendingCount = records.filter((record) => record.status !== 'RECEIVED').length
  const writtenQtyTotal = sumBy(records.filter((record) => record.status === 'RECEIVED'), (record) => record.qtyActual ?? 0)
  const latestAt = records
    .map((record) => record.receivedAt || record.submittedAt)
    .filter(Boolean)
    .sort((a, b) => parseDateMs(b) - parseDateMs(a))[0]

  const updated: PdaHandoverHead = {
    ...head,
    recordCount: records.length,
    pendingWritebackCount: pendingCount,
    writtenBackQtyTotal: writtenQtyTotal,
    qtyActualTotal: writtenQtyTotal,
    qtyDiffTotal: head.qtyExpectedTotal - writtenQtyTotal,
    objectionCount: 0,
    lastRecordAt: latestAt,
    summaryStatus:
      records.length === 0
        ? 'NONE'
        : pendingCount === records.length
          ? 'SUBMITTED'
          : pendingCount > 0
            ? 'PARTIAL_WRITTEN_BACK'
            : 'WRITTEN_BACK',
  }

  const completionOverride = getHeadCompletionOverride(head.handoverId)
  if (completionOverride) {
    updated.completionStatus = completionOverride.completionStatus
    updated.completedByWarehouseAt = completionOverride.completedByWarehouseAt
    return updated
  }

  const doc = head.sourceDocId ? (getWarehouseExecutionDocById(head.sourceDocId) as WarehouseIssueOrder | null) : null
  const autoCompleted = Boolean(doc && (doc.status === 'RECEIVED' || doc.status === 'CLOSED') && pendingCount === 0)
  updated.completionStatus = autoCompleted ? 'COMPLETED' : 'OPEN'
  updated.completedByWarehouseAt = autoCompleted ? doc?.updatedAt : undefined
  return updated
}

function refreshHandoutHeadSummary(head: PdaHandoverHead): PdaHandoverHead {
  const records = getHandoutRecordsForHeadInternal(head)
  const pendingCount = records.filter((record) => record.status === 'PENDING_WRITEBACK').length
  const objectionCount = records.filter(
    (record) =>
      record.status === 'OBJECTION_REPORTED' ||
      record.status === 'OBJECTION_PROCESSING' ||
      record.status === 'OBJECTION_RESOLVED',
  ).length
  const writtenQtyTotal = sumBy(records, (record) => (typeof record.warehouseWrittenQty === 'number' ? record.warehouseWrittenQty : 0))
  const latestAt = records
    .map((record) => record.warehouseWrittenAt || record.factorySubmittedAt)
    .filter(Boolean)
    .sort((a, b) => parseDateMs(b) - parseDateMs(a))[0]

  const updated: PdaHandoverHead = {
    ...head,
    recordCount: records.length,
    pendingWritebackCount: pendingCount,
    writtenBackQtyTotal: writtenQtyTotal,
    qtyActualTotal: writtenQtyTotal,
    qtyDiffTotal: head.qtyExpectedTotal - writtenQtyTotal,
    objectionCount,
    lastRecordAt: latestAt,
    summaryStatus:
      records.length === 0
        ? 'NONE'
        : objectionCount > 0
          ? 'HAS_OBJECTION'
          : pendingCount === records.length
            ? 'SUBMITTED'
            : pendingCount > 0
              ? 'PARTIAL_WRITTEN_BACK'
              : 'WRITTEN_BACK',
  }

  const completionOverride = getHeadCompletionOverride(head.handoverId)
  if (completionOverride) {
    updated.completionStatus = completionOverride.completionStatus
    updated.completedByWarehouseAt = completionOverride.completedByWarehouseAt
    return updated
  }

  const doc = head.sourceDocId ? (getWarehouseExecutionDocById(head.sourceDocId) as WarehouseReturnOrder | null) : null
  const autoCompleted = Boolean(
    doc &&
      (doc.status === 'RETURNED' || doc.status === 'CLOSED') &&
      pendingCount === 0 &&
      objectionCount === 0,
  )
  updated.completionStatus = autoCompleted ? 'COMPLETED' : 'OPEN'
  updated.completedByWarehouseAt = autoCompleted ? doc?.updatedAt : undefined
  return updated
}

function buildHeadsInternal(): PdaHandoverHead[] {
  const pickupHeads = listWarehouseIssueOrders()
    .filter((doc) => doc.targetType === 'EXTERNAL_FACTORY')
    .filter((doc) => shouldIncludePdaDoc(doc, getRuntimeTaskById(doc.runtimeTaskId)))
    .map((doc) => refreshPickupHeadSummary(buildPickupHeadFromIssue(doc)))

  const handoutHeads = listWarehouseReturnOrders()
    .filter((doc) => shouldIncludePdaDoc(doc, getRuntimeTaskById(doc.runtimeTaskId)))
    .map((doc) => refreshHandoutHeadSummary(buildHandoutHeadFromReturn(doc)))

  return [...pickupHeads, ...handoutHeads]
}

function listHeadsSorted(factoryId?: string): PdaHandoverHead[] {
  return buildHeadsInternal()
    .filter((head) => !factoryId || head.factoryId === factoryId)
    .sort((a, b) => {
      const bTime = parseDateMs(b.lastRecordAt || b.completedByWarehouseAt || '')
      const aTime = parseDateMs(a.lastRecordAt || a.completedByWarehouseAt || '')
      const safeB = Number.isFinite(bTime) ? bTime : 0
      const safeA = Number.isFinite(aTime) ? aTime : 0
      return safeB - safeA
    })
    .map(cloneHead)
}

function findHead(handoverId: string): PdaHandoverHead | undefined {
  return buildHeadsInternal().find((item) => item.handoverId === handoverId)
}

function findRecord(recordId: string): PdaHandoverRecord | undefined {
  const head = buildHeadsInternal().find((item) => item.headType === 'HANDOUT')
  if (!head) {
    for (const one of buildHeadsInternal().filter((item) => item.headType === 'HANDOUT')) {
      const found = getHandoutRecordsForHeadInternal(one).find((item) => item.recordId === recordId)
      if (found) return found
    }
    return undefined
  }

  const allHeads = buildHeadsInternal().filter((item) => item.headType === 'HANDOUT')
  for (const one of allHeads) {
    const found = getHandoutRecordsForHeadInternal(one).find((item) => item.recordId === recordId)
    if (found) return found
  }
  return undefined
}

function findPickupRecord(recordId: string): PdaPickupRecord | undefined {
  const allHeads = buildHeadsInternal().filter((item) => item.headType === 'PICKUP')
  for (const one of allHeads) {
    const found = getPickupRecordsForHeadInternal(one).find((item) => item.recordId === recordId)
    if (found) return found
  }
  return undefined
}

function savePickupRecord(record: PdaPickupRecord): void {
  if (record.recordId.startsWith('PKR-')) {
    const existedOverride = pickupRecordOverrides.get(record.recordId) ?? {}
    pickupRecordOverrides.set(record.recordId, { ...existedOverride, ...record })
    return
  }

  const list = pickupRecordAdditions.get(record.handoverId) ?? []
  const index = list.findIndex((item) => item.recordId === record.recordId)
  if (index >= 0) {
    list[index] = clonePickupRecord(record)
  } else {
    list.push(clonePickupRecord(record))
  }
  pickupRecordAdditions.set(record.handoverId, list)
}

function saveHandoutRecord(record: PdaHandoverRecord): void {
  if (record.recordId.startsWith('HOR-')) {
    const existedOverride = handoutRecordOverrides.get(record.recordId) ?? {}
    handoutRecordOverrides.set(record.recordId, { ...existedOverride, ...record })
    return
  }

  const list = handoutRecordAdditions.get(record.handoverId) ?? []
  const index = list.findIndex((item) => item.recordId === record.recordId)
  if (index >= 0) {
    list[index] = cloneRecord(record)
  } else {
    list.push(cloneRecord(record))
  }
  handoutRecordAdditions.set(record.handoverId, list)
}

function listLegacyHandoverEvents(): HandoverEvent[] {
  return buildHeadsInternal().map((head) => ({
    eventId: head.handoverId,
    action: head.headType,
    taskId: head.taskId,
    productionOrderId: head.productionOrderNo,
    currentProcess: head.processName,
    isFirstProcess: head.transitionFromPrev === 'NOT_APPLICABLE',
    fromPartyKind: head.headType === 'PICKUP' ? 'WAREHOUSE' : 'FACTORY',
    fromPartyName: head.sourceFactoryName,
    toPartyKind: head.targetKind,
    toPartyName: head.targetName,
    qtyExpected: head.qtyExpectedTotal,
    qtyActual: head.qtyActualTotal,
    qtyUnit: head.qtyUnit,
    qtyDiff: head.qtyDiffTotal,
    deadlineTime: head.lastRecordAt || '',
    status: head.completionStatus === 'COMPLETED' ? 'CONFIRMED' : 'PENDING',
    confirmedAt: head.completedByWarehouseAt,
    proofCount: 0,
    factoryId: head.factoryId,
    materialSummary: head.scopeLabel,
  }))
}

export function findPdaHandoverEvent(eventId: string): HandoverEvent | undefined {
  return listLegacyHandoverEvents().find((event) => event.eventId === eventId)
}

export function updatePdaHandoverEvent(
  eventId: string,
  updater: (event: HandoverEvent) => void,
): HandoverEvent | undefined {
  const found = findPdaHandoverEvent(eventId)
  if (!found) return undefined
  const next = { ...found }
  updater(next)
  return next
}

export function listPdaHandoverHeads(): PdaHandoverHead[] {
  return listHeadsSorted()
}

export function listPdaHandoverHeadsByType(type: PdaHandoverHeadType): PdaHandoverHead[] {
  return listPdaHandoverHeads().filter((head) => head.headType === type)
}

export function listPdaHandoverHeadsByFactory(factoryId: string): PdaHandoverHead[] {
  return listHeadsSorted(factoryId)
}

export function listPdaHandoverHeadsByOrder(productionOrderId: string): PdaHandoverHead[] {
  return listPdaHandoverHeads().filter((head) => head.productionOrderNo === productionOrderId)
}

export function getPdaHandoverHeadById(id: string): PdaHandoverHead | undefined {
  const found = findHead(id)
  return found ? cloneHead(found) : undefined
}

export function getPdaHeadSourceExecutionDoc(headId: string): WarehouseIssueOrder | WarehouseReturnOrder | undefined {
  const head = findHead(headId)
  if (!head?.sourceDocId) return undefined
  const doc = getWarehouseExecutionDocById(head.sourceDocId)
  if (!doc) return undefined
  if (doc.docType !== 'ISSUE' && doc.docType !== 'RETURN') return undefined
  return doc
}

export function getPdaHeadRuntimeTask(headId: string): RuntimeProcessTask | null {
  const head = findHead(headId)
  if (!head?.runtimeTaskId) return null
  return getRuntimeTaskById(head.runtimeTaskId)
}

export function getPdaPickupHeads(factoryId?: string): PdaHandoverHead[] {
  return listHeadsSorted(factoryId).filter(
    (head) => head.headType === 'PICKUP' && head.completionStatus === 'OPEN',
  )
}

export function getPdaHandoutHeads(factoryId?: string): PdaHandoverHead[] {
  return listHeadsSorted(factoryId).filter(
    (head) => head.headType === 'HANDOUT' && head.completionStatus === 'OPEN',
  )
}

export function getPdaCompletedHeads(factoryId?: string): PdaHandoverHead[] {
  return listHeadsSorted(factoryId)
    .filter((head) => head.completionStatus === 'COMPLETED')
    .sort((a, b) => parseDateMs(b.completedByWarehouseAt || '') - parseDateMs(a.completedByWarehouseAt || ''))
}

export function getPdaPendingPickupHeads(factoryId?: string): PdaHandoverHead[] {
  return getPdaPickupHeads(factoryId)
}

export function getPdaPendingHandoutHeads(factoryId?: string): PdaHandoverHead[] {
  return getPdaHandoutHeads(factoryId)
}

export function getPdaHandoverSummary(): PdaHandoverSummary {
  const heads = listPdaHandoverHeads()
  return {
    totalHeads: heads.length,
    pickupPendingCount: heads.filter((head) => head.headType === 'PICKUP' && head.completionStatus === 'OPEN').length,
    handoutPendingCount: heads.filter((head) => head.headType === 'HANDOUT' && head.completionStatus === 'OPEN').length,
    completedCount: heads.filter((head) => head.completionStatus === 'COMPLETED').length,
    objectionCount: heads.filter((head) => head.objectionCount > 0).length,
  }
}

export function getPdaHandoverSummaryByFactory(factoryId: string): PdaHandoverSummary {
  const heads = listPdaHandoverHeadsByFactory(factoryId)
  return {
    totalHeads: heads.length,
    pickupPendingCount: heads.filter((head) => head.headType === 'PICKUP' && head.completionStatus === 'OPEN').length,
    handoutPendingCount: heads.filter((head) => head.headType === 'HANDOUT' && head.completionStatus === 'OPEN').length,
    completedCount: heads.filter((head) => head.completionStatus === 'COMPLETED').length,
    objectionCount: heads.filter((head) => head.objectionCount > 0).length,
  }
}

export function findPdaHandoutHead(handoverId: string): PdaHandoverHead | undefined {
  const found = findHead(handoverId)
  return found && found.headType === 'HANDOUT' ? cloneHead(found) : undefined
}

export function findPdaPickupHead(handoverId: string): PdaHandoverHead | undefined {
  const found = findHead(handoverId)
  return found && found.headType === 'PICKUP' ? cloneHead(found) : undefined
}

export function findPdaHandoverHead(handoverId: string): PdaHandoverHead | undefined {
  const found = findHead(handoverId)
  return found ? cloneHead(found) : undefined
}

export function listPdaHandoverRecordsByHeadId(handoverId: string): PdaHandoverRecord[] {
  return getPdaHandoverRecordsByHead(handoverId)
}

export function getPdaHandoverRecordsByHead(handoverId: string): PdaHandoverRecord[] {
  const head = findHead(handoverId)
  if (!head || head.headType !== 'HANDOUT') return []
  return getHandoutRecordsForHeadInternal(head)
}

export function findPdaHandoverRecord(recordId: string): PdaHandoverRecord | undefined {
  const found = findRecord(recordId)
  return found ? cloneRecord(found) : undefined
}

export function getPdaPickupRecordsByHead(handoverId: string): PdaPickupRecord[] {
  const head = findHead(handoverId)
  if (!head || head.headType !== 'PICKUP') return []
  return getPickupRecordsForHeadInternal(head)
}

export function findPdaPickupRecord(recordId: string): PdaPickupRecord | undefined {
  const found = findPickupRecord(recordId)
  return found ? clonePickupRecord(found) : undefined
}

export function createPdaPickupRecord(
  handoverId: string,
  payload: {
    submittedAt: string
    pickupMode: 'WAREHOUSE_DELIVERY' | 'FACTORY_PICKUP'
    materialSummary: string
    qtyExpected: number
    remark?: string
  },
): PdaPickupRecord | undefined {
  const head = findHead(handoverId)
  if (!head || head.headType !== 'PICKUP' || head.completionStatus === 'COMPLETED') return undefined

  const existing = getPdaPickupRecordsByHead(handoverId)
  const sequenceNo = existing.reduce((max, record) => Math.max(max, record.sequenceNo), 0) + 1
  const recordId = `HPR-${handoverId.replace(/[^A-Za-z0-9]/g, '')}-${String(sequenceNo).padStart(3, '0')}`

  const created: PdaPickupRecord = {
    recordId,
    handoverId,
    taskId: head.taskId,
    sequenceNo,
    pickupMode: payload.pickupMode,
    pickupModeLabel: payload.pickupMode === 'WAREHOUSE_DELIVERY' ? '仓库配送到厂' : '工厂到仓自提',
    materialSummary: payload.materialSummary.trim() || '补充领料记录',
    qtyExpected: payload.qtyExpected,
    qtyUnit: head.qtyUnit,
    submittedAt: payload.submittedAt,
    status: payload.pickupMode === 'WAREHOUSE_DELIVERY' ? 'PENDING_WAREHOUSE_DISPATCH' : 'PENDING_FACTORY_PICKUP',
    remark: payload.remark?.trim() || undefined,
  }

  const list = pickupRecordAdditions.get(handoverId) ?? []
  list.push(clonePickupRecord(created))
  pickupRecordAdditions.set(handoverId, list)
  return clonePickupRecord(created)
}

export function confirmPdaPickupRecordReceived(
  recordId: string,
  qtyActual: number,
  receivedAt: string,
): PdaPickupRecord | undefined {
  const current = findPickupRecord(recordId)
  if (!current || current.status === 'RECEIVED') return undefined

  const updated: PdaPickupRecord = {
    ...current,
    qtyActual,
    receivedAt,
    status: 'RECEIVED',
  }
  savePickupRecord(updated)
  return clonePickupRecord(updated)
}

export function createPdaHandoverRecord(
  handoverId: string,
  payload: {
    factorySubmittedAt: string
    factoryRemark?: string
    factoryProofFiles: HandoverProofFile[]
  },
): PdaHandoverRecord | undefined {
  const head = findHead(handoverId)
  if (!head || head.headType !== 'HANDOUT' || head.completionStatus === 'COMPLETED') return undefined

  const existing = getPdaHandoverRecordsByHead(handoverId)
  const sequenceNo = existing.reduce((max, record) => Math.max(max, record.sequenceNo), 0) + 1
  const recordId = `HOR-${handoverId.replace(/[^A-Za-z0-9]/g, '')}-${String(sequenceNo).padStart(3, '0')}`

  const created: PdaHandoverRecord = {
    recordId,
    handoverId,
    taskId: head.taskId,
    sequenceNo,
    factorySubmittedAt: payload.factorySubmittedAt,
    factoryRemark: payload.factoryRemark?.trim() || undefined,
    factoryProofFiles: cloneProofFiles(payload.factoryProofFiles),
    status: 'PENDING_WRITEBACK',
  }

  const list = handoutRecordAdditions.get(handoverId) ?? []
  list.push(cloneRecord(created))
  handoutRecordAdditions.set(handoverId, list)
  return cloneRecord(created)
}

export function mockWritebackPdaHandoverRecord(
  recordId: string,
  payload: {
    warehouseReturnNo: string
    warehouseWrittenQty: number
    warehouseWrittenAt: string
  },
): PdaHandoverRecord | undefined {
  const current = findRecord(recordId)
  if (!current || current.status !== 'PENDING_WRITEBACK') return undefined

  const updated: PdaHandoverRecord = {
    ...current,
    warehouseReturnNo: payload.warehouseReturnNo,
    warehouseWrittenQty: payload.warehouseWrittenQty,
    warehouseWrittenAt: payload.warehouseWrittenAt,
    status: 'WRITTEN_BACK',
    objectionStatus: undefined,
  }
  saveHandoutRecord(updated)
  return cloneRecord(updated)
}

export function markPdaPickupHeadCompleted(
  handoverId: string,
  completedAt: string,
): { ok: boolean; message: string; data?: PdaHandoverHead } {
  const head = findHead(handoverId)
  if (!head || head.headType !== 'PICKUP') return { ok: false, message: '未找到领料头' }
  if (head.completionStatus === 'COMPLETED') return { ok: false, message: '该领料头已完成' }

  const records = getPdaPickupRecordsByHead(handoverId)
  if (records.length === 0) return { ok: false, message: '暂无领料记录，无法发起完成' }
  if (records.some((record) => record.status !== 'RECEIVED')) {
    return { ok: false, message: '仍有未完成的领料记录，暂不可标记完成' }
  }

  headCompletionOverrides.set(handoverId, {
    completionStatus: 'COMPLETED',
    completedByWarehouseAt: completedAt,
  })

  const updated = findHead(handoverId)
  return updated
    ? { ok: true, message: '已标记领料完成', data: cloneHead(updated) }
    : { ok: true, message: '已标记领料完成' }
}

export function markPdaHandoutHeadCompleted(
  handoverId: string,
  completedAt: string,
): { ok: boolean; message: string; data?: PdaHandoverHead } {
  const head = findHead(handoverId)
  if (!head || head.headType !== 'HANDOUT') return { ok: false, message: '未找到交出头' }
  if (head.completionStatus === 'COMPLETED') return { ok: false, message: '该交出头已完成' }

  const records = getPdaHandoverRecordsByHead(handoverId)
  if (records.length === 0) return { ok: false, message: '暂无交出记录，无法发起完成' }
  if (records.some((record) => record.status === 'PENDING_WRITEBACK')) {
    return { ok: false, message: '仍有待仓库回写记录，暂不可标记完成' }
  }
  if (records.some((record) => record.status === 'OBJECTION_REPORTED' || record.status === 'OBJECTION_PROCESSING')) {
    return { ok: false, message: '仍有未处理完成的数量异议，暂不可标记完成' }
  }

  headCompletionOverrides.set(handoverId, {
    completionStatus: 'COMPLETED',
    completedByWarehouseAt: completedAt,
  })

  const updated = findHead(handoverId)
  return updated
    ? { ok: true, message: '已标记交出完成', data: cloneHead(updated) }
    : { ok: true, message: '已标记交出完成' }
}

export function reportPdaHandoverQtyObjection(
  recordId: string,
  payload: {
    objectionReason: string
    objectionRemark?: string
    objectionProofFiles?: HandoverProofFile[]
  },
): PdaHandoverRecord | undefined {
  const current = findRecord(recordId)
  if (!current || current.status !== 'WRITTEN_BACK') return undefined

  const updated: PdaHandoverRecord = {
    ...current,
    status: 'OBJECTION_REPORTED',
    objectionStatus: 'REPORTED',
    objectionReason: payload.objectionReason.trim(),
    objectionRemark: payload.objectionRemark?.trim() || undefined,
    objectionProofFiles: cloneProofFiles(payload.objectionProofFiles ?? []),
    followUpRemark: undefined,
    resolvedRemark: undefined,
  }
  saveHandoutRecord(updated)
  return cloneRecord(updated)
}

export function followupPdaHandoverObjection(
  recordId: string,
  followUpRemark: string,
): PdaHandoverRecord | undefined {
  const current = findRecord(recordId)
  if (!current || (current.status !== 'OBJECTION_REPORTED' && current.status !== 'OBJECTION_PROCESSING')) {
    return undefined
  }

  const updated: PdaHandoverRecord = {
    ...current,
    status: 'OBJECTION_PROCESSING',
    objectionStatus: 'PROCESSING',
    followUpRemark: followUpRemark.trim() || undefined,
  }
  saveHandoutRecord(updated)
  return cloneRecord(updated)
}

export function resolvePdaHandoverObjection(
  recordId: string,
  resolvedRemark: string,
): PdaHandoverRecord | undefined {
  const current = findRecord(recordId)
  if (!current || (current.status !== 'OBJECTION_REPORTED' && current.status !== 'OBJECTION_PROCESSING')) {
    return undefined
  }

  const updated: PdaHandoverRecord = {
    ...current,
    status: 'OBJECTION_RESOLVED',
    objectionStatus: 'RESOLVED',
    resolvedRemark: resolvedRemark.trim() || undefined,
  }
  saveHandoutRecord(updated)
  return cloneRecord(updated)
}
