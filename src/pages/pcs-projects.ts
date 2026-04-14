import { appStore } from '../state/store.ts'
import { escapeHtml, formatDateTime, toClassName } from '../utils.ts'
import {
  approveProjectInit,
  createEmptyProjectDraft,
  createProject,
  getChannelNamesByCodes,
  getProjectById,
  getProjectCategoryChildren,
  getProjectCreateCatalog,
  getProjectNodeRecordById,
  getProjectNodeRecordByWorkItemTypeCode,
  listActiveProjectTemplates,
  listProjectNodes,
  listProjectPhases,
  listProjects,
  updateProjectNodeRecord,
  updateProjectPhaseRecord,
  updateProjectRecord,
} from '../data/pcs-project-repository.ts'
import type {
  PcsProjectCreateDraft,
  PcsProjectNodeRecord,
  PcsProjectPhaseRecord,
  PcsProjectRecord,
  ProjectNodeStatus,
} from '../data/pcs-project-types.ts'
import {
  countTemplateStages,
  countTemplateWorkItems,
  getProjectTemplateById,
  type ProjectTemplate,
  type TemplateStyleType,
} from '../data/pcs-templates.ts'
import { getPcsWorkItemDefinition } from '../data/pcs-work-items.ts'
import {
  getProjectWorkItemContract,
  getProjectWorkItemContractById,
  getProjectPhaseContract,
  listProjectWorkItemFieldGroups,
  type PcsProjectNodeFieldGroupDefinition,
  type PcsProjectWorkItemCode,
} from '../data/pcs-project-domain-contract.ts'
import {
  getLatestProjectInlineNodeRecord,
  listProjectInlineNodeRecordsByNode,
  listProjectInlineNodeRecordsByProject,
  saveProjectInlineNodeFieldEntry,
} from '../data/pcs-project-inline-node-record-repository.ts'
import {
  PCS_PROJECT_INLINE_NODE_RECORD_WORK_ITEM_TYPES,
  type PcsProjectInlineNodeRecord,
  type PcsProjectInlineNodeRecordWorkItemTypeCode,
} from '../data/pcs-project-inline-node-record-types.ts'
import {
  listProjectRelationsByProject,
  listProjectRelationsByProjectNode,
  upsertProjectRelation,
} from '../data/pcs-project-relation-repository.ts'
import type { ProjectRelationRecord } from '../data/pcs-project-relation-types.ts'
import {
  resolvePcsStoreCurrency,
  resolvePcsStoreDisplayName,
} from '../data/pcs-channel-store-master.ts'
import { getLiveProductLineById } from '../data/pcs-live-testing-repository.ts'
import { getVideoTestRecordById } from '../data/pcs-video-testing-repository.ts'

type ProjectListViewMode = 'list' | 'grid'
type ProjectListSort = 'updatedAt' | 'pendingDecision' | 'risk' | 'progressLow'
type ProjectDateRange = '全部时间' | '今天' | '最近一周' | '最近一月'
type WorkItemTabKey = 'full-info' | 'records' | 'attachments' | 'audit'
type DecisionDialogSource = 'detail' | 'work-item'

interface ProjectListState {
  search: string
  styleType: string
  status: string
  owner: string
  phase: string
  riskStatus: string
  dateRange: ProjectDateRange
  pendingDecisionOnly: boolean
  advancedOpen: boolean
  viewMode: ProjectListViewMode
  sortBy: ProjectListSort
  currentPage: number
  pageSize: number
}

interface ProjectCreateState {
  routeKey: string
  draft: PcsProjectCreateDraft
  error: string | null
}

interface ProjectDetailState {
  routeKey: string
  projectId: string | null
  selectedNodeId: string | null
  expandedPhases: Record<string, boolean>
}

interface ProjectWorkItemState {
  routeKey: string
  projectId: string | null
  projectNodeId: string | null
  activeTab: WorkItemTabKey
}

interface DecisionDialogState {
  open: boolean
  source: DecisionDialogSource
  projectId: string
  projectNodeId: string
  value: string
  note: string
}

interface RecordDialogState {
  open: boolean
  projectId: string
  projectNodeId: string
  businessDate: string
  note: string
  values: Record<string, string>
}

interface ProjectPageState {
  list: ProjectListState
  create: ProjectCreateState
  detail: ProjectDetailState
  workItem: ProjectWorkItemState
  notice: string | null
  terminateProjectId: string | null
  terminateReason: string
  createCancelOpen: boolean
  decisionDialog: DecisionDialogState
  recordDialog: RecordDialogState
}

interface ProjectNodeViewModel {
  node: PcsProjectNodeRecord
  contract: ReturnType<typeof getProjectWorkItemContract>
  definition: ReturnType<typeof getPcsWorkItemDefinition>
  records: PcsProjectInlineNodeRecord[]
  latestRecord: PcsProjectInlineNodeRecord | null
  relations: ProjectRelationRecord[]
  unlocked: boolean
  displayStatus: ProjectNodeStatus | '未解锁'
}

interface ProjectPhaseViewModel {
  phase: PcsProjectPhaseRecord
  nodes: ProjectNodeViewModel[]
  derivedStatus: PcsProjectPhaseRecord['phaseStatus']
  completedCount: number
  totalCount: number
  pendingDecision: boolean
  current: boolean
}

interface ProjectLogItem {
  time: string
  title: string
  detail: string
  tone: 'blue' | 'amber' | 'emerald' | 'slate' | 'rose'
}

interface ProjectViewModel {
  project: PcsProjectRecord
  phases: ProjectPhaseViewModel[]
  nodes: ProjectNodeViewModel[]
  currentPhase: ProjectPhaseViewModel | null
  currentNode: ProjectNodeViewModel | null
  nextNode: ProjectNodeViewModel | null
  pendingDecisionNode: ProjectNodeViewModel | null
  progressDone: number
  progressTotal: number
  channelNames: string[]
  logs: ProjectLogItem[]
}

const DEMO_OPERATOR = '系统演示'
const STYLE_TYPE_OPTIONS: Array<'全部' | TemplateStyleType> = ['全部', '基础款', '快时尚款', '改版款', '设计款']
const PROJECT_STATUS_OPTIONS = ['全部', '待审核', '已立项', '进行中', '已终止', '已归档']
const RISK_STATUS_OPTIONS = ['全部', '正常', '延期']
const DATE_RANGE_OPTIONS: ProjectDateRange[] = ['全部时间', '今天', '最近一周', '最近一月']
const WORK_ITEM_TAB_OPTIONS: Array<{ key: WorkItemTabKey; label: string }> = [
  { key: 'full-info', label: '全量信息' },
  { key: 'records', label: '记录' },
  { key: 'attachments', label: '附件与引用' },
  { key: 'audit', label: '操作日志' },
]

const initialListState: ProjectListState = {
  search: '',
  styleType: '全部',
  status: '全部',
  owner: '全部负责人',
  phase: '全部阶段',
  riskStatus: '全部',
  dateRange: '全部时间',
  pendingDecisionOnly: false,
  advancedOpen: false,
  viewMode: 'list',
  sortBy: 'updatedAt',
  currentPage: 1,
  pageSize: 8,
}

function createEmptyRecordDialogState(): RecordDialogState {
  return {
    open: false,
    projectId: '',
    projectNodeId: '',
    businessDate: '',
    note: '',
    values: {},
  }
}

const state: ProjectPageState = {
  list: { ...initialListState },
  create: {
    routeKey: '',
    draft: createEmptyProjectDraft(),
    error: null,
  },
  detail: {
    routeKey: '',
    projectId: null,
    selectedNodeId: null,
    expandedPhases: {},
  },
  workItem: {
    routeKey: '',
    projectId: null,
    projectNodeId: null,
    activeTab: 'full-info',
  },
  notice: null,
  terminateProjectId: null,
  terminateReason: '',
  createCancelOpen: false,
  decisionDialog: {
    open: false,
    source: 'detail',
    projectId: '',
    projectNodeId: '',
    value: '',
    note: '',
  },
  recordDialog: createEmptyRecordDialogState(),
}

let projectDemoSeedReady = false

function nowText(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

function todayText(): string {
  return nowText().slice(0, 10)
}

function getCurrentQueryParams(): URLSearchParams {
  const [, search = ''] = appStore.getState().pathname.split('?')
  return new URLSearchParams(search)
}

function parseDateValue(value: string): number {
  if (!value) return 0
  const normalized = value.includes('T') ? value : value.replace(' ', 'T')
  const timestamp = new Date(normalized).getTime()
  return Number.isFinite(timestamp) ? timestamp : 0
}

function formatValue(value: unknown): string {
  if (value == null || value === '') return '-'
  if (Array.isArray(value)) {
    const items = value.map((item) => String(item).trim()).filter(Boolean)
    return items.length > 0 ? items.join('、') : '-'
  }
  if (typeof value === 'boolean') return value ? '是' : '否'
  if (typeof value === 'number') return Number.isFinite(value) ? value.toLocaleString('zh-CN') : '-'
  if (typeof value === 'object') return escapeHtml(JSON.stringify(value))
  return String(value).trim() || '-'
}

function isClosedNodeStatus(status: ProjectNodeStatus): boolean {
  return status === '已完成' || status === '已取消'
}

function canUseInlineRecords(workItemTypeCode: string): workItemTypeCode is PcsProjectInlineNodeRecordWorkItemTypeCode {
  return (PCS_PROJECT_INLINE_NODE_RECORD_WORK_ITEM_TYPES as readonly string[]).includes(workItemTypeCode)
}

function getDecisionFieldMeta(
  workItemTypeCode: string,
): {
  valueFieldKey: string
  noteFieldKey: string
} | null {
  if (workItemTypeCode === 'FEASIBILITY_REVIEW') {
    return { valueFieldKey: 'reviewConclusion', noteFieldKey: 'reviewRisk' }
  }
  if (workItemTypeCode === 'SAMPLE_CONFIRM') {
    return { valueFieldKey: 'confirmResult', noteFieldKey: 'confirmNote' }
  }
  if (workItemTypeCode === 'TEST_CONCLUSION') {
    return { valueFieldKey: 'conclusion', noteFieldKey: 'conclusionNote' }
  }
  return null
}

const INLINE_NODE_PAYLOAD_KEYS: Record<PcsProjectInlineNodeRecordWorkItemTypeCode, string[]> = {
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

function getInlineEditableFieldKeys(workItemTypeCode: string): Set<string> {
  if (!canUseInlineRecords(workItemTypeCode)) return new Set()
  return new Set(INLINE_NODE_PAYLOAD_KEYS[workItemTypeCode])
}

function parseRelationNoteMeta(note: string | null | undefined): Record<string, unknown> {
  if (!note) return {}
  const trimmed = note.trim()
  if (!trimmed.startsWith('{')) return {}
  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    return {}
  }
  return {}
}

function serializeRelationNoteMeta(meta: Record<string, unknown>): string {
  return JSON.stringify(meta)
}

function collectRelationNoteMeta(relations: ProjectRelationRecord[]): Record<string, unknown> {
  return [...relations]
    .sort((left, right) => left.businessDate.localeCompare(right.businessDate))
    .reduce((result, relation) => Object.assign(result, parseRelationNoteMeta(relation.note)), {} as Record<string, unknown>)
}

function getFirstTargetChannelCode(project: PcsProjectRecord): string {
  return project.targetChannelCodes[0] || 'tiktok-shop'
}

function getChannelDisplayName(channelCode: string): string {
  return getChannelNamesByCodes([channelCode])[0] || channelCode
}

function getStoreDisplayName(storeId: string, channelCode = ''): string {
  return resolvePcsStoreDisplayName(storeId, channelCode)
}

function getDefaultChannelCurrency(channelCode: string): string {
  return resolvePcsStoreCurrency('', channelCode)
}

function getStyleArchiveStatusText(status: string): string {
  if (status === 'DRAFT') return '技术包待完善'
  if (status === 'ACTIVE' || status === '已启用') return '可生产'
  if (status === 'ARCHIVED' || status === '已归档') return '已归档'
  return status
}

function getTechPackVersionStatusText(status: string): string {
  if (status === 'DRAFT') return '草稿中'
  if (status === 'PUBLISHED') return '已发布'
  if (status === 'ACTIVE') return '已启用'
  if (status === 'ARCHIVED') return '已归档'
  return status
}

function getProjectArchiveStatusText(status: string): string {
  if (status === 'DRAFT') return '草稿'
  if (status === 'COLLECTING') return '收集中'
  if (status === 'READY') return '待归档'
  if (status === 'FINALIZED' || status === '已归档') return '已归档'
  return status
}

function findLatestProjectRelation(
  projectId: string,
  sourceModule: ProjectRelationRecord['sourceModule'],
  sourceObjectType?: ProjectRelationRecord['sourceObjectType'],
): ProjectRelationRecord | null {
  return (
    listProjectRelationsByProject(projectId)
      .filter(
        (relation) =>
          relation.sourceModule === sourceModule &&
          (sourceObjectType ? relation.sourceObjectType === sourceObjectType : true),
      )
      .sort((left, right) => right.businessDate.localeCompare(left.businessDate))[0] || null
  )
}

function buildFallbackUpstreamChannelProductCode(channelProductCode: string, projectCode: string): string {
  if (channelProductCode) return `${channelProductCode}-UP`
  return `${projectCode}-UP`
}

function getCurrentChannelProductRelation(projectId: string): ProjectRelationRecord | null {
  return (
    listProjectRelationsByProject(projectId)
      .filter((relation) => relation.sourceModule === '渠道商品' && relation.sourceObjectType === '渠道商品')
      .sort((left, right) => right.businessDate.localeCompare(left.businessDate))[0] || null
  )
}

function getProjectTestingAggregate(projectId: string): {
  liveRelationIds: string[]
  liveRelationCodes: string[]
  videoRelationIds: string[]
  videoRelationCodes: string[]
  totalExposureQty: number
  totalClickQty: number
  totalOrderQty: number
  totalGmvAmount: number
} {
  const relations = listProjectRelationsByProject(projectId)
  const liveRelations = relations.filter(
    (relation) => relation.sourceModule === '直播' && relation.sourceObjectType === '直播商品明细',
  )
  const videoRelations = relations.filter(
    (relation) => relation.sourceModule === '短视频' && relation.sourceObjectType === '短视频记录',
  )

  const liveLines = liveRelations
    .map((relation) => {
      const meta = parseRelationNoteMeta(relation.note)
      const liveLineId = relation.sourceLineId || relation.sourceObjectId
      const record = liveLineId ? getLiveProductLineById(liveLineId) : null
      return {
        liveLineId: record?.liveLineId || String(meta.liveLineId || liveLineId || ''),
        liveLineCode: record?.liveLineCode || String(meta.liveLineCode || relation.sourceLineCode || relation.sourceObjectCode || ''),
        exposureQty: record?.exposureQty ?? Number(meta.exposureQty || 0),
        clickQty: record?.clickQty ?? Number(meta.clickQty || 0),
        orderQty: record?.orderQty ?? Number(meta.orderQty || 0),
        gmvAmount: record?.gmvAmount ?? Number(meta.gmvAmount || 0),
      }
    })
    .filter((item) => item.liveLineId || item.liveLineCode)
  const videoRecords = videoRelations
    .map((relation) => {
      const meta = parseRelationNoteMeta(relation.note)
      const record = relation.sourceObjectId ? getVideoTestRecordById(relation.sourceObjectId) : null
      return {
        videoRecordId: record?.videoRecordId || String(meta.videoRecordId || relation.sourceObjectId || ''),
        videoRecordCode: record?.videoRecordCode || String(meta.videoRecordCode || relation.sourceObjectCode || ''),
        exposureQty: record?.exposureQty ?? Number(meta.exposureQty || 0),
        clickQty: record?.clickQty ?? Number(meta.clickQty || 0),
        orderQty: record?.orderQty ?? Number(meta.orderQty || 0),
        gmvAmount: record?.gmvAmount ?? Number(meta.gmvAmount || 0),
      }
    })
    .filter((item) => item.videoRecordId || item.videoRecordCode)

  return {
    liveRelationIds: Array.from(new Set(liveLines.map((line) => line.liveLineId).filter(Boolean))),
    liveRelationCodes: Array.from(new Set(liveLines.map((line) => line.liveLineCode).filter(Boolean))),
    videoRelationIds: Array.from(new Set(videoRecords.map((record) => record.videoRecordId).filter(Boolean))),
    videoRelationCodes: Array.from(new Set(videoRecords.map((record) => record.videoRecordCode).filter(Boolean))),
    totalExposureQty:
      liveLines.reduce((sum, item) => sum + item.exposureQty, 0) +
      videoRecords.reduce((sum, item) => sum + item.exposureQty, 0),
    totalClickQty:
      liveLines.reduce((sum, item) => sum + item.clickQty, 0) +
      videoRecords.reduce((sum, item) => sum + item.clickQty, 0),
    totalOrderQty:
      liveLines.reduce((sum, item) => sum + item.orderQty, 0) +
      videoRecords.reduce((sum, item) => sum + item.orderQty, 0),
    totalGmvAmount:
      liveLines.reduce((sum, item) => sum + item.gmvAmount, 0) +
      videoRecords.reduce((sum, item) => sum + item.gmvAmount, 0),
  }
}

function getNodeFieldValue(project: PcsProjectRecord, node: ProjectNodeViewModel, fieldKey: string): unknown {
  const payload = (node.latestRecord?.payload || {}) as Record<string, unknown>
  const detailSnapshot = (node.latestRecord?.detailSnapshot || {}) as Record<string, unknown>
  const nodeRelationMeta = collectRelationNoteMeta(node.relations)
  const currentChannelProduct = getCurrentChannelProductRelation(project.projectId)
  const currentChannelMeta = parseRelationNoteMeta(currentChannelProduct?.note)
  const styleRelation = findLatestProjectRelation(project.projectId, '款式档案', '款式档案')
  const styleMeta = parseRelationNoteMeta(styleRelation?.note)
  const projectArchiveRelation = findLatestProjectRelation(project.projectId, '项目资料归档', '项目资料归档')
  const projectArchiveMeta = parseRelationNoteMeta(projectArchiveRelation?.note)
  const testingAggregate = getProjectTestingAggregate(project.projectId)
  const defaultChannelCode = getFirstTargetChannelCode(project)
  const defaultChannelName = getChannelDisplayName(defaultChannelCode)
  const currentChannelCode = String(currentChannelMeta.channelCode || nodeRelationMeta.channelCode || defaultChannelCode)
  const currentStoreId = String(currentChannelMeta.storeId || nodeRelationMeta.storeId || '')
  const currentChannelName = String(
    currentChannelMeta.targetChannelCode || nodeRelationMeta.targetChannelCode || getChannelDisplayName(currentChannelCode),
  )
  const currentStoreName = String(
    currentStoreId
      ? getStoreDisplayName(currentStoreId, currentChannelCode)
      : currentChannelMeta.targetStoreId || nodeRelationMeta.targetStoreId || '-',
  )
  const currentCurrency = String(
    currentStoreId
      ? resolvePcsStoreCurrency(currentStoreId, currentChannelCode)
      : currentChannelMeta.currency || nodeRelationMeta.currency || getDefaultChannelCurrency(currentChannelCode),
  )
  const currentChannelProductCode = String(
    currentChannelMeta.channelProductCode || currentChannelProduct?.sourceObjectCode || node.node.latestInstanceCode || '',
  )
  const currentUpstreamChannelProductCode = String(
    currentChannelMeta.upstreamChannelProductCode ||
      nodeRelationMeta.upstreamChannelProductCode ||
      buildFallbackUpstreamChannelProductCode(currentChannelProductCode, project.projectCode),
  )
  const currentStyleCode = String(
    styleMeta.styleCode ||
      projectArchiveMeta.linkedStyleCode ||
      currentChannelMeta.linkedStyleCode ||
      project.linkedStyleCode ||
      styleRelation?.sourceObjectCode ||
      '',
  )
  const currentStyleName = String(
    styleMeta.styleName || project.linkedStyleName || styleRelation?.sourceTitle || project.projectName,
  )
  const projectValues: Record<string, unknown> = {
    projectName: project.projectName,
    projectCode: project.projectCode,
    templateId: [project.templateName, project.templateVersion].filter(Boolean).join(' / '),
    projectSourceType: project.projectSourceType,
    categoryId: project.categoryName,
    categoryName: project.categoryName,
    brandId: project.brandName,
    styleCodeId: project.styleCodeName,
    styleTagIds: project.styleTagNames,
    crowdPositioningIds: project.crowdPositioningNames,
    ageIds: project.ageNames,
    crowdIds: project.crowdNames,
    productPositioningIds: project.productPositioningNames,
    targetChannelCodes: getChannelNamesByCodes(project.targetChannelCodes),
    ownerId: project.ownerName,
    teamId: project.teamName,
    collaboratorIds: project.collaboratorNames,
    priorityLevel: project.priorityLevel,
    remark: project.remark,
    subCategoryName: project.subCategoryName,
    styleType: project.styleType,
    ownerName: project.ownerName,
    teamName: project.teamName,
    priceRange: project.priceRangeLabel,
    targetChannelCode: currentChannelName || defaultChannelName,
    targetStoreId: currentStoreName,
    listingTitle: currentChannelMeta.listingTitle || nodeRelationMeta.listingTitle || `${project.projectName} 测款渠道商品`,
    listingPrice: currentChannelMeta.listingPrice || nodeRelationMeta.listingPrice || project.sampleUnitPrice || 199,
    currency: currentCurrency,
    sampleSupplierId: project.sampleSupplierName || project.sampleSupplierId,
    sampleSourceType: project.sampleSourceType,
    sampleLink: project.sampleLink,
    sampleUnitPrice: project.sampleUnitPrice,
    linkedChannelProductCode: currentChannelProductCode,
    channelProductCode: currentChannelProductCode,
    upstreamChannelProductCode: currentUpstreamChannelProductCode,
    channelProductStatus:
      currentChannelMeta.channelProductStatus || nodeRelationMeta.channelProductStatus || currentChannelProduct?.sourceStatus || '',
    upstreamSyncStatus: currentChannelMeta.upstreamSyncStatus || nodeRelationMeta.upstreamSyncStatus || '',
    invalidatedReason: currentChannelMeta.invalidatedReason || nodeRelationMeta.invalidatedReason || '',
    channelProductId: nodeRelationMeta.channelProductCode || nodeRelationMeta.channelProductId || currentChannelProductCode,
    videoChannel: nodeRelationMeta.videoChannel || nodeRelationMeta.channelName || '',
    exposureQty: nodeRelationMeta.exposureQty,
    clickQty: nodeRelationMeta.clickQty,
    orderQty: nodeRelationMeta.orderQty,
    gmvAmount: nodeRelationMeta.gmvAmount,
    videoResult: nodeRelationMeta.videoResult || node.node.latestResultText,
    liveSessionId: nodeRelationMeta.liveSessionCode || nodeRelationMeta.liveSessionId || '',
    liveLineId: nodeRelationMeta.liveLineCode || nodeRelationMeta.liveLineId || '',
    liveResult: nodeRelationMeta.liveResult || node.node.latestResultText,
    totalExposureQty: testingAggregate.totalExposureQty,
    totalClickQty: testingAggregate.totalClickQty,
    totalOrderQty: testingAggregate.totalOrderQty,
    totalGmvAmount: testingAggregate.totalGmvAmount,
    styleId: styleMeta.styleId || project.linkedStyleId || styleRelation?.sourceObjectId || '',
    styleCode: currentStyleCode || project.styleCodeName,
    styleName: currentStyleName,
    archiveStatus: getStyleArchiveStatusText(
      String(
        styleMeta.archiveStatus ||
          styleRelation?.sourceStatus ||
          (project.linkedStyleCode ? 'ACTIVE' : ''),
      ),
    ),
    linkedStyleCode: currentStyleCode,
    linkedTechPackVersionCode:
      project.linkedTechPackVersionCode ||
      projectArchiveMeta.linkedTechPackVersionCode ||
      styleMeta.linkedTechPackVersionCode ||
      '',
    linkedTechPackVersionStatus: getTechPackVersionStatusText(
      String(
        project.linkedTechPackVersionStatus ||
          projectArchiveMeta.linkedTechPackVersionStatus ||
          styleMeta.linkedTechPackVersionStatus ||
          '',
      ),
    ),
    projectArchiveNo: project.projectArchiveNo || projectArchiveRelation?.sourceObjectCode || '',
    projectArchiveStatus: getProjectArchiveStatusText(
      String(project.projectArchiveStatus || projectArchiveRelation?.sourceStatus || ''),
    ),
    patternBrief: nodeRelationMeta.patternBrief || nodeRelationMeta.note || node.node.latestResultText,
    productStyleCode: nodeRelationMeta.productStyleCode || currentStyleCode,
    sizeRange: nodeRelationMeta.sizeRange || '',
    patternVersion: nodeRelationMeta.patternVersion || '',
    artworkType: nodeRelationMeta.artworkType || '',
    patternMode: nodeRelationMeta.patternMode || '',
    artworkName: nodeRelationMeta.artworkName || '',
    artworkVersion: nodeRelationMeta.artworkVersion || '',
    factoryId: nodeRelationMeta.factoryName || nodeRelationMeta.factoryId || '',
    targetSite: nodeRelationMeta.targetSite || '',
    expectedArrival: nodeRelationMeta.expectedArrival || '',
    trackingNo: nodeRelationMeta.trackingNo || '',
    sampleCode: nodeRelationMeta.sampleCode || detailSnapshot.sampleCode || '',
  }
  return (
    payload[fieldKey] ??
    detailSnapshot[fieldKey] ??
    projectValues[fieldKey] ??
    nodeRelationMeta[fieldKey] ??
    (fieldKey === 'currentStatus' ? node.displayStatus : undefined) ??
    (fieldKey === 'latestResultText' ? node.node.latestResultText : undefined) ??
    (fieldKey === 'pendingActionText' ? node.node.pendingActionText : undefined)
  )
}

function formatDraftFieldValue(type: PcsProjectNodeFieldGroupDefinition['fields'][number]['type'], value: unknown): string {
  if (value == null) return ''
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean).join('、')
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  const text = String(value)
  if (type === 'date') return text.slice(0, 10)
  if (type === 'datetime') return text.replace(' ', 'T').slice(0, 16)
  return text
}

function normalizeDraftFieldValue(
  field: PcsProjectNodeFieldGroupDefinition['fields'][number],
  value: string,
): unknown {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (field.type === 'number') {
    const parsed = Number(trimmed)
    return Number.isFinite(parsed) ? parsed : trimmed
  }
  if (field.type === 'multi-select' || field.type === 'reference-multi' || field.type === 'user-multi-select') {
    return trimmed
      .split(/[、,，\n]/)
      .map((item) => item.trim())
      .filter(Boolean)
  }
  if (field.type === 'datetime') {
    return trimmed.replace('T', ' ')
  }
  return trimmed
}

