import { getChannelNamesByCodes, getProjectStoreSnapshot } from './pcs-project-repository.ts'
import {
  ensurePcsProjectFormalRelationSeedReady,
  listProjectRelationsByProject,
} from './pcs-project-relation-repository.ts'
import {
  buildProjectDetailRelationSectionViewModel,
  buildProjectNodeRelationSectionViewModel,
  listProjectLiveTestingRelationItems,
  listProjectVideoTestingRelationItems,
  type ProjectDetailRelationSectionViewModel,
  type ProjectNodeRelationSectionViewModel,
  type ProjectRelationItemViewModel,
} from './pcs-project-relation-view-model.ts'
import type { ProjectRelationRecord } from './pcs-project-relation-types.ts'
import { getStyleArchiveById } from './pcs-style-archive-repository.ts'
import { getTechnicalVersionStatusLabel } from './pcs-technical-data-version-view-model.ts'
import { getPcsWorkItemRuntimeCarrierDefinition } from './pcs-work-item-runtime-carrier.ts'
import { listProjectInlineNodeRecordSummaryItems } from './pcs-project-inline-node-record-view-model.ts'
import type {
  PcsProjectNodeRecord,
  PcsProjectPhaseRecord,
  PcsProjectRecord,
  ProjectNodeStatus,
  ProjectStatus,
} from './pcs-project-types.ts'

export interface ProjectListItemViewModel {
  projectId: string
  projectCode: string
  projectName: string
  projectType: string
  styleType: string
  categoryPath: string
  projectStatus: ProjectStatus
  currentPhaseCode: string
  currentPhaseName: string
  currentPendingNodeName: string
  currentPendingNodeStatus: ProjectNodeStatus | ''
  currentIssueText: string
  ownerName: string
  updatedAt: string
  tags: string[]
  completedNodeCount: number
  totalNodeCount: number
  progressPercent: number
}

function getLinkedTechPackVersionStatusText(status: string): string {
  if (!status) return ''
  if (status === '已发布' || status === '已归档' || status === '草稿中') return status
  if (status === 'PUBLISHED' || status === 'ARCHIVED' || status === 'DRAFT') {
    return getTechnicalVersionStatusLabel(status)
  }
  return status
}

export interface ProjectPhaseSectionViewModel {
  projectPhaseId: string
  phaseCode: string
  phaseName: string
  phaseOrder: number
  phaseStatus: string
  startedAt: string
  finishedAt: string
  isCurrent: boolean
  nodes: ProjectNodeCardViewModel[]
}

export interface ProjectNodeCardViewModel {
  projectNodeId: string
  projectId: string
  phaseCode: string
  phaseName: string
  workItemTypeCode: string
  workItemTypeName: string
  sequenceNo: number
  currentStatus: ProjectNodeStatus
  currentOwnerName: string
  updatedAt: string
  latestResultType: string
  latestResultText: string
  currentIssueType: string
  currentIssueText: string
  pendingActionType: string
  pendingActionText: string
  sourceTemplateNodeId: string
  sourceTemplateVersion: string
  lastEventId: string
  lastEventType: string
  lastEventTime: string
}

export interface ProjectTimelineItemViewModel {
  time: string
  title: string
  detail: string
}

export interface ProjectDetailViewModel {
  projectId: string
  projectCode: string
  projectName: string
  projectType: string
  categoryPath: string
  brandName: string
  styleTags: string[]
  targetChannelsText: string
  ownerName: string
  teamName: string
  projectStatus: ProjectStatus
  currentPhaseCode: string
  currentPhaseName: string
  currentFocusNodeId: string
  currentFocusWorkItemTypeCode: string
  currentFocusNodeName: string
  currentFocusNodeStatus: ProjectNodeStatus | ''
  currentFocusNodeLatestResultText: string
  currentFocusPhaseCode: string
  currentFocusPhaseName: string
  templateName: string
  templateVersion: string
  styleNumber: string
  linkedStyleId: string
  linkedStyleCode: string
  linkedStyleName: string
  linkedStyleGeneratedAt: string
  linkedTechPackVersionId: string
  linkedTechPackVersionCode: string
  linkedTechPackVersionLabel: string
  linkedTechPackVersionStatus: string
  linkedTechPackVersionPublishedAt: string
  currentTechPackVersionId: string
  currentTechPackVersionCode: string
  currentTechPackVersionLabel: string
  currentTechPackVersionStatus: string
  currentTechPackVersionActivatedAt: string
  currentTechPackVersionActivatedBy: string
  projectArchiveId: string
  projectArchiveNo: string
  projectArchiveStatus: string
  projectArchiveDocumentCount: number
  projectArchiveFileCount: number
  projectArchiveMissingItemCount: number
  projectArchiveUpdatedAt: string
  projectArchiveFinalizedAt: string
  createdAt: string
  updatedAt: string
  phases: ProjectPhaseSectionViewModel[]
  timeline: ProjectTimelineItemViewModel[]
  relationSection: ProjectDetailRelationSectionViewModel
}

