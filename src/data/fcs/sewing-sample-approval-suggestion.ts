import { productionOrders } from './production-orders.ts'
import { getProductionOrderTechPackSnapshot } from './production-order-tech-pack-runtime.ts'

export type SewingOutsourcingTaskKind =
  | 'INDEPENDENT_SEWING'
  | 'SEWING_IRON_PACK'
  | 'CUTTING_SEWING_IRON_PACK'

export type PreProductionSampleStatus =
  | 'WAITING_FACTORY_PRODUCTION'
  | 'WAITING_RETURN_TO_PPIC'
  | 'PPIC_RECEIVED'
  | 'HANDED_TO_APPROVER'
  | 'APPROVAL_IN_PROGRESS'
  | 'SUGGESTION_UPLOADED'
  | 'FEEDBACK_SENT'

export type SampleApprovalConclusion = 'NO_PROBLEM' | 'HAS_PROBLEM'

export interface SampleApprovalStructuredComments {
  fabricApprovalComment: string
  processComment: string
  materialUsageComment: string
  otherComment: string
}

export interface SewingSampleAssignmentSnapshot {
  assignmentId: string
  runtimeTaskId: string
  productionOrderId: string
  productionOrderNo?: string
  taskNo?: string
  factoryId: string
  factoryName: string
  processCodes: string[]
  ppicId?: string
  ppicName?: string
  operatedAt: string
}

export interface SampleApprovalReferenceSnapshot {
  referenceId: string
  referenceType: 'COMPANY_SAMPLE' | 'PRODUCTION_ORDER_IMAGE' | 'PATTERN' | 'FABRIC' | 'ACCESSORY'
  label: string
  versionLabel: string
  sourceObjectId: string
  imageUrl?: string
  fileName?: string
}

export interface PreProductionSamplePhysicalRecord {
  sampleId: string
  sampleNo: string
  assignmentId: string
  runtimeTaskId: string
  productionOrderId: string
  productionOrderNo: string
  taskNo: string
  taskKind: SewingOutsourcingTaskKind
  factoryId: string
  factoryName: string
  currentPpicId: string
  currentPpicName: string
  styleCode: string
  styleName: string
  styleImageUrl: string
  roundNo: number
  samplePhotoUrls: string[]
  ppicReceivedSamplePhotoUrls: string[]
  status: PreProductionSampleStatus
  factoryCompletedAt?: string
  factoryCompletedBy?: string
  ppicReceivedAt?: string
  ppicReceivedBy?: string
  handedToApproverAt?: string
  handedToApproverBy?: string
  approverTeamName?: string
  createdAt: string
}

export interface SampleApprovalSuggestionVersion {
  suggestionVersionId: string
  suggestionNo: string
  assignmentId: string
  runtimeTaskId: string
  sampleId: string
  roundNo: number
  conclusion: SampleApprovalConclusion
  structuredComments: SampleApprovalStructuredComments
  approvalSheetPhotoUrls: string[]
  referenceSnapshots: SampleApprovalReferenceSnapshot[]
  requiresAnotherApproval: boolean
  uploadedAt: string
  uploadedById: string
  uploadedByName: string
  feedbackSentAt?: string
  feedbackSentByPpicId?: string
  feedbackSentByPpicName?: string
  feedbackNote?: string
}

export interface SewingSampleApprovalRecord {
  assignmentId: string
  sample: PreProductionSamplePhysicalRecord
  referenceSnapshots: SampleApprovalReferenceSnapshot[]
  suggestionVersions: SampleApprovalSuggestionVersion[]
  latestSuggestionVersionId?: string
  currentApproverId?: string
  currentApproverName?: string
}

export interface SewingSampleActor {
  actorId: string
  actorName: string
  role: 'FACTORY' | 'PPIC' | 'SAMPLE_APPROVER'
}

const records = new Map<string, SewingSampleApprovalRecord>()
const commandResults = new Map<string, { assignmentId: string; action: string }>()
let suggestionSequence = 0

function clone<T>(value: T): T {
  return structuredClone(value)
}

function text(value: string | undefined, label: string): string {
  const normalized = String(value || '').trim()
  if (!normalized) throw new Error(`${label}不能为空`)
  return normalized
}

