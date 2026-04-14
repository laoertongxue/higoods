import {
  PCS_PROJECT_INLINE_NODE_RECORD_WORK_ITEM_TYPES,
  type PcsProjectInlineNodeRecord,
  type PcsProjectInlineNodeRecordStoreSnapshot,
  type PcsProjectInlineNodeRecordWorkItemTypeCode,
  type PcsProjectInlineNodeRef,
} from './pcs-project-inline-node-record-types.ts'
import { createBootstrapProjectInlineNodeRecordSnapshot } from './pcs-project-inline-node-record-bootstrap.ts'
import { getProjectById, getProjectNodeRecordById, updateProjectNodeRecord } from './pcs-project-repository.ts'
import { getProjectWorkItemContract, type PcsProjectWorkItemCode } from './pcs-project-domain-contract.ts'
import { getPcsWorkItemRuntimeCarrierDefinition } from './pcs-work-item-runtime-carrier.ts'

const INLINE_NODE_RECORD_STORAGE_KEY = 'higood-pcs-project-inline-node-records-v2'
const INLINE_NODE_RECORD_STORE_VERSION = 1

let memorySnapshot: PcsProjectInlineNodeRecordStoreSnapshot | null = null

export interface SaveProjectInlineNodeFieldEntryResult {
  ok: boolean
  message: string
  record: PcsProjectInlineNodeRecord | null
}

export interface SaveProjectInlineNodeFieldEntryInput {
  values: Record<string, unknown>
  detailSnapshot?: Record<string, unknown>
  businessDate?: string
  recordStatus?: string
  sourceDocType?: string
}

const ALLOWED_PAYLOAD_KEYS: Record<PcsProjectInlineNodeRecordWorkItemTypeCode, string[]> = {
  SAMPLE_ACQUIRE: ['sampleSourceType', 'sampleSupplierId', 'sampleLink', 'sampleUnitPrice'],
  SAMPLE_INBOUND_CHECK: ['sampleCode', 'arrivalTime', 'checkResult'],
  FEASIBILITY_REVIEW: ['reviewConclusion', 'reviewRisk'],
  SAMPLE_SHOOT_FIT: ['shootPlan', 'fitFeedback'],
  SAMPLE_CONFIRM: ['confirmResult', 'confirmNote'],
  SAMPLE_COST_REVIEW: ['costTotal', 'costNote'],
  SAMPLE_PRICING: ['priceRange', 'pricingNote'],
  TEST_DATA_SUMMARY: ['summaryText', 'totalExposureQty', 'totalClickQty', 'totalOrderQty', 'totalGmvAmount'],
  TEST_CONCLUSION: ['conclusion', 'conclusionNote', 'linkedChannelProductCode', 'invalidationPlanned'],
  SAMPLE_RETAIN_REVIEW: ['retainResult', 'retainNote'],
  SAMPLE_RETURN_HANDLE: ['returnResult'],
}

