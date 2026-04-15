import { appStore } from '../state/store.ts'
import { escapeHtml, formatDateTime, toClassName } from '../utils.ts'
import {
  createEmptyProjectDraft,
  createProject,
  getChannelNamesByCodes,
  getProjectById,
  getProjectCategoryChildren,
  getProjectCreateCatalog,
  listActiveProjectTemplates,
  listProjectNodes,
  listProjectPhases,
  listProjects,
} from '../data/pcs-project-repository.ts'
import type {
  PcsProjectCreateDraft,
  PcsProjectNodeRecord,
  PcsProjectPhaseRecord,
  PcsProjectRecord,
  PcsProjectViewRecord,
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
} from '../data/pcs-project-inline-node-record-repository.ts'
import {
  PCS_PROJECT_INLINE_NODE_RECORD_WORK_ITEM_TYPES,
  type PcsProjectInlineNodeRecord,
  type PcsProjectInlineNodeRecordWorkItemTypeCode,
} from '../data/pcs-project-inline-node-record-types.ts'
import type { ProjectRelationRecord } from '../data/pcs-project-relation-types.ts'
import {
  type ProjectTestingSummaryBreakdownItem,
  getProjectTestingSummaryAggregate,
  listProjectChannelProductsByProjectId,
} from '../data/pcs-channel-product-project-repository.ts'
import {
  resolvePcsStoreCurrency,
  resolvePcsStoreDisplayName,
} from '../data/pcs-channel-store-master.ts'
import {
  getProjectArchiveById,
  getProjectArchiveByProjectId,
} from '../data/pcs-project-archive-repository.ts'
import {
  getTechnicalDataVersionById,
  listTechnicalDataVersionsByStyleId,
} from '../data/pcs-technical-data-version-repository.ts'
import { buildTechPackVersionSourceTaskSummary } from '../data/pcs-tech-pack-task-generation.ts'
import { getPlateMakingTaskById } from '../data/pcs-plate-making-repository.ts'
import { getPatternTaskById } from '../data/pcs-pattern-task-repository.ts'
import { getFirstSampleTaskById } from '../data/pcs-first-sample-repository.ts'
import { getPreProductionSampleTaskById } from '../data/pcs-pre-production-sample-repository.ts'
import { getSampleAssetByCode, getSampleAssetById } from '../data/pcs-sample-asset-repository.ts'
import { listSampleLedgerEventsBySample } from '../data/pcs-sample-ledger-repository.ts'
import {
  findLatestNodeInstance,
  findLatestProjectInstance,
  getProjectInstanceFieldValue,
  getProjectInstanceModel,
  type PcsProjectInstanceItem,
  type PcsProjectInstanceModel,
  type PcsProjectNodeInstanceModel,
} from '../data/pcs-project-instance-model.ts'
import {
  approveProjectInitAndSync,
  archiveProject,
  isClosedProjectNodeStatus,
  markProjectNodeCompletedAndUnlockNext,
  saveProjectNodeFormalRecord,
  syncProjectLifecycle,
  terminateProject,
} from '../data/pcs-project-flow-service.ts'
import { ensurePcsProjectDemoDataReady } from '../data/pcs-project-demo-seed-service.ts'

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
  instanceModel: PcsProjectNodeInstanceModel
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
  project: PcsProjectViewRecord
  instanceModel: PcsProjectInstanceModel
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

function renderReadonlyValue(value: unknown): string {
  if (Array.isArray(value)) {
    const items = value.map((item) => String(item).trim()).filter(Boolean)
    if (items.length === 0) {
      return '<span>-</span>'
    }
    return `
      <div class="space-y-1">
        ${items
          .map(
            (item) => `
              <div class="rounded-md bg-white px-2.5 py-2 text-sm leading-6 text-slate-700">${escapeHtml(item)}</div>
            `,
          )
          .join('')}
      </div>
    `
  }
  return `<span>${escapeHtml(formatValue(value))}</span>`
}

function isClosedNodeStatus(status: ProjectNodeStatus): boolean {
  return isClosedProjectNodeStatus(status)
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
  TEST_DATA_SUMMARY: [
    'summaryText',
    'totalExposureQty',
    'totalClickQty',
    'totalOrderQty',
    'totalGmvAmount',
    'channelBreakdownLines',
    'storeBreakdownLines',
    'channelProductBreakdownLines',
    'testingSourceBreakdownLines',
    'currencyBreakdownLines',
  ],
  TEST_CONCLUSION: [
    'conclusion',
    'conclusionNote',
    'linkedChannelProductCode',
    'invalidationPlanned',
    'revisionTaskId',
    'revisionTaskCode',
    'linkedStyleId',
    'linkedStyleCode',
    'invalidatedChannelProductId',
    'projectTerminated',
    'projectTerminatedAt',
    'nextActionType',
  ],
  SAMPLE_RETAIN_REVIEW: ['retainResult', 'retainNote'],
  SAMPLE_RETURN_HANDLE: ['returnResult'],
}

function getInlineEditableFieldKeys(workItemTypeCode: string): Set<string> {
  if (!canUseInlineRecords(workItemTypeCode)) return new Set()
  return new Set(INLINE_NODE_PAYLOAD_KEYS[workItemTypeCode])
}

function buildInstanceFieldMap(instance: PcsProjectInstanceItem | null | undefined): Record<string, string> {
  if (!instance) return {}
  return instance.fields.reduce<Record<string, string>>((result, field) => {
    if (field.fieldKey) result[field.fieldKey] = field.value
    return result
  }, {})
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
): PcsProjectInstanceItem | null {
  return findLatestProjectInstance(
    projectId,
    (instance) =>
      instance.sourceLayer === '正式业务对象' &&
      instance.moduleName === sourceModule &&
      (sourceObjectType ? instance.objectType === sourceObjectType : true),
  )
}

