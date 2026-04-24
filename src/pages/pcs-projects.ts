import { appStore } from '../state/store.ts'
import { escapeHtml, formatDateTime, toClassName } from '../utils.ts'
import {
  createEmptyProjectDraft,
  createProject,
  getChannelNamesByCodes,
  getProjectById,
  getProjectCategoryChildren,
  getProjectCreateCatalog,
  getProjectNodeSequenceBlocker,
  listActiveProjectTemplates,
  listProjectNodes,
  listProjectPhases,
  listProjects,
  updateProjectAlbumUrls,
} from '../data/pcs-project-repository.ts'
import {
  findProjectImageViewModelById,
  listProjectListingCandidateImageViewModels,
  listProjectReferenceImageViewModels,
  type PcsProjectImageAssetViewModel,
} from '../data/pcs-project-image-view-model.ts'
import {
  buildProjectImageCompatRef,
  createProjectImageAssetRecords,
  createProjectImageAssetRecordsFromFiles,
  listProjectReferenceImages,
  markProjectImageAssetUsableForListing,
  markProjectImageAssetUsableForStyleArchive,
  removeProjectImageAsset,
  upsertProjectImageAssets,
} from '../data/pcs-project-image-repository.ts'
import { PROJECT_STATUS_TERMINATED } from '../data/pcs-project-types.ts'
import type {
  PcsProjectCreateDraft,
  PcsProjectNodeRecord,
  PcsProjectPhaseRecord,
  PcsProjectRecord,
  PcsProjectViewRecord,
  ProjectNodeStatus,
  ProjectSimpleOption,
} from '../data/pcs-project-types.ts'
import {
  countTemplateStages,
  countTemplateWorkItems,
  getProjectTemplateById,
  type ProjectTemplate,
  type TemplateStyleType,
} from '../data/pcs-templates.ts'
import { getPcsWorkItemDefinition } from '../data/pcs-work-items.ts'
import { buildProjectClosureViewModel } from '../data/pcs-project-closure-view-model.ts'
import {
  getProjectWorkItemContract,
  getProjectWorkItemContractById,
  getProjectPhaseContract,
  listProjectWorkItemFieldGroups,
  type PcsProjectNodeFieldGroupDefinition,
  type PcsProjectWorkItemCode,
} from '../data/pcs-project-domain-contract.ts'
import {
  getEngineeringTaskFieldPolicy,
  type EngineeringTaskFieldPolicyCode,
} from '../data/pcs-engineering-task-field-policy.ts'
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
  repairChannelListingNodeInstanceConsistency,
} from '../data/pcs-channel-product-project-repository.ts'
import type {
  ProjectChannelProductListingPayload,
  ProjectChannelProductRecord,
  ProjectTestingSummaryAggregate,
  ProjectTestingSummaryBreakdownItem,
  ProjectChannelProductWriteResult,
} from '../data/pcs-channel-product-project-repository.ts'
import {
  getDefaultPcsStoreIdByChannel,
  listPcsChannelStoreMasterRecords,
  resolvePcsStoreCurrency,
  resolvePcsStoreDisplayName,
} from '../data/pcs-channel-store-master.ts'
import type {
  PcsProjectInstanceItem,
  PcsProjectInstanceModel,
  PcsProjectNodeInstanceModel,
} from '../data/pcs-project-instance-model.ts'
import {
  archiveProject,
  isClosedProjectNodeStatus,
  markProjectNodeCompletedAndUnlockNext,
  saveProjectNodeFormalRecord,
  syncProjectLifecycle,
  terminateProject,
} from '../data/pcs-project-flow-service.ts'
import {
  generateStyleArchiveFromProjectNode,
  getStyleArchiveGenerationStatus,
} from '../data/pcs-project-style-archive-generation.ts'
import {
  listStyleArchiveImageCandidates,
  type StyleArchiveImageCandidate,
} from '../data/pcs-style-archive-image-selection.ts'
import {
  createPatternTaskWithProjectRelation,
  createPlateMakingTaskWithProjectRelation,
  createRevisionTaskWithProjectRelation,
  syncExistingProjectEngineeringTaskNodes,
} from '../data/pcs-task-project-relation-writeback.ts'
import { findStyleArchiveByProjectId } from '../data/pcs-style-archive-repository.ts'
import {
  appendSampleShootImages,
  listSampleShootImageAssets,
  removeSampleShootImage,
  updateSampleShootImageUsage,
  type SampleShootImageFieldKey,
} from '../data/pcs-sample-shoot-image-service.ts'

type ProjectListViewMode = 'list' | 'grid'
type ProjectListSort = 'updatedAt' | 'pendingDecision' | 'risk' | 'progressLow'
type ProjectDateRange = '全部时间' | '今天' | '最近一周' | '最近一月'
type WorkItemTabKey = 'full-info' | 'records' | 'attachments' | 'audit'
type DecisionDialogSource = 'detail' | 'work-item'
type EngineeringTaskCreateType = '' | 'REVISION_TASK' | 'PATTERN_TASK' | 'PATTERN_ARTWORK_TASK'

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
  referenceImages: Array<{
    tempId: string
    imageName: string
    imageUrl: string
    file: File
  }>
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
  values: Record<string, unknown>
}

interface RevisionTaskCreateDraft {
  title: string
  ownerName: string
  dueAt: string
  issueSummary: string
  evidenceSummary: string
  evidenceImageUrls: string[]
  scopeCodes: string[]
  sampleQty: string
  stylePreference: string
  patternMakerName: string
  liveRetestRequired: boolean
  note: string
}

interface PlateTaskCreateDraft {
  title: string
  ownerName: string
  dueAt: string
  patternType: string
  sizeRange: string
  note: string
}

interface PatternTaskCreateDraft {
  title: string
  ownerName: string
  dueAt: string
  artworkType: string
  patternMode: string
  artworkName: string
  note: string
}

interface EngineeringTaskCreateDialogState {
  open: boolean
  projectId: string
  projectNodeId: string
  workItemTypeCode: EngineeringTaskCreateType
  revisionDraft: RevisionTaskCreateDraft
  plateDraft: PlateTaskCreateDraft
  patternDraft: PatternTaskCreateDraft
}

interface ProjectImagePreviewState {
  open: boolean
  url: string
  title: string
}

interface ChannelListingSpecDraft {
  productImageId: string
  productImageUrl: string
  productImageName: string
  colorName: string
  sizeName: string
  printName: string
  sellerSku: string
  priceAmount: string
  currencyCode: string
  stockQty: string
}

interface ChannelListingDraft {
  targetChannelCode: string
  targetStoreId: string
  listingTitle: string
  listingDescription: string
  defaultPriceAmount: string
  currencyCode: string
  listingRemark: string
  listingMainImageId: string
  listingImageIds: string[]
  specLines: ChannelListingSpecDraft[]
}

