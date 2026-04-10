import { getChannelNamesByCodes, getProjectStoreSnapshot } from './pcs-project-repository.ts'
import {
  buildProjectDetailRelationSectionViewModel,
  buildProjectNodeRelationSectionViewModel,
  type ProjectDetailRelationSectionViewModel,
  type ProjectNodeRelationSectionViewModel,
} from './pcs-project-relation-view-model.ts'
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
  templateName: string
  templateVersion: string
  styleNumber: string
  linkedStyleId: string
  linkedStyleCode: string
  linkedStyleName: string
  linkedStyleGeneratedAt: string
  linkedTechnicalVersionId: string
  linkedTechnicalVersionCode: string
  linkedTechnicalVersionLabel: string
  linkedTechnicalVersionStatus: string
  linkedTechnicalVersionPublishedAt: string
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
  linkedTechnicalVersionId: string
  linkedTechnicalVersionCode: string
  linkedTechnicalVersionLabel: string
  linkedTechnicalVersionStatus: string
  linkedTechnicalVersionPublishedAt: string
  projectArchiveId: string
  projectArchiveNo: string
  projectArchiveStatus: string
  projectArchiveDocumentCount: number
  projectArchiveFileCount: number
  projectArchiveMissingItemCount: number
  projectArchiveUpdatedAt: string
  projectArchiveFinalizedAt: string
  relationSection: ProjectNodeRelationSectionViewModel
  attachments: []
  records: []
  audit: []
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

function buildTimeline(project: PcsProjectRecord, phases: PcsProjectPhaseRecord[], nodes: PcsProjectNodeRecord[]) {
  const timeline: ProjectTimelineItemViewModel[] = [
    {
      time: project.createdAt,
      title: '项目已创建',
      detail: `已创建项目主记录，模板为${project.templateName}。`,
    },
  ]

  phases.forEach((phase) => {
    if (phase.startedAt) {
      timeline.push({
        time: phase.startedAt,
        title: `阶段开始：${phase.phaseName}`,
        detail: `阶段状态为${phase.phaseStatus}。`,
      })
    }
    if (phase.finishedAt) {
      timeline.push({
        time: phase.finishedAt,
        title: `阶段完成：${phase.phaseName}`,
        detail: `阶段状态为${phase.phaseStatus}。`,
      })
    }
  })

  const phaseByCode = buildPhaseByCodeMap(phases)
  nodes.forEach((node) => {
    if (node.latestResultText) {
      timeline.push({
        time: getNodeUpdatedAt(project, phaseByCode.get(node.phaseCode), node),
        title: `节点结果：${node.workItemTypeName}`,
        detail: node.latestResultText,
      })
    }
    if (node.currentIssueText) {
      timeline.push({
        time: getNodeUpdatedAt(project, phaseByCode.get(node.phaseCode), node),
        title: `当前问题：${node.workItemTypeName}`,
        detail: node.currentIssueText,
      })
    }
  })

  return timeline.sort((a, b) => b.time.localeCompare(a.time)).slice(0, 20)
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
  const phaseByCode = buildPhaseByCodeMap(phases)

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
    templateName: project.templateName,
    templateVersion: project.templateVersion,
    styleNumber: project.styleNumber,
    linkedStyleId: project.linkedStyleId || '',
    linkedStyleCode: project.linkedStyleCode || '',
    linkedStyleName: project.linkedStyleName || '',
    linkedStyleGeneratedAt: project.linkedStyleGeneratedAt || '',
    linkedTechnicalVersionId: project.linkedTechnicalVersionId || '',
    linkedTechnicalVersionCode: project.linkedTechnicalVersionCode || '',
    linkedTechnicalVersionLabel: project.linkedTechnicalVersionLabel || '',
    linkedTechnicalVersionStatus: project.linkedTechnicalVersionStatus || '',
    linkedTechnicalVersionPublishedAt: project.linkedTechnicalVersionPublishedAt || '',
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
    timeline: buildTimeline(project, phases, nodes),
    relationSection: buildProjectDetailRelationSectionViewModel(project.projectId),
  }
}

export function buildProjectNodeDetailViewModel(
  projectId: string,
  projectNodeId: string,
): ProjectNodeDetailViewModel | null {
  const snapshot = getProjectStoreSnapshot()
  const project = snapshot.projects.find((item) => item.projectId === projectId)
  if (!project) return null

  const phase = snapshot.phases.find((item) => item.projectId === projectId && item.phaseCode === project.currentPhaseCode) ?? null
  const node = snapshot.nodes.find((item) => item.projectId === projectId && item.projectNodeId === projectNodeId)
  if (!node) return null

  const nodePhase =
    snapshot.phases.find((item) => item.projectId === projectId && item.phaseCode === node.phaseCode) ?? phase
  const nodeView = buildNodeCardViewModel(project, nodePhase ?? undefined, node)

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
    linkedTechnicalVersionId: project.linkedTechnicalVersionId || '',
    linkedTechnicalVersionCode: project.linkedTechnicalVersionCode || '',
    linkedTechnicalVersionLabel: project.linkedTechnicalVersionLabel || '',
    linkedTechnicalVersionStatus: project.linkedTechnicalVersionStatus || '',
    linkedTechnicalVersionPublishedAt: project.linkedTechnicalVersionPublishedAt || '',
    projectArchiveId: project.projectArchiveId || '',
    projectArchiveNo: project.projectArchiveNo || '',
    projectArchiveStatus: project.projectArchiveStatus || '',
    projectArchiveDocumentCount: project.projectArchiveDocumentCount || 0,
    projectArchiveFileCount: project.projectArchiveFileCount || 0,
    projectArchiveMissingItemCount: project.projectArchiveMissingItemCount || 0,
    projectArchiveUpdatedAt: project.projectArchiveUpdatedAt || '',
    projectArchiveFinalizedAt: project.projectArchiveFinalizedAt || '',
    relationSection: buildProjectNodeRelationSectionViewModel(project.projectId, projectNodeId),
    attachments: [],
    records: [],
    audit: [],
  }
}
