import {
  getTechnicalDataVersionById,
  updateTechnicalDataVersionRecord,
} from './pcs-technical-data-version-repository.ts'
import type {
  TechnicalDataVersionRecord,
  TechnicalModuleKey,
  TechnicalReviewNode,
  TechnicalReviewNodeKey,
  TechnicalReviewNodeStatus,
  TechnicalReviewRole,
  TechnicalReviewStage,
} from './pcs-technical-data-version-types.ts'

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
  PATTERN_MAKER: ['PATTERN', 'COLOR_MATERIAL_MAPPING'],
  MERCHANDISER: ['PROCESS', 'SIZE', 'DESIGN', 'ATTACHMENT', 'QUALITY'],
}

const MODULE_OWNER: Partial<Record<TechnicalModuleKey, TechnicalReviewNodeKey>> = {
  BOM: 'BUYER',
  COST: 'BUYER',
  PATTERN: 'PATTERN_MAKER',
  COLOR_MATERIAL_MAPPING: 'PATTERN_MAKER',
  PROCESS: 'MERCHANDISER',
  SIZE: 'MERCHANDISER',
  DESIGN: 'MERCHANDISER',
  ATTACHMENT: 'MERCHANDISER',
  QUALITY: 'MERCHANDISER',
}

function nowText(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
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
    reviewedBy: '',
    reviewedAt: '',
    opinion: '',
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
    reviewedBy: node?.reviewedBy || '',
    reviewedAt: node?.reviewedAt || '',
    opinion: node?.opinion || '',
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
  if (input.reviewStage === '已发布') return '已发布'
  if (input.merchandiserReview.status === '审核-已通过') return '待发布'
  if (
    input.buyerReview.status === '审核-已通过' &&
    input.patternMakerReview.status === '审核-已通过'
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
  return status === '审核中' || status === '审核-已通过'
}

export function getTechnicalModuleReviewOwner(moduleKey: TechnicalModuleKey): TechnicalReviewNodeKey {
  return MODULE_OWNER[moduleKey] || 'MERCHANDISER'
}

export function canEditTechnicalModule(
  record: Partial<TechnicalDataVersionRecord>,
  moduleKey: TechnicalModuleKey,
): boolean {
  if (record.versionStatus !== 'DRAFT') return false
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
  if (snapshot.reviewStage === '未提交审核') return []
  if (snapshot.reviewStage === '待发布') return []
  if (snapshot.reviewStage === '跟单复核') {
    return snapshot.merchandiserReview.status === '审核-已通过' ? [] : ['跟单']
  }
  const roles: TechnicalReviewRole[] = []
  if (snapshot.buyerReview.status !== '审核-已通过') roles.push('买手')
  if (snapshot.patternMakerReview.status !== '审核-已通过') roles.push('版师')
  return roles
}

export function getTechnicalReviewStatusText(record: Partial<TechnicalDataVersionRecord>): string {
  const snapshot = normalizeTechnicalReviewSnapshot(record)
  if (record.versionStatus === 'PUBLISHED') return '已发布正式版本'
  if (snapshot.reviewStage === '未提交审核') return '待提交审核'
  if (snapshot.reviewStage === '待发布') return '审核通过，待发布'
  if (snapshot.merchandiserReview.status === '审核-未通过' && snapshot.returnedFromMerchandiserFlag) {
    return '跟单已打回，待买手、版师复审'
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

export function submitTechPackFirstStageReview(
  technicalVersionId: string,
  operatorName = '当前用户',
): TechnicalDataVersionRecord {
  requireDraftRecord(technicalVersionId)
  const submittedAt = nowText()
  return saveReviewPatch(technicalVersionId, {
    reviewStage: '第一阶段并行审核',
    buyerReview: createReviewNode('BUYER', '待审核'),
    patternMakerReview: createReviewNode('PATTERN_MAKER', '待审核'),
    merchandiserReview: createReviewNode('MERCHANDISER', '待审核'),
    reviewSubmittedAt: submittedAt,
    reviewSubmittedBy: operatorName,
    returnedFromMerchandiserFlag: false,
    updatedAt: submittedAt,
    updatedBy: operatorName,
  })
}

export function startTechPackReview(
  technicalVersionId: string,
  nodeKey: TechnicalReviewNodeKey,
  operatorName = '当前用户',
): TechnicalDataVersionRecord {
  const record = requireDraftRecord(technicalVersionId)
  const snapshot = normalizeTechnicalReviewSnapshot(record)
  if (nodeKey === 'MERCHANDISER') {
    if (
      snapshot.buyerReview.status !== '审核-已通过' ||
      snapshot.patternMakerReview.status !== '审核-已通过'
    ) {
      throw new Error('买手和版师审核都通过后，才能进入跟单复核。')
    }
  }

  const node = normalizeTechnicalReviewNode(nodeKey, {
    ...(nodeKey === 'BUYER'
      ? snapshot.buyerReview
      : nodeKey === 'PATTERN_MAKER'
      ? snapshot.patternMakerReview
      : snapshot.merchandiserReview),
    status: '审核中',
    reviewedBy: operatorName,
    reviewedAt: nowText(),
  })
  return saveReviewPatch(technicalVersionId, {
    ...(nodeKey === 'BUYER'
      ? { buyerReview: node }
      : nodeKey === 'PATTERN_MAKER'
      ? { patternMakerReview: node }
      : { merchandiserReview: node, reviewStage: '跟单复核' as const }),
    updatedAt: node.reviewedAt,
    updatedBy: operatorName,
  })
}

export function approveTechPackReview(
  technicalVersionId: string,
  nodeKey: TechnicalReviewNodeKey,
  opinion = '',
  operatorName = '当前用户',
): TechnicalDataVersionRecord {
  const record = requireDraftRecord(technicalVersionId)
  const snapshot = normalizeTechnicalReviewSnapshot(record)
  const reviewedAt = nowText()
  const node = normalizeTechnicalReviewNode(nodeKey, {
    ...(nodeKey === 'BUYER'
      ? snapshot.buyerReview
      : nodeKey === 'PATTERN_MAKER'
      ? snapshot.patternMakerReview
      : snapshot.merchandiserReview),
    status: '审核-已通过',
    reviewedBy: operatorName,
    reviewedAt,
    opinion,
  })
  const nextBuyer = nodeKey === 'BUYER' ? node : snapshot.buyerReview
  const nextPattern = nodeKey === 'PATTERN_MAKER' ? node : snapshot.patternMakerReview
  const firstStagePassed =
    nextBuyer.status === '审核-已通过' && nextPattern.status === '审核-已通过'

  return saveReviewPatch(technicalVersionId, {
    ...(nodeKey === 'BUYER'
      ? { buyerReview: node }
      : nodeKey === 'PATTERN_MAKER'
      ? { patternMakerReview: node }
      : { merchandiserReview: node }),
    ...(nodeKey === 'MERCHANDISER'
      ? { reviewStage: '待发布' as const, returnedFromMerchandiserFlag: false }
      : firstStagePassed
      ? { reviewStage: '跟单复核' as const, merchandiserReview: createReviewNode('MERCHANDISER', '待审核') }
      : { reviewStage: '第一阶段并行审核' as const }),
    updatedAt: reviewedAt,
    updatedBy: operatorName,
  })
}

export function rejectTechPackReview(
  technicalVersionId: string,
  nodeKey: TechnicalReviewNodeKey,
  opinion = '',
  operatorName = '当前用户',
): TechnicalDataVersionRecord {
  const record = requireDraftRecord(technicalVersionId)
  const snapshot = normalizeTechnicalReviewSnapshot(record)
  const reviewedAt = nowText()
  const node = normalizeTechnicalReviewNode(nodeKey, {
    ...(nodeKey === 'BUYER'
      ? snapshot.buyerReview
      : nodeKey === 'PATTERN_MAKER'
      ? snapshot.patternMakerReview
      : snapshot.merchandiserReview),
    status: '审核-未通过',
    reviewedBy: operatorName,
    reviewedAt,
    opinion,
  })
  return saveReviewPatch(technicalVersionId, {
    ...(nodeKey === 'BUYER'
      ? { buyerReview: node, reviewStage: '第一阶段并行审核' as const }
      : nodeKey === 'PATTERN_MAKER'
      ? { patternMakerReview: node, reviewStage: '第一阶段并行审核' as const }
      : { merchandiserReview: node, reviewStage: '跟单复核' as const }),
    updatedAt: reviewedAt,
    updatedBy: operatorName,
  })
}

export function returnTechPackReviewToFirstStage(
  technicalVersionId: string,
  opinion = '',
  operatorName = '当前用户',
): TechnicalDataVersionRecord {
  requireDraftRecord(technicalVersionId)
  const returnedAt = nowText()
  return saveReviewPatch(technicalVersionId, {
    reviewStage: '第一阶段并行审核',
    buyerReview: createReviewNode('BUYER', '待审核'),
    patternMakerReview: createReviewNode('PATTERN_MAKER', '待审核'),
    merchandiserReview: normalizeTechnicalReviewNode('MERCHANDISER', {
      status: '审核-未通过',
      reviewedBy: operatorName,
      reviewedAt: returnedAt,
      opinion,
    }),
    returnedFromMerchandiserFlag: true,
    updatedAt: returnedAt,
    updatedBy: operatorName,
  })
}
