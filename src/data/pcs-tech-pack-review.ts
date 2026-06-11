import {
  getTechnicalDataVersionById,
  getTechnicalDataVersionContent,
  updateTechnicalDataVersionRecord,
} from './pcs-technical-data-version-repository.ts'
import { appendTechPackVersionLog } from './pcs-tech-pack-version-log-repository.ts'
import {
  formatTechPackDesignRequirementBlockMessage,
  validateTechPackDesignRequirement,
} from './pcs-tech-pack-design-requirement.ts'
import {
  getLegacyTechPackReviewer,
  getTechPackReviewerById,
  getTechPackReviewerByName,
  type TechPackReviewer,
} from './pcs-tech-pack-reviewer-directory.ts'
import { buildTechPackReviewDiffSnapshot } from './pcs-tech-pack-review-diff.ts'
import { sendTechPackReviewFeishuNotification } from './pcs-tech-pack-review-feishu.ts'
import type {
  TechnicalDataVersionRecord,
  TechnicalModuleKey,
  TechnicalReviewNode,
  TechnicalReviewNodeKey,
  TechnicalReviewNodeStatus,
  TechnicalReviewRole,
  TechnicalReviewStage,
} from './pcs-technical-data-version-types.ts'
import type { TechPackVersionLogType } from './pcs-tech-pack-version-log-types.ts'

export interface TechPackReviewOperator {
  id?: string
  name: string
}

export interface SubmitTechPackReviewInput {
  buyerReviewerId: string
  patternMakerReviewerId: string
  merchandiserReviewerId: string
  operator?: string | TechPackReviewOperator
}

export interface TechPackReviewActionInput {
  operator?: string | TechPackReviewOperator
  opinion?: string
}

export interface TechPackReviewPendingReviewerInfo {
  nodeKey: TechnicalReviewNodeKey
  role: TechnicalReviewRole
  reviewerName: string
  status: TechnicalReviewNodeStatus
  lastFeishuNotifyStatus: TechnicalReviewNode['lastFeishuNotifyStatus']
  todayFeishuNotifiedFlag: boolean
}

const REVIEW_NODE_META: Record<
  TechnicalReviewNodeKey,
  { nodeName: TechnicalReviewNode['nodeName']; reviewerRole: TechnicalReviewRole }
> = {
  BUYER: { nodeName: '买手审核', reviewerRole: '买手' },
  PATTERN_MAKER: { nodeName: '版师审核', reviewerRole: '版师' },
  MERCHANDISER: { nodeName: '跟单审核', reviewerRole: '跟单' },
}

export const TECH_PACK_REVIEW_MODULES: Record<TechnicalReviewNodeKey, TechnicalModuleKey[]> = {
  BUYER: ['BOM', 'COST'],
  PATTERN_MAKER: ['PATTERN'],
  MERCHANDISER: ['MATERIAL_PATTERN_LINK', 'COLOR_MATERIAL_MAPPING', 'PROCESS', 'SIZE', 'DESIGN', 'QUALITY'],
}

const MODULE_OWNER: Partial<Record<TechnicalModuleKey, TechnicalReviewNodeKey>> = {
  BOM: 'BUYER',
  COST: 'BUYER',
  PATTERN: 'PATTERN_MAKER',
  MATERIAL_PATTERN_LINK: 'MERCHANDISER',
  COLOR_MATERIAL_MAPPING: 'MERCHANDISER',
  PROCESS: 'MERCHANDISER',
  SIZE: 'MERCHANDISER',
  DESIGN: 'MERCHANDISER',
  ATTACHMENT: 'MERCHANDISER',
  QUALITY: 'MERCHANDISER',
}

const REVIEW_SCOPE_TEXT: Record<TechnicalReviewNodeKey, string> = {
  BUYER: '物料清单、核价',
  PATTERN_MAKER: '纸样池',
  MERCHANDISER: '物料&纸样关联管理、款色用料对应、剩余部分、整体复核',
}

export const TECH_PACK_REVIEW_MODULE_LABELS: Record<TechnicalModuleKey, string> = {
  BOM: '物料清单',
  COST: '核价',
  PATTERN: '纸样池',
  MATERIAL_PATTERN_LINK: '物料&纸样关联管理',
  COLOR_MATERIAL_MAPPING: '款色用料对应',
  PROCESS: '工序工艺',
  SIZE: '放码规则',
  DESIGN: '花型设计',
  ATTACHMENT: '附件',
  QUALITY: '质量规则/整体复核',
}

export const TECH_PACK_REVIEW_REWORK_MODULES: TechnicalModuleKey[] = [
  'BOM',
  'COST',
  'PATTERN',
  'MATERIAL_PATTERN_LINK',
  'COLOR_MATERIAL_MAPPING',
  'PROCESS',
  'SIZE',
  'DESIGN',
  'QUALITY',
]

let reviewLogSequence = 0

