import {
  getProjectTemplateById,
  getProjectTemplateVersion,
  hasTemplatePendingNodes,
  listProjectTemplates,
  type ProjectTemplate,
} from './pcs-templates.ts'
import { buildTemplateBusinessSummary } from './pcs-template-domain-view-model.ts'
import { createBootstrapProjectSnapshot } from './pcs-project-bootstrap.ts'
import {
  buildProjectNodeRecordsFromTemplate,
  buildProjectPhaseRecordsFromTemplate,
} from './pcs-project-node-factory.ts'
import {
  buildProjectWorkspaceCategoryOptions,
  findProjectWorkspaceOptionById,
  listProjectWorkspaceAges,
  listProjectWorkspaceBrands,
  listProjectWorkspaceCrowdPositioning,
  listProjectWorkspaceCrowds,
  listProjectWorkspaceProductPositioning,
  listProjectWorkspaceStyleCodes,
  listProjectWorkspaceStyles,
} from './pcs-project-config-workspace-adapter.ts'
import type {
  LegacyProjectNodeStatus,
  PcsProjectCreateDraft,
  PcsProjectNodeRecord,
  PcsProjectPhaseRecord,
  PcsProjectRecord,
  PcsProjectStoreSnapshot,
  ProjectIdentityRef,
  ProjectNodeIdentityRef,
  ProjectCategoryOption,
  ProjectCreateCatalog,
  ProjectCreateResult,
  ProjectNodeStatus,
  ProjectPriorityLevel,
  ProjectSourceType,
  SampleSourceType,
} from './pcs-project-types.ts'
import type { TemplateStyleType } from './pcs-templates.ts'

const PROJECT_STORAGE_KEY = 'higood-pcs-project-store-v1'
const PROJECT_STORE_VERSION = 2

const PROJECT_TYPES = ['商品开发', '快反上新', '改版开发', '设计研发'] as const
const PROJECT_SOURCE_TYPES = ['企划提案', '渠道反馈', '测款沉淀', '历史复用', '外部灵感'] as const
const SAMPLE_SOURCE_TYPES = ['外采', '自打样', '委托打样'] as const
const PRIORITY_LEVELS = ['高', '中', '低'] as const
const STYLE_TYPES: TemplateStyleType[] = ['基础款', '快时尚款', '改版款', '设计款']
const SEASON_TAGS = ['春季', '夏季', '秋季', '冬季', '四季']
const PRICE_RANGES = ['百元基础带', '两百元主销带', '三百元升级带', '四百元形象带']

const CHANNEL_OPTIONS = [
  { code: 'tiktok-shop', name: '抖音商城' },
  { code: 'shopee', name: '虾皮' },
  { code: 'lazada', name: '来赞达' },
  { code: 'wechat-mini-program', name: '微信小程序' },
]

const SAMPLE_SUPPLIER_OPTIONS = [
  { id: 'supplier-shenzhen-a', name: '深圳版房甲' },
  { id: 'supplier-jakarta-b', name: '雅加达样衣乙' },
  { id: 'supplier-platform-c', name: '外采平台丙' },
]

const OWNER_OPTIONS = [
  { id: 'user-zhangli', name: '张丽' },
  { id: 'user-wangming', name: '王明' },
  { id: 'user-lina', name: '李娜' },
  { id: 'user-zhaoyun', name: '赵云' },
  { id: 'user-zhoufang', name: '周芳' },
  { id: 'user-chengang', name: '陈刚' },
]

const TEAM_OPTIONS = [
  { id: 'team-plan', name: '商品企划组' },
  { id: 'team-fast', name: '快反开发组' },
  { id: 'team-design', name: '设计研发组' },
  { id: 'team-engineering', name: '工程打样组' },
]

const COLLABORATOR_OPTIONS = [
  ...OWNER_OPTIONS,
  { id: 'user-xiaoya', name: '小雅' },
  { id: 'user-xiaomei', name: '小美' },
  { id: 'user-zhouqiang', name: '周强' },
  { id: 'user-xiaoliu', name: '小刘' },
]

let memorySnapshot: PcsProjectStoreSnapshot | null = null

