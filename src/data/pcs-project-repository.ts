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
  PcsProjectRuntimeState,
  PcsProjectViewRecord,
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

const PROJECT_STORAGE_KEY = 'higood-pcs-project-store-v2'
const PROJECT_STORE_VERSION = 2

const PROJECT_TYPES = ['商品开发', '快反上新', '改版开发', '设计研发'] as const
const PROJECT_SOURCE_TYPES = ['企划提案', '渠道反馈', '测款沉淀', '历史复用', '外部灵感'] as const
const SAMPLE_SOURCE_TYPES = ['外采', '自打样', '委托打样'] as const
const PRIORITY_LEVELS = ['高', '中', '低'] as const
const STYLE_TYPES: TemplateStyleType[] = ['基础款', '快时尚款', '改版款', '设计款']
const YEAR_TAGS = Array.from({ length: 4 }, (_, index) => String(new Date().getFullYear() - 1 + index))
const SEASON_TAGS = ['春季', '夏季', '秋季', '冬季', '四季']
const PRICE_RANGES = ['≤5美元', '5美元~10美元', '10美元~15美元', '15美元~20美元', '20美元~25美元', '25美元~30美元', '＞30美元']

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

function stripProjectRuntimeFields(project: PcsProjectRecord | PcsProjectViewRecord): PcsProjectRecord {
  const {
    progressDone: _progressDone,
    progressTotal: _progressTotal,
    nextWorkItemName: _nextWorkItemName,
    nextWorkItemStatus: _nextWorkItemStatus,
    pendingDecisionFlag: _pendingDecisionFlag,
    blockedFlag: _blockedFlag,
    blockedReason: _blockedReason,
    riskStatus: _riskStatus,
    riskReason: _riskReason,
    riskWorkItem: _riskWorkItem,
    riskDurationDays: _riskDurationDays,
    ...rest
  } = project as PcsProjectViewRecord
  return rest as PcsProjectRecord
}