function normalizeStructuredComments(
  input: Partial<SampleApprovalStructuredComments> | undefined,
): SampleApprovalStructuredComments {
  return {
    fabricApprovalComment: String(input?.fabricApprovalComment || '').trim(),
    processComment: String(input?.processComment || '').trim(),
    materialUsageComment: String(input?.materialUsageComment || '').trim(),
    otherComment: String(input?.otherComment || '').trim(),
  }
}

export function summarizeSampleApprovalStructuredComments(
  comments: SampleApprovalStructuredComments,
): string {
  return [
    ['批版面料', comments.fabricApprovalComment],
    ['工艺意见', comments.processComment],
    ['用料意见', comments.materialUsageComment],
    ['其他意见', comments.otherComment],
  ]
    .filter((item): item is [string, string] => Boolean(item[1]))
    .map(([label, value]) => `${label}：${value}`)
    .join('；')
}

function classifyTaskKind(processCodes: readonly string[]): SewingOutsourcingTaskKind | null {
  const codes = processCodes.map((item) => item.trim().toUpperCase())
  const hasSewing = codes.some((code) => code === 'SEW' || code === 'SEWING' || code.includes('SEW'))
  if (!hasSewing) return null
  const hasCutting = codes.some((code) => code === 'CUT' || code === 'CUTTING' || code.includes('CUT'))
  const hasIronPack = codes.some((code) => code.includes('IRON') || code.includes('PACK'))
  if (hasCutting) return 'CUTTING_SEWING_IRON_PACK'
  if (hasIronPack) return 'SEWING_IRON_PACK'
  return 'INDEPENDENT_SEWING'
}

function buildReferences(input: SewingSampleAssignmentSnapshot): SampleApprovalReferenceSnapshot[] {
  const snapshot = getProductionOrderTechPackSnapshot(input.productionOrderId)
  if (!snapshot) {
    return [{
      referenceId: `REF-${input.assignmentId}-ORDER`,
      referenceType: 'PRODUCTION_ORDER_IMAGE',
      label: '生产单款式图片',
      versionLabel: '待补技术包版本',
      sourceObjectId: input.productionOrderId,
      imageUrl: '/shirt-sample.jpg',
    }]
  }
  const references: SampleApprovalReferenceSnapshot[] = []
  const companySampleUrl = snapshot.imageSnapshot.sampleImages[0] || snapshot.imageSnapshot.styleImages[0]
  if (companySampleUrl) {
    references.push({
      referenceId: `REF-${input.assignmentId}-COMPANY-SAMPLE`,
      referenceType: 'COMPANY_SAMPLE',
      label: '公司内部制作／留存样衣',
      versionLabel: snapshot.versionLabel,
      sourceObjectId: snapshot.snapshotId,
      imageUrl: companySampleUrl,
    })
  }
  const orderImageUrl = snapshot.imageSnapshot.productImages[0] || snapshot.imageSnapshot.styleImages[0]
  if (orderImageUrl) {
    references.push({
      referenceId: `REF-${input.assignmentId}-ORDER-IMAGE`,
      referenceType: 'PRODUCTION_ORDER_IMAGE',
      label: '生产单款式图片',
      versionLabel: snapshot.versionLabel,
      sourceObjectId: input.productionOrderId,
      imageUrl: orderImageUrl,
    })
  }
  snapshot.patternFiles.slice(0, 3).forEach((pattern, index) => references.push({
    referenceId: `REF-${input.assignmentId}-PATTERN-${index + 1}`,
    referenceType: 'PATTERN',
    label: pattern.patternFileName || `纸样${index + 1}`,
    versionLabel: pattern.patternVersion || snapshot.versionLabel,
    sourceObjectId: pattern.patternFileId,
    imageUrl: pattern.imageUrl,
    fileName: pattern.patternFileName,
  }))
  snapshot.bomItems
    .filter((item) => item.type === '面料' || item.type === '辅料')
    .slice(0, 8)
    .forEach((item) => references.push({
      referenceId: `REF-${input.assignmentId}-BOM-${item.id}`,
      referenceType: item.type === '面料' ? 'FABRIC' : 'ACCESSORY',
      label: `${item.type}：${item.name}`,
      versionLabel: snapshot.versionLabel,
      sourceObjectId: item.id,
      imageUrl: item.materialImageUrl,
    }))
  return references
}

function requireRecord(assignmentId: string): SewingSampleApprovalRecord {
  const record = records.get(assignmentId)
  if (!record) throw new Error(`执行任务分配${assignmentId}尚未生成产前版样衣与批版建议记录`)
  return record
}