function findLatestNodeRelation(
  projectId: string,
  projectNodeId: string,
  sourceModule: ProjectRelationRecord['sourceModule'],
  sourceObjectType?: ProjectRelationRecord['sourceObjectType'],
): PcsProjectInstanceItem | null {
  return findLatestNodeInstance(
    projectId,
    projectNodeId,
    (instance) =>
      instance.sourceLayer === '正式业务对象' &&
      instance.moduleName === sourceModule &&
      (sourceObjectType ? instance.objectType === sourceObjectType : true),
  )
}

function buildFallbackUpstreamChannelProductCode(channelProductCode: string, projectCode: string): string {
  if (channelProductCode) return `${channelProductCode}-UP`
  return `${projectCode}-UP`
}

function resolveSampleAcceptedAt(
  sampleAssetId: string,
  fallbackAcceptedAt: string,
  fallbackStatus: string,
  fallbackUpdatedAt: string,
): string {
  if (fallbackAcceptedAt) return fallbackAcceptedAt
  if (sampleAssetId) {
    const event = listSampleLedgerEventsBySample(sampleAssetId).find(
      (item) => item.eventType === 'DELIVER_SIGNED' || item.eventType === 'RECEIVE_ARRIVAL',
    )
    if (event?.businessDate) return event.businessDate
  }
  if (fallbackStatus === '已到样待入库' || fallbackStatus === '验收中' || fallbackStatus === '已完成') {
    return fallbackUpdatedAt
  }
  return ''
}

function resolveSampleConfirmedAt(
  sampleAssetId: string,
  fallbackConfirmedAt: string,
  fallbackStatus: string,
  fallbackUpdatedAt: string,
): string {
  if (fallbackConfirmedAt) return fallbackConfirmedAt
  if (sampleAssetId) {
    const event = listSampleLedgerEventsBySample(sampleAssetId).find((item) => item.eventType === 'CHECKIN_VERIFY')
    if (event?.businessDate) return event.businessDate
  }
  if (fallbackStatus === '已完成') return fallbackUpdatedAt
  return ''
}

function getCurrentProjectArchiveRecord(project: PcsProjectRecord) {
  return (project.projectArchiveId ? getProjectArchiveById(project.projectArchiveId) : null) || getProjectArchiveByProjectId(project.projectId)
}

function getProjectTechPackContext(project: PcsProjectRecord, linkedStyleId: string) {
  const versions = linkedStyleId ? listTechnicalDataVersionsByStyleId(linkedStyleId) : []
  const currentVersion =
    (project.linkedTechPackVersionId ? getTechnicalDataVersionById(project.linkedTechPackVersionId) : null) ||
    (project.linkedTechPackVersionCode
      ? versions.find((item) => item.technicalVersionCode === project.linkedTechPackVersionCode)
      : null) ||
    versions[0] ||
    null
  const previousVersion = currentVersion
    ? versions.find((item) => item.technicalVersionId !== currentVersion.technicalVersionId) || null
    : null
  const sourceSummary = currentVersion ? buildTechPackVersionSourceTaskSummary(currentVersion) : null
  return { currentVersion, previousVersion, versions, sourceSummary }
}

function formatSignedNumber(value: number): string {
  if (!Number.isFinite(value)) return '0'
  if (value > 0) return `+${value}`
  return String(value)
}

function buildTechPackVersionDiffSummary(
  currentVersion: ReturnType<typeof getTechnicalDataVersionById>,
  previousVersion: ReturnType<typeof getTechnicalDataVersionById>,
): string[] {
  if (!currentVersion) return ['尚未关联当前技术包版本。']

  const currentSummary = `当前版本：${currentVersion.technicalVersionCode} / ${currentVersion.versionLabel} / ${getTechPackVersionStatusText(currentVersion.versionStatus)}`
  if (!previousVersion) {
    return [
      currentSummary,
      currentVersion.baseTechnicalVersionCode
        ? `历史差异：当前版本基于 ${currentVersion.baseTechnicalVersionCode} 演进，但暂无可直接对比的历史正式版本。`
        : '历史差异：当前为首个技术包版本，无历史版本差异基线。',
    ]
  }

  const previousSummary = `上一版本：${previousVersion.technicalVersionCode} / ${previousVersion.versionLabel} / ${getTechPackVersionStatusText(previousVersion.versionStatus)}`
  const previousMissing = new Set((previousVersion.missingItemNames || []).map((item) => String(item).trim()).filter(Boolean))
  const currentMissing = new Set((currentVersion.missingItemNames || []).map((item) => String(item).trim()).filter(Boolean))
  const resolvedItems = [...previousMissing].filter((item) => !currentMissing.has(item))
  const addedItems = [...currentMissing].filter((item) => !previousMissing.has(item))

  return [
    currentSummary,
    previousSummary,
    `完整度变化：${formatSignedNumber(currentVersion.completenessScore - previousVersion.completenessScore)} 分`,
    `补齐项：${resolvedItems.length > 0 ? resolvedItems.join('、') : '无'}`,
    `新增缺失：${addedItems.length > 0 ? addedItems.join('、') : '无'}`,
  ]
}

function getTestConclusionNextActionType(decision: string): string {
  if (decision === '通过') return '生成款式档案'
  if (decision === '调整') return '等待改版完成'
  if (decision === '暂缓') return '等待重新评估'
  if (decision === '淘汰') return '项目关闭'
  return ''
}