export interface ProjectNodeDetailViewModel {
  projectId: string
  projectCode: string
  projectName: string
  projectStatus: ProjectStatus
  node: ProjectNodeCardViewModel
  phase: Pick<ProjectPhaseSectionViewModel, 'projectPhaseId' | 'phaseCode' | 'phaseName' | 'phaseOrder' | 'phaseStatus'>
  templateName: string
  linkedStyleId: string
  linkedStyleCode: string
  linkedStyleName: string
  linkedStyleGeneratedAt: string
  linkedTechPackVersionId: string
  linkedTechPackVersionCode: string
  linkedTechPackVersionLabel: string
  linkedTechPackVersionStatus: string
  linkedTechPackVersionPublishedAt: string
  currentTechPackVersionId: string
  currentTechPackVersionCode: string
  currentTechPackVersionLabel: string
  currentTechPackVersionStatus: string
  currentTechPackVersionActivatedAt: string
  currentTechPackVersionActivatedBy: string
  projectArchiveId: string
  projectArchiveNo: string
  projectArchiveStatus: string
  projectArchiveDocumentCount: number
  projectArchiveFileCount: number
  projectArchiveMissingItemCount: number
  projectArchiveUpdatedAt: string
  projectArchiveFinalizedAt: string
  projectTestingContext: ProjectTestingContextViewModel
  formalLiveRelationCount: number
  formalVideoRelationCount: number
  formalTestingRelationCount: number
  relationSection: ProjectNodeRelationSectionViewModel
  attachments: ProjectNodeDetailSupplementItemViewModel[]
  records: ProjectNodeDetailSupplementItemViewModel[]
  audit: ProjectNodeDetailSupplementItemViewModel[]
}

export interface ProjectTestingContextViewModel {
  formalLiveRelationCount: number
  formalVideoRelationCount: number
  formalTestingRelationCount: number
  latestLiveRelation: ProjectRelationItemViewModel | null
  latestVideoRelation: ProjectRelationItemViewModel | null
  hasFormalTestingRelations: boolean
}

export interface ProjectNodeDetailSupplementItemViewModel {
  itemId: string
  title: string
  summary: string
  time: string
  isPlaceholder: boolean
  metaRows?: Array<{
    label: string
    value: string
  }>
}

export interface ProjectListFilterCatalog {
  owners: string[]
  phases: Array<{ code: string; name: string }>
  statuses: ProjectStatus[]
}

function groupPhasesByProject(phases: PcsProjectPhaseRecord[]) {
  const map = new Map<string, PcsProjectPhaseRecord[]>()
  phases.forEach((phase) => {
    const list = map.get(phase.projectId) ?? []
    list.push(phase)
    map.set(phase.projectId, list)
  })
  map.forEach((list, key) => {
    map.set(
      key,
      [...list].sort((a, b) => a.phaseOrder - b.phaseOrder),
    )
  })
  return map
}

function groupNodesByProject(nodes: PcsProjectNodeRecord[]) {
  const map = new Map<string, PcsProjectNodeRecord[]>()
  nodes.forEach((node) => {
    const list = map.get(node.projectId) ?? []
    list.push(node)
    map.set(node.projectId, list)
  })
  return map
}

function buildPhaseOrderMap(phases: PcsProjectPhaseRecord[]) {
  return new Map(phases.map((phase) => [phase.phaseCode, phase.phaseOrder]))
}

function buildPhaseByCodeMap(phases: PcsProjectPhaseRecord[]) {
  return new Map(phases.map((phase) => [phase.phaseCode, phase]))
}

function getNodeUpdatedAt(
  project: PcsProjectRecord,
  phase: PcsProjectPhaseRecord | undefined,
  node?: Pick<PcsProjectNodeRecord, 'updatedAt' | 'lastEventTime'>,
): string {
  if (node?.updatedAt) return node.updatedAt
  if (node?.lastEventTime) return node.lastEventTime
  if (phase?.phaseCode === project.currentPhaseCode) return project.updatedAt
  if (phase?.finishedAt) return phase.finishedAt
  if (phase?.startedAt) return phase.startedAt
  return project.updatedAt
}

function sortRelationItemsByBusinessDate(items: ProjectRelationItemViewModel[]): ProjectRelationItemViewModel[] {
  return [...items].sort((a, b) => {
    const left = a.businessDate || ''
    const right = b.businessDate || ''
    return right.localeCompare(left)
  })
}