function deriveRecordSummaryNote(workItemTypeCode: string, values: Record<string, unknown>): string {
  const pickFirst = (...keys: string[]): string => {
    for (const key of keys) {
      const value = values[key]
      if (value == null) continue
      if (Array.isArray(value)) {
        const joined = value.map((item) => String(item).trim()).filter(Boolean).join('、')
        if (joined) return joined
        continue
      }
      const text = String(value).trim()
      if (text) return text
    }
    return ''
  }

  switch (workItemTypeCode) {
    case 'SAMPLE_ACQUIRE':
      return pickFirst('sampleSupplierId', 'sampleLink', 'sampleSourceType') || '已登记样衣来源。'
    case 'SAMPLE_INBOUND_CHECK':
      return pickFirst('checkResult', 'sampleCode') || '已登记到样核对。'
    case 'FEASIBILITY_REVIEW':
      return pickFirst('reviewRisk', 'reviewConclusion') || '已更新可行性判断。'
    case 'SAMPLE_SHOOT_FIT':
      return pickFirst('fitFeedback', 'shootPlan') || '已补充样衣拍摄与试穿反馈。'
    case 'SAMPLE_CONFIRM':
      return pickFirst('confirmNote', 'confirmResult') || '已更新样衣确认结果。'
    case 'SAMPLE_COST_REVIEW':
      return pickFirst('costNote', 'costTotal') || '已保存样衣核价。'
    case 'SAMPLE_PRICING':
      return pickFirst('pricingNote', 'priceRange') || '已保存样衣定价。'
    case 'TEST_DATA_SUMMARY':
      return pickFirst('summaryText') || '已完成测款数据汇总。'
    case 'TEST_CONCLUSION':
      return pickFirst('conclusionNote', 'conclusion') || '已更新测款结论。'
    case 'SAMPLE_RETAIN_REVIEW':
      return pickFirst('retainNote', 'retainResult') || '已保存留存评估。'
    case 'SAMPLE_RETURN_HANDLE':
      return pickFirst('returnResult') || '已保存退回处理结果。'
    default:
      return '已保存节点字段。'
  }
}

function buildRecordDraftDefaults(project: PcsProjectRecord, node: ProjectNodeViewModel): Omit<RecordDialogState, 'open'> {
  const businessDate = (node.latestRecord?.businessDate || '').slice(0, 10) || todayText()
  const editableKeys = getInlineEditableFieldKeys(node.node.workItemTypeCode)
  const groups = listProjectWorkItemFieldGroups(node.node.workItemTypeCode as PcsProjectWorkItemCode)
  const values = Object.fromEntries(
    groups
      .flatMap((group) => group.fields)
      .filter((field) => !field.readonly && editableKeys.has(field.fieldKey))
      .map((field) => {
        const rawValue = node.latestRecord?.payload?.[field.fieldKey] ?? getNodeFieldValue(project, node, field.fieldKey) ?? ''
        return [field.fieldKey, formatDraftFieldValue(field.type, rawValue)]
      }),
  )

  return {
    projectId: project.projectId,
    projectNodeId: node.node.projectNodeId,
    businessDate,
    note: deriveRecordSummaryNote(
      node.node.workItemTypeCode,
      ((node.latestRecord?.payload || values) as Record<string, unknown>),
    ),
    values,
  }
}

function getNodeRecordDraft(project: PcsProjectRecord, node: ProjectNodeViewModel): RecordDialogState {
  const defaults = buildRecordDraftDefaults(project, node)
  if (
    state.recordDialog.projectId !== project.projectId ||
    state.recordDialog.projectNodeId !== node.node.projectNodeId
  ) {
    return {
      ...defaults,
      open: false,
    }
  }

  return {
    open: state.recordDialog.open,
    projectId: defaults.projectId,
    projectNodeId: defaults.projectNodeId,
    businessDate: state.recordDialog.businessDate || defaults.businessDate,
    note: state.recordDialog.note || defaults.note,
    values: {
      ...defaults.values,
      ...state.recordDialog.values,
    },
  }
}

function getMissingRequiredFieldLabels(
  node: PcsProjectNodeRecord,
  normalizedValues: Record<string, unknown>,
): string[] {
  const latestRecord = getLatestProjectInlineNodeRecord(node.projectNodeId)
  const mergedValues = {
    ...(latestRecord?.payload || {}),
    ...normalizedValues,
  } as Record<string, unknown>
  const contract = getProjectWorkItemContract(node.workItemTypeCode as PcsProjectWorkItemCode)
  return contract.fieldDefinitions
    .filter((field) => !field.readonly && field.required)
    .filter((field) => {
      const value = mergedValues[field.fieldKey]
      if (value == null) return true
      if (Array.isArray(value)) return value.length === 0
      return String(value).trim() === ''
    })
    .map((field) => field.label)
}

function getBusinessRuleValidationErrors(
  project: PcsProjectRecord,
  node: ProjectNodeViewModel,
  values: Record<string, unknown>,
): string[] {
  const errors: string[] = []

  if (node.node.workItemTypeCode === 'SAMPLE_ACQUIRE') {
    const sampleSourceType = String(values.sampleSourceType || '').trim()
    const sampleLink = String(values.sampleLink || '').trim()
    const sampleUnitPrice = values.sampleUnitPrice
    const hasUnitPrice =
      typeof sampleUnitPrice === 'number'
        ? Number.isFinite(sampleUnitPrice)
        : String(sampleUnitPrice || '').trim() !== ''
    if (sampleSourceType === '外采' && !sampleLink && !hasUnitPrice) {
      errors.push('样衣来源方式为外采时，外采链接和样衣单价至少填写一项。')
    }
  }

  if (node.node.workItemTypeCode === 'TEST_DATA_SUMMARY') {
    const aggregate = getProjectTestingAggregate(project.projectId)
    if (aggregate.liveRelationIds.length + aggregate.videoRelationIds.length === 0) {
      errors.push('至少关联 1 条正式直播或短视频测款事实后，才能提交测款汇总。')
    }
  }

  return errors
}