function buildTestConclusionOutcomeValues(
  project: PcsProjectRecord,
  node: ProjectNodeViewModel,
  decision: string,
  timestamp: string,
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  const currentChannelProduct = getCurrentChannelProductRelation(project.projectId)
  const linkedChannelProductCode = String(
    overrides.linkedChannelProductCode ??
      getNodeFieldValue(project, node, 'linkedChannelProductCode') ??
      currentChannelProduct?.sourceObjectCode ??
      `${project.projectCode}-CP`,
  )

  return {
    linkedChannelProductCode,
    invalidationPlanned: decision ? decision !== '通过' : false,
    revisionTaskId:
      decision === '调整'
        ? String(overrides.revisionTaskId ?? getNodeFieldValue(project, node, 'revisionTaskId') ?? '')
        : '',
    revisionTaskCode:
      decision === '调整'
        ? String(overrides.revisionTaskCode ?? getNodeFieldValue(project, node, 'revisionTaskCode') ?? '')
        : '',
    linkedStyleId:
      decision === '通过'
        ? String(overrides.linkedStyleId ?? getNodeFieldValue(project, node, 'linkedStyleId') ?? project.linkedStyleId ?? '')
        : '',
    linkedStyleCode:
      decision === '通过'
        ? String(overrides.linkedStyleCode ?? getNodeFieldValue(project, node, 'linkedStyleCode') ?? project.linkedStyleCode ?? '')
        : '',
    invalidatedChannelProductId:
      decision && decision !== '通过'
        ? String(overrides.invalidatedChannelProductId ?? currentChannelProduct?.sourceObjectId ?? '')
        : '',
    projectTerminated: decision === '淘汰',
    projectTerminatedAt:
      decision === '淘汰'
        ? String(overrides.projectTerminatedAt ?? getNodeFieldValue(project, node, 'projectTerminatedAt') ?? timestamp)
        : '',
    nextActionType: String(overrides.nextActionType ?? getTestConclusionNextActionType(decision)),
  }
}