const ALLOWED_DETAIL_SNAPSHOT_KEYS: Record<PcsProjectInlineNodeRecordWorkItemTypeCode, string[]> = {
  SAMPLE_ACQUIRE: [
    'acquireMethod',
    'acquirePurpose',
    'applicant',
    'externalPlatform',
    'externalShop',
    'orderTime',
    'quantity',
    'colors',
    'sizes',
    'specNote',
    'expectedArrivalDate',
    'expressCompany',
    'trackingNumber',
    'shippingCost',
    'returnDeadline',
    'arrivalConfirmer',
    'actualArrivalTime',
    'sampleCode',
    'sampleStatus',
    'warehouse',
    'inventoryRecord',
    'approvalStatus',
    'approver',
    'handler',
  ],
  SAMPLE_INBOUND_CHECK: [
    'sampleIds',
    'warehouseLocation',
    'receiver',
    'inboundRequestNo',
    'sampleQuantity',
    'colorCode',
    'sizeCombination',
    'expressCompany',
    'trackingNumber',
    'arrivalPhotos',
    'inboundVoucher',
    'approvalStatus',
    'approver',
    'currentHandler',
  ],
  FEASIBILITY_REVIEW: ['evaluationDimension', 'judgmentDescription', 'evaluationParticipants', 'approvalStatus', 'approver'],
  SAMPLE_SHOOT_FIT: [
    'shootDate',
    'shootLocation',
    'requiredMaterials',
    'shootStyle',
    'actualShootDate',
    'photographer',
    'modelInvolved',
    'modelName',
    'editingRequired',
    'editingDeadline',
    'retouchingLevel',
  ],
  SAMPLE_CONFIRM: [
    'appearanceConfirmation',
    'sizeConfirmation',
    'craftsmanshipConfirmation',
    'materialConfirmation',
    'revisionRequired',
    'revisionNotes',
    'proceedToNextStage',
    'confirmationNotes',
  ],
  SAMPLE_COST_REVIEW: [
    'actualSampleCost',
    'targetProductionCost',
    'costVariance',
    'costVariancePercentage',
    'costCompliance',
    'costReviewNotes',
    'proceedWithProduction',
    'decisionRationale',
  ],
  SAMPLE_PRICING: [
    'baseCost',
    'targetProfitMargin',
    'calculatedPrice',
    'finalPrice',
    'pricingStrategy',
    'approvedBy',
    'approvalDate',
    'approvalStatus',
    'approvalComments',
  ],
  TEST_DATA_SUMMARY: [
    'liveRelationIds',
    'videoRelationIds',
    'liveRelationCodes',
    'videoRelationCodes',
    'summaryOwner',
    'summaryAt',
    'channelProductId',
    'channelProductCode',
    'upstreamChannelProductCode',
  ],
  TEST_CONCLUSION: [
    'summaryRecordId',
    'summaryRecordCode',
    'channelProductId',
    'channelProductCode',
    'upstreamChannelProductCode',
    'invalidatedChannelProductId',
    'revisionTaskId',
    'revisionTaskCode',
    'linkedStyleId',
    'linkedStyleCode',
    'projectTerminated',
    'projectTerminatedAt',
  ],
  SAMPLE_RETAIN_REVIEW: [
    'sampleAssetId',
    'sampleCode',
    'sampleLedgerEventId',
    'sampleLedgerEventCode',
    'inventoryStatusAfter',
    'availabilityAfter',
    'locationAfter',
    'disposalDocId',
    'disposalDocCode',
  ],
  SAMPLE_RETURN_HANDLE: [
    'returnRecipient',
    'returnDepartment',
    'returnAddress',
    'returnDate',
    'logisticsProvider',
    'trackingNumber',
    'modificationReason',
    'sampleAssetId',
    'sampleCode',
    'sampleLedgerEventId',
    'sampleLedgerEventCode',
    'returnDocId',
    'returnDocCode',
  ],
}

function canUseStorage(): boolean {
  return typeof localStorage !== 'undefined'
}

function nowText(): string {
  const date = new Date()
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hours = `${date.getHours()}`.padStart(2, '0')
  const minutes = `${date.getMinutes()}`.padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

function buildEmptySnapshot(): PcsProjectInlineNodeRecordStoreSnapshot {
  return {
    version: INLINE_NODE_RECORD_STORE_VERSION,
    records: [],
  }
}

function buildSeedSnapshot(): PcsProjectInlineNodeRecordStoreSnapshot {
  return hydrateSnapshot(createBootstrapProjectInlineNodeRecordSnapshot(INLINE_NODE_RECORD_STORE_VERSION))
}

function isSupportedWorkItemTypeCode(value: string): value is PcsProjectInlineNodeRecordWorkItemTypeCode {
  return (PCS_PROJECT_INLINE_NODE_RECORD_WORK_ITEM_TYPES as readonly string[]).includes(value)
}

function cloneArray<T>(value: T[]): T[] {
  return value.map((item) => cloneValue(item))
}

function cloneValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return cloneArray(value) as T
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, cloneValue(item)]),
    ) as T
  }
  return value
}

