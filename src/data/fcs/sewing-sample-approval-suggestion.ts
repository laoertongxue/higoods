import type { InspectionSnapshot, InspectionIssue } from './quality-management-types.ts'
import { validateInspectionIssues } from './quality-management-rules.ts'
import { getFactoryById } from './indonesia-factories.ts'
import { productionContextStorage, onProductionContextChanged } from './production-context-records.ts'
const getBrowserLocalStorage = () => productionContextStorage
import { formatOperationLocalWallClock } from './sewing-delivery-sla.ts'
import { productionOrders } from './production-orders.ts'
import { getProductionOrderTechPackSnapshot } from './production-order-tech-pack-runtime.ts'
import type { ProductionOrderTechPackSnapshot } from './production-tech-pack-snapshot-types.ts'

export type SewingOutsourcingTaskKind =
  | 'INDEPENDENT_SEWING'
  | 'SEWING_IRON_PACK'
  | 'CUTTING_SEWING_IRON_PACK'

export type PreProductionSampleStatus =
  | 'WAITING_PPIC_RECEIVE'
  /** Old states are read-only until explicit conversion. */
  | 'WAITING_FACTORY_PRODUCTION'
  | 'WAITING_RETURN_TO_PPIC'
  | 'PPIC_RECEIVED'
  | 'HANDED_TO_APPROVER'
  | 'APPROVAL_IN_PROGRESS'
  | 'SUGGESTION_UPLOADED'
  | 'FEEDBACK_SENT'

export type SampleApprovalConclusion = 'NO_PROBLEM' | 'HAS_PROBLEM'

export const sampleApprovalStatusLabels: Record<PreProductionSampleStatus, string> = {
  WAITING_PPIC_RECEIVE: '待PPIC接收', WAITING_FACTORY_PRODUCTION: '待转换旧记录', WAITING_RETURN_TO_PPIC: '待转换旧记录',
  PPIC_RECEIVED: '待转交批版', HANDED_TO_APPROVER: '待领取批版', APPROVAL_IN_PROGRESS: '批版中',
  SUGGESTION_UPLOADED: '待反馈工厂', FEEDBACK_SENT: '已反馈工厂',
}

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
  referenceType: 'COMPANY_SAMPLE' | 'PRODUCTION_ORDER_IMAGE' | 'PATTERN' | 'FABRIC' | 'ACCESSORY' | 'SIZE' | 'PROCESS'
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
  /** Legacy history only; never drives a new approval. */
  roundNo?: number
  samplePhotoUrls: string[]
  ppicReceivedSamplePhotoUrls: string[]
  status: PreProductionSampleStatus
  factoryCompletedAt?: string
  factoryCompletedBy?: string
  ppicReceivedAt?: string
  ppicReceivedBy?: string
  approverReceivedAt?: string
  approverReceivedBy?: string
  handedToApproverAt?: string
  handedToApproverBy?: string
  approverTeamName?: string
  createdAt: string
  factoryTimeZone?: string
  approverReceivedInstant?: string
}

export interface SampleApprovalSuggestionVersion {
  suggestionVersionId: string
  suggestionNo: string
  assignmentId: string
  runtimeTaskId: string
  sampleId: string
  /** Legacy history only; never drives a new approval. */
  roundNo?: number
  conclusion: SampleApprovalConclusion
  structuredComments: SampleApprovalStructuredComments
  approvalSheetPhotoUrls: string[]
  referenceSnapshots: SampleApprovalReferenceSnapshot[]
  /** Legacy history only. */
  requiresAnotherApproval?: boolean
  uploadedAt: string
  uploadedInstant?: string
  issues?: InspectionIssue[]
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
  assignmentAliases?: Array<{assignmentId:string;runtimeTaskId:string}>
  qualitySchemaVersion?: 1
  inspectionStandardSnapshot?: InspectionSnapshot
  legacyHistory?: { original: unknown; convertedAt: string; convertedBy: string; timeZoneEvidence?: string; unverifiedTime: boolean; note: string }
  standardSupplement?: { at: string; by: string; reason: string }
}

export interface SewingSampleActor {
  actorId: string
  actorName: string
  role: 'FACTORY' | 'PPIC' | 'SAMPLE_APPROVER'
}