function buildProjectTestingContext(projectId: string): ProjectTestingContextViewModel {
  const liveItems = sortRelationItemsByBusinessDate(listProjectLiveTestingRelationItems(projectId))
  const videoItems = sortRelationItemsByBusinessDate(listProjectVideoTestingRelationItems(projectId))
  const formalLiveRelationCount = liveItems.length
  const formalVideoRelationCount = videoItems.length
  const formalTestingRelationCount = formalLiveRelationCount + formalVideoRelationCount

  return {
    formalLiveRelationCount,
    formalVideoRelationCount,
    formalTestingRelationCount,
    latestLiveRelation: liveItems[0] ?? null,
    latestVideoRelation: videoItems[0] ?? null,
    hasFormalTestingRelations: formalTestingRelationCount > 0,
  }
}

function sortNodesForFlow(nodes: PcsProjectNodeRecord[], phaseOrderMap: Map<string, number>) {
  return [...nodes].sort((a, b) => {
    const phaseOrderDiff = (phaseOrderMap.get(a.phaseCode) ?? 999) - (phaseOrderMap.get(b.phaseCode) ?? 999)
    if (phaseOrderDiff !== 0) return phaseOrderDiff
    return a.sequenceNo - b.sequenceNo
  })
}

function getProgress(nodes: PcsProjectNodeRecord[]) {
  const validNodes = nodes.filter((node) => node.currentStatus !== '已取消')
  const totalNodeCount = validNodes.length
  const completedNodeCount = validNodes.filter((node) => node.currentStatus === '已完成').length
  const progressPercent = Math.round((completedNodeCount / Math.max(totalNodeCount, 1)) * 100)
  return { totalNodeCount, completedNodeCount, progressPercent }
}

function getCurrentPendingNode(nodes: PcsProjectNodeRecord[], phaseOrderMap: Map<string, number>) {
  return sortNodesForFlow(nodes, phaseOrderMap).find((node) =>
    ['待确认', '进行中', '未开始'].includes(node.currentStatus),
  )
}

function resolveTimelineEventTime(...values: Array<string | null | undefined>): string {
  return values.find((value) => Boolean(value)) || ''
}

function getNodeTimelineEventTime(
  project: PcsProjectRecord,
  phase: PcsProjectPhaseRecord | undefined,
  node?: Pick<PcsProjectNodeRecord, 'updatedAt' | 'lastEventTime'>,
): string {
  return resolveTimelineEventTime(
    node?.lastEventTime,
    node?.updatedAt,
    phase?.finishedAt,
    phase?.startedAt,
    project.updatedAt,
    project.createdAt,
  )
}

function getCurrentFocusNode(
  project: PcsProjectRecord,
  phases: PcsProjectPhaseRecord[],
  nodes: PcsProjectNodeRecord[],
): PcsProjectNodeRecord | null {
  const phaseOrderMap = buildPhaseOrderMap(phases)
  const currentPhaseNodes = sortNodesForFlow(
    nodes.filter((node) => node.phaseCode === project.currentPhaseCode),
    phaseOrderMap,
  )

  const inProgressNode = currentPhaseNodes.find((node) => node.currentStatus === '进行中')
  if (inProgressNode) return inProgressNode

  const pendingConfirmNode = currentPhaseNodes.find((node) => node.currentStatus === '待确认')
  if (pendingConfirmNode) return pendingConfirmNode

  if (project.projectStatus === '已终止') {
    const terminatedFocusNode = [...currentPhaseNodes]
      .filter(
        (node) =>
          ['已取消', '已完成'].includes(node.currentStatus) &&
          Boolean(node.latestResultText.trim()),
      )
      .sort((a, b) => b.sequenceNo - a.sequenceNo)[0]
    if (terminatedFocusNode) return terminatedFocusNode
  }

  const notStartedNode = currentPhaseNodes.find((node) => node.currentStatus === '未开始')
  if (notStartedNode) return notStartedNode

  return getCurrentPendingNode(nodes, phaseOrderMap) ?? null
}

function getCurrentIssueNode(
  project: PcsProjectRecord,
  phases: PcsProjectPhaseRecord[],
  nodes: PcsProjectNodeRecord[],
) {
  const phaseByCode = buildPhaseByCodeMap(phases)
  return [...nodes]
    .filter((node) => node.currentIssueText.trim())
    .sort((a, b) => {
      const currentPhaseWeightDiff =
        Number(b.phaseCode === project.currentPhaseCode) - Number(a.phaseCode === project.currentPhaseCode)
      if (currentPhaseWeightDiff !== 0) return currentPhaseWeightDiff
      return getNodeUpdatedAt(project, phaseByCode.get(b.phaseCode), b).localeCompare(
        getNodeUpdatedAt(project, phaseByCode.get(a.phaseCode), a),
      )
    })[0]
}