function getCurrentChannelProductRelation(projectId: string): PcsProjectInstanceItem | null {
  return (
    findLatestProjectRelation(projectId, '渠道店铺商品', '渠道店铺商品') ||
    findLatestProjectRelation(projectId, '渠道商品', '渠道商品')
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
  channelBreakdownLines: string[]
  storeBreakdownLines: string[]
  channelProductBreakdownLines: string[]
  testingSourceBreakdownLines: string[]
  currencyBreakdownLines: string[]
  channelBreakdowns: ProjectTestingSummaryBreakdownItem[]
  storeBreakdowns: ProjectTestingSummaryBreakdownItem[]
  channelProductBreakdowns: ProjectTestingSummaryBreakdownItem[]
  testingSourceBreakdowns: ProjectTestingSummaryBreakdownItem[]
  currencyBreakdowns: ProjectTestingSummaryBreakdownItem[]
} {
  return getProjectTestingSummaryAggregate(projectId)
}

function getNodeFieldValue(project: PcsProjectRecord, node: ProjectNodeViewModel, fieldKey: string): unknown {
  const payload = (node.latestRecord?.payload || {}) as Record<string, unknown>
  const detailSnapshot = (node.latestRecord?.detailSnapshot || {}) as Record<string, unknown>
  const latestFormalNodeInstance =
    node.instanceModel.instances.find((item) => item.sourceLayer === '正式业务对象') || null
  const nodeRelationMeta = buildInstanceFieldMap(latestFormalNodeInstance)
  const currentChannelProduct = getCurrentChannelProductRelation(project.projectId)
  const currentChannelMeta = buildInstanceFieldMap(currentChannelProduct)
  const styleRelation = findLatestProjectRelation(project.projectId, '款式档案', '款式档案')
  const styleMeta = buildInstanceFieldMap(styleRelation)
  const revisionRelation = findLatestProjectRelation(project.projectId, '改版任务', '改版任务')
  const revisionMeta = buildInstanceFieldMap(revisionRelation)
  const projectArchiveRelation = findLatestProjectRelation(project.projectId, '项目资料归档', '项目资料归档')
  const projectArchiveMeta = buildInstanceFieldMap(projectArchiveRelation)
  const plateRelation = findLatestNodeRelation(project.projectId, node.node.projectNodeId, '制版任务', '制版任务')
  const plateTask = plateRelation ? getPlateMakingTaskById(plateRelation.sourceObjectId || plateRelation.instanceId) : null
  const artworkRelation = findLatestNodeRelation(project.projectId, node.node.projectNodeId, '花型任务', '花型任务')
  const artworkTask = artworkRelation ? getPatternTaskById(artworkRelation.sourceObjectId || artworkRelation.instanceId) : null
  const firstSampleRelation = findLatestNodeRelation(project.projectId, node.node.projectNodeId, '首版样衣打样', '首版样衣打样任务')
  const firstSampleTask = firstSampleRelation
    ? getFirstSampleTaskById(firstSampleRelation.sourceObjectId || firstSampleRelation.instanceId)
    : null
  const preProductionRelation = findLatestNodeRelation(project.projectId, node.node.projectNodeId, '产前版样衣', '产前版样衣任务')
  const preProductionTask = preProductionRelation
    ? getPreProductionSampleTaskById(preProductionRelation.sourceObjectId || preProductionRelation.instanceId)
    : null
  const currentEngineeringTask =
    plateTask || artworkTask || firstSampleTask || preProductionTask || null
  const testingAggregate = getProjectTestingAggregate(project.projectId)
  const defaultChannelCode = getFirstTargetChannelCode(project)
  const defaultChannelName = getChannelDisplayName(defaultChannelCode)
  const currentChannelCode = String(currentChannelMeta.channelCode || nodeRelationMeta.channelCode || defaultChannelCode)
  const currentStoreId = String(currentChannelMeta.storeId || nodeRelationMeta.storeId || '')
  const currentChannelName = String(
    currentChannelMeta.channelName || nodeRelationMeta.channelName || getChannelDisplayName(currentChannelCode),
  )
  const currentStoreName = String(
    currentStoreId
      ? getStoreDisplayName(currentStoreId, currentChannelCode)
      : currentChannelMeta.storeName || nodeRelationMeta.storeName || '-',
  )
  const currentCurrency = String(
    currentStoreId
      ? resolvePcsStoreCurrency(currentStoreId, currentChannelCode)
      : currentChannelMeta.currency || nodeRelationMeta.currency || getDefaultChannelCurrency(currentChannelCode),
  )
  const currentChannelProductCode = String(
    currentChannelMeta.channelProductCode || currentChannelProduct?.instanceCode || node.node.latestInstanceCode || '',
  )
  const currentUpstreamChannelProductCode = String(
    getProjectInstanceFieldValue(currentChannelProduct, 'upstreamChannelProductCode') ||
      nodeRelationMeta.upstreamChannelProductCode ||
      buildFallbackUpstreamChannelProductCode(currentChannelProductCode, project.projectCode),
  )
  const currentStyleCode = String(
    styleRelation?.instanceCode ||
      projectArchiveMeta.linkedStyleCode ||
      currentChannelMeta.linkedStyleCode ||
      project.linkedStyleCode ||
      '',
  )
  const currentStyleName = String(
    styleMeta.styleName || project.linkedStyleName || styleRelation?.title || project.projectName,
  )
  const linkedStyleId = String(styleRelation?.sourceObjectId || project.linkedStyleId || '')
  const currentProjectArchive = getCurrentProjectArchiveRecord(project)
  const techPackContext = getProjectTechPackContext(project, linkedStyleId)
  const currentTechPackVersion = techPackContext.currentVersion
  const techPackSourceSummary = techPackContext.sourceSummary
  const projectArchiveStatusText = getProjectArchiveStatusText(
    String(currentProjectArchive?.archiveStatus || project.projectArchiveStatus || projectArchiveRelation?.status || ''),
  )
  const projectArchiveCompletedFlag =
    String(currentProjectArchive?.archiveStatus || project.projectArchiveStatus || '') === 'FINALIZED' ||
    project.projectArchiveStatus === '已归档' ||
    Boolean(currentProjectArchive?.finalizedAt || project.projectArchiveFinalizedAt)
  const currentSampleTask = firstSampleTask || preProductionTask || null
  const currentSampleAsset =
    (currentSampleTask?.sampleAssetId ? getSampleAssetById(currentSampleTask.sampleAssetId) : null) ||
    (currentSampleTask?.sampleCode ? getSampleAssetByCode(currentSampleTask.sampleCode) : null)
  const currentTaskStatus = String(currentEngineeringTask?.status || '')
  const currentTaskAcceptedAt = resolveSampleAcceptedAt(
    currentSampleAsset?.sampleAssetId || currentSampleTask?.sampleAssetId || '',
    String(currentSampleTask?.acceptedAt || currentEngineeringTask?.acceptedAt || ''),
    currentTaskStatus,
    String(currentSampleTask?.updatedAt || currentEngineeringTask?.updatedAt || ''),
  )
  const currentTaskConfirmedAt = resolveSampleConfirmedAt(
    currentSampleAsset?.sampleAssetId || currentSampleTask?.sampleAssetId || '',
    String(currentSampleTask?.confirmedAt || currentEngineeringTask?.confirmedAt || ''),
    currentTaskStatus,
    String(currentSampleTask?.updatedAt || currentEngineeringTask?.updatedAt || ''),
  )
  const projectTerminated =
    project.projectStatus === '已终止' ||
    node.node.latestResultType === '测款淘汰' ||
    node.node.pendingActionType === '项目关闭'
  const activeListingCount = listProjectChannelProductsByProjectId(project.projectId).filter(
    (item) => item.channelProductStatus !== '已作废',
  ).length
  const projectValues: Record<string, unknown> = {
    projectName: project.projectName,
    projectCode: project.projectCode,
    projectType: project.projectType,
    templateId: [project.templateName, project.templateVersion].filter(Boolean).join(' / '),
    projectSourceType: project.projectSourceType,
    categoryId: project.categoryName,
    categoryName: project.categoryName,
    subCategoryId: project.subCategoryName || project.subCategoryId,
    brandId: project.brandName,
    brandName: project.brandName,
    styleNumber: project.styleNumber || project.styleCodeName,
    styleCodeId: project.styleCodeName,
    styleCodeName: project.styleCodeName,
    yearTag: project.yearTag,
    seasonTags: project.seasonTags,
    styleTags: project.styleTags,
    styleTagIds: project.styleTagNames,
    styleTagNames: project.styleTagNames,
    crowdPositioningIds: project.crowdPositioningNames,
    crowdPositioningNames: project.crowdPositioningNames,
    ageIds: project.ageNames,
    ageNames: project.ageNames,
    crowdIds: project.crowdNames,
    crowdNames: project.crowdNames,
    productPositioningIds: project.productPositioningNames,
    productPositioningNames: project.productPositioningNames,
    targetAudienceTags: project.targetAudienceTags,
    targetChannelCodes: getChannelNamesByCodes(project.targetChannelCodes),
    ownerId: project.ownerName,
    ownerName: project.ownerName,
    teamId: project.teamName,
    teamName: project.teamName,
    collaboratorIds: project.collaboratorNames,
    collaboratorNames: project.collaboratorNames,
    priorityLevel: project.priorityLevel,
    remark: project.remark,
    subCategoryName: project.subCategoryName,
    styleType: project.styleType,
    priceRangeLabel: project.priceRangeLabel,
    priceRange: project.priceRangeLabel,
    projectAlbumUrls: project.projectAlbumUrls,
    activeListingCount,
    listingScopeRule: '单实例 = 单渠道 + 单店铺 + 单 Listing；同一项目可多渠道并行，同一渠道可多店铺并行。',
    targetChannelCode: currentChannelName || defaultChannelName,
    targetStoreId: currentStoreName,
    listingTitle: currentChannelMeta.listingTitle || nodeRelationMeta.listingTitle || `${project.projectName} 测款渠道店铺商品`,
    listingPrice: currentChannelMeta.listingPrice || nodeRelationMeta.listingPrice || project.sampleUnitPrice || 199,
    currency: currentCurrency,
    sampleSupplierId: project.sampleSupplierName || project.sampleSupplierId,
    sampleSupplierName: project.sampleSupplierName,
    sampleSourceType: project.sampleSourceType,
    sampleLink: project.sampleLink,
    sampleUnitPrice: project.sampleUnitPrice,
    linkedChannelProductCode: currentChannelProductCode,
    revisionTaskId: revisionMeta.revisionTaskId || revisionRelation?.sourceObjectId || '',
    revisionTaskCode: revisionMeta.revisionTaskCode || revisionRelation?.instanceCode || '',
    channelProductCode: currentChannelProductCode,
    upstreamChannelProductCode: currentUpstreamChannelProductCode,
    channelProductStatus:
      currentChannelMeta.channelProductStatus || nodeRelationMeta.channelProductStatus || currentChannelProduct?.status || '',
    upstreamSyncStatus: currentChannelMeta.upstreamSyncStatus || nodeRelationMeta.upstreamSyncStatus || '',
    invalidatedReason: currentChannelMeta.invalidatedReason || nodeRelationMeta.invalidatedReason || '',
    channelProductId: nodeRelationMeta.channelProductCode || nodeRelationMeta.channelProductId || currentChannelProductCode,
    invalidatedChannelProductId:
      nodeRelationMeta.invalidatedChannelProductId ||
      currentChannelMeta.invalidatedChannelProductId ||
      (currentChannelProduct?.status === '已作废' ? currentChannelProduct?.sourceObjectId || '' : ''),
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
    channelBreakdownLines: testingAggregate.channelBreakdownLines,
    storeBreakdownLines: testingAggregate.storeBreakdownLines,
    channelProductBreakdownLines: testingAggregate.channelProductBreakdownLines,
    testingSourceBreakdownLines: testingAggregate.testingSourceBreakdownLines,
    currencyBreakdownLines: testingAggregate.currencyBreakdownLines,
    linkedStyleId,
    linkedStyleName: currentStyleName,
    styleId: linkedStyleId,
    styleCode: currentStyleCode || project.styleCodeName,
    styleName: currentStyleName,
    archiveStatus: getStyleArchiveStatusText(
      String(
        styleMeta.archiveStatus ||
          styleRelation?.status ||
          (project.linkedStyleCode ? 'ACTIVE' : ''),
      ),
    ),
    linkedStyleCode: currentStyleCode,
    sourceType:
      String(currentEngineeringTask?.sourceType || '') ||
      String(nodeRelationMeta.sourceType || ''),
    upstreamModule:
      String(currentEngineeringTask?.upstreamModule || '') ||
      String(nodeRelationMeta.upstreamModule || ''),
    upstreamObjectType:
      String(currentEngineeringTask?.upstreamObjectType || '') ||
      String(nodeRelationMeta.upstreamObjectType || ''),
    upstreamObjectId:
      String(currentEngineeringTask?.upstreamObjectId || '') ||
      String(nodeRelationMeta.upstreamObjectId || ''),
    upstreamObjectCode:
      String(currentEngineeringTask?.upstreamObjectCode || '') ||
      String(nodeRelationMeta.upstreamObjectCode || ''),
    linkedTechPackVersionCode:
      plateTask?.linkedTechPackVersionCode ||
      artworkTask?.linkedTechPackVersionCode ||
      currentTechPackVersion?.technicalVersionCode ||
      project.linkedTechPackVersionCode ||
      String(projectArchiveMeta.linkedTechPackVersionCode || '') ||
      String(currentProjectArchive?.currentTechnicalVersionCode || ''),
    linkedTechPackVersionId:
      plateTask?.linkedTechPackVersionId ||
      artworkTask?.linkedTechPackVersionId ||
      currentTechPackVersion?.technicalVersionId ||
      project.linkedTechPackVersionId ||
      '',
    linkedTechPackVersionLabel:
      plateTask?.linkedTechPackVersionLabel ||
      artworkTask?.linkedTechPackVersionLabel ||
      currentTechPackVersion?.versionLabel ||
      project.linkedTechPackVersionLabel ||
      String(projectArchiveMeta.linkedTechPackVersionLabel || '') ||
      String(currentProjectArchive?.currentTechnicalVersionLabel || ''),
    projectTerminated,
    projectTerminatedAt: projectTerminated ? project.updatedAt : '',
    nextActionType:
      node.node.pendingActionType ||
      getTestConclusionNextActionType(String(payload.conclusion || detailSnapshot.conclusion || '')),
    linkedTechPackVersionStatus: getTechPackVersionStatusText(
      String(
        plateTask?.linkedTechPackVersionStatus ||
          artworkTask?.linkedTechPackVersionStatus ||
          currentTechPackVersion?.versionStatus ||
          project.linkedTechPackVersionStatus ||
          projectArchiveMeta.linkedTechPackVersionStatus ||
          styleMeta.linkedTechPackVersionStatus ||
          '',
      ),
    ),
    linkedTechPackVersionSourceTask: techPackSourceSummary?.createdFromTaskText || '暂无来源任务',
    linkedTechPackVersionTaskChain:
      techPackSourceSummary?.items.length
        ? techPackSourceSummary.items.map((item) => `${item.taskTypeLabel} ${item.taskCode}（${item.status}）`)
        : techPackSourceSummary
          ? [techPackSourceSummary.taskChainText]
          : ['暂无来源任务'],
    linkedTechPackVersionDiffSummary: buildTechPackVersionDiffSummary(
      currentTechPackVersion,
      techPackContext.previousVersion,
    ),
    projectArchiveNo: currentProjectArchive?.archiveNo || project.projectArchiveNo || projectArchiveRelation?.instanceCode || '',
    projectArchiveStatus: projectArchiveStatusText,
    projectArchiveDocumentCount: currentProjectArchive?.documentCount ?? project.projectArchiveDocumentCount ?? 0,
    projectArchiveFileCount: currentProjectArchive?.fileCount ?? project.projectArchiveFileCount ?? 0,
    projectArchiveMissingItemCount: currentProjectArchive?.missingItemCount ?? project.projectArchiveMissingItemCount ?? 0,
    projectArchiveCompletedFlag,
    projectArchiveFinalizedAt: currentProjectArchive?.finalizedAt || project.projectArchiveFinalizedAt || '',
    taskStatus: currentTaskStatus || node.node.currentStatus,
    acceptedAt: currentTaskAcceptedAt || String(currentEngineeringTask?.acceptedAt || ''),
    confirmedAt: currentTaskConfirmedAt || String(currentEngineeringTask?.confirmedAt || ''),
    patternBrief:
      plateTask?.note ||
      plateTask?.title ||
      nodeRelationMeta.patternBrief ||
      nodeRelationMeta.note ||
      node.node.latestResultText,
    productStyleCode: plateTask?.productStyleCode || artworkTask?.productStyleCode || nodeRelationMeta.productStyleCode || currentStyleCode,
    sizeRange: plateTask?.sizeRange || nodeRelationMeta.sizeRange || '',
    patternVersion: plateTask?.patternVersion || preProductionTask?.patternVersion || nodeRelationMeta.patternVersion || '',
    artworkType: artworkTask?.artworkType || nodeRelationMeta.artworkType || '',
    patternMode: artworkTask?.patternMode || nodeRelationMeta.patternMode || '',
    artworkName: artworkTask?.artworkName || nodeRelationMeta.artworkName || '',
    artworkVersion: artworkTask?.artworkVersion || preProductionTask?.artworkVersion || nodeRelationMeta.artworkVersion || '',
    factoryId: currentSampleTask?.factoryName || currentSampleTask?.factoryId || nodeRelationMeta.factoryName || nodeRelationMeta.factoryId || '',
    targetSite: currentSampleTask?.targetSite || nodeRelationMeta.targetSite || '',
    expectedArrival: currentSampleTask?.expectedArrival || nodeRelationMeta.expectedArrival || '',
    trackingNo: currentSampleTask?.trackingNo || nodeRelationMeta.trackingNo || '',
    sampleAssetId: currentSampleTask?.sampleAssetId || currentSampleAsset?.sampleAssetId || '',
    sampleCode:
      currentSampleTask?.sampleCode ||
      currentSampleAsset?.sampleCode ||
      nodeRelationMeta.sampleCode ||
      detailSnapshot.sampleCode ||
      '',
  }
  if (node.node.workItemTypeCode === 'TEST_CONCLUSION') {
    const recordValue = payload[fieldKey]
    if (recordValue !== undefined && recordValue !== null && recordValue !== '') return recordValue
    const snapshotValue = detailSnapshot[fieldKey]
    if (snapshotValue !== undefined && snapshotValue !== null && snapshotValue !== '') return snapshotValue
    if (projectValues[fieldKey] !== undefined) return projectValues[fieldKey]
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
    <div class="fixed inset-0 z-50">
      <button type="button" class="absolute inset-0 bg-slate-900/45" data-pcs-project-action="close-dialogs" aria-label="关闭侧栏"></button>
      <aside class="absolute inset-y-0 right-0 flex h-full w-full ${escapeHtml(sizeClass)} flex-col border-l bg-white shadow-2xl">
        <div class="border-b px-6 py-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h3 class="text-lg font-semibold text-slate-900">${escapeHtml(title)}</h3>
              <p class="mt-1 text-sm text-slate-500">${escapeHtml(description)}</p>
            </div>
            <button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-pcs-project-action="close-dialogs">关闭</button>
          </div>
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto space-y-4 px-4 py-4">${body}</div>
        <div class="flex items-center justify-end gap-2 border-t px-6 py-4">${footer}</div>
      </aside>
    </div>
  `
}

function getTemplateByStyleType(styleType: TemplateStyleType): ProjectTemplate | null {
  return listActiveProjectTemplates().find((template) => template.styleType.includes(styleType)) ?? null
}

function isNodeUnlocked(
  project: PcsProjectViewRecord,
  orderedNodes: PcsProjectNodeRecord[],
  node: PcsProjectNodeRecord,
): boolean {
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

function buildProjectLogs(project: PcsProjectViewRecord): ProjectLogItem[] {
  const instanceModel = getProjectInstanceModel(project.projectId)
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

  instanceModel?.instances
    .filter((instance) => instance.sourceLayer === '正式业务对象')
    .forEach((instance) => {
    logs.push({
      time: instance.updatedAt,
      title: `${instance.workItemTypeName}已关联${instance.objectType}`,
      detail: `${instance.title} · ${instance.status || instance.relationRole}`,
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
  const instanceModel = getProjectInstanceModel(projectId)
  if (!instanceModel) return null
  const nodeInstanceMap = new Map(instanceModel.nodes.map((item) => [item.projectNodeId, item]))
  const nodeViewModels = nodes.map((node) => ({
    node,
    contract: getProjectWorkItemContract(node.workItemTypeCode as PcsProjectWorkItemCode),
    definition: getPcsWorkItemDefinition(node.workItemId),
    records: listProjectInlineNodeRecordsByNode(node.projectNodeId),
    latestRecord: getLatestProjectInlineNodeRecord(node.projectNodeId),
    instanceModel: nodeInstanceMap.get(node.projectNodeId)!,
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
    instanceModel,
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
  ensurePcsProjectDemoDataReady()
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

function getRiskText(project: PcsProjectViewRecord): string {
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
      <div class="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
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
    <div class="space-y-5 p-4 pb-24">
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

      <section class="rounded-lg border bg-white p-4">
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

      <section class="rounded-lg border bg-white p-4">
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
    <section class="rounded-lg border bg-white p-4">
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
    const breakdownSections: Array<{ label: string; lines: string[] }> = [
      {
        label: '渠道拆分',
        lines: Array.isArray(payload.channelBreakdownLines)
          ? payload.channelBreakdownLines.map((item) => String(item).trim()).filter(Boolean)
          : [],
      },
      {
        label: '店铺拆分',
        lines: Array.isArray(payload.storeBreakdownLines)
          ? payload.storeBreakdownLines.map((item) => String(item).trim()).filter(Boolean)
          : [],
      },
      {
        label: '渠道店铺商品拆分',
        lines: Array.isArray(payload.channelProductBreakdownLines)
          ? payload.channelProductBreakdownLines.map((item) => String(item).trim()).filter(Boolean)
          : [],
      },
      {
        label: '测款来源拆分',
        lines: Array.isArray(payload.testingSourceBreakdownLines)
          ? payload.testingSourceBreakdownLines.map((item) => String(item).trim()).filter(Boolean)
          : [],
      },
      {
        label: '币种拆分',
        lines: Array.isArray(payload.currencyBreakdownLines)
          ? payload.currencyBreakdownLines.map((item) => String(item).trim()).filter(Boolean)
          : [],
      },
    ].filter((section) => section.lines.length > 0)

    return `
      <div class="space-y-3">
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <article class="rounded-lg border bg-white p-4"><p class="text-xs text-slate-500">曝光量</p><p class="mt-2 text-2xl font-semibold text-slate-900">${formatValue(payload.totalExposureQty)}</p></article>
          <article class="rounded-lg border bg-white p-4"><p class="text-xs text-slate-500">点击量</p><p class="mt-2 text-2xl font-semibold text-slate-900">${formatValue(payload.totalClickQty)}</p></article>
          <article class="rounded-lg border bg-white p-4"><p class="text-xs text-slate-500">下单量</p><p class="mt-2 text-2xl font-semibold text-slate-900">${formatValue(payload.totalOrderQty)}</p></article>
          <article class="rounded-lg border bg-white p-4"><p class="text-xs text-slate-500">GMV</p><p class="mt-2 text-2xl font-semibold text-slate-900">${formatValue(payload.totalGmvAmount)}</p></article>
        </div>
        ${
          breakdownSections.length > 0
            ? `
              <div class="grid gap-3 xl:grid-cols-2">
                ${breakdownSections
                  .map(
                    (section) => `
                      <article class="rounded-lg border bg-white p-4">
                        <p class="text-xs font-medium text-slate-500">${escapeHtml(section.label)}</p>
                        <div class="mt-3 space-y-2">
                          ${section.lines
                            .map(
                              (line) => `
                                <div class="rounded-md bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-700">${escapeHtml(line)}</div>
                              `,
                            )
                            .join('')}
                        </div>
                      </article>
                    `,
                  )
                  .join('')}
              </div>
            `
            : ''
        }
      </div>
    `
  }

  return `
    <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <article class="rounded-lg border bg-white p-4"><p class="text-xs text-slate-500">正式记录</p><p class="mt-2 text-2xl font-semibold text-slate-900">${node.instanceModel.formalRecordCount}</p></article>
      <article class="rounded-lg border bg-white p-4"><p class="text-xs text-slate-500">关联对象</p><p class="mt-2 text-2xl font-semibold text-slate-900">${node.instanceModel.relatedObjectCount}</p></article>
      <article class="rounded-lg border bg-white p-4"><p class="text-xs text-slate-500">有效实例</p><p class="mt-2 text-2xl font-semibold text-slate-900">${Math.max(node.node.validInstanceCount, node.instanceModel.totalCount)}</p></article>
      <article class="rounded-lg border bg-white p-4"><p class="text-xs text-slate-500">最近更新</p><p class="mt-2 text-sm font-semibold text-slate-900">${escapeHtml(formatDateTime(node.instanceModel.latestInstance?.updatedAt || node.node.updatedAt || node.latestRecord?.updatedAt || ''))}</p></article>
    </div>
  `
}

function renderInstanceFields(fields: PcsProjectInstanceItem['fields']): string {
  if (fields.length === 0) return '<span class="text-xs text-slate-400">-</span>'
  return `
    <div class="space-y-1">
      ${fields
        .slice(0, 3)
        .map(
          (field) => `
            <div class="text-xs leading-5 text-slate-500">
              <span class="text-slate-400">${escapeHtml(field.label)}：</span>${escapeHtml(field.value)}
            </div>
          `,
        )
        .join('')}
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
      <article class="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
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
  ensurePcsProjectDemoDataReady()
  ensureDetailState(projectId)
  const viewModel = buildProjectViewModel(projectId)
  if (!viewModel) {
    return `
      <div class="space-y-4 p-4">
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
    <div class="space-y-5 p-4">
      ${renderNotice()}
      ${renderProjectHeader(viewModel)}
      <div class="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)_280px]">
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
                <div class="text-sm leading-6 text-slate-700">${renderReadonlyValue(getNodeFieldValue(project, node, field.fieldKey))}</div>
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
                  : `<div class="min-h-10 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-700">${renderReadonlyValue(getNodeFieldValue(project, node, field.fieldKey))}</div>`
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
      <section class="rounded-lg border bg-white p-4">
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
  const attachmentCount =
    node.instanceModel.relatedObjectCount +
    (node.latestRecord?.upstreamRefs.length || 0) +
    (node.latestRecord?.downstreamRefs.length || 0)
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
    return `<section class="rounded-lg border bg-white p-4 text-sm text-slate-600">当前节点尚未解锁，请先完成前序工作项。</section>`
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
      <section class="rounded-lg border bg-white p-4">
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
    <section class="rounded-lg border bg-white p-4">
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
  if (node.instanceModel.totalCount === 0 && refs.length === 0) {
    return `
      <section class="rounded-lg border bg-white p-4">
        <h3 class="text-base font-semibold text-slate-900">附件与引用</h3>
        <p class="mt-2 text-sm text-slate-500">当前节点暂无正式实例、附件或关联引用。</p>
      </section>
    `
  }

  return `
    <div class="space-y-4">
      <section class="rounded-lg border bg-white p-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 class="text-base font-semibold text-slate-900">项目实例总览</h3>
            <p class="mt-1 text-sm text-slate-500">统一汇总项目主记录、项目内正式记录和正式业务对象，作为当前节点的单一实例视图。</p>
          </div>
          <div class="flex flex-wrap gap-2 text-xs text-slate-500">
            <span class="rounded-full border border-slate-200 px-2.5 py-1">正式记录 ${node.instanceModel.formalRecordCount}</span>
            <span class="rounded-full border border-slate-200 px-2.5 py-1">正式业务对象 ${node.instanceModel.relatedObjectCount}</span>
            <span class="rounded-full border border-slate-200 px-2.5 py-1">全部实例 ${node.instanceModel.totalCount}</span>
          </div>
        </div>
        <div class="mt-4 overflow-hidden rounded-lg border">
          <table class="min-w-full text-sm">
            <thead class="bg-slate-50">
              <tr class="text-left text-slate-600">
                <th class="px-3 py-2 font-medium">来源层</th>
                <th class="px-3 py-2 font-medium">模块 / 承载</th>
                <th class="px-3 py-2 font-medium">实例编码 / 标题</th>
                <th class="px-3 py-2 font-medium">摘要字段</th>
                <th class="px-3 py-2 font-medium">状态</th>
                <th class="px-3 py-2 font-medium">业务日期</th>
                <th class="px-3 py-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200">
              ${
                node.instanceModel.instances.length === 0
                  ? '<tr><td colspan="7" class="px-3 py-6 text-center text-slate-500">当前节点暂无正式实例</td></tr>'
                  : node.instanceModel.instances
                      .map(
                        (instance) => `
                          <tr>
                            <td class="px-3 py-2 align-top">
                              <div class="space-y-1">
                                <div class="text-sm text-slate-700">${escapeHtml(instance.sourceLayer)}</div>
                                <div class="text-xs text-slate-400">${escapeHtml(instance.relationRole || '-')}</div>
                              </div>
                            </td>
                            <td class="px-3 py-2 align-top">
                              <div class="space-y-1">
                                <div class="text-sm text-slate-700">${escapeHtml(instance.moduleName)}</div>
                                <div class="text-xs text-slate-400">${escapeHtml(instance.carrierLabel)}</div>
                              </div>
                            </td>
                            <td class="px-3 py-2 align-top">
                              <div class="space-y-1">
                                <div class="text-sm font-medium text-slate-900">${escapeHtml(instance.instanceCode || '-')}</div>
                                <div class="text-xs leading-5 text-slate-500">${escapeHtml(instance.title || instance.summaryText || '-')}</div>
                              </div>
                            </td>
                            <td class="px-3 py-2 align-top">${renderInstanceFields(instance.fields)}</td>
                            <td class="px-3 py-2 align-top text-slate-500">${escapeHtml(instance.status || '-')}</td>
                            <td class="px-3 py-2 align-top text-slate-500">${escapeHtml(formatDateTime(instance.businessDate || instance.updatedAt || ''))}</td>
                            <td class="px-3 py-2 align-top">
                              ${
                                instance.targetRoute
                                  ? `<button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50" data-nav="${escapeHtml(instance.targetRoute)}">打开</button>`
                                  : '<span class="text-xs text-slate-400">-</span>'
                              }
                            </td>
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
            <section class="rounded-lg border bg-white p-4">
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
    <section class="rounded-lg border bg-white p-4">
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
  ensurePcsProjectDemoDataReady()
  ensureWorkItemState(projectId, projectNodeId)
  const viewModel = buildProjectViewModel(projectId)
  if (!viewModel) {
    return `
      <div class="space-y-4 p-4">
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
      <div class="space-y-4 p-4">
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
    <div class="space-y-5 p-4">
      ${renderNotice()}
      <section class="rounded-lg border bg-white p-4">
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
  ensurePcsProjectDemoDataReady()
  const { filtered, paged, totalPages } = getPagedProjects()
  return `
    <div class="space-y-5 p-4">
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
    values.channelBreakdownLines = aggregate.channelBreakdownLines
    values.storeBreakdownLines = aggregate.storeBreakdownLines
    values.channelProductBreakdownLines = aggregate.channelProductBreakdownLines
    values.testingSourceBreakdownLines = aggregate.testingSourceBreakdownLines
    values.currencyBreakdownLines = aggregate.currencyBreakdownLines
  }

  if (node.node.workItemTypeCode === 'TEST_CONCLUSION') {
    const conclusion = String(values.conclusion || '').trim()
    Object.assign(values, buildTestConclusionOutcomeValues(project, node, conclusion, draft.businessDate || todayText()))
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
  if (input.completeAfterSave && payload.missingRequiredLabels.length > 0) {
    state.notice = `请先补全必填字段：${payload.missingRequiredLabels.join('、')}`
    if (input.closeAfterSave) {
      closeAllDialogs()
    }
    return
  }
  const result = saveProjectNodeFormalRecord({
    projectId,
    projectNodeId,
    payload: {
      businessDate: payload.businessDate,
      values: payload.values,
      detailSnapshot: payload.detailSnapshot,
    },
    completeAfterSave: input.completeAfterSave,
    operatorName: '当前用户',
  })

  if (!result.ok) {
    state.notice = result.message
    if (input.closeAfterSave) closeAllDialogs()
    return
  }

  state.notice =
    input.completeAfterSave && payload.missingRequiredLabels.length > 0
      ? `${result.message} 当前未完成节点流转。`
      : result.message

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

  const note = dialog.note.trim() || `${context.node.node.workItemTypeName}已判定为${dialog.value}。`
  const decisionFieldMeta = getDecisionFieldMeta(context.node.node.workItemTypeCode)
  if (!decisionFieldMeta) {
    closeAllDialogs()
    return
  }
  const result = saveProjectNodeFormalRecord({
    projectId: dialog.projectId,
    projectNodeId: dialog.projectNodeId,
    payload: {
      businessDate: nowText(),
      values: {
        [decisionFieldMeta.valueFieldKey]: dialog.value,
        [decisionFieldMeta.noteFieldKey]: note,
      },
    },
    completeAfterSave: true,
    operatorName: '当前用户',
  })

  state.notice = result.message

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
      const result = terminateProject(state.terminateProjectId, state.terminateReason.trim(), '当前用户')
      state.notice = result.message
    }
    closeAllDialogs()
    return true
  }
  if (action === 'archive-project') {
    const projectId = actionNode.dataset.projectId
    if (!projectId) return true
    const result = archiveProject(projectId, '当前用户')
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
    const result = approveProjectInitAndSync(state.detail.projectId, '当前用户')
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
    const result = markProjectNodeCompletedAndUnlockNext(projectId, projectNodeId, {
      operatorName: '当前用户',
      resultType: '手动完成',
      resultText: '节点已手动标记完成。',
    })
    state.notice = result.message
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