function sanitizeObject(source: unknown, allowedKeys: string[]): Record<string, unknown> {
  if (!source || typeof source !== 'object') return {}
  return Object.fromEntries(
    Object.entries(source as Record<string, unknown>)
      .filter(([key, value]) => allowedKeys.includes(key) && value !== undefined)
      .map(([key, value]) => [key, cloneValue(value)]),
  )
}

function normalizeRef(ref: Partial<PcsProjectInlineNodeRef> | null | undefined): PcsProjectInlineNodeRef {
  return {
    refModule: ref?.refModule || '',
    refType: ref?.refType || '',
    refId: ref?.refId || '',
    refCode: ref?.refCode || '',
    refTitle: ref?.refTitle || '',
    refStatus: ref?.refStatus || '',
  }
}

function compareRecords(left: PcsProjectInlineNodeRecord, right: PcsProjectInlineNodeRecord): number {
  const businessDateDiff = right.businessDate.localeCompare(left.businessDate)
  if (businessDateDiff !== 0) return businessDateDiff
  const updatedAtDiff = right.updatedAt.localeCompare(left.updatedAt)
  if (updatedAtDiff !== 0) return updatedAtDiff
  return right.recordId.localeCompare(left.recordId)
}

function cloneRecord<T extends PcsProjectInlineNodeRecord>(record: T): T {
  return {
    ...record,
    payload: cloneValue(record.payload),
    detailSnapshot: cloneValue(record.detailSnapshot),
    upstreamRefs: record.upstreamRefs.map((item) => normalizeRef(item)),
    downstreamRefs: record.downstreamRefs.map((item) => normalizeRef(item)),
  } as T
}

function normalizeRecord<T extends PcsProjectInlineNodeRecord>(record: T): T {
  if (!isSupportedWorkItemTypeCode(record.workItemTypeCode)) {
    throw new Error(`不支持的 inline 节点正式记录类型：${record.workItemTypeCode}`)
  }

  return {
    ...record,
    recordId: record.recordId || '',
    recordCode: record.recordCode || '',
    projectId: record.projectId || '',
    projectCode: record.projectCode || '',
    projectName: record.projectName || '',
    projectNodeId: record.projectNodeId || '',
    workItemTypeCode: record.workItemTypeCode,
    workItemTypeName: record.workItemTypeName || '',
    businessDate: record.businessDate || '',
    recordStatus: record.recordStatus || '',
    ownerId: record.ownerId || '',
    ownerName: record.ownerName || '',
    payload: sanitizeObject(record.payload, ALLOWED_PAYLOAD_KEYS[record.workItemTypeCode]),
    detailSnapshot: sanitizeObject(record.detailSnapshot, ALLOWED_DETAIL_SNAPSHOT_KEYS[record.workItemTypeCode]),
    sourceModule: record.sourceModule || '',
    sourceDocType: record.sourceDocType || '',
    sourceDocId: record.sourceDocId || '',
    sourceDocCode: record.sourceDocCode || '',
    upstreamRefs: Array.isArray(record.upstreamRefs) ? record.upstreamRefs.map((item) => normalizeRef(item)) : [],
    downstreamRefs: Array.isArray(record.downstreamRefs) ? record.downstreamRefs.map((item) => normalizeRef(item)) : [],
    createdAt: record.createdAt || record.updatedAt || '',
    createdBy: record.createdBy || record.updatedBy || '',
    updatedAt: record.updatedAt || record.createdAt || '',
    updatedBy: record.updatedBy || record.createdBy || '',
    legacyProjectRef: record.legacyProjectRef ?? null,
    legacyWorkItemInstanceId: record.legacyWorkItemInstanceId ?? null,
  } as T
}