function requireCommand(commandId: string, assignmentId: string, action: string): boolean {
  const id = text(commandId, '命令号')
  const prior = commandResults.get(id)
  if (!prior) return false
  if (prior.assignmentId !== assignmentId || prior.action !== action) throw new Error('命令号已被其他业务动作使用')
  return true
}

function rememberCommand(commandId: string, assignmentId: string, action: string): void {
  commandResults.set(commandId, { assignmentId, action })
}

function assertPpic(record: SewingSampleApprovalRecord, actor: SewingSampleActor): void {
  if (actor.role !== 'PPIC' || actor.actorId !== record.sample.currentPpicId) {
    throw new Error('只有该执行任务当前PPIC可以接收、转交或反馈产前版样衣')
  }
}

function assertApprover(actor: SewingSampleActor): void {
  if (actor.role !== 'SAMPLE_APPROVER') throw new Error('只有批版人员可以填写或上传批版建议')
}

export function initializeSewingSampleApprovalSuggestionForAssignment(
  input: SewingSampleAssignmentSnapshot,
): SewingSampleApprovalRecord | null {
  const taskKind = classifyTaskKind(input.processCodes)
  if (!taskKind) return null
  if (!input.ppicId || !input.ppicName) throw new Error('含车缝执行任务必须先冻结PPIC才能生成批版建议')
  const existing = records.get(input.assignmentId)
  if (existing) {
    if (existing.sample.runtimeTaskId !== input.runtimeTaskId || existing.sample.factoryId !== input.factoryId) {
      throw new Error(`分配${input.assignmentId}的产前版样衣身份与已有记录冲突`)
    }
    return clone(existing)
  }
  const productionOrder = productionOrders.find((item) => item.productionOrderId === input.productionOrderId)
  const snapshot = getProductionOrderTechPackSnapshot(input.productionOrderId)
  const styleCode = snapshot?.styleCode || productionOrder?.demandSnapshot.spuCode || input.productionOrderId
  const styleName = snapshot?.styleName || productionOrder?.demandSnapshot.spuName || '待补款式名称'
  const styleImageUrl = snapshot?.imageSnapshot.productImages[0]
    || snapshot?.imageSnapshot.styleImages[0]
    || '/shirt-sample.jpg'
  const sample: PreProductionSamplePhysicalRecord = {
    sampleId: `PPS-${input.assignmentId}`,
    sampleNo: `CY-${input.taskNo || input.runtimeTaskId}`,
    assignmentId: input.assignmentId,
    runtimeTaskId: input.runtimeTaskId,
    productionOrderId: input.productionOrderId,
    productionOrderNo: input.productionOrderNo || input.productionOrderId,
    taskNo: input.taskNo || input.runtimeTaskId,
    taskKind,
    factoryId: input.factoryId,
    factoryName: input.factoryName,
    currentPpicId: input.ppicId,
    currentPpicName: input.ppicName,
    styleCode,
    styleName,
    styleImageUrl,
    roundNo: 1,
    samplePhotoUrls: [],
    ppicReceivedSamplePhotoUrls: [],
    status: 'WAITING_FACTORY_PRODUCTION',
    createdAt: input.operatedAt,
  }
  const referenceSnapshots = buildReferences(input)
  const record: SewingSampleApprovalRecord = {
    assignmentId: input.assignmentId,
    sample,
    referenceSnapshots,
    suggestionVersions: [],
  }
  records.set(input.assignmentId, record)
  return clone(record)
}

export function markPreProductionSampleFactoryCompleted(input: {
  commandId: string
  assignmentId: string
  actor: SewingSampleActor
  samplePhotoUrls: string[]
  completedAt: string
}): SewingSampleApprovalRecord {
  const record = requireRecord(input.assignmentId)
  if (requireCommand(input.commandId, input.assignmentId, 'FACTORY_COMPLETED')) return clone(record)
  if (input.actor.role !== 'FACTORY' || input.actor.actorId !== record.sample.factoryId) {
    throw new Error('只有承接三方车缝工厂可以提交本任务产前版样衣')
  }
  if (record.sample.status !== 'WAITING_FACTORY_PRODUCTION') throw new Error('当前节点不允许重复提交产前版样衣')
  const photos = [...new Set(input.samplePhotoUrls.map((item) => item.trim()).filter(Boolean))]
  if (!photos.length) throw new Error('工厂提交产前版样衣时必须上传本次实物照片')
  record.sample.samplePhotoUrls = photos
  record.sample.factoryCompletedAt = text(input.completedAt, '工厂完成时间')
  record.sample.factoryCompletedBy = text(input.actor.actorName, '工厂提交人')
  record.sample.status = 'WAITING_RETURN_TO_PPIC'
  rememberCommand(input.commandId, input.assignmentId, 'FACTORY_COMPLETED')
  return clone(record)
}