const records = new Map<string, SewingSampleApprovalRecord>()
const commandResults = new Map<string, { assignmentId: string; action: string }>()
let suggestionSequence = 0
const SAMPLE_STORAGE_KEY = 'higood:sewing-sample-approval:v3'
let samplesLoaded = false
let sampleFixtureDepth=0
let sampleDefaults: {records:Array<[string,SewingSampleApprovalRecord]>;commands:Array<[string,{assignmentId:string;action:string}]>;sequence:number}={records:[],commands:[],sequence:0}
let registeredSampleStaticVersion: string | undefined
let sampleActionScope: {recordIds:Set<string>;commandId:string} | null = null

export function hasSewingSampleStaticDefaults(version: string): boolean {
  return registeredSampleStaticVersion === version
}

/** Register only the fixed defaults. Saved records never pass through fixture commands. */
export function registerSewingSampleStaticDefaults<T>(version: string, defaults: SewingSampleApprovalRecord[], buildAssignments: () => T): T {
  ensureSamplesLoaded()
  const previousDefaults = sampleDefaults
  const oldDefaults = new Map(previousDefaults.records)
  const incoming = defaults.map(record => [record.assignmentId, clone(record)] as const)
  if (new Set(incoming.map(([id]) => id)).size !== incoming.length) throw new Error('静态样衣身份重复')
  const previous = incoming.map(([id]) => [id, records.get(id)] as const)
  const previousSequence = suggestionSequence
  const previousVersion = registeredSampleStaticVersion
  // Compare only the three defaults when a static version actually changes.
  // An advanced user record, including its aliases and old history, stays intact.
  for (const [id, record] of incoming) {
    const current = records.get(id), baseline = oldDefaults.get(id)
    if (!current || (baseline && JSON.stringify(current) === JSON.stringify(baseline))) records.set(id, clone(record))
  }
  sampleDefaults = { records: [...new Map([...previousDefaults.records, ...incoming])], commands: previousDefaults.commands,
    sequence: Math.max(previousDefaults.sequence, ...defaults.flatMap(record => record.suggestionVersions.map(suggestion => Number(/^SAS-(\d+)$/.exec(suggestion.suggestionVersionId)?.[1] || 0)))) }
  suggestionSequence = Math.max(suggestionSequence, sampleDefaults.sequence)
  sampleFixtureDepth++
  try {
    const result = buildAssignments()
    registeredSampleStaticVersion = version
    return result
  } catch (error) {
    for (const [id, record] of previous) { if (record) records.set(id, record); else records.delete(id) }
    sampleDefaults = previousDefaults
    suggestionSequence = previousSequence
    registeredSampleStaticVersion = previousVersion
    throw error
  } finally { sampleFixtureDepth-- }
}
export function buildSewingSampleStaticFixture<T>(action:()=>T):T {
  ensureSamplesLoaded()
  if (sampleFixtureDepth) return action()
  const live = captureSewingSampleState()
  const previousDefaults = sampleDefaults
  const defaultRecords = new Map(previousDefaults.records)
  const defaultCommands = new Map(previousDefaults.commands)
  const recordOverrides = live.records.filter(([id, value]) => JSON.stringify(defaultRecords.get(id)) !== JSON.stringify(value))
  const commandOverrides = live.commands.filter(([id, value]) => JSON.stringify(defaultCommands.get(id)) !== JSON.stringify(value))
  // Build the static baseline separately: replaying fixture commands against a
  // saved, advanced sample would incorrectly reject the user's current state.
  restoreSewingSampleState(previousDefaults)
  sampleFixtureDepth++
  try {
    const result = action()
    sampleDefaults = captureSewingSampleState()
    restoreSewingSampleState({
      records: [...new Map([...sampleDefaults.records, ...recordOverrides])],
      commands: [...new Map([...sampleDefaults.commands, ...commandOverrides])],
      sequence: Math.max(sampleDefaults.sequence, live.sequence),
    })
    return result
  } catch (error) {
    sampleDefaults = previousDefaults
    restoreSewingSampleState(live)
    throw error
  } finally {
    sampleFixtureDepth--
  }
}
/** 裁床仅引用任务分配时不读取无关样衣数据；真正进入样衣动作时仍须完整读取，失败不能冒充空记录。 */
function ensureSamplesLoaded(): void {
  if (samplesLoaded) return
  restoreSewingSampleState(sampleDefaults);samplesLoaded=false
  const storedSamples = getBrowserLocalStorage()?.getItem(SAMPLE_STORAGE_KEY)
  if (storedSamples) {
    const saved = JSON.parse(storedSamples)
    if (saved.version !== 3 || !Array.isArray(saved.records) || !Array.isArray(saved.commands)) throw new Error('已保存的样衣批版记录无法读取，请保留原数据并核对。')
    saved.records.forEach((record: SewingSampleApprovalRecord) => records.set(record.assignmentId, record))
    saved.commands.forEach(([id, result]: [string, { assignmentId: string; action: string }]) => commandResults.set(id, result))
    suggestionSequence = Math.max(sampleDefaults.sequence,saved.sequence || 0)
  }
  samplesLoaded = true
}
function persistSamples(): void {
  if(sampleFixtureDepth || sampleActionScope) return
  const defaults=new Map(sampleDefaults.records),commands=new Map(sampleDefaults.commands)
  getBrowserLocalStorage()?.setItem?.(SAMPLE_STORAGE_KEY, JSON.stringify({
    version: 3, records: [...records].filter(([id,value])=>JSON.stringify(defaults.get(id))!==JSON.stringify(value)).map(([,value])=>value), commands: [...commandResults].filter(([id,value])=>JSON.stringify(commands.get(id))!==JSON.stringify(value)), sequence: suggestionSequence,
  }))
}