function renderFormalFieldControl(
  field: PcsProjectNodeFieldGroupDefinition['fields'][number],
  value: string,
  disabled: boolean,
): string {
  const baseClass =
    'w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
  const commonAttrs = `data-pcs-project-field="formal-field" data-field-key="${escapeHtml(field.fieldKey)}" ${disabled ? 'disabled' : ''}`

  if ((field.type === 'select' || field.type === 'single-select') && field.options && field.options.length > 0) {
    return `
      <select class="h-10 ${baseClass}" ${commonAttrs}>
        <option value="">请选择${escapeHtml(field.label)}</option>
        ${field.options
          .map(
            (option) =>
              `<option value="${escapeHtml(option.value)}" ${value === option.value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`,
          )
          .join('')}
      </select>
    `
  }

  if (field.type === 'textarea') {
    return `
      <textarea class="min-h-[112px] ${baseClass} py-2" placeholder="${escapeHtml(field.placeholder || `请输入${field.label}`)}" ${commonAttrs}>${escapeHtml(value)}</textarea>
    `
  }

  if (field.type === 'date') {
    return `<input type="date" class="h-10 ${baseClass}" value="${escapeHtml(value)}" ${commonAttrs} />`
  }

  if (field.type === 'datetime') {
    return `<input type="datetime-local" class="h-10 ${baseClass}" value="${escapeHtml(value)}" ${commonAttrs} />`
  }

  if (field.type === 'number') {
    return `<input type="number" class="h-10 ${baseClass}" value="${escapeHtml(value)}" placeholder="${escapeHtml(field.placeholder || `请输入${field.label}`)}" ${commonAttrs} />`
  }

  if (field.type === 'url') {
    return `<input type="url" class="h-10 ${baseClass}" value="${escapeHtml(value)}" placeholder="${escapeHtml(field.placeholder || `请输入${field.label}`)}" ${commonAttrs} />`
  }

  return `<input type="text" class="h-10 ${baseClass}" value="${escapeHtml(value)}" placeholder="${escapeHtml(field.placeholder || `请输入${field.label}`)}" ${commonAttrs} />`
}

function getProjectTypeLabel(styleType: TemplateStyleType): PcsProjectCreateDraft['projectType'] {
  if (styleType === '快时尚款') return '快反上新'
  if (styleType === '改版款') return '改版开发'
  if (styleType === '设计款') return '设计研发'
  return '商品开发'
}

function renderNotice(): string {
  if (!state.notice) return ''
  return `
    <section class="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
      <div class="flex items-start justify-between gap-3">
        <p>${escapeHtml(state.notice)}</p>
        <button type="button" class="inline-flex h-7 items-center rounded-md px-2 text-xs text-blue-700 hover:bg-blue-100" data-pcs-project-action="close-notice">关闭</button>
      </div>
    </section>
  `
}

function renderModalShell(
  title: string,
  description: string,
  body: string,
  footer: string,
  sizeClass = 'max-w-lg',
): string {
  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
      <div class="w-full ${sizeClass} rounded-lg border bg-white shadow-2xl">
        <div class="border-b px-6 py-4">
          <h3 class="text-lg font-semibold text-slate-900">${escapeHtml(title)}</h3>
          <p class="mt-1 text-sm text-slate-500">${escapeHtml(description)}</p>
        </div>
        <div class="max-h-[72vh] overflow-y-auto space-y-4 px-6 py-5">${body}</div>
        <div class="flex items-center justify-end gap-2 border-t px-6 py-4">${footer}</div>
      </div>
    </div>
  `
}

function getTemplateByStyleType(styleType: TemplateStyleType): ProjectTemplate | null {
  return listActiveProjectTemplates().find((template) => template.styleType.includes(styleType)) ?? null
}

function findCatalogOptionByName(options: Array<{ id: string; name: string }>, name: string): { id: string; name: string } | null {
  return options.find((item) => item.name === name) ?? options[0] ?? null
}

function findCategoryOptionByName(name: string): { categoryId: string; categoryName: string; subCategoryId: string; subCategoryName: string } | null {
  const category = getProjectCreateCatalog().categories.find((item) => item.name === name) ?? getProjectCreateCatalog().categories[0]
  if (!category) return null
  const child = category.children[0] ?? { id: '', name: '' }
  return {
    categoryId: category.id,
    categoryName: category.name,
    subCategoryId: child.id,
    subCategoryName: child.name,
  }
}

function buildDemoDraft(input: {
  projectName: string
  styleType: TemplateStyleType
  projectSourceType: PcsProjectCreateDraft['projectSourceType']
  categoryName: string
  ownerName: string
  teamName: string
  brandName: string
  styleCodeName: string
  styleTags: string[]
  channels: string[]
  remark: string
}): PcsProjectCreateDraft {
  const catalog = getProjectCreateCatalog()
  const template = getTemplateByStyleType(input.styleType)
  const category = findCategoryOptionByName(input.categoryName)
  const owner = findCatalogOptionByName(catalog.owners, input.ownerName)
  const team = findCatalogOptionByName(catalog.teams, input.teamName)
  const brand = findCatalogOptionByName(catalog.brands, input.brandName)
  const styleCode = findCatalogOptionByName(catalog.styleCodes, input.styleCodeName)
  const supplier = catalog.sampleSuppliers[0] ?? { id: '', name: '' }

  return {
    ...createEmptyProjectDraft(),
    projectName: input.projectName,
    projectType: getProjectTypeLabel(input.styleType),
    projectSourceType: input.projectSourceType,
    templateId: template?.id ?? '',
    categoryId: category?.categoryId ?? '',
    categoryName: category?.categoryName ?? '',
    subCategoryId: category?.subCategoryId ?? '',
    subCategoryName: category?.subCategoryName ?? '',
    brandId: brand?.id ?? '',
    brandName: brand?.name ?? '',
    styleCodeId: styleCode?.id ?? '',
    styleCodeName: styleCode?.name ?? '',
    styleNumber: styleCode?.name ?? input.projectName,
    styleType: input.styleType,
    yearTag: '2026',
    seasonTags: ['夏季'],
    styleTags: [...input.styleTags],
    styleTagNames: [...input.styleTags],
    priceRangeLabel: catalog.priceRanges[1] ?? '',
    targetChannelCodes: [...input.channels],
    sampleSourceType: catalog.sampleSourceTypes[0] ?? '',
    sampleSupplierId: supplier.id,
    sampleSupplierName: supplier.name,
    sampleLink: 'https://example.com/mock-sample',
    sampleUnitPrice: '79',
    ownerId: owner?.id ?? '',
    ownerName: owner?.name ?? '',
    teamId: team?.id ?? '',
    teamName: team?.name ?? '',
    priorityLevel: '中',
    remark: input.remark,
  }
}

function upsertDemoRelation(input: {
  project: PcsProjectRecord
  workItemTypeCode: PcsProjectWorkItemCode
  sourceModule: ProjectRelationRecord['sourceModule']
  sourceObjectType: ProjectRelationRecord['sourceObjectType']
  sourceObjectId: string
  sourceObjectCode: string
  sourceTitle: string
  sourceStatus: string
  businessDate: string
  relationRole?: ProjectRelationRecord['relationRole']
  sourceLineId?: string | null
  sourceLineCode?: string | null
  ownerName?: string
  noteMeta?: Record<string, unknown>
}): void {
  const node = getProjectNodeRecordByWorkItemTypeCode(input.project.projectId, input.workItemTypeCode)
  if (!node) return
  upsertProjectRelation({
    projectRelationId: '',
    projectId: input.project.projectId,
    projectCode: input.project.projectCode,
    projectNodeId: node.projectNodeId,
    workItemTypeCode: node.workItemTypeCode,
    workItemTypeName: node.workItemTypeName,
    relationRole: input.relationRole || '产出对象',
    sourceModule: input.sourceModule,
    sourceObjectType: input.sourceObjectType,
    sourceObjectId: input.sourceObjectId,
    sourceObjectCode: input.sourceObjectCode,
    sourceLineId: input.sourceLineId ?? null,
    sourceLineCode: input.sourceLineCode ?? null,
    sourceTitle: input.sourceTitle,
    sourceStatus: input.sourceStatus,
    businessDate: input.businessDate,
    ownerName: input.ownerName || input.project.ownerName,
    createdAt: input.businessDate,
    createdBy: DEMO_OPERATOR,
    updatedAt: input.businessDate,
    updatedBy: DEMO_OPERATOR,
    note: serializeRelationNoteMeta(input.noteMeta || {}),
    legacyRefType: '',
    legacyRefValue: '',
  })
}

function seedNodeStatus(
  projectId: string,
  workItemTypeCode: string,
  patch: Partial<PcsProjectNodeRecord>,
  operatorName = DEMO_OPERATOR,
): void {
  const node = getProjectNodeRecordByWorkItemTypeCode(projectId, workItemTypeCode)
  if (!node) return
  updateProjectNodeRecord(projectId, node.projectNodeId, patch, operatorName)
}

function syncProjectLifecycle(projectId: string, operatorName = DEMO_OPERATOR, timestamp = nowText()): void {
  const project = getProjectById(projectId)
  const phases = listProjectPhases(projectId)
  const nodes = listProjectNodes(projectId)
  if (!project || phases.length === 0 || nodes.length === 0) return

  const nextNode = nodes.find((node) => !isClosedNodeStatus(node.currentStatus)) ?? null
  const currentPhaseCode = nextNode?.phaseCode ?? phases[phases.length - 1]?.phaseCode ?? project.currentPhaseCode
  const currentPhase = phases.find((item) => item.phaseCode === currentPhaseCode) ?? phases[0]
  const progressDone = nodes.filter((node) => node.currentStatus === '已完成').length
  const progressTotal = nodes.length
  const pendingDecisionNode = nodes.find((node) => node.currentStatus === '待确认') ?? null
  const completedNonInitCount = nodes.filter(
    (node) => node.workItemTypeCode !== 'PROJECT_INIT' && node.currentStatus === '已完成',
  ).length
  const allClosed = nodes.every((node) => isClosedNodeStatus(node.currentStatus))

  let projectStatus = project.projectStatus
  if (project.projectStatus === '已终止') {
    projectStatus = '已终止'
  } else if (project.projectStatus === '待审核') {
    projectStatus = '待审核'
  } else if (allClosed) {
    projectStatus = '已归档'
  } else if (completedNonInitCount === 0) {
    projectStatus = '已立项'
  } else {
    projectStatus = '进行中'
  }

  phases.forEach((phase) => {
    const phaseNodes = nodes.filter((node) => node.phaseCode === phase.phaseCode)
    let phaseStatus: PcsProjectPhaseRecord['phaseStatus'] = '未开始'
    if (projectStatus === '已终止' && phaseNodes.some((node) => !isClosedNodeStatus(node.currentStatus))) {
      phaseStatus = '已终止'
    } else if (phaseNodes.length > 0 && phaseNodes.every((node) => isClosedNodeStatus(node.currentStatus))) {
      phaseStatus = '已完成'
    } else if (
      phase.phaseCode === currentPhaseCode ||
      phaseNodes.some((node) => node.currentStatus === '进行中' || node.currentStatus === '待确认')
    ) {
      phaseStatus = '进行中'
    } else if (phase.phaseOrder < currentPhase.phaseOrder) {
      phaseStatus = '已完成'
    }

    updateProjectPhaseRecord(projectId, phase.projectPhaseId, {
      phaseStatus,
      startedAt: phaseStatus === '未开始' ? '' : phase.startedAt || timestamp,
      finishedAt: phaseStatus === '已完成' || phaseStatus === '已终止' ? phase.finishedAt || timestamp : '',
    })
  })

  updateProjectRecord(
    projectId,
    {
      currentPhaseCode: currentPhase.phaseCode,
      currentPhaseName: currentPhase.phaseName,
      projectStatus,
      progressDone,
      progressTotal,
      nextWorkItemName: nextNode?.workItemTypeName ?? '-',
      nextWorkItemStatus: nextNode?.currentStatus ?? '-',
      pendingDecisionFlag: Boolean(pendingDecisionNode),
      blockedFlag: projectStatus === '待审核',
      blockedReason: projectStatus === '待审核' ? '等待项目立项审核。' : project.blockedReason ?? '',
      updatedAt: timestamp,
    },
    operatorName,
  )
}

function completeProjectNode(
  projectId: string,
  projectNodeId: string,
  input: {
    operatorName?: string
    timestamp?: string
    resultType?: string
    resultText?: string
  } = {},
): PcsProjectNodeRecord | null {
  const node = getProjectNodeRecordById(projectId, projectNodeId)
  if (!node) return null

  const operatorName = input.operatorName ?? DEMO_OPERATOR
  const timestamp = input.timestamp ?? nowText()
  const records = listProjectInlineNodeRecordsByNode(projectNodeId)
  const validInstanceCount = Math.max(node.validInstanceCount, records.length, 1)

  updateProjectNodeRecord(
    projectId,
    projectNodeId,
    {
      currentStatus: '已完成',
      validInstanceCount,
      latestInstanceId: node.latestInstanceId || `${projectNodeId}-instance-${String(validInstanceCount).padStart(3, '0')}`,
      latestInstanceCode: node.latestInstanceCode || `${node.workItemTypeCode}-${String(validInstanceCount).padStart(3, '0')}`,
      latestResultType: input.resultType ?? '节点完成',
      latestResultText: input.resultText ?? `${node.workItemTypeName}已完成。`,
      pendingActionType: '已完成',
      pendingActionText: '节点已完成',
      updatedAt: timestamp,
      lastEventType: input.resultType ?? '节点完成',
      lastEventTime: timestamp,
    },
    operatorName,
  )

  return getProjectNodeRecordById(projectId, projectNodeId)
}

function activateProjectNode(
  projectId: string,
  projectNodeId: string,
  input: {
    operatorName?: string
    timestamp?: string
    pendingActionType?: string
    pendingActionText?: string
    latestResultType?: string
    latestResultText?: string
  } = {},
): PcsProjectNodeRecord | null {
  const node = getProjectNodeRecordById(projectId, projectNodeId)
  if (!node || isClosedNodeStatus(node.currentStatus)) return node

  const operatorName = input.operatorName ?? DEMO_OPERATOR
  const timestamp = input.timestamp ?? nowText()

  updateProjectNodeRecord(
    projectId,
    projectNodeId,
    {
      currentStatus: '进行中',
      pendingActionType: input.pendingActionType ?? '待执行',
      pendingActionText: input.pendingActionText ?? `当前请处理：${node.workItemTypeName}`,
      latestResultType: input.latestResultType ?? node.latestResultType,
      latestResultText: input.latestResultText ?? node.latestResultText,
      updatedAt: timestamp,
    },
    operatorName,
  )

  return getProjectNodeRecordById(projectId, projectNodeId)
}

function cancelProjectNode(
  projectId: string,
  projectNodeId: string,
  reason: string,
  operatorName = DEMO_OPERATOR,
  timestamp = nowText(),
): void {
  const node = getProjectNodeRecordById(projectId, projectNodeId)
  if (!node || isClosedNodeStatus(node.currentStatus)) return

  updateProjectNodeRecord(
    projectId,
    projectNodeId,
    {
      currentStatus: '已取消',
      latestResultType: '分支跳过',
      latestResultText: reason,
      pendingActionType: '已取消',
      pendingActionText: '当前分支无需继续处理',
      updatedAt: timestamp,
      lastEventType: '分支跳过',
      lastEventTime: timestamp,
    },
    operatorName,
  )
}

function markNodeCompletedAndUnlockNext(
  projectId: string,
  projectNodeId: string,
  input: {
    operatorName?: string
    timestamp?: string
    resultType?: string
    resultText?: string
  } = {},
): void {
  const node = completeProjectNode(projectId, projectNodeId, input)
  if (!node) return

  const orderedNodes = listProjectNodes(projectId)
  const currentIndex = orderedNodes.findIndex((item) => item.projectNodeId === projectNodeId)
  const nextNode = orderedNodes.slice(currentIndex + 1).find((item) => item.currentStatus === '未开始')
  if (nextNode) {
    activateProjectNode(projectId, nextNode.projectNodeId, {
      operatorName: input.operatorName,
      timestamp: input.timestamp,
      pendingActionType: '待执行',
      pendingActionText: `当前请处理：${nextNode.workItemTypeName}`,
    })
  }

  syncProjectLifecycle(projectId, input.operatorName ?? DEMO_OPERATOR, input.timestamp ?? nowText())
}

function terminateProject(projectId: string, reason: string, operatorName = '当前用户', timestamp = nowText()): void {
  const project = getProjectById(projectId)
  if (!project) return

  listProjectNodes(projectId).forEach((node) => {
    if (isClosedNodeStatus(node.currentStatus)) return
    updateProjectNodeRecord(
      projectId,
      node.projectNodeId,
      {
        currentStatus: '已取消',
        latestResultType: '项目终止',
        latestResultText: reason,
        pendingActionType: '已取消',
        pendingActionText: '项目已终止',
        updatedAt: timestamp,
        lastEventType: '项目终止',
        lastEventTime: timestamp,
      },
      operatorName,
    )
  })

  updateProjectRecord(
    projectId,
    {
      projectStatus: '已终止',
      blockedFlag: true,
      blockedReason: reason,
      updatedAt: timestamp,
      remark: project.remark ? `${project.remark}\n终止原因：${reason}` : `终止原因：${reason}`,
    },
    operatorName,
  )
  syncProjectLifecycle(projectId, operatorName, timestamp)
}

function archiveProject(projectId: string, operatorName = '当前用户', timestamp = nowText()): { ok: boolean; message: string } {
  const nodes = listProjectNodes(projectId)
  if (nodes.some((node) => !isClosedNodeStatus(node.currentStatus))) {
    return { ok: false, message: '仍有未完成节点，当前不能归档。' }
  }

  updateProjectRecord(projectId, { projectStatus: '已归档', updatedAt: timestamp }, operatorName)
  syncProjectLifecycle(projectId, operatorName, timestamp)
  return { ok: true, message: '项目已归档。' }
}

function buildQuickRecordPayload(
  project: PcsProjectRecord,
  node: PcsProjectNodeRecord,
  input: { businessDate: string; note: string },
): {
  values: Record<string, unknown>
  detailSnapshot?: Record<string, unknown>
} | null {
  const note = input.note.trim() || `${node.workItemTypeName}已更新。`
  const currentChannelProduct = getCurrentChannelProductRelation(project.projectId)
  const currentChannelMeta = parseRelationNoteMeta(currentChannelProduct?.note)
  const testingAggregate = getProjectTestingAggregate(project.projectId)
  switch (node.workItemTypeCode) {
    case 'SAMPLE_ACQUIRE':
      return {
        values: {
          sampleSourceType: project.sampleSourceType || '外采',
          sampleSupplierId: project.sampleSupplierId || 'supplier-demo',
          sampleLink: project.sampleLink || 'https://example.com/mock-sample',
          sampleUnitPrice: project.sampleUnitPrice ?? 79,
        },
        detailSnapshot: {
          acquireMethod: project.sampleSourceType || '外采',
          acquirePurpose: '商品项目打样准备',
          applicant: project.ownerName,
          expectedArrivalDate: input.businessDate,
          handler: project.ownerName,
          specNote: note,
        },
      }
    case 'SAMPLE_INBOUND_CHECK':
      return {
        values: {
          sampleCode: `${project.projectCode}-Y001`,
          arrivalTime: `${input.businessDate} 10:00`,
          checkResult: note,
        },
        detailSnapshot: {
          receiver: project.ownerName,
          warehouseLocation: '样衣仓 A-01',
          sampleQuantity: 1,
          approvalStatus: '已入库',
        },
      }
    case 'FEASIBILITY_REVIEW':
      return {
        values: {
          reviewConclusion: '通过',
          reviewRisk: note,
        },
        detailSnapshot: {
          evaluationDimension: ['版型', '渠道适配', '面料'],
          judgmentDescription: note,
          evaluationParticipants: [project.ownerName, project.teamName],
          approvalStatus: '已评审',
        },
      }
    case 'SAMPLE_SHOOT_FIT':
      return {
        values: {
          shootPlan: '完成试穿拍摄',
          fitFeedback: note,
        },
        detailSnapshot: {
          shootDate: input.businessDate,
          shootLocation: '摄影棚 A',
          modelInvolved: true,
          modelName: '演示模特',
          editingRequired: true,
        },
      }
    case 'SAMPLE_CONFIRM':
      return {
        values: {
          confirmResult: '通过',
          confirmNote: note,
        },
        detailSnapshot: {
          appearanceConfirmation: '通过',
          sizeConfirmation: '通过',
          craftsmanshipConfirmation: '通过',
          materialConfirmation: '通过',
          confirmationNotes: note,
        },
      }
    case 'SAMPLE_COST_REVIEW':
      return {
        values: {
          costTotal: 86,
          costNote: note,
        },
        detailSnapshot: {
          actualSampleCost: 86,
          targetProductionCost: 79,
          costVariance: 7,
          costCompliance: '可接受',
        },
      }
    case 'SAMPLE_PRICING':
      return {
        values: {
          priceRange: project.priceRangeLabel || '两百元主销带',
          pricingNote: note,
        },
        detailSnapshot: {
          baseCost: 86,
          targetProfitMargin: '58%',
          finalPrice: 199,
          pricingStrategy: '主销引流款',
          approvalStatus: '已确认',
        },
      }
    case 'TEST_DATA_SUMMARY':
      return {
        values: {
          summaryText: note,
          totalExposureQty: testingAggregate.totalExposureQty,
          totalClickQty: testingAggregate.totalClickQty,
          totalOrderQty: testingAggregate.totalOrderQty,
          totalGmvAmount: testingAggregate.totalGmvAmount,
        },
        detailSnapshot: {
          summaryOwner: project.ownerName,
          summaryAt: `${input.businessDate} 18:30`,
          liveRelationIds: testingAggregate.liveRelationIds,
          videoRelationIds: testingAggregate.videoRelationIds,
          liveRelationCodes: testingAggregate.liveRelationCodes,
          videoRelationCodes: testingAggregate.videoRelationCodes,
          channelProductId: currentChannelProduct?.sourceObjectId || '',
          channelProductCode: currentChannelProduct?.sourceObjectCode || `${project.projectCode}-CP`,
          upstreamChannelProductCode: String(
            currentChannelMeta.upstreamChannelProductCode ||
              buildFallbackUpstreamChannelProductCode(
                currentChannelProduct?.sourceObjectCode || `${project.projectCode}-CP`,
                project.projectCode,
              ),
          ),
        },
      }
    case 'TEST_CONCLUSION':
      return {
        values: {
          conclusion: '通过',
          conclusionNote: note,
          linkedChannelProductCode: currentChannelProduct?.sourceObjectCode || `${project.projectCode}-CP`,
          invalidationPlanned: false,
        },
        detailSnapshot: {
          channelProductId: currentChannelProduct?.sourceObjectId || '',
          channelProductCode: currentChannelProduct?.sourceObjectCode || `${project.projectCode}-CP`,
          upstreamChannelProductCode: String(
            parseRelationNoteMeta(currentChannelProduct?.note).upstreamChannelProductCode ||
              buildFallbackUpstreamChannelProductCode(
                currentChannelProduct?.sourceObjectCode || `${project.projectCode}-CP`,
                project.projectCode,
              ),
          ),
        },
      }
    case 'SAMPLE_RETAIN_REVIEW':
      return {
        values: {
          retainResult: '留样',
          retainNote: note,
        },
        detailSnapshot: {
          sampleCode: `${project.projectCode}-Y001`,
          availabilityAfter: '可调拨',
          locationAfter: '样衣仓 B-02',
        },
      }
    case 'SAMPLE_RETURN_HANDLE':
      return {
        values: {
          returnResult: '已退回供应商',
        },
        detailSnapshot: {
          returnDate: input.businessDate,
          returnRecipient: project.sampleSupplierName || '演示供应商',
          trackingNumber: `${project.projectCode}-RET`,
          modificationReason: note,
        },
      }
    default:
      return null
  }
}

function seedInlineRecordAndComplete(
  projectId: string,
  workItemTypeCode: PcsProjectInlineNodeRecordWorkItemTypeCode,
  input: {
    businessDate: string
    note: string
  },
): void {
  const project = getProjectById(projectId)
  const node = getProjectNodeRecordByWorkItemTypeCode(projectId, workItemTypeCode)
  if (!project || !node) return

  const payload = buildQuickRecordPayload(project, node, input)
  if (!payload) return

  saveProjectInlineNodeFieldEntry(
    projectId,
    node.projectNodeId,
    {
      businessDate: `${input.businessDate} 10:00`,
      values: payload.values,
      detailSnapshot: payload.detailSnapshot,
    },
    DEMO_OPERATOR,
  )

  markNodeCompletedAndUnlockNext(projectId, node.projectNodeId, {
    operatorName: DEMO_OPERATOR,
    timestamp: `${input.businessDate} 10:30`,
    resultType: '已完成',
    resultText: input.note,
  })
}

function seedInlineRecord(
  projectId: string,
  workItemTypeCode: PcsProjectInlineNodeRecordWorkItemTypeCode,
  input: {
    businessDate: string
    note: string
  },
): void {
  const project = getProjectById(projectId)
  const node = getProjectNodeRecordByWorkItemTypeCode(projectId, workItemTypeCode)
  if (!project || !node) return

  const payload = buildQuickRecordPayload(project, node, input)
  if (!payload) return

  saveProjectInlineNodeFieldEntry(
    projectId,
    node.projectNodeId,
    {
      businessDate: `${input.businessDate} 10:00`,
      values: payload.values,
      detailSnapshot: payload.detailSnapshot,
    },
    DEMO_OPERATOR,
  )
}

function ensureProjectDemoData(): void {
  if (projectDemoSeedReady) return
  if (listProjects().length > 0) {
    projectDemoSeedReady = true
    return
  }

  const pendingProject = createProject(
    buildDemoDraft({
      projectName: '2026夏季宽松基础T恤',
      styleType: '基础款',
      projectSourceType: '企划提案',
      categoryName: '上衣',
      ownerName: '张丽',
      teamName: '商品企划组',
      brandName: 'Chicmore',
      styleCodeName: '1-Casul Shirt-18-30休闲衬衫',
      styleTags: ['休闲', '基础'],
      channels: ['tiktok-shop', 'shopee'],
      remark: '等待负责人完成立项审核。',
    }),
    DEMO_OPERATOR,
  ).project
  updateProjectRecord(
    pendingProject.projectId,
    {
      createdAt: '2026-04-13 09:10',
      updatedAt: '2026-04-13 09:10',
      blockedFlag: true,
      blockedReason: '等待项目立项审核。',
    },
    DEMO_OPERATOR,
  )
  seedNodeStatus(pendingProject.projectId, 'PROJECT_INIT', {
    updatedAt: '2026-04-13 09:10',
    latestResultType: '待审核',
    latestResultText: '商品项目已创建，等待负责人审核立项。',
    lastEventType: '创建项目',
    lastEventTime: '2026-04-13 09:10',
  })
  syncProjectLifecycle(pendingProject.projectId, DEMO_OPERATOR, '2026-04-13 09:10')

  const ongoingProject = createProject(
    buildDemoDraft({
      projectName: '2026夏季印花短袖快反项目',
      styleType: '快时尚款',
      projectSourceType: '渠道反馈',
      categoryName: '上衣',
      ownerName: '王明',
      teamName: '快反开发组',
      brandName: 'FADFAD',
      styleCodeName: '2-prin shirt-18-30印花衬衫',
      styleTags: ['休闲', '度假'],
      channels: ['tiktok-shop', 'lazada'],
      remark: '已进入渠道商品上架准备。',
    }),
    DEMO_OPERATOR,
  ).project
  approveProjectInit(ongoingProject.projectId, DEMO_OPERATOR)
  seedInlineRecordAndComplete(ongoingProject.projectId, 'SAMPLE_ACQUIRE', {
    businessDate: '2026-04-10',
    note: '已完成样衣外采，首批样衣到仓。',
  })
  seedInlineRecordAndComplete(ongoingProject.projectId, 'SAMPLE_INBOUND_CHECK', {
    businessDate: '2026-04-10',
    note: '样衣完整，无明显瑕疵。',
  })
  seedInlineRecordAndComplete(ongoingProject.projectId, 'FEASIBILITY_REVIEW', {
    businessDate: '2026-04-11',
    note: '渠道适配度良好，建议继续推进。',
  })
  seedInlineRecordAndComplete(ongoingProject.projectId, 'SAMPLE_CONFIRM', {
    businessDate: '2026-04-11',
    note: '样衣确认通过，可进入渠道上架。',
  })
  seedInlineRecordAndComplete(ongoingProject.projectId, 'SAMPLE_COST_REVIEW', {
    businessDate: '2026-04-11',
    note: '核价已确认，成本符合快反策略。',
  })
  seedInlineRecordAndComplete(ongoingProject.projectId, 'SAMPLE_PRICING', {
    businessDate: '2026-04-12',
    note: '建议以 199 元主销价上架。',
  })
  seedNodeStatus(ongoingProject.projectId, 'CHANNEL_PRODUCT_LISTING', {
    currentStatus: '进行中',
    validInstanceCount: 1,
    latestInstanceId: `${ongoingProject.projectId}-listing-001`,
    latestInstanceCode: `${ongoingProject.projectCode}-CP-001`,
    latestResultType: '已创建渠道商品',
    latestResultText: '已生成抖音商城渠道商品，等待发起上架。',
    pendingActionType: '发起上架',
    pendingActionText: '请补充上架标题和售价后提交上架。',
    updatedAt: '2026-04-12 18:40',
    lastEventType: '创建渠道商品',
    lastEventTime: '2026-04-12 18:40',
  })
  upsertDemoRelation({
    project: ongoingProject,
    workItemTypeCode: 'CHANNEL_PRODUCT_LISTING',
    sourceModule: '渠道商品',
    sourceObjectType: '渠道商品',
    sourceObjectId: `${ongoingProject.projectId}-channel-product-001`,
    sourceObjectCode: `${ongoingProject.projectCode}-CP-001`,
    sourceTitle: `${ongoingProject.projectName} 抖音商城渠道商品`,
    sourceStatus: '待上架',
    businessDate: '2026-04-12 18:40',
    noteMeta: {
      channelCode: 'tiktok-shop',
      targetChannelCode: '抖音商城',
      storeId: 'store-tiktok-01',
      targetStoreId: '抖音商城旗舰店',
      listingTitle: `${ongoingProject.projectName} 首轮测款款`,
      listingPrice: 199,
      currency: 'CNY',
      channelProductId: `${ongoingProject.projectId}-channel-product-001`,
      channelProductCode: `${ongoingProject.projectCode}-CP-001`,
      upstreamChannelProductCode: `${ongoingProject.projectCode}-CP-001-UP`,
      channelProductStatus: '待上架',
      upstreamSyncStatus: '无需更新',
      linkedStyleCode: '',
      invalidatedReason: '',
    },
  })
  updateProjectRecord(
    ongoingProject.projectId,
    {
      updatedAt: '2026-04-12 18:40',
      riskStatus: '正常',
      blockedFlag: false,
      blockedReason: '',
    },
    DEMO_OPERATOR,
  )
  syncProjectLifecycle(ongoingProject.projectId, DEMO_OPERATOR, '2026-04-12 18:40')

  const decisionProject = createProject(
    buildDemoDraft({
      projectName: '2026秋季礼服设计研发项目',
      styleType: '设计款',
      projectSourceType: '外部灵感',
      categoryName: '连衣裙',
      ownerName: '李娜',
      teamName: '设计研发组',
      brandName: 'Tendblank',
      styleCodeName: '3-Sweet Blouse-18-30设计上衣',
      styleTags: ['礼服', '名媛'],
      channels: ['tiktok-shop', 'wechat-mini-program'],
      remark: '已完成测款数据汇总，待负责人做结论判定。',
    }),
    DEMO_OPERATOR,
  ).project
  approveProjectInit(decisionProject.projectId, DEMO_OPERATOR)
  seedInlineRecordAndComplete(decisionProject.projectId, 'SAMPLE_ACQUIRE', {
    businessDate: '2026-04-09',
    note: '设计样衣已完成采购并入库。',
  })
  seedInlineRecordAndComplete(decisionProject.projectId, 'SAMPLE_INBOUND_CHECK', {
    businessDate: '2026-04-09',
    note: '样衣质检通过，进入设计评估。',
  })
  seedInlineRecordAndComplete(decisionProject.projectId, 'FEASIBILITY_REVIEW', {
    businessDate: '2026-04-10',
    note: '评估结论为可推进，建议保留设计亮点。',
  })
  seedInlineRecordAndComplete(decisionProject.projectId, 'SAMPLE_CONFIRM', {
    businessDate: '2026-04-10',
    note: '样衣确认通过，进入成本与定价阶段。',
  })
  seedInlineRecordAndComplete(decisionProject.projectId, 'SAMPLE_COST_REVIEW', {
    businessDate: '2026-04-11',
    note: '核价完成，成本可控。',
  })
  seedInlineRecordAndComplete(decisionProject.projectId, 'SAMPLE_PRICING', {
    businessDate: '2026-04-11',
    note: '建议以 299 元作为首轮测款定价。',
  })
  seedNodeStatus(decisionProject.projectId, 'CHANNEL_PRODUCT_LISTING', {
    currentStatus: '已完成',
    validInstanceCount: 1,
    latestInstanceId: `${decisionProject.projectId}-listing-001`,
    latestInstanceCode: `${decisionProject.projectCode}-CP-001`,
    latestResultType: '上架完成',
    latestResultText: '已完成渠道上架并生成上游编码。',
    pendingActionType: '已完成',
    pendingActionText: '节点已完成',
    updatedAt: '2026-04-11 16:40',
    lastEventType: '上架完成',
    lastEventTime: '2026-04-11 16:40',
  })
  seedNodeStatus(decisionProject.projectId, 'VIDEO_TEST', {
    currentStatus: '已完成',
    validInstanceCount: 2,
    latestResultType: '短视频测款完成',
    latestResultText: '已关联 2 条短视频测款事实。',
    pendingActionType: '已完成',
    pendingActionText: '节点已完成',
    updatedAt: '2026-04-12 11:10',
    lastEventType: '短视频测款完成',
    lastEventTime: '2026-04-12 11:10',
  })
  seedNodeStatus(decisionProject.projectId, 'LIVE_TEST', {
    currentStatus: '已完成',
    validInstanceCount: 1,
    latestResultType: '直播测款完成',
    latestResultText: '已完成 1 场直播测款。',
    pendingActionType: '已完成',
    pendingActionText: '节点已完成',
    updatedAt: '2026-04-12 13:20',
    lastEventType: '直播测款完成',
    lastEventTime: '2026-04-12 13:20',
  })
  seedNodeStatus(decisionProject.projectId, 'TEST_CONCLUSION', {
    currentStatus: '待确认',
    latestResultType: '待结论判定',
    latestResultText: '请确认测款结论：通过、调整、暂缓或淘汰。',
    pendingActionType: '结论判定',
    pendingActionText: '当前待确认：测款结论判定',
    updatedAt: '2026-04-12 21:30',
    lastEventType: '提交汇总',
    lastEventTime: '2026-04-12 21:30',
  })
  upsertDemoRelation({
    project: decisionProject,
    workItemTypeCode: 'CHANNEL_PRODUCT_LISTING',
    sourceModule: '渠道商品',
    sourceObjectType: '渠道商品',
    sourceObjectId: `${decisionProject.projectId}-channel-product-001`,
    sourceObjectCode: `${decisionProject.projectCode}-CP-001`,
    sourceTitle: `${decisionProject.projectName} 测款渠道商品`,
    sourceStatus: '已上架待测款',
    businessDate: '2026-04-11 16:40',
    noteMeta: {
      channelCode: 'tiktok-shop',
      targetChannelCode: '抖音商城',
      storeId: 'store-tiktok-01',
      targetStoreId: '抖音商城旗舰店',
      listingTitle: `${decisionProject.projectName} 礼服首测款`,
      listingPrice: 299,
      currency: 'CNY',
      channelProductId: `${decisionProject.projectId}-channel-product-001`,
      channelProductCode: `${decisionProject.projectCode}-CP-001`,
      upstreamChannelProductCode: `${decisionProject.projectCode}-CP-001-UP`,
      channelProductStatus: '已上架待测款',
      upstreamSyncStatus: '无需更新',
      linkedStyleCode: '',
      invalidatedReason: '',
    },
  })
  upsertDemoRelation({
    project: decisionProject,
    workItemTypeCode: 'VIDEO_TEST',
    sourceModule: '短视频',
    sourceObjectType: '短视频记录',
    sourceObjectId: `${decisionProject.projectId}-video-001`,
    sourceObjectCode: `${decisionProject.projectCode}-VIDEO-001`,
    sourceTitle: '礼服上身试穿短视频',
    sourceStatus: '已发布',
    businessDate: '2026-04-12 11:10',
    relationRole: '执行记录',
    noteMeta: {
      videoRecordId: `${decisionProject.projectId}-video-001`,
      videoRecordCode: `${decisionProject.projectCode}-VIDEO-001`,
      channelProductId: `${decisionProject.projectId}-channel-product-001`,
      channelProductCode: `${decisionProject.projectCode}-CP-001`,
      upstreamChannelProductCode: `${decisionProject.projectCode}-CP-001-UP`,
      videoChannel: '抖音 / 礼服测款号',
      exposureQty: 42600,
      clickQty: 2680,
      orderQty: 104,
      gmvAmount: 31096,
      videoResult: '礼服试穿内容收藏率高，点击转化表现稳定。',
    },
  })
  upsertDemoRelation({
    project: decisionProject,
    workItemTypeCode: 'LIVE_TEST',
    sourceModule: '直播',
    sourceObjectType: '直播商品明细',
    sourceObjectId: `${decisionProject.projectId}-live-001`,
    sourceObjectCode: `${decisionProject.projectCode}-LIVE-001`,
    sourceLineId: `${decisionProject.projectId}-live-line-001`,
    sourceLineCode: `${decisionProject.projectCode}-LIVE-LINE-001`,
    sourceTitle: '礼服专场直播测款',
    sourceStatus: '已结束',
    businessDate: '2026-04-12 13:20',
    relationRole: '执行记录',
    noteMeta: {
      liveSessionId: `${decisionProject.projectId}-live-001`,
      liveSessionCode: `${decisionProject.projectCode}-LIVE-001`,
      liveLineId: `${decisionProject.projectId}-live-line-001`,
      liveLineCode: `${decisionProject.projectCode}-LIVE-LINE-001`,
      channelProductId: `${decisionProject.projectId}-channel-product-001`,
      channelProductCode: `${decisionProject.projectCode}-CP-001`,
      upstreamChannelProductCode: `${decisionProject.projectCode}-CP-001-UP`,
      exposureQty: 38200,
      clickQty: 1640,
      orderQty: 88,
      gmvAmount: 26312,
      liveResult: '直播试穿讲解有效，成交集中在主推尺码。',
    },
  })
  seedInlineRecordAndComplete(decisionProject.projectId, 'TEST_DATA_SUMMARY', {
    businessDate: '2026-04-12',
    note: '直播与短视频汇总后，点击率和转化率均高于同类款式。',
  })
  updateProjectRecord(
    decisionProject.projectId,
    {
      updatedAt: '2026-04-12 21:30',
      riskStatus: '延期',
      riskReason: '测款结论已停留 3 天未判定，渠道商品仍处于待测款状态。',
      riskWorkItem: '测款结论判定',
      riskDurationDays: 3,
    },
    DEMO_OPERATOR,
  )
  syncProjectLifecycle(decisionProject.projectId, DEMO_OPERATOR, '2026-04-12 21:30')

  const terminatedProject = createProject(
    buildDemoDraft({
      projectName: '2026秋季衬衫改版修订项目',
      styleType: '改版款',
      projectSourceType: '历史复用',
      categoryName: '上衣',
      ownerName: '赵云',
      teamName: '工程打样组',
      brandName: 'Asaya',
      styleCodeName: '4-Short Sleeve Top-18-35短袖上衣',
      styleTags: ['复古', '修订'],
      channels: ['shopee'],
      remark: '因测款表现不足终止项目。',
    }),
    DEMO_OPERATOR,
  ).project
  approveProjectInit(terminatedProject.projectId, DEMO_OPERATOR)
  seedInlineRecordAndComplete(terminatedProject.projectId, 'SAMPLE_ACQUIRE', {
    businessDate: '2026-04-07',
    note: '改版样衣已完成准备。',
  })
  seedInlineRecordAndComplete(terminatedProject.projectId, 'FEASIBILITY_REVIEW', {
    businessDate: '2026-04-07',
    note: '改版目标明确，但渠道预期一般。',
  })
  terminateProject(terminatedProject.projectId, '测款表现未达标，决定停止继续开发。', DEMO_OPERATOR, '2026-04-08 15:20')
  updateProjectRecord(
    terminatedProject.projectId,
    {
      updatedAt: '2026-04-08 15:20',
      riskStatus: '正常',
    },
    DEMO_OPERATOR,
  )
  syncProjectLifecycle(terminatedProject.projectId, DEMO_OPERATOR, '2026-04-08 15:20')

  const archivedProject = createProject(
    buildDemoDraft({
      projectName: '2026春季针织连衣裙归档项目',
      styleType: '基础款',
      projectSourceType: '测款沉淀',
      categoryName: '连衣裙',
      ownerName: '周芳',
      teamName: '商品企划组',
      brandName: 'Chicmore',
      styleCodeName: '1-Casul Shirt-18-30休闲衬衫',
      styleTags: ['名媛', '基础'],
      channels: ['tiktok-shop', 'wechat-mini-program'],
      remark: '已完成转档并进入资料归档。',
    }),
    DEMO_OPERATOR,
  ).project
  approveProjectInit(archivedProject.projectId, DEMO_OPERATOR)
  listProjectNodes(archivedProject.projectId).forEach((node) => {
    if (node.workItemTypeCode === 'PROJECT_INIT' || isClosedNodeStatus(node.currentStatus)) return
    markNodeCompletedAndUnlockNext(archivedProject.projectId, node.projectNodeId, {
      operatorName: DEMO_OPERATOR,
      timestamp: '2026-04-06 10:10',
      resultType: '节点完成',
      resultText: `${node.workItemTypeName}已完成归档前置处理。`,
    })
  })
  upsertDemoRelation({
    project: archivedProject,
    workItemTypeCode: 'CHANNEL_PRODUCT_LISTING',
    sourceModule: '渠道商品',
    sourceObjectType: '渠道商品',
    sourceObjectId: `${archivedProject.projectId}-channel-product-001`,
    sourceObjectCode: `${archivedProject.projectCode}-CP-001`,
    sourceTitle: `${archivedProject.projectName} 正式候选款`,
    sourceStatus: '已生效',
    businessDate: '2026-04-03 17:20',
    noteMeta: {
      channelCode: 'wechat-mini-program',
      targetChannelCode: '微信小程序',
      storeId: 'store-mini-program-01',
      targetStoreId: '微信小程序商城',
      listingTitle: `${archivedProject.projectName} 正式款`,
      listingPrice: 239,
      currency: 'CNY',
      channelProductId: `${archivedProject.projectId}-channel-product-001`,
      channelProductCode: `${archivedProject.projectCode}-CP-001`,
      upstreamChannelProductCode: `${archivedProject.projectCode}-CP-001-UP`,
      channelProductStatus: '已生效',
      upstreamSyncStatus: '已更新',
      linkedStyleCode: `SPU-${archivedProject.projectCode.split('-').slice(-1)[0]}`,
      invalidatedReason: '',
    },
  })
  upsertDemoRelation({
    project: archivedProject,
    workItemTypeCode: 'VIDEO_TEST',
    sourceModule: '短视频',
    sourceObjectType: '短视频记录',
    sourceObjectId: `${archivedProject.projectId}-video-001`,
    sourceObjectCode: `${archivedProject.projectCode}-VIDEO-001`,
    sourceTitle: '春季连衣裙短视频测款',
    sourceStatus: '已发布',
    businessDate: '2026-04-04 11:00',
    relationRole: '执行记录',
    noteMeta: {
      videoRecordId: `${archivedProject.projectId}-video-001`,
      videoRecordCode: `${archivedProject.projectCode}-VIDEO-001`,
      channelProductId: `${archivedProject.projectId}-channel-product-001`,
      channelProductCode: `${archivedProject.projectCode}-CP-001`,
      upstreamChannelProductCode: `${archivedProject.projectCode}-CP-001-UP`,
      videoChannel: '微信视频号 / 连衣裙测款号',
      exposureQty: 32800,
      clickQty: 1820,
      orderQty: 74,
      gmvAmount: 17686,
      videoResult: '内容完播率稳定，女性客群收藏转化较好。',
    },
  })
  upsertDemoRelation({
    project: archivedProject,
    workItemTypeCode: 'LIVE_TEST',
    sourceModule: '直播',
    sourceObjectType: '直播商品明细',
    sourceObjectId: `${archivedProject.projectId}-live-001`,
    sourceObjectCode: `${archivedProject.projectCode}-LIVE-001`,
    sourceLineId: `${archivedProject.projectId}-live-line-001`,
    sourceLineCode: `${archivedProject.projectCode}-LIVE-LINE-001`,
    sourceTitle: '春季连衣裙直播测款专场',
    sourceStatus: '已结束',
    businessDate: '2026-04-04 20:30',
    relationRole: '执行记录',
    noteMeta: {
      liveSessionId: `${archivedProject.projectId}-live-001`,
      liveSessionCode: `${archivedProject.projectCode}-LIVE-001`,
      liveLineId: `${archivedProject.projectId}-live-line-001`,
      liveLineCode: `${archivedProject.projectCode}-LIVE-LINE-001`,
      channelProductId: `${archivedProject.projectId}-channel-product-001`,
      channelProductCode: `${archivedProject.projectCode}-CP-001`,
      upstreamChannelProductCode: `${archivedProject.projectCode}-CP-001-UP`,
      exposureQty: 45200,
      clickQty: 2140,
      orderQty: 96,
      gmvAmount: 22944,
      liveResult: '直播连麦试穿后成交集中爆发，主推颜色卖断码。',
    },
  })
  upsertDemoRelation({
    project: archivedProject,
    workItemTypeCode: 'STYLE_ARCHIVE_CREATE',
    sourceModule: '款式档案',
    sourceObjectType: '款式档案',
    sourceObjectId: `${archivedProject.projectId}-style-001`,
    sourceObjectCode: `SPU-${archivedProject.projectCode.split('-').slice(-1)[0]}`,
    sourceTitle: '针织连衣裙款式档案',
    sourceStatus: '已启用',
    businessDate: '2026-04-05 09:20',
    noteMeta: {
      styleId: `${archivedProject.projectId}-style-001`,
      styleCode: `SPU-${archivedProject.projectCode.split('-').slice(-1)[0]}`,
      styleName: `${archivedProject.projectName} 款式档案`,
      archiveStatus: 'ACTIVE',
      linkedChannelProductCode: `${archivedProject.projectCode}-CP-001`,
      upstreamChannelProductCode: `${archivedProject.projectCode}-CP-001-UP`,
      linkedTechPackVersionCode: `TP-${archivedProject.projectCode.split('-').slice(-1)[0]}-V2`,
      linkedTechPackVersionStatus: 'PUBLISHED',
    },
  })
  upsertDemoRelation({
    project: archivedProject,
    workItemTypeCode: 'PROJECT_TRANSFER_PREP',
    sourceModule: '项目资料归档',
    sourceObjectType: '项目资料归档',
    sourceObjectId: `${archivedProject.projectId}-archive-001`,
    sourceObjectCode: `ARC-${archivedProject.projectCode.split('-').slice(-2).join('-')}`,
    sourceTitle: `${archivedProject.projectName} 项目资料归档`,
    sourceStatus: 'FINALIZED',
    businessDate: '2026-04-06 10:10',
    noteMeta: {
      linkedStyleCode: `SPU-${archivedProject.projectCode.split('-').slice(-1)[0]}`,
      linkedTechPackVersionCode: `TP-${archivedProject.projectCode.split('-').slice(-1)[0]}-V2`,
      linkedTechPackVersionStatus: 'PUBLISHED',
      projectArchiveNo: `ARC-${archivedProject.projectCode.split('-').slice(-2).join('-')}`,
      projectArchiveStatus: 'FINALIZED',
    },
  })

  ;[
    {
      projectName: '印尼风格碎花连衣裙测款项目',
      styleType: '快时尚款' as TemplateStyleType,
      projectSourceType: '测款沉淀' as PcsProjectCreateDraft['projectSourceType'],
      categoryName: '上衣',
      ownerName: '李娜',
      teamName: '快反开发组',
      brandName: 'Chicmore',
      styleCodeName: '2-prin shirt-18-30印花衬衫',
      styleTags: ['印花', '测款'],
      channels: ['tiktok-shop'],
      remark: '用于直播/短视频测款条目回跳商品项目。',
      timestamp: '2026-04-01 15:20',
    },
    {
      projectName: '波西米亚风印花半身裙测款项目',
      styleType: '设计款' as TemplateStyleType,
      projectSourceType: '测款沉淀' as PcsProjectCreateDraft['projectSourceType'],
      categoryName: '上衣',
      ownerName: '赵云',
      teamName: '设计研发组',
      brandName: 'FADFAD',
      styleCodeName: '2-prin shirt-18-30印花衬衫',
      styleTags: ['印花', '半裙'],
      channels: ['tiktok-shop'],
      remark: '用于直播/短视频测款条目回跳商品项目。',
      timestamp: '2026-04-01 15:10',
    },
    {
      projectName: '牛仔短裤夏季款测款项目',
      styleType: '基础款' as TemplateStyleType,
      projectSourceType: '测款沉淀' as PcsProjectCreateDraft['projectSourceType'],
      categoryName: '上衣',
      ownerName: '周芳',
      teamName: '商品企划组',
      brandName: 'Chicmore',
      styleCodeName: '1-Casul Shirt-18-30休闲衬衫',
      styleTags: ['牛仔', '夏季'],
      channels: ['tiktok-shop'],
      remark: '用于直播测款条目回跳商品项目。',
      timestamp: '2026-04-01 15:00',
    },
  ].forEach((seed) => {
    const project = createProject(
      buildDemoDraft({
        projectName: seed.projectName,
        styleType: seed.styleType,
        projectSourceType: seed.projectSourceType,
        categoryName: seed.categoryName,
        ownerName: seed.ownerName,
        teamName: seed.teamName,
        brandName: seed.brandName,
        styleCodeName: seed.styleCodeName,
        styleTags: seed.styleTags,
        channels: seed.channels,
        remark: seed.remark,
      }),
      DEMO_OPERATOR,
    ).project
    approveProjectInit(project.projectId, DEMO_OPERATOR)
    updateProjectRecord(
      project.projectId,
      {
        createdAt: seed.timestamp,
        updatedAt: seed.timestamp,
        remark: seed.remark,
        blockedFlag: false,
        blockedReason: '',
      },
      DEMO_OPERATOR,
    )
    seedNodeStatus(project.projectId, 'PROJECT_INIT', {
      updatedAt: seed.timestamp,
      latestResultType: '已完成',
      latestResultText: '测款项目已建立，可供直播与短视频记录关联。',
      lastEventType: '立项完成',
      lastEventTime: seed.timestamp,
    })
    syncProjectLifecycle(project.projectId, DEMO_OPERATOR, seed.timestamp)
  })
  upsertDemoRelation({
    project: archivedProject,
    workItemTypeCode: 'PATTERN_TASK',
    sourceModule: '制版任务',
    sourceObjectType: '制版任务',
    sourceObjectId: `${archivedProject.projectId}-pattern-001`,
    sourceObjectCode: `${archivedProject.projectCode}-PATTERN-001`,
    sourceTitle: '针织连衣裙 P1 制版任务',
    sourceStatus: '已完成',
    businessDate: '2026-04-05 15:30',
    noteMeta: {
      patternBrief: '完成版型结构确认并输出首轮纸样。',
      productStyleCode: `SPU-${archivedProject.projectCode.split('-').slice(-1)[0]}`,
      sizeRange: 'S-L',
      patternVersion: 'P1',
    },
  })
  upsertDemoRelation({
    project: archivedProject,
    workItemTypeCode: 'FIRST_SAMPLE',
    sourceModule: '首版样衣打样',
    sourceObjectType: '首版样衣打样任务',
    sourceObjectId: `${archivedProject.projectId}-first-sample-001`,
    sourceObjectCode: `${archivedProject.projectCode}-FS-001`,
    sourceTitle: '针织连衣裙首版样衣打样',
    sourceStatus: '已完成',
    businessDate: '2026-04-05 18:40',
    noteMeta: {
      factoryId: 'FAC-GZ-001',
      factoryName: '广州一厂',
      targetSite: '广州',
      expectedArrival: '2026-04-08',
      trackingNo: `${archivedProject.projectCode}-SF001`,
      sampleCode: `${archivedProject.projectCode}-Y001`,
    },
  })
  seedInlineRecord(archivedProject.projectId, 'SAMPLE_ACQUIRE', {
    businessDate: '2026-04-01',
    note: '样衣来源已锁定为外采，供应商交付稳定。',
  })
  seedInlineRecord(archivedProject.projectId, 'SAMPLE_INBOUND_CHECK', {
    businessDate: '2026-04-01',
    note: '到样核对完成，样衣状态良好。',
  })
  seedInlineRecord(archivedProject.projectId, 'FEASIBILITY_REVIEW', {
    businessDate: '2026-04-02',
    note: '版型与渠道适配性良好，建议进入正式测款。',
  })
  seedInlineRecord(archivedProject.projectId, 'SAMPLE_SHOOT_FIT', {
    businessDate: '2026-04-02',
    note: '拍摄和试穿反馈积极，主推尺码呈现稳定。',
  })
  seedInlineRecord(archivedProject.projectId, 'SAMPLE_CONFIRM', {
    businessDate: '2026-04-02',
    note: '样衣确认通过，可进入市场测款。',
  })
  seedInlineRecord(archivedProject.projectId, 'SAMPLE_COST_REVIEW', {
    businessDate: '2026-04-03',
    note: '核价通过，成本满足目标毛利率。',
  })
  seedInlineRecord(archivedProject.projectId, 'SAMPLE_PRICING', {
    businessDate: '2026-04-03',
    note: '定价口径确认，以 239 元进入正式测款。',
  })
  seedInlineRecord(archivedProject.projectId, 'TEST_DATA_SUMMARY', {
    businessDate: '2026-04-04',
    note: '双渠道测款结果稳定，转化率和复购意向均达到归档标准。',
  })
  seedInlineRecord(archivedProject.projectId, 'TEST_CONCLUSION', {
    businessDate: '2026-04-04',
    note: '测款通过，进入款式档案与转档准备阶段。',
  })
  seedInlineRecord(archivedProject.projectId, 'SAMPLE_RETAIN_REVIEW', {
    businessDate: '2026-04-06',
    note: '保留主推色样衣供后续复盘与素材使用。',
  })
  seedInlineRecord(archivedProject.projectId, 'SAMPLE_RETURN_HANDLE', {
    businessDate: '2026-04-06',
    note: '非主推色样衣已完成退回处理。',
  })
  updateProjectRecord(
    archivedProject.projectId,
    {
      projectStatus: '已归档',
      updatedAt: '2026-04-06 10:10',
      linkedStyleId: `${archivedProject.projectId}-style-001`,
      linkedStyleCode: `SPU-${archivedProject.projectCode.split('-').slice(-1)[0]}`,
      linkedStyleName: `${archivedProject.projectName} 款式档案`,
      linkedStyleGeneratedAt: '2026-04-05 09:20',
      linkedTechPackVersionId: `${archivedProject.projectId}-techpack-002`,
      linkedTechPackVersionCode: `TP-${archivedProject.projectCode.split('-').slice(-1)[0]}-V2`,
      linkedTechPackVersionLabel: 'V2',
      linkedTechPackVersionStatus: 'PUBLISHED',
      linkedTechPackVersionPublishedAt: '2026-04-05 14:10',
      projectArchiveId: `${archivedProject.projectId}-archive-001`,
      projectArchiveStatus: '已归档',
      projectArchiveNo: `ARC-${archivedProject.projectCode.split('-').slice(-2).join('-')}`,
      projectArchiveDocumentCount: 6,
      projectArchiveFileCount: 14,
      projectArchiveMissingItemCount: 0,
      projectArchiveUpdatedAt: '2026-04-06 10:10',
      projectArchiveFinalizedAt: '2026-04-06 10:10',
    },
    DEMO_OPERATOR,
  )
  syncProjectLifecycle(archivedProject.projectId, DEMO_OPERATOR, '2026-04-06 10:10')

  projectDemoSeedReady = true
}

export function ensurePcsProjectDemoDataReady(): void {
  ensureProjectDemoData()
}

function isNodeUnlocked(project: PcsProjectRecord, orderedNodes: PcsProjectNodeRecord[], node: PcsProjectNodeRecord): boolean {
  if (project.projectStatus === '待审核') {
    return node.workItemTypeCode === 'PROJECT_INIT'
  }
  if (project.blockedFlag && project.projectStatus !== '待审核') {
    const blockerIndex = orderedNodes.findIndex((item) => item.workItemTypeName === project.riskWorkItem)
    const nodeIndex = orderedNodes.findIndex((item) => item.projectNodeId === node.projectNodeId)
    if (blockerIndex >= 0 && nodeIndex > blockerIndex && node.currentStatus === '未开始') {
      return false
    }
  }
  const nodeIndex = orderedNodes.findIndex((item) => item.projectNodeId === node.projectNodeId)
  if (nodeIndex <= 0) return true
  return orderedNodes.slice(0, nodeIndex).every((item) => !item.requiredFlag || isClosedNodeStatus(item.currentStatus))
}

function getNodeDisplayStatus(project: PcsProjectRecord, orderedNodes: PcsProjectNodeRecord[], node: PcsProjectNodeRecord): ProjectNodeStatus | '未解锁' {
  if (node.currentStatus === '未开始' && !isNodeUnlocked(project, orderedNodes, node)) {
    return '未解锁'
  }
  return node.currentStatus
}

function buildProjectLogs(project: PcsProjectRecord): ProjectLogItem[] {
  const logs: ProjectLogItem[] = [
    {
      time: project.createdAt,
      title: '创建商品项目',
      detail: `${project.projectName} 已创建，负责人为 ${project.ownerName}。`,
      tone: 'blue',
    },
  ]

  listProjectNodes(project.projectId).forEach((node) => {
    if (!(node.lastEventTime || node.updatedAt)) return
    logs.push({
      time: node.lastEventTime || node.updatedAt || project.updatedAt,
      title: `${node.workItemTypeName}：${node.lastEventType || node.currentStatus}`,
      detail: node.latestResultText || node.pendingActionText || '已更新项目节点状态。',
      tone: node.currentStatus === '已完成' ? 'emerald' : node.currentStatus === '待确认' ? 'amber' : 'slate',
    })
  })

  listProjectInlineNodeRecordsByProject(project.projectId).forEach((record) => {
    logs.push({
      time: record.updatedAt,
      title: `${record.workItemTypeName}记录已更新`,
      detail: `${record.recordCode} · ${record.recordStatus}`,
      tone: 'blue',
    })
  })

  listProjectRelationsByProject(project.projectId).forEach((relation) => {
    logs.push({
      time: relation.updatedAt,
      title: `${relation.workItemTypeName}已关联${relation.sourceObjectType}`,
      detail: `${relation.sourceTitle} · ${relation.sourceStatus || relation.relationRole}`,
      tone: 'slate',
    })
  })

  if (project.projectStatus === '已终止') {
    logs.push({
      time: project.updatedAt,
      title: '项目已终止',
      detail: project.blockedReason || '项目已停止推进。',
      tone: 'rose',
    })
  }

  if (project.projectStatus === '已归档') {
    logs.push({
      time: project.updatedAt,
      title: '项目已归档',
      detail: project.projectArchiveNo ? `归档编号：${project.projectArchiveNo}` : '已完成资料归档。',
      tone: 'emerald',
    })
  }

  return logs
    .sort((left, right) => right.time.localeCompare(left.time))
    .slice(0, 12)
}

function buildProjectViewModel(projectId: string): ProjectViewModel | null {
  const project = getProjectById(projectId)
  if (!project) return null

  const phases = listProjectPhases(projectId)
  const nodes = listProjectNodes(projectId)
  const nodeViewModels = nodes.map((node) => ({
    node,
    contract: getProjectWorkItemContract(node.workItemTypeCode as PcsProjectWorkItemCode),
    definition: getPcsWorkItemDefinition(node.workItemId),
    records: listProjectInlineNodeRecordsByNode(node.projectNodeId),
    latestRecord: getLatestProjectInlineNodeRecord(node.projectNodeId),
    relations: listProjectRelationsByProjectNode(projectId, node.projectNodeId),
    unlocked: isNodeUnlocked(project, nodes, node),
    displayStatus: getNodeDisplayStatus(project, nodes, node),
  }))

  const currentNode =
    nodeViewModels.find((item) => item.node.currentStatus === '进行中' || item.node.currentStatus === '待确认') ??
    nodeViewModels.find((item) => !isClosedNodeStatus(item.node.currentStatus) && item.unlocked) ??
    nodeViewModels[0] ??
    null
  const currentPhaseCode = currentNode?.node.phaseCode ?? project.currentPhaseCode

  const phaseViewModels = phases.map((phase) => {
    const phaseNodes = nodeViewModels.filter((item) => item.node.phaseCode === phase.phaseCode)
    let derivedStatus: PcsProjectPhaseRecord['phaseStatus'] = '未开始'
    if (project.projectStatus === '已终止' && phaseNodes.some((item) => !isClosedNodeStatus(item.node.currentStatus))) {
      derivedStatus = '已终止'
    } else if (phaseNodes.length > 0 && phaseNodes.every((item) => isClosedNodeStatus(item.node.currentStatus))) {
      derivedStatus = '已完成'
    } else if (
      phase.phaseCode === currentPhaseCode ||
      phaseNodes.some((item) => item.node.currentStatus === '进行中' || item.node.currentStatus === '待确认')
    ) {
      derivedStatus = '进行中'
    }

    return {
      phase,
      nodes: phaseNodes,
      derivedStatus,
      completedCount: phaseNodes.filter((item) => item.node.currentStatus === '已完成').length,
      totalCount: phaseNodes.length,
      pendingDecision: phaseNodes.some((item) => item.node.currentStatus === '待确认'),
      current: phase.phaseCode === currentPhaseCode,
    }
  })

  return {
    project,
    phases: phaseViewModels,
    nodes: nodeViewModels,
    currentPhase: phaseViewModels.find((item) => item.phase.phaseCode === currentPhaseCode) ?? phaseViewModels[0] ?? null,
    currentNode,
    nextNode:
      nodeViewModels.find((item) => !isClosedNodeStatus(item.node.currentStatus) && item.unlocked) ??
      nodeViewModels.find((item) => !isClosedNodeStatus(item.node.currentStatus)) ??
      null,
    pendingDecisionNode: nodeViewModels.find((item) => item.node.currentStatus === '待确认') ?? null,
    progressDone: nodeViewModels.filter((item) => item.node.currentStatus === '已完成').length,
    progressTotal: nodeViewModels.length,
    channelNames: getChannelNamesByCodes(project.targetChannelCodes),
    logs: buildProjectLogs(project),
  }
}

function getFilteredProjectViewModels(): ProjectViewModel[] {
  ensureProjectDemoData()
  const keyword = state.list.search.trim().toLowerCase()
  const owner = state.list.owner
  const phase = state.list.phase
  const now = Date.now()

  const matchesDateRange = (project: PcsProjectRecord): boolean => {
    if (state.list.dateRange === '全部时间') return true
    const projectTime = parseDateValue(project.updatedAt)
    if (!projectTime) return false
    if (state.list.dateRange === '今天') {
      return project.updatedAt.slice(0, 10) === todayText()
    }
    if (state.list.dateRange === '最近一周') {
      return now - projectTime <= 7 * 24 * 60 * 60 * 1000
    }
    return now - projectTime <= 30 * 24 * 60 * 60 * 1000
  }

  const items = listProjects()
    .map((project) => buildProjectViewModel(project.projectId))
    .filter((item): item is ProjectViewModel => Boolean(item))
    .filter((item) => {
      const { project } = item
      const matchesKeyword =
        keyword.length === 0 ||
        [
          project.projectName,
          project.projectCode,
          project.categoryName,
          project.subCategoryName,
          project.ownerName,
          project.currentPhaseName,
          project.styleType,
          project.styleTagNames.join(' '),
        ]
          .join(' ')
          .toLowerCase()
          .includes(keyword)

      const matchesStyleType = state.list.styleType === '全部' || project.styleType === state.list.styleType
      const matchesStatus = state.list.status === '全部' || project.projectStatus === state.list.status
      const matchesOwner = owner === '全部负责人' || project.ownerName === owner
      const matchesPhase = phase === '全部阶段' || item.currentPhase?.phase.phaseName === phase
      const riskLabel = project.riskStatus === '延期' ? '延期' : '正常'
      const matchesRisk = state.list.riskStatus === '全部' || riskLabel === state.list.riskStatus
      const matchesPendingDecision = !state.list.pendingDecisionOnly || Boolean(item.pendingDecisionNode)
      return (
        matchesKeyword &&
        matchesStyleType &&
        matchesStatus &&
        matchesOwner &&
        matchesPhase &&
        matchesRisk &&
        matchesPendingDecision &&
        matchesDateRange(project)
      )
    })

  return items.sort((left, right) => {
    if (state.list.sortBy === 'pendingDecision') {
      const decisionDiff = Number(Boolean(right.pendingDecisionNode)) - Number(Boolean(left.pendingDecisionNode))
      if (decisionDiff !== 0) return decisionDiff
    }
    if (state.list.sortBy === 'risk') {
      const riskDiff = Number(right.project.riskStatus === '延期') - Number(left.project.riskStatus === '延期')
      if (riskDiff !== 0) return riskDiff
    }
    if (state.list.sortBy === 'progressLow') {
      const leftProgress = left.progressTotal === 0 ? 1 : left.progressDone / left.progressTotal
      const rightProgress = right.progressTotal === 0 ? 1 : right.progressDone / right.progressTotal
      if (leftProgress !== rightProgress) return leftProgress - rightProgress
    }
    return right.project.updatedAt.localeCompare(left.project.updatedAt)
  })
}

function getPagedProjects() {
  const filtered = getFilteredProjectViewModels()
  const totalPages = Math.max(1, Math.ceil(filtered.length / state.list.pageSize))
  if (state.list.currentPage > totalPages) state.list.currentPage = totalPages
  if (state.list.currentPage < 1) state.list.currentPage = 1
  const startIndex = (state.list.currentPage - 1) * state.list.pageSize
  return {
    filtered,
    totalPages,
    paged: filtered.slice(startIndex, startIndex + state.list.pageSize),
  }
}

function ensureCreateState(): void {
  if (state.create.routeKey === 'create') return
  const catalog = getProjectCreateCatalog()
  const defaultStyleType: TemplateStyleType = '基础款'
  const template = getTemplateByStyleType(defaultStyleType)
  const category = catalog.categories[0]
  const child = category?.children[0]
  const owner = catalog.owners[0]
  const team = catalog.teams[0]
  const brand = catalog.brands[0]
  const styleCode = catalog.styleCodes[0]

  state.create = {
    routeKey: 'create',
    error: null,
    draft: {
      ...createEmptyProjectDraft(),
      projectType: getProjectTypeLabel(defaultStyleType),
      projectSourceType: catalog.projectSourceTypes[0] ?? '',
      templateId: template?.id ?? '',
      styleType: defaultStyleType,
      categoryId: category?.id ?? '',
      categoryName: category?.name ?? '',
      subCategoryId: child?.id ?? '',
      subCategoryName: child?.name ?? '',
      brandId: brand?.id ?? '',
      brandName: brand?.name ?? '',
      styleCodeId: styleCode?.id ?? '',
      styleCodeName: styleCode?.name ?? '',
      styleNumber: styleCode?.name ?? '',
      priceRangeLabel: catalog.priceRanges[1] ?? '',
      targetChannelCodes: catalog.channelOptions.slice(0, 2).map((item) => item.code),
      ownerId: owner?.id ?? '',
      ownerName: owner?.name ?? '',
      teamId: team?.id ?? '',
      teamName: team?.name ?? '',
      priorityLevel: '中',
      yearTag: '2026',
    },
  }
}

function hasCreateDraftChanges(): boolean {
  const draft = state.create.draft
  return Boolean(
    draft.projectName.trim() ||
      draft.remark.trim() ||
      draft.styleTagNames.length > 0 ||
      draft.targetChannelCodes.length !== 2 ||
      draft.styleType !== '基础款',
  )
}

function ensureDetailState(projectId: string): void {
  const routeKey = `detail:${projectId}`
  if (state.detail.routeKey === routeKey) return
  const viewModel = buildProjectViewModel(projectId)
  const selectedNodeId = viewModel?.currentNode?.node.projectNodeId ?? viewModel?.nodes[0]?.node.projectNodeId ?? null
  state.detail = {
    routeKey,
    projectId,
    selectedNodeId,
    expandedPhases: Object.fromEntries((viewModel?.phases ?? []).map((item) => [item.phase.phaseCode, true])),
  }
}

function normalizeWorkItemTab(value: string | null): WorkItemTabKey {
  return WORK_ITEM_TAB_OPTIONS.find((item) => item.key === value)?.key ?? 'full-info'
}

function ensureWorkItemState(projectId: string, projectNodeId: string): void {
  const queryParams = getCurrentQueryParams()
  const routeKey = `work-item:${projectId}:${projectNodeId}:${queryParams.toString()}`
  if (state.workItem.routeKey === routeKey) return
  state.workItem = {
    routeKey,
    projectId,
    projectNodeId,
    activeTab: normalizeWorkItemTab(queryParams.get('tab')),
  }
}

function getSelectedDetailNode(viewModel: ProjectViewModel): ProjectNodeViewModel | null {
  const selected = viewModel.nodes.find((item) => item.node.projectNodeId === state.detail.selectedNodeId)
  return selected ?? viewModel.currentNode ?? viewModel.nodes[0] ?? null
}

function getProjectStatusBadgeClass(status: PcsProjectRecord['projectStatus']): string {
  if (status === '待审核') return 'bg-amber-100 text-amber-700'
  if (status === '已立项') return 'bg-blue-100 text-blue-700'
  if (status === '进行中') return 'bg-emerald-100 text-emerald-700'
  if (status === '已终止') return 'bg-rose-100 text-rose-700'
  return 'bg-slate-100 text-slate-600'
}

function getStyleTypeBadgeClass(styleType: TemplateStyleType): string {
  if (styleType === '快时尚款') return 'border-blue-200 bg-blue-50 text-blue-700'
  if (styleType === '改版款') return 'border-amber-200 bg-amber-50 text-amber-700'
  if (styleType === '设计款') return 'border-violet-200 bg-violet-50 text-violet-700'
  return 'border-emerald-200 bg-emerald-50 text-emerald-700'
}

function getNodeStatusBadgeClass(status: ProjectNodeStatus | '未解锁'): string {
  if (status === '已完成') return 'bg-emerald-100 text-emerald-700'
  if (status === '进行中') return 'bg-blue-100 text-blue-700'
  if (status === '待确认') return 'bg-amber-100 text-amber-700'
  if (status === '已取消') return 'bg-rose-100 text-rose-700'
  if (status === '未解锁') return 'bg-slate-100 text-slate-500'
  return 'bg-slate-100 text-slate-600'
}

function getNatureBadgeClass(nature: string): string {
  if (nature === '决策类') return 'border-amber-200 bg-amber-50 text-amber-700'
  if (nature === '执行类') return 'border-blue-200 bg-blue-50 text-blue-700'
  if (nature === '里程碑类') return 'border-violet-200 bg-violet-50 text-violet-700'
  return 'border-emerald-200 bg-emerald-50 text-emerald-700'
}

function getRiskText(project: PcsProjectRecord): string {
  return project.riskStatus === '延期' ? '延期' : '正常'
}

function getLogToneClass(tone: ProjectLogItem['tone']): string {
  if (tone === 'emerald') return 'bg-emerald-100 text-emerald-700'
  if (tone === 'amber') return 'bg-amber-100 text-amber-700'
  if (tone === 'rose') return 'bg-rose-100 text-rose-700'
  if (tone === 'blue') return 'bg-blue-100 text-blue-700'
  return 'bg-slate-100 text-slate-600'
}

function getNodeStatusIcon(status: ProjectNodeStatus | '未解锁'): string {
  if (status === '已完成') return 'check-circle-2'
  if (status === '进行中') return 'play-circle'
  if (status === '待确认') return 'alert-circle'
  if (status === '已取消') return 'x-circle'
  if (status === '未解锁') return 'lock'
  return 'clock-3'
}

function renderProjectProgress(project: ProjectViewModel): string {
  const percent = project.progressTotal === 0 ? 0 : Math.round((project.progressDone / project.progressTotal) * 100)
  return `
    <div class="space-y-1">
      <div class="flex items-center gap-2">
        <div class="h-2 w-24 rounded-full bg-slate-100">
          <div class="h-2 rounded-full bg-blue-600" style="width:${percent}%"></div>
        </div>
        <span class="text-xs text-slate-500">${project.progressDone}/${project.progressTotal}</span>
      </div>
      ${
        project.nextNode
          ? `<p class="text-xs text-slate-500">下一步：${escapeHtml(project.nextNode.node.workItemTypeName)}（${escapeHtml(project.nextNode.displayStatus)}）</p>`
          : '<p class="text-xs text-slate-500">已完成全部节点</p>'
      }
    </div>
  `
}

function renderPagination(totalPages: number): string {
  if (totalPages <= 1) return ''
  const pages = new Set<number>([1, totalPages, state.list.currentPage, state.list.currentPage - 1, state.list.currentPage + 1])
  const visiblePages = Array.from(pages).filter((item) => item >= 1 && item <= totalPages).sort((a, b) => a - b)
  return `
    <div class="flex items-center justify-between border-t bg-white px-4 py-3">
      <p class="text-xs text-slate-500">第 ${state.list.currentPage} / ${totalPages} 页</p>
      <div class="flex items-center gap-2">
        <button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50 ${state.list.currentPage === 1 ? 'cursor-not-allowed opacity-50' : ''}" data-pcs-project-action="set-page" data-page="${state.list.currentPage - 1}" ${state.list.currentPage === 1 ? 'disabled' : ''}>上一页</button>
        ${visiblePages
          .map(
            (page) => `
              <button type="button" class="${toClassName(
                'inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-xs',
                page === state.list.currentPage
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
              )}" data-pcs-project-action="set-page" data-page="${page}">${page}</button>
            `,
          )
          .join('')}
        <button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50 ${state.list.currentPage === totalPages ? 'cursor-not-allowed opacity-50' : ''}" data-pcs-project-action="set-page" data-page="${state.list.currentPage + 1}" ${state.list.currentPage === totalPages ? 'disabled' : ''}>下一页</button>
      </div>
    </div>
  `
}

function renderListToolbar(filteredCount: number): string {
  const ownerOptions = ['全部负责人', ...getProjectCreateCatalog().owners.map((item) => item.name)]
  const phaseOptions = ['全部阶段', ...Array.from(new Set(getFilteredProjectViewModels().map((item) => item.currentPhase?.phase.phaseName || '-')))]
  return `
    <section class="rounded-lg border bg-white p-4">
      <div class="grid gap-3 xl:grid-cols-[minmax(240px,1.5fr)_160px_auto_auto]">
        <label class="space-y-1">
          <span class="text-xs text-slate-500">搜索项目</span>
          <input class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="搜索项目名称、编码或关键词" value="${escapeHtml(state.list.search)}" data-pcs-project-field="list-search" />
        </label>
        <label class="space-y-1">
          <span class="text-xs text-slate-500">排序方式</span>
          <select class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" data-pcs-project-field="list-sort">
            <option value="updatedAt" ${state.list.sortBy === 'updatedAt' ? 'selected' : ''}>最近更新</option>
            <option value="pendingDecision" ${state.list.sortBy === 'pendingDecision' ? 'selected' : ''}>待决策优先</option>
            <option value="risk" ${state.list.sortBy === 'risk' ? 'selected' : ''}>风险优先</option>
            <option value="progressLow" ${state.list.sortBy === 'progressLow' ? 'selected' : ''}>进度最低优先</option>
          </select>
        </label>
        <div class="flex items-end gap-2">
          <button type="button" class="inline-flex h-10 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-pcs-project-action="query">查询</button>
          <button type="button" class="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50" data-pcs-project-action="reset-list">重置筛选</button>
        </div>
        <div class="flex items-end justify-end gap-2">
          <button type="button" class="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50" data-pcs-project-action="toggle-advanced">${state.list.advancedOpen ? '收起高级筛选' : '高级筛选'}</button>
        </div>
      </div>
      <div class="mt-4 flex flex-wrap items-center gap-4">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-xs text-slate-500">款式类型</span>
          ${STYLE_TYPE_OPTIONS.map(
            (option) => `
              <button type="button" class="${toClassName(
                'inline-flex h-8 items-center rounded-md px-3 text-xs',
                state.list.styleType === option ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              )}" data-pcs-project-action="set-style-filter" data-value="${escapeHtml(option)}">${escapeHtml(option)}</button>
            `,
          ).join('')}
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-xs text-slate-500">状态</span>
          ${PROJECT_STATUS_OPTIONS.map(
            (option) => `
              <button type="button" class="${toClassName(
                'inline-flex h-8 items-center rounded-md px-3 text-xs',
                state.list.status === option ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              )}" data-pcs-project-action="set-status-filter" data-value="${escapeHtml(option)}">${escapeHtml(option)}</button>
            `,
          ).join('')}
        </div>
        <button type="button" class="${toClassName(
          'inline-flex h-8 items-center rounded-md px-3 text-xs',
          state.list.pendingDecisionOnly ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
        )}" data-pcs-project-action="toggle-pending-decision">待决策</button>
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-xs text-slate-500">风险</span>
          ${RISK_STATUS_OPTIONS.map(
            (option) => `
              <button type="button" class="${toClassName(
                'inline-flex h-8 items-center rounded-md px-3 text-xs',
                state.list.riskStatus === option ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              )}" data-pcs-project-action="set-risk-filter" data-value="${escapeHtml(option)}">${escapeHtml(option)}</button>
            `,
          ).join('')}
        </div>
      </div>
      ${
        state.list.advancedOpen
          ? `
            <div class="mt-4 grid gap-3 border-t border-slate-200 pt-4 md:grid-cols-3">
              <label class="space-y-1">
                <span class="text-xs text-slate-500">负责人</span>
                <select class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" data-pcs-project-field="list-owner">
                  ${ownerOptions
                    .map(
                      (option) =>
                        `<option value="${escapeHtml(option)}" ${state.list.owner === option ? 'selected' : ''}>${escapeHtml(option)}</option>`,
                    )
                    .join('')}
                </select>
              </label>
              <label class="space-y-1">
                <span class="text-xs text-slate-500">当前阶段</span>
                <select class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" data-pcs-project-field="list-phase">
                  ${phaseOptions
                    .map(
                      (option) =>
                        `<option value="${escapeHtml(option)}" ${state.list.phase === option ? 'selected' : ''}>${escapeHtml(option)}</option>`,
                    )
                    .join('')}
                </select>
              </label>
              <label class="space-y-1">
                <span class="text-xs text-slate-500">最近更新范围</span>
                <select class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" data-pcs-project-field="list-date-range">
                  ${DATE_RANGE_OPTIONS.map(
                    (option) =>
                      `<option value="${escapeHtml(option)}" ${state.list.dateRange === option ? 'selected' : ''}>${escapeHtml(option)}</option>`,
                  ).join('')}
                </select>
              </label>
            </div>
          `
          : ''
      }
      <div class="mt-4 flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
        <p class="text-sm text-slate-500">共 ${filteredCount} 个项目</p>
        <div class="inline-flex items-center rounded-md bg-slate-100 p-1">
          <button type="button" class="${toClassName('inline-flex h-7 items-center rounded-md px-2 text-xs', state.list.viewMode === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500')}" data-pcs-project-action="set-view-mode" data-value="list">列表</button>
          <button type="button" class="${toClassName('inline-flex h-7 items-center rounded-md px-2 text-xs', state.list.viewMode === 'grid' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500')}" data-pcs-project-action="set-view-mode" data-value="grid">卡片</button>
        </div>
      </div>
    </section>
  `
}

function renderProjectListTable(projects: ProjectViewModel[], totalPages: number): string {
  return `
    <section class="overflow-hidden rounded-lg border bg-white">
      <div class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead class="bg-slate-50">
            <tr class="border-b border-slate-200 text-left text-slate-600">
              <th class="px-4 py-3 font-medium">操作</th>
              <th class="px-4 py-3 font-medium min-w-[260px]">项目名称</th>
              <th class="px-4 py-3 font-medium">项目编码</th>
              <th class="px-4 py-3 font-medium">款式类型</th>
              <th class="px-4 py-3 font-medium">分类</th>
              <th class="px-4 py-3 font-medium">风格</th>
              <th class="px-4 py-3 font-medium">当前阶段</th>
              <th class="px-4 py-3 font-medium min-w-[180px]">项目进度</th>
              <th class="px-4 py-3 font-medium">风险</th>
              <th class="px-4 py-3 font-medium">负责人</th>
              <th class="px-4 py-3 font-medium">最近更新</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200">
            ${
              projects.length === 0
                ? `
                  <tr>
                    <td colspan="11" class="px-4 py-16 text-center">
                      <p class="text-sm font-medium text-slate-700">暂无符合条件的商品项目</p>
                      <p class="mt-1 text-xs text-slate-500">可以调整筛选条件，或直接创建一个新的商品项目。</p>
                      <button type="button" class="mt-4 inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-nav="/pcs/projects/create">新建商品项目</button>
                    </td>
                  </tr>
                `
                : projects
                    .map(
                      (item) => `
                        <tr class="align-top hover:bg-slate-50">
                          <td class="px-4 py-3">
                            <div class="flex flex-wrap gap-2">
                              <button type="button" class="inline-flex h-7 items-center rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-700 hover:bg-slate-50" data-nav="/pcs/projects/${escapeHtml(item.project.projectId)}">查看</button>
                              <button type="button" class="inline-flex h-7 items-center rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-700 hover:bg-slate-50" data-pcs-project-action="open-terminate" data-project-id="${escapeHtml(item.project.projectId)}">终止</button>
                              <button type="button" class="inline-flex h-7 items-center rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-700 hover:bg-slate-50" data-pcs-project-action="archive-project" data-project-id="${escapeHtml(item.project.projectId)}">归档</button>
                            </div>
                          </td>
                          <td class="px-4 py-3">
                            <button type="button" class="text-left font-medium text-blue-700 hover:underline" data-nav="/pcs/projects/${escapeHtml(item.project.projectId)}">${escapeHtml(item.project.projectName)}</button>
                            <div class="mt-1 flex flex-wrap items-center gap-2 text-xs">
                              <span class="inline-flex rounded-full px-2 py-0.5 ${getProjectStatusBadgeClass(item.project.projectStatus)}">${escapeHtml(item.project.projectStatus)}</span>
                              ${item.pendingDecisionNode ? '<span class="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">待决策</span>' : ''}
                            </div>
                          </td>
                          <td class="px-4 py-3 text-slate-500">${escapeHtml(item.project.projectCode)}</td>
                          <td class="px-4 py-3"><span class="inline-flex rounded-full border px-2 py-0.5 text-xs ${getStyleTypeBadgeClass(item.project.styleType)}">${escapeHtml(item.project.styleType)}</span></td>
                          <td class="px-4 py-3">
                            <p class="text-slate-700">${escapeHtml(item.project.categoryName)}</p>
                            <p class="mt-1 text-xs text-slate-400">${escapeHtml(item.project.subCategoryName || '-')}</p>
                          </td>
                          <td class="px-4 py-3">
                            <div class="flex flex-wrap gap-1">
                              ${item.project.styleTagNames.length > 0 ? item.project.styleTagNames.map((tag) => `<span class="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">${escapeHtml(tag)}</span>`).join('') : '<span class="text-slate-400">-</span>'}
                            </div>
                          </td>
                          <td class="px-4 py-3">
                            <p class="text-slate-700">${escapeHtml(item.currentPhase?.phase.phaseName || item.project.currentPhaseName || '-')}</p>
                            <p class="mt-1 text-xs text-slate-400">${escapeHtml(item.nextNode?.node.workItemTypeName || '无待执行节点')}</p>
                          </td>
                          <td class="px-4 py-3">${renderProjectProgress(item)}</td>
                          <td class="px-4 py-3">
                            <div class="inline-flex items-center gap-2 rounded-full px-2 py-1 text-xs ${item.project.riskStatus === '延期' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}">
                              <span class="h-1.5 w-1.5 rounded-full ${item.project.riskStatus === '延期' ? 'bg-amber-500' : 'bg-emerald-500'}"></span>
                              ${escapeHtml(getRiskText(item.project))}
                            </div>
                            ${
                              item.project.riskStatus === '延期' && item.project.riskReason
                                ? `<p class="mt-1 max-w-[180px] text-xs text-slate-500">${escapeHtml(item.project.riskReason)}</p>`
                                : ''
                            }
                          </td>
                          <td class="px-4 py-3 text-slate-700">${escapeHtml(item.project.ownerName)}</td>
                          <td class="px-4 py-3 text-slate-500">${escapeHtml(formatDateTime(item.project.updatedAt))}</td>
                        </tr>
                      `,
                    )
                    .join('')
            }
          </tbody>
        </table>
      </div>
      ${renderPagination(totalPages)}
    </section>
  `
}

function renderProjectGrid(projects: ProjectViewModel[], totalPages: number): string {
  return `
    <section class="space-y-4">
      ${
        projects.length === 0
          ? `
            <div class="rounded-lg border bg-white p-16 text-center">
              <p class="text-sm font-medium text-slate-700">暂无符合条件的商品项目</p>
              <p class="mt-1 text-xs text-slate-500">可以调整筛选条件，或直接创建一个新的商品项目。</p>
            </div>
          `
          : `
            <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              ${projects
                .map(
                  (item) => `
                    <article class="rounded-lg border bg-white p-4">
                      <div class="flex items-start justify-between gap-3">
                        <div>
                          <button type="button" class="text-left text-base font-semibold text-blue-700 hover:underline" data-nav="/pcs/projects/${escapeHtml(item.project.projectId)}">${escapeHtml(item.project.projectName)}</button>
                          <p class="mt-1 text-xs text-slate-400">${escapeHtml(item.project.projectCode)}</p>
                        </div>
                        <span class="inline-flex rounded-full px-2 py-0.5 text-xs ${getProjectStatusBadgeClass(item.project.projectStatus)}">${escapeHtml(item.project.projectStatus)}</span>
                      </div>
                      <div class="mt-4 flex flex-wrap gap-2">
                        <span class="inline-flex rounded-full border px-2 py-0.5 text-xs ${getStyleTypeBadgeClass(item.project.styleType)}">${escapeHtml(item.project.styleType)}</span>
                        <span class="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">${escapeHtml(item.project.categoryName)}</span>
                        ${item.pendingDecisionNode ? '<span class="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">待决策</span>' : ''}
                      </div>
                      <div class="mt-4 space-y-3 text-sm text-slate-600">
                        <div class="flex items-center justify-between"><span>当前阶段</span><span class="font-medium text-slate-900">${escapeHtml(item.currentPhase?.phase.phaseName || '-')}</span></div>
                        <div class="flex items-center justify-between"><span>负责人</span><span class="font-medium text-slate-900">${escapeHtml(item.project.ownerName)}</span></div>
                        <div class="flex items-center justify-between"><span>风险状态</span><span class="font-medium ${item.project.riskStatus === '延期' ? 'text-amber-600' : 'text-emerald-600'}">${escapeHtml(getRiskText(item.project))}</span></div>
                      </div>
                      <div class="mt-4">${renderProjectProgress(item)}</div>
                      <div class="mt-4 flex items-center justify-between border-t border-slate-200 pt-4">
                        <span class="text-xs text-slate-400">${escapeHtml(formatDateTime(item.project.updatedAt))}</span>
                        <button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50" data-nav="/pcs/projects/${escapeHtml(item.project.projectId)}">查看详情</button>
                      </div>
                    </article>
                  `,
                )
                .join('')}
            </div>
          `
      }
      ${renderPagination(totalPages)}
    </section>
  `
}

function renderProjectTerminateDialog(): string {
  if (!state.terminateProjectId) return ''
  const project = getProjectById(state.terminateProjectId)
  if (!project) return ''
  return renderModalShell(
    '终止项目',
    `请说明终止「${project.projectName}」的原因，该记录会写入项目日志。`,
    `
      <label class="space-y-1">
        <span class="text-xs text-slate-500">终止原因</span>
        <textarea class="min-h-[120px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="请输入终止原因" data-pcs-project-field="terminate-reason">${escapeHtml(state.terminateReason)}</textarea>
      </label>
    `,
    `
      <button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-project-action="close-dialogs">取消</button>
      <button type="button" class="inline-flex h-9 items-center rounded-md bg-rose-600 px-4 text-sm font-medium text-white hover:bg-rose-700 ${state.terminateReason.trim() ? '' : 'opacity-50'}" data-pcs-project-action="confirm-terminate" ${state.terminateReason.trim() ? '' : 'disabled'}>确认终止</button>
    `,
  )
}

function renderProjectListHeader(): string {
  return `
    <section class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="text-xs text-slate-500">商品中心 / 商品项目</p>
        <h1 class="mt-1 text-2xl font-semibold text-slate-900">商品项目列表</h1>
        <p class="mt-1 text-sm text-slate-500">管理所有商品立项、执行进度、测款决策和转档收口。</p>
      </div>
      <button type="button" class="inline-flex h-10 items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-nav="/pcs/projects/create">
        <i data-lucide="plus" class="h-4 w-4"></i>新建商品项目
      </button>
    </section>
  `
}

function renderTemplatePreview(template: ProjectTemplate | null): string {
  if (!template) {
    return `
      <div class="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
        当前没有可用模板，请先到模板管理中启用对应款式类型的项目模板。
      </div>
    `
  }

  return `
    <div class="space-y-4">
      <div class="grid gap-3 md:grid-cols-4">
        <article class="rounded-lg border bg-slate-50 p-4">
          <p class="text-xs text-slate-500">已选模板</p>
          <p class="mt-2 text-sm font-semibold text-slate-900">${escapeHtml(template.name)}</p>
        </article>
        <article class="rounded-lg border bg-slate-50 p-4">
          <p class="text-xs text-slate-500">阶段数</p>
          <p class="mt-2 text-2xl font-semibold text-slate-900">${countTemplateStages(template)}</p>
        </article>
        <article class="rounded-lg border bg-slate-50 p-4">
          <p class="text-xs text-slate-500">工作项数</p>
          <p class="mt-2 text-2xl font-semibold text-slate-900">${countTemplateWorkItems(template)}</p>
        </article>
        <article class="rounded-lg border bg-slate-50 p-4">
          <p class="text-xs text-slate-500">模板状态</p>
          <p class="mt-2 text-sm font-semibold text-slate-900">${escapeHtml(template.status === 'active' ? '启用' : '停用')}</p>
        </article>
      </div>
      <div class="rounded-lg border bg-white p-4">
        <p class="text-sm font-medium text-slate-900">模板说明</p>
        <p class="mt-2 text-sm leading-6 text-slate-600">${escapeHtml(template.description || template.scenario)}</p>
      </div>
      <div class="space-y-3">
        ${template.stages
          .map((stage) => {
            const stageNodes = template.nodes.filter((node) => node.phaseCode === stage.phaseCode)
            return `
              <article class="rounded-lg border p-4">
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 class="text-sm font-semibold text-slate-900">${escapeHtml(stage.phaseName)}</h3>
                    <p class="mt-1 text-xs text-slate-500">${escapeHtml(stage.description)}</p>
                  </div>
                  <span class="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">${stageNodes.length} 个工作项</span>
                </div>
                <div class="mt-3 flex flex-wrap gap-2">
                  ${stageNodes
                    .map(
                      (node) => `
                        <span class="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">
                          ${escapeHtml(node.workItemTypeName)}
                        </span>
                      `,
                    )
                    .join('')}
                </div>
              </article>
            `
          })
          .join('')}
      </div>
    </div>
  `
}

function renderCreatePage(): string {
  ensureCreateState()
  const catalog = getProjectCreateCatalog()
  const draft = state.create.draft
  const categoryChildren = getProjectCategoryChildren(draft.categoryId)
  const templateOptions = listActiveProjectTemplates().filter((template) =>
    draft.styleType ? template.styleType.includes(draft.styleType as TemplateStyleType) : true,
  )
  const selectedTemplate = draft.templateId ? getProjectTemplateById(draft.templateId) : templateOptions[0] ?? null
  const errorCard = state.create.error
    ? `<section class="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">${escapeHtml(state.create.error)}</section>`
    : ''

  return `
    <div class="space-y-6 p-6 pb-28">
      ${renderNotice()}
      ${errorCard}
      <section class="flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <button type="button" class="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-nav="/pcs/projects">
            <i data-lucide="arrow-left" class="h-4 w-4"></i>返回
          </button>
          <div>
            <p class="text-xs text-slate-500">商品中心 / 商品项目</p>
            <h1 class="mt-1 text-2xl font-semibold text-slate-900">创建商品项目</h1>
            <p class="mt-1 text-sm text-slate-500">创建新的商品项目工作空间，并自动挂接对应模板流程。</p>
          </div>
        </div>
      </section>

      <section class="rounded-lg border bg-white p-6">
        <div class="mb-6 flex items-center gap-2">
          <h2 class="text-lg font-semibold text-slate-900">基础信息</h2>
          <span class="inline-flex rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-700">必填</span>
        </div>
        <div class="space-y-6">
          <label class="space-y-1">
            <span class="text-sm font-medium text-slate-900">项目名称 <span class="text-rose-500">*</span></span>
            <input class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="例如：2026夏季宽松基础T恤" value="${escapeHtml(draft.projectName)}" data-pcs-project-field="create-project-name" />
          </label>

          <div class="space-y-3">
            <div>
              <span class="text-sm font-medium text-slate-900">款式类型 <span class="text-rose-500">*</span></span>
              <p class="mt-1 text-xs text-slate-500">选择款式类型后，系统会自动推荐对应模板。</p>
            </div>
            <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              ${catalog.styleTypes
                .map(
                  (styleType) => `
                    <button type="button" class="${toClassName(
                      'rounded-lg border p-4 text-left transition',
                      draft.styleType === styleType
                        ? 'border-blue-500 bg-blue-50 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
                    )}" data-pcs-project-action="select-style-type" data-style-type="${escapeHtml(styleType)}">
                      <div class="flex items-center justify-between gap-2">
                        <span class="text-sm font-semibold text-slate-900">${escapeHtml(styleType)}</span>
                        <span class="inline-flex rounded-full px-2 py-0.5 text-xs ${getStyleTypeBadgeClass(styleType)}">${escapeHtml(getProjectTypeLabel(styleType) || '')}</span>
                      </div>
                      <p class="mt-2 text-xs leading-5 text-slate-500">${escapeHtml(
                        styleType === '基础款'
                          ? '适用于标准商品开发链路。'
                          : styleType === '快时尚款'
                            ? '适用于渠道快反与快速上新。'
                            : styleType === '改版款'
                              ? '适用于改版修订和问题回收。'
                              : '适用于设计研发和复杂打样。',
                      )}</p>
                    </button>
                  `,
                )
                .join('')}
            </div>
          </div>

          <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label class="space-y-1">
              <span class="text-xs text-slate-500">项目来源</span>
              <select class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" data-pcs-project-field="create-project-source">
                ${catalog.projectSourceTypes
                  .map(
                    (option) =>
                      `<option value="${escapeHtml(option)}" ${draft.projectSourceType === option ? 'selected' : ''}>${escapeHtml(option)}</option>`,
                  )
                  .join('')}
              </select>
            </label>
            <label class="space-y-1">
              <span class="text-xs text-slate-500">一级分类</span>
              <select class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" data-pcs-project-field="create-category">
                ${catalog.categories
                  .map(
                    (option) =>
                      `<option value="${escapeHtml(option.id)}" ${draft.categoryId === option.id ? 'selected' : ''}>${escapeHtml(option.name)}</option>`,
                  )
                  .join('')}
              </select>
            </label>
            <label class="space-y-1">
              <span class="text-xs text-slate-500">二级分类</span>
              <select class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" data-pcs-project-field="create-sub-category">
                ${categoryChildren
                  .map(
                    (option) =>
                      `<option value="${escapeHtml(option.id)}" ${draft.subCategoryId === option.id ? 'selected' : ''}>${escapeHtml(option.name)}</option>`,
                  )
                  .join('')}
              </select>
            </label>
            <label class="space-y-1">
              <span class="text-xs text-slate-500">模板</span>
              <select class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" data-pcs-project-field="create-template">
                ${templateOptions
                  .map(
                    (template) =>
                      `<option value="${escapeHtml(template.id)}" ${draft.templateId === template.id ? 'selected' : ''}>${escapeHtml(template.name)}</option>`,
                  )
                  .join('')}
              </select>
            </label>
            <label class="space-y-1">
              <span class="text-xs text-slate-500">品牌</span>
              <select class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" data-pcs-project-field="create-brand">
                ${catalog.brands
                  .map(
                    (option) =>
                      `<option value="${escapeHtml(option.id)}" ${draft.brandId === option.id ? 'selected' : ''}>${escapeHtml(option.name)}</option>`,
                  )
                  .join('')}
              </select>
            </label>
            <label class="space-y-1">
              <span class="text-xs text-slate-500">参考款号</span>
              <select class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" data-pcs-project-field="create-style-code">
                ${catalog.styleCodes
                  .map(
                    (option) =>
                      `<option value="${escapeHtml(option.id)}" ${draft.styleCodeId === option.id ? 'selected' : ''}>${escapeHtml(option.name)}</option>`,
                  )
                  .join('')}
              </select>
            </label>
            <label class="space-y-1">
              <span class="text-xs text-slate-500">负责人</span>
              <select class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" data-pcs-project-field="create-owner">
                ${catalog.owners
                  .map(
                    (option) =>
                      `<option value="${escapeHtml(option.id)}" ${draft.ownerId === option.id ? 'selected' : ''}>${escapeHtml(option.name)}</option>`,
                  )
                  .join('')}
              </select>
            </label>
            <label class="space-y-1">
              <span class="text-xs text-slate-500">执行团队</span>
              <select class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" data-pcs-project-field="create-team">
                ${catalog.teams
                  .map(
                    (option) =>
                      `<option value="${escapeHtml(option.id)}" ${draft.teamId === option.id ? 'selected' : ''}>${escapeHtml(option.name)}</option>`,
                  )
                  .join('')}
              </select>
            </label>
          </div>

          <div class="space-y-3">
            <div>
              <span class="text-sm font-medium text-slate-900">风格标签</span>
              <p class="mt-1 text-xs text-slate-500">用于区分款式调性，支撑列表筛选和项目识别。</p>
            </div>
            <div class="flex flex-wrap gap-2">
              ${catalog.styleTags.slice(0, 8).map(
                (tag) => `
                  <button type="button" class="${toClassName(
                    'inline-flex h-8 items-center rounded-md px-3 text-xs',
                    draft.styleTagNames.includes(tag)
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                  )}" data-pcs-project-action="toggle-style-tag" data-value="${escapeHtml(tag)}">${escapeHtml(tag)}</button>
                `,
              ).join('')}
            </div>
          </div>

          <div class="space-y-3">
            <div>
              <span class="text-sm font-medium text-slate-900">目标测款渠道 <span class="text-rose-500">*</span></span>
              <p class="mt-1 text-xs text-slate-500">创建项目时即确定本轮测款计划投放渠道。</p>
            </div>
            <div class="flex flex-wrap gap-2">
              ${catalog.channelOptions.map(
                (option) => `
                  <button type="button" class="${toClassName(
                    'inline-flex h-8 items-center rounded-md px-3 text-xs',
                    draft.targetChannelCodes.includes(option.code)
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                  )}" data-pcs-project-action="toggle-channel" data-value="${escapeHtml(option.code)}">${escapeHtml(option.name)}</button>
                `,
              ).join('')}
            </div>
          </div>

          <label class="space-y-1">
            <span class="text-sm font-medium text-slate-900">项目说明</span>
            <textarea class="min-h-[120px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="补充项目背景、阶段目标或风险提醒" data-pcs-project-field="create-remark">${escapeHtml(draft.remark)}</textarea>
          </label>
        </div>
      </section>

      <section class="rounded-lg border bg-white p-6">
        <div class="mb-6">
          <h2 class="text-lg font-semibold text-slate-900">模板预览</h2>
          <p class="mt-1 text-sm text-slate-500">根据已选款式类型和模板，预览创建后的标准流程结构。</p>
        </div>
        ${renderTemplatePreview(selectedTemplate)}
      </section>

      <div class="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur">
        <div class="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-6 py-4">
          <div class="text-sm text-slate-500">
            当前模板：<span class="font-medium text-slate-900">${escapeHtml(selectedTemplate?.name || '未选择')}</span>
          </div>
          <div class="flex items-center gap-2">
            <button type="button" class="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50" data-pcs-project-action="open-create-cancel">取消</button>
            <button type="button" class="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50" data-pcs-project-action="save-draft">保存草稿</button>
            <button type="button" class="inline-flex h-10 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-pcs-project-action="create-project">创建项目</button>
          </div>
        </div>
      </div>

      ${
        state.createCancelOpen
          ? renderModalShell(
              '放弃当前编辑？',
              '若当前内容尚未创建，返回列表后仍会保留在当前会话中。',
              '<p class="text-sm leading-6 text-slate-600">是否确认离开当前创建页？</p>',
              `
                <button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-project-action="close-dialogs">继续编辑</button>
                <button type="button" class="inline-flex h-9 items-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800" data-pcs-project-action="confirm-create-cancel">确认返回</button>
              `,
            )
          : ''
      }
    </div>
  `
}

function renderProjectHeader(viewModel: ProjectViewModel): string {
  return `
    <section class="rounded-lg border bg-white p-6">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="flex items-start gap-4">
          <div class="flex h-16 w-16 items-center justify-center rounded-lg bg-slate-100">
            <i data-lucide="folder-kanban" class="h-8 w-8 text-slate-500"></i>
          </div>
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <h1 class="text-2xl font-semibold text-slate-900">${escapeHtml(viewModel.project.projectName)}</h1>
              <span class="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">${escapeHtml(viewModel.project.projectCode)}</span>
              <span class="inline-flex rounded-full px-2 py-0.5 text-xs ${getProjectStatusBadgeClass(viewModel.project.projectStatus)}">${escapeHtml(viewModel.project.projectStatus)}</span>
            </div>
            <div class="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <span>${escapeHtml(viewModel.project.categoryName)}</span>
              <span>·</span>
              <span>${escapeHtml(viewModel.project.styleType)}</span>
              <span>·</span>
              <span>${escapeHtml(viewModel.project.styleTagNames.join('、') || '未设置风格标签')}</span>
            </div>
            <div class="mt-4 flex flex-wrap gap-2">
              ${viewModel.channelNames.map((channel) => `<span class="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">${escapeHtml(channel)}</span>`).join('')}
            </div>
          </div>
        </div>
        <div class="grid gap-3 sm:grid-cols-3">
          <div class="rounded-lg border bg-slate-50 px-4 py-3 text-right">
            <p class="text-xs text-slate-500">负责人</p>
            <p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(viewModel.project.ownerName)}</p>
          </div>
          <div class="rounded-lg border bg-slate-50 px-4 py-3 text-right">
            <p class="text-xs text-slate-500">当前阶段</p>
            <p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(viewModel.currentPhase?.phase.phaseName || '-')}</p>
          </div>
          <div class="rounded-lg border bg-slate-50 px-4 py-3 text-right">
            <p class="text-xs text-slate-500">最后更新</p>
            <p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(formatDateTime(viewModel.project.updatedAt))}</p>
          </div>
        </div>
      </div>
    </section>
  `
}

function renderPhaseNavigator(viewModel: ProjectViewModel): string {
  const selectedNodeId = state.detail.selectedNodeId
  return `
    <section class="rounded-lg border bg-white p-4">
      <h2 class="mb-4 text-base font-semibold text-slate-900">阶段与工作项</h2>
      <div class="space-y-3">
        ${viewModel.phases
          .map((phase, index) => {
            const expanded = state.detail.expandedPhases[phase.phase.phaseCode] !== false
            return `
              <article class="overflow-hidden rounded-lg border">
                <button type="button" class="${toClassName(
                  'flex w-full items-center justify-between px-3 py-3 text-left transition',
                  phase.current ? 'bg-blue-50' : 'bg-white hover:bg-slate-50',
                )}" data-pcs-project-action="toggle-phase" data-phase-code="${escapeHtml(phase.phase.phaseCode)}">
                  <div class="flex items-center gap-3">
                    <span class="${toClassName(
                      'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
                      phase.derivedStatus === '已完成'
                        ? 'bg-emerald-500 text-white'
                        : phase.current
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-500',
                    )}">${index + 1}</span>
                    <div>
                      <p class="text-sm font-medium text-slate-900">${escapeHtml(phase.phase.phaseName)}</p>
                      <p class="mt-1 text-xs text-slate-500">${phase.completedCount}/${phase.totalCount} 完成${phase.pendingDecision ? ' · 待决策' : ''}</p>
                    </div>
                  </div>
                  <i data-lucide="${expanded ? 'chevron-down' : 'chevron-right'}" class="h-4 w-4 text-slate-400"></i>
                </button>
                ${
                  expanded
                    ? `
                      <div class="border-t bg-slate-50/60">
                        ${phase.nodes
                          .map(
                            (item) => `
                              <button type="button" class="${toClassName(
                                'flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-100',
                                selectedNodeId === item.node.projectNodeId ? 'bg-blue-100' : '',
                              )}" data-pcs-project-action="select-node" data-project-node-id="${escapeHtml(item.node.projectNodeId)}">
                                <i data-lucide="${getNodeStatusIcon(item.displayStatus)}" class="mt-0.5 h-4 w-4 ${item.displayStatus === '已完成' ? 'text-emerald-500' : item.displayStatus === '进行中' ? 'text-blue-500' : item.displayStatus === '待确认' ? 'text-amber-500' : item.displayStatus === '已取消' ? 'text-rose-500' : 'text-slate-400'}"></i>
                                <div class="min-w-0 flex-1">
                                  <div class="flex flex-wrap items-center gap-2">
                                    <p class="text-sm font-medium text-slate-900">${escapeHtml(item.node.workItemTypeName)}</p>
                                    <span class="inline-flex rounded-full px-2 py-0.5 text-[11px] ${getNodeStatusBadgeClass(item.displayStatus)}">${escapeHtml(item.displayStatus)}</span>
                                  </div>
                                  <p class="mt-1 text-xs text-slate-500">${escapeHtml(item.node.currentOwnerName || viewModel.project.ownerName)}</p>
                                </div>
                              </button>
                            `,
                          )
                          .join('')}
                      </div>
                    `
                    : ''
                }
              </article>
            `
          })
          .join('')}
      </div>
    </section>
  `
}

function renderNodeMetricCards(node: ProjectNodeViewModel): string {
  const payload = node.latestRecord?.payload as Record<string, unknown> | undefined
  if (payload && typeof payload.totalExposureQty === 'number') {
    return `
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <article class="rounded-lg border bg-white p-4"><p class="text-xs text-slate-500">曝光量</p><p class="mt-2 text-2xl font-semibold text-slate-900">${formatValue(payload.totalExposureQty)}</p></article>
        <article class="rounded-lg border bg-white p-4"><p class="text-xs text-slate-500">点击量</p><p class="mt-2 text-2xl font-semibold text-slate-900">${formatValue(payload.totalClickQty)}</p></article>
        <article class="rounded-lg border bg-white p-4"><p class="text-xs text-slate-500">下单量</p><p class="mt-2 text-2xl font-semibold text-slate-900">${formatValue(payload.totalOrderQty)}</p></article>
        <article class="rounded-lg border bg-white p-4"><p class="text-xs text-slate-500">GMV</p><p class="mt-2 text-2xl font-semibold text-slate-900">${formatValue(payload.totalGmvAmount)}</p></article>
      </div>
    `
  }

  return `
    <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <article class="rounded-lg border bg-white p-4"><p class="text-xs text-slate-500">正式记录</p><p class="mt-2 text-2xl font-semibold text-slate-900">${node.records.length}</p></article>
      <article class="rounded-lg border bg-white p-4"><p class="text-xs text-slate-500">关联对象</p><p class="mt-2 text-2xl font-semibold text-slate-900">${node.relations.length}</p></article>
      <article class="rounded-lg border bg-white p-4"><p class="text-xs text-slate-500">有效实例</p><p class="mt-2 text-2xl font-semibold text-slate-900">${Math.max(node.node.validInstanceCount, node.records.length)}</p></article>
      <article class="rounded-lg border bg-white p-4"><p class="text-xs text-slate-500">最近更新</p><p class="mt-2 text-sm font-semibold text-slate-900">${escapeHtml(formatDateTime(node.node.updatedAt || node.latestRecord?.updatedAt || ''))}</p></article>
    </div>
  `
}

function renderKeyOutputCards(node: ProjectNodeViewModel, project: PcsProjectRecord): string {
  const summaries = [
    { label: '最近结果', value: node.node.latestResultText || '-' },
    { label: '当前待办', value: node.node.pendingActionText || '-' },
    { label: '当前问题', value: node.node.currentIssueText || '无' },
    { label: '目标渠道', value: getChannelNamesByCodes(project.targetChannelCodes).join('、') || '-' },
  ]
  return `
    <div class="grid gap-3 md:grid-cols-2">
      ${summaries
        .map(
          (item) => `
            <article class="rounded-lg border bg-white p-4">
              <p class="text-xs text-slate-500">${escapeHtml(item.label)}</p>
              <p class="mt-2 text-sm leading-6 text-slate-700">${escapeHtml(item.value)}</p>
            </article>
          `,
        )
        .join('')}
    </div>
  `
}

function renderLatestRecordSummary(node: ProjectNodeViewModel): string {
  const record = node.latestRecord
  if (!record) {
    return `
      <article class="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6">
        <p class="text-sm font-medium text-slate-700">暂无正式记录</p>
        <p class="mt-1 text-xs text-slate-500">当前节点还没有沉淀项目内正式记录，可进入详情页继续补充。</p>
      </article>
    `
  }

  const entries = [...Object.entries(record.payload || {}), ...Object.entries(record.detailSnapshot || {})]
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .slice(0, 6)
  return `
    <article class="rounded-lg border p-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="text-sm font-medium text-slate-900">最新记录</p>
          <p class="mt-1 text-xs text-slate-500">${escapeHtml(record.recordCode)} · ${escapeHtml(record.recordStatus)}</p>
        </div>
        <span class="text-xs text-slate-400">${escapeHtml(formatDateTime(record.updatedAt))}</span>
      </div>
      <div class="mt-4 grid gap-3 md:grid-cols-2">
        ${entries
          .map(
            ([key, value]) => `
              <div class="rounded-lg bg-slate-50 p-3">
                <p class="text-xs text-slate-500">${escapeHtml(key)}</p>
                <p class="mt-2 text-sm text-slate-700">${escapeHtml(formatValue(value))}</p>
              </div>
            `,
          )
          .join('')}
      </div>
    </article>
  `
}

function renderRecordListSection(node: ProjectNodeViewModel, projectId: string): string {
  if (!node.node.multiInstanceFlag || node.records.length <= 1) return ''
  return `
    <article class="rounded-lg border p-4">
      <div class="mb-4 flex items-center justify-between gap-3">
        <h3 class="text-sm font-medium text-slate-900">多次执行记录</h3>
        <button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50" data-nav="/pcs/projects/${escapeHtml(projectId)}/work-items/${escapeHtml(node.node.projectNodeId)}?tab=records">查看全部</button>
      </div>
      <div class="overflow-hidden rounded-lg border">
        <table class="min-w-full text-sm">
          <thead class="bg-slate-50">
            <tr class="text-left text-slate-600">
              <th class="px-3 py-2 font-medium">记录编号</th>
              <th class="px-3 py-2 font-medium">业务日期</th>
              <th class="px-3 py-2 font-medium">状态</th>
              <th class="px-3 py-2 font-medium">记录人</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200">
            ${node.records
              .slice(0, 5)
              .map(
                (record) => `
                  <tr>
                    <td class="px-3 py-2 text-slate-700">${escapeHtml(record.recordCode)}</td>
                    <td class="px-3 py-2 text-slate-500">${escapeHtml(formatDateTime(record.businessDate))}</td>
                    <td class="px-3 py-2 text-slate-500">${escapeHtml(record.recordStatus)}</td>
                    <td class="px-3 py-2 text-slate-500">${escapeHtml(record.ownerName)}</td>
                  </tr>
                `,
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </article>
  `
}

function renderProjectLogs(logs: ProjectLogItem[]): string {
  return `
    <section class="space-y-4">
      <article class="rounded-lg border bg-white p-4">
        <h2 class="text-base font-semibold text-slate-900">项目日志</h2>
        <div class="mt-4 space-y-4">
          ${logs
            .map(
              (log) => `
                <div class="flex items-start gap-3">
                  <span class="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${getLogToneClass(log.tone)}">•</span>
                  <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-center justify-between gap-2">
                      <p class="text-sm font-medium text-slate-900">${escapeHtml(log.title)}</p>
                      <span class="text-xs text-slate-400">${escapeHtml(formatDateTime(log.time))}</span>
                    </div>
                    <p class="mt-1 text-xs leading-6 text-slate-500">${escapeHtml(log.detail)}</p>
                  </div>
                </div>
              `,
            )
            .join('')}
        </div>
      </article>
    </section>
  `
}

function renderProjectOverviewCard(viewModel: ProjectViewModel): string {
  return `
    <article class="rounded-lg border bg-white p-4">
      <h2 class="text-base font-semibold text-slate-900">项目概览</h2>
      <div class="mt-4 space-y-3 text-sm text-slate-600">
        <div class="flex items-center justify-between gap-3"><span>模板</span><span class="text-right font-medium text-slate-900">${escapeHtml(viewModel.project.templateName)}</span></div>
        <div class="flex items-center justify-between gap-3"><span>阶段进度</span><span class="text-right font-medium text-slate-900">${viewModel.progressDone}/${viewModel.progressTotal}</span></div>
        <div class="flex items-center justify-between gap-3"><span>当前待办</span><span class="text-right font-medium text-slate-900">${escapeHtml(viewModel.nextNode?.node.workItemTypeName || '无')}</span></div>
        <div class="flex items-center justify-between gap-3"><span>风险状态</span><span class="text-right font-medium ${viewModel.project.riskStatus === '延期' ? 'text-amber-600' : 'text-emerald-600'}">${escapeHtml(getRiskText(viewModel.project))}</span></div>
        <div class="flex items-center justify-between gap-3"><span>测款渠道</span><span class="text-right font-medium text-slate-900">${escapeHtml(viewModel.channelNames.join('、') || '-')}</span></div>
      </div>
    </article>
  `
}

function renderPendingDecisionGate(viewModel: ProjectViewModel): string {
  const pendingNode = viewModel.pendingDecisionNode
  if (!pendingNode) return ''
  return `
    <section class="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="text-sm font-semibold text-amber-800">当前存在待决策闸口</p>
          <p class="mt-1 text-sm text-amber-700">${escapeHtml(pendingNode.node.workItemTypeName)} · ${escapeHtml(pendingNode.node.pendingActionText || '请尽快完成决策。')}</p>
        </div>
        <div class="flex items-center gap-2">
          <button type="button" class="inline-flex h-9 items-center rounded-md border border-amber-200 bg-white px-4 text-sm text-amber-700 hover:bg-amber-100" data-pcs-project-action="select-node" data-project-node-id="${escapeHtml(pendingNode.node.projectNodeId)}">定位节点</button>
          ${
            canOpenDecisionAction(pendingNode)
              ? `<button type="button" class="inline-flex h-9 items-center rounded-md bg-amber-500 px-4 text-sm font-medium text-white hover:bg-amber-600" data-pcs-project-action="open-decision" data-source="detail">做出决策</button>`
              : ''
          }
        </div>
      </div>
    </section>
  `
}

function renderDetailDecisionDialog(viewModel: ProjectViewModel, selectedNode: ProjectNodeViewModel | null): string {
  if (!state.decisionDialog.open || state.decisionDialog.source !== 'detail' || !selectedNode) return ''
  const options = getDecisionOptions(selectedNode)

  return renderModalShell(
    selectedNode.node.workItemTypeCode === 'TEST_CONCLUSION' ? '测款结论判定' : '节点决策',
    `请确认「${selectedNode.node.workItemTypeName}」的处理结果。`,
    `
      <div class="space-y-2">
        <p class="text-xs text-slate-500">决策结果</p>
        <div class="grid gap-2 md:grid-cols-${options.length > 3 ? '4' : '3'}">
          ${options
            .map(
              (option) => `
                <button type="button" class="${toClassName(
                  'rounded-md border px-3 py-2 text-sm transition',
                  state.decisionDialog.value === option
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                )}" data-pcs-project-action="set-decision-value" data-value="${escapeHtml(option)}">${escapeHtml(option)}</button>
              `,
            )
            .join('')}
        </div>
      </div>
      <label class="space-y-1">
        <span class="text-xs text-slate-500">决策说明</span>
        <textarea class="min-h-[120px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="补充判定依据或后续处理建议" data-pcs-project-field="decision-note">${escapeHtml(state.decisionDialog.note)}</textarea>
      </label>
    `,
    `
      <button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-project-action="close-dialogs">取消</button>
      <button type="button" class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 ${state.decisionDialog.value ? '' : 'opacity-50'}" data-pcs-project-action="confirm-decision" ${state.decisionDialog.value ? '' : 'disabled'}>提交决策</button>
    `,
  )
}

function renderProjectDetailPage(projectId: string): string {
  ensureProjectDemoData()
  ensureDetailState(projectId)
  const viewModel = buildProjectViewModel(projectId)
  if (!viewModel) {
    return `
      <div class="space-y-4 p-6">
        <section class="rounded-lg border bg-white p-8 text-center">
          <h1 class="text-xl font-semibold text-slate-900">项目未找到</h1>
          <p class="mt-2 text-sm text-slate-500">请确认项目编号是否正确，或返回商品项目列表重新选择。</p>
          <button type="button" class="mt-4 inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-nav="/pcs/projects">返回项目列表</button>
        </section>
      </div>
    `
  }

  const selectedNode = getSelectedDetailNode(viewModel)
  const selectedNature = selectedNode?.contract.workItemNature || selectedNode?.definition?.workItemNature || '执行类'
  const locked = selectedNode ? selectedNode.displayStatus === '未解锁' : false

  return `
    <div class="space-y-6 p-6">
      ${renderNotice()}
      ${renderProjectHeader(viewModel)}
      <div class="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
        ${renderPhaseNavigator(viewModel)}
        <div class="space-y-4">
          ${
            selectedNode
              ? `
                <section class="rounded-lg border bg-white p-4">
                  <div class="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div class="flex flex-wrap items-center gap-2">
                        <h2 class="text-xl font-semibold text-slate-900">${escapeHtml(selectedNode.node.workItemTypeName)}</h2>
                        <span class="inline-flex rounded-full border px-2 py-0.5 text-xs ${getNatureBadgeClass(selectedNature)}">${escapeHtml(selectedNature)}</span>
                        <span class="inline-flex rounded-full px-2 py-0.5 text-xs ${getNodeStatusBadgeClass(selectedNode.displayStatus)}">${escapeHtml(selectedNode.displayStatus)}</span>
                      </div>
                      <div class="mt-2 flex flex-wrap items-center gap-4 text-sm text-slate-500">
                        <span>负责人：${escapeHtml(selectedNode.node.currentOwnerName || viewModel.project.ownerName)}</span>
                        <span>更新时间：${escapeHtml(formatDateTime(selectedNode.node.updatedAt || selectedNode.latestRecord?.updatedAt || viewModel.project.updatedAt))}</span>
                      </div>
                    </div>
                    <div class="flex flex-wrap gap-2">
                      <button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-nav="/pcs/projects/${escapeHtml(viewModel.project.projectId)}/work-items/${escapeHtml(selectedNode.node.projectNodeId)}">查看全部</button>
                      ${
                        selectedNode.node.workItemTypeCode === 'PROJECT_INIT' && selectedNode.node.currentStatus === '待确认'
                          ? '<button type="button" class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-pcs-project-action="approve-init">审核立项</button>'
                          : ''
                      }
                      ${
                        canOpenDecisionAction(selectedNode)
                          ? '<button type="button" class="inline-flex h-9 items-center rounded-md bg-amber-500 px-4 text-sm font-medium text-white hover:bg-amber-600" data-pcs-project-action="open-decision" data-source="detail">做出决策</button>'
                          : ''
                      }
                      ${
                        !locked && selectedNode.node.currentStatus !== '已完成' && selectedNode.node.currentStatus !== '已取消'
                          ? '<button type="button" class="inline-flex h-9 items-center rounded-md border border-emerald-200 bg-emerald-50 px-4 text-sm font-medium text-emerald-700 hover:bg-emerald-100" data-pcs-project-action="mark-node-complete">标记完成</button>'
                          : ''
                      }
                    </div>
                  </div>
                </section>
                ${locked ? `<section class="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">当前节点尚未解锁，请先完成前序工作项后再继续处理。</section>` : ''}
                ${renderNodeMetricCards(selectedNode)}
                ${renderKeyOutputCards(selectedNode, viewModel.project)}
                ${renderLatestRecordSummary(selectedNode)}
                ${renderRecordListSection(selectedNode, viewModel.project.projectId)}
              `
              : ''
          }
        </div>
        <div class="space-y-4">
          ${renderProjectOverviewCard(viewModel)}
          ${renderProjectLogs(viewModel.logs)}
        </div>
      </div>
      ${renderPendingDecisionGate(viewModel)}
      ${renderProjectTerminateDialog()}
      ${renderDetailDecisionDialog(viewModel, selectedNode)}
    </div>
  `
}

function renderFieldGroupValues(
  group: PcsProjectNodeFieldGroupDefinition,
  project: PcsProjectRecord,
  node: ProjectNodeViewModel,
): string {
  return `
    <article class="rounded-lg border bg-white p-4">
      <div class="mb-4">
        <h3 class="text-base font-semibold text-slate-900">${escapeHtml(group.groupTitle)}</h3>
        <p class="mt-1 text-xs text-slate-500">${escapeHtml(group.groupDescription)}</p>
      </div>
      <div class="grid gap-4 md:grid-cols-2">
        ${group.fields
          .map((field) => {
            return `
              <div class="space-y-1 rounded-lg bg-slate-50 p-3">
                <p class="text-xs text-slate-500">${escapeHtml(field.label)}</p>
                <p class="text-sm leading-6 text-slate-700">${escapeHtml(formatValue(getNodeFieldValue(project, node, field.fieldKey)))}</p>
              </div>
            `
          })
          .join('')}
      </div>
    </article>
  `
}

function renderEditableFieldGroups(
  project: PcsProjectRecord,
  node: ProjectNodeViewModel,
  draft: RecordDialogState,
  compact = false,
): string {
  const groups = listProjectWorkItemFieldGroups(node.node.workItemTypeCode as PcsProjectWorkItemCode)
  const editableKeys = getInlineEditableFieldKeys(node.node.workItemTypeCode)
  const disabled = node.displayStatus === '未解锁' || node.node.currentStatus === '已取消'

  return groups
    .map((group) => {
      const items = group.fields
        .map((field) => {
          const editable = !field.readonly && editableKeys.has(field.fieldKey)
          const value = editable
            ? draft.values[field.fieldKey] ?? ''
            : formatDraftFieldValue(field.type, getNodeFieldValue(project, node, field.fieldKey))

          return `
            <div class="space-y-1 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
              <div class="flex items-center gap-2">
                <p class="text-xs font-medium text-slate-600">${escapeHtml(field.label)}</p>
                ${field.required ? '<span class="rounded bg-rose-50 px-1.5 py-0.5 text-[11px] text-rose-600">必填</span>' : ''}
                ${field.readonly ? '<span class="rounded bg-slate-200 px-1.5 py-0.5 text-[11px] text-slate-500">回写</span>' : ''}
              </div>
              ${
                editable
                  ? renderFormalFieldControl(field, value, disabled)
                  : `<div class="min-h-10 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-700">${escapeHtml(formatValue(getNodeFieldValue(project, node, field.fieldKey)))}</div>`
              }
              <p class="text-[11px] leading-5 text-slate-400">${escapeHtml(`来源：${field.sourceKind} / ${field.sourceRef}`)}</p>
            </div>
          `
        })
        .join('')

      return `
        <article class="rounded-lg border bg-white p-4">
          <div class="mb-4">
            <h3 class="text-base font-semibold text-slate-900">${escapeHtml(group.groupTitle)}</h3>
            <p class="mt-1 text-xs text-slate-500">${escapeHtml(group.groupDescription)}</p>
          </div>
          <div class="grid gap-4 ${compact ? 'md:grid-cols-1' : 'md:grid-cols-2'}">
            ${items}
          </div>
        </article>
      `
    })
    .join('')
}

function renderFormalFieldEntrySection(project: PcsProjectRecord, node: ProjectNodeViewModel): string {
  if (!canUseInlineRecords(node.node.workItemTypeCode)) {
    return `
      <section class="rounded-lg border bg-white p-6">
        <h3 class="text-base font-semibold text-slate-900">正式字段录入</h3>
        <p class="mt-2 text-sm leading-6 text-slate-500">当前节点由下游正式对象或独立业务模块承载，项目内仅展示结果摘要和引用关系，不在这里直接录入字段。</p>
      </section>
    `
  }

  const draft = getNodeRecordDraft(project, node)
  const recordMode = node.contract.runtimeType === 'execute' && node.definition?.workItemNature === '执行类' && node.node.multiInstanceFlag

  return `
    <section class="space-y-4 rounded-lg border border-blue-200 bg-blue-50/40 p-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 class="text-base font-semibold text-slate-900">正式字段录入</h3>
          <p class="mt-1 text-sm text-slate-500">按工作项正式字段补录当前节点内容，保存后会同步回写项目节点状态。</p>
        </div>
        <label class="space-y-1">
          <span class="text-xs text-slate-500">业务日期</span>
          <input type="date" class="h-10 w-[180px] rounded-md border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" value="${escapeHtml(draft.businessDate)}" data-pcs-project-field="record-business-date" />
        </label>
      </div>
      ${renderEditableFieldGroups(project, node, draft)}
      ${
        node.displayStatus === '未解锁' || node.node.currentStatus === '已取消'
          ? ''
          : `
            <div class="flex flex-wrap justify-end gap-2 border-t border-blue-100 pt-4">
              <button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-project-action="save-formal-fields">${recordMode ? '新增正式记录' : '保存正式字段'}</button>
              <button type="button" class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-pcs-project-action="save-formal-fields-and-complete">保存并流转节点</button>
            </div>
          `
      }
    </section>
  `
}

function renderWorkItemTabs(viewModel: ProjectViewModel, node: ProjectNodeViewModel): string {
  const recordCount = node.records.length
  const attachmentCount = node.relations.length + (node.latestRecord?.upstreamRefs.length || 0) + (node.latestRecord?.downstreamRefs.length || 0)
  const auditCount = viewModel.logs.length

  return `
    <div class="inline-flex items-center rounded-md bg-slate-100 p-1">
      ${WORK_ITEM_TAB_OPTIONS.map((item) => {
        const badgeText = item.key === 'records' ? String(recordCount) : item.key === 'attachments' ? String(attachmentCount) : item.key === 'audit' ? String(auditCount) : ''
        return `
          <button type="button" class="${toClassName(
            'inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm transition',
            state.workItem.activeTab === item.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900',
          )}" data-pcs-project-action="switch-work-item-tab" data-tab="${item.key}">
            ${escapeHtml(item.label)}
            ${badgeText ? `<span class="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">${badgeText}</span>` : ''}
          </button>
        `
      }).join('')}
    </div>
  `
}

function renderWorkItemFullInfo(project: PcsProjectRecord, node: ProjectNodeViewModel): string {
  const groups = listProjectWorkItemFieldGroups(node.node.workItemTypeCode as PcsProjectWorkItemCode)
  if (node.displayStatus === '未解锁') {
    return `<section class="rounded-lg border bg-white p-6 text-sm text-slate-600">当前节点尚未解锁，请先完成前序工作项。</section>`
  }

  return `
    <div class="space-y-4">
      <article class="rounded-lg border bg-white p-4">
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div class="rounded-lg bg-slate-50 p-3"><p class="text-xs text-slate-500">节点状态</p><p class="mt-2 text-sm font-semibold text-slate-900">${escapeHtml(node.displayStatus)}</p></div>
          <div class="rounded-lg bg-slate-50 p-3"><p class="text-xs text-slate-500">最近结果</p><p class="mt-2 text-sm font-semibold text-slate-900">${escapeHtml(node.node.latestResultText || '-')}</p></div>
          <div class="rounded-lg bg-slate-50 p-3"><p class="text-xs text-slate-500">待办动作</p><p class="mt-2 text-sm font-semibold text-slate-900">${escapeHtml(node.node.pendingActionText || '-')}</p></div>
          <div class="rounded-lg bg-slate-50 p-3"><p class="text-xs text-slate-500">关联渠道</p><p class="mt-2 text-sm font-semibold text-slate-900">${escapeHtml(getChannelNamesByCodes(project.targetChannelCodes).join('、') || '-')}</p></div>
        </div>
      </article>
      ${renderFormalFieldEntrySection(project, node)}
      ${groups.map((group) => renderFieldGroupValues(group, project, node)).join('')}
    </div>
  `
}

function renderWorkItemRecords(node: ProjectNodeViewModel): string {
  if (node.records.length === 0) {
    return `
      <section class="rounded-lg border bg-white p-6">
        <div class="flex items-center justify-between gap-3">
          <div>
            <h3 class="text-base font-semibold text-slate-900">执行记录</h3>
            <p class="mt-1 text-sm text-slate-500">当前节点还没有正式记录。</p>
          </div>
          ${
            canUseInlineRecords(node.node.workItemTypeCode) && node.displayStatus !== '未解锁' && node.node.currentStatus !== '已取消'
              ? '<button type="button" class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-pcs-project-action="open-record-dialog">新增记录</button>'
              : ''
          }
        </div>
      </section>
    `
  }

  return `
    <section class="rounded-lg border bg-white p-6">
      <div class="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 class="text-base font-semibold text-slate-900">执行记录</h3>
          <p class="mt-1 text-sm text-slate-500">按业务日期倒序展示当前节点的正式记录。</p>
        </div>
        ${
          canUseInlineRecords(node.node.workItemTypeCode) && node.displayStatus !== '未解锁' && node.node.currentStatus !== '已取消'
            ? '<button type="button" class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-pcs-project-action="open-record-dialog">新增记录</button>'
            : ''
        }
      </div>
      <div class="overflow-hidden rounded-lg border">
        <table class="min-w-full text-sm">
          <thead class="bg-slate-50">
            <tr class="text-left text-slate-600">
              <th class="px-3 py-2 font-medium">记录编号</th>
              <th class="px-3 py-2 font-medium">业务日期</th>
              <th class="px-3 py-2 font-medium">结果摘要</th>
              <th class="px-3 py-2 font-medium">状态</th>
              <th class="px-3 py-2 font-medium">更新人</th>
              <th class="px-3 py-2 font-medium">更新时间</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200">
            ${node.records
              .map((record) => {
                const summaryEntry = Object.values(record.payload || {}).find((value) => value !== '' && value !== null && value !== undefined)
                return `
                  <tr>
                    <td class="px-3 py-2 text-slate-700">${escapeHtml(record.recordCode)}</td>
                    <td class="px-3 py-2 text-slate-500">${escapeHtml(formatDateTime(record.businessDate))}</td>
                    <td class="px-3 py-2 text-slate-700">${escapeHtml(formatValue(summaryEntry))}</td>
                    <td class="px-3 py-2 text-slate-500">${escapeHtml(record.recordStatus)}</td>
                    <td class="px-3 py-2 text-slate-500">${escapeHtml(record.updatedBy)}</td>
                    <td class="px-3 py-2 text-slate-500">${escapeHtml(formatDateTime(record.updatedAt))}</td>
                  </tr>
                `
              })
              .join('')}
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderWorkItemAttachments(node: ProjectNodeViewModel): string {
  const refs = [...(node.latestRecord?.upstreamRefs || []), ...(node.latestRecord?.downstreamRefs || [])]
  if (node.relations.length === 0 && refs.length === 0) {
    return `
      <section class="rounded-lg border bg-white p-6">
        <h3 class="text-base font-semibold text-slate-900">附件与引用</h3>
        <p class="mt-2 text-sm text-slate-500">当前节点暂无附件或关联引用。</p>
      </section>
    `
  }

  return `
    <div class="space-y-4">
      <section class="rounded-lg border bg-white p-6">
        <h3 class="text-base font-semibold text-slate-900">项目关联对象</h3>
        <div class="mt-4 overflow-hidden rounded-lg border">
          <table class="min-w-full text-sm">
            <thead class="bg-slate-50">
              <tr class="text-left text-slate-600">
                <th class="px-3 py-2 font-medium">关联角色</th>
                <th class="px-3 py-2 font-medium">来源模块</th>
                <th class="px-3 py-2 font-medium">对象标题</th>
                <th class="px-3 py-2 font-medium">状态</th>
                <th class="px-3 py-2 font-medium">业务日期</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200">
              ${
                node.relations.length === 0
                  ? '<tr><td colspan="5" class="px-3 py-6 text-center text-slate-500">暂无正式关联对象</td></tr>'
                  : node.relations
                      .map(
                        (relation) => `
                          <tr>
                            <td class="px-3 py-2 text-slate-700">${escapeHtml(relation.relationRole)}</td>
                            <td class="px-3 py-2 text-slate-500">${escapeHtml(relation.sourceModule)}</td>
                            <td class="px-3 py-2 text-slate-700">${escapeHtml(relation.sourceTitle)}</td>
                            <td class="px-3 py-2 text-slate-500">${escapeHtml(relation.sourceStatus || '-')}</td>
                            <td class="px-3 py-2 text-slate-500">${escapeHtml(formatDateTime(relation.businessDate))}</td>
                          </tr>
                        `,
                      )
                      .join('')
              }
            </tbody>
          </table>
        </div>
      </section>
      ${
        refs.length > 0
          ? `
            <section class="rounded-lg border bg-white p-6">
              <h3 class="text-base font-semibold text-slate-900">记录引用</h3>
              <div class="mt-4 grid gap-3 md:grid-cols-2">
                ${refs
                  .map(
                    (ref) => `
                      <article class="rounded-lg border bg-slate-50 p-4">
                        <p class="text-xs text-slate-500">${escapeHtml(ref.refModule)} / ${escapeHtml(ref.refType)}</p>
                        <p class="mt-2 text-sm font-medium text-slate-900">${escapeHtml(ref.refTitle || ref.refCode || ref.refId)}</p>
                        <p class="mt-1 text-xs text-slate-500">${escapeHtml(ref.refStatus || '-')}</p>
                      </article>
                    `,
                  )
                  .join('')}
              </div>
            </section>
          `
          : ''
      }
    </div>
  `
}

function renderWorkItemAudit(viewModel: ProjectViewModel, node: ProjectNodeViewModel): string {
  const nodeLogs = viewModel.logs.filter(
    (item) =>
      item.title.includes(node.node.workItemTypeName) ||
      item.detail.includes(node.node.workItemTypeName) ||
      item.detail.includes(node.node.projectNodeId),
  )
  return `
    <section class="rounded-lg border bg-white p-6">
      <h3 class="text-base font-semibold text-slate-900">操作日志</h3>
      <div class="mt-4 space-y-4">
        ${(nodeLogs.length > 0 ? nodeLogs : viewModel.logs.slice(0, 8))
          .map(
            (log) => `
              <div class="flex items-start gap-3">
                <span class="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${getLogToneClass(log.tone)}">•</span>
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <p class="text-sm font-medium text-slate-900">${escapeHtml(log.title)}</p>
                    <span class="text-xs text-slate-400">${escapeHtml(formatDateTime(log.time))}</span>
                  </div>
                  <p class="mt-1 text-xs leading-6 text-slate-500">${escapeHtml(log.detail)}</p>
                </div>
              </div>
            `,
          )
          .join('')}
      </div>
    </section>
  `
}

function getDecisionOptions(node: ProjectNodeViewModel): string[] {
  const meta = getDecisionFieldMeta(node.node.workItemTypeCode)
  if (!meta) return ['通过', '驳回']
  const groups = listProjectWorkItemFieldGroups(node.node.workItemTypeCode as PcsProjectWorkItemCode)
  const valueField = groups.flatMap((group) => group.fields).find((field) => field.fieldKey === meta.valueFieldKey)
  if (valueField?.options?.length) {
    return valueField.options.map((item) => item.value)
  }
  return ['通过']
}

function canOpenDecisionAction(node: ProjectNodeViewModel): boolean {
  return Boolean(getDecisionFieldMeta(node.node.workItemTypeCode)) && node.displayStatus !== '未解锁' && !isClosedNodeStatus(node.node.currentStatus)
}

function renderWorkItemDecisionDialog(node: ProjectNodeViewModel | null): string {
  if (!state.decisionDialog.open || state.decisionDialog.source !== 'work-item' || !node) return ''
  const options = getDecisionOptions(node)
  return renderModalShell(
    node.node.workItemTypeCode === 'TEST_CONCLUSION' ? '测款结论判定' : '节点决策',
    `请确认「${node.node.workItemTypeName}」的处理结果。`,
    `
      <div class="grid gap-2 md:grid-cols-${options.length > 3 ? '4' : '3'}">
        ${options
          .map(
            (option) => `
              <button type="button" class="${toClassName(
                'rounded-md border px-3 py-2 text-sm transition',
                state.decisionDialog.value === option
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
              )}" data-pcs-project-action="set-decision-value" data-value="${escapeHtml(option)}">${escapeHtml(option)}</button>
            `,
          )
          .join('')}
      </div>
      <label class="space-y-1">
        <span class="text-xs text-slate-500">处理说明</span>
        <textarea class="min-h-[120px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="请输入本次决策的补充说明" data-pcs-project-field="decision-note">${escapeHtml(state.decisionDialog.note)}</textarea>
      </label>
    `,
    `
      <button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-project-action="close-dialogs">取消</button>
      <button type="button" class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 ${state.decisionDialog.value ? '' : 'opacity-50'}" data-pcs-project-action="confirm-decision" ${state.decisionDialog.value ? '' : 'disabled'}>提交决策</button>
    `,
  )
}