export function receivePreProductionSampleByPpic(input: {
  commandId: string
  assignmentId: string
  actor: SewingSampleActor
  receivedSamplePhotoUrls: string[]
  receivedAt: string
}): SewingSampleApprovalRecord {
  const record = requireRecord(input.assignmentId)
  if (requireCommand(input.commandId, input.assignmentId, 'PPIC_RECEIVED')) return clone(record)
  assertPpic(record, input.actor)
  if (record.sample.status !== 'WAITING_RETURN_TO_PPIC') throw new Error('只有工厂已送回的产前版样衣可以由PPIC确认接收')
  const photos = [...new Set(input.receivedSamplePhotoUrls.map((item) => item.trim()).filter(Boolean))]
  if (!photos.length) throw new Error('PPIC确认收到产前版样衣时必须上传本次实物照片')
  record.sample.ppicReceivedSamplePhotoUrls = photos
  record.sample.ppicReceivedAt = text(input.receivedAt, 'PPIC接收时间')
  record.sample.ppicReceivedBy = text(input.actor.actorName, 'PPIC接收人')
  record.sample.status = 'PPIC_RECEIVED'
  rememberCommand(input.commandId, input.assignmentId, 'PPIC_RECEIVED')
  return clone(record)
}

export function handoffPreProductionSampleToApprover(input: {
  commandId: string
  assignmentId: string
  actor: SewingSampleActor
  approverTeamName: string
  handedAt: string
}): SewingSampleApprovalRecord {
  const record = requireRecord(input.assignmentId)
  if (requireCommand(input.commandId, input.assignmentId, 'HANDOFF_APPROVER')) return clone(record)
  assertPpic(record, input.actor)
  if (record.sample.status !== 'PPIC_RECEIVED') throw new Error('PPIC尚未确认收到产前版样衣，不能转交批版人员')
  record.sample.approverTeamName = text(input.approverTeamName, '批版团队')
  record.sample.handedToApproverAt = text(input.handedAt, '转交时间')
  record.sample.handedToApproverBy = text(input.actor.actorName, '转交人')
  record.sample.status = 'HANDED_TO_APPROVER'
  rememberCommand(input.commandId, input.assignmentId, 'HANDOFF_APPROVER')
  return clone(record)
}

export function startSampleApproval(input: {
  commandId: string
  assignmentId: string
  actor: SewingSampleActor
}): SewingSampleApprovalRecord {
  const record = requireRecord(input.assignmentId)
  if (requireCommand(input.commandId, input.assignmentId, 'START_APPROVAL')) return clone(record)
  assertApprover(input.actor)
  if (record.sample.status !== 'HANDED_TO_APPROVER') throw new Error('产前版样衣尚未由PPIC转交批版人员')
  record.currentApproverId = input.actor.actorId
  record.currentApproverName = text(input.actor.actorName, '批版人员')
  record.sample.status = 'APPROVAL_IN_PROGRESS'
  rememberCommand(input.commandId, input.assignmentId, 'START_APPROVAL')
  return clone(record)
}

