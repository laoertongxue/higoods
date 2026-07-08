import { createTechnicalDataVersionBootstrapSnapshot } from './pcs-technical-data-version-bootstrap.ts'
import { getStyleArchiveById } from './pcs-style-archive-repository.ts'
import {
  hasTechPackPrintRequirement,
  validateTechPackDesignRequirement,
} from './pcs-tech-pack-design-requirement.ts'
import { normalizeProcessRouteEntries } from './tech-pack-process-route.ts'
import type {
  TechPackSourceTaskType,
  TechPackVersionChangeScope,
  TechnicalAttachment,
  TechnicalBomItem,
  TechnicalColorMaterialMapping,
  TechnicalDataVersionContent,
  TechnicalDataVersionPendingItem,
  TechnicalDataVersionRecord,
  TechnicalDataVersionStoreSnapshot,
  TechnicalDomainStatus,
  TechnicalGarmentDifficultyGrade,
  TechnicalModuleKey,
  TechnicalReviewNode,
  TechnicalReviewNodeKey,
  TechnicalReviewNodeStatus,
  TechnicalReviewRole,
  TechnicalReviewStage,
  TechnicalPatternDesign,
  TechnicalPatternFile,
  TechnicalProcessEntry,
  TechnicalQualityRule,
  TechnicalSizeRow,
  TechnicalVersionStatus,
} from './pcs-technical-data-version-types.ts'

const TECHNICAL_VERSION_STORAGE_KEY = 'higood-pcs-technical-data-version-store-v4'
const TECHNICAL_VERSION_STORE_VERSION = 4

let memorySnapshot: TechnicalDataVersionStoreSnapshot | null = null

const CORE_MISSING_NAME_MAP: Record<string, string> = {
  BOM: '物料清单',
  PATTERN: '纸样管理',
  PROCESS: '工序工艺',
  GRADING: '放码规则',
  DESIGN: '花型设计',
  COLOR_MATERIAL: '款色用料对应',
}

function canUseStorage(): boolean {
  return (
    typeof localStorage !== 'undefined' &&
    typeof localStorage.getItem === 'function' &&
    typeof localStorage.setItem === 'function' &&
    typeof localStorage.removeItem === 'function'
  )
}

function clonePatternFiles(items: TechnicalPatternFile[]): TechnicalPatternFile[] {
  return items.map((item) => ({
    ...item,
    patternTotalPieceQty: item.patternTotalPieceQty,
    pieceInstanceTotal: item.pieceInstanceTotal,
    specialCraftConfiguredPieceTotal: item.specialCraftConfiguredPieceTotal,
    specialCraftUnconfiguredPieceTotal: item.specialCraftUnconfiguredPieceTotal,
    pieceRows: item.pieceRows?.map((row) => ({
      ...row,
      parsedQuantity: row.parsedQuantity,
      totalPieceQty: row.totalPieceQty,
      applicableSkuCodes: [...(row.applicableSkuCodes ?? [])],
      colorAllocations: row.colorAllocations?.map((allocation) => ({
        ...allocation,
        skuCodes: [...(allocation.skuCodes ?? [])],
      })),
      colorPieceQuantities: row.colorPieceQuantities?.map((quantity) => ({ ...quantity })),
      specialCrafts: row.specialCrafts?.map((craft) => ({
        ...craft,
        supportedTargetObjects: [...(craft.supportedTargetObjects ?? [])],
        supportedTargetObjectLabels: [...(craft.supportedTargetObjectLabels ?? [])],
      })),
    })),
    pieceInstances: item.pieceInstances?.map((instance) => ({
      ...instance,
      specialCraftAssignments: instance.specialCraftAssignments.map((assignment) => ({ ...assignment })),
    })),
  }))
}

function cloneProcessEntries(items: TechnicalProcessEntry[]): TechnicalProcessEntry[] {
  return items.map((item) => ({
    ...item,
    detailSplitDimensions: [...(item.detailSplitDimensions ?? [])],
    supportedTargetObjects: [...(item.supportedTargetObjects ?? [])],
    supportedTargetObjectLabels: [...(item.supportedTargetObjectLabels ?? [])],
    linkedBomItemIds: [...(item.linkedBomItemIds ?? [])],
    linkedPatternIds: [...(item.linkedPatternIds ?? [])],
    visibleFactoryTypes: [...(item.visibleFactoryTypes ?? [])],
  }))
}

function inferRouteSourceKind(item: TechnicalProcessEntry): NonNullable<TechnicalProcessEntry['routeSourceKind']> {
  if (item.routeSourceKind) return item.routeSourceKind
  if (item.sourceType === 'BOM') return 'BOM_REQUIREMENT'
  if (item.isSpecialCraft) return 'PIECE_CRAFT'
  if ((item.linkedPatternIds ?? []).length > 0) return 'PATTERN_PACKAGE'
  if (item.sourceType === 'MANUAL') return 'MANUAL'
  return 'DICT_DEFAULT'
}

function normalizeProcessEntries(items: TechnicalProcessEntry[]): TechnicalProcessEntry[] {
  return normalizeProcessRouteEntries(cloneProcessEntries(items).map((item) => ({
    ...item,
    routeSourceKind: inferRouteSourceKind(item),
    routeParallelAcceptanceMode: item.routeParallelAcceptanceMode ?? 'INDEPENDENT_ONLY',
  })))
}

function cloneSizeTable(items: TechnicalSizeRow[]): TechnicalSizeRow[] {
  return items.map((item) => ({ ...item }))
}

function cloneBomItems(items: TechnicalBomItem[]): TechnicalBomItem[] {
  return items.map((item) => ({
    ...item,
    applicableSkuCodes: [...(item.applicableSkuCodes ?? [])],
    linkedPatternIds: [...(item.linkedPatternIds ?? [])],
    usageProcessCodes: [...(item.usageProcessCodes ?? [])],
  }))
}

function cloneQualityRules(items: TechnicalQualityRule[]): TechnicalQualityRule[] {
  return items.map((item) => ({ ...item }))
}