function renderWorkItemRecordDialog(project: PcsProjectRecord, node: ProjectNodeViewModel | null): string {
  if (!state.recordDialog.open || !node) return ''
  const draft = getNodeRecordDraft(project, node)
  return renderModalShell(
    '新增正式记录',
    `为「${node.node.workItemTypeName}」补充一条项目内正式记录。`,
    `
      <label class="space-y-1">
        <span class="text-xs text-slate-500">业务日期</span>
        <input type="date" class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" value="${escapeHtml(draft.businessDate)}" data-pcs-project-field="record-business-date" />
      </label>
      ${renderEditableFieldGroups(project, node, { ...draft, open: true }, true)}
    `,
    `
      <button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-project-action="close-dialogs">取消</button>
      <button type="button" class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-pcs-project-action="save-record">保存记录</button>
    `,
    'max-w-4xl',
  )
}

function renderProjectWorkItemDetailPage(projectId: string, projectNodeId: string): string {
  ensureProjectDemoData()
  ensureWorkItemState(projectId, projectNodeId)
  const viewModel = buildProjectViewModel(projectId)
  if (!viewModel) {
    return `
      <div class="space-y-4 p-6">
        <section class="rounded-lg border bg-white p-8 text-center">
          <h1 class="text-xl font-semibold text-slate-900">项目未找到</h1>
          <button type="button" class="mt-4 inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-nav="/pcs/projects">返回项目列表</button>
        </section>
      </div>
    `
  }

  const node = viewModel.nodes.find((item) => item.node.projectNodeId === projectNodeId) ?? null
  if (!node) {
    return `
      <div class="space-y-4 p-6">
        <section class="rounded-lg border bg-white p-8 text-center">
          <h1 class="text-xl font-semibold text-slate-900">工作项未找到</h1>
          <p class="mt-2 text-sm text-slate-500">当前项目下没有找到对应的工作项节点。</p>
          <button type="button" class="mt-4 inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-nav="/pcs/projects/${escapeHtml(projectId)}">返回项目详情</button>
        </section>
      </div>
    `
  }

  const nature = node.contract.workItemNature || node.definition?.workItemNature || '执行类'
  const canRecord = canUseInlineRecords(node.node.workItemTypeCode) && node.displayStatus !== '未解锁' && node.node.currentStatus !== '已取消'

  return `
    <div class="space-y-6 p-6">
      ${renderNotice()}
      <section class="rounded-lg border bg-white p-6">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="flex items-start gap-4">
            <button type="button" class="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-nav="/pcs/projects/${escapeHtml(projectId)}">
              <i data-lucide="arrow-left" class="h-4 w-4"></i>返回项目
            </button>
            <div class="h-14 border-l border-slate-200"></div>
            <div>
              <div class="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                <span>${escapeHtml(viewModel.project.projectCode)}</span>
                <span>/</span>
                <span>${escapeHtml(viewModel.project.projectName)}</span>
              </div>
              <div class="mt-2 flex flex-wrap items-center gap-2">
                <h1 class="text-2xl font-semibold text-slate-900">${escapeHtml(node.node.workItemTypeName)}</h1>
                <span class="inline-flex rounded-full border px-2 py-0.5 text-xs ${getNatureBadgeClass(nature)}">${escapeHtml(nature)}</span>
                <span class="inline-flex rounded-full px-2 py-0.5 text-xs ${getNodeStatusBadgeClass(node.displayStatus)}">${escapeHtml(node.displayStatus)}</span>
              </div>
              <div class="mt-2 flex flex-wrap items-center gap-4 text-sm text-slate-500">
                <span>负责人：${escapeHtml(node.node.currentOwnerName || viewModel.project.ownerName)}</span>
                <span>更新时间：${escapeHtml(formatDateTime(node.node.updatedAt || node.latestRecord?.updatedAt || viewModel.project.updatedAt))}</span>
              </div>
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            ${
              canOpenDecisionAction(node)
                ? '<button type="button" class="inline-flex h-9 items-center rounded-md bg-amber-500 px-4 text-sm font-medium text-white hover:bg-amber-600" data-pcs-project-action="open-decision" data-source="work-item">做出决策</button>'
                : ''
            }
            ${canRecord ? '<button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-project-action="open-record-dialog">新增记录</button>' : ''}
            ${
              node.displayStatus !== '未解锁' && node.node.currentStatus !== '已完成' && node.node.currentStatus !== '已取消'
                ? '<button type="button" class="inline-flex h-9 items-center rounded-md bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700" data-pcs-project-action="mark-node-complete">标记完成</button>'
                : ''
            }
          </div>
        </div>
      </section>

      ${renderWorkItemTabs(viewModel, node)}

      ${
        state.workItem.activeTab === 'full-info'
          ? renderWorkItemFullInfo(viewModel.project, node)
          : state.workItem.activeTab === 'records'
            ? renderWorkItemRecords(node)
            : state.workItem.activeTab === 'attachments'
              ? renderWorkItemAttachments(node)
              : renderWorkItemAudit(viewModel, node)
      }

      ${renderWorkItemDecisionDialog(node)}
      ${renderWorkItemRecordDialog(viewModel.project, node)}
      ${renderProjectTerminateDialog()}
    </div>
  `
}