function buildNodeCardViewModel(
  project: PcsProjectRecord,
  phase: PcsProjectPhaseRecord | undefined,
  node: PcsProjectNodeRecord,
): ProjectNodeCardViewModel {
  return {
    projectNodeId: node.projectNodeId,
    projectId: node.projectId,
    phaseCode: node.phaseCode,
    phaseName: node.phaseName,
    workItemTypeCode: node.workItemTypeCode,
    workItemTypeName: node.workItemTypeName,
    sequenceNo: node.sequenceNo,
    currentStatus: node.currentStatus,
    currentOwnerName: node.currentOwnerName || project.ownerName,
    updatedAt: getNodeUpdatedAt(project, phase, node),
    latestResultType: node.latestResultType,
    latestResultText: node.latestResultText,
    currentIssueType: node.currentIssueType,
    currentIssueText: node.currentIssueText,
    pendingActionType: node.pendingActionType,
    pendingActionText: node.pendingActionText,
    sourceTemplateNodeId: node.sourceTemplateNodeId,
    sourceTemplateVersion: node.sourceTemplateVersion,
    lastEventId: node.lastEventId,
    lastEventType: node.lastEventType,
    lastEventTime: node.lastEventTime,
  }
}

function getRelationEventTime(record: ProjectRelationRecord): string {
  return resolveTimelineEventTime(record.businessDate, record.updatedAt)
}

function isMeaningfulRelationForTimeline(
  relation: ProjectRelationRecord,
  currentFocusNode: PcsProjectNodeRecord | null,
  currentPhaseCode: string,
): boolean {
  if (
    relation.projectNodeId &&
    currentFocusNode?.projectNodeId &&
    relation.projectNodeId === currentFocusNode.projectNodeId
  ) {
    return true
  }
  if (relation.workItemTypeCode && relation.workItemTypeCode === currentFocusNode?.workItemTypeCode) {
    return true
  }
  if (!relation.workItemTypeCode) return false
  const relatedWorkItems = new Set(['CHANNEL_PRODUCT_LISTING', 'LIVE_TEST', 'VIDEO_TEST', 'TEST_DATA_SUMMARY', 'TEST_CONCLUSION'])
  if (currentPhaseCode === 'PHASE_03' && relatedWorkItems.has(relation.workItemTypeCode)) {
    return true
  }
  if (currentPhaseCode === 'PHASE_04') {
    const phaseFourItems = new Set(['STYLE_ARCHIVE_CREATE', 'PROJECT_TRANSFER_PREP', 'PATTERN_TASK', 'PATTERN_ARTWORK_TASK', 'FIRST_SAMPLE', 'PRE_PRODUCTION_SAMPLE'])
    return phaseFourItems.has(relation.workItemTypeCode)
  }
  return false
}

function buildRelationTimelineTitle(relation: ProjectRelationRecord): string {
  if (relation.sourceModule === '渠道商品') {
    if (relation.sourceStatus.includes('作废')) return '渠道商品已作废'
    if (relation.sourceStatus.includes('生效')) return '渠道商品已生效'
    return '渠道商品已建立'
  }
  if (relation.sourceModule === '上游渠道商品同步') return '上游渠道商品已更新'
  if (relation.sourceModule === '直播') return '直播测款已关联'
  if (relation.sourceModule === '短视频') return '短视频测款已关联'
  if (relation.sourceModule === '款式档案') return '已生成款式档案'
  if (relation.sourceModule === '技术包') {
    if (relation.sourceStatus === '已发布') return '技术包版本已发布'
    if (relation.sourceStatus === '已归档') return '技术包版本已归档'
    return '技术包版本已关联'
  }
  if (relation.sourceModule === '项目资料归档') return '项目资料归档已建立'
  return `${relation.sourceModule}已关联`
}

function buildRelationTimelineDetail(relation: ProjectRelationRecord): string {
  const title = relation.sourceTitle || relation.sourceObjectCode || relation.sourceObjectType
  const statusText = relation.sourceStatus ? `，当前状态：${relation.sourceStatus}` : ''
  const workItemText = relation.workItemTypeName ? `，关联节点：${relation.workItemTypeName}` : ''
  const noteText = relation.note ? `，${trimTimelineSentence(relation.note)}` : ''
  return `${title}${statusText}${workItemText}${noteText}。`
}

function trimTimelineSentence(text: string): string {
  return text.replace(/[。！!？?]+$/u, '')
}