function cloneSnapshot(snapshot: PcsProjectInlineNodeRecordStoreSnapshot): PcsProjectInlineNodeRecordStoreSnapshot {
  return {
    version: snapshot.version,
    records: snapshot.records.map((record) => cloneRecord(record)),
  }
}

function buildRecordId(
  projectCode: string,
  workItemTypeCode: PcsProjectInlineNodeRecordWorkItemTypeCode,
  sequence: number,
): string {
  const normalizedProjectCode = projectCode.replace(/[^A-Za-z0-9]/g, '')
  return `INR-${normalizedProjectCode}-${workItemTypeCode}-${String(sequence).padStart(2, '0')}`
}

function buildRecordCode(
  projectCode: string,
  workItemTypeCode: PcsProjectInlineNodeRecordWorkItemTypeCode,
  sequence: number,
): string {
  const shortProjectCode = projectCode.split('-').slice(-2).join('-') || projectCode
  return `${workItemTypeCode}-${shortProjectCode}-${String(sequence).padStart(2, '0')}`
}

function normalizeFieldEntryValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.trim()
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeFieldEntryValue(item)).filter((item) => item !== '')
  }
  return value
}

function hydrateSnapshot(
  snapshot: Partial<PcsProjectInlineNodeRecordStoreSnapshot> | null | undefined,
): PcsProjectInlineNodeRecordStoreSnapshot {
  return {
    version: INLINE_NODE_RECORD_STORE_VERSION,
    records: Array.isArray(snapshot?.records)
      ? snapshot.records.map((record) => normalizeRecord(record as PcsProjectInlineNodeRecord)).sort(compareRecords)
      : [],
  }
}

function loadSnapshot(): PcsProjectInlineNodeRecordStoreSnapshot {
  if (memorySnapshot) return cloneSnapshot(memorySnapshot)

  if (!canUseStorage()) {
    memorySnapshot = buildSeedSnapshot()
    return cloneSnapshot(memorySnapshot)
  }

  try {
    const raw = localStorage.getItem(INLINE_NODE_RECORD_STORAGE_KEY)
    if (!raw) {
      memorySnapshot = buildSeedSnapshot()
      localStorage.setItem(INLINE_NODE_RECORD_STORAGE_KEY, JSON.stringify(memorySnapshot))
      return cloneSnapshot(memorySnapshot)
    }
    memorySnapshot = hydrateSnapshot(JSON.parse(raw) as Partial<PcsProjectInlineNodeRecordStoreSnapshot>)
    localStorage.setItem(INLINE_NODE_RECORD_STORAGE_KEY, JSON.stringify(memorySnapshot))
    return cloneSnapshot(memorySnapshot)
  } catch {
    memorySnapshot = buildSeedSnapshot()
    if (canUseStorage()) {
      localStorage.setItem(INLINE_NODE_RECORD_STORAGE_KEY, JSON.stringify(memorySnapshot))
    }
    return cloneSnapshot(memorySnapshot)
  }
}

function persistSnapshot(snapshot: PcsProjectInlineNodeRecordStoreSnapshot): void {
  memorySnapshot = hydrateSnapshot(snapshot)
  if (canUseStorage()) {
    localStorage.setItem(INLINE_NODE_RECORD_STORAGE_KEY, JSON.stringify(memorySnapshot))
  }
}

export function listProjectInlineNodeRecords(): PcsProjectInlineNodeRecord[] {
  return loadSnapshot().records.map((record) => cloneRecord(record))
}

export function listProjectInlineNodeRecordsByProject(projectId: string): PcsProjectInlineNodeRecord[] {
  return listProjectInlineNodeRecords().filter((record) => record.projectId === projectId)
}

export function listProjectInlineNodeRecordsByNode(projectNodeId: string): PcsProjectInlineNodeRecord[] {
  return listProjectInlineNodeRecords().filter((record) => record.projectNodeId === projectNodeId)
}