export function renderPcsProjectListPage(): string {
  ensureProjectDemoData()
  const { filtered, paged, totalPages } = getPagedProjects()
  return `
    <div class="space-y-6 p-6">
      ${renderNotice()}
      ${renderProjectListHeader()}
      ${renderListToolbar(filtered.length)}
      ${state.list.viewMode === 'list' ? renderProjectListTable(paged, totalPages) : renderProjectGrid(paged, totalPages)}
      ${renderProjectTerminateDialog()}
    </div>
  `
}

export function renderPcsProjectCreatePage(): string {
  return renderCreatePage()
}

export function renderPcsProjectDetailPage(projectId: string): string {
  return renderProjectDetailPage(projectId)
}

export function renderPcsProjectWorkItemDetailPage(projectId: string, projectNodeId: string): string {
  return renderProjectWorkItemDetailPage(projectId, projectNodeId)
}

function closeAllDialogs(): void {
  state.terminateProjectId = null
  state.terminateReason = ''
  state.createCancelOpen = false
  state.decisionDialog = {
    open: false,
    source: 'detail',
    projectId: '',
    projectNodeId: '',
    value: '',
    note: '',
  }
  state.recordDialog = createEmptyRecordDialogState()
}

function getProjectNodeContext(projectId: string, projectNodeId: string): { project: PcsProjectRecord; node: ProjectNodeViewModel } | null {
  const viewModel = buildProjectViewModel(projectId)
  if (!viewModel) return null
  const node = viewModel.nodes.find((item) => item.node.projectNodeId === projectNodeId)
  if (!node) return null
  return {
    project: viewModel.project,
    node,
  }
}