function buildTimeline(
  project: PcsProjectRecord,
  phases: PcsProjectPhaseRecord[],
  nodes: PcsProjectNodeRecord[],
  currentFocusNode: PcsProjectNodeRecord | null,
  currentFocusPhase: PcsProjectPhaseRecord | null,
  relations: ProjectRelationRecord[],
) {
  const currentSummaryTime = getNodeTimelineEventTime(project, currentFocusPhase ?? undefined, currentFocusNode ?? undefined)
  const currentSummary: ProjectTimelineItemViewModel = {
    time: currentSummaryTime,
    title: '当前项目所处位置',
    detail: `当前项目状态：${project.projectStatus}；当前阶段：${project.currentPhaseName}（${currentFocusPhase?.phaseStatus || '未开始'}）；当前节点：${currentFocusNode?.workItemTypeName || '暂无当前节点'}（${currentFocusNode?.currentStatus || '未开始'}）；最近结果：${trimTimelineSentence(currentFocusNode?.latestResultText || '暂无最近结果')}。`,
  }

  const timeline: ProjectTimelineItemViewModel[] = []

  if (project.createdAt) {
    timeline.push({
      time: project.createdAt,
      title: '项目已创建',
      detail: `已创建项目主记录，模板为${project.templateName}。`,
    })
  }

  if (currentFocusPhase) {
    const phaseEventTime = resolveTimelineEventTime(
      currentFocusPhase.finishedAt,
      currentFocusPhase.startedAt,
      currentSummaryTime,
    )
    if (phaseEventTime) {
      const phaseTitle =
        currentFocusPhase.phaseStatus === '已终止'
          ? `当前阶段已终止：${currentFocusPhase.phaseName}`
          : currentFocusPhase.phaseStatus === '已完成'
            ? `当前阶段已完成：${currentFocusPhase.phaseName}`
            : `已进入当前阶段：${currentFocusPhase.phaseName}`
      timeline.push({
        time: phaseEventTime,
        title: phaseTitle,
        detail: `阶段状态：${currentFocusPhase.phaseStatus}。`,
      })
    }
  }

  if (currentFocusNode) {
    const nodeTime = getNodeTimelineEventTime(project, currentFocusPhase ?? undefined, currentFocusNode)
    if (nodeTime) {
      const nodeTitle =
        currentFocusNode.currentStatus === '已取消'
          ? `当前节点已取消：${currentFocusNode.workItemTypeName}`
          : currentFocusNode.currentStatus === '已完成'
            ? `当前节点已完成：${currentFocusNode.workItemTypeName}`
            : currentFocusNode.currentStatus === '待确认'
              ? `当前节点待确认：${currentFocusNode.workItemTypeName}`
              : currentFocusNode.currentStatus === '进行中'
                ? `当前节点进行中：${currentFocusNode.workItemTypeName}`
                : `当前节点待处理：${currentFocusNode.workItemTypeName}`
      timeline.push({
        time: nodeTime,
        title: nodeTitle,
        detail: currentFocusNode.latestResultText || currentFocusNode.pendingActionText || '当前节点暂无最近结果。',
      })
    }
  }

  relations
    .filter((relation) => isMeaningfulRelationForTimeline(relation, currentFocusNode, project.currentPhaseCode))
    .sort((a, b) => getRelationEventTime(b).localeCompare(getRelationEventTime(a)))
    .forEach((relation) => {
      const time = getRelationEventTime(relation)
      if (!time) return
      timeline.push({
        time,
        title: buildRelationTimelineTitle(relation),
        detail: buildRelationTimelineDetail(relation),
      })
    })

  const deduped = new Map<string, ProjectTimelineItemViewModel>()
  ;[currentSummary, ...timeline]
    .filter((item) => item.time || item.title || item.detail)
    .forEach((item) => {
      const key = `${item.time}::${item.title}`
      if (!deduped.has(key)) {
        deduped.set(key, item)
      }
    })

  const allItems = Array.from(deduped.values())
  const currentItem = allItems.find((item) => item.title === '当前项目所处位置') ?? currentSummary
  const restItems = allItems
    .filter((item) => item !== currentItem)
    .sort((a, b) => b.time.localeCompare(a.time))
    .slice(0, 7)

  return [currentItem, ...restItems]
}

export function buildProjectListViewModels(): ProjectListItemViewModel[] {
  const snapshot = getProjectStoreSnapshot()
  const phaseMap = groupPhasesByProject(snapshot.phases)
  const nodeMap = groupNodesByProject(snapshot.nodes)

  return [...snapshot.projects]
    .map((project) => buildProjectListItemViewModel(project, phaseMap.get(project.projectId) ?? [], nodeMap.get(project.projectId) ?? []))
    .sort((a, b) => {
      const updatedDiff = b.updatedAt.localeCompare(a.updatedAt)
      if (updatedDiff !== 0) return updatedDiff
      const pendingDiff = Number(Boolean(b.currentPendingNodeName)) - Number(Boolean(a.currentPendingNodeName))
      if (pendingDiff !== 0) return pendingDiff
      const issueDiff = Number(Boolean(b.currentIssueText)) - Number(Boolean(a.currentIssueText))
      if (issueDiff !== 0) return issueDiff
      return a.progressPercent - b.progressPercent
    })
}