/** Explicit offsets are time points. Legacy wall clocks remain unverified unless conversion supplies their source timezone. */
export function sampleTimeToInstant(value: string, timeZone = 'Asia/Jakarta'): string {
  if (/(Z|[+-]\d{2}:?\d{2})$/.test(value)) {
    const instant = new Date(value)
    if (!Number.isFinite(instant.getTime())) throw new Error('批版时间无效')
    return instant.toISOString()
  }
  if (!/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(value)) throw new Error('批版时间格式无效')
  // Current factories use this actual registered timezone; do not reinterpret arbitrary old wall clocks.
  if (timeZone !== 'Asia/Jakarta') throw new Error('工厂时间来源尚未核对，不能推定时间点')
  const date = new Date(value.replace(' ', 'T') + '+07:00')
  if (!Number.isFinite(date.getTime())) throw new Error('批版时间无效')
  return date.toISOString()
}
export function formatSampleFactoryTime(instant: string, timeZone: string): string {
  return new Intl.DateTimeFormat('sv-SE',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date(instant))
}
export function getSampleApprovalTiming(record: SewingSampleApprovalRecord, nowAt = new Date().toISOString()) {
  const startedAt = record.sample.approverReceivedAt || ''
  const instant = record.sample.approverReceivedInstant
  const timeZone = record.sample.factoryTimeZone || getFactoryById(record.sample.factoryId)?.timezone
  const first = record.suggestionVersions[0]
  const completedInstant = first?.uploadedInstant
  const completedAt = first?.uploadedAt || ''
  if (!instant || !timeZone || (completedAt && !completedInstant)) return {startedAt,deadlineAt:'',completedAt,overdue:false,timeVerified:false,timeZone:timeZone || ''}
  const deadline = Date.parse(instant) + 172800000
  const now = sampleTimeToInstant(nowAt,timeZone)
  return {startedAt:formatSampleFactoryTime(instant,timeZone),deadlineAt:formatSampleFactoryTime(new Date(deadline).toISOString(),timeZone),
    completedAt:completedInstant ? formatSampleFactoryTime(completedInstant,timeZone) : completedAt,
    overdue:Date.parse(completedInstant || now)>deadline,timeVerified:!completedAt || !!completedInstant,timeZone}
}

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