function getCurrentProjectNodeContext(): { project: PcsProjectRecord; node: ProjectNodeViewModel } | null {
  const projectId = state.workItem.projectId || state.detail.projectId || ''
  const projectNodeId = state.workItem.projectNodeId || state.detail.selectedNodeId || ''
  if (!projectId || !projectNodeId) return null
  return getProjectNodeContext(projectId, projectNodeId)
}

function setRecordDraftState(
  project: PcsProjectRecord,
  node: ProjectNodeViewModel,
  patch: Partial<RecordDialogState> = {},
): RecordDialogState {
  const draft = getNodeRecordDraft(project, node)
  state.recordDialog = {
    open: patch.open ?? draft.open,
    projectId: project.projectId,
    projectNodeId: node.node.projectNodeId,
    businessDate: patch.businessDate ?? draft.businessDate,
    note: patch.note ?? draft.note,
    values: patch.values ? { ...draft.values, ...patch.values } : draft.values,
  }
  return state.recordDialog
}

function applyCreateSelection(field: 'brand' | 'owner' | 'team' | 'styleCode', id: string): void {
  const catalog = getProjectCreateCatalog()
  if (field === 'brand') {
    const option = catalog.brands.find((item) => item.id === id)
    state.create.draft.brandId = id
    state.create.draft.brandName = option?.name ?? ''
    return
  }
  if (field === 'owner') {
    const option = catalog.owners.find((item) => item.id === id)
    state.create.draft.ownerId = id
    state.create.draft.ownerName = option?.name ?? ''
    return
  }
  if (field === 'team') {
    const option = catalog.teams.find((item) => item.id === id)
    state.create.draft.teamId = id
    state.create.draft.teamName = option?.name ?? ''
    return
  }
  const option = catalog.styleCodes.find((item) => item.id === id)
  state.create.draft.styleCodeId = id
  state.create.draft.styleCodeName = option?.name ?? ''
  state.create.draft.styleNumber = option?.name ?? ''
}