function nowText(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

function formatDateKey(dateText: string): string {
  return dateText.slice(0, 10).replace(/-/g, '')
}

function canUseStorage(): boolean {
  return typeof localStorage !== 'undefined'
}

function cloneProject(project: PcsProjectRecord): PcsProjectRecord {
  return {
    ...project,
    seasonTags: [...(project.seasonTags || [])],
    styleTags: [...(project.styleTags || [])],
    styleTagIds: [...(project.styleTagIds || [])],
    styleTagNames: [...(project.styleTagNames || [])],
    crowdPositioningIds: [...(project.crowdPositioningIds || [])],
    crowdPositioningNames: [...(project.crowdPositioningNames || [])],
    ageIds: [...(project.ageIds || [])],
    ageNames: [...(project.ageNames || [])],
    crowdIds: [...(project.crowdIds || [])],
    crowdNames: [...(project.crowdNames || [])],
    productPositioningIds: [...(project.productPositioningIds || [])],
    productPositioningNames: [...(project.productPositioningNames || [])],
    targetAudienceTags: [...(project.targetAudienceTags || [])],
    targetChannelCodes: [...(project.targetChannelCodes || [])],
    projectAlbumUrls: [...(project.projectAlbumUrls || [])],
    collaboratorIds: [...(project.collaboratorIds || [])],
    collaboratorNames: [...(project.collaboratorNames || [])],
    linkedStyleId: project.linkedStyleId || '',
    linkedStyleCode: project.linkedStyleCode || '',
    linkedStyleName: project.linkedStyleName || '',
    linkedStyleGeneratedAt: project.linkedStyleGeneratedAt || '',
    linkedTechPackVersionId: project.linkedTechPackVersionId || '',
    linkedTechPackVersionCode: project.linkedTechPackVersionCode || '',
    linkedTechPackVersionLabel: project.linkedTechPackVersionLabel || '',
    linkedTechPackVersionStatus: project.linkedTechPackVersionStatus || '',
    linkedTechPackVersionPublishedAt: project.linkedTechPackVersionPublishedAt || '',
    projectArchiveId: project.projectArchiveId || '',
    projectArchiveNo: project.projectArchiveNo || '',
    projectArchiveStatus: project.projectArchiveStatus || '',
    projectArchiveDocumentCount: Number.isFinite(project.projectArchiveDocumentCount) ? project.projectArchiveDocumentCount : 0,
    projectArchiveFileCount: Number.isFinite(project.projectArchiveFileCount) ? project.projectArchiveFileCount : 0,
    projectArchiveMissingItemCount: Number.isFinite(project.projectArchiveMissingItemCount)
      ? project.projectArchiveMissingItemCount
      : 0,
    projectArchiveUpdatedAt: project.projectArchiveUpdatedAt || '',
    projectArchiveFinalizedAt: project.projectArchiveFinalizedAt || '',
  }
}

function clonePhase(phase: PcsProjectPhaseRecord): PcsProjectPhaseRecord {
  return { ...phase }
}

function cloneNode(node: PcsProjectNodeRecord): PcsProjectNodeRecord {
  return { ...node }
}

function cloneSnapshot(snapshot: PcsProjectStoreSnapshot): PcsProjectStoreSnapshot {
  return {
    version: snapshot.version,
    projects: snapshot.projects.map(cloneProject),
    phases: snapshot.phases.map(clonePhase),
    nodes: snapshot.nodes.map(cloneNode),
  }
}

function seedSnapshot(): PcsProjectStoreSnapshot {
  return createBootstrapProjectSnapshot(PROJECT_STORE_VERSION)
}

function normalizeNodeStatus(status: LegacyProjectNodeStatus | string | null | undefined): ProjectNodeStatus {
  if (status === '待决策') return '待确认'
  if (status === '未解锁') return '未开始'
  if (status === '已取消') return '已取消'
  if (status === '已完成') return '已完成'
  if (status === '待确认') return '待确认'
  if (status === '进行中') return '进行中'
  return '未开始'
}

function normalizeProject(project: PcsProjectRecord): PcsProjectRecord {
  return {
    ...cloneProject(project),
    projectStatus:
      project.projectStatus === '已终止' || project.projectStatus === '已归档' || project.projectStatus === '已立项'
        ? project.projectStatus
        : '进行中',
    linkedStyleId: project.linkedStyleId || '',
    linkedStyleCode: project.linkedStyleCode || '',
    linkedStyleName: project.linkedStyleName || '',
    linkedStyleGeneratedAt: project.linkedStyleGeneratedAt || '',
    styleCodeId: project.styleCodeId || '',
    styleCodeName: project.styleCodeName || '',
    styleTagIds: [...(project.styleTagIds || [])],
    styleTagNames: [...(project.styleTagNames || project.styleTags || [])],
    crowdPositioningIds: [...(project.crowdPositioningIds || [])],
    crowdPositioningNames: [...(project.crowdPositioningNames || [])],
    ageIds: [...(project.ageIds || [])],
    ageNames: [...(project.ageNames || [])],
    crowdIds: [...(project.crowdIds || [])],
    crowdNames: [...(project.crowdNames || [])],
    productPositioningIds: [...(project.productPositioningIds || [])],
    productPositioningNames: [...(project.productPositioningNames || [])],
    styleTags: [...(project.styleTags || project.styleTagNames || [])],
    targetAudienceTags: [...(project.targetAudienceTags || [])],
    linkedTechPackVersionId: project.linkedTechPackVersionId || '',
    linkedTechPackVersionCode: project.linkedTechPackVersionCode || '',
    linkedTechPackVersionLabel: project.linkedTechPackVersionLabel || '',
    linkedTechPackVersionStatus: project.linkedTechPackVersionStatus || '',
    linkedTechPackVersionPublishedAt: project.linkedTechPackVersionPublishedAt || '',
    projectArchiveId: project.projectArchiveId || '',
    projectArchiveNo: project.projectArchiveNo || '',
    projectArchiveStatus: project.projectArchiveStatus || '',
    projectArchiveDocumentCount: Number.isFinite(project.projectArchiveDocumentCount) ? project.projectArchiveDocumentCount : 0,
    projectArchiveFileCount: Number.isFinite(project.projectArchiveFileCount) ? project.projectArchiveFileCount : 0,
    projectArchiveMissingItemCount: Number.isFinite(project.projectArchiveMissingItemCount)
      ? project.projectArchiveMissingItemCount
      : 0,
    projectArchiveUpdatedAt: project.projectArchiveUpdatedAt || '',
    projectArchiveFinalizedAt: project.projectArchiveFinalizedAt || '',
  }
}

function normalizePhase(phase: PcsProjectPhaseRecord): PcsProjectPhaseRecord {
  return {
    ...clonePhase(phase),
    phaseStatus:
      phase.phaseStatus === '已完成' || phase.phaseStatus === '已终止' || phase.phaseStatus === '进行中'
        ? phase.phaseStatus
        : '未开始',
  }
}

function normalizeNode(node: PcsProjectNodeRecord): PcsProjectNodeRecord {
  return {
    ...cloneNode(node),
    currentStatus: normalizeNodeStatus(node.currentStatus),
    pendingActionType: node.pendingActionType ?? '待执行',
    pendingActionText: node.pendingActionText ?? '待开始执行',
    latestResultType: node.latestResultType || '',
    latestResultText: node.latestResultText || '',
    currentIssueType: node.currentIssueType || '',
    currentIssueText: node.currentIssueText || '',
    latestInstanceId: node.latestInstanceId || '',
    latestInstanceCode: node.latestInstanceCode || '',
    sourceTemplateNodeId: node.sourceTemplateNodeId || '',
    sourceTemplateVersion: node.sourceTemplateVersion || '',
    updatedAt: node.updatedAt || '',
    lastEventId: node.lastEventId || '',
    lastEventType: node.lastEventType || '',
    lastEventTime: node.lastEventTime || '',
  }
}

function mergeMissingBootstrapData(snapshot: PcsProjectStoreSnapshot): PcsProjectStoreSnapshot {
  const bootstrap = seedSnapshot()
  const mergedProjects = snapshot.projects.map(normalizeProject)
  const mergedPhases = snapshot.phases.map(normalizePhase)
  const mergedNodes = snapshot.nodes.map(normalizeNode)

  const projectIds = new Set(mergedProjects.map((item) => item.projectId))
  const phaseIds = new Set(mergedPhases.map((item) => item.projectPhaseId))
  const nodeIds = new Set(mergedNodes.map((item) => item.projectNodeId))

  bootstrap.projects.forEach((project) => {
    if (!projectIds.has(project.projectId)) {
      mergedProjects.push(cloneProject(project))
      projectIds.add(project.projectId)
    }
  })

  bootstrap.phases.forEach((phase) => {
    if (!phaseIds.has(phase.projectPhaseId)) {
      mergedPhases.push(clonePhase(phase))
      phaseIds.add(phase.projectPhaseId)
    }
  })

  bootstrap.nodes.forEach((node) => {
    if (!nodeIds.has(node.projectNodeId)) {
      mergedNodes.push(cloneNode(node))
      nodeIds.add(node.projectNodeId)
    }
  })

  return {
    version: PROJECT_STORE_VERSION,
    projects: mergedProjects,
    phases: mergedPhases,
    nodes: mergedNodes,
  }
}

function hydrateSnapshot(snapshot: PcsProjectStoreSnapshot): PcsProjectStoreSnapshot {
  const normalized: PcsProjectStoreSnapshot = {
    version: PROJECT_STORE_VERSION,
    projects: Array.isArray(snapshot.projects) ? snapshot.projects.map(normalizeProject) : [],
    phases: Array.isArray(snapshot.phases) ? snapshot.phases.map(normalizePhase) : [],
    nodes: Array.isArray(snapshot.nodes) ? snapshot.nodes.map(normalizeNode) : [],
  }

  if (normalized.projects.length === 0 && normalized.phases.length === 0 && normalized.nodes.length === 0) {
    return seedSnapshot()
  }

  return mergeMissingBootstrapData(normalized)
}

function loadSnapshot(): PcsProjectStoreSnapshot {
  if (memorySnapshot) return cloneSnapshot(memorySnapshot)

  if (!canUseStorage()) {
    memorySnapshot = seedSnapshot()
    return cloneSnapshot(memorySnapshot)
  }

  try {
    const raw = localStorage.getItem(PROJECT_STORAGE_KEY)
    if (!raw) {
      memorySnapshot = seedSnapshot()
      localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(memorySnapshot))
      return cloneSnapshot(memorySnapshot)
    }

    const parsed = JSON.parse(raw) as Partial<PcsProjectStoreSnapshot>
    if (!Array.isArray(parsed.projects) || !Array.isArray(parsed.phases) || !Array.isArray(parsed.nodes)) {
      memorySnapshot = seedSnapshot()
      localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(memorySnapshot))
      return cloneSnapshot(memorySnapshot)
    }

    memorySnapshot = hydrateSnapshot({
      version: PROJECT_STORE_VERSION,
      projects: parsed.projects as PcsProjectRecord[],
      phases: parsed.phases as PcsProjectPhaseRecord[],
      nodes: parsed.nodes as PcsProjectNodeRecord[],
    })
    localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(memorySnapshot))
    return cloneSnapshot(memorySnapshot)
  } catch {
    memorySnapshot = seedSnapshot()
    if (canUseStorage()) {
      localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(memorySnapshot))
    }
    return cloneSnapshot(memorySnapshot)
  }
}