function cloneProject(project: PcsProjectRecord): PcsProjectRecord {
  const baseProject = stripProjectRuntimeFields(project)
  return {
    ...baseProject,
    seasonTags: [...(baseProject.seasonTags || [])],
    styleTags: [...(baseProject.styleTags || [])],
    styleTagIds: [...(baseProject.styleTagIds || [])],
    styleTagNames: [...(baseProject.styleTagNames || [])],
    crowdPositioningIds: [...(baseProject.crowdPositioningIds || [])],
    crowdPositioningNames: [...(baseProject.crowdPositioningNames || [])],
    ageIds: [...(baseProject.ageIds || [])],
    ageNames: [...(baseProject.ageNames || [])],
    crowdIds: [...(baseProject.crowdIds || [])],
    crowdNames: [...(baseProject.crowdNames || [])],
    productPositioningIds: [...(baseProject.productPositioningIds || [])],
    productPositioningNames: [...(baseProject.productPositioningNames || [])],
    targetAudienceTags: [...(baseProject.targetAudienceTags || [])],
    targetChannelCodes: [...(baseProject.targetChannelCodes || [])],
    projectAlbumUrls: [...(baseProject.projectAlbumUrls || [])],
    collaboratorIds: [...(baseProject.collaboratorIds || [])],
    collaboratorNames: [...(baseProject.collaboratorNames || [])],
    linkedStyleId: baseProject.linkedStyleId || '',
    linkedStyleCode: baseProject.linkedStyleCode || '',
    linkedStyleName: baseProject.linkedStyleName || '',
    linkedStyleGeneratedAt: baseProject.linkedStyleGeneratedAt || '',
    linkedTechPackVersionId: baseProject.linkedTechPackVersionId || '',
    linkedTechPackVersionCode: baseProject.linkedTechPackVersionCode || '',
    linkedTechPackVersionLabel: baseProject.linkedTechPackVersionLabel || '',
    linkedTechPackVersionStatus: baseProject.linkedTechPackVersionStatus || '',
    linkedTechPackVersionPublishedAt: baseProject.linkedTechPackVersionPublishedAt || '',
    projectArchiveId: baseProject.projectArchiveId || '',
    projectArchiveNo: baseProject.projectArchiveNo || '',
    projectArchiveStatus: baseProject.projectArchiveStatus || '',
    projectArchiveDocumentCount: Number.isFinite(baseProject.projectArchiveDocumentCount)
      ? baseProject.projectArchiveDocumentCount
      : 0,
    projectArchiveFileCount: Number.isFinite(baseProject.projectArchiveFileCount) ? baseProject.projectArchiveFileCount : 0,
    projectArchiveMissingItemCount: Number.isFinite(baseProject.projectArchiveMissingItemCount)
      ? baseProject.projectArchiveMissingItemCount
      : 0,
    projectArchiveUpdatedAt: baseProject.projectArchiveUpdatedAt || '',
    projectArchiveFinalizedAt: baseProject.projectArchiveFinalizedAt || '',
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
      project.projectStatus === '已终止' ||
      project.projectStatus === '已归档' ||
      project.projectStatus === '已立项'
        ? project.projectStatus
        : project.projectStatus === '待审核'
          ? '已立项'
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

function getNodeAlignmentScore(node: PcsProjectNodeRecord, expectedNodeId: string): number {
  let score = 0
  if (node.projectNodeId === expectedNodeId) score += 20
  if (node.currentStatus === '已完成') score += 120
  else if (node.currentStatus === '待确认') score += 90
  else if (node.currentStatus === '进行中') score += 70
  else if (node.currentStatus === '已取消') score += 30

  if (node.latestInstanceId || node.latestInstanceCode) score += 40
  if (node.latestResultType || node.latestResultText) score += 20
  if (node.updatedAt || node.lastEventTime) score += 10
  if (node.validInstanceCount > 0) score += 10
  return score
}

function alignProjectNodesWithTemplate(
  project: PcsProjectRecord,
  existingNodes: PcsProjectNodeRecord[],
): PcsProjectNodeRecord[] {
  const template = getProjectTemplateById(project.templateId)
  if (!template) {
    return existingNodes.map(normalizeNode)
  }

  const generatedNodes = buildProjectNodeRecordsFromTemplate({
    projectId: project.projectId,
    ownerId: project.ownerId,
    ownerName: project.ownerName,
    createdAt: project.createdAt,
    template,
  })

  const candidatesByCode = new Map<string, PcsProjectNodeRecord[]>()
  existingNodes.forEach((node) => {
    const list = candidatesByCode.get(node.workItemTypeCode) || []
    list.push(node)
    candidatesByCode.set(node.workItemTypeCode, list)
  })

  const usedNodeIds = new Set<string>()

  return generatedNodes.map((generatedNode) => {
    const candidates = (candidatesByCode.get(generatedNode.workItemTypeCode) || [])
      .filter((item) => !usedNodeIds.has(item.projectNodeId))
      .sort(
        (left, right) =>
          getNodeAlignmentScore(right, generatedNode.projectNodeId) -
          getNodeAlignmentScore(left, generatedNode.projectNodeId),
      )

    const matchedNode = candidates[0] || null
    if (!matchedNode) {
      return normalizeNode(generatedNode)
    }

    usedNodeIds.add(matchedNode.projectNodeId)
    return normalizeNode({
      ...matchedNode,
      phaseCode: generatedNode.phaseCode,
      phaseName: generatedNode.phaseName,
      workItemId: generatedNode.workItemId,
      workItemTypeCode: generatedNode.workItemTypeCode,
      workItemTypeName: generatedNode.workItemTypeName,
      sequenceNo: generatedNode.sequenceNo,
      requiredFlag: generatedNode.requiredFlag,
      multiInstanceFlag: generatedNode.multiInstanceFlag,
      sourceTemplateNodeId: generatedNode.sourceTemplateNodeId,
      sourceTemplateVersion: generatedNode.sourceTemplateVersion,
    })
  })
}

function migrateRevisionTemplateProject(project: PcsProjectRecord): PcsProjectRecord {
  if (project.templateId !== 'TPL-003') return normalizeProject(project)

  const nextProject = { ...project }

  if (nextProject.currentNodeCode === 'FEASIBILITY_REVIEW') {
    nextProject.currentNodeCode = 'SAMPLE_CONFIRM'
  }

  if (nextProject.issueNodeCode === 'FEASIBILITY_REVIEW') {
    nextProject.issueNodeCode = 'SAMPLE_CONFIRM'
    if (nextProject.issueText.includes('初步可行性判断')) {
      nextProject.issueText = '样衣确认待补充结论后才可继续。'
    }
  }

  if (nextProject.latestNodeCode === 'FEASIBILITY_REVIEW') {
    nextProject.latestNodeCode = 'SAMPLE_INBOUND_CHECK'
    if (!nextProject.latestResultType || nextProject.latestResultType.includes('可行性')) {
      nextProject.latestResultType = '到样入库与核对'
    }
    if (!nextProject.latestResultText || nextProject.latestResultText.includes('可行性')) {
      nextProject.latestResultText = '样衣已完成到样入库与核对。'
    }
  }

  return normalizeProject(nextProject)
}

function mergeMissingBootstrapData(snapshot: PcsProjectStoreSnapshot): PcsProjectStoreSnapshot {
  const bootstrap = seedSnapshot()
  const mergedProjects = snapshot.projects.map(migrateRevisionTemplateProject)
  const mergedPhases = snapshot.phases.map(normalizePhase)
  const templateNodeCodeMap = new Map<string, Set<string>>()

  mergedProjects.forEach((project) => {
    const template = getProjectTemplateById(project.templateId)
    if (!template) return
    templateNodeCodeMap.set(
      project.projectId,
      new Set(
        buildProjectNodeRecordsFromTemplate({
          projectId: project.projectId,
          ownerId: project.ownerId,
          ownerName: project.ownerName,
          createdAt: project.createdAt,
          template,
        }).map((node) => node.workItemTypeCode),
      ),
    )
  })

  const projectMap = new Map(mergedProjects.map((project) => [project.projectId, project]))
  let mergedNodes = snapshot.nodes
    .map(normalizeNode)
    .filter((node) => {
      const allowedNodeCodes = templateNodeCodeMap.get(node.projectId)
      if (!allowedNodeCodes) return true
      return allowedNodeCodes.has(node.workItemTypeCode)
    })
    .map((node) => {
      const project = projectMap.get(node.projectId)
      if (
        project?.templateId === 'TPL-003' &&
        project.currentNodeCode === 'SAMPLE_CONFIRM' &&
        node.workItemTypeCode === 'SAMPLE_CONFIRM'
      ) {
        return normalizeNode({
          ...node,
          currentStatus: node.currentStatus === '未开始' ? '待确认' : node.currentStatus,
          pendingActionType: '待确认',
          pendingActionText: '当前请处理：样衣确认',
          updatedAt: project.updatedAt || node.updatedAt,
        })
      }
      return node
    })

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

  const templateProjectIds = new Set(
    mergedProjects
      .filter((project) => Boolean(getProjectTemplateById(project.templateId)))
      .map((project) => project.projectId),
  )

  const alignedNodes = mergedProjects
    .filter((project) => templateProjectIds.has(project.projectId))
    .flatMap((project) =>
      alignProjectNodesWithTemplate(
        project,
        mergedNodes.filter((node) => node.projectId === project.projectId),
      ),
    )

  mergedNodes = [
    ...mergedNodes.filter((node) => !templateProjectIds.has(node.projectId)),
    ...alignedNodes,
  ]

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

  return repairProjectNodeSequences(mergeMissingBootstrapData(normalized))
}

function loadSnapshot(): PcsProjectStoreSnapshot {
  if (memorySnapshot) return cloneSnapshot(memorySnapshot)

  if (!canUseStorage()) {
    memorySnapshot = hydrateSnapshot(seedSnapshot())
    return cloneSnapshot(memorySnapshot)
  }

  try {
    const raw = localStorage.getItem(PROJECT_STORAGE_KEY)
    if (!raw) {
      memorySnapshot = hydrateSnapshot(seedSnapshot())
      localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(memorySnapshot))
      return cloneSnapshot(memorySnapshot)
    }

    const parsed = JSON.parse(raw) as Partial<PcsProjectStoreSnapshot>
    if (!Array.isArray(parsed.projects) || !Array.isArray(parsed.phases) || !Array.isArray(parsed.nodes)) {
      memorySnapshot = hydrateSnapshot(seedSnapshot())
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
    memorySnapshot = hydrateSnapshot(seedSnapshot())
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

function sortProjects<T extends { updatedAt: string }>(projects: T[]): T[] {
  return [...projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

function parseDateValue(dateText: string | null | undefined): number | null {
  if (!dateText) return null
  const normalized = dateText.includes('T') ? dateText : dateText.replace(' ', 'T')
  const timestamp = Date.parse(normalized)
  return Number.isNaN(timestamp) ? null : timestamp
}

function getDurationDaysSince(dateText: string | null | undefined, endDateText = nowText()): number {
  const startTimestamp = parseDateValue(dateText)
  const endTimestamp = parseDateValue(endDateText)
  if (startTimestamp === null || endTimestamp === null || endTimestamp < startTimestamp) return 0
  return Math.ceil((endTimestamp - startTimestamp) / (24 * 60 * 60 * 1000))
}

function getOrderedProjectNodes(snapshot: PcsProjectStoreSnapshot, projectId: string): PcsProjectNodeRecord[] {
  return snapshot.nodes
    .filter((item) => item.projectId === projectId)
    .sort((a, b) => {
      if (a.phaseCode === b.phaseCode) return a.sequenceNo - b.sequenceNo
      return a.projectNodeId.localeCompare(b.projectNodeId)
    })
}

function isClosedNodeStatus(status: ProjectNodeStatus): boolean {
  return status === '已完成' || status === '已取消'
}

function getProjectNodeSequenceBlockerFromSnapshot(
  snapshot: PcsProjectStoreSnapshot,
  projectId: string,
  projectNodeId: string,
): PcsProjectNodeRecord | null {
  const orderedNodes = getOrderedProjectNodes(snapshot, projectId)
  const targetIndex = orderedNodes.findIndex((item) => item.projectNodeId === projectNodeId)
  if (targetIndex <= 0) return null
  return (
    orderedNodes
      .slice(0, targetIndex)
      .find((item) => item.requiredFlag && !isClosedNodeStatus(item.currentStatus)) ?? null
  )
}

function resetNodeToLockedPending(
  node: PcsProjectNodeRecord,
  blocker: PcsProjectNodeRecord,
  timestamp: string,
): void {
  node.currentStatus = '未开始'
  node.latestResultType = ''
  node.latestResultText = ''
  node.currentIssueType = ''
  node.currentIssueText = ''
  node.latestInstanceId = ''
  node.latestInstanceCode = ''
  node.pendingActionType = '待前序完成'
  node.pendingActionText = `请先完成前序工作项：${blocker.workItemTypeName}`
  node.updatedAt = timestamp
  node.lastEventType = '流程顺序修复'
  node.lastEventTime = timestamp
}

function activateFirstOpenNode(node: PcsProjectNodeRecord, timestamp: string): void {
  node.currentStatus = '进行中'
  node.pendingActionType = '待执行'
  node.pendingActionText = `当前请处理：${node.workItemTypeName}`
  node.updatedAt = timestamp
  node.lastEventType = node.lastEventType || '节点激活'
  node.lastEventTime = timestamp
}

function syncProjectLifecycleInSnapshot(
  snapshot: PcsProjectStoreSnapshot,
  projectId: string,
  operatorName: string,
  timestamp: string,
): boolean {
  const project = snapshot.projects.find((item) => item.projectId === projectId)
  const phases = snapshot.phases
    .filter((item) => item.projectId === projectId)
    .sort((a, b) => a.phaseOrder - b.phaseOrder)
  const nodes = getOrderedProjectNodes(snapshot, projectId)
  if (!project || phases.length === 0 || nodes.length === 0) return false

  const nextNode = nodes.find((node) => !isClosedNodeStatus(node.currentStatus)) ?? null
  const currentPhaseCode = nextNode?.phaseCode ?? phases[phases.length - 1]?.phaseCode ?? project.currentPhaseCode
  const currentPhase = phases.find((item) => item.phaseCode === currentPhaseCode) ?? phases[0]
  const completedNonInitCount = nodes.filter(
    (node) => node.workItemTypeCode !== 'PROJECT_INIT' && node.currentStatus === '已完成',
  ).length
  const allClosed = nodes.every((node) => isClosedNodeStatus(node.currentStatus))
  const nextProjectStatus =
    project.projectStatus === '已终止'
      ? '已终止'
      : allClosed
        ? '已归档'
        : completedNonInitCount === 0
          ? '已立项'
          : '进行中'

  let changed = false
  if (
    project.currentPhaseCode !== currentPhase.phaseCode ||
    project.currentPhaseName !== currentPhase.phaseName ||
    project.projectStatus !== nextProjectStatus
  ) {
    project.currentPhaseCode = currentPhase.phaseCode
    project.currentPhaseName = currentPhase.phaseName
    project.projectStatus = nextProjectStatus
    project.updatedAt = timestamp
    project.updatedBy = operatorName
    changed = true
  }

  phases.forEach((phase) => {
    const phaseNodes = nodes.filter((node) => node.phaseCode === phase.phaseCode)
    let phaseStatus: PcsProjectPhaseRecord['phaseStatus'] = '未开始'
    if (nextProjectStatus === '已终止' && phaseNodes.some((node) => !isClosedNodeStatus(node.currentStatus))) {
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

    const startedAt = phaseStatus === '未开始' ? '' : phase.startedAt || timestamp
    const finishedAt = phaseStatus === '已完成' || phaseStatus === '已终止' ? phase.finishedAt || timestamp : ''
    if (phase.phaseStatus !== phaseStatus || phase.startedAt !== startedAt || phase.finishedAt !== finishedAt) {
      phase.phaseStatus = phaseStatus
      phase.startedAt = startedAt
      phase.finishedAt = finishedAt
      changed = true
    }
  })

  return changed
}

function repairProjectNodeSequenceInSnapshot(
  snapshot: PcsProjectStoreSnapshot,
  projectId: string,
  operatorName: string,
  timestamp: string,
): boolean {
  const project = snapshot.projects.find((item) => item.projectId === projectId)
  const orderedNodes = getOrderedProjectNodes(snapshot, projectId)
  if (!project || orderedNodes.length === 0) return false

  let changed = false

  if (project.projectStatus === '已终止') {
    orderedNodes.forEach((node) => {
      if (isClosedNodeStatus(node.currentStatus)) return
      node.currentStatus = '已取消'
      node.pendingActionType = '项目关闭'
      node.pendingActionText = '项目已终止'
      node.latestResultType = node.latestResultType || '项目终止'
      node.latestResultText = node.latestResultText || '项目已终止。'
      node.updatedAt = timestamp
      node.lastEventType = '项目终止'
      node.lastEventTime = timestamp
      changed = true
    })
    return syncProjectLifecycleInSnapshot(snapshot, projectId, operatorName, timestamp) || changed
  }

  const firstOpenIndex = orderedNodes.findIndex((node) => !isClosedNodeStatus(node.currentStatus))
  if (firstOpenIndex >= 0) {
    const firstOpenNode = orderedNodes[firstOpenIndex]
    if (firstOpenNode.currentStatus === '未开始') {
      activateFirstOpenNode(firstOpenNode, timestamp)
      changed = true
    }

    orderedNodes.slice(firstOpenIndex + 1).forEach((node) => {
      if (node.currentStatus === '未开始' || isClosedNodeStatus(node.currentStatus)) return
      resetNodeToLockedPending(node, firstOpenNode, timestamp)
      changed = true
    })
  }

  return syncProjectLifecycleInSnapshot(snapshot, projectId, operatorName, timestamp) || changed
}

function repairProjectNodeSequences(
  snapshot: PcsProjectStoreSnapshot,
  operatorName = '系统修复',
  timestamp = nowText(),
): PcsProjectStoreSnapshot {
  snapshot.projects.forEach((project) => {
    repairProjectNodeSequenceInSnapshot(snapshot, project.projectId, operatorName, timestamp)
  })
  return snapshot
}

function getNodeActivityTime(node: PcsProjectNodeRecord | null): string {
  if (!node) return ''
  return node.lastEventTime || node.updatedAt || ''
}

function isBlockingIssue(node: PcsProjectNodeRecord | null): boolean {
  if (!node) return false
  return /阻塞|暂缓|冻结|暂停/.test(`${node.currentIssueType} ${node.currentIssueText}`)
}

function getTerminationReason(nodes: PcsProjectNodeRecord[]): string {
  const terminationNode = [...nodes]
    .sort((a, b) => getNodeActivityTime(b).localeCompare(getNodeActivityTime(a)))
    .find(
      (node) =>
        node.lastEventType === '项目终止' ||
        node.latestResultType === '项目终止' ||
        node.currentIssueType === '项目终止',
    )
  return terminationNode?.latestResultText || terminationNode?.currentIssueText || ''
}

function deriveProjectRuntimeState(
  project: PcsProjectRecord,
  snapshot: PcsProjectStoreSnapshot,
  referenceTime = nowText(),
): PcsProjectRuntimeState {
  const nodes = getOrderedProjectNodes(snapshot, project.projectId)
  const progressDone = nodes.filter((node) => node.currentStatus === '已完成').length
  const progressTotal = nodes.length
  const nextNode = nodes.find((node) => !isClosedNodeStatus(node.currentStatus)) ?? null
  const pendingDecisionNode = nodes.find((node) => node.currentStatus === '待确认') ?? null
  const blockingNode =
    nodes.find((node) => !isClosedNodeStatus(node.currentStatus) && isBlockingIssue(node)) ??
    nodes.find((node) => isBlockingIssue(node)) ??
    null
  const delayedPendingDecisionDays = pendingDecisionNode ? getDurationDaysSince(getNodeActivityTime(pendingDecisionNode), referenceTime) : 0
  const blockingDurationDays = blockingNode ? getDurationDaysSince(getNodeActivityTime(blockingNode), referenceTime) : 0
  const blockedFlag = project.projectStatus === '进行中' ? Boolean(blockingNode) : false
  const blockedReason =
    blockedFlag
      ? blockingNode?.currentIssueText || blockingNode?.latestResultText || ''
      : project.projectStatus === '已终止'
        ? getTerminationReason(nodes)
        : ''
  const delayedPendingDecision =
    Boolean(pendingDecisionNode) && !blockedFlag && delayedPendingDecisionDays >= 2 && project.projectStatus === '进行中'
  const riskStatus: ProjectRiskStatus =
    blockingDurationDays >= 2 || delayedPendingDecision ? '延期' : '正常'
  const riskWorkItem = blockedFlag
    ? blockingNode?.workItemTypeName || ''
    : delayedPendingDecision
      ? pendingDecisionNode?.workItemTypeName || ''
      : ''
  const riskDurationDays = blockedFlag
    ? blockingDurationDays
    : delayedPendingDecision
      ? delayedPendingDecisionDays
      : 0
  const riskReason = blockedFlag
    ? blockedReason
    : delayedPendingDecision && pendingDecisionNode
      ? `${pendingDecisionNode.workItemTypeName}已停留 ${delayedPendingDecisionDays} 天未判定，当前节点仍待确认。`
      : ''

  return {
    progressDone,
    progressTotal,
    nextWorkItemName: nextNode?.workItemTypeName ?? '-',
    nextWorkItemStatus: nextNode?.currentStatus ?? '-',
    pendingDecisionFlag: Boolean(pendingDecisionNode),
    blockedFlag,
    blockedReason,
    riskStatus,
    riskReason,
    riskWorkItem,
    riskDurationDays,
  }
}

function buildProjectViewRecord(
  project: PcsProjectRecord,
  snapshot: PcsProjectStoreSnapshot,
  referenceTime = nowText(),
): PcsProjectViewRecord {
  return {
    ...cloneProject(project),
    ...deriveProjectRuntimeState(project, snapshot, referenceTime),
  }
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
    yearTags: [...YEAR_TAGS],
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

function getProjectSequenceDateKey(project: PcsProjectRecord): string {
  const codeMatched = project.projectCode.match(/^PRJ-(\d{8})-/)
  if (codeMatched) return codeMatched[1]
  const idMatched = project.projectId.match(/^prj_(\d{8})_/)
  if (idMatched) return idMatched[1]
  return formatDateKey(project.createdAt || project.updatedAt)
}

function nextProjectSequence(snapshot: PcsProjectStoreSnapshot, dateKey: string): number {
  const sameDay = snapshot.projects.filter((project) => getProjectSequenceDateKey(project) === dateKey)
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
    sampleSourceType: '',
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
  if (!draft.styleType) errors.push('请选择款式类型。')
  if (!draft.projectSourceType) errors.push('请选择项目来源类型。')
  if (!draft.templateId) errors.push('请选择项目模板。')
  if (!draft.categoryId) errors.push('请选择一级分类。')
  if (!draft.brandId) errors.push('请选择品牌。')
  if (!draft.yearTag.trim()) errors.push('请选择年份。')
  if (!draft.priceRangeLabel.trim()) errors.push('请选择价格带。')
  if (draft.targetChannelCodes.length === 0) errors.push('请选择目标测款渠道。')
  if (!draft.ownerId) errors.push('请选择负责人。')
  if (catalog.teams.length > 0 && !draft.teamId) errors.push('请选择执行团队。')
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

export function listProjects(): PcsProjectViewRecord[] {
  const snapshot = readSnapshot()
  return sortProjects(snapshot.projects.map((project) => buildProjectViewRecord(project, snapshot)))
}

export function getProjectById(projectId: string): PcsProjectViewRecord | null {
  const snapshot = readSnapshot()
  const project = snapshot.projects.find((item) => item.projectId === projectId)
  return project ? buildProjectViewRecord(project, snapshot) : null
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

export function findProjectByCode(projectCode: string): PcsProjectViewRecord | null {
  const snapshot = readSnapshot()
  const project = snapshot.projects.find((item) => item.projectCode === projectCode)
  return project ? buildProjectViewRecord(project, snapshot) : null
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

export function getProjectNodeSequenceBlocker(projectId: string, projectNodeId: string): PcsProjectNodeRecord | null {
  const blocker = getProjectNodeSequenceBlockerFromSnapshot(readSnapshot(), projectId, projectNodeId)
  return blocker ? cloneNode(blocker) : null
}

export function repairAllProjectNodeSequences(
  operatorName = '系统修复',
  timestamp = nowText(),
): {
  repairedProjectCount: number
  repairedNodeCount: number
} {
  const snapshot = readSnapshot()
  const before = snapshot.nodes.map((node) => ({
    projectId: node.projectId,
    projectNodeId: node.projectNodeId,
    currentStatus: node.currentStatus,
    latestInstanceId: node.latestInstanceId,
    latestInstanceCode: node.latestInstanceCode,
  }))
  const nextSnapshot = cloneSnapshot(snapshot)
  repairProjectNodeSequences(nextSnapshot, operatorName, timestamp)
  persistSnapshot(nextSnapshot)

  const changedNodes = nextSnapshot.nodes.filter((node) => {
    const previous = before.find((item) => item.projectNodeId === node.projectNodeId)
    return (
      previous &&
      (previous.currentStatus !== node.currentStatus ||
        previous.latestInstanceId !== node.latestInstanceId ||
        previous.latestInstanceCode !== node.latestInstanceCode)
    )
  })

  return {
    repairedProjectCount: new Set(changedNodes.map((node) => node.projectId)).size,
    repairedNodeCount: changedNodes.length,
  }
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
    sampleSourceType: '',
    sampleSupplierId: '',
    sampleSupplierName: '',
    sampleLink: '',
    sampleUnitPrice: null,
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

export function approveProjectInit(
  projectId: string,
  operatorName = '当前用户',
): {
  ok: boolean
  message: string
  project: PcsProjectRecord | null
  projectInitNode: PcsProjectNodeRecord | null
  nextNode: PcsProjectNodeRecord | null
} {
  const project = getProjectById(projectId)
  if (!project) {
    return {
      ok: false,
      message: '未找到对应商品项目，不能完成立项。',
      project: null,
      projectInitNode: null,
      nextNode: null,
    }
  }

  const projectInitNode = getProjectNodeRecordByWorkItemTypeCode(projectId, 'PROJECT_INIT')
  if (!projectInitNode) {
    return {
      ok: false,
      message: '未找到商品项目立项节点，不能完成立项。',
      project,
      projectInitNode: null,
      nextNode: null,
    }
  }

  if (projectInitNode.currentStatus === '已完成') {
    return {
      ok: false,
      message: '当前商品项目立项节点已完成，无需重复处理。',
      project,
      projectInitNode,
      nextNode: null,
    }
  }

  const sampleAcquireNode = getProjectNodeRecordByWorkItemTypeCode(projectId, 'SAMPLE_ACQUIRE')
  if (!sampleAcquireNode) {
    return {
      ok: false,
      message: '未找到样衣获取节点，不能完成立项流转。',
      project,
      projectInitNode,
      nextNode: null,
    }
  }

  const timestamp = nowText()

  const nextProject = updateProjectRecord(
    projectId,
    {
      projectStatus: '已立项',
      updatedAt: timestamp,
    },
    operatorName,
  )

  const nextProjectInitNode = updateProjectNodeRecord(
    projectId,
    projectInitNode.projectNodeId,
    {
      currentStatus: '已完成',
      validInstanceCount: 1,
      latestInstanceId: `${projectId}-project-init-complete-001`,
      latestInstanceCode: `${project.projectCode}-INIT-COMPLETE-001`,
      latestResultType: '立项完成',
      latestResultText: '商品项目立项已完成。',
      pendingActionType: '已完成',
      pendingActionText: '节点已完成',
      updatedAt: timestamp,
      lastEventType: '立项完成',
      lastEventTime: timestamp,
    },
    operatorName,
  )

  const nextNode = updateProjectNodeRecord(
    projectId,
    sampleAcquireNode.projectNodeId,
    {
      currentStatus: '进行中',
      pendingActionType: '待执行',
      pendingActionText: '当前请处理：样衣获取',
      updatedAt: timestamp,
    },
    operatorName,
  )

  return {
    ok: true,
    message: '商品项目立项已完成，已进入样衣获取。',
    project: nextProject,
    projectInitNode: nextProjectInitNode,
    nextNode,
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
): PcsProjectViewRecord | null {
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

  return getProjectById(projectId)
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