export function handlePcsProjectsInput(target: Element): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-pcs-project-field]')
  if (!fieldNode) return false
  const field = fieldNode.dataset.pcsProjectField
  if (!field) return false

  if (field === 'list-search' && fieldNode instanceof HTMLInputElement) {
    state.list.search = fieldNode.value
    state.list.currentPage = 1
    return true
  }
  if (field === 'list-sort' && fieldNode instanceof HTMLSelectElement) {
    state.list.sortBy = fieldNode.value as ProjectListSort
    state.list.currentPage = 1
    return true
  }
  if (field === 'list-owner' && fieldNode instanceof HTMLSelectElement) {
    state.list.owner = fieldNode.value
    state.list.currentPage = 1
    return true
  }
  if (field === 'list-phase' && fieldNode instanceof HTMLSelectElement) {
    state.list.phase = fieldNode.value
    state.list.currentPage = 1
    return true
  }
  if (field === 'list-date-range' && fieldNode instanceof HTMLSelectElement) {
    state.list.dateRange = fieldNode.value as ProjectDateRange
    state.list.currentPage = 1
    return true
  }
  if (field === 'create-project-name' && fieldNode instanceof HTMLInputElement) {
    state.create.draft.projectName = fieldNode.value
    state.create.error = null
    return true
  }
  if (field === 'create-project-source' && fieldNode instanceof HTMLSelectElement) {
    state.create.draft.projectSourceType = fieldNode.value as PcsProjectCreateDraft['projectSourceType']
    return true
  }
  if (field === 'create-category' && fieldNode instanceof HTMLSelectElement) {
    const category = getProjectCreateCatalog().categories.find((item) => item.id === fieldNode.value)
    const child = category?.children[0]
    state.create.draft.categoryId = fieldNode.value
    state.create.draft.categoryName = category?.name ?? ''
    state.create.draft.subCategoryId = child?.id ?? ''
    state.create.draft.subCategoryName = child?.name ?? ''
    return true
  }
  if (field === 'create-sub-category' && fieldNode instanceof HTMLSelectElement) {
    const option = getProjectCategoryChildren(state.create.draft.categoryId).find((item) => item.id === fieldNode.value)
    state.create.draft.subCategoryId = fieldNode.value
    state.create.draft.subCategoryName = option?.name ?? ''
    return true
  }
  if (field === 'create-template' && fieldNode instanceof HTMLSelectElement) {
    state.create.draft.templateId = fieldNode.value
    return true
  }
  if (field === 'create-brand' && fieldNode instanceof HTMLSelectElement) {
    applyCreateSelection('brand', fieldNode.value)
    return true
  }
  if (field === 'create-style-code' && fieldNode instanceof HTMLSelectElement) {
    applyCreateSelection('styleCode', fieldNode.value)
    return true
  }
  if (field === 'create-owner' && fieldNode instanceof HTMLSelectElement) {
    applyCreateSelection('owner', fieldNode.value)
    return true
  }
  if (field === 'create-team' && fieldNode instanceof HTMLSelectElement) {
    applyCreateSelection('team', fieldNode.value)
    return true
  }
  if (field === 'create-remark' && fieldNode instanceof HTMLTextAreaElement) {
    state.create.draft.remark = fieldNode.value
    return true
  }
  if (field === 'terminate-reason' && fieldNode instanceof HTMLTextAreaElement) {
    state.terminateReason = fieldNode.value
    return true
  }
  if (field === 'decision-note' && fieldNode instanceof HTMLTextAreaElement) {
    state.decisionDialog.note = fieldNode.value
    return true
  }
  if (field === 'record-business-date' && fieldNode instanceof HTMLInputElement) {
    const context = getCurrentProjectNodeContext()
    if (context) {
      setRecordDraftState(context.project, context.node, {
        open: state.recordDialog.open,
        businessDate: fieldNode.value,
      })
    } else {
      state.recordDialog.businessDate = fieldNode.value
    }
    return true
  }
  if (field === 'record-note' && fieldNode instanceof HTMLTextAreaElement) {
    state.recordDialog.note = fieldNode.value
    return true
  }
  if (field === 'formal-field') {
    const context = getCurrentProjectNodeContext()
    const fieldKey = fieldNode.dataset.fieldKey
    if (!context || !fieldKey) return true
    const value =
      fieldNode instanceof HTMLInputElement || fieldNode instanceof HTMLTextAreaElement || fieldNode instanceof HTMLSelectElement
        ? fieldNode.value
        : ''
    setRecordDraftState(context.project, context.node, {
      open: state.recordDialog.open,
      values: {
        [fieldKey]: value,
      },
    })
    return true
  }

  return false
}

function buildFormalSaveInput(project: PcsProjectRecord, node: ProjectNodeViewModel, draft: RecordDialogState): {
  businessDate: string
  values: Record<string, unknown>
  detailSnapshot: Record<string, unknown>
  missingRequiredLabels: string[]
  businessRuleErrors: string[]
  summaryNote: string
} {
  const groups = listProjectWorkItemFieldGroups(node.node.workItemTypeCode as PcsProjectWorkItemCode)
  const editableKeys = getInlineEditableFieldKeys(node.node.workItemTypeCode)
  const readonlyPayloadKeys = new Set(
    groups
      .flatMap((group) => group.fields)
      .filter((field) => field.readonly && editableKeys.has(field.fieldKey))
      .map((field) => field.fieldKey),
  )
  const normalizedEditableValues = Object.fromEntries(
    groups
      .flatMap((group) => group.fields)
      .filter((field) => !field.readonly && editableKeys.has(field.fieldKey))
      .map((field) => [field.fieldKey, normalizeDraftFieldValue(field, draft.values[field.fieldKey] ?? '')]),
  )
  const summaryNote = draft.note.trim() || deriveRecordSummaryNote(node.node.workItemTypeCode, normalizedEditableValues)
  const quickPayload = buildQuickRecordPayload(project, node.node, {
    businessDate: draft.businessDate || todayText(),
    note: summaryNote,
  })
  const readonlySeedValues = Object.fromEntries(
    Object.entries(quickPayload?.values || {}).filter(([key]) => readonlyPayloadKeys.has(key)),
  )

  const values: Record<string, unknown> = {
    ...readonlySeedValues,
    ...normalizedEditableValues,
  }

  if (node.node.workItemTypeCode === 'TEST_DATA_SUMMARY') {
    const aggregate = getProjectTestingAggregate(project.projectId)
    values.totalExposureQty = aggregate.totalExposureQty
    values.totalClickQty = aggregate.totalClickQty
    values.totalOrderQty = aggregate.totalOrderQty
    values.totalGmvAmount = aggregate.totalGmvAmount
  }

  if (node.node.workItemTypeCode === 'TEST_CONCLUSION') {
    const conclusion = String(values.conclusion || '').trim()
    values.linkedChannelProductCode = getNodeFieldValue(project, node, 'linkedChannelProductCode') || `${project.projectCode}-CP`
    values.invalidationPlanned = conclusion ? conclusion !== '通过' : false
  }

  const missingRequiredLabels = getMissingRequiredFieldLabels(node.node, values)
  const businessRuleErrors = getBusinessRuleValidationErrors(project, node, values)
  const businessDate =
    typeof values.arrivalTime === 'string' && values.arrivalTime.trim()
      ? values.arrivalTime
      : `${draft.businessDate || todayText()} 10:00`

  return {
    businessDate,
    values,
    detailSnapshot: {
      ...(quickPayload?.detailSnapshot || {}),
    },
    missingRequiredLabels,
    businessRuleErrors,
    summaryNote,
  }
}