function nowText(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

function normalizeOperator(input?: string | TechPackReviewOperator, fallbackName = '当前用户'): Required<TechPackReviewOperator> {
  if (typeof input === 'string') {
    const reviewer = getTechPackReviewerByName(input)
    return { id: reviewer?.reviewerId || '', name: input || fallbackName }
  }
  return {
    id: input?.id || '',
    name: input?.name || fallbackName,
  }
}

function assertOpinionRequired(opinion: string, actionLabel: string): string {
  const trimmed = opinion.trim()
  if (!trimmed) throw new Error(`请填写${actionLabel}意见。`)
  return trimmed
}

function normalizeModuleKeys(moduleKeys: TechnicalModuleKey[] | undefined): TechnicalModuleKey[] {
  if (!Array.isArray(moduleKeys)) return []
  const validKeys = new Set<TechnicalModuleKey>(TECH_PACK_REVIEW_REWORK_MODULES)
  return [...new Set(moduleKeys.filter((moduleKey) => validKeys.has(moduleKey)))]
}

function normalizeNodeKeys(nodeKeys: TechnicalReviewNodeKey[] | undefined): TechnicalReviewNodeKey[] {
  if (!Array.isArray(nodeKeys)) return []
  const validKeys = new Set<TechnicalReviewNodeKey>(['BUYER', 'PATTERN_MAKER', 'MERCHANDISER'])
  return [...new Set(nodeKeys.filter((nodeKey) => validKeys.has(nodeKey)))]
}

function formatModuleLabels(moduleKeys: TechnicalModuleKey[]): string {
  return moduleKeys.map((moduleKey) => TECH_PACK_REVIEW_MODULE_LABELS[moduleKey] || moduleKey).join('、')
}

function formatNodeRoles(nodeKeys: TechnicalReviewNodeKey[]): string {
  return nodeKeys.map((nodeKey) => REVIEW_NODE_META[nodeKey].reviewerRole).join('、')
}

export function resolveReviewNodeKeysByModules(moduleKeys: TechnicalModuleKey[]): TechnicalReviewNodeKey[] {
  return [...new Set(normalizeModuleKeys(moduleKeys).map((moduleKey) => getTechnicalModuleReviewOwner(moduleKey)))]
}

function resolveReviewerForNode(nodeKey: TechnicalReviewNodeKey, reviewerId: string): TechPackReviewer {
  const meta = REVIEW_NODE_META[nodeKey]
  const reviewer = getTechPackReviewerById(reviewerId)
  if (!reviewer) throw new Error(`请选择${meta.reviewerRole}审核人。`)
  if (!reviewer.roles.includes(meta.reviewerRole)) {
    throw new Error(`${reviewer.reviewerName} 不是${meta.reviewerRole}，不能作为${meta.nodeName}审核人。`)
  }
  return reviewer
}

function buildAssignedReviewNode(
  nodeKey: TechnicalReviewNodeKey,
  status: TechnicalReviewNodeStatus,
  reviewer: TechPackReviewer,
  assignedAt: string,
  assignedBy: string,
): TechnicalReviewNode {
  const meta = REVIEW_NODE_META[nodeKey]
  return normalizeTechnicalReviewNode(nodeKey, {
    status,
    assignedReviewerId: reviewer.reviewerId,
    assignedReviewerName: reviewer.reviewerName,
    assignedReviewerRole: meta.reviewerRole,
    assignedReviewerFeishuOpenId: reviewer.feishuOpenId,
    assignedAt,
    assignedBy,
  })
}

function withReviewDiffSnapshot(
  record: TechnicalDataVersionRecord,
  node: TechnicalReviewNode,
): TechnicalReviewNode {
  const diff = buildTechPackReviewDiffSnapshot(record, node.nodeKey)
  return normalizeTechnicalReviewNode(node.nodeKey, {
    ...node,
    diffSnapshotId: diff.snapshotId,
    diffStatus: diff.diffStatus,
    diffSummaryText: diff.summaryText,
  })
}

function shouldSkipReviewByDiff(node: TechnicalReviewNode): boolean {
  return (node.nodeKey === 'BUYER' || node.nodeKey === 'PATTERN_MAKER') && node.diffStatus === '无差异'
}

function markReviewNodeAsNoReview(node: TechnicalReviewNode, submittedAt: string): TechnicalReviewNode {
  return normalizeTechnicalReviewNode(node.nodeKey, {
    ...node,
    status: '无需审核',
    reviewedBy: '系统判断',
    reviewedAt: submittedAt,
    startedOpinion: '',
    opinion: '相对最新已发布版本无差异，提交时自动标记无需审核。',
    lastFeishuNotifyStatus: '未发送',
    lastFeishuNotifyAt: '',
    lastFeishuNotifyRecordId: '',
    todayFeishuNotifiedFlag: false,
    todayFeishuNotifyAt: '',
    feishuNotifyCount: 0,
  })
}

function buildSubmittedReviewNode(input: {
  record: TechnicalDataVersionRecord
  nodeKey: TechnicalReviewNodeKey
  reviewer: TechPackReviewer
  submittedAt: string
  operatorName: string
}): TechnicalReviewNode {
  const node = withReviewDiffSnapshot(
    input.record,
    buildAssignedReviewNode(input.nodeKey, '待审核', input.reviewer, input.submittedAt, input.operatorName),
  )
  return shouldSkipReviewByDiff(node) ? markReviewNodeAsNoReview(node, input.submittedAt) : node
}

export function isTechnicalReviewNodeComplete(node: Pick<TechnicalReviewNode, 'status'>): boolean {
  return node.status === '审核-已通过' || node.status === '无需审核'
}

function assertAssignedReviewer(node: TechnicalReviewNode, operator: Required<TechPackReviewOperator>): void {
  if (!node.assignedReviewerId && !node.assignedReviewerName) return
  const matchedById = Boolean(operator.id && node.assignedReviewerId && operator.id === node.assignedReviewerId)
  const matchedByName = Boolean(operator.name && node.assignedReviewerName && operator.name === node.assignedReviewerName)
  if (!matchedById && !matchedByName) {
    throw new Error(`仅指定审核人 ${node.assignedReviewerName || '-'} 可处理${node.nodeName}。`)
  }
}

function createReviewNode(
  nodeKey: TechnicalReviewNodeKey,
  status: TechnicalReviewNodeStatus = '待审核',
): TechnicalReviewNode {
  const meta = REVIEW_NODE_META[nodeKey]
  return {
    nodeKey,
    nodeName: meta.nodeName,
    status,
    reviewerRole: meta.reviewerRole,
    assignedReviewerId: '',
    assignedReviewerName: '',
    assignedReviewerRole: meta.reviewerRole,
    assignedReviewerFeishuOpenId: '',
    assignedAt: '',
    assignedBy: '',
    reviewedBy: '',
    reviewedAt: '',
    startedOpinion: '',
    opinion: '',
    diffSnapshotId: '',
    diffStatus: '无基线',
    diffSummaryText: '',
    lastFeishuNotifyAt: '',
    lastFeishuNotifyStatus: '未发送',
    lastFeishuNotifyRecordId: '',
    todayFeishuNotifiedFlag: false,
    todayFeishuNotifyAt: '',
    feishuNotifyCount: 0,
  }
}

export function normalizeTechnicalReviewNode(
  nodeKey: TechnicalReviewNodeKey,
  node?: Partial<TechnicalReviewNode> | null,
): TechnicalReviewNode {
  const base = createReviewNode(nodeKey)
  const meta = REVIEW_NODE_META[nodeKey]
  const status =
    node?.status === '待审核' ||
    node?.status === '无需审核' ||
    node?.status === '审核中' ||
    node?.status === '审核-未通过' ||
    node?.status === '审核-已通过'
      ? node.status
      : base.status
  return {
    ...base,
    ...node,
    nodeKey,
    nodeName: meta.nodeName,
    reviewerRole: meta.reviewerRole,
    status,
    assignedReviewerId: node?.assignedReviewerId || '',
    assignedReviewerName: node?.assignedReviewerName || '',
    assignedReviewerRole:
      node?.assignedReviewerRole === '买手' ||
      node?.assignedReviewerRole === '版师' ||
      node?.assignedReviewerRole === '跟单'
        ? node.assignedReviewerRole
        : meta.reviewerRole,
    assignedReviewerFeishuOpenId: node?.assignedReviewerFeishuOpenId || '',
    assignedAt: node?.assignedAt || '',
    assignedBy: node?.assignedBy || '',
    reviewedBy: node?.reviewedBy || '',
    reviewedAt: node?.reviewedAt || '',
    startedOpinion: node?.startedOpinion || '',
    opinion: node?.opinion || '',
    diffSnapshotId: node?.diffSnapshotId || '',
    diffStatus:
      node?.diffStatus === '无基线' || node?.diffStatus === '无差异' || node?.diffStatus === '有差异'
        ? node.diffStatus
        : '无基线',
    diffSummaryText: node?.diffSummaryText || '',
    lastFeishuNotifyAt: node?.lastFeishuNotifyAt || '',
    lastFeishuNotifyStatus:
      node?.lastFeishuNotifyStatus === '已发送' || node?.lastFeishuNotifyStatus === '发送失败'
        ? node.lastFeishuNotifyStatus
        : '未发送',
    lastFeishuNotifyRecordId: node?.lastFeishuNotifyRecordId || '',
    todayFeishuNotifiedFlag: Boolean(node?.todayFeishuNotifiedFlag),
    todayFeishuNotifyAt: node?.todayFeishuNotifyAt || '',
    feishuNotifyCount: Number.isFinite(Number(node?.feishuNotifyCount)) ? Number(node?.feishuNotifyCount) : 0,
  }
}

function deriveReviewStage(input: {
  versionStatus?: string
  reviewStage?: TechnicalReviewStage
  buyerReview: TechnicalReviewNode
  patternMakerReview: TechnicalReviewNode
  merchandiserReview: TechnicalReviewNode
}): TechnicalReviewStage {
  if (input.versionStatus === 'PUBLISHED') return '已发布'
  if (input.versionStatus === 'ARCHIVED') return '已发布'
  if (input.merchandiserReview.status === '审核-已通过') return '待发布'
  if (
    isTechnicalReviewNodeComplete(input.buyerReview) &&
    isTechnicalReviewNodeComplete(input.patternMakerReview)
  ) {
    return '跟单复核'
  }
  if (
    input.reviewStage === '第一阶段并行审核' ||
    input.reviewStage === '跟单复核' ||
    input.buyerReview.status !== '待审核' ||
    input.patternMakerReview.status !== '待审核'
  ) {
    return '第一阶段并行审核'
  }
  return '未提交审核'
}

export function normalizeTechnicalReviewSnapshot(
  record: Partial<TechnicalDataVersionRecord>,
): Pick<
  TechnicalDataVersionRecord,
  | 'reviewStage'
  | 'buyerReview'
  | 'patternMakerReview'
  | 'merchandiserReview'
  | 'reviewSubmittedAt'
  | 'reviewSubmittedBy'
  | 'returnedFromMerchandiserFlag'
  | 'reviewUnlockedModuleKeys'
> {
  const buyerReview = normalizeTechnicalReviewNode('BUYER', record.buyerReview)
  const patternMakerReview = normalizeTechnicalReviewNode('PATTERN_MAKER', record.patternMakerReview)
  const merchandiserReview = normalizeTechnicalReviewNode('MERCHANDISER', record.merchandiserReview)
  return {
    reviewStage: deriveReviewStage({
      versionStatus: record.versionStatus,
      reviewStage: record.reviewStage,
      buyerReview,
      patternMakerReview,
      merchandiserReview,
    }),
    buyerReview,
    patternMakerReview,
    merchandiserReview,
    reviewSubmittedAt: record.reviewSubmittedAt || '',
    reviewSubmittedBy: record.reviewSubmittedBy || '',
    returnedFromMerchandiserFlag: Boolean(record.returnedFromMerchandiserFlag),
    reviewUnlockedModuleKeys: normalizeModuleKeys(record.reviewUnlockedModuleKeys),
  }
}

export function getTechnicalReviewNodes(
  record: Partial<TechnicalDataVersionRecord>,
): Record<TechnicalReviewNodeKey, TechnicalReviewNode> {
  const snapshot = normalizeTechnicalReviewSnapshot(record)
  return {
    BUYER: snapshot.buyerReview,
    PATTERN_MAKER: snapshot.patternMakerReview,
    MERCHANDISER: snapshot.merchandiserReview,
  }
}

export function isTechnicalReviewNodeLocked(status: TechnicalReviewNodeStatus): boolean {
  return status === '无需审核' || status === '审核中' || status === '审核-已通过'
}

export function getTechnicalModuleReviewOwner(moduleKey: TechnicalModuleKey): TechnicalReviewNodeKey {
  return MODULE_OWNER[moduleKey] || 'MERCHANDISER'
}

export function canEditTechnicalModule(
  record: Partial<TechnicalDataVersionRecord>,
  moduleKey: TechnicalModuleKey,
): boolean {
  if (record.versionStatus !== 'DRAFT') return false
  const unlockedModuleKeys = normalizeModuleKeys(record.reviewUnlockedModuleKeys)
  if (unlockedModuleKeys.length > 0 && !unlockedModuleKeys.includes(moduleKey)) return false
  const nodes = getTechnicalReviewNodes(record)
  if (isTechnicalReviewNodeLocked(nodes.MERCHANDISER.status)) return false
  const owner = getTechnicalModuleReviewOwner(moduleKey)
  return !isTechnicalReviewNodeLocked(nodes[owner].status)
}

export function canPublishTechnicalVersionByReview(
  record: Pick<TechnicalDataVersionRecord, 'versionStatus' | 'merchandiserReview'>,
): boolean {
  const snapshot = normalizeTechnicalReviewSnapshot(record)
  return record.versionStatus === 'DRAFT' && snapshot.merchandiserReview.status === '审核-已通过'
}

export function getTechnicalReviewPendingRoles(
  record: Partial<TechnicalDataVersionRecord>,
): TechnicalReviewRole[] {
  const snapshot = normalizeTechnicalReviewSnapshot(record)
  if (record.versionStatus === 'PUBLISHED') return []
  if (snapshot.reviewStage === '未提交审核') return ['买手', '版师']
  if (snapshot.reviewStage === '待发布') return []
  if (snapshot.reviewStage === '跟单复核') {
    return snapshot.merchandiserReview.status === '审核-已通过' ? [] : ['跟单']
  }
  const roles: TechnicalReviewRole[] = []
  if (!isTechnicalReviewNodeComplete(snapshot.buyerReview)) roles.push('买手')
  if (!isTechnicalReviewNodeComplete(snapshot.patternMakerReview)) roles.push('版师')
  return roles
}

export function getTechnicalReviewPendingReviewerInfos(
  record: Partial<TechnicalDataVersionRecord>,
): TechPackReviewPendingReviewerInfo[] {
  const snapshot = normalizeTechnicalReviewSnapshot(record)
  if (record.versionStatus === 'PUBLISHED' || snapshot.reviewStage === '待发布') return []

  const buildInfo = (
    node: TechnicalReviewNode,
    fallbackRole: TechnicalReviewRole,
  ): TechPackReviewPendingReviewerInfo => ({
    nodeKey: node.nodeKey,
    role: fallbackRole,
    reviewerName: node.assignedReviewerName || fallbackRole,
    status: node.status,
    lastFeishuNotifyStatus: node.lastFeishuNotifyStatus,
    todayFeishuNotifiedFlag: node.todayFeishuNotifiedFlag,
  })

  if (snapshot.reviewStage === '未提交审核') {
    return [
      buildInfo(snapshot.buyerReview, '买手'),
      buildInfo(snapshot.patternMakerReview, '版师'),
    ]
  }
  if (snapshot.reviewStage === '跟单复核') {
    return snapshot.merchandiserReview.status === '审核-已通过'
      ? []
      : [buildInfo(snapshot.merchandiserReview, '跟单')]
  }

  const pending: TechPackReviewPendingReviewerInfo[] = []
  if (!isTechnicalReviewNodeComplete(snapshot.buyerReview)) pending.push(buildInfo(snapshot.buyerReview, '买手'))
  if (!isTechnicalReviewNodeComplete(snapshot.patternMakerReview)) {
    pending.push(buildInfo(snapshot.patternMakerReview, '版师'))
  }
  return pending
}

export function getTechnicalReviewPendingReviewerText(record: Partial<TechnicalDataVersionRecord>): string {
  const pending = getTechnicalReviewPendingReviewerInfos(record)
  if (pending.length === 0) return '无'
  return pending
    .map((item) => `${item.role}：${item.reviewerName}`)
    .join('、')
}

export function getTechnicalReviewFeishuNotifyText(record: Partial<TechnicalDataVersionRecord>): string {
  const pending = getTechnicalReviewPendingReviewerInfos(record)
  if (pending.length === 0) return '无待通知审核人'
  return pending
    .map((item) => {
      const dailyText = item.todayFeishuNotifiedFlag ? '今日已提醒' : '今日未提醒'
      return `${item.role}：${item.lastFeishuNotifyStatus} / ${dailyText}`
    })
    .join('；')
}

export function getTechnicalReviewStatusText(record: Partial<TechnicalDataVersionRecord>): string {
  const snapshot = normalizeTechnicalReviewSnapshot(record)
  if (record.versionStatus === 'PUBLISHED') return '已发布正式版本'
  if (snapshot.reviewStage === '未提交审核') return '待提交审核'
  if (snapshot.reviewStage === '待发布') return '审核通过，待发布'
  if (snapshot.merchandiserReview.status === '审核-未通过' && snapshot.returnedFromMerchandiserFlag) {
    const pendingRoles = getTechnicalReviewPendingRoles(record)
    return pendingRoles.length > 0 ? `跟单已打回，待${pendingRoles.join('、')}复审` : '跟单已打回，待跟单复核'
  }
  if (snapshot.merchandiserReview.status === '审核中') return '跟单复核中'
  if (snapshot.reviewStage === '跟单复核') return '待跟单复核'
  if (snapshot.buyerReview.status === '审核-未通过' || snapshot.patternMakerReview.status === '审核-未通过') {
    return '审核未通过，待修改'
  }
  const pendingRoles = getTechnicalReviewPendingRoles(record)
  return pendingRoles.length > 0 ? `待${pendingRoles.join('、')}审核` : '第一阶段审核中'
}

function requireDraftRecord(technicalVersionId: string): TechnicalDataVersionRecord {
  const record = getTechnicalDataVersionById(technicalVersionId)
  if (!record) throw new Error('未找到技术包版本。')
  if (record.versionStatus !== 'DRAFT') throw new Error('只有草稿技术包版本允许审核。')
  return record
}

function saveReviewPatch(
  technicalVersionId: string,
  patch: Partial<TechnicalDataVersionRecord>,
): TechnicalDataVersionRecord {
  const nextRecord = updateTechnicalDataVersionRecord(technicalVersionId, patch)
  if (!nextRecord) throw new Error('保存技术包审核状态失败。')
  return nextRecord
}

function getReviewNodeFromSnapshot(
  snapshot: ReturnType<typeof normalizeTechnicalReviewSnapshot>,
  nodeKey: TechnicalReviewNodeKey,
): TechnicalReviewNode {
  if (nodeKey === 'BUYER') return snapshot.buyerReview
  if (nodeKey === 'PATTERN_MAKER') return snapshot.patternMakerReview
  return snapshot.merchandiserReview
}

function appendReviewLog(input: {
  record: TechnicalDataVersionRecord
  logType: TechPackVersionLogType
  changeText: string
  operatorName: string
  createdAt: string
  logKey?: string
}): void {
  appendTechPackVersionLog({
    logId: `tech_pack_review_${input.record.technicalVersionId}_${input.createdAt.replace(/[^0-9]/g, '')}_${Date.now()}_${++reviewLogSequence}_${input.logType}${input.logKey ? `_${input.logKey}` : ''}`,
    technicalVersionId: input.record.technicalVersionId,
    technicalVersionCode: input.record.technicalVersionCode,
    versionLabel: input.record.versionLabel,
    styleId: input.record.styleId,
    styleCode: input.record.styleCode,
    logType: input.logType,
    sourceTaskType: '',
    sourceTaskId: '',
    sourceTaskCode: '',
    sourceTaskName: '',
    changeScope: '',
    changeText: input.changeText,
    beforeVersionId: input.record.baseTechnicalVersionId || '',
    beforeVersionCode: input.record.baseTechnicalVersionCode || '',
    afterVersionId: input.record.technicalVersionId,
    afterVersionCode: input.record.technicalVersionCode,
    createdAt: input.createdAt,
    createdBy: input.operatorName,
  })
}

function sendReviewNotificationSafely(input: {
  technicalVersionId: string
  nodeKey: TechnicalReviewNodeKey
  notificationType: '提交审核' | '进入跟单复核' | '打回复审'
  createdBy: string
}): void {
  try {
    sendTechPackReviewFeishuNotification(input)
  } catch {
    // 原型环境下飞书提醒失败不阻断审核主流程，失败本身由通知账记录。
  }
}

function assertDesignRequirementSatisfied(technicalVersionId: string, prefix: string): void {
  const content = getTechnicalDataVersionContent(technicalVersionId)
  if (!content) throw new Error('未找到技术包内容，无法校验花型设计。')
  const validation = validateTechPackDesignRequirement({
    bomItems: content.bomItems,
    patternDesigns: content.patternDesigns,
  })
  const message = formatTechPackDesignRequirementBlockMessage(validation, prefix)
  if (message) throw new Error(message)
}

export function submitTechPackFirstStageReview(
  technicalVersionId: string,
  input: string | SubmitTechPackReviewInput = '当前用户',
): TechnicalDataVersionRecord {
  const record = requireDraftRecord(technicalVersionId)
  assertDesignRequirementSatisfied(technicalVersionId, '提交审核前请先补齐花型设计')
  const legacyMode = typeof input === 'string'
  const operator = normalizeOperator(legacyMode ? input : input.operator, legacyMode ? input : '当前用户')
  const buyerReviewer = resolveReviewerForNode(
    'BUYER',
    legacyMode ? getLegacyTechPackReviewer('买手').reviewerId : input.buyerReviewerId,
  )
  const patternReviewer = resolveReviewerForNode(
    'PATTERN_MAKER',
    legacyMode ? getLegacyTechPackReviewer('版师').reviewerId : input.patternMakerReviewerId,
  )
  const merchandiserReviewer = resolveReviewerForNode(
    'MERCHANDISER',
    legacyMode ? getLegacyTechPackReviewer('跟单').reviewerId : input.merchandiserReviewerId,
  )
  const submittedAt = nowText()
  const buyerReview = buildSubmittedReviewNode({
    record,
    nodeKey: 'BUYER',
    reviewer: buyerReviewer,
    submittedAt,
    operatorName: operator.name,
  })
  const patternMakerReview = buildSubmittedReviewNode({
    record,
    nodeKey: 'PATTERN_MAKER',
    reviewer: patternReviewer,
    submittedAt,
    operatorName: operator.name,
  })
  const merchandiserReview = withReviewDiffSnapshot(
    record,
    buildAssignedReviewNode('MERCHANDISER', '待审核', merchandiserReviewer, submittedAt, operator.name),
  )
  const firstStageComplete =
    isTechnicalReviewNodeComplete(buyerReview) && isTechnicalReviewNodeComplete(patternMakerReview)
  const nextRecord = saveReviewPatch(technicalVersionId, {
    reviewStage: firstStageComplete ? '跟单复核' : '第一阶段并行审核',
    buyerReview,
    patternMakerReview,
    merchandiserReview,
    reviewSubmittedAt: submittedAt,
    reviewSubmittedBy: operator.name,
    returnedFromMerchandiserFlag: false,
    reviewUnlockedModuleKeys: [],
    updatedAt: submittedAt,
    updatedBy: operator.name,
  })
  appendReviewLog({
    record: nextRecord,
    logType: '提交技术包审核',
    changeText: `已提交技术包版本 ${nextRecord.versionLabel}。买手审核：${buyerReview.status === '无需审核' ? '无需审核' : `待 ${buyerReviewer.reviewerName} 审核`}；版师审核：${patternMakerReview.status === '无需审核' ? '无需审核' : `待 ${patternReviewer.reviewerName} 审核`}；跟单审核人：${merchandiserReviewer.reviewerName}。`,
    operatorName: operator.name,
    createdAt: submittedAt,
  })
  ;([
    ['BUYER', buyerReview],
    ['PATTERN_MAKER', patternMakerReview],
  ] as const).forEach(([nodeKey, node]) => {
    if (node.status === '无需审核') return
    sendReviewNotificationSafely({
      technicalVersionId,
      nodeKey,
      notificationType: '提交审核',
      createdBy: operator.name,
    })
  })
  if (firstStageComplete) {
    sendReviewNotificationSafely({
      technicalVersionId,
      nodeKey: 'MERCHANDISER',
      notificationType: '进入跟单复核',
      createdBy: operator.name,
    })
  }
  return getTechnicalDataVersionById(technicalVersionId) || nextRecord
}

export function startTechPackReview(
  technicalVersionId: string,
  nodeKey: TechnicalReviewNodeKey,
  input: string | TechPackReviewActionInput = '当前用户',
): TechnicalDataVersionRecord {
  const record = requireDraftRecord(technicalVersionId)
  const legacyMode = typeof input === 'string'
  const operator = normalizeOperator(legacyMode ? input : input.operator, legacyMode ? input : '当前用户')
  const startedOpinion = legacyMode ? '开始审核。' : assertOpinionRequired(input.opinion || '', '开始审核')
  const snapshot = normalizeTechnicalReviewSnapshot(record)
  if (snapshot.reviewStage === '未提交审核') throw new Error('请先提交技术包审核。')
  const currentNode = getReviewNodeFromSnapshot(snapshot, nodeKey)
  assertAssignedReviewer(currentNode, operator)
  if (currentNode.status === '审核中') throw new Error('当前审核节点已在审核中。')
  if (currentNode.status === '无需审核') throw new Error(`${currentNode.nodeName}无需审核，不能开始审核。`)
  if (currentNode.status === '审核-已通过') throw new Error('当前审核节点已通过，不能重复开始审核。')
  if (nodeKey === 'MERCHANDISER') {
    if (
      !isTechnicalReviewNodeComplete(snapshot.buyerReview) ||
      !isTechnicalReviewNodeComplete(snapshot.patternMakerReview)
    ) {
      throw new Error('买手和版师审核都通过后，才能进入跟单复核。')
    }
  }

  const node = withReviewDiffSnapshot(
    record,
    normalizeTechnicalReviewNode(nodeKey, {
      ...currentNode,
      status: '审核中',
      reviewedBy: operator.name,
      reviewedAt: nowText(),
      startedOpinion,
    }),
  )
  const nextRecord = saveReviewPatch(technicalVersionId, {
    ...(nodeKey === 'BUYER'
      ? { buyerReview: node }
      : nodeKey === 'PATTERN_MAKER'
      ? { patternMakerReview: node }
      : { merchandiserReview: node, reviewStage: '跟单复核' as const }),
    updatedAt: node.reviewedAt,
    updatedBy: operator.name,
  })
  appendReviewLog({
    record: nextRecord,
    logType: '开始技术包审核',
    changeText: `${operator.name} 开始${node.nodeName}，审核范围：${REVIEW_SCOPE_TEXT[nodeKey]}。意见：${startedOpinion}`,
    operatorName: operator.name,
    createdAt: node.reviewedAt,
    logKey: nodeKey,
  })
  return nextRecord
}

export function approveTechPackReview(
  technicalVersionId: string,
  nodeKey: TechnicalReviewNodeKey,
  opinion = '',
  operatorInput: string | TechPackReviewOperator = '当前用户',
): TechnicalDataVersionRecord {
  const record = requireDraftRecord(technicalVersionId)
  const operator = normalizeOperator(operatorInput)
  const reviewOpinion = assertOpinionRequired(opinion || '', '审核')
  const snapshot = normalizeTechnicalReviewSnapshot(record)
  const currentNode = getReviewNodeFromSnapshot(snapshot, nodeKey)
  assertAssignedReviewer(currentNode, operator)
  if (currentNode.status !== '审核中') throw new Error('当前审核节点需先进入审核中。')
  if (
    nodeKey === 'MERCHANDISER' &&
    (!isTechnicalReviewNodeComplete(snapshot.buyerReview) || !isTechnicalReviewNodeComplete(snapshot.patternMakerReview))
  ) {
    throw new Error('买手和版师审核都通过后，才能进入跟单复核。')
  }
  if (nodeKey === 'MERCHANDISER') {
    assertDesignRequirementSatisfied(technicalVersionId, '跟单无法审核通过')
  }
  const reviewedAt = nowText()
  const node = withReviewDiffSnapshot(
    record,
    normalizeTechnicalReviewNode(nodeKey, {
      ...currentNode,
      status: '审核-已通过',
      reviewedBy: operator.name,
      reviewedAt,
      opinion: reviewOpinion,
    }),
  )
  const nextBuyer = nodeKey === 'BUYER' ? node : snapshot.buyerReview
  const nextPattern = nodeKey === 'PATTERN_MAKER' ? node : snapshot.patternMakerReview
  const firstStagePassed =
    isTechnicalReviewNodeComplete(nextBuyer) && isTechnicalReviewNodeComplete(nextPattern)

  const nextRecord = saveReviewPatch(technicalVersionId, {
    ...(nodeKey === 'BUYER'
      ? { buyerReview: node }
      : nodeKey === 'PATTERN_MAKER'
      ? { patternMakerReview: node }
      : { merchandiserReview: node }),
    ...(nodeKey === 'MERCHANDISER'
      ? { reviewStage: '待发布' as const, returnedFromMerchandiserFlag: false, reviewUnlockedModuleKeys: [] }
      : firstStagePassed
      ? {
          reviewStage: '跟单复核' as const,
          merchandiserReview: normalizeTechnicalReviewNode('MERCHANDISER', {
            ...snapshot.merchandiserReview,
            status: '待审核',
            reviewedBy: '',
            reviewedAt: '',
            startedOpinion: '',
            opinion: '',
          }),
        }
      : { reviewStage: '第一阶段并行审核' as const }),
    updatedAt: reviewedAt,
    updatedBy: operator.name,
  })
  appendReviewLog({
    record: nextRecord,
    logType: '技术包审核通过',
    changeText: `${node.nodeName}通过，审核范围：${REVIEW_SCOPE_TEXT[nodeKey]}。意见：${reviewOpinion}`,
    operatorName: operator.name,
    createdAt: reviewedAt,
    logKey: nodeKey,
  })
  if (nodeKey !== 'MERCHANDISER' && firstStagePassed) {
    sendReviewNotificationSafely({
      technicalVersionId,
      nodeKey: 'MERCHANDISER',
      notificationType: '进入跟单复核',
      createdBy: operator.name,
    })
  }
  return getTechnicalDataVersionById(technicalVersionId) || nextRecord
}

export function rejectTechPackReview(
  technicalVersionId: string,
  nodeKey: TechnicalReviewNodeKey,
  opinion = '',
  operatorInput: string | TechPackReviewOperator = '当前用户',
): TechnicalDataVersionRecord {
  const record = requireDraftRecord(technicalVersionId)
  const operator = normalizeOperator(operatorInput)
  const reviewOpinion = assertOpinionRequired(opinion || '', '审核')
  const snapshot = normalizeTechnicalReviewSnapshot(record)
  const currentNode = getReviewNodeFromSnapshot(snapshot, nodeKey)
  assertAssignedReviewer(currentNode, operator)
  if (currentNode.status !== '审核中') throw new Error('当前审核节点需先进入审核中。')
  const reviewedAt = nowText()
  const node = withReviewDiffSnapshot(
    record,
    normalizeTechnicalReviewNode(nodeKey, {
      ...currentNode,
      status: '审核-未通过',
      reviewedBy: operator.name,
      reviewedAt,
      opinion: reviewOpinion,
    }),
  )
  const nextRecord = saveReviewPatch(technicalVersionId, {
    ...(nodeKey === 'BUYER'
      ? { buyerReview: node, reviewStage: '第一阶段并行审核' as const }
      : nodeKey === 'PATTERN_MAKER'
      ? { patternMakerReview: node, reviewStage: '第一阶段并行审核' as const }
      : { merchandiserReview: node, reviewStage: '跟单复核' as const }),
    updatedAt: reviewedAt,
    updatedBy: operator.name,
  })
  appendReviewLog({
    record: nextRecord,
    logType: '技术包审核不通过',
    changeText: `${node.nodeName}不通过，审核范围：${REVIEW_SCOPE_TEXT[nodeKey]}。意见：${reviewOpinion}`,
    operatorName: operator.name,
    createdAt: reviewedAt,
    logKey: nodeKey,
  })
  return nextRecord
}

export function returnTechPackReviewToFirstStage(
  technicalVersionId: string,
  opinion = '',
  operatorInput: string | TechPackReviewOperator = '当前用户',
): TechnicalDataVersionRecord {
  return returnTechPackReviewByModules(
    technicalVersionId,
    TECH_PACK_REVIEW_REWORK_MODULES,
    opinion,
    operatorInput,
  )
}

function resetReviewNodeForRework(input: {
  record: TechnicalDataVersionRecord
  nodeKey: TechnicalReviewNodeKey
  currentNode: TechnicalReviewNode
  returnedAt: string
  operatorName: string
}): TechnicalReviewNode {
  return withReviewDiffSnapshot(
    input.record,
    normalizeTechnicalReviewNode(input.nodeKey, {
      ...input.currentNode,
      status: '待审核',
      assignedAt: input.currentNode.assignedAt || input.returnedAt,
      assignedBy: input.currentNode.assignedBy || input.operatorName,
      reviewedBy: '',
      reviewedAt: '',
      startedOpinion: '',
      opinion: '',
    }),
  )
}

function resetMerchandiserForRework(input: {
  record: TechnicalDataVersionRecord
  currentNode: TechnicalReviewNode
  returnedAt: string
  operatorName: string
  opinion: string
}): TechnicalReviewNode {
  return withReviewDiffSnapshot(
    input.record,
    normalizeTechnicalReviewNode('MERCHANDISER', {
      ...input.currentNode,
      status: '审核-未通过',
      reviewedBy: input.operatorName,
      reviewedAt: input.returnedAt,
      startedOpinion: '',
      opinion: input.opinion,
    }),
  )
}

function buildReworkReviewPatch(input: {
  record: TechnicalDataVersionRecord
  snapshot: ReturnType<typeof normalizeTechnicalReviewSnapshot>
  targetNodeKeys: TechnicalReviewNodeKey[]
  unlockedModuleKeys: TechnicalModuleKey[]
  returnedAt: string
  operatorName: string
  opinion: string
}): Partial<TechnicalDataVersionRecord> {
  const targets = new Set(input.targetNodeKeys)
  const hasFirstStageRework = targets.has('BUYER') || targets.has('PATTERN_MAKER')
  return {
    reviewStage: hasFirstStageRework ? '第一阶段并行审核' : '跟单复核',
    buyerReview: targets.has('BUYER')
      ? resetReviewNodeForRework({
          record: input.record,
          nodeKey: 'BUYER',
          currentNode: input.snapshot.buyerReview,
          returnedAt: input.returnedAt,
          operatorName: input.operatorName,
        })
      : input.snapshot.buyerReview,
    patternMakerReview: targets.has('PATTERN_MAKER')
      ? resetReviewNodeForRework({
          record: input.record,
          nodeKey: 'PATTERN_MAKER',
          currentNode: input.snapshot.patternMakerReview,
          returnedAt: input.returnedAt,
          operatorName: input.operatorName,
        })
      : input.snapshot.patternMakerReview,
    merchandiserReview: resetMerchandiserForRework({
      record: input.record,
      currentNode: input.snapshot.merchandiserReview,
      returnedAt: input.returnedAt,
      operatorName: input.operatorName,
      opinion: input.opinion,
    }),
    returnedFromMerchandiserFlag: true,
    reviewUnlockedModuleKeys: input.unlockedModuleKeys,
    updatedAt: input.returnedAt,
    updatedBy: input.operatorName,
  }
}

function sendReworkNotifications(input: {
  technicalVersionId: string
  targetNodeKeys: TechnicalReviewNodeKey[]
  createdBy: string
}): void {
  const targets = new Set(input.targetNodeKeys)
  const firstStageTargets = (['BUYER', 'PATTERN_MAKER'] as TechnicalReviewNodeKey[]).filter((nodeKey) =>
    targets.has(nodeKey),
  )
  const notifyTargets = firstStageTargets.length > 0 ? firstStageTargets : (['MERCHANDISER'] as TechnicalReviewNodeKey[])
  notifyTargets.forEach((nodeKey) => {
    sendReviewNotificationSafely({
      technicalVersionId: input.technicalVersionId,
      nodeKey,
      notificationType: '打回复审',
      createdBy: input.createdBy,
    })
  })
}

export function returnTechPackReviewByModules(
  technicalVersionId: string,
  moduleKeys: TechnicalModuleKey[],
  opinion = '',
  operatorInput: string | TechPackReviewOperator = '当前用户',
): TechnicalDataVersionRecord {
  const record = requireDraftRecord(technicalVersionId)
  const operator = normalizeOperator(operatorInput)
  const reviewOpinion = assertOpinionRequired(opinion || '', '打回')
  const snapshot = normalizeTechnicalReviewSnapshot(record)
  if (snapshot.reviewStage !== '跟单复核') throw new Error('只有跟单复核阶段可以按模块打回复审。')
  assertAssignedReviewer(snapshot.merchandiserReview, operator)
  const unlockedModuleKeys = normalizeModuleKeys(moduleKeys)
  if (unlockedModuleKeys.length === 0) throw new Error('请选择需要重审的模块。')
  const returnedAt = nowText()
  const targetNodeKeys = normalizeNodeKeys([
    ...resolveReviewNodeKeysByModules(unlockedModuleKeys),
    'MERCHANDISER',
  ])
  const nextRecord = saveReviewPatch(technicalVersionId, {
    ...buildReworkReviewPatch({
      record,
      snapshot,
      targetNodeKeys,
      unlockedModuleKeys,
      returnedAt,
      operatorName: operator.name,
      opinion: reviewOpinion,
    }),
  })
  appendReviewLog({
    record: nextRecord,
    logType: '跟单打回第一阶段',
    changeText: `跟单复核打回${formatNodeRoles(targetNodeKeys)}重新审核，重审模块：${formatModuleLabels(unlockedModuleKeys)}。原因：${reviewOpinion}`,
    operatorName: operator.name,
    createdAt: returnedAt,
  })
  sendReworkNotifications({
    technicalVersionId,
    createdBy: operator.name,
    targetNodeKeys,
  })
  return getTechnicalDataVersionById(technicalVersionId) || nextRecord
}

export function reopenTechPackReviewForRoles(
  technicalVersionId: string,
  nodeKeys: TechnicalReviewNodeKey[],
  opinion = '',
  operatorInput: string | TechPackReviewOperator = '当前用户',
): TechnicalDataVersionRecord {
  const record = requireDraftRecord(technicalVersionId)
  const operator = normalizeOperator(operatorInput)
  const reviewOpinion = assertOpinionRequired(opinion || '', '重审')
  const snapshot = normalizeTechnicalReviewSnapshot(record)
  if (snapshot.reviewStage !== '待发布') throw new Error('只有审核通过、待发布状态可以发起待发布重审。')

  const requestedNodeKeys = normalizeNodeKeys(nodeKeys)
  if (requestedNodeKeys.length === 0) throw new Error('请选择需要重审的角色。')

  const hasFirstStageRework = requestedNodeKeys.includes('BUYER') || requestedNodeKeys.includes('PATTERN_MAKER')
  const targetNodeKeys = normalizeNodeKeys([
    ...requestedNodeKeys,
    ...(hasFirstStageRework ? (['MERCHANDISER'] as TechnicalReviewNodeKey[]) : []),
  ])
  const unlockedModuleKeys = normalizeModuleKeys(
    requestedNodeKeys.flatMap((nodeKey) => TECH_PACK_REVIEW_MODULES[nodeKey] ?? []),
  )
  const returnedAt = nowText()
  const nextRecord = saveReviewPatch(technicalVersionId, {
    ...buildReworkReviewPatch({
      record,
      snapshot,
      targetNodeKeys,
      unlockedModuleKeys,
      returnedAt,
      operatorName: operator.name,
      opinion: reviewOpinion,
    }),
  })
  appendReviewLog({
    record: nextRecord,
    logType: '跟单打回第一阶段',
    changeText: `待发布技术包发起${formatNodeRoles(requestedNodeKeys)}重审，需复核角色：${formatNodeRoles(targetNodeKeys)}，开放模块：${formatModuleLabels(unlockedModuleKeys)}。原因：${reviewOpinion}`,
    operatorName: operator.name,
    createdAt: returnedAt,
  })
  sendReworkNotifications({
    technicalVersionId,
    createdBy: operator.name,
    targetNodeKeys,
  })
  return getTechnicalDataVersionById(technicalVersionId) || nextRecord
}