function persistSnapshot(snapshot: PcsProjectStoreSnapshot): void {
  memorySnapshot = hydrateSnapshot(snapshot)
  if (canUseStorage()) {
    localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(memorySnapshot))
  }
}

function sortProjects(projects: PcsProjectRecord[]): PcsProjectRecord[] {
  return [...projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

function getProjectCreateCatalogInternal(): ProjectCreateCatalog {
  const brands = listProjectWorkspaceBrands().map((item) => ({ id: item.id, name: item.name }))
  const categories = buildProjectWorkspaceCategoryOptions().map((item) => ({
    id: item.id,
    name: item.name,
    children: item.children.map((child) => ({ ...child })),
  }))
  const styles = listProjectWorkspaceStyles().map((item) => ({ id: item.id, name: item.name }))
  const styleCodes = listProjectWorkspaceStyleCodes().map((item) => ({ id: item.id, name: item.name }))
  const crowdPositioning = listProjectWorkspaceCrowdPositioning().map((item) => ({ id: item.id, name: item.name }))
  const ages = listProjectWorkspaceAges().map((item) => ({ id: item.id, name: item.name }))
  const crowds = listProjectWorkspaceCrowds().map((item) => ({ id: item.id, name: item.name }))
  const productPositioning = listProjectWorkspaceProductPositioning().map((item) => ({
    id: item.id,
    name: item.name,
  }))

  return {
    projectTypes: [...PROJECT_TYPES],
    projectSourceTypes: [...PROJECT_SOURCE_TYPES],
    styleTypes: [...STYLE_TYPES],
    categories,
    brands,
    styles,
    styleCodes,
    crowdPositioning,
    ages,
    crowds,
    productPositioning,
    sampleSuppliers: SAMPLE_SUPPLIER_OPTIONS.map((item) => ({ ...item })),
    owners: OWNER_OPTIONS.map((item) => ({ ...item })),
    teams: TEAM_OPTIONS.map((item) => ({ ...item })),
    collaborators: COLLABORATOR_OPTIONS.map((item) => ({ ...item })),
    seasonTags: [...SEASON_TAGS],
    styleTags: styles.map((item) => item.name),
    targetAudienceTags: Array.from(new Set([...crowdPositioning, ...ages, ...crowds].map((item) => item.name))),
    priceRanges: [...PRICE_RANGES],
    channelOptions: CHANNEL_OPTIONS.map((item) => ({ ...item })),
    sampleSourceTypes: [...SAMPLE_SOURCE_TYPES],
    priorityLevels: [...PRIORITY_LEVELS],
  }
}

function findSimpleOptionById(options: Array<{ id: string; name: string }>, id: string) {
  return options.find((item) => item.id === id) ?? null
}

function findCategoryNodeById(categoryId: string) {
  return buildProjectWorkspaceCategoryOptions().find((item) => item.id === categoryId) ?? null
}

function findChannelNames(codes: string[]): string[] {
  return codes
    .map((code) => CHANNEL_OPTIONS.find((item) => item.code === code)?.name ?? code)
    .filter(Boolean)
}

function deriveProjectTypeFromStyleType(styleType: TemplateStyleType): typeof PROJECT_TYPES[number] {
  if (styleType === '快时尚款') return '快反上新'
  if (styleType === '改版款') return '改版开发'
  if (styleType === '设计款') return '设计研发'
  return '商品开发'
}

function nextProjectSequence(snapshot: PcsProjectStoreSnapshot, dateKey: string): number {
  const sameDay = snapshot.projects.filter((project) => formatDateKey(project.createdAt || project.updatedAt) === dateKey)
  return sameDay.length + 1
}

function buildProjectId(dateKey: string, sequence: number): string {
  return `prj_${dateKey}_${String(sequence).padStart(3, '0')}`
}

function buildProjectCode(dateKey: string, sequence: number): string {
  return `PRJ-${dateKey}-${String(sequence).padStart(3, '0')}`
}

function buildProjectPhases(
  projectId: string,
  ownerId: string,
  ownerName: string,
  createdAt: string,
  template: ProjectTemplate,
): PcsProjectPhaseRecord[] {
  return buildProjectPhaseRecordsFromTemplate({
    projectId,
    ownerId,
    ownerName,
    createdAt,
    template,
  })
}

function buildProjectNodes(
  projectId: string,
  createdAt: string,
  ownerId: string,
  ownerName: string,
  template: ProjectTemplate,
): PcsProjectNodeRecord[] {
  return buildProjectNodeRecordsFromTemplate({
    projectId,
    ownerId,
    ownerName,
    createdAt,
    template,
  })
}

export function getProjectCreateCatalog(): ProjectCreateCatalog {
  return getProjectCreateCatalogInternal()
}

export function createEmptyProjectDraft(): PcsProjectCreateDraft {
  return {
    projectName: '',
    projectType: '',
    projectSourceType: '',
    templateId: '',
    categoryId: '',
    categoryName: '',
    subCategoryId: '',
    subCategoryName: '',
    brandId: '',
    brandName: '',
    styleNumber: '',
    styleCodeId: '',
    styleCodeName: '',
    styleType: '',
    yearTag: String(new Date().getFullYear()),
    seasonTags: [],
    styleTags: [],
    styleTagIds: [],
    styleTagNames: [],
    crowdPositioningIds: [],
    crowdPositioningNames: [],
    ageIds: [],
    ageNames: [],
    crowdIds: [],
    crowdNames: [],
    productPositioningIds: [],
    productPositioningNames: [],
    targetAudienceTags: [],
    priceRangeLabel: '',
    targetChannelCodes: [],
    projectAlbumUrls: [],
    sampleSourceType: '自打样',
    sampleSupplierId: '',
    sampleSupplierName: '',
    sampleLink: '',
    sampleUnitPrice: '',
    ownerId: '',
    ownerName: '',
    teamId: '',
    teamName: '',
    collaboratorIds: [],
    collaboratorNames: [],
    priorityLevel: '中',
    remark: '',
  }
}

export function validateProjectCreateDraft(draft: PcsProjectCreateDraft): string[] {
  const errors: string[] = []
  const catalog = getProjectCreateCatalogInternal()

  if (!draft.projectName.trim()) errors.push('请填写项目名称。')
  if (!draft.projectSourceType) errors.push('请选择项目来源类型。')
  if (!draft.templateId) errors.push('请选择项目模板。')
  if (!draft.categoryId) errors.push('请选择一级分类。')
  if (!draft.brandId) errors.push('请选择品牌。')
  if (draft.targetChannelCodes.length === 0) errors.push('请选择目标测款渠道。')
  if (!draft.ownerId) errors.push('请选择负责人。')
  if (catalog.teams.length > 0 && !draft.teamId) errors.push('请选择执行团队。')
  if (draft.sampleSourceType === '外采' && !draft.sampleLink.trim() && !draft.sampleUnitPrice.trim()) {
    errors.push('样衣来源方式为外采时，外采链接和样衣单价至少填写一项。')
  }
  if (draft.templateId) {
    const template = getProjectTemplateById(draft.templateId)
    if (!template) {
      errors.push('未找到所选项目模板。')
    } else if (hasTemplatePendingNodes(template)) {
      errors.push('当前模板存在未完成标准化的节点，请先处理模板中的待补充标准工作项。')
    } else {
      const summary = buildTemplateBusinessSummary(template)
      if (summary.closureStatus === '配置异常') {
        errors.push('当前项目模板配置异常，不能创建商品项目。')
      }
    }
  }
  return errors
}

function readSnapshot(): PcsProjectStoreSnapshot {
  return loadSnapshot()
}

export function getProjectStoreSnapshot(): PcsProjectStoreSnapshot {
  return readSnapshot()
}

export function listProjects(): PcsProjectRecord[] {
  return sortProjects(readSnapshot().projects.map(cloneProject))
}

export function getProjectById(projectId: string): PcsProjectRecord | null {
  const project = readSnapshot().projects.find((item) => item.projectId === projectId)
  return project ? cloneProject(project) : null
}

export function getProjectIdentityById(projectId: string): ProjectIdentityRef | null {
  const project = getProjectById(projectId)
  if (!project) return null
  return {
    projectId: project.projectId,
    projectCode: project.projectCode,
    projectName: project.projectName,
  }
}

export function findProjectByCode(projectCode: string): PcsProjectRecord | null {
  const project = readSnapshot().projects.find((item) => item.projectCode === projectCode)
  return project ? cloneProject(project) : null
}

export function listProjectPhases(projectId: string): PcsProjectPhaseRecord[] {
  return readSnapshot()
    .phases
    .filter((item) => item.projectId === projectId)
    .sort((a, b) => a.phaseOrder - b.phaseOrder)
    .map(clonePhase)
}

export function listProjectNodes(projectId: string): PcsProjectNodeRecord[] {
  return readSnapshot()
    .nodes
    .filter((item) => item.projectId === projectId)
    .sort((a, b) => {
      if (a.phaseCode === b.phaseCode) return a.sequenceNo - b.sequenceNo
      return a.projectNodeId.localeCompare(b.projectNodeId)
    })
    .map(cloneNode)
}

export function findProjectNodeById(projectId: string, projectNodeId: string): ProjectNodeIdentityRef | null {
  const node = readSnapshot().nodes.find((item) => item.projectId === projectId && item.projectNodeId === projectNodeId)
  if (!node) return null
  return {
    projectNodeId: node.projectNodeId,
    projectId: node.projectId,
    phaseCode: node.phaseCode,
    phaseName: node.phaseName,
    workItemId: node.workItemId,
    workItemTypeCode: node.workItemTypeCode,
    workItemTypeName: node.workItemTypeName,
  }
}

export function getProjectNodeRecordById(projectId: string, projectNodeId: string): PcsProjectNodeRecord | null {
  const node = readSnapshot().nodes.find((item) => item.projectId === projectId && item.projectNodeId === projectNodeId)
  return node ? cloneNode(node) : null
}

export function findProjectNodeByWorkItemTypeCode(projectId: string, workItemTypeCode: string): ProjectNodeIdentityRef | null {
  const node = readSnapshot()
    .nodes
    .filter((item) => item.projectId === projectId && item.workItemTypeCode === workItemTypeCode)
    .sort((a, b) => a.sequenceNo - b.sequenceNo)[0]
  if (!node) return null
  return {
    projectNodeId: node.projectNodeId,
    projectId: node.projectId,
    phaseCode: node.phaseCode,
    phaseName: node.phaseName,
    workItemId: node.workItemId,
    workItemTypeCode: node.workItemTypeCode,
    workItemTypeName: node.workItemTypeName,
  }
}

export function getProjectNodeRecordByWorkItemTypeCode(
  projectId: string,
  workItemTypeCode: string,
): PcsProjectNodeRecord | null {
  const node = readSnapshot()
    .nodes
    .filter((item) => item.projectId === projectId && item.workItemTypeCode === workItemTypeCode)
    .sort((a, b) => a.sequenceNo - b.sequenceNo)[0]
  return node ? cloneNode(node) : null
}

export function createProject(input: PcsProjectCreateDraft, operatorName = '当前用户'): ProjectCreateResult {
  const errors = validateProjectCreateDraft(input)
  if (errors.length > 0) {
    throw new Error(errors[0])
  }

  const snapshot = readSnapshot()
  const template = getProjectTemplateById(input.templateId)
  if (!template) {
    throw new Error('未找到所选项目模板。')
  }
  if (hasTemplatePendingNodes(template)) {
    throw new Error('当前模板存在未完成标准化的节点，请先处理模板中的待补充标准工作项。')
  }
  const templateSummary = buildTemplateBusinessSummary(template)
  if (templateSummary.closureStatus === '配置异常') {
    throw new Error('当前项目模板配置异常，不能创建商品项目。')
  }

  const timestamp = nowText()
  const dateKey = formatDateKey(timestamp)
  const sequence = nextProjectSequence(snapshot, dateKey)
  const projectId = buildProjectId(dateKey, sequence)
  const projectCode = buildProjectCode(dateKey, sequence)
  const phases = buildProjectPhases(projectId, input.ownerId, input.ownerName, timestamp, template)
  const nodes = buildProjectNodes(projectId, timestamp, input.ownerId, input.ownerName, template)
  const firstPhase = phases[0]

  if (!firstPhase) {
    throw new Error('所选模板未配置阶段，无法创建项目。')
  }

  const styleTagNames = input.styleTagNames.length > 0 ? [...input.styleTagNames] : [...input.styleTags]
  const targetAudienceTags = Array.from(
    new Set([
      ...input.crowdPositioningNames,
      ...input.ageNames,
      ...input.crowdNames,
      ...input.targetAudienceTags,
    ]),
  )
  const derivedStyleType = input.styleType || template.styleType[0] || '基础款'
  const derivedProjectType = input.projectType || deriveProjectTypeFromStyleType(derivedStyleType)

  const project: PcsProjectRecord = {
    projectId,
    projectCode,
    projectName: input.projectName.trim(),
    projectType: derivedProjectType,
    projectSourceType: input.projectSourceType,
    templateId: template.id,
    templateName: template.name,
    templateVersion: getProjectTemplateVersion(template),
    projectStatus: '已立项',
    currentPhaseCode: firstPhase.phaseCode,
    currentPhaseName: firstPhase.phaseName,
    categoryId: input.categoryId,
    categoryName: input.categoryName,
    subCategoryId: input.subCategoryId,
    subCategoryName: input.subCategoryName,
    brandId: input.brandId,
    brandName: input.brandName,
    styleNumber: input.styleNumber.trim() || input.styleCodeName,
    styleCodeId: input.styleCodeId,
    styleCodeName: input.styleCodeName,
    styleType: derivedStyleType,
    yearTag: input.yearTag.trim(),
    seasonTags: [...input.seasonTags],
    styleTags: styleTagNames,
    styleTagIds: [...input.styleTagIds],
    styleTagNames,
    crowdPositioningIds: [...input.crowdPositioningIds],
    crowdPositioningNames: [...input.crowdPositioningNames],
    ageIds: [...input.ageIds],
    ageNames: [...input.ageNames],
    crowdIds: [...input.crowdIds],
    crowdNames: [...input.crowdNames],
    productPositioningIds: [...input.productPositioningIds],
    productPositioningNames: [...input.productPositioningNames],
    targetAudienceTags,
    priceRangeLabel: input.priceRangeLabel,
    targetChannelCodes: [...input.targetChannelCodes],
    projectAlbumUrls: [...input.projectAlbumUrls],
    sampleSourceType: input.sampleSourceType || '自打样',
    sampleSupplierId: input.sampleSupplierId,
    sampleSupplierName: input.sampleSupplierName,
    sampleLink: input.sampleLink.trim(),
    sampleUnitPrice: input.sampleUnitPrice.trim() ? Number(input.sampleUnitPrice) : null,
    ownerId: input.ownerId,
    ownerName: input.ownerName,
    teamId: input.teamId,
    teamName: input.teamName,
    collaboratorIds: [...input.collaboratorIds],
    collaboratorNames: [...input.collaboratorNames],
    priorityLevel: input.priorityLevel,
    createdAt: timestamp,
    createdBy: operatorName,
    updatedAt: timestamp,
    updatedBy: operatorName,
    remark: input.remark.trim(),
    linkedStyleId: '',
    linkedStyleCode: '',
    linkedStyleName: '',
    linkedStyleGeneratedAt: '',
    linkedTechPackVersionId: '',
    linkedTechPackVersionCode: '',
    linkedTechPackVersionLabel: '',
    linkedTechPackVersionStatus: '',
    linkedTechPackVersionPublishedAt: '',
    projectArchiveId: '',
    projectArchiveNo: '',
    projectArchiveStatus: '',
    projectArchiveDocumentCount: 0,
    projectArchiveFileCount: 0,
    projectArchiveMissingItemCount: 0,
    projectArchiveUpdatedAt: '',
    projectArchiveFinalizedAt: '',
  }

  persistSnapshot({
    version: PROJECT_STORE_VERSION,
    projects: [project, ...snapshot.projects],
    phases: [...snapshot.phases, ...phases],
    nodes: [...snapshot.nodes, ...nodes],
  })

  return {
    project: getProjectById(project.projectId) ?? project,
    phases: phases.map(clonePhase),
    nodes: nodes.map(cloneNode),
  }
}

export function updateProjectNodeRecord(
  projectId: string,
  projectNodeId: string,
  patch: Partial<PcsProjectNodeRecord>,
  operatorName = '系统回写',
): PcsProjectNodeRecord | null {
  const snapshot = readSnapshot()
  const nodeIndex = snapshot.nodes.findIndex((item) => item.projectId === projectId && item.projectNodeId === projectNodeId)
  if (nodeIndex < 0) return null

  const currentNode = snapshot.nodes[nodeIndex]
  const definedPatch = Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  ) as Partial<PcsProjectNodeRecord>
  const nextNode: PcsProjectNodeRecord = normalizeNode({
    ...currentNode,
    ...definedPatch,
  })

  const nextNodes = [...snapshot.nodes]
  nextNodes.splice(nodeIndex, 1, nextNode)

  const nextProjects = snapshot.projects.map((project) =>
    project.projectId === projectId
      ? {
          ...project,
          updatedAt: definedPatch.updatedAt || nextNode.updatedAt || project.updatedAt,
          updatedBy: operatorName,
        }
      : project,
  )

  persistSnapshot({
    version: PROJECT_STORE_VERSION,
    projects: nextProjects,
    phases: snapshot.phases,
    nodes: nextNodes,
  })

  return cloneNode(nextNode)
}

export function updateProjectPhaseRecord(
  projectId: string,
  projectPhaseId: string,
  patch: Partial<PcsProjectPhaseRecord>,
): PcsProjectPhaseRecord | null {
  const snapshot = readSnapshot()
  const phaseIndex = snapshot.phases.findIndex(
    (item) => item.projectId === projectId && item.projectPhaseId === projectPhaseId,
  )
  if (phaseIndex < 0) return null

  const currentPhase = snapshot.phases[phaseIndex]
  const definedPatch = Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  ) as Partial<PcsProjectPhaseRecord>

  const nextPhase = normalizePhase({
    ...currentPhase,
    ...definedPatch,
  })

  const nextPhases = [...snapshot.phases]
  nextPhases.splice(phaseIndex, 1, nextPhase)

  persistSnapshot({
    version: PROJECT_STORE_VERSION,
    projects: snapshot.projects,
    phases: nextPhases,
    nodes: snapshot.nodes,
  })

  return clonePhase(nextPhase)
}