export function buildProjectListItemViewModel(
  project: PcsProjectRecord,
  phases: PcsProjectPhaseRecord[],
  nodes: PcsProjectNodeRecord[],
): ProjectListItemViewModel {
  const phaseOrderMap = buildPhaseOrderMap(phases)
  const pendingNode = getCurrentPendingNode(nodes, phaseOrderMap)
  const issueNode = getCurrentIssueNode(project, phases, nodes)
  const progress = getProgress(nodes)

  return {
    projectId: project.projectId,
    projectCode: project.projectCode,
    projectName: project.projectName,
    projectType: project.projectType,
    styleType: project.styleType,
    categoryPath: [project.categoryName, project.subCategoryName].filter(Boolean).join(' / '),
    projectStatus: project.projectStatus,
    currentPhaseCode: project.currentPhaseCode,
    currentPhaseName: project.currentPhaseName,
    currentPendingNodeName: pendingNode?.workItemTypeName ?? '',
    currentPendingNodeStatus: pendingNode?.currentStatus ?? '',
    currentIssueText: issueNode?.currentIssueText ?? '',
    ownerName: project.ownerName,
    updatedAt: project.updatedAt,
    tags: [...project.styleTags],
    completedNodeCount: progress.completedNodeCount,
    totalNodeCount: progress.totalNodeCount,
    progressPercent: progress.progressPercent,
  }
}

export function getProjectListFilterCatalog(): ProjectListFilterCatalog {
  const snapshot = getProjectStoreSnapshot()
  const phaseMap = groupPhasesByProject(snapshot.phases)

  return {
    owners: Array.from(new Set(snapshot.projects.map((item) => item.ownerName))).sort((a, b) => a.localeCompare(b, 'zh-CN')),
    phases: Array.from(
      new Map(
        snapshot.projects
          .flatMap((project) => phaseMap.get(project.projectId) ?? [])
          .map((phase) => [phase.phaseCode, { code: phase.phaseCode, name: phase.phaseName }]),
      ).values(),
    ).sort((a, b) => a.code.localeCompare(b.code)),
    statuses: Array.from(new Set(snapshot.projects.map((item) => item.projectStatus))) as ProjectStatus[],
  }
}

export function buildProjectDetailViewModel(projectId: string): ProjectDetailViewModel | null {
  ensurePcsProjectFormalRelationSeedReady()
  const snapshot = getProjectStoreSnapshot()
  const project = snapshot.projects.find((item) => item.projectId === projectId)
  if (!project) return null

  const phases = snapshot.phases
    .filter((item) => item.projectId === projectId)
    .sort((a, b) => a.phaseOrder - b.phaseOrder)
  const nodes = snapshot.nodes.filter((item) => item.projectId === projectId)
  return buildProjectDetailViewModelFromRecords(project, phases, nodes)
}