function buildReferences(input: SewingSampleAssignmentSnapshot, snapshot: ProductionOrderTechPackSnapshot | null | undefined = getProductionOrderTechPackSnapshot(input.productionOrderId)): SampleApprovalReferenceSnapshot[] {
  if (!snapshot) return []
  const references: SampleApprovalReferenceSnapshot[] = []
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
  snapshot.patternFiles.forEach((pattern, index) => references.push({
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
    .forEach((item) => references.push({
      referenceId: `REF-${input.assignmentId}-BOM-${item.id}`,
      referenceType: item.type === '面料' ? 'FABRIC' : 'ACCESSORY',
      label: `${item.type}：${item.name}`,
      versionLabel: snapshot.versionLabel,
      sourceObjectId: item.id,
      imageUrl: item.materialImageUrl,
    }))
  if (snapshot.sizeTable.length || snapshot.sizeMeasurements.length) references.push({referenceId:`REF-${input.assignmentId}-SIZE`,referenceType:'SIZE',label:'尺寸表及测量公差',versionLabel:snapshot.versionLabel,sourceObjectId:snapshot.snapshotId,fileName:JSON.stringify({sizeTable:snapshot.sizeTable,sizeMeasurements:snapshot.sizeMeasurements})})
  for(const entry of snapshot.processEntries) references.push({referenceId:`REF-${input.assignmentId}-PROCESS-${entry.id}`,referenceType:'PROCESS',label:`工艺：${entry.processName || entry.id}`,versionLabel:snapshot.versionLabel,sourceObjectId:snapshot.snapshotId,fileName:JSON.stringify(entry)})
  return references
}

function requireRecord(assignmentId: string): SewingSampleApprovalRecord {
  ensureSamplesLoaded()
  const record = records.get(assignmentId) || [...records.values()].find(item=>item.assignmentAliases?.some(alias=>alias.assignmentId===assignmentId))
  if (!record) throw new Error(`执行任务分配${assignmentId}尚未生成产前版样衣与批版建议记录`)
  if(sampleActionScope && !sampleActionScope.recordIds.has(record.assignmentId)) throw new Error('本次样衣确认不能修改其他任务，尚未保存')
  return record
}

function requireCommand(commandId: string, assignmentId: string, action: string): boolean {
  ensureSamplesLoaded()
  const id = text(commandId, '命令号')
  const prior = commandResults.get(id)
  if (!prior) return false
  if (prior.assignmentId !== assignmentId || prior.action !== action) throw new Error('命令号已被其他业务动作使用')
  return true
}

function rememberCommand(commandId: string, assignmentId: string, action: string): void {
  if (sampleActionScope && (sampleActionScope.commandId !== commandId || !sampleActionScope.recordIds.has(requireRecord(assignmentId).assignmentId))) {
    throw new Error('本次样衣确认包含其他任务动作，尚未保存')
  }
  commandResults.set(commandId, { assignmentId, action })
  persistSamples()
}

function assertPpic(record: SewingSampleApprovalRecord, actor: SewingSampleActor): void {
  if (actor.role !== 'PPIC' || actor.actorId !== record.sample.currentPpicId) {
    throw new Error('只有该执行任务当前PPIC可以接收、转交或反馈产前版样衣')
  }
}

function assertApprover(actor: SewingSampleActor): void {
  if (actor.role !== 'SAMPLE_APPROVER') throw new Error('只有批版人员可以填写或上传批版建议')
}

/** Pure initial record constructor, shared by the original assignment action and the read-only static sample source. */
export function createSewingSampleApprovalRecord(input: SewingSampleAssignmentSnapshot, source: {
  snapshot: ProductionOrderTechPackSnapshot | null | undefined
  styleCode?: string
  styleName?: string
}): SewingSampleApprovalRecord | null {
  const taskKind = classifyTaskKind(input.processCodes)
  if (!taskKind) return null
  if (!input.ppicId || !input.ppicName) throw new Error('含车缝执行任务必须先冻结PPIC才能生成批版建议')
  const snapshot = source.snapshot
  return {
    assignmentId: input.assignmentId,
    qualitySchemaVersion: 1,
    assignmentAliases: [{ assignmentId: input.assignmentId, runtimeTaskId: input.runtimeTaskId }],
    sample: {
      sampleId: `PPS-${input.assignmentId}`, sampleNo: `CY-${input.taskNo || input.runtimeTaskId}`,
      assignmentId: input.assignmentId, runtimeTaskId: input.runtimeTaskId,
      productionOrderId: input.productionOrderId, productionOrderNo: input.productionOrderNo || input.productionOrderId,
      taskNo: input.taskNo || input.runtimeTaskId, taskKind, factoryId: input.factoryId, factoryName: input.factoryName,
      currentPpicId: input.ppicId, currentPpicName: input.ppicName,
      styleCode: snapshot?.styleCode || source.styleCode || input.productionOrderId,
      styleName: snapshot?.styleName || source.styleName || '待补款式名称',
      styleImageUrl: snapshot?.imageSnapshot.productImages[0] || snapshot?.imageSnapshot.styleImages[0] || '',
      samplePhotoUrls: [], ppicReceivedSamplePhotoUrls: [], status: 'WAITING_PPIC_RECEIVE',
      factoryTimeZone: getFactoryById(input.factoryId)?.timezone, createdAt: input.operatedAt,
    },
    referenceSnapshots: buildReferences(input, snapshot || null), suggestionVersions: [],
  }
}

export function initializeSewingSampleApprovalSuggestionForAssignment(
  input: SewingSampleAssignmentSnapshot,
): SewingSampleApprovalRecord | null {
  const taskKind = classifyTaskKind(input.processCodes)
  if (!taskKind) return null
  if (!input.ppicId || !input.ppicName) throw new Error('含车缝执行任务必须先冻结PPIC才能生成批版建议')
  ensureSamplesLoaded()
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
  const canonical = [...records.values()].find(item=>item.sample.productionOrderId===input.productionOrderId && item.sample.factoryId===input.factoryId && item.sample.styleCode===styleCode)
  if(canonical){
    const aliases=canonical.assignmentAliases || [{assignmentId:canonical.assignmentId,runtimeTaskId:canonical.sample.runtimeTaskId}]
    if(!aliases.some(alias=>alias.assignmentId===input.assignmentId)){canonical.assignmentAliases=[...aliases,{assignmentId:input.assignmentId,runtimeTaskId:input.runtimeTaskId}];persistSamples()}
    return clone(canonical)
  }

  const record = createSewingSampleApprovalRecord(input, { snapshot, styleCode, styleName })!
  records.set(input.assignmentId, record)
  persistSamples()
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
  assertCurrentFormat(record)
  if (record.sample.status !== 'WAITING_PPIC_RECEIVE') throw new Error('当前产前版样衣不能重复实收')
  const duplicate=[...records.values()].find(item=>item.assignmentId!==record.assignmentId && item.sample.factoryId===record.sample.factoryId && item.sample.productionOrderId===record.sample.productionOrderId && item.sample.styleCode===record.sample.styleCode && !!item.sample.ppicReceivedAt)
  if(duplicate&&!sampleFixtureDepth) throw new Error(`同厂同款同单已有实收样衣 ${duplicate.sample.sampleNo}，请核对重复任务来源，不能重复收样`)
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
  assertCurrentFormat(record)
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
  receivedAt?: string
  inspectionStandardSnapshot: InspectionSnapshot
  actor: SewingSampleActor
}): SewingSampleApprovalRecord {
  const record = requireRecord(input.assignmentId)
  if (requireCommand(input.commandId, input.assignmentId, 'START_APPROVAL')) return clone(record)
  assertApprover(input.actor)
  assertCurrentFormat(record)
  assertSampleSnapshot(input.inspectionStandardSnapshot)
  if (record.sample.status !== 'HANDED_TO_APPROVER') throw new Error('产前版样衣尚未由PPIC转交批版人员')
  record.currentApproverId = input.actor.actorId
  record.currentApproverName = text(input.actor.actorName, '批版人员')
  record.sample.approverReceivedAt = text(input.receivedAt || formatOperationLocalWallClock(), '批版人员接收时间')
  const timeZone = getFactoryById(record.sample.factoryId)?.timezone
  if (!timeZone) throw new Error('工厂时区缺失，请先核对工厂资料')
  record.sample.factoryTimeZone = timeZone
  record.sample.approverReceivedInstant = sampleTimeToInstant(record.sample.approverReceivedAt,timeZone)
  record.inspectionStandardSnapshot = clone(input.inspectionStandardSnapshot)
  record.referenceSnapshots = buildReferences({assignmentId:record.assignmentId,runtimeTaskId:record.sample.runtimeTaskId,productionOrderId:record.sample.productionOrderId,factoryId:record.sample.factoryId,factoryName:record.sample.factoryName,processCodes:[],operatedAt:record.sample.approverReceivedAt})
  record.sample.approverReceivedBy = record.currentApproverName
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
  issues?: InspectionIssue[]
  uploadedAt: string
}): SampleApprovalSuggestionVersion {
  const record = requireRecord(input.assignmentId)
  if (requireCommand(input.commandId, input.assignmentId, 'SUBMIT_SUGGESTION')) {
    return clone(record.suggestionVersions.at(-1)!)
  }
  assertApprover(input.actor)
  assertCurrentFormat(record)
  if (!record.inspectionStandardSnapshot) throw new Error('旧记录原无标准快照，请先明确补定本次要求')
  if (record.sample.status !== 'APPROVAL_IN_PROGRESS') throw new Error('当前产前版样衣不在批版中，不能上传批版建议')
  if (record.currentApproverId && record.currentApproverId !== input.actor.actorId) {
    throw new Error('当前批版建议已由其他批版人员领取')
  }
  const structuredComments = normalizeStructuredComments(input.structuredComments)
  if (!['NO_PROBLEM','HAS_PROBLEM'].includes(input.conclusion)) throw new Error('请选择批版结论')
  const issues = clone(input.issues || [])
  validateInspectionIssues(record.inspectionStandardSnapshot,issues)
  if (input.conclusion === 'HAS_PROBLEM' && !issues.length) throw new Error('有问题时必须标记具体标准项目并填写问题')
  if (issues.some(issue=>!issue.note?.trim())) throw new Error('请填写具体标准项目的问题说明')
  if (input.conclusion === 'NO_PROBLEM' && issues.length) throw new Error('已标记问题，请选择有问题结论')
  suggestionSequence += 1
  const suggestion: SampleApprovalSuggestionVersion = {
    suggestionVersionId: `SAS-${String(suggestionSequence).padStart(6, '0')}`,
    suggestionNo: `BPJY-${record.sample.taskNo}`,
    assignmentId: record.assignmentId,
    runtimeTaskId: record.sample.runtimeTaskId,
    sampleId: record.sample.sampleId,
    conclusion: input.conclusion,
    structuredComments,
    approvalSheetPhotoUrls: [...new Set((input.approvalSheetPhotoUrls || []).map((item) => item.trim()).filter(Boolean))],
    referenceSnapshots: clone(record.referenceSnapshots),
    issues,
    uploadedInstant: sampleTimeToInstant(input.uploadedAt,record.sample.factoryTimeZone),
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
  assertCurrentFormat(record)
  const latest = record.suggestionVersions.at(-1)
  if (!latest) throw new Error('未找到可反馈的批版建议版本')
  latest.feedbackSentAt = text(input.feedbackAt, '反馈时间')
  latest.feedbackSentByPpicId = input.actor.actorId
  latest.feedbackSentByPpicName = input.actor.actorName
  latest.feedbackNote = text(input.feedbackNote, '反馈说明')
  record.sample.status = 'FEEDBACK_SENT'
  rememberCommand(input.commandId, input.assignmentId, 'FEEDBACK_FACTORY')
  return clone(record)
}

export function transferSewingSampleApprovalSuggestionPpic(input: {
  runtimeTaskId: string
  targetPpicId: string
  targetPpicName: string
}): void {
  ensureSamplesLoaded()
  records.forEach((record) => {
    if ((record.sample.runtimeTaskId !== input.runtimeTaskId && !record.assignmentAliases?.some(alias=>alias.runtimeTaskId===input.runtimeTaskId)) || record.sample.status === 'FEEDBACK_SENT') return
    record.sample.currentPpicId = input.targetPpicId
    record.sample.currentPpicName = input.targetPpicName
  })
  persistSamples()
}

function assertCurrentFormat(record: SewingSampleApprovalRecord): void {
  if (record.qualitySchemaVersion !== 1) throw new Error('此为旧样衣记录，请先核对并转换；原照片、意见和领取人保留')
}
function assertSampleSnapshot(snapshot: InspectionSnapshot): void {
  if (!snapshot || !Array.isArray(snapshot.items) || !snapshot.items.length || snapshot.ruleSnapshot !== null || snapshot.context.sourceKind !== 'PRE_PRODUCTION_SAMPLE' || snapshot.context.objectType !== 'GARMENT') throw new Error('产前版须使用有效成衣检查要求，不配置抽检规则')
}
/** Explicit, single-record conversion. The enclosing original-store command makes copy+marker+files atomic. */
export function convertLegacySampleApproval(input:{assignmentId:string;commandId:string;at:string;by:string;knownLegacyTimeZone?:string;timeZoneEvidence?:string}):SewingSampleApprovalRecord {
  const record=requireRecord(input.assignmentId)
  if(record.qualitySchemaVersion===1) return clone(record)
  if(input.knownLegacyTimeZone && !input.timeZoneEvidence?.trim()) throw new Error('转换旧时间须说明可验证的来源依据')
  const original=clone(record),sample=record.sample
  const siblings=[...records.values()].filter(item=>item.assignmentId!==record.assignmentId && item.sample.factoryId===sample.factoryId && item.sample.productionOrderId===sample.productionOrderId && item.sample.styleCode===sample.styleCode)
  if(siblings.some(item=>item.sample.ppicReceivedAt || item.sample.approverReceivedAt)) throw new Error('同厂同款同单存在多件真实样衣，请逐条核对冲突，未合并或删除原记录')
  const hadNextPhysical=!!(sample.ppicReceivedAt || sample.approverReceivedAt)
  const latest=record.suggestionVersions.at(-1)
  const nextPlanned=(sample.roundNo || 1)>1 && !hadNextPhysical
  if(nextPlanned && !latest?.feedbackSentAt) throw new Error('旧再批计划缺少已反馈事实，请核对后再转换，未覆盖原记录')
  record.legacyHistory={original,convertedAt:text(input.at,'转换时间'),convertedBy:text(input.by,'转换人'),unverifiedTime:!input.knownLegacyTimeZone,
    timeZoneEvidence:input.timeZoneEvidence,note:nextPlanned?'未发生的后续计划归档，以最近已反馈结论结束':'旧记录原无检查快照；已发生意见、照片与转交原文保留'}
  if(input.knownLegacyTimeZone && !input.timeZoneEvidence?.trim()) throw new Error('转换旧时间须说明可验证的来源依据')
  if(input.knownLegacyTimeZone) {
    sample.factoryTimeZone=getFactoryById(sample.factoryId)?.timezone
    if(sample.approverReceivedAt) sample.approverReceivedInstant=sampleTimeToInstant(sample.approverReceivedAt,input.knownLegacyTimeZone)
    record.suggestionVersions.forEach(version=>{version.uploadedInstant=sampleTimeToInstant(version.uploadedAt,input.knownLegacyTimeZone)})
  }
  if(nextPlanned) sample.status='FEEDBACK_SENT'
  else if(sample.status==='WAITING_FACTORY_PRODUCTION' || sample.status==='WAITING_RETURN_TO_PPIC') sample.status='WAITING_PPIC_RECEIVE'
  // If the next physical garment really exists, earlier opinions stay in the immutable archive only.
  if((sample.roundNo || 1)>1 && hadNextPhysical) {
    record.suggestionVersions=record.suggestionVersions.filter(version=>version.roundNo===sample.roundNo)
    const latestCurrent=record.suggestionVersions.at(-1)
    if(latestCurrent) record.latestSuggestionVersionId=latestCurrent.suggestionVersionId
    else delete record.latestSuggestionVersionId
  }
  delete sample.roundNo
  record.suggestionVersions.forEach(version=>{delete version.roundNo;delete version.requiresAnotherApproval})
  record.assignmentAliases=[...new Map([{assignmentId:record.assignmentId,runtimeTaskId:sample.runtimeTaskId},...siblings.flatMap(item=>item.assignmentAliases || [{assignmentId:item.assignmentId,runtimeTaskId:item.sample.runtimeTaskId}])].map(alias=>[alias.assignmentId,alias])).values()]
  if(siblings.length){(record.legacyHistory!.original as Record<string,unknown>).pendingAliasHistory=siblings.map(clone);siblings.forEach(item=>records.delete(item.assignmentId))}
  record.qualitySchemaVersion=1
  rememberCommand(input.commandId,input.assignmentId,'CONVERT_LEGACY')
  return clone(record)
}
export function supplementLegacySampleStandard(input:{assignmentId:string;commandId:string;at:string;by:string;reason:string;snapshot:InspectionSnapshot}):SewingSampleApprovalRecord {
  const record=requireRecord(input.assignmentId)
  assertCurrentFormat(record)
  if(record.sample.status!=='APPROVAL_IN_PROGRESS' || record.inspectionStandardSnapshot || !record.legacyHistory) throw new Error('当前记录不需要补定检查要求')
  assertSampleSnapshot(input.snapshot)
  record.inspectionStandardSnapshot=clone(input.snapshot)
  record.standardSupplement={at:text(input.at,'补定时刻'),by:text(input.by,'补定人'),reason:text(input.reason,'补定原因')}
  rememberCommand(input.commandId,input.assignmentId,'SUPPLEMENT_STANDARD')
  return clone(record)
}

export function getSewingSampleApprovalRecord(assignmentId: string): SewingSampleApprovalRecord | null {
  ensureSamplesLoaded()
  const record = records.get(assignmentId) || [...records.values()].find(item=>item.assignmentAliases?.some(alias=>alias.assignmentId===assignmentId))
  return record ? clone(record) : null
}

export function listSewingSampleApprovalRecords(): SewingSampleApprovalRecord[] {
  ensureSamplesLoaded()
  return [...records.values()].map(clone)
}

/** Search/count every sample without copying standards, images or old opinion history. */
export function listSewingSampleApprovalListEntries() {
  ensureSamplesLoaded()
  return [...records.values()].map(record => ({
    assignmentId: record.assignmentId,
    assignmentAliases: (record.assignmentAliases || [{ assignmentId: record.assignmentId, runtimeTaskId: record.sample.runtimeTaskId }]).map(alias => ({ ...alias })),
    sample: {
      status: record.sample.status, styleCode: record.sample.styleCode, styleName: record.sample.styleName,
      productionOrderNo: record.sample.productionOrderNo, taskNo: record.sample.taskNo,
      factoryName: record.sample.factoryName, currentPpicName: record.sample.currentPpicName,
    },
  }))
}

export function resetSewingSampleApprovalSuggestionsForTests(): void {
  registeredSampleStaticVersion = undefined
  sampleDefaults={records:[],commands:[],sequence:0}
  getBrowserLocalStorage()?.removeItem?.(SAMPLE_STORAGE_KEY)
  records.clear()
  commandResults.clear()
  suggestionSequence = 0
  samplesLoaded = true
}

export function captureSewingSampleState() {
  ensureSamplesLoaded()
  return structuredClone({records:[...records],commands:[...commandResults],sequence:suggestionSequence})
}

/** The original PP page changes one physical sample. Pending aliases of that
 * same factory/order/style belong to its explicit legacy conversion only.
 * All other samples and command history stay in their existing maps. */
export function createSewingSampleActionScope(assignmentId:string,commandId:string) {
  const canonical=requireRecord(assignmentId)
  const recordIds=[...records.values()].filter(record=>record.assignmentId===canonical.assignmentId ||
    record.sample.factoryId===canonical.sample.factoryId && record.sample.productionOrderId===canonical.sample.productionOrderId && record.sample.styleCode===canonical.sample.styleCode)
    .map(record=>record.assignmentId)
  const ids=new Set(recordIds)
  const originalOrder=[...records.keys()]
  const capture=()=>structuredClone({records:recordIds.filter(id=>records.has(id)).map(id=>[id,records.get(id)!] as [string,SewingSampleApprovalRecord]),
    commands:commandResults.has(commandId)?[[commandId,commandResults.get(commandId)!] as [string,{assignmentId:string;action:string}]]:[],sequence:suggestionSequence})
  const restore=(value:ReturnType<typeof capture>)=>{
    const restoredIds=new Set(value.records.map(([id])=>id))
    const hasRemovedRecord=value.records.some(([id])=>!records.has(id))
    for(const id of recordIds)if(!restoredIds.has(id))records.delete(id)
    for(const [id,record] of value.records){if(!ids.has(id))throw new Error('本次样衣恢复范围不一致');records.set(id,clone(record))}
    if(hasRemovedRecord){
      const order=new Map(originalOrder.map((id,index)=>[id,index]))
      const ordered=[...records].sort(([left],[right])=>(order.get(left)??Infinity)-(order.get(right)??Infinity))
      records.clear();for(const [id,record] of ordered)records.set(id,record)
    }
    commandResults.delete(commandId)
    for(const [id,result] of value.commands){if(id!==commandId)throw new Error('本次样衣命令范围不一致');commandResults.set(id,clone(result))}
    suggestionSequence=value.sequence;samplesLoaded=true
  }
  const run=<T>(action:()=>T):T=>{
    if(sampleActionScope)throw new Error('另一项样衣确认尚未完成')
    sampleActionScope={recordIds:ids,commandId}
    try{return action()}finally{sampleActionScope=null}
  }
  return {recordIds,commandId,capture,restore,run}
}
export function restoreSewingSampleState(state: ReturnType<typeof captureSewingSampleState>): void {
  records.clear(); commandResults.clear()
  for(const [key,value] of state.records) records.set(key,structuredClone(value))
  for(const [key,value] of state.commands) commandResults.set(key,structuredClone(value))
  suggestionSequence=state.sequence; samplesLoaded=true
}
onProductionContextChanged(SAMPLE_STORAGE_KEY,()=>{
  restoreSewingSampleState(sampleDefaults); samplesLoaded=false
})