export function updateProjectRecord(
  projectId: string,
  patch: Partial<PcsProjectRecord>,
  operatorName = '系统回写',
): PcsProjectRecord | null {
  const snapshot = readSnapshot()
  const projectIndex = snapshot.projects.findIndex((item) => item.projectId === projectId)
  if (projectIndex < 0) return null

  const currentProject = snapshot.projects[projectIndex]
  const definedPatch = Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  ) as Partial<PcsProjectRecord>

  const nextProject = normalizeProject({
    ...currentProject,
    ...definedPatch,
    updatedAt: definedPatch.updatedAt || currentProject.updatedAt,
    updatedBy: operatorName,
  })

  const nextProjects = [...snapshot.projects]
  nextProjects.splice(projectIndex, 1, nextProject)

  persistSnapshot({
    version: PROJECT_STORE_VERSION,
    projects: nextProjects,
    phases: snapshot.phases,
    nodes: snapshot.nodes,
  })

  return cloneProject(nextProject)
}

export function resetProjectRepository(): void {
  const snapshot = seedSnapshot()
  persistSnapshot(snapshot)
  if (canUseStorage()) {
    localStorage.removeItem(PROJECT_STORAGE_KEY)
    localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(snapshot))
  }
}

export function replaceProjectStore(snapshot: PcsProjectStoreSnapshot): void {
  persistSnapshot(snapshot)
}

export function getProjectCategoryChildren(categoryId: string): Array<{ id: string; name: string }> {
  return findCategoryNodeById(categoryId)?.children.map((item) => ({ ...item })) ?? []
}

export function listActiveProjectTemplates(): ProjectTemplate[] {
  return listProjectTemplates().filter((template) => template.status === 'active')
}

export function getChannelNamesByCodes(codes: string[]): string[] {
  return findChannelNames(codes)
}

export function getProjectOptionNameById(
  type: 'brand' | 'supplier' | 'owner' | 'team' | 'collaborator',
  id: string,
): string {
  if (type === 'brand') {
    return findProjectWorkspaceOptionById('brands', id)?.name ?? ''
  }

  const maps = {
    supplier: SAMPLE_SUPPLIER_OPTIONS,
    owner: OWNER_OPTIONS,
    team: TEAM_OPTIONS,
    collaborator: COLLABORATOR_OPTIONS,
  } as const
  return findSimpleOptionById(maps[type], id)?.name ?? ''
}