function cloneColorMappings(items: TechnicalColorMaterialMapping[]): TechnicalColorMaterialMapping[] {
  return items.map((item) => ({
    ...item,
    lines: item.lines.map((line) => ({
      ...line,
      applicableSkuCodes: [...(line.applicableSkuCodes ?? [])],
    })),
  }))
}

function clonePatternDesigns(items: TechnicalPatternDesign[]): TechnicalPatternDesign[] {
  return items.map((item) => ({ ...item }))
}

function cloneAttachments(items: TechnicalAttachment[]): TechnicalAttachment[] {
  return items.map((item) => ({ ...item }))
}

function cloneRecord(record: TechnicalDataVersionRecord): TechnicalDataVersionRecord {
  return {
    ...record,
    linkedRevisionTaskIds: [...(record.linkedRevisionTaskIds ?? [])],
    linkedPatternTaskIds: [...(record.linkedPatternTaskIds ?? [])],
    linkedArtworkTaskIds: [...(record.linkedArtworkTaskIds ?? [])],
    linkedPartTemplateIds: [...(record.linkedPartTemplateIds ?? [])],
    linkedPatternLibraryVersionIds: [...(record.linkedPatternLibraryVersionIds ?? [])],
    linkedPatternAssetIds: [...(record.linkedPatternAssetIds ?? [])],
    linkedPatternAssetCodes: [...(record.linkedPatternAssetCodes ?? [])],
    missingItemCodes: [...(record.missingItemCodes ?? [])],
    missingItemNames: [...(record.missingItemNames ?? [])],
    buyerReview: record.buyerReview ? { ...record.buyerReview } : undefined,
    patternMakerReview: record.patternMakerReview ? { ...record.patternMakerReview } : undefined,
    merchandiserReview: record.merchandiserReview ? { ...record.merchandiserReview } : undefined,
  }
}

function cloneContent(content: TechnicalDataVersionContent): TechnicalDataVersionContent {
  return {
    technicalVersionId: content.technicalVersionId,
    patternFiles: clonePatternFiles(content.patternFiles),
    patternDesc: content.patternDesc,
    processEntries: cloneProcessEntries(content.processEntries),
    processRouteStatus: content.processRouteStatus,
    processRouteConfirmedBy: content.processRouteConfirmedBy,
    processRouteConfirmedAt: content.processRouteConfirmedAt,
    processRouteUpdatedBy: content.processRouteUpdatedBy,
    processRouteUpdatedAt: content.processRouteUpdatedAt,
    processRouteChangeReason: content.processRouteChangeReason,
    sizeTable: cloneSizeTable(content.sizeTable),
    bomItems: cloneBomItems(content.bomItems),
    qualityRules: cloneQualityRules(content.qualityRules),
    colorMaterialMappings: cloneColorMappings(content.colorMaterialMappings),
    patternDesigns: clonePatternDesigns(content.patternDesigns),
    attachments: cloneAttachments(content.attachments),
    legacyCompatibleCostPayload: { ...content.legacyCompatibleCostPayload },
  }
}

function clonePendingItem(item: TechnicalDataVersionPendingItem): TechnicalDataVersionPendingItem {
  return { ...item }
}

function cloneSnapshot(snapshot: TechnicalDataVersionStoreSnapshot): TechnicalDataVersionStoreSnapshot {
  return {
    version: snapshot.version,
    records: snapshot.records.map(cloneRecord),
    contents: snapshot.contents.map(cloneContent),
    pendingItems: snapshot.pendingItems.map(clonePendingItem),
  }
}

function seedSnapshot(): TechnicalDataVersionStoreSnapshot {
  return hydrateSnapshot(createTechnicalDataVersionBootstrapSnapshot(TECHNICAL_VERSION_STORE_VERSION))
}