export function submitSampleApprovalSuggestion(input: {
  commandId: string
  assignmentId: string
  actor: SewingSampleActor
  conclusion: SampleApprovalConclusion
  structuredComments?: Partial<SampleApprovalStructuredComments>
  approvalSheetPhotoUrls?: string[]
  requiresAnotherApproval?: boolean
  uploadedAt: string
}): SampleApprovalSuggestionVersion {
  const record = requireRecord(input.assignmentId)
  if (requireCommand(input.commandId, input.assignmentId, 'SUBMIT_SUGGESTION')) {
    return clone(record.suggestionVersions.at(-1)!)
  }
  assertApprover(input.actor)
  if (record.sample.status !== 'APPROVAL_IN_PROGRESS') throw new Error('当前产前版样衣不在批版中，不能上传批版建议')
  if (record.currentApproverId && record.currentApproverId !== input.actor.actorId) {
    throw new Error('当前批版建议已由其他批版人员领取')
  }
  const structuredComments = normalizeStructuredComments(input.structuredComments)
  if (input.conclusion === 'HAS_PROBLEM' && !summarizeSampleApprovalStructuredComments(structuredComments)) {
    throw new Error('批版结论为有问题时，必须至少填写一项结构化意见')
  }
  suggestionSequence += 1
  const suggestion: SampleApprovalSuggestionVersion = {
    suggestionVersionId: `SAS-${String(suggestionSequence).padStart(6, '0')}`,
    suggestionNo: `BPJY-${record.sample.taskNo}-R${record.sample.roundNo}`,
    assignmentId: record.assignmentId,
    runtimeTaskId: record.sample.runtimeTaskId,
    sampleId: record.sample.sampleId,
    roundNo: record.sample.roundNo,
    conclusion: input.conclusion,
    structuredComments,
    approvalSheetPhotoUrls: [...new Set((input.approvalSheetPhotoUrls || []).map((item) => item.trim()).filter(Boolean))],
    referenceSnapshots: clone(record.referenceSnapshots),
    requiresAnotherApproval: Boolean(input.requiresAnotherApproval),
    uploadedAt: text(input.uploadedAt, '批版建议上传时间'),
    uploadedById: input.actor.actorId,
    uploadedByName: text(input.actor.actorName, '批版人员'),
  }
  record.suggestionVersions.push(suggestion)
  record.latestSuggestionVersionId = suggestion.suggestionVersionId
  record.sample.status = 'SUGGESTION_UPLOADED'
  rememberCommand(input.commandId, input.assignmentId, 'SUBMIT_SUGGESTION')
  return clone(suggestion)
}

export function recordSampleApprovalFeedbackToFactory(input: {
  commandId: string
  assignmentId: string
  actor: SewingSampleActor
  feedbackAt: string
  feedbackNote: string
}): SewingSampleApprovalRecord {
  const record = requireRecord(input.assignmentId)
  if (requireCommand(input.commandId, input.assignmentId, 'FEEDBACK_FACTORY')) return clone(record)
  assertPpic(record, input.actor)
  if (record.sample.status !== 'SUGGESTION_UPLOADED') throw new Error('批版建议尚未上传，不能记录已反馈工厂')
  const latest = record.suggestionVersions.at(-1)
  if (!latest) throw new Error('未找到可反馈的批版建议版本')
  latest.feedbackSentAt = text(input.feedbackAt, '反馈时间')
  latest.feedbackSentByPpicId = input.actor.actorId
  latest.feedbackSentByPpicName = input.actor.actorName
  latest.feedbackNote = text(input.feedbackNote, '反馈说明')
  if (latest.requiresAnotherApproval) {
    record.sample.roundNo += 1
    record.sample.samplePhotoUrls = []
    record.sample.ppicReceivedSamplePhotoUrls = []
    record.sample.factoryCompletedAt = undefined
    record.sample.factoryCompletedBy = undefined
    record.sample.ppicReceivedAt = undefined
    record.sample.ppicReceivedBy = undefined
    record.sample.handedToApproverAt = undefined
    record.sample.handedToApproverBy = undefined
    record.sample.status = 'WAITING_FACTORY_PRODUCTION'
    record.currentApproverId = undefined
    record.currentApproverName = undefined
  } else {
    record.sample.status = 'FEEDBACK_SENT'
  }
  rememberCommand(input.commandId, input.assignmentId, 'FEEDBACK_FACTORY')
  return clone(record)
}

export function transferSewingSampleApprovalSuggestionPpic(input: {
  runtimeTaskId: string
  targetPpicId: string
  targetPpicName: string
}): void {
  records.forEach((record) => {
    if (record.sample.runtimeTaskId !== input.runtimeTaskId || record.sample.status === 'FEEDBACK_SENT') return
    record.sample.currentPpicId = input.targetPpicId
    record.sample.currentPpicName = input.targetPpicName
  })
}

export function getSewingSampleApprovalRecord(assignmentId: string): SewingSampleApprovalRecord | null {
  const record = records.get(assignmentId)
  return record ? clone(record) : null
}

export function listSewingSampleApprovalRecords(): SewingSampleApprovalRecord[] {
  return [...records.values()].map(clone)
}

export function resetSewingSampleApprovalSuggestionsForTests(): void {
  records.clear()
  commandResults.clear()
  suggestionSequence = 0
}