export function buildProjectDetailViewModelFromRecords(
  project: PcsProjectRecord,
  phases: PcsProjectPhaseRecord[],
  nodes: PcsProjectNodeRecord[],
): ProjectDetailViewModel {
  ensurePcsProjectFormalRelationSeedReady()
  const phaseByCode = buildPhaseByCodeMap(phases)
  const style = project.linkedStyleId ? getStyleArchiveById(project.linkedStyleId) : null
  const currentFocusNode = getCurrentFocusNode(project, phases, nodes)
  const currentFocusPhase =
    (currentFocusNode ? phaseByCode.get(currentFocusNode.phaseCode) : null) ??
    phaseByCode.get(project.currentPhaseCode) ??
    null
  const relations = listProjectRelationsByProject(project.projectId)

  const phaseSections: ProjectPhaseSectionViewModel[] = phases.map((phase) => ({
    projectPhaseId: phase.projectPhaseId,
    phaseCode: phase.phaseCode,
    phaseName: phase.phaseName,
    phaseOrder: phase.phaseOrder,
    phaseStatus: phase.phaseStatus,
    startedAt: phase.startedAt,
    finishedAt: phase.finishedAt,
    isCurrent: project.currentPhaseCode === phase.phaseCode || phase.phaseStatus === '进行中',
    nodes: nodes
      .filter((node) => node.phaseCode === phase.phaseCode)
      .sort((a, b) => a.sequenceNo - b.sequenceNo)
      .map((node) => buildNodeCardViewModel(project, phaseByCode.get(node.phaseCode), node)),
  }))

  return {
    projectId: project.projectId,
    projectCode: project.projectCode,
    projectName: project.projectName,
    projectType: project.projectType,
    categoryPath: [project.categoryName, project.subCategoryName].filter(Boolean).join(' / '),
    brandName: project.brandName,
    styleTags: [...project.styleTags],
    targetChannelsText: getChannelNamesByCodes(project.targetChannelCodes).join(' / '),
    ownerName: project.ownerName,
    teamName: project.teamName,
    projectStatus: project.projectStatus,
    currentPhaseCode: project.currentPhaseCode,
    currentPhaseName: project.currentPhaseName,
    currentFocusNodeId: currentFocusNode?.projectNodeId || '',
    currentFocusWorkItemTypeCode: currentFocusNode?.workItemTypeCode || '',
    currentFocusNodeName: currentFocusNode?.workItemTypeName || '',
    currentFocusNodeStatus: currentFocusNode?.currentStatus || '',
    currentFocusNodeLatestResultText: currentFocusNode?.latestResultText || '',
    currentFocusPhaseCode: currentFocusPhase?.phaseCode || project.currentPhaseCode,
    currentFocusPhaseName: currentFocusPhase?.phaseName || project.currentPhaseName,
    templateName: project.templateName,
    templateVersion: project.templateVersion,
    styleNumber: project.styleCodeName || project.styleNumber,
    linkedStyleId: project.linkedStyleId || '',
    linkedStyleCode: project.linkedStyleCode || '',
    linkedStyleName: project.linkedStyleName || '',
    linkedStyleGeneratedAt: project.linkedStyleGeneratedAt || '',
    linkedTechPackVersionId: project.linkedTechPackVersionId || '',
    linkedTechPackVersionCode: project.linkedTechPackVersionCode || '',
    linkedTechPackVersionLabel: project.linkedTechPackVersionLabel || '',
    linkedTechPackVersionStatus: getLinkedTechPackVersionStatusText(project.linkedTechPackVersionStatus || ''),
    linkedTechPackVersionPublishedAt: project.linkedTechPackVersionPublishedAt || '',
    currentTechPackVersionId: style?.currentTechPackVersionId || '',
    currentTechPackVersionCode: style?.currentTechPackVersionCode || '',
    currentTechPackVersionLabel: style?.currentTechPackVersionLabel || '',
    currentTechPackVersionStatus: style?.currentTechPackVersionStatus || '',
    currentTechPackVersionActivatedAt: style?.currentTechPackVersionActivatedAt || '',
    currentTechPackVersionActivatedBy: style?.currentTechPackVersionActivatedBy || '',
    projectArchiveId: project.projectArchiveId || '',
    projectArchiveNo: project.projectArchiveNo || '',
    projectArchiveStatus: project.projectArchiveStatus || '',
    projectArchiveDocumentCount: project.projectArchiveDocumentCount || 0,
    projectArchiveFileCount: project.projectArchiveFileCount || 0,
    projectArchiveMissingItemCount: project.projectArchiveMissingItemCount || 0,
    projectArchiveUpdatedAt: project.projectArchiveUpdatedAt || '',
    projectArchiveFinalizedAt: project.projectArchiveFinalizedAt || '',
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    phases: phaseSections,
    timeline: buildTimeline(project, phases, nodes, currentFocusNode, currentFocusPhase, relations),
    relationSection: buildProjectDetailRelationSectionViewModel(project.projectId),
  }
}