function nowText(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

function buildDateKey(dateText: string): string {
  return dateText.slice(0, 10).replace(/-/g, '')
}

function normalizeVersionStatus(value: string | null | undefined): TechnicalVersionStatus {
  if (value === 'PUBLISHED' || value === 'ARCHIVED') return value
  return 'DRAFT'
}

function normalizeDomainStatus(value: string | null | undefined): TechnicalDomainStatus {
  if (value === 'DRAFT' || value === 'COMPLETE') return value
  return 'EMPTY'
}

function normalizeSourceTaskType(
  value: string | null | undefined,
  record?: Pick<TechnicalDataVersionRecord, 'linkedRevisionTaskIds' | 'linkedPatternTaskIds' | 'linkedArtworkTaskIds'>,
): TechPackSourceTaskType {
  if (value === 'REVISION' || value === 'PLATE' || value === 'ARTWORK' || value === 'MANUAL') return value
  if ((record?.linkedRevisionTaskIds?.length ?? 0) > 0) return 'REVISION'
  if ((record?.linkedPatternTaskIds?.length ?? 0) > 0) return 'PLATE'
  if ((record?.linkedArtworkTaskIds?.length ?? 0) > 0) return 'ARTWORK'
  return 'REVISION'
}

function normalizeChangeScope(value: string | null | undefined): TechPackVersionChangeScope {
  if (value === '制版生成' || value === '花型写入' || value === '花型替换' || value === '改版生成' || value === '手动新增') {
    return value
  }
  return '改版生成'
}

function normalizeGarmentDifficultyGrade(value: unknown): TechnicalGarmentDifficultyGrade {
  return value === 'A' || value === 'A+' || value === 'A++' || value === 'B' || value === 'C' || value === 'D'
    ? value
    : 'B'
}

function normalizeTechnicalModuleKeys(value: unknown): TechnicalModuleKey[] {
  if (!Array.isArray(value)) return []
  const validKeys = new Set<TechnicalModuleKey>([
    'BOM',
    'COST',
    'PATTERN',
    'MATERIAL_PATTERN_LINK',
    'COLOR_MATERIAL_MAPPING',
    'PROCESS',
    'SIZE',
    'DESIGN',
    'ATTACHMENT',
    'QUALITY',
  ])
  return [...new Set(value.filter((item): item is TechnicalModuleKey => validKeys.has(item as TechnicalModuleKey)))]
}

const REVIEW_NODE_META: Record<
  TechnicalReviewNodeKey,
  { nodeName: TechnicalReviewNode['nodeName']; reviewerRole: TechnicalReviewRole }
> = {
  BUYER: { nodeName: '买手审核', reviewerRole: '买手' },
  PATTERN_MAKER: { nodeName: '版师审核', reviewerRole: '版师' },
  MERCHANDISER: { nodeName: '跟单审核', reviewerRole: '跟单' },
}

function normalizeReviewNodeStatus(value: string | null | undefined): TechnicalReviewNodeStatus {
  if (value === '无需审核' || value === '审核中' || value === '审核-未通过' || value === '审核-已通过') return value
  return '待审核'
}

function isFirstStageReviewComplete(node: Pick<TechnicalReviewNode, 'status'>): boolean {
  return node.status === '审核-已通过' || node.status === '无需审核'
}

function normalizeReviewNode(
  nodeKey: TechnicalReviewNodeKey,
  node?: Partial<TechnicalReviewNode> | null,
): TechnicalReviewNode {
  const meta = REVIEW_NODE_META[nodeKey]
  return {
    nodeKey,
    nodeName: meta.nodeName,
    status: normalizeReviewNodeStatus(node?.status),
    reviewerRole: meta.reviewerRole,
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
  versionStatus: TechnicalVersionStatus
  reviewStage?: TechnicalReviewStage
  buyerReview: TechnicalReviewNode
  patternMakerReview: TechnicalReviewNode
  merchandiserReview: TechnicalReviewNode
}): TechnicalReviewStage {
  if (input.versionStatus === 'PUBLISHED' || input.versionStatus === 'ARCHIVED') return '已发布'
  if (input.merchandiserReview.status === '审核-已通过') return '待发布'
  if (
    isFirstStageReviewComplete(input.buyerReview) &&
    isFirstStageReviewComplete(input.patternMakerReview)
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

function createEmptyContent(technicalVersionId: string): TechnicalDataVersionContent {
  return {
    technicalVersionId,
    patternFiles: [],
    patternDesc: '',
    processEntries: [],
    sizeTable: [],
    bomItems: [],
    qualityRules: [],
    colorMaterialMappings: [],
    patternDesigns: [],
    attachments: [],
    legacyCompatibleCostPayload: {},
  }
}

function hasOwnRouteField(content: TechnicalDataVersionContent, key: keyof TechnicalDataVersionContent): boolean {
  return Object.prototype.hasOwnProperty.call(content, key)
}

function normalizeProcessRouteStatus(content: TechnicalDataVersionContent): TechnicalDataVersionContent['processRouteStatus'] {
  const legacyStatus = content.legacyCompatibleCostPayload?.processRouteStatus
  if (!hasOwnRouteField(content, 'processRouteStatus') || content.processRouteStatus === undefined) {
    if (legacyStatus === 'CONFIRMED') return 'CONFIRMED'
    if (legacyStatus === 'UNCONFIRMED') return 'UNCONFIRMED'
    return (content.processEntries?.length ?? 0) > 0 ? 'UNCONFIRMED' : undefined
  }
  return content.processRouteStatus === 'CONFIRMED' ? 'CONFIRMED' : 'UNCONFIRMED'
}

function normalizeRouteStringField(
  content: TechnicalDataVersionContent,
  key: keyof Pick<
    TechnicalDataVersionContent,
    | 'processRouteConfirmedBy'
    | 'processRouteConfirmedAt'
    | 'processRouteUpdatedBy'
    | 'processRouteUpdatedAt'
    | 'processRouteChangeReason'
  >,
): string | undefined {
  if (!hasOwnRouteField(content, key) || content[key] === undefined) {
    const legacyValue = content.legacyCompatibleCostPayload?.[key]
    if (legacyValue === undefined) return undefined
    return String(legacyValue || '')
  }
  return String(content[key] || '')
}

function normalizeRouteFields(content: TechnicalDataVersionContent): Partial<TechnicalDataVersionContent> {
  const routeFields: Partial<TechnicalDataVersionContent> = {}
  const processRouteStatus = normalizeProcessRouteStatus(content)
  const processRouteConfirmedBy = normalizeRouteStringField(content, 'processRouteConfirmedBy')
  const processRouteConfirmedAt = normalizeRouteStringField(content, 'processRouteConfirmedAt')
  const processRouteUpdatedBy = normalizeRouteStringField(content, 'processRouteUpdatedBy')
  const processRouteUpdatedAt = normalizeRouteStringField(content, 'processRouteUpdatedAt')
  const processRouteChangeReason = normalizeRouteStringField(content, 'processRouteChangeReason')
  if (processRouteStatus !== undefined) routeFields.processRouteStatus = processRouteStatus
  if (processRouteConfirmedBy !== undefined) routeFields.processRouteConfirmedBy = processRouteConfirmedBy
  if (processRouteConfirmedAt !== undefined) routeFields.processRouteConfirmedAt = processRouteConfirmedAt
  if (processRouteUpdatedBy !== undefined) routeFields.processRouteUpdatedBy = processRouteUpdatedBy
  if (processRouteUpdatedAt !== undefined) routeFields.processRouteUpdatedAt = processRouteUpdatedAt
  if (processRouteChangeReason !== undefined) routeFields.processRouteChangeReason = processRouteChangeReason
  return routeFields
}

function normalizeContent(content: TechnicalDataVersionContent): TechnicalDataVersionContent {
  return {
    technicalVersionId: content.technicalVersionId,
    patternFiles: clonePatternFiles(Array.isArray(content.patternFiles) ? content.patternFiles : []),
    patternDesc: content.patternDesc || '',
    processEntries: normalizeProcessEntries(Array.isArray(content.processEntries) ? content.processEntries : []),
    ...normalizeRouteFields(content),
    sizeTable: cloneSizeTable(Array.isArray(content.sizeTable) ? content.sizeTable : []),
    bomItems: cloneBomItems(Array.isArray(content.bomItems) ? content.bomItems : []),
    qualityRules: cloneQualityRules(Array.isArray(content.qualityRules) ? content.qualityRules : []),
    colorMaterialMappings: cloneColorMappings(
      Array.isArray(content.colorMaterialMappings) ? content.colorMaterialMappings : [],
    ),
    patternDesigns: clonePatternDesigns(Array.isArray(content.patternDesigns) ? content.patternDesigns : []),
    attachments: cloneAttachments(Array.isArray(content.attachments) ? content.attachments : []),
    legacyCompatibleCostPayload:
      content.legacyCompatibleCostPayload && typeof content.legacyCompatibleCostPayload === 'object'
        ? { ...content.legacyCompatibleCostPayload }
        : {},
  }
}

function normalizeIdSegment(input: string): string {
  return input.trim().replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-')
}

function buildAutoRepairedDesignPreviewDataUrl(fileName: string, side: 'FRONT' | 'INSIDE'): string {
  const title = side === 'FRONT' ? 'FRONT PRINT' : 'INSIDE PRINT'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="320" height="200" fill="#f8fafc"/><rect x="22" y="22" width="276" height="156" rx="16" fill="#ffffff" stroke="#cbd5e1"/><text x="160" y="92" text-anchor="middle" font-size="22" fill="#334155" font-family="Arial, sans-serif">${title}</text><text x="160" y="124" text-anchor="middle" font-size="13" fill="#64748b" font-family="Arial, sans-serif">${fileName}</text></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function buildAutoRepairedPatternDesign(input: {
  technicalVersionId: string
  bomItemId: string
  side: 'FRONT' | 'INSIDE'
  uploadedAt: string
}): TechnicalPatternDesign {
  const sideText = input.side === 'FRONT' ? '正面' : '里面'
  const fileSide = input.side === 'FRONT' ? 'front' : 'inside'
  const id = `${input.technicalVersionId}-auto-design-${normalizeIdSegment(input.bomItemId)}-${fileSide}`
  const fileName = `${input.technicalVersionId}-${normalizeIdSegment(input.bomItemId)}-${fileSide}-print.png`
  const imageUrl = buildAutoRepairedDesignPreviewDataUrl(fileName, input.side)
  return {
    id,
    name: `${sideText}印花设计图`,
    designSideType: input.side,
    fileName,
    originalFileName: fileName,
    imageUrl,
    previewThumbnailDataUrl: imageUrl,
    uploadedAt: input.uploadedAt,
  }
}

function shouldRepairCompletedDesignRequirement(record: TechnicalDataVersionRecord): boolean {
  const versionStatus = normalizeVersionStatus(record.versionStatus)
  const merchandiserReview = normalizeReviewNode('MERCHANDISER', record.merchandiserReview)
  return (
    versionStatus === 'PUBLISHED' ||
    versionStatus === 'ARCHIVED' ||
    merchandiserReview.status === '审核-已通过'
  )
}

function repairCompletedDesignRequirementContent(
  content: TechnicalDataVersionContent,
  record: TechnicalDataVersionRecord | undefined,
): TechnicalDataVersionContent {
  if (!record || !shouldRepairCompletedDesignRequirement(record)) return content

  const validation = validateTechPackDesignRequirement({
    bomItems: content.bomItems,
    patternDesigns: content.patternDesigns,
  })
  if (!validation.required || validation.valid) return content

  const uploadedAt = record.publishedAt || record.updatedAt || record.createdAt || nowText()
  const designById = new Map(content.patternDesigns.map((item) => [item.id, item]))
  const repairedDesigns = clonePatternDesigns(content.patternDesigns)
  const repairedBomItems = content.bomItems.map((item, index) => {
    if (!hasTechPackPrintRequirement(item.printRequirement)) return { ...item }

    const bomItemId = item.id || `bom-${index + 1}`
    const nextItem: TechnicalBomItem = {
      ...item,
      printSideMode: item.printSideMode === 'DOUBLE' ? 'DOUBLE' : 'SINGLE',
    }

    const normalizeDesignIds = (ids: unknown, legacyId: unknown): string[] => {
      const source = Array.isArray(ids) ? ids : []
      return Array.from(
        new Set(
          [...source, legacyId]
            .map((value) => String(value ?? '').trim())
            .filter((value) => value.length > 0),
        ),
      )
    }

    const ensureDesign = (side: 'FRONT' | 'INSIDE'): string[] => {
      const currentIds = side === 'FRONT'
        ? normalizeDesignIds(nextItem.frontPatternDesignIds, nextItem.frontPatternDesignId)
        : normalizeDesignIds(nextItem.insidePatternDesignIds, nextItem.insidePatternDesignId)
      const currentDesign = currentIds
        .map((currentId) => designById.get(currentId))
        .find((design) => design?.designSideType === side)
      if (currentDesign) return currentIds

      const repairedDesign = buildAutoRepairedPatternDesign({
        technicalVersionId: content.technicalVersionId,
        bomItemId,
        side,
        uploadedAt,
      })
      const existing = designById.get(repairedDesign.id)
      if (!existing) {
        repairedDesigns.push(repairedDesign)
        designById.set(repairedDesign.id, repairedDesign)
      }
      return [repairedDesign.id]
    }

    const frontPatternDesignIds = ensureDesign('FRONT')
    nextItem.frontPatternDesignId = frontPatternDesignIds[0]
    nextItem.frontPatternDesignIds = frontPatternDesignIds
    if (nextItem.printSideMode === 'DOUBLE') {
      const insidePatternDesignIds = ensureDesign('INSIDE')
      nextItem.insidePatternDesignId = insidePatternDesignIds[0]
      nextItem.insidePatternDesignIds = insidePatternDesignIds
    } else {
      nextItem.insidePatternDesignId = undefined
      nextItem.insidePatternDesignIds = undefined
    }
    return nextItem
  })

  return {
    ...content,
    bomItems: repairedBomItems,
    patternDesigns: repairedDesigns,
  }
}

function getDomainStatus(count: number, versionStatus: TechnicalVersionStatus): TechnicalDomainStatus {
  if (count <= 0) return 'EMPTY'
  return versionStatus === 'PUBLISHED' ? 'COMPLETE' : 'DRAFT'
}

export function buildTechnicalDataDerivedState(
  versionStatus: TechnicalVersionStatus,
  content: TechnicalDataVersionContent,
): Pick<
  TechnicalDataVersionRecord,
  | 'bomStatus'
  | 'patternStatus'
  | 'processStatus'
  | 'gradingStatus'
  | 'qualityStatus'
  | 'colorMaterialStatus'
  | 'designStatus'
  | 'attachmentStatus'
  | 'bomItemCount'
  | 'patternFileCount'
  | 'processEntryCount'
  | 'gradingRuleCount'
  | 'qualityRuleCount'
  | 'colorMaterialMappingCount'
  | 'designAssetCount'
  | 'attachmentCount'
  | 'completenessScore'
  | 'missingItemCodes'
  | 'missingItemNames'
> {
  const bomItemCount = content.bomItems.length
  const patternFileCount = content.patternFiles.length
  const processEntryCount = content.processEntries.length
  const gradingRuleCount = content.sizeTable.length
  const qualityRuleCount = content.qualityRules.length
  const colorMaterialMappingCount = content.colorMaterialMappings.length
  const designAssetCount = content.patternDesigns.length
  const attachmentCount = content.attachments.length
  const designRequirement = validateTechPackDesignRequirement({
    bomItems: content.bomItems,
    patternDesigns: content.patternDesigns,
  })
  const designDomainCount = designRequirement.required
    ? designRequirement.valid
      ? Math.max(designAssetCount, 1)
      : 0
    : designAssetCount
  const processRouteConfirmed = content.processRouteStatus === 'CONFIRMED'
  const processDomainCount = processEntryCount > 0 && processRouteConfirmed ? processEntryCount : 0

  let completenessScore = 0
  const missingItemCodes: string[] = []

  if (bomItemCount > 0) completenessScore += 20
  else missingItemCodes.push('BOM')
  if (patternFileCount > 0) completenessScore += 20
  else missingItemCodes.push('PATTERN')
  if (processDomainCount > 0) completenessScore += 20
  else missingItemCodes.push('PROCESS')
  if (gradingRuleCount > 0) completenessScore += 15
  else missingItemCodes.push('GRADING')
  if (!designRequirement.required || designRequirement.valid) completenessScore += 15
  else missingItemCodes.push('DESIGN')
  if (colorMaterialMappingCount > 0) completenessScore += 10
  else missingItemCodes.push('COLOR_MATERIAL')

  return {
    bomStatus: getDomainStatus(bomItemCount, versionStatus),
    patternStatus: getDomainStatus(patternFileCount, versionStatus),
    processStatus: getDomainStatus(processDomainCount, versionStatus),
    gradingStatus: getDomainStatus(gradingRuleCount, versionStatus),
    qualityStatus: getDomainStatus(qualityRuleCount, versionStatus),
    colorMaterialStatus: getDomainStatus(colorMaterialMappingCount, versionStatus),
    designStatus: getDomainStatus(designDomainCount, versionStatus),
    attachmentStatus: getDomainStatus(attachmentCount, versionStatus),
    bomItemCount,
    patternFileCount,
    processEntryCount,
    gradingRuleCount,
    qualityRuleCount,
    colorMaterialMappingCount,
    designAssetCount,
    attachmentCount,
    completenessScore,
    missingItemCodes,
    missingItemNames: missingItemCodes.map((code) => CORE_MISSING_NAME_MAP[code] || code),
  }
}

function applyDerivedFields(
  record: TechnicalDataVersionRecord,
  content: TechnicalDataVersionContent,
): TechnicalDataVersionRecord {
  const versionStatus = normalizeVersionStatus(record.versionStatus)
  const derived = buildTechnicalDataDerivedState(versionStatus, content)
  const buyerReview = normalizeReviewNode('BUYER', record.buyerReview)
  const patternMakerReview = normalizeReviewNode('PATTERN_MAKER', record.patternMakerReview)
  const merchandiserReview = normalizeReviewNode('MERCHANDISER', record.merchandiserReview)
  return {
    ...cloneRecord(record),
    versionStatus,
    reviewStage: deriveReviewStage({
      versionStatus,
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
    reviewUnlockedModuleKeys: normalizeTechnicalModuleKeys(record.reviewUnlockedModuleKeys),
    ...derived,
    linkedRevisionTaskIds: [...(record.linkedRevisionTaskIds ?? [])],
    linkedPatternTaskIds: [...(record.linkedPatternTaskIds ?? [])],
    linkedArtworkTaskIds: [...(record.linkedArtworkTaskIds ?? [])],
    createdFromTaskType: normalizeSourceTaskType(record.createdFromTaskType, record),
    createdFromTaskId: record.createdFromTaskId || '',
    createdFromTaskCode: record.createdFromTaskCode || '',
    primaryPlateTaskId: record.primaryPlateTaskId || '',
    primaryPlateTaskCode: record.primaryPlateTaskCode || '',
    primaryPlateTaskVersion: record.primaryPlateTaskVersion || '',
    baseTechnicalVersionId: record.baseTechnicalVersionId || '',
    baseTechnicalVersionCode: record.baseTechnicalVersionCode || '',
    changeScope: normalizeChangeScope(record.changeScope),
    changeSummary: record.changeSummary || '',
    garmentDifficultyGrade: normalizeGarmentDifficultyGrade(record.garmentDifficultyGrade),
    linkedPartTemplateIds: [...(record.linkedPartTemplateIds ?? [])],
    linkedPatternLibraryVersionIds: [...(record.linkedPatternLibraryVersionIds ?? [])],
    linkedPatternAssetIds: [...(record.linkedPatternAssetIds ?? [])],
    linkedPatternAssetCodes: [...(record.linkedPatternAssetCodes ?? [])],
    archiveCollectedFlag: Boolean(record.archiveCollectedFlag),
    archiveCollectedAt: record.archiveCollectedAt || '',
    publishedAt: record.publishedAt || '',
    publishedBy: record.publishedBy || '',
    createdAt: record.createdAt || record.updatedAt || nowText(),
    createdBy: record.createdBy || '系统初始化',
    updatedAt: record.updatedAt || record.createdAt || nowText(),
    updatedBy: record.updatedBy || record.createdBy || '系统初始化',
    note: record.note || '',
    legacySpuCode: record.legacySpuCode || '',
    legacyVersionLabel: record.legacyVersionLabel || '',
  }
}

function normalizeRecord(
  rawRecord: TechnicalDataVersionRecord,
  contentMap: Map<string, TechnicalDataVersionContent>,
): TechnicalDataVersionRecord {
  const content = contentMap.get(rawRecord.technicalVersionId) ?? createEmptyContent(rawRecord.technicalVersionId)
  return applyDerivedFields(
    {
      ...cloneRecord(rawRecord),
      sourceProjectNodeId: rawRecord.sourceProjectNodeId || '',
      linkedRevisionTaskIds: [...(rawRecord.linkedRevisionTaskIds ?? [])],
      linkedPatternTaskIds: [...(rawRecord.linkedPatternTaskIds ?? [])],
      linkedArtworkTaskIds: [...(rawRecord.linkedArtworkTaskIds ?? [])],
      createdFromTaskType: normalizeSourceTaskType(rawRecord.createdFromTaskType, rawRecord),
      createdFromTaskId: rawRecord.createdFromTaskId || '',
      createdFromTaskCode: rawRecord.createdFromTaskCode || '',
      primaryPlateTaskId: rawRecord.primaryPlateTaskId || '',
      primaryPlateTaskCode: rawRecord.primaryPlateTaskCode || '',
      primaryPlateTaskVersion: rawRecord.primaryPlateTaskVersion || '',
      baseTechnicalVersionId: rawRecord.baseTechnicalVersionId || '',
      baseTechnicalVersionCode: rawRecord.baseTechnicalVersionCode || '',
      changeScope: normalizeChangeScope(rawRecord.changeScope),
      changeSummary: rawRecord.changeSummary || '',
      garmentDifficultyGrade: normalizeGarmentDifficultyGrade(rawRecord.garmentDifficultyGrade),
      versionStatus: normalizeVersionStatus(rawRecord.versionStatus),
      bomStatus: normalizeDomainStatus(rawRecord.bomStatus),
      patternStatus: normalizeDomainStatus(rawRecord.patternStatus),
      processStatus: normalizeDomainStatus(rawRecord.processStatus),
      gradingStatus: normalizeDomainStatus(rawRecord.gradingStatus),
      qualityStatus: normalizeDomainStatus(rawRecord.qualityStatus),
      colorMaterialStatus: normalizeDomainStatus(rawRecord.colorMaterialStatus),
      designStatus: normalizeDomainStatus(rawRecord.designStatus),
      attachmentStatus: normalizeDomainStatus(rawRecord.attachmentStatus),
    },
    content,
  )
}

function normalizePendingItem(item: TechnicalDataVersionPendingItem): TechnicalDataVersionPendingItem {
  return {
    ...clonePendingItem(item),
    rawTechnicalCode: item.rawTechnicalCode || '',
    rawStyleField: item.rawStyleField || '',
    rawProjectField: item.rawProjectField || '',
    rawVersionLabel: item.rawVersionLabel || '',
    reason: item.reason || '未说明原因',
    discoveredAt: item.discoveredAt || nowText(),
  }
}

function hydrateSnapshot(snapshot: TechnicalDataVersionStoreSnapshot): TechnicalDataVersionStoreSnapshot {
  const contentMap = new Map<string, TechnicalDataVersionContent>()
  const publishedVersionIds = new Set(
    (Array.isArray(snapshot.records) ? snapshot.records : [])
      .filter((record) => normalizeVersionStatus(record.versionStatus) === 'PUBLISHED')
      .map((record) => record.technicalVersionId),
  )
  const contents = Array.isArray(snapshot.contents)
    ? snapshot.contents.map((content) => {
        const normalized = normalizeContent(content)
        if (
          publishedVersionIds.has(normalized.technicalVersionId)
          && normalized.processEntries.length > 0
          && !hasOwnRouteField(content, 'processRouteStatus')
          && content.legacyCompatibleCostPayload?.processRouteStatus === undefined
        ) {
          return {
            ...normalized,
            processRouteStatus: 'CONFIRMED' as const,
          }
        }
        return normalized
      })
    : []
  contents.forEach((content) => {
    contentMap.set(content.technicalVersionId, content)
  })

  let records = Array.isArray(snapshot.records) ? snapshot.records.map((item) => normalizeRecord(item, contentMap)) : []

  const recordById = new Map(records.map((record) => [record.technicalVersionId, record]))
  const repairedContents = contents.map((content) =>
    repairCompletedDesignRequirementContent(content, recordById.get(content.technicalVersionId)),
  )
  const repairedContentMap = new Map<string, TechnicalDataVersionContent>()
  repairedContents.forEach((content) => {
    repairedContentMap.set(content.technicalVersionId, content)
  })
  records = records.map((record) => normalizeRecord(record, repairedContentMap))

  records.forEach((record) => {
    if (!repairedContentMap.has(record.technicalVersionId)) {
      const content = createEmptyContent(record.technicalVersionId)
      repairedContentMap.set(record.technicalVersionId, content)
      repairedContents.push(content)
    }
  })

  return {
    version: TECHNICAL_VERSION_STORE_VERSION,
    records: records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    contents: repairedContents,
    pendingItems: Array.isArray(snapshot.pendingItems) ? snapshot.pendingItems.map(normalizePendingItem) : [],
  }
}

function mergeMissingSeedData(snapshot: TechnicalDataVersionStoreSnapshot): TechnicalDataVersionStoreSnapshot {
  const seed = seedSnapshot()
  const existingIds = new Set(snapshot.records.map((item) => item.technicalVersionId))
  const existingPendingIds = new Set(snapshot.pendingItems.map((item) => item.pendingId))
  const merged = hydrateSnapshot({
    version: TECHNICAL_VERSION_STORE_VERSION,
    records: [
      ...snapshot.records,
      ...seed.records.filter((item) => !existingIds.has(item.technicalVersionId)).map(cloneRecord),
    ],
    contents: [
      ...snapshot.contents,
      ...seed.contents
        .filter((item) => !existingIds.has(item.technicalVersionId))
        .map(cloneContent),
    ],
    pendingItems: [
      ...snapshot.pendingItems,
      ...seed.pendingItems.filter((item) => !existingPendingIds.has(item.pendingId)).map(clonePendingItem),
    ],
  })
  return merged
}

function loadSnapshot(): TechnicalDataVersionStoreSnapshot {
  if (memorySnapshot) return cloneSnapshot(memorySnapshot)

  if (!canUseStorage()) {
    memorySnapshot = seedSnapshot()
    return cloneSnapshot(memorySnapshot)
  }

  try {
    const raw = localStorage.getItem(TECHNICAL_VERSION_STORAGE_KEY)
    if (!raw) {
      memorySnapshot = seedSnapshot()
      localStorage.setItem(TECHNICAL_VERSION_STORAGE_KEY, JSON.stringify(memorySnapshot))
      return cloneSnapshot(memorySnapshot)
    }
    const parsed = JSON.parse(raw) as Partial<TechnicalDataVersionStoreSnapshot>
    if (!Array.isArray(parsed.records) || !Array.isArray(parsed.contents) || !Array.isArray(parsed.pendingItems)) {
      memorySnapshot = seedSnapshot()
      localStorage.setItem(TECHNICAL_VERSION_STORAGE_KEY, JSON.stringify(memorySnapshot))
      return cloneSnapshot(memorySnapshot)
    }

    memorySnapshot = mergeMissingSeedData(
      hydrateSnapshot({
        version: TECHNICAL_VERSION_STORE_VERSION,
        records: parsed.records as TechnicalDataVersionRecord[],
        contents: parsed.contents as TechnicalDataVersionContent[],
        pendingItems: parsed.pendingItems as TechnicalDataVersionPendingItem[],
      }),
    )
    localStorage.setItem(TECHNICAL_VERSION_STORAGE_KEY, JSON.stringify(memorySnapshot))
    return cloneSnapshot(memorySnapshot)
  } catch {
    memorySnapshot = seedSnapshot()
    if (canUseStorage()) {
      localStorage.setItem(TECHNICAL_VERSION_STORAGE_KEY, JSON.stringify(memorySnapshot))
    }
    return cloneSnapshot(memorySnapshot)
  }
}

function persistSnapshot(snapshot: TechnicalDataVersionStoreSnapshot): void {
  memorySnapshot = hydrateSnapshot(snapshot)
  if (canUseStorage()) {
    localStorage.setItem(TECHNICAL_VERSION_STORAGE_KEY, JSON.stringify(memorySnapshot))
  }
}

function nextDailySequence(dateKey: string): number {
  return loadSnapshot().records.filter((item) => buildDateKey(item.createdAt || item.updatedAt) === dateKey).length + 1
}

export function buildTechnicalVersionId(dateKey: string, sequence: number): string {
  return `tdv_${dateKey}_${String(sequence).padStart(3, '0')}`
}

export function buildTechnicalVersionCode(dateKey: string, sequence: number): string {
  return `TDV-${dateKey}-${String(sequence).padStart(3, '0')}`
}

export function getNextTechnicalVersionIdentity() {
  const timestamp = nowText()
  const dateKey = buildDateKey(timestamp)
  const sequence = nextDailySequence(dateKey)
  return {
    timestamp,
    dateKey,
    sequence,
    technicalVersionId: buildTechnicalVersionId(dateKey, sequence),
    technicalVersionCode: buildTechnicalVersionCode(dateKey, sequence),
  }
}

export function getNextStyleVersionMeta(styleId: string): { versionNo: number; versionLabel: string } {
  const current = listTechnicalDataVersionsByStyleId(styleId)
  const versionNo = current.length + 1
  return {
    versionNo,
    versionLabel: `V${versionNo}`,
  }
}

export function getTechnicalDataVersionStoreSnapshot(): TechnicalDataVersionStoreSnapshot {
  return loadSnapshot()
}

export function listTechnicalDataVersions(): TechnicalDataVersionRecord[] {
  return loadSnapshot().records.map(cloneRecord).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function getTechnicalDataVersionById(technicalVersionId: string): TechnicalDataVersionRecord | null {
  const record = loadSnapshot().records.find((item) => item.technicalVersionId === technicalVersionId)
  return record ? cloneRecord(record) : null
}

export function getTechnicalDataVersionContent(technicalVersionId: string): TechnicalDataVersionContent | null {
  const content = loadSnapshot().contents.find((item) => item.technicalVersionId === technicalVersionId)
  return content ? cloneContent(content) : null
}

export function getTechnicalDataVersionContentById(technicalVersionId: string): TechnicalDataVersionContent | null {
  return getTechnicalDataVersionContent(technicalVersionId)
}

export function listTechnicalDataVersionsByStyleId(styleId: string): TechnicalDataVersionRecord[] {
  return loadSnapshot()
    .records
    .filter((item) => item.styleId === styleId)
    .sort((a, b) => b.versionNo - a.versionNo || b.updatedAt.localeCompare(a.updatedAt))
    .map(cloneRecord)
}

export function listTechnicalDataVersionsByProjectId(projectId: string): TechnicalDataVersionRecord[] {
  return loadSnapshot()
    .records
    .filter((item) => item.sourceProjectId === projectId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map(cloneRecord)
}

export function getCurrentTechPackVersionByStyleId(styleId: string): TechnicalDataVersionRecord | null {
  // 当前生效版本以款式档案主记录为准，FCS 不再按 spuCode 运行时回查。
  const style = getStyleArchiveById(styleId)
  if (!style?.currentTechPackVersionId) return null
  return getTechnicalDataVersionById(style.currentTechPackVersionId)
}

export function createTechnicalDataVersionDraft(
  record: TechnicalDataVersionRecord,
  content?: TechnicalDataVersionContent,
): TechnicalDataVersionRecord {
  const snapshot = loadSnapshot()
  const normalizedContent = normalizeContent(content ?? createEmptyContent(record.technicalVersionId))
  const normalizedRecord = normalizeRecord(record, new Map([[record.technicalVersionId, normalizedContent]]))
  persistSnapshot({
    version: TECHNICAL_VERSION_STORE_VERSION,
    records: [normalizedRecord, ...snapshot.records.filter((item) => item.technicalVersionId !== normalizedRecord.technicalVersionId)],
    contents: [normalizedContent, ...snapshot.contents.filter((item) => item.technicalVersionId !== normalizedRecord.technicalVersionId)],
    pendingItems: snapshot.pendingItems,
  })
  return cloneRecord(normalizedRecord)
}

export function updateTechnicalDataVersionRecord(
  technicalVersionId: string,
  patch: Partial<TechnicalDataVersionRecord>,
): TechnicalDataVersionRecord | null {
  const snapshot = loadSnapshot()
  const index = snapshot.records.findIndex((item) => item.technicalVersionId === technicalVersionId)
  if (index < 0) return null
  const content = snapshot.contents.find((item) => item.technicalVersionId === technicalVersionId) ?? createEmptyContent(technicalVersionId)
  const nextRecord = normalizeRecord(
    {
      ...snapshot.records[index],
      ...patch,
    },
    new Map([[technicalVersionId, content]]),
  )
  const nextRecords = [...snapshot.records]
  nextRecords.splice(index, 1, nextRecord)
  persistSnapshot({
    ...snapshot,
    records: nextRecords,
  })
  return cloneRecord(nextRecord)
}

export function updateTechnicalDataVersionContent(
  technicalVersionId: string,
  patch: Partial<TechnicalDataVersionContent>,
): TechnicalDataVersionContent | null {
  const snapshot = loadSnapshot()
  const contentIndex = snapshot.contents.findIndex((item) => item.technicalVersionId === technicalVersionId)
  const base = contentIndex >= 0 ? snapshot.contents[contentIndex] : createEmptyContent(technicalVersionId)
  const nextContent = normalizeContent({
    ...base,
    ...patch,
    technicalVersionId,
  })
  const nextContents = [...snapshot.contents]
  if (contentIndex >= 0) nextContents.splice(contentIndex, 1, nextContent)
  else nextContents.push(nextContent)

  const recordIndex = snapshot.records.findIndex((item) => item.technicalVersionId === technicalVersionId)
  const nextRecords = [...snapshot.records]
  if (recordIndex >= 0) {
    nextRecords.splice(
      recordIndex,
      1,
      normalizeRecord(snapshot.records[recordIndex], new Map([[technicalVersionId, nextContent]])),
    )
  }

  persistSnapshot({
    version: TECHNICAL_VERSION_STORE_VERSION,
    records: nextRecords,
    contents: nextContents,
    pendingItems: snapshot.pendingItems,
  })
  return cloneContent(nextContent)
}

export function publishTechnicalDataVersionRecord(
  technicalVersionId: string,
  publishedAt: string,
  publishedBy: string,
): TechnicalDataVersionRecord | null {
  const snapshot = loadSnapshot()
  const target = snapshot.records.find((item) => item.technicalVersionId === technicalVersionId)
  if (!target) return null
  const content =
    snapshot.contents.find((item) => item.technicalVersionId === technicalVersionId) ??
    createEmptyContent(technicalVersionId)
  const nextRecords = snapshot.records.map((item) =>
    item.technicalVersionId === technicalVersionId
      ? normalizeRecord(
          {
            ...item,
            versionStatus: 'PUBLISHED',
            publishedAt,
            publishedBy,
            updatedAt: publishedAt,
            updatedBy: publishedBy,
          },
          new Map([[technicalVersionId, content]]),
        )
      : item,
  )
  persistSnapshot({
    ...snapshot,
    records: nextRecords,
  })
  return getTechnicalDataVersionById(technicalVersionId)
}

export function archiveTechnicalDataVersionRecord(
  technicalVersionId: string,
  updatedAt: string,
  updatedBy: string,
): TechnicalDataVersionRecord | null {
  return updateTechnicalDataVersionRecord(technicalVersionId, {
    versionStatus: 'ARCHIVED',
    updatedAt,
    updatedBy,
  })
}

export function listTechnicalDataVersionPendingItems(): TechnicalDataVersionPendingItem[] {
  return loadSnapshot().pendingItems.map(clonePendingItem)
}

export function pushTechnicalDataVersionPendingItem(item: TechnicalDataVersionPendingItem): void {
  const snapshot = loadSnapshot()
  if (snapshot.pendingItems.some((current) => current.pendingId === item.pendingId)) return
  persistSnapshot({
    ...snapshot,
    pendingItems: [...snapshot.pendingItems, normalizePendingItem(item)],
  })
}

export function replaceTechnicalDataVersionStore(snapshot: TechnicalDataVersionStoreSnapshot): void {
  persistSnapshot(snapshot)
}

export function resetTechnicalDataVersionRepository(): void {
  const snapshot = seedSnapshot()
  persistSnapshot(snapshot)
  if (canUseStorage()) {
    localStorage.removeItem(TECHNICAL_VERSION_STORAGE_KEY)
    localStorage.setItem(TECHNICAL_VERSION_STORAGE_KEY, JSON.stringify(snapshot))
  }
}