interface StyleArchiveImageDraft {
  styleMainImageId: string
  styleGalleryImageIds: string[]
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
  engineeringCreateDialog: EngineeringTaskCreateDialogState
  imagePreview: ProjectImagePreviewState
  channelListingDrafts: Record<string, ChannelListingDraft>
  styleArchiveImageDrafts: Record<string, StyleArchiveImageDraft>
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

interface ProjectListNodeViewModel {
  node: PcsProjectNodeRecord
  unlocked: boolean
  displayStatus: ProjectNodeStatus | '未解锁'
}

interface ProjectListPhaseViewModel {
  phase: PcsProjectPhaseRecord
  derivedStatus: PcsProjectPhaseRecord['phaseStatus']
  completedCount: number
  totalCount: number
  pendingDecision: boolean
  current: boolean
}

interface ProjectListViewModel {
  project: PcsProjectViewRecord
  currentPhase: ProjectListPhaseViewModel | null
  nextNode: ProjectListNodeViewModel | null
  pendingDecisionNode: ProjectListNodeViewModel | null
  progressDone: number
  progressTotal: number
  channelNames: string[]
}

const STYLE_TYPE_OPTIONS: Array<'全部' | TemplateStyleType> = ['全部', '基础款', '快时尚款', '改版款', '设计款']
const PROJECT_STATUS_OPTIONS = [
  { value: '全部', label: '全部' },
  { value: '已立项', label: '已立项' },
  { value: '进行中', label: '进行中' },
  { value: PROJECT_STATUS_TERMINATED, label: '已结束' },
  { value: '已归档', label: '已归档' },
] as const
const PROJECT_NODE_FIELD_MODULE_EXCEPTIONS = new Set([
  'REVISION_TASK',
  'PATTERN_TASK',
  'PATTERN_ARTWORK_TASK',
  'FIRST_SAMPLE',
  'FIRST_ORDER_SAMPLE',
])
const PROJECT_NODE_MANUAL_COMPLETE_BLOCKED_TYPES = new Set([
  'CHANNEL_PRODUCT_LISTING',
  'REVISION_TASK',
  'PATTERN_TASK',
  'PATTERN_ARTWORK_TASK',
  'LIVE_TEST',
  'VIDEO_TEST',
  'STYLE_ARCHIVE_CREATE',
])
const RISK_STATUS_OPTIONS = ['全部', '正常', '延期']
const DATE_RANGE_OPTIONS: ProjectDateRange[] = ['全部时间', '今天', '最近一周', '最近一月']
const PROJECT_DEMO_SEED_IMPORT_THRESHOLD = 20
const WORK_ITEM_TAB_OPTIONS: Array<{ key: WorkItemTabKey; label: string }> = [
  { key: 'full-info', label: '全量信息' },
  { key: 'records', label: '记录' },
  { key: 'attachments', label: '附件与引用' },
  { key: 'audit', label: '操作日志' },
]
const REVISION_SCOPE_OPTIONS = [
  { value: 'PATTERN', label: '版型结构' },
  { value: 'SIZE', label: '尺码规格' },
  { value: 'FABRIC', label: '面料' },
  { value: 'ACCESSORIES', label: '辅料' },
  { value: 'CRAFT', label: '工艺' },
  { value: 'PRINT', label: '花型' },
  { value: 'COLOR', label: '颜色' },
  { value: 'PACKAGE', label: '包装标识' },
] as const

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

function createEmptyRevisionTaskCreateDraft(): RevisionTaskCreateDraft {
  return {
    title: '',
    ownerName: '',
    dueAt: '',
    issueSummary: '',
    evidenceSummary: '',
    evidenceImageUrls: [],
    scopeCodes: ['PATTERN'],
    sampleQty: '2',
    stylePreference: '',
    patternMakerName: '',
    liveRetestRequired: true,
    note: '',
  }
}

function createEmptyPlateTaskCreateDraft(): PlateTaskCreateDraft {
  return {
    title: '',
    ownerName: '',
    dueAt: '',
    patternType: '常规制版',
    sizeRange: '',
    note: '',
  }
}

function createEmptyPatternTaskCreateDraft(): PatternTaskCreateDraft {
  return {
    title: '',
    ownerName: '',
    dueAt: '',
    artworkType: '印花',
    patternMode: '定位印',
    artworkName: '',
    note: '',
  }
}

function createEmptyEngineeringTaskCreateDialogState(): EngineeringTaskCreateDialogState {
  return {
    open: false,
    projectId: '',
    projectNodeId: '',
    workItemTypeCode: '',
    revisionDraft: createEmptyRevisionTaskCreateDraft(),
    plateDraft: createEmptyPlateTaskCreateDraft(),
    patternDraft: createEmptyPatternTaskCreateDraft(),
  }
}

const state: ProjectPageState = {
  list: { ...initialListState },
  create: {
    routeKey: '',
    draft: createEmptyProjectDraft(),
    referenceImages: [],
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
  engineeringCreateDialog: createEmptyEngineeringTaskCreateDialogState(),
  imagePreview: {
    open: false,
    url: '',
    title: '',
  },
  channelListingDrafts: {},
  styleArchiveImageDrafts: {},
}

type ProjectRelationRepositoryModule = Pick<
  typeof import('../data/pcs-project-relation-repository.ts'),
  'listProjectRelationsByProjectNode'
>
type ProjectDemoSeedServiceModule = Pick<
  typeof import('../data/pcs-project-demo-seed-service.ts'),
  'ensurePcsProjectDemoDataReady'
>
type ProjectTechPackTaskGenerationModule = Pick<
  typeof import('../data/pcs-tech-pack-task-generation.ts'),
  'buildTechPackVersionSourceTaskSummary'
>
type ProjectChannelProductProjectRepositoryModule = Pick<
  typeof import('../data/pcs-channel-product-project-repository.ts'),
  | 'getProjectTestingSummaryAggregate'
  | 'listProjectChannelProductsByProjectId'
  | 'createProjectChannelProductFromListingNode'
  | 'launchProjectChannelProductListing'
  | 'markProjectChannelProductListingCompleted'
  | 'completeProjectChannelListingNode'
>
type ProjectDetailSupportModule = Pick<
  typeof import('../data/pcs-project-detail-support.ts'),
  | 'getProjectArchiveById'
  | 'getProjectArchiveByProjectId'
  | 'getTechnicalDataVersionById'
  | 'listTechnicalDataVersionsByStyleId'
  | 'getRevisionTaskById'
  | 'getPlateMakingTaskById'
  | 'getPatternTaskById'
  | 'getFirstSampleTaskById'
  | 'getFirstOrderSampleTaskById'
>
type ProjectInstanceModelModule = Pick<
  typeof import('../data/pcs-project-instance-model.ts'),
  'findLatestNodeInstance' | 'findLatestProjectInstance' | 'getProjectInstanceFieldValue' | 'getProjectInstanceModel'
>

type ProjectArchiveRecordMaybe = ReturnType<ProjectDetailSupportModule['getProjectArchiveById']>
type TechnicalDataVersionMaybe = ReturnType<ProjectDetailSupportModule['getTechnicalDataVersionById']>

let projectRelationRepositoryModule: ProjectRelationRepositoryModule | null = null
let projectRelationRepositoryPromise: Promise<ProjectRelationRepositoryModule> | null = null
let projectDemoSeedServiceModule: ProjectDemoSeedServiceModule | null = null
let projectDemoSeedPromise: Promise<ProjectDemoSeedServiceModule> | null = null
let projectTechPackTaskGenerationModule: ProjectTechPackTaskGenerationModule | null = null
let projectTechPackTaskGenerationPromise: Promise<ProjectTechPackTaskGenerationModule> | null = null
let projectChannelProductProjectRepositoryModule: ProjectChannelProductProjectRepositoryModule | null = null
let projectChannelProductProjectRepositoryPromise: Promise<ProjectChannelProductProjectRepositoryModule> | null = null
let projectDetailSupportModule: ProjectDetailSupportModule | null = null
let projectDetailSupportPromise: Promise<ProjectDetailSupportModule> | null = null
let projectInstanceModelModule: ProjectInstanceModelModule | null = null
let projectInstanceModelPromise: Promise<ProjectInstanceModelModule> | null = null

async function ensureProjectRelationRepositoryReady(): Promise<ProjectRelationRepositoryModule> {
  if (projectRelationRepositoryModule) {
    return projectRelationRepositoryModule
  }

  if (!projectRelationRepositoryPromise) {
    projectRelationRepositoryPromise = import('../data/pcs-project-relation-repository.ts')
      .then((module) => {
        projectRelationRepositoryModule = module
        return module
      })
      .catch((error) => {
        projectRelationRepositoryPromise = null
        throw error
      })
  }

  return projectRelationRepositoryPromise
}

async function ensureProjectDemoSeedServiceReady(): Promise<ProjectDemoSeedServiceModule> {
  if (projectDemoSeedServiceModule) {
    return projectDemoSeedServiceModule
  }

  if (!projectDemoSeedPromise) {
    projectDemoSeedPromise = import('../data/pcs-project-demo-seed-service.ts')
      .then((module) => {
        projectDemoSeedServiceModule = module
        return module
      })
      .catch((error) => {
        projectDemoSeedPromise = null
        throw error
      })
  }

  return projectDemoSeedPromise
}

async function ensureProjectTechPackTaskGenerationReady(): Promise<ProjectTechPackTaskGenerationModule> {
  if (projectTechPackTaskGenerationModule) {
    return projectTechPackTaskGenerationModule
  }

  if (!projectTechPackTaskGenerationPromise) {
    projectTechPackTaskGenerationPromise = import('../data/pcs-tech-pack-task-generation.ts')
      .then((module) => {
        projectTechPackTaskGenerationModule = module
        return module
      })
      .catch((error) => {
        projectTechPackTaskGenerationPromise = null
        throw error
      })
  }

  return projectTechPackTaskGenerationPromise
}

async function ensureProjectChannelProductProjectRepositoryReady(): Promise<ProjectChannelProductProjectRepositoryModule> {
  if (projectChannelProductProjectRepositoryModule) {
    return projectChannelProductProjectRepositoryModule
  }

  if (!projectChannelProductProjectRepositoryPromise) {
    projectChannelProductProjectRepositoryPromise = import('../data/pcs-channel-product-project-repository.ts')
      .then((module) => {
        projectChannelProductProjectRepositoryModule = module
        return module
      })
      .catch((error) => {
        projectChannelProductProjectRepositoryPromise = null
        throw error
      })
  }

  return projectChannelProductProjectRepositoryPromise
}

async function ensureProjectDetailSupportModuleReady(): Promise<ProjectDetailSupportModule> {
  if (projectDetailSupportModule) {
    return projectDetailSupportModule
  }

  if (!projectDetailSupportPromise) {
    projectDetailSupportPromise = import('../data/pcs-project-detail-support.ts')
      .then((module) => {
        projectDetailSupportModule = module
        return module
      })
      .catch((error) => {
        projectDetailSupportPromise = null
        throw error
      })
  }

  return projectDetailSupportPromise
}

async function ensureProjectInstanceModelReady(): Promise<ProjectInstanceModelModule> {
  if (projectInstanceModelModule) {
    return projectInstanceModelModule
  }

  if (!projectInstanceModelPromise) {
    projectInstanceModelPromise = import('../data/pcs-project-instance-model.ts')
      .then((module) => {
        projectInstanceModelModule = module
        return module
      })
      .catch((error) => {
        projectInstanceModelPromise = null
        throw error
      })
  }

  return projectInstanceModelPromise
}

async function ensureProjectDetailSupportReady(): Promise<void> {
  await Promise.all([
    ensureProjectRelationRepositoryReady(),
    ensureProjectTechPackTaskGenerationReady(),
    ensureProjectChannelProductProjectRepositoryReady(),
    ensureProjectDetailSupportModuleReady(),
    ensureProjectInstanceModelReady(),
  ])
}

function ensureProjectDemoDataReadySync(): void {
  projectDemoSeedServiceModule?.ensurePcsProjectDemoDataReady()
  syncExistingProjectEngineeringTaskNodes('系统同步')
  repairChannelListingNodeInstanceConsistency('系统同步')
}

function listProjectRelationsByProjectNodeSafe(projectId: string, projectNodeId: string): ProjectRelationRecord[] {
  return projectRelationRepositoryModule?.listProjectRelationsByProjectNode(projectId, projectNodeId) ?? []
}

function buildTechPackVersionSourceTaskSummarySafe(
  record: Parameters<ProjectTechPackTaskGenerationModule['buildTechPackVersionSourceTaskSummary']>[0],
): ReturnType<ProjectTechPackTaskGenerationModule['buildTechPackVersionSourceTaskSummary']> | null {
  if (!projectTechPackTaskGenerationModule) {
    return null
  }

  return projectTechPackTaskGenerationModule.buildTechPackVersionSourceTaskSummary(record)
}

function findLatestProjectInstanceSafe(
  projectId: string,
  predicate: (instance: PcsProjectInstanceItem) => boolean,
): PcsProjectInstanceItem | null {
  if (!projectInstanceModelModule) {
    return null
  }

  return projectInstanceModelModule.findLatestProjectInstance(projectId, predicate)
}

function findLatestNodeInstanceSafe(
  projectId: string,
  projectNodeId: string,
  predicate: (instance: PcsProjectInstanceItem) => boolean,
): PcsProjectInstanceItem | null {
  if (!projectInstanceModelModule) {
    return null
  }

  return projectInstanceModelModule.findLatestNodeInstance(projectId, projectNodeId, predicate)
}

function getProjectInstanceFieldValueSafe(instance: PcsProjectInstanceItem | null | undefined, fieldKey: string): unknown {
  if (!projectInstanceModelModule || !instance) {
    return undefined
  }

  return projectInstanceModelModule.getProjectInstanceFieldValue(instance, fieldKey)
}

function getProjectInstanceModelSafe(projectId: string): PcsProjectInstanceModel | null {
  if (!projectInstanceModelModule) {
    return null
  }

  return projectInstanceModelModule.getProjectInstanceModel(projectId)
}

function createEmptyProjectTestingAggregate(): ProjectTestingSummaryAggregate {
  return {
    liveRelationIds: [],
    liveRelationCodes: [],
    videoRelationIds: [],
    videoRelationCodes: [],
    totalExposureQty: 0,
    totalClickQty: 0,
    totalOrderQty: 0,
    totalGmvAmount: 0,
    channelBreakdownLines: [],
    storeBreakdownLines: [],
    channelProductBreakdownLines: [],
    testingSourceBreakdownLines: [],
    currencyBreakdownLines: [],
    channelBreakdowns: [],
    storeBreakdowns: [],
    channelProductBreakdowns: [],
    testingSourceBreakdowns: [],
    currencyBreakdowns: [],
  }
}

function getProjectTestingSummaryAggregateSafe(projectId: string): ProjectTestingSummaryAggregate {
  if (!projectChannelProductProjectRepositoryModule) {
    return createEmptyProjectTestingAggregate()
  }

  return projectChannelProductProjectRepositoryModule.getProjectTestingSummaryAggregate(projectId)
}

function listProjectChannelProductsByProjectIdSafe(projectId: string) {
  if (!projectChannelProductProjectRepositoryModule) {
    return []
  }

  return projectChannelProductProjectRepositoryModule.listProjectChannelProductsByProjectId(projectId)
}

function createProjectChannelProductFromListingNodeSafe(
  projectId: string,
  payload: ProjectChannelProductListingPayload = {},
  operatorName = '当前用户',
): ProjectChannelProductWriteResult {
  if (!projectChannelProductProjectRepositoryModule) {
    return { ok: false, message: '渠道店铺商品模块尚未加载完成，请稍后再试。', record: null }
  }

  return projectChannelProductProjectRepositoryModule.createProjectChannelProductFromListingNode(
    projectId,
    payload,
    operatorName,
  )
}

function launchProjectChannelProductListingSafe(
  channelProductId: string,
  operatorName = '当前用户',
): ProjectChannelProductWriteResult {
  if (!projectChannelProductProjectRepositoryModule) {
    return { ok: false, message: '渠道店铺商品模块尚未加载完成，请稍后再试。', record: null }
  }

  return projectChannelProductProjectRepositoryModule.launchProjectChannelProductListing(channelProductId, operatorName)
}

function markProjectChannelProductListingCompletedSafe(
  channelProductId: string,
  operatorName = '当前用户',
): ProjectChannelProductWriteResult {
  if (!projectChannelProductProjectRepositoryModule) {
    return { ok: false, message: '渠道店铺商品模块尚未加载完成，请稍后再试。', record: null }
  }

  return projectChannelProductProjectRepositoryModule.markProjectChannelProductListingCompleted(
    channelProductId,
    operatorName,
  )
}

function completeProjectChannelListingNodeSafe(
  projectId: string,
  operatorName = '当前用户',
): ProjectChannelProductWriteResult {
  if (!projectChannelProductProjectRepositoryModule) {
    return { ok: false, message: '渠道店铺商品模块尚未加载完成，请稍后再试。', record: null }
  }

  return projectChannelProductProjectRepositoryModule.completeProjectChannelListingNode(projectId, operatorName)
}

function getProjectArchiveByIdSafe(projectArchiveId: string): ProjectArchiveRecordMaybe {
  if (!projectDetailSupportModule) {
    return null
  }

  return projectDetailSupportModule.getProjectArchiveById(projectArchiveId)
}

function getProjectArchiveByProjectIdSafe(projectId: string): ProjectArchiveRecordMaybe {
  if (!projectDetailSupportModule) {
    return null
  }

  return projectDetailSupportModule.getProjectArchiveByProjectId(projectId)
}

function getTechnicalDataVersionByIdSafe(technicalVersionId: string): TechnicalDataVersionMaybe {
  if (!projectDetailSupportModule) {
    return null
  }

  return projectDetailSupportModule.getTechnicalDataVersionById(technicalVersionId)
}

function listTechnicalDataVersionsByStyleIdSafe(styleId: string) {
  if (!projectDetailSupportModule) {
    return []
  }

  return projectDetailSupportModule.listTechnicalDataVersionsByStyleId(styleId)
}

function getRevisionTaskByIdSafe(revisionTaskId: string) {
  if (!projectDetailSupportModule) {
    return null
  }

  return projectDetailSupportModule.getRevisionTaskById(revisionTaskId)
}

function getPlateMakingTaskByIdSafe(plateTaskId: string) {
  if (!projectDetailSupportModule) {
    return null
  }

  return projectDetailSupportModule.getPlateMakingTaskById(plateTaskId)
}

function getPatternTaskByIdSafe(patternTaskId: string) {
  if (!projectDetailSupportModule) {
    return null
  }

  return projectDetailSupportModule.getPatternTaskById(patternTaskId)
}

function getFirstSampleTaskByIdSafe(firstSampleTaskId: string) {
  if (!projectDetailSupportModule) {
    return null
  }

  return projectDetailSupportModule.getFirstSampleTaskById(firstSampleTaskId)
}

function getFirstOrderSampleTaskByIdSafe(firstOrderSampleTaskId: string) {
  if (!projectDetailSupportModule) {
    return null
  }

  return projectDetailSupportModule.getFirstOrderSampleTaskById(firstOrderSampleTaskId)
}

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

function getTestingCreateMeta(
  project: PcsProjectRecord,
  node: Pick<ProjectNodeViewModel, 'node' | 'displayStatus'>,
): { route: string; label: string } | null {
  if (node.displayStatus === '未解锁' || node.node.currentStatus === '已取消') {
    return null
  }

  const projectRef = encodeURIComponent(project.projectCode)
  if (node.node.workItemTypeCode === 'LIVE_TEST') {
    return { route: `/pcs/testing/live?openCreate=1&projectRef=${projectRef}`, label: '新增直播测款' }
  }
  if (node.node.workItemTypeCode === 'VIDEO_TEST') {
    return { route: `/pcs/testing/video?openCreate=1&projectRef=${projectRef}`, label: '新增短视频测款' }
  }
  return null
}

function renderTestingCreateAction(
  project: PcsProjectRecord,
  node: Pick<ProjectNodeViewModel, 'node' | 'displayStatus'>,
  tone: 'primary' | 'secondary' = 'primary',
): string {
  const meta = getTestingCreateMeta(project, node)
  if (!meta) return ''

  const className =
    tone === 'primary'
      ? 'inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700'
      : 'inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50'

  return `<button type="button" class="${className}" data-nav="${escapeHtml(meta.route)}">${escapeHtml(meta.label)}</button>`
}

function renderStyleArchiveNodeAction(
  project: PcsProjectRecord,
  node: Pick<ProjectNodeViewModel, 'node' | 'displayStatus'>,
  tone: 'primary' | 'secondary' = 'primary',
): string {
  if (node.node.workItemTypeCode !== 'STYLE_ARCHIVE_CREATE') return ''
  if (node.displayStatus === '未解锁' || node.node.currentStatus === '已取消') return ''

  const status = getStyleArchiveGenerationStatus(project.projectId)
  const className =
    tone === 'primary'
      ? 'inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700'
      : 'inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50'

  if (status.style) {
    return `<button type="button" class="${className}" data-nav="/pcs/products/styles/${escapeHtml(status.style.styleId)}">查看款式档案</button>`
  }

  if (!status.allowed) return ''

  return `<button type="button" class="${className}" data-pcs-project-action="generate-style-archive" data-project-id="${escapeHtml(project.projectId)}">生成款式档案</button>`
}

function getEngineeringTaskNodeMeta(
  node: Pick<ProjectNodeViewModel, 'node' | 'displayStatus'>,
): { sourceModule: string; sourceObjectType: string; createLabel: string; viewLabel: string } | null {
  if (node.displayStatus === '未解锁' || node.node.currentStatus === '已取消') return null

  if (node.node.workItemTypeCode === 'REVISION_TASK') {
    return { sourceModule: '改版任务', sourceObjectType: '改版任务', createLabel: '创建改版任务', viewLabel: '查看改版任务' }
  }
  if (node.node.workItemTypeCode === 'PATTERN_TASK') {
    return { sourceModule: '制版任务', sourceObjectType: '制版任务', createLabel: '创建制版任务', viewLabel: '查看制版任务' }
  }
  if (node.node.workItemTypeCode === 'PATTERN_ARTWORK_TASK') {
    return { sourceModule: '花型任务', sourceObjectType: '花型任务', createLabel: '创建花型任务', viewLabel: '查看花型任务' }
  }
  return null
}

function renderEngineeringTaskNodeAction(
  project: PcsProjectRecord,
  node: Pick<ProjectNodeViewModel, 'node' | 'displayStatus'>,
  tone: 'primary' | 'secondary' = 'primary',
): string {
  const meta = getEngineeringTaskNodeMeta(node)
  if (!meta) return ''

  const relation =
    findLatestNodeRelation(project.projectId, node.node.projectNodeId, meta.sourceModule, meta.sourceObjectType) ||
    (node.node.workItemTypeCode === 'REVISION_TASK'
      ? findLatestProjectRelation(project.projectId, meta.sourceModule, meta.sourceObjectType)
      : null)

  const className =
    tone === 'primary'
      ? 'inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700'
      : 'inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50'

  if (relation?.targetRoute) {
    return `<button type="button" class="${className}" data-nav="${escapeHtml(relation.targetRoute)}">${escapeHtml(meta.viewLabel)}</button>`
  }

  return `<button type="button" class="${className}" data-pcs-project-action="create-engineering-task-from-node" data-project-id="${escapeHtml(project.projectId)}" data-project-node-id="${escapeHtml(node.node.projectNodeId)}">${escapeHtml(meta.createLabel)}</button>`
}

function openEngineeringTaskCreateDialog(
  project: PcsProjectRecord,
  node: PcsProjectNodeRecord,
): void {
  state.engineeringCreateDialog = {
    open: true,
    projectId: project.projectId,
    projectNodeId: node.projectNodeId,
    workItemTypeCode: node.workItemTypeCode as EngineeringTaskCreateType,
    revisionDraft: {
      ...createEmptyRevisionTaskCreateDraft(),
      title: `${project.projectName}改版任务`,
      ownerName: node.currentOwnerName || project.ownerName,
    },
    plateDraft: {
      ...createEmptyPlateTaskCreateDraft(),
      title: `${project.projectName}制版任务`,
      ownerName: node.currentOwnerName || project.ownerName,
    },
    patternDraft: {
      ...createEmptyPatternTaskCreateDraft(),
      title: `${project.projectName}花型任务`,
      ownerName: node.currentOwnerName || project.ownerName,
      artworkName: `${project.projectName}花型方案`,
    },
  }
}

function submitEngineeringTaskCreateDialog(): { ok: boolean; message: string; route?: string } {
  const dialog = state.engineeringCreateDialog
  const project = dialog.projectId ? getProjectById(dialog.projectId) : null
  const node = project ? listProjectNodes(project.projectId).find((item) => item.projectNodeId === dialog.projectNodeId) || null : null
  if (!project || !node) return { ok: false, message: '当前项目节点不存在。' }

  const linkedStyle = findStyleArchiveByProjectId(project.projectId)
  const productStyleCode = linkedStyle?.styleCode || project.linkedStyleCode || project.styleNumber || project.styleCodeName || ''
  const ownerId = node.currentOwnerId || project.ownerId
  const notePrefix = '由商品项目节点推进自动创建。'

  if (dialog.workItemTypeCode === 'REVISION_TASK') {
    const draft = dialog.revisionDraft
    if (!draft.title.trim()) return { ok: false, message: '请填写改版任务标题。' }
    if (!draft.ownerName.trim()) return { ok: false, message: '请选择负责人。' }
    if (!draft.dueAt.trim()) return { ok: false, message: '请选择截止时间。' }
    if (draft.scopeCodes.length === 0) return { ok: false, message: '请至少选择一个改版范围。' }
    if (!draft.issueSummary.trim()) return { ok: false, message: '请填写问题点。' }
    if (!draft.evidenceSummary.trim()) return { ok: false, message: '请填写证据说明。' }
    const result = createRevisionTaskWithProjectRelation({
      projectId: project.projectId,
      title: draft.title.trim(),
      operatorName: '当前用户',
      ownerId,
      ownerName: draft.ownerName.trim(),
      note: `${notePrefix}${draft.note.trim() ? ` ${draft.note.trim()}` : ''}`,
      sourceType: '测款触发',
      styleId: linkedStyle?.styleId || '',
      styleCode: productStyleCode,
      styleName: linkedStyle?.styleName || project.linkedStyleName || project.projectName,
      productStyleCode,
      spuCode: productStyleCode,
      dueAt: draft.dueAt.trim(),
      revisionScopeCodes: [...draft.scopeCodes],
      revisionScopeNames: REVISION_SCOPE_OPTIONS.filter((option) => draft.scopeCodes.includes(option.value)).map((option) => option.label),
      issueSummary: draft.issueSummary.trim(),
      evidenceSummary: draft.evidenceSummary.trim(),
      evidenceImageUrls: [...draft.evidenceImageUrls],
      baseStyleId: linkedStyle?.styleId || '',
      baseStyleCode: productStyleCode,
      baseStyleName: linkedStyle?.styleName || project.linkedStyleName || project.projectName,
      sampleQty: Number(draft.sampleQty || 0),
      stylePreference: draft.stylePreference.trim(),
      patternMakerName: draft.patternMakerName.trim() || draft.ownerName.trim(),
      revisionSuggestionRichText: draft.issueSummary.trim(),
      mainImageIds: [...draft.evidenceImageUrls],
      liveRetestRequired: draft.liveRetestRequired,
      liveRetestStatus: draft.liveRetestRequired ? '待回直播验证' : '不需要',
    })
    if (!result.ok) return { ok: false, message: result.message }
    return { ok: true, message: result.message, route: `/pcs/patterns/revision/${encodeURIComponent(result.task.revisionTaskId)}` }
  }

  if (dialog.workItemTypeCode === 'PATTERN_TASK') {
    const draft = dialog.plateDraft
    if (!draft.title.trim()) return { ok: false, message: '请填写制版任务标题。' }
    if (!draft.ownerName.trim()) return { ok: false, message: '请选择负责人。' }
    if (!draft.dueAt.trim()) return { ok: false, message: '请选择截止时间。' }
    if (!draft.patternType.trim()) return { ok: false, message: '请填写版型类型。' }
    if (!draft.sizeRange.trim()) return { ok: false, message: '请填写尺码范围。' }
    const result = createPlateMakingTaskWithProjectRelation({
      projectId: project.projectId,
      title: draft.title.trim(),
      operatorName: '当前用户',
      ownerId,
      ownerName: draft.ownerName.trim(),
      note: `${notePrefix}${draft.note.trim() ? ` ${draft.note.trim()}` : ''}`,
      sourceType: '项目模板阶段',
      dueAt: draft.dueAt.trim(),
      productStyleCode,
      spuCode: productStyleCode,
      patternType: draft.patternType.trim(),
      sizeRange: draft.sizeRange.trim(),
    })
    if (!result.ok) return { ok: false, message: result.message }
    return { ok: true, message: result.message, route: `/pcs/patterns/plate-making/${encodeURIComponent(result.task.plateTaskId)}` }
  }

  if (dialog.workItemTypeCode === 'PATTERN_ARTWORK_TASK') {
    const draft = dialog.patternDraft
    if (!draft.title.trim()) return { ok: false, message: '请填写花型任务标题。' }
    if (!draft.ownerName.trim()) return { ok: false, message: '请选择负责人。' }
    if (!draft.dueAt.trim()) return { ok: false, message: '请选择截止时间。' }
    if (!draft.artworkType.trim()) return { ok: false, message: '请选择花型类型。' }
    if (!draft.patternMode.trim()) return { ok: false, message: '请选择图案方式。' }
    if (!draft.artworkName.trim()) return { ok: false, message: '请填写花型名称。' }
    const result = createPatternTaskWithProjectRelation({
      projectId: project.projectId,
      title: draft.title.trim(),
      operatorName: '当前用户',
      ownerId,
      ownerName: draft.ownerName.trim(),
      note: `${notePrefix}${draft.note.trim() ? ` ${draft.note.trim()}` : ''}`,
      sourceType: '项目模板阶段',
      dueAt: draft.dueAt.trim(),
      productStyleCode,
      spuCode: productStyleCode,
      artworkType: draft.artworkType.trim(),
      patternMode: draft.patternMode.trim(),
      artworkName: draft.artworkName.trim(),
    })
    if (!result.ok) return { ok: false, message: result.message }
    return { ok: true, message: result.message, route: `/pcs/patterns/colors/${encodeURIComponent(result.task.patternTaskId)}` }
  }

  return { ok: false, message: '当前节点不支持创建工程任务。' }
}

function renderEngineeringTaskCreateDialog(): string {
  const dialog = state.engineeringCreateDialog
  if (!dialog.open || !dialog.projectId || !dialog.projectNodeId || !dialog.workItemTypeCode) return ''

  const project = getProjectById(dialog.projectId)
  const node = project ? listProjectNodes(project.projectId).find((item) => item.projectNodeId === dialog.projectNodeId) || null : null
  if (!project || !node) return ''

  const style = findStyleArchiveByProjectId(project.projectId)
  const styleCode = style?.styleCode || project.linkedStyleCode || project.styleNumber || project.styleCodeName || '-'
  const ownerOptions = buildProjectTaskOwnerOptions(project, node)

  const summary = `
    <section class="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div class="grid gap-3 md:grid-cols-3">
        <div><p class="text-xs text-slate-500">商品项目</p><p class="mt-1 text-sm font-medium text-slate-900">${escapeHtml(project.projectCode)} · ${escapeHtml(project.projectName)}</p></div>
        <div><p class="text-xs text-slate-500">项目节点</p><p class="mt-1 text-sm font-medium text-slate-900">${escapeHtml(node.workItemTypeName)}</p></div>
        <div><p class="text-xs text-slate-500">关联款式</p><p class="mt-1 text-sm font-medium text-slate-900">${escapeHtml(styleCode)}</p></div>
      </div>
    </section>
  `

  let title = '创建工程任务'
  let description = `${project.projectCode} · ${node.workItemTypeName}`
  let body = ''

  if (dialog.workItemTypeCode === 'REVISION_TASK') {
    const draft = dialog.revisionDraft
    title = '创建改版任务'
    body += `
      <section class="space-y-4">
        <div class="grid gap-4 md:grid-cols-2">
          ${renderProjectTextInput('任务标题', 'engineering-revision-title', draft.title, '请输入改版任务标题')}
          ${renderProjectSelectInput('负责人', 'engineering-revision-owner', draft.ownerName, ownerOptions)}
          ${renderProjectDateTimeInput('截止时间', 'engineering-revision-due-at', draft.dueAt)}
          ${renderProjectTextInput('关联款式编码', 'engineering-revision-style-code', styleCode, '自动带入', true)}
          ${renderProjectTextInput('样衣数量', 'engineering-revision-sample-qty', draft.sampleQty, '例如：2')}
          ${renderProjectTextInput('打版人', 'engineering-revision-pattern-maker', draft.patternMakerName, '默认负责人')}
        </div>
        <div class="space-y-3">
          <p class="text-sm font-medium text-slate-900">改版范围</p>
          <div class="grid gap-3 md:grid-cols-2">
            ${REVISION_SCOPE_OPTIONS.map((option) => `
              <label class="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-3 text-sm text-slate-700">
                <input type="checkbox" ${draft.scopeCodes.includes(option.value) ? 'checked' : ''} data-pcs-project-action="toggle-engineering-revision-scope" data-scope-code="${escapeHtml(option.value)}" />
                <span>${escapeHtml(option.label)}</span>
              </label>
            `).join('')}
          </div>
        </div>
        <div class="grid gap-4 md:grid-cols-2">
          ${renderProjectTextarea('问题点', 'engineering-revision-issue-summary', draft.issueSummary, '请填写本次改版要解决的问题点')}
          ${renderProjectTextarea('证据说明', 'engineering-revision-evidence-summary', draft.evidenceSummary, '请填写评审、反馈、对比记录等证据说明')}
          ${renderProjectTextarea('风格偏好', 'engineering-revision-style-preference', draft.stylePreference, '记录新款方向和直播表现要求')}
        </div>
        <label class="inline-flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" ${draft.liveRetestRequired ? 'checked' : ''} data-pcs-project-field="engineering-revision-live-retest-required" />
          <span>需要回直播验证</span>
        </label>
        <section class="space-y-3 rounded-lg border border-slate-200 px-3 py-3">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p class="text-sm font-medium text-slate-900">证据图片</p>
              <p class="mt-1 text-xs text-slate-500">支持上传多张图片，默认展示缩略图，点击可查看大图。</p>
            </div>
            <label class="inline-flex h-9 cursor-pointer items-center rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50">
              上传图片
              <input type="file" accept="image/*" multiple class="hidden" data-pcs-project-field="engineering-revision-evidence-images" />
            </label>
          </div>
          ${
            draft.evidenceImageUrls.length > 0
              ? renderProjectImageThumbnailGrid(draft.evidenceImageUrls, { removable: true })
              : '<div class="rounded-md border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-400">暂未上传证据图片</div>'
          }
        </section>
        ${renderProjectTextarea('说明', 'engineering-revision-note', draft.note, '补充本次改版方案、边界说明和执行要求')}
      </section>
    `
  } else if (dialog.workItemTypeCode === 'PATTERN_TASK') {
    const draft = dialog.plateDraft
    title = '创建制版任务'
    body += `
      <section class="space-y-4">
        <div class="grid gap-4 md:grid-cols-2">
          ${renderProjectTextInput('任务标题', 'engineering-plate-title', draft.title, '请输入制版任务标题')}
          ${renderProjectSelectInput('负责人', 'engineering-plate-owner', draft.ownerName, ownerOptions)}
          ${renderProjectDateTimeInput('截止时间', 'engineering-plate-due-at', draft.dueAt)}
          ${renderProjectTextInput('关联款式编码', 'engineering-plate-style-code', styleCode, '自动带入', true)}
          ${renderProjectTextInput('版型类型', 'engineering-plate-pattern-type', draft.patternType, '请输入版型类型')}
          ${renderProjectTextInput('尺码范围', 'engineering-plate-size-range', draft.sizeRange, '请输入尺码范围')}
        </div>
        ${renderProjectTextarea('说明', 'engineering-plate-note', draft.note, '补充本次制版输入要求与纸样输出要求')}
      </section>
    `
  } else if (dialog.workItemTypeCode === 'PATTERN_ARTWORK_TASK') {
    const draft = dialog.patternDraft
    title = '创建花型任务'
    body += `
      <section class="space-y-4">
        <div class="grid gap-4 md:grid-cols-2">
          ${renderProjectTextInput('任务标题', 'engineering-pattern-title', draft.title, '请输入花型任务标题')}
          ${renderProjectSelectInput('负责人', 'engineering-pattern-owner', draft.ownerName, ownerOptions)}
          ${renderProjectDateTimeInput('截止时间', 'engineering-pattern-due-at', draft.dueAt)}
          ${renderProjectTextInput('关联款式编码', 'engineering-pattern-style-code', styleCode, '自动带入', true)}
          ${renderProjectSelectInput('花型类型', 'engineering-pattern-artwork-type', draft.artworkType, [
            { value: '印花', label: '印花' },
            { value: '贴章', label: '贴章' },
            { value: '绣花', label: '绣花' },
            { value: '烫画', label: '烫画' },
          ])}
          ${renderProjectSelectInput('图案方式', 'engineering-pattern-mode', draft.patternMode, [
            { value: '定位印', label: '定位印' },
            { value: '满印', label: '满印' },
            { value: '局部', label: '局部' },
          ])}
          ${renderProjectTextInput('花型名称', 'engineering-pattern-artwork-name', draft.artworkName, '请输入花型名称')}
        </div>
        ${renderProjectTextarea('说明', 'engineering-pattern-note', draft.note, '补充本次花型输出说明与生产文件要求')}
      </section>
    `
  }

  return renderModalShell(
    title,
    description,
    `${summary}${body}`,
    `
      <button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-project-action="close-dialogs">取消</button>
      <button type="button" class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-pcs-project-action="submit-engineering-task-create">创建任务</button>
    `,
    'max-w-3xl',
  )
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
  SAMPLE_SHOOT_FIT: [
    'shootPlan',
    'fitFeedback',
    'sampleFlatImageIds',
    'sampleTryOnImageIds',
    'sampleDetailImageIds',
    'sampleVideoUrls',
    'shootImageNote',
    'listingCandidateImageIds',
    'styleArchiveCandidateImageIds',
  ],
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
    'linkedStyleId',
    'linkedStyleCode',
    'invalidatedChannelProductId',
    'nextActionType',
  ],
  SAMPLE_RETURN_HANDLE: ['returnResult'],
}

function getInlineEditableFieldKeys(workItemTypeCode: string): Set<string> {
  if (!canUseInlineRecords(workItemTypeCode)) return new Set()
  return new Set(INLINE_NODE_PAYLOAD_KEYS[workItemTypeCode])
}

const SAMPLE_SHOOT_IMAGE_GROUPS: Array<{
  fieldKey: SampleShootImageFieldKey
  label: string
  uploadField: string
  emptyText: string
}> = [
  { fieldKey: 'sampleFlatImageIds', label: '样衣平铺图', uploadField: 'sample-shoot-flat-images', emptyText: '暂未上传样衣平铺图' },
  { fieldKey: 'sampleTryOnImageIds', label: '试穿图', uploadField: 'sample-shoot-try-on-images', emptyText: '暂未上传试穿图' },
  { fieldKey: 'sampleDetailImageIds', label: '细节图', uploadField: 'sample-shoot-detail-images', emptyText: '暂未上传细节图' },
]

function buildInstanceFieldMap(instance: PcsProjectInstanceItem | null | undefined): Record<string, string> {
  if (!instance) return {}
  return instance.fields.reduce<Record<string, string>>((result, field) => {
    if (field.fieldKey) result[field.fieldKey] = field.value
    return result
  }, {})
}

function parseProjectRelationNoteMeta(note: string | null | undefined): Record<string, unknown> {
  if (!note) return {}
  try {
    const parsed = JSON.parse(note) as Record<string, unknown>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
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

function listPcsChannelStores() {
  return listPcsChannelStoreMasterRecords().flatMap((record) =>
    record.linkedProjectStoreIds.map((storeId) => ({
      storeId,
      storeName: record.storeName,
      channelCode: record.channelCode,
    })),
  )
}

function getStyleArchiveStatusText(status: string): string {
  if (status === 'DRAFT' || status === '技术包待完善' || status === '已建档待技术包') return '已建档待技术包'
  if (status === 'ACTIVE' || status === '已启用' || status === '可生产') return '已启用'
  if (status === 'ARCHIVED' || status === '已归档') return '已归档'
  return status
}

function getTechPackVersionStatusText(status: string): string {
  if (status === 'DRAFT') return '草稿中'
  if (status === 'PUBLISHED') return '已发布待启用'
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
  return findLatestProjectInstanceSafe(
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
  return findLatestNodeInstanceSafe(
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

function getCurrentProjectArchiveRecord(project: PcsProjectRecord) {
  return (project.projectArchiveId ? getProjectArchiveByIdSafe(project.projectArchiveId) : null) || getProjectArchiveByProjectIdSafe(project.projectId)
}

function getProjectTechPackContext(project: PcsProjectRecord, linkedStyleId: string) {
  const versions = linkedStyleId ? listTechnicalDataVersionsByStyleIdSafe(linkedStyleId) : []
  const currentVersion =
    (project.linkedTechPackVersionId ? getTechnicalDataVersionByIdSafe(project.linkedTechPackVersionId) : null) ||
    (project.linkedTechPackVersionCode
      ? versions.find((item) => item.technicalVersionCode === project.linkedTechPackVersionCode)
      : null) ||
    versions[0] ||
    null
  const previousVersion = currentVersion
    ? versions.find((item) => item.technicalVersionId !== currentVersion.technicalVersionId) || null
    : null
  const sourceSummary = currentVersion ? buildTechPackVersionSourceTaskSummarySafe(currentVersion) : null
  return { currentVersion, previousVersion, versions, sourceSummary }
}

function formatSignedNumber(value: number): string {
  if (!Number.isFinite(value)) return '0'
  if (value > 0) return `+${value}`
  return String(value)
}

function buildTechPackVersionDiffSummary(
  currentVersion: TechnicalDataVersionMaybe,
  previousVersion: TechnicalDataVersionMaybe,
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
  if (decision === '淘汰') return '样衣退回处理'
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
    nextActionType: String(overrides.nextActionType ?? getTestConclusionNextActionType(decision)),
  }
}

function getCurrentChannelProductRelation(projectId: string): PcsProjectInstanceItem | null {
  return (
    findLatestProjectRelation(projectId, '渠道店铺商品', '渠道店铺商品') ||
    findLatestProjectRelation(projectId, '渠道商品', '渠道商品')
  )
}

function isChannelListingNode(node: ProjectNodeViewModel): boolean {
  return node.node.workItemTypeCode === 'CHANNEL_PRODUCT_LISTING'
}

function getChannelListingStatusBadgeClass(status: string): string {
  if (status === '已生效') return 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200'
  if (status === '已上架待测款') return 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200'
  if (status === '已上传待确认') return 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200'
  if (status === '待上传') return 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200'
  if (status === '已作废') return 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200'
  return 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200'
}

function renderChannelListingSpecRows(record: ProjectChannelProductRecord): string {
  if (!record.specLines.length) {
    return '<tr><td colspan="10" class="px-3 py-4 text-center text-xs text-slate-400">暂无规格明细</td></tr>'
  }

  return record.specLines
    .map(
      (line) => {
        const image =
          line.productImageId
            ? findProjectImageViewModelById(record.projectId, line.productImageId)
            : null
        const imageUrl = line.productImageUrl || image?.imageUrl || ''
        const imageName = line.productImageName || image?.imageName || '商品图片'
        return `
        <tr>
          <td class="px-3 py-2">
            ${
              imageUrl
                ? `<button type="button" class="group block h-12 w-12 overflow-hidden rounded-md border border-slate-200 bg-slate-50" data-pcs-project-action="open-image-preview" data-url="${escapeHtml(imageUrl)}" data-title="${escapeHtml(imageName)}" aria-label="${escapeHtml(`查看${imageName}`)}"><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(imageName)}" class="h-full w-full object-cover transition group-hover:scale-105" /></button>`
                : line.productImageId
                  ? '<div class="flex h-12 w-12 items-center justify-center rounded-md border border-dashed border-slate-200 text-[11px] text-slate-400">图片已删除</div>'
                  : '<div class="flex h-12 w-12 items-center justify-center rounded-md border border-dashed border-slate-200 text-[11px] text-slate-400">未选择</div>'
            }
          </td>
          <td class="px-3 py-2 text-slate-700">${escapeHtml(line.colorName || '-')}</td>
          <td class="px-3 py-2 text-slate-700">${escapeHtml(line.sizeName || '-')}</td>
          <td class="px-3 py-2 text-slate-700">${escapeHtml(line.printName || '-')}</td>
          <td class="px-3 py-2 text-slate-700">${escapeHtml(line.sellerSku || line.specLineCode || '-')}</td>
          <td class="px-3 py-2 text-slate-700">${escapeHtml(formatValue(line.priceAmount))}</td>
          <td class="px-3 py-2 text-slate-700">${escapeHtml(line.currencyCode || '-')}</td>
          <td class="px-3 py-2 text-slate-700">${escapeHtml(line.stockQty ? String(line.stockQty) : '-')}</td>
          <td class="px-3 py-2 text-slate-700">${escapeHtml(line.upstreamSkuId || '-')}</td>
          <td class="px-3 py-2 text-slate-700">${escapeHtml(line.lineStatus || '-')}</td>
        </tr>
      `
      },
    )
    .join('')
}

function resolveChannelListingImagePoolItems(projectId: string): PcsProjectImageAssetViewModel[] {
  return listProjectListingCandidateImageViewModels(projectId).sort((left, right) => {
    if (left.sortNo !== right.sortNo) return left.sortNo - right.sortNo
    return left.imageName.localeCompare(right.imageName, 'zh-Hans-CN')
  })
}

function resolveUsableChannelListingImagePoolItems(projectId: string): PcsProjectImageAssetViewModel[] {
  return resolveChannelListingImagePoolItems(projectId).filter(canUseImageForListing)
}

function buildChannelListingBatchImageIds(draft: ChannelListingDraft): string[] {
  return [...new Set([
    draft.listingMainImageId,
    ...draft.specLines.map((line) => line.productImageId),
  ].filter(Boolean))]
}

function findChannelListingPoolImage(projectId: string, imageId: string): PcsProjectImageAssetViewModel | null {
  if (!imageId) return null
  return findProjectImageViewModelById(projectId, imageId)
}

function countChannelListingImageUsage(
  projectId: string,
  draft: ChannelListingDraft,
  imageId: string,
): number {
  const draftUsage = draft.specLines.filter((line) => line.productImageId === imageId).length
  const draftMainUsage = draft.listingMainImageId === imageId ? 1 : 0
  const recordUsage = listProjectChannelProductsByProjectIdSafe(projectId).reduce((total, record) => {
    const listingUsage = record.listingImageIds.filter((item) => item === imageId).length
    const specUsage = record.specLines.filter((line) => line.productImageId === imageId).length
    const mainUsage = record.listingMainImageId === imageId ? 1 : 0
    return total + listingUsage + specUsage + mainUsage
  }, 0)
  return draftUsage + draftMainUsage + recordUsage
}

function resolveChannelListingRecordImage(record: ProjectChannelProductRecord): {
  imageUrl: string
  imageName: string
} | null {
  const primaryLine = record.specLines.find((line) => Boolean(line.productImageId)) || record.specLines[0] || null
  if (primaryLine?.productImageId) {
    const image = findProjectImageViewModelById(record.projectId, primaryLine.productImageId)
    if (image) {
      return {
        imageUrl: image.imageUrl,
        imageName: image.imageName,
      }
    }
    if (primaryLine.productImageUrl) {
      return {
        imageUrl: primaryLine.productImageUrl,
        imageName: primaryLine.productImageName || '商品图片',
      }
    }
  }
  const listingMain =
    record.listingImages.find((item) => item.imageId === record.listingMainImageId) ||
    record.listingImages[0] ||
    null
  if (!listingMain) return null
  return {
    imageUrl: listingMain.imageUrl,
    imageName: listingMain.imageName,
  }
}

function renderChannelListingSpecImageCell(
  project: PcsProjectRecord,
  node: ProjectNodeViewModel,
  draft: ChannelListingDraft,
  line: ChannelListingSpecDraft,
  index: number,
): string {
  const selectableImages = resolveUsableChannelListingImagePoolItems(project.projectId)
  const currentImage = findChannelListingPoolImage(project.projectId, line.productImageId)
  const previewUrl = line.productImageUrl || currentImage?.imageUrl || ''
  const previewTitle = line.productImageName || currentImage?.imageName || '商品图片'

  return `
    <div class="space-y-2">
      <select class="h-9 w-full rounded-md border border-slate-200 px-2 text-sm outline-none focus:border-blue-500" data-pcs-project-field="channel-listing-spec-product-image" data-spec-index="${index}">
        <option value="">选择图片</option>
        ${selectableImages
          .map((image) => `<option value="${escapeHtml(image.imageId)}" ${image.imageId === line.productImageId ? 'selected' : ''}>${escapeHtml(image.imageName)}</option>`)
          .join('')}
      </select>
      <div class="flex items-center gap-2">
        ${
          previewUrl
            ? `<button type="button" class="group block h-10 w-10 overflow-hidden rounded-md border border-slate-200 bg-slate-50" data-pcs-project-action="open-image-preview" data-url="${escapeHtml(previewUrl)}" data-title="${escapeHtml(previewTitle)}" aria-label="${escapeHtml(`查看${previewTitle}`)}"><img src="${escapeHtml(previewUrl)}" alt="${escapeHtml(previewTitle)}" class="h-full w-full object-cover transition group-hover:scale-105" /></button>`
            : '<div class="flex h-10 w-10 items-center justify-center rounded-md border border-dashed border-slate-200 text-[11px] text-slate-400">未选</div>'
        }
        <div class="flex flex-wrap gap-2">
          ${
            line.productImageId
              ? `<button type="button" class="inline-flex h-7 items-center rounded-md border border-slate-200 bg-white px-2 text-[11px] text-slate-600 hover:bg-slate-50" data-pcs-project-action="clear-channel-listing-spec-image" data-spec-index="${index}">清除</button>`
              : ''
          }
          ${
            line.productImageId && draft.listingMainImageId !== line.productImageId
              ? `<button type="button" class="inline-flex h-7 items-center rounded-md border border-blue-200 bg-blue-50 px-2 text-[11px] text-blue-700 hover:bg-blue-100" data-pcs-project-action="set-channel-listing-main-image" data-image-id="${escapeHtml(line.productImageId)}">设为主图</button>`
              : ''
          }
        </div>
      </div>
    </div>
  `
}

function renderChannelListingUploadedProductsSection(
  project: PcsProjectRecord,
  records: ProjectChannelProductRecord[],
): string {
  return `
    <section class="rounded-lg border bg-white p-4">
      <div class="flex items-center justify-between gap-3">
        <h3 class="text-base font-semibold text-slate-900">已上架商品</h3>
        <span class="text-xs text-slate-500">共 ${records.length} 条</span>
      </div>
      <div class="mt-4 overflow-hidden rounded-lg border border-slate-200">
        <table class="min-w-full text-sm">
          <thead class="bg-slate-50 text-left text-slate-600">
            <tr>
              <th class="px-3 py-2 font-medium">商品图片</th>
              <th class="px-3 py-2 font-medium">上架标题</th>
              <th class="px-3 py-2 font-medium">渠道</th>
              <th class="px-3 py-2 font-medium">店铺</th>
              <th class="px-3 py-2 font-medium">规格数量</th>
              <th class="px-3 py-2 font-medium">已上传规格数量</th>
              <th class="px-3 py-2 font-medium">上游款式商品编号</th>
              <th class="px-3 py-2 font-medium">上架状态</th>
              <th class="px-3 py-2 font-medium">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200 bg-white">
            ${
              records.length === 0
                ? '<tr><td colspan="9" class="px-3 py-8 text-center text-sm text-slate-500">暂无已上架商品</td></tr>'
                : records
                    .map((record) => {
                      const image = resolveChannelListingRecordImage(record)
                      const storeName =
                        record.storeName || resolvePcsStoreDisplayName(record.storeId, record.channelCode) || '-'
                      const canLaunch =
                        record.channelProductStatus !== '已作废' &&
                        record.listingBatchStatus === '待上传'
                      return `
                        <tr class="align-top">
                          <td class="px-3 py-3">
                            ${
                              image
                                ? `<button type="button" class="group block h-14 w-14 overflow-hidden rounded-md border border-slate-200 bg-slate-50" data-pcs-project-action="open-image-preview" data-url="${escapeHtml(image.imageUrl)}" data-title="${escapeHtml(image.imageName)}" aria-label="${escapeHtml(`查看${image.imageName}`)}"><img src="${escapeHtml(image.imageUrl)}" alt="${escapeHtml(image.imageName)}" class="h-full w-full object-cover transition group-hover:scale-105" /></button>`
                                : '<div class="flex h-14 w-14 items-center justify-center rounded-md border border-dashed border-slate-200 text-[11px] text-slate-400">未选择</div>'
                            }
                          </td>
                          <td class="px-3 py-3 text-slate-900">${escapeHtml(record.listingTitle || '-')}</td>
                          <td class="px-3 py-3 text-slate-700">${escapeHtml(record.channelName || getChannelDisplayName(record.channelCode))}</td>
                          <td class="px-3 py-3 text-slate-700">${escapeHtml(storeName)}</td>
                          <td class="px-3 py-3 text-slate-700">${escapeHtml(String(record.specLineCount || record.specLines.length || 0))}</td>
                          <td class="px-3 py-3 text-slate-700">${escapeHtml(String(record.uploadedSpecLineCount || 0))}</td>
                          <td class="px-3 py-3 text-slate-700">${escapeHtml(record.upstreamProductId || record.upstreamChannelProductCode || '-')}</td>
                          <td class="px-3 py-3">
                            <span class="inline-flex rounded-full px-2 py-0.5 text-xs ${getChannelListingStatusBadgeClass(record.listingBatchStatus || record.channelProductStatus)}">${escapeHtml(record.listingBatchStatus || record.channelProductStatus || '-')}</span>
                          </td>
                          <td class="px-3 py-3">
                            <div class="flex flex-wrap gap-2">
                              ${
                                canLaunch
                                  ? `<button type="button" class="inline-flex h-8 items-center rounded-md border border-blue-200 bg-blue-50 px-3 text-xs font-medium text-blue-700 hover:bg-blue-100" data-pcs-project-action="launch-channel-listing-instance" data-channel-product-id="${escapeHtml(record.channelProductId)}">上传到渠道</button>`
                                  : ''
                              }
                              <button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50" data-nav="/pcs/products/channel-products/${encodeURIComponent(record.channelProductId)}">查看详情</button>
                            </div>
                          </td>
                        </tr>
                      `
                    })
                    .join('')
            }
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderChannelListingImagePoolSection(
  project: PcsProjectRecord,
  node: ProjectNodeViewModel,
  draft: ChannelListingDraft,
): string {
  const poolImages = resolveChannelListingImagePoolItems(project.projectId)

  return `
    <section class="rounded-lg border bg-white p-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h3 class="text-base font-semibold text-slate-900">商品图片池</h3>
        <label class="inline-flex h-8 cursor-pointer items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50">
          上传商品图片
          <input type="file" accept="image/*" multiple class="hidden" data-pcs-project-field="channel-listing-supplement-images" />
        </label>
      </div>
      ${
        poolImages.length === 0
          ? '<div class="mt-4 rounded-md border border-dashed border-slate-200 px-3 py-8 text-center text-sm text-slate-500">暂无商品图片</div>'
          : `
            <div class="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-4">
              ${poolImages
                .map((image) => {
                  const usageCount = countChannelListingImageUsage(project.projectId, draft, image.imageId)
                  const canDelete = image.sourceNodeCode === 'CHANNEL_PRODUCT_LISTING'
                  const isMain = draft.listingMainImageId === image.imageId
                  const usable = canUseImageForListing(image)
                  return `
                    <article class="rounded-lg border border-slate-200 bg-white p-3">
                      <button type="button" class="block h-36 w-full overflow-hidden rounded-md bg-slate-100" data-pcs-project-action="open-image-preview" data-url="${escapeHtml(image.imageUrl)}" data-title="${escapeHtml(image.previewTitle)}" aria-label="${escapeHtml(`查看${image.imageName}`)}">
                        <img src="${escapeHtml(image.imageUrl)}" alt="${escapeHtml(image.imageName)}" class="h-full w-full object-cover" />
                      </button>
                      <div class="mt-3 space-y-2">
                        <div class="flex items-start justify-between gap-2">
                          <div>
                            <p class="text-sm font-medium text-slate-900">${escapeHtml(image.imageName)}</p>
                            <p class="mt-1 text-xs text-slate-500">${escapeHtml(image.sourceType)} · ${escapeHtml(formatDateTime(image.updatedAt || image.createdAt))}</p>
                          </div>
                          ${
                            isMain
                              ? '<span class="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700">主图</span>'
                              : ''
                          }
                        </div>
                        <div class="text-xs text-slate-500">当前被使用次数：${escapeHtml(String(usageCount))}</div>
                        <div class="flex flex-wrap gap-2">
                          ${
                            usable
                              ? `<button type="button" class="inline-flex h-8 items-center rounded-md border ${isMain ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'} px-3 text-xs font-medium" data-pcs-project-action="set-channel-listing-main-image" data-image-id="${escapeHtml(image.imageId)}">${isMain ? '当前主图' : '设为主图'}</button>`
                              : `<button type="button" class="inline-flex h-8 items-center rounded-md border border-amber-200 bg-amber-50 px-3 text-xs font-medium text-amber-700 hover:bg-amber-100" data-pcs-project-action="confirm-channel-listing-pool-image" data-image-id="${escapeHtml(image.imageId)}">确认可用于上架</button>`
                          }
                          ${
                            canDelete
                              ? `<button type="button" class="inline-flex h-8 items-center rounded-md border border-rose-200 bg-white px-3 text-xs font-medium text-rose-600 hover:bg-rose-50" data-pcs-project-action="delete-channel-listing-pool-image" data-image-id="${escapeHtml(image.imageId)}">删除图片</button>`
                              : ''
                          }
                        </div>
                      </div>
                    </article>
                  `
                })
                .join('')}
            </div>
          `
      }
    </section>
  `
}

function renderChannelListingCreateBatchSection(
  project: PcsProjectRecord,
  node: ProjectNodeViewModel,
  draft: ChannelListingDraft,
): string {
  const availableStores = listPcsChannelStores()
    .filter((item) => item.channelCode === draft.targetChannelCode)
    .sort((left, right) => left.storeName.localeCompare(right.storeName, 'zh-Hans-CN'))

  return `
    <section class="rounded-lg border bg-white p-4">
      <div class="flex items-center justify-between gap-3">
        <h3 class="text-base font-semibold text-slate-900">创建上架批次</h3>
        <button type="button" class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-pcs-project-action="create-channel-listing-instance">创建上架批次</button>
      </div>
      <div class="mt-4 grid gap-3 md:grid-cols-2">
        <label class="space-y-1">
          <span class="text-xs text-slate-500">渠道</span>
          <select class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-500" data-pcs-project-field="channel-listing-target-channel">
            ${(project.targetChannelCodes.length > 0 ? project.targetChannelCodes : ['tiktok-shop'])
              .map((channelCode) => `<option value="${escapeHtml(channelCode)}" ${channelCode === draft.targetChannelCode ? 'selected' : ''}>${escapeHtml(getChannelDisplayName(channelCode))}</option>`)
              .join('')}
          </select>
        </label>
        <label class="space-y-1">
          <span class="text-xs text-slate-500">店铺</span>
          <select class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-500" data-pcs-project-field="channel-listing-target-store">
            ${availableStores
              .map((store) => `<option value="${escapeHtml(store.storeId)}" ${store.storeId === draft.targetStoreId ? 'selected' : ''}>${escapeHtml(store.storeName)}</option>`)
              .join('')}
          </select>
        </label>
        <label class="space-y-1 md:col-span-2">
          <span class="text-xs text-slate-500">上架标题</span>
          <input class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-500" value="${escapeHtml(draft.listingTitle)}" data-pcs-project-field="channel-listing-title" />
        </label>
        <label class="space-y-1 md:col-span-2">
          <span class="text-xs text-slate-500">上架描述</span>
          <textarea class="min-h-[88px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" data-pcs-project-field="channel-listing-description">${escapeHtml(draft.listingDescription)}</textarea>
        </label>
        <label class="space-y-1">
          <span class="text-xs text-slate-500">默认售价</span>
          <input class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-500" value="${escapeHtml(draft.defaultPriceAmount)}" data-pcs-project-field="channel-listing-default-price" />
        </label>
        <label class="space-y-1">
          <span class="text-xs text-slate-500">币种</span>
          <input class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-500" value="${escapeHtml(draft.currencyCode)}" data-pcs-project-field="channel-listing-currency" />
        </label>
        <label class="space-y-1 md:col-span-2">
          <span class="text-xs text-slate-500">上架备注</span>
          <textarea class="min-h-[88px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" data-pcs-project-field="channel-listing-remark">${escapeHtml(draft.listingRemark)}</textarea>
        </label>
      </div>
      <div class="mt-4 rounded-lg border border-slate-200">
        <div class="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h4 class="text-sm font-semibold text-slate-900">规格明细</h4>
          <button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50" data-pcs-project-action="add-channel-listing-spec-line">新增规格</button>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead class="bg-slate-50 text-left text-slate-500">
              <tr>
                <th class="px-3 py-2 font-medium">商品图片</th>
                <th class="px-3 py-2 font-medium">颜色</th>
                <th class="px-3 py-2 font-medium">尺码</th>
                <th class="px-3 py-2 font-medium">花型</th>
                <th class="px-3 py-2 font-medium">平台销售 SKU</th>
                <th class="px-3 py-2 font-medium">价格</th>
                <th class="px-3 py-2 font-medium">币种</th>
                <th class="px-3 py-2 font-medium">初始库存</th>
                <th class="px-3 py-2 font-medium text-right">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200 bg-white">
              ${draft.specLines
                .map(
                  (line, index) => `
                    <tr>
                      <td class="min-w-[240px] px-3 py-2">${renderChannelListingSpecImageCell(project, node, draft, line, index)}</td>
                      <td class="px-3 py-2"><input class="h-9 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-500" value="${escapeHtml(line.colorName)}" data-pcs-project-field="channel-listing-spec-color" data-spec-index="${index}" /></td>
                      <td class="px-3 py-2"><input class="h-9 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-500" value="${escapeHtml(line.sizeName)}" data-pcs-project-field="channel-listing-spec-size" data-spec-index="${index}" /></td>
                      <td class="px-3 py-2"><input class="h-9 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-500" value="${escapeHtml(line.printName)}" data-pcs-project-field="channel-listing-spec-print" data-spec-index="${index}" /></td>
                      <td class="px-3 py-2"><input class="h-9 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-500" value="${escapeHtml(line.sellerSku)}" data-pcs-project-field="channel-listing-spec-seller-sku" data-spec-index="${index}" /></td>
                      <td class="px-3 py-2"><input class="h-9 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-500" value="${escapeHtml(line.priceAmount)}" data-pcs-project-field="channel-listing-spec-price" data-spec-index="${index}" /></td>
                      <td class="px-3 py-2"><input class="h-9 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-500" value="${escapeHtml(line.currencyCode)}" data-pcs-project-field="channel-listing-spec-currency" data-spec-index="${index}" /></td>
                      <td class="px-3 py-2"><input class="h-9 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-500" value="${escapeHtml(line.stockQty)}" data-pcs-project-field="channel-listing-spec-stock" data-spec-index="${index}" /></td>
                      <td class="px-3 py-2 text-right"><button type="button" class="inline-flex h-8 items-center rounded-md border border-rose-200 bg-rose-50 px-3 text-xs text-rose-700 hover:bg-rose-100" data-pcs-project-action="remove-channel-listing-spec-line" data-spec-index="${index}">删除</button></td>
                    </tr>
                  `,
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  `
}

function getChannelListingCreateSuggestion(project: PcsProjectRecord): ProjectChannelProductListingPayload {
  const records = listProjectChannelProductsByProjectIdSafe(project.projectId).filter(
    (item) => item.channelProductStatus !== '已作废',
  )
  const targetChannelCodes = project.targetChannelCodes.length > 0 ? project.targetChannelCodes : ['tiktok-shop']
  const usedKeys = new Set(records.map((item) => `${item.channelCode}::${item.storeId}`))

  for (const channelCode of targetChannelCodes) {
    const storeId = getDefaultPcsStoreIdByChannel(channelCode)
    if (!storeId) continue
    const pairKey = `${channelCode}::${storeId}`
    if (!usedKeys.has(pairKey)) {
      return {
        targetChannelCode: channelCode,
        targetStoreId: storeId,
      }
    }
  }

  const fallbackChannelCode = targetChannelCodes[0] || 'tiktok-shop'
  return {
    targetChannelCode: fallbackChannelCode,
    targetStoreId: getDefaultPcsStoreIdByChannel(fallbackChannelCode),
  }
}

function createEmptyChannelListingSpecDraft(currencyCode = 'CNY'): ChannelListingSpecDraft {
  return {
    productImageId: '',
    productImageUrl: '',
    productImageName: '',
    colorName: '',
    sizeName: '',
    printName: '',
    sellerSku: '',
    priceAmount: '',
    currencyCode,
    stockQty: '',
  }
}

function buildChannelListingDraftKey(projectId: string, projectNodeId: string): string {
  return `${projectId}::${projectNodeId}`
}

function getChannelListingDraft(project: PcsProjectRecord, node: ProjectNodeViewModel): ChannelListingDraft {
  const key = buildChannelListingDraftKey(project.projectId, node.node.projectNodeId)
  const existing = state.channelListingDrafts[key]
  if (existing) return existing

  const suggestion = getChannelListingCreateSuggestion(project)
  const currencyCode =
    resolvePcsStoreCurrency(suggestion.targetStoreId || '', suggestion.targetChannelCode || '') || 'CNY'
  const draft: ChannelListingDraft = {
    targetChannelCode: suggestion.targetChannelCode || 'tiktok-shop',
    targetStoreId: suggestion.targetStoreId || '',
    listingTitle: `${project.projectName} 测款渠道商品`,
    listingDescription: '',
    defaultPriceAmount: project.sampleUnitPrice ? String(project.sampleUnitPrice) : '199',
    currencyCode,
    listingRemark: '',
    listingMainImageId: '',
    listingImageIds: [],
    specLines: [createEmptyChannelListingSpecDraft(currencyCode)],
  }
  state.channelListingDrafts[key] = draft
  return draft
}

function updateChannelListingDraft(
  project: PcsProjectRecord,
  node: ProjectNodeViewModel,
  patch: Partial<ChannelListingDraft>,
): void {
  const current = getChannelListingDraft(project, node)
  state.channelListingDrafts[buildChannelListingDraftKey(project.projectId, node.node.projectNodeId)] = {
    ...current,
    ...patch,
    listingImageIds: patch.listingImageIds ? [...patch.listingImageIds] : [...current.listingImageIds],
    specLines: patch.specLines ? [...patch.specLines] : [...current.specLines],
  }
}

function buildStyleArchiveImageDraftKey(projectId: string, projectNodeId: string): string {
  return `${projectId}::${projectNodeId}::style-images`
}

function getStyleArchiveImageDraft(project: PcsProjectRecord, node: ProjectNodeViewModel): StyleArchiveImageDraft {
  const key = buildStyleArchiveImageDraftKey(project.projectId, node.node.projectNodeId)
  const existing = state.styleArchiveImageDrafts[key]
  if (existing) return existing

  const style = findStyleArchiveByProjectId(project.projectId)
  const draft: StyleArchiveImageDraft = {
    styleMainImageId: style?.mainImageId || '',
    styleGalleryImageIds: Array.isArray(style?.galleryImageIds) ? [...style!.galleryImageIds] : [],
  }
  state.styleArchiveImageDrafts[key] = draft
  return draft
}

function updateStyleArchiveImageDraft(
  project: PcsProjectRecord,
  node: ProjectNodeViewModel,
  patch: Partial<StyleArchiveImageDraft>,
): void {
  const current = getStyleArchiveImageDraft(project, node)
  state.styleArchiveImageDrafts[buildStyleArchiveImageDraftKey(project.projectId, node.node.projectNodeId)] = {
    ...current,
    ...patch,
    styleGalleryImageIds: patch.styleGalleryImageIds ? [...patch.styleGalleryImageIds] : [...current.styleGalleryImageIds],
  }
}

function resolveStyleArchiveDraftImages(
  projectId: string,
  draft: StyleArchiveImageDraft,
): PcsProjectImageAssetViewModel[] {
  return draft.styleGalleryImageIds
    .map((imageId) => findProjectImageViewModelById(projectId, imageId))
    .filter((item): item is PcsProjectImageAssetViewModel => Boolean(item))
}

function resolveStyleArchiveCandidateImages(projectId: string, draft: StyleArchiveImageDraft): StyleArchiveImageCandidate[] {
  const selectedIds = new Set(draft.styleGalleryImageIds)
  return listStyleArchiveImageCandidates(projectId).filter((item) => !selectedIds.has(item.imageId))
}

function renderChannelListingNodeWorkspace(project: PcsProjectRecord, node: ProjectNodeViewModel): string {
  const draft = getChannelListingDraft(project, node)
  const records: ProjectChannelProductRecord[] = listProjectChannelProductsByProjectIdSafe(project.projectId)
  const activeRecords = records.filter((item) => item.channelProductStatus !== '已作废')
  const uploadedRecords = activeRecords.filter((item) => item.listingBatchStatus === '已上传待确认')
  const completedRecords = activeRecords.filter(
    (item) => item.listingBatchStatus === '已完成' || item.channelProductStatus === '已上架待测款',
  )
  const latestCompletedRecord = completedRecords[0] || uploadedRecords[0] || null
  const targetChannels = getChannelNamesByCodes(project.targetChannelCodes)

  return `
    <div class="space-y-4">
      <section class="rounded-lg border bg-white p-4">
        <div class="flex items-center justify-between gap-3">
          <h3 class="text-base font-semibold text-slate-900">项目级策略</h3>
          <span class="text-xs text-slate-500">${escapeHtml(node.displayStatus)}</span>
        </div>
        <div class="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <article class="rounded-lg border border-slate-200 bg-slate-50 p-4 md:col-span-2">
            <p class="text-xs text-slate-500">目标上架渠道</p>
            <div class="mt-3 flex flex-wrap gap-2">
              ${
                targetChannels.length > 0
                  ? targetChannels
                      .map(
                        (channelName) =>
                          `<span class="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700">${escapeHtml(channelName)}</span>`,
                      )
                      .join('')
                  : '<span class="text-sm text-slate-400">-</span>'
              }
            </div>
          </article>
          <article class="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p class="text-xs text-slate-500">当前有效上架批次数</p>
            <p class="mt-3 text-2xl font-semibold text-slate-900">${escapeHtml(String(activeRecords.length))}</p>
          </article>
          <article class="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p class="text-xs text-slate-500">已上传待确认批次数</p>
            <p class="mt-3 text-2xl font-semibold text-slate-900">${escapeHtml(String(uploadedRecords.length))}</p>
          </article>
          <article class="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p class="text-xs text-slate-500">已完成上架批次数</p>
            <p class="mt-3 text-2xl font-semibold text-slate-900">${escapeHtml(String(completedRecords.length))}</p>
          </article>
          <article class="rounded-lg border border-slate-200 bg-slate-50 p-4 md:col-span-2 xl:col-span-3">
            <p class="text-xs text-slate-500">最近上游款式商品编号</p>
            <p class="mt-3 text-sm font-medium text-slate-900">${escapeHtml(latestCompletedRecord?.upstreamProductId || '-')}</p>
          </article>
        </div>
      </section>
      ${renderChannelListingUploadedProductsSection(project, records)}
      ${renderChannelListingImagePoolSection(project, node, draft)}
      ${renderChannelListingCreateBatchSection(project, node, draft)}
    </div>
  `
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
  return getProjectTestingSummaryAggregateSafe(projectId)
}

function getNodeFieldValue(project: PcsProjectRecord, node: ProjectNodeViewModel, fieldKey: string): unknown {
  const payload = (node.latestRecord?.payload || {}) as Record<string, unknown>
  const detailSnapshot = (node.latestRecord?.detailSnapshot || {}) as Record<string, unknown>
  const latestFormalRelationRecord = listProjectRelationsByProjectNodeSafe(project.projectId, node.node.projectNodeId)[0] || null
  const latestFormalNodeInstance =
    node.instanceModel.instances.find((item) => item.sourceLayer === '正式业务对象') || null
  const nodeRelationMeta = {
    ...parseProjectRelationNoteMeta(latestFormalRelationRecord?.note),
    ...buildInstanceFieldMap(latestFormalNodeInstance),
  }
  const currentChannelProduct = getCurrentChannelProductRelation(project.projectId)
  const currentChannelMeta = buildInstanceFieldMap(currentChannelProduct)
  const styleRelation = findLatestProjectRelation(project.projectId, '款式档案', '款式档案')
  const styleMeta = buildInstanceFieldMap(styleRelation)
  const revisionRelation = findLatestProjectRelation(project.projectId, '改版任务', '改版任务')
  const revisionMeta = buildInstanceFieldMap(revisionRelation)
  const projectArchiveRelation = findLatestProjectRelation(project.projectId, '项目资料归档', '项目资料归档')
  const projectArchiveMeta = buildInstanceFieldMap(projectArchiveRelation)
  const plateRelation = findLatestNodeRelation(project.projectId, node.node.projectNodeId, '制版任务', '制版任务')
  const plateTask = plateRelation ? getPlateMakingTaskByIdSafe(plateRelation.sourceObjectId || plateRelation.instanceId) : null
  const artworkRelation = findLatestNodeRelation(project.projectId, node.node.projectNodeId, '花型任务', '花型任务')
  const artworkTask = artworkRelation ? getPatternTaskByIdSafe(artworkRelation.sourceObjectId || artworkRelation.instanceId) : null
  const firstSampleRelation = findLatestNodeRelation(project.projectId, node.node.projectNodeId, '首版样衣打样', '首版样衣打样任务')
  const firstSampleTask = firstSampleRelation
    ? getFirstSampleTaskByIdSafe(firstSampleRelation.sourceObjectId || firstSampleRelation.instanceId)
    : null
  const firstOrderRelation = findLatestNodeRelation(project.projectId, node.node.projectNodeId, '首单样衣打样', '首单样衣打样任务')
  const firstOrderTask = firstOrderRelation
    ? getFirstOrderSampleTaskByIdSafe(firstOrderRelation.sourceObjectId || firstOrderRelation.instanceId)
    : null
  const currentEngineeringTask =
    plateTask || artworkTask || firstSampleTask || firstOrderTask || null
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
    getProjectInstanceFieldValueSafe(currentChannelProduct, 'upstreamChannelProductCode') ||
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
  const currentSampleTask = firstSampleTask || firstOrderTask || null
  const currentTaskStatus = String(currentEngineeringTask?.status || '')
  const currentTaskConfirmedAt = String(currentSampleTask?.confirmedAt || currentEngineeringTask?.confirmedAt || '')
  const activeListingCount = listProjectChannelProductsByProjectIdSafe(project.projectId).filter(
    (item) => item.channelProductStatus !== '已作废',
  ).length
  const projectValues: Record<string, unknown> = {
    projectName: project.projectName,
    projectCode: project.projectCode,
    projectRef: project.projectCode,
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
    activeListingCount: activeListingCount || Number(nodeRelationMeta.activeListingCount || 0),
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
      techPackSourceSummary?.items?.length
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
    confirmedAt: currentTaskConfirmedAt || String(currentEngineeringTask?.confirmedAt || ''),
    patternBrief:
      plateTask?.note ||
      plateTask?.title ||
      nodeRelationMeta.patternBrief ||
      nodeRelationMeta.note ||
      node.node.latestResultText,
    productStyleCode: plateTask?.productStyleCode || artworkTask?.productStyleCode || nodeRelationMeta.productStyleCode || currentStyleCode,
    sizeRange: plateTask?.sizeRange || nodeRelationMeta.sizeRange || '',
    patternVersion: plateTask?.patternVersion || firstOrderTask?.patternVersion || nodeRelationMeta.patternVersion || '',
    artworkType: artworkTask?.artworkType || nodeRelationMeta.artworkType || '',
    patternMode: artworkTask?.patternMode || nodeRelationMeta.patternMode || '',
    artworkName: artworkTask?.artworkName || nodeRelationMeta.artworkName || '',
    artworkVersion: artworkTask?.artworkVersion || firstOrderTask?.artworkVersion || nodeRelationMeta.artworkVersion || '',
    factoryId: currentSampleTask?.factoryName || currentSampleTask?.factoryId || nodeRelationMeta.factoryName || nodeRelationMeta.factoryId || '',
    targetSite: currentSampleTask?.targetSite || nodeRelationMeta.targetSite || '',
    sampleCode:
      currentSampleTask?.sampleCode ||
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
    nodeRelationMeta[fieldKey] ??
    projectValues[fieldKey] ??
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
  value: unknown,
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean)
  }
  const text = typeof value === 'string' ? value : String(value ?? '')
  const trimmed = text.trim()
  if (field.type === 'image-list') {
    return getDraftStringArray(value)
  }
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
      return pickFirst('checkResult', 'sampleCode') || '已登记样衣结果核对。'
    case 'FEASIBILITY_REVIEW':
      return pickFirst('reviewRisk', 'reviewConclusion') || '已更新可行性判断。'
    case 'SAMPLE_SHOOT_FIT':
      return pickFirst('fitFeedback', 'shootImageNote', 'shootPlan') || '已补充样衣拍摄与试穿反馈。'
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
        return [
          field.fieldKey,
          shouldKeepDraftArrayValue(node.node.workItemTypeCode, field.fieldKey, field.type)
            ? cloneDraftValue(rawValue)
            : formatDraftFieldValue(field.type, rawValue),
        ]
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

function cloneDraftValue(value: unknown): unknown {
  if (Array.isArray(value)) return [...value]
  return value
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

function hasNodeFieldValue(value: unknown): boolean {
  if (value == null) return false
  if (Array.isArray(value)) {
    return value.some((item) => String(item).trim() !== '')
  }
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value === 'boolean') return true
  return String(value).trim() !== ''
}

function buildNodeCompletionValues(project: PcsProjectRecord, node: ProjectNodeViewModel): Record<string, unknown> {
  return Object.fromEntries(
    node.contract.fieldDefinitions.map((field) => [field.fieldKey, getNodeFieldValue(project, node, field.fieldKey)]),
  )
}

function canCompleteProjectNode(project: PcsProjectRecord, node: ProjectNodeViewModel): boolean {
  if (!node.unlocked) return false
  const values = buildNodeCompletionValues(project, node)
  const shouldValidateRequiredFields = !PROJECT_NODE_FIELD_MODULE_EXCEPTIONS.has(node.node.workItemTypeCode)
  const hasMissingRequiredField =
    shouldValidateRequiredFields &&
    node.contract.fieldDefinitions
      .filter((field) => !field.readonly && field.required)
      .some((field) => !hasNodeFieldValue(values[field.fieldKey]))

  if (hasMissingRequiredField) return false
  return getBusinessRuleValidationErrors(project, node, values).length === 0
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

  if (node.node.workItemTypeCode === 'LIVE_TEST') {
    const exposure = Number(values.exposure || 0)
    const click = Number(values.click || 0)
    const cart = Number(values.cart || 0)
    const order = Number(values.order || 0)
    const gmv = Number(values.gmv || 0)
    const startAt = String(values.startAt || '').trim()
    const endAt = String(values.endAt || '').trim()
    if (!(exposure > 0)) errors.push('直播测款曝光必须大于 0。')
    if (!(click > 0)) errors.push('直播测款点击必须大于 0。')
    if (!(cart > 0)) errors.push('直播测款加购必须大于 0。')
    if (!(order > 0)) errors.push('直播测款订单必须大于 0。')
    if (!(gmv > 0)) errors.push('直播测款 GMV 必须大于 0。')
    if (startAt && endAt) {
      const startTime = Date.parse(startAt.replace(' ', 'T'))
      const endTime = Date.parse(endAt.replace(' ', 'T'))
      if (Number.isFinite(startTime) && Number.isFinite(endTime) && endTime <= startTime) {
        errors.push('直播测款下播时间必须晚于开播时间。')
      }
    }
  }

  if (node.node.workItemTypeCode === 'VIDEO_TEST') {
    const views = Number(values.views || 0)
    const clicks = Number(values.clicks || 0)
    const likes = Number(values.likes || 0)
    const orders = Number(values.orders || 0)
    const gmv = Number(values.gmv || 0)
    if (!(views > 0)) errors.push('短视频测款播放必须大于 0。')
    if (!(clicks > 0)) errors.push('短视频测款点击必须大于 0。')
    if (!(likes > 0)) errors.push('短视频测款点赞必须大于 0。')
    if (!(orders > 0)) errors.push('短视频测款订单必须大于 0。')
    if (!(gmv > 0)) errors.push('短视频测款 GMV 必须大于 0。')
  }

  if (node.node.workItemTypeCode === 'TEST_DATA_SUMMARY') {
    const aggregate = getProjectTestingAggregate(project.projectId)
    if (aggregate.liveRelationIds.length + aggregate.videoRelationIds.length === 0) {
      errors.push('至少关联 1 条正式直播或短视频测款事实后，才能提交测款汇总。')
    }
  }

  if (node.node.workItemTypeCode === 'SAMPLE_SHOOT_FIT') {
    const listingCandidateImageIds = getDraftStringArray(values.listingCandidateImageIds)
    const styleArchiveCandidateImageIds = getDraftStringArray(values.styleArchiveCandidateImageIds)
    const sampleShootImages = listSampleShootImageAssets(project.projectId)
    const hasListingUsableImage = sampleShootImages.some((item) => item.imageStatus === '可用于上架')
    const hasStyleArchiveUsableImage = sampleShootImages.some((item) => item.imageStatus === '可用于款式档案')
    if (hasListingUsableImage && listingCandidateImageIds.length === 0) {
      errors.push('已标记可用于商品上架的图片时，至少保留 1 张商品上架候选图。')
    }
    if (hasStyleArchiveUsableImage && styleArchiveCandidateImageIds.length === 0) {
      errors.push('已标记可用于款式档案的图片时，至少保留 1 张款式档案候选图。')
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

function toggleStringSelection(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value]
}

function toggleOptionSelection(
  options: ProjectSimpleOption[],
  selectedIds: string[],
  targetId: string,
): { ids: string[]; names: string[] } {
  const ids = selectedIds.includes(targetId) ? selectedIds.filter((item) => item !== targetId) : [...selectedIds, targetId]
  return {
    ids,
    names: ids
      .map((id) => options.find((item) => item.id === id)?.name ?? '')
      .filter(Boolean),
  }
}

function getCreateDraftAudienceTags(draft: PcsProjectCreateDraft): string[] {
  return Array.from(new Set([...draft.crowdPositioningNames, ...draft.ageNames, ...draft.crowdNames]))
}

function renderCreateTagButton(label: string, selected: boolean, action: string, value: string): string {
  return `
    <button type="button" class="${toClassName(
      'inline-flex h-8 items-center rounded-md px-3 text-xs transition',
      selected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
    )}" data-pcs-project-action="${escapeHtml(action)}" data-value="${escapeHtml(value)}">${escapeHtml(label)}</button>
  `
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

function renderProjectTextInput(label: string, field: string, value: string, placeholder: string, readOnly = false): string {
  return `
    <label class="flex flex-col gap-2 text-sm text-slate-600">
      <span>${escapeHtml(label)}</span>
      <input class="h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-blue-500 ${readOnly ? 'bg-slate-50 text-slate-500' : ''}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" ${readOnly ? 'readonly' : ''} data-pcs-project-field="${escapeHtml(field)}" />
    </label>
  `
}

function renderProjectTextarea(label: string, field: string, value: string, placeholder: string): string {
  return `
    <label class="flex flex-col gap-2 text-sm text-slate-600">
      <span>${escapeHtml(label)}</span>
      <textarea class="min-h-[96px] rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500" placeholder="${escapeHtml(placeholder)}" data-pcs-project-field="${escapeHtml(field)}">${escapeHtml(value)}</textarea>
    </label>
  `
}

function renderProjectReadonlyBlock(label: string, value: unknown): string {
  return `
    <div class="flex flex-col gap-2 text-sm text-slate-600">
      <span>${escapeHtml(label)}</span>
      <div class="min-h-[96px] rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-700">
        ${renderReadonlyValue(value)}
      </div>
    </div>
  `
}

function renderProjectSelectInput(label: string, field: string, value: string, options: Array<{ value: string; label: string }>): string {
  return `
    <label class="flex flex-col gap-2 text-sm text-slate-600">
      <span>${escapeHtml(label)}</span>
      <select class="h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-blue-500" data-pcs-project-field="${escapeHtml(field)}">
        <option value="">请选择</option>
        ${options.map((option) => `<option value="${escapeHtml(option.value)}" ${value === option.value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}
      </select>
    </label>
  `
}

function toDateTimeLocalValue(value: string): string {
  if (!value) return ''
  if (value.includes('T')) return value.slice(0, 16)
  return value.replace(' ', 'T').slice(0, 16)
}

function fromDateTimeLocalValue(value: string): string {
  if (!value) return ''
  const normalized = value.replace('T', ' ')
  return normalized.length === 16 ? `${normalized}:00` : normalized
}

function renderProjectDateTimeInput(label: string, field: string, value: string): string {
  return `
    <label class="flex flex-col gap-2 text-sm text-slate-600">
      <span>${escapeHtml(label)}</span>
      <input type="datetime-local" class="h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-blue-500" value="${escapeHtml(toDateTimeLocalValue(value))}" data-pcs-project-field="${escapeHtml(field)}" />
    </label>
  `
}

function renderProjectImagePreviewModal(): string {
  if (!state.imagePreview.open || !state.imagePreview.url) return ''
  return `
    <div class="fixed inset-0 z-[70] flex items-center justify-center px-4 py-6">
      <button type="button" class="absolute inset-0 bg-slate-900/70" data-pcs-project-action="close-image-preview" aria-label="关闭图片预览"></button>
      <div class="relative w-full max-w-5xl rounded-2xl bg-white p-4 shadow-2xl">
        <div class="mb-3 flex items-center justify-between gap-3">
          <p class="text-sm font-medium text-slate-900">${escapeHtml(state.imagePreview.title || '图片预览')}</p>
          <button type="button" class="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700" data-pcs-project-action="close-image-preview" aria-label="关闭图片预览">×</button>
        </div>
        <div class="flex max-h-[75vh] items-center justify-center overflow-auto rounded-xl bg-slate-100 p-3">
          <img src="${escapeHtml(state.imagePreview.url)}" alt="${escapeHtml(state.imagePreview.title || '图片预览')}" class="max-h-[70vh] max-w-full rounded-lg object-contain" />
        </div>
      </div>
    </div>
  `
}

function renderProjectImageThumbnailGrid(
  imageUrls: string[],
  options: {
    removable?: boolean
    removeAction?: string
    titlePrefix?: string
    removeLabel?: string
  } = {},
): string {
  if (!imageUrls.length) return ''
  const removable = options.removable === true
  const removeAction = options.removeAction || 'remove-engineering-evidence-image'
  const titlePrefix = options.titlePrefix || '证据图片'
  const removeLabel = options.removeLabel || '删除证据图片'
  return `
    <div class="grid grid-cols-4 gap-3 sm:grid-cols-5">
      ${imageUrls.map((url, index) => `
        <div class="group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
          <button type="button" class="block h-20 w-full overflow-hidden" data-pcs-project-action="open-image-preview" data-url="${escapeHtml(url)}" data-title="${escapeHtml(`${titlePrefix} ${index + 1}`)}" aria-label="${escapeHtml(`查看${titlePrefix} ${index + 1}`)}">
            <img src="${escapeHtml(url)}" alt="${escapeHtml(`${titlePrefix} ${index + 1}`)}" class="h-full w-full object-cover transition group-hover:scale-105" />
          </button>
          ${removable ? `<button type="button" class="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-xs text-slate-600 shadow hover:bg-white" data-pcs-project-action="${escapeHtml(removeAction)}" data-image-index="${index}" aria-label="${escapeHtml(removeLabel)}">×</button>` : ''}
        </div>
      `).join('')}
    </div>
  `
}

function createRuntimeFileUrl(file: File): string {
  if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    return URL.createObjectURL(file)
  }
  return `mock://project-create-image/${encodeURIComponent(file.name || `${Date.now()}`)}`
}

function revokeRuntimeFileUrl(imageUrl: string): void {
  if (!imageUrl.startsWith('blob:')) return
  if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
    URL.revokeObjectURL(imageUrl)
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(new Error(`读取图片失败：${file.name}`))
    reader.readAsDataURL(file)
  })
}

async function appendCreateReferenceImages(files: File[]): Promise<void> {
  if (!files.length) return
  const nextImages = files.map((file, index) => ({
    tempId: `create-reference-${Date.now()}-${index}-${file.name}`,
    imageName: file.name || `参考图片 ${state.create.referenceImages.length + index + 1}`,
    imageUrl: createRuntimeFileUrl(file),
    file,
  }))
  state.create.referenceImages = [...state.create.referenceImages, ...nextImages]
  state.create.error = null
  window.dispatchEvent(new Event('higood:request-render'))
}

async function appendProjectInitReferenceImages(project: PcsProjectRecord, files: File[]): Promise<void> {
  if (!files.length) return
  const currentImages = listProjectReferenceImages(project.projectId)
  const created = await createProjectImageAssetRecordsFromFiles(
    project,
    files,
    (file, index) => ({
      imageName: file.name || `参考图片 ${currentImages.length + index + 1}`,
      imageType: '项目参考图',
      sourceNodeCode: 'PROJECT_INIT',
      sourceRecordId: '',
      sourceType: '商品项目立项',
      usageScopes: ['立项参考', '项目资料归档'],
      imageStatus: '待确认',
      mainFlag: false,
      sortNo: currentImages.length + index + 1,
    }),
    '当前用户',
  )
  upsertProjectImageAssets(created)
  const compatRefs = listProjectReferenceImages(project.projectId).map((item) => buildProjectImageCompatRef(item))
  updateProjectAlbumUrls(project.projectId, compatRefs, '当前用户')
  state.notice = '参考图片已更新。'
  window.dispatchEvent(new Event('higood:request-render'))
}

function canUseImageForListing(image: PcsProjectImageAssetViewModel): boolean {
  return (
    image.usageScopes.includes('商品上架') &&
    (image.imageStatus === '可用于上架' || image.imageStatus === '已选为上架图')
  )
}

async function appendChannelListingSupplementImages(
  project: PcsProjectRecord,
  node: ProjectNodeViewModel,
  files: File[],
): Promise<void> {
  if (!files.length) return
  const draft = getChannelListingDraft(project, node)
  const timestamp = new Date().toISOString()
  const created = await createProjectImageAssetRecordsFromFiles(
    project,
    files,
    (file, index) => ({
      imageName: files[index]?.name || `上架补充图 ${index + 1}`,
      imageType: '上架图',
      sourceNodeCode: 'CHANNEL_PRODUCT_LISTING',
      sourceRecordId: buildChannelListingDraftKey(project.projectId, node.node.projectNodeId),
      sourceType: '商品上架',
      usageScopes: ['商品上架', '项目资料归档'],
      imageStatus: '可用于上架',
      mainFlag: false,
      sortNo: draft.listingImageIds.length + index + 1,
    }),
    '当前用户',
    timestamp,
  )
  upsertProjectImageAssets(created)
  updateChannelListingDraft(project, node, {
    listingMainImageId: draft.listingMainImageId || created[0]?.imageId || '',
  })
  state.notice = '商品图片已加入图片池。'
  window.dispatchEvent(new Event('higood:request-render'))
}

async function appendStyleArchiveSupplementImages(
  project: PcsProjectRecord,
  node: ProjectNodeViewModel,
  files: File[],
): Promise<void> {
  if (!files.length) return
  const draft = getStyleArchiveImageDraft(project, node)
  const timestamp = new Date().toISOString()
  const created = await createProjectImageAssetRecordsFromFiles(
    project,
    files,
    (file, index) => ({
      imageName: files[index]?.name || `档案补充图 ${index + 1}`,
      imageType: '款式档案图',
      sourceNodeCode: 'STYLE_ARCHIVE_CREATE',
      sourceRecordId: buildStyleArchiveImageDraftKey(project.projectId, node.node.projectNodeId),
      sourceType: '生成款式档案',
      usageScopes: ['款式档案', '项目资料归档'],
      imageStatus: '可用于款式档案',
      mainFlag: false,
      sortNo: draft.styleGalleryImageIds.length + index + 1,
    }),
    '当前用户',
    timestamp,
  )
  upsertProjectImageAssets(created)
  const nextImageIds = [...draft.styleGalleryImageIds, ...created.map((item) => item.imageId)]
  updateStyleArchiveImageDraft(project, node, {
    styleGalleryImageIds: nextImageIds,
    styleMainImageId: draft.styleMainImageId || created[0]?.imageId || '',
  })
  state.notice = '档案补充图片已加入当前款式档案选择。'
  window.dispatchEvent(new Event('higood:request-render'))
}

function renderStyleArchiveSelectedImages(
  project: PcsProjectRecord,
  draft: StyleArchiveImageDraft,
  editable: boolean,
): string {
  const images = resolveStyleArchiveDraftImages(project.projectId, draft)
  if (images.length === 0) {
    return `
      <div class="rounded-md border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-400">
        暂未选择档案图片
      </div>
    `
  }

  return `
    <div class="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
      ${images
        .map((image, index) => {
          const isMain = image.imageId === draft.styleMainImageId
          return `
            <article class="rounded-lg border border-slate-200 bg-white p-3">
              <button type="button" class="block h-40 w-full overflow-hidden rounded-md bg-slate-100" data-pcs-project-action="open-image-preview" data-url="${escapeHtml(image.imageUrl)}" data-title="${escapeHtml(image.previewTitle)}" aria-label="${escapeHtml(`查看${image.imageName}`)}">
                <img src="${escapeHtml(image.imageUrl)}" alt="${escapeHtml(image.imageName)}" class="h-full w-full object-cover" />
              </button>
              <div class="mt-3 space-y-2">
                <div>
                  <p class="text-sm font-medium text-slate-900">${escapeHtml(image.imageName)}</p>
                  <p class="mt-1 text-xs text-slate-500">${escapeHtml(image.imageType)} · ${escapeHtml(image.imageStatus || '-')}</p>
                </div>
                <div class="flex flex-wrap gap-1">
                  ${image.usageScopes.map((scope) => `<span class="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">${escapeHtml(scope)}</span>`).join('')}
                </div>
                ${
                  editable
                    ? `<div class="flex flex-wrap gap-2">
                        <button type="button" class="inline-flex h-7 items-center rounded-md border px-2 text-[11px] ${isMain ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}" data-pcs-project-action="set-style-archive-main-image" data-image-id="${escapeHtml(image.imageId)}">${isMain ? '当前主图' : '设为主图'}</button>
                        <button type="button" class="inline-flex h-7 items-center rounded-md border border-slate-200 bg-white px-2 text-[11px] text-slate-600 hover:bg-slate-50" data-pcs-project-action="move-style-archive-image-up" data-image-id="${escapeHtml(image.imageId)}" ${index === 0 ? 'disabled' : ''}>上移</button>
                        <button type="button" class="inline-flex h-7 items-center rounded-md border border-slate-200 bg-white px-2 text-[11px] text-slate-600 hover:bg-slate-50" data-pcs-project-action="move-style-archive-image-down" data-image-id="${escapeHtml(image.imageId)}" ${index === images.length - 1 ? 'disabled' : ''}>下移</button>
                        <button type="button" class="inline-flex h-7 items-center rounded-md border border-rose-200 bg-white px-2 text-[11px] text-rose-600 hover:bg-rose-50" data-pcs-project-action="remove-style-archive-image" data-image-id="${escapeHtml(image.imageId)}">移除</button>
                      </div>`
                    : isMain
                      ? '<span class="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700">档案主图</span>'
                      : ''
                }
              </div>
            </article>
          `
        })
        .join('')}
    </div>
  `
}

function renderStyleArchiveCandidateImagePicker(
  project: PcsProjectRecord,
  draft: StyleArchiveImageDraft,
  editable: boolean,
): string {
  const candidates = resolveStyleArchiveCandidateImages(project.projectId, draft)
  return `
    <div class="rounded-lg border border-slate-200">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <h4 class="text-sm font-semibold text-slate-900">档案主图与图册</h4>
          <p class="mt-1 text-xs text-slate-500">优先选择商品上架图片，其次选择可用于款式档案的样衣拍摄图片。项目参考图需确认后使用。</p>
        </div>
        ${
          editable
            ? `<label class="inline-flex h-8 cursor-pointer items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50">
                上传档案补充图
                <input type="file" accept="image/*" multiple class="hidden" data-pcs-project-field="style-archive-supplement-images" />
              </label>`
            : ''
        }
      </div>
      <div class="space-y-4 p-4">
        <div>
          <div class="mb-2 text-xs font-medium text-slate-500">已选档案图册</div>
          ${renderStyleArchiveSelectedImages(project, draft, editable)}
        </div>
        <div>
          <div class="mb-2 text-xs font-medium text-slate-500">候选图片</div>
          ${
            candidates.length === 0
              ? '<div class="rounded-md border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-400">暂无可选图片，请先选择或上传图片。</div>'
              : `
                <div class="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
                  ${candidates
                    .map((image) => {
                      const action = image.requiresConfirmation ? 'confirm-add-style-archive-image' : 'add-style-archive-image'
                      const buttonText = image.requiresConfirmation ? '确认可用于款式档案并加入' : '加入档案图册'
                      return `
                        <article class="rounded-lg border border-slate-200 bg-white p-3">
                          <button type="button" class="block h-32 w-full overflow-hidden rounded-md bg-slate-100" data-pcs-project-action="open-image-preview" data-url="${escapeHtml(image.imageUrl)}" data-title="${escapeHtml(image.imageName)}" aria-label="${escapeHtml(`查看${image.imageName}`)}">
                            <img src="${escapeHtml(image.imageUrl)}" alt="${escapeHtml(image.imageName)}" class="h-full w-full object-cover" />
                          </button>
                          <div class="mt-3 space-y-2">
                            <div class="flex items-start justify-between gap-2">
                              <div>
                                <p class="text-sm font-medium text-slate-900">${escapeHtml(image.imageName)}</p>
                                <p class="mt-1 text-xs text-slate-500">${escapeHtml(image.sourceLabel)} · ${escapeHtml(image.imageStatus)}</p>
                              </div>
                              ${image.requiresConfirmation ? '<span class="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">需确认后使用</span>' : ''}
                            </div>
                            <div class="flex flex-wrap gap-1">
                              ${image.usageScopes.map((scope) => `<span class="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">${escapeHtml(scope)}</span>`).join('')}
                            </div>
                            ${
                              editable
                                ? `<div class="flex flex-wrap gap-2">
                                    <button type="button" class="inline-flex h-8 items-center rounded-md border ${image.requiresConfirmation ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100' : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'} px-3 text-xs font-medium" data-pcs-project-action="${action}" data-image-id="${escapeHtml(image.imageId)}">${escapeHtml(buttonText)}</button>
                                    <button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50" data-pcs-project-action="${action}" data-image-id="${escapeHtml(image.imageId)}" data-set-main="true">设为主图并加入</button>
                                  </div>`
                                : ''
                            }
                          </div>
                        </article>
                      `
                    })
                    .join('')}
                </div>
              `
          }
        </div>
      </div>
    </div>
  `
}

function renderStyleArchiveCreateWorkspace(project: PcsProjectRecord, node: ProjectNodeViewModel): string {
  const draft = getStyleArchiveImageDraft(project, node)
  const style = findStyleArchiveByProjectId(project.projectId)
  const editable =
    node.displayStatus !== '未解锁' &&
    node.node.currentStatus !== '已取消' &&
    !style

  return `
    <div class="space-y-4">
      <section class="rounded-lg border bg-white p-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 class="text-base font-semibold text-slate-900">款式档案图片确认</h3>
            <p class="mt-1 text-xs text-slate-500">${style ? `当前已生成款式档案 ${style.styleCode}。` : '先确认档案主图和图册，再生成款式档案。'}</p>
          </div>
          ${style ? `<button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-nav="/pcs/products/styles/${escapeHtml(style.styleId)}">查看款式档案</button>` : ''}
        </div>
        ${
          style
            ? `<div class="mt-4 grid gap-3 md:grid-cols-3">
                <article class="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p class="text-xs text-slate-500">档案主图</p>
                  <p class="mt-2 text-sm font-medium text-slate-900">${escapeHtml(style.mainImageId || '未记录')}</p>
                </article>
                <article class="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p class="text-xs text-slate-500">图册数量</p>
                  <p class="mt-2 text-sm font-medium text-slate-900">${escapeHtml(String(style.galleryImageIds?.length || style.galleryImageUrls?.length || 0))}</p>
                </article>
                <article class="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p class="text-xs text-slate-500">图片来源</p>
                  <p class="mt-2 text-sm font-medium text-slate-900">${escapeHtml(style.imageSource || '未记录')}</p>
                </article>
              </div>`
            : ''
        }
      </section>
      ${renderStyleArchiveCandidateImagePicker(project, draft, editable)}
    </div>
  `
}

function isSampleShootFitNode(node: ProjectNodeViewModel): boolean {
  return node.node.workItemTypeCode === 'SAMPLE_SHOOT_FIT'
}

function canEditSampleShootFitNode(node: ProjectNodeViewModel): boolean {
  return node.displayStatus !== '未解锁' && (node.node.currentStatus === '进行中' || node.node.currentStatus === '待确认')
}

function shouldKeepDraftArrayValue(
  workItemTypeCode: string,
  fieldKey: string,
  fieldType: PcsProjectNodeFieldGroupDefinition['fields'][number]['type'],
): boolean {
  if (fieldType === 'image-list') return true
  if (workItemTypeCode !== 'SAMPLE_SHOOT_FIT') return false
  return (
    fieldKey === 'sampleVideoUrls' ||
    fieldKey === 'listingCandidateImageIds' ||
    fieldKey === 'styleArchiveCandidateImageIds'
  )
}

function getDraftStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean)
  }
  if (typeof value === 'string') {
    return value
      .split(/[、,\n]/)
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return []
}

function resolveSampleShootImageIds(draft: RecordDialogState, fieldKey: string): string[] {
  return getDraftStringArray(draft.values[fieldKey])
}

function resolveSampleShootImageItems(projectId: string, imageIds: string[]): PcsProjectImageAssetViewModel[] {
  return imageIds
    .map((imageId) => findProjectImageViewModelById(projectId, imageId))
    .filter((item): item is PcsProjectImageAssetViewModel => Boolean(item))
}

function renderSampleShootImageUsageButtons(
  image: PcsProjectImageAssetViewModel,
  editable: boolean,
): string {
  if (!editable) return ''

  const actionButton = (usage: string, label: string, active: boolean, tone: 'blue' | 'emerald' | 'amber' | 'rose' | 'slate' = 'slate') => {
    const activeClass =
      tone === 'blue'
        ? 'border-blue-200 bg-blue-50 text-blue-700'
        : tone === 'emerald'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : tone === 'amber'
            ? 'border-amber-200 bg-amber-50 text-amber-700'
            : tone === 'rose'
              ? 'border-rose-200 bg-rose-50 text-rose-700'
              : 'border-slate-300 bg-slate-100 text-slate-700'
    return `<button type="button" class="inline-flex h-7 items-center rounded-md border px-2 text-[11px] ${active ? activeClass : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}" data-pcs-project-action="set-sample-shoot-image-usage" data-image-id="${escapeHtml(image.imageId)}" data-usage="${escapeHtml(usage)}">${escapeHtml(label)}</button>`
  }

  const listingActive = image.usageScopes.includes('商品上架') && image.imageStatus === '可用于上架'
  const archiveActive = image.usageScopes.includes('款式档案') && image.imageStatus === '可用于款式档案'
  const evaluateActive = image.imageStatus === '待确认'
  const retakeActive = image.imageStatus === '需重拍'
  const discardedActive = image.imageStatus === '已弃用'

  return `
    <div class="mt-2 flex flex-wrap gap-2">
      ${actionButton('listing', '可用于商品上架', listingActive, 'blue')}
      ${actionButton('styleArchive', '可用于款式档案', archiveActive, 'emerald')}
      ${actionButton('evaluateOnly', '仅用于样衣评估', evaluateActive, 'slate')}
      ${actionButton('retake', '需重拍', retakeActive, 'amber')}
      ${actionButton('discarded', '已弃用', discardedActive, 'rose')}
      <button type="button" class="inline-flex h-7 items-center rounded-md border border-rose-200 bg-white px-2 text-[11px] text-rose-600 hover:bg-rose-50" data-pcs-project-action="remove-sample-shoot-image" data-image-id="${escapeHtml(image.imageId)}">删除图片</button>
    </div>
  `
}

function renderSampleShootImageCards(
  items: PcsProjectImageAssetViewModel[],
  editable: boolean,
  emptyText: string,
): string {
  if (items.length === 0) {
    return `<div class="rounded-md border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-400">${escapeHtml(emptyText)}</div>`
  }

  return `
    <div class="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
      ${items
        .map(
          (image) => `
            <article class="rounded-lg border border-slate-200 bg-white p-3">
              <button type="button" class="block h-40 w-full overflow-hidden rounded-md bg-slate-100" data-pcs-project-action="open-image-preview" data-url="${escapeHtml(image.imageUrl)}" data-title="${escapeHtml(image.previewTitle)}" aria-label="${escapeHtml(`查看${image.imageName}`)}">
                <img src="${escapeHtml(image.imageUrl)}" alt="${escapeHtml(image.imageName)}" class="h-full w-full object-cover" />
              </button>
              <div class="mt-3 space-y-2">
                <div>
                  <p class="text-sm font-medium text-slate-900">${escapeHtml(image.imageName)}</p>
                  <p class="mt-1 text-xs text-slate-500">${escapeHtml(image.imageType)} · ${escapeHtml(image.imageStatus)}</p>
                </div>
                <div class="flex flex-wrap gap-1">
                  ${image.usageScopes.map((scope) => `<span class="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">${escapeHtml(scope)}</span>`).join('')}
                </div>
                ${renderSampleShootImageUsageButtons(image, editable)}
              </div>
            </article>
          `,
        )
        .join('')}
    </div>
  `
}

function renderSampleShootVideoSection(draft: RecordDialogState, editable: boolean): string {
  const videoUrls = getDraftStringArray(draft.values.sampleVideoUrls)
  return `
    <section class="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h3 class="text-sm font-semibold text-slate-900">视频素材</h3>
          <p class="mt-1 text-xs text-slate-500">可填写视频链接或本地记录，每行一条。</p>
        </div>
      </div>
      ${
        editable
          ? renderProjectTextarea(
              '视频素材',
              'sample-shoot-video-urls',
              videoUrls.join('\n'),
              '请输入视频素材链接或本地记录，每行一条',
            )
          : videoUrls.length > 0
            ? renderReadonlyValue(videoUrls)
            : '<div class="rounded-md border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-400">暂未记录视频素材</div>'
      }
    </section>
  `
}

function renderSampleShootFitWorkspace(project: PcsProjectRecord, node: ProjectNodeViewModel): string {
  const draft = getNodeRecordDraft(project, node)
  const editable = canEditSampleShootFitNode(node)
  const listingCandidates = resolveSampleShootImageItems(project.projectId, resolveSampleShootImageIds(draft, 'listingCandidateImageIds'))
  const archiveCandidates = resolveSampleShootImageItems(project.projectId, resolveSampleShootImageIds(draft, 'styleArchiveCandidateImageIds'))

  return `
    <section class="space-y-4">
      <article class="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-2">
        ${
          editable
            ? renderProjectTextarea('拍摄安排', 'sample-shoot-plan', String(draft.values.shootPlan || ''), '请输入拍摄安排')
            : renderProjectReadonlyBlock('拍摄安排', draft.values.shootPlan)
        }
        ${
          editable
            ? renderProjectTextarea('试穿反馈', 'sample-shoot-feedback', String(draft.values.fitFeedback || ''), '请输入试穿反馈')
            : renderProjectReadonlyBlock('试穿反馈', draft.values.fitFeedback)
        }
        <div class="md:col-span-2">
          ${
            editable
              ? renderProjectTextarea('图片补充说明', 'sample-shoot-image-note', String(draft.values.shootImageNote || ''), '补充说明图片用途、问题点或重拍要求')
              : renderProjectReadonlyBlock('图片补充说明', draft.values.shootImageNote)
          }
        </div>
      </article>
      ${SAMPLE_SHOOT_IMAGE_GROUPS.map((group) => {
        const imageIds = resolveSampleShootImageIds(draft, group.fieldKey)
        const items = resolveSampleShootImageItems(project.projectId, imageIds)
        return `
          <section class="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 class="text-sm font-semibold text-slate-900">${escapeHtml(group.label)}</h3>
                <p class="mt-1 text-xs text-slate-500">上传后进入项目图片资产池，可按用途继续标记。</p>
              </div>
              ${
                editable
                  ? `
                    <label class="inline-flex h-9 cursor-pointer items-center rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50">
                      上传${escapeHtml(group.label)}
                      <input type="file" accept="image/*" multiple class="hidden" data-pcs-project-field="${escapeHtml(group.uploadField)}" />
                    </label>
                  `
                  : ''
              }
            </div>
            ${renderSampleShootImageCards(items, editable, group.emptyText)}
          </section>
        `
      }).join('')}
      ${renderSampleShootVideoSection(draft, editable)}
      <section class="grid gap-4 md:grid-cols-2">
        <article class="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
          <div class="flex items-center justify-between gap-3">
            <h3 class="text-sm font-semibold text-slate-900">商品上架候选图</h3>
            <span class="text-xs text-slate-500">${listingCandidates.length} 张</span>
          </div>
          ${renderSampleShootImageCards(listingCandidates, false, '暂未标记商品上架候选图')}
        </article>
        <article class="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
          <div class="flex items-center justify-between gap-3">
            <h3 class="text-sm font-semibold text-slate-900">款式档案候选图</h3>
            <span class="text-xs text-slate-500">${archiveCandidates.length} 张</span>
          </div>
          ${renderSampleShootImageCards(archiveCandidates, false, '暂未标记款式档案候选图')}
        </article>
      </section>
      ${
        !editable
          ? ''
          : `
            <div class="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
              <button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-project-action="save-formal-fields">保存正式字段</button>
              <button type="button" class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-pcs-project-action="save-formal-fields-and-complete">保存并流转节点</button>
            </div>
          `
      }
    </section>
  `
}

function renderCreateReferenceImageSection(
  referenceImages: Array<{ imageUrl: string; imageName: string }>,
): string {
  return `
    <section class="space-y-3 rounded-lg border border-slate-200 px-3 py-3">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="text-sm font-medium text-slate-900">参考图片</p>
          <p class="mt-1 text-xs text-slate-500">上传商品项目立项参考图片，用于项目识别和后续节点参考。</p>
        </div>
        <label class="inline-flex h-9 cursor-pointer items-center rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50">
          上传参考图片
          <input type="file" accept="image/*" multiple class="hidden" data-pcs-project-field="create-reference-images" />
        </label>
      </div>
      ${
        referenceImages.length > 0
          ? renderProjectImageThumbnailGrid(referenceImages.map((item) => item.imageUrl), {
              removable: true,
              removeAction: 'remove-create-reference-image',
              titlePrefix: '参考图片',
              removeLabel: '删除参考图片',
            })
          : '<div class="rounded-md border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-400">暂未上传参考图片</div>'
      }
    </section>
  `
}

function buildProjectTaskOwnerOptions(project: PcsProjectRecord, node: PcsProjectNodeRecord): Array<{ value: string; label: string }> {
  const names = new Set<string>([
    project.ownerName,
    node.currentOwnerName,
    '当前用户',
    '张丽',
    '王明',
    '李娜',
    '赵云',
    '周芳',
    '陈刚',
    '商品负责人',
    '版师',
    '花型设计师',
  ].filter(Boolean))
  listProjects().forEach((item) => {
    if (item.ownerName) names.add(item.ownerName)
  })
  return [...names].sort((left, right) => left.localeCompare(right)).map((name) => ({ value: name, label: name }))
}

function getTemplateByStyleType(styleType: TemplateStyleType): ProjectTemplate | null {
  return listActiveProjectTemplates().find((template) => template.styleType.includes(styleType)) ?? null
}

function isNodeUnlocked(
  project: PcsProjectViewRecord,
  orderedNodes: PcsProjectNodeRecord[],
  node: PcsProjectNodeRecord,
): boolean {
  if (isClosedNodeStatus(node.currentStatus)) return true
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
  const logs: ProjectLogItem[] = []

  listProjectNodes(project.projectId).forEach((node) => {
    if (node.currentStatus !== '已完成') return
    if (!(node.lastEventTime || node.updatedAt)) return
    logs.push({
      time: node.lastEventTime || node.updatedAt || project.updatedAt,
      title: `${node.workItemTypeName}已完成`,
      detail: node.latestResultText || `${node.workItemTypeName}已完成。`,
      tone: 'emerald',
    })
  })

  return logs
    .sort((left, right) => right.time.localeCompare(left.time))
    .slice(0, 12)
}

function buildProjectViewModel(projectId: string): ProjectViewModel | null {
  const project = getProjectById(projectId)
  if (!project) return null

  const phases = listProjectPhases(projectId)
  const nodes = listProjectNodes(projectId)
  const instanceModel = getProjectInstanceModelSafe(projectId)
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
    if (project.projectStatus === PROJECT_STATUS_TERMINATED && phaseNodes.some((item) => !isClosedNodeStatus(item.node.currentStatus))) {
      derivedStatus = PROJECT_STATUS_TERMINATED
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

function buildProjectListViewModel(projectId: string): ProjectListViewModel | null {
  const project = getProjectById(projectId)
  if (!project) return null

  const phases = listProjectPhases(projectId)
  const nodes = listProjectNodes(projectId)
  const nodeViewModels: ProjectListNodeViewModel[] = nodes.map((node) => ({
    node,
    unlocked: isNodeUnlocked(project, nodes, node),
    displayStatus: getNodeDisplayStatus(project, nodes, node),
  }))

  const currentNode =
    nodeViewModels.find((item) => item.node.currentStatus === '进行中' || item.node.currentStatus === '待确认') ??
    nodeViewModels.find((item) => !isClosedNodeStatus(item.node.currentStatus) && item.unlocked) ??
    nodeViewModels[0] ??
    null
  const currentPhaseCode = currentNode?.node.phaseCode ?? project.currentPhaseCode
  const phaseViewModels: ProjectListPhaseViewModel[] = phases.map((phase) => {
    const phaseNodes = nodeViewModels.filter((item) => item.node.phaseCode === phase.phaseCode)
    let derivedStatus: PcsProjectPhaseRecord['phaseStatus'] = '未开始'

    if (project.projectStatus === PROJECT_STATUS_TERMINATED && phaseNodes.some((item) => !isClosedNodeStatus(item.node.currentStatus))) {
      derivedStatus = PROJECT_STATUS_TERMINATED
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
      derivedStatus,
      completedCount: phaseNodes.filter((item) => item.node.currentStatus === '已完成').length,
      totalCount: phaseNodes.length,
      pendingDecision: phaseNodes.some((item) => item.node.currentStatus === '待确认'),
      current: phase.phaseCode === currentPhaseCode,
    }
  })

  return {
    project,
    currentPhase: phaseViewModels.find((item) => item.phase.phaseCode === currentPhaseCode) ?? phaseViewModels[0] ?? null,
    nextNode:
      nodeViewModels.find((item) => !isClosedNodeStatus(item.node.currentStatus) && item.unlocked) ??
      nodeViewModels.find((item) => !isClosedNodeStatus(item.node.currentStatus)) ??
      null,
    pendingDecisionNode: nodeViewModels.find((item) => item.node.currentStatus === '待确认') ?? null,
    progressDone: nodeViewModels.filter((item) => item.node.currentStatus === '已完成').length,
    progressTotal: nodeViewModels.length,
    channelNames: getChannelNamesByCodes(project.targetChannelCodes),
  }
}

function getFilteredProjectViewModels(): ProjectListViewModel[] {
  ensureProjectDemoDataReadySync()
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
    .map((project) => buildProjectListViewModel(project.projectId))
    .filter((item): item is ProjectListViewModel => Boolean(item))
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

function buildProjectPhaseOptions(projects: ProjectListViewModel[]): string[] {
  return ['全部阶段', ...Array.from(new Set(projects.map((item) => item.currentPhase?.phase.phaseName || '-')))]
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
    referenceImages: [],
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
      priceRangeLabel: '',
      targetChannelCodes: catalog.channelOptions.slice(0, 2).map((item) => item.code),
      ownerId: owner?.id ?? '',
      ownerName: owner?.name ?? '',
      teamId: team?.id ?? '',
      teamName: team?.name ?? '',
      priorityLevel: '中',
      yearTag: catalog.yearTags[1] ?? String(new Date().getFullYear()),
    },
  }
}

function hasCreateDraftChanges(): boolean {
  const draft = state.create.draft
  return Boolean(
    draft.projectName.trim() ||
      draft.remark.trim() ||
      draft.seasonTags.length > 0 ||
      draft.styleTagIds.length > 0 ||
      draft.crowdPositioningIds.length > 0 ||
      draft.ageIds.length > 0 ||
      draft.crowdIds.length > 0 ||
      draft.productPositioningIds.length > 0 ||
      draft.collaboratorIds.length > 0 ||
      draft.priceRangeLabel.trim() ||
      state.create.referenceImages.length > 0 ||
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

function getProjectStatusDisplayText(status: PcsProjectRecord['projectStatus']): string {
  return status === PROJECT_STATUS_TERMINATED ? '已结束' : status
}

function getProjectStatusBadgeClass(status: PcsProjectRecord['projectStatus']): string {
  if (status === '已立项') return 'bg-blue-100 text-blue-700'
  if (status === '进行中') return 'bg-emerald-100 text-emerald-700'
  if (status === PROJECT_STATUS_TERMINATED) return 'bg-rose-100 text-rose-700'
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

function renderProjectProgress(project: ProjectListViewModel): string {
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

function renderListToolbar(filteredCount: number, phaseOptions: string[]): string {
  const ownerOptions = ['全部负责人', ...getProjectCreateCatalog().owners.map((item) => item.name)]
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
                state.list.status === option.value ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              )}" data-pcs-project-action="set-status-filter" data-value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</button>
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

function renderProjectListTable(projects: ProjectListViewModel[], totalPages: number): string {
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
                      <p class="mt-1 text-xs text-slate-500">可以修改筛选条件，或直接创建一个新的商品项目。</p>
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
                              <button type="button" class="inline-flex h-7 items-center rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-700 hover:bg-slate-50" data-pcs-project-action="open-terminate" data-project-id="${escapeHtml(item.project.projectId)}">结束</button>
                              <button type="button" class="inline-flex h-7 items-center rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-700 hover:bg-slate-50" data-pcs-project-action="archive-project" data-project-id="${escapeHtml(item.project.projectId)}">归档</button>
                            </div>
                          </td>
                          <td class="px-4 py-3">
                            <button type="button" class="text-left font-medium text-blue-700 hover:underline" data-nav="/pcs/projects/${escapeHtml(item.project.projectId)}">${escapeHtml(item.project.projectName)}</button>
                            <div class="mt-1 flex flex-wrap items-center gap-2 text-xs">
                              <span class="inline-flex rounded-full px-2 py-0.5 ${getProjectStatusBadgeClass(item.project.projectStatus)}">${escapeHtml(getProjectStatusDisplayText(item.project.projectStatus))}</span>
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

function renderProjectGrid(projects: ProjectListViewModel[], totalPages: number): string {
  return `
    <section class="space-y-4">
      ${
        projects.length === 0
          ? `
            <div class="rounded-lg border bg-white p-16 text-center">
              <p class="text-sm font-medium text-slate-700">暂无符合条件的商品项目</p>
              <p class="mt-1 text-xs text-slate-500">可以修改筛选条件，或直接创建一个新的商品项目。</p>
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
                        <span class="inline-flex rounded-full px-2 py-0.5 text-xs ${getProjectStatusBadgeClass(item.project.projectStatus)}">${escapeHtml(getProjectStatusDisplayText(item.project.projectStatus))}</span>
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
    '结束项目',
    `请说明结束「${project.projectName}」的原因，该记录会写入项目日志。`,
    `
      <label class="space-y-1">
        <span class="text-xs text-slate-500">结束原因</span>
        <textarea class="min-h-[120px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="请输入结束原因" data-pcs-project-field="terminate-reason">${escapeHtml(state.terminateReason)}</textarea>
      </label>
    `,
    `
      <button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-project-action="close-dialogs">取消</button>
      <button type="button" class="inline-flex h-9 items-center rounded-md bg-rose-600 px-4 text-sm font-medium text-white hover:bg-rose-700 ${state.terminateReason.trim() ? '' : 'opacity-50'}" data-pcs-project-action="confirm-terminate" ${state.terminateReason.trim() ? '' : 'disabled'}>确认结束</button>
    `,
  )
}

function renderProjectListHeader(): string {
  return `
    <section class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="text-xs text-slate-500">商品中心 / 商品项目</p>
        <h1 class="mt-1 text-2xl font-semibold text-slate-900">商品项目列表</h1>
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
  const audienceTags = getCreateDraftAudienceTags(draft)
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
                    </button>
                  `,
                )
                .join('')}
            </div>
          </div>

          <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label class="space-y-1">
              <span class="text-xs text-slate-500">项目类型</span>
              <input class="h-10 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600 outline-none" value="${escapeHtml(draft.projectType || getProjectTypeLabel((draft.styleType || '基础款') as TemplateStyleType))}" readonly />
            </label>
            <label class="space-y-1">
              <span class="text-xs text-slate-500">项目来源 <span class="text-rose-500">*</span></span>
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
              <span class="text-xs text-slate-500">一级品类 <span class="text-rose-500">*</span></span>
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
              <span class="text-xs text-slate-500">二级品类</span>
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
              <span class="text-xs text-slate-500">项目模板 <span class="text-rose-500">*</span></span>
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
              <span class="text-xs text-slate-500">品牌 <span class="text-rose-500">*</span></span>
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
              <span class="text-xs text-slate-500">风格编号</span>
              <select class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" data-pcs-project-field="create-style-code">
                <option value="">请选择风格编号</option>
                ${catalog.styleCodes
                  .map(
                    (option) =>
                      `<option value="${escapeHtml(option.id)}" ${draft.styleCodeId === option.id ? 'selected' : ''}>${escapeHtml(option.name)}</option>`,
                  )
                  .join('')}
              </select>
            </label>
            <label class="space-y-1">
              <span class="text-xs text-slate-500">年份 <span class="text-rose-500">*</span></span>
              <select class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" data-pcs-project-field="create-year">
                ${catalog.yearTags
                  .map(
                    (option) =>
                      `<option value="${escapeHtml(option)}" ${draft.yearTag === option ? 'selected' : ''}>${escapeHtml(option)}</option>`,
                  )
                  .join('')}
              </select>
            </label>
            <label class="space-y-1">
              <span class="text-xs text-slate-500">价格带 <span class="text-rose-500">*</span></span>
              <select class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" data-pcs-project-field="create-price-range">
                <option value="">请选择价格带</option>
                ${catalog.priceRanges
                  .map(
                    (option) =>
                      `<option value="${escapeHtml(option)}" ${draft.priceRangeLabel === option ? 'selected' : ''}>${escapeHtml(option)}</option>`,
                  )
                  .join('')}
              </select>
            </label>
            <label class="space-y-1">
              <span class="text-xs text-slate-500">优先级</span>
              <select class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" data-pcs-project-field="create-priority">
                ${catalog.priorityLevels
                  .map(
                    (option) =>
                      `<option value="${escapeHtml(option)}" ${draft.priorityLevel === option ? 'selected' : ''}>${escapeHtml(option)}</option>`,
                  )
                  .join('')}
              </select>
            </label>
            <label class="space-y-1">
              <span class="text-xs text-slate-500">负责人 <span class="text-rose-500">*</span></span>
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
              <span class="text-xs text-slate-500">执行团队 <span class="text-rose-500">*</span></span>
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
              <span class="text-sm font-medium text-slate-900">季节标签</span>
            </div>
            <div class="flex flex-wrap gap-2">
              ${catalog.seasonTags
                .map((tag) => renderCreateTagButton(tag, draft.seasonTags.includes(tag), 'toggle-season-tag', tag))
                .join('')}
            </div>
          </div>

          <div class="space-y-3">
            <div>
              <span class="text-sm font-medium text-slate-900">风格标签</span>
            </div>
            <div class="flex flex-wrap gap-2">
              ${catalog.styles
                .map((option) =>
                  renderCreateTagButton(
                    option.name,
                    draft.styleTagIds.includes(option.id),
                    'toggle-style-tag',
                    option.id,
                  ),
                )
                .join('')}
            </div>
          </div>

          <div class="grid gap-6 xl:grid-cols-2">
            <div class="space-y-3">
              <div>
                <span class="text-sm font-medium text-slate-900">人群定位</span>
              </div>
              <div class="flex flex-wrap gap-2">
                ${catalog.crowdPositioning
                  .map((option) =>
                    renderCreateTagButton(
                      option.name,
                      draft.crowdPositioningIds.includes(option.id),
                      'toggle-crowd-positioning',
                      option.id,
                    ),
                  )
                  .join('')}
              </div>
            </div>
            <div class="space-y-3">
              <div>
                <span class="text-sm font-medium text-slate-900">年龄带</span>
              </div>
              <div class="flex flex-wrap gap-2">
                ${catalog.ages
                  .map((option) => renderCreateTagButton(option.name, draft.ageIds.includes(option.id), 'toggle-age', option.id))
                  .join('')}
              </div>
            </div>
            <div class="space-y-3">
              <div>
                <span class="text-sm font-medium text-slate-900">人群</span>
              </div>
              <div class="flex flex-wrap gap-2">
                ${catalog.crowds
                  .map((option) =>
                    renderCreateTagButton(option.name, draft.crowdIds.includes(option.id), 'toggle-crowd', option.id),
                  )
                  .join('')}
              </div>
            </div>
            <div class="space-y-3">
              <div>
                <span class="text-sm font-medium text-slate-900">商品定位</span>
              </div>
              <div class="flex flex-wrap gap-2">
                ${catalog.productPositioning
                  .map((option) =>
                    renderCreateTagButton(
                      option.name,
                      draft.productPositioningIds.includes(option.id),
                      'toggle-product-positioning',
                      option.id,
                    ),
                  )
                  .join('')}
              </div>
            </div>
          </div>

          <div class="space-y-3">
            <div>
              <span class="text-sm font-medium text-slate-900">目标客群标签</span>
            </div>
            <div class="flex min-h-10 flex-wrap gap-2 rounded-md border border-dashed border-slate-200 px-3 py-2">
              ${
                audienceTags.length > 0
                  ? audienceTags
                      .map((tag) => `<span class="inline-flex rounded-md bg-slate-100 px-2.5 py-1 text-xs text-slate-700">${escapeHtml(tag)}</span>`)
                      .join('')
                  : '<span class="text-xs text-slate-400">将随上方标签自动生成</span>'
              }
            </div>
          </div>

          <div class="space-y-3">
            <div>
              <span class="text-sm font-medium text-slate-900">协同人</span>
            </div>
            <div class="flex flex-wrap gap-2">
              ${catalog.collaborators
                .map((option) =>
                  renderCreateTagButton(
                    option.name,
                    draft.collaboratorIds.includes(option.id),
                    'toggle-collaborator',
                    option.id,
                  ),
                )
                .join('')}
            </div>
          </div>

          <div class="space-y-3">
            <div>
              <span class="text-sm font-medium text-slate-900">目标测款渠道 <span class="text-rose-500">*</span></span>
            </div>
            <div class="flex flex-wrap gap-2">
              ${catalog.channelOptions.map(
                (option) =>
                  renderCreateTagButton(
                    option.name,
                    draft.targetChannelCodes.includes(option.code),
                    'toggle-channel',
                    option.code,
                  ),
              ).join('')}
            </div>
          </div>

          ${renderCreateReferenceImageSection(state.create.referenceImages)}

          <label class="space-y-1">
            <span class="text-sm font-medium text-slate-900">项目说明</span>
            <textarea class="min-h-[120px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="补充项目背景、阶段目标或风险提醒" data-pcs-project-field="create-remark">${escapeHtml(draft.remark)}</textarea>
          </label>
        </div>
      </section>

      <section class="rounded-lg border bg-white p-4">
        <div class="mb-6">
          <h2 class="text-lg font-semibold text-slate-900">模板预览</h2>
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
              <span class="inline-flex rounded-full px-2 py-0.5 text-xs ${getProjectStatusBadgeClass(viewModel.project.projectStatus)}">${escapeHtml(getProjectStatusDisplayText(viewModel.project.projectStatus))}</span>
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

interface EngineeringTaskBasicField {
  label: string
  value: string
}

interface EngineeringTaskBasicSnapshot {
  taskLabel: string
  taskCode: string
  taskStatus: string
  updatedAt: string
  taskExists: boolean
  fields: EngineeringTaskBasicField[]
}

function isEngineeringTaskPolicyCode(code: string): code is EngineeringTaskFieldPolicyCode {
  return code === 'REVISION_TASK' || code === 'PATTERN_TASK' || code === 'PATTERN_ARTWORK_TASK'
}

function formatEngineeringTaskBasicFieldValue(task: Record<string, unknown> | null, fieldKey: string): string {
  if (!task) return '-'

  if (fieldKey === 'revisionScopeCodes') {
    const names = Array.isArray(task.revisionScopeNames)
      ? task.revisionScopeNames.map((item) => String(item ?? '').trim()).filter(Boolean)
      : []
    const codes = Array.isArray(task.revisionScopeCodes)
      ? task.revisionScopeCodes.map((item) => String(item ?? '').trim()).filter(Boolean)
      : []
    return names.join('、') || codes.join('、') || '-'
  }

  if (fieldKey === 'baseStyleCode') {
    const values = [task.baseStyleCode, task.baseStyleName]
      .map((item) => String(item ?? '').trim())
      .filter(Boolean)
    return values.join(' / ') || '-'
  }

  if (fieldKey === 'fabricSku') {
    const values = [task.fabricSku, task.fabricName]
      .map((item) => String(item ?? '').trim())
      .filter(Boolean)
    return values.join(' / ') || '-'
  }

  if (fieldKey === 'assignedTeamCode') {
    return String(task.assignedTeamName || task.assignedTeamCode || '').trim() || '-'
  }

  if (fieldKey === 'assignedMemberId') {
    return String(task.assignedMemberName || task.assignedMemberId || '').trim() || '-'
  }

  if (fieldKey === 'patternMakerName') {
    return String(task.patternMakerName || task.ownerName || '').trim() || '-'
  }

  if (fieldKey === 'demandImageIds' || fieldKey === 'evidenceImageUrls') {
    const values = Array.isArray(task[fieldKey]) ? task[fieldKey].map((item) => String(item ?? '').trim()).filter(Boolean) : []
    return values.length > 0 ? `${values.length} 张` : '-'
  }

  const value = task[fieldKey]
  if (Array.isArray(value)) {
    const values = value.map((item) => String(item ?? '').trim()).filter(Boolean)
    return values.join('、') || '-'
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '-'
  }
  if (typeof value === 'boolean') {
    return value ? '是' : '否'
  }
  const text = String(value ?? '').trim()
  if (!text) return '-'
  if (fieldKey.endsWith('At')) return formatDateTime(text)
  return text
}

function resolveEngineeringTaskBasicSnapshot(
  project: PcsProjectRecord,
  node: ProjectNodeViewModel,
): EngineeringTaskBasicSnapshot | null {
  if (!isEngineeringTaskPolicyCode(node.node.workItemTypeCode)) {
    return null
  }

  const policy = getEngineeringTaskFieldPolicy(node.node.workItemTypeCode)
  const buildSnapshot = (
    task: Record<string, unknown> | null,
    taskCode: string,
    taskStatus: string,
    updatedAt: string,
  ): EngineeringTaskBasicSnapshot => ({
    taskLabel: policy.taskLabel,
    taskCode,
    taskStatus,
    updatedAt,
    taskExists: Boolean(task),
    fields: policy.createRequiredFields.map((field) => ({
      label: field.label,
      value: formatEngineeringTaskBasicFieldValue(task, field.fieldKey),
    })),
  })

  if (node.node.workItemTypeCode === 'REVISION_TASK') {
    const relation =
      findLatestNodeRelation(project.projectId, node.node.projectNodeId, '改版任务', '改版任务') ||
      findLatestProjectRelation(project.projectId, '改版任务', '改版任务')
    const taskId = relation?.sourceObjectId || relation?.instanceId || node.node.latestInstanceId || ''
    const task = taskId ? getRevisionTaskByIdSafe(taskId) : null
    return buildSnapshot(task, task?.revisionTaskCode || '', task?.status || '未创建', task?.updatedAt || node.node.updatedAt || '')
  }

  if (node.node.workItemTypeCode === 'PATTERN_TASK') {
    const relation =
      findLatestNodeRelation(project.projectId, node.node.projectNodeId, '制版任务', '制版任务') ||
      findLatestProjectRelation(project.projectId, '制版任务', '制版任务')
    const taskId = relation?.sourceObjectId || relation?.instanceId || node.node.latestInstanceId || ''
    const task = taskId ? getPlateMakingTaskByIdSafe(taskId) : null
    return buildSnapshot(task, task?.plateTaskCode || '', task?.status || '未创建', task?.updatedAt || node.node.updatedAt || '')
  }

  const relation =
    findLatestNodeRelation(project.projectId, node.node.projectNodeId, '花型任务', '花型任务') ||
    findLatestProjectRelation(project.projectId, '花型任务', '花型任务')
  const taskId = relation?.sourceObjectId || relation?.instanceId || node.node.latestInstanceId || ''
  const task = taskId ? getPatternTaskByIdSafe(taskId) : null
  return buildSnapshot(task, task?.patternTaskCode || '', task?.status || '未创建', task?.updatedAt || node.node.updatedAt || '')
}

function renderEngineeringTaskBasicSection(project: PcsProjectRecord, node: ProjectNodeViewModel): string {
  const snapshot = resolveEngineeringTaskBasicSnapshot(project, node)
  if (!snapshot) return ''

  const metaText = snapshot.taskExists
    ? [snapshot.taskCode, snapshot.taskStatus, formatDateTime(snapshot.updatedAt)].filter(Boolean).join(' · ')
    : '未创建'

  return `
    <section class="space-y-4">
      <article class="rounded-lg border bg-white p-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 class="text-base font-semibold text-slate-900">${escapeHtml(snapshot.taskLabel)}</h3>
            <p class="mt-1 text-xs text-slate-500">${escapeHtml(metaText)}</p>
          </div>
        </div>
        <div class="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          ${snapshot.fields
            .map(
              (field) => `
                <article class="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p class="text-xs text-slate-500">${escapeHtml(field.label)}</p>
                  <p class="mt-2 text-sm font-medium leading-6 text-slate-900">${escapeHtml(field.value)}</p>
                </article>
              `,
            )
            .join('')}
        </div>
      </article>
    </section>
  `
}

function renderProjectInitSnapshot(project: PcsProjectRecord, node: ProjectNodeViewModel): string {
  const groups = listProjectWorkItemFieldGroups('PROJECT_INIT')
  const referenceImages = listProjectReferenceImageViewModels(project.projectId)
  const editable = node.displayStatus !== '未解锁' && (node.node.currentStatus === '进行中' || node.node.currentStatus === '待确认')

  return `
    <div class="space-y-4">
      ${groups
        .map((group) => `
          <section class="space-y-3">
            ${groups.length > 1 ? `<h3 class="text-sm font-semibold text-slate-900">${escapeHtml(group.groupTitle)}</h3>` : ''}
            <div class="grid gap-3 md:grid-cols-2">
              ${group.fields
                .map((field) => {
                  if (field.fieldKey === 'projectAlbumUrls') {
                    return `
                      <div class="space-y-3 rounded-md border border-slate-200 bg-white px-3 py-3 md:col-span-2">
                        <div class="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p class="text-xs text-slate-500">${escapeHtml(field.label)}</p>
                            <p class="mt-1 text-sm text-slate-700">立项参考图片仅用于项目识别和后续节点参考。</p>
                          </div>
                          ${
                            editable
                              ? `
                                <label class="inline-flex h-9 cursor-pointer items-center rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50">
                                  上传参考图片
                                  <input type="file" accept="image/*" multiple class="hidden" data-pcs-project-field="project-init-reference-images" />
                                </label>
                              `
                              : ''
                          }
                        </div>
                        ${
                          referenceImages.length > 0
                            ? `
                                <div class="grid grid-cols-4 gap-3 sm:grid-cols-5">
                                  ${referenceImages
                                    .map(
                                      (item, index) => `
                                        <div class="group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                                          <button type="button" class="block h-20 w-full overflow-hidden" data-pcs-project-action="open-image-preview" data-url="${escapeHtml(item.imageUrl)}" data-title="${escapeHtml(item.previewTitle)}" aria-label="${escapeHtml(`查看参考图片 ${index + 1}`)}">
                                            <img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.imageName)}" class="h-full w-full object-cover transition group-hover:scale-105" />
                                          </button>
                                          ${
                                            editable
                                              ? `<button type="button" class="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-xs text-slate-600 shadow hover:bg-white" data-pcs-project-action="remove-project-reference-image" data-image-id="${escapeHtml(item.imageId)}" aria-label="删除参考图片">×</button>`
                                              : ''
                                          }
                                        </div>
                                      `,
                                    )
                                    .join('')}
                                </div>
                              `
                            : '<div class="rounded-md border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-400">暂未上传参考图片</div>'
                        }
                      </div>
                    `
                  }

                  return `
                    <div class="rounded-md border border-slate-200 bg-white px-3 py-3">
                      <p class="text-xs text-slate-500">${escapeHtml(field.label)}</p>
                      <div class="mt-2 text-sm leading-6 text-slate-700">${renderReadonlyValue(getNodeFieldValue(project, node, field.fieldKey))}</div>
                    </div>
                  `
                })
                .join('')}
            </div>
          </section>
        `)
        .join('')}
    </div>
  `
}

function isProjectNodeKeyInfoOnly(node: ProjectNodeViewModel): boolean {
  return isEngineeringTaskPolicyCode(node.node.workItemTypeCode)
}

function canEditProjectNodeFields(node: ProjectNodeViewModel): boolean {
  return node.displayStatus !== '未解锁' && node.node.currentStatus !== '已取消' && node.node.currentStatus !== '已完成'
}

function renderReadonlyFieldSection(project: PcsProjectRecord, node: ProjectNodeViewModel): string {
  const groups = listProjectWorkItemFieldGroups(node.node.workItemTypeCode as PcsProjectWorkItemCode)
  if (groups.length === 0) {
    return `
      <article class="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
        <p class="text-sm font-medium text-slate-700">暂无正式字段</p>
      </article>
    `
  }

  return `<div class="space-y-4">${groups.map((group) => renderFieldGroupValues(group, project, node, groups.length > 1)).join('')}</div>`
}

function renderProjectNodeInlineContent(project: PcsProjectRecord, node: ProjectNodeViewModel): string {
  if (node.node.workItemTypeCode === 'PROJECT_INIT') {
    return renderProjectInitSnapshot(project, node)
  }

  if (isSampleShootFitNode(node)) {
    return renderSampleShootFitWorkspace(project, node)
  }

  if (isChannelListingNode(node)) {
    return renderChannelListingNodeWorkspace(project, node)
  }

  if (node.node.workItemTypeCode === 'STYLE_ARCHIVE_CREATE') {
    return renderStyleArchiveCreateWorkspace(project, node)
  }

  if (isDecisionNode(node)) {
    return renderDecisionNodeSection(project, node)
  }

  if (isProjectNodeKeyInfoOnly(node)) {
    return renderEngineeringTaskBasicSection(project, node)
  }

  if (canUseInlineRecords(node.node.workItemTypeCode) && canEditProjectNodeFields(node)) {
    return renderFormalFieldEntrySection(project, node)
  }

  return renderReadonlyFieldSection(project, node)
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
  const closure = buildProjectClosureViewModel(viewModel.project.projectId)
  return `
    <article class="rounded-lg border bg-white p-4">
      <h2 class="text-base font-semibold text-slate-900">项目概览</h2>
      <div class="mt-4 space-y-3 text-sm text-slate-600">
        <div class="flex items-center justify-between gap-3"><span>模板</span><span class="text-right font-medium text-slate-900">${escapeHtml(viewModel.project.templateName)}</span></div>
        <div class="flex items-center justify-between gap-3"><span>阶段进度</span><span class="text-right font-medium text-slate-900">${viewModel.progressDone}/${viewModel.progressTotal}</span></div>
        <div class="flex items-center justify-between gap-3"><span>当前待办</span><span class="text-right font-medium text-slate-900">${escapeHtml(viewModel.nextNode?.node.workItemTypeName || '无')}</span></div>
        <div class="flex items-center justify-between gap-3"><span>风险状态</span><span class="text-right font-medium ${viewModel.project.riskStatus === '延期' ? 'text-amber-600' : 'text-emerald-600'}">${escapeHtml(getRiskText(viewModel.project))}</span></div>
        <div class="flex items-center justify-between gap-3"><span>测款渠道</span><span class="text-right font-medium text-slate-900">${escapeHtml(viewModel.channelNames.join('、') || '-')}</span></div>
        ${closure ? `
          <div class="border-t border-slate-100 pt-3">
            <div class="text-xs font-medium text-slate-500">项目资料归档闭环</div>
            <div class="mt-2 space-y-2">
              <div class="flex items-center justify-between gap-3"><span>当前款式档案</span><span class="text-right font-medium text-slate-900">${escapeHtml(closure.styleText)}</span></div>
              <div class="flex items-center justify-between gap-3"><span>当前技术包版本</span><span class="text-right font-medium text-slate-900">${escapeHtml(closure.currentTechnicalVersionText)}</span></div>
              <div class="flex items-center justify-between gap-3"><span>当前花型资产</span><span class="text-right font-medium text-slate-900">${escapeHtml(closure.currentPatternAssetText)}</span></div>
              <div class="flex items-center justify-between gap-3"><span>技术包版本日志</span><span class="text-right font-medium text-slate-900">${escapeHtml(closure.techPackLogText)}</span></div>
              <div class="flex items-center justify-between gap-3"><span>归档状态</span><span class="text-right font-medium text-slate-900">${escapeHtml(closure.archiveStatusText)}</span></div>
            </div>
          </div>
        ` : ''}
      </div>
    </article>
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
  ensureProjectDemoDataReadySync()
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
                      ${
                        isChannelListingNode(selectedNode)
                          ? ''
                          : isDecisionNode(selectedNode)
                          ? `${
                              canOpenDecisionAction(selectedNode)
                                ? '<button type="button" class="inline-flex h-9 items-center rounded-md bg-amber-500 px-4 text-sm font-medium text-white hover:bg-amber-600" data-pcs-project-action="open-decision" data-source="detail">做出决策</button>'
                                : ''
                            }`
                          : `
                              ${renderEngineeringTaskNodeAction(viewModel.project, selectedNode)}
                              ${renderStyleArchiveNodeAction(viewModel.project, selectedNode)}
                              ${renderTestingCreateAction(viewModel.project, selectedNode)}
                              ${!locked && canRenderManualCompleteAction(selectedNode)
                                ? '<button type="button" class="inline-flex h-9 items-center rounded-md border border-emerald-200 bg-emerald-50 px-4 text-sm font-medium text-emerald-700 hover:bg-emerald-100" data-pcs-project-action="mark-node-complete">标记完成</button>'
                                : ''}
                            `
                      }
                    </div>
                  </div>
                </section>
                ${locked ? `<section class="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">当前节点尚未解锁，请先完成前序工作项后再继续处理。</section>` : ''}
                ${renderProjectNodeInlineContent(viewModel.project, selectedNode)}
              `
              : ''
          }
        </div>
        <div class="space-y-4">
          ${renderProjectOverviewCard(viewModel)}
          ${renderProjectLogs(viewModel.logs)}
        </div>
      </div>
      ${renderProjectTerminateDialog()}
      ${renderDetailDecisionDialog(viewModel, selectedNode)}
      ${renderEngineeringTaskCreateDialog()}
      ${renderProjectImagePreviewModal()}
    </div>
  `
}

function renderFieldGroupValues(
  group: PcsProjectNodeFieldGroupDefinition,
  project: PcsProjectRecord,
  node: ProjectNodeViewModel,
  showHeader = true,
): string {
  return `
    <section class="space-y-3">
      ${showHeader ? `<h3 class="text-sm font-semibold text-slate-900">${escapeHtml(group.groupTitle)}</h3>` : ''}
      <div class="grid gap-3 md:grid-cols-2">
        ${group.fields
          .map((field) => {
            return `
              <div class="rounded-md border border-slate-200 bg-white px-3 py-3">
                <p class="text-xs text-slate-500">${escapeHtml(field.label)}</p>
                <div class="mt-2 text-sm leading-6 text-slate-700">${renderReadonlyValue(getNodeFieldValue(project, node, field.fieldKey))}</div>
              </div>
            `
          })
          .join('')}
      </div>
    </section>
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
  const disabled = !canEditProjectNodeFields(node)
  const showHeader = groups.length > 1

  return groups
    .map((group) => {
      const items = group.fields
        .map((field) => {
          const editable = !field.readonly && editableKeys.has(field.fieldKey)
          const value = editable
            ? formatDraftFieldValue(field.type, draft.values[field.fieldKey] ?? '')
            : formatDraftFieldValue(field.type, getNodeFieldValue(project, node, field.fieldKey))

          return `
            <div class="space-y-1 rounded-md border border-slate-200 bg-white p-3">
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
            </div>
          `
        })
        .join('')

      return `
        <section class="space-y-3">
          ${showHeader ? `<h3 class="text-sm font-semibold text-slate-900">${escapeHtml(group.groupTitle)}</h3>` : ''}
          <div class="grid gap-3 ${compact ? 'md:grid-cols-1' : 'md:grid-cols-2'}">
            ${items}
          </div>
        </section>
      `
    })
    .join('')
}

function renderFormalFieldEntrySection(project: PcsProjectRecord, node: ProjectNodeViewModel): string {
  if (isDecisionNode(node)) {
    return renderDecisionNodeSection(project, node)
  }

  if (!canUseInlineRecords(node.node.workItemTypeCode)) {
    if (node.node.workItemTypeCode === 'PROJECT_INIT') {
      return `
        <section class="rounded-lg border bg-white p-4">
          <h3 class="text-base font-semibold text-slate-900">工作项字段</h3>
        </section>
      `
    }
    if (!PROJECT_NODE_FIELD_MODULE_EXCEPTIONS.has(node.node.workItemTypeCode)) {
      const testingAction = renderTestingCreateAction(project, node)
      return `
        <section class="rounded-lg border bg-white p-4">
          <h3 class="text-base font-semibold text-slate-900">关联字段</h3>
          <div class="mt-2 flex flex-wrap items-center justify-between gap-3">
            ${testingAction}
          </div>
        </section>
      `
    }
    const testingAction = renderTestingCreateAction(project, node)
    return `
      <section class="rounded-lg border bg-white p-4">
        <h3 class="text-base font-semibold text-slate-900">填写字段</h3>
        <div class="mt-2 flex flex-wrap items-center justify-between gap-3">
          ${testingAction}
        </div>
      </section>
    `
  }

  const draft = getNodeRecordDraft(project, node)
  const recordMode = node.contract.runtimeType === 'execute' && node.definition?.workItemNature === '执行类' && node.node.multiInstanceFlag

  return `
    <section class="space-y-4">
      <div class="flex flex-wrap justify-end gap-3">
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
            <div class="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
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
  if (isChannelListingNode(node)) {
    return renderChannelListingNodeWorkspace(project, node)
  }

  if (isEngineeringTaskPolicyCode(node.node.workItemTypeCode)) {
    return renderEngineeringTaskBasicSection(project, node)
  }

  const groups = listProjectWorkItemFieldGroups(node.node.workItemTypeCode as PcsProjectWorkItemCode)
  if (node.displayStatus === '未解锁') {
    return `<section class="rounded-lg border bg-white p-4 text-sm text-slate-600">当前节点尚未解锁，请先完成前序工作项。</section>`
  }

  const bodyContent =
    node.node.workItemTypeCode === 'PROJECT_INIT'
      ? renderProjectInitSnapshot(project, node)
      : node.node.workItemTypeCode === 'SAMPLE_SHOOT_FIT'
        ? renderSampleShootFitWorkspace(project, node)
      : `
        ${renderFormalFieldEntrySection(project, node)}
        ${groups.map((group) => renderFieldGroupValues(group, project, node)).join('')}
      `

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
      ${bodyContent}
    </div>
  `
}

function renderWorkItemRecords(node: ProjectNodeViewModel): string {
  const context = getCurrentProjectNodeContext()
  const testingAction = context ? renderTestingCreateAction(context.project, node) : ''
  const canInlineRecord = canUseInlineRecords(node.node.workItemTypeCode) && node.displayStatus !== '未解锁' && node.node.currentStatus !== '已取消'
  const recordAction = testingAction || (canInlineRecord ? '<button type="button" class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-pcs-project-action="open-record-dialog">新增记录</button>' : '')

  if (node.records.length === 0) {
    return `
      <section class="rounded-lg border bg-white p-4">
        <div class="flex items-center justify-between gap-3">
          <div>
            <h3 class="text-base font-semibold text-slate-900">执行记录</h3>
          </div>
          ${recordAction}
        </div>
      </section>
    `
  }

  return `
    <section class="rounded-lg border bg-white p-4">
      <div class="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 class="text-base font-semibold text-slate-900">执行记录</h3>
        </div>
        ${recordAction}
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
  if (!meta) return ['通过', '淘汰']
  const groups = listProjectWorkItemFieldGroups(node.node.workItemTypeCode as PcsProjectWorkItemCode)
  const valueField = groups.flatMap((group) => group.fields).find((field) => field.fieldKey === meta.valueFieldKey)
  if (valueField?.options?.length) {
    return valueField.options.map((item) => item.value)
  }
  return ['通过', '淘汰']
}

function isDecisionNode(node: ProjectNodeViewModel): boolean {
  return Boolean(getDecisionFieldMeta(node.node.workItemTypeCode))
}

function canOpenDecisionAction(node: ProjectNodeViewModel): boolean {
  return isDecisionNode(node) && node.displayStatus !== '未解锁' && !isClosedNodeStatus(node.node.currentStatus)
}

function canRenderManualCompleteAction(node: ProjectNodeViewModel): boolean {
  if (isDecisionNode(node)) return false
  if (node.displayStatus === '未解锁') return false
  if (node.node.currentStatus === '已完成' || node.node.currentStatus === '已取消') return false
  return !PROJECT_NODE_MANUAL_COMPLETE_BLOCKED_TYPES.has(node.node.workItemTypeCode)
}

function getManualCompleteBlockedNotice(node: ProjectNodeViewModel): string {
  if (isDecisionNode(node)) {
    return '决策类节点请通过“做出决策”完成流转。'
  }
  if (PROJECT_NODE_MANUAL_COMPLETE_BLOCKED_TYPES.has(node.node.workItemTypeCode)) {
    return '当前节点需通过正式业务对象推进，不能手动标记完成。'
  }
  return '当前节点不支持手动标记完成。'
}

function renderDecisionNodeSection(project: PcsProjectRecord, node: ProjectNodeViewModel): string {
  return `
    <section class="space-y-4">
      <article class="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <h3 class="text-sm font-semibold text-amber-900">决策节点</h3>
        <p class="mt-2 text-sm leading-6 text-amber-800">当前节点只保留“做出决策”操作。提交结果后，系统会根据决策结果自动流转到下一个节点，或进入样衣退回处理。</p>
      </article>
      ${renderReadonlyFieldSection(project, node)}
    </section>
  `
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
  ensureProjectDemoDataReadySync()
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
  const canRecord =
    canUseInlineRecords(node.node.workItemTypeCode) &&
    !isDecisionNode(node) &&
    node.displayStatus !== '未解锁' &&
    node.node.currentStatus !== '已取消'
  const testingAction = renderTestingCreateAction(viewModel.project, node, canRecord ? 'secondary' : 'primary')
  const styleArchiveAction = renderStyleArchiveNodeAction(
    viewModel.project,
    node,
    canRecord ? 'secondary' : 'primary',
  )

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
              isChannelListingNode(node)
                ? ''
                : isDecisionNode(node)
                ? `${
                    canOpenDecisionAction(node)
                      ? '<button type="button" class="inline-flex h-9 items-center rounded-md bg-amber-500 px-4 text-sm font-medium text-white hover:bg-amber-600" data-pcs-project-action="open-decision" data-source="work-item">做出决策</button>'
                      : ''
                  }`
                : `
                    ${renderEngineeringTaskNodeAction(viewModel.project, node, canRecord ? 'secondary' : 'primary')}
                    ${styleArchiveAction}
                    ${testingAction}
                    ${canRecord ? '<button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-project-action="open-record-dialog">新增记录</button>' : ''}
                    ${canRenderManualCompleteAction(node)
                      ? '<button type="button" class="inline-flex h-9 items-center rounded-md bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700" data-pcs-project-action="mark-node-complete">标记完成</button>'
                      : ''}
                  `
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
      ${renderEngineeringTaskCreateDialog()}
      ${renderProjectImagePreviewModal()}
    </div>
  `
}

export async function renderPcsProjectListPage(): Promise<string> {
  await ensureProjectDemoSeedServiceReady()
  ensureProjectDemoDataReadySync()
  const { filtered, paged, totalPages } = getPagedProjects()
  const phaseOptions = buildProjectPhaseOptions(filtered)
  return `
    <div class="space-y-5 p-4">
      ${renderNotice()}
      ${renderProjectListHeader()}
      ${renderListToolbar(filtered.length, phaseOptions)}
      ${state.list.viewMode === 'list' ? renderProjectListTable(paged, totalPages) : renderProjectGrid(paged, totalPages)}
      ${renderProjectTerminateDialog()}
    </div>
  `
}

export async function renderPcsProjectCreatePage(): Promise<string> {
  return renderCreatePage()
}

export async function renderPcsProjectDetailPage(projectId: string): Promise<string> {
  const loadingTasks: Array<Promise<unknown>> = [ensureProjectDetailSupportReady(), ensureProjectDemoSeedServiceReady()]
  await Promise.all(loadingTasks)
  return renderProjectDetailPage(projectId)
}

export async function renderPcsProjectWorkItemDetailPage(projectId: string, projectNodeId: string): Promise<string> {
  const loadingTasks: Array<Promise<unknown>> = [ensureProjectDetailSupportReady(), ensureProjectDemoSeedServiceReady()]
  await Promise.all(loadingTasks)
  return renderProjectWorkItemDetailPage(projectId, projectNodeId)
}

function closeAllDialogs(): void {
  state.terminateProjectId = null
  state.terminateReason = ''
  state.createCancelOpen = false
  state.imagePreview = { open: false, url: '', title: '' }
  state.decisionDialog = {
    open: false,
    source: 'detail',
    projectId: '',
    projectNodeId: '',
    value: '',
    note: '',
  }
  state.recordDialog = createEmptyRecordDialogState()
  state.engineeringCreateDialog = createEmptyEngineeringTaskCreateDialogState()
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

function applyCreateSelection(field: 'brand' | 'owner' | 'team' | 'styleCode' | 'sampleSupplier', id: string): void {
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
  if (field === 'sampleSupplier') {
    const option = catalog.sampleSuppliers.find((item) => item.id === id)
    state.create.draft.sampleSupplierId = id
    state.create.draft.sampleSupplierName = option?.name ?? ''
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
  if (field === 'create-year' && fieldNode instanceof HTMLSelectElement) {
    state.create.draft.yearTag = fieldNode.value
    return true
  }
  if (field === 'create-price-range' && fieldNode instanceof HTMLSelectElement) {
    state.create.draft.priceRangeLabel = fieldNode.value
    return true
  }
  if (field === 'create-priority' && fieldNode instanceof HTMLSelectElement) {
    state.create.draft.priorityLevel = fieldNode.value as PcsProjectCreateDraft['priorityLevel']
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
  if (field === 'create-sample-source' && fieldNode instanceof HTMLSelectElement) {
    state.create.draft.sampleSourceType = fieldNode.value as PcsProjectCreateDraft['sampleSourceType']
    return true
  }
  if (field === 'create-sample-supplier' && fieldNode instanceof HTMLSelectElement) {
    applyCreateSelection('sampleSupplier', fieldNode.value)
    return true
  }
  if (field === 'create-sample-link' && fieldNode instanceof HTMLInputElement) {
    state.create.draft.sampleLink = fieldNode.value
    return true
  }
  if (field === 'create-sample-unit-price' && fieldNode instanceof HTMLInputElement) {
    state.create.draft.sampleUnitPrice = fieldNode.value
    return true
  }
  if (field === 'create-reference-images' && fieldNode instanceof HTMLInputElement) {
    const files = Array.from(fieldNode.files || [])
    if (!files.length) return true
    void appendCreateReferenceImages(files).catch((error) => {
      state.create.error = error instanceof Error ? error.message : '上传参考图片失败。'
      window.dispatchEvent(new Event('higood:request-render'))
    })
    fieldNode.value = ''
    return true
  }
  if (field === 'project-init-reference-images' && fieldNode instanceof HTMLInputElement) {
    const files = Array.from(fieldNode.files || [])
    if (!files.length) return true
    const context = getCurrentProjectNodeContext()
    if (!context || context.node.node.workItemTypeCode !== 'PROJECT_INIT') {
      state.notice = '当前节点不是商品项目立项。'
      return true
    }
    void appendProjectInitReferenceImages(context.project, files).catch((error) => {
      state.notice = error instanceof Error ? error.message : '上传参考图片失败。'
      window.dispatchEvent(new Event('higood:request-render'))
    })
    fieldNode.value = ''
    return true
  }
  if (field === 'channel-listing-supplement-images' && fieldNode instanceof HTMLInputElement) {
    const context = getCurrentProjectNodeContext()
    const files = Array.from(fieldNode.files || [])
    fieldNode.value = ''
    if (!context || !isChannelListingNode(context.node)) {
      state.notice = '当前节点不是商品上架。'
      return true
    }
    void appendChannelListingSupplementImages(context.project, context.node, files).catch((error) => {
      state.notice = error instanceof Error ? error.message : '上传上架补图失败。'
      window.dispatchEvent(new Event('higood:request-render'))
    })
    return true
  }
  if (field === 'style-archive-supplement-images' && fieldNode instanceof HTMLInputElement) {
    const context = getCurrentProjectNodeContext()
    const files = Array.from(fieldNode.files || [])
    fieldNode.value = ''
    if (!context || context.node.node.workItemTypeCode !== 'STYLE_ARCHIVE_CREATE') {
      state.notice = '当前节点不是生成款式档案。'
      return true
    }
    void appendStyleArchiveSupplementImages(context.project, context.node, files).catch((error) => {
      state.notice = error instanceof Error ? error.message : '上传档案补充图失败。'
      window.dispatchEvent(new Event('higood:request-render'))
    })
    return true
  }
  if (
    field === 'sample-shoot-flat-images' ||
    field === 'sample-shoot-try-on-images' ||
    field === 'sample-shoot-detail-images'
  ) {
    const files = Array.from((fieldNode as HTMLInputElement).files || [])
    if (!files.length) return true
    const context = getCurrentProjectNodeContext()
    if (!context || !isSampleShootFitNode(context.node) || !canEditSampleShootFitNode(context.node)) {
      state.notice = '当前节点暂不可上传样衣拍摄图片。'
      return true
    }
    const fieldKey: SampleShootImageFieldKey =
      field === 'sample-shoot-flat-images'
        ? 'sampleFlatImageIds'
        : field === 'sample-shoot-try-on-images'
          ? 'sampleTryOnImageIds'
          : 'sampleDetailImageIds'
    void Promise.all(files.map((file) => readFileAsDataUrl(file)))
      .then((imageUrls) => {
        const records = appendSampleShootImages(
          context.project.projectId,
          fieldKey,
          imageUrls.filter(Boolean),
          '当前用户',
          context.node.latestRecord?.recordId || '',
        )
        const draft = getNodeRecordDraft(context.project, context.node)
        const currentIds = resolveSampleShootImageIds(draft, fieldKey)
        setRecordDraftState(context.project, context.node, {
          open: state.recordDialog.open,
          values: {
            [fieldKey]: [...currentIds, ...records.map((item) => item.imageId)],
          },
        })
        state.notice = `${SAMPLE_SHOOT_IMAGE_GROUPS.find((item) => item.fieldKey === fieldKey)?.label || '样衣图片'}已上传。`
        window.dispatchEvent(new Event('higood:request-render'))
      })
      .catch((error) => {
        state.notice = error instanceof Error ? error.message : '上传样衣拍摄图片失败。'
        window.dispatchEvent(new Event('higood:request-render'))
      })
    ;(fieldNode as HTMLInputElement).value = ''
    return true
  }
  if (field === 'sample-shoot-plan' && fieldNode instanceof HTMLTextAreaElement) {
    const context = getCurrentProjectNodeContext()
    if (context && isSampleShootFitNode(context.node)) {
      setRecordDraftState(context.project, context.node, {
        open: state.recordDialog.open,
        values: { shootPlan: fieldNode.value },
      })
    }
    return true
  }
  if (field === 'sample-shoot-feedback' && fieldNode instanceof HTMLTextAreaElement) {
    const context = getCurrentProjectNodeContext()
    if (context && isSampleShootFitNode(context.node)) {
      setRecordDraftState(context.project, context.node, {
        open: state.recordDialog.open,
        values: { fitFeedback: fieldNode.value },
      })
    }
    return true
  }
  if (field === 'sample-shoot-image-note' && fieldNode instanceof HTMLTextAreaElement) {
    const context = getCurrentProjectNodeContext()
    if (context && isSampleShootFitNode(context.node)) {
      setRecordDraftState(context.project, context.node, {
        open: state.recordDialog.open,
        values: { shootImageNote: fieldNode.value },
      })
    }
    return true
  }
  if (field === 'sample-shoot-video-urls' && fieldNode instanceof HTMLTextAreaElement) {
    const context = getCurrentProjectNodeContext()
    if (context && isSampleShootFitNode(context.node)) {
      setRecordDraftState(context.project, context.node, {
        open: state.recordDialog.open,
        values: {
          sampleVideoUrls: fieldNode.value
            .split('\n')
            .map((item) => item.trim())
            .filter(Boolean),
        },
      })
    }
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
  if (
    field.startsWith('channel-listing-') &&
    field !== 'channel-listing-spec-color' &&
    field !== 'channel-listing-spec-size' &&
    field !== 'channel-listing-spec-print' &&
    field !== 'channel-listing-spec-seller-sku' &&
    field !== 'channel-listing-spec-price' &&
    field !== 'channel-listing-spec-currency' &&
    field !== 'channel-listing-spec-stock'
  ) {
    const context = getCurrentProjectNodeContext()
    if (!context || !isChannelListingNode(context.node)) return true
    const draft = getChannelListingDraft(context.project, context.node)
    const value =
      fieldNode instanceof HTMLInputElement || fieldNode instanceof HTMLTextAreaElement || fieldNode instanceof HTMLSelectElement
        ? fieldNode.value
        : ''
    if (field === 'channel-listing-target-channel') {
      const nextStoreId = getDefaultPcsStoreIdByChannel(value) || ''
      const nextCurrency = resolvePcsStoreCurrency(nextStoreId, value) || draft.currencyCode || 'CNY'
      updateChannelListingDraft(context.project, context.node, {
        targetChannelCode: value,
        targetStoreId: nextStoreId,
        currencyCode: nextCurrency,
        specLines: draft.specLines.map((item) => ({ ...item, currencyCode: item.currencyCode || nextCurrency })),
      })
      return true
    }
    if (field === 'channel-listing-target-store') {
      const nextCurrency = resolvePcsStoreCurrency(value, draft.targetChannelCode) || draft.currencyCode || 'CNY'
      updateChannelListingDraft(context.project, context.node, {
        targetStoreId: value,
        currencyCode: nextCurrency,
        specLines: draft.specLines.map((item) => ({ ...item, currencyCode: item.currencyCode || nextCurrency })),
      })
      return true
    }
    if (field === 'channel-listing-title') {
      updateChannelListingDraft(context.project, context.node, { listingTitle: value })
      return true
    }
    if (field === 'channel-listing-description') {
      updateChannelListingDraft(context.project, context.node, { listingDescription: value })
      return true
    }
    if (field === 'channel-listing-default-price') {
      updateChannelListingDraft(context.project, context.node, { defaultPriceAmount: value })
      return true
    }
    if (field === 'channel-listing-currency') {
      updateChannelListingDraft(context.project, context.node, {
        currencyCode: value,
        specLines: draft.specLines.map((item) => ({ ...item, currencyCode: value })),
      })
      return true
    }
    if (field === 'channel-listing-remark') {
      updateChannelListingDraft(context.project, context.node, { listingRemark: value })
      return true
    }
  }
  if (
    field === 'channel-listing-spec-color' ||
    field === 'channel-listing-spec-size' ||
    field === 'channel-listing-spec-print' ||
    field === 'channel-listing-spec-seller-sku' ||
    field === 'channel-listing-spec-price' ||
    field === 'channel-listing-spec-currency' ||
    field === 'channel-listing-spec-stock'
  ) {
    const context = getCurrentProjectNodeContext()
    const specIndex = Number(fieldNode.dataset.specIndex || '-1')
    if (!context || !isChannelListingNode(context.node) || specIndex < 0) return true
    const draft = getChannelListingDraft(context.project, context.node)
    const nextSpecLines = [...draft.specLines]
    const currentLine = nextSpecLines[specIndex]
    if (!currentLine) return true
    const value =
      fieldNode instanceof HTMLInputElement || fieldNode instanceof HTMLTextAreaElement || fieldNode instanceof HTMLSelectElement
        ? fieldNode.value
        : ''
    if (field === 'channel-listing-spec-color') currentLine.colorName = value
    if (field === 'channel-listing-spec-size') currentLine.sizeName = value
    if (field === 'channel-listing-spec-print') currentLine.printName = value
    if (field === 'channel-listing-spec-seller-sku') currentLine.sellerSku = value
    if (field === 'channel-listing-spec-price') currentLine.priceAmount = value
    if (field === 'channel-listing-spec-currency') currentLine.currencyCode = value
    if (field === 'channel-listing-spec-stock') currentLine.stockQty = value
    updateChannelListingDraft(context.project, context.node, { specLines: nextSpecLines })
    return true
  }
  if (field === 'engineering-revision-title' && fieldNode instanceof HTMLInputElement) {
    state.engineeringCreateDialog.revisionDraft.title = fieldNode.value
    return true
  }
  if (field === 'engineering-revision-owner' && fieldNode instanceof HTMLSelectElement) {
    state.engineeringCreateDialog.revisionDraft.ownerName = fieldNode.value
    return true
  }
  if (field === 'engineering-revision-due-at' && fieldNode instanceof HTMLInputElement) {
    state.engineeringCreateDialog.revisionDraft.dueAt = fromDateTimeLocalValue(fieldNode.value)
    return true
  }
  if (field === 'engineering-revision-sample-qty' && fieldNode instanceof HTMLInputElement) {
    state.engineeringCreateDialog.revisionDraft.sampleQty = fieldNode.value
    return true
  }
  if (field === 'engineering-revision-pattern-maker' && fieldNode instanceof HTMLInputElement) {
    state.engineeringCreateDialog.revisionDraft.patternMakerName = fieldNode.value
    return true
  }
  if (field === 'engineering-revision-issue-summary' && fieldNode instanceof HTMLTextAreaElement) {
    state.engineeringCreateDialog.revisionDraft.issueSummary = fieldNode.value
    return true
  }
  if (field === 'engineering-revision-evidence-summary' && fieldNode instanceof HTMLTextAreaElement) {
    state.engineeringCreateDialog.revisionDraft.evidenceSummary = fieldNode.value
    return true
  }
  if (field === 'engineering-revision-style-preference' && fieldNode instanceof HTMLTextAreaElement) {
    state.engineeringCreateDialog.revisionDraft.stylePreference = fieldNode.value
    return true
  }
  if (field === 'engineering-revision-live-retest-required' && fieldNode instanceof HTMLInputElement) {
    state.engineeringCreateDialog.revisionDraft.liveRetestRequired = fieldNode.checked
    return true
  }
  if (field === 'engineering-revision-note' && fieldNode instanceof HTMLTextAreaElement) {
    state.engineeringCreateDialog.revisionDraft.note = fieldNode.value
    return true
  }
  if (field === 'engineering-revision-evidence-images' && fieldNode instanceof HTMLInputElement) {
    const files = Array.from(fieldNode.files || [])
    if (!files.length) return true
    state.engineeringCreateDialog.revisionDraft.evidenceImageUrls = [
      ...state.engineeringCreateDialog.revisionDraft.evidenceImageUrls,
      ...files.map((file) => URL.createObjectURL(file)),
    ]
    fieldNode.value = ''
    return true
  }
  if (field === 'engineering-plate-title' && fieldNode instanceof HTMLInputElement) {
    state.engineeringCreateDialog.plateDraft.title = fieldNode.value
    return true
  }
  if (field === 'engineering-plate-owner' && fieldNode instanceof HTMLSelectElement) {
    state.engineeringCreateDialog.plateDraft.ownerName = fieldNode.value
    return true
  }
  if (field === 'engineering-plate-due-at' && fieldNode instanceof HTMLInputElement) {
    state.engineeringCreateDialog.plateDraft.dueAt = fromDateTimeLocalValue(fieldNode.value)
    return true
  }
  if (field === 'engineering-plate-pattern-type' && fieldNode instanceof HTMLInputElement) {
    state.engineeringCreateDialog.plateDraft.patternType = fieldNode.value
    return true
  }
  if (field === 'engineering-plate-size-range' && fieldNode instanceof HTMLInputElement) {
    state.engineeringCreateDialog.plateDraft.sizeRange = fieldNode.value
    return true
  }
  if (field === 'engineering-plate-note' && fieldNode instanceof HTMLTextAreaElement) {
    state.engineeringCreateDialog.plateDraft.note = fieldNode.value
    return true
  }
  if (field === 'engineering-pattern-title' && fieldNode instanceof HTMLInputElement) {
    state.engineeringCreateDialog.patternDraft.title = fieldNode.value
    return true
  }
  if (field === 'engineering-pattern-owner' && fieldNode instanceof HTMLSelectElement) {
    state.engineeringCreateDialog.patternDraft.ownerName = fieldNode.value
    return true
  }
  if (field === 'engineering-pattern-due-at' && fieldNode instanceof HTMLInputElement) {
    state.engineeringCreateDialog.patternDraft.dueAt = fromDateTimeLocalValue(fieldNode.value)
    return true
  }
  if (field === 'engineering-pattern-artwork-type' && fieldNode instanceof HTMLSelectElement) {
    state.engineeringCreateDialog.patternDraft.artworkType = fieldNode.value
    return true
  }
  if (field === 'engineering-pattern-mode' && fieldNode instanceof HTMLSelectElement) {
    state.engineeringCreateDialog.patternDraft.patternMode = fieldNode.value
    return true
  }
  if (field === 'engineering-pattern-artwork-name' && fieldNode instanceof HTMLInputElement) {
    state.engineeringCreateDialog.patternDraft.artworkName = fieldNode.value
    return true
  }
  if (field === 'engineering-pattern-note' && fieldNode instanceof HTMLTextAreaElement) {
    state.engineeringCreateDialog.patternDraft.note = fieldNode.value
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
  if (!canOpenDecisionAction(context.node)) {
    state.notice = '当前节点暂不可执行决策。'
    return
  }
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
  if (!canOpenDecisionAction(context.node)) {
    state.notice = '当前节点暂不可执行决策。'
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
    const tagId = actionNode.dataset.value
    if (!tagId) return true
    const selection = toggleOptionSelection(getProjectCreateCatalog().styles, state.create.draft.styleTagIds, tagId)
    state.create.draft.styleTagIds = selection.ids
    state.create.draft.styleTagNames = selection.names
    state.create.draft.styleTags = [...selection.names]
    return true
  }
  if (action === 'toggle-season-tag') {
    const seasonTag = actionNode.dataset.value
    if (!seasonTag) return true
    state.create.draft.seasonTags = toggleStringSelection(state.create.draft.seasonTags, seasonTag)
    return true
  }
  if (action === 'toggle-crowd-positioning') {
    const targetId = actionNode.dataset.value
    if (!targetId) return true
    const selection = toggleOptionSelection(
      getProjectCreateCatalog().crowdPositioning,
      state.create.draft.crowdPositioningIds,
      targetId,
    )
    state.create.draft.crowdPositioningIds = selection.ids
    state.create.draft.crowdPositioningNames = selection.names
    return true
  }
  if (action === 'toggle-age') {
    const targetId = actionNode.dataset.value
    if (!targetId) return true
    const selection = toggleOptionSelection(getProjectCreateCatalog().ages, state.create.draft.ageIds, targetId)
    state.create.draft.ageIds = selection.ids
    state.create.draft.ageNames = selection.names
    return true
  }
  if (action === 'toggle-crowd') {
    const targetId = actionNode.dataset.value
    if (!targetId) return true
    const selection = toggleOptionSelection(getProjectCreateCatalog().crowds, state.create.draft.crowdIds, targetId)
    state.create.draft.crowdIds = selection.ids
    state.create.draft.crowdNames = selection.names
    return true
  }
  if (action === 'toggle-product-positioning') {
    const targetId = actionNode.dataset.value
    if (!targetId) return true
    const selection = toggleOptionSelection(
      getProjectCreateCatalog().productPositioning,
      state.create.draft.productPositioningIds,
      targetId,
    )
    state.create.draft.productPositioningIds = selection.ids
    state.create.draft.productPositioningNames = selection.names
    return true
  }
  if (action === 'toggle-collaborator') {
    const targetId = actionNode.dataset.value
    if (!targetId) return true
    const selection = toggleOptionSelection(
      getProjectCreateCatalog().collaborators,
      state.create.draft.collaboratorIds,
      targetId,
    )
    state.create.draft.collaboratorIds = selection.ids
    state.create.draft.collaboratorNames = selection.names
    return true
  }
  if (action === 'toggle-channel') {
    const channelCode = actionNode.dataset.value
    if (!channelCode) return true
    state.create.draft.targetChannelCodes = toggleStringSelection(state.create.draft.targetChannelCodes, channelCode)
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
    state.create.referenceImages.forEach((item) => revokeRuntimeFileUrl(item.imageUrl))
    state.create.referenceImages = []
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
    void (async () => {
      try {
        const draft = {
          ...state.create.draft,
          projectAlbumUrls: [],
        }
        const created = createProject(draft, '当前用户')
        if (state.create.referenceImages.length > 0) {
          const assets = await createProjectImageAssetRecordsFromFiles(
            created.project,
            state.create.referenceImages.map((item) => item.file),
            (file, index) => ({
              imageName: state.create.referenceImages[index]?.imageName || file.name || `参考图片 ${index + 1}`,
              imageType: '项目参考图',
              sourceNodeCode: 'PROJECT_INIT',
              sourceRecordId: '',
              sourceType: '商品项目立项',
              usageScopes: ['立项参考', '项目资料归档'],
              imageStatus: '待确认',
              mainFlag: false,
              sortNo: index + 1,
            }),
            '当前用户',
          )
          upsertProjectImageAssets(assets)
          const compatRefs = listProjectReferenceImages(created.project.projectId).map((item) => buildProjectImageCompatRef(item))
          updateProjectAlbumUrls(created.project.projectId, compatRefs, '当前用户')
          state.create.referenceImages.forEach((item) => revokeRuntimeFileUrl(item.imageUrl))
        }
        state.notice = `项目「${created.project.projectName}」已创建。`
        state.create.routeKey = ''
        state.create.referenceImages = []
        closeAllDialogs()
        appStore.navigate(`/pcs/projects/${created.project.projectId}`)
      } catch (error) {
        state.create.error = error instanceof Error ? error.message : '创建项目失败，请稍后重试。'
      }
      window.dispatchEvent(new Event('higood:request-render'))
    })()
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
  if (action === 'add-channel-listing-spec-line') {
    const context = getCurrentProjectNodeContext()
    if (!context || !isChannelListingNode(context.node)) {
      state.notice = '当前节点不是商品上架。'
      return true
    }
    const draft = getChannelListingDraft(context.project, context.node)
    updateChannelListingDraft(context.project, context.node, {
      specLines: [...draft.specLines, createEmptyChannelListingSpecDraft(draft.currencyCode || 'CNY')],
    })
    return true
  }
  if (action === 'remove-channel-listing-spec-line') {
    const context = getCurrentProjectNodeContext()
    const specIndex = Number(actionNode.dataset.specIndex || '-1')
    if (!context || !isChannelListingNode(context.node) || specIndex < 0) {
      state.notice = '未找到待删除的规格明细。'
      return true
    }
    const draft = getChannelListingDraft(context.project, context.node)
    if (draft.specLines.length <= 1) {
      state.notice = '至少保留一条规格明细。'
      return true
    }
    updateChannelListingDraft(context.project, context.node, {
      specLines: draft.specLines.filter((_, index) => index !== specIndex),
    })
    return true
  }
  if (action === 'add-channel-listing-image' || action === 'confirm-add-channel-listing-image') {
    const context = getCurrentProjectNodeContext()
    const imageId = actionNode.dataset.imageId || ''
    if (!context || !isChannelListingNode(context.node) || !imageId) {
      state.notice = '未找到待加入的上架图片。'
      return true
    }
    if (action === 'confirm-add-channel-listing-image') {
      const updated = markProjectImageAssetUsableForListing(imageId, '当前用户')
      if (!updated) {
        state.notice = '未找到待确认的图片资产。'
        return true
      }
    }
    const draft = getChannelListingDraft(context.project, context.node)
    if (draft.listingImageIds.includes(imageId)) {
      state.notice = '该图片已在当前上架批次中。'
      return true
    }
    updateChannelListingDraft(context.project, context.node, {
      listingImageIds: [...draft.listingImageIds, imageId],
      listingMainImageId: draft.listingMainImageId || imageId,
    })
    state.notice = action === 'confirm-add-channel-listing-image' ? '图片已确认可用于上架并加入当前批次。' : '图片已加入当前上架批次。'
    return true
  }
  if (action === 'add-style-archive-image' || action === 'confirm-add-style-archive-image') {
    const context = getCurrentProjectNodeContext()
    const imageId = actionNode.dataset.imageId || ''
    const setMain = actionNode.dataset.setMain === 'true'
    if (!context || context.node.node.workItemTypeCode !== 'STYLE_ARCHIVE_CREATE' || !imageId) {
      state.notice = '未找到待加入的档案图片。'
      return true
    }
    if (action === 'confirm-add-style-archive-image') {
      const updated = markProjectImageAssetUsableForStyleArchive(imageId, '当前用户')
      if (!updated) {
        state.notice = '未找到待确认的图片资产。'
        return true
      }
    }
    const draft = getStyleArchiveImageDraft(context.project, context.node)
    if (draft.styleGalleryImageIds.includes(imageId)) {
      state.notice = '该图片已在当前档案图册中。'
      return true
    }
    updateStyleArchiveImageDraft(context.project, context.node, {
      styleGalleryImageIds: [...draft.styleGalleryImageIds, imageId],
      styleMainImageId: setMain ? imageId : draft.styleMainImageId || imageId,
    })
    state.notice =
      action === 'confirm-add-style-archive-image'
        ? '图片已确认可用于款式档案并加入当前图册。'
        : '图片已加入当前档案图册。'
    return true
  }
  if (action === 'remove-style-archive-image') {
    const context = getCurrentProjectNodeContext()
    const imageId = actionNode.dataset.imageId || ''
    if (!context || context.node.node.workItemTypeCode !== 'STYLE_ARCHIVE_CREATE' || !imageId) {
      state.notice = '未找到待移除的档案图片。'
      return true
    }
    const draft = getStyleArchiveImageDraft(context.project, context.node)
    const nextImageIds = draft.styleGalleryImageIds.filter((item) => item !== imageId)
    updateStyleArchiveImageDraft(context.project, context.node, {
      styleGalleryImageIds: nextImageIds,
      styleMainImageId:
        draft.styleMainImageId === imageId
          ? nextImageIds[0] || ''
          : draft.styleMainImageId,
    })
    return true
  }
  if (action === 'set-style-archive-main-image') {
    const context = getCurrentProjectNodeContext()
    const imageId = actionNode.dataset.imageId || ''
    if (!context || context.node.node.workItemTypeCode !== 'STYLE_ARCHIVE_CREATE' || !imageId) {
      state.notice = '未找到待设置的档案主图。'
      return true
    }
    const draft = getStyleArchiveImageDraft(context.project, context.node)
    if (!draft.styleGalleryImageIds.includes(imageId)) {
      state.notice = '当前图片不在档案图册中。'
      return true
    }
    updateStyleArchiveImageDraft(context.project, context.node, { styleMainImageId: imageId })
    return true
  }
  if (action === 'move-style-archive-image-up' || action === 'move-style-archive-image-down') {
    const context = getCurrentProjectNodeContext()
    const imageId = actionNode.dataset.imageId || ''
    if (!context || context.node.node.workItemTypeCode !== 'STYLE_ARCHIVE_CREATE' || !imageId) {
      state.notice = '未找到待调整顺序的档案图片。'
      return true
    }
    const draft = getStyleArchiveImageDraft(context.project, context.node)
    const currentIndex = draft.styleGalleryImageIds.findIndex((item) => item === imageId)
    if (currentIndex < 0) {
      state.notice = '当前图片不在档案图册中。'
      return true
    }
    const nextIndex = action === 'move-style-archive-image-up' ? currentIndex - 1 : currentIndex + 1
    if (nextIndex < 0 || nextIndex >= draft.styleGalleryImageIds.length) {
      return true
    }
    const nextImageIds = [...draft.styleGalleryImageIds]
    ;[nextImageIds[currentIndex], nextImageIds[nextIndex]] = [nextImageIds[nextIndex], nextImageIds[currentIndex]]
    updateStyleArchiveImageDraft(context.project, context.node, { styleGalleryImageIds: nextImageIds })
    return true
  }
  if (action === 'remove-channel-listing-image') {
    const context = getCurrentProjectNodeContext()
    const imageId = actionNode.dataset.imageId || ''
    if (!context || !isChannelListingNode(context.node) || !imageId) {
      state.notice = '未找到待移除的上架图片。'
      return true
    }
    const draft = getChannelListingDraft(context.project, context.node)
    const nextImageIds = draft.listingImageIds.filter((item) => item !== imageId)
    updateChannelListingDraft(context.project, context.node, {
      listingImageIds: nextImageIds,
      listingMainImageId:
        draft.listingMainImageId === imageId
          ? nextImageIds[0] || ''
          : draft.listingMainImageId,
    })
    return true
  }
  if (action === 'set-channel-listing-main-image') {
    const context = getCurrentProjectNodeContext()
    const imageId = actionNode.dataset.imageId || ''
    if (!context || !isChannelListingNode(context.node) || !imageId) {
      state.notice = '未找到待设置的上架主图。'
      return true
    }
    const draft = getChannelListingDraft(context.project, context.node)
    if (!draft.listingImageIds.includes(imageId)) {
      state.notice = '当前图片不在上架图片集合中。'
      return true
    }
    updateChannelListingDraft(context.project, context.node, { listingMainImageId: imageId })
    return true
  }
  if (action === 'move-channel-listing-image-up' || action === 'move-channel-listing-image-down') {
    const context = getCurrentProjectNodeContext()
    const imageId = actionNode.dataset.imageId || ''
    if (!context || !isChannelListingNode(context.node) || !imageId) {
      state.notice = '未找到待调整顺序的图片。'
      return true
    }
    const draft = getChannelListingDraft(context.project, context.node)
    const currentIndex = draft.listingImageIds.findIndex((item) => item === imageId)
    if (currentIndex < 0) {
      state.notice = '当前图片不在上架图片集合中。'
      return true
    }
    const nextIndex = action === 'move-channel-listing-image-up' ? currentIndex - 1 : currentIndex + 1
    if (nextIndex < 0 || nextIndex >= draft.listingImageIds.length) {
      return true
    }
    const nextImageIds = [...draft.listingImageIds]
    ;[nextImageIds[currentIndex], nextImageIds[nextIndex]] = [nextImageIds[nextIndex], nextImageIds[currentIndex]]
    updateChannelListingDraft(context.project, context.node, { listingImageIds: nextImageIds })
    return true
  }
  if (action === 'create-channel-listing-instance') {
    const context = getCurrentProjectNodeContext()
    if (!context || !isChannelListingNode(context.node)) {
      state.notice = '当前节点不是商品上架。'
      return true
    }
    const draft = getChannelListingDraft(context.project, context.node)
    const result = createProjectChannelProductFromListingNodeSafe(
      context.project.projectId,
      {
        targetChannelCode: draft.targetChannelCode,
        targetStoreId: draft.targetStoreId,
        listingTitle: draft.listingTitle,
        listingDescription: draft.listingDescription,
        defaultPriceAmount: Number(draft.defaultPriceAmount || '0'),
        currencyCode: draft.currencyCode,
        listingMainImageId: draft.listingMainImageId,
        listingImageIds: draft.listingImageIds,
        listingRemark: draft.listingRemark,
        specLines: draft.specLines.map((line) => ({
          colorName: line.colorName.trim(),
          sizeName: line.sizeName.trim(),
          printName: line.printName.trim(),
          sellerSku: line.sellerSku.trim(),
          priceAmount: Number(line.priceAmount || '0'),
          currencyCode: (line.currencyCode || draft.currencyCode).trim(),
          stockQty: Number(line.stockQty || '0'),
        })),
      },
      '当前用户',
    )
    state.notice = result.message
    if (result.ok) {
      delete state.channelListingDrafts[buildChannelListingDraftKey(context.project.projectId, context.node.node.projectNodeId)]
    }
    return true
  }
  if (action === 'launch-channel-listing-instance') {
    const channelProductId = actionNode.dataset.channelProductId
    if (!channelProductId) {
      state.notice = '未找到待发起上架的实例。'
      return true
    }
    const result = launchProjectChannelProductListingSafe(channelProductId, '当前用户')
    state.notice = result.message
    return true
  }
  if (action === 'complete-channel-listing-instance') {
    const channelProductId = actionNode.dataset.channelProductId
    if (!channelProductId) {
      state.notice = '未找到待确认的上架批次。'
      return true
    }
    const result = markProjectChannelProductListingCompletedSafe(channelProductId, '当前用户')
    state.notice = result.message
    return true
  }
  if (action === 'mark-node-complete') {
    const context = getCurrentProjectNodeContext()
    if (!context) return true
    if (!canRenderManualCompleteAction(context.node)) {
      state.notice = getManualCompleteBlockedNotice(context.node)
      return true
    }
    const blocker = getProjectNodeSequenceBlocker(context.project.projectId, context.node.node.projectNodeId)
    if (blocker) {
      state.notice = `请先填写并完成前序工作项：${blocker.workItemTypeName}`
      return true
    }
    if (!canCompleteProjectNode(context.project, context.node)) {
      state.notice = '请填写该工作项要求的信息'
      return true
    }
    const result = markProjectNodeCompletedAndUnlockNext(context.project.projectId, context.node.node.projectNodeId, {
      operatorName: '当前用户',
      resultType: '手动完成',
      resultText: '节点已手动标记完成。',
    })
    state.notice = result.message
    return true
  }
  if (action === 'generate-style-archive') {
    const projectId = actionNode.dataset.projectId || state.detail.projectId || state.workItem.projectId || ''
    if (!projectId) {
      state.notice = '未找到对应商品项目。'
      return true
    }
    const context = getCurrentProjectNodeContext()
    const draft =
      context && context.project.projectId === projectId && context.node.node.workItemTypeCode === 'STYLE_ARCHIVE_CREATE'
        ? getStyleArchiveImageDraft(context.project, context.node)
        : { styleMainImageId: '', styleGalleryImageIds: [] }
    const result = generateStyleArchiveFromProjectNode(projectId, '当前用户', {
      styleMainImageId: draft.styleMainImageId,
      styleGalleryImageIds: draft.styleGalleryImageIds,
    })
    state.notice = result.message
    if (result.ok && result.style) {
      if (context && context.project.projectId === projectId && context.node.node.workItemTypeCode === 'STYLE_ARCHIVE_CREATE') {
        delete state.styleArchiveImageDrafts[buildStyleArchiveImageDraftKey(context.project.projectId, context.node.node.projectNodeId)]
      }
      appStore.navigate(`/pcs/products/styles/${result.style.styleId}`)
    }
    return true
  }
  if (action === 'create-engineering-task-from-node') {
    const projectId = actionNode.dataset.projectId || state.detail.projectId || state.workItem.projectId || ''
    const projectNodeId = actionNode.dataset.projectNodeId || state.detail.selectedNodeId || state.workItem.projectNodeId || ''
    if (!projectId || !projectNodeId) {
      state.notice = '未找到对应项目节点。'
      return true
    }
    const project = getProjectById(projectId)
    const node = project ? listProjectNodes(projectId).find((item) => item.projectNodeId === projectNodeId) || null : null
    if (!project || !node) {
      state.notice = '当前项目节点不存在。'
      return true
    }
    openEngineeringTaskCreateDialog(project, node)
    return true
  }
  if (action === 'submit-engineering-task-create') {
    const result = submitEngineeringTaskCreateDialog()
    if (!result.ok) {
      state.notice = result.message
      return true
    }
    closeAllDialogs()
    state.notice = result.message
    if (result.route) {
      appStore.navigate(result.route)
    }
    return true
  }
  if (action === 'toggle-engineering-revision-scope') {
    const scopeCode = actionNode.dataset.scopeCode || ''
    if (!scopeCode) return true
    state.engineeringCreateDialog.revisionDraft.scopeCodes = toggleStringSelection(
      state.engineeringCreateDialog.revisionDraft.scopeCodes,
      scopeCode,
    )
    return true
  }
  if (action === 'open-image-preview') {
    state.imagePreview = {
      open: true,
      url: actionNode.dataset.url || '',
      title: actionNode.dataset.title || '图片预览',
    }
    return true
  }
  if (action === 'close-image-preview') {
    state.imagePreview = { open: false, url: '', title: '' }
    return true
  }
  if (action === 'remove-engineering-evidence-image') {
    const index = Number(actionNode.dataset.imageIndex || '-1')
    if (index >= 0) {
      state.engineeringCreateDialog.revisionDraft.evidenceImageUrls =
        state.engineeringCreateDialog.revisionDraft.evidenceImageUrls.filter((_, itemIndex) => itemIndex !== index)
    }
    return true
  }
  if (action === 'remove-create-reference-image') {
    const index = Number(actionNode.dataset.imageIndex || '-1')
    if (index >= 0) {
      const removed = state.create.referenceImages[index]
      if (removed) {
        revokeRuntimeFileUrl(removed.imageUrl)
      }
      state.create.referenceImages = state.create.referenceImages.filter((_, itemIndex) => itemIndex !== index)
    }
    return true
  }
  if (action === 'remove-project-reference-image') {
    const imageId = actionNode.dataset.imageId || ''
    const context = getCurrentProjectNodeContext()
    if (!imageId || !context || context.node.node.workItemTypeCode !== 'PROJECT_INIT') {
      state.notice = '未找到待删除的参考图片。'
      return true
    }
    removeProjectImageAsset(imageId)
    const nextRefs = listProjectReferenceImages(context.project.projectId).map((item) => buildProjectImageCompatRef(item))
    updateProjectAlbumUrls(context.project.projectId, nextRefs, '当前用户')
    state.notice = '参考图片已删除。'
    return true
  }
  if (action === 'set-sample-shoot-image-usage') {
    const imageId = actionNode.dataset.imageId || ''
    const usage = actionNode.dataset.usage || ''
    const context = getCurrentProjectNodeContext()
    if (!imageId || !context || !isSampleShootFitNode(context.node) || !canEditSampleShootFitNode(context.node)) {
      state.notice = '当前节点暂不可调整样衣图片用途。'
      return true
    }
    try {
      updateSampleShootImageUsage(
        context.project.projectId,
        imageId,
        usage as 'listing' | 'styleArchive' | 'evaluateOnly' | 'retake' | 'discarded',
        '当前用户',
      )
      const draft = getNodeRecordDraft(context.project, context.node)
      const nextListingIds = resolveSampleShootImageIds(draft, 'listingCandidateImageIds').filter((item) => item !== imageId)
      const nextArchiveIds = resolveSampleShootImageIds(draft, 'styleArchiveCandidateImageIds').filter((item) => item !== imageId)
      if (usage === 'listing') nextListingIds.push(imageId)
      if (usage === 'styleArchive') nextArchiveIds.push(imageId)
      setRecordDraftState(context.project, context.node, {
        open: state.recordDialog.open,
        values: {
          listingCandidateImageIds: [...new Set(nextListingIds)],
          styleArchiveCandidateImageIds: [...new Set(nextArchiveIds)],
        },
      })
      state.notice = '样衣图片用途已更新。'
    } catch (error) {
      state.notice = error instanceof Error ? error.message : '更新样衣图片用途失败。'
    }
    return true
  }
  if (action === 'remove-sample-shoot-image') {
    const imageId = actionNode.dataset.imageId || ''
    const context = getCurrentProjectNodeContext()
    if (!imageId || !context || !isSampleShootFitNode(context.node) || !canEditSampleShootFitNode(context.node)) {
      state.notice = '当前节点暂不可删除样衣图片。'
      return true
    }
    try {
      removeSampleShootImage(context.project.projectId, imageId)
      const draft = getNodeRecordDraft(context.project, context.node)
      const nextValues: Record<string, unknown> = {
        sampleFlatImageIds: resolveSampleShootImageIds(draft, 'sampleFlatImageIds').filter((item) => item !== imageId),
        sampleTryOnImageIds: resolveSampleShootImageIds(draft, 'sampleTryOnImageIds').filter((item) => item !== imageId),
        sampleDetailImageIds: resolveSampleShootImageIds(draft, 'sampleDetailImageIds').filter((item) => item !== imageId),
        listingCandidateImageIds: resolveSampleShootImageIds(draft, 'listingCandidateImageIds').filter((item) => item !== imageId),
        styleArchiveCandidateImageIds: resolveSampleShootImageIds(draft, 'styleArchiveCandidateImageIds').filter((item) => item !== imageId),
      }
      setRecordDraftState(context.project, context.node, {
        open: state.recordDialog.open,
        values: nextValues,
      })
      state.notice = '样衣图片已删除。'
    } catch (error) {
      state.notice = error instanceof Error ? error.message : '删除样衣图片失败。'
    }
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
    const context = getCurrentProjectNodeContext()
    if (context && isDecisionNode(context.node)) {
      state.notice = '决策类节点请通过“做出决策”完成流转。'
      return true
    }
    saveFormalRecord()
    return true
  }
  if (action === 'save-formal-fields-and-complete') {
    const context = getCurrentProjectNodeContext()
    if (context && isDecisionNode(context.node)) {
      state.notice = '决策类节点请通过“做出决策”完成流转。'
      return true
    }
    saveFormalRecord({ completeAfterSave: true })
    return true
  }
  if (action === 'open-record-dialog') {
    const context = getCurrentProjectNodeContext()
    if (!context) return true
    if (isDecisionNode(context.node)) {
      state.notice = '决策类节点请通过“做出决策”完成流转。'
      return true
    }
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