export function listProjectInlineNodeRecordsByWorkItemType(
  workItemTypeCode: PcsProjectInlineNodeRecordWorkItemTypeCode,
): PcsProjectInlineNodeRecord[] {
  return listProjectInlineNodeRecords().filter((record) => record.workItemTypeCode === workItemTypeCode)
}

export function getLatestProjectInlineNodeRecord(projectNodeId: string): PcsProjectInlineNodeRecord | null {
  return listProjectInlineNodeRecordsByNode(projectNodeId)[0] || null
}

export function upsertProjectInlineNodeRecord<T extends PcsProjectInlineNodeRecord>(record: T): T {
  const snapshot = loadSnapshot()
  const normalized = normalizeRecord(record)
  const nextRecords = [
    normalized,
    ...snapshot.records.filter((item) => item.recordId !== normalized.recordId),
  ].sort(compareRecords)
  persistSnapshot({
    version: INLINE_NODE_RECORD_STORE_VERSION,
    records: nextRecords,
  })
  return cloneRecord(normalized)
}

export function saveProjectInlineNodeFieldEntry(
  projectId: string,
  projectNodeId: string,
  input: SaveProjectInlineNodeFieldEntryInput,
  operatorName = '当前用户',
): SaveProjectInlineNodeFieldEntryResult {
  const project = getProjectById(projectId)
  if (!project) {
    return { ok: false, message: '未找到对应商品项目，不能保存节点字段。', record: null }
  }

  const node = getProjectNodeRecordById(projectId, projectNodeId)
  if (!node) {
    return { ok: false, message: '未找到对应项目节点，不能保存节点字段。', record: null }
  }

  if (project.projectStatus === '待审核' && node.workItemTypeCode !== 'PROJECT_INIT') {
    return { ok: false, message: '请先审核商品项目立项，再推进后续节点。', record: null }
  }

  if (!isSupportedWorkItemTypeCode(node.workItemTypeCode)) {
    return { ok: false, message: '当前节点不通过项目内正式记录承载字段，不能直接在此保存。', record: null }
  }

  const workItemTypeCode = node.workItemTypeCode as PcsProjectInlineNodeRecordWorkItemTypeCode
  const contract = getProjectWorkItemContract(node.workItemTypeCode as PcsProjectWorkItemCode)
  const carrier = getPcsWorkItemRuntimeCarrierDefinition(node.workItemTypeCode as PcsProjectWorkItemCode)
  const existingRecords = listProjectInlineNodeRecordsByNode(projectNodeId).filter(
    (item) => item.workItemTypeCode === workItemTypeCode,
  )
  const latestRecord = existingRecords[0] || null
  const timestamp = nowText()
  const sequence = existingRecords.length + 1
  const shouldCreateNewRecord = carrier.projectDisplayRequirementCode === 'PROJECT_INLINE_RECORDS' || !latestRecord

  const normalizedValues = Object.fromEntries(
    Object.entries(input.values || {}).map(([key, value]) => [key, normalizeFieldEntryValue(value)]),
  )
  const businessDate =
    (typeof input.businessDate === 'string' && input.businessDate.trim()) ||
    (typeof normalizedValues.arrivalTime === 'string' && normalizedValues.arrivalTime.trim()) ||
    timestamp
  const missingRequiredFields = contract.fieldDefinitions
    .filter((field) => !field.readonly && field.required)
    .filter((field) => {
      const value = normalizedValues[field.fieldKey] ?? latestRecord?.payload?.[field.fieldKey]
      if (value === null || value === undefined) return true
      if (Array.isArray(value)) return value.length === 0
      return String(value).trim() === ''
    })

  const nextRecord = upsertProjectInlineNodeRecord({
    recordId: shouldCreateNewRecord ? buildRecordId(project.projectCode, workItemTypeCode, sequence) : latestRecord!.recordId,
    recordCode: shouldCreateNewRecord
      ? buildRecordCode(project.projectCode, workItemTypeCode, sequence)
      : latestRecord!.recordCode,
    projectId: project.projectId,
    projectCode: project.projectCode,
    projectName: project.projectName,
    projectNodeId,
    workItemTypeCode,
    workItemTypeName: node.workItemTypeName,
    businessDate,
    recordStatus:
      input.recordStatus ||
      latestRecord?.recordStatus ||
      (missingRequiredFields.length === 0 ? '已保存' : '待补充'),
    ownerId: node.currentOwnerId || project.ownerId,
    ownerName: node.currentOwnerName || project.ownerName,
    payload: {
      ...(latestRecord?.payload || {}),
      ...normalizedValues,
    },
    detailSnapshot: {
      ...(latestRecord?.detailSnapshot || {}),
      ...(input.detailSnapshot || {}),
    },
    sourceModule: latestRecord?.sourceModule || '商品项目',
    sourceDocType: input.sourceDocType || latestRecord?.sourceDocType || '项目节点字段录入',
    sourceDocId: latestRecord?.sourceDocId || projectNodeId,
    sourceDocCode: latestRecord?.sourceDocCode || node.projectNodeId,
    upstreamRefs: latestRecord?.upstreamRefs || [],
    downstreamRefs: latestRecord?.downstreamRefs || [],
    createdAt: shouldCreateNewRecord ? timestamp : latestRecord!.createdAt,
    createdBy: shouldCreateNewRecord ? operatorName : latestRecord!.createdBy,
    updatedAt: timestamp,
    updatedBy: operatorName,
    legacyProjectRef: latestRecord?.legacyProjectRef ?? null,
    legacyWorkItemInstanceId: latestRecord?.legacyWorkItemInstanceId ?? null,
  } as PcsProjectInlineNodeRecord)

  const nodePatch: Parameters<typeof updateProjectNodeRecord>[2] = {
    updatedAt: timestamp,
  }

  if (node.currentStatus === '未开始') {
    nodePatch.currentStatus = '进行中'
    nodePatch.latestResultType = '已开始填写节点字段'
    nodePatch.latestResultText = `已开始填写${node.workItemTypeName}字段。`
    nodePatch.pendingActionType = missingRequiredFields.length === 0 ? node.pendingActionType : '继续填写节点字段'
    nodePatch.pendingActionText =
      missingRequiredFields.length === 0
        ? node.pendingActionText
        : `请继续补齐${node.workItemTypeName}字段。`
  } else if (node.currentStatus !== '已完成' && node.currentStatus !== '已取消') {
    nodePatch.latestResultType = '已保存节点字段'
    nodePatch.latestResultText =
      missingRequiredFields.length === 0
        ? `已保存${node.workItemTypeName}字段。`
        : `已保存${node.workItemTypeName}字段，仍有待补齐项。`
    if (missingRequiredFields.length > 0) {
      nodePatch.pendingActionType = '继续填写节点字段'
      nodePatch.pendingActionText = `请继续补齐${node.workItemTypeName}字段。`
    }
  }

  updateProjectNodeRecord(projectId, projectNodeId, nodePatch, operatorName)

  return {
    ok: true,
    message:
      missingRequiredFields.length === 0
        ? `已保存${node.workItemTypeName}字段。`
        : `已保存${node.workItemTypeName}字段，仍需补齐：${missingRequiredFields.map((field) => field.label).join('、')}。`,
    record: nextRecord,
  }
}

export function replaceProjectInlineNodeRecordStore(records: PcsProjectInlineNodeRecord[]): void {
  persistSnapshot({
    version: INLINE_NODE_RECORD_STORE_VERSION,
    records: records.map((record) => normalizeRecord(record)).sort(compareRecords),
  })
}

export function resetProjectInlineNodeRecordRepository(): void {
  const snapshot = buildEmptySnapshot()
  persistSnapshot(snapshot)
  if (canUseStorage()) {
    localStorage.removeItem(INLINE_NODE_RECORD_STORAGE_KEY)
    localStorage.setItem(INLINE_NODE_RECORD_STORAGE_KEY, JSON.stringify(snapshot))
  }
}