function updateChannelProductRelationStatus(
  projectId: string,
  sourceStatus: '已生效' | '已作废',
  note: string,
  operatorName = '当前用户',
  timestamp = nowText(),
): void {
  listProjectRelationsByProject(projectId)
    .filter((relation) => relation.sourceModule === '渠道商品' && relation.sourceObjectType === '渠道商品')
    .forEach((relation) => {
      const meta = parseRelationNoteMeta(relation.note)
      upsertProjectRelation({
        ...relation,
        sourceStatus,
        updatedAt: timestamp,
        updatedBy: operatorName,
        note: serializeRelationNoteMeta({
          ...meta,
          channelProductCode: meta.channelProductCode || relation.sourceObjectCode,
          channelProductStatus: sourceStatus,
          invalidatedReason: sourceStatus === '已作废' ? note : '',
        }),
      })
    })
}

function upsertRevisionTaskRelation(
  project: PcsProjectRecord,
  node: ProjectNodeViewModel,
  operatorName = '当前用户',
  timestamp = nowText(),
): { revisionTaskId: string; revisionTaskCode: string } {
  const existing = listProjectRelationsByProject(project.projectId).find((relation) => relation.sourceModule === '改版任务')
  const revisionTaskId = existing?.sourceObjectId || `${project.projectId}-revision-001`
  const revisionTaskCode =
    existing?.sourceObjectCode || `RT-${project.projectCode.split('-').slice(-2).join('-')}`

  upsertProjectRelation({
    projectRelationId: existing?.projectRelationId || '',
    projectId: project.projectId,
    projectCode: project.projectCode,
    projectNodeId: node.node.projectNodeId,
    workItemTypeCode: node.node.workItemTypeCode,
    workItemTypeName: node.node.workItemTypeName,
    relationRole: '产出对象',
    sourceModule: '改版任务',
    sourceObjectType: '改版任务',
    sourceObjectId: revisionTaskId,
    sourceObjectCode: revisionTaskCode,
    sourceLineId: null,
    sourceLineCode: null,
    sourceTitle: `${project.projectName} 改版任务`,
    sourceStatus: '进行中',
    businessDate: timestamp,
    ownerName: project.ownerName,
    createdAt: existing?.createdAt || timestamp,
    createdBy: existing?.createdBy || operatorName,
    updatedAt: timestamp,
    updatedBy: operatorName,
    note: '测款结论调整后，已转入改版推进分支。',
    legacyRefType: existing?.legacyRefType || '',
    legacyRefValue: existing?.legacyRefValue || '',
  })

  return { revisionTaskId, revisionTaskCode }
}

function applyFeasibilityReviewBranch(
  project: PcsProjectRecord,
  node: ProjectNodeViewModel,
  decision: string,
  note: string,
  timestamp = nowText(),
): void {
  const operatorName = '当前用户'
  completeProjectNode(project.projectId, node.node.projectNodeId, {
    operatorName,
    timestamp,
    resultType: decision,
    resultText: note || `初步可行性判断已判定为${decision}。`,
  })

  if (decision === '暂缓') {
    syncProjectLifecycle(project.projectId, operatorName, timestamp)
    updateProjectRecord(
      project.projectId,
      {
        blockedFlag: true,
        blockedReason: note || '可行性判断为暂缓，等待下一轮样衣评估。',
        riskStatus: '延期',
        riskReason: note || '可行性判断为暂缓，等待下一轮样衣评估。',
        riskWorkItem: node.node.workItemTypeName,
        updatedAt: timestamp,
      },
      operatorName,
    )
    state.notice = `${node.node.workItemTypeName}已判定为暂缓，项目当前进入等待评估状态。`
    return
  }

  const target = ['SAMPLE_SHOOT_FIT', 'SAMPLE_CONFIRM']
    .map((workItemTypeCode) => getProjectNodeRecordByWorkItemTypeCode(project.projectId, workItemTypeCode))
    .find((item) => item && item.currentStatus === '未开始')

  if (target) {
    activateProjectNode(project.projectId, target.projectNodeId, {
      operatorName,
      timestamp,
      pendingActionType: decision === '调整' ? '补充评估' : '待执行',
      pendingActionText:
        decision === '调整'
          ? `可行性判断为调整，请继续处理：${target.workItemTypeName}`
          : `当前请处理：${target.workItemTypeName}`,
      latestResultType: decision,
      latestResultText: note || `初步可行性判断已判定为${decision}。`,
    })
  }

  syncProjectLifecycle(project.projectId, operatorName, timestamp)
  updateProjectRecord(
    project.projectId,
    {
      blockedFlag: false,
      blockedReason: '',
      updatedAt: timestamp,
    },
    operatorName,
  )
  state.notice =
    decision === '调整'
      ? `${node.node.workItemTypeName}已判定为调整，已转入补充评估。`
      : `${node.node.workItemTypeName}已判定为通过。`
}

function applySampleConfirmBranch(
  project: PcsProjectRecord,
  node: ProjectNodeViewModel,
  decision: string,
  note: string,
  timestamp = nowText(),
): void {
  const operatorName = '当前用户'

  if (decision === '淘汰') {
    completeProjectNode(project.projectId, node.node.projectNodeId, {
      operatorName,
      timestamp,
      resultType: decision,
      resultText: note || '样衣确认结论为淘汰，项目停止继续推进。',
    })
    terminateProject(project.projectId, note || '样衣确认结论为淘汰，项目停止继续推进。', operatorName, timestamp)
    state.notice = `${node.node.workItemTypeName}已判定为淘汰，并终止当前商品项目。`
    return
  }

  if (decision === '继续调整') {
    updateProjectNodeRecord(
      project.projectId,
      node.node.projectNodeId,
      {
        currentStatus: '进行中',
        latestResultType: '继续调整',
        latestResultText: note || '样衣确认结论为继续调整，需补充试穿反馈后重新确认。',
        pendingActionType: '重新确认',
        pendingActionText: '请补充样衣拍摄与试穿后重新提交样衣确认。',
        updatedAt: timestamp,
        lastEventType: '继续调整',
        lastEventTime: timestamp,
      },
      operatorName,
    )

    const shootFitNode = getProjectNodeRecordByWorkItemTypeCode(project.projectId, 'SAMPLE_SHOOT_FIT')
    if (shootFitNode) {
      activateProjectNode(project.projectId, shootFitNode.projectNodeId, {
        operatorName,
        timestamp,
        pendingActionType: '继续调整',
        pendingActionText: '样衣确认要求继续调整，请补充拍摄与试穿反馈。',
        latestResultType: '继续调整',
        latestResultText: note || '样衣确认要求继续调整。',
      })
    }

    syncProjectLifecycle(project.projectId, operatorName, timestamp)
    state.notice = `${node.node.workItemTypeName}已记录为继续调整，样衣评估链路已重新打开。`
    return
  }

  markNodeCompletedAndUnlockNext(project.projectId, node.node.projectNodeId, {
    operatorName,
    timestamp,
    resultType: decision,
    resultText: note || '样衣确认已通过，可继续进入成本与定价阶段。',
  })
  state.notice = `${node.node.workItemTypeName}已判定为通过。`
}

function applyTestConclusionBranch(
  project: PcsProjectRecord,
  node: ProjectNodeViewModel,
  decision: string,
  note: string,
  timestamp = nowText(),
): void {
  const operatorName = '当前用户'
  completeProjectNode(project.projectId, node.node.projectNodeId, {
    operatorName,
    timestamp,
    resultType: decision,
    resultText: note || `${node.node.workItemTypeName}已判定为${decision}。`,
  })

  if (decision === '淘汰') {
    updateChannelProductRelationStatus(project.projectId, '已作废', note || '测款结论为淘汰，渠道商品已作废。', operatorName, timestamp)
    terminateProject(project.projectId, note || '测款结论为淘汰，项目停止继续推进。', operatorName, timestamp)
    state.notice = `已完成${node.node.workItemTypeName}，并终止当前商品项目。`
    return
  }

  if (decision === '通过') {
    const nextTarget = ['STYLE_ARCHIVE_CREATE', 'PROJECT_TRANSFER_PREP', 'SAMPLE_RETAIN_REVIEW']
      .map((workItemTypeCode) => getProjectNodeRecordByWorkItemTypeCode(project.projectId, workItemTypeCode))
      .find((item) => item && item.currentStatus === '未开始')

    if (nextTarget) {
      activateProjectNode(project.projectId, nextTarget.projectNodeId, {
        operatorName,
        timestamp,
        pendingActionType: '待执行',
        pendingActionText: `测款通过，请处理：${nextTarget.workItemTypeName}`,
        latestResultType: '测款通过',
        latestResultText: '测款结论已通过，当前进入正式转档链路。',
      })
    }

    updateChannelProductRelationStatus(project.projectId, '已生效', note || '测款通过，当前渠道商品已正式生效。', operatorName, timestamp)
    syncProjectLifecycle(project.projectId, operatorName, timestamp)
    updateProjectRecord(
      project.projectId,
      {
        blockedFlag: false,
        blockedReason: '',
        riskStatus: '正常',
        riskReason: '',
        riskWorkItem: '',
        updatedAt: timestamp,
      },
      operatorName,
    )
    state.notice = `${node.node.workItemTypeName}已判定为通过，并进入款式档案链路。`
    return
  }

  if (decision === '调整') {
    const branchNote = note || '测款结论为调整，当前转入改版推进分支。'
    ;['STYLE_ARCHIVE_CREATE', 'PROJECT_TRANSFER_PREP']
      .map((workItemTypeCode) => getProjectNodeRecordByWorkItemTypeCode(project.projectId, workItemTypeCode))
      .filter((item): item is PcsProjectNodeRecord => Boolean(item))
      .forEach((item) => {
        cancelProjectNode(project.projectId, item.projectNodeId, '测款结论为调整，当前节点改由改版分支继续推进。', operatorName, timestamp)
      })

    const revision = upsertRevisionTaskRelation(project, node, operatorName, timestamp)
    saveProjectInlineNodeFieldEntry(
      project.projectId,
      node.node.projectNodeId,
      {
        businessDate: timestamp,
        values: {},
        detailSnapshot: {
          revisionTaskId: revision.revisionTaskId,
          revisionTaskCode: revision.revisionTaskCode,
        },
      },
      operatorName,
    )

    const branchTargets = ['PATTERN_TASK', 'PATTERN_ARTWORK_TASK', 'FIRST_SAMPLE']
      .map((workItemTypeCode) => getProjectNodeRecordByWorkItemTypeCode(project.projectId, workItemTypeCode))
      .filter((item): item is PcsProjectNodeRecord => Boolean(item) && item.currentStatus === '未开始')

    if (branchTargets.length > 0) {
      const primaryTargets = branchTargets.filter((item) => item.workItemTypeCode === 'PATTERN_TASK' || item.workItemTypeCode === 'PATTERN_ARTWORK_TASK')
      const targetsToActivate = primaryTargets.length > 0 ? primaryTargets : [branchTargets[0]]
      targetsToActivate.forEach((item) => {
        activateProjectNode(project.projectId, item.projectNodeId, {
          operatorName,
          timestamp,
          pendingActionType: '改版推进',
          pendingActionText: `测款调整，请处理：${item.workItemTypeName}`,
          latestResultType: '改版分支',
          latestResultText: branchNote,
        })
      })
    }

    updateChannelProductRelationStatus(project.projectId, '已作废', branchNote, operatorName, timestamp)
    syncProjectLifecycle(project.projectId, operatorName, timestamp)
    updateProjectRecord(
      project.projectId,
      {
        blockedFlag: false,
        blockedReason: '',
        riskStatus: '正常',
        riskReason: '',
        riskWorkItem: '',
        updatedAt: timestamp,
      },
      operatorName,
    )
    state.notice = `${node.node.workItemTypeName}已判定为调整，已转入改版推进分支。`
    return
  }

  const pauseReason = note || '测款结论为暂缓，等待下一轮重新评估。'
  updateChannelProductRelationStatus(project.projectId, '已作废', pauseReason, operatorName, timestamp)
  syncProjectLifecycle(project.projectId, operatorName, timestamp)
  updateProjectRecord(
    project.projectId,
    {
      blockedFlag: true,
      blockedReason: pauseReason,
      riskStatus: '延期',
      riskReason: pauseReason,
      riskWorkItem: node.node.workItemTypeName,
      updatedAt: timestamp,
    },
    operatorName,
  )
  state.notice = `${node.node.workItemTypeName}已判定为暂缓，项目当前进入阻塞等待。`
}

function routeNodeAfterFormalSave(
  project: PcsProjectRecord,
  node: ProjectNodeViewModel,
  values: Record<string, unknown>,
  summaryNote: string,
  timestamp = nowText(),
): void {
  if (node.node.workItemTypeCode === 'FEASIBILITY_REVIEW') {
    applyFeasibilityReviewBranch(project, node, String(values.reviewConclusion || '').trim(), summaryNote, timestamp)
    return
  }
  if (node.node.workItemTypeCode === 'SAMPLE_CONFIRM') {
    applySampleConfirmBranch(project, node, String(values.confirmResult || '').trim(), summaryNote, timestamp)
    return
  }
  if (node.node.workItemTypeCode === 'TEST_CONCLUSION') {
    applyTestConclusionBranch(project, node, String(values.conclusion || '').trim(), summaryNote, timestamp)
    return
  }

  markNodeCompletedAndUnlockNext(project.projectId, node.node.projectNodeId, {
    operatorName: '当前用户',
    timestamp,
    resultType: '节点完成',
    resultText: summaryNote,
  })
  state.notice = `${node.node.workItemTypeName}已保存并流转。`
}

function saveFormalRecord(input: { completeAfterSave?: boolean; closeAfterSave?: boolean } = {}): void {
  const projectId = state.recordDialog.projectId || state.workItem.projectId || state.detail.projectId || ''
  const projectNodeId = state.recordDialog.projectNodeId || state.workItem.projectNodeId || state.detail.selectedNodeId || ''
  if (!projectId || !projectNodeId) {
    closeAllDialogs()
    return
  }

  const context = getProjectNodeContext(projectId, projectNodeId)
  if (!context || !canUseInlineRecords(context.node.node.workItemTypeCode)) {
    closeAllDialogs()
    return
  }

  const draft = getNodeRecordDraft(context.project, context.node)
  const payload = buildFormalSaveInput(context.project, context.node, draft)
  if (payload.businessRuleErrors.length > 0) {
    state.notice = payload.businessRuleErrors.join(' ')
    if (input.closeAfterSave) {
      closeAllDialogs()
    }
    return
  }
  const result = saveProjectInlineNodeFieldEntry(
    projectId,
    projectNodeId,
    {
      businessDate: payload.businessDate,
      values: payload.values,
      detailSnapshot: payload.detailSnapshot,
    },
    '当前用户',
  )

  if (!result.ok) {
    state.notice = result.message
    if (input.closeAfterSave) closeAllDialogs()
    return
  }

  if (input.completeAfterSave) {
    if (payload.missingRequiredLabels.length > 0) {
      state.notice = `${result.message} 当前未完成节点流转。`
      if (input.closeAfterSave) {
        closeAllDialogs()
      } else {
        state.recordDialog = createEmptyRecordDialogState()
      }
      return
    }

    const timestamp = nowText()
    routeNodeAfterFormalSave(context.project, context.node, payload.values, payload.summaryNote, timestamp)
  } else {
    state.notice = result.message
  }

  if (input.closeAfterSave) {
    closeAllDialogs()
  } else {
    state.recordDialog = createEmptyRecordDialogState()
  }
}

function openDecisionDialog(source: DecisionDialogSource): void {
  const projectId =
    source === 'detail'
      ? state.detail.projectId || ''
      : state.workItem.projectId || ''
  const projectNodeId =
    source === 'detail'
      ? state.detail.selectedNodeId || ''
      : state.workItem.projectNodeId || ''
  const context = projectId && projectNodeId ? getProjectNodeContext(projectId, projectNodeId) : null
  if (!context) return
  const draft = getNodeRecordDraft(context.project, context.node)
  const options = getDecisionOptions(context.node)
  const decisionFieldMeta = getDecisionFieldMeta(context.node.node.workItemTypeCode)
  state.decisionDialog = {
    open: true,
    source,
    projectId,
    projectNodeId,
    value:
      String(
        (decisionFieldMeta ? context.node.latestRecord?.payload?.[decisionFieldMeta.valueFieldKey] : '') ||
          (decisionFieldMeta ? draft.values[decisionFieldMeta.valueFieldKey] : '') ||
          options[0] ||
          '通过',
      ) || '通过',
    note:
      String(
        (decisionFieldMeta ? context.node.latestRecord?.payload?.[decisionFieldMeta.noteFieldKey] : '') ||
          (decisionFieldMeta ? draft.values[decisionFieldMeta.noteFieldKey] : '') ||
          '',
      ) || '',
  }
}

function confirmDecision(): void {
  const dialog = state.decisionDialog
  const context = getProjectNodeContext(dialog.projectId, dialog.projectNodeId)
  if (!context) {
    closeAllDialogs()
    return
  }

  const timestamp = nowText()
  const note = dialog.note.trim() || `${context.node.node.workItemTypeName}已判定为${dialog.value}。`
  const decisionFieldMeta = getDecisionFieldMeta(context.node.node.workItemTypeCode)
  if (!decisionFieldMeta) {
    closeAllDialogs()
    return
  }
  const saveResult = saveProjectInlineNodeFieldEntry(
    dialog.projectId,
    dialog.projectNodeId,
    {
      businessDate: timestamp,
      values: {
        [decisionFieldMeta.valueFieldKey]: dialog.value,
        [decisionFieldMeta.noteFieldKey]: note,
        ...(context.node.node.workItemTypeCode === 'TEST_CONCLUSION'
          ? {
              linkedChannelProductCode:
                getNodeFieldValue(context.project, context.node, 'linkedChannelProductCode') || `${context.project.projectCode}-CP`,
              invalidationPlanned: dialog.value !== '通过',
            }
          : {}),
      },
      detailSnapshot:
        context.node.node.workItemTypeCode === 'TEST_CONCLUSION'
          ? {
              channelProductCode: `${context.project.projectCode}-CP`,
              upstreamChannelProductCode: `${context.project.projectCode}-UP`,
              projectTerminated: dialog.value === '淘汰',
              projectTerminatedAt: dialog.value === '淘汰' ? timestamp : '',
            }
          : undefined,
    },
    '当前用户',
  )

  if (!saveResult.ok) {
    state.notice = saveResult.message
    closeAllDialogs()
    return
  }

  routeNodeAfterFormalSave(
    context.project,
    context.node,
    {
      [decisionFieldMeta.valueFieldKey]: dialog.value,
      [decisionFieldMeta.noteFieldKey]: note,
    },
    note,
    timestamp,
  )

  closeAllDialogs()
}

function saveQuickRecord(): void {
  saveFormalRecord({ closeAfterSave: true })
}

export function handlePcsProjectsEvent(target: HTMLElement): boolean {
  const actionNode = target.closest<HTMLElement>('[data-pcs-project-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.pcsProjectAction
  if (!action) return false

  if (action === 'close-notice') {
    state.notice = null
    return true
  }
  if (action === 'query') {
    state.list.currentPage = 1
    return true
  }
  if (action === 'reset-list') {
    state.list = { ...initialListState }
    return true
  }
  if (action === 'toggle-advanced') {
    state.list.advancedOpen = !state.list.advancedOpen
    return true
  }
  if (action === 'set-style-filter') {
    state.list.styleType = actionNode.dataset.value || '全部'
    state.list.currentPage = 1
    return true
  }
  if (action === 'set-status-filter') {
    state.list.status = actionNode.dataset.value || '全部'
    state.list.currentPage = 1
    return true
  }
  if (action === 'set-risk-filter') {
    state.list.riskStatus = actionNode.dataset.value || '全部'
    state.list.currentPage = 1
    return true
  }
  if (action === 'toggle-pending-decision') {
    state.list.pendingDecisionOnly = !state.list.pendingDecisionOnly
    state.list.currentPage = 1
    return true
  }
  if (action === 'set-view-mode') {
    state.list.viewMode = actionNode.dataset.value === 'grid' ? 'grid' : 'list'
    return true
  }
  if (action === 'set-page') {
    const page = Number.parseInt(actionNode.dataset.page ?? '', 10)
    if (Number.isFinite(page) && page > 0) {
      state.list.currentPage = page
    }
    return true
  }
  if (action === 'open-terminate') {
    state.terminateProjectId = actionNode.dataset.projectId || null
    state.terminateReason = ''
    return true
  }
  if (action === 'confirm-terminate') {
    if (state.terminateProjectId && state.terminateReason.trim()) {
      terminateProject(state.terminateProjectId, state.terminateReason.trim(), '当前用户')
      state.notice = '项目已终止。'
    }
    closeAllDialogs()
    return true
  }
  if (action === 'archive-project') {
    const projectId = actionNode.dataset.projectId
    if (!projectId) return true
    const result = archiveProject(projectId)
    state.notice = result.message
    return true
  }
  if (action === 'select-style-type') {
    const styleType = actionNode.dataset.styleType as TemplateStyleType | undefined
    if (!styleType) return true
    const template = getTemplateByStyleType(styleType)
    state.create.draft.styleType = styleType
    state.create.draft.projectType = getProjectTypeLabel(styleType)
    state.create.draft.templateId = template?.id ?? ''
    state.create.error = null
    return true
  }
  if (action === 'toggle-style-tag') {
    const tag = actionNode.dataset.value
    if (!tag) return true
    state.create.draft.styleTagNames = state.create.draft.styleTagNames.includes(tag)
      ? state.create.draft.styleTagNames.filter((item) => item !== tag)
      : [...state.create.draft.styleTagNames, tag]
    state.create.draft.styleTags = [...state.create.draft.styleTagNames]
    return true
  }
  if (action === 'toggle-channel') {
    const channelCode = actionNode.dataset.value
    if (!channelCode) return true
    state.create.draft.targetChannelCodes = state.create.draft.targetChannelCodes.includes(channelCode)
      ? state.create.draft.targetChannelCodes.filter((item) => item !== channelCode)
      : [...state.create.draft.targetChannelCodes, channelCode]
    return true
  }
  if (action === 'open-create-cancel') {
    state.createCancelOpen = hasCreateDraftChanges()
    if (!state.createCancelOpen) {
      appStore.navigate('/pcs/projects')
    }
    return true
  }
  if (action === 'confirm-create-cancel') {
    closeAllDialogs()
    appStore.navigate('/pcs/projects')
    return true
  }
  if (action === 'save-draft') {
    state.notice = '草稿已暂存，仅当前会话有效。'
    appStore.navigate('/pcs/projects')
    return true
  }
  if (action === 'create-project') {
    try {
      const created = createProject(state.create.draft, '当前用户')
      state.notice = `项目「${created.project.projectName}」已创建。`
      state.create.routeKey = ''
      closeAllDialogs()
      appStore.navigate(`/pcs/projects/${created.project.projectId}`)
    } catch (error) {
      state.create.error = error instanceof Error ? error.message : '创建项目失败，请稍后重试。'
    }
    return true
  }
  if (action === 'toggle-phase') {
    const phaseCode = actionNode.dataset.phaseCode
    if (!phaseCode) return true
    state.detail.expandedPhases[phaseCode] = state.detail.expandedPhases[phaseCode] === false
    return true
  }
  if (action === 'select-node') {
    const projectNodeId = actionNode.dataset.projectNodeId
    if (!projectNodeId) return true
    state.detail.selectedNodeId = projectNodeId
    return true
  }
  if (action === 'approve-init') {
    if (!state.detail.projectId) return true
    const result = approveProjectInit(state.detail.projectId, '当前用户')
    syncProjectLifecycle(state.detail.projectId, '当前用户')
    state.notice = result.message
    if (result.nextNode) {
      state.detail.selectedNodeId = result.nextNode.projectNodeId
    }
    return true
  }
  if (action === 'mark-node-complete') {
    const projectId = state.workItem.projectId || state.detail.projectId
    const projectNodeId = state.workItem.projectNodeId || state.detail.selectedNodeId
    if (!projectId || !projectNodeId) return true
    const node = getProjectNodeRecordById(projectId, projectNodeId)
    if (!node) return true
    markNodeCompletedAndUnlockNext(projectId, projectNodeId, {
      operatorName: '当前用户',
      resultType: '手动完成',
      resultText: `${node.workItemTypeName}已手动标记完成。`,
    })
    state.notice = `${node.workItemTypeName}已标记完成。`
    return true
  }
  if (action === 'open-decision') {
    openDecisionDialog((actionNode.dataset.source as DecisionDialogSource) || 'detail')
    return true
  }
  if (action === 'set-decision-value') {
    state.decisionDialog.value = actionNode.dataset.value || ''
    return true
  }
  if (action === 'confirm-decision') {
    confirmDecision()
    return true
  }
  if (action === 'switch-work-item-tab') {
    state.workItem.activeTab = normalizeWorkItemTab(actionNode.dataset.tab ?? null)
    return true
  }
  if (action === 'save-formal-fields') {
    saveFormalRecord()
    return true
  }
  if (action === 'save-formal-fields-and-complete') {
    saveFormalRecord({ completeAfterSave: true })
    return true
  }
  if (action === 'open-record-dialog') {
    const context = getCurrentProjectNodeContext()
    if (!context) return true
    const draft = getNodeRecordDraft(context.project, context.node)
    state.recordDialog = {
      ...draft,
      open: true,
    }
    return true
  }
  if (action === 'save-record') {
    saveQuickRecord()
    return true
  }
  if (action === 'close-dialogs') {
    closeAllDialogs()
    return true
  }

  return false
}

export function isPcsProjectsDialogOpen(): boolean {
  return Boolean(
    state.terminateProjectId ||
      state.createCancelOpen ||
      state.decisionDialog.open ||
      state.recordDialog.open,
  )
}