export function buildProjectNodeDetailViewModel(
  projectId: string,
  projectNodeId: string,
): ProjectNodeDetailViewModel | null {
  ensurePcsProjectFormalRelationSeedReady()
  const snapshot = getProjectStoreSnapshot()
  const project = snapshot.projects.find((item) => item.projectId === projectId)
  if (!project) return null
  const style = project.linkedStyleId ? getStyleArchiveById(project.linkedStyleId) : null

  const phase = snapshot.phases.find((item) => item.projectId === projectId && item.phaseCode === project.currentPhaseCode) ?? null
  const node = snapshot.nodes.find((item) => item.projectId === projectId && item.projectNodeId === projectNodeId)
  if (!node) return null

  const nodePhase =
    snapshot.phases.find((item) => item.projectId === projectId && item.phaseCode === node.phaseCode) ?? phase
  const nodeView = buildNodeCardViewModel(project, nodePhase ?? undefined, node)
  const relationSection = buildProjectNodeRelationSectionViewModel(project.projectId, projectNodeId)
  const projectTestingContext = buildProjectTestingContext(project.projectId)
  const carrier = getPcsWorkItemRuntimeCarrierDefinition(
    node.workItemTypeCode as Parameters<typeof getPcsWorkItemRuntimeCarrierDefinition>[0],
  )
  const inlineRecordItems = listProjectInlineNodeRecordSummaryItems(node.projectNodeId).map((item) => ({
    itemId: item.itemId,
    title: item.title,
    summary: item.summary,
    time: item.time,
    isPlaceholder: false,
    metaRows: item.metaRows,
  }))
  const buildSupplementItems = (
    kind: 'attachments' | 'records' | 'audit',
  ): ProjectNodeDetailSupplementItemViewModel[] => {
    const time = nodeView.lastEventTime || nodeView.updatedAt || project.updatedAt || project.createdAt
    if (kind === 'attachments') {
      return [
        {
          itemId: `${project.projectId}-${node.projectNodeId}-attachments-placeholder`,
          title: '当前暂无附件',
          summary: '当前节点暂未沉淀正式附件。',
          time,
          isPlaceholder: true,
        },
      ]
    }
    if (kind === 'records') {
      if (
        carrier.projectDisplayRequirementCode === 'PROJECT_INLINE_SINGLE' ||
        carrier.projectDisplayRequirementCode === 'PROJECT_INLINE_RECORDS'
      ) {
        if (inlineRecordItems.length > 0) {
          return inlineRecordItems
        }
        return [
          {
            itemId: `${project.projectId}-${node.projectNodeId}-records-placeholder`,
            title: '当前暂无正式记录',
            summary: '当前节点暂未沉淀正式记录。',
            time,
            isPlaceholder: true,
          },
        ]
      }
      if (carrier.projectDisplayRequirementCode === 'STANDALONE_INSTANCE_LIST') {
        return [
          {
            itemId: `${project.projectId}-${node.projectNodeId}-records-placeholder`,
            title: '当前不单独维护记录列表',
            summary: '当前节点以独立实例模块承载，请通过关联实例入口查看。',
            time,
            isPlaceholder: true,
          },
        ]
      }
      if (carrier.projectDisplayRequirementCode === 'PROJECT_AGGREGATE') {
        return [
          {
            itemId: `${project.projectId}-${node.projectNodeId}-records-placeholder`,
            title: '当前不单独维护记录列表',
            summary: '当前节点通过聚合对象承载，不单独维护记录列表。',
            time,
            isPlaceholder: true,
          },
        ]
      }
      return [
        {
          itemId: `${project.projectId}-${node.projectNodeId}-records-placeholder`,
          title: '当前暂无正式记录',
          summary: '当前节点暂未沉淀正式记录。',
          time,
          isPlaceholder: true,
        },
      ]
    }
    return [
      {
        itemId: `${project.projectId}-${node.projectNodeId}-audit-placeholder`,
        title: '当前暂无审计记录',
        summary: '当前节点暂未沉淀正式审计记录。',
        time,
        isPlaceholder: true,
      },
    ]
  }

  return {
    projectId: project.projectId,
    projectCode: project.projectCode,
    projectName: project.projectName,
    projectStatus: project.projectStatus,
    node: nodeView,
    phase: {
      projectPhaseId: nodePhase?.projectPhaseId ?? '',
      phaseCode: node.phaseCode,
      phaseName: node.phaseName,
      phaseOrder: nodePhase?.phaseOrder ?? 0,
      phaseStatus: nodePhase?.phaseStatus ?? '未开始',
    },
    templateName: project.templateName,
    linkedStyleId: project.linkedStyleId || '',
    linkedStyleCode: project.linkedStyleCode || '',
    linkedStyleName: project.linkedStyleName || '',
    linkedStyleGeneratedAt: project.linkedStyleGeneratedAt || '',
    linkedTechPackVersionId: project.linkedTechPackVersionId || '',
    linkedTechPackVersionCode: project.linkedTechPackVersionCode || '',
    linkedTechPackVersionLabel: project.linkedTechPackVersionLabel || '',
    linkedTechPackVersionStatus: getLinkedTechPackVersionStatusText(project.linkedTechPackVersionStatus || ''),
    linkedTechPackVersionPublishedAt: project.linkedTechPackVersionPublishedAt || '',
    currentTechPackVersionId: style?.currentTechPackVersionId || '',
    currentTechPackVersionCode: style?.currentTechPackVersionCode || '',
    currentTechPackVersionLabel: style?.currentTechPackVersionLabel || '',
    currentTechPackVersionStatus: style?.currentTechPackVersionStatus || '',
    currentTechPackVersionActivatedAt: style?.currentTechPackVersionActivatedAt || '',
    currentTechPackVersionActivatedBy: style?.currentTechPackVersionActivatedBy || '',
    projectArchiveId: project.projectArchiveId || '',
    projectArchiveNo: project.projectArchiveNo || '',
    projectArchiveStatus: project.projectArchiveStatus || '',
    projectArchiveDocumentCount: project.projectArchiveDocumentCount || 0,
    projectArchiveFileCount: project.projectArchiveFileCount || 0,
    projectArchiveMissingItemCount: project.projectArchiveMissingItemCount || 0,
    projectArchiveUpdatedAt: project.projectArchiveUpdatedAt || '',
    projectArchiveFinalizedAt: project.projectArchiveFinalizedAt || '',
    projectTestingContext,
    formalLiveRelationCount: projectTestingContext.formalLiveRelationCount,
    formalVideoRelationCount: projectTestingContext.formalVideoRelationCount,
    formalTestingRelationCount: projectTestingContext.formalTestingRelationCount,
    relationSection,
    attachments: buildSupplementItems('attachments'),
    records: buildSupplementItems('records'),
    audit: buildSupplementItems('audit'),
  }
}
